"""Harness side of the P-A acceptance probe (see README.md).

    python3 pa_harness.py HARNESS_TREE CASES.json OUT.json

CASES.json is pa_probe.js output (the page's send attempt per case).
HARNESS_TREE is the checkout whose `lyric-harness/lyric_harness.py` reads the
payload; normally the same tree as the page. For every payload the probe runs

    lyric_harness.py --reader-scheme=<page scheme> [--voices] [--numbering=N]
        [--pronunciations=JSON] normalize-numbering DRAFT [--groups=G] [--returns=R]

with exactly the flags the payload implies (the connector's `globalsFor`
plus `--reader-scheme`, as `restoreEquivalentNumbering` spells them; the
lexicon-basis globals stay at their defaults), then maps the canonical token
back to its characters with that tree's own `reader_token_spans`.

What happened to the declaration (`class`):
  SAME_WORD   binds the intended occurrence (same characters of the line)
  REFUSED     refused loudly: the page sent nothing ("Nothing was sent", or
              the declaration travels only as needing a decision), or the
              harness exits 2
  WRONG_WORD  binds a different occurrence, silently (a same-spelled echo
              counts: other characters are another word)
  DROPPED     gone from the payload with no decision asked

Verdict (PRESERVE-OR-REFUSE, 3PO #527 6194066262):
  - a row that records its basis (`— numbering ...`): SAME_WORD or REFUSED pass;
  - a row that does not (`— cut v2` only, as b887 migrates rows, or no mark):
    REFUSED passes only if the send attempt left the row bytes unchanged;
    SAME_WORD passes only if every plausible basis names the same occurrence
    (else GUESSED, a failure); the send attempt must not change its bytes;
  - WRONG_WORD, DROPPED and errors always fail.
Exit 0 only when no case fails; 1 otherwise; 3 when HARNESS_TREE has no
`normalize-numbering` verb.
"""
import json
import os
import re
import subprocess
import sys
import tempfile

HTREE, CASES, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HDIR = os.path.join(os.path.abspath(HTREE), 'lyric-harness')
HPY = os.path.join(HDIR, 'lyric_harness.py')
FIELD = {'groups': 'groups', 'returns': 'returns', 'reading': 'pronunciations'}


def git_head(tree):
    try:
        return subprocess.run(['git', '-C', tree, 'rev-parse', 'HEAD'], capture_output=True,
                              text=True, check=True).stdout.strip()
    except Exception:
        return None


data = json.load(open(CASES, encoding='utf-8'))
report = {'probe': 'pa_voices/pa_harness.py', 'page_tree': data.get('page_tree'),
          'page_commit': data.get('page_commit'), 'page_features': data.get('page_features'),
          'harness_tree': os.path.abspath(HTREE), 'harness_commit': git_head(HTREE),
          'replica': data.get('replica')}
if 'normalize-numbering' not in open(HPY, encoding='utf-8').read():
    report['error'] = 'HARNESS_LACKS_VERB: this lyric_harness.py has no normalize-numbering verb'
    json.dump(report, open(OUT, 'w', encoding='utf-8'), indent=1)
    print(report['error'])
    sys.exit(3)

sys.path.insert(0, HDIR)
from lyric_harness import reader_token_spans  # noqa: E402  (the harness tree's own reader)

scheme = (data.get('page_features') or {}).get('token_scheme') or 'v2'


def run_harness(sung_lines, payload):
    with tempfile.TemporaryDirectory() as d:
        draft = os.path.join(d, 'draft.txt')
        with open(draft, 'w', encoding='utf-8') as f:
            f.write('\n'.join(sung_lines) + '\n')
        argv = [f'--reader-scheme={scheme}']
        if payload.get('voices') is True:
            argv.append('--voices')
        if 'numbering' in payload:
            argv.append(f"--numbering={payload['numbering']}")
        if 'pronunciations' in payload:
            argv.append('--pronunciations=' + json.dumps(payload['pronunciations'], ensure_ascii=False))
        argv += ['normalize-numbering', draft]
        for key in ('groups', 'returns'):
            if payload.get(key):
                argv.append(f'--{key}={payload[key]}')
        p = subprocess.run([sys.executable, HPY] + argv, capture_output=True, text=True, cwd=HDIR)
        record = None
        for line in p.stdout.splitlines():
            if line.strip().startswith('lyric result:'):
                record = json.loads(line.split('lyric result:', 1)[1])
        shown = ['DRAFT' if a == draft else a for a in argv]
        return p.returncode, record, shown, (p.stderr.strip().splitlines() or [''])[-1]


def bound_occurrence(line, token, numbering):
    rows = reader_token_spans(line, '+voices' not in numbering, numbering.split('+')[0]) or []
    if not 1 <= token <= len(rows):
        return None
    text, pieces = rows[token - 1]
    return {'word': text, 'token': token, 'numbering': numbering, 'pieces': [list(p) for p in pieces]}


def classify(c):
    """-> (class, detail, extra)"""
    if c.get('probe_error'):
        return 'PROBE_ERROR', c['probe_error'].splitlines()[0], {}
    if 'payload' not in c:
        return 'REFUSED', f"page: {c.get('page_refusal')}", {}
    pay, kind = c['payload'], c['kind']
    field = FIELD[kind]
    need = pay.get('readings_need_decision' if kind == 'reading' else f'{field}_need_decision')
    if field not in pay and need:
        return 'REFUSED', 'page: sent only as needing a decision', {}
    if field not in pay:
        return 'DROPPED', 'no declaration and no decision asked', {}
    code, rec, argv, err = run_harness(c['sung_lines'], pay)
    extra = {'harness_argv': argv, 'harness_exit': code}
    if rec is None:
        return 'HARNESS_ERROR', err, extra
    if rec.get('status') == 'refused' or code == 2:
        return 'REFUSED', f"harness: {rec.get('refusal')}", extra
    canon = rec['canonical_declarations']
    if kind == 'reading':
        row = canon['pronunciations'][0]
        bound = bound_occurrence(c['line'], row['token'], row.get('numbering') or canon['numbering'])
    else:
        m = re.search(r'(?:^|[;,])1\.T(\d+)(?=$|[;,])', canon[field])
        bound = m and bound_occurrence(c['line'], int(m.group(1)), canon['numbering'])
    extra.update(canonical=canon, bound=bound)
    want = c['intended']
    if not bound:
        return 'WRONG_WORD', 'canonical token names no word of the line', extra
    if bound['pieces'] == want['pieces']:
        return 'SAME_WORD', None, extra
    same = bound['word'].lower() == want['word'].lower()
    return 'WRONG_WORD', (f"bound {bound['word']!r} at {bound['pieces']} "
                          f"({'same spelling, other occurrence' if same else 'other word'}); "
                          f"intended {want['word']!r} at {want['pieces']}"), extra


def verdict(c, cls):
    if cls not in ('SAME_WORD', 'REFUSED'):
        return 'FAIL', cls
    if c.get('basis_recorded'):
        return 'PASS', None
    # The bytes rule is 3PO's for rows already migrated (`— cut v2` only). A
    # wholly unmarked pre-release row is still the page's migration input, so
    # its send boundary may mark it; that is recorded, not judged.
    if c.get('row_written_mark') == 'cut v2 only' and not c.get('row_bytes_unchanged_by_send'):
        return 'FAIL', 'cut-v2-only row rewritten by the send attempt'
    if cls == 'REFUSED':
        return 'PASS', None
    if (c.get('plausible') or {}).get('agree'):
        return 'PASS', None
    return 'FAIL', 'GUESSED: SAME_WORD although the plausible bases name different occurrences'


results = []
for c in data['cases']:
    r = {k: c.get(k) for k in ('id', 'line', 'kind', 'origin', 'transition', 'control', 'written',
                               'numbers', 'intended', 'row_written_mark', 'basis_recorded', 'plausible',
                               'row_bytes_unchanged_by_send', 'row_bytes_unchanged_since_written', 'steps')}
    cls, detail, extra = classify(c)
    r['class'], r['detail'] = cls, detail
    if 'payload' in c:
        r['payload'] = {k: c['payload'][k] for k in ('groups', 'returns', 'numbering', 'voices', 'pronunciations',
                                                     'groups_need_decision', 'returns_need_decision',
                                                     'readings_need_decision') if k in c['payload']}
    r.update(extra)
    r['verdict'], r['why'] = verdict(c, cls)
    results.append(r)


def tally(rows):
    out = {}
    for r in rows:
        out[r['class']] = out.get(r['class'], 0) + 1
    out['FAIL'] = sum(r['verdict'] == 'FAIL' for r in rows)
    return out


report['counts'] = tally(results)
report['counts_by'] = {
    'row records its basis (numbering+cut)': tally([r for r in results if r['row_written_mark'] == 'numbering+cut']),
    'row already migrated, no basis (cut v2 only)': tally([r for r in results if r['row_written_mark'] == 'cut v2 only']),
    'pre-release row left unmarked (no mark)': tally([r for r in results if r['row_written_mark'] == 'unmarked']),
    'voices changed': tally([r for r in results if not r['control']]),
    'controls (voices unchanged)': tally([r for r in results if r['control']]),
}
report['cases'] = results


def write_report(path, rep):
    # One case per line keeps the file small and greppable.
    head = {k: v for k, v in rep.items() if k != 'cases'}
    with open(path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(head, ensure_ascii=False, indent=1)[:-2] + ',\n "cases": [\n')
        f.write(',\n'.join(json.dumps(r, ensure_ascii=False, separators=(',', ':')) for r in rep['cases']))
        f.write('\n ]\n}\n')


write_report(OUT, report)

print(f"page {report['page_commit']}  harness {report['harness_commit']}")
print(f"({report['replica']}; classifier: the harness tree's normalize-numbering)")
print(f"{'verdict':<8}{'class':<11}{'case':<48}{'mark':<14}{'sent':<28}want -> got")
for r in results:
    pay = r.get('payload')
    if pay is None:
        shown = 'page: nothing sent'
    elif r['kind'] == 'reading':
        p = (pay.get('pronunciations') or [None])[0]
        shown = f"T{p['token']} {p.get('numbering') or '(no numbering)'}" if p else 'held: needs decision'
    else:
        v = pay.get(r['kind'])
        shown = f"{v} {pay.get('numbering') or '(no numbering)'}" if v else 'held: needs decision'
    b, w = r.get('bound'), r['intended']
    got = f"{b['word']}@{b['pieces'][0][0]}" if b else r['class']
    want = f"{w['word']}@{w['pieces'][0][0]}" if w else '?'
    note = f"  [{r['why']}]" if r['why'] and r['why'] != r['class'] else ''
    print(f"{r['verdict']:<8}{r['class']:<11}{r['id']:<48}{r['row_written_mark'] or '':<14}{shown:<28}{want} -> {got}{note}")
for k, v in [('all', report['counts'])] + list(report['counts_by'].items()):
    print(f'{k}: {json.dumps(v)}')
fails = report['counts']['FAIL']
print('PASS' if not fails else f'FAIL ({fails} cases)')
sys.exit(1 if fails else 0)

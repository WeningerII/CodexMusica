#!/usr/bin/env python3
"""Reproduce E-5's declared compatibility experiment; exit nonzero on failure.

Run: python3 quality/e5_coda_adoption.py
     python3 quality/e5_coda_adoption.py --part=canon
     python3 quality/e5_coda_adoption.py --part=random-1/4
Policy: E5_CODA_ADOPTION.md. Historical evidence is explicit, never a default.

The canon arm owns every corpus, fixed-span and control assertion. The random
arms deal the unchanged sampler grid by index residue. Running canon and the
complete random k/n matrix therefore asks exactly the same questions as the
default command, with every sampler and both declarations retained.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lyric_harness as L
from quality import chance_rate as CR
from quality.near_relation_pricing import canon_records

MAX_LOSS_RATE = 0.005


def admitted(records, decl):
    """Mandated judged pairs standing in at least one admitted coarse
    relation at its own cut. The coarse scalar is what E-5 changes; the
    schema half is counted by check_scheme's violations below."""
    return {(r['idx'], p) for r in records for p in r['mandated']
            if p not in r['refused']
            and L.admits_decl({'relation_totals': r['pairs'][p][0]}, decl)}


def _row(pair):
    totals, score, reading, schemas = pair
    return {'relations': sorted(totals), 'score': score,
            'reading': reading, 'schemas': list(schemas)}


def canon_report(lex, old, new):
    """All canon assertions, evaluated together over the complete corpus."""
    a = canon_records(lex, old)
    b = canon_records(lex, new)
    aa, bb = admitted(a, old), admitted(b, new)
    lost = sorted(aa - bb)
    failures = []
    if not aa or len(lost) / len(aa) > MAX_LOSS_RATE:
        failures.append('scalar admission loss exceeds 0.5%')
    if L.Declaration().coda_empty_evidence != 'cannot_tell':
        failures.append('default has not adopted cannot_tell')
    winner_changes = []
    fixed_candidates = 0
    for x, y in zip(a, b):
        if x['refused'] != y['refused']:
            failures.append(f"refusal drift: sonnet {x['idx']}")
        for p in x['mandated']:
            if set(x['pairs'][p][0]) != set(y['pairs'][p][0]):
                winner_changes.append({'sonnet': x['idx'], 'lines': p,
                                       'gift': _row(x['pairs'][p]), 'cannot_tell': _row(y['pairs'][p])})
            candidates = [L.line_anchors(lex, x['lines'][j-1],
                                        promote=old.final_promotion)[0] for j in p]
            for left in candidates[0]:
                for right in candidates[1]:
                    sa, sb = [L.score(left, right, d) for d in (old, new)]
                    fixed_candidates += 1
                    if sa['relations'] != sb['relations']:
                        failures.append(f"fixed-span relation drift: sonnet {x['idx']} {p}")
    va = sum(len(r['base_violations']) for r in a)
    vb = sum(len(r['base_violations']) for r in b)
    if vb > va:
        failures.append('violations increased')
    controls = {}
    for w1, w2 in [('now', 'why'), ('see', 'free'), ('cat', 'hat')]:
        anchors = [L.line_anchors(lex, w)[0] for w in (w1, w2)]
        scores = [L.best_score(*anchors, d, w1, w2) for d in (old, new)]
        controls[f'{w1}/{w2}'] = [[s['total'], sorted(s['relations'])] for s in scores]
        # now/why (AW~AY) is the empty-coda EVIDENCE control: what it must
        # show is the total falling once absence stops counting. Since the
        # nucleus became a licensed identity (2026-09-22) it stands in no
        # coarse relation, so RHYME membership is asserted on the two true
        # rhymes only.
        if (w1 != 'now' and ('RHYME' not in scores[1]['relations']
                             or scores[1]['total'] != 1.0)):
            failures.append(f'control failed: {w1}/{w2}')
        if w1 == 'now' and not scores[1]['total'] < scores[0]['total']:
            failures.append('empty-coda gift remains')
    return {'max_loss_rate': MAX_LOSS_RATE, 'legacy_admitted': len(aa),
            'adopted_admitted': len(bb), 'lost': [
                {'sonnet': i, 'lines': p, 'text': [a[i-1]['lines'][j-1] for j in p],
                 'gift': _row(a[i-1]['pairs'][p]), 'cannot_tell': _row(b[i-1]['pairs'][p])}
                for i, p in lost],
            'violations': [va, vb], 'controls': controls,
            'fixed_candidates': fixed_candidates, 'winner_changes': winner_changes,
            'failures': failures}


def random_report(lex, old, new, samplers):
    """The unchanged before/after measurement and assertion for each cell."""
    rows, failures = [], []
    for sampler in samplers:
        before, after = [CR.measure(sampler, lex, d) for d in (old, new)]
        rows.append({'sampler': sampler.label(),
                     'gift': {k: before[k] for k in ('judged', 'any', 'admit', 'rhyme', 'schema')},
                     'cannot_tell': {k: after[k] for k in ('judged', 'any', 'admit', 'rhyme', 'schema')}})
        if after['admit'] > before['admit']:
            failures.append(f'random admission increased: {sampler.label()}')
    return {'random': rows, 'failures': failures}


def selected_samplers(part):
    """Validate a fragment coordinate before any expensive work starts."""
    if part == 'all':
        return list(CR.GRID)
    if part == 'canon':
        return []
    match = re.fullmatch(r'random-([1-9][0-9]*)/([1-9][0-9]*)', part)
    if match:
        k, n = map(int, match.groups())
        if 1 <= k <= n <= len(CR.GRID):
            return [sampler for i, sampler in enumerate(CR.GRID)
                    if i % n == k - 1]
    raise ValueError('part wants canon or random-k/n, with 1 <= k <= n '
                     f'<= {len(CR.GRID)}')


def evaluate(part='all'):
    samplers = selected_samplers(part)
    lex = L.Lexicon()
    old = L.Declaration(coda_empty_evidence='gift')
    new = L.Declaration(coda_empty_evidence='cannot_tell')
    report = canon_report(lex, old, new) if part in ('all', 'canon') else {'failures': []}
    random = random_report(lex, old, new, samplers)
    # Preserve the unpartitioned report's field order and shape as well as its
    # values. Fragment reports name their exact work for CI evidence.
    failures = report.pop('failures') + random['failures']
    report.update(random=random['random'], failures=failures)
    if part != 'all':
        report['part'] = part
        report['samplers'] = [sampler.label() for sampler in samplers]
    return report


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    try:
        if not argv:
            part = 'all'
        elif len(argv) == 1 and argv[0].startswith('--part='):
            part = argv[0][len('--part='):]
            if part == 'all':
                raise ValueError('omit --part to run the complete experiment')
        else:
            raise ValueError('usage: e5_coda_adoption.py [--part=canon|random-k/n]')
        selected_samplers(part)
    except ValueError as exc:
        print(f'REFUSED: {exc}', file=sys.stderr)
        return 2
    report = evaluate(part)
    print(json.dumps(report, indent=2))
    return bool(report['failures'])


if __name__ == '__main__':
    sys.exit(main())

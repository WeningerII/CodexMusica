"""Stage 0: draw test requests by seed from the planner's own tables.

Nothing is hand-picked. Every value comes from a table the code reads
(PLAN_FORMS, fillable_line_counts, GENERATOR_ROSTER, ENVELOPE, schemes.NAMED)
or from a seeded draw over a formula's whole space (letter schemes, patterns
of strong and weak positions). The drawn values are the answer key; one fixed
sentence states them as the request.

usage: draw_requests.py OUT.json FIRST_SEED COUNT [CAP_LINES CAP_BEATS]
The two caps bound the cost of an agent writing the song. They are limits of
this test, not of the product, and are recorded in the output.
"""
import os, sys, json, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'lyric-harness'))
from quality import plan as PLN, schemes as SC

OUT, FIRST, COUNT = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
CAP_LINES = int(sys.argv[4]) if len(sys.argv) > 4 else 24
CAP_BEATS = int(sys.argv[5]) if len(sys.argv) > 5 else 16
PLANNER_SEEDS = range(1, 41)          # how many planner seeds the expected outcome is read over


def letters(rng, n):
    """A rhyme scheme of n lines drawn uniformly as a restricted-growth string:
    each line joins an earlier class or opens the next letter."""
    out, used = [], 0
    for _ in range(n):
        k = rng.randint(0, used)
        used = max(used, k + 1)
        out.append('ABCDEFGHIJKLMNOPQRSTUVWXYZ'[k])
    return ''.join(out)


def draw(seed):
    rng = random.Random(f'stage0-request-{seed}')
    form = rng.choice(list(PLN.PLAN_FORMS))
    key = {'form': form}
    stated = {k: rng.random() < 0.5 for k in ('lines', 'sections', 'beats_per_line', 'scheme', 'pattern')}
    if stated['lines']:
        key['lines'] = rng.choice([n for n in PLN.fillable_line_counts(form) if n <= CAP_LINES])
    if stated['sections']:
        fns = rng.sample(sorted(PLN.GENERATOR_ROSTER), rng.randint(1, 2))
        key['sections'] = {fn: rng.randint(1, 3) for fn in fns}
    if stated['beats_per_line']:
        lo, hi = PLN.ENVELOPE['beats_per_line']
        key['beats_per_line'] = rng.randint(lo, min(hi, CAP_BEATS))
    if stated['scheme']:
        fn = rng.choice(sorted(PLN.GENERATOR_ROSTER))
        if rng.random() < 0.5:
            key['scheme'] = {'section': fn, 'named_row': rng.choice(sorted(SC.NAMED))}
        else:
            key['scheme'] = {'section': fn, 'letters': letters(rng, rng.randint(2, 8))}
    if stated['pattern']:
        n = rng.randint(2, CAP_BEATS)
        key['pattern'] = ''.join(rng.choice('SW') for _ in range(n))
    return key


def sentence(key):
    parts = ['Write a song.', f"Form: {key['form']}."]
    if 'lines' in key:
        parts.append(f"Total lines: {key['lines']}.")
    if 'sections' in key:
        parts.append('Sections: ' + ', '.join(f'exactly {k} {fn}' for fn, k in sorted(key['sections'].items())) + '.')
    if 'beats_per_line' in key:
        parts.append(f"Beats per line: {key['beats_per_line']}.")
    if 'scheme' in key:
        s = key['scheme']
        what = f"the scheme the scheme table names {s['named_row']!r}" if 'named_row' in s else f"the letter scheme {s['letters']}"
        parts.append(f"Rhyme scheme for each {s['section']}: {what}.")
    if 'pattern' in key:
        parts.append(f"Stress pattern for every line, S strong and W weak, one syllable to a position: {key['pattern']}.")
    parts.append('Anything not stated above is not asked for: draw it.')
    return ' '.join(parts)


def expected(key):
    """What the planner on this commit does with the part it can be told today."""
    wants = [f'sections.{fn}={k}' for fn, k in sorted(key.get('sections', {}).items())]
    if 'beats_per_line' in key:
        wants.append(f"beats_per_line={key['beats_per_line']}")
    planned, reasons = 0, {}
    for s in PLANNER_SEEDS:
        try:
            PLN.make_plan(seed=s, form=key['form'], lines=key.get('lines'), wants=wants)
            planned += 1
        except Exception as e:
            reasons[type(e).__name__] = str(e)[:240]
    not_declarable = [k for k in ('scheme', 'pattern') if k in key]
    if not_declarable:
        outcome = 'refused, naming what is not supported yet: ' + ', '.join(not_declarable)
    elif planned:
        outcome = 'a finished song at exit 0 whose plan matches the answer key'
    else:
        outcome = 'refused, naming the declaration to change'
    return {'outcome': outcome, 'declarable_today': {'form': key['form'], 'lines': key.get('lines'), 'wants': wants},
            'planner_seeds_tried': len(PLANNER_SEEDS), 'planner_seeds_that_plan': planned,
            'not_declarable_today': not_declarable, 'refusal_sample': reasons}


rows = []
for seed in range(FIRST, FIRST + COUNT):
    key = draw(seed)
    rows.append({'request_seed': seed, 'answer_key': key, 'request': sentence(key), 'expected': expected(key)})
json.dump({'caps': {'lines': CAP_LINES, 'beats': CAP_BEATS}, 'requests': rows}, open(OUT, 'w'), indent=1)
for r in rows:
    e = r['expected']
    print(f"seed {r['request_seed']}: stated {sorted(k for k in r['answer_key'] if k != 'form')} | planner seeds that plan {e['planner_seeds_that_plan']}/{e['planner_seeds_tried']} | not declarable today {e['not_declarable_today']}")

"""Stage 0: over N drawn requests, can the planner honour the part it can be told today?
Read-only. Uses the same draw as draw_requests.py. Planner seeds 1..K per request."""
import os, sys, json, random, collections, multiprocessing as mp, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'lyric-harness'))
N, K = int(sys.argv[2]), int(sys.argv[3])
CAP_LINES, CAP_BEATS = 24, 16


def draw(seed):
    from quality import plan as PLN
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
    return key          # scheme and pattern are not declarable today and do not reach the planner


def one(seed):
    from quality import plan as PLN
    key = draw(seed)
    wants = [f'sections.{fn}={k}' for fn, k in sorted(key.get('sections', {}).items())]
    if 'beats_per_line' in key:
        wants.append(f"beats_per_line={key['beats_per_line']}")
    planned, failed = 0, collections.Counter()
    for s in range(1, K + 1):
        try:
            PLN.make_plan(seed=s, form=key['form'], lines=key.get('lines'), wants=wants)
            planned += 1
        except Exception as e:
            msg = str(e)
            kind = ('no accepted plan in the bounded draws' if 'found no accepted plan' in msg else msg[:90])
            failed[kind] += 1
    return seed, key, planned, dict(failed)


if __name__ == '__main__':
    t0 = time.time()
    with mp.get_context('fork').Pool(4) as pool:
        rows = pool.map(one, range(1, N + 1), chunksize=2)
    json.dump(rows, open(sys.argv[1], 'w'))
    stated = lambda key: tuple(sorted(k for k in key if k != 'form'))
    by = collections.defaultdict(lambda: [0, 0])
    for seed, key, planned, failed in rows:
        b = by[stated(key)]
        b[0] += 1; b[1] += planned > 0
    print(f'requests {N}, planner seeds each {K}, seconds {round(time.time() - t0)}')
    print('requests whose declarable part plans on at least one planner seed:', sum(p > 0 for _, _, p, _ in rows), 'of', N)
    for st in sorted(by):
        print(f'  stated {list(st) or ["form only"]}: {by[st][1]} of {by[st][0]} plan')
    why = collections.Counter()
    for seed, key, planned, failed in rows:
        if not planned:
            for kind in failed:
                why[kind] += 1
    for kind, k in why.most_common(8):
        print(f'  never planned x{k}: {kind}')

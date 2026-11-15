"""Stage 0: the same 200 drawn requests, asked the way a new-song session asks:
one sweep window of W seeds from seed 0, the stated values as the sweep's filter.
A request is 'found' when the window accepts at least one seed. Read-only."""
import sys, json, collections, time, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'lyric-harness'))
sys.path.insert(0, os.path.dirname(__file__))
os.environ['SWEEP_WORKERS'] = '4'
from quality import plan as PLN
import importlib.util
spec = importlib.util.spec_from_file_location('census', os.path.join(os.path.dirname(__file__), 'request_census.py'))
sys.argv = [sys.argv[0], sys.argv[1], sys.argv[2], sys.argv[3]]
census = importlib.util.module_from_spec(spec); spec.loader.exec_module(census)
N, W = int(sys.argv[2]), int(sys.argv[3])
t0 = time.time(); rows = []
for seed in range(1, N + 1):
    key = census.draw(seed)
    wants = [f'sections.{fn}={k}' for fn, k in sorted(key.get('sections', {}).items())]
    if 'beats_per_line' in key:
        wants.append(f"beats_per_line={key['beats_per_line']}")
    try:
        r = PLN.sweep(range(0, W), [PLN.parse_sweep_want(w) for w in wants], form=key['form'], lines=key.get('lines'))
        rows.append((seed, key, len(r['accepted']), r['planned'], r['refused']))
    except Exception as e:
        rows.append((seed, key, 0, 0, str(e)[:120]))
json.dump(rows, open(sys.argv[1], 'w'))
stated = lambda key: tuple(sorted(k for k in key if k != 'form'))
by = collections.defaultdict(lambda: [0, 0])
for seed, key, acc, planned, refused in rows:
    b = by[stated(key)]; b[0] += 1; b[1] += acc > 0
print(f'requests {N}, one sweep window of {W} seeds each, seconds {round(time.time() - t0)}')
errs=[r for r in rows if isinstance(r[4], str)]
print('script errors:', len(errs), errs[:2])
print('requests for which the window accepts at least one seed:', sum(r[2] > 0 for r in rows), 'of', N)
for st in sorted(by):
    print(f'  stated {list(st) or ["form only"]}: {by[st][1]} of {by[st][0]} found')

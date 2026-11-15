"""Stage 0: freeze the drawn cases. Group each by stated arithmetic, write its
expected outcome first, record the versions, and cross it with the two censuses.

usage: freeze_cases.py MANIFEST.json CENSUS_SWEEP.json CENSUS_PLAN.json N
"""
import sys, json, hashlib, subprocess, os, importlib.util
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'lyric-harness')
sys.path.insert(0, ROOT)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT, SWEEP, PLANC, N = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
sys.argv = [sys.argv[0], os.devnull, '0', '0']          # the draw script reads argv on import
spec = importlib.util.spec_from_file_location('draw', os.path.join(HERE, 'draw_requests.py'))
D = importlib.util.module_from_spec(spec); spec.loader.exec_module(D)
from quality import plan as PLN, grid as GR


def fits(key):
    """-> (True, '') or (False, why). Stated arithmetic over the tables only;
    the planner is never asked."""
    want = dict(key.get('sections', {}))
    implied = dict(want)
    for fn in list(want):                                   # a section whose row requires another
        for need in GR.SECTION_FUNCTIONS[fn].requires:
            implied.setdefault(need, 1)
    for need in PLN.FORM_REQUIRES.get(key['form'], ()):     # the form's own required sections
        implied.setdefault(need, 1)
    for fn in PLN.FORM_RECURS.get(key['form'], ()):         # the form's own returning sections
        if want.get(fn) == 1:
            return False, f'the form says {fn} comes back and the request states exactly 1'
        implied[fn] = max(implied.get(fn, 0), 2)
    slots = {}
    for fn, k in implied.items():
        b = GR.SECTION_FUNCTIONS[fn].boundary
        if b:
            slots[b] = slots.get(b, 0) + k
    for b, k in slots.items():
        if k > 1:
            return False, f'{k} sections asked for the one {b} boundary slot'
    if 'lines' in key:
        need = sum(k for fn, k in implied.items() if fn not in PLN.ZERO_LINE_FUNCTIONS)
        if need > key['lines']:
            return False, f'{need} sections each need a line and the request states {key["lines"]} lines'
    return True, ''


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()[:16]


sweep = {r[0]: r for r in json.load(open(SWEEP))}
planc = {r[0]: r for r in json.load(open(PLANC))}
cases = []
for seed in range(1, N + 1):
    key = D.draw(seed)
    ok, why = fits(key)
    unsupported = [k for k in ('scheme', 'pattern') if k in key]
    if not ok:
        group, expected = 'contradicts itself', 'refused, naming the declaration to change: ' + why
    elif unsupported:
        group, expected = 'asks for something not supported yet', 'refused, naming what is not supported yet: ' + ', '.join(unsupported)
    elif len(key) == 1:
        group, expected = 'states only the form', 'a finished song at exit 0; everything but the form shown as drawn'
    else:
        group, expected = 'supported and fits together', 'a finished song at exit 0 whose final plan matches the answer key'
    cases.append({'case': seed, 'group': group, 'expected_outcome': expected, 'answer_key': key,
                  'request': D.sentence(key),
                  'baseline': {'first_sweep_accepts': sweep[seed][2], 'planner_seeds_that_plan_of_3': planc[seed][2]}})
commit = subprocess.run(['git', '-C', ROOT, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
manifest = {
    'frozen': 'stage 0 cases; reuse this file after every stage, never redraw into it',
    'commit': commit, 'caps': {'lines': D.CAP_LINES, 'beats': D.CAP_BEATS},
    'versions': {'draw_script': sha(os.path.join(HERE, 'draw_requests.py')),
                 'this_script': sha(os.path.abspath(__file__)),
                 **{f: sha(os.path.join(ROOT, 'quality', f)) for f in ('plan.py', 'grid.py', 'schemes.py')}},
    'cases': cases}
json.dump(manifest, open(OUT, 'w'), indent=1)
import collections
g = collections.Counter(c['group'] for c in cases)
print('groups:', dict(g))
fit_part = [c for c in cases if c['group'] != 'contradicts itself']
print('fit together (whatever else they ask):', len(fit_part),
      '| first sweep finds a plan for', sum(c['baseline']['first_sweep_accepts'] > 0 for c in fit_part),
      '| planner redraw finds one for', sum(c['baseline']['planner_seeds_that_plan_of_3'] > 0 for c in fit_part))
bad = [c for c in cases if c['group'] == 'contradicts itself']
print('contradict themselves:', len(bad), '| planner still planned', sum(c['baseline']['planner_seeds_that_plan_of_3'] > 0 for c in bad),
      '| first sweep still accepted', sum(c['baseline']['first_sweep_accepts'] > 0 for c in bad))
with_counts = [c for c in fit_part if 'sections' in c['answer_key']]
print('fit together and state a section count:', len(with_counts),
      '| first sweep', sum(c['baseline']['first_sweep_accepts'] > 0 for c in with_counts),
      '| planner redraw', sum(c['baseline']['planner_seeds_that_plan_of_3'] > 0 for c in with_counts))
pick, quota = [], {'supported and fits together': 2, 'asks for something not supported yet': 1, 'contradicts itself': 1, 'states only the form': 1}
for c in cases:
    if quota.get(c['group'], 0) > 0:
        quota[c['group']] -= 1; pick.append(c['case'])
print('five cases for the agent-written runs, in seed order by group quota:', pick)
manifest['agent_run_cases'] = pick
json.dump(manifest, open(OUT, 'w'), indent=1)

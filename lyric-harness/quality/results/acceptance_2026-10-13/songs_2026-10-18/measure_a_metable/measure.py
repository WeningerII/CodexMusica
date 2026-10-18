"""(a): under each default measure, the share of plans whose EVERY line can be met with no
unavoidable density/prominence note. Scratch simulation only: the planner's own draw functions
are wrapped in this process; no repository file changes.

A line of d pulses (Placement.duration) and H group heads (plan.line_pulses_and_heads, held equal
to fit.Placement by test_plan) is METABLE when some syllable count n draws neither SPARSE
(n < d) nor CROWDED, H >= 1 (else any stress exceeds the heads) and H <= n (HEADS_EXCEED_UNITS):
  current grader: CROWDED when ceil(n/d) > 1, so n = d exactly: d must be whole.
  R2's gate:      CROWDED when ceil(n/d) > declared subdivision, so n = ceil(d) works when
                  ceil(ceil(d)/d) <= sub.
usage: python3 measure.py TREE N"""
import sys, math, random
from fractions import Fraction
tree, N = sys.argv[1], int(sys.argv[2])
sys.path.insert(0, tree + '/lyric-harness')
from quality import plan as P

orig_sample, orig_ana = P._sample_meter, P._anacrusis_choices

def log_uniform(rng):
    vals = P.beats_values()
    per_line = rng.choices(vals, weights=[1 / v for v in vals])[0]   # equal weight per doubling
    fact = P.meter_factorisations(per_line)
    bars, sub = fact[rng.randrange(len(fact))]
    beats = per_line // bars
    return bars, sub, beats, P._composition_uniform(beats, rng), (len(vals), len(fact), per_line)

def metable(plan, gate):
    secs = {s['name']: s for s in plan['sections']}
    sub = plan['subdivision']
    for s in plan['line_slots']:
        got = P.line_pulses_and_heads(secs[s['section']], s)
        if got is None:
            return False
        d, h = got
        n = math.ceil(d)
        if h < 1 or h > n:
            return False
        if d.denominator != 1 and not (gate and math.ceil(Fraction(n) / d) <= sub):
            return False
    return True

rows = [('uniform over counts (today)', orig_sample, orig_ana),
        ('log-uniform over counts', log_uniform, orig_ana),
        ('uniform, whole-pulse pickups only', orig_sample, lambda sub: (0.0, 1.0))]
for name, sample, ana in rows:
    P._sample_meter, P._anacrusis_choices = sample, ana
    ok_now = ok_gate = planned = 0; beats = []
    for seed in range(N):
        try:
            p = P.make_plan(seed, form='verse-chorus', lines=16)
        except Exception:
            continue
        planned += 1
        beats.append(p['choices']['meter']['beats_per_line'])
        ok_now += metable(p, False); ok_gate += metable(p, True)
    b = sorted(beats); q = lambda f: b[min(len(b) - 1, int(f * len(b)))]
    print(f"{name:36s} plans {planned:4d}  metable today {100*ok_now/planned:5.1f}%  "
          f"with R2's gate {100*ok_gate/planned:5.1f}%  beats p10/median/p90 {q(.1)}/{q(.5)}/{q(.9)}  "
          f"<=16 beats {100*sum(x<=16 for x in b)/len(b):4.1f}%  >64 {100*sum(x>64 for x in b)/len(b):4.1f}%")
P._sample_meter, P._anacrusis_choices = orig_sample, orig_ana

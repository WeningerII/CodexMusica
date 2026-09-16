#!/usr/bin/env python3
"""Reproduce E-5's declared compatibility experiment; exit nonzero on failure.

Run: python3 quality/e5_coda_adoption.py
Policy: E5_CODA_ADOPTION.md. Historical evidence is explicit, never a default.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lyric_harness as L
from quality import chance_rate as CR
from quality.near_relation_pricing import canon_records

MAX_LOSS_RATE = 0.005


def admitted(records, decl):
    return {(r['idx'], p) for r in records for p in r['mandated']
            if p not in r['refused']
            and L.admits({'relation': r['pairs'][p][0], 'total': r['pairs'][p][1]},
                         L.theta_for({'relation': r['pairs'][p][0]}, decl), decl.admit)}


def main():
    lex = L.Lexicon()
    old = L.Declaration(coda_empty_evidence='gift')
    new = L.Declaration(coda_empty_evidence='cannot_tell')
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
            if x['pairs'][p][0] != y['pairs'][p][0]:
                winner_changes.append({'sonnet': x['idx'], 'lines': p,
                                       'gift': x['pairs'][p], 'cannot_tell': y['pairs'][p]})
            candidates = [L.line_anchors(lex, x['lines'][j-1],
                                        promote=old.final_promotion)[0] for j in p]
            for left in candidates[0]:
                for right in candidates[1]:
                    sa, sb = [L.score(left, right, d) for d in (old, new)]
                    fixed_candidates += 1
                    if sa['relation'] != sb['relation']:
                        failures.append(f"fixed-span relation drift: sonnet {x['idx']} {p}")
    va = sum(len(r['base_violations']) for r in a)
    vb = sum(len(r['base_violations']) for r in b)
    if vb > va:
        failures.append('post-rescue violations increased')
    controls = {}
    for w1, w2 in [('now', 'why'), ('see', 'free'), ('cat', 'hat')]:
        anchors = [L.line_anchors(lex, w)[0] for w in (w1, w2)]
        scores = [L.best_score(*anchors, d, w1, w2) for d in (old, new)]
        controls[f'{w1}/{w2}'] = [[s['total'], s['relation']] for s in scores]
        if scores[1]['relation'] != 'RHYME' or (w1 != 'now' and scores[1]['total'] != 1.0):
            failures.append(f'control failed: {w1}/{w2}')
        if w1 == 'now' and not scores[1]['total'] < scores[0]['total']:
            failures.append('empty-coda gift remains')
    rows = []
    for sampler in CR.GRID:
        before, after = [CR.measure(sampler, lex, d) for d in (old, new)]
        rows.append({'sampler': sampler.label(),
                     'gift': {k: before[k] for k in ('judged', 'admit', 'narrow', 'schema')},
                     'cannot_tell': {k: after[k] for k in ('judged', 'admit', 'narrow', 'schema')}})
        if after['admit'] > before['admit']:
            failures.append(f'random admission increased: {sampler.label()}')
    report = {'max_loss_rate': MAX_LOSS_RATE, 'legacy_admitted': len(aa),
              'adopted_admitted': len(bb), 'lost': [
                  {'sonnet': i, 'lines': p, 'text': [a[i-1]['lines'][j-1] for j in p],
                   'gift': a[i-1]['pairs'][p], 'cannot_tell': b[i-1]['pairs'][p]}
                  for i, p in lost],
              'post_rescue_violations': [va, vb], 'controls': controls,
              'fixed_candidates': fixed_candidates, 'winner_changes': winner_changes,
              'random': rows, 'failures': failures}
    print(json.dumps(report, indent=2))
    return bool(failures)


if __name__ == '__main__':
    sys.exit(main())

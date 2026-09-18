# M-170 item 6 — the 28-line arm completed, both modes, and full-arm equivalence

Measured 2026-09-18 on `c665302838ec`, serially, nothing else heavy on the box.

Reproduce with:

```
python3 scripts/measure_lyric_continuations.py --mode cold --seed 16 --lines 28 \
    --folds 11 --timeout 2400 --out <new dir>
python3 scripts/measure_lyric_continuations.py --mode warm --seed 16 --lines 28 \
    --folds 11 --timeout 2400 --out <new dir>
```

`--timeout 2400` is the deployed `maxTurnMs` from `mcp/gemini_agent.js`, which
this instrument now reads rather than restating. Under the previous hard
ceiling of 600 s **this measurement could not exist**, and the table below is
why: three folds cost more than 600 s.

## What item 6 was missing

The entry recorded that the 28-line COLD arm *"reaches the existing
600-second bound at continuation 2 (exit 124)"*, that *"its later cold
continuations and full-arm equivalence remain unmeasured"*, and that
*"neither a longer budget nor a different seed is silently substituted"*.
Both halves are measured here, under a budget that is declared and sourced.

## Both arms, every fold

| fold | cold wall s | warm wall s | cold / warm |
|---:|--:|--:|--:|
| 0 | 67.1 | 68.2 | 1.0× |
| 1 | 216.4 | 154.1 | 1.4× |
| 2 | 266.0 | 55.1 | 4.8× |
| 3 | 321.1 | 55.4 | 5.8× |
| 4 | 400.7 | 74.4 | 5.4× |
| 5 | 432.1 | 49.5 | 8.7× |
| 6 | 473.1 | 47.5 | 10.0× |
| 7 | 537.7 | 71.2 | 7.6× |
| 8 | 584.1 | 53.7 | 10.9× |
| 9 | 632.2 **>600** | 53.4 | 11.8× |
| 10 | 717.9 **>600** | 85.9 | 8.4× |
| 11 | 762.6 **>600** | 76.9 | 9.9× |
| **total** | **5410.8 (90.2 min)** | **845.2 (14.1 min)** | **6.4×** |

Both arms: `requested 11, completed 11, last_exit 4`. **No timeout in either.**

## Three folds exceed the old ceiling

- cold fold 9: **632.2 s**
- cold fold 10: **717.9 s**
- cold fold 11: **762.6 s**

So the eleven-continuation cold arm cannot complete under a 600 s bound on
any tree. The blocker was the instrument's ceiling, not the workload.

## The cold arm's growth is process cost, not work

Cold rises monotonically, 67.1 -> 762.6 s. Warm stays flat after its first
continuation, 47.5 to 85.9 s, and totals **6.4× less**. The incremental work
per continuation is therefore the warm figure; the cold arm's climb is what a
fresh process re-does each call and a held worker keeps.

## Full-arm equivalence

| comparison | result |
|---|---|
| journals, folds 0-11 | **12 of 12 byte-identical** |
| `draft.txt` | identical |
| `plan.json` | identical |
| stdout differing lines | 146 across 12 folds |
| of those, outside the excluded categories | **0** |

The protocol excludes only temporary paths and the existing memo disclosures
from stdout comparison. Every one of the 146 differing lines is a
`/tmp/finish_bp_*.json` blueprint path, the arm's own `state.json` path, or a
REPLAY/PAIR/SCORE/RANK MEMO line (equivalently `memo_hit`/`memo_asked`), which
differ by design between a fresh process and a held one. Classified
mechanically, not by eye.

## Not claimed

That the 2026-09-17 timeout was wrong. It was measured on `8daf3486` and hit
the wall at fold 2; this runs on `c6653028` and hits it at fold 9. The per-fold
workload differs between the two trees -- `pair.slots` 74 against 128,
`pair.hit` 3,712 against 150 and `score.hit` 827,270 against 389,228 at fold 0
-- so today's arm is cheaper per fold and the wall simply sits further out.
**Which change made it cheaper is NOT isolated here** and is not claimed.

That anything about a deployed instance is measured: this is local, cold
means a fresh process on this host, and M-187 still owns the deployed
engagement. Items 7 and 10 remain unmeasurable from round 10's record.


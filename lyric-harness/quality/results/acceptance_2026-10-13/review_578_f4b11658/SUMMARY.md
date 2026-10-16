# #578 independent measurement (BB8)

## cell 24/20260910

RSS in MiB, median of the ping runs. "ready" = read after the worker answered the ping, i.e. the RSS the next request starts from.

| req | verb | base ready | head ready | Δ | base HWM | head HWM |
|---|---|---|---|---|---|---|
| 1 | plan | 113 | 90 | -23 | 114 | 98 |
| 2 | fill | 115 | 93 | -22 | 118 | 106 |
| 3 | grade | 382 | 362 | -20 | 529 | 529 |
| 4 | revise | 585 | 467 | -117 | 588 | 588 |
| 5 | grade | 520 | 477 | -43 | 588 | 588 |
| 6 | revise | 523 | 480 | -43 | 588 | 588 |
| 7 | grade | 525 | 484 | -41 | 588 | 588 |
| 8 | revise | 523 | 485 | -38 | 588 | 588 |

base whole-sequence peak (ru_maxrss) per run: 587, 588, 594 MiB

head whole-sequence peak (ru_maxrss) per run: 590, 588, 588 MiB

Time the worker stays busy after each reply (ping turnaround), seconds:

- base: p50 0.000, max 0.001 (n=24; this is the ping's own round trip)
- head: p50 0.414, p95 2.049, max 2.109 (n=24)
- head minus base p50 = cleanup cost p50 ≈ 0.414 s
- head per verb (p50): plan 0.025, fill 0.026, grade 0.363, revise 1.266

Output equality (every frame of every request, plus the written defer states):

- ping_base_24_20260910_r2 vs ping_base_24_20260910_r1: normalised requests equal 8/8, states equal True, frame shapes equal True, requests unequal before the finish_bp name is normalised 3 (revise calls: 3)
- ping_base_24_20260910_r3 vs ping_base_24_20260910_r1: normalised requests equal 8/8, states equal True, frame shapes equal True, requests unequal before the finish_bp name is normalised 3 (revise calls: 3)
- ping_head_24_20260910_r1 vs ping_base_24_20260910_r1: normalised requests equal 8/8, states equal True, frame shapes equal True, requests unequal before the finish_bp name is normalised 3 (revise calls: 3)
- ping_head_24_20260910_r2 vs ping_base_24_20260910_r1: normalised requests equal 8/8, states equal True, frame shapes equal True, requests unequal before the finish_bp name is normalised 3 (revise calls: 3)
- ping_head_24_20260910_r3 vs ping_base_24_20260910_r1: normalised requests equal 8/8, states equal True, frame shapes equal True, requests unequal before the finish_bp name is normalised 3 (revise calls: 3)


# Second design: repeated rhyme spacing

The first design failed its frozen real-sonnet power target: 54/122 = 44.3%,
versus 3/488 scrambled twins. Both synthetic seeds detected 100/100 planted
items in each stratum, with family H0 rates 16/1000 and 11/1000. These are
results, not a reason to lower the 50% requirement. The v1 code and result
remain available as `end_statistic="edge_count"` and the original audit file.

This second design is registered before its implementation or evaluation.
The sonnets now constitute **development evidence**, not a held-out validation
population for this revision. This is a new statistic, not a passing rerun of
the first experiment.

## One change

For the end stratum, count affirmed edges separately at each line distance
1 through the declared window (still 4). The statistic is the **maximum count
over those distances**. Apply exactly the same maximum to each shuffled layout.
This tests concentration at a repeated spacing rather than total neighborhood
density. Counts, not ratios, ensure tiny edge sets do not gain a free maximum.
Do not report the maximizing distance as an inferred scheme or musical period.
The internal statistic, exchangeability pools, alpha, permutation count,
inclusive rank, and full two-stratum Bonferroni correction are unchanged.

## Evaluation and acceptance

Re-run the first frozen synthetic populations, independent seeds and sonnet
comparison with precisely the first design's gates. Publish both designs even
if the second fails. Never call the sonnet result held out.

Add independent real-text controls that have not been read for this work:
`corpus/song/eng_celtic_robert_burns.txt` and
`corpus/song/eng_celtic_thomas_moore.txt`, through the normalized calibration
reader. For each source take, in source order, the first 20 items with at least
14 nonempty tokenized lyric lines; use the first 14 such lines. No rhyme score,
title, pronunciation coverage or result determines inclusion. These are
fourteen-line excerpts, not an assertion that the source items are sonnets.
Use the same four role-preserving scrambled twins per item, independently
seeded from 20260918 and 20260919 by source and source item index. Keep all
refusals in the denominator and publish every item identity and coverage.

Require positive real-minus-scrambled end discovery separation **in each
source**, and a one-sided pooled within-item label-randomization p <= 0.01:
under the null, each of the five exchangeable layouts could be the designated
real one. Use 9,999 independent label randomizations, seed 20260920, inclusive
ties and the plus-one rank. This tests real-versus-scrambled discrimination;
it does not estimate an annotated rhyme recall or a general-population power.
The combined 160 scrambled controls must also pass the first design's H0
binomial excess check. Alpha is still per item, not simultaneous over a corpus.

This is a separate author/form replication, not a broad claim about English
song, every source edition, or unseen languages. Internal organization in the
sonnets still has no required positive direction. The old individual-event
control and internal-temporal capability remain open whatever these results.

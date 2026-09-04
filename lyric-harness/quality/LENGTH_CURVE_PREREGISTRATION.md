# Pre-registration: length-conditioned floor thresholds over the WHOLE corpus

**Registered 2026-09-04, before any feature-against-length number outside
the two banked bands was read**, at the owner's order of 2026-09-04 (*"we
need something robust enough to work with the entire spectrum of tokens
... stop all other projects and work on figuring this out now"*). The
instrument is `quality/length_curve_calibration.py`; the results, and the
adoption or the refusal, are `quality/RESULTS_LENGTH_CURVE.md`. This
document fixes the question, the population, the estimator, the selection
rule, the derived limits and the falsifiers. Nothing in `quality/floor.py`
or `quality/plan.py` moves on the strength of this cell alone: adoption is
a second, separate change that reads the results file.

## 0. Why this cell exists, in the owner's terms and in the record's

The lyric-sheet floor grades a text against five human percentiles
(`mattr` low 5th, `fwr` high 95th, anaphora high 95th, `cv` low 5th,
predictability high 95th). Each percentile is a fixed number over a
**band** of token counts, and the band is where the number holds still:
`song` is 200–400 tokens (`RESULTS_SONG_FLOOR.md`), `short` is 50–150
(`RESULTS_SHORT_SONG_FLOOR.md`). Both bands were chosen by one rule —
every 50-token sub-bin's own percentile within a tolerance of the band's —
and the rule REFUSED every wider candidate on a named sub-bin.

Measured 2026-09-04 over every `--- TITLE:` item in `corpus/song/eng_*.txt`
(8,667 items, 1,297 files, corpus at `e8491bf4`), the population the two
bands were cut from spans **4 to 3,245 tokens**, median 154, 5th
percentile 46, 95th percentile 570. The two bands together cover 5,964
items, **69%**. The remaining 31% — 514 items under 50 tokens, 1,314 in
the 150–200 gap, 918 over 400 — reach no exact profile: the gate either
refuses (`UncalibratedLength`) or grades inside a 1.25× tolerance band
with every length-sensitive finding downgraded to a note.

The owner's reading, which this cell adopts as its hypothesis: the gaps
are a property of the measuring stick, not of the songs. The five features
are not length-normalised — `mattr` is a 50-token moving window (doctrine
15), anaphora is a fraction of LINES, predictability a fraction of PAIRS,
`cv` a ratio over line lengths — so their human percentiles DRIFT with
length, and a fixed threshold can only be honest where the drift is small.
The band rule finds where the drift is small. It does not, and cannot, find
the drift's shape. A threshold that is a **function of length** would let
one profile cover the corpus from a two-line air to a 400-line ode, with
the refusal at the ends derived from where the estimator loses resolution
rather than from where a contiguous range happened to stop.

What this cell is NOT: a re-tuning. No threshold is moved by hand. Every
curve is a percentile of the human population conditioned on length, the
selection among candidate shapes is by a rule declared below, and a shape
that fails the rule is refused by name. The `sonnet`, `quatrain` and
`section` profiles (fixed-unit, some with a generated class) are out of
scope: they are calibrated per unit, not per token band, and their
evidence is a separation, not a rate.

## 1. Population, unit, features — all verbatim from the shipped instrument

* Items: `song_profile_calibration.items_in` over `corpus_files()` —
  the `--- TITLE:` items of `corpus/song/eng_*.txt`, empty bodies dropped,
  exactly the population both bands were cut from. No sample; the whole
  corpus. Duplicate texts (the corpus holds e.g. two Epithalamions) are
  kept, as they were for both bands.
* Token count `N`: `QualityFeatures._tokens` per line, summed — the
  count `declaration_for` receives live.
* Features: `population()`'s own row — `mattr` (window read off
  `FloorDeclaration`), `fwr`, `anaphora`, `cv`, `predictability` — the
  same functions, unmodified. `predictability` is computed COLD over the
  whole corpus (no `pred_max_tokens`): the on-disk memo's fingerprint no
  longer matches the shipped comparator (checked 2026-09-04: 5,512 entries,
  stale), so every value is a fresh computation and the run's cost is
  stated in the results. The four cheap checks are stage A; predictability
  is stage B, run in parallel shards that write one memo each, merged
  afterwards under the same fingerprint rule.
* Sides and tails: `CHECKS` verbatim — `mattr` lo 0.05, `fwr` hi 0.95,
  anaphora hi 0.95, `cv` lo 0.05, predictability hi 0.95. A NaN
  predictability (no readable pair) is excluded from every percentile and
  never fires, exactly as `thresholds()`/`fpr()` treat it.

## 2. The length coordinate, and the reference curve

* `x = ln N`. Declared before any curve was fit, for two reasons that are
  not results: the corpus is three orders of magnitude wide, and every
  feature that drifts does so as a fraction of something that grows with N
  (lines, pairs, windows), which is a log-scale phenomenon.
* **Reference (nonparametric) curve.** Sort all items by N. Cut them into
  consecutive bins of **B = 400 items** (the last bin absorbs a remainder
  under 200; a remainder of 200 or more is its own bin). Bin `k` reports
  its item count, its N range, its median N, and each check's percentile
  `q_k` over items with a defined value. B = 400 is declared from
  resolution, not from the data: the 5th percentile of 400 items is the
  20th smallest, and under the held-out split below each bin's held-out
  half carries about 200 items, so a 5% rate is 10 items and the binomial
  95% interval around 5% is roughly 2.2–8.5% — tight enough to detect a
  2× miss (doctrine 72), which `MIN_BIN = 100` could not. The bins are
  fixed on the whole corpus ONCE and reused unchanged for every split.

## 3. Candidate models, one per check

For each check, four candidates, all fit on the same items:

| model | threshold at length N | free parameters |
|---|---|---:|
| C0 | constant `a` (the current design, extended to every length) | 1 |
| C1 | `a + b·x` | 2 |
| C2 | `a + b·x + c·x²` | 3 |
| CK | the reference curve: bin percentiles joined by linear interpolation in `x` between bin median-N knots, flat beyond the end knots | one per bin |

C0–C2 are fit by minimising the **pinball (quantile) loss** at the check's
tail τ over every item with a defined value: `Σ ρ_τ(v_i − f(x_i))`, with
`ρ_τ(u) = τ·u` for `u ≥ 0` and `(τ−1)·u` otherwise. C0's minimiser is the
τ-quantile itself and is taken directly. C1 and C2 are fit by iteratively
reweighted least squares on the smoothed loss (weight `τ/|u|` or
`(1−τ)/|u|`, `|u|` floored at 1e-6, step halved when the loss climbs, stop
when the loss moves under 1e-10 relative or at 200 iterations). The FULL-
CORPUS fit — the one that would ship — runs from two starts, the least-
squares fit through the reference knots and the all-zero vector, and
reports both losses; a check whose two starts disagree by more than 1e-6
relative is REFUSED for that model (the objective is convex, so
disagreement is an optimiser failure, not a finding). The held-out seeds
(§4) run from the knot start alone, for cost. Nothing outside the standard
library is imported: the results must reproduce on a fresh clone.

## 4. The selection rule, declared before any fit

**Held-out protocol.** `author_held_out`'s split, verbatim: 200 seeds, a
50/50 split of FILES (one file per author), fit on the calibration half,
evaluate on the held-out half. For each seed, each candidate, each check,
and each fixed bin `k`: the fraction of the bin's held-out items the
candidate flags (`v < f(x)` for a lo check, `v > f(x)` for hi). Report the
MEDIAN over seeds per bin, and the seeds' 5th–95th.

**A bin PASSES a candidate** when the median held-out flag rate is at or
below the bin's binomial upper bound `U_k` — the 97.5th percentile of
`Binomial(n_k, 0.05)/n_k` at the bin's median held-out count `n_k`.

**A bin is UNDER-RESOLVED for a check** when the check's value is so
discrete at that length that its 95th (or 5th) percentile equals the bin's
maximum (minimum), so nothing can exceed it with `>` (`<`). The held-out
rate is then at or near zero, below the binomial LOWER bound `L_k`. This is
recorded as under-resolved and counts as a pass: a gate that cannot fire
at a length cannot reject a human there, and the cost — no power at that
length — is disclosed per bin rather than hidden by a refusal. A bin whose
median rate is below `L_k` WITHOUT the percentile sitting at the extreme
is also recorded (the curve is conservative there) and also passes; the
rule guards the one direction that harms a human writer.

**The pick.** For each check, the candidate with the FEWEST free parameters
that passes EVERY bin. CK is the fallback: if it alone passes everywhere,
the check ships as a knot table. If CK fails a bin too, the check is
**REFUSED at that bin's N range** and the bins it does pass define the
check's calibrated range; a refusal in the middle of the range is reported
as a hole, exactly as `line_count_gaps` reports one today.

**The derived limits.** The lower limit of the lyric-sheet floor is the
lower edge of the lowest bin at which every shipped check passes (or is
under-resolved); the upper limit is the upper edge of the highest such bin.
Neither is a number anyone types.

**Ties and the union.** The union rate (`ANY`) per bin and overall is
reported for the picked set, beside the same union computed from the two
shipped bands on the bins they cover. The union is not a selection
criterion for a single check; it is the cost a writer pays and is reported
as such (doctrine 22).

## 5. The comparison the results must print, before the verdict

1. The reference curve per check: bin, n, N range, median N, `q_k`. This
   is the drift, exact, over the whole corpus — the number the band rule
   refused to look past 400 for.
2. For each check and candidate: parameters, in-sample loss, the two-start
   agreement, and the per-bin held-out median rate with pass/fail/under-
   resolved marks.
3. The pick per check, its calibrated range, and any holes.
4. On the bins inside 50–150 and 200–400: the shipped band thresholds'
   held-out per-bin rate beside the picked curve's, so the reader sees
   whether the curve costs anything where a band already exists.
5. Union rate per bin and overall.
6. The cost: CPU-seconds per stage, shard count, memo hits/misses.

## 6. Falsifiers, named

* **E1 — a check is not length-normalisable under any candidate.** Some
  check fails a bin under CK too. Recorded per bin; the check's range
  shrinks to the bins it passes, with holes named. Not a reason to withdraw
  the cell: the other checks' curves stand on their own evidence.
* **E2 — the curve costs where the band exists.** On the bins the two
  shipped bands cover, the picked curve's union held-out rate exceeds the
  band's own union by more than **2 points** (the `song` band's union is
  20.22%, `short`'s 16.18%). Then the curve is NOT adopted over the band
  on those bins, and the results say so; it may still be adopted where no
  band exists.
* **E3 — C2 passes where C1 fails, by curvature that reverses sign inside
  the corpus range.** A parabola that turns over inside the data is fitting
  the tails, not the drift. Recorded and disclosed; the rule still picks
  C2 (it is the rule), but the results name the turning point in tokens so
  the adoption step can decline it and ship CK instead.
* **E4 — the optimiser fails** (two-start disagreement > 1e-6): the check
  is refused for that model and CK stands in.
* **E5 — stage B does not finish** (predictability over 8,667 items cold):
  the four-check pick ships as stage A with predictability ABSENT — the
  `short` profile's own precedent — and the results say what stage B's
  shards completed and what they cost so far.

## 7. What adoption would look like, so it is on record before the result

If the picks stand, a follow-up change (not this cell) replaces the two
lyric-sheet `Profile` rows' fixed `percentiles` with per-check threshold
FUNCTIONS of N (coefficients or knot tables read from the results file by
a checked-in loader), makes `declaration_for` return the one lyric-sheet
profile for any N inside the derived limits, and repins
`plan.song_line_counts` to the derived limits divided by the measured
tokens-per-line band. The gate's finding text would then carry the
threshold AT THIS LENGTH beside the length, so a reader can see the number
that was applied. The `tolerance` multiplier loses its job on this profile
(there is no edge to extrapolate past inside the limits) and is measured
again only at the limits. Every one of those is a separate edit with its
own pins, and none is made here.

## 8. What is deliberately not done here

* No reweighting, winsorising or outlier removal: the percentile IS the
  population's statement.
* No feature is redefined to be length-free (e.g. `mattr` with a window
  scaled to N). That would be a different statistic with its own
  calibration, and doctrine 15 forbids grading one statistic against
  another's percentile. The cell measures how the SHIPPED statistics move.
* No generated class. The lyric-sheet profiles have none, and this cell
  inherits their evidence type: a held-out false-positive rate on human
  text (doctrine 22), stated as the weaker claim it is.
* No song written by this project, and no reaction of any person to one,
  is evidence for anything here. The owner ruled on 2026-09-04 that a
  person's reaction to a generated song is opinion and has no place in the
  record; the phrase "the songs a listener preferred" in M-181, M-193 and
  the `short` profile's note is struck under that ruling in a separate
  entry, and this cell's motivation is stated above without it.

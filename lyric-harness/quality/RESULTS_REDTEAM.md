# Results — red-teaming the conjunctive band

`python3 quality/redteam_band.py [n]` · seed 20260810 · regressions in
`quality/test_band.py` and `quality/test_readability.py`.

## Why this run happened

Writing one song surfaced a report line reading `go/receipt 0.579 RHYME`. Two
defects were behind it, and a third was behind them.

## 1. `channel_agreement` aligned from the HEAD

The conjunctive band is the load-bearing rule of this project (doctrines 3, 21,
24, 25). It compared `anc_a[i]` against `anc_b[i]` — flush **left** — while
rhyme aligns flush **right**. It shipped that way from the first commit.

For two anchors of EQUAL length the two computations are identical, and a test
author reaching for an example reaches for `nation`/`station`. It differs the
moment the spans differ in syllable count, which is exactly the mosaic and
multisyllabic reach `line_anchors` exists to produce.

| | |
|---|---|
| candidate anchor-span pairs, 152 sonnets | 4,996 |
| unequal length | 3,386 (**67.8%**) |
| head vs tail alignment DISAGREE | 2,705 (**79.9% of unequal**, 54.1% of all) |

The exposing case: `get to go` against `ceipt` compared `get`(EH,T) with
`ceipt`(IY,T), found the T codas identical and the front vowels close, and
returned `(True, True)` — so a 0.579 pair was typed RHYME. Tail-aligned it is
`(False, False)`, nucleus similarity 0.245.

This is doctrine 83's defect in the SHIPPED comparator rather than in the
taxonomy: there, suffix alignment *was* the function instead of a parameter of
it; here, head alignment was the function, and nobody had written a test whose
two words differ in length. **The sonnet oracle did not move** (73/1014),
because its mandated pairs' best alignment was already the equal-length one.

## 2. `best_score` never says WHICH span won

`line_anchors` returns several candidate spans per line and `best_score` takes
the max. `check_scheme` then prints the score beside `endwords[i]/endwords[j]`.
When the winning span is an interior mosaic reach, the report names a pair that
had nothing to do with the number. Doctrine 45's shape: a checker silently
picking a coordinate and making a claim it never states. **Open.**

## 3. The band's thresholds had never been given a false-positive rate

3,000 random CMUdict word pairs, against a reference line of STRICT IDENTITY of
the tail-aligned nucleus and coda. Identity is *not* ground truth for rhyme —
the graded band exists on purpose — it is a reference that needs no judgement.

At the shipped `theta_nucleus 0.60 / theta_coda 0.60`:

| identity says | harness says RHYME |
|---|---:|
| RHYME | 13 |
| ASSONANCE | 26 |
| CONSONANCE | 60 |
| **NO_RELATION** | **234** |

**320 of 3,000 random pairs (10.67%) admitted as RHYME, against 13 that
identity calls rhyme.** `independents`/`powersoft` passed, because AH~AA scores
0.730 and NTS~FT scores exactly 0.600.

Put beside the true-positive rate, the shipped setting is worse than useless:

| theta_nuc | theta_coda | FPR on random pairs | sonnet violations | separation |
|---:|---:|---:|---:|---:|
| 0.60 | 0.60 | **11.10%** | 7.2% | **−3.9pp** |
| 0.60 | **0.80** | 4.00% | 8.0% | +4.0pp |
| 0.70 | 0.60 | 6.73% | 9.9% | +3.1pp |
| 0.90 | 0.60 | 1.70% | 14.9% | +13.2pp |

**The harness was more likely to call two random dictionary words a rhyme
(11.10%) than to fail one of Shakespeare's mandated pairs (7.2%).**

## Held out, because doctrine 5 requires it

Half the sonnets and half the random pairs, untouched:

| setting | HELD-OUT FPR | HELD-OUT violations | separation |
|---|---:|---:|---:|
| shipped .60/.60 | 11.93% | 6.4% | **−5.5pp** |
| **theta_coda .80** | **4.67%** | 7.0% | **+2.4pp** |
| theta_coda .90 | 3.33% | 7.2% | +3.9pp |
| nuc .70 / coda .80 | 2.60% | 9.8% | +7.2pp |

`theta_coda 0.80` is **SHIPPED**: false positives cut 2.6× for 0.6pp of
true-positive cost, reproducing in both halves in the same direction. Battery
moves 73/1014 (7.2%) → **81/1014 (8.0%)**, exactly as predicted. Red-team FPR
falls 10.67% → **3.57%** (107 of 3,000 at seed 20260810; 3.60% at n=4,000).

> **`3.15%` WAS WRONG AND IS CORRECTED IN PLACE, 2026-08-11.** Every other
> number in this document reproduces exactly — including the pre-calibration
> 10.67% (320 of 3,000) and its 13 / 26 / 60 / 234 breakdown — and **3.15%
> reproduces at no setting.** Re-measured today at this document's own seed and
> the shipped `theta_coda = 0.80`: 107/3,000 = **3.57%**, 144/4,000 = 3.60%,
> 175/5,000 = 3.50%; at `theta_coda` 0.85 / 0.90 / 1.00 it is 3.23% / 2.50% /
> 2.00% at n=3,000. Cell H established the cause and it is worse than drift:
> **3.15% was 63/2,000 put beside a 320/3,000 baseline** — a before-and-after
> quoted across two different sample sizes, in the document arguing that a
> threshold is a rate and not a point. Verified as an error and not as drift by
> re-running the original `redteam_band.py` against the `lyric_harness.py` of
> its own commit (`b1d7f64`), which gives the same answer. The claim the
> sentence makes — false positives cut ~3× — is unaffected.
>
> Confirmed here independently: `python3 quality/redteam_band.py 3000` prints
> `ADMITTED AS RHYME WHERE IDENTITY SAYS OTHERWISE: 107 of 3,000 (3.57%)`.

`theta_nucleus` is **NOT** changed. ~~Tightening it costs 2.7pp of true
positives for 4.4pp of false — a worse trade~~ — and `five`/`of` still passes at
nucleus similarity 0.603 against a 0.600 threshold. That is a coin flip wearing
a verdict and it is now visible rather than hidden.

> **"A WORSE TRADE" IS `WITHDRAWN` 2026-08-11 and replaced by something
> stronger: the trade cannot be computed on this corpus at all.** The
> right-hand column of a nucleus sweep is not a true-positive cost. Of the 31
> mandated pairs a 0.60 → 0.70 tightening newly refuses, the offending syllable
> pairs partition with **no remainder**: 28 are a stressed vowel difference
> (gone/alone, tongue/song, have/grave, blood/good — correct refusals in the
> declared General American dialect, the same sentence this repo already accepts
> for love/prove), 6 are CMUdict writing one reduced vowel two ways
> (graces/faces), 1 is a promoted unstressed final, and there is no fourth
> category. **Not one is a General American slant rhyme.** `theta_coda`
> survived the same test because what IT cost was S~Z and D~RD — the voicing of
> a final obstruent, which English has not changed since 1609. The nucleus is
> where four centuries of sound change live, so on this channel the sonnet
> violation rate prices the `dialect` coordinate, not the threshold.
>
> **AMENDED 2026-08-11 — this sentence is wrong in its larger half.** Cell BA
> (`quality/RESULTS_CODA_SHAPE.md`) measured `D~RD` at **n=4, not n=2**, and
> it is NOT obstruent voicing: it is an R present on one side and absent on
> the other — `herd`/`beard`, `tir'd`/`expired`, `word`/`afford`,
> `err'd`/`transferr'd` — nucleus differing 4 of 4. Counting the same shape
> (`RT~T`, `RTH~TH`, `0~R`, `DZ~RDZ`, `RTS~TS`) the coda channel's mandated
> evidence is **17 RHOTIC observations against 9 obstruent-voicing ones**, so
> the claim that the coda escapes the dialect problem the nucleus has is
> wrong in its larger half. `quality/redteam_band.py` section 9 carries the
> corrected accounting and is the reference now; this paragraph is kept,
> struck by cross-reference rather than by deletion, because the SHIP
> decision it supported (`theta_coda` 0.60 -> 0.80) is unaffected — identity
> beats scalar on both arms in both halves regardless of which observations
> are rhotic versus obstruent (doctrine 17: a check may be kept after its
> premise is falsified, but never quoted as if it were not).
>
> The scalar's SHAPE is uninformative too, measured rather than assumed:
> Spearman between `vowel_sim` and each pair's lift in mandated positions is
> +0.02 at n=3,000 and −0.03 at n=6,000, sign unstable. `IH~IY` scores 0.902 and
> is admitted at lift 0.24; `AY~IY` scores 0.342 and is refused at lift 6.55;
> 17 of the admitted pairs occur LESS often in mandated positions than at
> chance. So the threshold ships as the INCUMBENT and not as the winner, and
> `Declaration.nucleus_agreement` now declares the shape with `identity` and
> `licensed` reachable. **Owed, and it is a corpus and not a number: a
> true-positive corpus in the declared dialect, which this repo does not have.**

## The priced cost, stated rather than buried

`bad`/`bat` is no longer RHYME. The two differ only in the VOICING of the final
stop, D~T agreement is 0.667, and it now types as **ASSONANCE**. Most ears would
accept it as a slant rhyme. That is what 0.6pp of true-positive cost looks like
concretely, and it is survivable only because of doctrine 24: the rule
RELABELS, so the pair stays in the taxonomy under an arguably more accurate
name rather than being deleted. `test_band.py` pins it with that reasoning.

It also re-broke the song this run was written against: `ear`/`screen` at 0.901
is assonance, which it always was, and the loop flagged it. Revised to
`screen clear`; back to 0 violations of 8 mandated pairs.

## What this does not establish

Identity is a reference line, not truth. A band tuned to minimise disagreement
with identity would delete slant rhyme, which is the opposite of the point. The
claim here is narrower and survives that: at 0.60 the coda channel admitted
pairs no reading defends, and the held-out numbers priced the fix.

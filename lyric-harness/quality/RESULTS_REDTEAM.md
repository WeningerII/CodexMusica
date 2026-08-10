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
falls 10.67% → **3.15%**.

`theta_nucleus` is **NOT** changed. Tightening it costs 2.7pp of true positives
for 4.4pp of false — a worse trade — and `five`/`of` still passes at nucleus
similarity 0.603 against a 0.600 threshold. That is a coin flip wearing a
verdict and it is now visible rather than hidden.

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

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
moves 73/1014 (7.2%) → ~~**81/1014 (8.0%)**, exactly as predicted~~. Red-team
FPR falls 10.67% → ~~**3.57%** (107 of 3,000 at seed 20260810; 3.60% at
n=4,000)~~.

> **BOTH RIGHT-HAND FIGURES ARE REPINNED 2026-08-14 — AND BOTH DIED ON
> 2026-08-11, NOT TODAY.** Battery ~~81/1014 (8.0%)~~ → **82/1014 (8.1%)**;
> red-team FPR ~~3.57% (107 of 3,000)~~ → **2.00% (60 of 3,000)** and
> ~~3.60% (144 of 4,000)~~ → **2.10% (84 of 4,000)**, both at this document's
> own seed 20260810. The superseded pair is kept above rather than overwritten
> (doctrine 17), and here that is load-bearing twice over:
> `quality/test_mut_oracle.py` cites this document's `81/1014` prediction BY
> NAME, so deleting the figure would break a live cross-reference as well as
> the record.
>
> **SAY WHAT EACH IS A COORDINATE OF (doctrine 58).** Every struck figure is
> `coda_agreement="scalar"` at `theta_coda 0.80`; every figure replacing it is
> `coda_agreement="identity"`, which is a PREDICATE and not a magnitude — so
> `theta_coda` is INERT under it and no sweep of that threshold reaches these
> numbers from those. `n` is the other coordinate and it is the one this
> document kept dropping: `quality/redteam_band.py` **defaults to n=4,000**
> (`redteam_band.py:634`), so the bare command prints the 4,000 row and never
> the 3,000 one, and a rate written without its population size cannot be
> reproduced from the command written beside it (doctrine 91).
>
> **THE SUPERSESSION WAS ALREADY ON RECORD AND THIS FILE WAS NEVER TOLD.**
> Commit **`1c723cf`, 2026-08-11 16:41:41 +0000**, *"Cell BA: the coda channel
> manufactured rhymes, and R~L is the argmax of the whole matrix"*, changed
> `Declaration.coda_agreement` to `identity` and states both moves in its own
> message: *"REDTEAM FPR: 3.60% (144/4000) -> 2.10% (84/4000)"* and
> *"C shipped 1064/1014/50/82 (+1)"* — the +1 being sonnet 91's `costs` against
> `boast`, RHYME → ASSONANCE, which had been passing on a coda margin of
> EXACTLY ZERO. `quality/RESULTS_CODA_SHAPE.md:299`/`:308` has carried the FPR
> pair since that day. So this is not a new measurement; it is a sibling
> document that was updated and a sibling that was not.
>
> **AND IT IS SHARPER THAN "NOBODY LOOKED".** `1c723cf`'s own message NAMES
> this file as still carrying a stale claim, and the follow-up sweep
> **`bec7bd2`, 2026-08-11 17:43:53 +0000** — *"fifteen files, and two real
> defects were hiding behind stale pins"* — did open this document and did edit
> it, inserting the `AMENDED 2026-08-11` paragraph forty lines below, and
> walked past these figures to get there. The sweep repaired the sentence it
> had been handed and re-read nothing around it.
>
> **THE ARGUMENT IS UNCHANGED AND THE DIRECTION IS ENLARGED, NOT REVERSED.**
> The SHIP decision this section reaches is unaffected: false positives now
> fall 10.67% → 2.00% at n=3,000 where the struck sentence claimed → 3.57%.
> The held-out table above is the SCALAR comparator's and has NOT been re-run
> under `identity`; the fit/held pair that has is section 9 of the same run,
> which reads scalar 0.80 **3.47% / 3.67%** → identity **1.93% / 2.07%** at
> n=3,000 — better in both halves, the same direction, which is the property
> the decision rested on. The 10.67% baseline (320 of 3,000, broken 13 / 26 /
> 60 / 234) is comparator-invariant and still reproduces exactly, which is the
> check that this is the same statistic and not a different one.

> **`3.15%` WAS WRONG AND IS CORRECTED IN PLACE, 2026-08-11.** Every other
> number in this document reproduces exactly — including the pre-calibration
> 10.67% (320 of 3,000) and its 13 / 26 / 60 / 234 breakdown — and **3.15%
> reproduces at no setting.** Re-measured **2026-08-11** at this document's own
> seed and the then-shipped `theta_coda = 0.80`: 107/3,000 = **3.57%**,
> 144/4,000 = 3.60%,
> 175/5,000 = 3.50%; at `theta_coda` 0.85 / 0.90 / 1.00 it is 3.23% / 2.50% /
> 2.00% at n=3,000. Cell H established the cause and it is worse than drift:
> **3.15% was 63/2,000 put beside a 320/3,000 baseline** — a before-and-after
> quoted across two different sample sizes, in the document arguing that a
> threshold is a rate and not a point. Verified as an error and not as drift by
> re-running the original `redteam_band.py` against the `lyric_harness.py` of
> its own commit (`b1d7f64`), which gives the same answer. The claim the
> sentence makes — false positives cut ~3× — is unaffected.
>
> **EVERY FIGURE IN THIS CORRECTION IS THE PRE-`1c723cf` COMPARATOR'S**, added
> 2026-08-11 and superseded by `coda_agreement="identity"` some five hours
> later the same day (see the repin above). They are kept unstruck because the
> claim they carry is about `3.15%` and not about the band: `3.15%` reproduces
> at no setting of the comparator that was shipped when it was written, and
> a comparator change afterwards cannot make it reproduce retroactively.

> **THE VERBATIM EXPECTED-OUTPUT BLOCK THAT SAT HERE IS GONE, 2026-08-14, AND
> IT IS NOT REPLACED BY UPDATED DIGITS.** It read: *"Confirmed here
> independently: `python3 quality/redteam_band.py 3000` prints `ADMITTED AS
> RHYME WHERE IDENTITY SAYS OTHERWISE: 107 of 3,000 (3.57%)`."* That command
> has not printed that line since 2026-08-11.
>
> **RUN IT — DO NOT READ A NUMBER HERE.** `python3 quality/redteam_band.py
> 3000` prints one line opening `ADMITTED AS RHYME WHERE IDENTITY SAYS
> OTHERWISE:`; with no argument the same runner prints that line at its own
> default n=4,000. WHAT IT HAS PRINTED, RECORDED AS HISTORY AND NOT AS AN
> EXPECTATION: `107 of 3,000 (3.57%)` on 2026-08-11 under
> `coda_agreement="scalar"`; `60 of 3,000 (2.00%)` on 2026-08-14 under the
> shipped `identity`.
>
> **WHY THE BLOCK IS RETIRED RATHER THAN REPINNED.** A block quoting a command
> AND its output makes two claims, and only the first is a property of this
> document — what the command PRINTS is a coordinate of the COMPARATOR, so it
> goes stale the moment the comparator moves, silently, because nothing
> re-runs the command. This exact block has now failed that way TWICE, once as
> `3.15%` and once as `3.57%`, which is the evidence that retyping the digits
> would only re-arm it for the next `Declaration` change; and it is the worst
> shape to fail in, because it invites a reader to check and then contradicts
> what their own run says. Deleting it outright is the other error — that
> removes the reader's ability to check anything. What CANNOT go stale is an
> instrument, and one already exists and is not this file:
> `quality/counters.py`'s `band_fpr()` re-derives this runner at BOTH n on
> every `--write` and ASSERTS them on every `--check`, and `BACKLOG.md`'s
> counter table carries the live machine-written cell. This paragraph points
> there and asserts no current value of its own — doctrine 17 applied to an
> output block rather than to a sentence.

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

# Null audit — every recorded rate, against a matched null

An adversarial re-run of the quantitative claims in `POSITIVE_CONTROL.md`,
`RESULTS.md`, `RESULTS_BAND.md`, `RESULTS_FWER.md`, `RESULTS_MATRIX.md`,
`RESULTS_TIME.md` and `RESULTS_WITHIN_ITEM.md`, under doctrines **56** (a
search needs a null under the same search), **61** (lift, not yield), **19**
(a swept argmax is biased), **57** (an empirical p at 1/(n+1) reports the
resolution) and **58** (a bare n-of-N is a coordinate of some setting) — all
of which were written down *after* every number in those files was recorded.

Every claim was asked three questions: was there a matched null; was any
number chosen among variants; does the recorded number carry the setting that
produced it. Where a claim could be re-executed, it was, and the randomisation
is declared per claim with what it preserves and what it destroys.

Scripts: `quality/audit_band_control.py`, `audit_fwer_fpr.py`,
`audit_joint_auc_null.py`, `audit_time_pooled_null.py`, `audit_kalevala_null.py`,
`audit_tang_null.py`, `audit_hafez_radif.py`. Nothing in the audited documents
was edited.

---

## 1. OVERTURNED

### 1.1 `RESULTS_BAND.md` P4 — "the negative control tightens"

**The claim.** "P4 — the negative control tightens: **CONFIRMED** — Whitman
26.0% → **20.0%**", called "the real test", and named as the reason the band
ships where the fitted matrix does not (`CLAUDE.md`, test discipline;
`RESULTS_MATRIX.md` P5 carries the same column at 18.0% / 21.3% / 26.0%).

**Question 1 — was there a matched null?** No. Four bare rates on one corpus,
compared to each other. `infer_chains` is a **line-final, sequential**
relation: a line joins the open chain by matching one of the last two members.
A within-line word shuffle changes nothing at the line end and is the wrong
null. What the statistic reads is the multiset of end words and their **order**.

**The randomisation.** Permute whole lines within the item.
*Preserves* every line verbatim — every end word, every anchor, every OOV, the
line count, theta, the band setting, the comparator and the exact chain
algorithm. *Destroys* the order of the lines, which is the entire rhyme
structure. It is the same 150 lines, rearranged.

The same null is then applied to the **sonnets** under the **same statistic**
(share of lines captured in chains), because `RESULTS_BAND.md` compares a
Whitman *chain-capture* rate against a sonnet *mandated-pair violation* rate —
two different statistics on two different corpora, which is not a comparison.

```
Whitman, 150 free-verse lines, theta_chain = 0.82
  band OFF   R_obs 26.0%   null N=200: median 19.3%, min 8.7%, max 27.3%
             excess over null MAX  -1.3 pp     p = 0.0547   (floor 0.0050)
  band ON    R_obs 20.0%   null N=200: median 16.7%, min 6.7%, max 27.3%
             excess over null MAX  -7.3 pp     p = 0.2090   (floor 0.0050)

  theta 0.85 (RESULTS_MATRIX P5's "matched FPR" row)
  band OFF   R_obs 18.7%   null: median 14.0%, min 4.0%, max 26.0%   p = 0.134
  band ON    R_obs 18.0%   null: median 12.7%, min 4.0%, max 22.7%   p = 0.090

Sonnets, 60 items x 14 lines, SAME statistic, SAME null
  band OFF   R_obs 53.5%   null N=200: median 29.9%, min 25.5%, max 35.6%
             excess over null MAX +17.9 pp     p = 0.0050  <- AT THE FLOOR
  band ON    R_obs 52.0%   null N=200: median 28.6%, min 23.1%, max 34.2%
             excess over null MAX +17.9 pp     p = 0.0050  <- AT THE FLOOR
```

**What this overturns.**

1. **Whitman's chain-capture rate is not above its own null at any recorded
   setting.** 26.0% sits inside a null whose maximum is 27.3% (p = 0.055);
   20.0% sits well inside it (p = 0.209). All four figures the two documents
   quote — 18.0, 20.0, 21.3, 26.0 — lie **inside a single null's range**
   (6.7%–27.3%). Differences between them are differences between points in
   one noise band.
2. **The 6-point "tightening" is mostly a shift in the instrument's chance
   level.** The null median moves 19.3% → 16.7% when the band goes on. The
   band lowers what the instrument reports on *rearranged* Whitman almost as
   much as on real Whitman.
3. **The band's effect on separation is zero.** On the one statistic applied to
   both corpora against the same null, the excess over the null goes
   **+23.6 pp → +23.5 pp** on the sonnets and **+6.7 pp → +3.3 pp** on Whitman.
   Net change in discrimination: **−0.1 pp**.

   *Stated at its most favourable to the band:* Whitman's excess did move in
   the right direction, +6.7 → +3.3 pp. But it moved from a baseline that is
   itself only p = 0.055, so the quantity that improved was never shown to be
   non-zero, and the improvement is not resolvable at N = 200. That is a
   different sentence from "the negative control tightens", and it is not the
   sentence a shipping decision was made on.

This is doctrine 56 in the place doctrine 56 says it keeps happening: the
comparator did not get the advantage the hypothesis got, because there was no
comparator. It is also the `infer_chains` band-fairness bug one level up — that
fix made the *two comparators* comparable; it never asked whether the number
either of them produced was above chance.

**What is NOT overturned.** P1, P2, P3 and P5 of `RESULTS_BAND.md` stand: the
typing of `sun`/`much` as ASSONANCE, the vocabulary growing from three names to
five, the sonnet residue decomposing, and the both-empty-coda tripwire (251 of
986 pairs) not firing. The band's justification under doctrines 3, 21 and 24 is
a *taxonomy* argument and is untouched. What falls is P4 **as evidence**, and
with it the sentence "the negative control tightens, which is why it ships and
the fitted matrix does not". That reason is not supported by a matched
comparison; the other four reasons are.

### 1.2 `RESULTS_FWER.md` P2 — the false-event rate, and the event set itself

**The claim.** "P2 — false-event rate controlled at α: **CONFIRMED** —
measured 5.4% against α 5.0%", "the within-item null delivers the rate it
advertises", carried into `CLAUDE.md` doctrine 4 as a property of the layer.
The same document's P1 table gives the rate on **real** text at the same
parameters: sonnet 1 8%, sonnet 2 11%, lyric sheet 8%.

**Question 3 first — does the number carry its setting?** The 5.4% **is
reproducible**, and I reproduce it exactly: at seed 7, sonnets 1–6 scramble to
5.2 / 11.7 / 9.7 / 3.0 / 1.5 / 1.4 %, mean over six = **5.4%**. The table in
`RESULTS_FWER.md` prints those six values as three rows of three, which is why
reading the visible rows gives 8.8%. The number is right; the presentation
makes it uncheckable. And `quality/test_fwer.py`, the regression that is
supposed to hold it, runs **three** sonnets and asserts only `mean < 0.20`.

It is also an **n = 6** figure. At n = 20 sonnets the identical construction
gives **9.6%**, roughly twice the declared α.

**Question 1 — was there a matched null?** The scramble *is* a null, but it was
compared against α, never against the **real** rate produced by the same
instrument. That is the comparison that decides whether the layer's events mean
anything.

**The randomisations.** The events are line-internal syllable-span matches
inside a 32-syllable window, so a within-*line* shuffle is too weak — it leaves
every cross-line pair intact. Two nulls, bracketing the choice:

* **NULL S — whole-item word scramble** (the document's own).
  *Preserves* the item's word multiset, phonology, lexicon, OOV rate and
  syllable count. *Destroys* all word order **and** the line lengths, since the
  text is re-chunked into 14 equal lines.
* **NULL L — line permutation.** *Preserves* every line verbatim, hence line
  lengths, the within-line stress layout and every within-line span pair.
  *Destroys* only which lines fall inside a 32-syllable window together.
  Strictly less destructive than S; a real effect must clear both.

```
theta 0.80, window 32, Sidak — the ORIGINAL registered parameters of the
P1/P2 tables. 20 sonnets; the arm mean is the replicated quantity.

REAL sonnets   mean event rate 10.9%,  median 10.4%
               (RESULTS_FWER P4 records median saturation 10.4% — exact match)

NULL S   R_obs 10.9%   null N=20 arms: median 9.6%, min 7.8%, max 11.0%
         excess over null MAX  -0.2 pp    p = 0.0952   (floor 0.0476)
NULL L   R_obs 10.9%   null N=20 arms: median 10.8%, min 7.6%, max 12.6%
         excess over null MAX  -1.8 pp    p = 0.4762   (floor 0.0476)
```

**What this overturns.**

1. **The false-event rate is not at α.** Measured over 20 sonnets it is
   **9.6%** (arm-mean range 7.8–11.0%) against a declared **5.0%**. The 5.4%
   is a coordinate of n = 6 and seed 7 and does not survive more data.
2. **The layer's event set is not above a structure-destroyed control.** Real
   sonnets flag 10.9% of slots; the same sonnets word-scrambled flag 9.6% and
   line-permuted flag 10.8%. The excess over the null maximum is negative under
   both nulls. The events every downstream placement statistic is computed on
   occur at the rate the null produces.

**Two readings of (2), and the audit cannot separate them.** Either the event
detector is firing at chance, or Shakespeare's sonnets genuinely carry no more
*internal* rhyme than a scramble of themselves — which is what H1 predicted for
the sonnet arm in the first place. Nothing here distinguishes them, and I am
not claiming the detector is broken.

**The consequence is the same under both readings**, and it is the one that
matters: a null placement result computed on this event set cannot separate
"no periodic organisation of real internal rhyme" from "no real internal rhyme
to organise". This is doctrine 20 and doctrine 30 arriving one level lower than
they were first found. The FWER correction genuinely fixed the *multiplicity* —
saturation really did fall from 90–93% to 6–16% — but "6–16% saturation" is a
chance rate, so "the layer is measurable for the first time, and it still finds
nothing" is still not a powered null. What needs measuring next is not the
correction but whether the events are events.

Claim (1), the false-event rate, is overturned independently of any of this.

### 1.3 `RESULTS_WITHIN_ITEM.md` P2 — "FAILED. 0.659 → 0.604."

**The claim.** "P2 — Exp 1 AUC must hold or improve on 0.659. **FAILED.**
0.659 → 0.604. It fell." Also the headline table, and `RESULTS.md`'s
"0.971 against 0.709 … is the whole argument in two numbers".

**Question 3.** Every *per-feature* number in these documents carries a
permutation p and a BH-FDR verdict. The **joint held-out AUCs** — the numbers
the headline, doctrine 7 and both pre-registered predictions are stated in —
carry neither. They are also single draws from one cross-validation split:
`discriminate.joint_classifier` hard-codes
`StratifiedKFold(shuffle=True, random_state=SEED)`. At n = 15 in the minority
class, one seed is not a measurement.

**The randomisation.** Permute the labels within the experiment.
*Preserves* every feature value, the class sizes, the missing-value pattern,
the imputer, scaler, logistic regression and its C, the fold count and the
seed — observed and null come out of the identical pipeline. *Destroys* which
item carries which label. This is the only null that leaves a 10-parameter fit
on 132 items intact inside the null, which matters because a CV AUC on a small
minority class is **not** centred on 0.500.

```
Exp 1  survived (15) vs forgotten (117)
  ABSOLUTE, 10 features
    R_obs 0.659  (RECORDED 0.659 — reproduced exactly)
    null: N=200 label permutations, median 0.488, min 0.205, max 0.751
    excess over null MAX  -0.092      p = 0.0398   (floor 0.0050)
    TRUE labels over 200 CV seeds: median 0.603, IQR 0.583-0.622, range 0.529-0.674
  WITHIN-ITEM, 8 features
    R_obs 0.604  (RECORDED 0.604 — reproduced exactly)
    null: N=200 label permutations, median 0.466, min 0.156, max 0.750
    excess over null MAX  -0.146      p = 0.1294   (floor 0.0050)
    TRUE labels over 200 CV seeds: median 0.606, IQR 0.582-0.627, range 0.489-0.680

Exp 2  human (152) vs generated (40)
  ABSOLUTE     R_obs 0.975   null median 0.513, max 0.658
               excess over null MAX +0.317   p = 0.0050  <- AT THE FLOOR
               200 CV seeds: median 0.979, range 0.969-0.984
  WITHIN-ITEM  R_obs 0.877   null median 0.509, max 0.658
               excess over null MAX +0.219   p = 0.0050  <- AT THE FLOOR
               200 CV seeds: median 0.895, range 0.855-0.915
```

**What this overturns.** The **P2 verdict**. The recorded 0.659 is an
85th-percentile seed draw; the recorded 0.604 is a 49th-percentile draw. At the
**median seed** the comparison is **0.603 vs 0.606** — P2's "must hold or
improve" *holds*. The drop the document scores as a failed pre-registered
prediction is the cross-validation seed, not the respecification.

**What this strengthens.** `RESULTS_WITHIN_ITEM.md`'s actual conclusion —
"the quality layer has no demonstrated cross-design signal" — comes out
*stronger*, because neither Exp 1 figure beats its own label-permutation null's
maximum, and the within-item one is not separated from the null at all
(p = 0.13). The document's own caution, "0.604 at n=15 does not come close to
excluding chance", is now measured rather than asserted. P1 (0.975 → 0.877)
survives: the seed ranges do not overlap.

### 1.4 `POSITIVE_CONTROL.md` Part A — the pooled Fisher p is not on a uniform scale

**The claim.** "stress k=23 items, median p=0.701, X²=31.4 on 46 df → p = 0.950
/ syllable k=26, median p=0.554 → p = 0.617", read as "the predicted null
holding under a test that pools 23–26 items". `CLAUDE.md` doctrine 4 cites
"Fisher p=0.950, k=23" as the sonnet arm's pooled-power null.

Fisher's method requires the combined p-values to be **U(0,1)** under H0.

**The randomisation.** The claim is positional, so the null preserves the
**count** of events and randomises only their **positions** — which is exactly
`analyse()`'s own permutation null. Under H0 the observed event set *is* a draw
from that null, so feeding the instrument such a draw measures the instrument.
*Preserves* the number of events, the slots, the sweep (2,3,4,6,8), the
max-over-sweep, the tie-inclusive `>=` comparison and n_perm. *Destroys*
nothing that exists: **H0 is true in every replicate.**

```
200 replicates of a 23-item arm, 5-8 events over 60-75 slots, n_perm=400

per-item p under H0 (n=4600)   mean 0.526, median 0.559   (uniform: 0.500)
                               share <= 0.05: 0.043       (uniform: 0.050)
median p of a 23-item H0 arm   median 0.559, range 0.224-0.771
                               share of H0 arms with median >= 0.701: 0.050
pooled Fisher p under H0       median 0.676, quartiles 0.369 / 0.857
                               share >= 0.950: 0.085   (calibrated: 0.050)
                               share >= 0.617: 0.535   (calibrated: 0.383)
items significant at .05       median 1/23             (RECORDED: 1/23, 1/26)
```

**What this overturns.** Not the null result — the *reading* of the pooled
numbers.

* **p = 0.950 is roughly a 1-in-12 output of this instrument under H0, not a
  1-in-20 tail.** It cannot be quoted as though it were.
* **p = 0.617 is on the LOW side of the H0 median (0.676).** The syllable arm
  is, if anything, marginally *less* null than H0.
* The α control itself is fine (share ≤ 0.05 = 0.043 against a declared 0.05,
  at the real item sizes) — this reproduces `positive_control.py`'s floor arm.
  It is the **pooling** that is miscalibrated, because per-item p is discrete
  at 5–8 events and the permutation p counts ties as hits.
* The recorded median p = 0.701 sits at the **95th percentile** of the H0 median
  distribution. The observed event sets are more evenly spread across phases
  than independent uniform draws. That is a **mismatch between the observed
  event process and the null**: rhyme events arrive in pairs inside a bounded
  window, while `analyse()` draws independent uniform positions. The null
  destroys the pairing, which is not the constraint under test.

The repo contains its own demonstration of this and does not read it that way.
`run_positive_control.py` **arm C2** is an empirical H0 arm through the same
instrument — same rhyming events, positions randomised — and it returns
**median p = 0.584, Fisher p = 1**. Arm B (median p = 0.529, Fisher p = 0.883)
is therefore *less* null than the instrument's own H0 arm, not equally null.
"Fisher p = 0.883 replicates the English null" is comparing 0.883 against 0.5
when the instrument's H0 output is ≥ 0.883.

---

## 2. SURVIVES A MATCHED NULL, AND IS STRONGER FOR IT

### 2.1 Cynghanedd — doctrines 56 and 57 reproduce exactly

`quality/cynghanedd_rate.py`, 200 within-line shuffles. Verified first that the
null gets the *same search width*: `cynghanedd_scan` derives k from the token
count alone and `shuffled()` uses the same tokenizer, so observed and shuffled
lines are tried at identical k. That is the join where doctrine 56 would have
broken.

```
Gwaith Alun, 1558 lines
  caesura='search'  R_obs 54.1%  null median 24.6%, min 21.4%, max 27.8%
                    excess over null MAX +26.3 pp   p = 0.005  <- AT THE FLOOR
  caesura='marked'  R_obs  8.2%  null median  6.0%, min  4.8%, max  7.6%
                    excess over null MAX  +0.6 pp   p = 0.005  <- AT THE FLOOR
Twm o'r Nant, 156 lines
  caesura='search'  R_obs 51.3%  null median 26.9%, min 18.6%, max 36.5%
                    excess over null MAX +14.7 pp   p = 0.005  <- AT THE FLOOR
  caesura='marked'  R_obs  3.2%  null median  5.1%, min  2.6%, max  9.6%
                    excess over null MAX  -6.4 pp   p = 0.975  BELOW chance
```

All four match `CLAUDE.md` doctrines 56 and 57 to the decimal, including the
two results that both print p = 0.005 while beating the null max by 26.3 and
0.6 points respectively. **One addition:** in `caesura='marked'` mode on Alun,
**104 of the 127 hits are llusg**, and `llusg()` does not use the caesura at
all — it is a whole-line predicate. So the marked-mode +0.6 pp is very largely
not a caesura measurement, which is a second reason not to read it.

### 2.2 Kalevala 81.2% alliteration — and the obvious null is a no-op

`data/sources.tsv` and `POSITIVE_CONTROL.md` Part E record "81.2% alliterate"
as a bare rate. **The audit brief's default null for a line-internal relation
would have manufactured a perfect null here:** "two or more words in this line
share an initial class" is *invariant* under any permutation of the line's
words. Measured: a within-line shuffle agrees with the observation on
**22,795 / 22,795 lines**. A cell reaching for the obvious null would have
reported p = 1.0 and concluded the Kalevala does not alliterate.

The statistic reads **co-membership**, not arrangement, so the null must
destroy co-membership and nothing else.

* **NULL A — global redeal.** *Preserves* the corpus's exact token multiset,
  hence the exact marginal distribution of initial classes, the line-length
  distribution and the line count. *Destroys* which words share a line.
* **NULL B — column permutation within line-length strata.** Additionally
  *preserves* the positional distribution of initials and the
  length-conditional word inventory. Destroys strictly less than A.

```
first 4000 lines (the recorded window), 22,796 verse lines extracted
  R_obs 81.3%   NULL A  N=200: median 30.1%, min 28.7%, max 33.1%
                excess over MEDIAN +51.2 pp, over MAX +48.3 pp
                p = 0.0050  <- AT THE FLOOR
                NULL B  N=200: median 30.4%, max 32.0%   over MAX +49.3 pp
all 22,795 verse lines
  R_obs 82.6%   NULL A  median 30.0%, max 30.8%   over MAX +51.8 pp  p at floor
                NULL B  median 30.2%, max 31.0%   over MAX +51.6 pp  p at floor
```

The constraint is real and enormous. **But roughly 30 of the 81 points are
chance** — a third of the recorded headline is the null, so "81.2% alliterate"
was never a usable number even though it was never a wrong one.

*Independently reached by a sibling cell mid-audit* (commit `5094bf2`, which
also fixed three `fin.py` defects). My observed rate moved 81.1% → 81.3% under
me when that landed, which is itself worth recording: the rate is a coordinate
of the `fin.py` revision and it moved twice in one afternoon. The lift did not.
My extraction gives **22,796** verse lines from the raw GITenberg file and
**22,795** from `corpus/fin_kalevala.txt`, against the recorded **22,822**.
The rates agree to the decimal on all three.

### 2.3 律詩 88.1% at the mandated positions

Line-final relation, so a within-line shuffle is the wrong null. Three
comparators, each destroying a different thing:

* **N1 — cross-poem permutation of the four rhyme-position characters.**
  *Preserves* the corpus's exact multiset of rhyme-position characters, hence
  the rime table's frequency distribution, its polyphony and its coverage, the
  poem count, the predicate and the 同用 grouping. *Destroys* which characters
  one poet put in one poem.
* **N2 — within-poem reselection: any 4 of the poem's 8 line-finals.**
  *Preserves* the poem and its whole line-final inventory. *Destroys* only
  which positions are read as the rhyme. This is the 88.1%'s version of the C1
  tripwire, which Part D applied only to the *p-value*.
* **N3 — the form's own non-rhyming positions**, lines 1/3/5/7. Fixed, no
  Monte Carlo error.

```
300 poems of 8 uniform lines of 5 or 7 characters
character coverage by the rime table 12780/12864 = 99.3%   (RECORDED 99.3%)

R_obs 88.0%  (264/300; RECORDED 253 poems / 88.1% and 300 poems / 264 = 88.0%)
  N1  null N=200: median 0.0%, min 0.0%, max 0.7%   over MAX +87.3 pp  p at floor
  N2  null N=200: median 2.7%, min 0.7%, max 4.7%   over MAX +83.3 pp  p at floor
  N3  lines 1/3/5/7: 0.0%                            difference +88.0 pp
pairwise chance agreement between two random rhyme-position characters: 5.4%
```

Survives overwhelmingly, and the C1 concern does **not** transfer to the rate:
the mandated positions are special, not merely periodic. Part D's arms
reproduce exactly (A 264/36/sat 10.0%/Fisher 0; B 300/0/50.0%/0.529/18/0.883;
C1 300/300/Fisher 0; C2 median p 0.584/Fisher 1).

### 2.4 Hafez radif, 297 of 495

Line-final repetend, so again not a within-line shuffle.

* **NULL H — hemistichs permuted across ghazals.** *Preserves* the exact
  hemistich multiset, every final token, the token frequency distribution, the
  ghazal count and each ghazal's length. *Destroys* which hemistichs belong to
  one poem.
* **NULL F — final tokens permuted across the corpus.** Destroys strictly less:
  each poem's body, line count and order survive.

```
495 ghazals, 8384 hemistichs
sweep, written next to the number as doctrine 58 requires:
  min_fraction 0.50 311 | 0.60 311 | 0.70 309 | 0.80 306 | 0.90 300 | 1.00 297
R_obs 60.0% (297/495) at min_fraction = 1.0   — reproduces the recorded 297 exactly
  NULL H  N=200: median 0.00%, min 0.00%, max 0.00%   over MAX +60.0 pp  p at floor
  NULL F  N=200: median 0.00%, min 0.00%, max 0.00%   over MAX +60.0 pp  p at floor
```

Doctrine 58's identification of 297 as `min_fraction = 1.0` is confirmed
independently. *Also reached by a sibling cell* (commit `22876d1`).

### 2.5 Reproduced exactly, no defect found

| claim | source | re-run |
|---|---|---|
| sonnet battery 123/1064 = 11.6% violations | RESULTS_BAND P3 | `battery.py` — exact |
| P4 held-out AUC 0.9177 (fitted) vs 0.9146 (hand-set) | RESULTS_MATRIX | `eval_matrix.py` — exact |
| P6 19.1% vs 19.5% at 5% FPR, n=1010 | RESULTS_MATRIX | exact |
| P2 stress −0.0999 bits; P3 empty/empty −0.000 | RESULTS_MATRIX | exact |
| Exp1/Exp2 per-feature AUCs and p, both feature sets | RESULTS.md, RESULTS_WITHIN_ITEM | `discriminate.py` — exact |
| Part D arms A / B / C1 / C2 | POSITIVE_CONTROL | `run_positive_control.py` — exact |
| time-layer α floor at real item sizes (0.043 vs declared 0.05) | POSITIVE_CONTROL Part A | see §1.4 |

`quality/matrix_eval.json` regenerates **byte-identical** to the committed
artifact.

---

## 3. NUMBERS THAT ARE NOT WRONG BUT DO NOT CARRY THEIR SETTING (doctrine 58)

1. **`RESULTS_MATRIX.md` P8's correspondence table does not match what
   `eval_matrix.py` emits today.** Document: UW~AH +1.30 n=22, ER~AO +0.53 n=7,
   ER~AH +0.50 n=6, UH~AH +0.27 n=2, EH~AA +0.06 n=16. Code, on a run that
   reproduces the committed JSON byte-for-byte: UW~AH +1.33 n=24, **ER~AH**
   +0.44 n=6, **ER~AO** +0.34 n=6, UH~AH +0.19 n=2, EH~AA +0.03 n=17, and a
   sixth row OW~AH +0.02 n=8 that the document omits. Rows 2 and 3 swap rank.
   The narrative — one substantial learned correspondence, and it is an Early
   Modern sound change — is unaffected; the table is not reproducible from the
   shipped code.
2. **The sonnet violation rate appears at 8.0%, 11.6%, 19.1% and 19.5%** across
   these documents, at three different thresholds (theta 0.75 pre-band, theta
   0.75 with the band, and a 5%-FPR calibrated cut on 1010 held-out pairs).
   Only the run output names them. A reader comparing 19.1% with 11.6% is
   comparing coordinates.
3. **"253 poems / 88.1%" and "300 poems / 264 = 88.0%"** are the same statistic
   at two values of `tang_poems(limit=…)`.
4. **Kalevala 22,822 vs 22,796 verse lines** — a filter difference, almost
   certainly runo headings. Immaterial to the rate, unstated.
5. **`RESULTS_FWER.md` P2's table is a six-row table printed as three rows of
   six numbers**, so reading it gives 8.8% where the text says 5.4%. The mean
   is correct over six sonnets; the layout makes the claim uncheckable by
   reading, and the regression that guards it checks only `mean < 0.20`.
6. **Every joint AUC in `RESULTS.md` and `RESULTS_WITHIN_ITEM.md` is a
   coordinate of `random_state=SEED`** (see §1.3).

---

## 4. NOT RE-EXECUTED, AND WHY

* **Every rap row** in `RESULTS_TIME.md` and `RESULTS_FWER.md` (p = 0.132 /
  0.626 / 0.087, saturation 12.6–35%, the 20-line blocks). `verse.txt` is
  deleted and may not be replaced under the provenance policy. Correctly
  withdrawn already; nothing here can check them.
* **`RESULTS.md`'s pre-fix section** (0.709 / 0.971 and the ten-feature tables
  above the fold). The pre-fix code no longer exists; the document itself marks
  it superseded and keeps it as an audit trail, which is the right call.
* **`RESULTS_TIME.md`'s amended-parameter arms** (theta 0.90, window 16,
  saturation 17–39%, the generated-sonnet arm, `against_all`). I ran the time
  layer at theta 0.80 / window 32 because those are the parameters
  `RESULTS_FWER.md`'s tables use and that document supersedes this one. The
  amended-parameter figures are unchecked here.
* **`POSITIVE_CONTROL.md` Part A's full 25-cell power table.** Re-running it
  cell by cell is 200 trials × 400 permutations × 25 cells. I re-ran the floor
  arm at the sizes that matter (§1.4) and it reproduces; the ceiling and MDE
  cells are unchecked.
* **`RESULTS_MATRIX.md` P5's fitted rows** (21.3% at 5% FPR, 26.0% at 10%) and
  P7 (97% vs 95% saturation). These need a fitted comparator threaded through
  `infer_chains`, which I did not build. They are moot in any case: §1.1 shows
  the Whitman statistic they are stated in has a null spanning 6.7%–27.3%, so
  every number in that column lies inside one noise band.
* **Part E's Sanskrit, Old Norse, Irish and Malay rows.** These are counts and
  licence findings, not rates; there is no null to run against "1,228 lines /
  814 blocked".

---

## 5. WHAT THE AUDIT DID NOT FIND

No pre-registration was contradicted by its own run except where the document
already says so. No result was found to have been tuned to a target. The two
strongest positive claims in the corpus documents — Kalevala alliteration and
律詩 mandated rhyme — survive nulls far more hostile than the ones they were
recorded without, and the cynghanedd exemplar reproduces to the decimal
including its two p-values sitting on the resolution floor.

The pattern in what *did* fall is single: **four claims stated as rates on one
corpus, where the comparator was another rate rather than a null.** Whitman
26.0 → 20.0, the scrambled 5.4%, the joint AUC 0.659 → 0.604, and Fisher 0.950.
In each case the number was reproducible and the reading of it was not
supported. Doctrine 56 says a search needs a null under the same search;
these say a **rate** needs a null under the same instrument.

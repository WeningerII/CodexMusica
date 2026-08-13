# Results — within-item respecification

> **WRITTEN 2026-08-09. REPINNED COLD 2026-08-13.**
>
> All four joint held-out AUCs this document was built on were WARM figures,
> and all four moved when they were recomputed against a comparator that
> declares itself: ABSOLUTE **0.659 → 0.717** (Exp 1) and **0.975 → 0.964**
> (Exp 2); WITHIN-ITEM **0.604 → 0.638** and **0.877 → 0.891**.
>
> The warm readings are kept below with the date they were superseded rather
> than overwritten (doctrine 17). They are kept for a specific reason and not
> out of tidiness: **the pre-registered predictions P1 and P2 were scored
> against them**, and a pre-registration scored against a comparator that has
> since been withdrawn is a finding in its own right. See "The comparator P1
> and P2 were scored against" below.

Predictions in `PREREGISTRATION_WITHIN_ITEM.md`, committed 2026-08-09 before
`within_item.py` existed. **That file is deliberately not edited here.** A
pre-registration records the numbers that were current at the moment it was
committed; rewriting it to agree with a later measurement would destroy the
only property that makes it a pre-registration. Its P1 and P2 name 0.975 and
0.659 and they should go on naming them. The correction belongs in this
document, which is the record of what was measured, not the record of what was
predicted.

Reproduce with `python3 quality/discriminate.py`, which runs both feature sets
over the same corpora. Two instruments grade what is below:

- `python3 quality/test_discriminate.py` — pins **forty-four** numbers at a
  tolerance of 0.0005: the eight joint AUCs and the thirty-six per-feature
  AUCs. It runs **cold** and reads no cache under any flag, so it cannot pass
  because of a file a previous run left on disk.
- `python3 quality/audit_joint_auc_null.py --check` — grades four of the joint
  AUCs against a label-permutation null and against 200 cross-validation seeds,
  and **REFUSES** (exit 2) rather than guessing when no fingerprint-matching
  cache is available.

## Why every joint AUC in this document moved

MEASURED 2026-08-13. Recorded in full at `quality/RESULTS_CACHE_IDENTITY.md`.

Until 2026-08-13 `quality/discriminate.py` kept its feature-vector cache keyed
`tag:ident` — corpus, feature class, poem number, and nothing else. The key
named the poem and never the code, so it carried no fingerprint of
`features.py`, `within_item.py`, `lyric_harness.py`, the `Declaration` tuple or
any resource file. Every run therefore served whatever the feature code had
produced when each entry was first written, on 2026-08-09/10 — which is when
this document was written and when its numbers were taken.

**The recorded numbers reproducing exactly WAS the defect.** The cache could
not tell "the answer did not change" from "the question was never asked again",
and it reported the second as the first.

Closed at the module. The format-2 cache fingerprints the source files, the
three resource files, the `Declaration` tuple and the feature names and their
predicted directions, and content-addresses every entry on the poem's own
lines. A fingerprint-matching cache provably holds vectors written by the code
running now, so warm and cold agree by construction; a mismatch is discarded
with the coordinate that moved printed by name.

## Head to head — the joint held-out AUCs

| feature set | Exp 1 AUC | Exp 2 AUC | reading |
|---|---|---|---|
| ABSOLUTE (original ten) | **0.717** | **0.964** | COLD — current, measured 2026-08-13 |
| WITHIN-ITEM (respecified eight) | **0.638** | **0.891** | COLD — current, measured 2026-08-13 |
| ABSOLUTE (original ten) | 0.659 | 0.975 | warm — stated here from 2026-08-09, **SUPERSEDED** 2026-08-13 |
| WITHIN-ITEM (respecified eight) | 0.604 | 0.877 | warm — stated here from 2026-08-09, **SUPERSEDED** 2026-08-13 |

The predictability-only column, cold, measured 2026-08-13. Nothing in the repo
graded this column before `test_discriminate.py` existed:

| feature set | Exp 1 | Exp 2 |
|---|---|---|
| ABSOLUTE — `rhyme_predictability_mean` + `_min` | 0.710 | 0.648 |
| WITHIN-ITEM — `wi_predictability_advantage` | 0.719 | 0.652 |

And the same four fits taken over **200 cross-validation seeds** instead of the
one hard-coded seed every figure above is a single draw from
(`audit_joint_auc_null.PINNED`, measured 2026-08-13):

| feature set | Exp 1 median | Exp 2 median |
|---|---|---|
| ABSOLUTE | 0.638 | 0.967 |
| WITHIN-ITEM | 0.640 | 0.900 |

### The hit and wrong-sign tallies are still WARM, and are not repinned here

| tally | ABSOLUTE | WITHIN-ITEM | reading |
|---|---|---|---|
| Exp 1 pre-registered hits | 4/10 | 1/8 | warm 2026-08-09 — **NOT re-derived cold** |
| Exp 2 pre-registered hits | 2/10 | 1/8 | warm 2026-08-09 — **NOT re-derived cold** |
| Exp 2 wrong-sign features | 5/10 | 4/8 | warm 2026-08-09 — **NOT re-derived cold** |

A hit is a two-sided permutation p clearing Benjamini–Hochberg FDR at q = 0.10,
and **no permutation p in this document has been re-run cold.** The split is
deliberate and it is the instrument's, not this document's: an AUC is free —
`run_experiment` gets it from `auc_from_ranks` before it spends anything — while
a p costs 20,000 label shuffles per feature, so `test_discriminate.py` pins
every AUC and pins no p at all (doctrine 57: a p at that resolution is a
sample, and pinning it would witness the replicate count).

Two of the per-feature AUCs these tallies rest on moved materially cold and
could carry a verdict with them — `wi_freq_delta` in Experiment 1 (0.579 →
0.639) and `wi_predictability_advantage` (0.304 → 0.262). So the counts are
stated as the warm figures they are and are **not** quoted as current.
Doctrine 20: an instrument that has not fired is not an instrument that fired
and found nothing.

## The comparator P1 and P2 were scored against

**Both structural pre-registered predictions were scored against numbers that
have since been withdrawn, and this is recorded rather than quietly fixed.**

P1 was written as *"Experiment 2's joint held-out AUC will FALL substantially
below 0.975"* and P2 as *"Experiment 1's joint held-out AUC will hold or improve
on 0.659."* Those two constants are the ABSOLUTE feature set's warm readings.
The comparator no longer produces either of them: it produces 0.964 and 0.717.

So the scoring that stood in this document from 2026-08-09 to 2026-08-13
divided a warm ceiling into a warm floor and reported the quotient as the
effect of the respecification. Both verdicts are re-scored below against the
cold comparator, and the arithmetic changes even where the verdict does not.

This is not a defect in the pre-registration. It named the numbers that were on
the record on the day it was committed, which is exactly what a
pre-registration is for. It is a defect in what the record was, and it was
invisible from inside: the numbers reproduced on demand, to three decimals,
every time anyone checked.

## Scoring the pre-registered predictions — RE-SCORED COLD 2026-08-13

**P1 — Exp 2 AUC must fall substantially. PARTIALLY MET, and by less than was
claimed.**

Cold: **0.964 → 0.891.** In error terms that is 0.036 → 0.109, i.e. **~3.1x the
error**. It is a substantial fall and 0.891 is still a strong classifier;
within-item normalization removed a large part of what the 0.964 was made of,
and what remains is still not quality.

> **SUPERSEDED 2026-08-13.** This paragraph read *"0.975 → 0.877. In error
> terms that is 0.025 → 0.123, i.e. ~4.9x the error"* from 2026-08-09. Both
> endpoints were warm. The multiplier is 3.1x, not 4.9x — the earlier figure
> overstated the fall by about 1.6x, because a ceiling reported 0.011 too high
> and a floor 0.014 too low compound in a ratio of their complements.

The verdict does not rest on the single seed either, which is the check
doctrine 73 requires and which P1 passes: at the median of 200 CV seeds the
same comparison is **0.967 → 0.900**, an error ratio of 3.03x — the same answer
to two figures.

**P2 — Exp 1 AUC must hold or improve on 0.659. The scored verdict was FAILED;
it is an artifact of the cross-validation seed, cold as well as warm.**

Cold, at the recorded seed: **0.717 → 0.638.** It fell, and it fell *further*
than the warm reading said — 0.079 rather than 0.055. Against the literal
pre-registered constant it also fails: 0.638 is below 0.659. On this seed, by
either comparator, P2 does not hold.

> **SUPERSEDED 2026-08-13.** This section read *"0.659 → 0.604. It fell."* from
> 2026-08-09, with no seed distribution beside it and no reference to the audit
> that had already overturned the verdict.

**But the verdict is not a measurement, and `quality/NULL_AUDIT.md` §1.3 said
so on the warm numbers before this repin.** `discriminate.joint_classifier`
hard-codes `StratifiedKFold(shuffle=True, random_state=SEED)`, and at n = 15 in
the minority class one seed is a coin flip. Over 200 seeds:

| reading | ABSOLUTE Exp 1 median | WITHIN-ITEM Exp 1 median | P2 at the median |
|---|---|---|---|
| warm (NULL_AUDIT §1.3, 2026-08-13, warm cache) | 0.603 | 0.606 | **holds** (+0.003) |
| cold (`audit_joint_auc_null.PINNED`, 2026-08-13) | 0.638 | 0.640 | **holds** (+0.002) |

**Doctrine 73 replicates cold.** Both levels moved by ~0.035 and the sign of
the difference did not: at the median seed the within-item set is marginally
*above* the absolute one in Experiment 1, so "hold or improve" holds, in both
readings, and the recorded FAILED is a property of `SEED` rather than of the
respecification. The recorded draw sits at roughly the 85th percentile of the
absolute seed distribution and the 49th of the within-item one — the comparison
was scored between a lucky draw and an average one.

What survives untouched is this document's actual conclusion, and it comes out
stronger rather than weaker: at n = 15 neither Experiment 1 joint AUC beats its
own label-permutation null's **maximum**, and the within-item one is not
separated from that null at all (p = 0.13, warm; the audit has not been re-run
cold). "0.638 at n=15 does not come close to excluding chance" is measured, not
asserted.

**P3 — Exp 2 wrong-sign count must fall below five. MET, TRIVIALLY, and the
repin does not touch it.**

5 → 4. Technically a pass; substantively unchanged. All four within-item
wrong-sign AUCs are **bit-identical warm to cold** — `wi_concreteness_delta`
0.382, `wi_function_delta` 0.680, `wi_type_ratio` 0.103, `wi_conc_spread` 0.367
— so nothing in the cold repin moves the count in either feature set. (Their
p-values are not re-measured. A permutation p is a function of the ranks alone
and an AUC identical to sixteen significant figures is strong evidence the
ranks did not move, but that is an inference from a number, not a run, and it
is not stated here as one.)

Concreteness still inverts, which means the concreteness inversion was **not**
merely a level/era artifact — the two classes genuinely differ in how they
distribute concreteness relative to their own internal baselines.

## The finding

**The diagnosis was confirmed. The cure did not work.**

The diagnosis — that Experiment 2's headline was substantially a
register-and-period classifier rather than a quality classifier — is supported
by direct evidence: strip the levels and roughly three times as much error
appears. That was the load-bearing claim and it held, at both readings; only
the size of the effect moved.

But the feature set was not rescued. After respecification, cold:

- **Experiment 1 sits at 0.638** at n=15, which does not come close to
  excluding chance — and at the median seed the two feature sets are
  indistinguishable (0.638 vs 0.640).
- **Experiment 2 remains at 0.891**, so the within-item features still carry
  substantial style signal that is not quality.
- **The hit counts are 1/8 in each experiment on the warm reading and have not
  been re-derived cold.**

Per the falsification clause written in advance: *"A result where Exp 2 falls to
near chance and Exp 1 also falls to near chance is not a failure of this
pre-registration. It is the finding that the quality layer has no demonstrated
signal at all, and it must be reported as such rather than reframed."*

Experiment 1 did fall toward chance. **The quality layer has no demonstrated
cross-design signal** — with one qualification, added 2026-08-13, in "The one
feature that clears both designs" below. That qualification narrows the
sentence; it does not retire it.

## The one feature that clears both designs — REINSTATED 2026-08-13

`quality/RESULTS.md` withdrew the claim that `rhyme_predictability` clears FDR
in both designs. **That withdrawal was computed against warm numbers the
comparator no longer produces, and it is reinstated on the cold figures.** The
full statement of what was withdrawn, on what numbers, and why the withdrawal
is superseded is in `RESULTS.md` § "Cold repin — 2026-08-13"; what belongs
here is what it means for the within-item set.

`wi_predictability_advantage` reads, cold: **0.262 in Experiment 1 and 0.340 in
Experiment 2**, both in the predicted direction (LOWER). Its absolute twin
`rhyme_predictability_mean` reads the same two numbers and clears FDR at
q = 0.10 in both designs (p = 0.0018 and p = 0.0015, from the cold run recorded
in `RESULTS.md`).

**Three things that does not license, all of which this document has to say out
loud because they are the three ways this reinstatement would be over-read.**

1. **It is one feature, not a layer.** The other seven within-item features are
   null or wrong-signed, and the joint AUCs are unmoved by any of this.
2. **It is one measurement, not two.** See the section immediately below —
   `wi_predictability_advantage` is a monotone transform of
   `rhyme_predictability_mean`, so it cannot corroborate it. Doctrine 11's
   standing instruction is to assume a feature reads period *until a within-item
   version says otherwise*, and the within-item version of feature 1 is
   structurally incapable of saying anything at all.
3. **Cross-design is not cross-tradition.** Experiment 1's 15 survived and 117
   forgotten sonnets are a **subset of Experiment 2's 152 human items** —
   `discriminate.py` computes them from the same 384 cached vectors and they
   share their cache keys. The two designs share their entire human side: one
   author, one form, one language, one era, one publication event. A feature
   clearing both is being asked about the same corpus twice with different
   negatives. Doctrine 8 is the doctrine that decides what that is worth, and
   the answer is: not a universal, and not evidence about verse in general.

## An uncomfortable detail about the one surviving feature

`wi_predictability_advantage` scores AUC **0.262 in Experiment 1 and 0.340 in
Experiment 2 — identical to the absolute `rhyme_predictability_mean` in BOTH
experiments, and identical to sixteen significant figures, not to three
decimals.**

> **REPINNED 2026-08-13.** This section read *"0.304 in Experiment 1 —
> identical to the absolute `rhyme_predictability_mean`, to three decimals"*.
> The observation was right and understated twice over: the warm figure was
> 0.304, the cold one is 0.262, and the agreement holds in Experiment 2 as
> well, at full float precision (0.26153846153846155 and 0.33963815789473684
> in both feature sets — the same floats, pinned as such).

That is not a coincidence and not a bug. `mean(pred) − 0.5` is a *monotone*
transform of `mean(pred)`, and AUC is rank-based, so it is mathematically
invariant. **The within-item respecification of feature 1 adds exactly zero
discriminative power within a single corpus**, and the bit-identity in both
experiments is the proof rather than the suggestion.

Its value is real but narrower than advertised: 0.5 is the exact expectation of
a uniform draw from a candidate field of *any* size, so the recentred statistic
is comparable across languages, lexicon sizes and field structures in a way the
raw value is not. That is a cross-tradition comparability property, **not** a
power gain, and this document should not be read as claiming otherwise — least
of all in support of the reinstatement above, which it cannot corroborate.

## Per-feature detail

Cold AUCs measured 2026-08-13, pinned in `quality/test_discriminate.py` and
verified there at a tolerance of 0.0005. Warm AUCs and every p-value are the
2026-08-09 reading, kept for comparison and **superseded** as current figures;
no p-value here has been re-measured cold.

Experiment 1 — survived vs forgotten, n = 15 vs 117:

| feature | predicted | **cold AUC** | warm AUC | warm p / verdict |
|---|---|---|---|---|
| `wi_predictability_advantage` | lower | **0.262** | 0.304 | 0.0117 HIT (FDR) |
| `wi_concreteness_delta` | higher | **0.509** | 0.509 | 0.9095 null |
| `wi_abstract_delta` | lower | **0.582** | 0.582 | 0.3053 null |
| `wi_freq_delta` | higher | **0.639** | 0.579 | 0.3290 null |
| `wi_function_delta` | lower | **0.394** | 0.394 | 0.1840 null |
| `wi_binding_excess` | higher | **0.533** | 0.533 | 0.6775 null |
| `wi_type_ratio` | higher | **0.657** | 0.657 | 0.0502 null |
| `wi_conc_spread` | higher | **0.520** | 0.520 | 0.8030 null |

Experiment 2 — human vs generated, n = 152 vs 40:

| feature | predicted | **cold AUC** | warm AUC | warm p / verdict |
|---|---|---|---|---|
| `wi_predictability_advantage` | lower | **0.340** | 0.422 | 0.1304 null |
| `wi_concreteness_delta` | higher | **0.382** | 0.382 | 0.0222 WRONG SIGN |
| `wi_abstract_delta` | lower | **0.431** | 0.431 | 0.1826 null |
| `wi_freq_delta` | higher | **0.600** | 0.614 | 0.0262 HIT (FDR) |
| `wi_function_delta` | lower | **0.680** | 0.680 | 0.0005 WRONG SIGN |
| `wi_binding_excess` | higher | **0.580** | 0.580 | 0.1245 null |
| `wi_type_ratio` | higher | **0.103** | 0.103 | 0.0000 WRONG SIGN |
| `wi_conc_spread` | higher | **0.367** | 0.367 | 0.0097 WRONG SIGN |

**Exactly two features moved, in each experiment, and they are the same two in
both: the two that rank a word against a lexicon.**
`wi_predictability_advantage` ranks a rhyme word in its own candidate field and
`wi_freq_delta` ranks content words in a frequency list; the other six are
built from concreteness norms, part-of-speech tags, function-word membership
and type counts, and are bit-identical warm to cold. That is a coherent
signature rather than noise — it says the warm cache was serving pre-fix
*rank* arithmetic and nothing else — and it is also why the two moved AUCs are
precisely the ones whose warm FDR verdicts cannot be carried forward.

`wi_type_ratio` at 0.103 is the largest single effect anywhere in the study and
it is **backwards**: relative to their own lexical diversity, Shakespeare's
rhyme words are far *less* varied than the generated sonnets'. He reuses rhyme
vocabulary; the model does not. Whatever that is measuring, it is not quality —
and it is the third feature caught pointing the wrong way. Unmoved by the
repin.

`wi_binding_excess` is null in both designs (0.533, 0.580) even after being
given a proper permutation baseline drawn from each item's own line-final tag
multiset, and both figures are unmoved by the repin. Wimsatt's binding claim
has now failed under two separate operationalizations and should be considered
unsupported by this corpus rather than merely badly measured (doctrine 12).

## What this does not license

It does not license "the approach is dead." One tradition, one form, a
model-derived label, n=15 on the survival side, and a single generator on the
detection side. This is a null in a small English cell, not a general result —
and treating a null here as a general finding would be the same error as
treating the earlier 0.971 as one.

It does not license reading the reinstatement above as a rescue. One feature
clears both designs; the two designs share their whole human side; the
within-item form of that feature is the same measurement under another name;
and the joint AUCs — the numbers the layer is actually stated in — did not
move in its favour.

It does license retiring the specific claim that these features measure quality.
Nothing in either feature set has demonstrated a signal that survives across
both a design change *and* a tradition change, because no tradition change has
been run.

## Provenance of every number above

- **Cold AUCs** — `quality/test_discriminate.py`, pinned at `features.py`
  `affe2209d56e24b5`, `within_item.py` `703b700a530925c7`, `lyric_harness.py`
  `10c1dca86b15860a` and `7c894bfce92a48a7`, `concreteness.txt`
  `0b4082dbd38585b0`, `wordfreq20k.txt` `4ed6e5336d7760d2`, `cmudict.dict`
  `81917843c7f44ce2`. Measured 2026-08-13 at two `lyric_harness.py` digests and
  agreeing on all forty-four; verified again 2026-08-13 by a full 69-assertion
  pass at a fingerprint-matching cache, 0 failures.
- **The four joint AUCs** were first repinned cold in commit `98f07a4`, in
  `quality/audit_joint_auc_null.py`'s `RECORDED` strings.
- **Seed medians** — `audit_joint_auc_null.PINNED`, 200 seeds, measured
  2026-08-13.
- **Cold p-values for `rhyme_predictability`** — the cold `discriminate.py` run
  recorded in `quality/RESULTS.md`.
- **Warm AUCs, all p-values and all hit/wrong-sign counts** — the 2026-08-09
  run, superseded as current figures and kept as the record of what was
  claimed.

Doctrine 58: argue these and repin them with the date. Do not tune the
measurement to meet them.

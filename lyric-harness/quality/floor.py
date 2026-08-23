#!/usr/bin/env python3
"""The slop floor — a rejection gate for generated verse.

WHAT THIS IS, AND WHAT IT IS NOT

It is a gate that reports NAMED, MEASURED defects. It is not a quality score and
will never return one. Two project rules force that shape:

  - No weighted quality score, ever. The exchange rate between surprise and
    clarity is not derivable; it is a genre's answer, so it belongs in a
    declaration rather than in a constant.
  - Rejection, not selection. Detecting bad writing held out at AUC 0.960;
    ranking good writing at 0.717. Enforce a floor, do not order what passes.
    (Both ABSOLUTE ten-feature joints, cold: 0.960 is Experiment 2, human vs
    generated; 0.717 is Experiment 1, anthologized vs not. REPINNED
    2026-08-14 from 0.971/0.709 — see the cold-repin section below.)

So `check()` returns findings a writer or a revision loop can act on, each with
the measurement that triggered it. A caller that wants a single number has to
invent its own weighting, in the open, and own it.

THE HONEST LIMITS OF THE CALIBRATION

Thresholds are derived from 152 Shakespeare sonnets against 40 sonnets written
by one model. That is:

  - one form (14-line rhymed sonnet)
  - one language (English)
  - one generator
  - a 400-year register gap between the classes

The joint classifier separating those two sets reached AUC 0.960, but the same
analysis showed it is largely reading REGISTER AND PERIOD rather than quality:
five of ten features separated with the WRONG sign, and a within-item
respecification that removes level effects takes it to 0.891. Both figures are
Experiment 2 (human vs generated) read cold, so the only coordinate that moves
between them is the FEATURE SET — ten absolute features against eight
within-item ones. So this gate is well evidenced as "does this look like the
model's sonnets rather than Shakespeare's" and is UNVALIDATED as a general slop
detector.

WHAT THE CALIBRATION RUN CHANGED

Thresholds are now percentiles of the human class rather than estimates, and
the estimates were not close. `mattr_min` guessed at 0.80 against a measured
human 5th percentile of 0.7557; the guess would have flagged about half of
Shakespeare for lexical monotony. `predictable_pair_fraction_max` guessed at
0.40 against a measured 0.8333, which would have flagged roughly 60% of him
for predictable rhyme. An uncalibrated floor does not fail safe, it fails
loud, and the direction of the error was toward confirming the gate's own
premise.

One check came out backwards. UNIFORM_LINE_LENGTH was built on the assumption
that metronomic line length is a generated-text tell; measured, Shakespeare is
MORE uniform than the model (AUC 0.350). In a fixed form, uniformity is the
form. It is retained as a calibrated "outside the human range" note and is
explicitly not slop evidence.

One check is unregistered. ANAPHORA_OVERLOAD separates at |0.853|, third-best
of the set, and was never pre-registered — so it is a post-hoc finding and
owes its own replication before anyone leans on it.

One check is a NOTE for a reason that changed under it. PREDICTABLE_RHYME, this
project's former candidate universal, was recorded here as reproducing its own
withdrawal at 0.560 — chance. Cold, the predictability-only joint reads 0.648
on human-vs-generated and 0.710 on anthologized-vs-not: above chance in both,
and far under the 0.960 the ten-feature joint reaches on the same
human-vs-generated split. So predictability is a WEAK separator carried by
stronger features rather than a dead one, and it is STILL a note that may not
carry a rejection — on doctrine 7, which was always the better reason: a floor
may not order the region it has already passed.

Every finding therefore carries the evidence that supports it, and the module
exposes `CALIBRATION` so a caller can see what the numbers came from. Do not
quote a threshold without it.

WHERE EVERY AUC ABOVE CAME FROM — REPINNED 2026-08-14, MEASURED 2026-08-13

Every AUC in this module is now the COLD reading, pinned in
`quality/test_discriminate.py` and reproducible with `python3
quality/test_discriminate.py` (grades eight joint AUCs and thirty-six
per-feature AUCs cold, reading no cache). Until 2026-08-14 this module quoted
the PRE-FIX and WARM readings, and two of the sentences built on them were
arithmetic on numbers nothing now produces. Superseded, kept rather than
overwritten (doctrine 17):

    absolute joint held-out, Exp 1 (ten features, anthologized vs not)
        pre-fix 0.709  ->  warm 0.659  ->  COLD 0.717
    absolute joint held-out, Exp 2 (ten features, human vs generated)
        pre-fix 0.971  ->  warm 0.975  ->  COLD 0.964
        ->  0.960 (2026-08-22, the M-31 sentinel fix)
    within-item joint, Exp 1 (respecified eight)
        warm 0.604  ->  COLD 0.638
    within-item joint, Exp 2 (respecified eight)
        warm 0.877  ->  COLD 0.891
    predictability-only joint, Exp 2 (two features)
        warm 0.560  ->  COLD 0.648

THREE AXES, AND THE SENTENCE THIS MODULE CARRIED COLLAPSED ALL THREE. "Removing
level effects dropped joint AUC from 0.971 to 0.877" subtracted a WITHIN-ITEM,
WARM figure from an ABSOLUTE, PRE-FIX one, so it charged the respecification
for the out-of-vocabulary fix and for a stale cache as well. Like for like —
same design, same cache state, only the feature set moving — it is 0.960 ->
0.891. DESIGN (Exp 1 / Exp 2), FEATURE SET (ten absolute / eight within-item /
two predictability-only) and CACHE STATE (pre-fix / warm / cold) are three
separate coordinates, and a figure quoted without all three is unreadable
(doctrine 58).

The warm readings were served by a feature cache keyed with no fingerprint of
the code that wrote it, so they reproduced whatever `features.py` looked like
on 2026-08-09; the cache carries a fingerprint of its inputs now and discards
itself when one moves. `quality/RESULTS.md` "Cold repin — 2026-08-13" is the
record.

WHAT THIS REPIN DID NOT CHANGE: PREDICTABLE_RHYME'S SEVERITY. Cold,
predictability is no longer chance, and `rhyme_predictability_mean` clears FDR
in BOTH designs with the predicted sign — a finding `RESULTS.md` reinstates
under "`rhyme_predictability` is REINSTATED, narrowly". That is a STRONGER
result than this module used to record, and the check is still a NOTE. The
evidence string was repinned; the finding was not promoted. Doctrine 7 is what
holds it there, and it does not depend on the number: a floor may not order the
permitted region, so a check that says "this rhyme sits at the top of its own
candidate field" hands a decision back and never carries a rejection.

THE SONG PROFILE, ADDED 2026-08-11, IS A DIFFERENT KIND OF CALIBRATION

Everything above describes the `section` and `sonnet` profiles, which are
human-vs-generated separations on 152 Shakespeare sonnets against 40 model
sonnets. The `song` profile is not that and must not be read as that. There is
no generated song class in this repo, so the song profile has NO AUC and never
will until one exists. What it has instead is a false-positive rate measured on
held-out human song text, which is the doctrine-22 statement of a threshold and
is a weaker claim than a separation: it says how often the gate interrupts a
human songwriter, and says NOTHING about whether it catches a machine.

Its calibration set is `corpus/song/eng_*.txt` -- 143 files, one author each,
4,930 `--- TITLE:` items, 152,325 sung lines -- restricted to items of 150-400
tokens. Held out BY AUTHOR, never by item, because items by one author are not
independent of each other (doctrine 13); the item-level split was run alongside
purely to price what the wrong split would have bought, and it understates the
seed-to-seed spread by roughly a factor of two. Every rate below is a median
over 200 author-held-out splits with the 5th-95th percentile of seeds beside
it, because one seed is a coin flip reported as a verdict (doctrine 73).

Two limits on it, both measured rather than assumed, both in the profile note:

  - The corpus is pre-1931 by construction (the provenance gate). Its
    latest-born author is 1872 and its latest death is 1929, so it contains no
    song composed by anyone alive in the last century. ~~ANAPHORA carries a
    real period slope inside that window (author-level Spearman +0.275 against
    birth year, p_perm 0.0042 over 10,000 label permutations at seed 20260811,
    which survives Bonferroni over the five checks) -- so this is a THIRD
    feature caught reading period rather than quality, after the two doctrine
    11 already names.~~ WITHDRAWN 2026-08-20 (doctrine 17), and the strike is
    the finding rather than a tidy-up: re-derived over 407 dated authors
    against the original 108, the anaphora slope is rho -0.008, p_perm 0.8695.
    ABSENT and sign-flipped, not weaker. TWO THINGS THAT DO NOT FOLLOW FROM
    IT. (a) 472 of the 879 in-band authors are UNDATED and dropped from this
    check alone, and they are not missing at random -- they are the anthology
    material whose editions print no author dates -- so it is a failure to
    reproduce on a biased 46% subsample and NOT a clean bill. (b) The confound
    RELOCATED rather than left: `mattr` -0.228 -> -0.125 and `fwr` +0.090 ->
    +0.144 both SURVIVE Bonferroni now where they did not at 108 authors, at
    unchanged signs, so what moved is the power and the IDENTITY of the
    period-reading feature, not the existence of one (doctrine 11). The same
    caveat is why they are not adopted here either.
    `quality/RESULTS_SONG_FLOOR.md` §4·R carries the table and the command.
    PREDICTABLE_RHYME is not a fourth: rho -0.018, p_perm 0.8572, does not
    survive. NOTE that "latest-born 1872" is the 108-author calibration
    population's window; over the loaded tree the in-band dated authors run
    1340-1888, and every constant in this profile still describes the 143-file
    corpus until the closing sitting repins it.
  - Threshold transfer across the corpus's own period cohorts fails
    asymmetrically and in the direction that matters here: thresholds fitted on
    earlier-born authors OVER-flag later-born ones (function-word ratio 12.39%
    against a cohort-label permutation null median of 5.17%, mattr 10.62%
    against 4.92%), while the reverse direction runs at or below nominal.
    Neither survives Bonferroni over the 12 cross-cohort comparisons, so
    this is a DIRECTION and not a finding. But a 2026 lyric sits further along
    the same axis than any author in the corpus, and the only measured gradient
    points at a HIGHER false-positive rate there, not a lower one.

`quality/RESULTS_SONG_FLOOR.md` carries the full tables and the commands.

CLICHE_PAIR HAS A FALSE-POSITIVE RATE NOW, AND IT IS NOT A CLICHE DETECTOR

MEASURED 2026-08-14, off the same machinery that produced the three shipping
flags' rates -- author-held-out, 200 seeds, 50/50, over the same 150-400 band;
the protocol reproduces LEXICAL_MONOTONY 5.43%, FUNCTION_WORD_HEAVY 5.23% and
ANAPHORA_OVERLOAD 5.01% exactly.

    CLICHE_PAIR in-band FPR   median 6.36%, seed 5th-95th 4.23-8.37%
                              point 118/1859 = 6.35%, Wilson [5.33, 7.55]
                              author-cluster bootstrap 6.20% [4.02, 9.10]

So it is in the family of the three that ship. That is what licenses it to
fire, and this repin does NOT demote it. What the measurement did compel is
one change, and it is a SEVERITY change outside the band. Bucketed by the live
`declaration_for()` over all 4,930 corpus items:

    exact:section              86 items    0 fire     0.00%
    exact:sonnet              437         24         5.49%
    exact:song               1859        118         6.35%
    EXTRAPOLATED:section      631         14         2.22%
    EXTRAPOLATED:sonnet      1160         43         3.71%
    EXTRAPOLATED:song         472         34         7.20%
    OUT_OF_CALIBRATED_LENGTH  285         42        14.74%   <- 2.3x in-band

`_relation_findings` hardcoded "flag" and is appended AFTER the `sev()` closure
in `check()` has been applied, so CLICHE_PAIR was emitted as a HARD FLAG on 133
items where every length-sensitive finding had been downgraded to a note -- 42
of them in the one bucket nothing was ever calibrated at, at 2.3x the in-band
rate, where it was the only flag the gate could still emit. It now runs through
`sev()` like every other flag: exact -> flag, extrapolated or out-of-range ->
note. IN BAND THAT COSTS NOTHING, and that is measured, not asserted: 118 of
1859 in-band items still carry it as a FLAG after the change, the same 6.35%.

WHAT THE RATE DOES NOT LICENSE. An FPR says how often the check interrupts a
human songwriter. It says nothing about what the check is FOR, and the list
does not measure "over-familiar to a living listener". MEASURED against this
repo's own pair table, `data/song_rhymepair_en.tsv` (15,409 distinct pairs,
91,636 tokens, per author):

  - only 4 of the top 30 pairs by AUTHOR DISPERSION are on the hand-typed
    list -- 13.3% overlap; 3 of 10 at the top ten. The table's own most
    dispersed pairs are away/day (61 authors), be/me (57), me/thee (51),
    be/thee (50); the first list member appears at #5.
  - the list's median dispersion rank is #254 of 15,409, and 7 of the 30 do
    not appear in the table at all.
  - 9 of the 30 NEVER FIRE anywhere in corpus/song/eng_*: alone/phone,
    baby/crazy, beats/streets, cash/stash, chance/dance, dough/flow,
    feel/real, fun/sun, girl/world.

So the list has low SENSITIVITY against the only rhyme-frequency evidence this
repo owns, and it is not a frequency instrument. `quality/relations.py`'s
`frequency` Unprovidable and `quality/phrase_commonplace.py` both REFUSE the
"cliche" claim at their own levels for exactly this reason -- every admissible
English source here is pre-1931, and a cliche is over-familiar to a LIVING
listener. This 30-item list does not get to make that claim by being shorter
than they are. It is a NAMED STOCK LIST with a measured interruption rate, and
the finding says so on its face.

ONE PRECISION DEFECT, RECORDED AND NOT FIXED. The check is a raw string-set
membership test with NO rhyme test in front of it. `tears`/`years` fires 21
times over the corpus, 5 of them in band, on couplets `song_rhymepair_en.tsv`
does not record as rhyming at all -- the pair has count ZERO there. That is a
HOMOGRAPH: cmudict gives `tears` two pronunciations, T EH1 R Z (rips) and
T IH1 R Z (weeping), and the table's `rime_key` reads `prons[0]`, which is the
rips sense. Neither layer read which sense is on the page. Both candidate
fixes were priced before this was left alone (MEASURED 2026-08-14, in band):

    no rhyme test at all (shipped)   118/1859 = 6.35%
    prons[0] perfect-rhyme gate      114/1859 = 6.13%
    any-pronunciation gate           118/1859 = 6.35%

The prons[0] gate buys its 4 items by ASSERTING tears-is-rips, which is one
unmeasured convention swapped for another. The any-pronunciation gate is a
provable no-op here -- all 136 in-band listed pairs pass it, and all 313 over
the whole corpus -- so it would be a gate that changes nothing, added to look
careful. The defect is real on arbitrary text and is written down here and in
the finding instead.
"""

import os
import statistics
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

import lyric_harness as _lh  # noqa: E402
from lyric_harness import CLICHE_PAIRS, SUFFIXES  # noqa: E402
from quality.features import QualityFeatures  # noqa: E402

#: Provenance of every threshold below. Printed by `report()` on purpose.
CALIBRATION = {
    "calibrated": True,
    "positive_class": "152 Shakespeare sonnets (PD)",
    "negative_class": "40 sonnets written by one model, same form and register",
    "form": "14-line rhymed sonnet",
    "language": "English",
    "rule": "thresholds set at the 5th/95th percentile of the HUMAN class, so a "
            "finding means 'outside the range human verse occupied here', not "
            "'bad'",
    "known_limits": "one form, one language, one generator, 400-year register "
                    "gap. Reads register and period as well as craft; five of "
                    "ten features separated with the wrong sign, and removing "
                    "level effects takes the human-vs-generated joint from "
                    "0.960 (ten absolute features) to 0.896 (eight within-item "
                    "ones) -- same design, same cold reading, only the feature "
                    "set moving. The "
                    "`song` profile is NOT part of this: it has no generated "
                    "class, no AUC, and its evidence is a held-out "
                    "false-positive rate on human song text -- see that "
                    "profile's own source and note.",
    #: LENGTH IS A COORDINATE, not a detail. MATTR is a moving average over
    #: `FloorDeclaration.mattr_window` tokens (50); below that the
    #: implementation falls back to plain TTR,
    #: which is the length-confounded statistic MATTR exists to avoid. A
    #: 4-line chorus runs 30-36 tokens, so applying the sonnet threshold to it
    #: compares one statistic against another statistic's percentile and
    #: returns a confident number for a measurement that was never made.
    #:
    #: So each profile carries its own percentiles and its own measured
    #: separation, and `declaration_for` refuses to serve text that falls in
    #: neither domain.
    "profiles": {},
    #: NOT read off a distribution. `predictability_max` defines what counts
    #: as "obvious" within a candidate field; it is an axis, not a cut, and
    #: moving it moves what the calibrated fraction is a fraction OF.
    #: `cliche_pairs` is the same shape one level up: it is not a threshold on
    #: a scale at all, it is the EXTENSION of the word -- a hand-typed list of
    #: 30 pairs, and the only thing that can be disagreed with about it is
    #: which pairs are on it. It carries a measured in-band false-positive
    #: rate (see the song profile's `held_out_fpr["cliche"]`) and no
    #: sensitivity claim whatsoever.
    # ONE KEY, THREE ENTRIES. Two lots appended to this list on the same
    # day and the merge produced a DUPLICATE `"definitional"` key --
    # which Python does not error on, it silently keeps the last, so
    # `cliche_pairs` vanished from the list while still being a declared
    # field. `test_floor.py`'s "no threshold can hide outside both
    # lists" is what caught it; nothing about the source looked wrong.
    "definitional": ["predictability_max", "radif_min_pair_fraction",
                     "cliche_pairs", "mattr_window"],
    #: `mattr_window` is definitional in the SAME sense and in that sense
    #: only -- it defines what MATTR IS, so moving it moves what every
    #: `mattr_min` percentile is a percentile of. It is emphatically NOT
    #: inconsequential, and the entry below prices it.
    #: THE SWEEP BEHIND `FloorDeclaration.mattr_window`, 2026-08-14.
    #:
    #: Recorded here so a future disagreement about the window lands in a
    #: coordinate rather than in a function signature. Until this date the 50
    #: was a bare default in `features.QualityFeatures._mattr`: no comment
    #: justifying it (the docstring justified MATTR, not the window), no
    #: declaration field, no CALIBRATION entry, no results document, four
    #: call sites and not one of them passing `window=`.
    #:
    #: THE VALUE DID NOT MOVE. This entry is a record, not a retune.
    "mattr_window": {
        "value": 50,
        "unit": "tokens",
        "swept": "2026-08-14, over the SAME 152 Shakespeare sonnets vs 40 "
                 "generated ones that Experiment 2 reports. `mattr`-alone "
                 "AUC, the statistic test_discriminate.PINNED['abs_exp2'] "
                 "pins at window 50.",
        #: window -> sonnet-level mattr AUC (Exp 2). Reproduced independently
        #: on 2026-08-14; the instrument returns 0.8695723684210527 at window
        #: 50, which is the shipped pin to the last digit, so it is faithful.
        "auc_by_window": {20: 0.928, 25: 0.915, 30: 0.907, 40: 0.891,
                          50: 0.870, 60: 0.850, 80: 0.811, 100: 0.750},
        "shape": "MONOTONICALLY DECREASING across the whole swept range. 50 "
                 "sits 0.059 below the sweep's best, on the DESCENDING LIMB "
                 "-- it is a SLOPE, not a plateau, and nothing here licenses "
                 "the sentence 'the window does not matter'. Paired "
                 "bootstrap over the same items, 2000 draws: AUC(w=40) - "
                 "AUC(w=50) = +0.021 [+0.009, +0.034], CI excluding zero.",
        "flat_fpr_is_a_tautology": (
            "The song profile's held-out mattr false-positive rate is FLAT "
            "across a 10x change in window -- median 5.08-5.43% over windows "
            "20 to 200, 200 author-held-out seeds each (5.10 / 5.09 / 5.32 / "
            "5.43 / 5.33 / 5.24 / 5.08 at 20/25/40/50/60/100/200; the "
            "window-50 reading is the shipped 5.43) -- and that flatness is "
            "NOT evidence that the window is unimportant. It is a tautology "
            "of percentile calibration: the threshold is the 5th percentile "
            "of the same recomputed statistic, so ~5% of held-out items fall "
            "below it whatever the window is. A reader who concludes 'FPR "
            "flat therefore window inconsequential' has read the "
            "calibration RULE and not the data. What moves under the flat "
            "rate is WHICH items: +/-10 tokens of window changes 13-16% of "
            "the flagged set (Jaccard 0.869 at w=40, 0.840 at w=60; 13.1% "
            "and 16.0% of the union changes hands, on 92-93 flagged items "
            "with the cut itself moving 0.7529 -> 0.7226 -> 0.6959). The "
            "rate is stable; the accusations are not. And below window 25 "
            "the calibrated BAND itself moves -- window 20 makes the band "
            "rule return 100-350 (2,953 items, 132 authors) instead of "
            "150-400 (1,859, 108), so every threshold there is a percentile "
            "of a DIFFERENT population. 25 through 100 all return the "
            "shipped band."),
        #: THE CONSTRAINT NOBODY HAD WRITTEN DOWN, and the one most worth
        #: having. `_mattr` falls back to plain TTR when `len(words) <=
        #: window`, so a window is admissible only if EVERY item in a
        #: profile's calibration set falls on the SAME side of that branch.
        #: Otherwise one profile reports a mixture of two statistics under a
        #: single threshold -- the defect doctrine 15 names.
        "admissible": "[1,22] union [40,93]",
        "admissible_measured": (
            "Calibration-set token ranges, measured 2026-08-14: section "
            "quatrains 23-40 (456 human, 120 generated), sonnets 94-133 "
            "(152 human, 40 generated), song band 150-400 (1,859 items). "
            "Homogeneity per profile therefore admits [1,22] u [40,+inf) "
            "for section, [1,93] u [133,+inf) for sonnet, [1,149] u "
            "[400,+inf) for song. The intersection is [1,22] u [40,93] u "
            "[133,149] u [400,+inf) -- and the last two branches are "
            "DEGENERATE: at 133 and above the sonnet profile has collapsed "
            "to plain TTR too, so 'MATTR' has stopped being a moving "
            "average anywhere the gate measures it. The usable admissible "
            "set is [1,22] u [40,93]. 50 is inside it. 25, 30, 38, 39 and "
            "100 are NOT. A naive retune toward the AUC gradient -- which "
            "points DOWN, at 20 -- that stopped at 25 or 30 would land on "
            "an inadmissible value and nothing in this codebase would have "
            "said so."),
        #: THE LIVE DEFECT THE SWEEP FOUND, recorded next to the number that
        #: caused it rather than in a changelog. See the `section` profile's
        #: own note for the corrected label.
        "section_profile_is_plain_ttr": (
            "At window 50 ALL 456 human quatrains (and all 120 generated "
            "ones) satisfy `len(words) <= window`, so the `section` "
            "profile's `mattr_min` 0.7568 and its AUC 0.776 are PLAIN TTR "
            "with zero moving windows behind them. Measured: plain TTR over "
            "the same items gives 5th percentile 0.7567567568 and AUC "
            "0.7755573830, i.e. the shipped figures exactly. Both are FROZEN "
            "for every window >= 40 (the longest quatrain is 40 tokens), so "
            "no window at or above the shipped one can move them. The "
            "profile is labelled MATTR; its note now says TTR."),
        "kept_because": (
            "DOCTRINE 19, not inconsequence. The honest sentence is: the "
            "shipped value costs ~0.06 AUC against the sweep's best and is "
            "kept because an in-sample argmax is not a calibration. The "
            "sweep's peak is read off the SAME 152-vs-40 corpus that "
            "reports the AUC, so window 20 is an in-sample optimum with no "
            "held-out standing; moving there would also be a threshold "
            "change with no calibration behind the new number (doctrine "
            "58). Window size is additionally a GENRE question -- 20 tokens "
            "is about two lines of English verse, 50 about five -- and "
            "doctrine 6 says a number like that belongs in a declaration "
            "rather than in a constant. Hence: declared, priced, unmoved. "
            "Any future move must be argued, repinned with its date, and "
            "land inside [1,22] or [40,93]."),
        "pinned_by": ("quality/test_discriminate.py PINNED['abs_exp1']"
                      "['features']['mattr'] and PINNED['abs_exp2']"
                      "['features']['mattr']; quality/test_floor.py's song "
                      "percentile dict; quality/song_profile_calibration.py "
                      "--check. Not one of the four NAMED the window before "
                      "2026-08-14; each carries a comment saying so now, and "
                      "`--check` additionally judges the window's "
                      "admissibility at the song band."),
    },
    #: Three results that contradict what this module was built expecting.
    #: Kept in the block that report() prints, not in a changelog.
    "failed_expectations": (
        "UNIFORM_LINE_LENGTH was built on the assumption that metronomic "
        "lines are a generated-text tell. Measured, it is BACKWARDS: "
        "Shakespeare's sonnets are MORE uniform than the model's (AUC 0.350). "
        "In a fixed form uniformity is the form. The check is retained as a "
        "calibrated 'outside the human range' note and must NOT be cited as "
        "slop evidence. || ANAPHORA_OVERLOAD was never pre-registered and "
        "separates at |0.853|, third-best here; being unregistered it is a "
        "post-hoc finding and needs its own replication. || "
        "PREDICTABLE_RHYME was this project's candidate universal and is not "
        "one. Cold, the predictability-only joint reaches 0.648 on "
        "human-vs-generated against 0.960 for the ten-feature joint on the "
        "same split: a real but weak separator, carried by stronger features. "
        "It stays a NOTE and may not reject (doctrine 7). REPINNED 2026-08-14 "
        "-- this read 'reproduced its own withdrawal: 0.560, chance', which "
        "was a warm reading and does not reproduce cold; the module docstring "
        "carries the supersession. || "
        "REPEAT_IN_VERSE's refrain licence was carried as impossible to "
        "calibrate -- 'this project has no corpus of radif verse' -- while "
        "corpus/song/eng_* sat in the repository with 1,859 items inside this "
        "profile's own token band. MEASURED 2026-08-14: at the declared 0.50, "
        "54 of the 57 items carrying a real repetend are REFUSED the licence, "
        "a 94.7% false-positive rate on canonical human verse against the ~5% "
        "the five percentile thresholds hold to. Worse, the cut is anti"
        "-correlated with its own target: it admits two one-word runs and "
        "charges every repetend of three words or more, Burns's six-word "
        "\"a health to them that's awa\" at 4 of 20 pairs included. Density "
        "does not separate refrain from coincidence (0.1292 vs 0.1417 "
        "median) and neither does "
        "run length (FPR 70.2/82.5/86.0% at >= 2/3/4 words). The value is NOT "
        "repinned -- nothing measured supports a replacement -- and the "
        "unlicensed case is a NOTE from that date, so it discloses rather "
        "than fails (doctrine 22/16/58). "
        "REPINNED 2026-08-14 from ~~1,872 items, 43 of 46 refused, 93.5% FPR, "
        "density 0.125 vs 0.150, run-length FPR 60.9/73.9/78.3%~~ -- the "
        "figures commit d362b9e recorded the same day, none of which "
        "reproduces. This module contradicted itself twelve lines apart the "
        "whole time: the `song` Profile below declares n_human=1859 and its "
        "own `source=` says '1,859 items over 108 authors'. 1,872 IS "
        "reachable, two ways, and NEITHER is this band -- hi=405 instead of "
        "400, or a whitespace `.split()` token count instead of "
        "QualityFeatures._tokens -- and under BOTH the carrier counts stay "
        "57/54/94.7%. Re-derived at head and again against the tree AS OF "
        "d362b9e -- corpus, `_tokens` and `_strip_radif` byte-identical to "
        "that commit -- so the record was wrong when it was written, not "
        "drifted since. THE FINDING IS UNCHANGED AND SHARPER -- the "
        "false-positive rate went UP, so nothing here is retuned to recover "
        "the old number (doctrine 58)."
    ),
}


@dataclass
class Profile:
    """One calibrated length domain.

    `lo`/`hi` are the human class's 5th/95th token counts at this unit. Text
    outside every profile's [lo, hi] gets no length-sensitive finding at all —
    the gate says which checks it skipped and why, rather than extrapolating a
    threshold to a length it was never measured at.
    """
    name: str
    unit: str
    lo: int
    hi: int
    n_human: int
    n_generated: int
    percentiles: dict
    #: separation against a GENERATED class. Empty where no such class exists,
    #: and then `held_out_fpr` is the only evidence the profile has. The two
    #: are different claims and the finding text says which one it is holding.
    measured_auc: dict
    note: str = ""
    #: how far outside [lo, hi] the profile may still be applied, as a
    #: multiplier. Inside the band but outside the range, every finding is
    #: DOWNGRADED to a note: an extrapolated measurement may not reject.
    #:
    #: 2.0 is what the first two profiles shipped with and it is a constant
    #: nobody measured -- it appears in no results document. Measured for the
    #: first time on 2026-08-11 against the song corpus: carrying the 150-400
    #: thresholds out to 2.0x raises the union false-positive rate from 20.79%
    #: (17.66% at the four checks this was first measured against) to 26.33%
    #: and every single check with it. The `song` profile therefore declares
    #: 1.25 (23.12%, 19.36% at four) and the other two keep 2.0 because
    #: re-measuring them needs the sonnet classes and that was not this cell's
    #: to move.
    tolerance: float = 2.0
    #: what text the percentiles were read off, and how they were held out.
    source: str = ""
    #: {check: (median, seed_5th, seed_95th)} as PERCENTAGES, on held-out
    #: human text. This is the doctrine-22 statement of the threshold; a
    #: percentile on a scale is not one.
    held_out_fpr: dict = field(default_factory=dict)

    def band(self):
        return int(self.lo / self.tolerance), int(self.hi * self.tolerance)

    def covers(self, n):
        return self.lo <= n <= self.hi

    def reaches(self, n):
        a, b = self.band()
        return a <= n <= b

    def evidence_for(self, key):
        """One phrase naming what this profile's threshold for `key` rests on.

        A profile with a generated class can quote a separation. A profile
        without one may only quote how often it fires on held-out human text,
        and has to say that it is the weaker claim -- otherwise a reader
        carries "AUC 0.870" over to a profile that never measured anything of
        the kind.
        """
        auc = self.measured_auc.get(key)
        if auc is not None:
            return "AUC %s against the generated class at this length" % auc
        f = self.held_out_fpr.get(key)
        if f is None:
            return ("no separation and no false-positive rate measured at "
                    "this length")
        return ("NO generated class exists at this length, so there is no "
                "AUC and no separation claim; the evidence is a false-positive "
                "rate of %.2f%% on HELD-OUT human song (5th-95th percentile of "
                "seeds %.2f-%.2f%%). It says how often this fires on a human "
                "songwriter, not whether it catches a machine" % f)


#: ~~Both profiles~~ THE TWO STANZA PROFILES come from the SAME two classes --
#: the 152 sonnets and the 40 generated ones -- measured at two units. The
#: section profile takes the three quatrains of each sonnet (lines 1-4, 5-8,
#: 9-12), which is the closest thing to a song section that this corpus
#: contains. The THIRD profile (`song`, added 2026-08-11) is a different kind
#: of calibration and says so in its own block below; this comment said
#: "both" for ten days after the list stopped having two members (L-4,
#: closed 2026-08-21 on exactly that staleness).
PROFILES = [
    Profile(
        name="section", unit="4-line quatrain, 29-37 tokens",
        lo=29, hi=37, n_human=456, n_generated=120,
        percentiles={
            # PLAIN TTR, NOT MATTR. Kept under the key `mattr_min` because
            # that is the key `resolve()` and every caller reads, and
            # renaming it would silently stop LEXICAL_MONOTONY running at
            # this length. The VALUE is unchanged and the label is corrected
            # in the note below; `CALIBRATION["mattr_window"]` carries the
            # measurement.
            "mattr_min": 0.7568,                # human 5th -- a TTR 5th
            "function_word_ratio_max": 0.5161,  # human 95th
            "anaphora_max": 0.5000,             # human 95th
            "line_length_cv_min": 0.0525,       # human 5th
        },
        measured_auc={"mattr": 0.776,           # ALSO a plain-TTR AUC
                      "function_word_ratio": 0.207,
                      "anaphora": 0.245, "line_length_cv": 0.424},
        note="THE `mattr` FIGURES IN THIS PROFILE ARE PLAIN TTR, NOT MATTR "
             "-- corrected 2026-08-14, values unchanged. At the declared "
             "window (FloorDeclaration.mattr_window = 50) every one of the "
             "456 human quatrains and all 120 generated ones satisfies "
             "`len(words) <= window`, so `_mattr` returns a single "
             "type/token ratio and NOT ONE moving window is taken. Measured: "
             "plain TTR over the same items gives a 5th percentile of "
             "0.7567567568 and an AUC of 0.7755573830 -- the 0.7568 and "
             "0.776 above, exactly. Both are FROZEN for every window >= 40, "
             "the longest quatrain here being 40 tokens, so no window at or "
             "above the shipped one can move them and this profile is blind "
             "to the coordinate by construction. The threshold and the items "
             "it judges degenerate the SAME way, so the gate compares like "
             "with like at this length -- what may not be done is quoting "
             "0.7568 beside the sonnet or song profiles' MATTR figures, "
             "which are genuine moving averages. "
             "Quatrains from one sonnet are NOT independent, so the n above "
             "overstates the evidence: the effective sample is 152 vs 40. AUCs "
             "here are quatrain-level; averaged to poem level they come to "
             "0.872 / 0.119 / 0.091 / 0.358, i.e. the separation is real at "
             "poem level and weaker at the unit the gate actually judges. "
             "PREDICTABLE_RHYME is absent from this profile because its "
             "threshold was never measured at this length, so it does not run "
             "here rather than borrowing the sonnet cut."),
    Profile(
        name="sonnet", unit="14-line sonnet, 108-126 tokens",
        lo=108, hi=126, n_human=152, n_generated=40,
        percentiles={
            "mattr_min": 0.7557,
            "function_word_ratio_max": 0.4788,
            "anaphora_max": 0.2857,
            "line_length_cv_min": 0.0939,
            "predictable_pair_fraction_max": 0.8333,
        },
        measured_auc={"mattr": 0.870, "function_word_ratio": 0.135,
                      "anaphora": 0.147, "line_length_cv": 0.350,
                      "predictability": 0.440},
        note="The domain the ten pre-registered features were run on."),
    Profile(
        name="song", unit="whole lyric sheet, 150-400 tokens",
        lo=150, hi=400, n_human=3571, n_generated=0,
        tolerance=1.25,
        #: ADOPTED 2026-08-21 over the loaded corpus, as a SET. The three
        #: that moved are struck beside their replacements; the two that did
        #: not are the reason the set could be adopted at all -- see `source=`.
        #:
        #: REPINNED 2026-08-22, `mattr_min` ONLY: 0.7128 -> 0.7118, and the
        #: cause is a READER FIX rather than a load. `features.py._tokens`
        #: matched `[A-Za-z'\-]+` until 2026-08-21, so Barnes's `A-baggèn`
        #: was TWO tokens and `jaÿ` was one letter short -- MATTR is a
        #: type-token ratio and it was being computed over a text nobody
        #: printed. `lyric_harness.LATIN_SCRIPT` is the declared repertoire
        #: now; the eng token total falls 1,873,325 -> 1,865,465 (-0.420%) as
        #: fragments merge back into the words they came from, and the 5th
        #: percentile of the band moves with it.
        #:
        #: THE OTHER FOUR ARE UNMOVED, which is what makes this a repin of one
        #: coordinate rather than a re-adoption of the set: `fwr` 0.4773,
        #: `anaphora` 0.3000, `cv` 0.1094 and `predictable_pair` 0.9286 all
        #: re-derive exactly. MATTR is the only one of the five that counts
        #: TYPES, so it is the only one a tokenisation change can move.
        #:
        #: AND NO TEST SAW IT. `test_floor.py` pins the CONSTANT and passed;
        #: `test_discriminate.py` passed; the held-out AUCs are unmoved. It
        #: was found by `quality/pin_sweep.py` -- `MISSING.md` M-21's answer,
        #: built the same day -- on its first full run, through
        #: `expected_drift.py`, whose own words are "Either argue and declare
        #: it here, or repin the constant." This is the repin: the corrected
        #: reader gives the true MATTR of this corpus, so the constant moves
        #: rather than the drift being ruled.
        percentiles={
            "mattr_min": 0.7118,                # human 5th  (~~0.7226~~ ~~0.7128~~)
            "function_word_ratio_max": 0.4773,  # human 95th (~~0.4716~~)
            "anaphora_max": 0.3000,             # human 95th (unmoved)
            "line_length_cv_min": 0.1094,       # human 5th  (~~0.1123~~)
            "predictable_pair_fraction_max": 0.9286,  # human 95th (unmoved)
        },
        #: EMPTY ON PURPOSE. There is no generated song class in this repo, so
        #: there is no separation to report and this profile may not borrow the
        #: sonnet's. `held_out_fpr` is what it has instead.
        measured_auc={},
        held_out_fpr={
            # (median, 5th percentile of seeds, 95th percentile of seeds)
            #: REPINNED 2026-08-21 with the thresholds, because these are
            #: measured THROUGH them: an FPR tuple kept from the old cuts
            #: would describe how often thresholds that no longer ship
            #: interrupt a corpus that no longer exists. Old values struck
            #: below each. Author-held out, 200 seeds, 50/50, unchanged.
            "mattr": (5.02, 2.90, 8.32),          # ~~(5.43, 1.51, 11.07)~~
            "function_word_ratio": (5.04, 3.18, 7.83),  # ~~(5.23, 1.86, 10.64)~~
            "anaphora": (4.89, 3.01, 7.49),       # ~~(5.01, 1.44, 11.15)~~
            "line_length_cv": (5.11, 3.70, 6.56),  # ~~(5.13, 3.04, 7.81)~~
            "predictability": (4.93, 3.26, 6.46),  # ~~(4.81, 2.52, 7.43)~~
            "ANY": (19.71, 15.03, 25.05),         # ~~(20.79, 12.57, 29.43)~~
            #: NOT one of the five, and NOT inside "ANY". CLICHE_PAIR is
            #: length-INDEPENDENT -- it borrows no percentile from this
            #: profile and the band is not what makes it fire. What the band
            #: gives it is the only population its interruption rate was ever
            #: measured on, which is why it may only REJECT here (see `sev()`
            #: in `check()`). Same protocol as the five above: author-held
            #: out, 200 seeds, 50/50. Point estimate 239/3571 = 6.69%
            #: (~~118/1859 = 6.35%~~). MEASURED 2026-08-14, REPINNED
            #: 2026-08-21. The Wilson CI [5.33, 7.55] and author-cluster
            #: bootstrap 6.20% [4.02, 9.10] were computed on the 1,859-item
            #: band and are NOT re-derived by the runner, so they are left
            #: naming that population rather than carried forward as if they
            #: described this one (doctrine 20).
            #:
            #: "ANY" IS NOT RESTATED FOR IT. The union above is over the five
            #: length-sensitive checks and stays that, because those five are
            #: what the band rule, the tolerance and every threshold here were
            #: chosen against; folding a sixth in would silently redefine the
            #: one number this profile's note quotes as "one human song in
            #: five trips something".
            "cliche": (6.71, 5.37, 7.94),  # ~~(6.36, 4.23, 8.37)~~
        },
        source="corpus/song/eng_*.txt: 1,297 files, 1,294 distinct authors, "
               "8,667 `--- TITLE:` items, 283,534 sung lines. Restricted to "
               "items of 150-400 tokens: 3,571 items over 879 authors. "
               "Thresholds are the 5th/95th percentile of that human class, "
               "held out BY AUTHOR (50/50, 200 seeds). ADOPTED 2026-08-21, "
               "superseding ~~143 files, 4,930 items, 152,325 sung lines, "
               "1,859 items over 108 authors~~ (2026-08-11). THE SET WAS "
               "ADOPTED TOGETHER, AND THAT IS WHY IT WAITED: three thresholds "
               "moved and two did not, and the two that did not are the ones "
               "that made it safe -- `predictable_pair_fraction_max` "
               "re-derives to 0.9286 against a shipped 0.9286, and "
               "`anaphora_max` to 0.3000 against 0.3000. Repinning the three "
               "while the fifth still described the 143-file corpus would "
               "have made this profile half a description of one corpus and "
               "half of another (doctrine 1), which is exactly why the "
               "closing sitting was deferred until the predictability arm "
               "was banked rather than skipped.",
        note=(
            "READ THIS BEFORE QUOTING ANY NUMBER FROM IT.\n"
            "  * It is NOT a separation. The other two profiles separate 152 "
            "Shakespeare sonnets from 40 model sonnets and can quote an AUC. "
            "This one has no generated song class, so it has no AUC and makes "
            "no claim to catch generated text. It only says how often it "
            "interrupts a human songwriter: per check 4.89-5.11% median, and "
            "19.71% for the UNION of the five (5th-95th percentile of seeds "
            "15.03-25.05%). One human song in five trips something. (Four "
            "checks alone put the union at 16.81% [12.86-21.47]; the rise to "
            "19.71% is PREDICTABLE_RHYME joining the union below, not corpus "
            "drift -- a fifth check can only raise a union rate, never lower "
            "one, and it did not: 16.81 -> 19.71 on the loaded corpus exactly "
            "as 17.66 -> 20.79 on the 143-file one.) REPINNED 2026-08-21 from "
            "~~4.8-5.4% per check, 20.79% union [12.57-29.43], four-check "
            "17.66% [10.78-25.58]~~.\n"
            "  * The band was chosen by a rule declared before it was read "
            "off: the widest contiguous token range in which every 50-token "
            "sub-bin holds >=100 items and every sub-bin threshold sits within "
            "0.02 (0.03 for anaphora) of the band-wide one. 150-400 is what "
            "that rule returns. It was not widened to admit any particular "
            "lyric, and 100-400 and 150-450 both FAIL it -- on mattr, whose "
            "5th percentile runs 0.6400 at 50-80 tokens to 0.7719 at 700-1200 "
            "and is only flat above ~150.\n"
            "  * PERIOD. The corpus is pre-1931 by construction; latest birth "
            "1872, latest death 1929 in the 108-author calibration "
            "population. THIS BULLET USED TO READ that ANAPHORA has a real "
            "period slope inside that window -- author-level Spearman +0.275 "
            "against birth year, p_perm 0.0042 over 10,000 label permutations "
            "at seed 20260811, surviving Bonferroni over the five checks "
            "(cuts at 0.0100) -- and that this is a THIRD feature caught "
            "reading period rather than quality (doctrine 11). WITHDRAWN "
            "2026-08-20: re-derived over 407 dated authors against the "
            "original 108 it is rho -0.008, p_perm 0.8695. ABSENT and "
            "sign-flipped, not weaker, so the caution is withdrawn rather "
            "than softened, and the struck figure is kept legible rather "
            "than deleted (doctrine 17). NEITHER OF THESE IS CLAIMED: the "
            "re-derivation drops 472 of 879 in-band authors as UNDATED and "
            "they are not missing at random, so it is a failure to reproduce "
            "on a biased 46% subsample and not a clean bill; and `mattr` "
            "(-0.228 -> -0.125) and `fwr` (+0.090 -> +0.144) DO survive "
            "Bonferroni now, so the period reading relocated rather than "
            "left -- and the same caveat is why they are not adopted either. "
            "PREDICTABLE_RHYME is not a fourth: rho -0.018, p_perm 0.8572, "
            "does not survive, so the fifth check reads no period signal at "
            "all in this band. Cross-cohort "
            "threshold transfer fails asymmetrically: fitted on earlier-born "
            "authors it over-flags later-born ones (function-word ratio "
            "12.39% against a cohort-permutation null median of 5.17%, mattr "
            "10.62% against 4.92%), and the reverse direction sits at or below "
            "nominal. Neither survives Bonferroni over the eight cross-cohort "
            "comparisons, so it is a direction and not a finding -- but a "
            "2026 lyric is further along that axis than any author here, and "
            "the only measured gradient points at a HIGHER false-positive rate "
            "there.\n"
            "  * The unit is the WHOLE SHEET with any [VERSE n] / [CHORUS] "
            "marker line removed, which is how the corpus items were counted. "
            "A refrain printed twice is INSIDE the calibration, so a chorus "
            "that repeats does not by itself cost anything here. That also "
            "means these thresholds may not be applied to one section of a "
            "sheet: for that, the section profile, at its own length.\n"
            "  * PREDICTABLE_RHYME NOW RUNS AT SONG LENGTH, calibrated "
            "2026-08-13 against the frequency source this project swapped to "
            "on 2026-08-11 (data/opensubtitles_en_50k.tsv, via "
            "`lyric_harness.Lexicon.freq_rank`) -- the gap this profile used "
            "to carry, closed rather than left absent (doctrine 58 the other "
            "direction). Threshold 0.9286 (human 95th percentile of the "
            "obvious-pair fraction), held-out FPR 4.81% median [2.52-7.43%]. "
            "It shows no period slope in this band (rho -0.018, p_perm "
            "0.8572, does not survive Bonferroni) -- unlike anaphora, it is "
            "not a second feature caught reading period rather than quality "
            "here. Still absent from the section profile, which never "
            "measured a threshold at that length and is a different cell's "
            "to move.\n"
            "  * The 5th/95th percentiles are ITEM-weighted, and the band is "
            "not evenly authored -- Watts is 15.3% of it, and the top five "
            "authors are 51.7%. Leave-one-author-out moves the thresholds by "
            "at most 0.0052 (mattr), 0.0018 (fwr), 0.0172 (anaphora), 0.0013 "
            "(cv). An author-weighted alternative -- one median per author, "
            "n=108 -- gives 0.7262 / 0.4801 / 0.2679 / 0.1194, so the two "
            "disagree most on anaphora. Item-weighted ships because the rate "
            "the gate delivers is an item rate."),
    ),
]

CALIBRATION["profiles"] = {p.name: p for p in PROFILES}


def declaration_for(n_tokens):
    """Pick the calibrated profile for a text of `n_tokens`.

    Returns (profile, exact). `exact` is False when the length is inside a
    profile's tolerance band but outside its measured range — findings are
    downgraded to notes in that case. Returns (None, False) when no profile
    reaches the length at all, and the gate then runs only the checks that do
    not depend on length.
    """
    for p in PROFILES:
        if p.covers(n_tokens):
            return p, True
    reach = [p for p in PROFILES if p.reaches(n_tokens)]
    if not reach:
        return None, False
    # Nearest MEASURED EDGE, not nearest midpoint. The midpoint rule was fine
    # while the two profiles were narrow and far apart, and it broke as soon as
    # a third one was added with a 250-token range: at 149 tokens it chose the
    # sonnet, extrapolating 23 tokens past a measured 126, over the song
    # profile whose measured range starts at 150. What is being minimised here
    # is the SIZE OF THE EXTRAPOLATION, so that is what the rule should read.
    def gap(p):
        return p.lo - n_tokens if n_tokens < p.lo else n_tokens - p.hi
    return min(reach, key=lambda p: (gap(p), p.hi - p.lo)), False


@dataclass
class Finding:
    code: str
    severity: str            # "flag" | "note"
    message: str
    evidence: str
    locations: list = field(default_factory=list)

    def __str__(self):
        loc = f" (lines {', '.join(map(str, self.locations))})" if \
            self.locations else ""
        return f"[{self.severity.upper():4}] {self.code}: {self.message}{loc}\n" \
               f"         {self.evidence}"


@dataclass
class FloorDeclaration:
    """Thresholds, declared so a disagreement lands in a coordinate.

    A field left at None takes the value the matching PROFILE measured, so the
    defaults assert nothing. Set one to override the measurement, and the
    disagreement is then located in a coordinate rather than argued at large.

    Three of these were once hand-estimated in this file, and the calibration
    run moved all three a long way — every time in the direction that makes
    the gate quieter:

        mattr_min                      0.80 guessed -> 0.7557 measured
        predictable_pair_fraction_max  0.40 guessed -> 0.8333 measured
        line_length_cv_min             0.12 guessed -> 0.0939 measured

    The guessed values would have flagged roughly half of Shakespeare for
    lexical monotony and about 60% of him for predictable rhyme. An
    uncalibrated floor does not fail safe; it fails loud, and it fails in the
    direction that confirms whoever guessed.

    `predictability_max` is the one number that is not a percentile. It
    defines what counts as "obvious" inside a candidate field — an axis, not a
    cut — so it has a real default.

    `mattr_window` is the second, added 2026-08-14, and it was a bare default
    in `features.QualityFeatures._mattr` until then — undeclared, unswept,
    unquoted, and not passed by any of its four call sites. It is declared
    here at the value it always had; nothing moved. What is new is that the
    number is now a coordinate, and that
    `CALIBRATION["mattr_window"]` prices it: the sweep is a monotone SLOPE
    rather than a plateau, the flat false-positive column that looks like
    reassurance is a tautology of percentile calibration, and only
    [1,22] u [40,93] keeps a profile's calibration set on one side of the
    plain-TTR fallback. The shipped 50 costs ~0.06 AUC against the sweep's
    best and is kept because an in-sample argmax is not a calibration
    (doctrine 19).
    """
    mattr_min: float = None
    function_word_ratio_max: float = None
    anaphora_max: float = None
    line_length_cv_min: float = None
    predictable_pair_fraction_max: float = None
    predictability_max: float = 0.90
    #: What share of an item's rhyme pairs a repetend must close before it is
    #: read as a radif rather than as repeated rhyme words. A count alone will
    #: not do — two of thirty-one pairs ending in "it" is coincidence, two of
    #: two is a refrain.
    #:
    #: ~~Also definitional: this project has no corpus of radif verse to
    #: calibrate it against, and guessing a number and calling it measured is
    #: the error the rest of this module exists to avoid.~~
    #:
    #: STRUCK 2026-08-14, AND THE PREMISE WAS FALSE. The corpus was in the
    #: repository the whole time — `corpus/song/eng_*`, 1,859 items inside
    #: this profile's own 150-400 token band, the same population four of the
    #: five thresholds above were calibrated on. Nobody ran it. Measured now:
    #: 57 of those items carry a repetend closing >= 2 pairs, and 0.50 refuses
    #: to license 54 of the 57 — a 94.7% FPR on canonical human verse against
    #: the ~5% its siblings hold to. Density does not separate refrain from
    #: coincidence (one-word runs median 0.1292, multi-word refrain tails
    #: 0.1417), and licensing on run length instead only reaches 70.2% / 82.5%
    #: / 86.0% at >= 2 / 3 / 4 words. No cut on either axis reaches 5%.
    #:
    #: REPINNED 2026-08-14 from ~~1,872 items, 46 carriers, 43 refused, 93.5%
    #: FPR, density 0.125 / 0.150, run-length FPR 60.9 / 73.9 / 78.3%~~ --
    #: commit d362b9e's own figures, re-derived by three independent runs and
    #: reproduced by none of them. The protocol every figure above depends on,
    #: stated so a disagreement lands in a coordinate (doctrine 1):
    #:   * POPULATION `song_profile_calibration.items_in` over
    #:     corpus/song/eng_*.txt, non-empty bodies, 4,930 items.
    #:   * BAND 150 <= n <= 400 with n = sum(len(QualityFeatures._tokens(l))),
    #:     the profile's own tokenizer -> 1,859. `.split()` gives 1,872 at the
    #:     same bounds and `_tokens` gives 1,872 at hi=405; both are why the
    #:     stale number looked plausible, and under BOTH the carrier counts
    #:     stay 57 / 54 / 94.7%.
    #:   * PAIRING `SlopFloor._pairs`' mandate-less fallback, adjacent
    #:     couplets. Reading every adjacent pair instead gives 96 / 95.
    #:   * CARRIER an ITEM holding a repetend that closes >= 2 pairs.
    #:     Counted per REPETEND instead: 64 / 61 = 95.3%.
    #:   * DEDUP none (by body: unchanged; by title: 55 / 52).
    #: 46 / 43 / 93.5% IS reachable -- at lo=150, hi=330..349, and at bands
    #: like 56-222 -- and at NONE of them does the rest of the record follow;
    #: over every band lo in 1..800, hi in lo..3000 there is no band at all
    #: that returns 46 / 43 together with the recorded run-length profile.
    #: THE FINDING IS UNCHANGED AND THE RATE WENT UP. Nothing below is tuned
    #: to bring 93.5% back, which is the same doctrine 58 that keeps 0.50.
    #:
    #: THE VALUE IS DELIBERATELY NOT MOVED. Nothing measured supports a
    #: replacement, and repinning to a number that merely looks better is
    #: doctrine 58's error. What changed instead is that the unlicensed case
    #: is now a NOTE rather than a flag, so the cut discloses instead of
    #: failing a writer — see `_relation_findings`. The threshold stays
    #: definitional; what is no longer true is that it could not be priced.
    radif_min_pair_fraction: float = 0.50
    #: The stock rhyme-pair list CLICHE_PAIR tests membership against.
    #:
    #: DOCTRINE 1, and it is the reason this field exists at all: every other
    #: threshold this gate applies was a coordinate a caller could disagree
    #: IN. This one was a module-level constant in `lyric_harness.py` with no
    #: field anywhere, which made it the only floor threshold that was not a
    #: declared coordinate — a disagreement about it had nowhere to land but
    #: an argument at large, which is the shape doctrine 1 exists to abolish.
    #:
    #: DEFINITIONAL, like the two above and more plainly than either: it is
    #: not a cut on a scale, it is the EXTENSION of the word. There is no
    #: percentile to move and no direction to move it in — the only thing
    #: that can be disagreed with is which pairs are on it. A genre with its
    #: own stock rhymes states them here rather than arguing with a list typed
    #: for English pop.
    #:
    #: THE DEFAULT IS THE SHIPPED 30, and the shipped 30 are what carry the
    #: measured 6.35% in-band false-positive rate (song profile,
    #: `held_out_fpr["cliche"]`). A caller who replaces the set replaces that
    #: measurement with it and inherits an UNCALIBRATED list: the rate is a
    #: property of THIS set on THIS corpus, not of the membership test. The
    #: finding says so on its face, so a swapped list cannot quietly borrow
    #: the number.
    cliche_pairs: frozenset = field(
        default_factory=lambda: frozenset(CLICHE_PAIRS))
    #: MATTR's moving-average window, in TOKENS. Definitional in the same
    #: sense `predictability_max` is — it states what the statistic IS, so
    #: moving it moves what every `mattr_min` percentile above is a
    #: percentile OF, and a `mattr_min` measured at one window may not be
    #: compared against a MATTR computed at another. NOT definitional in the
    #: sense of "harmless": see `CALIBRATION["mattr_window"]` for the sweep,
    #: for the admissible set [1,22] u [40,93] that any future move must land
    #: inside, and for why 50 is kept rather than retuned toward the gradient.
    #:
    #: It is NOT resolvable from a profile: `resolve()` serves the four
    #: percentile fields, and a window is not a percentile of anything, so no
    #: profile carries one. That is deliberate — a per-profile window would
    #: mean two profiles reporting two different statistics under the one
    #: name `mattr`, which is exactly the mixture this coordinate exists to
    #: keep out of a single profile.
    mattr_window: int = 50

    def resolve(self, key, profile):
        """Override if set, else the profile's measurement, else None -- and
        None means the check does not run at this length."""
        v = getattr(self, key, None)
        if v is not None:
            return v
        return profile.percentiles.get(key) if profile else None


class SlopFloor:

    def __init__(self, decl=None, qf=None):
        self.decl = decl or FloorDeclaration()
        # The DECLARATION owns the window, not this feature extractor: a
        # caller may hand in a shared `QualityFeatures` (test_floor.py does),
        # and stamping the declaration's window onto it would silently move
        # the other holder's statistic. So the window travels per call in
        # `check()` instead, and this only sets the default for a `qf` this
        # constructor builds itself.
        self.qf = qf or QualityFeatures(
            mattr_window=self.decl.mattr_window)

    # -- individual checks ------------------------------------------------

    def _anaphora(self, lines):
        """Share of lines opening with the most frequent opening word.

        The tie break is FIRST OCCURRENCE, and that is not cosmetic. This read
        `max(set(firsts), key=firsts.count)` until 2026-08-11, and iterating a
        set of strings is iterating a hash order that Python randomises per
        process: on a four-line text opening Alpha/Beta/Alpha/Beta the RATE was
        a stable 0.5 and the reported word alternated between 'alpha' and
        'beta' across `PYTHONHASHSEED` 0-5, taking the finding's `locations`
        with it. A tie broken by iterating a set is a result that does not
        reproduce (doctrine 66) -- and here it was the evidence and the line
        numbers, i.e. exactly the part a writer acts on.
        """
        firsts = [(l.split() or [""])[0].lower().strip(",.;:!?—-")
                  for l in lines]
        if not firsts:
            return 0.0, ""
        first_at = {}
        for i, w in enumerate(firsts):
            first_at.setdefault(w, i)
        top = min(firsts, key=lambda w: (-firsts.count(w), first_at[w]))
        return firsts.count(top) / len(firsts), top

    @staticmethod
    def _line_length_cv(lines):
        n = [len(l.split()) for l in lines]
        if not n:
            return 0.0
        m = statistics.mean(n)
        return (statistics.pstdev(n) / m) if m else 0.0

    # -- the gate ---------------------------------------------------------

    def check(self, lines, scheme=None):
        lines = [l for l in lines if l.strip()]
        out = []
        if len(lines) < 2:
            return out
        d = self.decl
        n_tok = sum(len(self.qf._tokens(l)) for l in lines)
        prof, exact = declaration_for(n_tok)

        def sev(default):
            """An extrapolated measurement may not carry a rejection."""
            return default if exact else "note"

        if prof is None:
            out.append(Finding(
                "OUT_OF_CALIBRATED_LENGTH", "note",
                f"{n_tok} tokens is outside every calibrated length; the "
                f"length-sensitive checks did not run",
                f"profiles cover {', '.join(f'{p.name} {p.lo}-{p.hi}' for p in PROFILES)} "
                f"tokens, each with a {PROFILES[0].tolerance:g}x tolerance "
                f"band. MATTR in particular is a moving average over a "
                f"{d.mattr_window}-token window (declared: "
                f"FloorDeclaration.mattr_window) and silently degrades to "
                f"plain type-token ratio below that, so a threshold measured "
                f"at one length is a different statistic at another. "
                f"WHAT DID RUN: "
                f"the relation-level checks (self-rhyme, radif, cliche, "
                f"shared suffix), which read no percentile and do not depend "
                f"on length. Of those, only REPEAT_IN_VERSE can still be a "
                f"FLAG here — a word rhymed with itself is a fact about the "
                f"two lines and needs no calibration. CLICHE_PAIR is a NOTE "
                f"at this length: nothing about the membership test changes, "
                f"but the only false-positive rate it has was measured "
                f"in-band, and out here it runs at 14.74% against that "
                f"6.35% (285 corpus items, 42 firing). RADIF_LICENSED and "
                f"SHARED_SUFFIX are notes at every length"))
            return out + self._relation_findings(
                lines, self._pairs(lines, scheme), sev)
        if not exact:
            a, b = prof.band()
            out.append(Finding(
                "EXTRAPOLATED_LENGTH", "note",
                f"{n_tok} tokens is outside the {prof.name} profile's measured "
                f"range ({prof.lo}-{prof.hi}); every finding below that rests "
                f"on a measurement is downgraded to a note",
                f"applied within the tolerance band {a}-{b}. A threshold read "
                f"off one length distribution is an extrapolation at another, "
                f"and an extrapolation may not reject. WHICH CHECKS THAT "
                f"COVERS, because 'every finding below' was FALSE here until "
                f"2026-08-14 and false in the direction that makes a "
                f"surviving flag look impossible: the five length-sensitive "
                f"checks (LEXICAL_MONOTONY, FUNCTION_WORD_HEAVY, "
                f"ANAPHORA_OVERLOAD, UNIFORM_LINE_LENGTH, PREDICTABLE_RHYME) "
                f"are downgraded, and so is CLICHE_PAIR — not because a "
                f"percentile was extrapolated for it, it has none, but "
                f"because its false-positive rate was only ever measured "
                f"inside the song band and it runs 3.71-7.20% out here "
                f"against 6.35% in it. The relation-level checks all still "
                f"RAN, and REPEAT_IN_VERSE can still be a FLAG: a word "
                f"rhymed with itself is a fact about two lines, calibrated "
                f"against nothing. RADIF_LICENSED and SHARED_SUFFIX are "
                f"notes at every length"))

        # THE WINDOW TRAVELS WITH THE DECLARATION. Without this the threshold
        # would come from the declaration and the statistic from whatever
        # window the `QualityFeatures` instance happened to be built with,
        # which is doctrine 1's failure mode: a declared coordinate silently
        # outranked by another layer's default.
        v = self.qf.extract(lines, scheme, mattr_window=d.mattr_window)

        # 1. lexical monotony -- the strongest single separator observed.
        #    NAME THE STATISTIC THAT WAS ACTUALLY COMPUTED. `_mattr` returns
        #    plain TTR whenever the item is no longer than the window; at the
        #    shipped window that is EVERY item inside the section profile's
        #    measured range. Reporting it as "MATTR" is the label defect the
        #    2026-08-14 window sweep found; see CALIBRATION["mattr_window"].
        stat = "TTR" if n_tok <= d.mattr_window else "MATTR"
        thr = d.resolve("mattr_min", prof)
        m = v.get("mattr")
        if thr is not None and m == m and m is not None and m < thr:
            out.append(Finding(
                "LEXICAL_MONOTONY", sev("flag"),
                "vocabulary repeats more than human verse did in calibration",
                f"{stat} {m:.3f} < {thr:.4f} (human 5th percentile, "
                f"{prof.name} profile); {prof.evidence_for('mattr')}. "
                + (f"THE STATISTIC HERE IS PLAIN TTR, NOT MATTR: {n_tok} "
                   f"tokens does not exceed the declared "
                   f"{d.mattr_window}-token window, so the moving average "
                   f"degenerates to one type/token ratio over the whole "
                   f"item. The {prof.name} threshold was read off items that "
                   f"degenerate the same way, so the comparison is like for "
                   f"like -- but a MATTR quoted from another profile is not "
                   f"the same statistic and may not be compared with it. "
                   if stat == "TTR" else "")
                + f"Caveat: within Shakespeare the direction REVERSES "
                f"(0.366), so a low value is not evidence against a poem, "
                f"only outside the range this corpus occupied"))

        # 2. function-word load
        thr = d.resolve("function_word_ratio_max", prof)
        f = v.get("function_word_ratio")
        if thr is not None and f == f and f is not None and f > thr:
            out.append(Finding(
                "FUNCTION_WORD_HEAVY", sev("flag"),
                "a high share of the text is closed-class filler",
                f"function-word ratio {f:.3f} > {thr:.4f} (human 95th "
                f"percentile, {prof.name} profile); "
                f"{prof.evidence_for('function_word_ratio')}. Null within "
                f"Shakespeare (0.536), so this "
                f"is a register signal with no within-tradition support. "
                f"Presumes a clean function/content split and does not "
                f"transfer to agglutinative or polysynthetic languages"))

        # 3. anaphora -- repeated line openings
        thr = d.resolve("anaphora_max", prof)
        a, word = self._anaphora(lines)
        if thr is not None and a > thr:
            hits = [i + 1 for i, l in enumerate(lines)
                    if (l.split() or [""])[0].lower().strip(",.;:!?—-") == word]
            out.append(Finding(
                "ANAPHORA_OVERLOAD", sev("flag"),
                f"{int(a * len(lines))} of {len(lines)} lines open with the "
                f"same word",
                f"opening {word!r} at {a:.0%} of lines > {thr:.0%} (human 95th "
                f"percentile, {prof.name} profile); "
                f"{prof.evidence_for('anaphora')}. "
                f"POST-HOC: this check was not pre-registered, so it needs its "
                f"own replication before it is trusted"
                + (". PERIOD CAUTION WITHDRAWN 2026-08-20 (doctrine 17): "
                   "this clause used to read that anaphora carries a measured "
                   "PERIOD slope -- author-level Spearman +0.275 against "
                   "birth year, p_perm 0.0042 -- and that part of what it "
                   "reads at this length is WHEN the words were written. "
                   "Re-derived over 407 dated authors against the original "
                   "108, it does not reproduce: rho -0.008, p_perm 0.8695. "
                   "Not weaker, ABSENT and sign-flipped, so the caution is "
                   "withdrawn rather than softened -- on the wider corpus "
                   "this check does not look like it is reading the calendar. "
                   "TWO THINGS THAT ARE NOT CLAIMED: the re-derivation drops "
                   "472 undated authors and they are NOT missing at random, "
                   "so this is a failure to reproduce and not a clean bill; "
                   "and `mattr`/`fwr` DO now carry slopes, so period-reading "
                   "moved rather than left (doctrine 11)"
                   if prof.name == "song" else "")
                + f". Deliberate anaphora is "
                f"a figure — Whitman, the Psalms and every blues refrain trip "
                f"this — so the finding is a decision handed back, not a "
                f"verdict", hits))

        # 4. metronomic line length
        thr = d.resolve("line_length_cv_min", prof)
        cv = self._line_length_cv(lines)
        if thr is not None and cv < thr:
            out.append(Finding(
                "UNIFORM_LINE_LENGTH", "note",
                "every line is close to the same length",
                f"line-length CV {cv:.3f} < {thr:.4f} (human 5th percentile, "
                f"{prof.name} profile). NOT slop evidence: this check was "
                f"built expecting metronomic lines to be a generated-text tell "
                f"and the measurement came out BACKWARDS — Shakespeare is more "
                f"uniform than the model. "
                f"{prof.evidence_for('line_length_cv')}. In a fixed form "
                f"uniformity is the form. Retained only as 'outside the human "
                f"range', and meaningful, if at all, in free verse"))

        # 5. predictable rhyme -- a NOTE, not a flag, and the reason is
        #    doctrine 7 rather than the AUC. This was the project's candidate
        #    universal; its cross-design replication was recorded as an
        #    out-of-vocabulary artifact, and cold that withdrawal does not
        #    reproduce (see the cold-repin section of the module docstring).
        #    The severity did not move with the number: a floor may not order
        #    the region it already passed, whatever the separation turns out
        #    to be. It runs only under a profile that measured it; the section
        #    profile did not, so it stays silent there rather than borrowing
        #    the sonnet cut.
        thr = d.resolve("predictable_pair_fraction_max", prof)
        pairs = self._pairs(lines, scheme)
        # `_predictability` returns (i, j, value) aligned to its pairs since
        # 2026-08-14. ~~this check wants the values only~~ — it wants all
        # three since 2026-08-23 (owner ruling): the finding joined
        # `loop.MANDATORY_PURSUE`, and a pursued note must NAME ITS LINES or
        # the loop has nothing to hold open. The lines were always computed
        # here and thrown away in this aggregation; keeping them is the same
        # move CLICHE_PAIR/SHARED_SUFFIX have always made, 1-based via the
        # same +1.
        preds = (list(self.qf._predictability(lines, pairs))
                 if thr is not None else [])
        if preds:
            obvious = [(i, j, v) for i, j, v in preds
                       if v > d.predictability_max]
            frac = len(obvious) / len(preds)
            if frac > thr:
                # BOTH members of every obvious pair: either side's word can
                # move the pair out of the top of its field, and the loop's
                # own `resolved_elsewhere` machinery already closes the
                # partner when one side's fix clears the pair — that is what
                # it was built for (2026-08-16, defect B).
                locs = sorted({x + 1 for i, j, _ in obvious for x in (i, j)})
                out.append(Finding(
                    "PREDICTABLE_RHYME", "note",
                    f"{len(obvious)} of {len(preds)} rhymes are near the top "
                    f"of their own candidate field",
                    f"{frac:.0%} of pairs above {d.predictability_max:.2f} "
                    f"predictability. A NOTE, and it may not reject: a rhyme "
                    f"at the top of its own candidate field is a decision "
                    f"handed back, not a verdict, because a floor may not "
                    f"order the region it already passed (doctrine 7). Nor is "
                    f"it on its own a generated-text detector. Held out and "
                    f"cold, predictability alone reaches AUC 0.648 on "
                    f"human-vs-generated and 0.710 on anthologized-vs-not "
                    f"(n=15) — above chance in both, and well under the 0.960 "
                    f"the ten-feature joint reaches on the same "
                    f"human-vs-generated split, so it is a weak separator "
                    f"carried by stronger features. Computed against an "
                    f"English frequency list; unvalidated outside English. "
                    f"PURSUED since 2026-08-23 (owner ruling): the lines "
                    f"named are the members of the obvious pairs, and the "
                    f"revise loop holds them open — it still may not reject",
                    locs))

        # 6-8. relation-level defects the correctness engine already names.
        # These are length-independent, so they RUN under every profile and
        # under none. `sev` goes with them anyway, and that is not a
        # contradiction: running is one question and being allowed to REJECT
        # is another. CLICHE_PAIR borrows no percentile from any profile, but
        # the only false-positive rate it has was measured inside one band,
        # so that band is the only place it may carry a rejection. See the
        # CLICHE_PAIR section of this module's docstring for the numbers.
        out.extend(self._relation_findings(lines, pairs, sev))
        return out

    @staticmethod
    def _pairs(lines, scheme):
        if scheme and len(scheme) == len(lines):
            return QualityFeatures.pairs_from_scheme(scheme)
        return [(i, i + 1) for i in range(0, len(lines) - 1, 2)]

    def _relation_findings(self, lines, pairs, sev=None):
        """Relation-level defects, with the radif band resolved by CONTEXT.

        `sev` is `check()`'s own severity gate — `lambda default: default if
        exact else "note"` — and it is passed IN rather than reproduced here.
        It has to be, and the reason is a call-order bug this method carried
        until 2026-08-14: these findings are appended AFTER `sev()` has been
        applied to everything above them, and on the `prof is None` path the
        gate has already returned, so hardcoding "flag" here put a hard flag
        on 133 corpus items where every length-sensitive finding had been
        downgraded to a note. Omitted, `sev` defaults to the identity, which
        is what a direct caller with no length in hand should get.

        NOT everything here goes through it. REPEAT_IN_VERSE stays a flag at
        any length on purpose: a word rhymed with itself is a fact about two
        lines, with no percentile and no measured rate behind it, so there is
        nothing for a length to invalidate. CLICHE_PAIR is the opposite case
        — the membership test is equally length-blind, but the only thing
        licensing it to REJECT is a false-positive rate measured in one band,
        and outside that band there is no measurement to lean on (14.74%
        where nothing was calibrated, against 6.35% in band).

        Doctrine 3 says the REPEAT band inverts by context: the same identical
        end word is a violation inside a verse and a requirement as a
        radif/refrain. The feature layer strips any shared trailing run
        unconditionally, which resolves that inversion in one direction only —
        so a plain self-rhyme became structurally invisible to this gate.

        A radif is systematic by definition. So the licence is earned by
        RECURRENCE: a trailing run must close at least two rhyme pairs AND at
        least `radif_min_pair_fraction` of all of them. Both conditions are
        needed — in a 31-pair rap verse, two pairs that happen to end in "it"
        cleared a bare count of two and were licensed as a refrain, which is
        coincidence being read as form. A run below the bar, in an item with
        other pairs to contrast it against, is a self-rhyme. On an item with
        only one pair there is no evidence either way, and the finding says so
        instead of guessing.
        """
        if sev is None:
            sev = lambda default: default  # noqa: E731
        out, cliche, suffix, repeat = [], [], [], []
        stripped, runs = [], {}
        for i, j in pairs:
            if i >= len(lines) or j >= len(lines):
                continue
            a, b, rlen = self.qf._strip_radif(lines[i], lines[j])
            run = ()
            if rlen:
                toks = self.qf._tokens(lines[j])
                run = tuple(w.lower().strip("'-.,;:!?") for w in toks[-rlen:])
                runs.setdefault(run, []).append((i, j))
            stripped.append((i, j, a, b, run))

        npairs = max(1, len(stripped))
        need = self.decl.radif_min_pair_fraction
        licensed = {r for r, ps in runs.items()
                    if len(ps) >= 2 and len(ps) / npairs >= need}
        for run in sorted(licensed):
            ls = sorted({i + 1 for i, j in runs[run]}
                        | {j + 1 for i, j in runs[run]})
            out.append(Finding(
                "RADIF_LICENSED", "note",
                f"a refrain closes {len(runs[run])} of {npairs} rhyme pairs; "
                f"THIS FLOOR's self-rhyme check is suppressed for it",
                f"repetend {' '.join(run)!r} recurs across "
                f"{len(runs[run]) / npairs:.0%} of pairs, at or above the "
                f"declared {need:.0%}, so it is read as a radif rather than "
                f"as repeated rhyme words. The rhyme is scored on the qafiya "
                f"that precedes it. WHAT IS SUPPRESSED IS THIS MODULE'S "
                f"`REPEAT_IN_VERSE` AND NOTHING ELSE — the MANDATE layer "
                f"judges an identical end word separately, on the declared "
                f"`ReviseDeclaration.repeat_licence`, and under the default "
                f"'unlicensed' it reports every one of these pairs as a "
                f"`SCHEME_VIOLATION` (REPEAT not rhyme) beside this note. "
                f"MEASURED on a 5-couplet English ghazal, radif 'turn': 15 "
                f"violations at the default and 0 at repeat_licence="
                f"'refrain', with this finding unmoved in both. A radif is a "
                f"LICENSED repeat and declaring it is the caller's move; "
                f"saying 'self-rhyme checking is suppressed' full stop would "
                f"claim a settlement this module cannot make for a layer it "
                f"does not own (doctrine 1)", ls))

        for i, j, a, b, run in stripped:
            if run and run not in licensed:
                # the shared run means the raw end words are identical
                #
                # A NOTE, NOT A FLAG — DOWNGRADED 2026-08-14, and the
                # measurement is the whole reason. `radif_min_pair_fraction`
                # was carried as "definitional" on the stated ground that this
                # project has no corpus of radif verse to calibrate it
                # against. IT HAD 1,859 ITEMS THE WHOLE TIME:
                # `corpus/song/eng_*` inside the `song` profile's own 150-400
                # token band, the population four of the other five thresholds
                # were already calibrated on. Run over them, 57 items carry a
                # repetend closing >= 2 pairs, and at the declared 0.50 the
                # gate refuses to license 54 OF THE 57 — a 94.7% false-positive
                # rate on canonical, published human verse, against the ~5%
                # each of its five siblings is held to. Doctrine 22 says state
                # a threshold as a false-positive rate; stated that way, this
                # one is not entitled to fail anybody.
                #
                # REPINNED 2026-08-14 from ~~1,872 items, 46 carriers, 43
                # refused, 93.5%~~ — this comment's own first figures, which
                # no re-derivation reproduces, including one run against the
                # tree as of the commit that wrote them. `_strip_radif`,
                # `_tokens` and the corpus are byte-identical to that commit,
                # so the record was wrong on the day, not stale. See
                # `FloorDeclaration.radif_min_pair_fraction` above for the
                # protocol each figure depends on and for the two ways 1,872
                # is reachable (hi=405, or a `.split()` token count) —
                # neither moves 57 / 54 / 94.7%. THE ARGUMENT IS UNCHANGED
                # AND THE RATE ROSE, so nothing here is retuned to recover
                # the old number.
                #
                # AND IT IS NOT MIS-SET, IT IS ON THE WRONG AXIS. Density does
                # not separate a refrain from a coincidence. The one-word runs
                # this declaration's own example warns about — "two of
                # thirty-one pairs ending in `it`" — sit at median density
                # 0.1292 (n=44); genuine multi-word refrain tails sit at
                # 0.1417 (n=20), REPINNED 2026-08-14 from ~~0.125 / 0.150~~,
                # which is the per-REPETEND median of the 150-400 band and is
                # the protocol every other figure here uses.
                # Length is the axis that reasoning implies and it is not
                # enough either: licensing on runs of >= 2, 3 or 4 words moves
                # the FPR only to 70.2%, 82.5% and 86.0% (REPINNED from
                # ~~60.9%, 73.9%, 78.3%~~). NO CUT ON EITHER
                # AXIS REACHES 5%, so no value is repinned here — retuning a
                # threshold to make a case pass, with no calibration behind
                # the new number, is exactly what doctrine 58 forbids. The
                # incumbent is kept and its cost is stated.
                #
                # WHAT 0.50 LICENSES IS BACKWARDS, which is the sharpest form
                # of the finding: of the three repetends it admits — 'da'
                # 7/11, 'john' 8/16, 'john tod' 12/21 — two are ONE-WORD
                # runs, and EVERY repetend of three words or more in the
                # corpus is charged, 10 of 10 — Burns's six-word "a health to
                # them that's awa" at 4/20 = 20% density, Gilbert's
                # "punishment fit the crime" at 3/37, Blake's "never can it
                # be" at 2/18. It licenses the coincidences and charges the
                # refrains. THIS HALF REPRODUCES
                # EXACTLY: the admitted three, the Burns figure and the 10 of
                # 10 are byte-identical across every re-derivation, which is
                # what locates the repin above in the COUNTS and not in the
                # mechanism.
                #
                # The `a == b` branch below is UNTOUCHED and stays a flag:
                # there the qafiya UNDER the repetend is the same word too, so
                # no refrain reading is available and it is plain self-rhyme.
                # THREE CASES, AND ONLY THE MIDDLE ONE MOVED. `not in
                # licensed` was covering two unlike things under one severity,
                # and the 94.7% above (REPINNED 2026-08-14 from ~~93.5%~~) is
                # a measurement of the second only — the sweep counted
                # repetends closing >= 2 pairs and nothing
                # else, so applying its verdict to a one-off would be charging
                # a rate to a population it was never measured on.
                # NAMED `rsev`, not `sev`: this local would otherwise
                # shadow the severity gate this method is now handed,
                # silently rebinding it before the CLICHE_PAIR block.
                seen = len(runs.get(run, ()))
                if seen >= 2:
                    # RECURS, but under the fraction. This is the measured
                    # population and the refrain case: Burns's "a health to
                    # them that's aw'" lands here. NOTE.
                    rsev = "note"
                    why = (f"carried by {seen} of {npairs} pairs, under the "
                           f"declared {need:.0%} needed to read it as a "
                           f"refrain. DISCLOSED, NOT CHARGED: that cut refuses "
                           f"54 of the 57 corpus/song/eng_* items carrying a "
                           f"recurring repetend — 94.7% of canonical human "
                           f"verse against the ~5% every percentile threshold "
                           f"here holds to — so it may not fail a draft "
                           f"(doctrine 22/16). REPINNED 2026-08-14 from "
                           f"43 of 46 / 93.5%, which no re-derivation "
                           f"reproduces; the rate ROSE, so the disclosure "
                           f"stands and nothing was retuned to recover it")
                elif len(stripped) > 1:
                    # Closes ONE pair while the item has others to contrast it
                    # against. Not a repetend at all: a one-off self-rhyme,
                    # which is the defect this check was built for and is
                    # outside everything measured above. STAYS A FLAG.
                    rsev = "flag"
                    why = (f"carried by {seen} of {npairs} pairs — it recurs "
                           f"NOWHERE, so no refrain reading is available and "
                           f"the fraction never enters. A one-off self-rhyme "
                           f"in an item with {npairs} pairs to contrast it "
                           f"against")
                else:
                    rsev = "note"
                    why = ("only one rhyme pair here, so this cannot be told "
                           "apart from a radif — the gate declines to decide")
                repeat.append((i + 1, j + 1, " ".join(run), rsev, why))
                continue
            if not a or not b:
                continue
            if a == b:
                repeat.append((i + 1, j + 1, a, "flag",
                               "the qafiya under the refrain is the same "
                               "word in both lines"))
                continue
            if frozenset((a, b)) in self.decl.cliche_pairs:
                cliche.append((i + 1, j + 1, f"{a}/{b}"))
            for suf in SUFFIXES:
                if (a.endswith(suf) and b.endswith(suf)
                        and len(a) > len(suf) + 1 and len(b) > len(suf) + 1):
                    # Same stem guard the correctness engine applies. Without
                    # it, -ed/-er/-es/-s fire on words that merely END in
                    # those letters: shed/bred share no morpheme, and calling
                    # that homeoteleuton is a false accusation about craft.
                    if len(suf) <= 2 and not (
                            a[: -len(suf)] in _lh._KNOWN_WORDS
                            and b[: -len(suf)] in _lh._KNOWN_WORDS):
                        continue
                    suffix.append((i + 1, j + 1, f"-{suf}"))
                    break
        if cliche:
            n_list = len(self.decl.cliche_pairs)
            shipped = self.decl.cliche_pairs == frozenset(CLICHE_PAIRS)
            csev = sev("flag")
            if not shipped:
                why_sev = ("The list has been REPLACED through the "
                           "declaration, so the shipped 6.35% in-band "
                           "false-positive rate does not describe it and this "
                           "finding has no measured rate behind it at all "
                           "(doctrine 22). ")
            elif csev == "flag":
                why_sev = ("It fires as a FLAG because the text sits inside a "
                           "profile's MEASURED range and the shipped list has "
                           "a measured interruption rate on held-out human "
                           "song: 6.36% median, 5th-95th percentile of seeds "
                           "4.23-8.37%, point estimate 118/1859 = 6.35%, "
                           "Wilson 95% CI [5.33, 7.55], author-held out, 200 "
                           "seeds, 50/50 — the same protocol that gives "
                           "LEXICAL_MONOTONY 5.43% and FUNCTION_WORD_HEAVY "
                           "5.23%. THAT RATE WAS MEASURED IN THE SONG BAND "
                           "(150-400 tokens) and nowhere else, so at section "
                           "or sonnet length it is being carried across, not "
                           "quoted from a reading taken there. What is known "
                           "about those two: over the same 4,930 corpus items "
                           "the check fires on 0.00% of the 86 that land in "
                           "`section` exactly and 5.49% of the 437 that land "
                           "in `sonnet` exactly — at or under the song "
                           "rate, "
                           "which is why the carry-over is not what `sev()` "
                           "is guarding against. ")
            else:
                why_sev = ("It is a NOTE here and may not reject. The "
                           "membership test is unchanged — it reads no "
                           "percentile and no length — but the only "
                           "false-positive rate licensing it was measured "
                           "inside the song profile's 150-400 band (6.36% "
                           "median, 118/1859 = 6.35%), and this text is "
                           "outside a measured range. Bucketed over the 4,930 "
                           "corpus items it runs 2.22-7.20% under "
                           "extrapolation and 14.74% where no profile "
                           "reaches, against that 6.35%. An unmeasured rate "
                           "may not carry a rejection (doctrine 22). ")
            out.append(Finding(
                "CLICHE_PAIR", csev,
                f"{len(cliche)} rhyme pair(s) on the stock list",
                "; ".join(f"{c}" for _, _, c in cliche)
                + f". WHAT THIS IS: membership in a hand-typed list of "
                  f"{n_list} pair{'' if n_list == 1 else 's'} "
                  f"(`FloorDeclaration.cliche_pairs`), nothing more. "
                + why_sev
                + "WHAT IT IS NOT: a cliche detector, and it does not measure "
                  "over-familiarity to a living listener. Against this repo's "
                  "own pair table (`data/song_rhymepair_en.tsv`, 15,409 "
                  "distinct pairs by author dispersion) the shipped list has "
                  "low SENSITIVITY: only 4 of the table's top 30 pairs are on "
                  "it (13.3%; 3 of 10 at the top ten), its own median "
                  "dispersion rank is #254 of 15,409, and 9 of its 30 pairs "
                  "never fire anywhere in corpus/song/eng_*. The table's most "
                  "dispersed rhymes are away/day, be/me, me/thee — none a "
                  "cliche to anyone now, and none on the list. "
                  "`quality/relations.py`'s `frequency` Unprovidable and "
                  "`quality/phrase_commonplace.py` both REFUSE the "
                  "over-familiarity claim at their own levels, because every "
                  "admissible English source here is pre-1931; a shorter list "
                  "does not earn the claim they declined. So this finding "
                  "says 'this pair is on a named list that interrupts a human "
                  "songwriter about 6% of the time', and it does not say the "
                  "rhyme is tired. "
                  "PRECISION DEFECT, RECORDED NOT FIXED: there is no rhyme "
                  "test in front of the membership test — it is raw "
                  "string-set membership on the two end words. "
                  "`tears`/`years` fires 21 times over the "
                  "corpus, 5 in band, on couplets the same "
                  "pair table records as NOT rhyming (count zero), because "
                  "cmudict's first pronunciation of `tears` is the rips sense "
                  "and the table reads `prons[0]`. Neither layer read which "
                  "sense is on the page. Both fixes were priced in band: a "
                  "`prons[0]` gate takes 118 to 114 by asserting one "
                  "convention over another, and an any-pronunciation gate "
                  "changes nothing at all (136 of 136 listed pairs pass it)",
                [i for i, _, _ in cliche]))
        if suffix:
            out.append(Finding(
                "SHARED_SUFFIX", "note",
                f"{len(suffix)} pair(s) rhyme only on a shared grammatical "
                f"ending (homeoteleuton)",
                "; ".join(s for _, _, s in suffix),
                [i for i, _, _ in suffix]))
        # `rsev` again, for the same reason: this loop variable shadowed the
        # gate too. REPEAT_IN_VERSE does NOT go through it — see the
        # docstring — so the severity here is the one decided above.
        for rsev in ("flag", "note"):
            rs = [r for r in repeat if r[3] == rsev]
            if rs:
                out.append(Finding(
                    "REPEAT_IN_VERSE", rsev,
                    f"{len(rs)} pair(s) rhyme a word with itself",
                    "; ".join(f"{w!r} — {why}" for _, _, w, _, why in rs),
                    [i for i, _, _, _, _ in rs]))
        return out

    # -- reporting --------------------------------------------------------

    def report(self, lines, scheme=None, stream=sys.stdout, banner=True):
        found = self.check(lines, scheme)
        flags = [f for f in found if f.severity == "flag"]
        print(f"\nSLOP FLOOR — {len(flags)} flag(s), "
              f"{len(found) - len(flags)} note(s)", file=stream)
        for f in found:
            print(f"  {f}", file=stream)
        if not found:
            print("  no findings", file=stream)
        if banner:
            self.banner(stream)
        return found

    def banner(self, stream=sys.stdout):
        """What the thresholds came from and what they failed at. Printed once
        per run — repeating it per section trains the reader to skip it.

        An instance method since 2026-08-14, so it can print the DECLARED
        MATTR window rather than a module default. A banner that quoted 50
        while the caller's declaration said something else would be the
        report lying about the run it is reporting.
        """
        if not CALIBRATION.get("calibrated"):
            print("\n  *** THRESHOLDS ARE PROVISIONAL — estimates, not yet "
                  "derived from the calibration corpora. Findings indicate "
                  "'outside a guessed range'. ***", file=stream)
        print(f"\n  calibration: {CALIBRATION['positive_class']} vs "
              f"{CALIBRATION['negative_class']}", file=stream)
        print(f"  NOT validated outside {CALIBRATION['language']} or outside "
              f"the {CALIBRATION['form']}.", file=stream)
        w = self.decl.mattr_window
        print(f"  MATTR window {w} tokens (declared: "
              f"FloorDeclaration.mattr_window; swept 2026-08-14, admissible "
              f"[1,22] u [40,93], NOT a plateau — "
              f"CALIBRATION['mattr_window'])", file=stream)
        for p in PROFILES:
            a, b = p.band()
            print(f"  profile {p.name:<8} {p.unit:<32} measured {p.lo}-{p.hi} "
                  f"tok, applied {a}-{b} ({p.tolerance:g}x)", file=stream)
            # A profile whose whole MEASURED range sits inside the window is
            # not reporting MATTR at all, and the banner is where a reader
            # who never opens this file finds that out.
            if p.hi <= w:
                print(f"           `mattr` here is PLAIN TTR: the measured "
                      f"range ends at {p.hi} tokens, inside the {w}-token "
                      f"window, so no moving average is taken and the "
                      f"figure is frozen in the window", file=stream)
            # A profile with no generated class cannot be read as a separation
            # and the banner has to say so where the reader is, not only in a
            # docstring three hundred lines up.
            if p.n_generated == 0:
                fp = p.held_out_fpr.get("ANY")
                print(f"           NO generated class: no AUC, no separation "
                      f"claim. Evidence is a HELD-OUT false-positive rate on "
                      f"human text"
                      + (f" — {fp[0]:.2f}% of held-out human items trip at "
                         f"least one check (5th-95th percentile of seeds "
                         f"{fp[1]:.2f}-{fp[2]:.2f}%)" if fp else "")
                      + ".", file=stream)
                if p.source:
                    print(f"           from {p.source}", file=stream)
        # The checks that did not do what they were built to do are printed
        # every run, beside the ones that did. A gate that only shows its
        # working results is advertising.
        for chunk in CALIBRATION["failed_expectations"].split("||"):
            print(f"  ! {chunk.strip()}", file=stream)


def sections(text):
    """Split a lyric sheet into (name, lines).

    The SECTION is the unit, not the sheet, and that is a doctrinal choice
    rather than a parsing convenience: the REPEAT band inverts across it. An
    identical line is a defect inside one verse and the whole point across two
    chorus instances, so a gate that pooled the sheet would flag every chorus
    in every song ever written.
    """
    out, name, buf = [], None, []
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("[") and line.endswith("]"):
            if buf:
                out.append((name or "(untitled)", buf))
            name, buf = line[1:-1], []
        elif line:
            buf.append(line)
    if buf:
        out.append((name or "(untitled)", buf))
    return out


if __name__ == "__main__":
    import json
    floor = SlopFloor()
    if len(sys.argv) > 1:
        path = sys.argv[1]
        scheme = sys.argv[2] if len(sys.argv) > 2 else None
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        secs = sections(text)
        print(f"{path} — {len(secs)} section(s)")
        for nm, ls in secs:
            n = sum(len(floor.qf._tokens(x)) for x in ls)
            print(f"\n=== [{nm}] {len(ls)} lines, {n} tokens")
            sc = scheme if scheme and len(scheme) == len(ls) else None
            floor.report(ls, sc, banner=False)
        # The SHEET pass, for the length-sensitive half only.
        #
        # A marked-up sheet never reaches the song profile section by section:
        # each section is 20-60 tokens and lands in `section` or in nothing.
        # But the song profile was calibrated on WHOLE corpus items with their
        # refrains printed, so the sheet is the length its thresholds were
        # measured at and the sections are not. Both passes therefore run and
        # both are labelled.
        #
        # Only the length-sensitive codes are reported here, and that is
        # doctrine 3: the REPEAT band inverts across a section boundary, so a
        # pooled self-rhyme count over a sheet with two chorus instances is a
        # false accusation by construction. The per-section pass above owns
        # that half.
        if len(secs) > 1:
            SIZED = {"LEXICAL_MONOTONY", "FUNCTION_WORD_HEAVY",
                     "ANAPHORA_OVERLOAD", "UNIFORM_LINE_LENGTH",
                     "PREDICTABLE_RHYME", "OUT_OF_CALIBRATED_LENGTH",
                     "EXTRAPOLATED_LENGTH"}
            allls = [l for _, ls in secs for l in ls]
            n = sum(len(floor.qf._tokens(x)) for x in allls)
            print(f"\n=== WHOLE SHEET {len(allls)} lines, {n} tokens — "
                  f"length-sensitive checks only")
            print("    the relation-level half is NOT pooled: the REPEAT band "
                  "inverts across a section boundary (doctrine 3), so a "
                  "self-rhyme count over the whole sheet would flag every "
                  "chorus. See the per-section reports above for that half.")
            found = [f for f in floor.check(allls) if f.code in SIZED]
            flags = [f for f in found if f.severity == "flag"]
            print(f"\nSLOP FLOOR — {len(flags)} flag(s), "
                  f"{len(found) - len(flags)} note(s)")
            for f in found:
                print(f"  {f}")
            if not found:
                print("  no findings")
        floor.banner()
        sys.exit(0)
    print("DECLARATION")
    # `cliche_pairs` is a frozenset of frozensets and json has no shape for
    # either, so it is rendered as sorted "a/b" strings — SORTED, because an
    # arbitrary set iteration order printed as a declaration is a declaration
    # that does not reproduce across processes (doctrine 66, the same trap
    # `_anaphora`'s tie break carries a comment about).
    def _jsonable(o):
        if isinstance(o, (set, frozenset)):
            return sorted("/".join(sorted(p)) if isinstance(
                p, (set, frozenset)) else str(p) for p in o)
        raise TypeError(repr(o))
    print(json.dumps(floor.decl.__dict__, indent=2, default=_jsonable))
    demo = ["And so the morning comes and so it goes",
            "And all the world is turning in the rain",
            "And every heart is beating in the cold",
            "And every soul is reaching through the pain"]
    floor.report(demo, "ABAB")

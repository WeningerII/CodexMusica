#!/usr/bin/env python3
"""The slop floor — a rejection gate for generated verse.

WHAT THIS IS, AND WHAT IT IS NOT

It is a gate that reports NAMED, MEASURED defects. It is not a quality score and
will never return one. Two project rules force that shape:

  - No weighted quality score, ever. The exchange rate between surprise and
    clarity is not derivable; it is a genre's answer, so it belongs in a
    declaration rather than in a constant.
  - Rejection, not selection. Detecting bad writing held out at AUC 0.964;
    ranking good writing at 0.717. Enforce a floor, do not order what passes.
    (Both ABSOLUTE ten-feature joints, cold: 0.964 is Experiment 2, human vs
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

The joint classifier separating those two sets reached AUC 0.964, but the same
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
and far under the 0.964 the ten-feature joint reaches on the same
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
same design, same cache state, only the feature set moving — it is 0.964 ->
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
    song composed by anyone alive in the last century. ANAPHORA carries a real
    period slope inside that window (author-level Spearman +0.275 against birth
    year, p_perm 0.0042 over 10,000 label permutations at seed 20260811, which
    survives Bonferroni over the five checks) -- so this is a THIRD feature
    caught reading period rather than quality, after the two doctrine 11
    already names. PREDICTABLE_RHYME is not a fourth: rho -0.018, p_perm
    0.8572, does not survive.
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
                    "0.964 (ten absolute features) to 0.891 (eight within-item "
                    "ones) -- same design, same cold reading, only the feature "
                    "set moving. The "
                    "`song` profile is NOT part of this: it has no generated "
                    "class, no AUC, and its evidence is a held-out "
                    "false-positive rate on human song text -- see that "
                    "profile's own source and note.",
    #: LENGTH IS A COORDINATE, not a detail. MATTR is a moving average over a
    #: 50-token window; below that the implementation falls back to plain TTR,
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
    "definitional": ["predictability_max", "radif_min_pair_fraction"],
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
        "human-vs-generated against 0.964 for the ten-feature joint on the "
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


#: Both profiles come from the SAME two classes -- the 152 sonnets and the 40
#: generated ones -- measured at two units. The section profile takes the
#: three quatrains of each sonnet (lines 1-4, 5-8, 9-12), which is the closest
#: thing to a song section that this corpus contains.
PROFILES = [
    Profile(
        name="section", unit="4-line quatrain, 29-37 tokens",
        lo=29, hi=37, n_human=456, n_generated=120,
        percentiles={
            "mattr_min": 0.7568,                # human 5th
            "function_word_ratio_max": 0.5161,  # human 95th
            "anaphora_max": 0.5000,             # human 95th
            "line_length_cv_min": 0.0525,       # human 5th
        },
        measured_auc={"mattr": 0.776, "function_word_ratio": 0.207,
                      "anaphora": 0.245, "line_length_cv": 0.424},
        note="Quatrains from one sonnet are NOT independent, so the n above "
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
        lo=150, hi=400, n_human=1859, n_generated=0,
        tolerance=1.25,
        percentiles={
            "mattr_min": 0.7226,                # human 5th
            "function_word_ratio_max": 0.4716,  # human 95th
            "anaphora_max": 0.3000,             # human 95th
            "line_length_cv_min": 0.1123,       # human 5th
            "predictable_pair_fraction_max": 0.9286,  # human 95th
        },
        #: EMPTY ON PURPOSE. There is no generated song class in this repo, so
        #: there is no separation to report and this profile may not borrow the
        #: sonnet's. `held_out_fpr` is what it has instead.
        measured_auc={},
        held_out_fpr={
            # (median, 5th percentile of seeds, 95th percentile of seeds)
            "mattr": (5.43, 1.51, 11.07),
            "function_word_ratio": (5.23, 1.86, 10.64),
            "anaphora": (5.01, 1.44, 11.15),
            "line_length_cv": (5.13, 3.04, 7.81),
            "predictability": (4.81, 2.52, 7.43),
            "ANY": (20.79, 12.57, 29.43),
        },
        source="corpus/song/eng_*.txt: 143 files, one author each, 4,930 "
               "`--- TITLE:` items, 152,325 sung lines, deduplicated "
               "2026-08-11. Restricted to items of 150-400 tokens: 1,859 "
               "items over 108 authors. Thresholds are the 5th/95th percentile "
               "of that human class, held out BY AUTHOR (50/50, 200 seeds).",
        note=(
            "READ THIS BEFORE QUOTING ANY NUMBER FROM IT.\n"
            "  * It is NOT a separation. The other two profiles separate 152 "
            "Shakespeare sonnets from 40 model sonnets and can quote an AUC. "
            "This one has no generated song class, so it has no AUC and makes "
            "no claim to catch generated text. It only says how often it "
            "interrupts a human songwriter: per check 4.8-5.4% median, and "
            "20.79% for the UNION of the five (5th-95th percentile of seeds "
            "12.57-29.43%). One human song in five trips something. (Four "
            "checks alone put the union at 17.66% [10.78-25.58]; the rise to "
            "20.79% is PREDICTABLE_RHYME joining the union below, not corpus "
            "drift -- a fifth check can only raise a union rate, never lower "
            "one.)\n"
            "  * The band was chosen by a rule declared before it was read "
            "off: the widest contiguous token range in which every 50-token "
            "sub-bin holds >=100 items and every sub-bin threshold sits within "
            "0.02 (0.03 for anaphora) of the band-wide one. 150-400 is what "
            "that rule returns. It was not widened to admit any particular "
            "lyric, and 100-400 and 150-450 both FAIL it -- on mattr, whose "
            "5th percentile runs 0.6400 at 50-80 tokens to 0.7719 at 700-1200 "
            "and is only flat above ~150.\n"
            "  * PERIOD. The corpus is pre-1931 by construction; latest birth "
            "1872, latest death 1929. ANAPHORA has a real period slope inside "
            "that window -- author-level Spearman +0.275 against birth year, "
            "p_perm 0.0042 over 10,000 label permutations at seed 20260811, "
            "which survives Bonferroni over the five checks (cuts at 0.0100). "
            "That is a THIRD "
            "feature caught reading period rather than quality (doctrine 11) "
            "-- PREDICTABLE_RHYME is not a fourth: rho -0.018, p_perm 0.8572, "
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
        self.qf = qf or QualityFeatures()

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
                f"50-token window and silently degrades to plain "
                f"type-token ratio below that, so a threshold measured at one "
                f"length is a different statistic at another. Relation-level "
                f"checks (self-rhyme, radif, cliche, shared suffix) do not "
                f"depend on length and did run"))
            return out + self._relation_findings(
                lines, self._pairs(lines, scheme))
        if not exact:
            a, b = prof.band()
            out.append(Finding(
                "EXTRAPOLATED_LENGTH", "note",
                f"{n_tok} tokens is outside the {prof.name} profile's measured "
                f"range ({prof.lo}-{prof.hi}); every finding below is "
                f"downgraded to a note",
                f"applied within the tolerance band {a}-{b}. A threshold read "
                f"off one length distribution is an extrapolation at another, "
                f"and an extrapolation may not reject"))

        v = self.qf.extract(lines, scheme)

        # 1. lexical monotony -- the strongest single separator observed
        thr = d.resolve("mattr_min", prof)
        m = v.get("mattr")
        if thr is not None and m == m and m is not None and m < thr:
            out.append(Finding(
                "LEXICAL_MONOTONY", sev("flag"),
                "vocabulary repeats more than human verse did in calibration",
                f"MATTR {m:.3f} < {thr:.4f} (human 5th percentile, {prof.name} "
                f"profile); {prof.evidence_for('mattr')}. Caveat: within "
                f"Shakespeare the direction REVERSES (0.366), so low MATTR is "
                f"not evidence against a poem, only outside the range this "
                f"corpus occupied"))

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
                + (". And on the song corpus it carries a measured PERIOD "
                   "slope -- author-level Spearman +0.275 against birth year, "
                   "p_perm 0.0042 over 10,000 label permutations at seed "
                   "20260811 -- so at this length part of what it reads "
                   "is when the words were written (doctrine 11)"
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
        # 2026-08-14; this check wants the values only, and the ratio below
        # is why the misalignment it used to carry was never visible here.
        preds = ([v for _i, _j, v in self.qf._predictability(lines, pairs)]
                 if thr is not None else [])
        if preds:
            obvious = [p for p in preds if p > d.predictability_max]
            frac = len(obvious) / len(preds)
            if frac > thr:
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
                    f"(n=15) — above chance in both, and well under the 0.964 "
                    f"the ten-feature joint reaches on the same "
                    f"human-vs-generated split, so it is a weak separator "
                    f"carried by stronger features. Computed against an "
                    f"English frequency list; unvalidated outside English"))

        # 6-8. relation-level defects the correctness engine already names.
        # These are length-independent, so they run under every profile and
        # under none.
        out.extend(self._relation_findings(lines, pairs))
        return out

    @staticmethod
    def _pairs(lines, scheme):
        if scheme and len(scheme) == len(lines):
            return QualityFeatures.pairs_from_scheme(scheme)
        return [(i, i + 1) for i in range(0, len(lines) - 1, 2)]

    def _relation_findings(self, lines, pairs):
        """Relation-level defects, with the radif band resolved by CONTEXT.

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
                f"self-rhyme checking is suppressed for it",
                f"repetend {' '.join(run)!r} recurs across "
                f"{len(runs[run]) / npairs:.0%} of pairs, at or above the "
                f"declared {need:.0%}, so it is read as a radif rather than "
                f"as repeated rhyme words. The rhyme is scored on the qafiya "
                f"that precedes it", ls))

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
                seen = len(runs.get(run, ()))
                if seen >= 2:
                    # RECURS, but under the fraction. This is the measured
                    # population and the refrain case: Burns's "a health to
                    # them that's aw'" lands here. NOTE.
                    sev = "note"
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
                    sev = "flag"
                    why = (f"carried by {seen} of {npairs} pairs — it recurs "
                           f"NOWHERE, so no refrain reading is available and "
                           f"the fraction never enters. A one-off self-rhyme "
                           f"in an item with {npairs} pairs to contrast it "
                           f"against")
                else:
                    sev = "note"
                    why = ("only one rhyme pair here, so this cannot be told "
                           "apart from a radif — the gate declines to decide")
                repeat.append((i + 1, j + 1, " ".join(run), sev, why))
                continue
            if not a or not b:
                continue
            if a == b:
                repeat.append((i + 1, j + 1, a, "flag",
                               "the qafiya under the refrain is the same "
                               "word in both lines"))
                continue
            if frozenset((a, b)) in CLICHE_PAIRS:
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
            out.append(Finding(
                "CLICHE_PAIR", "flag",
                f"{len(cliche)} rhyme pair(s) on the stock list",
                "; ".join(f"{c}" for _, _, c in cliche),
                [i for i, _, _ in cliche]))
        if suffix:
            out.append(Finding(
                "SHARED_SUFFIX", "note",
                f"{len(suffix)} pair(s) rhyme only on a shared grammatical "
                f"ending (homeoteleuton)",
                "; ".join(s for _, _, s in suffix),
                [i for i, _, _ in suffix]))
        for sev in ("flag", "note"):
            rs = [r for r in repeat if r[3] == sev]
            if rs:
                out.append(Finding(
                    "REPEAT_IN_VERSE", sev,
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

    @staticmethod
    def banner(stream=sys.stdout):
        """What the thresholds came from and what they failed at. Printed once
        per run — repeating it per section trains the reader to skip it."""
        if not CALIBRATION.get("calibrated"):
            print("\n  *** THRESHOLDS ARE PROVISIONAL — estimates, not yet "
                  "derived from the calibration corpora. Findings indicate "
                  "'outside a guessed range'. ***", file=stream)
        print(f"\n  calibration: {CALIBRATION['positive_class']} vs "
              f"{CALIBRATION['negative_class']}", file=stream)
        print(f"  NOT validated outside {CALIBRATION['language']} or outside "
              f"the {CALIBRATION['form']}.", file=stream)
        for p in PROFILES:
            a, b = p.band()
            print(f"  profile {p.name:<8} {p.unit:<32} measured {p.lo}-{p.hi} "
                  f"tok, applied {a}-{b} ({p.tolerance:g}x)", file=stream)
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
    print(json.dumps(floor.decl.__dict__, indent=2))
    demo = ["And so the morning comes and so it goes",
            "And all the world is turning in the rain",
            "And every heart is beating in the cold",
            "And every soul is reaching through the pain"]
    floor.report(demo, "ABAB")

#!/usr/bin/env python3
"""Pins the numbers `quality/discriminate.py` prints, COLD.

Until this file existed, nothing in `quality/test_*.py` imported
`discriminate` and no check anywhere pinned any AUC it produces. Its eight
joint held-out AUCs are quoted as findings in `quality/RESULTS.md` (the
headline table, "0.971 against 0.709", doctrine 7's "rejection, not
selection") and in `quality/RESULTS_WITHIN_ITEM.md`'s pre-registered P1/P2 —
and every one of them could have moved without a single test going red.
`quality/audit_joint_auc_null.py --check` grades four of them, but it REFUSES
(exit 2) unless a warm fingerprint-matching cache is already on disk, so on a
fresh checkout it grades nothing.


WHAT IS PINNED
--------------
FORTY-FOUR numbers, in three tiers, all from one pass over the same 384
feature vectors:

  * the EIGHT joint held-out AUCs -- 2 feature sets x 2 experiments x
    (all features, predictability only). These are the numbers the record is
    STATED in, so they are the ones worth a witness.
  * the THIRTY-SIX per-feature AUCs. They are FREE: `run_experiment` gets its
    AUC from `auc_from_ranks` before it spends anything on a permutation, so
    pinning them costs no CPU at all and catches drift in one feature that is
    too small to move a 10-feature joint fit. Their permutation p-values are
    NOT pinned -- those are the expensive half (20,000 shuffles x 36) and a
    p at this resolution is a sample (doctrine 57).
  * the SHAPES -- 15 vs 117, 152 vs 40, 10 and 8 features, 384 vectors.
    Without them a moved AUC cannot be told from a moved corpus, and those
    have completely different remedies. Same reasoning, same counts, as
    `audit_joint_auc_null.PINNED`.


COLD vs WARM -- THE THING THIS TEST HAD TO GET RIGHT FIRST
----------------------------------------------------------
`discriminate.py` keeps an on-disk feature cache at `data/feature_cache.json`.
Cold vs warm was a REAL distinction and it was worth 0.058 of AUC: until
2026-08-13 the cache was keyed `tag:ident` with no statement of which code
wrote the entry, so a warm run reproduced whatever `features.py` looked like
in 2026-08-09. Experiment 1 read 0.659 warm and 0.717 cold; Experiment 2 read
0.975 warm and 0.964 cold. RESULTS.md carries both readings and says which is
which.

That defect is CLOSED at the module (format-2 cache: a fingerprint over
`features.py`, `within_item.py`, `lyric_harness.py`, the three resource files,
the `Declaration` tuple and the feature names/directions; plus a per-entry key
content-addressed on the poem's own lines). A warm cache whose fingerprint
matches provably holds vectors written by the code running now, so warm and
cold agree by construction.

THIS TEST STILL DEFAULTS TO COLD, and does not read or write
`data/feature_cache.json` under any flag. Three reasons, and the first is the
one that decides it:

  1. The fingerprint is not total. `quality/corpus.py` is deliberately out of
     it (justified in `discriminate.SOURCE_FILES`), and so is the NLTK POS
     model `features._tagger()` loads -- an unfingerprinted resource that
     moves every `pos_binding_diversity` at once. A test that inherits a
     cache inherits those.
  2. A test that passes because of a file left on disk by a previous run is
     not a test of this checkout.
  3. CI has no cache anyway: `data/feature_cache.json` is in `.gitignore`, so
     a fresh clone starts cold whatever this file does. Defaulting to warm
     would pin numbers that only exist on a developer's box.

`--cache=PATH` is available for a developer iterating locally. It goes through
`discriminate.load_cache`, so a stale cache is DISCARDED with a printed reason
and the run silently becomes cold rather than silently becoming wrong; the
mode actually taken is printed on every run, warm or cold, before any number.


THE TOLERANCE, AND WHY IT IS 0.0005
-----------------------------------
Every input on this path is fixed: the vectors are deterministic given the
corpus and the code, the labels are a transcription of PREREGISTRATION.md, the
fold split is `StratifiedKFold(shuffle=True, random_state=SEED)` at a
hard-coded seed, and lbfgs is deterministic. No draw is taken anywhere. So the
question is not sampling error, it is arithmetic reproducibility.

  TOL = 0.0005 = half of the last decimal the record states these numbers in.

A movement that could not change a printed 3-decimal figure passes; a movement
larger than the whole width of that figure fails. That is the same resolution
`audit_joint_auc_null.check` grades at (it compares `f"{obs:.3f}"` to a
committed string), expressed as a number.

THE PINS ARE FULL-PRECISION, NOT THE 3-DECIMAL FIGURES THE RECORD PRINTS, and
that is deliberate. A 3-decimal pin carries up to 0.0005 of rounding residue
of its own, which is the ENTIRE tolerance budget: `rhyme_predictability_mean`
pinned at 0.262 against a true 0.261538 would sit 0.000462 from its own pin
before anything drifted at all, leaving 0.000038 of headroom in one direction
and 0.000962 in the other. Pinning the measured value centres the budget. The
3-decimal figure is still checked, separately, against what the module
actually prints -- that is the number the record quotes.

Three facts a future reader needs before loosening any of it:

  * The AUC is a rank statistic on FIXED class sizes, so it is QUANTIZED: it
    is exactly k/(15*117) in Experiment 1 and k/(152*40) in Experiment 2. The
    smallest possible nonzero change is therefore 5.70e-4 (Exp 1) and 1.64e-4
    (Exp 2). In Experiment 1 that quantum is LARGER than TOL, so this test
    permits no rank change at all in the small arm. That is asserted knowing
    it: MEASURED on this machine, all eight joint AUCs are identical to 17
    significant digits across OMP/OPENBLAS/MKL thread counts 1 and 4, and the
    four `joint_all` values agree with two independent earlier cold runs taken
    at two different `lyric_harness.py` digests (`audit_joint_auc_null.py`,
    commit 98f07a4) and with two more taken here at a third and a fourth.
  * `abs_exp2`'s joint AUC sits 2.6e-05 BELOW the boundary between printing
    0.964 and printing 0.965 -- 0.16 of a single rank flip. So the printed
    figure the record quotes for the headline "detecting bad writing works"
    number is one rank away from reading 0.965, in the up direction only. The
    check prints that distance on every run rather than leaving it to be
    rediscovered as an unexplained string mismatch.
  * If this ever fails by exactly one quantum, that is the tolerance sitting
    at the statistic's own resolution, and the remedy is to repin with the
    date and keep the superseded value visible (doctrine 17) -- not to widen
    TOL until the check stops asking anything (doctrine 58).


COST, DECLARED (doctrine 79 -- say what you bounded)
----------------------------------------------------
MEASURED 2026-08-13 on a 4-core box, threads pinned, cache cold, box otherwise
quiet: WALL 1066.1 s, CPU 1056.7 s (17.8 minutes, essentially single-threaded
end to end). The split:

    384 feature extractions          1055 CPU-s   (99.8% of the run)
    36 per-feature AUCs              < 1 CPU-s
    12 cross-validated joint AUCs    < 1 CPU-s

Against a warm fingerprint-matching cache the same 69 checks take 6.9 s wall /
6.5 s CPU -- but see COLD vs WARM above for why that is a developer's
convenience and not what CI gets. The 20,000-shuffle permutation tests that
dominate `discriminate.main`'s own report are NOT run here; the AUCs this file
pins do not need them.

QUOTE THE CPU FIGURE, NOT THE WALL FIGURE. Three cold runs on this box measured
CPU 1056.7 / 1053.2 / 1055.4 s -- a 0.3% spread -- while their WALL times were
1066.1 / 1441.2 / 1418.8 s, a 35% spread caused entirely by other work on the
same four cores. Wall time here is a measurement of the neighbours.

THREAD PINNING IS NOT OPTIONAL and is done below, before numpy is imported.
`audit_joint_auc_null.py` measured the same BLAS spin-wait at 625 CPU-s
unpinned against 32 pinned for identical output; the matrices here are 132x10
and 192x8, far smaller than the cost of waking four threads to serve them.


WHERE THIS BELONGS
------------------
NOT a per-commit hook: 17.6 CPU-minutes is roughly 35x the whole rest of
`quality/test_*.py` put together, and none of it can be shortened without
giving up the cold guarantee, because 99.8% of it is the 384 extractions the
cold guarantee IS.

Run it where the numbers it guards are read or published:
  * before editing `quality/RESULTS.md`, `RESULTS_WITHIN_ITEM.md` or any
    document quoting an AUC from this module;
  * on any change to `features.py`, `within_item.py`, `discriminate.py`, or
    `lyric_harness.py`'s comparator path -- the first three of which the cache
    fingerprint already names, and the fourth of which is the path by which
    the cache went stale in the first place;
  * on a schedule (nightly / pre-release), never on a pull request.

The cheap companion that DOES belong on every commit is
`quality/audit_joint_auc_null.py --check`, which grades four of these eight in
~40 s -- but only against a warm cache, and it REFUSES (exit 2) without one.
The two are complements, not substitutes: that one is fast and conditional,
this one is slow and unconditional.

Run: python3 quality/test_discriminate.py [--cache=PATH]
     Exit 0 pass, 1 drifted, 2 REFUSED (a declared resource is absent --
     doctrine 20: an instrument that cannot fire is not an instrument that
     fired and found nothing).
"""

import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

# THREAD PINNING, BEFORE numpy IS IMPORTED. BLAS reads these once, at load; a
# `setdefault` after `import numpy` is a no-op that looks like a fix. Verbatim
# from quality/audit_joint_auc_null.py, including `setdefault` rather than
# assignment so an operator who has already declared a thread count keeps it.
for _v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS",
           "NUMEXPR_NUM_THREADS", "VECLIB_MAXIMUM_THREADS"):
    os.environ.setdefault(_v, "1")

import io                                                        # noqa: E402
import math                                                      # noqa: E402
import re                                                        # noqa: E402
from contextlib import redirect_stdout                           # noqa: E402

from quality.corpus import (SONNET_SCHEME, labelled_sonnets,     # noqa: E402
                            load_generated, load_sonnets)
from quality.discriminate import (_clean, _ranks,                # noqa: E402
                                  auc_from_ranks, cache_identity,
                                  compute, fingerprint, joint_classifier,
                                  load_cache, report_joint, save_cache)
from quality.features import QualityFeatures                     # noqa: E402
from quality.within_item import WithinItemFeatures               # noqa: E402

PASS, FAIL = [], []

TOL = 0.0005


def check(name, ok, note=""):
    (PASS if ok else FAIL).append(name)
    print("  %s  %s" % ("PASS" if ok else "FAIL", name))
    if note:
        print("          %s" % note)


def rendering_edge(x):
    """Distance from `x` to the nearest boundary of its own 3-decimal bucket.

    A value sitting on one is a value whose PRINTED figure — the thing
    RESULTS.md quotes — can flip on a movement far smaller than anything
    worth calling drift, so it is worth saying out loud rather than
    discovering as a mystery string mismatch. `abs_exp2`'s 0.964 is 2.6e-05
    from rendering as 0.965, which is 0.16 of one rank flip.
    """
    lo = math.floor(x * 1000 + 0.5) / 1000.0 - 0.0005
    return min(x - lo, lo + 0.001 - x)


def close(name, got, want, note=""):
    """Grade one number against its pin at TOL, and always print both."""
    ok = got is not None and abs(got - want) <= TOL
    if got is None:
        detail = "committed %.6f   measured NOTHING" % want
    else:
        detail = ("committed %.6f   measured %.6f   delta %+.2e"
                  % (want, got, got - want))
        edge = rendering_edge(want)
        if edge < 1e-4:
            detail += ("   [NEAR A RENDERING BOUNDARY: the pin is %.1e from "
                       "printing as something other than %.3f]"
                       % (edge, want))
    check(name, ok, detail + (("   " + note) if note else ""))


# ---------------------------------------------------------------------------
# THE PINS.  MEASURED 2026-08-13, cold, twice, at features.py affe2209d56e24b5
# / within_item.py 703b700a530925c7, concreteness.txt 0b4082dbd38585b0,
# wordfreq20k.txt 4ed6e5336d7760d2, cmudict.dict 81917843c7f44ce2 --
# ONCE at lyric_harness.py 10c1dca86b15860a (`discriminate.py --cold`, whose
# printed report agrees with all 44 of these to the 3 decimals it prints) and
# once at 7c894bfce92a48a7 (this file), which is where the full precision
# below comes from.
#
# That two-digest agreement is not decoration. `lyric_harness.py` moved under
# a 27-minute cold run WHILE IT WAS RUNNING, which is the same hazard
# audit_joint_auc_null.py records ("features.py was edited TWICE by a
# concurrent cell inside that single 17.5-minute build"). A cold pin in this
# repo has to be shown to survive the rate at which the comparator moves, or
# it is a pin on one moment.
#
# The four `joint_all` values are NOT first pinned here -- they are the cold
# figures `audit_joint_auc_null.py` was repinned to in commit 98f07a4, and
# these runs are a third and fourth independent agreement with them.
# `joint_solo` and all thirty-six per-feature AUCs ARE first pinned here;
# nothing in the repo graded them before.
#
# Doctrine 58: argue these and repin with the date; do not tune the
# measurement to meet them.
# ---------------------------------------------------------------------------

#: REPINNED 2026-08-22 — EIGHT FIGURES, AND THE PATTERN IS THE CONTROL.
#: `MISSING.md` M-31: `features.py`'s `MAX_RANK = 20000` was the size of
#: `wordfreq20k.txt`, the frequency list this project read until the source
#: was swapped, and the constant stayed behind. Against a live list of 49,999
#: ranked to 49,998 an out-of-vocabulary word scored 20,000 came back COMMONER
#: than 60% of English, so feature 10 (RARITY of the content vocabulary) ran
#: backwards. The sentinel is derived from the list now.
#:
#: WHAT MOVED IS EXACTLY WHAT THE FIX TOUCHES AND NOTHING ELSE, which is the
#: check that this repin is a correction and not a drift:
#:
#:   abs_exp1  joint_all              ~~0.716809~~ 0.723077   +6.27e-03
#:   abs_exp1  content_word_freq_mean ~~0.517949~~ 0.523077   +5.13e-03
#:   abs_exp2  joint_all              ~~0.964474~~ 0.959704   -4.77e-03
#:   abs_exp2  content_word_freq_mean ~~0.806579~~ 0.706743   -9.98e-02
#:   wi_exp1   joint_all              ~~0.637607~~ 0.621083   -1.65e-02
#:   wi_exp1   wi_freq_delta          ~~0.638746~~ 0.544160   -9.46e-02
#:   wi_exp2   joint_all              ~~0.890954~~ 0.896053   +5.10e-03
#:   wi_exp2   wi_freq_delta          ~~0.600000~~ 0.633717   +3.37e-02
#:
#: The four `joint_solo` (predictability-only) figures are UNCHANGED and
#: passed — they do not read the frequency feature. So did every other
#: per-feature AUC in all four arms. Only the frequency feature and the joints
#: that contain it moved; had anything else drifted, the fix would have
#: touched more than it should.
#:
#: THE HONEST READING OF THE TWO BIG FALLS. `content_word_freq_mean` on
#: human-vs-generated drops 0.807 -> 0.707 and `wi_freq_delta` drops 0.639 ->
#: 0.544, which is barely above chance. Under the stale sentinel this feature
#: was partly measuring WHETHER A TEXT CONTAINS WORDS OUTSIDE A 20,000-WORD
#: LIST — an out-of-vocabulary RATE, which tracks the label — rather than the
#: rarity it names. Removing that removes real discriminative power, and the
#: power was spurious. This is a DOWNGRADE recorded as a downgrade
#: (doctrine 17), not a number tuned to look better.
#:
#: DOCTRINE 7 IS UNAFFECTED AND ITS OWN TEXT SAYS WHY. The headline pair moves
#: 0.717/0.964 -> 0.723/0.960 and the gap rejection-minus-selection goes
#: ~~0.247~~ 0.237. Rejection still beats selection by nearly a quarter of an
#: AUC, and that doctrine "never rested on the third decimal".
#:
#: Cold run, 892s, no cache (the key changed with `RESOURCE_FILES`, so every
#: feature was recomputed). Every value here is an exact concordant-pair
#: fraction: 1269/1755, 918/1755, 5835/6080, 4297/6080, 1090/1755, 955/1755,
#: 5448/6080, 3853/6080.
PINNED = {
    "abs_exp1": {
        "label": "ABSOLUTE (original ten) / Exp 1  survived vs forgotten",
        "n_pos": 15, "n_neg": 117, "n_features": 10,
        "joint_all": 0.7230769230769231, "joint_solo": 0.70997150997151,
        "features": {
            "rhyme_predictability_mean": 0.26153846153846155,
            "rhyme_predictability_min": 0.35014245014245016,
            "concreteness_mean": 0.672934472934473,
            "concreteness_p90": 0.6353276353276354,
            "abstract_noun_ratio": 0.3148148148148148,
            "pos_binding_diversity": 0.46096866096866096,
            # THE COORDINATE THIS PINS IS THE WINDOW, and it took until
            # 2026-08-14 for anything to say so. `mattr` is a moving average
            # over `FloorDeclaration.mattr_window` tokens (50), so this
            # number is a reading at ONE window and not a property of the
            # feature -- move the window and it moves, monotonically and by
            # far more than any tolerance here. The sweep and the admissible
            # range are `quality.floor.CALIBRATION["mattr_window"]`.
            "mattr": 0.3658119658119658,
            "function_word_ratio": 0.5358974358974359,
            "syntactic_inversion_rate": 0.582905982905983,
            "content_word_freq_mean": 0.5230769230769231,
        },
    },
    "abs_exp2": {
        "label": "ABSOLUTE (original ten) / Exp 2  human vs generated",
        "n_pos": 152, "n_neg": 40, "n_features": 10,
        "joint_all": 0.959703947368421, "joint_solo": 0.6476973684210526,
        "features": {
            "rhyme_predictability_mean": 0.33963815789473684,
            "rhyme_predictability_min": 0.3355263157894737,
            "concreteness_mean": 0.2712171052631579,
            "concreteness_p90": 0.22911184210526317,
            "abstract_noun_ratio": 0.7921875,
            "pos_binding_diversity": 0.4915296052631579,
            # SAME COORDINATE, and this is the cell the 2026-08-14 window
            # sweep was run against: `mattr` alone, Exp 2, at each window.
            #     window   20     25     30     40     50     60     80   100
            #     AUC     .928   .915   .907   .891   .870   .850   .811  .750
            # 0.8695723684210527 is the window-50 entry, reproduced to the
            # last digit by an independent instrument. The column is
            # MONOTONE, so this pin sits on a slope: the shipped window costs
            # ~0.06 AUC against the sweep's best and is kept because an
            # in-sample argmax over the same 152-vs-40 corpus is not a
            # calibration (doctrine 19). Any future move must land inside
            # [1,22] u [40,93] -- outside that a profile's calibration set
            # straddles `_mattr`'s plain-TTR fallback. Do not tune the window
            # to move this number; repin it with a date and an argument.
            "mattr": 0.8695723684210527,
            "function_word_ratio": 0.13519736842105262,
            "syntactic_inversion_rate": 0.8330592105263158,
            "content_word_freq_mean": 0.7067434210526315,
        },
    },
    "wi_exp1": {
        "label": "WITHIN-ITEM (respecified eight) / Exp 1  survived vs "
                 "forgotten",
        "n_pos": 15, "n_neg": 117, "n_features": 8,
        "joint_all": 0.6210826210826211, "joint_solo": 0.7185185185185186,
        "features": {
            "wi_predictability_advantage": 0.26153846153846155,
            "wi_concreteness_delta": 0.5094017094017094,
            "wi_abstract_delta": 0.5817663817663817,
            "wi_freq_delta": 0.5441595441595442,
            "wi_function_delta": 0.39373219373219376,
            "wi_binding_excess": 0.5333333333333333,
            "wi_type_ratio": 0.656980056980057,
            "wi_conc_spread": 0.51994301994302,
        },
    },
    "wi_exp2": {
        "label": "WITHIN-ITEM (respecified eight) / Exp 2  human vs generated",
        "n_pos": 152, "n_neg": 40, "n_features": 8,
        "joint_all": 0.8960526315789473, "joint_solo": 0.6523026315789475,
        "features": {
            "wi_predictability_advantage": 0.33963815789473684,
            "wi_concreteness_delta": 0.3817434210526316,
            "wi_abstract_delta": 0.43133223684210525,
            "wi_freq_delta": 0.6337171052631579,
            "wi_function_delta": 0.6799342105263158,
            "wi_binding_excess": 0.5796052631578947,
            "wi_type_ratio": 0.103125,
            "wi_conc_spread": 0.3672697368421053,
        },
    },
}

#: Vectors a cold run computes. 152 sonnets + 40 generated, per feature set.
#: Experiment 1's 15 + 117 are a SUBSET of the 152 and share their cache keys,
#: which is why this is 384 and not 648.
PINNED_VECTORS = 384

#: The "predictability only" column, per feature set. NOT re-declared for its
#: own sake -- `report_joint` hard-codes this list, and the check below
#: asserts that a direct `joint_classifier` call on these names renders the
#: identical figure `report_joint` printed. Change the list in one place and
#: the test says so, rather than pinning a number nobody prints.
SOLO = {
    QualityFeatures: ["rhyme_predictability_mean", "rhyme_predictability_min"],
    WithinItemFeatures: ["wi_predictability_advantage"],
}

_ALL_RE = re.compile(r"joint held-out AUC, all (\d+) features[^:]*:\s*"
                     r"([0-9.]+)")
_SOLO_RE = re.compile(r"joint held-out AUC, predictability only\s*:\s*"
                      r"([0-9.]+)")


def feature_auc(rows_a, rows_b, name):
    """`run_experiment`'s AUC, without its permutation test.

    Identical arithmetic -- `_clean` then `_ranks` then `auc_from_ranks`, the
    three calls `run_experiment` makes before it spends anything -- so this
    cannot drift from what the module prints. `run_experiment` reports `nan`
    below three usable values per side and so does this.
    """
    a, b = _clean(rows_a, rows_b, name)
    if len(a) < 3 or len(b) < 3:
        return None
    return auc_from_ranks(_ranks(list(a) + list(b)), range(len(a)),
                          len(a), len(b))


def measure(cache, stats):
    """One pass over both feature sets -> {key: measured quantities}."""
    survived, forgotten = labelled_sonnets()
    generated = load_generated()
    human = [(n, l) for n, l in sorted(load_sonnets().items())]
    out = {}
    for pfx, feats in (("abs", QualityFeatures), ("wi", WithinItemFeatures)):
        qf = feats()
        rs = compute(qf, survived, SONNET_SCHEME, cache, f"{pfx}son", stats)
        rf = compute(qf, forgotten, SONNET_SCHEME, cache, f"{pfx}son", stats)
        rh = compute(qf, human, SONNET_SCHEME, cache, f"{pfx}son", stats)
        rg = compute(qf, generated, SONNET_SCHEME, cache, f"{pfx}gen", stats)
        for key, ra, rb, la, lb in ((f"{pfx}_exp1", rs, rf, "survived",
                                     "forgotten"),
                                    (f"{pfx}_exp2", rh, rg, "human",
                                     "generated")):
            # `report_joint` is called rather than reimplemented: it is the
            # function that PRINTS the two numbers RESULTS.md quotes, and a
            # reimplementation would pin a number this module does not
            # produce.
            buf = io.StringIO()
            with redirect_stdout(buf):
                full = report_joint(ra, rb, la, lb, feats, SOLO[feats])
            text = buf.getvalue()
            m_all, m_solo = _ALL_RE.search(text), _SOLO_RE.search(text)
            out[key] = {
                "n_pos": len(ra), "n_neg": len(rb),
                "n_features": len(feats.NAMES),
                "joint_all": full,
                "joint_solo": joint_classifier(ra, rb, names=SOLO[feats],
                                               feats=feats),
                "printed_all": m_all.group(2) if m_all else None,
                "printed_solo": m_solo.group(1) if m_solo else None,
                "printed_n_features": int(m_all.group(1)) if m_all else None,
                "features": {n: feature_auc(ra, rb, n) for n in feats.NAMES},
            }
    return out


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    cache_path = None
    for a in list(argv):
        if a.startswith("--cache="):
            cache_path = a.split("=", 1)[1]
            argv.remove(a)
    if argv:
        raise SystemExit(f"unknown arguments: {argv}\nusage: "
                         f"test_discriminate.py [--cache=PATH]")

    t_wall, t_cpu = time.perf_counter(), time.process_time()

    print("=" * 74)
    print("DISCRIMINATE — the eight joint AUCs and the thirty-six per-feature "
          "AUCs")
    print("=" * 74)

    identity = cache_identity()
    absent = sorted(k for k, v in identity["resources"].items()
                    if v == "ABSENT")
    print(f"  fingerprint  {fingerprint(identity)}")
    for k, v in sorted(identity["sources"].items()):
        print(f"    src  {k:24s} {v}")
    for k, v in sorted(identity["resources"].items()):
        print(f"    res  {k:24s} {v}")

    # --- REFUSAL, before anything is spent ---------------------------------
    # Doctrine 20. None of the three resource files is tracked in git, so a
    # fresh checkout has none of them and `QualityFeatures()` raises
    # SystemExit on the missing concreteness norms before a single AUC is
    # reached. That is not this test failing; it is this test unable to run.
    if absent:
        print("\n  REFUSED — a DECLARED coordinate of every feature vector is "
              "absent:")
        for k in absent:
            print(f"      {k}")
        print("  These are quality/discriminate.py's own RESOURCE_FILES. Run "
              "`python3 quality/fetch_data.py` first.")
        print("\nRESULT: REFUSED (not a pass, not a failure — doctrine 20)")
        return 2

    # --- cold or warm, said out loud before any number ----------------------
    if cache_path is None:
        cache, status = {}, ("COLD — no cache file read or written (the "
                             "default)")
    else:
        cache, _fp, why = load_cache(identity, cache_path)
        status = (f"WARM — {cache_path} : {why}" if cache
                  else f"COLD — {cache_path} : {why}")
    stats = {"reused": 0, "computed": 0}
    print(f"  cache        {status}")
    print(f"  tolerance    {TOL} absolute on every AUC "
          f"(half of the last decimal the record quotes)")
    print()

    got = measure(cache, stats)

    print(f"\n  vectors      {stats['computed']} computed / "
          f"{stats['reused']} reused in-run / {len(cache)} held")
    check(f"a full pass holds exactly {PINNED_VECTORS} feature vectors",
          len(cache) == PINNED_VECTORS,
          f"committed {PINNED_VECTORS}, measured {len(cache)} — a moved count "
          f"is a moved CORPUS, which would move every AUC below for a reason "
          f"that has nothing to do with the comparator")

    for key in ("abs_exp1", "abs_exp2", "wi_exp1", "wi_exp2"):
        pin, arm = PINNED[key], got[key]
        print(f"\n-- {key}   {pin['label']}")

        for field in ("n_pos", "n_neg", "n_features"):
            check(f"{key}: {field}", arm[field] == pin[field],
                  f"committed {pin[field]}, measured {arm[field]}")
        check(f"{key}: the module PRINTS the feature count it fitted on",
              arm["printed_n_features"] == pin["n_features"],
              f"printed {arm['printed_n_features']}, "
              f"committed {pin['n_features']}")

        close(f"{key}: joint held-out AUC, all {pin['n_features']} features",
              arm["joint_all"], pin["joint_all"])
        close(f"{key}: joint held-out AUC, predictability only",
              arm["joint_solo"], pin["joint_solo"])

        # The rendered strings are what RESULTS.md and audit_joint_auc_null.py
        # quote. Graded separately from the floats so a value that drifts
        # across a rounding boundary is visible as a rounding boundary rather
        # than as an unexplained string mismatch.
        check(f"{key}: printed 'all features' figure renders the pin",
              arm["printed_all"] == f"{pin['joint_all']:.3f}",
              f"printed {arm['printed_all']!r}, "
              f"pin renders {pin['joint_all']:.3f}")
        solo = SOLO[QualityFeatures if key.startswith("abs")
                    else WithinItemFeatures]
        check(f"{key}: the solo column is the feature list this test names",
              arm["printed_solo"] == f"{arm['joint_solo']:.3f}",
              f"report_joint printed {arm['printed_solo']!r}; "
              f"joint_classifier on {solo} gives {arm['joint_solo']:.3f} — "
              f"if these disagree, report_joint's hard-coded solo list has "
              f"moved and the joint_solo pin above is about a column nobody "
              f"prints")

        for name, want in pin["features"].items():
            close(f"{key}: {name}", arm["features"].get(name), want)

    if cache_path is not None and stats["computed"]:
        # Only ever the path a caller named. `data/feature_cache.json` is
        # never touched by this file: a test that writes the module's own
        # cache would warm the next run into agreeing with it.
        save_cache(cache, identity, cache_path)
        print(f"\n  wrote {len(cache)} vectors to {cache_path}")

    wall = time.perf_counter() - t_wall
    cpu = time.process_time() - t_cpu
    print(f"\n{'=' * 74}")
    print(f"  cost   wall {wall:7.1f}s   CPU {cpu:7.1f}s   "
          f"({stats['computed']} extractions)")
    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        for f in FAIL:
            print(f"  FAILED: {f}")
        print("\n  Every figure above is deterministic given the corpus and "
              "the code — no")
        print("  draw is taken on this path — so a delta here is a real "
              "change in the")
        print("  comparator or in the corpus, never noise. The shape pins say "
              "which.")
        print("  Repin with the date and keep the superseded value visible "
              "(doctrine 17).")
    print("\nRESULT:", "PASS" if not FAIL else "FAIL")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())

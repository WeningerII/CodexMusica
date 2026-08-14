#!/usr/bin/env python3
"""Cross-linguistic regression tests for the quality layer.

Every test here encodes a failure that was found by running the code against a
tradition it was never designed for. Per the project's test discipline: every
fixed case becomes a permanent regression.

Run: python3 quality/test_crosslinguistic.py
"""

import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.features import QualityFeatures  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# ---------------------------------------------------------------------------
# 1. Radif blindness
# ---------------------------------------------------------------------------

GHAZAL = [
    "You gathered all the failing light tonight",
    "and set the empty room alight tonight",
    "The sparrows argue out of sight tonight",
    "a hand undoes the given rite tonight",
]

# Same radif, same form, but the qafiya are the four most obvious rhymes in
# the language. A predictability measure that cannot separate this from the
# above is measuring nothing.
GHAZAL_OBVIOUS = [
    "You gathered all the failing light tonight",
    "and everything turned out all right tonight",
    "The birds have flown clean out of sight tonight",
    "a hand let go and held on tight tonight",
]


def test_radif():
    print("\n1. RADIF (Persian/Urdu/Turkish/Arabic ghazal structure)")
    qf = QualityFeatures()
    pairs = QualityFeatures.pairs_from_scheme("AAAA")

    call, answer, k = QualityFeatures._strip_radif(GHAZAL[0], GHAZAL[1])
    check("radif is detected and stripped",
          k == 1 and call == "light" and answer == "alight",
          f"stripped {k} word(s) -> call={call!r} answer={answer!r}")

    vals = [v for _i, _j, v in qf._predictability(GHAZAL, pairs)]
    spread = (max(vals) - min(vals)) if vals else 0.0
    check("per-pair values are not all identical",
          len(vals) >= 2 and spread > 1e-9,
          f"n={len(vals)} spread={spread:.6f} vals={[round(v, 4) for v in vals]}")

    a = qf.extract(GHAZAL, "AAAA")["rhyme_predictability_mean"]
    b = qf.extract(GHAZAL_OBVIOUS, "AAAA")["rhyme_predictability_mean"]
    check("obvious qafiya scores as more predictable than distinctive qafiya",
          math.isfinite(a) and math.isfinite(b) and b > a,
          f"distinctive={a:.4f}  obvious={b:.4f}")


# ---------------------------------------------------------------------------
# 2. Non-English input must not produce confident numbers
# ---------------------------------------------------------------------------

PERSIAN_SCRIPT = [
    "دل می رود ز دستم صاحبدلان خدا را",
    "دردا که راز پنهان خواهد شد آشکارا",
]
PERSIAN_TRANSLIT = [
    "dil mi ravad zi dastam sahibdilan khuda ra",
    "dardaa ke raaz penhaan khwahad shud aashkaara",
]


def test_non_english():
    print("\n2. NON-ENGLISH INPUT (must fail loudly, not quietly)")
    qf = QualityFeatures()
    for label, lines in (("Persian script", PERSIAN_SCRIPT),
                         ("transliterated", PERSIAN_TRANSLIT)):
        v = qf.extract(lines, "AA")["rhyme_predictability_mean"]
        check(f"{label}: returns NaN rather than a confident value",
              not math.isfinite(v), f"got {v!r}")


# ---------------------------------------------------------------------------
# 3. Monorhyme length confound
# ---------------------------------------------------------------------------

def test_monorhyme_length_confound():
    """Monorhyme draws WITHOUT replacement -- a rhyme word cannot be reused --
    so a longer monorhyme poem is forced deeper into the candidate field
    regardless of the writer's skill. Documents the size of the bias; it is a
    property of the form, not a bug to be fixed in code, and any monorhyme
    cell must regress predictability on line count before interpreting it."""
    print("\n3. MONORHYME LENGTH CONFOUND (documented, not fixed)")
    random.seed(1)
    F, TRIALS = 300, 4000

    def poem(n, skill=0.10):
        used, vals = set(), []
        for _ in range(n):
            while True:
                p = min(int(random.expovariate(1.0 / (skill * F))), F - 1)
                if p not in used:
                    used.add(p)
                    break
            vals.append(1 - p / F)
        return sum(vals) / len(vals)

    means = {n: sum(poem(n) for _ in range(TRIALS)) / TRIALS
             for n in (2, 10, 40)}
    for n, m in means.items():
        print(f"          {n:>2} couplets -> {m:.4f}")
    drift = means[2] - means[40]
    check("length confound is present and its size is recorded",
          drift > 0.005,
          f"same skill, 2 vs 40 couplets differ by {drift:.4f} "
          f"-- longer monorhyme poems look less predictable for free")


# ---------------------------------------------------------------------------
# 4. Ordinary English end rhyme must be unaffected by the radif fix
# ---------------------------------------------------------------------------

SONNET_QUATRAIN = [
    "That time of year thou mayst in me behold",
    "When yellow leaves, or none, or few, do hang",
    "Upon those boughs which shake against the cold",
    "Bare ruined choirs, where late the sweet birds sang",
]


def test_english_unaffected():
    print("\n4. ENGLISH CONTROL (radif fix must be a no-op here)")
    qf = QualityFeatures()
    _, _, k = QualityFeatures._strip_radif(SONNET_QUATRAIN[0],
                                           SONNET_QUATRAIN[2])
    check("no radif detected in ordinary end rhyme", k == 0, f"k={k}")
    v = qf.extract(SONNET_QUATRAIN, "ABAB")["rhyme_predictability_mean"]
    check("still produces a finite value", math.isfinite(v), f"got {v:.4f}")


if __name__ == "__main__":
    test_radif()
    test_non_english()
    test_monorhyme_length_confound()
    test_english_unaffected()
    print(f"\n{'=' * 60}")
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all cross-linguistic regressions pass")

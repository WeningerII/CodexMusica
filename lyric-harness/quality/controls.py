#!/usr/bin/env python3
"""Controls and calibration — blockers 2 and 3.

BLOCKER 2: THE POSITIVE CONTROL WAS AN IDENTITY

The drafted design built its "twin" by replacing each realised rhyme partner
with the highest-frequency member of its own candidate field. But the
predictability feature is *defined* as the percentile of the realised partner
within that field, so in the twin the partner IS the maximum by construction
and the feature equals its ceiling exactly, every item, every cell. A
permutation test on that returns the smallest p the test can express.

That is not a control, it is an identity, and it cascaded: frequency-delta,
function-word share, type-ratio and final-length all became deterministic under
the same substitution. Roughly 52 of the 80 tests in that arm were tautologies.

FIX: build the twin by SHUFFLING realised rhyme partners between items within a
cell. That preserves each cell's marginal distribution of rhyme words -- so
frequency, length and word-class composition are all held fixed -- while
destroying the item-specific *choice*, which is the only thing the features
claim to measure.

BLOCKER 3: THE CALIBRATOR FIRED BY ZIPF'S LAW

The design nominated a final-length feature as the negative control whose
discovery rate calibrates the multiple-comparison correction. Frequency and
length are inversely related in every language, so it fires by Zipf alone,
which voids the correction or invites a post-hoc rescue of the calibrator.

FIX: stop nominating a feature at all. Permute the LABELS within a cell and run
the whole battery. The discovery rate under permuted labels is the empirical
false-positive rate by construction, needs no feature to be assumed neutral,
and cannot be argued with afterwards.
"""

import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))


# ---------------------------------------------------------------------------
# Blocker 2 — the shuffle twin
# ---------------------------------------------------------------------------

def shuffle_twin(items, rhyme_words_of, seed=20260809):
    """Redistribute realised rhyme words across items within one cell.

    `items` is any sequence; `rhyme_words_of(item)` returns that item's list of
    realised rhyme words. Returns [(item, replacement_words)].

    The multiset of rhyme words in the cell is EXACTLY preserved -- this is a
    permutation, not a resample -- so every marginal the features could
    accidentally be reading (frequency, length, word class) is held constant.
    Only the pairing of word to item is destroyed.
    """
    per_item = [list(rhyme_words_of(it)) for it in items]
    flat = [w for words in per_item for w in words]
    rng = random.Random(seed)
    rng.shuffle(flat)
    out, k = [], 0
    for it, words in zip(items, per_item):
        out.append((it, flat[k:k + len(words)]))
        k += len(words)
    return out


def twin_is_degenerate(values, tol=1e-9):
    """True if a control's feature values carry no variance.

    The old twin produced a constant, and a constant is what an identity looks
    like from the outside. Any control must be run through this before its
    p-values are believed.
    """
    finite = [v for v in values if v is not None and v == v]
    if len(finite) < 2:
        return True
    return (max(finite) - min(finite)) < tol


# ---------------------------------------------------------------------------
# Blocker 3 — permuted-label calibration
# ---------------------------------------------------------------------------

def permuted_label_null(labels, score_fn, n_perm=200, seed=20260809):
    """Empirical false-positive rate under label permutation.

    `score_fn(permuted_labels)` must return an iterable of p-values, one per
    feature, computed exactly as in the real run. Returns a dict with the
    per-permutation discovery counts and the observed FPR at each alpha.

    This replaces "nominate a feature and assume it is neutral". Under a
    permuted label there is, by construction, no signal to find, so whatever
    the battery discovers is its own false-positive rate -- including any
    mechanical artifact the features share.
    """
    rng = random.Random(seed)
    labels = list(labels)
    alphas = (0.10, 0.05, 0.01)
    hits = {a: 0 for a in alphas}
    per_perm = []
    for _ in range(n_perm):
        perm = labels[:]
        rng.shuffle(perm)
        pvals = [p for p in score_fn(perm) if p is not None]
        per_perm.append(pvals)
        for a in alphas:
            if any(p <= a for p in pvals):
                hits[a] += 1
    return {
        "n_perm": n_perm,
        "family_wise_fpr": {a: hits[a] / n_perm for a in alphas},
        "mean_discoveries": {
            a: sum(sum(1 for p in ps if p <= a) for ps in per_perm) / n_perm
            for a in alphas},
    }


def calibrated_threshold(null_result, target_fpr=0.05):
    """Pick the alpha whose measured family-wise FPR is closest to target,
    from below. Reported alongside the nominal alpha so the gap is visible."""
    fw = null_result["family_wise_fpr"]
    ok = [a for a, f in sorted(fw.items()) if f <= target_fpr]
    return max(ok) if ok else min(fw)


if __name__ == "__main__":
    print("BLOCKER 2 — old twin vs shuffle twin, on a toy cell\n")
    items = [f"poem{i}" for i in range(6)]
    realised = {"poem0": ["fire", "desire"], "poem1": ["obstacle", "article"],
                "poem2": ["night", "light"], "poem3": ["hinge", "orange"],
                "poem4": ["sang", "hang"], "poem5": ["deed", "need"]}
    field_max = {"fire": "the", "desire": "the", "obstacle": "of",
                 "article": "of", "night": "not", "light": "not",
                 "hinge": "in", "orange": "in", "sang": "and", "hang": "and",
                 "deed": "did", "need": "did"}

    old = [[field_max[w] for w in realised[i]] for i in items]
    old_pred = [1.0 for _ in old]        # by construction: partner == field max
    print("  OLD twin (replace with field maximum)")
    print(f"    predictability values: {old_pred}")
    print(f"    degenerate? {twin_is_degenerate(old_pred)}  <- an identity\n")

    new = shuffle_twin(items, lambda i: realised[i])
    print("  SHUFFLE twin (permute realised partners within the cell)")
    for it, words in new:
        print(f"    {it}: {realised[it]} -> {words}")
    flat_in = sorted(w for i in items for w in realised[i])
    flat_out = sorted(w for _, ws in new for w in ws)
    print(f"    multiset preserved exactly? {flat_in == flat_out}")

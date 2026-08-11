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

BLOCKER 4 (added 2026-08-11): THE OWED NULL FOR THE SPAN MULTISET

`BACKLOG.md` 4.2 / `MISSING.md` L-2 record that the time layer's word scramble
is an IDENTITY MAP -- 29.1% real against 29.0% scrambled -- because an item's
smallest attainable p is set by how many chance re-pairings of ITS OWN spans
are perfect rhymes, and a word scramble preserves the span multiset exactly.
The owed item was written as "a null that destroys the span multiset -- across
items rather than within one".

`cross_item_redeal` below is that null, built and MEASURED. It is also an
identity map, and the measurement says why: see `quality/RESULTS_NULL_SHAPES.md`
and the constructor's own docstring. `rime_pool_redeal` is the detection floor
that makes the first sentence believable rather than assertable (doctrines
31/76) -- it moves the same quantity by 55x, so the instrument is not blind.

Everything here is language-agnostic: the caller supplies `tokenize` and
`shape_of`, so the same constructors serve English through CMUdict and any
`quality.phonology` module.
"""

import os
import random
import sys
from collections import Counter

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


# ---------------------------------------------------------------------------
# Blocker 4 — the cross-item redeal, and the detection floor that reads it
# ---------------------------------------------------------------------------

def _bucket(items, tokenize, shape_of):
    """-> (per-item Counter of (shape, word), total Counter)."""
    per = []
    for lines in items:
        c = Counter()
        for ln in lines:
            for w in tokenize(ln):
                c[(shape_of(w), w)] += 1
        per.append(c)
    total = Counter()
    for c in per:
        total.update(c)
    return per, total


def _pools(counter):
    out = {}
    for (k, w), n in counter.items():
        out.setdefault(k, []).extend([w] * n)
    return out


def cross_item_redeal(items, tokenize, shape_of, seed=20260811):
    """THE NULL `BACKLOG.md` 4.2 ASKS FOR, AND IT IS ALSO AN IDENTITY MAP.

    Rebuild each item word by word, drawing every replacement from the pooled
    vocabulary of the OTHER items (leave-one-out, so no item's null is drawn
    from itself -- doctrine 13) and matching on `shape_of(word)`.

    PRESERVES, when `shape_of` returns the word's (syllable count, stress
    pattern): the line count, the word count per line, the syllable count per
    word, hence the syllable stream length, the stress grid, the eligible slot
    set and the candidate-pair geometry. Also the corpus-level word frequency
    distribution and the declaration.
    DESTROYS: which particular words share an item -- i.e. the item's private
    inventory of rime classes, which is what the owed null names.

    AND THAT DESTRUCTION BUYS NOTHING, WHICH IS THE FINDING. Measured over 20
    Shakespeare sonnets at the shipped time-layer settings:

        arm                 band_pass   r@theta     min_p
        REAL                   0.0572    0.0135   0.00253
        word scramble          0.0601    0.0148   0.00290   <- the known
                                                               identity map
        cross-item redeal      0.0599    0.0144   0.00239   <- and so is this

    The quantity `MISSING.md` L-2 names -- how many chance re-pairings of an
    item's own spans are perfect rhymes -- is not a property of the ITEM. It is
    the rime-class entropy of ENGLISH at this register, and 20 sonnets by one
    author have the same rime marginal as any one of them (269 rime classes
    over 937 word types). So re-dealing English words cannot move it, for the
    same reason re-ordering them cannot: neither operation changes the
    language.

    This is a FIFTH shape of the identity-map trap, and it is the one that does
    not yield to a better randomisation. Doctrine 63 caught a predicate that is
    symmetric over a line's word multiset; 68 caught permuting identical
    elements; 75 caught a null right for one predicate and wrong for another;
    90 caught a right null on a wrong statistic. This is a statistic that is a
    function of a LANGUAGE CONSTANT, where no within-corpus randomisation can
    be a null at all -- because the thing that would have to vary is held fixed
    by the corpus being in one language.

    Returns `(redealt_items, stats)`; `stats` counts exact-shape draws,
    syllable-count-only fallbacks and words kept because no pool existed, so a
    reader can see how matched the redeal actually was (doctrine 79's habit:
    the fallbacks are their own count, never folded into the total).
    """
    per, total = _bucket(items, tokenize, shape_of)
    rng = random.Random(seed)
    stats = Counter()
    out = []
    for i, lines in enumerate(items):
        pools = _pools(total - per[i])
        by_len = {}
        for k, v in pools.items():
            by_len.setdefault(len(k) if hasattr(k, "__len__") else 0,
                              []).extend(v)
        new = []
        for ln in lines:
            words = []
            for w in tokenize(ln):
                k = shape_of(w)
                if pools.get(k):
                    stats["exact"] += 1
                    words.append(rng.choice(pools[k]))
                    continue
                n = len(k) if hasattr(k, "__len__") else 0
                if by_len.get(n):
                    stats["count_only"] += 1
                    words.append(rng.choice(by_len[n]))
                else:
                    stats["kept"] += 1
                    words.append(w)
            new.append(" ".join(words))
        out.append(new)
    return out, stats


def rime_pool_redeal(items, tokenize, shape_of, rime_of, mode="mono",
                     seed=20260811):
    """THE DETECTION FLOOR for `cross_item_redeal`, not a control.

    Doctrine 76: a null is only as good as the demonstration that the
    instrument could have found something. `cross_item_redeal` reports no
    movement; these two arms establish that the same measurement DOES move,
    and by how much, so "no movement" is a reading rather than a shrug.

    mode="mono"       every word is replaced from the corpus's LARGEST single
                      rime class (shape-matched where possible). Rime-class
                      entropy collapses; chance re-pairings become rhymes.
    mode="dispersed"  each word is replaced by one whose rime class has not
                      been used in this item yet. Entropy is maximised.

    Measured over the same 20 sonnets:

        arm                    band_pass   r@theta     min_p
        REAL sonnets              0.0572    0.0135   0.00253
        mono-rime redeal          0.4182    0.1482   0.02987    11.8x min_p
        dispersed redeal          0.0368    0.0079   0.00054     0.21x min_p

    A 55-fold span between the two arms, against a 0.94x move under the
    cross-item redeal. Neither arm is admissible as a null -- both change the
    language's rime distribution, which is the one thing a matched control may
    not do -- and that is exactly why they belong here and not in the table of
    results.
    """
    _, total = _bucket(items, tokenize, shape_of)
    # DOCTRINE 66. `set(words)` iterates in an order that depends on
    # PYTHONHASHSEED, and `rng.choice` over a list built from it returns a
    # different word on every interpreter run -- which made the first version
    # of this function print band_pass 0.4187 and 0.4099 on two runs of the
    # same seed. Sorting is the whole fix and it has to be here, not at the
    # call site.
    words = sorted(w for (_, w), n in total.items() for _ in range(n))
    types = sorted(set(words))
    by_shape, by_rime = {}, {}
    for w in types:
        by_shape.setdefault(shape_of(w), []).append(w)
        by_rime.setdefault(rime_of(w), []).append(w)
    biggest = max((v for k, v in sorted(by_rime.items(), key=lambda kv: len(kv[1]))
                   if k is not None), key=len, default=list(types))
    rng = random.Random(seed)
    out = []
    for lines in items:
        used = set()
        new = []
        for ln in lines:
            picked = []
            for w in tokenize(ln):
                sh = shape_of(w)
                if mode == "mono":
                    cand = [x for x in biggest if shape_of(x) == sh] or biggest
                else:
                    cand = ([x for x in by_shape.get(sh, [])
                             if rime_of(x) not in used]
                            or by_shape.get(sh) or types)
                x = rng.choice(cand)
                used.add(rime_of(x))
                picked.append(x)
            new.append(" ".join(picked))
        out.append(new)
    return out


def differs(observed, replicates, key, tol=1e-9):
    """Doctrine 68, made a function instead of a habit.

    -> (n_differing, n_replicates). `key` reduces one arm to the scalar under
    test. A randomisation whose replicates all return `key(observed)` is not
    conservative and is not weak; it TESTS NOTHING, and the only way to know is
    to count. `twin_is_degenerate` above catches the same failure from the
    other side -- a control with no variance across ITEMS -- and the two
    together are the pair this repo has needed four separate times.
    """
    base = key(observed)
    n = sum(1 for r in replicates if abs(key(r) - base) > tol)
    return n, len(replicates)


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

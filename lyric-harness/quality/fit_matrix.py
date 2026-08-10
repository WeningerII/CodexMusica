#!/usr/bin/env python3
"""Fitted substitution matrix — closes known gap 2, resolves doctrine 5.

Read `quality/MATRIX_PREREGISTRATION.md` first; the predictions and the
tripwire are there.

THE DEFECT THIS REPLACES

The comparator is additive over channels with hand-set weights, and two
channels pay out unconditionally at the anchor. The anchor is *defined* as the
last primary stress, so both sides are stressed by construction and the stress
channel hands over its full 0.15 to every pair, rhyming or not. And
`cluster_sim([], [])` returns 1.0, so two open syllables collect the whole 0.35
coda weight for having nothing in common. A pair sharing nothing floors at
0.15; two open stressed syllables floor at 0.50. `sun`/`much` reaches 0.772
against a band threshold of 0.75.

THE SHAPE OF THE FIX

    LO(a, b) = log2 [ P(a, b | rhyme) / (P(a) * P(b)) ]

summed over channels, which is a log-likelihood ratio under conditional
independence. This is not a re-tuning. It gives the scale a true zero: a
substitution no more likely under rhyme than under chance scores 0, one less
likely scores negative, and nothing can accumulate from a channel that carries
no information. A channel constant by construction contributes ~0 *because it
earns nothing*, not because someone zeroed it.

It also removes `channel_weights` and `channel_weights_interior`. How much the
nucleus matters relative to the coda is no longer a hand-set number; it falls
out of how informative each channel actually is.

INDEPENDENCE

Doctrine 13: a matrix fitted on the sonnets may not score those sonnets. Every
evaluation number is k-fold cross-validated. `fit_folds()` produces the
held-out matrices; `fit_all()` produces a shippable one, and they are stored
under different names so they cannot be confused at the call site.
"""

import json
import math
import os
import random
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import (CONSONANTS, VOWELS, Declaration,  # noqa: E402
                           Lexicon, anchor, cons_sim, line_anchors, syllabify,
                           vowel_sim)

GAP = "-"          # cluster alignment gap symbol
NULL = "0"         # "this channel is empty on this side"


@dataclass
class MatrixDeclaration:
    """Everything the fit assumes, in one place (doctrine 1)."""
    #: concentration of the hand-set-similarity prior. Higher = more shrinkage
    #: toward current behaviour, so low-count cells never fall off a cliff.
    alpha: float = 40.0
    #: background pairs drawn per positive pair
    background_ratio: int = 4
    #: k for cross-validation. Every reported number is held out.
    folds: int = 5
    seed: int = 20260810
    #: log-odds are clipped so one unseen substitution cannot dominate a sum
    clip: float = 6.0
    #: EVIDENCE SHRINKAGE. Each cell's log-odds is multiplied by
    #: n / (n + kappa), so a cell with no observations scores 0 -- "as likely
    #: as chance", which is what no evidence means -- instead of inheriting a
    #: large value from the prior divided by a tiny marginal product.
    #:
    #: This was found by the P8 tripwire. Before it, the top learned nucleus
    #: correspondences were UH~OY at +3.81 bits, OY~ER at +1.37, OY~AW at
    #: +1.26 -- all on ZERO observations in both classes. OY is 0.1% of the
    #: corpus, so its marginal product is ~1e-5 and the smoothing prior alone
    #: produced apparent confidence. Seven of the top twelve were this
    #: artifact. The genuine correspondence underneath, UW~AH at 22 positive
    #: observations against a 4.2x background rate, survives the shrinkage.
    kappa: float = 10.0
    #: POST-HOC, found by the P5 negative control. The stress channel is
    #: CONDITIONING information -- it says which anchors are comparable -- not
    #: rhyme evidence, and putting it in a likelihood ratio whose background
    #: model treats it as independent is a modelling error.
    #:
    #: Left on, the registered fit gave stress ('1','1') the ~0 it was
    #: predicted (-0.107 bits) and then handed ('0','0') +5.71 bits, on 200
    #: real observations: when one anchor is unstressed via final promotion
    #: the other usually is too, which is true and is not evidence of rhyme.
    #: Whitman's long free-verse lines end unstressed constantly, so the
    #: negative control went from 18.7% captured to 63.3% at matched FPR. The
    #: fix removed one unconditional gift and introduced another; the control
    #: is what caught it.
    use_stress_channel: bool = False
    source: str = "unset"
    n_positive: int = 0
    fitted_on: tuple = ()
    holdout: str = ""


# ---------------------------------------------------------------------------
# Observations
# ---------------------------------------------------------------------------

def anchor_of(lex, word, decl):
    ancs, _, _ = line_anchors(lex, word, promote=decl.final_promotion)
    return ancs[0] if ancs else None


def channel_observations(anc_a, anc_b):
    """-> [(channel, sym_a, sym_b)] for one aligned anchor pair.

    Alignment is the harness's own: left-aligned at the stressed syllable,
    channel by channel. Clusters are compared position by position from the
    right, which is where a coda's rhyme-bearing weight sits, with NULL for a
    side that has run out.
    """
    obs = []
    n = min(len(anc_a), len(anc_b))
    for i in range(n):
        sa, sb = anc_a[i], anc_b[i]
        obs.append(("nucleus", sa["nucleus"], sb["nucleus"]))
        obs.append(("stress", str(int(sa["stress"] > 0)),
                    str(int(sb["stress"] > 0))))
        for ch in ("coda", "onset"):
            if i == 0 and ch == "onset":
                continue          # the first onset is excluded by definition
            ca, cb = list(sa[ch]), list(sb[ch])
            w = max(len(ca), len(cb))
            for k in range(w):
                # from the right: the cluster edge nearest the nucleus tail
                x = ca[len(ca) - w + k] if len(ca) - w + k >= 0 else NULL
                y = cb[len(cb) - w + k] if len(cb) - w + k >= 0 else NULL
                obs.append((ch, x, y))
    return obs


def collect(lex, pairs, decl):
    """-> Counter over (channel, a, b), symmetrised."""
    c = Counter()
    for wa, wb in pairs:
        aa, ab = anchor_of(lex, wa, decl), anchor_of(lex, wb, decl)
        if not aa or not ab:
            continue
        for ch, x, y in channel_observations(aa, ab):
            c[(ch, x, y)] += 1
            c[(ch, y, x)] += 1
    return c


# ---------------------------------------------------------------------------
# The fit
# ---------------------------------------------------------------------------

def _alphabet(channel):
    if channel == "nucleus":
        return sorted(VOWELS)
    if channel == "stress":
        return ["0", "1"]
    return sorted(CONSONANTS) + [NULL]


def _prior(channel, a, b):
    """Hand-set similarity as the prior. Low-count cells fall back to current
    behaviour rather than to noise."""
    if a == b:
        return 1.0
    if channel == "nucleus":
        return max(1e-3, vowel_sim(a, b)) if a in VOWELS and b in VOWELS \
            else 1e-3
    if channel == "stress":
        return 1e-3
    if a == NULL or b == NULL:
        return 0.05           # deletion: rare but real
    if a in CONSONANTS and b in CONSONANTS:
        return max(1e-3, cons_sim(a, b))
    return 1e-3


def fit(pos_counts, bg_counts, mdecl):
    """-> {channel: {(a, b): log-odds}}.

    P(a,b | rhyme) is smoothed toward the hand-set similarity prior with
    concentration alpha. The chance model is the product of the BACKGROUND
    marginals, so the log-odds cannot learn a corpus-vs-dictionary difference
    and report it as rhyme.
    """
    out = {}
    for ch in ("nucleus", "coda", "onset", "stress"):
        alpha = mdecl.alpha
        syms = _alphabet(ch)
        prior = {(a, b): _prior(ch, a, b) for a in syms for b in syms}
        z = sum(prior.values()) or 1.0
        joint = {k: v / z for k, v in prior.items()}

        obs = {(a, b): pos_counts.get((ch, a, b), 0)
               for a in syms for b in syms}
        n_obs = sum(obs.values())
        post = {k: (obs[k] + alpha * joint[k]) / (n_obs + alpha)
                for k in obs}

        # chance: independent draw from the BACKGROUND marginals
        bm = Counter()
        for (c2, a, b), v in bg_counts.items():
            if c2 == ch:
                bm[a] += v
                bm[b] += v
        tot = sum(bm.values())
        if tot == 0:
            marg = {s: 1.0 / len(syms) for s in syms}
        else:
            floor = 1e-4
            marg = {s: max(floor, bm.get(s, 0) / tot) for s in syms}
            zz = sum(marg.values())
            marg = {s: v / zz for s, v in marg.items()}

        lo = {}
        for (a, b), p in post.items():
            q = marg[a] * marg[b]
            if p <= 0 or q <= 0:
                raw = -mdecl.clip
            else:
                raw = max(-mdecl.clip, min(mdecl.clip, math.log2(p / q)))
            # Evidence shrinkage. No observations means no evidence of
            # enrichment, so the cell goes to 0 -- "as likely as chance" --
            # rather than inheriting the prior over a tiny marginal product.
            n = obs[(a, b)]
            denom = n + mdecl.kappa
            # kappa = 0 means "no shrinkage"; with n = 0 that is 0/0, and the
            # answer is the unshrunk value, which is exactly the artifact the
            # guard exists to prevent. Kept reachable so a test can show it.
            lo[(a, b)] = raw * (n / denom) if denom else raw
        out[ch] = lo
    return out


class FittedComparator:
    """Scores an anchor pair by summing per-channel log-odds.

    No channel weights. The relative contribution of nucleus, coda and onset is
    whatever the estimation says it is.
    """

    def __init__(self, matrices, mdecl=None):
        self.m = matrices
        self.mdecl = mdecl or MatrixDeclaration()

    def lo(self, channel, a, b):
        return self.m[channel].get((a, b), -self.mdecl.clip)

    def score(self, anc_a, anc_b):
        """-> total log-odds in bits, and the per-channel breakdown."""
        if not anc_a or not anc_b:
            return None, {}
        parts = defaultdict(float)
        skip = () if self.mdecl.use_stress_channel else ("stress",)
        for ch, x, y in channel_observations(anc_a, anc_b):
            if ch in skip:
                continue
            parts[ch] += self.lo(ch, x, y)
        extra = abs(len(anc_a) - len(anc_b))
        total = sum(parts.values())
        n = min(len(anc_a), len(anc_b))
        total /= max(1, n)
        if extra:
            # an unmatched trailing syllable is evidence against, at the same
            # rate the hand-set comparator used, converted to this scale by
            # the clip rather than re-tuned
            parts["length"] = -extra * abs(self.lo("nucleus", "IY", "AA"))
            total += parts["length"]
        return total, dict(parts)

    def to_json(self):
        return {
            "declaration": {k: (list(v) if isinstance(v, tuple) else v)
                            for k, v in self.mdecl.__dict__.items()},
            "matrices": {ch: {f"{a}|{b}": round(v, 4)
                              for (a, b), v in tbl.items()}
                         for ch, tbl in self.m.items()},
        }

    @classmethod
    def from_json(cls, blob):
        m = {ch: {tuple(k.split("|")): v for k, v in tbl.items()}
             for ch, tbl in blob["matrices"].items()}
        d = MatrixDeclaration(**{k: (tuple(v) if isinstance(v, list) else v)
                                 for k, v in blob["declaration"].items()})
        return cls(m, d)

    @classmethod
    def load(cls, path):
        with open(path, encoding="utf-8") as fh:
            return cls.from_json(json.load(fh))


# ---------------------------------------------------------------------------
# Training pairs from scheme-labelled corpora
# ---------------------------------------------------------------------------

def mandated_pairs(lines, scheme):
    """The pairs a declared scheme mandates. Rhymes by the FORM, not by
    anyone's judgement — which is what makes them admissible."""
    if len(scheme) != len(lines):
        return []
    groups = defaultdict(list)
    for i, ch in enumerate(scheme):
        groups[ch].append(i)
    out = []
    for idxs in groups.values():
        for a in range(len(idxs)):
            for b in range(a + 1, len(idxs)):
                out.append((idxs[a], idxs[b]))
    return out


def endword(line):
    """The rhyme-bearing word at the end of a line.

    The curly-apostrophe normalization is load-bearing and was missing in the
    first version of this file. Gutenberg's sonnets use U+2019, which is not in
    the token character class, so `prepar’d` split into `prepar` and `d` and
    the LAST token -- the end word -- became the bare letter "d". It appeared
    75 times, with "st" 6 and "er" 1, and 95 of 1028 mandated training pairs
    (9.2%) had a corrupted side. `word_syllable_map` in the harness has always
    normalized it; this function did not, so the fitted matrix was trained on
    a tenth of a corpus of nonsense before this was found.
    """
    import re
    line = line.replace("’", "'").replace("‘", "'")
    toks = [t for t in re.findall(r"[A-Za-z'\-]+", line)
            if any(c.isalpha() for c in t)]
    return toks[-1].lower().strip("'-") if toks else ""


def corpus_pairs(items):
    """items: [(lines, scheme)] -> ([(word_a, word_b)], [all endwords])"""
    pos, words = [], []
    for lines, scheme in items:
        ew = [endword(l) for l in lines]
        words.extend(w for w in ew if w)
        for i, j in mandated_pairs(lines, scheme):
            if ew[i] and ew[j] and ew[i] != ew[j]:
                pos.append((ew[i], ew[j]))
    return pos, words


def background_pairs(words, n, seed):
    """Random line-final pairs from the SAME corpus, so the chance model has
    the corpus's own phoneme marginals."""
    rng = random.Random(seed)
    out = []
    for _ in range(n):
        a, b = rng.choice(words), rng.choice(words)
        if a != b:
            out.append((a, b))
    return out


# ---------------------------------------------------------------------------
# Cross-validated fitting — doctrine 13 made mechanical
# ---------------------------------------------------------------------------

def fit_folds(lex, items, mdecl=None, decl=None):
    """-> [(held_out_items, comparator)], one per fold.

    A matrix never scores an item that was in its own training set. This is the
    only way any number in RESULTS_MATRIX.md is allowed to be produced.
    """
    mdecl = mdecl or MatrixDeclaration()
    decl = decl or Declaration()
    rng = random.Random(mdecl.seed)
    idx = list(range(len(items)))
    rng.shuffle(idx)
    folds = [idx[i::mdecl.folds] for i in range(mdecl.folds)]
    out = []
    for f in range(mdecl.folds):
        test = [items[i] for i in folds[f]]
        train = [items[i] for i in idx if i not in set(folds[f])]
        pos, words = corpus_pairs(train)
        bg = background_pairs(words, len(pos) * mdecl.background_ratio,
                              mdecl.seed + f)
        pc = collect(lex, pos, decl)
        bc = collect(lex, bg, decl)
        md = MatrixDeclaration(
            **{**mdecl.__dict__, "n_positive": len(pos),
               "holdout": f"fold {f + 1}/{mdecl.folds}, "
                          f"{len(test)} items never seen in training"})
        out.append((test, FittedComparator(fit(pc, bc, md), md)))
    return out


def fit_all(lex, items, mdecl=None, decl=None, source="unset"):
    """A shippable matrix fitted on everything. NOT for evaluation — anything
    scored with this that was in `items` is circular."""
    mdecl = mdecl or MatrixDeclaration()
    decl = decl or Declaration()
    pos, words = corpus_pairs(items)
    bg = background_pairs(words, len(pos) * mdecl.background_ratio,
                          mdecl.seed)
    md = MatrixDeclaration(
        **{**mdecl.__dict__, "source": source, "n_positive": len(pos),
           "holdout": "NONE — fitted on all data. Scoring any item that was "
                      "in the training set with this matrix is circular; use "
                      "fit_folds() for evaluation."})
    return FittedComparator(fit(collect(lex, pos, decl),
                                collect(lex, bg, decl), md), md)


def calibrate_threshold(comparator, lex, bg_pairs, decl, fpr=0.05):
    """Pick the cut whose false-positive rate on RANDOM pairs is `fpr`.

    The log-odds scale has a true zero, but zero is not the operating point a
    band wants — it admits everything as likely-as-chance-or-better. The
    threshold is therefore a declared false-positive rate against the same
    background the matrix was fitted against, which is a measurement rather
    than a judgement.
    """
    scores = []
    for wa, wb in bg_pairs:
        aa, ab = anchor_of(lex, wa, decl), anchor_of(lex, wb, decl)
        if not aa or not ab:
            continue
        s, _ = comparator.score(aa, ab)
        if s is not None:
            scores.append(s)
    if not scores:
        return 0.0
    scores.sort()
    k = min(len(scores) - 1, int(round((1 - fpr) * len(scores))))
    return scores[k]


if __name__ == "__main__":
    from quality.corpus import SONNET_SCHEME, load_sonnets
    lex = Lexicon()
    decl = Declaration()
    items = [(l, SONNET_SCHEME) for _, l in sorted(load_sonnets().items())]
    pos, words = corpus_pairs(items)
    print(f"{len(items)} items, {len(pos)} mandated pairs, "
          f"{len(set(words))} distinct end words")
    comp = fit_all(lex, items, source="shakespeare-sonnets", decl=decl)
    md = MatrixDeclaration()
    bg = background_pairs(words, len(pos) * md.background_ratio, md.seed)
    pc = collect(lex, pos, decl)
    print("\ntop learned NUCLEUS correspondences (a != b), with evidence:")
    tbl = sorted(((v, k) for k, v in comp.m["nucleus"].items() if k[0] != k[1]),
                 reverse=True)
    seen = set()
    for v, (a, b) in tbl:
        if (b, a) in seen:
            continue
        seen.add((a, b))
        n = pc.get(("nucleus", a, b), 0)
        print(f"  {a:>3} ~ {b:<3}  {v:+.2f} bits   n={n}")
        if len(seen) >= 12:
            break
    print("\nstress channel (constant by construction at the anchor):")
    for k, v in sorted(comp.m["stress"].items()):
        print(f"  {k}  {v:+.3f} bits")

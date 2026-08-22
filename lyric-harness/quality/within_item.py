#!/usr/bin/env python3
"""Within-item respecification of the quality features.

See PREREGISTRATION_WITHIN_ITEM.md, committed before this file.

Every feature here compares an item's MARKED positions (the rhyme-bearing word
of each line, after radif stripping) against that same item's OWN UNMARKED
positions (everything else in the poem). The item is its own control, so era,
register, author idiolect, language typology, form, and the calibration of
whatever resource supplies a lexical norm are all shared between the two
subsets and cancel by subtraction.

This is the same operation the time-layer analysis converged on independently:
absolute rhyme-on-beat rate inverts between genres of one language (2.90x in
rap, 0.63x in sung pop), while KL of rhyme positions against that item's own
syllable positions survives.
"""

import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.features import (CONTENT_TAGS, CONC_ABSTRACT,  # noqa: E402
                              FUNCTION_TAGS, NOUN_TAGS,
                              QualityFeatures)

NAN = float("nan")


def _mean(xs):
    xs = [x for x in xs if x is not None and math.isfinite(x)]
    return sum(xs) / len(xs) if xs else NAN


def _delta(marked, unmarked):
    """Marked minus unmarked, NaN unless both subsets have support."""
    if not marked or not unmarked:
        return NAN
    a, b = _mean(marked), _mean(unmarked)
    if not (math.isfinite(a) and math.isfinite(b)):
        return NAN
    return a - b



def _oov(lex):
    """The frequency list's own 'past the end' rank, never a typed constant."""
    return getattr(lex, "freq_rank_oov", len(lex.freq_rank))

class WithinItemFeatures(QualityFeatures):

    NAMES = [
        "wi_predictability_advantage",
        "wi_concreteness_delta",
        "wi_abstract_delta",
        "wi_freq_delta",
        "wi_function_delta",
        "wi_binding_excess",
        "wi_type_ratio",
        "wi_conc_spread",
    ]

    DIRECTION = {
        "wi_predictability_advantage": "lower",
        "wi_concreteness_delta": "higher",
        "wi_abstract_delta": "lower",
        "wi_freq_delta": "higher",
        "wi_function_delta": "lower",
        "wi_binding_excess": "higher",
        "wi_type_ratio": "higher",
        "wi_conc_spread": "higher",
    }

    #: permutation draws for the binding null; fixed seed for reproducibility
    N_PERM_BINDING = 400
    SEED = 20260809

    # -- position bookkeeping --------------------------------------------

    def _marked_unmarked(self, lines, pairs):
        """Split the item's words into rhyme-bearing and the rest.

        The rhyme-bearing word is the one the anchor actually lands on, which
        after radif stripping is NOT necessarily the line-final token. Getting
        this wrong is what made the original feature blind in ghazal.
        """
        radif_len = {}
        for i, j in pairs:
            if i >= len(lines) or j >= len(lines):
                continue
            _, _, k = self._strip_radif(lines[i], lines[j])
            radif_len[i] = max(radif_len.get(i, 0), k)
            radif_len[j] = max(radif_len.get(j, 0), k)

        marked_idx = {}          # line -> index of the rhyme-bearing token
        for i, line in enumerate(lines):
            toks = self._tokens(line)
            if not toks:
                continue
            cut = len(toks) - radif_len.get(i, 0)
            if cut <= 0:
                cut = len(toks)
            marked_idx[i] = cut - 1
        return marked_idx

    def _split_tagged(self, lines, pairs):
        """-> (marked, unmarked) lists of (word, tag) for the whole item."""
        tagged = self._tag_lines(lines)
        marked_idx = self._marked_unmarked(lines, pairs)
        marked, unmarked = [], []
        for i, tl in enumerate(tagged):
            mi = marked_idx.get(i)
            for k, (w, t) in enumerate(tl):
                item = (w.lower().strip("'-.,;:!?"), t)
                (marked if k == mi else unmarked).append(item)
        return marked, unmarked, tagged, marked_idx

    # -- the eight -------------------------------------------------------

    def extract(self, lines, scheme=None, mattr_window=None):
        lines = [l for l in lines if l.strip()]
        if not lines:
            return {n: NAN for n in self.NAMES}
        if scheme and len(scheme) == len(lines):
            pairs = self.pairs_from_scheme(scheme)
        else:
            pairs = [(i, i + 1) for i in range(0, len(lines) - 1, 2)]

        marked, unmarked, tagged, marked_idx = self._split_tagged(lines, pairs)

        # 1 predictability advantage over a uniform draw from the item's own
        #   candidate fields. 0.5 is the exact expectation of a uniform draw
        #   regardless of field size, so this carries no lexicon-size term.
        pred = [v for _i, _j, v in self._predictability(lines, pairs)]
        f_pred = (_mean(pred) - 0.5) if pred else NAN

        # 2-4 lexical deltas: rhyme position vs the item's own baseline
        m_content = [w for w, t in marked if t in CONTENT_TAGS]
        u_content = [w for w, t in unmarked if t in CONTENT_TAGS]
        f_conc = _delta([self.conc[w] for w in m_content if w in self.conc],
                        [self.conc[w] for w in u_content if w in self.conc])

        m_nouns = [w for w, t in marked if t in NOUN_TAGS and w in self.conc]
        u_nouns = [w for w, t in unmarked if t in NOUN_TAGS and w in self.conc]
        f_abs = _delta(
            [1.0 if self.conc[w] < CONC_ABSTRACT else 0.0 for w in m_nouns],
            [1.0 if self.conc[w] < CONC_ABSTRACT else 0.0 for w in u_nouns])

        f_freq = _delta(
            # The sentinel is the LIST'S, read from the lexicon (see
            # `features.py`'s struck `MAX_RANK`). This module imported that
            # constant, so the stale-sentinel defect was in TWO readers and
            # fixing only the one that declared it would have left this one
            # scoring an unknown word as commoner than 60% of English.
            [self.lex.freq_rank.get(w, _oov(self.lex)) for w in m_content],
            [self.lex.freq_rank.get(w, _oov(self.lex)) for w in u_content])

        # 5 function-word share at rhyme position vs elsewhere. Cancels the
        #   typological question of what counts as a function word, because
        #   whatever the tagger's split is, it is applied to both subsets.
        f_func = _delta([1.0 if t in FUNCTION_TAGS else 0.0 for _, t in marked],
                        [1.0 if t in FUNCTION_TAGS else 0.0
                         for _, t in unmarked])

        # 6 binding excess over the item's OWN line-final tag multiset. A poem
        #   ending 90% of its lines on nouns cannot produce many differing
        #   pairs; the old raw fraction scored that as a defect.
        f_bind = self._binding_excess(tagged, marked_idx, pairs)

        # 7 rhyme-word type ratio relative to the item's own diversity.
        #   `base` carries the declared MATTR window exactly like the
        #   absolute feature does, and the window decides WHICH STATISTIC it
        #   is: at sonnet length (94-133 tokens) `base` is a real moving
        #   average, at quatrain length (23-40) it is plain TTR, because
        #   `_mattr` falls back below its own window. The subtraction does
        #   not cancel that -- the minuend is always a plain type ratio over
        #   the rhyme words -- so this feature is one statistic at one unit
        #   and another at the other, and the window is where that is decided.
        #   See `quality.floor.CALIBRATION["mattr_window"]`.
        rwords = [w for w, _ in marked]
        if rwords:
            base = self._mattr(
                [w for w, _ in marked + unmarked],
                self.mattr_window if mattr_window is None else mattr_window)
            f_type = (len(set(rwords)) / len(rwords)) - base \
                if math.isfinite(base) else NAN
        else:
            f_type = NAN

        # 8 concreteness spread inside the item -- needs no cross-item norm
        allc = [self.conc[w] for w, t in marked + unmarked
                if t in CONTENT_TAGS and w in self.conc]
        if len(allc) >= 4:
            srt = sorted(allc)
            p90 = srt[min(len(srt) - 1, int(0.9 * len(srt)))]
            p50 = srt[len(srt) // 2]
            f_spread = p90 - p50
        else:
            f_spread = NAN

        return {
            "wi_predictability_advantage": f_pred,
            "wi_concreteness_delta": f_conc,
            "wi_abstract_delta": f_abs,
            "wi_freq_delta": f_freq,
            "wi_function_delta": f_func,
            "wi_binding_excess": f_bind,
            "wi_type_ratio": f_type,
            "wi_conc_spread": f_spread,
        }

    def _binding_excess(self, tagged, marked_idx, pairs):
        """Observed differing-category fraction minus its permutation
        expectation over this item's own line-final tag multiset."""
        tags = {}
        for i, tl in enumerate(tagged):
            mi = marked_idx.get(i)
            if mi is not None and mi < len(tl):
                tags[i] = self._coarse(tl[mi][1])
        usable = [(i, j) for i, j in pairs if i in tags and j in tags]
        if len(usable) < 2:
            return NAN
        observed = sum(1.0 for i, j in usable
                       if tags[i] != tags[j]) / len(usable)
        pool = list(tags.values())
        if len(set(pool)) == 1:
            return 0.0          # no variation available: excess is exactly 0
        rng = random.Random(self.SEED)
        keys = list(tags)
        tot = 0.0
        for _ in range(self.N_PERM_BINDING):
            shuffled = pool[:]
            rng.shuffle(shuffled)
            perm = dict(zip(keys, shuffled))
            tot += sum(1.0 for i, j in usable
                       if perm[i] != perm[j]) / len(usable)
        return observed - tot / self.N_PERM_BINDING


if __name__ == "__main__":
    wf = WithinItemFeatures()
    demo = ["That time of year thou mayst in me behold",
            "When yellow leaves, or none, or few, do hang",
            "Upon those boughs which shake against the cold",
            "Bare ruined choirs, where late the sweet birds sang"]
    for k, v in wf.extract(demo, "ABAB").items():
        print(f"  {k:32s} {v:+.4f}")

#!/usr/bin/env python3
"""Quality features for the Lyric Harness.

The harness proper grades *correctness*: does this rhyme, does it scan, is the
qafiya consistent. Nothing in it grades whether the writing is any good, and a
lyric can pass every existing check and still be unreadable.

This module adds the ten features pre-registered in PREREGISTRATION.md. They are
not a quality score -- deliberately. There is no weighted sum here and there
will not be one, because the exchange rate between (say) surprise and clarity is
not derivable, it is a genre's answer. What these produce is a feature vector
that a discrimination test can check against a survival label.

Design constraint carried throughout: every feature must be computable within a
single tradition without reference to another one, so the same code can be
pointed at Arabic, Persian, Finnish or Welsh once a transcription layer exists
for them. Nothing here may hard-code an English answer as a universal.
"""

import os
import re
import sys
from bisect import bisect_left
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from lyric_harness import (Declaration, Lexicon, anchor, line_anchors,  # noqa: E402
                           score, syllabify, vowel_sim, VOWELS)

DATA = os.path.join(HERE, "..", "data")

# Closed-class Penn tags. Function words are the ones a writer does not choose.
FUNCTION_TAGS = {"DT", "IN", "PRP", "PRP$", "CC", "TO", "MD", "WDT", "WP",
                 "WP$", "WRB", "EX", "RP", "PDT", "POS", "UH"}
CONTENT_TAGS = {"NN", "NNS", "NNP", "NNPS", "VB", "VBD", "VBG", "VBN", "VBP",
                "VBZ", "JJ", "JJR", "JJS", "RB", "RBR", "RBS"}
NOUN_TAGS = {"NN", "NNS", "NNP", "NNPS"}

# Archaic verb forms NLTK's tagger mislabels; used only by the inversion check.
PERIPHRASTIC_DO = {"do", "does", "did", "dost", "doth", "didst"}

#: ~~MAX_RANK = 20000~~ STRUCK 2026-08-22. It was the size of
#: `wordfreq20k.txt`, the list this project read until the frequency source
#: was swapped to `data/opensubtitles_en_50k.tsv` -- and the constant stayed
#: behind. A sentinel that is no longer past the end of the list is not a
#: sentinel: at 49,999 entries ranked to 49,998, an out-of-vocabulary word
#: scored 20,000 came back COMMONER than 29,998 real English words, 60% of
#: the list, `thistle` (35,537) among them. Feature 10 is the RARITY of the
#: content vocabulary, so the defect ran the feature backwards on exactly the
#: words a lyric reaches for.
#: Read from the lexicon now (`Lexicon.freq_rank_oov`), so a future source
#: swap cannot leave it behind again -- doctrine 58 on its own axis: the
#: number was a coordinate of the RESOURCE, not of a threshold.
CONC_ABSTRACT = 2.5       # Brysbaert midpoint used for the abstract-noun cut

#: MATTR's moving-average window, in TOKENS. It was a bare default in
#: `_mattr`'s signature until 2026-08-14 — no comment, no declaration, no
#: results document, four call sites and not one passing it. It is a real
#: coordinate and `_mattr`'s docstring carries the sweep that says so; the
#: place to disagree with it is `quality.floor.FloorDeclaration.mattr_window`,
#: whose provenance block is `quality.floor.CALIBRATION["mattr_window"]`.
#:
#: This constant is only the DEFAULT the declaration itself takes. Nothing
#: reads it to decide anything: the gate threads `FloorDeclaration.
#: mattr_window` into `extract()` on every call, so an override reaches the
#: statistic rather than being quietly outranked by this line (doctrine 1).
MATTR_WINDOW = 50


# ---------------------------------------------------------------------------
# Resources
# ---------------------------------------------------------------------------

def load_concreteness():
    """Brysbaert et al. norms: word -> mean concreteness on a 1-5 scale."""
    path = os.path.join(DATA, "concreteness.txt")
    if not os.path.exists(path):
        raise SystemExit("run quality/fetch_data.py first")
    out = {}
    with open(path, encoding="utf-8", errors="replace") as f:
        header = f.readline().rstrip("\n").split("\t")
        wi, ci = header.index("Word"), header.index("Conc.M")
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) <= max(wi, ci):
                continue
            try:
                out[parts[wi].lower()] = float(parts[ci])
            except ValueError:
                continue
    return out


def _tagger():
    os.environ.setdefault("NLTK_DATA", os.path.abspath(
        os.path.join(DATA, "nltk")))
    import nltk
    nltk.data.path.insert(0, os.environ["NLTK_DATA"])
    return nltk.pos_tag


# ---------------------------------------------------------------------------
# Rhyme-candidate index
# ---------------------------------------------------------------------------

class RhymeField:
    """Reverse index over the common-word lexicon, bucketed by anchor nucleus.

    The harness's CandidateEngine scores a query against all ~20k indexed words.
    That is fine for one interactive lookup and far too slow for a corpus sweep
    (a 154-sonnet run needs ~1k queries). Bucketing by nucleus cuts it by roughly
    an order of magnitude without changing any result: with nucleus weighted at
    0.5, a nucleus similarity below NUC_FLOOR cannot reach the rhyme threshold
    however well the coda matches, so those buckets are dead weight.
    """

    NUC_FLOOR = 0.30

    def __init__(self, lex, decl):
        self.lex, self.decl = lex, decl
        self.buckets = defaultdict(list)
        for word, prons in lex.entries.items():
            if not re.fullmatch(r"[a-z']+", word):
                continue
            rank = lex.freq_rank.get(word)
            if rank is None:
                continue
            anc = anchor(syllabify(prons[0]))
            if anc:
                self.buckets[anc[0]["nucleus"]].append((word, anc, rank))
        # nucleus -> nuclei close enough to be worth scoring
        self.neighbors = {
            v: [u for u in VOWELS if vowel_sim(v, u) >= self.NUC_FLOOR]
            for v in VOWELS
        }
        self._cache = {}
        # Two projections of the SAME cached field, memoized beside it. See
        # `words()` for why they exist and what they cost.
        self._words = {}
        self._ranks = {}

    def field(self, word):
        """Words rhyming with `word` at or above theta, sorted most-frequent
        first. Returns [(word, rank, score)]."""
        key = word.lower()
        if key in self._cache:
            return self._cache[key]
        ancs, _, _ = line_anchors(self.lex, key)
        if not ancs:
            self._cache[key] = []
            return []
        anc_q = ancs[0]
        nuc = anc_q[0]["nucleus"]
        out = []
        for near in self.neighbors.get(nuc, [nuc]):
            for cand, anc, rank in self.buckets.get(near, ()):
                if cand == key:
                    continue
                s = score(anc_q, anc, self.decl, key, cand)
                if s["total"] >= self.decl.theta_rhyme:
                    out.append((cand, rank, s["total"]))
        out.sort(key=lambda t: t[1])          # by frequency rank, common first
        self._cache[key] = out
        return out

    def words(self, word):
        """`[w for w, _, _ in self.field(word)]`, built ONCE per field.

        A MEMO, not a change to what a field is: the same strings in the same
        order, so `in` and `.index` answer exactly what they answered before.

        It exists because the projection was being rebuilt PER PAIR off a field
        that is already cached per WORD, and the two counts are not the same
        number. Counted over corpus/song/ 2026-08-13: 75,397 mandated pairs
        against 11,941 distinct call words, so the average field was rebuilt
        6.31 times and `me` 623 times. cProfile over 3 warm passes on 40 real
        items put 56.3% of `_predictability` in this one list comprehension and
        a further 23.7% in `ranks()` below -- 80.0% of the warm cost rebuilding
        two lists that could not have changed. Warm cost per pair falls 901.8
        -> 78.2 us; a whole-corpus cold `--check` drops from 68.0 to 13.0
        CPU-s, MEASURED on this machine, against ~7,400 CPU-s of `score()`
        calls that this does not touch and is not trying to.

        NOT a dict of word -> position, which is the obvious next step and is
        measurably the wrong one. A dict answers in 2.0 us/pair instead of
        78.2, but costs 1,222.7 us/field to build against a list's 401.3, and
        at 6.31 uses per field the build never earns it back (break-even is
        ~15 uses): 13.9 CPU-s whole-corpus, worse than the list, and worse
        again for one-shot callers like `floor.py`, where every field is built
        once and used once. The list memo cannot regress any caller, because it
        does the same work the old code did, once instead of per pair.

        THE COST IS MEMORY, and it is unbounded exactly as `_cache` is:
        17 bytes per field entry for the two lists together, MEASURED over 40
        common-word fields (102,695 entries) -- the rank ints are shared with
        the tuples already in `_cache`, not copied. That extrapolates to
        0.48 GiB over a full 11,941-word sweep, on top of the 2.99 GiB
        `_cache` already holds there at 105 B/entry. A dict-of-positions would
        have been ~1.9 GiB for the slower answer above.
        """
        key = word.lower()
        got = self._words.get(key)
        if got is None:
            got = self._words[key] = [w for w, _, _ in self.field(key)]
        return got

    def ranks(self, word):
        """`[r for _, r, _ in self.field(word)]`, built ONCE per field.

        Same memo as `words()`, and LAZY for a second reason: only a pair whose
        answer falls OUTSIDE the field ever needs it (374 of 562 real pairs in
        the 2026-08-13 sample), so a field never asked that question never
        pays for the list. Ascending by construction -- `field()` sorts by
        rank -- which is what `bisect_left` requires of it.
        """
        key = word.lower()
        got = self._ranks.get(key)
        if got is None:
            got = self._ranks[key] = [r for _, r, _ in self.field(key)]
        return got


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------

class QualityFeatures:

    #: the pre-registered ten, in PREREGISTRATION.md order
    NAMES = [
        "rhyme_predictability_mean",
        "rhyme_predictability_min",
        "concreteness_mean",
        "concreteness_p90",
        "abstract_noun_ratio",
        "pos_binding_diversity",
        "mattr",
        "function_word_ratio",
        "syntactic_inversion_rate",
        "content_word_freq_mean",
    ]

    #: predicted direction in the survived/human class, committed in advance
    DIRECTION = {
        "rhyme_predictability_mean": "lower",
        "rhyme_predictability_min": "lower",
        "concreteness_mean": "higher",
        "concreteness_p90": "higher",
        "abstract_noun_ratio": "lower",
        "pos_binding_diversity": "higher",
        "mattr": "higher",
        "function_word_ratio": "lower",
        "syntactic_inversion_rate": "lower",
        # CORRECTED 2026-08-22 BY OWNER RULING (`MISSING.md` M-32): ~~lower~~
        # **higher**. `quality/PREREGISTRATION.md` committed this feature as
        # "**LOWER** (rarer words)", and the two halves of that cell point
        # opposite ways — `freq_rank` is 0-based ascending by commonness, so
        # LOWER is MORE COMMON and the gloss says rarer. The ruling is that
        # the GLOSS was the commitment, so the prediction is RARER WORDS and
        # the direction that encodes it is `higher`.
        #
        # THE RESPECIFICATION ALREADY AGREED WITH THE GLOSS, which is the
        # corroboration and not the reason: `within_item.WithinItemFeatures`
        # declares `wi_freq_delta: "higher"` for the same quantity measured
        # marked-minus-unmarked, and has since it was written. The two
        # modules had disagreed with each other about one prediction the
        # whole time (doctrine 1).
        #
        # IT MOVES NO AUC. `permutation_test` is direction-free and
        # `joint_classifier` fits logistic regression on raw values, so every
        # figure is unchanged; what moves is `dir_ok`, the printed verdict,
        # and the count of features clearing FDR with the predicted sign.
        "content_word_freq_mean": "higher",
    }

    def __init__(self, lex=None, decl=None, mattr_window=MATTR_WINDOW):
        self.lex = lex or Lexicon()
        self.decl = decl or Declaration()
        self.conc = load_concreteness()
        self.field = RhymeField(self.lex, self.decl)
        self.pos_tag = _tagger()
        #: the window `extract()` uses when its caller names none. A caller
        #: holding a `FloorDeclaration` should pass that declaration's
        #: `mattr_window` per call instead of relying on this, so one shared
        #: `QualityFeatures` can serve two declarations without either of
        #: them silently mutating the other's statistic.
        self.mattr_window = mattr_window

    # -- helpers ----------------------------------------------------------

    @staticmethod
    def _tokens(line):
        # THE LETTER REPERTOIRE IS `lyric_harness.LATIN_SCRIPT`'S, 2026-08-21.
        # This is the quality layer and it is deliberately separate from the
        # correctness engine, but "separate" governs WHAT is measured and not
        # WHETHER a word is a word: under `A-Za-z` Barnes's `A-baggèn` was two
        # tokens and `jaÿ` was one letter short, so MATTR and the
        # function-word ratio were computed over a text nobody printed.
        # MEASURED on `corpus/song/eng_*`: 6,856 lines of 283,506 (2.42%) move
        # and the token total falls 1,873,325 -> 1,865,465, **-0.420%** — the
        # fall is fragments merging back into the words they came from.
        return [t for t in re.findall(r"(?:[A-Za-zÀ-ɏḀ-ỿ]|['\-])+", line)
                if re.search(r"[A-Za-zÀ-ɏḀ-ỿ]", t)]

    def _tag_lines(self, lines):
        return [self.pos_tag(self._tokens(l)) for l in lines]

    @staticmethod
    def _endword(line):
        toks = QualityFeatures._tokens(line)
        return toks[-1].lower().strip("'-") if toks else ""

    @staticmethod
    def pairs_from_scheme(scheme):
        """Letter scheme -> the line-index pairs it mandates (0-based)."""
        groups = defaultdict(list)
        for i, ch in enumerate(scheme.upper()):
            groups[ch].append(i)
        pairs = []
        for idxs in groups.values():
            for a in range(len(idxs)):
                for b in range(a + 1, len(idxs)):
                    pairs.append((idxs[a], idxs[b]))
        return sorted(pairs)

    # -- the ten ----------------------------------------------------------

    def _predictability(self, lines, pairs):
        """For each scorable pair, how obvious was the answering word?

        -> [(i, j, value)], 0-based line indices, ALIGNED to the pair each
        value came from.

        1.0 = the answer is the single most common word that rhymes with the
        call (fire -> desire). 0.0 = rarer than everything in the field. This
        is the continuous replacement for the harness's 30-entry CLICHE_PAIRS
        lookup, and it is the feature the whole thesis leans on.

        IT RETURNED BARE FLOATS UNTIL 2026-08-14, AND THEY WERE NOT ALIGNED
        WITH `pairs`. The five `continue` guards below drop a pair silently,
        so `vals` was SHORTER than `pairs` and every value after the first
        skip sat at the wrong index. Measured on three pairs whose middle one
        ends in an unreadable word: three pairs in, two values out, and
        `vals[1]` was the value of `pairs[2]`.
        The alignment was never USED, which is why nothing caught it: every
        consumer wanted a mean, a min, or a fraction, and those are statistics
        over the values that need no correspondence. So this was a latent
        defect rather than a live one — and the moment anything tries to NAME
        the predictable pairs (which is exactly what a per-line
        PREDICTABLE_RHYME would need), it becomes a live one that reports the
        wrong lines. Returning the pair with its value removes the trap
        instead of documenting it.
        THE FLOATS ARE BIT-FOR-BIT UNCHANGED. Only the container moved, so
        every calibrated constant and every pinned AUC downstream of this
        function is untouched; the callers below extract `v` and compute what
        they always computed.
        """
        vals = []
        for i, j in pairs:
            if i >= len(lines) or j >= len(lines):
                continue
            # Strip any radif before anchoring. Without this the anchor lands
            # on the refrain in every line of a ghazal, the feature compares
            # the refrain with itself, and every pair returns an identical
            # value -- zero variance, i.e. no signal at all rather than a
            # wrong one. Verified against an English radif ghazal: six pairs
            # returned 0.7757085020242915 to the last digit, scoring the
            # refrain against English function words and never once looking
            # at the qafiya. Normal end rhyme has no common tail, so this is
            # a no-op there.
            call, answer, radif = self._strip_radif(lines[i], lines[j])
            if not call or not answer:
                continue
            # A word absent from the pronunciation lexicon has an UNKNOWN
            # rank, not a maximal one. Treating it as maximally rare returned
            # a confident 0.0 for transliterated Persian -- a number is worse
            # than a NaN here, because it propagates into a mean.
            if not self._pronounceable(call) or not self._pronounceable(answer):
                continue
            fld = self.field.field(call)
            if not fld:
                continue
            # `words`/`ranks` used to be rebuilt from `fld` on every pair. They
            # are now memoized on the field they project (`RhymeField.words`,
            # which carries the measurement). Identical lists, identical order,
            # so `in`, `.index` and `bisect_left` return the identical int and
            # the arithmetic below is bit-for-bit what it was -- which matters
            # because `discriminate.py`'s AUCs and `floor.py`'s calibrated
            # constants are both downstream of this float.
            words = self.field.words(call)
            if answer in words:
                pos = words.index(answer)
            elif answer in self.lex.freq_rank:
                # in the frequency list but outside the rhyme field
                pos = bisect_left(self.field.ranks(call),
                                  self.lex.freq_rank[answer])
            else:
                continue          # pronounceable but unranked: no basis
            vals.append((i, j, 1.0 - pos / max(1, len(words))))
        return vals

    def _pronounceable(self, word):
        """True if the lexicon can transcribe it. Guards against silently
        scoring text the phonology layer cannot actually read."""
        if not word:
            return False
        phones, _ = self.lex.transcribe_word(word)
        return bool(phones)

    @classmethod
    def _strip_radif(cls, line_a, line_b):
        """Remove the longest shared trailing word-run from a rhyme pair.

        In Persian, Urdu, Turkish and Arabic ghazal/qasida the rhyme unit is
        qafiya + radif, where the radif is a fixed repetend closing every
        line. The rhyme-bearing element is what precedes it. Returns
        (call, answer, radif_len).
        """
        wa, wb = cls._tokens(line_a), cls._tokens(line_b)
        k = 0
        while (k < len(wa) - 1 and k < len(wb) - 1
               and wa[-1 - k].lower().strip("'-.,;:!?")
               == wb[-1 - k].lower().strip("'-.,;:!?")):
            k += 1
        if k:
            wa, wb = wa[:-k], wb[:-k]
        ca = wa[-1].lower().strip("'-.,;:!?") if wa else ""
        cb = wb[-1].lower().strip("'-.,;:!?") if wb else ""
        return ca, cb, k

    def extract(self, lines, scheme=None, mattr_window=None):
        """Feature vector for one poem/lyric. `scheme` supplies the mandated
        rhyme pairs; without it, adjacent couplets are assumed.

        `mattr_window` is the one feature parameter a caller can name here,
        because it is the one that changes WHICH STATISTIC gets computed
        rather than how it is scored — see `_mattr`. None means "use whatever
        this instance was built with", so every existing caller is unmoved.
        """
        lines = [l for l in lines if l.strip()]
        if not lines:
            return {n: float("nan") for n in self.NAMES}
        if scheme and len(scheme) == len(lines):
            pairs = self.pairs_from_scheme(scheme)
        else:
            pairs = [(i, i + 1) for i in range(0, len(lines) - 1, 2)]

        tagged = self._tag_lines(lines)
        flat = [(w.lower(), t) for tl in tagged for w, t in tl]
        words = [w for w, _ in flat]

        # 1-2 rhyme predictability
        pred = [v for _i, _j, v in self._predictability(lines, pairs)]
        f_pred_mean = sum(pred) / len(pred) if pred else float("nan")
        f_pred_min = min(pred) if pred else float("nan")

        # 3-5 concreteness
        content = [w for w, t in flat if t in CONTENT_TAGS]
        cvals = [self.conc[w] for w in content if w in self.conc]
        f_conc_mean = sum(cvals) / len(cvals) if cvals else float("nan")
        if cvals:
            srt = sorted(cvals)
            f_conc_p90 = srt[min(len(srt) - 1, int(0.9 * len(srt)))]
        else:
            f_conc_p90 = float("nan")
        nouns = [w for w, t in flat if t in NOUN_TAGS and w in self.conc]
        if nouns:
            f_abstract = sum(1 for w in nouns
                             if self.conc[w] < CONC_ABSTRACT) / len(nouns)
        else:
            f_abstract = float("nan")

        # 6 Wimsatt binding: does the rhyme join unlike grammatical categories.
        # Coarse tags on purpose -- the claim is about category (noun vs verb),
        # not inflection, so sang/hang must not count as a category difference
        # merely because one is VBD and the other VB.
        tagmap = {}
        for i, tl in enumerate(tagged):
            if tl:
                tagmap[i] = self._coarse(tl[-1][1])
        diffs = [1.0 if tagmap.get(i) != tagmap.get(j) else 0.0
                 for i, j in pairs if i in tagmap and j in tagmap]
        f_binding = sum(diffs) / len(diffs) if diffs else float("nan")

        # 7 length-normalized lexical diversity. THE WINDOW IS A COORDINATE
        #   and it is threaded, not assumed: at a short unit the same call
        #   returns plain TTR instead (see `_mattr`).
        f_mattr = self._mattr(
            words,
            self.mattr_window if mattr_window is None else mattr_window)

        # 8 function-word share
        f_func = (sum(1 for _, t in flat if t in FUNCTION_TAGS) / len(flat)
                  if flat else float("nan"))

        # 9 syntactic strain
        f_inv = sum(self._inversions(tl) for tl in tagged) / len(tagged)

        # 10 rarity of the content vocabulary
        oov = getattr(self.lex, "freq_rank_oov", len(self.lex.freq_rank))
        cranks = [self.lex.freq_rank.get(w, oov) for w in content]
        f_freq = sum(cranks) / len(cranks) if cranks else float("nan")

        return {
            "rhyme_predictability_mean": f_pred_mean,
            "rhyme_predictability_min": f_pred_min,
            "concreteness_mean": f_conc_mean,
            "concreteness_p90": f_conc_p90,
            "abstract_noun_ratio": f_abstract,
            "pos_binding_diversity": f_binding,
            "mattr": f_mattr,
            "function_word_ratio": f_func,
            "syntactic_inversion_rate": f_inv,
            "content_word_freq_mean": f_freq,
        }

    @staticmethod
    def _coarse(tag):
        """Penn tag -> grammatical category. Inflection is collapsed."""
        if tag in NOUN_TAGS:
            return "N"
        if tag.startswith("VB"):
            return "V"
        if tag.startswith("JJ"):
            return "J"
        if tag.startswith("RB"):
            return "R"
        return tag

    @staticmethod
    def _mattr(words, window=MATTR_WINDOW):
        """Moving-average type/token ratio. Plain TTR is length-confounded --
        longer texts always look less diverse -- and poem lengths vary.

        THE WINDOW, SWEPT 2026-08-14. The sentence above justifies MATTR. It
        does not justify FIFTY, and until this date nothing did: `window=50`
        was a bare default with no comment, absent from `FloorDeclaration`,
        absent from `floor.CALIBRATION`, absent from every results document,
        and not passed by any of its four call sites. It is now
        `FloorDeclaration.mattr_window`; the provenance block is
        `floor.CALIBRATION["mattr_window"]` and the numbers are repeated here
        because this is where a reader meets the constant.

        IT IS NOT ON A PLATEAU. Sonnet-level separation (`mattr` alone,
        Experiment 2, 152 Shakespeare sonnets vs 40 model ones -- the same
        AUC `test_discriminate.PINNED["abs_exp2"]` pins) falls MONOTONICALLY
        across the whole swept range:

            window   20     25     30     40     50     60     80    100
            AUC     .928   .915   .907   .891   .870   .850   .811   .750

        Fifty is 0.059 below the sweep's best and sits on the DESCENDING
        limb, not on a flat. Paired bootstrap over the same items, 2000
        draws: AUC(w=40) - AUC(w=50) = +0.021 [+0.009, +0.034], an interval
        that excludes zero. So moving the window moves the measurement.

        THE FLAT FPR COLUMN IS NOT EVIDENCE THAT IT DOESN'T. The song
        profile's held-out mattr false-positive rate barely moves across a
        TENFOLD change in window -- median 5.08-5.43% over windows 20 to 200,
        200 author-held-out seeds each -- and that is a TAUTOLOGY, not a
        finding: the threshold is the 5th percentile OF THE SAME
        RECOMPUTED STATISTIC, so about 5% of held-out items fall below it
        whatever the window is. A reader who concludes "FPR flat, therefore
        window unimportant" has read the calibration rule, not the data.
        What does move underneath that flat rate is WHICH items: +/-10
        tokens of window changes 13-16% of the flagged set (Jaccard 0.869 at
        w=40, 0.840 at w=60). The rate is stable; the accusations are not.

        ADMISSIBILITY -- THE CONSTRAINT NOBODY HAD WRITTEN DOWN. The branch
        below (`len(words) <= window` -> plain TTR) means a window is
        admissible only if EVERY item in a profile's calibration set falls on
        the same side of it. Otherwise one profile's percentile is a mixture
        of two different statistics reported under a single threshold, which
        is the defect doctrine 15 names. Measured over the three shipped
        profiles' own calibration sets (section quatrains 23-40 tokens,
        sonnets 94-133, song band 150-400), the admissible windows are

            [1, 22]  union  [40, 93]

        -- plus two degenerate branches, [133, 149] and [400, +inf), where the
        SONNET profile has also collapsed to plain TTR and "MATTR" has stopped
        being a moving average anywhere it is measured. 50 is inside the
        usable set; 25, 30 and 100 are NOT, and neither is 38 or 39. That
        matters because a naive retune toward the AUC gradient -- which points
        DOWNWARD, at 20 -- would plausibly stop at 25 or 30, land on an
        inadmissible value, and nothing in this repo would have said so.

        AND IT IS KEPT ANYWAY, ON DOCTRINE 19. The shipped value costs ~0.06
        AUC against the sweep's best and is kept because an in-sample argmax
        is not a calibration. The sweep's best is read off the SAME 152-vs-40
        corpus that reports the AUC, so 20 is an in-sample optimum with no
        held-out standing (doctrine 19), and moving to it would be a threshold
        change with no calibration behind the new number (doctrine 58). Window
        size is also a genre question -- 20 tokens is about two lines of
        English verse, 50 about five -- and doctrine 6 says a number like that
        belongs in a declaration rather than in a constant. So it is declared,
        priced, and left where it is. A future move must be argued, must be
        repinned with its date, and must land inside [1, 22] or [40, 93].
        """
        if not words:
            return float("nan")
        # THE FALLBACK IS A DIFFERENT STATISTIC, not a degraded one. Every
        # window >= the item's own token count returns the identical plain
        # TTR, so the value is FROZEN in `window` from that point up -- which
        # is why `floor.PROFILES`' `section` entry, whose longest quatrain is
        # 40 tokens, reports a plain-TTR number under a MATTR name.
        if len(words) <= window:
            return len(set(words)) / len(words)
        ratios = [len(set(words[i:i + window])) / window
                  for i in range(len(words) - window + 1)]
        return sum(ratios) / len(ratios)

    @staticmethod
    def _inversions(tagged_line):
        """Marked word-order departures per line -- the fingerprint of sense
        bent to reach a rhyme. Heuristic and deliberately conservative: only
        patterns that are marked in *any* period of English are counted, so
        the measure does not simply detect archaism."""
        n = 0
        toks = [w.lower() for w, _ in tagged_line]
        tags = [t for _, t in tagged_line]
        for k in range(len(tags) - 1):
            # postposed adjective: "forests green"
            if tags[k] in NOUN_TAGS and tags[k + 1] in ("JJ", "JJR", "JJS"):
                n += 1
            # periphrastic do carrying no emphasis: "did sing", "doth lie"
            if toks[k] in PERIPHRASTIC_DO and tags[k + 1] in ("VB", "VBP"):
                n += 1
        # line-final verb after its object: "the crown he wore" -> ... PRP VBD
        if len(tags) >= 3 and tags[-1].startswith("VB") and \
                tags[-2] in ("PRP", "NN", "NNS") and tags[-3] in NOUN_TAGS:
            n += 1
        return n


if __name__ == "__main__":
    qf = QualityFeatures()
    demo = ["That time of year thou mayst in me behold",
            "When yellow leaves, or none, or few, do hang",
            "Upon those boughs which shake against the cold",
            "Bare ruined choirs, where late the sweet birds sang"]
    for k, v in qf.extract(demo, "ABAB").items():
        print(f"  {k:32s} {v:.4f}")

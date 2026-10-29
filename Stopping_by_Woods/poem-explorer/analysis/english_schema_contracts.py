"""Audited English word-pair declarations over the pinned native judge.

The native registry and evaluator are not modified.  Call ``audited_schemas``
after putting CodexMusica/lyric-harness on sys.path, then pass its schemas to
``relations.pair_satisfies_any``.  Eligibility is part of each declaration, so
the native search can continue past an unsuitable pronunciation witness.

The caller supplies its pronunciation policy, including the AH0/AX distinction.
E10 is the E4/E5 union and E22 has no executable native declaration.
"""
from __future__ import annotations

from dataclasses import dataclass, replace

from quality import relations as R
from quality.quotients import ARPABET_CONSONANTS


VERSION = "english-word-pair-contracts-v1"
SCHEMA_BY_ID = {
    1: "perfect rhyme", 2: "rime riche", 3: "repetition", 4: "assonance",
    5: "consonance", 6: "parechesis / general consonance", 7: "pararhyme",
    8: "reverse rhyme", 9: "alliteration", 11: "family rhyme",
    12: "additive rhyme", 13: "subtractive rhyme", 14: "semirhyme",
    15: "apocopated rhyme", 16: "light rhyme", 17: "wrenched rhyme",
    18: "syllabic rhyme", 19: "amphisbaenic rhyme", 20: "eye rhyme",
    21: "historical rhyme",
}

# One short record per corrected declaration, never prose per pair.
CORRECTIONS = {
    "E1": {
        "description": "Both anchors must actually be stressed; equal weak stress is insufficient.",
        "sources": ["quality/rhyme_types.py:LAST_PROMINENT/resolve_anchor", "quality/relations.py:perfect rhyme"],
    },
    "E7": {
        "description": "Compare the complete aligned tails; unmatched syllables cannot disappear.",
        "sources": ["quality/relations.py:pararhyme (head-flush and tail-flush)"],
    },
    "E11": {
        "description": "Require complete aligned tails and the native manner-class agreement on all post-vowel consonants, including post-anchor onsets and the empty class.",
        "sources": ["quality/relations.py:family rhyme", "quality/quotients.py:manner", "quality/canon_index.tsv:E11"],
    },
    "E12": {
        "description": "The complete rime must acquire terminal consonants, with all preceding rime material unchanged.",
        "sources": ["quality/relations.py:PresentVsAbsent/additive rhyme", "quality/test_relations.py:test_p6_present_vs_absent", "quality/canon_index.tsv:E12"],
    },
    "E13": {
        "description": "The complete rime must lose terminal consonants, with all preceding rime material unchanged.",
        "sources": ["quality/relations.py:PresentVsAbsent/subtractive rhyme", "quality/test_relations.py:test_p6_present_vs_absent", "quality/canon_index.tsv:E13"],
    },
    "E14": {
        "description": "The complete post-vocalic cluster of the shorter first word must prefix the longer second word's cluster.",
        "sources": ["quality/relations.py:semirhyme (M-245)"],
    },
    "E15": {
        "description": "The complete post-vocalic cluster of the shorter second word must prefix the longer first word's cluster.",
        "sources": ["quality/relations.py:apocopated rhyme/semirhyme (M-245)"],
    },
    "E18": {
        "description": "Compare the actual final syllable of each word and require both to be unstressed.",
        "sources": ["quality/rhyme_constraints.py:WEAK_FINAL_SYL", "quality/rhyme_constraints.py:syllabic rhyme"],
    },
    "E19": {
        "description": "Reverse the complete second word's phone sequence exactly once; do not reverse its syllable order beforehand.",
        "sources": ["quality/relations.py:amphisbaenic rhyme", "quality/relations.py:_spans_at/SequenceEqual"],
    },
}

# Scope audit, not a claim that unavailable resources have been supplied.
AUDIT = {
    "E1": "Corrected stressed anchor; native exhaustive rime and differing anchor onsets retained.",
    "E2": "Native exhaustive identical segmental tails and distinct words retained; no new stress-equality restriction inferred.",
    "E3": "Native repeated-word identity and phonological agreement retained.",
    "E4": "Native partial vowel agreement retained; overlapping consonant agreements remain allowed.",
    "E5": "Native coda agreement retained; caller must require positive consonant evidence, not empty agreement.",
    "E6": "Whole-line subsequence relation; unavailable as a bound word-pair schema.",
    "E7": "Corrected complete-tail coverage; caller must require positive consonant evidence.",
    "E8": "Native anchor onset plus vowel agreement retained; the remainder is intentionally unconstrained.",
    "E9": "Native word-initial onset agreement retained; caller must require positive consonant evidence.",
    "E10": "Derived union of displayed E4 and E5, not a separate native schema.",
    "E11": "Corrected complete-tail coverage; manner-class and perfect-rhyme overlap remain allowed.",
    "E12": "Corrected complete-rime terminal addition; the native proper-extension rule already accepts nonempty codas.",
    "E13": "Corrected complete-rime terminal subtraction, inverse of E12 in text order.",
    "E14": "Corrected prefix direction; the declared unmatched syllables remain on the second member.",
    "E15": "Corrected prefix direction; the declared unmatched syllables remain on the first member. Native alternative terminology remains disputed.",
    "E16": "Native actual-final-syllable agreement plus unequal stress retained; depends on a faithful vowel reader.",
    "E17": "Unavailable without a delivered pronunciation/stress surface; text does not establish wrenching.",
    "E18": "Corrected actual final weak syllables; internal weak syllables cannot supply this ending relation.",
    "E19": "Corrected double reversal of syllable order; native complete reversed phone-sequence equality retained.",
    "E20": "Native declared orthographic-tail agreement plus differing final vowel retained; this is its narrow operational definition.",
    "E21": "Unavailable without an earlier pronunciation surface; modern text does not establish historical rhyme.",
    "E22": "No executable native schema; a missing judge is not a negative finding.",
}


@dataclass(frozen=True)
class BothProminentValue(R.Predicate):
    """A unary prominence requirement on each member, evaluated jointly."""

    required_value: int
    name: str = "BOTH-PROMINENCE"

    def __call__(self, x, y):
        if x is None or y is None:
            return R.Read(None, False, "unreadable prominence")
        ax, ay = R._alts(x), R._alts(y)
        if not ax or not ay or None in ax or None in ay:
            return R.Read(None, False, "unreadable prominence alternative")
        possible = self.required_value in ax and self.required_value in ay
        certain = ax == {self.required_value} and ay == {self.required_value}
        return R.Read(True if certain else None if possible else False, True)


@dataclass(frozen=True)
class ShorterWordClusterPrefix(R.Predicate):
    """The entire shorter WORD's cluster must open the longer WORD's cluster.

    ``shorter`` is fixed by the schema's unmatched side, not selected by
    comparing the two clusters' lengths.  Equal or empty clusters are valid.
    """

    shorter: int
    name: str = "SHORTER-WORD-CLUSTER-PREFIX"

    def __call__(self, x, y):
        if x is None or y is None:
            return R.Read(None, False, "unreadable cluster")
        if R.uncertain(x) or R.uncertain(y):
            return R.Read(None, False, "uncertain cluster; resolve whole readings")
        vals = (next(iter(R._alts(x))), next(iter(R._alts(y))))
        short, long = tuple(vals[self.shorter]), tuple(vals[1 - self.shorter])
        return R.Read(len(short) <= len(long) and long[:len(short)] == short,
                      bool(short or long))


_CONSONANTS = frozenset(ARPABET_CONSONANTS)


def _rime(phones):
    """Drop only the anchor onset from an English anchor-to-word-end span.

    The native declared consonant inventory locates the first nucleus.  The
    nucleus's exact symbol is retained, including the caller's distinct AX.
    """
    for index, phone in enumerate(phones):
        if phone not in _CONSONANTS:
            return tuple(phones[index:])
    return None


@dataclass(frozen=True)
class TerminalConsonantExtension(R.Predicate):
    """Native proper extension on complete rimes, adding only consonants.

    A sequence channel sees every pre-final consonant and vowel, including
    consonants assigned to a following onset by syllabification.  Thus a
    shorter internal syllable cannot impersonate the end of a longer word.
    """

    on: int
    name: str = "TERMINAL-CONSONANT-EXTENSION"

    def __call__(self, x, y):
        if x is None or y is None:
            return R.Read(None, False, "unreadable complete rime")
        if R.uncertain(x) or R.uncertain(y):
            return R.Read(None, False, "uncertain rime; resolve whole readings")
        a = _rime(next(iter(R._alts(x))))
        b = _rime(next(iter(R._alts(y))))
        if a is None or b is None:
            return R.Read(None, False, "no readable nucleus")
        read = R.PresentVsAbsent(on=self.on)(a, b)
        if read.value is not True:
            return read
        extra, bare = (a, b)[self.on], (a, b)[1 - self.on]
        return R.Read(all(phone in _CONSONANTS for phone in extra[len(bare):]),
                      True, "terminal consonant extension")


def audited_schemas():
    """Return fresh numeric-ID -> native RelationSchema copies.

    No registration, monkey-patching, word exceptions, ranking policy, or
    post-witness filter is involved.  Unchanged rows are copied as well.
    """
    out = {number: replace(R.REGISTRY[name])
           for number, name in SCHEMA_BY_ID.items()}
    out[1] = replace(out[1], channels=tuple(
        replace(channel, predicate=BothProminentValue(1))
        if channel.channel == "prominence" else channel
        for channel in out[1].channels))
    out[7] = replace(out[7], unmatched="forbid")
    out[11] = replace(
        out[11], unmatched="forbid",
        channels=out[11].channels + (R.ChannelRule(
            "onset", R.ClassEqual(resource="manner", label="declared manner partition"),
            "post_anchor"),))
    for number, extra in ((12, 1), (13, 0)):
        out[number] = replace(
            out[number], unmatched="forbid",
            channels=(R.ChannelRule("nucleus", R.AGREE, "each"),
                      R.ChannelRule("phones", TerminalConsonantExtension(extra), "sequence")))
    for number, shorter in ((14, 0), (15, 1)):
        out[number] = replace(out[number], channels=tuple(
            replace(channel, predicate=ShorterWordClusterPrefix(shorter))
            if channel.channel == "coda" and channel.scope == "cluster" else channel
            for channel in out[number].channels))
    out[18] = replace(
        out[18], spans=(R.END_LAST, R.END_LAST),
        channels=tuple(replace(channel, predicate=BothProminentValue(0))
                       if channel.channel == "prominence" else channel
                       for channel in out[18].channels))
    out[19] = replace(out[19], spans=(out[19].spans[0],
        replace(out[19].spans[1], anchor="word_start", direction=1)))
    for number in out:
        correction = CORRECTIONS.get(f"E{number}")
        if correction:
            out[number] = replace(out[number], note=(out[number].note + " " +
                VERSION + ": " + correction["description"]))
    return out


__all__ = ["audited_schemas", "VERSION", "SCHEMA_BY_ID", "CORRECTIONS", "AUDIT"]

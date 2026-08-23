#!/usr/bin/env python3
"""English — the ninth phonology, and the one that was missing (MISSING F-1).

WHY THIS FILE EXISTS AND WHY IT IS LATE

Eight languages had a declared phonology and English did not. English ran on
`lyric_harness.Lexicon` directly, which is a fine engine and is not a
*declaration*: it states no notation, no grid unit, no prominence rule and no
source, so nothing downstream could ask English what it was. The practical cost
was total. `quality/rhyme_types.py`, `quality/relations.py`, `quality/revise.py`
and `quality/readability.py` all take a `phon` argument, `quality.phonology.get`
had no `eng` to return, and every English test in the repo therefore built its
own CMUdict FIXTURE inline and said so. 11,540 lines of production code were
unreachable from the command line, and this was the reason: not plumbing, a
missing adapter.

WHAT THIS IS NOT

It is not a second English engine. Every phone comes from the same `Lexicon`
the harness has always used; this file adds no transcription and no rule the
engine did not already have. It is a DECLARATION over that engine, in the shape
the other eight declare themselves in, so English becomes a language the new
layer can be pointed at rather than a special case it is built around.

THE FALLBACK, ADDED 2026-08-11 — KNOWN GAP 1, AND IT IS OFF BY DEFAULT

`English(fallback="high")` routes an out-of-vocabulary word through
`quality.g2p.Fallback` before refusing. `English()` — which is what `register`
puts in the registry, and therefore what `quality.phonology.get('eng')` returns
— does NOT, so no number anywhere in the repo moves because this file changed.
Turning it on is a caller's declared decision, and `declaration()` reports which
way it is set, because "this rhyme rests on a derived pronunciation" is an
assumption and doctrine 1 is where assumptions live.

What the fallback is allowed to be is the whole point, and it is stated in
`quality/g2p.py`: a reading is admissible when EVERY PHONE CAME OUT OF A
CMUdict ENTRY and a declared rule supplied only the affix, the allomorph or the
spelling normalisation — `viewest` = `view` + `-est`, `o'er` from the headword
`oar`. That is the same licence the `Lexicon`'s own inherited reductions
already run under (see REFUSAL POLICY below); it is generalised, not widened.
The letter-to-sound layer, which invents phones no dictionary entry supplied,
is reachable at `fallback="low"` and is off, on measurement rather than
principle: of the sonnet pairs it alone makes judgeable, about half do not
rhyme, against 1 in 39 for the derived layers.

`read()` is the entry point that keeps the provenance; `syllabify()` is the
inherited interface and necessarily throws it away, so a caller that needs to
know which layer produced a pronunciation must call `read()` or `layer_of()`.

THE `__init__` DOCSTRING SAID "NO DEFAULTING TO ENGLISH", AND STILL MEANS IT

That commitment is about a language falling back to English when its own rules
run out -- a Middle Chinese character quietly scored as Mandarin. An explicitly
declared `eng`, returned only when a caller asks for `eng` by name, is the
opposite of a default. The registry is what enforces this: `get('cym')` cannot
reach this module. The `__init__` docstring is amended in the same commit
rather than silently contradicted.

REFUSAL POLICY, WHICH IS THE PART WITH TEETH

`syllabify` returns `[]` for a word CMUdict cannot read. It does NOT guess.
The `Lexicon`'s own fallbacks are kept, because every one of them derives from
a dictionary entry rather than inventing a pronunciation -- `crown'd` ->
`crowned`, `feelin'` -> `feeling` with NG realised as N, `cats` -> `cat` + Z.
Where the Lexicon raises its own OOV flag, this module refuses. That refusal is
the same 50 sonnet pairs the battery reports as `refused`, now visible to the
new layer too, and doctrine 79 applies: a refusal is not a failure and must not
land in a violation numerator.

**A word the fallback cannot read still refuses**, and its refusal is reported
SEPARATELY from the dictionary's: `three_counts()` returns
dictionary / fallback / refused as three numbers, never two, because a rate
computed over "read" without saying how much of it was DERIVED has hidden the
assumption it rests on. Measured on the 2,128 end words of the 152 sonnets the
battery parses: **2,056 / 0 / 72** with the fallback off and **2,065 / 51 / 12**
with it at `high`. The nine that move into the first column rather than the
second are hyphenated compounds (`to-day`, `Easter-day`) that the LINE path has
always read by splitting on the hyphen and a per-word path did not; that is a
tokenisation agreement, not a derivation, so it belongs in the dictionary
column.

`rhymes()` IS DELIBERATELY LEFT AS THE INHERITED STUB

Doctrine 84 says a phonology that DECLARES a relation and IMPLEMENTS the
predicate is asked, and its answer wins over the channel comparison. Middle
Chinese needs that, because 平水韻 authorises a 同用 grouping the raw rime book
does not. English does not: its rhyme relation IS the channel comparison, run
under a declared theta with a conjunctive band, and that machinery lives in
`Declaration` where a caller can see and move it. Implementing `rhymes()` here
would hard-code one threshold inside the phonology and hide it from the
declaration tuple, which is doctrine 1 broken. So the stub stands, the channels
decide, and `route` reports `channels` -- which is the correct answer and not
an omission.

Likewise `alliterates()`: the anchor axis (doctrine 83) expresses head
alliteration as a per-member locator, so a hard-coded English predicate here
would compete with a coordinate that can already say it.
"""

import re

from quality.phonology import Phonology, Syllable, register
from quality import quotients as _QUOTIENTS  # noqa: E402
from quality import morphology as _MORPH  # noqa: E402

_LEX = None


def _lexicon():
    """Lazily built. `lyric_harness` imports `quality.phonology` inside a
    function to avoid a cycle; importing it at module scope here would close
    that cycle from the other side."""
    global _LEX
    if _LEX is None:
        import lyric_harness as _lh
        _LEX = _lh.Lexicon()
    return _LEX


#: The values `fallback` takes, and what each one licenses. `None` is the
#: shipped default and is the behaviour this module had before 2026-08-11.
FALLBACK_MODES = {
    None: "no fallback: a word CMUdict cannot read REFUSES",
    "high": "dictionary-derived only -- every phone comes from a CMUdict entry "
            "and a declared rule supplies the affix, allomorph or spelling "
            "normalisation (quality/g2p.py morphology + elision layers)",
    "low": "the above PLUS letter-to-sound, which invents phones no dictionary "
           "entry supplied. Reachable so the defect is demonstrable; measured "
           "at roughly a coin flip on the sonnets' own mandated rhymes",
}


class English(Phonology):
    language = "eng"
    name = "English (General American)"
    notation = ("ARPAbet, cmusphinx/cmudict master working copy (post-0.7b); "
                "stress digits 0/1/2 on vowel phones")
    grid_unit = "syllable"
    prominence_rule = (
        "lexical stress from CMUdict (1 or 2 -> prominent, 0 -> not), with the "
        "harness's WEAK_ALWAYS / WEAK_NONFINAL function-word demotion applied "
        "at the phrase level -- doctrine 46: a function-word list is part of a "
        "phonology, not an optimisation")
    relation = (
        "none declared. Rhyme is the channel comparison under Declaration's "
        "theta and conjunctive band, so `rhymes()` stays the inherited stub "
        "and the channels decide -- see this module's docstring")
    # CORRECTED 2026-08-13. This read `cmudict-0.7b (public domain)` and both
    # halves were false. `cmudict-0.7b` 404s at cmusphinx/cmudict master --
    # what ships is the master working copy, which carries no release version
    # of its own -- and the licence is BSD-2-clause, a REDISTRIBUTION GRANT,
    # not a public-domain dedication. The pointer at `data/sources.tsv` was
    # false too, in the way doctrine 34 is about: there was no row there to
    # point at until the same date, so the citation resolved to nothing.
    # No non-commercial restriction anywhere in the chain -- checked, not
    # assumed: `noncommercial_marker()` returns None on the fetched licence
    # text, so doctrine 85 does not fire.
    source = ("cmusphinx/cmudict master working copy, md5 "
              "5837aa6e49fd070d482b8ca0525f28ef; BSD-2-clause (Carnegie "
              "Mellon University), NOT public domain; see data/sources.tsv")

    def __init__(self, fallback=None):
        """`fallback` is a DECLARED coordinate, defaulting to the refusal.

        It is not a boolean, because "did you guess" has three answers here and
        two of them are different kinds of derivation. See `FALLBACK_MODES`.
        """
        if fallback not in FALLBACK_MODES:
            raise ValueError(
                f"fallback={fallback!r} is not declared; the modes are "
                f"{sorted(k for k in FALLBACK_MODES if k)} or None")
        self.fallback = fallback
        self._fb = None
        # THE DECLARED QUOTIENTS THIS PHONOLOGY SUPPLIES (2026-08-22).
        # `relations._quotient_of` looks in `declaration['quotients']` first
        # and `phon.quotients` second — the seam `ltc` has used since it was
        # written to hand its 平水韻 同用 grouping to the 同用 schema without
        # `relations.py` importing a phonology or hard-coding a table.
        # English had none, so `ClassEqual(resource='manner')` found nothing
        # and `family rhyme` and `multisyllabic rhyme` REFUSED on every pair
        # — correctly, because the identity is not a quotient (defect P14),
        # and uselessly, because the partition they want is ordinary
        # articulatory phonetics. It is declared in `quality/quotients.py`,
        # asserted total against the inventory derived from this same
        # dictionary, and adopted here.
        self.quotients = dict(_QUOTIENTS.ENG_QUOTIENTS)
        # THE DECLARED MORPHOLOGY / LEXEME RESOURCES, on the same seam
        # (2026-08-22). `homoioteleuton` and `polyptoton` are DEFINED on
        # root and affix and refused without them; `holorhyme` and
        # `rhyming slang` are defined on lexemes. `quality/morphology.py`
        # builds all of them from `g2p.SUFFIXES` — the closed suffix set this
        # repo already ships and pre-registered — with a tie-break argued for
        # morphology rather than for pronunciation, and it prints where the
        # two disagree instead of leaving that to be discovered.
        self.resources = dict(_MORPH.ENG_RESOURCES)

    def declaration(self):
        """-> dict. The tuple this phonology is asking to be judged under.

        `fallback` is in it because doctrine 1 says assumptions live in the
        declaration, and "this pronunciation was derived rather than looked up"
        is an assumption a reader of any downstream verdict needs.
        """
        d = super().declaration()
        d["fallback"] = self.fallback
        d["fallback_licenses"] = FALLBACK_MODES[self.fallback]
        return d

    def _fallback(self):
        if self._fb is None and self.fallback is not None:
            from quality.g2p import Fallback
            self._fb = Fallback(_lexicon(), min_confidence=self.fallback)
        return self._fb

    # ---------------------------------------------------------------- reads
    def read(self, word):
        """-> `quality.g2p.Reading`, or None for a REFUSAL.

        The entry point that KEEPS THE PROVENANCE. `syllabify` cannot: its
        return type is a list of `Syllable` and there is nowhere in it to say
        which layer produced the phones, so a caller that needs to know — and a
        caller reporting a rhyme verdict does need to know — calls this.

        With `fallback=None` this returns a `dictionary` reading or None, so the
        provenance question has an answer either way and the shape does not
        change when the mode does.
        """
        from quality.g2p import Reading
        fb = self._fallback()
        if fb is not None:
            return fb.read(word)
        phones, oov = _lexicon().transcribe_word(word)
        if oov or not phones:
            return None
        return Reading(tuple(phones), "dictionary", "CMUdict", (word.lower(),))

    def layer_of(self, word):
        """-> 'dictionary' | 'morphology' | 'elision' | 'letter' | None.

        None IS the refusal, and it is a value in the same range as the others
        so a caller tabulating layers cannot accidentally drop it (doctrine 28:
        distinguish 'none' from 'cannot tell', mechanically).
        """
        r = self.read(word)
        return None if r is None else r.layer

    def three_counts(self, words):
        """-> {'dictionary', 'fallback', 'refused', 'by_layer', 'total'}.

        Doctrine 79 asks for three counts and this returns three counts. A
        caller computing a rate divides by `dictionary + fallback` and prints
        `refused` beside it; it never divides by `total`.
        """
        from collections import Counter
        out, by = Counter(), Counter()
        for w in words:
            lay = self.layer_of(w)
            if lay is None:
                out["refused"] += 1
            elif lay == "dictionary":
                out["dictionary"] += 1
            else:
                out["fallback"] += 1
                by[lay] += 1
        return {"dictionary": out["dictionary"], "fallback": out["fallback"],
                "refused": out["refused"], "by_layer": dict(by),
                "total": len(words)}

    def syllabify(self, word):
        """-> [Syllable]. EMPTY when the declared layers cannot read the word.

        Empty is a refusal and callers must treat it as one. It is not a
        zero-syllable word and it is not a rhyme failure.

        THE PROVENANCE IS LOST HERE, DELIBERATELY AND VISIBLY. `Syllable` is
        the shared interface all nine phonologies return and it has no field
        for a layer; adding one would change a type eight other modules build.
        So this reads through the same `read()` the provenance path uses and
        then drops the label, and the docstring says so rather than letting a
        caller assume a syllable list is dictionary-derived. `read()` and
        `layer_of()` are one call away.
        """
        import lyric_harness as _lh
        r = self.read(word)
        if r is None or not r.phones:
            return []
        phones = list(r.phones)
        out = []
        for s in _lh.syllabify(phones):
            out.append(Syllable(
                text=word,
                onset=tuple(s["onset"]),
                nucleus=s["nucleus"],
                coda=tuple(s["coda"]),
                prominence=1 if s["stress"] in (1, 2) else 0,
                # English is stress-timed, so the mora is not its grid unit.
                # 1 everywhere is a placeholder a quantitative metre must not
                # read; `grid_unit` already says the grid is the syllable.
                moras=1))
        return out

    def readable(self, word):
        """-> bool. Separates 'no syllables' from 'could not read', which
        `syllabify` alone cannot express (doctrine 79, one layer down)."""
        return bool(self.syllabify(word))

    def unreadable(self, text):
        """-> [str] the tokens in `text` this phonology refuses.

        The battery reports 50 refused sonnet pairs; this is the same fact
        made available to any caller before it computes a rate.
        """
        return [t for t in self._tokens(text) if not self.syllabify(t)]

    def derived(self, text):
        """-> [(token, layer)] the tokens read by something OTHER than the
        dictionary. Empty whenever `fallback` is None, by construction.

        The companion to `unreadable`: that one lists what was refused, this
        one lists what was ANSWERED ON AN ASSUMPTION, and a caller reporting a
        verdict over `text` needs both lists or neither.
        """
        out = []
        for t in self._tokens(text):
            lay = self.layer_of(t)
            if lay is not None and lay != "dictionary":
                out.append((t, lay))
        return out

    @staticmethod
    def _tokens(text):
        # U+2019 is folded before the split, not after (doctrine 26): the
        # apostrophe is INSIDE the tokens this phonology cares most about
        # (`grow'st`, `o'er`), so a split that treats it as punctuation
        # manufactures the very refusals the fallback exists to remove.
        # AND THE LETTER REPERTOIRE IS THE HARNESS'S DECLARED ONE, 2026-08-21.
        # `A-Za-z` cannot spell the English this repository stages -- Barnes's
        # `jaÿ`, Hemans's accents, Welsh printed in `eng_` files -- so a
        # phonology tokenising that way disagrees with `line_tokens` about
        # what a word is, which is the disagreement that had `line_anchors`
        # reporting a Welsh line readable on a spelling-out of its own rhyme
        # word. See `lyric_harness.LATIN_SCRIPT`.
        text = text.replace("’", "'").replace("‘", "'")
        return [t for t in re.findall(r"(?:[A-Za-zÀ-ɏḀ-ỿ]|['\-])+", text)
                if re.search(r"[A-Za-zÀ-ɏḀ-ỿ]", t)]


#: The REGISTERED instance has no fallback. `quality.phonology.get('eng')`
#: therefore behaves exactly as it did before 2026-08-11, and every recorded
#: number that went through the registry is unmoved. A caller who wants the
#: fallback constructs `English(fallback="high")` and, by doing so, says in its
#: own code that it wanted it.
register(English())

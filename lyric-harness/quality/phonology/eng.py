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
the harness has always used; this file adds no transcription, no G2P and no
rule the engine did not already have. It is a DECLARATION over that engine, in
the shape the other eight declare themselves in, so English becomes a language
the new layer can be pointed at rather than a special case it is built around.

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


class English(Phonology):
    language = "eng"
    name = "English (General American)"
    notation = "ARPAbet, CMUdict 0.7b; stress digits 0/1/2 on vowel phones"
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
    source = "cmudict-0.7b (public domain); see data/sources.tsv"

    # ---------------------------------------------------------------- reads
    def syllabify(self, word):
        """-> [Syllable]. EMPTY when CMUdict cannot read the word.

        Empty is a refusal and callers must treat it as one. It is not a
        zero-syllable word and it is not a rhyme failure.
        """
        import lyric_harness as _lh
        lex = _lexicon()
        phones, oov = lex.transcribe_word(word)
        if oov or not phones:
            return []
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
        toks = [t for t in re.findall(r"[A-Za-z'’\-]+", text)
                if re.search(r"[A-Za-z]", t)]
        return [t for t in toks if not self.syllabify(t)]


register(English())

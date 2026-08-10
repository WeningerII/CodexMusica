#!/usr/bin/env python3
"""The rhyme-TYPE space. Generative, not a list of names.

WHAT WAS WRONG BEFORE THIS FILE

`lyric_harness.py` recognised five relations: RHYME, REPEAT, RIME_RICHE,
ASSONANCE, CONSONANCE. Five. Everything a lyricist actually reaches for --
feminine and dactylic endings, mosaic rhyme, broken rhyme, wrenched stress,
apocopated and additive rhyme, pararhyme, eye rhyme -- was simply not in the
vocabulary, so it could be neither asked for nor detected nor avoided.

THE SPACE IS A PRODUCT, AND THE NAMES ARE COORDINATES IN IT

A rhyme relation between two anchors is fixed by seven independent choices.
Enumerate the product and the named types fall out as cells; the cells with no
name are the ones worth writing in.

  1. AGREEMENT, per syllable of the anchor. Which of {onset, nucleus, coda}
     agree. 2^3 = 8 cells, and this is the whole of what people mean by
     "kind of rhyme":

        onset nucleus coda
          .      .      .    no relation
          X      .      .    alliteration / head rhyme
          .      X      .    assonance
          .      .      X    consonance
          X      X      .    -- NO STANDARD NAME (bat : back)
          X      .      X    pararhyme (bat : bit)
          .      X      X    PERFECT RHYME (bat : cat)
          X      X      X    identity of sound

     Six of eight are named; two are not. English poetics gave a name to the
     one cell it built its whole prosody on and left the neighbours blank.

  2. SPAN -- how many syllables the anchor covers.
        1 masculine · 2 feminine · 3 dactylic · 4+ extended/multisyllabic

  3. LEXICAL IDENTITY -- same sound, and then what?
        distinct word (rhyme) · same word (REPEAT) · homograph/homophone
        (rime riche). Doctrine 3: identity is not rhyme, and the band inverts
        by context -- REPEAT is a fault inside a verse and the REQUIREMENT
        across chorus instances, and it is the entire substance of a radif,
        a villanelle refrain and a triolet.

  4. STRESS ALIGNMENT
        aligned · wrenched (stress forced onto a weak syllable) ·
        unstressed/syllabic (both anchors weak)

  5. POSITION -- where the two members sit relative to the line
        end · internal · leonine (caesura to line end) · cross (line end to
        next line's interior) · head (line-initial) · holorhyme (whole line)

  6. WORD BOUNDARY
        simple (one word each side) · mosaic/compound (one word against
        several) · broken (a word split across the line end) · phrasal

  7. LENGTH MATCH
        equal · additive (one side carries extra material) · subtractive ·
        apocopated (final syllable dropped to make the match)

  Plus one flag that is orthogonal to all of it: REALISATION -- phonetic
  (it sounds), eye (it is spelled alike and does not sound), or historical
  (it rhymed in an earlier pronunciation and no longer does). Eye and
  historical rhyme are the cases where the sound channels DISAGREE and the
  relation is real anyway, so they cannot be a cell of (1); they are a
  separate axis.

WHAT THIS MODULE IS NOT

It does not transcribe. It defines and enumerates the space, and `classify()`
takes channel agreements that a phonology has already computed -- English from
`lyric_harness`, or any of the eight declared modules in `quality/phonology/`.
Keeping it phonology-free is what lets a Welsh or Persian relation be located
in the same space as an English one instead of being a special case.

POSITION IN THE SONG IS NOT HERE, DELIBERATELY

How far apart two rhyming lines sit, and whether they cross a section, belongs
to `quality/schemes.py`, which works over the whole lyric. This file is the
phonology of a pair; that file is the architecture of the song. Neither is a
stanza.
"""

import itertools
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# THE AXES
# ---------------------------------------------------------------------------

CHANNELS = ("onset", "nucleus", "coda")

SPAN = {1: "masculine", 2: "feminine", 3: "dactylic", 4: "extended"}
IDENTITY = ("distinct", "same_word", "rich")
STRESS = ("aligned", "wrenched", "unstressed")
POSITION = ("end", "internal", "leonine", "cross", "head", "holorhyme")
BOUNDARY = ("simple", "mosaic", "broken", "phrasal")
LENGTH = ("equal", "additive", "subtractive", "apocopated")
REALISATION = ("phonetic", "eye", "historical")


def agreement_cells():
    """All 8 single-syllable agreement patterns, as (onset, nucleus, coda)."""
    return list(itertools.product((0, 1), repeat=3))


#: The eight cells, named where English has a name and left NAMELESS where it
#: does not. A blank here is not an omission -- it is a place to write.
CELL_NAMES = {
    (0, 0, 0): (),
    (1, 0, 0): ("alliteration", "head rhyme", "initial rhyme"),
    (0, 1, 0): ("assonance", "vowel rhyme"),
    (0, 0, 1): ("consonance",),
    (1, 1, 0): (),                       # bat : back -- unnamed in English
    (1, 0, 1): ("pararhyme", "consonantal framing"),
    (0, 1, 1): ("perfect rhyme", "full rhyme", "true rhyme"),
    (1, 1, 1): ("identical sound", "rime riche" ),
}


@dataclass(frozen=True)
class RhymeType:
    """One point in the space. Every field is a declared coordinate."""
    agreement: tuple            # per-syllable (onset, nucleus, coda) tuples
    identity: str = "distinct"
    stress: str = "aligned"
    position: str = "end"
    boundary: str = "simple"
    length: str = "equal"
    realisation: str = "phonetic"

    @property
    def span(self):
        return len(self.agreement)

    @property
    def span_name(self):
        return SPAN.get(self.span, SPAN[4])

    def cells(self):
        return [CELL_NAMES.get(a, ()) for a in self.agreement]

    def key(self):
        return (self.agreement, self.identity, self.stress, self.position,
                self.boundary, self.length, self.realisation)

    def names(self):
        """-> the traditional names for this exact point, possibly empty."""
        return NAMED.get(self.key(), ())

    def describe(self):
        nm = self.names()
        head = " / ".join(nm) if nm else "UNNAMED"
        per = ", ".join(
            (CELL_NAMES.get(a) or ("no-name",))[0] for a in self.agreement)
        return (f"{head} — {self.span_name} ({self.span} syl: {per}), "
                f"{self.identity}, {self.stress} stress, {self.position}, "
                f"{self.boundary}, {self.length}, {self.realisation}")


def space_size(max_span=3):
    """How many distinct rhyme types exist up to a given anchor span."""
    total = 0
    for s in range(1, max_span + 1):
        total += (8 ** s) * len(IDENTITY) * len(STRESS) * len(POSITION) \
            * len(BOUNDARY) * len(LENGTH) * len(REALISATION)
    return total


def enumerate_types(max_span=2, **fixed):
    """Yield every RhymeType up to `max_span`. `fixed` pins any axis, which is
    how a caller asks for a tractable slice -- e.g. position='internal'."""
    axes = {"identity": IDENTITY, "stress": STRESS, "position": POSITION,
            "boundary": BOUNDARY, "length": LENGTH,
            "realisation": REALISATION}
    for k, v in fixed.items():
        if k not in axes:
            raise ValueError(f"{k!r} is not an axis; declared axes are "
                             f"{sorted(axes)} plus the agreement pattern")
        axes[k] = (v,)
    for s in range(1, max_span + 1):
        for agr in itertools.product(agreement_cells(), repeat=s):
            for combo in itertools.product(*axes.values()):
                yield RhymeType(agreement=agr, **dict(zip(axes, combo)))


# ---------------------------------------------------------------------------
# NAMED TYPES AS COORDINATES
# ---------------------------------------------------------------------------

NAMED = {}
PERFECT = (0, 1, 1)
RICH = (1, 1, 1)
ASSON = (0, 1, 0)
CONSON = (0, 0, 1)
ALLIT = (1, 0, 0)
PARA = (1, 0, 1)


def name(t, *names):
    NAMED.setdefault(t.key(), ())
    NAMED[t.key()] = NAMED[t.key()] + names
    return t


# -- the core by span
name(RhymeType(((0, 1, 1),)), "masculine rhyme", "single rhyme")
name(RhymeType(((0, 1, 1), (1, 1, 1))), "feminine rhyme", "double rhyme")
name(RhymeType(((0, 1, 1), (1, 1, 1), (1, 1, 1))),
     "dactylic rhyme", "triple rhyme")
name(RhymeType(((0, 1, 1), (1, 1, 1), (1, 1, 1), (1, 1, 1))),
     "multisyllabic rhyme", "chain rhyme")

# -- partial agreement
name(RhymeType((ASSON,)), "assonance", "slant rhyme (vowel)")
name(RhymeType((CONSON,)), "consonance", "slant rhyme (consonant)")
name(RhymeType((PARA,)), "pararhyme")
name(RhymeType((ALLIT,)), "alliteration", "head rhyme")
name(RhymeType((ALLIT,), position="head"), "initial alliteration")
name(RhymeType(((1, 1, 0),)))          # deliberately nameless

# -- identity
name(RhymeType((RICH,), identity="rich"), "rime riche", "rich rhyme")
name(RhymeType((RICH,), identity="same_word"), "repetition", "identical rhyme")
name(RhymeType((RICH,), identity="same_word", position="end"),
     "refrain rhyme", "burden", "radif-adjacent")
name(RhymeType((RICH,), identity="rich", realisation="phonetic"),
     "homophone rhyme")

# -- stress
name(RhymeType((PERFECT,), stress="wrenched"), "wrenched rhyme",
     "forced-stress rhyme")
name(RhymeType((PERFECT,), stress="unstressed"), "syllabic rhyme",
     "unaccented rhyme", "weak rhyme")

# -- position
name(RhymeType((PERFECT,), position="internal"), "internal rhyme")
name(RhymeType((PERFECT,), position="leonine"), "leonine rhyme")
name(RhymeType((PERFECT,), position="cross"), "cross rhyme",
     "interlaced rhyme")
name(RhymeType((PERFECT,), position="holorhyme"), "holorhyme")
name(RhymeType((ALLIT,), position="internal"), "internal alliteration")

# -- boundary
name(RhymeType((PERFECT,), boundary="mosaic"), "mosaic rhyme",
     "compound rhyme")
name(RhymeType((PERFECT,), boundary="broken"), "broken rhyme", "split rhyme")
name(RhymeType((PERFECT,), boundary="phrasal"), "phrasal rhyme")

# -- length
name(RhymeType((PERFECT,), length="additive"), "additive rhyme")
name(RhymeType((PERFECT,), length="subtractive"), "subtractive rhyme")
name(RhymeType((PERFECT,), length="apocopated"), "apocopated rhyme")
name(RhymeType(((0, 1, 1), (0, 0, 0))), "semirhyme")

# -- realisation
name(RhymeType((PERFECT,), realisation="eye"), "eye rhyme", "sight rhyme")
name(RhymeType((PERFECT,), realisation="historical"), "historical rhyme")

# -- the non-English relations, located in the SAME space rather than as
#    special cases. This is what the eight phonology modules bought.
name(RhymeType((CONSON,), position="internal"),
     "cynghanedd (consonant answer)", "skothending-adjacent")
name(RhymeType((RICH,), position="internal"), "adalhending-adjacent")
name(RhymeType((ALLIT,), position="head"),
     "studlar/hofudstafr", "higaad", "Kalevala alliteration (weak)")
name(RhymeType(((1, 1, 0),), position="head"),
     "Kalevala alliteration (strong)")
name(RhymeType((RICH,), identity="same_word", position="end"), "radif")
name(RhymeType((PERFECT,), position="end"), "qafiya", "antya-prasa")
name(RhymeType((ALLIT,), position="internal"),
     "dvitiyakshara-prasa", "anuprasa")


def named_count(max_span=2):
    """-> (named, total, unnamed_fraction) over the enumerated slice."""
    total = 0
    named = 0
    for t in enumerate_types(max_span=max_span):
        total += 1
        if t.names():
            named += 1
    return named, total, 1.0 - (named / total if total else 0)


def classify(agreement, **kw):
    """Build a RhymeType from channel agreements a phonology has computed.

    `agreement` is a list of (onset, nucleus, coda) booleans, one per syllable
    of the anchor. Nothing here transcribes: the caller's phonology decides
    what agrees, which is what lets Welsh, Persian and English relations be
    located in one space.
    """
    return RhymeType(agreement=tuple(tuple(int(bool(x)) for x in syl)
                                     for syl in agreement), **kw)


__all__ = ["CHANNELS", "SPAN", "IDENTITY", "STRESS", "POSITION", "BOUNDARY",
           "LENGTH", "REALISATION", "CELL_NAMES", "RhymeType",
           "agreement_cells", "space_size", "enumerate_types", "NAMED",
           "named_count", "classify"]

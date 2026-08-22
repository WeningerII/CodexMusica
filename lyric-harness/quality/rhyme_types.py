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
     AND SPAN IS DECLARED PER MEMBER, see axis 8: how far the span runs, and
     in which direction, is a property of each side's own anchor.

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
     POSITION IS COMPUTED FROM A FRAME OR IT IS NOT ASSERTED AT ALL, see
     "POSITION WAS INERT" below.

  6. WORD BOUNDARY
        simple (one word each side) · mosaic/compound (one word against
        several) · broken (a word split across the line end) · phrasal

  7. LENGTH MATCH
        equal · additive (one side carries extra material) · subtractive ·
        apocopated (final syllable dropped to make the match)

  8. ANCHOR -- WHAT FIXES THE ORIGIN OF THE SPAN INSIDE ITS MEMBER.
     DECLARED PER MEMBER, WITH A DETERMINACY. See the next section: this axis
     was missing, and its absence was a defect and not merely a gap.

  Plus one flag that is orthogonal to all of it: REALISATION -- phonetic
  (it sounds), eye (it is spelled alike and does not sound), or historical
  (it rhymed in an earlier pronunciation and no longer does). Eye and
  historical rhyme are the cases where the sound channels DISAGREE and the
  relation is real anyway, so they cannot be a cell of (1); they are a
  separate axis.

THE ANCHOR AXIS, AND WHY IT IS PER MEMBER

Before this axis existed, `classify_pair(a, b, phon)` compared `sa[-n:]`
against `sb[-n:]`. Suffix-aligned, both sides, always. The `position`
parameter was passed to the `RhymeType` constructor and never touched the
span computation, so `position='head'` changed the LABEL and not one
comparison. Measured, on the phonology whose whole relation is head
alliteration:

    classify_pair('kukka', 'kalevala', fin)
      -> compares 'kuk' against 'va' and 'ka' against 'la'
      -> per-syllable cells (no-name, PERFECT RHYME), verdict False
    fin.alliterates('kukka', 'kalevala') -> True

A false negative on the actual relation and a false-positive label, in one
call, because the origin of the span was fixed by a rule nobody declared.

ANCHOR VALUES, attested across the traditions this repo reads. Each is a rule
for locating ONE origin inside ONE member:

    unanchored                       the span is the whole member
    word-initial                     syllable 0 (Kalevala alliteration)
    word-final                       the last syllable
    fixed-index                      a declared index in the placement frame
                                     (Sanskrit dvitiyakshara = 1; the Old
                                     Norse vidhrhending = -2 of the LINE)
    first-prominent                  first stressed syllable of a RUN
    last-prominent                   nucleus of the LAST stressed syllable
                                     (the English end-rhyme rule)
    prominent-onset                  onset of A prominent syllable -- plural,
                                     so its determinacy is normally SEARCHED
                                     (Old Norse studlar, the frumhending pool)
    final-unprominent                the final UNSTRESSED syllable
                                     (syllabic / unaccented rhyme)
    penultimate-prominent            the penultimate stressed syllable
                                     (apocopated rhyme)
    token-edge                       the edge of a token run, side declared
    line-edge                        the edge of the LINE, side declared
    half-line-head                   the head of a half-line
    half-line-final-accented-vowel   the last prominent nucleus of a half-line
    rawi                             the rawi consonant of a qafiya

and a DETERMINACY saying how the value got fixed:

    rule-fixed   the language's or the form's rule fixes it
    declared     the caller states it, and the module records that they did
    searched     it is found by trying candidates -- and the number tried is
                 REPORTED, because taking the best of k is k hypotheses
                 (doctrine 56) and a searched rate is not an unsearched one

PER MEMBER IS NOT OPTIONAL, AND WELSH PROVES IT

In cynghanedd draws the first half-line's consonant skeleton is answered as
the TAIL of the second half-line's, after an unanswered bridge: side A is
head-anchored and exhaustive, side B is tail-anchored and its origin is
searched. In cynghanedd groes the two skeletons must be equal: both sides
head-anchored. Suffix-align both and you get traws right and croes wrong;
head-align both and you get croes right and traws wrong. No single global
alignment covers the pair -- measured on 1,558 lines of Alun in
`test_taxonomy.py`. Welsh even has a name, sain drosgl, for a relation whose
two members are located by different rules; cynghanedd lusg is the same
shape at the syllable level and is checked here.

Three named types share their placement and their channels and differ ONLY
by anchor: perfect rhyme (last stressed syllable), syllabic rhyme (final
unstressed syllable), apocopated rhyme (penultimate stressed syllable). Under
the old model two of the three were coded on the STRESS and LENGTH axes,
which is why `length='apocopated'` was a value nothing could ever compute.

POSITION WAS INERT, AND AN INERT PARAMETER THAT LOOKS LIVE IS WORSE THAN AN
ABSENT ONE

`position` is now either COMPUTED from a `Frame` -- the line each member sits
in, and where its caesura is -- or it is not set. A caller who declares a
position without handing over the frame that would verify it gets
`Unverifiable`, not a label. `RhymeType.position` may be None, and None means
UNLOCATED: the relation was read, its placement was not.

WHAT THIS MODULE IS NOT

It does not transcribe. It defines and enumerates the space, and `classify()`
takes channel agreements that a phonology has already computed -- English from
`lyric_harness`, or any of the eight declared modules in `quality/phonology/`.
Keeping it phonology-free is what lets a Welsh or Persian relation be located
in the same space as an English one instead of being a special case. The
anchor rules are stated over `Syllable.prominence`, which every module already
carries, and NOT over stress -- doctrine 35, prominence is not always stress:
in `san` it is guru/laghu and in `ltc` it is the tone class, so an anchor rule
written as "last stressed syllable" would be reading a quantity as an accent.
Where a phonology carries no prominence at all (`som`, `msa`, `fas`) every
prominence-dependent anchor RAISES. That refusal predates this axis and is
the repo conceding the anchor rule is a coordinate.

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


class _NotAsked:
    """Sentinel. 'The phonology was not asked' is a third state and it is not
    None -- `fas` returning None is a REFUSAL and carries information."""

    def __repr__(self):
        return "NOT_ASKED"


_NOT_ASKED = _NotAsked()

#: Span NAMES. The span itself is an unbounded integer -- these are labels for
#: the low end, not a ceiling. A 5-syllable multisyllabic rhyme is span 5 and
#: reports "5-syllable", not "extended".
SPAN = {1: "masculine", 2: "feminine", 3: "dactylic"}


def span_name(n):
    return SPAN.get(n, f"{n}-syllable multisyllabic")
IDENTITY = ("distinct", "same_word", "rich")
STRESS = ("aligned", "wrenched", "unstressed")
POSITION = ("end", "internal", "leonine", "cross", "head", "holorhyme")
BOUNDARY = ("simple", "mosaic", "broken", "phrasal")
LENGTH = ("equal", "additive", "subtractive", "apocopated")
REALISATION = ("phonetic", "eye", "historical")

#: UNLOCATED. `position=None` on a RhymeType is not a missing value to be
#: filled with the modal one; it is the statement that the relation was read
#: and its placement was not measured, because no frame was supplied.
UNLOCATED = None

# ---------------------------------------------------------------------------
# AXIS 8 -- ANCHOR, PER MEMBER
# ---------------------------------------------------------------------------

#: Every anchor rule this module can resolve. Grouped by what each one NEEDS,
#: because that grouping is the whole reason the axis exists: a rule with no
#: referent in a language is refused rather than defaulted to the tail.
ANCHOR_RULES = (
    # need nothing but the member's syllables
    "unanchored",
    "word-initial",
    "word-final",
    "fixed-index",
    # need the phonology to carry prominence -- refused where it does not
    "first-prominent",
    "last-prominent",
    "prominent-onset",
    "final-unprominent",
    "penultimate-prominent",
    # need a frame the caller must supply -- refused where it is absent
    "token-edge",
    "line-edge",
    "half-line-head",
    "half-line-final-accented-vowel",
    "rawi",
)

#: Rules that read `Syllable.prominence`. In `som`, `msa` and `fas` prominence
#: is None for every syllable and all five of these RAISE.
PROMINENCE_RULES = ("first-prominent", "last-prominent", "prominent-onset",
                    "final-unprominent", "penultimate-prominent")

#: Rules that need a Frame. Without one they raise; they never fall back.
FRAME_RULES = ("line-edge", "half-line-head",
               "half-line-final-accented-vowel", "rawi")

DETERMINACY = ("rule-fixed", "declared", "searched")

#: Span RULES, as opposed to an integer span. An integer is a count of
#: syllables FROM the anchor: positive runs rightward, negative leftward, and
#: `span=1` is the anchor syllable alone.
SPAN_RULES = ("to-end", "to-start", "whole")

SIDES = ("initial", "final")


@dataclass(frozen=True)
class Anchor:
    """Where ONE member's span starts, how it got fixed, and how far it runs.

    Anchor and span are one object because an anchor without a span is only
    half a locator: 'the last stressed syllable' does not say whether the
    relation runs from there to the word end (perfect rhyme) or covers that
    syllable alone (a hending).
    """
    rule: str = "last-prominent"
    determinacy: str = "rule-fixed"
    span: object = "to-end"        # 'to-end' | 'to-start' | 'whole' | int
    index: object = None           # fixed-index: which index
    side: object = None            # token-edge / line-edge: 'initial'|'final'

    def __post_init__(self):
        if self.rule not in ANCHOR_RULES:
            raise ValueError(
                f"{self.rule!r} is not a declared anchor rule; declared rules "
                f"are {list(ANCHOR_RULES)}. Anchoring is a coordinate, so an "
                f"undeclared rule is refused rather than approximated.")
        if self.determinacy not in DETERMINACY:
            raise ValueError(
                f"{self.determinacy!r} is not a determinacy; declared values "
                f"are {list(DETERMINACY)}.")
        if not (self.span in SPAN_RULES or isinstance(self.span, int)):
            raise ValueError(
                f"span={self.span!r}; declared span rules are "
                f"{list(SPAN_RULES)} or an integer count of syllables from "
                f"the anchor (negative runs leftward).")
        if isinstance(self.span, int) and self.span == 0:
            raise ValueError("a span of zero syllables locates nothing")
        if self.rule == "fixed-index" and self.index is None:
            raise ValueError(
                "anchor rule 'fixed-index' with no index. The index IS the "
                "rule; leaving it out is the defect this axis removes.")
        if self.rule == "unanchored" and self.span != "whole":
            raise ValueError(
                "'unanchored' means there is no origin, so its only coherent "
                "span is 'whole'. A span measured from an origin that does "
                "not exist is the inert-parameter defect again.")
        if self.side is not None and self.side not in SIDES:
            raise ValueError(f"side={self.side!r}; declared sides are "
                             f"{list(SIDES)}")

    @property
    def direction(self):
        if self.span == "to-end":
            return "rightward"
        if self.span == "to-start":
            return "leftward"
        if self.span == "whole":
            return "rightward"
        return "rightward" if self.span > 0 else "leftward"

    @property
    def needs_prominence(self):
        return self.rule in PROMINENCE_RULES

    @property
    def needs_frame(self):
        return self.rule in FRAME_RULES

    def describe(self):
        s = self.span if isinstance(self.span, str) else f"{self.span:+d} syl"
        extra = ""
        if self.index is not None:
            extra += f" index={self.index}"
        if self.side is not None:
            extra += f" side={self.side}"
        return f"{self.rule}[{self.determinacy}]{extra} span={s}"


#: The English end-rhyme locator, and the module default. It is a COORDINATE
#: and not a universal; naming it here is the point.
LAST_PROMINENT = Anchor("last-prominent", "rule-fixed", "to-end")
#: The head locator. Kalevala alliteration, higaad, studlar.
WORD_INITIAL = Anchor("word-initial", "rule-fixed", 1)
#: The final unstressed syllable -- syllabic / unaccented rhyme.
FINAL_UNPROMINENT = Anchor("final-unprominent", "rule-fixed", "to-end")
#: The penultimate stressed syllable -- apocopated rhyme.
PENULTIMATE_PROMINENT = Anchor("penultimate-prominent", "rule-fixed", "to-end")

#: THE THREE THAT DIFFER ONLY BY ANCHOR. Same span, same direction, same
#: determinacy, same everything -- one syllable, located by three rules. The
#: span is 1 here and not 'to-end' on purpose: with a to-end span the three
#: would also differ in how much material they cover, and then "they differ
#: only by anchor" would be untrue of the objects even while true of the
#: prose. `apocopated` with a to-end span is in fact UNEMITTABLE -- the
#: penultimate prominent syllable is by definition not the last one, so its
#: to-end span is never one syllable. Registering it that way would have put
#: an unreachable name in the registry, which is the defect being removed.
PERFECT_ANCHOR = Anchor("last-prominent", "rule-fixed", 1)
SYLLABIC_ANCHOR = Anchor("final-unprominent", "rule-fixed", 1)
APOCOPATED_ANCHOR = Anchor("penultimate-prominent", "rule-fixed", 1)
#: Sanskrit dvitiyakshara-prasa: the SECOND aksara of the pada, by the form.
SECOND_AKSARA = Anchor("fixed-index", "rule-fixed", 1, index=1)
#: Old Norse vidhrhending: the penultimate syllable of the LINE, by the metre.
LINE_PENULT = Anchor("fixed-index", "rule-fixed", 1, index=-2)
#: The frumhending of a dróttkvætt line and the earlier member of a cynghanedd
#: lusg: SEARCHED among the prominent syllables, because the tradition does not
#: fix which one answers -- it fixes only that one of them must.
PROMINENT_SEARCH = Anchor("first-prominent", "searched", 1)
#: Old Norse stuðlar: searched among the prominent syllables that HAVE an
#: onset, because there the alliterating consonant IS the relation and a
#: vowel-initial lift is a separate class, not an empty onset.
PROMINENT_ONSET_SEARCH = Anchor("prominent-onset", "searched", 1)
#: Welsh cynghanedd lusg: the final word answers on its stressed PENULT, which
#: is not its final syllable, and the earlier member is searched.
WELSH_PENULT = Anchor("last-prominent", "rule-fixed", 1)

#: Named locator TRIPLES -- (anchor_a, anchor_b, select) -- so a caller
#: declares a form rather than two anchors and a scoring rule. A preset is a
#: declaration, not a detection: nothing here sniffs a language.
#:
#: `select` is the third thing that has to be declared, and leaving it out was
#: a measurable error and not a tidiness point. A SEARCHED anchor has to
#: choose among candidates, and scoring every channel equally makes an
#: onset+coda match TIE with a nucleus+coda match -- so on Welsh cynghanedd
#: lusg, whose predicate is rhyme, the search took an alliterating candidate
#: 12 times in 104 and the tie was then broken by pool order. Naming the
#: channels the search maximises fixed all 12. Doctrine 61: pick between rule
#: variants by what they are a rule ABOUT, not by which one fires.
PRESETS = {
    "english-end-rhyme": (LAST_PROMINENT, LAST_PROMINENT, ("nucleus", "coda")),
    "kalevala-alliteration": (WORD_INITIAL, WORD_INITIAL, ("onset",)),
    # the anchor-contrast trio: identical but for the rule that finds the
    # origin, which is the whole claim of axis 8 in three objects
    "perfect-rhyme": (PERFECT_ANCHOR, PERFECT_ANCHOR, ("nucleus", "coda")),
    "syllabic-rhyme": (SYLLABIC_ANCHOR, SYLLABIC_ANCHOR, ("nucleus", "coda")),
    "apocopated-rhyme": (APOCOPATED_ANCHOR, APOCOPATED_ANCHOR,
                         ("nucleus", "coda")),
    "dvitiyakshara-prasa": (SECOND_AKSARA, SECOND_AKSARA, ("onset",)),
    "drottkvaett-hending": (PROMINENT_SEARCH, LINE_PENULT, ("coda",)),
    "drottkvaett-adalhending": (PROMINENT_SEARCH, LINE_PENULT,
                                ("nucleus", "coda")),
    "studlar": (PROMINENT_ONSET_SEARCH, PROMINENT_ONSET_SEARCH, ("onset",)),
    "cynghanedd-lusg": (PROMINENT_SEARCH, WELSH_PENULT, ("nucleus", "coda")),
}


def agreement_cells(ternary=False):
    """Single-syllable agreement patterns as (onset, nucleus, coda).

    BINARY (8 cells) is the fully-determined subset. TERNARY (27) is the real
    space, because a channel can be UNKNOWN and that is not a third kind of
    disagreement -- it is a refusal.

    This is the rhyme-side of the same defect `meter.py` fixed: a binary
    channel forces `fas.py`'s unwritten short vowel to be coerced to agrees or
    differs, and both are assertions the orthography does not support. 60.2%
    of real Hafez rhyme pairs land there.
    """
    vals = (False, True, None) if ternary else (False, True)
    return list(itertools.product(vals, repeat=3))


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
    position: object = "end"    # a POSITION value, or None = UNLOCATED
    boundary: str = "simple"
    length: str = "equal"
    realisation: str = "phonetic"
    #: axis 8, per member. Defaults keep every pre-anchor registry entry
    #: resolving exactly as it did.
    anchor_a: Anchor = LAST_PROMINENT
    anchor_b: Anchor = LAST_PROMINENT

    @property
    def span(self):
        return len(self.agreement)

    @property
    def span_name(self):
        return span_name(self.span)

    @property
    def anchors_differ(self):
        """True when the two members are located by different rules.

        This is the sain drosgl case, and the reason the axis is per member.
        """
        return self.anchor_a != self.anchor_b

    @property
    def determined(self):
        """True when every channel of every syllable has an answer."""
        return all(v is not None for syl in self.agreement for v in syl)

    @property
    def unknown_channels(self):
        """-> [(syllable_index, channel_name)] the phonology could not decide.
        The list a caller needs to know WHY a verdict is None."""
        return [(i, CHANNELS[j]) for i, syl in enumerate(self.agreement)
                for j, v in enumerate(syl) if v is None]

    def realises(self, *channels, at=0):
        """-> True / False / None: do the named channels ALL agree at `at`?

        `at` counts steps FROM EACH MEMBER'S OWN ANCHOR, which is what makes a
        head-anchored member comparable with a tail-anchored one. The tri-state
        propagates: one unknown channel makes the whole predicate unknown.

        This is what lets one coordinate answer several relations without a
        second detector -- `realises('onset')` is alliteration and
        `realises('nucleus', 'coda')` is rhyme, off the same read.
        """
        if not channels:
            raise ValueError("name at least one channel of " + str(CHANNELS))
        if not -len(self.agreement) <= at < len(self.agreement):
            return None
        syl = self.agreement[at]
        vals = []
        for c in channels:
            if c not in CHANNELS:
                raise ValueError(f"{c!r} is not a channel; declared channels "
                                 f"are {list(CHANNELS)}")
            vals.append(syl[CHANNELS.index(c)])
        if any(v is None for v in vals):
            return None
        return all(bool(v) for v in vals)

    # -- the two routes to a verdict ---------------------------------------
    #
    # CHANNEL EQUALITY IS NOT THE RELATION IN EVERY PHONOLOGY, and Middle
    # Chinese is the proof. 流 and 樓 have DIFFERENT nuclei -- 尤 against 侯,
    # two rime categories in the Qieyun -- so a channel test says they do not
    # rhyme. They are the rhyme of 登鸛雀樓. The 平水韻 同用 grouping merges
    # the categories, and that grouping is a TABLE: `ltc.py` is a lexicalised
    # lookup, not a G2P, and its relation is not derivable from its channels.
    # Doctrine 36 in the general form -- the granularity a reference work
    # records is not the granularity a form works at.
    #
    # So where a phonology DECLARES a relation and implements the predicate,
    # the producer asks it instead of re-deriving one, and `route` says which
    # answer this is. Re-deriving would let this module contradict the only
    # dated phonology in the repo while looking confident.

    def channel_verdict(self):
        """What the CHANNELS say. Always available, always the same rule."""
        return self.realises("nucleus", "coda")

    def channel_alliteration(self):
        return self.realises("onset")

    @property
    def declared_rhyme(self):
        """The phonology's own rhyme verdict, or None if it was not asked.

        Not asked means one of: the phonology declares no rhyme relation, a
        member is more than one token, or the caller declared a locator of
        their own -- in which case `phon.rhymes()` is answering a DIFFERENT
        question and its answer is not evidence about this one.
        """
        v = getattr(self, "_declared_rhyme", _NOT_ASKED)
        return None if v is _NOT_ASKED else v

    @property
    def declared_alliteration(self):
        v = getattr(self, "_declared_allit", _NOT_ASKED)
        return None if v is _NOT_ASKED else v

    @property
    def route(self):
        """-> {'rhyme': ..., 'alliteration': ...}, each 'channels' or
        'declared_relation'. Which route produced each verdict."""
        return {
            "rhyme": ("declared_relation"
                      if getattr(self, "_declared_rhyme", _NOT_ASKED)
                      is not _NOT_ASKED else "channels"),
            "alliteration": ("declared_relation"
                             if getattr(self, "_declared_allit", _NOT_ASKED)
                             is not _NOT_ASKED else "channels"),
        }

    @property
    def disagreements(self):
        """-> {predicate: (channel answer, declared answer)} where the two
        routes were BOTH asked and gave different answers.

        Never resolved silently. A disagreement is how the Middle Chinese
        case was found, and a producer that hid it would have shipped a
        confident wrong answer on this project's strongest positive control.
        """
        out = {}
        for pred, chan, decl in (
                ("rhyme", self.channel_verdict(),
                 getattr(self, "_declared_rhyme", _NOT_ASKED)),
                ("alliteration", self.channel_alliteration(),
                 getattr(self, "_declared_allit", _NOT_ASKED))):
            if decl is not _NOT_ASKED and decl != chan:
                out[pred] = (chan, decl)
        return out

    def verdict(self):
        """Do these rhyme? True / False / None, propagating the unknown.

        None is not a failure path. It is the answer whenever the decision
        rests on a channel the phonology declined to read -- or on a relation
        the phonology declined to decide, which `fas` does on 60.2% of real
        Hafez pairs and which is the designed outcome, not a gap.
        """
        v = getattr(self, "_declared_rhyme", _NOT_ASKED)
        return self.channel_verdict() if v is _NOT_ASKED else v

    def alliterates(self):
        """Do these alliterate? The same read, a different predicate."""
        v = getattr(self, "_declared_allit", _NOT_ASKED)
        return self.channel_alliteration() if v is _NOT_ASKED else v

    def cells(self):
        return [CELL_NAMES.get(a, ()) for a in self.agreement]

    def key(self):
        return (self.agreement, self.identity, self.stress, self.position,
                self.boundary, self.length, self.realisation,
                self.anchor_a, self.anchor_b)

    def names(self, ignoring=()):
        """-> the traditional names at this coordinate, possibly empty.

        Exact points first, then REGIONS. Not every traditional name is a
        point: 'Kalevala alliteration' is defined by a head anchor and the
        onset channel and says nothing whatever about whether one word is
        longer than the other, so registering it at `length='equal'` would
        make it unreachable for every real pair where the two words differ in
        length -- which is most of them. `FREE` records, per registered name,
        exactly which axes that name leaves open, so a region is a declaration
        and not a fuzzy match.

        `ignoring` is the caller's own projection, on top of that, and it must
        be named: `names(ignoring=('length',))` says out loud which coordinate
        is being thrown away to get an answer.
        """
        bad = [k for k in ignoring if k not in AXIS_INDEX]
        if bad:
            raise ValueError(f"{bad} are not axes; declared axes are "
                             f"{sorted(AXIS_INDEX)}")
        out = list(NAMED.get(self.key(), ()))
        mine = self.key()
        for k, free in FREE.items():
            if k == mine:
                continue
            skip = set(free) | set(ignoring)
            if all(mine[i] == k[i] for ax, i in AXIS_INDEX.items()
                   if ax not in skip):
                out.extend(n for n in NAMED[k] if n not in out)
        if ignoring:
            for k in NAMED:
                if k == mine or k in FREE:
                    continue
                if all(mine[i] == k[i] for ax, i in AXIS_INDEX.items()
                       if ax not in set(ignoring)):
                    out.extend(n for n in NAMED[k] if n not in out)
        return tuple(out)

    def describe(self):
        nm = self.names()
        head = " / ".join(nm) if nm else "UNNAMED"
        per = ", ".join(
            (CELL_NAMES.get(a) or ("no-name",))[0] for a in self.agreement)
        pos = "UNLOCATED" if self.position is None else self.position
        anc = (self.anchor_a.describe() if not self.anchors_differ
               else f"A {self.anchor_a.describe()} | B {self.anchor_b.describe()}")
        return (f"{head} — {self.span_name} ({self.span} syl: {per}), "
                f"{self.identity}, {self.stress} stress, {pos}, "
                f"{self.boundary}, {self.length}, {self.realisation}; "
                f"anchor {anc}")


#: How many distinct Anchor VALUES the axis carries, counted honestly: every
#: rule crossed with every determinacy. `fixed-index` and the two edge rules
#: additionally carry an index or a side, which is unbounded, so this is a
#: floor on the anchor axis and stated as one.
ANCHOR_VALUES = len(ANCHOR_RULES) * len(DETERMINACY)


def space_size(max_span=3, anchors=False):
    """How many distinct rhyme types exist up to a given anchor span.

    `anchors=False` counts the seven PLACEMENT axes only, which is the number
    this module reported before the anchor axis existed and is kept so the
    two are comparable. `anchors=True` multiplies in the per-member anchor
    coordinate -- twice, because it is declared per member -- and that
    multiple, ANCHOR_VALUES ** 2, is the size of the hole the old model had.
    """
    total = 0
    for s in range(1, max_span + 1):
        total += (8 ** s) * len(IDENTITY) * len(STRESS) * len(POSITION) \
            * len(BOUNDARY) * len(LENGTH) * len(REALISATION)
    return total * (ANCHOR_VALUES ** 2) if anchors else total


def enumerate_types(max_span=2, anchors=(), **fixed):
    """Yield every RhymeType up to `max_span`. `fixed` pins any axis, which is
    how a caller asks for a tractable slice -- e.g. position='internal'.

    The anchor axis is NOT enumerated by default and that is a tractability
    choice, stated rather than hidden: crossing it in would multiply every
    slice by ANCHOR_VALUES ** 2 = 1,764. Pass `anchors=[Anchor(...), ...]` to
    enumerate over a declared set of locators; `space_size(anchors=True)`
    reports the full size either way.
    """
    axes = {"identity": IDENTITY, "stress": STRESS, "position": POSITION,
            "boundary": BOUNDARY, "length": LENGTH,
            "realisation": REALISATION}
    for k, v in fixed.items():
        if k not in axes:
            raise ValueError(f"{k!r} is not an axis; declared axes are "
                             f"{sorted(axes)} plus the agreement pattern and "
                             f"the per-member anchors")
        axes[k] = (v,)
    pairs = [(LAST_PROMINENT, LAST_PROMINENT)] if not anchors else \
        list(itertools.product(anchors, repeat=2))
    for s in range(1, max_span + 1):
        for agr in itertools.product(agreement_cells(), repeat=s):
            for combo in itertools.product(*axes.values()):
                for aa, ab in pairs:
                    yield RhymeType(agreement=agr, anchor_a=aa, anchor_b=ab,
                                    **dict(zip(axes, combo)))


# ---------------------------------------------------------------------------
# NAMED TYPES AS COORDINATES
# ---------------------------------------------------------------------------

NAMED = {}
#: key -> the axes that name leaves FREE. A traditional name is sometimes a
#: point and sometimes a region, and which it is has to be declared rather
#: than discovered by a caller whose lookup came back empty.
FREE = {}
#: axis name -> its index in `RhymeType.key()`.
AXIS_INDEX = {"agreement": 0, "identity": 1, "stress": 2, "position": 3,
              "boundary": 4, "length": 5, "realisation": 6,
              "anchor_a": 7, "anchor_b": 8}
PERFECT = (0, 1, 1)
RICH = (1, 1, 1)
ASSON = (0, 1, 0)
CONSON = (0, 0, 1)
ALLIT = (1, 0, 0)
PARA = (1, 0, 1)


def name(t, *names, free=()):
    bad = [k for k in free if k not in AXIS_INDEX]
    if bad:
        raise ValueError(f"{bad} are not axes")
    NAMED.setdefault(t.key(), ())
    NAMED[t.key()] = NAMED[t.key()] + names
    if free:
        FREE[t.key()] = tuple(free)
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

# ---------------------------------------------------------------------------
# THE SAME NAMES, KEYED ON THE ANCHOR THAT ACTUALLY LOCATES THEM
#
# Everything above this line keys 'where the relation sits' on `position`,
# which is a fact about the LINE, and several of those entries were using it
# to mean 'where the span starts inside the WORD', which is the anchor. The
# entries below are the anchor-keyed forms; they are what `classify_pair` can
# now emit, and they leave the originals untouched so nothing that resolved
# before stops resolving.
#
# The three that prove the axis: same channels, same placement, and they
# separate ONLY on the anchor.
# ---------------------------------------------------------------------------

#: The axes an anchor-keyed relation name leaves FREE, and why each one.
#:   stress       is DETERMINED by the anchor rule -- 'final-unprominent' can
#:                only ever be unstressed -- so pinning it adds nothing and
#:                would make the name unreachable off a real pair
#:   length       is about material OUTSIDE the compared span
#:   boundary     this producer does not measure it; it is declared
#:   realisation  likewise -- it is an orthographic fact, not a channel
_ANCHORED_FREE = ("stress", "length", "boundary", "realisation")

name(RhymeType((PERFECT,), position=UNLOCATED,
               anchor_a=PERFECT_ANCHOR, anchor_b=PERFECT_ANCHOR),
     "perfect rhyme (last stressed syllable)", free=_ANCHORED_FREE)
name(RhymeType((PERFECT,), position=UNLOCATED,
               anchor_a=SYLLABIC_ANCHOR, anchor_b=SYLLABIC_ANCHOR),
     "syllabic rhyme (final unstressed syllable)", free=_ANCHORED_FREE)
name(RhymeType((PERFECT,), position=UNLOCATED,
               anchor_a=APOCOPATED_ANCHOR, anchor_b=APOCOPATED_ANCHOR),
     "apocopated rhyme (penultimate stressed syllable)", free=_ANCHORED_FREE)
# the same three at full identity of sound, which is what real pairs give
# whenever the onsets agree too
name(RhymeType((RICH,), identity="rich", position=UNLOCATED,
               anchor_a=PERFECT_ANCHOR, anchor_b=PERFECT_ANCHOR),
     "rime riche (last stressed syllable)", free=_ANCHORED_FREE)
name(RhymeType((RICH,), identity="rich", position=UNLOCATED,
               anchor_a=SYLLABIC_ANCHOR, anchor_b=SYLLABIC_ANCHOR),
     "syllabic rime riche", free=_ANCHORED_FREE)
name(RhymeType((RICH,), identity="rich", position=UNLOCATED,
               anchor_a=APOCOPATED_ANCHOR, anchor_b=APOCOPATED_ANCHOR),
     "apocopated rime riche", free=_ANCHORED_FREE)

# head-anchored alliteration, which is what 'head' was standing in for
name(RhymeType((ALLIT,), position=UNLOCATED,
               anchor_a=WORD_INITIAL, anchor_b=WORD_INITIAL),
     "Kalevala alliteration (weak)", "higaad", "studlar/hofudstafr",
     "head alliteration", free=_ANCHORED_FREE)
name(RhymeType(((1, 1, 0),), position=UNLOCATED,
               anchor_a=WORD_INITIAL, anchor_b=WORD_INITIAL),
     "Kalevala alliteration (strong)", free=_ANCHORED_FREE)
name(RhymeType((RICH,), identity="rich", position=UNLOCATED,
               anchor_a=WORD_INITIAL, anchor_b=WORD_INITIAL),
     "Kalevala alliteration (strong, closed syllable)", free=_ANCHORED_FREE)
name(RhymeType((PARA,), position=UNLOCATED,
               anchor_a=WORD_INITIAL, anchor_b=WORD_INITIAL),
     "Kalevala alliteration (weak, framed)", free=_ANCHORED_FREE)

# Sanskrit: the anchor is an INDEX in the pāda, not a stress
name(RhymeType((ALLIT,), position=UNLOCATED,
               anchor_a=SECOND_AKSARA, anchor_b=SECOND_AKSARA),
     "dvitiyakshara-prasa", "anuprasa (second-aksara)", free=_ANCHORED_FREE)
name(RhymeType((RICH,), identity="rich", position=UNLOCATED,
               anchor_a=SECOND_AKSARA, anchor_b=SECOND_AKSARA),
     "dvitiyakshara-prasa (full aksara)", free=_ANCHORED_FREE)
name(RhymeType((PARA,), position=UNLOCATED,
               anchor_a=SECOND_AKSARA, anchor_b=SECOND_AKSARA),
     "dvitiyakshara-prasa (consonant only)", free=_ANCHORED_FREE)

# Old Norse: the two members of ONE relation, located by DIFFERENT rules
name(RhymeType((CONSON,), position=UNLOCATED,
               anchor_a=PROMINENT_SEARCH, anchor_b=LINE_PENULT),
     "skothending", free=_ANCHORED_FREE)
name(RhymeType((RICH,), identity="rich", position=UNLOCATED,
               anchor_a=PROMINENT_SEARCH, anchor_b=LINE_PENULT),
     "adalhending (identical onsets)", free=_ANCHORED_FREE)
name(RhymeType((PERFECT,), position=UNLOCATED,
               anchor_a=PROMINENT_SEARCH, anchor_b=LINE_PENULT),
     "adalhending", free=_ANCHORED_FREE)

# Welsh: sain drosgl in miniature -- searched against rule-fixed
name(RhymeType((PERFECT,), position=UNLOCATED,
               anchor_a=PROMINENT_SEARCH, anchor_b=WELSH_PENULT),
     "cynghanedd lusg", free=_ANCHORED_FREE)
name(RhymeType((RICH,), identity="rich", position=UNLOCATED,
               anchor_a=PROMINENT_SEARCH, anchor_b=WELSH_PENULT),
     "cynghanedd lusg (identical onsets)", free=_ANCHORED_FREE)


def named_count(max_span=2, **kw):
    """-> (named, total, unnamed_fraction) over the enumerated slice."""
    total = 0
    named = 0
    for t in enumerate_types(max_span=max_span, **kw):
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



# ---------------------------------------------------------------------------
# THE PRODUCER (gap E-1)
#
# Until this existed the seven-axis space was a vocabulary with nothing that
# could look at two words and return a coordinate. `classify()` took channel
# agreements a caller must already have computed, and no caller existed.
# ---------------------------------------------------------------------------


class Indeterminate(Exception):
    """The phonology cannot supply what the requested span needs."""


class Unverifiable(Indeterminate):
    """A coordinate was DECLARED that this call has no way to check.

    Subclasses Indeterminate so a caller that already refuses on 'cannot
    resolve' also refuses on 'cannot verify'; they are different failures and
    both are refusals.
    """


@dataclass(frozen=True)
class Frame:
    """What a member sits inside.

    Anchors that name a line, a half-line or a rawi have no referent without
    one, and `position` cannot be computed without one either. A Frame is
    always the CALLER's declaration -- nothing here parses a poem.
    """
    line_a: object = None
    line_b: object = None
    #: token index at which each line's SECOND half begins. Doctrine 55: a
    #: caesura is either printed or searched, never inferred from punctuation.
    caesura_a: object = None
    caesura_b: object = None
    #: the declared rawi consonant of a qafiya
    rawi: object = None

    def line(self, which):
        return self.line_a if which == "a" else self.line_b

    def caesura(self, which):
        return self.caesura_a if which == "a" else self.caesura_b


def _cmp(x, y):
    """Ternary channel comparison. None means the phonology declined."""
    if x is None or y is None:
        return None
    return x == y


def _read(text, phon):
    """-> (syllables, owner token index per syllable) or None.

    A member may be several tokens -- a half-line, a mosaic rhyme, a whole
    dróttkvætt line. Multi-token members are read TOKEN BY TOKEN and the
    results concatenated, which is what `non.scan` and `cym.skeleton` already
    do.

    IT IS NOT WHAT `san.scan_pada` DOES, and that module says so: Sanskrit
    resyllabifies across word boundaries in saṃhitā, so `yam ayuṅkta` scans
    ya-ma-yuṅk-ta and a token-by-token join would put the boundaries in the
    wrong place -- and every anchor rule here is an INDEX, so wrong boundaries
    are wrong anchors. A phonology that declares `scan_pada` gets it used, and
    the token owners come back None, because saṃhitā has dissolved the token
    edges and `token-edge` must then refuse rather than read a word boundary
    that the scansion no longer contains.

    If any token is unreadable the WHOLE member is refused, for the same
    reason: a scansion with a hole in it has the wrong indices after the hole.

    THIS MODULE DOES NOT TOKENISE. Members split on WHITESPACE and nothing
    else, so `'jörð kann frelsa, fyrðum'` is refused on the comma and the
    caller has to hand over `'jörð kann frelsa fyrðum'`. That is not laziness:
    doctrine 65 measured four languages giving one apostrophe four different
    treatments -- Finnish splits on it, Welsh joins, Old Norse fuses, Malay
    reads it as a phoneme that enters the rime -- so a punctuation rule
    written here would be wrong in at least three of them while looking
    plausible in all four. Punctuation is the caller's declaration, and each
    phonology already owns its own.
    """
    toks = str(text).split()
    if not toks:
        return None
    if len(toks) > 1 and hasattr(phon, "scan_pada"):
        s = phon.scan_pada(text)
        return (list(s), None) if s else None
    if len(toks) == 1:
        s = phon.syllabify(toks[0])
        return (list(s), [0] * len(s)) if s else None
    out, owner = [], []
    for i, t in enumerate(toks):
        s = phon.syllabify(t)
        if not s:
            return None
        out.extend(s)
        owner.extend([i] * len(s))
    return out, owner


def _prominence_present(sylls):
    return any(s.prominence is not None for s in sylls)


def _implements(phon, meth):
    """Does this phonology IMPLEMENT `meth`, or merely inherit the stub?

    The interface's own `rhymes`/`alliterates` return None for everything, and
    None from a stub is not the same object as None from `fas` refusing an
    unwritten short vowel. The stub is identified by the base class that
    declares `relation = 'none'` -- which is the interface saying, in its own
    fields, that it has no relation. No import of the phonology package: this
    module stays declaration-driven and duck-typed.
    """
    fn = getattr(type(phon), meth, None)
    if fn is None:
        return False
    for base in type(phon).__mro__[1:]:
        if getattr(base, meth, None) is fn \
                and getattr(base, "relation", None) == "none":
            return False
    return getattr(phon, "relation", "none") not in ("none", "unset")


def _ask(phon, meth, a, b):
    """-> the phonology's own tri-state, or _NOT_ASKED if it raised.

    A phonology that REFUSES by raising -- `san.stresses`, `som` on a stress
    grid -- has not answered, and recording its exception as False would be
    the defaulting error one level up.
    """
    try:
        v = getattr(phon, meth)(a, b)
    except Exception:
        return _NOT_ASKED
    return v if v in (True, False, None) else _NOT_ASKED


def resolve_anchor(anchor, sylls, owner=None, frame=None, which="a"):
    """-> tuple of candidate origin indices into `sylls`.

    One index when the rule fixes it, several when the determinacy is
    SEARCHED. Raises `Indeterminate` where the rule has no referent in this
    member, this phonology or this frame -- it never falls back to the tail,
    because defaulting to the tail is the defect the axis removes.
    """
    n = len(sylls)
    if n == 0:
        raise Indeterminate("an empty member has no anchor")
    r = anchor.rule
    if r == "token-edge" and owner is None:
        raise Indeterminate(
            "this member was read as one scanned unit, so its token edges are "
            "not in the scansion and 'token-edge' has no referent. That is "
            "saṃhitā doing what it does, not a missing feature.")
    owner = owner if owner is not None else [0] * n

    if anchor.needs_prominence and not _prominence_present(sylls):
        raise Indeterminate(
            f"anchor rule {r!r} reads Syllable.prominence, and this phonology "
            f"carries none -- som declines a stress grid because Somali has "
            f"pitch accent, msa because Malay stress is contested, fas because "
            f"classical Persian metre is quantitative. The rule has no "
            f"referent here; declare an index or a word edge instead. The rule "
            f"is a coordinate, not a universal.")
    if anchor.needs_frame and frame is None:
        raise Indeterminate(
            f"anchor rule {r!r} is located inside a frame -- a line, a "
            f"half-line or a declared rawi -- and no Frame was supplied. "
            f"Refusing rather than defaulting to a word edge.")

    if r == "unanchored":
        return (0,)
    if r == "word-initial":
        return (0,)
    if r == "word-final":
        return (n - 1,)
    if r == "fixed-index":
        i = anchor.index
        j = i if i >= 0 else n + i
        if not 0 <= j < n:
            raise Indeterminate(
                f"fixed-index {i} has no referent in a member of {n} "
                f"syllables. The index is the rule, so an out-of-range index "
                f"is a refusal and not a clamp to the nearest edge.")
        return (j,)
    if r in ("first-prominent", "last-prominent"):
        pool = [i for i in range(n) if sylls[i].prominence == 1]
        if not pool:
            raise Indeterminate("no prominent syllable in this member")
        if r == "last-prominent":
            pool.reverse()
        # SEARCHED returns the whole run, in the order the rule names it --
        # 'first-prominent' ascending, 'last-prominent' descending -- so the
        # tie-break is fixed by the rule and not by iteration order
        # (doctrine 66). rule-fixed takes the one the rule names and nothing
        # else; that is the difference between a rule and a search.
        return tuple(pool) if anchor.determinacy == "searched" else (pool[0],)
    if r == "penultimate-prominent":
        pro = [i for i in range(n) if sylls[i].prominence == 1]
        if len(pro) < 2:
            raise Indeterminate(
                f"this member has {len(pro)} prominent syllable(s), so it has "
                f"no PENULTIMATE one. Apocopated rhyme needs two.")
        return (pro[-2],)
    if r == "final-unprominent":
        for i in range(n - 1, -1, -1):
            if sylls[i].prominence == 0:
                return (i,)
        raise Indeterminate(
            "no unprominent syllable in this member, so 'the final unstressed "
            "syllable' has nothing to point at")
    if r == "prominent-onset":
        pool = tuple(i for i in range(n)
                     if sylls[i].prominence == 1 and sylls[i].onset)
        if not pool:
            raise Indeterminate(
                "no prominent syllable with an onset; the alliterating "
                "consonant of a vowel-initial lift is a separate class and is "
                "not silently read as the empty onset here")
        if anchor.determinacy != "searched" and len(pool) > 1:
            raise Indeterminate(
                f"{len(pool)} prominent onsets in this member and the "
                f"determinacy is {anchor.determinacy!r}. A rule that names "
                f"several positions is SEARCHED; saying it is rule-fixed and "
                f"then taking the first is an argmax nobody declared "
                f"(doctrine 19).")
        return pool
    if r == "token-edge":
        if anchor.side is None:
            raise Indeterminate("'token-edge' needs a declared side")
        edges = []
        for i in range(n):
            first = i == 0 or owner[i] != owner[i - 1]
            last = i == n - 1 or owner[i] != owner[i + 1]
            if (anchor.side == "initial" and first) or \
                    (anchor.side == "final" and last):
                edges.append(i)
        if anchor.determinacy == "searched":
            return tuple(edges)
        return (edges[0],) if anchor.side == "initial" else (edges[-1],)
    if r == "line-edge":
        if anchor.side is None:
            raise Indeterminate("'line-edge' needs a declared side")
        span = _member_span(frame, which)
        if span is None:
            raise Indeterminate(
                "the frame does not say where this member sits in its line, "
                "so 'line edge' cannot be checked")
        start, stop, ntok = span
        if anchor.side == "initial" and start != 0:
            raise Indeterminate(
                f"this member starts at token {start} of its line, so it is "
                f"not at the line's initial edge")
        if anchor.side == "final" and stop != ntok:
            raise Indeterminate(
                f"this member ends at token {stop} of {ntok}, so it is not at "
                f"the line's final edge")
        return (0,) if anchor.side == "initial" else (n - 1,)
    if r == "half-line-head":
        span = _member_span(frame, which)
        cae = frame.caesura(which)
        if span is None or cae is None:
            raise Indeterminate(
                "'half-line-head' needs both the line and its caesura. "
                "Doctrine 55: the caesura is printed or searched, never "
                "inferred, so this module will not invent one.")
        start, _stop, _ntok = span
        if start not in (0, cae):
            raise Indeterminate(
                f"this member starts at token {start}; the half-lines start "
                f"at 0 and {cae}, so it is not a half-line head")
        return (0,)
    if r == "half-line-final-accented-vowel":
        span = _member_span(frame, which)
        cae = frame.caesura(which)
        if span is None or cae is None:
            raise Indeterminate(
                "'half-line-final-accented-vowel' needs the line and its "
                "caesura")
        for i in range(n - 1, -1, -1):
            if sylls[i].prominence == 1:
                return (i,)
        raise Indeterminate("no accented vowel in this half-line")
    if r == "rawi":
        if frame.rawi is None:
            raise Indeterminate(
                "'rawi' is the declared rhyme consonant of a qafiya and no "
                "rawi was declared. The module will not guess which consonant "
                "the poet chose.")
        hits = tuple(i for i in range(n)
                     if frame.rawi in tuple(sylls[i].coda)
                     or frame.rawi in tuple(sylls[i].onset))
        if not hits:
            raise Indeterminate(
                f"the declared rawi {frame.rawi!r} does not occur in this "
                f"member")
        return hits if anchor.determinacy == "searched" else (hits[-1],)
    raise Indeterminate(f"anchor rule {r!r} has no resolver")


def _member_span(frame, which):
    """-> (start token, stop token, line token count) or None.

    The frame carries the LINE; this locates the member inside it. It is only
    called from anchors and positions that need the line, and it returns None
    rather than a guess when the line is absent.
    """
    return getattr(frame, "_spans", {}).get(which) if frame else None


def _locate(member, line):
    """-> (start, stop, ntok) of `member`'s tokens inside `line`, or None."""
    mt, lt = str(member).split(), str(line).split()
    if not mt or not lt:
        return None
    for i in range(len(lt) - len(mt) + 1):
        if lt[i:i + len(mt)] == mt:
            return (i, i + len(mt), len(lt))
    return None


def _span_indices(n, origin, span):
    """-> syllable indices ORDERED FROM THE ANCHOR OUTWARD.

    Outward-from-the-anchor is what makes a head-anchored member comparable
    with a tail-anchored one: offset i means 'i steps from this member's own
    origin', so a mixed pair zips coherently instead of needing one global
    alignment that Welsh proves does not exist.
    """
    if span == "whole":
        return list(range(n))
    if span == "to-end":
        return list(range(origin, n))
    if span == "to-start":
        return list(range(origin, -1, -1))
    k = int(span)
    if k > 0:
        return list(range(origin, min(n, origin + k)))
    return list(range(origin, max(-1, origin + k), -1))


def _anchor(sylls):
    """Index of the last STRESSED syllable — the English anchor rule.

    Raises rather than guessing when the phonology carries no prominence:
    `som` refuses a stress grid because Somali has pitch accent, `msa` because
    Malay stress is contested, `fas` because classical Persian metre is
    quantitative. For those, the caller must state a span.

    Kept as the one-line form of `resolve_anchor(LAST_PROMINENT, ...)`, which
    is what everything now goes through.
    """
    return resolve_anchor(LAST_PROMINENT, sylls)[0]


def _score(pairs, select):
    """How good an alignment is, for choosing among SEARCHED origins.

    Counts channels that AGREE **on the declared `select` channels**, and
    subtracts nothing for unknowns, so a searched anchor never prefers a
    position because the phonology refused there.

    `select` is the caller's statement of what the relation is ABOUT. Scoring
    all three channels equally is not neutral: it makes onset+coda tie with
    nucleus+coda, which on real Welsh cynghanedd lusg chose an alliterating
    candidate over the rhyming one on 12 lines of 104.

    Ties are broken by the FIRST candidate in the resolver's declared order,
    fixed and stated, because a tie broken by iteration order is a result that
    does not reproduce (doctrine 66) -- and `RhymeType.ties` reports how many
    origin pairs reached the top score, so an arbitrary choice is visible
    rather than absorbed.
    """
    idx = [CHANNELS.index(c) for c in select]
    return sum(1 for syl in pairs for j in idx if syl[j] is True)


def _position(a, b, frame, spans):
    """Compute POSITION from the frame. Never asserted, never defaulted."""
    sa, sb = spans.get("a"), spans.get("b")
    if sa is None or sb is None:
        raise Unverifiable(
            "position is computed from the frame, and this member could not "
            "be located in its line. Refusing to label a placement that was "
            "not measured.")
    (sta, spa, na), (stb, spb, nb) = sa, sb
    whole_a, whole_b = (sta == 0 and spa == na), (stb == 0 and spb == nb)
    same_line = (str(frame.line_a).split() == str(frame.line_b).split())
    if whole_a and whole_b and not same_line:
        return "holorhyme"
    end_a, end_b = spa == na, spb == nb
    head_a, head_b = sta == 0, stb == 0
    if same_line:
        cae = frame.caesura_a if frame.caesura_a is not None else frame.caesura_b
        if cae is not None and ((spa == cae and end_b) or (spb == cae and end_a)):
            return "leonine"
        return "internal"
    if end_a and end_b:
        return "end"
    if head_a and head_b:
        return "head"
    if end_a or end_b:
        return "cross"
    return "internal"


def classify_pair(a, b, phon, span=None, position=None, boundary="simple",
                  realisation="phonetic", anchor_a=None, anchor_b=None,
                  preset=None, frame=None, select=None, consult=True):
    """Two members and a phonology -> a RhymeType coordinate, or None.

    None means at least one member is outside the phonology's declared
    inventory. A coordinate whose channels contain None means the members were
    READ and a channel could not be DECIDED — a different thing, and
    `RhymeType.unknown_channels` says which.

    Nothing is transcribed here. `phon` is any object with `.syllabify(word)`
    returning syllables carrying onset / nucleus / coda / prominence, which is
    every module in `quality/phonology/`. That is what lets a Welsh, Persian
    and Sanskrit relation land in one space rather than three special cases.

    THE ANCHORS ARE PER MEMBER AND THEY MOVE THE SPAN.

      anchor_a / anchor_b   an `Anchor` each. Different rules on the two sides
                            are the point, not an edge case: see PRESETS
                            ['drottkvaett-hending'] and ['cynghanedd-lusg'].
      preset                a name in PRESETS, which sets both at once.
      span                  the legacy form. An integer here means what it
                            always meant -- the last n syllables of each
                            member -- which is `Anchor('word-final',
                            'declared', -n)`. It is now NAMED rather than
                            assumed, and it is the only path that does not
                            need prominence.

    POSITION IS COMPUTED OR IT IS NOT SET. Pass a `Frame` and it is measured
    from the line; pass `position=` without one and this raises `Unverifiable`
    rather than stamping a label on an unmeasured placement.

    The result carries `.searched` -- how many origins were tried on each side
    -- because taking the best of k is k hypotheses (doctrine 56) and a caller
    comparing a searched rate with an unsearched one needs the k to do it.

    THE PHONOLOGY'S OWN RELATION WINS WHERE IT HAS ONE. `consult=True` (the
    default) asks `phon.rhymes` / `phon.alliterates` whenever the phonology
    declares a relation, implements the predicate, both members are one token,
    and the caller declared no locator of their own. Channel equality is NOT
    the relation everywhere: Middle Chinese 流 and 樓 differ in the nucleus
    (尤 against 侯) and rhyme, because 平水韻 同用 merges the categories in a
    TABLE that no channel comparison can rederive. `.route` says which answer
    each predicate came from and `.disagreements` reports where the two routes
    differ, unresolved -- that disagreement is how the case was found.
    """
    if preset is not None:
        if preset not in PRESETS:
            raise ValueError(f"{preset!r} is not a declared preset; declared "
                             f"presets are {sorted(PRESETS)}")
        if anchor_a is not None or anchor_b is not None:
            raise ValueError("declare a preset OR the two anchors, not both")
        anchor_a, anchor_b, sel = PRESETS[preset]
        select = select if select is not None else sel
    if span is not None and (anchor_a is not None or anchor_b is not None):
        raise ValueError(
            "span= is the legacy locator (the last n syllables, i.e. a "
            "word-final anchor running leftward). Declaring it beside an "
            "explicit anchor is two locators for one member; pick one.")
    if span is not None:
        if span == "anchor":
            anchor_a = anchor_b = LAST_PROMINENT
        else:
            k = int(span)
            if k < 1:
                raise ValueError("a legacy span is a positive syllable count")
            leg = Anchor("word-final", "declared", -k)
            anchor_a = anchor_b = leg
    anchor_a = anchor_a if anchor_a is not None else LAST_PROMINENT
    anchor_b = anchor_b if anchor_b is not None else LAST_PROMINENT
    select = tuple(select) if select is not None else CHANNELS
    bad = [c for c in select if c not in CHANNELS]
    if bad:
        raise ValueError(f"{bad} are not channels; declared channels are "
                         f"{list(CHANNELS)}")

    if position is not None and frame is None:
        raise Unverifiable(
            f"position={position!r} was declared and there is no Frame to "
            f"check it against. This parameter used to be accepted and never "
            f"consulted -- it reached the label and never the span -- so a "
            f"declared placement is now either verified or refused. Pass "
            f"Frame(line_a=..., line_b=...).")

    ra, rb = _read(a, phon), _read(b, phon)
    if ra is None or rb is None:
        return None
    sa, oa = ra
    sb, ob = rb

    spans = {}
    if frame is not None:
        for which, member, line in (("a", a, frame.line_a),
                                    ("b", b, frame.line_b)):
            if line is not None:
                loc = _locate(member, line)
                if loc is None:
                    raise Unverifiable(
                        f"member {member!r} does not occur as a token run in "
                        f"the declared line {line!r}, so nothing about its "
                        f"placement can be measured.")
                spans[which] = loc
        frame = _with_spans(frame, spans)

    cand_a = resolve_anchor(anchor_a, sa, oa, frame, "a")
    cand_b = resolve_anchor(anchor_b, sb, ob, frame, "b")

    # ONE MEMBER, TWO POSITIONS is the normal shape of an internal relation:
    # a dróttkvætt hending relates two syllables of the same line, and
    # cynghanedd lusg two syllables of the same line. When the two members ARE
    # the same text, the two origins must be DIFFERENT positions -- a relation
    # between a position and itself is not a relation, and a searched anchor
    # left free to land on the fixed one will always take it, because it
    # scores perfectly. Measured: without this, the dróttkvætt preset returns
    # the viðrhending answering itself on every line.
    same_member = str(a).strip() == str(b).strip()
    combos = [(ia, ib) for ia in cand_a for ib in cand_b]
    self_pair = False
    if same_member:
        distinct = [(ia, ib) for ia, ib in combos if ia != ib]
        # ...UNLESS distinctness leaves nothing. One member compared with
        # itself at the SAME origin is a legitimate coordinate -- it is
        # `identity='same_word'`, which is REPEAT, radif and the refrain, and
        # doctrine 3 says that is a type and not an error. Deleting it to make
        # room for the internal relation would be the doctrine-24 mistake:
        # a rule that removes a category instead of naming one.
        if distinct:
            combos = distinct
        else:
            self_pair = True

    best, ties = None, 0
    for ia, ib in combos:
        xa = _span_indices(len(sa), ia, anchor_a.span)
        xb = _span_indices(len(sb), ib, anchor_b.span)
        m = min(len(xa), len(xb))
        if m == 0:
            continue
        agr = tuple(
            (_cmp(sa[i].onset, sb[j].onset),
             _cmp(sa[i].nucleus, sb[j].nucleus),
             _cmp(sa[i].coda, sb[j].coda))
            for i, j in zip(xa[:m], xb[:m]))
        sc = _score(agr, select)
        if best is None or sc > best[0]:
            best = (sc, agr, ia, ib, xa[:m], xb[:m])
            ties = 1
        elif sc == best[0]:
            ties += 1
    if best is None:
        raise Indeterminate(
            "no origin pair yields a non-empty span; the anchors resolved and "
            "the spans they declare do not overlap the members")
    _sc, agr, ia, ib, xa, xb = best

    same_text = str(a).strip().lower() == str(b).strip().lower()
    if same_text and ia == ib and anchor_a == anchor_b:
        identity = "same_word"
    elif all(v is True for syl in agr for v in syl):
        identity = "rich"
    else:
        identity = "distinct"

    pa, pb = sa[ia].prominence, sb[ib].prominence
    if pa is None or pb is None:
        stress = "aligned"
    elif pa == 1 and pb == 1:
        stress = "aligned"
    elif pa == 0 and pb == 0:
        stress = "unstressed"
    else:
        stress = "wrenched"

    # LENGTH is about the material each member carries BEYOND the compared
    # span, which is what 'additive' has always meant. Measuring it on whole
    # members was measuring the words, not the relation.
    tail_a, tail_b = len(sa) - len(xa), len(sb) - len(xb)
    if tail_a == tail_b:
        length = "equal"
    elif tail_a > tail_b:
        length = "additive"
    else:
        length = "subtractive"

    if frame is not None and (frame.line_a is not None
                              and frame.line_b is not None):
        got = _position(a, b, frame, spans)
        if position is not None and got != position:
            raise Unverifiable(
                f"position={position!r} was declared and the frame measures "
                f"{got!r}. A declared coordinate that contradicts the "
                f"measurement is refused, not overwritten in either "
                f"direction.")
        position = got
    elif position is not None:
        raise Unverifiable(
            "a Frame was supplied without both lines, so position could not "
            "be computed and the declared one cannot be checked.")

    t = RhymeType(agreement=agr, identity=identity, stress=stress,
                  position=position, boundary=boundary, length=length,
                  realisation=realisation, anchor_a=anchor_a,
                  anchor_b=anchor_b)
    object.__setattr__(t, "origins", (ia, ib))
    object.__setattr__(t, "offsets", (tuple(xa), tuple(xb)))
    object.__setattr__(t, "searched", (len(cand_a), len(cand_b)))
    object.__setattr__(t, "select", select)
    object.__setattr__(t, "ties", ties)
    object.__setattr__(t, "self_pair", self_pair)
    object.__setattr__(t, "member_text", (
        tuple(sa[i].text for i in xa), tuple(sb[j].text for j in xb)))

    # ASK THE PHONOLOGY where it declares a relation of its own. Only when
    # the caller has NOT declared a locator: `phon.rhymes()` answers about the
    # word under that phonology's own anchor rule, so against a second-akṣara
    # or a penultimate anchor it is answering a different question and its
    # answer is not evidence about this one. `consult=False` turns it off and
    # is reachable, so the channel-only path stays demonstrable.
    one_token = len(str(a).split()) == 1 and len(str(b).split()) == 1
    if consult and one_token:
        if anchor_a == LAST_PROMINENT and anchor_b == LAST_PROMINENT \
                and _implements(phon, "rhymes"):
            object.__setattr__(t, "_declared_rhyme", _ask(phon, "rhymes", a, b))
        if anchor_a == WORD_INITIAL and anchor_b == WORD_INITIAL \
                and _implements(phon, "alliterates"):
            object.__setattr__(t, "_declared_allit",
                               _ask(phon, "alliterates", a, b))
    return t


def _with_spans(frame, spans):
    f = Frame(frame.line_a, frame.line_b, frame.caesura_a, frame.caesura_b,
              frame.rawi)
    object.__setattr__(f, "_spans", spans)
    return f


def verdict(a, b, phon, **kw):
    """-> True / False / None. The tri-state a caller usually wants."""
    t = classify_pair(a, b, phon, **kw)
    return None if t is None else t.verdict()


def alliterates(a, b, phon, preset="kalevala-alliteration", **kw):
    """-> True / False / None, on the HEAD anchor by default.

    Alliteration is a head relation, so its default locator is the head. The
    old producer had no way to say that: it compared the two members' tails
    and reported `position='head'` as a label, which is a false negative on
    the relation and a false-positive label in one call.
    """
    t = classify_pair(a, b, phon, preset=preset, **kw)
    return None if t is None else t.alliterates()


# ---------------------------------------------------------------------------
# THE DECLARABLE RELATION VOCABULARY  (the mandate coordinate)
# ---------------------------------------------------------------------------
#
# WHAT THIS EXISTS FOR.  Until 2026-08-22 a `Mandate` could not say WHICH
# relation it wanted.  There was one GLOBAL set -- `lyric_harness`'s
# `RHYME_RELATIONS`, two members, widened to four only by an explicit
# `Declaration.admit` -- and it answered "what counts as satisfying ANY rhyme
# mandate anywhere".  The owner's reading of that, 2026-08-22, is the one this
# block acts on: the palette was not small because the SET was small, it was
# small because a mandate could not name what it wanted.  A world survey of
# 601 named relations, ~117 canonical structures and the 49 named types below
# all sat behind a door that admitted two.
#
# AND WIDENING THE GLOBAL SET WOULD HAVE MADE IT WORSE, not better.  Turning
# ASSONANCE on by default means every rhyme requirement in every song becomes
# satisfiable by assonance -- the sun/much leak restored, LOOSER rather than
# richer.  A per-group declared relation is simultaneously richer and
# STRICTER: a group that declares CONSONANCE is not satisfied by a perfect
# rhyme unless it says so.
#
# TWO GRANULARITIES, ONE QUESTION, ONE TABLE.  A declaration may name either
# a coarse relation CLASS -- what `lyric_harness.score()` already emits per
# pair, free -- or one of the 49 NAMED types, which costs a `classify_pair`
# (~1.3 ms/pair, measured 2026-08-22 over 400 calls).  Both answer "what
# relation must this pair stand in", so they share one field and one
# resolver; which one answered is REPORTED, never guessed.

#: The coarse classes `score()` puts in `s["relation"]`.  Declared here rather
#: than imported so this module stays free of `lyric_harness` (it is imported
#: BY that module), and pinned by `test_rhyme_types.py` against the real set
#: so the two cannot drift into two vocabularies (doctrine 1).
CLASS_RELATIONS = ("RHYME", "RIME_RICHE", "ASSONANCE", "CONSONANCE")


class RelationRefused(ValueError):
    """A declared relation that resolves to nothing.  A refusal, not a
    failure: the mandate named a question this engine cannot ask, and
    grading it as the default would be a silently different question."""


#: THE THREE NAMESPACES.  Ruled by the owner 2026-08-22 on `MISSING.md`
#: M-37: a declaration says WHICH vocabulary it means.
#:
#: WHY.  26 of `relations.REGISTRY`'s 77 schema names are also names in the
#: table below, and where both judges answer they DISAGREE on 6 of 102
#: measured cells in both directions -- `syllabic rhyme` says no to
#: mother/brother as a CELL (the cell excludes a rhyme whose stressed
#: syllable also agrees) and yes as a SCHEMA.  Worse, the class/cell line was
#: carried by CAPITALISATION alone: `ASSONANCE` resolved to the coarse class
#: and `assonance` to the cell, two different relations one shift key apart.
#:
#: THE RULE.  An explicit prefix is always unambiguous.  A BARE name resolves
#: only when it names an entry in exactly ONE namespace; naming entries in
#: two or three REFUSES and prints every prefixed form, because picking one
#: would make a mandate mean whichever resolver ran first (doctrine 1/45).
#: Exact match is tried across all three before any case-insensitive pass, so
#: `ASSONANCE` stays the class and `assonance` -- exact in both `type` and
#: `schema` -- refuses rather than silently keeping its old reading.
NAMESPACES = ("class", "type", "schema")

_SCHEMA_NAMES = None


def schema_relation_names():
    """-> the `relations.REGISTRY` names, as a frozenset, imported LAZILY.

    `relations.py` does not import this module at module level (checked), so
    a lazy import here is safe in the one direction that matters and keeps
    `rhyme_types` loadable without the 4,000-line registry.
    """
    global _SCHEMA_NAMES
    if _SCHEMA_NAMES is None:
        from quality import relations as _R
        _SCHEMA_NAMES = frozenset(_R.REGISTRY)
    return _SCHEMA_NAMES


def namespaced_vocabulary():
    """-> {namespace: frozenset(names)} for all three."""
    named = {n for names in NAMED.values() for n in names}
    return {"class": frozenset(CLASS_RELATIONS),
            "type": frozenset(named),
            "schema": schema_relation_names()}


def relation_ambiguities():
    """-> {name: (namespace, ...)} for every name in more than one.

    MEASURED 2026-08-22: **26 names, every one of them (schema, type)**.
    The coarse classes do NOT appear here, because they are spelled in
    capitals and this compares exactly -- `ASSONANCE` and `assonance` are
    different strings. That is not reassurance, it is the finding: the
    class/cell line is carried by CAPITALISATION, so the pair is one shift
    key from colliding, and `resolve_relation`'s case-insensitive fallback
    is where it would. Which is why that fallback carries the same ambiguity
    refusal as the exact pass rather than a first-match win.
    """
    v = namespaced_vocabulary()
    out = {}
    for ns, names in v.items():
        for n in names:
            out.setdefault(n, []).append(ns)
    return {n: tuple(sorted(k)) for n, k in out.items() if len(k) > 1}


def relation_vocabulary():
    """-> {name: kind}, kind in {"class", "named"}.

    DERIVED FROM `NAMED`, never re-typed.  Every synonym in every cell is a
    legal declaration, because a tradition's own word for a relation is the
    word a writer will reach for -- `qafiya` and `masculine rhyme` name one
    cell and both resolve to it.
    """
    vocab = {n: "class" for n in CLASS_RELATIONS}
    for names in NAMED.values():
        for n in names:
            # A name colliding with a coarse class would make one declaration
            # mean two things; the class wins and the collision is reported by
            # `relation_collisions()` rather than resolved silently.
            vocab.setdefault(n, "named")
    return vocab


def relation_collisions():
    """-> the names that are BOTH a coarse class and a named cell.

    Expected empty.  It is a function rather than an assertion because a
    collision is a fact about two tables that a suite should assert about,
    and an import-time raise would make the whole engine unloadable over a
    vocabulary question."""
    named = {n for names in NAMED.values() for n in names}
    return tuple(sorted(named & set(CLASS_RELATIONS)))


def resolve_relation(name):
    """-> (canonical_name, kind).  Raises `RelationRefused` on anything else.

    There is no fuzzy match and no default.  A mandate that names a relation
    this engine cannot judge must REFUSE, because grading it under the
    default would report a clean draft on the strength of a question nobody
    asked (doctrine 20)."""
    if not isinstance(name, str) or not name.strip():
        raise RelationRefused(
            "a declared relation must be a non-empty name; an empty slot "
            "means DEFAULT and is handled by the caller, not here.")
    key = name.strip()
    v = namespaced_vocabulary()

    # 1. AN EXPLICIT PREFIX IS ALWAYS UNAMBIGUOUS and is tried first.
    if ":" in key:
        ns, _, rest = key.partition(":")
        ns, rest = ns.strip().lower(), rest.strip()
        if ns not in v:
            raise RelationRefused(
                f"{name!r} names namespace {ns!r}; the declared namespaces "
                f"are {list(NAMESPACES)}.")
        if rest in v[ns]:
            return rest, ("named" if ns == "type" else ns)
        low = {x.lower(): x for x in v[ns]}
        if rest.lower() in low:
            hit = low[rest.lower()]
            return hit, ("named" if ns == "type" else ns)
        raise RelationRefused(
            f"{rest!r} is not a name in the {ns!r} namespace.")

    # 2. A BARE NAME: exact across all three, and AMBIGUITY REFUSES.
    hits = [ns for ns in NAMESPACES if key in v[ns]]
    if len(hits) > 1:
        raise RelationRefused(
            f"{name!r} names a relation in {len(hits)} namespaces "
            f"({', '.join(hits)}) and they do not agree -- MEASURED, the "
            f"type and schema judges disagree on 6 of 102 answerable cells "
            f"in both directions (`MISSING.md` M-37). Say which: "
            f"{', '.join(f'{ns}:{key}' for ns in hits)}. REFUSED rather "
            f"than resolved by table order (doctrine 1/45).")
    if len(hits) == 1:
        ns = hits[0]
        return key, ("named" if ns == "type" else ns)

    # 3. Only now case-insensitively, under the same ambiguity rule -- the
    #    vocabularies spell themselves differently (`RHYME` shouts, `perfect
    #    rhyme` does not) and a writer should not have to know which.
    ci = []
    for ns in NAMESPACES:
        low = {x.lower(): x for x in v[ns]}
        if key.lower() in low:
            ci.append((ns, low[key.lower()]))
    if len(ci) > 1:
        raise RelationRefused(
            f"{name!r} matches a relation in {len(ci)} namespaces once case "
            f"is ignored ({', '.join(ns for ns, _ in ci)}). Say which: "
            f"{', '.join(f'{ns}:{hit}' for ns, hit in ci)}.")
    if len(ci) == 1:
        ns, hit = ci[0]
        return hit, ("named" if ns == "type" else ns)

    raise RelationRefused(
        f"{name!r} is not a declarable relation. The vocabulary is the "
        f"{len(CLASS_RELATIONS)} coarse classes {list(CLASS_RELATIONS)} and "
        f"every name of the {len(NAMED)} cells this engine can classify "
        f"({sum(1 for v in relation_vocabulary().values() if v == 'named')} "
        f"distinct names) -- ask "
        f"`quality.rhyme_types.relation_vocabulary()`. REFUSED rather than "
        f"graded as the default: a relation that does not exist, judged as "
        f"the default, is a silently different question (doctrine 20).")


#: POSITION IS THE COORDINATE THAT MAKES `NAMED` REACHABLE, and
#: `classify_pair` cannot know it.  MEASURED 2026-08-22: **31 of the 49
#: `NAMED` keys require a non-None `position`** ('end' 22, 'internal' 4,
#: 'head' 2, 'leonine' 1, 'cross' 1, 'holorhyme' 1); the other 18 are
#: position-free.  `classify_pair` takes two bare words and no line, so it
#: leaves `position=None` and those 31 can never match -- which is why
#: `lyric_harness.py types night -- light` reports `NAMES: UNNAMED at this
#: coordinate` for a masculine rhyme.  See `MISSING.md` M-34: the emptiness is
#: permanent on that path and is explained there as a fact about the
#: vocabulary rather than about a missing coordinate.
#:
#: A MANDATE KNOWS IT.  An end-rhyme group's pairs are line-final by
#: construction, so `grade()` can supply 'end' honestly and reach the 22 + 18
#: = 40 types available there.  It is a REQUIRED argument on the named path
#: rather than a default, because a checker silently picking a coordinate is
#: the bug (doctrine 45) -- and 'end' is exactly the value that would be wrong
#: for the internal, head, leonine, cross and holorhyme relations.
def _realisations_of(canon):
    """-> the realisation axis values at which this name is reachable."""
    return tuple(sorted({k[6] for k, names in NAMED.items()
                         if canon in names}))


def _reachable_phonetically(canon):
    """Can `classify_pair` on a phonemic stream ever produce this name?

    A coarse CLASS always can -- it is read off the score, not the cells.
    A named cell can only if some key carrying it sits at realisation
    'phonetic'.
    """
    if canon in CLASS_RELATIONS:
        return True
    return "phonetic" in _realisations_of(canon)


def satisfies_relation(name, coarse, a=None, b=None, phon=None, preset=None,
                       position=None):
    """Does this pair stand in the declared relation?

    -> True / False / None, and **None is a REFUSAL, not a no** (doctrine 79)
    -- the phonology could not read a member, or the classification is
    indeterminate. A caller that reads None as False charges a writer for a
    word the engine could not pronounce.

    `coarse` is `score()`'s `s["relation"]` for the pair. A CLASS relation is
    answered from it alone and costs nothing. A NAMED relation costs one
    `classify_pair`, which is why the members and the phonology are only
    required on that path -- a mandate that declares no named relation never
    pays for one.
    """
    canon, kind = resolve_relation(name)
    if kind == "schema":
        # A MANDATE MAY NAME A SCHEMA; NOTHING HERE CAN JUDGE ONE YET.
        # `relations.REGISTRY`'s schemas are span/placement/figure objects
        # evaluated by `realise()` over a whole STREAM, not per-pair
        # predicates, so routing them is step 3 proper and is gated on the
        # null sweep: a schema that does not beat its own null must not
        # become enforceable (the whole point of step 0). Refusing here
        # keeps `schema:` a declarable coordinate that cannot silently
        # grade as something else in the meantime.
        raise RelationRefused(
            f"{canon!r} resolves in the `schema` namespace, and this judge "
            f"reads per-pair coordinates from `classify_pair`. A "
            f"`RelationSchema` is evaluated by `relations.realise()` over a "
            f"whole stream; routing that into a mandate is step 3 and is "
            f"gated on the null sweep. Declare `type:{canon}` if you mean "
            f"the named cell." if canon in namespaced_vocabulary()["type"]
            else f"{canon!r} resolves in the `schema` namespace, which no "
                 f"per-pair judge can evaluate yet (step 3, gated on the "
                 f"null sweep).")
    if kind == "class":
        return coarse == canon
    if phon is None:
        raise RelationRefused(
            f"{canon!r} is a NAMED type and needs a phonology to classify "
            f"the pair; only the coarse classes {list(CLASS_RELATIONS)} can "
            f"be judged from the score alone.")
    # A NAME ONLY REACHABLE AT A NON-PHONETIC REALISATION CANNOT BE JUDGED
    # HERE, AND ANSWERING `False` FOR IT WAS A DEFECT IN THIS FUNCTION.
    # MEASURED 2026-08-22, after `relations.py`'s schema of the same name
    # REFUSED on all 12 test pairs while this returned a flat False on all
    # 12: the `realisation` axis is ('phonetic', 'eye', 'historical') and
    # `classify_pair` reads a PHONEMIC stream, so it can only ever produce
    # 'phonetic'. The two `eye`/`historical` cells are therefore unreachable
    # by construction and a `False` about them says "I never looked" in the
    # words of "I looked and it is not so" -- doctrine 20, in code shipped
    # this same day. The remedy is a REFUSAL naming the surface.
    if not _reachable_phonetically(canon):
        raise RelationRefused(
            f"{canon!r} is only reachable at a NON-PHONETIC realisation "
            f"({', '.join(_realisations_of(canon))}), and `classify_pair` "
            f"reads a phonemic stream. Judging it needs that surface "
            f"declared -- `relations.declare_orthography` for the eye, a "
            f"sourced earlier-period phonology for the historical. REFUSED "
            f"rather than answered False: this function cannot see the "
            f"channel the relation is defined on (doctrine 20/79).")
    if position is None:
        raise RelationRefused(
            f"{canon!r} is a NAMED type and the caller must declare the "
            f"POSITION the pair stands in -- one of {list(POSITION)}. "
            f"`classify_pair` takes two bare words and cannot know it, and "
            f"31 of the {len(NAMED)} named types require it, so leaving it "
            f"unset would silently answer 'no name here' for two thirds of "
            f"the vocabulary (doctrine 45: a checker picking a coordinate "
            f"for you is the bug).")
    if position not in POSITION:
        raise RelationRefused(
            f"position {position!r} is not in the declared vocabulary "
            f"{list(POSITION)}.")
    # ------------------------------------------------------------------
    # M-44: JUDGE THE CANON AT THE COORDINATE IT IS REGISTERED AT.
    #
    # This block replaced a two-line one that classified the pair at ONE
    # coordinate -- the caller's -- and stamped the caller's `position` onto
    # the result:
    #
    #     t = _dc.replace(t, position=position)   # asserted, never verified
    #     return canon in t.names()
    #
    # `classify_pair` refuses that move in its own body: declare a position to
    # it with no `Frame` and it raises `Unverifiable`, whose message says the
    # parameter "used to be accepted and never consulted -- it reached the
    # label and never the span".  This function reintroduced exactly that one
    # layer up, and the cost was measured rather than argued.
    #
    # A NAME LIVES AT A COORDINATE AND THE CALLER CANNOT KNOW IT.  `NAMED` is
    # keyed on the whole type signature -- cells, identity, alignment,
    # position, boundary, length, realisation and the two anchors -- so
    # `perfect rhyme (last stressed syllable)` is registered with an anchor
    # span of 1 and NO position, while `masculine rhyme` is registered
    # `to-end` AT position 'end'.  One classification cannot satisfy both, and
    # a caller made to pick one coordinate for all 80 names picks wrong for
    # nearly all of them.  MEASURED on `night`/`light` at position 'end', the
    # paradigm English perfect rhyme: the old path answered 4 names of 80 and
    # said NOT SATISFIED to `perfect rhyme (last stressed syllable)` -- a
    # violation, not a refusal, about the very relation the pair is.  This
    # path answers 11, refuses 3, and says yes to that one.
    #
    # A REGISTERED `position=None` MEANS THE NAME DOES NOT CONSTRAIN POSITION,
    # not that it demands the absence of one.  18 of the 49 entries are
    # registered that way and they are the position-agnostic names -- a
    # perfect rhyme is a perfect rhyme wherever it sits.  A registered
    # position that DIFFERS from the caller's is a real no: `internal rhyme`
    # at an end position is not satisfied, and that is a finding rather than a
    # refusal.
    #
    # `Indeterminate` per key is a SKIP and not an error: a fixed-index anchor
    # with no referent in a one-syllable member ("the index is the rule, so an
    # out-of-range index is a refusal and not a clamp") means this name cannot
    # apply to this pair, which is what a False says.
    # CAN THIS PAIR BE READ AT ALL?  Asked ONCE, before any key, and it is
    # the difference between a refusal and a no.  `classify_pair` returns None
    # when a member is unreadable -- outside the declared inventory, no
    # transcription -- and the answer then is UNDECIDED, never False: reading
    # it as False charges the writer for a word the engine cannot pronounce
    # (doctrine 79).  The per-key loop below `continue`s past a None, so
    # without this the fall-through would answer False for an unreadable
    # member.  `quality/test_mandate_relation.py` caught exactly that when
    # this block was first written, which is the check doing its job.
    try:
        readable = classify_pair(a, b, phon,
                                 **({"preset": preset} if preset else {}))
    except Indeterminate:
        return None
    if readable is None:
        return None

    import dataclasses as _dc
    for key, val in NAMED.items():
        names_here = val if isinstance(val, (list, tuple, set, frozenset)) \
            else (val,)
        if canon not in names_here:
            continue
        if key[6] != "phonetic":
            # The same guard as `_reachable_phonetically` above, applied per
            # KEY: a canon may be registered at several coordinates and only
            # the phonetic ones are readable off a phonemic stream.
            continue
        reg_position = key[3]
        if reg_position is not None and reg_position != position:
            continue
        try:
            t = classify_pair(a, b, phon, boundary=key[4],
                              realisation=key[6], anchor_a=key[7],
                              anchor_b=key[8],
                              **({"preset": preset} if preset else {}))
        except Indeterminate:
            continue
        if t is None:
            continue
        if canon in _dc.replace(t, position=reg_position).names():
            return True
    return False


__all__ = ["CHANNELS", "SPAN", "IDENTITY", "STRESS", "POSITION", "BOUNDARY",
           "LENGTH", "REALISATION", "CELL_NAMES", "RhymeType",
           "agreement_cells", "classify_pair", "verdict", "Indeterminate",
           "span_name", "space_size", "enumerate_types", "NAMED",
           "named_count", "classify", "Anchor", "ANCHOR_RULES", "DETERMINACY",
           "SPAN_RULES", "PROMINENCE_RULES", "FRAME_RULES", "ANCHOR_VALUES",
           "PRESETS", "Frame", "Unverifiable", "resolve_anchor", "alliterates",
           "UNLOCATED", "LAST_PROMINENT", "WORD_INITIAL", "FINAL_UNPROMINENT",
           "PENULTIMATE_PROMINENT", "SECOND_AKSARA", "LINE_PENULT",
           "PROMINENT_ONSET_SEARCH", "PROMINENT_SEARCH", "WELSH_PENULT",
           "PERFECT_ANCHOR", "SYLLABIC_ANCHOR", "APOCOPATED_ANCHOR",
           "FREE", "AXIS_INDEX", "CLASS_RELATIONS",
           "RelationRefused", "relation_vocabulary",
           "relation_collisions", "resolve_relation",
           "satisfies_relation"]

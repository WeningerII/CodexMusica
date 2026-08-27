#!/usr/bin/env python3
"""SPAN-PAIR RELATIONS over one flat phonological stream for a whole song.

WHAT THIS REPLACES

`rhyme_types.classify_pair(a, b, phon)` takes TWO WORDS and compares their
TAILS.  It is suffix-aligned, so head-anchored relations are structurally
unreachable, and it takes `position="end"` as a PARAMETER that nothing checks.
Measured: `classify_pair('kukka','kalevala', fin)` compares sa[-2:]=[kuk,ka]
against sb[-2:]=[va,la], reports "perfect rhyme" on syllable 2, verdict False,
while `fin.alliterates()` returns True.  Passing position='head' does not help:
`position` never touches the span computation.

THE MOVE

1. Syllabify the WHOLE SONG once into a flat list of `Unit`s.  Each Unit is a
   `Syllable` from the injected phonology PLUS its coordinates in the text:
   line, token, syllable-within-token, section, and the derived edge facts
   (word-initial, word-final, line-initial, line-final).
2. A relation MEMBER is a `Span`: a tuple of unit indices in that member's own
   reading direction.  A SELECTION, not a slice -- so it can be non-contiguous
   (paroemion's word-initial syllables), can begin mid-word (a rap multi), can
   cross token boundaries (mosaic), can run leftward (amphisbaenic), and two
   spans may OVERLAP (cynghanedd groes o gyswllt).
3. A relation is a PAIR OF SPANS plus an ALIGNMENT (a partial injective map
   between their positions) plus a CHANNEL MAP (per-channel ternary predicates,
   each reading a declared SURFACE) plus PLACEMENT CONSTRAINTS.
4. Placement is a PREDICATE ON WHERE THE SPANS SIT, computed from the Units'
   coordinates.  `both_line_final` is a test, never an argument.  That is the
   whole of "positions must be found, not asserted".

TERNARY THROUGHOUT.  `fas.syllabify('گل')` returns nucleus=None because
unvocalised Perso-Arabic does not write short vowels; every predicate, every
alignment-derived read and every verdict propagates that None.  A None channel
must also not be PRUNED: the candidate index puts unknown keys in a wildcard
bucket joined against every bucket, because an index built on nuclei would
silently delete exactly the 60.2% of Hafez pairs the module refuses on.

REFUSAL IS NOT FALSE.  A schema declares `requires`; if the stream cannot
supply a capability -- prominence (som/msa/fas carry none), a caesura, a
metrical lift template, an orthographic surface, a lexicon, a beat grid --
`realise()` returns a `Refusal` naming the missing capability.  The anchor rule
'last stressed syllable' is a COORDINATE, not a universal.

AND SUPPLY IS THREE-VALUED, SINCE 2026-08-22, BECAUSE A DECLARED SOURCE IS NOT
A POPULATION.  `Stream.provides` returned a bool and the caesura branch read
`caesura_source != 'none'`, so calling `mark_printed_caesura` on an English
text -- which finds ZERO printed marks, M-28 -- opened the gate on a frame
with nothing in it, and six schemas (cynghanedd groes / draws / groes o
gyswllt, leonine rhyme, epistrophe / radif, qafiya (before the radif)) went
from an honest REFUSAL to a silent RAN AND FOUND NOTHING.  Every span rule
that reads those frames enumerates zero loci, so the zero was inconclusive BY
CONSTRUCTION -- doctrine 20's own sentence, in the enforcement path this file
is.  `Stream.supply(cap)` now returns a `Supply` carrying `state` (absent /
empty / present) and the population `n`, `provides` is `state == 'present'`,
and a schema blocked only by empty declared frames refuses with
`Refusal.kind == 'vacuous_frame'` and the frame named on `.vacuous`.  THE
MARKERS STILL DECLARE THEIR SOURCE ON A NULL RUN, deliberately: deleting it
would make "the instrument ran and found none" indistinguishable from "nobody
looked", which is the same collapse one layer up.  They report `found` instead.
So three states are readable where there were two: NEVER LOOKED (`absent`, a
`'capability'` refusal), LOOKED AND THE FRAME IS EMPTY (`empty`, a
`'vacuous_frame'` refusal), LOOKED AND THE FRAME IS POPULATED (`present`, the
schema runs and any zero it reports is a null a control can be built against).

`declare_orthography(stream, rime)` is the first ALT_SURFACE a caller can
actually build, and it takes the rime rule as an ARGUMENT because y-as-vowel
and silent-final-e are English and this module serves nine languages
(doctrine 45/65).  `eye rhyme` runs on it.  The FREQUENCY ROUTE to `trite
rhyme` stays refused and its measurement against all three shipped tables is
now in RETIRED_UNPROVIDABLE -- retired 2026-08-23 not because the argument
weakened but because the schema stopped asking: `trite rhyme` gated on a bare
`requires=("frequency",)` it read on no channel, and now carries
`ClassEqual(resource="trite")` over the repo's own declared CLICHE_PAIRS.
That is a narrower question -- "are these two a DECLARED trite pair", no rank
and no threshold -- answered by a declaration instead of by a table nobody
can source.

PHONOLOGY STAYS INJECTABLE.  Nothing here transcribes and nothing here consults
CMUdict.  `phon` is any object with `.syllabify(word)`.  The channel INVENTORY
is itself a declaration coordinate: Welsh does not declare onset and coda as
separate channels at all, it declares a consonant sequence, so `ChannelSet`
is per-declaration and the schemas name channels the declaration must provide.

A SCHEMA SAYS WHICH TRADITION IT BELONGS TO -- section 11, and it did not
until 2026-08-11.  `RelationSchema.traditions` was declared on all 77 schemas
and populated on ZERO (M-15), so `Middle Chinese end rhyme (同用 group)` fired
on four lines of English and nothing in the output could say that the RULE
SHAPE had matched and the tradition had not.  Every tradition is now read out
of `quality/RHYME_CANON.md` and cites the canon entry that names it; a schema
whose tradition could not be SOURCED is left empty and says why in `UNSOURCED`.
`tradition_scope()` is four-valued, because "the source cannot say" is a
different answer from "the source says no".  `relation_report()` and this
module's `__main__` print the scope on every row.

A COUNT FROM HERE IS NOT EVIDENCE.  `quality/relations_null.py` is the matched
control (doctrines 56/61/63/68/75/90), and `search_burden()` finally consumes
the `Span.search_k` this module carried from its first commit and never read.
The first thing the null found is about this file: `line_permutation` -- the
null this repo uses for Whitman, the Kalevala and Bilhaṇa -- is the IDENTITY
MAP for `internal rhyme` and `perfect rhyme`, because neither declares a
bounded line-distance placement.

CLOSED HERE, and each is asserted in `test_relations.py` so the close is
readable: P10, the chorus stub, as a DECLARED `Stream.line_status` with no
detector shipped in this file; P11's comparison half, as knowledge sets on the
channel reads.

THE OTHER THREE CLOSED ON 2026-08-11, one per outcome, because an inert
declared coordinate has exactly three honest ends and picking the right one
per field is the work:
  DELETED   `SpanRule.terminator`.  A strict function of `magnitude` over all
            154 member rules, and `_spans_at` has no edge left for it to
            choose between.  Two coordinates meaning one thing is a worse
            defect than one inert coordinate, and the honest close of a
            duplicate is a deletion, not a wiring.
  WIRED     the text-order convention.  It was never a naming decision: on the
            17 ASYMMETRIC schemas the `a.head() > b.head()` skip DELETED
            instances rather than de-duplicating them, 102 of them on the
            shipped example lyric, 8 with a TRUE verdict, and `mosaic rhyme`
            reported 4 of its 12 true instances.  `mirrored()` replaces it and
            `order_burden()` counts what it costs.  All 60 symmetric schemas
            are byte-identical before and after.

P14 AND P15 CLOSED 2026-08-13, and both are one sentence: A DECLARED
COORDINATE'S VALUE SET IS ITSELF A CLAIM.  `ClassEqual(partition=lambda v: v)`
declares a quotient and supplies the identity, which is not one -- it made
`proest` UNSATISFIABLE (nucleus MUST DIFFER *and* nucleus CLASS-EQUAL are each
other's negation under the identity), made `family rhyme` fire on `cat`~`bat`,
and made the 同用 schema read 流/樓 as False while the phonology that owns the
rime table reads True.  A quotient is now a NAMED capability the declaration
supplies (`quotient:manner`, `quotient:同用`), so a schema whose grain nobody
declared REFUSES with the name of what is missing.  `unmatched` is the same
shape one level down: its vocabulary comment listed a value nothing implements
('differ') and omitted the two `evaluate()` branches on, and an undeclared
value took the default path in silence.  See `ClassEqual` and `UNMATCHED`.

  DECLARED  `Span.unit`, in the `INERT` table above section 11, WITH the
            reason, what would activate it, and which of doctrine 44/92's
            three blockers it is -- 'disjoint', not 'build', so "build the
            granularity ladder" is the wrong instruction.  `check_inert()`
            MEASURES the claim so the declaration is a test and not a
            paragraph (doctrine 48), and it fails in both directions.
"""

import itertools
import re
from dataclasses import dataclass, field, replace

# ---------------------------------------------------------------------------
# 0. TERNARY
# ---------------------------------------------------------------------------


def tri_and(vals):
    """False dominates; then None; else True.  Unknown propagates, and a known
    False beats an unknown -- a pair that fails a channel it CAN read fails,
    whatever it cannot read."""
    vals = list(vals)
    if any(v is False for v in vals):
        return False
    if any(v is None for v in vals):
        return None
    return True


def tri_or(vals):
    vals = list(vals)
    if any(v is True for v in vals):
        return True
    if any(v is None for v in vals):
        return None
    return False


class NoReferent(Exception):
    """The rule has no referent in this declaration.  Raised, caught by the
    producer, and reported as a Refusal -- never coerced to False."""


@dataclass(frozen=True)
class Refusal:
    """WHY the instrument declined, naming what it would have needed.

    `capability` is ONE name and `missing` is ALL of them, and the two are
    separate fields because they answer different questions.  `realise()`
    checked capabilities in `RelationSchema.capabilities()` order -- which is
    `sorted()`, so ALPHABETICAL -- and returned on the first failure, so a
    schema wanting two capabilities reported one and the census column built
    from it was FIRST-HIT rather than complete.  Measured on a `som` stream,
    which supplies no prominence:

        family rhyme   needs ('prominence', 'quotient:manner')  -> said 'prominence'
        proest         needs ('prominence', 'quotient:vowel_class')
                                                                -> said 'prominence'
        dialect rhyme  needs ('poet', 'prominence')             -> said 'poet'

    -- and in the first two cases the quotient is the capability that does not
    exist on ANY declaration of that language, while `prominence` is one a
    different phonology supplies.  Reporting the alphabetically-first of the
    two names the CHEAPER blocker and hides the structural one, which inverts
    the remedy: "declare a prominence-bearing phonology" reads as the whole
    answer when it closes half the gap.  Doctrine 44 is exactly this
    distinction -- "hard to build" against "cannot obtain" -- so a diagnostic
    that truncates the list decides which of the two a reader sees.

    `capability` KEEPS its old value (`missing[0]`) rather than becoming a
    joined string: it is the GROUPING KEY that `relations_null.Coverage`,
    `NEVER_PROVIDED` and this module's own `refusal_census()` bucket on, and a
    key that silently changed shape would make every stored census
    incomparable with the next one.  New readers should prefer `missing`.
    """
    schema: str
    capability: str
    detail: str
    #: EVERY capability the stream did not supply, in `capabilities()` order.
    #: Defaults to `()` so the three-argument construction sites outside this
    #: file (`quality/relations_null.py` builds a `'denominator'` refusal that
    #: way) keep working unchanged; `realise()` always fills it.
    missing: tuple = ()
    #: WHICH GATE refused, one of `REFUSAL_KINDS`, or `""` where the refusal
    #: was not raised by `realise()` at all.  The empty default is deliberate
    #: and is the same argument `complete` makes one field up: a Refusal built
    #: by another module (`relations_null`'s `'denominator'`) has not been
    #: classified by this one, and labelling it `'capability'` would be a
    #: claim about a gate it never passed through.
    kind: str = ""
    #: The subset of `missing` that is DECLARED-BUT-EMPTY -- a frame whose
    #: source a caller declared and whose population is zero.  Empty on every
    #: other kind of refusal.  See `Supply` for why this is not the same
    #: answer as "not supplied".
    vacuous: tuple = ()

    def __bool__(self):
        raise TypeError(
            "a Refusal has no truth value; it is not False. Read .capability "
            "for the first missing capability, or .missing for all of them.")

    @property
    def complete(self):
        """True when `missing` carries the whole set rather than one name.

        A refusal raised somewhere other than the capability gate -- the span
        refusal below, `relations_null`'s `'denominator'` -- leaves `missing`
        empty, and a consumer counting capabilities must be able to tell that
        apart from "nothing was missing", which is not a state a Refusal can
        be in.  Doctrine 28, at the scale of one dataclass.
        """
        return bool(self.missing)


#: The gates `realise()` can refuse at.  `Refusal.kind` is one of these or the
#: empty string; see the field's own comment for why "" is not `'capability'`.
REFUSAL_KINDS = ("capability", "vacuous_frame", "span")

#: `Supply.state`'s value set, ordered from least to most supplied.
#:
#: THREE, NOT TWO, AND THAT IS THE WHOLE OF DOCTRINE 20 HERE.  `provides()`
#: answered a BOOLEAN, so a frame whose SOURCE a caller declared passed the
#: gate whether or not the source had found anything -- and a schema built
#: entirely on that frame then ran over zero loci and returned `[]`.  Doctrine
#: 20's sentence is that an instrument which has not fired is not an
#: instrument that fired and found nothing; a declared-but-empty frame is the
#: third thing, and it had no name.
#:
#:   absent   nothing was declared.  The instrument never looked, and no
#:            count from it exists to be quoted.
#:   empty    a source WAS declared and its population is zero.  The
#:            instrument looked and marked nothing, so every schema resting on
#:            it is inconclusive BY CONSTRUCTION (doctrine 20's own words) and
#:            refuses -- `Refusal.kind == 'vacuous_frame'`.
#:   present  a source was declared and the population is non-zero.  The
#:            schema RUNS, and a zero it then reports is a null a control can
#:            be built against.
SUPPLY_STATES = ("absent", "empty", "present")


@dataclass(frozen=True)
class Supply:
    """What a stream can answer about ONE capability, with the POPULATION.

    `Stream.provides(cap)` is `supply(cap).state == 'present'` and keeps its
    boolean contract for every caller that has one.  This is the reading
    underneath it, and the reason it exists is that the boolean cannot tell
    the second state from the first:

        mark_printed_caesura(stream)      # English: 0 lines print `/` or `|`
        stream.frames.caesura_source      # 'printed'
        stream.provides('caesura')        # True, before this type existed
        realise(cynghanedd_groes, stream) # []  -- a SILENT ZERO

    -- because `_loci` yields nothing at `half_line_a` when `frames.caesura`
    is empty, `enumerate_spans` raises nothing (it raises only where an anchor
    had loci to fail at), and `realise` returns an ordinary empty list that a
    census counts under RAN AND FOUND NOTHING.  Measured 2026-08-22 on
    `corpus/song/eng_american_dan_e_townsend.txt`: calling both shipped
    frame-suppliers moved SIX schemas -- cynghanedd groes / draws / groes o
    gyswllt, leonine rhyme, epistrophe / radif, qafiya (before the radif) --
    from an honest REFUSAL to a measured zero, and the split went 30/26/21 to
    30/20/27 with nothing in the output able to say the frames were empty.

    `n` is the population and it is the field that makes the distinction
    MEASURED rather than declared: `empty` is `n == 0` under a declared
    source, never a flag somebody set.  `source` is the frame's own provenance
    string (`printed` / `computed` / `searched` / `declared`), because
    doctrine 55/56 already say a caesura is a coordinate of HOW it was found
    and a reader of an empty frame needs to know which instrument came back
    empty.
    """
    capability: str
    state: str
    n: int = 0
    source: str = ""
    detail: str = ""

    def __bool__(self):
        # The same argument as `Refusal.__bool__`, for the same reason.  Under
        # default truthiness `if stream.supply('caesura'):` is True in all
        # three states, which is precisely the collapse this type exists to
        # end -- and it would read as a fix while restoring the defect.
        raise TypeError(
            "a Supply has no truth value; it is THREE-valued. Read .state "
            f"(one of {SUPPLY_STATES}) or call Stream.provides(cap), which "
            "is .state == 'present'.")

    @property
    def declared(self):
        """True where a caller declared a source, EMPTY OR NOT.

        `declared and not provided` is the vacuous state, and it is the
        question a consumer asks when it wants to know whether the instrument
        fired at all.
        """
        return self.state in ("empty", "present")


# ---------------------------------------------------------------------------
# 1. THE STREAM
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Unit:
    """One syllable of the song, with its coordinates.

    `syl` is the phonology's own Syllable, untouched.  Everything else is a
    coordinate this module computed from the text layout, and it is what makes
    every positional axis a TEST instead of an argument.
    """
    i: int                  # global index in the song's stream
    syl: object             # quality.phonology.Syllable
    line: int               # 0-based, across the WHOLE song
    token: int              # 0-based within its line
    tok_syl: int            # 0-based within its token
    tok_len: int
    token_text: str
    line_tokens: int
    section: str = ""
    stanza: int = 0
    split_left: bool = False   # token continues from the previous line
    split_right: bool = False  # token is cut by the line edge (broken rhyme)
    # -- the line's first and last READABLE token indices.  `line_tokens` stays
    #    the RAW word count, because a placement rule that asks how many words a
    #    line has must get the honest answer; but the EDGE tests below must be
    #    computed from the material that actually reached the stream, or an
    #    out-of-dictionary final token silently deletes the line's end rhyme.
    #    -1 means the builder did not supply them (old callers): fall back.
    line_first: int = -1
    line_last: int = -1

    @property
    def word_initial(self):
        return self.tok_syl == 0

    @property
    def word_final(self):
        return self.tok_syl == self.tok_len - 1

    @property
    def line_initial(self):
        first = self.line_first if self.line_first >= 0 else 0
        return self.token == first and self.word_initial

    @property
    def line_final(self):
        """DEFECT P0, fixed.  This read `token == line_tokens - 1`, the RAW
        token count, while `_loci('line_final_token')` picks the last SURVIVING
        token.  When a line's final token was out of the declared inventory the
        two disagreed, `Placement('both_line_final')` returned False, and the
        line's end rhyme was deleted with no record:

            build_stream(['i saw the cat zzzqx', 'i wore the hat zzzqx'])
            -> realise(perfect rhyme) == []      (the control gives 1)

        Measured on 40 files of corpus/song/: 556 of 9,174 lines, 6.1%.
        """
        last = self.line_last if self.line_last >= 0 else self.line_tokens - 1
        return self.token == last and self.word_final

    @property
    def tok_syl_from_end(self):
        return self.tok_len - 1 - self.tok_syl


@dataclass
class Frames:
    """Declared structure over the stream.  Every field says where it came
    from, because doctrine 55 records a printed COMMA silently choosing which
    rule 1,558 lines were tested against, and doctrine 56 records that a
    SEARCHED caesura needs a null under the same search.
    """
    caesura: dict = field(default_factory=dict)      # line -> unit index of B's start
    caesura_source: str = "none"                     # printed|declared|searched|none
    lifts: dict = field(default_factory=dict)        # line -> tuple of unit indices
    lift_source: str = "none"                        # declared|scanned|none
    refrain_tail: dict = field(default_factory=dict)  # line -> unit index where the
    #                                                   line's shared trailing run
    #                                                   begins (radif / epistrophe)
    refrain_source: str = "none"                     # computed|declared|none
    #: THE BEAT GRID. ~~"doctrine 4: stays None"~~ — REPHRASED 2026-08-22, and
    #: the doctrine is unchanged. `offbeat internal rhyme`'s own note says the
    #: rule in full: "no beat grid without audio OR A DECLARED TEMPO". What
    #: doctrine 4 refuses is INFERENCE — deriving a beat from syllable counts,
    #: from a meter, from anything the page carries — and it has never refused
    #: a DECLARATION. A writer knows where the beats fall; a blueprint already
    #: places every line in a bar and on a beat (`quality/fit.py`). So the
    #: field stays None by default, exactly as before, and
    #: `declare_beat(stream, ...)` is the one way to fill it.
    #: `{line: (unit index, ...)}` — the units that fall ON the beat.
    beat: object = None
    beat_source: str = "none"                        # declared|none
    hemistich: dict = field(default_factory=dict)    # line -> (bayt, half)
    bayt_source: str = "none"
    #: WHERE `Unit.stanza` CAME FROM (M-39).  `blank_lines` and `collapsed`
    #: and `none` are `build_stream`'s own three; a caller declaring a list
    #: gets `declared` or whatever name it passes as `stanza_source=`, which
    #: today is `printed_breaks` or `printed_verse_number` from
    #: `relations_null`'s grounded readers.  The set is OPEN on purpose: this
    #: module serves nine languages and does not own the list of ways a
    #: printer can mark a stanza, so it records the name rather than
    #: validating it against a table it has no standing to write (doctrine
    #: 45/65).  What it does own is the difference between a name and NONE.
    #:
    #: This field exists because the stanza coordinate was the one frame with
    #: no provenance, and the omission had the exact shape doctrine 20 is
    #: about.  `stanzas_from_blank_lines` on a text printing NO blank line
    #: returns all-zeros, and its own docstring called that "a TRUE statement
    #: about the text" -- which it is about the LIST, and is not about the
    #: text.  A `forall stanza` figure then quantified over one frame and
    #: returned a number, and nothing downstream could tell "this poem is one
    #: stanza" from "nobody ever told this stream where the stanzas are".
    #:
    #: Measured on the `relations_null` panel, 2026-08-22: all NINE slices
    #: reported exactly ONE distinct `Unit.stanza`, because both panel readers
    #: drop blank lines before tokenising.  The five `frame="stanza"` schemas
    #: were quantified over a frame that could not vary, on every cell of the
    #: run.  (`frame="line_pair"` is `line // 2` and varied 20 ways on all
    #: nine, so `symploce` is NOT in that set -- the finding as first written
    #: said six schemas and the number is five.)
    stanza_source: str = "none"
    #: THE STUB RESOLUTION (2026-08-22): {stub line index -> (start, end)},
    #: 0-based and end-exclusive, DECLARED by the caller. `&c.` stands for a
    #: whole chorus and nothing in the text says how many lines that is, so
    #: this is an EDITION's fact and never a detector's — `relations_null`
    #: measured the naive resolver at 18.7% unique / 26.6% no match / 54.7%
    #: ambiguous over 843 stub lines, which is wrong more often than right.
    stub_resolution: dict = field(default_factory=dict)
    stub_source: str = "none"


#: Capability prefix for a DECLARED QUOTIENT (defect P14).  `capabilities()`
#: derives `quotient:manner`, `quotient:同用` and the like from the channel
#: rules themselves, so a schema that compares a channel at a declared GRAIN
#: refuses on a declaration that supplies no such grain, the same way one
#: needing a caesura or a morphology resource already does.
QUOTIENT_CAP = "quotient:"

#: The SECOND-DECLARATION surfaces.  Each names a key in `Stream.alt`, and a
#: `ChannelRule(surface=...)` reading one is answered by projecting the unit
#: into that second stream (`ChannelSet.read` -> `_project`).  `Stream.provides`
#: gates them all the same way -- the surface is supplied iff a caller declared
#: a stream under that name -- so this tuple, and not any per-surface code, is
#: the whole of what makes a surface reachable.
#:
#: `poet` ADDED 2026-08-13, and it is a correction rather than a feature.  It
#: was the only surface any schema names that this tuple omitted, so
#: `provides('poet')` fell through to the closing `return False` and `dialect
#: rhyme` refused on EVERY text under EVERY declaration -- not "no caller has
#: declared one yet" but "no caller can".  Two things make that an error and
#: not a policy:
#:
#:   * `quality/declared_inputs.py` already classifies it the other way. Its
#:     own header table reads `R2 historical  SWAPPABLE_PHONOLOGY  SCHEDULED`
#:     and its §5 map sends "a PHONOLOGY at another coordinate" to R2 with the
#:     words "(historical, dialect, Scots)".  So the repo declares dialect to
#:     be the same family as `earlier`, which IS in this tuple, and two modules
#:     disagreed about whether the same family was reachable.
#:   * `dialect rhyme` and `historical rhyme` are the same schema up to the
#:     surface name -- END_ANCHOR spans, nucleus+coda AGREE on the second
#:     surface, nucleus DIFFER on the anchor in the declared one.  Nothing
#:     distinguishes them that could justify wiring one and not the other.
#:
#: THIS DOES NOT MAKE THE SCHEMA FIRE.  A surface is supplied only by a caller
#: handing over a second `Stream` built from a phonology at that coordinate;
#: with no `alt` declared, `provides('poet')` is False and every count in this
#: repo is byte-identical (asserted in `test_relations.py`).  What changes is
#: the CLASSIFICATION of the gap: `dialect rhyme` moves from "cannot be nulled
#: on any text under any declaration" to exactly where `historical rhyme`
#: already sits -- blocked on a SOURCED dialect phonology, which this repo does
#: not have and which `declared_inputs.PeriodPhonology` refuses to construct
#: without a named reconstruction.  Doctrine 44: the build was one name in a
#: tuple; the blocker is, and always was, the data.
ALT_SURFACES = ("orthography", "earlier", "delivered", "sung", "licence",
                "poet")


@dataclass
class Stream:
    units: list
    lines: list                     # list of tuples of unit indices
    tokens: dict                    # (line, token) -> tuple of unit indices
    phon: object
    declaration: dict
    frames: Frames = field(default_factory=Frames)
    alt: dict = field(default_factory=dict)   # surface name -> Stream (2nd declaration)
    text_lines: tuple = ()
    #: (line, token, text) for every token the declaration could not read.  A
    #: token that contributes no units is not a token that did not exist, and
    #: the difference is a rate every English measurement in this repo depends
    #: on.  Before this field the loss was silent.
    unreadable: list = field(default_factory=list)
    #: DEFECT P10, closed as a DECLARED COORDINATE.  One label per line, ""
    #: where the caller declared none.  A chorus stub -- `Oh, my poor Nelly
    #: Gray, &c.` -- is not a line of verse, it is a POINTER to one, and
    #: `tokenise()` reads its last token as the word `c`.  That is a LINE
    #: STATUS and the stream had no field for it.
    #:
    #: relations.py supplies NO detector and NO regex.  BACKLOG §2.4 is the
    #: argument: Finnish prints `j. n. e.`, Malay `d. s. b.`, Welsh its own,
    #: and `&c.` is not an English fact but an EDITION's, so a built-in
    #: pattern here would be doctrine 65's mistake -- porting one language's
    #: punctuation rule into a module that serves nine.  The caller declares
    #: it; `lyric_harness.is_chorus_stub` is one such caller and this module
    #: still imports nothing from it, because nothing here transcribes.
    line_status: tuple = ()
    #: (line, status, raw) for every line whose declared status was excluded.
    #: Doctrine 79: an excluded line is not a line that found nothing.
    excluded_lines: list = field(default_factory=list)

    def status_of(self, line):
        return self.line_status[line] if line < len(self.line_status) else ""

    # -- capabilities.  A schema's `requires` is checked against these, and a
    #    missing one produces a Refusal naming it rather than a wrong number.
    def provides(self, cap):
        """Boolean, and UNCHANGED as a contract: True iff the schema can run.

        What changed on 2026-08-22 is which side of the line a DECLARED-BUT-
        EMPTY frame falls on.  It used to be True -- `caesura_source` was
        `'printed'`, so the gate opened, and the schema went and enumerated
        zero loci.  A gate that opens on a source rather than on a population
        turns a refusal into a null (doctrine 20), so this now reads the
        population and `supply()` is where the three-valued answer lives.
        """
        return self.supply(cap).state == "present"

    def supply(self, cap):
        """-> `Supply`.  THE THREE-VALUED READ, and `provides` is its top.

        Two shapes of capability, and only the first can be vacuous:

        A FRAME has a declared SOURCE and a POPULATION, and the two are
        separate facts -- `mark_printed_caesura` sets `caesura_source` even
        where it marked no line, and it is right to, because "the printed-mark
        instrument ran and found none" is a finding about the EDITION (M-28:
        English prints no caesura; the 1,628 lines with an internal double
        space are line-number columns and speaker gaps) and deleting the
        source would collapse it with "nobody ever looked".  So the source is
        kept and the POPULATION is what the gate reads.

        EVERYTHING ELSE is two-valued and says so by returning `absent` or
        `present` only.  `prominence` is a property of the phonology, not a
        frame a marker fills: no caller declares a prominence source, so
        there is no third state to be in and inventing one would be a
        coordinate nobody declared (defect P14's shape).  `beat` is doctrine
        4's permanent None.  A resource and a quotient are a name in a
        declaration and a callable respectively, and neither has a population
        this module can count without calling it.

        AN ALT SURFACE IS A FRAME, and its population is the number of units
        that PROJECT into the second declaration and carry material there.
        That is not a formality: defect P7 records a second surface whose
        tokeniser splits the apostrophe, against which `_project` returns None
        at every position -- so the surface is declared, every channel read on
        it is None, and every schema riding it ran and reported nothing.  Same
        collapse, one seam over.
        """
        fr = self.frames
        if cap == "caesura":
            return self._frame_supply(cap, fr.caesura_source, len(fr.caesura),
                                      "lines carrying a caesura position")
        if cap == "refrain_tail":
            return self._frame_supply(cap, fr.refrain_source,
                                      len(fr.refrain_tail),
                                      "lines carrying a refrain tail")
        if cap == "lifts":
            return self._frame_supply(cap, fr.lift_source, len(fr.lifts),
                                      "lines carrying a lift template")
        if cap == "stub_resolution":
            return self._frame_supply(cap, fr.stub_source,
                                      len(fr.stub_resolution),
                                      "stub lines resolved to a span")
        if cap == "bayt":
            return self._frame_supply(cap, fr.bayt_source, len(fr.hemistich),
                                      "lines mapped to a (bayt, half)")
        if cap == "stanza":
            # M-39.  Source and population are separate facts here for the same
            # reason they are for the caesura, and the separation is what makes
            # a one-stanza POEM distinguishable from a stream nobody framed.
            # The population is the number of distinct frames a `forall stanza`
            # figure would quantify over, so a caller reading `Supply.n` can
            # say "grounded, 8 stanzas" or "grounded, 1 stanza" and mean two
            # different things by them.
            return self._frame_supply(
                cap, fr.stanza_source, len({u.stanza for u in self.units}),
                "distinct stanzas over the stream's units")
        if cap == "line_status":
            # DECLARED is a non-empty tuple; POPULATED is a non-empty LABEL in
            # it.  `line_status_from(lines, predicate, label)` with a predicate
            # that matches nothing returns a full tuple of "" -- declared, and
            # empty -- and the old `any(self.line_status)` filed that under
            # "nobody declared one".
            n = sum(1 for s in self.line_status if s)
            return self._frame_supply(
                cap, "declared" if self.line_status else "none", n,
                "lines carrying a non-empty declared status")
        if cap == "prominence":
            n = sum(1 for u in self.units if u.syl.prominence is not None)
            return Supply(cap, "present" if n else "absent", n, "phonology",
                          "units whose syllable carries a prominence value")
        if cap == "beat":
            # ~~"doctrine 4: this stays None"~~ — the field stays None until a
            # caller DECLARES one (`declare_beat`), which doctrine 4 has
            # always permitted: it refuses an INFERRED grid, not a stated one.
            return self._frame_supply(cap, fr.beat_source,
                                      len(fr.beat or {}),
                                      "lines carrying a declared beat grid")
        if cap in ALT_SURFACES:
            alt = self.alt.get(cap)
            if alt is None:
                return Supply(cap, "absent", 0, "none",
                              "no second declaration is held under this name")
            n = sum(1 for u in self.units
                    if _surface_material(_project(u, alt)))
            return self._frame_supply(
                cap, "declared", n,
                "units that project into the second declaration and carry "
                "material there")
        if cap in ("lexicon", "sense", "morphology"):
            res = _resources_of(self)
            # either the capability name or any LEVEL that maps to it: the two
            # key-spaces used to disagree and no declaration could satisfy both.
            got = cap in res or any(
                lv in res for lv, c in _CAP_OF_LEVEL.items() if c == cap)
            src = ("declaration"
                   if (cap in (self.declaration.get("resources") or {})
                       or any(lv in (self.declaration.get("resources") or {})
                              for lv, c in _CAP_OF_LEVEL.items() if c == cap))
                   else "phonology")
            return Supply(cap, "present" if got else "absent", 1 if got else 0,
                          src,
                          "named in declaration['resources'] or phon.resources")
        if cap.startswith(QUOTIENT_CAP):
            # DEFECT P14: a quotient nobody declared is not the identity, and a
            # schema whose grain is undeclared refuses here rather than
            # answering at the finest grain the channel happens to carry.
            q = _quotient_of(self, cap[len(QUOTIENT_CAP):])
            return Supply(cap, "present" if q is not None else "absent",
                          1 if q is not None else 0, "declaration",
                          "a partition callable, from the declaration or the "
                          "phonology")
        return Supply(cap, "absent", 0, "none",
                      "`Stream.supply` has no branch for this name, so no "
                      "declaration can supply it (see UNPROVIDABLE)")

    def _frame_supply(self, cap, source, n, detail):
        if source == "none" or not source:
            return Supply(cap, "absent", 0, "none",
                          "no source declared: " + detail)
        return Supply(cap, "present" if n else "empty", n, source, detail)

    def line_of(self, span):
        ls = {self.units[i].line for i in span.idx}
        return ls.pop() if len(ls) == 1 else None


_WORD = re.compile(r"[^\W\d_]+(?:['’\-][^\W\d_]+)*", re.UNICODE)


def tokenise(line):
    """Deliberately minimal and deliberately NOT clever about the apostrophe or
    the hyphen.  Doctrine 65 records four incompatible jobs for one glyph across
    four languages and MISSING F-3 records four more inside English alone, so
    the mark belongs to the DECLARATION.  A caller passes `tokenise=` its own.
    """
    return _WORD.findall(line)


def stanzas_from_blank_lines(text_lines):
    """The PRINTED stanza coordinate: a run of blank lines ends a stanza.

    -> a list, one entry per line, of that line's 0-based stanza.  Blank lines
    keep the stanza they close, so the value is defined for every index.

    This is the cheapest honest source and it is the one the corpus carries.
    Where a text prints no blank lines every line lands in stanza 0, which is a
    TRUE statement about the text rather than the hardcoded 0 it replaces.
    """
    out, s, seen = [], 0, False
    for raw in text_lines:
        if raw.strip():
            out.append(s)
            seen = True
        else:
            out.append(s)
            if seen:
                s += 1
                seen = False
    return out


def line_status_from(text_lines, predicate, label):
    """Build a `line_status` tuple from a CALLER'S predicate.

    `predicate` is any `raw_line -> bool`.  This module ships none, and that
    is the point: `lyric_harness.is_chorus_stub` is one, a Finnish `j. n. e.`
    rule is another, and which one is right is a property of the EDITION.
    """
    return tuple(label if predicate(l) else "" for l in text_lines)


def build_stream(text_lines, phon, sections=None, tokeniser=tokenise,
                 declaration=None, hyphen_continues=True, stanzas=None,
                 line_status=None, exclude_status=(), stanza_source=""):
    """Syllabify a whole song ONCE into one flat indexed sequence.

    O(total syllables).  A 40-line lyric is ~250 units; a 5,000-line corpus item
    is ~30,000, which is a list, not a problem.  Everything downstream indexes
    into this, so no relation ever re-syllabifies and no relation is confined to
    a stanza.

    `stanzas` is a per-line stanza index.  Default: derived from blank lines
    (defect P8 -- it used to be the constant 0, which collapsed all five
    stanza-framed schemas into one frame for every text).  Pass a list to
    declare it, or `stanzas=False` to keep every line in stanza 0.

    `stanza_source` NAMES WHERE A DECLARED LIST CAME FROM (M-39), and it is
    the difference between "a caller said so" and "the printer said so".  A
    caller passing a list gets `Frames.stanza_source = 'declared'` unless it
    names something more specific -- `quality/relations_null`'s panel passes
    `printed_breaks` or `printed_verse_number` -- and the name reaches every
    row through `Supply.source`, so a number quantified over a stanza frame
    can be read together with what supplied the frame.  Ignored when `stanzas`
    is None or False: those two have sources of their own, and letting a
    caller label a derivation it did not make is the laundering this closed.

    `line_status` is a per-line label, or a callable `raw_line -> label`, and
    defaults to nothing declared (defect P10).  `exclude_status` names labels
    whose lines contribute NO UNITS -- the treatment an unreadable token
    already gets, applied to a line that is a POINTER rather than verse.  The
    line keeps its index and its entry in `lines`, so nothing downstream
    renumbers, and the loss is recorded in `excluded_lines` rather than being
    silent.  Both default to inert: a caller that declares neither gets the
    stream it got before, byte for byte.
    """
    units, lines, toks, unreadable, excluded = [], [], {}, [], []
    if stanzas is None and stanza_source == "none":
        # THE CALLER KNOWS THERE IS NO GROUND AND SAYS SO, and this branch is
        # the one that must exist for the derivation to be REFUSABLE (M-39,
        # reopened and closed again 2026-08-22).
        #
        # `stanzas_from_blank_lines` reads a BLANK LINE as the printer's own
        # mark.  That is true of a page and false of anything else, and
        # `relations_null._stream_of` hands this function a JOIN OF TOKENS:
        #
        #     [" ".join(t) for t in toks]
        #
        # A page line that tokenises to nothing -- `1818.]` in a Gutenberg
        # publication note, whose characters are all digits and punctuation
        # and none of them in `_WORD`'s repertoire -- joins to `""`.  The
        # derivation then finds a blank line THE SOURCE NEVER PRINTED, records
        # `blank_lines`, and `supply('stanza')` answers `present` with n=1:
        # the exact collapsed frame this entry closed, walking back in through
        # the reader.  Measured on a three-line fixture, and live on the first
        # candidate corpus cell carrying un-stripped apparatus.
        #
        # A caller holding a token grid cannot ask a question about a page, so
        # it says so here instead of being answered wrongly.
        stanzas = [0] * len(text_lines)
    elif stanzas is None:
        stanzas = stanzas_from_blank_lines(text_lines)
        # THE DERIVATION IS ONLY A SOURCE WHERE IT HAD EVIDENCE (M-39).  A
        # blank line is the evidence; a text carrying none did not tell this
        # function anything, and recording `blank_lines` there would be the
        # gate-opens-on-a-source defect `supply()` already documents one seam
        # over.  `quality/grid.stanzas_from_sections` is the other ground a
        # caller can declare, and it is DECLARED rather than sniffed for here:
        # a checker silently picking a coordinate is the bug (doctrine 45).
        stanza_source = ("blank_lines"
                         if any(not (l or "").strip() for l in text_lines)
                         else "none")
    elif stanzas is False:
        stanzas = [0] * len(text_lines)
        stanza_source = "collapsed"
    else:
        stanza_source = stanza_source or "declared"
    if callable(line_status):
        line_status = tuple(line_status(l) or "" for l in text_lines)
    elif line_status is None:
        line_status = ()
    else:
        line_status = tuple(line_status)
    exclude_status = tuple(exclude_status)
    pending_split = False
    for li, raw in enumerate(text_lines):
        st = line_status[li] if li < len(line_status) else ""
        if st and st in exclude_status:
            excluded.append((li, st, raw))
            lines.append(())
            pending_split = False
            continue
        words = tokeniser(raw)
        cut = bool(re.search(r"[\w’'](-)\s*$", raw)) and hyphen_continues
        # Two passes over the line.  The first finds which tokens the
        # declaration can actually read, because `line_initial` / `line_final`
        # are facts about the SURVIVING material and computing them from the raw
        # token count is defect P0.  The second builds the units.
        read = []
        for ti, w in enumerate(words):
            sy = phon.syllabify(w)
            if sy:
                read.append((ti, w, sy))
            else:
                # out of the declared inventory: the token contributes NO units.
                # The token index still advances, so a placement rule reading
                # `line_tokens` still sees it -- and it is now RECORDED, so the
                # loss is a number a caller can quote instead of a silence.
                unreadable.append((li, ti, w))
        first_ti = read[0][0] if read else -1
        last_ti = read[-1][0] if read else -1
        idxs = []
        for ti, w, sy in read:
            here = []
            for si, s in enumerate(sy):
                u = Unit(i=len(units), syl=s, line=li, token=ti, tok_syl=si,
                         tok_len=len(sy), token_text=w, line_tokens=len(words),
                         section=(sections[li] if sections else ""),
                         stanza=(stanzas[li] if li < len(stanzas) else 0),
                         split_left=(pending_split and ti == 0),
                         split_right=(cut and ti == len(words) - 1),
                         line_first=first_ti, line_last=last_ti)
                units.append(u)
                idxs.append(u.i)
                here.append(u.i)
            # built from this token's OWN indices.  The old form rescanned every
            # unit in the song per token, which is quadratic and contradicted
            # this function's own documented O(total syllables): 30,120 units
            # took 11.9s before, 0.3s after.
            toks[(li, ti)] = tuple(here)
        pending_split = cut
        lines.append(tuple(idxs))
    return Stream(units=units, lines=lines, tokens=toks, phon=phon,
                  declaration=dict(declaration or {}),
                  frames=Frames(stanza_source=stanza_source),
                  text_lines=tuple(text_lines), unreadable=unreadable,
                  line_status=line_status, excluded_lines=excluded)


# ---------------------------------------------------------------------------
# 2. CHANNELS AND SURFACES
#
# The channel INVENTORY is a declaration coordinate.  Welsh declares a single
# consonant channel and does not separate onset from coda; Middle Chinese
# declares tone where English declares stress and has no stress at all.  A
# schema names channels; a declaration that cannot supply one yields None,
# which propagates -- it does not become False.
# ---------------------------------------------------------------------------


# --- THE SEAM.  A READER MUST NOT SPEND THE UNCERTAINTY IT IS HANDED.
#
# Section 3 below closed defect P11 for the PREDICATES: a channel may hold a
# `frozenset` of readings and `Agree`/`Differ` answer True where all agree,
# False where none can, and None where some do and some do not.  Four readers
# here then undid it, and the defect had the shape a representation defect
# always has -- the type survived and the MEANING did not:
#
#     _rd_coda(close)   tuple(Readings({('S',), ('Z',)}))  ==  (('S',), ('Z',))
#
# which is not two readings of a coda, it is ONE coda of two clusters, and
# `_set_agree` then compares it for equality and answers a confident False.  A
# representation built to say "we cannot tell" was converted into a wrong
# certainty by the layer that consumes it, and `_rd_nucleus` -- which returns
# its channel raw and is the only reason the wind/find case worked at all --
# was three lines away.  Measured before the fix, in
# `quality/test_readings_seam.py` §3.
#
# TWO SHAPES, TWO FIXES.
#
# `onset` and `coda` are SCALAR channels whose value happens to be an ordered
# cluster, so the set passes through exactly as the nucleus does.
#
# `consonants` and `phones` DERIVE a sequence by concatenating channels, and
# there is no pass-through: a set cannot be spliced into a tuple, because a
# tuple containing a frozenset is one value to `_set_agree` and compares
# unequal to everything.  They take the product instead -- the set of the
# sequences the readings permit -- which keeps the tri-state whole:
# `phones(wind)` and `phones(sand)` are still a definite False (disjoint under
# every reading) where a flat refusal would have thrown that decision away.
# `_seq` still refuses the SEQUENCE-scoped case for its own stated reason (see
# its `if uncertain(v)` guard in section 8), and `_bucket_key` still treats an
# uncertain read as a wildcard -- and BOTH guards now actually fire, because
# `uncertain()` sees a frozenset where it used to see a tuple.  They were dead
# code on these four channels for as long as the readers coerced, which is why
# `_bucket_key` was silently DELETING every candidate pair for a homograph
# span: it filed the span under a key built from all its readings at once, a
# bucket nothing else can land in.  Measured, sonnets: 45,505 instances exist
# only after the fix.
#
# `Alternatives` is `quality.phonology.Readings` on this side of the seam and
# is duplicated rather than imported ON PURPOSE: this module transcribes
# nothing and imports no phonology (see the module docstring), and `_alts`
# keys on `isinstance(x, frozenset)`, so a production `Readings` arriving from
# the other side needs no conversion and flows through unchanged.  Its
# `__iter__` is sorted by `repr` for doctrine 66's reason and no other.


class Alternatives(frozenset):
    """A derived channel's set of readings.  `|self| == 1` is certainty.

    Iteration order is FIXED (sorted by `repr`) and arbitrary and stated,
    which is the whole of what doctrine 66 asks of a tie-break.  Nothing in
    this module's set algebra depends on the order; the guarantee exists so
    that a consumer which iterates cannot differ between PYTHONHASHSEEDs
    without saying so.
    """

    __slots__ = ()

    def __iter__(self):
        return iter(sorted(frozenset.__iter__(self), key=repr))

    def __repr__(self):
        return "Alternatives({%s})" % ", ".join(repr(v) for v in self)


def _collapse(vals):
    """A derived set of readings -> the sole reading, or `Alternatives`."""
    s = Alternatives(vals)
    return next(iter(s)) if len(s) == 1 else s


def _cluster(v):
    """A cluster channel (onset / coda) as it should leave a reader.

    A knowledge set is passed THROUGH, exactly as `_rd_nucleus` passes the
    nucleus through -- a `tuple()` here turns two readings of a cluster into
    one cluster of two readings, and `_set_agree` then answers a confident
    False about it.

    A SINGLETON set is collapsed, because `|set| == 1` is certainty and
    certainty is a scalar everywhere else in this module.  `merge_readings`
    never emits one, but a hand-written `parses()` easily could, and the
    difference is not cosmetic: `_seq` extends its output with
    `v if isinstance(v, tuple) else [v]`, and one schema reads `onset` at
    SEQUENCE scope, so a one-reading frozenset would enter a consonant
    skeleton as a single element -- the same splice this fix exists to
    remove, arriving through the door it left open.
    """
    if isinstance(v, frozenset):
        return tuple(next(iter(v))) if len(v) == 1 else v
    return tuple(v)


def _rd_onset(u):
    return _cluster(u.syl.onset)


def _rd_nucleus(u):
    return u.syl.nucleus


def _rd_coda(u):
    return _cluster(u.syl.coda)


def _rd_prominence(u):
    return u.syl.prominence


def _rd_moras(u):
    return u.syl.moras


def _rd_consonants(u):
    """Welsh: onsets and codas are NOT distinguished; the skeleton is one
    ordered consonant sequence gathered across word and syllable boundaries.

    A DERIVED sequence, so an uncertain onset or coda yields the set of
    skeletons the readings permit rather than one skeleton with a set inside
    it.  A Welsh skeleton built from one guessed reading is a skeleton nobody
    declared, and a skeleton with a frozenset spliced into it is worse: it
    looks certain."""
    o, c = u.syl.onset, u.syl.coda
    if not (isinstance(o, frozenset) or isinstance(c, frozenset)):
        return tuple(o) + tuple(c)
    return _collapse(tuple(oo) + tuple(cc)
                     for oo in _alts(o) for cc in _alts(c))


def _rd_phones(u):
    """The syllable flattened to its ordered phone sequence.  A span is a
    selection of SYLLABLE indices; a sequence-scoped channel on this reader is
    how a phone-level relation is reached without a second stream.

    Uncertain on any of the three channels -> the set of phone sequences the
    readings permit.  `phones(wind)` is
    `Alternatives({('W','AY','N','D'), ('W','IH','N','D')})`, so wind/wined
    is None -- the sequences overlap and do not settle -- and wind/sand is
    still a definite False, because no reading of either agrees.  Before the
    fix the frozenset was spliced in as a single element and BOTH were a
    confident False.

    NOT wind/FIND, which is the example the patch note for this fix used:
    this channel carries the ONSET, W and F disagree under every reading, and
    False is correct there before and after.  Recorded because a fix aimed at
    turning that pair into None is a fix that over-refuses, which is exactly
    what `return None` on any uncertain channel would have done."""
    o, n, c = u.syl.onset, u.syl.nucleus, u.syl.coda
    if not (isinstance(o, frozenset) or isinstance(n, frozenset)
            or isinstance(c, frozenset)):
        return tuple(o) + ((n,) if n else ()) + tuple(c)
    return _collapse(tuple(oo) + ((nn,) if nn else ()) + tuple(cc)
                     for oo in _alts(o) for nn in _alts(n) for cc in _alts(c))


def _rd_grapheme(u):
    return u.syl.text


def _rd_token(u):
    return u.token_text.lower()


PHONEMIC = {
    "onset": _rd_onset, "nucleus": _rd_nucleus, "coda": _rd_coda,
    "prominence": _rd_prominence, "moras": _rd_moras,
    "consonants": _rd_consonants, "grapheme": _rd_grapheme,
    "phones": _rd_phones, "token": _rd_token,
}


@dataclass(frozen=True)
class ChannelSet:
    """What a declaration says it can read.  `absent` names channels the
    language HAS NO NOTION OF -- reading one returns None forever, which is a
    refusal by construction rather than a zero."""
    readers: dict
    absent: tuple = ()

    def read(self, u, channel, stream=None, surface="phonemic"):
        if surface != "phonemic":
            alt = (stream.alt.get(surface) if stream else None)
            if alt is None:
                return None                        # no second declaration held
            v = _project(u, alt)
            if v is None:
                return None
            u = v
        if channel in self.absent:
            return None
        f = self.readers.get(channel)
        return None if f is None else f(u)


DEFAULT_CHANNELS = ChannelSet(readers=PHONEMIC)


def _project(u, alt):
    """Same (line, token, syllable) position in a second declaration's stream.
    Where the two declarations disagree in LENGTH -- of the line in tokens or of
    the token in syllables -- the projection returns None: a surface that
    re-tokenises or re-syllabifies cannot be read position-wise, and saying so
    is the honest answer.

    DEFECT P7, fixed.  The token guard was missing, and `(line, token)` is only
    a shared coordinate while both declarations cut the line the same way.
    Doctrine 65 says the apostrophe belongs to the DECLARATION, so a second
    surface re-tokenising is the INTENDED usage, not an abuse.  Measured before
    the guard, on `it's my birthday today` against a surface whose tokeniser
    splits the apostrophe:

        it's -> it     my -> s     birthday -> None     today -> birthday

    -- every read after the divergence came from a different word, silently.
    """
    if alt.units and u.line < len(alt.lines):
        av = alt.lines[u.line]
        if av and alt.units[av[0]].line_tokens != u.line_tokens:
            return None
    for v in alt.tokens.get((u.line, u.token), ()):
        w = alt.units[v]
        if w.tok_len != u.tok_len:
            return None
        if w.tok_syl == u.tok_syl:
            return w
    return None


def _surface_material(u):
    """Does this projected unit carry ANYTHING a channel could read?

    `Stream.supply` counts an alt surface's population with this, and it is
    structural on purpose -- no channel is named, no reader is called, no
    `ChannelSet` is consulted -- because the question is whether the second
    declaration says anything AT ALL at this position, and a surface answering
    only one channel (`declare_orthography` answers only `grapheme`) is still
    a surface.  `None` in, False out: a position that does not project is a
    position that carries nothing, which is defect P7's whole finding.
    """
    if u is None:
        return False
    s = u.syl
    return any(getattr(s, f, None) for f in
               ("text", "onset", "nucleus", "coda"))


# ---------------------------------------------------------------------------
# 3. PREDICATES -- ternary, and AGREEMENT IS SEPARATE FROM EVIDENCE
#
# Doctrine 25: two ABSENT codas carry no evidence (0.000 bits) and they AGREE,
# and `see`/`free` is a perfect rhyme.  A predicate therefore returns BOTH.
# cym._sain() requires `bool(b[0].onset)` and thereby deletes cynghanedd sain
# lafarog, whose whole point is that two absent onsets agree.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Read:
    value: object          # True / False / None
    informative: bool
    note: str = ""


def _empty(x):
    return x is None or x == () or x == ""


# --- KNOWLEDGE SETS.  DEFECT P11, closed on the half this module owns.
#
# A channel does not yield a value; it yields the SET of values the declared
# surface permits, and certainty is |set| == 1.  The shape is mined from
# `quality/rhyme_constraints.py`, which MISSING M-16 calls that module's one
# genuine advance and the right shape for the homograph gap -- and which has
# no caller, so the idea was stranded.  This is that shape and nothing else
# taken across; the file itself is not imported.
#
# `wind` is /W IH1 N D/ and /W AY1 N D/.  Before this a predicate received ONE
# of them and returned True or False -- a verdict on a reading nobody
# declared.  Now: every reading agrees -> True; no reading can agree -> False;
# some agree and some do not -> **None**, which is the ternary this module
# exists to preserve.  A homograph is UNDECIDED, not silently resolved.
#
# THE PRODUCTION HALF IS CLOSED TOO, on 2026-08-11, in
# `quality/phonology/__init__.py`: `Syllable` may hold a `Readings` on any
# channel, `Phonology.parses()` is the hook a language overrides to declare
# more than one reading, and `merge_readings` folds them.  Nine of nine shipped
# modules still declare ONE reading and are byte-identical; `quality/
# test_homograph.py` wires `eng` and `ltc` the other way and pins what changes.
#
# The seam BETWEEN the two halves was the last thing open and it is closed as
# of 2026-08-11 as well: `_rd_onset`, `_rd_coda`, `_rd_consonants` and
# `_rd_phones` all coerced the set with `tuple()` and answered a confident
# False about the result.  See the long comment above the readers in section 2
# and `quality/test_readings_seam.py`, which pins each of the four and the
# corpus counts the fix moves.  What remains open is not a defect in this file:
# `quality/phonology` ships no module that EMITS a set, so every count below is
# reached through a declared opt-in reader and the default numbers do not move.


def _alts(x):
    """A channel value as the set of readings it permits.

    A scalar -- or a TUPLE, since a cluster is one value and not a set of
    values -- is CERTAIN knowledge of itself.  A `frozenset` is the uncertain
    case, so the marker is the type and no existing reader changes behaviour.
    """
    return x if isinstance(x, frozenset) else frozenset((x,))


def uncertain(x):
    """True where the channel holds more than one reading."""
    return isinstance(x, frozenset) and len(x) > 1


class Predicate:
    name = "predicate"

    def __call__(self, x, y):
        raise NotImplementedError


def _set_agree(x, y):
    """Set algebra over two knowledge sets -> (verdict, informative, note).

    Certain values take the scalar path unchanged, so nothing that shipped
    moves.  Uncertain ones cannot be collapsed to a verdict and are not.
    """
    ax, ay = _alts(x), _alts(y)
    if len(ax) == 1 and len(ay) == 1:
        vx, vy = next(iter(ax)), next(iter(ay))
        return vx == vy, not (_empty(vx) and _empty(vy)), ""
    if not (ax & ay):
        return False, True, "no reading of either member agrees"
    # overlap without certainty: some readings agree and some do not
    return None, True, (f"{len(ax)}x{len(ay)} readings overlap but do not "
                        f"settle it — a homograph the declaration cannot "
                        f"resolve, so the answer is UNDECIDED, not a guess")


class Agree(Predicate):
    name = "AGREE"

    def __call__(self, x, y):
        if x is None or y is None:
            return Read(None, False, "unreadable on this surface")
        v, inf, note = _set_agree(x, y)
        return Read(v, inf, note)


class Differ(Predicate):
    name = "DIFFER"

    def __call__(self, x, y):
        if x is None or y is None:
            return Read(None, False, "unreadable on this surface")
        ax, ay = _alts(x), _alts(y)
        if len(ax) == 1 and len(ay) == 1 and _empty(next(iter(ax))) \
                and _empty(next(iter(ay))):
            # Doctrine 60 in general form: two identically-absent or
            # identically-MERGED values cannot say they differ either.
            return Read(False, False, "both absent; cannot differ")
        v, inf, note = _set_agree(x, y)
        return Read(None if v is None else (not v), inf, note)


class Free(Predicate):
    name = "FREE"

    def __call__(self, x, y):
        return Read(True, False, "channel not constrained")


@dataclass(frozen=True)
class ClassEqual(Predicate):
    """Equality under a DECLARED quotient.  Family rhyme's manner partition,
    the 同用 groupings (raw Qieyun lookup makes 流 and 樓 non-rhyming and they
    are the rhyme of 登鸛雀樓), any-vowel-with-any-vowel, 平/仄.  A boolean
    x == y cannot express any of them.

    DEFECT P14, fixed.  `partition=lambda v: v` IS NOT A QUOTIENT, and four of
    the five ClassEqual channels in this file shipped with exactly that while
    their own `label` named a partition nobody had written -- "declared manner
    partition", "declared length class", "declared 同用 grouping".  Under the
    identity the predicate is plain equality, and all three consequences were
    MEASURED, not argued:

      proest         the channel list says nucleus MUST DIFFER *and* nucleus
                     CLASS-EQUAL.  Under the identity those are each other's
                     negation, so the schema was UNSATISFIABLE -- not strict,
                     unsatisfiable: `tân`/`tôn`, `mab`/`heb`, `llon`/`llan`,
                     `dydd`/`budd`, `cant`/`gwynt`, `gwyn`/`gwn` all read
                     False, and no input of any kind could read True.
      family rhyme   degenerates to nucleus AGREE + coda AGREE, so `cat`~`bat`
                     -- an ordinary perfect rhyme -- came back True as a
                     FAMILY relation.  `multisyllabic rhyme`'s coda is the
                     same channel with the same identity partition.
      同用           compares the RAW 廣韻 韻, which is doctrine 36's own
                     error: 流 (尤) against 樓 (侯) read False here while
                     `ltc.rhymes` -- the phonology that OWNS the table --
                     reads True on the pair the grouping exists for.

    So the quotient is a NAMED RESOURCE the stream supplies, the same shape
    `IdentityRule`'s morphology resource already has (test P4): `resource`
    names it, `RelationSchema.capabilities()` turns that into
    `quotient:<name>`, and `realise()` REFUSES a schema whose declaration
    supplies none -- naming it -- rather than answering under a quotient
    nobody wrote.  `partition=` stays for a quotient the schema states in full
    (`alliterative long line`'s vowel class is one), and an UNRESOLVED
    partition reads None: a refusal, never a False.  Doctrine 45 -- a checker
    that silently picks the finest possible grain is making a claim it never
    states.
    """
    partition: object = None    # callable value -> class label, or dict
    label: str = "declared quotient"
    resource: str = ""          # the quotient's name in the DECLARATION
    name: str = "CLASS-EQUAL"

    def _cls(self, v):
        if callable(self.partition):
            return self.partition(v)
        return self.partition.get(v, ("__ungrouped__", v))

    def __call__(self, x, y):
        if self.partition is None:
            return Read(None, False,
                        f"no {self.label} supplied by this declaration"
                        + (f" (quotient {self.resource!r})"
                           if self.resource else "")
                        + "; the identity is not a quotient, so the answer is "
                          "a REFUSAL and not a verdict at the finest grain")
        if x is None or y is None:
            return Read(None, False, "unreadable")
        # knowledge sets quotient element-wise: the CLASS of an uncertain
        # value is the set of classes its readings fall in, and 流/樓 landing
        # in one 同用 group under both readings still AGREES.
        cx = frozenset(self._cls(v) for v in _alts(x))
        cy = frozenset(self._cls(v) for v in _alts(y))
        if None in cx or None in cy:
            return Read(None, False, f"outside {self.label}")
        cx = next(iter(cx)) if len(cx) == 1 else cx
        cy = next(iter(cy)) if len(cy) == 1 else cy
        v, inf, note = _set_agree(cx, cy)
        return Read(v, inf if v is not None else True, note or self.label)


def _quotient_of(stream, name):
    """-> the callable the stream supplies for the named quotient, or None.

    TWO SOURCES, and the DECLARATION WINS, because a declaration is where an
    assumption is supposed to live (doctrine 1) and a caller who wrote one
    down meant it:

      declaration['quotients'][name]   the caller's own, per stream.
      phon.quotients[name]             the PHONOLOGY's own.  This is the seam
                                       that hands `ltc`'s 平水韻 同用 grouping
                                       to the 同用 schema without this module
                                       importing a phonology, hard-coding a
                                       rime table, or re-deriving one from
                                       channels it cannot see -- the same move
                                       `rhyme_types.py` makes for `phon.rhymes`
                                       (doctrine 84).  A phonology that
                                       declares no grouping supplies none, and
                                       the schema refuses instead.
    """
    if stream is None:
        return None
    q = (stream.declaration.get("quotients") or {}).get(name)
    if q is None:
        q = (getattr(stream.phon, "quotients", None) or {}).get(name)
    return q


def _resources_of(stream):
    """-> the resource table this stream supplies, declaration first.

    THE SAME TWO SOURCES `_quotient_of` READS, AND FOR THE SAME REASON
    (2026-08-22). A morphology, a lexeme inventory and a sense inventory are
    facts about a LANGUAGE, exactly as a manner partition or a 同用 grouping
    is, so they belong on the phonology that owns the language -- and this is
    the seam `ltc` established for quotients: `relations.py` imports no
    phonology, hard-codes no table, and re-derives nothing.

      declaration['resources'][level]   the caller's own, per stream. WINS,
                                        because a declaration is where an
                                        assumption is supposed to live
                                        (doctrine 1) and a caller who wrote
                                        one down meant it.
      phon.resources[level]             the PHONOLOGY's own.

    A phonology that declares none supplies none, and the schema refuses
    instead -- unchanged for every language that has not learned the
    coordinate.
    """
    out = dict(getattr(stream.phon, "resources", None) or {})
    # THE DERIVED SENSE RESOURCE, third in precedence and first to be built
    # (2026-08-22). `quality/senses.py` reads WordNet and assigns each token
    # a sense by simplified Lesk over its own line; it is a NAMED, WEAK
    # algorithm and says so. It sits BELOW both other sources because a
    # declaration always outranks a derivation (doctrine 1), and it supplies
    # nothing at all when the corpus is absent — `sense` then stays absent
    # and `antanaclasis` refuses, exactly as before it existed.
    if "sense" not in out and stream.declaration.get("derive_senses"):
        # OPT-IN, AND THE RATE IS WHY (2026-08-23). `quality/senses.py`
        # computes a sense per token — WordNet, POS-tagged, simplified Lesk,
        # coarsened to the lexicographer file — and it WORKS on the case the
        # figure is named for: `bank`/`bank` separates with nothing declared.
        # It was wired ON BY DEFAULT and then MEASURED over 40 corpus songs,
        # 1,603 lines: of 14,508 line pairs sharing a word, it separated
        # 1,366 — 9.42% — and the samples are visibly refrains, not puns
        # ("Land of the South! the fairest land" against "Land of the South!
        # in brightest dreams"). A figure detector at that rate would bury a
        # writer in false findings, which is worse than the refusal it
        # replaced. So the DERIVATION is available and disclosed and the
        # DEFAULT is unchanged: declare `derive_senses=True` to accept the
        # rate, or `relations.declare_senses` for positions you care about,
        # or neither and `antanaclasis` refuses exactly as before.
        # Doctrine 16/22: an uncalibrated cut is stated as a rate before it
        # means anything, and this one is stated and NOT adopted.
        try:
            from quality import senses as _SENSES
            fn = _SENSES.sense_resource(stream)
            if fn is not None:
                out["sense"] = fn
        except Exception:
            pass
    out.update(stream.declaration.get("resources") or {})
    return out


def _bind_quotient(pred, stream):
    """A ClassEqual whose quotient is DECLARED elsewhere, resolved against this
    stream.  Any other predicate, and any partition the schema states in full,
    is returned untouched."""
    if getattr(pred, "resource", "") and pred.partition is None:
        q = _quotient_of(stream, pred.resource)
        if q is not None:
            return replace(pred, partition=q)
    return pred


@dataclass(frozen=True)
class DirectedDiffer(Predicate):
    """MUST DIFFER, and in a declared ORDER.  The sole forcing case is ablaut
    reduplication: ding-dang-dong, never dong-dang-ding.  Nothing else in the
    enumeration says WHICH member carries which value of a differing channel."""
    order: tuple
    name: str = "DIRECTED-DIFFER"

    def __call__(self, x, y):
        if x is None or y is None:
            return Read(None, False, "unreadable")
        if uncertain(x) or uncertain(y):
            # a DIRECTION over an unresolved reading is not derivable; the
            # honest answer is the refusal, not whichever reading sorts first.
            return Read(None, False, "uncertain reading; direction undecidable")
        x, y = next(iter(_alts(x))), next(iter(_alts(y)))
        try:
            return Read(self.order.index(x) < self.order.index(y), True)
        except ValueError:
            return Read(None, False, "outside the declared order")


@dataclass(frozen=True)
class PresentVsAbsent(Predicate):
    """Additive / subtractive rhyme.  One member's channel value EXTENDS the
    other's: everything the bare member carries, the extra member carries in the
    same order, and then more.  The added material is EXCLUDED, not required to
    differ.  `on` names which member must carry it, which is the only thing
    separating additive from subtractive once members are in text order.

    DEFECT P6, fixed.  This tested whole-channel EMPTINESS -- `_empty(bare)` --
    so it fired only on a bare member with no coda at all (`see`/`seed`) and
    returned False on every canonical pair in the repo's own list
    (RHYME_COVERAGE.md, the **ADDITIVE PAIR LIST**.  Cited by NAME: this read
    "line 148", which pointed at the *subtractive* line even before §2 grew
    and then missed by two.  A line number into a living document is the same
    defect as a reused P-number, one layer down):

        year/feared  coda ('R',) vs ('R','D')   -> False
        down/found   coda ('N',) vs ('N','D')   -> False
        rain/brains  coda ('N',) vs ('N','Z')   -> False

    Proper extension is strictly weaker than the old test -- `()` is a proper
    prefix of `('D',)` -- so nothing that used to pass stops passing.
    """
    on: int = 1
    name: str = "PRESENT-vs-ABSENT"

    def __call__(self, x, y):
        if x is None or y is None:
            return Read(None, False, "unreadable")
        if uncertain(x) or uncertain(y):
            return Read(None, False, "uncertain reading; extension undecidable")
        x, y = next(iter(_alts(x))), next(iter(_alts(y)))
        vals = (x, y)
        extra, bare = vals[self.on], vals[1 - self.on]
        eb = () if _empty(bare) else tuple(bare)
        ex = () if _empty(extra) else tuple(extra)
        if len(ex) > len(eb) and ex[:len(eb)] == eb:
            return Read(True, True, "proper extension")
        return Read(False, True)


@dataclass(frozen=True)
class SequenceEqual(Predicate):
    """Total, ordered, exhaustive on both sides -- cynghanedd groes.

    `reverse_b` reads member 2 in its own declared DIRECTION at the ELEMENT
    level, which is what amphisbaenic rhyme needs and what a span over
    SYLLABLE indices cannot supply on its own: step/pets is one syllable each,
    so reversing the index selection is a no-op and the reversal has to happen
    inside the derived element sequence.
    """
    reverse_b: bool = False
    name: str = "SEQUENCE-AGREE"

    def __call__(self, x, y):
        if x is None or y is None:
            return Read(None, False, "unreadable")
        if not x and not y:
            return Read(True, False, "both empty; agreement carries no evidence")
        y = tuple(reversed(tuple(y))) if self.reverse_b else tuple(y)
        return Read(tuple(x) == y, True)


@dataclass(frozen=True)
class SequenceSuffix(Predicate):
    """A total over member A, a SUFFIX of member B, the unconsumed prefix of B
    being the pont.  THE DECISIVE CASE FOR PER-MEMBER ANCHORS: a checker that
    suffix-aligns both sides gets traws right and croes wrong; one that
    head-aligns both gets croes right and traws wrong."""
    min_bridge: int = 1
    name: str = "SEQUENCE-SUFFIX"

    def __call__(self, x, y):
        if x is None or y is None:
            return Read(None, False, "unreadable")
        x, y = tuple(x), tuple(y)
        if not x:
            return Read(False, False, "member A empty")
        if len(y) < len(x) + self.min_bridge:
            return Read(False, True, "no bridge")
        return Read(y[len(y) - len(x):] == x, True)


class SubsequenceOf(Predicate):
    """Order-preserving containment with no anchor at all -- parechesis, the
    one entry whose ANCHOR value is 'none'.  A set or subsequence test, not a
    pairwise channel comparison."""
    name = "SUBSEQUENCE"

    def __call__(self, x, y):
        if x is None or y is None:
            return Read(None, False, "unreadable")
        it = iter(tuple(y))
        return Read(all(c in it for c in tuple(x)), bool(x))


AGREE, DIFFER, FREE = Agree(), Differ(), Free()


# ---------------------------------------------------------------------------
# 4. SPANS
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Span:
    """A member: a SELECTION of unit indices in this member's own reading
    order, plus which position in that selection is the anchor.

    Non-contiguous (paroemion), mid-word-starting (a rap multi), cross-token
    (mosaic), leftward (amphisbaenic), and free to OVERLAP another span
    (croes o gyswllt).  Direction is per MEMBER, which is why amphisbaenic
    rhyme needs no separate orientation axis.
    """
    idx: tuple
    anchor_pos: int = 0
    direction: int = 1
    unit: str = "syllable"
    origin: str = ""          # provenance: which SpanRule produced it
    search_k: int = 1         # how many hypotheses the rule tried at this locus

    def __len__(self):
        return len(self.idx)

    def head(self):
        return self.idx[0]

    def tail(self):
        return self.idx[-1]


@dataclass(frozen=True)
class SpanRule:
    """How to FIND a member.  Per member, which is the whole point: cynghanedd
    draws is A head-anchored and total against B tail-anchored and searched,
    and no global alignment value can express that.
    """
    locus: str          # where to look for candidates
    anchor: str = "word_start"
    direction: int = 1
    magnitude: object = "to_word_end"
    cross_word: bool = False
    requires: tuple = ()
    # `terminator` was HERE and was DELETED on 2026-08-11 (defect P2).  It was
    # declared on all 154 member rules and read by none, and the deletion is
    # the honest close rather than a wiring, because the field could not be
    # given a semantics without inventing one: `_spans_at` receives `ids` --
    # the unit list OF THE LOCUS -- so there is no frame-versus-locus edge left
    # to choose between.  Whatever clipping a terminator would express has
    # already happened by the time the rule runs.  MEASURED before removal
    # (INERT[0] below records the command): 153 of 154 rules carried the
    # default `word_edge` and one carried `frame_edge`; no magnitude in the
    # registry mapped to two different terminators, so the field was a strict
    # function of `magnitude` and carried exactly zero information.  The single
    # non-default was `broken rhyme`, whose magnitude `to_frame_edge` already
    # says it and whose branch reads `split_right` off the unit.
    # NOT a precedent for rhyme_constraints.Span.terminator, which is a
    # different class in a different module and IS read there (see INERT[1]).

    def caps(self):
        need = set(self.requires)
        if self.anchor in ("last_stressed", "final_stressed_scope", "penult_stressed"):
            need.add("prominence")
        if self.locus in ("half_line_a", "half_line_b"):
            need.add("caesura")
        if self.locus == "lift":
            need.add("lifts")
        if self.locus == "line_final_before_refrain":
            need.add("refrain_tail")
        return tuple(sorted(need))


def _anchor_pos(rule, stream, ids):
    """Where the anchor sits inside a candidate token's unit list.

    RAISES rather than guessing when the rule has no referent: som declares
    pitch accent, msa declares contested stress, fas declares quantitative
    metre, and for all three `last stressed syllable` names nothing.
    """
    us = [stream.units[i] for i in ids]
    a = rule.anchor
    if a == "word_start":
        return 0
    if a == "word_end":
        return len(us) - 1
    if a == "second_syllable":
        if len(us) < 2:
            raise NoReferent("token has no second syllable")
        return 1
    if a == "penult":
        if len(us) < 2:
            raise NoReferent("token has no penult")
        return len(us) - 2
    if a in ("last_stressed", "penult_stressed", "final_unstressed"):
        if all(u.syl.prominence is None for u in us):
            raise NoReferent(
                "this declaration carries no prominence, so an anchor rule "
                "keyed on stress names nothing here")
        if a == "final_unstressed":
            for k in range(len(us) - 1, -1, -1):
                if us[k].syl.prominence == 0:
                    return k
            raise NoReferent("no unstressed syllable in this token")
        for k in range(len(us) - 1, -1, -1):
            if us[k].syl.prominence == 1:
                return k - 1 if a == "penult_stressed" and k else k
        return 0
    if a == "none":
        return 0
    if a == "searched":
        return 0
    raise NoReferent(f"unknown anchor rule {a!r}")


def _loci(rule, stream):
    """-> [(unit indices available at this locus, provenance string)].

    This is where PLACEMENT stops being an argument.  'line_final_token' looks
    up the last token OF EACH LINE in the stream; nobody passes position='end'.
    """
    fr = stream.frames
    out = []
    for li, ids in enumerate(stream.lines):
        if not ids:
            continue
        if rule.locus == "line_final_token":
            t = stream.units[ids[-1]].token
            out.append((stream.tokens[(li, t)], f"L{li}.final", 1))
        elif rule.locus == "line_initial_token":
            t = stream.units[ids[0]].token
            out.append((stream.tokens[(li, t)], f"L{li}.initial", 1))
        elif rule.locus == "any_token":
            for (l2, t2), tid in stream.tokens.items():
                if l2 == li and tid:
                    out.append((tid, f"L{li}.T{t2}", 1))
        elif rule.locus == "line":
            out.append((ids, f"L{li}", 1))
        elif rule.locus == "line_head_index":
            out.append((ids, f"L{li}.head-index", 1))
        elif rule.locus in ("half_line_a", "half_line_b"):
            # doctrine 56: a SEARCHED caesura is k hypotheses per line, and the
            # null must run the same search.  So every candidate is enumerated
            # and k is carried on the Span rather than one winner being picked
            # by a scorer nobody calibrated.
            cands = fr.caesura.get(li)
            if cands is None:
                continue
            cands = cands if isinstance(cands, tuple) else (cands,)
            for c in cands:
                a = tuple(i for i in ids if i < c)
                b = tuple(i for i in ids if i >= c)
                out.append(((a if rule.locus == "half_line_a" else b),
                            f"L{li}.{rule.locus}@{c}", len(cands)))
        elif rule.locus == "lift":
            for k, i in enumerate(fr.lifts.get(li, ())):
                out.append(((i,), f"L{li}.lift{k}", 1))
        elif rule.locus == "line_final_before_refrain":
            r = fr.refrain_tail.get(li)
            if r is None:
                continue
            before = [i for i in ids if i < r]
            if not before:
                continue
            t = stream.units[before[-1]].token
            out.append((tuple(i for i in stream.tokens[(li, t)] if i < r),
                        f"L{li}.pre-refrain", 1))
        elif rule.locus == "line_refrain_tail":
            r = fr.refrain_tail.get(li)
            if r is None:
                continue
            out.append((tuple(i for i in ids if i >= r), f"L{li}.refrain", 1))
        elif rule.locus == "free_run":
            out.append((ids, f"L{li}.free", 1))
        elif rule.locus == "token_first_half":
            for (l2, t2), tid in stream.tokens.items():
                if l2 == li and len(tid) >= 2:
                    out.append((tid[:len(tid) // 2], f"L{li}.T{t2}.h1", 1))
        elif rule.locus == "token_second_half":
            for (l2, t2), tid in stream.tokens.items():
                if l2 == li and len(tid) >= 2:
                    out.append((tid[len(tid) // 2:], f"L{li}.T{t2}.h2", 1))
        else:
            raise NoReferent(f"unknown locus {rule.locus!r}")
    return out


def enumerate_spans(rule, stream, max_span=8):
    """Every candidate member this rule can find in the song.  A GENERATOR --
    the producer never materialises a cross product it will not use.

    A LOCUS where the anchor rule has no referent is SKIPPED; only a rule with
    no referent ANYWHERE in the declaration is a refusal.  'penult' names
    nothing in a monosyllable and everything in a polysyllable, and conflating
    the two would have refused Welsh llusg for the whole language because some
    lines end in a monosyllable.
    """
    skipped = 0
    seen_any = False
    for ids, origin, k in _loci(rule, stream):
        if not ids:
            continue
        try:
            yield from (replace(sp, search_k=sp.search_k * k)
                        for sp in _spans_at(rule, stream, tuple(ids), origin))
            seen_any = True
        except NoReferent:
            skipped += 1
            continue
    if not seen_any and skipped:
        raise NoReferent(
            f"anchor {rule.anchor!r} at locus {rule.locus!r} has no referent at "
            f"any of the {skipped} loci in this declaration")


def _spans_at(rule, stream, ids, origin):
    """The spans one locus yields. Raises NoReferent when the anchor rule names
    nothing AT THIS LOCUS; the caller decides whether that is a skip or a
    refusal."""
    if rule.locus == "line_head_index":
        # a fixed index counted from the LINE HEAD: dvitiyakshara-prasa at 2,
        # monai at 1. Two types whose ONLY difference is one integer, which is
        # why placement must be a NUMBER IN A DECLARED FRAME.
        k = rule.magnitude if isinstance(rule.magnitude, int) else 1
        if len(ids) >= k:
            yield Span((ids[k - 1],), 0, 1, "syllable", origin)
        return
    if rule.anchor == "searched":
        # doctrine 56: a searched placement is k hypotheses, and the null must
        # run the SAME search. k is carried on the Span so a caller can build
        # the matched control instead of quoting the null back at itself.
        lo, hi = (rule.magnitude if isinstance(rule.magnitude, tuple)
                  else (rule.magnitude, rule.magnitude))
        k = sum(max(0, len(ids) - n + 1) for n in range(lo, hi + 1))
        for n in range(lo, min(hi, len(ids)) + 1):
            for st in range(0, len(ids) - n + 1):
                sel = ids[st:st + n]
                if not rule.cross_word and len({
                        (stream.units[i].line, stream.units[i].token)
                        for i in sel}) > 1:
                    continue
                yield Span(sel, 0, rule.direction, "syllable", origin, k)
        return
    if rule.magnitude == "whole":
        sel = ids if rule.direction > 0 else tuple(reversed(ids))
        yield Span(sel, 0, rule.direction, "syllable", origin)
        return
    if rule.magnitude == "word_initial_syllables":
        sel = tuple(i for i in ids if stream.units[i].word_initial)
        if len(sel) >= 2:
            yield Span(sel, 0, 1, "syllable", origin)
        return

    ap = _anchor_pos(rule, stream, ids)          # may raise NoReferent
    if rule.direction > 0:
        if rule.magnitude == "to_word_end":
            sel = ids[ap:]
        elif rule.magnitude == "to_line_end":
            li = stream.units[ids[0]].line
            sel = tuple(i for i in stream.lines[li] if i >= ids[ap])
        elif rule.magnitude == "to_frame_edge":
            # BROKEN RHYME: the span stops at the LINE edge, not the word edge.
            # Hopkins's 'king-' is in no dictionary and syllabify() on it is not
            # what the rhyme is about; the span is the units of the split token
            # that fall before the break, which the stream marked at build time.
            if not stream.units[ids[-1]].split_right:
                return
            sel = ids[ap:]
        else:
            sel = ids[ap:ap + int(rule.magnitude)]
    else:
        sel = tuple(reversed(ids)) if rule.magnitude == "to_word_end" \
            else tuple(reversed(ids[:ap + 1]))
        if isinstance(rule.magnitude, int):
            sel = sel[:rule.magnitude]
    if sel:
        yield Span(sel, 0, rule.direction, "syllable", origin)


# ---------------------------------------------------------------------------
# 5. ALIGNMENT
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Alignment:
    pairs: tuple                # ((pos in A.idx, pos in B.idx), ...)
    unmatched_a: tuple
    unmatched_b: tuple
    kind: str


def align_anchor(a, b, stream):
    """Anchor to anchor, then outward.  'Tail-to-tail flush' is a CONSEQUENCE
    of anchor=last-stressed + magnitude=to-word-end, never a primitive."""
    pairs, ia, ib = [], a.anchor_pos, b.anchor_pos
    k = 0
    while ia + k < len(a) and ib + k < len(b):
        pairs.append((ia + k, ib + k))
        k += 1
    k = 1
    while ia - k >= 0 and ib - k >= 0:
        pairs.insert(0, (ia - k, ib - k))
        k += 1
    ma = {p[0] for p in pairs}
    mb = {p[1] for p in pairs}
    return Alignment(tuple(pairs),
                     tuple(i for i in range(len(a)) if i not in ma),
                     tuple(i for i in range(len(b)) if i not in mb), "anchor")


def align_flush_left(a, b, stream):
    n = min(len(a), len(b))
    return Alignment(tuple((i, i) for i in range(n)),
                     tuple(range(n, len(a))), tuple(range(n, len(b))),
                     "flush_left")


def align_flush_right(a, b, stream):
    n = min(len(a), len(b))
    pa, pb = len(a) - n, len(b) - n
    return Alignment(tuple((pa + i, pb + i) for i in range(n)),
                     tuple(range(pa)), tuple(range(pb)), "flush_right")


def align_none(a, b, stream):
    """Unanchored -- the channel map must then be a SEQUENCE or SET predicate.
    parechesis, the Welsh skeleton, general consonance."""
    return Alignment((), tuple(range(len(a))), tuple(range(len(b))), "none")


ALIGNERS = {"anchor": align_anchor, "flush_left": align_flush_left,
            "flush_right": align_flush_right, "none": align_none}


# ---------------------------------------------------------------------------
# 6. PLACEMENT -- computed from the Units' coordinates, never passed in
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Placement:
    kind: str
    args: tuple = ()
    polarity: bool = True       # required / FORBIDDEN (the OE fourth lift)
    requires: tuple = ()

    def holds(self, a, b, stream):
        v = self._raw(a, b, stream)
        if v is None:
            return None
        return v if self.polarity else (not v)

    def _raw(self, a, b, stream):
        U = stream.units
        k = self.kind
        if k == "both_line_final":
            return U[a.tail()].line_final and U[b.tail()].line_final
        if k == "a_line_final":
            return U[a.tail()].line_final
        if k == "both_line_initial":
            return U[a.head()].line_initial and U[b.head()].line_initial
        if k == "neither_line_final":
            return not U[a.tail()].line_final and not U[b.tail()].line_final
        if k == "exactly_one_line_final":
            return U[a.tail()].line_final != U[b.tail()].line_final
        if k == "same_line":
            return U[a.head()].line == U[b.head()].line
        if k == "different_lines":
            return U[a.head()].line != U[b.head()].line
        if k == "adjacent_lines":
            return U[b.head()].line - U[a.head()].line == 1
        if k == "line_gap_at_most":
            return 0 < U[b.head()].line - U[a.head()].line <= self.args[0]
        if k == "line_status_in":
            # DEFECT P10.  The stub is a LINE STATUS, and this is the read.
            # `polarity=False` gives the exclusion form, so a caller who wants
            # stub lines kept in the stream but barred from a relation writes
            # Placement("line_status_in", ("stub",), polarity=False) and needs
            # no new predicate.  Refuses -- None, never False -- where no
            # status was declared, because "this line is not a stub" and
            # "nobody said" are different answers (doctrine 28).
            if not any(stream.line_status):
                return None
            return (stream.status_of(U[a.head()].line) in self.args
                    and stream.status_of(U[b.head()].line) in self.args)
        if k == "same_token":
            return (U[a.head()].line, U[a.head()].token) == \
                   (U[b.head()].line, U[b.head()].token)
        if k == "adjacent_tokens":
            return U[a.head()].line == U[b.head()].line and \
                U[b.head()].token - U[a.tail()].token == 1
        if k == "text_order":
            return a.tail() < b.head() or a.head() < b.head()
        if k == "across_line_break":
            return U[a.tail()].line + 1 == U[b.head()].line and \
                U[a.tail()].line_final and U[b.head()].line_initial
        if k == "at_caesura":
            if stream.frames.caesura_source == "none":
                return None
            c = stream.frames.caesura.get(U[a.head()].line)
            if c is None:
                return False
            c = c if isinstance(c, tuple) else (c,)
            return any(a.tail() < x <= b.head() for x in c)
        if k == "syllable_index_from_head":
            li = U[a.head()].line
            return stream.lines[li].index(a.head()) == self.args[0] - 1
        if k == "at_lift":
            if stream.frames.lift_source == "none":
                return None
            lf = stream.frames.lifts.get(U[a.head()].line, ())
            return a.head() in lf and b.head() in \
                stream.frames.lifts.get(U[b.head()].line, ())
        if k == "lift_index":
            if stream.frames.lift_source == "none":
                return None
            lf = stream.frames.lifts.get(U[b.head()].line, ())
            return bool(lf) and b.head() == lf[self.args[0]]
        if k == "off_beat":
            # THE SAME SHAPE AS `at_lift` DIRECTLY ABOVE, and for the same
            # reason: an undeclared grid is a REFUSAL (None), never a False.
            # "no beat was declared" and "this syllable is not on the beat"
            # are different answers (doctrine 20), and only the second is a
            # verdict about the writing.
            if stream.frames.beat_source == "none":
                return None
            grid = stream.frames.beat or {}
            on_a = grid.get(U[a.head()].line, ())
            on_b = grid.get(U[b.head()].line, ())
            return a.head() not in on_a and b.head() not in on_b
        if k == "spans_disjoint":
            return not (set(a.idx) & set(b.idx))
        if k == "spans_overlap":
            return bool(set(a.idx) & set(b.idx))
        if k == "word_count_differs":
            wa = len({(U[i].line, U[i].token) for i in a.idx})
            wb = len({(U[i].line, U[i].token) for i in b.idx})
            return wa != wb
        if k == "both_multiword":
            wa = len({(U[i].line, U[i].token) for i in a.idx})
            wb = len({(U[i].line, U[i].token) for i in b.idx})
            return wa > 1 and wb > 1
        if k == "b_starts_mid_word":
            return not U[b.head()].word_initial
        if k == "a_is_split_token":
            return U[a.tail()].split_right
        if k == "different_sections":
            return U[a.head()].section != U[b.head()].section
        if k == "same_section":
            return U[a.head()].section == U[b.head()].section
        raise NoReferent(f"unknown placement kind {self.kind!r}")


# ---------------------------------------------------------------------------
# 7. THE SCHEMA
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ChannelRule:
    channel: str
    predicate: object
    scope: str = "each"      # each | anchor | post_anchor | first | last |
    #                          sequence | unmatched_a | unmatched_b
    surface: str = "phonemic"
    required: bool = True    # False -> reported, not enforced (Snorri's FEGRA)


@dataclass(frozen=True)
class IdentityRule:
    level: str               # token | lexeme | lexeme_family | morpheme_root |
    #                          morpheme_affix | sense | lexeme_sequence
    predicate: object


_QUANT = None


def quantifier_table():
    """-> (QUANTIFIERS, canonical_quantifier) from `rhyme_constraints`.

    LAZY AND CACHED. `relations.py` already imports that module lazily (one
    call site, for cost rather than for cycles — nothing there imports this),
    and the vocabulary is read on every `Figure` construction, so it is
    resolved once and held.
    """
    global _QUANT
    if _QUANT is None:
        from quality import rhyme_constraints as _C
        _QUANT = (_C.QUANTIFIERS, _C.canonical_quantifier)
    return _QUANT


@dataclass(frozen=True)
class Figure:
    """The relation's shape over its members.  A labelled multigraph plus a
    member-selection rule; the pair is the degenerate case."""
    nodes: int = 2
    edges: tuple = ((0, 1, "self"),)
    #: A spelling in `rhyme_constraints.QUANTIFIER_ALIASES` — THE ONE TABLE
    #: (M-38). This field used to carry its own four-name comment while
    #: `rhyme_constraints.Selection.quantifier` carried a different four, two
    #: names apart for one concept and two shared. The table is declared in
    #: `rhyme_constraints` because the dependency runs that way: this module
    #: imports it, never the reverse.
    #:
    #: `k` COUNTS DISTINCT MEMBERS (`rhyme_constraints.K_COUNTS`), and
    #: `assemble()` below implements that exactly — `len(nodes) >= fig.k`
    #: over the union of member indices. The other module's `exists_k` is a
    #: figure-count proxy exact only at k=2 and REFUSES above it; this one
    #: has no such bound because it is not a proxy.
    quantifier: str = "exists"
    k: int = 1
    fraction: object = None
    frame: str = "song"            # line | line_pair | stanza | poem | song | token
    template: object = None        # 平仄: one member against a declared pattern

    def __post_init__(self):
        # Validated HERE, at the declaration, so a typo in one of 77 schemas
        # refuses at import rather than falling through `assemble()`'s
        # if/elif chain to silent no-op (the shape `unmatched` was fixed for
        # in `RelationSchema.__post_init__`, defect P15).
        quantifier_table()[1](self.quantifier)

    def canonical_quantifier(self):
        """-> the canonical name, whatever spelling was declared."""
        return quantifier_table()[1](self.quantifier)


PAIR = Figure()


#: What `unmatched` may say about the material the alignment left over, and
#: THE LIST IS MEASURED AGAINST `evaluate()` RATHER THAN RECALLED (defect P15).
#: The field's own comment used to read `exclude | differ | forbid`: 'differ'
#: is implemented by nothing and declared by none of the 77 schemas, while
#: 'require_a' and 'require_b' -- the two values `evaluate()` actually branches
#: on, and the only thing keeping semirhyme and apocopated rhyme from
#: collapsing into perfect rhyme -- were absent from the vocabulary they
#: belong to.  A MUST-DIFFER is a CHANNEL rule (pararhyme), so 'differ' is
#: closed by DELETION and not by wiring: two coordinates meaning one thing is
#: a worse defect than one inert coordinate.
#:   'exclude'    the overhang is outside the comparison (the default)
#:   'forbid'     any overhang on either member fails the pair
#:   'require_a'  member 1 MUST overhang and member 2 must not (apocopated)
#:   'require_b'  member 2 MUST overhang and member 1 must not (semirhyme)
UNMATCHED = ("exclude", "forbid", "require_a", "require_b")


@dataclass(frozen=True)
class RelationSchema:
    name: str
    spans: tuple                    # (SpanRule, SpanRule)
    align: str = "anchor"
    channels: tuple = ()
    unmatched: str = "exclude"      # one of UNMATCHED, above
    placement: tuple = ()
    identity: tuple = ()
    figure: object = PAIR
    normative: str = "attested"     # required | forbidden | deprecated | attested
    aka: tuple = ()
    traditions: tuple = ()
    requires: tuple = ()
    note: str = ""

    def __post_init__(self):
        # `unmatched` had FOUR implemented values and its own comment named
        # three, one of which -- 'differ' -- is implemented nowhere and
        # declared by none of the 77 schemas (defect P15).  An undeclared value
        # silently took the 'exclude' path, so a typo and a policy read the
        # same.  Refuse at construction, where the declaration is written.
        if self.unmatched not in UNMATCHED:
            raise ValueError(
                f"unmatched must be one of {UNMATCHED}, not "
                f"{self.unmatched!r}. It is a SPAN coordinate over the "
                f"material the alignment left over; a MUST-DIFFER on the "
                f"matched material is a CHANNEL rule (pararhyme states it as "
                f"ChannelRule('nucleus', DIFFER)) and never this field.")

    def capabilities(self):
        need = set(self.requires)
        for r in self.spans:
            need |= set(r.caps())
        for p in self.placement:
            need |= set(p.requires)
        for c in self.channels:
            if c.surface != "phonemic":
                need.add(c.surface)
            # DEFECT P14: the GRAIN a channel is compared at is a capability of
            # the declaration, not a constant of the schema.
            q = getattr(c.predicate, "resource", "")
            if q:
                need.add(QUOTIENT_CAP + q)
        for i in self.identity:
            need.add(_CAP_OF_LEVEL.get(i.level, i.level))
        # M-39: A FRAME IS A CAPABILITY, and until 2026-08-22 this method was
        # the reason one of them was not.  `_frame_key` reads `Unit.stanza`,
        # every unit of an unframed stream carries 0, and a `forall stanza`
        # figure therefore quantified over ONE frame and reported a number
        # rather than refusing.  `line` and `token` are free -- every unit
        # carries both -- and `line_pair` is `line // 2`, which is defined
        # wherever a line index is; `stanza` is the only frame in `_frame_key`
        # with a ground it can be missing.
        if getattr(self.figure, "frame", None) == "stanza":
            need.add("stanza")
        need.discard("token")        # always available: the surface text
        return tuple(sorted(need))


# ---------------------------------------------------------------------------
# 8. THE PRODUCER
# ---------------------------------------------------------------------------


@dataclass
class Instance:
    schema: str
    a: Span
    b: Span
    alignment: Alignment
    reads: tuple                 # ((channel, position, Read), ...)
    verdict: object              # True / False / None
    placement_reads: tuple
    identity_reads: tuple
    search_k: int = 1

    @property
    def informative(self):
        return tuple(c for c, _, r in self.reads if r.informative)

    @property
    def unknown_channels(self):
        return tuple((c, p) for c, p, r in self.reads if r.value is None)

    def describe(self, stream):
        def txt(s):
            return "".join(stream.units[i].syl.text for i in s.idx)
        return (f"{self.schema}: {txt(self.a)!r} ~ {txt(self.b)!r} "
                f"L{stream.units[self.a.head()].line}/"
                f"L{stream.units[self.b.head()].line} -> {self.verdict}")


#: The anchor rules that name a VOWEL (`_anchor_pos` resolves each by
#: scanning prominence, which is a property of the nucleus).  Read by
#: `_cluster_scoped` below and by nothing else; `word_start`/`word_end`/
#: `none`/`searched` anchor an EDGE, not a vowel, and general consonance's
#: whole-line skeleton rides on those.
_VOWEL_ANCHORS = ("last_stressed", "penult_stressed", "final_unstressed")


def _cluster_scoped(channel, rule):
    """Does this sequence read start AT A VOWEL?  (M-148, defect P1.)

    True exactly when the member's own SpanRule keys its anchor on a vowel
    and the channel is the cross-boundary consonant skeleton.  The declared
    sequence then runs FROM that vowel: the anchor syllable's ONSET precedes
    the vowel and is outside it, and the sequence ends with the post-vocalic
    CLUSTER — the schema's own note is the specification (Snorri's
    jörð:fyrðum share 'rð': not 'j…rð', which is what flattening the whole
    anchor syllable read, and not 'rð…m', which is what running to the word
    end would read).  Measured before the guard existed: the skothending
    schema refused 0 of 6 of its own canonical monosyllable pairs
    (fast~lost read [F,S,T] vs [L,S,T]) while `gate~goat` certified the
    drawable pool only because its onsets happen to agree.

    A `word_start`-anchored skeleton (parechesis, the three cynghanedd
    rows) is deliberately outside this predicate: those sequences START at
    the word edge, so the onset is declared material there.
    """
    return (channel == "consonants" and rule is not None
            and rule.anchor in _VOWEL_ANCHORS and rule.direction > 0)


def _post_vocalic(span, stream, chans, surface):
    """The consonant CLUSTER from the anchor vowel: the anchor syllable's
    coda, then across the syllable boundary until the next vowel stops it.

    -> tuple (possibly EMPTY — an open syllable has no cluster, and the
    caller decides what an empty cluster satisfies), or None where any
    contributing channel is unreadable or uncertain (P11's rule, unchanged:
    a skeleton built from one guessed homograph is a skeleton nobody
    declared).
    """
    ap = span.anchor_pos
    if ap >= len(span.idx):
        return None
    out = []
    v = chans.read(stream.units[span.idx[ap]], "coda", stream, surface)
    if v is None or uncertain(v):
        return None
    out.extend(v if isinstance(v, tuple) else [v])
    for i in span.idx[ap + 1:]:
        u = stream.units[i]
        o = chans.read(u, "onset", stream, surface)
        if o is None or uncertain(o):
            return None
        out.extend(o if isinstance(o, tuple) else [o])
        n = chans.read(u, "nucleus", stream, surface)
        if uncertain(n):
            return None
        if n:
            break                    # the next vowel ends the cluster
        c = chans.read(u, "coda", stream, surface)
        if c is None or uncertain(c):
            return None
        out.extend(c if isinstance(c, tuple) else [c])
    return tuple(out)


def _seq(span, stream, channel, chans, surface, rule=None):
    """The span's derived element SEQUENCE for a sequence-scoped channel.

    This is how the Welsh skeleton, the Norse post-vocalic cluster and general
    consonance become computable: the span is still a selection of syllable
    indices, and the channel flattens it into an ordered element stream ACROSS
    the syllable boundary.  A checker keyed on the coda of a maximal-onset
    syllabification reads 'fyr' and 'of' out of jörð:fyrðum and friðrofs:ofsa
    and finds neither.

    `rule` is the MEMBER's own SpanRule, when the caller holds it: a
    vowel-anchored consonant sequence is the post-vocalic cluster and not the
    whole-syllable flatten (M-148 defect P1 — see `_cluster_scoped`).  Passing
    None keeps the flatten, which is every edge-anchored skeleton's correct
    reading and every pre-M-148 caller's behaviour.
    """
    if _cluster_scoped(channel, rule):
        return _post_vocalic(span, stream, chans, surface)
    out = []
    for i in span.idx:
        v = chans.read(stream.units[i], channel, stream, surface)
        if v is None:
            return None
        if uncertain(v):
            # P11: one uncertain element makes the whole derived sequence
            # uncertain, and a sequence predicate has no set algebra to fall
            # back on.  Refuse the SEQUENCE rather than pick a reading -- a
            # Welsh skeleton built from one guessed homograph is a skeleton
            # nobody declared.
            return None
        out.extend(v if isinstance(v, tuple) else [v])
    return tuple(out)


def _positions(scope, span, align, side):
    n = len(span)
    if scope == "each":
        return [p[side] for p in align.pairs]
    if scope == "anchor":
        return [span.anchor_pos] if span.anchor_pos < n else []
    if scope == "post_anchor":
        return [p[side] for p in align.pairs if p[side] > span.anchor_pos]
    if scope == "first":
        return [p[side] for p in align.pairs][:1]
    if scope == "last":
        return [p[side] for p in align.pairs][-1:]
    return []


def evaluate(schema, a, b, stream, chans=DEFAULT_CHANNELS):
    """One candidate span pair -> an Instance, or None if placement excludes it.

    Ternary all the way: a placement rule that cannot decide keeps the pair and
    contributes None; a channel the declaration cannot read contributes None;
    the verdict is tri_and over everything REQUIRED.

    DEFECT P1, fixed.  `required` was declared on ChannelRule and read in
    exactly one place, `_bucket_key`.  Every channel entered `tri_and`, so
    `required=False` -- Snorri's FEGRA, a channel that is REPORTED and not
    ENFORCED -- rejected the pair exactly as a required one did.  The reads are
    still all recorded on the Instance; only the verdict is filtered.
    """
    preads = []
    for p in schema.placement:
        v = p.holds(a, b, stream)
        if v is False:
            return None
        preads.append((p.kind, v))

    align = ALIGNERS[schema.align](a, b, stream)
    reads = []
    enforced = []                    # the subset of `reads` the verdict sees
    for cr in schema.channels:
        mine = []
        # DEFECT P14: a channel compared at a DECLARED GRAIN takes its quotient
        # from the stream.  `realise()` has already refused the schema if the
        # declaration supplies none; a caller reaching `evaluate()` directly
        # gets the predicate's own refusal instead of a verdict at the identity.
        pred = _bind_quotient(cr.predicate, stream)
        if cr.scope == "sequence":
            ra = schema.spans[0] if schema.spans else None
            rb = schema.spans[-1] if schema.spans else None
            xa = _seq(a, stream, cr.channel, chans, cr.surface, rule=ra)
            xb = _seq(b, stream, cr.channel, chans, cr.surface, rule=rb)
            if ((_cluster_scoped(cr.channel, ra) and xa == ())
                    or (_cluster_scoped(cr.channel, rb) and xb == ())):
                # M-148: an OPEN syllable has no post-vocalic cluster, and a
                # cluster relation over zero consonants is vacuously true of
                # any two open syllables — through the 77-schema default door
                # that would satisfy every day~sea pair silently.  False WITH
                # THE REASON, never None: the channel read fine and the
                # material is absent, which is an answer (doctrine 20).
                mine.append((cr.channel, -1, Read(
                    False, True,
                    "no post-vocalic cluster: the anchor syllable is open, "
                    "and a cluster relation over zero consonants would be "
                    "vacuously true of any two open syllables")))
            else:
                mine.append((cr.channel, -1, pred(xa, xb)))
        elif cr.scope in ("unmatched_a", "unmatched_b"):
            side = a if cr.scope.endswith("a") else b
            pos = (align.unmatched_a if cr.scope.endswith("a")
                   else align.unmatched_b)
            for q in pos:
                v = chans.read(stream.units[side.idx[q]], cr.channel, stream,
                               cr.surface)
                mine.append((cr.channel, q, pred(v, v)))
        else:
            pa = _positions(cr.scope, a, align, 0)
            pb = _positions(cr.scope, b, align, 1)
            for qa, qb in zip(pa, pb):
                xa = chans.read(stream.units[a.idx[qa]], cr.channel, stream,
                                cr.surface)
                xb = chans.read(stream.units[b.idx[qb]], cr.channel, stream,
                                cr.surface)
                mine.append((cr.channel, qa, pred(xa, xb)))
        reads.extend(mine)
        if cr.required:
            enforced.extend(mine)

    # unmatched material: EXCLUDE and MUST-DIFFER are different treatments, and
    # the distinction is a SPAN coordinate.  semirhyme excludes its overhang;
    # pararhyme's nucleus requires difference; 'forbid' rejects any overhang.
    ua, ub = bool(align.unmatched_a), bool(align.unmatched_b)
    ohang = None
    if schema.unmatched == "forbid" and (ua or ub):
        ohang = ("__overhang__", -1, Read(False, True, "overhang forbidden"))
    elif schema.unmatched == "require_b":
        # semirhyme: member 2 overhangs member 1 and the overhang is EXCLUDED.
        # Without this the schema also admits the flush case, i.e. it admits
        # ordinary perfect rhyme, which is exactly what it is defined against.
        ohang = ("__overhang__", -1,
                 Read(ub and not ua, True, "overhang required on member 2"))
    elif schema.unmatched == "require_a":
        ohang = ("__overhang__", -1,
                 Read(ua and not ub, True, "overhang required on member 1"))
    if ohang is not None:
        reads.append(ohang)
        enforced.append(ohang)       # a span coordinate, never optional

    ireads = []
    for ir in schema.identity:
        xa, xb = _identity_values(ir, a, stream), _identity_values(ir, b, stream)
        if xa is _NORES or xb is _NORES:
            ireads.append((ir.level, Read(
                None, False, f"no {ir.level} resource declared")))
        else:
            ireads.append((ir.level, ir.predicate(xa, xb)))

    vals = [r.value for _, _, r in enforced if r is not None]
    vals += [r.value for _, r in ireads]
    vals += [v for _, v in preads]
    return Instance(schema.name, a, b, align, tuple(reads), tri_and(vals),
                    tuple(preads), tuple(ireads),
                    search_k=a.search_k * b.search_k)


_NORES = object()


def _span_tokens(span, stream):
    """The span's tokens, in span order, COLLAPSED BY COORDINATE and not by
    text.  Consecutive units of one token are one token; a token that genuinely
    recurs stays in the sequence twice.
    """
    out = []
    for i in span.idx:
        u = stream.units[i]
        k = (u.line, u.token)
        if not out or out[-1][0] != k:
            out.append((k, u))
    return [u for _, u in out]


def _identity_values(ir, span, stream):
    """What an IdentityRule reads off one member.  -> a value, or _NORES.

    DEFECT P5, fixed.  The token level built its key with
    `" ".join(dict.fromkeys(...))`, which deduplicates by STRING.  That
    correctly collapsed the several syllables of one token and incorrectly
    collapsed a REPEATED token, so `'love me love me'` and `'love me'` produced
    the same key and AGREE returned True -- the exact pair a refrain or an
    incremental repetition has to tell apart.

    DEFECT P4, fixed.  The resource branch built a tuple ONE ENTRY PER SYLLABLE,
    so a morpheme root -- a fact about a WORD -- was compared position-wise
    across members of different syllable counts:

        sing ~ singing   ('sing',) vs ('sing','sing')  -> False
        love ~ loving    ('love',) vs ('lov','lov')    -> False

    Both are the same root and both read False.  It now reads once per token.

    Also fixed: the resource KEY-SPACE.  `capabilities()`/`provides()` demand
    the CAPABILITY name (`morphology`, `lexicon`, `sense`) while this branch
    looked up the LEVEL name (`morpheme_root`, ...).  No declaration could
    satisfy both -- `resources={'morphology': fn}` passed the capability check
    and then found nothing; `resources={'morpheme_root': fn}` was refused before
    it got here.  Either key now resolves.
    """
    toks = _span_tokens(span, stream)
    if ir.level == "token":
        return " ".join(u.token_text.lower() for u in toks)
    res = _resources_of(stream)
    if not isinstance(res, dict):
        return _NORES
    fn = res.get(ir.level)
    if fn is None:
        fn = res.get(_CAP_OF_LEVEL.get(ir.level, ir.level))
    if fn is None:
        return _NORES
    return tuple(fn(u) for u in toks)


#: level -> the capability name `provides()` checks for.  One table, read by
#: RelationSchema.capabilities() and by the identity reader, so the two cannot
#: drift apart again.
_CAP_OF_LEVEL = {
    "token": "token", "lexeme": "lexicon", "lexeme_sequence": "lexicon",
    "lexeme_family": "morphology", "morpheme_root": "morphology",
    "morpheme_affix": "morphology", "sense": "sense",
}


def _bucket_key(schema, span, stream, chans, rule=None):
    """A cheap key from the schema's OWN first required AGREE channel, so the
    cross product is not |candidates|^2 over a whole song.

    An UNKNOWN value returns None, which the producer treats as a WILDCARD --
    joined against every bucket.  An index built on nuclei would otherwise
    delete exactly the pairs fas refuses on, which is 60.2% of real Hafez
    rhyme pairs and precisely the candidate rhymes.

    `rule` is the SpanRule that produced `span`, threaded so a sequence key
    is computed by the SAME read `evaluate()` will make (M-148): an index
    keyed on the whole-syllable flatten while the verdict reads the
    post-vocalic cluster would prune fast~lost into different buckets and
    the repaired judge would never see the pair.
    """
    key = []
    for cr in schema.channels:
        if not isinstance(cr.predicate, Agree) or not cr.required:
            continue
        if cr.surface != "phonemic":
            continue
        if cr.scope not in ("anchor", "each", "last", "sequence"):
            # 'post_anchor' and 'first' are NOT the position the alignment makes
            # correspond, and perfect rhyme's onset rule is MUST-DIFFER at the
            # anchor -- keying on either sends every real pair to a different
            # bucket and returns zero. Only anchor-corresponding AGREE channels
            # may narrow the search.
            continue
        if cr.scope == "sequence":
            v = _seq(span, stream, cr.channel, chans, cr.surface, rule=rule)
        else:
            pos = span.anchor_pos if cr.scope in ("anchor", "each") else \
                (len(span) - 1 if cr.scope == "last" else 0)
            if pos >= len(span):
                return None
            v = chans.read(stream.units[span.idx[pos]], cr.channel, stream,
                           cr.surface)
        if v is None or uncertain(v):
            # WILDCARD: never prune an unknown, and an UNCERTAIN read is an
            # unknown for indexing purposes.  Bucketing a homograph on one of
            # its readings would delete exactly the pairs P11 is about --
            # the same failure the Persian note above describes, arriving
            # from the homograph side instead of the script side.
            return None
        key.append((cr.channel, v))
    return tuple(key) or None


def _frame_key(schema, span, stream):
    """Frame-local figures never leave their frame, so the cross product is
    taken inside it.  This is what keeps a song-length stream tractable."""
    fr = schema.figure.frame
    u = stream.units[span.head()]
    if fr == "line":
        return u.line
    if fr == "token":
        return (u.line, u.token)
    if fr == "line_pair":
        return u.line // 2
    if fr == "stanza":
        return u.stanza
    for p in schema.placement:
        if p.kind == "same_line" and p.polarity:
            return u.line
        if p.kind in ("adjacent_lines", "across_line_break") and p.polarity:
            return None
    return None


def mirrored(a, b, a_keys, b_keys):
    """Is the (b, a) spelling of this pair ALSO a candidate of this schema?

    THE TEXT-ORDER CONVENTION, WHICH USED TO BE A SILENT FILTER (2026-08-11).

    `realise()` skipped every pair whose A-member started after its B-member,
    on the stated ground that "members are in TEXT ORDER".  On a SYMMETRIC
    schema -- `spans[0] == spans[1]`, 60 of the 77 shipped -- that is exact
    de-duplication: A and B are the same list, so (b, a) is enumerated too and
    one of the two orderings has to go.  On an ASYMMETRIC schema the two
    members come from DIFFERENT rules, so (b, a) is generally NOT enumerated
    and the skip DELETED the instance instead of canonicalising it.

    Measured on `metidja.txt` (16 non-blank lines, `eng`, 48 of the 77
    schemas realising): the rule drops 14,254 candidate pairs whose mirror is
    a candidate, and RECOVERS 114 instances the positional rule deleted.

    THE POPULATION MOVED ON 2026-08-22 AND THESE NUMBERS ARE NOT RE-DERIVED
    (M-39, doctrine 58).  `metidja.txt` prints no blank line, so it supplies
    no stanza ground and the five `frame="stanza"` schemas now refuse on it:
    ~~48~~ **46** of the 77 realise there.  The 14,254 was summed over the
    larger population and is left at its measured value with its date and its
    coordinate stated, rather than replaced by a number this docstring would
    then be the only record of.  What is UNAFFECTED is the finding itself:
    all five of those schemas are SYMMETRIC (`spans[0] == spans[1]`), and the
    114 recovered instances fall entirely on ASYMMETRIC schemas, so neither
    the 114, nor the four schemas carrying them, nor `mosaic rhyme`'s 69 is
    touched by the five leaving.  All
    114 fall on 4 ASYMMETRIC schemas and NONE on any of the 60 symmetric
    ones, which is the separation this function makes mechanical.  72 of the
    114 carry a TRUE verdict, and `mosaic rhyme` alone accounts for 69 of
    them -- its entire recovered set, not a sample of it: every instance the
    positional rule deleted from that schema on this text was a real rhyme,
    lost because the multi-word run that carried it happened to print second.
    So the convention was not a naming decision: it made an asymmetric
    schema's recall a function of which member the text prints first.  The
    two counts sit on DIFFERENT denominators -- candidates and instances --
    and `order_burden`'s key names say which.

    The rule that replaces it drops a reversed pair only where the mirror is
    genuinely available, so de-duplication is preserved everywhere it was ever
    doing that job and nothing else is thrown away.  Symmetric schemas are
    byte-identical before and after, which is what keeps every count in this
    repo that was taken over them.

    NOT closed by this: whether a schema's two members may be the SAME TOKEN.
    The three `cynghanedd lusg` pairs recovered here are one word against its
    own penult and all read False; excluding them is a job for a declared
    `IdentityRule`, not for an ordering rule doing it by accident.
    """
    return b.idx in a_keys and a.idx in b_keys


def order_burden(schema, stream, chans=DEFAULT_CHANNELS):
    """What the text-order convention costs this schema, in INSTANCES.

    The sibling of `search_burden` (doctrine 56) for a different silent loss.
    -> {'symmetric', 'instances', 'deduplicated_candidates',
        'recovered_instances', 'recovered_true'}

    It runs `realise()` rather than re-deriving the loop, and reads the tally
    `realise()` keeps.  Counting the raw A x B cross product instead would be
    a different denominator dressed as the same one: it skips the frame and
    bucket join, so it reports candidate pairs where the schema reports
    instances, and the two differ by two orders of magnitude on `mosaic
    rhyme` -- 9,044 against 15.  Adversary 7: the number, the label and the
    evidence have to name the same thing.

    TWO LEVELS, AND THEY ARE NOT THE SAME DENOMINATOR.
    `deduplicated_candidates` is candidate pairs, counted before evaluation,
    because a de-duplicated pair is never evaluated and there is no instance
    to count.  `recovered_instances` is INSTANCES, counted after evaluation.
    On `metidja.txt` they read 14,254 and 114, and dividing one by the other
    would mean nothing.

    `recovered_instances` is what the pre-2026-08-11 positional rule DELETED
    and this one keeps; `recovered_true` is how many of those carry a TRUE
    verdict.  A nonzero `recovered_true` means every count taken from that
    schema before that date is LOW, and says by how much.
    """
    t = {}
    out = realise(schema, stream, chans, keep="all", tally=t)
    base = {"symmetric": schema.spans[0] == schema.spans[1],
            "deduplicated_candidates": t.get("deduplicated_candidates", 0),
            "recovered_instances": t.get("recovered_instances", 0),
            "recovered_true": t.get("recovered_true", 0)}
    if isinstance(out, Refusal):
        # `refused` keeps its old single-name value so stored counts stay
        # comparable; `refused_all` is the complete set beside it. Two keys
        # rather than one widened key, for the reason `Refusal` gives.
        return dict(base, instances=0, refused=out.capability,
                    refused_all=out.missing)
    return dict(base, instances=len(out))


def realise(schema, stream, chans=DEFAULT_CHANNELS, max_pairs=2_000_000,
            keep=("true", "none"), tally=None):
    """Find every instance of `schema` in the song.  -> [Instance] or Refusal.

    THE ALGORITHM
      1. capability check.  A missing capability is a Refusal naming EVERY
         capability the stream did not supply, on `.missing`, not just the
         first one to fail.
      2. enumerate candidate spans per member from the member's OWN SpanRule.
      3. bucket by (frame, schema's first AGREE channel).  Unknown keys are
         wildcards and join everything.
      4. for each candidate pair, DE-DUPLICATED by `mirrored()` rather than
         filtered on text order: placement -> align -> channels -> ternary
         verdict.

    THERE IS NO STEP 5 HERE, and this docstring used to claim one: "figures
    beyond the pair are assembled from the surviving edges".  They are not --
    `assemble()` is a SEPARATE call over this function's output, and the only
    non-test caller in the repo is `quality/relations_null.py`, which makes it
    only for the `line_fraction` statistic.  `relation_report()` -- this
    module's own honest consumer, and what the CLI prints -- never calls it,
    so every figure-quantified schema (monorhyme/leash, higaad, paroemion, the
    Kalevala's exists_k) is reported there as pairwise EDGES and never as the
    figure it declares.  Stated rather than wired: the report's shape is a
    separate decision from this function's, and a docstring that describes a
    step the code does not take is the defect this paragraph closes.

    `keep` defaults to True and None instances.  Pass keep="all" for the
    negative cases: doctrine 27 -- a chance draw that FAILS the filter scores
    minus infinity and belongs in the DENOMINATOR, not out of the sample. The
    first family-wise correction in this repo dropped exactly those and got 0%
    saturation on every corpus.
    """
    # THE WHOLE SET, not the first name.  This loop used to `return` inside the
    # `for`, so the answer was whichever missing capability sorted first and a
    # schema needing two reported one.  See `Refusal` for the measurement; the
    # cost of completeness is one extra `provides()` call per satisfied
    # capability on a refusing schema, and `provides()` is a dict lookup.
    sup = {c: stream.supply(c) for c in schema.capabilities()}
    miss = tuple(c for c in schema.capabilities()
                 if sup[c].state != "present")
    if miss:
        lang = stream.declaration.get("language", "?")
        # THE VACUOUS SUBSET, SEPARATED.  A frame whose source a caller
        # declared and whose population is zero is NOT the same gap as one
        # nobody declared, and the two have opposite remedies: the first is
        # answered by declaring a source, the second by nothing a declaration
        # can do -- the text does not carry the thing.  Before this split the
        # second state did not refuse at all; it ran over zero loci and
        # reported a zero (doctrine 20, and `Supply` carries the measurement).
        vac = tuple(c for c in miss if sup[c].state == "empty")
        kind = "vacuous_frame" if len(vac) == len(miss) else "capability"
        head = (f"{schema.name} needs {miss[0]!r}" if len(miss) == 1 else
                f"{schema.name} needs {len(miss)} capabilities this "
                f"declaration does not supply: "
                f"{', '.join(repr(c) for c in miss)}")
        if vac:
            why = "; ".join(
                f"{c!r} was DECLARED (source {sup[c].source!r}) and is EMPTY "
                f"— 0 {sup[c].detail}" for c in vac)
            detail = (
                f"{head}. {why}. An empty declared frame is not a capability "
                f"nobody declared and it is not a null: every span rule that "
                f"reads it enumerates zero loci, so this schema could only "
                f"have returned an empty list. Refused rather than reported "
                f"as 0 (doctrine 20). The remedy is not to declare a source — "
                f"one IS declared and it came back empty; it is a text, an "
                f"edition or a mark inventory that carries the thing.")
        else:
            detail = (
                f"{head}; this declaration ({lang}) does not supply "
                f"{'it' if len(miss) == 1 else 'them'}. Refused rather "
                f"than asserted. Every missing name is on `.missing` — "
                f"declaring only the first would not make this schema run.")
        return Refusal(schema.name, miss[0], detail, missing=miss, kind=kind,
                       vacuous=vac)
    try:
        A = list(enumerate_spans(schema.spans[0], stream))
        B = (A if schema.spans[0] == schema.spans[1]
             else list(enumerate_spans(schema.spans[1], stream)))
    except NoReferent as e:
        # NOT a capability refusal: `missing` stays empty and `.complete` is
        # False, because the span rule found no referent in a declaration that
        # supplied everything the schema asked for.  `kind` says so by name,
        # so a consumer separating the gates does not have to infer it from an
        # empty `missing`.
        return Refusal(schema.name, "span", str(e), kind="span")
    a_keys = {s.idx for s in A}
    b_keys = a_keys if B is A else {s.idx for s in B}

    idx = {}
    for s in B:
        idx.setdefault((_frame_key(schema, s, stream),
                        _bucket_key(schema, s, stream, chans,
                                    rule=schema.spans[1])), []).append(s)
    wild = {}
    for (f, k), v in idx.items():
        if k is None:
            wild.setdefault(f, []).extend(v)

    out, seen, n = [], set(), 0
    for a in A:
        fk = _frame_key(schema, a, stream)
        ka = _bucket_key(schema, a, stream, chans, rule=schema.spans[0])
        cands = []
        if ka is None:
            for (f, k), v in idx.items():
                if fk is None or f is None or f == fk:
                    cands.extend(v)
        else:
            cands.extend(idx.get((fk, ka), []))
            if fk is not None:
                cands.extend(idx.get((None, ka), []))
            cands.extend(wild.get(fk, []))
            if fk is not None:
                cands.extend(wild.get(None, []))
        for b in cands:
            if a.idx == b.idx or (a.idx, b.idx) in seen:
                continue
            seen.add((a.idx, b.idx))
            reversed_pair = a.head() > b.head()
            if reversed_pair and mirrored(a, b, a_keys, b_keys):
                # CANDIDATE level: a de-duplicated pair is never evaluated, so
                # this count and `recovered_instances` below sit on different
                # denominators and must never be compared or summed. The key
                # names say which, because a number whose label outruns its
                # evidence is adversary 7's whole remit.
                if tally is not None:
                    tally["deduplicated_candidates"] = (
                        tally.get("deduplicated_candidates", 0) + 1)
                continue         # the mirror carries it; see mirrored()
            n += 1
            if n > max_pairs:
                raise RuntimeError("candidate explosion; tighten the schema")
            inst = evaluate(schema, a, b, stream, chans)
            if inst is None:
                continue
            if reversed_pair and tally is not None:      # INSTANCE level
                tally["recovered_instances"] = (
                    tally.get("recovered_instances", 0) + 1)
                if inst.verdict is True:
                    tally["recovered_true"] = tally.get("recovered_true", 0) + 1
            tag = {True: "true", False: "false", None: "none"}[inst.verdict]
            if keep == "all" or tag in keep:
                out.append(inst)
    return out


def _forall_population(schema, frame, stream):
    """Which LINES the `forall` quantifier has to cover in this frame.

    Every line that supplies a member span for this schema.  A line the span
    rule cannot find a member in is not a line the figure failed on -- it is a
    line the figure does not reach -- so it is not in the denominator.
    """
    pop = set()
    for rule in schema.spans:
        try:
            for sp in enumerate_spans(rule, stream):
                if _frame_key(schema, sp, stream) == frame:
                    pop.add(stream.units[sp.head()].line)
        except NoReferent:
            continue
    return pop


def _components(es):
    """Connected components of the edge set, keyed on span index tuples."""
    parent = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for e in es:
        ra, rb = find(e.a.idx), find(e.b.idx)
        if ra != rb:
            parent[ra] = rb
    groups = {}
    for e in es:
        groups.setdefault(find(e.a.idx), []).append(e)
    return list(groups.values())


def assemble(schema, edges, stream):
    """Figures beyond the pair.  Edges are grouped into the declared shape and
    the member-selection quantifier is applied over the declared frame.

    -> [(frame, edges, verdict)].  The verdict is tri_and over the edges the
    finding rests on, so a figure assembled entirely out of undecided pairs
    reports None rather than presenting itself as found.

    exists_k   Kalevala: >= 2 words in the line sharing an initial
    fraction   paroemion / repetend: a count AND a declared fraction
    forall     higaad: every line against ONE representative for a whole poem

    DEFECT P3, fixed.  `forall` appended every frame unconditionally and the
    finding carried no verdict, so it asserted nothing and tested nothing.
    Measured on `cat/hat/moon/tune` under `monorhyme / leash`: two edges, two
    DIFFERENT rhyme sounds, one 'monorhyme' finding.  Monorhyme means ONE sound
    running through the frame, so a forall finding now requires (a) the
    surviving edges to form a SINGLE connected component -- one representative,
    which is what the docstring above always said -- and (b) that component to
    cover every line in the frame the span rule reaches.
    """
    fig = schema.figure
    by = {}
    for e in edges:
        if e.verdict is False:
            continue
        by.setdefault(_frame_key(schema, e.a, stream), []).append(e)
    out = []
    for frame, es in sorted(by.items(), key=lambda kv: (kv[0] is None, kv[0])):
        def emit(group):
            out.append((frame, group, tri_and([e.verdict for e in group])))
        if fig.quantifier == "exists":
            for e in es:
                emit([e])
        elif fig.quantifier == "exists_k":
            nodes = {e.a.idx for e in es} | {e.b.idx for e in es}
            if len(nodes) >= fig.k:
                emit(es)
        elif fig.quantifier == "fraction":
            li = frame if isinstance(frame, int) else None
            tot = (len({stream.units[i].token for i in stream.lines[li]})
                   if li is not None and li < len(stream.lines) else 0)
            nodes = {e.a.idx for e in es} | {e.b.idx for e in es}
            if tot and len(nodes) / tot >= (fig.fraction or 1.0):
                emit(es)
        elif fig.quantifier == "forall":
            comps = _components(es)
            if len(comps) != 1:
                continue                     # more than one representative
            group = comps[0]
            covered = {stream.units[e.a.head()].line for e in group} | \
                      {stream.units[e.b.head()].line for e in group}
            if _forall_population(schema, frame, stream) - covered:
                continue                     # a line in the frame is left out
            emit(group)
    return out


# ---------------------------------------------------------------------------
# 9. DERIVED FRAMES -- the miscounted case, computed
# ---------------------------------------------------------------------------


def mark_refrain_tail(stream, min_count=2, min_fraction=0.6, lines=None):
    """Find the shared trailing token run across lines and write it into
    `frames.refrain_tail`.  Doctrine 58: a bare n-of-N is a threshold nobody
    wrote down, so BOTH parameters are arguments and both are recorded.

    THIS IS THE MISCOUNTED CASE.  The radif sits AFTER the qāfiya, so in a
    radif line THE LINE'S TAIL IS THE REFRAIN and the rhyme sits BEFORE it.
    Suffix alignment grabs the epistrophe and calls it the rhyme.  English
    hymnody has the identical configuration ('...of the Lord' repeated, the
    rhyme on the word before).  With this run first, the qāfiya schema's locus
    'line_final_before_refrain' points at the right material -- and it is
    COMPUTED from the song, not declared by the caller.

    THE FRACTION NEEDS ITS FRAME.  Run over a whole ghazal with lines=None and
    the answer is ALWAYS zero: only the second hemistich of each bayt carries
    the rhyme (both do in the maṭlaʿ -- taṣrīʿ), so a fraction taken over ALL
    lines cannot reach any threshold.  `lines` is the declared rhyme-bearing
    subset AS LINE INDICES into `stream.lines`; for Persian that convention is
    `[0] + list(range(1, n_lines, 2))`.  The same applies to an English hymn
    whose refrain is every fourth line.

    THE CALL THIS DOCSTRING USED TO NAME COULD NOT WORK, AND FAILED SILENTLY.
    It said the subset "is exactly `fas.ghazal_rhyme_lines()`" -- and
    `quality/phonology/fas.py`'s `ghazal_rhyme_lines(hemistichs)` returns the
    hemistich TEXTS (`[h[0]] + h[1::2]`), not their indices.  A set of strings
    tested against an integer line index matches nothing, so the one call the
    documentation named returned None on 495 of 495 Hafez ghazals with no
    error, `refrain_source` was set to 'computed' anyway, and `epistrophe /
    radif` and `qafiya (before the radif)` went from REFUSED to a measured
    ZERO -- doctrine 20's collapse, manufactured by an argument type.  With the
    INDICES it fires on 66 of the 495 (`corpus/fas_hafez.json`, ghazal 1's
    radif `ها` over 6 lines, ghazal 2's `کجا` over 9, ghazal 3 and 4's `را`),
    and `epistrophe / radif` returns 15/36/45/36 instances on those four.  The
    argument is CHECKED below rather than left to a reader, because a
    principle that lives only in prose gets followed exactly as often as
    someone remembers it (doctrine 48) and nothing had ever run this line.
    """
    if lines is not None:
        wrong = [l for l in lines if isinstance(l, bool)
                 or not isinstance(l, int)]
        if wrong:
            raise NoReferent(
                f"`lines` is the rhyme-bearing subset as LINE INDICES into "
                f"stream.lines; got {len(wrong)} element(s) that are not "
                f"indices, first {wrong[0]!r}. `fas.ghazal_rhyme_lines()` "
                f"returns hemistich TEXTS and matches no line at all -- use "
                f"[0] + list(range(1, len(stream.lines), 2)) for the same "
                f"Persian convention.")
    keep = None if lines is None else set(lines)
    tails = {}
    for li, ids in enumerate(stream.lines):
        if not ids or (keep is not None and li not in keep):
            continue
        seq, t = [], None
        for i in reversed(ids):
            u = stream.units[i]
            if t is None or u.token != t:
                seq.append(u.token_text.lower())
                t = u.token
        tails[li] = tuple(seq)                    # reversed token sequence
    best, n = None, len([t for t in tails.values() if t])
    for depth in range(1, 8):
        counts = {}
        for li, t in tails.items():
            if len(t) >= depth:
                counts.setdefault(t[:depth], []).append(li)
        for run, ls in counts.items():
            if len(ls) >= min_count and n and len(ls) / n >= min_fraction:
                best = (depth, run, ls)
    if best is None:
        # THE SOURCE IS STILL SET, AND THE RETURN IS NO LONGER `None`.
        # Deleting the source on a null result would make "the shared-tail
        # search ran and there is no shared tail" indistinguishable from "the
        # search was never run" -- doctrine 20 pointed at this function
        # instead of at its consumers, and one collapse traded for another.
        # What was wrong was the SILENCE: `None` back to the caller and a
        # `provides()` that read the source alone, so `epistrophe / radif`
        # and `qafiya (before the radif)` ran over zero loci and reported a
        # measured zero.  Both halves are answered here -- the caller gets a
        # summary carrying `found: 0`, and `Stream.supply('refrain_tail')`
        # reads the POPULATION and returns state `'empty'`.
        stream.frames.refrain_source = "computed"
        return {"depth": 0, "run": (), "lines": [], "found": 0,
                "candidates": n, "min_count": min_count,
                "min_fraction": min_fraction}
    depth, run, ls = best
    for li in ls:
        ids = stream.lines[li]
        toks, t = [], None
        for i in reversed(ids):
            u = stream.units[i]
            if t is None or u.token != t:
                toks.append(u.token)
                t = u.token
        start_tok = toks[depth - 1]
        stream.frames.refrain_tail[li] = min(
            i for i in ids if stream.units[i].token == start_tok)
    stream.frames.refrain_source = "computed"
    return {"depth": depth, "run": tuple(reversed(run)), "lines": ls,
            "found": len(ls), "candidates": n,
            "min_count": min_count, "min_fraction": min_fraction}


def search_caesura(stream):
    """Doctrine 55/56.  Either PRINTED, DECLARED, or SEARCHED -- and the caller
    has to say which.

    EVERY word boundary is kept as a candidate rather than one being chosen by
    a scorer, and the same search run over lines whose words are shuffled
    WITHIN THE LINE still reports cynghanedd on about a quarter of them -- so a
    bare rate obtained by search is quoting the null back at itself, and only
    the EXCESS over a matched control is attributable to the poet.
    `Span.search_k` and `Instance.search_k` carry k so that control can be
    built.

    THIS FUNCTION'S k IS 4.0, NOT 10.6, AND THE 10.6 WAS ANOTHER MODULE'S.
    This docstring read "k averaged 10.6 hypotheses per line on a real Welsh
    corpus" from the day it was written, and nothing had ever run it.
    MEASURED 2026-08-13 on `corpus/cym_alun_strict.txt` -- the same 1,558-line
    edition METHOD doctrine 56 quotes 10.6 against -- this returns
    **mean_k 4.02** over 1,558 lines.  The 10.6 is `quality/phonology/cym.py`'s
    `cynghanedd_scan(...)["positions_tried"]`, printed by
    `quality/cynghanedd_rate.py` as `mean placements tried = 10.6`, and it
    reproduces exactly (10.62).  The gap is not a discrepancy, it is a
    DIFFERENT SEARCH: the Welsh scanner tries the (n-1) two-part cuts AND the
    C(n-1, 2) three-part cuts a `sain` reading needs, while this function
    enumerates the two-part cuts alone, because `half_line_a`/`half_line_b` is
    the only caesura locus in this registry and a three-part frame does not
    exist here.  The identity holds on the text: mean over lines of
    `k + C(k, 2)` is 10.70 against the scanner's 10.62, the residue being the
    two modules' tokenisers.  So a null built on THIS k under-corrects any
    three-part rule by a factor of ~2.6, and doctrine 58 is why the number is
    now stated with the file it was measured on and the command that prints
    the other one.

    AND `search_burden()`'s mean_k IS A THIRD STATISTIC, not this one.  It
    averages over MEMBER SPANS, of which each line contributes 2k (one per
    half), so it is the size-biased mean sum(k^2)/sum(k) and reads HIGHER:
    4.99 against this function's 4.10 on `corpus/cym_twm_or_nant_cywydd.txt`,
    on the identical stream.  Two denominators, never a ratio (doctrine 79/91).
    """
    ks = []
    for li, ids in enumerate(stream.lines):
        if len(ids) < 2:
            continue
        cands = tuple(i for i in ids[1:] if stream.units[i].word_initial)
        if cands:
            stream.frames.caesura[li] = cands
            ks.append(len(cands))
    stream.frames.caesura_source = "searched"
    # `found` is the same key the other two markers report, so a caller can
    # ask any of the three "how many lines did you mark" without knowing which
    # instrument it is holding.  Zero here is the vacuous frame again: a text
    # of one-word lines offers no boundary to cut at.
    return {"lines": len(ks), "found": len(ks),
            "mean_k": sum(ks) / len(ks) if ks else 0.0,
            "note": "report the EXCESS over a null run under this same search"}


def mark_printed_caesura(stream, marks=("/", "|")):
    """A PRINTED caesura only. Punctuation is not metre: `cynghanedd()` split
    on `[,/|]`, so an editorial COMMA chose which rule each line was tested
    against on 1,558 lines.

    `marks` is a SEQUENCE OF MARKS and each may be more than one character; a
    bare string still works and is iterated per character, which is what the
    old `"/|"` default meant.  THE DEFAULT IS TWO OF DOCTRINE 55's THREE, ON
    PURPOSE, and the omission is the whole reason this note exists: doctrine 55
    names the caesura as PRINTED `/`, `|`, **or the gwant `--`**, and
    `quality/phonology/cym.py`'s own `CAESURA_RE` carries all three.  This
    default carries only the two that mean a caesura in every language a
    stream can be built for -- `--` is an em-dash in English, and reading
    ordinary punctuation as structure is the exact defect doctrine 55 was
    written about.  MEASURED 2026-08-13, so the cost of the omission is not
    left implicit: on `corpus/cym_alun_strict.txt` the default marks **0 of
    1,558 lines** while 228 of them print the gwant, and
    `marks=("--", "/", "|")` marks **100** (the other 128 print it line-final,
    where no unit follows it -- the same trailing-dash case `cym._marked_parts`
    drops).  A Welsh caller has to declare the gwant; before 2026-08-13 the
    parameter's documented string form could not even express it, since
    `"--/|"` iterates to a single `-` and would fire on every hyphenated
    compound in a language that JOINS on the hyphen (doctrine 65).

    THE RETURN IS A SUMMARY, NOT `stream.frames`.  It used to hand back the
    caller's own mutable object, which says nothing: the ONE number a caller
    needs from a marker is how many lines it marked, and on English that
    number is ZERO while `caesura_source` reads `'printed'`.  The source is
    still set on a null run, deliberately -- see `mark_refrain_tail` for the
    argument, which is the same one -- and `Stream.supply('caesura')` reads
    the population, so the six schemas that ride the caesura and the refrain
    now refuse with `kind='vacuous_frame'` instead of returning `[]`.
    """
    if isinstance(marks, str):
        marks = tuple(marks)
    scanned = 0
    for li, raw in enumerate(stream.text_lines):
        if li < len(stream.lines) and stream.lines[li]:
            scanned += 1
        pos = min((raw.find(m) for m in marks if m in raw), default=-1)
        if pos < 0:
            continue
        before = len(tokenise(raw[:pos]))
        for i in stream.lines[li]:
            if stream.units[i].token >= before:
                stream.frames.caesura[li] = i
                break
    stream.frames.caesura_source = "printed"
    return {"marks": tuple(marks), "found": len(stream.frames.caesura),
            "lines": scanned, "source": "printed"}


# ---------------------------------------------------------------------------
# 9a. THE ORTHOGRAPHIC SURFACE -- an ALT_SURFACE a caller can actually declare
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _Spelling:
    """One position of a spelling surface, duck-typed as a `Syllable`.

    Only `text` is ever populated, because the rime rule this surface is
    projected through decomposes a WORD and not a syllable.  The three
    phonemic fields are the empty/None a channel reader expects, so reading
    `nucleus` here is None -- unknown -- and not a claim, and reading `onset`
    is the empty cluster rather than a crash.
    """
    text: object = None
    onset: tuple = ()
    nucleus: object = None
    coda: tuple = ()
    prominence: object = None
    moras: object = None


class _SpellingSurface:
    """The `phon` of a projected surface.  It syllabifies NOTHING.

    `declare_orthography` does not re-read the text: it re-labels the
    segmentation the primary declaration already made, which is the only way
    `_project` can align (defect P7 -- a second declaration that re-tokenises
    projects to None at every position, and then every read on the surface is
    None while `provides()` says True).  A phonology object that pretended it
    could syllabify would be an entrance to exactly that.
    """

    def __init__(self, rime, language):
        self.rime = rime
        self.language = language

    def syllabify(self, word):
        raise NoReferent(
            "the orthographic surface is PROJECTED from the phonemic "
            "segmentation, not syllabified independently; build the primary "
            "stream first and call declare_orthography() on it")


#: HOW MANY LIFTS A HALF-LINE CARRIES. A CONVENTION OF THE VERSE FORM, and
#: labelled one for the same reason `grid.FormConvention` and
#: `Meter.conventional_grouping` are: the Germanic alliterative long line is
#: conventionally two lifts per half-line and four per line, and a tradition
#: may answer differently. It is a PARAMETER, so a caller who knows their
#: form states it rather than inheriting a fiat (doctrine 58 — a bare n is a
#: threshold nobody wrote down).
LIFTS_PER_HALF_LINE = 2
HALVES_PER_LINE = 2


def _beat_from_grid(stream, grid):
    """-> {line: (unit index, ...)} from a `declared_inputs.BeatGrid`.

    A unit is ON THE BEAT when its declared pulse position is one of the
    cycle's GROUP HEADS. The grouping is `grid.cycle`'s and R5 already
    refuses to construct without one, so nothing is assumed here.

    A UNIT THE GRID DOES NOT PLACE IS NOT ON THE BEAT AND IS NOT GUESSED —
    it simply does not appear in the returned set, which is the same answer
    `fit._read_beatgrid` gives it (`BEATGRID_INCOMPLETE`: "a partial map
    answers for the units it holds and refuses for the rest; it is not
    filled in").
    """
    from fractions import Fraction
    cyc = grid.cycle
    heads = None
    for attr in ("pulse_groups", "groups"):
        fn = getattr(cyc, attr, None)
        got = fn() if callable(fn) else fn
        if got:
            heads, acc = set(), 0
            for g in got:
                heads.add(Fraction(acc))
                acc += g
            break
    if not heads:
        raise NoReferent(
            "the BeatGrid's cycle declares no GROUPING, so which pulses are "
            "beats is undetermined — `meter.pulse_groups()` returns None "
            "rather than asserting one of the 2^(n-1) compositions, and this "
            "refuses for the same reason (doctrine 19).")
    per = getattr(grid, "positions", None) or {}
    npulse = Fraction(getattr(cyc, "pulses", 0) or 0)
    out = {}
    for key, val in per.items():
        try:
            ln, ui = (key if isinstance(key, tuple) and len(key) == 2
                      else (None, key))
            ln, ui = int(ln), int(ui)
        except (TypeError, ValueError):
            continue
        v = Fraction(val)
        # THE POSITION IS FROM THE CYCLE ORIGIN, so it is reduced INTO the
        # cycle before being asked whether it is a head — a syllable in bar
        # three on the downbeat is on a head exactly as one in bar one is.
        if npulse:
            v = v % npulse
        if v in heads:
            out.setdefault(ln, []).append(ui)
    return {ln: tuple(sorted(v)) for ln, v in out.items()}


def declare_beat(stream, mapping):
    """Declare WHERE THE BEATS FALL. -> dict. `{line: (unit index, ...)}`.

    THE UNITS LISTED ARE THE ON-BEAT ONES; everything else in the line is off
    the beat. `offbeat internal rhyme` is the one schema that reads this, and
    it is defined by a rhyme landing where the pulse does NOT.

    DOCTRINE 4 IS NOT BEING LIFTED HERE. Its own sentence, quoted in that
    schema's note, is "no beat grid without audio OR A DECLARED TEMPO" — it
    refuses an INFERRED grid, and this is a stated one. Nothing in this
    function looks at a meter, a syllable count or a line length; a caller who
    declares nothing gets `frames.beat is None`, `supply('beat')` absent and
    the schema refusing, byte for byte as before.

    WHERE A WRITER GETS THE NUMBERS: they know the tune. `quality/fit.py`
    already places every blueprint line in a bar and on a beat, so a song with
    a blueprint has stated this once already — this is the seam that carries
    it into the relation layer.
    """
    # A `declared_inputs.BeatGrid` IS ACCEPTED DIRECTLY, and that is the
    # seam this constructor should have used from the start (2026-08-23).
    # R5 already exists, already maps `(line, syllable) -> Fraction pulses`,
    # already requires its `Cycle` to declare a GROUPING (because which
    # pulses are beats is exactly what a composition of the pulse count
    # declares), and already carries `derived_from` — audio / notation /
    # asserted — which is the provenance any verdict resting on it must
    # stamp. `quality/fit.py._read_beatgrid` reads the same object and
    # computes `v in heads` per unit, i.e. THIS SET, for its
    # PROMINENCE_OFF_HEAD finding. Taking a raw dict here and nothing else
    # would have made a writer declare the same grid twice for two layers,
    # which is the drift doctrine 1 exists to stop.
    if hasattr(mapping, "positions") and hasattr(mapping, "cycle"):
        mapping = _beat_from_grid(stream, mapping)
    if not isinstance(mapping, dict):
        raise NoReferent(
            f"`mapping` is {{line: (unit index, ...)}} naming the ON-BEAT "
            f"units, or a `declared_inputs.BeatGrid`, got "
            f"{type(mapping).__name__}.")
    n = len(stream.lines)
    grid = {}
    for ln, idx in mapping.items():
        ln = int(ln)
        if not (0 <= ln < n):
            raise NoReferent(f"line {ln} is outside this stream's {n} lines.")
        grid[ln] = tuple(int(i) for i in idx)
    stream.frames.beat = grid or None
    stream.frames.beat_source = "declared" if grid else "none"
    return {"lines": len(grid), "found": len(grid),
            "source": stream.frames.beat_source}


def declare_lifts(stream, mapping, source="declared"):
    """Declare the lift map directly. -> dict. `{line: (unit index, ...)}`.

    For a caller who has SCANNED the verse — by hand, from an edition, or with
    an instrument this repo does not ship. Nothing is inferred and nothing is
    checked against prominence: a declared scansion is the caller's claim and
    overriding it with a derivation would be the checker outranking the
    declaration (doctrine 1).
    """
    if not isinstance(mapping, dict):
        raise NoReferent(
            f"`mapping` is {{line: (unit index, ...)}}, got "
            f"{type(mapping).__name__}.")
    n = len(stream.lines)
    out = {}
    for ln, idx in mapping.items():
        ln = int(ln)
        if not (0 <= ln < n):
            raise NoReferent(f"line {ln} is outside this stream's {n} lines.")
        out[ln] = tuple(int(i) for i in idx)
    stream.frames.lifts = out
    stream.frames.lift_source = source if out else "none"
    return {"lines": len(out), "found": len(out), "source": source}


def search_lifts(stream, per_half_line=LIFTS_PER_HALF_LINE,
                 halves=HALVES_PER_LINE):
    """Derive a lift map from PROMINENCE. -> dict, and it writes the frame.

    `relations_null.BLOCKERS` calls `lifts` `Blocker: build` and says exactly
    what is missing: "`Stream.provides('lifts')` reads `frames.lift_source`,
    and MEASURED over this repository NOTHING assigns it: there is no scanner,
    no declarer and no caller … unlike `caesura` and `refrain_tail`, which
    this panel supplies from `search_caesura` and `mark_refrain_tail`, THERE
    IS NO FUNCTION TO CALL." This is that function, and `declare_lifts` above
    is the declarer.

    WHAT IT READS AND WHAT IT ASSUMES, kept apart:
      READS   `Syllable.prominence`, which is real data — CMUdict lexical
              stress with this repo's own function-word demotion applied
              (doctrine 46: a function-word list is part of a phonology).
      ASSUMES `per_half_line` and `halves`, which are a CONVENTION of the
              verse form and are PARAMETERS for that reason. Four lifts to a
              line, two to a half-line, is the Germanic alliterative
              long-line convention; a caller working another form says so.

    THE SPLIT IS THE CAESURA WHERE ONE IS DECLARED and an even division of
    the line's units where none is — and `lift_source` names which, so a
    reader can tell a scansion that rested on a declared medial break from one
    that rested on arithmetic. That distinction is the entire reason the two
    source names differ rather than both reading "computed".

    A LINE WITH TOO FEW PROMINENT SYLLABLES GETS WHAT IT HAS, not padding.
    A half-line carrying one stress yields one lift; `fourth lift must not
    alliterate` then finds no fourth lift on that line and says nothing about
    it, which is the honest answer — inventing a lift on an unstressed
    syllable to reach the convention's count would be manufacturing the
    scansion the schema is meant to test.
    """
    if per_half_line < 1 or halves < 1:
        raise NoReferent(
            f"per_half_line={per_half_line}, halves={halves}: both are counts "
            f"of positions and must be at least 1.")
    by_line = {}
    for k, u in enumerate(stream.units):
        by_line.setdefault(u.line, []).append(k)
    caes = dict(getattr(stream.frames, "caesura", None) or {})
    used_caesura = 0
    out = {}
    for ln, idxs in by_line.items():
        cut = None
        if ln in caes:
            c = caes[ln]
            cut = c if isinstance(c, int) else (c[0] if c else None)
        if cut is not None:
            used_caesura += 1
            parts = [[k for k in idxs if k < cut],
                     [k for k in idxs if k >= cut]]
            parts = [p for p in parts if p] or [idxs]
        else:
            step = max(1, len(idxs) // halves)
            parts = [idxs[i:i + step] for i in range(0, len(idxs), step)]
            parts = parts[:halves] or [idxs]
        lifts = []
        for part in parts:
            got = 0
            for k in part:
                syl = stream.units[k].syl
                if syl is not None and (syl.prominence or 0) >= 1:
                    lifts.append(k)
                    got += 1
                    if got >= per_half_line:
                        break
        if lifts:
            out[ln] = tuple(lifts)
    stream.frames.lifts = out
    stream.frames.lift_source = (
        "prominence+caesura" if used_caesura else "prominence") if out \
        else "none"
    return {"lines": len(out), "found": len(out),
            "from_caesura": used_caesura,
            "per_half_line": per_half_line, "halves": halves,
            "source": stream.frames.lift_source}


def declare_period_surface(stream, sourced, name="earlier"):
    """Read the draft through a SOURCED period or dialect phonology. -> dict.

    `historical rhyme` and `dialect rhyme` are each defined as a DIFFERENCE
    between two readings — nucleus and coda AGREE on the second surface while
    the nucleus DIFFERS on the phonemic one — and both refuse without it.
    `relations_null` calls `earlier` and `poet` `Blocker: obtain`, and what it
    says is precise: "`declared_inputs.PeriodPhonology` refuses to construct
    without a named reconstruction, which is the CORRECT REFUSAL … the surface
    itself is reachable; THE DATA IS NOT."

    THE DATA IS THE CALLER'S AND ALWAYS WAS. What was missing is this
    constructor: `ALT_SURFACES` has held both names since it was written,
    `PeriodPhonology` has held the wrapper, and nothing joined them, so a
    reader who HAD a sourced reconstruction still could not hand it to a
    schema. `quality/phonology/ltc.py` is the existence proof `PeriodPhonology`
    itself names — Middle Chinese is a LOOKUP over a sourced table, not a
    guess — and any object with `.syllabify()` behind that wrapper works here.

    `sourced` is a `declared_inputs.PeriodPhonology`, and it is required to BE
    one rather than a bare phonology: that class is what enforces the period,
    the reconstruction and the source, and accepting a raw object here would
    route around three checks whose whole purpose is to stop an unsourced
    reading being reported as a historical one (doctrine 34). A caller with no
    reconstruction gets the refusal from `PeriodPhonology`, where it belongs,
    and not a surface full of modern vowels wearing a period's name.
    """
    if name not in ALT_SURFACES:
        raise NoReferent(
            f"{name!r} is not one of ALT_SURFACES {ALT_SURFACES}.")
    phon = getattr(sourced, "phonology", None)
    if phon is None or not hasattr(sourced, "reconstruction"):
        raise NoReferent(
            f"`sourced` must be a `declared_inputs.PeriodPhonology`, got "
            f"{type(sourced).__name__}. That class is what requires a period, "
            f"a named reconstruction and a source; taking a bare phonology "
            f"here would route around all three and let an unsourced reading "
            f"be reported as a historical one.")
    units, read = [], 0
    cache = {}
    for u in stream.units:
        w = (u.token_text or "").lower()
        if w not in cache:
            try:
                cache[w] = list(phon.syllabify(w))
            except Exception:
                cache[w] = None
        syls = cache[w]
        if not syls or u.tok_syl >= len(syls):
            # THE PERIOD PHONOLOGY COULD NOT READ THIS WORD, and the unit is
            # carried with NO material rather than with its modern syllable:
            # projecting the phonemic reading into the `earlier` surface is
            # exactly the manufacture this surface exists to avoid, and it
            # would make every unreadable word a silent historical AGREE.
            units.append(replace(u, syl=None))
            continue
        units.append(replace(u, syl=syls[u.tok_syl]))
        read += 1
    alt = Stream(units=units, lines=list(stream.lines),
                 tokens=dict(stream.tokens), phon=phon,
                 declaration=dict(stream.declaration, surface=name,
                                  period=getattr(sourced, "period", ""),
                                  reconstruction=sourced.reconstruction),
                 text_lines=stream.text_lines)
    stream.alt[name] = alt
    return {"surface": name, "units": len(units), "read": read,
            "found": read, "period": getattr(sourced, "period", ""),
            "reconstruction": sourced.reconstruction, "source": "declared"}


def declare_senses(stream, mapping):
    """Declare WHICH SENSE a word carries where. -> a summary dict.

    `antanaclasis` is ONE WORD IN TWO SENSES — "put out the light, and then
    put out the light" — and it refuses without a `sense` resource.
    `relations_null` calls that `Blocker: obtain` and the reason is exact for
    the job it was written about: "with any resource that keys on the TOKEN it
    degenerates to `repetition`, which is a different schema already in this
    registry", and `data/nltk/` carries taggers and tokenizers, not WordNet.

    A CORPUS READER NEEDS AN INVENTORY. A WRITER DOES NOT, and that is the
    whole difference this constructor turns on. Antanaclasis is a DELIBERATE
    FIGURE: a writer who repeats a word in a second sense is doing it on
    purpose and can say which sense goes where. So the resource is a
    declaration — `{(line, token): sense}` in 0-based indices — exactly like
    the delivered surface and the stub resolution, and nothing here infers a
    sense from anything.

    THE KEY IS POSITIONAL AND HAS TO BE. A `{word: sense}` map cannot express
    this figure at all: the schema's entire content is that the SAME token
    carries DIFFERENT senses at two positions, so a word-keyed resource makes
    every instance sense-identical and the schema collapses into `repetition`
    — the exact degeneration `BLOCKERS` names, arrived at from the other
    direction.

    A token with no declared sense gets its own text as its sense, so two
    undeclared occurrences of one word are sense-IDENTICAL and antanaclasis
    does NOT fire on them. That is the safe direction: silence means "an
    ordinary repeat", never "a figure".
    """
    if not isinstance(mapping, dict):
        raise NoReferent(
            f"`mapping` is {{(line, token): sense}} in 0-based indices, got "
            f"{type(mapping).__name__}. A word-keyed map cannot express "
            f"antanaclasis — see this function's docstring.")
    norm = {}
    for k, v in mapping.items():
        try:
            ln, tk = int(k[0]), int(k[1])
        except (TypeError, IndexError, ValueError):
            raise NoReferent(
                f"sense key {k!r} is not a (line, token) pair. The figure is "
                f"about one word at two POSITIONS, so the key carries both.")
        norm[(ln, tk)] = str(v)

    def _sense_of_unit(u):
        return norm.get((u.line, u.token),
                        (getattr(u, "token_text", "") or "").lower())

    res = dict(stream.declaration.get("resources") or {})
    res["sense"] = _sense_of_unit
    stream.declaration = dict(stream.declaration, resources=res)
    return {"declared": len(norm), "found": len(norm), "source": "declared"}


#: THE INCIPIT LENGTHS TRIED, LONGEST FIRST. ~~STUB_INCIPIT_WORDS = 3~~, and
#: the struck constant is the point: it was declared with a plausible story
#: ("a two-word prefix like `oh my` matches half a songbook") and never
#: measured. MEASURED 2026-08-23 over 1,297 corpus files / 989 stub lines,
#: one fixed length at a time, WITH the tokeniser fix in place:
#:
#:     incipit  no-incipit    unique       ambiguous     no match
#:        2      0 ( 0.0%)   363 (36.7%)  389 (39.3%)  237 (24.0%)
#:        3     14 ( 1.4%)   322 (33.0%)  228 (23.4%)  425 (43.6%)
#:        4    208 (21.0%)   197 (25.2%)   80 (10.2%)  504 (64.5%)
#:        5    530 (53.6%)    83 (18.1%)   45 ( 9.8%)  331 (72.1%)
#:
#: (The tokeniser fix alone is worth ~105 resolutions: at length 3 the
#: `str.split()` version resolved 217, this resolves 322.)
#:
#: NO SINGLE LENGTH IS RIGHT, which is why the constant is GONE rather than
#: repinned. A short incipit reaches more stubs and carries less evidence; a
#: long one carries more evidence and cannot be formed by most stubs at all —
#: at five words 53.6% of them have no incipit to match with. Picking one
#: number trades coverage against evidence GLOBALLY when the trade is
#: available PER STUB.
#:
#: So each stub is tried at the longest length it can form and falls back
#: shorter only when that yields NOTHING — never to overturn an ambiguity,
#: because two candidates on five words do not become one on two, they become
#: more. The resolution records WHICH length decided it (`evidence`), so a
#: reader can weigh a five-word match differently from a two-word one instead
#: of being told they are the same claim.
#:
#: AND THE STRATEGY WAS THEN MEASURED AGAINST EVERY FIXED LENGTH rather than
#: assumed to beat them, on the same 989 stubs:
#:
#:     strategy        resolved       ambiguous  none  no-incipit
#:     fixed 2        363 (36.7%)        389      237       0
#:     fixed 3        322 (32.6%)        228      425      14
#:     fixed 4        197 (19.9%)         80      504     208
#:     fixed 5         83 ( 8.4%)         45      331     530
#:     LONGEST-FIRST  469 (47.4%)        283      237       0
#:
#: 469 against the best single length's 363 — 29% more than any fixed choice
#: and 46% more than the `3` this shipped with. The evidence distribution is
#: the half that matters: **5w:83  4w:120  3w:141  2w:125**, so 344 of the 469
#: (73%) rest on three or more words and a reader can discount the 125 that do
#: not. A bare threshold destroys exactly that distinction by making every
#: resolution look equally well founded.
#:
#: AGAINST `relations_null.BLOCKERS`' FIGURE, carefully: it measured 158 of
#: 843 (18.7%) unique for the naive resolver it was describing, and this
#: reaches 469 of 989 (47.4%). THOSE ARE NOT THE SAME MEASUREMENT — different
#: stub count, different matcher, different tokeniser — so this is not a
#: refutation of that number. What it does supersede is the entry's
#: CONCLUSION, that a resolver is "wrong more often than right" and therefore
#: this repo should supply none: nearly half the stubs in the corpus resolve
#: to a unique earlier line, and the rest are still refused.
STUB_INCIPIT_LENGTHS = (5, 4, 3, 2)


def search_stub_resolution(stream, is_stub=None, language=None, incipit=None):
    """Resolve the stubs that resolve UNIQUELY, and refuse the rest. -> dict.

    WHICH LINES ARE STUBS IS NOT THIS MODULE'S QUESTION (P10, and this
    function violated it from 2026-08-23 until the same day's audit). The
    first draft did `import lyric_harness as _lh` and called
    `_lh.is_chorus_stub`, which is shipping a detector by reference rather
    than by regex -- the same defect at one remove, and `test_relations.py`'s
    P10 check caught it. Deciding that a printed mark is a POINTER is the
    edition's judgement: English prints `&c.`, Finnish `j. n. e.`, Malay
    `d. s. b.`, and a module serving nine languages cannot hold that list.

    So stub-hood arrives the way the orthographic rime does in
    `declare_orthography(stream, rime)` -- from the caller:

      * `stream.line_status`, if the caller declared one (via
        `build_stream(line_status=...)` or `line_status_from`). A line whose
        label is truthy is a stub. THIS WINS when present, because a declared
        coordinate outranks a derivation and both would be answering one
        question.
      * `is_stub`, a callable `(text, language) -> bool` passed in.
      * neither: a `Refusal` naming `line_status`. Not an empty result --
        "nobody said which lines are pointers" is not "there are no
        pointers" (doctrine 20).

    `relations_null.BLOCKERS` measured the naive resolver over `corpus/song/`
    and the numbers are why this repo shipped none: of 843 stub lines,
    matching each stub's incipit against earlier lines resolves **158 (18.7%)
    to a UNIQUE earlier line**, leaves **224 (26.6%) with no earlier match at
    all**, and leaves **461 (54.7%) ambiguous between 2 and 9 candidates**.
    "Wrong more often than right" is the correct summary OF THE WHOLE, and it
    was read here as a reason to supply NOTHING — which throws away the 18.7%
    that are not ambiguous at all.

    SO THIS RESOLVES ONLY THE UNAMBIGUOUS AND SAYS SO. A stub whose incipit
    matches exactly one earlier line is resolved; a stub with two or more
    candidates, or none, is LEFT OUT of the map entirely and counted in the
    return. `declare_stub_resolution` then takes the result and a caller may
    add the hard ones by hand — the derivation and the declaration compose,
    and the declaration wins, because they are the same map.

    THE SPAN IS A GUESS THIS DOES NOT MAKE. A stub stands for a whole chorus
    and the incipit finds only its FIRST line, so the span returned is
    `(match, match + 1)` — one line, the one that was actually found. Widening
    it to "probably four lines" would be inventing the chorus's length, which
    is the edition-level judgement `BLOCKERS` says this cannot make.
    """
    status = tuple(getattr(stream, "line_status", ()) or ())
    if status:
        def _is_stub(text, _lang, _i=None):
            return bool(_i is not None and _i < len(status) and status[_i])
    elif callable(is_stub):
        def _is_stub(text, _lang, _i=None):
            try:
                return bool(is_stub(text, _lang))
            except Exception:
                return False
    else:
        return Refusal(
            schema="search_stub_resolution", capability="line_status",
            detail="nobody has said which lines are POINTERS. Declare it -- "
                   "`build_stream(line_status=...)`, or `line_status_from("
                   "lines, predicate, label)` -- or pass `is_stub=`. Which "
                   "printed mark is a stub is the EDITION's judgement and "
                   "this module ships no list: English prints `&c.`, Finnish "
                   "`j. n. e.`, Malay `d. s. b.` (P10, BACKLOG 2.4). An "
                   "empty map would say 'no pointers here', which is a "
                   "different answer (doctrine 20).",
            missing=("line_status",), kind="capability")
    lines = list(getattr(stream, "text_lines", ()) or [])
    if not lines:
        by = {}
        for u in stream.units:
            by.setdefault(u.line, []).append(u.token_text or "")
        lines = [" ".join(by.get(i, ())) for i in range(len(stream.lines))]

    def _key(text, w):
        # THIS MODULE'S OWN TOKENISER, not `str.split()`. The first draft
        # probed `lyric_harness` for a `tokenise` it does not have and fell
        # back to whitespace splitting, which leaves punctuation glued on:
        # `"oh my poor nelly gray, &c."` splits to `gray,` and `&c.`, so a
        # stub matched an earlier line only when the two happened to be
        # punctuated identically. `tokenise` is defined 1,200 lines above
        # this one.
        toks = [x.lower() for x in tokenise(text or "")][:w]
        return tuple(toks) if len(toks) >= w else None

    lengths = ((int(incipit),) if incipit is not None
               else STUB_INCIPIT_LENGTHS)
    stubs, resolved, ambiguous, unmatched, no_incipit = [], {}, [], [], []
    evidence = {}
    for i, text in enumerate(lines):
        if not _is_stub(text, language, i):
            continue
        stubs.append(i)
        hit = amb = None
        for w in lengths:
            k = _key(text, w)
            if k is None:
                continue
            got = [j for j in range(i)
                   if not _is_stub(lines[j], language, j)
                   and _key(lines[j], w) == k]
            if len(got) == 1:
                hit, amb = (got[0], w), None
                break
            if got and amb is None:
                amb = (tuple(got), w)
        if hit is not None:
            resolved[i] = (hit[0], hit[0] + 1)
            evidence[i] = hit[1]
            continue
        if amb is not None:
            ambiguous.append((i, amb[0]))
            continue
        k = _key(text, min(lengths))
        if k is None:
            # NO INCIPIT TO MATCH WITH, which is NOT the same answer as
            # "the incipit matched nothing" and is counted apart from it
            # (doctrine 20/79). A bare `&c.` tokenises to a single `c`: it
            # names no line, so incipit matching is not a method that can
            # fail on it — it is a method that does not apply. Lumping the
            # two together inflated the miss rate and hid the fact that a
            # large share of stubs in this corpus carry no incipit at all.
            no_incipit.append(i)
            continue
        unmatched.append(i)
    return {"stubs": len(stubs), "resolved": resolved,
            "ambiguous": ambiguous, "unmatched": unmatched,
            "no_incipit": no_incipit,
            "found": len(resolved), "source": "incipit_unique",
            "evidence": evidence, "lengths_tried": tuple(lengths)}


def declare_stub_resolution(stream, mapping):
    """Declare WHAT A CHORUS STUB POINTS AT. -> a summary dict.

    `refrain by reference` compares two WHOLE LINES token-for-token and
    refuses without `stub_resolution`. `relations_null` calls it
    `Blocker: build` and the measurement behind that is not in dispute: over
    `corpus/song/`, matching each stub's incipit against earlier lines
    resolves 158 of 843 (18.7%) uniquely, leaves 224 (26.6%) with no earlier
    match, and leaves 461 (54.7%) ambiguous between 2 and 9 candidates. A
    naive resolver is WRONG MORE OFTEN THAN RIGHT, and this module ships none
    — the entry's own words are that the honest version is an edition-level
    annotation.

    SO THIS IS THE ANNOTATION, AND NOT A DETECTOR. `mapping` is
    `{stub_line: (start, end)}` in 0-based, end-exclusive line indices, and it
    is DECLARED — by the editor who knows which chorus the `&c.` meant, or by
    the writer who wrote it. Nothing here guesses, and a stub with no entry
    stays unresolved.

    WHAT RESOLUTION DOES, precisely, because "resolve" could mean three
    things: the stub line's UNITS are replaced by the units of the first line
    of the span it points at, retagged to the stub's own line number. That is
    what an edition does when it prints the chorus out in full instead of
    abbreviating it, and it is what makes the stub line comparable at all —
    `tokenise` reads `Oh, my poor Nelly Gray, &c.` as ending in the word `c`,
    so before resolution the stub matches nothing and the schema would fire on
    every ORDINARY verbatim repeat instead (the inverse of what it is for,
    which `UNPROVIDABLE` predicted in as many words).

    THE FIRST LINE OF THE SPAN, and the span is kept. A stub stands for a
    whole chorus; `refrain by reference` is a LINE-to-LINE schema, so the
    first line is the comparand a per-line judge can use. The full span is
    recorded on `frames.stub_resolution` so a later figure-level consumer has
    it — the narrowing is this schema's, not the declaration's.
    """
    if not isinstance(mapping, dict):
        raise NoReferent(
            f"`mapping` is {{stub_line: (start, end)}} in 0-based line "
            f"indices, got {type(mapping).__name__}.")
    n_lines = len(stream.lines)
    resolved, by_line = {}, {}
    for stub, span in mapping.items():
        try:
            a, b = int(span[0]), int(span[1])
        except (TypeError, IndexError, ValueError):
            raise NoReferent(
                f"stub resolution for line {stub!r} is not a (start, end) "
                f"pair: {span!r}. A stub stands for a SPAN, not a line — "
                f"nothing in the text says how many lines a chorus is, which "
                f"is why the declaration carries both ends.")
        if not (0 <= a < b <= n_lines):
            raise NoReferent(
                f"stub resolution {stub!r} -> ({a}, {b}) is outside this "
                f"stream's {n_lines} line(s), or is empty.")
        if not (0 <= int(stub) < n_lines):
            raise NoReferent(
                f"stub line {stub!r} is outside this stream's {n_lines} "
                f"line(s).")
        if a <= int(stub) < b:
            raise NoReferent(
                f"stub line {stub!r} points at a span containing itself "
                f"({a}, {b}); a reference that resolves to the reference is "
                f"not a resolution.")
        resolved[int(stub)] = (a, b)
        by_line[int(stub)] = a
    if not resolved:
        stream.frames.stub_source = "none"
        return {"stubs": 0, "found": 0, "source": "none"}
    src_units = {}
    for u in stream.units:
        src_units.setdefault(u.line, []).append(u)
    units, done = [], 0
    for u in stream.units:
        if u.line not in by_line:
            units.append(u)
            continue
        continue                      # the stub's own units are dropped
    for stub, first in sorted(by_line.items()):
        for k, su in enumerate(src_units.get(first, [])):
            units.append(replace(su, line=stub))
            done += 1
    units.sort(key=lambda u: (u.line, u.i))
    alt_lines, alt_tokens = [], {}
    for ln in range(n_lines):
        idx = tuple(k for k, u in enumerate(units) if u.line == ln)
        alt_lines.append(idx)
    for k, u in enumerate(units):
        alt_tokens.setdefault((u.line, u.token), []).append(k)
    stream.units = units
    stream.lines = alt_lines
    stream.tokens = {k: tuple(v) for k, v in alt_tokens.items()}
    stream.frames.stub_resolution = dict(resolved)
    stream.frames.stub_source = "declared"
    return {"stubs": len(resolved), "found": len(resolved),
            "units_substituted": done, "source": "declared"}


def declare_delivery(stream, overrides, name="delivered"):
    """Declare HOW THE LINES ARE SUNG, as a second stream. -> a summary dict.

    THE SURFACE THAT WAS CALLED UNOBTAINABLE, AND WHY IT IS NOT (2026-08-22,
    owner ruling). `relations_null.BLOCKERS` calls `delivered` and `sung`
    `Blocker: obtain` — *"what the singer actually sang, against what the page
    prints"* — and for the NULL SWEEP that is correct and stays: you cannot
    measure `wrenched rhyme` against a corpus of printed ballads, because what
    was sung is not in the book. **For a writer it is a DECLARATION.** This
    repo is a harness for WRITING songs, and the writer is the one who decides
    how a line is sung, so the delivered surface is a coordinate they state —
    the same kind of thing as the meter or the relation — and there is nothing
    to obtain. `ALT_SURFACES` has held both names since it was written and
    `Stream.alt` is already `surface name -> Stream`; what was missing was the
    constructor, and this is it.

    WHAT THE THREE SCHEMAS ACTUALLY ASK FOR, which is what fixes the shape of
    `overrides`:

      wrenched rhyme      prominence DIFFERS on the page and AGREES as
                          delivered — the ballad move of forcing a normally
                          unstressed syllable to take the stress so it
                          rhymes (`sailing` against `king`).
      transformative /    nucleus and coda AGREE as delivered while the
      bent rhyme          nucleus DIFFERS on the page — the rap and soul move
                          of bending a vowel to land a rhyme.
      sung-delivery       nucleus and moras AGREE on the `sung` surface.
      rhyme

    So a delivery is a per-syllable override of `prominence`, `nucleus`,
    `coda` and `moras`, and nothing else: it re-voices material the page
    already carries and never invents a syllable.

    `overrides` may be
      {word: {field: value}}              applied to that word's LAST
                                          syllable, which is the rhyme-
                                          bearing one and the only one any of
                                          the three schemas reads at `scope`
                                          `last`/`anchor`.
      {(word, syl_index): {field: value}} for a word whose interior moves.
      callable(unit) -> dict or None      for a writer who wants the whole
                                          say. A callable that returns None
                                          leaves the unit exactly as printed.

    NOTHING IS INFERRED. A word with no entry is delivered as written, so a
    caller who declares one word declares one word — the surface does not
    quietly re-stress the rest of the song to make a rhyme work, which is the
    manufacture this constructor exists to avoid.
    """
    if name not in ALT_SURFACES:
        raise NoReferent(
            f"{name!r} is not one of ALT_SURFACES {ALT_SURFACES}; a surface "
            f"no schema can name is a stream nothing will ever read.")
    _FIELDS = ("prominence", "nucleus", "coda", "moras")
    is_call = callable(overrides)
    if not is_call and not isinstance(overrides, dict):
        raise NoReferent(
            f"`overrides` is a dict or a callable, got "
            f"{type(overrides).__name__}. See this function's docstring for "
            f"the three accepted shapes.")
    if not is_call:
        for k, v in overrides.items():
            bad = [f for f in (v or {}) if f not in _FIELDS]
            if bad:
                raise NoReferent(
                    f"delivery override for {k!r} names {bad}, which are not "
                    f"deliverable fields. A delivery re-voices "
                    f"{list(_FIELDS)} and never invents a syllable.")
    # LAST-SYLLABLE INDEX PER TOKEN, so a bare `{word: {...}}` lands on the
    # rhyme-bearing syllable rather than on the first one it meets.
    last_of = {}
    for u in stream.units:
        last_of[(u.line, u.token)] = max(
            last_of.get((u.line, u.token), -1), u.tok_syl)
    units, touched = [], 0
    for u in stream.units:
        over = None
        if is_call:
            over = overrides(u)
        else:
            w = (u.token_text or "").lower()
            over = overrides.get((w, u.tok_syl))
            if over is None and u.tok_syl == last_of.get((u.line, u.token)):
                over = overrides.get(w)
        if not over:
            units.append(u)
            continue
        touched += 1
        units.append(replace(u, syl=replace(u.syl, **dict(over))))
    alt = Stream(units=units, lines=list(stream.lines),
                 tokens=dict(stream.tokens), phon=stream.phon,
                 declaration=dict(stream.declaration, surface=name),
                 text_lines=stream.text_lines)
    stream.alt[name] = alt
    return {"surface": name, "units": len(units), "delivered": touched,
            "found": touched, "source": "declared"}


def declare_orthography(stream, rime, name="orthography"):
    """Declare the ORTHOGRAPHIC alt surface `eye rhyme` refuses without.

    `rime` is a CALLER-SUPPLIED `word -> str`, and this module ships none.
    That is doctrine 45 and doctrine 65 in one argument: an orthographic rime
    rule is a fact about a SPELLING SYSTEM -- `lyric_harness.spelled_rime`'s
    own docstring declares that y is a vowel letter, w is not, and a word-final
    silent -e folds, all three of which are English -- and this module serves
    nine languages and imports nothing from the harness.  A built-in default
    would be a checker silently picking a coordinate, which is the bug.

    `spelled_rime` also takes `stress_from_end`, and BINDING IT IS THE
    CALLER'S TOO: without it the rime anchors at the last vowel group, which
    over-reaches on feminine rhymes (silver/deliver share `-er`), and the
    anchor rule that fixes it is the harness's, not this module's.  Pass a
    closure if you want it; the summary records nothing about which you chose
    because a callable cannot be asked.

    HOW THE SURFACE IS BUILT.  Every unit of `stream` is re-emitted at the
    SAME index with the same coordinates and a `_Spelling` in place of its
    syllable, so `_project` aligns by construction -- same line lengths, same
    token lengths, same `tok_syl`.  The WORD-FINAL unit of each token carries
    `rime(token_text)`; every earlier unit carries None, because the rime rule
    decomposes a word and inventing a head spelling for its first syllable
    would be a reading nobody declared.  `eye rhyme` reads `grapheme` at scope
    `last` under `flush_right`, so the word-final unit is the one it asks
    about, and a None elsewhere propagates as UNDECIDED rather than False.

    -> a summary.  `graphemes` is the population `Stream.supply(name)` will
    report; a rime callable that answers "" everywhere leaves the surface
    DECLARED AND EMPTY, which now refuses by name instead of running `eye
    rhyme` over unreadable positions and reporting a zero.
    """
    if not callable(rime):
        raise NoReferent(
            f"`rime` is a callable word -> str (e.g. "
            f"lyric_harness.spelled_rime); got {type(rime).__name__}. This "
            f"module ships no rime rule: which letters are vowels and whether "
            f"a final -e is silent are facts about a spelling system, and "
            f"this module serves nine of them.")
    if name not in ALT_SURFACES:
        raise NoReferent(
            f"{name!r} is not one of ALT_SURFACES {ALT_SURFACES}; a surface "
            f"no schema can name is a stream nothing will ever read.")
    units, known = [], 0
    for u in stream.units:
        g = None
        if u.word_final:
            g = rime(u.token_text) or None
        if g is not None:
            known += 1
        units.append(replace(u, syl=_Spelling(text=g)))
    alt = Stream(units=units, lines=list(stream.lines),
                 tokens=dict(stream.tokens),
                 phon=_SpellingSurface(rime, stream.declaration.get(
                     "language", "")),
                 declaration=dict(stream.declaration, surface=name),
                 text_lines=stream.text_lines)
    stream.alt[name] = alt
    return {"surface": name, "units": len(units), "graphemes": known,
            "found": known,
            "tokens": len({(u.line, u.token) for u in stream.units
                           if u.word_final}),
            "source": "declared"}


# ---------------------------------------------------------------------------
# 10. THE REGISTRY.  Every canonical type is a POINT here, and every point is
#     something realise() can go and look for.
# ---------------------------------------------------------------------------

REGISTRY = {}


def declare(s):
    REGISTRY[s.name] = s
    return s


# -- span rules used repeatedly
END_ANCHOR = SpanRule("line_final_token", "last_stressed", 1, "to_word_end")
END_WORD = SpanRule("line_final_token", "word_start", 1, "to_word_end")
END_LAST = SpanRule("line_final_token", "word_end", 1, 1)
END_PENULT = SpanRule("line_final_token", "penult", 1, 1)
END_UNSTRESSED = SpanRule("line_final_token", "final_unstressed", 1, 1)
HEAD_ANY = SpanRule("any_token", "word_start", 1, 1)
HEAD_LINE = SpanRule("line_initial_token", "word_start", 1, 1)
WHOLE_LINE = SpanRule("line", "word_start", 1, "whole")
HALF_A = SpanRule("half_line_a", "word_start", 1, "whole")
HALF_B = SpanRule("half_line_b", "word_start", 1, "whole")
FREE_MULTI = SpanRule("free_run", "searched", 1, (2, 6), cross_word=True)

ONSET_D = ChannelRule("onset", DIFFER, "anchor")
DISTINCT = IdentityRule("token", DIFFER)

declare(RelationSchema(
    name="perfect rhyme", aka=("full rhyme", "odl", "qafiya (segmental core)",
                               "antya-prasa"),
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each"),
              ChannelRule("onset", AGREE, "post_anchor"),
              ONSET_D,
              ChannelRule("prominence", AGREE, "anchor")),
    unmatched="forbid",
    placement=(Placement("both_line_final"), Placement("different_lines")),
    identity=(DISTINCT,),
    note="the ONSET MUST-DIFFER at the anchor is constitutive and is Snorri's "
         "upphafsstafir greina orðin. Tail-flush is a CONSEQUENCE of "
         "anchor=last-stressed + magnitude=to-word-end, not a primitive."))

declare(RelationSchema(
    name="rime riche",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("onset", AGREE, "each"),
              ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each")),
    unmatched="forbid",
    placement=(Placement("both_line_final"), Placement("different_lines")),
    identity=(IdentityRule("token", DIFFER),),
    note="ONE point: every phonological channel AGREE, the lexical channel "
         "DIFFER. rhyme_types.py gives it both identity='rich' AND the (1,1,1) "
         "cell, double-counting one fact."))

declare(RelationSchema(
    name="repetition",
    spans=(END_WORD, END_WORD), align="flush_right",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each"),
              ChannelRule("onset", AGREE, "each")),
    placement=(Placement("different_lines"),),
    identity=(IdentityRule("token", AGREE),),
    note="No PHONOLOGICAL channel distinguishes it from rime riche. Its "
         "NORMATIVE STATUS inverts by frame: a fault inside a verse, the "
         "requirement across chorus instances."))

declare(RelationSchema(
    name="antanaclasis",
    spans=(HEAD_ANY, HEAD_ANY), align="flush_left",
    channels=(ChannelRule("onset", AGREE, "each"),
              ChannelRule("nucleus", AGREE, "each")),
    identity=(IdentityRule("token", AGREE), IdentityRule("sense", DIFFER)),
    note="token AGREE + lexeme AGREE + sense DIFFER: a combination the repo's "
         "3-valued IDENTITY axis has no slot for. Refuses without a sense "
         "resource rather than guessing."))

declare(RelationSchema(
    name="assonance",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", DIFFER, "anchor")),
    placement=(Placement("both_line_final"), Placement("different_lines")),
    identity=(DISTINCT,),
    note="NOT right-edge flush: the codas are REQUIRED to differ, so no suffix "
         "of the two words is equal. A suffix comparator cannot represent it."))

declare(RelationSchema(
    name="consonance",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("coda", AGREE, "each"),
              ChannelRule("nucleus", DIFFER, "anchor")),
    placement=(Placement("both_line_final"), Placement("different_lines")),
    identity=(DISTINCT,)))

declare(RelationSchema(
    name="cluster consonance / skothending span",
    spans=(SpanRule("line_final_token", "last_stressed", 1, "to_word_end"),) * 2,
    align="none",
    channels=(ChannelRule("consonants", SequenceEqual(), "sequence"),
              ChannelRule("nucleus", DIFFER, "anchor")),
    identity=(DISTINCT,),
    note="EVERY consonant to the end of the cluster INCLUDING across the "
         "syllable boundary. Snorri cites 'fyrð' from jörð:fyrðum; a checker "
         "keyed on the coda of a maximal-onset syllabification reads 'fyr'."))

declare(RelationSchema(
    name="parechesis / general consonance",
    spans=(WHOLE_LINE, WHOLE_LINE), align="none",
    channels=(ChannelRule("consonants", SubsequenceOf(), "sequence"),),
    placement=(Placement("adjacent_lines"),),
    identity=(DISTINCT,),
    note="the one entry whose ANCHOR value is 'none'. A subsequence test, not "
         "a pairwise channel comparison."))

declare(RelationSchema(
    name="pararhyme",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("onset", AGREE, "each"),
              ChannelRule("coda", AGREE, "each"),
              ChannelRule("nucleus", DIFFER, "each")),
    placement=(Placement("both_line_final"), Placement("different_lines")),
    identity=(DISTINCT,),
    note="Head-flush and tail-flush SIMULTANEOUSLY -- not two alignments, one "
         "anchor plus a full-syllable magnitude. Not suffix-reachable in the "
         "onset channel for polysyllables."))

declare(RelationSchema(
    name="reverse rhyme",
    aka=("front rhyme", "head-and-body rhyme"),
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("onset", AGREE, "anchor"),
              ChannelRule("nucleus", AGREE, "anchor"),
              ChannelRule("coda", DIFFER, "anchor")),
    placement=(Placement("both_line_final"), Placement("different_lines")),
    identity=(DISTINCT,),
    note="THE CELL rhyme_types.CELL_NAMES[(1,1,0)] declares nameless, with the "
         "source's own example bat/back. Structurally unreachable by suffix "
         "alignment: the agreeing material is a PREFIX of the rime."))

declare(RelationSchema(
    name="alliteration",
    aka=("stave rhyme", "stuðlar", "higaad", "mōnai", "anuprāsa (onset case)"),
    spans=(HEAD_ANY, HEAD_ANY), align="flush_left",
    channels=(ChannelRule("onset", AGREE, "first"),),
    placement=(Placement("same_line"),),
    identity=(DISTINCT,),
    figure=Figure(quantifier="exists", frame="line"),
    note="THE CONCRETE FAILURE. anchor=word_start, magnitude=1, and the "
         "alignment is flush_LEFT. The missing thing was an ANCHOR axis, not "
         "a longer suffix."))

declare(RelationSchema(
    name="Kalevala alliteration (weak)",
    spans=(HEAD_ANY, HEAD_ANY), align="flush_left",
    channels=(ChannelRule("onset", AGREE, "first"),),
    placement=(Placement("same_line"),),
    identity=(DISTINCT,),
    figure=Figure(quantifier="exists_k", k=2, frame="line"),
    note="doctrine 63: the predicate is a SYMMETRIC function of the line's "
         "word multiset, so a within-line shuffle is the IDENTITY MAP. The "
         "figure records the quantifier so a caller can pick the right null."))

declare(RelationSchema(
    name="Kalevala alliteration (strong)",
    spans=(HEAD_ANY, HEAD_ANY), align="flush_left",
    channels=(ChannelRule("onset", AGREE, "first"),
              ChannelRule("nucleus", AGREE, "first")),
    placement=(Placement("same_line"),),
    identity=(DISTINCT,),
    figure=Figure(quantifier="exists_k", k=2, frame="line"),
    note="Structurally IDENTICAL to English REVERSE RHYME at a different "
         "placement frame -- and rhyme_types.py declares the English side "
         "nameless while naming the Finnish side."))

declare(RelationSchema(
    name="paroemion",
    spans=(SpanRule("line", "none", 1, "word_initial_syllables"),) * 2,
    align="none",
    channels=(ChannelRule("onset", SequenceEqual(), "sequence"),),
    figure=Figure(quantifier="fraction", fraction=0.8, frame="line"),
    note="Universally quantified member selection. Doctrine 63: any rate needs "
         "a null that permutes the WHOLE token stream and re-cuts on the "
         "original line lengths, because the within-line null is degenerate."))

declare(RelationSchema(
    name="family rhyme",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", ClassEqual(resource="manner",
                                             label="declared manner partition"),
                          "each")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    note="Forces the CLASS-EQUAL predicate. A boolean _cmp(x,y) returning x==y "
         "cannot express it. quality/fit_matrix.py is a fitted substitution "
         "matrix already built and shelved; the partition slot is where it "
         "would plug in. DEFECT P14: the slot held `lambda v: v` and the "
         "schema was therefore tail rhyme at the FINEST grain wearing a label "
         "about manner classes — `cat`~`bat` read True as a FAMILY relation. "
         "No manner partition is declared anywhere in this repo, so it refuses "
         "for want of `quotient:manner` until one is."))

declare(RelationSchema(
    name="additive rhyme",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "anchor"),
              ChannelRule("coda", PresentVsAbsent(on=1), "anchor")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    note="SEGMENTAL, and says nothing about syllable count. classify_pair "
         "computes LENGTH from whole-word syllable counts and labels "
         "rakastan/sun 'additive' -- two unrelated relations under one value."))

declare(RelationSchema(
    name="subtractive rhyme",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "anchor"),
              ChannelRule("coda", PresentVsAbsent(on=0), "anchor")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    note="ONE structure with additive, per-member specs exchanged. No separate "
         "ORDEREDNESS axis is needed once members are in text order."))

declare(RelationSchema(
    name="semirhyme",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor", unmatched="require_b",
    channels=(ChannelRule("nucleus", AGREE, "anchor"),
              ChannelRule("coda", AGREE, "anchor")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    note="NOT suffix-reachable: the word ends do not agree, which IS the "
         "point. unmatched='exclude' vs pararhyme's MUST-DIFFER is a SPAN "
         "coordinate, not a channel one."))

declare(RelationSchema(
    name="apocopated rhyme",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor", unmatched="require_a",
    channels=(ChannelRule("nucleus", AGREE, "anchor"),
              ChannelRule("coda", AGREE, "anchor")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    note="THE CONVERSE OF SEMIRHYME BY WHICH MEMBER OVERHANGS, and once "
         "members are an ordered tuple in TEXT ORDER that is the ONLY "
         "difference: require_a vs require_b. No separate axis is needed. "
         "FLAG: one Turco summary glosses this as breaking a word across a "
         "line-break, which is BROKEN rhyme. Unresolved; not encoded."))

declare(RelationSchema(
    name="light rhyme", aka=("anisobaric", "Simpsonian"),
    spans=(END_LAST, END_LAST), align="flush_right",
    channels=(ChannelRule("nucleus", AGREE, "last"),
              ChannelRule("coda", AGREE, "last"),
              ChannelRule("prominence", DIFFER, "last")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    note="prominence is a CHANNEL with a MUST-DIFFER predicate, not a filter. "
         "This is the honest word-pair-only label; classify_pair calls any "
         "prominence mismatch 'wrenched', asserting the performative reading."))

declare(RelationSchema(
    name="wrenched rhyme",
    spans=(END_LAST, END_LAST), align="flush_right",
    channels=(ChannelRule("nucleus", AGREE, "last"),
              ChannelRule("coda", AGREE, "last"),
              ChannelRule("prominence", DIFFER, "last"),
              ChannelRule("prominence", AGREE, "last", surface="delivered")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    requires=("delivered",),
    note="THE SAME POINT AS LIGHT RHYME except which SURFACE prominence is "
         "read from. From two words alone they are indistinguishable, so this "
         "schema REFUSES without a delivered surface."))

declare(RelationSchema(
    name="syllabic rhyme",
    spans=(END_UNSTRESSED, END_UNSTRESSED), align="flush_right",
    channels=(ChannelRule("nucleus", AGREE, "last"),
              ChannelRule("coda", AGREE, "last"),
              ChannelRule("prominence", AGREE, "last")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    note="exists precisely BECAUSE the English anchor rule is suspended -- "
         "direct evidence for ANCHOR being an axis."))

declare(RelationSchema(
    name="amphisbaenic rhyme",
    spans=(SpanRule("line_final_token", "word_start", 1, "whole"),
           SpanRule("line_final_token", "word_end", -1, "whole")),
    align="none",
    channels=(ChannelRule("phones", SequenceEqual(reverse_b=True), "sequence"),),
    placement=(Placement("both_line_final"), Placement("different_lines")),
    identity=(DISTINCT,),
    note="the sole forcing case for span DIRECTION being PER MEMBER. The span "
         "direction reverses the INDEX SELECTION; step/pets is one syllable "
         "each, so the reversal has to reach inside the syllable and the "
         "sequence channel is where it does. No orientation axis is needed."))

declare(RelationSchema(
    name="eye rhyme",
    spans=(END_WORD, END_WORD), align="flush_right",
    channels=(ChannelRule("grapheme", AGREE, "last", surface="orthography"),
              ChannelRule("nucleus", DIFFER, "last")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    requires=("orthography",),
    note="an ordinary conjunction once each channel carries the SURFACE it is "
         "read from -- NOT its own realisation axis. Refuses where no "
         "orthographic surface is held (MISSING E-2)."))

declare(RelationSchema(
    name="historical rhyme",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each", surface="earlier"),
              ChannelRule("coda", AGREE, "each", surface="earlier"),
              ChannelRule("nucleus", DIFFER, "anchor")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    requires=("earlier",),
    note="requires the harness to hold TWO declarations at once, which the "
         "singular Declaration dataclass cannot. Stream.alt is that slot."))

declare(RelationSchema(
    name="dialect rhyme",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each", surface="poet"),
              ChannelRule("coda", AGREE, "each", surface="poet"),
              ChannelRule("nucleus", DIFFER, "anchor")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    requires=("poet",),
    note="the Declaration names CMUdict General American, so every Scots "
         "rhyme in this repo is a dialect rhyme BY CONSTRUCTION. Per-DIALECT, "
         "not per-language (MISSING F-3)."))

declare(RelationSchema(
    name="homoioteleuton",
    spans=(END_WORD, END_WORD), align="flush_right",
    channels=(ChannelRule("nucleus", AGREE, "last"),
              ChannelRule("coda", AGREE, "last"),
              ChannelRule("prominence", AGREE, "last")),
    identity=(IdentityRule("morpheme_affix", AGREE),
              IdentityRule("token", DIFFER)),
    placement=(Placement("both_line_final"),),
    normative="forbidden",
    note="THE SINGLE MOST IMPORTANT FALSE-POSITIVE CLASS for any tail "
         "comparator: running/singing scores as a two-syllable near-perfect "
         "match. normative='forbidden' is why it must be DEMOTED, not "
         "rewarded. Refuses without a morphology resource."))

declare(RelationSchema(
    name="polyptoton",
    spans=(HEAD_ANY, HEAD_ANY), align="flush_left",
    channels=(ChannelRule("onset", AGREE, "first"),),
    identity=(IdentityRule("morpheme_root", AGREE),
              IdentityRule("morpheme_affix", DIFFER),
              IdentityRule("token", DIFFER)),
    note="the mirror of homoioteleuton -- shared head vs shared tail. Together "
         "they show a right-edge-only comparator is structurally half-blind."))

declare(RelationSchema(
    name="multisyllabic rhyme",
    spans=(FREE_MULTI, FREE_MULTI), align="flush_right",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", ClassEqual(resource="manner",
                                             label="declared manner partition"),
                          "each"),
              ChannelRule("onset", DIFFER, "first")),
    placement=(Placement("different_lines"),), identity=(DISTINCT,),
    note="the span may BEGIN MID-WORD and the two sides may have different "
         "word counts, so phon.syllabify(word) on a single token cannot even "
         "be called. anchor='searched' carries its own k for the null."))

declare(RelationSchema(
    name="mosaic rhyme",
    spans=(SpanRule("line_final_token", "last_stressed", 1, "to_word_end"),
           SpanRule("free_run", "searched", 1, (2, 5), cross_word=True)),
    align="flush_right",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each")),
    placement=(Placement("both_line_final"), Placement("word_count_differs")),
    identity=(DISTINCT,),
    note="the JUNCTURE asymmetry is CONSTITUTIVE and is computed: "
         "word_count_differs reads the Units' token coordinates. TERM "
         "COLLISION: Turco's mosaic vs compound vs hip-hop's 'compound'."))

declare(RelationSchema(
    name="compound / phrasal rhyme",
    spans=(SpanRule("free_run", "searched", 1, (2, 6), cross_word=True),) * 2,
    align="flush_right",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each")),
    placement=(Placement("both_line_final"), Placement("both_multiword")),
    identity=(DISTINCT,)))

declare(RelationSchema(
    name="holorhyme",
    spans=(WHOLE_LINE, WHOLE_LINE), align="flush_right",
    channels=(ChannelRule("onset", AGREE, "each"),
              ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each")),
    placement=(Placement("adjacent_lines"),),
    identity=(IdentityRule("lexeme_sequence", DIFFER),),
    note="a SPAN of a whole line, not a POSITION within one. rhyme_types.py "
         "has 'holorhyme' as a value of the POSITION axis, which is the "
         "category error this model removes by separating span from placement."))

declare(RelationSchema(
    name="broken rhyme",
    spans=(SpanRule("line_final_token", "word_start", 1, "to_frame_edge"),
           END_ANCHOR),
    align="flush_right",
    channels=(ChannelRule("nucleus", AGREE, "last"),
              ChannelRule("coda", AGREE, "last")),
    placement=(Placement("a_is_split_token"),),
    note="forces the SPAN TERMINATOR value 'frame edge' as distinct from "
         "'word edge'. Needs the LINE as input, which the stream has and a "
         "word-pair comparator never did."))

declare(RelationSchema(
    name="enjambed rhyme",
    spans=(SpanRule("line_final_token", "last_stressed", 1, "to_word_end"),
           SpanRule("free_run", "searched", 1, (1, 3), cross_word=True)),
    align="flush_right",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each")),
    placement=(Placement("across_line_break"),),
    note="the exact converse of broken rhyme: broken SPLITS a word at the "
         "boundary, enjambed BORROWS across it."))

declare(RelationSchema(
    name="rhyming reduplication",
    spans=(SpanRule("token_first_half", "word_start", 1, "whole"),
           SpanRule("token_second_half", "word_start", 1, "whole")),
    align="flush_right",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each"),
              ChannelRule("onset", DIFFER, "first")),
    placement=(Placement("same_token"),), figure=Figure(frame="token"),
    note="perfect rhyme with frame=TOKEN. A tokeniser that treats "
         "higgledy-piggledy as one word makes the relation invisible."))

declare(RelationSchema(
    name="ablaut reduplication",
    spans=(SpanRule("token_first_half", "word_start", 1, "whole"),
           SpanRule("token_second_half", "word_start", 1, "whole")),
    align="flush_left",
    channels=(ChannelRule("onset", AGREE, "each"),
              ChannelRule("coda", AGREE, "each"),
              ChannelRule("nucleus", DirectedDiffer(order=("i", "a", "o")),
                          "each")),
    placement=(Placement("same_token"),), figure=Figure(frame="token"),
    note="THE SOLE FORCING CASE for DIRECTED-DIFFER: ding-dang-dong, never "
         "dong-dang-ding. The order is a DECLARED coordinate."))

declare(RelationSchema(
    name="exact reduplication",
    spans=(SpanRule("token_first_half", "word_start", 1, "whole"),
           SpanRule("token_second_half", "word_start", 1, "whole")),
    align="flush_left",
    channels=(ChannelRule("onset", AGREE, "each"),
              ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each")),
    placement=(Placement("same_token"),), figure=Figure(frame="token")))

declare(RelationSchema(
    name="internal rhyme",
    spans=(SpanRule("any_token", "last_stressed", 1, "to_word_end"),) * 2,
    align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each")),
    placement=(Placement("both_line_final", polarity=False),),
    identity=(DISTINCT,),
    note="polarity=False is the negation: at least one member NOT line-final, "
         "computed. MISSING E-3: this is the song-wide positional graph the "
         "two-line internal_matches could not build."))

declare(RelationSchema(
    name="leonine rhyme",
    spans=(SpanRule("half_line_a", "last_stressed", -1, 1),
           SpanRule("half_line_b", "word_end", -1, 1)),
    align="flush_left",
    channels=(ChannelRule("nucleus", AGREE, "first"),
              ChannelRule("coda", AGREE, "first")),
    placement=(Placement("same_line"), Placement("at_caesura")),
    identity=(DISTINCT,),
    note="requires the caesura, so it REFUSES where none is printed, declared "
         "or searched -- doctrine 55."))

declare(RelationSchema(
    name="cross rhyme",
    spans=(END_ANCHOR, SpanRule("any_token", "last_stressed", 1, "to_word_end")),
    align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each")),
    placement=(Placement("adjacent_lines"), Placement("a_line_final"),
               Placement("exactly_one_line_final")),
    identity=(DISTINCT,),
    note="SPLIT FROM INTERLACED: edge-to-interior. rhyme_types.py names them "
         "as aliases of one coordinate; Turco separates them structurally."))

declare(RelationSchema(
    name="interlaced rhyme",
    spans=(SpanRule("any_token", "last_stressed", 1, "to_word_end"),) * 2,
    align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each")),
    placement=(Placement("adjacent_lines"), Placement("neither_line_final")),
    identity=(DISTINCT,)))

declare(RelationSchema(
    name="linked rhyme",
    spans=(END_ANCHOR, HEAD_LINE), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "first"),
              ChannelRule("coda", AGREE, "first")),
    placement=(Placement("across_line_break"),), identity=(DISTINCT,),
    note="distinguish from broken rhyme (splits a word at the same boundary) "
         "and enjambed rhyme (borrows across it). Three structures, one seam."))

declare(RelationSchema(
    name="head rhyme (positional)",
    spans=(HEAD_LINE, HEAD_LINE), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "first"),
              ChannelRule("coda", AGREE, "first")),
    placement=(Placement("both_line_initial"), Placement("different_lines")),
    identity=(DISTINCT,),
    note="TERM COLLISION SPLIT: 'head rhyme' names both the SEGMENTAL relation "
         "(= alliteration) and this POSITIONAL one, and rhyme_types.py holds "
         "both senses under one name."))

declare(RelationSchema(
    name="anaphora",
    spans=(HEAD_LINE, HEAD_LINE), align="flush_left",
    channels=(ChannelRule("token", AGREE, "first"),),
    placement=(Placement("both_line_initial"), Placement("different_lines")),
    identity=(IdentityRule("token", AGREE),),
    note="doctrine 15: the human 95th percentile is 0.286 on a sonnet and "
         "0.500 on a quatrain, so TEXT LENGTH is a coordinate of the "
         "threshold. A value fact, carried beside the structure."))

declare(RelationSchema(
    name="epistrophe / radif",
    spans=(SpanRule("line_refrain_tail", "word_start", 1, "whole"),) * 2,
    align="flush_right",
    channels=(ChannelRule("token", AGREE, "each"),),
    placement=(Placement("different_lines"),),
    identity=(IdentityRule("token", AGREE),),
    requires=("refrain_tail",),
    note="STRUCTURALLY IDENTICAL TO THE PERSIAN RADIF. Running "
         "mark_refrain_tail() FIRST is what stops suffix alignment grabbing "
         "the epistrophe and calling it the rhyme."))

declare(RelationSchema(
    name="qafiya (before the radif)",
    spans=(SpanRule("line_final_before_refrain", "word_start", 1, "to_word_end"),
           ) * 2,
    align="flush_right",
    channels=(ChannelRule("coda", AGREE, "last"),
              ChannelRule("nucleus", AGREE, "last")),
    placement=(Placement("different_lines"),), identity=(DISTINCT,),
    requires=("refrain_tail",),
    note="THE MISCOUNTED CASE, fixed by ORDER OF OPERATIONS: the refrain tail "
         "is computed first and the qāfiya span is the material BEFORE it. "
         "The nucleus read is None on unvocalised Perso-Arabic and the verdict "
         "propagates that, which is the designed 60.2%."))

declare(RelationSchema(
    name="symploce",
    spans=(HEAD_LINE, HEAD_LINE), align="flush_left",
    channels=(ChannelRule("token", AGREE, "first"),),
    placement=(Placement("both_line_initial"), Placement("different_lines")),
    identity=(IdentityRule("token", AGREE),),
    figure=Figure(nodes=4, edges=((0, 1, "anaphora"), (2, 3, "epistrophe")),
                  frame="line_pair"),
    note="the repetition-family analogue of pararhyme: both edges agree and "
         "the INTERIOR MUST DIFFER, which is constitutive and easy to miss."))

declare(RelationSchema(
    name="anadiplosis",
    spans=(END_WORD, HEAD_LINE), align="flush_left",
    channels=(ChannelRule("token", AGREE, "first"),),
    placement=(Placement("across_line_break"),),
    identity=(IdentityRule("token", AGREE),),
    note="the identity-analogue of linked rhyme: same placement, different "
         "channel map."))

declare(RelationSchema(
    name="epanalepsis",
    spans=(HEAD_LINE, END_WORD), align="flush_left",
    channels=(ChannelRule("token", AGREE, "first"),),
    placement=(Placement("same_line"),),
    identity=(IdentityRule("token", AGREE),)))

declare(RelationSchema(
    name="analysed rhyme",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "anchor"),
              ChannelRule("coda", DIFFER, "anchor")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    figure=Figure(nodes=4,
                  edges=((0, 3, "assonance"), (1, 2, "assonance"),
                         (0, 1, "consonance"), (2, 3, "consonance")),
                  frame="stanza"),
    note="THE CLEANEST PROOF THE TYPE SPACE CANNOT BE PAIRWISE: every one of "
         "the four pairs is an ordinary assonance or consonance and the OBJECT "
         "is the grid. Doctrine 2's Cover, not a partition and not a pair."))

declare(RelationSchema(
    name="monorhyme / leash",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    figure=Figure(quantifier="forall", frame="stanza"),
    note="N-ary. Note that TOKEN IDENTITY is MANDATORY as a refrain and "
         "FORBIDDEN here -- the same phonological point, opposite normative "
         "status, which is why normative status is structural."))

declare(RelationSchema(
    name="chain rhyme (rap)",
    spans=(FREE_MULTI, FREE_MULTI), align="flush_right",
    channels=(ChannelRule("nucleus", AGREE, "each"),),
    placement=(Placement("line_gap_at_most", (4,)),), identity=(DISTINCT,),
    figure=Figure(quantifier="forall", frame="song"),
    note="the object a set partition cannot hold when members overlap "
         "(doctrine 2). Each new member is laid against the ESTABLISHED CHAIN, "
         "so the relation is N-ARY; schemes.Cover is the receiver."))

declare(RelationSchema(
    name="alliterative long line",
    spans=(SpanRule("lift", "word_start", 1, 1),) * 2,
    align="flush_left",
    channels=(ChannelRule("onset", ClassEqual(
        partition=lambda v: "__VOWEL__" if v == () else (
            "".join(v) if "".join(v) in ("sk", "sp", "st") else v[0]),
        label="any vowel with any vowel; sk/sp/st only with themselves"),
        "first"),),
    placement=(Placement("same_line"), Placement("at_lift")),
    identity=(DISTINCT,), requires=("lifts",),
    figure=Figure(quantifier="exists_k", k=2, frame="line"),
    note="THE SHARPEST CASE of a requirement NEGATIVE AND POSITIONAL AT ONCE: "
         "the fourth lift MUST NOT alliterate, which is Placement(polarity="
         "False) on lift_index 3. Refuses without a declared lift template."))

declare(RelationSchema(
    name="fourth lift must not alliterate",
    spans=(SpanRule("lift", "word_start", 1, 1),) * 2,
    align="flush_left",
    channels=(ChannelRule("onset", AGREE, "first"),),
    placement=(Placement("same_line"), Placement("lift_index", (3,))),
    requires=("lifts",), normative="forbidden",
    note="the POLARITY sub-coordinate on PLACEMENT, as its own point."))

declare(RelationSchema(
    name="dvitiyakshara-prasa",
    spans=(SpanRule("line_head_index", "none", 1, 2),) * 2,
    align="flush_left",
    channels=(ChannelRule("onset", AGREE, "first"),),
    placement=(Placement("different_lines"), Placement("line_gap_at_most", (3,))),
    identity=(DISTINCT,), figure=Figure(quantifier="forall", frame="stanza"),
    note="a fixed index counted from the LINE HEAD. mōnai is the same schema "
         "with magnitude=1 -- two types whose only difference is one integer, "
         "which is why placement must be a NUMBER IN A DECLARED FRAME and not "
         "an enum of {end, internal, head}."))

declare(RelationSchema(
    name="monai",
    spans=(SpanRule("line_head_index", "none", 1, 1),) * 2,
    align="flush_left",
    channels=(ChannelRule("onset", AGREE, "first"),),
    placement=(Placement("different_lines"), Placement("line_gap_at_most", (3,))),
    identity=(DISTINCT,), figure=Figure(quantifier="forall", frame="stanza")))

declare(RelationSchema(
    name="cynghanedd groes",
    spans=(HALF_A, HALF_B), align="none",
    channels=(ChannelRule("consonants", SequenceEqual(), "sequence"),),
    placement=(Placement("same_line"), Placement("at_caesura")),
    identity=(DISTINCT,), requires=("caesura",),
    note="neither span is a word, the spans have different word counts, and "
         "the relation is a total ordered map between two multi-word consonant "
         "strings. The single clearest reason a word-pair model cannot reach a "
         "tradition."))

declare(RelationSchema(
    name="cynghanedd draws",
    spans=(HALF_A, HALF_B), align="none",
    channels=(ChannelRule("consonants", SequenceSuffix(min_bridge=1),
                          "sequence"),),
    placement=(Placement("same_line"), Placement("at_caesura")),
    identity=(DISTINCT,), requires=("caesura",),
    note="A head-anchored and TOTAL, B tail-anchored and SEARCHED. A checker "
         "that suffix-aligns both sides gets traws right and croes wrong; one "
         "that head-aligns both gets croes right and traws wrong. NEITHER "
         "SINGLE ALIGNMENT COVERS THE PAIR."))

declare(RelationSchema(
    name="cynghanedd groes o gyswllt",
    spans=(HALF_A, HALF_B), align="none",
    channels=(ChannelRule("consonants", SequenceEqual(), "sequence"),),
    placement=(Placement("same_line"), Placement("spans_overlap")),
    requires=("caesura",),
    note="a relation whose two arguments OVERLAP, which no partition and no "
         "disjoint-span model can hold. Spans are index SELECTIONS, so "
         "overlap is free and is asserted by a placement rule."))

declare(RelationSchema(
    name="cynghanedd sain",
    spans=(SpanRule("any_token", "word_end", 1, 1),) * 2, align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "first"),
              ChannelRule("coda", AGREE, "first")),
    placement=(Placement("same_line"),), identity=(DISTINCT,),
    figure=Figure(nodes=3, edges=((0, 1, "odl"), (1, 2, "alliteration")),
                  frame="line"),
    note="ONE span satisfies two different relations with two different "
         "partners. A word-pair model can express each half and CANNOT express "
         "the chaining -- the forcing case for FIGURE."))

declare(RelationSchema(
    name="cynghanedd sain gadwynog",
    spans=(SpanRule("any_token", "word_end", 1, 1),) * 2, align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "first"),
              ChannelRule("coda", AGREE, "first")),
    placement=(Placement("same_line"),),
    figure=Figure(nodes=4, edges=((0, 2, "odl"), (1, 3, "alliteration")),
                  frame="line"),
    note="the same two edge-types as sain, differing ONLY in the figure "
         "(interleaved at stride 2 vs chained with a pivot). FLAG: single "
         "search-summary source; not verified."))

declare(RelationSchema(
    name="cynghanedd sain lafarog",
    spans=(SpanRule("any_token", "word_start", 1, 1),) * 2, align="flush_left",
    channels=(ChannelRule("onset", AGREE, "first"),),
    placement=(Placement("same_line"),),
    figure=Figure(nodes=3, edges=((0, 1, "odl"), (1, 2, "zero-onset link")),
                  frame="line"),
    note="two ABSENT onsets carry NO EVIDENCE and yet they AGREE, and the "
         "tradition treats that agreement as constitutive. Read.informative "
         "is False and Read.value is True -- cym._sain() requires "
         "bool(b[0].onset) and DELETES this whole type."))

declare(RelationSchema(
    name="cynghanedd sain drosgl",
    spans=(SpanRule("any_token", "word_start", 1, 1),
           SpanRule("any_token", "last_stressed", 1, 1)),
    align="flush_left",
    channels=(ChannelRule("onset", AGREE, "first"),),
    placement=(Placement("same_line"),), normative="deprecated",
    note="THE FORCING CASE FOR ANCHOR BEING DECLARED PER MEMBER: the tradition "
         "has a NAME for the case where the two members of one relation are "
         "located by DIFFERENT anchor rules. 'Trosgl' means clumsy."))

declare(RelationSchema(
    name="cynghanedd lusg",
    spans=(SpanRule("any_token", "word_end", 1, 1), END_PENULT),
    align="flush_left",
    channels=(ChannelRule("nucleus", AGREE, "first"),
              ChannelRule("coda", AGREE, "first")),
    placement=(Placement("same_line"),), identity=(DISTINCT,),
    note="the same object as English APOCOPATED RHYME relocated inside one "
         "line: the final unstressed syllable is excluded."))

declare(RelationSchema(
    name="proest",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("coda", AGREE, "anchor"),
              ChannelRule("nucleus", DIFFER, "anchor"),
              ChannelRule("nucleus", ClassEqual(
                  resource="vowel_class",
                  label="declared vowel class (quantity, and simple vs "
                        "diphthong / lleddf vs talgron)"), "anchor")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    note="a SINGLE CHANNEL carrying TWO predicates at once -- the vowels must "
         "differ in identity AND agree in length class. No one-predicate-per-"
         "channel model can hold it; the channel list is a multiset. DEFECT "
         "P14: with the identity as the class map those two predicates are "
         "each other's NEGATION, so the schema was UNSATISFIABLE and every "
         "real Welsh proest pair read False. RHYME_CANON R11 is the spec — "
         "same quantity and same type — and quality/phonology/cym.py declares "
         "no such partition (Welsh vowel length is not written), so it refuses "
         "for want of `quotient:vowel_class` rather than answering."))

declare(RelationSchema(
    name="Scots vowel-length rhyme (Aitken's Law)",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each"),
              ChannelRule("moras", AGREE, "anchor")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    note="LENGTH as a channel independent of nucleus identity, and rhyme "
         "MORPHOLOGY-SENSITIVE: whether the vowel is long depends on whether a "
         "following /d/ is stem or inflection."))

declare(RelationSchema(
    name="Middle Chinese end rhyme (同用 group)",
    spans=(END_LAST, END_LAST), align="flush_right",
    channels=(ChannelRule("nucleus", ClassEqual(resource="同用",
                                                label="declared 同用 grouping"),
                          "last"),
              ChannelRule("prominence", AGREE, "last")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    note="doctrine 36: the granularity a REFERENCE WORK records is not the "
         "granularity a FORM works at. prominence here carries 平/仄, because "
         "that is what ltc declares -- there is no stress channel at all. "
         "DEFECT P14: the grouping this schema is NAMED for was the identity, "
         "so it compared raw 廣韻 韻 and read 流/樓 -- the rhyme of 登鸛雀樓, "
         "and the pair doctrine 36 is written about -- as False while "
         "ltc.rhymes read True. `quality/phonology/ltc.py` now declares the "
         "grouping as a quotient and this asks for it BY NAME, so a "
         "declaration that authorises none (an English stream, or "
         "standard='qieyun') refuses instead of firing: M-15's complaint that "
         "this schema fired on four lines of English is now structural."))

declare(RelationSchema(
    name="平仄 tonal template",
    spans=(WHOLE_LINE, WHOLE_LINE), align="flush_left",
    channels=(ChannelRule("prominence", AGREE, "each"),),
    figure=Figure(nodes=1, edges=(), template="declared 平仄 pattern",
                  frame="line"),
    note="a relation between a text and a TEMPLATE rather than between two "
         "spans -- the degenerate FIGURE. Doctrine 41: every second line-end "
         "in an isosyllabic form is periodic whether or not anything rhymes."))

declare(RelationSchema(
    name="pantun ABAB",
    spans=(END_LAST, END_LAST), align="flush_right",
    channels=(ChannelRule("nucleus", AGREE, "last"),
              ChannelRule("coda", AGREE, "last")),
    placement=(Placement("both_line_final"), Placement("line_gap_at_most", (2,))),
    identity=(DISTINCT,),
    note="word-final ' is hamzah /ʔ/, a real coda that ENTERS THE RIME, so "
         "pinta' rhymes minta' and not pintar -- a fact about msa's tokeniser, "
         "which is why the tokeniser is injectable. The pembayang/maksud "
         "SEMANTIC DISCONTINUITY is a sense-channel MUST-DIFFER this schema "
         "cannot state without a sense resource (MISSING H-2)."))

declare(RelationSchema(
    name="blues AAB stanza",
    spans=(WHOLE_LINE, WHOLE_LINE), align="flush_left",
    channels=(ChannelRule("token", AGREE, "each"),),
    placement=(Placement("adjacent_lines"),),
    identity=(IdentityRule("token", AGREE),),
    figure=Figure(nodes=3, edges=((0, 1, "repetition"), (0, 2, "perfect rhyme"),
                                 (1, 2, "perfect rhyme")), frame="stanza"),
    note="the letter scheme AAB is a lossy projection that hides that the "
         "first relation is IDENTITY and the third is RHYME. One stanza, three "
         "edge-types."))

declare(RelationSchema(
    name="offbeat internal rhyme",
    spans=(SpanRule("any_token", "last_stressed", 1, "to_word_end"),) * 2,
    align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each"),),
    placement=(Placement("off_beat"),),
    # BOTH, AND THE PAIR IS THE POINT. `requires` is what makes an
    # UNDECLARED grid a REFUSAL — dropping it made this answer
    # looked-and-none instead, which is doctrine 20's collapse and was
    # measured on the way in. The placement is what makes a DECLARED grid
    # selective. Either alone is one of the two defects this schema has
    # now had: a gate with no predicate fires on everything, a predicate
    # with no gate says "no offbeat rhymes here" about a draft nobody
    # asked about the beat of.
    requires=("beat",),
    note="~~UNREPRESENTABLE HERE AND DECLARED SO~~ — REPRESENTABLE SINCE "
         "2026-08-22, and doctrine 4 is untouched. This carried "
         "`requires=('beat',)` and nothing else, which is the same defect "
         "`trite rhyme` had: a bare capability gate cannot make a schema "
         "SELECTIVE, so stamping the capability would have fired this on "
         "every internal nucleus agreement in the draft, on the beat or off "
         "it. It now carries a `Placement('off_beat')` that READS the grid, "
         "which both supplies the capability (a placement naming a frame "
         "demands it) and makes the answer mean what the name says. The grid "
         "itself is DECLARED — `relations.declare_beat` — and doctrine 4's "
         "own words allow exactly that: 'no beat grid without audio OR A "
         "DECLARED TEMPO'. Undeclared, `beat_source` is 'none', the placement "
         "returns None and this refuses, byte for byte as before."))

declare(RelationSchema(
    name="rhyming slang",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each", surface="lexicon"),
              ChannelRule("coda", AGREE, "each", surface="lexicon")),
    requires=("lexicon",),
    note="the only entry whose CONSTITUTIVE MEMBER IS ABSENT FROM THE TEXT. "
         "One span is supplied by a declared slang lexicon, not found in the "
         "stream. Marks the outer limit of a phonological producer."))

declare(RelationSchema(
    name="transformative / bent rhyme",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each", surface="delivered"),
              ChannelRule("coda", AGREE, "each", surface="delivered"),
              ChannelRule("nucleus", DIFFER, "anchor")),
    requires=("delivered",),
    note="THE ANALYSIS OBJECT IS NOT THE TEXT. Refuses without a delivered "
         "surface; distinct from wrenched rhyme, which deforms only "
         "prominence."))

declare(RelationSchema(
    name="sung-delivery rhyme",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each", surface="sung"),
              ChannelRule("moras", AGREE, "anchor", surface="sung")),
    requires=("sung",),
    note="FLAGGED: no settled handbook TERM found. The phenomenon is not in "
         "doubt; naming it would be inventing terminology."))

declare(RelationSchema(
    name="refrain by reference",
    spans=(WHOLE_LINE, WHOLE_LINE), align="flush_left",
    channels=(ChannelRule("token", AGREE, "each"),),
    identity=(IdentityRule("token", AGREE),), requires=("stub_resolution",),
    note="941 instances in the staged corpus. Its last token strips to '&c', "
         "which is not a word. Only the EXCLUSION is built; the resolution is "
         "not, so this refuses on 'stub_resolution' rather than reading a "
         "pointer as text."))

declare(RelationSchema(
    name="incremental repetition",
    spans=(WHOLE_LINE, WHOLE_LINE), align="flush_left",
    channels=(ChannelRule("token", AGREE, "each"),),
    unmatched="exclude", placement=(Placement("line_gap_at_most", (8,)),),
    note="needs a SLOT-LEVEL diff, not line-level equality -- the span is a "
         "line WITH A HOLE IN IT. The model has the hole (a Span is a "
         "selection, so the varied index is simply not in it) and nothing yet "
         "SEARCHES for which index to omit."))

declare(RelationSchema(
    name="trite rhyme",
    spans=(END_ANCHOR, END_ANCHOR), align="anchor",
    channels=(ChannelRule("nucleus", AGREE, "each"),
              ChannelRule("coda", AGREE, "each"),
              ChannelRule("token",
                          ClassEqual(label="declared trite-pair set",
                                     resource="trite"),
                          "anchor", surface="phonemic")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    normative="deprecated",
    note="NOT A PHONOLOGICAL TYPE, and included to mark the BOUNDARY of the "
         "space: it is a coordinate on a VALUE axis orthogonal to all the "
         "structural ones. Kept out of the cell grid deliberately (doctrine "
         "9/48, modal_exclusion in quality/revise.py). "
         "~~requires=('frequency',)~~ REPLACED 2026-08-22 BY A PREDICATE, and "
         "`UNPROVIDABLE`'s entry for `frequency` is why: it recorded, "
         "correctly, that stamping the capability would report 'every "
         "perfect rhyme in the text, labelled trite', because the two "
         "channels above are nucleus AGREE and coda AGREE and NOTHING IN THE "
         "SCHEMA READ A RANK. A bare `requires=` gate cannot make a schema "
         "selective; only a channel can. The third channel reads the "
         "DECLARED trite-pair partition (`quality/quotients.trite`, built "
         "from `lyric_harness.CLICHE_PAIRS`), so the schema now flags the 30 "
         "pairs this repo declares trite and not one rhyme more. No rank, no "
         "threshold, no uncalibrated cut (doctrine 16/22) — and the corpus-"
         "frequency route stays refused for the reason `UNPROVIDABLE` "
         "measured: a pre-1931 table cannot say what is over-familiar to a "
         "living listener."))


# NOT A TYPE, and recorded so nothing stores it as one.
QUERIES = {
    "half rhyme / slant / near / oblique": (
        "a QUERY over the space -- 'anything short of perfect' -- never a "
        "point in it. In practice the four words cover assonance, consonance, "
        "pararhyme, family rhyme, additive/subtractive and light rhyme. A "
        "registry holding it as a coordinate silently merges cells that must "
        "stay apart."),
    "Rhyme Genie residue": (
        "half double / elided / related / diminished rhyme: four names whose "
        "definition pages are egress-blocked. Kept as ONE entry so nobody "
        "mistakes a guess for a structure."),
    "vowelling on / off": (
        "no primary or reliable secondary statement of the rule was "
        "reachable. Not implementable from the entry."),
    "Lyon rhyme": "single unverified search summary; possibly garbled.",
}


def all_schemas():
    return dict(REGISTRY)


def capability_report(stream):
    """Which of the declared types this stream can even be asked about, and
    which capability each refusal is waiting on.  The honest inventory.

    THREE BUCKETS NOW, because "not supplied" was two answers wearing one
    name.  `refused` is unchanged in shape and content -- every schema with a
    missing capability, keyed on the `+`-joined missing set, so a stored
    census stays comparable.  `vacuous` is the SUBSET of those whose every
    missing capability is a DECLARED-BUT-EMPTY frame, and `supply` is the
    per-capability population the split is computed from, so a reader can see
    the number rather than take the bucket's word for it.
    """
    ok, refused, vac = [], {}, {}
    supply = {}
    for n, s in REGISTRY.items():
        caps = s.capabilities()
        for c in caps:
            if c not in supply:
                supply[c] = stream.supply(c)
        miss = [c for c in caps if supply[c].state != "present"]
        if not miss:
            ok.append(n)
            continue
        refused.setdefault(tuple(miss), []).append(n)
        if all(supply[c].state == "empty" for c in miss):
            vac.setdefault(tuple(miss), []).append(n)
    return {"reachable": sorted(ok),
            "refused": {"+".join(k): sorted(v) for k, v in refused.items()},
            "vacuous": {"+".join(k): sorted(v) for k, v in vac.items()},
            "supply": supply}


# ---------------------------------------------------------------------------
# 10z. CAPABILITIES NO DECLARATION CAN SUPPLY -- and WHICH blocker each is
#
# `capability_report` answers "what is missing from THIS stream".  This table
# answers the harder question one level up: which capabilities are missing
# from EVERY stream, because `Stream.provides` has no branch that could ever
# return True for them.  A schema needing one cannot produce an observation on
# any text, so it can never have a matched null either -- which is why
# `quality/relations_null.py` carries a `NEVER_PROVIDED` dict of the same
# shape and reads it for its `cannot_obtain` REMEDY string.
#
# THE CENSUS THAT PRODUCED THIS ran 2026-08-13 over all 77 schemas and found
# THREE such capabilities: `poet`, `frequency`, `stub_resolution`.  TWO have
# since left, each for its own reason, and ONE remains below.
#
#   `poet`       gone -- see ALT_SURFACES; it was one name missing from a
#                tuple, and the two schemas it separated (`dialect rhyme`,
#                `historical rhyme`) are the same schema up to a surface name.
#   `frequency`  RETIRED 2026-08-23 into RETIRED_UNPROVIDABLE, whole. Not
#                because the argument weakened -- it is unchanged and still
#                measured -- but because `trite rhyme` stopped requiring it.
#                See that table for what it costs to reopen the route.
#   `stub_       the one live entry, below.
#    resolution`
#
# The entry below says what `provides` would have to answer, WHY wiring it as
# a flag would be worse than leaving it refused, and which of doctrine 44/92's
# three blockers it is -- because "find a better source" is the answer to only
# one of them.
#
# WHY NOT JUST WIRE THEM.  Both schemas gated on a bare `requires=`, and
# NEITHER reads its capability on any channel.  So making `provides` return
# True does not make either schema CONSULT the thing it is named for; it makes
# the schema fire on the channels it already has and label the output with a
# property it never measured.  Measured for `trite rhyme` on an eight-line
# English fixture, with `provides('frequency')` forced True: it returns
# EXACTLY `perfect rhyme`'s four instances -- cat/hat and moon/tune, which are
# in no cliche list, alongside fire/desire and night/light, which are -- and
# nothing in the output can tell the two apart.  That is manufacturing a
# result, and it is the defect this whole area exists to prevent.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Unprovidable:
    """One capability `Stream.provides` cannot answer True for, and why."""
    capability: str
    schemas: tuple
    #: what a branch in `provides` would have to be handed
    needs: str
    #: what firing WITHOUT that would report, and why it would be wrong
    would_manufacture: str
    #: 'build' | 'obtain' | 'disjoint' -- doctrine 44's two and doctrine 92's
    blocker: str
    detail: str = ""


UNPROVIDABLE = (
    Unprovidable(
        capability="stub_resolution",
        schemas=("refrain by reference",),
        needs=(
            "a declared map from a stub LINE to the SPAN of lines it points "
            "at -- not a line pointer, a span, because `&c.` stands for a "
            "whole chorus and nothing in the text says how many lines that "
            "is. `Stream.line_status` already MARKS the stub and "
            "`lyric_harness.chorus_stub_match` already names which "
            "tradition's convention it read; what is absent is the "
            "resolution, and `relations.py` ships no detector on purpose "
            "(BACKLOG 2.4: `&c.` is an EDITION's fact, not English's)."),
        would_manufacture=(
            "ordinary verbatim refrains, reported as refrains BY REFERENCE. "
            "The schema's one channel is token AGREE over the whole line, so "
            "with the flag set and the stub still tokenising to `c` it would "
            "fire on every exactly-repeated line in the text and on no stub "
            "at all -- the inverse of what it is for."),
        blocker="build",
        detail=(
            "DOCTRINE 44's 'hard to build', and `quality/declared_inputs.py` "
            "says so first: its header excludes this row from the six "
            "declared-input families precisely because the map 'is derivable "
            "from the text itself', making it a producer defect (P10) and "
            "not an input nobody can supply. HOW HARD, measured 2026-08-13 "
            "over `corpus/song/`: 843 stub lines; matching each stub's "
            "incipit against earlier lines resolves 158 (18.7%) to a UNIQUE "
            "earlier line, leaves 224 (26.6%) with no earlier match at all, "
            "and 461 (54.7%) ambiguous between 2 and 9 candidates. And a "
            "unique match still gives only the chorus's FIRST line. So the "
            "naive resolver is wrong more often than right and the honest "
            "version is an edition-level annotation. "
            "SECOND, INDEPENDENT BLOCKER, and it is the one that decides the "
            "question: `relations_null.null_menu('refrain by reference', "
            "'count')` is EMPTY -- no randomisation in `NULLS` moves "
            "whole-line token identity, so the schema's primary statistic "
            "CANNOT FAIL (doctrine 63/68). Wiring the capability would "
            "therefore start a schema firing with no null behind it, which "
            "is the exact move this area exists to prevent. The positional "
            "statistics DO have a menu (local_fraction@0/@2 under "
            "global_redeal), so a resolution built later must be reported on "
            "those and never on `count`."),
    ),
)


#: RETIRED, AND KEPT WHOLE (2026-08-23, doctrines 3/24 and 17).
#:
#: An entry here is one whose CAPABILITY is still unprovidable and whose
#: ARGUMENT still stands, but which no schema asks for any more -- so it is
#: out of `UNPROVIDABLE`, where `check_unprovidable` would (correctly) report
#: it as an entry that outlived its schema. It is not deleted: the reason a
#: capability cannot be supplied does not stop being true because the schema
#: that wanted it was re-founded, and the next person to reach for it needs
#: the measurement, not a fresh afternoon.
#:
#: `poet` left the table the other way and left only a sentence behind, in
#: the section header above. That was thinner than it should have been. This
#: is the shape retirements take from now on.
#:
#: `frequency` -- retired because `trite rhyme` stopped requiring it. The
#: schema gated on a bare `requires=("frequency",)` and READ IT ON NO
#: CHANNEL, which is the "capability vs predicate" defect: a bare `requires=`
#: gate cannot make a schema selective, so the schema fired on the channels
#: it already had and wore a label about a rank it never consulted. It now
#: carries `ClassEqual(resource="trite")` over the repo's own declared
#: `CLICHE_PAIRS`, which is a DIFFERENT and narrower question -- "are these
#: two a declared trite pair", with no rank and no threshold -- and it is
#: answered by a declaration rather than by a frequency table.
#:
#: NOTHING BELOW IS SUPERSEDED BY THAT. The argument is about the FREQUENCY
#: ROUTE, and every word of it still holds for anyone who wants to build one:
#: the only admissible sources are pre-1931, so a frequency-driven trite
#: detector would flag `me`/`thee` hardest and miss `baby`/`crazy` entirely.
#: That is doctrine 92's disjunction, measured, and it is why the narrow
#: declared-list question was the one worth answering.
RETIRED_UNPROVIDABLE = (
    Unprovidable(
        capability="frequency",
        schemas=("trite rhyme",),
        needs=(
            "a rank over RHYME PAIRS at the line-final position, joined to "
            "the stream, PLUS a declared cut on that rank. `quality/"
            "frequency.py` already serves ranked tables and "
            "`data/song_rhymepair_en.tsv` is already the pair-keyed shape "
            "(15,409 distinct pairs, 91,636 tokens, per author), so the "
            "DATA half is not the blocker -- doctrine 44's 'hard to build' "
            "does not apply and neither does 'cannot obtain'."),
        would_manufacture=(
            "every perfect rhyme in the text, labelled trite. The schema's "
            "two channels are nucleus AGREE and coda AGREE on the PHONEMIC "
            "surface; nothing in it reads a rank."),
        blocker="disjoint",
        detail=(
            "DOCTRINE 92, and it is `quality/phrase_commonplace.py`'s "
            "recorded finding one level down -- that module refuses at the "
            "PHRASE level for exactly this reason and this is the same "
            "disjunction at the RHYME-PAIR level. A cliche is over-familiar "
            "TO A LIVING LISTENER; every admissible English source here is "
            "pre-1931 by the provenance gate. MEASURED 2026-08-13 against "
            "`lyric_harness.CLICHE_PAIRS`, the repo's own 30-pair list: 7 of "
            "the 30 have count ZERO in the pre-1931 table (beats/streets, "
            "feel/real, tears/years, girl/world, alone/phone, baby/crazy, "
            "cash/stash) -- the modern stock, invisible; and the table's own "
            "top by author dispersion is me/thee (1,080 over 51 authors), "
            "be/thee (482 over 50), away/day (805 over 61), none of which is "
            "a cliche to anyone now. Eleven of the top fifteen are not in "
            "the list at all. So a frequency-driven trite detector built on "
            "the only admissible source would flag `me`/`thee` hardest and "
            "miss `baby`/`crazy` entirely. `frequency.NO_INDEPENDENT_SOURCE` "
            "already names the source that would fix it -- cell `eng-verse`, "
            "'CONTEMPORARY English sung verse ... nothing in this repo has "
            "all three, and nothing can'. WHAT WOULD LIFT IT: the same thing "
            "that lifts eng-verse, i.e. a line-structured, rhyme-bearing, "
            "post-1960 English corpus under a licence this repo accepts. "
            "SEPARATELY, and it does not depend on the corpus: the schema is "
            "`normative='deprecated'` and CLAUDE.md doctrine 9/48 keeps it "
            "out of the cell grid on purpose, so even with the source the "
            "cut would be an UNCALIBRATED THRESHOLD (doctrine 16/22) that "
            "must be stated as a false-positive rate before it means "
            "anything. "
            "RE-MEASURED 2026-08-22 AGAINST THE TWO OTHER SHIPPED SOURCES, "
            "because the entry above cites only `song_rhymepair_en.tsv` and "
            "the obvious next move is to reach for one of the other two. "
            "They are the two HALVES of doctrine 92's disjunction and "
            "`quality/frequency.py` already names the whole: "
            "`NO_INDEPENDENT_SOURCE['eng-verse']` says the cell needs the "
            "right POSITION, the right MEDIUM and the right PERIOD and that "
            "nothing here has all three. (1) `data/song_endword_en.tsv` -- "
            "13,989 distinct line-final words, 251,544 tokens -- has the "
            "position and the medium and is pre-1931: its head is `me` "
            "(2,948 over 483 authors) and `thee` (2,031 over 359), and 9 of "
            "its top 20 are words from this repo's own CLICHE_PAIRS, so a "
            "commonness cut on it flags `thee` as among the two tritest "
            "line-endings in English. (2) `lyric_harness.Lexicon.freq_rank` "
            "is `data/opensubtitles_en_50k.tsv`, 49,999 entries, and has the "
            "PERIOD and neither of the others -- it is contemporary SPOKEN "
            "English with no line-final position at all, which is "
            "`frequency.py`'s own `eng-spoken`. THE TWO DISAGREE, and that "
            "is the measurement rather than the argument: over the 58 of the "
            "60 CLICHE_PAIRS words present in both, Spearman between the "
            "pre-1931 line-final rank and the contemporary spoken rank is "
            "**0.319** -- `rhyme` is line-final rank 811 against spoken "
            "9,131, `skies` 62 against 5,647, `crazy` 6,294 against 388. So "
            "the answer to 'is this pair trite' is decided by WHICH TABLE is "
            "read, and neither table is the cell that would settle it. "
            "A THIRD BLOCKER, and it is the cheapest to check: "
            "`song_endword_en.tsv`'s own header records that it is NOT "
            "INDEPENDENT of `corpus/song/` (doctrine 13), so scoring a "
            "corpus item with it needs leave-one-author-out -- "
            "`frequency.py` refuses to serve it otherwise -- and a `Stream` "
            "carries no author coordinate to leave out. The item this "
            "vacuity was measured on, `eng_american_dan_e_townsend`, has 20 "
            "rows IN the table. Supplying `frequency` from it would "
            "therefore need a DECLARED author on the stream before it could "
            "be read at all, and would still be answering a different "
            "question from the one the schema's name asks."),
    ),
)


def check_unprovidable(stream):
    """MEASURE every UNPROVIDABLE claim.  -> list of finding strings, empty
    when every entry still holds.

    Fails in BOTH directions, like `check_inert`.  An entry whose capability
    has become reachable is a stale table, not a passing test -- that is the
    day the entry has to be replaced by the wiring and by whatever null the
    newly-firing schema is reported against.  An entry naming a capability no
    schema asks for any more is an entry that outlived its schema.
    """
    out = []
    named = {c for s in REGISTRY.values() for c in s.capabilities()}
    for e in UNPROVIDABLE:
        if e.blocker not in ("build", "obtain", "disjoint"):
            out.append(f"{e.capability}: blocker {e.blocker!r} is not one of "
                       f"doctrine 44/92's three")
        if e.capability not in named:
            out.append(f"{e.capability}: DECLARED UNPROVIDABLE and no schema "
                       f"asks for it — the entry outlived its schema, retire "
                       f"it")
        if stream is not None and stream.provides(e.capability):
            out.append(f"{e.capability}: DECLARED UNPROVIDABLE and this "
                       f"stream SUPPLIES it — the declaration is false, and "
                       f"{', '.join(e.schemas)} now fires. Replace the entry "
                       f"with the wiring and name the null it is reported "
                       f"against.")
        for name in e.schemas:
            if name not in REGISTRY:
                out.append(f"{e.capability}: names schema {name!r}, which is "
                           f"not in the registry")
            elif e.capability not in REGISTRY[name].capabilities():
                out.append(f"{e.capability}: names schema {name!r}, which no "
                           f"longer requires it")
    # AND THE RETIRED TABLE, IN THE OTHER DIRECTION (2026-08-23). A
    # retirement is a claim too -- "no schema asks for this any more" -- and
    # it can stop being true without anyone noticing, which is how the entry
    # this function retired came to be wrong in the first place. A capability
    # that comes back into a schema's `capabilities()` needs its argument
    # back in the LIVE table, where the schema-naming checks above run on it.
    for e in RETIRED_UNPROVIDABLE:
        if e.capability in named:
            askers = sorted(s.name for s in REGISTRY.values()
                            if e.capability in s.capabilities())
            out.append(f"{e.capability}: RETIRED as unprovidable, and a "
                       f"schema asks for it again ({', '.join(askers)}). "
                       f"Move the entry back into UNPROVIDABLE, or supply it "
                       f"and name the null it is reported against.")
        if stream is not None and stream.provides(e.capability):
            out.append(f"{e.capability}: RETIRED as unprovidable and this "
                       f"stream SUPPLIES it — the argument in "
                       f"RETIRED_UNPROVIDABLE is now false and has to be "
                       f"re-measured, not left standing.")
    return out


# ---------------------------------------------------------------------------
# 10a. INERT DECLARED COORDINATES -- declared, and CHECKED to be inert
#
# Doctrine 1 says every analysis states its assumptions and they live in a
# coordinate.  The failure mode this section exists for is the inverse: a
# coordinate NOBODY READS is a stated assumption that is not in force, so the
# declaration lies about what the analysis depends on.  This repo has found
# six of them -- `Span.unit`, `SpanRule.terminator`, `RelationSchema.
# traditions`, `Span.search_k`, `grid.Line.beat`/`.duration`, and
# `rhyme_constraints.Span.unit`.  Four were closed by WIRING, one by
# DELETION, and the remainder are declared here.
#
# Doctrine 48 is why this is a table and a function rather than a paragraph:
# "declared inert, with the reason" is a principle that lives only in prose
# and gets followed exactly as often as someone remembers it.  `check_inert()`
# MEASURES the claim on a real stream, so the declaration is a test.  It fails
# in BOTH directions, which is the part that matters -- if a later session
# starts setting one of these fields, the entry saying it is inert becomes
# false and this says so, instead of the field quietly acquiring a semantics
# nobody declared.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Inert:
    """A field that is declared and read by nothing, KEPT on a stated
    argument.

    `blocker` is doctrine 44/92's three-way split and is the load-bearing
    coordinate: "build the thing" is the answer to only one of them.
      'build'    -- hard to build, and nothing else is in the way.
      'obtain'   -- the input cannot be obtained at all.
      'disjoint' -- both halves exist and never co-occur in one object.
    """
    field: str
    reason: str
    activates_when: str
    blocker: str            # 'build' | 'obtain' | 'disjoint'
    measured: str           # the command that produced the numbers above


INERT = (
    Inert(
        field="Span.unit",
        reason=(
            "declared on every Span and read by nothing in this module, and "
            "not merely unread -- NOT SETTABLE. All five `Span(...)` sites in "
            "`_spans_at` pass the literal 'syllable', so the field takes "
            "exactly one value over every span the registry can produce "
            "(census printed by the command below, so the count is measured "
            "rather than recorded -- doctrine 58). That is a constant wearing "
            "a coordinate's name. `SpanRule` has no `unit` either, so no "
            "schema can ask for a different one."),
        activates_when=(
            "a SpanRule gains `unit` AND the Stream carries a parallel index "
            "stream at that granularity. Wiring the field to the syllable "
            "stream it already indexes would close nothing: it would be the "
            "same constant, assigned instead of defaulted."),
        blocker="disjoint",
        measured="python3 quality/relations.py --inert metidja.txt"),
    Inert(
        field="rhyme_constraints.Span.unit",
        reason=(
            "the SAME field in the sibling module, where it IS read -- "
            "`read_channel` branches on `extent.unit != 'syllable'` into "
            "`_phone_projection`. Measured over that module's registry the "
            "branch is DEAD: 40 of 40 member spans declare 'syllable', so the "
            "projection path is unreachable from any shipped constraint. The "
            "read exists and the values do not, which is why grepping for a "
            "read is not a measurement of one."),
        activates_when=(
            "a constraint in that registry declares unit='phone' or "
            "'grapheme'. The consumer is already written, so that module is "
            "one declared value away and this one is not."),
        blocker="build",
        measured="python3 quality/relations.py --inert metidja.txt"),
    Inert(
        field="rhyme_constraints.Span.terminator@branch",
        reason=(
            "A SEVENTH SHAPE, and the nastiest so far: a branch that RUNS and "
            "cannot branch. `_extent_from` reads terminator to pick between "
            "the locus edge and the frame edge, and the read is reachable "
            "only where magnitude is an int -- 11 of that registry's 40 "
            "member spans, and every one of those 11 falls through to the "
            "frame side; 'locus_edge' occurs only on `to_locus_end` members, "
            "where the read is unreachable. So the field has three declared "
            "values and one behaviour. Neither a grep for a read nor a "
            "coverage report can find this; only censusing the BRANCH does, "
            "which is what the entry below does and why its census maps "
            "values through the branch they select rather than counting "
            "them -- run the command below on any real multi-line draft and "
            "the locus-edge side never appears."),
        activates_when=(
            "a constraint declares an INTEGER magnitude together with "
            "terminator='locus_edge'. That combination is what the field was "
            "written for -- take n units but stop at the token boundary -- "
            "and no shipped constraint asks for it."),
        blocker="build",
        measured="python3 quality/relations.py --inert metidja.txt"),
)

#: `Span.unit`'s blocker is 'disjoint' and NOT 'build', which is the whole
#: content of the entry.  A granularity ladder needs two properties in ONE
#: object -- a phonology that declares a sub-syllabic or supra-syllabic unit,
#: and a stream indexed in that unit -- and the repo has each of them
#: separately and never together.  Three of the nine shipped phonologies (fas,
#: san, som) declare `grid_unit='mora'`, so the DECLARATION half exists; all
#: nine return `Syllable`s from `syllabify()` and `build_stream` indexes those,
#: so the STREAM half is the syllable for every one of them, including the
#: three that declared otherwise.  Meanwhile the CONSUMER half exists in
#: `rhyme_constraints.read_channel`, in a module whose own registry never sets
#: the field.  Every piece is built; no two are in the same object.  So "build
#: the granularity ladder" is the wrong instruction: what is owed is a
#: `Phonology.units(word, unit=...)` seam that lets a phonology return its
#: DECLARED unit, and the three mora languages are where it would be tested
#: (doctrine 37 -- against the tradition, not against its own rules).


def inert_census(stream):
    """-> {field: (n_observations, sorted values)} for every INERT entry.

    The census is the measurement and the entries do not carry the number,
    because a count written into a docstring is a threshold nobody wrote down
    (doctrine 58) and this one moves with the text it is taken over.
    """
    out = {}
    for e in INERT:
        cls, _, name = e.field.rpartition(".")
        if cls == "Span":
            if name not in Span.__dataclass_fields__:
                out[e.field] = (0, ["<field deleted>"])
                continue
            vals, n = set(), 0
            for schema in REGISTRY.values():
                for rule in schema.spans:
                    try:
                        for sp in enumerate_spans(rule, stream):
                            vals.add(getattr(sp, name))
                            n += 1
                    except NoReferent:
                        continue
            out[e.field] = (n, sorted(map(repr, vals)))
        elif cls == "rhyme_constraints.Span":
            try:
                from quality import rhyme_constraints as _C
            except Exception as exc:                        # noqa: BLE001
                out[e.field] = (0, [f"<unimportable: {exc}>"])
                continue
            members = [m for con in _C.REGISTRY.values()
                       for m in getattr(con, "members", ()) or ()]
            if name == "terminator@branch":
                # Census the BRANCH, not the field. The field has three values
                # and two of them select the same side, so counting values
                # would report it LIVE while its behaviour is a constant --
                # which is the entry's whole point. Only members with an INT
                # magnitude reach the read at all; the rest are censused as
                # unreachable rather than silently counted as agreeing.
                reach = [m for m in members
                         if not isinstance(m.span.magnitude, str)]
                out[e.field] = (
                    len(reach),
                    sorted({"locus-edge side"
                            if m.span.terminator == "locus_edge"
                            else "frame side" for m in reach}))
            else:
                out[e.field] = (len(members),
                                sorted({repr(getattr(m.span, name))
                                        for m in members}))
        else:
            out[e.field] = (0, ["<no census for this class>"])
    return out


def check_inert(stream):
    """MEASURE every INERT claim on a real stream. -> list of finding strings,
    empty when every declaration holds.

    A declaration that has quietly become false is a finding here, in EITHER
    direction: a field that gained a second value is no longer inert and its
    entry now lies in the other direction, and a field that vanished has been
    closed without its entry being retired.

    THIS FUNCTION USED TO TAKE `chans=DEFAULT_CHANNELS` AND NEVER READ IT --
    an unread coordinate inside the function whose entire job is to catch
    unread coordinates.  No caller ever passed it.  Removed 2026-08-13 rather
    than given an INERT entry, because the three honest ends are wire, delete,
    or keep-and-declare, and a parameter no schema and no declaration asks for
    is the delete case.
    """
    out = []
    census = inert_census(stream)
    for e in INERT:
        n, vals = census[e.field]
        if vals == ["<field deleted>"]:
            out.append(f"{e.field}: DECLARED INERT and no longer exists — the "
                       f"entry outlived the field, retire it")
        elif vals and vals[0].startswith("<"):
            out.append(f"{e.field}: cannot be measured — {vals[0]}")
        elif len(vals) > 1:
            out.append(f"{e.field}: DECLARED INERT and takes {len(vals)} "
                       f"values over {n} observations ({', '.join(vals)}) — "
                       f"it is LIVE now, so the declaration is false and the "
                       f"reason must be replaced by what reads it")
        elif n == 0:
            out.append(f"{e.field}: no observations on this stream, so the "
                       f"inertness claim was not tested — not a pass")
        if e.blocker not in ("build", "obtain", "disjoint"):
            out.append(f"{e.field}: blocker {e.blocker!r} is not one of "
                       f"doctrine 44/92's three")
    return out


# ---------------------------------------------------------------------------
# 11. TRADITIONS.  M-15: `RelationSchema.traditions` was declared on all 77
#     schemas and populated on ZERO, so "Middle Chinese end rhyme (同用 group)"
#     fired on four lines of English and nothing in the output could say that
#     the RULE SHAPE had matched and the tradition had not (doctrine 43).
#
# THE SOURCE IS `quality/RHYME_CANON.md`, NEVER THE SCHEMA NAME.  Reading a
# tradition off a name is the `gabay higaad` error: that entry was
# reconstructed from this repository's own modules and read back as external
# confirmation (RHYME_CANON §0, §5.3).  Every Tradition below therefore cites
# the canon ENTRY that names it, and `CANON` carries that entry's `from:` line
# verbatim so the citation can be checked without leaving this file.
#
# WHAT THE CITATION CAN AND CANNOT CARRY.  A canon entry names its traditions
# in one alias line and cites its inventory indices in another, and it does NOT
# attribute individual names to individual indices.  So a Tradition records the
# ENTRY that names it, not the index -- stated rather than faked.  The
# consequence is `cell_cited` below: where an entry cites indices from an
# inventory cell whose traditions it never names, the source cannot say whether
# a language in that cell belongs to the structure or not, and the answer is
# "cannot tell" rather than "no".
#
# A SCHEMA WITH NOTHING SOURCEABLE IS LEFT EMPTY AND SAYS WHY.  `UNSOURCED`
# is not a TODO list; it is the honest half of the answer.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Tradition:
    """One tradition a schema is scoped to.

    `lang` is a language code so a declaration can be compared against it; it
    is "" where the canon names a tradition but this repo has no code for its
    language.  `source` is a key into `CANON`.

    `witness` IS TRI-STATE AND THE THIRD VALUE IS THE POINT (M-15a, doctrine
    28).  `source` says which canon entry names this tradition; it never said
    whether anything OUTSIDE this project ever did, and for one round every
    `Tradition.source` in the file was an `R<n>` pointing back into a document
    whose own `from:` lines pointed at an array that was not in the repository.
    The array is now inlined as `quality/canon_index.tsv`, so the question is
    answerable:

      'external'  every survey index the canon entry cites IN THIS LANGUAGE'S
                  inventory cell records a witness outside this project, so
                  whichever of them carries the name, the name is not ours
      'project'   every one of them records only a `quality/*` module, a
                  `CLAUDE.md` doctrine, or the author's recollection.  This is
                  the `gabay higaad` class and it is LABELLED rather than
                  quietly dropped: an invented name that says it was invented
                  is fine, an invented name that reads as attested is not
      None        cannot tell -- the entry cites nothing in that cell, or the
                  cited indices disagree, or they were never recovered.  None
                  PROPAGATES; it is never rendered as 'no'

    `cites` is the cell-restricted index set the verdict was computed over and
    `why` is the sentence that computed it, so a reader can disagree with the
    verdict without re-deriving it.  A canon entry names its traditions in one
    line and its indices in another and NEVER attributes a name to an index --
    so a per-name citation would be a fabrication, and the honest object is the
    SET plus a verdict that holds however the attribution falls.
    """
    name: str
    lang: str
    source: str
    witness: object = None
    cites: tuple = ()
    why: str = ""

    def __str__(self):
        return f"{self.name}" + (f" [{self.lang}]" if self.lang else "")

    def attested(self):
        """True / False / None -- never collapse the last two."""
        return None if self.witness is None else (self.witness == "external")


#: RHYME_CANON.md §2 entries cited below, with each entry's `from:` line
#: verbatim.  The prefix of an index is its inventory CELL (§1): E=english(74),
#: C=celtic(64), G=germanic/finnic(89), S=semitic-persian(126),
#: I=indic-seasian(74), X=east-asian-romance(174).  A ✓ marks an entry the
#: truncated synthesis could see; everything unmarked was invisible to it.
CANON = {
    "R1": ("tail-rime", "✓E1 ✓E10 C22 G22 G32 G33 G44 G52 G53 G86 X37 X55 X64 "
           "X89 X110 I39 I43 I47 I48 I52 I65 S99 X129 X130"),
    "R2": ("leftward-extended rime", "✓E2 X131 X70 X157 G56 G59 S35 S112"),
    "R3": ("whole-final-unit agreement, onset included", "I6 I20 S111"),
    "R5": ("assonance", "✓E4 C45 C58 G54 G89 X78 X90 X111 X152 S123 X127"),
    "R6": ("run assonance", "✓E29 ✓E71 X38 X63"),
    "R9": ("consonance", "✓E5 G55 X79"),
    "R10": ("cluster consonance across the syllable boundary", "G1 ✓E5"),
    "R11": ("consonance with a class requirement on the differing channel",
            "C23 C46 C24"),
    "R12": ("pararhyme / frame rhyme", "✓E7 ✓E72 S46"),
    "R13": ("directional-difference pararhyme", "✓E69 X59 X159"),
    "R14": ("reverse rhyme / strong alliteration", "✓E8 G83 G84 G87 X36"),
    "R15": ("unanchored consonant set", "✓E6 S123 X101 X127 I3 I45"),
    "R16": ("homorganic / place-class agreement", "I4 ✓E11"),
    "R21": ("unmatched trailing material EXCLUDED", "✓E14 ✓E15 X69 C13"),
    "R23": ("additive / subtractive", "✓E12 ✓E13 S47 S48"),
    "R26": ("prominence MUST DIFFER", "✓E16 C26 C49"),
    "R27": ("prominence coerced by the delivered surface", "✓E17 ✓E25 ✓E74"),
    "R28": ("anchor rule DISABLED, both anchors unstressed", "✓E18"),
    "R29": ("alliteration", "✓E9 ✓E48 C1 C29 C47 G6 G7 G8 G9 G28 G29 G36 G37 "
            "G38 G43 G45 G49 G50 G79 G82 G84 G87 I1 I2 I7 I18 I40 X21 X36 X54 "
            "X101 X127 X145 I53 S123"),
    "R30": ("fixed-index-from-the-head agreement", "I7 I8 I9 I10 I11 I18 I19"),
    "R32": ("the qāfiya slot apparatus", "S1 S2 S3 S4 S5 S6 S7 S8 S9 S10 S11 "
            "S12 S13 S14 S15 S16 S17 S74 S75 S76 S77 S78 S79 S80 S81 S82 S83 "
            "S94 I30 I31 I32 I33 I34 I35 I36 I29 S100"),
    "R34": ("line-head rhyme", "✓E41 G66 C29"),
    "R35": ("exhaustive ordered consonant skeleton across a caesura",
            "✓C1 ✓C2 ✓E50"),
    "R36": ("skeleton with an unanswered bridge", "✓C5 ✓C6 C16 C17"),
    "R37": ("skeleton whose split point falls inside a cluster", "✓C3"),
    "R43": ("tone-class agreement at the rhyme",
            "X1 X2 X3 X29 X62 I65 I70 I72"),
    "R44": ("tone-class template over a line", "X14 I71 I60 I61 X31 X51 X52 I63"),
    "R50": ("vowel length / quantity as a channel", "C34 ✓E24 S5 I22 I52 G53"),
    "R53": ("grapheme channel", "✓E20 G70 X83 X136 X137 S58 S59"),
    "R54": ("morphological-affix rhyme",
            "✓E63 G58 G86 X75 X102 S71 S96 S98 S85 S86 S87 S115 X55"),
    "R55": ("shared-root, differing-inflection",
            "✓E64 G58 X74 X105 X122 X146 X159 S53"),
    "R56": ("same form, different sense", "✓E65 G57 X72 X138 X160 S114 S45 S55 "
            "S66 I12 I13 I14 I26 I5 I15 I41 I16 S24 S108 X34 X45"),
    "R59": ("candidate-field scarcity as the defining property",
            "✓E66 X114 X158 S119 X95 X113 X87"),
    "R60": ("verbatim span returning at scheduled positions",
            "✓E3 ✓E54 ✓E55 C62 C64 G14 G26 G27 G75 G77 G88 S67 S90 S91 S122 "
            "X24 X44 X53 X118 X125 X154 X172 X98 S40 I42"),
    "R61": ("verbatim span at the line tail, after the rhyme",
            "S72 S73 S115 S116 I28 ✓E59 X107 S92"),
    "R62": ("anadiplosis / tail-to-head across a seam",
            "✓E61 ✓E40 C33 C27 C51 C52 C53 G11 G34 G47 G67 G76 X25 X143 X144 "
            "X167 X168 X119 I46 I25 X46 I58 X107 S65"),
    "R64": ("anaphora / head-to-head identity", "✓E58 C30 X107 X169 X57"),
    "R65": ("epanalepsis / symploce / double-edge identity",
            "✓E60 ✓E62 S64 X141 X142"),
    "R66": ("reduplication inside one token", "✓E68 ✓E70 I27 I51 X23 X60 G48"),
    "R67": ("repetition-with-one-controlled substitution",
            "✓E56 G30 G85 X120 X119"),
    "R69": ("forbidden repetition inside a moving window",
            "X48 C40 S23 S24 X13 X96 X147 I74 I64 I37 S74"),
    "R71": ("internal rhyme", "✓E36 G63 X82 X116 X149 S117 I55 X56"),
    "R72": ("leonine / caesura-to-line-end within one line",
            "✓E37 G65 G51 X132 S36 S88 S101 S39"),
    "R73": ("line-end into next-line interior",
            "✓E38 C28 C48 X81 X139 I66 I54 I56 I62"),
    "R74": ("interior-to-interior across lines", "✓E39 G64 X56"),
    "R77": ("beat-grid placement", "✓E42"),
    "R80": ("chained pivot: two different relations sharing one member", "✓C8"),
    "R81": ("interleaved two-relation figure at stride 2", "✓C9"),
    "R82": ("sain with a zero-onset pivot", "✓C10"),
    "R83": ("sain with anchor-mismatched members", "✓C11"),
    "R85": ("four-place grid", "✓E52"),
    "R90": ("n-ary class over a run",
            "✓E43 ✓E45 S38 X5 I47 G33 G73 I70 S118 X152 X99"),
    "R91": ("∀-members-of-a-frame", "✓E49 X145 I17 S59"),
    "R92": ("self-relation under an involution",
            "✓E19 S52 X26 X47 G35 X155 X106 G40 I17"),
    "R96": ("rhyme member assembled across a word boundary (mosaic)",
            "✓E30 ✓E31 C44 C14 G69 X76 S56 S57 X160"),
    "R97": ("whole-line phonetic identity with different segmentation",
            "✓E34 X148 I14 X104 X45"),
    "R98": ("member split by the line break", "✓E32 ✓E33 G68 G81 S37 X94"),
    "R105": ("scheme declarations as set partitions over line indices",
             "✓E44 G73 X88 X153 X126 S125 I73 C25 S93 S121 I43 I49 X100 X99 "
             "G81 X125"),
    "R111": ("reading tradition as a transform",
             "S107 X62 ✓E21 ✓E22 ✓E23 X137"),
    "R113": ("required difference at a NON-rhyming position", "X10 X11 G41 C36"),
    "R115": ("rhyme licensing a lexical substitution and then deleted from the "
             "surface", "✓E67"),
}

#: language code -> the inventory CELL it would have been surveyed in.  Used
#: only to answer "does the canon entry cite this language's cell without
#: naming any tradition in it", which is the difference between "the source
#: says no" and "the source cannot say".
LANG_CELL = {
    "eng": "E", "sco": "E",
    "cym": "C", "gle": "C", "gla": "C",
    "non": "G", "isl": "G", "dan": "G", "swe": "G", "nor": "G",
    "ang": "G", "deu": "G", "gmh": "G", "goh": "G", "nld": "G", "fin": "G",
    "ara": "S", "heb": "S", "fas": "S", "tur": "S",
    "san": "I", "tam": "I", "tel": "I", "kan": "I", "hin": "I",
    "tha": "I", "vie": "I", "msa": "I",
    "ltc": "X", "cmn": "X", "jpn": "X", "kor": "X",
    "ita": "X", "spa": "X", "por": "X", "glg": "X", "fra": "X", "oci": "X",
    "lat": "X", "ron": "X", "cat": "X",
}

# The table.  schema name -> (canon entry ids, ((tradition name, lang), ...)).
#
# TWO DIFFERENT KINDS OF CLAIM SIT IN EACH ROW, and only one of them is the
# canon's.  The tradition NAME is quoted from the canon entry's alias line or
# its prose.  The language CODE is THIS FILE'S mapping of that name onto a code
# a declaration can be compared against; the canon does not carry codes.  Where
# the canon glosses the language itself -- R1 prints "rima consonante (Sp)",
# "rima consoante (Pt)", and its prose names Welsh, Old Norse, German, Italian,
# English, Chinese, Thai, Vietnamese, Malay, Finnish -- the code is as sourced
# as the name.  Where it does not, the code is an inference and is written ""
# instead (see `trite rhyme`).
#
# The blast radius of a wrong code is bounded and worth stating: a code only
# changes an answer for a language some phonology DECLARES, and this repo
# declares nine (cym eng fas fin ltc msa non san som).  No Romance, Turkic,
# Japonic or Koreanic assignment below can move a scope verdict today; they are
# carried so the scope stays computable when a phonology for one arrives.
#
# `ltc` stands where the canon writes "Chinese", because the Chinese entries it
# cites are the regulated-verse and rime-book tradition, which is what this
# repo's `ltc` reads (doctrine 36).
_SOURCED = {
    "perfect rhyme": (("R1",), (
        ("English handbook perfect rhyme", "eng"),
        ("Welsh odl / prifodl", "cym"),
        ("Old Norse runhent", "non"),
        ("German Endreim / reiner Reim", "deu"),
        ("Italian rima perfetta / consonante", "ita"),
        ("Spanish rima consonante", "spa"),
        ("Portuguese rima consoante", "por"),
        ("Finnish rekilaulu loppusointu", "fin"),
        ("Korean 각운 gagun", "kor"),
        ("Hindi-Urdu tuk / tukānt", "hin"),
        ("Hebrew terminal rhyme", "heb"),
        ("Vietnamese vần chân", "vie"),
        ("Thai สัมผัสสระ", "tha"),
        ("Malay pantun / syair / gurindam rhyme", "msa"),
        ("Japanese kyakuin", "jpn"),
        ("Chinese regulated-verse end rhyme", "ltc"))),
    "rime riche": (("R2",), (
        ("English rime riche", "eng"),
        ("French rime riche / consonne d'appui", "fra"),
        ("Italian rima ricca", "ita"),
        ("Occitan rim ric", "oci"),
        ("German rührender Reim", "deu"),
        ("Dutch rijk / gelijk rijm", "nld"),
        ("Turkish zengin kafiye", "tur"),
        ("Arabic luzūm mā lā yalzam", "ara"))),
    "repetition": (("R60", "R69"), (
        ("English refrain / burden / chorus", "eng"),
        ("Welsh ymsathr odlau / gorodl (as a fault)", "cym"),
        ("Old Norse stef / klofastef", "non"),
        ("German Kehrreim", "deu"),
        ("Dutch refereyn stok", "nld"),
        ("Scottish Gaelic sèist / òran luaidh refrain", "gla"),
        ("Turkish nakarat", "tur"),
        ("Persian tarjīʿ-band / tarkīb-band", "fas"),
        ("Arabic īṭāʾ (as a fault, with a distance threshold)", "ara"),
        ("Chinese 疊句 / 重韻 (as a fault)", "ltc"),
        ("Japanese 囃子詞 / 去嫌 sarikirai", "jpn"),
        ("Korean 여음구 / 후렴구", "kor"),
        ("Spanish refrán / estribillo / rima del mismo vocablo", "spa"),
        ("French rime du même au même", "fra"),
        ("Occitan refranh", "oci"),
        ("Vietnamese điệp vận", "vie"),
        ("Thai สัมผัสซ้ำ", "tha"))),
    "antanaclasis": (("R56",), (
        ("English antanaclasis", "eng"),
        ("German äquivoker Reim", "deu"),
        ("Italian rima equivoca", "ita"),
        ("Occitan rim equivoc", "oci"),
        ("French rime équivoquée", "fra"),
        ("Turkish cinaslı kafiye", "tur"),
        ("Arabic jinās tāmm / jinās mustawfā", "ara"),
        ("Sanskrit yamaka / ślesa / lāṭānuprāsa", "san"),
        ("Tamil maṭakku", "tam"),
        ("Japanese kakekotoba", "jpn"))),
    "assonance": (("R5",), (
        ("English assonance", "eng"),
        ("Irish amus (amas)", "gle"),
        ("Scottish Gaelic vernacular end assonance", "gla"),
        ("German Assonanz", "deu"),
        ("Dutch klinkerrijm", "nld"),
        ("Italian assonanza", "ita"),
        ("Spanish rima asonante", "spa"),
        ("Portuguese rima toante / assoante", "por"),
        ("French assonance de laisse", "fra"))),
    "consonance": (("R9",), (
        ("English consonance", "eng"),
        ("Irish uaithne", "gle"),
        ("German Konsonanz", "deu"),
        ("Dutch medeklinkerrijm", "nld"),
        ("Italian consonanza", "ita"))),
    "cluster consonance / skothending span": (("R10",), (
        ("Old Norse skothending", "non"),
        ("English consonance (as an unmeasured variant)", "eng"))),
    "parechesis / general consonance": (("R15",), (
        ("English parechesis / general consonance", "eng"),
        ("Turkish aliterasyon", "tur"),
        ("Spanish aliteración (word-internal reading)", "spa"),
        ("Sanskrit vṛttyanuprāsa (density reading)", "san"),
        ("Malay pantun pembayang ↔ maksud", "msa"))),
    "pararhyme": (("R12",), (
        ("English pararhyme / Owen's frame rhyme", "eng"),
        ("Arabic jinās muḥarraf", "ara"))),
    "reverse rhyme": (("R14",), (
        ("English reverse rhyme", "eng"),
        ("Finnish Kalevala vahva alkusointu", "fin"),
        ("Japanese 頭韻 (whole-mora form)", "jpn"))),
    "alliteration": (("R29",), (
        ("English alliteration", "eng"),
        ("Old Norse stuðlar / höfuðstafr", "non"),
        ("Old English / Middle English lift alliteration", "ang"),
        ("German Stabreim", "deu"),
        ("Dutch stafrijm", "nld"),
        ("Irish uaim", "gle"),
        ("Welsh cymeriad llythrennol", "cym"),
        ("Finnish Kalevala heikko alkusointu", "fin"),
        ("Sanskrit anuprāsa", "san"),
        ("Tamil mōṉai", "tam"),
        ("Kannada ādi-prāsa", "kan"),
        ("Chinese 雙聲", "ltc"),
        ("Japanese 頭韻", "jpn"),
        ("Korean 두운", "kor"),
        ("Spanish aliteración", "spa"),
        ("Portuguese aliteração", "por"),
        ("French rime senée", "fra"),
        ("Thai สัมผัสอักษร", "tha"))),
    "Kalevala alliteration (weak)": (("R29",), (
        ("Finnish Kalevala heikko alkusointu", "fin"),)),
    "Kalevala alliteration (strong)": (("R14", "R29"), (
        ("Finnish Kalevala vahva alkusointu", "fin"),
        ("English reverse rhyme (the same cell, unnamed on the English side)",
         "eng"))),
    "paroemion": (("R91",), (
        ("English paroemion", "eng"),
        ("French rime senée", "fra"),
        ("Sanskrit ekākṣara / niroṣṭhya citra-bandha", "san"),
        ("Arabic al-ḥurūf al-muhmala / al-muʿjama", "ara"))),
    "family rhyme": (("R1", "R16"), (
        ("English family rhyme (tail-rime at grain=manner class)", "eng"),
        ("Sanskrit śrutyanuprāsa (the place-class twin)", "san"))),
    "additive rhyme": (("R23",), (
        ("English additive rhyme", "eng"),
        ("Arabic jinās nāqiṣ (mutarraf)", "ara"))),
    "subtractive rhyme": (("R23",), (
        ("English subtractive rhyme", "eng"),
        ("Arabic jinās nāqiṣ (mardūf)", "ara"))),
    "semirhyme": (("R21",), (
        ("English semirhyme", "eng"),
        ("Italian rima ipermetra", "ita"),
        ("Welsh cynghanedd lusg (its excluded final syllable)", "cym"))),
    "apocopated rhyme": (("R21",), (
        ("English apocopated rhyme", "eng"),
        ("Italian rima ipermetra", "ita"),
        ("Welsh cynghanedd lusg (its excluded final syllable)", "cym"))),
    "light rhyme": (("R26",), (
        ("English light rhyme", "eng"),
        ("Welsh cywydd deuair hirion couplet rhyme", "cym"),
        ("Irish rinn agus airdrinn", "gle"))),
    "wrenched rhyme": (("R27",), (
        ("English wrenched rhyme", "eng"),)),
    "syllabic rhyme": (("R28",), (
        ("English syllabic rhyme", "eng"),)),
    "amphisbaenic rhyme": (("R92",), (
        ("English amphisbaenic rhyme", "eng"),
        ("Arabic jinās qalb", "ara"),
        ("Chinese 迴文 huíwén", "ltc"),
        ("Japanese 回文 kaibun", "jpn"),
        ("Old Norse sléttubönd", "non"),
        ("French vers rétrogrades", "fra"),
        ("Spanish retruécano / quiasmo", "spa"),
        ("Sanskrit gomūtrikā / sarvatobhadra", "san"))),
    "eye rhyme": (("R53",), (
        ("English eye rhyme", "eng"),
        ("German Augenreim", "deu"),
        ("Dutch oogrijm", "nld"),
        ("Italian rima per l'occhio", "ita"),
        ("French rime pour l'œil / rime normande", "fra"),
        ("Arabic jinās muṣaḥḥaf / al-ḥurūf al-muhmala", "ara"))),
    "historical rhyme": (("R111",), (
        ("English historical rhyme", "eng"),
        ("Hebrew Ashkenazi vs Sephardi stress reading", "heb"),
        ("Korean Sino-Korean readings of Chinese verse", "kor"),
        ("French rime normande", "fra"))),
    "dialect rhyme": (("R111",), (
        ("English dialect rhyme", "eng"),
        ("Hebrew Ashkenazi vs Sephardi stress reading", "heb"),
        ("Korean Sino-Korean readings of Chinese verse", "kor"))),
    "homoioteleuton": (("R54",), (
        ("English homoioteleuton (as a fault)", "eng"),
        ("German grammatischer Reim", "deu"),
        ("Italian rima grammaticale", "ita"),
        ("Spanish similicadencia", "spa"),
        ("Hebrew Yannaic / biblical homoioteleuton", "heb"),
        ("Persian īṭā-yi jalī / khafī, shāyagān (as faults)", "fas"),
        ("Turkish redif ek hâlinde", "tur"),
        ("Finnish rekilaulu (the default case)", "fin"),
        ("Korean morphological rhyme", "kor"))),
    "polyptoton": (("R55",), (
        ("English polyptoton", "eng"),
        ("German grammatischer Reim", "deu"),
        ("Italian rima derivativa", "ita"),
        ("Spanish derivación", "spa"),
        ("French rime dérivative", "fra"),
        ("Occitan rim derivatiu", "oci"),
        ("Galician-Portuguese mordobre / mozdobre", "glg"),
        ("Arabic jinās al-ishtiqāq", "ara"))),
    "multisyllabic rhyme": (("R6",), (
        ("English multisyllabic rhyme / rap multis", "eng"),
        ("Japanese 母音韻", "jpn"),
        ("Korean 라임", "kor"))),
    "mosaic rhyme": (("R96",), (
        ("English mosaic rhyme", "eng"),
        ("Irish comhardadh briste", "gle"),
        ("Welsh lusg gudd", "cym"),
        ("German gespaltener Reim", "deu"),
        ("Italian rima composta / franta / spezzata", "ita"),
        ("Arabic jinās murakkab (mutashābih, mafrūq)", "ara"),
        ("Occitan rim equivoc contrafet", "oci"))),
    "compound / phrasal rhyme": (("R96",), (
        ("English compound / phrasal rhyme", "eng"),
        ("Irish comhardadh briste", "gle"),
        ("German gespaltener Reim", "deu"),
        ("Italian rima composta / franta / spezzata", "ita"),
        ("Arabic jinās murakkab", "ara"))),
    "holorhyme": (("R97",), (
        ("English holorhyme", "eng"),
        ("French holorime", "fra"),
        ("Sanskrit mahāyamaka / samudga", "san"),
        ("Spanish calambur", "spa"),
        ("Japanese goroawase", "jpn"))),
    "broken rhyme": (("R98",), (
        ("English broken rhyme", "eng"),
        ("German gebrochener Reim", "deu"),
        ("Arabic tadwīr", "ara"),
        ("Spanish versos de cabo roto", "spa"))),
    "enjambed rhyme": (("R98",), (
        ("English enjambed rhyme", "eng"),
        ("German gebrochener Reim", "deu"),
        ("Dutch gebroken rijm [DISPUTED — the Germanic cell records two "
         "readings of the one name and picks neither]", "nld"))),
    "rhyming reduplication": (("R66",), (
        ("English rhyming reduplication", "eng"),
        ("Tamil iraṭṭaik kiḷavi", "tam"),
        ("Malay kata ganda", "msa"),
        ("Chinese 疊字", "ltc"),
        ("Korean 첩어", "kor"),
        ("Germanic alliterative binomial formula", ""))),
    "ablaut reduplication": (("R13",), (
        ("English ablaut reduplication", "eng"),
        ("Korean 의성어 · 의태어 ablaut pairs", "kor"),
        ("Occitan rim derivatiu", "oci"))),
    "exact reduplication": (("R66",), (
        ("English exact reduplication", "eng"),
        ("Tamil iraṭṭaik kiḷavi", "tam"),
        ("Malay kata ganda", "msa"),
        ("Chinese 疊字", "ltc"),
        ("Korean 첩어", "kor"))),
    "internal rhyme": (("R71",), (
        ("English internal rhyme", "eng"),)),
    "leonine rhyme": (("R72",), (
        ("English leonine rhyme", "eng"),
        ("German Zäsurreim / Otfrid's end rhyme", "deu"),
        ("French rime léonine (medieval sense)", "fra"),
        ("Arabic taṣrīʿ / maṭlaʿ muṣarraʿ / muzdawij", "ara"),
        ("Hebrew delet / soger", "heb"))),
    "cross rhyme": (("R73",), (
        ("English cross rhyme", "eng"),
        ("Irish aicill", "gle"),
        ("Welsh englyn cyrch", "cym"),
        ("Italian rima al mezzo", "ita"),
        ("French rime batelée", "fra"),
        ("Vietnamese vần lưng", "vie"),
        ("Thai สัมผัสนอก / klon tail-to-index", "tha"))),
    "interlaced rhyme": (("R74",), (
        ("English interlaced rhyme", "eng"),
        ("German Mittelreim", "deu"),
        ("Korean 요운", "kor"))),
    "linked rhyme": (("R62",), (
        ("English linked rhyme", "eng"),
        ("Welsh cyrch-gymeriad / gair cyrch", "cym"),
        ("Irish conachlonn / fidrad freccomail", "gle"),
        ("Old Norse dunhent / dunhenda", "non"),
        ("Dutch ketendicht", "nld"),
        ("German Pausenreim", "deu"),
        ("French rime annexée / enchaînée / fratrisée", "fra"),
        ("Occitan coblas capcaudadas / capfinidas", "oci"),
        ("Galician-Portuguese leixa-pren", "glg"),
        ("Chinese 頂真 dǐngzhēn", "ltc"),
        ("Japanese 尻取り shiritori", "jpn"),
        ("Malay pantun berkait", "msa"),
        ("Tamil antāti", "tam"),
        ("Arabic tashābuh al-aṭrāf", "ara"))),
    "head rhyme (positional)": (("R34",), (
        ("English head rhyme (positional)", "eng"),
        ("German Anfangsreim / Eingangsreim", "deu"),
        ("Welsh cymeriad llythrennol (as rhyme)", "cym"),
        ("Occitan coblas capdenals (sound reading)", "oci"))),
    "anaphora": (("R64",), (
        ("English anaphora", "eng"),
        ("Welsh cymeriad geiriol", "cym"),
        ("Spanish anáfora", "spa"),
        ("Occitan coblas capdenals", "oci"),
        ("Korean 동어반복 (matched-index case)", "kor"))),
    "epistrophe / radif": (("R61",), (
        ("English epistrophe", "eng"),
        ("Persian radīf / mustazād's second system", "fas"),
        ("Turkish redif (ek and kelime)", "tur"),
        ("Arabic ḥājib (the mirror case, to the LEFT of the rhyme)", "ara"),
        ("Spanish epífora", "spa"))),
    "qafiya (before the radif)": (("R32", "R61"), (
        ("Arabic qāfiya (rawī and its slot system)", "ara"),
        ("Persian qāfiya", "fas"),
        ("Urdu / Indo-Persian qāfiya", "hin"))),
    "symploce": (("R65",), (
        ("English symploce", "eng"),
        ("Arabic radd al-ʿajuz ʿalā al-ṣadr", "ara"),
        ("French rime couronnée / emperière", "fra"))),
    "anadiplosis": (("R62",), (
        ("English anadiplosis", "eng"),
        ("Welsh cyrch-gymeriad", "cym"),
        ("Irish conachlonn", "gle"),
        ("Chinese 頂真 dǐngzhēn", "ltc"),
        ("Tamil antāti", "tam"),
        ("Occitan coblas capfinidas", "oci"),
        ("Arabic tashābuh al-aṭrāf", "ara"))),
    "epanalepsis": (("R65",), (
        ("English epanalepsis", "eng"),
        ("Arabic radd al-ʿajuz ʿalā al-ṣadr", "ara"),
        ("French rime couronnée / emperière", "fra"))),
    "analysed rhyme": (("R85",), (
        ("English analysed rhyme", "eng"),)),
    "monorhyme / leash": (("R90",), (
        ("English monorhyme / Skeltonics", "eng"),
        ("French laisse", "fra"),
        ("Arabic qaṣīda monorhyme", "ara"),
        ("Turkish ayak", "tur"),
        ("Chinese 一韻到底", "ltc"),
        ("Malay syair", "msa"),
        ("Old Norse samhenda / stafhenda", "non"),
        ("German Haufenreim", "deu"),
        ("Vietnamese Đường luật độc vận", "vie"))),
    "chain rhyme (rap)": (("R90", "R6"), (
        ("English rap chain rhyme", "eng"),)),
    "alliterative long line": (("R29",), (
        ("Old English / Middle English lift alliteration", "ang"),
        ("Old Norse stuðlar / höfuðstafr", "non"),
        ("German Stabreim", "deu"),
        ("English alliterative revival", "eng"))),
    "fourth lift must not alliterate": (("R113",), (
        ("Old English fourth-lift prohibition", "ang"),
        ("Welsh bai rhy debyg", "cym"),
        ("Chinese 撞韻 zhuàngyùn / 擠韻 / 犯韻 / 冒韻", "ltc"))),
    "dvitiyakshara-prasa": (("R30",), (
        ("Telugu dvitīyākṣara-prāsa", "tel"),
        ("Kannada ādi-prāsa", "kan"),
        ("Sanskrit prāsa-yati / yati", "san"),
        ("Tamil etukai", "tam"))),
    "monai": (("R29", "R30"), (
        ("Tamil mōṉai", "tam"),)),
    "cynghanedd groes": (("R35",), (
        ("Welsh cynghanedd groes / cyfatebiaeth gytsain", "cym"),
        ("English cynghanedd after Hopkins (an imitation, doctrine 45)",
         "eng"))),
    "cynghanedd draws": (("R36",), (
        ("Welsh cynghanedd draws (with draws fantach, bengoll, braidd "
         "gyffwrdd)", "cym"),)),
    "cynghanedd groes o gyswllt": (("R37",), (
        ("Welsh cynghanedd groes o gyswllt", "cym"),)),
    "cynghanedd sain": (("R80",), (
        ("Welsh cynghanedd sain", "cym"),)),
    "cynghanedd sain gadwynog": (("R81",), (
        ("Welsh cynghanedd sain gadwynog", "cym"),)),
    "cynghanedd sain lafarog": (("R82",), (
        ("Welsh cynghanedd sain lafarog", "cym"),)),
    "cynghanedd sain drosgl": (("R83",), (
        ("Welsh cynghanedd sain drosgl", "cym"),)),
    "cynghanedd lusg": (("R21",), (
        ("Welsh cynghanedd lusg", "cym"),)),
    "proest": (("R11",), (
        ("Welsh proest", "cym"),
        ("Irish uaithne (strict)", "gle"))),
    "Scots vowel-length rhyme (Aitken's Law)": (("R50",), (
        ("Scots vowel-length rhyme (Aitken's Law)", "sco"),
        ("Welsh bai trwm ac ysgafn", "cym"),
        ("Arabic ridf", "ara"),
        ("Tamil aḷapeṭai", "tam"),
        ("Thai vowel-length rhyme", "tha"),
        ("German reiner Reim (its quantity clause)", "deu"))),
    "Middle Chinese end rhyme (同用 group)": (("R1", "R43"), (
        ("Middle Chinese 詩 end rhyme on a 同用 group", "ltc"),
        ("Vietnamese vần chân (its tone clause)", "vie"))),
    "平仄 tonal template": (("R44",), (
        ("Chinese 平仄", "ltc"),
        ("Vietnamese luật bằng trắc", "vie"),
        ("Thai khlong tone-mark constraint / chan quantitative template",
         "tha"),
        ("Japanese 音数律", "jpn"),
        ("Korean 음보율 / 시조 종장 제약", "kor"))),
    "pantun ABAB": (("R105", "R1"), (
        ("Malay pantun ABAB", "msa"),)),
    "offbeat internal rhyme": (("R77",), (
        ("English offbeat / off-centred internal rhyme", "eng"),)),
    "rhyming slang": (("R115",), (
        ("English rhyming slang", "eng"),)),
    "transformative / bent rhyme": (("R27",), (
        ("English transformative / bent rhyme", "eng"),)),
    "sung-delivery rhyme": (("R27",), (
        ("English sung-delivery rhyme (the canon records no settled handbook "
         "term)", "eng"),)),
    "incremental repetition": (("R67",), (
        ("English incremental repetition (ballad)", "eng"),
        ("Old Norse galdralag", "non"),
        ("Finnish kerto / parallelism", "fin"),
        ("Galician-Portuguese paralelismo perfeito / leixa-pren", "glg"))),
    "trite rhyme": (("R59",), (
        ("English trite rhyme", "eng"),
        # R59's alias line prints `rim car · rimas caras · rima rara /
        # preciosa · rima pobre / rica` WITHOUT a language gloss, unlike R1
        # which writes "(Sp)" and "(Pt)". The names are the canon's; the
        # language is not, so the code is left blank rather than inferred.
        ("rim car / rimas caras (Romance; the canon gives no gloss)", ""),
        ("rima rara / preciosa (Romance; the canon gives no gloss)", ""),
        ("rima pobre / rica (Romance; the canon gives no gloss)", ""),
        ("Turkish kapanık ayak (quantified: at most four partners in the "
         "whole language)", "tur"))),
}

#: Schemas left HONESTLY EMPTY, with the reason.  An unsourced schema is not a
#: schema without a tradition; it is a schema whose tradition this repo cannot
#: cite, which is a different and more useful statement.
UNSOURCED = {
    "blues AAB stanza":
        "no entry in the 601 records it. RHYME_CANON §5.4 lists what the six "
        "inventory cells cover, and African-American vernacular song is not "
        "among them; the string 'blues' does not occur in the file. Naming a "
        "tradition here from the schema NAME is the gabay higaad error (§0).",
    "refrain by reference":
        "the RELATION is R60, but this schema's constitutive feature is a "
        "PRINTED reference stub ('&c.'), and no entry in the 601 records a "
        "tradition for the stub convention. BACKLOG §2.4 places the same stub "
        "in four languages' EDITIONS, which is a fact about editors, not "
        "about a tradition. Attaching R60's refrain traditions here would "
        "scope the schema by the relation it half-implements.",
}


def _canon_sources():
    """The inlined survey index, or None.

    Imported LAZILY and allowed to fail.  `None` means the index could not be
    loaded, which makes every `Tradition.witness` below `None` -- CANNOT TELL.
    That is the correct degradation and it is not the same as `project`: a
    checkout without the file knows it does not know, rather than reporting an
    absence of witnesses it never looked for (doctrine 28).
    """
    try:
        from quality import canon_sources as CS
    except ImportError:                                  # run as a script
        try:
            import canon_sources as CS                   # type: ignore
        except ImportError:
            return None
    return CS if CS.loaded() else None


def _build_traditions():
    """Attach the sourced traditions to the registry AT IMPORT, and fail loud
    if a schema is in neither table.  A new schema must be sourced or must be
    refused in writing; there is no third state that silently ships empty.

    The witness verdict is computed here rather than written into `_SOURCED`,
    because a citation typed by hand into a table is the defect this whole
    section exists to close.  It is DERIVED from the canon entry's own `from:`
    line and the inlined index, every time the module imports.
    """
    CS = _canon_sources()
    for name, (entries, rows) in _SOURCED.items():
        if name not in REGISTRY:
            raise KeyError(f"_SOURCED names {name!r}, which is not a schema")
        for e in entries:
            if e not in CANON:
                raise KeyError(f"{name!r} cites {e!r}, absent from CANON")
        froms = " ".join(CANON[e][1] for e in entries)
        built = []
        for n, lg in rows:
            w, why, cites = None, "the canon index is not loaded", ()
            if CS is not None:
                cell = LANG_CELL.get(lg)
                if cell is None:
                    why = ("no inventory cell is declared for this language, "
                           "so the citation cannot be located at all"
                           if lg else
                           "the canon names this tradition without glossing "
                           "its language, so no cell can be chosen")
                else:
                    w, why, cites = CS.scope_witness(froms, cell, n)
            built.append(Tradition(n, lg, "+".join(entries), w, cites, why))
        REGISTRY[name] = replace(REGISTRY[name], traditions=tuple(built))
    missing = set(REGISTRY) - set(_SOURCED) - set(UNSOURCED)
    if missing:
        raise AssertionError(
            "schemas in neither _SOURCED nor UNSOURCED, so their `traditions` "
            f"would ship empty with no reason: {sorted(missing)}")
    overlap = set(_SOURCED) & set(UNSOURCED)
    if overlap:
        raise AssertionError(f"schema both sourced and unsourced: {overlap}")


_build_traditions()


def canon_entries(schema):
    """The RHYME_CANON entry ids this schema's traditions were read out of."""
    if not schema.traditions:
        return ()
    return tuple(dict.fromkeys(
        e for t in schema.traditions for e in t.source.split("+")))


def cited_cells(schema):
    """Inventory CELLS the cited canon entries draw on -- E C G S I X."""
    out = set()
    for e in canon_entries(schema):
        for tok in CANON[e][1].split():
            tok = tok.lstrip("✓")
            if tok and tok[0] in "ECGSIX":
                out.add(tok[0])
    return out


def _entry_named_cells():
    """Per canon ENTRY, the cells for which some schema names a tradition.

    Entry-scoped and not schema-scoped, and the difference is load-bearing.
    `Middle Chinese end rhyme (同用 group)` cites R1, whose from-line includes
    English indices -- but R1's English tradition is named, under `perfect
    rhyme`, at grain=identity.  Computing this per SCHEMA made the Chinese
    schema report `cell_cited` on English, i.e. 'the source cannot say', when
    the source says plainly that English is at R1 and not at this grain.
    """
    out = {}
    for s in REGISTRY.values():
        for e in canon_entries(s):
            out.setdefault(e, set()).update(
                LANG_CELL[t.lang] for t in s.traditions if t.lang in LANG_CELL)
    return out


_ENTRY_NAMED_CELLS = None


def named_cells(schema):
    """Cells for which the cited entries name a tradition ANYWHERE."""
    global _ENTRY_NAMED_CELLS
    if _ENTRY_NAMED_CELLS is None:
        _ENTRY_NAMED_CELLS = _entry_named_cells()
    out = set()
    for e in canon_entries(schema):
        out |= _ENTRY_NAMED_CELLS.get(e, set())
    return out


def tradition_scope(schema, language):
    """Is this schema's rule shape being run inside its own tradition?

    -> one of four strings, and the fourth is the one that stops this being a
    two-valued lie:

      'in_tradition'  the declaration's language is among the schema's SOURCED
                      traditions.
      'rule_shape'    the schema HAS sourced traditions and this language is
                      not one of them, and the canon entry does not even cite
                      this language's inventory cell.  The rule shape matched;
                      the tradition did not (doctrine 43).
      'cell_cited'    the canon entry cites indices from this language's
                      inventory cell but names no tradition in it, so the
                      SOURCE cannot say either way.  Not evidence of absence.
      'unsourced'     nothing could be sourced for this schema at all; see
                      UNSOURCED for the reason.
    """
    if not schema.traditions:
        return "unsourced"
    if any(t.lang == language for t in schema.traditions):
        return "in_tradition"
    cell = LANG_CELL.get(language)
    if cell and cell in (cited_cells(schema) - named_cells(schema)):
        return "cell_cited"
    return "rule_shape"


SCOPES = ("in_tradition", "cell_cited", "rule_shape", "unsourced")


def tradition_provenance():
    """M-15a. Where does the evidence for each scoped tradition actually sit?

    THREE COUNTS, never two (doctrine 79 applied to a register rather than to a
    rate): a tradition nobody could attribute is not a tradition with no
    witness, and neither is one whose only witness is us.

    -> {'attachments', 'distinct', 'external', 'project', 'cannot_tell',
        'index_loaded', 'coined': [...], 'unknown_reasons': {...}}

    `coined` is the deliverable and the dangerous set: every tradition whose
    every cited survey index records nothing but a `quality/*` module, a
    `CLAUDE.md` doctrine or the author's recollection.  It is printed by name
    so an invented tradition cannot pass as an attested one.  `index_loaded`
    False means every verdict is `cannot_tell` for want of
    `quality/canon_index.tsv`, which is a different sentence from `no witness`.
    """
    CS = _canon_sources()
    seen, ext, proj, unk = set(), 0, 0, 0
    coined, reasons, n = [], {}, 0
    for sname, s in REGISTRY.items():
        for t in s.traditions:
            n += 1
            key = (t.name, t.lang, t.source)
            if key in seen:
                continue
            seen.add(key)
            if t.witness == "external":
                ext += 1
            elif t.witness == "project":
                proj += 1
                coined.append({"schema": sname, "tradition": t.name,
                               "lang": t.lang, "canon": t.source,
                               "cites": list(t.cites)})
            else:
                unk += 1
                reasons[t.why] = reasons.get(t.why, 0) + 1
    return {"attachments": n, "distinct": len(seen), "external": ext,
            "project": proj, "cannot_tell": unk,
            "index_loaded": CS is not None,
            "coined": sorted(coined, key=lambda d: (d["lang"], d["tradition"])),
            "unknown_reasons": reasons}


def tradition_report(language):
    """The inventory of scopes for one declared language, with no text.

    Answers 'what could this declaration honestly be asked about' before any
    corpus is read, which is capability_report()'s sibling on the other axis.
    """
    out = {s: [] for s in SCOPES}
    for n, s in REGISTRY.items():
        out[tradition_scope(s, language)].append(n)
    return {k: sorted(v) for k, v in out.items()}


def search_burden(schema, stream):
    """Doctrine 56: how many hypotheses per locus this schema's span rules try.

    `Span.search_k` was carried from the first commit and nothing read it, so a
    count obtained by SEARCH looked the same as a count obtained by lookup.
    -> {'members': n, 'searched': n, 'mean_k': f, 'max_k': n}.  mean_k > 1 is
    the flag that a bare rate from this schema is quoting the null back at
    itself unless the control ran the same search.
    """
    ks, searched = [], 0
    for rule in schema.spans:
        try:
            for sp in enumerate_spans(rule, stream):
                ks.append(sp.search_k)
                if sp.search_k > 1:
                    searched += 1
        except NoReferent:
            continue
    return {"members": len(ks), "searched": searched,
            "mean_k": (sum(ks) / len(ks)) if ks else 0.0,
            "max_k": max(ks) if ks else 0}


def relation_report(stream, chans=None, schemas=None):
    """THE HONEST CONSUMER.  Every schema that fires is reported WITH its
    scope, so a rule-shape match is neither silently listed nor silently
    hidden (M-15).

    FOUR COUNTS, NEVER TWO OR THREE (doctrine 79, one column wider than it
    was).  A schema the instrument REFUSED for want of a capability is not a
    schema that found nothing; a schema that ran and found nothing is not
    either; and -- added 2026-08-22 -- a schema refused because the frame it
    rides was DECLARED AND CAME BACK EMPTY is a fourth answer with its own
    remedy.  `refused` stays the TOTAL so the old partition still closes
    (`declared == refused + ran_found_nothing + ran_and_fired`) and no row
    silently leaves the report; `refused_capability` and `refused_vacuous`
    split it, and they are a genuine partition of the same denominator rather
    than two rates over different ones.

    The same triple is reported over INSTANCES: decided-true, decided-false
    and undecided are three answers and the undecided ones are the ternary
    this module exists to preserve.

    `refusals` rows are 4-TUPLES `(schema, key, scope, kind)`.  They were
    triples; the arity changed with this split, because a reader iterating
    the list is exactly the reader who must not be told that a vacuous frame
    and an undeclared one are the same row.
    """
    lang = stream.declaration.get("language", "")
    reg = schemas if schemas is not None else REGISTRY
    kw = {} if chans is None else {"chans": chans}
    rows, refusals = [], []
    for name, s in reg.items():
        out = realise(s, stream, keep="all", **kw)
        if isinstance(out, Refusal):
            # THE WHOLE SET in the printed row.  `out.capability` alone is the
            # alphabetically-first name, so a reader of this report used to be
            # told "declare prominence" for a schema that also wants a
            # quotient no declaration in the repo supplies -- one blocker
            # named, one hidden, and the two have different remedies
            # (doctrine 44).  `+`-joined, matching `capability_report`'s own
            # key so the two reports can be compared row for row.
            refusals.append((name, "+".join(out.missing) or out.capability,
                             tradition_scope(s, lang), out.kind))
            continue
        t = sum(1 for i in out if i.verdict is True)
        f = sum(1 for i in out if i.verdict is False)
        u = sum(1 for i in out if i.verdict is None)
        rows.append({"schema": name, "scope": tradition_scope(s, lang),
                     "traditions": s.traditions,
                     "canon": canon_entries(s),
                     "true": t, "false": f, "undecided": u,
                     "search": search_burden(s, stream)})
    fired = [r for r in rows if r["true"]]
    vac = [r for r in refusals if r[3] == "vacuous_frame"]
    return {
        "language": lang,
        "declared": len(reg),
        "refused": len(refusals),
        "refused_vacuous": len(vac),
        "refused_capability": len(refusals) - len(vac),
        "vacuous_refusals": vac,
        "ran_found_nothing": len(rows) - len(fired),
        "ran_and_fired": len(fired),
        "refusals": refusals,
        "rows": rows,
        "scope_counts": {s: sum(1 for r in fired if r["scope"] == s)
                         for s in SCOPES},
        "instances": {
            "true": sum(r["true"] for r in rows),
            "false": sum(r["false"] for r in rows),
            "undecided": sum(r["undecided"] for r in rows)},
    }


def print_relation_report(rep, limit=None):
    """Text form.  Prints the scope on EVERY row, and prints the reason on an
    unsourced one, because a row that cannot say which tradition it belongs to
    is the defect this section closes."""
    print(f"  phonology {rep['language'] or '?'}   schemas declared "
          f"{rep['declared']}")
    print(f"  REFUSED {rep['refused']} (capability {rep['refused_capability']}"
          f" · EMPTY DECLARED FRAME {rep['refused_vacuous']})  ·  RAN AND "
          f"FOUND NOTHING {rep['ran_found_nothing']}  ·  RAN AND FIRED "
          f"{rep['ran_and_fired']}   (four counts, doctrine 79/20)")
    for name, key, _scope, _kind in rep["vacuous_refusals"]:
        print(f"      [EMPTY FRAME] {name}: {key} was declared and marked "
              f"nothing — not a null, and not a capability nobody declared")
    ins = rep["instances"]
    print(f"  instances: decided-true {ins['true']}  decided-false "
          f"{ins['false']}  UNDECIDED {ins['undecided']}")
    sc = rep["scope_counts"]
    print(f"  of the schemas that FIRED: in-tradition {sc['in_tradition']}  ·  "
          f"source-cannot-say {sc['cell_cited']}  ·  RULE SHAPE ONLY "
          f"{sc['rule_shape']}  ·  unsourced {sc['unsourced']}")
    fired = sorted((r for r in rep["rows"] if r["true"]),
                   key=lambda r: (SCOPES.index(r["scope"]), -r["true"]))
    for r in fired[:limit]:
        tag = {"in_tradition": "IN TRADITION", "cell_cited": "SOURCE-CANNOT-SAY",
               "rule_shape": "RULE SHAPE ONLY", "unsourced": "UNSOURCED"}[
                   r["scope"]]
        k = r["search"]
        ks = (f"  search k mean {k['mean_k']:.1f} max {k['max_k']}"
              if k["mean_k"] > 1 else "")
        print(f"  [{tag}] {r['schema']}  {r['true']} instance(s){ks}")
        if r["scope"] == "unsourced":
            print(f"      no tradition sourced: {UNSOURCED[r['schema']]}")
        else:
            print(f"      canon {'+'.join(r['canon'])}: "
                  f"{'; '.join(str(t) for t in r['traditions'][:4])}"
                  f"{' …' if len(r['traditions']) > 4 else ''}")
    print("  A COUNT HERE IS NOT EVIDENCE. quality/relations_null.py is the "
          "matched control; doctrines 56/61 and 63/68/75/90.")


# --------------------------------------------------------------------------
# THE MANDATE ROUTE (2026-08-22).  `satisfies_relation` is a PER-PAIR judge
# and a `RelationSchema` is a whole-STREAM object, and that mismatch — not
# any policy — is what kept the `schema:` namespace declarable and unjudgeable
# since M-37 made it a namespace.  The judge's refusal used to give a second
# reason beside the mismatch: "gated on the null sweep — a schema that does
# not beat its own null must not become enforceable".  THAT CLAUSE IS STRUCK
# BY OWNER RULING, 2026-08-22.  It is the prove-it-first instinct that also
# produced the two-name default admit set, and the ruling on that set applies
# here for the same reason: a schema the reader can name is a real thing to
# ask for, and refusing to let a writer DECLARE it because the corpus study
# is unfinished withholds a coordinate over a question the writer never asked.
# The null sweep still decides what the harness may assert on its OWN
# initiative.  It does not decide what a writer may ask for by name.
#
# WHAT THIS FUNCTION DOES NOT CLAIM.  Only 29 of the 77 schemas declare
# `both_line_final`, which is the placement a `--groups=` mandate expresses;
# 19 more are cross-line at some other placement, 19 are INTRA-line figures
# (a property of one line, which no pair mandate can ask about), and 10
# declare no placement at all.  Routing here does not make an intra-line
# figure into a rhyme relation — it makes every schema whose instances ARE
# line pairs answerable, and leaves the rest to refuse honestly with their
# placement named.


def stanzas_from_sections(sections):
    """-> a per-line stanza index derived from a declared section list, or
    None when no sections were declared. A contiguous run of one declared
    section IS a stanza boundary (M-39); ONE spelling of that derivation,
    shared by `quality.revise`'s stream builder and `whole_vocabulary_pairs`
    below, because two spellings is how the two routes drift (doctrine 1).
    """
    if not sections:
        return None
    out, k, prev = [], -1, object()
    for sec in sections:
        if sec != prev:
            k += 1
            prev = sec
        out.append(k)
    return out


def whole_vocabulary_pairs(text_lines, phon, sections=None, bearing=None):
    """Every 1-based line pair ANY registered schema is true of, with the
    names that answered -> {(i, j): [canonical schema names, sorted]}.

    THE WHOLE-VOCABULARY DEFAULT'S ONE JUDGE (owner ruling 2026-08-25,
    `MISSING.md` M-116, task #86's second half). Both readers of the default
    — `quality.revise.grade` and `lyric_harness.check_scheme` — consult THIS
    function, so a mandated pair cannot be satisfied by one grader and
    charged by the other (doctrine 1; `check_scheme`'s own comment has
    called the two-copy chain "the standing defect" since 2026-08-15).

    `bearing` is the declared rhyme-bearing subset as 0-BASED line indices
    (a mandate's own groups); it feeds `mark_refrain_tail`, whose docstring
    records why `lines=None` answers zero on every ghazal. Refusing schemas
    contribute nothing (`keep_refusal=False` — a schema this draft cannot
    supply is silent here, not a violation and not a pass), and same-line
    instances are dropped by `line_pairs_for`'s own rule, so an intra-line
    figure can never satisfy a cross-line mandate.
    """
    stream = build_stream(text_lines, phon,
                          sections=sections,
                          stanzas=stanzas_from_sections(sections),
                          stanza_source=("declared_sections"
                                         if sections else ""),
                          declaration={"language": "eng"})
    if bearing:
        mark_refrain_tail(stream, lines=sorted(bearing))
    out = {}
    for name in sorted(REGISTRY):
        ps = line_pairs_for(REGISTRY[name], stream, keep_refusal=False)
        for pair in ps:
            out.setdefault(pair, []).append(name)
    return out


#: THE ONE SENTENCE THIS TREE SAYS ABOUT THE ROUTE ABOVE, SAID ONCE
#: (doctrine 1/48, `MISSING.md` M-139). The candidate field
#: (`quality.revise.Reviser._field_one`) is built per WORD and the judge
#: above answers per LINE PAIR, so the schema half of the default is not
#: askable at that site at any depth -- and a field silent about a whole
#: acceptance route reads as though nothing else could answer (doctrine 20).
#:
#: THE WORDING IS THE MEASUREMENT'S AND IT CLAIMS EXACTLY ONE THING.
#: MEASURED 2026-08-26 over `quality/fixtures/` and `songs/` -- 15 drafts
#: under their own committed mandates, 452 mandated pairs -- **15 pairs
#: (3.32%) on 3 drafts are accepted ONLY by this judge**, and of the 10 whose
#: bound spans both read, **0 are offerable** from fields 1,434-3,981 words
#: deep. Every one scores BELOW `theta_rhyme` 0.75 (0.395-0.705), so
#: `admits()` refuses them ON THE SCALAR and a field built from words that
#: CLEAR the band can never hold them at any depth. So the sentence must NOT
#: say these words fail the 77 and must NOT imply a deeper field would reach
#: them: it names the ROUTE and says a pair may satisfy on it with no offered
#: word taken. A wording implying schema-satisfying words could have been
#: offered would be worse than no disclosure at all.
SCHEMA_ROUTE_NOTE = (
    "THE 77-SCHEMA HALF OF THE DEFAULT WAS NOT CONSULTED FOR THIS FIELD. "
    "A mandated pair declaring no relation is satisfied when `admits()` "
    "passes it OR when the two LINES stand in any schema the vocabulary "
    "names (`relations.whole_vocabulary_pairs`, all 77). This field was "
    "built at the first door only: the second judges LINE PAIRS over a "
    "built stream and this site holds one WORD, so it is not askable here "
    "at any depth. That is a limit of the field and not a verdict on these "
    "words -- a pair can satisfy the mandate on the schema route with none "
    "of them taken, and a word absent from this list has not been refused "
    "by the 77.")

#: WHAT A RENDERER SAYS WHEN THE OBJECT DOES NOT CARRY THE COORDINATE, and
#: it is a DIFFERENT CLAIM rather than a second copy of the one above. THREE
#: STATES, NEVER TWO: a `Brief` stand-in that predates the field renders
#: through `getattr`, and a default of `""` would make ABSENCE render as
#: "the route is shut" -- doctrine 20's own collapse reproduced inside the
#: disclosure that exists to end it.
SCHEMA_ROUTE_UNKNOWN = (
    "WHETHER THE 77-SCHEMA HALF OF THE DEFAULT WAS CONSULTED FOR THIS FIELD "
    "IS NOT RECORDED HERE -- this brief does not carry the coordinate, which "
    "is inconclusive by construction and is not a statement that it was "
    "consulted (doctrine 20).")


#: THE DRAW WITNESS — sixteen plain English lines carrying the common
#: figures (two perfect-rhyme pairs, an assonance pair sun/much, a
#: consonance pair love/prove, a pararhyme pair gate/goat, a mosaic tail
#: curator/grate-her, a rime-riche pair sole/soul, a subtractive pair
#: grow/growing). DECLARED, in the capacity layer's certification idiom: a
#: schema joins `DRAWABLE_SCHEMAS` by ANSWERING ON AN EXHIBIT HERE, and the
#: pool grows by growing the witness — never by hand-editing the tuple. A
#: schema absent from the pool is not refused as a relation (the default
#: fan and the declared route still judge it); it is only not DRAWN, because
#: a planner must not mandate what no witness proves a writer can satisfy
#: in plain English (M-79's founding rule, M-117).
DRAWABLE_WITNESS_LINES = (
    "The kitchen light was fading fast",
    "He walked alone across the field",
    "A silver ship went sailing past",
    "The morning broke across the shield",
    "We stood beneath the winter sun",
    "The cold had never asked for much",
    "She wrote a letter full of love",
    "A thing the years could never prove",
    "He waited by the garden gate",
    "And fed a wandering mountain goat",
    "She traded quips with the curator",
    "His cold reviews began to grate her",
    "He patched his boot along the sole",
    "And swore it cost him half his soul",
    "He told the sapling: reach and grow",
    "The rings inside it kept on growing",
)
DRAWABLE_WITNESS_SECTIONS = ("a",) * 4 + ("b",) * 4 + ("c",) * 4 + ("d",) * 4


def derive_drawable_schemas(phon=None):
    """-> the sorted names a planner may DRAW a group's relation from.

    Three rules, each derived from a coordinate the registry itself
    declares, none hand-listed (doctrine 1):

    1. THE SCHEMA ANSWERS ON THE WITNESS — `line_pairs_for` over the
       declared witness stream returns a NON-EMPTY frozenset. A refusal
       means the plain grade-time stream cannot supply it; an empty set
       means no exhibit proves a writer can satisfy it in plain English —
       either way a drawn mandate would be unwritable or unjudgeable
       (M-79: no unwritable plan ships).
    2. NOT INTRA-LINE ONLY — a figure whose every placement is
       same_line/same_token is a property of one line and can never
       satisfy a mandated pair (`rhyme_types.satisfies_relation`'s own
       refusal, read here from the same placement rows).
    3. NO IDENTITY AT THE LINE END — a schema whose identity rule demands
       token AGREEMENT at a line-final placement mandates exactly what
       `grade()`'s REPEAT branch charges (doctrine 3), so a drawn group
       could only be satisfied by what the grader refuses.

    The planner reads the ADOPTED tuple below, never this function — the
    derivation costs a stream build and the planner opens no file — and
    `quality/test_plan.py` re-derives the tuple against this function so
    drift fails loud (the meter-bands adoption pattern).
    """
    if phon is None:
        from quality import phonology as _PH
        phon = _PH.get("eng")
    intra = {"same_line", "same_token", "same_word"}
    final = {"both_line_final", "a_line_final", "exactly_one_line_final"}
    stream = build_stream(
        list(DRAWABLE_WITNESS_LINES), phon,
        sections=list(DRAWABLE_WITNESS_SECTIONS),
        stanzas=stanzas_from_sections(list(DRAWABLE_WITNESS_SECTIONS)),
        stanza_source="declared_sections",
        declaration={"language": "eng"})
    out = []
    for name in sorted(REGISTRY):
        sch = REGISTRY[name]
        ps = line_pairs_for(sch, stream)
        if isinstance(ps, Refusal) or not ps:
            continue
        pk = {p.kind for p in sch.placement}
        if pk and pk <= intra:
            continue
        if any(type(r.predicate).__name__ == "Agree" for r in sch.identity) \
                and (not pk or pk & final):
            continue
        out.append(name)
    return tuple(out)


def drawable_traits():
    """-> {name: {"gap": int|None, "claims": ((channel, coord, pred),...)}}
    for every drawable schema — the coordinates the PLANNER's conjunction
    gate reads (M-118, widened by M-119, rebuilt by M-122).

    M-122, found designing the first song of the paired experiment: two
    more facts the registry states that the pairwise dict could not
    carry. (1) `adjacent_lines` is a GAP constraint spelled as a
    placement KIND — interlaced rhyme's whole reach — so `gap` now reads
    it as 1. (2) A claim's SYLLABLE COORDINATE decides what composes:
    rime riche equates the anchor coda (scope `each` covers the anchor),
    semirhyme equates it again one pair over, and assonance demands it
    DIFFER across the ends of the chain — every pair individually legal,
    the conjunction impossible, because EQUALITY IS TRANSITIVE and a
    per-pair ledger cannot see a chain. So claims are now triples over a
    named coordinate: `anchor` (the last-stressed syllable of the end
    span — scope `anchor`, and scope `each`, which covers it), `post`
    (post-anchor syllables — scope `post_anchor`, plus the projection of
    an `each`-scope Agree), `final` (the written-out last syllable —
    `word_end`-anchored spans and `last` scope; light rhyme's own
    coordinate, which genuinely composes where anchor claims do not),
    and `head` (line-initial spans, with the token IdentityRule riding
    as channel "token" — M-119's store, re-keyed). An `each`-scope
    Differ projects onto `anchor` only (every aligned position differs,
    and the anchor position always exists); the dict this replaces
    silently collapsed perfect rhyme's TWO onset rules (Agree@post,
    Differ@anchor) into one. Identity is still not collected at the
    ends (`derive_drawable_schemas` rule 3 bars Agree-identity there).
    Measured over seeds 1-60 before the rebuild, with this keying:
    53 seeds drew an unsatisfiable conjunction — 117 adjacency
    violations, 32 transitive contradictions; 0 after.
    """
    # M-123's second face, found the same hour: `PresentVsAbsent` IS a
    # Differ on a presence BIT — binary BY CONSTRUCTION, a coda is there
    # or it is not — wearing a predicate name the cap could not read
    # (subtractive rhyme drew onto a three-member group, the same
    # pigeonhole as light rhyme's one axis over). Each such claim is
    # translated to Differ on a derived `<channel>_presence` channel,
    # and every Agree on a channel ANY drawable schema tests for
    # presence projects an Agree edge onto the same derived channel,
    # because equal codas are equally present — that projection is what
    # lets the parity closure see monorhyme's coda-Agree contradict a
    # subtractive presence-Differ across a chain. The channel set is
    # derived from the registry, never hand-listed.
    presence_channels = {
        c.channel for name in DRAWABLE_SCHEMAS
        for c in (REGISTRY[name].channels or ())
        if type(c.predicate).__name__ == "PresentVsAbsent"}
    out = {}
    for name in DRAWABLE_SCHEMAS:
        sch = REGISTRY[name]
        gap = None
        for p in sch.placement:
            if p.kind == "line_gap_at_most" and p.polarity:
                gap = p.args[0]
            if p.kind == "adjacent_lines" and p.polarity:
                gap = 1
        claims = []

        def _emit(ch, co, pred):
            claims.append((ch, co, pred))
            if pred == "PresentVsAbsent":
                claims.append((ch + "_presence", co, "Differ"))
            elif pred == "Agree" and ch in presence_channels:
                claims.append((ch + "_presence", co, "Agree"))

        if (any(p.kind == "both_line_final" and p.polarity
                for p in sch.placement)
                or (sch.spans and all(s.locus == "line_final_token"
                                      for s in sch.spans))):
            final_span = bool(sch.spans) and sch.spans[0].anchor == "word_end"
            for c in sch.channels or ():
                if not c.required:
                    continue
                pred = type(c.predicate).__name__
                if final_span or c.scope == "last":
                    _emit(c.channel, "final", pred)
                elif c.scope == "post_anchor":
                    _emit(c.channel, "post", pred)
                elif c.scope == "each":
                    _emit(c.channel, "anchor", pred)
                    if pred == "Agree":
                        _emit(c.channel, "post", "Agree")
                else:
                    _emit(c.channel, "anchor", pred)
            # M-125: SPAN LENGTH IS A HIDDEN EQUALITY CHANNEL, and the
            # schema's own `unmatched` coordinate declares it — `forbid`
            # rejects any overhang (perfect rhyme, rime riche: the end
            # spans must be the SAME length), `require_a`/`require_b`
            # demand one (semirhyme: the lengths must DIFFER — measured:
            # grow~growing fires, tide~ride and sane~champagne do not),
            # and `exclude` ignores the overhang and claims nothing.
            # Without this claim the drawn conjunction {perfect 13~14,
            # rime riche 13~17, semirhyme 14~17} read satisfiable while
            # being an Equal-Equal-Differ triangle no words can close;
            # with it, the existing Agree-union + disequality closure
            # catches the cycle with no new machinery.
            if sch.unmatched == "forbid":
                claims.append(("span_length", "end", "Agree"))
            elif sch.unmatched in ("require_a", "require_b"):
                claims.append(("span_length", "end", "Differ"))
        if (any(p.kind == "both_line_initial" and p.polarity
                for p in sch.placement)
                or (sch.spans and all(s.locus in ("line_initial_token",
                                                  "line_head_index")
                                      for s in sch.spans))):
            for c in sch.channels or ():
                if c.required:
                    claims.append((c.channel, "head",
                                   type(c.predicate).__name__))
            for i in sch.identity or ():
                if i.level == "token":
                    claims.append(("token", "head",
                                   type(i.predicate).__name__))
        out[name] = {"gap": gap, "claims": tuple(claims)}
    return out


#: ADOPTED 2026-08-25 (M-123): the FINITE VALUE DOMAINS of the channels the
#: planner's conjunction gate reads, for the English phonology the mandate
#: judge grades through (`revise._relation_phonology` -> `phonology.get
#: ("eng")`). A pairwise-Differ claim is a disequality clique, and a clique
#: needs one distinct value per member, so a group may not outnumber its
#: channel's domain — light rhyme's `prominence Differ` on a BINARY channel
#: caps its group at TWO, which the M-122 gate could not see (measured:
#: 74 impossible cliques over seeds 1-60, 40 of 60 seeds). MEASURED over
#: all 126,052 syllabifiable words of the shipped lexicon: prominence
#: emits exactly {0, 1} — binary BY CONSTRUCTION, the eng adapter's own
#: `prominence=1 if s["stress"] in (1, 2) else 0` — and nucleus exactly
#: the 15 ARPABET vowels. A channel ABSENT here is unbounded on purpose
#: (onset/coda/consonants are sequences over an open combinatorial space,
#: token is the vocabulary): absence can only make the gate MISS a cap,
#: never invent one, so the table errs toward emitting a plan and the
#: judge stays the final word. Re-derivation command in `MISSING.md`
#: M-123; `test_plan.py` §14 pins the two rows against the phonology.
CHANNEL_DOMAINS = {
    "prominence": (0, 1),
    "nucleus": ("AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER",
                "EY", "IH", "IY", "OW", "OY", "UH", "UW"),
    # A derived channel: `drawable_traits` translates PresentVsAbsent to
    # Differ on `<channel>_presence`, and a presence bit is binary BY
    # CONSTRUCTION — nothing to measure, a coda is there or it is not.
    "coda_presence": (0, 1),
}


#: ADOPTED 2026-08-25 from `derive_drawable_schemas()` (owner ruling "now do
#: the planner too", M-117). Re-derived by `quality/test_plan.py`; a moved
#: pool is a moved witness or a moved registry, and either fails loud.
DRAWABLE_SCHEMAS = (
    "Scots vowel-length rhyme (Aitken's Law)",
    "analysed rhyme",
    "anaphora",
    "assonance",
    "chain rhyme (rap)",
    "cluster consonance / skothending span",
    "compound / phrasal rhyme",
    "consonance",
    "family rhyme",
    "head rhyme (positional)",
    "interlaced rhyme",
    "internal rhyme",
    "light rhyme",
    "monai",
    "monorhyme / leash",
    "multisyllabic rhyme",
    "pantun ABAB",
    "pararhyme",
    "perfect rhyme",
    "rime riche",
    "semirhyme",
    "subtractive rhyme",
)


def line_pairs_for(schema, stream, keep_refusal=True):
    """Every LINE PAIR this schema is true of, 1-based.  -> frozenset or a
    `Refusal`.

    The bridge between `realise()`'s stream verdicts and a mandate's per-pair
    question.  A `Span.origin` is spelled `L<line>.<locus>` with a 0-BASED
    line index (`'L0.final'`, `'L1.T4'`), so the +1 here is the only
    conversion and it is done once, in one place, rather than at each caller.

    A `Refusal` is RETURNED, not raised and not flattened to an empty set:
    "this schema needs a capability the stream does not supply" and "this
    schema is true of no pair here" are different answers and doctrine 20
    forbids spelling them the same.  An empty frozenset means looked-and-none.
    """
    out = realise(schema, stream)
    if isinstance(out, Refusal):
        return out if keep_refusal else frozenset()
    pairs = set()
    for inst in out:
        if inst.verdict is not True:
            continue
        a, b = _origin_line(inst.a), _origin_line(inst.b)
        if a is None or b is None or a == b:
            # SAME-LINE INSTANCES ARE DROPPED HERE AND THAT IS NOT A LOSS OF
            # INFORMATION, it is the placement axis being honest: an
            # alliteration inside L1 is a true instance of a real figure and
            # is not an answer to "do L1 and L3 stand in a relation".  A
            # schema ALL of whose instances are same-line yields the empty
            # set, and the caller reports that as "no pair" rather than as a
            # violation — see `rhyme_types.satisfies_relation`.
            continue
        pairs.add((min(a, b), max(a, b)))
    return frozenset(pairs)


def _origin_line(span):
    """-> 1-based line number from a `Span.origin`, or None."""
    o = getattr(span, "origin", "") or ""
    if not o.startswith("L"):
        return None
    head = o.split(".", 1)[0][1:]
    return int(head) + 1 if head.isdigit() else None


#: The loci a DECLARED token can stand in for.  `pair_satisfies` swaps the
#: member rule's locus for one declared token, and that swap is only honest
#: where the rule's own locus IS a token — a `free_run` rule searches
#: windows, a `line_head_index` rule takes its position from its own
#: magnitude, a `line`/`half_line` rule spans more than a token, and
#: reinterpreting any of those as "this one word" would judge a different
#: schema under the declared one's name.
_TOKEN_LOCI = ("line_final_token", "line_initial_token", "any_token")


def pair_satisfies(schema, stream, at_a, at_b, chans=DEFAULT_CHANNELS):
    """Does the pair of DECLARED bindings stand in this schema?  (M-148 P2.)

    `at_a`/`at_b` are `(line, token)` in STREAM coordinates — 0-based line,
    0-based token ordinal, Python-negative allowed (`-1` is the line's last
    token).  -> True / False / None / `Refusal`.

    THE DEFECT THIS CLOSES: `rhyme_types.satisfies_relation`'s schema branch
    answers `(i, j) in instances`, and `instances` comes from `realise()`,
    which enumerates spans at the schema's OWN loci — so a mandate binding
    `1.T4` to `2.end` under a `schema:` relation was judged at placements
    the writer never declared, while the class route (measured, M-148 E2)
    reads the declared slots correctly.  Here the DECLARATION names the
    token and the SCHEMA keeps everything else: its own member anchors and
    magnitudes build the spans (through `_spans_at`, the same builder
    `enumerate_spans` uses), its channels, identity rules and unmatched
    treatment judge them (through `evaluate`, the same judge `realise`
    uses), and only its PLACEMENT rules are stripped — a placement is the
    schema's own statement of where it expects to stand, and the declared
    slot is the writer overriding exactly that coordinate.

    None is a REFUSAL-shaped answer, never a no (doctrine 79): a line or
    token the stream cannot supply, an anchor with no referent in the bound
    token, or an evaluation no required channel could read.  A `Refusal` is
    RETURNED, not raised (`line_pairs_for`'s convention), for the schema
    shapes one token cannot bind — named, so a caller can say WHY the pair
    route refuses where the instances route stands.
    """
    sup = {c: stream.supply(c) for c in schema.capabilities()}
    miss = tuple(c for c in schema.capabilities()
                 if sup[c].state != "present")
    if miss:
        return Refusal(
            schema.name, miss[0],
            f"{schema.name!r} needs "
            f"{', '.join(repr(c) for c in miss)}, which this declaration "
            f"does not supply — refused at the declared pair exactly as "
            f"`realise()` refuses over the stream.",
            missing=miss, kind="capability")
    for rule in (schema.spans[0], schema.spans[-1]):
        if rule.locus not in _TOKEN_LOCI:
            return Refusal(
                schema.name, "span",
                f"{schema.name!r}'s member span reads locus "
                f"{rule.locus!r}, which does not bind ONE declared token — "
                f"judging it at a declared word would answer a different "
                f"question under this schema's name. The realise() route "
                f"(`line_pairs_for`) still judges it at its own loci.",
                kind="span")
        if rule.anchor == "searched":
            return Refusal(
                schema.name, "span",
                f"{schema.name!r}'s member anchor is SEARCHED: it tries k "
                f"hypotheses and a mandated pair has nowhere to carry the "
                f"multiplicity correction doctrine 56 requires — the same "
                f"refusal `slots.check` gives the locus.",
                kind="span")
    members = []
    for (li, t), rule in ((at_a, schema.spans[0]), (at_b, schema.spans[-1])):
        if li < 0 or li >= len(stream.lines) or not stream.lines[li]:
            return None
        if t < 0:
            t = stream.units[stream.lines[li][-1]].token + 1 + t
        ids = stream.tokens.get((li, t))
        if not ids:
            return None            # the declared word reads to nothing
        try:
            cand = list(_spans_at(rule, stream, ids, f"L{li}.T{t}"))
        except NoReferent:
            return None            # the anchor names nothing in this token
        if not cand:
            return None
        members.append(cand)
    sch = replace(schema, placement=())
    saw_none = False
    for sa in members[0]:
        for sb in members[1]:
            if sa.idx == sb.idx:
                continue           # one span twice is not a pair
            inst = evaluate(sch, sa, sb, stream, chans)
            if inst is None:
                continue
            if inst.verdict is True:
                return True
            if inst.verdict is None:
                saw_none = True
    return None if saw_none else False


__all__ = ["Unit", "Stream", "Frames", "build_stream", "tokenise",
           "stanzas_from_blank_lines",
           "Span", "SpanRule", "enumerate_spans", "Alignment", "ALIGNERS",
           "Placement", "ChannelRule", "IdentityRule", "Figure",
           "RelationSchema", "Instance", "Refusal", "NoReferent",
           "Predicate", "Agree", "Differ", "Free", "ClassEqual",
           "DirectedDiffer", "PresentVsAbsent", "SequenceEqual",
           "SequenceSuffix", "SubsequenceOf", "Read", "ChannelSet",
           "DEFAULT_CHANNELS", "evaluate", "realise", "assemble",
           "mirrored", "order_burden", "Inert", "INERT", "check_inert",
           "line_pairs_for", "pair_satisfies", "declare_delivery",
           "declare_stub_resolution", "search_stub_resolution",
           "STUB_INCIPIT_LENGTHS", "declare_senses",
           "declare_period_surface", "declare_lifts",
           "search_lifts", "LIFTS_PER_HALF_LINE",
           "HALVES_PER_LINE",
           "ALT_SURFACES", "QUOTIENT_CAP",
           "Supply", "SUPPLY_STATES", "REFUSAL_KINDS",
           "Unprovidable", "UNPROVIDABLE", "check_unprovidable",
           "print_unprovidable_report",
           "mark_refrain_tail", "search_caesura", "mark_printed_caesura",
           "declare_orthography",
           "REGISTRY", "QUERIES", "declare", "all_schemas",
           "capability_report", "tri_and", "tri_or",
           "Tradition", "CANON", "LANG_CELL", "UNSOURCED", "SCOPES",
           "canon_entries", "cited_cells", "named_cells", "tradition_scope",
           "tradition_report", "search_burden", "relation_report",
           "print_relation_report"]


def main(argv):
    """`python3 quality/relations.py FILE [--lang=xxx] [--inert]
    [--unprovidable]`.

    THE HONEST CONSUMER, reachable.  The `relations` verb in lyric_harness.py
    prints a schema name and a count and cannot say which tradition the schema
    belongs to; this prints the SCOPE on every row.  The phonology is imported
    here and not at module level, because nothing in this module transcribes
    and `phon` stays injectable -- this function is the adapter, not the
    library.
    """
    from quality.phonology import get as get_phonology
    lang, paths, limit, inert, unprov = "eng", [], None, False, False
    for a in argv:
        if a.startswith("--lang="):
            lang = a.split("=", 1)[1]
        elif a.startswith("--limit="):
            limit = int(a.split("=", 1)[1])
        elif a == "--inert":
            inert = True
        elif a == "--unprovidable":
            unprov = True
        else:
            paths.append(a)
    if not paths:
        print(main.__doc__)
        print(f"  declared schemas {len(REGISTRY)}; sourced traditions on "
              f"{sum(1 for s in REGISTRY.values() if s.traditions)}, honestly "
              f"empty on {len(UNSOURCED)} ({', '.join(sorted(UNSOURCED))})")
        for lg in ("eng", "cym", "fin", "ltc", "msa", "fas", "san", "non",
                   "som"):
            r = tradition_report(lg)
            print(f"    {lg}: in-tradition {len(r['in_tradition']):3d}  "
                  f"source-cannot-say {len(r['cell_cited']):3d}  "
                  f"rule-shape-only {len(r['rule_shape']):3d}  "
                  f"unsourced {len(r['unsourced'])}")
        return 0
    # APPARATUS IS `[Section]`, `--- ` OR `#`, and this reader kept only the
    # first of the three -- so a `#` stage direction or a `--- TITLE:` note
    # reached build_stream as a line of verse, was tokenised, and entered
    # every schema's span enumeration and the stanza frame.  The SAME file
    # through `python3 lyric_harness.py relations FILE` dropped it, because
    # that verb was centralised onto `is_apparatus_line` on 2026-08-12 and
    # this one, in a different file, was not: two surfaces over one text,
    # reading different lines.  SPELLED HERE rather than imported: P10's
    # invariant is that this module imports nothing from lyric_harness (the
    # `&c.` detector is the EDITION's business and must not leak in), and
    # `quality/readability.py`'s `read_lines` and `quality/grid.py`'s
    # `read_marked_songs` already carry their own copy for the same reason.
    # `load_lyric_lines` would be wrong even if it were importable: it drops
    # BLANK lines, and this module derives the stanza frame from them.
    raw = [l.rstrip() for l in open(paths[0]).read().splitlines()
           if not l.strip().startswith(("[", "---", "#"))]
    # `stanzas` LEFT TO THE DERIVATION, not pre-computed and handed back
    # (M-39).  `raw` keeps blank lines -- the comment above says why -- so a
    # text that prints its stanzas frames exactly as before; what changes is
    # a text that prints NONE, where passing the all-zero derivation as an
    # explicit list recorded `stanza_source='declared'` and let five
    # `frame="stanza"` schemas quantify over one frame.
    st = build_stream(raw, get_phonology(lang), declaration={"language": lang})
    print(f"  {paths[0]}   lines {sum(1 for l in raw if l.strip())}   units "
          f"{len(st.units)}   UNREADABLE tokens {len(st.unreadable)}")
    if inert:
        return print_inert_report(st)
    if unprov:
        return print_unprovidable_report(st)
    print_relation_report(relation_report(st), limit=limit)
    return 0


def print_unprovidable_report(stream):
    """`--unprovidable`: the capabilities NO declaration can supply, the
    schemas each one strands, and which of doctrine 44/92's three blockers it
    is -- plus the MEASURED check that each is still unsupplied.

    `capability_report` answers this for one stream. This answers it for every
    stream there can be, which is the number that decides whether a gap is a
    corpus problem or a build.
    """
    print(f"\nUNPROVIDABLE CAPABILITIES — {len(UNPROVIDABLE)} of the "
          f"{len({c for s in REGISTRY.values() for c in s.capabilities()})} "
          f"any schema names")
    for e in UNPROVIDABLE:
        print(f"\n  {e.capability}   [{e.blocker}]   strands "
              f"{', '.join(e.schemas)}")
        print(f"    NEEDS            {e.needs}")
        print(f"    WOULD MANUFACTURE {e.would_manufacture}")
        print(f"    {e.detail}")
    bad = check_unprovidable(stream)
    print(f"\n  ALT_SURFACES (a declaration CAN supply these): "
          f"{', '.join(ALT_SURFACES)}")
    print(f"  check_unprovidable: "
          f"{'every entry holds' if not bad else bad}")
    return 1 if bad else 0


def print_inert_report(stream):
    """`--inert`: the declared-inert fields, MEASURED, plus what the text-order
    convention costs each schema.  Exit 1 on any finding, so a declaration that
    has become false is a failing command and not a paragraph somebody reads.
    """
    print("\nDECLARED INERT (section 10a) — reason, activation, blocker")
    census = inert_census(stream)
    for e in INERT:
        n, vals = census[e.field]
        print(f"\n  {e.field}   blocker={e.blocker}")
        print(f"      MEASURED  : {len(vals)} value(s) over {n} observations "
              f"— {', '.join(vals)}")
        print(f"      why inert : {e.reason}")
        print(f"      activates : {e.activates_when}")
    bad = check_inert(stream)
    print(f"\n  VERDICT: "
          f"{'every declaration holds' if not bad else str(len(bad)) + ' FALSE'}")
    for b in bad:
        print(f"      FAIL {b}")

    print("\nTEXT-ORDER BURDEN — INSTANCES, from realise()'s own tally")
    print("  `recovered` = instances the pre-2026-08-11 positional skip "
          "DELETED\n  rather than de-duplicated. Only an ASYMMETRIC schema "
          "can have any.")
    print("  dedup is CANDIDATE pairs, recov is INSTANCES — two "
          "denominators, never a ratio.")
    rows = []
    for name in sorted(REGISTRY):
        s = order_burden(REGISTRY[name], stream)
        if s["recovered_instances"]:
            rows.append((name, s))
    sym_orphans = [n for n, s in rows if s["symmetric"]]
    print(f"\n  schemas recovering at least one deleted instance: {len(rows)} "
          f"(SYMMETRIC among them: {len(sym_orphans)} — must be 0)")
    print(f"      {'schema':40s} {'sym':>5s} {'inst':>7s} {'dedup':>8s} "
          f"{'recov':>6s} {'rec=T':>6s}")
    for name, s in rows:
        print(f"      {name[:40]:40s} {str(s['symmetric']):>5s} "
              f"{s['instances']:7d} {s['deduplicated_candidates']:8d} "
              f"{s['recovered_instances']:6d} {s['recovered_true']:6d}")
    print(f"  TOTAL recovered {sum(s['recovered_instances'] for _, s in rows)} "
          f"instances, of which TRUE "
          f"{sum(s['recovered_true'] for _, s in rows)}")
    if sym_orphans:
        bad.append(f"symmetric schemas recovered instances: {sym_orphans} — "
                   f"de-duplication is not exact")
        print(f"      FAIL {bad[-1]}")
    return 1 if bad else 0


if __name__ == "__main__":
    import sys as _sys
    _sys.path.insert(0, __import__("os").path.dirname(
        __import__("os").path.dirname(__import__("os").path.abspath(__file__))))
    raise SystemExit(main(_sys.argv[1:]))

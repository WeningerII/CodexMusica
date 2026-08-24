#!/usr/bin/env python3
"""THE SLOT: WHERE IN A LINE A MANDATE BINDS.

WHAT THIS CLOSES.  Doctrine 2's first sentence is "the full pairwise score
matrix is the primary object ... letter schemes, chains, blueprints are lossy
projections", and every enforcement layer in this repository was nonetheless
built on ONE projection: the line's last word.  `line_anchors` takes
`words[-1]`; a `Mandate` group is a tuple of LINE numbers, so the declaration
layer cannot say WHERE in a line a requirement binds; `swap_end_word` is the
revise loop's only move; the planner emits end-letter schemes.  A writer who
wanted L3's opening word to answer L2's last one had no way to SPELL it, so
the harness could not ask for it, could not grade it, and could not plan it.

The owner's ruling, 2026-08-23, verbatim: *"it looks like an insane idea to me
to only be planning around end rhyme and only ever look for end rhymes ...
there's just no way that we can only be contemplating the last word of every
line."*

AND `grade()` ALREADY SAID SO IN ITS OWN COMMENT.  `quality/revise.py` passes
`position="end"` to the named judge under this argument: *"A mandate's groups
are end-rhyme groups by construction, so 'end' is the honest value here ... it
is exactly the wrong value for the internal, head, leonine, cross and
holorhyme relations, which this path therefore cannot yet mandate."*  That is
a correct diagnosis sitting one line above the hardcoded value it diagnoses.
This module is the coordinate that makes the first clause false.

THE VOCABULARY IS NOT NEW AND IS NOT RE-DECLARED HERE.  `quality/relations.py`
has carried it since 2026-08-10: a member is found by a `SpanRule` — a LOCUS
(where to look), an ANCHOR (what fixes the span's origin inside it), a
DIRECTION and a MAGNITUDE — and its own census is the argument for this
module's existence.  Over the 77 registered schemas' 154 member rules the
anchors are `word_start` 64, `last_stressed` 58, `word_end` 15, `searched` 8,
`none` 6, `final_unstressed` 2, `penult` 1: the vocabulary is almost evenly
split between reading from the FRONT of a word and reading from the BACK, and
8 schemas are MIXED — one member anchored at each end, which no global
alignment setting can express (amphisbaenic rhyme is `word_start` against
`word_end`; linked rhyme is a line-final against a line-INITIAL).  This module
imports `SpanRule` and the named rule constants from there rather than
spelling a second copy, so the two layers cannot drift (doctrine 1) and a rule
added there is declarable here the same day.

WHERE A SLOT LIVES, AND WHY NOT IN `groups`.  A `Mandate` group is a tuple of
1-based line numbers and roughly sixty sites take that literally — `min()`,
`max()`, `sorted()`, `matrix[i - 1][j - 1]`, the `range(1, n + 1)` complement
that computes `free`, and `_normalise_groups`' own `int(x)` coercion.  Putting
a placement object into that tuple would either be silently coerced back to an
int at the door or break every one of those sites.  So placement rides in a
PARALLEL index-aligned coordinate, `Mandate.loci`, which is exactly the
convention `structures` and `relations` already use and for the same reason:
absence has ONE meaning (the default slot), a shorter tuple reads as default
for the tail, and a mandate that never learned the coordinate is byte-for-byte
the object it always was.

WHAT THIS PHASE DOES NOT REACH, STATED SO IT IS A BOUNDARY AND NOT A SILENCE
(doctrine 20).  A group is a SET of lines, so it cannot name one line twice,
so a WITHIN-LINE binding — L1's opening answering L1's own ending — is not
expressible as a mandated group and `mandate()` refuses one with the reason
rather than dropping the duplicate.  That case is not unreached by the
harness: `quality/relations.py` realises same-line instances and
`quality/figures.py` is the reader built to keep exactly the instances
`line_pairs_for` drops.  The refusal names that route.

TWO READERS, DECLARED, BECAUSE THE ALTERNATIVE IS A SILENT THIRD (doctrine 1).
  * The DEFAULT slot — line-final token, last-stressed anchor, to the word's
    end — is resolved by CALLING `line_anchors`.  Not reimplemented: called.
    Every mandate that names bare line numbers is therefore byte-identical to
    what it has always been BY CONSTRUCTION rather than by a test that hopes
    so, and the homograph variant cycling and metrical promotion that function
    performs are inherited rather than copied.  `test_slots.py` §1 pins the
    identity anyway, because "by construction" is a claim about code that can
    stop being true.
  * Every OTHER slot is resolved over `lyric_harness.word_syllable_map`, which
    is the reader `internal_matches` has always used for in-line spans.  It
    syllabifies each word ALONE, where `line_anchors` syllabifies the line's
    whole phone string, so the two can disagree about a cross-word
    resyllabification.  That difference is REAL and is declared here rather
    than discovered later: the in-line reader is the one this repository has
    already measured in-line material with, and introducing a third reading to
    paper over the seam would be the defect this paragraph exists to avoid.

WHAT REFUSES, AND WHY THAT IS THE POINT (doctrine 20).  Seven of the thirteen
loci `relations.py` knows need a FRAME that a plain mandate does not carry — a
caesura, a lift template, a refrain tail, a search.  They are not silently
resolved to something nearby and they are not silently dropped: `check` raises
`SlotUnsupported` naming the locus and the frame it would need, at DECLARATION
time, so a writer is refused while they still hold the sentence they got wrong
rather than being handed a different question's answer at grade time.

Test: python3 quality/test_slots.py
"""

from dataclasses import dataclass, replace

from quality import relations as REL

__all__ = ["Slot", "SlotUnsupported", "DEFAULT_RULE", "GRADEABLE_LOCI",
           "PLANNABLE_PLACEMENTS", "LAST_WORD", "placement_word",
           "GRADEABLE_ANCHORS", "FRAME_LOCI", "NAMED_SLOTS",
           "as_slot", "slot_line", "is_default", "check", "resolve",
           "parse_slot", "spell_slot", "position_of", "word_phrase"]


class SlotUnsupported(ValueError):
    """A slot naming a placement this grading path cannot resolve.

    The message is the verdict and names the frame that would be needed. It
    is a ValueError so the CLI's existing `REFUSED ... exit 2` path carries
    it with no new handler, the same route `NoMandate` already takes.
    """


#: THE DEFAULT SLOT'S RULE — `relations.END_ANCHOR`, imported and not
#: respelled. Line-final token, anchored on the last stressed syllable,
#: running to the word's end: exactly what `line_anchors` computes, which is
#: why the default resolution can BE that function.
DEFAULT_RULE = REL.END_ANCHOR

#: The loci this path can resolve from a lexicon syllable map alone. Every
#: one is a position a reader finds in the printed line with no declared
#: frame — which is the whole membership rule, stated so that a locus added
#: later lands on one side of it by argument rather than by whoever is
#: editing.
GRADEABLE_LOCI = ("line_final_token", "line_initial_token", "any_token",
                  "line")

#: {locus: the frame it would need} for the loci this path REFUSES. Not a
#: list of "unsupported" names — a list of what each one is WAITING FOR, so
#: the refusal names a remedy and the set shrinks when a frame becomes
#: declarable rather than when somebody remembers this constant.
FRAME_LOCI = {
    "half_line_a": "a caesura (relations.search_caesura / "
                   "mark_printed_caesura)",
    "half_line_b": "a caesura (relations.search_caesura / "
                   "mark_printed_caesura)",
    "lift": "a metrical lift template (relations.declare_lifts / "
            "search_lifts)",
    "line_refrain_tail": "a refrain tail (relations.mark_refrain_tail)",
    "line_final_before_refrain": "a refrain tail "
                                 "(relations.mark_refrain_tail)",
    "free_run": "a SEARCH over windows — every placement tried, which needs "
                "the multiplicity correction doctrine 56 requires and which "
                "a mandated pair has nowhere to carry",
    "line_head_index": "a declared head index; the locus takes its position "
                       "from the rule's own magnitude and no mandate "
                       "spelling reaches it",
    "token_first_half": "a declared token split; reachable from a schema "
                        "rule, with no mandate spelling yet",
    "token_second_half": "a declared token split; reachable from a schema "
                         "rule, with no mandate spelling yet",
}

#: The anchors this path can resolve. `searched` is absent for the reason
#: `free_run` is: a searched anchor tries k hypotheses and REPORTS k, and a
#: mandated pair has nowhere to carry the correction (doctrine 56).
GRADEABLE_ANCHORS = ("word_start", "word_end", "last_stressed", "penult",
                     "final_unstressed", "second_syllable", "none")


@dataclass(frozen=True)
class Slot:
    """A binding site: a 1-based LINE, and the rule that finds its span.

    Slots are the RESOLVED form of `Mandate.loci`'s per-member spellings; they
    are not what a group holds (see the module docstring). Equality is
    structural, so two slots on one line at two loci are two sites — which is
    what a caller comparing them means, and is not in tension with a group's
    line-level membership because a group holds ints.
    """
    line: int
    rule: object = DEFAULT_RULE

    def __post_init__(self):
        if isinstance(self.line, bool) or not isinstance(self.line, int):
            raise SlotUnsupported(
                f"a slot's line must be an int, got {self.line!r}")
        if self.line < 1:
            raise SlotUnsupported(
                f"a slot's line is 1-BASED, got {self.line} — the mandate "
                f"layer counts lines from 1, and a 0 crossing that boundary "
                f"is an off-by-one, not a declaration")

    @property
    def locus(self):
        return self.rule.locus

    @property
    def anchor(self):
        return self.rule.anchor

    def is_default(self):
        return self.rule == DEFAULT_RULE

    def __str__(self):
        return spell_slot(self)


def _token_rule(n0):
    """The rule for the n0-th token (0-based), read as a RHYME span.

    `last_stressed` to the word's end, which is what `END_ANCHOR` reads at the
    line's last token — the same question asked at a different token, so a
    mid-line binding is graded by the comparator that was calibrated for it
    rather than by a different reading that happens to be nearby.

    The index rides in `SpanRule.requires` because that tuple is the rule's
    own declared-extras channel; adding a field to a frozen dataclass in
    another module for one caller would be how two modules start disagreeing
    about a shape.
    """
    return replace(REL.END_ANCHOR, locus="any_token",
                   requires=(f"token:{n0}",))


#: WRITER-FACING NAMES for the placements a mandate can spell, and the ONLY
#: place a name is bound to a rule. Every value is a `relations` constant or a
#: `replace()` of one, so the placement semantics live in that module and this
#: table is a spelling, never a second definition.
#:
#: TOKEN INDICES ARE 1-BASED HERE and 0-based in `relations`. That conversion
#: happens in `parse_slot`/`spell_slot`/`_token_rule` and NOWHERE else — the
#: discipline `line_pairs_for`'s `+1` states for line numbers, for the same
#: reason: a conversion performed at each caller is one that will eventually
#: be performed differently at one of them.
NAMED_SLOTS = {
    # the rhyme span of the line's last word: from its last stress to its end
    "end": DEFAULT_RULE,
    # the last word read WHOLE, from its first syllable — the spelling-class
    # question rather than the rhyme question
    "endword": REL.END_WORD,
    # the line's first word, from its start: the alliteration/head-rhyme
    # placement, which is where 64 of the registry's 154 member rules sit
    "head": REL.HEAD_LINE,
    # the line's first word read as a RHYME span, for a head-anchored
    # requirement that still asks a rhyme question
    "headrime": replace(REL.END_ANCHOR, locus="line_initial_token"),
    # every syllable of the line, in order
    "line": REL.WHOLE_LINE,
}


#: WHAT A PLANNER MAY VOLUNTEER. A subset of `NAMED_SLOTS`, and the subset
#: is an argument rather than a preference:
#:   * `line` is excluded — a whole-line span standing in a rhyme relation is
#:     a holorhyme-shaped demand, and a generator that volunteers one is
#:     asking for a figure the writer did not request (the owner's "move 37"
#:     ban pointed at placement instead of at shape). It stays declarable.
#:   * `T<n>` is NOT here because it carries an index: a planner draws it
#:     with the index bounded by what a line reliably HAS, which is a
#:     coordinate of the plan and not of this table.
#: `end` IS a member, and that is the point: it is one placement among the
#: ones this path can grade, not the axis everything else is measured
#: against.
PLANNABLE_PLACEMENTS = ("end", "endword", "head", "headrime")


def as_slot(member, rule=None):
    """int | Slot -> Slot. A bare line number IS the default slot.

    Absence has ONE meaning (doctrine 66): a mandate written before this
    module existed declares the end of the line, which is what it has always
    meant, so no stored mandate changes its reading.
    """
    if isinstance(member, Slot):
        return member if rule is None else replace(member, rule=rule)
    line = int(member)
    return Slot(line) if rule is None else Slot(line, rule)


def slot_line(member):
    """int | Slot -> the 1-based line number. The line-level question."""
    return member.line if isinstance(member, Slot) else int(member)


def is_default(member):
    """Is this the plain end-of-line binding? Bare ints are."""
    return not isinstance(member, Slot) or member.is_default()


def position_of(member):
    """-> the `position=` a named-relation judge should be asked under.

    `rhyme_types.satisfies_relation` takes a placement name, and `grade()`
    hardcoded `"end"` with a comment saying that is exactly wrong for every
    head, internal and cross relation. This is the coordinate that answers it
    from the DECLARATION instead of from a literal.
    """
    slot = as_slot(member)
    locus = slot.rule.locus
    if locus == "line_final_token":
        return "end"
    if locus == "line_initial_token":
        return "head"
    if locus == "line":
        return "internal"
    return "internal"


def parse_slot(text):
    """'3' | '3.end' | '3.head' | '3.line' | '3.T2' -> Slot.

    The CLI spelling for a `--groups` member. A bare number is the default
    slot, so every command line ever typed parses to exactly what it meant.
    """
    s = str(text).strip()
    if not s:
        raise SlotUnsupported("empty slot")
    if "." not in s:
        try:
            return Slot(int(s))
        except ValueError:
            raise SlotUnsupported(
                f"{s!r} is not a line number. A group member is a line "
                f"(`3`) or a line and a place in it (`3.head`, `3.T2`); "
                f"places are {', '.join(sorted(NAMED_SLOTS))}, or T<n> for "
                f"the n-th word (1-based).")
    head, _, tail = s.partition(".")
    try:
        line = int(head)
    except ValueError:
        raise SlotUnsupported(f"{s!r} does not start with a line number")
    key = tail.strip().lower()
    if key in NAMED_SLOTS:
        return Slot(line, NAMED_SLOTS[key])
    if key.startswith("t") and key[1:].isdigit():
        n = int(key[1:])
        if n < 1:
            raise SlotUnsupported(
                f"{s!r}: words are numbered from 1 in a declaration (T1 is "
                f"the line's first word), the same base its line numbers use")
        return Slot(line, _token_rule(n - 1))
    raise SlotUnsupported(
        f"{s!r} names no place this harness can find. Declared places: "
        f"{', '.join(sorted(NAMED_SLOTS))}, or T<n> for the n-th word "
        f"(1-based).")


def spell_slot(slot):
    """Slot -> the writer-facing spelling; the inverse of `parse_slot` for
    every slot `parse_slot` can produce. `test_slots.py` §2 round-trips the
    whole named table rather than a sample, so a name added without a
    spelling is a failing test."""
    slot = as_slot(slot)
    if slot.is_default():
        return str(slot.line)
    for nm, rule in NAMED_SLOTS.items():
        if rule == slot.rule and nm != "end":
            return f"{slot.line}.{nm}"
    tok = _declared_token(slot.rule)
    if tok is not None:
        return f"{slot.line}.T{tok + 1}"
    return f"{slot.line}.<{slot.rule.locus}/{slot.rule.anchor}>"


#: The sentinel for the line's LAST word, whose index no declaration knows.
#: It is a WORD and not an index, and keeping it un-numbered is what stops a
#: caller asserting a line length nobody measured.
LAST_WORD = "last"


def placement_word(place):
    """placement name -> the WORD it binds: a 1-based index from the front of
    the line, or `LAST_WORD`.

    THE COORDINATE THAT SAYS WHETHER TWO BINDINGS MEET (`MISSING.md` M-80).
    This table binds FOUR names to only TWO words at the ends of a line —
    `end` and `endword` are both the last word (its rhyme span and the whole
    of it), `head`, `headrime` and `T1` are all the first — so "these are
    different placements" and "these are different words" are different
    questions, and only the second one answers whether two rhyme groups land
    on one word. `quality/plan.py` asked the first for as long as it drew
    placements at all, and 94% of its plans put two declared groups on one
    word as a result.

    IT LIVES HERE because this module is *"the ONLY place a name is bound to
    a rule"* (`NAMED_SLOTS`' own docstring). Derived from the rule's LOCUS,
    so a placement added to the table is answered by this function on the day
    it is added rather than by a second table that goes stale (doctrine 1).

    A locus this cannot resolve to one word REFUSES (doctrine 20): a
    placement filed under a nearby word cannot be tested for collision, and
    an unchecked collision reads exactly like a line with none. `line` is the
    registered case — a whole-line span is not a word — and it is already
    outside `PLANNABLE_PLACEMENTS` for its own separate reason.
    """
    rule = parse_slot(f"1.{place}").rule
    if rule.locus == "line_initial_token":
        return 1
    if rule.locus == "line_final_token":
        return LAST_WORD
    tok = _declared_token(rule)
    if rule.locus == "any_token" and tok is not None:
        return tok + 1
    raise SlotUnsupported(
        f"the placement {place!r} resolves to locus {rule.locus!r}, and this "
        f"module cannot say WHICH WORD of the line that is. A placement whose "
        f"word is unknown cannot be tested against another for landing on the "
        f"same one, so it is REFUSED rather than filed under a nearby word.")



def word_phrase(member):
    """member -> the bound word IN WORDS: 'end word', 'first word', 'word 4'.

    THE WRITER-FACING SPELLING, and it lives here for `placement_word`'s own
    reason: this module is the ONLY place a name is bound to a rule, so a
    second table naming the same span in a renderer is doctrine 1's case.
    `spell_slot` answers the MANDATE's notation (`3.T4`); this answers the
    PROMPT's ("word 4"), and both derive from the one rule.

    WHY IT EXISTS (`MISSING.md` M-91): `quality/propose.py` and
    `revise.Brief.__str__` both told a writer to change the "end word"
    whatever the mandate bound, for as long as placement has existed. Two
    renderers, one false sentence, and the fix had to be one function or it
    would have been two.

    THE DEFAULT IS 'end word' — every bare-int member, i.e. every mandate
    written before placement existed — so no prompt this repo has produced
    moves. A locus that resolves to no single word is REFUSED by
    `placement_word` and named here rather than defaulted, because defaulting
    to "end word" is the defect.
    """
    try:
        if is_default(member):
            return "end word"
        spelled = spell_slot(member)
        name = spelled.split(".", 1)[1] if "." in spelled else ""
        word = placement_word(name)
    except SlotUnsupported:
        return f"declared span {spell_slot(member)}"
    if word == LAST_WORD:
        return "end word"
    if word == 1:
        return "first word"
    return f"word {word}"

def _declared_token(rule):
    """-> the 0-based token index a `token:N` requirement names, or None."""
    for r in getattr(rule, "requires", ()) or ():
        if isinstance(r, str) and r.startswith("token:"):
            try:
                return int(r.split(":", 1)[1])
            except ValueError:
                return None
    return None


def check(member):
    """Refuse a slot this path cannot grade — at DECLARATION time.

    Returns the Slot so it can be used in an expression.
    """
    slot = as_slot(member)
    rule = slot.rule
    if rule.locus in FRAME_LOCI:
        raise SlotUnsupported(
            f"locus {rule.locus!r} needs {FRAME_LOCI[rule.locus]}. A mandate "
            f"carries no such frame, so this binding is REFUSED rather than "
            f"resolved to the nearest position that does work — declare it "
            f"as a `schema:` relation, which builds the stream that supplies "
            f"the frame.")
    if rule.locus not in GRADEABLE_LOCI:
        raise SlotUnsupported(
            f"locus {rule.locus!r} is not one this path resolves. Gradeable: "
            f"{', '.join(GRADEABLE_LOCI)}; frame-blocked: "
            f"{', '.join(sorted(FRAME_LOCI))}.")
    if rule.anchor not in GRADEABLE_ANCHORS:
        raise SlotUnsupported(
            f"anchor {rule.anchor!r} is not one this path resolves. "
            f"Gradeable: {', '.join(GRADEABLE_ANCHORS)}. `searched` is "
            f"excluded deliberately: it tries k hypotheses and a mandated "
            f"pair has nowhere to carry the multiplicity correction "
            f"doctrine 56 requires.")
    if rule.locus == "any_token" and _declared_token(rule) is None:
        raise SlotUnsupported(
            "locus 'any_token' in a mandate must name WHICH word (spell it "
            "`<line>.T<n>`); an unindexed token locus is a search over the "
            "line, and a mandated pair carries no multiplicity correction "
            "for one.")
    return slot


# ---------------------------------------------------------------- resolution


def _token_runs(smap):
    """-> {widx: (first index, last index)} over a `word_syllable_map`.

    Built from the map's own `widx` tags rather than from a re-tokenisation:
    a word CMUdict cannot read contributes NO syllables, so a second
    tokenisation would number the words differently from the map that is
    about to be indexed (`word_syllable_map`'s own docstring records the gap).
    """
    runs = {}
    for i, s in enumerate(smap):
        w = s.get("widx")
        if w is None:
            continue
        runs[w] = (runs[w][0], i) if w in runs else (i, i)
    return runs


def _anchor_index(smap, lo, hi, anchor):
    """The anchor's index inside [lo, hi], or None when it names nothing.

    None is a SKIP, never a guess: `penult` names nothing in a monosyllable
    and `last_stressed` names nothing in a span with no stress, and the
    honest answer there is that this line has no such position —
    `relations._anchor_pos` raises `NoReferent` for the identical reason.
    """
    if anchor in ("word_start", "none"):
        return lo
    if anchor == "word_end":
        return hi
    if anchor == "second_syllable":
        return lo + 1 if hi >= lo + 1 else None
    if anchor == "penult":
        return hi - 1 if hi - 1 >= lo else None
    if anchor == "last_stressed":
        for i in range(hi, lo - 1, -1):
            if smap[i].get("stress") in (1, 2):
                return i
        return None
    if anchor == "final_unstressed":
        return hi if smap[hi].get("stress") not in (1, 2) else None
    return None


def _cut(start, hi, magnitude):
    """[start, end) per the rule's magnitude, clipped to the locus."""
    if isinstance(magnitude, int) and not isinstance(magnitude, bool):
        return start, min(hi + 1, start + magnitude)
    if magnitude in ("to_word_end", "whole", "to_line_end"):
        return start, hi + 1
    raise SlotUnsupported(
        f"magnitude {magnitude!r} is not one this path resolves; declared: "
        f"an integer syllable count, 'to_word_end', 'whole', 'to_line_end'. "
        f"A magnitude silently rounded to the nearest span is a span nobody "
        f"declared.")


def resolve(lex, line_text, member, promote=False):
    """(lexicon, the line's text, int|Slot) -> (anchors, label, oov).

    The SAME triple `line_anchors` returns, so every consumer of that
    function consumes this one unchanged: a list of anchor readings (each a
    list of syllable dicts), the label word, and the out-of-vocabulary list.

    THE DEFAULT SLOT IS `line_anchors`, CALLED — see the module docstring.
    """
    slot = check(member)
    if slot.is_default():
        return _LA(lex, line_text, promote=promote)

    smap = _WSM(lex, line_text)
    if not smap:
        return [], "", []
    runs = _token_runs(smap)
    if not runs:
        return [], "", []
    rule = slot.rule
    order = sorted(runs)

    if rule.locus == "line":
        lo, hi = runs[order[0]][0], runs[order[-1]][1]
    elif rule.locus == "line_final_token":
        lo, hi = runs[order[-1]]
    elif rule.locus == "line_initial_token":
        lo, hi = runs[order[0]]
    else:                                       # any_token, index declared
        want = _declared_token(rule)
        if want not in runs:
            # The declared word exists and contributed no syllables, or the
            # line is shorter than the declaration says. Either way the
            # honest answer is NO ANCHOR — the same answer an unreadable end
            # word already gets, and the readability layer already reports.
            return [], "", []
        lo, hi = runs[want]

    st = _anchor_index(smap, lo, hi, rule.anchor)
    if st is None:
        return [], "", []
    a, b = _cut(st, hi, rule.magnitude)
    if b <= a:
        return [], "", []
    anchor = [dict(s) for s in smap[a:b]]
    return [anchor], _label_for(anchor), []


def _label_for(anchor):
    """The words a resolved span covers, in order, deduplicated by run — the
    shape `_span_words` builds, so a finding about a slot names text a reader
    can find rather than a syllable index."""
    out = []
    for s in anchor:
        w = s.get("word")
        if w and (not out or out[-1] != w):
            out.append(w)
    return " ".join(out)


# Imported by name at module scope so a reader of this file can see which two
# readers the docstring's "TWO READERS" paragraph is about without following
# a call chain. At the bottom because `lyric_harness` imports `quality`
# modules on some paths and this keeps the cycle one-directional.
from lyric_harness import line_anchors as _LA          # noqa: E402
from lyric_harness import word_syllable_map as _WSM    # noqa: E402

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

PHONOLOGY STAYS INJECTABLE.  Nothing here transcribes and nothing here consults
CMUdict.  `phon` is any object with `.syllabify(word)`.  The channel INVENTORY
is itself a declaration coordinate: Welsh does not declare onset and coda as
separate channels at all, it declares a consonant sequence, so `ChannelSet`
is per-declaration and the schemas name channels the declaration must provide.
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
    schema: str
    capability: str
    detail: str

    def __bool__(self):
        raise TypeError(
            "a Refusal has no truth value; it is not False. Read .capability.")


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

    @property
    def word_initial(self):
        return self.tok_syl == 0

    @property
    def word_final(self):
        return self.tok_syl == self.tok_len - 1

    @property
    def line_initial(self):
        return self.token == 0 and self.word_initial

    @property
    def line_final(self):
        return self.token == self.line_tokens - 1 and self.word_final

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
    beat: object = None                              # doctrine 4: stays None
    hemistich: dict = field(default_factory=dict)    # line -> (bayt, half)
    bayt_source: str = "none"


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

    # -- capabilities.  A schema's `requires` is checked against these, and a
    #    missing one produces a Refusal naming it rather than a wrong number.
    def provides(self, cap):
        if cap == "prominence":
            return any(u.syl.prominence is not None for u in self.units)
        if cap == "caesura":
            return self.frames.caesura_source != "none"
        if cap == "lifts":
            return self.frames.lift_source != "none"
        if cap == "refrain_tail":
            return self.frames.refrain_source != "none"
        if cap == "beat":
            return self.frames.beat is not None
        if cap == "bayt":
            return self.frames.bayt_source != "none"
        if cap in ("orthography", "earlier", "delivered", "sung", "licence"):
            return cap in self.alt
        if cap in ("lexicon", "sense", "morphology"):
            return cap in self.declaration.get("resources", ())
        return False

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


def build_stream(text_lines, phon, sections=None, tokeniser=tokenise,
                 declaration=None, hyphen_continues=True):
    """Syllabify a whole song ONCE into one flat indexed sequence.

    O(total syllables).  A 40-line lyric is ~250 units; a 5,000-line corpus item
    is ~30,000, which is a list, not a problem.  Everything downstream indexes
    into this, so no relation ever re-syllabifies and no relation is confined to
    a stanza.
    """
    units, lines, toks = [], [], {}
    pending_split = False
    for li, raw in enumerate(text_lines):
        words = tokeniser(raw)
        cut = bool(re.search(r"[\w’'](-)\s*$", raw)) and hyphen_continues
        idxs = []
        for ti, w in enumerate(words):
            sy = phon.syllabify(w)
            if not sy:
                # out of the declared inventory: the token contributes NO units.
                # It is not silently dropped from the record -- the token index
                # still advances, so a placement rule reading `line_tokens`
                # still sees it.
                continue
            for si, s in enumerate(sy):
                u = Unit(i=len(units), syl=s, line=li, token=ti, tok_syl=si,
                         tok_len=len(sy), token_text=w, line_tokens=len(words),
                         section=(sections[li] if sections else ""),
                         stanza=0,
                         split_left=(pending_split and ti == 0),
                         split_right=(cut and ti == len(words) - 1))
                units.append(u)
                idxs.append(u.i)
            toks[(li, ti)] = tuple(
                u.i for u in units if u.line == li and u.token == ti)
        pending_split = cut
        lines.append(tuple(idxs))
    return Stream(units=units, lines=lines, tokens=toks, phon=phon,
                  declaration=dict(declaration or {}),
                  text_lines=tuple(text_lines))


# ---------------------------------------------------------------------------
# 2. CHANNELS AND SURFACES
#
# The channel INVENTORY is a declaration coordinate.  Welsh declares a single
# consonant channel and does not separate onset from coda; Middle Chinese
# declares tone where English declares stress and has no stress at all.  A
# schema names channels; a declaration that cannot supply one yields None,
# which propagates -- it does not become False.
# ---------------------------------------------------------------------------


def _rd_onset(u):
    return tuple(u.syl.onset)


def _rd_nucleus(u):
    return u.syl.nucleus


def _rd_coda(u):
    return tuple(u.syl.coda)


def _rd_prominence(u):
    return u.syl.prominence


def _rd_moras(u):
    return u.syl.moras


def _rd_consonants(u):
    """Welsh: onsets and codas are NOT distinguished; the skeleton is one
    ordered consonant sequence gathered across word and syllable boundaries."""
    return tuple(u.syl.onset) + tuple(u.syl.coda)


def _rd_phones(u):
    """The syllable flattened to its ordered phone sequence.  A span is a
    selection of SYLLABLE indices; a sequence-scoped channel on this reader is
    how a phone-level relation is reached without a second stream."""
    n = u.syl.nucleus
    return tuple(u.syl.onset) + ((n,) if n else ()) + tuple(u.syl.coda)


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
    Where the two syllabifications disagree in LENGTH the projection returns
    None: a surface that re-syllabifies the word cannot be read position-wise,
    and saying so is the honest answer."""
    for v in alt.tokens.get((u.line, u.token), ()):
        w = alt.units[v]
        if w.tok_len != u.tok_len:
            return None
        if w.tok_syl == u.tok_syl:
            return w
    return None


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


class Predicate:
    name = "predicate"

    def __call__(self, x, y):
        raise NotImplementedError


class Agree(Predicate):
    name = "AGREE"

    def __call__(self, x, y):
        if x is None or y is None:
            return Read(None, False, "unreadable on this surface")
        return Read(x == y, not (_empty(x) and _empty(y)))


class Differ(Predicate):
    name = "DIFFER"

    def __call__(self, x, y):
        if x is None or y is None:
            return Read(None, False, "unreadable on this surface")
        if _empty(x) and _empty(y):
            # Doctrine 60 in general form: two identically-absent or
            # identically-MERGED values cannot say they differ either.
            return Read(False, False, "both absent; cannot differ")
        return Read(x != y, True)


class Free(Predicate):
    name = "FREE"

    def __call__(self, x, y):
        return Read(True, False, "channel not constrained")


@dataclass(frozen=True)
class ClassEqual(Predicate):
    """Equality under a DECLARED quotient.  Family rhyme's manner partition,
    the 同用 groupings (raw Qieyun lookup makes 流 and 樓 non-rhyming and they
    are the rhyme of 登鸛雀樓), any-vowel-with-any-vowel, 平/仄.  A boolean
    x == y cannot express any of them."""
    partition: object        # callable value -> class label, or dict
    label: str = "declared quotient"
    name: str = "CLASS-EQUAL"

    def _cls(self, v):
        if callable(self.partition):
            return self.partition(v)
        return self.partition.get(v, ("__ungrouped__", v))

    def __call__(self, x, y):
        if x is None or y is None:
            return Read(None, False, "unreadable")
        cx, cy = self._cls(x), self._cls(y)
        if cx is None or cy is None:
            return Read(None, False, f"outside {self.label}")
        return Read(cx == cy, True, self.label)


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
        try:
            return Read(self.order.index(x) < self.order.index(y), True)
        except ValueError:
            return Read(None, False, "outside the declared order")


@dataclass(frozen=True)
class PresentVsAbsent(Predicate):
    """Additive / subtractive rhyme.  One member carries a segment the other
    LACKS ENTIRELY, and the unmatched segment is EXCLUDED, not required to
    differ.  `on` names which member must carry it, which is the only thing
    separating additive from subtractive once members are in text order."""
    on: int = 1
    name: str = "PRESENT-vs-ABSENT"

    def __call__(self, x, y):
        if x is None or y is None:
            return Read(None, False, "unreadable")
        vals = (x, y)
        extra, bare = vals[self.on], vals[1 - self.on]
        if _empty(bare) and not _empty(extra):
            return Read(True, True)
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
    terminator: str = "word_edge"
    cross_word: bool = False
    requires: tuple = ()

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


@dataclass(frozen=True)
class Figure:
    """The relation's shape over its members.  A labelled multigraph plus a
    member-selection rule; the pair is the degenerate case."""
    nodes: int = 2
    edges: tuple = ((0, 1, "self"),)
    quantifier: str = "exists"     # exists | exists_k | forall | fraction
    k: int = 1
    fraction: object = None
    frame: str = "song"            # line | line_pair | stanza | poem | song | token
    template: object = None        # 平仄: one member against a declared pattern


PAIR = Figure()


@dataclass(frozen=True)
class RelationSchema:
    name: str
    spans: tuple                    # (SpanRule, SpanRule)
    align: str = "anchor"
    channels: tuple = ()
    unmatched: str = "exclude"      # exclude | differ | forbid
    placement: tuple = ()
    identity: tuple = ()
    figure: object = PAIR
    normative: str = "attested"     # required | forbidden | deprecated | attested
    aka: tuple = ()
    traditions: tuple = ()
    requires: tuple = ()
    note: str = ""

    def capabilities(self):
        need = set(self.requires)
        for r in self.spans:
            need |= set(r.caps())
        for p in self.placement:
            need |= set(p.requires)
        for c in self.channels:
            if c.surface != "phonemic":
                need.add(c.surface)
        for i in self.identity:
            need.add({"token": "token", "lexeme": "lexicon",
                      "lexeme_sequence": "lexicon",
                      "lexeme_family": "morphology",
                      "morpheme_root": "morphology",
                      "morpheme_affix": "morphology",
                      "sense": "sense"}.get(i.level, i.level))
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


def _seq(span, stream, channel, chans, surface):
    """The span's derived element SEQUENCE for a sequence-scoped channel.

    This is how the Welsh skeleton, the Norse post-vocalic cluster and general
    consonance become computable: the span is still a selection of syllable
    indices, and the channel flattens it into an ordered element stream ACROSS
    the syllable boundary.  A checker keyed on the coda of a maximal-onset
    syllabification reads 'fyr' and 'of' out of jörð:fyrðum and friðrofs:ofsa
    and finds neither.
    """
    out = []
    for i in span.idx:
        v = chans.read(stream.units[i], channel, stream, surface)
        if v is None:
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
    """
    preads = []
    for p in schema.placement:
        v = p.holds(a, b, stream)
        if v is False:
            return None
        preads.append((p.kind, v))

    align = ALIGNERS[schema.align](a, b, stream)
    reads = []
    for cr in schema.channels:
        if cr.scope == "sequence":
            xa = _seq(a, stream, cr.channel, chans, cr.surface)
            xb = _seq(b, stream, cr.channel, chans, cr.surface)
            reads.append((cr.channel, -1, cr.predicate(xa, xb)))
            continue
        if cr.scope in ("unmatched_a", "unmatched_b"):
            side = a if cr.scope.endswith("a") else b
            pos = (align.unmatched_a if cr.scope.endswith("a")
                   else align.unmatched_b)
            for q in pos:
                v = chans.read(stream.units[side.idx[q]], cr.channel, stream,
                               cr.surface)
                reads.append((cr.channel, q, cr.predicate(v, v)))
            continue
        pa = _positions(cr.scope, a, align, 0)
        pb = _positions(cr.scope, b, align, 1)
        for qa, qb in zip(pa, pb):
            xa = chans.read(stream.units[a.idx[qa]], cr.channel, stream,
                            cr.surface)
            xb = chans.read(stream.units[b.idx[qb]], cr.channel, stream,
                            cr.surface)
            reads.append((cr.channel, qa, cr.predicate(xa, xb)))

    # unmatched material: EXCLUDE and MUST-DIFFER are different treatments, and
    # the distinction is a SPAN coordinate.  semirhyme excludes its overhang;
    # pararhyme's nucleus requires difference; 'forbid' rejects any overhang.
    ua, ub = bool(align.unmatched_a), bool(align.unmatched_b)
    if schema.unmatched == "forbid" and (ua or ub):
        reads.append(("__overhang__", -1, Read(False, True, "overhang forbidden")))
    elif schema.unmatched == "require_b":
        # semirhyme: member 2 overhangs member 1 and the overhang is EXCLUDED.
        # Without this the schema also admits the flush case, i.e. it admits
        # ordinary perfect rhyme, which is exactly what it is defined against.
        reads.append(("__overhang__", -1,
                      Read(ub and not ua, True, "overhang required on member 2")))
    elif schema.unmatched == "require_a":
        reads.append(("__overhang__", -1,
                      Read(ua and not ub, True, "overhang required on member 1")))

    ireads = []
    for ir in schema.identity:
        if ir.level == "token":
            xa = " ".join(dict.fromkeys(stream.units[i].token_text.lower()
                                        for i in a.idx))
            xb = " ".join(dict.fromkeys(stream.units[i].token_text.lower()
                                        for i in b.idx))
            ireads.append((ir.level, ir.predicate(xa, xb)))
        else:
            res = stream.declaration.get("resources", {})
            fn = res.get(ir.level) if isinstance(res, dict) else None
            if fn is None:
                ireads.append((ir.level, Read(None, False,
                                              f"no {ir.level} resource declared")))
            else:
                xa = tuple(fn(stream.units[i]) for i in a.idx)
                xb = tuple(fn(stream.units[i]) for i in b.idx)
                ireads.append((ir.level, ir.predicate(xa, xb)))

    vals = [r.value for _, _, r in reads if r is not None]
    vals += [r.value for _, r in ireads]
    vals += [v for _, v in preads]
    return Instance(schema.name, a, b, align, tuple(reads), tri_and(vals),
                    tuple(preads), tuple(ireads),
                    search_k=a.search_k * b.search_k)


def _bucket_key(schema, span, stream, chans):
    """A cheap key from the schema's OWN first required AGREE channel, so the
    cross product is not |candidates|^2 over a whole song.

    An UNKNOWN value returns None, which the producer treats as a WILDCARD --
    joined against every bucket.  An index built on nuclei would otherwise
    delete exactly the pairs fas refuses on, which is 60.2% of real Hafez
    rhyme pairs and precisely the candidate rhymes.
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
            v = _seq(span, stream, cr.channel, chans, cr.surface)
        else:
            pos = span.anchor_pos if cr.scope in ("anchor", "each") else \
                (len(span) - 1 if cr.scope == "last" else 0)
            if pos >= len(span):
                return None
            v = chans.read(stream.units[span.idx[pos]], cr.channel, stream,
                           cr.surface)
        if v is None:
            return None                      # WILDCARD: never prune an unknown
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


def realise(schema, stream, chans=DEFAULT_CHANNELS, max_pairs=2_000_000,
            keep=("true", "none")):
    """Find every instance of `schema` in the song.  -> [Instance] or Refusal.

    THE ALGORITHM
      1. capability check.  A missing capability is a Refusal naming it.
      2. enumerate candidate spans per member from the member's OWN SpanRule.
      3. bucket by (frame, schema's first AGREE channel).  Unknown keys are
         wildcards and join everything.
      4. for each candidate pair in text order: placement -> align -> channels
         -> ternary verdict.
      5. figures beyond the pair are assembled from the surviving edges.

    `keep` defaults to True and None instances.  Pass keep="all" for the
    negative cases: doctrine 27 -- a chance draw that FAILS the filter scores
    minus infinity and belongs in the DENOMINATOR, not out of the sample. The
    first family-wise correction in this repo dropped exactly those and got 0%
    saturation on every corpus.
    """
    for cap in schema.capabilities():
        if not stream.provides(cap):
            return Refusal(schema.name, cap,
                           f"{schema.name} needs {cap!r}; this declaration "
                           f"({stream.declaration.get('language', '?')}) does "
                           f"not supply it. Refused rather than asserted.")
    try:
        A = list(enumerate_spans(schema.spans[0], stream))
        B = (A if schema.spans[0] == schema.spans[1]
             else list(enumerate_spans(schema.spans[1], stream)))
    except NoReferent as e:
        return Refusal(schema.name, "span", str(e))

    idx = {}
    for s in B:
        idx.setdefault((_frame_key(schema, s, stream),
                        _bucket_key(schema, s, stream, chans)), []).append(s)
    wild = {}
    for (f, k), v in idx.items():
        if k is None:
            wild.setdefault(f, []).extend(v)

    out, seen, n = [], set(), 0
    for a in A:
        fk = _frame_key(schema, a, stream)
        ka = _bucket_key(schema, a, stream, chans)
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
            if a.head() > b.head():
                continue                       # members are in TEXT ORDER
            seen.add((a.idx, b.idx))
            n += 1
            if n > max_pairs:
                raise RuntimeError("candidate explosion; tighten the schema")
            inst = evaluate(schema, a, b, stream, chans)
            if inst is None:
                continue
            tag = {True: "true", False: "false", None: "none"}[inst.verdict]
            if keep == "all" or tag in keep:
                out.append(inst)
    return out


def assemble(schema, edges, stream):
    """Figures beyond the pair.  Edges are grouped into the declared shape and
    the member-selection quantifier is applied over the declared frame.

    exists_k   Kalevala: >= 2 words in the line sharing an initial
    fraction   paroemion / repetend: a count AND a declared fraction
    forall     higaad: every line against ONE representative for a whole poem
    """
    fig = schema.figure
    by = {}
    for e in edges:
        if e.verdict is False:
            continue
        by.setdefault(_frame_key(schema, e.a, stream), []).append(e)
    out = []
    for frame, es in sorted(by.items(), key=lambda kv: (kv[0] is None, kv[0])):
        if fig.quantifier == "exists":
            out.extend((frame, [e]) for e in es)
        elif fig.quantifier == "exists_k":
            nodes = {e.a.idx for e in es} | {e.b.idx for e in es}
            if len(nodes) >= fig.k:
                out.append((frame, es))
        elif fig.quantifier == "fraction":
            li = frame if isinstance(frame, int) else None
            tot = (len({stream.units[i].token for i in stream.lines[li]})
                   if li is not None and li < len(stream.lines) else 0)
            nodes = {e.a.idx for e in es} | {e.b.idx for e in es}
            if tot and len(nodes) / tot >= (fig.fraction or 1.0):
                out.append((frame, es))
        elif fig.quantifier == "forall":
            out.append((frame, es))
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
    subset, which for Persian is exactly `fas.ghazal_rhyme_lines()`.  The same
    applies to an English hymn whose refrain is every fourth line.
    """
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
        stream.frames.refrain_source = "computed"
        return None
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
            "min_count": min_count, "min_fraction": min_fraction}


def search_caesura(stream):
    """Doctrine 55/56.  Either PRINTED, DECLARED, or SEARCHED -- and the caller
    has to say which.

    EVERY word boundary is kept as a candidate rather than one being chosen by
    a scorer.  k averaged 10.6 hypotheses per line on a real Welsh corpus, and
    the same search run over lines whose words are shuffled WITHIN THE LINE
    still reports cynghanedd on about a quarter of them -- so a bare rate
    obtained by search is quoting the null back at itself, and only the EXCESS
    over a matched control is attributable to the poet.  `Span.search_k` and
    `Instance.search_k` carry k so that control can be built.
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
    return {"lines": len(ks), "mean_k": sum(ks) / len(ks) if ks else 0.0,
            "note": "report the EXCESS over a null run under this same search"}


def mark_printed_caesura(stream, marks="/|"):
    """A PRINTED caesura only. Punctuation is not metre: `cynghanedd()` split
    on `[,/|]`, so an editorial COMMA chose which rule each line was tested
    against on 1,558 lines."""
    for li, raw in enumerate(stream.text_lines):
        pos = min((raw.find(m) for m in marks if m in raw), default=-1)
        if pos < 0:
            continue
        before = len(tokenise(raw[:pos]))
        for i in stream.lines[li]:
            if stream.units[i].token >= before:
                stream.frames.caesura[li] = i
                break
    stream.frames.caesura_source = "printed"
    return stream.frames


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
              ChannelRule("coda", ClassEqual(partition=lambda v: v,
                                             label="declared manner partition"),
                          "each")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    note="Forces the CLASS-EQUAL predicate. A boolean _cmp(x,y) returning x==y "
         "cannot express it. quality/fit_matrix.py is a fitted substitution "
         "matrix already built and shelved; the partition slot is where it "
         "would plug in."))

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
              ChannelRule("coda", ClassEqual(partition=lambda v: v,
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
    spans=(SpanRule("line_final_token", "word_start", 1, "to_frame_edge",
                    terminator="frame_edge"), END_ANCHOR),
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
              ChannelRule("nucleus", ClassEqual(partition=lambda v: v,
                                                label="declared length class"),
                          "anchor")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    note="a SINGLE CHANNEL carrying TWO predicates at once -- the vowels must "
         "differ in identity AND agree in length class. No one-predicate-per-"
         "channel model can hold it; the channel list is a multiset."))

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
    channels=(ChannelRule("nucleus", ClassEqual(partition=lambda v: v,
                                                label="declared 同用 grouping"),
                          "last"),
              ChannelRule("prominence", AGREE, "last")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    note="doctrine 36: the granularity a REFERENCE WORK records is not the "
         "granularity a FORM works at. prominence here carries 平/仄, because "
         "that is what ltc declares -- there is no stress channel at all."))

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
    requires=("beat",),
    note="UNREPRESENTABLE HERE AND DECLARED SO. frames.beat stays None "
         "(doctrine 4: no beat grid without audio or a declared tempo), so "
         "realise() returns Refusal('beat'). The type is a POINT in the model "
         "and the producer refuses it -- which is the honest pair of answers."))

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
              ChannelRule("coda", AGREE, "each")),
    placement=(Placement("both_line_final"),), identity=(DISTINCT,),
    requires=("frequency",), normative="deprecated",
    note="NOT A PHONOLOGICAL TYPE, and included to mark the BOUNDARY of the "
         "space: it is a coordinate on a VALUE axis orthogonal to all the "
         "structural ones. Kept out of the cell grid deliberately (doctrine "
         "9/48, modal_exclusion in quality/revise.py)."))


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
    which capability each refusal is waiting on.  The honest inventory."""
    ok, refused = [], {}
    for n, s in REGISTRY.items():
        miss = [c for c in s.capabilities() if not stream.provides(c)]
        (ok.append(n) if not miss else refused.setdefault(tuple(miss), []).append(n))
    return {"reachable": sorted(ok),
            "refused": {"+".join(k): sorted(v) for k, v in refused.items()}}


__all__ = ["Unit", "Stream", "Frames", "build_stream", "tokenise",
           "Span", "SpanRule", "enumerate_spans", "Alignment", "ALIGNERS",
           "Placement", "ChannelRule", "IdentityRule", "Figure",
           "RelationSchema", "Instance", "Refusal", "NoReferent",
           "Predicate", "Agree", "Differ", "Free", "ClassEqual",
           "DirectedDiffer", "PresentVsAbsent", "SequenceEqual",
           "SequenceSuffix", "SubsequenceOf", "Read", "ChannelSet",
           "DEFAULT_CHANNELS", "evaluate", "realise", "assemble",
           "mark_refrain_tail", "search_caesura", "mark_printed_caesura",
           "REGISTRY", "QUERIES", "declare", "all_schemas",
           "capability_report", "tri_and", "tri_or"]

#!/usr/bin/env python3
"""Rhyme types as DECLARATIVE CONSTRAINTS over an annotated site stream.

WHY THE PRODUCER IN rhyme_types.py CANNOT BE PATCHED

`classify_pair(a, b, phon)` computes `sa[-n:]` against `sb[-n:]`. Suffix
alignment is not a parameter of that function; it is the function. Passing
`position='head'` changes a field on the returned dataclass and never touches
the span computation, so `kukka`/`kalevala` compares [kuk,ka] against [va,la],
reports "perfect rhyme" on syllable 2, verdict False -- while `fin.alliterates`
returns True. A longer suffix does not help. The missing thing is an ANCHOR
that is DECLARED PER MEMBER, and a POSITION that is SEARCHED rather than
asserted.

THE SHAPE OF THE FIX

  1. The analysis object is not two words. It is one indexed SITE STREAM over
     the whole song, with frames (song/section/stanza/line/half-line/token)
     as INTERVALS ANNOTATING it, never as chunks of it. Word boundaries become
     a channel, not a segmentation -- which is what mosaic, compound,
     multisyllabic-starting-mid-word, broken and enjambed rhyme all need.

  2. A type is DATA: a FIGURE (member slots + edges), each member carrying its
     OWN anchor, span direction, span magnitude and placement; each edge
     carrying a per-channel PREDICATE. No type is code.

  3. The producer is a constraint-satisfaction search. Each member's anchor and
     placement generate a DOMAIN of concrete extents -- positions are computed
     from the stream. Edges prune. What survives is a witness. Nothing is
     asserted by a caller.

  4. Channel values are KNOWLEDGE SETS, not values. A singleton is certain, a
     multi-element set is partial, and the ternary verdict is set algebra --
     which is `fas.py`'s design promoted from one module to the whole layer.
     None propagates because it is derived, not because it is special-cased.

  5. Three distinct negatives, kept apart: False (read and disagreed), None
     (read and undecidable), and REFUSED (the rule has no referent in this
     declaration -- som/msa/fas carry no prominence, so `last_prominent` is
     not an anchor that can be asked for). The current code raises out of
     `_anchor` and loses the whole call; here the refusal is a returned object
     naming the missing coordinate.

NOTHING HERE TRANSCRIBES. `phon` is any object with `.syllabify()`.
"""

from __future__ import annotations

import itertools
import re
from dataclasses import dataclass, field, replace

# ---------------------------------------------------------------------------
# 1. KNOWLEDGE AND THREE-VALUED LOGIC
#
# A channel does not yield a value. It yields the SET of values the declared
# surface permits. Certainty is |set| == 1. `fas.VOWEL_SETS` is this idea; it
# was trapped in one module.
# ---------------------------------------------------------------------------

ABSENT = "∅"                    # a real, readable absence (empty coda)
ABS = frozenset({ABSENT})
UNREADABLE = None                    # the channel could not be read at all


def kn(value):
    """Certain knowledge of one value."""
    return frozenset({value})


def kn_seq(seq):
    """Certain knowledge of an ordered tuple (a cluster, a skeleton)."""
    t = tuple(seq)
    return ABS if not t else frozenset({t})


def agree(a, b):
    """-> (verdict, informative). Set algebra, per doctrine 25.

    Doctrine 25 is the reason this returns a PAIR: two absent codas AGREE
    (see/free is a perfect rhyme) and carry NO EVIDENCE. Conflating the two
    questions deletes a quarter of the sonnets' mandated pairs or manufactures
    evidence out of nothing, depending on which way you collapse it.
    """
    if a is UNREADABLE or b is UNREADABLE:
        return None, False
    if not (a & b):
        return False, True                       # disjoint: cannot be equal
    if len(a) == 1 and a == b:
        return True, (a != ABS)                  # certain, and absent is mute
    return None, True                            # overlap: undecidable


def differ(a, b):
    v, inf = agree(a, b)
    return (None if v is None else (not v)), inf


def and3(vals):
    """Kleene conjunction. False dominates None dominates True."""
    out = True
    for v in vals:
        if v is False:
            return False
        if v is None:
            out = None
    return out


def or3(vals):
    out = False
    for v in vals:
        if v is True:
            return True
        if v is None:
            out = None
    return out


# ---------------------------------------------------------------------------
# 2. PREDICATES -- the value space of one channel of one edge
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Pred:
    """kind:
        AGREE            both members carry the same value
        DIFFER           constitutive difference (perfect rhyme's onset,
                         pararhyme's nucleus, symploce's interior)
        FREE             not constrained (and not evidence)
        EXCLUDED         present but explicitly outside the comparison
                         (semirhyme's overhang) -- distinct from DIFFER, and
                         the distinction is a SPAN fact the old model lacked
        CLASS_EQUAL      equal after a declared quotient: family rhyme's
                         manner classes, any-vowel-with-any-vowel, 同用,
                         Scots length class, 平/仄
        DIRECTED_DIFFER  differ AND in a declared order (ablaut reduplication:
                         ding-dong, never dong-ding). The sole forcing case
                         for a predicate that names WHICH member carries which
                         value.
        PRESENT_ON       one member has material the other lacks entirely, on
                         a named member (additive vs subtractive: ONE structure
                         with the per-member spec exchanged)
    """
    kind: str
    quotient: object = None          # callable value -> class representative
    order: tuple = ()                # for DIRECTED_DIFFER
    member: int = 0                  # for PRESENT_ON
    surface: str = "phonemic"        # which declared surface it is read from


AGREE = Pred("AGREE")
DIFFER = Pred("DIFFER")
FREE = Pred("FREE")
EXCLUDED = Pred("EXCLUDED")


def CLASS_EQUAL(quotient, surface="phonemic"):
    return Pred("CLASS_EQUAL", quotient=quotient, surface=surface)


def DIRECTED_DIFFER(order):
    return Pred("DIRECTED_DIFFER", order=tuple(order))


def PRESENT_ON(member):
    return Pred("PRESENT_ON", member=member)


def _map_class(k, q):
    if k is UNREADABLE:
        return UNREADABLE
    return frozenset(q(v) for v in k)


def apply_pred(p, a, b):
    """-> (verdict, informative). a, b are Knowledge (or UNREADABLE)."""
    if p.kind == "FREE" or p.kind == "EXCLUDED":
        return True, False
    if p.kind == "AGREE":
        return agree(a, b)
    if p.kind == "DIFFER":
        return differ(a, b)
    if p.kind == "CLASS_EQUAL":
        return agree(_map_class(a, p.quotient), _map_class(b, p.quotient))
    if p.kind == "DIRECTED_DIFFER":
        v, inf = differ(a, b)
        if v is not True:
            return v, inf
        if a is UNREADABLE or b is UNREADABLE or len(a) != 1 or len(b) != 1:
            return None, inf
        try:
            ia = p.order.index(next(iter(a)))
            ib = p.order.index(next(iter(b)))
        except ValueError:
            return None, inf                     # outside the declared order
        return (ia < ib), True
    if p.kind == "PRESENT_ON":
        if a is UNREADABLE or b is UNREADABLE:
            return None, False
        ea, eb = (a == ABS), (b == ABS)
        if ea == eb:
            return False, True
        return ((eb and p.member == 0) or (ea and p.member == 1)), True
    raise ValueError(f"unknown predicate kind {p.kind!r}")


# ---------------------------------------------------------------------------
# 3. THE SUBSTRATE -- one indexed stream for the whole song
#
# Frames ANNOTATE the stream and never cut it. `schemes.py` established this
# for the rhyme scheme ("section membership is a label on lines, never a
# boundary on the analysis"); it is the same argument one level down. Chopping
# the stream at word edges is what makes a mid-word multisyllabic rhyme
# unrepresentable, exactly as chopping at stanza edges made a long-range rhyme
# unrepresentable.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Site:
    """One syllable, located everywhere at once."""
    i: int                      # global index in the stream
    syl: object                 # the phonology's Syllable, untouched
    token: int                  # global token index
    token_pos: int              # syllable index inside its token
    token_len: int
    line: int                   # global line index
    line_pos: int               # syllable index inside its line
    surface: str = ""           # orthographic form of the token
    readable: bool = True


@dataclass(frozen=True)
class Frame:
    kind: str                   # 'song'|'section'|'stanza'|'line'|'half_line'
                                # |'token'|'couplet'|'pada'|'bar'
    id: int
    start: int                  # inclusive site index
    stop: int                   # exclusive
    source: str = "printed"     # 'printed'|'declared'|'searched'
    parent: int = -1

    def sites(self):
        return range(self.start, self.stop)


@dataclass
class Declaration:
    """Doctrine 1, extended: the CHANNEL INVENTORY is itself a coordinate.

    Welsh does not declare onset and coda as separate channels at all -- it
    declares one ordered consonant channel over a span that is not a word. A
    model with a fixed (onset, nucleus, coda) triple cannot state that, and a
    type that asks for an undeclared channel must be REFUSED, not defaulted.
    """
    language: str
    phonology: object
    channels: tuple = ()             # channel names this declaration supplies
    surfaces: tuple = ("phonemic",)  # orthographic / delivered / sung / dated
    caesura: str = "none"            # 'printed' | 'declared' | 'searched'
    anchors: tuple = ()              # anchor rules this declaration supports
    tie_break: str = "lowest_index"  # doctrine 66: fixed and stated
    notes: str = ""


@dataclass
class Utterance:
    sites: list
    frames: dict                     # kind -> list[Frame]
    decl: Declaration
    unreadable: list = field(default_factory=list)
    k_hypotheses: float = 1.0        # doctrine 56: searched placements per line

    def frame_of(self, kind, site_index):
        for f in self.frames.get(kind, ()):
            if f.start <= site_index < f.stop:
                return f
        return None

    def instances(self, kind, scope=None):
        fs = self.frames.get(kind, ())
        if scope is None:
            return list(fs)
        return [f for f in fs if f.start >= scope.start and f.stop <= scope.stop]


DEFAULT_TOKEN_RE = re.compile(r"[^\W\d_]+(?:['’\-][^\W\d_]+)*", re.UNICODE)


def build(lines, phon, decl=None, tokenize=None, caesura_marks="/|"):
    """Text + a phonology -> the stream. This is the ONLY place text is read.

    `tokenize` is a declaration coordinate because doctrine 65 says the same
    glyph does opposite jobs in four languages: Finnish SPLITS on the
    apostrophe, Welsh JOINS, Old Norse FUSES, Malay reads it as a phoneme.
    A phonology that ships its own tokenizer gets used; nothing is ported.
    """
    tok = tokenize or getattr(phon, "tokenize", None) or (
        lambda s: DEFAULT_TOKEN_RE.findall(s))
    decl = decl or declaration_for(phon)
    sites, frames = [], {k: [] for k in
                         ("song", "line", "token", "half_line", "couplet")}
    unreadable = []
    ti = 0
    for li, raw in enumerate(lines):
        lstart = len(sites)
        # caesura: PRINTED only if the declaration says so (doctrine 55 -- a
        # comma is not a caesura, and letting punctuation choose the rule is
        # how 1,558 lines got their test selected by a typesetter).
        parts = [raw]
        if decl.caesura == "printed":
            parts = re.split(f"[{re.escape(caesura_marks)}]", raw)
        part_bounds = []
        for part in parts:
            pstart = len(sites)
            for w in tok(part):
                syls = phon.syllabify(w)
                if not syls:
                    unreadable.append((li, w))
                    ti += 1
                    continue
                tstart = len(sites)
                for k, s in enumerate(syls):
                    sites.append(Site(i=len(sites), syl=s, token=ti,
                                      token_pos=k, token_len=len(syls),
                                      line=li, line_pos=len(sites) - lstart,
                                      surface=w))
                frames["token"].append(
                    Frame("token", ti, tstart, len(sites), parent=li))
                ti += 1
            part_bounds.append((pstart, len(sites)))
        frames["line"].append(Frame("line", li, lstart, len(sites)))
        if len(part_bounds) > 1:
            for h, (a, b) in enumerate(part_bounds):
                if b > a:
                    frames["half_line"].append(
                        Frame("half_line", len(frames["half_line"]), a, b,
                              source="printed", parent=li))
    frames["song"].append(Frame("song", 0, 0, len(sites)))
    for a, b in zip(frames["line"][::2], frames["line"][1::2]):
        frames["couplet"].append(
            Frame("couplet", len(frames["couplet"]), a.start, b.stop))
    utt = Utterance(sites=sites, frames=frames, decl=decl, unreadable=unreadable)
    if decl.caesura == "searched":
        _search_caesurae(utt)
    return utt


def _search_caesurae(utt):
    """Every token boundary inside a line is a caesura HYPOTHESIS.

    Doctrine 56: this is k hypotheses per line and the null has to be run under
    the same search, so the count is recorded on the utterance rather than
    quietly absorbed.
    """
    ks = []
    for ln in utt.frames["line"]:
        toks = [f for f in utt.frames["token"]
                if f.start >= ln.start and f.stop <= ln.stop]
        cuts = [t.start for t in toks[1:]]
        ks.append(max(1, len(cuts)))
        for c in cuts:
            utt.frames["half_line"].append(
                Frame("half_line", len(utt.frames["half_line"]),
                      ln.start, c, source="searched", parent=ln.id))
            utt.frames["half_line"].append(
                Frame("half_line", len(utt.frames["half_line"]),
                      c, ln.stop, source="searched", parent=ln.id))
    utt.k_hypotheses = sum(ks) / len(ks) if ks else 1.0


# ---------------------------------------------------------------------------
# 4. CHANNELS -- read from the stream, per declaration
# ---------------------------------------------------------------------------

def _syl_knowledge(phon, name, syl):
    """Ask the phonology first. Persian's nucleus is a SET of phonemes the
    orthography permits; English's is a value. Neither is privileged: a module
    that defines `channel_knowledge` supplies its own, and the default reads
    the Syllable fields every module already populates.

    THE NUCLEUS DISTINGUISHES None FROM EMPTY, and it is the whole reason this
    module exists.  It used to read `ABS if not syl.nucleus else kn(...)`, and
    `not None` is True -- so `fas.syllabify('گل')`, whose nucleus is None
    because unvocalised Perso-Arabic does not WRITE short vowels, came back as
    `frozenset({'∅'})`: a CERTAIN, READ absence.  Two of those then satisfy
    `agree()` at (True, False) instead of (None, False), which is doctrine 25
    inverted -- an unreadable channel manufacturing agreement.  `prominence`
    two lines down always got this right; the nucleus did not.
    """
    hook = getattr(phon, "channel_knowledge", None)
    if hook is not None:
        got = hook(name, syl)
        if got is not NotImplemented:
            return got
    if name == "onset":
        return kn_seq(syl.onset)
    if name == "nucleus":
        if syl.nucleus is None:
            return UNREADABLE            # cannot be read; NOT an empty nucleus
        return ABS if not syl.nucleus else kn(syl.nucleus)
    if name == "coda":
        return kn_seq(syl.coda)
    if name == "prominence":
        return UNREADABLE if syl.prominence is None else kn(syl.prominence)
    if name == "weight":
        return kn(getattr(syl, "moras", 1))
    return UNREADABLE


SYLLABLE_CHANNELS = ("onset", "nucleus", "coda", "prominence", "weight")
PHONE_CHANNELS = ("phone", "cluster", "consonant_seq")


def read_channel(utt, name, extent):
    """-> tuple of Knowledge, one per position of the extent, or UNREADABLE.

    UNREADABLE for the WHOLE extent means the channel is not in the
    declaration -- which becomes a REFUSAL upstream, never a False.
    """
    if name in SYLLABLE_CHANNELS:
        if extent.unit != "syllable":
            return _phone_projection(utt, name, extent)
        return tuple(_syl_knowledge(utt.decl.phonology, name, utt.sites[i].syl)
                     for i in extent.sites)
    if name == "token":
        return tuple(kn(utt.sites[i].surface.lower()) for i in extent.sites)
    if name == "token_span":
        return (kn(tuple(dict.fromkeys(utt.sites[i].surface.lower()
                                       for i in extent.sites))),)
    if name == "juncture":
        # word boundaries INSIDE the extent -- mosaic's constitutive channel
        b = tuple(k for k in range(1, len(extent.sites))
                  if utt.sites[extent.sites[k]].token
                  != utt.sites[extent.sites[k - 1]].token)
        return (kn(b) if b else ABS,)
    if name == "consonant_seq":
        seq = []
        for i in extent.sites:
            s = utt.sites[i].syl
            seq.extend(s.onset)
            seq.extend(s.coda)
        return tuple(kn(c) for c in seq)
    if name == "phone":
        # The raw segment stream of the extent, read in the MEMBER'S OWN
        # DIRECTION -- which is the whole of amphisbaenic rhyme. onset /
        # nucleus / coda are a SYLLABLE-unit projection and cannot state a
        # relation in which one word's onset answers the other's coda; the
        # phone unit can, and it needs no cross-channel machinery.
        seq = []
        for i in extent.sites:
            s_ = utt.sites[i].syl
            seq.extend(s_.onset)
            seq.append(s_.nucleus)
            seq.extend(s_.coda)
        if extent.direction < 0:
            seq = seq[::-1]
        return tuple(kn(c) for c in seq)
    if name == "cluster":
        # EVERY consonant after the anchor vowel, ACROSS the syllable
        # boundary. Snorri's span: `fyrð` from fyrðum, `ofs` from ofsa. A
        # checker keyed on the coda of a maximal-onset syllabification reads
        # `fyr` and `of` and finds neither -- and the same reading is what
        # makes English bend/ending a semirhyme (the /d/ resyllabifies).
        # Doctrine 61: this is a SPAN VARIANT and variants are chosen by lift
        # against a matched control, never by which one fires more.
        i0 = extent.sites[0]
        seq = list(utt.sites[i0].syl.coda)
        for i in extent.sites[1:]:
            seq.extend(utt.sites[i].syl.onset)
            break
        return (kn_seq(seq),)
    if name in utt.decl.channels:
        reader = getattr(utt.decl.phonology, f"read_{name}", None)
        if reader is not None:
            return reader(utt, extent)
    return UNREADABLE


def _phone_projection(utt, name, extent):
    if name == "coda":
        seq = []
        for i in extent.sites:
            seq.extend(utt.sites[i].syl.coda)
        return tuple(kn(c) for c in seq) or (ABS,)
    if name == "onset":
        seq = []
        for i in extent.sites:
            seq.extend(utt.sites[i].syl.onset)
        return tuple(kn(c) for c in seq) or (ABS,)
    return tuple(_syl_knowledge(utt.decl.phonology, name, utt.sites[i].syl)
                 for i in extent.sites)


def declaration_for(phon, **kw):
    """What this phonology can actually be asked. Probed, not assumed."""
    chans = ["onset", "nucleus", "coda", "weight", "token", "juncture",
             "consonant_seq", "phone", "cluster"]
    anchors = ["locus_start", "locus_end", "frame_start", "frame_end",
               "frame_index", "searched"]
    if _has_prominence(phon):
        chans.append("prominence")
        anchors += ["last_prominent", "first_prominent", "penult_prominent"]
    chans += list(getattr(phon, "extra_channels", ()))
    return Declaration(language=getattr(phon, "language", "unset"),
                       phonology=phon, channels=tuple(chans),
                       anchors=tuple(anchors), **kw)


def _has_prominence(phon):
    """som/msa/fas decline a stress grid. Ask; do not guess and do not
    fall back to English."""
    if getattr(phon, "prominence_rule", "none").lower().startswith("none"):
        return False
    try:
        for probe in ("a", "i", "ka", "من"):
            for s in phon.syllabify(probe) or ():
                if s.prominence is not None:
                    return True
    except Exception:
        return False
    return False


# ---------------------------------------------------------------------------
# 5. THE TYPE, AS DATA
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Anchor:
    """WHERE a member's span starts. Declared PER MEMBER.

    cynghanedd draws is the decisive case: span A is head-anchored and
    exhaustive, span B is tail-anchored with a searched start. A checker that
    suffix-aligns both gets traws right and croes wrong; one that head-aligns
    both gets croes right and traws wrong. No global alignment value covers
    the pair, so alignment is not a field -- it is a consequence of two
    independent anchors.
    """
    rule: str                    # see declaration_for().anchors
    index: int = 0               # for frame_index (Tamil mōnai 1 / etukai 2)
    requires: tuple = ()         # declaration features, e.g. ('prominence',)


@dataclass(frozen=True)
class Span:
    unit: str = "syllable"       # syllable|phone|consonant|token|line|grapheme
    direction: int = 1           # +1 rightward, -1 leftward. PER MEMBER:
                                 # amphisbaenic rhyme is direction=-1 on one
                                 # member and nothing else.
    magnitude: object = 1        # int | 'to_locus_end' | 'to_frame_end'
                                 # | 'exhaustive' | 'cluster'
    locus: str = "token"         # the unit the anchor sits in
    terminator: str = "count"    # 'count'|'locus_edge'|'frame_edge'


@dataclass(frozen=True)
class Placement:
    frame: str = "line"          # the frame position is measured in
    select: str = "any"          # any|final|initial|penult|index|lift
    index: int = 0
    polarity: str = "required"   # 'forbidden' = the OE fourth lift


@dataclass(frozen=True)
class Member:
    """A member is not only a position. Some constraints are UNARY -- they
    hold of ONE member and are not a relation at all:

      syllabic rhyme   prominence == 0 on BOTH anchors, separately
      light rhyme      one anchor stressed, one not (the DIFFER is binary, but
                       the eligibility of an unstressed anchor is unary)
      alliterative     only STRESSED CONTENT WORDS are eligible as lifts, and
      long line        the function-word list is part of the phonology
                       (doctrine 46/62, attested in Snorri's málfylling)

    Modelling these as edges was wrong: with only binary edges, `syllabic
    rhyme` fired on bog/dog, because nothing said the anchor had to be weak.
    Filters are applied during DOMAIN GENERATION, so they prune before any
    pair is formed -- which is also where they are cheapest.
    """
    anchor: Anchor
    span: Span = Span()
    placement: Placement = Placement()
    filters: tuple = ()            # ((channel, position, required Knowledge))


@dataclass(frozen=True)
class Edge:
    a: int
    b: int
    channels: tuple = ()          # ((channel_name, Pred), ...)
    overhang: str = "exclude"     # SPAN level, counted in the span's own unit:
                                  # 'exclude'  unmatched material is outside
                                  #            the comparison (semirhyme)
                                  # 'differ'   unmatched material must differ
                                  # 'require_0'/'require_1' the overhang is
                                  #            CONSTITUTIVE and sits on that
                                  #            member (semirhyme / apocopated)
    exhaustive: str = "none"      # CHANNEL-POSITION level: 'none'|'both'|'a'|'b'
                                  # 'both' is croes's no-gap-on-either-side and
                                  # amphisbaenic's phone-for-phone; 'a' alone is
                                  # traws, where B carries an unanswered pont.
                                  # Two SEPARATE questions: whether the SPANS
                                  # differ in length, and whether any CHANNEL
                                  # material is left unmatched. Collapsing them
                                  # made semirhyme and amphisbaenic exclusive.
    align: str = "index"          # 'index' | 'subsequence' | 'set'


@dataclass(frozen=True)
class Selection:
    quantifier: str = "pair"      # pair|exists_k|forall|count_fraction
    k: int = 2
    frame: str = "line"
    min_count: int = 2
    min_fraction: float = 0.0


@dataclass(frozen=True)
class RhymeType:
    """One canonical type. Data, not code."""
    name: str
    members: tuple
    edges: tuple
    selection: Selection = Selection()
    aka: tuple = ()
    traditions: tuple = ()
    normative: str = "attested"   # attested|mandatory|forbidden|deprecated|fault
    flags: tuple = ()             # 'UNVERIFIED', 'TERM_COLLISION', ...
    note: str = ""


# ---------------------------------------------------------------------------
# 6. RESULTS -- and the three distinct negatives
# ---------------------------------------------------------------------------

@dataclass
class Refusal:
    """The rule has no referent here. NOT False and NOT None."""
    type_name: str
    reason: str
    missing: tuple = ()

    def __bool__(self):
        return False


@dataclass
class Finding:
    type_name: str
    verdict: object                  # True | None  (False assignments dropped)
    extents: tuple
    channels: tuple                  # ((slot_a, slot_b, chan, v, informative))
    unknown: tuple                    # channels that forced a None
    uninformative: tuple
    frame: object = None
    k_hypotheses: float = 1.0
    witness: str = ""


# ---------------------------------------------------------------------------
# 7. THE PRODUCER -- constraint satisfaction, positions FOUND
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Extent:
    sites: tuple                     # global indices IN READING ORDER
    unit: str
    slot: int
    locus: object = None
    direction: int = 1               # the member's own declared direction


def _loci(utt, m, scope):
    """Frame instances that could carry this member, AFTER placement.

    This is the whole of "positions are found, not asserted": `select='final'`
    computes which token is frame-final. `position='end'` is never a parameter.
    """
    frames = utt.instances(m.placement.frame, scope)
    out = []
    for fr in frames:
        if m.span.locus == m.placement.frame:
            out.append((fr, fr))
            continue
        cands = [f for f in utt.frames.get(m.span.locus, ())
                 if f.start >= fr.start and f.stop <= fr.stop]
        if not cands:
            continue
        sel = m.placement.select
        if sel == "any":
            pick = cands
        elif sel == "final":
            pick = [cands[-1]]
        elif sel == "initial":
            pick = [cands[0]]
        elif sel == "penult":
            pick = [cands[-2]] if len(cands) > 1 else []
        elif sel == "index":
            pick = [cands[m.placement.index - 1]] \
                if 0 < m.placement.index <= len(cands) else []
        else:
            pick = cands
        for p in pick:
            out.append((fr, p))
    return out


def _anchor_site(utt, m, frame, locus):
    """-> a site index, or a Refusal string naming the missing coordinate."""
    r = m.anchor.rule
    sites = list(locus.sites())
    if not sites:
        return None
    if r == "locus_start":
        return sites[0]
    if r == "locus_end":
        return sites[-1]
    if r == "frame_start":
        return frame.start
    if r == "frame_end":
        return frame.stop - 1
    if r == "frame_index":
        idx = frame.start + m.anchor.index - 1
        return idx if frame.start <= idx < frame.stop else None
    if r in ("last_prominent", "first_prominent", "penult_prominent"):
        if "prominence" not in utt.decl.channels:
            return f"REFUSE:{r} needs a prominence channel; " \
                   f"{utt.decl.language} declares none"
        ps = [i for i in sites if utt.sites[i].syl.prominence == 1]
        if not ps:
            return sites[0]
        if r == "last_prominent":
            return ps[-1]
        if r == "first_prominent":
            return ps[0]
        return ps[-2] if len(ps) > 1 else ps[0]
    if r == "searched":
        return sites            # every site is a hypothesis
    return f"REFUSE:unknown anchor rule {r!r}"


def _extent_from(utt, m, frame, locus, anchor, slot):
    d = m.span.direction
    mag = m.span.magnitude
    if mag == "exhaustive":
        idx = list(locus.sites())
    elif mag == "to_locus_end":
        idx = list(range(anchor, locus.stop)) if d > 0 \
            else list(range(locus.start, anchor + 1))
    elif mag == "to_frame_end":
        idx = list(range(anchor, frame.stop)) if d > 0 \
            else list(range(frame.start, anchor + 1))
    elif mag == "cluster":
        idx = [anchor]
    else:
        n = int(mag)
        idx = list(range(anchor, anchor + n)) if d > 0 \
            else list(range(anchor - n + 1, anchor + 1))
        lo, hi = (locus.start, locus.stop) if m.span.terminator == "locus_edge" \
            else (frame.start, frame.stop)
        idx = [i for i in idx if lo <= i < hi]
        if len(idx) != n:
            return None
    if not idx:
        return None
    if d < 0:
        idx = idx[::-1]                 # READ in the member's own direction
    return Extent(tuple(idx), m.span.unit, slot, locus, d)


def _passes_filters(utt, m, ext):
    """Unary constraints. A filter on an UNDECLARED channel prunes nothing and
    is reported by `admit`, never silently satisfied."""
    for chan, pos, req in m.filters:
        ks = read_channel(utt, chan, ext)
        if ks is UNREADABLE or not ks:
            return False
        k = ks[pos] if -len(ks) <= pos < len(ks) else None
        if k is None:
            return False
        v, _ = agree(k, req)
        if v is False:
            return False
    return True


def domain(utt, m, slot, scope=None, cap=4000):
    """Every extent this member could occupy. -> list[Extent] or Refusal str."""
    out = []
    for frame, locus in _loci(utt, m, scope):
        a = _anchor_site(utt, m, frame, locus)
        if isinstance(a, str):
            return a
        if a is None:
            continue
        for anchor in (a if isinstance(a, list) else [a]):
            e = _extent_from(utt, m, frame, locus, anchor, slot)
            if e is not None and _passes_filters(utt, m, e):
                out.append((frame, e))
            if len(out) > cap:
                return out
    return out


def _eval_edge(utt, e, ea, eb):
    """-> (verdict, rows, unknown, uninformative). Alignment is elementwise in
    each member's OWN reading direction, so a reversed member (amphisbaenic)
    needs no special case."""
    rows, unk, mute = [], [], []
    vals = []
    # The overhang policy. EXCLUDED and MUST-DIFFER are different treatments of
    # unmatched material -- semirhyme EXCLUDES where pararhyme's nucleus
    # REQUIRES difference -- and 'require_*' is what stops semirhyme collapsing
    # into perfect rhyme whenever the two spans happen to be equal length.
    #
    la, lb = len(ea.sites), len(eb.sites)
    if e.overhang == "require_1" and lb <= la:
        return False, rows, (), ()
    if e.overhang == "require_0" and la <= lb:
        return False, rows, (), ()
    for chan, pred in e.channels:
        ka = read_channel(utt, chan, ea)
        kb = read_channel(utt, chan, eb)
        if ka is UNREADABLE or kb is UNREADABLE:
            return "REFUSE", rows, (chan,), mute
        if pred.kind == "PRESENT_ON":
            va = ka[-1] if ka else ABS
            vb = kb[-1] if kb else ABS
            v, inf = apply_pred(pred, va, vb)
            rows.append((ea.slot, eb.slot, chan, v, inf))
            vals.append(v)
            continue
        if len(ka) != len(kb):
            if e.exhaustive == "both":
                return False, rows, (), ()
            if e.exhaustive == "a" and len(ka) > len(kb):
                return False, rows, (), ()
            if e.exhaustive == "b" and len(kb) > len(ka):
                return False, rows, (), ()
        m = min(len(ka), len(kb))
        for j in range(m):
            v, inf = apply_pred(pred, ka[j], kb[j])
            rows.append((ea.slot, eb.slot, chan, v, inf))
            vals.append(v)
            if v is None:
                unk.append((j, chan))
            if not inf:
                mute.append((j, chan))
        if len(ka) != len(kb) and e.overhang == "differ":
            vals.append(False)
    if not vals:
        return True, rows, tuple(unk), tuple(mute)
    return and3(vals), rows, tuple(unk), tuple(mute)


def _agree_key(utt, e, ext):
    """A hashable join key from the edge's AGREE channels, or None.

    Built from the FIRST position of each AGREE channel only. That keeps the
    key shape constant across members whose extents have different LENGTHS --
    which is the normal case, not the exception: semirhyme, apocopated rhyme,
    additive rhyme and traws all pair spans of unequal length, and a key built
    over every position silently put them in different buckets and reported
    nothing. The key is a FILTER; correctness is `_eval_edge`'s job, so a
    partial key costs recall of nothing and only weakens the pruning.

    None means 'do not index this extent' -- uncertain knowledge (Persian's
    unwritten short vowel) goes to the wildcard bucket and is still compared.
    """
    key = []
    for chan, pred in e.channels:
        if pred.kind != "AGREE":
            continue
        ks = read_channel(utt, chan, ext)
        if ks is UNREADABLE or not ks:
            return None
        k0 = ks[0]
        if k0 is UNREADABLE or len(k0) != 1:
            return None
        key.append((chan, next(iter(k0))))
    return tuple(key) or None


def find(utt, rt, scope=None, max_findings=5000):
    """-> list[Finding] | Refusal.

    Two paths. A two-member figure with at least one AGREE channel is an INDEX
    JOIN, which is what makes song scale tractable: bucket both domains on the
    agreeing material, then compare only inside a bucket. Everything else is
    backtracking with minimum-remaining-values ordering and forward checking.
    """
    doms = []
    for slot, m in enumerate(rt.members):
        missing = tuple(f for f in m.anchor.requires
                        if f not in utt.decl.channels)
        if missing:
            return Refusal(rt.name,
                           f"member {slot} anchors on {m.anchor.rule!r}, which "
                           f"needs {missing} and {utt.decl.language} declares "
                           f"none. The anchor rule is a coordinate, not a "
                           f"universal.", missing)
        d = domain(utt, m, slot, scope)
        if isinstance(d, str):
            return Refusal(rt.name, d.removeprefix("REFUSE:"))
        if not d:
            return []
        doms.append(d)

    out = []
    if len(rt.members) == 2 and rt.edges:
        e = rt.edges[0]
        if any(p.kind == "AGREE" for _, p in e.channels):
            out = _join(utt, rt, e, doms, max_findings)
        else:
            out = _product(utt, rt, e, doms, max_findings)
    else:
        out = _backtrack(utt, rt, doms, max_findings)
    return _select(utt, rt, out)


def _pack(utt, rt, frames, exts, rows, unk, mute, verdict):
    return Finding(
        type_name=rt.name, verdict=verdict, extents=tuple(exts),
        channels=tuple(rows), unknown=tuple(unk), uninformative=tuple(mute),
        frame=frames[0], k_hypotheses=utt.k_hypotheses,
        witness=" ~ ".join(
            "".join(utt.sites[i].syl.text for i in x.sites) for x in exts))


def _pairwise_ok(utt, rt, e, fa, ea, fb, eb):
    # MEMBERS ARE AN ORDERED TUPLE IN TEXT ORDER. Enforcing it here is what
    # makes additive and subtractive rhyme ONE structure with the per-member
    # specs exchanged, and it removes the duplicate mirrored finding that a
    # symmetric relation would otherwise report twice.
    if ea.sites[0] >= eb.sites[0]:
        return None
    v, rows, unk, mute = _eval_edge(utt, e, ea, eb)
    if v == "REFUSE":
        return Refusal(rt.name,
                       f"channel {unk[0]!r} is not in the declaration for "
                       f"{utt.decl.language}")
    if v is False:
        return None
    return _pack(utt, rt, (fa, fb), (ea, eb), rows, unk, mute, v)


def _join(utt, rt, e, doms, cap):
    buckets = {}
    wild = []
    for fb, eb in doms[1]:
        k = _agree_key(utt, e, eb)
        (wild if k is None else buckets.setdefault(k, [])).append((fb, eb))
    out = []
    for fa, ea in doms[0]:
        k = _agree_key(utt, e, ea)
        cands = wild + (buckets.get(k, []) if k is not None
                        else [x for v in buckets.values() for x in v])
        for fb, eb in cands:
            r = _pairwise_ok(utt, rt, e, fa, ea, fb, eb)
            if isinstance(r, Refusal):
                return r
            if r is not None:
                out.append(r)
                if len(out) >= cap:
                    return out
    return out


def _product(utt, rt, e, doms, cap):
    out = []
    for (fa, ea), (fb, eb) in itertools.product(doms[0], doms[1]):
        r = _pairwise_ok(utt, rt, e, fa, ea, fb, eb)
        if isinstance(r, Refusal):
            return r
        if r is not None:
            out.append(r)
            if len(out) >= cap:
                return out
    return out


def _backtrack(utt, rt, doms, cap):
    """n-ary figures: analysed rhyme's 2x2 grid, sain's shared pivot, the
    blues AAB triangle. MRV ordering, edges applied the moment both of their
    endpoints are bound."""
    order = sorted(range(len(doms)), key=lambda s: len(doms[s]))
    by_slot = {}
    for e in rt.edges:
        by_slot.setdefault(max(e.a, e.b), []).append(e)
    out, assign = [], {}

    def rec(pos):
        if len(out) >= cap:
            return
        if pos == len(order):
            rows, unk, mute, vals = [], [], [], []
            for e in rt.edges:
                v, r, u, mu = _eval_edge(utt, e, assign[e.a][1], assign[e.b][1])
                if v == "REFUSE":
                    return
                rows += r
                unk += list(u)
                mute += list(mu)
                vals.append(v)
            out.append(_pack(utt, rt,
                             [assign[s][0] for s in sorted(assign)],
                             [assign[s][1] for s in sorted(assign)],
                             rows, unk, mute, and3(vals)))
            return
        slot = order[pos]
        for fr, ext in doms[slot]:
            if any(ext.sites == a[1].sites for a in assign.values()):
                continue
            assign[slot] = (fr, ext)
            ok = True
            for e in by_slot.get(slot, ()):
                if e.a in assign and e.b in assign:
                    v, *_ = _eval_edge(utt, e, assign[e.a][1], assign[e.b][1])
                    if v is False or v == "REFUSE":
                        ok = False
                        break
            if ok:
                rec(pos + 1)
            del assign[slot]

    rec(0)
    return out


def _select(utt, rt, found):
    """The member-SELECTION rule: doctrine 18's count AND fraction, Kalevala's
    ∃>=2, paroemion's ∀. A quantifier is part of the type, not of the caller."""
    if isinstance(found, Refusal):
        return found
    s = rt.selection
    if s.quantifier == "pair":
        return found
    by = {}
    for f in found:
        fr = utt.frame_of(s.frame, f.extents[0].sites[0])
        by.setdefault(fr.id if fr else -1, []).append(f)
    out = []
    if s.quantifier == "exists_k":
        for fid, fs in by.items():
            if len(fs) >= s.k - 1:
                best = max(fs, key=lambda x: (x.verdict is True, len(x.witness)))
                out.append(replace(best, verdict=or3([x.verdict for x in fs])))
        return out
    if s.quantifier == "forall":
        for fid, fs in by.items():
            fr = [x for x in utt.frames[s.frame] if x.id == fid]
            if not fr:
                continue
            toks = {utt.sites[i].token for i in fr[0].sites()}
            covered = {utt.sites[i].token for f in fs for e in f.extents
                       for i in e.sites}
            if covered >= toks:
                out.append(replace(fs[0], verdict=and3([x.verdict for x in fs])))
        return out
    if s.quantifier == "count_fraction":
        n = len(utt.frames.get(s.frame, ()))
        for fid, fs in by.items():
            if len(fs) >= s.min_count and n and len(fs) / n >= s.min_fraction:
                out.append(fs[0])
        return out
    return found


def scan(utt, types=None, scope=None):
    """Every declared type against the whole utterance.

    -> {name: [Finding] | Refusal}. A Refusal is kept in the result, because
    "this language cannot be asked this" is a finding about the declaration and
    silently dropping it is how a monoculture default gets in.
    """
    reg = types if types is not None else list(REGISTRY.values())
    return {t.name: find(utt, t, scope) for t in reg}


# ---------------------------------------------------------------------------
# 8. THE REGISTRY -- canonical types as data
# ---------------------------------------------------------------------------

REGISTRY = {}


def register(rt):
    REGISTRY[rt.name] = rt
    return rt


STRESSED_TAIL = Member(
    anchor=Anchor("last_prominent", requires=("prominence",)),
    span=Span(unit="syllable", direction=1, magnitude="to_locus_end",
              locus="token", terminator="locus_edge"),
    placement=Placement(frame="line", select="final"))

WORD_HEAD = Member(
    anchor=Anchor("locus_start"),
    span=Span(unit="syllable", direction=1, magnitude=1, locus="token"),
    placement=Placement(frame="line", select="any"))

LINE_FINAL_SYL = Member(
    anchor=Anchor("locus_end"),
    span=Span(unit="syllable", direction=1, magnitude=1, locus="token"),
    placement=Placement(frame="line", select="final"))


register(RhymeType(
    name="perfect rhyme",
    aka=("full rhyme", "odl", "antya-prāsa", "qāfiya (segmental core)"),
    members=(STRESSED_TAIL, STRESSED_TAIL),
    edges=(Edge(0, 1, (("nucleus", AGREE), ("coda", AGREE),
                       ("token", DIFFER))),),
    note="onset MUST-DIFFER is added by the anchor-syllable rule below; "
         "tail-to-tail flush is a CONSEQUENCE of anchor+magnitude."))

register(RhymeType(
    name="rime riche",
    members=(STRESSED_TAIL, STRESSED_TAIL),
    edges=(Edge(0, 1, (("onset", AGREE), ("nucleus", AGREE), ("coda", AGREE),
                       ("token", DIFFER))),)))

register(RhymeType(
    name="repetition",
    members=(STRESSED_TAIL, STRESSED_TAIL),
    edges=(Edge(0, 1, (("token", AGREE),)),),
    normative="mandatory",
    note="doctrine 3: a fault inside a verse, the requirement across chorus "
         "instances. Same point, inverted NORMATIVE STATUS."))

register(RhymeType(
    name="assonance",
    members=(STRESSED_TAIL, STRESSED_TAIL),
    edges=(Edge(0, 1, (("nucleus", AGREE), ("coda", DIFFER),
                       ("token", DIFFER))),),
    note="codas MUST differ, so no suffix of the two words is equal -- which "
         "is why suffix alignment cannot express it."))

register(RhymeType(
    name="consonance",
    members=(STRESSED_TAIL, STRESSED_TAIL),
    edges=(Edge(0, 1, (("coda", AGREE), ("nucleus", DIFFER),
                       ("token", DIFFER))),)))

register(RhymeType(
    name="pararhyme",
    members=(STRESSED_TAIL, STRESSED_TAIL),
    edges=(Edge(0, 1, (("onset", AGREE), ("coda", AGREE), ("nucleus", DIFFER),
                       ("token", DIFFER))),),
    note="onset AND coda agree, so both edges coincide: one anchor plus a "
         "full-syllable magnitude, not two alignments."))

register(RhymeType(
    name="reverse rhyme",
    aka=("front rhyme", "head-and-body rhyme"),
    members=(STRESSED_TAIL, STRESSED_TAIL),
    edges=(Edge(0, 1, (("onset", AGREE), ("nucleus", AGREE), ("coda", DIFFER),
                       ("token", DIFFER))),),
    note="THE CELL rhyme_types.CELL_NAMES[(1,1,0)] declares nameless. The "
         "agreeing material is a PREFIX of the rime, so it is structurally "
         "unreachable by suffix alignment. bat/back."))

register(RhymeType(
    name="alliteration",
    aka=("stuðlar", "höfuðstafr", "higaad", "mōnai", "anuprāsa (onset case)"),
    members=(WORD_HEAD, WORD_HEAD),
    edges=(Edge(0, 1, (("onset", AGREE), ("token", DIFFER))),),
    selection=Selection("exists_k", k=2, frame="line"),
    note="THE CASE THE OLD PRODUCER CANNOT EXPRESS AT ALL. Anchor is the head, "
         "not the tail; frame is the line; selection is existential."))

register(RhymeType(
    name="Kalevala alliteration (strong)",
    members=(WORD_HEAD, WORD_HEAD),
    edges=(Edge(0, 1, (("onset", AGREE), ("nucleus", AGREE),
                       ("token", DIFFER))),),
    selection=Selection("exists_k", k=2, frame="line"),
    note="structurally IDENTICAL to English reverse rhyme at a different "
         "placement frame."))

register(RhymeType(
    name="semirhyme",
    members=(STRESSED_TAIL,
             replace(STRESSED_TAIL,
                     span=Span(unit="syllable", direction=1,
                               magnitude="to_locus_end", locus="token"))),
    edges=(Edge(0, 1, (("nucleus", AGREE), ("coda", AGREE),
                       ("token", DIFFER)), overhang="require_1"),),
    note="the overhanging unstressed syllable is EXCLUDED, not required to "
         "differ. bend/ending. Word ends do not agree -- that is the point."))

register(RhymeType(
    name="additive rhyme",
    members=(STRESSED_TAIL, STRESSED_TAIL),
    edges=(Edge(0, 1, (("nucleus", AGREE), ("coda", PRESENT_ON(1)),
                       ("token", DIFFER))),),
    note="SEGMENTAL, and says nothing about syllable count -- which is the "
         "collision with rhyme_types.classify_pair's len(sa) vs len(sb)."))

register(RhymeType(
    name="subtractive rhyme",
    members=(STRESSED_TAIL, STRESSED_TAIL),
    edges=(Edge(0, 1, (("nucleus", AGREE), ("coda", PRESENT_ON(0)),
                       ("token", DIFFER))),),
    note="additive with the per-member specs exchanged. No ORDEREDNESS axis "
         "is needed once members are an ordered tuple in text order."))

register(RhymeType(
    name="light rhyme",
    aka=("anisobaric", "Simpsonian"),
    members=(STRESSED_TAIL, LINE_FINAL_SYL),
    edges=(Edge(0, 1, (("nucleus", AGREE), ("coda", AGREE),
                       ("prominence", DIFFER), ("token", DIFFER))),),
    note="prominence is a CHANNEL with a MUST-DIFFER predicate, not a filter. "
         "The honest word-pair-only label; 'wrenched' asserts a delivered "
         "surface no text supplies."))

WEAK_FINAL_SYL = replace(
    LINE_FINAL_SYL,
    anchor=Anchor("locus_end", requires=("prominence",)),
    filters=(("prominence", 0, kn(0)),))

register(RhymeType(
    name="syllabic rhyme",
    members=(WEAK_FINAL_SYL, WEAK_FINAL_SYL),
    edges=(Edge(0, 1, (("nucleus", AGREE), ("coda", AGREE),
                       ("token", DIFFER))),),
    note="the anchor rule is SUSPENDED -- direct evidence that ANCHOR is an "
         "axis. cleaver/silver."))

register(RhymeType(
    name="amphisbaenic rhyme",
    members=(Member(anchor=Anchor("locus_start"),
                    span=Span("syllable", 1, "to_locus_end", "token"),
                    placement=Placement("line", "any")),
             Member(anchor=Anchor("locus_end"),
                    span=Span("syllable", -1, "to_locus_end", "token"),
                    placement=Placement("line", "any"))),
    edges=(Edge(0, 1, (("phone", AGREE), ("token", DIFFER)),
                exhaustive="both"),),
    note="member 2 direction=-1 on the PHONE channel, and nothing else. The sole forcing case for "
         "span DIRECTION being per member."))

register(RhymeType(
    name="epistrophe / radif",
    members=(Member(anchor=Anchor("locus_end"),
                    span=Span("syllable", -1, "exhaustive", "token"),
                    placement=Placement("line", "final")),
             Member(anchor=Anchor("locus_end"),
                    span=Span("syllable", -1, "exhaustive", "token"),
                    placement=Placement("line", "final"))),
    edges=(Edge(0, 1, (("token", AGREE),)),),
    selection=Selection("count_fraction", frame="line",
                        min_count=3, min_fraction=0.60),
    note="doctrine 58: the count IS the threshold. min_fraction 1.0 gives 297 "
         "Hafez ghazals and 0.60 gives 315."))

register(RhymeType(
    name="homoioteleuton",
    aka=("grammatical rhyme", "suffix rhyme"),
    members=(LINE_FINAL_SYL, LINE_FINAL_SYL),
    edges=(Edge(0, 1, (("morph_affix", AGREE), ("token", DIFFER))),),
    normative="fault",
    note="THE SINGLE MOST IMPORTANT FALSE-POSITIVE CLASS for a tail "
         "comparator: running/singing scores as a two-syllable near-match on "
         "any suffix comparison. Keyed on the MORPHEME channel so it is "
         "detected morphologically and DEMOTED, not scored phonologically and "
         "rewarded. A declaration with no morphology REFUSES it rather than "
         "falling back to the phonological reading, which would be the "
         "false positive itself."))

register(RhymeType(
    name="semirhyme (cluster span)",
    members=(STRESSED_TAIL,
             replace(STRESSED_TAIL,
                     span=Span(unit="syllable", direction=1,
                               magnitude="to_locus_end", locus="token"))),
    edges=(Edge(0, 1, (("nucleus", AGREE), ("cluster", AGREE),
                       ("token", DIFFER)), overhang="require_1"),),
    note="the SAME type at a different SPAN UNIT. bend/ending fails on a "
         "syllable-coda reading (the /d/ resyllabifies into `ding`) and holds "
         "on the post-vocalic cluster reading. Doctrine 61: both readings are "
         "registered and the choice between them is an empirical question."))

register(RhymeType(
    name="skothending",
    traditions=("Old Norse",),
    members=(STRESSED_TAIL, STRESSED_TAIL),
    edges=(Edge(0, 1, (("cluster", AGREE), ("nucleus", DIFFER),
                       ("onset", DIFFER), ("token", DIFFER))),),
    note="structurally English consonance at a different span unit and "
         "placement frame -- the same point, not a special case. Onsets must "
         "differ is doctrine 3 written in the 1220s."))

register(RhymeType(
    name="mosaic rhyme",
    members=(Member(anchor=Anchor("frame_end"),
                    span=Span("syllable", -1, 2, "line",
                              terminator="frame_edge"),
                    placement=Placement("line", "any")),
             Member(anchor=Anchor("frame_end"),
                    span=Span("syllable", -1, 2, "line",
                              terminator="frame_edge"),
                    placement=Placement("line", "any"))),
    edges=(Edge(0, 1, (("nucleus", AGREE), ("coda", AGREE),
                       ("juncture", DIFFER))),),
    note="the span is anchored on the LINE, not the word, so it crosses word "
         "boundaries freely; the JUNCTURE channel carries the asymmetry that "
         "is constitutive. poet/know it."))


def demo_type(name):
    return REGISTRY[name]


__all__ = ["Site", "Frame", "Declaration", "Utterance", "build",
           "declaration_for", "Anchor", "Span", "Placement", "Member", "Edge",
           "Selection", "RhymeType", "Pred", "AGREE", "DIFFER", "FREE",
           "EXCLUDED", "CLASS_EQUAL", "DIRECTED_DIFFER", "PRESENT_ON",
           "Refusal", "Finding", "find", "scan", "domain", "read_channel",
           "agree", "differ", "and3", "or3", "kn", "kn_seq", "ABS", "ABSENT",
           "REGISTRY", "register", "CASES", "compare", "report"]


# ---------------------------------------------------------------------------
# THE COMPARISON RUNNER  —  BACKLOG 4.4 / MISSING M-16, DECIDED 2026-08-11
#
# This file was the repo's ONE stranded module: 1,325 lines, no caller, no
# `__main__`, reported as such by `python3 lyric_harness.py wiring`. The
# decision owed was to mine its knowledge sets into `relations.py` and delete
# it, or to give it a `__main__` and keep it as a comparison runner. It is the
# second, and the argument is below, with the measurement that made it.
#
# THE CASE FOR DELETION IS REAL AND IT IS ABOUT CAPABILITY.  Measured by the
# table this runner prints:
#
#   * 20 named types against `relations.py`'s 77.
#   * 18 of the 20 have a same-named schema over there; the other two are
#     there under different names — `skothending` is `cluster consonance /
#     skothending span` and `semirhyme (cluster span)` is `semirhyme` plus the
#     span-unit axis. So the covered set is 20 of 20, and 59 names go the
#     other way.
#   * no `SequenceEqual` / `SequenceSuffix` / `SubsequenceOf`, so a sequence
#     relation is expressible here only where a per-syllable channel happens
#     to carry it.
#   * on the canonical case table below, `relations.py` finds a STRICT
#     SUPERSET: every case this module answers, that one answers, and not the
#     reverse.
#   * its one genuine advance — a `frozenset` per channel — is now in
#     `relations.py` (the comparison half, 2026-08-11) and in
#     `quality/phonology.Syllable` (the production half, the same day). The
#     reason to mine it is spent.
#
# AND IT IS STILL KEPT, FOR THREE REASONS THAT ARE NOT SENTIMENT.
#
#   1. It is the only INDEPENDENT implementation of this taxonomy in the repo,
#      and doctrine 87 is explicit that agreement was never the point,
#      independence was. A second implementation that agrees tells you little;
#      one that DISAGREES locates a defect. The first run of this runner does
#      exactly that: `additive rhyme` and `subtractive rhyme` are found by
#      `relations.py` on `year`/`feared` and refused here, because
#      `apply_pred`'s `PRESENT_ON` still tests whole-channel EMPTINESS
#      (`a == ABS`) — which is DEFECT P6, named and fixed over there and
#      still live here. That is a finding this file produced about itself the
#      moment it was made runnable, and a deleted file produces none.
#      **P6 IS DELIBERATELY NOT FIXED HERE.** Patching this implementation to
#      agree with `relations.py` would spend the only property that justifies
#      keeping the file. Doctrine 87: agreement was never the point,
#      independence was — and a second implementation edited until it agrees
#      is one implementation with two copies (doctrine 51's error, at the
#      level of code rather than of editions).
#   2. Deleting it breaks two files, and neither belongs to whoever is
#      deciding: `quality/test_relations.py` imports it for
#      `test_rhyme_constraints_unreadable_nucleus`, which pins that an
#      UNREADABLE nucleus is not an EMPTY one, and
#      `quality/audit_register.py`'s claim D22 `open()`s this path directly
#      and would raise.
#   3. Doctrine 84's rule that a demonstration must stay reachable. The
#      knowledge-set idea is easier to check against two implementations than
#      against one, and `agree()` here and `Agree()` there can be run
#      side by side in one command — which is what the runner does.
#
# WHAT THIS FILE IS NOT, AND THE DOCSTRING AT THE TOP MUST BE READ WITH THIS
# NEXT TO IT: it is not a candidate architecture and it is not the shipping
# producer. `relations.py` is. This is an ADVERSARY (doctrine 94's third one,
# pointed at the code) and the numbers it prints are a diff, never a verdict.
# Like `battery.py` it has no assert and exits 0 whatever the table says —
# read its numbers, never its exit status.
# ---------------------------------------------------------------------------

#: The canonical cases, one per structural claim either module makes. Each is
#: (label, lines, language, name). The name is the same in both registries
#: except where noted in `_ALIAS`.
CASES = (
    ("head alliteration — kukka/kalevala, the case the OLD producer cannot "
     "express at all", ["kukka kalevala"], "fin", "alliteration"),
    ("Kalevala alliteration (strong)", ["Vaka vanha Väinämöinen"], "fin",
     "Kalevala alliteration (strong)"),
    ("perfect rhyme", ["the cat", "the hat"], "eng", "perfect rhyme"),
    ("rime riche — sea/see", ["the sea", "i see"], "eng", "rime riche"),
    ("repetition", ["the cat", "the cat"], "eng", "repetition"),
    ("assonance — sun/much, doctrine 3's own case", ["the sun", "so much"],
     "eng", "assonance"),
    ("consonance", ["a bad man", "he is bed"], "eng", "consonance"),
    ("pararhyme", ["it was bad", "it was bed"], "eng", "pararhyme"),
    ("reverse rhyme — bat/back, a PREFIX of the rime", ["a bat", "the back"],
     "eng", "reverse rhyme"),
    ("semirhyme — bend/ending", ["a bend", "an ending"], "eng", "semirhyme"),
    ("light rhyme", ["a bee", "the beauty"], "eng", "light rhyme"),
    ("syllabic rhyme — cleaver/silver, the anchor rule SUSPENDED",
     ["a cleaver", "the silver"], "eng", "syllabic rhyme"),
    ("additive rhyme — year/feared (DEFECT P6 lives here)",
     ["a year", "he feared"], "eng", "additive rhyme"),
    ("subtractive rhyme — feared/year", ["he feared", "a year"], "eng",
     "subtractive rhyme"),
    ("amphisbaenic — the sole forcing case for per-member DIRECTION",
     ["a stop", "the pots"], "eng", "amphisbaenic rhyme"),
    ("mosaic rhyme — poet/know it", ["a poet", "you know it"], "eng",
     "mosaic rhyme"),
    ("epistrophe / radif", ["i love you my dear", "i miss you my dear",
                            "i need you my dear"], "eng",
     "epistrophe / radif"),
    ("homoioteleuton — running/singing, the false-positive class",
     ["he was running", "she was singing"], "eng", "homoioteleuton"),
)

#: Names this module spells differently from `relations.py`. Recorded rather
#: than normalised away, because "20 types, 2 of them unique" is FALSE and the
#: aliasing is the reason.
_ALIAS = {
    "skothending": "cluster consonance / skothending span",
    "semirhyme (cluster span)": "semirhyme",
}


def _outcome_here(lines, phon, name):
    if name not in REGISTRY:
        return "NO TYPE", None
    try:
        got = find(build(lines, phon), REGISTRY[name])
    except Exception as e:                                        # noqa: BLE001
        return f"RAISED {type(e).__name__}", None
    if isinstance(got, Refusal):
        return "REFUSED", got.reason
    return (f"{len(got)} found" if got else "0 found"), None


def _outcome_there(lines, phon, name, R):
    if name not in R.REGISTRY:
        return "NO SCHEMA", None
    try:
        st = R.build_stream(lines, phon, declaration={"language": phon.language})
        got = R.realise(R.REGISTRY[name], st)
    except Exception as e:                                        # noqa: BLE001
        return f"RAISED {type(e).__name__}", None
    if isinstance(got, R.Refusal):
        # `relations.Refusal` names the missing CAPABILITY, not a reason
        # string, and its `__bool__` raises on purpose — so it is tested by
        # isinstance and read by field, never by truthiness.
        return "REFUSED", got.capability
    return (f"{len(got)} found" if got else "0 found"), None


def compare():
    """-> (rows, coverage). Runs every case through BOTH modules.

    Imported lazily so this file stays importable on its own, which is what
    `test_relations.py` does with it.
    """
    import quality.relations as R
    from quality.phonology import get as _get

    rows = []
    for label, lines, lang, name in CASES:
        phon = _get(lang)
        here, hnote = _outcome_here(lines, phon, name)
        there, tnote = _outcome_there(lines, phon,
                                      _ALIAS.get(name, name), R)
        rows.append((label, name, there, here, tnote, hnote))
    mine, theirs = set(REGISTRY), set(R.REGISTRY)
    unmatched = {n for n in mine if _ALIAS.get(n, n) not in theirs}
    coverage = {
        "here": len(mine), "there": len(theirs),
        "same_name": len(mine & theirs),
        "aliased": len({n for n in mine if n not in theirs
                        and _ALIAS.get(n, n) in theirs}),
        "unmatched": sorted(unmatched),
        "only_there": len(theirs - {_ALIAS.get(n, n) for n in mine}),
    }
    return rows, coverage


def report(out=None):
    """Print the diff. NO ASSERT and exit 0 regardless — read the table."""
    import sys as _sys
    out = out or _sys.stdout
    rows, cov = compare()

    def w(s=""):
        out.write(s + "\n")

    w("=" * 78)
    w("rhyme_constraints.py — COMPARISON RUNNER against quality/relations.py")
    w("BACKLOG 4.4 decided 2026-08-11: kept as an ADVERSARY, not as a")
    w("candidate architecture. relations.py is the shipping producer.")
    w("This runner has no assert and exits 0 whatever it prints.")
    w("=" * 78)
    w()
    w("TYPE COVERAGE")
    w(f"  named types here            {cov['here']:3d}")
    w(f"  named schemas in relations  {cov['there']:3d}")
    w(f"  same name in both           {cov['same_name']:3d}")
    w(f"  covered under another name  {cov['aliased']:3d}  "
      f"({', '.join(f'{k} -> {v}' for k, v in _ALIAS.items())})")
    w(f"  here and NOWHERE there      {len(cov['unmatched']):3d}  "
      f"{cov['unmatched'] or ''}")
    w(f"  there and not here          {cov['only_there']:3d}")
    w()
    w("CANONICAL CASES  (relations.py | this module)")
    w("-" * 78)
    w("%-46s %-14s %-14s" % ("case", "relations", "here"))
    w("-" * 78)
    agree_n = dom = flip = 0
    for label, name, there, here, tnote, hnote in rows:
        w("%-46s %-14s %-14s" % (label[:46], there, here))
        if there == here:
            agree_n += 1
        elif there.endswith("found") and there[0] != "0" and not (
                here.endswith("found") and here[0] != "0"):
            dom += 1
        else:
            flip += 1
        for tag, note in (("relations", tnote), ("here", hnote)):
            if note:
                w(f"       {tag} refusal: {note}")
    w("-" * 78)
    w(f"identical on {agree_n} of {len(rows)}; relations answers and this "
      f"module does not on {dom}; the other direction on {flip}")
    w()
    w("KNOWLEDGE SETS — the one advance, now present in three places")
    import quality.relations as R
    from quality.phonology import Syllable, Readings
    w(f"  here      agree(kn('IH'), frozenset({{'IH','AY'}})) = "
      f"{agree(kn('IH'), frozenset({'IH', 'AY'}))}")
    w(f"  relations Agree()(frozenset({{'IH','AY'}}), 'IH')   = "
      f"{R.Agree()(frozenset({'IH', 'AY'}), 'IH').value!r}")
    s = Syllable("wind", ("W",), Readings({"IH", "AY"}), ("N", "D"), 1, 1)
    w(f"  phonology Syllable can now PRODUCE one: certain={s.certain} "
      f"uncertain_channels={s.uncertain_channels()}")
    w()
    w("DOCTRINE 25 TRIPWIRE — two ABSENT codas AGREE and carry no evidence")
    w(f"  here      agree(ABS, ABS)   = {agree(ABS, ABS)}")
    w(f"  relations Agree()((), ())   = "
      f"{(R.Agree()((), ()).value, R.Agree()((), ()).informative)}")
    return 0


if __name__ == "__main__":
    import os as _os
    import sys as _s
    _s.path.insert(0, _os.path.dirname(_os.path.dirname(
        _os.path.abspath(__file__))))
    _s.exit(report())

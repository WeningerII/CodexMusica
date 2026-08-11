#!/usr/bin/env python3
"""The rhyme-scheme SPACE, over a whole song. Not a list of named forms.

WHAT WAS WRONG BEFORE THIS FILE

The repo contained seven rhyme-scheme strings in total -- ABAB (20 uses), AA,
AABB, AAAA, one sonnet, one limerick, one ABC -- and `blueprint.json` shipped
six four-line sections as *the* blueprint. Everything measurable was cut to a
stanza: the slop floor calibrates on a "4-line quatrain, 29-37 tokens" profile
and a "14-line sonnet" profile, and nothing else. Writing to that produced five
identical quatrains and a certificate saying it was clean.

THE UNIT IS THE SONG, AND THE STANZA IS A PRINTING CONVENTION

A rhyme scheme is a SET PARTITION of the song's lines: lines i and j share a
block iff they rhyme. Nothing in that definition mentions a stanza. Chopping a
40-line lyric into ten 4-line groups and partitioning each does not approximate
the real object -- it makes every long-range rhyme UNREPRESENTABLE. A hook that
answers a line thirty lines earlier is not a weak signal under the stanza
model; it does not exist in it.

So:

  - lines are numbered 1..N across the ENTIRE lyric,
  - a scheme is a partition of {1..N},
  - SECTION MEMBERSHIP IS A LABEL ON LINES, never a boundary on the analysis.
    `Song.sections` annotates; it does not chunk. Rhymes cross sections and
    `crossing_rhymes()` exists to find exactly those.

HOW BIG THE SPACE IS

|partitions of n| = Bell(n).

    n    1  2  3   4    5    6     7     8      9      10        12
  B(n)   1  2  5  15   52  203   877  4140  21147  115975  4213597

Four lines admit FIFTEEN schemes. This project had been using three of them.
Six lines admit 203, of which perhaps a dozen have names. The named forms are
not the taxonomy -- they are the small labelled subset that got worn out, which
is precisely why a generator should be able to reach the rest.

At song length enumeration is impossible and pointless: a 40-line lyric admits
B(40) ~ 1.6e35 schemes. So this module is GENERATIVE AND DESCRIPTIVE, not a
catalogue. It enumerates exhaustively while that is finite, and for real songs
it places an observed scheme in the space by its structural coordinates
(span, crossing number, singleton rate, block profile, section-crossing) and
samples from it under constraints.

CANONICAL FORM

Restricted growth strings: a[0]=0 and a[i] <= max(a[:i])+1. Every partition has
exactly one RGS, so ABAB and BABA are one object and not two. Letters are
assigned in order of first appearance, which is what everyone already writes.

THE PARTITION IS A FLOOR, NOT A CEILING (doctrine 2)

Doctrine 2 says the rhyme graph is primary and maximal cliques MAY OVERLAP --
chained slant rhyme gives structures with no letter representation at all. A
partition cannot express overlap. So `Partition` is the disjoint case and
`Cover` is the general one; a scheme letter-string is a lossy projection of the
graph and this module says so rather than pretending the projection is the
object.
"""

import itertools
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# THE SPACE
# ---------------------------------------------------------------------------


def bell(n):
    """Bell(n) -- the number of distinct rhyme schemes over n lines."""
    if n < 0:
        raise ValueError("n must be >= 0")
    row = [1]
    for _ in range(n):
        nxt = [row[-1]]
        for x in row:
            nxt.append(nxt[-1] + x)
        row = nxt
    return row[0]


def stirling2(n, k):
    """Schemes over n lines using exactly k distinct rhyme sounds."""
    if k > n or k < 0:
        return 0
    tbl = [[0] * (k + 1) for _ in range(n + 1)]
    tbl[0][0] = 1
    for i in range(1, n + 1):
        for j in range(1, k + 1):
            tbl[i][j] = j * tbl[i - 1][j] + tbl[i - 1][j - 1]
    return tbl[n][k]


def rgs(n, max_blocks=None):
    """Every scheme over n lines, as canonical restricted growth strings.

    Yields tuples of ints. `max_blocks` caps the number of distinct rhyme
    sounds -- the useful lever, since a 24-line lyric on 4 sounds is a
    tractable and musically real subspace of an intractable whole.
    """
    if n <= 0:
        return
    a = [0] * n

    def rec(i, mx):
        if i == n:
            yield tuple(a)
            return
        top = mx + 1
        if max_blocks is not None:
            top = min(top, max_blocks - 1)
        for v in range(top + 1):
            a[i] = v
            yield from rec(i + 1, max(mx, v))

    yield from rec(1, 0)


def label(code, alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ"):
    """(0,1,0,1) -> 'ABAB'. Beyond 26 sounds, letters become A1 B1 ..."""
    out = []
    for v in code:
        if v < len(alphabet):
            out.append(alphabet[v])
        else:
            out.append(f"{alphabet[v % len(alphabet)]}{v // len(alphabet)}")
    return "".join(out)


def parse(text):
    """'ABAB' or 'abab' or 'A B A B' -> canonical code. X/x/. = unrhymed.

    An unrhymed line is a SINGLETON BLOCK, not a missing value -- 'ABXB' and
    'ABCB' are the same partition, and this returns the same code for both.
    """
    toks, i = [], 0
    t = "".join(text.split())
    while i < len(t):
        c = t[i]
        j = i + 1
        while j < len(t) and t[j].isdigit():
            j += 1
        toks.append(t[i:j])
        i = j
    seen, code = {}, []
    for k, tok in enumerate(toks):
        if tok.upper() in ("X", "."):
            code.append(-(k + 1))          # forced singleton, unique
            continue
        key = tok.upper()
        if key not in seen:
            seen[key] = len(seen)
        code.append(seen[key])
    return canonical(code)


def canonical(code):
    """Any labelling -> the unique restricted growth string for its partition."""
    seen, out = {}, []
    for v in code:
        if v not in seen:
            seen[v] = len(seen)
        out.append(seen[v])
    return tuple(out)


def blocks(code):
    """-> list of line-number lists (1-based), in order of first appearance."""
    out = {}
    for i, v in enumerate(code):
        out.setdefault(v, []).append(i + 1)
    return [out[k] for k in sorted(out)]


# ---------------------------------------------------------------------------
# WHERE A SCHEME SITS IN THE SPACE
#
# At song length the space cannot be enumerated, so a scheme is located by
# coordinates instead. These are the ones that distinguish a form people have
# heard ten thousand times from one nobody has used.
# ---------------------------------------------------------------------------


@dataclass
class Coordinates:
    n_lines: int
    n_sounds: int
    block_sizes: tuple
    singletons: int              # unrhymed lines
    max_span: int                # longest gap between two rhyming lines
    mean_span: float
    crossings: int               # pairs of blocks that interleave (ABAB-like)
    nestings: int                # pairs of blocks that enclose (ABBA-like)
    adjacencies: int             # rhymes on consecutive lines (AABB-like)
    contiguous_blocks: int       # blocks whose lines are all consecutive
    section_crossing: int = 0    # rhymes spanning a section label boundary
    sections: tuple = ()

    def as_dict(self):
        return dict(self.__dict__)


def coordinates(code, sections=None):
    """Locate a scheme in the space. `sections` is a per-line label list --
    an ANNOTATION. It never chunks the analysis; it only lets the descriptor
    report how many rhymes cross a section boundary, which is the statistic
    the stanza model could not express because it had already forbidden them.
    """
    code = canonical(code)
    n = len(code)
    bs = blocks(code)
    spans, cross, nest, adj = [], 0, 0, 0
    for b in bs:
        for x, y in itertools.combinations(b, 2):
            spans.append(y - x)
            if y - x == 1:
                adj += 1
    for b1, b2 in itertools.combinations(bs, 2):
        for (x1, y1) in itertools.combinations(b1, 2):
            for (x2, y2) in itertools.combinations(b2, 2):
                if x1 < x2 < y1 < y2 or x2 < x1 < y2 < y1:
                    cross += 1
                elif x1 < x2 < y2 < y1 or x2 < x1 < y1 < y2:
                    nest += 1
    contig = sum(1 for b in bs if b == list(range(b[0], b[0] + len(b))))
    sx = 0
    if sections:
        if len(sections) != n:
            raise ValueError(
                f"sections has {len(sections)} labels for {n} lines. It is a "
                f"per-LINE annotation, not a list of section names -- the "
                f"whole point is that it does not partition the analysis.")
        for b in bs:
            for x, y in itertools.combinations(b, 2):
                if sections[x - 1] != sections[y - 1]:
                    sx += 1
    return Coordinates(
        n_lines=n, n_sounds=len(bs),
        block_sizes=tuple(sorted((len(b) for b in bs), reverse=True)),
        singletons=sum(1 for b in bs if len(b) == 1),
        max_span=max(spans) if spans else 0,
        mean_span=(sum(spans) / len(spans)) if spans else 0.0,
        crossings=cross, nestings=nest, adjacencies=adj,
        contiguous_blocks=contig,
        section_crossing=sx, sections=tuple(sections or ()))


def crossing_rhymes(code, sections):
    """-> [(line_i, line_j, section_i, section_j)] for rhymes that span a
    section boundary. These are the relations the stanza model made
    unrepresentable, so they get their own accessor."""
    code = canonical(code)
    out = []
    for b in blocks(code):
        for x, y in itertools.combinations(b, 2):
            if sections[x - 1] != sections[y - 1]:
                out.append((x, y, sections[x - 1], sections[y - 1]))
    return out


# ---------------------------------------------------------------------------
# NAMED FORMS AS COORDINATES, NOT AS THE TAXONOMY
#
# Every entry is a POINT in the space above. The registry exists so a scheme
# can be told "you have written ottava rima" -- and, more usefully, "you have
# written something with no name", which is the interesting answer.
# ---------------------------------------------------------------------------

NAMED = {}


def name(pattern, *names, tradition="", note=""):
    code = parse(pattern)
    NAMED.setdefault(code, {"names": [], "tradition": tradition, "note": note,
                            "pattern": label(code)})
    NAMED[code]["names"].extend(names)
    return code


# -- two and three lines
name("AA", "couplet")
name("AB", "unrhymed pair")
name("AAA", "triplet", "monorhyme tercet")
name("ABA", "enclosed tercet", "terza rima stanza")
name("AAB", "bar-form tercet")
name("ABB", "reverse bar")
name("ABC", "unrhymed tercet")

# -- four lines: ALL FIFTEEN, because this is where the damage was
name("AAAA", "monorhyme quatrain", "syair", tradition="Malay/Arabic")
name("AAAB", "tail quatrain")
name("AABA", "Rubaiyat quatrain", tradition="Persian")
name("AABB", "paired couplets", "clerihew shape")
name("AABC", "opening couplet, open close")
name("ABAA", "inverted Rubaiyat")
name("ABAB", "alternate", "interlocking", "cross rhyme")
name("ABAC", "half-alternate")
name("ABBA", "enclosed", "envelope", "In Memoriam", "redondilla")
name("ABBB", "tail-heavy")
name("ABBC", "enclosed opening")
name("ABCA", "envelope over three")
name("ABCB", "ballad", "common metre", "hymn metre", "copla")
name("ABCC", "closing couplet")
name("ABCD", "unrhymed quatrain", "blank quatrain")

# -- five and six
name("AABBA", "limerick")
name("ABABB", "extended alternate")
name("AABCCB", "tail-rhyme stanza", "rime couee")
name("ABABCC", "Venus and Adonis stanza")
name("AABBCC", "triple couplets")
name("ABCABC", "sixain interlock")
name("ABABAB", "sicilian sestet")
name("AAABAB", "Burns stanza", "standard Habbie", tradition="Scots")
name("ABBACC", "enclosed plus couplet")
name("ABCCBA", "chiastic sestet")

# -- seven to nine
name("ABABBCC", "rhyme royal", "Troilus stanza")
name("ABABBCBC", "chained ballade octave")
name("ABABABCC", "ottava rima", tradition="Italian")
name("ABABBCBCC", "Spenserian stanza")
name("ABABCDCD", "double alternate")
name("AABCCBDDB", "chained tail-rhyme")

# -- fourteen: the sonnets
name("ABABCDCDEFEFGG", "Shakespearean sonnet", "English sonnet")
name("ABBAABBACDECDE", "Petrarchan sonnet", "Italian sonnet")
name("ABBAABBACDCDCD", "Petrarchan sonnet (sestet variant)")
name("ABBAABBACDDCEE", "Petrarchan sonnet (couplet close)")
name("ABABBCBCCDCDEE", "Spenserian sonnet")
name("ABABCBCDCDEDEE", "Onegin stanza", tradition="Russian")
name("ABABCDCDEFEFGG", "Elizabethan sonnet")
name("AABBCCDDEEFFGG", "couplet sonnet")
name("ABABABABABABCC", "monorhyme-drift sonnet")

# -- song-length forms, over the WHOLE lyric rather than per section
name("AAAA", "strophic hook", note="one sound across a whole section")
name("ABABCDCDEFEF", "three alternate sections")
name("AABAAABAAABA", "AABA over three, song-length view",
     note="the 32-bar standard seen as ONE partition of 12 lines, which is "
          "what it is -- not three separate stanzas")

# -- refrain forms: the refrain is line IDENTITY, not just rhyme, so these are
#    recorded with a note that the partition under-describes them
name("ABAABAABAABAABAABAABAA", "villanelle (rhyme only)",
     note="the villanelle's substance is two REFRAIN LINES repeating verbatim "
          "at fixed positions. A partition records that they rhyme; it cannot "
          "record that they are the same line. See Cover and doctrine 3 -- "
          "REPEAT is a relation, and here it is the form's whole point.")
name("ABAAABABAB", "triolet (rhyme only)",
     note="lines 1,4,7 and 2,8 are verbatim repeats; partition under-describes")


def identify(code):
    """-> dict for a named form, or None. None is the INTERESTING answer: it
    means the scheme is one of the overwhelming majority nobody has used."""
    return NAMED.get(canonical(code))


def unnamed_fraction(n):
    """What share of the n-line schemes has no name? The number this project
    should have been looking at all along."""
    total = bell(n)
    named = sum(1 for c in NAMED if len(c) == n)
    return named, total, 1.0 - (named / total if total else 0)


# ---------------------------------------------------------------------------
# THE OVERLAP LAYER (doctrine 2)
#
# A partition forces every line into exactly one rhyme class. Real lyrics do
# not obey that: with slant rhyme, line 2 can answer line 1 on the nucleus and
# line 3 on the coda while 1 and 3 share nothing. That is a COVER, not a
# partition, and it has no letter-string representation at all.
# ---------------------------------------------------------------------------


@dataclass
class Cover:
    """Rhyme structure as overlapping groups over the whole song."""
    n_lines: int
    groups: list = field(default_factory=list)   # lists of 1-based line nos

    def is_partition(self):
        seen = set()
        for g in self.groups:
            if seen & set(g):
                return False
            seen |= set(g)
        return True

    def to_partition(self):
        """-> RGS if the cover happens to be disjoint, else None.

        None is not a failure. It is the answer doctrine 2 predicted: this
        structure has no letter scheme, and forcing one would delete the
        overlap that makes it what it is.
        """
        if not self.is_partition():
            return None
        code = [None] * self.n_lines
        for k, g in enumerate(self.groups):
            for i in g:
                code[i - 1] = k
        for i, v in enumerate(code):
            if v is None:
                code[i] = len(self.groups) + i
        return canonical(code)

    def overlapping_lines(self):
        """Lines belonging to more than one rhyme group -- the pivots a letter
        scheme cannot express."""
        count = {}
        for g in self.groups:
            for i in g:
                count[i] = count.get(i, 0) + 1
        return sorted(i for i, c in count.items() if c > 1)

    def groups_of(self, line):
        """-> indices of the groups containing `line`."""
        return [k for k, g in enumerate(self.groups) if line in g]


# ---------------------------------------------------------------------------
# THE MANDATE — what a draft is HELD TO
#
# Everything above describes a structure. This names one as a REQUIREMENT, and
# it exists because the revision loop could only be handed a letter string.
#
# THE DEFECT IT CLOSES
#
# `Reviser.brief(lines, scheme)` and `verify(before, after, scheme, targeted)`
# took `scheme` as a LETTER STRING and nothing else. Doctrine 2 says a letter
# scheme is a LOSSY PROJECTION of the rhyme graph and that maximal cliques may
# OVERLAP, giving structures with no letter representation at all. So the loop
# could grade only the projections the doctrine calls lossy, and on a song
# whose cliques overlap it was handed `scheme=None`, mandated nothing, and
# returned "nothing flagged" -- a VACUOUS PASS. Doctrine 20: inconclusive by
# construction is not a null, and here it was dressed as a pass.
#
# WHAT A MANDATE MEANS, DECLARED
#
# A mandate is a set of GROUPS of line numbers. Its content is exactly:
#
#     for every group g and every pair {i, j} within g, lines i and j must
#     stand in a RHYME relation under the declaration.
#
# Nothing else. A line in no group is FREE and mandates nothing -- which is
# what `quality/schemes.py` has always said about X ("an unrhymed line is a
# singleton BLOCK, not a missing value") and what the spine had to be taught
# in three separate places.
#
# ON AN OVERLAPPING COVER THE READING IS CONJUNCTIVE.
#
# A line in k groups must answer ALL k of them. This is a DECLARATION and it
# is argued, not assumed:
#
#   1. The DISJUNCTIVE reading ("answer at least one of your groups") makes a
#      mandate WEAKER the more structure it declares: adding a group to a
#      cover can only ever give an overlapping line another way to be excused,
#      so no added group can create a finding. A requirement that is
#      monotonically relaxed by being made more specific is vacuity again, one
#      level up, and this module exists because of a vacuous pass.
#   2. Under the conjunctive reading a cover is strictly STRONGER than every
#      letter scheme consistent with it, because any letter assignment puts a
#      pivot in exactly one class and therefore mandates a SUBSET of the
#      cover's pairs. That is the docstring above -- "the partition is a
#      floor, not a ceiling" -- turned into an enforceable claim rather than a
#      remark.
#   3. The overlap IS the structure. When line 27 sits in a clique with line 6
#      and a clique with line 24, the song's claim is that `ones` answers
#      `floods` AND `times`. If it only had to answer one of them it would not
#      be a pivot; it would be a line whose label nobody had settled.
#
# The disjunctive reading stays REACHABLE (`ReviseDeclaration.overlap_rule`)
# so the choice is measurable rather than settled by fiat, in the shape
# doctrine 82 used for `dyrchafedig` and doctrine 84 for `consult=False`.
#
# A MANDATE CARRIES WHERE IT CAME FROM.
#
# `source` is "declared" or "derived". A cover read off the rhyme graph's own
# maximal cliques is DERIVED: every clique is by construction a set of
# mutually band-passing lines, so grading it against the same band returns no
# rhyme violation NECESSARILY. That is doctrine 14 -- a control may not be
# defined in terms of the quantity it controls -- arriving in the revision
# loop, and a derived mandate that came back clean must never be reported as
# a pass. `Mandate.independent()` is False there and the loop says so.
# ---------------------------------------------------------------------------


class NoMandate(ValueError):
    """Raised when a grader is asked to check a draft against NOTHING.

    Doctrine 20. The alternative -- returning an empty finding list -- is a
    vacuous pass, and a caller cannot tell it from a clean draft. This is the
    same move `extent` made in the Welsh module (doctrine 82): no default, and
    an absent argument raises.
    """


@dataclass
class Mandate:
    """A rhyme requirement over a whole song. The object `brief`/`verify`
    grade against, whether or not it has a letter representation."""

    n_lines: int
    #: tuples of 1-based line numbers, each of size >= 2. MAY OVERLAP.
    groups: tuple = ()
    #: display label per group, index-aligned with `groups`
    labels: tuple = ()
    #: 1-based lines in no group at all -- declared free, mandating nothing
    free: tuple = ()
    source: str = "declared"          # "declared" | "derived"
    origin: str = ""                  # how it was obtained, in words

    # -- what it requires -------------------------------------------------

    def pairs(self):
        """-> [(i, j, group_index)], 1-based, i < j. THE mandate, expanded.

        A pair can appear more than once when two groups share both of its
        lines; the group index is carried so a finding can say WHICH group it
        is about, which a letter string could never do because a letter is a
        property of a line rather than of a relation.
        """
        out = []
        for k, g in enumerate(self.groups):
            for a in range(len(g)):
                for b in range(a + 1, len(g)):
                    out.append((g[a], g[b], k))
        return sorted(out)

    def pairs0(self):
        """-> sorted DISTINCT 0-based (i, j). What the feature layer wants."""
        return sorted({(i - 1, j - 1) for i, j, _ in self.pairs()})

    def groups_of(self, line):
        return [k for k, g in enumerate(self.groups) if line in g]

    def partners(self, line):
        """-> [(group_index, [other lines in that group])] for `line`."""
        return [(k, [x for x in self.groups[k] if x != line])
                for k in self.groups_of(line)]

    def overlapping_lines(self):
        return sorted(i for i in range(1, self.n_lines + 1)
                      if len(self.groups_of(i)) > 1)

    # -- what it is -------------------------------------------------------

    def is_partition(self):
        return not self.overlapping_lines()

    def independent(self):
        """Was this mandate obtained WITHOUT consulting the grader?

        False for a cover read off the rhyme graph. Doctrine 14: a clean
        result against a derived mandate is an identity, not a verdict.
        """
        return self.source == "declared"

    def to_cover(self):
        return Cover(n_lines=self.n_lines,
                     groups=[list(g) for g in self.groups])

    def to_letters(self):
        """-> the letter string, or None when no letter scheme exists.

        None is the doctrine 2 answer and it is not a failure: this structure
        has no letter representation, and inventing one would delete the
        overlap that makes it what it is.
        """
        if not self.is_partition():
            return None
        out = ["X"] * self.n_lines
        for k, g in enumerate(self.groups):
            for i in g:
                out[i - 1] = self.labels[k]
        return "".join(out)

    def to_code(self):
        """-> canonical restricted growth string, or None if it overlaps."""
        letters = self.to_letters()
        return None if letters is None else parse(letters)

    def coordinates(self, sections=None):
        code = self.to_code()
        return None if code is None else coordinates(code, sections)

    # -- reporting --------------------------------------------------------

    def describe(self):
        letters = self.to_letters()
        head = (f"mandate: {len(self.groups)} group(s) over {self.n_lines} "
                f"lines, {len(self.pairs())} mandated pair(s), "
                f"{len(self.free)} free line(s)")
        rows = [head, f"  source: {self.source} ({self.origin})"]
        if not self.independent():
            rows.append(
                "  NOT INDEPENDENT of the grader: this cover was read off the "
                "rhyme graph, so every group is mutually band-passing BY "
                "CONSTRUCTION and a clean rhyme result here is an identity, "
                "not a verdict (doctrine 14).")
        for k, g in enumerate(self.groups):
            rows.append(f"  {self.labels[k]}: lines {list(g)}")
        if letters is None:
            piv = self.overlapping_lines()
            rows.append(
                f"  NO LETTER SCHEME EXISTS: lines {piv} belong to more than "
                f"one group, and a letter is a property of a LINE, so no "
                f"assignment of one letter per line can carry this "
                f"(doctrine 2). Each pivot must answer every group it is in.")
        else:
            rows.append(f"  letters: {letters}")
        return "\n".join(rows)


def _normalise_groups(raw, n_lines):
    """-> (groups, free). Validates, dedupes, and sends singletons to free."""
    seen, groups = set(), []
    for g in raw:
        try:
            members = sorted({int(x) for x in g})
        except (TypeError, ValueError):
            raise NoMandate(
                f"a mandate group must be an iterable of line numbers; got "
                f"{g!r}. A partition is a list of LINE GROUPS -- "
                f"[[1, 3], [2, 4]] -- not a list of letters.")
        for i in members:
            if not 1 <= i <= n_lines:
                raise NoMandate(
                    f"line {i} is outside 1..{n_lines}. Mandate line numbers "
                    f"are 1-BASED and run over the WHOLE song, because a "
                    f"stanza is a printing convention and a rhyme that "
                    f"answers thirty lines earlier has to be expressible.")
        if len(members) < 2:
            continue            # a singleton mandates nothing; it is FREE
        key = tuple(members)
        if key in seen:
            continue
        seen.add(key)
        groups.append(key)
    covered = {i for g in groups for i in g}
    free = tuple(i for i in range(1, n_lines + 1) if i not in covered)
    return tuple(groups), free


def mandate(spec, n_lines=None, source="declared", origin=None):
    """Anything that can name a rhyme requirement -> a `Mandate`.

    Accepted, and all four are the SAME kind of object once here:

      - a letter string      'ABAB', 'XXXXABCB...' (X / . = free singleton)
      - a canonical RGS code (0, 1, 0, 1)   -- see `parse`/`canonical`
      - a list of groups     [[1, 3], [2, 4]]  -- MAY OVERLAP
      - a `Cover`            the general, overlap-carrying case
      - a `Mandate`          idempotent

    `None` RAISES `NoMandate`. That is the point of the function: a grader
    with no mandate has been given nothing to check against, and saying
    "nothing flagged" about it is a vacuous pass (doctrine 20).
    """
    if spec is None:
        raise NoMandate(
            "no mandate was declared, so there is NOTHING to check this draft "
            "against.\n"
            "This is a REFUSAL, not a pass. Returning 'nothing flagged' here "
            "would report a clean draft on the strength of having asked no "
            "question -- doctrine 20, inconclusive by construction dressed as "
            "a null.\n"
            "Declare one of:\n"
            "  a letter string     'ABAB'  (X or . marks a free, unrhymed "
            "line)\n"
            "  a list of groups    [[1, 3], [2, 4]]  -- 1-based, may OVERLAP\n"
            "  a quality.schemes.Cover, or a canonical RGS code from parse()\n"
            "A song whose maximal cliques overlap has NO letter scheme "
            "(doctrine 2); declare the Cover, which is exactly why Cover "
            "exists.")

    if isinstance(spec, Mandate):
        if n_lines is not None and n_lines != spec.n_lines:
            raise NoMandate(
                f"this mandate is written over {spec.n_lines} lines and the "
                f"draft has {n_lines}. A mandate is a statement about "
                f"SPECIFIC LINES of a specific song; silently ignoring a "
                f"length mismatch is how the old loop dropped a declared "
                f"scheme on the floor and passed vacuously.")
        return spec

    if isinstance(spec, Cover):
        n = spec.n_lines if n_lines is None else n_lines
        if n_lines is not None and spec.n_lines != n_lines:
            raise NoMandate(
                f"cover is over {spec.n_lines} lines, draft has {n_lines}")
        raw, org = spec.groups, origin or "declared Cover"
    elif isinstance(spec, str):
        code = parse(spec)
        n = len(code) if n_lines is None else n_lines
        if n != len(code):
            raise NoMandate(
                f"the scheme '{spec}' is {len(code)} characters and the draft "
                f"is {n} lines. A letter scheme is a per-LINE annotation; a "
                f"length mismatch used to be ignored in silence, which "
                f"mandated nothing and reported nothing flagged.")
        raw = blocks(code)
        org = origin or f"letter scheme {spec!r}"
    else:
        items = list(spec)
        if items and all(isinstance(x, int) for x in items):
            code = canonical(items)          # a restricted growth string
            n = len(code) if n_lines is None else n_lines
            if n != len(code):
                raise NoMandate(
                    f"RGS code has {len(code)} entries, draft has {n} lines")
            raw = blocks(code)
            org = origin or f"RGS code {tuple(code)}"
        else:
            raw = [list(x) for x in items]
            n = n_lines if n_lines is not None else max(
                [max(g) for g in raw if g] or [0])
            org = origin or "declared line groups"

    groups, free = _normalise_groups(raw, n)
    if not groups:
        raise NoMandate(
            "the mandate declares no group of two or more lines, so it "
            "mandates NO pair and cannot flag anything. An all-free scheme "
            "('XXXX') is a statement that nothing is required, and grading a "
            "draft against it would pass vacuously -- which is the defect "
            "this object exists to close. Declare at least one group, or say "
            "plainly that the song has no rhyme requirement and do not run "
            "the loop.")
    labels = tuple(label((k,)) for k in range(len(groups)))
    return Mandate(n_lines=n, groups=groups, labels=labels, free=free,
                   source=source, origin=org)


__all__ = ["bell", "stirling2", "rgs", "label", "parse", "canonical",
           "blocks", "Coordinates", "coordinates", "crossing_rhymes",
           "NAMED", "identify", "unnamed_fraction", "Cover",
           "Mandate", "mandate", "NoMandate"]

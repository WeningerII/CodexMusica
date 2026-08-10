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


__all__ = ["bell", "stirling2", "rgs", "label", "parse", "canonical",
           "blocks", "Coordinates", "coordinates", "crossing_rhymes",
           "NAMED", "identify", "unnamed_fraction", "Cover"]

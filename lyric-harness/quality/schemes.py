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


# ---------------------------------------------------------------------------
# THE REFRAIN NOTATION (MISSING.md A-1)
#
# Capital = a line repeated VERBATIM. Lowercase = rhyme only. A superscript
# distinguishes two refrains that share a rhyme: `A¹` and `A²` both rhyme in
# class a and are two DIFFERENT lines, each identical to its own returns. This
# is the standard prosodic convention and the villanelle is written in it:
#
#     A1bA2  abA1  abA2  abA1  abA2  abA1A2
#
# and until now it could not be written down in this repo at all. `schemes.py`
# said so in a note on its own villanelle entry and did not act on it.
#
# WHY IT IS A SECOND PARTITION AND NOT A LONGER ALPHABET
#
# A refrain is line IDENTITY. Doctrine 3 already names the relation -- REPEAT,
# "a violation inside a verse, the requirement across chorus instances" -- so
# the notation carries TWO partitions over the same lines: a RHYME partition
# (which is what `parse` has always returned, and still returns) and an
# IDENTITY partition (which lines are the same words). A¹ and A² collapse to
# one rhyme class and stay two identity classes. One letter string cannot hold
# both, which is why this is an object.
#
# THE ONE AMBIGUITY, NAMED RATHER THAN RESOLVED BY FIAT
#
# `label()` renders the 27th rhyme sound as `A1` (A-3), and the refrain
# notation renders the first refrain of class A as `A1` too. Same characters,
# two readings. The discriminator is declared and it is MIXED CASE: refrain
# notation marks non-refrain lines in lowercase, so a string containing both
# cases -- or any explicit superscript or `^` mark -- is read as refrain
# notation, and an all-uppercase string keeps the >26-sound reading it has
# always had. `parse` returns the same rhyme code under either reading in
# every case except that one, and `parse_refrain` is always available
# explicitly.
# ---------------------------------------------------------------------------

#: Unicode superscript digits, in value order.
SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹"
_SUP_MAP = {c: str(i) for i, c in enumerate(SUPERSCRIPTS)}


def _tokenise(text):
    """-> [(letter, mark)] where mark is the refrain/sound index as a string
    ('' when bare). Accepts `A1`, `A^1` and `A¹` alike."""
    t = "".join(str(text).split())
    toks, i = [], 0
    while i < len(t):
        c = t[i]
        j = i + 1
        mark = ""
        if j < len(t) and t[j] == "^":
            j += 1
        while j < len(t) and (t[j].isdigit() or t[j] in _SUP_MAP):
            mark += _SUP_MAP.get(t[j], t[j])
            j += 1
        toks.append((c, mark))
        i = j
    return toks


def is_refrain_notation(text):
    """-> True when `text` is to be read with capital-means-verbatim.

    The declared discriminator, in order: an explicit superscript or `^` mark
    settles it; otherwise MIXED CASE settles it; otherwise the string is the
    plain rhyme reading `parse` has always given.
    """
    t = "".join(str(text).split())
    if any(c in _SUP_MAP or c == "^" for c in t):
        return True
    letters = [c for c in t if c.isalpha()]
    return (any(c.isupper() for c in letters)
            and any(c.islower() for c in letters))


@dataclass
class RefrainScheme:
    """A scheme in the A-1 notation: a rhyme partition AND an identity one.

    `code` is the rhyme partition -- exactly what `parse` returns, so every
    consumer downstream is unaffected. `identity` is the second partition:
    lines that are THE SAME LINE. A lowercase line is a singleton there.
    """
    n_lines: int
    code: tuple                    # rhyme partition (RGS)
    marks: tuple = ()              # per line: 'A1', 'b', 'X' ... as written
    #: refrain label -> 1-based line numbers that must be VERBATIM identical
    refrains: dict = field(default_factory=dict)

    @property
    def identity(self):
        """-> RGS over line IDENTITY. Non-refrain lines are singletons."""
        seen, code = {}, []
        for i, m in enumerate(self.marks):
            if m in self.refrains:
                seen.setdefault(m, len(seen))
                code.append(seen[m])
            else:
                code.append(-(i + 1))
        return canonical(code)

    def repeat_pairs(self):
        """-> [(i, j, label)] pairs the notation says are the SAME LINE.

        These are REPEAT relations (doctrine 3), which the band treats as a
        violation inside a verse and as the requirement here. A rhyme checker
        handed these pairs and no label would flag every one of them.
        """
        out = []
        for lab, lines in sorted(self.refrains.items()):
            for a, b in itertools.combinations(sorted(lines), 2):
                out.append((a, b, lab))
        return sorted(out)

    def check_identity(self, lines, variation=True):
        """-> findings for refrain lines that are not what the notation says.

        THIS IS WHY THE NOTATION IS NOT MERELY READABLE. A villanelle whose
        second refrain has drifted by a word is the commonest way the form
        fails, and it was undetectable here: the rhyme partition passes, the
        band passes, and the line that was supposed to come back did not.

        `variation=True` sends every non-identical pair to
        `quality.grid.compare_returns`, so the answer is a NAMED KIND of
        variation rather than a boolean (doctrine 24) -- a refrain that keeps
        its rhyme and changes a word is Hanby's move, not a broken villanelle,
        and the two have to be distinguishable.

        The identity requirement is deliberately NOT folded into `Mandate`.
        A Mandate is a RHYME requirement, and doctrine 3 says REPEAT is a
        violation inside a verse and the requirement across returns. Handing
        these pairs to a rhyme grader would flag every correct refrain.

        THE DRAFT HAS TO BE THE POEM THE NOTATION NUMBERS, and until
        2026-08-13 nothing here tested that. Every finding below is positional
        — "the notation's L5 is the draft's fifth line" — and `self.n_lines`
        comes from the NOTATION while `len(lines)` comes from the DRAFT, two
        independently sourced numbers that no constructor on this path
        reconciles. (`Mandate` cannot have this defect the same way:
        `Reviser.mandate` builds `SC.mandate(spec, n_lines=len(lines))`, so
        the two agree by construction there.) The old `OUT_OF_RANGE` message
        NAMED THAT MISMATCH — "the notation declares N lines and M were
        given" — while its guard tested a refrain LINE INDEX against
        `len(lines)`, and the two come apart in BOTH directions:

        GENEROUS. On a form whose LAST LINE IS NOT A REFRAIN the mismatch
        holds and no index is out of range, so nothing was reported at all.
        The shipped `pantoum quatrain pair` (`aB1aB2 B1cB2c`, 8 lines, last
        refrain line 7) checked against a 7-line draft returned `[]`, and
        `lyric_harness.py refrain` printed "every declared refrain returned
        VERBATIM" one line under its own "7 line(s) vs 8 declared". The
        harness printed the evidence and the opposite verdict together.
        MEASURED over `REFRAIN_FORMS`, that is the ONLY one of the eight
        shipped forms that discriminates — the other seven close ON a refrain,
        so their last line is also a refrain line and the index guard covers
        for the missing check. That is why nothing found this. Doctrine 94:
        no positive case can find it either, because every positive case hands
        over a draft of exactly the right length.

        MISLEADING. A `RefrainScheme` built directly rather than through
        `parse_refrain` (which cannot number a refrain past its own line
        count) can carry a refrain outside its own 1..n_lines; checked against
        exactly `n_lines` lines the old message printed "declares 4 lines and
        4 were given", two numbers that AGREE and name nothing.

        Both are closed the way `Mandate.returns_check` closed its twin, and
        phrased as that method phrases it so the two surfaces cannot drift:
        the length disagreement is its own `LINE_COUNT` finding that says how
        many requirements were graded on the positional reading ANYWAY and are
        conditional on it, and `OUT_OF_RANGE` names the offending LINE, says
        WHICH of the two ways it got out of range (doctrine 79 — a hand-built
        scheme and a short draft need different repairs) and says the
        requirement was NOT CHECKED rather than leaving a reader to infer a
        clean pass from silence (doctrine 20).
        """
        from quality.grid import compare_returns, normalise_line
        out = []
        n = len(lines)
        pairs = self.repeat_pairs()
        if n != self.n_lines:
            unchecked = sum(1 for i, j, _ in pairs if i > n or j > n)
            lo, hi = ((n + 1, self.n_lines) if n < self.n_lines
                      else (self.n_lines + 1, n))
            span, was = ((f"L{lo}", "was") if lo == hi
                         else (f"L{lo}..L{hi}", "were"))
            how = (f"{span} {was} never given" if n < self.n_lines else
                   f"{span} {'is' if was == 'was' else 'are'} past the "
                   f"notation's last line")
            # THREE COUNTS, doctrine 79: declared, graded-on-the-assumption,
            # and not reached at all. Summing them would hide which layer the
            # unchecked ones belong to.
            out.append((None, None, None, "LINE_COUNT",
                        f"the notation numbers {self.n_lines} lines and {n} "
                        f"were given — {how}, so the draft's line k is not "
                        f"known to be the notation's line k and every "
                        f"identity finding here is positional. Of "
                        f"{len(pairs)} declared REPEAT pair(s): "
                        f"{len(pairs) - unchecked} graded on that reading "
                        f"ANYWAY and conditional on it, {unchecked} naming a "
                        f"line past the draft and NOT CHECKED. This is the "
                        f"assumption said out loud, not a clean pass "
                        f"(doctrine 20)"))
        for i, j, lab in pairs:
            if i > n or j > n:
                bad = [x for x in (i, j) if x > n]
                names = "L" + ", L".join(str(x) for x in bad)
                # WHICH of the two disagreements this is, said out loud. Past
                # `self.n_lines` -> the SCHEME numbers a refrain outside its
                # own declaration, which `parse_refrain` cannot produce and
                # only a hand-built `RefrainScheme` reaches. Inside
                # 1..n_lines and past `len(lines)` -> the DRAFT is short.
                why = (f"and {names} is outside the notation's own "
                       f"1..{self.n_lines} — this scheme was NOT built by "
                       f"`parse_refrain`, which cannot number a refrain past "
                       f"its own line count"
                       if any(x > self.n_lines for x in bad) else
                       f"though {names} is inside the notation's own "
                       f"1..{self.n_lines} — the DRAFT is short")
                out.append((lab, i, j, "OUT_OF_RANGE",
                            f"refrain {lab} names {names}, past the {n} "
                            f"line(s) given, {why}. The verbatim requirement "
                            f"at L{i}/L{j} was NOT CHECKED — unasked, not "
                            f"answered clean (doctrine 20)"))
                continue
            a, b = lines[i - 1], lines[j - 1]
            if normalise_line(a) == normalise_line(b):
                continue
            kind = (compare_returns([a], [b]).kind if variation
                    else "NOT_VERBATIM")
            out.append((lab, i, j, kind,
                        f"refrain {lab} must return VERBATIM: "
                        f"L{i} {a!r} vs L{j} {b!r}"))
        return out

    def to_mandate(self, source="declared", origin=None, rule=None):
        """-> a `Mandate` carrying BOTH partitions. The bridge that was missing.

        THE A-1 NOTATION SHIPPED AND COULD NOT REACH THE LOOP. `parse_refrain`
        reads it, `lyric_harness.py refrain` prints it, and `check_identity`
        grades it -- but `mandate()` routed a notation string through `parse()`,
        which returns the RHYME partition and drops the identity one on the
        floor in silence. So `brief FILE A1bA2abA1abA2abA1abA2abA1A2` mandated
        the villanelle's rhyme and said nothing whatever about the twelve lines
        that have to come back, which is the requirement the form is FOR.

        The identity half is deliberately NOT folded into `Mandate.groups` --
        the note above `check_identity` is right that handing REPEAT pairs to a
        rhyme grader flags every correct refrain. It goes into
        `Mandate.returns`, where doctrine 3's inversion is stated per PAIR and
        the grader can be told which of the two readings applies.

        A capital used ONCE declares a verbatim requirement with nothing to be
        verbatim against; it is not a return and is recorded as skipped rather
        than promoted to one.
        """
        rets = [Return(lines=tuple(sorted(v)), label=k, verbatim=True,
                       origin=f"A-1 notation mark {k!r}")
                for k, v in sorted(self.refrains.items()) if len(v) >= 2]
        lone = sorted(k for k, v in self.refrains.items() if len(v) < 2)
        note = origin or f"A-1 refrain notation {self.render()!r}"
        if lone:
            note += (f" (marks {lone} appear once each and are NOT returns: "
                     f"a line that comes back zero times mandates no identity)")
        return mandate([list(b) for b in blocks(self.code) if len(b) >= 2],
                       n_lines=self.n_lines, source=source, origin=note,
                       returns=rets, rule=rule)

    def render(self):
        """-> the notation string. Round-trips through `parse_refrain`."""
        return "".join(self.marks)

    def describe(self):
        rows = [f"{self.render()}   ({self.n_lines} lines)",
                f"  rhyme partition : {label(self.code)}",
                f"  refrains        : "
                f"{ {k: sorted(v) for k, v in sorted(self.refrains.items())} }"]
        if not self.refrains:
            rows.append("  no capital marks: this scheme states rhyme only, "
                        "and says nothing about line identity")
        return "\n".join(rows)


def parse_refrain(text):
    """A-1 notation -> `RefrainScheme`. Capital = verbatim, lowercase = rhyme.

    `X` and `.` stay what they have always been: a forced singleton, unrhymed
    and unrepeated. A bare capital `A` is a refrain whose label is `A`; `A1`
    and `A2` are two refrains inside rhyme class a.
    """
    toks = _tokenise(text)
    seen, code, marks, refrains = {}, [], [], {}
    for k, (c, mark) in enumerate(toks):
        written = c + (mark if mark else "")
        marks.append(written)
        if c.upper() in ("X", ".") or not c.isalpha():
            code.append(-(k + 1))
            continue
        key = c.upper()                 # rhyme class ignores the mark
        if key not in seen:
            seen[key] = len(seen)
        code.append(seen[key])
        if c.isupper():
            refrains.setdefault(written, []).append(k + 1)
    return RefrainScheme(n_lines=len(toks), code=canonical(code),
                         marks=tuple(marks),
                         refrains={k: tuple(v) for k, v in refrains.items()})


def parse(text):
    """'ABAB' or 'abab' or 'A B A B' -> canonical code. X/x/. = unrhymed.

    An unrhymed line is a SINGLETON BLOCK, not a missing value -- 'ABXB' and
    'ABCB' are the same partition, and this returns the same code for both.

    ALSO ACCEPTS THE A-1 REFRAIN NOTATION and returns its RHYME partition:
    `parse('A1bA2 abA1 abA2 abA1 abA2 abA1A2')` is the villanelle's 19-line
    scheme with the two refrains collapsed into rhyme class a, which is what a
    partition can hold. Use `parse_refrain` for the identity half -- and note
    that discarding it here is not a loss of information so much as a
    statement of doctrine 2: a letter scheme is a lossy projection, and this
    one is losing exactly the thing the villanelle is about.
    """
    if is_refrain_notation(text):
        return parse_refrain(text).code
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
    #: UNREAD BY ANYTHING, production or test, since this class was written --
    #: computed at every `coordinates()` call and never asked for. The `scheme`
    #: verb prints eight of these twelve coordinates and skips this one.
    #: Recorded rather than deleted: it is a real coordinate of the space
    #: (doctrine 1) and the shape `ReviseDeclaration.max_rounds` had for the
    #: whole time before `quality/loop.py` was written.
    contiguous_blocks: int       # blocks whose lines are all consecutive
    #: read by tests only (`test_taxonomy.py`, `test_grid.py`); no production
    #: reader, and structurally unreachable besides -- `sections=` is never
    #: passed by any caller of `coordinates()` outside a test, so this is 0
    #: and `sections` is `()` on every production call.
    section_crossing: int = 0    # rhymes spanning a section label boundary
    sections: tuple = ()

    def as_dict(self):
        """UNCALLED by anything in this repo. Kept: it is the only accessor
        that surfaces `contiguous_blocks`/`section_crossing` at all."""
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

#: THE FORMS THAT ARE ABOUT LINE IDENTITY, written in the A-1 notation.
#: Each one is over-determined by its refrain positions, which is why writing
#: them down is a check and not merely a record: `parse_refrain(v).n_lines`
#: and `.refrains` either agree with the form or they do not.
REFRAIN_FORMS = {
    "villanelle": "A1bA2 abA1 abA2 abA1 abA2 abA1A2",
    "triolet": "ABaAabAB",
    "rondel": "ABbaabABabbaA",
    "rondeau (13 + 2 rentrement)": "aabba aabR aabbaR",
    "kyrielle quatrain": "abaB cbcB dbdB",
    "ballade": "ababbcbC ababbcbC ababbcbC bcbC",
    "pantoum quatrain pair": "aB1aB2 B1cB2c",
    "burden-first carol": "A1A2 bbbA1 cccA1 dddA1",
}


def refrain_form(key):
    """-> the `RefrainScheme` for a named identity-form."""
    return parse_refrain(REFRAIN_FORMS[key])


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

# -- refrain forms: the refrain is line IDENTITY, not just rhyme.
#
# BOTH ENTRIES BELOW WERE WRONG UNTIL THE NOTATION EXISTED, AND WRONG IN THE
# SAME WAY: they had the right letters and the wrong LENGTH. The villanelle
# stood at 22 lines and it is 19 (five tercets and a quatrain); the triolet
# stood at 10 and it is 8. Nothing could catch that, because the only thing
# either entry could be checked against was itself -- a rhyme-only string has
# no structure that pins its length, whereas `A1bA2 abA1 abA2 abA1 abA2
# abA1A2` is over-determined: the refrain positions fix the line count, and a
# 22-line villanelle cannot be written in it. Doctrine 37, arriving from an
# unexpected direction: the FORM is the tradition to test against, and a
# notation that can express the form is what makes the test possible.
name(REFRAIN_FORMS["villanelle"], "villanelle (rhyme only)",
     note="19 lines. The villanelle's substance is two REFRAIN LINES "
          "repeating verbatim at fixed positions: A1 at 1,6,12,18 and A2 at "
          "3,9,15,19. A partition records that they rhyme; it cannot record "
          "that they are the same line. Doctrine 3 -- REPEAT is a relation, "
          "and here it is the form's whole point. Written in full: "
          "A1bA2 abA1 abA2 abA1 abA2 abA1A2, and `parse_refrain` holds it.")
name(REFRAIN_FORMS["triolet"], "triolet (rhyme only)",
     note="8 lines, ABaAabAB. Lines 1,4,7 and 2,8 are verbatim repeats; the "
          "partition under-describes and `parse_refrain` does not.")
name(REFRAIN_FORMS["rondel"], "rondel (rhyme only)",
     note="13 lines; the opening couplet returns at 7-8 and line 1 again at "
          "13. Refrain notation: ABbaabABabbaA.")
name(REFRAIN_FORMS["kyrielle quatrain"], "kyrielle quatrain (rhyme only)",
     note="the fourth line is a burden repeating across every stanza -- the "
          "shape 1,776 BURDEN blocks in corpus/song carry.")


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
# THE MANDATE LANGUAGE SAYS ONE THING AND HAS TO SAY THREE
#
# MEASURED, on this repo's own song, with this repo's own mandate — the letter
# string `SONG_SCHEME` at `quality/test_revise.py:63`:
#
#     Reviser().inspect(lines, "XXXXXXXXXXXXABCBADCDXXXXXXXXXXXXEFGFEHGHX")
#     -> 27 distinct findings, 26 of them SCHEME_COLLISION
#     -> 16 of those 26 are the chorus (L13-L20) against its own return
#        (L33-L40), and 7 of the 16 are REPEAT on an IDENTICAL WORD:
#        slow/slow, five/five, ear/ear, go/go, went/went, clear/clear, sent/sent
#
# Nothing is wrong with the song. A letter scheme is a per-LINE annotation, so
# it MUST give `chorus` and `chorus2` different letters; the collision detector
# then correctly reports the identity the projection was forced to hide. That
# is doctrine 2 arriving as noise: the graph is the object, letter schemes are
# lossy projections, and this one is losing exactly the thing the song is about.
#
# THE THREE STATEMENTS, WHICH CURRENTLY COLLAPSE INTO ONE
#
#   1. these lines must RHYME               -- `Mandate.groups`, and all it says
#   2. this line must return VERBATIM       -- only `RefrainScheme.refrains`,
#                                              which `Mandate` deliberately
#                                              refused to carry
#   3. this group is a RETURN of that group -- nowhere at all
#
# Doctrine 3 already knows the distinction: "REPEAT is a violation inside a
# verse, the requirement across chorus instances, licensed as radif/refrain."
# The TAXONOMY inverts by context. The MANDATE had no way to state a context,
# so `ReviseDeclaration.repeat_licence` had to be a SONG-WIDE string —
# "unlicensed" flags all seven correct chorus returns, "refrain" licenses every
# REPEAT in the lyric including one inside a verse, which is the defect the flag
# exists to catch. A per-song switch cannot express a per-pair inversion.
#
# SO A MANDATE IS A FUNCTION FROM A LINE PAIR TO A REQUIREMENT, AND THE
# REQUIREMENT IS A CLOSED SET OF FIVE VALUES WITH A REAL UNKNOWN IN IT.
#
# Doctrine 28 binds here, and it is the reason the answer is not a boolean:
# "distinguish none from cannot tell, MECHANICALLY". An unmandated pair and a
# mandated-identical pair are different states; so is a pair the mandate never
# reached. Three states, three values, and the unknown PROPAGATES.
#
# Doctrine 48 says the distinction is only real once it is mechanical, so
# `UNKNOWN` is not `None`: it RAISES on `bool()`. A consumer that writes
#
#     if req.identity_required:            # <- TypeError, with the reason
#
# gets an exception naming doctrine 28 rather than silently reading the unknown
# as "no". That is the whole point of the sentinel — `None` is falsy, and every
# convention that asks a caller to remember it gets remembered exactly as often
# as somebody remembers it.
# ---------------------------------------------------------------------------


class _Unknown:
    """The third truth value, and it will not let you spend it as the second.

    `None` is falsy, so `if x:` reads a missing declaration as a denial. This
    object raises instead, because doctrine 28 is a claim about MECHANISM: a
    mandate that does not say whether identity is required must not be read as
    saying it is not.
    """

    __slots__ = ()
    _singleton = None

    def __new__(cls):
        if cls._singleton is None:
            cls._singleton = super().__new__(cls)
        return cls._singleton

    def __repr__(self):
        return "UNKNOWN"

    def __str__(self):
        return "UNKNOWN"

    def __bool__(self):
        raise TypeError(
            "this value is UNKNOWN and has no truth value. The mandate does "
            "not declare it, and reading an undeclared requirement as False is "
            "doctrine 28 — 'none' collapsed into 'cannot tell'. Branch on it "
            "explicitly:\n"
            "    if v is UNKNOWN: ...        # the mandate does not say\n"
            "    elif v: ...                 # declared true\n"
            "    else: ...                   # declared false\n"
            "or call `Requirement.decided(field)` to get the pair "
            "(is_declared, value).")


#: The single UNKNOWN. `is UNKNOWN` is the test; `== UNKNOWN` also works.
UNKNOWN = _Unknown()


@dataclass(frozen=True)
class Requirement:
    """What the mandate requires of ONE pair of lines. A closed set of five.

    A letter scheme could only ever say "same letter" or "different letter",
    which is two states for a question that has five answers. The five are
    module-level singletons below; `Mandate.requirement(i, j)` returns one of
    them and never anything else.

    Every field is TRUE, FALSE or `UNKNOWN`, and `UNKNOWN` raises on `bool()`.
    """

    name: str
    #: must these two lines stand in a RHYME relation?
    #: NO PRODUCTION READER. `grade()` decides rhyme from `Mandate.pairs()`
    #: (a pair is mandated because it is in a group), never by asking this
    #: field, so it is declared and read by `test_mandate_language.py` alone.
    #: DELIBERATELY RESERVED: it is the coordinate that would let a mandate
    #: state a REQUIRED IDENTITY WITHOUT a rhyme requirement, which is what a
    #: non-rhyming refrain in free verse is, and the closed five-value set is
    #: what makes such a value expressible at all.
    rhyme_required: object
    #: must they be the SAME LINE, verbatim?
    #: NO PRODUCTION READER either: `inspect()` reaches identity through
    #: `Mandate.returns_check()` / `Return.verbatim`, not through this field.
    identity_required: object
    #: is an identical end word here a VIOLATION? Doctrine 3's inversion, moved
    #: off the song-wide `repeat_licence` switch and onto the pair, which is
    #: where doctrine 3 always put it.
    repeat_is_violation: object
    #: did the mandate SPEAK about this pair at all? False means out of scope,
    #: which is "cannot tell" and is not the same as `FREE`'s "nothing here".
    #: NO PRODUCTION READER: it is False on `UNDECLARED` alone, and
    #: `UNDECLARED` is only returned when `Mandate.scope` is non-empty, which
    #: no production path ever makes it. `decided()` -- which IS on the
    #: production path -- reports per-FIELD declaredness (is the value
    #: `UNKNOWN`) and never consults this one.
    declared: bool
    gloss: str = ""

    def decided(self, field):
        """-> (is_declared, value). The branch-free way to read a tri-state."""
        v = getattr(self, field)
        return (False, None) if v is UNKNOWN else (True, v)

    def __str__(self):
        return self.name


#: Rhyme required, identity FORBIDDEN. What every letter scheme has always
#: meant by "these two lines share a letter", and what `Mandate.groups` has
#: always meant. Doctrine 3: inside a verse, REPEAT is the violation.
REQUIRE_RHYME = Requirement(
    "REQUIRE_RHYME", True, False, True,
    True,
    "these lines must RHYME and must not be the same word (doctrine 3: "
    "REPEAT is a violation inside a verse)")

#: Identity required. The refrain, the chorus return, the radif. Rhyme follows
#: from identity, so it is required too; REPEAT is not a violation here, it is
#: the requirement, and a pair that FAILS to be identical is the finding.
REQUIRE_RETURN = Requirement(
    "REQUIRE_RETURN", True, True, False,
    True,
    "this line must RETURN VERBATIM; REPEAT is the REQUIREMENT here "
    "(doctrine 3), and a non-identical return is the finding")

#: Rhyme required, REPEAT licensed, identity NOT declared. The honest value for
#: a return whose verbatim requirement the caller declined to state — and for
#: every pair that a return edge merged into a rhyme class without the two
#: lines corresponding to each other. `identity_required` is UNKNOWN and
#: propagates.
LICENSE_REPEAT = Requirement(
    "LICENSE_REPEAT", True, UNKNOWN, False,
    True,
    "these lines must RHYME and an identical word is LICENSED, but whether "
    "identity is REQUIRED was not declared — the unknown propagates "
    "(doctrine 28)")

#: Declared unmandated. The author has said, by writing different letters or by
#: leaving the line out of every group, that nothing is required here. An
#: observed rhyme IS reportable: that is what SCHEME_COLLISION is for.
FREE = Requirement(
    "FREE", False, False, UNKNOWN,
    True,
    "the mandate declares NO requirement here; an observed rhyme is a "
    "collision and an identical word is a question for the value layer, "
    "not for the mandate")

#: Out of the mandate's scope. NOT `FREE`. A mandate written over the chorus
#: says nothing about the verses, and reporting a verse rhyme as "unintended"
#: against it charges the writer for a question nobody asked (doctrine 20:
#: inconclusive by construction is not a null).
UNDECLARED = Requirement(
    "UNDECLARED", UNKNOWN, UNKNOWN, UNKNOWN,
    False,
    "the mandate does not reach this pair. This is 'cannot tell', not "
    "'nothing required' — see FREE for the other one (doctrine 28)")

#: The closed set, in strength order. A sixth value is a change to this list.
REQUIREMENTS = (REQUIRE_RETURN, REQUIRE_RHYME, LICENSE_REPEAT, FREE,
                UNDECLARED)


# ---------------------------------------------------------------------------
# THE RETURN — the one new primitive
#
# A RETURN CLASS is a set of line numbers that are THE SAME LINE. That is all.
# It is the generalisation of `RefrainScheme.refrains` off a single line class
# and onto any correspondence, and it is deliberately ONE primitive rather than
# two, because the two shapes a song actually has both reduce to it:
#
#   a villanelle refrain returning four times   -> one class {1, 6, 12, 18}
#   an eight-line chorus returning once         -> eight classes of two,
#                                                  {13,33} {14,34} ... {20,40}
#
# A return class states THREE things at once, which is exactly the three the
# mandate language could not say:
#
#   (a) IDENTITY   every pair inside it must be VERBATIM identical.
#   (b) LICENCE    REPEAT at every pair inside it is the REQUIREMENT, not a
#                  violation. Doctrine 3, per-pair at last.
#   (c) TRANSPORT  a line in a return class inherits the rhyme obligations of
#                  every OTHER member of that class. This is what dissolves the
#                  sixteen collisions: L33 is L13, L13 must rhyme with L17, so
#                  L33 must rhyme with L17 and it is not a coincidence.
#
# (c) is not optional reasoning, it is forced: identity is an equivalence
# relation and rhyme is a property of the words. Declaring (a) and denying (c)
# would be incoherent. The coordinate `ReturnRule.return_rhyme` exists anyway,
# because the interesting case is a return the author declares NON-verbatim.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Return:
    """A class of lines that are THE SAME LINE. >= 2 members, 1-based."""

    lines: tuple
    label: str = ""
    #: TRUE (must be verbatim), FALSE (a return that need only keep its rhyme),
    #: or `UNKNOWN` (the caller declines to say, and the unknown propagates).
    verbatim: object = True
    #: HOW this class was learnt, in words. A CLOSED LOOP as it stands: written
    #: by `parse_returns`, read only by `_normalise_returns` to build the
    #: merged class's own `origin`, and surfaced by nothing -- `describe()`
    #: prints the label and the verbatim state and not this. `Mandate.origin`
    #: is the one that reaches a report (`describe()`, and the CLI's MANDATE
    #: line); this per-CLASS provenance has no reader.
    origin: str = ""

    # A return class IS its lines, so `set(r)`, `for i in r` and `i in r` all
    # work on it directly. That is not sugar: `quality/revise.py` reads
    # `Mandate.returns` duck-typed, as `set(cls)` over each class, and a
    # dataclass that could only be reached through `.lines` would make the two
    # modules disagree about a name in the one place doctrine 78 says a
    # parallel round costs most. The richer object satisfies the plainer
    # contract rather than replacing it.
    def __iter__(self):
        return iter(self.lines)

    def __len__(self):
        return len(self.lines)

    def __contains__(self, line):
        return line in self.lines

    def pairs(self):
        return list(itertools.combinations(sorted(self.lines), 2))

    def describe(self):
        v = ("VERBATIM required" if self.verbatim is True else
             "verbatim NOT required — rhyme only" if self.verbatim is False
             else "verbatim requirement UNDECLARED (unknown propagates)")
        return f"{self.label or '(unlabelled)'}: lines {list(self.lines)} — {v}"


@dataclass(frozen=True)
class ReturnRule:
    """The declared coordinates of what a RETURN means. Doctrine 1.

    Both defaults are argued rather than assumed, and both alternatives are
    reachable so the choice is measurable rather than settled by fiat — the
    shape `overlap_rule` and `field_band` already use in `quality/revise.py`.
    """

    #: What an undecorated return declaration requires. "verbatim" — the
    #: returned line must come back word for word, and a drifted one is a
    #: FINDING. "rhyme" — the return need only keep its rhyme, and a changed
    #: word is licensed. "unknown" — the caller declines to say and every
    #: identity question at those pairs returns UNKNOWN.
    #:
    #: DEFAULT "verbatim", because a refrain that has drifted by a word is the
    #: commonest way a fixed form fails and it is INVISIBLE to every other
    #: check in this repo — the rhyme partition passes, the band passes, and
    #: the line that was supposed to come back did not. `check_identity` has
    #: said so since it was written. Defaulting to "rhyme" would make the
    #: language unable to state the requirement it exists to state.
    return_verbatim: str = "verbatim"

    #: How a return edge reaches the RHYME layer. "union" — each rhyme group
    #: is merged with the image of its members under the return, so the
    #: chorus's four classes become four classes spanning both instances.
    #: "positional" — only the corresponding pairs are mandated and the cross
    #: pairs stay FREE.
    #:
    #: DEFAULT "union", for the same reason `overlap_rule` defaults to
    #: conjunctive: it is STRICTLY STRONGER. Under "positional" the mandate
    #: would require five/five (an identity, trivially true) while leaving
    #: drive/alive unmandated — the projection defect one level down, where
    #: the pair that actually carries a risk is the one nobody checks.
    return_rhyme: str = "union"

    def __post_init__(self):
        if self.return_verbatim not in ("verbatim", "rhyme", "unknown"):
            raise NoMandate(
                f"return_verbatim must be 'verbatim', 'rhyme' or 'unknown'; "
                f"got {self.return_verbatim!r}")
        if self.return_rhyme not in ("union", "positional"):
            raise NoMandate(
                f"return_rhyme must be 'union' or 'positional'; got "
                f"{self.return_rhyme!r}")

    @property
    def default_verbatim(self):
        return {"verbatim": True, "rhyme": False,
                "unknown": UNKNOWN}[self.return_verbatim]


def parse_returns(text, n_lines=None, rule=None):
    """The text spelling of a return declaration -> [`Return`].

    Two forms, `;`-separated, each optionally `LABEL:`-prefixed:

      `33-40<=13-20`   a BLOCK return. Lines 33..40 are a return of 13..20,
                       aligned by position: 33 returns 13, 34 returns 14, and
                       so on. Expands to eight two-line classes. `<-` is an
                       accepted spelling of `<=`.
      `1,6,12,18`      a REFRAIN class: all four are the same line. This is
                       `RefrainScheme.refrains` written out, and
                       `parse_refrain` produces exactly this.

    A block whose two runs have DIFFERENT LENGTHS is a REFUSAL, not a zip
    truncated to the shorter one. Doctrine 20: a correspondence that cannot be
    established is not a weak correspondence, and silently dropping the tail
    would mandate nothing about the lines it dropped while looking as though
    it had.
    """
    rule = rule or ReturnRule()
    if isinstance(text, Return):
        return [text]
    out = []
    for k, chunk in enumerate(str(text).split(";")):
        chunk = chunk.strip()
        if not chunk:
            continue
        label = ""
        if ":" in chunk:
            label, chunk = (x.strip() for x in chunk.split(":", 1))
        body = chunk.replace("<-", "<=")
        if "<=" in body:
            tgt, src = (x.strip() for x in body.split("<=", 1))
            t, s = _run(tgt, body), _run(src, body)
            if len(t) != len(s):
                raise NoMandate(
                    f"the return {chunk!r} puts {len(t)} line(s) against "
                    f"{len(s)}. A return is a CORRESPONDENCE — line by line, "
                    f"in order — and one that cannot be established is a "
                    f"REFUSAL, not a zip cut to the shorter run (doctrine 20). "
                    f"If the return really is a different length, declare the "
                    f"classes that DO correspond, one per ';'.")
            if set(t) & set(s):
                raise NoMandate(
                    f"the return {chunk!r} has line(s) "
                    f"{sorted(set(t) & set(s))} on both sides. A line cannot "
                    f"be a return of itself.")
            for a, b in zip(s, t):
                out.append(Return(
                    lines=(a, b),
                    label=label or f"R{k + 1}",
                    verbatim=rule.default_verbatim,
                    origin=f"block return {chunk!r}"))
        else:
            mem = _run(body, body)
            if len(mem) < 2:
                raise NoMandate(
                    f"the return class {chunk!r} names {len(mem)} line(s). A "
                    f"return needs at least two: one line is not a return of "
                    f"anything, and declaring it mandates nothing while "
                    f"looking as though it does.")
            out.append(Return(lines=tuple(sorted(set(mem))),
                              label=label or f"R{k + 1}",
                              verbatim=rule.default_verbatim,
                              origin=f"return class {chunk!r}"))
    if not out:
        raise NoMandate(
            f"{text!r} declares no return. Use `33-40<=13-20` for a block "
            f"return or `1,6,12,18` for a refrain class.")
    if n_lines is not None:
        for r in out:
            for i in r.lines:
                if not 1 <= i <= n_lines:
                    raise NoMandate(
                        f"return line {i} is outside 1..{n_lines}. Return line "
                        f"numbers are 1-BASED over the WHOLE song, for the "
                        f"same reason mandate groups are.")
    return out


def _run(text, whole):
    """'13-20' or '1,6,12,18' or '13-16,19' -> [ints], in written order."""
    out = []
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            if "-" in part:
                a, b = (int(x) for x in part.split("-", 1))
                out.extend(range(a, b + 1) if a <= b else range(a, b - 1, -1))
            else:
                out.append(int(part))
        except ValueError:
            raise NoMandate(
                f"{part!r} in {whole!r} is not a line number or a `a-b` run.")
    return out


def _normalise_returns(raw, n_lines, rule):
    """-> tuple of `Return`, transitively closed, or RAISE.

    Identity is an EQUIVALENCE RELATION, so two declared classes that share a
    line are one class: `{13,33}` and `{33,53}` force `{13,33,53}`. Merging
    them is not a degradation, it is the arithmetic. What IS refused is a merge
    whose parts carry CONTRADICTORY verbatim declarations — two statements that
    cannot both hold, which doctrine 20 says to refuse loudly rather than
    resolve by whichever was declared last.
    """
    items = []
    for r in raw:
        if isinstance(r, Return):
            items.append(r)
        elif isinstance(r, str):
            items.extend(parse_returns(r, n_lines, rule))
        else:
            mem = sorted({int(x) for x in r})
            if len(mem) < 2:
                raise NoMandate(
                    f"return class {list(r)!r} has fewer than two lines; a "
                    f"line is not a return of anything on its own.")
            items.append(Return(lines=tuple(mem), label="",
                                verbatim=rule.default_verbatim,
                                origin="declared return class"))
    for r in items:
        for i in r.lines:
            if not 1 <= i <= n_lines:
                raise NoMandate(
                    f"return line {i} is outside 1..{n_lines}.")

    # union-find over the declared classes
    parent = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for r in items:
        first = r.lines[0]
        for i in r.lines[1:]:
            union(first, i)

    buckets = {}
    for r in items:
        buckets.setdefault(find(r.lines[0]), []).append(r)

    merged = []
    for root, group in sorted(buckets.items()):
        lines = tuple(sorted({i for r in group for i in r.lines}))
        marks = {r.verbatim for r in group}
        if len(marks) > 1:
            raise NoMandate(
                f"lines {list(lines)} are transitively ONE return class "
                f"(identity is an equivalence relation), and the declarations "
                f"that produced it disagree about whether it must be "
                f"VERBATIM: {sorted(str(m) for m in marks)}. Two requirements "
                f"that cannot both hold are a REFUSAL, not a tie broken by "
                f"declaration order (doctrine 20; and a tie broken by "
                f"iterating a set is doctrine 66).")
        labels = sorted({r.label for r in group if r.label})
        merged.append(Return(
            lines=lines,
            label="+".join(labels) if labels else "",
            verbatim=group[0].verbatim,
            origin="; ".join(sorted({r.origin for r in group if r.origin}))))
    return tuple(merged)


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


#: The slot layer's refusal, re-exported under the name this module
#: raises so a caller catching `NoMandate` still catches a placement
#: that cannot be graded. It is `slots.SlotUnsupported`, aliased and not
#: re-declared: two exception classes for one refusal is how a caller
#: ends up catching the wrong one (doctrine 1).
from quality.slots import SlotUnsupported as SlotRefused  # noqa: E402


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
    #: declared structure NAME per group, index-aligned with `groups` — the
    #: catalog row (quality/structures.py) each group's pairs are judged
    #: under. `()` or a "" slot means the DEFAULT (English end-rhyme, the
    #: scalar comparator + Declaration.admit). Names are validated at
    #: `mandate()` time, not here: a dataclass default must stay cheap and a
    #: frozen instance built by code that bypassed `mandate()` still answers
    #: through `structure_of`, which resolves absence to the default.
    structures: tuple = ()
    #: declared RELATION per group, index-aligned with `groups` — WHAT
    #: relation a pair in that group must stand in. `()` or a "" slot means
    #: the DEFAULT: the coarse `Declaration.admit` set, the historical path,
    #: byte-for-byte. Added 2026-08-22.
    #:
    #: WHY THIS EXISTS AND WHY IT IS NOT A WIDER GLOBAL SET. `admits()` is
    #: ONE set answering "what counts as satisfying ANY rhyme mandate
    #: anywhere" — two members by default, four by an explicit
    #: `Declaration.admit`. Widening THAT would make every rhyme requirement
    #: in every song satisfiable by assonance: looser, not richer. A
    #: per-group relation is richer AND STRICTER — a group declaring
    #: `CONSONANCE` is not satisfied by a perfect rhyme unless it says so.
    #:
    #: THE VOCABULARY IS `quality.rhyme_types.relation_vocabulary()`: the 4
    #: coarse classes, judged free from the score, and the named types, which
    #: cost one `classify_pair` (~1.3 ms/pair, measured) and are paid for
    #: ONLY by groups that declare one — the same lazy discipline
    #: `structures` uses.
    #:
    #: A GROUP MAY NOT DECLARE BOTH a structure and a relation: that is two
    #: judges for one group, and `mandate()` refuses it (doctrine 1).
    relations: tuple = ()
    #: THE MANDATE-LEVEL RELATION, and the route `relations` becomes the
    #: DEFAULT by (owner's instruction 2026-08-22, "wire Mandate.relations as
    #: the default route").
    #:
    #: `relations` is per GROUP, so declaring one named relation over a whole
    #: song meant repeating it once per group and re-repeating it whenever a
    #: group was added -- a declaration that has to be maintained in n places
    #: is one that will disagree with itself. This is the same name declared
    #: ONCE, and `relation_of` falls back to it for every group that does not
    #: override.
    #:
    #: RESOLUTION ORDER, and it is the only order that lets a song be mostly
    #: one relation with exceptions: the group's own `relations[k]`, else this,
    #: else "" -- which still means the coarse `Declaration.admit` path, so a
    #: mandate that declares neither is byte-for-byte the old object.
    #:
    #: Validated at DECLARATION time through the same `resolve_relation` every
    #: per-group name goes through, so a typo refuses when the mandate is
    #: written rather than answering a different question at grade time.
    default_relation: str = ""
    #: WHERE IN EACH LINE THE GROUP BINDS — index-aligned with `groups`, and
    #: the coordinate that stops this layer being end-rhyme-only (2026-08-23,
    #: owner ruling: *"there's just no way that we can only be contemplating
    #: the last word of every line"*).
    #:
    #: Entry k is `""` — every member of group k binds at the DEFAULT slot,
    #: the end of its line — or a tuple index-aligned with `groups[k]`'s own
    #: (sorted) members, each entry a `quality.slots.Slot` or None for the
    #: default. Absence has ONE meaning, so every mandate ever written or
    #: stored reads exactly as it always did (doctrine 66), and
    #: `slot_of` resolves the absence rather than each caller doing it.
    #:
    #: WHY A PARALLEL TUPLE rather than richer members: a group is a tuple of
    #: 1-based line numbers and about sixty sites take that literally —
    #: `min()`, `max()`, `sorted()`, `matrix[i - 1][j - 1]`, the
    #: `range(1, n + 1)` complement that computes `free`, and
    #: `_normalise_groups`' own `int()` coercion. This is the convention
    #: `structures` and `relations` already use, for the same reason.
    loci: tuple = ()
    #: 1-based lines in no group at all -- declared free, mandating nothing
    free: tuple = ()
    source: str = "declared"          # "declared" | "derived"
    origin: str = ""                  # how it was obtained, in words

    #: RETURN CLASSES -- lines that are THE SAME LINE. The second requirement
    #: the language could not state. Empty is the old object exactly.
    returns: tuple = ()
    #: The lines this mandate SPEAKS ABOUT. `()` means all of 1..n_lines.
    #: A pair touching a line outside it is `UNDECLARED`, not `FREE`
    #: (doctrine 28). A mandate written over a chorus says NOTHING about the
    #: verses, and reporting a verse rhyme as unintended against it charges
    #: the writer for a question that was never asked.
    #: NEVER GIVEN A NON-EMPTY VALUE ON ANY PRODUCTION PATH -- no CLI verb
    #: spells it and `Reviser.mandate()` forwards no `scope=`. `in_scope()`
    #: is read (see there); this field is what is unreached, and the one
    #: report it would change (`grade()`'s collision loop) does not ask.
    scope: tuple = ()
    #: the declared coordinates of what a return MEANS (doctrine 1)
    rule: "ReturnRule" = field(default_factory=lambda: ReturnRule())

    # -- what it requires -------------------------------------------------

    def structure_of(self, group_index):
        """-> the declared structure NAME for one group (the catalog row a
        pair in that group is judged under). Undeclared means the default:
        `quality/structures.DEFAULT`, English end-rhyme, the scalar
        comparator's own path — so every mandate that never learned the
        coordinate behaves byte-for-byte as it always has.

        `structures` is index-aligned with `groups`, the same convention
        `labels` uses; a shorter tuple reads as default for the tail, so a
        mandate widened by one group does not silently shift every later
        group's declaration (doctrine 66 — alignment by INDEX is only
        stable when absence has one meaning, and here absence = default)."""
        if group_index < len(self.structures) and \
                self.structures[group_index]:
            return self.structures[group_index]
        from quality import structures as _ST
        return _ST.DEFAULT

    def __post_init__(self):
        """VALIDATE THE MANDATE-LEVEL RELATION AT DECLARATION TIME.

        The per-group `relations` are resolved by `_normalise_relations` on
        the `mandate()` path, but `Mandate` is also constructed directly --
        by `plan.py`, by tests, by any caller holding groups already -- so a
        `default_relation` validated only in the factory would be unchecked on
        every direct construction.  It is checked HERE, which is the one place
        every construction passes through.

        A name that does not resolve refuses the MANDATE, not the pair: a
        relation that does not exist, silently graded as the coarse default,
        is a different question answered without saying so (doctrine 20), and
        that is worse at declaration time than at grade time because the
        writer is still holding the sentence they got wrong.
        """
        if self.default_relation:
            from quality import rhyme_types as _RT
            object.__setattr__(self, "default_relation",
                               _resolve_relation(_RT, self.default_relation))

    def relation_of(self, group_index):
        """-> the declared relation NAME for one group, or "" for default.

        `relations` is index-aligned with `groups`, the same convention
        `labels` and `structures` use, and a shorter tuple reads as default
        for the tail. Absence has ONE meaning here — the historical
        `Declaration.admit` path — so a mandate widened by one group does not
        silently shift every later group's declaration (doctrine 66).

        Unlike `structure_of` this returns "" rather than a default NAME,
        because the default is not a row in this vocabulary: it is the coarse
        admit SET, which is a different kind of object. Saying so with "" is
        honest; inventing a name for it would put a fifth thing in a
        four-name table."""
        if group_index < len(self.relations) and self.relations[group_index]:
            return self.relations[group_index]
        # THE MANDATE-LEVEL DEFAULT (2026-08-22).  A group that declares
        # nothing takes the song's relation if one was declared; only a
        # mandate declaring NEITHER falls through to the coarse admit set, so
        # every caller that never learned this field is unaffected.
        return self.default_relation or ""

    def slot_of(self, group_index, line):
        """-> the `Slot` one LINE binds at inside one GROUP.

        The resolution of `loci`'s absences, done HERE so no caller repeats it
        (doctrine 1): an undeclared group, an undeclared member, or a `None`
        entry all mean the default slot — the end of that line — which is
        what a bare line number has always meant.

        A line that is not in the group raises, rather than answering with a
        default: "this line binds at the end" and "this line is not in this
        group" are different facts and returning one for the other is how a
        grader ends up scoring a pair nobody declared (doctrine 20).
        """
        from quality import slots as _SL
        g = self.groups[group_index]
        if line not in g:
            raise NoMandate(
                f"L{line} is not in group {self.labels[group_index]} "
                f"{list(g)} — a slot is a place a MEMBER binds at, so asking "
                f"for a non-member's slot is asking about a requirement that "
                f"does not exist.")
        if group_index < len(self.loci):
            place = self.loci[group_index]
            if place:
                slot = place[g.index(line)]
                if slot is not None:
                    return slot
        return _SL.as_slot(line)

    def slots_declared(self):
        """-> True when ANY group binds anywhere but its lines' ends.

        The one question a caller asks to decide whether it must take the slot
        path at all, so the byte-identical fast path for an ordinary
        end-rhyme mandate is a property of the object rather than a guess at
        each call site.
        """
        return any(bool(p) for p in self.loci)

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

    # -- returns: the second and third statements -------------------------

    def in_scope(self, line):
        """Does the mandate SPEAK about this line? Empty scope means all.

        WHO READS THIS, since an audit called it declared-but-unread and it is
        not: `requirement()` below, on every pair, and `requirement()` is on
        the grading spine -- `quality/revise.py`'s `grade()` (per REPEAT pair)
        and `inspect()` (per repeat finding) both call it, so one
        `grade()`+`inspect()` pass over a 19-line villanelle reaches this
        method 120 times. `quality/test_mandate_language.py` §11 pins that
        rather than leaving it to prose (doctrine 48).

        WHAT IS UNREACHED is the OTHER half: `Mandate.scope` is never given a
        non-empty value on any production path. `Reviser.mandate()` is
        `SC.mandate(spec, n_lines=...)` and forwards no `scope=`, and no CLI
        verb spells it, so in production this always answers True and
        `UNDECLARED` is never returned. A Python-API caller CAN reach it by
        handing `brief`/`inspect`/`verify` a pre-built `Mandate` (the same and
        only route `returns=` had before `--returns=` existed).

        AND THE ONE PLACE IT WOULD CHANGE A REAL RUN STILL DOES NOT ASK.
        `grade()`'s collision loop reports every pair at or above
        `THETA_COLLISION` that shares no group, without consulting the
        mandate's scope -- so on this repo's own 41-line fixture, scoped to
        its chorus, 49 of the 73 collisions touch a line the mandate says it
        does not speak about and are reported as `SCHEME_COLLISION` anyway.
        That is exactly what `UNDECLARED`'s own gloss forbids: charging the
        writer for a question nobody asked (doctrine 20).
        """
        return (not self.scope) or line in self.scope

    def return_of(self, line):
        """-> the `Return` class containing `line`, or None."""
        for r in self.returns:
            if line in r.lines:
                return r
        return None

    def return_pairs(self):
        """-> [(i, j, Return)] every pair the mandate says is the SAME LINE.

        These are the REPEAT relations doctrine 3 calls a violation inside a
        verse and the requirement here. Handing them to a rhyme grader with no
        label would flag every correct refrain, which is precisely what was
        happening: 7 of this song's 16 chorus collisions are REPEAT on an
        identical word.

        SKIPS an element of `self.returns` that is not a `Return` object.
        `_declared_return` in `quality/revise.py` documents that the OLDER
        duck-typed shape -- a bare iterable of line numbers, no verbatim flag,
        no label -- is still an accepted way to populate this field (a caller
        may write `dataclasses.replace(m, returns=((13, 33), ...))` to state
        only WHICH lines are one class, same as `test_revise.py` does, for a
        check that only ever asked `set(cls)`). This method asks MORE of each
        entry than that shape carries -- whether the return is verbatim is
        exactly what a bare tuple does not say -- so it cannot report a pair
        from one and skipping is the honest answer, not a raise: the mandate
        did not fail to declare a requirement, it declared one in a shape this
        method cannot read yet.
        """
        out = []
        for r in self.returns:
            if not hasattr(r, "pairs"):
                continue
            for i, j in r.pairs():
                out.append((i, j, r))
        return sorted(out, key=lambda t: (t[0], t[1]))

    def identity_pairs(self):
        """-> [(i, j, label)] pairs that must be VERBATIM. Skips returns
        declared non-verbatim or undeclared -- those mandate no identity."""
        return [(i, j, r.label) for i, j, r in self.return_pairs()
                if r.verbatim is True]

    def expanded_groups(self):
        """-> the rhyme groups with each return's class merged in.

        THE ONE COMPUTATION THAT DISSOLVES THE NOISE. L33 IS L13, and L13 must
        rhyme with L17, so L33 must rhyme with L17 and it is not a collision.
        Under `return_rhyme="positional"` the groups are returned untouched and
        each return class is added as a group of its own instead.

        Kept as a DERIVED VIEW rather than folded into `groups`, so
        `to_letters()` still reports the letters the author wrote and the
        expansion is visible as a separate object (doctrine 2: say that the
        projection is a projection).

        Reads EITHER shape `self.returns` may hold: a `Return` object's
        `.lines`, or the older duck-typed bare iterable of line numbers
        `_declared_return` (`quality/revise.py`) already accepts -- a class
        with no verbatim flag still says WHICH lines are one class, which is
        all this method's own merge needs.
        """
        if not self.returns:
            return tuple(self.groups)
        rlines = [getattr(r, "lines", r) for r in self.returns]
        if self.rule.return_rhyme == "positional":
            seen, out = set(), []
            for g in list(self.groups) + rlines:
                key = tuple(sorted(set(g)))
                if key not in seen:
                    seen.add(key)
                    out.append(key)
            return tuple(out)
        cls = {}
        for lines_ in rlines:
            for i in lines_:
                cls[i] = lines_
        seen, out = set(), []
        for g in self.groups:
            wide = set(g)
            for i in g:
                wide |= set(cls.get(i, ()))
            key = tuple(sorted(wide))
            if key not in seen:
                seen.add(key)
                out.append(key)
        for lines_ in rlines:                   # a return with no rhyme group
            if not any(set(lines_) <= set(g) for g in out):
                key = tuple(sorted(lines_))
                if key not in seen:
                    seen.add(key)
                    out.append(key)
        return tuple(out)

    def expanded_pairs(self):
        """-> sorted DISTINCT 1-based (i, j) over `expanded_groups()`."""
        out = set()
        for g in self.expanded_groups():
            for a in range(len(g)):
                for b in range(a + 1, len(g)):
                    out.add((g[a], g[b]))
        return sorted(out)

    def requirement(self, i, j):
        """-> one of the five `Requirement` singletons. THE mechanical answer.

        This is the whole point of the object. One call, one value out of a
        closed set, and every tri-state inside it raises rather than reads
        false. A caller can no longer collapse "these must rhyme", "this must
        return", "nothing is required" and "I was not asked" into one boolean,
        because there is no boolean to collapse them into.
        """
        if i == j:
            raise NoMandate(
                f"a requirement is a statement about TWO lines; L{i} was "
                f"given twice.")
        a, b = (i, j) if i < j else (j, i)
        if not (1 <= a and b <= self.n_lines):
            raise NoMandate(
                f"L{a}/L{b} is outside 1..{self.n_lines}; a requirement can "
                f"only be asked of lines the mandate is written over.")
        if not (self.in_scope(a) and self.in_scope(b)):
            return UNDECLARED
        r = self.return_of(a)
        if r is not None and b in r.lines:
            if r.verbatim is True:
                return REQUIRE_RETURN
            if r.verbatim is False:
                return LICENSE_REPEAT
            return LICENSE_REPEAT              # UNKNOWN verbatim, same value
        if not any(a in g and b in g for g in self.expanded_groups()):
            return FREE
        # In a shared group. THE LICENCE TRANSPORTS THROUGH THE RETURN, which
        # is the whole reason a return is not merely a bigger group: L37 IS
        # L17, and L13/L17 is a pair the mandate says must RHYME and must not
        # repeat, so L13/L37 inherits that and an identical word there is
        # still a violation. Ask the question of the REPRESENTATIVES.
        ra, rb = self._rep(a), self._rep(b)
        if ra != rb and any(ra in g and rb in g for g in self.groups):
            return REQUIRE_RHYME
        if any(a in g and b in g for g in self.groups):
            return REQUIRE_RHYME
        # In an expanded group, but no declared group holds the two
        # representatives: the mandate put these lines in one rhyme class
        # without ever saying whether an identical word between them is a
        # defect. UNKNOWN, and it propagates (doctrine 28).
        return LICENSE_REPEAT

    def _rep(self, line):
        """-> the first line of `line`'s return class, or `line` itself.

        Identity's canonical member. Every question about a returned line is
        really a question about the line it returns."""
        r = self.return_of(line)
        return min(r.lines) if r is not None else line

    def repeat_is_violation(self, i, j):
        """-> True / False / `UNKNOWN`. Doctrine 3, per PAIR.

        The song-wide `repeat_licence` switch had two settings and needed
        three answers: "unlicensed" flags all seven correct chorus returns on
        this repo's own song, and "refrain" licenses every REPEAT in the lyric
        INCLUDING one inside a verse, which is the defect the flag exists to
        catch. A per-song switch cannot express a per-pair inversion.

        THE GRADER DOES NOT CALL THIS METHOD. `quality/revise.py` reads the
        FIELD instead -- `m.requirement(i, j).decided("repeat_is_violation")`,
        at `grade()` and again at `inspect()` -- because it needs the
        (is_declared, value) pair and not just the tri-state. So this method
        is the DOCUMENTED spelling of a decision the production path takes
        through `Requirement`, and the two can drift silently: changing this
        method alone would leave every test in
        `quality/test_mandate_language.py` green and change nothing about a
        real grading run. §11 of that file pins them equal at every pair,
        which is the only thing that stops the drift (doctrine 48).
        """
        return self.requirement(i, j).repeat_is_violation

    def returns_check(self, lines, variation=True):
        """-> findings for return pairs that are not what the mandate says.

        THE FIXTURE FOR DOCTRINE 94: this makes a zero (collisions -> 0) and
        it has to be able to fire on real content, not just be assumed clean.
        It does. Four of the eight declared returns in the shipped fixture
        (`quality/fixtures/mandate_song.txt`) are NOT verbatim -- L14/L34,
        L15/L35, L16/L36 and L20/L40 -- and each comes back as a NAMED KIND of
        variation from `quality.grid.compare_returns` rather than a boolean,
        because a return that keeps its rhyme and changes a word is a move and
        a broken refrain is a defect, and doctrine 24 says name them apart.

        Returns declared non-verbatim or UNDECLARED are skipped and reported
        as skipped: the mandate does not require identity there, so silence
        about them would be an answer the mandate never gave.

        `OUT_OF_RANGE` IS THE ONE MEMBER OF THIS OUTPUT THAT REPORTS A MANDATE
        THAT COULD NOT BE READ rather than a return that came back wrong, and
        until 2026-08-13 its message NAMED A CONDITION THIS GUARD DOES NOT
        TEST. The guard tests a return LINE INDEX against `len(lines)`; the
        message said "the mandate declares N lines and M were given" — a
        LENGTH MISMATCH between mandate and draft, which `Reviser.mandate`
        (`SC.mandate(spec, n_lines=len(lines))`) refuses with `NoMandate`
        several frames earlier, so no `Reviser.inspect()` call can reach this
        branch by that route at all. On the input that DOES reach it — a
        `Mandate` assembled around `_normalise_returns` (`dataclasses.replace`,
        direct construction) carrying a `Return` outside its OWN 1..n_lines —
        the old message printed "the mandate declares 4 lines and 4 were
        given", which names nothing: the two numbers agree and the defect is
        the index. It now names the OFFENDING LINE, says which of the two ways
        it got out of range (doctrine 79: charge the right layer — a hand-built
        mandate and a short draft need different repairs), and says the
        verbatim requirement was NOT CHECKED rather than leaving a reader to
        infer a clean pass from a finding about something else (doctrine 20).

        AND THAT FIX CLOSED THE MISLEADING HALF AND LEFT THE GENEROUS HALF
        STANDING — closed 2026-08-13, one lot later, by the lot that had named
        it. THE DRAFT HAS TO BE THE POEM THE MANDATE NUMBERS. Every finding
        below is positional — "the mandate's L5 is the draft's fifth line" —
        and `self.n_lines` comes from the MANDATE while `len(lines)` comes from
        the DRAFT. An index guard cannot see the two disagree: it only ever
        asks whether a RETURN LINE falls past the draft, so a mandate whose
        returns all land INSIDE a short draft tripped nothing and reported
        nothing at all.

            S.mandate([[1, 3]], n_lines=6,
                      returns=[[1, 3]]).returns_check(['x', 'b', 'x'])  ->  []

        Six lines declared, three given, L1/L3 verbatim, and the 6-vs-3
        disagreement never mentioned. MEASURED over `REFRAIN_FORMS` put through
        `RefrainScheme.to_mandate` and handed a one-line-short draft whose
        returns all HOLD: exactly ONE of the eight — `pantoum quatrain pair`,
        whose last return line is 7 of 8 — returned `[]`. The other seven close
        ON a returning line, so their index guard fires anyway and covers for
        the missing check. That is the same one-in-eight
        `RefrainScheme.check_identity` measures, on the same registry, because
        it is the same defect on the twin surface. Doctrine 94: no positive
        case can find it either, because every positive case hands over a draft
        of exactly the right length. And the OVER-LONG direction — a draft
        LONGER than the mandate numbers, where a title line shifts every line
        number down — no index guard can EVER reach.

        UNREACHABLE FROM `Reviser.inspect()`, AND THAT IS A PROOF RATHER THAN A
        CLAIM. `inspect()` calls `m.returns_check(lines)` on `m =
        self.mandate(lines, mandate)`, which is `SC.mandate(spec,
        n_lines=len(lines))`; with `n_lines` non-None EVERY branch of `mandate`
        either returns an object whose `n_lines` IS that argument or raises
        `NoMandate` (the `Mandate`, `Cover`, letter-string, RGS and
        `RefrainScheme` branches each compare and refuse; the group-list and
        re-open branches assign `n = n_lines` outright). So `n == self.n_lines`
        there by construction and the `LINE_COUNT` branch is dead on that path.
        `quality/test_mandate_language.py` §15 walks the branches rather than
        asserting this. WHAT WOULD MAKE IT FIRE: a caller reaching
        `returns_check` without going through `Reviser.mandate` (this method is
        public), or `Reviser.mandate` learning to accept a length mismatch
        instead of refusing it. Either one needs `quality/revise.py`'s loop
        over this output to grow a `LINE_COUNT` branch FIRST — it currently
        routes every kind but `OUT_OF_RANGE` into `add(j,
        Finding("RETURN_NOT_VERBATIM", "flag", ...))`, and this finding's `j`
        is `None` because a length disagreement names no pair. It belongs in
        `whole` as a NOTE, beside
        `RETURN_OUT_OF_RANGE`: it says which question could be asked, not that
        a line is wrong, and doctrine 6/7 keep a disclosure out of the gate.

        Both halves are now phrased the way `RefrainScheme.check_identity`
        phrases its own, so the two surfaces cannot drift: the length
        disagreement is its own `LINE_COUNT` finding that says how many
        requirements were graded on the positional reading ANYWAY and are
        conditional on it (doctrine 79's counts, declared / graded / not
        reached, never summed), and it says the assumption out loud rather than
        letting silence read as a pass (doctrine 20). It is NOT gated on the
        mandate having any return at all — gating it would put the silence back
        for every rhyme-only mandate, and this is the only method on `Mandate`
        that is shown the draft.
        """
        from quality.grid import compare_returns, normalise_line
        out = []
        n = len(lines)
        declared = self.return_pairs()
        # The pairs this method GRADES. Non-verbatim and UNKNOWN returns are
        # skipped by the loop below and are a THIRD count in the message, never
        # folded into either of the other two: the mandate did not require
        # identity there, so they are neither graded nor blocked by a short
        # draft (doctrine 79). `undeclared_returns()` is where those are asked.
        #
        # COMPUTED BESIDE THE LOOP RATHER THAN REPLACING IT. Folding this
        # predicate into the loop header — `for i, j, r in [... if r.verbatim
        # is True]` — reads better and DISARMS `quality/mutate.py`'s QS3,
        # whose anchor is the literal `if r.verbatim is not True:` / `continue`
        # two blocks down. `apply_mutation` raises on a stale anchor and
        # `--dry-run` prints STALE, so it is loud rather than silent — but
        # nothing in the regression sweep runs either, so adversary 4 would
        # have lost a member to a tidier line until the next mutation sweep.
        # Measured, not assumed: the first draft of this fix took QS3's `old=`
        # string from 1 to 0, and `quality/test_mandate_language.py` §15b
        # step 4 now pins all five where the sweep will see it.
        pairs = [(i, j) for i, j, r in declared if r.verbatim is True]
        if n != self.n_lines:
            unchecked = sum(1 for i, j in pairs if i > n or j > n)
            lo, hi = ((n + 1, self.n_lines) if n < self.n_lines
                      else (self.n_lines + 1, n))
            span, was = ((f"L{lo}", "was") if lo == hi
                         else (f"L{lo}..L{hi}", "were"))
            how = (f"{span} {was} never given" if n < self.n_lines else
                   f"{span} {'is' if was == 'was' else 'are'} past the "
                   f"mandate's last line")
            out.append((None, None, None, "LINE_COUNT",
                        f"the mandate numbers {self.n_lines} lines and {n} "
                        f"were given — {how}, so the draft's line k is not "
                        f"known to be the mandate's line k and every identity "
                        f"finding here is positional. Of {len(declared)} "
                        f"declared return pair(s): {len(pairs) - unchecked} "
                        f"graded on that reading ANYWAY and conditional on "
                        f"it, {unchecked} naming a line past the draft and "
                        f"NOT CHECKED, {len(declared) - len(pairs)} declared "
                        f"non-verbatim or UNKNOWN and never graded here. This "
                        f"is the assumption said out loud, not a clean pass "
                        f"(doctrine 20)"))
        for i, j, r in declared:
            if r.verbatim is not True:
                continue
            if i > n or j > n:
                bad = [x for x in (i, j) if x > n]
                names = "L" + ", L".join(str(x) for x in bad)
                # WHICH of the two disagreements this is, said out loud. Past
                # `self.n_lines` -> the RETURN is outside the mandate's own
                # declaration, the one input `_normalise_returns` exists to
                # raise on, reached by going around it; this is the only route
                # that reaches `Reviser.inspect()`. Inside 1..n_lines and past
                # `len(lines)` -> the DRAFT is short, reachable only by calling
                # this method directly.
                why = (f"and {names} is outside the mandate's own "
                       f"1..{self.n_lines} — this return was built around the "
                       f"constructor that refuses it"
                       if any(x > self.n_lines for x in bad) else
                       f"though {names} is inside the mandate's own "
                       f"1..{self.n_lines} — the DRAFT is short")
                out.append((r.label, i, j, "OUT_OF_RANGE",
                            f"return {r.label or '(unlabelled)'} names "
                            f"{names}, past the {n} line(s) given, "
                            f"{why}. The verbatim requirement at L{i}/L{j} "
                            f"was NOT CHECKED — unasked, not answered clean "
                            f"(doctrine 20)"))
                continue
            a, b = lines[i - 1], lines[j - 1]
            if normalise_line(a) == normalise_line(b):
                continue
            kind = (compare_returns([a], [b]).kind if variation
                    else "NOT_VERBATIM")
            out.append((r.label, i, j, kind,
                        f"return {r.label} must come back VERBATIM: "
                        f"L{i} {a!r} vs L{j} {b!r}"))
        return out

    def undeclared_returns(self):
        """-> return pairs whose verbatim requirement is UNKNOWN.

        Doctrine 20 in report shape: a caller must be able to tell "checked
        and identical" from "never asked". These were never asked."""
        return [(i, j, r.label) for i, j, r in self.return_pairs()
                if r.verbatim is UNKNOWN]

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

    def rhyme_partition_groups(self):
        """-> the groups whose PAIRS the mandate requires to rhyme.

        The expansion, not the declaration. Writing `13-20` and
        `33-40<=13-20` does not leave L33..L40 unrhymed -- L33 IS L13, so it
        is in L13's class -- and a projection built off the declared groups
        alone would report exactly that, which is the same silent drop the
        return primitive exists to stop.
        """
        return self.expanded_groups()

    def expanded_overlapping_lines(self):
        """Pivots AFTER the returns are transported. A declaration can be a
        partition and its expansion a genuine cover -- two sections that
        return into each other's rhyme classes -- and the letters have to
        refuse on the object they are actually projecting."""
        count = {}
        for g in self.expanded_groups():
            for i in g:
                count[i] = count.get(i, 0) + 1
        return sorted(i for i, c in count.items() if c > 1)

    def to_rhyme_letters(self):
        """-> the letter string of the RHYME layer, or None when none exists.

        NAMED for what it drops. None is the doctrine 2 answer and it is not a
        failure: an overlapping cover has no letter representation, and
        inventing one would delete the overlap that makes it what it is. What
        this one ALSO drops, when `returns` is non-empty, is every identity
        requirement -- which is why the honest spelling of "give me the
        letters" is `to_letters()`, and it refuses.
        """
        groups = self.expanded_groups()
        if self.expanded_overlapping_lines():
            return None
        out = ["X"] * self.n_lines
        for k, g in enumerate(groups):
            lab = self.labels[k] if k < len(self.labels) else label((k,))
            for i in g:
                out[i - 1] = lab
        return "".join(out)

    def to_letters(self):
        """-> the letter string, None if it overlaps, or REFUSE if it returns.

        DOCTRINE 20: A REFUSAL IS NOT A NULL, AND IT IS NOT A DEGRADED ANSWER
        EITHER. A letter is a property of a LINE and it has exactly one thing
        to say -- which rhyme class. It cannot say "and this line is that line
        come back", so a mandate carrying returns has no letter string, and
        handing one back would be the projection quietly deleting the
        requirement all over again. That deletion is not hypothetical: it is
        the measured 16 collisions this module's return primitive exists to
        dissolve.

        `to_rhyme_letters()` is the same projection with the loss in its name,
        and `to_notation()` is the A-1 notation, which CAN carry a verbatim
        return and is what to reach for instead.
        """
        if self.returns:
            raise NoMandate(
                f"this mandate declares {len(self.returns)} return class(es) "
                f"and there is no letter string for it. A letter is a "
                f"property of a LINE and says one thing -- which rhyme class; "
                f"it has no way to say that L{self.returns[0].lines[-1]} IS "
                f"L{self.returns[0].lines[0]} come back. Degrading to letters "
                f"here would silently drop "
                f"{len(self.return_pairs())} identity requirement(s), which "
                f"is exactly the deletion the return primitive exists to "
                f"undo, so this REFUSES instead (doctrine 20).\n"
                f"  `to_notation()`      -> the A-1 notation, which carries "
                f"verbatim returns\n"
                f"  `to_rhyme_letters()` -> the rhyme projection, with the "
                f"loss named")
        return self.to_rhyme_letters()

    def to_code(self):
        """-> canonical RGS of the RHYME layer, or None if it overlaps.

        The rhyme projection deliberately, and it says so: `Coordinates` is a
        description of a rhyme partition and has never had a place to put an
        identity requirement.
        """
        letters = self.to_rhyme_letters()
        return None if letters is None else parse(letters)

    def coordinates(self, sections=None):
        code = self.to_code()
        return None if code is None else coordinates(code, sections)

    def to_notation(self):
        """-> the A-1 refrain notation string, or REFUSE with the reason.

        The A-1 notation already ships (`parse_refrain`, `refrain villanelle`)
        and a CAPITAL in it means a line that must come back VERBATIM, so it
        can carry statements 1 and 2 of the three. It cannot carry statement 3
        in general -- a return the author declares NON-verbatim has no mark in
        it, because the only mark it has is "must be identical" -- and it
        cannot carry an overlapping cover at all, because its rhyme layer is
        still one letter per line.

        Both of those REFUSE and name themselves. Neither degrades.
        """
        if self.expanded_overlapping_lines():
            raise NoMandate(
                f"lines {self.expanded_overlapping_lines()} are in more than "
                f"one rhyme group, and the A-1 notation's rhyme layer is still "
                f"ONE LETTER PER LINE. There is no notation for this structure "
                f"(doctrine 2); the `Mandate` itself is the object.")
        soft = [r for r in self.returns if r.verbatim is not True]
        if soft:
            raise NoMandate(
                f"return class(es) "
                f"{[list(r.lines) for r in soft]} are declared with "
                f"verbatim={soft[0].verbatim!r}. The A-1 notation's ONLY mark "
                f"is a capital, which means MUST BE VERBATIM; a return that "
                f"keeps its rhyme and changes its word, and a return whose "
                f"identity requirement was never declared, both have no mark "
                f"in it. Writing them as capitals would state a requirement "
                f"nobody made and writing them as lowercase would drop one "
                f"that was made, so this REFUSES (doctrine 20).")
        letters = self.to_rhyme_letters()
        cls = {}
        for r in self.returns:
            for i in r.lines:
                cls[i] = r
        # one index per return class, numbered per rhyme letter in line order
        counter, mark_of = {}, {}
        out = []
        for i in range(1, self.n_lines + 1):
            ch = letters[i - 1]
            r = cls.get(i)
            if r is None:
                out.append(ch.lower() if ch != "X" else "X")
                continue
            key = (ch, r.lines)
            if key not in mark_of:
                counter[ch] = counter.get(ch, 0) + 1
                mark_of[key] = f"{ch.upper()}{counter[ch]}"
            out.append(mark_of[key])
        text = "".join(out)
        # THE NOTATION HAS TO ROUND-TRIP, AND THAT IS CHECKED, NOT PROMISED.
        # `is_refrain_notation` settles an ambiguity the module declared: an
        # ALL-UPPERCASE string keeps the >26-sound reading, so a song with no
        # unrhymed lowercase line -- this repo's own, whose verses are all X --
        # would render as `A1B1C1...` and be read straight back as eight
        # separate SOUNDS. The `^` spelling is the discriminator the module
        # already ships for exactly this, so reach for it rather than emit a
        # string that means something else.
        if not is_refrain_notation(text):
            text = "".join(t[0] + "^" + t[1:] if len(t) > 1 else t
                           for t in out)
        got = parse_refrain(text)
        if got.marks != tuple(out) or got.code != parse(self.to_rhyme_letters()):
            raise NoMandate(
                f"this mandate has no A-1 notation that reads back as itself: "
                f"{text!r} re-parses to {got.render()!r}. Emitting it would be "
                f"a notation that means something other than the mandate, "
                f"which is worse than having none (doctrine 20).")
        return text

    # -- reporting --------------------------------------------------------

    def describe(self):
        letters = self.to_rhyme_letters()
        head = (f"mandate: {len(self.groups)} group(s) over {self.n_lines} "
                f"lines, {len(self.pairs())} mandated pair(s), "
                f"{len(self.free)} free line(s)")
        if self.returns:
            head += (f", {len(self.returns)} return class(es) / "
                     f"{len(self.return_pairs())} identity pair(s)")
        rows = [head, f"  source: {self.source} ({self.origin})"]
        if not self.independent():
            rows.append(
                "  NOT INDEPENDENT of the grader: this cover was read off the "
                "rhyme graph, so every group is mutually band-passing BY "
                "CONSTRUCTION and a clean rhyme result here is an identity, "
                "not a verdict (doctrine 14).")
        for k, g in enumerate(self.groups):
            rows.append(f"  {self.labels[k]}: lines {list(g)}")
        if self.scope:
            rows.append(
                f"  SCOPE: this mandate speaks about {len(self.scope)} of "
                f"{self.n_lines} lines. Every pair touching one of the other "
                f"{self.n_lines - len(self.scope)} is UNDECLARED — 'cannot "
                f"tell', which is not 'nothing required' (doctrine 28).")
        for r in self.returns:
            rows.append(f"  RETURN {r.describe()}")
        if self.returns:
            rows.append(
                f"  doctrine 3, per PAIR: REPEAT is the REQUIREMENT at the "
                f"{len(self.return_pairs())} pair(s) above and a VIOLATION at "
                f"the {len(self.pairs())} rhyme pair(s); the mandate no longer "
                f"needs one song-wide licence to mean both.")
            exp = self.expanded_groups()
            rows.append(
                f"  rhyme groups after the returns are transported "
                f"(return_rhyme={self.rule.return_rhyme!r}): "
                f"{[list(g) for g in exp]}")
        if letters is None:
            piv = self.expanded_overlapping_lines()
            rows.append(
                f"  NO LETTER SCHEME EXISTS: lines {piv} belong to more than "
                f"one group, and a letter is a property of a LINE, so no "
                f"assignment of one letter per line can carry this "
                f"(doctrine 2). Each pivot must answer every group it is in.")
            if self.returns and not self.overlapping_lines():
                rows.append(
                    "  and the DECLARED groups do not overlap — the RETURN "
                    "made them a cover. A returning line carries its own "
                    "rhyme obligations into the class it returns into, and "
                    "rhyme is not transitive, so the two classes stay two. "
                    "This mandate had a letter scheme until it stated what "
                    "the song actually does.")
        elif self.returns:
            try:
                rows.append(f"  A-1 notation: {self.to_notation()}")
            except NoMandate as e:
                rows.append(f"  NO NOTATION: {str(e).splitlines()[0]}")
            rows.append(
                f"  rhyme projection only (drops every return): {letters}")
        else:
            rows.append(f"  letters: {letters}")
        return "\n".join(rows)


def _member_slot(x):
    """One raw group member -> (line, Slot|None).

    A member is a LINE (`3`, `'3'`) or a line and a place in it (`'3.head'`,
    `'3.T2'`) — the placement coordinate that stops this layer being
    end-rhyme-only (`quality/slots.py`). `None` means the default slot, which
    is the end of the line, which is what a bare line number has always
    meant: absence keeps ONE reading (doctrine 66).

    BOTH BRANCHES ASK `slots.slot_line` FOR THE LINE, and that is the point of
    the call rather than a tidy-up: this function computes the line-level
    question two ways — `slot.line` on one branch and `int(x)` on the other —
    which is one question with two spellings in one function (doctrine 1).
    `slot_line` is the one definition and it was reachable by NOTHING until
    this call: `quality/counters.py`'s public-symbol census reported it in the
    named-by-nothing bucket, which is the declared-but-unread defect this repo
    has an instrument for, sitting in the module that introduced it.
    """
    from quality import slots as _SL
    if isinstance(x, str) and "." in x:
        slot = _SL.check(_SL.parse_slot(x))
        return _SL.slot_line(slot), slot
    return _SL.slot_line(x), None


def _normalise_groups(raw, n_lines):
    """-> (groups, free, loci). Validates, dedupes, sends singletons to free.

    `loci` is index-aligned with `groups`, and each entry is either `""` — every
    member of that group binds at the default slot, the end of its line — or a
    tuple index-aligned with THAT group's own (sorted) members. The parallel
    tuple is the convention `structures` and `relations` already use, and it is
    used here for the reason `quality/slots.py` records: a group is a tuple of
    line numbers that some sixty sites take literally (`min`, `max`, `sorted`,
    `matrix[i - 1][j - 1]`, the `range(1, n + 1)` complement just below), so a
    placement object put INTO it would be coerced back by the `int()` on the
    line above or would break every one of them.

    THE DEDUP KEY CARRIES THE PLACEMENT, and it has to: `L1.end ~ L2.end` and
    `L1.head ~ L2.head` are two different requirements over one pair of lines
    — a song can ask for both at once — and a key of line numbers alone would
    silently collapse the second into the first.
    """
    seen, groups, loci = set(), [], []
    for g in raw:
        try:
            pairs = [_member_slot(x) for x in g]
        except SlotRefused:
            raise
        except (TypeError, ValueError) as e:
            raise NoMandate(
                f"a mandate group must be an iterable of line numbers, each "
                f"optionally naming a place in its line; got {g!r} ({e}). A "
                f"partition is a list of LINE GROUPS -- [[1, 3], [2, 4]] -- "
                f"not a list of letters.")
        for i, _ in pairs:
            if not 1 <= i <= n_lines:
                raise NoMandate(
                    f"line {i} is outside 1..{n_lines}. Mandate line numbers "
                    f"are 1-BASED and run over the WHOLE song, because a "
                    f"stanza is a printing convention and a rhyme that "
                    f"answers thirty lines earlier has to be expressible.")
        by_line = {}
        for i, slot in pairs:
            if i in by_line and by_line[i] != slot:
                # A WITHIN-LINE BINDING, and it is REFUSED rather than
                # silently deduplicated (doctrine 20). A group is a SET of
                # lines, so it cannot hold one line twice, so this layer
                # cannot state "L1's opening answers L1's own ending". The
                # harness is not blind to that figure — it is the `same_line`
                # placement `relations.realise` reports and `quality/figures.py`
                # is built to keep — so the refusal names the route rather
                # than the limit.
                raise NoMandate(
                    f"group {list(g)!r} names line {i} twice, at two places. "
                    f"A WITHIN-LINE binding is not expressible as a mandated "
                    f"group: a group is a set of lines and a rhyme whose two "
                    f"members share a line has one member. Ask it as a "
                    f"`schema:` relation — `relations.realise` reports "
                    f"same-line instances and `quality/figures.py` reads "
                    f"them — or bind the two lines that carry it.")
            by_line[i] = slot
        members = sorted(by_line)
        if len(members) < 2:
            continue            # a singleton mandates nothing; it is FREE
        place = tuple(by_line[i] for i in members)
        key = (tuple(members),
               tuple(p.rule if p is not None else None for p in place))
        if key in seen:
            continue
        seen.add(key)
        groups.append(tuple(members))
        loci.append("" if all(p is None for p in place) else place)
    covered = {i for g in groups for i in g}
    free = tuple(i for i in range(1, n_lines + 1) if i not in covered)
    return tuple(groups), free, tuple(loci)


def _normalise_scope(raw, n_lines, groups, returns):
    """-> the validated scope tuple. `()` means 'all of 1..n_lines'.

    REFUSES a scope that leaves out a line the mandate's OWN groups or returns
    name. Such a mandate says two incompatible things about the same pair --
    `pairs()` mandates L1/L3 and `requirement(1, 3)` calls it `UNDECLARED` --
    and `grade()` (`quality/revise.py`) reads BOTH: it iterates `pairs()` to
    decide what to judge and `requirement()` to decide whether an identical end
    word there is a violation. So the pair gets graded against a mandate that
    simultaneously claims not to speak about it, which is doctrine 20's own
    case: 'inconclusive by construction' dressed as an answer. `describe()`
    would print the lie out loud -- 'every pair touching one of the other N is
    UNDECLARED' -- while the grader charged those pairs anyway.

    The refusal NAMES THE OTHER READING rather than picking one silently, the
    same shape `to_letters()` and `to_notation()` already hold: a caller who
    means 'grade only the chorus' is declaring narrower GROUPS, not a narrower
    scope over the same groups.
    """
    if raw is None:
        return ()
    try:
        sc = tuple(sorted({int(x) for x in raw}))
    except (TypeError, ValueError):
        raise NoMandate(
            f"scope must be an iterable of 1-based line numbers; got {raw!r}.")
    for i in sc:
        if not 1 <= i <= n_lines:
            raise NoMandate(f"scope line {i} is outside 1..{n_lines}.")
    if not sc:
        return ()                    # an empty scope is the absent one: all
    named = {i for g in groups for i in g}
    named |= {i for r in returns for i in getattr(r, "lines", r)}
    missing = sorted(named - set(sc))
    if missing:
        raise NoMandate(
            f"line(s) {missing} are named by this mandate's own groups or "
            f"returns and are OUTSIDE its declared scope. A mandate cannot "
            f"both require something of a line and say it does not speak "
            f"about it: `pairs()` would mandate those pairs and "
            f"`requirement()` would call them UNDECLARED, and the grader "
            f"reads both -- so the pair is judged against a statement the "
            f"mandate disclaims (doctrine 20).\n"
            f"  to grade only part of the song -> declare the GROUPS over "
            f"that part; `scope` then covers them and every OTHER line is "
            f"UNDECLARED, which is the distinction it exists to make.\n"
            f"  to say nothing is required of those lines -> leave them out "
            f"of every group and out of `scope`; they are FREE, which is a "
            f"DIFFERENT answer (doctrine 28).")
    return sc


def mandate(spec, n_lines=None, source="declared", origin=None,
            returns=None, scope=None, rule=None, carry_returns=True,
            structures=None, relations=None, default_relation=None):
    """Anything that can name a song's requirements -> a `Mandate`.

    Accepted, and all of them are the SAME kind of object once here:

      - a letter string      'ABAB', 'XXXXABCB...' (X / . = free singleton)
      - an A-1 notation      'A1bA2abA1abA2abA1abA2abA1A2' -- rhyme AND the
                             verbatim returns, which used to be dropped here
      - a `RefrainScheme`    the parsed form of the same
      - a canonical RGS code (0, 1, 0, 1)   -- see `parse`/`canonical`
      - a list of groups     [[1, 3], [2, 4]]  -- MAY OVERLAP
      - a `Cover`            the general, overlap-carrying case
      - a `Mandate`          idempotent

    `returns` declares statements 2 and 3 -- which lines are the SAME LINE, and
    therefore which group is a return of which. It takes the text spelling
    (`'33-40<=13-20'`, `'1,6,12,18'`; see `parse_returns`), a list of `Return`,
    or a list of line lists. `scope` declares which lines the mandate speaks
    about; pairs outside it are `UNDECLARED` rather than `FREE`, which is
    doctrine 28's distinction made mechanical. A `scope` that leaves out a
    line this mandate's own groups or returns NAME is a REFUSAL, not a
    narrowing -- see `_normalise_scope`.

    `carry_returns=False` restores the OLD reading of an A-1 string -- rhyme
    only, identity silently dropped. It is reachable so the defect is
    demonstrable rather than a sentence nobody can check (the shape
    `modal_exclusion=0` and `field_band='scalar'` already use); it is not the
    default, because the default was the bug.

    `None` RAISES `NoMandate`. That is the point of the function: a grader
    with no mandate has been given nothing to check against, and saying
    "nothing flagged" about it is a vacuous pass (doctrine 20).
    """
    # WHETHER THE CALLER SUPPLIED ONE, captured BEFORE the default is
    # applied — `rule = rule or ReturnRule()` makes `rule` non-None for the
    # rest of this function, so a later `if rule is None` can never fire and
    # the re-open path below could not tell "no rule declared" from "the
    # default declared" (`MISSING.md` M-53). Silence is not a declaration.
    rule_declared = rule is not None
    rule = rule or ReturnRule()
    extra_returns = []

    if isinstance(spec, RefrainScheme):
        if not carry_returns:
            spec = spec.code
        else:
            m = spec.to_mandate(source=source, origin=origin, rule=rule)
            if n_lines is not None and n_lines != m.n_lines:
                raise NoMandate(
                    f"the notation is written over {m.n_lines} lines and the "
                    f"draft has {n_lines}.")
            spec = m
    elif isinstance(spec, str) and carry_returns and is_refrain_notation(spec):
        # THE FIX. `parse()` returns the rhyme partition and silently discards
        # the identity one, so a notation whose whole point is that certain
        # lines must come back mandated only that they rhyme.
        rs = parse_refrain(spec)
        m = rs.to_mandate(source=source, origin=origin, rule=rule)
        if n_lines is not None and n_lines != m.n_lines:
            raise NoMandate(
                f"the notation {spec!r} is {m.n_lines} lines and the draft is "
                f"{n_lines}.")
        spec = m

    if isinstance(spec, Mandate) and (returns or scope
                                      or structures is not None
                                      or relations is not None
                                      or default_relation is not None):
        # `structures` re-opens the same way `returns`/`scope` do — before
        # it joined this condition, `mandate(m, structures={...})` fell
        # through to the idempotence branch below and DROPPED the
        # declaration in silence, the exact defect family `--returns=`
        # beside `--groups=` was (a declared coordinate consumed and
        # ignored, byte-identical to not declaring it).
        #
        # AND `relations` HAD THE IDENTICAL HOLE, SHIPPED THE SAME DAY IT
        # WAS BUILT AND FOUND 2026-08-22 WIRING THE DEFAULT ROUTE
        # (`MISSING.md` M-50). MEASURED: `mandate(mandate('ABAB'),
        # relations={'A': 'type:qafiya'})` returned `relations=()` and
        # compared EQUAL to the mandate it re-opened — the declaration was
        # not refused, not carried, and not recorded in `origin`. The
        # comment three lines up named this exact family while the line it
        # is attached to had the same hole one coordinate over, which is
        # why the guard is now a list of every re-openable coordinate
        # rather than a list of the ones somebody remembered.
        # re-open an existing mandate to add the statements it lacked
        n = spec.n_lines if n_lines is None else n_lines
        rets = list(spec.returns)
        if returns is not None:
            rets += _list_returns(returns)
        # THE RE-OPEN READS THE MANDATE'S OWN RULE unless one is declared
        # here, for both the normalisation and the stored field — a return
        # renormalised under the default is a return judged by a rule its
        # writer replaced.
        eff_rule = rule if rule_declared else spec.rule
        norm = _normalise_returns(rets, n, eff_rule)
        # THE RE-OPEN PATH IS CHECKED THE SAME WAY THE BUILD PATH IS. It used
        # to take `scope` on trust -- not even the 1..n bound the constructor
        # below enforces -- so `mandate(mandate('ABAB'), scope=[1, 2])` built
        # a mandate that requires L1/L3 to rhyme and denies speaking about L3.
        sc = spec.scope if scope is None else _normalise_scope(
            scope, n, spec.groups, norm)
        # The origin names what was actually re-declared — before
        # `structures` joined the condition above this literal said
        # "+ returns" unconditionally, which a structures-only re-open
        # would have made a false statement about its own provenance.
        # EVERY re-openable coordinate is named here, and the list is the
        # same list as the guard above. `relations` was in neither, so a
        # relations-only re-open printed `origin: ... + ` — a trailing
        # conjunction with nothing after it, which is what a provenance
        # string looks like when it is describing a coordinate nobody told
        # it about.
        added = [word for word, given in (("returns", returns),
                                          ("scope", scope),
                                          ("structures", structures),
                                          ("relations", relations),
                                          ("default_relation",
                                           default_relation))
                 if given is not None]
        return Mandate(n_lines=n, groups=spec.groups, labels=spec.labels,
                       default_relation=(spec.default_relation
                                         if default_relation is None
                                         else default_relation),
                       free=spec.free, source=spec.source,
                       origin=spec.origin + " + " + " + ".join(added),
                       returns=norm,
                       scope=sc,
                       # THE RULE IS CARRIED, NOT RE-DEFAULTED (2026-08-22,
                       # `MISSING.md` M-53). This read `rule=rule` — the
                       # PARAMETER, `None` on every re-open that does not
                       # re-declare one — so re-opening a mandate to add any
                       # coordinate silently reset its `ReturnRule` to the
                       # default. MEASURED: a mandate built with
                       # `return_rhyme='positional'` comes back `'union'`.
                       # Same shape as `relations` one field over: the
                       # re-open path treats an omitted argument as a
                       # DECLARATION OF THE DEFAULT rather than as silence.
                       rule=eff_rule,
                       structures=(_st_spec := (
                           spec.structures if structures is None
                           else _normalise_structures(
                               structures, spec.labels, len(spec.groups)))),
                       relations=(spec.relations if relations is None
                                  else _normalise_relations(
                                      relations, spec.labels,
                                      len(spec.groups), _st_spec)))

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

    groups, free, loci = _normalise_groups(raw, n)
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
    rets = _normalise_returns(
        extra_returns + (_list_returns(returns) if returns else []), n, rule)
    if rets:
        # `free` means "in no group at all", and a returned line IS in one --
        # the group its own first instance is in. Computing it off the
        # DECLARED groups would report L33..L40 as mandating nothing while the
        # mandate requires them to be L13..L20 word for word.
        probe = Mandate(n_lines=n, groups=groups, labels=labels, free=(),
                        source=source, origin=org, returns=rets, rule=rule)
        covered = {i for g in probe.expanded_groups() for i in g}
        free = tuple(i for i in range(1, n + 1) if i not in covered)
    sc = _normalise_scope(scope, n, groups, rets)
    return Mandate(n_lines=n, groups=groups, labels=labels, free=free,
                   source=source, origin=org, returns=rets, scope=sc,
                   rule=rule, loci=loci,
                   structures=(_st := _normalise_structures(
                       structures, labels, len(groups))),
                   relations=_normalise_relations(relations, labels,
                                                  len(groups), _st),
                   # VALIDATED BY `Mandate.__post_init__`, not here, because
                   # `Mandate` is also constructed directly and a check that
                   # lives only in the factory is not a check on the field.
                   default_relation=default_relation or "")


def _normalise_structures(structures, labels, n_groups):
    """{label_or_index: name} | [name...] | None -> the index-aligned tuple.

    Every name resolves through the CATALOG (quality/structures.resolve) or
    the whole mandate REFUSES — a structure that does not exist graded as
    the default would be a silently different question (doctrine 20). A
    label that names no group refuses the same way. "" slots mean default.
    """
    if not structures:
        return ()
    from quality import structures as _ST
    out = [""] * n_groups
    if isinstance(structures, dict):
        lab_to_idx = {lab: k for k, lab in enumerate(labels)}
        for key, name in structures.items():
            if isinstance(key, int):
                idx = key
            elif key in lab_to_idx:
                idx = lab_to_idx[key]
            else:
                raise NoMandate(
                    f"structures declares group {key!r} and the mandate "
                    f"has no such group label; its labels are "
                    f"{list(labels)}. An unmatched declaration is refused, "
                    f"never dropped (doctrine 20).")
            if not (0 <= idx < n_groups):
                raise NoMandate(
                    f"structures declares group index {idx} and the "
                    f"mandate has {n_groups} group(s).")
            out[idx] = _resolve_structure(_ST, name) if name else ""
    else:
        seq = list(structures)
        if len(seq) > n_groups:
            raise NoMandate(
                f"structures declares {len(seq)} entries for "
                f"{n_groups} group(s) — they must be the same mandate.")
        for k, name in enumerate(seq):
            out[k] = _resolve_structure(_ST, name) if name else ""
    return tuple(out)


def _normalise_relations(relations, labels, n_groups, structures=()):
    """{label_or_index: name} | [name...] | None -> the index-aligned tuple.

    Every name resolves through `quality.rhyme_types.resolve_relation` or the
    whole mandate REFUSES — a relation that does not exist, graded as the
    default, would be a silently different question (doctrine 20). A label
    that names no group refuses the same way. "" slots mean default.

    AND A GROUP MAY NOT DECLARE BOTH a structure and a relation. Both are
    judges over the same pairs, and letting one win would make the mandate's
    meaning depend on `grade()`'s branch order rather than on what was
    written (doctrine 1). Refused here, at the declaration site.
    """
    if not relations:
        return ()
    from quality import rhyme_types as _RT
    out = [""] * n_groups
    if isinstance(relations, dict):
        lab_to_idx = {lab: k for k, lab in enumerate(labels)}
        for key, name in relations.items():
            if isinstance(key, int):
                idx = key
            elif key in lab_to_idx:
                idx = lab_to_idx[key]
            else:
                raise NoMandate(
                    f"relations declares group {key!r} and the mandate has "
                    f"no such group label; its labels are {list(labels)}. An "
                    f"unmatched declaration is refused, never dropped "
                    f"(doctrine 20).")
            if not (0 <= idx < n_groups):
                raise NoMandate(
                    f"relations declares group index {idx} and the mandate "
                    f"has {n_groups} group(s).")
            out[idx] = _resolve_relation(_RT, name) if name else ""
    else:
        seq = list(relations)
        if len(seq) > n_groups:
            raise NoMandate(
                f"relations declares {len(seq)} entries for {n_groups} "
                f"group(s) — they must be the same mandate.")
        for k, name in enumerate(seq):
            out[k] = _resolve_relation(_RT, name) if name else ""
    for k, rel in enumerate(out):
        st = structures[k] if k < len(structures) else ""
        if rel and st:
            lab = labels[k] if k < len(labels) else k
            raise NoMandate(
                f"group {lab!r} declares BOTH a structure ({st!r}) and a "
                f"relation ({rel!r}). Those are two judges over the same "
                f"pairs, and which one answered would depend on grade()'s "
                f"branch order rather than on what was written. Declare one "
                f"(doctrine 1) — REFUSED, not silently resolved.")
    return tuple(out)


def _resolve_relation(_RT, name):
    """The vocabulary's refusal, re-raised as THIS layer's — the same move
    `_resolve_structure` makes, and for the same reason: `mandate()` has
    exactly one refusal type and a `RelationRefused` escaping it would be the
    right refusal in the wrong layer's words.

    THE STORED FORM IS NAMESPACED, AND THAT IS THE FIX OF 2026-08-22
    (`MISSING.md` M-49). This returned `resolve_relation(name)[0]` — the BARE
    canonical name — and dropped the `kind` beside it. 26 of the 131 distinct
    declarable names live in TWO namespaces (`type` and `schema`), which is
    the whole reason M-37 made a namespace mandatory, so the bare name is a
    LOSSY store: `relations={"A": "type:rime riche"}` resolved at the door,
    stored `'rime riche'`, and `grade()` — which re-resolves through
    `satisfies_relation` — got back the M-37 ambiguity refusal on every pair
    in that group. MEASURED over the whole vocabulary by re-resolving each
    stored value: **52 of the 157 namespaced declarations REFUSED at grade
    time**, 105 survived. Accepted at the door and refused at the judge is
    the worst of the three possible answers, because the declaration reads
    as taken.

    The invariant this restores, and the reason the shape is uniform rather
    than namespaced-only-when-ambiguous: THE STORED VALUE MUST RE-RESOLVE TO
    THE SAME JUDGE. A bare name satisfies that for 105 of 157 declarations
    and a namespaced one for all 157, so storing two shapes by ambiguity
    would make the store's spelling a function of the vocabulary's current
    contents — a name gaining a `schema` twin later would silently change
    what an untouched mandate stores (doctrine 1)."""
    try:
        canon, kind = _RT.resolve_relation(name)
    except _RT.RelationRefused as e:
        raise NoMandate(str(e)) from e
    # `resolve_relation` answers "named" where the namespace is spelled
    # `type`; every other kind IS its namespace.
    return f"{'type' if kind == 'named' else kind}:{canon}"


def _resolve_structure(_ST, name):
    """The catalog's refusal, re-raised as THIS layer's. `mandate()` has
    exactly one refusal type (`NoMandate` — every CLI surface turns it into
    `REFUSED` at exit 2), and a `StructureRefused` escaping it would be the
    right refusal in the wrong layer's words — the same defect the
    undecodable-file handler had. The catalog's own message is carried
    through unchanged because the message was never the problem."""
    try:
        return _ST.resolve(name)
    except _ST.StructureRefused as e:
        raise NoMandate(str(e)) from e


def _list_returns(spec):
    """-> a list of things `_normalise_returns` accepts, from one argument."""
    if spec is None:
        return []
    if isinstance(spec, (Return, str)):
        return [spec]
    return list(spec)


__all__ = ["bell", "stirling2", "rgs", "label", "parse", "canonical",
           "blocks", "Coordinates", "coordinates", "crossing_rhymes",
           "NAMED", "identify", "unnamed_fraction", "Cover",
           "Mandate", "mandate", "NoMandate",
           # the A-1 refrain notation
           "SUPERSCRIPTS", "is_refrain_notation", "RefrainScheme",
           "parse_refrain", "REFRAIN_FORMS", "refrain_form",
           # the three statements: rhyme, return, and the licence per PAIR
           "UNKNOWN", "Requirement", "REQUIREMENTS", "REQUIRE_RHYME",
           "REQUIRE_RETURN", "LICENSE_REPEAT", "FREE", "UNDECLARED",
           "Return", "ReturnRule", "parse_returns"]

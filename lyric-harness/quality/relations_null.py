#!/usr/bin/env python3
"""MATCHED CONTROLS for quality/relations.py.  BACKLOG §2.6.

THE DEFECT.  `relations` reported `internal rhyme` at 18,290 instances on 200
lines of Poe, `Span.search_k` was carried on every member and nothing consumed
it, and there was no null anywhere in the layer.  Doctrine 56: a search over
placements needs a null under the same search.  Doctrine 61: a rule that fires
more often is not a better rule; pick between variants by LIFT over a matched
control and record the table.  A bare count from this layer was quoting the
null back at itself.

WHAT THIS FILE ADDS, AND WHAT IT REFUSES TO ADD.

1. FIVE NULLS, each stating what it PRESERVES and what it DESTROYS in its own
   record, because doctrine 63 says a null is a modelling decision and a wrong
   one is worse than none -- it looks like rigour.
2. THE NULL IS CHOSEN PER PREDICATE, NEVER PER CORPUS (doctrine 75).
   `predicted_degeneracy()` derives, from a schema's own `placement` tuple and
   `figure` and from the STATISTIC, whether a given null can move the number at
   all.  It is a derivation, not an authority: every run also MEASURES the
   fraction of replicates that differ from the observation and prints it
   (doctrine 68), and a disagreement between the two is printed as a
   disagreement rather than resolved silently.
3. THE STATISTIC IS CHOSEN WITH THE NULL (doctrine 90).  A correct null hung on
   the wrong statistic manufactures a null result exactly like a wrong null
   does.  Bilhaṇa's `adyāpi` is 47.00% against a null MAX of 47.00% under a
   DENSITY statistic and 100.0% against a null median of 48.9% under a POSITION
   statistic, same text and same null.  So `count` and `local_fraction` are
   both here and the pairing is printed.
4. THE OBSERVATION IS BUILT THE SAME WAY AS THE NULL (doctrine 91).  Every
   arm routes the observation through `NULLS['identity']`, i.e. through the
   same tokenise -> permute -> join -> build_stream pipeline the replicates
   use, so a difference between the two can never be the rendering.

THE RUN.  n=200, seed 20260811, Poe = the first 200 non-blank non-header lines
of `corpus/song/eng_american_edgar_allan_poe.txt`, Kalevala = the first 400 of
`corpus/fin_kalevala.txt` (doctrine 58: the slice is a coordinate of the
number, so it is written next to it).  `differ` is the fraction of replicates
that differ from the OBSERVATION at all (doctrine 68).

| schema · statistic | null | observed | null max | gap | lift | differ |
|---|---|---:|---:|---:|---:|---:|
| internal rhyme · count | line_permutation | 20472 | 20472 | **+0** | 1.000 | **0%** |
| internal rhyme · count | within_line_shuffle | 20472 | 22984 | −2512 | 0.897 | 100% |
| internal rhyme · count | global_redeal | 20472 | 22937 | −2465 | 0.897 | 100% |
| internal rhyme · local_fraction@0 | line_permutation | .005959 | .005959 | **+0** | 1.000 | **0%** |
| internal rhyme · local_fraction@0 | within_line_shuffle | .005959 | .005377 | +.000583 | 1.115 | 100% |
| internal rhyme · local_fraction@0 | global_redeal | .005959 | .006434 | −.000475 | 1.109 | 100% |
| perfect rhyme · count | line_permutation | 2431 | 2431 | **+0** | 1.000 | **0%** |
| perfect rhyme · count | line_final_permutation | 2431 | 2588 | −157 | 0.997 | 89.5% |
| perfect rhyme · local_fraction@2 | line_permutation | .035376 | .025915 | **+.009461** | 1.755 | 100% |
| perfect rhyme · local_fraction@2 | line_final_permutation | .035376 | .025905 | **+.009472** | 1.772 | 100% |
| Kalevala weak · line_fraction | within_line_shuffle | .845 | .845 | **+0** | 1.000 | **0%** |
| Kalevala weak · line_fraction | line_permutation | .845 | .845 | **+0** | 1.000 | **0%** |
| Kalevala weak · line_fraction | global_redeal | .845 | .340 | **+.505** | 3.018 | 100% |

FOUR THINGS THAT TABLE SAYS, and they are the reason this file exists rather
than a number for it to print:

  1. `line_permutation` -- THE NULL THIS REPO USES EVERYWHERE ELSE (Whitman,
     the Kalevala, Bilhaṇa, the sonnet arms) -- IS THE IDENTITY MAP for both
     `internal rhyme` and `perfect rhyme` and for Kalevala alliteration.  0 of
     200 replicates differ by so much as one instance.  None of the three
     declares a BOUNDED line-distance placement, so permuting whole lines
     moves no unit's line-final status, no pair's eligibility and no line's
     word multiset.  Doctrine 63 caught this in Finnish and doctrine 68 in
     Persian; this is a third mechanism, in this repo's own relations layer,
     and it hands out a clean p=1.0000 to anyone who reaches for the obvious
     null.
  2. The instance COUNT of a schema with no bounded line-distance placement is
     a function of the song's TOKEN MULTISET: the number of agreeing pairs in
     a multiset does not depend on their order.  It cannot be rescued by
     running the same search over a control, because the search is not what
     inflates it.  The STATISTIC has to change (doctrine 90).
  3. Read the direction, not just the size.  `internal rhyme` is 20,472
     observed against a null MEDIAN near 22,820 -- BELOW chance, lift 0.897,
     under both nulls that bite.  The mechanism is the schema's own
     `both_line_final(polarity=False)`: Poe's 2,431 end-rhyme pairs are
     EXCLUDED from internal rhyme, and a shuffle scatters those rhyme words
     into line interiors where they start counting.  So the headline "18,290
     instances of internal rhyme" was not merely uninformative; the number is
     depressed by the poet's end rhyme, and it moves the wrong way.
  4. What DOES survive a matched control is small and it is real.  Poe's
     end-rhyme locality is +0.0095 over the null max at 1.76x, agreeing to
     three digits under two independent nulls; Kalevala alliteration is +0.505
     at 3.02x, which reproduces the recorded +50.8-point excess.  Both sit at
     the p resolution floor of 1/(n+1)=0.005, so the GAP is the number to read
     and the p is not (doctrine 57).

THE TABLE ABOVE IS UNMOVED BY THE 2026-08-11 TEXT-ORDER CHANGE, and that is a
measurement rather than an expectation.  `realise()` stopped filtering reversed
pairs on position and started de-duplicating them against `mirrored()`, which
recovers instances on ASYMMETRIC schemas only.  All three arm schemas are
SYMMETRIC -- `internal rhyme`, `perfect rhyme` and `Kalevala alliteration
(weak)` each have `spans[0] == spans[1]` -- and `order_burden()` reports
`recovered_instances = 0` on each over this file's own slices (200 lines of
Poe, 400 of the Kalevala).  Since the only behavioural difference is the
reversed pairs it keeps, zero recovered means the output is identical span for
span, so no row above can have moved.  Re-derive with:

    python3 -c "import sys; sys.path.insert(0,'.'); \
from quality import relations as R, relations_null as N; \
from quality.phonology import get as g; \
print([(s, R.order_burden(R.REGISTRY[s], R.build_stream(N._read(p,l), g(la), \
declaration={'language':la}))['recovered_instances']) \
for p,la,l,s,_,_ in N.ARMS])"

THREE ARMS IS THREE OF SEVENTY-SEVEN, AND SAYING SO IS SECTIONS 6-8.
`R.REGISTRY` declares 77 schemas.  The table above controls three.  The other
74 shipped a PRINTED INSTANCE COUNT -- `relations FILE`,
`python3 quality/relations.py FILE`, both of which print a per-schema count
and then a paragraph telling the reader that a count is not evidence -- with
no matched control behind it.  That is the same defect this file was written
to fix, at the scale of the registry rather than of one schema.

FOUR THINGS WERE IN THE WAY, AND ONLY ONE OF THEM WAS "NOBODY GOT TO IT"
(doctrine 44, whose whole point is that gap entries with different causes have
different remedies).  `coverage()` sorts every schema into one of six, and the
counts below are MEASURED on 40 lines of Poe under the `eng` phonology at head
on 2026-08-13 -- they are a coordinate of the text and of the phonology
module, not properties of the registry, and the mode prints them per run
rather than quoting these:

  CONTROLLED     3    a hand-written arm above.  AT SCHEMA GRANULARITY, and
                      the arms are at PAIR granularity: the three carry 16
                      admissible (statistic, null) pairs between them and the
                      arms ran 7 of the 16, so 9 pairs on "controlled"
                      schemas have no matched control (section 7b prints them)
  EXTENDABLE    31    runs, fires, a null moves it, nobody had run it.  33
                      AT `budget=None`, which is the number section 7b's
                      ledger pins: 31 is this figure minus the two schemas the
                      2.0 s budget took, and that boundary is a wall clock
                      reading that does not reproduce (see TOO EXPENSIVE
                      below).  Only the first two clauses of this line were
                      ever checked by code.  "a null moves it" was `null_menu`,
                      a DERIVATION, and 39 of the 195 pairs it nominates on
                      this slice move 0 of 10 replicates while 43 pairs it
                      calls identity maps DO move; "nobody had run it" was
                      `name not in ARM_SCHEMAS`, a membership test on a
                      hand-written tuple.  SECTION 7b MAKES BOTH FAILABLE
  TOO EXPENSIVE  2    `chain rhyme (rap)` is 14.19 s per realise() pass and
                      `compound / phrasal rhyme` 2.53 s, against a 0.05 s
                      median over the 51 that ran -- MEASURED on that pass,
                      not estimated, and the remedy is compute.  This is the
                      one verdict that does NOT reproduce: the boundary is a
                      wall clock reading, and `compound / phrasal rhyme`
                      crossed it between two runs of this same slice
  NO INSTANCE   15    fires zero here; a null against an observation of 0 is
                      inconclusive BY CONSTRUCTION (doctrine 20), not null
  CANNOT OBTAIN 26    `realise()` refuses for want of a capability. 23 need
                      one a caller could DECLARE (caesura, lifts,
                      refrain_tail); 3 need one NO stream can supply -- `poet`,
                      `frequency` and `stub_resolution` have no branch in
                      `Stream.provides` at all (`NEVER_PROVIDED`)
  CANNOT FAIL    0    here; DERIVED at 3 with no text (the reduplications),
                      where every null in `NULLS` is the identity map

WHAT THE SWEEP FOUND, 34 live schemas x 4 nulls x 10 replicates, same slice:
268 rows.  **87 of them (32.5%) are the null returning the observation
exactly** -- 24 of those are `line_permutation` on `count`, which is this
file's finding 1 holding across the registry and not only on its three arms.
Of the 181 rows where the null did move, **126 sit BELOW the null's max**:
`consonance` reads 23 against a null max of 191 (lift 0.19), `head rhyme
(positional)` 4 against 30.  Finding 3 -- "the number is depressed by the
poet's end rhyme and it moves the wrong way" -- was not a fact about
`internal rhyme`.  It is the ordinary case for a count from this layer.
17 schemas clear their own null on at least one statistic; `perfect rhyme`
is +219 at 27.9x, and that is what a real one looks like.

AND EVERY NUMBER IN THE SIX-WAY TABLE ABOVE WAS, UNTIL SECTION 7b, A COMMENT
NO CODE READ.  `coverage()` re-derives the verdicts on every run and compares
them to nothing, so `EXTENDABLE 31` could not be wrong: a schema that acquired
an arm, lost one, stopped firing, started refusing or emptied its null menu
would simply have been re-sorted, silently, and the docstring would have gone
on saying 31.  Doctrine 48 -- a check that cannot fail is decoration -- inside
the census that exists to enforce doctrine 44.  `--verify` diffs the frozen
`EXTENSION_LEDGER` against a fresh census on a pinned slice and exits nonzero
per marker that moved; `--verify --deep` additionally re-measures the
"a null moves it" clause against a full sweep, which is the only tier that
asks the DERIVATION to answer to a MEASUREMENT rather than the other way round
(doctrine 68).

Run: python3 quality/relations_null.py             (all three arms, ~25 min)
     python3 quality/relations_null.py --arm=0 --null=global_redeal
     python3 quality/relations_null.py --coverage  (the census, instant)
     python3 quality/relations_null.py --verify    (the ledger, ~5 s, CI)
     python3 quality/relations_null.py --verify --deep   (~4 min)
     python3 quality/relations_null.py --sweep --corpus=P --limit=N --n=K
     python3 quality/relations_null.py --sensitivity --corpus=P ...
     python3 quality/relations_null.py --help
"""
import os
import random
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.dirname(HERE) not in sys.path:
    sys.path.insert(0, os.path.dirname(HERE))

from dataclasses import dataclass, field          # noqa: E402
import quality.relations as R                     # noqa: E402

#: Doctrine 66.  A tie broken by iterating a set is a result that does not
#: reproduce; so is a randomisation with no stated seed.  Every replicate's
#: seed is derived from this by index, so replicate 7 is replicate 7 on every
#: machine and on every run.
SEED = 20260811


# ---------------------------------------------------------------------------
# 1. THE NULLS.  Each says what it PRESERVES and what it DESTROYS (doctrine 63)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Null:
    name: str
    fn: object                 # (list[list[str]], Random) -> list[list[str]]
    preserves: str
    destroys: str
    reads: tuple = ()          # which coordinates a predicate must read for
    #                            this null to be able to move it at all
    note: str = ""


def _identity(toks, rng):
    return [list(t) for t in toks]


def _line_permutation(toks, rng):
    out = [list(t) for t in toks]
    rng.shuffle(out)
    return out


def _within_line_shuffle(toks, rng):
    return [rng.sample(list(t), len(t)) for t in toks]


def _global_redeal(toks, rng):
    pool = [w for t in toks for w in t]
    rng.shuffle(pool)
    out, i = [], 0
    for t in toks:
        out.append(pool[i:i + len(t)])
        i += len(t)
    return out


def _line_final_permutation(toks, rng):
    finals = [t[-1] for t in toks if t]
    rng.shuffle(finals)
    out, k = [], 0
    for t in toks:
        if t:
            out.append(list(t[:-1]) + [finals[k]])
            k += 1
        else:
            out.append([])
    return out


NULLS = {n.name: n for n in (
    Null("identity", _identity,
         preserves="everything",
         destroys="nothing",
         reads=(),
         note="not a control. It exists so the OBSERVATION is built by the "
              "same tokenise->join->build_stream pipeline as the replicates "
              "(doctrine 91: build the population the same way before calling "
              "a comparison a comparison)."),
    Null("line_permutation", _line_permutation,
         preserves="every line verbatim; every word; every within-line "
                   "arrangement; each line's length; the whole vocabulary; "
                   "WHICH WORDS SHARE A LINE",
         destroys="which line index each line sits at, hence every NON-ZERO "
                  "distance between two lines and every stanza membership",
         reads=("line_distance", "stanza"),
         note="the null this repo uses for Whitman, the Kalevala and Bilhaṇa. "
              "MEASURED HERE TO BE THE IDENTITY MAP for any schema whose "
              "placement carries no BOUNDED line-distance predicate: 0 of 200 "
              "replicates differ on internal rhyme, perfect rhyme OR Kalevala "
              "alliteration. It is the right null for a schema that reads "
              "adjacency or a stanza frame, and no null at all for one that "
              "does not."),
    Null("within_line_shuffle", _within_line_shuffle,
         preserves="each line's word multiset exactly; the song's token "
                   "multiset; line count; each line's token count; which "
                   "words share a line",
         destroys="word ORDER inside each line, hence which word is "
                  "line-final and line-initial, and every searched caesura "
                  "placement",
         reads=("line_position", "caesura"),
         note="doctrine 63's degenerate case: any predicate that is a "
              "SYMMETRIC function of the line's word multiset -- Kalevala "
              "alliteration is the type case -- comes back byte-identical."),
    Null("global_redeal", _global_redeal,
         preserves="the song's token multiset; the line count; each line's "
                   "token count",
         destroys="which words share a line, AND their order inside it",
         reads=("line_position", "line_membership", "caesura"),
         note="doctrine 63 names this as the RIGHT null for Kalevala "
              "alliteration: permute the whole token sequence and re-cut on "
              "the original line lengths."),
    Null("line_final_permutation", _line_final_permutation,
         preserves="every line's interior verbatim; the multiset of END "
                   "WORDS exactly; every line length; the vocabulary",
         destroys="which end word sits at which line, hence every pairing of "
                  "end words at a bounded distance",
         reads=("line_distance", "line_position"),
         note="doctrine 68's degenerate case: where the finals are already "
              "identical -- a radif, a refrain -- permuting identical "
              "elements changes nothing. Always read the differing fraction."),
)}


# ---------------------------------------------------------------------------
# 2. THE STATISTICS.  Chosen WITH the null, never after it (doctrine 90).
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Statistic:
    name: str
    fn: object                 # (instances, findings, stream) -> float | None
    reads: tuple               # the coordinates this statistic is sensitive to
    note: str = ""
    needs_assemble: bool = False


def _count(inst, findings, stream):
    return float(len(inst))


def _local_fraction(k):
    def f(inst, findings, stream):
        if not inst:
            return None                 # no denominator: refuse, not zero
        near = sum(
            1 for i in inst
            if abs(stream.units[i.a.head()].line
                   - stream.units[i.b.head()].line) <= k)
        return near / len(inst)
    return f


def _line_fraction(inst, findings, stream):
    n = len(stream.lines)
    if not n:
        return None
    return sum(1 for f in findings if f[2] is True) / n


STATISTICS = {
    "count": Statistic(
        "count", _count, reads=("multiset",),
        note="the headline the CLI prints. For a schema with no bounded "
             "line-distance placement this is a function of the SONG'S TOKEN "
             "MULTISET: the number of agreeing pairs in a multiset does not "
             "depend on their order, so every within-song permutation returns "
             "it almost unchanged. Doctrine 64 -- a rate is a statement about "
             "the language's redundancy as much as about the poet."),
    # gap 0 reads LINE MEMBERSHIP, not line distance, and the difference is
    # not pedantry: it is the one place the derivation in
    # `predicted_degeneracy` was WRONG and the measurement caught it.  The
    # first version of this table gave gap 0 `line_distance`, so
    # line_permutation was derived as biting; it moved 0 of 20 replicates,
    # because permuting whole lines cannot change which words share a line.
    # Doctrine 68: the empirical check is the authority, and the derivation was
    # amended to match it rather than the other way round.
    "local_fraction@0": Statistic(
        "local_fraction@0", _local_fraction(0), reads=("line_membership",),
        note="of the pairs the relation holds on, the fraction inside ONE "
             "line. Conditions on the relation and measures only PLACEMENT, "
             "which is the coordinate the count cannot see."),
    "local_fraction@1": Statistic(
        "local_fraction@1", _local_fraction(1),
        reads=("line_distance", "line_membership")),
    "local_fraction@2": Statistic(
        "local_fraction@2", _local_fraction(2),
        reads=("line_distance", "line_membership"),
        note="gap <= 2 is the couplet-and-alternating window: the smallest "
             "window that contains both AABB and ABAB."),
    "line_fraction": Statistic(
        "line_fraction", _line_fraction, reads=("line_membership",),
        needs_assemble=True,
        note="for figure schemas (exists_k, fraction, forall): the share of "
             "lines carrying an assembled finding. This is the Kalevala "
             "statistic and the one doctrine 63/64 are written about."),
}


# ---------------------------------------------------------------------------
# 3. PER-PREDICATE NULL CHOICE (doctrine 75), DERIVED AND THEN MEASURED
# ---------------------------------------------------------------------------

#: which coordinate each Placement rule of relations.py actually reads.
_PLACEMENT_READS = {
    "adjacent_lines": "line_distance",
    "line_gap_at_most": "line_distance",
    # `same_line` is distance ZERO, which is MEMBERSHIP and not distance --
    # line_permutation preserves it. This is the second time the measurement
    # corrected this table in the same way: `local_fraction@0` was the first
    # (see STATISTICS below), and both were caught because `report()` prints
    # a derivation/measurement disagreement instead of resolving it. Doctrine
    # 68: a randomisation that can be run, look rigorous and test nothing is
    # the most dangerous object in this repo, and so is a derivation that
    # says it bites when it does not.
    "same_line": "line_membership",
    "across_line_break": "line_distance",
    "different_lines": "line_order",        # NOT a distance: permuting keeps it
    "both_line_final": "line_position",
    "a_line_final": "line_position",
    "exactly_one_line_final": "line_position",
    "neither_line_final": "line_position",
    "both_line_initial": "line_position",
    "at_caesura": "caesura",
    "at_lift": "lift",
    "lift_index": "lift",
    "spans_overlap": "line_position",
    "word_count_differs": "line_membership",
    "both_multiword": "line_membership",
    "same_token": "token",
    "a_is_split_token": "line_position",
}


def schema_reads(schema, statistic):
    """The coordinates a run of this schema under this statistic is sensitive
    to.  Derived from the schema's OWN placement tuple and figure -- per
    PREDICATE, never per corpus (doctrine 75)."""
    reads = {"multiset"}
    for p in schema.placement:
        reads.add(_PLACEMENT_READS.get(p.kind, p.kind))
    if getattr(schema.figure, "frame", "") == "stanza":
        reads.add("stanza")
    if getattr(schema.figure, "frame", "") in ("line", "line_pair"):
        reads.add("line_membership")
    if getattr(schema.figure, "quantifier", "") in ("exists_k", "fraction",
                                                    "forall"):
        reads.add("line_membership")
    for rule in schema.spans:
        if rule.anchor == "searched" or rule.locus in ("half_line_a",
                                                       "half_line_b"):
            reads.add("caesura")
    reads |= set(statistic.reads)
    return reads


def predicted_degeneracy(schema, statistic, null):
    """Can this null move this schema+statistic AT ALL?

    -> True where the derivation says the replicate must equal the observation
    (an identity map), False where it says the null bites, None where the
    derivation cannot tell.  A DERIVATION, overruled by the measurement in
    `run()` whenever the two disagree -- doctrine 68 says the empirical check
    is the authority, because a randomisation that can be run, look rigorous
    and test nothing is the most dangerous object in this repo.
    """
    if null.name == "identity":
        return True
    reads = schema_reads(schema, statistic)
    if not (set(null.reads) & reads):
        return True
    return False


# ---------------------------------------------------------------------------
# 4. THE RUNNER
# ---------------------------------------------------------------------------


@dataclass
class Result:
    schema: str
    statistic: str
    null: str
    language: str
    n_lines: int
    replicates: int
    seed: int
    observed: float
    values: list = field(default_factory=list)
    search_mean_k: float = 1.0
    search_max_k: int = 1
    scope: str = ""

    @property
    def differing(self):
        """Doctrine 68.  The fraction of replicates that differ from the
        OBSERVATION at all.  0.0 means the null is the identity map and the
        p-value below it means nothing."""
        if not self.values:
            return 0.0
        return sum(1 for v in self.values
                   if abs(v - self.observed) > 1e-12) / len(self.values)

    @property
    def null_max(self):
        return max(self.values) if self.values else float("nan")

    @property
    def null_min(self):
        return min(self.values) if self.values else float("nan")

    @property
    def null_median(self):
        return statistics.median(self.values) if self.values else float("nan")

    @property
    def gap_to_max(self):
        """Doctrine 57.  An empirical p sitting at 1/(n+1) reports the
        RESOLUTION, not the effect: read the gap to the null's MAX."""
        return self.observed - self.null_max

    @property
    def lift(self):
        m = self.null_median
        return (self.observed / m) if m else float("inf")

    @property
    def p(self):
        """One-sided, with the observation in the numerator and the
        denominator, so p is never 0."""
        ge = sum(1 for v in self.values if v >= self.observed)
        return (ge + 1) / (len(self.values) + 1)

    @property
    def resolution(self):
        return 1.0 / (len(self.values) + 1)

    def line(self):
        deg = " NULL IS THE IDENTITY MAP" if self.differing == 0.0 else ""
        p = (f"p={self.p:.4f}" if self.p > self.resolution * 1.5
             else f"p={self.p:.4f} = the RESOLUTION 1/(n+1); read the gap")
        return (f"{self.schema} · {self.statistic} · null={self.null}\n"
                f"    observed {self.observed:.6g}   null "
                f"min/med/max {self.null_min:.6g}/{self.null_median:.6g}/"
                f"{self.null_max:.6g}\n"
                f"    GAP TO NULL MAX {self.gap_to_max:+.6g}   lift "
                f"{self.lift:.3f}x   {p}\n"
                f"    replicates differing from the observation "
                f"{self.differing * 100:.1f}%{deg}   n={self.replicates} "
                f"seed={self.seed}")


def _stream_of(toks, phon, language):
    """One replicate's token grid -> one Stream.  Split out of
    `_statistics_of` so that a WHOLE-REGISTRY pass (`sweep`, section 7) can
    build the stream ONCE per replicate and ask 60 schemas of it, instead of
    rebuilding the same stream 60 times."""
    lines = [" ".join(t) for t in toks]
    return R.build_stream(lines, phon, declaration={"language": language},
                          stanzas=R.stanzas_from_blank_lines(lines))


def _measure(st, schema, statistics, chans=None, keep="all"):
    """Every statistic off ONE realise() pass over one prebuilt stream.
    -> (values, None) or (None, Refusal).

    `keep` IS NOT A COORDINATE OF ANY NUMBER HERE, and that is provable rather
    than hoped: `_count`/`_local_fraction` read `inst`, which is filtered to
    `verdict is True`, and `R.assemble` drops `verdict is False` edges at its
    own first line, so the decided-FALSE instances `keep="all"` retains are
    read by nothing in `STATISTICS`.  They are retained anyway by default
    because doctrine 27 is about DENOMINATORS and the day a statistic here
    takes one over decided-false draws, the retention has to already be in
    place.  `sweep` passes the cheap keep because at whole-registry scale the
    retained list is the memory ceiling -- `eye rhyme` on 60 lines of Poe held
    1.2 GB before it refused -- and `quality/test_null_shapes.py` §7 pins the
    two keeps to the same numbers so the economy cannot silently become a
    difference.
    """
    kw = {} if chans is None else {"chans": chans}
    out = R.realise(schema, st, keep=keep, **kw)
    if isinstance(out, R.Refusal):
        return None, out
    inst = [i for i in out if i.verdict is True]
    findings = (R.assemble(schema, out, st)
                if any(s.needs_assemble for s in statistics) else [])
    return [s.fn(inst, findings, st) for s in statistics], None


def _statistics_of(toks, phon, schema, statistics, language, chans=None,
                   keep="all"):
    """EVERY statistic from ONE realise() pass over one replicate.

    Statistics are computed together and not one arm at a time, because the
    expensive step is `realise()` and the whole point of doctrine 90 is that
    you look at the SAME replicate through more than one statistic.  Running
    them separately also re-draws the permutation per statistic, so `count`
    and `local_fraction` would have been measured on different replicates of
    the same seed and could not have been read against each other.
    """
    st = _stream_of(toks, phon, language)
    vals, refusal = _measure(st, schema, statistics, chans, keep)
    return vals, st, refusal


def _statistic_of(toks, phon, schema, statistic, language, chans=None):
    vals, st, refusal = _statistics_of(toks, phon, schema, [statistic],
                                       language, chans)
    return (None if vals is None else vals[0]), st, refusal


def run_many(lines, phon, schema, statistics, null="line_permutation",
             n=200, seed=SEED, language="", chans=None, tokeniser=R.tokenise):
    """One null, EVERY statistic, off one set of replicates.  -> [Result].

    `lines` are RAW text lines.  They are tokenised once and every replicate is
    a permutation of that token grid, so the null and the observation differ in
    exactly the permutation and in nothing else.  All statistics read the SAME
    replicate, which is what makes the doctrine-90 pairing a comparison rather
    than two runs side by side.
    """
    stats = [STATISTICS[s] if isinstance(s, str) else s for s in statistics]
    if isinstance(null, str):
        null = NULLS[null]
    if isinstance(schema, str):
        schema = R.REGISTRY[schema]
    toks = [tokeniser(l) for l in lines if l.strip()]

    obs, st0, refusal = _statistics_of(
        NULLS["identity"].fn(toks, random.Random(seed)),
        phon, schema, stats, language, chans)
    if refusal is not None:
        return [refusal for _ in stats]
    burden = R.search_burden(schema, st0)
    out = []
    for s, o in zip(stats, obs):
        if o is None:
            out.append(R.Refusal(
                schema.name, "denominator",
                f"{s.name} has no denominator on this text: the schema found "
                f"no instance to take a fraction of. Refused rather than "
                f"reported as 0.0."))
            continue
        out.append(Result(
            schema=schema.name, statistic=s.name, null=null.name,
            language=language, n_lines=len(toks), replicates=n, seed=seed,
            observed=o, search_mean_k=burden["mean_k"],
            search_max_k=burden["max_k"],
            scope=R.tradition_scope(schema, language)))
    for k in range(n):
        rng = random.Random(seed + 1 + k)
        vals, _, _ = _statistics_of(null.fn(toks, rng), phon, schema, stats,
                                    language, chans)
        if vals is None:
            continue
        for r, v in zip(out, vals):
            if not isinstance(r, R.Refusal) and v is not None:
                r.values.append(v)
    return out


def run(lines, phon, schema, statistic="count", null="line_permutation", **kw):
    """One arm, one statistic."""
    return run_many(lines, phon, schema, [statistic], null, **kw)[0]


def table(lines, phon, schema, statistics, nulls, **kw):
    """Doctrine 61: where a rule or a null has VARIANTS, pick between them by
    lift over a matched control and RECORD THE TABLE.  Never by which one
    fires more.  -> {statistic name: [Result per null]}."""
    if isinstance(statistics, str):
        statistics = [statistics]
    rows = {}
    for nl in nulls:
        for r in run_many(lines, phon, schema, statistics, nl, **kw):
            key = r.statistic if not isinstance(r, R.Refusal) else "REFUSED"
            rows.setdefault(key, []).append(r)
    return rows


def report(results, schema=None, statistic=None):
    """Print an arm, with the derivation beside the measurement so a
    disagreement is visible rather than resolved silently."""
    for r in results:
        if isinstance(r, R.Refusal):
            print(f"  REFUSED {r.schema}: {r.capability} — {r.detail}")
            continue
        nl = NULLS[r.null]
        sc = STATISTICS[r.statistic]
        sch = R.REGISTRY[r.schema]
        pred = predicted_degeneracy(sch, sc, nl)
        meas = r.differing == 0.0
        print("  " + r.line().replace("\n", "\n  "), flush=True)
        print(f"      PRESERVES {nl.preserves}")
        print(f"      DESTROYS  {nl.destroys}")
        if r.search_mean_k > 1:
            print(f"      the schema SEARCHED: k mean {r.search_mean_k:.1f} "
                  f"max {r.search_max_k} hypotheses per locus, and the null "
                  f"ran the same search (doctrine 56)")
        print(f"      tradition scope of this schema for {r.language!r}: "
              f"{r.scope}")
        if pred is True and meas:
            print("      derivation and measurement AGREE: identity map. The "
                  "null reads a coordinate this predicate does not use.")
        elif pred is True and not meas:
            print("      *** DISAGREEMENT: derived as an identity map on the "
                  "PLACEMENT coordinates and it MOVED. The measurement "
                  "stands. One known cause is not placement at all: a "
                  "permutation moves UNREADABLE tokens between lines, and "
                  "`line_final_token` is the last token the declaration could "
                  "READ, so a swap can change which word is line-final. That "
                  "is an ingestion effect wearing a placement number "
                  "(doctrine 79), and it is the size of the stream's "
                  "`unreadable` list.")
        elif pred is False and meas:
            print("      *** DISAGREEMENT: derived as biting and it did NOT "
                  "move a single replicate. The measurement stands "
                  "(doctrine 68).")
        print()


# ---------------------------------------------------------------------------
# 5. THE REPORTED ARMS
# ---------------------------------------------------------------------------


def _read(path, limit=None, drop_comments=True):
    """A slice is a COORDINATE OF THE NUMBER (doctrine 58), so this states it:
    non-blank lines, `#` header rows and `[SECTION]` rows dropped, first
    `limit` of what remains."""
    out = []
    for l in open(path, encoding="utf-8"):
        l = l.rstrip()
        if not l.strip():
            continue
        if drop_comments and l.lstrip().startswith("#"):
            continue
        if l.lstrip().startswith("["):
            continue
        out.append(l)
        if limit and len(out) >= limit:
            break
    return out


ARMS = (
    # (corpus, language, schema, statistic, nulls, n, note)
    ("corpus/song/eng_american_edgar_allan_poe.txt", "eng", 200,
     "internal rhyme", ("count", "local_fraction@0"),
     ("line_permutation", "within_line_shuffle", "global_redeal")),
    ("corpus/song/eng_american_edgar_allan_poe.txt", "eng", 200,
     "perfect rhyme", ("count", "local_fraction@2"),
     ("line_permutation", "line_final_permutation")),
    ("corpus/fin_kalevala.txt", "fin", 400,
     "Kalevala alliteration (weak)", ("line_fraction",),
     ("within_line_shuffle", "line_permutation", "global_redeal")),
)

#: The schemas the hand-written arms above control.  THREE, out of the 77 in
#: `R.REGISTRY` -- so 74 named relations shipped with a printed instance count
#: (`relations FILE`, `quality/relations.py FILE`) and no matched control
#: behind it.  Sections 6-8 exist because "nobody got to it" is only one of
#: the four reasons for that, and the four have completely different remedies
#: (doctrine 44).
ARM_SCHEMAS = frozenset(a[3] for a in ARMS)


# ---------------------------------------------------------------------------
# 6. COVERAGE — WHY 74 SCHEMAS HAVE NO NULL, SPLIT BY REMEDY (doctrine 44)
# ---------------------------------------------------------------------------
#
# Doctrine 44 says separate "hard to build" from "cannot obtain" in every gap
# entry, because "find a better source" is the answer to only one of them.
# The same split applies to a missing CONTROL, and here it has five arms, not
# two.  A schema with no null is in exactly one of:
#
#   CANNOT OBTAIN     `realise()` REFUSES it on this declaration for want of a
#                     capability.  There is no observation, so there is
#                     nothing for a null to be a null ABOUT.  Sub-split again:
#                     a capability a caller could DECLARE (caesura, lifts,
#                     refrain_tail: `search_caesura`, `mark_refrain_tail`
#                     and
#                     a declared meter supply all three) is a different entry
#                     from one NOTHING in this repo can supply (`poet`,
#                     `frequency`, `stub_resolution` have no branch in
#                     `Stream.provides` at all, so they are False for every
#                     stream that can be built).
#   NO INSTANCE       it runs and finds nothing on the text.  A null against
#                     an observation of zero is inconclusive by construction:
#                     the observation sits at the floor of the statistic and
#                     no replicate can fall below it.  Doctrine 20 — that is
#                     not a null result, and reporting it as one is a false
#                     negative dressed as a finding.
#   CANNOT FAIL       it runs, it fires, and every null in this file's
#                     inventory is the IDENTITY MAP for every statistic the
#                     schema admits.  Building one would hand out a clean
#                     p=1.0000 with no experiment under it — doctrine 63's
#                     "a wrong null is worse than none, because it looks like
#                     rigour", one step further out.  The remedy is a NEW
#                     randomisation that destroys the coordinate the schema
#                     actually reads, and the entry names that coordinate.
#   TOO EXPENSIVE     it runs and a null bites, but one `realise()` pass costs
#                     more than the run's budget.  MEASURED, in seconds, never
#                     guessed: `chain rhyme (rap)` is 14.19 s per pass on 40
#                     lines of Poe against a 0.05 s median over the 51 that
#                     ran, so that one schema alone is nine minutes at ten
#                     replicates under four nulls.  The remedy is compute or
#                     a shorter slice, and it is the one category where
#                     nothing is wrong.
#                     AND IT IS THE ONE VERDICT THAT DOES NOT REPRODUCE.  The
#                     boundary is a WALL CLOCK reading, so it is a coordinate
#                     of the machine and its load and not of the schema:
#                     `compound / phrasal rhyme` measured 2.53 s on one run of
#                     this exact slice and under 2 s on another minutes
#                     earlier, and crossed the line between them.  Doctrine 66
#                     says a result that does not reproduce is not a result,
#                     and this one does not; a budget makes a RUN bounded, it
#                     does not make the exclusion LIST stable.  Read the
#                     printed seconds, not the membership, and pass
#                     `budget=None` for a complete run when the time is there.
#   EXTENDABLE        it runs, it fires, a null in the inventory bites, and
#                     nobody had run it.  THIS is "nobody got to it", and it
#                     is the only one of the five that `sweep()` closes.
#                     READ THE LAST TWO CLAUSES NARROWLY.  In the code below
#                     this verdict is the ELSE-BRANCH of `name in ARM_SCHEMAS`
#                     reached after `pairs` came back non-empty, so "a null
#                     bites" means "`null_menu` NOMINATED one" (a derivation
#                     this file records as wrong in both directions) and
#                     "nobody had run it" means "no tuple in `ARMS` names it"
#                     (a fact about a hand-written list, not about whether a
#                     measurement exists).  Section 7b freezes both into a
#                     ledger so that a change in either fails `--verify`
#                     instead of being re-derived into a fresh verdict that
#                     still reads "nobody had run it".


#: What each PLACEMENT rule FORCES about the line distance, as (lo, hi) with
#: hi=None for unbounded.  Only `polarity=True` rules constrain: the OE fourth
#: lift is written `polarity=False`, and the NEGATION of a gap bound is not a
#: gap bound.
#:
#: `both_line_final` and `both_line_initial` are DELIBERATELY ABSENT even
#: though 29 and 3 schemas carry them and the reflex is to read them as "two
#: different lines".  A line has one line-final unit, but two DISTINCT spans
#: can share it -- `door` and `the door` end on the same line-final unit --
#: so the pair is at gap 0 and the reflex is wrong for exactly the multiword
#: schemas (`mosaic rhyme`, `compound / phrasal rhyme`) where it would have
#: mattered.  Being absent costs nothing: it makes the derivation say "cannot
#: tell" where it cannot tell (doctrine 28), and `sweep()` then MEASURES.
_GAP_FORCED = {
    "same_line": (0, 0),
    "spans_overlap": (0, 0),
    "same_token": (0, 0),
    "adjacent_tokens": (0, 0),
    "adjacent_lines": (1, 1),
    "across_line_break": (1, 1),
    "different_lines": (1, None),
}


def forced_gap(schema):
    """(lo, hi) bounds on the line distance between a schema's two members,
    derived from its own placement tuple.  hi=None means unbounded."""
    lo, hi = 0, None
    for p in schema.placement:
        if not p.polarity:
            continue
        b = ((1, p.args[0]) if p.kind == "line_gap_at_most"
             else _GAP_FORCED.get(p.kind))
        if b is None:
            continue
        lo = max(lo, b[0])
        if b[1] is not None:
            hi = b[1] if hi is None else min(hi, b[1])
    return lo, hi


def statistic_degeneracy(schema, statistic):
    """Is this statistic CONSTANT BY CONSTRUCTION on this schema?

    -> None where it can vary, else the reason it cannot.  DOCTRINE 20, one
    layer below where that doctrine was first written: the time layer refused
    when its EVENTS saturated, and this refuses when the STATISTIC is pinned
    by the schema's own placement tuple before any text is read.  A statistic
    the observation and every replicate must return the same value for cannot
    fail, so a null hung on it is a p-value with no experiment under it — and
    it will print `p=1.0000, 0% differing` and look exactly like a real null
    that came back clean.

    This is doctrine 90 made mechanical.  That doctrine says the null and the
    statistic are chosen together and a correct null on the wrong statistic
    manufactures a null result; `predicted_degeneracy` already answers the
    null half.  This answers the statistic half, and the two are asked
    separately because they fail for unrelated reasons.
    """
    name = statistic if isinstance(statistic, str) else statistic.name
    lo, hi = forced_gap(schema)
    if name.startswith("local_fraction@"):
        k = int(name.split("@", 1)[1])
        if hi is not None and hi <= k:
            return (f"constant 1.0: the schema's own placement forces a line "
                    f"gap of at most {hi}, so every instance it can find is "
                    f"already inside the @{k} window, on the observation and "
                    f"on every replicate alike")
        if lo > k:
            return (f"constant 0.0: the schema's own placement forces a line "
                    f"gap of at least {lo}, so no instance it can find is "
                    f"ever inside the @{k} window")
        return None
    if name == "line_fraction":
        if schema.figure.quantifier == "exists":
            return ("not a second statistic on a plain pair figure: with "
                    "quantifier 'exists', assemble() emits one finding per "
                    "surviving edge, so line_fraction is count/len(lines) — "
                    "the SAME number as `count` rescaled by a constant, and "
                    "it moves under exactly the nulls `count` moves under")
        return None
    if name == "count":
        return None
    return None


def null_menu(schema, statistic):
    """The nulls this file HAS that the derivation says can move this
    schema+statistic at all.  Empty means every one of them is the identity
    map, which is the CANNOT FAIL verdict."""
    st = STATISTICS[statistic] if isinstance(statistic, str) else statistic
    return tuple(n for n in NULLS if n != "identity"
                 and predicted_degeneracy(schema, st, NULLS[n]) is False)


def unreachable_coordinates(schema, statistic):
    """Which coordinates this schema+statistic reads that NO null in `NULLS`
    destroys.  This is the CANNOT FAIL entry's remedy, stated as a shopping
    list rather than as a shrug."""
    st = STATISTICS[statistic] if isinstance(statistic, str) else statistic
    destroyed = set()
    for nl in NULLS.values():
        destroyed |= set(nl.reads)
    return tuple(sorted(schema_reads(schema, st) - destroyed - {"multiset"}))


#: Capabilities `Stream.provides` has NO branch for, so it returns False for
#: them on every stream that can be built, under every declaration.  A schema
#: requiring one of these can never produce an observation and therefore can
#: never have a null — doctrine 44's "cannot obtain", and the remedy is a
#: BUILD, not a corpus and not compute.  `quality/test_null_shapes.py` §8
#: asserts each is still unprovidable, so the day one is implemented this
#: table becomes a failing test rather than a stale comment (doctrine 48).
#: `poet` LEFT THIS TABLE 2026-08-13, and the reason is worth keeping. Its row
#: read "no stream field carries the writer's dialect", which was a claim about
#: the DATA and therefore a doctrine-92 cannot-obtain. It was wrong about the
#: MECHANISM: `poet` is a SURFACE, `ChannelSet.read` already resolves any
#: non-phonemic surface generically through `Stream.alt`, and the only gate was
#: a hardcoded tuple in `Stream.provides` that listed five surface names and
#: omitted this one. Two modules disagreed about whether the capability existed
#: and `provides` was the one that was wrong. So the remedy was never "BUILD
#: it" -- it is "declare the capability on the stream", which is a different
#: entry in doctrine 44's three-way split, and a wrong remedy in this table
#: sends the next reader to build something that is already there.
#: THE DATA BLOCKER IS UNCHANGED and is recorded where it belongs, in
#: `relations.UNPROVIDABLE`: a sourced dialect phonology, which
#: `PeriodPhonology` refuses to construct without a named reconstruction.
NEVER_PROVIDED = {
    "frequency": "`trite rhyme` needs a corpus frequency table joined to the "
                 "stream; `data/song_rhymepair_en.tsv` exists and nothing "
                 "hands it to `build_stream`",
    "stub_resolution": "`refrain by reference` needs the `&c.` stub RESOLVED "
                       "to the lines it points at; `Stream.line_status` marks "
                       "the stub and no reader expands it",
}


@dataclass(frozen=True)
class Coverage:
    """One schema's null status, and the REMEDY that follows from it."""
    schema: str
    verdict: str            # controlled | extendable | cannot_fail |
    #                         cannot_obtain | no_instance | too_expensive
    pairs: tuple = ()       # ((statistic, (null, ...)), ...) — admissible
    dropped: tuple = ()     # ((statistic, reason), ...) — doctrine 20 cases
    detail: str = ""
    capability: str = ""
    instances: int = -1     # -1 = not measured (no stream supplied)
    seconds: float = -1.0

    @property
    def remedy(self):
        return {
            "controlled": "already run; see this file's own docstring",
            "extendable": "RUN IT — `sweep()` does, and nothing else was in "
                          "the way. `--verify --deep` says whether the null "
                          "this verdict nominated actually moves anything, "
                          "because the nomination is a derivation and 39 of "
                          "195 of them are not backed by a measurement",
            "cannot_fail": "a NEW null that destroys " +
                           (", ".join(self.detail.split("|")) or "?") +
                           "; every randomisation in NULLS is the identity "
                           "map here",
            "cannot_obtain": ("declare the capability on the stream"
                              if self.capability not in NEVER_PROVIDED
                              else "BUILD it: " +
                              NEVER_PROVIDED.get(self.capability, "")),
            "no_instance": "a text the relation occurs in; on this one the "
                           "observation is 0 and no replicate can go lower",
            "too_expensive": "compute, or a shorter slice — nothing about "
                             "this schema or its null is wrong. Read the "
                             "seconds, not the membership: the boundary is a "
                             "wall clock reading and does not reproduce "
                             "across machines or loads (doctrine 66)",
        }[self.verdict]


def coverage(stream=None, schemas=None, chans=None, statistics=None,
             budget=None, keep=("true", "none"), progress=None):
    """The census.  -> [Coverage], one per schema, in registry order.

    With NO stream this is derivation only: it can separate CANNOT FAIL from
    EXTENDABLE, because both follow from the schema's own placement tuple and
    figure, and it cannot see CANNOT OBTAIN or NO INSTANCE, which are facts
    about a text.  Pass a stream and it realises each schema once and fills
    those in; and `budget` (seconds per `realise()` pass) then separates
    TOO EXPENSIVE, measured on that same pass rather than estimated.

    Doctrine 68 all the way down: every verdict except CANNOT FAIL and
    EXTENDABLE is a MEASUREMENT, and those two are derivations that `sweep()`
    re-checks against `Result.differing` on every run.
    """
    import time
    reg = schemas if schemas is not None else R.REGISTRY
    stats = list(statistics or SWEEP_STATISTICS)
    out = []
    for name, s in reg.items():
        pairs, dropped = [], []
        for sn in stats:
            why = statistic_degeneracy(s, sn)
            if why:
                dropped.append((sn, why))
                continue
            menu = null_menu(s, sn)
            if menu:
                pairs.append((sn, menu))
            else:
                dropped.append((sn, "no null in NULLS moves it: every one is "
                                    "the identity map for this schema"))
        pairs, dropped = tuple(pairs), tuple(dropped)
        inst, secs = -1, -1.0
        if stream is not None:
            if progress:
                progress(name)
            t0 = time.time()
            kw = {} if chans is None else {"chans": chans}
            res = R.realise(s, stream, keep=keep, **kw)
            secs = time.time() - t0
            if isinstance(res, R.Refusal):
                out.append(Coverage(name, "cannot_obtain", pairs, dropped,
                                    capability=res.capability, seconds=secs))
                continue
            inst = sum(1 for i in res if i.verdict is True)
            if inst == 0:
                out.append(Coverage(name, "no_instance", pairs, dropped,
                                    instances=0, seconds=secs))
                continue
        # BUDGET FIRST, and deliberately ahead of CANNOT FAIL: the budget is a
        # hard bound on what the run will actually do, and `sweep` runs the
        # cannot-fail set (to check the derivation) rather than skipping it,
        # so a cannot-fail schema over budget still has to be excluded by
        # COST or it blows the bound it was given.
        if budget is not None and secs > budget:
            out.append(Coverage(name, "too_expensive", pairs, dropped,
                                instances=inst, seconds=secs))
            continue
        if not pairs:
            miss = set()
            for sn in stats:
                if not statistic_degeneracy(s, sn):
                    miss |= set(unreachable_coordinates(s, sn))
            out.append(Coverage(name, "cannot_fail", pairs, dropped,
                                detail="|".join(sorted(miss)) or "nothing a "
                                "permutation of this text can move",
                                instances=inst, seconds=secs))
            continue
        out.append(Coverage(
            name, "controlled" if name in ARM_SCHEMAS else "extendable",
            pairs, dropped, instances=inst, seconds=secs))
    return out


VERDICTS = ("controlled", "extendable", "too_expensive", "cannot_fail",
            "no_instance", "cannot_obtain")


def report_coverage(cov, verbose=True):
    """SIX counts, never one (doctrine 79 generalised).  A schema that CANNOT
    have a null, a schema whose null would be an identity map, and a schema
    nobody ran are three different answers, and summing them into "74 with no
    null" charges the wrong layer for five sixths of it."""
    by = {v: [c for c in cov if c.verdict == v] for v in VERDICTS}
    print(f"  schemas declared {len(cov)}   ·   controlled by an ARM in this "
          f"file {len(by['controlled'])}")
    print("  " + "  ·  ".join(f"{v.upper()} {len(by[v])}"
                              for v in VERDICTS[1:]))
    print("  the six are a partition, and each has a DIFFERENT remedy "
          "(doctrine 44).")
    print("  The `statistic under null/null` lines below are the DERIVED "
          "menu (`null_menu`);\n  `sweep` runs EVERY null anyway and reports "
          "the differing fraction, because\n  the derivation is known wrong "
          "on at least one row of this file's own table\n  (doctrine 68, "
          "see `sweep`'s docstring).")
    for v in VERDICTS:
        rows = by[v]
        if not rows:
            continue
        print(f"\n  -- {v.upper()}  ({len(rows)})")
        if v == "cannot_obtain":
            hard = [c for c in rows if c.capability in NEVER_PROVIDED]
            soft = [c for c in rows if c.capability not in NEVER_PROVIDED]
            print(f"     of these, {len(hard)} need a capability NOTHING in "
                  f"this repo can supply and {len(soft)} need one a caller "
                  f"could DECLARE — different entries, doctrine 44")
        if not verbose:
            print("     " + ", ".join(c.schema for c in rows))
            continue
        for c in rows:
            tail = ""
            if c.capability:
                tail = f"  needs {c.capability!r}"
            elif c.instances >= 0:
                tail = f"  {c.instances} instance(s)"
            if c.seconds >= 0:
                tail += f"  [{c.seconds:.2f}s/pass]"
            print(f"     {c.schema}{tail}")
            if v in ("cannot_fail", "cannot_obtain", "no_instance",
                     "too_expensive"):
                print(f"        remedy: {c.remedy}")
            elif c.pairs:
                print("        " + "; ".join(
                    f"{sn} under {'/'.join(nl)}" for sn, nl in c.pairs))
    return by


# ---------------------------------------------------------------------------
# 7. THE SWEEP — every schema that CAN have a null, off shared replicates
# ---------------------------------------------------------------------------

#: The statistics a sweep offers each schema.  `count` is the number the
#: `relations` verb actually prints, so it is the one a reader will quote; the
#: locality pair is what survives when the count turns out to be a function of
#: the token multiset (this file's finding 2); `line_fraction` is the figure
#: statistic and `statistic_degeneracy` drops it on plain pair schemas rather
#: than reporting `count` twice under two names.
SWEEP_STATISTICS = ("count", "local_fraction@0", "local_fraction@2",
                    "line_fraction")


def sweep(lines, phon, language, schemas=None, n=25, seed=SEED, chans=None,
          keep=("true", "none"), tokeniser=R.tokenise, budget=2.0,
          statistics=None, progress=None, derived_only=False):
    """EVERY schema that produced an observation, under EVERY null, off ONE
    set of replicates per null.

    -> (results, census).  `results` are `Result`/`R.Refusal` exactly as
    `run_many` returns them, so `report()` prints them unchanged and a sweep
    row and an ARM row are the same object.

    `derived_only=True` restricts each schema to the nulls `null_menu` says
    can move it.  IT IS NOT THE DEFAULT, AND THE REASON IS IN THIS FILE'S OWN
    RECORDED TABLE.  `perfect rhyme · count` reads `line_position` and
    `line_order`; `line_final_permutation` declares it destroys
    `line_distance`; the two do not intersect, so the derivation calls that
    pair an identity map — and the measured row above says **89.5% of
    replicates differed**.  The cause is not placement at all and `report()`
    already names it: a permutation moves UNREADABLE tokens between lines, and
    `line_final_token` is the last token the DECLARATION could read, so a swap
    changes which word is line-final (an ingestion effect wearing a placement
    number, doctrine 79).  A sweep that trusted the derivation would have
    silently dropped the one arm in this file's own table that the derivation
    gets wrong.  Doctrine 68 is not a footnote here: the derivation proposes
    the plan and the MEASUREMENT decides, so every null is run and
    `Result.differing` is what the reader is asked to look at.

    WHY THIS IS AFFORDABLE AND THREE HAND-WRITTEN ARMS WERE NOT.  `run_many`
    rebuilds the stream once per replicate PER SCHEMA PER NULL; at 74 schemas
    and four nulls that is 296 identical `build_stream` calls per replicate
    for one text.  Here the replicate is drawn once per null, the stream is
    built once from it, and every schema that needs THAT null is asked of that
    one stream.  The saving is not a micro-optimisation: it is the gap
    between "a null for the registry is a 25-minute run per schema" and "a
    null for the registry is one run", which is most of the answer to why the
    other 74 never got one.

    THE SEED IS PER REPLICATE INDEX, exactly as in `run_many` (doctrine 66),
    so a sweep and a hand-written arm on the same schema, statistic, null and
    slice draw the SAME permutations and must return the same numbers.
    `quality/test_null_shapes.py` §7 pins that equality, because a second
    runner that quietly disagrees with the first is a worse defect than no
    second runner.
    """
    toks = [tokeniser(l) for l in lines if l.strip()]
    # Doctrine 91, and it is also what makes a sweep row and a `run_many` row
    # comparable: the OBSERVATION goes through the identity null, on the same
    # seed, so the observation and the replicates differ in the permutation
    # and in nothing else -- including nothing about how the stream was built.
    st0 = _stream_of(NULLS["identity"].fn(toks, random.Random(seed)), phon,
                     language)
    census = coverage(st0, schemas=schemas, chans=chans,
                      statistics=statistics or SWEEP_STATISTICS,
                      budget=budget, keep=keep, progress=progress)
    # CANNOT FAIL is in, on purpose.  It is the one verdict in the census that
    # is a pure DERIVATION about which coordinates a null destroys, and it is
    # the one the paragraph above shows can be wrong; running it is how the
    # claim gets checked instead of asserted.  CANNOT OBTAIN, NO INSTANCE and
    # TOO EXPENSIVE are all MEASURED on this same text and stay out.
    live = [c for c in census
            if c.verdict in ("controlled", "extendable", "cannot_fail")]

    #: {null name: [(schema, [statistic, ...]), ...]} — the transpose of the
    #: census, because the replicate is drawn per NULL and shared across every
    #: schema that reads it.
    every = tuple(x for x in NULLS if x != "identity")
    plan = {}
    for c in live:
        admissible = [sn for sn in (statistics or SWEEP_STATISTICS)
                      if not statistic_degeneracy(R.REGISTRY[c.schema], sn)]
        for sn in admissible:
            menu = (null_menu(R.REGISTRY[c.schema], sn) if derived_only
                    else every)
            for nl in menu:
                plan.setdefault(nl, {}).setdefault(c.schema, []).append(sn)

    results = []
    for nl_name, per_schema in sorted(plan.items()):
        nl = NULLS[nl_name]
        rows = {}
        for sname, snames in sorted(per_schema.items()):
            sch = R.REGISTRY[sname]
            stats = [STATISTICS[x] for x in snames]
            obs, refusal = _measure(st0, sch, stats, chans, keep)
            if refusal is not None or obs is None:
                continue
            burden = R.search_burden(sch, st0)
            row = []
            for s, o in zip(stats, obs):
                if o is None:
                    row.append(R.Refusal(
                        sname, "denominator",
                        f"{s.name} has no denominator on this text. Refused "
                        f"rather than reported as 0.0."))
                    continue
                row.append(Result(
                    schema=sname, statistic=s.name, null=nl_name,
                    language=language, n_lines=len(toks), replicates=n,
                    seed=seed, observed=o, search_mean_k=burden["mean_k"],
                    search_max_k=burden["max_k"],
                    scope=R.tradition_scope(sch, language)))
            rows[sname] = (sch, stats, row)
        for k in range(n):
            rng = random.Random(seed + 1 + k)
            st = _stream_of(nl.fn(toks, rng), phon, language)
            if progress:
                progress(f"{nl_name} replicate {k + 1}/{n}")
            for sname, (sch, stats, row) in rows.items():
                vals, refusal = _measure(st, sch, stats, chans, keep)
                if vals is None:
                    continue
                for r, v in zip(row, vals):
                    if not isinstance(r, R.Refusal) and v is not None:
                        r.values.append(v)
        for sname, (_s, _st, row) in sorted(rows.items()):
            results += row
    return results, census


# ---------------------------------------------------------------------------
# 7b. THE EXTENSION LEDGER — MAKING `EXTENDABLE` A CHECK (doctrine 48)
# ---------------------------------------------------------------------------
#
# WHAT `EXTENDABLE` MEANT BEFORE THIS SECTION EXISTED.  `coverage()` ends on
#
#     "controlled" if name in ARM_SCHEMAS else "extendable"
#
# so EXTENDABLE IS THE ELSE-BRANCH.  A schema lands there by not being one of
# three names, having realised, having fired at least one instance, and having
# come in under budget.  Section 6's own comment and `Coverage.remedy` then
# hang two further claims on that branch —
#
#     "a null in the inventory bites"     and     "nobody had run it"
#
# — AND NEITHER WAS A CONDITION OF THE BRANCH, SO NEITHER COULD BE WRONG.
#
#   * "a null bites" is `null_menu`, i.e. `predicted_degeneracy`, i.e. a pure
#     DERIVATION off the schema's placement tuple.  This file's own docstring
#     records that derivation as WRONG on `perfect rhyme · count ·
#     line_final_permutation` — derived an identity map, measured 89.5% of
#     replicates differing — and `sweep()` runs every null anyway BECAUSE of
#     it.  The sweep then measures `Result.differing` for every row and
#     nothing ever compares that measurement back to the census that
#     nominated the pair.  `report()` prints a per-row `*** DISAGREEMENT` and
#     returns None.  So the derivation proposes the plan and, for the VERDICT,
#     the derivation also decides — which is exactly what doctrine 68 says it
#     must not do.
#   * "nobody had run it" is `name not in ARM_SCHEMAS`, a statement about a
#     hand-written 3-tuple of arms.  It is a fact about this file's ARMS list,
#     not about whether any measurement of that schema exists.
#
# So `EXTENDABLE 31` in the module docstring was a number NO CODE READ.  It
# could not be wrong because nothing compared it to anything: doctrine 48, in
# the census that was written to enforce doctrine 44.
#
# WHAT THIS SECTION MAKES FAIL.  A frozen ledger of the verdict for all 77
# schemas on ONE NAMED SLICE, plus the two sets in which the census's
# NOMINATION and the sweep's MEASUREMENT disagree, plus `verify_extension()`
# which diffs the recorded against the recomputed and returns a complaint per
# difference.  `--verify` exits nonzero on any complaint.  A schema that gets
# an arm, loses an arm, stops firing, starts refusing, gains a capability,
# empties its null menu, or has a nominated null turn out to be an identity
# map now FAILS a check instead of quietly re-deriving a fresh verdict that
# still says "nobody had run it".
#
# THREE THINGS THE LEDGER DELIBERATELY DOES NOT PIN, each for a stated reason
# (a ledger that pins the wrong coordinate fails on a loaded machine and
# teaches nothing, which is a check that cries wolf rather than one that
# cannot fail — the other failure mode of doctrine 48):
#   * WALL CLOCK.  `budget=None`, so TOO EXPENSIVE cannot occur.  Section 6
#     says that verdict does not reproduce — `compound / phrasal rhyme`
#     crossed the 2 s line between two runs of this exact slice — and pinning
#     a machine's load is not a claim about a schema.  THAT, AND ONLY THAT,
#     is why this ledger records 33 EXTENDABLE where the docstring's
#     budget=2.0 census recorded 31: the two are `chain rhyme (rap)` and
#     `compound / phrasal rhyme`, and on this machine at head they now run in
#     under 2 s anyway.
#   * INSTANCE COUNTS.  `internal rhyme · count` has already been observed to
#     read 20472 and 20482 on the identical slice because the phonology module
#     was edited underneath it.  The ledger pins whether a schema FIRES, which
#     is what the verdict turns on, not how much.
#   * THE OBSERVED STATISTIC.  Same reason.  The deep tier pins whether a null
#     MOVED, never the value it moved to.


#: The slice the ledger is recorded on.  A slice is a coordinate of the number
#: (doctrine 58), so it is pinned HERE and not passed in: a ledger a caller can
#: re-point at another text is a ledger that never fails.
LEDGER_SLICE = ("corpus/song/eng_american_edgar_allan_poe.txt", "eng", 40)

#: Replicates for the DEEP tier.  TEN, and the number is MEASURED rather than
#: chosen round.  At n=4 this file's own known-wrong row — `perfect rhyme ·
#: count · line_final_permutation`, derived an identity map, recorded at 89.5%
#: differing — moved 0 of 4 and `OFF_MENU_MOVERS` could not see it; at n=10 it
#: moves and the set contains it.  Doctrine 28: 0-of-4 was "cannot tell", not
#: "no", and a ledger recorded at an n too small to reach the counterexample
#: the file already knows about would be decoration with a number on it.
LEDGER_REPLICATES = 10

#: None ON PURPOSE — see the third bullet above.  Named rather than inlined so
#: that a future run cannot quietly hand this a budget and change what the
#: recorded verdicts mean.
LEDGER_BUDGET = None


def ledger_slice(root=None):
    """The ledger's text, read once.  -> ((lines, phon, language), None) or
    (None, Refusal).

    REFUSES when the corpus is absent instead of skipping.  A verifier that
    passes because its text is missing is the purest form of the defect this
    section exists to remove (doctrine 48), and `main` turns this refusal into
    exit 2 rather than exit 0.
    """
    from quality.phonology import get as get_phonology
    path, lang, limit = LEDGER_SLICE
    full = os.path.join(root or os.path.dirname(HERE), path)
    if not os.path.exists(full):
        return None, R.Refusal(
            "extension ledger", "corpus",
            f"{path} is absent, so the ledger cannot be verified. REFUSED "
            f"rather than skipped: a check that passes when its text is "
            f"missing is decoration (doctrine 48).")
    return (_read(full, limit), get_phonology(lang), lang), None


def ledger_census(root=None, progress=None):
    """The census the ledger is recorded against.  -> ([Coverage], None) or
    (None, Refusal).  One `realise()` pass per schema; no replicates."""
    got, refusal = ledger_slice(root)
    if refusal is not None:
        return None, refusal
    lines, phon, lang = got
    st = _stream_of([R.tokenise(l) for l in lines if l.strip()], phon, lang)
    return coverage(st, budget=LEDGER_BUDGET, progress=progress), None


def arm_pairs():
    """{(schema, statistic, null)} the RECORDED arms actually ran.

    THE UNIT HERE IS THE PAIR AND `ARM_SCHEMAS`'s IS THE SCHEMA, and the gap
    between the two is a finding rather than pedantry.  `coverage()` grants
    CONTROLLED to a whole schema on the strength of `name in ARM_SCHEMAS`, but
    an arm covers only the statistics and nulls its own tuple names.  On the
    ledger slice the three CONTROLLED schemas carry 16 admissible pairs
    between them and the arms ran 7 of those 16 — so 9 pairs on schemas the
    census calls CONTROLLED have no matched control at all, and in this file's
    own vocabulary they are EXTENDABLE and invisible.  `report_extension`
    prints them; the count is pinned in `EXTENSION_LEDGER`'s fourth column so
    that adding or dropping an arm pair fails this check.
    """
    return frozenset((a[3], s, n) for a in ARMS for s in a[4] for n in a[5])


def menu_pairs(cov):
    """{(schema, statistic, null)} the census NOMINATES — `Coverage.pairs`
    flattened.  This set IS the whole evidentiary content of EXTENDABLE: the
    verdict says "this set is non-empty for this schema" and says nothing
    else."""
    return frozenset((c.schema, sn, nl) for c in cov for sn, nls in c.pairs
                     for nl in nls)


#: THE CENSUS, FROZEN.  (schema, verdict, derived-menu pairs, arm-run pairs) on
#: `LEDGER_SLICE` at `LEDGER_BUDGET`, recorded 2026-08-13.  The third column is
#: `len(menu_pairs)` for that schema — the EXTENDABLE verdict is exactly "this
#: is not zero" — and the fourth is `len(arm_pairs)`, which is exactly "nobody
#: had run it" written as a number instead of as a membership test.  Both
#: claims are now things a diff can contradict.
#:
#: REGENERATE WITH `--verify --record`, which prints this table and the two
#: below to stdout for pasting.  It does not edit the file: a ledger a program
#: can rewrite when it disagrees with itself is not a ledger.
EXTENSION_LEDGER = (
    ('perfect rhyme',                           'controlled',      6,  4),
    ('rime riche',                              'extendable',      6,  0),
    ('repetition',                              'extendable',      3,  0),
    ('antanaclasis',                            'cannot_obtain',   4,  0),
    ('assonance',                               'extendable',      6,  0),
    ('consonance',                              'extendable',      6,  0),
    ('cluster consonance / skothending span',   'no_instance',     4,  0),
    ('parechesis / general consonance',         'no_instance',     2,  0),
    ('pararhyme',                               'extendable',      6,  0),
    ('reverse rhyme',                           'extendable',      6,  0),
    ('alliteration',                            'extendable',      1,  0),
    ('Kalevala alliteration (weak)',            'controlled',      2,  3),
    ('Kalevala alliteration (strong)',          'extendable',      2,  0),
    ('paroemion',                               'no_instance',     6,  0),
    ('family rhyme',                            'cannot_obtain',   8,  0),
    ('additive rhyme',                          'no_instance',     8,  0),
    ('subtractive rhyme',                       'extendable',      8,  0),
    ('semirhyme',                               'extendable',      8,  0),
    ('apocopated rhyme',                        'no_instance',     8,  0),
    ('light rhyme',                             'no_instance',     8,  0),
    ('wrenched rhyme',                          'cannot_obtain',   8,  0),
    ('syllabic rhyme',                          'extendable',      8,  0),
    ('amphisbaenic rhyme',                      'no_instance',     6,  0),
    ('eye rhyme',                               'cannot_obtain',   8,  0),
    ('historical rhyme',                        'cannot_obtain',   8,  0),
    ('dialect rhyme',                           'cannot_obtain',   8,  0),
    ('homoioteleuton',                          'cannot_obtain',   8,  0),
    ('polyptoton',                              'cannot_obtain',   4,  0),
    ('multisyllabic rhyme',                     'cannot_obtain',   6,  0),
    ('mosaic rhyme',                            'extendable',      8,  0),
    ('compound / phrasal rhyme',                'extendable',      8,  0),
    ('holorhyme',                               'cannot_obtain',   2,  0),
    ('broken rhyme',                            'no_instance',     8,  0),
    ('enjambed rhyme',                          'extendable',      4,  0),
    ('rhyming reduplication',                   'no_instance',     0,  0),
    ('ablaut reduplication',                    'no_instance',     0,  0),
    ('exact reduplication',                     'no_instance',     0,  0),
    ('internal rhyme',                          'controlled',      8,  6),
    ('leonine rhyme',                           'cannot_obtain',   2,  0),
    ('cross rhyme',                             'extendable',      4,  0),
    ('interlaced rhyme',                        'extendable',      4,  0),
    ('linked rhyme',                            'extendable',      2,  0),
    ('head rhyme (positional)',                 'extendable',      6,  0),
    ('anaphora',                                'extendable',      6,  0),
    ('epistrophe / radif',                      'cannot_obtain',   3,  0),
    ('qafiya (before the radif)',               'cannot_obtain',   3,  0),
    ('symploce',                                'extendable',      6,  0),
    ('anadiplosis',                             'no_instance',     2,  0),
    ('epanalepsis',                             'extendable',      1,  0),
    ('analysed rhyme',                          'extendable',     10,  0),
    ('monorhyme / leash',                       'extendable',     13,  0),
    ('chain rhyme (rap)',                       'extendable',     12,  0),
    ('alliterative long line',                  'cannot_obtain',   2,  0),
    ('fourth lift must not alliterate',         'cannot_obtain',   1,  0),
    ('dvitiyakshara-prasa',                     'extendable',      9,  0),
    ('monai',                                   'extendable',      9,  0),
    ('cynghanedd groes',                        'cannot_obtain',   2,  0),
    ('cynghanedd draws',                        'cannot_obtain',   2,  0),
    ('cynghanedd groes o gyswllt',              'cannot_obtain',   2,  0),
    ('cynghanedd sain',                         'extendable',      1,  0),
    ('cynghanedd sain gadwynog',                'extendable',      1,  0),
    ('cynghanedd sain lafarog',                 'extendable',      1,  0),
    ('cynghanedd sain drosgl',                  'extendable',      1,  0),
    ('cynghanedd lusg',                         'extendable',      1,  0),
    ('proest',                                  'cannot_obtain',   8,  0),
    ("Scots vowel-length rhyme (Aitken's Law)", 'extendable',      8,  0),
    ('Middle Chinese end rhyme (同用 group)',     'cannot_obtain',   8,  0),
    ('平仄 tonal template',                       'no_instance',     5,  0),
    ('pantun ABAB',                             'extendable',      4,  0),
    ('blues AAB stanza',                        'no_instance',     2,  0),
    ('offbeat internal rhyme',                  'cannot_obtain',   4,  0),
    ('rhyming slang',                           'cannot_obtain',   4,  0),
    ('transformative / bent rhyme',             'cannot_obtain',   4,  0),
    ('sung-delivery rhyme',                     'cannot_obtain',   4,  0),
    ('refrain by reference',                    'cannot_obtain',   4,  0),
    ('incremental repetition',                  'no_instance',     5,  0),
    ('trite rhyme',                             'cannot_obtain',   8,  0),
)

#: THE DERIVATION'S OWN ERROR, FROZEN — DIRECTION ONE.  Pairs the census
#: NOMINATED (they are in `Coverage.pairs`, so they are part of why their
#: schema is EXTENDABLE at all) and which moved ZERO of `LEDGER_REPLICATES`
#: replicates in a full `sweep()` of the ledger slice.
#:
#: DOCTRINE 28, AND THE NAME OF THIS TABLE IS THE DOCTRINE.  This is NOT
#: "the null is an identity map here" — no finite n can say that, and calling
#: it that would be the same collapse of "cannot tell" into "none" that
#: doctrine 20 refuses one layer up.  It is "the nomination is not backed by
#: this measurement", which is weaker, is decidable, and is the claim the
#: marker has to answer for.  `semirhyme · local_fraction@2 · global_redeal`
#: is the worked case: silent at n=4, moving at n=10, so a ledger recorded at
#: n=4 would have carried it here and been wrong about it.
#:
#: 39 of the 195 nominated pairs on this slice, over 13 of the 33 EXTENDABLE
#: schemas — one nominated pair in five.
MENU_SILENT = (
    ("Scots vowel-length rhyme (Aitken's Law)",
     'local_fraction@0', 'global_redeal'),
    ("Scots vowel-length rhyme (Aitken's Law)",
     'local_fraction@0', 'within_line_shuffle'),
    ('analysed rhyme', 'count', 'line_permutation'),
    ('analysed rhyme', 'local_fraction@0', 'global_redeal'),
    ('analysed rhyme', 'local_fraction@0', 'line_permutation'),
    ('analysed rhyme', 'local_fraction@0', 'within_line_shuffle'),
    ('anaphora', 'local_fraction@2', 'line_final_permutation'),
    ('chain rhyme (rap)', 'line_fraction', 'global_redeal'),
    ('chain rhyme (rap)', 'line_fraction', 'line_final_permutation'),
    ('chain rhyme (rap)', 'line_fraction', 'line_permutation'),
    ('chain rhyme (rap)', 'line_fraction', 'within_line_shuffle'),
    ('dvitiyakshara-prasa', 'line_fraction', 'global_redeal'),
    ('dvitiyakshara-prasa', 'line_fraction', 'line_final_permutation'),
    ('dvitiyakshara-prasa', 'line_fraction', 'line_permutation'),
    ('head rhyme (positional)', 'local_fraction@2', 'line_final_permutation'),
    ('monai', 'line_fraction', 'global_redeal'),
    ('monai', 'line_fraction', 'line_final_permutation'),
    ('monai', 'line_fraction', 'line_permutation'),
    ('monorhyme / leash', 'count', 'line_permutation'),
    ('monorhyme / leash', 'line_fraction', 'global_redeal'),
    ('monorhyme / leash', 'line_fraction', 'line_permutation'),
    ('monorhyme / leash', 'line_fraction', 'within_line_shuffle'),
    ('monorhyme / leash', 'local_fraction@0', 'global_redeal'),
    ('monorhyme / leash', 'local_fraction@0', 'line_permutation'),
    ('monorhyme / leash', 'local_fraction@0', 'within_line_shuffle'),
    ('rime riche', 'local_fraction@2', 'global_redeal'),
    ('rime riche', 'local_fraction@2', 'within_line_shuffle'),
    ('semirhyme', 'local_fraction@0', 'global_redeal'),
    ('semirhyme', 'local_fraction@0', 'within_line_shuffle'),
    ('semirhyme', 'local_fraction@2', 'line_final_permutation'),
    ('semirhyme', 'local_fraction@2', 'line_permutation'),
    ('subtractive rhyme', 'local_fraction@0', 'global_redeal'),
    ('subtractive rhyme', 'local_fraction@0', 'within_line_shuffle'),
    ('syllabic rhyme', 'local_fraction@0', 'global_redeal'),
    ('syllabic rhyme', 'local_fraction@0', 'within_line_shuffle'),
    ('symploce', 'local_fraction@2', 'global_redeal'),
    ('symploce', 'local_fraction@2', 'line_final_permutation'),
    ('symploce', 'local_fraction@2', 'line_permutation'),
    ('symploce', 'local_fraction@2', 'within_line_shuffle'),
)

#: THE DERIVATION'S OWN ERROR, FROZEN — DIRECTION TWO, and this one is a
#: PROOF.  Pairs `null_menu` called identity maps (they are NOT in
#: `Coverage.pairs`) and which moved at least one replicate.  One differing
#: replicate refutes an identity map outright, so unlike `MENU_SILENT` these
#: rows need no n at all to be conclusive — they only need an n large enough
#: to reach them, which is the other half of why `LEDGER_REPLICATES` is 10.
#:
#: `('perfect rhyme', 'count', 'line_final_permutation')` IS IN THIS TABLE,
#: and it is the row this file's own docstring records at 89.5% differing and
#: `sweep()`'s docstring names as the reason `derived_only` is not the
#: default.  Until now that counterexample lived in prose; a change to
#: `_PLACEMENT_READS` or `_GAP_FORCED` that silently "fixed" the derivation
#: into agreeing with itself would have left the prose standing and nothing
#: would have failed.
#:
#: THIS SET MATTERS TO THE MARKER AND NOT ONLY TO THE MENU.  A schema whose
#: menu is empty is CANNOT FAIL, whose remedy is "build a new randomisation";
#: a single entry here on such a schema would mean the remedy is wrong and the
#: right one was "run it".  There are none on this slice because there are no
#: CANNOT FAIL schemas on it — the three reduplications are NO INSTANCE here —
#: and that is itself worth stating: the CANNOT FAIL verdict has never been
#: measured on a text where its schemas fire, so it is inconclusive by
#: construction (doctrine 20) and this ledger cannot yet make it fail.
#:
#: 43 rows over 29 schemas.  29 of them are `line_final_permutation`, which is
#: the mechanism `report()` already names: a permutation moves UNREADABLE
#: tokens between lines and `line_final_token` is the last token the
#: declaration could READ, so a swap changes which word is line-final.  That
#: is an ingestion effect wearing a placement number (doctrine 79), and it is
#: not in `_PLACEMENT_READS` because it is not a placement fact.
OFF_MENU_MOVERS = (
    ('Kalevala alliteration (strong)', 'count', 'line_final_permutation'),
    ('Kalevala alliteration (strong)',
     'line_fraction', 'line_final_permutation'),
    ('Kalevala alliteration (weak)', 'count', 'line_final_permutation'),
    ('Kalevala alliteration (weak)',
     'line_fraction', 'line_final_permutation'),
    ("Scots vowel-length rhyme (Aitken's Law)",
     'count', 'line_final_permutation'),
    ('alliteration', 'count', 'line_final_permutation'),
    ('analysed rhyme', 'count', 'line_final_permutation'),
    ('assonance', 'count', 'line_final_permutation'),
    ('compound / phrasal rhyme', 'count', 'line_final_permutation'),
    ('compound / phrasal rhyme', 'local_fraction@0', 'line_final_permutation'),
    ('consonance', 'count', 'line_final_permutation'),
    ('cynghanedd lusg', 'count', 'line_final_permutation'),
    ('cynghanedd lusg', 'count', 'within_line_shuffle'),
    ('cynghanedd sain', 'count', 'line_final_permutation'),
    ('cynghanedd sain drosgl', 'count', 'line_final_permutation'),
    ('cynghanedd sain gadwynog', 'count', 'line_final_permutation'),
    ('cynghanedd sain lafarog', 'count', 'line_final_permutation'),
    ('dvitiyakshara-prasa', 'count', 'within_line_shuffle'),
    ('dvitiyakshara-prasa', 'local_fraction@2', 'within_line_shuffle'),
    ('epanalepsis', 'count', 'line_final_permutation'),
    ('epanalepsis', 'count', 'within_line_shuffle'),
    ('head rhyme (positional)', 'count', 'line_final_permutation'),
    ('internal rhyme', 'count', 'line_final_permutation'),
    ('internal rhyme', 'local_fraction@0', 'line_final_permutation'),
    ('linked rhyme', 'count', 'global_redeal'),
    ('linked rhyme', 'count', 'within_line_shuffle'),
    ('monai', 'count', 'within_line_shuffle'),
    ('monai', 'local_fraction@2', 'within_line_shuffle'),
    ('monorhyme / leash', 'count', 'line_final_permutation'),
    ('mosaic rhyme', 'count', 'line_final_permutation'),
    ('mosaic rhyme', 'local_fraction@0', 'line_final_permutation'),
    ('perfect rhyme', 'count', 'line_final_permutation'),
    ('repetition', 'count', 'global_redeal'),
    ('repetition', 'count', 'within_line_shuffle'),
    ('repetition', 'local_fraction@2', 'within_line_shuffle'),
    ('reverse rhyme', 'count', 'line_final_permutation'),
    ('rime riche', 'count', 'line_final_permutation'),
    ('semirhyme', 'count', 'line_final_permutation'),
    ('semirhyme', 'count', 'line_permutation'),
    ('subtractive rhyme', 'count', 'line_final_permutation'),
    ('subtractive rhyme', 'count', 'line_permutation'),
    ('syllabic rhyme', 'count', 'line_final_permutation'),
    ('symploce', 'count', 'line_permutation'),
)


def measured_menu(results, census):
    """The two ways the census's NOMINATION and the sweep's MEASUREMENT can
    disagree.  -> (silent, movers), both frozensets of (schema, statistic,
    null).  See `MENU_SILENT` and `OFF_MENU_MOVERS` for what each direction is
    entitled to claim; they are not symmetric and the tables say why.

    Restricted to the schemas `sweep` itself calls live, because a row on a
    NO INSTANCE or CANNOT OBTAIN schema is not a statement about a null.
    """
    live = {c.schema for c in census
            if c.verdict in ("controlled", "extendable", "cannot_fail")}
    menu = menu_pairs(census)
    silent, movers = set(), set()
    for r in results:
        if isinstance(r, R.Refusal) or r.schema not in live:
            continue
        k = (r.schema, r.statistic, r.null)
        if k in menu:
            if r.differing == 0.0:
                silent.add(k)
        elif r.differing > 0.0:
            movers.add(k)
    return frozenset(silent), frozenset(movers)


def _pair_diff(label, recorded, measured, gained, lost):
    """One complaint per row that entered or left a frozen pair table."""
    out = []
    for k in sorted(measured - recorded):
        out.append(f"{label} GAINED {k[0]!r} · {k[1]} · {k[2]} — {gained}")
    for k in sorted(recorded - measured):
        out.append(f"{label} LOST {k[0]!r} · {k[1]} · {k[2]} — {lost}")
    return out


def verify_extension(deep=False, root=None, progress=None, cov=None):
    """Diff the frozen ledger against a fresh census.  -> [complaint].

    EMPTY MEANS THE MARKERS STILL SAY WHAT THEY SAID WHEN THEY WERE RECORDED.
    Non-empty is the point of the section: every entry names a marker that
    moved while the table describing it did not.

    `deep=True` also runs a full `sweep()` at `LEDGER_REPLICATES` on the same
    slice and diffs `MENU_SILENT`/`OFF_MENU_MOVERS`, which is the only tier
    that checks EXTENDABLE's own "a null in the inventory bites" against a
    measurement rather than against the derivation that made the claim.
    """
    if cov is None:
        cov, refusal = ledger_census(root, progress)
        if refusal is not None:
            return [f"REFUSED: {refusal.detail}"]
    arms = arm_pairs()
    have = {c.schema: (c.verdict,
                       sum(len(nl) for _sn, nl in c.pairs),
                       sum(1 for p in arms if p[0] == c.schema))
            for c in cov}
    want = {r[0]: tuple(r[1:]) for r in EXTENSION_LEDGER}
    row = {c.schema: c for c in cov}
    out = []
    for name in sorted(set(want) - set(have)):
        out.append(f"{name!r}: recorded in EXTENSION_LEDGER and ABSENT from "
                   f"R.REGISTRY — a schema was renamed or deleted and the "
                   f"ledger was not told.")
    for name in sorted(set(have) - set(want)):
        out.append(f"{name!r}: declared in R.REGISTRY and ABSENT from "
                   f"EXTENSION_LEDGER — a new schema reaches the same printed "
                   f"instance count with no recorded verdict behind it. This "
                   f"is the defect the census was written to count, arriving "
                   f"one schema at a time.")
    for name in sorted(set(want) & set(have)):
        w, h = want[name], have[name]
        if w[0] != h[0]:
            out.append(
                f"{name!r}: recorded {w[0].upper()}, measured {h[0].upper()} "
                f"on the ledger slice. The verdict decides which of six "
                f"REMEDIES this schema is printed with (doctrine 44) and they "
                f"are not interchangeable — readers are now sent to: "
                f"{row[name].remedy}")
        if w[1] != h[1]:
            out.append(
                f"{name!r}: the derived null menu was {w[1]} (statistic, "
                f"null) pairs and is now {h[1]}. EXTENDABLE means exactly "
                f"'this number is not zero', so a change in it is a change in "
                f"the only evidence the verdict has.")
        if w[2] != h[2]:
            out.append(
                f"{name!r}: the recorded ARMS ran {w[2]} (statistic, null) "
                f"pairs for it and now run {h[2]} — 'nobody had run it' "
                f"moved and the marker did not.")
    n_have = sum(1 for v in have.values() if v[0] == "extendable")
    n_want = sum(1 for r in EXTENSION_LEDGER if r[1] == "extendable")
    if n_have != n_want:
        out.append(f"EXTENDABLE is {n_have} on the ledger slice; the ledger "
                   f"and this file's docstring say {n_want}. That headline is "
                   f"quoted in quality/RESULTS_NULL_SHAPES.md §4b as well.")
    if not deep:
        return out
    got, refusal = ledger_slice(root)
    if refusal is not None:
        return out + [f"REFUSED: {refusal.detail}"]
    lines, phon, lang = got
    results, census = sweep(lines, phon, lang, n=LEDGER_REPLICATES,
                            budget=LEDGER_BUDGET, progress=progress)
    silent, movers = measured_menu(results, census)
    out += _pair_diff(
        "MENU_SILENT", frozenset(MENU_SILENT), silent,
        "the census nominates this pair as a reason its schema is EXTENDABLE "
        "and it moved 0 of %d replicates. The nomination is not backed."
        % LEDGER_REPLICATES,
        "this pair moved, so the recorded 'not backed' is stale — good news, "
        "and it still has to be recorded.")
    out += _pair_diff(
        "OFF_MENU_MOVERS", frozenset(OFF_MENU_MOVERS), movers,
        "`null_menu` calls this pair an identity map and it MOVED. One "
        "differing replicate refutes an identity map outright, so the "
        "derivation is wrong here and `_PLACEMENT_READS`/`_GAP_FORCED` owe an "
        "entry (doctrine 68).",
        "the derivation's known error no longer reproduces here. Either it "
        "was corrected or the row stopped being reached; both need saying.")
    return out


def record_extension(deep=False, root=None, progress=None):
    """Print the ledger tables as Python literals, for pasting.  Does NOT edit
    this file: a table a program rewrites whenever it disagrees with itself is
    not a ledger, it is a cache with a comment on it."""
    cov, refusal = ledger_census(root, progress)
    if refusal is not None:
        print(f"REFUSED: {refusal.detail}")
        return 2
    arms = arm_pairs()
    rows = [(c.schema, c.verdict, sum(len(nl) for _sn, nl in c.pairs),
             sum(1 for p in arms if p[0] == c.schema)) for c in cov]
    w = max(len(repr(r[0])) for r in rows)
    print("EXTENSION_LEDGER = (")
    for r in rows:
        print(f"    ({repr(r[0]) + ',':{w + 1}} {repr(r[1]) + ',':17} "
              f"{r[2]:2}, {r[3]:2}),")
    print(")")
    if not deep:
        print("\n# --deep for MENU_SILENT / OFF_MENU_MOVERS "
              "(one full sweep, minutes not seconds)")
        return 0
    got, _ref = ledger_slice(root)
    lines, phon, lang = got
    results, census = sweep(lines, phon, lang, n=LEDGER_REPLICATES,
                            budget=LEDGER_BUDGET, progress=progress)
    silent, movers = measured_menu(results, census)
    for label, table in (("MENU_SILENT", silent),
                         ("OFF_MENU_MOVERS", movers)):
        print(f"\n{label} = (")
        for k in sorted(table):
            one = f"    ({k[0]!r}, {k[1]!r}, {k[2]!r}),"
            if len(one) <= 79:
                print(one)
            else:
                print(f"    ({k[0]!r},")
                print(f"     {k[1]!r}, {k[2]!r}),")
        print(")")
    return 0


def report_extension(complaints, cov=None):
    """Print the verdict, and print the ARM-COVERAGE gap whether or not
    anything failed — because that gap is not a regression, it is the standing
    state of the CONTROLLED marker and a check that only speaks when something
    changes never tells a first reader what the marker means."""
    if cov is not None:
        arms = arm_pairs()
        print("\n  CONTROLLED IS GRANTED PER SCHEMA AND EARNED PER PAIR:")
        for c in cov:
            if c.verdict != "controlled":
                continue
            adm = {(sn, nl) for sn, nls in c.pairs for nl in nls}
            ran = {(p[1], p[2]) for p in arms if p[0] == c.schema}
            print(f"     {c.schema}: {len(adm & ran)} of {len(adm)} "
                  f"admissible pairs have an arm; {len(ran - adm)} arm "
                  f"pair(s) sit OUTSIDE the derived menu")
            for k in sorted(adm - ran):
                print(f"        no arm: {k[0]} under {k[1]}")
    print()
    if not complaints:
        print("  LEDGER HOLDS. Every schema's verdict, derived null menu and "
              "arm-pair count\n  is what was recorded, on the recorded slice.")
        return 0
    print(f"  *** {len(complaints)} MARKER(S) MOVED AND THE LEDGER DID NOT")
    for c in complaints:
        print(f"     {c}")
    print("\n  Re-record with `--verify --record` once each line above has "
          "been READ,\n  never before: the point of the table is that a "
          "human decided the new\n  value is right, and a regenerated table "
          "nobody read is the comment this\n  section replaced.")
    return 1


# ---------------------------------------------------------------------------
# 8. THE DETECTION FLOOR, PER SCHEMA (doctrines 31 and 76)
# ---------------------------------------------------------------------------


def plant_locality(lines, phon, schema, language, chans=None,
                   keep=("true", "none"), tokeniser=R.tokenise):
    """A PLANTED-SIGNAL positive control, generic over every schema.

    -> (planted token grid, order) or (None, Refusal).

    DOCTRINE 31 says run the positive control BEFORE believing any null, and
    doctrine 76 says report its sensitivity NEXT TO the null, because a null
    from an instrument with no demonstrated detection floor is an
    unfalsifiable claim wearing a number.  The Kalevala arm is this file's
    floor for one schema and one statistic; a sweep over sixty schemas cannot
    borrow it, and hand-planting a signal per schema would need sixty
    different plants.

    So the signal is planted out of the TEXT'S OWN detected instances: realise
    the schema, take the lines its true instances join, and REORDER the lines
    so the members of each connected component sit together.  The planted text
    is a PERMUTATION OF THE ORIGINAL LINES, which is what makes this a control
    and not a fabrication — it is a member of the `line_permutation` null's
    own support, chosen adversarially rather than at random, so the null's max
    and the planted value are on one scale by construction.  If a locality
    statistic cannot separate the ADVERSARIAL member of a null family from its
    random members, that statistic could not have found a signal in this
    schema whatever the corpus said, and every null on it means nothing.

    Note what moves and what does not.  For a schema with no bounded
    line-distance placement the instance SET is invariant under this reorder
    (this file's finding 1), so the planted arm moves the statistic and
    nothing else.  For a schema WITH one, concentrating partners makes MORE
    pairs eligible, so the planted arm is a signal in both the placement and
    the count — stronger, not weaker, and it is still one permutation of the
    same lines.
    """
    if isinstance(schema, str):
        schema = R.REGISTRY[schema]
    toks = [tokeniser(l) for l in lines if l.strip()]
    st = _stream_of(toks, phon, language)
    kw = {} if chans is None else {"chans": chans}
    out = R.realise(schema, st, keep=keep, **kw)
    if isinstance(out, R.Refusal):
        return None, out
    parent = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for i in out:
        if i.verdict is not True:
            continue
        a = st.units[i.a.head()].line
        b = st.units[i.b.head()].line
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
    comps = {}
    for li in list(parent):
        comps.setdefault(find(li), []).append(li)
    order, seen = [], set()
    for _root, members in sorted(comps.items(),
                                 key=lambda kv: (-len(kv[1]), kv[0])):
        for li in sorted(members):
            if li not in seen:
                order.append(li)
                seen.add(li)
    order += [li for li in range(len(toks)) if li not in seen]
    return [toks[i] for i in order], None


def sensitivity(lines, phon, schema, statistic, language, chans=None,
                keep=("true", "none"), tokeniser=R.tokenise):
    """The planted arm's value for one schema+statistic.  -> float or Refusal.

    Read it against the SAME statistic's null max from `sweep`/`run_many`:
    planted <= null max is a FAILED detection floor and the null beside it is
    uninterpretable, exactly as the time layer's sonnet arm was (doctrine 76).
    """
    if isinstance(schema, str):
        schema = R.REGISTRY[schema]
    st_obj = STATISTICS[statistic] if isinstance(statistic, str) else statistic
    planted, refusal = plant_locality(lines, phon, schema, language, chans,
                                      keep, tokeniser)
    if refusal is not None:
        return refusal
    st = _stream_of(planted, phon, language)
    vals, refusal = _measure(st, schema, [st_obj], chans, keep)
    if refusal is not None:
        return refusal
    return None if vals is None else vals[0]


USAGE = """quality/relations_null.py - matched controls for relations.py

  (no argument)          the three hand-written ARMS, n=200, ~25 min.  Prints
                         the coverage census first, so a run cannot report
                         three schemas without saying how many it did not.
  --n=N                  replicates (all modes)
  --arm=I --null=NAME    one arm / one null, for a resumable chunked run
  --coverage             the census only, DERIVED (instant, no text)
  --coverage --corpus=P  the census MEASURED on a text: adds CANNOT OBTAIN,
                         NO INSTANCE and TOO EXPENSIVE, which are facts about
                         a text and cannot be derived
  --sweep                run a null for EVERY schema the census calls
                         extendable, off shared replicates.  Bound it with
                         --n=, --limit= and --budget=.
  --sensitivity          the planted-locality detection floor per schema
                         (doctrines 31/76), printed beside the sweep
  --verify               DIFF the frozen EXTENSION_LEDGER against a fresh
                         census on the ledger's own pinned slice.  Exit 1 on
                         any marker that moved, exit 2 if the slice is
                         missing.  ~5 s, takes no --corpus/--limit/--budget:
                         a check whose text a caller can re-point is a check
                         that never fails (doctrine 48)
  --verify --deep        also re-measures the derivation against a full sweep
                         at LEDGER_REPLICATES and diffs MENU_SILENT and
                         OFF_MENU_MOVERS.  ~4 min; the only tier that checks
                         EXTENDABLE's "a null bites" against a MEASUREMENT
  --verify --record      print the ledger tables as literals, for pasting
                         after a human has read the complaints
  --corpus=PATH          text, relative to the repo root
  --lang=CODE            phonology (default eng)
  --limit=N              first N lines of it (a slice is a coordinate of the
                         number — doctrine 58)
  --budget=SECONDS       per-`realise()` ceiling; over it a schema is reported
                         TOO EXPENSIVE with its measured seconds, never
                         silently dropped
  --brief                one line per schema in the census instead of the
                         remedy paragraphs
"""


def _census_headline(cov):
    by = {v: sum(1 for c in cov if c.verdict == v) for v in VERDICTS}
    return (f"{len(cov)} schemas declared; {by['controlled']} have a "
            f"hand-written arm in this file, {by['extendable']} could have "
            f"one and never did")


def main(argv=()):
    """`--n=` replicates, `--arm=` one arm by index, `--null=` one null,
    `--coverage`/`--sweep`/`--sensitivity` for the whole-registry modes.

    The arm filters exist because the `internal rhyme` arm is ~1.9s per
    replicate on 200 lines of Poe -- 19 minutes for its three nulls -- and a
    runner you cannot resume is a runner nobody runs.  The seed is derived per
    replicate index, so a chunked run and a whole one give the SAME numbers
    (doctrine 66); chunking is not a different experiment.
    """
    from quality.phonology import get as get_phonology
    n, only_arm, only_null = 200, None, None
    mode, corpus, lang, limit = "arms", None, "eng", None
    budget, brief = 2.0, False
    deep, record = False, False
    for a in argv:
        if a.startswith("--n="):
            n = int(a.split("=", 1)[1])
        elif a.startswith("--arm="):
            only_arm = int(a.split("=", 1)[1])
        elif a.startswith("--null="):
            only_null = a.split("=", 1)[1]
        elif a.startswith("--corpus="):
            corpus = a.split("=", 1)[1]
        elif a.startswith("--lang="):
            lang = a.split("=", 1)[1]
        elif a.startswith("--limit="):
            limit = int(a.split("=", 1)[1])
        elif a.startswith("--budget="):
            budget = float(a.split("=", 1)[1])
        elif a == "--brief":
            brief = True
        elif a == "--deep":
            deep = True
        elif a == "--record":
            record = True
        elif a in ("--coverage", "--sweep", "--sensitivity", "--verify"):
            mode = a[2:]
        elif a in ("-h", "--help"):
            print(USAGE)
            return 0
    root = os.path.dirname(HERE)
    if mode == "verify":
        return _main_verify(root, deep, record)
    if mode in ("coverage", "sweep", "sensitivity"):
        return _main_registry(mode, root, corpus, lang, limit, n, budget,
                              brief, get_phonology)
    print("=" * 74)
    print("RELATIONS NULLS — BACKLOG §2.6.  seed", SEED, " replicates", n)
    print("A count is not evidence. The excess over a matched control is the "
          "part attributable\nto the poet, and only that part is worth "
          "reporting (doctrines 56/61/64).")
    print("=" * 74)
    # THE CENSUS FIRST, ALWAYS, and it costs nothing.  Three arms printed with
    # no denominator beside them is this file's own version of the defect it
    # was written to fix: a number with its population left out.  Doctrine 79.
    print("\nCOVERAGE, before any arm runs: "
          + _census_headline(coverage()))
    print("  `--coverage` for the six-way split and the remedy each one "
          "implies; `--sweep` runs\n  the extendable ones.  A schema with no "
          "null is not a schema that came back null.")
    arms = list(ARMS) if only_arm is None else [ARMS[only_arm]]
    for path, lang, limit, schema, stats, nulls in arms:
        if only_null:
            nulls = tuple(x for x in nulls if x == only_null)
            if not nulls:
                continue
        full = os.path.join(root, path)
        if not os.path.exists(full):
            print(f"\n### {schema}: corpus absent ({path}) — arm SKIPPED, "
                  f"not reported as null")
            continue
        lines = _read(full, limit)
        phon = get_phonology(lang)
        print(f"\n### {schema}  ·  {os.path.basename(path)}  ·  "
              f"{len(lines)} lines  ·  phonology {lang}", flush=True)
        print(f"    slice: non-blank lines, '#' and '[' rows dropped, first "
              f"{limit} of what remains")
        rows = table(lines, phon, schema, list(stats), nulls, n=n,
                     language=lang)
        for stname in stats:
            print(f"\n  -- statistic: {stname}", flush=True)
            note = STATISTICS[stname].note
            if note:
                print(f"     {note}")
            report(rows.get(stname, rows.get("REFUSED", [])))
    print("=" * 74)
    print("SENSITIVITY, printed beside the nulls (doctrine 76): the Kalevala "
          "arm above is\nthis file's detection floor — the SAME code path, "
          "the same permutation machinery\nand the same statistic recover a "
          "+0.5 excess at 100% of replicates differing. A\nnull from an "
          "instrument with no demonstrated sensitivity is an unfalsifiable "
          "claim\nwearing a number.")
    return 0


def _main_verify(root, deep, record):
    """`--verify`: the extension ledger, section 7b.  0 / 1 / 2.

    THREE EXIT CODES AND NOT TWO.  0 the markers hold, 1 a marker moved, 2 the
    ledger could not be read at all — a caller in CI has to be able to tell a
    verified ledger from an unverifiable one, which is doctrine 20 at the
    process boundary (the same reason `brief`/`verify`/`revise` exit 2 on a
    missing mandate rather than reporting a clean draft).
    """
    path, lang, limit = LEDGER_SLICE
    print("=" * 74)
    print("RELATIONS NULLS · EXTENSION LEDGER (doctrine 48)")
    print("=" * 74)
    print(f"\n  slice   {path}  ·  {limit} lines  ·  phonology {lang}")
    print(f"  budget  {LEDGER_BUDGET} — TOO EXPENSIVE is a wall clock reading "
          f"and does not\n          reproduce, so it is excluded by "
          f"construction rather than pinned")
    print("  depth   " + (f"CENSUS + SWEEP at n={LEDGER_REPLICATES}" if deep
                          else "CENSUS ONLY (--deep for the measured tier)"))
    if record:
        return record_extension(deep=deep, root=root)
    cov, refusal = ledger_census(root)
    if refusal is not None:
        print(f"\n  REFUSED: {refusal.detail}")
        return 2
    complaints = verify_extension(deep=deep, root=root, cov=cov)
    return report_extension(complaints, cov)


def _main_registry(mode, root, corpus, lang, limit, n, budget, brief,
                   get_phonology):
    """`--coverage` / `--sweep` / `--sensitivity`: the whole-registry modes."""
    print("=" * 74)
    print(f"RELATIONS NULLS · {mode.upper()} - seed {SEED}  "
          f"replicates {n}")
    print("=" * 74)
    if corpus is None and mode == "coverage":
        print("\nDERIVATION ONLY — no --corpus=, so CANNOT OBTAIN, NO "
              "INSTANCE and TOO EXPENSIVE\nare not separated out: they are "
              "facts about a TEXT and this mode has none. What\nfollows is "
              "what the schemas' own placement tuples and figures say, and "
              "nothing\nmore (doctrine 28: 'cannot tell' is a third answer "
              "and it is printed as one).\n")
        report_coverage(coverage(), verbose=not brief)
        return 0
    if corpus is None:
        print("REFUSED: --sweep and --sensitivity need --corpus=PATH. A null "
              "with no text is\nnot a null (doctrine 20).")
        return 2
    full = os.path.join(root, corpus)
    if not os.path.exists(full):
        print(f"REFUSED: corpus absent ({corpus}). Not reported as null.")
        return 2
    lines = _read(full, limit)
    phon = get_phonology(lang)
    print(f"\n### {os.path.basename(corpus)}  ·  {len(lines)} lines  ·  "
          f"phonology {lang}  ·  budget {budget:g}s per realise() pass")
    print(f"    slice: non-blank lines, '#' and '[' rows dropped, first "
          f"{limit} of what remains (doctrine 58)")
    if mode == "coverage":
        st = _stream_of([R.tokenise(l) for l in lines if l.strip()], phon,
                        lang)
        report_coverage(coverage(st, budget=budget), verbose=not brief)
        return 0

    t0 = _now()
    results, census = sweep(lines, phon, lang, n=n, budget=budget)
    print(f"\n  sweep wall clock {_now() - t0:.1f}s")
    print("\n" + "-" * 74)
    print("THE CENSUS THIS SWEEP RAN AGAINST")
    print("-" * 74)
    report_coverage(census, verbose=not brief)
    if mode == "sensitivity":
        return _report_sensitivity(lines, phon, lang, results, census)
    print("\n" + "-" * 74)
    print("THE SWEEP")
    print("-" * 74)
    by_stat = {}
    for r in results:
        key = r.statistic if not isinstance(r, R.Refusal) else "REFUSED"
        by_stat.setdefault(key, []).append(r)
    for stname in sorted(by_stat):
        print(f"\n  == statistic: {stname}")
        report(by_stat[stname])
    return 0


def _now():
    import time
    return time.time()


def _report_sensitivity(lines, phon, language, results, census):
    """Doctrine 76, per schema: the planted arm beside the null's max.

    FOUR COUNTS, never one (doctrine 79), and the split between the middle
    two is the point.  A row where the planted value, the observation and
    every replicate are the SAME NUMBER has not failed a detection floor —
    the statistic is CONSTANT on this schema, so there was never an
    experiment.  That is doctrine 20's "inconclusive by construction", and
    reporting it as a failed floor would say the instrument is blind when
    what is true is that the question was empty.  A row where the statistic
    genuinely moved and the plant still could not beat chance IS a failed
    floor, and the null printed beside it means nothing.

    This is also where the derivation deliberately left a gap gets closed by
    measurement.  `_GAP_FORCED` declines to read `both_line_final` as "two
    different lines", because two distinct spans can share one line-final
    unit; so `local_fraction@0` on those schemas is NOT derived constant, and
    every one of them lands in this CONSTANT column instead, demonstrated
    rather than assumed (doctrine 28's third answer, then doctrine 68's
    authority).
    """
    live = {c.schema for c in census
            if c.verdict in ("controlled", "extendable", "cannot_fail")}
    rows = [r for r in results
            if not isinstance(r, R.Refusal) and r.schema in live
            and r.statistic.startswith("local_fraction@")]
    print("\n" + "-" * 74)
    print("DETECTION FLOOR — the planted arm, per schema (doctrines 31/76)")
    print("-" * 74)
    print("  The plant is a REORDER of the text's own lines that puts each\n"
          "  connected component of detected instances together: one member\n"
          "  of the line_permutation null's own support, chosen\n"
          "  adversarially. planted <= null max means the statistic could\n"
          "  not have found locality in this schema, so the null beside it\n"
          "  is uninterpretable and is NOT a negative result.\n")
    clears = fails = constant = unmeasured = 0
    cache = {}
    for r in sorted(rows, key=lambda x: (x.schema, x.statistic, x.null)):
        key = (r.schema, r.statistic)
        if key not in cache:
            cache[key] = sensitivity(lines, phon, r.schema, r.statistic,
                                     language)
        val = cache[key]
        if isinstance(val, R.Refusal) or val is None:
            unmeasured += 1
            print(f"  {r.schema} · {r.statistic} · null={r.null}: floor NOT "
                  f"MEASURED")
            continue
        pinned = (r.differing == 0.0 and val == r.observed
                  and r.null_max == r.observed)
        ok = val > r.null_max
        if pinned:
            constant += 1
            verdict = ("CONSTANT — the plant, the observation and every "
                       "replicate are one number; doctrine 20, not a floor "
                       "failure")
        elif ok:
            clears += 1
            verdict = "floor CLEARS the null"
        else:
            fails += 1
            verdict = "*** FLOOR DOES NOT CLEAR THE NULL"
        print(f"  {r.schema} · {r.statistic} · null={r.null}\n"
              f"      observed {r.observed:.6g}   null max {r.null_max:.6g}   "
              f"PLANTED {val:.6g}   " + verdict)
    print(f"\n  floor clears {clears}  ·  floor does NOT clear {fails}  ·  "
          f"statistic CONSTANT (no experiment) {constant}  ·  not measurable "
          f"{unmeasured}\n  (four counts, doctrine 79 — the middle two are "
          f"different findings with different remedies)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

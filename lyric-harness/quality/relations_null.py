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

Run: python3 quality/relations_null.py             (all three arms, ~25 min)
     python3 quality/relations_null.py --arm=0 --null=global_redeal
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
         reads=("line_distance",),
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


def _statistics_of(toks, phon, schema, statistics, language, chans=None):
    """EVERY statistic from ONE realise() pass over one replicate.

    Statistics are computed together and not one arm at a time, because the
    expensive step is `realise()` and the whole point of doctrine 90 is that
    you look at the SAME replicate through more than one statistic.  Running
    them separately also re-draws the permutation per statistic, so `count`
    and `local_fraction` would have been measured on different replicates of
    the same seed and could not have been read against each other.
    """
    lines = [" ".join(t) for t in toks]
    st = R.build_stream(lines, phon, declaration={"language": language},
                        stanzas=R.stanzas_from_blank_lines(lines))
    kw = {} if chans is None else {"chans": chans}
    out = R.realise(schema, st, keep="all", **kw)
    if isinstance(out, R.Refusal):
        return None, st, out
    inst = [i for i in out if i.verdict is True]
    findings = (R.assemble(schema, out, st)
                if any(s.needs_assemble for s in statistics) else [])
    return ([s.fn(inst, findings, st) for s in statistics], st, None)


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


def main(argv=()):
    """`--n=` replicates, `--arm=` one arm by index, `--null=` one null.

    The arm filters exist because the `internal rhyme` arm is ~1.9s per
    replicate on 200 lines of Poe -- 19 minutes for its three nulls -- and a
    runner you cannot resume is a runner nobody runs.  The seed is derived per
    replicate index, so a chunked run and a whole one give the SAME numbers
    (doctrine 66); chunking is not a different experiment.
    """
    from quality.phonology import get as get_phonology
    n, only_arm, only_null = 200, None, None
    for a in argv:
        if a.startswith("--n="):
            n = int(a.split("=", 1)[1])
        elif a.startswith("--arm="):
            only_arm = int(a.split("=", 1)[1])
        elif a.startswith("--null="):
            only_null = a.split("=", 1)[1]
    root = os.path.dirname(HERE)
    print("=" * 74)
    print("RELATIONS NULLS — BACKLOG §2.6.  seed", SEED, " replicates", n)
    print("A count is not evidence. The excess over a matched control is the "
          "part attributable\nto the poet, and only that part is worth "
          "reporting (doctrines 56/61/64).")
    print("=" * 74)
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


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

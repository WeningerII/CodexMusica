#!/usr/bin/env python3
"""THE REPLACEMENT NEGATIVE CONTROL.  MISSING.md K-2 / K-3, BACKLOG §3.5.

WHAT WAS WRONG.  Every negative-control figure this project has recorded came
from ONE author: `corpus/whitman.txt`, 150 lines.  K-3 records the verdict —
all four figures (18.0, 20.0, 21.3, 26.0%) fall inside one line-permutation
null spanning 6.7–27.3%, so the control never separated from its own null and
"the band tightened the negative control" was never a measurement.  K-2 names
the replacement in one sentence: **the corpus's own shuffled self, plus a
multi-author positive spanning more than one scheme.**  This file is that arm.

THE THREE THINGS THAT CHANGE
  1. THE NEGATIVE IS NO LONGER A TEXT, IT IS AN OPERATION.  The negative
     control is every quatrain in the positive corpus with its own four lines
     permuted.  It is therefore matched on author, period, vocabulary, line
     length, metre, diction and readability by construction, which no second
     poet can be.  Whitman is still run, unchanged, as the LEGACY arm, so the
     replacement is comparable to the record it replaces rather than merely
     different from it.
  2. THE POSITIVE IS MULTI-AUTHOR AND SPANS MORE THAN ONE SCHEME.  Quatrains
     are drawn from `corpus/song/eng_*.txt` — 143 files, one author each, 1567
     to 1929 — capped per file so no author dominates.  The scheme axis is
     NOT the statistic: quatrains are selected by LINE COUNT, a typographic
     property fixed before any rhyme is scored, and the arm is then reported
     per TRADITION GROUP (american / british / celtic / hymn / scots), a
     grouping taken from the filename.  Doctrine 14: a control may not be
     defined in terms of the quantity it controls, and neither may the strata
     a positive is broken into.
  3. THE NULL IS CHOSEN PER PREDICATE AND THE DEGENERATE ONE IS RUN ANYWAY,
     because a null that cannot move is a finding and not a mistake to be
     hidden (doctrines 63, 68, 75).

THE PREDICATES, AND WHAT EACH NULL PRESERVES AND DESTROYS

  line_permutation  PRESERVES every line verbatim, every line-final word, the
                    line count, the vocabulary, every within-line arrangement,
                    and THE WHOLE MULTISET OF RHYMING PAIRS.
                    DESTROYS which line index each line sits at, hence every
                    line DISTANCE between two rhyming lines, hence the scheme.

  P1 · pair count     — the number of rhyming line-pairs in a quatrain.
                        A symmetric function of the four line-final anchors,
                        so line_permutation is THE IDENTITY MAP.  Predicted
                        degenerate, and MEASURED degenerate: differ = 0.0%.
                        It is run and printed rather than omitted, because
                        this is the third mechanism of the same trap
                        (doctrine 63 in Finnish, 68 in Persian, and
                        `quality/relations_null.py` in the relations layer)
                        and a reader needs to see it fail on the material it
                        would actually be reached for.
  P2 · distance profile — the share of rhyming pairs at line distance 1, 2, 3.
                        Reads POSITION, so the same null bites.  Summarised
                        as the total-variation distance between the observed
                        profile and the null's own mean profile.  A DEVIATION
                        statistic, not a scheme-specific one: AABB deviates
                        toward distance 1 and ABAB toward distance 2 and both
                        score above zero, which is what lets one number serve
                        a positive spanning more than one scheme.  It does NOT
                        follow that a mixture cannot cancel — see P2b, where
                        that hypothesis was tested and refuted.
                        Doctrine 90: the statistic changes with the null.
  P2b · mean per-item TV — the same deviation taken per QUATRAIN and then
                        averaged.  Added to test whether P2's one failing
                        stratum failed by cancellation; it does not.  Kept as
                        a second independent reduction of the same null.
  P3 · chain capture   — `infer_chains` share of lines inside a chain >= 2,
                        the statistic `quality/audit_band_control.py` uses, so
                        the legacy Whitman figure and the new corpus figure
                        are the same measurement.  Reads line ADJACENCY, so
                        line_permutation is not degenerate here.

WHY THE PAIR VERDICTS ARE COMPUTED ONCE.  P1 and P2 permute LINE POSITIONS,
and a rhyme verdict between two line-final anchors does not depend on where
the lines sit.  So the six verdicts of a quatrain are scored once and the
replicates permute indices.  This is not an optimisation bolted on afterwards;
it is the same invariance that makes P1 degenerate, used deliberately, and it
means the observation and every replicate are built from ONE set of verdicts
(doctrine 91: build the population the same way before calling it a
comparison).

READING THE OUTPUT.  Every arm prints `differ`, the fraction of replicates
that differ from the observation at all (doctrine 68), and the GAP TO THE
NULL'S MAX rather than a p (doctrine 57 — at n=200 the smallest p obtainable
is 0.005 and it says nothing about how far above the observation sat).

THE RUN.  n=200, seed 20260811, cap 8 quatrains per file: 792 quatrains from
115 files across 6 tradition groups, spanning 15 distinct quatrain schemes
(ABAB=274, AABB=133, ABCB=133, ABAC=44, AAAA=37, AABA=30, ABCD=27, AAAB=27,
ABCC=20, AABC=19, ABBB=17, ABBA=12, ABAA=9, ABCA=8, ABBC=2).  Doctrine 58: the
slice is a coordinate of the number, so it is written next to it.

| arm | observed | null MAX | gap | differ |
|---|---:|---:|---:|---:|
| P1 pair count, ALL          | 1523   | 1523   | **+0**      | **0%** |
| P2 pooled TV, ALL           | 0.2456 | 0.0394 | **+0.2061** | 100% |
| P2b mean per-item TV, ALL   | 0.5402 | 0.4863 | +0.0539     | 100% |
| P2 pooled TV, eng_hall      | 0.4170 | 0.1640 | +0.2530     | 100% |
| P2 pooled TV, eng_hymn      | 0.2831 | 0.0811 | +0.2020     | 100% |
| P2 pooled TV, eng_british   | 0.2620 | 0.0788 | +0.1832     | 100% |
| P2 pooled TV, eng_american  | 0.2109 | 0.0979 | +0.1130     | 100% |
| P2 pooled TV, eng_parlour   | 0.2491 | 0.1503 | +0.0988     | 100% |
| P2 pooled TV, eng_celtic    | 0.0864 | 0.1174 | **−0.0310** | 100% |
| P3 chain capture, corpus    | 0.4792 | 0.5875 | **−0.1083** | 100% |
| P3 chain capture, Whitman   | 0.1733 | 0.1800 | **−0.0067** | 100% |

FOUR THINGS THAT TABLE SAYS

  1. K-3 REPRODUCES, AND IT IS WORSE THAN RECORDED.  Whitman's chain capture
     falls INSIDE its own line-permutation null at n=200 (0.1733 against a
     null max of 0.1800).  At n=10 the same code prints a gap of +0.0600 and
     looks like a result; the null's max only reaches the observation once
     enough replicates are drawn.  Doctrine 30, exactly: a powered null is a
     different claim from an unpowered one, and the underpowered version of
     this arm is a positive finding that does not exist.
  2. THE OBVIOUS NULL IS THE IDENTITY MAP HERE TOO.  0 of 200 replicates move
     the rhyming-pair count, in every stratum.  Finnish (doctrine 63),
     Persian (68), the relations layer (`relations_null.py`), and now English
     song: four mechanisms, one failure.  The count is a symmetric function of
     the four line-final anchors and no permutation of LINES can touch it.
  3. WHAT SURVIVES IS THE POSITION, AND IT IS LARGE.  The pooled distance
     profile is d1 0.3578 / d2 0.5791 / d3 0.0630 against a null mean of
     0.4996 / 0.3336 / 0.1668 -- English song puts its rhyme at distance 2 far
     more, and at distance 3 far less, than its own shuffle allows, at 20.7x
     the null median and +0.2061 past the null's maximum.
  4. CHAIN CAPTURE MOVES THE WRONG WAY ON REAL VERSE.  0.4792 observed against
     a null MEDIAN of 0.5375: shuffling a rhymed quatrain RAISES the share of
     lines the chain search captures.  Same direction-inversion
     `relations_null.py` found for internal rhyme, same mechanism -- a
     structured scheme concentrates rhyme into specific pairs, and a shuffle
     scatters end words into positions where a greedy sequential chain can
     pick them up.  So the statistic behind all four recorded Whitman figures
     is not merely underpowered; on the positive corpus it is anti-correlated
     with the structure it is supposed to detect.

Run: python3 quality/negative_control.py            (all arms, n=200)
     python3 quality/negative_control.py --n=50 --cap=6 --skip-chains
"""
import os
import random
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.dirname(HERE) not in sys.path:
    sys.path.insert(0, os.path.dirname(HERE))

from lyric_harness import (Declaration, Lexicon, admits, best_score,   # noqa: E402
                           infer_chains, line_anchors,
                           readability_records)

#: Doctrine 66. A randomisation with no stated seed is a result that does not
#: reproduce. Replicate r is seeded SEED+r, so replicate 7 is replicate 7 on
#: every machine.
SEED = 20260811

CORPUS = os.path.join(os.path.dirname(HERE), "corpus")
SONG = os.path.join(CORPUS, "song")

#: A quatrain has three distinct line distances and this many pairs at each,
#: which is the CHANCE profile a permutation null must reproduce. It is not
#: used as the null — the null measures its own — but printing it beside the
#: measured one is how a reader checks the null did what it says.
COMBINATORIAL_CHANCE = {1: 3 / 6, 2: 2 / 6, 3: 1 / 6}


# ---------------------------------------------------------------------------
# 1. MATERIAL.  Selected on a TYPOGRAPHIC property, never on a rhyme verdict.
# ---------------------------------------------------------------------------

def _blocks(path):
    """Yield stanzas: maximal runs of non-blank text lines inside a song file.

    `--- MARKER:` header lines, `#` comment lines and `[VERSE n]` / `[REFRAIN]`
    structure markers are separators, not text. They are the corpus's own
    notation, so treating them as lines would put the harness's markup into
    the poet's stanza.
    """
    cur = []
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            s = raw.strip()
            if (not s or s.startswith("#") or s.startswith("--- ")
                    or (s.startswith("[") and s.endswith("]"))):
                if cur:
                    yield cur
                    cur = []
                continue
            cur.append(s)
    if cur:
        yield cur


GROUP = re.compile(r"^eng_([a-z]+)_")


def load_quatrains(cap_per_file=8, min_chars=12):
    """-> [(group, filename, [4 lines])].

    `cap_per_file` bounds one author's contribution so the corpus is not
    Longfellow with a fringe (doctrine 8: never fit on one tradition, and its
    corpus-level form is never MEASURE on one author). The cap is applied to
    the file's quatrains in FILE ORDER, not to a random draw, so the selection
    is a function of the corpus and not of the seed.
    """
    out = []
    for name in sorted(os.listdir(SONG)):
        m = GROUP.match(name)
        if not m:
            continue
        taken = 0
        for blk in _blocks(os.path.join(SONG, name)):
            if taken >= cap_per_file:
                break
            if len(blk) != 4:
                continue
            if any(len(x) < min_chars for x in blk):
                continue
            out.append((m.group(1), name, blk))
            taken += 1
    return out


def whitman_lines():
    """Exactly `quality/audit_band_control.py`'s slice, so the legacy arm's
    number is comparable to the four figures K-3 puts in the dock."""
    path = os.path.join(CORPUS, "whitman.txt")
    lines = [l.strip() for l in open(path, encoding="utf-8")]
    start = next(i for i, l in enumerate(lines)
                 if l.startswith("I celebrate myself"))
    return [l for l in lines[start:start + 220] if l and len(l) > 15][:150]


# ---------------------------------------------------------------------------
# 2. THE VERDICTS.  Scored ONCE per quatrain; the nulls permute positions.
# ---------------------------------------------------------------------------

class Quatrain:
    """Six pairwise verdicts over four line-final anchors, plus the bookkeeping
    that keeps REFUSED separate from NOT-RHYMING (doctrine 79: refused /
    detected / not-detected are three counts, never two)."""

    __slots__ = ("group", "file", "pairs", "refused", "n_read", "scheme")

    def __init__(self, lex, decl, group, fname, lines):
        self.group, self.file = group, fname
        data = []
        for line in lines:
            ancs, last, _ = line_anchors(lex, line, promote=decl.final_promotion)
            data.append((ancs, last))
        recs = readability_records(lex, lines, [d[0] for d in data])
        self.n_read = sum(0 if r["final_unreadable"] else 1 for r in recs)
        self.pairs = set()
        self.refused = set()
        for i in range(4):
            for j in range(i + 1, 4):
                if recs[i]["final_unreadable"] or recs[j]["final_unreadable"]:
                    self.refused.add((i, j))
                    continue
                s = best_score(data[i][0], data[j][0], decl,
                               data[i][1], data[j][1])
                if admits(s, decl.theta_rhyme) or s["relation"] == "REPEAT":
                    self.pairs.add((i, j))
        self.scheme = self._label()

    def _label(self):
        """Read the partition off the graph — never argmax over candidate
        schemes, which would be doctrine 19's biased sweep wearing a letter."""
        comp = {}
        nxt = 0
        for i in range(4):
            if i in comp:
                continue
            stack, lab = [i], nxt
            nxt += 1
            while stack:
                v = stack.pop()
                if v in comp:
                    continue
                comp[v] = lab
                for w in range(4):
                    if w == v:
                        continue
                    e = (min(v, w), max(v, w))
                    if e in self.pairs and w not in comp:
                        stack.append(w)
        seen, ren = {}, []
        for i in range(4):
            if comp[i] not in seen:
                seen[comp[i]] = chr(ord("A") + len(seen))
            ren.append(seen[comp[i]])
        return "".join(ren)

    def distances(self, perm):
        """Line distances of the rhyming pairs once the lines sit at `perm`."""
        pos = {orig: k for k, orig in enumerate(perm)}
        return [abs(pos[i] - pos[j]) for (i, j) in self.pairs]


IDENT = (0, 1, 2, 3)


# ---------------------------------------------------------------------------
# 3. THE STATISTICS
# ---------------------------------------------------------------------------

def stat_pair_count(quats, perms):
    """P1. Number of rhyming pairs. Symmetric in the four anchors, so `perms`
    cannot touch it — which is the point of running it."""
    return sum(len(q.pairs) for q in quats)


def stat_profile(quats, perms):
    """P2. -> {distance: share}. Reads POSITION."""
    c = Counter()
    for q, p in zip(quats, perms):
        c.update(q.distances(p))
    tot = sum(c.values())
    return {d: (c.get(d, 0) / tot if tot else 0.0) for d in (1, 2, 3)}


def tv(profile, ref):
    """Total variation between two distance profiles."""
    return 0.5 * sum(abs(profile[d] - ref[d]) for d in (1, 2, 3))


def stat_mean_item_tv(quats, perms, ref):
    """P2b.  TV computed PER QUATRAIN and then averaged.

    THIS STATISTIC WAS ADDED ON A HYPOTHESIS THAT THE SAME RUN THEN REFUTED,
    and both halves are kept because the refutation is the more useful record.

    THE HYPOTHESIS.  P2 pools every rhyming pair in a stratum into ONE
    distance profile before measuring its distance from chance.  `eng_celtic`
    is the one stratum that does not separate under P2 -- observed TV 0.0864
    against a null MAX of 0.1174, gap -0.0310, on 77 quatrains whose schemes
    are AABB=15, AABC=10, ABAB=10, ABCB=9, ABCD=8 and five more.  AABB puts
    its rhyme at distance 1 and ABAB at distance 2, so the obvious reading is
    that opposite deviations CANCELLED in the pooled profile, and P2b was
    written to defeat exactly that: take each quatrain's own profile, make its
    deviation positive, and only then average.

    THE REFUTATION.  P2b ALSO fails on `eng_celtic` (gap -0.0267), so
    cancellation is not the cause.  The cause is POWER and effect size
    together: the null's width scales with the number of rhyming pairs in the
    stratum -- 1523 pairs give a null MAX of 0.0394, 138 pairs give 0.1174 --
    and eng_celtic's observed deviation is also the smallest of the six
    (0.0864 against 0.2109-0.4170 elsewhere).  A small stratum with a weak
    effect is the ordinary way to fail, and reaching for a cleverer statistic
    would have dressed that up as a fixable defect (doctrine 30: a powered
    null is a different claim from an unpowered one).

    P2b IS KEPT ANYWAY, for one reason: it is a genuinely different reduction
    of the same permutation null, and it agrees with P2 on all five strata
    that separate and on the one that does not.  Two statistics agreeing is
    weaker than one statistic being right (doctrine 25), but two statistics
    DISAGREEING would have been a finding, and running it is how that was
    checked rather than assumed.  Its weakness is stated rather than hidden:
    a quatrain with a single rhyming pair has a degenerate one-point profile
    whose TV is near-constant whichever distance the pair sits at, so P2b is
    dominated by the pair COUNT -- which this null preserves exactly -- and
    its gaps are consequently 4-20x smaller than P2's on the same data.
    """
    tot, m = 0.0, 0
    for q, p in zip(quats, perms):
        ds = q.distances(p)
        if not ds:
            continue                      # no rhyming pair: no profile, and a
            #                               missing profile is not a zero one
        c = Counter(ds)
        prof = {d: c.get(d, 0) / len(ds) for d in (1, 2, 3)}
        tot += tv(prof, ref)
        m += 1
    return (tot / m) if m else 0.0


# ---------------------------------------------------------------------------
# 4. REPORTING.  Doctrine 57 and doctrine 68 are enforced here, once.
# ---------------------------------------------------------------------------

def report(name, obs, nulls, differ, n, unit="", lower_is_better=False):
    nulls = sorted(nulls)
    lo, mid, hi = nulls[0], nulls[len(nulls) // 2], nulls[-1]
    beat = sum(1 for x in nulls if (x <= obs if lower_is_better else x >= obs))
    p = (beat + 1) / (n + 1)
    floor = 1.0 / (n + 1)
    gap = (lo - obs) if lower_is_better else (obs - hi)
    print("  %s" % name)
    print("    observed              %.4f%s" % (obs, unit))
    print("    null  n=%-4d min %.4f  median %.4f  MAX %.4f"
          % (n, lo, mid, hi))
    print("    gap to null %-6s  %+.4f%s"
          % ("MIN" if lower_is_better else "MAX", gap, unit))
    print("    lift over null median %s"
          % ("%.3f" % (obs / mid) if mid else "n/a (null median is 0)"))
    print("    differ                %.1f%% of replicates%s"
          % (100.0 * differ / n,
             "   <- IDENTITY MAP, this null tests NOTHING here"
             if differ == 0 else ""))
    print("    empirical p           %.4f (floor %.4f)%s"
          % (p, floor, "   <- AT THE FLOOR, read the gap" if
             abs(p - floor) < 1e-12 else ""))
    # Read the DIRECTION, not just the size. `quality/relations_null.py` found
    # internal rhyme 20,472 against a null median of 22,820 -- below chance --
    # and the headline count had been quoted as evidence FOR the effect. A
    # statistic that sits under its own null is not a weak positive.
    if differ and not lower_is_better and obs < mid:
        print("    *** BELOW ITS OWN NULL (obs %.4f < null median %.4f). "
              "This is not a\n        weak positive; the statistic moves the "
              "WRONG WAY on this material." % (obs, mid))
    return {"obs": obs, "min": lo, "median": mid, "max": hi,
            "gap": gap, "differ": differ / n, "p": p}


# ---------------------------------------------------------------------------
# 5. THE ARMS
# ---------------------------------------------------------------------------

def arm_scheme(quats, n, label):
    """P1 and P2 over one stratum, under the SAME null.

    The pairing is the exhibit: one null, one corpus, two statistics, and the
    null is the identity map for one of them and not for the other. Doctrine
    75 said choose the null per predicate; this is that sentence with a number
    beside it, on this repo's own English corpus.
    """
    print("\n%s  (%d quatrains, %d files/authors, %d tradition groups)"
          % (label, len(quats), len({q.file for q in quats}),
             len({q.group for q in quats})))
    if not quats:
        print("  EMPTY STRATUM — nothing measured, and that is a count, "
              "not a zero.")
        return None
    n_pairs = sum(len(q.pairs) for q in quats)
    n_ref = sum(len(q.refused) for q in quats)
    print("  pairs judged %d, rhyming %d, REFUSED %d (unreadable final; a "
          "refusal is not a non-rhyme)"
          % (6 * len(quats) - n_ref, n_pairs, n_ref))
    print("  schemes read off the graph: %s"
          % ", ".join("%s=%d" % kv for kv in
                      Counter(q.scheme for q in quats).most_common()))
    if n_pairs == 0:
        print("  NO RHYMING PAIR IN THE STRATUM — the distance profile is "
              "undefined and no null can rescue it (doctrine 20: "
              "inconclusive by construction is not a null).")
        return None

    ident = [IDENT] * len(quats)
    obs_count = stat_pair_count(quats, ident)
    obs_prof = stat_profile(quats, ident)

    # ---- the null, drawn once and reused by both statistics ---------------
    null_perms = []
    for r in range(n):
        rng = random.Random(SEED + r)
        null_perms.append([tuple(rng.sample(range(4), 4)) for _ in quats])

    counts = [stat_pair_count(quats, p) for p in null_perms]
    d_count = sum(1 for c in counts if c != obs_count)
    print("\n  P1 · RHYMING-PAIR COUNT   null = line_permutation")
    print("      PRESERVES every line verbatim, every line-final word, the "
          "whole\n      multiset of rhyming pairs.  DESTROYS line order.")
    r1 = report("pair count", obs_count, counts, d_count, n)

    profs = [stat_profile(quats, p) for p in null_perms]
    ref = {d: sum(pr[d] for pr in profs) / n for d in (1, 2, 3)}
    obs_tv = tv(obs_prof, ref)
    tvs = [tv(pr, ref) for pr in profs]
    d_tv = sum(1 for x in tvs if abs(x - obs_tv) > 1e-12)
    print("\n  P2 · RHYME-DISTANCE PROFILE   same null, different statistic")
    print("      observed  d1 %.4f  d2 %.4f  d3 %.4f"
          % (obs_prof[1], obs_prof[2], obs_prof[3]))
    print("      null mean d1 %.4f  d2 %.4f  d3 %.4f"
          % (ref[1], ref[2], ref[3]))
    print("      combinatorial chance for a 4-line stanza: d1 %.4f  d2 %.4f  "
          "d3 %.4f" % (COMBINATORIAL_CHANCE[1], COMBINATORIAL_CHANCE[2],
                       COMBINATORIAL_CHANCE[3]))
    r2 = report("TV(pooled profile, null mean)", obs_tv, tvs, d_tv, n)

    obs_mtv = stat_mean_item_tv(quats, ident, ref)
    mtvs = [stat_mean_item_tv(quats, p, ref) for p in null_perms]
    d_mtv = sum(1 for x in mtvs if abs(x - obs_mtv) > 1e-12)
    print("\n  P2b · MEAN PER-ITEM TV   same null, each item's deviation made")
    print("       positive BEFORE it is summed. Written to test whether P2's")
    print("       one failing stratum was cancellation under pooling; it was")
    print("       NOT (see the docstring), and P2b is kept as a second,")
    print("       independent reduction of the same null rather than a fix.")
    r3 = report("mean per-item TV", obs_mtv, mtvs, d_mtv, n)
    if r2["gap"] <= 0 and r3["gap"] <= 0:
        print("       *** THIS STRATUM SEPARATES UNDER NEITHER STATISTIC. Two")
        print("           different reductions of the same null agree that it")
        print("           does not clear its own shuffle. %d rhyming pairs;"
              % n_pairs)
        print("           the null's width scales with that count, so read "
              "this as\n           power plus a small effect, not as a "
              "statistic to replace.")
        print("           %d of %d pairs were REFUSED (%.1f%%) — an unreadable"
              % (n_ref, 6 * len(quats), 100.0 * n_ref / (6 * len(quats))))
        print("           line-final is a missing MEASUREMENT, and it removes")
        print("           evidence from the observation and the null alike.")
    elif r2["gap"] <= 0 < r3["gap"] or r3["gap"] <= 0 < r2["gap"]:
        print("       *** THE TWO STATISTICS DISAGREE on this stratum. That "
              "is a\n           finding about the statistics, not about the "
              "poets, and\n           neither number may be quoted without "
              "the other.")
    return {"P1": r1, "P2": r2, "P2b": r3, "profile": obs_prof,
            "null_profile": ref, "schemes": Counter(q.scheme for q in quats)}


def arm_chains(lex, decl, stanzas, n, theta=0.82, max_items=120):
    """P3. `infer_chains` capture, the statistic the record's four Whitman
    figures are in. Reads ADJACENCY, so the same null is NOT degenerate — and
    that is measured here rather than assumed.

    `max_items` bounds the run: the chain search is quadratic in the item and
    the replicate loop is n x items, so the slice is a coordinate of the
    number and it is printed beside it (doctrine 58)."""
    def captured(lines):
        ch = infer_chains(lex, lines, decl, theta_chain=theta)
        return sum(c["length"] for c in ch if c["length"] >= 2) / len(lines)

    src = stanzas[:max_items]
    print("\nP3 · CHAIN CAPTURE, corpus's own shuffled self   "
          "(%d of %d quatrains, theta_chain=%.2f)"
          % (len(src), len(stanzas), theta))
    print("     The negative control is the SAME quatrains with their own "
          "four\n     lines permuted — matched on author, period, diction and "
          "line\n     length by construction, which no second poet can be.")
    obs = sum(captured(b) for b in src) / len(src)
    nulls, differ = [], 0
    for r in range(n):
        rng = random.Random(SEED + r)
        tot = 0.0
        for b in src:
            s = list(b)
            rng.shuffle(s)
            tot += captured(s)
        v = tot / len(src)
        nulls.append(v)
        if abs(v - obs) > 1e-12:
            differ += 1
    return report("corpus chain capture", obs, nulls, differ, n)


def arm_whitman(lex, decl, n, theta=0.82):
    def captured(lines):
        ch = infer_chains(lex, lines, decl, theta_chain=theta)
        return sum(c["length"] for c in ch if c["length"] >= 2) / len(lines)
    wl = whitman_lines()
    obs = captured(wl)
    nulls, differ = [], 0
    for r in range(n):
        rng = random.Random(SEED + r)
        s = list(wl)
        rng.shuffle(s)
        v = captured(s)
        nulls.append(v)
        if abs(v - obs) > 1e-12:
            differ += 1
    print("\nP3-LEGACY · WHITMAN, %d lines, theta_chain=%.2f  "
          "(the control K-3 puts in the dock)" % (len(wl), theta))
    return report("Whitman chain capture", obs, nulls, differ, n)


# ---------------------------------------------------------------------------

def main(argv):
    n = 200
    cap = 8
    do_chains = True
    for a in argv:
        if a.startswith("--n="):
            n = int(a.split("=", 1)[1])
        elif a.startswith("--cap="):
            cap = int(a.split("=", 1)[1])
        elif a == "--skip-chains":
            do_chains = False

    lex = Lexicon()
    decl = Declaration()
    raw = load_quatrains(cap_per_file=cap)
    print("=" * 74)
    print("THE REPLACEMENT NEGATIVE CONTROL — MISSING K-2/K-3, BACKLOG 3.5")
    print("=" * 74)
    print("seed %d, replicates %d, cap %d quatrains per file" % (SEED, n, cap))
    print("material: %d quatrains from %d files across %d tradition groups; "
          "selected\n          by LINE COUNT (a typographic property), never "
          "by a rhyme verdict" % (len(raw), len({r[1] for r in raw}),
                                  len({r[0] for r in raw})))
    quats = [Quatrain(lex, decl, g, f, b) for g, f, b in raw]

    out = {}
    out["ALL"] = arm_scheme(quats, n, "STRATUM: ALL ENGLISH SONG")
    groups = sorted({q.group for q in quats})
    print("\n" + "-" * 74)
    print("PER-TRADITION STRATA — the 'more than one scheme' claim, made")
    print("checkable. The grouping is the FILENAME, fixed before any rhyme was")
    print("scored, so the strata are not a function of the statistic.")
    print("-" * 74)
    for g in groups:
        sub = [q for q in quats if q.group == g]
        if len(sub) < 20:
            print("\nSTRATUM: eng_%s — %d quatrains, BELOW THE n=20 FLOOR, "
                  "not measured\n  (doctrine 72: a calibration measured at "
                  "n=6 is not a calibration)." % (g, len(sub)))
            continue
        out[g] = arm_scheme(sub, n, "STRATUM: eng_%s" % g)

    if do_chains:
        out["chains"] = arm_chains(lex, decl, [b for _, _, b in raw], n)
        out["whitman"] = arm_whitman(lex, decl, n)

    print("\n" + "=" * 74)
    print("WHAT THE ARM SAYS")
    print("=" * 74)
    if out.get("ALL"):
        a = out["ALL"]
        print("* P1 differ = %.1f%%.  %s" % (
            100 * a["P1"]["differ"],
            "line_permutation is the IDENTITY MAP for the pair count, exactly "
            "as\n  predicted from the predicate. A cell that had reached for "
            "the obvious\n  null and stopped would have reported p=1.0 and "
            "concluded English song\n  does not rhyme."
            if a["P1"]["differ"] == 0 else
            "the pair count MOVED under a null that should not touch it — "
            "the\n  invariance argument is wrong somewhere and the number "
            "below is void."))
        print("* P2 differ = %.1f%%, observed TV %.4f against a null MAX of "
              "%.4f\n  (gap %+.4f). Same corpus, same null, a statistic that "
              "reads POSITION\n  instead of the anchor multiset."
              % (100 * a["P2"]["differ"], a["P2"]["obs"], a["P2"]["max"],
                 a["P2"]["gap"]))
        print("* P2b observed %.4f against null MAX %.4f (gap %+.4f)."
              % (a["P2b"]["obs"], a["P2b"]["max"], a["P2b"]["gap"]))
        strata = [(g, v) for g, v in out.items()
                  if g != "ALL" and isinstance(v, dict) and "P2" in v]
        fails = [g for g, v in strata
                 if v["P2"]["gap"] <= 0 and v["P2b"]["gap"] <= 0]
        split = [g for g, v in strata
                 if (v["P2"]["gap"] <= 0) != (v["P2b"]["gap"] <= 0)]
        print("* STRATA: %d measured, %d separate under BOTH statistics, "
              "%d under\n  neither (%s), %d where the two disagree (%s)."
              % (len(strata), len(strata) - len(fails) - len(split),
                 len(fails), ", ".join(fails) or "none",
                 len(split), ", ".join(split) or "none"))
        print("  The positive spans %d distinct quatrain schemes read off the "
              "graph;\n  the three commonest are %s. A negative control that "
              "is the corpus's\n  OWN shuffle is matched to all of them at "
              "once, which is the property\n  no second poet has."
              % (len(a["schemes"]),
                 ", ".join("%s=%d" % kv for kv in a["schemes"].most_common(3))))
    if "whitman" in out and "chains" in out:
        print("* P3: corpus %.4f vs its own shuffled self (MAX %.4f, gap "
              "%+.4f);\n  Whitman %.4f vs MAX %.4f, gap %+.4f. Two arms, one "
              "statistic, one null."
              % (out["chains"]["obs"], out["chains"]["max"],
                 out["chains"]["gap"], out["whitman"]["obs"],
                 out["whitman"]["max"], out["whitman"]["gap"]))
    print("* Every gap above is the number to read; every p at %.4f is the "
          "resolution\n  floor of n=%d and says nothing about size "
          "(doctrine 57)." % (1.0 / (n + 1), n))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

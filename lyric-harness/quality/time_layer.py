#!/usr/bin/env python3
"""The time layer — rhyme placement against a metric period.

Built to `quality/TIME_PREREGISTRATION.md`, which was committed first. Read it
before reading this; the predictions and the two tripwires are there, not here.

WHAT THIS MEASURES, AND WHAT IT DOES NOT

There is no audio anywhere in this project, so text does not give timing. What
this measures is *rhyme placement in syllable or stress coordinates under a
declared isochrony assumption*, which is a weaker and different thing than
"on the beat". English is stress-timed, so syllable-isochrony is the wrong
model and stress-isochrony is the less wrong one — hence the primary grid unit
is the stress. Nothing here should be worded as a claim about time.

THE STATISTIC

Lay an item's syllables end to end. Some carry a rhyme relation; those are the
events. Reduce each index modulo a candidate period P to get its phase, then

    KL( phase distribution of events || phase distribution of ELIGIBLE slots )

- Phase-invariant: both distributions live in the same frame, so the downbeat
  never has to be located.
- Self-normalizing: the null is the item's own stream, so no external resource
  is consulted and doctrine 13 holds by construction rather than by care. It
  also absorbs truncation — 47 syllables at P=4 gives three phases twelve slots
  and one phase eleven, and a uniform null would read that as signal.

THE TRIPWIRE

In an isosyllabic form, line-final rhyme phase is DETERMINED by the form: every
line of a sonnet is ten syllables, so every line-final syllable shares a phase
and KL hits its ceiling by construction. That is doctrine 14 — a control
defined in terms of the quantity it controls. So line-final events are excluded
from the primary statistic, and `line_final_control()` runs the excluded case
on purpose to check that it stays null.
"""

import math
import os
import random
import sys
from bisect import bisect_right
from collections import Counter
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import (RHYME_RELATIONS, Declaration,  # noqa: E402
                           Lexicon, score, word_syllable_map)


@dataclass
class TimeDeclaration:
    """Every coordinate fixed in the pre-registration, in one place.

    A disagreement about this layer lands in one of these fields (doctrine 1).
    `isochrony` is the load-bearing one and it is an assumption, not a finding.
    """
    #: "stress" counts only stressed syllables when indexing; "syllable"
    #: counts all of them. English is stress-timed, so "stress" is primary.
    grid_unit: str = "stress"
    #: candidate tactus periods, swept. The maximum over this sweep is taken
    #: INSIDE the null, so the sweep needs no separate correction.
    periods: tuple = (2, 3, 4, 6, 8)
    #: rhyme threshold. Same value internal_matches already uses.
    theta: float = 0.80
    #: longest multi-syllable anchor span considered
    max_span: int = 3
    #: only pairs this close in the syllable stream are considered a relation.
    #: Rhyme is local; a link 40 lines away is not perceptually a rhyme, and
    #: without a bound the pair count is quadratic in the item.
    window: int = 32
    #: line-final events are EXCLUDED from the primary statistic; in an
    #: isosyllabic form their phase is determined by the form.
    exclude_line_final: bool = True
    #: POWER GUARD. If this fraction of eligible slots or more are events, the
    #: event and slot distributions are near-identical by construction and the
    #: test cannot discriminate. Measured on the registered parameters, every
    #: corpus in this repo saturates at 87-97%, so this guard fires on all of
    #: them -- which is the correct answer, and a much more useful one than the
    #: p = 0.087 the first run produced. A near-saturated comparison does not
    #: return a weak result, it returns a meaningless one.
    max_saturation: float = 0.75
    #: FAMILY-WISE ERROR CONTROL. "none" reproduces the pre-correction
    #: behaviour and is kept only so the defect is reachable by a test.
    #: "sidak" is primary: a position is compared against ~135 candidates and
    #: declared an event if ANY hits, so the per-pair cut must be
    #: 1-(1-alpha)^(1/m). "bonferroni" is alpha/m, valid without the
    #: independence Sidak assumes and the comparisons overlap. "bh" controls
    #: the expected PROPORTION of false events at q instead.
    correction: str = "sidak"
    #: WHICH COMPARISONS COUNT AS THE FAMILY. This is the `m` in `alpha/m`, and
    #: until 2026-08-11 it was MEASURED FROM THE WRONG POPULATION.
    #:
    #: "candidate" (primary, correct): every pair the position takes part in,
    #: which is every comparison the layer actually makes there. A candidate
    #: pair whose relation fails the conjunctive band scores effectively minus
    #: infinity -- it is a test that was run and did not reject -- so it belongs
    #: in m exactly as it belongs in the null's denominator.
    #:
    #: "scored" (the shipped defect, kept reachable so it stays demonstrable):
    #: only the pairs that PASSED the band. That makes m a FUNCTION OF THE BAND,
    #: and in the wrong direction: tightening `theta_coda` 0.60 -> 0.80 shrinks
    #: each position's surviving family, which LOOSENS the Sidak cut
    #: 1-(1-alpha)^(1/m), which RAISES the corrected false-event rate. Measured
    #: on word-scrambled sonnets: 8.8% -> 25.5% flush-left, 6.8% -> 26.7%
    #: flush-right, i.e. ~3x in BOTH alignments, so it is the band and not the
    #: alignment. This is doctrine 27's error one layer up, in the same
    #: function that fixed it: `_pvalue` already divides by every valid draw
    #: rather than every SURVIVING draw, and then the correction counted only
    #: the surviving comparisons. The p-value is unconditionally uniform over
    #: CANDIDATES, so the family has to be counted over candidates too, or the
    #: per-position error is alpha/band_pass_rate rather than alpha -- roughly
    #: 10x at a 10% band-pass rate, and it gets worse as the band gets better.
    family: str = "candidate"
    alpha: float = 0.05
    q: float = 0.10
    #: draws for the within-item null. The p-value resolution is 1/(N+1), and
    #: at m~135 the Sidak cut is ~3.8e-4, so the tail has to be resolved an
    #: order of magnitude finer than that.
    #:
    #: AMENDED 2026-08-11: RESOLUTION WAS NEVER THE BINDING CONSTRAINT, and
    #: raising this number runs the lever BACKWARDS.
    #: `_pvalue` returns (ge+1)/(n_valid+1) where `ge` counts chance draws at or
    #: above the observed pair. For the best pair in a real sonnet `ge` is 40-83
    #: of 20,000 and every one of them is an exact TIE at 1.000 -- ZERO draws
    #: are strictly above it, because the comparator has no headroom over
    #: "perfect rhyme". So min_p converges on a RATE (the density of perfect
    #: rhymes among re-pairings of the item's own spans), not on the resolution
    #: floor. Measured on sonnet 1: 3.998e-3 at 2,000 draws, 4.200e-3 at 20,000,
    #: 4.415e-3 at 200,000 -- 100x the cost (0.21s -> 4.69s per item) for a p
    #: that goes UP, because more draws estimate the tie rate more accurately
    #: and it was being under-estimated. Doctrine 57 is the mirror of this: a p
    #: at 1/(n+1) reports the resolution, and a p far ABOVE 1/(n+1) reports a
    #: rate that no resolution buys down.
    #: `python3 quality/time_attainable.py --floor` re-measures it.
    null_samples: int = 20000
    #: DOCTRINE 28's TRIPWIRE. If this share of RANDOM re-pairings already
    #: passes the band, the item's own phonological inventory makes rhyme
    #: unsurprising and a within-item null cannot discriminate. A constructed
    #: quatrain whose whole inventory is one rhyme class (rattle/cattle/saddle/
    #: battle) returns zero events for that reason alone, which is a TRUE
    #: statement about a within-item null and not a fixable defect. The layer
    #: says so instead of reporting 0%.
    #:
    #: THE NUMBER IS A COORDINATE OF THE BAND (doctrine 58), and 0.25 was a
    #: coordinate of a band that no longer exists. It was set against
    #: "real verse runs ~0.10" and a degenerate item at 0.43 -- both measured
    #: flush-LEFT at theta_coda 0.60. Under the shipped band (flush-right,
    #: theta_coda 0.80) the SAME two measurements are 0.055 and 0.226, so 0.25
    #: silently stopped firing and doctrine 28's tripwire was dead.
    #:
    #: RE-MEASURED 2026-09-14 after correcting cross-line word occurrence
    #: identity, using the unchanged rule: twice the maximum null band-pass
    #: rate over the first 30 Shakespeare sonnets. Tail alignment,
    #: theta_coda=0.80, theta=0.80, window=32, null_samples=20000,
    #: seed=20260810. Observed min=0.0231, max=0.0562; 2*max=0.1124.
    #: The saturated control is an evaluation, never a calibration input.
    #: Previous 0.152 described the earlier occurrence predicate.
    max_null_band_pass: float = 0.1124
    max_null_band_pass_basis: str = (
        "2 x max over 30 Shakespeare sonnets = 2 x 0.0562, measured 2026-09-14 "
        "with word identity=(line,widx), alignment=tail, theta_coda=0.80, "
        "theta=0.80, window=32, null_samples=20000, seed=20260810. "
        "Re-run quality/fwer_family.py --calibrate after ANY change to the "
        "band or candidate/null population. Previous value: 0.152.")
    n_perm: int = 2000
    seed: int = 20260810
    isochrony: str = ("ASSUMED, not measured. Grid positions are evenly "
                      "spaced. False for stress-timed English; less wrong on "
                      "the stress grid than the syllable grid, and less wrong "
                      "for rap over short spans than for sung verse over long "
                      "ones. Every result below is conditional on it.")

    def __post_init__(self):
        for name, choices in (("grid_unit", ("stress", "syllable")),
                              ("correction", ("none", "sidak", "bonferroni", "bh")),
                              ("family", ("candidate", "scored"))):
            if getattr(self, name) not in choices:
                raise ValueError(f"{name} must be one of {choices}")
        for name, minimum in (("max_span", 1), ("window", 0),
                              ("null_samples", 1), ("n_perm", 1)):
            value = getattr(self, name)
            if type(value) is not int or value < minimum:
                raise ValueError(f"{name} must be an integer >= {minimum}")
        if not self.periods or any(type(p) is not int or p < 1 for p in self.periods):
            raise ValueError("periods must be nonempty positive integers")
        for name in ("alpha", "q", "theta", "max_saturation", "max_null_band_pass"):
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError(f"{name} must be finite")
        if not 0 < self.alpha < 1 or not 0 < self.q < 1:
            raise ValueError("alpha and q must lie strictly between 0 and 1")
        if self.max_saturation <= 0 or self.max_null_band_pass < 0:
            raise ValueError("saturation ceiling must be positive and null ceiling nonnegative")


# ---------------------------------------------------------------------------
# The stream
# ---------------------------------------------------------------------------

def syllable_stream(lex, lines):
    """-> list of syllable dicts with line index, position in line, and a flag
    for line-final. This is the positional object the harness never had; known
    gap 4 asked for a verse-wide positional graph and this is its coordinate
    system."""
    out = []
    for li, line in enumerate(lines):
        sylls = word_syllable_map(lex, line)
        for si, s in enumerate(sylls):
            s = dict(s)
            s["line"] = li
            s["pos_in_line"] = si
            s["line_final"] = (si == len(sylls) - 1)
            out.append(s)
    return out


def grid_index(stream, unit):
    """Map each stream position to its coordinate on the declared grid.

    On the stress grid only stressed syllables occupy a slot, so an unstressed
    syllable gets None and can never be an event or an eligible slot. That is
    the point: English times its stresses, not its syllables.
    """
    idx, k = [], 0
    for s in stream:
        if unit == "syllable":
            idx.append(k)
            k += 1
        elif s["stress"] in (1, 2):
            idx.append(k)
            k += 1
        else:
            idx.append(None)
    return idx


# ---------------------------------------------------------------------------
# Events — which stream positions carry a rhyme relation
# ---------------------------------------------------------------------------

def _candidate_pairs(stream, tdecl):
    """Every (span_a, span_b) the layer would consider. Factored out so the
    null is drawn from EXACTLY the population being scored -- the domain
    mismatch that broke the matrix's line-final thresholds."""
    starts = [i for i, s in enumerate(stream) if s["stress"] in (1, 2)]
    spans = [(i, i + L) for i in starts
             for L in range(1, tdecl.max_span + 1) if i + L <= len(stream)]
    by_start = {}
    for a, b in spans:
        by_start.setdefault(a, []).append((a, b))
    out = []
    owners = {span: _word_occurrences(stream, span) for span in spans}
    for a, b in spans:
        for c in starts[bisect_right(starts, a):
                        bisect_right(starts, a + tdecl.window)]:
            for (c2, d) in by_start.get(c, ()):
                if c2 < b:
                    continue          # overlapping spans are not a relation
                if owners[a, b] & owners[c2, d]:
                    continue          # a word cannot rhyme with itself
                out.append(((a, b), (c2, d)))
    return out


def _word_occurrences(stream, span):
    """Word indices are local to a line; identity needs both coordinates.

    A caller's single-line stream may omit `line`. The same occurrence
    test must constrain the observed candidates and the shuffled null.
    """
    return frozenset((s.get("line", 0), s["widx"])
                     for s in stream[span[0]:span[1]])


def _raw_score(stream, sa, sb, decl, comparator):
    """The scalar this layer thresholds, band-typed. None when the pair is not
    a rhyme relation at all -- those can never be events, so they are not
    candidates for a p-value either."""
    a, b = sa
    c, d = sb
    s = score(stream[a:b], stream[c:d], decl,
              _words(stream, a, b), _words(stream, c, d))
    if s["relation"] not in RHYME_RELATIONS:
        return None
    if comparator is not None:
        t, _ = comparator.score(stream[a:b], stream[c:d])
        return t
    return s["total"]


def null_scores(stream, pairs, decl, tdecl, comparator=None):
    """Empirical null: the same spans, RE-PAIRED at random.

    The span multiset is preserved exactly -- same lengths, same phonology,
    same vocabulary, same stress layout -- and only the pairing is destroyed.
    That is the shuffle_twin construction from controls.py, and doctrine 14 is
    why it is a shuffle rather than a substitution: a control defined in terms
    of the quantity it controls is an identity, not a control.

    The null is the ITEM'S OWN spans, so no external resource is consulted
    (doctrine 13) and the null population matches the scored population.
    """
    if not pairs:
        return [], 0
    left = [p[0] for p in pairs]
    right = [p[1] for p in pairs]
    owners = {span: _word_occurrences(stream, span)
              for span in set(left) | set(right)}
    rng = random.Random(tdecl.seed ^ 0x5EED)
    out, n_valid, tries = [], 0, 0
    limit = tdecl.null_samples * 20
    while n_valid < tdecl.null_samples and tries < limit:
        tries += 1
        sa = left[rng.randrange(len(left))]
        sb = right[rng.randrange(len(right))]
        if sa == sb or max(sa[0], sb[0]) < min(sa[1], sb[1]):
            continue                      # not a valid pair at all: redraw
        if owners[sa] & owners[sb]:
            continue
        n_valid += 1
        v = _raw_score(stream, sa, sb, decl, comparator)
        # A chance pair that fails the conjunctive band is not DROPPED -- it
        # scores effectively minus infinity and belongs in the denominator.
        # Dropping it conditions the null on "is already a rhyme relation",
        # which is the defect that made the first corrected run return 0%
        # saturation on every corpus: the null then consists only of pairs
        # that already passed the band, and nothing real can beat it.
        if v is not None:
            out.append(v)
    out.sort()
    return out, n_valid


def _pvalue(v, null_sorted, n_valid):
    """Upper-tail empirical p over ALL valid chance draws.

    The denominator is every valid chance pair, including those that failed
    the band and never made it into `null_sorted`. Resolution is 1/(N+1); a
    pair beyond every null draw is reported at the resolution limit, never as
    zero.
    """
    if not n_valid:
        return 1.0
    if not null_sorted:
        return 1.0 / (n_valid + 1)
    lo, hi = 0, len(null_sorted)
    while lo < hi:                        # first index with null >= v
        mid = (lo + hi) // 2
        if null_sorted[mid] < v:
            lo = mid + 1
        else:
            hi = mid
    ge = len(null_sorted) - lo
    return (ge + 1) / (n_valid + 1)


def _m_needed(min_p, alpha, correction="sidak"):
    """-> the largest family size at which a pair of p-value `min_p` fires.

    The whole attainability question in one number. Invert the per-position
    cut: `min_p <= 1-(1-alpha)^(1/m)` iff `m <= ln(1-alpha)/ln(1-min_p)`.
    Measured across this corpus it is 18-28 and the family a typical position
    actually has is 198-217, so the layer needs a family ~10x smaller than it
    has. `quality/time_attainable.py` is the runner.
    """
    if min_p >= 1.0 or min_p <= 0.0:
        return 0
    if min_p > alpha:
        return 0
    ratio = (alpha / min_p if correction == "bonferroni" else
             math.log1p(-alpha) / math.log1p(-min_p))
    # The logarithmic inverse can round just below an integer (91 ->
    # 90.99999999999999). Resolve the integer boundary using the SAME
    # forward inequality that admits an event. Binary search also avoids
    # a linear walk through float plateaus at very large family sizes.
    lo, hi = 0, math.ceil(ratio) + 1
    while _fwer_cut(alpha, hi, correction) >= min_p:
        hi *= 2
    while lo + 1 < hi:
        mid = (lo + hi) // 2
        if _fwer_cut(alpha, mid, correction) >= min_p:
            lo = mid
        else:
            hi = mid
    return lo


def _fwer_cut(alpha, m, correction):
    """Stable Sidak subtraction, also at tiny declared alpha or large m."""
    return alpha / m if correction == "bonferroni" else -math.expm1(math.log1p(-alpha) / m)


def _bh(pvals, q, n=None):
    """Benjamini-Hochberg: -> the largest p that is a discovery, or None.

    `n` is the size of the FAMILY, which is not always `len(pvals)`. Pairs that
    fail the conjunctive band are hypotheses with p = 1 by construction, so they
    are the largest ranks and never qualify -- but they are still tests, and
    dropping them from n is the same conditioning error the family-size
    coordinate exists for. Passing n explicitly keeps them in the denominator
    without materialising thousands of 1.0s.
    """
    if not pvals:
        return None
    ps = sorted(pvals)
    n = len(ps) if n is None else max(n, len(ps))
    cut = None
    for i, p in enumerate(ps, 1):
        if p <= i / n * q:
            cut = p
    return cut


def rhyme_events(lex, stream, decl, tdecl, comparator=None, detail=None):
    """-> set of stream positions participating in an internal rhyme.

    Anchors start on a stressed syllable and run 1..max_span syllables, inside
    a declared window. A span may not rhyme with itself, and two spans sharing
    a word are not a relation.

    FAMILY-WISE ERROR CONTROL. Each position is compared against roughly 135
    candidates and is declared an event if ANY of them hits, so a per-pair
    threshold cannot control the per-position error: at a 2.4% per-pair
    false-positive rate, `1 - 0.976^135` is 96%, which is the saturation this
    layer measured for three instrument versions. `tdecl.correction` converts
    the score to a p-value against a within-item null and then corrects across
    each position's family.

    TWO REFUSALS, and they are different questions:

    1. `max_null_band_pass` -- doctrine 28's tripwire, asked BEFORE scoring:
       does the item's own inventory make rhyme unsurprising?
    2. `attainable` -- asked AFTER: could ANY pair in this item have cleared
       the corrected cut? The best score an item contains is usually a perfect
       rhyme, and its p-value is set by how many CHANCE re-pairings of the
       item's own spans are also perfect. If that floor sits above the loosest
       per-position cut in the item, an empty event set is arithmetic, not
       evidence. Reporting it as "no rhyme events" would be doctrine 20's
       error -- inconclusive by construction collapsed into null.
    """
    # L-1/L-2: retained for historical experiments, never a certified event
    # detector. The replacement tests item/stratum organization and does not
    # license significance for individual positions (see rhyme_organization).
    if detail is not None:
        detail.update(inference_supported=False,
                      inference_scope="legacy descriptive positions; no validated event error control with power")
    pairs = _candidate_pairs(stream, tdecl)
    if tdecl.correction == "none":
        events = set()
        for sa, sb in pairs:
            v = _raw_score(stream, sa, sb, decl, comparator)
            if v is not None and v >= tdecl.theta:
                events.update(range(*sa))
                events.update(range(*sb))
        return events

    null, n_valid = null_scores(stream, pairs, decl, tdecl, comparator)
    band_pass = (len(null) / n_valid) if n_valid else 0.0
    if band_pass > tdecl.max_null_band_pass:
        if detail is not None:
            detail.update(
                n_candidate_pairs=len(pairs), n_null=len(null),
                n_null_valid=n_valid, null_band_pass_rate=band_pass,
                correction=tdecl.correction, alpha=tdecl.alpha,
                refused=(
                    f"{band_pass:.0%} of RANDOM re-pairings in this item "
                    f"already pass the rhyme band, above the declared "
                    f"{tdecl.max_null_band_pass:.0%}. The item's own inventory "
                    f"makes rhyme unsurprising, so a within-item null cannot "
                    f"discriminate and an empty event set here means 'cannot "
                    f"tell', not 'no rhyme'. Real verse runs ~10%."))
        return set()
    # p-value per pair, indexed by its position in `pairs`. A pair whose
    # relation fails the band gets NO p-value: it scores effectively minus
    # infinity and can never reject. It is still a comparison that was made.
    pv = {}
    scored = []
    best_score = None
    for k, (sa, sb) in enumerate(pairs):
        v = _raw_score(stream, sa, sb, decl, comparator)
        if v is None:
            continue
        p = _pvalue(v, null, n_valid)
        pv[k] = p
        scored.append((sa, sb, p))
        best_score = v if best_score is None else max(best_score, v)

    # EACH POSITION'S FAMILY -- the m in alpha/m, and it must be MEASURED from
    # the comparisons actually made, not from the ones that survived the band.
    # `family="scored"` reproduces the shipped defect (see TimeDeclaration).
    family = {}
    src = enumerate(pairs) if tdecl.family == "candidate" else \
        ((k, (sa, sb)) for k, (sa, sb, _p) in enumerate(scored))
    for k, (sa, sb) in src:
        for pos in list(range(*sa)) + list(range(*sb)):
            family.setdefault(pos, []).append(k)
    if tdecl.family == "scored":
        pv = {k: p for k, (_a, _b, p) in enumerate(scored)}

    events = set()
    if tdecl.correction == "bh":
        # RESOLUTION GUARD (corrected 2026-09-14). q/n is only the
        # first rank's cut. Requiring singleton resolution incorrectly
        # refuses valid collective discoveries, e.g. p=(.03,.03), q=.05.
        # Discrete ties are handled by the ordinary step-up calculation;
        # resolution alone neither invalidates nor establishes its model's
        # dependence assumptions. FWER uses its own per-position cut below.
        floor_p = 1.0 / (n_valid + 1) if n_valid else 1.0
        n_hyp = len(pairs) if tdecl.family == "candidate" else len(scored)
        # BH is step-up: k discoveries use k*q/n, not always q/n.
        # Refuse only if even ALL scored hypotheses at the resolution
        # floor could not cross their rank's cut.
        resolvable_cut = len(scored) * tdecl.q / n_hyp if n_hyp else 0.0
        if scored and floor_p > resolvable_cut:
            if detail is not None:
                detail["bh_unresolvable"] = (
                    f"BH cannot resolve even its largest scored rank's cut "
                    f"k*q/n = {resolvable_cut:.2e}; this null resolves "
                    f"to {floor_p:.2e}. Raise null_samples to at least "
                    f"{math.ceil(1 / resolvable_cut) - 1}. This is a "
                    f"resolution limit, not evidence that no pairs rhyme.")
            return set()
        cut = _bh([p for _, _, p in scored], tdecl.q, n_hyp)
        keep = {k for k, (_a, _b, p) in enumerate(scored)
                if cut is not None and p <= cut}
        for k in keep:
            sa, sb, _p = scored[k]
            events.update(range(*sa))
            events.update(range(*sb))
    else:
        for pos, ks in family.items():
            m = len(ks)
            cut = _fwer_cut(tdecl.alpha, m, tdecl.correction)
            if any(pv.get(k, 1.0) <= cut for k in ks):
                events.add(pos)

    # ATTAINABILITY. An empty event set has two completely different causes and
    # the layer has to say which. `min_p` is the smallest p-value ANY candidate
    # pair in this item attains -- almost always a perfect rhyme's, and its
    # floor is the number of CHANCE re-pairings of the item's own spans that are
    # also perfect. `loosest_cut` is the most permissive per-position cut in the
    # item, at its smallest family. If min_p is above that, no pair anywhere
    # could have been declared, and 0 events is arithmetic rather than evidence.
    min_p = min(pv.values()) if pv else 1.0
    sizes = [len(v) for v in family.values()]
    loosest = _fwer_cut(tdecl.alpha, min(sizes), tdecl.correction) if sizes else 1.0
    attainable = bool(pv) and min_p <= loosest
    # M_NEEDED -- the largest family at which this item's own best pair still
    # clears its cut, i.e. `min_p <= 1-(1-alpha)^(1/m)` solved for m. This is
    # the quantity that decides whether the layer can speak, and until
    # 2026-08-11 nothing reported it. `attainable` compares min_p with the
    # LOOSEST cut in the item, which is the cut at the SMALLEST family -- a
    # position at the edge of the item where the best pair almost never sits.
    # That is why the recorded gap reads 1.4-1.8x while the gap at a typical
    # position is ~10x. Both are reported; `share_firable` is the honest one.
    m_need = _m_needed(min_p, tdecl.alpha, tdecl.correction)
    if tdecl.correction == "bh":
        # BH has ranked, global cuts. Per-position Sidak family limits
        # would describe a different calculation beside its verdict.
        loosest, attainable, m_need = resolvable_cut, bool(events), None
    if detail is not None:
        detail.update(
            n_candidate_pairs=len(pairs), n_scored=len(scored),
            n_null=len(null), n_null_valid=n_valid,
            null_band_pass_rate=(len(null) / n_valid) if n_valid else None,
            p_resolution=1.0 / (n_valid + 1) if n_valid else None,
            median_family_size=(sorted(len(v) for v in family.values())
                                [len(family) // 2] if family else 0),
            family_population=tdecl.family,
            correction=tdecl.correction, alpha=tdecl.alpha,
            min_attainable_p=min_p, loosest_cut=loosest,
            m_needed=m_need,
            share_firable=((sum(1 for v in sizes if v <= m_need) / len(sizes))
                           if sizes else 0.0) if m_need is not None else None,
            best_score=best_score,
            # How many null draws are STRICTLY above the best observed pair.
            # Zero means min_p is a TIE COUNT: the comparator saturates at
            # 1.000 and cannot separate the item's own perfect rhyme from a
            # chance re-pairing that is also perfect. When this is 0, raising
            # `null_samples` cannot lower min_p -- see the field's own note.
            null_strictly_above_best=(
                sum(1 for v in null if v > best_score + 1e-12)
                if best_score is not None else 0),
            attainable=attainable)
        if tdecl.correction == "bh":
            detail.update(q=tdecl.q, bh_cut=cut, per_pair_cut=None)
        elif family:
            mm = sorted(len(v) for v in family.values())[len(family) // 2]
            detail["per_pair_cut"] = _fwer_cut(tdecl.alpha, mm, tdecl.correction)
    if not events and not attainable and tdecl.correction != "bh":
        if detail is not None:
            strict = detail.get("null_strictly_above_best", 0)
            detail["cannot_tell"] = (
                f"NO EVENT WAS ATTAINABLE. The best pair in this item reaches "
                f"p = {min_p:.2e}; the loosest per-position cut is "
                f"{loosest:.2e}, so no candidate could have been declared an "
                f"event at alpha={tdecl.alpha} however perfect it was. The "
                f"floor is the item's OWN null: {min_p * (n_valid + 1):.0f} of "
                f"{n_valid} chance re-pairings of this item's spans score at "
                f"or above its best real pair, and {strict} of them score "
                f"STRICTLY above it. That second number is the one to read. "
                f"At {strict} the floor is a TIE COUNT -- the comparator "
                f"saturates at a perfect rhyme and cannot separate this item's "
                f"best pair from a chance re-pairing that is also perfect -- so "
                f"min_p is a RATE and raising null_samples re-estimates it "
                f"rather than lowering it. What the layer would need is a "
                f"family of at most {m_need} comparisons per position; it has "
                f"{detail.get('median_family_size')} at the median and "
                f"{detail.get('share_firable', 0.0):.1%} of its positions are "
                f"small enough to fire. An empty event set here means CANNOT "
                f"TELL, not 'no rhyme' -- and the instrument, not the verse, is "
                f"what needs fixing. `python3 quality/time_attainable.py`.")
        return set()
    return events


def _words(stream, i, j):
    seen = []
    for s in stream[i:j]:
        if not seen or seen[-1] != s["word"]:
            seen.append(s["word"])
    return " ".join(seen)


# ---------------------------------------------------------------------------
# The statistic
# ---------------------------------------------------------------------------

def _kl(event_phases, slot_phases, period):
    """KL(events || slots) in nats. Both are counts over the same support."""
    ne, ns = sum(event_phases.values()), sum(slot_phases.values())
    if not ne or not ns:
        return 0.0
    total = 0.0
    for ph in range(period):
        p = event_phases.get(ph, 0) / ne
        q = slot_phases.get(ph, 0) / ns
        if p > 0 and q > 0:
            total += p * math.log(p / q)
    return total


def phase_statistic(coords, event_coords, periods):
    """-> (best KL, best period). The max over the sweep; the null takes the
    same max, so the sweep is corrected by construction rather than by a
    separate step."""
    best, best_p = -1.0, None
    slots = list(coords)
    for P in periods:
        sp = Counter(c % P for c in slots)
        ep = Counter(c % P for c in event_coords)
        k = _kl(ep, sp, P)
        if k > best:
            best, best_p = k, P
    return best, best_p


def analyse(lex, lines, decl=None, tdecl=None, events=None,
            eligible_filter=None, comparator=None, stream=None,
            legacy_detected=False):
    """Run the layer on one item.

    Returns a dict with the observed statistic, its permutation null, the
    recovered period and everything needed to argue with the result. Never
    returns a score, and never says 'beat'.

    `stream` lets a caller supply a syllable stream built by ANY phonology
    (quality/phonology/), so the layer is not tied to CMUdict. Each entry needs
    'stress', 'line', 'line_final' and 'widx'. Without it the English path is
    used, which is a default rather than an assumption -- the whole point of
    the phonology package is that "syllable" and "prominence" mean different
    things per language, and a layer that could only ever index English would
    make the cross-family corpus unrunnable.
    """
    decl = decl or Declaration()
    tdecl = tdecl or TimeDeclaration()
    if stream is None:
        stream = syllable_stream(lex, lines)
    gidx = grid_index(stream, tdecl.grid_unit)

    def eligible(i):
        if gidx[i] is None:
            return False
        if eligible_filter is not None:
            return eligible_filter(stream[i])
        if tdecl.exclude_line_final and stream[i]["line_final"]:
            return False
        return True

    slots = [i for i in range(len(stream)) if eligible(i)]
    # The event set's own refusals used to be DISCARDED here: `rhyme_events`
    # was called without a detail dict, so an item refused for a degenerate
    # inventory or an unattainable cut came back as an empty set and then hit
    # the "too few events" branch below, which names the ITEM. Two different
    # refusals were being reported as one, and the one that survived blamed the
    # wrong layer (doctrine 20).
    automatic_events = events is None or legacy_detected
    edetail = {}
    if events is None:
        events = rhyme_events(lex, stream, decl, tdecl, comparator, edetail)
    ev = sorted(i for i in events if eligible(i))

    saturation = len(ev) / len(slots) if slots else 1.0
    result = {
        "grid_unit": tdecl.grid_unit,
        "n_syllables": len(stream),
        "n_slots": len(slots),
        "n_events": len(ev),
        "saturation": saturation,
        "periods": list(tdecl.periods),
        "isochrony": tdecl.isochrony,
        "inference_scope": ("unsupported automatic event inference" if automatic_events else
                            "research control conditional on caller-supplied exchangeable slots"),
    }
    if edetail:
        result["event_detail"] = edetail
    for key in ("refused", "cannot_tell", "bh_unresolvable"):
        if edetail.get(key):
            result.update(kl=None, period=None, p=None,
                          refused=edetail[key], refused_by=f"rhyme_events:{key}")
            return result
    if len(ev) < 4 or len(slots) < 8:
        result.update(kl=None, period=None, p=None,
                      refused_by="analyse:n_events",
                      refused="too few events or slots for a permutation test "
                              "to mean anything; the layer declines rather "
                              "than returning a number")
        return result
    if saturation >= tdecl.max_saturation:
        result.update(
            kl=None, period=None, p=None, refused_by="analyse:saturation",
            refused=f"{saturation:.0%} of eligible slots are events, at or "
                    f"above the declared {tdecl.max_saturation:.0%} ceiling. "
                    f"When nearly every slot carries an event the event and "
                    f"slot phase distributions coincide by construction, so "
                    f"the test has no power and any p it returned would be an "
                    f"artifact of the event definition rather than a fact "
                    f"about placement. The instrument, not the verse, is what "
                    f"needs fixing: the comparator's additive floor (known gap "
                    f"2) puts unrelated pairs above theta, and a 32-syllable "
                    f"window multiplies that by roughly 135 comparisons per "
                    f"stressed syllable")
        return result

    if automatic_events:
        result.update(
            kl=None, period=None, p=None,
            refused_by="analyse:unsupported_event_inference",
            refused="L-1/L-2: the legacy detector has no validated false-event "
                    "control with power, and independent random slots do not "
                    "preserve its paired events. Use rhyme_organization for "
                    "item/stratum organization; it certifies no positions or periods.")
        return result

    slot_coords = [gidx[i] for i in slots]
    obs, per = phase_statistic(slot_coords, [gidx[i] for i in ev],
                               tdecl.periods)

    # NULL. Draw the same NUMBER of events uniformly from the same ELIGIBLE
    # slots, so line lengths, the stress layout and anything the form forces
    # are all present in the null too. This is simultaneously the pre-
    # registered H4 control: the position multiset is held fixed and only the
    # pairing of relation to position is destroyed.
    rng = random.Random(tdecl.seed)
    ge = len(ev)
    null = []
    for _ in range(tdecl.n_perm):
        draw = rng.sample(slot_coords, ge)
        k, _p = phase_statistic(slot_coords, draw, tdecl.periods)
        null.append(k)
    hits = sum(1 for k in null if k >= obs)
    pval = (hits + 1) / (tdecl.n_perm + 1)
    # THE RECOVERED PERIOD IS BIASED and must not be read off a null result.
    # KL's small-sample bias grows with bin count -- E[KL] ~ (P-1)/2n on
    # noise -- so a maximum over the sweep almost always lands on the largest
    # period offered. Measured on pure noise at n=40 over 120 slots, the
    # sweep chose P=8 65% of the time and P=6 35%, and the observed sonnet
    # split was 27/40 and 13/40, i.e. indistinguishable from noise. The
    # p-value is unaffected because the null takes the same maximum, but the
    # argmax carries no information unless the p-value says the observation
    # is unlike the null in the first place.
    result.update(
        kl=obs,
        period=per if pval < 0.05 else None,
        period_argmax=per,
        period_note="argmax over the sweep is biased toward the largest "
                    "period (E[KL] grows with bin count), so it is reported "
                    "as `period` only when p < .05; otherwise see "
                    "`period_argmax`, which on a null result is noise",
        p=pval,
        null_mean=sum(null) / len(null),
        null_p95=sorted(null)[int(0.95 * len(null))],
        note="KL is positively biased at small n. The null draws the SAME "
             "number of events from the SAME slots, so the bias is present in "
             "the null and the p-value absorbs it. Do not read the raw KL as "
             "an effect size against zero.")
    return result


def line_final_control(lex, lines, decl=None, tdecl=None, mode="within"):
    """THE TRIPWIRE (pre-registered H3) — and the registered form of it is
    broken. Both forms are here, and which is which is stated, not blurred.

    `mode="within"` is what the pre-registration specified: line-final events
    against line-final slots. **It is a tautology on these corpora.** When
    every line rhymes, the event set equals the slot set, KL is identically
    zero and p is identically 1. A control that cannot fire is not a control —
    that is doctrine 14, reproduced in this module's own first draft and caught
    by running it. Measured line-final rhyme rates: 86-100% across every corpus
    in this repo, so the registered control is uninformative on all of them and
    H3 as written cannot be evaluated here.

    `mode="against_all"` is POST-HOC, added after that failure, and its
    expected direction is REVERSED: it compares line-final events against ALL
    grid slots and it is supposed to FIRE. In an isosyllabic form every
    line-final syllable shares a phase while the slots spread across all of
    them, so a large KL here demonstrates that the degeneracy the primary
    statistic excludes is real. If this one came out null, excluding
    line-finals would have been unnecessary caution rather than a fix.
    """
    tdecl = tdecl or TimeDeclaration()
    decl = decl or Declaration()
    stream = syllable_stream(lex, lines)
    ev = rhyme_events(lex, stream, decl, tdecl)
    finals = {i for i, s in enumerate(stream) if s["line_final"] and i in ev}
    if mode == "within":
        # no saturation guard: the whole point is to expose that it saturates
        t2 = TimeDeclaration(**{**tdecl.__dict__, "max_saturation": 1.01})
        res = analyse(lex, lines, decl, t2, events=finals,
                      eligible_filter=lambda s: s["line_final"], legacy_detected=True)
        res["control_mode"] = "within (as registered)"
        if res.get("saturation", 0) >= 0.999:
            res["degenerate"] = (
                "every line-final slot is an event, so this control is an "
                "identity and can only return KL=0, p=1. It provides NO "
                "evidence either way and H3 cannot be evaluated on this item")
        return res
    t2 = TimeDeclaration(**{**tdecl.__dict__, "exclude_line_final": False,
                            "max_saturation": 1.01})
    res = analyse(lex, lines, decl, t2, events=finals,
                  eligible_filter=lambda s: True, legacy_detected=True)
    res["control_mode"] = "against_all (POST-HOC, expected to FIRE)"
    return res


def report(res, label="", stream=sys.stdout):
    print(f"\nTIME LAYER — {label}", file=stream)
    print(f"  grid unit        {res['grid_unit']}", file=stream)
    print(f"  syllables/slots  {res['n_syllables']} / {res['n_slots']}",
          file=stream)
    print(f"  rhyme events     {res['n_events']} "
          f"({res.get('saturation', 0):.0%} of slots)", file=stream)
    if res.get("control_mode"):
        print(f"  control mode     {res['control_mode']}", file=stream)
    if res.get("degenerate"):
        print(f"  DEGENERATE       {res['degenerate']}", file=stream)
    if res.get("refused"):
        # WHICH guard fired is part of the finding: "too few events" names the
        # item, "cannot_tell" names the instrument, and reporting them as one
        # string blames the wrong layer.
        #
        # AND THAT IS WHAT THIS LINE DID UNTIL 2026-08-23, one line under the
        # sentence forbidding it (doctrine 48). It read
        # `res.get('refused_by', 'analyse:n_events')`, and only ONE of the four
        # refusal paths set `refused_by` -- so a saturation refusal, whose whole
        # point is that the INSTRUMENT has no power here, printed "REFUSED BY
        # analyse:n_events" and blamed the item's event count. The default is
        # gone; a path that forgets to name itself now says so out loud rather
        # than borrowing another guard's name (doctrine 20).
        by = res.get("refused_by") or ("UNATTRIBUTED — the refusing guard "
                                       "did not name itself")
        print(f"  REFUSED BY       {by}", file=stream)
        print(f"  REFUSED          {res['refused']}", file=stream)
        return res
    if res.get("period") is not None:
        print(f"  KL               {res['kl']:.4f} nats at period "
              f"{res['period']}", file=stream)
    else:
        print(f"  KL               {res['kl']:.4f} nats; period WITHHELD "
              f"(argmax {res['period_argmax']}, but p is not significant and "
              f"the argmax is biased toward the largest period)", file=stream)
    print(f"  permutation null mean {res['null_mean']:.4f}, "
          f"p95 {res['null_p95']:.4f}", file=stream)
    print(f"  p                {res['p']:.4f}"
          f"{'  *' if res['p'] < 0.05 else ''}", file=stream)
    print(f"  ! isochrony is {res['isochrony'][:60]}...", file=stream)
    return res


if __name__ == "__main__":
    lex = Lexicon()
    tdecl = TimeDeclaration()
    if len(sys.argv) > 1:
        with open(sys.argv[1], encoding="utf-8") as fh:
            lines = [l.strip() for l in fh if l.strip()
                     and not l.strip().startswith("[")]
        report(analyse(lex, lines, tdecl=tdecl), sys.argv[1])
        report(line_final_control(lex, lines, tdecl=tdecl, mode="within"),
               f"{sys.argv[1]} — H3 control as registered (must be null)")
        report(line_final_control(lex, lines, tdecl=tdecl,
                                  mode="against_all"),
               f"{sys.argv[1]} — post-hoc control (must FIRE)")
    else:
        print("usage: python3 quality/time_layer.py FILE")

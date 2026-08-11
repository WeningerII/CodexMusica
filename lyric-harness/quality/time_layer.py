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
    null_samples: int = 20000
    #: If this share of RANDOM re-pairings already passes the band, the item's
    #: own phonological inventory makes rhyme unsurprising and a within-item
    #: null cannot discriminate. Real verse runs ~0.10; a constructed quatrain
    #: whose whole inventory is one rhyme class (rattle/cattle/saddle/battle)
    #: runs 0.43 and returns zero events. That is a TRUE statement about a
    #: within-item null, not a fixable defect -- if 43% of random pairings in
    #: your text rhyme, "this pair rhymes" carries almost no information
    #: relative to that text. The layer says so instead of reporting 0%.
    max_null_band_pass: float = 0.25
    n_perm: int = 2000
    seed: int = 20260810
    isochrony: str = ("ASSUMED, not measured. Grid positions are evenly "
                      "spaced. False for stress-timed English; less wrong on "
                      "the stress grid than the syllable grid, and less wrong "
                      "for rap over short spans than for sung verse over long "
                      "ones. Every result below is conditional on it.")


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
    for a, b in spans:
        for c in starts:
            if c <= a or c - a > tdecl.window:
                continue
            for (c2, d) in by_start.get(c, ()):
                if c2 < b:
                    continue          # overlapping spans are not a relation
                if {x["widx"] for x in stream[a:b]} & \
                        {x["widx"] for x in stream[c2:d]}:
                    continue          # a word cannot rhyme with itself
                out.append(((a, b), (c2, d)))
    return out


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
    rng = random.Random(tdecl.seed ^ 0x5EED)
    out, n_valid, tries = [], 0, 0
    limit = tdecl.null_samples * 20
    while n_valid < tdecl.null_samples and tries < limit:
        tries += 1
        sa = left[rng.randrange(len(left))]
        sb = right[rng.randrange(len(right))]
        if sa == sb or max(sa[0], sb[0]) < min(sa[1], sb[1]):
            continue                      # not a valid pair at all: redraw
        if {x["widx"] for x in stream[sa[0]:sa[1]]} & \
                {x["widx"] for x in stream[sb[0]:sb[1]]}:
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
    """
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
    for k, (sa, sb) in enumerate(pairs):
        v = _raw_score(stream, sa, sb, decl, comparator)
        if v is None:
            continue
        p = _pvalue(v, null, n_valid)
        pv[k] = p
        scored.append((sa, sb, p))

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
        # RESOLUTION GUARD. BH's threshold for the top-ranked p-value is
        # q/n, and n here is ~10^4 candidate pairs, so it needs a tail
        # resolved to ~1e-5. The empirical null resolves to 1/(N+1) = 5e-5,
        # which is coarser -- so whether anything is discovered depends on
        # how many pairs happen to pile up on the resolution floor, not on
        # the evidence. Measured: 63% saturation on one sonnet and 0% on the
        # next three, from that alone. FWER needs no such resolution because
        # its cut is alpha/m with m ~ 15, not q/n with n ~ 10^4.
        floor_p = 1.0 / (n_valid + 1) if n_valid else 1.0
        n_hyp = len(pairs) if tdecl.family == "candidate" else len(scored)
        if scored and floor_p > tdecl.q / n_hyp:
            if detail is not None:
                detail["bh_unresolvable"] = (
                    f"BH needs a p-value resolution finer than "
                    f"q/n = {tdecl.q / n_hyp:.2e}; this null resolves "
                    f"to {floor_p:.2e}. Raise null_samples to at least "
                    f"{int(n_hyp / tdecl.q)} or use a FWER correction, "
                    f"whose cut does not scale with the number of pairs.")
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
            if tdecl.correction == "bonferroni":
                cut = tdecl.alpha / m
            else:                                  # sidak
                cut = 1.0 - (1.0 - tdecl.alpha) ** (1.0 / m)
            if any(pv.get(k, 1.0) <= cut for k in ks):
                events.add(pos)

    if detail is not None:
        detail.update(
            n_candidate_pairs=len(pairs), n_scored=len(scored),
            n_null=len(null), n_null_valid=n_valid,
            null_band_pass_rate=(len(null) / n_valid) if n_valid else None,
            p_resolution=1.0 / (n_valid + 1) if n_valid else None,
            median_family_size=(sorted(len(v) for v in family.values())
                                [len(family) // 2] if family else 0),
            family_population=tdecl.family,
            correction=tdecl.correction, alpha=tdecl.alpha)
        if family:
            mm = sorted(len(v) for v in family.values())[len(family) // 2]
            detail["per_pair_cut"] = (
                tdecl.alpha / mm if tdecl.correction == "bonferroni"
                else 1.0 - (1.0 - tdecl.alpha) ** (1.0 / mm))
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
            eligible_filter=None, comparator=None, stream=None):
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
    if events is None:
        events = rhyme_events(lex, stream, decl, tdecl, comparator)
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
    }
    if len(ev) < 4 or len(slots) < 8:
        result.update(kl=None, period=None, p=None,
                      refused="too few events or slots for a permutation test "
                              "to mean anything; the layer declines rather "
                              "than returning a number")
        return result
    if saturation >= tdecl.max_saturation:
        result.update(
            kl=None, period=None, p=None,
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
                      eligible_filter=lambda s: s["line_final"])
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
                  eligible_filter=lambda s: True)
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

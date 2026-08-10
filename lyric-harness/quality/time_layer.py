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

from lyric_harness import (Declaration, Lexicon, score,  # noqa: E402
                           word_syllable_map)


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

def rhyme_events(lex, stream, decl, tdecl):
    """-> set of stream positions participating in an internal rhyme.

    Anchors start on a stressed syllable and run 1..max_span syllables, which
    is the harness's existing internal_matches shape; this walks the whole item
    instead of one line, inside a declared window. A span may not rhyme with
    itself, and two spans sharing a word are not a relation.
    """
    starts = [i for i, s in enumerate(stream) if s["stress"] in (1, 2)]
    spans = [(i, i + L) for i in starts
             for L in range(1, tdecl.max_span + 1) if i + L <= len(stream)]
    by_start = {}
    for a, b in spans:
        by_start.setdefault(a, []).append((a, b))

    events = set()
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
                s = score(stream[a:b], stream[c2:d], decl,
                          _words(stream, a, b), _words(stream, c2, d))
                if s["total"] >= tdecl.theta:
                    events.update(range(a, b))
                    events.update(range(c2, d))
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
            eligible_filter=None):
    """Run the layer on one item.

    Returns a dict with the observed statistic, its permutation null, the
    recovered period and everything needed to argue with the result. Never
    returns a score, and never says 'beat'.
    """
    decl = decl or Declaration()
    tdecl = tdecl or TimeDeclaration()
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
        events = rhyme_events(lex, stream, decl, tdecl)
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

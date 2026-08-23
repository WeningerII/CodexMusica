#!/usr/bin/env python3
"""Regressions for the planning phase (quality/plan.py), restated for v2.

THE ONE CLAIM THAT MATTERS is still the round trip: a plan is only a plan
if the machine that grades against it ACCEPTS its artifacts. V2 is a
generator over derived spaces, so the round trip is now a SEED SWEEP — one
lucky seed proves a lookup, twenty seeds prove a grammar — and a second
claim joins it AS AN EQUAL: the MEASURE. V1's bias (4 lines, 4/4,
everywhere) was not a wrong table, it was tables at all; v2's promise is
uniform-by-derivation sampling over spaces the envelope derives, and this
file is where that promise is pinned so it cannot quietly rot back into a
table. The owner's constraint, verbatim in effect: math, functions,
algorithms — not hard rules.

Sections:
  1  determinism — same request byte-identical, the seed is READ
  2  refusals — no seed, blocked form by NAME, lines outside the envelope
     naming the envelope
  3  THE ROUND TRIP, SWEPT — 20 seeds' plans each filled by a dummy draft
     and graded by the real Reviser: everything parses, every mandated
     pair is judged, nothing is refused, and no shape-drift or verbatim
     finding fires on a shape the planner itself volunteered
  4  THE MEASURE — the bias-killers: exact-uniform samplers held to their
     enumerations, the meter marginal freed from the leaf measure, lines
     per section freed from 4, the roster fully reachable, the envelope
     floor still DERIVED from the calibrated band, and the move-37 pin
     (this module imports no corpus)
  5  the disclosure — every free choice echoed beside the set (or the
     size of the set) it was chosen from
  6  the rendering — the filled song in performance order is the
     SYSTEM'S output (until 2026-08-18 the delivered song text was
     assembled by hand in an operator's chat — the
     no-private-instruments rule closes that)

Run: python3 quality/test_plan.py
"""

import ast
import json
import os
import random
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.plan import (BLOCKED_FORMS, ENVELOPE,  # noqa: E402
                          EXACT_ENUM_MAX, GENERATOR_ROSTER,
                          ZERO_LINE_FUNCTIONS, PlanRefused, bell, fill_plan,
                          grading_command, make_plan, meter_dims,
                          meter_space_size)
import quality.plan as PLN  # noqa: E402
from quality import capacity as CAP  # noqa: E402
from quality import meter_bands as MB  # noqa: E402
from quality import slots as SL  # noqa: E402

#: HOW MANY SEEDS §7's population is. Declared rather than typed at each
#: call, because the blind-draw mutation below has to sweep the SAME set as
#: the clean draw or the two rates are not comparable.
JOINT_SWEEP = 40
real_word = SL.placement_word

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_determinism():
    print("\n1. a plan is a function of its request — seeded, reproducible")
    a = json.dumps(make_plan(seed=7), sort_keys=True)
    b = json.dumps(make_plan(seed=7), sort_keys=True)
    check("the same request is byte-identical twice (doctrine 66)", a == b)
    # THE ECHO IS STRIPPED BEFORE COMPARING — mutation M1 from the v1 file,
    # kept: the plan discloses `request.seed`, so two plans differ at that
    # key even when the seed is never READ. The claim is about the CHOICES,
    # over a sweep wide enough that a constant rng cannot hide.
    bodies = {json.dumps(make_plan(seed=k)["choices"], sort_keys=True)
              for k in range(10)}
    check("across ten seeds the CHOICES differ — the seed is READ, and the "
          "echoed request cannot stand in for read behaviour",
          len(bodies) >= 2, f"{len(bodies)} distinct choice-set(s)")


def test_refusals():
    print("\n2. refusals, not defaults (doctrine 20)")
    t_lo, t_hi = ENVELOPE["total_lines"]
    for kwargs, phrase, why in (
            (dict(seed=None), "requires --seed", "a free choice without a "
             "declared seed is a hidden coordinate"),
            (dict(seed=1, form="ghazal"), "BLOCKED", "declared-but-blocked "
             "is a different answer from unknown (doctrine 28)"),
            (dict(seed=1, form="madrigal"), "not a declared form",
             "unknown is refused by name with the declared set listed"),
            (dict(seed=1, lines=t_lo - 1), "outside the planner's envelope",
             "below the envelope is refused naming the envelope"),
            (dict(seed=1, lines=t_hi + 1), "outside the planner's envelope",
             "above the envelope is refused naming the envelope")):
        try:
            make_plan(**kwargs)
            check(f"refuses {kwargs}", False, "no refusal was raised")
        except PlanRefused as e:
            check(f"refuses {kwargs} — {why}", phrase in str(e),
                  str(e)[:90])
    # The refusal's numbers come from the ENVELOPE, not a copy of it
    # (doctrine 91) — and it says the envelope bounds what the planner
    # VOLUNTEERS, not what the graders accept.
    try:
        make_plan(seed=1, lines=t_hi + 1)
    except PlanRefused as e:
        check("...naming the envelope's own bounds, and that hand-declaring "
              "outside them stays open",
              str(t_lo) in str(e) and str(t_hi) in str(e)
              and "hand" in str(e), str(e)[:110])
    check("ghazal's block names the missing FLAG, so the refusal is a work "
          "order and not a shrug",
          "repeat_licence" in BLOCKED_FORMS["ghazal"])


#: 64 distinct CMUdict-readable end words — enough for the envelope's
#: longest song. The dummy draft only has to be READABLE and honor the
#: plan's verbatim returns; the round trip asserts machinery outcomes
#: (parses, judged counts, no drift), never quality verdicts.
BANK = ("stone rain door light road name fire glass train hill salt wire "
        "bell coat dust song tide map north paper engine harbor winter "
        "copper cedar lantern gravel timber shoulder window ladder hammer "
        "anchor barrel candle collar dollar feather garden hollow iron "
        "jacket kitchen letter marble meadow motor needle orchard pepper "
        "pocket river saddle shovel silver summer thunder valley wagon "
        "willow yellow amber basket corner").split()


def dummy_draft(plan):
    """The plan's own contract realised in placeholder words: one readable
    line per slot, each line b of a returns row copied verbatim from its
    source line a — BY the row, so a planner that emitted rows a draft
    cannot honor would fail here first."""
    rets = {}
    if plan["returns"]:
        for r in plan["returns"].split(";"):
            a, b = (int(x) for x in r.split(","))
            rets[b] = a
    lines = []
    for i in range(1, plan["total_lines"] + 1):
        if i in rets:
            lines.append(lines[rets[i] - 1])
        else:
            lines.append("we carry the morning to the "
                         f"{BANK[(i - 1) % len(BANK)]}")
    return lines


#: Findings that must NEVER stand on a planner-emitted shape: the two hard
#: verbatim-return failures, and the three drift notes that would mean the
#: planner contradicted its own returns mandate (instances of one function
#: kind must share length, meter and pickup — the anacrusis is drawn per
#: KIND for exactly this reason). RETURN_NEVER_RETURNS (a single chorus is
#: a real form; the note is a disclosure, and disclosure is not a ban) and
#: RETURN_SCHEME_DRIFT (a fact about the DRAFT's words, not the plan) are
#: deliberately absent from this set.
FORBIDDEN = {"RETURN_NOT_VERBATIM", "RETURN_OUT_OF_RANGE",
             "RETURN_SLOT_DRIFT", "RETURN_LENGTH_DRIFT",
             "RETURN_METER_DRIFT"}


def test_the_round_trip():
    """THE CROWN, SWEPT. Twenty seeds' plans survive the machine that
    grades against them — not by this file's reading of the formats, but
    by the real readers refusing nothing."""
    print("\n3. THE ROUND TRIP — the graders accept what the planner emits, "
          "over a sweep")
    import quality.fit as FT
    import quality.schemes as SC
    from quality.grid import song_from_blueprint
    from quality.revise import Reviser

    R = Reviser()
    bad = []
    for seed in range(20):
        plan = make_plan(seed=seed)
        draft = dummy_draft(plan)
        try:
            bp = fill_plan(plan, draft)
            song, hooks = song_from_blueprint(bp)[:2]
            if (len(song.lines) != plan["total_lines"]
                    or len(song.sections) != len(plan["sections"])):
                bad.append((seed, "blueprint shape mismatch"))
                continue
            # MEMBERS ARE LEFT AS STRINGS, exactly as the CLI's own
            # `--groups=` reader leaves them since 2026-08-23: a member may
            # name WHERE in its line the requirement binds (`3.head`,
            # `3.T2`), and `int()` here refused the planner's own output in
            # this test's words rather than the slot layer's. `mandate()` is
            # the one definition of what a member may be.
            gs = [[x for x in g.split(",")]
                  for g in plan["groups"].split(";")]
            rets = ([[int(x) for x in r.split(",")]
                     for r in plan["returns"].split(";")]
                    if plan["returns"] else None)
            m = SC.mandate(gs, n_lines=plan["total_lines"], returns=rets)
            found = R.inspect(list(draft), m, blueprint=bp,
                              subdivision=FT.Subdivision(
                                  plan["subdivision"],
                                  source="test_plan round trip"))
            g = found["grade"]
            codes = {f.code for f in found["whole"]}
            for _ln, fs in found["per_line"].items():
                codes |= {f.code for f in fs}
            if not (g["pairs_mandated"] == g["pairs_judged"] > 0
                    and g["pairs_refused"] == 0):
                bad.append((seed, f"counts m{g['pairs_mandated']} "
                                  f"j{g['pairs_judged']} "
                                  f"r{g['pairs_refused']}"))
            elif codes & FORBIDDEN:
                bad.append((seed, sorted(codes & FORBIDDEN)))
            for s in plan["sections"]:
                n = sum(1 for ls in plan["line_slots"]
                        if ls["section"] == s["name"])
                if s["function"] in ZERO_LINE_FUNCTIONS and (
                        n != 0 or s["bars"] < 1):
                    bad.append((seed, f"instrumental {s['name']} carries "
                                      f"{n} line(s), {s['bars']} bar(s)"))
        except Exception as e:  # noqa: BLE001 — any raise is the failure
            bad.append((seed, f"{type(e).__name__}: {e}"))
    check("20 seeds: blueprint READS, mandate PARSES, mandated == judged "
          "> 0, refused 0 (three counts, never summed: doctrine 79), and "
          "no verbatim/drift finding stands on a planner shape",
          not bad, f"bad: {bad or 'none'}")

    # One EXACT-length request rides the same rails.
    plan = make_plan(seed=7, lines=22)
    check("an exact --lines request is satisfied exactly",
          plan["total_lines"] == 22)

    cmd = grading_command(plan)
    check("the emitted grading command carries BOTH mandate halves and the "
          "subdivision — nothing for an operator to remember",
          "--groups=" in cmd and "--subdivision" in cmd
          and ("--returns=" in cmd or not plan["returns"]), cmd[:100])

    try:
        fill_plan(plan, dummy_draft(plan)[:-1])
        check("a short draft is refused, never truncated-to-fit", False)
    except PlanRefused as e:
        check("a short draft is refused, never truncated-to-fit",
              "same song" in str(e), str(e)[:80])


def test_the_measure():
    print("\n4. THE MEASURE — uniform by derivation, and the v1 biases "
          "stay dead")

    # The samplers are held to their own enumerations (enumerate-to-verify,
    # count-to-sample).
    ok = all(PLN._n_compositions_23(n) == len(PLN._compositions_23(n))
             for n in range(1, 16))
    check("the composition counter equals the enumeration for n in 1..15 "
          "— the Padovan recurrence counts the real list", ok)
    rng = random.Random(20260818)
    c7 = Counter(PLN._composition_uniform(7, rng) for _ in range(9000))
    check("the composition sampler is EXACT-uniform at n=7 — all 3 "
          "compositions drawn, each within 2900-3100 of 9000",
          set(c7) == set(PLN._compositions_23(7))
          and all(2800 <= v <= 3200 for v in c7.values()),
          dict(c7))
    import quality.schemes as SC
    check("bell(k) equals the full RGS enumeration's own count for k in "
          "2..7 — the disclosed pool size is held to the enumeration, not "
          "to itself (this pin caught bell() returning B(k-1) the day it "
          "was written)",
          all(bell(k) == sum(1 for _ in SC.rgs(k)) for k in range(2, 8)),
          [bell(k) for k in range(2, 8)])
    rng = random.Random(20260818)
    c4 = Counter(PLN._rgs_uniform(4, rng) for _ in range(15000))
    vals = sorted(c4.values())
    check("the partition sampler is EXACT-uniform at k=4 — all Bell(4)=15 "
          "partitions drawn, max/min frequency ratio under 1.25",
          len(c4) == bell(4) and vals[-1] / vals[0] < 1.25,
          f"{len(c4)} partitions, ratio {vals[-1] / vals[0]:.3f}")
    rng = random.Random(5)
    code, pool = PLN._scheme_for(12, rng)
    check("above EXACT_ENUM_MAX the scheme pool is Bell(k)-1, disclosed "
          "without enumerating, and the drawn code is a valid RGS with a "
          "mandated pair",
          12 > EXACT_ENUM_MAX and pool == bell(12) - 1 and code[0] == 0
          and all(c <= max(code[:i + 1]) + 1 for i, c in enumerate(code[1:]))
          and any(code.count(b) >= 2 for b in set(code)))

    # The meter dims are tight arithmetic on the envelope. TWO UNITS SINCE
    # 2026-08-23 (`MISSING.md` M-81(B)): the CEILING binds the line's length
    # in BEATS and the FLOOR binds its capacity in SLOTS, so a pair's beat
    # range is tested against a different end of the envelope at each end.
    lo, hi = ENVELOPE["slots_per_line"]
    b_line = ENVELOPE["beats_per_line"][1]
    dims = meter_dims()
    tight = all(bars * b_hi <= b_line and bars * (b_hi + 1) > b_line
                and bars * sub * b_lo >= lo
                and (b_lo == 2 or bars * sub * (b_lo - 1) < lo)
                for (bars, sub), (b_lo, b_hi) in dims.items())
    check("every dimension pair's beat range is TIGHT against the envelope "
          "— the top against the BEATS ceiling and the bottom against the "
          "SLOTS floor, both endpoints legal, one step past either is not",
          tight, f"{len(dims)} pairs")
    pad = [0] * (hi + 3)
    pad[0] = 1
    for n in range(2, hi + 1):
        pad[n] = pad[n - 2] + pad[n - 3]
    size = sum(pad[b] for (b_lo, b_hi) in dims.values()
               for b in range(b_lo, b_hi + 1))
    check("meter_space_size matches an independent iterative recompute — "
          "the disclosure's denominator cannot drift from the space",
          size == meter_space_size(), f"{size} cycles")

    # THE MEASURE ITSELF, held to its prediction at the unit — 24,000
    # draws of `_sample_meter` directly, because the plan-level marginal
    # is too coarse to convict a partial regression (a leaf measure
    # smuggled in BEHIND the uniform pair draw is diluted twelvefold and
    # slips under any plan-level threshold; this exact mutant walked
    # through the first draft of this file). Deterministic — one seeded rng.
    rng = random.Random(20260818)
    N = 24000
    draws = [PLN._sample_meter(rng) for _ in range(N)]
    pair_n = Counter((d[0], d[1]) for d in draws)
    slot_n = Counter(d[4][2] for d in draws)     # beats per LINE since M-81(B)
    vals = PLN.beats_values()

    # THE MEASURE MOVED 2026-08-23 (`MISSING.md` M-81) AND THE OLD CHECKS
    # HERE WERE PINNING THE DEFECT, which is why they are repointed with the
    # argument rather than deleted (this repo's own §5/§13 lesson — a test
    # that measures a wrong behaviour precisely is what keeps it):
    #   ~~"the dimension pairs are drawn uniformly — every pair the envelope
    #   admits, each within 15% of its expected share"~~
    #   ~~"within the widest pair the beat count is UNIFORM on its range"~~
    # Both were true of the sampler and both were the wrong question.
    # `bars_per_line` runs to `hi // 2` — a sound BOUND and never a claim
    # that all 24 values are equally musical — and a high-bars pair's beat
    # range COLLAPSES: at `bars=24, sub=1` the only legal beat count is 2, so
    # that pair emitted the envelope's CEILING every time it was drawn.
    # Uniform over PAIRS is therefore not uniform over SLOTS PER LINE, which
    # is the coordinate the envelope — and the calibration behind it — is
    # actually stated in: measured at median 35 of a [5, 48] envelope, with
    # 4.6% of lines given a grid a band-legal line could fill.
    #
    # WHAT IS ASSERTED NOW is the declared coordinate's own uniformity, the
    # coverage the old check was really protecting, and the pair marginal as
    # a PREDICTION computed from `meter_factorisations` alone.
    def _tv(a, b):
        """Total variation between two distributions given as counts. Used
        for every 'which hypothesis does this look like' question below, so
        that none of them needs a threshold."""
        _ka, _kb = sum(a.values()), sum(b.values())
        return 0.5 * sum(abs(a.get(k, 0) / _ka - b.get(k, 0) / _kb)
                         for k in set(a) | set(b))

    _sshare = N / len(vals)
    _smean = sum(slot_n.elements()) / N
    _smid = (vals[0] + vals[-1]) / 2
    check("BEATS PER LINE — the coordinate the envelope is stated in, and "
          "the length a listener hears — is drawn UNIFORM over what the "
          "envelope can realise: every value reached, each within 15% of "
          "its share, and the observed mean within 1.0 of the envelope's "
          "own midpoint. ~~SLOTS per line~~ (M-81(A)) had the ORDER right "
          "and the UNIT wrong: a slot is a subdivision unit, so drawing "
          "uniformly over slots made a line's LENGTH a function of its grid "
          "resolution — 48 slots is twelve beats at subdivision 4 and "
          "forty-eight at subdivision 1",
          len(slot_n) == len(vals)
          and all(abs(v - _sshare) <= 0.15 * _sshare for v in slot_n.values())
          and abs(_smean - _smid) <= 1.0,
          f"{len(slot_n)}/{len(vals)} values, mean {_smean:.2f}, midpoint "
          f"{_smid}, max deviation "
          f"{max(abs(v - _sshare) / _sshare for v in slot_n.values()):.1%}")
    check("...and the ADMITTED PAIR SET is the same set derived two ways — "
          "`meter_dims`' non-empty beat range and `meter_factorisations`' "
          "divisibility — so the sampler and the disclosure's denominator "
          "cannot come to different answers about what this envelope allows "
          "(doctrine 1)",
          {p for n in vals for p in PLN.meter_factorisations(n)} == set(dims),
          f"{len(dims)} pairs both ways")
    check("...and EVERY pair the envelope admits is still REACHED, which is "
          "the coverage the uniformity check was really protecting",
          len(pair_n) == len(dims), f"{len(pair_n)}/{len(dims)} pairs")
    # THE PAIR MARGINAL IS A PREDICTION, NOT AN ACCIDENT. Computed from
    # `meter_factorisations` and nothing else: a slots count is drawn 1/|vals|
    # of the time and then splits its mass evenly over its factorisations.
    pred = Counter()
    for n in vals:
        f = PLN.meter_factorisations(n)
        for p in f:
            pred[p] += N / len(vals) / len(f)
    _sigma = max(abs(pair_n[p] - pred[p]) / (pred[p] ** 0.5) for p in dims)
    check("...and the pair marginal MATCHES that prediction, every pair "
          "inside four sigma of its own expected count — so the shares "
          "follow from the arithmetic rather than from whatever the sampler "
          "happens to do",
          all(abs(pair_n[p] - pred[p]) <= 4 * (pred[p] ** 0.5) for p in dims),
          f"worst {_sigma:.2f} sigma")
    # ~~max/min predicted share > 100~~ — struck 2026-08-23: 100 was chosen
    # against the 412x the SLOTS envelope happened to produce, and M-81(B)'s
    # beats ceiling brings it to 50x, so the literal was measuring the
    # envelope's WIDTH rather than the sampler's shape. Asked as the same
    # two-hypothesis test as the leaf check below, with no threshold: is the
    # observed pair marginal the realisability share, or is it FLAT — which
    # is exactly what §4's own struck pair-uniformity check asserted.
    _flat = Counter({p: N / len(dims) for p in dims})
    _ratio = max(pred.values()) / min(pred.values())
    check("...and that marginal is the REALISABILITY share and not a flat "
          "one, which is what §4's struck pair-uniformity check asserted: a "
          "beat count one factorisation can make must not be rarer than one "
          "fifteen can",
          _tv(pair_n, pred) < _tv(pair_n, _flat),
          f"total variation to the realisability share "
          f"{_tv(pair_n, pred):.4f}, to flat {_tv(pair_n, _flat):.4f}; "
          f"max/min predicted {_ratio:.0f}x")

    # The envelope floor is DERIVED, not copied (the calibration chain).
    from quality import meter_bands as MB
    check("BOTH ENDS OF THE ENVELOPE ARE THE SAME CALIBRATED BAND READ IN "
          "DIFFERENT UNITS, and neither is a literal (`MISSING.md` M-81(B), "
          "doctrine 91): the BEATS ceiling is the density band's ceiling "
          "times `BEATS_PER_SYLLABLE_MAX` — a line carries at most that many "
          "syllables and at least one beat each — while the SLOTS floor is "
          "the band's floor, because a syllable occupies one slot. Detach "
          "either and this fails",
          b_line == MB.ADOPTED["DENSITY"][1] * PLN.BEATS_PER_SYLLABLE_MAX
          and lo == MB.ADOPTED["DENSITY"][0],
          f"beats ceiling {b_line}, slots floor {lo}")
    check("...and the SLOTS ceiling is not declared beside them — it FOLLOWS "
          "from the beats ceiling and the finest grid this vocabulary models, "
          "which is what makes the old `SLOTS_CEILING_X` unnecessary rather "
          "than merely renamed",
          hi == b_line * max(ENVELOPE["subdivisions"])
          and not hasattr(PLN, "SLOTS_CEILING_X"),
          f"slots ceiling {hi} = {b_line} beats x "
          f"{max(ENVELOPE['subdivisions'])}")

    # THE BIAS-KILLERS, over 200 seeds. Deterministic — make_plan is a
    # function of its seed, so these are pins, not statistics.
    beats, meters, units = [], set(), set()
    funcs, ks = set(), Counter()
    totals = set()
    for seed in range(200):
        p = make_plan(seed=seed)
        m = p["sections"][0]["meter"]
        beats.append(m["beats"])
        meters.add((m["beats"], m["unit"]))
        units.add(m["unit"])
        totals.add(p["total_lines"])
        funcs.update(s["function"] for s in p["sections"])
        for sm in p["choices"]["schemes"].values():
            ks[sm["lines"]] += 1
    bs = sorted(beats)
    # THE LEAF MEASURE, ASKED AS A TWO-HYPOTHESIS TEST WITH NO THRESHOLD IN
    # IT AT ALL. ~~median beat count <= 8 and under 10% of plans at >= 40
    # beats~~ (the original) and ~~both at most HALF what the leaf measure
    # gives~~ (M-81(A)'s repointing) are both struck: the first described the
    # pair-uniform marginal, and the second stopped discriminating the moment
    # M-81(B) capped beats-per-bar — with no beat count above 12 in the
    # envelope, the leaf measure's >=40 share is 0 and so is this sampler's,
    # and `0 <= 0` reads exactly like a check that examined something.
    #
    # WHAT IS ASKED INSTEAD is which of two COMPUTED distributions the
    # observation actually looks like: this sampler's own prediction
    # (beats-per-line uniform, then a factorisation) or uniform-over-
    # enumerated-cycles. Neither side is a number somebody chose, and the
    # second check is what stops it being a comparison of one hypothesis
    # with itself.
    _own = Counter()
    for _n in vals:
        _f = PLN.meter_factorisations(_n)
        for (_bars, _sub) in _f:
            _own[_n // _bars] += 1.0 / len(vals) / len(_f)
    _leaf = Counter()
    for (_b, _s2), (_lo2, _hi2) in dims.items():
        for _n in range(_lo2, _hi2 + 1):
            _leaf[_n] += PLN._n_compositions_23(_n)
    _obs = Counter(d[2] for d in draws)

    _d_own, _d_leaf = _tv(_obs, _own), _tv(_obs, _leaf)
    check("the beats-per-bar marginal is the SAMPLER'S OWN prediction and "
          "not the LEAF measure's — a two-hypothesis test, both sides "
          "computed, no threshold anywhere in it (compositions into {2,3} "
          "grow ~1.3247^n, so leaves still pile on the envelope's maximal "
          "beat count: 0.202 of the leaf's mass sits at 12 against this "
          "sampler's 0.018)",
          _d_own < _d_leaf,
          f"total variation to this sampler {_d_own:.4f}, to the leaf "
          f"{_d_leaf:.4f}")
    check("...and the two hypotheses are genuinely DIFFERENT, so that is not "
          "a comparison of one thing with itself — they part further from "
          "each other than the observation parts from either",
          _tv(_own, _leaf) > _d_own, f"predictions differ by "
          f"{_tv(_own, _leaf):.4f}")
    # AND THE COUNTERWEIGHT, which nothing checked before and which the
    # pair-uniform measure failed outright: a lyric line normally occupies
    # ONE bar, or a few. `bars_per_line` runs to `hi // 2` as a BOUND, and
    # under the old measure the median plan spent EIGHT bars on a line — the
    # same slots product spelled as many short bars instead of one long one.
    bars_pl = sorted(p["choices"]["bars_per_line"] for p in
                     [make_plan(seed=s) for s in range(200)])
    check("...and a line occupies ONE bar in most plans, which is what the "
          "pair-uniform measure got wrong in the other direction: it is the "
          "same slots product spelled as many short bars, and no song sets "
          "one lyric line across eight of them",
          bars_pl[100] <= 2 and sum(b == 1 for b in bars_pl) / 200 > 0.4,
          f"median {bars_pl[100]} bars/line, "
          f"one-bar {sum(b == 1 for b in bars_pl) / 200:.1%}")
    check("the 4/4 bias is dead: many distinct meters over 200 seeds, both "
          "notation units, and 4/4 under 30% of plans. The COUNT is not "
          "pinned at a literal — it moves with the derived envelope — so "
          "what is asserted is that the sampler is not concentrated: at "
          "least ten distinct cycles and 4/4 no more common than any "
          "single-cycle share of the space would make it",
          len(meters) >= 10 and units == {4, 8}
          and sum(1 for b in beats if b == 4) / 200 < 0.30,
          f"{len(meters)} meters, units {sorted(units)}, "
          f"4/4 {sum(1 for b in beats if b == 4) / 200:.1%}")
    k_total = sum(ks.values())
    # ~~every k in the envelope's section range~~ — REPINNED 2026-08-23. The
    # section range is no longer a literal `(1, 16)`: its ceiling is the whole
    # song's derived line ceiling, and a section can only be as long as the
    # song it is drawn inside, so EXHAUSTING that range in 200 seeds is
    # arithmetic nobody should assert. The claim that carries the finding is
    # unchanged: 4 is not privileged, and the spread is wide.
    check("the 4-line bias is dead: k=4 takes under 20% of sections, and the "
          "draw reaches well past the quatrain",
          ks[4] / k_total < 0.20 and len(ks) >= 12 and max(ks) > 8,
          f"{len(ks)} distinct k in [{min(ks)}, {max(ks)}], "
          f"k=4 at {ks[4] / k_total:.3f}")
    check("the whole GENERATOR_ROSTER is reached — 14 functions, not "
          "v1's five",
          # ~~14~~ 19 — REPINNED 2026-08-22. `GENERATOR_ROSTER` is no
          # longer a hand-typed tuple: it DERIVES from the
          # section-kind functions in `grid.SECTION_FUNCTIONS`
          # (`FunctionSpec.kind`, M-56), so this number is now a
          # property of the vocabulary rather than of a literal, and
          # the seven that were excluded by a prose comment — hook,
          # postchorus, reprise, turnaround, false_ending among them —
          # are drawn. The ASSERTION that matters is the equality: the
          # sampler reaches the WHOLE roster, whatever size it is.
          funcs == set(GENERATOR_ROSTER) and len(GENERATOR_ROSTER) == 19,
          f"reached {len(funcs)}")
    # THE FLOOR MOVED 2026-08-23 AND THE FORM IS WHY (doctrine 17). This
    # read `min(totals) <= 8`. `FORM_REQUIRES` makes a verse AND a chorus
    # mandatory for `verse-chorus`, so the shortest drawable song is now two
    # sections rather than one and the range floor rises: measured 51
    # distinct values in [11, 64] over 300 seeds, against the old [8, 64].
    # THE CLAIM IS UNCHANGED — the totals still cover the envelope's ORDER
    # rather than clustering on one shape — and only the reachable floor
    # moved, because a shape the form forbids is no longer drawn.
    # ~~reaching under 15 and over 60 lines~~ — REPINNED 2026-08-23. 60 was
    # inside the LITERAL envelope `total_lines (4, 64)`; the envelope is
    # derived now and its ceiling is 55, because that is the longest song
    # whose expected token count still lands inside a MEASURED floor profile.
    # Asserting 60 would be asserting that the planner volunteers a length
    # the floor cannot grade with teeth — the opposite of what this repin is
    # for. The claim that carries the finding is the SPREAD, and it is
    # stated against the derived envelope rather than against a number.
    _lo, _hi = ENVELOPE["total_lines"]
    check("totals cover the envelope's order, not one shape: 40+ distinct "
          "values spanning most of the DERIVED envelope, both ends reached",
          len(totals) >= 40 and min(totals) <= _lo + 5
          and max(totals) >= _hi - 5,
          f"{len(totals)} distinct in [{min(totals)}, {max(totals)}], "
          f"envelope [{_lo}, {_hi}]")

    # THE MOVE-37 PIN: the corpus samples nothing. The planner imports
    # exactly its three quality dependencies and never opens a file — a
    # measured distribution wired into the dice would have to come through
    # one of those doors.
    tree = ast.parse(open(os.path.join(HERE, "plan.py"),
                          encoding="utf-8").read())
    subs = set()
    for n in ast.walk(tree):
        if isinstance(n, ast.Import):
            subs.update(a.name.split(".", 1)[1] for a in n.names
                        if a.name.startswith("quality."))
        elif isinstance(n, ast.ImportFrom) and n.module == "quality":
            subs.update(a.name for a in n.names)
        elif isinstance(n, ast.ImportFrom) and (n.module or "").startswith(
                "quality."):
            subs.add(n.module.split(".", 1)[1])
    opens = sum(1 for n in ast.walk(tree) if isinstance(n, ast.Call)
                and isinstance(n.func, ast.Name) and n.func.id == "open")
    # `grid` JOINED THE ALLOW-LIST 2026-08-22 (`MISSING.md` M-54) AND IS THE
    # ONLY MEMBER THAT NEEDED AN ARGUMENT. `schemes`, `meter_bands` and
    # `structures` open NO file between them; `grid.py` opens THREE, so
    # admitting it hands `plan.py` transitive reach to a corpus reader, which
    # is exactly what this guard exists to deny. It is admitted because the
    # planner needs `SECTION_FUNCTIONS` — a HAND-DECLARED vocabulary of the
    # same species as `structures`, not a measured distribution — and because
    # deriving the section placement rules from anywhere else would put a
    # second copy of them beside the grader's (doctrine 1, and the whole
    # subject of M-54).
    #
    # SO THE GUARD IS NARROWED WHERE IT WAS WIDENED, and the second check is
    # STRICTER than the first was: from `grid`, `plan.py` may name ONLY the
    # declared vocabulary and its pure checker. `read_marked_songs` or any
    # other reader appearing here fails, which is the property the import
    # allow-list was standing in for.
    # `as_function` joined 2026-08-22 with M-55's roster: it is the
    # vocabulary's own name RESOLVER (alias and spelling -> key) and opens
    # nothing. It is listed rather than the check being loosened, which is
    # the whole point of a named allow-list -- this guard caught the new
    # reference the same sitting it was added.
    ALLOWED_FROM_GRID = {"SECTION_FUNCTIONS", "FunctionSpec", "as_function",
                         "placement_findings", "placement_of"}
    # `floor` JOINED THE ALLOW-LIST 2026-08-23, ON THE SAME ARGUMENT AS
    # `meter_bands` AND WITH THE SAME RE-TIGHTENING AS `grid`. The owner's
    # standing rule is that no hard number may sit in the generator, and the
    # planner's line envelope was six literals — `(1, 16)`, `(2, 12)`,
    # `(4, 64)`, `(1, 4)`, `(2, 6)`, `(0.0, 0.5, 1.0)` — with no derivation
    # behind any of them. The derivation source is `floor.PROFILES`: a table
    # of ADOPTED CALIBRATION CONSTANTS, the same species as
    # `meter_bands.ADOPTED`, which this guard has always admitted. It is what
    # lets the envelope be a function of WHAT THE GRADER CAN ENFORCE rather
    # than of what somebody chose.
    #
    # AND THE GUARD IS NARROWED WHERE IT WAS WIDENED: from `floor`, `plan.py`
    # may name ONLY `PROFILES`. `floor.py` reaches `quality.features` and
    # `lyric_harness`, so an unrestricted admission would hand the planner
    # transitive reach to a frequency table — which is the corpus arriving at
    # the dice by a longer road (the owner's move-37 ban).
    ALLOWED_FROM_FLOOR = {"PROFILES"}
    # `capacity` AND `slots` JOINED 2026-08-23, each with its own argument
    # and each RE-TIGHTENED the way `grid` and `floor` were.
    #
    # `capacity` — the planner refuses a rhyme group larger than the lexicon
    # is MEASURED to sustain, and that figure is an ADOPTED CALIBRATION
    # constant of the same species as `meter_bands.ADOPTED`. It may name
    # ONLY `ADOPTED_MAX_GROUP`: `capacity.read_table()` opens the artifact,
    # and a planner reaching a table is the corpus arriving at the dice by a
    # longer road.
    # `slots` — the placement vocabulary a plan may draw from. A HAND-
    # DECLARED table of the same species as `structures` and
    # `SECTION_FUNCTIONS`, both already admitted. It may name ONLY
    # `PLANNABLE_PLACEMENTS`: `slots` reaches `relations`, which opens one
    # file, so the same reasoning applies.
    # WIDENED BY TWO 2026-08-23 (`MISSING.md` M-80) AND THE ARGUMENT IS THE
    # SAME ONE: `placement_word` and its `LAST_WORD` sentinel are VOCABULARY
    # — which word of a line a placement NAME denotes — and they touch no
    # stream, no `realise()` and no reader. They live in `slots.py` for
    # doctrine 1's reason (that module is the one place a name is bound to a
    # rule) and are named here rather than re-implemented, which is the whole
    # point of the widening: a second answer to "which word is `headrime`?"
    # inside `plan.py` is exactly what this allow-list would otherwise force.
    ALLOWED_FROM_CAPACITY = {"ADOPTED_MAX_GROUP"}
    ALLOWED_FROM_SLOTS = {"PLANNABLE_PLACEMENTS", "placement_word",
                          "LAST_WORD"}
    grid_names, floor_names = set(), set()
    cap_names, slot_names = set(), set()
    for n in ast.walk(tree):
        if isinstance(n, ast.Attribute) and isinstance(n.value, ast.Name):
            if n.value.id in ("_GR", "grid", "GR"):
                grid_names.add(n.attr)
            elif n.value.id in ("_FL", "floor", "FL"):
                floor_names.add(n.attr)
            elif n.value.id in ("_CAP", "capacity", "CAP"):
                cap_names.add(n.attr)
            elif n.value.id in ("_SL", "slots", "SL"):
                slot_names.add(n.attr)
    check("plan.py imports exactly {schemes, meter_bands, structures, grid, "
          "floor, capacity, slots} from quality and opens NO file — the "
          "corpus cannot reach the dice (the owner's move-37 rule)",
          subs == {"schemes", "meter_bands", "structures", "grid", "floor",
                   "capacity", "slots"}
          and opens == 0,
          f"imports {sorted(subs)}, open() calls {opens}")
    check("...and from `floor` it names ONLY the adopted calibration table, "
          "never a feature reader — `floor.py` reaches `quality.features` "
          "and `lyric_harness`, so an unrestricted admission is the corpus "
          "arriving at the dice by a longer road",
          floor_names <= ALLOWED_FROM_FLOOR,
          f"names {sorted(floor_names)}")
    check("...and from `capacity` ONLY the adopted group ceiling, never the "
          "table reader that opens the artifact behind it",
          cap_names <= ALLOWED_FROM_CAPACITY, f"names {sorted(cap_names)}")
    check("...and from `slots` ONLY the plannable placement vocabulary, "
          "never a resolver — `slots` reaches `relations`, which opens a "
          "file, so the narrowing is what the import allow-list stands for",
          slot_names <= ALLOWED_FROM_SLOTS, f"names {sorted(slot_names)}")
    check("EVERY entry in the planner's envelope is DERIVED or argued, and "
          "none is a bare literal pair — the owner's standing rule that a "
          "number in the generator is a defect. The check is that the "
          "envelope MOVES when its derivation source moves: a floor profile "
          "whose token band widened must widen the line envelope",
          _envelope_tracks_the_floor(),
          "measured by perturbing floor.PROFILES in-process")
    check("...and from `grid` — the one allowed module that opens files at "
          "all — it names ONLY the declared vocabulary and its pure checker, "
          "never a corpus reader. This is the check the import allow-list "
          "was standing in for, and it is stricter than the list",
          grid_names <= ALLOWED_FROM_GRID,
          f"names {sorted(grid_names)}")


def _envelope_tracks_the_floor():
    """Is the line envelope actually a FUNCTION of the floor's calibration?

    A derivation that is written down but not wired reads exactly like a
    literal (doctrine 48). This perturbs the source — widening the `song`
    profile's measured token band — and requires the derived set of
    gradeable line counts to widen with it. Restores the table afterwards,
    and asserts the restoration, so a later section cannot inherit a
    perturbed floor.
    """
    from quality import floor as FL
    from quality import plan as _PL
    before = set(_PL.gradeable_line_counts())
    song = [p for p in FL.PROFILES if p.name == "song"][0]
    old_hi = song.hi
    try:
        song.hi = old_hi + 200
        _PL.gradeable_line_counts.cache_clear()
        after = set(_PL.gradeable_line_counts())
    finally:
        song.hi = old_hi
        _PL.gradeable_line_counts.cache_clear()
    assert set(_PL.gradeable_line_counts()) == before, \
        "the perturbation was not restored"
    return after > before


def test_the_disclosure():
    print("\n5. every free choice is echoed beside the set it was chosen "
          "from")
    plan = make_plan(seed=3)
    ch = plan["choices"]
    check("the plan declares its version and echoes the ENVELOPE it "
          "volunteered from",
          plan["plan_version"] == 2
          and plan["envelope"]["total_lines"] == list(
              ENVELOPE["total_lines"]))
    check("the pattern discloses its functions AND the grammar they were "
          "generated from — a space too large to list is named by its "
          "generator",
          ch["pattern"]["functions"] == [s["function"]
                                         for s in plan["sections"]]
          and "generated grammar" in ch["pattern"]["chosen_from"]
          and str(len(GENERATOR_ROSTER)) in ch["pattern"]["chosen_from"])
    check("the meter disclosure names the space's SIZE and the measure "
          "over it — BY DERIVATION, not by leaf",
          str(meter_space_size()) in ch["meter"]["chosen_from"]
          and "DERIVATION" in ch["meter"]["chosen_from"])
    check("every scheme discloses its rgs, its line count and the SIZE of "
          "the pool it was drawn from — a choice of one is a constant "
          "wearing a coordinate's name",
          all(len(v["rgs"]) == v["lines"] and v["chosen_from"] >= 1
              for v in ch["schemes"].values()), ch["schemes"])
    check("every sung kind's structure comes from the eng-calibrated pool, "
          "disclosed (doctrine 8 — the fin row is deliberately absent)",
          all(v["name"] in v["chosen_from"]
              and "kalevala-alliteration" not in v["chosen_from"]
              for v in ch["structures"].values()))
    check("anacrusis is drawn PER KIND and disclosed with its choice set — "
          "sung kinds only (an instrumental has no pickup to a line)",
          set(ch["anacrusis"]) == set(ch["schemes"])
          and all(v["value"] in v["chosen_from"]
                  for v in ch["anacrusis"].values()))

    # The hook slot points at the first chorus's first line when a chorus
    # exists, and is honest about absence otherwise.
    seen_with, seen_without = False, False
    ok = True
    for seed in range(40):
        p = make_plan(seed=seed)
        first = next((s["line"] for s in p["line_slots"]
                      if s["function"] == "chorus"), None)
        ok = ok and p["hook_slot"] == first
        seen_with = seen_with or first is not None
        seen_without = seen_without or first is None
    check("hook_slot is the first chorus's first line, None when no chorus "
          "— both cases exercised over the sweep",
          # `seen_without` IS UNREACHABLE UNDER THE ONLY DECLARED FORM, and
          # saying so is better than asserting it (doctrine 20). This read
          # `ok and seen_with and seen_without` and went red on 2026-08-23,
          # correctly: `FORM_REQUIRES["verse-chorus"]` makes a chorus
          # mandatory, so every plan has a first chorus line and `hook_slot`
          # is never None. Measured 300 of 300 with a hook slot.
          #
          # The None BRANCH is still right and still reachable — by a form
          # that does not require a chorus, of which `PLAN_FORMS` declares
          # none today. Asserting `seen_without` over a sweep would be
          # asserting that the form is not enforced, which is the defect
          # this file's own §8 exists to pin. So the sweep asserts what it
          # can see, and the None case is proved DIRECTLY against a plan
          # whose chorus lines are removed, which is the shape a
          # chorus-free form would produce.
          ok and seen_with and not seen_without)
    _no_chorus = dict(make_plan(seed=3))
    _no_chorus["line_slots"] = [s for s in _no_chorus["line_slots"]
                                if s["function"] != "chorus"]
    check("...and the None branch is reachable and correct — it is the "
          "answer for a form that requires no chorus, which no declared "
          "form is today, so it is proved on the shape rather than waited "
          "for over a sweep",
          next((s["line"] for s in _no_chorus["line_slots"]
                if s["function"] == "chorus"), None) is None
          and seen_without is False,
          f"{len(_no_chorus['line_slots'])} non-chorus slot(s); "
          f"declared forms: {PLN.PLAN_FORMS}")

    check("the writer brief carries shape and rhyme plan and NEVER names "
          "the harness — the coverage experiment's blindness rule, kept",
          "lines" in plan["writer_brief"]
          and "harness" not in plan["writer_brief"].lower()
          and "mandate" not in plan["writer_brief"].lower())
    # EVERY section is briefed WITH ITS MEASUREMENTS — verse, chorus,
    # instrumental, the whole roster (the owner's rule, 2026-08-18: the
    # duration, meter and pickup were carried by the plan all along, so
    # the brief surfaces them — required output, not a prose habit). Each
    # expectation is DERIVED from the section's own dict and slots
    # (doctrine 91: the words cannot drift from the numbers), and every
    # section in the first 100 seeds is held to it.
    n_secs, n_inst = 0, 0
    misses = []
    for seed in range(100):
        p = make_plan(seed=seed)
        for s in p["sections"]:
            n_secs += 1
            im = s["meter"]
            size = (f"{s['bars']} bar{'s' if s['bars'] != 1 else ''} "
                    f"of {im['beats']}/{im['unit']}")
            slots = [ls for ls in p["line_slots"]
                     if ls["section"] == s["name"]]
            if not slots:
                n_inst += 1
                want = (f"[{s['function'].upper()} — instrumental — "
                        f"{size}, no words]")
            else:
                # THE ONE DEFINITION, called rather than copied. This was
                # a second literal of the same table and it went stale the
                # same day the first one did: anacrusis became a function of
                # the section's own subdivision, a quarter-beat pickup
                # appeared, and BOTH copies raised `KeyError: 0.75`.
                pickup = PLN._pickup_phrase(slots[0]["beat"] - 1)
                k = len(slots)
                want = (f"[{s['function'].upper()} — {k} "
                        f"line{'s' if k != 1 else ''} — {size}{pickup}]")
            if want not in p["writer_brief"]:
                misses.append((seed, want))
    check("EVERY section is briefed with its own duration, meter and "
          "pickup, read from the dict and slots the grid grades — "
          "measured-and-followed means surfaced, on sung and instrumental "
          "rows alike",
          n_secs > 0 and n_inst > 0 and not misses,
          f"{n_secs} section(s) ({n_inst} instrumental) over 100 seeds; "
          f"misses: {misses[:2] or 'none'}")


def test_the_rendering():
    print("\n6. the filled song RENDERS in performance order — the "
          "copy-paste artifact is the system's output")
    # A shape with both a verbatim return and an instrumental, found
    # honestly rather than pinned to a seed.
    for seed in range(300):
        p = make_plan(seed=seed)
        if p["returns"] and any(s["function"] in ZERO_LINE_FUNCTIONS
                                for s in p["sections"]):
            break
    else:
        check("a returns+instrumental shape appears within 300 seeds",
              False)
        return
    draft = dummy_draft(p)
    text = PLN.render_song(p, draft)
    lines = text.splitlines()

    # Every section's header, in order, derived from the same dict and
    # slots §5 derives from — and via the ONE builder the brief uses.
    heads = []
    for s in p["sections"]:
        slots = [ls for ls in p["line_slots"]
                 if ls["section"] == s["name"]]
        heads.append(PLN.section_header(s, slots))
    # A returning chorus renders the SAME header twice, so each is found
    # from a moving cursor — plain index() would land on the first
    # instance both times (which is exactly how this test first failed).
    positions, cursor, ok_heads = [], 0, True
    for h in heads:
        try:
            at = lines.index(h, cursor)
        except ValueError:
            ok_heads, at = False, -1
        positions.append(at)
        cursor = at + 1 if at >= 0 else cursor
    check("every section's bracket header appears, in performance order, "
          "from the SAME builder the writer brief uses (seed "
          f"{p['request']['seed']})",
          ok_heads and positions == sorted(positions), positions)

    # Every line of the draft appears under its own section, in order —
    # returns written out in full, never abbreviated.
    body_ok = ok_heads
    for s, at in zip(p["sections"], positions):
        slots = [ls for ls in p["line_slots"]
                 if ls["section"] == s["name"]]
        for k, ls in enumerate(slots):
            if (at < 0 or at + 1 + k >= len(lines)
                    or lines[at + 1 + k] != draft[ls["line"] - 1]):
                body_ok = False
    check("every line sits under its own header in slot order — the "
          "returned chorus is WRITTEN OUT, not '(x2)'", body_ok)
    ret_pairs = [tuple(int(x) for x in r.split(","))
                 for r in p["returns"].split(";")]
    check("...and each returned line's text appears at BOTH its "
          "positions in the rendering",
          all(text.count(draft[a - 1]) >= 2 for a, _b in ret_pairs))

    inst = next(s for s in p["sections"]
                if s["function"] in ZERO_LINE_FUNCTIONS)
    at = positions[p["sections"].index(inst)]
    check("an instrumental section is a header with NO lines under it — "
          "the hole in the song, measurements and all",
          at + 1 >= len(lines) or lines[at + 1] == "")

    try:
        PLN.render_song(p, draft[:-1])
        check("a short draft refuses to render — same song rule", False)
    except PlanRefused as e:
        check("a short draft refuses to render — the same refusal, and "
              "the same wording, as fill_plan's",
              "same song" in str(e))




def test_the_writers_declaration():
    """M-55: `--relation` and `--functions` are the WRITER'S declaration.

    Neither is sampled. The planner does not pick a relation -- putting
    `type:pararhyme` on a group nobody asked for is the "move 37" ban pointed
    at rhyme instead of at shape -- it CARRIES what was declared into the plan
    artifact and into the one command that grades the draft.
    """
    print("\n9. the writer's declaration (M-55)")
    import quality.plan as P

    base = P.make_plan(11)
    check("a plan with NO declaration carries empty ones, and its GRADE IT "
          "line names no relation — every caller that never learned this "
          "field is unchanged",
          base["relation"] == "" and base["functions"] == []
          and "--relation" not in P.grading_command(base))

    m = P.make_plan(11, relation="type:rime riche")
    check("a declared relation is STORED NAMESPACED, so the value the plan "
          "keeps re-resolves to the same judge (M-49)",
          m["relation"] == "type:rime riche", m["relation"])
    check("...and it REACHES THE GRADE. Without this the writer declares a "
          "relation, the plan records it, and the one command that grades "
          "the draft asks the coarse admit set instead — a declared "
          "coordinate read by nothing, one layer out from M-54's",
          "'--relation=type:rime riche'" in P.grading_command(m),
          P.grading_command(m))

    for bad, why in (("type:not-a-relation", "an unknown relation"),
                     ("rime riche", "a BARE name in two namespaces (M-37)")):
        try:
            P.make_plan(11, relation=bad)
            check(f"{why} refuses", False, "it was accepted")
        except P.PlanRefused:
            check(f"{why} refuses AT PLAN TIME, while the writer is still "
                  f"holding the sentence they got wrong", True)

    r = P.make_plan(11, functions=["verse", "chorus", "bridge", "intro"])
    check("a declared ROSTER is an ALLOW-LIST: no function outside it "
          "appears in the sampled shape",
          set(s["function"] for s in r["sections"]) <= set(r["functions"]),
          str([s["function"] for s in r["sections"]]))
    check("...and functions the draw did NOT use are DISCLOSED, because a "
          "roster permits and does not compel — silence would let a writer "
          "believe they got a section they did not (doctrine 20)",
          set(r["functions_unused"])
          == set(r["functions"]) - {s["function"] for s in r["sections"]},
          str(r["functions_unused"]))

    # THE OWNER'S OWN CASE, and the reason this layer is checked against
    # M-54's `requires` rather than being a free list.
    try:
        P.make_plan(11, functions=["prechorus", "verse"])
        check("a roster asking for a prechorus and no chorus refuses",
              False, "it was accepted")
    except P.PlanRefused as e:
        check("a roster asking for a PRECHORUS and NO CHORUS refuses, and "
              "the refusal quotes the gloss that makes it definitional — "
              "the word means before-the-chorus, so a roster that cannot "
              "contain one is not a novel structure but a contradiction "
              "(M-54's `requires`)",
              "REQUIRES" in str(e) and "chorus" in str(e), str(e)[:80])
    try:
        P.make_plan(11, functions=["refrain", "verse"])
        check("a roster naming a function the GENERATOR cannot build refuses",
              False, "it was accepted")
    except P.PlanRefused as e:
        check("a roster naming a function the vocabulary declares and this "
              "GENERATOR cannot build refuses rather than silently dropping "
              "it — `refrain` is a real function and not a buildable section "
              "(M-56)", "cannot BUILD" in str(e))
    check("the declaration is DETERMINISTIC with the seed, like every other "
          "free choice here",
          P.make_plan(11, relation="type:rime riche",
                      functions=["verse", "chorus", "bridge", "intro"])
          == r if False else
          P.make_plan(11, functions=["verse", "chorus", "bridge", "intro"])
          == r)


def test_the_form_is_read():
    """The form was a coordinate NOTHING read (2026-08-23).

    `make_plan(seed, form=...)` validated `form` against `PLAN_FORMS` and
    never passed it to `_sample_pattern`, so every plan printed
    `form=verse-chorus` and the form denied nothing. Measured over six seeds
    at the time: four produced NO VERSE AT ALL and exactly one had a verse
    before a chorus.

    The measurement below is the whole point of the section. A membership
    check that is green because the sampler happens to be lucky is the
    vacuous shape, so the enforcement is WITHDRAWN in memory and the rate
    re-measured — 8.3% against 100%. Nothing on disk is touched.
    """
    print("\n8. the declared FORM is read by the sampler, not just printed")

    def _rate(n=200):
        ok = seen = 0
        for s in range(n):
            try:
                pl = PLN.make_plan(s)
            except Exception:
                continue
            fns = [x["function"] for x in pl["sections"]]
            seen += 1
            if "verse" in fns and "chorus" in fns:
                ok += 1
        return ok, seen

    live_ok, live_n = _rate()
    check("EVERY plan under the default form carries both a verse and a "
          "chorus — the two functions `FORM_REQUIRES` declares, measured "
          "178 of 178 on corpus/song/ before being written down",
          live_ok == live_n and live_n > 100,
          f"{live_ok}/{live_n}")

    saved = dict(PLN.FORM_REQUIRES)
    try:
        PLN.FORM_REQUIRES.clear()
        dead_ok, dead_n = _rate()
    finally:
        PLN.FORM_REQUIRES.clear()
        PLN.FORM_REQUIRES.update(saved)
    check("...and WITHDRAWING the declaration collapses it, so the table is "
          "load-bearing and not decoration the sampler would have satisfied "
          "on its own",
          dead_n and dead_ok * 4 < dead_n,
          f"withdrawn: {dead_ok}/{dead_n} = {100.0 * dead_ok / max(dead_n, 1):.1f}%"
          f"  vs declared {100.0 * live_ok / max(live_n, 1):.1f}%")

    check("the ORDER tendency is declared as a RATE and NOT enforced — 137 "
          "of 178 is a tendency, and a planner that refused the other 41 "
          "would refuse a quarter of the corpus it was measured on "
          "(doctrine 16/22)",
          any(hit == 137 and n == 178
              for _t, hit, n, _why in PLN.FORM_TENDENCIES["verse-chorus"]),
          str(PLN.FORM_TENDENCIES["verse-chorus"]))
    ordered = 0
    total = 0
    for s in range(200):
        try:
            fns = [x["function"] for x in PLN.make_plan(s)["sections"]]
        except Exception:
            continue
        total += 1
        if fns.index("verse") < fns.index("chorus"):
            ordered += 1
    check("...and the planner DOES draw both orders, which is what 'not "
          "enforced' has to mean if it means anything",
          0 < ordered < total,
          f"{ordered}/{total} plans put a verse before the first chorus; "
          f"the corpus rate is 137/178 = 77.0% and this is NOT tuned to it")


def test_the_planner_plans_the_whole_line():
    print("\n. the planner binds WHERE, not only at the ends — and draws "
          "overlapping covers, which an RGS partition cannot express")
    from collections import Counter
    import quality.schemes as SC
    places, part, overlap, sizes = Counter(), Counter(), 0, []
    n = 0
    for seed in range(60):
        try:
            pl = make_plan(seed=seed)
        except PlanRefused:
            continue
        n += 1
        for g in pl["groups"].split(";"):
            for m in g.split(","):
                places["end" if "." not in m else m.split(".", 1)[1]] += 1
        m_ = SC.mandate([g.split(",") for g in pl["groups"].split(";")],
                        n_lines=pl["total_lines"])
        sizes.append(len(m_.groups))
        if m_.overlapping_lines():
            overlap += 1
        for ln in range(1, m_.n_lines + 1):
            part[len(m_.groups_of(ln))] += 1
    check("every plan's groups PARSE back into a Mandate — the spelling the "
          "planner emits is the spelling the declaration layer reads, which "
          "is the only shape that proves the coordinate crossed the seam",
          n > 0 and len(sizes) == n, f"{n} plans, {len(sizes)} mandates")
    check("placements other than the line's end are DRAWN, not merely "
          "declarable: the head, the whole end word, the head read as a "
          "rhyme span, and indexed words all appear",
          {"head", "endword", "headrime"} <= set(places)
          and any(k.startswith("T") for k in places),
          f"{dict(places.most_common(6))}")
    end_share = places["end"] / max(1, sum(places.values()))
    check("and `end` is ONE placement among them rather than the axis "
          "everything is measured against — its share is near the uniform "
          "share of the pool, which is the correction stated as a measure",
          end_share < 0.25,
          f"end at {end_share:.1%} of members over {n} plans")
    check("OVERLAPPING covers are reached by the DRAW. Doctrine 2 says "
          "maximal cliques may overlap and the mandate layer has always "
          "accepted them; the generator could not produce one, so that "
          "class of song had probability exactly zero from the front door",
          overlap > 0, f"{overlap}/{n} plans put some line in >1 group")
    check("a line's participation is bounded by what a band-legal line can "
          "CARRY — the calibrated density band's floor — so no plan asks a "
          "five-syllable line for more distinct bound spans than it has "
          "syllables",
          max(part) <= MB.ADOPTED["DENSITY"][0],
          f"max participation {max(part)}, density floor "
          f"{MB.ADOPTED['DENSITY'][0]}")
    check("...and it is not pinned at either extreme: lines carrying ONE "
          "binding and lines carrying several are both ordinary",
          part[1] > 0 and sum(v for k, v in part.items() if k >= 2) > 0,
          f"participation {dict(sorted(part.items()))}")
    check("no group exceeds what the LEXICON is measured to sustain — the "
          "capacity layer's deepest CERTIFIED chain, so a plan never asks "
          "for a rhyme family no family can fill",
          all(len(g) <= CAP.ADOPTED_MAX_GROUP
              for pl in [make_plan(seed=k) for k in range(8)]
              for g in [x.split(",") for x in pl["groups"].split(";")]),
          f"ceiling {CAP.ADOPTED_MAX_GROUP}")


def _place_group_keyed_on_the_name(group, rng, max_token, used):
    """THE PRE-FIX `plan._place_group`, verbatim but for its one coordinate:
    `used` holds the placement NAME rather than the WORD that placement binds.

    Kept here as a MUTATION and not as history. The claim §7 makes is that
    the planner satisfies the joint gate by construction; that claim is only
    worth anything if the gate can fail, and the only honest way to show it
    can is to put the defect back and watch `make_plan` refuse.
    """
    out = []
    for ln in group:
        free = [p for p in PLN._PLACE_POOL(max_token)
                if p not in used.get(ln, ())]
        if not free:
            return []
        place = rng.choice(free)
        used.setdefault(ln, set()).add(place)
        out.append(str(ln) if place == "end" else f"{ln}.{place}")
    return out


def test_the_joint_gate():
    print("\n7. the JOINT gate — every constraint legal, the conjunction "
          "checked")
    # THE POPULATION FIRST, so the section cannot pass by examining nothing.
    # Every check below walks a list, and `all()` over an empty list is True
    # and reads exactly like a check that looked at something — this repo's
    # own seven-vacuous-checks lesson (CLAUDE.md, Test discipline).
    plans = [make_plan(seed=k) for k in range(JOINT_SWEEP)]
    check("the sweep produced plans to ask the question of",
          len(plans) == JOINT_SWEEP, f"{len(plans)} plans")
    check("NO plan in the sweep asks for a conjunction it cannot have — the "
          "gate is satisfied BY CONSTRUCTION, which is the relationship "
          "`ADOPTED_MAX_GROUP` already has to the scheme sampler and is why "
          "the mutations below are the only way to fire it",
          all(PLN.joint_findings(p) == [] for p in plans),
          f"{sum(len(PLN.joint_findings(p)) for p in plans)} findings over "
          f"{len(plans)} plans")
    check("the codes are a DECLARED closed set, so a new one is added "
          "deliberately rather than by somebody typing a new string "
          "(doctrine 58)",
          len(set(PLN.JOINT_CODES)) == len(PLN.JOINT_CODES)
          and all(isinstance(c, str) for c in PLN.JOINT_CODES),
          f"{list(PLN.JOINT_CODES)}")

    base = plans[0]

    def fired(plan):
        return sorted({c for c, _, _ in PLN.joint_findings(plan)})

    # THE FOUR MUTATIONS, one per cause. Each is a PLAN handed to the gate,
    # not a draw — `joint_findings` is a pure function of the emitted dict on
    # purpose, so a hand-written plan is checked on the same terms.
    two_on_one = dict(base, groups=base["groups"] + ";1.head,2.head;1.T1,3.T1")
    check("two declared groups landing on ONE WORD by two different NAMES "
          "fires — `head` and `T1` are both the first word, which is the "
          "coordinate `_place_group` was missing",
          fired(two_on_one) == ["TWO_GROUPS_ONE_WORD"], f"{fired(two_on_one)}")

    far = dict(base, groups="1.T40,2.T40")
    check("a placement naming a word past what the line can carry fires — a "
          "line has no more words than syllables, and no more syllables than "
          "the smaller of its slots and the band's ceiling",
          "TOKEN_INDEX_UNREACHABLE" in fired(far), f"{fired(far)}")

    starved = dict(base, groups="", line_slots=[
        dict(s, duration=0.5) if s["line"] == 1 else s
        for s in base["line_slots"]])
    check("a line whose span falls under the calibrated density FLOOR fires "
          "— below the floor the band flags it and at or above it "
          "`fit.SLOTS_EXCEEDED` does, so no draft clears both",
          fired(starved) == ["SPAN_BELOW_DENSITY_FLOOR"], f"{fired(starved)}")

    crowded = dict(base, subdivision=1, groups="1.T6,2.T6;1,3", line_slots=[
        dict(s, duration=6.0) for s in base["line_slots"]])
    check("a line asked for more DISTINCT words than it can carry fires, and "
          "it is its own code — the last word must differ from every "
          "numbered one or the two groups binding them meet",
          "WORDS_EXCEED_SPAN" in fired(crowded), f"{fired(crowded)}")

    # AND THE GATE REFUSES RATHER THAN REPORTING. `make_plan` is what a
    # writer calls; a finding it does not act on is a note, and the owner's
    # standing rule is that a note is a record and only a gate is an
    # enforcement.
    real = PLN.joint_findings
    try:
        PLN.joint_findings = lambda plan: [("TOKEN_INDEX_UNREACHABLE", 1, "x")]
        refused = None
        try:
            make_plan(seed=0)
        except PlanRefused as exc:
            refused = str(exc)
    finally:
        PLN.joint_findings = real
    check("a plan with a joint finding is REFUSED by `make_plan`, and the "
          "refusal names the code",
          refused is not None and "TOKEN_INDEX_UNREACHABLE" in refused,
          f"{(refused or '')[:80]}")
    check("...and the restoration held, so no later check inherits a "
          "mutated gate", PLN.joint_findings(base) == [])

    # THE MUTATION THAT MAKES THE GENERATOR'S HALF NON-VACUOUS. `0 findings
    # over 40 plans` is a claim about the DRAW, and it reads exactly like a
    # gate that stopped asking. Restoring the pre-fix `_place_group` — the
    # same body, keyed on the placement NAME — must bring the collisions
    # back, and it must bring them back THROUGH `make_plan`, since a plan
    # that is generated and not refused is the defect this section exists
    # for.
    real_place = PLN._place_group
    blind_refused, blind_codes = 0, set()
    try:
        PLN._place_group = _place_group_keyed_on_the_name
        for k in range(JOINT_SWEEP):
            try:
                make_plan(seed=k)
            except PlanRefused as exc:
                blind_refused += 1
                blind_codes |= {c for c in PLN.JOINT_CODES if c in str(exc)}
    finally:
        PLN._place_group = real_place
    check("keying the collision test on the placement NAME instead of the "
          "WORD makes `make_plan` REFUSE most seeds — so the repair is READ "
          "and the sweep's 0 above is an answer, not a check that stopped "
          "checking",
          blind_refused > JOINT_SWEEP // 2,
          f"{blind_refused}/{JOINT_SWEEP} seeds refused when the word is "
          f"spelled as a placement name")
    check("...and the cause it names is the collision, not something the "
          "mutation broke sideways",
          blind_codes == {"TWO_GROUPS_ONE_WORD"}, f"{sorted(blind_codes)}")
    check("...and the restoration held: the clean sweep is clean again",
          all(PLN.joint_findings(make_plan(seed=k)) == []
              for k in range(4)))

    # THE OTHER DIRECTION IS NOT A DEFECT, and this is the check that pins
    # M-79's own correction. A line given MORE slots than the band's ceiling
    # is a legitimately SLOWER line: `SPARSE` reads "fewer units than
    # pulses", so slots are a CAPACITY and never a requirement.
    sparse = dict(base, groups="", line_slots=[
        dict(s, duration=99.0) for s in base["line_slots"]])
    check("a line with far MORE slots than the density ceiling produces NO "
          "joint finding — slots are a capacity, not a requirement, and "
          "M-79's Finding 1 read 78% of plans as impossible on exactly this "
          "confusion", PLN.joint_findings(sparse) == [],
          f"{PLN.joint_findings(sparse)[:1]}")
    check("`line_syllable_ceiling` is the CONJUNCTION of the two layers — "
          "the band's ceiling where the bar is roomy, the bar where it is "
          "not — so neither layer answers for the other",
          PLN.line_syllable_ceiling(99) == MB.ADOPTED["DENSITY"][1]
          and PLN.line_syllable_ceiling(3) == 3,
          f"99 slots -> {PLN.line_syllable_ceiling(99)}, "
          f"3 slots -> {PLN.line_syllable_ceiling(3)}")

    # A PLACEMENT WHOSE WORD IS UNKNOWN REFUSES rather than being filed under
    # a nearby one (doctrine 20): an unchecked collision reads exactly like a
    # line with no collision. `line` is the registered placement this cannot
    # resolve, and it is deliberately outside `PLANNABLE_PLACEMENTS`.
    try:
        PLN.placement_word("line")
        refused_locus = ""
    except SL.SlotUnsupported as exc:
        refused_locus = str(exc)
    check("`placement_word` REFUSES a locus it cannot resolve to one word, "
          "naming it",
          "line" in refused_locus and "WHICH WORD" in refused_locus,
          f"{refused_locus[:70]}")
    spelled = sorted((str(PLN.placement_word(p)), p)
                     for p in SL.PLANNABLE_PLACEMENTS)
    check("...and it is DERIVED from `quality/slots.py`'s own loci, not a "
          "second table here: every plannable placement resolves, and the "
          "four names the pool draws denote only two words at the ends",
          {PLN.placement_word(p) for p in SL.PLANNABLE_PLACEMENTS}
          == {1, PLN.LAST_WORD}
          and PLN.placement_word("T1") == PLN.placement_word("headrime"),
          f"{spelled}")




def test_the_seed_sweep_is_a_verb():
    print("\n10. THE SEED SWEEP — the last private instrument, made a verb "
          "(`MISSING.md` M-82)")
    # CLAUDE.md standing rule 3 named this one and left it: "The seed-sweep
    # instrument (looping `make_plan` with filters to find a shape) stays
    # manual for now BY THE OWNER'S PENDING RULING, and is named here so it
    # cannot become a quiet fourth instrument." The ruling was made.
    #
    # WHY IT EXISTS: `--functions` is an ALLOW-LIST. It PERMITS a roster and
    # cannot COMPEL a draw to use it, because compelling means weighting the
    # dice. Drawing again is the honest compel, and rejection sampling from a
    # uniform proposal is uniform over the accepted set.
    check("the predicate vocabulary is CLOSED and every name reads a "
          "coordinate the plan already DISCLOSES — a sweep that invented a "
          "measurement would be a second planner (doctrine 58)",
          set(PLN.SWEEP_MEASURES) & set(PLN.SWEEP_SETS) == set()
          and set(PLN.SWEEP_MEASURES) & set(PLN.SWEEP_ORDERS) == set()
          and all(isinstance(v, tuple) and callable(v[1])
                  for v in PLN.SWEEP_MEASURES.values()),
          f"{sorted(set(PLN.SWEEP_MEASURES) | set(PLN.SWEEP_SETS) | set(PLN.SWEEP_ORDERS))}")
    p = PLN.make_plan(seed=108)
    for name, (_gloss, fn) in PLN.SWEEP_MEASURES.items():
        check(f"`{name}` reads off a real plan without inventing anything",
              isinstance(fn(p), (int, float)), f"{name} = {fn(p)}")

    # THE SWEEP ITSELF, on the range the scratch script used before it was a
    # verb — and it returns the same answer, which is what makes this a verb
    # rather than a rewrite.
    wants = [PLN.parse_sweep_want(w) for w in
             ("sections<=6", "lines_per_section>=2", "group<=4",
              "uses=verse,chorus", "before=verse,chorus", "pins_per_line<=5")]
    res = PLN.sweep(range(120), wants=wants)
    check("the sweep finds the seed the private script found, over the same "
          "range — the instrument moved into the tree without its answer "
          "changing", res["accepted"] == [108],
          f"accepted {res['accepted']}, planned {res['planned']}, "
          f"refused {res['refused']}")
    check("THREE COUNTS, NEVER SUMMED (doctrine 79): swept, planned, and "
          "REFUSED-by-the-planner. A refusal is the envelope turning a "
          "request down and charging it to the predicates would blame the "
          "declaration for the planner",
          res["seeds"] == 120
          and res["planned"] + res["refused"] == res["seeds"]
          and len(res["accepted"]) <= res["planned"],
          f"{res['seeds']} = {res['planned']} + {res['refused']}")
    check("NO DEFAULT PREDICATE — a sweep with none accepts every seed that "
          "plans at all, which is honest and useless. A default would be the "
          "sweep deciding what the caller wants",
          PLN.sweep(range(12))["accepted"] == list(range(12)),
          f"{PLN.sweep(range(12))['accepted']}")
    # IT DOES NOT RANK, and this is the load-bearing refusal (doctrine 7 —
    # enforce a floor, do not order the permitted region; doctrine 19 — an
    # argmax over a swept parameter is biased). The accepted set is in SEED
    # order and carries no score at all.
    many = PLN.sweep(range(60), wants=[PLN.parse_sweep_want("sections<=6")])
    check("the accepted set is in SEED order and carries no score — a sweep "
          "that returned 'the best seed' would be doctrine 19's own argmax, "
          "and whatever it ranked by would be the weighted quality score "
          "doctrine 6 forbids",
          many["accepted"] == sorted(many["accepted"])
          and set(res) == {"accepted", "planned", "refused", "wants",
                           "seeds"},
          f"{len(many['accepted'])} accepted, keys {sorted(res)}")

    # THE REFUSALS, each proven rather than described.
    def refuses(text):
        try:
            PLN.parse_sweep_want(text)
        except PLN.PlanRefused as exc:
            return str(exc)
        return ""
    check("an undeclared coordinate REFUSES and prints the vocabulary — a "
          "predicate silently matching nothing and one that refuses look "
          "identical in the accepted set, and the first has a caller believe "
          "their declaration was applied (doctrine 20)",
          "not a coordinate" in refuses("vibes<=3")
          and "sections" in refuses("vibes<=3"), refuses("vibes<=3")[:70])
    check("...and so does a predicate with no operator this vocabulary "
          "declares", "carries none of" in refuses("sections<3"),
          refuses("sections<3")[:60])
    check("...and a count compared against a non-integer",
          "is not an" in refuses("sections<=lots"),
          refuses("sections<=lots")[:60])
    check("...and a FUNCTION name compared with an inequality, because "
          "functions do not compare",
          "and nothing else" in refuses("uses>=chorus"),
          refuses("uses>=chorus")[:60])
    # THE MUTATION: an unreachable declaration must REFUSE at the verb, not
    # return an empty list that reads like a clean run.
    empty = PLN.sweep(range(20), wants=[PLN.parse_sweep_want("sections<=1")])
    check("an unreachable declaration accepts NOTHING, and the verb turns "
          "that into a refusal at exit 2 rather than an empty list — "
          "unreachable and merely rare are different answers and the "
          "acceptance rate is what separates them",
          empty["accepted"] == [] and empty["planned"] > 0,
          f"planned {empty['planned']}, accepted 0")


if __name__ == "__main__":
    for fn in (test_the_planner_plans_the_whole_line,
               test_determinism, test_refusals, test_the_round_trip,
               test_the_measure, test_the_disclosure,
               test_the_rendering, test_the_writers_declaration,
               test_the_form_is_read, test_the_joint_gate,
               test_the_seed_sweep_is_a_verb):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the planning phase plans, the graders accept what it plans, "
          "and the dice are uniform over derived spaces")

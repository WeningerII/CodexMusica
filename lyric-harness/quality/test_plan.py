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
            gs = [[int(x) for x in g.split(",")]
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

    # The meter dims are tight arithmetic on the envelope.
    lo, hi = ENVELOPE["slots_per_line"]
    dims = meter_dims()
    tight = all(lo <= bars * sub * b_lo <= hi and lo <= bars * sub * b_hi
                <= hi and bars * sub * (b_hi + 1) > hi
                and (b_lo == 2 or bars * sub * (b_lo - 1) < lo)
                for (bars, sub), (b_lo, b_hi) in dims.items())
    check("every dimension pair's beat range is TIGHT against the slots "
          "envelope — both endpoints legal, one step past either is not",
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
    # through the first draft of this file). Under the derivation measure
    # the (bars=1, sub=1) pair's beat counts are uniform on [5, 48], mean
    # 26.5; under a leaf measure their mass sits at the top of the range,
    # mean 45+. Deterministic — one seeded rng.
    rng = random.Random(20260818)
    draws = [PLN._sample_meter(rng) for _ in range(24000)]
    pair_n = Counter((d[0], d[1]) for d in draws)
    check("the dimension pairs are drawn uniformly — all 12 pairs, each "
          "within 15% of its expected share",
          len(pair_n) == len(dims)
          and all(abs(v - 2000) <= 300 for v in pair_n.values()),
          f"min {min(pair_n.values())}, max {max(pair_n.values())}")
    wide = [d[2] for d in draws if (d[0], d[1]) == (1, 1)]
    check("within the widest pair the beat count is UNIFORM on its range "
          "— observed mean within 1.5 of the range's own midpoint (a leaf "
          "measure pushes it 18+ beats high)",
          abs(sum(wide) / len(wide)
              - (dims[(1, 1)][0] + dims[(1, 1)][1]) / 2) <= 1.5,
          f"mean {sum(wide) / len(wide):.2f} over {len(wide)} draws, "
          f"midpoint {(dims[(1, 1)][0] + dims[(1, 1)][1]) / 2}")

    # The envelope floor is DERIVED, not copied (the calibration chain).
    from quality import meter_bands as MB
    check("the slots floor IS the calibrated density band's floor and the "
          "ceiling IS band ceiling x SLOTS_CEILING_X — detach either and "
          "this fails (doctrine 91)",
          lo == MB.ADOPTED["DENSITY"][0]
          and hi == MB.ADOPTED["DENSITY"][1] * PLN.SLOTS_CEILING_X)

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
    check("the meter marginal is freed from the LEAF measure — median "
          "beat count <= 8 and under 10% of plans at >= 40 beats (the "
          "leaf measure put nearly ALL of them there: compositions into "
          "{2,3} grow ~1.3247^n)",
          bs[100] <= 8 and sum(b >= 40 for b in bs) / 200 < 0.10,
          f"median {bs[100]}, frac>=40 {sum(b >= 40 for b in bs) / 200}")
    check("the 4/4 bias is dead: 20+ distinct meters over 200 seeds, both "
          "notation units, and 4/4 under 30% of plans",
          len(meters) >= 20 and units == {4, 8}
          and sum(1 for b in beats if b == 4) / 200 < 0.30,
          f"{len(meters)} meters, units {sorted(units)}")
    k_total = sum(ks.values())
    check("the 4-line bias is dead: every k in the envelope's section "
          "range is drawn, and k=4 takes under 20% of sections "
          "(uniform expects ~6%)",
          set(ks) == set(range(ENVELOPE["lines_per_section"][0],
                               ENVELOPE["lines_per_section"][1] + 1))
          and ks[4] / k_total < 0.20,
          f"ks {sorted(ks)}, k=4 at {ks[4] / k_total:.3f}")
    check("the whole GENERATOR_ROSTER is reached — 14 functions, not "
          "v1's five",
          funcs == set(GENERATOR_ROSTER) and len(GENERATOR_ROSTER) == 14,
          f"reached {len(funcs)}")
    check("totals cover the envelope's order, not one shape: 40+ distinct "
          "values, reaching under 8 and over 60 lines",
          len(totals) >= 40 and min(totals) <= 8 and max(totals) >= 60,
          f"{len(totals)} distinct in [{min(totals)}, {max(totals)}]")

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
    check("plan.py imports exactly {schemes, meter_bands, structures} from "
          "quality and opens NO file — the corpus cannot reach the dice "
          "(the owner's move-37 rule)",
          subs == {"schemes", "meter_bands", "structures"} and opens == 0,
          f"imports {sorted(subs)}, open() calls {opens}")


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
          ok and seen_with and seen_without)

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
                pickup = {0.0: "", 0.5: ", half-beat pickup",
                          1.0: ", one-beat pickup"}[slots[0]["beat"] - 1]
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


if __name__ == "__main__":
    for fn in (test_determinism, test_refusals, test_the_round_trip,
               test_the_measure, test_the_disclosure):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the planning phase plans, the graders accept what it plans, "
          "and the dice are uniform over derived spaces")

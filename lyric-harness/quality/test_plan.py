#!/usr/bin/env python3
"""Regressions for the planning phase (quality/plan.py).

THE ONE CLAIM THAT MATTERS is the round trip: a plan is only a plan if the
machine that grades against it ACCEPTS its artifacts — the blueprint reads,
the mandate parses at the plan's own line count, every mandated pair is
judged, and the verbatim returns hold when the choruses mirror. Everything
else here (determinism, refusals, expressiveness) protects that claim from
drifting.

Sections:
  1  determinism — same request byte-identical, different seed differs
  2  refusals — no seed, blocked form by NAME, unattainable length with
     every attainable total named
  3  THE ROUND TRIP — plan -> fill -> the real Reviser grades it end to end
  4  expressiveness — the grammar expresses a real song's shape (Open Sign,
     22 lines), a COVERAGE claim about the plan language, not a lookup
  5  the disclosure — every free choice echoed beside its choice set

Run: python3 quality/test_plan.py
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.plan import (BLOCKED_FORMS, PLAN_FORMS,  # noqa: E402
                          PlanRefused, attainable_totals, fill_plan,
                          grading_command, make_plan)

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_determinism():
    print("\n1. a plan is a function of its request — seeded, reproducible")
    a = json.dumps(make_plan(seed=7, lines=22), sort_keys=True)
    b = json.dumps(make_plan(seed=7, lines=22), sort_keys=True)
    check("the same request is byte-identical twice (doctrine 66)", a == b)
    # THE ECHO IS STRIPPED BEFORE COMPARING — caught by mutation M1 on the
    # day this file was written: the plan discloses `request.seed`, so two
    # plans differ at that key even when the seed is never READ, and the
    # naive `a != c` passes against a planner whose rng is a constant. The
    # claim is about the CHOICES, so only the choices are compared, over a
    # sweep wide enough that a constant rng cannot hide in one lucky pair.
    def _choices(seed):
        p = make_plan(seed=seed, lines=22)
        return json.dumps(p["choices"], sort_keys=True)
    bodies = {_choices(k) for k in range(10)}
    check("across ten seeds the CHOICES differ — the seed is READ, and the "
          "echoed request cannot stand in for read behaviour",
          len(bodies) >= 2, f"{len(bodies)} distinct choice-set(s)")


def test_refusals():
    print("\n2. refusals, not defaults (doctrine 20)")
    for kwargs, phrase, why in (
            (dict(seed=None), "requires --seed", "a free choice without a "
             "declared seed is a hidden coordinate"),
            (dict(seed=1, form="ghazal"), "BLOCKED", "declared-but-blocked "
             "is a different answer from unknown (doctrine 28)"),
            (dict(seed=1, form="madrigal"), "not a declared form",
             "unknown is refused by name with the declared set listed"),
            (dict(seed=1, lines=23), "Attainable totals", "an impossible "
             "length names every possible one")):
        try:
            make_plan(**kwargs)
            check(f"refuses {kwargs}", False, "no refusal was raised")
        except PlanRefused as e:
            check(f"refuses {kwargs} — {why}", phrase in str(e),
                  str(e)[:90])
    # The refusal's totals come from the TABLES, not from a copy of them.
    totals = attainable_totals()
    try:
        make_plan(seed=1, lines=max(totals) + 1)
    except PlanRefused as e:
        check("...and the named totals are DERIVED from the grammar tables, "
              "so the message cannot drift from them (doctrine 91)",
              all(str(t) in str(e) for t in totals), sorted(totals))
    check("ghazal's block names the missing FLAG, so the refusal is a work "
          "order and not a shrug",
          "repeat_licence" in BLOCKED_FORMS["ghazal"])


#: 22 real lines to fill a 22-line plan with — Open Sign's shape. The WORDS
#: only have to be readable; the round trip asserts machinery outcomes
#: (parses, judged counts, verbatim returns), never quality verdicts.
FILL = ["the hardware store still stencils sales on paper in the glass",
        "i park where we would idle when the shift let out at nine",
        "the paper's sun-bleached yellow like the season's going to last",
        "still counting lit-up letters while the whole block's in decline",
        "somebody leave the open sign on",
        "burn it through the winter till the dark is done",
        "i'm not shopping for a thing at all",
        "one lit-up window burning in the squall",
        "they auctioned off the fixtures and the pegboard full of keys",
        "a man i didn't recognize was pulling down the grate",
        "i watched it through the doorway with my breath against the freeze",
        "he nodded like he knew me and said the truck ran late",
        "somebody leave the open sign on",
        "burn it through the winter till the dark is done",
        "i'm not shopping for a thing at all",
        "one lit-up window burning in the squall",
        "they'll raise a fund to save the chapel or the hospital",
        "nobody holds a vigil for the fluorescents and the people",
        "somebody leave the open sign on",
        "burn it through the winter till the dark is done",
        "i'm not shopping for a thing at all",
        "one lit-up window burning in the squall"]


def test_the_round_trip():
    """THE CROWN. The plan's artifacts survive the machine that grades
    against them — not by this file's reading of the formats, but by the
    real readers refusing nothing."""
    print("\n3. THE ROUND TRIP — the graders accept what the planner emits")
    import quality.fit as FT
    import quality.schemes as SC
    from quality.grid import song_from_blueprint
    from quality.revise import Reviser

    plan = make_plan(seed=7, lines=22)
    bp = fill_plan(plan, FILL)

    song, hooks = song_from_blueprint(bp)[:2]
    check("the blueprint READS — sections, meters and line placement all "
          "pass quality/grid.py's own refusal gauntlet",
          len(song.sections) == 6 and len(song.lines) == 22,
          f"{len(song.sections)} section(s), {len(song.lines)} line(s)")

    gs = [[int(x) for x in g.split(",")] for g in plan["groups"].split(";")]
    rets = [[int(x) for x in r.split(",")]
            for r in plan["returns"].split(";")]
    m = SC.mandate(gs, n_lines=plan["total_lines"], returns=rets)
    check("the mandate PARSES at the plan's own line count, groups and "
          "returns together", m.n_lines == 22)

    R = Reviser()
    found = R.inspect(list(FILL), m, blueprint=bp,
                      subdivision=FT.Subdivision(
                          plan["subdivision"], source="test_plan round trip"))
    g = found["grade"]
    check("every mandated pair is JUDGED — mandated == judged, refused 0 "
          "(three counts, never summed: doctrine 79)",
          g["pairs_mandated"] == g["pairs_judged"] > 0
          and g["pairs_refused"] == 0,
          f"mandated {g['pairs_mandated']}, judged {g['pairs_judged']}, "
          f"refused {g['pairs_refused']}")
    codes = {f.code for f in found["whole"]}
    for _ln, fs in found["per_line"].items():
        codes |= {f.code for f in fs}
    check("the mirrored choruses HOLD as verbatim returns — the plan's "
          "return spelling is the one the grader enforces",
          "RETURN_NOT_VERBATIM" not in codes
          and "RETURN_OUT_OF_RANGE" not in codes, sorted(codes)[:8])

    cmd = grading_command(plan)
    check("the emitted grading command carries BOTH mandate halves and the "
          "subdivision — nothing for an operator to remember",
          "--groups=" in cmd and "--returns=" in cmd
          and "--subdivision" in cmd, cmd[:100])

    # Count mismatch is refused, not zipped.
    try:
        fill_plan(plan, FILL[:-1])
        check("a short draft is refused, never truncated-to-fit", False)
    except PlanRefused as e:
        check("a short draft is refused, never truncated-to-fit",
              "same song" in str(e), str(e)[:80])


def test_expressiveness():
    print("\n4. the grammar EXPRESSES a real song's shape — coverage, not "
          "lookup")
    plan = make_plan(seed=7, lines=22)
    funcs = [s["function"] for s in plan["sections"]]
    check("22 lines resolves to Open Sign's own form — verse/chorus/verse/"
          "chorus/bridge/chorus",
          funcs == ["verse", "chorus", "verse", "chorus", "bridge",
                    "chorus"], funcs)
    check("...with every chorus after the first a verbatim return of the "
          "first, line for line",
          plan["returns"] == "5,13;6,14;7,15;8,16;5,19;6,20;7,21;8,22",
          plan["returns"])
    check("the grammar reaches five distinct totals, so the planner is a "
          "generator over a declared space and not one hardcoded shape",
          len(attainable_totals()) >= 5, sorted(attainable_totals()))


def test_the_disclosure():
    print("\n5. every free choice is echoed beside the set it was chosen "
          "from")
    plan = make_plan(seed=3)
    ch = plan["choices"]
    check("the pattern discloses its alternatives",
          ch["pattern"]["name"] in ch["pattern"]["chosen_from"]
          and len(ch["pattern"]["chosen_from"]) >= 2,
          ch["pattern"])
    check("the meter discloses its alternatives",
          ch["meter"]["value"] in ch["meter"]["chosen_from"]
          and len(ch["meter"]["chosen_from"]) >= 2)
    check("every scheme discloses the SIZE of the enumerated pool it was "
          "drawn from — a choice of one is a constant wearing a "
          "coordinate's name",
          all(v["chosen_from"] >= 1 for v in ch["schemes"].values()),
          ch["schemes"])
    check("the writer brief carries shape and rhyme plan and NEVER names "
          "the harness — the coverage experiment's blindness rule, kept",
          "lines" in plan["writer_brief"]
          and "rhyme" in plan["writer_brief"].lower()
          and "harness" not in plan["writer_brief"].lower()
          and "mandate" not in plan["writer_brief"].lower())


if __name__ == "__main__":
    for fn in (test_determinism, test_refusals, test_the_round_trip,
               test_expressiveness, test_the_disclosure):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the planning phase plans, and the graders accept what it plans")

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
import math
import os
import random
import sys
import tempfile
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
import lyric_harness as LH  # noqa: E402
from quality import capacity as CAP  # noqa: E402
from quality import meter_bands as MB  # noqa: E402
from quality import slots as SL  # noqa: E402
from quality import relations as RL  # noqa: E402
from quality import schemes as SC  # noqa: E402

#: HOW MANY SEEDS §7's population is. Declared rather than typed at each
#: call, because the blind-draw mutation below has to sweep the SAME set as
#: the clean draw or the two rates are not comparable.
JOINT_SWEEP = 40

#: HOW MANY SEEDS §11 renders and reads back. Declared for the same reason
#: `JOINT_SWEEP` is: the round-trip and the shape checks must walk the same
#: population, or "0 breaks" and "681 headers" describe different sweeps.
HEADER_SWEEP = 60
real_word = SL.placement_word

FAILURES = []


def _n_section_kind():
    """The vocabulary's own section-kind count — the roster's expected
    size, derived so a 23rd function moves this suite's SUBJECT and not
    a literal (the ~~14~~ ~~19~~ ladder is at the roster check)."""
    from quality import grid as _GR
    return sum(1 for sp in _GR.SECTION_FUNCTIONS.values()
               if sp.kind == "section")


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


#: THE ROUND TRIP'S SEEDS RUN IN PARALLEL, and the body lives here rather
#: than inside §3 so a worker process can reach it. MEASURED 2026-09-01:
#: `test_plan.py` is 838s over 16 sections and §3 alone is 649s (77.4%) —
#: twenty INDEPENDENT seeds, each planned and then graded, ~32s apiece,
#: strictly serial inside one process. The CI suite loop already runs four
#: suites at a time, but an outer packer cannot see into one process, so
#: this loop was invisible to every scheduling fix and is the floor the
#: `suites` shard stalls at (`MISSING.md` M-182).
#:
#: EACH WORKER BUILDS ITS OWN `Reviser` ONCE and reuses it across the seeds
#: it draws — measured at 3.9s to construct against ~32s per seed, so four
#: workers pay ~16s of startup against 649s of work.
#:
#: DETERMINISM IS UNTOUCHED. A plan is a pure function of its seed and each
#: iteration reads nothing the others write; the driver consumes results in
#: SEED ORDER, so `bad` is assembled exactly as the serial loop assembled
#: it and no verdict depends on which worker finished first (doctrine 66).
_RT_REVISER = None


def _round_trip_reviser():
    """-> this process's own `Reviser`, built once. A worker handles several
    seeds, and rebuilding the lexicon for each would cost more than the
    parallelism buys."""
    global _RT_REVISER
    if _RT_REVISER is None:
        from quality.revise import Reviser
        _RT_REVISER = Reviser()
    return _RT_REVISER


def _round_trip_one(seed):
    """-> (seed, bad, judged, refused) for ONE seed of §3's sweep.

    Returns plain data rather than raising, because a worker's exception
    would reach the driver stripped of which seed produced it — and the
    seed is the whole diagnostic."""
    import quality.fit as FT
    import quality.schemes as SC
    from quality.grid import song_from_blueprint
    R = _round_trip_reviser()
    bad = []
    judged_total = refused_total = 0
    plan = make_plan(seed=seed)
    draft = dummy_draft(plan)
    try:
        bp = fill_plan(plan, draft)
        # M-212: the hook is a SLOT and the blueprint carries it beside the
        # snapshot text, so the grader can re-read the hook from a revised
        # draft rather than hunt for the words the slot held at fill time.
        if (bp.get("hook_slot") or None) != (plan.get("hook_slot") or None):
            bad.append((seed, "blueprint hook_slot not carried (M-212)"))
        if bp.get("hook_slot") and bp["hooks"] != [draft[bp["hook_slot"] - 1]]:
            bad.append((seed, "blueprint hooks is not the slot's own line"))
        song, hooks = song_from_blueprint(bp)[:2]
        if (len(song.lines) != plan["total_lines"]
                or len(song.sections) != len(plan["sections"])):
            bad.append((seed, "blueprint shape mismatch"))
            # `continue` in the serial loop; this seed is DONE, and the
            # early return is the same skip one scope out.
            return seed, bad, judged_total, refused_total
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
        # THREE COUNTS, NEVER SUMMED — and the assertion is the
        # PARTITION plus a CAUSE, not `refused == 0`.
        # ~~`pairs_refused == 0`~~ STRUCK 2026-08-27: that spelling was
        # true only until M-144 stopped counting a declared slot that
        # resolves to NO ANCHOR as JUDGED. It resolves against the
        # DRAFT's words, and the draft here is `dummy_draft` — so a
        # refusal at a declared slot is a fact about this file's filler
        # vocabulary and NOT about the planner's shape, which is what
        # this section is for. Keeping `== 0` would have made the
        # round trip pin the very miscount M-144 repaired (doctrine 17).
        # WHAT STILL BITES, and it is stricter than a count: every
        # refusal must BE that kind. Any OTHER refusal — an unreadable
        # end word, a schema the judge cannot read — IS the planner
        # emitting something the graders cannot take, and that is
        # exactly the failure this section exists to catch.
        judged_total += g["pairs_judged"]
        refused_total += g["pairs_refused"]
        unexplained = [r for r in g["refusals"]
                       if not r.get("slot_refusal")]
        if not (g["pairs_mandated"] == g["pairs_judged"]
                + g["pairs_refused"] and g["pairs_judged"] > 0):
            bad.append((seed, f"counts m{g['pairs_mandated']} "
                              f"j{g['pairs_judged']} "
                              f"r{g['pairs_refused']}"))
        elif unexplained:
            bad.append((seed, "refusal(s) the DRAFT's words do not "
                              "explain: " + str(sorted(
                                  {r.get("reason", "?")[:44]
                                   for r in unexplained}))))
        elif codes & FORBIDDEN:
            bad.append((seed, sorted(codes & FORBIDDEN)))
        for s in plan["sections"]:
            n = sum(1 for ls in plan["line_slots"]
                    if ls["section"] == s["name"])
            if s["function"] in ZERO_LINE_FUNCTIONS and (
                    n != 0 or s["bars"] < 1):
                bad.append((seed, f"instrumental {s['name']} carries "
                                  f"{n} line(s), {s['bars']} bar(s)"))
    except RuntimeError as e:
        # THE SCHEMA DOOR'S PAIR GUARD (`MISSING.md` M-240, 2026-09-04): a
        # plan past ~140 lines — reachable since M-239 widened the envelope
        # to 12..447 — cannot be graded through the 77-schema default door,
        # which refuses at its declared pair guard. That is the grader's
        # own limit, recorded as its OWN count beside the three, never as a
        # planner shape the graders cannot take and never summed into them.
        if "candidate explosion" not in str(e):
            bad.append((seed, f"{type(e).__name__}: {e}"))
        else:
            return seed, bad, judged_total, refused_total, "walled"
    except Exception as e:  # noqa: BLE001 — any raise is the failure
        bad.append((seed, f"{type(e).__name__}: {e}"))
    return seed, bad, judged_total, refused_total, None


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
    judged_total = refused_total = 0
    # FOUR WORKERS, THE SAME WIDTH THE CI SUITE LOOP USES and for the same
    # stated reason (the runner has 4 vCPUs). `TEST_PLAN_WORKERS=1` runs the
    # sweep serially, byte-identical to the pre-parallel section, so the
    # coordinate is a SHAPE one and never a semantics one.
    _w = int(os.environ.get("TEST_PLAN_WORKERS", "0") or 0) or min(
        4, os.cpu_count() or 1)
    if _w > 1:
        import concurrent.futures as _cf
        with _cf.ProcessPoolExecutor(max_workers=_w) as _ex:
            _results = list(_ex.map(_round_trip_one, range(20)))
    else:
        _results = [_round_trip_one(_s) for _s in range(20)]
    # SEED ORDER, explicitly. `map` already preserves it; sorting says so, so
    # a later switch to `as_completed` cannot quietly reorder `bad`.
    walled = []
    for _seed, _b, _j, _r, _w in sorted(_results, key=lambda t: t[0]):
        bad.extend(_b)
        judged_total += _j
        refused_total += _r
        if _w:
            walled.append(_seed)
    check("20 seeds: blueprint READS, mandate PARSES, mandated == judged + "
          "REFUSED with judged > 0 (three counts, never summed: doctrine "
          "79), every refusal is a NO-ANCHOR slot on the dummy draft's own "
          "words rather than a shape the graders cannot take, and no "
          "verbatim/drift finding stands on a planner shape — a seed past "
          "the schema door's pair guard (M-240) is a FOURTH count, the "
          "grader's own wall, and at least one seed must have graded",
          not bad and judged_total > 0 and len(walled) < 20,
          f"bad: {bad or 'none'}; "
          f"judged {judged_total}, slot-refused {refused_total}, "
          f"walled at the schema door {len(walled)} seed(s) {walled}")

    # AND THE SECTION'S GRADING POWER HAS A FLOOR IT DERIVES FROM ITS OWN
    # FIXTURE, so `judged > 0` cannot decay to "one pair answered".
    # MEASURED: `dummy_draft`'s filler line anchors at 3 of its 7 token
    # positions — `we`, `the`, `to`, `the` are function words the phonology
    # will not anchor (doctrine 46's list doing its job), so `head` reads
    # `we` and refuses, and so does every `T<n>` landing on an article.
    # A pair needs BOTH its slots to anchor, so if placements were uniform
    # over token positions the judged share would be that fraction SQUARED.
    # It is a LOWER BOUND and deliberately loose: the planner also draws
    # `end`/`endword`, which do anchor, so the observed share sits well
    # above it. What it catches is the direction that matters — the GRADER
    # starting to refuse pairs it should judge — and it carries no literal,
    # because a filler that changes moves its own prediction with it.
    lex = R.lex
    filler = "we carry the morning to the " + BANK[0]
    ntok = len(filler.split())
    anchored = 0
    for t in range(1, ntok + 1):
        a, lab, _ = SL.resolve(lex, filler, SL.parse_slot(f"1.T{t}"))
        anchored += bool(a and lab)
    floor = (anchored / ntok) ** 2
    share = judged_total / max(1, judged_total + refused_total)
    check("...and the section's grading POWER clears the floor its own "
          "fixture predicts — the filler's anchorable-position share, "
          "squared, because a pair needs both ends. No literal: a weaker "
          "filler moves the prediction with it, and what this catches is "
          "the GRADER refusing what it ought to judge",
          share >= floor,
          f"judged share {share:.1%} against a derived floor {floor:.1%} "
          f"({anchored} of {ntok} token positions anchor on the filler)")

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
    check("the whole GENERATOR_ROSTER is reached — every section-kind "
          "function, not v1's five",
          # ~~14~~ ~~19~~ DERIVED — REPINNED 2026-08-22 when the roster
          # began deriving from the section-kind functions
          # (`FunctionSpec.kind`, M-56), and DE-LITERALIZED 2026-08-28
          # when `patter` (M-52) took it to 20 and the pinned 19 went
          # red — the exact literal defect this check's own comment
          # warned about while carrying one. The ASSERTION that matters
          # is unchanged and is now the whole condition: the sampler
          # reaches the WHOLE roster, whose size is the vocabulary's own
          # section-kind count and never a number typed here.
          funcs == set(GENERATOR_ROSTER)
          and len(GENERATOR_ROSTER) == _n_section_kind(),
          f"reached {len(funcs)} of {len(GENERATOR_ROSTER)}")
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
    # ~~`len(totals) >= 40`~~ — STRUCK 2026-08-24 (`MISSING.md` M-106). That
    # was 40 of the union set's 46 values (87%), and the union was three
    # KINDS of text: a quatrain's lengths, a sonnet's and a song's. The
    # planner draws from `song_line_counts()` now, which is 39 CONTIGUOUS
    # values, so a literal 40 is unreachable by construction and would fail
    # on a tree that got strictly better at the thing this check measures.
    # The claim was always COVERAGE, so coverage is what is asserted — as a
    # fraction of the DERIVED set, which cannot go stale when the set moves.
    from quality import plan as _PL
    _env = set(_PL.song_line_counts())
    # REPINNED 2026-09-04 (`MISSING.md` M-239): the envelope is 12..447 now
    # and 300 draws cannot reach 85% of 436 values — a uniform draw reaches
    # 1 - (1 - 1/|env|)^seeds of them in expectation, about 50% here. The
    # claim is still COVERAGE, stated against that expectation rather than
    # against a literal share, so it cannot go stale when the set moves
    # again. Both ends within 5 of the derived limits, as before.
    import math as _m
    _expect = len(_env) * (1 - (1 - 1 / len(_env)) ** len(plans))
    check("totals cover the envelope's order, not one shape: the distinct "
          "totals reached are most of what a UNIFORM draw over the DERIVED "
          "envelope reaches in this many seeds, both ends included",
          len(totals) >= 0.85 * _expect and min(totals) <= _lo + 5
          and max(totals) >= _hi - 5,
          f"{len(totals)} distinct of {len(_env)} in the envelope "
          f"({100 * len(totals) / len(_env):.0f}%; a uniform draw expects "
          f"{_expect:.0f}), [{min(totals)}, {max(totals)}] against "
          f"[{_lo}, {_hi}]")

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
    # `specialisation_of` joined 2026-08-28 with M-57: it is the vocabulary's
    # own subsumption lookup (pure, reads only the map derived from the
    # rows) and the planner consults it to REFUSE a specialisation name
    # (`middle-eight`) rather than silently widening it to the genus — the
    # differentia (`bars == 8`) is a promise the envelope draw cannot make.
    ALLOWED_FROM_GRID = {"SECTION_FUNCTIONS", "FunctionSpec", "as_function",
                         "placement_findings", "placement_of",
                         "specialisation_of"}
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
    ALLOWED_FROM_FLOOR = {"PROFILES", "FloorDeclaration"}
    # `FloorDeclaration` joined with M-125(b): the gate reads the floor's
    # own `anaphora_max` through the declaration's `resolve`, so the
    # forced-opener ceiling and ANAPHORA_OVERLOAD cannot hold two
    # thresholds (doctrine 1). It is the declaration CLASS, not a reader
    # — constructing one opens no file and reaches no feature table.
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
                          "LAST_WORD", "is_default_spelling"}
    # `is_default_spelling` joined 2026-09-03 (M-206). It is a PURE PREDICATE
    # over a member's own spelling — `is_default(parse_slot(text))`, in the
    # module that owns the spelling — and it resolves nothing: no lexicon, no
    # line, no words. It is admitted because the alternative is what this
    # allow-list exists to prevent, one layer over: the planner parsing the
    # member itself, which it did at two sites in three different spellings
    # that disagreed on `<line>.endword` and refused 7 of 120 seeds.
    # `relations` JOINED 2026-08-25 (M-117, the owner's "now do the planner
    # too") ON THE SAME ARGUMENT AS `slots` AND WITH THE SAME NARROWING:
    # `DRAWABLE_SCHEMAS` is an ADOPTED tuple of the same species as
    # `meter_bands.ADOPTED` — certified against the declared witness by
    # `derive_drawable_schemas()`, which §14 re-derives — and the planner
    # may name ONLY it. `relations` holds `build_stream`/`realise` and a
    # phonology reach, so an unrestricted admission would hand the planner
    # a stream builder, which is the corpus arriving at the dice by a
    # longer road.
    # `pair_bindable` and `REGISTRY` joined 2026-08-28, REPINNING AN
    # INHERITED RED: M-149(a) (commit cd026bf) had the draw consult the
    # pair judge's own predicate — `_RL.pair_bindable(_RL.REGISTRY[name])`
    # — so a group binding declared tokens draws only from schemas the
    # judge can bind there, and this allow-list was never told; the guard
    # was red at HEAD before the M-57 sitting touched this file (proven
    # from the committed tree: plan.py at 1c3f3b4 names both, the list
    # held three). Both are admissible on the check's own worry:
    # `pair_bindable` is a pure predicate over a schema row and `REGISTRY`
    # is the declared schema table — neither builds a stream, realises, or
    # reaches the phonology.
    # `overhang_member`, `unsatisfiable_pairs` and `group_satisfiable`
    # joined 2026-08-30 with M-174's gate, and they are admissible on the
    # identical argument `pair_bindable` was: each is a PURE predicate over
    # a schema row's own declared `unmatched` coordinate — a dict lookup and
    # one binomial — so none builds a stream, realises anything, opens a
    # file, or reaches the phonology. They are named by BOTH the relation
    # draw and `joint_findings`, which is the point of them being one
    # definition rather than two (doctrine 1).
    # `identity_forced` joined 2026-08-30 with M-175's gate, on the same
    # argument again — it reads a schema's own `identity` rules and answers
    # a bool. THAT IT NEEDED A SECOND COMMIT IS THE ENTRY: M-174 added three
    # names here and M-175 added a fourth one commit later, and the list was
    # told about the first three only. The check caught it both times, which
    # is the whole point of pinning the NAMES rather than the module — but a
    # session that writes down "a planner change is a tree-wide repin" and
    # then repeats the omission in the next commit has learned the sentence
    # and not the habit. The habit is: after touching `plan.py`'s imports,
    # diff `grep -oE '_RL\.[a-zA-Z_]+' quality/plan.py | sort -u` against
    # this set BEFORE pushing.
    ALLOWED_FROM_RELATIONS = {"DRAWABLE_SCHEMAS", "drawable_traits",
                              "CHANNEL_DOMAINS", "pair_bindable",
                              "REGISTRY", "overhang_member",
                              "unsatisfiable_pairs", "group_satisfiable",
                              "identity_forced", "placement_bindable",
                              "POSITION_PLACEMENT_KINDS"}
    # `placement_bindable` joined 2026-09-03 (M-206) as `pair_bindable`'s
    # other half: that one asks whether one declared TOKEN can carry a
    # member's span, this asks whether the POSITION it sits at can satisfy
    # the schema's own placement rule. THE REACH IS STATED RATHER THAN
    # WAVED THROUGH, because it is the widest name on this list: it builds
    # a stream and therefore touches the phonology. What it builds it from
    # is `relations._PROBE_LINE`, a four-word MODULE CONSTANT — the planner
    # hands it no text, holds no text, and this check's other half
    # (`opens == 0` in plan.py) is untouched. So the reach is to the
    # DICTIONARY and not to the corpus, which is the distinction every
    # narrowing on this list is drawn on.
    # `POSITION_PLACEMENT_KINDS` joined with it: a declared frozenset of
    # `Placement.kind` names, the same species as `CHANNEL_DOMAINS`, read
    # only so the refusal can QUOTE the rule it refused on.
    # `drawable_traits` joined with M-118's conjunction gate: the
    # gap ceiling and end-channel signature per drawable schema,
    # derived in relations.py from its own rows so the planner
    # never reads a row itself.
    # `CHANNEL_DOMAINS` joined with M-123: an ADOPTED table of finite
    # channel value domains (prominence binary, the vowel inventory, the
    # derived presence bit) — the same declared-constant species as
    # `DRAWABLE_SCHEMAS`, no reader and no stream behind the name, and
    # the clique cap and parity closure are what read it.
    # `narrative` JOINED 2026-08-25 (M-121, the wired half of the
    # narrative layer) AND IS THE EASIEST ADMISSION THIS GUARD HAS EVER
    # RULED ON: quality/narrative.py imports NOTHING from quality and
    # opens NO file — it is hand-declared vocabulary plus arithmetic,
    # the same species as `structures`, with no transitive reach to any
    # reader. The planner may name only the counter, the draw, the
    # validator and the refusal.
    ALLOWED_FROM_NARRATIVE = {"count_lineups", "draw_lineup",
                              "validate_lineup", "sung_sequence",
                              "NarrativeRefused"}
    grid_names, floor_names = set(), set()
    cap_names, slot_names, rel_names = set(), set(), set()
    nar_names = set()
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
            elif n.value.id in ("_RL", "relations", "RL"):
                rel_names.add(n.attr)
            # the BARE name `narrative` is deliberately NOT collected:
            # it is make_plan's own KWARG (the writer's declared
            # line-up, a dict), so attribute reads on it are dict
            # operations, not module reads — the module travels as _NV.
            elif n.value.id in ("_NV", "NV"):
                nar_names.add(n.attr)
    check("plan.py imports exactly {schemes, meter_bands, structures, grid, "
          "floor, capacity, slots, relations, narrative} from quality and "
          "opens NO file — the corpus cannot reach the dice (the owner's "
          "move-37 rule)",
          subs == {"schemes", "meter_bands", "structures", "grid", "floor",
                   "capacity", "slots", "relations", "narrative"}
          and opens == 0,
          f"imports {sorted(subs)}, open() calls {opens}")
    check("...and from `narrative` ONLY the counter, the draw, the "
          "validator and the refusal — the module itself imports nothing "
          "from quality and opens no file, which is why it is the "
          "easiest admission this guard has ruled on",
          nar_names <= ALLOWED_FROM_NARRATIVE, f"names {sorted(nar_names)}")
    check("...and from `relations` ONLY the adopted drawable pool, never "
          "the stream builder or a realiser — `relations` reaches the "
          "phonology, which opens the dictionary",
          rel_names <= ALLOWED_FROM_RELATIONS, f"names {sorted(rel_names)}")
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
    # The LIVE lyric-sheet profile (M-239): a superseded row's band is read
    # by nothing, so perturbing it would prove nothing.
    song = [p for p in FL.PROFILES if not p.n_lines and not p.superseded_by][0]
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

    # THE HOOK SLOT — REPOINTED 2026-08-23 (`MISSING.md` M-84, owner's ruling
    # *"promote HOOK_DOES_NOT_RECUR to a flag"*). This asserted
    # ~~`p["hook_slot"] == the first chorus's first line`~~ and went red on the
    # promotion, correctly: that WAS the rule, and it was the defect. A hook is
    # defined by RETURN, so once the code can refuse a draft, a slot in a
    # section drawn ONCE asks the writer for something no words can supply —
    # measured at 219 of 400 seeds before the repair, every one a chorus.
    #
    # THE NEW CLAIM IS STRICTLY STRONGER AND ITS SECOND BRANCH IS NOW REACHABLE
    # OVER THE SWEEP. The old check had to prove `hook_slot is None` on a
    # hand-mutilated plan, because `FORM_REQUIRES["verse-chorus"]` makes a
    # chorus mandatory so `first` was never None. Recurrence is not mandatory,
    # so both branches occur naturally and neither is asserted on a shape
    # nothing produces.
    # REPINNED 2026-09-01 (`MISSING.md` M-190): the `None` branch is no
    # longer reachable over the sweep, ON PURPOSE. Every verse-chorus plan
    # draws its chorus at least twice now (`FORM_RECURS`), so a plan in
    # which nothing recurs is a shape the shipped planner cannot produce —
    # and asserting the branch on one would be asserting on a shape nothing
    # produces, the old check's own objection. The branch is exercised under
    # the MUTATION that drops the recurrence rule, which is the planner as
    # it stood before M-190; the "says WHY" check runs under the same
    # mutation, because the shipped sweep has no hookless plan to ask it of.
    def _hook_walk(seeds):
        seen_with = seen_without = False
        ok = why_ok = True
        for seed in seeds:
            p = make_plan(seed=seed)
            drawn = {}
            for sec in p["sections"]:
                drawn[sec["function"]] = drawn.get(sec["function"], 0) + 1
            recurs = {fn for fn, n in drawn.items()
                      if n > 1 and fn not in PLN.WORDLESS_FUNCTIONS}
            want = next((s2["line"] for s2 in p["line_slots"]
                         if s2["function"] in recurs), None)
            got = p["hook_slot"]
            if want is None:
                ok = ok and got is None
                why_ok = why_ok and bool(p.get("hook_slot_refused"))
                seen_without = True
            else:
                # The slot must sit in a function drawn MORE THAN ONCE; which
                # of them is preferred is the vocabulary's business
                # (`returns_as`), so this asserts the INVARIANT rather than
                # the preference order.
                fn = next(s2["function"] for s2 in p["line_slots"]
                          if s2["line"] == got) if got else None
                ok = ok and got is not None and drawn.get(fn, 0) > 1
                seen_with = True
        return ok, why_ok, seen_with, seen_without
    ok, _why, seen_with, seen_without = _hook_walk(range(40))
    check("hook_slot sits in a function this plan drew MORE THAN ONCE on "
          "every seed of the sweep — and since M-190 NO plan lacks one, "
          "because the form's chorus recurs by rule: the recurrence is what "
          "makes the two hook flags askable of every plan",
          ok and seen_with and not seen_without,
          f"with {seen_with}, without {seen_without} (the None branch is "
          f"unreachable by design under the shipped table)")
    saved_recurs = dict(PLN.FORM_RECURS)
    try:
        PLN.FORM_RECURS.clear()
        m_ok, m_why, _m_with, m_without = _hook_walk(range(40))
    finally:
        PLN.FORM_RECURS.clear()
        PLN.FORM_RECURS.update(saved_recurs)
    check("...and under the MUTATION that drops the recurrence rule the "
          "None branch is reached and holds — BOTH branches exercised, "
          "neither asserted on a shape nothing produces",
          m_ok and m_without,
          f"without {m_without} under the mutation")
    check("...and a plan declaring no hook says WHY, so 'nothing recurs' and "
          "'nobody asked' stop looking identical in an empty field "
          "(doctrine 20) — asked under the same mutation, since the shipped "
          "sweep has no such plan to ask",
          m_why and m_without,
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

    Neither is sampled. ~~The planner does not pick a relation -- putting
    `type:pararhyme` on a group nobody asked for is the "move 37" ban pointed
    at rhyme instead of at shape~~ -- SUPERSEDED BY OWNER RULING 2026-08-25
    (M-117, §14 below): when the writer declares nothing, each group DRAWS
    its relation from the certified pool, and the drawn coordinate rides the
    grading command as `--relations=` (plural, per group). What survives is
    PRECEDENCE: the writer's own `--relation=` (singular, global) is CARRIED,
    never sampled over, and declaring it silences the draw.
    """
    print("\n9. the writer's declaration (M-55)")
    import quality.plan as P

    base = P.make_plan(11)
    check("a plan with NO declaration carries empty WRITER coordinates — "
          "`relation` and `functions` stay unimputed — and its GRADE IT "
          "line carries no `--relation=` (the writer's singular spelling); "
          "what it does carry is `--relations=`, the DRAWN per-group "
          "coordinate (M-117), which is the planner's, not the writer's",
          base["relation"] == "" and base["functions"] == []
          and "--relation=" not in P.grading_command(base)
          and "--relations=" in P.grading_command(base))

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

    # ---- THE TITLE, THE SAME DECLARATION, ADDED 2026-08-24 ----------------
    # `grid.hook_findings` asks "is the title in the hook?" and REFUSES on an
    # empty `Song.title` (TITLE_UNDECLARED), while `fill_plan` wrote
    # `"title": ""` into every blueprint the planner has ever built. So the
    # only way to answer that question was to edit the JSON by hand after the
    # planner wrote it -- a step in producing a delivered song with no
    # entrance the system owns, which is standing rule 3's own case.
    import quality.grid as G

    check("a plan with NO declared title carries `''`, and `fill_plan` writes "
          "that straight through -- the finding is UNCHANGED for anyone who "
          "does not declare one",
          base["title"] == ""
          and P.fill_plan(base, ["x"] * base["total_lines"])["title"] == "",
          repr(base["title"]))

    t = P.make_plan(11, title="Stay Awake")
    filled = P.fill_plan(t, [f"line {i}" for i in range(t["total_lines"])])
    check("a declared title is CARRIED into the plan and through `fill_plan` "
          "into the blueprint -- never inferred, because guessing one off the "
          "first line is the inference TITLE_UNDECLARED exists to refuse",
          t["title"] == "Stay Awake" and filled["title"] == "Stay Awake",
          f"{t['title']!r} / {filled['title']!r}")

    # THE MUTATION, and it is the defect this block was written for: the CLI
    # parsed `--title`, the usage line advertised it, and the non-sweep branch
    # spelled its own `make_plan(...)` call beside the identical `plan_kw` --
    # so the flag reached the SWEEP and not the PLAN, and the blueprint came
    # out with `"title": ""` anyway. Carrying it in the library is not the
    # claim; carrying it THROUGH THE VERB is.
    import subprocess, json as _json, tempfile, os as _os
    with tempfile.TemporaryDirectory() as td:
        draft = _os.path.join(td, "d.txt")
        bp = _os.path.join(td, "bp.json")
        open(draft, "w", encoding="utf-8").write(
            "\n".join(f"line {i}" for i in range(t["total_lines"])) + "\n")
        root = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
        # NOT `r` -- that name holds the roster plan the determinism check
        # below compares against, and shadowing it here made that check
        # compare a plan with a CompletedProcess.
        proc = subprocess.run(
            [sys.executable, _os.path.join(root, "lyric_harness.py"), "plan",
             "--seed=11", "--title=Stay Awake", f"--fill={draft}",
             f"--out={bp}"], capture_output=True, text=True, cwd=root)
        wrote = _os.path.exists(bp)
        got = _json.load(open(bp, encoding="utf-8"))["title"] if wrote else None
    check("`plan --title=` REACHES THE BLUEPRINT through the CLI, not only "
          "through the library -- the flag the sweep branch read and the plan "
          "branch did not",
          wrote and got == "Stay Awake",
          f"rc={proc.returncode} title={got!r}")

    # AND THE FINDING MOVES WITH IT, both ways -- without this pair the two
    # checks above pin a field nothing reads.
    song_t, hooks_t = G.song_from_blueprint(
        dict(filled, hooks=["line 0"], lines=[dict(l, text="line 0")
                                              for l in filled["lines"]]))
    codes_t = {r.code for r in G.hook_findings(song_t, hooks_t)[1]}
    song_0, hooks_0 = G.song_from_blueprint(
        dict(filled, title="", hooks=["line 0"],
             lines=[dict(l, text="line 0") for l in filled["lines"]]))
    codes_0 = {r.code for r in G.hook_findings(song_0, hooks_0)[1]}
    # `hook_findings` -> (findings, REFUSALS), and TITLE_UNDECLARED is a
    # refusal: "the question was not asked" is not the same answer as "asked
    # and clean" (doctrine 20/28), so it comes back on the second element.
    check("TITLE_UNDECLARED stands on the SAME song with the title removed "
          "and is gone once it is declared -- the coordinate is read, not "
          "merely stored",
          "TITLE_UNDECLARED" in codes_0
          and "TITLE_UNDECLARED" not in codes_t,
          f"declared={sorted(codes_t)} undeclared={sorted(codes_0)}")

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
        ok = chorus = seen = 0
        for s in range(n):
            try:
                pl = PLN.make_plan(s)
            except Exception:
                continue
            fns = [x["function"] for x in pl["sections"]]
            seen += 1
            if "chorus" in fns:
                chorus += 1
            if "verse" in fns and "chorus" in fns:
                ok += 1
        return ok, chorus, seen

    live_ok, _live_chorus, live_n = _rate()
    check("EVERY plan under the default form carries both a verse and a "
          "chorus — the two functions `FORM_REQUIRES` declares, measured "
          "178 of 178 on corpus/song/ before being written down",
          live_ok == live_n and live_n > 100,
          f"{live_ok}/{live_n}")

    # THE FORM IS TWO TABLES SINCE M-190 (2026-09-01): `FORM_REQUIRES` names
    # the members and `FORM_RECURS` the returner. Withdrawing the membership
    # table alone no longer collapses the rate to the 8.3% this section was
    # written against, because the recurrence table still holds the chorus
    # in every plan — MEASURED 50/200 = 25.0% carrying both, 200/200
    # carrying a chorus, which is the old `dead_ok * 4 < dead_n` pin failing
    # by exactly the seeds the second table rescued. So the second table is
    # pinned as load-bearing on its own, and the collapse the old check
    # measured needs both withdrawn.
    saved_req = dict(PLN.FORM_REQUIRES)
    saved_rec = dict(PLN.FORM_RECURS)
    try:
        PLN.FORM_REQUIRES.clear()
        half_ok, half_chorus, half_n = _rate()
        PLN.FORM_RECURS.clear()
        dead_ok, dead_chorus, dead_n = _rate()
    finally:
        PLN.FORM_REQUIRES.clear()
        PLN.FORM_REQUIRES.update(saved_req)
        PLN.FORM_RECURS.clear()
        PLN.FORM_RECURS.update(saved_rec)
    check("...withdrawing the MEMBERSHIP table alone leaves a chorus in "
          "every plan — the recurrence table (M-190) holds it by itself — "
          "while the verse goes",
          half_n and half_chorus == half_n and half_ok < half_n,
          f"membership withdrawn: chorus {half_chorus}/{half_n}, "
          f"both {half_ok}/{half_n}")
    check("...and WITHDRAWING both declarations collapses it, so the tables "
          "are load-bearing and not decoration the sampler would have "
          "satisfied on its own",
          dead_n and dead_ok * 4 < dead_n and dead_chorus < dead_n,
          f"both withdrawn: both {dead_ok}/{dead_n} = "
          f"{100.0 * dead_ok / max(dead_n, 1):.1f}%, chorus "
          f"{dead_chorus}/{dead_n}  vs declared "
          f"{100.0 * live_ok / max(live_n, 1):.1f}%")

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
    drawn = Counter()
    n = 0
    for seed in range(60):
        try:
            pl = make_plan(seed=seed)
        except PlanRefused:
            continue
        n += 1
        # THE END-RHYME PASS'S OWN GROUPS (M-107), read off its disclosure so
        # the web draw's share can be counted apart from what the pass binds
        # on top (doctrine 79).
        added = set(pl["choices"]["end_rhyme"]["groups"])
        for g in pl["groups"].split(";"):
            for m in g.split(","):
                where = "end" if "." not in m else m.split(".", 1)[1]
                places[where] += 1
                if g not in added:
                    drawn[where] += 1
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
    drawn_share = drawn["end"] / max(1, sum(drawn.values()))
    # REPINNED 2026-09-01 (`MISSING.md` M-191): this pin read the share over
    # ALL members and passed at ~24% because the end-rhyme pass (M-107) adds
    # ends on top of a web draw that put `end` at 8.5%. The density cap
    # draws FEWER web bindings a line, so the pass's additions are a larger
    # share of a smaller whole (measured 28.3% over these seeds) — and the
    # web draw, which is what this check is ABOUT, did not move. The two
    # are counted apart now (doctrine 79) and the pin is on the draw.
    check("and `end` is ONE placement among them rather than the axis "
          "everything is measured against — the WEB DRAW's own share is near "
          "the uniform share of the pool, which is the correction stated as "
          "a measure; the end-rhyme pass then binds free ends ON TOP and is "
          "counted apart",
          drawn_share < 0.25,
          f"web draw: end at {drawn_share:.1%} of its members; with the "
          f"end-rhyme pass's additions {end_share:.1%}, over {n} plans")
    check("OVERLAPPING covers are reached by the DRAW. Doctrine 2 says "
          "maximal cliques may overlap and the mandate layer has always "
          "accepted them; the generator could not produce one, so that "
          "class of song had probability exactly zero from the front door",
          overlap > 0, f"{overlap}/{n} plans put some line in >1 group")
    # REPOINTED 2026-08-29 (`MISSING.md` M-171), and the old pin is why it had
    # to be. It read `max(part) <= DENSITY floor` under a message ending "than
    # it has syllables" — but `<=` PERMITS EQUALITY, and equality is a line
    # every word of which is bound to a different rhyme family. The check was
    # true, its message was true, and together they licensed exactly the
    # unwritable line the planner was drawing (measured: 15.9% of 4,482 lines
    # over 121 seeds, at least one in 120 of them). A pin that passes on the
    # defect it names is doctrine 48 inside the suite that enforces it.
    check("a line's participation leaves the writer at least "
          f"{PLN.WORDS_LEFT_FREE} word of their own: it is bounded by what a "
          "band-legal line can CARRY — the calibrated density band's floor — "
          "MINUS the reserve, so no plan hands back a line whose every word "
          "is dictated by some rhyme family",
          max(part) <= MB.ADOPTED["DENSITY"][0] - PLN.WORDS_LEFT_FREE,
          f"max participation {max(part)}, density floor "
          f"{MB.ADOPTED['DENSITY'][0]} less reserve {PLN.WORDS_LEFT_FREE}")
    # THE INVARIANT ITSELF, not the constant that currently delivers it. The
    # check above compares against a bound the module declares, so it moves
    # when the bound moves; this one asks the question the entry is about and
    # would catch a future draw that reached the same place another way.
    check("...and that is the property, stated without reference to the "
          "constant: NO line in any drawn plan is bound at every word",
          all(b < MB.ADOPTED["DENSITY"][0] for b in part.elements())
          if hasattr(part, "elements") else max(part) < MB.ADOPTED["DENSITY"][0],
          f"participation {dict(sorted(part.items()))} against floor "
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
    # THE FIFTH CAUSE — a hook declared in a section drawn once (`MISSING.md`
    # M-84). It is the one entry on this list a writer cannot answer BY
    # WRITING, which is exactly why it belongs to a PLAN-TIME gate: no choice
    # of words makes a section recur. Before the repair the planner emitted it
    # in 219 of 400 seeds, all chorus.
    hooked = [p for p in plans if p.get("hook_slot")]
    check("plans that DO declare a hook declare it in a function this plan "
          "drew MORE THAN ONCE — a hook is defined by RETURN, so a slot in a "
          "section heard once is a requirement no writer can meet",
          hooked and all(
              sum(1 for s in p["sections"]
                  if s["function"] == next(r["function"]
                                           for r in p["line_slots"]
                                           if r["line"] == p["hook_slot"]))
              > 1 for p in hooked),
          f"{len(hooked)} of {len(plans)} plans declare a hook")
    check("...and a plan that declares NONE says WHY rather than going "
          "silent, because a shape with nothing recurring and a shape nobody "
          "asked about a hook look identical in an empty field (doctrine 20)",
          all(p.get("hook_slot_refused") for p in plans
              if not p.get("hook_slot")),
          f"{len(plans) - len(hooked)} plans declare no hook, each with a "
          f"stated reason")
    # THE MUTATION: force the hook into a section drawn once and require the
    # gate to fire. Without this the two checks above pass on any tree whose
    # planner simply never declares a hook at all.
    victim = next((p for p in plans if not p.get("hook_slot")), None)
    if victim is not None:
        mutant = dict(victim)
        mutant["hook_slot"] = victim["line_slots"][0]["line"]
        codes = [c for c, _ln, _d in PLN.joint_findings(mutant)]
        check("MUTATION — a hook forced into a section this plan drew once "
              "FIRES `HOOK_IN_NONRECURRING_SECTION`, so the two checks above "
              "are not passing on a planner that merely never declares one",
              "HOOK_IN_NONRECURRING_SECTION" in codes, f"{codes}")
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
    blind_by_cap = {}
    # THE CAP IS A PURE FUNCTION OF THE SEED (M-191: a stream of its own)
    # and the mutation touches only `_place_group`, so the shipped plan's
    # cap is the mutant's cap, refused or not.
    caps = {k: make_plan(seed=k)["choices"]["density"]["binding_cap"]
            for k in range(JOINT_SWEEP)}
    try:
        PLN._place_group = _place_group_keyed_on_the_name
        for k in range(JOINT_SWEEP):
            try:
                make_plan(seed=k)
                blind_by_cap.setdefault(caps[k], [0, 0])[1] += 1
            except PlanRefused as exc:
                blind_refused += 1
                blind_by_cap.setdefault(caps[k], [0, 0])[0] += 1
                blind_codes |= {c for c in PLN.JOINT_CODES if c in str(exc)}
    finally:
        PLN._place_group = real_place
    multi = [k for k in range(JOINT_SWEEP) if caps[k] >= 2]
    multi_refused = sum(v[0] for c, v in blind_by_cap.items() if c >= 2)
    single_refused = blind_by_cap.get(1, [0, 0])[0]
    # REPINNED 2026-09-01 (`MISSING.md` M-191): this read `> JOINT_SWEEP //
    # 2` over ALL seeds and measured 38/40 at M-80. Under the density cap a
    # cap-1 line draws ONE web binding and has nothing to collide with, so
    # the mutation's reach is a share of the seeds whose cap is 2 or more —
    # measured 20 of 28, with 0 of the 12 cap-1 seeds — which is the cap
    # working and not the gate sleeping. Pinned by cap, never summed.
    check("keying the collision test on the placement NAME instead of the "
          "WORD makes `make_plan` REFUSE most seeds whose lines draw MORE "
          "THAN ONE web binding — so the repair is READ and the sweep's 0 "
          "above is an answer, not a check that stopped checking",
          multi and multi_refused * 2 > len(multi) and blind_refused > 0,
          f"{blind_refused}/{JOINT_SWEEP} seeds refused when the word is "
          f"spelled as a placement name: {multi_refused}/{len(multi)} of "
          f"the seeds with cap >= 2, {single_refused}/"
          f"{JOINT_SWEEP - len(multi)} with cap 1 (refused, planned by "
          f"cap: {dict(sorted(blind_by_cap.items()))})")
    check("...and NO cap-1 seed is refused by the mutation — one binding a "
          "line cannot meet another, which is what the density coordinate's "
          "cap of 1 says a line draws",
          single_refused == 0, f"cap-1 refused {single_refused}")
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
    # ~~`res["accepted"] == [108]` over `range(120)`~~ — struck 2026-08-24
    # (`MISSING.md` M-106) — ~~and repinned to `[139, 284, 323]` over
    # `range(400)`~~ — struck again the SAME DAY, by M-107, and the second
    # strike is the interesting one.
    #
    # A SEED LIST IS THE WRONG PIN AND TWO REPINS IN ONE DAY IS THE EVIDENCE.
    # The claim this section is making is about the VERB — that `sweep`
    # answers a conjunction correctly — and a seed list pins a property of
    # the PLANS, which every derivation lot moves. Doctrine 58 in its own
    # words: a recorded count is a reading of whatever produced it. Repinning
    # it a third time would be recording the same fragility again.
    #
    # THE ALGEBRA IS PINNED INSTEAD, and it cannot go stale because it is a
    # property `sweep` must have for ANY plans: a conjunction of predicates
    # accepts EXACTLY the intersection of what each accepts alone. A verb
    # that ANDed wrongly — dropped a predicate, short-circuited, or ordered
    # the result — fails this on whatever the planner currently draws. The
    # range is 160 rather than 400 because seven sweeps are run and one is
    # enough to state the invariant (MEASURED at 36s).
    _R = range(160)
    singles = {w: set(PLN.sweep(_R, wants=[PLN.parse_sweep_want(w)])
                      ["accepted"])
               for w in ("sections<=6", "lines_per_section>=2", "group<=4",
                         "uses=verse,chorus", "before=verse,chorus",
                         "pins_per_line<=5")}
    res = PLN.sweep(_R, wants=wants)
    check("the conjunction accepts EXACTLY the intersection of the six "
          "predicates taken one at a time — the property a verb that ANDs "
          "correctly must have whatever the planner happens to draw",
          set(res["accepted"]) == set.intersection(*singles.values()),
          f"conjunction {res['accepted']}, intersection "
          f"{sorted(set.intersection(*singles.values()))}")
    # NON-VACUOUS: an intersection of six sets that were all EVERYTHING would
    # hold the line above and examine nothing. At least one predicate must
    # genuinely cut, and the conjunction must be strictly smaller than the
    # loosest single (doctrine 20 — "equal" and "nothing was compared" read
    # the same otherwise).
    _cut = [w for w, a in singles.items() if 0 < len(a) < len(_R)]
    check("...and the invariant is examined rather than satisfied by "
          "vacuity: predicates that genuinely cut, and a conjunction "
          "strictly smaller than the loosest of them",
          len(_cut) >= 3
          and len(res["accepted"]) < max(len(a) for a in singles.values()),
          f"{len(_cut)} of {len(singles)} predicates cut; "
          f"{len(res['accepted'])} accepted against a loosest single of "
          f"{max(len(a) for a in singles.values())}")

    # THE MEAN IS ITS OWN COORDINATE AND COMPARES AS A REAL (`MISSING.md`
    # M-181). Three properties, each of which a wrong implementation fails:
    # the value is the MEAN and not the max, `<=1.5` survives the parser
    # rather than being refused as a non-integer, and it is not TRUNCATED to
    # `<=1` on the way to the comparison — which `int(val)` did and which no
    # integer-valued predicate could ever have caught.
    print("\n10b. the density coordinate is a MEAN, and a real one")
    check("`bound_words_per_line` is declared real-valued, and it is the "
          "only measure that is",
          PLN.SWEEP_REAL == ("bound_words_per_line",), PLN.SWEEP_REAL)
    _pl = PLN.make_plan(seed=3, form="verse-chorus")
    _mean = PLN.SWEEP_MEASURES["bound_words_per_line"][1](_pl)
    _max = PLN.SWEEP_MEASURES["pins_per_line"][1](_pl)
    _pins = PLN._sweep_pins(_pl)
    check("...and it reads the MEAN over EVERY line, which is strictly "
          "below the per-line maximum on a real plan — the two are "
          "different questions, and `pins_per_line` could not express a "
          "density preference",
          abs(_mean - sum(_pins.values()) / _pl["total_lines"]) < 1e-9
          and _mean < _max,
          f"mean {_mean:.3f} against max {_max} over "
          f"{_pl['total_lines']} line(s)")
    _parsed = PLN.parse_sweep_want("bound_words_per_line<=1.5")
    check("...a fractional threshold PARSES rather than refusing as a "
          "non-integer — the band this coordinate separates the songs on "
          "lies between two integers",
          _parsed == ("bound_words_per_line", "<=", "1.5"), _parsed)
    # The truncation mutant: `int("1.5")` raises, and a cast that floors it
    # would answer this pair identically. A plan whose mean sits between 1
    # and 1.5 must be ACCEPTED by <=1.5 and REFUSED by <=1.
    _mk = lambda g, n: {"groups": g, "total_lines": n}
    _mid = _mk("1,2;3,4;5,6", 5)          # 6 members / 5 lines = 1.2
    check("...and it is not truncated on the way to the comparison: a mean "
          "of 1.2 passes `<=1.5` and fails `<=1`, which a floor to int "
          "could not distinguish",
          PLN.sweep_holds(_mid, PLN.parse_sweep_want(
              "bound_words_per_line<=1.5"))
          and not PLN.sweep_holds(_mid, PLN.parse_sweep_want(
              "bound_words_per_line<=1")),
          f"mean {PLN.SWEEP_MEASURES['bound_words_per_line'][1](_mid):.2f}")
    check("THREE COUNTS, NEVER SUMMED (doctrine 79): swept, planned, and "
          "REFUSED-by-the-planner. A refusal is the envelope turning a "
          "request down and charging it to the predicates would blame the "
          "declaration for the planner",
          res["seeds"] == 160
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


def test_the_section_header_keeps_its_apparatus_inside_the_bracket():
    print("\n11. THE SECTION HEADER — everything inside the bracket, meter "
          "included, and what the harness WRITES it EXCLUDES (`MISSING.md` "
          "M-85)")
    # THE OWNER'S STANDING INSTRUCTION, given more than once and never gated:
    # a section's apparatus lives INSIDE its bracket, and the METER is part of
    # that apparatus. `section_header` has always done both; nothing checked
    # it, so a regression there would be silent and would land in the one
    # place it must not — the rhyme calculation.
    #
    # WHY THE OBVIOUS GATE IS NOT THE ONE WRITTEN HERE. The tempting rule is
    # "refuse a line that opens on a dash", since `— 3 bars, one-beat pickup`
    # is what escapes. MEASURED over `corpus/`: 626,282 sung lines, 433 open
    # on a dash — an 0.0691% false-positive rate, and every sample is real
    # verse (Arnold's `--Ah! thine was not the shelter, but the fray.`,
    # Clare, Blunt, Browne). That rule would refuse canonical poetry, so it is
    # REFUSED here and the number is recorded instead (doctrine 22: state a
    # threshold as an FPR, not as an argument about how apparatus tends to
    # look).
    #
    # WHAT IS DECIDABLE is that the harness OWNS this format, so the gate is a
    # ROUND TRIP over its own output rather than a guess about someone else's.
    shapes = meters = drops = 0
    total = 0
    for seed in range(HEADER_SWEEP):
        p = make_plan(seed=seed)
        for sec in p["sections"]:
            slots = [s for s in p["line_slots"] if s["section"] == sec["name"]]
            h = PLN.section_header(sec, slots)
            total += 1
            shapes += (h.startswith("[") and h.endswith("]")
                       and "\n" not in h
                       and h.count("[") == 1 and h.count("]") == 1)
            im = sec["meter"]
            meters += f"{im['beats']}/{im['unit']}" in h
            drops += bool(LH.is_apparatus_line(h))
    check("the population is real, so this section cannot pass by examining "
          "nothing", total > 0, f"{total} headers over {HEADER_SWEEP} plans")
    check("every header is ONE closed bracket with NOTHING outside it — the "
          "owner's rule, and the reason a header cannot leak into the rhyme "
          "calculation", shapes == total, f"{total - shapes} malformed")
    check("...and every header CARRIES ITS METER inside that bracket, read "
          "from the section's own dict rather than trusted to prose",
          meters == total, f"{total - meters} missing beats/unit")
    check("...and `is_apparatus_line` DROPS every one of them, which is the "
          "half that matters: what this harness WRITES, this harness "
          "EXCLUDES from the rhyme calculation",
          drops == total, f"{total - drops} would be scored as lyric")
    # THE ROUND TRIP, and it is the strongest statement available: render a
    # song, read it back through the ONE definition of sung text, and require
    # the lines to come back exactly. Anything the renderer emits that is not
    # a lyric — header, blank, apparatus of any kind — must vanish.
    breaks = 0
    for seed in range(HEADER_SWEEP):
        p = make_plan(seed=seed)
        body = [f"line {i} holds its own place" for i in
                range(1, p["total_lines"] + 1)]
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False,
                                         encoding="utf-8") as fh:
            fh.write(PLN.render_song(p, body) + "\n")
            path = fh.name
        try:
            breaks += (LH.load_lyric_lines(path) != body)
        finally:
            os.unlink(path)
    check("RENDER -> LOAD ROUND-TRIPS: the rendered song read back through "
          "`load_lyric_lines` is EXACTLY the lines that went in, so no "
          "header, blank or pickup phrase the renderer writes can reach the "
          "grader as a word", breaks == 0,
          f"{breaks} of {HEADER_SWEEP} songs did not round-trip")
    # THE MUTATION: move the apparatus outside the bracket, exactly as it was
    # rendered in chat, and require the round-trip to BREAK. Without this the
    # checks above pass on any tree whose renderer emits nothing at all.
    sec = make_plan(seed=108)["sections"][0]
    escaped = f"[{sec['function'].upper()}] — {sec['bars']} bars, one-beat pickup"
    check("MUTATION — the same header with its apparatus moved OUTSIDE the "
          "bracket, split onto its own line, is SCORED AS LYRIC with end "
          "word 'pickup', which is the defect this section exists to keep "
          "out", not LH.is_apparatus_line("— 3 bars, one-beat pickup")
          and LH.line_tokens("— 3 bars, one-beat pickup")[-1] == "pickup"
          and LH.is_apparatus_line(escaped),
          "same-line stays apparatus; split onto its own line it is not")



def test_the_song_length_is_the_songs_own(FAILURES=None):
    print("\n12. the SONG's length comes from the profile that grades a "
          "SONG — not from the union of three kinds of text")
    # ===================================================================
    # M-106, 2026-08-24. The owner's standing rule: "we do not want hard
    # numbers anywhere ... we're not supposed to have hard coded numbers
    # for the line count or section count or the total length of the song".
    # ===================================================================
    import collections
    import statistics
    from quality import floor as FL
    from quality import plan as _PL

    union = set(_PL.gradeable_line_counts())
    song = set(_PL.song_line_counts())
    # REPINNED 2026-09-04 (`MISSING.md` M-239): the one live lyric-sheet
    # profile spans 4-3,245 tokens, which is 1..447 lines at the measured
    # tokens-per-line band and CONTAINS every stanza profile's reach, so the
    # song set is no longer a strict subset of the union — it IS the union.
    # The claim that survives: the planner draws from the SONG set, and
    # that set is never wider than what some profile can grade.
    check("the SONG band is contained in the union of every live profile's "
          "reach — this never widens what the planner volunteers past what "
          "the floor can grade; since M-239 the two coincide, because the "
          "lyric-sheet profile's range contains the quatrain's and the "
          "sonnet's",
          song <= union and song == union,
          f"song {len(song)} of union {len(union)}")
    # REPINNED 2026-09-01 (`MISSING.md` M-193): a SECOND lyric-sheet
    # profile, `short` (50-150 tokens), reaches 6..20 lines, so the SONG
    # set is {6..20} | {22..55} with ONE hole at the seam between the two
    # calibrated bands (150 tokens at the band's lowest tokens-per-line is
    # 20 lines; 200 at its highest is 22). The old claim — contiguous
    # where the union is not — held for one band; the argument it made
    # still holds: every hole is a fact about which BANDS were unioned,
    # and this one is the seam between two, not a fact about songs. The
    # union's own 6-11 and 18-21 holes are FILLED by the short band and
    # it now carries the same single seam.
    # REPINNED 2026-09-04 (M-239): ~~one hole at 21~~ — NO hole. The seam
    # was the space between two calibrated bands, and one profile covering
    # 4-3,245 tokens has no seam. This docstring's own diagnosis — every
    # hole was a fact about which bands were unioned, never about songs —
    # is what the closure confirms.
    check("and there is NO hole at all — every former seam (6-11, 18-21, "
          "21) was the space between two calibrated bands, and the "
          "length-curve profile has none",
          song == set(range(1, 448)) and _PL.line_count_gaps(song) == []
          and _PL.line_count_gaps(union) == [],
          f"song {min(song)}..{max(song)} gaps {_PL.line_count_gaps(song)}, "
          f"union gaps {_PL.line_count_gaps(union)}")
    # ===================================================================
    # M-133, 2026-08-26. The union's holes were DISCLOSED in the evidence
    # string above and asserted by nothing stronger than `!= []`, so when
    # the M-131 band re-adoption manufactured a SECOND one (18-21, once
    # the song floor rose past the sonnet ceiling) the check went on
    # passing and said so only in prose a reader had to notice. The
    # standing rule is that a measurement ends in a gate.
    #
    # THE FIRST DRAFT OF THIS CHECK WAS VACUOUS AND IS RECORDED RATHER
    # THAN QUIETLY REPLACED. It asserted that every hole is a SEAM — the
    # value under it topping one profile's reach, the value over it
    # bottoming another's. That is TRUE BY CONSTRUCTION: each profile
    # contributes one contiguous `range`, so any hole in a union of ranges
    # is bounded that way on every possible tree, and the check could not
    # fail. It is the exact defect this repo runs an AST sweep for, met
    # while writing the check meant to close a disclosure-without-a-gate.
    # What is asserted instead is the CONTINGENT property, below.
    #
    # The per-profile reach is obtained by calling `gradeable_line_counts`
    # against one profile at a time rather than respelling its arithmetic
    # here — one definition, exercised per profile (doctrine 1).
    #
    # THE TOKENS-PER-LINE BAND IS PINNED TO THE FULL TABLE ON PURPOSE and
    # this is not a convenience: `tokens_per_line_band()` derives from the
    # profiles that DECLARE a line count, so asking it under a
    # one-profile table REFUSES (correctly — a `song` alone declares
    # `n_lines == 0` and there is nothing to divide). The band is a
    # property of the calibration as a whole; only the RANGE is per
    # profile, so the band is read once, from its own proper domain, and
    # held while the reaches are taken.
    band = _PL.tokens_per_line_band()

    def reach_of(prof):
        keep = list(FL.PROFILES)
        FL.PROFILES[:] = [prof]
        real = _PL.tokens_per_line_band
        _PL.tokens_per_line_band = lambda: band
        try:
            _PL.gradeable_line_counts.cache_clear()
            return set(_PL.gradeable_line_counts())
        except _PL.PlanRefused:
            return set()
        finally:
            _PL.tokens_per_line_band = real
            FL.PROFILES[:] = keep
            _PL.gradeable_line_counts.cache_clear()

    reaches = {p.name: r for p in FL.PROFILES for r in [reach_of(p)] if r}
    holes = _PL.line_count_gaps(union)
    #: THE CONTINGENT CLAIM, and the one M-133 actually turns on: the
    #: three reaches are PAIRWISE DISJOINT AND NON-ABUTTING, which forces
    #: the hole count to len(profiles) - 1.
    #:
    #: THAT DISCRIMINATES THE BAND, which is what makes it worth checking:
    #: under the pre-M-131 band the song reach was 17..55 and the sonnet's
    #: 12..17 OVERLAPPED it at 17, so the union had ONE hole. The floor
    #: rising to 22 pulled them apart and MANUFACTURED the second (18-21).
    #: Move the band back and this check goes red on the count.
    ordered = sorted(reaches.items(), key=lambda kv: min(kv[1]))
    touching = [(a, b) for (a, ra), (b, rb) in zip(ordered, ordered[1:])
                if max(ra) + 1 >= min(rb)]
    # REPINNED 2026-09-01 (M-193): four reaches now — section 4-5, short
    # 6-20, sonnet 12-17, song 22-55 — and two of the three seams TOUCH
    # (section abuts short at 5|6; short overlaps the sonnet outright), so
    # the general form of the claim is what is pinned: a hole per seam
    # that is disjoint and non-abutting, i.e. holes == seams - touching.
    # Under the old three-profile table that read 2 == 2 - 0; it reads
    # 1 == 3 - 2 now, and the single survivor is the sonnet-song seam
    # M-131 opened (18-21), narrowed to 21 by the short band from below.
    # REPINNED 2026-09-04 (M-239): the reaches are the LIVE profiles' —
    # section 4-5, sonnet 12-17, lyric 1-447 — and the lyric reach contains
    # both others, so every seam touches and the hole count reads 0 == 2 - 2.
    check("...and the union's hole count is the number of seams between "
          "adjacent reaches that neither touch nor overlap — one hole per "
          "such seam — which reads 0 == 2 - 2 over the three live profiles: "
          "the lyric-sheet reach contains the section's and the sonnet's, "
          "so no seam is open",
          len(holes) == (len(reaches) - 1) - len(touching) == 0
          and len(touching) == 2,
          f"{len(holes)} hole(s) {holes} over {len(reaches)} reaches "
          f"{ {k: (min(v), max(v)) for k, v in ordered} }; "
          f"touching {touching}")
    # THE PROFILE IS IDENTIFIED BY ITS OWN DECLARATION, not by its name. A
    # name test would be a second statement of which profile means what
    # (doctrine 1). Proven by ASKING the table rather than by reading the
    # source: exactly the profiles with `n_lines == 0` must reach the band.
    lyric = [p for p in FL.PROFILES if not p.n_lines and not p.superseded_by]
    _tlo, _thi = _PL.tokens_per_line_band()
    check("the band is the reach of exactly the LIVE profile(s) declaring "
          "`n_lines == 0` — ONE since M-239 (the two band rows are "
          "superseded and read by nothing), and the set is its reach: "
          "a lyric sheet has no fixed line count, which is the coordinate, "
          "not the string 'song'",
          len(lyric) == 1 and min(song) >= 1
          and max(song) == max(int(p.hi // _tlo) for p in lyric)
          and min(song) == min(math.ceil(p.lo / _thi) for p in lyric)
          and song == set().union(*[
              set(range(max(1, math.ceil(p.lo / _thi)), int(p.hi // _tlo) + 1))
              for p in lyric]),
          f"{[p.name for p in lyric]}, {min(song)}..{max(song)}")

    # MUTATION 1 — the band must be a FUNCTION of the song profile, not a
    # literal wearing a derivation (doctrine 48).
    old_hi = lyric[0].hi
    try:
        lyric[0].hi = old_hi + 200
        _PL.song_line_counts.cache_clear()
        widened = set(_PL.song_line_counts())
    finally:
        lyric[0].hi = old_hi
        _PL.song_line_counts.cache_clear()
    check("MUTATION — widening the song profile's measured token band "
          "widens the SONG line band with it, and the perturbation is "
          "restored",
          widened > song and set(_PL.song_line_counts()) == song,
          f"{len(song)} -> {len(widened)} values")

    # MUTATION 2 — the stanza floor must be a FUNCTION of the section
    # profile, since it is what bounds the section COUNT.
    stanza = [p for p in FL.PROFILES if p.n_lines]
    before_floor = _PL.stanza_line_floor()
    old_lo = stanza[0].lo
    try:
        stanza[0].lo = old_lo * 3
        _PL.stanza_line_floor.cache_clear()
        moved = _PL.stanza_line_floor()
    finally:
        stanza[0].lo = old_lo
        _PL.stanza_line_floor.cache_clear()
    check("MUTATION — the stanza floor is READ from the calibrated stanza's "
          "own token range: triple it and the floor rises, and the "
          "perturbation is restored",
          moved > before_floor and _PL.stanza_line_floor() == before_floor,
          f"{before_floor} -> {moved}")
    check("the SECTION ceiling is that floor divided into the song, never "
          "the song's line count itself — a sound bound is not a uniform "
          "draw (the M-81(A) error one layer over)",
          ENVELOPE["sections"][1] == max(1, max(song) // before_floor)
          and ENVELOPE["sections"][1] < max(song),
          f"sections {ENVELOPE['sections']} against song max {max(song)}")

    # THE MEASUREMENT THE OWNER ASKED FOR, taken the way the bias was
    # found: per SECTION INSTANCE off the emitted plan, not per kind.
    per, tot, nsec = [], [], []
    for seed in range(1, 121):
        pl = make_plan(seed=seed)
        c = collections.Counter(x["section"] for x in pl["line_slots"])
        tot.append(pl["total_lines"])
        nsec.append(len(pl["sections"]))
        per.extend(c.get(sec["name"], 0) for sec in pl["sections"])
    sung = [x for x in per if x]
    ones = sum(1 for x in sung if x == 1) / len(sung)
    check("no seed is lost to the narrower band — 120 of 120 still plan",
          len(tot) == 120, f"{len(tot)} plans")
    check("every drawn total is INSIDE the song profile's own band, so the "
          "planner volunteers no length that profile cannot hold to "
          "anything", all(t in song for t in tot),
          f"[{min(tot)}, {max(tot)}] against [{min(song)}, {max(song)}]")
    # THE BIAS, STATED AS A RATE AND NOT AS AN ADJECTIVE (doctrine 22). The
    # ladder, all three measured on this same instrument: 52% under the
    # sequential draw `_partition_uniform` replaced, 39.4% under the union
    # band with `max_cells = total`, and this. It is NOT zero and must not
    # be read as zero: 1 is the modal part of any exact-uniform composition,
    # which is a property of the measure and not a defect to tune away, and
    # a one-line tag or vamp is a real section.
    check("ONE-LINE sung sections are a minority — well under the 39.4% "
          "this instrument measured before the band and the section "
          "ceiling were re-derived",
          ones < 0.30, f"{100 * ones:.1f}% of {len(sung)} sung sections, "
          f"median {statistics.median(sung)} lines")
    # AGAINST THE DERIVATION, NOT AGAINST THE ENVELOPE ENTRY. Comparing
    # `max(nsec)` to `ENVELOPE["sections"][1]` passes under a mutant that
    # moves BOTH — measured: the pre-M-106 ceiling reads 55 and the observed
    # tail 30, so the check held while the defect was live. The right-hand
    # side is recomputed here from the two derivations this section already
    # proved are wired, so the assertion cannot be satisfied by loosening the
    # thing it is asserting about.
    _derived_ceiling = max(1, max(song) // before_floor)
    check("and the section COUNT no longer runs to the song's line count: "
          "its tail sits inside the ceiling the stanza floor derives",
          max(nsec) <= _derived_ceiling < max(song),
          f"max {max(nsec)} sections against derived ceiling "
          f"{_derived_ceiling} (song max {max(song)}), "
          f"median {statistics.median(nsec)}")



def test_the_end_rhyme_pass_is_additive(FAILURES=None):
    print("\n13. the END-RHYME pass — each sung section's own scheme, "
          "re-realised at the line ends, and nothing else touched")
    # ===================================================================
    # M-107, 2026-08-24. The owner's ask, and the refusal that bounds it:
    #   "add a step at the end that adds rhymes to the end of the lines in
    #    order to follow the respective forms of the sections"
    #   "no, end should not be uniform ... do not fuck up what we've
    #    already built."
    # So every check here is about what the pass does NOT do as much as
    # what it does.
    # ===================================================================
    import collections
    from quality import plan as _PL

    SEEDS = range(1, 61)
    added_n = blocked_n = narrow_n = 0
    before_end = after_end = lines_n = 0
    all_added, mirrored, off_scheme = 0, 0, []
    collides, over_ceiling = [], []
    ceiling = None
    for seed in SEEDS:
        pl = make_plan(seed=seed)
        say = pl["choices"]["end_rhyme"]
        added_n += say["added"]
        blocked_n += say["blocked"]
        narrow_n += say["narrow"]
        ceiling = _PL.line_binding_ceiling(_PL.plan_max_token(pl))

        # THE ADDED GROUPS, recovered by RUNNING THE PASS AGAIN on the
        # emitted plan. It is a pure function, so a second call on a plan
        # that already carries its output must add NOTHING — every end it
        # would have bound is now bound. That is the idempotence check and
        # the purity check in one, and it is why `again` is expected empty.
        again, _ = _PL.end_rhyme_groups(pl)
        check_ok = (again == [])
        if not check_ok:
            off_scheme.append((seed, "not idempotent", again[:2]))

        # Re-derive the sections and their declared schemes INDEPENDENTLY,
        # then require every all-bare (end-bound) group in the plan that is
        # a whole scheme block to be one the code actually declares.
        per, order = {}, []
        for sl in pl["line_slots"]:
            if sl["section"] not in per:
                order.append(sl["section"])
                per[sl["section"]] = (sl["function"], [])
            per[sl["section"]][1].append(sl["line"])
        blocks = set()
        for nm in order:
            fn, ls = per[nm]
            code = (pl["choices"]["schemes"].get(fn) or {}).get("rgs") or ()
            if len(code) != len(ls):
                continue
            byb = {}
            for b, ln in zip(code, ls):
                byb.setdefault(b, []).append(ln)
            for _b, blk in byb.items():
                if len(blk) >= 2:
                    blocks.add(tuple(sorted(blk)))

        at = _PL.bound_placements(pl)
        # WHAT THIS PASS ADDED, read off its OWN disclosure and not guessed
        # from the shape of a group. An all-end group is not evidence of
        # this pass: the web pass can draw one too (measured at 3 of 225
        # over these seeds), so a shape test would charge this pass for the
        # web pass's grouping and pass or fail for the wrong reason.
        emitted = set(str(pl["groups"]).split(";"))
        for spelled in say["groups"]:
            all_added += 1
            nums = tuple(sorted(int(m) for m in spelled.split(",")))
            # A SUBSET of a declared block: the pass trims a block to its
            # free-ended members and never invents a grouping.
            if any(set(nums) <= set(bk) for bk in blocks) \
                    and spelled in emitted:
                mirrored += 1

        # NO END IS BOUND TWICE, and no line is asked for more distinct
        # spans than a band-legal line is guaranteed to hold.
        for ln, places in at.items():
            words = [_PL.placement_word(x) for x in places]
            if words.count(_PL.LAST_WORD) > 1:
                collides.append((seed, ln))
            if len(set(words)) > ceiling:
                over_ceiling.append((seed, ln, len(set(words))))

        # THE LIFT, measured by SUBTRACTING what the pass added: the same
        # plan read with and without its own contribution.
        by_line = collections.defaultdict(list)
        for g in str(pl["groups"]).split(";"):
            mems = [x.strip() for x in g.split(",") if x.strip()]
            bare = len(mems) >= 2 and all("." not in m for m in mems)
            for m in mems:
                by_line[int(m.partition(".")[0])].append(
                    (_PL.placement_word(m.partition(".")[2] or "end"), bare))
        for sl in pl["line_slots"]:
            lines_n += 1
            got = by_line.get(sl["line"], [])
            if any(w == _PL.LAST_WORD for w, _b in got):
                after_end += 1
            if any(w == _PL.LAST_WORD and not b for w, b in got):
                before_end += 1

    check("the pass is IDEMPOTENT and PURE — run again on a plan already "
          "carrying its output it adds nothing, so it is a function of what "
          "the plan says and not of what the loop had in scope",
          not off_scheme, off_scheme[:2])
    check("every group this pass ADDED is a SUBSET of a block its section's "
          "own declared `rgs` names, and every one of them reaches the "
          "emitted plan — it re-realises a scheme the plan already drew, "
          "invents no grouping, and drops none of what it claims",
          all_added > 0 and mirrored == all_added,
          f"{mirrored} of {all_added} added group(s) mirror a declared "
          f"block AND appear in `groups`")
    check("NO line has its end bound twice — the collision "
          "`joint_findings` refuses, checked here on the population the "
          "pass actually produced rather than waiting for the gate",
          not collides, collides[:3])
    # THIS ONE IS THE ENFORCEMENT AND NOT A RESTATEMENT OF ONE, and the
    # difference was MEASURED rather than assumed. Removing the end-collision
    # check makes `make_plan` REFUSE — `joint_findings` catches it and no
    # plan ships. Removing the ceiling check refuses NOTHING: 60 of 60 seeds
    # still plan and 26 lines go over silently, because that gate asks the
    # LOOSER question on purpose (what THIS line's grid admits) and this asks
    # the tighter one (what ANY band-legal line is guaranteed to hold). So
    # the ceiling is a GENERATOR discipline with no gate behind it, and this
    # check is the only thing standing under it.
    check("and no line is asked for more distinct spans than a BAND-LEGAL "
          "line is guaranteed to hold — the ceiling the web pass draws "
          "against, which this pass skipped on its first build. NO GATE "
          "REFUSES THIS: measured, dropping the check loses 0 of 60 seeds "
          "and puts 26 lines over, so this assertion IS the enforcement",
          not over_ceiling,
          f"ceiling {ceiling}, over: {over_ceiling[:3]}")
    check("THREE COUNTS, NEVER SUMMED (doctrine 79): added / blocked / "
          "narrow, and all three are populated so none is decorative",
          added_n > 0 and blocked_n > 0 and narrow_n >= 0,
          f"added {added_n}, blocked {blocked_n}, narrow {narrow_n}")
    # THE LIFT, STATED AS A RATE (doctrine 22). This is the owner's own
    # complaint measured: "the word(s) at the end of a line are at a 1 in 8
    # probability of rhyming whereas most songs have a much higher
    # probability of rhyming."
    check("the pass LIFTS the share of lines whose end is bound, and the "
          "before-figure is the same plan read without the pass's own "
          "contribution rather than a remembered number",
          after_end > before_end
          and after_end / lines_n > 0.6 > before_end / lines_n,
          f"{100 * before_end / lines_n:.1f}% -> "
          f"{100 * after_end / lines_n:.1f}% of {lines_n} lines")


def test_the_relation_draw():
    """§14 — the planner draws each group's relation from the certified
    pool (M-117, the owner's "now do the planner too"), and the adoption
    re-derives against the declared witness so the pool cannot drift."""
    print("\n-- 14. the relation draw: certified pool, carried to the "
          "grade, silent under a writer's declaration --")
    from quality import relations as RL
    from quality import rhyme_types as RT
    check("the ADOPTED drawable pool re-derives from the declared witness "
          "— a moved pool is a moved witness or a moved registry, and "
          "either must fail loud rather than drift (the meter-bands "
          "adoption pattern)",
          tuple(RL.DRAWABLE_SCHEMAS) == RL.derive_drawable_schemas(),
          "adoption drifted from derivation")
    pl = PLN.make_plan(7)
    n_groups = len(pl["groups"].split(";"))
    drawn = pl.get("relations") or {}
    check("a plan draws relations for its groups and every drawn name "
          "resolves in the `schema` namespace",
          drawn and all(RT.resolve_relation(v)[1] == "schema"
                        for v in drawn.values()),
          f"{len(drawn)} drawn over {n_groups} groups")
    check("every drawn label is a label the mandate itself would generate "
          "— `PLN.SC.label`, one definition, no respelling",
          set(drawn) <= {PLN.SC.label((k,)) for k in range(n_groups)},
          f"labels {sorted(drawn)[:6]}")
    check("the grading command CARRIES the draw — a declared coordinate "
          "read by nothing is the defect this repo has an instrument for",
          "--relations=" in PLN.grading_command(pl),
          PLN.grading_command(pl)[-80:])
    check("the draw is DISCLOSED in choices, like every other draw",
          "relations" in pl["choices"]
          and pl["choices"]["relations"]["value"] == drawn,
          "choices.relations missing or diverged")
    pl2 = PLN.make_plan(7, relation="class:ASSONANCE")
    check("a writer's own --relation SILENCES the draw — a declared "
          "coordinate is carried, never sampled over (M-55)",
          pl2.get("relations") == {} and pl2["relation"],
          f"drew {len(pl2.get('relations') or {})} despite a declaration")
    check("the draw consumes entropy AFTER every existing draw, so the "
          "seed's SHAPE is byte-identical to the pre-draw planner's — "
          "groups, returns and meter unmoved between the two calls above",
          pl["groups"] == pl2["groups"] and pl["returns"] == pl2["returns"],
          "shape moved with the relation coordinate")
    # THE CONJUNCTION GATE (M-118, widened by M-119, rebuilt as a GRAPH by
    # M-122): before M-118, 39 of 40 seeds drew a jointly unsatisfiable
    # schema conjunction; after M-119's locus-derived widening, 53 of 60
    # STILL did (117 adjacency violations, 32 transitive contradictions),
    # because `adjacent_lines` is a gap constraint spelled as a placement
    # KIND and EQUALITY IS TRANSITIVE where a per-pair ledger is not. The
    # check replays the gate's own three rules — gap, pairwise exact-match
    # on (pair, channel, coord), and the union-find closure — over fresh
    # draws with the registry's own coordinates, so a schema whose traits
    # move re-asks the question rather than trusting the draw-time filter.
    from itertools import combinations
    traits = RL.drawable_traits()
    # THE DERIVATION PINS. Without these, a derivation that quietly drops
    # a coordinate leaves the replay below vacuously green. M-119's two
    # survive re-expressed in the triples format; M-122 adds the three
    # facts its rebuild was filed on.
    cc = traits["cluster consonance / skothending span"]
    check("M-119's coordinates survive the M-122 rekeying — cluster "
          "consonance claims nucleus-Differ at the anchor (finality read "
          "from the span locus, no placement row), anaphora token-Agree "
          "at the head, head rhyme (positional) token-Differ at the head",
          ("nucleus", "anchor", "Differ") in cc["claims"]
          and ("token", "head", "Agree") in traits["anaphora"]["claims"]
          and ("token", "head", "Differ")
          in traits["head rhyme (positional)"]["claims"],
          f"cc {cc}, anaphora {traits['anaphora']}, "
          f"head rhyme {traits['head rhyme (positional)']}")
    check("M-122(a): `adjacent_lines` is read as gap 1 — interlaced "
          "rhyme's whole reach, a placement KIND the flat dict could not "
          "carry (117 violations over sixty seeds before this)",
          traits["interlaced rhyme"]["gap"] == 1,
          traits["interlaced rhyme"])
    pr = traits["perfect rhyme"]["claims"]
    check("M-122(b): perfect rhyme carries TWO onset rules at two "
          "coordinates — Agree at post, Differ at the anchor — which the "
          "old per-channel dict collapsed into one, inflating the honest "
          "pre-fix count from 53 to a false 56",
          ("onset", "post", "Agree") in pr
          and ("onset", "anchor", "Differ") in pr, pr)
    check("M-122(c): the syllable coordinate SPLITS what the dict "
          "conflated — semirhyme's coda claim rides the anchor while "
          "light rhyme's rides the written-out final syllable, so only "
          "the first composes into rime riche's transitive chain",
          ("coda", "anchor", "Agree") in traits["semirhyme"]["claims"]
          and ("coda", "final", "Agree") in traits["light rhyme"]["claims"]
          and ("coda", "anchor", "Agree")
          not in traits["light rhyme"]["claims"],
          f"semirhyme {traits['semirhyme']}, "
          f"light {traits['light rhyme']}")

    # M-123's derivation pins: a Differ claim is a disequality clique, a
    # clique needs one distinct value per member, and the adopted
    # CHANNEL_DOMAINS table is what tells the gate a channel is finite.
    check("M-123: the adopted domain table says prominence is BINARY and "
          "nucleus is the 15-vowel inventory (measured over all 126,052 "
          "syllabifiable lexicon words; the eng adapter constructs "
          "prominence as `1 if stress in (1,2) else 0`), and light rhyme "
          "carries the prominence-Differ claim that caps its groups at 2",
          len(RL.CHANNEL_DOMAINS["prominence"]) == 2
          and len(RL.CHANNEL_DOMAINS["nucleus"]) == 15
          and ("prominence", "final", "Differ")
          in traits["light rhyme"]["claims"],
          f"domains {[(k, len(v)) for k, v in RL.CHANNEL_DOMAINS.items()]}")
    check("M-123's second face: `PresentVsAbsent` IS a Differ on a "
          "presence bit — subtractive rhyme's claims carry the derived "
          "(coda_presence, anchor, Differ) with a binary domain, and a "
          "coda-Agree schema projects the Agree edge onto the same "
          "derived channel so the parity closure can see equal codas "
          "contradict a presence split",
          ("coda_presence", "anchor", "Differ")
          in traits["subtractive rhyme"]["claims"]
          and ("coda_presence", "anchor", "Agree")
          in traits["monorhyme / leash"]["claims"]
          and len(RL.CHANNEL_DOMAINS["coda_presence"]) == 2,
          f"subtractive {traits['subtractive rhyme']['claims']}")
    check("M-125: span LENGTH is a hidden equality channel and the "
          "schema's own `unmatched` coordinate declares it — perfect "
          "rhyme and rime riche (forbid) claim length-Agree at the ends, "
          "semirhyme (require_b) claims length-Differ, so the "
          "Equal-Equal-Differ triangle {perfect 13~14, rime riche 13~17, "
          "semirhyme 14~17} that no words can close is caught by the "
          "existing closure with no new machinery",
          ("span_length", "end", "Agree")
          in traits["perfect rhyme"]["claims"]
          and ("span_length", "end", "Agree")
          in traits["rime riche"]["claims"]
          and ("span_length", "end", "Differ")
          in traits["semirhyme"]["claims"]
          and not any(c[0] == "span_length"
                      for c in traits["assonance"]["claims"]),
          f"semirhyme {traits['semirhyme']['claims']}")
    from quality import floor as FLR
    _aprof = next(p for p in FLR.PROFILES if p.n_lines == 0)
    _amax = FLR.FloorDeclaration().resolve("anaphora_max", _aprof)
    check("M-125(b): the forced-opener ceiling is READ from the floor's "
          "own lyric-sheet profile (n_lines == 0, never by name — the "
          "M-106 idiom), so the gate and ANAPHORA_OVERLOAD cannot hold "
          "two thresholds",
          _amax is not None and 0 < _amax < 1, _amax)
    from quality import phonology as PHON
    _eng = PHON.get("eng")
    _pvals = {s.prominence for w in ("spring", "raining", "carpenter",
                                     "understand", "overflow", "tell")
              for s in _eng.syllabify(w)}
    check("M-123: the phonology the judge grades through emits prominence "
          "values from exactly the adopted domain — a probe over stressed "
          "and unstressed syllables reaches both values and nothing else",
          _pvals == set(RL.CHANNEL_DOMAINS["prominence"]), _pvals)

    def _pfind(par, x):
        p = 0
        while True:
            nx, xp = par.get(x, (x, 0))
            if nx == x:
                return x, p
            x, p = nx, p ^ xp

    n_adj = n_pair = n_trans = n_over = n_parity = n_open = 0
    for sd in (4, 7, 11, 19, 23, 31):
        p3 = PLN.make_plan(sd)
        r3 = p3.get("relations") or {}
        gl3 = [tuple(sorted({int(str(m).split(".")[0])
                             for m in g.split(",")}))
               for g in p3["groups"].split(";")]
        pairc = {}
        eqp = {}
        nep = {}
        for gi, g in enumerate(gl3):
            nm = r3.get(PLN.SC.label((gi,)))
            if not nm:
                continue
            t = traits[nm.split(":", 1)[1]]
            pairs = list(combinations(g, 2))
            if t["gap"] is not None and any(
                    b - a > t["gap"] for a, b in pairs):
                n_adj += 1
            for ch, co, pred in t["claims"]:
                dom = RL.CHANNEL_DOMAINS.get(ch)
                if pred == "Differ" and dom is not None \
                        and len(g) > len(dom):
                    n_over += 1
                for p in pairs:
                    if pairc.get((p, ch, co)) not in (None, pred):
                        n_pair += 1
                    pairc[(p, ch, co)] = pred
                key = (ch, co)
                binary = dom is not None and len(dom) == 2
                if pred == "Agree" or (pred == "Differ" and binary):
                    w = 0 if pred == "Agree" else 1
                    par = eqp.setdefault(key, {})
                    for a, b in pairs:
                        ra, pa = _pfind(par, a)
                        rb, pb = _pfind(par, b)
                        if ra == rb:
                            if pa ^ pb != w:
                                n_parity += 1
                        else:
                            par[ra] = (rb, pa ^ pb ^ w)
                elif pred == "Differ":
                    nep.setdefault(key, []).extend(pairs)
        for key, ne in nep.items():
            par = eqp.get(key, {})
            for a, b in ne:
                ra, pa = _pfind(par, a)
                rb, pb = _pfind(par, b)
                if ra == rb and not (pa ^ pb):
                    n_trans += 1
        par = eqp.get(("token", "head"), {})
        _nodes = set(par) | {pp[0] for pp in par.values()}
        _szs = {}
        for _n in _nodes:
            _r, _ = _pfind(par, _n)
            _szs[_r] = _szs.get(_r, 0) + 1
        _cap = int(_amax * int(p3["total_lines"]) + 1e-9)
        if _szs and max(_szs.values()) > _cap:
            n_open += 1
    check("no drawn conjunction violates a schema's own gap ceiling, puts "
          "opposite predicates on one (pair, channel, coordinate), closes "
          "an equality chain a Differ claim demands open, outnumbers a "
          "finite channel domain, forces a parity cycle on a binary one, "
          "or forces more identical line-openers than the floor's own "
          "ANAPHORA_OVERLOAD share admits — the measured 39-of-40 "
          "(M-118), 53-of-60 (M-122: 117 adjacency, 32 transitive), "
          "40-of-60 (M-123: 74 impossible prominence cliques) and M-125 "
          "(seed 32's forced 9-of-21 openers and its length triangle) "
          "defects all read ZERO through the gate",
          n_adj == 0 and n_pair == 0 and n_trans == 0
          and n_over == 0 and n_parity == 0 and n_open == 0,
          f"adjacency {n_adj}, pairwise {n_pair}, transitive {n_trans}, "
          f"oversize {n_over}, parity {n_parity}, opener {n_open} over "
          f"six seeds")

    # M-149(a): THE DRAW CONSULTS THE SPAN SHAPE. A group binding declared
    # tokens is judged by the pair route (`relations.pair_satisfies`), and
    # that route refuses by name every schema whose member spans cannot
    # bind ONE token — so drawing one onto a slotted group manufactures a
    # disclosed refusal no writing can close. MEASURED before the filter:
    # 354 such (draw, placement) conjunctions over seeds 1-60, every seed
    # affected. The draw consults the judge's own predicate
    # (`relations.pair_bindable`, one definition — doctrine 1), so the
    # conjunction is unsampleable BY CONSTRUCTION; the mutation is
    # dropping the `_slotted_g` filter in `plan.py`, which reds the sweep
    # check below (hand-proven on the day it shipped).
    unbindable = tuple(n for n in RL.DRAWABLE_SCHEMAS
                       if not RL.pair_bindable(RL.REGISTRY[n]))
    check("the pair-unbindable subset of the drawable pool is DERIVED "
          "from the registry's own span rules and is exactly the four "
          "shapes the pair judge refuses by name — free_run's three "
          "searchers and monai's head index",
          unbindable == ("chain rhyme (rap)", "compound / phrasal rhyme",
                         "monai", "multisyllabic rhyme"),
          f"{unbindable}")
    leaked = []
    for _seed in (1, 2, 7, 23, 37, 56):
        _pl = PLN.make_plan(_seed, form="verse-chorus")
        _rels = _pl.get("relations") or {}
        _gs = [g.split(",") for g in _pl["groups"].split(";")]
        for _gi, _g in enumerate(_gs):
            _want = _rels.get(PLN.SC.label((_gi,)), "")
            if not _want.startswith("schema:"):
                continue
            if not any("." in m and m.split(".", 1)[1] != "end"
                       for m in _g):
                continue
            if not RL.pair_bindable(RL.REGISTRY[_want[len("schema:"):]]):
                leaked.append((_seed, _g, _want))
    check("no slotted group draws a schema the pair route cannot bind "
          "there — six seeds (including the four that leaked most before "
          "the filter), zero conjunctions",
          not leaked, leaked[:4])
    check("...and the unbindable schemas STAY drawable at default slots — "
          "the filter narrows the slotted pool, it does not delete four "
          "names from the certified adoption",
          set(unbindable) <= set(RL.DRAWABLE_SCHEMAS))


def test_the_bound_share():
    """15. M-112 — THE MANDATE'S OWN WEIGHT ON A SECTION IS DISCLOSED.

    The series' third song cleared every gate with a chorus binding 23 of
    ~31 sung tokens, and the share was a number a session computed by hand
    (the private-instrument shape standing rule 3 ends). `bound_token_share`
    is that computation as a pure function of the plan, and the `plan` verb
    prints it. A DISCLOSURE, NOT A GATE — the ceiling needs a calibration
    the corpus cannot yet give — and the non-gate half is pinned by AST.
    """
    print("\n15. M-112 — the bound-token share is a pure disclosure")
    p = make_plan(2)
    shares = PLN.bound_token_share(p)
    order = list(dict.fromkeys(s["section"] for s in p["line_slots"]))
    check("every sung section instance appears exactly once, in plan order",
          [s["section"] for s in shares] == order,
          f"{len(shares)} section(s)")
    at = PLN.bound_placements(p)
    total = sum(len({real_word(x) for x in v}) for v in at.values())
    check("the numerators sum to the plan's own word-keyed binding count — "
          "the same `bound_placements` + `placement_word` reading every "
          "other consumer of the groups string uses (doctrine 1)",
          sum(s["bound"] for s in shares) == total, f"total {total}")
    sub = p["subdivision"]
    cap = {}
    for ls in p["line_slots"]:
        cap[ls["section"]] = cap.get(ls["section"], 0) + int(
            PLN.line_syllable_ceiling(float(ls["duration"]) * sub))
    check("each denominator is the sum of its lines' syllable ceilings — "
          "capacity, never a requirement (a sparse line is a slower line)",
          all(s["capacity"] == cap[s["section"]] for s in shares))
    # THE MUTATION, HAND-BUILT SO IT IS KILLABLE ON ANY SEED: a toy plan
    # whose line 1 carries `end` AND `endword` (one word between them) and
    # whose line 3 carries `head`, `headrime` AND `T1` (one word between
    # THEM — M-80's finding). Counting placement NAMES instead of WORDS
    # reads 3+1 and 3 where the honest counts are 2 and 1.
    toy = {"subdivision": 2,
           "line_slots": [
               {"section": "VERSE1", "function": "verse", "line": 1,
                "duration": 3.0},
               {"section": "VERSE1", "function": "verse", "line": 2,
                "duration": 3.0},
               {"section": "CHORUS1", "function": "chorus", "line": 3,
                "duration": 3.0}],
           "groups": "1,1.endword,2.T3;3.head,3.headrime,3.T1"}
    got = PLN.bound_token_share(toy)
    check("the numerator counts WORDS and not placement names — end+endword "
          "is one word, head+headrime+T1 is one word (M-80), so the toy "
          "reads 2/12 and 1/6 and a name-counting mutant reads 3 and 3",
          [(s["bound"], s["capacity"]) for s in got] == [(2, 12), (1, 6)],
          str([(s["bound"], s["capacity"]) for s in got]))
    # A DISCLOSURE, NOT A GATE, pinned rather than remembered: `make_plan`
    # never calls it, so no share can refuse a plan.
    import inspect as _ins
    tree = ast.parse(_ins.getsource(PLN.make_plan))
    calls = {n.func.attr if isinstance(n.func, ast.Attribute)
             else getattr(n.func, "id", "")
             for n in ast.walk(tree) if isinstance(n, ast.Call)}
    check("`make_plan` does not consult `bound_token_share` — the share "
          "gates nothing, by design, until a calibration exists "
          "(the entry's own accounting; doctrine 22 for the future gate)",
          "bound_token_share" not in calls)


def test_the_grade_it_line_runs():
    """16. M-58 ITEM 4 — THE ONE COMMAND THE PLANNER PRINTS MUST RUN.

    On the plan-first path `--out=` writes a PLAN and `song` reads a
    BLUEPRINT, so the old single `GRADE IT:` line named a file `song`
    refuses — the planner telling a writer to run a command that cannot
    run. The verb prints the honest TWO-STEP instruction there now (fill
    first — the same plan invocation, since a plan is a pure function of
    its seed — then grade against the blueprint that run writes), and
    the fill path keeps the single line.
    """
    print("\n16. M-58 — the printed GRADE IT runs on both paths")
    import subprocess
    r = subprocess.run(
        [sys.executable, "lyric_harness.py", "plan", "--seed=7"],
        capture_output=True, text=True,
        cwd=os.path.join(HERE, ".."), timeout=560)
    out = r.stdout
    check("the plan-first path prints TWO STEPS and says why — the file "
          "--out wrote is a PLAN and `song` reads a BLUEPRINT",
          r.returncode == 0 and "TWO STEPS" in out
          and "is a PLAN" in out, f"rc {r.returncode}")
    check("...step 1 is the SAME plan invocation plus --fill/--out, so "
          "it re-derives the identical plan (a plan is a pure function "
          "of its seed) and writes the blueprint step 2 grades against",
          "plan --seed=7 --form=verse-chorus --fill=DRAFT.txt "
          "--out=BP.json" in out)
    check("...and step 2 is the grading command against BP.json, which "
          "step 1 actually writes",
          "song BP.json DRAFT.txt" in out)
    with tempfile.TemporaryDirectory() as td:
        import json as _json
        p = make_plan(7)
        draft = os.path.join(td, "d.txt")
        with open(draft, "w", encoding="utf-8") as fh:
            fh.write("\n".join("word " * 5 for _ in
                               range(p["total_lines"])))
        r2 = subprocess.run(
            [sys.executable, "lyric_harness.py", "plan", "--seed=7",
             f"--fill={draft}", f"--out={os.path.join(td, 'bp.json')}"],
            capture_output=True, text=True,
        cwd=os.path.join(HERE, ".."), timeout=560)
        check("the FILL path keeps the single GRADE IT line, naming the "
              "blueprint that run just wrote — one step because one step "
              "is true there",
              r2.returncode == 0 and "GRADE IT: " in r2.stdout
              and "TWO STEPS" not in r2.stdout, f"rc {r2.returncode}")


def test_the_overhang_group():
    """17. M-174 — a schema that demands an overhang ORDERS its group, so on
    three members it contradicts itself at every line length."""
    print("\n17. M-174 — an overhang schema on 3+ members contradicts "
          "itself, and the draw may not reach one")
    SEMI = RL.REGISTRY["semirhyme"]
    check("the registry's own coordinate is what says so — semirhyme "
          "demands member 2 overhang, and it is the ONE drawable schema "
          "that demands an overhang at all",
          RL.overhang_member(SEMI) == 2
          and [n for n in RL.DRAWABLE_SCHEMAS
               if RL.overhang_member(RL.REGISTRY[n]) is not None]
          == ["semirhyme"])
    check("a PAIR is satisfiable and 3+ members are not, by the count the "
          "gate and the draw both read — C(k-1, 2), so 0 / 1 / 3 / 6 at "
          "k = 2 / 3 / 4 / 5",
          [RL.unsatisfiable_pairs(SEMI, k) for k in (2, 3, 4, 5)]
          == [0, 1, 3, 6]
          and RL.group_satisfiable(SEMI, 2)
          and not RL.group_satisfiable(SEMI, 3),
          [RL.unsatisfiable_pairs(SEMI, k) for k in (2, 3, 4, 5)])
    check("a schema with NO overhang demand is unbounded — the count is "
          "about `unmatched` and not about group size, so consonance over "
          "nine members is 0 (the control that stops this reading as a "
          "cap on every group)",
          RL.unsatisfiable_pairs(RL.REGISTRY["consonance"], 9) == 0
          and RL.group_satisfiable(RL.REGISTRY["consonance"], 9))
    #: THE POPULATION FIRST, so this section cannot pass by examining
    #: nothing (the vacuity defect this suite's own §4 exists for): the
    #: draw must still REACH semirhyme, or "no impossible group" would be
    #: true of a planner that had simply deleted the schema.
    seen, bad, sizes = 0, [], {}
    for seed in range(1, 41):
        pl = PLN.make_plan(seed)
        rel = pl.get("relations") or {}
        groups = [g for g in str(pl.get("groups") or "").split(";")
                  if g.strip()]
        for gi, g in enumerate(groups):
            nm = rel.get(SC.label((gi,)), "")
            if not nm.startswith("schema:"):
                continue
            s = RL.REGISTRY.get(nm.split(":", 1)[1])
            if s is None or RL.overhang_member(s) is None:
                continue
            seen += 1
            k = len([m for m in g.split(",") if m.strip()])
            sizes[k] = sizes.get(k, 0) + 1
            if k >= 3:
                bad.append((seed, SC.label((gi,)), k))
    check("the draw still REACHES the schema — it is narrowed to pairs, "
          "not deleted from the vocabulary (doctrine 24: a rule that "
          "would remove a category relabels instead)",
          seen > 0, f"{seen} overhang group(s) over seeds 1-40")
    check("...and every one of them is a PAIR: no seed draws a group its "
          "own declared schema contradicts",
          not bad and set(sizes) == {2},
          f"sizes {dict(sorted(sizes.items()))}, impossible {bad[:4]}")
    #: AND THE GATE IS TWO-SIDED — a PLANTED impossible group must fire it,
    #: or "0 findings" is a check that cannot fail.
    pl = PLN.make_plan(3)
    check("a clean plan earns no joint finding at all", not PLN.joint_findings(pl))
    gs = [g for g in str(pl["groups"]).split(";") if g.strip()]
    idx = next(i for i, g in enumerate(gs)
               if len([m for m in g.split(",") if m.strip()]) >= 3)
    mut = dict(pl)
    mut["relations"] = dict(pl.get("relations") or {})
    mut["relations"][SC.label((idx,))] = "schema:semirhyme"
    fired = [f for f in PLN.joint_findings(mut)
             if f[0] == "GROUP_CONTRADICTS_ITSELF"]
    check("the MUTATION fires the gate, on the group's own first line, "
          "naming the members and how many pairs are impossible — a "
          "hand-written plan is refused on the same terms as a drawn one",
          len(fired) == 1 and "semirhyme" in fired[0][2]
          and "pairs fail at any line length" in fired[0][2],
          fired[0][2][:90] if fired else "did not fire")
    check("`GROUP_CONTRADICTS_ITSELF` is a declared JOINT code, so "
          "`make_plan` refuses on it like every other cause",
          "GROUP_CONTRADICTS_ITSELF" in PLN.JOINT_CODES)
    #: M-175, the same family one layer out: the contradiction is not inside
    #: the group, it is between the MANDATE and the FLOOR.
    check("`anaphora` is the one drawable schema whose identity rule "
          "demands the SAME TOKEN — read off `identity`, never off the "
          "name, and `consonance` is the control that does not",
          RL.identity_forced(RL.REGISTRY["anaphora"])
          and not RL.identity_forced(RL.REGISTRY["consonance"])
          and [n for n in RL.DRAWABLE_SCHEMAS
               if RL.identity_forced(RL.REGISTRY[n])] == ["anaphora"])
    ends = 0
    for seed in range(1, 41):
        pl2 = PLN.make_plan(seed)
        rel2 = pl2.get("relations") or {}
        for gi, g in enumerate([x for x in str(pl2.get("groups") or "")
                                .split(";") if x.strip()]):
            nm = rel2.get(SC.label((gi,)), "")
            if not nm.startswith("schema:"):
                continue
            s2 = RL.REGISTRY.get(nm.split(":", 1)[1])
            if s2 is None or not RL.identity_forced(s2):
                continue
            if sum(1 for m in g.split(",")
                   if (m.strip().split(".", 1)[1] if "." in m else "end")
                   in ("end", "endword")) >= 2:
                ends += 1
    check("no seed binds a same-token schema at two line ENDS — satisfying "
          "one means both lines end on the same word, which "
          "`floor.REPEAT_IN_VERSE` flags on a layer that never reads the "
          "mandate, so the only legal answer trips another gate",
          ends == 0, f"{ends} such group(s) over seeds 1-40")
    gs2 = [g for g in str(pl["groups"]).split(";") if g.strip()]
    idx2 = next(i for i, g in enumerate(gs2)
                if sum(1 for m in g.split(",")
                       if (m.strip().split(".", 1)[1] if "." in m else "end")
                       in ("end", "endword")) >= 2)
    mut2 = dict(pl)
    mut2["relations"] = dict(pl.get("relations") or {})
    mut2["relations"][SC.label((idx2,))] = "schema:anaphora"
    fired2 = [f for f in PLN.joint_findings(mut2)
              if f[0] == "IDENTITY_AT_TWO_LINE_ENDS"]
    check("...and the MUTATION fires that gate too, naming the line-final "
          "slots and pointing at `epistrophe / radif`, which is this "
          "registry's own name for the same word ending two lines",
          len(fired2) == 1 and "epistrophe" in fired2[0][2]
          and "IDENTITY_AT_TWO_LINE_ENDS" in PLN.JOINT_CODES,
          fired2[0][2][:80] if fired2 else "did not fire")


def test_the_placement_route(FAILURES=None):
    """18. M-206 — a schema whose PLACEMENT rule two line ends cannot satisfy
    is unwritable on an all-default group, and the draw may not reach one."""
    print("\n18. M-206 — the placement rule and the group's own slots, and "
          "the two routes that read them differently")
    IR = RL.REGISTRY["internal rhyme"]
    # ===================================================================
    # FOUND BY WRITING A SONG. Seed 3014's group H bound L5's end word to
    # L11's, under a drawn `schema:internal rhyme`, and `internal rhyme`
    # declares `Placement("both_line_final", polarity=False)` — at least one
    # member NOT line-final. The loop briefed L11 with an EMPTY candidate
    # field ("the mandate, not the lexicon, is the binding constraint here")
    # and no word in English could have closed it, because the defect is the
    # PLACEMENT and not the word.
    # ===================================================================
    check("the registry is what says so — 4 of the drawable schemas declare "
          "a placement rule a pair of LINE ENDS cannot satisfy, and they are "
          "the negated `both_line_final`, the two `both_line_initial` and "
          "the `neither_line_final` one",
          sorted(n for n in RL.DRAWABLE_SCHEMAS
                 if not RL.placement_bindable(RL.REGISTRY[n], ("end", "end")))
          == ["anaphora", "head rhyme (positional)", "interlaced rhyme",
              "internal rhyme"])
    check("...and the predicate is not a blanket refusal — the SAME four "
          "answer True at the placements their own definitions name, and "
          "`internal rhyme` is bindable at an internal slot, which is the "
          "whole reason it stays drawable",
          RL.placement_bindable(IR, ("internal", "end"))
          and RL.placement_bindable(RL.REGISTRY["anaphora"],
                                    ("head", "head"))
          and RL.placement_bindable(RL.REGISTRY["perfect rhyme"],
                                    ("end", "end")))
    check("a schema with NO position-kind placement rule is admitted "
          "everywhere — the control that stops this reading as a cap on "
          "every group",
          RL.placement_bindable(
              RL.REGISTRY["cluster consonance / skothending span"],
              ("end", "end"))
          and RL.placement_bindable(
              RL.REGISTRY["cluster consonance / skothending span"],
              ("head", "internal")))

    # THE DRAW AND THE GATE ASK ONE QUESTION ONE WAY (doctrine 1). The
    # helper reads `slots.is_default`, and the three spellings this repair's
    # own first draft used disagreed: `<line>.end` IS the default slot and
    # `<line>.endword` is NOT (it anchors at `word_start`), so a hand-written
    # `!= "end"` and an `in ("end", "endword")` refused 7 of 120 seeds
    # between them.
    check("`slots.is_default_spelling` is `is_default` in the module that "
          "owns the spelling, and not a hand-written test of it — a bare "
          "int and `N.end` are default, `N.endword`, `N.head` and `N.T4` "
          "are not, and the draw and the gate both ask IT",
          [SL.is_default_spelling(m)
           for m in (5, "5", "5.end", "5.endword", "5.head", "5.T4")]
          == [True, True, True, False, False, False]
          and "_SL.is_default_spelling" in open(
              os.path.join(os.path.dirname(PLN.__file__), "plan.py"),
              encoding="utf-8").read())

    seeds = list(range(1, 61))
    plans = {}
    for sd in seeds:
        try:
            plans[sd] = PLN.make_plan(seed=sd)
        except Exception:
            pass
    check("0 seeds are LOST to this filter — the bare default is always in "
          "the pool, so a group whose placements refuse every schema still "
          "draws a relation",
          len(plans) == len(seeds), f"{len(plans)} of {len(seeds)}")
    live = [(sd, f) for sd, pl in plans.items() for f in PLN.joint_findings(pl)
            if f[0] == "PLACEMENT_CONTRADICTS_SCHEMA"]
    check("...and 0 plans carry the finding, so the gate is satisfied BY "
          "CONSTRUCTION and a MUTATION is the only way to fire it",
          not live, live[:2])

    # THE MUTATION: the DRAW loses the filter, the GATE keeps it. Patching
    # `placement_bindable` alone would disable both (doctrine 1 working), so
    # the gate is stubbed out of `make_plan` and re-run afterwards on the
    # plans the mutant draw shipped.
    _pb, _jf = RL.placement_bindable, PLN.joint_findings
    RL.placement_bindable = lambda *a, **k: True
    PLN.joint_findings = lambda plan: []
    try:
        mut = {}
        for sd in seeds:
            try:
                mut[sd] = PLN.make_plan(seed=sd)
            except Exception:
                pass
    finally:
        RL.placement_bindable, PLN.joint_findings = _pb, _jf
    fired = {sd: [f for f in PLN.joint_findings(pl)
                  if f[0] == "PLACEMENT_CONTRADICTS_SCHEMA"]
             for sd, pl in mut.items()}
    hit = [sd for sd, fs in fired.items() if fs]
    check("the MUTATION fires it on most of the sweep — the pre-repair "
          "planner handed the writer a group no vocabulary can close on "
          "more than half of all seeds",
          len(hit) > len(mut) // 2,
          f"{len(hit)} of {len(mut)} seeds, "
          f"{sum(len(f) for f in fired.values())} finding(s)")
    ex = fired[hit[0]][0] if hit else None
    check("...and the finding names the schema, the members and the "
          "placement rule, and points at the declaration that WOULD work "
          "rather than refusing the figure",
          ex is not None and "schema:" in ex[2] and "DEFAULT slot" in ex[2]
          and "--groups=" in ex[2]
          and "PLACEMENT_CONTRADICTS_SCHEMA" in PLN.JOINT_CODES,
          (ex[2][:110] if ex else "did not fire"))


def test_the_delegated_rulings(FAILURES=None):
    print("\n14. THE 2026-09-01 RULINGS UNDER DELEGATION — the chorus recurs "
          "(M-190), the plan draws its own DENSITY (M-191), and three "
          "disclosures the writer reads (M-192)")
    # ===================================================================
    # The owner, 2026-09-01: "I leave the answers to your capable hands and
    # taste." Three planner rulings were taken under that delegation and
    # each is pinned here the way an owner's ruling is pinned elsewhere in
    # this suite — the table that carries it, the mutation that removes it,
    # and the measurement that says what moved.
    # ===================================================================
    import re as _re
    from quality import plan as _PL
    SEEDS = range(1, 41)
    plans = {k: make_plan(seed=k) for k in SEEDS}

    # ── M-190: a verse-chorus plan draws its chorus at least twice ──
    shipped = {k: [x["function"] for x in p["sections"]]
               for k, p in plans.items()}
    once = [k for k, fns in shipped.items() if fns.count("chorus") < 2]
    check("M-190: every verse-chorus plan draws its CHORUS at least twice — "
          "a chorus drawn once is a section with a chorus's name (grid.py: a "
          "hook is defined by RETURN, one occurrence is a phrase), and the "
          "two hook flags were unaskable on it; 6 of 16 banked songs "
          "finished at exit 0 with no chorus",
          once == [], f"seeds drawing one chorus: {once} over 1-40")
    check("...declared in a table the form names, so a second form can "
          "declare its own returner without touching the sampler",
          _PL.FORM_RECURS.get("verse-chorus") == ("chorus",),
          f"{_PL.FORM_RECURS}")
    check("...and every plan in the sweep now carries a hook slot — the "
          "consequence the ruling was for",
          all(p["hook_slot"] is not None and not p.get("hook_slot_refused")
              for p in plans.values()),
          f"{sum(1 for p in plans.values() if p['hook_slot'])}/{len(plans)}")
    # THE MUTATION HOLDS THE ENVELOPE STILL: `form_min_sections` reads
    # `FORM_RECURS` too (M-193 derives the fillable floor from it), so
    # clearing the table alone would move every seed's LENGTH draw and
    # the moved set would be every seed. The count is pinned at the
    # shipped 3 for the duration, so only the pattern rejection differs.
    saved = dict(_PL.FORM_RECURS)
    real_min = _PL.form_min_sections
    try:
        _PL.form_min_sections = lambda form: 3
        _PL.FORM_RECURS.clear()
        mutant = {k: [x["function"] for x in make_plan(seed=k)["sections"]]
                  for k in SEEDS}
    finally:
        _PL.FORM_RECURS.clear()
        _PL.FORM_RECURS.update(saved)
        _PL.form_min_sections = real_min
    m_once = [k for k, fns in mutant.items() if fns.count("chorus") < 2]
    moved = [k for k in SEEDS if mutant[k] != shipped[k]]
    check("...the MUTATION that empties the table brings the once-drawn "
          "chorus back, so the rule is READ",
          len(m_once) > 0, f"{len(m_once)} of 40 seeds draw one chorus "
          f"without the rule")
    check("...and EXACTLY the seeds whose first admissible pattern lacked a "
          "second chorus moved — rejection sampling leaves every accepted "
          "pattern byte-identical, so the rule costs no seed whose draw "
          "already recurred (measured 28 moved, 12 same)",
          set(moved) == set(m_once),
          f"moved {len(moved)}, same {len(SEEDS) - len(moved)}; "
          f"moved == once-drawn: {set(moved) == set(m_once)}")

    # ── M-191: the plan draws its own density cap ──
    caps = Counter(p["choices"]["density"]["binding_cap"]
                   for p in plans.values())
    ceilings = {k: _PL.line_binding_ceiling(_PL.plan_max_token(p))
                for k, p in plans.items()}
    check("M-191: every plan discloses a DENSITY cap, drawn uniform over "
          "1..the line-binding ceiling — 1 is the classic end-rhyme song "
          "with one web binding a line, the ceiling is the pre-ruling draw",
          all(1 <= p["choices"]["density"]["binding_cap"] <= ceilings[k]
              for k, p in plans.items())
          and 1 in caps and len(caps) >= 3,
          f"cap distribution over 1-40: {dict(sorted(caps.items()))}; "
          f"ceilings {sorted(set(ceilings.values()))}")
    check("...from a stream of its OWN, seeded on (seed, 'density'), so the "
          "main stream is undisturbed and the cap is a pure function of the "
          "seed",
          all(p["choices"]["density"]["binding_cap"]
              == random.Random(f"{k}:density").randint(1, ceilings[k])
              for k, p in plans.items()))
    bwpl = {k: _PL.SWEEP_MEASURES["bound_words_per_line"][1](p)
            for k, p in plans.items()}
    sparse = [k for k, v in bwpl.items() if v <= 1.5]
    check("...and the SPARSE band M-181's five songs occupy (M-181, wording struck M-238: "
          "<= 1.5 bound words a line) is REACHABLE — `plan --sweep=1-100 "
          "--want=bound_words_per_line<=1.5` accepted 0 of 99 before the "
          "ruling and 26 after",
          len(sparse) > 0, f"{len(sparse)} of 40 seeds at <= 1.5: "
          f"{sparse[:8]}")
    by_cap = {}
    for k, p in plans.items():
        by_cap.setdefault(p["choices"]["density"]["binding_cap"], []).append(bwpl[k])
    means = {c: sum(v) / len(v) for c, v in by_cap.items()}
    check("...the cap MOVES the density it names: mean bound words a line "
          "is lower at cap 1 than at the ceiling (measured 1.23 / 1.61 / "
          "1.93 / 2.22 at caps 1-4 over seeds 1-100)",
          means[min(means)] < means[max(means)],
          f"mean bound_words_per_line by cap: "
          f"{ {c: round(m, 2) for c, m in sorted(means.items())} }")
    check("...and the sweep can ASK for it by name — `binding_cap` reads the "
          "plan's own coordinate, so a writer selects the classic shape by "
          "declaring it rather than by re-rolling",
          all(_PL.SWEEP_MEASURES["binding_cap"][1](p)
              == p["choices"]["density"]["binding_cap"]
              for p in plans.values())
          and "binding_cap" in _PL.SWEEP_MEASURES)

    # ── M-192: three disclosures ──
    aud = {n: RL.audible_as_end_rhyme(RL.REGISTRY[n])
           for n in ("perfect rhyme", "rime riche", "consonance",
                     "assonance", "anaphora")
           if n in RL.REGISTRY}
    check("M-192: `audible_as_end_rhyme` is DERIVED from the registry — both "
          "spans at the line-final token and nucleus AND coda required to "
          "agree — so perfect rhyme and rime riche are heard as end rhyme "
          "and consonance, assonance and anaphora are not",
          aud.get("perfect rhyme") is True and aud.get("rime riche") is True
          and aud.get("consonance") is False and aud.get("assonance") is False
          and aud.get("anaphora") is False, f"{aud}")
    drawable_aud = [n for n in RL.DRAWABLE_SCHEMAS
                    if RL.audible_as_end_rhyme(RL.REGISTRY[n])]
    check("...and the drawable pool holds BOTH kinds, which is why the "
          "disclosure is not vacuous: the dice can put an inaudible relation "
          "on a line end",
          0 < len(drawable_aud) < len(RL.DRAWABLE_SCHEMAS),
          f"{len(drawable_aud)} of {len(RL.DRAWABLE_SCHEMAS)} drawable "
          f"schemas audible as end rhyme: {drawable_aud}")
    parts_ok = all(
        p["choices"]["audible"] == _PL.audible_share(p)
        and p["choices"]["audible"]["audible"]
        + p["choices"]["audible"]["bare"]
        + len(p["choices"]["audible"]["inaudible"])
        == p["choices"]["audible"]["end_bound"]
        for p in plans.values())
    check("...every plan discloses its end-bound groups PARTITIONED — "
          "audible / bare default / inaudible — and the partition is a pure "
          "function of the emitted plan, never summed past itself "
          "(doctrine 79)",
          parts_ok and any(p["choices"]["audible"]["inaudible"]
                           for p in plans.values())
          and any(p["choices"]["audible"]["audible"] > 0
                  for p in plans.values()))
    legend_ok, cap_ok, headers_ok = True, True, True
    for k, p in plans.items():
        brief = p["writer_brief"]
        plcs = {m.strip().split(".", 1)[1]
                for g in p["groups"].split(";") for m in g.split(",")
                if "." in m}
        names = {v.split(":", 1)[1] for v in (p.get("relations") or {}).values()}
        if plcs:
            legend_ok = legend_ok and "Where a binding sits" in brief and all(
                f"  {pl}: " in brief for pl in plcs)
        if names:
            legend_ok = legend_ok and "What each named relation asks" in brief
            for nm in names:
                sch = RL.REGISTRY.get(nm)
                if sch is None:
                    continue
                legend_ok = legend_ok and f"  {nm}" in brief
                if not RL.audible_as_end_rhyme(sch):
                    legend_ok = legend_ok and "NOT heard as end rhyme" in brief
        lines_b = brief.splitlines()
        hdr = [i for i, l in enumerate(lines_b)
               if _re.match(r"^  \[[A-Z]", l) and l.rstrip().endswith("]")]
        headers_ok = headers_ok and len(hdr) == len(p["sections"])
        for i, sec in zip(hdr, p["sections"]):
            slots = [s for s in p["line_slots"] if s["section"] == sec["name"]]
            headers_ok = headers_ok and "syllable" not in lines_b[i]
            if not slots:
                continue
            capn = int(_PL.line_syllable_ceiling(
                slots[0]["duration"] * p["subdivision"]))
            exp = (f"      up to {capn} syllables a line after the pickup; "
                   f"the calibrated band asks at least "
                   f"{MB.ADOPTED['DENSITY'][0]}")
            cap_ok = cap_ok and lines_b[i + 1] == exp
    check("...the brief carries a LEGEND: every place a group names and "
          "every relation it draws is glossed, derived from the slot "
          "vocabulary and the registry, with an inaudible relation saying "
          "so — the brief used to name `T5`, `headrime` and `Scots "
          "vowel-length rhyme` with no gloss anywhere a writer could reach",
          legend_ok)
    check("...and the number SLOTS_EXCEEDED grades against is printed UNDER "
          "every sung section's bracket — the ceiling of syllables a line "
          "after the pickup beside the band's floor — and never INSIDE it: "
          "the bracket is the measurement carrier every gate reads byte for "
          "byte (M-97)",
          cap_ok and headers_ok)

    # ── M-193: the envelope is what the FORM can fill ──
    need = _PL.form_min_sections("verse-chorus")
    fill = _PL.fillable_line_counts("verse-chorus")
    grade = _PL.song_line_counts()
    check("M-193: the form's minimum section count is DERIVED from its two "
          "tables — verse once, chorus twice — and not typed",
          need == 3, f"{need}")
    check("...the planner's line envelope is the gradeable set restricted "
          "to totals whose stanza-sized cell ceiling can hold that many "
          "sections, so a total the pattern draw would reject on every "
          "attempt is never drawn: the short profile (M-193) took the "
          "gradeable set to 6 lines and the fillable floor is 12",
          fill <= grade and min(fill) == 12 and min(grade) == 6
          and all(max(1, t // _PL.stanza_line_floor()) >= need for t in fill)
          and ENVELOPE["total_lines"] == (min(fill), max(fill)),
          f"gradeable {min(grade)}..{max(grade)}, fillable {min(fill)}.."
          f"{max(fill)} ({len(fill)} values), envelope "
          f"{ENVELOPE['total_lines']}")
    check("...and every plan in the sweep drew a fillable total",
          all(p["total_lines"] in fill for p in plans.values()),
          f"totals {sorted(set(p['total_lines'] for p in plans.values()))}")


def test_the_legend_states_the_whole_schema():
    print("\n19. M-214 — the legend's 'what each named relation asks' is "
          "derived from EVERY channel rule, the unmatched coordinate and "
          "the identity rule, not only Agree/Differ: come~some, bell~tell "
          "and light~my were written from the old legend and all VIOLATE")
    from quality import relations as _RLt
    asks = {nm: "; ".join(PLN.schema_asks(_RLt.REGISTRY[nm])) for nm in (
        "subtractive rhyme", "semirhyme", "family rhyme", "perfect rhyme",
        "rime riche", "light rhyme", "anaphora")}
    check("subtractive rhyme says the coda is PRESENT on one word and ABSENT "
          "on the other — the old legend said only 'agree on nucleus'",
          "coda present on the first word and absent on the second"
          in asks["subtractive rhyme"], asks["subtractive rhyme"])
    check("semirhyme says the second word carries an extra syllable after "
          "the rhyme — the whole relation, and the old legend omitted it",
          "second word carries an extra syllable" in asks["semirhyme"]
          and "agree on nucleus, coda" in asks["semirhyme"], asks["semirhyme"])
    check("family rhyme says the coda agrees by CLASS, not sound",
          "coda agree by CLASS, not sound" in asks["family rhyme"],
          asks["family rhyme"])
    check("perfect rhyme no longer contradicts itself: the two onset rules "
          "carry their scopes, and it says neither word runs on",
          "onset (after the stressed syllable)" in asks["perfect rhyme"]
          and "differ on onset (at the stressed syllable)"
          in asks["perfect rhyme"]
          and "neither word runs on past the rhyme" in asks["perfect rhyme"]
          and "agree on nucleus, coda, onset;" not in asks["perfect rhyme"],
          asks["perfect rhyme"])
    check("rime riche says 'different words' — the identity rule is what "
          "separates it from repetition",
          "different words" in asks["rime riche"], asks["rime riche"])
    check("anaphora says 'the same word'",
          "the same word" in asks["anaphora"], asks["anaphora"])
    check("light rhyme still says 'differ on prominence' — the Agree/Differ "
          "half is unchanged",
          "differ on prominence" in asks["light rhyme"], asks["light rhyme"])
    # THE LEGEND ITSELF CARRIES THEM, through `brief_legend`.
    fake = {"groups": "1,2;3.T2,4", "relations": {"A": "schema:semirhyme",
                                                  "B": "schema:subtractive rhyme"}}
    leg = "\n".join(PLN.brief_legend(fake))
    check("brief_legend renders the derived clauses on the relation's own "
          "line, after the legend header",
          "What each named relation asks" in leg
          and "  semirhyme: the bound words agree on nucleus, coda; the "
              "second word carries an extra syllable" in leg
          and "  subtractive rhyme: the bound words agree on nucleus; coda "
              "present on the first word" in leg, leg)


if __name__ == "__main__":
    for fn in (test_the_planner_plans_the_whole_line,
               test_determinism, test_refusals, test_the_round_trip,
               test_the_measure, test_the_disclosure,
               test_the_rendering, test_the_writers_declaration,
               test_the_form_is_read, test_the_joint_gate,
               test_the_seed_sweep_is_a_verb,
               test_the_song_length_is_the_songs_own,
               test_the_end_rhyme_pass_is_additive,
               test_the_relation_draw, test_the_bound_share,
               test_the_grade_it_line_runs, test_the_overhang_group,
               test_the_placement_route,
               test_the_delegated_rulings,
               test_the_legend_states_the_whole_schema):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the planning phase plans, the graders accept what it plans, "
          "and the dice are uniform over derived spaces")

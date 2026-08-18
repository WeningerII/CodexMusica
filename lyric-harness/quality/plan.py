#!/usr/bin/env python3
"""The PLANNING phase: a song request in, a blueprint and a mandate out.

WHAT THIS IS. The front half of the songwriter — the phase CLAUDE.md's
standing rule §2 records as the hole. It takes a REQUEST (a form, an optional
length, a declared seed) and produces the two artifacts every downstream layer
already demands: a blueprint (sections, bars, meters, line slots) and a
mandate (groups, returns, subdivision), plus a writer brief in the same shape
the coverage experiment's blind seeds used. It writes NO WORDS: the writer is
outside the harness (CLAUDE.md, first page), and the plan's line slots are
empty on purpose.

GENERATED FROM THE MATH, NOT COPIED FROM EXAMPLES. Structure comes from a
DECLARED pattern grammar; rhyme schemes come from `quality.schemes.rgs` — the
enumeration of every scheme over k lines — under a declared constraint and a
declared seed; meters come from a declared cycle set. The corpus's job is in
`quality/test_plan.py`: the plan language must be able to EXPRESS real song
shapes (Open Sign's 22-line form is the fixture), which is a coverage claim,
not a lookup table.

EVERY FREE CHOICE IS SEEDED AND DISCLOSED. Doctrine 66: a tie broken by
nothing is a tie broken by the hash seed, and it does not reproduce. The
request therefore REQUIRES a seed whenever any choice is free, the same
`random.Random(seed)` drives every pick, and the emitted plan echoes each
choice BESIDE the set it was chosen from — so two people holding the same
request produce byte-identical plans, and a reader can see what else the plan
could have been.

REFUSALS, NOT DEFAULTS (doctrine 20). An unknown form is refused by name with
the declared forms listed. A length no declared pattern can reach is refused
with every attainable total named. `ghazal` is refused BY NAME for a stated
mechanical reason: a ghazal's radif is a LICENSED repeat, the licence is
`ReviseDeclaration.repeat_licence`, and no CLI flag declares it — emitting a
plan the CLI cannot grade would be a plan wearing a verdict it cannot earn.
The refusal names the missing flag so the next session builds the flag, not a
workaround.

Run:  python3 lyric_harness.py plan --seed=N [--form=verse-chorus]
                                    [--lines=N] [--fill=DRAFT] [--out=PATH]
Test: python3 quality/test_plan.py
"""

import json
import random

from quality import schemes as SC

__all__ = ["PLAN_FORMS", "SECTION_PATTERNS", "LINES_PER_FUNCTION",
           "METER_SET", "BARS_PER_LINE", "PLAN_SUBDIVISION", "PlanRefused",
           "make_plan", "fill_plan", "writer_brief", "attainable_totals"]


class PlanRefused(ValueError):
    """A request the planner will not guess around. Message is the verdict."""


#: The declared forms. ONE for now, plus a named refusal — `ghazal` is listed
#: so the refusal can say "declared but blocked" instead of "unknown", which
#: are different answers (doctrine 28).
PLAN_FORMS = ("verse-chorus",)
BLOCKED_FORMS = {
    "ghazal": ("a ghazal's radif is a LICENSED repeat "
               "(ReviseDeclaration.repeat_licence='refrain'), and no CLI "
               "flag declares that licence — measured 2026-08-17 on a real "
               "ghazal: 15 SCHEME_VIOLATIONs at the default and 0 at "
               "'refrain', the finding unmoved in both. A plan the CLI "
               "cannot grade honestly is refused, and the fix is the flag, "
               "not a workaround."),
}

#: The section-pattern grammar: every declared way this planner lays out
#: functions. A pattern is a tuple of section FUNCTIONS in order; the legal
#: function names are the ones `quality/grid.py`'s blueprint reader accepts.
SECTION_PATTERNS = (
    ("VC",     ("verse", "chorus")),
    ("VCVC",   ("verse", "chorus", "verse", "chorus")),
    ("VCVCBC", ("verse", "chorus", "verse", "chorus", "bridge", "chorus")),
    ("IVCVCO", ("intro", "verse", "chorus", "verse", "chorus", "outro")),
    ("IVCVCBCO", ("intro", "verse", "chorus", "verse", "chorus", "bridge",
                  "chorus", "outro")),
)

#: Lines each function carries — a declared constant of the grammar, not a
#: measurement. Changing a value here changes every attainable total, and
#: `attainable_totals()` derives from THIS table so the refusal below can
#: never drift from it (doctrine 91: the table is the source, the message is
#: the rendering).
LINES_PER_FUNCTION = {"intro": 2, "verse": 4, "chorus": 4, "bridge": 2,
                      "outro": 2}

#: The declared meter set — cycles proven against the fit layer by this
#: repo's own fixtures. One meter per song in v1, chosen seeded.
METER_SET = (
    {"beats": 4, "unit": 4, "groups": [2, 2]},
    {"beats": 6, "unit": 8, "groups": [3, 3]},
    {"beats": 7, "unit": 8, "groups": [3, 2, 2]},
)

#: Two bars per line and an eighth-note grid: the layout every shipped
#: blueprint fixture uses. Constants of v1, DISCLOSED in every plan rather
#: than silently assumed — a reader of the plan sees them beside the choices.
BARS_PER_LINE = 2
PLAN_SUBDIVISION = 2


def attainable_totals():
    """-> {total_lines: [pattern names]}, derived from the two tables."""
    out = {}
    for name, funcs in SECTION_PATTERNS:
        total = sum(LINES_PER_FUNCTION[f] for f in funcs)
        out.setdefault(total, []).append(name)
    return out


def _schemes_for(k, rng):
    """One seeded scheme over k lines with >=1 group of >=2 members.

    Drawn from `schemes.rgs(k)` — the complete enumeration — under the one
    declared constraint that SOMETHING is mandated: an all-singleton scheme
    mandates no pair, and a plan whose section checks nothing is decoration
    (doctrine 48). The choice set's SIZE is returned too, so the plan can
    disclose what the pick was one of.
    """
    pool = [code for code in SC.rgs(k)
            if any(code.count(b) >= 2 for b in set(code))]
    return rng.choice(pool), len(pool)


def _abs_groups(code, first_line):
    """RGS code over a section -> absolute-numbered groups of >=2 lines."""
    blocks = {}
    for i, b in enumerate(code):
        blocks.setdefault(b, []).append(first_line + i)
    return [g for _, g in sorted(blocks.items()) if len(g) >= 2]


def make_plan(seed, form="verse-chorus", lines=None):
    """A request -> the plan dict. Refuses rather than guessing.

    `seed` is REQUIRED because the pattern, the meter and every scheme are
    free choices; a free choice without a declared seed is a hidden
    coordinate. `lines` narrows the pattern grammar to exact fits and refuses
    when none exists, naming every total the grammar can reach.
    """
    if seed is None:
        raise PlanRefused(
            "plan requires --seed=N — the pattern, the meter and every "
            "scheme are free choices, and a free choice without a declared "
            "seed is a hidden coordinate (doctrine 66). Any integer; the "
            "same seed reproduces the same plan byte for byte.")
    if form in BLOCKED_FORMS:
        raise PlanRefused(f"--form={form} is declared and BLOCKED: "
                          f"{BLOCKED_FORMS[form]}")
    if form not in PLAN_FORMS:
        raise PlanRefused(
            f"--form={form!r} is not a declared form. Declared: "
            f"{', '.join(PLAN_FORMS)}; declared-but-blocked: "
            f"{', '.join(sorted(BLOCKED_FORMS))}.")
    totals = attainable_totals()
    if lines is not None:
        eligible = [(n, f) for n, f in SECTION_PATTERNS
                    if sum(LINES_PER_FUNCTION[x] for x in f) == lines]
        if not eligible:
            raise PlanRefused(
                f"--lines={lines} fits no declared pattern. Attainable "
                f"totals: "
                + "; ".join(f"{t} ({', '.join(ns)})"
                            for t, ns in sorted(totals.items()))
                + ". The grammar is SECTION_PATTERNS x LINES_PER_FUNCTION "
                  "in quality/plan.py — extend it there rather than asking "
                  "the planner to improvise a shape it never declared.")
    else:
        eligible = list(SECTION_PATTERNS)

    rng = random.Random(seed)
    pat_name, funcs = rng.choice(eligible)
    meter = rng.choice(METER_SET)

    # Lay out sections and line slots.
    sections, line_slots = [], []
    bar, line_no = 1, 1
    counts = {}
    for func in funcs:
        counts[func] = counts.get(func, 0) + 1
        name = f"{func[0].upper()}{counts[func]}"
        n = LINES_PER_FUNCTION[func]
        sections.append({"name": name, "function": func,
                         "bars": n * BARS_PER_LINE, "start_bar": bar,
                         "meter": dict(meter)})
        for i in range(n):
            line_slots.append({"line": line_no, "section": name,
                               "function": func,
                               "bar": bar + i * BARS_PER_LINE})
            line_no += 1
        bar += n * BARS_PER_LINE

    # Schemes: one seeded scheme per FUNCTION KIND, applied to every
    # instance. The chorus's applies to its FIRST instance only — later
    # instances are verbatim returns, and the licence transports through the
    # return (quality/schemes.py's own doctrine; proven at rung 3).
    by_func = {}
    scheme_meta = {}
    for func in dict.fromkeys(funcs):
        k = LINES_PER_FUNCTION[func]
        code, pool = _schemes_for(k, rng)
        by_func[func] = code
        scheme_meta[func] = {"rgs": list(code), "chosen_from": pool}

    # Structures: which catalog row each function's groups DEMAND
    # (quality/structures.py). The pool is CALIBRATED rows ONLY — a row
    # with no measured laziness regime can grade correctness but not
    # laziness, and a planner that mandated one would be planning a check
    # it cannot enforce (the grader would disclose STRUCTURE_UNCALIBRATED
    # on every draft). Today the pool is exactly the comparator sentinel,
    # so the pick is FORCED — a pool of one is not a free choice, so no
    # seed entropy is consumed and every existing seed's plan reproduces
    # byte-for-byte in its other choices. The disclosure ships now so the
    # first adopted calibration widens the POOL, not the schema. Sampled
    # AFTER the scheme picks on purpose: RNG order is part of every
    # recorded plan's reproduction.
    from quality import structures as _ST
    spool = sorted(s.name for s in _ST.STRUCTURES.values() if s.calibrated)
    struct_meta = {}
    for func in dict.fromkeys(funcs):
        name = spool[0] if len(spool) == 1 else rng.choice(spool)
        struct_meta[func] = {"name": name, "chosen_from": list(spool)}

    groups, returns = [], []
    first_chorus = None
    for sec, func in zip(sections, funcs):
        first = next(s["line"] for s in line_slots
                     if s["section"] == sec["name"])
        n = LINES_PER_FUNCTION[func]
        if func == "chorus":
            if first_chorus is None:
                first_chorus = first
                groups.extend(_abs_groups(by_func[func], first))
            else:
                returns.extend([first_chorus + i, first + i]
                               for i in range(n))
        else:
            groups.extend(_abs_groups(by_func[func], first))

    total = line_no - 1
    plan = {
        "plan_version": 1,
        "request": {"form": form, "lines": lines, "seed": seed},
        "choices": {
            "pattern": {"name": pat_name, "functions": list(funcs),
                        "chosen_from": [n for n, _ in eligible]},
            "meter": {"value": dict(meter),
                      "chosen_from": [dict(m) for m in METER_SET]},
            "schemes": scheme_meta,
            # The declared-structure coordinate, per function kind. All
            # sentinel today (see the sampling comment above); the CLI
            # spelling for a NON-default pick lands with the first
            # calibration sitting, which is also the only event that can
            # produce one.
            "structures": struct_meta,
            "bars_per_line": BARS_PER_LINE,
            "subdivision": PLAN_SUBDIVISION,
        },
        "total_lines": total,
        "sections": sections,
        "line_slots": line_slots,
        "groups": ";".join(",".join(str(x) for x in g) for g in groups),
        "returns": ";".join(f"{a},{b}" for a, b in returns),
        "subdivision": PLAN_SUBDIVISION,
    }
    plan["writer_brief"] = writer_brief(plan)
    return plan


def fill_plan(plan, lines):
    """Plan + the writer's lines -> a complete blueprint dict.

    Count mismatch is refused, not truncated: the blueprint reader correlates
    by POSITION, and a silent zip would misalign every line after the first
    difference — the same argument `quality/fit.py` makes for its own count
    refusal.
    """
    want = plan["total_lines"]
    got = [l for l in lines if l.strip()]
    if len(got) != want:
        raise PlanRefused(f"the plan declares {want} line(s) and the draft "
                          f"carries {len(got)} — they must be the same song.")
    beats = plan["sections"][0]["meter"]["beats"]
    return {
        "title": "",
        "hooks": [],
        "sections": [dict(s) for s in plan["sections"]],
        "lines": [{"text": got[s["line"] - 1], "bar": s["bar"], "beat": 1,
                   "duration": beats * BARS_PER_LINE,
                   "section": s["section"]}
                  for s in plan["line_slots"]],
    }


def writer_brief(plan):
    """The plan as a blind writer's seed — shape and rhyme plan, nothing
    about the harness (the coverage experiment's bias rule, kept)."""
    out = [f"Write a song: {plan['total_lines']} lines, "
           f"{len(plan['sections'])} sections, in this order:"]
    for sec in plan["sections"]:
        n = sum(1 for s in plan["line_slots"]
                if s["section"] == sec["name"])
        out.append(f"  [{sec['function'].upper()}] {n} line(s)")
    if plan["groups"]:
        out.append("Rhyme plan (line numbers over the whole song):")
        for g in plan["groups"].split(";"):
            out.append(f"  lines {g.replace(',', ' & ')} rhyme")
    if plan["returns"]:
        out.append("Every chorus after the first repeats the first chorus "
                   "word for word, line for line.")
    return "\n".join(out)


def grading_command(plan, draft_path="DRAFT.txt", bp_path="BP.json"):
    """The exact invocation that grades a draft against this plan."""
    parts = [f"python3 lyric_harness.py song {bp_path} {draft_path}"]
    if plan["groups"]:
        parts.append(f"'--groups={plan['groups']}'")
    if plan["returns"]:
        parts.append(f"'--returns={plan['returns']}'")
    parts.append(f"--subdivision {plan['subdivision']}")
    return " ".join(parts)

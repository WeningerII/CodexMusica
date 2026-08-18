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

V2 (2026-08-18) — DERIVED SPACES, NOT TABLES. The owner's finding on v1,
verbatim in effect: a huge bias toward 4 lines and 4/4, because v1 pinned
`LINES_PER_FUNCTION` at constants, listed three meters by hand, and wrote
five patterns as strings. Every one of those tables is replaced by a
GENERATOR over a space the enforcement layers already grade:

- METERS are derived from the cycle grammar — any beat count whose pulse
  grouping is a composition into 2s and 3s (the attested additive-meter
  vocabulary), at any bars-per-line and subdivision, FILTERED by one derived
  envelope: slots per line. The envelope's floor IS the calibrated density
  band's floor (`meter_bands.ADOPTED` — a line must hold at least that many
  syllables, so fewer slots is unsatisfiable BY CONSTRUCTION); the ceiling is
  the band's ceiling times one declared multiplier (`SLOTS_CEILING_X`),
  beyond which every band-legal line under-fills the grid into decoration.
  THE MEASURE IS BY DERIVATION, NOT BY LEAF — (bars, subdivision) uniform
  over the pairs the envelope admits, the beat count uniform over that
  pair's derived range, the grouping exact-uniform over that beat count's
  compositions. This module's own first smoke run (2026-08-18) convicted
  the leaf measure: compositions of n into {2,3} grow ~1.3247^n, so
  uniform-over-enumerated-cycles hands nearly every plan the largest beat
  count the envelope admits — a weight-by-grouping-count table nobody
  declared, and a bias of exactly the kind v2 exists to remove.
  THE TIME-SIGNATURE DENOMINATOR IS NOT BOUNDED AND NOT SAMPLED WIDE,
  because it is not enforced: `fit.py`'s slot arithmetic is exact rational
  fractions of the BEAT and never reads the unit. The planner notates its
  cycle conventionally (4 for simple groupings, 8 for compound); a writer
  hand-declaring 5/24 is grading-identical to 5/8 and nothing refuses it.
- LINES PER SECTION are sampled UNIFORMLY from the envelope, per function
  kind. Schemes come from `schemes.rgs` exactly as before up to
  `EXACT_ENUM_MAX` lines (full enumeration, pool size disclosed); above it,
  an EXACT-UNIFORM set-partition sampler (the Bell-triangle completion
  counts drive each digit, so every partition is equally likely without
  enumerating the pool) with the Bell-number pool size disclosed. So large
  stanzas are not banned by arithmetic — only the enumeration was ever
  bounded, and the sampler removes that bound.
- PATTERNS are generated from the section-function vocabulary's own
  recurrence contracts (`grid.SECTION_FUNCTIONS`), not written as strings:
  once-functions appear once, returning-verbatim functions become return
  classes, new-words functions get fresh groups per instance, and
  instrumental functions carry bars with no lines. The roster below names
  which functions the GENERATOR reaches and why the rest wait; every one of
  the rest is hand-declarable today.
- THE CORPUS SAMPLES NOTHING. Measured distributions as a sampler would
  give the unprecedented shape probability ~zero — a ban wearing statistics
  (the owner's "move 37"). The corpus's role stays what it is on the
  grading side: conventions are DISCLOSED (the shape layer's notes), never
  enforced, and never weighted into the dice. A regression pins that this
  module imports no corpus reader.

EVERY FREE CHOICE IS SEEDED AND DISCLOSED. Doctrine 66: a tie broken by
nothing is a tie broken by the hash seed, and it does not reproduce. The
request therefore REQUIRES a seed, one `random.Random(seed)` drives every
pick, and the emitted plan echoes each choice beside the set (or the SIZE of
the set) it was chosen from.

REFUSALS, NOT DEFAULTS (doctrine 20). An unknown form is refused by name. A
length outside the envelope is refused naming the envelope. `ghazal` is
refused BY NAME for the stated mechanical reason (the radif licence has no
CLI flag).

Run:  python3 lyric_harness.py plan --seed=N [--form=verse-chorus]
                                    [--lines=N] [--fill=DRAFT] [--out=PATH]
Test: python3 quality/test_plan.py
"""

import json
import math
import random
from functools import lru_cache

from quality import schemes as SC
from quality import meter_bands as MB

__all__ = ["PLAN_FORMS", "ENVELOPE", "EXACT_ENUM_MAX", "SLOTS_CEILING_X",
           "GENERATOR_ROSTER", "ZERO_LINE_FUNCTIONS", "PlanRefused",
           "make_plan", "fill_plan", "writer_brief", "grading_command",
           "meter_dims", "meter_space_size", "bell"]


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

#: The one declared multiplier in this module. The slots ceiling is the
#: density band's ceiling times this: at 4x, a line at the band's own
#: maximum fills a quarter of its grid, which is where a grid stops
#: discriminating and starts decorating. Everything else in ENVELOPE is
#: either the band itself or a data-type fact.
SLOTS_CEILING_X = 4

#: Exact scheme enumeration up to this many lines (Bell(10) = 115,975 —
#: instant); beyond it the exact-uniform sampler serves, with the Bell
#: number disclosed as the pool size. A computational honesty bound on
#: ENUMERATION, not a bound on what is reachable.
EXACT_ENUM_MAX = 10

#: The planner's envelope — what it volunteers by default. NOT the system's
#: bounds: a writer hand-declares anything and the graders grade it. Each
#: entry names its provenance.
ENVELOPE = {
    # slots per line = beats x subdivision x bars_per_line. Floor DERIVED:
    # the calibrated density band's floor (meter_bands.ADOPTED) — fewer
    # slots than the minimum band-legal syllable count is unsatisfiable by
    # construction. Ceiling: band ceiling x SLOTS_CEILING_X.
    "slots_per_line": (MB.ADOPTED["DENSITY"][0],
                       MB.ADOPTED["DENSITY"][1] * SLOTS_CEILING_X),
    # lines per section: uniform sample range. 1 is a real section (a tag,
    # a one-line vamp); the top is where the floor's length calibrations
    # have long self-downgraded (disclosed per draft as
    # EXTRAPOLATED_LENGTH) — sampled anyway, since disclosure is not a ban,
    # but the envelope keeps the DEFAULT volunteer inside a singable order
    # of magnitude.
    "lines_per_section": (1, 16),
    "sections": (2, 12),
    "total_lines": (4, 64),
    # subdivisions the fit layer's grid models (eighth/sixteenth pulse
    # against the beat) — a data-type set, not taste.
    "subdivisions": (1, 2, 4),
    "bars_per_line": (1, 4),
    # per-section pickup offset in beats; halves need subdivision >= 2.
    "anacrusis": (0.0, 0.5, 1.0),
    "body_cells": (2, 6),
}


# ---------------------------------------------------------------- meters

@lru_cache(maxsize=None)
def _compositions_23(n):
    """All ordered compositions of n into parts of {2, 3} — the attested
    additive-meter vocabulary (aksak 2+2+3, Balkan 3+2+2, compound 3+3...).
    n < 2 has none, which is what keeps beats >= 2 without naming a cap.
    The ENUMERATED ground truth: sampling goes through the counter and
    `_composition_uniform` instead, and the tests hold those to this list
    at small n — enumerate-to-verify, count-to-sample."""
    if n < 2:
        return ()
    out = []
    if n == 2:
        out.append((2,))
    if n == 3:
        out.append((3,))
    for first in (2, 3):
        for rest in _compositions_23(n - first):
            out.append((first,) + rest)
    return tuple(out)


def _unit_for(groups):
    """Conventional notation for the sampled cycle: simple groupings in 4,
    anything with a 3 in 8. NOTATION ONLY — the slot arithmetic never reads
    the denominator, so 7/8 and 7/4 (and 7/10) grade identically; exotic
    denominators stay hand-declarable and are not sampled because sampling
    a label buys nothing the enforcement can see."""
    return 8 if any(g == 3 for g in groups) else 4


@lru_cache(maxsize=None)
def _n_compositions_23(n):
    """len(_compositions_23(n)) without building it — the Padovan
    recurrence (first part 2 leaves n-2, first part 3 leaves n-3). The
    counter, not the list, is what sampling needs: at the envelope's top
    beat count the list runs to ~10^5 tuples per beat count."""
    if n < 0:
        return 0
    if n == 0:
        return 1
    return _n_compositions_23(n - 2) + _n_compositions_23(n - 3)


def _composition_uniform(n, rng):
    """One EXACT-uniform composition of n into {2, 3} — each next part
    drawn with probability proportional to the completions it leaves, the
    same counted-completions move as `_rgs_uniform`. Uniform over the
    compositions OF THIS n; the measure across beat counts is the
    derivation's, decided in make_plan."""
    out = []
    while n:
        w2 = _n_compositions_23(n - 2) if n >= 2 else 0
        w3 = _n_compositions_23(n - 3) if n >= 3 else 0
        part = 2 if rng.randrange(w2 + w3) < w2 else 3
        out.append(part)
        n -= part
    return tuple(out)


def meter_dims():
    """-> {(bars_per_line, subdivision): (beats_lo, beats_hi)} — every
    dimension pair whose derived beat range is non-empty under the slots
    envelope. Pure arithmetic on the envelope; the beat count needs no cap
    of its own — the envelope's ceiling implies one."""
    lo, hi = ENVELOPE["slots_per_line"]
    dims = {}
    for bars in range(ENVELOPE["bars_per_line"][0],
                      ENVELOPE["bars_per_line"][1] + 1):
        for sub in ENVELOPE["subdivisions"]:
            b_lo = max(2, math.ceil(lo / (sub * bars)))
            b_hi = hi // (sub * bars)
            if b_lo <= b_hi:
                dims[(bars, sub)] = (b_lo, b_hi)
    return dims


def meter_space_size():
    """How many distinct (bars, subdivision, beats, grouping) cycles the
    envelope admits — the disclosure's denominator, counted, never
    enumerated. NOT the sampling measure (see `_sample_meter`)."""
    return sum(_n_compositions_23(b)
               for (lo, hi) in meter_dims().values()
               for b in range(lo, hi + 1))


def _sample_meter(rng):
    """One meter draw under the DERIVATION measure (module docstring):
    dimension pair uniform over what the envelope admits, beat count
    uniform over that pair's derived range, grouping exact-uniform over
    that beat count's compositions. Uniform over the flat enumeration is
    the same grammar under a weight-by-grouping-count table nobody
    declared (compositions into {2,3} grow ~1.3247^n, so leaves
    concentrate on the envelope's maximal beat count — this module's
    first smoke run showed it). A function of its own so the test file
    can hold the MEASURE itself to its prediction, not just the plans
    downstream of it. -> (bars, sub, beats, groups, (n_pairs, b_lo,
    b_hi)); the tail is the disclosure's raw material."""
    dims = meter_dims()
    dim_keys = sorted(dims)
    bars, sub = dim_keys[rng.randrange(len(dim_keys))]
    b_lo, b_hi = dims[(bars, sub)]
    beats = rng.randint(b_lo, b_hi)
    groups = _composition_uniform(beats, rng)
    return bars, sub, beats, groups, (len(dim_keys), b_lo, b_hi)


# ---------------------------------------------------------------- schemes

@lru_cache(maxsize=None)
def bell(n):
    """Bell number B(n) via the Bell triangle — the LAST element of row n,
    not the first (row n's first element is B(n-1): the off-by-one the
    test file's uniformity pin caught on 2026-08-18, which had every
    above-enumeration scheme pool disclosed at Bell(k-1)-1). Held to the
    enumeration (`schemes.rgs`) at small k in test_plan §4."""
    row = [1]
    for _ in range(n - 1):
        nxt = [row[-1]]
        for v in row:
            nxt.append(nxt[-1] + v)
        row = nxt
    return row[-1] if n else 1


@lru_cache(maxsize=None)
def _rgs_completions(r, m):
    """How many restricted-growth strings of length r complete a prefix
    whose current maximum block index is m-1 (i.e. m blocks so far)."""
    if r == 0:
        return 1
    return m * _rgs_completions(r - 1, m) + _rgs_completions(r - 1, m + 1)


def _rgs_uniform(k, rng):
    """One EXACT-uniform restricted-growth string of length k — every set
    partition equally likely, no enumeration. Each digit is drawn with
    probability proportional to the count of completions it leaves
    (doctrine 66: the rng is the only source of the draw)."""
    code, m = [], 0
    for i in range(k):
        r = k - i - 1
        weights = [_rgs_completions(r, max(m, 1))] * m
        weights.append(_rgs_completions(r, m + 1))
        total = sum(weights)
        pick = rng.randrange(total)
        acc = 0
        for d, w in enumerate(weights):
            acc += w
            if pick < acc:
                code.append(d)
                if d == m:
                    m += 1
                break
    return tuple(code)


def _scheme_for(k, rng):
    """One seeded scheme over k lines -> (code, pool_size).

    k == 1: the only scheme, pool of one (a one-line section mandates no
    pair; the SONG-level pair requirement below is what keeps a plan from
    checking nothing). k <= EXACT_ENUM_MAX: the full enumeration with >=1
    mandated pair, exactly v1's rule. Above: the exact-uniform sampler,
    rejecting the single all-singleton partition, pool = Bell(k) - 1."""
    if k == 1:
        return (0,), 1
    if k <= EXACT_ENUM_MAX:
        pool = [code for code in SC.rgs(k)
                if any(code.count(b) >= 2 for b in set(code))]
        return rng.choice(pool), len(pool)
    while True:
        code = _rgs_uniform(k, rng)
        if any(code.count(b) >= 2 for b in set(code)):
            return code, bell(k) - 1


def _abs_groups(code, first_line):
    """RGS code over a section -> absolute-numbered groups of >=2 lines."""
    blocks = {}
    for i, b in enumerate(code):
        blocks.setdefault(b, []).append(first_line + i)
    return [g for _, g in sorted(blocks.items()) if len(g) >= 2]


# ---------------------------------------------------------------- pattern

#: WHICH FUNCTIONS THE GENERATOR REACHES, with each row's semantics taken
#: from `grid.SECTION_FUNCTIONS`' own recurrence contract:
#:   "once"              -> at most one instance
#:   "returns verbatim"  -> instance 2+ is a return class of instance 1
#:   "returns new words" / "varied" / "open" -> fresh groups per instance,
#:                          same line count and scheme (the same tune)
#: Functions NOT in the roster are hand-declarable today and wait for a
#: stated reason: refrain/burden are line-level per their own glosses (not
#: standalone sections); reprise needs a cross-reference the plan schema
#: does not carry yet; turnaround overlaps a seam; postchorus and
#: false_ending need ordering machinery beyond the cell grammar; hook is
#: covered by the hook SLOT below (a hook is properly a fragment).
GENERATOR_ROSTER = ("intro", "verse", "prechorus", "chorus", "bridge",
                    "breakdown", "build", "drop", "vamp", "tag",
                    "interlude", "solo", "outro", "coda")

#: Instrumental spans: bars with no lines. `fit.py` reports their bars as
#: uncovered — a note, a rest is not a defect.
ZERO_LINE_FUNCTIONS = frozenset({"interlude", "solo"})

#: Functions whose later instances RETURN VERBATIM (their contract's
#: `returns_as`): the plan realises them as return classes.
VERBATIM_RETURNERS = frozenset({"chorus", "tag"})

#: The cell grammar: a body is 2..6 cells; each cell is a short run the
#: vocabulary's own adjacencies license (a prechorus is BEFORE a chorus by
#: definition; a build points AT a drop).
_CELLS = (
    ("verse",), ("verse", "chorus"), ("prechorus", "chorus"),
    ("verse", "prechorus", "chorus"), ("chorus",), ("bridge",),
    ("breakdown",), ("build", "drop"), ("vamp",), ("tag",),
    ("interlude",), ("solo",),
)


def _sample_pattern(rng):
    """-> ordered tuple of function names. Once-functions once, edges at
    the edges, everything else free."""
    funcs = []
    if rng.random() < 0.5:
        funcs.append("intro")
    n_cells = rng.randint(*ENVELOPE["body_cells"])
    bridge_used = False
    for _ in range(n_cells):
        while True:
            cell = _CELLS[rng.randrange(len(_CELLS))]
            if "bridge" in cell and bridge_used:
                continue
            break
        if "bridge" in cell:
            bridge_used = True
        funcs.extend(cell)
    ending = rng.choice((None, "outro", "coda"))
    if ending:
        funcs.append(ending)
    return tuple(funcs)


# ---------------------------------------------------------------- plan

def make_plan(seed, form="verse-chorus", lines=None):
    """A request -> the plan dict. Refuses rather than guessing."""
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
    t_lo, t_hi = ENVELOPE["total_lines"]
    if lines is not None and not t_lo <= lines <= t_hi:
        raise PlanRefused(
            f"--lines={lines} is outside the planner's envelope "
            f"[{t_lo}, {t_hi}]. The envelope bounds what the planner "
            f"VOLUNTEERS, not what the graders accept — declare a "
            f"blueprint and mandate by hand for a shape outside it.")

    rng = random.Random(seed)

    # REJECTION SAMPLING over the generated grammar: uniform over the
    # space, CONDITIONED on the envelope (and on --lines when given).
    # Deterministic — the retries are the same rng stream.
    for _attempt in range(500):
        funcs = _sample_pattern(rng)
        s_lo, s_hi = ENVELOPE["sections"]
        if not s_lo <= len(funcs) <= s_hi:
            continue
        k_lo, k_hi = ENVELOPE["lines_per_section"]
        ks = {}
        for fn in dict.fromkeys(funcs):
            ks[fn] = 0 if fn in ZERO_LINE_FUNCTIONS \
                else rng.randint(k_lo, k_hi)
        total = sum(ks[f] for f in funcs)
        # verbatim returners: later instances are copies, so they carry the
        # SAME line count already (ks is per kind) — total stands.
        if not t_lo <= total <= t_hi:
            continue
        if lines is not None and total != lines:
            continue
        # at least one mandated pair somewhere: some sung function with
        # k >= 2 (its scheme then carries a pair by _scheme_for's rule).
        if not any(ks[f] >= 2 for f in funcs):
            continue
        break
    else:
        raise PlanRefused(
            f"500 seeded draws found no plan matching the request inside "
            f"the envelope (sections {ENVELOPE['sections']}, lines/section "
            f"{ENVELOPE['lines_per_section']}, total {ENVELOPE['total_lines']}"
            f"{', exact total ' + str(lines) if lines is not None else ''}) "
            f"— try another seed, drop --lines, or declare the shape by "
            f"hand.")

    bars, sub, beats, groups_m, (n_pairs, b_lo, b_hi) = _sample_meter(rng)
    meter = {"beats": beats, "unit": _unit_for(groups_m),
             "groups": list(groups_m)}

    # Schemes per function kind (one tune per kind — new words, same
    # shape), and a per-section anacrusis in beats.
    by_func, scheme_meta = {}, {}
    for fn in dict.fromkeys(funcs):
        if ks[fn] == 0:
            continue
        code, pool = _scheme_for(ks[fn], rng)
        by_func[fn] = code
        scheme_meta[fn] = {"rgs": list(code), "chosen_from": pool,
                           "lines": ks[fn],
                           "lines_chosen_from": list(ENVELOPE[
                               "lines_per_section"])}

    # Anacrusis is PER FUNCTION KIND, like the scheme: the pickup is part
    # of the tune, and a kind whose instances differed would hand the
    # grader's own shape layer a RETURN_SLOT_DRIFT on a return this very
    # plan mandates as verbatim (caught by the first round-trip probe,
    # 2026-08-18). Halves need a subdivided grid to land on.
    ana_choices = [a for a in ENVELOPE["anacrusis"]
                   if a == int(a) or sub >= 2]
    anacrusis = {fn: rng.choice(ana_choices)
                 for fn in dict.fromkeys(funcs) if ks[fn] > 0}

    # Lay out sections and line slots.
    sections, line_slots = [], []
    bar, line_no = 1, 1
    counts = {}
    first_seen = {}
    groups, returns = [], []
    for fn in funcs:
        counts[fn] = counts.get(fn, 0) + 1
        name = f"{fn.upper()}{counts[fn]}"
        k = ks[fn]
        n_bars = max(k, 1) * bars
        ana = anacrusis.get(fn, 0.0)
        sections.append({"name": name, "function": fn,
                         "bars": n_bars, "start_bar": bar,
                         "meter": dict(meter)})
        first = line_no
        for i in range(k):
            line_slots.append({
                "line": line_no, "section": name, "function": fn,
                "bar": bar + i * bars, "beat": 1 + ana,
                "duration": bars * beats - ana})
            line_no += 1
        bar += n_bars
        if k == 0:
            continue
        if fn in VERBATIM_RETURNERS and fn in first_seen:
            returns.extend([first_seen[fn] + i, first + i]
                           for i in range(k))
        else:
            if fn in VERBATIM_RETURNERS:
                first_seen[fn] = first
            groups.extend(_abs_groups(by_func[fn], first))

    total = line_no - 1

    # The hook SLOT: the first chorus's first line, when a chorus exists.
    # The plan writes no words, so it declares a POSITION; fill_plan
    # realises the text into the blueprint's hooks list.
    hook_slot = None
    for s in line_slots:
        if s["function"] == "chorus":
            hook_slot = s["line"]
            break

    # Structures: the pool is rows calibrated FOR ENGLISH — this planner
    # plans English songs, and a table fitted on one tradition is not
    # quietly applied to another (doctrine 8; kalevala-alliteration is
    # calibrated ("fin",) and deliberately absent here). A pool of one is
    # a forced pick and consumes no entropy.
    from quality import structures as _ST
    spool = sorted(s.name for s in _ST.STRUCTURES.values()
                   if "eng" in s.calibrated)
    struct_meta = {}
    for fn in dict.fromkeys(funcs):
        if ks[fn] == 0:
            continue
        name = spool[0] if len(spool) == 1 else rng.choice(spool)
        struct_meta[fn] = {"name": name, "chosen_from": list(spool)}

    plan = {
        "plan_version": 2,
        "request": {"form": form, "lines": lines, "seed": seed},
        "envelope": {k: (list(v) if isinstance(v, tuple) else v)
                     for k, v in ENVELOPE.items()},
        "choices": {
            "pattern": {"functions": list(funcs),
                        "chosen_from": (f"generated grammar: {len(_CELLS)} "
                                        f"cell types x "
                                        f"{ENVELOPE['body_cells']} cells, "
                                        f"optional intro/outro/coda, "
                                        f"roster {len(GENERATOR_ROSTER)} "
                                        f"of 21 functions")},
            "meter": {"value": dict(meter),
                      "chosen_from": f"{meter_space_size()} derived cycles "
                                     f"(slots envelope "
                                     f"{list(ENVELOPE['slots_per_line'])}), "
                                     f"measured BY DERIVATION: 1 of "
                                     f"{n_pairs} bars x subdivision "
                                     f"pairs, beats {b_lo}-{b_hi} within "
                                     f"the pair, 1 of "
                                     f"{_n_compositions_23(beats)} "
                                     f"groupings of {beats}; unit is "
                                     f"notation, never enforced"},
            "schemes": scheme_meta,
            "structures": struct_meta,
            "anacrusis": {fn: {"value": v, "chosen_from": ana_choices}
                          for fn, v in anacrusis.items()},
            "bars_per_line": bars,
            "subdivision": sub,
        },
        "total_lines": total,
        "sections": sections,
        "line_slots": line_slots,
        "hook_slot": hook_slot,
        "groups": ";".join(",".join(str(x) for x in g) for g in groups),
        "returns": ";".join(f"{a},{b}" for a, b in returns),
        "subdivision": sub,
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
    hooks = []
    if plan.get("hook_slot"):
        hooks = [got[plan["hook_slot"] - 1]]
    return {
        "title": "",
        "hooks": hooks,
        "sections": [dict(s) for s in plan["sections"]],
        "lines": [{"text": got[s["line"] - 1], "bar": s["bar"],
                   "beat": s["beat"], "duration": s["duration"],
                   "section": s["section"]}
                  for s in plan["line_slots"]],
    }


def writer_brief(plan):
    """The plan as a blind writer's seed — shape and rhyme plan, nothing
    about the harness (the coverage experiment's bias rule, kept)."""
    m = plan["sections"][0]["meter"]
    out = [f"Write a song: {plan['total_lines']} lines, "
           f"{len(plan['sections'])} sections, in this order:"]
    for sec in plan["sections"]:
        n = sum(1 for s in plan["line_slots"]
                if s["section"] == sec["name"])
        if n == 0:
            out.append(f"  [{sec['function'].upper()}] instrumental — "
                       f"no words")
        else:
            out.append(f"  [{sec['function'].upper()}] {n} line(s)")
    out.append(f"Feel: {m['beats']}/{m['unit']} grouped "
               f"{'+'.join(str(g) for g in m['groups'])}.")
    if plan["groups"]:
        out.append("Rhyme plan (line numbers over the whole song):")
        for g in plan["groups"].split(";"):
            out.append(f"  lines {g.replace(',', ' & ')} rhyme")
    rets = {fn for fn in VERBATIM_RETURNERS
            if sum(1 for s in plan["sections"]
                   if s["function"] == fn) >= 2}
    for fn in sorted(rets):
        out.append(f"Every {fn} after the first repeats the first {fn} "
                   f"word for word, line for line.")
    if plan.get("hook_slot"):
        out.append(f"Line {plan['hook_slot']} is the hook — make it the "
                   f"line someone leaves humming.")
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

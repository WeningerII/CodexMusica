#!/usr/bin/env python3
"""PRICING THE NEAR-RELATION DOOR, AND THE EMPTY/EMPTY CODA — the runner for
`quality/NEAR_RELATION_PRICING_PREREGISTRATION.md`.

**WHAT THIS ANSWERS.** `MISSING.md` M-138 has sat OPEN since 2026-08-22 on one
sentence: since M-59 widened `Declaration.admit`, `theta_rhyme=0.75` is the
SOLE numeric gate on ASSONANCE and CONSONANCE, and it was calibrated on
neither. `MISSING.md` E-5 has sat OPEN since 2026-08-21 on a second:
`cluster_sim([], [])` is 1.0, so two vowel-final words are handed a full mark
on a channel weighted 0.35. Both entries were parked for the SAME reason —
pricing is a re-adoption that moves recorded verdicts, and nobody had
preregistered one. The preregistration exists now and this is its instrument.

**THE TWO ARMS, AND THE RATIO BETWEEN THEM IS THE STATISTIC.**

    RANDOM  `chance_rate.GRID` — the declared 2x2 sampler, seed 20260810,
            n=4,000 per cell. Per RELATION, how often the door admits two
            random CMUdict words. Shares of JUDGED, never of drawn.
    CANON   the 152 sonnets' 1,064 mandated / 1,014 judged / 50 refused
            pairs, re-derived from `check_scheme`'s own `pair_scores` so the
            comparator is production's and not a private re-implementation.

    ratio_r(t) = (admitted_r(t) / judged) / CANON_RATE

`RESULTS_REDTEAM.md` recorded a **1.5x** version of that ratio and it got
`theta_coda` recalibrated. The whole admit door reads 6.1–7.2x today.

**E0 IS READ BEFORE ANYTHING ELSE AND IT IS NOT A FORMALITY.** The canon arm's
re-derivation must reproduce `battery.py` exactly, at BOTH settings — the
adopted cuts against today's `battery.EXPECTED` (1064/1014/50/**14**) and the
empty cuts against the pre-pricing **12** this pricing was derived at. M-138's
own founding defect was a figure from an instrument nobody could re-run; a
repricing that cannot reproduce the pin it reprices is that defect with a
longer document.

**NOTHING HERE TUNES, AND THE HARDEST PLACE IT COULD HAVE IS NAMED.** The sweep
grid, the 2x target and the violation ceiling of 20 were all fixed in the
preregistration before the run. 20 is the exact Clopper–Pearson 95% upper edge
on `PRICING_CANON` — the 12/1014 pinned BEFORE the adoption, not the 14/1014
the adoption produced. Adopting the cut moved the denominator of the statistic
that chose it, and re-sweeping against the moved value would hand back a looser
cut for free; that is doctrine 58 wearing a decimal, and `PRICING_CANON` is
what refuses it.

    python3 quality/near_relation_pricing.py             # E0, E1, E2   ~6 min
    python3 quality/near_relation_pricing.py --seeds     # the 200-seed arm
    python3 quality/near_relation_pricing.py --interval  # where 20 comes from
    python3 quality/near_relation_pricing.py --check     # exit 3 on drift
"""
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lyric_harness as L  # noqa: E402
from quality import chance_rate as CR  # noqa: E402

#: THE SWEEP GRID, DECLARED IN THE PREREGISTRATION AND NOT WIDENED HERE. 0.75
#: is the shipped cut; 1.00 is the ceiling of the scalar. Twenty-six points,
#: and nothing off this grid is tried — "the smallest t that works" must not
#: be reachable by refining until the answer improves (doctrine 58).
SWEEP = tuple(round(0.75 + 0.01 * i, 2) for i in range(26))

#: The multiple of the canon arm a per-relation cut must reach. Chosen from
#: `RESULTS_REDTEAM.md`'s 1.5x precedent — the smallest round multiple
#: STRICTLY ABOVE the ratio this repository already treated as disqualifying —
#: and fixed before the sweep ran.
TARGET_RATIO = 2.0

#: THE CANON ARM THIS PRICING WAS DERIVED AT, PINNED AND NOT READ LIVE — and
#: the reason is the sharpest thing in this file.
#:
#: The statistic is `admitted_r / judged / CANON_RATE`, and ADOPTING the cut
#: MOVED `CANON_RATE`: `battery.EXPECTED` went 12 -> 14 and
#: `chance_rate.CANON_VIOLATIONS` with it, because the two pairs the 0.82 cut
#: refuses are sonnet violations now. Re-running the sweep against the moved
#: denominator gives a LOOSER cut — every ratio falls by 12/14 — so 0.81
#: would now clear a target 0.82 was needed for yesterday. **That is a
#: calibration arguing in a circle, and loosening is the flattering direction
#: (doctrine 14/71).** The cut is a coordinate of the rate it was chosen
#: against, so the rate is written down beside it (doctrine 58) and the sweep
#: reads THIS, not the live pin. `--check` prints what the live rate would
#: give and does NOT adopt it.
PRICING_CANON = (12, 1014)
PRICING_RATE = PRICING_CANON[0] / PRICING_CANON[1]

#: THE CUTS ADOPTED, 2026-09-02, by falsifier E1 of the preregistration.
#: CONSONANCE is 0.75 — MEASURED and unmoved, written down because an
#: omitted entry and a measured-equal one are different claims (doctrine 20).
ADOPTED_CUTS = {"ASSONANCE": 0.82, "CONSONANCE": 0.75}

#: THE CEILING E1 AND E2 FIRE ABOVE. The exact Clopper–Pearson 95% interval on
#: `PRICING_CANON` — 12 of 1,014 — is [0.006130, 0.020581], which over 1,014
#: judged pairs is [6.215, 20.869] — counts [6, 20] at the floor of each edge.
#: So "12 plus its interval" is 20 and 21 is outside it. It is the interval on
#: the PRE-adoption pin and stays so: a ceiling that moved with the number it
#: was ceiling would not be one. `--interval` re-derives it.
VIOL_MAX = 20

#: The 200-seed arm's size. `chance_rate` adopts a band over a 2x2 sampler at
#: ONE seed; doctrine 73 says one seed is a coin flip reported as a verdict,
#: so the FPR gets a distribution here. 200 matches `RESULTS_REDTEAM`'s own
#: seed count and puts the empirical resolution at 1/201 (doctrine 57).
SEEDS = 200

SONNET_SCHEME = "ABABCDCDEFEFGG"


def interval(k=None, n=None, alpha=0.05):
    """-> (lo, hi) exact Clopper–Pearson bounds, and the counts they imply.

    DERIVED FROM `PRICING_CANON`, NOT TYPED AND NOT READ LIVE. A ceiling that
    moved with the number it was ceiling would not be one — see that constant
    for why this deliberately does NOT follow `battery.EXPECTED` any more.
    """
    from math import comb
    if k is None or n is None:
        k, n = PRICING_CANON

    def le(kk, p):
        return sum(comb(n, i) * p ** i * (1 - p) ** (n - i)
                   for i in range(kk + 1))

    def ge(kk, p):
        return sum(comb(n, i) * p ** i * (1 - p) ** (n - i)
                   for i in range(kk, n + 1))

    lo, hi = k / n, 1.0
    for _ in range(120):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if le(k, mid) > alpha / 2 else (lo, mid)
    up = (lo + hi) / 2
    if k == 0:
        dn = 0.0
    else:
        lo2, hi2 = 0.0, k / n
        for _ in range(120):
            mid = (lo2 + hi2) / 2
            lo2, hi2 = (lo2, mid) if ge(k, mid) > alpha / 2 else (mid, hi2)
        dn = (lo2 + hi2) / 2
    return {"k": k, "n": n, "lo": dn, "hi": up,
            "count_lo": int(dn * n), "count_hi": int(up * n)}


# ---------------------------------------------------------------------------
# ARM ONE — the random draw, BY RELATION
# ---------------------------------------------------------------------------

def random_arm(sampler, lex, decl):
    """-> dict. Every JUDGED drawn pair's (relation, total), kept as a list per
    relation so any cut on `SWEEP` is a count and not a re-run.

    THE DRAW IS `chance_rate.Sampler`'s, NOT A SECOND COPY OF IT. That module
    exists because M-138's figures came from an uncommitted script whose
    population, order and draw nobody had written down; re-spelling the draw
    here would rebuild exactly that defect one directory over (doctrine 1).
    """
    read, cmp_ = CR.READERS[sampler.reader]
    out = {"sampler": sampler, "drawn": 0, "refused": 0, "judged": 0,
           "totals": {}}
    for a, b in sampler.pairs(lex):
        out["drawn"] += 1
        aa, wa = read(lex, a)
        bb, wb = read(lex, b)
        s = None
        if aa and bb:
            try:
                s = cmp_(aa, bb, decl, wa, wb)
            except (KeyError, IndexError, ValueError):
                s = None
        if s is None:
            out["refused"] += 1
            continue
        out["judged"] += 1
        out["totals"].setdefault(s["relation"], []).append(s["total"])
    return out


def admitted(arm, relation, t):
    """-> how many drawn pairs this cell admits AS `relation` at cut `t`."""
    return sum(1 for x in arm["totals"].get(relation, ()) if x >= t)


def ratio_of(arm, relation, t):
    """-> the statistic. None when nothing was judged, never 0.0 — a measured
    zero and an empty denominator are different answers (doctrine 20)."""
    if not arm["judged"]:
        return None
    return (admitted(arm, relation, t) / arm["judged"]) / PRICING_RATE


def cut_for(relation, arms, target=TARGET_RATIO):
    """-> the smallest t on `SWEEP` whose ratio is under `target` in EVERY
    cell, or None when no cut on the grid reaches it.

    OVER THE BAND, NEVER OVER A CELL. `chance_rate.ADOPTED` pins counts as a
    band across this same grid for the same reason (doctrine 57/73): a cut
    that reaches the target on the friendliest of four samplers has been
    chosen by the sampler.
    """
    for t in SWEEP:
        rs = [ratio_of(a, relation, t) for a in arms]
        if all(r is not None and r < target for r in rs):
            return t
    return None


# ---------------------------------------------------------------------------
# ARM TWO — the canon, re-derived from production's own verdicts
# ---------------------------------------------------------------------------

def canon_records(lex, decl, log=None):
    """-> list of per-sonnet records off ONE `check_scheme` pass each.

    WHAT IS KEPT, and it is deliberately the RAW verdicts rather than a
    violation count: the mandated pairs, each with the relation and total
    `best_score` gave it, the refusal set, and `check_scheme`'s own violation
    and schema-rescue lists — so `reprice` below can move a threshold WITHOUT
    re-reading the corpus, and so E0 can compare the two readings pair for
    pair rather than count against count.
    """
    import battery
    sonnets = battery.parse_sonnets(battery.corpus_path("sonnets.txt"))
    recs = []
    for idx, sn in enumerate(sonnets, 1):
        r = L.check_scheme(lex, sn, SONNET_SCHEME, decl)
        n = len(sn)
        mand = [(i, j) for i in range(n) for j in range(i + 1, n)
                if L.same_scheme_class(SONNET_SCHEME[i], SONNET_SCHEME[j])]
        by = {tuple(p["lines"]): p for p in r["pair_scores"]}
        recs.append({
            "idx": idx, "lines": sn,
            "mandated": [(i + 1, j + 1) for i, j in mand],
            "bearing": {x for pr in mand for x in pr},
            "refused": {tuple(x["lines"]) for x in r.get("refusals", [])},
            "pairs": {(i + 1, j + 1): (by[(i + 1, j + 1)]["relation"],
                                       by[(i + 1, j + 1)]["score"])
                      for i, j in mand},
            "base_violations": {(v[0], v[1]) for v in r["violations"]},
            "base_rescued": {tuple(d["lines"])
                             for d in r.get("pairs_schema_satisfied", ())},
        })
        if log and idx % 25 == 0:
            log(f"    canon: {idx}/{len(sonnets)} sonnets read")
    return recs


_WVP_MEMO = {}


def schema_answers(rec):
    """-> the set of mandated pairs the 77-schema default answers on.

    LAZY AND MEMOISED, because it is the expensive call in this file (4.7 s a
    sonnet against 0.05 s for `check_scheme`) and most sonnets never need it.
    THE CALL IS `check_scheme`'s OWN, bearing and all: the rescue is what
    turned 35 violations into 12, and a repricing that reproduced it
    approximately would be measuring a different oracle (doctrine 1).
    """
    if rec["idx"] not in _WVP_MEMO:
        from quality import phonology as _PH
        from quality.relations import whole_vocabulary_pairs as _WVP
        got = _WVP(list(rec["lines"]), _PH.get("eng"), bearing=rec["bearing"])
        _WVP_MEMO[rec["idx"]] = set(got)
    return _WVP_MEMO[rec["idx"]]


def reprice(recs, thetas, decl, rescue=True):
    """-> dict. The sonnet arm under per-relation cuts `thetas`.

    THE CHAIN IS `check_scheme`'s, IN ITS ORDER, and the only substitution is
    the threshold: where that function reads `decl.theta_rhyme`, this reads
    `thetas.get(relation, decl.theta_rhyme)`. Everything else — REPEAT charged,
    an unadmitted relation charged, NO_ANCHOR charged, the schema rescue
    applied to every non-REPEAT charge — is the same in the same sequence.
    E0 is what proves that claim rather than asserting it.
    """
    admit = frozenset(decl.admit)
    out = {"mandated": 0, "judged": 0, "refused": 0,
           "violations": [], "rescued": [], "by_relation": Counter()}
    for rec in recs:
        for pr in rec["mandated"]:
            out["mandated"] += 1
            if pr in rec["refused"]:
                out["refused"] += 1
                continue
            out["judged"] += 1
            rel, tot = rec["pairs"][pr]
            th = thetas.get(rel, decl.theta_rhyme)
            why = None
            if rel == "REPEAT":
                why = "REPEAT"
            elif rel in L.NEAR_RELATIONS and rel not in admit:
                why = "not admitted"
            elif rel == L.NO_ANCHOR:
                why = "NO_ANCHOR"
            elif tot < th:
                why = f"below theta({rel})={th}"
            elif not (rel in admit and tot >= th):
                why = f"{rel} not admitted"
            if why is None:
                continue
            if rescue and why != "REPEAT" and \
                    L.admit_is_default(decl) and pr in schema_answers(rec):
                out["rescued"].append((rec["idx"], pr, rel, tot))
                continue
            out["violations"].append((rec["idx"], pr, rel, tot, why))
            out["by_relation"][rel] += 1
    return out


def e0(recs, decl):
    """-> (ok, detail). Does the re-derivation reproduce `battery.py`?

    READ BEFORE ANY FALSIFIER, AND ON FAILURE NOTHING BELOW IT IS READ. The
    comparison is PAIR FOR PAIR against `check_scheme`'s own violation set,
    not count against count: two readings can agree on 12 and disagree about
    which twelve, and reproducing a number checks the arithmetic and never
    the construction (doctrine 79's closing sentence).
    """
    import battery
    got = reprice(recs, {}, decl)
    mine = {(r["idx"], pr) for r in recs for pr in ()} | \
        {(v[0], v[1]) for v in got["violations"]}
    theirs = {(r["idx"], pr) for r in recs for pr in r["base_violations"]}
    bad = []
    for key, want in battery.EXPECTED.items():
        have = len(got["violations"]) if key == "violations" else got[key]
        if have != want:
            bad.append(f"{key}: battery.EXPECTED {want}, re-derived {have}")
    if mine != theirs:
        bad.append(f"the violating PAIRS differ: "
                   f"{len(mine - theirs)} only in the re-derivation, "
                   f"{len(theirs - mine)} only in check_scheme")
    return (not bad), {"bad": bad, "got": got, "pairs": mine}


# ---------------------------------------------------------------------------
# reporting
# ---------------------------------------------------------------------------

def _print_random(arms, decl):
    print("  RANDOM ARM — by relation, over the declared 2x2 sampler grid")
    print(f"    canon arm {PRICING_CANON[0]}/{PRICING_CANON[1]} = "
          f"{100 * PRICING_RATE:.2f}% (the rate this pricing was DERIVED "
          f"at; chance_rate now pins {CR.CANON_VIOLATIONS}/"
          f"{CR.CANON_JUDGED} = {100 * CR.CANON_RATE:.2f}% because adopting "
          f"the cut moved it)   target ratio < {TARGET_RATIO}x")
    for a in arms:
        print(f"    {a['sampler'].label()}")
        print(f"      drawn {a['drawn']}  refused {a['refused']}  "
              f"judged {a['judged']}   (never summed)")
        for rel in ("RHYME", "RIME_RICHE", "ASSONANCE", "CONSONANCE"):
            c = admitted(a, rel, decl.theta_rhyme)
            r = ratio_of(a, rel, decl.theta_rhyme)
            shown = "cannot tell" if r is None else f"{r:6.2f}x"
            print(f"      {rel:<11}{c:>5} at theta {decl.theta_rhyme}  "
                  f"{100 * c / a['judged']:6.2f}% of judged   {shown} canon")


def _print_sweep(arms, relation):
    print(f"    {relation}: ratio by cut, min..max over the four cells")
    for t in SWEEP:
        rs = [ratio_of(a, relation, t) for a in arms]
        cs = [admitted(a, relation, t) for a in arms]
        mark = "  <- first cell-wide under target" if \
            all(r is not None and r < TARGET_RATIO for r in rs) else ""
        print(f"      t {t:.2f}   admitted {min(cs):>4}..{max(cs):<4}  "
              f"ratio {min(rs):6.2f}x..{max(rs):6.2f}x{mark}")
        if mark:
            break


def check(lex, decl):
    """-> exit code. Re-derive the RANDOM half of the pricing and require the
    adopted cuts to still fall out of it. Exits 3 on drift.

    **WHAT THIS DOES NOT RE-RUN, STATED RATHER THAN IMPLIED (doctrine 20).**
    The CANON arm costs eleven minutes, nearly all of it in
    `whole_vocabulary_pairs`, so this gate covers the random arm, the sweep
    and the ceiling — the half that drifts when the comparator moves — and
    NOT the sonnet cost. `python3 battery.py` is the canon arm's own gate and
    pins the 14 this pricing produced; running the full falsifier set is
    `python3 quality/near_relation_pricing.py` with no flag.

    THE SWEEP IS RE-DERIVED AGAINST `PRICING_CANON`, never the live canon
    rate — see that constant for why re-sweeping against the moved
    denominator would hand back a looser cut for free.
    """
    bad = []
    iv = interval()
    if iv["count_hi"] != VIOL_MAX:
        bad.append(f"the ceiling moved: VIOL_MAX {VIOL_MAX}, "
                   f"re-derived {iv['count_hi']} from {iv['k']}/{iv['n']}")
    else:
        print(f"  HOLDS  ceiling {VIOL_MAX} = the 95% upper edge on "
              f"{iv['k']}/{iv['n']}")
    arms = [random_arm(s, lex, decl) for s in CR.GRID]
    for rel, want in sorted(ADOPTED_CUTS.items()):
        got = cut_for(rel, arms)
        if got != want:
            bad.append(f"{rel}: adopted cut {want}, re-derived {got} — the "
                       f"random arm moved, so the pricing is answering a "
                       f"different question than the one it was adopted on")
        else:
            rs = [ratio_of(a, rel, want) for a in arms]
            print(f"  HOLDS  t*({rel}) = {want}   "
                  f"{min(rs):.2f}x..{max(rs):.2f}x, under {TARGET_RATIO}x "
                  f"on all {len(arms)} cells")
    # THE SHIPPED DECLARATION MUST BE THE ADOPTED ONE. A results document
    # and a `Declaration` that disagree is the defect this whole sitting is
    # about, one layer out.
    if dict(decl.theta_by_relation) != ADOPTED_CUTS:
        bad.append(f"the shipped Declaration.theta_by_relation is "
                   f"{dict(decl.theta_by_relation)}, the adopted cuts are "
                   f"{ADOPTED_CUTS}")
    else:
        print(f"  HOLDS  Declaration.theta_by_relation IS the adopted cuts")
    if bad:
        print()
        print(f"MOVED {len(bad)}:")
        for b in bad:
            print(f"  - {b}")
        return 3
    print()
    print("the pricing holds, and the cut still falls out of the sweep")
    return 0


def main(argv):
    if "--interval" in argv:
        iv = interval()
        print("THE CEILING, DERIVED FROM battery.EXPECTED AND NOT TYPED")
        print(f"  {iv['k']}/{iv['n']} = {iv['k'] / iv['n']:.6f}")
        print(f"  Clopper-Pearson 95%: [{iv['lo']:.6f}, {iv['hi']:.6f}]")
        print(f"  as counts over {iv['n']}: "
              f"[{iv['lo'] * iv['n']:.3f}, {iv['hi'] * iv['n']:.3f}]")
        print(f"  VIOL_MAX = {iv['count_hi']}   (module pin {VIOL_MAX})")
        return 0 if iv["count_hi"] == VIOL_MAX else 3

    lg = (lambda t: print(t, flush=True))
    lex, decl = L.Lexicon(), L.Declaration()
    print("NEAR-RELATION PRICING · "
          "quality/NEAR_RELATION_PRICING_PREREGISTRATION.md")
    print()

    if "--check" in argv:
        return check(lex, decl)

    if "--seeds" in argv:
        import statistics
        print(f"  THE {SEEDS}-SEED ARM — the SHIPPED cell, re-drawn")
        rels = ("RHYME", "RIME_RICHE", "ASSONANCE", "CONSONANCE")
        rows = {r: [] for r in rels}
        arms, tot = [], []
        for k in range(SEEDS):
            s = CR.Sampler(CR.SHIPPED.seed + k, CR.SHIPPED.n,
                           CR.SHIPPED.population, CR.SHIPPED.reader)
            a = random_arm(s, lex, decl)
            arms.append(a)
            for rel in rels:
                rows[rel].append(admitted(a, rel, decl.theta_rhyme))
            tot.append(sum(admitted(a, r, decl.theta_rhyme) for r in rels))
            if (k + 1) % 25 == 0:
                lg(f"    seed {k + 1}/{SEEDS}")
        print()
        print(f"    admitted counts at the SHIPPED theta_rhyme "
              f"{decl.theta_rhyme}, over {SEEDS} seeds")
        for rel in rels:
            v = sorted(rows[rel])
            print(f"    {rel:<11} min {v[0]:>4}  p5 {v[SEEDS // 20]:>4}  "
                  f"median {statistics.median(v):>7.1f}  "
                  f"p95 {v[-1 - SEEDS // 20]:>4}  max {v[-1]:>4}")
        v = sorted(tot)
        print(f"    {'ADMIT (all)':<11} min {v[0]:>4}  p5 {v[SEEDS // 20]:>4}  "
              f"median {statistics.median(v):>7.1f}  "
              f"p95 {v[-1 - SEEDS // 20]:>4}  max {v[-1]:>4}")
        print(f"    against chance_rate.ADOPTED['admit'] = "
              f"{CR.ADOPTED['admit']} at the ONE canonical seed — a band over "
              f"four SAMPLERS, not over seeds; these two spreads are "
              f"different quantities and are not summed (doctrine 79)")
        # THE CUT ITSELF IS A COORDINATE OF THE SEED UNTIL THIS IS READ
        # (doctrine 73). `cut_for` picks the smallest t under target across
        # four SAMPLERS at ONE seed; here the same rule is applied across 200
        # SEEDS of one sampler. A t* that moves between the two was chosen by
        # the draw, and saying so is the measurement.
        print()
        print(f"    t* RE-DERIVED OVER {SEEDS} SEEDS — smallest t under "
              f"{TARGET_RATIO}x in EVERY seed, and in the MEDIAN seed")
        for rel in ("ASSONANCE", "CONSONANCE"):
            allc = cut_for(rel, arms)
            med = None
            for t in SWEEP:
                rs = sorted(ratio_of(a, rel, t) for a in arms)
                if statistics.median(rs) < TARGET_RATIO:
                    med = t
                    break
            print(f"      {rel:<11} t*(every seed) = {allc}   "
                  f"t*(median seed) = {med}")
        return 0

    # --- E0 -------------------------------------------------------------
    lg("  reading the canon arm (152 sonnets)...")
    recs = canon_records(lex, decl, log=lg)
    ok, det = e0(recs, decl)
    print()
    print("  E0 — does the re-derivation reproduce battery.py?")
    g = det["got"]
    print(f"    mandated {g['mandated']}  judged {g['judged']}  "
          f"refused {g['refused']}  violations {len(g['violations'])}  "
          f"rescued by schema {len(g['rescued'])}")
    if not ok:
        print("    E0 FIRES — nothing below this is read:")
        for b in det["bad"]:
            print(f"      - {b}")
        return 3
    print("    HOLDS, pair for pair. The falsifiers below may be read.")

    # --- the random arm and the cuts ------------------------------------
    print()
    arms = [random_arm(s, lex, decl) for s in CR.GRID]
    _print_random(arms, decl)
    print()
    print("  THE SWEEP — smallest cut on the declared grid under "
          f"{TARGET_RATIO}x in ALL FOUR cells")
    cuts = {}
    for rel in ("ASSONANCE", "CONSONANCE"):
        _print_sweep(arms, rel)
        cuts[rel] = cut_for(rel, arms)
        print(f"      t*({rel}) = {cuts[rel]}")

    # --- E1 -------------------------------------------------------------
    print()
    print("  E1 — does that cut cost more than the canon arm can carry?")
    print("    TWO READINGS, REPORTED APART (doctrine 79). The SCALAR DOOR")
    print("    reading counts pairs that leave the admitted set; the AFTER")
    print("    RESCUE reading is what battery.py prints, and the difference")
    print("    is pairs the 77-schema default absorbed — a door M-140 pins")
    print("    at 20.3-21.0x the canon arm and leaves UNPRICED. A rate that")
    print("    looks flat only because an unpriced door caught the movement")
    print("    is the defect this whole sitting is about.")
    base_s = reprice(recs, {}, decl, rescue=False)
    if any(v is None for v in cuts.values()):
        print("    no cut on the declared grid reaches the target for "
              + ", ".join(k for k, v in cuts.items() if v is None))
        print("    E1 FIRES by the registered no-cut clause: REFUSED.")
    else:
        rp_s = reprice(recs, cuts, decl, rescue=False)
        rp = reprice(recs, cuts, decl)
        base = reprice(recs, {}, decl)
        nv = len(rp["violations"])
        print(f"    at {cuts}:")
        print(f"      SCALAR DOOR   {len(base_s['violations'])} -> "
              f"{len(rp_s['violations'])} of {rp_s['judged']} judged "
              f"(+{len(rp_s['violations']) - len(base_s['violations'])})")
        print(f"      AFTER RESCUE  {len(base['violations'])} -> {nv} "
              f"(+{nv - len(base['violations'])}); the schema door absorbed "
              f"{len(rp['rescued'])} against {len(base['rescued'])} today, "
              f"i.e. {len(rp['rescued']) - len(base['rescued'])} more")
        print(f"      charged by relation: "
              + "  ".join(f"{k}={v}" for k, v in
                          sorted(rp["by_relation"].items())))
        print(f"    ceiling {VIOL_MAX} (12 + its exact 95% interval)")
        print("    E1 " + ("FIRES — REFUSED." if nv > VIOL_MAX
                           else "does NOT fire — the cut is affordable."))
        # doctrine 5: the direction has to reproduce in both halves
        for name, keep in (("FIT  (odd sonnets)", lambda i: i % 2 == 1),
                           ("HELD (even sonnets)", lambda i: i % 2 == 0)):
            half = [r for r in recs if keep(r["idx"])]
            b = reprice(half, {}, decl)
            h = reprice(half, cuts, decl)
            print(f"    {name}: {len(b['violations'])} -> "
                  f"{len(h['violations'])} of {h['judged']} judged")

    # --- E2 -------------------------------------------------------------
    print()
    print("  E2 — the empty/empty coda, in `total` only")
    print("    THE PRIMARY CLAUSE IS THE ADMITTED SET, not the violation")
    print("    count. The registration glossed the two as one and they are")
    print("    NOT one: a pair the scalar door stops admitting and the")
    print("    schema door catches has still left the admitted set, and")
    print("    reading only the second number would let an unpriced door")
    print("    launder the rate this sitting exists to price.")
    base = reprice(recs, {}, decl)
    adm0 = _admitted_set(recs, decl)
    print(f"    gift (shipped)      admitted {len(adm0)} of "
          f"{base['judged']} judged; violations {len(base['violations'])}")
    for rule in ("zero", "cannot_tell"):
        d2 = L.Declaration(coda_empty_evidence=rule)
        r2 = canon_records(lex, d2)
        adm = _admitted_set(r2, d2)
        left = adm0 - adm
        p2s = reprice(r2, {}, d2, rescue=False)
        p2 = reprice(r2, {}, d2)
        nv = len(p2["violations"])
        print(f"    {rule}:")
        print(f"      LEFT THE ADMITTED SET  {len(left)} mandated pair(s) "
              f"({100 * len(left) / max(1, len(adm0)):.1f}% of the "
              f"{len(adm0)} admitted today)")
        print(f"      SCALAR DOOR   {len(base_s['violations'])} -> "
              f"{len(p2s['violations'])} of {p2s['judged']} judged")
        print(f"      AFTER RESCUE  {len(base['violations'])} -> {nv}; the "
              f"schema door absorbed {len(p2['rescued'])} against "
              f"{len(base['rescued'])} today")
        for pin in ("now why", "see free", "cat hat"):
            a, b = pin.split()
            sa = L.best_score(*_two(lex, a, b), d2, a, b)
            print(f"      {a}/{b:<6} {sa['total']:.3f} {sa['relation']}"
                  + ("   <- below theta_rhyme: NOT admitted"
                     if sa["total"] < d2.theta_rhyme else ""))
        fired = bool(left) or nv > VIOL_MAX
        print("      E2 " + ("FIRES for this rule — REFUSED." if fired
                             else "does NOT fire for this rule."))
    return 0


def _admitted_set(recs, decl):
    """-> the mandated JUDGED pairs the SCALAR door admits, schema rescue
    excluded on purpose. This is E2's primary clause and it is a different
    question from `reprice`'s violation count (doctrine 79)."""
    admit = frozenset(decl.admit)
    out = set()
    for rec in recs:
        for pr in rec["mandated"]:
            if pr in rec["refused"]:
                continue
            rel, tot = rec["pairs"][pr]
            if rel in admit and tot >= decl.theta_rhyme:
                out.add((rec["idx"], pr))
    return out


def _two(lex, a, b):
    aa, _, _ = L.line_anchors(lex, a)
    bb, _, _ = L.line_anchors(lex, b)
    return aa, bb


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

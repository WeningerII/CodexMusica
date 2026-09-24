#!/usr/bin/env python3
"""How far apart are the lines the whole-draft schema door actually rescues?

`MISSING.md` M-240's open half, under
`quality/BOUNDED_SCHEMA_WINDOW_PREREGISTRATION.md`, which was committed
before this file existed.  The entry names the remedy -- a door that
considers a pair only within a bounded LINE DISTANCE, making the stream
linear and removing the candidate-explosion wall -- and says in the same
breath what it owes first: **the null**, which is what fraction of today's
rescues lie beyond the window.

    python3 quality/schema_window.py            the distribution and the table
    python3 quality/schema_window.py --check    against the pins, exit 3

WHAT THIS MEASURES AND WHAT IT DOES NOT, said before any number (doctrine
20).  It measures RETENTION exactly: windowing can only REMOVE pairs from
the door's question, so the count of rescues at distance <= W is exactly the
count a windowed door could still rescue.  It does NOT measure the
registration's E4 -- whether a verdict MOVES for a pair INSIDE the window --
because some schemas read the whole stream (the refrain tail, the stanza
frame), so a narrower stream could in principle change which names answer a
pair that stays.  E4 needs the windowed door itself, which is not built, and
this file does not pretend otherwise: an upper bound on what a window keeps
is not a proof that what it keeps is unchanged.

THE WINDOWS ARE THE REGISTERED ONES AND THE SELECTION RULE IS THE REGISTERED
ONE.  Neither is chosen here, because a window picked after seeing the table
is doctrine 19's argmax over a swept parameter wearing a histogram.
"""
import collections
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lyric_harness as LH  # noqa: E402

#: DECLARED IN THE REGISTRATION, not here, and read from nowhere else.
WINDOWS = (2, 4, 8, 16, 32)

#: The registered bar. The adopted window is the SMALLEST declared window
#: retaining at least this share on EVERY population; if none does, the
#: remedy is REFUSED rather than adopted at a lower bar.
RETENTION_FLOOR = 0.990

#: The figures `--check` holds, banked from the registered run. Keyed by
#: population -> {"rescues": n, "by_distance": {distance: count}}.
#: THE REGISTERED RUN, 2026-09-18. Every one of the battery's 17 rescues
#: sits at line distance exactly 2, which is not a finding about schemas: the
#: sonnet scheme binds one pair at distance 1 and six at distance 2 per item,
#: so 2 is the furthest a rescue COULD be. E2 fires and the reading is
#: refused. The pin is banked anyway, because the distribution moving is
#: itself worth a red -- a rescue appearing at distance 1, or the count
#: leaving 17, means the population this refusal describes has changed.
#:
#: ~~{"rescues": 17, "by_distance": {2: 17}}~~ REPINNED 2026-09-24 ->
#: {"rescues": 31, "by_distance": {2: 29, 1: 2}}, THE N-RELATION MODEL (#375,
#: integrated by #380). Superseded rather than overwritten (doctrine 17), and
#: the red did exactly what the paragraph above banked it for -- the count
#: left 17 and a rescue appeared at distance 1 -- but it first fired on the
#: WRONG population, and that is recorded before the right one:
#:   * CI measured {"rescues": 924, "by_distance": {2: 782, 1: 142}}. That was
#:     not a rescue count. `pairs_schema_satisfied` became EVERY judged pair
#:     standing in a schema once every pair is asked every relation, and this
#:     file read it as the rescued subset. Repinning 924 would have banked a
#:     count whose meaning had changed.
#:   * The rescue population is now read from `schema_end_reading.
#:     schema_only()` -- satisfied by a schema and by no coarse relation, the
#:     registration's set defined by membership rather than by order -- so
#:     both runners name one set (doctrine 1).
#: RE-MEASURED over that set: 31, of which 29 at distance 2 and 2 at
#: distance 1. The 17 are all still there; the 14 entrants were coarse RHYME
#: passes before `nucleus_agreement` defaulted to "licensed" (per-pair
#: attribution in `schema_end_reading.PINNED`'s note), and the two at
#: distance 1 are both entrants, both closing couplets (advance/ignorance,
#: monument/spent). E2 STILL FIRES: the mandate's furthest binding is still
#: 2, so retention is still 100% by construction and still refused as
#: evidence for a window.
PINNED = {
    "sonnets": {"rescues": 31, "by_distance": {2: 29, 1: 2}},
}


def rescue_distances(population="sonnets"):
    """-> Counter of |j - i| over every mandated pair the schema door rescues.

    Reuses `schema_end_reading`'s route rather than opening a second one: it
    reads `check_scheme`'s own report, which is the battery's route and the
    one `Reviser.grade` shares (doctrine 1). AND ITS DEFINITION OF A RESCUE,
    `schema_only()`, since 2026-09-24: the report's `pairs_schema_satisfied`
    lists every pair standing in a schema under the N-relation model, not the
    rescued subset, and reading it raw is what turned this pin red at 924.
    """
    from quality import schema_end_reading as SER
    lex = LH.Lexicon()
    decl = LH.Declaration()
    dist = collections.Counter()
    mand = collections.Counter()
    names_beyond = collections.Counter()
    total = 0
    # THE MANDATE'S OWN DISTANCES ARE MEASURED BESIDE THE RESCUES, and they
    # are the registration's E2 made mechanical. A window can look free
    # because the SCHEMAS are local or because the MANDATE never reaches
    # past it, and those are different findings about different layers. The
    # ceiling is read from the scheme itself, so no rescue can be further
    # apart than the furthest pair the mandate binds.
    scheme = SER.SONNET_SCHEME
    for a in range(len(scheme)):
        for b in range(a + 1, len(scheme)):
            if scheme[a] == scheme[b]:
                mand[b - a] += 1
    for sn in SER.sonnet_units():
        rep = LH.check_scheme(lex, sn, scheme, decl)
        for r in SER.schema_only(rep):
            i, j = r["lines"][0], r["lines"][1]
            d = abs(int(j) - int(i))
            dist[d] += 1
            total += 1
            if d > WINDOWS[0]:
                names_beyond.update(r.get("satisfied_by") or ())
    return dist, total, names_beyond, mand


def retention(dist, total, window):
    """-> the share of rescues at line distance <= window.

    An UPPER BOUND on what a windowed door keeps, never a claim that what it
    keeps is judged identically (see this module's header).
    """
    if not total:
        return float("nan")
    return sum(c for d, c in dist.items() if d <= window) / total


def main(argv):
    check = "--check" in argv
    dist, total, beyond, mand = rescue_distances()
    print("THE SCHEMA DOOR'S RESCUES BY LINE DISTANCE (MISSING.md M-240)")
    print("  registered in quality/BOUNDED_SCHEMA_WINDOW_PREREGISTRATION.md "
          "before this runner existed")
    print(f"\n  sonnets: {total} rescue(s) over the maintained battery")
    if not total:
        raise SystemExit(
            "REFUSED — no rescue to measure, and a distribution over nothing "
            "is not a distribution (doctrine 20).")
    for d in sorted(dist):
        print(f"    distance {d:>3}: {dist[d]:>4} "
              f"({100.0 * dist[d] / total:5.1f}%)")
    print(f"\n  {'window':>8}{'retained':>12}{'clears the floor':>20}")
    adopted = None
    for w in WINDOWS:
        r = retention(dist, total, w)
        ok = r >= RETENTION_FLOOR
        if ok and adopted is None:
            adopted = w
        print(f"  {w:>8}{100.0 * r:>11.1f}%{('yes' if ok else 'no'):>20}")
    print(f"\n  the registered floor is {100.0 * RETENTION_FLOOR:.1f}% on "
          f"EVERY population, and this runner measures ONE of the three the "
          f"registration names,")
    print("  so it CANNOT adopt a window by itself — it reports the smallest "
          "that clears here and nothing more.")
    print(f"  smallest declared window clearing the floor on this population: "
          f"{adopted if adopted is not None else 'NONE'}")
    # E2, AND ON THIS POPULATION IT FIRES. Reported as a REFUSAL of the
    # reading rather than as a result, because a retention of 100% at every
    # window is not evidence about schemas when the mandate cannot reach
    # past the smallest one.
    m_max = max(mand) if mand else 0
    print(f"\n  THE MANDATE'S OWN DISTANCES: "
          + ", ".join(f"{d}: {c} pair(s) per item" for d, c in sorted(mand.items()))
          + f" — furthest binding {m_max}")
    if m_max <= min(WINDOWS):
        print(f"  E2 FIRES. The furthest pair this mandate binds is {m_max}, "
              f"at or inside the smallest declared window ({min(WINDOWS)}), so "
              f"NO rescue")
        print("  on this population CAN lie beyond any window and the "
              "retention column above is 100% BY")
        print("  CONSTRUCTION. It is a fact about the sonnet scheme, not "
              "about the schema door, and it")
        print("  is REFUSED as evidence for a window (doctrine 20: "
              "inconclusive by construction is not a null).")
        print("  The window question needs a population whose mandate reaches "
              "further — the corpus items")
        print("  under a recovered cover, and the shipped drafts, which the "
              "registration names and this")
        print("  runner does not yet measure.")
    if beyond:
        print(f"  schemas answering a rescue beyond the smallest window: "
              + ", ".join(f"{n} {c}" for n, c in beyond.most_common(6)))
    print("\n  NOT MEASURED HERE (the registration's E4): whether a pair that "
          "STAYS inside a")
    print("  window is judged identically by a narrower stream. That needs "
          "the windowed door,")
    print("  which is not built, and retention is an upper bound rather than "
          "a proof.")
    if not check:
        return 0
    bad = 0
    want = PINNED.get("sonnets")
    if want is None:
        print("\n  [ok  ] sonnets carries no pin yet — the registered run "
              "banks one")
    else:
        got = {"rescues": total, "by_distance": dict(dist)}
        ok = got == want
        bad += 0 if ok else 1
        print(f"\n  [{'ok  ' if ok else 'FAIL'}] sonnets committed {want}, "
              f"measured {got}")
    print()
    if bad:
        print("RESULT: FAIL — the rescue distribution moved; any window "
              "chosen against the old one is describing a population it no "
              "longer measures.")
        return 3
    print("RESULT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

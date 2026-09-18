#!/usr/bin/env python3
"""Does the whole-vocabulary schema door rescue pairs a listener hears as
end rhyme, or pairs it does not?  (`MISSING.md` M-140, registered in
`quality/SCHEMA_END_READING_PREREGISTRATION.md` before this file existed.)

THREE COUNTS, NEVER SUMMED (doctrine 79): scalar passes, rescues whose
answering schema is AUDIBLE at a line end, and rescues whose answering
schema is not.  The third is the population M-140 is about -- a pair that
satisfies a schema and nothing else, printed today under a heading a reader
takes as end rhyme.

THE PREDICATE IS M-120's AND IS NOT RE-DERIVED HERE.
`relations.audible_as_end_rhyme` asks whether BOTH member spans read the
line-final token AND the schema requires the nucleus AND the coda to agree.
A rescue counts AUDIBLE when ANY answering schema is, which is the
conservative direction for the registered hypothesis: `any` can only move a
pair INTO the audible half, so it can only make H harder to hold.

NOTHING HERE GRADES OR MOVES A VERDICT.  It reads `check_scheme`'s own
report -- the battery's route, not a second one (doctrine 1) -- and counts.

    python3 quality/schema_end_reading.py            the three counts
    python3 quality/schema_end_reading.py --check    against the pins, exit 3
"""
import collections
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lyric_harness as LH  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SONNET_SCHEME = "ABABCDCDEFEFGG"

#: THE FIGURES `--check` HOLDS, banked from the registered run.  Keyed by
#: population; each value is (scalar, schema_audible, schema_inaudible).
#: Exact rather than banded: these are counts over fixed text through a
#: deterministic judge, so a band would only hide a real move (doctrine 57
#: applies to a figure fed by a DRAW, and none of these is).
#: THE REGISTERED RUN, 2026-09-18. `sonnets` = (scalar, audible, inaudible).
#: CONTROLLED AGAINST THE MAINTAINED BATTERY'S OWN QUADRUPLE and not merely
#: banked: 946 scalar + 17 rescues + 4 violations = 967 JUDGED against 97
#: REFUSED, which is `battery.py`'s recorded `1,064 mandated, 967 judged, 97
#: refused, 4 violations` to the pair. A split that did not reproduce that
#: would be measuring a different population than the oracle does.
#:
#: THE REGISTERED HYPOTHESIS HOLDS AND NEITHER FALSIFIER FIRES. 2 of 17
#: rescues (11.8%) are AUDIBLE and 15 (88.2%) are not, so the door does
#: rescue end-rhyme readings and mostly rescues something else — E1 needed an
#: empty inaudible half and E2 an empty audible one.
PINNED = {
    "sonnets": (946, 2, 15),
}


def sonnet_units(path=None):
    from battery import parse_sonnets, corpus_path
    return parse_sonnets(path or corpus_path("sonnets.txt"))


def audible_names():
    """-> the registry schema names `audible_as_end_rhyme` accepts.

    Derived at call time from the registry rather than listed, so a schema
    added or re-declared moves this set by itself (doctrine 1).
    """
    from quality import relations as RL
    out = set()
    for name, schema in RL.REGISTRY.items():
        try:
            if RL.audible_as_end_rhyme(schema):
                out.add(name)
        except Exception:
            continue
    return out


def classify(report, audible):
    """-> (scalar, schema_audible, schema_inaudible, violations, refused,
    Counter of names).

    `scalar` IS DERIVED FROM THE REPORT'S OWN TRIPLE, NOT FROM A KEY THAT IS
    NOT THERE.  The first draft of this function read `verdicts`, which is
    `quality.revise.grade`'s key and not `check_scheme`'s, so `len(None or
    ())` was 0 and every population came back with a NEGATIVE scalar count.
    It is recorded because a negative count is the one arithmetic this
    repository can always catch and this one printed before it was caught:
    `judged` is the denominator here, and a scalar pass is a judged pair that
    neither violated nor needed a rescue.

    NEVER SUMMED with the other two in any rendering -- they answer different
    questions about the same pairs (doctrine 79), and `refused` is kept out
    of all of them because a refusal is an ingestion verdict reached before
    any comparison.
    """
    rescues = report.get("pairs_schema_satisfied") or ()
    aud = inaud = 0
    names = collections.Counter()
    for r in rescues:
        got = tuple(r.get("satisfied_by") or ())
        names.update(got)
        if any(n in audible for n in got):
            aud += 1
        else:
            inaud += 1
    judged = int(report.get("pairs_judged") or 0)
    viol = len(report.get("violations") or ())
    refused = int(report.get("pairs_refused") or 0)
    return judged - viol - len(rescues), aud, inaud, viol, refused, names


def run():
    lex = LH.Lexicon()
    decl = LH.Declaration()
    audible = audible_names()
    out = {}
    scal = aud = inaud = viol = refused = 0
    names = collections.Counter()
    for sn in sonnet_units():
        rep = LH.check_scheme(lex, sn, SONNET_SCHEME, decl)
        a, b, c, v, rf, nm = classify(rep, audible)
        scal += a
        aud += b
        inaud += c
        viol += v
        refused += rf
        names.update(nm)
    out["sonnets"] = (scal, aud, inaud, viol, refused, names)
    return out, audible


def main(argv):
    check = "--check" in argv
    out, audible = run()
    print("THE SCHEMA DOOR'S END-RHYME READING, SPLIT (MISSING.md M-140)")
    print(f"  {len(audible)} of the registry's schemas are AUDIBLE at a line "
          f"end by `relations.audible_as_end_rhyme` — both spans at the "
          f"line-final token, nucleus AND coda required to agree")
    bad = 0
    for pop, (scal, aud, inaud, viol, refused, names) in sorted(out.items()):
        resc = aud + inaud
        if scal < 0:
            raise SystemExit(
                f"REFUSED — {pop} reports {scal} scalar passes, and a count "
                f"below zero is an arithmetic error rather than a finding "
                f"(doctrine 79). judged/violations/rescues disagree.")
        print(f"\n  {pop}: {scal} scalar pass(es), {resc} schema rescue(s), "
              f"{viol} violation(s), {refused} refusal(s) — the last kept "
              f"apart, an ingestion verdict before any comparison")
        print(f"    of the rescues — AUDIBLE {aud}"
              + (f" ({100.0 * aud / resc:.1f}%)" if resc else "")
              + f", NOT AUDIBLE {inaud}"
              + (f" ({100.0 * inaud / resc:.1f}%)" if resc else ""))
        print("    three counts, never summed: a scalar pass, an end-rhyme "
              "reading, and a relation")
        print("    the grade judges correctly and a listener does not hear "
              "as the lines rhyming")
        if names:
            print("    answering schemas: "
                  + ", ".join(f"{n} {c}" for n, c in names.most_common(8))
                  + (" …" if len(names) > 8 else ""))
        want = PINNED.get(pop)
        if check:
            if want is None:
                print(f"  [ok  ] {pop} carries no pin yet — the registered "
                      f"run banks one")
            else:
                got = (scal, aud, inaud)
                ok = got == tuple(want)
                bad += 0 if ok else 1
                print(f"  [{'ok  ' if ok else 'FAIL'}] {pop} committed "
                      f"{tuple(want)}, measured {got}")
    if not check:
        return 0
    print()
    if bad:
        print("RESULT: FAIL — a banked split moved; the reporting rule is "
              "describing a population it no longer measures.")
        return 3
    print("RESULT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

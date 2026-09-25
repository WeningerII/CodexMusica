#!/usr/bin/env python3
"""Does the whole-vocabulary schema door rescue pairs a listener hears as
end rhyme, or pairs it does not?  (`MISSING.md` M-140, registered in
`quality/SCHEMA_END_READING_PREREGISTRATION.md` before this file existed.)

THREE COUNTS, NEVER SUMMED (doctrine 79): coarse passes (the registration's
`scalar`), rescues whose answering schema is AUDIBLE at a line end, and
rescues whose answering schema is not.  The third is the population M-140 is
about -- a pair that satisfies a schema and nothing else, printed today under
a heading a reader takes as end rhyme.

"RESCUE" IS THE REGISTRATION'S WORD FOR A SET, AND SINCE THE N-RELATION MODEL
(2026-09-24) IT IS DEFINED BY MEMBERSHIP, NOT BY ORDER.  `check_scheme` now
asks every coarse relation AND every registry schema of every mandated pair,
so a schema is no longer a second pass over the coarse chain's failures and
`pairs_schema_satisfied` no longer holds a rescued subset -- it holds EVERY
judged pair standing in a schema.  The registered population is recovered
exactly by `schema_only()`: satisfied, and `check_scheme`'s own coarse verdict
is not True, so the satisfaction rests on a schema alone.

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
#:
#: ~~(946, 2, 15)~~ REPINNED 2026-09-24 -> (896, 2, 29), THE N-RELATION
#: MODEL (#375, integrated by #380; layer: comparator + structure). Superseded
#: rather than overwritten (doctrine 17), and the INSTRUMENT WAS REPAIRED IN
#: THE SAME COMMIT, because the first thing the model moved was the meaning of
#: the key this file read:
#:   * `pairs_schema_satisfied` stopped being the rescued subset and became
#:     EVERY judged pair standing in a schema (924 on the battery). Read as
#:     rescues it measured (3, 782, 142): the "3" was the coarse passes that
#:     stand in NO schema -- positive, so the negative-count guard below could
#:     not catch it -- and the 782/142 split a population 96% coarse-satisfied,
#:     which the registration's H never asked about. Repinning THAT would have
#:     been re-numbering a count whose meaning had changed.
#:   * `schema_only()` recovers the registered set by membership, and
#:     `classify` now derives all three counts directly and REFUSES unless
#:     they close on `pairs_judged` with the violations.
#: RE-MEASURED, and the control still holds: 896 + 31 + 9 = 936 judged
#: against 128 refused, which is `battery.py`'s repinned `1,064 mandated,
#: 936 judged, 128 refused, 9 violations` to the pair.
#: WHICH PAIRS MOVED, per (sonnet, line_i, line_j) against the pre-model tree
#: (merge base 1f9678e6, where this pin was green), not inferred from the
#: totals: ALL 17 former rescues are still schema-only with the same split
#: (2 audible, 15 not); 14 ENTERED and none left. Every entrant was a coarse
#: RHYME pass before (0.787..0.901 -- eloquence/recompense, invent/excellent,
#: presage/age, monument/spent ...) that stands in NO coarse relation once
#: `nucleus_agreement` defaults to "licensed", and is satisfied by schemas
#: alone; NONE of the 14 is audible. The same run's other movements are
#: `battery.py`'s own: 34 former coarse passes now refuse and 2 violate
#: (argument/spent). The audible predicate did not move (19 schemas either
#: side).
#: H STILL HOLDS AND NEITHER FALSIFIER FIRES: 2 of 31 schema-only
#: satisfactions (6.5%) are AUDIBLE and 29 (93.5%) are not.
PINNED = {
    "sonnets": (896, 2, 29),
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


def _judged_pairs(report):
    """-> (judged pairs, violated pairs, coarse verdict by pair), all read off
    `check_scheme`'s own report: the mandate from its `scheme` through the
    spine's own `same_scheme_class`, less its `refusals`."""
    scheme = report["scheme"]
    n = len(scheme)
    refused = {tuple(r["lines"]) for r in report.get("refusals") or ()}
    judged = [(i + 1, j + 1) for i in range(n) for j in range(i + 1, n)
              if LH.same_scheme_class(scheme[i], scheme[j])
              and (i + 1, j + 1) not in refused]
    violated = {(v[0], v[1]) for v in report.get("violations") or ()}
    verdict = {tuple(p["lines"]): p.get("reading_verdict")
               for p in report.get("pair_scores") or ()}
    return judged, violated, verdict


def schema_only(report):
    """-> the `pairs_schema_satisfied` records whose pair is satisfied by a
    SCHEMA AND NOTHING ELSE -- the registration's rescue population, under the
    N-relation model.

    A record qualifies when its pair is judged, is not a violation, and
    `check_scheme`'s COARSE verdict for it (`reading_verdict`: every permitted
    endpoint reading admits at `decl.admit`, each relation at its own cut) is
    not True. That is the branch `check_scheme` itself takes -- a pair whose
    coarse verdict is True is satisfied there before any schema is read -- so
    this reads the judge's decision rather than re-deriving it (doctrine 1).

    NOT A RESCUE IN SEQUENCE. Both halves are asked of every pair and neither
    is a rescue for the other; what survives of the word is the SET the
    registration named, "the scalar door fails and the schema door
    satisfies", which is an intersection and has no order. The name follows
    `near_relation_pricing.reprice`'s `schema_only`, the integration line's
    own rename of `rescued`. `schema_window` reads the same set from here, so
    the two runners cannot drift apart about what a rescue is.
    """
    judged, violated, verdict = _judged_pairs(report)
    judged = set(judged)
    out = []
    for r in report.get("pairs_schema_satisfied") or ():
        pr = tuple(r["lines"])
        if pr in judged and pr not in violated and verdict.get(pr) is not True:
            out.append(r)
    return out


def classify(report, audible):
    """-> (coarse, schema_audible, schema_inaudible, violations, refused,
    Counter of names). `coarse` is the registration's `scalar`.

    `scalar` IS DERIVED FROM THE REPORT'S OWN TRIPLE, NOT FROM A KEY THAT IS
    NOT THERE.  The first draft of this function read `verdicts`, which is
    `quality.revise.grade`'s key and not `check_scheme`'s, so `len(None or
    ())` was 0 and every population came back with a NEGATIVE scalar count.
    It is recorded because a negative count is the one arithmetic this
    repository can always catch and this one printed before it was caught:
    `judged` is the denominator here, and a scalar pass is a judged pair that
    neither violated nor needed a rescue.

    AND THE SECOND TIME IT WAS POSITIVE, SO THE GUARD ABOVE COULD NOT SEE IT
    (2026-09-24). `judged - violations - len(pairs_schema_satisfied)` was
    exact while that key held only rescues. Under the N-relation model it
    holds every pair standing in a schema, and the subtraction printed **3**
    scalar passes on the battery -- the coarse passes standing in no schema, a
    count nobody asked for, arithmetic that closed only because it was
    defined to. So each count is now derived DIRECTLY -- a coarse pass is a
    judged, unviolated pair whose coarse verdict is True, a rescue is
    `schema_only()` -- and the three with the violations must CLOSE on
    `pairs_judged`. When they do not, the report's keys have changed meaning
    under this reader again and it REFUSES rather than printing a split.

    NEVER SUMMED with the other two in any rendering -- they answer different
    questions about the same pairs (doctrine 79), and `refused` is kept out
    of all of them because a refusal is an ingestion verdict reached before
    any comparison.
    """
    judged, violated, verdict = _judged_pairs(report)
    coarse = sum(1 for pr in judged
                 if pr not in violated and verdict.get(pr) is True)
    rescues = schema_only(report)
    aud = inaud = 0
    names = collections.Counter()
    for r in rescues:
        got = tuple(r.get("satisfied_by") or ())
        names.update(got)
        if any(n in audible for n in got):
            aud += 1
        else:
            inaud += 1
    n_judged = int(report.get("pairs_judged") or 0)
    viol = len(report.get("violations") or ())
    refused = int(report.get("pairs_refused") or 0)
    if len(judged) != n_judged or coarse + len(rescues) + viol != n_judged:
        raise SystemExit(
            f"REFUSED — the partition does not close: {coarse} coarse + "
            f"{len(rescues)} schema-only + {viol} violations against "
            f"{n_judged} judged ({len(judged)} re-derived from the mandate). "
            f"A judged pair is exactly one of the three, so a key of "
            f"`check_scheme`'s report has changed meaning under this reader "
            f"(doctrine 79).")
    return coarse, aud, inaud, viol, refused, names


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
                f"REFUSED — {pop} reports {scal} coarse passes, and a count "
                f"below zero is an arithmetic error rather than a finding "
                f"(doctrine 79). judged/violations/rescues disagree.")
        print(f"\n  {pop}: {scal} coarse pass(es), {resc} schema-only "
              f"satisfaction(s) (the registration's rescues), {viol} "
              f"violation(s), {refused} refusal(s) — the last kept apart, an "
              f"ingestion verdict before any comparison")
        print(f"    of the schema-only — AUDIBLE {aud}"
              + (f" ({100.0 * aud / resc:.1f}%)" if resc else "")
              + f", NOT AUDIBLE {inaud}"
              + (f" ({100.0 * inaud / resc:.1f}%)" if resc else ""))
        print("    three counts, never summed: a coarse pass, an end-rhyme "
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

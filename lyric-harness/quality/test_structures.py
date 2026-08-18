#!/usr/bin/env python3
"""Regressions for the structure catalog (quality/structures.py) — Phase A/B
of the owner's widening: a mandate names a declared structure per group, and
adding one is transcribing a row, never writing code.

Sections:
  1  the catalog's shape — rows, kinds, the sentinel, world aliases
  2  the judges answer each tradition's OWN question — skothending on the
     coda alone, Kalevala on onsets, masculine rhyme refusing identity
  3  refusals — the sentinel routes to grade(), unknown names refuse,
     a refused pair is None and never False
  4  the mandate learns the coordinate — per-group declaration, aliases,
     refusals in the mandate layer's own type, the re-open path
  5  grade() routes a mandated pair through its row's judge — pass, fail
     and refusal, each distinguishable, each carried in the verdict
  6  the laziness instruments are end-rhyme's — skipped under a declared
     structure, and the uncalibrated declaration is said out loud ONCE
  7  the planner samples structures from CALIBRATED rows only

Run: python3 quality/test_structures.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality import structures as ST  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_the_catalog():
    print("\n1. the catalog — declared rows on one engine")
    kinds = {}
    for s in ST.STRUCTURES.values():
        kinds[s.kind] = kinds.get(s.kind, 0) + 1
    check("58 declared structures: 1 comparator sentinel, 9 presets, 48 "
          "named axis cells — the 49 named types plus the shipped presets, "
          "as DATA",
          len(ST.STRUCTURES) == 58 and kinds == {"comparator": 1,
                                                 "preset": 9, "cell": 48},
          kinds)
    check("the default is the sentinel and resolves to itself",
          ST.DEFAULT == "english-end-rhyme"
          and ST.resolve(ST.DEFAULT) == ST.DEFAULT
          and ST.get(ST.DEFAULT).kind == "comparator")
    # The resolves are caught so a mutant that drops the alias table fails
    # THIS check by name instead of crashing the suite on an unhandled
    # refusal — red by accident is not the standard (mutation M19's first
    # run taught the same lesson M7's did).
    try:
        aliases_ok = (ST.resolve("qafiya") == "masculine-rhyme"
                      and ST.resolve("antya-prasa") == "masculine-rhyme"
                      and ST.resolve("single-rhyme") == "masculine-rhyme")
    except ST.StructureRefused as e:
        aliases_ok, _detail = False, str(e)[:60]
    check("the world's own names resolve — masculine rhyme IS qafiya IS "
          "antya-prasa, one row, three traditions' vocabulary", aliases_ok)
    check("spaces in a declared name are the hyphens of its row",
          ST.resolve("masculine rhyme") == "masculine-rhyme")


def test_the_judges():
    print("\n2. each judge asks its OWN tradition's question")
    table = [
        # (structure, a, b, want, why)
        ("drottkvaett-hending", "winter", "canter", True,
         "skothending: coda N agrees, vowels differ — the tradition's "
         "half-rhyme, and the generic nucleus+coda predicate would REFUSE "
         "it, which is why the judge reads the preset's own select"),
        ("drottkvaett-hending", "silver", "dreaming", False,
         "no coda agreement at the hending anchors"),
        ("drottkvaett-hending", "storm", "arm", None,
         "a fixed-index -2 anchor has no referent in one syllable: the "
         "question has no coordinates here — REFUSED, not failed"),
        ("kalevala-alliteration", "wind", "winter", True,
         "onset W agrees at the head anchor"),
        ("kalevala-alliteration", "wind", "storm", False, ""),
        ("masculine-rhyme", "night", "delight", True, ""),
        ("masculine-rhyme", "night", "night", False,
         "the cell demands identity 'distinct': the identical word is not "
         "a masculine rhyme"),
        ("masculine-rhyme", "night", "dream", False, ""),
        ("cynghanedd-lusg", "growing", "slow", True,
         "the llusg reach: the penult rhymes an earlier syllable"),
    ]
    for name, a, b, want, why in table:
        got = ST.judge(name, a, b)
        check(f"{name}: {a}/{b} -> {want}" + (f" — {why}" if why else ""),
              got is want if want is None else got == want, f"got {got}")


def test_refusals():
    print("\n3. refusals, never defaults")
    try:
        ST.judge("english-end-rhyme", "night", "delight")
        check("the sentinel REFUSES to judge — the default is graded by "
              "the scalar comparator and the declared admit set inside "
              "grade(), and a second implementation would drift", False)
    except ST.StructureRefused as e:
        check("the sentinel REFUSES to judge — the default is graded by "
              "the scalar comparator and the declared admit set inside "
              "grade(), and a second implementation would drift",
              "grade()" in str(e), str(e)[:60])
    try:
        ST.resolve("vibes-rhyme")
        check("an unknown name refuses, naming the vocabulary", False)
    except ST.StructureRefused as e:
        check("an unknown name refuses, naming the vocabulary",
              "58 structures" in str(e), str(e)[:70])
    check("no row is unnamed — a coordinate without a name cannot be "
          "MANDATED by name, so it is not a row",
          all(s.name for s in ST.STRUCTURES.values()))


def test_mandate_coordinate():
    print("\n4. the mandate learns the coordinate")
    from quality import schemes as SC
    m = SC.mandate([[1, 2], [3, 4]], n_lines=4,
                   structures={"B": "kalevala-alliteration"})
    check("a dict by label lands index-aligned, '' meaning default",
          m.structures == ("", "kalevala-alliteration"), m.structures)
    check("structure_of resolves absence to the sentinel and presence to "
          "the row",
          m.structure_of(0) == ST.DEFAULT
          and m.structure_of(1) == "kalevala-alliteration")
    m_alias = SC.mandate([[1, 2]], n_lines=2, structures={"A": "qafiya"})
    check("an alias declaration is STORED canonical — qafiya is the row "
          "masculine-rhyme, so downstream never re-resolves",
          m_alias.structures == ("masculine-rhyme",), m_alias.structures)
    m_list = SC.mandate([[1, 2], [3, 4]], n_lines=4,
                        structures=["", "cynghanedd-lusg"])
    check("the list spelling works and short lists leave the tail default",
          m_list.structures == ("", "cynghanedd-lusg"))
    # Refusals arrive as the MANDATE layer's own type: every CLI surface
    # turns NoMandate into `REFUSED` at exit 2, and a StructureRefused
    # escaping mandate() would be the right refusal in the wrong layer's
    # words (the undecodable-file lesson, one layer over).
    for label, kwargs in [
            ("an unknown structure name", {"structures": {"A": "vibes"}}),
            ("a label naming no group", {"structures": {"Z": ST.DEFAULT}}),
            ("an overlong list", {"structures": [ST.DEFAULT] * 3}),
    ]:
        try:
            SC.mandate([[1, 2]], n_lines=2, **kwargs)
            check(f"{label} refuses as NoMandate", False)
        except SC.NoMandate:
            check(f"{label} refuses as NoMandate", True)
        except ST.StructureRefused as e:
            check(f"{label} refuses as NoMandate", False,
                  f"escaped as StructureRefused: {str(e)[:50]}")
    m0 = SC.mandate([[1, 2], [3, 4]], n_lines=4)
    m1 = SC.mandate(m0, structures={"B": "kalevala-alliteration"})
    check("the re-open path carries a late declaration — before it joined "
          "the re-open condition this was DROPPED at the idempotence "
          "branch, byte-identical to never declaring it",
          m1.structures == ("", "kalevala-alliteration")
          and m1.groups == m0.groups)
    check("...and the origin names what was re-declared, not '+ returns'",
          m1.origin.endswith("+ structures"), m1.origin)
    check("idempotence itself is untouched",
          SC.mandate(m0) is m0 and SC.mandate(m1) is m1)


def _reviser():
    from quality.revise import Reviser
    return Reviser()


def test_grade_routing():
    print("\n5. grade() routes a mandated pair through its row's judge")
    # HAND-PROVEN MUTATION (2026-08-18): forcing the routing gate off
    # (`_ST = None` unconditionally in grade()) reds the first two checks
    # here by name — the kalevala pair is then judged by the scalar
    # comparator, B lands in violations, and the verdict's structure key
    # goes None under a declared coordinate.
    from quality import schemes as SC
    R = _reviser()
    lines = ["the night was cold and bright",
             "we held each other tight",
             "we walked beneath the sun",
             "and rivers ran with silver"]
    m = SC.mandate([[1, 2], [3, 4]], n_lines=4,
                   structures={"B": "kalevala-alliteration"})
    rep = R.grade(lines, m)
    check("sun/silver SATISFY the declared alliteration (onset S at the "
          "head anchor) — no B violation, where the default end-rhyme "
          "question fails the same pair",
          not any(v["label"] == "B" for v in rep["violations"]),
          [v["label"] for v in rep["violations"]])
    check("every verdict names the judge that answered — the row under a "
          "declared coordinate, the sentinel for its default groups",
          {v["label"]: v["structure"] for v in rep["verdicts"]}
          == {"A": ST.DEFAULT, "B": "kalevala-alliteration"})
    m0 = SC.mandate([[1, 2], [3, 4]], n_lines=4)
    rep0 = R.grade(lines, m0)
    check("CONTROL — the same draft under the same groups with no "
          "structures declared: B is a violation (sun/silver do not "
          "end-rhyme) and the structure key is None on every verdict, "
          "so no pre-catalog path moved",
          any(v["label"] == "B" for v in rep0["violations"])
          and all(v["structure"] is None for v in rep0["verdicts"]))
    lines_f = lines[:2] + ["the moon above the bay", "we danced the night "
                           "away"]
    rep_f = R.grade(lines_f, m)
    bad = [v for v in rep_f["violations"] if v["label"] == "B"]
    check("bay/away FAIL the declared alliteration, and the why names the "
          "structure and its own judge kind rather than the comparator",
          len(bad) == 1 and "kalevala-alliteration" in bad[0]["why"]
          and "preset judge" in bad[0]["why"],
          bad[0]["why"][:80] if bad else "no violation")
    # REFUSAL: both words read in CMUdict — an unreadable end word is the
    # OLDER refusal, taken before the structure judge runs — and the
    # structure's own judge declines (a fixed-index hending anchor with no
    # referent in a one-syllable member).
    m_r = SC.mandate([[1, 2], [3, 4]], n_lines=4,
                     structures={"B": "drottkvaett-hending"})
    lines_r = lines[:2] + ["we rode into the storm", "your hand upon my arm"]
    rep_r = R.grade(lines_r, m_r)
    srefs = [r for r in rep_r["refusals"]
             if "drottkvaett-hending" in r["reason"]]
    check("storm/arm is REFUSED, not failed — a refusal record naming the "
          "structure, doctrine 79 in its reason, group B in its groups",
          len(srefs) == 1 and "REFUSED, not failed" in srefs[0]["reason"]
          and srefs[0]["groups"] == ["B"]
          and srefs[0]["lines"] == (3, 4))
    check("...counted in pairs_refused and NEVER in violations",
          rep_r["pairs_refused"] >= 1
          and not any(v["label"] == "B" for v in rep_r["violations"]))
    f_r = _last_inspect(R, lines_r, m_r)
    check("...and it renders through inspect() as SCHEME_UNREADABLE "
          "without a KeyError — the record minted mid-loop carries its "
          "own 'groups'",
          any(x.code == "SCHEME_UNREADABLE"
              for fs in f_r["per_line"].values() for x in fs))


def _last_inspect(R, lines, m):
    return R.inspect(lines, m)


def test_laziness_scope_and_disclosure():
    print("\n6. end-rhyme laziness instruments: skipped under a declared "
          "structure, disclosed once")
    # HAND-PROVEN MUTATIONS (2026-08-18): (a) deleting the pair-check skip
    # reds the hair/chair check — HOMEOTELEUTON charges a pair whose
    # declared structure is not end-rhyme; (b) stubbing the disclosure
    # block reds the STRUCTURE_UNCALIBRATED count.
    from quality import schemes as SC
    R = _reviser()
    # hair/chair is the OWNER'S OWN bug-report pair: same spelled rime
    # -air, banned outright under the default. Under an explicitly
    # declared perfect-rhyme PRESET row the pair satisfies the structure
    # and the two-tier ban does not speak — its instruments (spelled-rime
    # class, eng-song modal table) are end-rhyme calibrations, and the
    # structure's own laziness regime does not exist yet, which is
    # exactly what the whole-draft note says out loud.
    lines = ["the night was cold and bright",
             "we held each other tight",
             "the wind was in her hair",
             "we sat in the old chair"]
    m = SC.mandate([[1, 2], [3, 4]], n_lines=4,
                   structures={"B": "perfect-rhyme"})
    f = R.inspect(lines, m)
    per = {(ln, x.code) for ln, fs in f["per_line"].items() for x in fs}
    check("the DEFAULT pair in the same draft is still charged — "
          "bright/tight is HOMEOTELEUTON on group A, so the skip is "
          "scoped to the declared structure and not a hole in the ban",
          (2, "HOMEOTELEUTON") in per, sorted(per))
    check("hair/chair under the declared perfect-rhyme row is NOT charged "
          "HOMEOTELEUTON or MODAL_RHYME — those are end-rhyme "
          "calibrations and this pair's question is a different row",
          not any(c in ("HOMEOTELEUTON", "MODAL_RHYME")
                  for ln, c in per if ln in (3, 4)), sorted(per))
    whole = [x.code for x in f["whole"]]
    check("the uncalibrated declaration is disclosed ONCE for the whole "
          "draft — a fact about the DECLARATION, not one per pair",
          whole.count("STRUCTURE_UNCALIBRATED") == 1, whole)
    note = next(x for x in f["whole"]
                if x.code == "STRUCTURE_UNCALIBRATED")
    check("...as a NOTE naming the row and saying laziness is NOT graded",
          note.severity == "note" and "perfect-rhyme" in note.message
          and "laziness is NOT graded" in note.message)
    m0 = SC.mandate([[1, 2], [3, 4]], n_lines=4)
    f0 = R.inspect(lines, m0)
    check("CONTROL — no structures declared: no disclosure, and "
          "hair/chair is charged HOMEOTELEUTON exactly as the owner's "
          "rule requires",
          "STRUCTURE_UNCALIBRATED" not in [x.code for x in f0["whole"]]
          and any(x.code == "HOMEOTELEUTON"
                  for x in f0["per_line"].get(4, [])))
    # DOCTRINE 8, MECHANICAL (2026-08-18): kalevala-alliteration IS
    # calibrated — for FINNISH — and this Reviser grades English, so the
    # disclosure still fires on an English draft declaring it. A regime
    # measured on one tradition is not silently applied to another; the
    # note now names the draft's language.
    lines_k = ["the night was cold and bright", "we held each other tight",
               "we walked beneath the sun", "and rivers ran with silver"]
    m_k = SC.mandate([[1, 2], [3, 4]], n_lines=4,
                     structures={"B": "kalevala-alliteration"})
    f_k = R.inspect(lines_k, m_k)
    kw = [x for x in f_k["whole"] if x.code == "STRUCTURE_UNCALIBRATED"]
    check("a fin-calibrated row declared on an ENGLISH draft still gets "
          "the disclosure — calibration is a fact about a language "
          "(doctrine 8), and the note says whose",
          len(kw) == 1 and "eng" in kw[0].message,
          kw[0].message[:90] if kw else "no note")


def test_planner_samples_calibrated():
    print("\n7. the planner samples rows calibrated FOR ITS OWN LANGUAGE")
    # HAND-PROVEN MUTATION (2026-08-18): dropping the language filter
    # reds the pool checks — under the retyped marker an unfiltered pool
    # would sample a Finnish-measured row into English plans.
    #
    # REPINNED BY THE KALEVALA ADOPTION (2026-08-18), and the repin is
    # NOT the one the earlier comment predicted: the pool did not grow.
    # The adoption's own registration carried a conflict — "the planner
    # pool grows to two" against its binding-scope non-claim (a table
    # fitted on one tradition is not quietly applied to another,
    # doctrine 8) — and the non-claim won. `calibrated` is a LANGUAGE
    # TUPLE now; the ENGLISH pool stays the sentinel until an English
    # signal corpus is measured, and kalevala-alliteration is calibrated
    # ("fin",), declarable, disclosed, and never auto-sampled here.
    from quality import plan as PL
    pool = sorted(s.name for s in ST.STRUCTURES.values()
                  if "eng" in s.calibrated)
    p = PL.make_plan(2)
    meta = p["choices"]["structures"]
    check("every function kind gets a structure choice, disclosed with "
          "its pool", bool(meta) and
          all(set(v) == {"name", "chosen_from"} for v in meta.values()))
    check("the pool IS the eng-calibrated set — derived from the rows' "
          "own language marker, not a hand copy",
          all(v["chosen_from"] == pool for v in meta.values()),
          {k: v["chosen_from"][:3] for k, v in meta.items()})
    check("every sampled name is calibrated for eng",
          all("eng" in ST.get(v["name"]).calibrated
              for v in meta.values()))
    check("the eng pool is exactly the comparator sentinel — the Kalevala "
          "adoption left it UNCHANGED, which is doctrine 8 holding",
          pool == [ST.DEFAULT], pool)
    check("kalevala-alliteration IS calibrated — for fin, and only fin — "
          "and is therefore not in the eng pool",
          ST.get("kalevala-alliteration").calibrated == ("fin",)
          and "kalevala-alliteration" not in pool)
    check("the same seed reproduces the same plan byte for byte",
          PL.make_plan(2) == p)


if __name__ == "__main__":
    for fn in (test_the_catalog, test_the_judges, test_refusals,
               test_mandate_coordinate, test_grade_routing,
               test_laziness_scope_and_disclosure,
               test_planner_samples_calibrated):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("58 structures, one engine, every row a declared question — "
          "and the mandate, the grader and the planner now read the same "
          "catalog")

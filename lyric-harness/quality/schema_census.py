#!/usr/bin/env python3
"""HOW MANY OF THE ~~77~~ SCHEMAS CAN BE ASKED, AND WHAT BLOCKS THE REST.

THE COUNT IS PRINTED, NOT WRITTEN HERE (2026-09-25, doctrine 48): `main()`
prints `REGISTRY <n> schemas` from `len(relations.REGISTRY)`, which is 78
since M-40 declared `chain rhyme (interlocking scheme)` (commit a61fe4e69,
2026-09-15), and `test_relations.py` pins that figure. This title said 77
for ten days after it stopped being true.

An instrument, not a scratch script (doctrine 69): the figure is quoted in
`MISSING.md` M-59 and in `CLAUDE.md`, and a number in prose that nothing
re-derives is a number that goes stale (doctrine 48).

IT COUNTS WHAT A WRITER CAN ACTUALLY REACH, not what a bare stream happens to
carry, because those are different questions and the difference is the whole
subject. Four capabilities are supplied BY THE ROUTE that needs them and never
by the caller: `caesura` (`quality/figures.py` calls `search_caesura`),
`refrain_tail` (`revise.grade` calls `mark_refrain_tail` with the mandate's own
groups), and — when the writer declares them — `stanza` (from a blueprint's
sections), `orthography`, `delivered` and `sung`. A census that built a bare
stream and stopped would report those as blockers, which is exactly the
mistake this file exists to stop repeating.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quality import relations as R                          # noqa: E402
from quality import rhyme_types as RT                       # noqa: E402
from quality.phonology import get as get_phonology          # noqa: E402
import lyric_harness as lh                                  # noqa: E402

DRAFT = ["the silver salmon slipped the stream again",
         "these old hands never asked for much again",
         "the river runs and will not turn again",
         "i felt the cold of your last touch again"]
SECTIONS = ["verse", "verse", "chorus", "chorus"]

#: SCHEMAS WHOSE CAPABILITY IS A LANGUAGE'S, NOT A CALLER'S. A census run on
#: an English stream CANNOT supply a Welsh vowel-class partition or a Middle
#: Chinese 同用 grouping, and reporting them as blocked would be reporting the
#: census's own monolingualism as a gap in the registry. Each is verified
#: below against its OWN phonology rather than excused.
#:
#: THIS COMMENT SAID "Both ARE supplied — by `quality/phonology/cym.py` and
#: `quality/phonology/ltc.py` respectively" (2026-08-22 to 2026-08-23,
#: doctrine 17). Half of it was true. `ltc` supplies 同用 from the Qieyun
#: table, a sourced document. `cym` supplied a vowel class for ONE DAY, out
#: of a circumflex rule that answers `short` for every unmarked long vowel in
#: Welsh; that came out again, and `quality/quotients.py` records why. So
#: `proest` now sits with `earlier` and `poet`: the SEAM is exercised, on a
#: fixture this census declares and labels, and the sourced table it would
#: need is not in this repo.
BY_LANGUAGE = {
    "cym": ("proest",),
    "ltc": ("Middle Chinese end rhyme (同用 group)", "平仄 tonal template"),
}

#: THE SCHEMAS THAT ANSWER ONLY BECAUSE THIS CENSUS DECLARED A FIXTURE, and
#: the whole reason this key exists (2026-08-23). `census()` reported 77 live,
#: and three of those 77 were live on a constructed input (doctrine 94) rather
#: than on anything this repo ships. A count that does not say so invites
#: exactly one misreading -- "77 working" -- and the misreading is the kind
#: this file was built to prevent, so the report NAMES them and `main()`
#: prints them under their own heading.
#:
#: Each is askable. Each REFUSES, correctly and by name, for a caller who
#: does not declare the resource. What is missing in every case is a
#: sourced TABLE, not code (doctrine 44) — and for `proest` the table's shape
#: as well; `quality/sourced_tables.UNSOURCED` names, per schema, the source
#: that would lift it and why it was not written.
#:
#: ~~FIVE~~ FOUR SINCE 2026-09-25. `平仄 tonal template` left this key when
#: `quality/sourced_tables.py` shipped Wang Li's 五絕 base patterns: the census
#: now declares the SOURCED 仄起 template over 登鸛雀樓 where it declared an
#: all-中 fixture, and the schema answers on a table this repo ships. Its row
#: read: "the `tonal_template` declaration — the regulated-verse 平/仄 pattern
#: is the FORM's, never the text's, so it arrives only by declaration; this
#: census declares an all-中 template over a real couplet."
FIXTURE_ONLY = {
    "rhyming slang": "the `slang` projected surface — this census declares "
                    "a constructed projection only. No sourced slang register "
                    "ships here; ordinary lexical data cannot supply it.",
    "historical rhyme": "the `earlier` period surface — a SOURCED earlier "
                        "reconstruction. `declared_inputs.PeriodPhonology` "
                        "refuses to build without a named one; this census "
                        "hands it a two-phoneme fixture.",
    "dialect rhyme": "the `poet` period surface — same constructor, same "
                     "fixture, a dialect this repo has not sourced.",
    "proest": "`quotient:vowel_class` — a Welsh vowel-quantity partition. "
              "RHYME_CANON R11 names quantity as part of the requirement and "
              "supplies no membership; `quality/quotients.py:vowel_class` is "
              "a coarse orthographic approximation whose error direction is "
              "written down there, and it is declared HERE, knowingly, so "
              "the seam is exercised — not in `cym.Welsh`, where it would be "
              "the harness answering for the tradition.",
}


#: WHY A NAMED SCHEMA IS STILL `unvalidated`, where the reason is KNOWN and
#: is not "nobody registered a witness" (`MISSING.md` M-313, 2026-09-25).
#: A blocker names the coordinate that is missing; the verdicts beside it are
#: never written here — `census()` measures them from the rows in
#: `relations.CONTEXT_CONTROLS` on every run (doctrine 48), and a row that
#: starts answering `[True, False]` leaves this table's text unused.
SEMANTIC_BLOCKERS = {
    # -- REPETITION FIGURES AND NON-ENGLISH PAIR RHYMES (M-313) -------------
    "homoioteleuton": (
        "the RULE is too generous (M-313 F8): `morpheme_affix` AGREE holds "
        "when neither word carries an affix ('' == ''), so a plain rhyme "
        "passes (Sonnet 18, day~May); and the inflectional `-er` row, which "
        "takes no productivity test, reads the monomorphemic flatter~matter "
        "(Sonnet 87's couplet) as one shared affix. The possessing~estimate "
        "contrast differs in rhyme as well as affix, so it could not show "
        "either. A finding against the rule; nothing in the morphology or a "
        "threshold was moved (doctrine 58)."),
    "antanaclasis": (
        "the `sense` coordinate: `Reviser.grade` builds its own stream and "
        "has no seam through which a caller declares senses "
        "(`relations.declare_senses`), so both controls refuse on 'sense'. "
        "The real witness (Sonnet 135) is registered and waits on the seam."),
    "refrain by reference": (
        "the `stub_resolution` coordinate: `Reviser.grade` has no seam for "
        "`declare_stub_resolution` or a declared `line_status`, so a real "
        "`&c.` pointer (Payne, staged corpus) and its non-referent both "
        "refuse. The seam, not the witness, is missing."),
    "incremental repetition": (
        "the SCHEMA: it is registered as whole-line token equality, and its "
        "own note says the one-slot diff R67 defines is not searched for. "
        "The canonical instance (Tennyson, `Cannon to right/left of them`) "
        "is therefore judged NOT to stand in it; only verbatim repetition "
        "does. A finding against the definition, not an exhibit to swap."),
    "qafiya (before the radif)": (
        "the LANGUAGE coordinate: its traditions are Arabic, Persian and "
        "Urdu only (`ara`, `fas`, `hin`); the grade route resolves English "
        "(`revise._relation_phonology`, M-4); `ara` and `hin` declare no "
        "phonology; and `fas` cannot decide a short-vowel qafiya from "
        "unvocalised script. An English stand-in would fake the tradition."),
    "dvitiyakshara-prasa": (
        "the LANGUAGE coordinate and the SHAPE: of its four traditions "
        "Telugu, Kannada and Tamil declare no phonology and Sanskrit's "
        "(`san`) is unreachable, since the grade route resolves English "
        "(M-4); and the "
        "figure quantifies FORALL over a STANZA frame, which a two-token "
        "mandate cannot carry (`pair_scope_representable` is False)."),
    "monai": (
        "the LANGUAGE coordinate and the SHAPE: Tamil declares no "
        "phonology, the grade route resolves English (M-4), and the figure "
        "quantifies FORALL over a STANZA frame, which a two-token mandate "
        "cannot carry (`pair_scope_representable` is False)."),
    # -- end of the M-313 block -------------------------------------------
}

def _full_stream():
    """A stream with every coordinate a writer CAN declare, declared."""
    stz, k, prev = [], -1, object()
    for sec in SECTIONS:
        if sec != prev:
            k += 1
            prev = sec
        stz.append(k)
    st = R.build_stream(DRAFT, get_phonology("eng"), sections=SECTIONS,
                        stanzas=stz, stanza_source="declared_sections",
                        declaration={"language": "eng"})
    R.search_caesura(st)
    R.mark_refrain_tail(st, lines=list(range(len(DRAFT))))
    R.declare_orthography(st, lh.spelled_rime)
    R.declare_delivery(st, {}, name="delivered")
    R.declare_delivery(st, {}, name="sung")
    # Constructed capability fixture, disclosed in FIXTURE_ONLY. The page
    # stream cannot supply a slang projection merely by carrying a lexicon.
    st.alt["slang"] = R.build_stream(DRAFT, get_phonology("eng"),
                                    declaration={"language": "eng"})
    R.search_lifts(st)
    R.declare_senses(st, {})
    R.declare_stub_resolution(st, {3: (0, 2)})
    byline = {}
    for k, u in enumerate(st.units):
        byline.setdefault(u.line, []).append(k)
    R.declare_beat(st, {ln: tuple(v[::3]) for ln, v in byline.items()})
    # THE TWO PERIOD SURFACES need a SOURCED reconstruction, which is the
    # caller's to supply and is not this census's to invent. A constructed
    # fixture (doctrine 94) stands in so the CONSTRUCTOR is exercised; what
    # it proves is that the seam is joined, not that this repo ships a
    # reconstruction — it does not, and `declared_inputs.PeriodPhonology`
    # refuses to build one without a named source.
    from quality.declared_inputs import PeriodPhonology
    from quality.phonology import Syllable as _Syl

    class _Fixture:
        def syllabify(self, w):
            return [_Syl(text=w, onset=("H",), nucleus="UW", coda=("V",),
                         prominence=1, moras=1)]

    for nm, per in (("earlier", "1590-1620, London English"),
                    ("poet", "Ayrshire Scots, 1780s")):
        R.declare_period_surface(
            st, PeriodPhonology(_Fixture(), "eng", per,
                                reconstruction="constructed fixture, "
                                               "doctrine 94",
                                source="this census, not a shipped table"),
            name=nm)
    return st


def _other_language_live():
    """-> the names that answer under their OWN phonology, verified here."""
    out = []
    from quality import quotients as _Q
    #: DECLARED HERE AND NOWHERE ELSE (doctrine 94). See FIXTURE_ONLY.
    fixtures = {"cym": {"quotients": {"vowel_class": _Q.vowel_class}}}
    #: The 平仄 template is the FORM's, never the text's. ~~This census
    #: declares an all-中 (either-tone) template over a real pentasyllabic
    #: couplet~~ — since 2026-09-25 it declares the SOURCED pattern
    #: (`quality/sourced_tables.py`, Wang Li's 五絕 仄起) over the poem that
    #: pattern is the form of, so the capability is a shipped table's.
    from quality import sourced_tables as _ST
    lines_for = {"ltc": list(_ST.TONAL_WITNESS)}
    for lang, names in BY_LANGUAGE.items():
        try:
            st = R.build_stream(
                lines_for.get(lang, ["a b", "c d"]), get_phonology(lang),
                declaration=dict({"language": lang}, **fixtures.get(lang, {})))
            if lang == "ltc":
                _ST.declare_regulated_template(st, _ST.TONAL_FORM)
        except Exception:
            continue
        for n in names:
            sch = R.REGISTRY.get(n)
            if sch and not [c for c in sch.capabilities()
                            if st.supply(c).state != "present"]:
                out.append(n)
    return out


#: THE TWO EVIDENCE ROUTES A `witness_and_contrast` CAN COME FROM, and why a
#: single total blurs them (review of #392, 2026-09-25). `Reviser.grade` is
#: the grader `revise.py` runs, so a witness there is evidence about the
#: production loop. `figures.line_figures` is the intra-line reader that
#: `quality/figure_exhibits.py` grades through, and `revise.py` never calls
#: it, so a witness there certifies the reader and says nothing about a
#: revision honouring the figure. Keyed on each row's own `evidence` string
#: (the census row must stay byte-equal to `figure_exhibits.semantic_row`,
#: which `test_figure_exhibits.py` §6 checks), and a row that matches
#: neither is counted UNATTRIBUTED rather than folded into either.
ROUTE_GRADE = "production grade route (`Reviser.grade`)"
ROUTE_FIGURES = "figures reader (`figures.line_figures`)"
ROUTE_NONE = "unattributed"


def witness_routes(semantic):
    """-> {route: {table: [names]}} over the `witness_and_contrast` rows."""
    from quality import figure_exhibits as FE
    out = {ROUTE_GRADE: {}, ROUTE_FIGURES: {}, ROUTE_NONE: {}}
    for name, row in sorted(semantic.items()):
        if row["status"] != "witness_and_contrast":
            continue
        ev = row.get("evidence", "")
        if ev == FE.EVIDENCE:
            route, table = ROUTE_FIGURES, "FIGURE_EXHIBITS"
        elif ev.startswith(("CENSUS_EXHIBITS ", "DRAWABLE_EXHIBITS ",
                            "CONTEXT_CONTROLS:")) \
                and "Reviser.grade" in ev:
            route, table = ROUTE_GRADE, ev.split()[0].rstrip(":")
        else:
            route, table = ROUTE_NONE, ev.split()[0] if ev else "(none)"
        out[route].setdefault(table, []).append(name)
    return out


def census():
    st = _full_stream()
    live, blocked = [], {}
    other = _other_language_live()
    for name, sch in sorted(R.REGISTRY.items()):
        miss = [c for c in sch.capabilities()
                if st.supply(c).state != "present"]
        if not miss:
            live.append(name)
        elif name in other:
            live.append(name)          # answers under its own phonology
        else:
            blocked[name] = miss
    # Capability availability is not an executable positive witness. Every
    # schema carries a separate semantic validation record; missing witnesses
    # remain visible release work instead of being folded into ~~"77 live"~~
    # one "N live" figure.
    semantic = {}
    from quality.revise import Reviser
    from quality.schemes import mandate
    from quality import figure_exhibits as FE
    verifier = Reviser()

    def _verdict(lines, slots, sections):
        """One group, the schema as default relation — the DRAWABLE route,
        with the frame a figure needs handed in (never invented)."""
        got = verifier.grade(list(lines), mandate(
            [list(slots)], n_lines=len(lines),
            default_relation="schema:" + name),
            sections=list(sections) if sections else None)
        if got["refusals"]:
            return None, got["refusals"][0]["reason"]
        return not got["violations"], None

    findings = []
    for name, sch in sorted(R.REGISTRY.items()):
        found = None
        if name in R.WITNESS_FINDINGS:
            ref, rows = R.WITNESS_FINDINGS[name]
            got = [_verdict(ls, sl, sec) for ls, sl, sec, _ in rows]
            want = [exp for *_, exp in rows]
            found = {"ref": ref, "verdicts": [v for v, _ in got],
                     "expected": want,
                     "refusal": next((r for _, r in got if r), None)}
            if not rows:
                need = [c for c in sch.requires]
                found["refusal"] = ("`Reviser.grade` takes no declaration "
                                    "of %s; the schema refuses on the grade "
                                    "route before any row can be graded"
                                    % ", ".join(map(repr, need)))
            findings.append((name, found))
        if not R.figure_pair_representable(sch) and name not in R.FULL_SHAPES:
            semantic[name] = {"status": "unsupported_shape",
                              "blocker": "member bindings/template not implemented"}
        elif name in R.CENSUS_EXHIBITS:
            controls = [_verdict(*row)[0] for row in R.CENSUS_EXHIBITS[name]]
            ok = controls == [True, False]
            semantic[name] = {"status": "witness_and_contrast" if ok
                              else "unvalidated", "verdicts": controls,
                              "evidence": "CENSUS_EXHIBITS through declared "
                                          "mandate slots, declared sections "
                                          "and Reviser.grade",
                              "blocker": None if ok else
                              "declared census controls do not both produce "
                              "definite expected verdicts"}
        elif name in R.DRAWABLE_EXHIBITS and R.pair_scope_representable(sch):
            controls = []
            for a,b,sa,sb in R.DRAWABLE_EXHIBITS[name]:
                got = verifier.grade([a,b], mandate([[sa,sb]], n_lines=2,
                                      default_relation="schema:"+name))
                controls.append(None if got["refusals"] else not got["violations"])
            semantic[name] = {"status": "witness_and_contrast" if controls == [True,False]
                              else "unvalidated", "verdicts": controls,
                              "evidence": "DRAWABLE_EXHIBITS through declared mandate slots and Reviser.grade",
                              "blocker": None if controls == [True,False] else
                              "declared controls do not both produce definite expected verdicts"}
        elif name in R.CONTEXT_CONTROLS and R.pair_scope_representable(sch):
            # ONE draft, both groups in ONE mandate (`relations.CONTEXT_CONTROLS`
            # says why these rows cannot be two-line drawable pairs); each
            # group's own verdict is read, a refusal naming it being None.
            lines, w, c = R.CONTEXT_CONTROLS[name]
            m = mandate([list(w), list(c)], n_lines=len(lines),
                        default_relation="schema:"+name)
            got = verifier.grade(list(lines), m)
            # A refusal that carries no `groups` key names no group, so it
            # stands against BOTH: read as None, never as a pass.
            controls = []
            for lab in m.labels[:2]:
                if any("groups" not in r or lab in (r["groups"] or ())
                       for r in got["refusals"]):
                    controls.append(None)
                else:
                    controls.append(not any(v["label"] == lab
                                            for v in got["violations"]))
            ok = controls == [True, False]
            semantic[name] = {"status": "witness_and_contrast" if ok
                              else "unvalidated", "verdicts": controls,
                              "evidence": "CONTEXT_CONTROLS: witness and contrast groups in one mandate over one draft, through Reviser.grade",
                              "blocker": None if ok else SEMANTIC_BLOCKERS.get(
                                  name, "declared controls do not both produce definite expected verdicts")}
        elif name in FE.covered():
            # THE INTRA-LINE ROUTE (`quality/figure_exhibits.py`): a one-line
            # witness and contrast graded by `figures.line_figures`, the
            # reader that actually reports a same-line figure. Kept in its
            # own registry, apart from DRAWABLE_EXHIBITS' pair route.
            semantic[name] = FE.semantic_row(name)
        elif name in ("symploce","analysed rhyme","blues AAB stanza","paroemion",
                       "Middle Chinese end rhyme (同用 group)"):
            semantic[name] = {"status":"regression_witness",
                              "evidence":"quality/test_production_relations.py",
                              "blocker":None}
        elif found is not None:
            semantic[name] = {"status": "unvalidated",
                              "verdicts": found["verdicts"],
                              "evidence": "WITNESS_FINDINGS through Reviser.grade",
                              "blocker": "%s: graded %s where %s is the answer%s%s"
                              % (found["ref"], found["verdicts"],
                                 found["expected"],
                                 "; " + found["refusal"][:160]
                                 if found["refusal"] else "",
                                 # the known reason, where one is recorded
                                 "; " + SEMANTIC_BLOCKERS[name]
                                 if name in SEMANTIC_BLOCKERS else "")}
        else:
            semantic[name] = {"status":"unvalidated",
                              "blocker":SEMANTIC_BLOCKERS.get(name,
                                  "full semantic witness and independent contrast not registered")}
    return {"live": live, "capability_live": live, "semantic_status": semantic,
            "witness_routes": witness_routes(semantic),
            "witness_findings": findings,
            "blocked": blocked, "other_language": other,
            "fixture_only": sorted(n for n in FIXTURE_ONLY if n in live),
            "intra": sorted(n for n in R.REGISTRY if RT._all_same_line(n))}


def main():
    rep = census()
    n = len(R.REGISTRY)
    print(f"REGISTRY {n} schemas")
    print(f"  CAPABILITY-AVAILABLE with every coordinate declared : "
          f"{len(rep['live'])}")
    print(f"  still blocked                                     : "
          f"{len(rep['blocked'])}")
    counts = {}
    for row in rep["semantic_status"].values():
        counts[row["status"]] = counts.get(row["status"],0)+1
    print(f"  semantic validation (separate from capability): {counts}")
    routes = rep["witness_routes"]
    per = {r: sum(map(len, t.values())) for r, t in routes.items()}
    print(f"  witness_and_contrast by evidence route "
          f"({counts.get('witness_and_contrast', 0)} = "
          + " + ".join(str(per[r]) for r in routes if per[r] or r != ROUTE_NONE)
          + "):")
    notes = {ROUTE_GRADE: "the grader revise.py runs",
             ROUTE_FIGURES: "revise.py never calls it; certifies the reader, "
                            "not a revision loop honouring the figure",
             ROUTE_NONE: "matches neither route; NOT counted as either"}
    for r, tables in routes.items():
        if r == ROUTE_NONE and not per[r]:
            continue
        split = ", ".join(f"{t} {len(v)}" for t, v in sorted(tables.items()))
        print(f"    {r:42s} {per[r]:3d}  [{split}] — {notes[r]}")
    print("  Runtime qualification: capability availability is not a production "
          "success claim. Only the listed witness routes have semantic evidence.")
    for status in ("unsupported_shape", "unvalidated"):
        names = [name for name, row in rep["semantic_status"].items()
                 if row["status"] == status]
        if names:
            print(f"  {status} ({len(names)}): " + "; ".join(names))
    wrong = [(n, f) for n, f in rep["witness_findings"]
             if f["verdicts"] != f["expected"] or not f["verdicts"]]
    if wrong:
        print(f"  grader findings, re-graded this run ({len(wrong)}; "
              "`relations.WITNESS_FINDINGS`):")
        for n, f in wrong:
            print(f"    {n} [{f['ref']}]: graded {f['verdicts']}, "
                  f"expected {f['expected']}"
                  + (f" — {f['refusal'][:110]}" if f["refusal"] else ""))
    known = [(name, row) for name, row in rep["semantic_status"].items()
             if row["status"] == "unvalidated" and name in SEMANTIC_BLOCKERS]
    if known:
        print(f"  of the unvalidated, {len(known)} carry a KNOWN blocker "
              f"(SEMANTIC_BLOCKERS; verdicts measured now, witness first):")
        for name, row in known:
            v = f" verdicts {row['verdicts']}" if "verdicts" in row else ""
            print(f"    {name}{v}\n      {row['blocker']}")
    if rep["other_language"]:
        print(f"  (of the askable, {len(rep['other_language'])} answer under "
              f"their OWN phonology and not English:\n   "
              + "; ".join(rep["other_language"]) + ")")
    print(f"  (of the askable, {len(rep['intra'])} are INTRA-LINE and are read "
          f"by `quality/figures.py`,\n   not by a mandate — a pair of lines "
          f"cannot stand in a one-line figure)")
    # THE LINE THAT KEEPS THE COUNT HONEST (2026-08-23). Without it a reader
    # takes "ASKABLE: 77" for "77 working" (the registry's size then), and
    # some of them answer only because this file declared a fixture for them.
    if rep["fixture_only"]:
        print(f"\n  OF THE ASKABLE, {len(rep['fixture_only'])} ANSWER ONLY ON "
              f"A FIXTURE THIS CENSUS DECLARES (doctrine 94).\n  They are "
              f"askable and they REFUSE, correctly and by name, for a caller "
              f"who does not\n  declare the resource. What is missing is a "
              f"sourced TABLE, not code (doctrine 44):")
        from quality.sourced_tables import UNSOURCED
        for nm in rep["fixture_only"]:
            print(f"    {nm}\n      {FIXTURE_ONLY[nm]}")
            if nm in UNSOURCED:
                print(f"      SOURCE NEEDED: {UNSOURCED[nm]}")
    if rep["blocked"]:
        from collections import Counter
        print("\n  WHAT IS LEFT, and what each one needs:")
        by = {}
        for name, miss in rep["blocked"].items():
            for c in miss:
                by.setdefault(c, []).append(name)
        for cap, names in sorted(by.items(),
                                 key=lambda kv: (-len(kv[1]), kv[0])):
            print(f"    {cap:24s} {len(names)}  {', '.join(names)}")
    return 0 if not rep["blocked"] else 0


if __name__ == "__main__":
    sys.exit(main())

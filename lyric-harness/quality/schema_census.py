#!/usr/bin/env python3
"""HOW MANY OF THE 77 SCHEMAS CAN BE ASKED, AND WHAT BLOCKS THE REST.

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
    "ltc": ("Middle Chinese end rhyme (同用 group)",),
}

#: THE SCHEMAS THAT ANSWER ONLY BECAUSE THIS CENSUS DECLARED A FIXTURE, and
#: the whole reason this key exists (2026-08-23). `census()` reports 77 live,
#: and three of those 77 are live on a constructed input (doctrine 94) rather
#: than on anything this repo ships. A count that does not say so invites
#: exactly one misreading -- "77 working" -- and the misreading is the kind
#: this file was built to prevent, so the report NAMES them and `main()`
#: prints them under their own heading.
#:
#: Each is askable. Each REFUSES, correctly and by name, for a caller who
#: does not declare the resource. What is missing in all three cases is a
#: sourced TABLE, not code (doctrine 44).
FIXTURE_ONLY = {
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
    for lang, names in BY_LANGUAGE.items():
        try:
            st = R.build_stream(
                ["a b", "c d"], get_phonology(lang),
                declaration=dict({"language": lang}, **fixtures.get(lang, {})))
        except Exception:
            continue
        for n in names:
            sch = R.REGISTRY.get(n)
            if sch and not [c for c in sch.capabilities()
                            if st.supply(c).state != "present"]:
                out.append(n)
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
    return {"live": live, "blocked": blocked, "other_language": other,
            "fixture_only": sorted(n for n in FIXTURE_ONLY if n in live),
            "intra": sorted(n for n in R.REGISTRY if RT._all_same_line(n))}


def main():
    rep = census()
    n = len(R.REGISTRY)
    print(f"REGISTRY {n} schemas")
    print(f"  ASKABLE with every declarable coordinate declared : "
          f"{len(rep['live'])}")
    print(f"  still blocked                                     : "
          f"{len(rep['blocked'])}")
    if rep["other_language"]:
        print(f"  (of the askable, {len(rep['other_language'])} answer under "
              f"their OWN phonology and not English:\n   "
              + "; ".join(rep["other_language"]) + ")")
    print(f"  (of the askable, {len(rep['intra'])} are INTRA-LINE and are read "
          f"by `quality/figures.py`,\n   not by a mandate — a pair of lines "
          f"cannot stand in a one-line figure)")
    # THE LINE THAT KEEPS THE COUNT HONEST (2026-08-23). Without it a reader
    # takes "ASKABLE: 77" for "77 working", and three of them answer only
    # because this file declared a fixture for them.
    if rep["fixture_only"]:
        print(f"\n  OF THE ASKABLE, {len(rep['fixture_only'])} ANSWER ONLY ON "
              f"A FIXTURE THIS CENSUS DECLARES (doctrine 94).\n  They are "
              f"askable and they REFUSE, correctly and by name, for a caller "
              f"who does not\n  declare the resource. What is missing is a "
              f"sourced TABLE, not code (doctrine 44):")
        for nm in rep["fixture_only"]:
            print(f"    {nm}\n      {FIXTURE_ONLY[nm]}")
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

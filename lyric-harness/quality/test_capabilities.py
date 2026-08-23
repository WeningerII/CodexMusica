#!/usr/bin/env python3
"""Regressions for the DECLARED-COORDINATE CONSTRUCTORS — the seven
capabilities that stood between `quality/relations.REGISTRY`'s 77 schemas and
a judge, closed 2026-08-22 on the owner's ruling "all 77, no exceptions".

WHAT EVERY SECTION HERE ASSERTS, and it is the same shape each time because
the shape is the point:

  1. UNDECLARED, THE SCHEMA REFUSES — and refuses NAMING the capability, not
     returning an empty result. "Nobody asked about the beat of this draft"
     and "this draft has no offbeat rhymes" are different answers and doctrine
     20 forbids spelling them the same.
  2. DECLARED, THE SCHEMA ANSWERS — and the answer is SELECTIVE, i.e. the
     constructor supplied evidence rather than a rubber stamp. Two schemas in
     this registry (`trite rhyme`, `offbeat internal rhyme`) carried a bare
     `requires=` gate and NOTHING that read the resource, so stamping the
     capability would have fired them on every rhyme in the draft —
     `relations.UNPROVIDABLE` predicted that in as many words. Each now has a
     predicate, and §7 is the check that would catch a regression to a stamp.
  3. NOTHING IS INFERRED. Every one of these is a DECLARATION: the writer,
     the editor or the scanner says it. Where this repo could have guessed —
     a stub resolver, a sense inventory, a beat from the meter — it does not,
     and the measurements behind those refusals are quoted at each site.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))

from quality import relations as R                          # noqa: E402
from quality.phonology import get as get_phon, Syllable     # noqa: E402
from quality.declared_inputs import PeriodPhonology         # noqa: E402
import lyric_harness as lh                                  # noqa: E402

FAILURES = []


def check(label, ok, evidence=""):
    print(f"  {'PASS' if ok else 'FAIL'}  {label}")
    if evidence:
        print(f"          {evidence}")
    if not ok:
        FAILURES.append(label)


def _stream(lines):
    return R.build_stream(lines, get_phon("eng"),
                          declaration={"language": "eng"})


def _pairs(st, name):
    return R.line_pairs_for(R.REGISTRY[name], st)


def _refused(out, cap):
    return isinstance(out, R.Refusal) and cap in (out.missing or ())


def test_orthography():
    print("\n1. `orthography` — eye rhyme")
    d = ["it was a word i could not love", "and yet i felt the shadows move"]
    st = _stream(d)
    check("undeclared, `eye rhyme` REFUSES naming the surface",
          _refused(_pairs(st, "eye rhyme"), "orthography"))
    R.declare_orthography(st, lh.spelled_rime)
    check("declared, it answers — and finds `love`/`move`, which is a rhyme "
          "to the EYE and not to the ear",
          _pairs(st, "eye rhyme") == frozenset({(1, 2)}),
          str(_pairs(st, "eye rhyme")))


def test_delivery():
    print("\n2. `delivered` / `sung` — the surfaces called unobtainable")
    d = ["the boat went out sailing", "and we could hear the king"]
    st = _stream(d)
    check("undeclared, `wrenched rhyme` REFUSES naming `delivered`",
          _refused(_pairs(st, "wrenched rhyme"), "delivered"))
    before = [(u.tok_syl, u.syl.prominence) for u in st.units
              if u.token_text == "sailing"]
    R.declare_delivery(st, {"sailing": {"prominence": 1}})
    after = [(u.tok_syl, u.syl.prominence)
             for u in st.alt["delivered"].units if u.token_text == "sailing"]
    check("the override LANDS on the rhyme-bearing syllable and the PAGE is "
          "untouched — a delivery re-voices, it does not rewrite",
          before != after and before[-1][1] == 0 and after[-1][1] == 1,
          f"page {before} -> delivered {after}")
    check("...and the schema then judges instead of refusing",
          not isinstance(_pairs(st, "wrenched rhyme"), R.Refusal))
    R.declare_delivery(st, {}, name="sung")
    check("`sung` is the same constructor under the other name",
          st.supply("sung").state == "present")
    try:
        R.declare_delivery(st, {"x": {"tempo": 3}})
        ok = False
    except R.NoReferent as e:
        ok = "deliverable" in str(e)
    check("a field that is not deliverable REFUSES — a delivery re-voices "
          "prominence/nucleus/coda/moras and never invents a syllable", ok)


def test_stub_resolution():
    print("\n3. `stub_resolution` — refrain by reference")
    d = ["oh my poor nelly gray they have taken her away",
         "and i will never see my darling any more",
         "the moon is on the hill and the night is very still",
         "oh my poor nelly gray, &c."]
    st = _stream(d)
    check("undeclared, `refrain by reference` REFUSES naming the resolution",
          _refused(_pairs(st, "refrain by reference"), "stub_resolution"))
    st = _stream(d)
    R.declare_stub_resolution(st, {3: (0, 2)})
    check("declared, the stub line resolves and the schema finds it — L4 "
          "stands for the chorus at L1-L2 and now MATCHES L1",
          _pairs(st, "refrain by reference") == frozenset({(1, 4)}),
          str(_pairs(st, "refrain by reference")))
    for bad, why in (({3: 3}, "a span, not a line"),
                     ({3: (3, 4)}, "a span containing itself"),
                     ({3: (0, 99)}, "outside the stream")):
        try:
            R.declare_stub_resolution(_stream(d), bad)
            ok = False
        except R.NoReferent:
            ok = True
        check(f"a resolution that is {why} REFUSES at declaration time", ok)


def test_senses():
    print("\n4. `sense` — antanaclasis")
    d = ["put out the light and then put out the light",
         "she sat beside the river bank alone",
         "and took her money to the nearest bank"]
    st = _stream(d)
    check("undeclared, `antanaclasis` REFUSES naming `sense`",
          _refused(_pairs(st, "antanaclasis"), "sense"))
    banks = [(u.line, u.token) for u in st.units if u.token_text == "bank"]
    R.declare_senses(st, {banks[0]: "riverside", banks[1]: "financial"})
    check("declared per POSITION, the figure is found — one word, two senses",
          _pairs(st, "antanaclasis") == frozenset({(2, 3)}),
          str(_pairs(st, "antanaclasis")))
    st2 = _stream(d)
    R.declare_senses(st2, {})
    check("...and with NO sense declared for those positions the figure is "
          "NOT found: silence means an ordinary repeat, never a figure — the "
          "safe direction, and the reason a word-keyed map cannot express "
          "this schema at all",
          _pairs(st2, "antanaclasis") == frozenset(),
          str(_pairs(st2, "antanaclasis")))


def test_period_surface():
    print("\n5. `earlier` / `poet` — a SOURCED period or dialect reading")

    class _EarlyModern:
        T = {"love": "UW", "prove": "UW"}

        def syllabify(self, w):
            v = self.T.get(w.lower())
            if v is None:
                raise KeyError(w)
            return [Syllable(text=w, onset=("L",), nucleus=v, coda=("V",),
                             prominence=1, moras=1)]

    d = ["a thing i could not love", "a thing i could not prove"]
    st = _stream(d)
    check("undeclared, `historical rhyme` REFUSES naming `earlier`",
          _refused(_pairs(st, "historical rhyme"), "earlier"))
    pp = PeriodPhonology(_EarlyModern(), "eng", "1590-1620, London English",
                         reconstruction="constructed fixture (doctrine 94)",
                         source="quality/test_capabilities.py")
    R.declare_period_surface(st, pp, name="earlier")
    check("declared, `love`/`prove` reads as a rhyme on the period surface "
          "and as a NON-rhyme on the modern one, which is the definition",
          _pairs(st, "historical rhyme") == frozenset({(1, 2)}),
          str(_pairs(st, "historical rhyme")))
    try:
        PeriodPhonology(_EarlyModern(), "eng", "1590-1620",
                        reconstruction="", source="x")
        ok = False
    except ValueError as e:
        ok = "reconstruction" in str(e)
    check("an UNSOURCED period phonology still refuses to construct — the "
          "constructor joined the seam, it did not open a hole in it", ok)
    try:
        R.declare_period_surface(_stream(d), _EarlyModern(), name="earlier")
        ok = False
    except R.NoReferent as e:
        ok = "PeriodPhonology" in str(e)
    check("...and a BARE phonology is refused here, so the period/"
          "reconstruction/source checks cannot be routed around", ok)


def test_lifts():
    print("\n6. `lifts` — the scanner BLOCKERS said did not exist")
    d = ["hige sceal the heardra heorte the cenre",
         "the silver salmon slipped the sullen stream"]
    st = _stream(d)
    check("undeclared, `alliterative long line` REFUSES naming `lifts`",
          _refused(_pairs(st, "alliterative long line"), "lifts"))
    rep = R.search_lifts(st)
    check("`search_lifts` derives a map from PROMINENCE and names its source",
          st.supply("lifts").state == "present"
          and rep["source"].startswith("prominence"),
          f"{rep['lines']} line(s), source={rep['source']!r}")
    check("...and both lift schemas then judge instead of refusing",
          not isinstance(_pairs(st, "alliterative long line"), R.Refusal)
          and not isinstance(
              _pairs(st, "fourth lift must not alliterate"), R.Refusal))
    st2 = _stream(d)
    R.declare_lifts(st2, {0: (0, 2, 4, 6)})
    check("`declare_lifts` takes a hand scansion and does NOT check it "
          "against prominence — a declared scansion is the caller's claim "
          "and a checker outranking it would be doctrine 1 inverted",
          st2.frames.lifts == {0: (0, 2, 4, 6)}
          and st2.frames.lift_source == "declared")
    check("the count per half-line is a PARAMETER, not a fiat — the "
          "alliterative long line's four is a convention of the form",
          R.LIFTS_PER_HALF_LINE == 2 and R.HALVES_PER_LINE == 2)


def test_beat_and_selectivity():
    print("\n7. `beat`, and THE CHECK THAT CATCHES A RUBBER STAMP")
    d = ["the rattle and the cattle in the meadow",
         "a shadow on the window of the widow"]
    st = _stream(d)
    check("undeclared, `offbeat internal rhyme` REFUSES naming `beat` — "
          "doctrine 4's default is untouched",
          _refused(_pairs(st, "offbeat internal rhyme"), "beat"),
          str(_pairs(st, "offbeat internal rhyme"))[:90])
    by = {}
    for k, u in enumerate(st.units):
        by.setdefault(u.line, []).append(k)
    R.declare_beat(st, {ln: tuple(v[::3]) for ln, v in by.items()})
    check("declared, it answers — doctrine 4 refuses an INFERRED grid and "
          "always allowed 'a declared tempo', which is what this is",
          not isinstance(_pairs(st, "offbeat internal rhyme"), R.Refusal),
          str(_pairs(st, "offbeat internal rhyme")))
    check("the schema keeps BOTH the capability gate and the placement — the "
          "gate is what makes an undeclared grid a refusal, the placement is "
          "what makes a declared one selective, and either alone is one of "
          "the two defects this schema has had",
          "beat" in R.REGISTRY["offbeat internal rhyme"].capabilities()
          and any(p.kind == "off_beat" for p in
                  R.REGISTRY["offbeat internal rhyme"].placement))

    # THE SAME DEFECT, THE OTHER SCHEMA. `trite rhyme` carried
    # `requires=("frequency",)` and two AGREE channels, so a stamped
    # capability would have labelled every perfect rhyme trite —
    # `UNPROVIDABLE`'s `would_manufacture` said exactly that.
    st3 = _stream(["we walked out in the sun", "and everything was fun",
                   "i wore a bright red cap", "he heard the thunder clap"])
    got = _pairs(st3, "trite rhyme")
    check("`trite rhyme` is SELECTIVE: it flags the declared pair sun/fun and "
          "NOT cap/clap, which is an ordinary perfect rhyme — a capability "
          "with no predicate behind it would have flagged both",
          got == frozenset({(1, 2)}), str(got))
    check("...and it reads the DECLARED pair list, so its vocabulary is "
          "`lyric_harness.CLICHE_PAIRS` and not a corpus rank the pre-1931 "
          "sources cannot supply",
          "quotient:trite" in R.REGISTRY["trite rhyme"].capabilities())


def test_the_whole_registry():
    print("\n8. THE CENSUS — every schema askable, and it is DERIVED")
    from quality import schema_census as CEN
    rep = CEN.census()
    check("all 77 schemas are askable with every declarable coordinate "
          "declared — 0 blocked",
          len(rep["blocked"]) == 0 and len(rep["live"]) == len(R.REGISTRY),
          f"{len(rep['live'])} live / {len(R.REGISTRY)}, "
          f"{len(rep['blocked'])} blocked: {sorted(rep['blocked'])}")
    check("19 of them are INTRA-LINE and are read by the figures route, not "
          "by a mandate — a pair of lines cannot stand in a one-line figure",
          len(rep["intra"]) == 19, len(rep["intra"]))
    check("2 answer under their OWN phonology, which is a language "
          "coordinate (M-4) and not a gap in the registry",
          len(rep["other_language"]) == 2, rep["other_language"])


if __name__ == "__main__":
    for fn in (test_orthography, test_delivery, test_stub_resolution,
               test_senses, test_period_surface, test_lifts,
               test_beat_and_selectivity, test_the_whole_registry):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("every capability the registry names is DECLARABLE, every "
          "declaration is the caller's, and nothing is inferred")

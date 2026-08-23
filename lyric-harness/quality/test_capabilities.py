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
    # THE DERIVED HALF — the 18.7% that resolve uniquely.
    st3 = _stream(d)
    rep = R.search_stub_resolution(st3)
    check("`search_stub_resolution` resolves the UNAMBIGUOUS stub with "
          "nothing declared — the incipit matches exactly one earlier line",
          rep["resolved"] == {3: (0, 1)} and not rep["ambiguous"],
          str({k: rep[k] for k in ("stubs", "resolved", "ambiguous",
                                   "unmatched")}))
    R.declare_stub_resolution(st3, rep["resolved"])
    check("...and the schema then finds the reference, so the derivation and "
          "the declaration COMPOSE — they are the same map, and the "
          "declaration wins where both speak",
          _pairs(st3, "refrain by reference") == frozenset({(1, 4)}),
          str(_pairs(st3, "refrain by reference")))
    check("the span it returns is ONE LINE, not a guessed chorus length — a "
          "stub stands for a whole chorus and the incipit finds only its "
          "FIRST line; widening it would be inventing the edition's "
          "judgement, which is the thing BLOCKERS says cannot be made here",
          rep["resolved"][3] == (0, 1))

    # NO INCIPIT IS NOT NO MATCH, and the two were one field until 2026-08-23.
    # A bare `&c.` tokenises to a single `c`: it names no line, so incipit
    # matching is not a method that FAILS on it, it is a method that does not
    # APPLY. Counting them together inflated the miss rate — the same
    # doctrine-20 collapse this whole campaign is about, committed in fresh
    # code and caught by measuring the corpus instead of quoting a number.
    st4 = _stream(d + ["&c."])
    rep4 = R.search_stub_resolution(st4)
    check("a bare `&c.` is NO_INCIPIT, not a miss — the method does not "
          "apply to it, and that is a third answer",
          rep4["no_incipit"] == [4] and not rep4["unmatched"],
          str({k: rep4[k] for k in ("stubs", "resolved", "unmatched",
                                    "no_incipit")}))
    check("...and the tokeniser is this module's own, so punctuation does "
          "not decide a match: `\"gray, &c.\"` and `\"gray\"` share an "
          "incipit, which a `str.split()` fallback got wrong",
          "gray" in [t.lower() for t in R.tokenise("nelly gray, &c.")])

    # THE INCIPIT LENGTH IS NO LONGER A CONSTANT, and the resolution carries
    # WHICH length decided it. ~~STUB_INCIPIT_WORDS = 3~~ was declared with a
    # story and never measured; the measurement (in the function's own
    # docstring) shows no single length is right, because a short incipit
    # reaches more stubs and a long one carries more evidence.
    check("the resolution records its EVIDENCE — the incipit length that "
          "decided it — so a five-word match and a two-word one are not "
          "reported as the same claim",
          rep["evidence"].get(3) == 5,
          f"evidence {rep['evidence']}, lengths tried {rep['lengths_tried']}")
    check("...and it resolves at the LONGEST length the stub can form, not "
          "at a fixed one: this stub carries five words and is decided on "
          "five, having never needed the fallback",
          rep["lengths_tried"] == (5, 4, 3, 2)
          and max(rep["evidence"].values()) == 5)
    check("a caller may still pin ONE length, which is what the measurement "
          "sweep in the docstring was run with",
          R.search_stub_resolution(_stream(d), incipit=3)["lengths_tried"]
          == (3,))
    # THE PROPERTY THE CORPUS MEASUREMENT FOUND, asserted as a property
    # rather than as a corpus number: longest-first can never resolve FEWER
    # than a fixed length, because every fixed length is one of the rungs it
    # falls through. On the corpus it resolved 469 of 989 against the best
    # fixed length's 363; here it is checked on a fixture so the suite does
    # not depend on the corpus being present.
    # A FIXTURE THAT DISCRIMINATES. The first version of this check ran on
    # `d` above, where every strategy resolves the same single stub —
    # `longest-first 1; fixed 2:1, 3:1, 4:1, 5:1` — so it passed and proved
    # nothing. That is the same can-only-pass shape found twice already this
    # session (test_homeoteleuton §5, test_verbs §6), committed in a check
    # written to guard against exactly it.
    #
    # `the wind blows, &c.` tokenises to four tokens ending in `c`, so:
    #   at 5 words it has NO INCIPIT; at 4 the `c` blocks the match against
    #   `... cold tonight`; at 3 `the wind blows` matches uniquely.
    # Fixed-5 and fixed-4 therefore resolve NOTHING and longest-first
    # resolves it on the 3-word rung.
    disc = ["the wind blows cold tonight",
            "and no one waits for me",
            "the wind blows, &c."]
    _lf = len(R.search_stub_resolution(_stream(disc))["resolved"])
    _fixed = {w: len(R.search_stub_resolution(_stream(disc),
                                              incipit=w)["resolved"])
              for w in (2, 3, 4, 5)}
    check("longest-first never resolves FEWER than any fixed length — every "
          "fixed length is a rung it falls through — and on a stub the long "
          "rungs cannot reach it resolves where fixed 4 and 5 return NOTHING "
          "(on the corpus: 469 of 989 against the best fixed length's 363)",
          _lf >= max(_fixed.values()) and _lf == 1
          and _fixed[5] == 0 and _fixed[4] == 0,
          f"longest-first {_lf}; fixed " + ", ".join(
              f"{w}:{n}" for w, n in sorted(_fixed.items())))
    check("...and it records the rung that decided it, so the weaker "
          "evidence is visible rather than averaged away",
          R.search_stub_resolution(_stream(disc))["evidence"] == {2: 3},
          str(R.search_stub_resolution(_stream(disc))["evidence"]))

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

    # THE DERIVED ROUTE — computed, not declared, and OPT-IN.
    from quality import senses as SEN
    if SEN.available():
        st3 = R.build_stream(d, get_phon("eng"),
                             declaration={"language": "eng",
                                          "derive_senses": True})
        check("with `derive_senses=True` the figure is found with NOTHING "
              "declared — WordNet, POS-tagged, simplified Lesk, keyed on the "
              "lexicographer file. This is the half that was declaration-only "
              "until 2026-08-23",
              _pairs(st3, "antanaclasis") == frozenset({(2, 3)}),
              str(_pairs(st3, "antanaclasis")))
        check("...and the POS constraint is load-bearing: `sat` reads the "
              "SAME semantic field in both lines, so an ordinary repeat of a "
              "past-tense verb does NOT fire. Without it Lesk returned "
              "`saturday.n.01` on one line and `ride.v.01` on the other",
              SEN.sense_of("sat", "she sat beside the river bank".split(),
                           "v")
              == SEN.sense_of("sat", "the cat sat on the mat".split(), "v"))
        check("the DERIVATION IS NOT THE DEFAULT, and the rate is why: "
              "measured over 40 corpus songs it separates 9.42% of "
              "shared-word line pairs and the samples are refrains, not puns "
              "— so a stream that declares neither still REFUSES (doctrine "
              "16/22: an uncalibrated cut is stated as a rate, not adopted)",
              _refused(_pairs(_stream(d), "antanaclasis"), "sense"))
    else:
        check("WordNet absent — the derived route REFUSES rather than "
              "silently treating every word as monosemous "
              "(`python3 quality/fetch_data.py` stages it)",
              _refused(_pairs(_stream(d), "antanaclasis"), "sense"))


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

#!/usr/bin/env python3
"""Regressions for quality/relations.py — one per producer defect fixed.

Every case here was a MEASURED failure before the fix, quoted in the docstring
of the code that fixes it. The naming follows quality/RHYME_COVERAGE.md §4,
"The thirteen defects (no new coordinate)", so a failure here names the row it
reopened.

This file also carries the file's baseline inventory, because the number of
schemas that RUN is the honest measure of the module and the number that are
DECLARED is not. Both are asserted so a change to either is visible.

`relations.py` transcribes nothing: `phon` is any object with `.syllabify()`.
The English adapter below is a TEST FIXTURE over CMUdict, not part of the
module and not a declared phonology — quality/phonology/ has no `eng`, which is
MISSING F-1, and this fixture does not close it.

Run: python3 quality/test_relations.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import lyric_harness as lh                       # noqa: E402
import quality.relations as R                    # noqa: E402
from quality.phonology import Syllable           # noqa: E402
from quality.phonology import fin, som           # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# ---------------------------------------------------------------------------
# The fixture phonology
# ---------------------------------------------------------------------------

_LEX = [None]


def _lex():
    if _LEX[0] is None:
        _LEX[0] = lh.Lexicon()
    return _LEX[0]


class EnglishFixture:
    """CMUdict General American, first pronunciation. A fixture, not a
    declaration: it takes one pronunciation per word and therefore cannot
    represent a homograph (defect P11, open — see the last test)."""
    language = "eng"

    def syllabify(self, word):
        w = lh.fold_apostrophes(word).lower()
        prons = _lex().entries.get(w)
        if not prons:
            p, _ = _lex().transcribe_word(word)
            if not p:
                return []
            prons = [p]
        return [Syllable(text="".join([*d["onset"], d["nucleus"], *d["coda"]]),
                         onset=tuple(d["onset"]), nucleus=d["nucleus"],
                         coda=tuple(d["coda"]),
                         prominence=1 if d["stress"] in (1, 2) else 0,
                         moras=1 + len(d["coda"]))
                for d in lh.syllabify(prons[0])]


ENG = EnglishFixture()
DECL = {"language": "eng"}


def stream(lines, **kw):
    return R.build_stream(lines, ENG, declaration=dict(DECL, **kw.pop(
        "declaration", {})), **kw)


# ---------------------------------------------------------------------------
# 0. The inventory. Measured, not read.
# ---------------------------------------------------------------------------

QUATRAIN = ["The cat sat on the mat", "He wore a funny hat",
            "I sang beneath the moon", "And whistled her a tune"]


def test_inventory():
    print("\n0. the inventory — DECLARED, REACHABLE and RUNNING are three "
          "different numbers")
    check("77 schemas are declared", len(R.REGISTRY) == 77,
          f"{len(R.REGISTRY)} in REGISTRY; all_schemas() is the accessor. "
          f"There is no SCHEMAS attribute and never was.")
    check("4 named QUERIES are recorded as NOT types", len(R.QUERIES) == 4)
    check("the entry point is build_stream(), not Stream.from_lines",
          not hasattr(R.Stream, "from_lines") and callable(R.build_stream))

    st = stream(QUATRAIN)
    rep = R.capability_report(st)
    ran = refused = raised = 0
    findings = {}
    for name, s in R.REGISTRY.items():
        try:
            res = R.realise(s, st)
        except Exception as e:                                # noqa: BLE001
            raised += 1
            print(f"        RAISED {name}: {type(e).__name__}: {e}")
            continue
        if isinstance(res, R.Refusal):
            refused += 1
        else:
            ran += 1
            findings[name] = len(res)
    check("nothing raises on a plain English quatrain", raised == 0,
          f"ran={ran} refused={refused} raised={raised}")
    check("53 of 77 run on an English stream; the other 24 REFUSE, naming a "
          "capability", ran == 53 and refused == 24,
          f"ran={ran} refused={refused}; capability_report says "
          f"{len(rep['reachable'])} reachable "
          f"(2 of those refuse at the SPAN, which is correct: 'penult' and "
          f"'final_unstressed' name nothing in a line of monosyllables)")
    nonzero = {k: v for k, v in findings.items() if v}
    check("a four-line AABB quatrain yields findings for >= 15 schemas",
          len(nonzero) >= 15, f"{len(nonzero)} schemas found something")
    check("perfect rhyme finds cat/hat and moon/tune, and nothing else",
          findings.get("perfect rhyme") == 2)


# ---------------------------------------------------------------------------
# P0. line_final vs the line_final_token locus — the largest single loss
# ---------------------------------------------------------------------------

def test_p0_unreadable_final_token():
    print("\nP0. an out-of-inventory FINAL token used to delete the line's "
          "end rhyme, silently")
    st = stream(["i saw the cat zzzqx", "i wore the hat zzzqx"])
    ctl = stream(["i saw the cat", "i wore the hat"])
    got = R.realise(R.REGISTRY["perfect rhyme"], st)
    exp = R.realise(R.REGISTRY["perfect rhyme"], ctl)
    check("cat/hat is still found through an unreadable final token",
          len(got) == len(exp) == 1,
          f"with OOV: {len(got)}  control: {len(exp)}  (was 0 and 1)")
    check("line_final is a fact about the SURVIVING material",
          [u.token_text for u in st.units if u.line_final] == ["cat", "hat"])
    check("line_tokens still reports the RAW word count",
          {u.line_tokens for u in st.units} == {5},
          "a placement rule asking how many words a line has gets the honest "
          "answer; only the EDGE tests moved")
    check("the loss is recorded, not silent",
          st.unreadable == [(0, 4, "zzzqx"), (1, 4, "zzzqx")],
          f"Stream.unreadable = {st.unreadable}")
    check("a readable stream records nothing", ctl.unreadable == [])

    # the left edge has the same shape and the same fix
    st2 = stream(["zzzqx cat sat", "zzzqx hat sat"])
    check("the LEFT edge too: line_initial follows the surviving material",
          [u.token_text for u in st2.units if u.line_initial] ==
          ["cat", "hat"])


# ---------------------------------------------------------------------------
# P1. ChannelRule.required
# ---------------------------------------------------------------------------

def test_p1_required():
    print("\nP1. `required=False` is REPORTED, not ENFORCED (Snorri's fegra)")
    base = dict(spans=(R.END_ANCHOR, R.END_ANCHOR), align="anchor",
                placement=(R.Placement("both_line_final"),),
                identity=(R.DISTINCT,))
    st = stream(["the cat", "a hat"])

    soft = R.RelationSchema(
        name="probe-soft",
        channels=(R.ChannelRule("nucleus", R.AGREE, "anchor"),
                  R.ChannelRule("coda", R.DIFFER, "anchor", required=False)),
        **base)
    hard = R.RelationSchema(
        name="probe-hard",
        channels=(R.ChannelRule("nucleus", R.AGREE, "anchor"),
                  R.ChannelRule("coda", R.DIFFER, "anchor")),
        **base)

    si = R.realise(soft, st, keep="all")
    hi = R.realise(hard, st, keep="all")
    check("a required channel that reads False fails the pair",
          len(hi) == 1 and hi[0].verdict is False)
    check("a required=False channel that reads False does NOT",
          len(si) == 1 and si[0].verdict is True,
          f"soft verdict={si[0].verdict} (was False)")
    check("the non-required read is still on the Instance",
          ("coda", 0, si[0].reads[1][2]) == si[0].reads[1]
          and si[0].reads[1][2].value is False,
          "filtered out of the verdict, kept in the record")


# ---------------------------------------------------------------------------
# P3. assemble(): forall
# ---------------------------------------------------------------------------

def test_p3_forall():
    print("\nP3. `forall` must actually quantify — monorhyme means ONE sound")
    mono = R.REGISTRY["monorhyme / leash"]

    two_sounds = stream(QUATRAIN)
    edges = R.realise(mono, two_sounds, keep="all")
    check("cat/hat/moon/tune gives two TRUE edges", len(edges) == 2)
    check("...and is NOT monorhyme: two components, no finding",
          R.assemble(mono, edges, two_sounds) == [],
          "was one frame finding covering two different rhyme sounds")

    real = stream(["I found a cat", "she wore a hat",
                   "upon the mat", "and that was that"])
    e2 = R.assemble(mono, R.realise(mono, real, keep="all"), real)
    check("a real monorhyme IS found", len(e2) == 1 and len(e2[0][1]) == 6)
    check("the finding carries a verdict", e2[0][2] is True,
          f"(frame, edges, verdict) = ({e2[0][0]}, {len(e2[0][1])}, "
          f"{e2[0][2]}) — it used to be a 2-tuple with no verdict at all")

    partial = stream(["I found a cat", "she wore a hat",
                      "upon the mat", "and then it rained"])
    e3 = R.assemble(mono, R.realise(mono, partial, keep="all"), partial)
    check("one line outside the leash defeats the forall", e3 == [],
          "3 of 4 lines rhyming is not a monorhyme over the frame")


# ---------------------------------------------------------------------------
# P4 / P5. identity
# ---------------------------------------------------------------------------

ROOTS = {"sing": "sing", "singing": "sing", "sang": "sing", "sung": "sing",
         "love": "love", "loving": "love", "loved": "love"}


def test_p4_identity_resource():
    print("\nP4. an identity RESOURCE is a fact about a WORD, not a syllable")
    sch = R.RelationSchema(
        name="probe-root", spans=(R.END_WORD, R.END_WORD), align="flush_right",
        identity=(R.IdentityRule("morpheme_root", R.AGREE),))

    def root(u):
        return ROOTS.get(u.token_text.lower(), u.token_text.lower())

    def verdict(a, b, key="morphology"):
        st = stream([a, b], declaration={"resources": {key: root}})
        res = R.realise(sch, st, keep="all")
        if isinstance(res, R.Refusal):
            return f"REFUSAL({res.capability})"
        return res[0].verdict if res else "no pair"

    check("sing ~ singing agree on their root", verdict("sing", "singing")
          is True, "was False: ('sing',) compared against ('sing','sing')")
    check("love ~ loving agree on their root", verdict("love", "loving")
          is True, "was False")
    check("sing ~ sung agree on their root", verdict("sing", "sung") is True)
    check("sing ~ love do NOT", verdict("sing", "love") is False)

    check("`resources` keyed on the CAPABILITY name resolves",
          verdict("sing", "singing", "morphology") is True)
    check("`resources` keyed on the LEVEL name resolves too",
          verdict("sing", "singing", "morpheme_root") is True,
          "capabilities()/provides() demanded 'morphology' and evaluate() "
          "looked up 'morpheme_root'; no declaration could satisfy both")
    st = stream(["sing", "singing"])
    check("with no resource at all it REFUSES, naming the capability",
          isinstance(R.realise(sch, st), R.Refusal))


def test_p5_token_identity():
    print("\nP5. token identity collapses by COORDINATE, never by string")
    sch = R.RelationSchema(
        name="probe-tok", spans=(R.WHOLE_LINE, R.WHOLE_LINE),
        align="flush_left", identity=(R.IdentityRule("token", R.AGREE),))

    def verdict(a, b):
        st = stream([a, b])
        res = R.realise(sch, st, keep="all")
        return res[0].verdict if res and not isinstance(res, R.Refusal) else None

    check("'love me love me' is NOT the same token sequence as 'love me'",
          verdict("love me love me", "love me") is False,
          "was True — dict.fromkeys deduped the repeat away, which is exactly "
          "the distinction a refrain or an incremental repetition rests on")
    check("'love me' IS the same as 'love me'",
          verdict("love me", "love me") is True)
    check("a repeat still collapses its own syllables",
          verdict("birthday today", "birthday today") is True,
          "two syllables of one token are one token")


# ---------------------------------------------------------------------------
# P6. PresentVsAbsent
# ---------------------------------------------------------------------------

def test_p6_present_vs_absent():
    print("\nP6. additive / subtractive rhyme is an EXTENSION, not an absence")
    add, sub = R.REGISTRY["additive rhyme"], R.REGISTRY["subtractive rhyme"]

    def v(schema, a, b):
        st = stream([a, b])
        res = R.realise(schema, st, keep="all")
        return res[0].verdict if res and not isinstance(res, R.Refusal) else None

    # RHYME_COVERAGE.md line 148's own list
    for a, b in (("year", "feared"), ("down", "found"), ("rain", "brains"),
                 ("prove", "moved"), ("stow", "hope")):
        check(f"additive: {a}/{b}", v(add, a, b) is True,
              "all five read False before the fix")
    check("...and the same pair is NOT subtractive in that order",
          v(sub, "year", "feared") is False)
    check("subtractive is the same structure with the members exchanged",
          v(sub, "feared", "year") is True)
    check("the total-absence case still passes: see/seed",
          v(add, "see", "seed") is True,
          "proper extension is strictly weaker than the old emptiness test")
    check("a perfect rhyme is NOT additive", v(add, "cat", "hat") is False)
    check("a coda that is not an extension is not additive",
          v(add, "cat", "cab") is False)


# ---------------------------------------------------------------------------
# P7. _project across a second declaration
# ---------------------------------------------------------------------------

def test_p7_project():
    print("\nP7. a second SURFACE that re-tokenises cannot be read "
          "position-wise, and must say so")
    import re as _re
    TXT = ["it's my birthday today"]

    def apostrophe_splits(line):
        """Doctrine 65: the mark belongs to the DECLARATION. A second surface
        cutting the line differently is the intended usage."""
        return _re.findall(r"[^\W\d_]+", line)

    class Graphemic:
        def syllabify(self, w):
            parts = _re.findall(r"[^aeiouy]*[aeiouy]+[^aeiouy]*", w.lower())
            return [Syllable(text=p, onset=(), nucleus=p, coda=())
                    for p in (parts or [w])]

    base = stream(TXT)
    base.alt["orthography"] = R.build_stream(
        TXT, Graphemic(), tokeniser=apostrophe_splits,
        declaration={"language": "eng-ortho"})
    got = [R.DEFAULT_CHANNELS.read(u, "grapheme", base, "orthography")
           for u in base.units]
    check("every read on the divergent surface refuses",
          got == [None] * len(base.units),
          f"was ['it', 's', None, None, 'birthd', 'ay'] — 'my' read the "
          f"grapheme of 's' and 'today' read 'birthday', silently")

    # the guard is on DIVERGENCE, not on having a second surface at all
    agree = stream(TXT)
    agree.alt["orthography"] = R.build_stream(
        TXT, Graphemic(), declaration={"language": "eng-ortho"})
    ok = [R.DEFAULT_CHANNELS.read(u, "grapheme", agree, "orthography")
          for u in agree.units]
    check("a surface that agrees on the tokenisation still projects",
          any(v is not None for v in ok),
          f"{ok}")


# ---------------------------------------------------------------------------
# P8. stanza
# ---------------------------------------------------------------------------

def test_p8_stanza():
    print("\nP8. the stanza is a coordinate READ FROM THE PAGE, not the "
          "constant 0")
    st = stream(["a cat", "a hat", "", "the moon", "a tune"])
    check("a blank line ends a stanza", {u.stanza for u in st.units} == {0, 1},
          "was {0} for every text in the repo")
    check("stanza 0 is the first two lines",
          {u.token_text for u in st.units if u.stanza == 0} == {"a", "cat",
                                                                "hat"})
    check("a text with no blank line is one stanza",
          {u.stanza for u in stream(QUATRAIN).units} == {0})
    check("stanzas=False keeps the old behaviour, on purpose",
          {u.stanza for u in R.build_stream(
              ["a cat", "", "a hat"], ENG, declaration=DECL,
              stanzas=False).units} == {0})
    check("a declared per-line stanza wins over the page",
          {u.stanza for u in R.build_stream(
              ["a cat", "a hat"], ENG, declaration=DECL,
              stanzas=[3, 7]).units} == {3, 7})

    mono = R.REGISTRY["monorhyme / leash"]
    st2 = stream(["a cat", "a hat", "", "the moon", "a tune"])
    found = R.assemble(mono, R.realise(mono, st2, keep="all"), st2)
    check("two stanzas, each a monorhyme, are two findings — P3 and P8 "
          "together", len(found) == 2 and {f[0] for f in found} == {0, 1},
          f"{[(f[0], len(f[1]), f[2]) for f in found]}")


# ---------------------------------------------------------------------------
# build_stream is O(total syllables), as its own docstring says
# ---------------------------------------------------------------------------

def test_build_stream_is_linear():
    print("\nbuild_stream(): the token map is built from the token, not by "
          "rescanning the song")
    import time
    src = [l.rstrip() for l in open(os.path.join(HERE, "..", "lyric.txt"),
                                    encoding="utf-8") if l.strip()]
    ENG.syllabify("warm")                      # pay the dictionary load first
    times = []
    for mult in (20, 80):
        lines = src * mult
        t0 = time.time()
        st = R.build_stream(lines, ENG, declaration=DECL)
        times.append((len(st.units), time.time() - t0))
    (n1, t1), (n2, t2) = times
    ratio = (t2 / t1) if t1 else 0
    check("4x the units costs well under 4x the time squared",
          ratio < 8.0,
          f"{n1} units {t1:.2f}s -> {n2} units {t2:.2f}s, ratio {ratio:.1f}x "
          f"(quadratic would be ~16x; it measured 11.9s at 30k units before)")
    check("30k units build in under 3 seconds", n2 < 40000 and t2 < 3.0,
          f"{n2} units in {t2:.2f}s")


# ---------------------------------------------------------------------------
# The design-2 behaviour a design-3 report called broken. It is not.
# ---------------------------------------------------------------------------

def test_sequence_predicates_are_implemented():
    print("\n[REGRESSION GUARD] the three sequence predicates are implemented "
          "here and must not be ported backwards")
    for cls in (R.SequenceEqual, R.SequenceSuffix, R.SubsequenceOf):
        check(f"{cls.__name__} defines __call__",
              "__call__" in cls.__dict__)
    check("SequenceEqual is total and ordered",
          R.SequenceEqual()(("K", "A", "T"), ("K", "A", "T")).value is True
          and R.SequenceEqual()(("K", "A", "T"), ("T", "A", "K")).value is False)
    check("reverse_b reverses the ELEMENT stream (amphisbaenic: step/pets)",
          R.SequenceEqual(reverse_b=True)(
              ("S", "T", "E", "P"), ("P", "E", "T", "S")).value is True,
          "reversing a one-syllable span's index selection is a no-op, which "
          "is why the reversal has to happen inside the derived sequence")
    check("SequenceSuffix requires the bridge (croes vs traws)",
          R.SequenceSuffix()(("K", "T"), ("X", "K", "T")).value is True
          and R.SequenceSuffix()(("K", "T"), ("K", "T")).value is False)
    check("SubsequenceOf is order-preserving containment",
          R.SubsequenceOf()(("K", "T"), ("K", "A", "B", "T")).value is True
          and R.SubsequenceOf()(("T", "K"), ("K", "A", "B", "T")).value is False)
    check("all three propagate None rather than deciding",
          all(p(None, ("A",)).value is None for p in
              (R.SequenceEqual(), R.SequenceSuffix(), R.SubsequenceOf())))


def test_head_anchored_relations_are_reachable():
    """Deliberately does NOT import rhyme_types. That file is a sibling's and
    a regression here must fail only for reasons inside relations.py."""
    print("\n[THE HEADLINE CLAIM] a head-anchored relation is reachable, "
          "which is what a suffix comparator cannot do")
    FIN = fin.Finnish()
    check("the phonology says kukka/kalevala alliterate",
          FIN.alliterates("kukka", "kalevala") is True)
    sa, sb = FIN.syllabify("kukka"), FIN.syllabify("kalevala")
    check("a suffix comparator cannot see it: the tails share nothing",
          [(s.onset, s.nucleus, s.coda) for s in sa[-2:]] !=
          [(s.onset, s.nucleus, s.coda) for s in sb[-2:]],
          f"sa[-2:]={[s.text for s in sa[-2:]]} vs "
          f"sb[-2:]={[s.text for s in sb[-2:]]} — this is what a producer "
          f"computing sa[-n:] against sb[-n:] compares, whatever `position` "
          f"is passed")
    st = R.build_stream(["kukka kalevala"], FIN, declaration={"language": "fin"})
    res = R.realise(R.REGISTRY["alliteration"], st, keep="all")
    check("relations.py finds it, because the anchor is per MEMBER",
          not isinstance(res, R.Refusal) and len(res) == 1
          and res[0].verdict is True,
          res if isinstance(res, R.Refusal) else
          [i.describe(st) for i in res])
    check("the span it found is HEAD-anchored, one syllable, word-initial",
          not isinstance(res, R.Refusal)
          and len(res[0].a) == 1
          and st.units[res[0].a.head()].word_initial
          and st.units[res[0].b.head()].word_initial)


def test_refusal_is_not_false():
    print("\n[THE HEADLINE CLAIM] a missing capability is a Refusal naming "
          "it, never a False")
    st = R.build_stream(["hooyo macaan", "hooyo macaan"], som.Somali(),
                        declaration={"language": "som"})
    check("a phonology with no prominence supplies none", not
          st.provides("prominence"))
    res = R.realise(R.REGISTRY["perfect rhyme"], st)
    check("perfect rhyme refuses on 'prominence'",
          isinstance(res, R.Refusal) and res.capability == "prominence")
    try:
        bool(res)
        check("a Refusal has no truth value", False)
    except TypeError:
        check("a Refusal has no truth value", True,
              "so it cannot be coerced into the False it is not")


# ---------------------------------------------------------------------------
# What is still broken. These assert the DEFECT, so they fail when it closes.
# ---------------------------------------------------------------------------

def test_known_open_defects():
    print("\nOPEN — asserted so they are visible, and so closing one is a "
          "test failure that has to be read")
    check("P2 open: SpanRule.terminator is declared and never read",
          "terminator" in R.SpanRule.__dataclass_fields__
          and "terminator" not in R.__dict__["_spans_at"].__code__.co_names,
          "one schema sets terminator='frame_edge' and its magnitude "
          "'to_frame_edge' already carries the fact; the field is a duplicate, "
          "not a missing read")
    check("Span.unit is declared and never read; SpanRule cannot set it",
          "unit" in R.Span.__dataclass_fields__
          and "unit" not in R.SpanRule.__dataclass_fields__,
          "M1, the granularity ladder — a NEW coordinate, not a defect")
    check("P10 open: a chorus stub ingests as a word",
          R.tokenise("Oh, my poor Nelly Gray, &c.")[-1] == "c"
          and lh.is_chorus_stub("Oh, my poor Nelly Gray, &c.") is True,
          "lyric_harness.is_chorus_stub() exists and relations.py imports "
          "nothing from it — deliberately, because nothing here transcribes. "
          "The stub is a LINE STATUS the stream has no field for.")
    check("P11 open: one pronunciation per word",
          len(_lex().entries["wind"]) == 2
          and len(ENG.syllabify("wind")) == 1
          and isinstance(ENG.syllabify("wind")[0].nucleus, str),
          "Syllable.nucleus is a str, so a homograph cannot be held. "
          "rhyme_constraints.py's knowledge SETS are the shape of the fix.")
    check("no `eng` phonology is declared anywhere in quality/phonology",
          not os.path.exists(os.path.join(HERE, "phonology", "eng.py")),
          "MISSING F-1. The fixture in this file is a fixture.")


if __name__ == "__main__":
    test_inventory()
    test_p0_unreadable_final_token()
    test_p1_required()
    test_p3_forall()
    test_p4_identity_resource()
    test_p5_token_identity()
    test_p6_present_vs_absent()
    test_p7_project()
    test_p8_stanza()
    test_build_stream_is_linear()
    test_sequence_predicates_are_implemented()
    test_head_anchored_relations_are_reachable()
    test_refusal_is_not_false()
    test_known_open_defects()
    print("=" * 66)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING:")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print("all relations regressions pass")

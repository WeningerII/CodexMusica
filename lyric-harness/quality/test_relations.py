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


class HomographFixture(EnglishFixture):
    """CMUdict with EVERY pronunciation kept, as a KNOWLEDGE SET per channel.

    P11's other half, built here rather than in `quality/phonology` because
    `Syllable.nucleus` is a `str` there and that module is not this cell's to
    change. It exists so the knowledge-set path is exercised through
    `realise()` and not only through the predicates — a coordinate reachable
    only from a unit test is the fourth inert coordinate wearing a fix.

    Only single-syllable words with an equal syllable count across
    pronunciations are merged; anything else falls back to the first reading,
    which is a REFUSAL to over-claim rather than an alignment guess.
    """

    def syllabify(self, word):
        w = lh.fold_apostrophes(word).lower()
        prons = _lex().entries.get(w) or []
        readings = [super(HomographFixture, self).syllabify(word)]
        for p in prons[1:]:
            readings.append(
                [Syllable(text="".join([*d["onset"], d["nucleus"],
                                        *d["coda"]]),
                          onset=tuple(d["onset"]), nucleus=d["nucleus"],
                          coda=tuple(d["coda"]),
                          prominence=1 if d["stress"] in (1, 2) else 0,
                          moras=1 + len(d["coda"]))
                 for d in lh.syllabify(p)])
        base = readings[0]
        if len(readings) == 1 or any(len(r) != len(base) for r in readings):
            return base
        out = []
        for i, s in enumerate(base):
            nucs = frozenset(r[i].nucleus for r in readings)
            codas = frozenset(tuple(r[i].coda) for r in readings)
            out.append(Syllable(
                text=s.text, onset=s.onset,
                nucleus=(next(iter(nucs)) if len(nucs) == 1 else nucs),
                coda=(next(iter(codas)) if len(codas) == 1 else codas),
                prominence=s.prominence, moras=s.moras))
        return out


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

def test_rhyme_constraints_unreadable_nucleus():
    """The sibling module in this triage. One defect, same class as the rest:
    a coordinate that exists and was read wrongly."""
    print("\nrhyme_constraints.py — an UNREADABLE nucleus is not an EMPTY one")
    import quality.rhyme_constraints as C
    from quality.phonology import fas

    utt = C.build(["گل", "دل"], fas.PERSIAN)
    vals = [C.read_channel(utt, "nucleus",
                           C.Extent(sites=(s.i,), unit="syllable", slot=0))
            for s in utt.sites]
    check("fas writes no short vowel, so the nucleus is None",
          all(s.nucleus is None for s in fas.PERSIAN.syllabify("گل")))
    check("...and the knowledge read is UNREADABLE, not a certain absence",
          all(v == (None,) for v in vals),
          f"{vals} — was (frozenset({{'∅'}}),), which two syllables then AGREE "
          f"on at (True, False)")
    check("agree() on two unreadables refuses",
          C.agree(None, None) == (None, False))
    check("agree() on two genuinely ABSENT codas still agrees, muted "
          "(doctrine 25: see/free)",
          C.agree(C.ABS, C.ABS) == (True, False))
    check("an English nucleus is still certain knowledge",
          C.read_channel(C.build(["cat"], ENG), "nucleus",
                         C.Extent(sites=(0,), unit="syllable", slot=0))
          == (frozenset({"AE"}),))


def test_traditions():
    """M-15. `traditions` was declared on 77 schemas and populated on ZERO."""
    print("\nM-15. traditions — SOURCED, honestly EMPTY, and the four scopes")
    sourced = [n for n, s in R.REGISTRY.items() if s.traditions]
    check("every one of the 77 schemas is either SOURCED or listed in "
          "UNSOURCED with a reason",
          len(sourced) + len(R.UNSOURCED) == 77
          and not (set(sourced) & set(R.UNSOURCED))
          and all(R.UNSOURCED.values()),
          f"{len(sourced)} sourced, {len(R.UNSOURCED)} honestly empty "
          f"({', '.join(sorted(R.UNSOURCED))}). The import-time builder "
          f"RAISES on a schema in neither, so a new schema cannot ship an "
          f"empty `traditions` by accident.")
    check("every Tradition cites a RHYME_CANON entry that exists, and the "
          "entry carries its `from:` line",
          all(e in R.CANON and R.CANON[e][1].strip()
              for s in R.REGISTRY.values() for e in R.canon_entries(s)),
          "a tradition read off a schema NAME is the gabay higaad error "
          "(RHYME_CANON §0): that entry was reconstructed from this repo's "
          "own modules and read back as external confirmation.")
    check("SOMALI is scoped to ZERO of the 77, which is what the source says",
          R.tradition_report("som")["in_tradition"] == [],
          "RHYME_CANON §0 and §5.4: `gabay higaad` has no source in the 601 "
          "at all and Somali appears in no inventory cell. The mechanical "
          "form of that is a zero, not a plausible-looking list.")
    check("M-15's three named cases are RULE SHAPE ONLY on English",
          all(R.tradition_scope(R.REGISTRY[n], "eng") == "rule_shape"
              for n in ("Middle Chinese end rhyme (同用 group)", "pantun ABAB",
                        "Scots vowel-length rhyme (Aitken's Law)")),
          "they are not wrong — the rule shape matched. Before this nothing "
          "in the output could say so (doctrine 43).")
    check("...and each is IN TRADITION on its own language",
          R.tradition_scope(R.REGISTRY["Middle Chinese end rhyme (同用 group)"],
                            "ltc") == "in_tradition"
          and R.tradition_scope(R.REGISTRY["pantun ABAB"],
                                "msa") == "in_tradition"
          and R.tradition_scope(R.REGISTRY["cynghanedd groes"],
                                "cym") == "in_tradition")
    check("a FOURTH scope exists, because 'the source cannot say' is not "
          "'the source says no'",
          R.tradition_scope(R.REGISTRY["internal rhyme"], "fin") ==
          "cell_cited" and set(R.SCOPES) == {
              "in_tradition", "cell_cited", "rule_shape", "unsourced"},
          "R71 cites G63 — the germanic/finnic cell — and names no tradition "
          "in it. Reporting `rule_shape` there would assert an absence the "
          "canon does not support.")
    check("`named_cells` is ENTRY-scoped, not schema-scoped",
          R.tradition_scope(R.REGISTRY["Middle Chinese end rhyme (同用 group)"],
                            "eng") != "cell_cited",
          "the schema cites R1, whose from-line includes English indices — "
          "but R1's English tradition is named, under `perfect rhyme`, at "
          "grain=identity. Computed per SCHEMA this returned 'cannot say' "
          "where the source says plainly where English lives.")
    check("the report gives THREE counts for the run, not two (doctrine 79)",
          set(("refused", "ran_found_nothing", "ran_and_fired")) <=
          set(R.relation_report(stream(QUATRAIN))),
          "a schema the instrument REFUSED for want of a capability is not a "
          "schema that ran and found nothing.")
    rep = R.relation_report(stream(QUATRAIN))
    check("...and three counts over INSTANCES as well, with UNDECIDED kept",
          set(rep["instances"]) == {"true", "false", "undecided"},
          f"{rep['instances']}")
    check("search_k is CONSUMED: a searched span rule reports its k",
          R.search_burden(R.REGISTRY["chain rhyme (rap)"],
                          stream(QUATRAIN))["mean_k"] > 1
          and R.search_burden(R.REGISTRY["perfect rhyme"],
                              stream(QUATRAIN))["mean_k"] == 1.0,
          "doctrine 56. `Span.search_k` was carried from the first commit and "
          "nothing read it, so a count obtained by SEARCH looked identical to "
          "one obtained by lookup.")


def test_null_module():
    """BACKLOG §2.6. The counts had no matched control."""
    print("\n§2.6. the matched control — and the null that is the IDENTITY MAP")
    import quality.relations_null as N
    check("every null states what it PRESERVES and what it DESTROYS "
          "(doctrine 63)",
          all(n.preserves and n.destroys for n in N.NULLS.values()),
          f"{len(N.NULLS)} nulls: {', '.join(sorted(N.NULLS))}")
    check("the seed is FIXED and STATED (doctrine 66)", N.SEED == 20260811)
    poem = ["I found a cat", "she wore a hat", "upon the mat",
            "and that was that", "the moon was bright", "it sang all night"]
    r = N.run(poem, ENG, "perfect rhyme", "count", "line_permutation",
              n=20, language="eng")
    check("LINE PERMUTATION is the IDENTITY MAP for a schema with no bounded "
          "line-distance placement",
          r.differing == 0.0 and r.gap_to_max == 0,
          f"observed {r.observed}, null max {r.null_max}, "
          f"{r.differing * 100:.0f}% of replicates differ. This is the null "
          f"this repo uses for Whitman, the Kalevala and BilhaN{'a'}. "
          f"Doctrines 63/68 in a third mechanism.")
    check("...and the derivation SAYS SO before the measurement does "
          "(doctrine 75, per PREDICATE)",
          N.predicted_degeneracy(R.REGISTRY["perfect rhyme"],
                                 N.STATISTICS["count"],
                                 N.NULLS["line_permutation"]) is True
          and N.predicted_degeneracy(R.REGISTRY["perfect rhyme"],
                                     N.STATISTICS["count"],
                                     N.NULLS["within_line_shuffle"])
          is False,
          "derived from the schema's own placement tuple, not from the "
          "corpus. The measurement is still the authority (doctrine 68), and "
          "`report()` prints a disagreement AS a disagreement — one is "
          "already on record: `local_fraction@0` was first given "
          "`line_distance` and derived as biting under line_permutation, and "
          "moved 0 of 20 replicates. The table was corrected to match the "
          "measurement, not the other way round.")
    check("a fraction statistic with no denominator REFUSES rather than "
          "reporting 0.0",
          isinstance(N.run(["zzzqx wuggle", "frimble zzzqx"], ENG,
                           "perfect rhyme", "local_fraction@2",
                           "line_final_permutation", n=2, language="eng"),
                     R.Refusal),
          "doctrine 79: no instances is not a placement of zero.")
    check("the result reports the GAP TO THE NULL MAX and the p RESOLUTION "
          "side by side (doctrine 57)",
          hasattr(r, "gap_to_max") and abs(r.resolution - 1 / 21) < 1e-9,
          "an empirical p at 1/(n+1) reports the resolution, not the effect.")
    check("the observation is built by the SAME pipeline as the replicates "
          "(doctrine 91)",
          N.NULLS["identity"].fn([["a", "b"]], None) == [["a", "b"]],
          "`identity` is not a control; it exists so a difference between "
          "observed and null can never be the rendering.")


def _relations_imports():
    """Every module relations.py imports, read from its AST rather than by
    grepping — a comment that NAMES lyric_harness is not an import of it, and
    the P10 close deliberately names it in prose."""
    import ast
    with open(os.path.join(HERE, "relations.py"), encoding="utf-8") as fh:
        tree = ast.parse(fh.read())
    out = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            out |= {a.name.split(".")[0] for a in node.names}
        elif isinstance(node, ast.ImportFrom) and node.module:
            out.add(node.module.split(".")[0])
    return out


def _stub_excluded(stub_line):
    """P10's close, exercised end to end with the CALLER'S predicate."""
    lines = ["a cat", stub_line, "a hat"]
    st = R.build_stream(
        lines, ENG, declaration=dict(DECL),
        line_status=R.line_status_from(lines, lh.is_chorus_stub,
                                       "chorus_stub"),
        exclude_status=("chorus_stub",))
    return ([u.token_text for u in st.units if u.line_final] == ["cat", "hat"]
            and st.excluded_lines == [(1, "chorus_stub", stub_line)]
            and st.provides("line_status") is True
            and len(st.lines) == 3 and st.lines[1] == ())


def test_known_open_defects():
    print("\nOPEN — asserted so they are visible, and so closing one is a "
          "test failure that has to be read.  Two of the five closed on "
          "2026-08-11 (P10, P11's comparison half); three are DECLINED below, "
          "each with the reason, because closing none and saying why is an "
          "outcome and guessing is not.")
    check("P2 open, DECLINED: SpanRule.terminator is declared and never read",
          "terminator" in R.SpanRule.__dataclass_fields__
          and "terminator" not in R.__dict__["_spans_at"].__code__.co_names,
          "one schema sets terminator='frame_edge' and its magnitude "
          "'to_frame_edge' already carries the fact; the field is a duplicate, "
          "not a missing read. DECLINED deliberately: branching on a field "
          "that duplicates another would be INVENTING a semantics no schema "
          "and no canon entry asks for, and a second coordinate meaning the "
          "same thing is a worse defect than an inert one. The honest close "
          "is a deletion, and deleting a public field is a decision for "
          "whoever owns the callers.")
    check("Span.unit open, DECLINED: declared and never read; SpanRule "
          "cannot set it",
          "unit" in R.Span.__dataclass_fields__
          and "unit" not in R.SpanRule.__dataclass_fields__,
          "M1, the granularity ladder — a NEW coordinate, not a defect. "
          "DECLINED: a real close needs SpanRule.unit AND a per-granularity "
          "unit stream (mora for som, akṣara for san, character for ltc), "
          "and no shipped phonology exposes one — `som` DECLARES grid_unit="
          "mora and returns syllables. Wiring the field to the syllable "
          "stream it already has would make it a fourth inert coordinate "
          "wearing a fix.")
    _ord = R.realise(R.REGISTRY["perfect rhyme"], stream(QUATRAIN),
                     keep="all")
    check("text-order convention open, DECLINED: members are ordered by the "
          "head unit, and no coordinate declares it",
          all(i.a.head() <= i.b.head() for i in _ord)
          and not any("order" in f for f in
                      R.RelationSchema.__dataclass_fields__),
          "`realise()` skips a pair whose A follows B, so 'which member is "
          "first' is fixed by the text and additive-vs-subtractive rests on "
          "it. DECLINED because it is a NAMING decision, not a defect: the "
          "convention is correct, it is documented in the schema notes, and "
          "changing it renames a coordinate across every caller for no "
          "measurable gain.")
    # P10 CLOSED 2026-08-11 as a DECLARED COORDINATE. The assertion that used
    # to stand here said the stream had no field for a line status, and
    # closing it had to fail a test somebody reads. It did. What replaces it
    # pins the three properties the close must PRESERVE, because the easy
    # wrong fix -- a `&c.` regex inside relations.py -- would satisfy the
    # headline and break all three.
    STUB = "Oh, my poor Nelly Gray, &c."
    check("P10 closed: relations.py holds a LINE STATUS and ships no detector",
          "line_status" in R.Stream.__dataclass_fields__
          and R.tokenise(STUB)[-1] == "c"
          and "lyric_harness" not in _relations_imports()
          and not [n for n in dir(R)
                   if "stub" in n.lower() and callable(getattr(R, n))],
          "the stub is a LINE STATUS and the stream now has the field. The "
          "TOKENISER is unchanged and still reads '&c' as 'c' — that is "
          "correct, because it is a pointer, not a word, and deciding which "
          "printed mark is a pointer is the EDITION's business (BACKLOG §2.4: "
          "Finnish prints 'j. n. e.', Malay 'd. s. b.'). relations.py ships "
          "no pattern and imports nothing from lyric_harness.")
    check("...and the caller's own predicate excludes it, with the loss "
          "RECORDED",
          _stub_excluded(STUB),
          "build_stream(line_status=..., exclude_status=('chorus_stub',)) "
          "with lyric_harness.is_chorus_stub as the declared predicate: 'c' "
          "stops being an end word, and the dropped line lands in "
          "Stream.excluded_lines rather than vanishing (doctrine 79).")
    check("...and a stream that declares nothing is unchanged, byte for byte",
          [u.token_text for u in stream(["a cat", STUB]).units
           if u.line_final] == ["cat", "c"]
          and stream(["a cat", STUB]).provides("line_status") is False,
          "the coordinate is INERT by default. A capability nobody declared "
          "must not change a single count.")

    # P11 CLOSED 2026-08-11 ON THE HALF THIS MODULE OWNS, and the other half
    # is named rather than quietly folded in. The old assertion pinned
    # `isinstance(nucleus, str)`, which is still true and is now the statement
    # of what REMAINS open, in a module relations.py does not own.
    check("P11: `quality.phonology.Syllable.nucleus` is STILL a str, so no "
          "shipped phonology can produce a two-reading syllable",
          len(_lex().entries["wind"]) == 2
          and len(ENG.syllabify("wind")) == 1
          and isinstance(ENG.syllabify("wind")[0].nucleus, str),
          "CMUdict holds both readings of `wind` and the fixture takes the "
          "first. That is the PRODUCTION gap and it is not in this file.")
    A, D = R.Agree(), R.Differ()
    both = frozenset({"IH", "AY"})
    check("P11 closed (comparison half): a channel may hold a KNOWLEDGE SET "
          "and an unresolved homograph reads UNDECIDED",
          A(both, "IH").value is None and D(both, "IH").value is None,
          "mined from rhyme_constraints.py's frozenset-per-channel (M-16's "
          "one genuine advance, stranded in a file with no caller). Before "
          "this, one reading was picked and a verdict returned on a reading "
          "nobody declared.")
    check("...and set algebra still DECIDES where the readings agree on the "
          "answer",
          A(both, "UW").value is False
          and A(frozenset({"IH"}), "IH").value is True,
          "disjoint readings cannot agree; a singleton set is certain "
          "knowledge. UNDECIDED is reserved for genuine ambiguity.")
    check("...and an uncertain read is a WILDCARD in the candidate index, "
          "never pruned",
          R.uncertain(both) and not R.uncertain(frozenset({"IH"}))
          and not R.uncertain(("N", "D")),
          "a tuple is ONE value (a cluster), not a set of readings. Bucketing "
          "a homograph on one reading would delete exactly the pairs P11 is "
          "about — the Persian pruning failure arriving from the other side.")
    check("...and doctrine 25 survives it: two ABSENT codas still agree, "
          "muted",
          A((), ()) == R.Read(True, False, "")
          and D((), ()).value is False,
          "a quarter of the sonnets' mandated pairs have two empty codas. A "
          "set-algebra rewrite that lost this would delete them all.")
    # ...and the whole path, through realise(), not only the predicate. A
    # coordinate that is only reachable from a unit test is the fourth inert
    # coordinate wearing a fix.
    hom = R.realise(R.REGISTRY["perfect rhyme"],
                    R.build_stream(["the wind", "I could not find"],
                                   HomographFixture(),
                                   declaration=dict(DECL)), keep="all")
    cert = R.realise(R.REGISTRY["perfect rhyme"],
                     R.build_stream(["the wind", "I could not find"], ENG,
                                    declaration=dict(DECL)), keep="all")
    check("P11, END TO END: a two-reading phonology makes wind/find UNDECIDED "
          "through realise(), where the one-reading fixture asserts a VERDICT",
          len(hom) == 1 and hom[0].verdict is None
          and len(cert) == 1 and cert[0].verdict is True,
          f"knowledge-set fixture: {hom[0].verdict}; single-pronunciation "
          f"fixture: {cert[0].verdict}. CMUdict holds W AY1 N D first and "
          f"W IH1 N D second, so the shipped fixture reports `wind`/`find` "
          f"as a PERFECT RHYME — correct for the verb, wrong for the noun, "
          f"and nothing in the output said which one it had read. That is a "
          f"false positive on a homograph, not merely a missing feature. The "
          f"pair is not PRUNED either: an uncertain nucleus is a wildcard in "
          f"the candidate index, so the homograph survives to be refused "
          f"instead of being deleted from the sample.")
    check("...and the refusal names itself on the Instance's reads",
          any(r.value is None and "homograph" in r.note
              for _, _, r in hom[0].reads),
          f"{[r.note for _, _, r in hom[0].reads if r.value is None]}")
    # MISSING F-1 CLOSED 2026-08-10. This check used to assert the gap was
    # open; closing a gap must fail a test that has to be read, and it did.
    # What replaces it pins the two properties that make `eng` usable here --
    # it exists, and it REFUSES rather than guessing.
    from quality.phonology import get as _get, declared as _declared
    check("an `eng` phonology is declared (MISSING F-1 closed)",
          "eng" in _declared(),
          f"declared: {_declared()}")
    _e = _get("eng")
    check("eng REFUSES an out-of-dictionary word rather than guessing",
          _e.syllabify("hypotenuse") == [] and bool(_e.syllabify("nation")),
          "known gap 1's canary. An empty syllabification is a refusal, not a "
          "zero-syllable word, and doctrine 79 says it must not land in a "
          "violation numerator.")
    check("eng leaves `rhymes()` as the inherited stub, deliberately",
          _e.rhymes("nation", "station") is None,
          "doctrine 84: a phonology that DECLARES a relation wins over the "
          "channels. English's rhyme relation IS the channel comparison under "
          "Declaration's theta, so implementing it here would hard-code one "
          "threshold inside the phonology and hide it from the declaration "
          "tuple (doctrine 1).")


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
    test_rhyme_constraints_unreadable_nucleus()
    test_traditions()
    test_null_module()
    test_known_open_defects()
    print("=" * 66)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING:")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print("all relations regressions pass")

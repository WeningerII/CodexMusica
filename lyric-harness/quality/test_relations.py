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


def test_tradition_provenance():
    """M-15a. `Tradition.source` was an `R<n>` pointer into a document whose
    own `from:` lines pointed at an array that was not in the repository.

    Every check here was a MEASURED failure of the first repair attempt, and
    two of them would have shipped a FABRICATED citation, which is worse than
    the gap they were closing.
    """
    from quality import canon_sources as CS
    print("\nM-15a. the survey index, inlined — and the ways it went wrong")

    check("the index is present and complete over the six DECLARED cells",
          CS.loaded() and len(CS.index()) == sum(n for _, _, n in CS.DECLARED)
          == 601,
          f"{len(CS.index())} rows. `loaded()` False would make every witness "
          f"below `None` — cannot tell — which is not `no witness`.")

    rows, why = CS.rebuild(write=False)
    check("the POSITIONAL reading is checked against the canon's own prose",
          rows is not None and len(CS.POSITION_CHECKS) >= 30, why or "")

    # The shift that a head-only check set cannot see.
    check("the checks reach PAST the first sourceless indic entry (position 32)",
          any(i[0] == "I" and int(i[1:]) > 32 for i, _ in CS.POSITION_CHECKS),
          "18 of the indic cell's 74 entries carry no `source` key and are "
          "INTERLEAVED from 32, so a source-keyed reader renumbers the tail "
          "while I1 and I6 still look right. It put `chan (ฉันท์)` on I47, "
          "where the array holds `syair monorhyme quatrain`.")

    check("`md` is NOT a top-level domain here",
          not CS.HOST.search("CLAUDE.md doctrine 18"),
          "with Moldova in the TLD list, `CLAUDE.md doctrine 18` parses as a "
          "hostname and six names — anaphora, epistrophe, repetend, "
          "repetition, refrain/burden/chorus, cynghanedd in English — read as "
          "externally attested on a citation to this repo's own doctrine file.")

    ix = CS.index()
    check("four witness states, and the last two are not `no`",
          {r["witness"] for r in ix.values()} <= set(CS.WITNESSES)
          and {"external", "project", "unrecorded"}
          <= {r["witness"] for r in ix.values()},
          "doctrine 28: `we checked and it is us` and `nobody recorded a "
          "witness` are different sentences with different remedies.")

    bases = set(r["basis"] for r in ix.values())
    check("`unrecorded` splits into an APPEAL and a missing FIELD",
          {"unrecorded/appeal"} and "no_source_field" in bases
          and "appeal" in bases,
          "`standard rhetorical taxonomy` and `no source key at all` both "
          "resolve to nothing, and only one of them is answerable by reading "
          "harder.")

    check("every ADJUDICATED override names the entry it expects",
          all(len(v) == 4 and v[0] for v in CS.ADJUDICATED.values()),
          "the first draft was keyed on position alone, and when the recovery "
          "was corrected the `Thai named rhyme faults` override landed on "
          "`talibun and seloka`. An index is a position; a position is not an "
          "identity. `adjudicate()` raises on drift and on a no-op override.")

    prim = CS.check_primary()
    check("every PRIMARY_IN_REPO citation is still quotable from its file",
          prim and all(p["state"] == "quoted" for p in prim),
          "; ".join("%s %s" % (p["idx"], p["state"]) for p in prim
                    if p["state"] != "quoted")
          or f"{len(prim)} rows, each re-checked by running its own grep — "
             f"Snorri's Háttatal c. 1222-25 in quality/phonology/non.py and "
             f"平水韻 (1252) / 詞林正韻 (1821) in quality/phonology/ltc.py. "
             f"Doctrine 62: the primary source is a spec.")

    prov = R.tradition_provenance()
    check("THREE counts over the traditions, never two (doctrine 79)",
          prov["external"] + prov["project"] + prov["cannot_tell"]
          == prov["distinct"] and prov["cannot_tell"] > 0,
          f"external {prov['external']}, THIS PROJECT'S OWN "
          f"{prov['project']}, cannot tell {prov['cannot_tell']}, of "
          f"{prov['distinct']} distinct on {prov['attachments']} attachments.")

    check("`attested()` is True/False/None and never collapses the last two",
          {t.attested() for s in R.REGISTRY.values() for t in s.traditions}
          == {True, False, None},
          "None PROPAGATES. A schema nobody could attribute and a schema "
          "whose tradition this project invented are different values.")

    check("the traditions this project invented are LABELLED, not dropped",
          prov["project"] > 0
          and all(c["tradition"] and c["cites"] for c in prov["coined"]),
          "an invented name that says it was invented is fine; an invented "
          "name that reads as attested is the defect. "
          + ", ".join(c["tradition"] for c in prov["coined"][:4]) + " …")

    # The false-attribution guard, which is the one that would fabricate.
    attributed = [(t, s) for s in R.REGISTRY.values() for t in s.traditions
                  if t.why.startswith("attributed")]
    bad = [t.name for t, _ in attributed
           if not (CS._distinctive(t.name)
                   & CS._distinctive(ix[t.cites[0]]["name"]))]
    check("every attribution shares a distinctive token with the survey "
          "entry's own NAME, not merely with its tradition field",
          attributed and not bad,
          f"{len(attributed)} attributions, {len(bad)} matched on the "
          f"tradition field alone: {bad[:4]}. Filtering by language BEFORE "
          f"testing uniqueness put `English refrain / burden / chorus` on "
          f"`E3 repetition (same-word rhyme)` and `Finnish Kalevala vahva "
          f"alkusointu` (vahva = STRONG) on `G82 Kalevala WEAK alliteration`.")

    check("a name whose only cell candidate contradicts its language gloss is "
          "NOT attributed",
          CS.attribute("Vietnamese vần chân", ["I61"]) is None,
          "`I61` is `chan (ฉันท์) quantitative template`, Thai. Folding "
          "diacritics makes `chân` and `chan` the same token, and a filter "
          "that can only delete is what stops that becoming a citation.")

    check("the multi-line `from:` reader finds more than the single-line one",
          sum(len(CS.refs_in(f)) for _, _, _, f in CS.canon_blocks()) == 781,
          "audit_register.py --provenance counted 611 with a single-line "
          "regex on the first occurrence only. R1's from-line runs onto a "
          "second line, R29's onto three, and §H/§I write `from:` inline. "
          "Doctrine 58 inside the adversary built to find doctrine-58 errors.")

    check("RHYME_CANON.md now carries publication YEARS, and they are the "
          "real ones",
          all(y in open(CS.CANON_MD, encoding="utf-8").read()
              for y in ("1222-25", "1252", "1821")),
          "the audit's sharpest single finding was `0 publication-year tokens "
          "in 94 KB`. Every year in §8 comes from a repo file that prints it, "
          "never from recollection (doctrine 39).")


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


def _lyric_stream():
    """The shipped example lyric, which is where the text-order convention's
    cost was MEASURED. Kept in one place so the numbers below and the ones in
    relations.py's docstring come from the same object."""
    raw = [l.rstrip() for l in open(os.path.join(HERE, "..", "lyric.txt"),
                                    encoding="utf-8") if l.strip()]
    return R.build_stream(raw, ENG, declaration=dict(
        channels=("nucleus", "coda", "onset", "prominence"), prominence=True))


def test_known_open_defects():
    import quality.rhyme_constraints as C
    print("\nThe five defects §2.8 left OPEN, each now at ONE of the three "
          "honest ends — wired, deleted, or declared inert with the reason. "
          "All five are asserted, so RE-OPENING one is a test failure that "
          "has to be read, exactly as closing one used to be.")

    # ---- P2. CLOSED 2026-08-11 BY DELETION. ------------------------------
    # The assertion that stood here pinned `terminator` as present-and-unread
    # and said in its own note that "the honest close is a deletion". It was
    # right, and the measurement below is what turned that from a preference
    # into a fact: the field was a strict FUNCTION of `magnitude` across all
    # 154 member rules, so it carried zero information, and `_spans_at` has no
    # edge left for it to select between because `ids` IS the locus.
    _rules = [r for s in R.REGISTRY.values() for r in s.spans]
    _mags = {}
    for _r in _rules:
        _mags.setdefault(str(_r.magnitude), set()).add(
            getattr(_r, "terminator", None))
    check("P2 CLOSED by DELETION: SpanRule has no `terminator`, and nothing "
          "in the registry lost a distinction",
          "terminator" not in R.SpanRule.__dataclass_fields__
          and len(_rules) == 154
          and all(len(v) == 1 for v in _mags.values())
          and "terminator" not in R.__dict__["_spans_at"].__code__.co_names,
          f"{len(_rules)} member rules over {len(R.REGISTRY)} schemas. Before "
          f"deletion: 153 carried the default 'word_edge' and 1 carried "
          f"'frame_edge', and NO magnitude mapped to two terminators — the "
          f"field was a function of `magnitude` and could not distinguish "
          f"anything. The single non-default was `broken rhyme`, whose "
          f"magnitude 'to_frame_edge' already says it. Deleting a duplicate "
          f"is the close; wiring one would have INVENTED a semantics no "
          f"schema and no canon entry asks for. This assertion now fails if "
          f"the field comes back OR if a magnitude ever needs two of them.")

    # ---- Span.unit. CLOSED 2026-08-11 AS A DECLARED INERT COORDINATE. ----
    check("Span.unit: still inert, and now DECLARED inert in the code rather "
          "than only in this test",
          "unit" in R.Span.__dataclass_fields__
          and "unit" not in R.SpanRule.__dataclass_fields__
          and any(e.field == "Span.unit" for e in R.INERT),
          "doctrine 1: a coordinate nobody reads is a stated assumption that "
          "is not in force, so the declaration lies about what the analysis "
          "depends on. The three honest ends are wire, delete, or KEEP IT AND "
          "DECLARE IT — and the third was previously being taken in a test "
          "file that a reader of relations.py never opens. relations.py §10a "
          "now carries the entry, with the reason and the activation "
          "condition.")
    _un = R.INERT[[e.field for e in R.INERT].index("Span.unit")]
    check("...and its blocker is named as one of doctrine 44/92's three, and "
          "it is `disjoint` — NOT `build`",
          _un.blocker == "disjoint"
          and all(e.blocker in ("build", "obtain", "disjoint")
                  for e in R.INERT),
          "this is the whole content of the entry and the reason 'build the "
          "granularity ladder' is the wrong instruction. Three of the nine "
          "shipped phonologies (fas, san, som) DECLARE grid_unit='mora', so "
          "the declaration half exists; all nine return Syllables from "
          "syllabify() and build_stream indexes those, so the stream half is "
          "the syllable for every one of them INCLUDING those three; and the "
          "consumer half exists in rhyme_constraints.read_channel, in a "
          "module whose own registry never sets the field. Every piece is "
          "built and no two are in one object.")
    _bad = R.check_inert(stream(QUATRAIN))
    check("...and the declaration is MEASURED, not asserted — check_inert() "
          "re-derives it and fails in BOTH directions",
          _bad == [],
          "doctrine 48: 'declared inert, with the reason' is a principle that "
          "lives only in prose and gets followed exactly as often as somebody "
          "remembers it. check_inert() enumerates every span the registry can "
          "produce and fails if a declared-inert field has GAINED a value — "
          "so a later session that starts setting Span.unit gets a failing "
          "test instead of a field quietly acquiring a semantics nobody "
          "declared. It also fails if the field is deleted while its entry "
          "survives. Run: python3 quality/relations.py --inert lyric.txt")
    check("...and the sixth inert coordinate this repo has found is IN the "
          "table: rhyme_constraints.Span.unit, where the read is DEAD",
          any(e.field == "rhyme_constraints.Span.unit" for e in R.INERT)
          and len({m.span.unit for c in C.REGISTRY.values()
                   for m in c.members}) == 1,
          "read_channel() branches on `extent.unit != 'syllable'` into "
          "_phone_projection, so a grep for a read finds one. Measured over "
          "that module's registry, 40 of 40 member spans declare 'syllable' "
          "and the branch is unreachable from any shipped constraint. A read "
          "whose values do not exist is not a wiring — which is why the "
          "inventory of inert coordinates has to be MEASURED and not grepped.")

    # ---- text-order. CLOSED 2026-08-11 BY WIRING, and the DECLINE it -----
    # replaces was FALSE. It was recorded as "a NAMING decision, not a defect:
    # the convention is correct ... for no measurable gain". Measured, the
    # gain is 102 instances on the shipped lyric, 8 of them TRUE.
    _ord = R.realise(R.REGISTRY["perfect rhyme"], stream(QUATRAIN),
                     keep="all")
    check("text-order, half 1: a SYMMETRIC schema is byte-identical — the "
          "skip really was exact de-duplication there",
          all(i.a.head() <= i.b.head() for i in _ord)
          and R.order_burden(R.REGISTRY["perfect rhyme"],
                             stream(QUATRAIN))["recovered_instances"] == 0,
          "60 of the 77 schemas have spans[0] == spans[1], so A and B are the "
          "same list and (b, a) is always enumerated too. Every count this "
          "repo has taken over a symmetric schema is unmoved, which is the "
          "precondition for touching this at all.")
    _ls = _lyric_stream()
    _asym = [n for n, s in R.REGISTRY.items() if s.spans[0] != s.spans[1]]
    _burd = {n: R.order_burden(R.REGISTRY[n], _ls) for n in R.REGISTRY}
    _rec = {n: b for n, b in _burd.items() if b["recovered_instances"]}
    check("text-order, half 2: the DECLINE was FALSE — on an ASYMMETRIC "
          "schema the skip DELETED instances, and only there",
          len(_asym) == 17
          and sum(b["recovered_instances"] for b in _burd.values()) == 102
          and sum(b["recovered_true"] for b in _burd.values()) == 8
          and not any(b["symmetric"] for b in _rec.values()),
          f"lyric.txt, all 77 schemas: "
          f"{sum(b['recovered_instances'] for b in _burd.values())} "
          f"instances recovered over {len(_rec)} schemas "
          f"({', '.join(sorted(_rec))}), {sum(b['recovered_true'] for b in _burd.values())} "
          f"of them TRUE, and ZERO on any of the 60 symmetric schemas. On an "
          f"asymmetric schema the two members come from DIFFERENT rules, so "
          f"(b, a) is generally not enumerated and there was nothing to "
          f"de-duplicate — the skip was pure loss. `mirrored()` drops a "
          f"reversed pair only where the mirror is genuinely a candidate.")
    _mos = R.realise(R.REGISTRY["mosaic rhyme"], _ls, keep="all")
    check("...and the concrete case: `mosaic rhyme` reported 4 of its 12 TRUE "
          "instances, because the single word had to print FIRST",
          _burd["mosaic rhyme"]["recovered_true"] == 8
          and sum(1 for i in _mos if i.verdict is True) == 12,
          "`deed`/`we'd need` was reported at L8/L9 and DELETED at L28/L9 — "
          "the same relation, invisible because the multi-word run happened "
          "to print first. `seed`/`we'd need` at L29 appeared in no output at "
          "all. A schema's recall was a function of which member the text "
          "prints first, which is not a naming decision.")
    check("...and `cynghanedd lusg` returned ZERO candidates where three "
          "exist, which reads from outside like a schema that found nothing",
          _burd["cynghanedd lusg"]["recovered_instances"] == 3
          and len(R.realise(R.REGISTRY["cynghanedd lusg"], _ls,
                            keep="all")) == 3,
          "doctrine 20: 'found nothing' and 'was never asked' are different "
          "outputs and the skip collapsed them. The three recovered pairs are "
          "one word against its own penult and all read False — correct, and "
          "correct for a reason a DECLARED IdentityRule should carry, not an "
          "ordering rule doing it by accident. That is left open and named "
          "here rather than fixed by inventing an identity constraint no "
          "canon entry asks for.")
    check("...and the loss is COUNTED from now on, from realise()'s own "
          "tally rather than a re-derived loop",
          set(R.order_burden(R.REGISTRY["mosaic rhyme"], _ls))
          >= {"symmetric", "instances", "deduplicated_candidates",
              "recovered_instances", "recovered_true"},
          "doctrine 56's sibling: search_burden() counts hypotheses, "
          "order_burden() counts what the convention costs. Counting the raw "
          "A x B cross product instead would be a different denominator "
          "dressed as the same one — it skips the frame and bucket join and "
          "reads 9,044 where the schema reports 15 (adversary 7).")
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

    # P11 CLOSED 2026-08-11 ON BOTH HALVES AND ON THE SEAM BETWEEN THEM. The
    # assertion below is unchanged and still passes; its TITLE was false from
    # the moment `quality/phonology/__init__.py` landed, because
    # `Syllable.nucleus` is annotated `object` there now and
    # `Phonology.parses()` is the declared hook that produces a two-reading
    # syllable. What the assertion actually pins is a different and still-live
    # fact -- that the SHIPPED `eng`, and this file's fixture over it, declare
    # ONE reading -- which is the pin that keeps every other count in this file
    # honest. Retitled rather than deleted: a check whose title outruns its
    # assertion is doctrine 17's error in miniature.
    check("P11's production half is CLOSED, and the shipped `eng` still "
          "declares ONE reading — which is what keeps this fixture honest",
          len(_lex().entries["wind"]) == 2
          and len(ENG.syllabify("wind")) == 1
          and isinstance(ENG.syllabify("wind")[0].nucleus, str),
          "`quality.phonology.Syllable` can hold a knowledge set as of "
          "2026-08-11 and `Phonology.parses()` is the hook that produces one. "
          "The DEFAULT is still the single reading, in eng and in this "
          "fixture, so nothing here moves. See quality/test_homograph.py for "
          "the same fixture wired the other way, where wind/find stops being "
          "a perfect rhyme and becomes UNDECIDED.")
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
    test_tradition_provenance()
    test_null_module()
    test_known_open_defects()
    print("=" * 66)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING:")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print("all relations regressions pass")

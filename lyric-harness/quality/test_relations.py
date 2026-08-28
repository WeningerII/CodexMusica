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
import dataclasses
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
    # M-39: THE FIXTURES DECLARE THEIR OWN STANZA GROUND, and `False` is the
    # declaration "every line is in one stanza".  These fixtures are four-line
    # quatrains, so that is true of them; what it is NOT is the silence that
    # `stanzas=None` now records, and the difference is the whole of M-39.
    # Before `Frames.stanza_source` existed the two were the same vector and a
    # `forall stanza` figure could not tell an unframed stream from a
    # one-stanza poem.  §M-39 below pins the undeclared case.
    kw.setdefault("stanzas", False)
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
    check("49 of 77 run on an English stream; the other 28 REFUSE, naming a "
          "capability", ran == 49 and refused == 28,
          f"ran={ran} refused={refused}; capability_report says "
          f"{len(rep['reachable'])} reachable "
          f"(2 of those refuse at the SPAN, which is correct: 'penult' and "
          f"'final_unstressed' name nothing in a line of monosyllables). "
          f"WAS 53/24 until P14: `family rhyme`, `multisyllabic rhyme`, "
          f"`proest` and the 同用 schema compare a channel at a DECLARED "
          f"GRAIN, and a plain English declaration supplies none of the three "
          f"quotients, so they refuse by name instead of answering at the "
          f"identity. Four schemas moved from the wrong column to the honest "
          f"one; nothing else in the inventory moved.")
    _q = {n: getattr(R.realise(R.REGISTRY[n], st), "capability",
                     "<RAN — did not refuse>")
          for n in ("family rhyme", "multisyllabic rhyme", "proest",
                    "Middle Chinese end rhyme (同用 group)")}
    check("...and the four are refused for the QUOTIENT they name, not for "
          "some other missing capability",
          _q == {"family rhyme": "quotient:manner",
                 "multisyllabic rhyme": "quotient:manner",
                 "proest": "quotient:vowel_class",
                 "Middle Chinese end rhyme (同用 group)": "quotient:同用"},
          f"{_q}. "
          "M-15 was that the 同用 schema fired on four lines of English and "
          "nothing in the output could say the tradition had not matched. It "
          "is structural now: an English declaration authorises no 平水韻 "
          "grouping, so the schema cannot run at all rather than running and "
          "being labelled RULE SHAPE ONLY afterwards.")
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

    # RHYME_COVERAGE.md's own ADDITIVE PAIR LIST, cited by NAME rather than by
    # line number: the number this used to carry pointed at the subtractive
    # line before §2 grew and missed by two after it.
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
    # `stanzas=None` DEFEATS THE FIXTURE HELPER'S DECLARATION on purpose: this
    # section is about the blank-line DERIVATION, so it has to be the thing
    # under test rather than a default the helper supplied (M-39).
    st = stream(["a cat", "a hat", "", "the moon", "a tune"], stanzas=None)
    check("a blank line ends a stanza", {u.stanza for u in st.units} == {0, 1},
          "was {0} for every text in the repo")
    check("...and the derivation RECORDS that it had evidence",
          st.frames.stanza_source == "blank_lines"
          and st.supply("stanza").state == "present",
          f"M-39: source={st.frames.stanza_source!r}")
    check("stanza 0 is the first two lines",
          {u.token_text for u in st.units if u.stanza == 0} == {"a", "cat",
                                                                "hat"})
    # SUPERSEDED 2026-08-22 (M-39, doctrine 17).  This used to read "a text
    # with no blank line is one stanza" and assert `{0}` off the derivation.
    # The vector is still {0} and the CLAIM was wrong: a text printing no
    # blank line did not tell the derivation anything, and calling that "one
    # stanza" is the sentence that let five `frame="stanza"` schemas be
    # quantified over a frame that could not vary on all nine panel slices.
    undeclared = stream(QUATRAIN, stanzas=None)
    check("a text with no blank line SUPPLIES NO STANZA GROUND",
          {u.stanza for u in undeclared.units} == {0}
          and undeclared.frames.stanza_source == "none"
          and undeclared.supply("stanza").state == "absent",
          f"was asserted to be 'one stanza'; source is now "
          f"{undeclared.frames.stanza_source!r}")
    check("...so a stanza-framed schema REFUSES on it, naming the frame",
          isinstance(R.realise(R.REGISTRY["monorhyme / leash"], undeclared),
                     R.Refusal)
          and R.realise(R.REGISTRY["monorhyme / leash"],
                        undeclared).capability == "stanza",
          "it used to return edges over one frame and report a number")
    check("stanzas=False keeps the old behaviour, on purpose",
          {u.stanza for u in R.build_stream(
              ["a cat", "", "a hat"], ENG, declaration=DECL,
              stanzas=False).units} == {0})
    check("a declared per-line stanza wins over the page",
          {u.stanza for u in R.build_stream(
              ["a cat", "a hat"], ENG, declaration=DECL,
              stanzas=[3, 7]).units} == {3, 7})

    mono = R.REGISTRY["monorhyme / leash"]
    st2 = stream(["a cat", "a hat", "", "the moon", "a tune"], stanzas=None)
    found = R.assemble(mono, R.realise(mono, st2, keep="all"), st2)
    check("two stanzas, each a monorhyme, are two findings — P3 and P8 "
          "together", len(found) == 2 and {f[0] for f in found} == {0, 1},
          f"{[(f[0], len(f[1]), f[2]) for f in found]}")


# ---------------------------------------------------------------------------
# P14. ClassEqual's partition was the IDENTITY on four of its five channels
#
# NUMBERED 14 AND 15, NOT 12 AND 13, and the reason is a finding of its own:
# quality/RHYME_COVERAGE.md numbers the same set TWICE and the two disagree by
# one — §4's table runs P0..P12 (thirteen rows) while its own §2 prose calls
# them "13 producer defects (P1–P13)". Both readings therefore already claim
# P12 and P13, so a new defect taking either label would name a row that
# exists. Starting at 14 collides with neither; renaming a shipped row to make
# room would be worse (doctrine 48's own failure mode, and every P-number in
# this file names a row a reader can go and check).
# ---------------------------------------------------------------------------

#: Welsh proest pairs. The coda agrees, the vowels differ, and the vowels are
#: of one quantity — RHYME_CANON R11's spec. The circumflex is what marks
#: Welsh length in the orthography, so `tân`/`tôn` is the pair that needs no
#: length rule to be read as two long vowels.
PROEST = [("tân", "tôn"), ("llon", "llan"), ("mab", "heb"), ("dydd", "budd"),
          ("gwyn", "gwn"), ("cant", "gwynt")]

_LONG = "âêîôûŵŷ"


def _quantity(v):
    """A DECLARED Welsh vowel quantity, supplied by this test and by nothing
    in the repo: the circumflex marks a long vowel and its absence here means
    short. It is deliberately NOT shipped in quality/phonology/cym.py — Welsh
    length is largely predictable from the following consonant and is not a
    fact this repo has sourced (doctrine 44: the blocker is the TABLE, not the
    difficulty), and a test fixture that declared it in the module would be
    the harness inventing the tradition's own rule."""
    return "long" if any(c in _LONG for c in (v or "")) else "short"


#: A DECLARED English manner partition, likewise a fixture. CMUdict phones,
#: coda position, four classes and everything else its own class.
_MANNER = {"P": "stop", "B": "stop", "T": "stop", "D": "stop", "K": "stop",
           "G": "stop", "M": "nasal", "N": "nasal", "NG": "nasal",
           "F": "fric", "V": "fric", "S": "fric", "Z": "fric", "TH": "fric",
           "DH": "fric", "SH": "fric", "ZH": "fric", "L": "liquid",
           "R": "liquid"}


def _manner(v):
    return tuple(_MANNER.get(p, p) for p in (v or ()))


def test_p14_identity_partition():
    print("\nP14. a quotient nobody declared is not the identity — proest was "
          "UNSATISFIABLE, family rhyme fired on cat/bat, 同用 read 流/樓 False")
    from quality.phonology import cym as _cym, ltc as _ltc
    CYM, MC = _cym.Welsh(), _ltc.MiddleChinese()

    def cym_stream(a, b, **decl):
        return R.build_stream([a, b], CYM,
                              declaration=dict({"language": "cym"}, **decl))

    # -- the demonstration, kept runnable: the OLD channel pair, on real Welsh
    old = R.RelationSchema(
        name="probe-proest-identity",
        spans=(R.END_ANCHOR, R.END_ANCHOR), align="anchor",
        channels=(R.ChannelRule("coda", R.AGREE, "anchor"),
                  R.ChannelRule("nucleus", R.DIFFER, "anchor"),
                  R.ChannelRule("nucleus", R.ClassEqual(
                      partition=lambda v: v, label="identity"), "anchor")),
        placement=(R.Placement("both_line_final"),), identity=(R.DISTINCT,))
    verdicts = []
    for a, b in PROEST:
        res = R.realise(old, cym_stream(a, b), keep="all")
        verdicts += [i.verdict for i in res]
    check("the identity partition makes proest UNSATISFIABLE, and it is not a "
          "matter of degree: MUST-DIFFER and CLASS-EQUAL are each other's "
          "negation under it",
          len(verdicts) == 6 and set(verdicts) == {False},
          f"{len(PROEST)} real Welsh proest pairs, {verdicts}. Either the "
          f"nuclei are equal (DIFFER reads False) or they are not (CLASS-EQUAL "
          f"reads False), so no input of any kind can read True — the schema "
          f"was not strict, it was empty, and it answered FALSE rather than "
          f"refusing, which is a WRONG ANSWER and not a missing one.")

    # -- and the shipped schema now REFUSES for want of the declared class
    got = R.realise(R.REGISTRY["proest"], cym_stream("tân", "tôn"))
    check("the shipped proest REFUSES on a declaration that names no vowel "
          "class, instead of answering False",
          isinstance(got, R.Refusal) and got.capability == "quotient:vowel_class",
          f"{got if isinstance(got, R.Refusal) else [i.verdict for i in got]}")

    # -- DECLARED, it is satisfiable, and the class does real work
    def proest(a, b):
        res = R.realise(R.REGISTRY["proest"],
                        cym_stream(a, b, quotients={"vowel_class": _quantity}),
                        keep="all")
        return res[0].verdict if res and not isinstance(res, R.Refusal) else None

    check("with the quantity DECLARED, tân/tôn is proest — the first True this "
          "schema has ever been able to return", proest("tân", "tôn") is True)
    check("...and so is llon/llan, two SHORT vowels under one coda",
          proest("llon", "llan") is True)
    check("...and tân/llon is not: long answered by short is the fault the "
          "class requirement exists to catch", proest("tân", "llon") is False)
    check("...and tôn/tôn is not either: the vowels must still DIFFER, so the "
          "class agreement did not swallow the other predicate",
          proest("tôn", "tôn") is False)

    # -- family rhyme: the same identity, the opposite symptom
    fam = R.REGISTRY["family rhyme"]
    got = R.realise(fam, stream(["the cat", "the bat"]))
    check("family rhyme no longer fires on cat/bat — it REFUSES for want of "
          "the manner partition its own label names",
          isinstance(got, R.Refusal) and got.capability == "quotient:manner",
          "it read True on an ordinary perfect rhyme, as a FAMILY relation, "
          "because coda CLASS-EQUAL under the identity IS coda AGREE. Every "
          "instance the schema has ever reported was tail rhyme at the finest "
          "grain wearing a label about manner classes.")

    def family(a, b):
        st = stream([f"the {a}", f"the {b}"],
                    declaration={"quotients": {"manner": _manner}})
        res = R.realise(fam, st, keep="all")
        return res[0].verdict if res and not isinstance(res, R.Refusal) else None

    check("DECLARED, the partition does the work the label claims: cat/cap is "
          "family rhyme (T and P are both stops)",
          family("cat", "cap") is True)
    check("...and cat/can is NOT (T is a stop, N is a nasal)",
          family("cat", "can") is False,
          "the identity partition read cat/cap False and cat/bat True — "
          "exactly backwards for a relation defined on manner classes.")

    # -- 同用: the table existed the whole time and nothing handed it over
    ltc_st = R.build_stream(["黃河入海流", "更上一層樓"], MC,
                            declaration={"language": "ltc"})
    res = R.realise(R.REGISTRY["Middle Chinese end rhyme (同用 group)"],
                    ltc_st, keep="all")
    check("流/樓 — the rhyme of 登鸛雀樓 — is TRUE at the relation layer, and "
          "agrees with the phonology that owns the table",
          len(res) == 1 and res[0].verdict is True
          and MC.rhymes("流", "樓") is True,
          f"{[i.verdict for i in res]} against ltc.rhymes -> "
          f"{MC.rhymes('流', '樓')}. The nuclei are 尤 and 侯, two 廣韻 "
          f"categories the 平水韻 同用 grouping merges; comparing them at the "
          f"identity is doctrine 36's own error, and the schema is NAMED for "
          f"the grouping it was not consulting.")
    from quality.phonology import declared as _declared
    _lang_imports = [m for m in _relations_import_paths()
                     if m.startswith("quality.phonology.")
                     and m.rsplit(".", 1)[1] in set(_declared())]
    check("...and the grouping reaches the schema from the PHONOLOGY, not "
          "from a table copied into relations.py",
          "同用" in getattr(MC, "quotients", {})
          and MC.quotients["同用"]("侯") == MC.quotients["同用"]("尤") == "尤"
          and not _lang_imports,
          f"doctrine 84 and rhyme_types.py's own move: where a phonology "
          f"declares the relation, the producer asks it instead of "
          f"re-deriving one. relations.py imports no LANGUAGE "
          f"({_lang_imports or 'none'}) — `quality.phonology.get` in main() "
          f"is the registry accessor and names no language — so the 平水韻 "
          f"table stays in the one module that owns it and `phon.quotients` "
          f"is the seam. Copying it here would have given the repo two "
          f"sources for one grouping, which is the defect the fix is not "
          f"allowed to trade for.")
    raw = R.build_stream(["黃河入海流", "更上一層樓"],
                         _ltc.MiddleChinese(standard="qieyun"),
                         declaration={"language": "ltc"})
    got = R.realise(R.REGISTRY["Middle Chinese end rhyme (同用 group)"], raw)
    check("...and a declaration that authorises NO grouping refuses rather "
          "than firing: standard='qieyun' is the raw rime class",
          isinstance(got, R.Refusal) and got.capability == "quotient:同用",
          "'qieyun' means finer than any poet worked to, and 流/樓 being "
          "False under it is doctrine 36's demonstration — which `rhymes()` "
          "still gives. A schema named for the 同用 group has nothing to ask "
          "for there, and saying so is not the same as answering False.")


# ---------------------------------------------------------------------------
# P15. `unmatched`'s vocabulary named a value nothing implements
# ---------------------------------------------------------------------------

def test_p15_unmatched_vocabulary():
    print("\nP15. `unmatched` declared 'differ', implemented it nowhere, and "
          "omitted the two values evaluate() actually branches on")
    branches = {c for c in R.evaluate.__code__.co_consts if isinstance(c, str)}
    check("the four values are MEASURED against evaluate()'s own branches, "
          "not recalled",
          getattr(R, "UNMATCHED", ()) ==
          ("exclude", "forbid", "require_a", "require_b")
          and {"forbid", "require_a", "require_b"} <= branches
          and "differ" not in branches,
          f"the field's comment read `exclude | differ | forbid`. 'differ' is "
          f"in no branch of evaluate() and on none of the {len(R.REGISTRY)} "
          f"schemas; 'require_a'/'require_b' are two branches and two schemas "
          f"(apocopated rhyme, semirhyme) and were not in the vocabulary at "
          f"all. A MUST-DIFFER on the matched material is a CHANNEL rule — "
          f"pararhyme states it as ChannelRule('nucleus', DIFFER) — so the "
          f"honest close of the value is a DELETION, not a wiring.")
    used = {s.unmatched for s in R.REGISTRY.values()}
    check("...and every schema in the registry declares one of the four",
          used <= set(R.UNMATCHED) and used == {"exclude", "forbid",
                                                "require_a", "require_b"},
          f"{sorted(used)}")
    raised = None
    try:
        R.RelationSchema(name="probe-unmatched",
                         spans=(R.END_ANCHOR, R.END_ANCHOR),
                         unmatched="differ")
    except ValueError as e:                                   # noqa: BLE001
        raised = str(e)
    check("an undeclared value REFUSES at construction rather than taking the "
          "'exclude' path in silence", raised is not None
          and "unmatched must be one of" in raised,
          f"{raised!r} — it used to build fine and behave as 'exclude', so a "
          f"typo and a policy read the same, which is doctrine 16's failure "
          f"mode: an undeclared setting failing toward whoever guessed.")


# ---------------------------------------------------------------------------
# build_stream is O(total syllables), as its own docstring says
# ---------------------------------------------------------------------------

def test_build_stream_is_linear():
    print("\nbuild_stream(): the token map is built from the token, not by "
          "rescanning the song")
    import time
    src = [l.rstrip() for l in open(os.path.join(HERE, "..", "metidja.txt"),
                                    encoding="utf-8") if l.strip()]
    ENG.syllabify("warm")                      # pay the dictionary load first
    times = []
    # metidja.txt is a shorter base text than this repo's earlier fixture,
    # so the multipliers are scaled up to land at the same absolute unit
    # count (~30k) the threshold below was calibrated against -- too small
    # an absolute scale makes the ratio noise-dominated rather than
    # complexity-dominated.
    for mult in (80, 320):
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
# The refusal was FIRST-HIT. Three sections, from a census of all 77 schemas
# run 2026-08-13:
#
#   1. `realise()` named the alphabetically-first missing capability and
#      returned, so a schema wanting two reported one.
#   2. `poet` had no branch in `Stream.provides` at all, which made `dialect
#      rhyme` refusable on every text under every declaration.
#   3. `frequency` and `stub_resolution` are the same shape and are NOT fixed
#      here — they are declared, with the blocker each one is.
# ---------------------------------------------------------------------------


def test_refusal_names_every_missing_capability():
    """§1. FIRST-HIT -> COMPLETE.

    `RelationSchema.capabilities()` returns `tuple(sorted(...))`, so the
    capability `realise()` used to report was whichever name sorted first.
    Measured before the fix on the som stream below:

        family rhyme  ('prominence', 'quotient:manner')      -> 'prominence'
        proest        ('prominence', 'quotient:vowel_class') -> 'prominence'

    -- and in both cases the quotient is the capability NO declaration of that
    language supplies, while `prominence` is one a different phonology has.
    Naming only the first names the cheaper blocker and hides the structural
    one, which inverts the remedy (doctrine 44).
    """
    print("\nR1. a refusal names EVERY missing capability, not the first one "
          "to sort")
    st = R.build_stream(["hooyo macaan", "hooyo macaan"], som.Somali(),
                        declaration={"language": "som"})

    got = {}
    for n in ("family rhyme", "proest", "dialect rhyme", "trite rhyme"):
        res = R.realise(R.REGISTRY[n], st)
        got[n] = (res.capability, res.missing)

    check("a schema needing TWO capabilities reports two",
          got["family rhyme"][1] == ("prominence", "quotient:manner")
          and got["proest"][1] == ("prominence", "quotient:vowel_class"),
          f"{ {k: v[1] for k, v in got.items()} } — before the fix each of "
          f"these returned after the FIRST failing capability and `.missing` "
          f"did not exist")
    check("...and `.capability` still holds the first, so it stays a stable "
          "grouping key",
          all(m and cap == m[0] for cap, m in got.values()),
          "relations_null.Coverage buckets cannot_obtain rows on it; a key "
          "that silently changed shape would make every stored census "
          "incomparable with the next one")
    check("the detail names all of them, not just the key",
          all(m and all(c in R.realise(R.REGISTRY[n], st).detail for c in m)
              for n, (_, m) in got.items()),
          "a reader of the message gets the same set as a reader of the field")

    # THE MECHANICAL CROSS-CHECK: `missing` must equal what `provides` says,
    # for every schema on this stream. A hand-listed expectation would only
    # test the four above.
    disagree = []
    for n, s in R.REGISTRY.items():
        want = tuple(c for c in s.capabilities() if not st.provides(c))
        out = R.realise(s, st)
        if want and (not isinstance(out, R.Refusal) or out.missing != want):
            disagree.append(n)
    check("`missing` equals `provides`'s own answer for all 77 schemas",
          not disagree, f"disagreements: {disagree}")

    check("`.complete` separates a capability refusal from every other kind",
          R.realise(R.REGISTRY["family rhyme"], st).complete,
          "doctrine 28 at the scale of one dataclass: a span refusal or "
          "relations_null's 'denominator' refusal leaves `missing` empty, and "
          "empty must not read as 'nothing was missing'")
    check("a Refusal built the old three-argument way still constructs",
          R.Refusal("x", "denominator", "d").missing == ()
          and not R.Refusal("x", "denominator", "d").complete,
          "quality/relations_null.py builds one that way and this file may "
          "not edit it")


class DialectFixture(EnglishFixture):
    """A SECOND DECLARATION, and a fixture — not a dialect claim.

    It exists to prove that `poet` is a real surface read through
    `Stream.alt`, and it holds exactly one merge: `prove` takes `love`'s
    nucleus. That is the class CLAUDE.md's own Test discipline section names
    ("love/prove and its class are CONSONANCE in the declared General American
    dialect, which is correct and now named"), so the pair is one the repo has
    already located rather than one invented for a test.

    It is NOT a declared phonology and must never be read as one. A real
    dialect coordinate goes through `quality.declared_inputs.PeriodPhonology`,
    which REFUSES to construct without a named reconstruction and a source —
    which is precisely the blocker that remains after the wiring below.
    """
    MERGES = {"prove": "love"}

    def syllabify(self, word):
        base = super().syllabify(word)
        src = self.MERGES.get(lh.fold_apostrophes(word).lower())
        if not src:
            return base
        other = super().syllabify(src)
        if len(base) != len(other):
            return base
        return [dataclasses.replace(s, nucleus=o.nucleus)
                for s, o in zip(base, other)]


def test_poet_is_an_alt_surface():
    """§2. `poet` had NO BRANCH, so `dialect rhyme` was unrefusable-by-anyone.

    Measured before the fix: `Stream.provides('poet')` fell through every
    branch to the closing `return False`, on every stream, under every
    declaration — including one declaring an `alt` under that exact name. So
    `dialect rhyme` could not produce an observation on any text and therefore
    could not have a matched null either.
    """
    print("\nR2. `poet` is a SECOND-DECLARATION surface, like `earlier`")
    check("`poet` is in ALT_SURFACES, and that tuple is the only gate",
          "poet" in R.ALT_SURFACES and "earlier" in R.ALT_SURFACES,
          f"{R.ALT_SURFACES}")

    # THE SCHEMAS ARE THE SAME SCHEMA UP TO THE SURFACE NAME. Asserted
    # mechanically, because that is the argument for wiring one exactly as the
    # other already was, and an argument stated in prose is not checked.
    d, h = R.REGISTRY["dialect rhyme"], R.REGISTRY["historical rhyme"]
    check("`dialect rhyme` and `historical rhyme` differ ONLY in the surface "
          "their channels read",
          d.spans == h.spans and d.align == h.align
          and d.placement == h.placement and d.identity == h.identity
          and [(c.channel, c.predicate, c.scope) for c in d.channels]
          == [(c.channel, c.predicate, c.scope) for c in h.channels]
          and [c.surface for c in d.channels] == ["poet", "poet", "phonemic"]
          and [c.surface for c in h.channels] == ["earlier", "earlier",
                                                  "phonemic"],
          "so nothing distinguished them that could justify wiring one and "
          "not the other")

    # INERT BY DEFAULT. A capability nobody declared must not move a count.
    plain = stream(["my love", "i cannot prove"])
    check("with no alt declared, `poet` is still not supplied",
          not plain.provides("poet"))
    check("...and `dialect rhyme` still refuses, naming it",
          R.realise(d, plain).capability == "poet")
    check("...and `capability_report` still lists it under 'poet'",
          any("poet" in k for k in R.capability_report(plain)["refused"]),
          f"{ {k: v for k, v in R.capability_report(plain)['refused'].items() if 'poet' in k} }")

    # AND THE SURFACE IS GENUINELY READ. Not a flag: the verdict comes from
    # the second stream's nuclei, and flipping the merge off flips the answer.
    poet = R.build_stream(["my love", "i cannot prove"], DialectFixture(),
                          declaration={"language": "eng", "dialect": "fixture"})
    plain.alt["poet"] = poet
    out = R.realise(d, plain)
    check("a declared `poet` surface supplies the capability",
          plain.provides("poet"))
    check("...and `dialect rhyme` FIRES on love/prove, which is CONSONANCE in "
          "the declared dialect",
          not isinstance(out, R.Refusal) and len(out) == 1
          and out[0].verdict is True,
          f"REFUSED on {out.capability!r}" if isinstance(out, R.Refusal)
          else str([i.describe(plain) for i in out]))
    check("...on the SECOND declaration's nuclei, not the first's",
          poet.units[poet.lines[1][-1]].syl.nucleus
          == poet.units[poet.lines[0][-1]].syl.nucleus
          != plain.units[plain.lines[1][-1]].syl.nucleus,
          "the schema wants nucleus AGREE on `poet` AND nucleus DIFFER on the "
          "anchor in the declared one; a bare flag could satisfy neither")

    # THE BLOCKER THAT REMAINS, stated so the wiring is not mistaken for a
    # capability the repo can use.
    same = R.build_stream(["my love", "i cannot prove"], ENG,
                          declaration={"language": "eng"})
    plain.alt["poet"] = same
    flat = R.realise(d, plain)
    check("an alt that is the SAME phonology finds nothing, which is why the "
          "wiring is not the capability",
          not isinstance(flat, R.Refusal) and len(flat) == 0,
          "doctrine 44: the build was one name in a tuple; the blocker is a "
          "SOURCED dialect phonology, and this repo has none")


def _retired_readmitted():
    """Put a RETIRED capability back into a schema's `requires` and ask
    `check_unprovidable` what it says. A retirement is a CLAIM -- "no schema
    asks for this any more" -- and the way that claim went wrong the first
    time was that nothing re-measured it. The registry is restored before
    this returns; nothing on disk is touched."""
    import dataclasses
    cap = R.RETIRED_UNPROVIDABLE[0].capability
    name = R.RETIRED_UNPROVIDABLE[0].schemas[0]
    real = R.REGISTRY[name]
    R.REGISTRY[name] = dataclasses.replace(
        real, requires=tuple(real.requires) + (cap,))
    try:
        return R.check_unprovidable(None)
    finally:
        R.REGISTRY[name] = real


def test_unprovidable_is_declared_and_measured():
    """§3. `frequency` and `stub_resolution` are DECLARED, not built.

    Both gate on a bare `requires=` and NEITHER is read by any channel, so
    wiring either as a flag makes its schema fire on the channels it already
    has and label the output with a property it never measured. That is
    measured here rather than argued, on both schemas.
    """
    print("\nR3. the two capabilities that stay unprovidable, and why wiring "
          "them would MANUFACTURE")
    st = stream(QUATRAIN)
    check("check_unprovidable finds nothing wrong with the table",
          R.check_unprovidable(st) == [], R.check_unprovidable(st))
    check("every entry's blocker is one of doctrine 44/92's three",
          all(e.blocker in ("build", "obtain", "disjoint")
              for e in R.UNPROVIDABLE),
          f"{ {e.capability: e.blocker for e in R.UNPROVIDABLE} }")
    # REPINNED 2026-08-23. Was `== {"frequency", "stub_resolution"}`.
    # `frequency` left the LIVE table when `trite rhyme` stopped requiring it
    # -- the schema gated on a bare `requires=("frequency",)` that it read on
    # no channel, and now carries `ClassEqual(resource="trite")` over the
    # repo's own declared CLICHE_PAIRS. `check_unprovidable` caught the stale
    # entry the same day and said what to do with it (doctrine 17: the
    # argument is retired whole, not deleted).
    check("`poet` and `frequency` are NOT in the live table; "
          "`stub_resolution` is",
          {e.capability for e in R.UNPROVIDABLE} == {"stub_resolution"},
          f"{sorted(e.capability for e in R.UNPROVIDABLE)}")
    check("...and `frequency` is RETIRED WHOLE rather than deleted — the "
          "reason a capability cannot be supplied does not stop being true "
          "because the schema that wanted it was re-founded",
          {e.capability for e in R.RETIRED_UNPROVIDABLE} == {"frequency"}
          and len(R.RETIRED_UNPROVIDABLE[0].detail) > 800,
          f"{sorted(e.capability for e in R.RETIRED_UNPROVIDABLE)}, "
          f"detail {len(R.RETIRED_UNPROVIDABLE[0].detail)} chars")
    check("a retirement is checked in the OTHER direction too: a schema "
          "asking for a retired capability again is a finding, not a silence",
          any("asks for it again" in f for f in _retired_readmitted()),
          str(_retired_readmitted())[:120])

    # A MAXIMALLY DECLARED STREAM still supplies neither.
    rich = R.build_stream(QUATRAIN, ENG, declaration={
        "language": "eng",
        "resources": ("lexicon", "sense", "morphology", "token", "lexeme"),
        "quotients": {"manner": lambda v: v, "vowel_class": lambda v: v}})
    R.search_caesura(rich)
    R.mark_refrain_tail(rich)
    rich.alt.update({s: rich for s in R.ALT_SURFACES})
    still = [e.capability for e in R.UNPROVIDABLE if rich.provides(e.capability)]
    check("neither is reachable from a stream declaring everything a caller "
          "CAN declare — including every alt surface",
          not still, f"now provided: {still}")

    # THE MANUFACTURING, MEASURED. Force the flag and compare.
    #
    # PATCHED AT `supply`, NOT AT `provides` (2026-08-22). The capability gate
    # in `realise()` reads the three-valued `Stream.supply` now and `provides`
    # is a thin `state == 'present'` on top of it, so a stub that forces
    # `provides` True is a stub the gate never calls — and this section went
    # green-then-TypeError, which is the honest failure. Forcing the SUPPLY
    # keeps the measurement pointed at the same claim: what does the schema
    # report when the capability is handed to it.
    def forced(cap, name, on=st):
        orig = R.Stream.supply
        R.Stream.supply = lambda self, c: (
            R.Supply(cap, "present", 1, "FORCED", "test stub")
            if c == cap else orig(self, c))
        try:
            return R.realise(R.REGISTRY[name], on)
        finally:
            R.Stream.supply = orig

    # THE DEMONSTRATION, AND WHAT IT DEMONSTRATES NOW (2026-08-23).
    #
    # HISTORICALLY, and this is why the section exists: `trite rhyme` gated on
    # a bare `requires=("frequency",)` and read it on NO channel, so forcing
    # the flag returned EXACTLY `perfect rhyme`'s two instances -- cat/hat and
    # moon/tune, in no cliche list, alongside the ones that are, with nothing
    # in the output able to tell them apart. That measurement is the whole
    # argument of RETIRED_UNPROVIDABLE and it is kept verbatim above.
    #
    # THE SCHEMA WAS RE-FOUNDED, so the demonstration has to be repointed at
    # what is true now rather than left asserting a shape the code no longer
    # has. `trite rhyme` carries `ClassEqual(resource="trite")` on its token
    # channel, so its capability is `quotient:trite` and it is READ, not
    # gated. The consequence is the one the section was arguing for: forcing
    # `frequency` now buys NOTHING. A flag nothing reads cannot manufacture a
    # result, and this is the check that says so.
    trite = forced("frequency", "trite rhyme")
    perfect = R.realise(R.REGISTRY["perfect rhyme"], st)

    def pairs(x):
        return sorted((i.a.idx, i.b.idx, i.verdict) for i in x)

    check("forcing `frequency` no longer makes `trite rhyme` fire — it "
          "REFUSES for want of `quotient:trite`, because the capability is "
          "now read on a channel instead of gated on a bare `requires=`",
          isinstance(trite, R.Refusal)
          and trite.capability == "quotient:trite",
          f"{trite if isinstance(trite, R.Refusal) else pairs(trite)}; "
          f"`perfect rhyme` on the same stream still returns "
          f"{len(perfect)} instances, which is what the old wiring copied")
    check("...and the capability it DOES name is one of its own channels' — "
          "the difference between a schema that consults the thing it is "
          "named for and one that wears the label",
          "quotient:trite" in R.REGISTRY["trite rhyme"].capabilities()
          and any(getattr(c.predicate, "resource", None) == "trite"
                  for c in R.REGISTRY["trite rhyme"].channels),
          f"capabilities {R.REGISTRY['trite rhyme'].capabilities()}; "
          f"channels {[(c.channel, getattr(c.predicate, 'resource', None)) for c in R.REGISTRY['trite rhyme'].channels]}")

    # A PLAIN REFRAIN and A REAL STUB, side by side under the forced flag.
    # The stub line is what the schema is FOR and it is the one that finds
    # nothing, which is the whole objection to wiring the flag.
    plain_refrain = stream(["and so we sang", "we walked away", "and so we sang"])
    real_stub = stream(["and so we sang", "we walked away", "and so we sang, &c."])
    hit = forced("stub_resolution", "refrain by reference", plain_refrain)
    miss = forced("stub_resolution", "refrain by reference", real_stub)
    check("a flagged `stub_resolution` fires on ORDINARY verbatim repetition",
          not isinstance(hit, R.Refusal) and len(hit) > 0,
          f"{len(hit)} instances on a plainly repeated line — which is "
          f"`refrain/chorus`, a schema this registry already has")
    check("...and finds NOTHING on the line that actually carries the stub",
          not isinstance(miss, R.Refusal) and len(miss) == 0,
          f"{len(miss)} instances: `&c.` tokenises to `c`, so the pointer "
          f"line is not equal to the line it points at and never will be "
          f"until something RESOLVES it. The flag inverts the schema — it "
          f"reports the cases the schema is not for and misses every case it "
          f"is for.")

    # THE SECOND, INDEPENDENT BLOCKER on `refrain by reference`, cross-checked
    # against the null module rather than asserted here.
    try:
        import quality.relations_null as N
    except Exception as exc:                                  # noqa: BLE001
        check("relations_null imports", False, str(exc))
        return
    check("`refrain by reference`'s `count` statistic has NO null in NULLS",
          N.null_menu(R.REGISTRY["refrain by reference"], "count") == (),
          "so wiring the capability would start a schema firing with nothing "
          "behind it that could fail — doctrine 63/68. Its positional "
          "statistics DO have a menu: local_fraction@2 -> "
          f"{N.null_menu(R.REGISTRY['refrain by reference'], 'local_fraction@2')}")

    # THE TWO TABLES MUST NOT DRIFT. relations_null.py is not editable from
    # here; this pins the edit that is owed there and stays green after it.
    # A ROW THERE HAS THREE LEGITIMATE STATES, not two (2026-08-23). It can
    # answer a LIVE `UNPROVIDABLE` entry; it can be one this file has since
    # made REACHABLE; or its entry can be RETIRED -- still unprovidable,
    # still correctly listed there, but no longer asked for by any schema.
    # Before the third existed, retiring `frequency` turned this check red
    # while both tables were saying exactly the right thing.
    retired = {e.capability for e in R.RETIRED_UNPROVIDABLE}
    extra = [c for c in N.NEVER_PROVIDED
             if c not in {e.capability for e in R.UNPROVIDABLE}
             and c not in retired]
    check("every capability relations.py calls unprovidable is also in "
          "relations_null.NEVER_PROVIDED",
          {e.capability for e in R.UNPROVIDABLE} <= set(N.NEVER_PROVIDED),
          "the reverse containment is NOT required while a row there is being "
          "retired")
    check("a RETIRED capability keeps its NEVER_PROVIDED row and is still "
          "not provided by even a maximally declared stream — retiring the "
          "entry retires the SCHEMA'S CLAIM ON IT, not the blocker",
          all(c in N.NEVER_PROVIDED and not rich.provides(c)
              for c in retired),
          f"retired: {sorted(retired)}; in NEVER_PROVIDED "
          f"{sorted(c for c in retired if c in N.NEVER_PROVIDED)}; provided "
          f"by the rich stream {sorted(c for c in retired if rich.provides(c))}")
    check("...and every EXTRA row there is one this file has since made "
          "REACHABLE, never a gap relations.py forgot",
          all(rich.provides(c) for c in extra),
          f"extra rows: {extra} — OWED IN quality/relations_null.py (this "
          f"file may not edit it): drop the 'poet' row from NEVER_PROVIDED, "
          f"because `dialect rhyme` is now `historical rhyme`'s case — "
          f"blocked on a SOURCED dialect phonology, not on a branch that does "
          f"not exist. Its `cannot_obtain` remedy string currently reads "
          f"'BUILD it: no stream field carries the writer's dialect', which "
          f"is the wrong remedy now; the right one is its own 'declare the "
          f"capability on the stream'. Empty list here = the edit has landed.")


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

    # CANNOT TELL IS NOT FAILED — corrected 2026-08-14, found by CI.
    #
    # This asserted `rows is not None`, which turns the ABSENCE OF THE
    # TRANSCRIPT STORE into a test failure. That store lives at
    # `CS.TRANSCRIPT_GLOB`, outside the repository, untracked and machine-local
    # — and `canon_sources.py`'s own docstring has always said so: `verified`
    # is "a property of THIS MACHINE that expires with it". So off that machine
    # the refusal is the DOCUMENTED, EXPECTED answer, and this check was
    # reading it as a defect. On a CI runner it failed at file 37 of 42 and
    # took the five after it down with it.
    #
    # Doctrine 20/28, which this suite enforces elsewhere: "no transcript" and
    # "the rebuild disagrees with the prose" are two states and must not
    # collapse. `rebuild()` already distinguishes them in `why`; only the
    # caller was summing them. The POSITION_CHECKS half is a property of the
    # committed table and is asserted either way.
    rows, why = CS.rebuild(write=False)
    _absent = rows is None and "no transcript" in (why or "")
    check("the POSITIONAL reading is checked against the canon's own prose, "
          "or REFUSES because the transcripts are not on this machine",
          (rows is not None or _absent) and len(CS.POSITION_CHECKS) >= 30,
          ("REFUSED, not failed: %s. Set CANON_TRANSCRIPTS to a session store "
           "to run the rebuild." % why) if _absent else (why or ""))

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

    # REWRITTEN 2026-08-13. This pinned the literal 781 and went red when
    # `canon_blocks` was fixed to end a block at a `## ` heading as well as at
    # the next entry: the correct count is 654, and 781 was 127 of §3's own
    # non-relation declarations being read as R112's. The check's INTENT was
    # never stale -- the multi-line reader does still find more than the
    # single-line one -- so it is written as the RELATION now, computed on both
    # sides. A literal here could only ever re-stale on the next canon edit,
    # and this test's own subject is a number that went wrong by being copied.
    _multi = sum(len(CS.refs_in(f)) for _, _, _, f in CS.canon_blocks())
    _single = sum(len(CS.first_line_refs(f)) for _, _, _, f in CS.canon_blocks())
    check("the multi-line `from:` reader finds more than the single-line one",
          _multi > _single,
          "multi-line %d, single-line %d. audit_register.py --provenance "
          "counted the single-line reading with a regex on the first "
          "occurrence only. R1's from-line runs onto a second line, R29's onto "
          "three, and §H/§I write `from:` inline. Doctrine 58 inside the "
          "adversary built to find doctrine-58 errors -- and the 781 this "
          "check used to pin was itself a doctrine-58 error one layer further "
          "in, since a block that ran past `## 3.` counted another section's "
          "declarations as its own." % (_multi, _single))

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


def _relations_import_paths():
    """The FULL dotted path of every import in relations.py, where the helper
    below keeps only the top-level package. `from quality import
    rhyme_constraints` and `import quality.phonology.ltc` are both `quality`
    to that one and they are not the same claim: the first is a sibling in the
    quality layer, the second would be this module reaching into a LANGUAGE,
    which is the thing its own docstring says it never does."""
    import ast
    with open(os.path.join(HERE, "relations.py"), encoding="utf-8") as fh:
        tree = ast.parse(fh.read())
    out = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            out |= {a.name for a in node.names}
        elif isinstance(node, ast.ImportFrom) and node.module:
            out |= {f"{node.module}.{a.name}" for a in node.names}
    return out


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
    """A real, public-domain text (Browning, 'Through the Metidja'; see
    data/sources.tsv), which is where the text-order convention's cost was
    MEASURED. Kept in one place so the numbers below and the ones in
    relations.py's docstring come from the same object."""
    raw = [l.rstrip() for l in open(os.path.join(HERE, "..", "metidja.txt"),
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
          "survives. Run: python3 quality/relations.py --inert metidja.txt")
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
    _reach = [m for c in C.REGISTRY.values() for m in c.members
              if not isinstance(m.span.magnitude, str)]
    check("...and the SEVENTH shape, which neither a grep nor a coverage "
          "report can find: a branch that RUNS and cannot branch",
          any(e.field == "rhyme_constraints.Span.terminator@branch"
              for e in R.INERT)
          and len(_reach) == 11
          and not any(m.span.terminator == "locus_edge" for m in _reach)
          and {m.span.terminator for c in C.REGISTRY.values()
               for m in c.members} == {"count", "locus_edge", "frame_edge"},
          f"`_extent_from` reads terminator to choose the locus edge over the "
          f"frame edge, and the read is reachable only on the {len(_reach)} "
          f"of 40 member spans with an INT magnitude. None of those "
          f"{len(_reach)} declares 'locus_edge', and 'count' and 'frame_edge' "
          f"both take the frame side — so three declared values and full line "
          f"coverage produce ONE behaviour, on every reachable member, every "
          f"time. check_inert() censuses the BRANCH each value selects "
          f"rather than the values, because counting values would report this "
          f"field LIVE while its behaviour is a constant.")

    # ---- text-order. CLOSED 2026-08-11 BY WIRING, and the DECLINE it -----
    # replaces was FALSE. It was recorded as "a NAMING decision, not a defect:
    # the convention is correct ... for no measurable gain". Measured, the
    # gain is 114 instances on a real draft, 72 of them TRUE.
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
          and sum(b["recovered_instances"] for b in _burd.values()) == 114
          and sum(b["recovered_true"] for b in _burd.values()) == 72
          and not any(b["symmetric"] for b in _rec.values()),
          f"metidja.txt, all 77 schemas: "
          f"{sum(b['recovered_instances'] for b in _burd.values())} "
          f"instances recovered over {len(_rec)} schemas "
          f"({', '.join(sorted(_rec))}), {sum(b['recovered_true'] for b in _burd.values())} "
          f"of them TRUE, and ZERO on any of the 60 symmetric schemas. On an "
          f"asymmetric schema the two members come from DIFFERENT rules, so "
          f"(b, a) is generally not enumerated and there was nothing to "
          f"de-duplicate — the skip was pure loss. `mirrored()` drops a "
          f"reversed pair only where the mirror is genuinely a candidate.")
    _mos = R.realise(R.REGISTRY["mosaic rhyme"], _ls, keep="all")
    check("...and the concrete case: `mosaic rhyme` recovered its ENTIRE "
          "TRUE set, because every one of those pairs had the single word "
          "print SECOND",
          _burd["mosaic rhyme"]["recovered_true"] == 69
          and sum(1 for i in _mos if i.verdict is True) == 120,
          "69 of the schema's 120 TRUE instances existed only because the "
          "positional skip was removed — every one of them a real rhyme "
          "where the single-word member happened to print after the "
          "multi-word run that rhymed with it. A schema's recall was a "
          "function of which member the text prints first, which is not a "
          "naming decision.")
    check("...and `cynghanedd lusg` recovers candidates that still read "
          "FALSE, so 'recovered' and 'TRUE' are not the same claim",
          _burd["cynghanedd lusg"]["recovered_instances"] == 4
          and _burd["cynghanedd lusg"]["recovered_true"] == 0
          and len(R.realise(R.REGISTRY["cynghanedd lusg"], _ls,
                            keep="all")) == 19,
          "doctrine 20: a schema can gain candidates the old skip deleted "
          "and still judge every one of them False. The recovered pairs "
          "here are wrong for a phonological reason, not hidden by the "
          "ordering bug being also correct — the two questions (was this "
          "candidate EVALUATED, and did it PASS) stay separate on purpose.")
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
    # THE LAST CONJUNCT USED TO BE A NAME GREP -- no callable in `dir(R)`
    # with "stub" in its name -- and on 2026-08-23 it went red for two
    # reasons at once, only one of which was a defect. `declare_stub_
    # resolution` and `search_stub_resolution` are about RESOLUTION, which is
    # a different question from DETECTION and is exactly what this module
    # should offer; the grep could not tell them apart. What it DID correctly
    # catch was `search_stub_resolution` doing `import lyric_harness` and
    # calling `is_chorus_stub` -- shipping a detector by reference instead of
    # by regex, the same defect at one remove. The import is gone and the
    # predicate is now the caller's, the way `declare_orthography` takes the
    # rime rule. The conjunct is BEHAVIOURAL now: ask the module to resolve
    # stubs with nobody having said which lines are stubs, and it must
    # REFUSE. A name cannot tell you that; a call can.
    _undeclared = R.search_stub_resolution(stream([STUB, "a plain line"]))
    check("P10 closed: relations.py holds a LINE STATUS and ships no detector",
          "line_status" in R.Stream.__dataclass_fields__
          and R.tokenise(STUB)[-1] == "c"
          and "lyric_harness" not in _relations_imports()
          and isinstance(_undeclared, R.Refusal)
          and _undeclared.capability == "line_status",
          "the stub is a LINE STATUS and the stream now has the field. The "
          "TOKENISER is unchanged and still reads '&c' as 'c' — that is "
          "correct, because it is a pointer, not a word, and deciding which "
          "printed mark is a pointer is the EDITION's business (BACKLOG §2.4: "
          "Finnish prints 'j. n. e.', Malay 'd. s. b.'). relations.py ships "
          "no pattern, imports nothing from lyric_harness, and REFUSES to "
          f"guess: {_undeclared if isinstance(_undeclared, R.Refusal) else _undeclared}")
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


# ---------------------------------------------------------------------------
# X. THE SURFACES THAT HAD NEVER RUN.  An execution-trace differential found
#    `print_inert_report`, `print_relation_report` and the caesura/refrain
#    frame writers with no live caller anywhere in the repository, while
#    `quality/RESULTS_CYM_RHYME.md` §10a and METHOD doctrine 56 both publish
#    answers obtained from them.  Doctrine 48: a principle is only real once
#    it is mechanical, and a check that cannot fail is decoration.  Every
#    number below is MEASURED by running the thing.
# ---------------------------------------------------------------------------

METIDJA = os.path.join(HERE, "..", "metidja.txt")


def _capture(fn, *a, **kw):
    """-> (return value, printed text). The renderers are the never-executed
    half, so their OUTPUT has to be looked at, not only their exit code."""
    import contextlib
    import io
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        out = fn(*a, **kw)
    return out, buf.getvalue()


def _cym_stream(name):
    """-> (raw lines, Stream) for one staged Welsh file, through the real
    `cym` phonology rather than the English fixture. Blank lines and the
    printed gwant are KEPT: `mark_printed_caesura` reads `text_lines`."""
    from quality.phonology import get as _get
    raw = [l.rstrip() for l in
           open(os.path.join(HERE, "..", "corpus", name),
                encoding="utf-8").read().splitlines()]
    # M-39: the derivation is `build_stream`'s to make.  Pre-computing it and
    # passing the result labelled the absence of blank lines as a declaration.
    return raw, R.build_stream(raw, _get("cym"),
                               declaration={"language": "cym"})


def test_inert_command_runs_and_can_fail():
    """X1. `relations.py --inert` — the command every `Inert.measured` field
    names, RUN.

    `print_inert_report`'s own docstring promises "Exit 1 on any finding, so a
    declaration that has become false is a failing command and not a paragraph
    somebody reads", and until 2026-08-13 the command had never once been
    invoked. Both halves are pinned here: that it exits 0 on the file its own
    entries name, and that it CAN exit 1 — because a check that cannot fail is
    decoration and the promise is worth exactly what its falsifier is worth.
    """
    print("\nX1. --inert: the published answer, and the falsifier that makes "
          "it worth publishing")
    import inspect
    rc, text = _capture(R.main, ["--inert", METIDJA])
    check("`relations.py --inert metidja.txt` RUNS and exits 0 — the three "
          "declared-inert coordinates all still hold",
          rc == 0 and "VERDICT: every declaration holds" in text
          and "FAIL" not in text,
          "measured: Span.unit 1 value over 5,761 observations, "
          "rhyme_constraints.Span.unit 1 over 40, "
          "rhyme_constraints.Span.terminator@branch 1 (frame side) over 11, "
          "and 0 SYMMETRIC schemas recovering a deleted instance. This is "
          "the command in every INERT entry's `measured` field and nothing "
          "in this repository had ever run it.")
    _q = stream(QUATRAIN)
    _rcq, _ctext = _capture(R.print_inert_report, _q)
    _census = R.inert_census(_q)
    check("...and the census it PRINTS is the one check_inert() reads, so "
          "the number a reader sees and the verdict cannot drift",
          _rcq == 0 and _ctext.count("MEASURED  :") == len(R.INERT) == 3
          and all(f"{len(v)} value(s) over {n} observations" in _ctext
                  for n, v in _census.values()),
          f"{len(R.INERT)} entries, {_ctext.count('MEASURED  :')} MEASURED "
          f"rows, census {[(n, v) for n, v in _census.values()]} — doctrine "
          f"58: the count is taken over the text in hand, never recorded in "
          f"the entry.")

    # THE FALSIFIER, ARM 1: real input, no patching. A stream with no spans
    # tests nothing, and doctrine 20 says not-tested is not a pass.
    rc0, t0 = _capture(R.print_inert_report, stream([]))
    check("EXIT 1 IS REACHABLE ON REAL INPUT: a stream with no observations "
          "fails rather than passing vacuously",
          rc0 == 1 and "not a pass" in t0,
          "doctrine 20. `Span.unit: no observations on this stream, so the "
          "inertness claim was not tested`. Verified end to end through the "
          "CLI as well: `python3 quality/relations.py --inert EMPTY` exits 1.")

    # THE FALSIFIER, ARM 2: the direction that actually matters — somebody
    # starts SETTING the field and the entry silently becomes a lie.
    _orig = R.enumerate_spans

    def _two_valued(rule, stream_, **kw):
        for n, sp in enumerate(_orig(rule, stream_, **kw)):
            yield dataclasses.replace(sp, unit="phone") if n % 3 == 0 else sp
    R.enumerate_spans = _two_valued
    try:
        bad = R.check_inert(stream(QUATRAIN))
        rc1, t1 = _capture(R.print_inert_report, stream(QUATRAIN))
    finally:
        R.enumerate_spans = _orig
    check("...and EXIT 1 on the direction that matters — a declared-inert "
          "field that GAINS a second value",
          rc1 == 1 and any("Span.unit" in b and "LIVE now" in b for b in bad),
          f"{bad[:1]} — so a later session that wires Span.unit gets a "
          f"failing command, not a field quietly acquiring a semantics "
          f"nobody declared. Restored afterwards: check_inert is clean "
          f"again ({R.check_inert(stream(QUATRAIN))}).")
    check("...and the run is clean again once the patch is removed, so this "
          "test cannot leave the module poisoned",
          R.check_inert(stream(QUATRAIN)) == [])

    # The unread coordinate INSIDE the unread-coordinate checker.
    check("check_inert() takes (stream) alone — its `chans` parameter was "
          "declared and never read, and is gone",
          list(inspect.signature(R.check_inert).parameters) == ["stream"],
          f"{inspect.signature(R.check_inert)} — an unread parameter in the "
          f"one function whose job is to catch unread coordinates. No caller "
          f"passed it; doctrine 1's three honest ends are wire, delete or "
          f"declare, and nothing declares it.")

    # WHAT --inert DOES NOT ANSWER, so the citation in the record is not
    # mistaken for this command's own output.
    check("the INERT table is THREE span-shaped fields, and none of them is "
          "an anchor / diacritic / glide coordinate",
          {e.field for e in R.INERT} == {
              "Span.unit", "rhyme_constraints.Span.unit",
              "rhyme_constraints.Span.terminator@branch"},
          "quality/RESULTS_CYM_RHYME.md §10a is headed "
          "'None of the four declared coordinates is inert "
          "(`relations.py --inert`'s question)' and its four coordinates are "
          "anchor depth, anchor rule, diacritics and glide — measured by "
          "quality/cym_rhyme_rate.py over pair verdicts, not by this "
          "command, which reports three entirely different fields. The "
          "shared name is `relations.py`'s OWN §10a (the INERT section, and "
          "what this report's header prints); the two are different "
          "questions and only one of them has a command.")


def test_relation_report_renderer_runs():
    """X2. `print_relation_report` — the module's default human-facing output,
    never executed in any traced scenario.

    A renderer nothing runs is a renderer whose KeyError nobody has met. The
    unsourced branch is the one that reads a second dict by schema name, so
    it is exercised on a real text where an unsourced schema actually fires.
    """
    print("\nX2. the default report path, RUN — and its printed numbers "
          "checked against the dict it renders")
    rep = R.relation_report(stream(QUATRAIN))
    _, text = _capture(R.print_relation_report, rep)
    check("print_relation_report() runs and prints doctrine 79's three "
          "counts as the dict holds them",
          f"REFUSED {rep['refused']}" in text
          and f"RAN AND FOUND NOTHING {rep['ran_found_nothing']}" in text
          and f"RAN AND FIRED {rep['ran_and_fired']}" in text,
          "the renderer and relation_report() are two objects and only the "
          "dict had a test; a renderer that quietly printed the wrong field "
          "would have been invisible.")
    check("...and the three INSTANCE counts too, UNDECIDED included",
          f"decided-true {rep['instances']['true']}" in text
          and f"UNDECIDED {rep['instances']['undecided']}" in text
          and "A COUNT HERE IS NOT EVIDENCE" in text,
          f"{rep['instances']} — the ternary this module exists to preserve, "
          f"and the pointer to the matched control, both reach stdout.")

    # THE WHOLE VERB, on a real public-domain text, through main().
    rc, out = _capture(R.main, [METIDJA])
    check("`python3 quality/relations.py metidja.txt` RUNS end to end and "
          "exits 0",
          rc == 0 and "phonology eng   schemas declared 77" in out
          and "RAN AND FIRED 24" in out,
          "REFUSED 24 · RAN AND FOUND NOTHING 29 · RAN AND FIRED 24. "
          "REPINNED 2026-08-23 from ~~31 · 26 · 20~~ (2026-08-22, M-39) and "
          "before that ~~26 · 27 · 24~~ (2026-08-13). SEVEN SCHEMAS STOPPED "
          "REFUSING on this text, and the move is the capability work of "
          "2026-08-22/23, not drift. THREE of the seven are attributable "
          "here by measurement rather than by argument: withdrawing "
          "`eng.English.quotients` in memory and re-running this same verb "
          "gives REFUSED 27 · RAN AND FIRED 22, so the shipped manner and "
          "trite partitions account for 3 refusals and 2 of the extra "
          "firings. The other four are the stub, sense, lift, beat and "
          "delivery seams that landed in the same window. M-39's own note "
          "still holds and is why the number is not simply back at 26: "
          "`metidja.txt` prints NO blank line, so it supplies no stanza "
          "ground and the five `frame=\"stanza\"` schemas refuse on it "
          "instead of quantifying over one frame.")

    # THE UNSOURCED BRANCH MOVED TO A FIXTURE WHERE IT FIRES FOR A REASON.
    # This used to read `"[UNSOURCED] blues AAB stanza" in out` off the
    # metidja run above, and M-39 showed that hit for what it was: metidja is
    # sixteen lines of Browning with no stanza break, the collapsed frame put
    # all sixteen in one stanza, and a schema that wants an AAB TRIPLET found
    # one across a poem that has no triplet in it. The branch was exercised by
    # an artefact. It is exercised here by an actual twelve-bar stanza — two
    # of them, so the `forall stanza` figure has something to quantify over —
    # and the fixture declares its ground the way the corpus does, with a
    # printed blank line.
    aab = ["I woke up this morning with the walking blues",
           "I woke up this morning with the walking blues",
           "well I got to keep moving, got nothing left to lose",
           "",
           "the sun going down and the sky is turning grey",
           "the sun going down and the sky is turning grey",
           "and my baby left me, nothing left to say"]
    blues_st = R.build_stream(aab, ENG, declaration={"language": "eng"})
    check("the AAB fixture supplies a stanza ground from its printed blank "
          "line, and TWO stanzas — not one, which is what made the old hit "
          "meaningless",
          blues_st.frames.stanza_source == "blank_lines"
          and blues_st.supply("stanza").n == 2,
          f"{blues_st.supply('stanza')}")
    _, btext = _capture(R.print_relation_report, R.relation_report(blues_st))
    check("...and the UNSOURCED branch — a second dict read by schema name — "
          "is exercised rather than merely present",
          "[UNSOURCED] blues AAB stanza" in btext
          and "no tradition sourced:" in btext,
          "the only branch in the renderer that indexes UNSOURCED[schema]. "
          "`UNSOURCED` has exactly two members and the other, `refrain by "
          "reference`, needs `stub_resolution`, which nothing in this repo "
          "provides — so this schema on a real AAB stanza is the only route "
          "to the branch that is not an artefact.")

    # THE APPARATUS FILTER, which this reader was the last holdout of.
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False,
                                     encoding="utf-8") as fh:
        fh.write("# (instrumental fade, 7/8)\n--- TITLE: probe\n"
                 + open(METIDJA, encoding="utf-8").read())
        probe = fh.name
    try:
        _, tagged = _capture(R.main, [probe])
        _, plain = _capture(R.main, [METIDJA])
    finally:
        os.unlink(probe)
    check("a `#` stage direction and a `--- TITLE:` note are APPARATUS here "
          "too — this reader kept only the `[` case",
          "lines 16   units 96" in tagged and "lines 16   units 96" in plain,
          "`lyric_harness.py`'s relations verb was centralised onto "
          "is_apparatus_line on 2026-08-12 and this module's own main() was "
          "not, so the same file read through the two surfaces was two "
          "different texts — the stage direction tokenised, rhyme-graded and "
          "counted into the stanza frame on one of them. Spelled inline, not "
          "imported: P10's invariant is that relations.py imports nothing "
          "from lyric_harness, and readability.py / grid.py carry their own "
          "copy for the same reason. BLANK lines still go through, which is "
          "why load_lyric_lines would be wrong here even if it were "
          "importable — relations.py derives the stanza frame from them.")


def test_caesura_layer_reconciled():
    """X3. Doctrine 56, and the 10.6 that `search_caesura` claimed as its own.

    `quality/RHYME_COVERAGE.md` §11 holds `search_caesura` up as the REFERENCE
    IMPLEMENTATION other languages should copy, and its docstring quoted
    "k averaged 10.6 hypotheses per line". Nothing had ever called it. Run on
    the very edition METHOD doctrine 56 measures 10.6 against, it returns
    4.02 — the 10.6 belongs to a DIFFERENT search in a different module, and
    the difference is the three-part `sain` placements.
    """
    print("\nX3. the caesura search: three k's, three denominators, one "
          "published number")
    from quality.phonology import get as _get
    cym = _get("cym")
    raw, alun = _cym_stream("cym_alun_strict.txt")
    res = R.search_caesura(alun)
    ks = [len(alun.frames.caesura[li]) for li in sorted(alun.frames.caesura)]
    two_and_three = sum(k + k * (k - 1) / 2 for k in ks) / len(ks)
    tried = [cym.cynghanedd_scan(l)["positions_tried"]
             for l in raw if l.strip()]
    scan_mean = sum(tried) / sum(1 for t in tried if t)

    check("search_caesura() RUNS on the staged Welsh strict-metre edition, "
          "and its own k is 4.02 per line — NOT the 10.6 it used to quote",
          res["lines"] == 1558 and round(res["mean_k"], 2) == 4.02,
          f"corpus/cym_alun_strict.txt: mean_k {res['mean_k']:.4f} over "
          f"{res['lines']} lines. k is the count of word-initial units after "
          f"the first, i.e. the TWO-part cuts, because half_line_a / "
          f"half_line_b is the only caesura locus in this registry.")
    check("...and the 10.6 REPRODUCES, from cym.cynghanedd_scan()'s "
          "positions_tried — a different module and a wider search",
          round(scan_mean, 1) == 10.6,
          f"{scan_mean:.4f} over the same 1,558 lines. "
          f"`python3 quality/cynghanedd_rate.py corpus/cym_alun_strict.txt 1` "
          f"prints `mean placements tried = 10.6` beside `890/1558 = 57.1%`, "
          f"which is METHOD doctrine 56's own Alun figure.")
    check("...and the gap is exactly the THREE-part sain cuts: mean of "
          "k + C(k,2) lands on the scanner's number",
          round(two_and_three, 1) == 10.7
          and abs(two_and_three - scan_mean) < 0.1,
          f"k+C(k,2) = {two_and_three:.4f} against the scanner's "
          f"{scan_mean:.4f}; the residue is the two modules' tokenisers "
          f"(relations.tokenise against cym.WORD_RE/normalise). So a null "
          f"built on THIS k under-corrects a three-part rule by ~2.6x, which "
          f"is doctrine 56's own failure mode one level in.")

    # THE THIRD k, and the reason no printed number has ever contained it.
    _, twm = _cym_stream("cym_twm_or_nant_cywydd.txt")
    caesura_schemas = [n for n, s in R.REGISTRY.items()
                       if "caesura" in s.capabilities()]
    before = {n: R.search_burden(R.REGISTRY[n], twm)["members"]
              for n in caesura_schemas}
    refused = {n: isinstance(R.realise(R.REGISTRY[n], twm), R.Refusal)
               for n in caesura_schemas}
    check("with no caesura declared all four caesura schemas REFUSE and "
          "their search burden is literally zero members",
          len(caesura_schemas) == 4 and all(refused.values())
          and set(before.values()) == {0},
          f"{sorted(caesura_schemas)} — so the mean_k the `relations` verb "
          f"prints live has never contained one caesura hypothesis on any "
          f"input, because nothing in this repository calls search_caesura "
          f"and the schemas that would carry it refuse first.")
    twm_res = R.search_caesura(twm)
    burden = R.search_burden(R.REGISTRY["cynghanedd draws"], twm)
    tks = [len(twm.frames.caesura[li]) for li in sorted(twm.frames.caesura)]
    check("declaring the search moves them from REFUSED to firing, and the "
          "caesura's k enters search_burden() for the first time",
          not isinstance(R.realise(R.REGISTRY["cynghanedd draws"], twm),
                         R.Refusal)
          and burden["members"] == 1280 and burden["searched"] == 1278
          and burden["max_k"] == 15,
          f"corpus/cym_twm_or_nant_cywydd.txt: REFUSED 26 -> 22, fired "
          f"41 -> 44, decided-true 13,715 -> 13,773. `cynghanedd draws` "
          f"returns 50 true instances where it returned a refusal.")
    check("...and search_burden()'s mean_k is a THIRD statistic — size-biased "
          "over member spans, not per line",
          round(twm_res["mean_k"], 2) == 4.10
          and round(burden["mean_k"], 2) == 4.99
          and burden["members"] == 2 * sum(tks)
          and abs(burden["mean_k"]
                  - sum(k * k for k in tks) / sum(tks)) < 1e-9,
          f"per line {twm_res['mean_k']:.4f}; per member span "
          f"{burden['mean_k']:.4f}. Each line contributes 2k spans (one per "
          f"half), so the span mean is sum(k^2)/sum(k) and a long line counts "
          f"more than once. Two denominators, never a ratio (doctrine 79/91) "
          f"— and neither of them is the 10.6.")


def test_printed_caesura_reads_none_of_welsh():
    """X4. Doctrine 55 names THREE printed caesura marks and this function's
    default carries two — measured, so the omission is not implicit.

    The one it drops is the gwant `--`, which is the only printed caesura mark
    that occurs anywhere in this repository's staged Welsh corpora.
    """
    print("\nX4. the printed caesura: doctrine 55's third mark, and what its "
          "absence from the default costs")
    from quality.phonology import get as _get
    _cymphon = _get("cym")
    raw, alun = _cym_stream("cym_alun_strict.txt")
    R.mark_printed_caesura(alun)
    default_hits = len(alun.frames.caesura)
    alun.frames.caesura.clear()
    R.mark_printed_caesura(alun, marks=("--", "/", "|"))
    gwant_hits = len(alun.frames.caesura)
    printed = sum(1 for l in raw if "--" in l)
    check("the shipped default reads ZERO printed caesurae on the edition "
          "that prints 228 of them",
          default_hits == 0 and printed == 228,
          "corpus/cym_alun_strict.txt, e.g. `Ust! y ffrwd,--pa sibrwd sydd?`. "
          "The default is `('/', '|')` and the gwant is neither.")
    check("...and declaring the gwant reads 100 of them",
          gwant_hits == 100,
          f"{gwant_hits} of {printed}: the other {printed - gwant_hits} print "
          f"the gwant line-final, where no unit follows it — the same "
          f"trailing-dash case cym._marked_parts drops rather than reporting "
          f"the whole line unreadable.")
    check("`marks` can hold a multi-character mark at all — a bare string is "
          "still iterated per character, which is what '/|' meant",
          bool(_cymphon.caesura_re(("--", "/", "|")).match("--"))
          and bool(_cymphon.caesura_re(("--", "/", "|")).match("/"))
          and not _cymphon.caesura_re(("--", "/", "|")).match("-"),
          "cym.caesura_re builds the split pattern for any DECLARED mark set "
          "(M-7): `--` means a RUN of dashes and never a single hyphen. A "
          "caller spelling the gwant into the old string default got `-`, "
          "which fires on every hyphenated compound in a language that JOINS "
          "on the hyphen (doctrine 65) — so the mark was not merely absent "
          "from the default, it was inexpressible through the documented "
          "type.")
    check("and since M-7 the TWO defaults are the SAME two marks — cym's own "
          "`caesura='marked'` reads the dash only when an edition declares "
          "it, the rule this function has carried since 2026-08-13",
          _cymphon.CAESURA_MARKS == R.mark_printed_caesura.__defaults__[0]
          == ("/", "|"),
          f"cym.CAESURA_MARKS = {_cymphon.CAESURA_MARKS!r}; the dash was "
          f"promoted to gwant on ONE edition's evidence, and across five "
          f"further Welsh files it is punctuation 72 of 72 times "
          f"(MISSING.md M-7).")
    check("the default stays TWO marks on purpose: an English em-dash is "
          "punctuation, and punctuation is not metre",
          R.mark_printed_caesura.__defaults__[0] == ("/", "|"),
          "doctrine 55's own case was a printed COMMA selecting which rule "
          "each of 1,558 lines was tested against. Adding `--` to the default "
          "would move that defect one glyph over for every non-Welsh stream; "
          "the mark inventory is a DECLARATION (doctrine 1) and the caller "
          "makes it.")


def test_refrain_tail_documented_call_was_impossible():
    """X5. `mark_refrain_tail`'s own docstring named a call that returns None
    on every ghazal in the corpus, silently, and nothing had ever run it.

    `lines=` is a set of LINE INDICES; `fas.ghazal_rhyme_lines(hemistichs)`
    returns hemistich TEXTS. Strings tested against integer indices match
    nothing, `refrain_source` is set to 'computed' regardless, and the two
    refrain schemas go from REFUSED to a measured ZERO — doctrine 20's
    collapse produced by an argument type.
    """
    print("\nX5. the refrain tail: the documented call could not work, and "
          "failed without an error")
    import json
    from quality.phonology import get as _get
    from quality.phonology import fas as fas_mod
    fas = _get("fas")
    data = json.load(open(os.path.join(HERE, "..", "corpus",
                                       "fas_hafez.json"), encoding="utf-8"))
    poem = data[0]["poem"]
    texts = fas_mod.ghazal_rhyme_lines(poem)
    check("fas.ghazal_rhyme_lines() returns hemistich TEXTS, and "
          "mark_refrain_tail wants indices — the mismatch is a fact about "
          "the two signatures",
          all(isinstance(x, str) for x in texts) and len(texts) == 8,
          "`[h[0]] + h[1::2]` over 14 hemistichs. Both are correct on their "
          "own; the docstring joining them was not.")
    st = R.build_stream(poem, fas, declaration={"language": "fas"})
    try:
        R.mark_refrain_tail(st, lines=texts)
        raised = ""
    except R.NoReferent as exc:
        raised = str(exc)
    check("passing it REFUSES by name now, where it used to return None on "
          "495 of 495 ghazals with no error",
          "LINE INDICES" in raised and "ghazal_rhyme_lines" in raised,
          raised or "NOTHING RAISED — the silent path is back")

    idx = [0] + list(range(1, len(poem), 2))
    st2 = R.build_stream(poem, fas, declaration={"language": "fas"})
    before = {n: isinstance(R.realise(R.REGISTRY[n], st2), R.Refusal)
              for n in R.REGISTRY if "refrain_tail" in
              R.REGISTRY[n].capabilities()}
    got = R.mark_refrain_tail(st2, lines=idx)
    radif = R.realise(R.REGISTRY["epistrophe / radif"], st2)
    check("...and with the INDICES it finds Hafez's radif, which is what the "
          "function is for",
          got is not None and got["depth"] == 1 and got["run"] == ("ها",)
          and len(got["lines"]) == 6,
          f"{got and got['run']} over {got and len(got['lines'])} "
          f"rhyme-bearing hemistichs of ghazal 1. MEASURED over the whole "
          f"corpus: it fires on 66 of the 495 ghazals in "
          f"corpus/fas_hafez.json (ghazal 2 `کجا`, ghazals 3 and 4 `را`) and "
          f"on 0 of 495 through the call the docstring named.")
    check("...and the two schemas that ride refrain_tail move from REFUSED "
          "to instances, not from REFUSED to a measured zero",
          set(before.values()) == {True}
          and sum(1 for i in radif if i.verdict is True) == 15,
          f"before: {sorted(before)} all REFUSED. after: `epistrophe / "
          f"radif` {sum(1 for i in radif if i.verdict is True)} true "
          f"instances. Through the documented call both schemas ran and "
          f"reported 0 — a refusal turned into a null by a type error nobody "
          f"could see (doctrine 20).")


# ---------------------------------------------------------------------------
# X6. THE VACUOUS FRAME. A source is not a population, and a declared-empty
#     frame is a third state.
# ---------------------------------------------------------------------------

#: The staged English item the defect was measured on. 24 lines, 204 units,
#: and the split ~~30 FIRED / 26 REFUSED / 21 RAN AND FOUND NOTHING~~
#: **31 / 26 / 20** before either frame-supplier is called — REPINNED
#: 2026-08-27 (doctrine 17, the superseded figures kept visible): the M-148
#: P1 repair made `_seq` read the post-vocalic CLUSTER for the skothending
#: schema's vowel-anchored sequence, and that one schema crossed from
#: RAN-AND-FOUND-NOTHING to FIRED on this item (12 true instances,
#: oppression~constellation the first — shared post-stress SH, EH/EY nuclei
#: differing). One schema moved and it is the repaired one; the REFUSED
#: count is untouched, which is this section's own subject.
VACUITY_ITEM = "song/eng_american_dan_e_townsend.txt"

#: The six schemas that rode the two shipped frame-suppliers into a silent
#: zero. Four want `caesura`, two want `refrain_tail`.
VACUOUS_SIX = ("cynghanedd groes", "cynghanedd draws",
               "cynghanedd groes o gyswllt", "leonine rhyme",
               "epistrophe / radif", "qafiya (before the radif)")


def _eng_corpus_stream(name):
    """-> (raw lines, Stream) for one staged English item through the fixture.

    Apparatus is dropped the same way `relations.main` drops it, and blank
    lines are KEPT because the stanza frame is derived from them.
    """
    raw = [l.rstrip() for l in
           open(os.path.join(HERE, "..", "corpus", name),
                encoding="utf-8").read().splitlines()
           if not l.strip().startswith(("[", "---", "#"))]
    # M-39, as above.
    return raw, R.build_stream(raw, ENG, declaration={"language": "eng"})


def _split(st):
    """(fired, refused, ran-and-found-nothing) over all 77, doctrine 79."""
    f = r = n = 0
    for s in R.REGISTRY.values():
        out = R.realise(s, st, keep="all")
        if isinstance(out, R.Refusal):
            r += 1
        elif any(i.verdict is True for i in out):
            f += 1
        else:
            n += 1
    return f, r, n


class _PreFixGate:
    """The gate as it stood before 2026-08-22: `provides` reads the SOURCE.

    The mutant this section fails against. It restores exactly one sentence —
    a declared source is a supplied capability — and nothing else, so a check
    that survives it was never testing the fix.
    """

    def __enter__(self):
        self.orig = R.Stream.supply

        def supply(self, cap):
            got = self.orig_supply(cap)
            if got.state == "empty":
                return R.Supply(cap, "present", got.n, got.source,
                                "PRE-FIX: source declared, population unread")
            return got
        R.Stream.orig_supply = self.orig
        R.Stream.supply = supply
        return self

    def __exit__(self, *exc):
        R.Stream.supply = self.orig
        del R.Stream.orig_supply
        return False


def test_vacuous_frame_is_not_a_null():
    """X6. `mark_printed_caesura` on English declares a source and marks
    NOTHING, and six schemas went from REFUSED to a measured zero.

    Doctrine 20: an instrument that has not fired is not an instrument that
    fired and found nothing — and a DECLARED-BUT-EMPTY frame is a third thing
    that had no name. Every span rule reading such a frame enumerates zero
    loci, so the zero was inconclusive BY CONSTRUCTION.

    TEN CHECKS. Four fail under `_PreFixGate` (the three states collapse, the
    six stop refusing, the report's fourth count goes to 0, and the split
    moves). The other six are controls that must pass on BOTH trees: the
    never-looked state, the two positive cases, the Refusal contract, and the
    partition arithmetic.
    """
    print("\nX6. the vacuous frame — a declared source is not a population "
          "(doctrine 20)")
    raw, st = _eng_corpus_stream(VACUITY_ITEM)
    before = _split(st)
    check("the staged item reproduces the measured split 31 FIRED / 26 "
          "REFUSED / 20 RAN AND FOUND NOTHING (repinned from 30/26/21 at "
          "M-148: the repaired skothending schema now fires here)",
          before == (31, 26, 20),
          f"{before} on corpus/{VACUITY_ITEM}: {len(raw)} raw lines, "
          f"{len(st.units)} units. PREMISE — it must hold on both trees.")

    # -- STATE 1. NEVER LOOKED.
    s1 = st.supply("caesura")
    r1 = R.realise(R.REGISTRY["cynghanedd groes"], st)
    check("STATE 1 never looked: supply is `absent` with source 'none', and "
          "the refusal's kind is 'capability'",
          s1.state == "absent" and s1.source == "none" and s1.n == 0
          and isinstance(r1, R.Refusal) and r1.kind == "capability"
          and r1.vacuous == () and r1.missing == ("caesura",),
          f"{s1} — the remedy here IS to declare a source.")

    # -- STATE 2. LOOKED, AND THE FRAME IS EMPTY.
    cae = R.mark_printed_caesura(st)
    ref = R.mark_refrain_tail(st)
    check("both shipped frame-suppliers RUN on this text and mark NOTHING, "
          "and both now say so in their return",
          cae["found"] == 0 and ref["found"] == 0
          and st.frames.caesura_source == "printed"
          and st.frames.refrain_source == "computed",
          f"caesura {cae}; refrain {ref}. MISSING M-28 is why: English "
          f"prints no caesura, and the 1,628 lines carrying an internal run "
          f"of 2+ spaces are line-number columns and speaker gaps. The "
          f"SOURCE is still declared on purpose — deleting it would make "
          f"'the instrument ran and found none' read as 'nobody looked'.")
    s2 = st.supply("caesura")
    s2r = st.supply("refrain_tail")
    check("STATE 2 looked-and-empty: supply is `empty`, n=0, and the SOURCE "
          "survives — so state 2 is distinguishable from state 1",
          s2.state == "empty" and s2.n == 0 and s2.source == "printed"
          and s2r.state == "empty" and s2r.source == "computed"
          and s1.state != s2.state and s1.source != s2.source,
          f"{s2} / {s2r}")
    outs = {n: R.realise(R.REGISTRY[n], st, keep="all") for n in VACUOUS_SIX}
    _shown = str({n: (o.kind, o.vacuous) if isinstance(o, R.Refusal)
                  else "RAN — %d instances" % len(o)
                  for n, o in outs.items()})
    check("...and all SIX schemas REFUSE with kind 'vacuous_frame', naming "
          "the empty frame on `.vacuous` — not an empty list",
          all(isinstance(o, R.Refusal) and o.kind == "vacuous_frame"
              and o.vacuous == o.missing for o in outs.values())
          and {o.vacuous[0] for o in outs.values()}
          == {"caesura", "refrain_tail"},
          _shown)
    after = _split(st)
    check("...so calling both markers moves NOTHING: the split is still "
          "31/26/20, where it used to become 31/20/26",
          after == before == (31, 26, 20),
          f"before {before} after {after}. Six schemas crossing from REFUSED "
          f"to RAN AND FOUND NOTHING is the collapse; the counts are the "
          f"cheapest place to see it.")

    # -- THE REPORT CARRIES THE FOURTH COUNT.
    rep = R.relation_report(st)
    check("relation_report separates the two refusals and the partition "
          "still closes",
          rep["refused_vacuous"] == 6 and rep["refused_capability"] == 20
          and rep["refused"] == 26
          and (rep["refused"] + rep["ran_found_nothing"]
               + rep["ran_and_fired"]) == rep["declared"] == 77
          and {r[0] for r in rep["vacuous_refusals"]} == set(VACUOUS_SIX)
          and all(len(r) == 4 for r in rep["refusals"]),
          f"refused {rep['refused']} = capability "
          f"{rep['refused_capability']} + EMPTY FRAME "
          f"{rep['refused_vacuous']}; ran-found-nothing "
          f"{rep['ran_found_nothing']}; fired {rep['ran_and_fired']}")

    # -- STATE 3. LOOKED, THE FRAME IS POPULATED, AND A REAL FINDING SURVIVES.
    #    This is the half that proves the rule cannot swallow anything.
    lein = stream(["The queen was seen / a light was green",
                   "The night was bright / the sky was white"])
    got = R.mark_printed_caesura(lein)
    s3 = lein.supply("caesura")
    leo = R.realise(R.REGISTRY["leonine rhyme"], lein, keep="all")
    groes_st = stream(["A cat may sit / a cot my seat",
                       "A dog will run / a dig well ran"])
    R.mark_printed_caesura(groes_st)
    groes = R.realise(R.REGISTRY["cynghanedd groes"], groes_st, keep="all")
    check("STATE 3 looked-and-populated: supply is `present` with n>0, and "
          "the caesura schemas RUN AND FIRE",
          s3.state == "present" and s3.n == 2 and got["found"] == 2
          and not isinstance(leo, R.Refusal)
          and sum(1 for i in leo if i.verdict is True) == 2
          and not isinstance(groes, R.Refusal)
          and sum(1 for i in groes if i.verdict is True) == 2,
          f"{s3}; leonine rhyme "
          f"{sum(1 for i in leo if i.verdict is True)} true, cynghanedd "
          f"groes {sum(1 for i in groes if i.verdict is True)} true on the "
          f"consonant-skeleton pair. THE RULE MAY NOT SWALLOW A FINDING: a "
          f"gate keyed on the population must open the moment the population "
          f"is non-zero.")
    rst = stream(["the light will go down to the sea",
                  "the night will go down to the sea",
                  "the bright will go down to the sea",
                  "the sight will go down to the sea"])
    rgot = R.mark_refrain_tail(rst)
    epi = R.realise(R.REGISTRY["epistrophe / radif"], rst, keep="all")
    qaf = R.realise(R.REGISTRY["qafiya (before the radif)"], rst, keep="all")
    check("...and the refrain schemas do the same on a text that HAS a "
          "shared tail",
          rgot["found"] == 4 and rst.supply("refrain_tail").state == "present"
          and sum(1 for i in epi if i.verdict is True) == 6
          and sum(1 for i in qaf if i.verdict is True) == 6,
          f"{rgot}; epistrophe {sum(1 for i in epi if i.verdict is True)} "
          f"true, qafiya {sum(1 for i in qaf if i.verdict is True)} true — "
          f"the miscounted case, still counted.")

    # -- THE CONTRACTS THE FIX MAY NOT BREAK.
    raised = []
    for obj in (r1, outs["cynghanedd groes"], s1, s2, s3):
        try:
            bool(obj)
            raised.append(f"{type(obj).__name__} has a truth value")
        except TypeError:
            pass
    check("neither a Refusal nor a Supply has a truth value, and `.capability`"
          " is still `missing[0]`",
          not raised
          and all(o.capability == o.missing[0] for o in outs.values())
          and r1.capability == "caesura" and r1.complete
          and R.Refusal("x", "denominator", "d").kind == ""
          and R.Refusal("x", "denominator", "d").vacuous == (),
          f"{raised or 'both raise TypeError'}. `kind` defaults to '' — a "
          f"Refusal built outside realise() has passed through no gate here "
          f"and labelling it 'capability' would be a claim about one.")
    check("`Supply.declared` is TRUE for both looked-at states and False only "
          "for never-looked",
          s2.declared and s3.declared and not s1.declared
          and set(R.SUPPLY_STATES) == {"absent", "empty", "present"}
          and "vacuous_frame" in R.REFUSAL_KINDS,
          "'declared and not provided' is the vacuous state, in one read.")

    # -- THE MUTANT. Restore the pre-fix sentence and watch the defect return.
    with _PreFixGate():
        mut_outs = {n: R.realise(R.REGISTRY[n], st, keep="all")
                    for n in VACUOUS_SIX}
        mut_split = _split(st)
        mut_rep = R.relation_report(st)
        mut_state = st.supply("caesura").state
    check("MUTANT: with `provides` reading the SOURCE again, all six stop "
          "refusing and return an empty list, the split moves to 31/20/26, "
          "and the fourth count goes to zero",
          all(not isinstance(o, R.Refusal) and len(o) == 0
              for o in mut_outs.values())
          and mut_split == (31, 20, 26) and mut_rep["refused_vacuous"] == 0
          and mut_state == "present",
          f"{mut_split} under the mutant against {after} at head; "
          f"{ {n: len(o) for n, o in mut_outs.items()} }. Six schemas, six "
          f"zeros, and nothing in the output able to say the frames were "
          f"empty — that is the state this section exists to make illegal.")
    check("...and the mutant is REVERSIBLE — head is restored, so the "
          "measurement above was not an artefact of the patch",
          st.supply("caesura").state == "empty" and _split(st) == before,
          f"{st.supply('caesura')}")


# ---------------------------------------------------------------------------
# X7. THE ORTHOGRAPHIC SURFACE — the first ALT_SURFACE a caller can build
# ---------------------------------------------------------------------------

EYE_DRAFT = ["I never learned to love", "the engine will not move",
             "the poet made a rhyme", "we never had the time"]


def test_orthography_surface_is_declarable():
    """X7. `eye rhyme` refused on every text under every declaration because
    nothing could build the surface it names. `declare_orthography` can.

    NINE CHECKS. Three fail without the surface (the refusal stands, no
    instance exists, love/move is not found); the rest are the contract:
    the rime rule is the CALLER'S, the surface is a projection of the primary
    segmentation, an empty rime rule is a VACUOUS surface and not a null, and
    nothing about the phonemic reading moved.
    """
    print("\nX7. the orthographic surface — declared by the caller, because "
          "a rime rule is a fact about a spelling system (doctrine 45/65)")
    st = stream(EYE_DRAFT)
    before = R.realise(R.REGISTRY["eye rhyme"], st)
    check("`eye rhyme` REFUSES on a plain English stream, naming "
          "'orthography' — the state this closes",
          isinstance(before, R.Refusal) and before.missing == ("orthography",)
          and before.kind == "capability"
          and st.supply("orthography").state == "absent",
          f"{before.capability}; MISSING E-2. PREMISE — true on both trees.")

    got = R.declare_orthography(st, lh.spelled_rime)
    sup = st.supply("orthography")
    check("...and DECLARING it supplies the capability, with a population",
          sup.state == "present" and sup.n == got["graphemes"] == 20
          and got["units"] == 24 and sup.source == "declared",
          f"{got}; {sup}. 20 of 24 units carry a grapheme — the four "
          f"that do not are the non-word-final syllables of `never`, "
          f"`engine` and "
          f"`poet`, and they read UNKNOWN rather than empty.")
    out = R.realise(R.REGISTRY["eye rhyme"], st, keep="all")
    true = [i for i in out if i.verdict is True]
    check("...and the schema RUNS and finds love/move: same spelled rime, "
          "different nucleus",
          not isinstance(out, R.Refusal) and len(true) == 1
          and "LAHV" in true[0].describe(st)
          and "MUWV" in true[0].describe(st),
          f"{[i.describe(st) for i in true]} out of {len(out)} judged pairs. "
          f"spelled_rime('love') == spelled_rime('move') == "
          f"{lh.spelled_rime('love')!r}.")
    rt = [i for i in out
          if "RAYM" in i.describe(st) and "TAYM" in i.describe(st)]
    check("...and rhyme/time, which SHARE the sound, are correctly NOT an "
          "eye rhyme — the schema is not `perfect rhyme` wearing a surface",
          len(rt) == 1 and rt[0].verdict is False,
          f"{[i.describe(st) for i in rt]}: the grapheme channel agrees on "
          f"{lh.spelled_rime('rhyme')!r}/{lh.spelled_rime('time')!r} and the "
          f"nucleus DIFFER channel is False, which is the conjunction doing "
          f"its job.")

    # THE RULE IS THE CALLER'S, AND THE ANCHOR IS TOO.
    check("this module ships NO rime rule and refuses a non-callable by "
          "name",
          not any("rime" in n.lower() for n in dir(R) if not n.startswith("_")
                  and n != "declare_orthography")
          and isinstance(_raises(R.declare_orthography, st, "ove"),
                         R.NoReferent),
          "y is a vowel letter and w is not; a final silent -e folds. Those "
          "are ENGLISH, and relations.py serves nine languages — a built-in "
          "default would be a checker silently picking a coordinate.")
    FEM = ["a bowl of molten silver", "the letters they deliver"]

    def _end_graphemes(rime):
        s = stream(FEM)
        R.declare_orthography(s, rime)
        alt = s.alt["orthography"]
        return tuple(alt.units[ids[-1]].syl.text
                     for ids in s.lines if ids)

    bare = _end_graphemes(lh.spelled_rime)
    anchored = _end_graphemes(
        lambda w: lh.spelled_rime(w, stress_from_end=2))
    check("...and `stress_from_end` is visibly the caller's: the SAME draft "
          "carries different graphemes on the surface under the two rules",
          bare == ("er", "er") and anchored == ("ilver", "iver")
          and bare != anchored,
          f"bare {bare} vs anchored {anchored}. Bare, silver/deliver share "
          f"'-er' and the ENTIRE unstressed -er/-ing/-ed space collapses "
          f"into one grapheme class — `spelled_rime`'s own docstring calls "
          f"that over-reach, and the anchor rule that fixes it is the "
          f"harness's (last primary stress), not this module's. Choosing "
          f"either here would be a coordinate nobody declared. Read at the "
          f"SURFACE rather than through `eye rhyme`'s verdict on purpose: "
          f"both readings verdict False on this pair because the nucleus "
          f"DIFFER channel refuses it either way, and a check that could not "
          f"see the difference would be asserting the wrong layer.")

    # A SURFACE THAT ANSWERS NOTHING IS VACUOUS, NOT NULL — X6's rule, one
    # seam over, and it is the reason this is not a bare `alt[name] = ...`.
    dead = stream(EYE_DRAFT)
    R.declare_orthography(dead, lambda w: "")
    d_sup = dead.supply("orthography")
    d_out = R.realise(R.REGISTRY["eye rhyme"], dead)
    check("a rime rule that answers nothing leaves the surface DECLARED AND "
          "EMPTY, which refuses by name rather than running over unreadable "
          "positions",
          d_sup.state == "empty" and d_sup.n == 0
          and d_sup.source == "declared"
          and isinstance(d_out, R.Refusal) and d_out.kind == "vacuous_frame"
          and d_out.vacuous == ("orthography",),
          f"{d_sup}. Defect P7 is the same shape with a real second "
          f"phonology: a surface that re-tokenises projects to None at every "
          f"position, so every read is None and the schema reports a zero.")
    alt = st.alt["orthography"]
    projected = sum(1 for u in st.units if R._project(u, alt) is not None)
    check("the surface PROJECTS the primary segmentation rather than "
          "re-reading the text, so `_project` aligns at EVERY position and "
          "the surface's own phon refuses to syllabify",
          projected == len(st.units) == 24
          and [u.i for u in alt.units] == [u.i for u in st.units]
          and isinstance(_raises(alt.phon.syllabify, "love"), R.NoReferent),
          f"{projected} of {len(st.units)} units project. A second "
          f"declaration that re-tokenised would project to None everywhere "
          f"(defect P7) and read as declared-and-empty here, which is why "
          f"the surface is built by re-labelling and not by re-reading.")
    plain = stream(EYE_DRAFT)
    check("...and declaring it moves NO phonemic count: `perfect rhyme` is "
          "byte-identical with and without the surface",
          [(i.a.idx, i.b.idx, i.verdict)
           for i in R.realise(R.REGISTRY["perfect rhyme"], st, keep="all")]
          == [(i.a.idx, i.b.idx, i.verdict)
              for i in R.realise(R.REGISTRY["perfect rhyme"], plain,
                                 keep="all")],
          "a second declaration is read only where a ChannelRule names its "
          "surface; nothing else in the registry does.")


def _raises(fn, *a, **kw):
    try:
        fn(*a, **kw)
    except Exception as e:                                    # noqa: BLE001
        return e
    return None


# ---------------------------------------------------------------------------
# X8. `frequency` STAYS REFUSED, and the refusal is MEASURED against all
#     three shipped tables rather than argued from one.
# ---------------------------------------------------------------------------


def test_frequency_refusal_is_measured_against_the_shipped_tables():
    """X8. The two sources a reader reaches for next are doctrine 92's two
    HALVES, and they disagree.

    `quality/frequency.py` already declares `eng-verse` to have NO INDEPENDENT
    SOURCE — the cell needs the right POSITION, the right MEDIUM and the
    right PERIOD, and nothing here has all three. This measures that on the two
    tables the repo does hold, so the UNPROVIDABLE entry is a test and not a
    paragraph (doctrine 48).

    SIX CHECKS. Four fail if the entry is deleted or `frequency` is wired; two
    are the arithmetic of the two tables and hold regardless.
    """
    print("\nX8. `frequency`: the two shipped tables are doctrine 92's two "
          "halves, and they order the cliche vocabulary differently")
    import collections
    st = stream(QUATRAIN)
    # READS THE RETIRED TABLE SINCE 2026-08-23, and the move is the point of
    # the repin rather than an accident of it. `trite rhyme` stopped
    # REQUIRING `frequency` -- it gated on a bare `requires=` it read on no
    # channel, and now carries `ClassEqual(resource="trite")` -- so the entry
    # left `UNPROVIDABLE`, where `check_unprovidable` correctly reports an
    # entry that outlived its schema. NOTHING BELOW CHANGES: the four checks
    # that fail if the argument is weakened, and the two that are the
    # arithmetic of the two tables, all still run, because the argument is
    # about the FREQUENCY ROUTE and that route is exactly as blocked as it
    # was. This section is why the entry was retired WHOLE instead of
    # deleted.
    entry = next(e for e in R.RETIRED_UNPROVIDABLE
                 if e.capability == "frequency")
    check("`frequency` is still unprovidable and blocker 'disjoint', no "
          "stream supplies it, and the schema it names has stopped asking — "
          "which is what RETIRED means and why it is not in the live table",
          entry.blocker == "disjoint"
          and st.supply("frequency").state == "absent"
          and entry.schemas == ("trite rhyme",)
          and "trite rhyme" in R.REGISTRY
          and "frequency" not in R.REGISTRY["trite rhyme"].capabilities()
          and entry.capability not in {e.capability
                                       for e in R.UNPROVIDABLE},
          f"{st.supply('frequency')}; `trite rhyme` capabilities "
          f"{R.REGISTRY['trite rhyme'].capabilities()}")

    tot = collections.Counter()
    authors = collections.defaultdict(set)
    path = os.path.join(HERE, "..", "data", "song_endword_en.tsv")
    for line in open(path, encoding="utf-8"):
        if line.startswith("#") or line.startswith("word\t"):
            continue
        w, a, c = line.rstrip("\n").split("\t")
        tot[w] += int(c)
        authors[w].add(a)
    top = [w for w, _ in tot.most_common(20)]
    check("the ONLY line-final source is pre-1931 and its head is `me` and "
          "`thee`",
          top[:2] == ["me", "thee"] and tot["me"] == 2948
          and tot["thee"] == 2031 and len(authors["me"]) == 483,
          f"data/song_endword_en.tsv: {len(tot)} distinct line-final words, "
          f"{sum(tot.values())} tokens. A commonness cut on it flags `thee` "
          f"as one of the two tritest line-endings in English.")

    lex = _lex()
    words = {w for p in lh.CLICHE_PAIRS for w in p}
    end_rank = {w: i for i, (w, _) in enumerate(tot.most_common())}
    both = [(w, end_rank[w], lex.freq_rank.get(w, lex.freq_rank_oov))
            for w in sorted(words) if w in end_rank]
    rho = _spearman([b for _, b, _ in both], [c for _, _, c in both])
    check("...and the CONTEMPORARY source (`Lexicon.freq_rank` = "
          "data/opensubtitles_en_50k.tsv) orders the same words differently: "
          "Spearman 0.32",
          len(both) == 58 and 0.30 <= rho <= 0.34
          and lex.freq_rank.get("rhyme") > 9000
          and lex.freq_rank.get("time") < 100,
          f"rho={rho:.3f} over the {len(both)} CLICHE_PAIRS words in both. "
          f"`rhyme` is line-final rank {end_rank['rhyme']} against spoken "
          f"{lex.freq_rank['rhyme']}; `skies` {end_rank['skies']} against "
          f"{lex.freq_rank['skies']}. WHICH TABLE decides the verdict, and "
          f"neither is the `eng-verse` cell that would settle it.")

    try:
        import quality.frequency as F
        unavailable = F.unavailable("eng-verse")
    except Exception as exc:                                  # noqa: BLE001
        unavailable = ""
        check("quality/frequency.py imports", False, str(exc))
    check("...which is `frequency.NO_INDEPENDENT_SOURCE['eng-verse']` stating "
          "the same thing one module over",
          bool(unavailable) and "post-1960" in unavailable
          and "nothing can" in unavailable,
          "position + medium + period, and no source has all three. The "
          "refusal is not this file's opinion.")

    check("the table is NOT INDEPENDENT of the corpus (doctrine 13), so even "
          "reading it needs a DECLARED author a Stream does not carry",
          sum(1 for a in authors.values()
              if "eng_american_dan_e_townsend" in a) == 20
          and not hasattr(R.Stream, "author")
          and "author" not in R.Stream.__dataclass_fields__,
          "the item X6 measures the vacuity on has 20 rows IN the table; "
          "`quality/frequency.py` refuses to serve it for a contained author "
          "unless `leave_out=` is passed, and there is nothing on the stream "
          "to pass.")
    check("...and the entry says all of this in `detail`, so a reader who "
          "never runs this file still gets the numbers",
          "0.319" in entry.detail and "song_endword_en.tsv" in entry.detail
          and "opensubtitles" in entry.detail
          and "leave-one-author-out" in entry.detail,
          "doctrine 48: a principle that lives only in prose gets followed "
          "exactly as often as somebody remembers it.")


def _spearman(xs, ys):
    n = len(xs)
    rx = sorted(range(n), key=lambda i: xs[i])
    ry = sorted(range(n), key=lambda i: ys[i])
    px, py = [0] * n, [0] * n
    for r, i in enumerate(rx):
        px[i] = r
    for r, i in enumerate(ry):
        py[i] = r
    mx, my = sum(px) / n, sum(py) / n
    num = sum((px[i] - mx) * (py[i] - my) for i in range(n))
    den = (sum((px[i] - mx) ** 2 for i in range(n))
           * sum((py[i] - my) ** 2 for i in range(n))) ** 0.5
    return num / den


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
    test_p14_identity_partition()
    test_p15_unmatched_vocabulary()
    test_build_stream_is_linear()
    test_sequence_predicates_are_implemented()
    test_head_anchored_relations_are_reachable()
    test_refusal_is_not_false()
    test_refusal_names_every_missing_capability()
    test_poet_is_an_alt_surface()
    test_unprovidable_is_declared_and_measured()
    test_rhyme_constraints_unreadable_nucleus()
    test_traditions()
    test_tradition_provenance()
    test_null_module()
    test_known_open_defects()
    test_inert_command_runs_and_can_fail()
    test_relation_report_renderer_runs()
    test_caesura_layer_reconciled()
    test_printed_caesura_reads_none_of_welsh()
    test_refrain_tail_documented_call_was_impossible()
    test_vacuous_frame_is_not_a_null()
    test_orthography_surface_is_declarable()
    test_frequency_refusal_is_measured_against_the_shipped_tables()
    print("=" * 66)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING:")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print("all relations regressions pass")

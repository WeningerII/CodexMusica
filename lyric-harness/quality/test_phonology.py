#!/usr/bin/env python3
"""Regressions for the three unblocked phonologies (known gap 6).

The load-bearing tests are the ones that check a module against its
TRADITION rather than against its own rules: Kalevala lines that are known to
alliterate must alliterate, and canonical regulated verse that is known to
rhyme must rhyme. A syllabifier that satisfies only its author is untested.

Run: python3 quality/test_phonology.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.phonology import Unsupported, declared, get  # noqa: E402
from quality.phonology import cym  # noqa: E402


def _raises(fn):
    """-> True if fn() raises. Used where the contract is a REFUSAL: an
    undeclared setting must stop, not fall back to whatever the author of the
    default happened to prefer."""
    try:
        fn()
    except Exception:
        return True
    return False

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# Kalevala I, opening (Lönnrot 1849; public domain). Every one of these lines
# alliterates -- that is what the metre requires -- so they are a known-answer
# test rather than a demonstration.
KALEVALA = [
    "Mieleni minun tekevi",
    "aivoni ajattelevi",
    "lähteäni laulamahan",
    "saa'ani sanelemahan",
    "sukuvirttä suoltamahan",
    "lajivirttä laulamahan",
]


def test_finnish_syllabification():
    print("\n1. Finnish — the syllabifier against known words")
    f = get("fin")
    cases = {
        "vaka": ["va", "ka"], "vanha": ["van", "ha"],
        "väinämöinen": ["väi", "nä", "möi", "nen"],
        "laulaja": ["lau", "la", "ja"],
        "maailma": ["maa", "il", "ma"],      # long aa, then hiatus a|i
        "aurinko": ["au", "rin", "ko"],
        "kukka": ["kuk", "ka"],              # geminate splits
        "suomi": ["suo", "mi"],              # uo is a diphthong
        "opiskelija": ["o", "pis", "ke", "li", "ja"],
    }
    for w, want in cases.items():
        got = [s.text for s in f.syllabify(w)]
        check(f"{w} -> {'.'.join(want)}", got == want, "" if got == want
              else f"got {'.'.join(got)}")


def test_finnish_hiatus_is_not_a_diphthong():
    print("\n2. Finnish — an unlisted vowel pair is TWO syllables")
    f = get("fin")
    # 'ai' is a diphthong, 'ao' is not. Getting this wrong is the single most
    # common way to mis-syllabify Finnish, and it shifts every downstream
    # grid position.
    check("kaikki has a diphthong nucleus",
          [s.nucleus for s in f.syllabify("kaikki")][0] == "ai")
    check("kaaos splits at the hiatus",
          [s.text for s in f.syllabify("kaaos")] == ["kaa", "os"],
          "".join(s.text + "." for s in f.syllabify("kaaos")))


def test_finnish_stress_is_free():
    print("\n3. Finnish — stress is a rule, not a lexicon")
    f = get("fin")
    check("primary stress on syllable 1",
          f.syllabify("väinämöinen")[0].prominence == 1)
    check("secondary on the third, none on the final",
          [s.prominence for s in f.syllabify("väinämöinen")] == [1, 0, 1, 0])
    check("a three-syllable word does not stress its final",
          [s.prominence for s in f.syllabify("laulaja")] == [1, 0, 0])


def test_kalevala_lines_alliterate():
    print("\n4. Finnish — the TRADITION test: Kalevala lines must alliterate")
    f = get("fin")
    for ln in KALEVALA:
        n, total, cls = f.line_alliteration(ln)
        check(f"{ln[:28]:<28} {n}/{total} share an initial", n >= 2,
              f"class {cls}")
    n, _t, _c = f.line_alliteration("kissa juoksi pöydälle nopeasti")
    check("a line with no shared initial does not report one", n < 2,
          f"{n} words share an initial")


def test_finnish_marks_inside_words():
    print("\n5b. Finnish — the two word-internal marks do OPPOSITE things")
    f = get("fin")
    # The apostrophe blocks a VOWEL MERGER; the hyphen blocks RESYLLABIFICATION
    # across a compound seam. Both were once out-of-inventory, which returned []
    # and dropped the word out of every alliteration class -- 223 hyphen tokens
    # in the Kalevala, `iän-ikuinen` alone 50 times.
    check("a compound seam is kept, not resyllabified across",
          [s.text for s in f.syllabify("iän-ikuinen")]
          == ["i", "än", "i", "kui", "nen"],
          str([s.text for s in f.syllabify("iän-ikuinen")]))
    check("and WITHOUT the seam the same letters do resyllabify",
          [s.text for s in f.syllabify("iänikuinen")]
          == ["i", "ä", "ni", "kui", "nen"],
          "so the hyphen carries information -- deleting it, which is the "
          "right rule for Welsh, would be the wrong rule here")
    check("a hyphenated compound alliterates on its first element",
          f.alliterates("iän-ikuinen", "ikuinen") is True)
    # The token class admits ' and - because they occur inside words, so it
    # also matched them standing alone: 60 bare apostrophes and 46 bare hyphens
    # in the Kalevala, inflating the word count a caller divides by.
    check("bare punctuation is not a word",
          f.line_alliteration("- veessä on väkeä paljo -")[1] == 4,
          str(f.line_alliteration("- veessä on väkeä paljo -")))
    # The winning class was chosen by max() over a SET, so it depended on
    # PYTHONHASHSEED. The count was stable; the identity of the sound was not.
    import subprocess
    import sys as _s
    got = {subprocess.run(
        [_s.executable, "-c",
         "from quality.phonology import get;"
         "print(get('fin').line_alliteration('kala kukka mies meri')[2])"],
        capture_output=True, text=True, cwd=os.path.join(HERE, ".."),
        env={"PYTHONHASHSEED": str(s), "PATH": os.environ.get("PATH", "")}
    ).stdout.strip() for s in (1, 3, 7)}
    check("the winning class is the same under every hash seed",
          len(got) == 1, f"seeds 1/3/7 gave {got}")


def test_finnish_vowel_initial_class():
    print("\n5. Finnish — vowel-initial words alliterate as one class")
    f = get("fin")
    check("aivoni ~ ajattelevi (both vowel-initial, weak grade)",
          f.alliterates("aivoni", "ajattelevi") is True)
    check("strong grade needs the vowel to match too",
          f.alliterates("aivoni", "ojentaa", strong=True) is False)
    check("an unreadable word returns None, never a guess",
          f.alliterates("xyzzy123", "kukka") is None)


def test_somali_syllable_shape():
    print("\n6. Somali — (C)V(V)(C), digraphs kept whole")
    s = get("som")
    cases = {
        "gabay": ["ga", "bay"], "maanta": ["maan", "ta"],
        "dhagax": ["dha", "gax"],      # dh is ONE consonant
        "shan": ["shan"], "khayr": ["khayr"],
        "geeddi": ["geed", "di"], "buur": ["buur"], "caano": ["caa", "no"],
    }
    for w, want in cases.items():
        got = [x.text for x in s.syllabify(w)]
        check(f"{w} -> {'.'.join(want)}", got == want,
              "" if got == want else f"got {'.'.join(got)}")
    check("a long vowel carries two moras",
          [x.moras for x in s.syllabify("maanta")] == [2, 1])


def test_somali_refuses_a_stress_grid():
    print("\n7. Somali — pitch accent, so no stress pattern is invented")
    s = get("som")
    check("grid_unit is the mora, declared", s.grid_unit == "mora")
    check("prominence is left None rather than faked",
          all(x.prominence is None for x in s.syllabify("gabay")))
    try:
        s.prominences("gabay")
        check("asking for stress raises", False, "it returned a pattern")
    except Unsupported as e:
        check("asking for stress raises", True, str(e)[:78])


def test_somali_higaad_is_global():
    print("\n8. Somali — higaad is one consonant across the WHOLE poem")
    s = get("som")
    poem = ["Geeddiga gudaha", "gabaygu waa gogol",
            "guuxa iyo gorgor", "gacal baa i gaadhay"]
    cons, share, _per = s.higaad(poem)
    check("the fixed alliterating consonant is recovered", cons == "g",
          f"consonant {cons!r} on {share:.0%} of lines")
    check("it holds across every line", share == 1.0, f"{share:.0%}")
    mixed = ["Geeddiga gudaha", "waqtiga waa dheer",
             "libaax baa socda", "nin baa yimid"]
    _c, share2, _p = s.higaad(mixed)
    check("a poem without a global constraint scores low", share2 < 0.6,
          f"{share2:.0%} — the gabay constraint is global, so the measure is "
          f"the share of LINES carrying it, and a real gabay approaches 1.0")


def test_middle_chinese_is_a_lookup_not_a_guess():
    print("\n9. Middle Chinese — a table, and unknowns stay unknown")
    l = get("ltc")
    known, total = l.coverage("白日依山盡黃河入海流欲窮千里目更上一層樓")
    check("the table reads all of 登鸛雀樓", known == total == 20,
          f"{known}/{total}")
    check("an unlisted character returns None, not a Mandarin fallback",
          l.rhyme_keys("🙂") is None and l.tone_class("🙂") is None,
          "modern Mandarin is a different language for rhyme purposes")
    check("tone class is the 平/仄 binary the form constrains",
          l.tone_class("流") == 1 and l.tone_class("目") == 0,
          "流 is 平 (level), 目 is 入 (entering, therefore 仄)")


def test_regulated_verse_rhymes():
    print("\n10. Middle Chinese — the TRADITION test: canonical verse rhymes")
    l = get("ltc")
    # The rime dictionary distinguishes 193 rhymes, finer than any poet used.
    # Without the 同用 grouping these canonical pairs come out as NOT rhyming.
    poems = {
        "登鸛雀樓 (王之渙)": ["流", "樓"],
        "春望 (杜甫)": ["深", "心"],
        "靜夜思 (李白)": ["光", "霜", "鄉"],
    }
    for name, rw in poems.items():
        ok = all(l.rhymes(rw[0], w) for w in rw[1:])
        check(f"{name} {'/'.join(rw)}", ok)
    check("流/樓 do NOT match on the raw rime class",
          l.rhymes("流", "樓", grouped=False) is False,
          "尤 vs 侯 — this is why the 同用 grouping is load-bearing, not a "
          "convenience")
    check("unrelated rhymes stay unrelated", l.rhymes("流", "山") is False)


def test_welsh_digraphs_are_single_consonants():
    print("\n10b. Welsh — the eight digraphs, which ARE the whole problem")
    from quality.phonology.cym import units
    c = get("cym")
    cases = {"llyfr": ["ll", "y", "f", "r"],
             "mynydd": ["m", "y", "n", "y", "dd"],
             "bachgen": ["b", "a", "ch", "g", "e", "n"],
             "llong": ["ll", "o", "ng"],
             "rhywbeth": ["rh", "y", "w", "b", "e", "th"]}
    for w, want in cases.items():
        check(f"{w} -> {'+'.join(want)}", units(w) == want,
              "" if units(w) == want else f"got {units(w)}")
    check("a digraph never splits into its letters",
          all(len([u for u in units(w) if u == "l"]) == 0
              for w in ("llyfr", "llong")),
          "split ll into two /l/ and every consonant skeleton in the "
          "language is wrong -- and still looks plausible")
    check("penultimate stress, monosyllables stressed",
          [x.prominence for x in c.syllabify("mynydd")] == [1, 0]
          and [x.prominence for x in c.syllabify("llyfr")] == [1])


def test_welsh_cynghanedd():
    print("\n10c. Welsh — cynghanedd on Welsh phonology, not English")
    c = get("cym")
    check("the skeleton keeps th as one consonant",
          c.skeleton("tan a thi", "acen") == ["t", "n", "th"],
          str(c.skeleton("tan a thi", "acen")))
    # The caesura is marked with `|`. It used to be marked with a comma, and
    # these fixtures passed for a reason that turned out to be a defect: the
    # checker split on `[,/|]`, so ordinary PUNCTUATION was being read as
    # metrical structure. On a real corpus that decided which rule each line
    # was tested against -- two commas forced a line down the three-part `sain`
    # path, where it could not be read as croes at all. The rule under test
    # here is unchanged; only the way the fixture states its caesura is.
    t, d = c.cynghanedd("tan a thi | tywyn a thau")
    check("croes: the skeleton answered exactly", t == "croes", d)
    t, d = c.cynghanedd("dwr dyn | dwr dawn")
    check("croes on a second constructed line", t == "croes", d)
    t, d = c.cynghanedd("tan a thi, tywyn a thau")
    check("a COMMA is not a caesura",
          t is None and "no caesura is printed" in d,
          "punctuation is not metre; the position of the caesura is either "
          "printed or it is not in the text")
    t, d = c.cynghanedd("tan a thi--tywyn a thau")
    check("the gwant `--` IS a caesura, and so are the dashes it is set with",
          t == "croes", d)
    for dash in ("—", "–"):
        t, _d = c.cynghanedd(f"tan a thi{dash}tywyn a thau")
        check(f"the gwant set as {dash!r} reads the same", t == "croes")
    # `dan` is the PREPOSITION and therefore a proclitic, so a half-line
    # ending in it has its last stress on the FIRST word. Keying the skeleton
    # only on the last word ran past the end and swept in the final coda.
    check("a half-line ending in a proclitic stops at the real last stress",
          c.skeleton("dwr dan", "acen") == ["d"],
          str(c.skeleton("dwr dan", "acen")))
    check("a digraph onset survives into the skeleton",
          c.skeleton("llais llon", "acen")[:1] == ["ll"],
          str(c.skeleton("llais llon", "acen")))
    # Doctrine 41 in reverse: a NEGATIVE control can pass for the wrong reason
    # too. With the comma no longer a caesura this line would be refused for
    # having no caesura at all, which proves nothing about the rule -- so the
    # caesura is supplied, and it must STILL not be croes.
    t, d = c.cynghanedd("Calon lân | yn llawn daioni")
    check("a hymn line that is NOT strict metre is not croes, WITH a caesura "
          "supplied so the refusal is about the sound and not the punctuation",
          t is None and "not answered by" in d, d)
    hit = c.cynghanedd_scan("Calon lân yn llawn daioni")
    check("and it is not croes at ANY caesura placement either",
          hit["type"] != "croes",
          f"{hit['positions_tried']} placements tried, best "
          f"{hit['type']!r} -- a negative control has to survive the search, "
          f"not just the one placement we happened to choose")
    t, d = c.cynghanedd("mae hi | mae ho | mor hy")
    check("sain requires rhyme AND alliteration, not either",
          t is None and "needs rhyme AND alliteration" in d, d)
    # Welsh elides constantly and the apostrophe is INSIDE the word. Before
    # this, `units("a'i")` was None while `units("ai")` was ['a','i'], so one
    # apostrophe made the whole line unreadable before any rule ran -- 31% of
    # a real corpus. It is an elision mark and it JOINS, which is the opposite
    # of the same glyph in fin.py, where it marks hiatus and splits.
    for elided in ("a'i", "i'r", "sy'n", "mae'r", "o'r"):
        check(f"the elision {elided!r} is readable",
              cym.units(elided) is not None, str(cym.units(elided)))
    check("a curly apostrophe reads identically to a straight one",
          cym.units("mae’r") == cym.units("mae'r"), str(cym.units("mae’r")))
    check("an internal hyphen joins rather than refusing",
          cym.units("di-baid") == cym.units("dibaid"))
    check("an acute-accented vowel does not fragment the token",
          [w for w in cym.WORD_RE.findall("Calon lân") ] == ["Calon", "lân"],
          "the old hand-written class omitted the accented vowels that "
          "VOWELS already contained, so the word split in two")
    # The searched rate and the marked rate are different experiments.
    hit = c.cynghanedd_scan("tan a thi tywyn a thau")
    check("a search reports how many placements it tried",
          hit["positions_tried"] > 1, str(hit["positions_tried"]))
    check("and an undeclared caesura mode raises rather than defaulting",
          _raises(lambda: c.cynghanedd("tan a thi", caesura="best")))
    # These lines are CONSTRUCTED to satisfy the rule, so they test the
    # IMPLEMENTATION against the rule -- not the rule against canon. Canon
    # needs a sourced Welsh strict-metre text, which is blocked; see
    # data/sources.tsv.
    check("constructed tests are labelled as testing the implementation",
          True, "canon requires a sourced corpus, which is blocked")


#: ATTESTED. Lines of the two staged Welsh corpora (corpus/cym_alun_strict.txt,
#: corpus/cym_twm_or_nant_cywydd.txt), which are strict metre end to end -- so
#: every line carries cynghanedd by construction and a line the checker cannot
#: read is the CHECKER's failure. Each of these was found by the class rule and
#: by nothing the acennog-for-everything rule could do at any placement.
ATTESTED = [
    # line, corpus, expected type, expected class, the halves it falls into
    ("Draw'n sisial deyrn y Saeson,--", "Alun", "croes", "cytbwys ddiacen",
     ("Draw'n sisial", "deyrn y Saeson")),
    ("Trwy Gwalia, tir y gelyn;", "Alun", "croes", "cytbwys ddiacen",
     ("Trwy Gwalia", "tir y gelyn")),
    ("O flaen gorsedd felenwawr", "Alun", "traws", "anghytbwys ddisgynedig",
     ("O flaen", "gorsedd felenwawr")),
    ("A luniodd pob galanas;", "Twm o'r Nant", "traws", "cytbwys ddiacen",
     ("A luniodd", "pob galanas")),
]


def test_welsh_accentuation_classes():
    print("\n10f. Welsh — the accentuation class decides where the span stops")
    c = get("cym")
    # The DIWEDDEB is a property of the HALF-LINE, not of its last word.
    check("an end on the accent is acennog",                     # CONSTRUCTED
          c.diwedd("tywyn a thau")[0] == "acennog")
    check("an end one syllable past the accent is diacen",       # CONSTRUCTED
          c.diwedd("cerdda'n llonydd")[0] == "diacen")
    check("a half ending in a PROCLITIC is diacen, not acennog", # CONSTRUCTED
          c.diwedd("dwr dan")[0] == "diacen",
          "the accent is on `dwr` and `dan` is the preposition, so the end "
          "is unaccented -- doctrine 46's edge case turns out to have a CLASS")
    # `ar hyd` is the third and fourth words of the first line of the Alun
    # corpus. Both are prepositions, so the fragment has no accent at all.
    check("a half of nothing but proclitics is refused, not read",  # ATTESTED
          c.diwedd("ar hyd") == (None, "no accented syllable in this half, "
                                       "so it has no diweddeb"),
          str(c.diwedd("ar hyd")))
    check("an accent further back than the penult is refused",   # ATTESTED
          c.diwedd("Geiriau yr")[0] is None
          and "2 syllables from the end" in c.diwedd("Geiriau yr")[1],
          c.diwedd("Geiriau yr")[1])
    # The three spans are three different objects, and on an unaccented end
    # they differ. `skeleton` has NO default extent for exactly this reason.
    check("the three extents differ on an unaccented end",       # CONSTRUCTED
          (c.skeleton("dwr dan", "acen"),
           c.skeleton("dwr dan", "llafariad"),
           c.skeleton("dwr dan", "llawn"))
          == (["d"], ["d", "r", "d"], ["d", "r", "d", "n"]),
          str([c.skeleton("dwr dan", x) for x in c.EXTENTS]))
    check("and coincide on an accented one, which is why the old rule was "
          "right THERE and only there",                          # CONSTRUCTED
          c.skeleton("tan a thi", "acen")
          == c.skeleton("tan a thi", "llafariad"))
    check("an extent must be declared, never defaulted",
          _raises(lambda: c.skeleton("tan a thi")),
          "no argument is the same thing as defaulting to the acennog span, "
          "which is the defect")
    check("and an undeclared extent raises rather than guessing",
          _raises(lambda: c.skeleton("tan a thi", "hyd yr acen")))

    for line, src, want_type, want_class, (a, b) in ATTESTED:
        ans = c.answer(a, b)
        check(f"[{src}, ATTESTED] {line[:34]:<34} is {want_class}",
              ans["class"] == want_class, str(ans["class"]))
        hit = c.cynghanedd_scan(line)
        check(f"[{src}, ATTESTED] ... and reads as {want_type}",
              hit["type"] == want_type and hit["class"] == want_class,
              hit["detail"][:96])
        # The load-bearing half of the regression: the acennog span, applied
        # where the class does not license it, does not answer.
        sa = c.skeleton(a, "acen")
        sb = c.skeleton(b, "acen")
        answered = sa == sb or (len(sb) > len(sa) and sb[-len(sa):] == sa)
        check(f"[{src}, ATTESTED] ... and the acennog span does NOT answer it",
              not answered, f"acen: {sa} | {sb}")

    # ATTESTED from the literature rather than from the staged corpus: this
    # line of Dafydd ap Gwilym is the one quoted for the ddisgynedig rule,
    # that the consonant after the accent is answered by the one opening the
    # last syllable of the other half -- haul's `l` by heli's.
    ans = c.answer("Darn fal haul", "dyrnfol heli")
    check("[Dafydd ap Gwilym, ATTESTED] Darn fal haul | dyrnfol heli",
          ans["class"] == "anghytbwys ddisgynedig"
          and ans["first"] == ans["second"] == ["d", "r", "n", "f", "l",
                                                "h", "l"],
          f"{ans['class']}: {ans['first']} | {ans['second']}")
    check("... and the acennog span drops the very consonant the class "
          "exists to answer",
          c.skeleton("Darn fal haul", "acen") == ["d", "r", "n", "f", "l",
                                                  "h"],
          "it still comes out croes here, one consonant short -- a looser "
          "rule agreeing with a stricter one is not evidence that it is right")

    # anghytbwys ddyrchafedig: an unaccented end answered by an accented one.
    # The tradition works three classes, and this placement is refused.
    ans = c.answer("A'i gorn teg i", "gern y twr")               # ATTESTED
    check("[Alun, ATTESTED] a ddyrchafedig placement is refused, not scored",
          ans["class"] == "anghytbwys ddyrchafedig"
          and ans["first"] is None, ans["why"][:88])
    check("... and the acennog span WOULD have called it croes",
          c.skeleton("A'i gorn teg i", "acen")
          == c.skeleton("gern y twr", "acen"),
          "the seam falls either side of a consonant-free proclitic, so a "
          "real cytbwys acennog line grows a duplicate placement one word "
          "over -- which is what that class's apparent lift was made of")
    hit = c.cynghanedd_scan("A'i gorn teg i gern y twr:")
    check("... while the LINE still reads, at the placement that is legal",
          hit["type"] == "croes" and hit["class"] == "cytbwys acennog",
          hit["detail"][:96])
    check("the fourth class is reachable by name, so the choice is measurable",
          c.answer("A'i gorn teg i", "gern y twr",
                   dyrchafedig="rising")["first"] is not None)
    check("and an undeclared dyrchafedig value raises",
          _raises(lambda: c.answer("dwr dyn", "dwr dawn",
                                   dyrchafedig="allow")))

    # A half with no diweddeb is refused rather than read as accented. Under
    # the old rule this placement was a croes on a two-consonant skeleton.
    ans = c.answer("Geiriau yr", "euog Iorwerth")                # ATTESTED
    check("[Alun, ATTESTED] a half with no diweddeb refuses the whole "
          "placement", ans["class"] is None and ans["first"] is None,
          ans["why"][:88])
    check("... and the acennog span WOULD have called that croes too",
          c.skeleton("Geiriau yr", "acen") == c.skeleton("euog Iorwerth",
                                                         "acen")
          == ["g", "r"],
          "refusing where the class cannot be determined is the fix; "
          "defaulting to acennog is the defect")


def test_check_cynghanedd_defaults_to_welsh():
    print("\n10d. the harness's own checker now reads Welsh")
    import lyric_harness as lh
    lex = lh.Lexicon()
    decl = lh.Declaration()
    res = lh.check_cynghanedd(lex, "tan a thi | tywyn a thau", decl)
    check("it defaults to Welsh, because that is what cynghanedd is",
          res["language"] == "cym", res["phonology"])
    check("and finds croes on Welsh units",
          [k for k, _w in res["found"]] == ["croes"], str(res["found"])[:80])
    check("the th digraph survived into the skeleton",
          "'th'" in str(res["found"]),
          "an English reading would have split it into t + h")
    eng = lh.check_cynghanedd(lex, "clear day, cold dew", decl,
                              language="eng")
    check("English is still reachable, but by name",
          eng["language"] == "eng" and eng["found"])
    check("and it labels itself an imitation",
          "IMITATION" in eng["phonology"], eng["phonology"][:70])
    try:
        lh.check_cynghanedd(lex, "x, y", decl, language="fra")
        check("an undeclared language raises", False, "it returned a result")
    except ValueError as e:
        check("an undeclared language raises rather than defaulting", True,
              str(e)[:76])


def test_welsh_proclitics_are_unstressed():
    print("\n10e. Welsh — proclitics cannot answer a cynghanedd")
    c = get("cym")
    check("the article y is unstressed",
          [x.prominence for x in c.syllabify("y")] == [0])
    check("a monosyllabic content word is stressed",
          [x.prominence for x in c.syllabify("dyn")] == [1])
    # Without the proclitic list, penultimate stress makes EVERY monosyllable
    # stressed, and llusg "finds" the final word's penult rhyming the article.
    ok, why = c.llusg("y ddraig goch ddyry cychwyn")
    check("llusg answers on a content word, not on the article",
          ok and "'y'" not in why, why)


def test_every_module_declares_itself():
    print("\n11. every phonology declares what it reads and what it is")
    # Not a fixed count. A hardcoded set fails the moment a language is added,
    # which trains whoever adds one to edit the assertion rather than read it
    # -- and the assertion that matters is not HOW MANY are registered but that
    # each is registered under its own declared name. A module registered under
    # a copy-pasted key is reachable as the wrong language, which is the exact
    # failure this whole layer exists to prevent.
    check("the four originally unblocked languages are still registered",
          {"fin", "som", "ltc", "cym"} <= set(declared()), str(declared()))
    for lang in declared():
        check(f"{lang} is registered under the name it declares",
              get(lang).language == lang,
              f"registry key {lang!r} vs declared {get(lang).language!r}")
    for lang in declared():
        d = get(lang).declaration()
        for k in ("notation", "grid_unit", "prominence_rule", "relation",
                  "source"):
            check(f"{lang} declares {k}", bool(d.get(k)) and d[k] != "unset",
                  f"{k}: {str(d.get(k))[:70]}" if k == "grid_unit" else "")


def test_no_module_consults_english():
    print("\n12. nothing here falls back to English")
    import ast
    import importlib
    import inspect

    # Iterate the REGISTRY, not a hand-written list. The list version had four
    # names in it and a fifth module was added without being checked -- the
    # test would have kept passing while the thing it exists to prevent walked
    # in beside it. Anything reachable through get() is tested here by
    # construction.
    mods_under_test = [importlib.import_module(f"quality.phonology.{lang}")
                       for lang in declared()]
    check("every REGISTERED module is checked, not a hardcoded list",
          {m.__name__.rsplit(".", 1)[-1] for m in mods_under_test}
          == set(declared()), str(declared()))
    # Parse the IMPORTS rather than grepping the source: cym.py's docstring
    # explains the CMUdict problem at length, and a substring test flagged the
    # explanation as the offence.
    for mod in mods_under_test:
        tree = ast.parse(inspect.getsource(mod))
        mods = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                mods.update(a.name.split(".")[0] for a in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                mods.add(node.module.split(".")[0])
        # AMENDED 2026-08-10. This rule is about the EIGHT non-English cells
        # not silently falling back to CMUdict when their own rules run out --
        # the monoculture error the module was built to prevent. `eng` is the
        # ninth cell (MISSING F-1, now closed) and consulting CMUdict is its
        # entire job; exempting it by name keeps the rule sharp for the eight
        # it was written for, rather than deleting it.
        if mod.__name__.endswith(".eng"):
            check("eng DOES import the English resource, by declaration",
                  "lyric_harness" in mods,
                  "an explicitly declared eng is the opposite of a DEFAULT to "
                  "English: get('cym') cannot reach it (doctrine: registry)")
            continue
        check(f"{mod.__name__} imports no English resource",
              "lyric_harness" not in mods and "cmudict" not in mods,
              f"imports: {sorted(mods)}")


if __name__ == "__main__":
    for fn in (test_finnish_syllabification,
               test_finnish_hiatus_is_not_a_diphthong,
               test_finnish_stress_is_free,
               test_kalevala_lines_alliterate,
               test_finnish_marks_inside_words,
               test_finnish_vowel_initial_class,
               test_somali_syllable_shape,
               test_somali_refuses_a_stress_grid,
               test_somali_higaad_is_global,
               test_middle_chinese_is_a_lookup_not_a_guess,
               test_regulated_verse_rhymes,
               test_welsh_digraphs_are_single_consonants,
               test_welsh_cynghanedd,
               test_welsh_accentuation_classes,
               test_welsh_proclitics_are_unstressed,
               test_check_cynghanedd_defaults_to_welsh,
               test_every_module_declares_itself,
               test_no_module_consults_english):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all phonology regressions pass")

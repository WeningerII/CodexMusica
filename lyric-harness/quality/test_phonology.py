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


def test_every_module_declares_itself():
    print("\n11. every phonology declares what it reads and what it is")
    check("three languages are registered",
          set(declared()) == {"fin", "som", "ltc"}, str(declared()))
    for lang in declared():
        d = get(lang).declaration()
        for k in ("notation", "grid_unit", "prominence_rule", "relation",
                  "source"):
            check(f"{lang} declares {k}", bool(d.get(k)) and d[k] != "unset",
                  f"{k}: {str(d.get(k))[:70]}" if k == "grid_unit" else "")


def test_no_module_consults_english():
    print("\n12. nothing here falls back to English")
    import quality.phonology.fin as fin
    import quality.phonology.ltc as ltc
    import quality.phonology.som as som
    import inspect
    for mod in (fin, som, ltc):
        src = inspect.getsource(mod)
        check(f"{mod.__name__} does not import the CMUdict lexicon",
              "cmudict" not in src.lower() and "from lyric_harness" not in src,
              "doctrine: no defaulting to English")


if __name__ == "__main__":
    for fn in (test_finnish_syllabification,
               test_finnish_hiatus_is_not_a_diphthong,
               test_finnish_stress_is_free,
               test_kalevala_lines_alliterate,
               test_finnish_vowel_initial_class,
               test_somali_syllable_shape,
               test_somali_refuses_a_stress_grid,
               test_somali_higaad_is_global,
               test_middle_chinese_is_a_lookup_not_a_guess,
               test_regulated_verse_rhymes,
               test_every_module_declares_itself,
               test_no_module_consults_english):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all phonology regressions pass")

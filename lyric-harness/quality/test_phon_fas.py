#!/usr/bin/env python3
"""Regressions for the Persian phonology (quality/phonology/fas.py).

Standalone, in the style of quality/test_phonology.py. Imports the module
directly rather than through the registry, because the orchestrator has not
wired `fas` into quality/phonology/__init__.py yet.

The load-bearing tests here are the REFUSALS and the NORMALISATION, not the
positive answers:

  * Persian is written in a script with several near-identical codepoints, so
    a fold that is missing makes a word compare unequal to itself. Every fold
    is asserted on a word that actually occurs in Hafez.
  * The short vowels are not written, so a module that answers True or False
    about them is lying. The test that proves this module is not lying is the
    one where دل /del/ and گل /gol/ — identical rhyme skeletons, different
    vowels — come back None.

Text: kavehbc/hafez (MIT compilation; Hafez d. 1390, so the text layer is six
centuries out of any term). Declared in data/sources.tsv. Lines are embedded
rather than read from disk so the test is hermetic.

Run: python3 quality/test_phon_fas.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.phonology import Unsupported  # noqa: E402
from quality.phonology import fas  # noqa: E402

P = fas.PERSIAN
FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# The rhyming hemistichs of three real ghazals — both halves of the maṭlaʿ,
# then the second half of every bayt. Known answers, not demonstrations: each
# of these ghazals has a radif that Persian criticism names.
GHAZAL_1 = [                                   # radif ها, qāfiya -el
    "الا یا ایها الساقی ادر کاسا و ناولها",
    "که عشق آسان نمود اول ولی افتاد مشکل ها",
    "ز تاب جعد مشکینش چه خون افتاد در دل ها",
    "جرس فریاد می دارد که بربندید محمل ها",
    "که سالک بی خبر نبود ز راه و رسم منزل ها",
    "کجا دانند حال ما سبکباران ساحل ها",
    "نهان کی ماند آن رازی کز او سازند محفل ها",
    "متی ما تلق من تهوی دع الدنیا و اهملها",
]
GHAZAL_2 = [                                   # radif کجا, qāfiya -āb
    "صلاح کار کجا و من خراب کجا",
    "ببین تفاوت ره کز کجاست تا به کجا",
    "کجاست دیر مغان و شراب ناب کجا",
    "سماع وعظ کجا نغمه رباب کجا",
    "چراغ مرده کجا شمع آفتاب کجا",
    "کجا رویم بفرما از این جناب کجا",
    "کجا همی روی ای دل بدین شتاب کجا",
    "خود آن کرشمه کجا رفت و آن عتاب کجا",
    "قرار چیست صبوری کدام و خواب کجا",
]
GHAZAL_422 = [                                 # radif آمده ای, qāfiya -āz
    "ای که با سلسله زلف دراز آمده ای",
    "فرصتت باد که دیوانه نواز آمده ای",
    "چون به پرسیدن ارباب نیاز آمده ای",
    "چون به هر حال برازنده ناز آمده ای",
    "چشم بد دور که بس شعبده بازآمده ای",
    "کشته غمزه خود را به نماز آمده ای",
    "مست و آشفته به خلوتگه راز آمده ای",
    "مگر از مذهب این طایفه بازآمده ای",
]


def test_yeh_and_kaf_fold():
    print("\n1. normalise — the codepoints that break equality while looking "
          "identical")
    # ساقی occurs 108 times in the corpus, always with FARSI YEH U+06CC. The
    # same word typed with ARABIC YEH U+064A is a different string and renders
    # the same. This is the U+2019 defect (doctrine 26) in another script.
    farsi_yeh = "ساقی"          # ...U+06CC
    arabic_yeh = "ساقي"         # ...U+064A
    check("the two spellings really are different strings",
          farsi_yeh != arabic_yeh,
          f"U+{ord(farsi_yeh[-1]):04X} vs U+{ord(arabic_yeh[-1]):04X}")
    check("ARABIC YEH U+064A folds onto FARSI YEH U+06CC",
          fas.normalise(farsi_yeh) == fas.normalise(arabic_yeh)
          and ord(fas.normalise(arabic_yeh)[-1]) == 0x06CC)
    # کجا is the radif of ghazal 2, 58 tokens, always with KEHEH U+06A9.
    keheh, arabic_kaf = "کجا", "كجا"
    check("the two spellings really are different strings",
          keheh != arabic_kaf,
          f"U+{ord(keheh[0]):04X} vs U+{ord(arabic_kaf[0]):04X}")
    check("ARABIC KAF U+0643 folds onto KEHEH U+06A9",
          fas.normalise(keheh) == fas.normalise(arabic_kaf)
          and ord(fas.normalise(arabic_kaf)[0]) == 0x06A9)
    check("ALEF MAKSURA U+0649 folds onto FARSI YEH too",
          fas.normalise("علی") == fas.normalise("على"))
    check("and the fold reaches the radif: a ghazal typed with ARABIC YEH "
          "still yields the same radif",
          fas.radif([l.replace("ی", "ي") for l in GHAZAL_422])
          == fas.radif(GHAZAL_422) == "آمده ای",
          "without the fold the two spellings share no trailing token at all")


def test_zwnj_and_the_joined_twin():
    print("\n2. normalise — ZWNJ U+200C, and the twin it does NOT merge with")
    zwnj = "مشکل‌ها"        # the standard modern spelling
    spaced = "مشکل ها"           # how the Hafez corpus actually writes it
    joined = "مشکلها"            # how the same corpus writes it elsewhere
    check("the ZWNJ form and its space-written twin normalise together",
          fas.normalise(zwnj) == fas.normalise(spaced) == "مشکل ها",
          f"{fas.normalise(zwnj)!r}")
    check("ZWNJ survives nowhere in the output",
          "‌" not in fas.normalise(zwnj))
    # This is the cost of the choice, asserted rather than hidden: mapping ZWNJ
    # to a space aligns it with the corpus (which writes می دارد, مشکل ها with
    # real spaces and never uses ZWNJ) but cannot also merge the JOINED
    # spelling, which the same corpus uses in the same ghazal.
    check("the JOINED spelling stays a different token, and that is the "
          "declared cost of the choice",
          fas.normalise(joined) != fas.normalise(spaced),
          "ghazal 1 writes ناولها joined and مشکل ها spaced — 2 of its 8 "
          "rhyming lines are therefore invisible to a token-level radif")
    check("NBSP and the other Unicode spaces fold to U+0020 as well",
          fas.normalise("مشکل ها") == "مشکل ها")


def test_diacritics_and_presentation_forms():
    print("\n3. normalise — ḥarakāt, tatwīl, presentation forms, dagger alef")
    check("a vocalised word equals its unvocalised self",
          fas.normalise("مُشکِل") == fas.normalise("مشکل") == "مشکل")
    check("shadda is removed too — declared, and it costs gemination",
          fas.normalise("مُعَلِّم") == fas.normalise("معلم"),
          "gemination is phonemic in Persian and changes syllable weight; "
          "this corpus carries zero ḥarakāt so nothing is lost HERE")
    check("tatwīl / kashida is not a letter",
          fas.normalise("کــجــا") == "کجا")
    # U+FEDA KAF FINAL FORM + U+FEAE REH FINAL FORM. NFKC gives ARABIC KAF
    # U+0643, which the letter fold then carries on to KEHEH U+06A9 — two
    # stages, and only the pair of them reaches the Persian spelling.
    check("NFKC folds the Arabic Presentation Forms back to base letters",
          fas.normalise("ﻚﺮ") == fas.normalise("کر") == "کر",
          "isolated/final shapes leak out of PDF and OCR")
    # The dagger alef is a LONG ā carried by no base letter. Deleting it with
    # the ḥarakāt would destroy a long vowel, which is the one thing this
    # module is normally certain about, so it is FOLDED instead.
    check("dagger alef U+0670 folds to ا rather than being deleted",
          fas.normalise("اللٰه") == "اللاه",
          f"{fas.normalise(chr(0x0670))!r}")
    check("punctuation cannot split a radif",
          fas.tokens("خواب کجا،") == ["خواب", "کجا"])


def test_inventory_covers_hafez():
    print("\n4. the declared inventory, and the Arabic letters that stay in it")
    used = set()
    for ln in GHAZAL_1 + GHAZAL_2 + GHAZAL_422:
        used.update(c for c in fas.normalise(ln) if c != " ")
    check("every letter of three real ghazals is in the declared inventory",
          used <= fas.INVENTORY, f"{len(used)} letters used, "
          f"outside: {sorted(used - fas.INVENTORY)}")
    # ث ذ ض ظ are Arabic-only in origin and are attested 153 / 306 / 272 / 757
    # times in Hafez. Refusing them would refuse Hafez, so they are IN, and the
    # consequence is declared: this module refuses on SCRIPT, not on language.
    for c in "ثذضظ":
        check(f"{c} is in the inventory (Arabic loan grapheme, native "
              f"pronunciation)", c in fas.INVENTORY)
    check("وعظ, a real Hafez word carrying ظ, reads",
          fas.tails("وعظ") is not None, str(fas.tails("وعظ")))


def test_syllables_mark_the_unknown():
    print("\n5. syllables — unwritten nuclei are marked, weight is not faked")
    s = P.syllabify("کجا")
    check("کجا has one unique parse, two syllables",
          [x.text for x in s] == ["ک?", "جā"], str([x.text for x in s]))
    check("the first nucleus is marked UNKNOWN, not guessed",
          s[0].nucleus is None and s[1].nucleus == "ā",
          "the short vowel of کـ is not on the page")
    # The asymmetry that makes moras usable where nucleus identity is not: the
    # ABSENCE of a māter is itself evidence the vowel is short.
    check("weight is still recoverable: light CV=1, heavy CVV=2",
          [x.moras for x in s] == [1, 2])
    d = P.syllabify("دل")
    check("دل is CVC, heavy, nucleus unknown",
          len(d) == 1 and d[0].nucleus is None and d[0].moras == 2
          and d[0].coda == ("ل",))
    check("نامه ends on the one short vowel Persian writes",
          "e" in {x.nucleus for p in fas.parses("نامه") for x in p[-1:]},
          str(fas.tails("نامه")))


def test_indeterminate_splits_are_refused_not_invented():
    print("\n6. syllables — an indeterminate split says so instead of "
          "inventing one")
    check("مشکل has more than one legal parse",
          len(fas.parses("مشکل")) > 1, fas.indeterminacy("مشکل"))
    check("so syllabify() returns nothing rather than picking one",
          P.syllabify("مشکل") == [])
    check("and the return SAYS which kind of refusal it is",
          "syllable count is not recoverable"
          in fas.indeterminacy("مشکل"), fas.indeterminacy("مشکل"))
    check("a unique parse is still delivered",
          fas.indeterminacy("کجا") == "unique parse"
          and len(P.syllabify("کجا")) == 2)
    check("out of inventory is a DIFFERENT refusal and says so",
          "out of inventory" in fas.indeterminacy("hafez"),
          fas.indeterminacy("hafez"))


def test_stress_grid_is_refused():
    print("\n7. prominence — refused, because ʿarūż is quantitative")
    check("grid_unit is the mora, declared", P.grid_unit == "mora")
    check("prominence is left None rather than faked",
          all(x.prominence is None for x in P.syllabify("کجا")))
    try:
        P.prominences("کجا")
        check("asking for stress raises", False, "it returned a pattern")
    except Unsupported as e:
        check("asking for stress raises", True, str(e)[:78])
    check("the refusal names BOTH reasons",
          "quantitative" in P.prominence_rule.lower()
          and "syllable count" in P.prominence_rule.lower(),
          "word-final stress is real but is not the grid the form uses, AND "
          "the grid has no known length to index")


def test_rhyme_is_tri_state():
    print("\n8. rhymes — True / False / None, and None is the frequent answer")
    check("کار / یار — both {ā} before the same rawī: a confident True",
          P.rhymes("کار", "یار") is True)
    check("کار / بهار likewise", P.rhymes("کار", "بهار") is True)
    check("کجا / صبا — bare long ā", P.rhymes("کجا", "صبا") is True)
    check("کار / در — {ā} against {a,e,o}, disjoint: a confident False",
          P.rhymes("کار", "در") is False)
    check("دل / کار — the same, the other way round",
          P.rhymes("دل", "کار") is False)


def test_the_unrecoverable_short_vowel():
    print("\n9. rhymes — THE test: matching skeletons, differing short vowels")
    # دل /del/ and گل /gol/. Both occur in the corpus (562 and 200 tokens).
    # Their rhyme skeletons are IDENTICAL — an unwritten vowel and the rawī ل
    # — and they do not rhyme. Nothing on the page says so.
    ta, tb = fas.tails("دل"), fas.tails("گل")
    check("their rhyme tails are literally identical",
          ta == tb == {(None, ("ل",))}, f"{ta} / {tb}")
    check("and rhymes() returns None — not True",
          P.rhymes("دل", "گل") is None,
          "/del/ against /gol/: a module that answered True here would report "
          "a corpus-wide qāfiya agreement that is an artefact of its own guess")
    # The trap named in the module docstring, asserted so it cannot rot.
    a, b = P.syllabify("دل")[-1], P.syllabify("گل")[-1]
    check("Syllable.key() WOULD call them equal — which is why rhymes() does "
          "not use it", a.key() == b.key(), f"key() = {a.key()}")
    check("مشکل / دل — an indeterminate split also propagates as None",
          P.rhymes("مشکل", "دل") is None)
    check("پرور is /parvar/ and not /parur/, so دلبر / هنرپرور is None and "
          "not False", P.rhymes("دلبر", "هنرپرور") is None,
          "reading C-و-C as a vowel was a guess, and the guess returned False "
          "on one of Hafez's own rhymes")
    check("کله / سیه likewise — final ه is /e/ or /h/ and the page does not "
          "say", P.rhymes("کله", "سیه") is None)


def test_alliteration_is_consonantal():
    print("\n10. alliterates — tri-state, and decidable because onsets are "
          "written")
    check("کجا / کار share an onset", P.alliterates("کجا", "کار") is True)
    check("دل / کار do not", P.alliterates("دل", "کار") is False)
    check("word-initial ا آ ع are one glottal class, declared",
          P.alliterates("الا", "آسان") is True
          and P.alliterates("عشق", "آسان") is True)
    check("out of inventory returns None, never a guess",
          P.alliterates("hafez", "کار") is None)


def test_radif_on_real_ghazals():
    print("\n11. radif — the TRADITION test, on ghazals with known radifs")
    d2 = fas.radif_detail(GHAZAL_2)
    check("ghazal 2: radif کجا on every rhyming line",
          d2["radif"] == "کجا" and d2["fraction"] == 1.0,
          f"{d2['count']}/{d2['lines']}")
    d422 = fas.radif_detail(GHAZAL_422)
    check("ghazal 422: a TWO-token radif آمده ای",
          d422["radif"] == "آمده ای", f"{d422!r}")
    check("its two missing lines are the ones that write بازآمده joined",
          d422["count"] == 6 and d422["lines"] == 8,
          "the radif is present in the sound and joined in the spelling")
    d1 = fas.radif_detail(GHAZAL_1)
    check("ghazal 1: radif ها on 6 of 8, the other 2 written joined",
          d1["radif"] == "ها" and d1["count"] == 6, f"{d1!r}")
    rad, qs = P.qafiya(GHAZAL_2)
    check("the qāfiya is the token before the radif",
          [q for q in qs if q][:3] == ["خراب", "به", "ناب"], str(qs))
    check("a line that does not carry the radif gets None, not a token from "
          "the wrong position",
          None not in P.qafiya(GHAZAL_2)[1] and None in P.qafiya(GHAZAL_1)[1])


def test_radif_needs_recurrence_not_a_shared_tail():
    print("\n12. radif — a shared tail ONCE is not a refrain (doctrine 18)")
    once = ["دل من غم", "چشم تو ناز", "باده و جام", "شب و روز",
            "راه و رسم", "سرو و گل", "مهر و ماه گل", "باغ و بهار گل"]
    check("only two of eight lines share a trailing token -> None",
          fas.radif(once) is None, fas.radif_detail(once)["reason"])
    check("and it is a recurrence failure, not a script failure",
          "recurs on at least" in fas.radif_detail(once)["reason"])
    # Doctrine 18 again: one pair gives no evidence either way, so the gate
    # says so rather than deciding.
    pair = ["دل من گل", "چشم تو گل"]
    check("two lines with an identical tail still return None",
          fas.radif(pair) is None, fas.radif_detail(pair)["reason"])
    check("and the reason names it as a refusal, not a negative",
          "no evidence either way" in fas.radif_detail(pair)["reason"])
    check("the thresholds are named parameters, not literals",
          fas.radif(once, min_count=2, min_fraction=0.25) == "گل",
          "lowering the declared gate does find it — which is exactly why the "
          "gate has to be declared")
    check("a candidate that would consume a whole line is rejected",
          fas.radif(["کجا"] * 6) is None,
          fas.radif_detail(["کجا"] * 6)["reason"])


def test_non_persian_is_refused_on_script():
    print("\n13. refusal — on SCRIPT, and the declared limit of that")
    latin = ["Hafez of Shiraz sang", "the wine and rose among",
             "a nightingale unsung", "and every lover stung"]
    check("Latin script: radif returns None", fas.radif(latin) is None,
          fas.radif_detail(latin)["reason"])
    check("Latin script: rhymes returns None",
          P.rhymes("sang", "rung") is None)
    check("Latin script: syllabify returns nothing",
          P.syllabify("hafez") == [] and fas.parses("hafez") is None)
    check("Cyrillic likewise", fas.tails("Гафиз") is None)
    check("a digit is not a phoneme this module can state",
          fas.tails("۱۳۹۰") is None, str(fas.normalise("۱۳۹۰")))
    # The declared limit, asserted so nobody mistakes it for an oversight:
    # Persian uses every Arabic letter, so the two languages are NOT separable
    # on the inventory. Ghazal 1 ends on a hemistich Hafez wrote in Arabic.
    arabic_line = GHAZAL_1[-1]
    check("Arabic in Arabic script is NOT refused, by declared design",
          all(fas.in_inventory(t) for t in fas.tokens(arabic_line)),
          "متی ما تلق من تهوی دع الدنیا و اهملها — a line of Hafez. A module "
          "that refused Arabic would refuse this ghazal.")
    check("the refusal itself says which axis it refuses on",
          "script, never on language"
          in fas.radif_detail(latin)["reason"]
          and "script, never on language" in fas.indeterminacy("hafez"),
          fas.indeterminacy("hafez"))


def test_module_declares_itself():
    print("\n14. the module declares what it reads and what it refuses")
    d = P.declaration()
    for k in ("language", "name", "notation", "grid_unit", "prominence_rule",
              "relation", "source"):
        check(f"declares {k}", bool(d.get(k)) and d[k] != "unset")
    check("notation states the script AND that it is unvocalised",
          "UNVOCALISED" in d["notation"] and "Perso-Arabic" in d["notation"])
    check("notation names the folds codepoint by codepoint",
          "U+06CC" in d["notation"] and "U+06A9" in d["notation"]
          and "U+200C" in d["notation"])
    check("notation says the short vowels are not supplied",
          "not supplied" in d["notation"].lower())
    check("relation names both radif and qāfiya",
          "RADIF" in d["relation"] and "QĀFIYA" in d["relation"])
    check("relation says the rhyme half is frequently not decidable",
          "not decidable" in d["relation"])
    check("language code is fas", d["language"] == "fas")


def test_no_english_resource():
    print("\n15. nothing here falls back to English")
    import ast
    import inspect
    tree = ast.parse(inspect.getsource(fas))
    mods = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            mods.update(a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            mods.add(node.module.split(".")[0])
    check("fas imports no English resource",
          "lyric_harness" not in mods and "cmudict" not in mods,
          f"imports: {sorted(mods)}")
    check("and no external data file of any kind",
          mods <= {"re", "unicodedata", "quality"}, f"imports: {sorted(mods)}")


if __name__ == "__main__":
    for fn in (test_yeh_and_kaf_fold,
               test_zwnj_and_the_joined_twin,
               test_diacritics_and_presentation_forms,
               test_inventory_covers_hafez,
               test_syllables_mark_the_unknown,
               test_indeterminate_splits_are_refused_not_invented,
               test_stress_grid_is_refused,
               test_rhyme_is_tri_state,
               test_the_unrecoverable_short_vowel,
               test_alliteration_is_consonantal,
               test_radif_on_real_ghazals,
               test_radif_needs_recurrence_not_a_shared_tail,
               test_non_persian_is_refused_on_script,
               test_module_declares_itself,
               test_no_english_resource):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all Persian phonology regressions pass")

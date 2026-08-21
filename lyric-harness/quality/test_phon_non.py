#!/usr/bin/env python3
"""Regressions for the Old Norse phonology (known gap 6, dróttkvætt cell).

The load-bearing tests here are the REFUSALS and the NEGATIVES, because a
hending detector that says yes to everything is exactly as useless as one that
says no, and only the negatives tell them apart:

  - a word outside the declared orthography returns None, never False;
  - `sk-` does NOT alliterate with `s-`, and that rule is checked against
    attested Háttatal couplets where dropping it makes Snorri's own verse
    break Snorri's own rule;
  - a skothending pair is accepted and an aðalhending pair is DISTINGUISHED
    from it, in both directions -- a module that conflates them measures
    nothing;
  - a pair that shares nothing returns False;
  - and where the only surviving orthography has collapsed a vowel contrast,
    aðalhending returns None rather than a manufactured True.

TEXT AND ITS PROVENANCE, stated because this file quotes verse

All verse below is Snorri Sturluson's *Háttatal*, c. 1222-25 -- medieval, and
public domain by age. Stanzas 1 and 2 are his own DEMONSTRATION stanzas: the
prose between them defines skothending on `jörð : fyrð` and aðalhending on
`rofs : ofs`, so this is a 13th-century known-answer test and not a
construction of the author's. Stanzas 4 and 52 are quoted for the alliteration
cluster rule.

The spelling is the ǫ/ø -> ö normalisation, which is the only complete
Háttatal text reachable; its EDITION layer (Guðni Jónsson, 1935-54) is
recorded CONTESTED in `data/sources.tsv` and **no file from it is vendored,
staged or admitted as a corpus** -- these are quotations used as fixtures.
Where a test needs the classical spelling (`jǫrð`, `hǫrð`, `grœði`) it is this
file's own respelling, and it is labelled as such: those cases test the
MECHANISM, the Háttatal cases test the rules.

Run: python3 quality/test_phon_non.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

# Imported DIRECTLY rather than through quality.phonology.get(). The module
# registers itself on import either way, so this is a stylistic choice now.
# ~~the registry line in __init__.py ... is not wired yet~~ — STALE, struck
# 2026-08-21: `non` is in `__init__.py`'s import list and has been for some
# time (doctrine 17).
from quality.phonology import non  # noqa: E402

FAILURES = []
N = non.OldNorse()


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


#: Háttatal 1 -- the stanza Snorri's prose analyses. Every line carries the
#: hending its position requires, so this is a known-answer test.
HATTATAL_1 = [
    "Lætr sá, er Hákun heitir,",
    "hann rekkir lið, bannat,",
    "jörð kann frelsa, fyrðum",
    "friðrofs, konungr, ofsa.",
    "Sjalfr ræðr allt ok Elfar",
    "ungr stillir sá milli,",
    "gramr á gift at fremri,",
    "Gandvíkr jöfurr landi.",
]
#: Háttatal 2 -- the second demonstration stanza, "kenndr háttr". Same metre,
#: and it is the one that proves `x` must be read as two consonants.
HATTATAL_2 = [
    "Fellr of fúra stilli",
    "fleinbraks, limu axla,",
    "Hamðis fang, þar er hringum",
    "hylr ættstuðill skylja.",
    "Holt felr hildigelti",
    "heila bæs, ok deilir",
    "gulls í gelmis stalli",
    "gunnseið, skörungr, reiðir.",
]
#: Háttatal 4.1-2 (stave st-) and 52.1-2 (stave sk-). Chosen because in both,
#: dropping the cluster rule makes the odd line carry THREE stuðlar, and
#: Snorri says the number is two: "en rangt er, ef þessir stafir standa fyrir
#: samstöfur oftar eða sjaldnar en svá í fjórðungi vísu."
CLUSTER_COUPLETS = [
    ("Stinn sár þróask stórum,", "sterk egg frömum seggjum", "st"),
    ("Sær Skjöldungs niðr skúrum,", "sköft, darraðar, lyftask,", "sk"),
]


def test_declares_itself():
    print("\n1. Old Norse — the declaration, every field of it")
    d = N.declaration()
    check("language is non", d["language"] == "non")
    for k in ("name", "notation", "grid_unit", "prominence_rule", "relation",
              "source"):
        check(f"declares {k}", bool(d.get(k)) and d[k] != "unset")
    check("notation names the ö merger it accepts",
          "ö" in d["notation"] and "MERGED" in d["notation"])
    check("notation names what it REFUSES and what it cannot detect",
          "REFUSED" in d["notation"] and "NOT DETECTABLE" in d["notation"])
    check("source claims no external resource and vendors no text",
          "rules only" in d["source"] and "NO TEXT IS VENDORED" in d["source"],
          d["source"][:76])
    check("grid_unit is the syllable, six to a line",
          "syllable" in d["grid_unit"], d["grid_unit"])


def test_syllabification():
    print("\n2. Old Norse — the syllabifier on attested words")
    cases = {
        "fyrðum": ["fyrð", "um"],      # ð is never an onset, so rð is the coda
        "ofsa": ["of", "sa"],          # fs is not an onset, s is
        "stillir": ["stil", "lir"],    # a geminate splits
        "milli": ["mil", "li"],
        "friðrofs": ["frið", "rofs"],
        "landi": ["lan", "di"],
        "konungr": ["ko", "nungr"],
        "skylja": ["sky", "lja"],      # lj IS an onset
        "hildigelti": ["hil", "di", "gel", "ti"],
        "ættstuðill": ["ætt", "stuð", "ill"],
    }
    for w, want in cases.items():
        got = [s.text for s in N.syllabify(w)]
        check(f"{w} -> {'.'.join(want)}", got == want,
              "" if got == want else f"got {'.'.join(got)}")
    check("au ei ey are single nuclei",
          [s.nucleus for s in N.syllabify("heitir")][0] == "ei"
          and [s.nucleus for s in N.syllabify("auga")][0] == "au"
          and [s.nucleus for s in N.syllabify("eyða")][0] == "ey")
    # Snorri's second demonstration stanza rhymes braks : axla, which is an
    # aðalhending only if x is k+s.
    check("x is read as k+s", non.units("axla") == ["a", "k", "s", "l", "a"],
          str(non.units("axla")))


def test_refusal():
    print("\n3. Old Norse — outside the orthography is None, never False")
    for w in ("wolf", "qveða", "hattar1", "cyning"):
        check(f"{w!r} is unreadable, so syllabify returns nothing",
              N.syllabify(w) == [] and non.units(w) is None)
    check("alliterates with an unreadable word is None, not False",
          N.alliterates("skjöldu", "wolf") is None,
          "False would assert they do not alliterate; the module cannot know")
    check("rhymes with an unreadable word is None",
          N.rhymes("jörð", "wolf") is None)
    check("skothending with an unreadable word is None",
          N.skothending("jörð", "wolf") is None)
    check("aðalhending with an unreadable word is None",
          N.adalhending("jörð", "wolf") is None)
    check("an out-of-range syllable index is None, not the last syllable",
          N.hending_rime("jörð", 4) is None)
    check("nothing falls back to another language",
          N.alliterates("cyning", "cempa") is None,
          "Old English is a different language; a Germanic-looking word is "
          "not a licence to read it")


def test_alliteration_clusters():
    print("\n4. Old Norse — sk/sp/st alliterate only with themselves")
    check("sk- does NOT alliterate with s-",
          N.alliterates("skjöldu", "sverð") is False,
          "a skald never heard those two answer each other")
    check("st- does NOT alliterate with s-",
          N.alliterates("stórum", "sár") is False)
    check("sp- does NOT alliterate with s-",
          N.alliterates("spjöll", "sár") is False)
    check("sk- alliterates with sk-", N.alliterates("skjöldu", "skúrum") is True)
    check("st- alliterates with st-", N.alliterates("stórum", "sterk") is True)
    check("sk- does NOT alliterate with st-",
          N.alliterates("skúrum", "stórum") is False)
    check("sj- sv- sl- are plain s-, not clusters",
          N.alliterates("sjalfr", "sverð") is True
          and N.alliterates("slíðrbraut", "sár") is True,
          "only sk, sp, st are separate staves")
    check("any vowel alliterates with any vowel",
          N.alliterates("allt", "Elfar") is True
          and N.alliterates("ungr", "allt") is True,
          "Snorri: 'ef hljóðstafr er höfuðstafrinn, þá skulu stuðlar vera ok "
          "hljóðstafir'")
    check("a vowel does not alliterate with a consonant",
          N.alliterates("allt", "landi") is False)
    check("j- is a consonant here, not a vowel",
          N.alliterates("jörð", "allt") is False
          and N.alliterates("jörð", "jöfurr") is True)


def test_cluster_rule_against_canon():
    print("\n5. Old Norse — the TRADITION test: the cluster rule on Snorri")

    def naive_stave(w):
        """What the module would say WITHOUT the sk/sp/st rule."""
        s = N.syllabify(w)
        return None if not s else (s[0].onset[0] if s[0].onset else "")

    for odd, even, stave in CLUSTER_COUPLETS:
        got, head, detail = N.couplet_alliteration(odd, even)
        check(f"{odd[:30]:<30} has exactly 2 stuðlar", got == 2, detail)
        check(f"   ...on the {stave!r} stave", head == stave, f"got {head!r}")
        naive_head = next(naive_stave(w) for w in non._tokens(even)
                          if non._norm(w) not in non.PARTICLES)
        naive = sum(1 for w in non._tokens(odd)
                    if non._norm(w) not in non.PARTICLES
                    and naive_stave(w) == naive_head)
        check(f"   ...and WITHOUT the rule it would be {naive}, which is wrong",
              naive == 3,
              "Snorri: 'en rangt er, ef þessir stafir standa fyrir samstöfur "
              "oftar ... en svá í fjórðungi vísu'")


def test_snorris_own_worked_examples():
    print("\n6. Old Norse — Snorri's own two worked examples, and the "
          "distinction between them")
    # "Hér er svá: jörð, fyrð ... Þessa setning hljóðfalls köllum vér
    #  skothending." — Háttatal prose, after stanza 1.
    check("jörð : fyrðum IS a skothending",
          N.skothending("jörð", "fyrðum") is True)
    check("jörð : fyrðum is NOT an aðalhending",
          N.adalhending("jörð", "fyrðum") is False,
          "they are different relations; a module that conflates them is "
          "useless")
    # "Svá er hér: rofs, ofs ... Þetta heita aðalhendingar."  rofs is the
    # SECOND element of the compound friðrofs, so it needs index 1.
    check("friðrofs : ofsa IS an aðalhending",
          N.adalhending("friðrofs", "ofsa", ia=1) is True)
    check("friðrofs : ofsa is NOT a skothending",
          N.skothending("friðrofs", "ofsa", ia=1) is False)
    # The textbook pairs, which are constructions and are labelled as such.
    check("hattar : stuttu is a skothending (constructed pair)",
          N.skothending("hattar", "stuttu") is True)
    check("harða : garði is an aðalhending (constructed pair)",
          N.adalhending("harða", "garði") is True)
    check("harða : garði is NOT a skothending",
          N.skothending("harða", "garði") is False)
    check("a pair that shares nothing is False, in both relations",
          N.skothending("jörð", "milli") is False
          and N.adalhending("jörð", "milli") is False)
    # "upphafstafir greina orðin" — the onsets must DIFFER. Identity is not
    # rhyme, and Snorri says so seven centuries before doctrine 3.
    check("a word does not hend with itself",
          N.adalhending("hann", "hann") is False
          and N.skothending("hann", "hann") is False,
          "Snorri: 'upphafstafir greina orðin'")
    check("but hann : bannat does", N.adalhending("hann", "bannat") is True)
    check("an open syllable has no hending: no consonant follows the vowel",
          N.adalhending("sá", "þá") is False)


def test_demonstration_stanzas():
    print("\n7. Old Norse — the TRADITION test: both demonstration stanzas")
    for name, st in (("Háttatal 1", HATTATAL_1), ("Háttatal 2", HATTATAL_2)):
        res = N.stanza(st)
        for i, (kind, v, detail) in enumerate(res, 1):
            want = "skot" if i % 2 else "adal"
            check(f"{name} L{i} carries its {want}hending",
                  kind == want and v is True, detail)
        # the two relations are not interchangeable: an odd line's skothending
        # must NOT also read as an aðalhending, or the test proves nothing.
        for i in (1, 3, 5, 7):
            v, _d = N.line_hending(st[i - 1], "adal", ae_merged=True)
            check(f"{name} L{i} is NOT an aðalhending line", v is not True)


def test_couplet_alliteration_on_canon():
    print("\n8. Old Norse — twelve staves to a stanza, three to a couplet")
    for name, st in (("Háttatal 1", HATTATAL_1), ("Háttatal 2", HATTATAL_2)):
        for k in range(0, 8, 2):
            got, head, detail = N.couplet_alliteration(st[k], st[k + 1])
            check(f"{name} couplet {k // 2 + 1}: exactly 2 stuðlar", got == 2,
                  detail)
    # Without Snorri's own málfylling list this reads THREE vowel-initial
    # words in his own line and reports the stanza as malformed.
    got, head, _d = N.couplet_alliteration(HATTATAL_1[4], HATTATAL_1[5])
    check("the vowel couplet works and `ok` does not count as a stuðill",
          got == 2 and head == "",
          "Snorri licenses an extra vowel initial in málfylling: 'ek, - eða "
          "svá: en, er, at, í, á, of, af, um'")
    raw = sum(1 for w in non._tokens(HATTATAL_1[4])
              if N.alliterating_unit(w) == "")
    check("   ...and without the list it would be 3, which Snorri calls rangt",
          raw == 3, f"vowel-initial words in the line: {raw}")


def test_the_merger_is_refused_not_resolved():
    print("\n9. Old Norse — doctrine 53: the ǫ/ø -> ö merger, per RELATION")
    check("the module recognises the merged orthography from the text",
          N.merged_orthography("\n".join(HATTATAL_1)) is True
          and N.merged_orthography("jǫrð kann frelsa") is False)
    # ö stands for either ǫ or ø, so two ö-words might be the same vowel or
    # not. aðalhending needs to know; it must refuse rather than manufacture.
    check("aðalhending on two merged vowels is None, NOT True",
          N.adalhending("jörð", "hörð") is None,
          "returning True would assert an identity the edition destroyed")
    # The same pair spelled out resolves in both directions. These two
    # spellings are this file's own, and they test the MECHANISM.
    check("spelled ǫ : ǫ it resolves to True",
          N.adalhending("jǫrð", "hǫrð") is True)
    check("spelled ǫ : ø it resolves to False",
          N.adalhending("jǫrð", "hørð") is False,
          "'this edition cannot tell me' and 'these vowels differ' are "
          "different answers")
    # Skothending is a consonant relation and stays definite wherever the two
    # vowels are written differently -- which is Snorri's own example.
    check("skothending across the merger stays definite: jörð : fyrðum",
          N.skothending("jörð", "fyrðum") is True,
          "no reading of ö is y, so the merger cannot touch this verdict")
    check("and its aðalhending verdict is definite too, and False",
          N.adalhending("jörð", "fyrðum") is False)
    # The residue: two IDENTICAL merged graphemes could be ǫ:ǫ or ǫ:ø, so
    # whether the vowels DIFFER is also unknown. Narrow, and not nothing.
    check("skothending on two identical merged graphemes is None",
          N.skothending("jörð", "hörð") is None,
          "the merger is harmless for skothending, not weightless")
    # æ stands for œ in the same editions, so it is ambiguous only once the
    # orthography is declared. stanza() infers it from the text.
    check("æ is exact by default", N.adalhending("bæði", "sæði") is True)
    check("æ is ambiguous once the merged orthography is declared",
          N.adalhending("bæði", "græði", ae_merged=True) is None,
          "classically bæði (æ) and grœði (œ) are different vowels, so the "
          "merged text would manufacture this aðalhending")
    check("spelled œ it resolves to False",
          N.adalhending("bæði", "grœði") is False)


def test_vowel_initial_onsets_and_the_branch_that_never_fired():
    print("\n9b. Old Norse — when BOTH onsets are empty, the vowel is the "
          "initial letter")
    # "upphafstafir greina orðin" was read as onset-TUPLE inequality, so two
    # vowel-initial words both had onset () and compared equal. Twelve real
    # sagadb lines came back False on a skothending because of it. Fixing it
    # raised observed 51.54% -> 55.63% while the null max rose only 34.81% ->
    # 37.20%, so the gap GREW +16.72 -> +18.43: it bought lift, not yield
    # (doctrine 61). Aðalhending was bit-for-bit identical, as registered.
    for a, b in (("Iðrask", "yðrum"), ("ár", "aura"), ("orms", "armi"),
                 ("endr", "undir"), ("ungr", "Engla")):
        check(f"{a}:{b} is a skothending, not an onset collision",
              N.skothending(a, b, ae_merged=True) is True)
    # THE FIXTURES BELOW EXIST BECAUSE THE CELL THAT MEASURED THE FIX FOUND
    # THESE TWO ARMS FIRED ZERO TIMES ON THE CORPUS. All 13 pairs that reached
    # the empty-onset branch had DIFFERENT vowels, so the other two outcomes
    # rested on argument alone. Constructed, and labelled as constructed.
    check("same vowel and no onset either: nothing distinguishes them",
          N.adalhending("orma", "ormr", ae_merged=True) is False
          and N.skothending("orma", "ormr", ae_merged=True) is False,
          "an aðalhending needs the initial letters to DISTINGUISH the words, "
          "and two vowel-initial words with the same vowel do not")
    check("same MERGED grapheme and no onset: refuses, never decides",
          N.adalhending("ölnar", "ölnum", ae_merged=True) is None
          and N.skothending("ölnar", "ölnum", ae_merged=True) is None,
          "ö : ö cannot say whether the vowels are the same OR different, so "
          "neither predicate may answer")
    check("but a merged grapheme against a disjoint one stays DEFINITE",
          N.skothending("Öllungis", "illa", ae_merged=True) is True,
          "ö reads {ǫ,ø} and i reads {i}; the sets are disjoint, so the "
          "vowels differ whichever way the merger resolves — attested")


def test_vowel_length_position():
    print("\n10. Old Norse — the vowel-length position, taken and declared")
    # Length is phonemic here, so a and á are two vowels, not one vowel twice.
    check("a : á is NOT an aðalhending — length is a phoneme",
          N.adalhending("fara", "sára") is False)
    check("a : á IS a skothending — two different vowels is what it asks for",
          N.skothending("fara", "sára") is True,
          "the alternative reading, that a bare quantity contrast is too weak "
          "to be heard as a hending, is defensible and is NOT taken; it is "
          "declared in skothending.__doc__")
    doc = " ".join(N.skothending.__doc__.split())
    check("the position is stated in the docstring, not left to the reader",
          "vowel length is phonemic in Old Norse" in doc
          and "is NOT taken" in doc)
    check("and the docstring's own example obeys the onset rule",
          N.skothending("fara", "fára") is False and "fara : fára" in doc,
          "same onset f-, so it is not a hending at all — Snorri: "
          "'upphafstafir greina orðin'")
    check("a long vowel and a diphthong are both heavy",
          N.syllabify("sá")[0].moras == 2
          and N.syllabify("heitir")[0].moras == 2)


def test_prominence_is_stress_and_weight_is_not():
    print("\n11. Old Norse — doctrine 35: prominence is stress, weight is not")
    check("stress is fixed on the first syllable of the word",
          [s.prominence for s in N.syllabify("konungr")] == [1, 0]
          and [s.prominence for s in N.syllabify("hildigelti")] == [1, 0, 0, 0])
    check("prominences() returns a real stress pattern (Old Norse HAS stress)",
          N.prominences("landi") == [1, 0])
    # The reason they are two fields: a stressed syllable can be light and an
    # unstressed one heavy, and one field cannot hold both.
    check("sonar: stressed-LIGHT then unstressed-HEAVY",
          [s.prominence for s in N.syllabify("sonar")] == [1, 0]
          and [s.moras for s in N.syllabify("sonar")] == [1, 2],
          "collapsing weight into prominence would erase exactly this")
    check("a closed syllable is heavy even with a short vowel",
          N.syllabify("landi")[0].moras == 2)
    check("a hyphen marks a compound, and its second element is stressed",
          [s.prominence for s in N.syllabify("Gand-víkr")] == [1, 1]
          and [s.prominence for s in N.syllabify("Gandvíkr")] == [1, 0],
          "unhyphenated, the module has no morphology and says so")


def test_enclisis_is_reported_not_smoothed():
    print("\n12. Old Norse — six syllables, and the line that has seven")
    for i, ln in enumerate(HATTATAL_1[1:], 2):
        check(f"Háttatal 1 L{i} scans to six", len(N.scan(ln)) == 6,
              ".".join(x["syllable"].text for x in N.scan(ln)))
    # Snorri says six ("Hverju vísuorði fylgja sex samstöfur") and his own
    # printed line 1 has seven: `sá er` is one metrical syllable, `sás`.
    sc = N.scan(HATTATAL_1[0])
    check("L1 reports SEVEN rather than silently forcing six", len(sc) == 7,
          ".".join(x["syllable"].text for x in sc) + " — `sá er` = `sás`, "
          "which needs morphology this module does not have")
    check("and the hending is unaffected, being anchored to the penult",
          N.line_hending(HATTATAL_1[0], "skot", ae_merged=True)[0] is True)


def test_notation_report():
    print("\n13. Old Norse — what the orthography check can and cannot see")
    r = N.notation_report(" ".join(HATTATAL_1))
    check("it names the ö merger on the real text",
          any("ö present" in x for x in r), str(r)[:90])
    # The -ur heuristic was replaced by a four-pair function-word statistic
    # calibrated on a MATCHED pair -- egils_saga.on.xml against the modernised
    # egils_saga.is.xml, same saga, ~70k tokens each. It separates by ~5000x
    # where -ur separated by 15x AND flagged the Old Norse text, because Old
    # Norse has its own legitimate -ur (r-stem genitives, feminine plurals).
    OLD = "ok at ok at maðr konungr ok at ok at konungr maðr ok at ok at " \
          "ok at ok at maðr konungr ok at ok at konungr maðr ok at ok at"
    NEW = OLD.replace("ok", "og").replace(" at", " að") \
             .replace("maðr", "maður").replace("konungr", "konungur")
    check("a modernised text is named, with the consequence",
          any("MODERNISED" in x and "unrecoverable" in x
              for x in N.notation_report(NEW + " Lætur")),
          str(N.notation_report(NEW + " Lætur"))[:110])
    check("an Old Norse text is not, AND the -ur flag is suppressed",
          any("not modernised" in x for x in N.notation_report(OLD))
          and not any("-ur" in x for x in N.notation_report(OLD)),
          str(N.notation_report(OLD))[:110])
    check("a MIXED text gets both counts and no verdict",
          any("MIXED" in x and "no verdict" in x
              for x in N.notation_report(OLD + " " + " ".join(
                  NEW.split()[:12]))),
          "modernised prose around archaised verse is the usual cause, and "
          "that is information the caller needs, not a call to make here")
    # The boundary is CLOSED at 0.50 toward MODERNISED, and a boundary nobody
    # tests is a boundary nobody chose. An exact half-and-half text reads as
    # modernised, which is the safe direction: it names a consequence.
    check("the 0.50 boundary is closed toward MODERNISED and is tested",
          any("MODERNISED" in x
              for x in N.notation_report(OLD + " " + NEW)),
          str(N.notation_report(OLD + " " + NEW))[:100])
    # Doctrine 16/20: a statistic calibrated on ~6000 observations may not
    # answer on 1. The old heuristic answered on any input at all.
    check("too few function words REFUSES rather than deciding",
          any("NOT ENOUGH EVIDENCE" in x
              for x in N.notation_report("Lætur konungur sár")),
          str(N.notation_report("Lætur konungur sár"))[:110])
    check("th/dh fires only when there is NO þ/ð anywhere",
          any("th" in x for x in N.notation_report("thing ok dhat")))
    check("and a compound seam in a þ/ð text does NOT fire it",
          not any("substitution" in x
                  for x in N.notation_report("þróttharðr Naddhristir ok þat")),
          "þróttharðr is t+h and Naddhristir is d+h -- both were false "
          "positives on a text that writes þ/ð 874 times")
    check("it flags accent-stripped text",
          any("accent-stripped" in x for x in
              N.notation_report("hann rekkir lid bannat ok sa er kann "
                                "frelsa mikla")))
    check("it reports out-of-inventory words as REFUSED",
          any("REFUSED" in x for x in N.notation_report("wolf cyning")))
    check("an empty report is declared to prove nothing",
          "PROVES NOTHING" in N.notation_report.__doc__,
          "`jord` for `jǫrð` is four legal letters and cannot be detected")


def test_no_english_resource():
    print("\n14. nothing here falls back to English")
    import ast
    import inspect
    tree = ast.parse(inspect.getsource(non))
    mods = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            mods.update(a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            mods.add(node.module.split(".")[0])
    check("quality.phonology.non imports no English resource",
          "lyric_harness" not in mods and "cmudict" not in mods,
          f"imports: {sorted(mods)}")
    check("and it registers itself under 'non'",
          non.OldNorse.language == "non")


if __name__ == "__main__":
    for fn in (test_declares_itself,
               test_syllabification,
               test_refusal,
               test_alliteration_clusters,
               test_cluster_rule_against_canon,
               test_snorris_own_worked_examples,
               test_demonstration_stanzas,
               test_couplet_alliteration_on_canon,
               test_the_merger_is_refused_not_resolved,
               test_vowel_initial_onsets_and_the_branch_that_never_fired,
               test_vowel_length_position,
               test_prominence_is_stress_and_weight_is_not,
               test_enclisis_is_reported_not_smoothed,
               test_notation_report,
               test_no_english_resource):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all Old Norse phonology regressions pass")

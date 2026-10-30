#!/usr/bin/env python3
"""The extended English sound inventory and the accent readings derived from it.

    python3 quality/test_sound_inventory.py

THE OWNER'S RULINGS (2026-10-29): NEAR is "its own sound, so it echoes neither
see nor his ... every check"; "cover every English vowel"; "add /x/ and the
New York a too along with all of the rare regional distinctions"; every
pronunciation of a word counts (standing rule 5); no outside source, nothing
hand-picked. `lyric_harness.VOWELS`/`CONSONANTS` carry the inventory and
`lyric_harness.derive_accent_readings` writes readings over it by rule.

A wrongly derived reading is a FALSE PASS under rule 5 (a check holds when any
one reading holds it), so every rule here has words it must change and words
it must leave alone, and every reading it writes must keep the source
reading's syllable count.
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import lyric_harness as L  # noqa: E402
from lyric_harness import Declaration, Lexicon, anchor, score, syllabify  # noqa: E402

FAILURES = []
LEX = Lexicon()
V1 = Lexicon(reader_scheme="v1")
DECL = Declaration()


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def readings(word):
    return [" ".join(p) for p in LEX.pronunciation_variants(word)]


def gains(word, vowel):
    """Does some reading of `word` carry `vowel` (a base, stress stripped)?"""
    return any(L._base(ph) == vowel for p in LEX.pronunciation_variants(word) for ph in p)


def any_reading(a, b):
    """Every coarse relation the pair stands in under ANY pair of whole
    readings: standing rule 5 at the coarse grade."""
    rels = set()
    for pa in LEX.pronunciation_variants(a):
        for pb in LEX.pronunciation_variants(b):
            rels |= set(score(anchor(syllabify(pa)), anchor(syllabify(pb)),
                              DECL, a, b)["relations"])
    return rels


def rule_words(name, vowel, must, must_not):
    for w in must:
        check(f"{name}: {w} gains {vowel}", gains(w, vowel), " | ".join(readings(w)))
    for w in must_not:
        check(f"{name}: {w} does not gain {vowel}", not gains(w, vowel),
              " | ".join(readings(w)))


# ---------------------------------------------------------------------------
# 1. ONE INVENTORY, EVERY COPY AGREEING
# ---------------------------------------------------------------------------

def test_the_inventory_has_one_definition():
    print("\n1. One inventory, every copy agreeing")
    from quality import pronunciation as PR, quotients as Q, relations as R
    check("pronunciation.VOWELS == lyric_harness.VOWELS",
          PR.VOWELS == set(L.VOWELS), str(PR.VOWELS ^ set(L.VOWELS)))
    check("pronunciation.CONSONANTS == lyric_harness.CONSONANTS",
          PR.CONSONANTS == set(L.CONSONANTS), str(PR.CONSONANTS ^ set(L.CONSONANTS)))
    check("quotients.ARPABET_CONSONANTS == lyric_harness.CONSONANTS",
          set(Q.ARPABET_CONSONANTS) == set(L.CONSONANTS))
    check("every consonant has a manner class",
          all(Q.MANNER.get(c) in Q.MANNER_CLASSES for c in L.CONSONANTS))
    js = open(os.path.join(HERE, "..", "..", "src", "pages", "lyrics.js")).read()

    def js_list(name):
        # one string or several joined with +, as Prettier lays it out
        m = re.search(name + r" =\s*\(?\s*((?:'[^']*'\s*\+?\s*)+)\)?\.split", js)
        return set("".join(re.findall(r"'([^']*)'", m.group(1))).split()) if m else set()
    check("the Lyrics page's vowel list == lyric_harness.VOWELS",
          js_list("LY_ARPABET_VOWELS") == set(L.VOWELS))
    check("the Lyrics page's consonant list == lyric_harness.CONSONANTS",
          js_list("LY_ARPABET_CONSONANTS") == set(L.CONSONANTS))
    check("every vowel feature tuple is distinct (no two symbols score 1.0)",
          len(set(L.VOWELS.values())) == len(L.VOWELS))
    check("every consonant feature tuple is distinct",
          len(set(L.CONSONANTS.values())) == len(L.CONSONANTS))
    check("every name is two vowel letters or an existing consonant shape",
          all(re.fullmatch(r"[A-Z]{1,2}", s) for s in list(L.VOWELS) + list(L.CONSONANTS)))
    check("every new vowel syllabifies as a nucleus",
          all(L.syllabify(["HH", v + "1"])[0]["nucleus"] == v for v in L.VOWELS))
    emitted = {L._base(ph) for ps in LEX.entries.values() for p in ps for ph in p
               if L._is_vowel(ph)}
    check("CHANNEL_DOMAINS['nucleus'] lists exactly the vowels the lexicon emits",
          emitted == set(R.CHANNEL_DOMAINS["nucleus"]),
          f"emitted-only {sorted(emitted - set(R.CHANNEL_DOMAINS['nucleus']))}; "
          f"listed-only {sorted(set(R.CHANNEL_DOMAINS['nucleus']) - emitted)}")


# ---------------------------------------------------------------------------
# 2. EVERY RULE: WORDS IT MUST CHANGE, WORDS IT MUST LEAVE ALONE
# ---------------------------------------------------------------------------

def test_every_rule_has_positive_and_negative_cases():
    print("\n2. Every rule's positive and negative cases")
    rule_words("NEAR respelling", "IA", ["here", "near", "queer", "year", "ear"],
               ["see", "sit", "hearing", "mirror"])
    check("NEAR: no IH/IY before a coda R survives in here", not gains("here", "IY"))
    rule_words("SQUARE respelling", "EA", ["there", "hair", "care", "where"],
               ["head", "bed", "carry", "merry"])
    rule_words("CURE respelling", "UA", ["poor", "sure", "tour", "cure"],
               ["moon", "good", "jury"])
    rule_words("non-rhotic NURSE", "EU", ["bird", "nurse", "word"],
               ["bud", "bed"])
    check("non-rhotic: car gains K AA1", "K AA1" in readings("car"))
    check("non-rhotic: butter gains B AH1 T AH0", "B AH1 T AH0" in readings("butter"))
    check("non-rhotic: carry keeps its R (it opens the next syllable)",
          all("R" in r.split() for r in readings("carry")))
    check("cure-force: poor gains P AO1 R and P AO1",
          {"P AO1 R", "P AO1"} <= set(readings("poor")))
    check("cure-force: sure and tour gain the FORCE vowel",
          gains("sure", "AO") and gains("tour", "AO"))
    check("cure-force: cure and pure (after Y) keep CURE only",
          not gains("cure", "AO") and not gains("pure", "AO"))
    rule_words("FORCE", "OA", ["hoarse", "four", "more", "door", "board"],
               ["horse", "for", "north", "short"])
    rule_words("LOT", "OO", ["lot", "bother", "hot", "watch"],
               ["father", "spa", "calm", "car"])
    rule_words("toe-type GOAT", "OE", ["toe", "nose", "boat", "no"],
               ["tow", "know", "grow", "snow"])
    rule_words("pane-type FACE", "EE", ["pane", "made", "name"],
               ["pain", "maid", "day", "they"])
    rule_words("MEAT", "IE", ["meat", "sea", "beat"],
               ["meet", "see", "field", "me"])
    rule_words("DEW", "IU", ["dew", "threw", "new", "feud"],
               ["do", "through", "blue", "food"])
    rule_words("raised PRICE", "UI", ["write", "price", "life"],
               ["ride", "prize", "my"])
    rule_words("raised MOUTH", "OU", ["house", "about", "out"],
               ["loud", "how", "town"])
    for sym in ("AI", "EI", "UU", "EO", "AU", "II", "UO", "IO", "UE", "OI"):
        check(f"symbol-only {sym}: in the inventory, written by no rule",
              sym in L.VOWELS and not any(L._base(ph) == sym for ps in LEX.entries.values()
                                          for p in ps for ph in p))


# ---------------------------------------------------------------------------
# 3. PROVENANCE, SYLLABLE COUNT, AND THE PRE-BATCH SCHEME
# ---------------------------------------------------------------------------

def test_provenance_and_shape():
    print("\n3. Provenance, syllable count, and the pre-batch scheme")
    check("a respelled reading is credited to its rule, never to CMUdict",
          LEX.reading_source("here", ["HH", "IA1", "R"]) == "rule:near")
    check("an alternate is credited to its rule",
          LEX.reading_source("poor", ["P", "AO1", "R"]) == "rule:cure-force")
    check("an untouched CMUdict reading is credited to CMUdict",
          LEX.reading_source("car", ["K", "AA1", "R"]) == "cmudict")
    check("CMUdict's own respelled reading still validates as a dictionary choice",
          ["HH", "IY1", "R"] in LEX.dictionary_readings("here"))
    bad = []
    for (word, phones), rule in LEX.reading_rules.items():
        n = sum(1 for ph in phones if L._is_vowel(ph))
        if not any(sum(1 for ph in p if L._is_vowel(ph)) == n
                   for p in LEX.cmu_raw_entries.get(word, ())):
            bad.append((word, rule))
    check("every derived reading keeps a CMUdict reading's syllable count",
          not bad, str(bad[:5]))
    check("no word is added: the derived lexicon has CMUdict's keys",
          set(LEX.entries) == set(V1.entries))
    check("v1 replays the pre-batch dictionary: here is HH IY1 R only",
          V1.pronunciation_variants("here") == [["HH", "IY1", "R"]])


# ---------------------------------------------------------------------------
# 4. THE OWNER'S RULINGS AT THE COARSE GRADE, UNDER ANY READING
# ---------------------------------------------------------------------------

def test_the_rulings_hold_under_any_reading():
    print("\n4. The rulings, at the coarse grade, under any reading (rule 5)")
    check("here/near rhyme", "RHYME" in any_reading("here", "near"))
    check("here/see share no vowel (NEAR is its own sound)",
          not {"RHYME", "ASSONANCE"} & any_reading("here", "see"))
    check("here/his share no vowel", not {"RHYME", "ASSONANCE"} & any_reading("here", "his"))
    check("there/head share no vowel (SQUARE)",
          not {"RHYME", "ASSONANCE"} & any_reading("there", "head"))
    check("poor/sure/tour rhyme (CURE)",
          "RHYME" in any_reading("poor", "sure") and "RHYME" in any_reading("poor", "tour"))
    check("poor/more rhyme through poor's FORCE reading", "RHYME" in any_reading("poor", "more"))
    check("car/spa rhyme through the non-rhotic reading", "RHYME" in any_reading("car", "spa"))
    check("horse/hoarse still rhyme (the General American reading stays)",
          "RHYME" in any_reading("horse", "hoarse"))
    check("father/bother still rhyme", "RHYME" in any_reading("father", "bother"))


if __name__ == "__main__":
    for fn in (test_the_inventory_has_one_definition,
               test_every_rule_has_positive_and_negative_cases,
               test_provenance_and_shape,
               test_the_rulings_hold_under_any_reading):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all sound-inventory and accent-reading checks pass")

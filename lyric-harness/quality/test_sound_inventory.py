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
import json
import subprocess
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
        # The page's own definition, evaluated as written (the vowel list is
        # generated: every pair of A E I O U, plus the ARPABET rest).
        m = re.search(r"const " + name + r" =[^;]*;", js)
        if not m:
            return set()
        out = subprocess.run(
            ["node", "-e", m.group(0) + "process.stdout.write(JSON.stringify(" + name + "))"],
            capture_output=True, text=True, timeout=60)
        return set(json.loads(out.stdout)) if out.returncode == 0 else set()
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
    down, up = LEX.with_reader_scheme("v1"), V1.with_reader_scheme("v2")
    check("a v1 view of a v2 lexicon replays CMUdict as shipped",
          down.entries == V1.entries and not down.reading_rules)
    check("a v2 view of a v1 lexicon carries the accent readings",
          up.entries == LEX.entries and up.reading_rules == LEX.reading_rules)
    check("making a view leaves the lexicon it was made from as it was",
          LEX.pronunciation_variants("here") == [["HH", "IA1", "R"], ["HH", "IA1"]])
    from quality.lexicon_supplement import SupplementedLexicon
    sup = SupplementedLexicon(version="v2")
    check("a supplemented lexicon's v1 view drops the rows' accent readings too",
          ["TH", "EU1", "D", "IY0", "W", "AH2", "N"] in sup.pronunciation_variants("thirty-one")
          and ["TH", "EU1", "D", "IY0", "W", "AH2", "N"]
          not in sup.with_reader_scheme("v1").pronunciation_variants("thirty-one"))


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


# ---------------------------------------------------------------------------
# 5. ONE SPEAKER SINGS BOTH WORDS: READINGS PAIR WITHIN AN ACCENT
# ---------------------------------------------------------------------------

def test_readings_pair_within_an_accent():
    print("\n5. Readings pair within an accent, never one rhotic with one not")
    from quality.rhyme_types import coarse_relation_consensus as consensus
    check("car rhotic with far non-rhotic is not one speaker",
          not L.accents_agree([(LEX, "car", ["K", "AA1", "R"]), (LEX, "far", ["F", "AA1"])]))
    check("a word the rule never touches agrees with either answer (car/spa)",
          L.accents_agree([(LEX, "car", ["K", "AA1"]), (LEX, "spa", ["S", "P", "AA1"])])
          and L.accents_agree([(LEX, "toe", ["T", "OE1"]), (LEX, "tow", ["T", "OW1"])]))
    # A PINNED occurrence keeps its word's accent choices visible (3PO
    # 6515014871): its view narrows `entries` to the chosen reading, but the
    # rules that bear on the word come from the whole lexicon.
    line = "I drove your old car"
    pinned = Lexicon(pronunciations=[{"line": line, "token": 5, "word": "car",
                                      "phones": ["K", "AA1", "R"],
                                      "basis": "dictionary",
                                      "source": "test: rhotic car pinned"}])
    view = pinned.for_line(line).for_token(4)
    check("a pinned view narrows car to its one chosen reading",
          view.entries.get("car") == [["K", "AA1", "R"]])
    check("pinned rhotic car does not pair with non-rhotic far",
          not L.accents_agree([(view, "car", ["K", "AA1", "R"]),
                               (LEX, "far", ["F", "AA1"])]))
    check("pinned rhotic car pairs with rhotic far",
          L.accents_agree([(view, "car", ["K", "AA1", "R"]),
                           (LEX, "far", ["F", "AA1", "R"])]))
    from quality import relations as R
    from quality import phonology as PH
    st = R.build_stream([line, "dark and far"], PH.get("eng").__class__(lexicon=pinned),
                        declaration={"language": "eng"})
    tok = {w.lower(): (li, ti) for li, toks in enumerate(st.lexical_tokens)
           for ti, w in enumerate(toks)}
    combos, _ = R.reading_combos(st, {tok["car"], tok["far"]})
    check("the any-reading search keeps a pinned token in the accent check",
          bool(combos) and all(
              tuple(c[tok["far"]][2]) != ("F", "AA1") for c in combos),
          str([c.get(tok["far"]) for c in combos or []]))
    check("...and still offers far's rhotic reading beside the pinned car",
          any(tuple(c[tok["far"]][2]) == ("F", "AA1", "R") for c in combos or []))
    from quality.rhyme_types import coarse_relation_consensus as consensus
    check("a collision with car pinned rhotic still holds (consensus, every reading)",
          consensus(pinned, line, "dark and far", DECL,
                    min_score=L.THETA_COLLISION, quantifier="all") is True)
    for a, b in (("I drove your old car", "dark and far"),
                 ("we climb the stairs", "hanging on the stairs"),
                 ("so we go", "and so"), ("the floor", "behind the door"),
                 ("a bird", "a word")):
        check(f"{a!r}/{b!r} still collides under every reading (a prohibition)",
              consensus(LEX, a, b, DECL, min_score=L.THETA_COLLISION,
                        quantifier="all") is True)
    lake = L.screen_pairs(["lake", "shake"])[0]
    check("lake/shake is not an eye rhyme (both take the pane reading together)",
          "eye rhyme" not in lake["schema_relations"]
          and "perfect rhyme" in lake["schema_relations"])
    from quality import structures as ST
    from quality import phonology as PH
    from quality import rhyme_types as RT
    check("a declared structure is judged over whole readings (go/no, here/near)",
          ST.judge("perfect-rhyme", "go", "no") is True
          and ST.judge("perfect-rhyme", "here", "near") is True
          and ST.judge("perfect-rhyme", "go", "near") is False)
    names, _ = RT.names_at("night", "light", PH.get("eng"), "end")
    check("night/light is still named a masculine rhyme at the line end",
          "masculine rhyme" in names, str(names))
    check("a silent e before a final s or d is set aside (gates, named)",
          gains("gates", "EE") and gains("named", "EE") and not gains("pains", "EE"))
    # The connector's scaffold pair (mcp/test.mjs): six words a line hold
    # more than one reading, so varying every one exceeds the search cap and
    # the pair was refused. General consonance reads consonants only; only
    # `morning` (coda R or none) differs there, and the pair is judged.
    from quality import relations as R
    pair = ["we carry the morning to the light", "we carry the morning to the road"]
    mk = lambda ph: R.build_stream(pair, ph, declaration={"language": "eng"},  # noqa: E731
                                   stanzas=False)
    pc = R.schema_named("parechesis / general consonance")
    check("a whole-line consonance pair varies only the words that differ in consonants",
          R.schema_read_fields(pc) == ("onset", "coda")
          and R.resolve_line_pair(pc, mk(PH.get("eng")), (1, 2),
                                  R.cached_builder(mk))[0] is False)
    check("a rhyme schema still reads every field (perfect rhyme)",
          R.schema_read_fields(R.schema_named("perfect rhyme"))
          == ("onset", "nucleus", "coda", "prominence"))


if __name__ == "__main__":
    for fn in (test_the_inventory_has_one_definition,
               test_every_rule_has_positive_and_negative_cases,
               test_provenance_and_shape,
               test_the_rulings_hold_under_any_reading,
               test_readings_pair_within_an_accent):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all sound-inventory and accent-reading checks pass")

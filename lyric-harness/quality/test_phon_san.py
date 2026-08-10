#!/usr/bin/env python3
"""Regressions for the Sanskrit phonology (known gap 6, Indic cell).

Standalone, in the style of quality/test_phonology.py. It imports the module
directly rather than through the registry, because the orchestrator has not
wired the import line yet.

The load-bearing tests are of two kinds.

THE REFUSALS. Harvard-Kyoto `kRSNa` case-folds to `krsna`, which is a legal
IAST string, so a module that helpfully lowercased its input would read कृष्ण
as one syllable with a four-consonant onset and never say so. Every
transliteration this module does not read must come back None, not a guess.

THE TRADITION. A syllabifier that satisfies only its author is untested
(doctrine 37). These fixtures are real verse whose guru/laghu pattern is fixed
by a named metre, so the metre is the known answer and the module is what is on
trial: Bhāravi's Kirātārjunīya in vaṃśastha, puṣpitāgrā, mālinī and pathyā
anuṣṭubh, and Jayadeva's Gītagovinda in śārdūlavikrīḍita. Bhāravi is 6th
century and Jayadeva 12th; both clear the 1931 cutoff by most of a millennium.

TEXT SOURCE. Every fixture below is a `# text =` line copied verbatim from the
Digital Corpus of Sanskrit (Oliver Hellwig: Digital Corpus of Sanskrit (DCS).
2010-2021), CC BY 4.0, at `dcs/data/conllu/files/`, fetched by the sparse
checkout recorded in data/sources.tsv so that the NC-licensed sibling tree
`corpus/GRETIL/` is never touched. Chapter and verse are given per fixture.
Where a fixture is the transmitted (sandhied) reading rather than the DCS's
restored one, it says so and says why -- that pair is itself a test.

Run: python3 quality/test_phon_san.py
"""

import os
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.phonology import Unsupported, get  # noqa: E402
from quality.phonology import san  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


S = san.Sanskrit()

# -- metrical templates, from the gaṇa decompositions ---------------------
# ja=lgl  ta=ggl  ma=ggg  na=lll  ra=glg  ya=lgg  sa=llg  bha=gll
#: vaṃśastha, ja-ta-ja-ra, 12 syllables per pāda.
VAMSASTHA = "lgl" "ggl" "lgl" "glg"
#: śārdūlavikrīḍita, ma-sa-ja-sa-ta-ta-ga, 19.
SARDULA = "ggg" "llg" "lgl" "llg" "ggl" "ggl" "g"
#: mālinī, na-na-ma-ya-ya, 15.
MALINI = "lll" "lll" "ggg" "lgg" "lgg"
#: puṣpitāgrā, an ardhasamavṛtta: odd pādas na-na-ra-ya (12), even pādas
#: na-ja-ja-ra-ga (13). The half-verse is therefore 25 syllables.
PUSPITAGRA_ODD = "lll" "lll" "glg" "lgg"
PUSPITAGRA_EVEN = "lll" "lgl" "lgl" "glg" "g"
#: pathyā anuṣṭubh. Positions 1-4 of each pāda are free; 5-7 are fixed
#: ⏑ — — in odd pādas and ⏑ — ⏑ in even; position 8 is anceps.
ANUSTUBH = "xxxx" "lgg" "x" + "xxxx" "lgl" "x"


def pada_template(t, n=2):
    """A half-verse of n pādas, each ending in an anceps position."""
    return (t[:-1] + "x") * n


# -- fixtures -------------------------------------------------------------
# Bhāravi, Kirātārjunīya, sarga 1, verses 1-2 (DCS: Kirātārjunīya-0000,
# 'Kir, 1'). Each DCS line is a HALF-VERSE of two vaṃśastha pādas.
KIR_VAMSASTHA = [
    "śriyaḥ kurūṇām adhipasya pālanīṃ prajāsu vṛttiṃ yam ayuṅkta veditum",
    "sa varṇiliṅgī viditaḥ samāyayau yudhiṣṭhiraṃ dvaitavane vanecaraḥ",
    "kṛtapraṇāmasya mahīṃ mahībhuje jitāṃ sapatnena nivedayiṣyataḥ",
    "na vivyathe tasya mano na hi priyaṃ pravaktum icchanti mṛṣā hitaiṣiṇaḥ",
]
# Kirātārjunīya 1.45 and 1.46 — the sarga-closing metre change, which is the
# control that stops this being a one-metre test. A module that had merely
# been fitted to vaṃśastha would call these broken lines.
KIR_PUSPITAGRA = [
    "na samayaparirakṣaṇaṃ kṣamaṃ te nikṛtipareṣu pareṣu bhūridhāmnaḥ",
    "ariṣu hi vijayārthinaḥ kṣitīśā vidadhati sopadhi saṃdhidūṣaṇāni",
]
KIR_MALINI = [
    "vidhisamayaniyogād dīptisaṃhārajihmaṃ śithilabalam agādhe magnam "
    "āpatpayodhau",
    "riputimiram udasyodīyamānaṃ dinādau dinakṛtam iva lakṣmīs tvāṃ "
    "samabhyetu bhūyaḥ",
]
# Kirātārjunīya sarga 11, verses 1-3 (DCS: Kirātārjunīya-0010, 'Kir, 11'),
# which is in anuṣṭubh — the śloka.
KIR_ANUSTUBH = [
    "athāmarṣān nisargācca jitendriyatayā tayā",
    "ājagāmāśramaṃ jiṣṇoḥ pratītaḥ pākaśāsanaḥ",
    "munirūpo 'nurūpeṇa sūnunā dadṛśe puraḥ",
    "drāghīyasā vayo'tītaḥ pariklāntaḥ kilādhvanā",
    "jaṭānāṃ kīrṇayā keśaiḥ saṃhatyā paritaḥ sitaiḥ",
    "pṛktayendukarair ahnaḥ paryanta iva saṃdhyayā",
]
# Jayadeva, Gītagovinda 1.1 (DCS: Gītagovinda-0000, 'GītGov, 1'), the maṅgala
# verse, in śārdūlavikrīḍita. Split into its two pādas of 19.
GG_PADA1_DCS = "meghaiḥ meduram ambaram vanabhuvaḥ śyāmāḥ tamāladrumaiḥ"
GG_PADA2_DCS = "naktam bhīruḥ ayam tvam eva tat imam rādhe gṛham prāpaya"
# The transmitted reading of the same pāda, with sandhi intact. The ONLY
# difference from the DCS line is `bhīrur` for `bhīruḥ` and three anusvāras
# the DCS restores as final -m; none of them changes the syllable count.
GG_PADA2_TRANSMITTED = "naktaṃ bhīrur ayaṃ tvam eva tad imaṃ rādhe gṛhaṃ prāpaya"
# Gītagovinda, aṣṭapadī 1 (`pralayapayodhijale`), whose couplets carry textbook
# antya-prāsa. Each pair is the two half-line-final words of one couplet.
GG_ANTYA_PRASA = [
    ("vedam", "akhedam"),        # 1.5  ...asi vedam / ...caritram akhedam
    ("pṛṣṭhe", "gariṣṭhe"),      # 1.6  ...tiṣṭhati pṛṣṭhe / ...gariṣṭhe
    ("lagnā", "nimagnā"),        # 1.7  ...dharaṇī tava lagnā / ...nimagnā
    ("śṛṅgam", "bhṛṅgam"),       # 1.8  ...adbhutaśṛṅgam / ...taśiputanubhṛṅgam
    ("pāpam", "tāpam"),          # 1.11 ...apagatapāpam / ...śamitabhavatāpam
]


def test_iast_units_and_the_aspirates():
    print("\n1. Sanskrit — the aspirates are SINGLE consonants")
    cases = {
        "bha": ["bh", "a"],
        "yudhiṣṭhiraṃ": ["y", "u", "dh", "i", "ṣ", "ṭh", "i", "r", "a", "ṃ"],
        "kṛṣṇa": ["k", "ṛ", "ṣ", "ṇ", "a"],
        "rādhe": ["r", "ā", "dh", "e"],
        "hitaiṣiṇaḥ": ["h", "i", "t", "ai", "ṣ", "i", "ṇ", "a", "ḥ"],
        "ahnaḥ": ["a", "h", "n", "a", "ḥ"],   # h after a VOWEL is not aspiration
    }
    for w, want in cases.items():
        got = san.units(w)
        check(f"{w} -> {'+'.join(want)}", got == want,
              "" if got == want else f"got {got}")
    check("an aspirate never splits into stop + h",
          "h" not in san.units("yudhiṣṭhiraṃ"),
          "count the cluster in characters and `yu` becomes guru; it is laghu, "
          "and the whole line then misses its own metre while looking sound")
    check("ai and au are single long nuclei",
          san.units("tai") == ["t", "ai"] and san.units("yau") == ["y", "au"])


def test_syllabic_r_is_a_nucleus():
    print("\n2. Sanskrit — ṛ ṝ ḷ ḹ are NUCLEI, not consonants")
    check("kṛ is one syllable with nucleus ṛ",
          [(x.text, x.nucleus) for x in S.syllabify("kṛṣṇa")]
          == [("kṛ", "ṛ"), ("ṣṇa", "a")],
          str([(x.text, x.nucleus) for x in S.syllabify("kṛṣṇa")]))
    check("mṛtyu is two syllables, not one",
          [x.text for x in S.syllabify("mṛtyu")] == ["mṛ", "tyu"],
          "read ṛ as a consonant and mṛ- becomes a three-consonant onset with "
          "no vowel at all")
    check("ṝ is a long nucleus", S.syllabify("pitṝn")[-1].nucleus == "ṝ"
          and S.syllabify("pitṝn")[-1].prominence == 1)


def test_guru_and_laghu():
    print("\n3. Sanskrit — the four ways to be guru, and the one to be laghu")
    check("bha is LAGHU: bh is one consonant, so nothing follows the vowel",
          [x.prominence for x in S.syllabify("bha")] == [0],
          "a per-character loop sees b + h, calls it a cluster, and returns "
          "guru")
    check("a short vowel before a GENUINE cluster is guru (by position)",
          [x.prominence for x in S.syllabify("adhipasya")] == [0, 0, 1, 0],
          "a.dhi.pa.sya — `pa` is heavy because sy follows it, and this is the "
          "rule most easily got wrong")
    check("a long nucleus is guru",
          [x.prominence for x in S.syllabify("rādhe")] == [1, 1])
    check("anusvāra makes a syllable guru",
          S.syllabify("vṛttiṃ")[-1].prominence == 1
          and "ṃ" in S.syllabify("vṛttiṃ")[-1].coda)
    check("visarga makes a syllable guru",
          S.syllabify("vanecaraḥ")[-1].prominence == 1
          and [x.prominence for x in S.syllabify("vanecaraḥ")] == [0, 1, 0, 1])
    check("a consonant-closed final syllable is guru before a pause",
          [x.prominence for x in S.syllabify("bhagavat")] == [0, 0, 1])
    check("moras are 2 for guru and 1 for laghu",
          [x.moras for x in S.syllabify("bhagavat")] == [1, 1, 2]
          and all((x.moras == 2) == (x.prominence == 1)
                  for x in S.syllabify("yudhiṣṭhiraṃ")))
    check("yudhiṣṭhiraṃ scans ⏑ — ⏑ —, which needs BOTH dh and ṣṭh counted right",
          [x.prominence for x in S.syllabify("yudhiṣṭhiraṃ")] == [0, 1, 0, 1],
          "yu laghu (dh is one), dhi guru (ṣ + ṭh is two)")


def test_position_reaches_across_the_word_boundary():
    print("\n4. Sanskrit — a pāda is not the sum of its words' scansions")
    check("yam alone is guru", [x.prominence for x in S.syllabify("yam")] == [1])
    check("`yam ayuṅkta` scans ya.ma.yu.ṅkta with ya LAGHU",
          [x.text for x in S.scan_pada("yam ayuṅkta", anceps=False)]
          == ["ya", "ma", "yu", "ṅkta"]
          and S.pattern("yam ayuṅkta", anceps=False) == "llgl",
          "the m is the onset of the following vowel; scanning word by word "
          "and joining the lists gives a metrically wrong line that still "
          "looks like a line")
    check("syllabify REFUSES whitespace rather than scanning a phrase",
          S.syllabify("yam ayuṅkta") == [],
          "it points the caller at scan_pada instead of quietly getting the "
          "position rule wrong")
    check("maximal onset puts the whole cluster on the following akṣara",
          [x.text for x in S.syllabify("vṛttiṃ")] == ["vṛ", "ttiṃ"],
          "which is what Devanāgarī does: a conjunct is written attached to "
          "the vowel that follows it")


def test_unicode_normalisation_is_explicit():
    print("\n5. Sanskrit — NFD input must not silently change every retroflex")
    line = "yudhiṣṭhiraṃ dvaitavane vanecaraḥ"
    nfd = unicodedata.normalize("NFD", line)
    check("the NFC and NFD forms of one line are different strings",
          nfd != line, f"NFC {len(line)} chars, NFD {len(nfd)} chars")
    check("and they scan identically, because normalisation is done not hoped",
          S.pattern(nfd) == S.pattern(line) == VAMSASTHA,
          f"NFC {S.pattern(line)} / NFD {S.pattern(nfd)}")
    check("a composed ṣ and a decomposed ṣ are the same phoneme",
          san.units(unicodedata.normalize("NFD", "kṛṣṇa"))
          == ["k", "ṛ", "ṣ", "ṇ", "a"],
          "in NFD ṣ is s + U+0323; a membership test on the raw string sees a "
          "bare s and an unknown mark, and every retroflex changes class")


def test_other_transliterations_are_refused():
    print("\n6. Sanskrit — every other notation is refused, never converted")
    cases = {
        "kRSNa": "Harvard-Kyoto (case is phonemic: R=ṛ, S=ṣ)",
        "zAnti": "Harvard-Kyoto (z=ś, A=ā)",
        "kfzRa": "SLP1 (f=ṛ, z=ṣ, R=ṇ)",
        "raama": "ITRANS (aa=ā)",
        "kRiShNa": "ITRANS",
        "कृष्ण": "Devanāgarī",
        "ṁ": "ISO 15919 anusvāra",
        "Rāma": "IAST but CAPITALISED",
    }
    for bad, why in cases.items():
        got = (san.units(bad), S.syllabify(bad),
               S.rhymes(bad, "vedam"), S.alliterates(bad, "vedam"))
        ok = got == (None, [], None, None)
        check(f"{bad!r} refused — {why}", ok, "" if ok else f"got {got}")
    check("Harvard-Kyoto is the DANGEROUS one and it is closed",
          S.syllabify("kRSNa") == [] and S.syllabify("krsna") != [],
          "kRSNa case-folds to krsna, which IS a legal IAST string — so a "
          "module that lowercased its input would read कृष्ण as one syllable "
          "with a four-consonant onset and never say so")
    check("a caller holding capitalised IAST must lowercase it themselves",
          S.syllabify("Rāma") == [] and S.syllabify("rāma") != [],
          "which makes the notation THEIR declaration, not this module's guess")


def test_vamsastha():
    print("\n7. TRADITION — Kirātārjunīya 1.1-1.2 is exact vaṃśastha")
    tmpl = pada_template(VAMSASTHA)
    for ln in KIR_VAMSASTHA:
        got = S.pattern(ln)
        ok = S.scans_as(ln, tmpl)
        check(f"{ln[:44]:<44} {got}", ok is True,
              "" if ok else f"wanted {tmpl}")
    check("the template is ja-ta-ja-ra twice with anceps at 12 and 24",
          tmpl == "lglggllglglx" * 2, tmpl)


def test_the_sarga_closing_metre_change():
    print("\n8. TRADITION — the sarga-closing metres, which stop this being a "
          "one-metre test")
    for ln in KIR_PUSPITAGRA:
        ok = S.scans_as(ln, PUSPITAGRA_ODD + PUSPITAGRA_EVEN[:-1] + "x")
        check(f"Kir 1.45 puṣpitāgrā  {S.pattern(ln)}", ok is True, ln[:56])
    for ln in KIR_MALINI:
        ok = S.scans_as(ln, pada_template(MALINI))
        check(f"Kir 1.46 mālinī      {S.pattern(ln)}", ok is True, ln[:56])
    check("puṣpitāgrā is an ardhasamavṛtta: 12 + 13, not 12 + 12",
          len(PUSPITAGRA_ODD) == 12 and len(PUSPITAGRA_EVEN) == 13)
    check("a vaṃśastha line does NOT scan as mālinī, and vice versa",
          S.scans_as(KIR_VAMSASTHA[0], pada_template(MALINI)) is False
          and S.scans_as(KIR_MALINI[0], pada_template(VAMSASTHA)) is False,
          "a readable pāda of the wrong shape is False, which is an answer; "
          "None is reserved for a pāda that could not be read at all")


def test_pathya_anustubh():
    print("\n9. TRADITION — Kirātārjunīya sarga 11 is pathyā anuṣṭubh")
    for ln in KIR_ANUSTUBH:
        got = S.pattern(ln)
        ok = S.scans_as(ln, ANUSTUBH)
        check(f"{ln[:40]:<40} {got}", ok is True,
              "" if ok else f"wanted {ANUSTUBH}")
    check("the śloka's signature is positions 5-7: ⏑ — — then ⏑ — ⏑",
          ANUSTUBH == "xxxxlggxxxxxlglx", ANUSTUBH)
    p = S.pattern(KIR_ANUSTUBH[2])
    check("an avagraha is silent and contributes no mora",
          p is not None and len(p) == 16,
          "munirūpo 'nurūpeṇa — the ' marks an `a` elided by sandhi, so it is "
          f"dropped rather than parsed; pattern {p}")


def test_sardulavikridita_and_the_orthographic_layer():
    print("\n10. TRADITION — Gītagovinda 1.1, and what de-sandhi does to it")
    tmpl = SARDULA[:-1] + "x"
    check(f"pāda 1 (DCS)          {S.pattern(GG_PADA1_DCS)}",
          S.scans_as(GG_PADA1_DCS, tmpl) is True, GG_PADA1_DCS[:60])
    check(f"pāda 2 (transmitted)  {S.pattern(GG_PADA2_TRANSMITTED)}",
          S.scans_as(GG_PADA2_TRANSMITTED, tmpl) is True,
          GG_PADA2_TRANSMITTED[:60])
    # DOCTRINE 50, and it is not hypothetical here. The DCS `# text =` line is
    # word-segmented and partly DE-SANDHIED: `bhīrur ayaṃ` is restored to
    # `bhīruḥ ayam`. The visarga makes a light syllable heavy, and the pāda
    # then misses śārdūlavikrīḍita at exactly one position out of nineteen.
    got = S.pattern(GG_PADA2_DCS)
    diff = [i for i, (a, b) in enumerate(zip(got, tmpl), 1)
            if b != "x" and a != b]
    check(f"pāda 2 (DCS de-sandhied) FAILS  {got}",
          S.scans_as(GG_PADA2_DCS, tmpl) is False and diff == [4],
          f"misses at position(s) {diff} — syllable 4 is the DCS's restored "
          f"`bhīruḥ` where the transmitted text has `bhīrur`. The module is "
          f"right and the ORTHOGRAPHIC LAYER is what broke; scanning DCS "
          f"segmented text is not scanning the recited verse")
    check("the two readings have the same syllable COUNT, so nothing looks wrong",
          len(S.pattern(GG_PADA2_DCS)) == len(S.pattern(GG_PADA2_TRANSMITTED))
          == 19,
          "which is why this is a silent failure and not a loud one")


def test_the_pada_final_syllable_is_anceps():
    print("\n11. Sanskrit — the declared anceps decision")
    # Kir 1.45.2 ends in `saṃdhidūṣaṇāni`: an open short syllable, which is
    # laghu by the rule and heavy by the metre's licence.
    ln = KIR_PUSPITAGRA[1]
    strict = S.pattern(ln, anceps=False)
    reported = S.pattern(ln)
    check("a pāda-final laghu is reported as ?, not silently promoted",
          strict.endswith("l") and reported.endswith("?"),
          f"strict {strict[-6:]} / reported {reported[-6:]} — the "
          f"indeterminacy is a fact about the METRE, not the phonology, so it "
          f"is reported rather than resolved")
    check("prominence is None there and moras stays at the strict 1",
          S.scan_pada(ln)[-1].prominence is None
          and S.scan_pada(ln)[-1].moras == 1)
    check("and a template asking for guru accepts it",
          S.scans_as(ln, PUSPITAGRA_ODD + PUSPITAGRA_EVEN) is True,
          "anceps promotes light to heavy and never the reverse")
    check("a pāda-final GURU is not touched",
          S.pattern(KIR_VAMSASTHA[0]).endswith("g")
          and S.scan_pada(KIR_VAMSASTHA[0])[-1].prominence == 1)
    check("syllabify() never applies anceps — a word is not a pāda",
          S.syllabify("saṃdhidūṣaṇāni")[-1].prominence == 0)


def test_antya_prasa():
    print("\n12. TRADITION — antya-prāsa in the Gītagovinda's first aṣṭapadī")
    for a, b in GG_ANTYA_PRASA:
        r = S.rhymes(a, b)
        check(f"{a} / {b}", r is True, "" if r else f"got {r}")
    check("pṛṣṭhe / gariṣṭhe is why the whole akṣara is compared",
          S.rhymes("pṛṣṭhe", "gariṣṭhe") is True
          and S.syllabify("pṛṣṭhe")[-2].nucleus
          != S.syllabify("gariṣṭhe")[-2].nucleus,
          "the rhyme is -ṣṭhe; the vowels before it are ṛ against i and do "
          "not agree, so a nucleus-and-coda key would call the textbook case "
          "a non-rhyme")
    check("an aspirate is not its plain stop: vedam does not rhyme prabandham",
          S.rhymes("vedam", "prabandham") is False)
    check("depth is declared, not assumed — and both answers are right",
          S.rhymes("pṛṣṭhe", "gariṣṭhe", depth=1) is True
          and S.rhymes("pṛṣṭhe", "gariṣṭhe", depth=2) is False,
          "the shared run is -ṣṭhe: more than one akṣara, less than two")
    check("a word shorter than the declared depth returns None, not False",
          S.rhymes("śrīḥ", "vedam", depth=2) is None,
          "'cannot be compared at this depth' is not 'does not rhyme'")
    # A prāsa is a run of identical sound, and its length is not a whole
    # number of akṣaras. Measuring it in PHONEMES says what depth rounds off.
    depths = {(a, b): S.prasa_depth(a, b) for a, b in GG_ANTYA_PRASA}
    want = {("vedam", "akhedam"): 4, ("pṛṣṭhe", "gariṣṭhe"): 3,
            ("lagnā", "nimagnā"): 4, ("śṛṅgam", "bhṛṅgam"): 5,
            ("pāpam", "tāpam"): 4}
    check("prasa_depth counts the shared run in phonemes",
          depths == want, str(depths))
    check("and counts an aspirate as ONE",
          S.prasa_depth("vedam", "prabandham") == 2,
          "-am only: dh against d stops the run, where a character count "
          "would have read d+h and agreed on the d")
    key, share, _k = S.antya_prasa([a for a, _b in GG_ANTYA_PRASA])
    check("five different couplet-finals share no single end-rhyme",
          share <= 0.4, f"most common key on {share:.0%} of the pādas")


def test_anuprasa_and_the_prasa_anchor():
    print("\n13. Sanskrit — anuprāsa, and dvitīyākṣara-prāsa's anchor")
    check("pralayapayodhijale ~ payasi alliterate on p",
          S.alliterates("pralayapayodhijale", "payasi") is True)
    check("strict=True wants the whole onset, so pra does not answer pa",
          S.alliterates("pralaya", "payasi", strict=True) is False)
    check("two vowel-initial words do NOT alliterate",
          S.alliterates("agni", "indra") is False,
          "Finnish and Somali treat vowel-initial words as one class; that is "
          "a fact about those traditions. anuprāsa is a repeated CONSONANT, "
          "and there is none here to repeat")
    check("an unreadable word gives None, distinct from False",
          S.alliterates("kRSNa", "payasi") is None)
    a = S.prasa_anchor("śriyaḥ kurūṇām adhipasya pālanīṃ")
    check("the anchor is the SECOND akṣara of the pāda",
          a is not None and a.text == "yaḥ" and a.onset == ("y",),
          None if a is None else f"{a.text!r} onset {a.onset}")
    check("a one-akṣara pāda returns None, not the first syllable",
          S.prasa_anchor("śrīḥ") is None and S.prasa_anchor("a") is None,
          "a pāda with one akṣara has no second one, and saying so is the "
          "answer; returning the first would be a quiet wrong number")
    check("an unreadable pāda returns None rather than crashing",
          S.prasa_anchor("kRSNa iti") is None)
    cons, share, anchors = S.prasa(["kavir manīṣī", "kaviḥ purāṇaḥ",
                                    "kavitvam eti"])
    check("prāsa is a per-stanza measure, reported as a share",
          cons == "v" and share == 1.0,
          f"anchor consonant {cons!r} on {share:.0%} of pādas "
          f"(constructed, and labelled as such: whether the DCS texts satisfy "
          f"dvitīyākṣara-prāsa is a claim about those texts, not about this "
          f"module, and it is not asserted here)")
    _c, share2, _a = S.prasa(["kavir manīṣī", "somo devaḥ", "agnir hotā",
                              "śrīḥ"])
    check("a short or unreadable pāda stays in the DENOMINATOR",
          share2 <= 0.34, f"{share2:.0%} — doctrine 27: a draw that fails the "
          f"filter is a denominator, not a dropped row")


def test_the_grid_is_the_mora_and_stress_is_refused():
    print("\n14. Sanskrit — prominence is quantity, and stress is refused")
    check("grid_unit is the mora, declared", S.grid_unit == "mora")
    check("prominence carries guru/laghu, not stress",
          set(x.prominence for x in S.syllabify("yudhiṣṭhiraṃ")) <= {0, 1}
          and [x.moras for x in S.syllabify("yudhiṣṭhiraṃ")] == [1, 2, 1, 2])
    check("prominences() returns the quantitative binary",
          S.prominences("adhipasya") == [0, 0, 1, 0])
    try:
        S.stresses("adhipasya")
        check("asking for STRESS raises", False, "it returned a pattern")
    except Unsupported as e:
        check("asking for STRESS raises", True, str(e)[:74])
    check("moras() totals a pāda",
          S.moras("yam ayuṅkta") == 5,
          "ya(1) ma(1) yuṅk(2) ta(1) — the final ta is anceps and is counted "
          "at its strict 1; applying the metre's licence is the caller's job")
    check("an unreadable pāda gives None from every measure",
          S.moras("kRSNa") is None and S.pattern("kRSNa") is None
          and S.scans_as("kRSNa", "gg") is None,
          "None means 'could not read'; False means 'read it, and it does not "
          "scan'")


def test_it_declares_itself_and_registers():
    print("\n15. Sanskrit — it declares what it reads and what it is")
    d = S.declaration()
    for k in ("language", "name", "notation", "grid_unit", "prominence_rule",
              "relation", "source"):
        check(f"declares {k}", bool(d.get(k)) and d[k] != "unset",
              f"{k}: {str(d.get(k))[:72]}")
    check("language code is san", d["language"] == "san")
    check("the notation names IAST and names what it refuses",
          "IAST" in d["notation"] and "NFC" in d["notation"]
          and "REFUSED" in d["notation"])
    check("the prominence rule says guru/laghu and says it is not stress",
          "guru" in d["prominence_rule"] and "laghu" in d["prominence_rule"]
          and "NOT stress" in d["prominence_rule"])
    check("the relation names prāsa", "prāsa" in d["relation"])
    check("it registered itself", get("san") is not None
          and get("san").language == "san")


def test_no_english_resource():
    print("\n16. nothing here falls back to English")
    import ast
    import inspect
    tree = ast.parse(inspect.getsource(san))
    mods = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            mods.update(a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            mods.add(node.module.split(".")[0])
    check("quality.phonology.san imports no English resource",
          "lyric_harness" not in mods and "cmudict" not in mods,
          f"imports: {sorted(mods)}")
    check("and loads no corpus at runtime — it is rules only",
          "open(" not in inspect.getsource(san),
          "the DCS validated it; it is not a dependency")


if __name__ == "__main__":
    for fn in (test_iast_units_and_the_aspirates,
               test_syllabic_r_is_a_nucleus,
               test_guru_and_laghu,
               test_position_reaches_across_the_word_boundary,
               test_unicode_normalisation_is_explicit,
               test_other_transliterations_are_refused,
               test_vamsastha,
               test_the_sarga_closing_metre_change,
               test_pathya_anustubh,
               test_sardulavikridita_and_the_orthographic_layer,
               test_the_pada_final_syllable_is_anceps,
               test_antya_prasa,
               test_anuprasa_and_the_prasa_anchor,
               test_the_grid_is_the_mora_and_stress_is_refused,
               test_it_declares_itself_and_registers,
               test_no_english_resource):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all Sanskrit phonology regressions pass")

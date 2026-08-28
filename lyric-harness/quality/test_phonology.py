#!/usr/bin/env python3
"""Regressions for the three unblocked phonologies (known gap 6).

The load-bearing tests are the ones that check a module against its
TRADITION rather than against its own rules: Kalevala lines that are known to
alliterate must alliterate, and canonical regulated verse that is known to
rhyme must rhyme. A syllabifier that satisfies only its author is untested.

THE THIRD TRADITION TEST, ADDED 2026-08-11 (§5c, §5d). Finnish has TWO
relations and this file tested one. `fin.rhymes` — 19th-century literary
*loppusointu*, a different century and a different form from the Kalevala metre
above it — had no tradition test here at all, and the arm that makes a positive
result mean anything was never run beside it. It is now both arms: the rhymed
volumes must rhyme, and `fin_kanteletar.txt`, which is Kalevala-metre and
unrhymed by construction, must NOT come back as rhyming (doctrine 76). The
second arm also carries the trap that only a null exposes — adjacent
Kalevala-metre lines DO agree above chance, because parallelism repeats an
inflectional ending, and reported as a rate that reads as a discovery.

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


# ---------------------------------------------------------------------------
# Finnish, the SECOND relation. This file's own docstring says the load-bearing
# tests are the ones that check a module against its TRADITION, and it names
# two: Kalevala lines that alliterate, and regulated verse that rhymes. Finnish
# END-RHYME was the third and it was missing — `fin.rhymes` shipped with its
# corpus arm living in `test_msa_fin.py` and its figures living in a docstring.
# Everything below reads the staged corpus off disk rather than quoting it, so
# a corpus change fails a test instead of ageing a paragraph (doctrine 39: a
# claim about a corpus is a measurement, never a memory).

FIN_SONG = os.path.join(HERE, "..", "corpus", "song")

#: The file whose metre is Kalevala — unrhymed trochaic tetrameter constrained
#: by alliteration. It is a NEGATIVE CONTROL for end-rhyme that this project
#: already has on disk, in the same language, from the same collector, read by
#: the same instrument. Doctrine 76: a null is only as good as the
#: demonstration that the instrument could have found something.
FIN_KALEVALA_METRE = "fin_kanteletar.txt"

#: Kramsu, `Haihtumaton muisto`, refrain — the poem's own repeated four lines,
#: printed twice in `corpus/song/fin_kaarlo_kramsu.txt`. Read out of the file
#: below rather than pasted, so the fixture cannot drift from the corpus.
FIN_KNOWN_RHYME = ("yksinään", "itsekään")


def _fin_units(name):
    """-> [(end word, ...)] one tuple per printed `[VERSE n]` / `[REFRAIN]`.

    THE UNIT RULE AND THE END-WORD RULE, both declared because every figure
    downstream is a function of them (doctrine 58). Same two rules as
    `quality/fin_rhyme_rate.py`, and the module is the one place they live.
    """
    import re
    end = re.compile(r"[A-Za-zÀ-ÿŠšŽžÄäÖöÅå'’\-]+")
    out, cur = [], []
    for raw in open(os.path.join(FIN_SONG, name), encoding="utf-8"):
        t = raw.strip()
        if not t or t.startswith("#") or t.startswith("---"):
            continue
        if t.startswith("[") and t.endswith("]"):
            if cur:
                out.append(tuple(cur))
            cur = []
            continue
        toks = [w for w in end.findall(t) if w.strip("'’-")]
        if toks:
            cur.append(toks[-1].lower())
    if cur:
        out.append(tuple(cur))
    return out


def _fin_slot(f, units_, i, j, reps=40, seed=20260811, depth=1):
    """-> ((true, false, refused), observed, null median, null max).

    THREE COUNTS, never two (doctrine 79). The rate is over JUDGED pairs; a
    refusal is not a failure and putting it in the numerator would charge the
    comparator for the ingestion layer's misses. The null permutes each unit's
    own end words among its own line slots, which preserves that unit's exact
    end-word inventory and destroys only which slots the form pairs.
    """
    import random
    cache = {}

    def rh(a, b):
        if (a, b) not in cache:
            cache[(a, b)] = f.rhymes(a, b, depth=depth)
        return cache[(a, b)]

    t = fa = n = 0
    for u in units_:
        v = rh(u[i], u[j])
        if v is None:
            n += 1
        elif v:
            t += 1
        else:
            fa += 1
    rng = random.Random(seed)
    vals = []
    for _ in range(reps):
        tt = ff = 0
        for u in units_:
            q = list(u)
            rng.shuffle(q)
            v = rh(q[i], q[j])
            if v is True:
                tt += 1
            elif v is False:
                ff += 1
        vals.append(tt / (tt + ff) if (tt + ff) else 0.0)
    vals.sort()
    return ((t, fa, n), t / (t + fa) if (t + fa) else 0.0,
            vals[len(vals) // 2], vals[-1])


def test_finnish_rhyme_is_anchored_from_the_END():
    print("\n5c. Finnish — the SECOND relation, and its anchor is not "
          "English's")
    f = get("fin")
    d = f.rhyme_declaration()
    check("the anchor is a DECLARED coordinate, not an implied one",
          d["anchor_rule"] == "depth" and d["depth"] == 1
          and "FROM THE WORD END" in d["anchor"],
          "doctrine 45's general form: a checker that silently picks a "
          "coordinate is making a claim it never states")
    check("and the declaration AGREES with the shipped constant",
          f"RIME_DEPTH={d['depth']}" in f.relation,
          f"the `relation` string read RIME_DEPTH=2 while RIME_DEPTH was 1 "
          f"for the whole life of the relation; it now reads {d['depth']}")
    for coord in ("vowel_harmony", "consonant_gradation",
                  "shared_grammatical_suffix"):
        check(f"`{coord}` is stated either way, never left silent",
              bool(d.get(coord)))
    check("fixed initial stress is WHY: `maa : vapaa` rhymes",
          f.rhymes("maa", "vapaa") is True)
    check("  and the ENGLISH PREDICATE PORTED calls it False, because "
          "`vapaa`'s only stress is on `va`",
          f.rhymes("maa", "vapaa", rule="prominent") is False,
          "kept reachable so the falsification is a call and not a claim "
          "(doctrine 84)")
    check("harmony FORBIDS a variant, it does not license one",
          f.rhymes("tahdokaan", "niitäkään") is False
          and f.rhymes("tahdokaan", "niitäkään", harmony="paired") is True)
    check("an undeclared setting RAISES rather than picking a default",
          _raises(lambda: f.rhymes("maa", "saa", rule="stress"))
          and _raises(lambda: f.rhymes("maa", "saa", harmony="loose")))
    check("a shared grammatical suffix is TYPED, not scored as a perfect "
          "rhyme (doctrine 24)",
          f.relation_type("metsässä", "kädessä") == "SUFFIX_RHYME"
          and f.relation_type("yksinään", "itsekään") == "RHYME",
          "agglutination is the Finnish form of the radif question, and a "
          "rhymes() that scored every case-ending pair as perfect would be "
          "measuring morphology")


def test_finnish_rhyme_against_the_tradition():
    print("\n5d. Finnish — the TRADITION test: rhymed verse must rhyme, and "
          "the Kalevala-metre book must NOT")
    f = get("fin")
    kramsu = _fin_units("fin_kaarlo_kramsu.txt")
    refrains = [u for u in kramsu if len(u) == 4
                and (u[1], u[3]) == FIN_KNOWN_RHYME]
    check("Kramsu's `Haihtumaton muisto` refrain is in the staged corpus, "
          "twice", len(refrains) == 2, f"found {len(refrains)}")
    a, b = FIN_KNOWN_RHYME
    check(f"and its 2&4 rhyme `{a} : {b}` is True", f.rhymes(a, b) is True)
    check("  the RICH grade calls it False — a GRADE, not an error: the "
          "penultimate syllables are `si` and `se`",
          f.rhymes(a, b, depth=2) is False)
    check("  and its 1&3 pair, which does not rhyme, is False",
          f.rhymes(refrains[0][0], refrains[0][2]) is False)

    names = [n for n in sorted(os.listdir(FIN_SONG))
             if n.startswith("fin_") and n != FIN_KALEVALA_METRE]
    rhymed = [u for n in names for u in _fin_units(n) if len(u) == 4]
    (t, fa, n), obs, med, mx = _fin_slot(f, rhymed, 1, 3)
    print(f"          POSITIVE arm, {len(names)} rhymed volumes: "
          f"mandated {t + fa + n}, judged {t + fa}, refused {n}")
    print(f"          2&4 observed {obs:.2%}  null median {med:.2%}  "
          f"max {mx:.2%}  excess {100 * (obs - mx):+.2f}pp")
    check("rhymed Finnish verse that is KNOWN to rhyme DOES, and by more "
          "than 30 points over its own null", obs - mx > 0.30,
          f"{obs:.4f} against a null max of {mx:.4f}")
    check("  and the RATE alone is not the finding: a quarter of the "
          "corpus's own re-pairings rhyme before any poet is involved "
          "(doctrine 64)", med > 0.20, f"null median {med:.4f}")
    check("  the three counts are separate and a refusal is not a failure "
          "(doctrine 79)", t + fa + n == len(rhymed) and n > 0,
          f"{n} of {len(rhymed)} mandated pairs are REFUSALS")

    kant = [u for u in _fin_units(FIN_KALEVALA_METRE) if len(u) == 4]
    (kt, kf, kn), kobs, kmed, kmx = _fin_slot(f, kant, 1, 3)
    print(f"          NEGATIVE arm, {FIN_KALEVALA_METRE}: "
          f"mandated {kt + kf + kn}, judged {kt + kf}, refused {kn}")
    print(f"          2&4 observed {kobs:.2%}  null median {kmed:.2%}  "
          f"max {kmx:.2%}  excess {100 * (kobs - kmx):+.2f}pp")
    check("the Kalevala-metre book does NOT come back as rhyming — its 2&4 "
          "slot is below its own null", kobs < kmed,
          f"{kobs:.4f} against a null median of {kmed:.4f}; this is the arm "
          f"that makes the positive one mean anything (doctrine 76)")
    check("  and the two arms separate by more than 35 points on the same "
          "slot with the same instrument", obs - kobs > 0.35,
          f"{obs:.2%} rhymed vs {kobs:.2%} Kalevala-metre")
    (_at, _af, _an), aobs, _amed, amx = _fin_slot(f, kant, 0, 1)
    print(f"          ...but ADJACENT lines: observed {aobs:.2%}  "
          f"max {amx:.2%}  excess {100 * (aobs - amx):+.2f}pp")
    check("THE TRAP: adjacent Kalevala-metre lines DO agree above chance, "
          "and it is not rhyme", aobs > amx,
          "parallelism repeats a syntactic frame across two lines, so both "
          "end in the same inflectional ending; without the null it reads "
          "as a discovery")


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
    # THE DASH LEFT THE DEFAULT 2026-08-28 (M-7). It was promoted to gwant on
    # the evidence of ONE edition; across five further Welsh files it is
    # punctuation 72 times out of 72, and the gwant is an ENGLYN feature a
    # cywydd does not have. An edition that prints it DECLARES it — the
    # declared-mark-set shape `relations.mark_printed_caesura` has always
    # shipped. §10m holds the coordinate's own gate.
    t, d = c.cynghanedd("tan a thi--tywyn a thau")
    check("a dash is PUNCTUATION at the default — the caesura it might mark "
          "is not in the text until an edition declares it",
          t is None and "no caesura is printed" in d, d)
    t, d = c.cynghanedd("tan a thi--tywyn a thau", marks=("/", "|", "--"))
    check("the DECLARED gwant `--` IS a caesura, and the line reads croes",
          t == "croes", d)
    for dash in ("—", "–"):
        t, _d = c.cynghanedd(f"tan a thi{dash}tywyn a thau",
                             marks=("/", "|", "--"))
        check(f"the gwant set as {dash!r} reads the same under the same "
              f"declaration — `normalise` folds every dash spelling to `--`",
              t == "croes")
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
    # IMPLEMENTATION against the rule -- not the rule against canon.
    #
    # TWO DEFECTS IN ONE LINE UNTIL 2026-08-23 (doctrine 17). It read
    # `check("constructed tests are labelled...", True, "canon requires a
    # sourced corpus, which is blocked")`: vacuous, and the reason was stale.
    # The corpus stopped being blocked on 2026-08-10 -- data/sources.tsv row
    # GITenberg/Gwaith-Alun_14865, 1,558 strict-metre lines at
    # corpus/cym_alun_strict.txt, which quality/test_cym.py reads. A check
    # that cannot fail also cannot notice that its own reason expired.
    canon = os.path.join(HERE, "..", "corpus", "cym_alun_strict.txt")
    n_canon = (sum(1 for ln in open(canon, encoding="utf-8")
                   if ln.strip() and not ln.startswith(("---", "[", "#")))
               if os.path.exists(canon) else 0)
    check("the fixtures above are labelled as testing the IMPLEMENTATION, "
          "and the canon arm they defer to is STAGED rather than blocked",
          n_canon > 1000,
          f"corpus/cym_alun_strict.txt: {n_canon} strict-metre lines "
          f"(GITenberg/Gwaith-Alun_14865), read by quality/test_cym.py")


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


# --------------------------------------------------------------------------
# ATTESTED. Every pair below is a real line-end from a staged Welsh file, with
# the line number it came from, so the tradition test is against the tradition
# and not against the module's own rules (doctrine 37).
#
# `corpus/song/cym_cynghanedd_llywelyn_goch_cywydd.txt` is a complete cywydd:
# 108 lines, 7-syllable RHYMED COUPLETS, which is the corpus header's own word
# for the form. That makes it the POSITIVE arm for end-rhyme, and its own
# straddling pairs -- line 2 with line 3, line 4 with line 5 -- the negative
# one: same text, same words, same instrument, same line distance, and the form
# mandates nothing there.
# --------------------------------------------------------------------------

CYM_CYWYDD = "cym_cynghanedd_llywelyn_goch_cywydd.txt"

#: (line, line, first end word, second end word). Couplets of the staged
#: cywydd, chosen to cover the four things the anchor has to get right.
#: The tokens are the FILE's, not a tidied-up transcription of them: `hoew-fardd`
#: carries the edition's hyphen and `trwch--` the em dash `normalise()` folds.
#: This tuple had `hoewfardd` and `rodded` in it on its first run and the file
#: overruled both, which is exactly what the assertion below it is for: the
#: fixture is checked AGAINST the staged file before any verdict is asked of it,
#: so a tidied-up transcription fails loudly instead of testing a word that is
#: not in the corpus.
CYM_COUPLETS = (
    (1, 2, "hoew-fardd", "fardd"),     # diacen : acennog, the cywydd's rule
    (3, 4, "heddiw", "lliw"),          # diphthong nucleus
    (5, 6, "trwch--", "degwch"),       # a trailing em dash on the rhyme word
    (9, 10, "wynedd", "bedd"),         # digraph coda `dd`, kept whole
    (31, 32, "sidan", "lân"),          # circumflex against its plain vowel
)


def _cym_ends(name, marked=True):
    """Line-end words of a staged Welsh file, in order. Same two rules as
    `quality/cym_rhyme_rate.py` -- the unit is the corpus's own marker and the
    end word is the last token `cym.WORD_RE` finds (doctrine 58)."""
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    path = os.path.join(root, "corpus", "song" if marked else "", name)
    out = []
    for raw in open(path, encoding="utf-8"):
        t = raw.strip()
        if not t or (marked and (t.startswith("#") or t.startswith("--- ")
                                 or (t.startswith("[") and t.endswith("]")))):
            continue
        toks = [w for w in cym.WORD_RE.findall(cym.normalise(t))
                if w.strip("'-")]
        if toks:
            out.append(toks[-1].lower())
    return out


def test_welsh_rhyme_anchor_is_counted_from_the_word_end():
    print("\n10g. Welsh — the SECOND relation, and its anchor is not "
          "English's")
    c = get("cym")
    d = c.rhyme_declaration()
    check("the anchor is a DECLARED coordinate, not an implied one",
          d["anchor_rule"] == "depth" and d["depth"] == 1
          and "COUNTED FROM THE WORD END" in d["anchor"],
          "doctrine 45's general form: a checker that silently picks a "
          "coordinate is making a claim it never states")
    check("and the declaration AGREES with the shipped constants",
          d["depth"] == cym.RIME_DEPTH and d["anchor_rule"] == cym.RHYME_RULE
          and f"RIME_DEPTH={cym.RIME_DEPTH}" in c.relation,
          "built FROM the constants: fin.py's `relation` string named a depth "
          "the module did not ship, for the whole life of that relation")
    for coord in ("nucleus", "coda", "diacritics", "glide", "mutation",
                  "shared_ending", "refusals"):
        check(f"`{coord}` is stated either way, never left silent",
              bool(d.get(coord)))
    check("PENULTIMATE stress is WHY: the cywydd's own couplet rhymes",
          c.rhymes("hoewfardd", "fardd") is True)
    check("  and the ENGLISH PREDICATE PORTED calls it False, because the "
          "anchor lands two syllables back on one side and one on the other",
          c.rhymes("hoewfardd", "fardd", rule="prominent") is False,
          "kept reachable so the falsification is a call and not a claim "
          "(doctrine 84)")
    check("  the port REFUSES outright on a proclitic line-end, which has no "
          "prominent syllable at all (doctrine 46)",
          c.rhymes("yn", "hyn", rule="prominent") is None
          and c.refusal_reason("yn", rule="prominent")
          == "no_prominent_syllable")
    check("an undeclared setting RAISES rather than picking a default",
          _raises(lambda: c.rhymes("bedd", "gwedd", rule="stress"))
          and _raises(lambda: c.rhymes("bedd", "gwedd", diacritics="strip"))
          and _raises(lambda: c.rhymes("bedd", "gwedd", glide="glide")))
    check("the EIGHT DIGRAPHS stay whole inside the coda, which is the whole "
          "reason this module exists",
          c.rime("mynydd") == ("y", "dd") and c.rime("bardd") == ("a", "rdd"),
          str((c.rime("mynydd"), c.rime("bardd"))))
    check("identity is TYPED, never scored as a rhyme (doctrine 3)",
          c.relation_type("bedd", "bedd") == "REPEAT"
          and c.relation_type("wynedd", "bedd") == "RHYME")
    # FOUND BY READING THE CODE, NOT BY WATCHING A NUMBER. The undecided glide
    # readings are independent across two words and SHARED within one: whatever
    # the truth about `wych` is, both copies of it have it. Taking the verdict
    # over the cross-product -- which is right for two different words -- made
    # a REPEAT on such a word come back UNDECIDED. It occurs 0 times in the
    # staged corpus, so no rate in RESULTS_CYM_RHYME.md moves; a song corpus is
    # full of refrains and the next staged file could carry one.
    check("a REPEAT on a glide-ambiguous word is TRUE, not undecided",
          c.rhymes("wych", "wych") is True
          and c.relation_type("wych", "wych") == "REPEAT"
          and len(c.rimes("wych")) == 2,
          "the word still holds two readings; what it does not hold is two "
          "INDEPENDENT readings against a copy of itself")
    check("  ...while two DIFFERENT glide-ambiguous words stay independent",
          c.rhymes("fynych", "wych") is None,
          "`wych` and `fynych` are separate lexical facts and the cross-"
          "product is the right comparison there")
    check("  ...and 'same form' is the comparison units() makes: the hyphen "
          "and the length mark fold into it",
          c.relation_type("hoew-fardd", "hoewfardd") == "REPEAT"
          and c.relation_type("tân", "tan") == "REPEAT"
          and c.relation_type("tân", "tan", diacritics="keep") == "NONE",
          "so the shipped fold makes `tân` and `tan` one word and "
          "diacritics='keep' makes them two, which is the choice being "
          "declared rather than a side effect of it")
    check("`shared_tail` is a diagnostic and NOT a type — this module holds "
          "no sourced Welsh ending list and refuses to invent one",
          c.shared_tail("mynydd", "llonydd") == "nydd"
          and "NOT TYPED" in d["shared_ending"])


def test_welsh_mutation_does_not_reach_the_rime():
    print("\n10h. Welsh — treiglad is outside the rime BY CONSTRUCTION")
    c = get("cym")
    # Every token here is in the staged corpus; the mutation grades of one
    # word are attested side by side, so this is a corpus fact and not a
    # remembered paradigm.
    for grades in (("tân", "dân", "thân"), ("brân", "frân"),
                   ("môr", "fôr"), ("cân", "gân", "chân")):
        rimes = {c.rime(g) for g in grades}
        check(f"{' / '.join(grades)} have ONE rime between them",
              len(rimes) == 1, str(rimes))
        for x in grades[1:]:
            check(f"  ...so {grades[0]} : {x} is True",
                  c.rhymes(grades[0], x) is True)
    check("and the reason is structural, not a table: the rime starts at a "
          "NUCLEUS and never reads its own first onset",
          c.rime("gardd") == c.rime("ardd") == c.rime("hardd"),
          "a change confined to the word-initial consonant run cannot enter "
          "any rime this module builds, at any depth, under either anchor")
    check("`mutation` says so in the declaration rather than nowhere",
          "does not participate" in c.rhyme_declaration()["mutation"])


def test_welsh_rhyme_against_the_tradition():
    print("\n10i. Welsh — the TRADITION test: the cywydd is rhymed couplets, "
          "and its straddling pairs are not")
    c = get("cym")
    ends = _cym_ends(CYM_CYWYDD)
    check("the staged cywydd is 108 lines", len(ends) == 108, str(len(ends)))
    for i, j, a, b in CYM_COUPLETS:
        check(f"L{i}/L{j} of the staged file really are {a!r} / {b!r}",
              ends[i - 1] == a and ends[j - 1] == b,
              f"got {ends[i - 1]!r} / {ends[j - 1]!r}")
    for i, j, a, b in CYM_COUPLETS:
        check(f"L{i}/L{j}  {a} : {b}  rhymes", c.rhymes(a, b) is True,
              str((c.rimes(a), c.rimes(b))))
    check("  ...and the L5/L6 pair rhymes THROUGH the edition's em dash, "
          "which normalise() folds to `--` and units() drops",
          c.rime("trwch--") == c.rime("trwch") == ("w", "ch"))
    check("  ...and L1/L2 rhymes THROUGH the edition's hyphen, which in "
          "Welsh JOINS (doctrine 65)",
          c.rime("hoew-fardd") == c.rime("hoewfardd") == ("a", "rdd"))
    check("  ...and diacritics='keep' calls L31/L32 False, so the fold is a "
          "measurable choice rather than a silent one",
          c.rhymes("sidan", "lân", diacritics="keep") is False)
    check("a STRADDLING pair at the same line distance does NOT rhyme: "
          "L2/L3 fardd : heddiw",
          ends[1] == "fardd" and ends[2] == "heddiw"
          and c.rhymes(ends[1], ends[2]) is False)
    check("L55/L56 fynych : wych is REFUSED, not guessed: `wych` is `w`+`ych` "
          "or the diphthong `wy`+`ch` and the two readings disagree",
          c.rhymes("fynych", "wych") is None
          and c.rimes("wych") == (("wy", "ch"), ("y", "ch")),
          str(c.rimes("wych")))
    check("  ...and BOTH decided readings are reachable, so the refusal is "
          "measured against them rather than asserted better (doctrine 84)",
          c.rhymes("fynych", "wych", glide="vocalic") is False
          and c.rhymes("fynych", "wych", glide="consonantal") is True)

    coup = [(ends[i], ends[i + 1]) for i in range(0, len(ends) - 1, 2)]
    strad = [(ends[i], ends[i + 1]) for i in range(1, len(ends) - 1, 2)]
    pc = cym.pair_census(c, coup)
    ps = cym.pair_census(c, strad)
    print("          POSITIVE arm, the mandated couplets: mandated "
          f"{pc['mandated']}, judged {pc['judged']}, refused {pc['refused']}"
          f" -> {pc['true']} True")
    print("          NEGATIVE arm, the straddling pairs:  mandated "
          f"{ps['mandated']}, judged {ps['judged']}, refused {ps['refused']}"
          f" -> {ps['true']} True")
    check("a cywydd's mandated couplets DO rhyme — every judged one of them",
          pc["true"] == pc["judged"] and pc["judged"] >= 50,
          f"{pc['true']} of {pc['judged']}")
    check("  and the three counts are separate: the refusals are the DESIGNED "
          "glide refusal and are not charged to the comparator (doctrine 79)",
          pc["refused"] == 3 and set(pc["by_code"]) == {"undecided_glide"},
          str(pc["by_code"]))
    check("the STRADDLING pairs do not — 0 of them, on the same text with the "
          "same instrument at the same line distance",
          ps["true"] == 0 and ps["judged"] == 53,
          f"{ps['true']} of {ps['judged']}")
    check("  the arms separate by 100 points, which is what makes the "
          "positive one mean anything (doctrine 76)",
          pc["true"] / pc["judged"] - ps["true"] / ps["judged"] > 0.99)
    port = cym.pair_census(c, coup, rule="prominent")
    print("          the ENGLISH PORT on the same couplets: mandated "
          f"{port['mandated']}, judged {port['judged']}, refused "
          f"{port['refused']} -> {port['true']} True")
    check("THE ANCHOR IS THE COORDINATE THIS RELATION TURNS ON: the English "
          "port answers True on 2 of 52 where the shipped rule answers 51 of "
          "51", port["true"] == 2,
          "Welsh stress is penultimate, so a cywydd couplet pairs an accented "
          "end with an unaccented one and a prominence anchor reads a "
          "different span on each side")

    # THE TRAP THE FINNISH CELL FOUND, LOOKED FOR HERE. Adjacent Kalevala-metre
    # lines agree above chance because parallelism repeats an inflectional
    # ending, which is not rhyme. The Welsh form of it is the REFRAIN.
    reps = 0
    tot = 0
    for name in sorted(os.listdir(os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "corpus",
            "song"))):
        if not name.startswith("cym_song_"):
            continue
        e = _cym_ends(name)
        for i in range(len(e) - 1):
            t = c.relation_type(e[i], e[i + 1])
            if t == "REPEAT":
                reps += 1
            if t in ("REPEAT", "RIME_RICHE", "RHYME"):
                tot += 1
    print(f"          REPEAT share of TRUE adjacent verdicts in the four song "
          f"books: {reps} of {tot}")
    check("REPEAT is typed rather than scored as rhyme, and it is not zero — "
          "a song corpus repeats its refrain (doctrine 3)",
          reps > 0 and tot > reps,
          "half of corpus/whitman.txt's detected links are REPEAT on an "
          "identical token, which is why that file was never an eligible "
          "negative control; a rhymes() that could not say REPEAT would walk "
          "into the same wall here")


def test_welsh_rhyme_leaves_cynghanedd_alone():
    print("\n10j. Welsh — the rime path must not move a cynghanedd number")
    c = get("cym")
    check("the diacritic fold is NOT applied by syllabify",
          [s.nucleus for s in c.syllabify("tân")] == ["â"]
          and c.rime("tân") == ("a", "n"),
          "folding globally would change a syllable COUNT — `â'u` is two "
          "nuclei and folds to the listed diphthong `au`, which is one — so "
          "it is confined to the rime path (doctrine 58)")
    check("the glide alternative is NOT applied by syllabify either",
          [s.nucleus for s in c.syllabify("wych")] == ["wy"]
          and c.rimes("wych") == (("wy", "ch"), ("y", "ch")))
    check("`skeleton` is unchanged on an attested line",
          c.skeleton("Trwy Gwalia", "llafariad") == ["t", "r", "g", "l"],
          str(c.skeleton("Trwy Gwalia", "llafariad")))
    check("and the folding function refuses to rescue an out-of-inventory "
          "letter: it drops a mark only over a VOWEL",
          cym.fold_diacritics("mañana") == "mañana"
          and cym.fold_diacritics("tân") == "tan"
          and c.refusal_reason("mañana") == "out_of_inventory",
          "a blanket strip would turn ñ into n and quietly admit a foreign "
          "proper name that units() correctly refuses")


def test_the_scan_reads_the_caesura_it_was_given():
    """`cynghanedd_scan(caesura=...)` WAS ACCEPTED AND NEVER READ.

    `cynghanedd()` validates the SAME PARAMETER NAME against the same two
    values and implements both. `cynghanedd_scan()` took it, dropped it, and
    swept every boundary whatever the caller declared — so
    `caesura="marked"` performed the search it was written to refuse, and
    reported `positions_tried` = k for a reading the caller had pinned to ONE
    placement. That field is not decoration: doctrine 19/56 says a search over
    placements needs its own null, and `positions_tried` is how the inflation
    gets corrected rather than absorbed. A wrong k OVER-corrects a test that
    never swept. One coordinate, two readings, in one class (doctrine 1).
    """
    print("\n10k. `cynghanedd_scan` reads its declared caesura "
          "(FIXED 2026-08-15)")
    c = get("cym")
    # REAL LINES FROM THE STAGED EDITION, which prints the gwant as `--`.
    # SINCE M-7 (2026-08-28) the dash is not in the DEFAULT mark set, so a
    # marked reading of this edition DECLARES it — the same call this section
    # always made, with the edition's own convention now stated as a
    # coordinate instead of assumed for every text (§10m gates the default).
    GWANT = ("/", "|", "--")
    both = "Och o'u swn!--yn gasach sydd;"
    swept_only = "Ust! y ffrwd,--pa sibrwd sydd?"
    unmarked = "Calon lân yn llawn daioni"

    s, m = (c.cynghanedd_scan(both),
            c.cynghanedd_scan(both, caesura="marked", marks=GWANT))
    check("a line whose PRINTED caesura works reads the same TYPE both ways",
          s["type"] == m["type"] == "traws", f"{s['type']} / {m['type']}")
    check("...and the two readings report DIFFERENT multiplicities, which is "
          "the whole reason the coordinate exists — 1 declared placement is "
          "not 15 searched ones (doctrine 19/56)",
          m["positions_tried"] == 1 and s["positions_tried"] > 1,
          f"marked k={m['positions_tried']}, search k={s['positions_tried']}")

    s2, m2 = (c.cynghanedd_scan(swept_only),
              c.cynghanedd_scan(swept_only, caesura="marked", marks=GWANT))
    check("a type that exists ONLY because the boundary was swept is reported "
          "under `search` and REFUSED under `marked` — the edition does not "
          "print that placement",
          s2["type"] == "sain" and m2["type"] is None,
          f"search={s2['type']} k={s2['positions_tried']}; "
          f"marked={m2['type']} k={m2['positions_tried']}")

    m3 = c.cynghanedd_scan(unmarked, caesura="marked")
    check("a line with NO printed caesura refuses under `marked` and says so, "
          "rather than falling back to the search it was told not to run",
          m3["type"] is None and "not in the text" in m3["detail"]
          and m3["positions_tried"] == 0,
          f"k={m3['positions_tried']}: {m3['detail'][:60]}")
    # k IS 0 AND NOT 1: no placement was available to try, and a 1 here would
    # be a correction for a test that never happened (doctrine 20/79).

    check("an undeclared value REFUSES by name, the way the sibling method "
          "has since it was written",
          _raises_value(lambda: c.cynghanedd_scan(unmarked, caesura="bogus")),
          "silently searching for a caller who declared otherwise is the "
          "substitution doctrine 1 is about")

    # THE CONTROL: the default is untouched, so every recorded searched rate
    # still reproduces. `quality/cynghanedd_rate.py` and this file's own §10c
    # both call the scan with no caesura argument.
    check("the DEFAULT reading is unchanged — omitting the argument still "
          "sweeps every boundary",
          c.cynghanedd_scan(unmarked)["positions_tried"]
          == s2["positions_tried"] - 5,
          f"{c.cynghanedd_scan(unmarked)['positions_tried']} placements on a "
          f"5-word line, 15 on a 6-word one")


def test_the_mark_set_is_a_declared_coordinate():
    """§10m — M-7 (2026-08-28): WHICH MARKS PRINT A CAESURA IS A DECLARATION.

    The dash was promoted to gwant on the evidence of ONE edition (Alun,
    1909); measured across five further Welsh files it is punctuation 72
    times out of 72 — in the 1862 Pryse cywydd it comes in MATCHED PAIRS
    around interjections — and the gwant is an ENGLYN feature a cywydd does
    not have. So a dash-split `caesura='marked'` reading was reading the
    TYPESETTER by construction, and `cynghanedd_rate.PINNED`'s repin says
    what that cost: 25 of Alun's 129 marked hits were dash-split croes/traws,
    and the marked nulls each carried 4-5 dash-artifact hits of their own.
    `cym.CAESURA_MARKS` is the default; an edition that prints the gwant
    declares `marks=("/", "|", "--")` on the call.
    """
    print("\n10m. the caesura mark set is a declared coordinate (M-7)")
    c = get("cym")
    GWANT = ("/", "|", "--")
    dashline = "tan a thi--tywyn a thau"

    check("the DEFAULT is `/` and `|` — the marks that mean a caesura in "
          "every language a text can be staged in",
          type(c).CAESURA_MARKS == ("/", "|"),
          f"cym.CAESURA_MARKS = {type(c).CAESURA_MARKS!r}")
    t, d = c.cynghanedd(dashline)
    check("at the default a dash line has NO printed caesura — refused, "
          "never searched",
          t is None and "no caesura is printed" in d, d)
    t, _ = c.cynghanedd(dashline, marks=GWANT)
    check("the same line under the DECLARED gwant reads croes",
          t == "croes")
    m = c.cynghanedd_scan(dashline, caesura="marked", marks=GWANT)
    check("...and `cynghanedd_scan` agrees under the SAME declaration, at "
          "k=1 — the marked branch tokenises the PARTS, because a flush-set "
          "dash glues `thi--tywyn` into one raw token and an index derived "
          "from the raw line lands the cut a word early (doctrine 1; found "
          "and fixed in this same sitting)",
          m["type"] == "croes" and m["positions_tried"] == 1,
          f"{m['type']} k={m['positions_tried']}")
    t, _ = c.cynghanedd("tan a thi | tywyn a thau")
    check("`|` and `/` are untouched — the default two still read",
          t == "croes"
          and c.cynghanedd("tan a thi / tywyn a thau")[0] == "croes")

    # THE MUTATION, run rather than described: put the dash back in the
    # default. If `CAESURA_MARKS` were not the one declaration both readers
    # consult, this would change nothing and the checks above would be
    # asserting a coincidence.
    try:
        c.CAESURA_MARKS = GWANT
        t, _ = c.cynghanedd(dashline)
        check("MUTATION: dash restored to the default -> the same call reads "
              "croes, so the constant is the load-bearing declaration",
              t == "croes")
    finally:
        del c.CAESURA_MARKS
    t, d = c.cynghanedd(dashline)
    check("restored: the default refuses the dash again",
          t is None and "no caesura is printed" in d, d)


def _raises_value(fn):
    try:
        fn()
    except ValueError:
        return True
    except Exception:
        return False
    return False


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
               test_finnish_rhyme_is_anchored_from_the_END,
               test_finnish_rhyme_against_the_tradition,
               test_somali_syllable_shape,
               test_somali_refuses_a_stress_grid,
               test_somali_higaad_is_global,
               test_middle_chinese_is_a_lookup_not_a_guess,
               test_regulated_verse_rhymes,
               test_welsh_digraphs_are_single_consonants,
               test_welsh_cynghanedd,
               test_welsh_accentuation_classes,
               test_welsh_proclitics_are_unstressed,
               test_welsh_rhyme_anchor_is_counted_from_the_word_end,
               test_welsh_mutation_does_not_reach_the_rime,
               test_welsh_rhyme_against_the_tradition,
               test_welsh_rhyme_leaves_cynghanedd_alone,
               test_check_cynghanedd_defaults_to_welsh,
               test_the_scan_reads_the_caesura_it_was_given,
               test_the_mark_set_is_a_declared_coordinate,
               test_every_module_declares_itself,
               test_no_module_consults_english):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all phonology regressions pass")

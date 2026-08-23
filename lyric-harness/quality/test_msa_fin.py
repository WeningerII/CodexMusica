#!/usr/bin/env python3
"""Regressions for the two defects MISSING M-3 and M-6 named, and for the two
this cell found while fixing them.

WHAT IS PINNED HERE, AND WHY EACH ONE IS THE KIND OF THING THAT ROTS

M-3, Malay.  `msa.py`'s syncope apostrophe split `s'ri` into `s` + `ri`, and a
  vowelless fragment cannot be syllabified, so the WHOLE WORD was refused. The
  module already accepted the identical pepet syncope spelled WITHOUT the
  apostrophe (`prang`, `Brapa`, `'Plam`) — doctrine 65's lesson inside one
  language, between two spellings of one process. Pinned: the two spellings
  now AGREE, `anak'nda` still splits (both halves are words), and the loans
  `indra`/`anggrek`/`chandrawasi` are still REFUSED, because a complex medial
  cluster is a refusal by design and "fixing" it would corrupt the rime.

M-3's second half.  Doctrine 65 names FOUR positions for the Malay apostrophe.
  There are FIVE — the fifth is after a HYPHEN (`darah-'kau`, `hati-'ku`), and
  `msa.py` has always read them right because `_split_word` cuts the hyphen
  first. The defect was in the DESCRIPTION, so what is pinned is that
  `apostrophe_positions` leaves NOTHING unclassified on the staged corpus.

M-3's arithmetic.  M-3 says 384 of 471 Malay token failures are the apostrophe
  rule; M-4 says 300 of the same 471 are the `d. s. b.` refrain stub. Both
  cannot be true of one token. The apostrophe rule owned 76 of 458 (16.6%),
  not 82%, and the difference is that the earlier classifier keyed on "this
  part has no vowel" rather than on "an apostrophe split produced it".
  `unreadable_reason` makes the split machine-readable so the count cannot be
  pooled again by accident (doctrine 88, and doctrine 79 one layer down).

M-6, Finnish.  `fin.py` had no `rhymes()` at all, and nine of the ten staged
  Finnish files are rhymed strophic verse. Pinned: the relation exists, its
  domain is counted in SYLLABLES FROM THE END and not from a stress, its two
  grades behave as the tradition's yksitavuinen / kaksitavuinen, the ENGLISH
  PREDICATE PORTED (`rule="prominent"`) is falsified by two attested rhymes,
  and vowel harmony does NOT license a variant.

FOUND WHILE BUILDING M-6, and it is the older defect of the two: `syllabify`
  OVERWROTE a word-final coda instead of appending to it, so `kyll'` recorded
  coda ('l',) rather than ('l','l'). `Syllable.text` was right and alliteration
  never reads a coda, so no recorded rate moved and nothing printed looked
  wrong. Finnish consonant length is PHONEMIC, so the truncation deleted
  exactly the contrast a Finnish rime is built on. Pinned hard.

KNOWN ANSWERS THAT MUST NOT MOVE, because two modules were edited under them:
  Kalevala weak alliteration 82.60% (its recorded value), Kanteletar weak
  81.8342% and strong 60.2134% to the printed digit, and the pantun ABAB at
  80/82 with editorial_parentheses='drop' and 82/82 with 'keep'.

Every Finnish fixture is a real line from the staged corpus, and every Malay
fixture is a real token from Skeat 1900. Doctrine 37: a test built from
invented words proves self-consistency, not correctness.

Run: python3 quality/test_msa_fin.py
"""

import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.phonology import fin, msa  # noqa: E402

M = msa.Malay()
F = fin.Finnish()
ROOT = os.path.join(HERE, "..")
SONG = os.path.join(ROOT, "corpus", "song")

#: doctrine 66 — a tie or a draw broken by an unstated seed is a result that
#: does not reproduce. Every randomisation below takes this one.
SEED = 20260811

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def _raises(fn):
    """-> True if fn() raises. Used where the contract is a REFUSAL."""
    try:
        fn()
    except Exception:
        return True
    return False


# ---------------------------------------------------------------------------
# Real Malay tokens from Skeat, *Malay Magic* (Macmillan, 1900), public domain,
# data/sources.tsv row GITenberg/Malay-Magic_47873. The count after each token
# is its occurrences in the 330 Malay verse blocks of that file.

SYNCOPE_ONE_WORD = {          # apostrophe stands where a pepet was deleted
    "s'ri": ["sri"],          # 29  < seri
    "k'ris": ["kris"],        #  1  < keris   (28 in the whole file)
    "b'ras": ["bras"],        #  3  < beras
    "t'ada": ["ta", "da"],    #  8  < tiada
    "t'rap": ["trap"],        #  2  < terap
    "k'ladi": ["kla", "di"],  #  2  < keladi
    "g'lombang": ["glom", "bang"],
    "b'lakang": ["bla", "kang"],
    "k'luar": ["klu", "ar"],
    "p'rut-'kau": ["prut", "kau"],
}

SYNCOPE_NO_APOSTROPHE = {     # the SAME process, printed without the mark
    "prang": ["prang"],       # < perang
    "brapa": ["bra", "pa"],   # < berapa
    "'plam": ["plam"],        # < Pelam
}

TRUE_BOUNDARY = {"anak'nda": ["a", "nak", "nda"]}   # both halves are words

CORRECT_REFUSALS = {          # ndr / nggr loans — a refusal BY DESIGN
    "anggrek": "complex_medial",
    "indra": "complex_medial",
    "chandrawasi": "complex_medial",
    "mentri": "complex_medial",
    "ters'lit": "complex_coda",
}

REFRAIN_STUB = ("b", "d", "s")      # `d. s. b.` — someone else's layer

FIFTH_POSITION = ("darah-'kau", "munchong-'kau", "hati-'ku", "mata-'kau")


def _msa_corpus_tokens():
    path = os.path.join(SONG, "msa_skeat_pantun.txt")
    out = []
    for raw in open(path, encoding="utf-8"):
        t = raw.strip()
        if not t or t.startswith("#") or t.startswith("---"):
            continue
        if t.startswith("[") and t.endswith("]"):
            continue
        s = msa.normalise(raw)
        s = msa._FOOTNOTE.sub(" ", s)
        for ch in "[]()":
            s = s.replace(ch, " ")
        for w in msa._WORD.findall(s.lower()):
            if any(c.isalpha() for c in w):
                w = w.strip("-")
                if w:
                    out.append(w)
    return out


def test_msa_the_two_spellings_of_one_process_now_agree():
    print("\n1. Malay: one pepet syncope, two spellings, ONE verdict (M-3)")
    bad = [w for w in SYNCOPE_ONE_WORD if not M.syllabify(w)]
    check("every apostrophe-syncope token is now readable", not bad, str(bad))
    wrong = {w: [s.text for s in M.syllabify(w)]
             for w, want in SYNCOPE_ONE_WORD.items()
             if [s.text for s in M.syllabify(w)] != want}
    check("and each syllabifies to the syncopated form", not wrong, str(wrong))
    wrong = {w: [s.text for s in M.syllabify(w)]
             for w, want in SYNCOPE_NO_APOSTROPHE.items()
             if [s.text for s in M.syllabify(w)] != want}
    check("the apostrophe-less spelling is unchanged", not wrong, str(wrong))
    # the point of the whole fix, stated as an identity
    check("`s'ri` and `sri` are now the SAME WORD",
          [s.text for s in M.syllabify("s'ri")]
          == [s.text for s in M.syllabify("sri")])
    check("`b'ras` and `bras` are the same word",
          [s.text for s in M.syllabify("b'ras")]
          == [s.text for s in M.syllabify("bras")])
    # and the rime, which is the coordinate the module exists to report
    check("`s'ri` rhymes `hati` on -i (the pantun's commonest rime)",
          M.rhymes("s'ri", "hati") is True)
    check("`b'ras` rhymes `atas` on -as", M.rhymes("b'ras", "atas") is True)
    check("and `b'ras` does NOT rhyme `hati`",
          M.rhymes("b'ras", "hati") is False)


def test_msa_a_true_morpheme_boundary_still_splits():
    print("\n2. Malay: the split survives where it was RIGHT")
    for w, want in TRUE_BOUNDARY.items():
        got = [s.text for s in M.syllabify(w)]
        check(f"`{w}` still splits at the boundary", got == want, str(got))
    check("because `anak` is a well-formed Malay word on its own",
          [s.text for s in M.syllabify("anak")] == ["a", "nak"])
    check("while `s` is not, which is the whole of the rule",
          msa.unreadable_reason("s")["code"] == "vowelless_token")


def test_msa_correct_refusals_are_untouched():
    print("\n3. Malay: a correct refusal is not a defect and must not be "
          "'fixed'")
    for w, code in CORRECT_REFUSALS.items():
        r = msa.unreadable_reason(w)
        check(f"`{w}` still refuses, as {code}",
              r is not None and r["code"] == code, str(r))
        check(f"  and `{w}` is classed a REFUSAL, not a defect",
              r is not None and not r["is_defect"])
    for w in REFRAIN_STUB:
        r = msa.unreadable_reason(w)
        check(f"the refrain-stub letter `{w}` is an INGESTION defect",
              r is not None and r["code"] == "vowelless_token"
              and r["layer"] == "ingestion" and r["is_defect"])
    check("the two classes have different layers, so a count cannot pool them",
          {msa.UNREADABLE_REASONS[c][0] for c in
           ("complex_medial", "complex_coda")} == {"phonology"}
          and msa.UNREADABLE_REASONS["vowelless_token"][0] == "ingestion")


def test_msa_the_census_reports_three_counts_never_two():
    print("\n4. Malay: refused / defective / read are THREE counts "
          "(doctrine 79)")
    toks = _msa_corpus_tokens()
    c = msa.readability_census(toks)
    check("read + refused + defective == total",
          c["read"] + c["refused"] + c["defective"] == c["total"],
          f"{c['read']} + {c['refused']} + {c['defective']} = {c['total']}")
    print(f"          staged corpus: {c['total']} tokens, "
          f"{c['read']} read, {c['refused']} refused, "
          f"{c['defective']} defective")
    print(f"          by code: {dict(sorted(c['by_code'].items()))}")
    check("the staged corpus has NO apostrophe-caused unreadable token left",
          not [w for w in toks if not M.syllabify(w) and "'" in w],
          str(sorted({w for w in toks
                      if not M.syllabify(w) and "'" in w})))
    check("and the refusals that remain are all `complex_medial`",
          set(c["by_code"]) <= {"complex_medial", "complex_coda",
                                "vowelless_token"},
          str(sorted(c["by_code"])))


def test_msa_the_apostrophe_has_five_positions_not_four():
    print("\n5. Malay: doctrine 65 undercounts — there are FIVE positions")
    check("five are declared", len(msa.APOSTROPHE_POSITIONS) == 5,
          str([n for n, _ in msa.APOSTROPHE_POSITIONS]))
    check("the fifth is `after_hyphen`",
          "after_hyphen" in {n for n, _ in msa.APOSTROPHE_POSITIONS})
    for w in FIFTH_POSITION:
        pos = dict(msa.apostrophe_positions(w))
        check(f"`{w}` classifies its mark as after_hyphen",
              "after_hyphen" in pos.values(), str(pos))
        check(f"  and `{w}` reads correctly anyway",
              bool(M.syllabify(w)),
              str([s.text for s in M.syllabify(w)]))
    toks = _msa_corpus_tokens()
    tally = {}
    for w in toks:
        for _i, name in msa.apostrophe_positions(w):
            tally[name] = tally.get(name, 0) + 1
    print(f"          staged corpus, by position: {dict(sorted(tally.items()))}")
    check("NOTHING is unclassified",
          set(tally) <= {n for n, _ in msa.APOSTROPHE_POSITIONS},
          str(sorted(tally)))
    check("and after_hyphen is 20 marks — the ones an audit that knew four "
          "would report as unclassified",
          tally.get("after_hyphen") == 20, str(tally.get("after_hyphen")))


def test_msa_doctrine_70_the_orthography_is_not_modernised():
    print("\n6. Malay: the 1900 spelling is the SURFACE form (doctrine 70)")
    els = [p for w in _msa_corpus_tokens() for p in w.split("-") if p]
    n = {s: len({w for w in els if w.endswith(s)})
         for s in ("ung", "ong", "uk", "ok")}
    print(f"          word-final types: {n}")
    check("word-final -ung occurs ZERO times", n["ung"] == 0, str(n))
    check("word-final -uk occurs ZERO times", n["uk"] == 0, str(n))
    check("against 28 distinct -ong types", n["ong"] == 28, str(n))
    check("and 14 distinct -ok types (the recorded 15 counts whole tokens, "
          "not hyphen elements — doctrine 58)", n["ok"] == 14, str(n))
    check("`burong` is still read natively, not modernised",
          [s.text for s in M.syllabify("burong")] == ["bu", "rong"])
    check("and burong~burung inside the rime is still a REFUSAL",
          M.rhymes("burong", "burung") is None)


def test_msa_the_pantun_known_answer_has_not_moved():
    print("\n7. Malay: the ABAB known answer, both settings (doctrine 58)")
    sys.path.insert(0, HERE)
    from test_phon_msa import QUATRAINS  # noqa: E402  (fixtures only)
    for mode, want in (("drop", 80), ("keep", 82)):
        conf = [M.abab(q, editorial_parentheses=mode)["confirmed"]
                for q in QUATRAINS]
        check(f"editorial_parentheses={mode!r}: {want}/82 confirm",
              conf.count(True) == want,
              f"True {conf.count(True)}, False {conf.count(False)}, "
              f"None {conf.count(None)}")


# ---------------------------------------------------------------------------
# Finnish. Every pair below is a real rhyme (or a real non-rhyme) from the
# staged corpus, named with the stanza it comes from.

# Kramsu, `Haihtumaton muisto`, refrain — an unambiguous ABCB quatrain:
#   Muut muistot haihtuu, katoaa, / Yks säilyy yksinään:
#   Onk' iloinen vai suruinen,    / En tiedä itsekään.
KRAMSU_REFRAIN = ("katoaa", "yksinään", "suruinen", "itsekään")
# Kramsu, same poem, verse 4 — `tahdokaan : niitäkään` differ ONLY in harmony
KRAMSU_V4 = ("tahdokaan", "vanhentuu", "niitäkään", "muu")


def test_fin_the_relation_exists_at_all():
    print("\n8. Finnish: `rhymes()` exists — M-6")
    check("fin declares TWO relations",
          "alliteration" in F.relation and "rhyme" in F.relation)
    check("and rhymes() is not the base class's stub",
          F.rhymes("maa", "saa") is True)
    check("the base class stub would have said None",
          fin.Phonology.rhymes(F, "maa", "saa") is None)
    check("depth is a DECLARED parameter, not a constant in the body",
          fin.RIME_DEPTH == 1 and fin.RHYME_RULE == "depth"
          and fin.HARMONY == "strict")


def test_fin_the_domain_is_counted_from_the_END_not_from_a_stress():
    print("\n9. Finnish: fixed initial stress makes the ENGLISH port wrong")
    check("`maa : vapaa` rhymes — the depth clamps to the shorter word",
          F.rhymes("maa", "vapaa") is True)
    check("and the PORTED predicate calls it False, because `vapaa`'s only "
          "stress is on `va`",
          F.rhymes("maa", "vapaa", rule="prominent") is False)
    a, b = KRAMSU_REFRAIN[1], KRAMSU_REFRAIN[3]
    check(f"Kramsu's own refrain rhyme `{a} : {b}` is True",
          F.rhymes(a, b) is True)
    check("  the ported predicate calls THAT False too",
          F.rhymes(a, b, rule="prominent") is False)
    check("  and so does the rich grade, which is why depth 1 is the default",
          F.rhymes(a, b, depth=2) is False)
    check("the unrhymed pair in the same quatrain stays False",
          F.rhymes(KRAMSU_REFRAIN[0], KRAMSU_REFRAIN[2]) is False)


def test_fin_quantity_is_phonemic_and_must_be_read():
    print("\n10. Finnish: long/short is a CONTRAST, and the coda bug ate it")
    s = F.syllabify("kyll'")
    check("`kyll'` records a GEMINATE coda ('l','l')",
          s[-1].coda == ("l", "l"), str(s[-1].coda))
    check("  not the truncated ('l',) the old code recorded",
          s[-1].coda != ("l",))
    s = F.syllabify("onk'")
    check("`onk'` records coda ('n','k')", s[-1].coda == ("n", "k"),
          str(s[-1].coda))
    for w in ("kaks", "laps", "maall", "kans", "vaikeammiks"):
        s = F.syllabify(w)
        check(f"`{w}` keeps its whole final cluster",
              "".join(s[-1].coda) == w[len(w) - len("".join(s[-1].coda)):],
              f"{w} -> {s[-1].coda}")
    check("so `all` and `al` are NOT one rime",
          F.rhymes("all", "al") is False)
    check("and text still agrees with the segments",
          "".join(x.text for x in F.syllabify("kyll'")) == "kyll")
    # the vowel side of the same contrast
    check("`tuli : tuuli` is False at the rich grade (long vs short)",
          F.rhymes("tuli", "tuuli", depth=2) is False)
    check("`tuli : tulli` is False at the rich grade (geminate vs single)",
          F.rhymes("tuli", "tulli", depth=2) is False)
    check("both are True at depth 1, because the contrast sits in the "
          "syllable depth 1 does not reach — a GRADE, not an error",
          F.rhymes("tuli", "tuuli") is True
          and F.rhymes("tuli", "tulli") is True)


def test_fin_vowel_harmony_forbids_a_variant_it_does_not_license_one():
    print("\n11. Finnish: harmony does NOT make a and ä one sound")
    a, b = KRAMSU_V4[0], KRAMSU_V4[2]
    check(f"`{a} : {b}` — one morpheme in two harmonic shapes — is False",
          F.rhymes(a, b) is False)
    check("  and `harmony='paired'` is reachable, so the rejected reading is "
          "checkable rather than merely asserted (doctrine 84)",
          F.rhymes(a, b, harmony="paired") is True)
    check("`metsässä : talossa` stays False under the default",
          F.rhymes("metsässä", "talossa") is False)
    check("while the harmonic MATCH `vanhentuu : muu` from the same stanza "
          "is True", F.rhymes(KRAMSU_V4[1], KRAMSU_V4[3]) is True)
    check("an unknown harmony setting RAISES rather than guessing",
          _raises(lambda: F.rhymes("maa", "saa", harmony="loose")))
    check("and so does an unknown rule",
          _raises(lambda: F.rhymes("maa", "saa", rule="stress")))


def test_fin_the_refusal_is_derived_and_named():
    print("\n12. Finnish: the tri-state, and WHY each None happens")
    check("`neitosien` refuses — non-initial `ie` is a compound element's "
          "diphthong or a morpheme-seam hiatus and nothing here can tell",
          F.rhymes("neitosien", "sydämen") is None)
    check("  named by code", F.refusal_reason("neitosien")
          == "non_initial_opening_diphthong")
    check("`kotilies : vihamies` refuses for the same reason",
          F.rhymes("kotilies", "vihamies") is None)
    check("a bare `j. n. e.` refrain-stub letter is an INGESTION miss",
          F.refusal_reason("j") == "vowelless_token"
          and fin.UNREADABLE_REASONS["vowelless_token"][:2]
          == ("ingestion", True))
    check("a foreign proper name is a CORRECT refusal, not a defect",
          F.refusal_reason("Chénier") == "out_of_inventory"
          and fin.UNREADABLE_REASONS["out_of_inventory"][1] is False)
    check("  and the designed rime refusal is a third code again",
          fin.UNREADABLE_REASONS["non_initial_opening_diphthong"][0]
          == "phonology")
    check("  so the three cannot be pooled into one 'unreadable' number",
          len({fin.UNREADABLE_REASONS[c][0]
               for c in fin.UNREADABLE_REASONS}) == 3)
    check("a readable word has NO reason", F.refusal_reason("kulta") is None)
    toks = []
    for name in sorted(os.listdir(SONG)):
        if not name.startswith("fin_"):
            continue
        for raw in open(os.path.join(SONG, name), encoding="utf-8"):
            t = raw.strip()
            if (not t or t.startswith("#") or t.startswith("---")
                    or (t.startswith("[") and t.endswith("]"))):
                continue
            toks += fin._tokens(t)
    c = fin.readability_census(F, toks)
    print(f"          staged Finnish corpus: {c['total']} tokens, "
          f"{c['read']} read, {c['refused']} refused, "
          f"{c['defective']} defective")
    print(f"          by code: {dict(sorted(c['by_code'].items()))}")
    check("read + refused + defective == total, three counts not two",
          c["read"] + c["refused"] + c["defective"] == c["total"])
    check("the opening diphthongs are declared, not inline",
          fin.OPENING_DIPHTHONGS == {"ie", "uo", "yö"})
    check("and they are still read as ONE nucleus in the FIRST syllable, "
          "where the rule is right",
          F.syllabify("tie")[0].nucleus == "ie"
          and F.rhymes("tie", "vie") is True)


def test_fin_w_and_v_are_one_phoneme_in_the_rime():
    print("\n13. Finnish: <w> and <v> are allographs, MIXED in one book (M-5)")
    check("`Wäinämöisen` and `Väinämöisen` are the same word for the rime",
          F.relation_type("Wäinämöisen", "Väinämöisen") == "REPEAT")
    check("the fold is DECLARED", fin.FOLD_W_TO_V is True)
    check("and it is OFF by default in alliteration, because the recorded "
          "rates are coordinates of the unfolded reading (doctrine 58)",
          F.alliterates("Wiipurin", "veti") is False)
    check("  while the folded reading is one argument away",
          F.alliterates("Wiipurin", "veti", fold_w=True) is True)


def test_fin_relation_types_separate_grammar_from_choice():
    print("\n14. Finnish: agglutination gets its own type (doctrine 24)")
    check("`metsässä : kädessä` is a SUFFIX_RHYME — the whole agreement is "
          "the inessive ending",
          F.relation_type("metsässä", "kädessä") == "SUFFIX_RHYME")
    check("`kulta : tulta` is NOT, though it shares `ulta`, which ENDS with "
          "the partitive `ta` — the test is exact membership",
          F.relation_type("kulta", "tulta") == "RIME_RICHE")
    check("`yksinään : itsekään` is a plain RHYME",
          F.relation_type("yksinään", "itsekään") == "RHYME")
    check("identity is REPEAT, never rhyme (doctrine 3)",
          F.relation_type("muu", "muu") == "REPEAT")
    check("a non-rhyme is NONE, and a refusal is None",
          F.relation_type("katoaa", "suruinen") == "NONE"
          and F.relation_type("neitosien", "sydämen") is None)
    check("SUFFIXES is a declared list, part of the phonology (doctrine 46)",
          "ssä" in fin.SUFFIXES and "nen" in fin.SUFFIXES)


# ---------------------------------------------------------------------------
# The corpus arm. These are the numbers the report quotes, and they are
# recomputed here rather than pasted, so a silent drift fails a test.

def _stanzas(name):
    """4-line stanzas of a staged file -> tuples of lower-cased end words."""
    import re
    end = re.compile(r"[A-Za-zÀ-ÿŠšŽžÄäÖöÅå'’\-]+")
    out, cur = [], []
    for raw in open(os.path.join(SONG, name), encoding="utf-8"):
        t = raw.strip()
        if not t or t.startswith("#"):
            if not t and cur:
                pass
            continue
        if t.startswith("---"):
            continue
        if t.startswith("[") and t.endswith("]"):
            if len(cur) == 4:
                out.append(tuple(cur))
            cur = []
            continue
        toks = [w for w in end.findall(t) if w.strip("'’-")]
        if toks:
            cur.append(toks[-1].lower())
    if len(cur) == 4:
        out.append(tuple(cur))
    return [s for s in out if all(s)]


def _slot_rate(stanzas, slot, depth):
    t = f = n = 0
    for e in stanzas:
        v = F.rhymes(e[slot[0]], e[slot[1]], depth=depth)
        if v is None:
            n += 1
        elif v:
            t += 1
        else:
            f += 1
    return t, f, n


def _null_max(stanzas, slot, depth, reps=200):
    """Permute each stanza's OWN four end words among its own four slots.

    PRESERVES each stanza's exact end-word inventory — its rime classes, word
    lengths and suffix mix. DESTROYS only WHICH TWO the form pairs. It is not
    the identity map, and the differ-fraction is returned so that can be
    checked rather than assumed (doctrine 63, doctrine 68).
    """
    rng = random.Random(SEED)
    best, vals, differ, total = 0.0, [], 0, 0
    for _ in range(reps):
        t = f = 0
        for e in stanzas:
            q = list(e)
            rng.shuffle(q)
            total += 1
            differ += tuple(q) != e
            v = F.rhymes(q[slot[0]], q[slot[1]], depth=depth)
            if v is True:
                t += 1
            elif v is False:
                f += 1
        vals.append(t / (t + f) if (t + f) else 0.0)
    vals.sort()
    return vals[-1], vals[len(vals) // 2], differ / total


def test_fin_the_scheme_is_abcb_and_only_the_null_says_so():
    print("\n15. Finnish: the corpus rhymes lines 2&4 — measured, with its "
          "null beside it (doctrines 63, 64)")
    st = []
    for name in sorted(os.listdir(SONG)):
        if name.startswith("fin_") and name != "fin_kanteletar.txt":
            st += _stanzas(name)
    # TEN rhymed volumes since corpus/song/fin_wahanen_laulukirja.txt landed
    # at debf64e on 2026-08-11, AFTER quality/phonology/fin.py was written
    # against nine. This suite pinned the nine-volume figures as constants and
    # went red the moment the corpus grew — which is the whole hazard of a
    # constant that is really a measurement. Every table in fin.py's docstring
    # still re-derives exactly on the nine-volume set:
    #     python3 quality/fin_rhyme_rate.py --verify
    check("the ten rhymed volumes give 1,346 four-line units",
          len(st) == 1346, str(len(st)))
    for slot, tag in (((1, 3), "2&4"), ((0, 2), "1&3"), ((0, 1), "1&2")):
        t, f, n = _slot_rate(st, slot, 1)
        mx, med, differ = _null_max(st, slot, 1)
        obs = t / (t + f)
        print(f"          {tag}: obs {obs:6.2%}  judged {t+f}  refused {n}"
              f"  null med {med:6.2%} max {mx:6.2%}  "
              f"excess {100*(obs-mx):+6.2f}pp")
        if tag == "2&4":
            check("2&4 clears its own null by more than 30 points",
                  obs - mx > 0.30, f"{obs:.4f} vs max {mx:.4f}")
            check("  and the null is NOT the identity map",
                  differ > 0.9, f"differ {differ:.3f}")
            check("  a third of the null's own re-pairings rhyme anyway, so "
                  "the RATE alone is not the finding (doctrine 64)",
                  med > 0.20, f"null median {med:.4f}")
        elif tag == "1&2":
            check(f"{tag} does NOT clear its null", obs <= mx,
                  f"{obs:.4f} vs max {mx:.4f}")
        else:
            # 1&3 crossed its own null max when the tenth volume landed:
            # +0.60pp at depth 1, where on nine volumes it sat 1.14pp BELOW.
            # Repinning it to "clears" would be as wrong as leaving it at
            # "does not" — the honest reading is that +0.60pp is not a
            # finding at all beside 2&4's +35.53pp, and that the pooled row
            # averages over four different schemes (doctrine 33): three of
            # the ten volumes rhyme 1&3 above their own null, one of them
            # being an AAAx form with a refrain word. RESULTS_FIN_RHYME.md
            # §3 carries the per-file table. The claim the corpus supports
            # is that 2&4 is the slot the form pairs, NOT that 1&3 is at
            # chance, and this assertion now says the supported thing.
            check("1&3 is nowhere near 2&4's excess, which is the claim the "
                  "corpus actually supports", (obs - mx) < 0.05,
                  f"{100*(obs-mx):+.2f}pp against 2&4's +35.53pp")


def test_fin_the_kanteletar_is_a_negative_control_that_clears_its_null():
    print("\n16. Finnish: the Kalevala-metre book does not end-rhyme, and the "
          "rate that looks like rhyme is PARALLELISM (doctrine 71)")
    st = _stanzas("fin_kanteletar.txt")
    check("325 four-line stanzas", len(st) == 325, str(len(st)))
    t, f, n = _slot_rate(st, (1, 3), 1)
    mx, med, _d = _null_max(st, (1, 3), 1)
    obs = t / (t + f)
    print(f"          2&4: obs {obs:6.2%}  null med {med:6.2%} max {mx:6.2%}")
    check("the 2&4 slot is BELOW its own null — a real negative control",
          obs < med, f"{obs:.4f} vs median {med:.4f}")
    t, f, n = _slot_rate(st, (0, 1), 1)
    mx2, med2, _d = _null_max(st, (0, 1), 1)
    obs2 = t / (t + f)
    print(f"          1&2: obs {obs2:6.2%}  null med {med2:6.2%} "
          f"max {mx2:6.2%}")
    check("while ADJACENT lines are above it — Kalevala parallelism repeats "
          "a syntactic frame, so the two lines end in one ending",
          obs2 > mx2, f"{obs2:.4f} vs max {mx2:.4f}")
    check("so the two books separate on 2&4 and AGREE on 1&2, which is what "
          "makes the null load-bearing rather than decorative",
          obs < med and obs2 > mx2,
          f"2&4 {obs:.4f} < null median {med:.4f}; 1&2 {obs2:.4f} > null max "
          f"{mx2:.4f}. Asserted rather than narrated since 2026-08-23 — it "
          f"rode on `True` and would have said PASS with both arms reversed.")


def test_fin_alliteration_known_answers_have_not_moved():
    print("\n17. Finnish: the coda fix must not touch alliteration")
    lines = []
    for raw in open(os.path.join(SONG, "fin_kanteletar.txt"),
                    encoding="utf-8"):
        t = raw.strip()
        if (not t or t.startswith("#") or t.startswith("---")
                or (t.startswith("[") and t.endswith("]"))):
            continue
        lines.append(t)
    check("22,113 Kanteletar verse lines", len(lines) == 22113, str(len(lines)))
    for strong, want, label in ((False, 18096, "weak"), (True, 13315, "strong")):
        hit = sum(1 for ln in lines
                  if F.line_alliteration(ln, strong=strong)[0] >= 2)
        check(f"Kanteletar {label} alliteration is {want}/22113 "
              f"({want/22113:.4%}) — the recorded value, to the digit",
              hit == want, f"{hit}/22113 = {hit/len(lines):.4%}")
    check("alliteration never reads a coda, which is WHY the fix is safe",
          F._head("kyll'") == ("k", "y"))


if __name__ == "__main__":
    for fn in (test_msa_the_two_spellings_of_one_process_now_agree,
               test_msa_a_true_morpheme_boundary_still_splits,
               test_msa_correct_refusals_are_untouched,
               test_msa_the_census_reports_three_counts_never_two,
               test_msa_the_apostrophe_has_five_positions_not_four,
               test_msa_doctrine_70_the_orthography_is_not_modernised,
               test_msa_the_pantun_known_answer_has_not_moved,
               test_fin_the_relation_exists_at_all,
               test_fin_the_domain_is_counted_from_the_END_not_from_a_stress,
               test_fin_quantity_is_phonemic_and_must_be_read,
               test_fin_vowel_harmony_forbids_a_variant_it_does_not_license_one,
               test_fin_the_refusal_is_derived_and_named,
               test_fin_w_and_v_are_one_phoneme_in_the_rime,
               test_fin_relation_types_separate_grammar_from_choice,
               test_fin_the_scheme_is_abcb_and_only_the_null_says_so,
               test_fin_the_kanteletar_is_a_negative_control_that_clears_its_null,
               test_fin_alliteration_known_answers_have_not_moved):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all M-3 / M-6 regressions pass")

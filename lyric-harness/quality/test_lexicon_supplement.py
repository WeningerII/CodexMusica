#!/usr/bin/env python3
"""Regressions for THE REVIEWED LEXICON SUPPLEMENT (quality/lexicon_supplement.py).

The supplement adds readings CMUdict lacks, and the promise that makes it safe
is what it does NOT touch: `Lexicon()` is unchanged, derivation reads CMUdict
alone, and every reading says where it came from. Each section below would fail
if one of those promises broke, and the contract sections plant the defect
they refuse so the refusal is proved alive rather than assumed.

Sections:
  1  the shipped file keeps its contract, and its rule rows re-derive
  2  the contract refuses what it says it refuses (each planted, each named)
  3  `Lexicon()` is untouched; inside the coordinate CMUdict comes first
  4  derivation reads CMUdict alone: stems, `_KNOWN_WORDS`, the g2p fallback
  5  whole before piece, and a word with no whole entry splits as before
  6  the adversarial witnesses read exactly as CMUdict reads them
  7  every reading names its source; a supplement reading is never `cmudict`
  8  every lexicon identity that reads the file moves with its bytes
  9  the CLI coordinate: declared, disclosed, refused when misspelled
 10  the file keys what the tokenizer keeps: edge apostrophes, accents
 11  the coordinate survives the consumers that build their own readers
 12  versions: a run names a frozen file, keeps its bytes, and never moves
"""

import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)

import lyric_harness as LH                                       # noqa: E402
from quality import lexicon_supplement as S                      # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


PLAIN = LH.Lexicon()
SUPP = S.SupplementedLexicon()
HEADER = "\t".join(S.COLUMNS)
GOOD = ("thirty-one\tTH ER1 D IY0 W AH2 N\trule:number-compound\tb\t"
        "rule-validated:number-compound")


def _write(lines):
    fd, path = tempfile.mkstemp(suffix=".tsv")
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    return path


def _refusal(lines):
    path = _write(lines)
    try:
        S.load_rows(path)
        return None
    except S.SupplementError as error:
        return str(error)
    finally:
        os.remove(path)


def test_shipped_file():
    print("\n1. the shipped file keeps its contract, and its rule rows re-derive")
    rows = S.load_rows()
    check("the shipped supplement loads under its contract", len(rows) > 0,
          f"{len(rows)} readings")
    check("every rule row re-derives from CMUdict and nothing repeats a "
          "CMUdict reading", S.check_rows(rows, PLAIN.entries) == [],
          "; ".join(S.check_rows(rows, PLAIN.entries)[:3]))
    words = {r["word"] for r in rows if r["source"] == "rule:number-compound"}
    check("the number batch is exactly the 64 cardinals and 71 ordinals CMUdict "
          "lacks", len(words) == 135, f"{len(words)} words")
    matched, differ = S.number_rule_audit(PLAIN.entries)
    check("the rule reproduces 8 of CMUdict's 9 attested compounds, and the "
          "one it does not is CMUdict's own twenty-one",
          matched == 8 and [d[0] for d in differ] == ["twenty-one"],
          f"{matched} match, differ {[d[0] for d in differ]}")
    check("`--check` exits 0 on the shipped file", S.main(["--check"]) == 0)


def test_contract_refusals():
    print("\n2. the contract refuses what it says it refuses (each planted, each named)")
    check("the planted rows' well-formed twin loads (so each refusal below is "
          "the planted defect, not the scaffold)", _refusal([HEADER, GOOD]) is None)
    cases = {
        "an unreviewed candidate (it belongs in the queue)":
            GOOD.replace("rule-validated:number-compound", "queued"),
        "an undeclared source": GOOD.replace("rule:number-compound", "wiktionary"),
        "a phone outside CMUdict's set": GOOD.replace("AH2", "AX2"),
        "a vowel without its stress digit": GOOD.replace("AH2", "AH"),
        "a reading with no primary stress": GOOD.replace("ER1", "ER2"),
        "a capitalised word": GOOD.replace("thirty-one", "Thirty-one"),
        "a word with a space": GOOD.replace("thirty-one", "thirty one"),
        "an empty basis": GOOD.replace("\tb\t", "\t\t"),
    }
    for name, line in cases.items():
        why = _refusal([HEADER, line])
        check(f"refuses {name}", why is not None, why or "LOADED")
    check("refuses a duplicate reading", _refusal([HEADER, GOOD, GOOD]) is not None)
    later = GOOD.replace("thirty-one", "zz-top")
    check("refuses rows out of word order", _refusal([HEADER, later, GOOD]) is not None)
    check("refuses a missing header", _refusal([GOOD]) is not None)
    path = _write([HEADER, "record\tR AH0 K AO1 R D\trule:number-compound\tb\t"
                   "rule-validated:number-compound"])
    try:
        problems = S.check_rows(S.load_rows(path), PLAIN.entries)
    finally:
        os.remove(path)
    check("refuses a row that repeats a CMUdict reading",
          any("repeats a CMUdict reading" in p for p in problems), str(problems[:1]))


def test_plain_lexicon_untouched():
    print("\n3. `Lexicon()` is untouched; inside the coordinate CMUdict comes first")
    added = [k for k in SUPP.entries if k not in PLAIN.entries]
    check("`Lexicon()` holds none of the supplement's words",
          not any(r["word"] in PLAIN.entries
                  for r in S.load_rows() if r["word"] not in SUPP.cmu_entries))
    check("inside the coordinate, CMUdict's words come first, in CMUdict's order",
          list(SUPP.entries)[:len(PLAIN.entries)] == list(PLAIN.entries))
    check("and every CMUdict word keeps exactly CMUdict's readings",
          all(SUPP.entries[k] == PLAIN.entries[k] for k in PLAIN.entries))
    check("the supplement's new words follow, all of them", len(added) == 135,
          f"{len(added)} added")
    check("`cmu_entries` is the dictionary `Lexicon()` builds",
          SUPP.cmu_entries == PLAIN.entries)
    # A reading added to a CMUdict word (no shipped row does this yet, which is
    # why this is planted): it follows CMUdict's readings, and CMUdict's own
    # list -- the one derivation reads -- is not written into.
    with open(S.SUPPLEMENT_PATH, encoding="utf-8") as fh:
        lines = fh.read().splitlines()
    extra = "record\tR EH1 K AO2 R D\ttest:fixture\tplanted\treviewed:test:2026-10-10"
    body = sorted([l for l in lines if l and not l.startswith("#") and l != HEADER]
                  + [extra], key=lambda l: l.split("\t", 1)[0])
    path = _write([HEADER] + body)
    S.SOURCES["test:fixture"] = "planted by this suite"
    try:
        fixture = S.SupplementedLexicon(supplement_path=path)
    finally:
        del S.SOURCES["test:fixture"]
        os.remove(path)
    check("a supplement reading on a CMUdict word comes after CMUdict's readings",
          fixture.entries["record"] == PLAIN.entries["record"]
          + [["R", "EH1", "K", "AO2", "R", "D"]], str(fixture.entries["record"]))
    check("and CMUdict's own list is not written into",
          fixture.cmu_entries["record"] == PLAIN.entries["record"]
          and fixture.cmu_entries["record"] is not fixture.entries["record"])
    check("its first reading is still CMUdict's",
          fixture.transcribe_word("record") == PLAIN.transcribe_word("record"))
    check("and it says where it came from",
          fixture.reading_source("record", ["R", "EH1", "K", "AO2", "R", "D"])
          == "test:fixture")


def test_derivation_reads_cmudict_alone():
    print("\n4. derivation reads CMUdict alone: stems, `_KNOWN_WORDS`, the g2p fallback")
    check("`_KNOWN_WORDS` (the shared_ending stem test) holds no supplement word",
          "thirty-one" not in LH._KNOWN_WORDS and "thirty" in LH._KNOWN_WORDS)
    check("a supplement word reads", SUPP.transcribe_word("thirty-one")[1] is False)
    check("but is not a stem: its plural stays unread", SUPP.transcribe_word(
        "thirty-ones") == ([], True), str(SUPP.transcribe_word("thirty-ones")))
    check("while a CMUdict stem's plural still reads, so the stem rule itself "
          "is intact", SUPP.transcribe_word("moons")[1] is False)
    high = S.SupplementedLexicon(fallback="high")
    check("the g2p fallback holds CMUdict's own dictionary, not the merged one",
          high.g2p_fallback.lex.entries is high.cmu_entries
          and "thirty-one" not in high.g2p_fallback.lex.entries)


def test_whole_before_piece():
    print("\n5. whole before piece, and a word with no whole entry splits as before")
    check("a supplement compound is one word", SUPP.word_pieces("thirty-one")
          == ["thirty-one"])
    check("a CMUdict compound is one word too (e-mail, co-op)",
          SUPP.word_pieces("e-mail") == ["e-mail"]
          and SUPP.word_pieces("co-op") == ["co-op"])
    check("a hyphenated word with no whole entry splits exactly as `Lexicon` "
          "splits it", SUPP.word_pieces("hill-zide") == PLAIN.word_pieces("hill-zide")
          == ["hill", "zide"])
    p_plain, _, _ = PLAIN.transcribe("turned thirty-one")
    p_supp, _, _ = SUPP.transcribe("turned thirty-one")
    check("the whole entry's stress is the one read: thirty-ONE as CMUdict "
          "joins compounds, not two primaries",
          p_supp[-3:] == ["W", "AH2", "N"] and p_plain[-3:] == ["W", "AH1", "N"],
          f"plain {p_plain[-7:]} | supplement {p_supp[-7:]}")
    from quality.grid import rime_cmudict
    check("the whole-token rhyme key reads it where `Lexicon()` refused",
          rime_cmudict(PLAIN)("thirty-one") is None
          and rime_cmudict(SUPP)("thirty-one") == "AH N")


def test_witnesses():
    print("\n6. the adversarial witnesses read exactly as CMUdict reads them")
    for w in ("blackbird", "postman", "resign", "re-sign", "co-op", "coop",
              "wi-fi", "record", "e-mail", "email"):
        check(f"{w}: the supplement adds nothing and reorders nothing",
              SUPP.pronunciation_variants(w) == PLAIN.pronunciation_variants(w)
              and SUPP.transcribe_word(w) == PLAIN.transcribe_word(w))
    check("re-sign is not read as resign (no whole entry; it splits)",
          SUPP.word_pieces("re-sign") == ["re", "sign"])
    check("record keeps its first reading first",
          SUPP.pronunciation_variants("record")[0] == ["R", "AH0", "K", "AO1", "R", "D"])


def test_reading_sources():
    print("\n7. every reading names its source; a supplement reading is never `cmudict`")
    check("a CMUdict reading is `cmudict`",
          SUPP.reading_source("record", ["R", "EH1", "K", "ER0", "D"]) == "cmudict")
    phones = SUPP.transcribe_word("thirty-one")[0]
    check("a supplement reading names its own source",
          SUPP.reading_source("thirty-one", phones) == "rule:number-compound")
    check("case and the non-breaking hyphen fold to the same key",
          SUPP.reading_source("Thirty‑One", phones) == "rule:number-compound")
    check("a reading neither holds is None",
          SUPP.reading_source("thirty-one", ["W", "AH1", "N"]) is None)


def test_identities_move():
    print("\n8. every lexicon identity that reads the file moves with its bytes")
    from quality import field_store
    plain_id = field_store._lexicon_identity(PLAIN)
    supp_id = field_store._lexicon_identity(SUPP)
    check("the field store keys a supplemented lexicon apart from a plain one",
          plain_id != supp_id and "lexicon_supplement.tsv" in supp_id["resources"]
          and "lexicon_supplement.tsv" not in plain_id["resources"])
    tmp = tempfile.mkdtemp()
    try:
        copy = os.path.join(tmp, "lexicon_supplement.tsv")
        with open(S.SUPPLEMENT_PATH, encoding="utf-8") as fh:
            text = fh.read()
        with open(copy, "w", encoding="utf-8") as fh:
            fh.write(text.replace("# Reviewed lexicon", "# Reviewed  lexicon", 1))
        other = S.SupplementedLexicon(supplement_path=copy)
        check("one changed byte moves the field-store key",
              field_store._lexicon_identity(other) != supp_id)
        from quality.revise import Reviser
        keys = [Reviser(lex=lx)._decl_lex_key()[1] for lx in (PLAIN, SUPP, other)]
        check("and the reviser's memo key, three ways apart",
              len(set(keys)) == 3)
    finally:
        shutil.rmtree(tmp)


def test_tokenizer_keys():
    print("\n10. the file keys what the tokenizer keeps: edge apostrophes, accents")
    tokens = LH.line_tokens("wi' the lass 'neath his feäce")
    check("the tokenizer keeps edge apostrophes and accented letters",
          tokens == ["wi'", "the", "lass", "'neath", "his", "feäce"], str(tokens))
    for word in ("wi'", "'neath", "thro'", "roun'", "ev'ry", "feäce"):
        line = GOOD.replace("thirty-one", word)
        check(f"the contract accepts {word!r}", _refusal([HEADER, line]) is None,
              _refusal([HEADER, line]) or "")
    nfd = "feäce"   # a + combining diaeresis
    for bad in ("-wi", "wi-", nfd, "WI'"):
        check(f"and refuses {bad!r}",
              _refusal([HEADER, GOOD.replace("thirty-one", bad)]) is not None)
    with open(S.SUPPLEMENT_PATH, encoding="utf-8") as fh:
        lines = fh.read().splitlines()
    planted = ["wi'\tW IH1\ttest:fixture\tplanted\treviewed:test:2026-10-10",
               "'neath\tN IY1 TH\ttest:fixture\tplanted\treviewed:test:2026-10-10",
               "feäce\tF IY1 AH0 S\ttest:fixture\tplanted\treviewed:test:2026-10-10",
               "'tis\tT AH1 Z\ttest:fixture\tplanted\treviewed:test:2026-10-10"]
    body = sorted([l for l in lines if l and not l.startswith("#") and l != HEADER]
                  + planted, key=lambda l: l.split("\t", 1)[0])
    path = _write([HEADER] + body)
    S.SOURCES["test:fixture"] = "planted by this suite"
    try:
        fx = S.SupplementedLexicon(supplement_path=path)
    finally:
        del S.SOURCES["test:fixture"]
        os.remove(path)
    check("`wi'` reads its own row, though `Lexicon` strips it to `wi`",
          fx.transcribe_word("wi'") == (["W", "IH1"], False)
          and PLAIN.transcribe_word("wi'") == ([], True))
    check("`'neath` and `thro'`-style keys read with their apostrophes",
          fx.transcribe_word("'neath") == (["N", "IY1", "TH"], False))
    check("a typographic apostrophe folds to the same key",
          fx.transcribe_word("’neath") == (["N", "IY1", "TH"], False))
    check("an accented key reads, and so does its decomposed spelling",
          fx.transcribe_word("feäce") == fx.transcribe_word(nfd)
          == (["F", "IY1", "AH0", "S"], False))
    check("the exact apostrophe form's reviewed row leads its stripped twin's "
          "CMUdict reading (`'tis` vs `tis`)",
          fx.pronunciation_variants("'tis")[0] == ["T", "AH1", "Z"]
          and ["T", "IH1", "Z"] in fx.pronunciation_variants("'tis"))
    check("while the bare word keeps CMUdict's first reading",
          fx.transcribe_word("tis") == PLAIN.transcribe_word("tis"))
    check("and each names its source",
          fx.reading_source("wi'", ["W", "IH1"]) == "test:fixture"
          and fx.reading_source("tis", ["T", "IH1", "Z"]) == "cmudict")


def _fixture(extra, **kwargs):
    """A SupplementedLexicon over the shipped rows plus `extra` planted rows
    (source `test:fixture`), built from a temporary copy."""
    with open(S.SUPPLEMENT_PATH, encoding="utf-8") as fh:
        lines = fh.read().splitlines()
    body = sorted([l for l in lines if l and not l.startswith("#") and l != HEADER]
                  + [f"{w}\t{ph}\ttest:fixture\tplanted\treviewed:test:2026-10-10"
                     for w, ph in extra], key=lambda l: l.split("\t", 1)[0])
    path = _write([HEADER] + body)
    S.SOURCES["test:fixture"] = "planted by this suite"
    try:
        return S.SupplementedLexicon(supplement_path=path, **kwargs), path
    finally:
        del S.SOURCES["test:fixture"]


def test_consumer_paths():
    print("\n11. the coordinate survives the consumers that build their own readers")
    from quality.phonology.eng import English
    from quality import relations as R
    from quality.revise import Reviser
    r = English(lexicon=SUPP).read("thirty-one")
    check("English.read on a supplement word names the row's source, not CMUdict",
          r is not None and r.rule == "rule:number-compound"
          and r.layer == "dictionary", repr(r))
    check("and a CMUdict word still reads as CMUdict",
          English(lexicon=SUPP).read("moon").rule == "CMUdict")
    check("while a plain English reader refuses the supplement word",
          English(lexicon=PLAIN).read("thirty-one") is None)
    hi = English(fallback="high", lexicon=SUPP).read("thirty-one")
    check("high mode reads the whole entry before its compound layer splits it",
          hi is not None and hi.phones[-3:] == ("W", "AH2", "N")
          and hi.rule == "rule:number-compound", repr(hi))
    check("and reads a CMUdict compound whole too (e-mail), where plain high "
          "mode splits it", English(fallback="high", lexicon=SUPP).read("e-mail").phones
          == ("IY1", "M", "EY2", "L")
          and English(fallback="high", lexicon=PLAIN).read("e-mail").phones
          == ("IY1", "M", "EY1", "L"))
    fx, path = _fixture([("zorbo", "Z AO1 R B OW0")])
    fxh, path_h = _fixture([("zorbo", "Z AO1 R B OW0")], fallback="high")
    try:
        check("a planted supplement-only word reads",
              English(lexicon=fx).read("zorbo") is not None)
        check("but high mode derives nothing from it as a stem",
              English(fallback="high", lexicon=fx).read("zorbos") is None)
        check("nor does the no-fallback view of a lexicon built with one "
              "(the _NoFallbackView route)",
              English(lexicon=fxh).read("zorbos") is None
              and English(lexicon=fxh).read("zorbo") is not None)
        d_plain = English(lexicon=PLAIN).declaration()
        d_supp = English(lexicon=SUPP).declaration()
        d_fx = English(lexicon=fx).declaration()
        check("English.declaration carries the supplement's digest, and only "
              "when there is one",
              "lexicon_supplement_sha256" not in d_plain
              and d_supp.get("lexicon_supplement_sha256") == SUPP.supplement_sha256)
        check("two supplement versions declare apart",
              d_fx.get("lexicon_supplement_sha256") not in (None, d_supp.get("lexicon_supplement_sha256")))
        lines = ["I turned thirty-one", "beneath the burning sun"]
        keys = {R._wvp_key(lines, English(lexicon=lx), None, None)
                for lx in (PLAIN, SUPP, fx)}
        check("the whole-vocabulary memo keys plain, supplement and a second "
              "version three ways apart", len(keys) == 3)
        plain = R.whole_vocabulary_pairs(lines, English(lexicon=PLAIN),
                                         requested_pairs=[(1, 2)])
        memo = R.whole_vocabulary_pairs(lines, English(lexicon=SUPP),
                                        requested_pairs=[(1, 2)])
        R._WVP_MEMO.clear()
        fresh = R.whole_vocabulary_pairs(lines, English(lexicon=SUPP),
                                         requested_pairs=[(1, 2)])
        check("a supplemented call after a plain one on the same text equals a "
              "fresh supplemented call",
              dict(memo) == dict(fresh) and memo.undecided == fresh.undecided)
        check("and the two readings really differ there (so the check above "
              "could fail)", dict(plain) != dict(memo)
              and "perfect rhyme" in dict(memo).get((1, 2), ()),
              f"plain {dict(plain)} | supplement {dict(memo).get((1, 2))}")
    finally:
        os.remove(path)
        os.remove(path_h)
    # MENU -> CHOSEN OCCURRENCE READING -> CONSUMER, on an apostrophe form whose
    # bare word has CMUdict variants (3PO's seam): every reading the lexicon
    # considers is on the menu with its source, a `basis: dictionary` choice
    # of an inherited CMUdict reading is accepted, and the consumer reads it.
    from quality import pronunciation as PR
    fxr, path_r = _fixture([("'record", "R IY1 K AO0 R D")])
    try:
        line = "the 'record spins"
        menu = PR.reading_options(fxr, [line])["items"]
        item = [i for i in menu if i["word"] == "'record"]
        offered = {tuple(r["phones"]): r.get("source") for r in item[0]["dictionary_readings"]} if item else {}
        check("the menu lists the apostrophe form's row AND the bare word's "
              "CMUdict readings, each with its source",
              offered.get(("R", "IY1", "K", "AO0", "R", "D")) == "test:fixture"
              and offered.get(("R", "EH1", "K", "ER0", "D")) == "cmudict"
              and len(offered) == 4, str(offered))
        check("and it is exactly the set the lexicon itself considers",
              set(offered) == {tuple(p) for p in fxr.pronunciation_variants("'record")})
        choice = {"line": line, "token": 2, "word": "'record",
                  "phones": ["R", "EH1", "K", "ER0", "D"], "basis": "dictionary",
                  "source": "test: an inherited CMUdict reading"}
        S.SOURCES["test:fixture"] = "planted by this suite"
        try:
            chosen = S.SupplementedLexicon(supplement_path=path_r, pronunciations=[choice])
        finally:
            del S.SOURCES["test:fixture"]
        check("a `basis: dictionary` choice of the inherited reading is accepted",
              chosen.pronunciations and chosen.pronunciations[0]["phones"]
              == ["R", "EH1", "K", "ER0", "D"])
        phones, words, _ = chosen.transcribe(line)
        check("and the consumer reads the chosen reading on that occurrence",
              phones[2:7] == ["R", "EH1", "K", "ER0", "D"]
              and "IY1" not in phones, str(phones))
        tok = English(lexicon=chosen.for_line(line)).for_token(1).read("'record")
        check("labelled as the declared choice, not as the row it displaced",
              tok is not None and tok.layer == "declared"
              and tok.phones == ("R", "EH1", "K", "ER0", "D"), repr(tok))
        check("while elsewhere the apostrophe form's own row still leads",
              fxr.transcribe_word("'record") == (["R", "IY1", "K", "AO0", "R", "D"], False))
        check("pin_readings files an inherited reading as dictionary, not declared",
              PR.pin_readings(fxr, [(line, 2, "'record", ["R", "EH1", "K", "ER0", "D"])],
                              "test").pronunciations[0]["basis"] == "dictionary")
    finally:
        os.remove(path_r)
    check("a plain Lexicon's menu and validator answer from the exact entry, as "
          "before", PR.dictionary_readings(PLAIN, "record") == PLAIN.entries["record"])
    check("the reviser's relation reader carries the supplemented lexicon",
          Reviser(lex=SUPP)._relation_phonology().lexicon is SUPP
          and Reviser(lex=PLAIN)._relation_phonology().lexicon is None)
    runs_s, runs_p = {}, {}
    Reviser(lex=SUPP)._band_findings(["I turned thirty-one"], runs_out=runs_s)
    Reviser(lex=PLAIN)._band_findings(["I turned thirty-one"], runs_out=runs_p)
    check("and so does its meter-band reader: thirty-ONE, not four prominent "
          "syllables in a row", runs_s == {1: (2, 1)} and runs_p == {1: (4, 1)},
          f"supplement {runs_s} | plain {runs_p}")


def _cli(*args):
    run = subprocess.run([sys.executable, os.path.join(ROOT, "lyric_harness.py"), *args],
                         capture_output=True, text=True, timeout=600)
    return run.returncode, run.stdout + run.stderr


def test_cli():
    print("\n9. the CLI coordinate: declared, disclosed, refused when misspelled")
    rc, out = _cli("--lexicon-supplement", "declaration")
    check("declared, the declaration names the supplement and its digest",
          rc == 0 and S.file_sha256()[:12] in out, out.strip().splitlines()[-1:])
    rc, out = _cli("declaration")
    check("omitted, nothing about it is printed", rc == 0 and "supplement" not in out)
    rc, out = _cli("--lexicon-supplement=1", "declaration")
    check("a version this build does not ship is refused, not ignored",
          rc == 2 and S.UNAVAILABLE in out, out[-160:])


def test_versions():
    print("\n12. versions: a run names a frozen file, and keeps it")
    manifest = S.load_versions()
    v1 = next(r for r in manifest["versions"] if r["id"] == "v1")
    # THE PIN. v1 is frozen: editing its file AND its manifest row together
    # would pass every runtime check (they agree with each other), and would
    # re-read every saved v1 run under new rows. This literal is the guard
    # against that edit; a new batch is a new version, never a new v1.
    check("v1 is frozen at the bytes #522 shipped",
          v1["sha256"] == "452d7aae056ed67f6bff94b76bf6f5df66516ce9e1c95d31796d45a8a92957f7"
          and v1["path"] == "data/lexicon_supplement.tsv" and v1["rows"] == 203,
          v1)
    check("every shipped version resolves byte for byte", S.version_problems() == [])
    check("`none`, the bare flag and an id canonicalise as the record keeps them",
          (S.canonical_version(None), S.canonical_version("none"),
           S.canonical_version(True), S.canonical_version("v1"))
          == ("none", "none", "v1", "v1"))
    check("`none` resolves to no supplement", S.resolve_version("none") is None)
    lex = S.SupplementedLexicon(version="v1")
    check("a declared version reads its own file and names itself",
          lex.supplement_id == "v1" and lex.supplement_sha256 == v1["sha256"]
          and S.lexicon_identity(lex) == {"supplement_id": "v1", "sha256": v1["sha256"]})
    check("CMUdict alone is null/null",
          S.lexicon_identity(PLAIN) == {"supplement_id": None, "sha256": None})
    check("the shipped default path is recognised as v1", SUPP.supplement_id == "v1")

    def refused(fn):
        try:
            fn()
        except S.SupplementUnavailable as error:
            return str(error)
        return None

    msg = refused(lambda: S.resolve_version("v9"))
    check("an unknown version refuses and names what ships",
          msg and S.UNAVAILABLE in msg and "v1" in msg, msg)
    msg = refused(lambda: S.resolve_version("v1", "0" * 64))
    check("a saved run's sha256 that is not the shipped file's refuses",
          msg and v1["sha256"] in msg and "0" * 64 in msg, msg)
    msg = refused(lambda: S.resolve_version("none", v1["sha256"]))
    check("a sha256 with no version refuses", msg and S.UNAVAILABLE in msg, msg)

    # A version whose file is missing, or whose bytes moved under an
    # unchanged manifest row, refuses: planted in a copy of the data dir.
    tmp = tempfile.mkdtemp()
    try:
        data = os.path.join(tmp, "data")
        os.makedirs(data)
        shutil.copy(S.SUPPLEMENT_PATH, os.path.join(data, "lexicon_supplement.tsv"))
        manifest_path = os.path.join(data, "lexicon_supplement_versions.json")
        shutil.copy(S.VERSIONS_PATH, manifest_path)
        check("the copied manifest resolves",
              S.resolve_version("v1", versions_path=manifest_path)["sha256"] == v1["sha256"])
        with open(os.path.join(data, "lexicon_supplement.tsv"), "a", encoding="utf-8") as fh:
            fh.write("# an edit\n")
        msg = refused(lambda: S.resolve_version("v1", versions_path=manifest_path))
        check("a changed file under an unchanged manifest row refuses",
              msg and "hashes to" in msg, msg)
        os.remove(os.path.join(data, "lexicon_supplement.tsv"))
        msg = refused(lambda: S.resolve_version("v1", versions_path=manifest_path))
        check("a missing file refuses", msg and "cannot be read" in msg, msg)
    finally:
        shutil.rmtree(tmp)

    # The CLI: the record names the version on every lyric result; the
    # declared sha256 is checked; `none` is CMUdict alone.
    rc, out = _cli("--lexicon-supplement=v1", "declaration")
    check("--lexicon-supplement=v1 is declared and disclosed",
          rc == 0 and "supplement v1" in out, out.strip().splitlines()[-1:])
    rc, out = _cli("--lexicon-supplement=v1", f"--lexicon-supplement-sha256={'0' * 64}",
                   "declaration")
    check("a declared sha256 the file does not have refuses at the CLI",
          rc == 2 and S.UNAVAILABLE in out, out[-200:])
    rc, out = _cli("--lexicon-supplement=none", "declaration")
    check("--lexicon-supplement=none reads CMUdict alone",
          rc == 0 and "supplement" not in out, out[-160:])
    rc, out = _cli("--lexicon-supplement-sha256=" + v1["sha256"], "declaration")
    check("a sha256 without a version refuses", rc == 2 and S.UNAVAILABLE in out, out[-160:])
    rc, out = _cli("--lexicon-supplement=v1", "--lexicon-supplement=v1", "declaration")
    check("two declarations refuse", rc == 2, out[-160:])


def main():
    for fn in (test_shipped_file, test_contract_refusals,
               test_plain_lexicon_untouched, test_derivation_reads_cmudict_alone,
               test_whole_before_piece, test_witnesses, test_reading_sources,
               test_identities_move, test_tokenizer_keys, test_consumer_paths,
               test_cli, test_versions):
        fn()
    print(f"\n{'ALL PASS' if not FAILURES else 'FAILURES: ' + str(FAILURES)}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())

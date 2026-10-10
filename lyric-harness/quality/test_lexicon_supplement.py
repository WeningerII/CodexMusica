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
    check("a value on the presence flag is refused, not ignored", rc == 2, out[-160:])


def main():
    for fn in (test_shipped_file, test_contract_refusals,
               test_plain_lexicon_untouched, test_derivation_reads_cmudict_alone,
               test_whole_before_piece, test_witnesses, test_reading_sources,
               test_identities_move, test_cli):
        fn()
    print(f"\n{'ALL PASS' if not FAILURES else 'FAILURES: ' + str(FAILURES)}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())

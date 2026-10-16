"""The reader's opening-quote rule (2026-10-16, `lyric_harness._opening_quotes`).

A quoted `‘This` read as the word `'This`, a different word from `This`, so
four sonnet line pairs counted as internal rhymes of a word with itself. A
token-initial U+2018/U+201B now leaves the word unless the word is a listed
leading elision. Every other apostrophe reads as written.

    python3 quality/test_reader_quotes.py
"""
import functools
import json
import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import lyric_harness as LH  # noqa: E402


def texts(line):
    return [t.text for t in LH.reader_line(line).tokens]


def without_the_rule(fn):
    """Run `fn` with the opening-quote rule off: the reader as it was."""
    @functools.wraps(fn)
    def run(*a, **k):
        saved = LH._OPENING_QUOTES
        LH._OPENING_QUOTES = ""
        LH._reader_line_v2.cache_clear()
        try:
            return fn(*a, **k)
        finally:
            LH._OPENING_QUOTES = saved
            LH._reader_line_v2.cache_clear()
    return run


SONNET_2_L10 = "If thou couldst answer ‘This fair child of mine"
SONNET_2_L13 = "This were to be new made when thou art old,"
SONNET_8_L14 = "Sings this to thee: ‘Thou single wilt prove none.’"


class TheFourSonnetPairs(unittest.TestCase):
    """The quoted word is the same word as its unquoted repeat."""

    def test_the_quoted_word_is_the_word(self):
        self.assertEqual(texts(SONNET_2_L10)[4], "This")
        self.assertEqual(texts(SONNET_2_L13)[0], "This")
        self.assertEqual(texts(SONNET_8_L14)[4], "Thou")

    def test_no_internal_rhyme_of_a_word_with_itself(self):
        from quality import chance_rate as C
        from quality import relations as RF
        from quality.revise import _relation_phonology
        phon = _relation_phonology()
        son = C._sonnets()
        for n, pairs in ((2, [(10, 13)]), (8, [(1, 14), (3, 14), (8, 14)])):
            got = RF.whole_vocabulary_pairs(list(son[n - 1]), phon)
            for pr in pairs:
                with self.subTest(sonnet=n, pair=pr):
                    self.assertNotIn("internal rhyme", got.get(pr, []))


#: Lines whose every token must read exactly as it did before the rule:
#: listed elisions in each typography, unlisted dialect forms and names,
#: internal and trailing apostrophes, the straight and the other ambiguous
#: marks (quoted or not), and the double quotation marks.
UNCHANGED = [
    "’Tis late, 'Twas so, 'twere, 'twould, 'twixt, 'gainst, 'neath, 'mong",
    "'mongst 'em 'bout 'cause 'round 'til 'kay 'course 'cuse 'frisco 'gain",
    "'lasses an' 'ead, 'Arry's boys' 'ats, ’ould ’spects 'Nudder 'Od",
    "o'er the ne'er th' sea, e'en so; the world’s end, hours' toil, ca' canny",
    "goin’ and comin' and ’Tain’t and 'Tain't and 'zamination",
    "rock 'n' roll, I 'm, ye 're, 've, 'd, 'll, 's, 't",
    "'Our Father' and `quoted` and ´tick´ and ＇wide＇",
    "“This” and \"This\" and „Low“",
]


class EverythingElseReadsAsWritten(unittest.TestCase):

    def test_unchanged_lines(self):
        before = without_the_rule(lambda: [LH.reader_line(s) for s in UNCHANGED])()
        for line, old in zip(UNCHANGED, before):
            with self.subTest(line=line):
                self.assertEqual(LH.reader_line(line), old)

    def test_a_listed_elision_keeps_its_mark_in_either_typography(self):
        self.assertEqual(texts("‘tis late, ’tis late, 'tis late"),
                         ["'tis", "late", "'tis", "late", "'tis", "late"])

    def test_the_list_holds_every_apostrophe_headword_of_the_data(self):
        heads = set()
        dic = ROOT / "cmudict.dict"
        if not dic.exists():
            dic = ROOT / "data" / "cmudict.dict"
        for row in dic.read_text(encoding="utf-8", errors="replace").splitlines():
            w = row.split(" ", 1)[0].split("(", 1)[0]
            if w.startswith("'") and len(w) > 1:
                heads.add(LH.fold_apostrophes(w).lower())
        for row in (ROOT / "data" / "eng_elision.tsv").read_text(encoding="utf-8").splitlines():
            w = row.split("\t", 1)[0]
            if w.startswith("'"):
                heads.add(LH.fold_apostrophes(w).lower())
        self.assertTrue(heads)
        self.assertEqual(heads - LH.LEADING_ELISIONS, set())


class SourceSpans(unittest.TestCase):
    """The mark leaves the word, never the line: every piece slices the raw
    line to the token's text, and the dropped mark sits just before it."""

    def test_pieces_slice_the_source(self):
        for line in [SONNET_2_L10, SONNET_8_L14, "‘Margaret! Margaret!’",
                     "‘­This and ‛Odd and ‘Margaret’"]:
            rl = LH.reader_line(line)
            for t in rl.tokens + rl.runs:
                with self.subTest(line=line, token=t.text):
                    raw = "".join(line[a:b] for a, b in t.pieces).replace("­", "")
                    self.assertEqual(LH.normalise_word(raw), t.text)
            self.assertEqual(rl.text, line)
        tok = LH.reader_line(SONNET_2_L10).tokens[4]
        self.assertEqual(SONNET_2_L10[tok.pieces[0][0] - 1], "‘")

    def test_the_end_word_and_raw_run_still_agree(self):
        rl = LH.reader_line(SONNET_8_L14)
        self.assertIsNone(LH.printed_endpoint(rl))


class DeclaredPronunciations(unittest.TestCase):

    def row(self, line, token, word):
        return {"line": line, "token": token, "word": word, "phones": ["DH", "IH1", "S"],
                "basis": "declared", "source": "the singer"}

    def test_a_declaration_naming_the_quoted_spelling_binds_and_is_read(self):
        from quality.pronunciation import validate_choices
        lex = LH.Lexicon(strip_parens=True, pronunciations=None)
        for word in ("‘This", "'This"):
            with self.subTest(word=word):
                bound = validate_choices([self.row(SONNET_2_L10, 5, word)], lex)
                self.assertEqual([(b["token"], b["word"]) for b in bound], [(5, "This")])
        lex = LH.Lexicon(strip_parens=True, pronunciations=[self.row(SONNET_2_L10, 5, "‘This")])
        reader = lex.for_line(SONNET_2_L10).for_token(4)
        self.assertEqual(reader.entries["this"], [["DH", "IH1", "S"]])

    def test_a_declaration_on_a_kept_mark_binds_as_before(self):
        from quality.pronunciation import validate_choices
        lex = LH.Lexicon(strip_parens=True, pronunciations=None)
        line = "'lasses an' 'ead"
        bound = validate_choices([self.row(line, 1, "'lasses")], lex)
        self.assertEqual([(b["token"], b["word"]) for b in bound], [(1, "'lasses")])

    def test_every_stored_declaration_still_finds_its_word(self):
        # Every row of every imported set: the word it declares sits at the
        # same token as with the rule off, as written or as its quoted
        # spelling (`declared_spelling`), under either paren declaration.
        from quality.pronunciation import declared_spelling
        rows = []
        for path in sorted(ROOT.glob("imports/**/pronunciations/*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            for payload in data.values():
                if isinstance(payload, dict):
                    rows.extend(payload.get("pronunciations", ()))
        self.assertGreater(len(rows), 100)
        quoted = []
        for sp in (True, False):
            before = without_the_rule(
                lambda: {r["line"]: [t.text for t in LH.reader_line(r["line"], strip_parens=sp).tokens]
                         for r in rows})()
            for r in rows:
                old = before[r["line"]]
                if r["word"] not in old:
                    continue
                j = old.index(r["word"])
                now = [t.text for t in LH.reader_line(r["line"], strip_parens=sp).tokens]
                with self.subTest(line=r["line"], word=r["word"], strip_parens=sp):
                    self.assertEqual(len(now), len(old))
                    self.assertTrue(now[j] == r["word"] or declared_spelling(r["word"], now[j]))
                if now[j] != r["word"]:
                    quoted.append((r["line"], r["word"], now[j]))
        # The one stored declaration on a quotation mark: `\u2018sieven past,\u2019`.
        self.assertEqual(sorted(set(quoted)),
                         [("Roden, the Irishman, is \u2018sieven past,\u2019", "'sieven", "sieven")])

    def test_the_pinned_set_on_a_quotation_mark_rebinds_and_binds(self):
        from quality.pronunciation import numbering_of, rebind_occurrences, validate_choices
        data = json.loads((ROOT / "imports/gutenberg-next-ten/pronunciations/1568.json")
                          .read_text(encoding="utf-8"))
        rows = data["line-808"]["pronunciations"]
        once = rebind_occurrences(rows, "v1", "v2", strip_parens=False)
        lex = LH.Lexicon(strip_parens=False, pronunciations=None)
        lex._numbering_guard, lex._numbering_notices = True, []
        bound = validate_choices([dict(r, numbering=numbering_of(lex)) for r in once], lex)
        self.assertIn((5, "sieven"), [(b["token"], b["word"]) for b in bound])
        self.assertEqual(lex._numbering_notices, [])


if __name__ == "__main__":
    os.chdir(ROOT)
    unittest.main()

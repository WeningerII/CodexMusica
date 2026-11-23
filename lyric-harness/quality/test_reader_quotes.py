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

    def test_the_exception_needs_the_dropped_mark_in_the_source(self):
        # Only the occurrence the reader took a printed opening quote off:
        # the source's own mark or its fold, once. An unquoted token, another
        # leading mark, a doubled one, or a mark the source does not print
        # there is an ordinary spelling, refused as one -- under v2 and v1.
        # U+201B is never word material (the reader does not fold it), so no
        # mark was taken off a word it opens.
        from quality.pronunciation import validate_choices
        refused = [
            ("If thou couldst answer This fair child of mine", 5, w)
            for w in ("\u2018This", "'This", "\u2019This", "''This", "\u2018\u2018This", "\u201bThis")
        ] + [
            (SONNET_2_L10, 5, w) for w in ("\u2019This", "''This", "\u2018'This", "\u201bThis", "`This")
        ] + [
            ("Sings this to thee: \u201bThou single wilt prove none.", 5, w)
            for w in ("\u2018Thou", "\u201bThou", "'Thou")
        ] + [
            ("\u2018\u2018This fair child", 1, "'This"),
            ("\u2018\u2018This fair child", 1, "\u2018This"),
        ]
        for scheme in ("v2", "v1"):
            lex = LH.Lexicon(strip_parens=True, pronunciations=None, reader_scheme=scheme)
            for line, token, word in refused:
                with self.subTest(scheme=scheme, line=line, word=word):
                    with self.assertRaisesRegex(ValueError, "exact sung token"):
                        validate_choices([self.row(line, token, word)], lex)
        lex = LH.Lexicon(strip_parens=True, pronunciations=None, reader_scheme="v2")
        for line, token, word, bound in [
                (SONNET_8_L14, 5, "\u2018Thou", "Thou"),
                ("Roden, the Irishman, is \u2018sieven past,\u2019", 5, "\u2018sieven", "sieven"),
                ("Roden, the Irishman, is \u2018sieven past,\u2019", 5, "'sieven", "sieven"),
                ("Roden, the Irishman, is \u2018sieven past,\u2019", 5, "sieven", "sieven")]:
            with self.subTest(line=line, word=word):
                got = validate_choices([self.row(line, token, word)], lex)
                self.assertEqual([(b["token"], b["word"]) for b in got], [(token, bound)])

    def test_v1_validation_is_unchanged(self):
        # Under v1 the mark is part of the word: the quoted spelling binds as
        # written and the bare word is refused, exactly as before the rule.
        from quality.pronunciation import validate_choices
        lex = LH.Lexicon(strip_parens=True, pronunciations=None, reader_scheme="v1")
        got = validate_choices([self.row(SONNET_2_L10, 5, "'This")], lex)
        self.assertEqual([(b["token"], b["word"]) for b in got], [(5, "'This")])
        with self.assertRaisesRegex(ValueError, "exact sung token"):
            validate_choices([self.row(SONNET_2_L10, 5, "This")], lex)

    def test_a_rebind_off_an_unquoted_token_is_refused(self):
        from quality.pronunciation import rebind_occurrences
        row = dict(self.row("If thou couldst answer This fair child", 5, "This"))
        self.assertEqual(rebind_occurrences([row], "v1", "v2")[0]["token"], 5)
        for line in ("If thou couldst answer \u2019This fair child",
                     "If thou couldst answer ''This fair child"):
            with self.subTest(line=line):
                w = LH.reader_token_spans(line, True, "v1")[4][0]
                bad = dict(self.row(line, 5, w))
                try:
                    out = rebind_occurrences([bad], "v1", "v2")
                except ValueError:
                    continue
                self.assertEqual(LH.reader_token_spans(line, True, "v2")[out[0]["token"] - 1][0], w)

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
                toks = LH.reader_line(r["line"], strip_parens=sp).tokens
                now = [t.text for t in toks]
                with self.subTest(line=r["line"], word=r["word"], strip_parens=sp):
                    self.assertEqual(len(now), len(old))
                    self.assertTrue(now[j] == r["word"] or declared_spelling(
                        r["word"], now[j], r["line"], toks[j].pieces))
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


class AQuoteMarkBesideAWordsOwnApostrophe(unittest.TestCase):
    """A word spelled with an apostrophe at its edge, typed with a quotation
    mark beside that apostrophe, is still that word (2026-11-23; found by the
    planner owner in the review of bug hunt finding 18's fix, measured by the
    coordinator, test written by the coordinator).

    The fold makes every apostrophe `'`. So a word that ends in its own
    apostrophe and is closed by a single quotation mark read as a token with
    two marks on its end: no dictionary entry, and for some words a different
    set of readings from the word itself. The same at the front, where an
    opening mark stands before a word that starts with its own apostrophe.
    A double quotation mark in either place was already dropped.

    THE RULE: a run of apostrophes at either edge of a token is one mark, and
    a leading run made only of opening quotation marks leaves the word.
    Scheme v2 only; scheme v1 is frozen.

    Nothing here is a chosen example. The words are every dictionary word
    that ends in an apostrophe and every one that starts with one, spelled
    with letters and apostrophes only.
    """

    CLOSING = ("’", "'")
    OPENING = ("‘", "’", "'")

    @classmethod
    def setUpClass(cls):
        cls.lex = LH.Lexicon(strip_parens=True, pronunciations=None)
        words = sorted(w for w in cls.lex.entries
                       if "'" in w and len(w) > 2
                       and w.replace("'", "").isalpha())
        cls.ends = [w for w in words
                    if w.endswith("'") and not w.startswith("'")]
        cls.fronts = [w for w in words
                      if w.startswith("'") and not w.endswith("'")]
        cls.inner = [w for w in words
                     if not w.startswith("'") and not w.endswith("'")]
        cls.plain = sorted(w for w in cls.lex.entries
                           if w.isalpha() and len(w) > 2)

    @staticmethod
    def tokens(line, scheme="v2"):
        return LH.line_tokens(line, scheme=scheme)

    def reading(self, line):
        """-> the line's end as the rhyme judge hears it, every reading."""
        anchors = LH.line_anchors(self.lex, line)[0]
        return sorted(tuple((s["nucleus"], tuple(s["coda"]), tuple(s["onset"]),
                             s["stress"]) for s in a) for a in anchors)

    def lines(self):
        """-> (the line with a mark beside the word's own apostrophe, the
        line without it), for every word, each mark, at the line's end and
        at its start."""
        for w in self.ends:
            for m in self.CLOSING:
                yield f"they said {w}{m}", f"they said {w}"
                yield f"{w}{m} they said", f"{w} they said"
        for w in self.fronts:
            for m in self.OPENING:
                yield f"they said {m}{w}", f"they said {w}"
                yield f"{m}{w} they said", f"{w} they said"

    def test_the_premise_holds(self):
        # The dictionary has such words, in number, so no check below can
        # pass by having nothing to read.
        self.assertGreater(len(self.ends), 500)
        self.assertGreater(len(self.fronts), 5)
        self.assertGreater(len(self.inner), 5000)

    def test_the_mark_beside_the_apostrophe_leaves_the_word(self):
        wrong = [(marked, self.tokens(marked))
                 for marked, plain in self.lines()
                 if self.tokens(marked) != self.tokens(plain)]
        self.assertEqual(wrong[:5], [], f"{len(wrong)} line(s) read as "
                         f"different words with the mark there")

    def test_the_end_word_is_the_word(self):
        wrong = [marked for marked, plain in self.lines()
                 if LH.raw_final_token(marked, scheme="v2")
                 != LH.raw_final_token(plain, scheme="v2")]
        self.assertEqual(wrong[:5], [], f"{len(wrong)} line(s) end on a "
                         f"different word with the mark there")

    def test_it_is_heard_as_the_word_is_heard(self):
        # Before the rule, 7 of the 811 words that end in an apostrophe were
        # heard differently with a closing mark after them (counted on
        # r2/pronunciation-batch at 07c2949b6).
        wrong = [marked for marked, plain in self.lines()
                 if marked.startswith("they said ")
                 and self.reading(marked) != self.reading(plain)]
        self.assertEqual(wrong[:5], [], f"{len(wrong)} line end(s) heard "
                         f"differently with the mark there")

    def test_the_mark_leaves_the_word_and_not_the_line(self):
        # `SourceSpans` above, on these lines: every token's pieces still
        # slice the raw line to the token's own text.
        for marked, _plain in list(self.lines())[::37]:
            rl = LH.reader_line(marked)
            self.assertEqual(rl.text, marked)
            for t in rl.tokens + rl.runs:
                with self.subTest(line=marked, token=t.text):
                    raw = "".join(marked[a:b] for a, b in t.pieces)
                    self.assertEqual(LH.normalise_word(raw), t.text)

    def test_a_run_of_opening_marks_leaves_the_word(self):
        # Two opening marks open a quotation as one does: every plain word,
        # each count of U+2018 (one, two), reads as the word. Every 97th word,
        # so the draw is spread across the dictionary and none is chosen. A
        # listed leading elision (`LEADING_ELISIONS`) keeps its mark, as it
        # does after one opening mark, so it is left out here.
        for w in self.plain[::97]:
            if ("'" + w).lower() in LH.LEADING_ELISIONS:
                continue
            for n in (1, 2):
                with self.subTest(word=w, marks=n):
                    self.assertEqual(
                        self.tokens(f"{chr(0x2018) * n}{w} they said")[0], w)

    def test_what_read_right_before_still_does(self):
        # CONTROLS. Each of these held before the rule and must hold after.
        for w in self.ends:
            # One mark at an edge is the word's own, and stays.
            self.assertEqual(self.tokens(f"they said {w}")[-1], w)
            # A double quotation mark after it was already dropped.
            for m in ('"', "”"):
                self.assertEqual(self.tokens(f"they said {w}{m}")[-1], w)
        for w in self.fronts:
            self.assertEqual(self.tokens(f"they said {w}")[-1], w)
            for m in ('"', "“"):
                self.assertEqual(self.tokens(f"they said {m}{w}")[-1], w)
        for w in self.inner:
            # An apostrophe inside a word is never at its edge: the word
            # reads as spelled, and one closing mark after it is kept as
            # written, as a token-final mark always has been.
            self.assertEqual(self.tokens(f"they said {w}")[-1], w)
            self.assertEqual(self.tokens(f"they said {w}’")[-1], w + "'")

    def test_scheme_v1_is_frozen(self):
        for w in self.ends:
            for m in self.CLOSING:
                self.assertEqual(
                    self.tokens(f"they said {w}{m}", "v1")[-1], w + "'")
        for w in self.fronts:
            for m in self.OPENING:
                self.assertEqual(
                    self.tokens(f"they said {m}{w}", "v1")[-1], "'" + w)


if __name__ == "__main__":
    os.chdir(ROOT)
    unittest.main()

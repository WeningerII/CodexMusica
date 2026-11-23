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
import random
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


class AWordSpelledWithAnEdgeApostropheKeepsItsOwnEntry(unittest.TestCase):
    """A word the dictionary spells with an apostrophe at its edge is read by
    its own entry (2026-11-23; found by the coordinator while checking a
    search fix for bug hunt finding 18, cause found by the reader's owner).

    `Lexicon.pronunciation_variants` took the mark off the edge and read only
    the entry of the letters that were left. Wherever those letters are a
    dictionary word too, the word's own entry was never read: a line ending
    in such a word was heard as the other word and could not rhyme the way
    the word itself is sung. Where the letters are not a dictionary word, the
    word's own entry was not read either, and the word went to the guesser.

    THE RULE (scheme v2 only; scheme v1 is frozen):
      1. the word's own entry comes first, in the dictionary's order;
      2. then every reading of the same letters without the mark that the own
         entry does not already hold, in the order the reader gives them, so
         no pair that holds today stops holding;
      3. an `-in'` spelling that answers a reduced `-ing` reading answers
         ~~its own entry first, then the reduced readings the entry lacks~~
         its reduced readings first, in the order they had before, then the
         readings of its own entry that the reduced list lacks, and nothing
         else (the bare spelling's readings stay out, as before). REPINNED
         2026-11-23: test_high_report.py:65 pins the plain elision as the
         first reading, and five own entries (gettin', goin', hangin',
         sittin', workin') are not the plain elision;
      4. a word ending in `s'` whose letters without the mark are a
         dictionary word is a possessive, and is read exactly as that word
         is. ~~Rules 1 and 2 covered it~~ (REPINNED 2026-11-23, found in the
         coordinator's review of the rule): the dictionary's own entries for
         these spellings include guesses that are not the word's sound
         (`sons'` is given the vowel of `cons`), and reading them made pairs
         rhyme that do not rhyme.

    Nothing here is a chosen example. The words are every dictionary word
    with an apostrophe at exactly one edge, spelled with letters and
    apostrophes only; a partner word is drawn from the dictionary by seed.
    """

    SEED = 20261123

    @classmethod
    def setUpClass(cls):
        cls.lex = LH.Lexicon(strip_parens=True, pronunciations=None,
                             reader_scheme="v2")
        cls.old = LH.Lexicon(strip_parens=True, pronunciations=None,
                             reader_scheme="v1")
        entries = cls.lex.entries
        edge = sorted(w for w in entries
                      if len(w) > 2 and w.replace("'", "").isalpha()
                      and w.startswith("'") != w.endswith("'"))
        cls.bare = {w: w.strip("'") for w in edge}
        # Rule 3's words: an -in' spelling whose -ing word has a reading
        # that ends in the weak vowel and NG.
        cls.reduced = {}
        for w in edge:
            if w.endswith("in'"):
                got = [list(p[:-1]) + ["N"]
                       for p in entries.get(w[:-1] + "g", ())
                       if len(p) >= 2 and list(p[-2:]) == ["IH0", "NG"]]
                if got:
                    cls.reduced[w] = got
        # Rule 4's words.
        cls.possessive = [w for w in edge if w.endswith("s'")
                          and w not in cls.reduced and cls.bare[w] in entries]
        cls.possessive_differ = [w for w in cls.possessive
                                 if entries[w] != entries[cls.bare[w]]]
        held_back = set(cls.reduced) | set(cls.possessive)
        cls.ruled = [w for w in edge if w not in held_back]
        # Both spellings in the dictionary, and the two entries differ: the
        # words the rule changes the hearing of.
        cls.differ = [w for w in cls.ruled if cls.bare[w] in entries
                      and entries[w] != entries[cls.bare[w]]]
        cls.same = [w for w in cls.ruled if cls.bare[w] in entries
                    and entries[w] == entries[cls.bare[w]]]
        cls.alone = [w for w in cls.ruled if cls.bare[w] not in entries]

    @staticmethod
    def own(lex, word):
        return [list(p) for p in lex.entries[word]]

    def expected(self, word):
        """-> rule 1 then rule 2, or rule 4 for its words, said through the
        reader itself."""
        if word in self.possessive:
            return self.lex.pronunciation_variants(self.bare[word])
        own = self.own(self.lex, word)
        return own + [p for p in self.lex.pronunciation_variants(self.bare[word])
                      if p not in own]

    @staticmethod
    def sounds(anchor):
        return tuple((s["nucleus"], tuple(s["coda"]), tuple(s["onset"]),
                      s["stress"]) for s in anchor)

    def heard(self, word, readings=None):
        """-> the line's end as the rhyme judge hears it, every reading in
        order. `readings` asks for the end word read by exactly those."""
        anchors = LH.line_anchors(self.lex, f"they said {word}",
                                  endpoint_pronunciations=readings)[0]
        return [self.sounds(a) for a in anchors]

    def test_the_premise_holds(self):
        # The dictionary has such words on both edges and in each group, so
        # no check below can pass by having nothing to read.
        self.assertGreater(len([w for w in self.differ if w.startswith("'")]), 2)
        # REPINNED 2026-11-23: ~~more than 100 words marked at the end whose
        # two entries differ, more than 300 whose entries agree~~. Nearly all
        # of both were possessives, which rule 4 now reads; they are counted
        # under their own rule.
        self.assertGreater(len(self.same), 5)
        self.assertGreater(len(self.possessive), 300)
        self.assertGreater(len(self.possessive_differ), 100)
        # Few words stand alone (three on the dictionary as shipped), so
        # that check reads every one of them.
        self.assertGreater(len(self.alone), 0)
        self.assertGreater(len(self.reduced), 5)

    def test_the_own_entry_comes_first_and_the_bare_readings_stay(self):
        wrong = [(w, self.lex.pronunciation_variants(w)) for w in self.ruled
                 if self.lex.pronunciation_variants(w) != self.expected(w)]
        self.assertEqual(wrong[:5], [], f"{len(wrong)} of {len(self.ruled)} "
                         f"word(s) not read as their own entry and then the "
                         f"bare spelling's other readings")

    def test_a_possessive_is_read_as_the_word_without_its_mark(self):
        # Rule 4, on every one of its words: the readings, their order and
        # the single reading are the bare word's.
        wrong = [w for w in self.possessive
                 if self.lex.pronunciation_variants(w)
                 != self.lex.pronunciation_variants(self.bare[w])
                 or self.lex.transcribe_word(w)
                 != self.lex.transcribe_word(self.bare[w])]
        self.assertEqual(wrong[:5], [], f"{len(wrong)} of "
                         f"{len(self.possessive)} possessive(s) not read as "
                         f"the word without the mark")
        # At the line's end, where the rhyme judge reads it, for every
        # possessive whose own entry differs from the bare word's.
        heard = [w for w in self.possessive_differ
                 if self.heard(w) != self.heard(self.bare[w])]
        self.assertEqual(heard[:5], [], f"{len(heard)} of "
                         f"{len(self.possessive_differ)} line end(s) not "
                         f"heard as the word without the mark")

    def test_a_mark_at_both_edges_reads_as_one_of_them(self):
        # A second mark on the other edge (a quotation mark folded to `'`)
        # leaves the word's reading as it was with one mark: a word marked
        # in front keeps its own entry, and a possessive stays the bare
        # word. Every word of both kinds is read.
        front = [w for w in self.ruled if w.startswith("'")]
        wrong = [w for w in front
                 if self.lex.pronunciation_variants(w + "'")
                 != self.lex.pronunciation_variants(w)]
        wrong += ["'" + w for w in self.possessive
                  if self.lex.pronunciation_variants("'" + w)
                  != self.lex.pronunciation_variants(self.bare[w])]
        self.assertGreater(len(front), 2, "PREMISE")
        self.assertEqual(wrong[:5], [], f"{len(wrong)} word(s)")

    def test_the_single_reading_is_the_words_own(self):
        # `transcribe_word` takes the first reading as the word's one
        # reading; it is the first reading of the word's own entry, and the
        # word is not sent to the guesser.
        wrong = [w for w in self.ruled
                 if self.lex.transcribe_word(w)
                 != (self.own(self.lex, w)[0], False)]
        self.assertEqual(wrong[:5], [], f"{len(wrong)} word(s)")

    def test_a_typographic_mark_is_the_same_word(self):
        rng = random.Random(self.SEED)
        for w in self.differ + rng.sample(self.possessive_differ, 40):
            curly = w.replace("'", "’")
            with self.subTest(word=curly):
                self.assertEqual(self.lex.pronunciation_variants(curly),
                                 self.expected(w))

    def test_the_line_is_heard_by_the_own_entry_and_the_bare_readings(self):
        # At the line's end, where the rhyme judge reads it. Before the rule
        # every one of these lines was heard exactly as the bare spelling's.
        missing_own, missing_bare, not_first = [], [], []
        for w in self.differ:
            got = self.heard(w)
            own = self.heard(w, self.own(self.lex, w))
            if not set(own) <= set(got):
                missing_own.append(w)
            if not set(self.heard(self.bare[w])) <= set(got):
                missing_bare.append(w)
            if own and got[:1] != own[:1]:
                not_first.append(w)
        self.assertEqual(missing_own[:5], [], f"{len(missing_own)} of "
                         f"{len(self.differ)} line end(s) never heard by the "
                         f"word's own entry")
        self.assertEqual(missing_bare[:5], [], f"{len(missing_bare)} line "
                         f"end(s) lost a reading they had")
        self.assertEqual(not_first[:5], [], f"{len(not_first)} line end(s) "
                         f"not heard first by the word's own entry")

    def test_a_word_whose_letters_are_no_word_is_read_and_not_guessed(self):
        unread = [w for w in self.alone
                  if self.heard(w) != self.heard(w, self.own(self.lex, w))]
        self.assertEqual(unread[:5], [], f"{len(unread)} of "
                         f"{len(self.alone)} word(s)")

    #: The two names the judge has for a rhyme on a line's last syllable:
    #: both syllables stressed, or one of them weak.
    END_RHYMES = ("perfect rhyme", "light rhyme")

    def test_the_rhyme_judge_hears_both(self):
        # A pair at the judge, under its any-reading rule, for every word of
        # one syllable whose own entry and bare spelling end on different
        # sounds. A partner that ends as the own entry does rhymes with it:
        # before the rule no such pair did. A partner that ends as the bare
        # spelling does rhymes with it exactly as it rhymes with the bare
        # spelling.
        from quality import relations as RF
        from quality.revise import _relation_phonology
        phon = _relation_phonology()
        entries = self.lex.entries

        def vowels(phones):
            return [i for i, ph in enumerate(phones) if ph[-1] in "012"]

        def tail(phones):
            return tuple(ph.rstrip("012") for ph in phones[vowels(phones)[-1]:])

        def end_rhymes(a, b):
            got = RF.whole_vocabulary_pairs(
                [f"they said {a}", f"they said {b}"], phon)
            names = set(got.get((1, 2), []))
            names |= set(got.resolve_readings(
                (1, 2), list(got.undecided.get((1, 2), [])))[0])
            return names & set(self.END_RHYMES)

        plain = sorted(w for w, prons in entries.items()
                       if w.isalpha() and len(w) > 2 and len(prons) == 1
                       and len(vowels(prons[0])) == 1
                       and prons[0][vowels(prons[0])[0]].endswith("1"))
        random.Random(self.SEED).shuffle(plain)
        by_tail = {}
        for w in plain:
            by_tail.setdefault(tail(entries[w][0]), []).append(w)

        judged = 0
        for w in self.differ:
            bare = self.bare[w]
            own, other = self.own(self.lex, w), self.own(self.lex, bare)
            if any(len(vowels(p)) != 1 for p in own + other):
                continue
            own_tails = {tail(p) for p in own}
            bare_tails = {tail(p) for p in other}
            if own_tails & bare_tails:
                continue
            mine = next((p for t in sorted(own_tails)
                         for p in by_tail.get(t, []) if p != bare), None)
            theirs = next((p for t in sorted(bare_tails)
                           for p in by_tail.get(t, []) if p != bare), None)
            if mine is None or theirs is None:
                continue
            judged += 1
            with self.subTest(word=w, partner=mine, ends_as="its own entry"):
                # PREMISE: the bare spelling does not rhyme with this
                # partner, so the rhyme below can only be the own entry's.
                self.assertEqual(end_rhymes(bare, mine), set())
                self.assertNotEqual(end_rhymes(w, mine), set())
            with self.subTest(word=w, partner=theirs, ends_as="the bare spelling"):
                held = end_rhymes(bare, theirs)
                self.assertNotEqual(held, set(), "PREMISE")
                self.assertLessEqual(held, end_rhymes(w, theirs))
        self.assertGreater(judged, 1, "PREMISE: words were judged")

        # RULE 4 AT THE JUDGE. A possessive of one syllable whose own entry
        # ends on other sounds than the bare word: a partner that ends as the
        # own entry does is no rhyme (it is none for the bare word), and a
        # partner that ends as the bare word does rhymes exactly as it does
        # with the bare word.
        judged = 0
        for w in self.possessive_differ:
            bare = self.bare[w]
            own, other = self.own(self.lex, w), self.own(self.lex, bare)
            if any(len(vowels(p)) != 1 for p in own + other):
                continue
            own_tails = {tail(p) for p in own}
            bare_tails = {tail(p) for p in other}
            if own_tails & bare_tails:
                continue
            mine = next((p for t in sorted(own_tails)
                         for p in by_tail.get(t, []) if p != bare), None)
            theirs = next((p for t in sorted(bare_tails)
                           for p in by_tail.get(t, []) if p != bare), None)
            if mine is None or theirs is None:
                continue
            judged += 1
            with self.subTest(word=w, partner=mine, ends_as="its own entry"):
                self.assertEqual(end_rhymes(bare, mine), set(), "PREMISE")
                self.assertEqual(end_rhymes(w, mine), set())
            with self.subTest(word=w, partner=theirs, ends_as="the bare word"):
                held = end_rhymes(bare, theirs)
                self.assertNotEqual(held, set(), "PREMISE")
                self.assertEqual(end_rhymes(w, theirs), held)
        self.assertGreater(judged, 0, "PREMISE: a possessive was judged")

    def test_an_in_spelling_reads_its_reduced_reading_then_its_own_entry(self):
        wrong = []
        for w, reduced in sorted(self.reduced.items()):
            own = self.own(self.lex, w)
            want = reduced + [p for p in own if p not in reduced]
            if self.lex.pronunciation_variants(w) != want:
                wrong.append(w)
        self.assertEqual(wrong[:5], [], f"{len(wrong)} of "
                         f"{len(self.reduced)} word(s)")

    def test_a_word_with_no_mark_at_its_edge_reads_as_before(self):
        # CONTROLS. A bare word, and a word whose apostrophe is inside it,
        # have no other spelling to read: the readings start with the word's
        # own entry, as they always did.
        rng = random.Random(self.SEED)
        words = sorted(w for w in self.lex.entries
                       if w.replace("'", "").isalpha() and len(w) > 2
                       and not w.startswith("'") and not w.endswith("'"))
        for w in rng.sample(words, 400) + [
                self.bare[x] for x in self.differ + self.possessive_differ[:40]]:
            own = self.own(self.lex, w)
            self.assertEqual(self.lex.pronunciation_variants(w)[:len(own)], own, w)

    def test_scheme_v1_is_frozen(self):
        # Under v1 the mark comes off and the bare spelling is the whole
        # answer, exactly as before the rule.
        old_entries = self.old.entries
        moved = [w for w in self.ruled + self.possessive
                 if self.bare[w] in old_entries
                 and self.old.pronunciation_variants(w)
                 != self.old.pronunciation_variants(self.bare[w])]
        self.assertEqual(moved[:5], [], f"{len(moved)} word(s) read "
                         f"differently under the frozen scheme")
        unread = [w for w in self.ruled if self.bare[w] not in old_entries
                  and not self.bare[w].endswith("in")
                  and self.old.pronunciation_variants(w) != []]
        self.assertEqual(unread[:5], [])


class AJoinedHyphenatedWordKeepsItsLineEnd(unittest.TestCase):
    """Reading a hyphenated word whole never takes away a sound its last
    piece had at a line's end (the coordinator's review of #913, 2026-11-23).

    Finding 12 reads a hyphenated word the dictionary has whole as that
    word, so `to-day` is `today`. But `sea-men` read piece by piece ends
    M EH1 N and the dictionary's `seamen` ends M AH0 N: joining took the
    rhyme with `again` away. The join now holds only where every reading of
    the last piece whose last syllable is stressed keeps that vowel and what
    follows it in some reading of the joined word; the stress mark itself
    may change. Scheme v1 is frozen and splits as before.

    The words are every hyphenated spelling in the repo's corpus whose
    joined letters are a dictionary word; nothing here is a chosen example.
    """

    @classmethod
    def setUpClass(cls):
        cls.lex = LH.Lexicon(strip_parens=True, pronunciations=None,
                             reader_scheme="v2")
        import re
        root = Path(LH.__file__).resolve().parent / "corpus"
        seen = set()
        for path in sorted(root.rglob("*.txt")):
            text = path.read_text(encoding="utf-8", errors="ignore")
            seen.update(w.lower() for w in
                        re.findall(r"[A-Za-z']+(?:-[A-Za-z']+)+", text))
        entries = cls.lex.entries
        cls.words = sorted(
            w for w in seen
            if all(len(p.strip("'")) > 1 for p in w.split("-"))
            and "".join(w.split("-")).strip("'") in entries
            and all(p.strip("'") in entries for p in w.split("-")))

    @staticmethod
    def ends(prons):
        out = set()
        for p in prons:
            idx = [i for i, ph in enumerate(p) if ph[-1] in "012"]
            if idx:
                out.add((p[idx[-1]][-1], p[idx[-1]][:-1], tuple(p[idx[-1] + 1:])))
        return out

    def test_the_premise_holds(self):
        joined = [w for w in self.words if len(self.lex.word_pieces(w)) == 1]
        split = [w for w in self.words if len(self.lex.word_pieces(w)) > 1]
        self.assertGreater(len(joined), 500)
        self.assertGreater(len(split), 50)

    def test_a_joined_word_keeps_every_stressed_line_end_of_its_last_piece(self):
        lost = []
        for w in self.words:
            if len(self.lex.word_pieces(w)) != 1:
                continue
            last = self.lex.entries[w.split("-")[-1].strip("'")]
            whole = self.lex.entries["".join(w.split("-")).strip("'")]
            kept = {e[1:] for e in self.ends(whole)}
            if any(e[0] in "12" and e[1:] not in kept for e in self.ends(last)):
                lost.append(w)
        self.assertEqual(lost[:5], [], f"{len(lost)} joined word(s)")

    def test_a_split_word_would_have_lost_one(self):
        # Every word that splits now, among those the syllable rule alone
        # would join, splits because joining would lose a stressed line end.
        kept_joinable = []
        for w in self.words:
            if len(self.lex.word_pieces(w)) == 1:
                continue
            last = self.lex.entries[w.split("-")[-1].strip("'")]
            whole = self.lex.entries["".join(w.split("-")).strip("'")]
            kept = {e[1:] for e in self.ends(whole)}
            if all(e[1:] in kept for e in self.ends(last) if e[0] in "12"):
                kept_joinable.append(w)
        # A split word whose ends all survive was split by the older rules
        # (syllable count), never by this one.
        for w in kept_joinable[:50]:
            pieces = w.split("-")
            counts = [{sum(1 for ph in p if ph[-1] in "012")
                       for p in self.lex.entries[x.strip("'")]} for x in pieces]
            total = (sum(next(iter(c)) for c in counts)
                     if all(len(c) == 1 for c in counts) else None)
            whole = self.lex.entries["".join(pieces).strip("'")]
            self.assertFalse(
                total is not None and all(
                    sum(1 for ph in p if ph[-1] in "012") == total
                    for p in whole), w)

    def test_the_line_end_is_heard_as_the_pieces_when_split(self):
        rng = random.Random(20261123)
        split = [w for w in self.words if len(self.lex.word_pieces(w)) > 1]
        for w in rng.sample(split, min(30, len(split))):
            last = w.split("-")[-1].strip("'")
            got = LH.line_anchors(self.lex, f"they said {w}")[0]
            want = LH.line_anchors(self.lex, f"they said {last}")[0]
            # The last piece's first reading is among the line end's; the
            # accent variants a bare word gains are not read inside a
            # hyphenated word on main either, so they are not asked for.
            with self.subTest(word=w):
                self.assertIn(want[0][-1]["nucleus"],
                              {a[-1]["nucleus"] for a in got})

    def test_a_split_word_still_rhymes_in_a_real_grade(self):
        # The coordinator's case, through the real `plan` and `song` verbs: a
        # line ending `sea-men` against one ending `again`, the plan's own
        # group on lines 2 and 3 under its default relation. Joined, the
        # pair went UNJUDGED (exit 2); split, it is judged, as on main. The
        # four lines open with four different words so no other check
        # decides the exit.
        import subprocess
        import tempfile
        harness = Path(LH.__file__).resolve()
        with tempfile.TemporaryDirectory() as tmp:
            draft = os.path.join(tmp, "draft.txt")
            bp = os.path.join(tmp, "bp.json")
            with open(draft, "w", encoding="utf-8") as fh:
                fh.write("Down the road past the old mill gate\n"
                         "I walk alone and I carry the sea-men\n"
                         "Night holds still with a slow again\n"
                         "Dawn comes up and the morning is late\n")
            run = lambda *a: subprocess.run(
                [sys.executable, str(harness), *a], cwd=str(harness.parent),
                capture_output=True, text=True, timeout=600)
            made = run("plan", "--seed=7", "--form=open", "--lines=4",
                       "--input-format=literal", f"--fill={draft}",
                       f"--out={bp}")
            self.assertEqual(made.returncode, 0, made.stdout[-2000:])
            got = run("song", bp, draft, "--input-format=literal",
                      "--groups=2,3", "--subdivision", "4")
        self.assertNotIn("UNJUDGED", got.stdout)
        self.assertEqual(got.returncode, 0, got.stdout[-2000:])

    def test_scheme_v1_is_frozen(self):
        old = LH.Lexicon(strip_parens=True, pronunciations=None,
                         reader_scheme="v1")
        joined = [w for w in self.words if len(old.word_pieces(w)) == 1]
        self.assertEqual(joined[:5], [])


class ACheckCountsAnEndWordAsSpelled(unittest.TestCase):
    """THE READER READS AN EDGE-MARKED WORD AS SPELLED (scheme v2,
    `AWordSpelledWithAnEdgeApostropheKeepsItsOwnEntry`), and a check that
    counts an end word's readings must count the same ones. The collision
    check (`coarse_relation_consensus`, quantifier "all") and `revise`'s
    test for whether an unpaired pair is ambiguous looked up only the bare
    key, so they judged `bein` where the reader reads `bein'`. A collision is a prohibition, charged only when
    every reading collides (owner ruling 2026-10-01); here each reading is
    asked on its own and the verdict must agree with all of them.

    The words are every dictionary word with an apostrophe at its edge whose
    readings as spelled add one its bare spelling lacks, which ends a line as
    itself, and whose bare spelling has a stressed reading. Each partner is a
    seeded draw from the words sharing that stressed reading's rime."""

    SEED, CONTROLS = 913, 200

    @classmethod
    def setUpClass(cls):
        lex = cls.lex = LH.Lexicon(strip_parens=True, pronunciations=None,
                                   reader_scheme="v2")
        cls.v1 = LH.Lexicon(strip_parens=True, pronunciations=None,
                            reader_scheme="v1")
        fold = LH.fold_apostrophes

        def raw(w):
            return fold(w).lower().strip('"“”.,;:!?()[]')

        def stressed(p):
            return any(x[-1] in "12" for x in p)

        def rime(p):
            i = max(k for k, x in enumerate(p) if x[-1] in "12")
            return (p[i][:-1],) + tuple(p[i + 1:])
        by = {}
        for w, prs in lex.entries.items():
            if w.isalpha() and w.islower():
                for p in prs:
                    if stressed(p):
                        by.setdefault(rime(p), set()).add(w)
        rng = random.Random(cls.SEED)
        cls.pairs = []
        for w in sorted(lex.entries):
            bare = raw(w).strip("'")
            if raw(w) == bare or bare not in lex.entries:
                continue
            own = [p for p in lex.pronunciation_variants(w)
                   if p not in lex.entries[bare]]
            line = f"we sang it {w}"
            toks = LH.line_tokens(line, strip_parens=True, scheme="v2")
            heads = [p for p in lex.entries[bare] if stressed(p)]
            if not own or not toks or toks[-1] != w or not heads:
                continue
            partners = sorted(by.get(rime(heads[0]), set()) - {bare})
            if partners:
                cls.pairs.append((w, line, rng.choice(partners)))
        rest = sorted(w for w in lex.entries if w.isalpha() and w.islower())
        cls.controls = random.Random(cls.SEED).sample(rest, cls.CONTROLS)

    def verdict(self, line, partner, phones=None):
        # With `phones`, the end word is asked with that one reading: its own
        # entry and its bare spelling's both hold just it, so the answer does
        # not depend on which of the two a check looks up.
        from quality.rhyme_types import coarse_relation_consensus
        w = line.split()[-1]
        keys = (w, w.strip("'"))
        saved = {k: self.lex.entries.get(k) for k in keys}
        if phones is not None:
            for k in keys:
                self.lex.entries[k] = [list(phones)]
        try:
            return coarse_relation_consensus(
                self.lex, line, f"the night was {partner}", LH.Declaration(),
                relation={"RHYME"}, min_score=LH.THETA_COLLISION,
                quantifier="all")
        finally:
            for k, v in saved.items():
                if v is None:
                    self.lex.entries.pop(k, None)
                else:
                    self.lex.entries[k] = v

    def test_premise_the_class_is_not_empty(self):
        self.assertTrue(self.pairs, "PREMISE")

    def test_the_readings_counted_are_the_readings_read(self):
        for w, _, _ in self.pairs:
            self.assertEqual(LH.end_word_readings(self.lex, w),
                             [list(p) for p in
                              self.lex.pronunciation_variants(w)], w)
            self.assertEqual(LH.end_word_readings(self.v1, w),
                             [list(p) for p in self.v1.entries.get(
                                 w.strip("'").lower(), ())], w)
        for w in self.controls:
            self.assertEqual(LH.end_word_readings(self.lex, w),
                             [list(p) for p in self.lex.entries[w]], w)

    def test_a_collision_is_charged_only_when_every_reading_collides(self):
        wrong, mixed = [], 0
        for w, line, partner in self.pairs:
            each = [self.verdict(line, partner, p)
                    for p in self.lex.pronunciation_variants(w)]
            if None in each:
                continue
            mixed += len(set(each)) > 1
            if self.verdict(line, partner) is not all(each):
                wrong.append((w, partner, each))
        self.assertTrue(mixed, "PREMISE: no word whose readings disagree")
        self.assertEqual(wrong, [])


    def collisions(self, line, partner):
        from quality import revise as RV
        from quality import schemes as SC
        lines = ["Down the road past the old mill gate", line,
                 "Dawn comes up and the morning is late",
                 f"the night was {partner}"]
        if hasattr(RV, "_SCORE_MEMO"):
            RV._SCORE_MEMO.clear()
        rev = RV.Reviser()
        graded = {(c[0], c[1]) for c in LH.check_scheme(
            rev.lex, lines, "ABAC", rev.decl)["collisions"]}
        ins = rev.inspect(lines, SC.mandate("ABAC", n_lines=4))
        revised = {tuple(f.locations) for fs in ins["per_line"].values()
                   for f in fs if f.code == "SCHEME_COLLISION"}
        return graded, revised

    def test_revise_charges_the_collisions_the_grade_charges(self):
        # `Reviser._collides_however_sung` decides whether an unpaired pair
        # must be asked again under every reading. Read with the bare key
        # (as before 2026-11-23) it took a word with one bare reading and two
        # as spelled for unambiguous, and charged a collision the grade did
        # not; the bare-key reading is put back at that one place to show it.
        wrong, split = [], []
        for w, line, partner in self.pairs:
            graded, revised = self.collisions(line, partner)
            if graded != revised:
                wrong.append((w, partner, graded, revised))
        saved = LH.end_word_readings

        def bare_here(reader, word):
            if sys._getframe(1).f_code.co_name == "_collides_however_sung":
                key = LH.fold_apostrophes(word).lower().strip("'\".,;:!?()[]")
                return list(reader.entries.get(key) or ())
            return saved(reader, word)
        LH.end_word_readings = bare_here
        try:
            for w, line, partner in self.pairs:
                graded, revised = self.collisions(line, partner)
                if graded != revised:
                    split.append(w)
        finally:
            LH.end_word_readings = saved
        self.assertEqual(wrong, [])
        self.assertTrue(split, "PREMISE: the bare key changes no answer")


if __name__ == "__main__":
    os.chdir(ROOT)
    unittest.main()

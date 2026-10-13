#!/usr/bin/env python3
"""The English reader's one cut (`lyric_harness.reader_line`, scheme v2) and
its frozen predecessor (scheme v1), as properties over generated lines.

The inputs are `quality/reader_cases.py`'s generated lines (an alphabet that
carries every character class the reader treats specially) plus its
`REGRESSIONS`, the reproductions of the defects the reader batch measured.
No test here is a list of named words the reader must accept.

  1. v1 is the pre-batch reader, byte for byte: the tokenizer, the consumers a
     legacy replay reads, the word-level readers a bare word reaches, the
     refusal text of a mismatched declaration, and CLI stdout, against
     `fixtures/reader_v1_oracle.json` (captured on the pre-batch tree;
     `fixtures/capture_reader_v1_oracle.py`).
  2. Nothing else moves: on lines without a trigger (a numeral, an ASCII dash
     run, U+00AD, U+2010/U+2011, a non-NFC sequence), v2 equals v1.
  3. Numerals: every N character outside a stripped aside sits in exactly one
     numeral token, the end word never skips a trailing numeral, and no
     numeral reaches the g2p fallback or a piece reader undeclared.
  4. Dash runs: no token holds `--`; k >= 2 hyphens split a token in two, one
     never does.
  5. Normalisation: NFD and NFC read alike; U+00AD at any interior position
     of a token (an enclitic's included) changes no text and grows its piece
     by one; U+2010/U+2011 read as `-`; U+2032 does not fold.
  6. Raw spans: pieces are disjoint, ascending and in range, contain no
     whitespace, and rebuild the token's text; beside a Hangul jamo
     composition too, and the Library claims `exact` only for such a span.
  7. One coordinate: line_tokens, Lexicon.transcribe, word_syllable_map,
     line_anchors' tags, English.tokens_for_line (with and without a
     lexicon), the relations stream and fit.read_line agree.
  8. Declarations: a declared reading on any token -- numeral or joined --
     validates and reads, and the grid's end word binds it through the
     reader's own runs; an undeclared numeral is refused visibly on every
     surface, as a numeral.
  9. Legacy replay plumbing: a deferred state or kitchen checkpoint without
     `reader_scheme` resumes as v1 (a pre-batch checkpoint byte for byte); a
     declared `--reader-scheme` that differs refuses; the run key is the
     pre-batch key under v1; a request's scheme does not outlive it in a warm
     process; the Gutenberg rows rebind by raw span.
 10. The website mirror's fixture is fresh (`reader_cases.py --check`).

Run: python3 quality/test_reader.py
"""
import copy
import json
import os
import subprocess
import sys
import tempfile
import unicodedata
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))

import lyric_harness as LH  # noqa: E402
import reader_cases as RC  # noqa: E402

ORACLE = json.loads((HERE / "fixtures" / "reader_v1_oracle.json").read_text(encoding="utf-8"))
GENERATED = RC.generated_lines() + RC.REGRESSIONS


def _triggered(text):
    """True when `text` carries a character class scheme v2 reads differently."""
    folded = text.replace("‐", "-").replace("‑", "-").replace("­", "")
    return (LH.has_numeral(text) or "--" in folded or "­" in text
            or "‐" in text or "‑" in text
            or not unicodedata.is_normalized("NFC", text))


def _texts(rl):
    return [t.text for t in rl.tokens]


class V1Frozen(unittest.TestCase):
    """1. Scheme v1 reproduces the pre-batch reader exactly."""

    @classmethod
    def setUpClass(cls):
        cls.lex = {True: LH.Lexicon(strip_parens=True, reader_scheme="v1"),
                   False: LH.Lexicon(strip_parens=False, reader_scheme="v1")}

    def test_tokenizer_matches_the_pre_batch_oracle(self):
        self.assertEqual([r["text"] for r in ORACLE["tokenizer"]], GENERATED,
                         "the generator moved; the oracle was captured on its old output")
        bad = []
        for row in ORACLE["tokenizer"]:
            for sp, key in ((True, "sp"), (False, "keep")):
                want = row[key]
                got = {"line_tokens": LH.line_tokens(row["text"], sp, scheme="v1"),
                       "raw_final_token": LH.raw_final_token(row["text"], sp, scheme="v1"),
                       "transcribe_words": self.lex[sp].transcribe(row["text"])[1]}
                if got != want:
                    bad.append((row["text"], sp, got, want))
        self.assertEqual(bad[:3], [])

    def test_consumers_match_the_pre_batch_oracle(self):
        import quality.fit as FT
        import quality.relations as RL
        import quality.grid as G
        import quality.loop as loop
        from quality.pronunciation import validate_choices
        sys.path.insert(0, str(HERE / "fixtures"))
        import capture_reader_v1_oracle as CAP
        lex = self.lex[True]
        rck = G.rime_cmudict(lex)
        bad = []
        with LH.reader_scheme_scope("v1"):
            for row in ORACLE["legacy"]:
                got = CAP.consumers(lex, row["text"], LH, FT, RL, G, loop, validate_choices, rck)
                got = json.loads(json.dumps({"text": row["text"], **got}, ensure_ascii=False))
                if got != row:
                    bad.append({k: (got[k], row[k]) for k in row if got.get(k) != row[k]})
        self.assertEqual(bad[:2], [])

    def test_word_level_readers_match_the_pre_batch_oracle(self):
        # A caller handing a bare word to the word-level readers (the
        # `capacity` verb, a word list) under v1 gets the pre-batch answer:
        # the reader-entry normalisation and the numeral guard are v2's.
        import quality.grid as G
        sys.path.insert(0, str(HERE / "fixtures"))
        import capture_reader_v1_oracle as CAP
        lexes = {"none": self.lex[True],
                 "high": LH.Lexicon(fallback="high", reader_scheme="v1"),
                 "low": LH.Lexicon(fallback="low", reader_scheme="v1")}
        words = [r["word"] for r in ORACLE["words"]]
        self.assertEqual(words, CAP.oracle_words(RC))
        with LH.reader_scheme_scope("v1"):
            got = CAP.word_records(words, lexes, LH, G)
            refusals = CAP.declaration_refusals(
                RC.generated_lines()[:200] + RC.REGRESSIONS, self.lex[True])
        bad = [(w, g) for w, g in zip(ORACLE["words"], got) if w != g]
        self.assertEqual(bad[:2], [])
        bad = [(w, g) for w, g in zip(ORACLE["declaration_refusals"], refusals) if w != g]
        self.assertEqual(bad[:2], [])
        self.assertEqual(len(refusals), len(ORACLE["declaration_refusals"]))

    def test_cli_stdout_matches_under_reader_scheme_v1(self):
        env = {k: v for k, v in os.environ.items() if k != "LYRIC_CONTROL_TOKEN"}

        def norm(stdout):
            out = []
            for line in stdout.splitlines():
                if line.startswith("  lyric result: "):
                    rec = json.loads(line[len("  lyric result: "):])
                    rec.pop("reader_scheme", None)
                    out.append(rec)
                else:
                    out.append(line)
            return out
        for case in ORACLE["cli"]:
            r = subprocess.run([sys.executable, str(ROOT / "lyric_harness.py"),
                                "--reader-scheme=v1"] + case["argv"],
                               capture_output=True, text=True, env=env, cwd=ROOT, timeout=600)
            with self.subTest(argv=case["argv"]):
                self.assertEqual(r.returncode, case["exit"])
                self.assertEqual(norm(r.stdout), norm(case["stdout"]))


class NothingElseMoves(unittest.TestCase):
    """2. Without a trigger, v2 is v1."""

    def _lines(self):
        plain = [t for t in RC.generated_lines(4000, seed=99) if not _triggered(t)]
        corpus = []
        for p in sorted((ROOT / "corpus" / "song").glob("eng_*.txt"))[::7]:
            with open(p, encoding="utf-8") as fh:
                corpus += [l.rstrip("\n") for k, l in enumerate(fh) if k % 11 == 0]
        return plain, [t for t in corpus if t.strip() and not _triggered(t)]

    def test_untriggered_lines_read_alike(self):
        plain, corpus = self._lines()
        self.assertGreater(len(plain), 200)
        self.assertGreater(len(corpus), 2000)
        moved = [(t, sp) for t in plain + corpus for sp in (True, False)
                 if LH.line_tokens(t, sp, "v2") != LH.line_tokens(t, sp, "v1")
                 or LH.raw_final_token(t, sp, "v2") != LH.raw_final_token(t, sp, "v1")]
        self.assertEqual(moved[:5], [])


class Numerals(unittest.TestCase):
    """3. A numeral is one token, refused unless declared."""

    def test_every_numeral_is_inside_exactly_one_numeral_token(self):
        checked = 0
        for text in GENERATED:
            if not unicodedata.is_normalized("NFC", text):
                continue          # a recomposed segment may be shared by two pieces
            kept = LH.reader_line(text, False).tokens
            aside = {i for t in kept if t.aside for a, b in t.pieces for i in range(a, b)}
            for sp in (True, False):
                rl = LH.reader_line(text, sp)
                for i, ch in enumerate(text):
                    if not LH._is_numeral(ch) or (sp and i in aside):
                        continue
                    owners = [t for t in rl.tokens if any(a <= i < b for a, b in t.pieces)]
                    self.assertEqual(len(owners), 1, (text, sp, i))
                    self.assertTrue(owners[0].numeral, (text, owners[0]))
                    checked += 1
        self.assertGreater(checked, 1000)

    def test_the_end_word_never_skips_a_trailing_numeral(self):
        # The tails are generated too: numeral strings drawn from the
        # generator's own numeral alphabet, bare or after Latin letters.
        import random
        rng = random.Random(20261013)
        for text in GENERATED:
            tail = "".join(rng.choice(RC.NUMERALS) for _ in range(rng.randint(1, 4)))
            if rng.random() < 0.4:
                tail = "".join(rng.choice("abcxyz") for _ in range(rng.randint(1, 3))) + tail
            line = text + " " + tail
            self.assertEqual(LH.raw_final_token(line), tail, line)
            self.assertEqual(LH.line_tokens(line)[-1], tail, line)

    def test_no_numeral_reaches_g2p_or_a_piece_reader(self):
        from quality import g2p
        lex = LH.Lexicon(fallback="low")
        seen = []
        real = g2p.Fallback.read

        def spy(self, word):
            seen.append(word)
            return real(self, word)
        g2p.Fallback.read = spy
        try:
            for text in GENERATED[:600]:
                LH.line_anchors(lex, text)
                LH.word_syllable_map(lex, text)
                LH.line_readability(lex, text)
        finally:
            g2p.Fallback.read = real
        self.assertTrue(seen)
        self.assertEqual([w for w in seen if LH.has_numeral(w)], [])
        # And `Fallback.read` refuses one itself, for a caller that bypasses
        # the lexicon.
        self.assertIsNone(lex.g2p_fallback.read("4ever"))
        for text in GENERATED:
            for t in LH.reader_line(text).tokens:
                if t.numeral:
                    self.assertEqual(lex.word_pieces(t.text), [t.text])
                    self.assertEqual(LH.Lexicon.transcribe_word(lex, t.text), ([], True))

    def test_undeclared_numeral_end_word_is_refused_with_its_cause(self):
        lex = LH.Lexicon()
        count = 0
        for text in GENERATED:
            rl = LH.reader_line(text)
            if not (rl.tokens and rl.tokens[-1].numeral and LH.printed_endpoint(rl) is None):
                continue
            count += 1
            anchors, _, oov = LH.line_anchors(lex, text)
            rec = LH.line_readability(lex, text)
            self.assertEqual(anchors, [], text)
            self.assertEqual(rec["final_unreadable_cause"], "numeral", text)
            self.assertIn("declared", rec["reason"])
            self.assertIn(rl.tokens[-1].text, rec["numeral_tokens"])
        self.assertGreater(count, 20)


class DashRuns(unittest.TestCase):
    """4. Two or more hyphens are punctuation; one joins."""

    def test_no_token_holds_a_dash_run(self):
        for text in GENERATED:
            for sp in (True, False):
                rl = LH.reader_line(text, sp)
                for t in rl.tokens + rl.runs:
                    self.assertNotIn("--", t.text, text)

    def test_inserted_runs_split_and_single_hyphens_do_not(self):
        checked = 0
        for text in GENERATED:
            if not unicodedata.is_normalized("NFC", text):
                continue          # whitespace-chunk pieces (see RawSpans)
            for t in LH.reader_line(text, False).tokens:
                if len(t.pieces) != 1 or len(t.text) < 2 or t.text != text[t.pieces[0][0]:t.pieces[0][1]]:
                    continue
                a, b = t.pieces[0]
                cut = next((k for k in range(a + 1, b)
                            if LH.LATIN_SCRIPT.match(text[k - 1]) and LH.LATIN_SCRIPT.match(text[k])), None)
                if cut is None:
                    continue
                for k in (2, 3):
                    new = text[:cut] + "-" * k + text[cut:]
                    toks = [x for x in LH.reader_line(new, False).tokens
                            if x.pieces[0][0] >= a and x.pieces[-1][1] <= b + k]
                    self.assertEqual(len(toks), 2, new)
                    self.assertEqual([p for x in toks for p in x.pieces],
                                     [(a, cut), (cut + k, b + k)], new)
                one = text[:cut] + "-" + text[cut:]
                self.assertEqual(len(LH.reader_line(one, False).tokens),
                                 len(LH.reader_line(text, False).tokens), one)
                checked += 1
                break
        self.assertGreater(checked, 300)


class Normalisation(unittest.TestCase):
    """5. NFC at entry, the hyphen folds, U+00AD ignored, U+2032 kept."""

    def test_nfd_and_nfc_read_alike(self):
        for text in GENERATED:
            for sp in (True, False):
                self.assertEqual(_texts(LH.reader_line(unicodedata.normalize("NFD", text), sp)),
                                 _texts(LH.reader_line(unicodedata.normalize("NFC", text), sp)), text)

    def test_soft_hyphen_inside_a_token_changes_no_text(self):
        # Every interior position of every piece of every token, joined
        # enclitics included (a soft hyphen beside an enclitic once made or
        # broke the join). A position before a combining mark is skipped:
        # there U+00AD would detach the mark, which is a different text.
        checked = 0
        for text in GENERATED + RC.V2_REGRESSIONS:
            if not unicodedata.is_normalized("NFC", text):
                continue
            for sp in (True, False):
                rl = LH.reader_line(text, sp)
                for k, t in enumerate(rl.tokens):
                    for a, b in t.pieces:
                        for pos in range(a + 1, b):
                            if unicodedata.category(text[pos])[0] == "M":
                                continue
                            new = text[:pos] + "\u00ad" + text[pos:]
                            after = LH.reader_line(new, sp)
                            self.assertEqual(_texts(after), _texts(rl), (new, sp))
                            if len(t.pieces) == 1 and "\u00ad" not in text:
                                self.assertEqual(after.tokens[k].pieces, ((a, b + 1),), new)
                            checked += 1
        self.assertGreater(checked, 10000)
        # Regressions: the enclitic join reads past U+00AD.
        self.assertEqual(LH.line_tokens("go 'm\u00adidst"), LH.line_tokens("go 'midst"))
        self.assertEqual(LH.line_tokens("There '\u00ads high"), ["There's", "high"])

    def test_unicode_hyphens_fold_and_prime_does_not(self):
        for text in GENERATED:
            if "-" not in text:
                continue
            for ch in ("‐", "‑"):
                self.assertEqual(_texts(LH.reader_line(text.replace("-", ch))),
                                 _texts(LH.reader_line(text)), text)
        # Residual, pinned: U+2032 is a different character and stays a breaker.
        self.assertEqual(LH.line_tokens("the minute′s mark"), ["the", "minute", "s", "mark"])


class RawSpans(unittest.TestCase):
    """6. Pieces locate every token in the original line."""

    def test_pieces_are_ordered_in_range_and_rebuild_the_text(self):
        # A line NFC changes across characters (Hangul jamo) is read in
        # whitespace chunks: its pieces cover the chunk, so only the order,
        # range and whitespace properties are asked of it.
        for text in GENERATED:
            for sp in (True, False):
                rl = LH.reader_line(text, sp)
                prev_end = 0
                overlap = False
                for t in rl.tokens:
                    last = -1
                    for a, b in t.pieces:
                        self.assertTrue(0 <= a < b <= len(text) and a >= last, (text, t))
                        last = b
                        self.assertFalse(any(c.isspace() for c in text[a:b]), (text, t))
                    overlap = overlap or t.pieces[0][0] < prev_end
                    prev_end = t.pieces[-1][1]
                    raw = "".join(text[a:b] for a, b in t.pieces)
                    if not overlap and unicodedata.is_normalized("NFC", text):
                        self.assertEqual(LH.normalise_word(raw), t.text, (text, t))

    def test_raw_runs_never_cross_whitespace(self):
        # Regression: a space followed by marks in non-canonical order is a
        # segment NFC changes, and every output character mapped to the whole
        # segment, so a run built from the marks took the space into its piece
        # (and the v2 end-word swap deleted it). Marks are inserted after every
        # space of generated lines in both orders.
        marks = ("\u0308\u0327", "\u0327\u0308", "\u0301")
        checked = 0
        for k, text in enumerate(GENERATED[:1500]):
            line = text.replace(" ", " " + marks[k % len(marks)], 1)
            for sp in (True, False):
                for t in LH.reader_line(line, sp).runs + LH.reader_line(line, sp).tokens:
                    for a, b in t.pieces:
                        self.assertFalse(any(c.isspace() for c in line[a:b]), (line, t))
                        checked += 1
        self.assertGreater(checked, 1000)
        from quality.loop import swap_end_word
        self.assertEqual(swap_end_word("we go \u0308\u0327b", "night"), "we go night")


class HangulSegments(unittest.TestCase):
    """6b. A Hangul composition maps as its own segment, not a whole chunk."""

    def test_latin_tokens_keep_exact_spans_beside_a_jamo_composition(self):
        checked = 0
        for text in GENERATED + RC.V2_REGRESSIONS:
            if unicodedata.is_normalized("NFC", text) or not any(
                    LH._is_hangul(c) for c in text):
                continue
            for t in LH.reader_line(text, False).tokens:
                raw = "".join(text[a:b] for a, b in t.pieces)
                self.assertEqual(LH.normalise_word(raw), t.text, (text, t))
                checked += 1
        self.assertGreater(checked, 3)

    def test_the_library_claims_exact_only_for_spans_that_rebuild(self):
        sys.path.insert(0, str(ROOT / "library"))
        import library.test_analysis as TA
        # The last two are regressions: a printed endpoint sharing characters
        # with the token before it gave two overlapping exact ranges.
        for text in ["love,night \u1100\u1161 sing", "\u1100\u1161\u11a8 cafe\u0301, night",
                     "go \u043a\u043e\u04425", "love q\u0303uiet"]:
            _, records, _ = TA.complete(TA.source(text), schemas=[])
            spans = []
            covered = set()
            for r in records:
                if r["kind"] != "token":
                    continue
                for rng in r["source_ranges"]:
                    if rng.get("precision") == "exact":
                        a, b = rng["codepoint_range"]
                        self.assertEqual(LH.normalise_word(text[a:b]), r["text"], (text, r))
                        spans.append((a, b))
                        self.assertFalse(covered & set(range(a, b)), (text, r))
                        covered |= set(range(a, b))
            self.assertEqual(len(spans), len(set(spans)), text)


class OneCoordinate(unittest.TestCase):
    """7. Every English surface cuts the line the same way."""

    @classmethod
    def setUpClass(cls):
        from quality.phonology.eng import English
        cls.lex = LH.Lexicon()
        cls.eng_lex = English(lexicon=cls.lex)
        cls.eng_plain = English()

    def test_consumers_share_the_token_coordinate(self):
        import quality.fit as FT
        import quality.relations as RL
        for text in GENERATED[:700] + ["we go (oh) 's the night"]:
            words = LH.line_tokens(text)
            self.assertEqual(self.lex.transcribe(text)[1], words, text)
            for s in LH.word_syllable_map(self.lex, text):
                self.assertEqual(words[s["widx"]], s["word"], text)
            anchors, _, _ = LH.line_anchors(self.lex, text)
            for a in anchors:
                for s in a:
                    if "widx" in s:
                        self.assertEqual(words[s["widx"]], s["word"], text)
            rl = LH.reader_line(text)
            endpoint = [LH.printed_endpoint(rl).text] if LH.printed_endpoint(rl) else []
            self.assertEqual(self.eng_lex.tokens_for_line(text), words + endpoint, text)
            self.assertEqual(self.eng_plain.tokens_for_line(text), words + endpoint, text)
            st = RL.build_stream([text], self.eng_plain)
            self.assertEqual(list(st.lexical_tokens[0]), words + endpoint, text)
            self.assertEqual(list(FT.read_line(text).tokens), words, text)

    def test_the_printed_endpoint_never_precedes_the_last_token(self):
        # Regression: `I said ×` (U+00D7 is in the token repertoire, not a
        # letter run) appended `said` again as the stream's boundary, so the
        # stream judged a readable end word line_anchors refuses.
        checked = 0
        for text in GENERATED + ["I said \u00d7", "x \u00d72"]:
            rl = LH.reader_line(text)
            end = LH.printed_endpoint(rl)
            if end is None or not rl.tokens:
                continue
            checked += 1
            self.assertGreaterEqual(end.pieces[-1][1], rl.tokens[-1].pieces[-1][1], text)
        self.assertGreater(checked, 20)
        self.assertEqual(self.eng_plain.tokens_for_line("I said \u00d7"), ["I", "said", "\u00d7"])
        self.assertEqual(LH.line_anchors(self.lex, "I said \u00d7")[0], [])

    def test_the_relation_stream_keeps_the_lexicons_aside_rule(self):
        # Regression: under v2 the declared-relation judge's stream stripped
        # `(...)` even for a `--voices` lexicon (relation_phonology_for handed
        # a plain lexicon the shared reader), so it read another end word than
        # line_anchors. Under v1 the stream reads no aside rule, as before.
        import quality.relations as RL
        from quality.revise import Reviser
        for sp in (True, False):
            lex = LH.Lexicon(strip_parens=sp)
            phon = Reviser(lex)._relation_phonology()
            checked = 0
            for text in GENERATED[:700]:
                rl = LH.reader_line(text, sp)
                end = LH.printed_endpoint(rl)
                want = LH.line_tokens(text, sp) + ([end.text] if end else [])
                self.assertEqual(phon.tokens_for_line(text), want, (sp, text))
                checked += "(" in text
            self.assertGreater(checked, 50)
            st = RL.build_stream(["I love you (yeah)", "and I need you (oh)"], phon)
            self.assertEqual([t[-1] for t in st.lexical_tokens],
                             ["you", "you"] if sp else ["yeah", "oh"])
        with LH.reader_scheme_scope("v1"):
            phon = Reviser(LH.Lexicon(strip_parens=False))._relation_phonology()
            self.assertIsNone(phon.tokens_for_line("I love you (yeah)"))

    def test_the_enclitic_after_an_aside_keeps_its_position(self):
        # Regression: under v1 `" ".join(words[:-1])` re-cut the prefix as
        # `go's`, its phones no longer matched the tokens' and the anchor lost
        # its word tags. v2 reads the prefix by position.
        text = "we go (oh) 's the night"
        words = LH.line_tokens(text)
        self.assertEqual(words, ["we", "go", "'s", "the", "night"])
        anchors, last, _ = LH.line_anchors(self.lex, text)
        self.assertEqual(last, "night")
        self.assertEqual([(s["word"], s["widx"]) for s in anchors[0]],
                         [("'s", 2), ("the", 3), ("night", 4)])
        legacy, _, _ = LH.line_anchors(LH.Lexicon(reader_scheme="v1"), text)
        self.assertTrue(legacy and all("widx" not in s for s in legacy[0]))


class Declarations(unittest.TestCase):
    """8. A declared reading binds any token, numeral and joined alike."""

    def test_a_declared_reading_binds_every_kind_of_token(self):
        from quality.pronunciation import validate_choices
        import quality.fit as FT
        from quality.phonology.eng import English
        base = LH.Lexicon()
        checked = numerals = 0
        for text in GENERATED[:500]:
            if len(text) > 4000 or any(c in text for c in "\r\n") or not text.strip():
                continue
            rl = LH.reader_line(text)
            # A line whose last letter run is not its last token (a final
            # `×`, which the token repertoire reads and no letter run does)
            # is refused by line_anchors whatever is declared, as before the
            # batch.
            if (not rl.tokens or LH.printed_endpoint(rl) is not None
                    or LH.raw_final_token(text) != rl.tokens[-1].text):
                continue
            k = len(rl.tokens)
            row = {"line": text, "token": k, "word": rl.tokens[-1].text,
                   "phones": ["N", "AY1", "N"], "basis": "declared", "source": "test"}
            lex = copy.copy(base)
            lex.pronunciations = validate_choices([row], lex)
            anchors, _, _ = LH.line_anchors(lex, text)
            self.assertTrue(anchors, text)
            self.assertEqual(anchors[0][-1]["nucleus"], "AY", text)
            rec = LH.line_readability(lex, text)
            self.assertTrue(rec["readable"], text)
            self.assertEqual(rec["numeral_tokens"],
                             [t.text for t in rl.tokens[:-1] if t.numeral], text)
            # The declaration reads the token whole: none of its pieces is an
            # unread piece of the end word.
            self.assertEqual(rec["final_unread_pieces"], [], text)
            lu = FT.read_line(text, English(lexicon=lex))
            self.assertNotIn(rl.tokens[-1].text,
                             [r.token for r in lu.refused if r.cause == "NUMERAL"], text)
            numerals += rl.tokens[-1].numeral
            checked += 1
        self.assertGreater(checked, 50)
        self.assertGreater(numerals, 5)

    def test_the_grid_endpoint_binds_through_the_reader(self):
        # `rime_cmudict.end_occurrence` (the reviser's song-function key)
        # binds a declared reading exactly when the line's last physical run
        # is its last sung token, and then keys the declared phones; any other
        # endpoint stays unbound and keys the run's reader spelling.
        import quality.grid as G
        from quality.pronunciation import validate_choices
        base = LH.Lexicon()
        bound = unbound = 0
        for text in GENERATED + RC.V2_REGRESSIONS:
            if len(text) > 4000 or any(c in text for c in "\r\n") or not text.strip():
                continue
            rl = LH.reader_line(text)
            runs = LH.reader_line(text, False).runs
            if not rl.tokens or not runs:
                continue
            last, tok = runs[-1], rl.tokens[-1]
            row = {"line": text, "token": len(rl.tokens), "word": tok.text,
                   "phones": ["N", "AY1", "N"], "basis": "declared", "source": "test"}
            lex = copy.copy(base)
            lex.pronunciations = validate_choices([row], lex)
            word, token, key = G.rime_cmudict(lex).end_occurrence(text)
            self.assertEqual(word, G.normalise_line(last.text), text)
            if last.pieces == tok.pieces and last.text == tok.text:
                self.assertEqual((token, key), (len(rl.tokens), "AY N"), text)
                bound += 1
            else:
                self.assertIsNone(token, text)
                self.assertEqual(key, G.rime_cmudict(base)(word), text)
                unbound += 1
        self.assertGreater(bound, 500)
        self.assertGreater(unbound, 20)
        # Regressions: no fragment of a token is ever the end word, and an
        # undeclared numeral endpoint keys nothing.
        rk = G.rime_cmudict(base)
        self.assertEqual(rk.end_occurrence("we sing 4\u2011ever"), ("4-ever", 3, None))
        self.assertEqual(rk.end_occurrence("we co\u00adoperate")[:2], ("cooperate", 2))
        self.assertEqual(rk.end_occurrence("we sing it to\u2011night"),
                         rk.end_occurrence("we sing it to-night"))

    def test_an_undeclared_numeral_is_refused_on_every_surface(self):
        import quality.fit as FT
        import quality.relations as RL
        from quality.phonology.eng import English
        text = "we sing 4ever"
        lu = FT.read_line(text)
        self.assertEqual([(r.token, r.cause) for r in lu.refused], [("4ever", "NUMERAL")])
        self.assertEqual(LH.line_readability(LH.Lexicon(), text)["final_unreadable_cause"], "numeral")
        st = RL.build_stream([text], English())
        self.assertIn((0, 2, "4ever"), st.unreadable)
        # A numeral end run that is not one whole English token (`×2` is the
        # token, `2` the run) is a numeral refusal too, never a G2P gap.
        for line in ("x \u00d72", "go \u043a\u043e\u04425"):
            rec = LH.line_readability(LH.Lexicon(), line)
            self.assertEqual(rec["final_unreadable_cause"], "numeral", line)
            self.assertNotIn("G2P", rec["reason"], line)
            causes = {r.cause for r in FT.read_line(line).refused}
            self.assertEqual(causes, {"NUMERAL"}, line)


class LegacyReplay(unittest.TestCase):
    """9. A run keeps the scheme it was recorded under."""

    def _state(self, payload):
        fd, path = tempfile.mkstemp(suffix=".json")
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh)
        self.addCleanup(os.unlink, path)
        return path

    def test_a_recorded_state_names_the_scheme_a_resume_reads(self):
        resumed = {"version": 1, "answered": {"propose": [["x"]], "propose_group": []},
                   "pending": None}
        self.assertIsNone(LH._recorded_reader_scheme(["revise", "f.txt"]))
        self.assertIsNone(LH._recorded_reader_scheme(
            ["revise", "f.txt", "--propose=defer:/nonexistent/state.json"]))
        # A state FILE is always a record: this build writes the field into
        # every state it creates, so one without it -- even one with no
        # answer, no pending question and no completion marker, like a
        # pre-batch safe-point stop or mid-run save -- predates the field.
        bare = self._state({"version": 1, "answered": {"propose": [], "propose_group": []},
                            "pending": None})
        self.assertEqual(LH._recorded_reader_scheme(["revise", "--propose=defer:" + bare]), "v1")
        legacy = self._state(resumed)
        self.assertEqual(LH._recorded_reader_scheme(["revise", "--propose=defer:" + legacy]), "v1")
        self.assertEqual(LH._recorded_reader_scheme(["revise", "--propose", "defer:" + legacy]), "v1")
        current = self._state({**resumed, "reader_scheme": "v2"})
        self.assertEqual(LH._recorded_reader_scheme(["revise", "--propose=defer:" + current]), "v2")
        # An unreadable or unknown record answers None here (the verb's own
        # output comes first); the deferred proposer refuses it later.
        bogus = self._state({**resumed, "reader_scheme": "v9"})
        self.assertIsNone(LH._recorded_reader_scheme(["revise", "--propose=defer:" + bogus]))
        broken = self._state([1, 2])
        self.assertIsNone(LH._recorded_reader_scheme(["revise", "--propose=defer:" + broken]))
        # A finished run that converged without asking anything records only
        # its completion marker; it is a record, not new work.
        finished = self._state({"version": 1, "answered": {"propose": [], "propose_group": []},
                                "pending": None, "complete": {"stop": "success", "exit": 0}})
        self.assertEqual(LH._recorded_reader_scheme(["revise", "--propose=defer:" + finished]), "v1")
        # A replay file is a finished state's `answered` block: without the
        # field it predates it.
        for payload, want in (({"propose": [], "propose_group": []}, "v1"),
                              ({"propose": [], "propose_group": [], "reader_scheme": "v2"}, "v2"),
                              ({"propose": [], "reader_scheme": "v9"}, None)):
            rp = self._state(payload)
            self.assertEqual(LH._recorded_reader_scheme(["revise", "--propose=replay:" + rp]), want)
        import contextlib
        import io
        with contextlib.redirect_stdout(io.StringIO()) as out, self.assertRaises(SystemExit):
            LH._defer_proposer(bogus, ["a line", "b line"])
        self.assertIn("recorded reader scheme 'v9'", out.getvalue())
        # A kitchen checkpoint records it too; absent is v1.
        old = os.environ.get("LYRIC_CHECKPOINT_PATH")
        try:
            for payload, want in (({"version": 1}, "v1"),
                                  ({"version": 1, "reader_scheme": "v2"}, "v2")):
                os.environ["LYRIC_CHECKPOINT_PATH"] = self._state(payload)
                self.assertEqual(LH._recorded_reader_scheme(
                    ["revise", "--propose=call:mod:factory"]), want)
        finally:
            if old is None:
                os.environ.pop("LYRIC_CHECKPOINT_PATH", None)
            else:
                os.environ["LYRIC_CHECKPOINT_PATH"] = old

    def test_pre_batch_states_without_an_answer_resume_as_v1(self):
        # Real states the PRE-BATCH harness wrote (fixtures/
        # reader_v1_defer_states.json, captured on fce4bf0f by
        # capture_reader_v1_defer_states.py): the safe-point stop a call with
        # a deadline writes (`stopped`), and the mid-run saves (`started`,
        # and `grading` with a saved position). None holds an answer, a
        # pending question or a completion marker. Resumed through the CLI
        # with no flag, each reads as v1, keeps v1 in the state it writes
        # back, and reproduces what the pre-batch harness printed resuming
        # the same state -- up to the scheme field and the saved position,
        # which this build's scorer does not trust: it replays from round 1,
        # so the pre-batch record it matches is the resume without the
        # position (`replay_*`).
        fx = json.loads((HERE / "fixtures" / "reader_v1_defer_states.json")
                        .read_text(encoding="utf-8"))
        env = {k: v for k, v in os.environ.items()
               if k not in ("LYRIC_CONTROL_TOKEN", "LYRIC_REQUEST_DEADLINE_MS",
                            "LYRIC_CHECKPOINT_PATH")}

        def strip(rec):
            return {k: v for k, v in rec.items()
                    if k not in ("reader_scheme", "cursor") and not k.startswith("cursor_")}

        def norm(stdout):
            out = []
            for line in stdout.splitlines():
                for tag in ("  lyric result: ", "  lyric checkpoint: "):
                    if line.startswith(tag):
                        out.append((tag, strip(json.loads(line[len(tag):]))))
                        break
                else:
                    out.append(line)
            return out
        self.assertEqual([r["name"] for r in fx["states"]],
                         ["stopped", "started", "grading+cursor"])
        for rec in fx["states"]:
            work = Path(tempfile.mkdtemp())
            self.addCleanup(__import__("shutil").rmtree, work, True)
            (work / "draft.txt").write_text("\n".join(fx["draft"]) + "\n", encoding="utf-8")
            state = work / "state.json"
            state.write_text(rec["state"], encoding="utf-8")
            self.assertNotIn("reader_scheme", json.loads(rec["state"]))
            self.assertEqual(LH._recorded_reader_scheme(
                [a.replace("<WORK>", str(work)) for a in fx["verb"]]), "v1")
            r = subprocess.run([sys.executable, str(ROOT / "lyric_harness.py"),
                                *[a.replace("<WORK>", str(work)) for a in fx["verb"]]],
                               capture_output=True, text=True, env=env, cwd=ROOT, timeout=900)
            with self.subTest(state=rec["name"]):
                self.assertEqual(r.returncode, rec["replay_exit"], r.stdout[-600:])
                got = norm(r.stdout.replace(str(work), "<WORK>"))
                self.assertEqual(got, norm(rec["replay_stdout"]))
                self.assertIn('"reader_scheme":"v1"', r.stdout)
                self.assertNotIn('"reader_scheme":"v2"', r.stdout)
                written = json.loads(state.read_text(encoding="utf-8"))
                self.assertEqual(written["reader_scheme"], "v1")
                self.assertNotIn("reader_scheme", written["answered"])
                self.assertEqual(strip(written), strip(json.loads(rec["replay_written"])))

    def test_an_explicit_other_scheme_refuses_to_resume(self):
        import contextlib
        import io
        legacy = self._state({"version": 1, "pending": None,
                              "answered": {"propose": [["x"]], "propose_group": []}})
        saved = (LH._ACTIVE_READER_SCHEME, LH._READER_SCHEME_DECLARED)
        LH._ACTIVE_READER_SCHEME, LH._READER_SCHEME_DECLARED = "v2", True
        try:
            with contextlib.redirect_stdout(io.StringIO()) as out, \
                    self.assertRaises(SystemExit):
                LH._defer_proposer(legacy, ["a line", "b line"])
        finally:
            LH._ACTIVE_READER_SCHEME, LH._READER_SCHEME_DECLARED = saved
        self.assertIn("READER_SCHEME_MISMATCH", out.getvalue())
        self.assertIn("--reader-scheme=v1", out.getvalue())

    def test_the_run_key_is_the_pre_batch_key_under_v1(self):
        from quality import replay_memo as RM
        argv = ["revise", "draft.txt", "AA"]
        legacy = RM._digest(json.dumps({"argv": argv, "inputs": []}))
        self.assertEqual(RM.run_key(argv), legacy)
        self.assertEqual(RM.run_key(argv + ["--reader-scheme=v1"], reader_scheme="v1"), legacy)
        v2 = RM.run_key(argv, reader_scheme="v2")
        self.assertNotEqual(v2, legacy)
        self.assertEqual(RM.run_key(["--reader-scheme=v2"] + argv, reader_scheme="v2"), v2)

    def test_a_pre_batch_checkpoint_resumes_byte_for_byte(self):
        # A kitchen (`call:`) checkpoint written on the pre-batch tree
        # (fixtures/reader_v1_checkpoint.json) resumes with no flag and with
        # --reader-scheme=v1, reproducing the pre-batch resume; a contrary
        # flag refuses by name. A checkpoint this build writes under v2
        # resumes with or without --reader-scheme=v2.
        fx = json.loads((HERE / "fixtures" / "reader_v1_checkpoint.json").read_text(encoding="utf-8"))
        work = Path(tempfile.mkdtemp())
        self.addCleanup(__import__("shutil").rmtree, work, True)
        (work / "stubwriter.py").write_text(
            "def factory():\n    def call(prompt):\n        return %r\n    return call\n"
            % fx["stub_answer"], encoding="utf-8")
        draft = work / "draft.txt"
        draft.write_text("\n".join(fx["draft"]) + "\n", encoding="utf-8")
        env = {k: v for k, v in os.environ.items() if k != "LYRIC_CONTROL_TOKEN"}
        env["PYTHONPATH"] = str(work)

        def run(ck, *flags):
            e = dict(env, LYRIC_CHECKPOINT_PATH=str(ck))
            return subprocess.run([sys.executable, str(ROOT / "lyric_harness.py"), *flags,
                                   "revise", str(draft), "AA",
                                   "--propose=call:stubwriter:factory"],
                                  capture_output=True, text=True, env=e, cwd=ROOT, timeout=900)

        def norm(stdout):
            out = []
            for line in stdout.splitlines():
                if line.startswith("  lyric result: "):
                    rec = json.loads(line[len("  lyric result: "):])
                    rec.pop("reader_scheme", None)
                    out.append(rec)
                else:
                    out.append(line)
            return out
        for flags in ((), ("--reader-scheme=v1",)):
            ck = work / "ck.json"
            ck.write_text(fx["checkpoint"], encoding="utf-8")
            r = run(ck, *flags)
            with self.subTest(flags=flags):
                self.assertEqual(r.returncode, fx["resume_exit"], r.stdout[-600:])
                self.assertEqual(norm(r.stdout), norm(fx["resume_stdout"]))
                self.assertEqual(ck.read_text(encoding="utf-8"), fx["resumed_checkpoint"])
        ck.write_text(fx["checkpoint"], encoding="utf-8")
        r = run(ck, "--reader-scheme=v2")
        self.assertEqual(r.returncode, 2)
        self.assertIn("READER_SCHEME_MISMATCH", r.stdout)
        fresh = work / "fresh.json"
        first = run(fresh)
        self.assertEqual(json.loads(fresh.read_text(encoding="utf-8"))["reader_scheme"], "v2")
        saved = fresh.read_text(encoding="utf-8")
        for flags in ((), ("--reader-scheme=v2",)):
            fresh.write_text(saved, encoding="utf-8")
            r = run(fresh, *flags)
            with self.subTest(v2_flags=flags):
                self.assertEqual(r.returncode, first.returncode, r.stdout[-600:])
                self.assertNotIn("REFUSED", r.stdout)
        fresh.write_text(saved, encoding="utf-8")
        self.assertIn("READER_SCHEME_MISMATCH", run(fresh, "--reader-scheme=v1").stdout)

    def test_a_request_does_not_leak_its_scheme_into_the_process(self):
        # The warm worker serves lyrics requests through `main` and Library
        # analyses directly; a v1 request must not leave the next analysis
        # reading v1 (nor English's shared lexicon built under v1).
        import contextlib
        import io
        from quality.phonology import eng
        saved_argv = sys.argv
        try:
            sys.argv = ["lyric_harness.py", "--reader-scheme=v1", "score", "we sing 4ever -- ever"]
            with contextlib.redirect_stdout(io.StringIO()):
                LH.cli()
            self.assertEqual(LH.resolve_reader_scheme(None), "v2")
            self.assertFalse(LH._READER_SCHEME_DECLARED)
            with LH.reader_scheme_scope("v1"):
                self.assertEqual(eng._lexicon().reader_scheme, "v1")
            self.assertEqual(eng._lexicon().reader_scheme, "v2")
        finally:
            sys.argv = saved_argv

    def test_process_memos_tell_the_schemes_apart(self):
        # The grader's process-level memos (`Reviser._decl_lex_key`) carry the
        # lexicon's scheme and the process's, so a warm worker never serves a
        # v2 answer to a v1 replay or the reverse.
        from quality.revise import Reviser
        keys = {}
        for scheme in LH.READER_SCHEMES:
            r = Reviser(lex=LH.Lexicon(reader_scheme=scheme))
            keys[scheme] = (r._decl_lex_key(), r._score_memo_key(None))
            with LH.reader_scheme_scope(scheme):
                keys["process-" + scheme] = Reviser(lex=LH.Lexicon())._decl_lex_key()
        self.assertNotEqual(keys["v1"][0], keys["v2"][0])
        self.assertNotEqual(keys["v1"][1], keys["v2"][1])
        self.assertNotEqual(keys["process-v1"], keys["process-v2"])

    def test_a_legacy_resume_reads_alike_cold_and_after_v2_work(self):
        # worker.py's shape: two requests through `cli` in one process. A
        # pre-batch-shaped state (a v1 state without the field) resumed after
        # v2 work in the same process must give the cold resume's verdict.
        import contextlib
        import io
        work = Path(tempfile.mkdtemp())
        self.addCleanup(__import__("shutil").rmtree, work, True)
        draft = work / "d.txt"
        draft.write_text("My kettle whistles by the qzzxv\n"
                         "Your fingers brush my heavy coat 4\n", encoding="utf-8")
        verb = ["revise", str(draft), "--groups=1,2", "--relation=class:ASSONANCE",
                "--max-rounds=1", "--attempts=1", "--backtrack=0"]
        answer = "My kettle whistles by the stove"

        def cold(propose, *globals_):
            return subprocess.run([sys.executable, str(ROOT / "lyric_harness.py"), *globals_,
                                   *verb, propose], capture_output=True, text=True, cwd=ROOT,
                                  timeout=900)

        def warm(*flags):
            out = io.StringIO()
            saved = sys.argv
            sys.argv = ["lyric_harness.py", *verb, *flags]
            try:
                with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
                    try:
                        LH.cli()
                    except SystemExit:
                        pass
            finally:
                sys.argv = saved
            return out.getvalue()

        def answered(path, legacy):
            # The pre-batch shape: no scheme field, and no saved position this
            # build's scorer trusts (a cursor taken by other code replays from
            # round 1, which is what reaches the memo).
            st = json.loads(path.read_text(encoding="utf-8"))
            if legacy:
                st.pop("reader_scheme", None)
                st.pop("cursor", None)
            st["pending"]["answer"] = answer
            path.write_text(json.dumps(st), encoding="utf-8")

        def verdict(stdout):
            for line in stdout.splitlines():
                if line.startswith("  lyric result: "):
                    rec = json.loads(line[len("  lyric result: "):])
                    return {k: v for k, v in rec.items()
                            if not k.startswith(("memo_", "cursor_"))}
            self.fail(stdout[-600:])
        legacy = work / "legacy.json"
        cold("--propose=defer:" + str(legacy), "--reader-scheme=v1")
        answered(legacy, True)
        saved = legacy.read_text(encoding="utf-8")
        want = verdict(cold("--propose=defer:" + str(legacy)).stdout)
        self.assertEqual(want["reader_scheme"], "v1")
        fresh = work / "fresh.json"
        warm("--propose=defer:" + str(fresh))
        answered(fresh, False)
        self.assertEqual(verdict(warm("--propose=defer:" + str(fresh)))["reader_scheme"], "v2")
        legacy.write_text(saved, encoding="utf-8")
        self.assertEqual(verdict(warm("--propose=defer:" + str(legacy))), want)

    def test_the_flag_refuses_an_undeclared_scheme(self):
        r = subprocess.run([sys.executable, str(ROOT / "lyric_harness.py"),
                            "--reader-scheme=v3", "score", "a -- b"],
                           capture_output=True, text=True, cwd=ROOT, timeout=600)
        self.assertEqual(r.returncode, 2)
        self.assertIn("--reader-scheme wants v1 or v2", r.stdout)

    def test_declarations_rebind_by_raw_span_and_refuse_without_one(self):
        from quality.pronunciation import rebind_occurrences
        line = "U--h, Lawdy, ol’ lady got rough,"
        rows = [dict(line=line, token=t, word=w, phones=["AH1"], basis="declared", source="x")
                for t, w in ((2, "Lawdy"), (3, "ol'"), (5, "got"))]
        moved = rebind_occurrences(rows, "v1", "v2", strip_parens=False)
        self.assertEqual([r["token"] for r in moved], [3, 4, 6])
        self.assertEqual(rebind_occurrences(moved, "v2", "v1", strip_parens=False), rows)
        with self.assertRaisesRegex(ValueError, "same raw span"):
            rebind_occurrences([dict(rows[0], line="thee--Arise", token=1, word="thee--Arise")],
                               "v1", "v2")
        # On generated lines every v1 token whose raw span survives moves to
        # the v2 token with that span, and only there.
        for text in GENERATED[:400]:
            src = LH.reader_token_spans(text, True, "v1") or []
            dst = LH.reader_token_spans(text, True, "v2")
            for k, (word, pieces) in enumerate(src):
                row = dict(line=text, token=k + 1, word=word, phones=["AH1"],
                           basis="declared", source="x")
                hits = [j for j, (w, p) in enumerate(dst) if p == pieces and w == word]
                if len(hits) == 1:
                    self.assertEqual(rebind_occurrences([row], "v1", "v2")[0]["token"], hits[0] + 1)
                else:
                    with self.assertRaises(ValueError):
                        rebind_occurrences([row], "v1", "v2")


class MirrorFixture(unittest.TestCase):
    """10. The website mirror's agreement fixture is what the reader returns."""

    def test_mirror_fixture_is_fresh(self):
        path = ROOT / RC.MIRROR_FIXTURE
        want = json.dumps(RC.mirror_fixture(), ensure_ascii=False, separators=(",", ":")) + "\n"
        self.assertTrue(path.read_text(encoding="utf-8") == want,
                        "rebuild: python3 quality/reader_cases.py --write")


if __name__ == "__main__":
    unittest.main()

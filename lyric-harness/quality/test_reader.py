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
     declared `--reader-scheme` that differs refuses, on `tryline`'s
     pre-flight against a deferred state as on the resume (one read-only
     check); a call checkpoint's `answered` block replays on its own
     scheme; the run key is the
     pre-batch key under v1; a request's scheme does not outlive it in a warm
     process; the Gutenberg rows rebind by raw span.
 10. The website mirror's fixture is fresh (`reader_cases.py --check`).
 11. Evidence asked for by the review: real pre-batch deferred states of every
     status resume as v1 through the CLI (`fixtures/reader_v1_defer_states.json`);
     one warm worker (`mcp/worker.py` run_one + run_reader) serves both schemes
     in either order with per-scheme lexicon caches and the Library's rebind;
     a lexicon whose scheme differs from the process's is followed by every
     consumer, and no production cut omits its scheme; the grid refuses a
     numeral end and binds a declared end after a dash run; an appended printed
     endpoint is never read (stream and Library); a declaration never changes
     the token cut; no token or raw run piece crosses whitespace under NFC,
     nor takes in a symbol whose normal form carries a combining mark
     (U+2ADC, the musical note symbols: the line reads as with U+266A).

Run: python3 quality/test_reader.py
"""
import copy
import json
import os
import re
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
            # an opening quotation mark leaves its word (2026-10-16)
            or "\u2018" in text or "\u201b" in text
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

    def test_the_broken_rhyme_split_reads_the_normalised_line(self):
        # Regression: the stream's cross-line split flag (which `broken
        # rhyme` reads) came from an ASCII-only regex on the raw line, so
        # `king-`, `king\u2010`, `king\u2011`, `king-\u00ad` and `king\u00ad-`
        # (one token `king-` to the v2 reader) gave different verdicts.
        import quality.relations as RL
        from quality.phonology.eng import English
        tail = ["dom of daylight's dauphin, dapple-dawn-drawn Falcon, in his riding",
                "Of the rolling level underneath him steady air, and striding",
                "High there, how he rung upon the rein of a wimpling wing"]
        verdicts = {}
        for scheme in ("v2", "v1"):
            with LH.reader_scheme_scope(scheme):
                for h in ("-", "\u2010", "\u2011", "-\u00ad", "\u00ad-"):
                    lines = ["I caught this morning morning's minion, king" + h] + tail
                    phon = English(fallback="high")
                    if scheme == "v2":
                        self.assertEqual(LH.line_tokens(lines[0])[-1], "king-")
                    st = RL.build_stream(lines, phon)
                    verdicts[(scheme, h)] = RL.line_pairs_for(
                        RL.REGISTRY["broken rhyme"], st, keep_refusal=True,
                        requested_pairs={(1, 4)}).verdict((1, 4))
        self.assertEqual({h: v for (sc, h), v in verdicts.items() if sc == "v2"},
                         dict.fromkeys(("-", "\u2010", "\u2011", "-\u00ad", "\u00ad-"), True))
        # v1 keeps the pre-batch raw-line flag.
        self.assertEqual({h: v for (sc, h), v in verdicts.items() if sc == "v1"},
                         {"-": True, "\u2010": False, "\u2011": False,
                          "-\u00ad": False, "\u00ad-": False})

    #: The five spellings the v2 reader folds to the one token `king-`.
    HYPHENS = ("-", "\u2010", "\u2011", "-\u00ad", "\u00ad-")
    TAIL = ["dom of daylight's dauphin, dapple-dawn-drawn Falcon, in his riding",
            "Of the rolling level underneath him steady air, and striding",
            "High there, how he rung upon the rein of a wimpling wing"]

    def _declared(self, scheme, first):
        """-> {relation: verdict} for L1~L4 through the PRODUCTION relation
        reader (`revise.relation_phonology_for` of a plain lexicon), plus the
        line-1 tokens the stream refused."""
        import quality.relations as RL
        import quality.revise as RV
        with LH.reader_scheme_scope(scheme):
            judge = RV.relation_phonology_for(LH.Lexicon(reader_scheme=scheme))
            st = RL.build_stream([first] + self.TAIL, judge)
            out = {rel: RL.line_pairs_for(RL.REGISTRY[rel], st, keep_refusal=True,
                                          requested_pairs={(1, 4)}).verdict((1, 4))
                   for rel in ("broken rhyme", "perfect rhyme")}
            out["unread"] = [w for (li, _, w) in st.unreadable if li == 0]
            return out

    def test_a_declared_relation_reads_the_word_broken_at_the_line_end(self):
        # BB8 (#527, receipts at de44bd78) and 3PO (#527 6163315071): under v2
        # the REGISTERED relation reader -- what `relation_phonology_for` gives
        # a plain lexicon, fallback refused -- could not read the canonical
        # token `king-` that `line_anchors` reads, so a declared broken rhyme
        # went True -> None (ASCII) or False -> None (the other four
        # spellings), and a declared perfect rhyme True -> None. The stream
        # now reads the printed part of the line-final broken word through the
        # same phonology; v1, numerals, printed boundaries and bare words keep
        # their answers.
        from quality import phonology as PH
        import quality.revise as RV
        with LH.reader_scheme_scope("v2"):
            judge = RV.relation_phonology_for(LH.Lexicon(reader_scheme="v2"))
            self.assertIs(judge, PH.get("eng"))          # the production reader
            self.assertIsNone(judge.fallback)            # its fallback policy
            self.assertIsNone(judge.read("king-"))       # no bare-word change
            self.assertEqual(judge.split_final_stem("king-"), "king")
            self.assertIsNone(judge.split_final_stem("king"))
        for h in self.HYPHENS:
            king = "I caught this morning morning's minion, king" + h
            self.assertEqual(self._declared("v2", king),
                             {"broken rhyme": True, "perfect rhyme": True, "unread": []}, h)
            # v1: the pre-batch raw-line answers, unchanged
            self.assertEqual(self._declared("v1", king),
                             {"broken rhyme": h == "-", "perfect rhyme": True, "unread": []}, h)
            # a numeral broken at the line end stays a refused numeral (D14)
            two = "I caught this morning morning's minion, 2" + h
            self.assertEqual(self._declared("v2", two),
                             {"broken rhyme": None, "perfect rhyme": None, "unread": ["2-"]}, h)
        # A printed boundary is never read, the broken word before it neither.
        for first, unread in (("I caught this morning morning's minion, \u0915-", ["\u0915-"]),
                              ("I caught this minion, \u00d7king-", ["\u00d7king-", "king-"]),
                              ("the minion, \u6211king-", ["king-", "\u6211king-"])):
            got = self._declared("v2", first)
            self.assertEqual(got["unread"], unread, first)
            self.assertEqual((got["broken rhyme"], got["perfect rhyme"]), (None, None), first)
        with LH.reader_scheme_scope("v1"):
            self.assertIsNone(PH.get("eng").split_final_stem("king-"))

    #: The line ends 3PO #519 6166749777 keeps in the acceptance matrix: a
    #: hyphen followed by punctuation or a closing quote (BB8's earlier packet,
    #: de44bd78: `king-,` and `king-.`). None of them is a split line.
    PUNCTUATED = ("king-,", "king-.", "king-;", "king-!", "king- ,", "king-)",
                  "king-\u2014", "king-'", "king-\u2019", "king\u2010,", "king-\u00ad.")

    def test_punctuation_after_the_hyphen_is_read_not_continued(self):
        # `split_final` needs a hyphen followed only by whitespace, so the
        # recovery for `king-` (0af39c6f) never reached `king-,`: under v2 the
        # registered relation reader refused the token, and a declared
        # perfect rhyme went True -> None (broken rhyme False -> None), while
        # `line_anchors` -- the grader's end -- reads `king` there. The stream
        # now reads the printed part of the line's last word whenever it ends
        # in a hyphen, and the punctuation never becomes a continuation: the
        # line is not split, so a declared broken rhyme is False, exactly as
        # v1 answers.
        with LH.reader_scheme_scope("v2"):
            lex = LH.Lexicon(reader_scheme="v2")
            judge = __import__("quality.revise", fromlist=["x"]).relation_phonology_for(lex)
            for end in self.PUNCTUATED:
                first = "I caught this morning morning's minion, " + end
                with self.subTest(end=end):
                    self.assertFalse(judge.split_final(first))      # never split
                    anchors, _, _ = LH.line_anchors(lex, first)
                    self.assertEqual(anchors[0][-1]["word_read"], ("king",))
        for end in self.PUNCTUATED:
            first = "I caught this morning morning's minion, " + end
            for scheme in ("v1", "v2"):
                with self.subTest(end=end, scheme=scheme):
                    self.assertEqual(self._declared(scheme, first),
                                     {"broken rhyme": False, "perfect rhyme": True, "unread": []})
        # The split line is still split, and still a broken rhyme; a numeral
        # and a printed boundary before the punctuation stay refused.
        self.assertEqual(self._declared("v2", "I caught this morning morning's minion, king-"),
                         {"broken rhyme": True, "perfect rhyme": True, "unread": []})
        self.assertEqual(self._declared("v2", "I caught this morning morning's minion, 2-,"),
                         {"broken rhyme": None, "perfect rhyme": None, "unread": ["2-"]})
        got = self._declared("v2", "I caught this minion, \u00d7king-,")
        self.assertEqual((got["broken rhyme"], got["perfect rhyme"]), (None, None))
        # A hyphen inside the last word is not a line-end hyphen.
        from quality import phonology as PH
        with LH.reader_scheme_scope("v2"):
            self.assertIsNone(PH.get("eng").split_final_stem("king-dom"))
            self.assertIsNone(PH.get("eng").split_final_stem("king-'s"))

    def test_final_stem_recovery_keeps_the_declared_judges_fallback_policy(self):
        # P7 / mutant C: a numeral cannot detect accidentally enabling G2P
        # here. An alphabetic morphology-only stem can, with the same word
        # readable as a positive control under an explicitly enabled fallback.
        import quality.relations as RL
        import quality.revise as RV
        from quality.phonology.eng import English
        with LH.reader_scheme_scope("v2"):
            judge = RV.relation_phonology_for(LH.Lexicon(reader_scheme="v2"))
            fallback_phonology = English(fallback="high", reader_scheme="v2")
            self.assertIsNone(judge.read("viewest"))
            reading = fallback_phonology.read("viewest")
            self.assertIsNotNone(reading)
            self.assertNotEqual(reading.layer, "dictionary")
            for ending in ("-", "-,"):
                lines = ["I viewest" + ending, "you viewest"]
                with self.subTest(ending=ending):
                    refused = RL.build_stream(lines, judge)
                    self.assertEqual(refused.unreadable,
                                     [(0, 1, "viewest-"), (1, 1, "viewest")])
                    allowed = RL.build_stream(lines, fallback_phonology)
                    self.assertEqual(allowed.unreadable, [])
                    for stream, expected in ((refused, None), (allowed, False)):
                        self.assertIs(RL.line_pairs_for(
                            RL.REGISTRY["perfect rhyme"], stream, keep_refusal=True,
                            requested_pairs={(1, 2)}).verdict((1, 2)), expected)
            self.assertEqual(self._declared("v2", "king-"),
                             {"broken rhyme": True, "perfect rhyme": True, "unread": []})

    def test_a_declared_broken_token_reading_precedes_stem_recovery(self):
        # P7 / mutant F2: a conflicting occurrence declaration must win over
        # the dictionary's king. Check both the displaced and selected rhyme,
        # plus the ordinary undeclared stem recovery as a positive control.
        import quality.relations as RL
        import quality.revise as RV
        with LH.reader_scheme_scope("v2"):
            for first in ("king-", "king-,"):
                declared = LH.Lexicon(reader_scheme="v2", pronunciations=[{
                    "line": first, "token": 1, "word": "king-",
                    "phones": ["K", "AE1", "T"], "basis": "declared",
                    "source": "test: conflicting occurrence pronunciation"}])
                plain = LH.Lexicon(reader_scheme="v2")
                for lex, other, expected in ((declared, "wing", False),
                                             (declared, "hat", True),
                                             (plain, "wing", True),
                                             (plain, "hat", False)):
                    with self.subTest(first=first, declared=lex is declared, other=other):
                        stream = RL.build_stream([first, other], RV.relation_phonology_for(lex))
                        self.assertEqual(stream.unreadable, [])
                        self.assertIs(RL.line_pairs_for(
                            RL.REGISTRY["perfect rhyme"], stream, keep_refusal=True,
                            requested_pairs={(1, 2)}).verdict((1, 2)), expected)

    def test_the_brief_verb_judges_the_declared_broken_word(self):
        # The same through the `brief` verb (the connector's lyric_check), one
        # run per scheme and relation over the five spellings at once (groups
        # 1,4;5,8;...): every pair judged and holding under v2, declared
        # broken, declared perfect and undeclared alike. Under v1 the declared
        # perfect and the undeclared pairs hold, and the declared broken rhyme
        # holds for ASCII `-`; the other four v1 broken-rhyme pairs are False
        # (asserted in-process above), where `brief` runs its candidate search
        # (minutes), so that run is not repeated here.
        work = Path(tempfile.mkdtemp())
        self.addCleanup(__import__("shutil").rmtree, work, True)
        five = work / "five.txt"
        five.write_text("\n\n".join("\n".join(["I caught this morning morning's minion, king" + h]
                                               + self.TAIL) for h in self.HYPHENS) + "\n",
                        encoding="utf-8")
        one = work / "one.txt"
        one.write_text("\n".join(["I caught this morning morning's minion, king-"] + self.TAIL) + "\n",
                       encoding="utf-8")
        env = {k: v for k, v in os.environ.items()
               if k not in ("LYRIC_CONTROL_TOKEN", "LYRIC_CHECKPOINT_PATH",
                            "LYRIC_REQUEST_DEADLINE_MS")}

        def brief(scheme, draft, groups, relation):
            r = subprocess.run([sys.executable, str(ROOT / "lyric_harness.py"),
                                f"--reader-scheme={scheme}", "brief", str(draft),
                                f"--groups={groups}"]
                               + ([f"--relation={relation}"] if relation else []),
                               capture_output=True, text=True, env=env, cwd=ROOT, timeout=900)
            row = json.loads([l for l in r.stdout.splitlines()
                              if l.startswith("  lyric result: ")][-1][len("  lyric result: "):])
            return row["reader_scheme"], {
                o["id"]: o["status"] for o in row["coverage"]["obligations"]
                if o["layer"] == "rhyme"}, row["coverage"]["certified"]

        all5 = "1,4;5,8;9,12;13,16;17,20"
        pairs5 = {f"rhyme:{a}:{a + 3}:{k}": "answered" for k, a in enumerate((1, 5, 9, 13, 17))}
        runs = [("v2", five, all5, "schema:broken rhyme", pairs5),
                ("v2", five, all5, "schema:perfect rhyme", pairs5),
                ("v2", five, all5, "", pairs5),
                ("v1", five, all5, "schema:perfect rhyme", pairs5),
                ("v1", five, all5, "", pairs5),
                ("v1", one, "1,4", "schema:broken rhyme", {"rhyme:1:4:0": "answered"})]
        for scheme, draft, groups, relation, want in runs:
            with self.subTest(scheme=scheme, relation=relation, draft=draft.name):
                self.assertEqual(brief(scheme, draft, groups, relation), (scheme, want, True))

    def test_a_supplemented_bare_word_is_normalised_as_a_token_is(self):
        # Regression: SupplementedLexicon.transcribe_word looked a supplement
        # row up under the raw spelling, so a bare-word caller missed the row
        # for a U+00AD, U+2010 or NFD spelling the same lexicon reads in a line.
        import quality.lexicon_supplement as LS
        self.assertEqual(LH.Lexicon().transcribe_word("streetlight"), ([], True))
        want = ["S", "T", "R", "IY1", "T", "L", "AY2", "T"]
        lex = LS.SupplementedLexicon(version=LS.canonical_version("v2"), reader_scheme="v2")
        for spelling in ("streetlight", "street\u00adlight", "streetli\u00adght"):
            self.assertEqual(lex.transcribe_word(spelling), (want, False), spelling)
            self.assertEqual(lex.transcribe("the " + spelling)[0], ["DH", "AH0"] + want)
        # Scheme v1 looks the raw spelling up, as before the batch.
        v1 = LS.SupplementedLexicon(version=LS.canonical_version("v2"), reader_scheme="v1")
        self.assertEqual(v1.transcribe_word("streetlight"), (want, False))
        self.assertNotEqual(v1.transcribe_word("street\u00adlight"), (want, False))

    def test_bare_word_variants_are_normalised_as_a_token_is(self):
        # 3PO #527 6163315071 (BB8's minor): `pronunciation_variants` (and the
        # readers built on it: `English.parses`, `whole_reading`, the `types`
        # verb) looked a bare word up under its raw spelling, while
        # `transcribe_word` and every `reader_line` token are normalised under
        # v2. Now one normalisation, the provenance follows the row actually
        # found, and v1 and declared readings are unchanged.
        import copy as _copy
        import quality.lexicon_supplement as LS
        from quality.phonology.eng import English
        v2, v1 = LH.Lexicon(reader_scheme="v2"), LH.Lexicon(reader_scheme="v1")
        for spelling, plain in (("re\u00adad", "read"), ("th\u00ade", "the"),
                                ("x\u2010ray", "x-ray"), ("x\u2011ray", "x-ray")):
            want = v2.pronunciation_variants(plain)
            self.assertTrue(want, plain)
            # the token a line reads is the normalised spelling
            self.assertEqual(LH.line_tokens("I " + spelling, True, "v2")[-1], plain)
            self.assertEqual(v2.pronunciation_variants(spelling), want, spelling)
            self.assertEqual(v2.transcribe_word(spelling), (list(want[0]), False))
            self.assertEqual(len(English(lexicon=v2).parses(spelling)), len(want), spelling)
            # scheme v1 looks the raw spelling up, as before the batch
            self.assertEqual(v1.pronunciation_variants(spelling), [], spelling)
        # A declared reading is matched on the spelling it names, unchanged.
        decl = _copy.copy(v2)
        decl._pronunciation_choice = {"word": "read", "phones": ["R", "IY1", "D"], "source": "me"}
        self.assertEqual(decl.pronunciation_variants("read"), [["R", "IY1", "D"]])
        self.assertEqual(decl.pronunciation_variants("re\u00adad"), v2.pronunciation_variants("read"))
        # The supplement: the row found under the normalised spelling is the
        # one credited (its source, never CMUdict), and v1 is unchanged.
        row = ["S", "T", "R", "IY1", "T", "L", "AY2", "T"]
        sv2 = LS.SupplementedLexicon(version=LS.canonical_version("v2"), reader_scheme="v2")
        sv1 = LS.SupplementedLexicon(version=LS.canonical_version("v2"), reader_scheme="v1")
        source = sv2.reading_source("streetlight", row)
        self.assertTrue(source and source != "cmudict", source)
        for spelling in ("street\u00adlight", "streetli\u00adght"):
            self.assertEqual(sv2.pronunciation_variants(spelling), [row], spelling)
            self.assertEqual(sv2.reading_source(spelling, row), source, spelling)
            self.assertEqual(sv2.whole_reading(spelling), (row, source), spelling)
            self.assertEqual(sv1.pronunciation_variants(spelling), [], spelling)
            self.assertIsNone(sv1.whole_reading(spelling), spelling)
        self.assertEqual(sv1.whole_reading("streetlight"), (row, source))

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


class NfcAcrossWhitespace(unittest.TestCase):
    """8f. A whitespace starter followed by misordered combining marks: NFC
    reorders the marks but the space composes with nothing, so no token and no
    raw run piece may reach across it."""

    def test_no_token_or_run_piece_crosses_whitespace(self):
        marks = ["\u0301", "\u0327", "\u0323", "\u0308", "\u0345", "\u031b"]
        # U+2000 and U+2001 are spaces NFC replaces (by U+2002, U+2003): the
        # starter changes, and must still map to its own codepoint alone.
        spaces = [" ", "\u00a0", "\t", "\u2003", "\u0085", "\u3000", "\u2000", "\u2001"]
        lines = []
        for sp in spaces:
            for a in marks:
                for b in marks:
                    if a == b:
                        continue
                    lines += [f"cafe{sp}{a}{b}night", f"we{sp}{a}{b}'s go",
                              f"love{sp}{b}{a}x{a} sing", f"(oh{sp}{a}{b}) heart 4{sp}{b}{a}ever"]
        self.assertGreater(sum(not unicodedata.is_normalized("NFC", t) for t in lines), 300)
        checked = 0
        for text in lines:
            for sp_rule in (True, False):
                rl = LH.reader_line(text, sp_rule)
                for t in list(rl.tokens) + list(rl.runs):
                    for a, b in t.pieces:
                        self.assertFalse(any(text[x].isspace() for x in range(a, b)),
                                         (text, sp_rule, t))
                        checked += 1
                    self.assertFalse(any(c.isspace() for c in t.text), (text, t))
        self.assertGreater(checked, 1000)

    def test_a_symbols_normal_form_mark_stays_outside_the_runs(self):
        # The separator property for a symbol NFC rewrites into a symbol plus
        # a combining mark: no token or raw run piece covers the symbol's
        # codepoint, and no run begins with the mark of its normal form,
        # beside whitespace, a further mark, an aside or an enclitic.
        checked = 0
        for sym in RC.NFC_MARK_SYMBOLS:
            own = unicodedata.normalize("NFC", sym)[1:]
            for text in [t for t in RC.nfc_mark_symbol_lines() if sym in t]:
                self.assertFalse(unicodedata.is_normalized("NFC", text))
                at = [i for i, c in enumerate(text) if c == sym]
                for sp_rule in (True, False):
                    rl = LH.reader_line(text, sp_rule)
                    for t in list(rl.tokens) + list(rl.runs):
                        self.assertFalse(t.text[:1] in own, (text, t))
                        for x, y in t.pieces:
                            self.assertFalse(any(x <= i < y for i in at), (text, sp_rule, t))
                            checked += 1
        self.assertGreater(checked, 300)

    def test_a_punctuation_mark_nfc_replaces_stays_outside_the_runs(self):
        # U+037E -> ';' and U+0387 -> U+00B7 before combining marks: the
        # punctuation keeps its own codepoint, so no raw run swallows it.
        for punct in ("\u037e", "\u0387"):
            for a, b in (("\u0301", ""), ("\u0327", "\u0301"), ("\u0301", "\u0327")):
                text = f"love{punct}{a}{b}night"
                self.assertFalse(unicodedata.is_normalized("NFC", text))
                for sp_rule in (True, False):
                    rl = LH.reader_line(text, sp_rule)
                    for t in list(rl.tokens) + list(rl.runs):
                        for x, y in t.pieces:
                            self.assertFalse(x <= 4 < y, (text, t))


class NfcMarkSymbols(unittest.TestCase):
    """8g. A non-letter starter whose normal form carries a combining mark
    (U+2ADC FORKING, the musical note symbols): the stream maps the whole form
    to the symbol's codepoint, and its mark must not start a raw run that
    reaches into the next word. The line reads exactly as it does with U+266A
    in the symbol's place."""

    def test_the_fourteen_are_every_such_starter(self):
        found = []
        for cp in range(0x110000):
            ch = chr(cp)
            if unicodedata.category(ch) == "Cs":
                continue
            nfc = unicodedata.normalize("NFC", ch)
            if (nfc != ch and unicodedata.category(ch)[0] not in "MN" and not ch.isalpha()
                    and any(unicodedata.category(c)[0] == "M" for c in nfc)):
                found.append(ch)
        self.assertEqual(found, RC.NFC_MARK_SYMBOLS)
        self.assertEqual(len(found), 14)

    def test_a_symbol_reads_as_a_plain_symbol_does(self):
        def shape(rl):
            return ([tuple(t) for t in rl.tokens], [tuple(t) for t in rl.runs])
        checked = 0
        for sym in RC.NFC_MARK_SYMBOLS:
            for text in [t for t in RC.nfc_mark_symbol_lines() if sym in t]:
                plain = text.replace(sym, "\u266a")
                for sp in (True, False):
                    self.assertEqual(shape(LH.reader_line(text, sp)),
                                     shape(LH.reader_line(plain, sp)), (text, sp))
                    checked += 1
        self.assertEqual(checked, 14 * 6 * 2)

    def test_the_end_word_after_a_symbol_reads_as_after_a_note(self):
        from quality import relations as R
        from quality.phonology.eng import English
        for sym in RC.NFC_MARK_SYMBOLS:
            for scheme in ("v1", "v2"):
                lex = LH.Lexicon(reader_scheme=scheme)
                text = f"sing along {sym}love"
                self.assertEqual(LH.line_anchors(lex, text)[1:],
                                 LH.line_anchors(lex, "sing along \u266alove")[1:], (sym, scheme))
                self.assertEqual(LH.raw_final_token(text, scheme=scheme), "love", (sym, scheme))
                stream = R.build_stream([text, "above"], English(lexicon=lex))
                self.assertEqual(stream.lexical_tokens[0], ("sing", "along", "love"),
                                 (sym, scheme))
            self.assertEqual(LH.raw_final_token(f"we sing{sym}tonight", scheme="v2"), "tonight")


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
        # The last three are regressions: a printed endpoint sharing
        # characters with the token before it gave two overlapping exact
        # ranges, and the analysis read that endpoint (duplicated material)
        # as a word: a readable token, a type for its pair, a reading to
        # declare. It is an unread boundary (D14).
        for text in ["love,night \u1100\u1161 sing", "\u1100\u1161\u11a8 cafe\u0301, night",
                     "go \u043a\u043e\u04425", "love q\u0303uiet", "love \u00d7night"]:
            full = text + "\nthe light"
            _, records, _ = TA.complete(TA.source(full), schemas=[])
            rl = LH.reader_line(text, False)
            if LH.printed_endpoint(rl) is not None:
                end = [r for r in records if r["kind"] == "token"
                       and r["line_id"] == "line:0" and r["token"] == len(rl.tokens)]
                self.assertEqual(len(end), 1, text)
                self.assertEqual(end[0]["text"], LH.printed_endpoint(rl).text, text)
                self.assertFalse(end[0]["readable"], text)
                self.assertEqual(end[0]["reading_status"], "unreadable", text)
                self.assertNotIn("reading_choices", end[0], text)
                pairs = [r for r in records if r["kind"] == "native_pair"]
                self.assertTrue(pairs, text)
                for r in pairs:
                    self.assertNotIn("type_coordinate", r, text)
                    self.assertIn("unread boundary", r["reason"], text)
            spans = []
            covered = set()
            for r in records:
                if r["kind"] != "token":
                    continue
                for rng in r["source_ranges"]:
                    if rng.get("precision") == "exact":
                        a, b = rng["codepoint_range"]
                        self.assertEqual(LH.normalise_word(full[a:b]), r["text"], (text, r))
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

    def test_recovery_end_schemas_use_the_selected_lexicon(self):
        from quality import recover as REC, relations as RL
        from quality.lexicon_supplement import SupplementedLexicon
        from quality.revise import relation_phonology_for
        plain = LH.Lexicon(reader_scheme="v2")
        selected = SupplementedLexicon(version="v2", reader_scheme="v2")

        def schemas(lines, lex):
            web = REC.recover(lines, lex=lex, placements=("end",))["web"]
            return set().union(*(set(e["relations"]) & set(RL.REGISTRY)
                                 for e in web)) if web else set()

        # Actual shipped entries, not synthetic spelling-shape coverage.
        for a, b in (("streetlight", "night"), ("streetlights", "nights"),
                     ("sixty-six", "tricks"), ("twenty-first", "thirst"),
                     ("night", "light"), ("streetlights", "seat"),
                     ("zzqxqzz", "night")):
            lines = ["I see the " + a, "You hear the " + b]
            for lex in (plain, selected):
                with self.subTest(words=(a, b), selected=lex is selected):
                    expected = dict(RL.whole_vocabulary_pairs(
                        lines, relation_phonology_for(lex),
                        requested_pairs={(1, 2)}, bound={(1, 2): (-1, -1)}))
                    self.assertEqual(schemas(lines, lex),
                                     set(expected.get((1, 2), ())))
            if a in ("streetlight", "streetlights", "sixty-six") and b != "seat":
                self.assertIn("perfect rhyme", schemas(lines, selected))
        self.assertNotIn("perfect rhyme", schemas(["streetlights", "seat"], selected))
        self.assertEqual(schemas(["zzqxqzz", "night"], selected), set())

        # Declared readings are a separate fixture, not reviewed vocabulary.
        lines = ["king-", "hat"]
        declared = LH.Lexicon(reader_scheme="v2", pronunciations=[{
            "line": "king-", "token": 1, "word": "king-",
            "phones": ["K", "AE1", "T"], "basis": "declared",
            "source": "test: conflicting occurrence pronunciation"}])
        self.assertIn("perfect rhyme", schemas(lines, declared))
        self.assertNotIn("perfect rhyme", schemas(["king-", "wing"], declared))
        self.assertIn("perfect rhyme", schemas(["king-", "wing"], plain))

        # The same adapter keeps aside/voices endpoints aligned too.
        for strip in (True, False):
            lex = LH.Lexicon(reader_scheme="v2", strip_parens=strip)
            got = schemas(["I see night (oh)", "You hear light (cat)"], lex)
            self.assertEqual("perfect rhyme" in got, strip)

        # Fallback remains the REGISTERED relation reader's policy, not a
        # newly propagated Lexicon fallback setting. Exercise a real derived
        # stem, not a stubbed schema verdict.
        from unittest.mock import patch
        from quality.phonology.eng import English
        fallback_lex = LH.Lexicon(reader_scheme="v2", fallback="high")
        for mode in (None, "high"):
            with patch("quality.revise._relation_phonology", return_value=English(
                    fallback=mode, reader_scheme="v2")):
                got = schemas(["viewest", "newest"], fallback_lex)
                self.assertEqual("consonance" in got, mode == "high")

        # The passed lexicon's v2 coordinate wins over a warm v1 process.
        with LH.reader_scheme_scope("v1"):
            self.assertIn("perfect rhyme", schemas(["streetlights", "nights"], selected))

    def test_recovery_preserves_the_legacy_schema_reader(self):
        from quality import recover as REC
        from quality.lexicon_supplement import SupplementedLexicon
        # Frozen before this repair: v1 supplied rows yielded coarse edges
        # while its historical schema reader ignored the supplement.
        for active in ("v1", "v2"):
            with LH.reader_scheme_scope(active):
                lex = SupplementedLexicon(version="v2", reader_scheme="v1")
                web = REC.recover(["streetlights", "nights"], lex=lex,
                                  placements=("end",))["web"]
                self.assertEqual(web, [{"a": "1", "b": "2",
                    "words": ("streetlights", "nights"), "score": 1.0,
                    "relations": ["ASSONANCE", "CONSONANCE", "RHYME"]}])

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

    def test_the_stream_never_judges_an_end_word_line_anchors_does_not(self):
        # Regression: U+00D7/U+00F7 are inside the token repertoire and are no
        # letters, so in `\u00d7night` the token is `\u00d7night` and the last
        # raw run only `night`. The stream appended that run as its boundary
        # and READ it, judging `night` where line_anchors refuses the line.
        # An appended printed endpoint is always an unread boundary (D14).
        # Property, on every generated line under each fallback and aside
        # rule: the word the stream judges at the line end is line_anchors'
        # end word, which line_anchors reads too, or the stream refuses; and
        # a line line_anchors refuses for its end word (the last raw run is
        # not the last token) the stream refuses as well. (The stream may
        # refuse a same-word end line_anchors reads -- an unalignable
        # homograph, a hyphen piece -- and that is a readability question,
        # not which word is the end.)
        import quality.relations as RL
        from quality.phonology.eng import English
        lines = GENERATED + RC.V2_REGRESSIONS + [
            "\u00d7night", "love \u00d7night", "we go \u00f7love", "I said \u00d7"]
        judged_ends = refused_by_identity = 0
        for fb in (None, "high"):
            for sp in (True, False):
                lex = LH.Lexicon(fallback=fb, strip_parens=sp)
                for phon in (English(fallback=fb, lexicon=lex),) + (
                        (English(),) if fb is None and sp else ()):
                    for text in lines:
                        st = RL.build_stream([text], phon)
                        words = st.lexical_tokens[0]
                        end = len(words) - 1
                        judged = words[end] if words and st.tokens.get((0, end)) else None
                        anchors, last, _ = LH.line_anchors(lex, text)
                        toks = LH.line_tokens(text, sp)
                        by_identity = not toks or toks[-1] != LH.raw_final_token(text, sp)
                        key = (fb, sp, text, judged, last)
                        if judged is not None:
                            judged_ends += 1
                            self.assertEqual(judged, last, key)
                            self.assertTrue(anchors, key)
                        if by_identity:
                            refused_by_identity += 1
                            self.assertIsNone(judged, key)
                            self.assertEqual(anchors, [], key)
                        boundary = phon.printed_boundary(text)
                        if boundary is not None:
                            self.assertEqual(boundary, len(toks))
                            self.assertIn((0, boundary, words[boundary]), st.unreadable, key)
                            self.assertNotIn((0, boundary), st.tokens, key)
        self.assertGreater(judged_ends, 1000)
        self.assertGreater(refused_by_identity, 100)
        st = RL.build_stream(["love \u00d7night", "the light"], English())
        self.assertEqual(st.lexical_tokens[0], ("love", "\u00d7night", "night"))
        self.assertEqual({(li, ti) for li, ti, _ in st.unreadable}, {(0, 1), (0, 2)})
        with LH.reader_scheme_scope("v1"):
            self.assertIsNone(English(lexicon=LH.Lexicon()).printed_boundary("love \u00d7night"))

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


class LoopSwaps(unittest.TestCase):
    """The reviser's word swaps splice the token the grader binds."""

    def test_a_slot_swap_counts_asides_as_the_lexicon_does(self):
        # Regression: under v2, swap_at_slot cut the line with asides dropped
        # whatever the lexicon declared, while the grader resolves a slot
        # through word_syllable_map, which counts asides for a `--voices`
        # lexicon. A head or T<n> slot after an aside then spliced a
        # different word than the grader binds, and _anchors_at answered True
        # for a splice that never touched the slot's word.
        from quality import slots as SL
        from quality.loop import swap_at_slot
        from quality.revise import Reviser
        lex = LH.Lexicon(strip_parens=False, reader_scheme="v2")
        for text, slot, bound in (("(oh) hello world", "1.head", "oh"),
                                  ("(oh) hello my world", "1.T2", "hello")):
            s = SL.parse_slot(slot)
            self.assertEqual(SL.resolve(lex, text, s)[1], bound)
            new = swap_at_slot(text, s, "goodbye", scheme="v2", strip_parens=False,
                               lex=lex)
            self.assertEqual(SL.resolve(lex, new, s)[1], "goodbye", (text, new))
            self.assertTrue(Reviser(lex)._anchors_at(text, s, "goodbye"))
            # The reviser's own trial splice follows its lexicon's aside rule.
            # T2 of `(oh) zzzqx world` is the unreadable `zzzqx`: the grader
            # binds nothing there, and since the slot-binding repair
            # (2026-10-14) a T<n> splice keeps its index and REFUSES an
            # unreadable word rather than guess (it gave True before).
            self.assertFalse(Reviser(lex)._anchors_at("(oh) zzzqx world",
                                                      SL.parse_slot("1.T2"), "goodbye"))
            self.assertTrue(Reviser(lex)._anchors_at("(oh) hello world",
                                                     SL.parse_slot("1.T2"), "goodbye"))
            # v1 still refuses every line with an aside.
            self.assertIsNone(swap_at_slot(text, s, "goodbye", scheme="v1",
                                           strip_parens=False))
        # Property: whichever aside rule the lexicon declares, the token the
        # splice replaced is the token the grader binds, in the grader's cut
        # (for T<n> the token at its index; for the head the first READABLE
        # token, which `slots.resolve` reports through its `widx`).
        # Plain-letter lines, so a retokenised splice cannot join a mark or a
        # repertoire character next to it (a separate question).
        plain = []
        for p in sorted((ROOT / "corpus" / "song").glob("eng_*.txt"))[::9]:
            with p.open(encoding="utf-8") as fh:
                plain += [ln.strip() for ln in fh
                          if re.fullmatch(r"[A-Za-z' ,.!?;:]+", ln.strip())
                          and len(ln.split()) >= 3]
        checked = 0
        lexes = {True: LH.Lexicon(strip_parens=True, reader_scheme="v2"),
                 False: LH.Lexicon(strip_parens=False, reader_scheme="v2")}
        for k, base in enumerate(plain[:1500]):
            text = ("(oh) " + base) if k % 2 else base.replace(" ", " (ah) ", 1)
            for sp in (True, False):
                before = LH.line_tokens(text, sp, "v2")
                glex = lexes[sp]
                for slot, idx in (("1.head", 0), ("1.T2", 1), ("1.T3", 2)):
                    new = swap_at_slot(text, SL.parse_slot(slot), "zqx",
                                       scheme="v2", strip_parens=sp, lex=glex)
                    if new is None or idx >= len(before):
                        continue
                    anc = SL.resolve(glex, text, SL.parse_slot(slot))[0]
                    idx = anc[0][0]["widx"]
                    after = LH.line_tokens(new, sp, "v2")
                    self.assertEqual(after[idx].lower(), "zqx", (text, sp, slot))
                    self.assertEqual(after[:idx] + after[idx + 1:],
                                     before[:idx] + before[idx + 1:], (text, sp, slot))
                    checked += 1
        self.assertGreater(checked, 500)

    def test_the_loops_stock_stubs_splice_under_the_revisers_cut(self):
        # The default proposer (`revise --propose=stub`, the CLI default) and
        # the group stub splice through swap_at_slot; revise_loop binds them
        # to its reviser's cut, so a `--voices` run splices where it grades.
        import quality.loop as LP
        from quality.revise import Reviser
        seen = []
        real = LP.default_propose

        def recording(brief, lines, attempt, reasons=None, whole=(), **kw):
            seen.append(kw)
            return real(brief, lines, attempt, reasons, whole, **kw)
        # A draft the loop asks a line question about: the kitchen fixture's
        # own two lines under AA. The four-line draft this used carried only
        # the shipped CLICHE_PAIR as a line flag, which is not filed since
        # 2026-10-27 (D6 on #519), so no line was asked anything.
        lines = json.loads((HERE / "fixtures" / "reader_v1_checkpoint.json")
                           .read_text(encoding="utf-8"))["draft"]
        try:
            LP.default_propose = recording
            for sp in (True, False):
                seen.clear()
                lex = LH.Lexicon(strip_parens=sp, reader_scheme="v2")
                LP.revise_loop(Reviser(lex=lex), lines, "AA")
                self.assertTrue(seen)
                self.assertEqual({(k["scheme"], k["strip_parens"]) for k in seen},
                                 {("v2", sp)})
                # ... and the GRADING lexicon itself, so the splice lands on
                # the occurrence the grader binds (slot-binding repair).
                self.assertTrue(all(k["lex"] is lex for k in seen))
        finally:
            LP.default_propose = real
        # And the stub itself splices the token the grader binds.
        from types import SimpleNamespace
        from quality import slots as SL
        voices = LH.Lexicon(strip_parens=False, reader_scheme="v2")
        b = SimpleNamespace(text="(oh) hello world", slot=SL.parse_slot("1.T2"),
                            line_no=1, candidates=["goodbye"])
        self.assertEqual(LP.default_propose(b, [b.text], 0, scheme="v2", strip_parens=False,
                                            lex=voices),
                         "(oh) goodbye world")
        # An unreadable T2 binds nothing, so the stub refuses there.
        b.text = "(oh) zzzqx world"
        self.assertIsNone(LP.default_propose(b, [b.text], 0, scheme="v2", strip_parens=False,
                                             lex=voices))

    def test_an_end_word_swap_never_misses_the_printed_end(self):
        # Regression: the v2 end-word swap replaced the last raw run whenever
        # it equalled raw_final_token, even where that run is not the line's
        # last token (`I said ×` ends on the token `×`) or is a fragment of it
        # (`night` in `×night`, `2` in `×2`). It refuses those, as v1 does.
        from quality.loop import swap_end_word
        for text in ("I said ×", "love ×night", "x ×2", "love 我"):
            self.assertIsNone(swap_end_word(text, "zing", scheme="v2"), text)
            self.assertIsNone(swap_end_word(text, "zing", scheme="v1"), text)
        self.assertEqual(swap_end_word("the room on fire", "zing", scheme="v2"),
                         "the room on zing")
        # Property: every v2 end-word swap rewrites the line's last token and
        # nothing else: the token count never shrinks (a candidate fused onto
        # the token before, `K1×δQ` -> `K1×zqx`, loses a word) and every
        # token before the last reads as it did.
        swapped = 0
        for text in GENERATED[:3000]:
            new = swap_end_word(text, "zqx", scheme="v2")
            if new is None:
                continue
            old_t, new_t = LH.line_tokens(text, True, "v2"), LH.line_tokens(new, True, "v2")
            self.assertEqual(len(new_t), len(old_t), (text, new))
            self.assertEqual(new_t[-1].lower(), "zqx", (text, new))
            self.assertEqual(new_t[:-1], old_t[:-1], (text, new))
            swapped += 1
        self.assertGreater(swapped, 1000)

    def test_an_end_word_swap_never_fuses_or_deletes_a_symbol(self):
        # Regression (verify round 3): the v2 end-word swap -- also the
        # default-slot path of swap_at_slot -- never re-read its splice. Where
        # the last run starts exactly where the token before it ends (after
        # `×`/`÷`, which the token repertoire reads and the run does not), it
        # fused the candidate onto that token; with a fallback lexicon the
        # reviser then judged the fused word.
        from quality import slots as SL
        from quality.loop import swap_at_slot, swap_end_word
        from quality.revise import Reviser
        end = SL.parse_slot("1.end")
        for text in ("we sing\u00f7\u03b4night", "K1\u00d7\u03b4Q", "go \u00d7\u03b4dawn"):
            before = LH.line_tokens(text, True, "v2")
            for new in (swap_end_word(text, "zebra", scheme="v2"),
                        swap_at_slot(text, end, "zebra", scheme="v2")):
                self.assertTrue(new is None or (
                    len(LH.line_tokens(new, True, "v2")) == len(before)
                    and LH.line_tokens(new, True, "v2")[:-1] == before[:-1]), (text, new))
            self.assertIsNone(swap_end_word(text, "zebra", scheme="v2"), text)
            self.assertFalse(Reviser(LH.Lexicon(fallback="low"))._anchors_at(text, end, "zebra"),
                             text)
        # A symbol whose normal form carries a combining mark (U+2ADC and the
        # musical note symbols) is never deleted or fused: the swap keeps it
        # and replaces the word after it, or refuses.
        for sym in ("\u2adc", "\U0001d15e", "\U0001d160", "\U0001d1bb", "\U0001d1c0"):
            for text in (f"we sing{sym}tonight", f"we sing {sym}night"):
                before = LH.line_tokens(text, True, "v2")
                for new in (swap_end_word(text, "zebra", scheme="v2"),
                            swap_at_slot(text, end, "zebra", scheme="v2")):
                    self.assertTrue(new is None or (
                        sym in new and LH.line_tokens(new, True, "v2") == before[:-1] + ["zebra"]),
                        (text, new))

    def test_an_end_word_swap_refuses_a_span_holding_a_printed_symbol(self):
        # The swap's own guard, independent of how the reader cuts: a last
        # run whose raw span covers a printed symbol (what the reader gave
        # `we sing 𝅗𝅥night` before its stream kept a symbol's normal-form
        # mark out of the next word: the run `\U0001d165night` at [8, 14),
        # starting ON U+1D15E) is refused, never spliced over the symbol.
        from unittest import mock
        import quality.loop as LP
        text = "we sing \U0001d15enight"
        T = LH.ReaderToken
        recorded = LH.ReaderLine(
            text,
            (T("we", ((0, 2),), False, False), T("sing", ((3, 7),), False, False),
             T("night", ((9, 14),), False, False)),
            (T("we", ((0, 2),), False, False), T("sing", ((3, 7),), False, False),
             T("\U0001d165night", ((8, 14),), False, False)))
        real = LP.reader_line

        def reader(t, strip_parens=True, scheme=None):
            return recorded if t == text else real(t, strip_parens, scheme)
        with mock.patch.object(LP, "reader_line", reader), \
                mock.patch.object(LP, "raw_final_token", lambda t, *a, **k: "\U0001d165night"):
            self.assertIsNone(LP.swap_end_word(text, "zebra", scheme="v2"))

    def test_an_end_word_swap_keeps_a_space_or_mark_nfc_replaces(self):
        # Regression: U+2000/U+2001 (NFC: U+2002/U+2003), U+037E (';') and
        # U+0387 before combining marks mapped the starter to the whole
        # segment, so the last run's first piece began ON the space or the
        # punctuation, and the splice deleted it and fused the candidate onto
        # the word before.
        from quality.loop import swap_end_word
        for text, sep in (("I love\u2001\u0308night", "\u2001"), ("go\u2000\u0301bed", "\u2000"),
                          ("love\u037e\u0301night", "\u037e"), ("love\u0387\u0301night", "\u0387")):
            new = swap_end_word(text, "zqx", scheme="v2")
            self.assertIsNotNone(new, text)
            head = text[:text.index(sep) + 1]
            self.assertTrue(new.startswith(head), (text, new))
            self.assertEqual(LH.line_tokens(new, True, "v2")[:-1],
                             LH.line_tokens(text, True, "v2")[:-1], (text, new))

    def test_a_slot_swap_never_fuses_onto_the_next_token(self):
        # Regression: a token ending in a segment NFC recomposed (`ọ` +
        # U+0301 from `o` U+0323 U+0301) has a piece covering the U+0301 that
        # ends it; the splice deleted it and the candidate fused with `run`,
        # so the grader bound `Zqxrun` and the slot after it vanished.
        from quality import slots as SL
        from quality.loop import swap_at_slot
        from quality.pronunciation import validate_choices

        def declared(text, k, sp):
            # A declared reading makes the k-th token readable, so the grader
            # binds IT (the splice targets the grader-bound occurrence).
            lex = LH.Lexicon(strip_parens=sp, reader_scheme="v2")
            word = LH.line_tokens(text, sp, "v2")[k - 1]
            lex.pronunciations = validate_choices([{
                "line": text, "token": k, "word": word, "phones": ["OW1", "L", "OW0"],
                "basis": "declared", "source": "test"}], lex)
            return lex
        for text, slot, k in (("Olo\u0323\u0301run love", "1.head", 1),
                              ("my do\u0323\u0301run night", "1.T2", 2)):
            for sp in (True, False):
                new = swap_at_slot(text, SL.parse_slot(slot), "zqx", scheme="v2",
                                   strip_parens=sp, lex=declared(text, k, sp))
                if new is not None:
                    before = LH.line_tokens(text, sp, "v2")
                    after = LH.line_tokens(new, sp, "v2")
                    self.assertEqual(len(after), len(before), (text, new))
        self.assertIsNone(swap_at_slot("Olo\u0323\u0301run love", SL.parse_slot("1.head"),
                                       "zqx", scheme="v2",
                                       lex=declared("Olo\u0323\u0301run love", 1, True)))
        self.assertEqual(swap_at_slot("Olo run love", SL.parse_slot("1.head"), "zqx",
                                      scheme="v2", lex=declared("Olo run love", 1, True)),
                         "Zqx run love")


class SlotBinding(unittest.TestCase):
    """Under v2 the reviser's slot splice replaces the GRADER-BOUND occurrence
    (the reader token whose `widx` `slots.resolve` puts on the syllables it
    binds, with the grading lexicon's scheme, aside rule and declared
    readings) or refuses. BB8's slot-match acceptance at 67889851 found the
    v2 splice replacing the literal first/last token while the grader skips
    an unreadable one (a numeral, a dash fragment, an unread word) to the
    nearest readable word. v1 stays the pre-batch body, its refusals included.

    The expected v1 strings are what `quality.loop.swap_at_slot(text, slot,
    word)` returns on the pre-batch tree fce4bf0f."""

    W = "zqx"

    @classmethod
    def setUpClass(cls):
        cls.st = LH.Lexicon(reader_scheme="v2")
        cls.su = LH.Lexicon(reader_scheme="v2", strip_parens=False)
        cls.v1 = LH.Lexicon(reader_scheme="v1")
        cls.v1s = LH.Lexicon(reader_scheme="v1", strip_parens=False)

    def swap(self, text, slot, lex, **kw):
        from quality import slots as SL
        from quality.loop import swap_at_slot
        kw.setdefault("scheme", LH._scheme_of(lex))
        kw.setdefault("strip_parens", lex.strip_parens)
        return swap_at_slot(text, SL.parse_slot("1." + slot), self.W, lex=lex, **kw)

    @staticmethod
    def bound_span(lex, text, slot):
        """The oracle: the raw span of the token the grader binds, read from
        `slots.resolve`'s own `widx` tags (never by spelling); None if none."""
        from quality import slots as SL
        anchors, _, _ = SL.resolve(lex, text, SL.parse_slot("1." + slot))
        if not anchors:
            return None
        if slot == "end":
            w = {a[-1]["widx"] for a in anchors}
        else:
            w = {s["widx"] for a in anchors for s in a}
        if len(w) != 1:
            return None
        tok = LH.reader_line(text, lex.strip_parens, "v2").tokens[w.pop()]
        return tok.pieces[0][0], tok.pieces[-1][1]

    def edited_span(self, text, new):
        """-> the (a, b) whose replacement by the cased marker rebuilds `new`
        exactly, from every reader token span (asides kept); None if none."""
        from quality.loop import _cased
        hits = [(t.pieces[0][0], t.pieces[-1][1])
                for t in LH.reader_line(text, False, "v2").tokens
                if text[:t.pieces[0][0]] + _cased(t.text, self.W) + text[t.pieces[-1][1]:] == new]
        return hits[0] if len(hits) == 1 else None

    def assertEditsBound(self, text, slot, lex, expected):
        new = self.swap(text, slot, lex)
        self.assertEqual(new, expected, (text, slot, lex.strip_parens))
        if expected is not None:
            self.assertEqual(self.edited_span(text, new), self.bound_span(lex, text, slot),
                             (text, slot))

    def test_a_numeral_head_edits_the_word_the_grader_binds(self):
        from quality import slots as SL
        text = "(1) An' teäke an' cut a lock o' frith, an' drow"
        # Premise: sung, the aside numeral `1` is token 0 and unreadable, so
        # the grader's head is `An'` (token 1); stripped, `An'` is token 0.
        self.assertEqual(SL.resolve(self.su, text, SL.parse_slot("1.head"))[1], "An'")
        self.assertEqual(LH.line_tokens(text, False, "v2")[0], "1")
        for lex in (self.su, self.st):
            self.assertEditsBound(text, "head", lex, "(1) Zqx teäke an' cut a lock o' frith, an' drow")
            self.assertEditsBound(text, "headrime", lex, "(1) Zqx teäke an' cut a lock o' frith, an' drow")
            # `drow` is unread, so `endword` binds the last READABLE word.
            self.assertEditsBound(text, "endword", lex, "(1) An' teäke an' cut a lock o' frith, zqx drow")
        # T<n> keeps its index: T1 sung is the unreadable `1`, refused, never
        # compacted onto `An'`; T2 sung is `An'`.
        self.assertIsNone(self.swap(text, "T1", self.su))
        self.assertEditsBound(text, "T2", self.su, "(1) Zqx teäke an' cut a lock o' frith, an' drow")
        self.assertIsNone(self.swap(text, "T2", self.st))       # `teäke` is unread
        for lex in (self.v1, self.v1s):
            self.assertEqual(self.swap(text, "head", lex), "(1) Zqx teäke an' cut a lock o' frith, an' drow")
            self.assertEqual(self.swap(text, "T2", lex), "(1) An' zqx an' cut a lock o' frith, an' drow")
            self.assertEqual(self.swap(text, "endword", lex), "(1) An' teäke an' cut a lock o' frith, an' zqx")

    def test_a_trailing_margin_numeral(self):
        from quality import slots as SL
        text = "'Till the Canon atoned the deed,              _110"
        self.assertEqual(LH.line_tokens(text, True, "v2")[-1], "110")
        for lex in (self.st, self.su):
            self.assertEqual(SL.resolve(lex, text, SL.parse_slot("1.endword"))[1], "deed")
            self.assertEditsBound(text, "endword", lex,
                                  "'Till the Canon atoned the zqx,              _110")
            # The DEFAULT end binds ZERO syllables on the numeral (line_anchors
            # names it as a label only), so the swap refuses: a label is not a
            # binding (3PO #519 6163216518). At 67889851 and 61b6618a it
            # replaced the numeral.
            self.assertEqual(SL.resolve(lex, text, 1)[:2], ([], "110"))
            self.assertIsNone(self.swap(text, "end", lex))
        for lex in (self.v1, self.v1s):
            for slot in ("endword", "end"):
                self.assertEqual(self.swap(text, slot, lex),
                                 "'Till the Canon atoned the zqx,              _110")

    def test_a_dash_fragment_head(self):
        text = "Meinself--und Gott."
        for lex in (self.st, self.su):
            self.assertEditsBound(text, "head", lex, "Meinself--zqx Gott.")
            self.assertIsNone(self.swap(text, "T1", lex))     # `Meinself` unread
            self.assertEditsBound(text, "T2", lex, "Meinself--zqx Gott.")
            self.assertEditsBound(text, "end", lex, "Meinself--und Zqx.")
        for lex in (self.v1, self.v1s):
            self.assertEqual(self.swap(text, "head", lex), "Zqx Gott.")
            self.assertEqual(self.swap(text, "T2", lex), "Meinself--und Zqx.")

    def test_an_aside_line_the_base_refused(self):
        text = '"Abraham, forbear, (the angel cry\'d)'
        self.assertEditsBound(text, "endword", self.st, '"Zqx, forbear, (the angel cry\'d)')
        self.assertEditsBound(text, "endword", self.su, '"Abraham, forbear, (the zqx cry\'d)')
        for lex in (self.st, self.su):
            self.assertIsNone(self.swap(text, "T2", lex))     # `forbear` unread
        for lex in (self.v1, self.v1s):
            for slot in ("endword", "head", "end", "T1"):
                self.assertIsNone(self.swap(text, slot, lex), (slot, lex.strip_parens))

    def test_the_cases_wrong_before_the_batch(self):
        # grader_elsewhere on fce4bf0f and at 67889851 alike.
        text = "O'er the parchment (not a rhyme),"
        for lex in (self.st, self.su):
            self.assertEditsBound(text, "head", lex, "O'er zqx parchment (not a rhyme),")
            self.assertIsNone(self.swap(text, "T1", lex))
        text2 = "(Lest the smoke his sight o’erwhelm,)"
        self.assertEditsBound(text2, "endword", self.su, "(Lest the smoke his zqx o’erwhelm,)")
        self.assertIsNone(self.swap(text2, "endword", self.st))   # no token outside the aside
        for lex in (self.v1, self.v1s):
            for t in (text, text2):
                for slot in ("head", "endword"):
                    self.assertIsNone(self.swap(t, slot, lex), (t, slot))

    def test_a_token_slot_after_a_numeral(self):
        text = "1 love you so"
        for lex in (self.st, self.su):
            self.assertIsNone(self.swap(text, "T1", lex))
            self.assertEditsBound(text, "T2", lex, "1 zqx you so")
            self.assertEditsBound(text, "head", lex, "1 zqx you so")
            self.assertEditsBound(text, "T3", lex, "1 love zqx so")
        for lex in (self.v1, self.v1s):
            self.assertEqual(self.swap(text, "T1", lex), "1 zqx you so")
            self.assertEqual(self.swap(text, "T2", lex), "1 love zqx so")

    def test_repeated_words_bind_by_position_not_spelling(self):
        from unittest import mock
        import quality.loop as LP
        text = "do me a favour, do"
        for slot in ("end", "endword", "T5"):
            new = self.swap(text, slot, self.st)
            self.assertEqual(new, "do me a favour, zqx")
            self.assertEqual(self.edited_span(text, new), (16, 18))
        for slot in ("head", "T1"):
            self.assertEqual(self.edited_span(text, self.swap(text, slot, self.st)), (0, 2))
        self.assertEqual(self.edited_span("love, love me do", self.swap("love, love me do", "T2", self.st)),
                         (6, 10))
        # A grader that bound the FIRST `do` for `endword` is followed to
        # offsets (0, 2): the occurrence is its widx, not the word `do`.
        real = LP._RESOLVE

        def first(lex, line, member, promote=False):
            anchors, label, oov = real(lex, line, member, promote=promote)
            return [[dict(s, widx=0, word="do") for s in a] for a in anchors], label, oov
        with mock.patch.object(LP, "_RESOLVE", first):
            self.assertEqual(self.swap(text, "endword", self.st), "zqx me a favour, do")
            self.assertIsNone(self.swap(text, "T5", self.st))     # T5 keeps index 4
            self.assertIsNone(self.swap(text, "end", self.st))    # endpoint is not the last token
        # NEGATIVE CONTROL: this oracle catches an edit of the wrong
        # occurrence although its spelling matches the bound word.
        wrong = "zqx me a favour, do"
        self.assertEqual(text[0:2], text[16:18])
        self.assertNotEqual(self.edited_span(text, wrong), self.bound_span(self.st, text, "endword"))

    def test_aside_modes_normalisation_and_enclitic_pieces(self):
        from quality.pronunciation import validate_choices
        text = "(oh) hello my world"
        self.assertEditsBound(text, "T2", self.su, "(oh) zqx my world")
        self.assertEditsBound(text, "T2", self.st, "(oh) hello zqx world")
        self.assertEditsBound(text, "head", self.su, "(zqx) hello my world")
        self.assertEditsBound(text, "head", self.st, "(oh) zqx my world")
        # A spaced enclitic is one token in two disjoint pieces; the splice
        # covers both and the gap between them.
        text = "There 's high hope"
        self.assertEqual(LH.reader_line(text).tokens[0].pieces, ((0, 5), (6, 8)))
        self.assertEditsBound(text, "head", self.st, "Zqx high hope")
        self.assertEditsBound(text, "T2", self.st, "There 's zqx hope")
        # Offsets are codepoints of the ORIGINAL (non-NFC) line: `cafe` +
        # U+0301 is one token over [0, 5). Unread by the plain lexicon, so the
        # head binds `night`; with a declared reading it binds `café`.
        text = "café night is long"
        self.assertEditsBound(text, "head", self.st, "café zqx is long")
        lex = copy.copy(self.st)
        lex.pronunciations = validate_choices([{
            "line": text, "token": 1, "word": "café", "phones": ["K", "AE0", "F", "EY1"],
            "basis": "declared", "source": "test"}], lex)
        self.assertEditsBound(text, "head", lex, "zqx night is long")
        self.assertEditsBound(text, "T1", lex, "zqx night is long")
        self.assertIsNone(self.swap(text, "T1", self.st))

    def test_the_revisers_own_lexicon_decides_the_occurrence(self):
        # A declared occurrence reading makes `O'er` readable for THIS
        # reviser; a generic lexicon would bind `the`. The reviser's splice
        # (`_splice`/`_anchors_at`) follows its own grading lexicon.
        from quality import slots as SL
        from quality.pronunciation import validate_choices
        from quality.revise import Reviser
        text = "O'er the parchment (not a rhyme),"
        lex = copy.copy(self.st)
        lex.pronunciations = validate_choices([{
            "line": text, "token": 1, "word": "O'er", "phones": ["AO1", "R"],
            "basis": "declared", "source": "test"}], lex)
        head = SL.parse_slot("1.head")
        self.assertEqual(Reviser(lex)._splice(text, head, "zqx"), "Zqx the parchment (not a rhyme),")
        self.assertEqual(Reviser(self.st)._splice(text, head, "zqx"), "O'er zqx parchment (not a rhyme),")
        self.assertEqual(Reviser(self.st)._splice("Meinself--und Gott.", head, "zqx"),
                         "Meinself--zqx Gott.")
        self.assertTrue(Reviser(self.st)._anchors_at("Meinself--und Gott.", head, "night"))
        # Under v1 the same declared lexicon changes nothing: the pre-batch body.
        v1 = copy.copy(self.v1)
        v1.pronunciations = []
        self.assertIsNone(Reviser(v1)._splice(text, head, "zqx"))

    def test_empty_unread_and_unplaceable_bindings_refuse(self):
        from unittest import mock
        import quality.loop as LP
        from quality import slots as SL
        for text in ("", "zzqx qqzx"):
            for slot in ("head", "headrime", "endword", "T1"):
                self.assertIsNone(self.swap(text, slot, self.st), (text, slot))
        self.assertIsNone(self.swap("zzqx night", "line", self.st))   # no whole-line move
        real = LP._RESOLVE
        text = "love me do"

        def rig(kind):
            def resolve(lex, line, member, promote=False):
                anchors, label, oov = real(lex, line, member, promote=promote)
                if kind == "two_words":
                    return anchors + [[dict(s, widx=s["widx"] + 1) for s in anchors[0]]], label, oov
                if kind == "untagged":
                    return [[{k: v for k, v in s.items() if k != "widx"} for s in a] for a in anchors], label, oov
                if kind == "respelled":
                    return [[dict(s, word="xx") for s in a] for a in anchors], label, oov
                if kind == "out_of_range":
                    return [[dict(s, widx=9) for s in a] for a in anchors], label, oov
                raise SL.SlotUnsupported("rigged")
            return resolve
        for kind in ("two_words", "untagged", "respelled", "out_of_range", "unsupported"):
            with mock.patch.object(LP, "_RESOLVE", rig(kind)):
                for slot in ("head", "endword", "T2", "end"):
                    self.assertIsNone(self.swap(text, slot, self.st), (kind, slot))
        self.assertEqual(self.swap(text, "head", self.st), "zqx me do")

    def test_the_default_end_checks_its_endpoint_occurrence(self):
        from unittest import mock
        import quality.loop as LP
        from quality import slots as SL
        from quality.loop import swap_at_slot, swap_end_word
        text = "I want to hold it"
        anchors, _, _ = SL.resolve(self.st, text, 1)
        # Premise: the anchors start in earlier words (`it` is weak), so the
        # one-token rule of the other slots would refuse; the endpoint is `it`.
        self.assertGreater(len({s["widx"] for a in anchors for s in a}), 1)
        self.assertEqual({a[-1]["widx"] for a in anchors}, {4})
        self.assertEqual(swap_end_word(text, "zqx", lex=self.st), "I want to hold zqx")
        self.assertEqual(self.swap(text, "end", self.st), "I want to hold zqx")
        real = LP._RESOLVE

        def ends_early(lex, line, member, promote=False):
            anchors, label, oov = real(lex, line, member, promote=promote)
            return [[dict(s, widx=3, word="hold") for s in a] for a in anchors], label, oov
        with mock.patch.object(LP, "_RESOLVE", ends_early):
            self.assertIsNone(swap_end_word(text, "zqx", lex=self.st))
            self.assertIsNone(swap_at_slot(text, SL.parse_slot("1.end"), "zqx", lex=self.st))
            # without the grading lexicon the protections alone run, as before
            self.assertEqual(swap_end_word(text, "zqx", scheme="v2"), "I want to hold zqx")
            # and v1 never reads it
            self.assertEqual(swap_end_word(text, "zqx", lex=self.v1), "I want to hold zqx")

        def unbound(lex, line, member, promote=False):
            return [], "hold", []
        with mock.patch.object(LP, "_RESOLVE", unbound):
            self.assertIsNone(swap_end_word(text, "zqx", lex=self.st))

        def unbound_named(lex, line, member, promote=False):
            # zero syllables, the endpoint label naming the replaced token
            return [], "it", []
        with mock.patch.object(LP, "_RESOLVE", unbound_named):
            self.assertIsNone(swap_end_word(text, "zqx", lex=self.st))
        # The default slot delegates to swap_end_word, carrying the lexicon.
        seen = []
        real_end = LP.swap_end_word

        def rec(t, w, scheme=None, lex=None):
            seen.append((scheme, lex))
            return real_end(t, w, scheme=scheme, lex=lex)
        with mock.patch.object(LP, "swap_end_word", rec):
            swap_at_slot(text, SL.parse_slot("1.end"), "zqx", lex=self.su)
            swap_at_slot(text, 1, "zqx", scheme="v1")
        self.assertEqual(seen, [("v2", self.su), ("v1", None)])

    def test_a_default_end_binding_zero_syllables_refuses(self):
        # 3PO #519 6163216518: where the grader binds ZERO syllables on the
        # line's end (an unread word, a numeral, a hyphenated word with no
        # whole reading) the default-end splice refuses on every production
        # path; readable ends, multi-word anchors included, splice as before.
        from types import SimpleNamespace
        from quality import slots as SL
        from quality.loop import default_propose, default_propose_group, swap_end_word
        from quality.revise import Reviser
        unbound = ("the night was zzqx", "I gave the rent of Exmoor",
                   "and so we sang it 45", "the bells were ringing a-heav\u00e8n",
                   "a song of brook-zzqx")
        readable = (("I want to hold it", "I want to hold zqx"),
                    ("do me a favour, do", "do me a favour, zqx"),
                    ("the night was cold", "the night was zqx"),
                    ("(1) An' cut a lock", "(1) An' cut a zqx"))
        for lex in (self.st, self.su):
            for text in unbound:
                anchors, label, _ = SL.resolve(lex, text, 1)
                self.assertEqual(anchors, [], text)       # premise: zero bound
                self.assertEqual(label, LH.reader_line(text, lex.strip_parens, "v2").tokens[-1].text)
                self.assertIsNone(swap_end_word(text, "zqx", lex=lex), text)
                self.assertIsNone(self.swap(text, "end", lex), text)
                b = SimpleNamespace(text=text, slot=None, line_no=1, candidates=["zqx"])
                self.assertIsNone(default_propose(b, [text], 0, scheme="v2",
                                                  strip_parens=lex.strip_parens, lex=lex), text)
                g = SimpleNamespace(members=(1, 2),
                                    proposal_for={1: ("the night was cold", "zqx", None),
                                                  2: (text, "zqx", None)}.get)
                self.assertIsNone(default_propose_group(g, scheme="v2",
                                                        strip_parens=lex.strip_parens, lex=lex))
                self.assertIsNone(Reviser(lex)._splice(text, 1, "zqx"), text)
            for text, want in readable:
                self.assertTrue(SL.resolve(lex, text, 1)[0], text)
                self.assertEqual(swap_end_word(text, "zqx", lex=lex), want)
                self.assertEqual(self.swap(text, "end", lex), want)
                self.assertEqual(Reviser(lex)._splice(text, 1, "zqx"), want)
                self.assertEqual(self.edited_span(text, want), self.bound_span(lex, text, "end"))
        # v1 keeps the pre-batch splice (its unread end words included).
        self.assertEqual(swap_end_word("the night was zzqx", "zqx", lex=self.v1), "the night was zqx")
        self.assertEqual(swap_end_word("the night was zzqx", "zqx", scheme="v1"), "the night was zqx")

    def _declared_on(self, lex, text, token, word):
        from quality.pronunciation import validate_choices
        out = copy.copy(lex)
        out.pronunciations = validate_choices([{
            "line": text, "token": token, "word": word, "phones": ["L", "AH1", "V"],
            "basis": "declared", "source": "test"}], out)
        return out

    def test_a_span_holding_more_than_word_material_refuses(self):
        # `_only_word_material`, pinned (BB8 #527 6164278661: no test caught
        # its removal). A token can hold a printed symbol the token
        # repertoire reads (`love×you`, `lo÷ve`) or one whose normal form is
        # a symbol (U+1FEF GREEK VARIA folds to U+0060, U+1FFD GREEK OXIA to
        # U+00B4). Unread, the grader binds nothing there; with a declared
        # reading it binds that token, and replacing its raw span would
        # delete the symbol (`love×you more` -> `zqx more`). Every path
        # refuses; the same lines without the symbol splice.
        from quality import slots as SL
        from quality.loop import swap_end_word
        from quality.revise import Reviser
        cases = (("love\u00d7you more", 1, "head", "zqx more"),
                 ("love\u00d7you more", 1, "T1", "zqx more"),
                 ("more love\u00d7you", 2, "endword", "more zqx"),
                 ("the night of lo\u00f7ve", 4, "T4", "the night of zqx"),
                 ("I sing to my lo\u1fefve", 5, "endword", "I sing to my zqx"))
        for lex0 in (self.st, self.su):
            for text, token, slot, deleted in cases:
                tok = LH.reader_line(text, lex0.strip_parens, "v2").tokens[token - 1]
                lex = self._declared_on(lex0, text, token, tok.text)
                with self.subTest(text=text, slot=slot, sung=not lex0.strip_parens):
                    # premise: the grader binds exactly that token, whose raw
                    # span holds the symbol
                    self.assertEqual(self.bound_span(lex, text, slot),
                                     (tok.pieces[0][0], tok.pieces[-1][1]))
                    self.assertTrue(any(unicodedata.category(c)[0] == "S"
                                        for c in text[tok.pieces[0][0]:tok.pieces[-1][1]]))
                    self.assertIsNone(self.swap(text, slot, lex))
                    self.assertIsNone(Reviser(lex)._splice(text, SL.parse_slot("1." + slot), "zqx"))
            # The default end: the run is the token's whole span, symbol
            # included.
            for text in ("I sing to my lo\u1fefve", "I sing to my love\u1ffd"):
                tok = LH.reader_line(text, lex0.strip_parens, "v2").tokens[-1]
                lex = self._declared_on(lex0, text, 5, tok.text)
                with self.subTest(text=text, slot="end", sung=not lex0.strip_parens):
                    self.assertTrue(SL.resolve(lex, text, 1)[0])          # bound
                    self.assertIsNone(swap_end_word(text, "zqx", lex=lex))
                    self.assertIsNone(self.swap(text, "end", lex))
                    self.assertIsNone(Reviser(lex)._splice(text, 1, "zqx"))
            # Controls: word material alone (marks, apostrophes, U+00AD) splices.
            for text, slot, want in (("love you more", "head", "zqx you more"),
                                     ("I sing to my love", "end", "I sing to my zqx"),
                                     ("I sing to my lo\u0301ve", "endword", "I sing to my zqx")):
                tok = LH.reader_line(text, lex0.strip_parens, "v2").tokens[-1 if slot != "head" else 0]
                idx = len(LH.reader_line(text, lex0.strip_parens, "v2").tokens) if slot != "head" else 1
                lex = self._declared_on(lex0, text, idx, tok.text)
                self.assertEqual(self.swap(text, slot, lex), want, text)

    def test_the_default_end_endpoint_must_be_the_replaced_pieces(self):
        # The endpoint-pieces check of `_end_occurrence_bound` (default end),
        # pinned. The grader's endpoint must be the token the swap replaces,
        # by raw pieces as well as position and spelling: `do me a favour,
        # do` has two `do`, and a token re-read from a respaced copy of the
        # line names the same index and spelling at other offsets. Removing
        # the check makes both agree (the anchors end on the last token's
        # `widx` with its spelling). On the measured 3,990-line population no
        # production splice reaches this check with a mismatch (the asides-
        # kept cut and the lexicon's cut differ at the end on 264 line-modes,
        # and an earlier guard refuses each), so it is defence in depth: the
        # helper is called directly.
        from quality.loop import _end_occurrence_bound
        for lex in (self.st, self.su):
            text = "do me a favour, do"
            toks = LH.reader_line(text, lex.strip_parens, "v2").tokens
            self.assertTrue(_end_occurrence_bound(lex, text, toks[-1]))
            self.assertEqual(toks[0].text, toks[-1].text)               # premise
            self.assertFalse(_end_occurrence_bound(lex, text, toks[0]))
            shifted = LH.reader_line("do me a favour,  do", lex.strip_parens, "v2").tokens[-1]
            self.assertEqual((shifted.text, len(toks)), (toks[-1].text, 5))
            self.assertNotEqual(shifted.pieces, toks[-1].pieces)
            self.assertFalse(_end_occurrence_bound(lex, text, shifted))
            other = LH.reader_line("do me a favour, go", lex.strip_parens, "v2").tokens[-1]
            self.assertEqual(other.pieces, toks[-1].pieces)               # same span, other word
            self.assertFalse(_end_occurrence_bound(lex, text, other))

    def test_the_direct_helper_line_and_group_paths(self):
        from types import SimpleNamespace
        from quality import slots as SL
        from quality.loop import (default_propose, default_propose_group, swap_at_slot)
        text = "(1) An' teäke an' cut a lock o' frith, an' drow"
        head = SL.parse_slot("1.head")
        # Direct helper: no grading lexicon, no known binding -> refuse
        # (the pre-repair v2 splice edited `1` here).
        self.assertIsNone(swap_at_slot(text, head, "zqx", scheme="v2", strip_parens=False))
        self.assertIsNone(swap_at_slot(text, head, "zqx", scheme="v2"))
        # Conflicting coordinates refuse rather than pick one.
        self.assertIsNone(swap_at_slot(text, head, "zqx", scheme="v1", lex=self.su))
        self.assertIsNone(swap_at_slot(text, head, "zqx", strip_parens=True, lex=self.su))
        self.assertEqual(swap_at_slot(text, head, "zqx", lex=self.su),
                         "(1) Zqx teäke an' cut a lock o' frith, an' drow")
        # Line stub.
        b = SimpleNamespace(text=text, slot=head, line_no=1, candidates=["zqx"])
        self.assertEqual(default_propose(b, [text], 0, scheme="v2", strip_parens=False, lex=self.su),
                         "(1) Zqx teäke an' cut a lock o' frith, an' drow")
        self.assertIsNone(default_propose(b, [text], 0, scheme="v2", strip_parens=False))
        # Group stub: every member at its own binding, or None.
        props = {1: (text, "zqx", head), 2: ("Meinself--und Gott.", "zqx", head),
                 3: ("1 love you so", "zqx", SL.parse_slot("1.T2"))}
        g = SimpleNamespace(members=(1, 2, 3), proposal_for=props.get)
        self.assertEqual(default_propose_group(g, scheme="v2", strip_parens=False, lex=self.su),
                         ("(1) Zqx teäke an' cut a lock o' frith, an' drow",
                          "Meinself--zqx Gott.", "1 zqx you so"))
        self.assertIsNone(default_propose_group(g, scheme="v2", strip_parens=False))
        props[3] = ("1 love you so", "zqx", SL.parse_slot("1.T1"))
        self.assertIsNone(default_propose_group(g, scheme="v2", strip_parens=False, lex=self.su))

    def test_v1_is_unchanged_whatever_lexicon_is_passed(self):
        from quality import slots as SL
        from quality.loop import swap_at_slot
        for text, slot, want in (("(oh) hello world", "head", None),
                                 ("Meinself--und Gott.", "head", "Zqx Gott."),
                                 ("1 love you so", "T1", "1 zqx you so"),
                                 ("love, love me do", "T2", "love, zqx me do"),
                                 ("There 's high hope", "head", None),
                                 ("hold me (hold me) closer now", "T3", None)):
            s = SL.parse_slot("1." + slot)
            for lex in (self.v1, self.v1s, None):
                for sp in (True, False):
                    self.assertEqual(swap_at_slot(text, s, "zqx", scheme="v1", strip_parens=sp, lex=lex),
                                     want, (text, slot, sp))

    def test_every_v2_edit_lands_on_the_bound_token(self):
        from quality import slots as SL
        # Property over corpus lines (numerals, dashes, asides and unread
        # words included), both aside rules: an edit replaces exactly the
        # token the grader binds; where the grader binds none, it refuses.
        lines = []
        for p in sorted((ROOT / "corpus" / "song").glob("eng_*.txt"))[::7]:
            lines += [ln for ln in LH.load_lyric_lines(str(p))][:120]
        edits = refusals = moved = end_edits = end_unbound = 0
        for text in lines[:1200]:
            for lex in (self.st, self.su):
                toks = LH.reader_line(text, lex.strip_parens, "v2").tokens
                for slot in ("end", "head", "headrime", "endword", "T1", "T2", "T3"):
                    new = self.swap(text, slot, lex)
                    want = self.bound_span(lex, text, slot)
                    if slot == "end" and not SL.resolve(lex, text, 1)[0]:
                        # the default end binds ZERO syllables: it must refuse
                        end_unbound += 1
                        self.assertIsNone(new, (text, lex.strip_parens))
                    if new is None:
                        refusals += 1
                        continue
                    self.assertIsNotNone(want, (text, slot, lex.strip_parens, new))
                    self.assertEqual(self.edited_span(text, new), want, (text, slot, new))
                    edits += 1
                    if slot == "end":
                        end_edits += 1
                        continue
                    lit = toks[0] if slot.startswith("head") else toks[-1] if slot == "endword" else None
                    if lit is not None and (lit.pieces[0][0], lit.pieces[-1][1]) != want:
                        moved += 1
        self.assertGreater(edits, 3000)
        self.assertGreater(refusals, 100)
        self.assertGreater(moved, 10)     # the literal token is not the bound one
        self.assertGreater(end_edits, 1000)   # readable default ends still splice
        self.assertGreater(end_unbound, 10)   # and the unbound ones were exercised


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
        bound = unbound = refused = 0
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
            elif tok.pieces[-1][1] > last.pieces[0][0]:
                # The last sung token overlaps the run without being it, or
                # ends after it: no readable end word, so no key.
                self.assertEqual((token, key), (None, None), text)
                refused += 1
            else:
                self.assertIsNone(token, text)
                self.assertEqual(key, G.rime_cmudict(base)(word), text)
                unbound += 1
        self.assertGreater(bound, 500)
        self.assertGreater(unbound, 20)
        self.assertGreater(refused, 20)
        # Regressions: no fragment of a token is ever the end word, and an
        # undeclared numeral endpoint keys nothing.
        rk = G.rime_cmudict(base)
        # A run that is a fragment of the last token, carries a mark NFC
        # cannot compose, or ends before the last token keys nothing (the
        # stream and line_anchors refuse those ends), and _qafiya_parts
        # refuses them too.
        for text in ("love \u00d7night", "love night\u0333", "I said \u00d7"):
            self.assertIsNone(rk.end_occurrence(text)[2], text)
            self.assertEqual(LH.line_anchors(base, text)[0], [], text)
            self.assertTrue(LH._qafiya_parts(base, text)["unreadable"], text)
        self.assertEqual(rk.end_occurrence("the room on fire")[1:], (4, "AY ER"))
        self.assertFalse(LH._qafiya_parts(base, "the room on fire")["unreadable"])
        self.assertEqual(rk.end_occurrence("we sing 4\u2011ever"), ("4-ever", 3, None))
        self.assertEqual(rk.end_occurrence("we co\u00adoperate")[:2], ("cooperate", 2))
        self.assertEqual(rk.end_occurrence("we sing it to\u2011night"),
                         rk.end_occurrence("we sing it to-night"))

    def test_the_grid_refuses_a_numeral_end_and_binds_after_a_dash_run(self):
        # 8c. `rime_cmudict.end_occurrence`: an undeclared numeral end token
        # is located (its word and token) and keys nothing; a writer's
        # declared reading of the end token after an ASCII dash run binds that
        # token at its v2 position and keys the declared phones -- the v1
        # position never validates.
        import quality.grid as G
        from quality.pronunciation import validate_choices
        base = LH.Lexicon()
        rk = G.rime_cmudict(base)
        for text, word, token in (("the year 1999", "1999", 3), ("heart.    10", "10", 2),
                                  ("we sing ½", "½", 3)):
            self.assertEqual(rk.end_occurrence(text), (word, token, None), text)
        lawdy = "U--h, u--h, Lawdy"
        self.assertEqual(LH.line_tokens(lawdy), ["U", "h", "u", "h", "Lawdy"])
        row = {"line": lawdy, "token": 5, "word": "Lawdy", "phones": ["L", "AO1", "D", "IY0"],
               "basis": "declared", "source": "the singer"}
        lex = copy.copy(base)
        lex.pronunciations = validate_choices([row], lex)
        self.assertEqual(G.rime_cmudict(lex).end_occurrence(lawdy), ("lawdy", 5, "AO D IY"))
        with self.assertRaisesRegex(ValueError, "token 3 there is 'u'"):
            validate_choices([dict(row, token=3)], base)
        # A declared numeral end binds the same way.
        year = {"line": "the year 1999", "token": 3, "word": "1999", "basis": "declared",
                "phones": ["N", "AY1", "N", "T", "IY1", "N", "N", "AY1", "N", "T", "IY0"],
                "source": "the singer"}
        lex = copy.copy(base)
        lex.pronunciations = validate_choices([year], lex)
        self.assertEqual(G.rime_cmudict(lex).end_occurrence("the year 1999"),
                         ("1999", 3, "AY N T IY"))

    def test_a_declaration_never_changes_the_token_cut(self):
        # 8e. The same `--voices` line read with and without a pronunciation
        # declaration is cut into the same tokens on every surface the grader
        # reads it through: a declaration narrows one token's reading, never
        # the coordinate it is bound in.
        import quality.fit as FT
        import quality.relations as RL
        from quality.phonology.eng import English
        from quality.pronunciation import validate_choices
        from quality.revise import relation_phonology_for   # what Reviser reads
        plain = LH.Lexicon(strip_parens=False)

        def cut(lex, text):
            eng = English(lexicon=lex)
            words = LH.line_tokens(text, lex.strip_parens, LH._scheme_of(lex))
            # The declared token gains syllables (that is the point of it);
            # every syllable still sits on its own token of the same cut.
            for s in LH.word_syllable_map(lex, text):
                self.assertEqual(words[s["widx"]], s["word"], text)
            return {"line_tokens": words,
                    "transcribe": lex.for_line(text).transcribe(text)[1],
                    "anchor_end": LH.line_anchors(lex, text)[1],
                    "stream": list(RL.build_stream([text], eng).lexical_tokens[0]),
                    "fit": list(FT.read_line(text, phon=eng, strip_parens=False).tokens),
                    "relations": relation_phonology_for(lex).tokens_for_line(text)}
        checked = 0
        for text in [t for t in GENERATED if "(" in t][:150] + [
                "I love you (yeah, 4ever--more)", "we go (oh) 's the night (U--h)"]:
            if len(text) > 4000 or any(c in text for c in "\r\n") or not text.strip():
                continue
            toks = LH.line_tokens(text, False)
            if not toks:
                continue
            want = cut(plain, text)
            for k in sorted({0, len(toks) // 2, len(toks) - 1}):
                row = {"line": text, "token": k + 1, "word": toks[k], "basis": "declared",
                       "phones": ["N", "AY1", "N"], "source": "test"}
                lex = copy.copy(plain)
                lex.pronunciations = validate_choices([row], plain)
                self.assertEqual(cut(lex, text), want, (text, k))
                checked += 1
        self.assertGreater(checked, 200)

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


class LexiconCut(unittest.TestCase):
    """8b. A consumer handed a lexicon cuts lines under that lexicon's scheme,
    not this process's (amendment B)."""

    def test_consumers_cut_under_the_lexicons_scheme(self):
        import quality.loop as LP
        from quality.revise import Reviser
        lines = GENERATED[:500] + RC.REGRESSIONS
        moved = 0
        for process, own in (("v2", "v1"), ("v1", "v2")):
            for sp in (True, False):
                lex = LH.Lexicon(reader_scheme=own, strip_parens=sp)
                rv = Reviser(lex=lex)
                # Under v1 the loop's cut is the pre-batch call verbatim
                # (default strip_parens), whatever the lexicon declares (D1).
                loop_sp = True if own == "v1" else sp
                with LH.reader_scheme_scope(process):
                    self.assertEqual(LP._lex_cut(rv), (loop_sp, own))
                    for text in lines:
                        want_end = LH.raw_final_token(text, sp, own)
                        moved += want_end != LH.raw_final_token(text, sp, process)
                        # `_qafiya_parts` names the end word it judged.
                        self.assertEqual(LH._qafiya_parts(lex, text).get("endword"),
                                         want_end, (process, own, text))
                        # The loop's end word and end-token index (tier 2).
                        self.assertEqual(LH.raw_final_token(text, *LP._lex_cut(rv)),
                                         LH.raw_final_token(text, loop_sp, own),
                                         (process, own, text))
                        if own == "v2":
                            self.assertEqual(LH.line_tokens(text, *LP._lex_cut(rv)),
                                             lex.transcribe(text)[1], (process, own, text))
                        else:
                            self.assertEqual(LH.line_tokens(text, *LP._lex_cut(rv)),
                                             LH._line_tokens_v1(text), (process, own, text))
        self.assertGreater(moved, 50)

    def test_a_v1_voices_tier2_cut_is_the_pre_batch_one(self):
        # Regression: `_lex_cut` passed a `--voices` lexicon's strip_parens
        # into the v1 cut, so a v1 replay's tier-2 pivot end word and anchor
        # end-token index read the aside the pre-batch harness stripped, and
        # asked a different group question than the one recorded. The
        # expected values are the pre-batch export's (fce4bf0f) own output.
        import quality.loop as LP
        from quality.revise import Reviser
        text = "I left my heart beside the door (the floor)"
        lines = [text, "You never came to see the shore",
                 "I watched the floor and waited more", "The night is cold and full of rain"]
        want = {(9, "A"): ([], []), (9, "B"): ([], []),
                (7, "A"): (["more"], []), (7, "B"): (["shore"], [])}
        for process in ("v1", "v2"):
            with LH.reader_scheme_scope(process):
                rv = Reviser(lex=LH.Lexicon(strip_parens=False, reader_scheme="v1"))
                self.assertEqual(LH.raw_final_token(text, *LP._lex_cut(rv)), "door")
                self.assertEqual(len(LH.line_tokens(text, *LP._lex_cut(rv))) - 1, 6)
                for t in (9, 7):
                    m = rv.mandate(lines, [[1, 2], [f"1.T{t}", 3]])
                    for lab in m.labels:
                        self.assertEqual(
                            LP._anchor_obligations(rv, m, lines, 1, 2, rewriting_label=lab),
                            want[(t, lab)], (process, t, lab))
                # v2 keeps the lexicon's aside rule: the aside is the end word.
                rv2 = Reviser(lex=LH.Lexicon(strip_parens=False, reader_scheme="v2"))
                self.assertEqual(LH.raw_final_token(text, *LP._lex_cut(rv2)), "floor")

    def test_the_any_reading_search_cuts_as_the_stream_does(self):
        # Regression: under a plain `--voices` lexicon the relation stream
        # keeps asides (English(strip_parens=False), no lexicon), but the
        # any-reading search located and pinned occurrences through the
        # shared lexicon, which strips them, so an end word sung inside
        # `(...)` could not be found and the pair stayed undecided.
        import quality.relations as RL
        from quality.revise import relation_phonology_for
        phon = relation_phonology_for(LH.Lexicon(strip_parens=False))
        self.assertFalse(phon._aside_rule())
        self.assertFalse(phon.cut_lexicon().strip_parens)
        for lines in (["we go (live)", "they all give"], ["we go live", "they all give"],
                      ["(oh) we live", "(ah) they give"]):
            build = RL.cached_builder(lambda p, lines=lines: RL.build_stream(lines, p))
            self.assertEqual(RL.resolve_line_pair(RL.REGISTRY["perfect rhyme"],
                                                  build(phon), (1, 2), build),
                             (True, ["live = L IH1 V"]), lines)
            combos, _ = RL.reading_combos(build(phon), {(0, len(build(phon).lexical_tokens[0]) - 1)})
            trial = RL.pinned_phonology(build(phon), combos[0])
            self.assertFalse(trial._aside_rule(), lines)
        # The default aside rule still strips: `go` is that line's end word.
        plain = relation_phonology_for(LH.Lexicon())
        build = RL.cached_builder(lambda p: RL.build_stream(["we go (live)", "they all give"], p))
        self.assertEqual(RL.resolve_line_pair(RL.REGISTRY["perfect rhyme"],
                                              build(plain), (1, 2), build)[0], False)

    def test_no_production_cut_omits_its_scheme(self):
        # Every production call of the four cuts names a scheme (its
        # lexicon's, or an explicit one) or says, on its line or the one
        # above, that it reads the process's scheme because it has no
        # lexicon. A bare call beside a lexicon read the process's cut while
        # the lexicon read its own.
        import ast
        names = {"line_tokens", "raw_final_token", "reader_line", "reader_token_spans"}
        files = ([ROOT / "lyric_harness.py"]
                 + sorted(p for p in (ROOT / "quality").rglob("*.py")
                          if not p.name.startswith("test_")
                          and not {"results", "fixtures", "archive"} & set(p.parts))
                 + sorted(p for p in (ROOT / "library").glob("*.py")
                          if not p.name.startswith("test_")))
        bare = []
        for path in files:
            src = path.read_text(encoding="utf-8")
            lines = src.splitlines()
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                tree = ast.parse(src)
            for n in ast.walk(tree):
                if not isinstance(n, ast.Call):
                    continue
                fn = n.func
                name = getattr(fn, "attr", None) or getattr(fn, "id", None)
                if name not in names:
                    continue
                if (len(n.args) >= 3 or any(k.arg == "scheme" for k in n.keywords)
                        or any(isinstance(a, ast.Starred) for a in n.args)):
                    continue
                near = " ".join(lines[max(0, n.lineno - 2):n.lineno])
                if "the process's scheme" not in near:
                    bare.append(f"{path.relative_to(ROOT)}:{n.lineno}")
        self.assertEqual(bare, [])

    def test_the_library_language_tokens_and_lexicon_share_a_scheme(self):
        from unittest.mock import patch
        sys.path.insert(0, str(ROOT / "library"))
        from library.form import analyze_language
        import library.test_form as TF
        work = TF.source(["Sail the year 1999", "Sail away home"], "eng")
        for scheme, end in (("v1", "year"), ("v2", "1999")):
            with LH.reader_scheme_scope(scheme), \
                    patch("lyric_harness.Lexicon", wraps=LH.Lexicon) as built:
                result = analyze_language(work)
            self.assertEqual(result["line_endings"][0]["word"], end)
            self.assertEqual({c.kwargs.get("reader_scheme") for c in built.call_args_list},
                             {scheme})


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

    def test_pre_batch_states_resume_as_v1_through_the_cli(self):
        # Real states the PRE-BATCH harness wrote (fixtures/
        # reader_v1_defer_states.json, captured on fce4bf0f by
        # capture_reader_v1_defer_states.py): the safe-point stop a call with
        # a deadline writes (`stopped`), and the mid-run saves (`started`,
        # and `grading` with a saved position) -- none holds an answer, a
        # pending question or a completion marker -- and a suspended state
        # whose question is answered, which runs to the end. Resumed through the CLI
        # with no flag, each reads as v1 and keeps v1 in the state it writes
        # back.
        #
        # WHAT IT IS COMPARED WITH, precisely. A saved position (`cursor`) is
        # trusted only under the scorer that took it (`_scorer_identity`, a
        # digest of the harness source, data and Python version -- the rule
        # that predates this batch). Every source change moves that digest, so
        # this build replays a pre-batch state that carries a cursor from
        # round 1 (`cursor_stripped` "run_key"), where the pre-batch harness
        # resuming the IDENTICAL file trusted its own cursor (`resume_*`:
        # `cursor_resumed` true). Against that identical-file resume the
        # output is NOT equal for those states (asserted below): the stdout
        # and the written state's cursor differ, and on a resumed run the
        # checkpoint lines and memo counts too. "Only reader_scheme differs"
        # holds against the pre-batch harness resuming the SAME state with its
        # cursor removed (`replay_*`), which is what each state is compared
        # with: equal once `reader_scheme` and the cursor fields are set
        # aside. For a state without a cursor the two pre-batch records are
        # the same run. This is the scorer-identity rule, not the reader
        # scheme; the scheme is pinned by asserting v1 in every record.
        fx = json.loads((HERE / "fixtures" / "reader_v1_defer_states.json")
                        .read_text(encoding="utf-8"))
        env = {k: v for k, v in os.environ.items()
               if k not in ("LYRIC_CONTROL_TOKEN", "LYRIC_REQUEST_DEADLINE_MS",
                            "LYRIC_CHECKPOINT_PATH")}

        def strip(rec):
            return {k: v for k, v in rec.items()
                    if k not in ("reader_scheme", "cursor") and not k.startswith("cursor_")}

        # THE RECORDED QUESTION OFFERED WORD LISTS, AND THIS BUILD PRINTS NONE
        # (2026-10-27, D6 on #519). The pre-batch harness rendered OFFERED,
        # FORBIDDEN and THE WORD ALREADY THERE blocks and a third rule about
        # moving onto a FORBIDDEN word. Exactly those are set aside on the
        # RECORDED side, the rules after it renumbered, and the rest of the
        # question must still match byte for byte.
        def without_d6(text):
            out, skip, rule3 = [], False, False
            for line in text.split("\n"):
                if line.startswith(("OFFERED — ", "FORBIDDEN — ",
                                    "THE WORD ALREADY THERE — ")):
                    skip = True
                    continue
                if skip:
                    skip = line != ""
                    continue
                if line.startswith("  3. The end word L") and "FORBIDDEN" in line:
                    rule3 = True
                    continue
                if rule3:
                    if not line.startswith("  4. "):
                        continue
                    rule3 = False
                if line.startswith("  4. The line must FIX"):
                    line = "  3." + line[4:]
                elif line.startswith("  5. It may not trade"):
                    line = "  4." + line[4:]
                out.append(line)
            return "\n".join(out)

        def recorded(rec):
            rec = dict(rec)
            if isinstance(rec.get("pending"), dict) and "prompt" in rec["pending"]:
                rec["pending"] = {**rec["pending"],
                                  "prompt": without_d6(rec["pending"]["prompt"])}
            return rec

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
                         ["stopped", "started", "grading+cursor", "suspended+answer"])
        for rec in fx["states"]:
            work = Path(tempfile.mkdtemp())
            self.addCleanup(__import__("shutil").rmtree, work, True)
            (work / "draft.txt").write_text("\n".join(fx["draft"]) + "\n", encoding="utf-8")
            state = work / "state.json"
            state.write_text(rec["state"], encoding="utf-8")
            self.assertNotIn("reader_scheme", json.loads(rec["state"]))
            # The last is an ordinary continuation: a suspended state with its
            # question answered, resumed to the end of the run (8b).
            self.assertEqual(rec["name"] == "suspended+answer",
                             bool(json.loads(rec["state"]).get("pending")))
            self.assertEqual(LH._recorded_reader_scheme(
                [a.replace("<WORK>", str(work)) for a in fx["verb"]]), "v1")
            r = subprocess.run([sys.executable, str(ROOT / "lyric_harness.py"),
                                *[a.replace("<WORK>", str(work)) for a in fx["verb"]]],
                               capture_output=True, text=True, env=env, cwd=ROOT, timeout=900)
            with self.subTest(state=rec["name"]):
                self.assertEqual(r.returncode, rec["replay_exit"], r.stdout[-600:])
                got = norm(r.stdout.replace(str(work), "<WORK>"))
                self.assertEqual(got, norm(without_d6(rec["replay_stdout"])))
                result = json.loads([l for l in r.stdout.splitlines()
                                     if l.startswith("  lyric result: ")][-1]
                                    [len("  lyric result: "):])
                pre = json.loads([l for l in rec["resume_stdout"].splitlines()
                                  if l.startswith("  lyric result: ")][-1]
                                 [len("  lyric result: "):])
                if "cursor" in json.loads(rec["state"]):
                    # the scorer-identity rule: the pre-batch harness trusted
                    # its cursor, this build replays from round 1 ...
                    self.assertTrue(pre["cursor_resumed"])
                    self.assertEqual((result["cursor_resumed"], result["cursor_stripped"]),
                                     (False, "run_key"))
                    # ... so the identical-file resume is not what it equals
                    self.assertNotEqual(got, norm(without_d6(rec["resume_stdout"])))
                else:
                    self.assertEqual(norm(rec["resume_stdout"]), norm(rec["replay_stdout"]))
                self.assertIn('"reader_scheme":"v1"', r.stdout)
                self.assertNotIn('"reader_scheme":"v2"', r.stdout)
                written = json.loads(state.read_text(encoding="utf-8"))
                self.assertEqual(written["reader_scheme"], "v1")
                self.assertNotIn("reader_scheme", written["answered"])
                self.assertEqual(strip(written),
                                 strip(recorded(json.loads(rec["replay_written"]))))

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

    def test_tryline_reads_a_deferred_state_under_its_recorded_scheme(self):
        # `tryline --propose=defer:STATE` answers against the state's current
        # draft without resuming it, so it never reached `_defer_proposer`'s
        # scheme refusal: an explicit contrary --reader-scheme, or a recorded
        # scheme this build does not read, was answered under the wrong cut.
        # Both readers of a state now apply one read-only check
        # (`_defer_scheme_check`) with the same words; with no flag the state's
        # recorded scheme is inherited (absent: v1). The state file is never
        # written by the pre-flight, refused or answered.
        work = Path(tempfile.mkdtemp())
        self.addCleanup(__import__("shutil").rmtree, work, True)
        lines = ["the water holds the light", "the morning turns to grey",
                 "nothing here is still", "and i will find a way",
                 "keep the low knot tight", "say what the river wrote",
                 "hold the door for rain", "nothing turns about",
                 "carry the cold stone", "marry the old bone",
                 "quiet folds a wing", "grief is a small thing"]
        draft = work / "d12.txt"
        draft.write_text("\n".join(lines) + "\n", encoding="utf-8")
        env = {k: v for k, v in os.environ.items()
               if k not in ("LYRIC_CONTROL_TOKEN", "LYRIC_REQUEST_DEADLINE_MS",
                            "LYRIC_CHECKPOINT_PATH")}
        states = {}
        for name, extra in (("legacy", {}), ("v2", {"reader_scheme": "v2"}),
                            ("v9", {"reader_scheme": "v9"})):
            path = work / f"{name}.json"
            path.write_text(json.dumps(dict(
                {"version": 1, "answered": {"propose": [], "propose_group": []},
                 "pending": None, "input_draft": lines, "accepted_lines": lines,
                 "round": 1, "status": "started"}, **extra)), encoding="utf-8")
            states[name] = path

        def refusal(stdout):
            return next((l.strip() for l in stdout.splitlines() if "REFUSED" in l), None)

        def run(verb, state, *flags):
            tail = (["3", "nothing here is very still"] if verb == "tryline" else [])
            before = state.read_bytes()
            r = subprocess.run([sys.executable, str(ROOT / "lyric_harness.py"), *flags,
                                verb, str(draft), *tail, "--seed=7", "--lines=12",
                                f"--propose=defer:{state}"],
                               capture_output=True, text=True, env=env, cwd=ROOT,
                               timeout=900)
            if verb == "tryline":
                self.assertEqual(state.read_bytes(), before, "the pre-flight wrote the state")
            return r

        cases = (("legacy", ("--reader-scheme=v2",), "READER_SCHEME_MISMATCH",
                  "--reader-scheme=v1"),
                 ("v2", ("--reader-scheme=v1",), "READER_SCHEME_MISMATCH",
                  "--reader-scheme=v2"),
                 ("v9", (), "recorded reader scheme 'v9'", "(v1, v2)"),
                 ("v9", ("--reader-scheme=v2",), "recorded reader scheme 'v9'", "(v1, v2)"))
        for name, flags, cause, remedy in cases:
            with self.subTest(state=name, flags=flags):
                r = run("tryline", states[name], *flags)
                self.assertEqual(r.returncode, 2, r.stdout[-600:])
                said = refusal(r.stdout)
                self.assertIsNotNone(said, r.stdout[-600:])
                self.assertIn(cause, said)
                self.assertIn(remedy, said)
                self.assertNotIn("VERDICT", r.stdout)
                # the resuming verb refuses the same state in the same words
                self.assertEqual(refusal(run("finish", states[name], *flags).stdout), said)
        for name, flags, want in (("legacy", (), "v1"), ("legacy", ("--reader-scheme=v1",), "v1"),
                                  ("v2", (), "v2"), ("v2", ("--reader-scheme=v2",), "v2")):
            with self.subTest(inherits=name, flags=flags):
                r = run("tryline", states[name], *flags)
                self.assertIn(r.returncode, (0, 3), r.stdout[-600:])
                self.assertNotIn("REFUSED", r.stdout)
                row = json.loads(next(l for l in r.stdout.splitlines()
                                      if l.startswith("  lyric result: "))
                                 [len("  lyric result: "):])
                self.assertEqual((row["reader_scheme"], row["against"]), (want, "state"))

    def test_the_deferred_scheme_check_writes_nothing(self):
        import contextlib
        import copy as _copy
        import io
        saved = (LH._ACTIVE_READER_SCHEME, LH._READER_SCHEME_DECLARED)
        try:
            for payload, active, declared, want in (
                    ({"answered": {"propose": [], "propose_group": []}}, "v1", False, "v1"),
                    ({"answered": {"propose": []}, "reader_scheme": "v2"}, "v2", True, "v2")):
                path = self._state(payload)
                st = json.loads(Path(path).read_text(encoding="utf-8"))
                snap = _copy.deepcopy(st)
                LH._ACTIVE_READER_SCHEME, LH._READER_SCHEME_DECLARED = active, declared
                self.assertEqual(LH._defer_scheme_check(path, st), want)
                self.assertEqual(st, snap)
                self.assertEqual(json.loads(Path(path).read_text(encoding="utf-8")), payload)
            self.assertIsNone(LH._defer_scheme_check("/nonexistent/state.json",
                                                     {"answered": {}}))
            LH._ACTIVE_READER_SCHEME, LH._READER_SCHEME_DECLARED = "v2", True
            path = self._state({"answered": {"propose": []}})
            with contextlib.redirect_stdout(io.StringIO()) as out, \
                    self.assertRaises(SystemExit):
                LH._defer_scheme_check(path, json.loads(Path(path).read_text()))
            self.assertIn("READER_SCHEME_MISMATCH", out.getvalue())
        finally:
            LH._ACTIVE_READER_SCHEME, LH._READER_SCHEME_DECLARED = saved

    def test_a_present_null_scheme_is_malformed_not_pre_batch(self):
        # 3PO #527 6163315071: an ABSENT `reader_scheme` is a pre-batch record
        # (v1); a PRESENT `null` is malformed. A deferred state holding null
        # was resumed under v2 and a call checkpoint holding null refused
        # with advice naming `--reader-scheme=None`. Every reader of a record
        # now refuses a present value it does not read, before it touches
        # the state, in one set of words.
        import contextlib
        import copy as _copy
        import io
        from unittest import mock
        from quality.propose import ProposerUnavailable
        self.assertEqual(LH._record_scheme({}), "v1")
        self.assertIsNone(LH._record_scheme({"reader_scheme": None}))
        self.assertEqual(LH._record_scheme({"reader_scheme": "v9"}), "v9")
        saved = (LH._ACTIVE_READER_SCHEME, LH._READER_SCHEME_DECLARED)
        lines = ["the water holds the light", "the morning turns to grey"]
        try:
            for active, declared in (("v2", False), ("v2", True), ("v1", True)):
                LH._ACTIVE_READER_SCHEME, LH._READER_SCHEME_DECLARED = active, declared
                for state in ({"answered": {"propose": [], "propose_group": []},
                               "reader_scheme": None},
                              {"version": 1, "answered": {"propose": [["x"]], "propose_group": []},
                               "pending": None, "input_draft": lines, "accepted_lines": lines,
                               "reader_scheme": None}):
                    path = self._state(state)
                    before = Path(path).read_bytes()
                    st = json.loads(before)
                    snap = _copy.deepcopy(st)
                    with contextlib.redirect_stdout(io.StringIO()) as out, \
                            self.assertRaises(SystemExit):
                        LH._defer_scheme_check(path, st)
                    self.assertIn("recorded reader scheme null is malformed", out.getvalue())
                    self.assertEqual(st, snap)
                    # the resuming proposer refuses before any write
                    with contextlib.redirect_stdout(io.StringIO()) as out, \
                            self.assertRaises(SystemExit):
                        LH._defer_proposer(path, lines)
                    self.assertIn("recorded reader scheme null is malformed", out.getvalue())
                    self.assertEqual(Path(path).read_bytes(), before)
                    # main does not inherit a malformed scheme
                    self.assertIsNone(LH._recorded_reader_scheme(
                        ["finish", "d.txt", f"--propose=defer:{path}"]))
                # absent stays the pre-batch v1 record
                path = self._state({"answered": {"propose": [], "propose_group": []}})
                if active == "v1" or not declared:
                    self.assertEqual(LH._defer_scheme_check(path, json.loads(Path(path).read_text())), "v1")
                # a replay file (an `answered` block) holding null refuses alike
                rpath = self._state({"propose": [], "propose_group": [], "reader_scheme": None})
                with contextlib.redirect_stdout(io.StringIO()) as out, \
                        self.assertRaises(SystemExit):
                    LH._replay_proposer(rpath)
                self.assertIn("recorded reader scheme null is malformed", out.getvalue())
                # a kitchen checkpoint holding null: malformed, never "resume
                # with --reader-scheme=None"; the file is not rewritten
                cpath = self._state({"version": 1, "input_draft": lines, "reader_scheme": None,
                                     "proposals": [], "answered": {"propose": [], "propose_group": []}})
                before = Path(cpath).read_bytes()
                with mock.patch.dict(os.environ, {"LYRIC_CHECKPOINT_PATH": cpath}), \
                        self.assertRaises(ProposerUnavailable) as caught:
                    LH._checkpoint_proposer(None, None, lines, "k", "call:x")
                self.assertIn("recorded reader scheme null is malformed", str(caught.exception))
                self.assertNotIn("None", str(caught.exception))
                self.assertEqual(Path(cpath).read_bytes(), before)
        finally:
            LH._ACTIVE_READER_SCHEME, LH._READER_SCHEME_DECLARED = saved

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
        calls = work / "calls.log"
        (work / "stubwriter.py").write_text(
            "def factory():\n    def call(prompt):\n"
            "        open(%r, 'a').write('call\\n')\n"
            "        return %r\n    return call\n"
            % (str(calls), fx["stub_answer"]), encoding="utf-8")
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
        # NOT BYTE FOR BYTE SINCE 2026-10-27 (D6 on #519). The checkpoint's
        # journal pins the question it asked, and the pre-batch question
        # offered word lists this build never prints, so the run cannot
        # replay it. It PARKS (3PO's finding on #627): the typed new-run stop
        # the website already offers "Start new work from current draft" on,
        # with the checkpoint's accepted draft as the way forward. What the
        # reader scheme owes still holds: the checkpoint is read as v1 with no
        # flag and with --reader-scheme=v1 (no READER_SCHEME_MISMATCH), no
        # writer request is made, and the checkpoint is left exactly as it was.
        accepted = json.loads(fx["checkpoint"])["accepted_lines"]
        for flags in ((), ("--reader-scheme=v1",)):
            ck = work / "ck.json"
            ck.write_text(fx["checkpoint"], encoding="utf-8")
            calls.unlink(missing_ok=True)
            r = run(ck, *flags)
            with self.subTest(flags=flags):
                self.assertEqual(r.returncode, 3, r.stdout[-600:])
                rec = [json.loads(l[len("  lyric result: "):]) for l in r.stdout.splitlines()
                       if l.startswith("  lyric result: ")][-1]
                self.assertEqual(rec["stop_reason"], "QUESTION_CHANGED")
                self.assertIs(rec["new_run_required"], True)
                self.assertIs(rec["resumable"], False)
                self.assertIs(rec["certified"], False)
                self.assertEqual(rec["accepted_lines"], accepted)
                self.assertEqual(rec["final_draft"], accepted)
                self.assertIn("Continue as new work from the accepted draft", r.stdout)
                self.assertFalse(calls.exists(), "a writer request was made")
                self.assertNotIn("READER_SCHEME_MISMATCH", r.stdout)
                self.assertEqual(ck.read_text(encoding="utf-8"), fx["checkpoint"])
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

    def test_a_call_checkpoints_answered_block_replays_on_its_scheme(self):
        # A kitchen checkpoint's `answered` block is a replay file, as a
        # deferred state's is (quality/test_verbs.py, the answered journal
        # replay): under v2 it names its scheme, so saved as a replay file it
        # replays under v2 with no flag and refuses an explicit v1; a
        # pre-batch checkpoint's block carries none and replays as v1 (and
        # refuses an explicit v2).
        fx = json.loads((HERE / "fixtures" / "reader_v1_checkpoint.json").read_text(encoding="utf-8"))
        work = Path(tempfile.mkdtemp())
        self.addCleanup(__import__("shutil").rmtree, work, True)
        (work / "stubwriter.py").write_text(
            "def factory():\n    def call(prompt):\n        return %r\n    return call\n"
            % fx["stub_answer"], encoding="utf-8")
        draft = work / "draft.txt"
        draft.write_text("\n".join(fx["draft"]) + "\n", encoding="utf-8")
        env = {k: v for k, v in os.environ.items()
               if k not in ("LYRIC_CONTROL_TOKEN", "LYRIC_CHECKPOINT_PATH",
                            "LYRIC_REQUEST_DEADLINE_MS")}
        env["PYTHONPATH"] = str(work)

        def run(propose, *flags, checkpoint=None):
            e = dict(env, LYRIC_CHECKPOINT_PATH=str(checkpoint)) if checkpoint else env
            return subprocess.run([sys.executable, str(ROOT / "lyric_harness.py"), *flags,
                                   "revise", str(draft), "AA", propose],
                                  capture_output=True, text=True, env=e, cwd=ROOT, timeout=900)

        def scheme_of(r):
            row = json.loads([l for l in r.stdout.splitlines()
                              if l.startswith("  lyric result: ")][-1][len("  lyric result: "):])
            # Modern replay keeps evidence; legacy replay keeps its frozen shape.
            self.assertEqual("schema_instance_evidence" in row, row["reader_scheme"] == "v2")
            return row["reader_scheme"]
        ck = work / "fresh.json"
        run("--propose=call:stubwriter:factory", checkpoint=ck)
        fresh = json.loads(ck.read_text(encoding="utf-8"))
        self.assertEqual(fresh["reader_scheme"], "v2")
        self.assertTrue(fresh["answered"]["propose"] or fresh["answered"]["propose_group"])
        self.assertEqual(fresh["answered"].get("reader_scheme"), "v2")
        old = json.loads(fx["resumed_checkpoint"])
        self.assertNotIn("reader_scheme", old)
        self.assertNotIn("reader_scheme", old["answered"])
        for name, answered, own, other in (("v2 checkpoint", fresh["answered"], "v2", "v1"),
                                           ("pre-batch checkpoint", old["answered"], "v1", "v2")):
            rep = work / f"replay-{own}.json"
            rep.write_text(json.dumps(answered), encoding="utf-8")
            self.assertEqual(LH._recorded_reader_scheme(["revise", f"--propose=replay:{rep}"]), own)
            with self.subTest(replay=name):
                r = run(f"--propose=replay:{rep}")
                self.assertNotIn("REFUSED", r.stdout, r.stdout[-600:])
                self.assertEqual(scheme_of(r), own)
                r = run(f"--propose=replay:{rep}", f"--reader-scheme={other}")
                self.assertEqual(r.returncode, 2, r.stdout[-600:])
                self.assertIn("READER_SCHEME_MISMATCH", r.stdout)
                self.assertIn(f"--reader-scheme={own}", r.stdout)

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
        # the v2 token with that span, and only there -- or to the token that
        # is that span less an opening quotation mark v2 leaves out of the
        # word (2026-10-16, `pronunciation.declared_spelling`).
        from quality.pronunciation import declared_spelling
        for text in GENERATED[:400]:
            src = LH.reader_token_spans(text, True, "v1") or []
            dst = LH.reader_token_spans(text, True, "v2")
            for k, (word, pieces) in enumerate(src):
                row = dict(line=text, token=k + 1, word=word, phones=["AH1"],
                           basis="declared", source="x")
                less = ((pieces[0][0] + 1, pieces[0][1]),) + tuple(pieces[1:])
                hits = [j for j, (w, p) in enumerate(dst) if p == pieces and w == word
                        or p == less and declared_spelling(word, w, text, p)]
                if len(hits) == 1:
                    self.assertEqual(rebind_occurrences([row], "v1", "v2")[0]["token"], hits[0] + 1)
                else:
                    with self.assertRaises(ValueError):
                        rebind_occurrences([row], "v1", "v2")


class SharedFallback(unittest.TestCase):
    """A phonology with no lexicon of its own reads through the shared one of
    the scheme at the call; its G2P fallback follows that lexicon."""

    def test_a_v1_scope_never_leaves_its_fallback_to_a_v2_read(self):
        # Regression: `meter_bands.measure_line` pins v1; when the v2-keyed
        # shared reader was first used inside it, the reader cached a fallback
        # built on the v1 lexicon and every later v2 read used it.
        from unittest.mock import patch
        import quality.meter_bands as MB
        with patch.object(MB, "_READERS", {}):
            r = MB.reader("fallback-low")
            MB.measure_line("we sing it 4ever and a day", r)
            self.assertEqual(r._fallback().lex.reader_scheme, "v2")
            with LH.reader_scheme_scope("v1"):
                self.assertEqual(r._fallback().lex.reader_scheme, "v1")
            self.assertEqual(r._fallback().lex.reader_scheme, "v2")


_WARM_CHILD = "READER_TEST_WARM_WORKER_CHILD"


class WarmWorker(unittest.TestCase):
    """8a. One warm worker process (`mcp/worker.py`: `run_one` for lyrics,
    `run_reader` for the Library) serves both schemes in either order: each
    request reads under its own scheme, the Library rebinds the v1-bound
    Gutenberg set, and every module-level lexicon cache holds lexicons of the
    scheme it is keyed by.

    TEST-PROCESS ISOLATION, NOT A CAPACITY BOUND. Each complete sequential
    scenario runs whole inside one child process of its own
    (`WarmWorkerBody`), as one worker would serve it: a new lyrics request
    then a legacy one then a Library analysis; a legacy lyrics request then
    a Library analysis; a new lyrics request then a Library analysis; and,
    COLD, a legacy lyrics request then a new one, a Library analysis then a
    new lyrics request, and a Library analysis then a legacy one. The Library
    reader guards its resident memory against the deployment envelope
    (`library.analysis._resource_guard`, 1 GiB by default), and inside this
    whole suite's process the other classes' corpora already hold more than
    that, so the guard would refuse for memory the worker never holds. The
    envelope is NOT raised: each child asserts the guard is active at the
    unchanged 1 GiB and that the Library analysis passed through it, and
    reports its peak resident memory (VmHWM); this parent then ASSERTS that
    peak is below that same unchanged 1 GiB envelope (no new threshold) and
    prints it. A pass here says these scenarios fit the envelope in a fresh
    process; it is not a bound on a long-lived worker's memory (measured
    separately: `quality/results/warm_worker_rss_2026-10-13/`). What
    `_caches_hold_their_schemes` checks is SCHEME OWNERSHIP, not a count:
    every lexicon cache entry that exists holds lexicons of the scheme it is
    keyed by, and no cache is keyed by a scheme outside the two. A cache's
    key has other dimensions too (fallback policy, supplement version, aside
    rule), so one cache can hold several entries per scheme -- BB8 counted 4
    entries in `fit._LEX` and 3 in the supplemented-lexicon cache after real
    requests (#527, 6955e342 findings) -- and nothing here bounds that
    number or the worker's memory.

    COLD FIRST USE (BB8 #519 6161601064 F9). Between requests a child only
    READS the caches (`_caches_hold_their_schemes`: every entry present holds
    lexicons of the scheme it is keyed by, and no cache is keyed by a scheme
    beyond the two); it never builds one. So the first request under the other
    scheme builds that scheme's lexicons itself, inside a real request -- the
    path the meter_bands regression took -- instead of finding them primed by
    the check. Only after a scenario's LAST request does `_caches_agree`
    (which builds both schemes' lexicons to compare them) run."""

    def _child(self, name):
        env = {**os.environ, _WARM_CHILD: "1"}
        r = subprocess.run([sys.executable, "-m", "unittest", "-v",
                            f"quality.test_reader.WarmWorkerBody.{name}"],
                           cwd=ROOT, env=env, capture_output=True, text=True, timeout=1800)
        self.assertEqual(r.returncode, 0, r.stdout[-2000:] + r.stderr[-4000:])
        # It ran: a skip ("OK (skipped=1)") is not a pass.
        self.assertTrue("Ran 1 test" in r.stderr and r.stderr.rstrip().endswith("\nOK"),
                        r.stderr[-2000:])
        peak = re.findall(r"^WARM_WORKER_PEAK_RSS (\{.*\})$", r.stdout, re.M)
        self.assertEqual(len(peak), 1, r.stdout[-2000:])
        rec = json.loads(peak[0])
        self.assertEqual((rec["scenario"], rec["guard_envelope_bytes"]), (name, 1 << 30))
        # A scenario with a Library analysis passed it through the guard.
        if rec["library_analyses"]:
            self.assertGreater(rec["guard_calls"], 0)
        self.assert_within_guard(rec)
        print(f"\n    [test-process isolation] {name}: child peak RSS (VmHWM) "
              f"{rec['peak_rss_bytes']:,} bytes ({rec['peak_rss_bytes'] / 2**20:.0f} MiB) "
              f"against the unchanged {rec['guard_envelope_bytes'] / 2**20:.0f} MiB guard; "
              f"guard checks passed {rec['guard_calls']}; {rec['python']}",
              file=sys.stderr, flush=True)

    def assert_within_guard(self, rec):
        """The child's peak resident memory is below the Library guard's
        UNCHANGED envelope (1 GiB, the value the child asserted it ran under);
        not a new threshold."""
        self.assertEqual(rec["guard_envelope_bytes"], 1 << 30)
        self.assertLess(rec["peak_rss_bytes"], rec["guard_envelope_bytes"],
                        f"{rec['scenario']}: child peak RSS {rec['peak_rss_bytes']:,} bytes is not "
                        f"below the unchanged {rec['guard_envelope_bytes']:,}-byte guard")

    def test_the_peak_assertion_refuses_a_peak_at_the_guard(self):
        """`assert_within_guard` fails a child whose peak reaches the guard."""
        rec = {"scenario": "x", "guard_envelope_bytes": 1 << 30, "peak_rss_bytes": 1 << 30}
        with self.assertRaises(AssertionError):
            self.assert_within_guard(rec)
        self.assert_within_guard({**rec, "peak_rss_bytes": (1 << 30) - 1})

    def test_a_legacy_lyrics_request_then_a_library_analysis(self):
        self._child("test_a_legacy_lyrics_request_then_a_library_analysis")

    def test_cold_a_legacy_lyrics_request_then_a_new_one(self):
        self._child("test_cold_a_legacy_lyrics_request_then_a_new_one")

    def test_cold_a_library_analysis_then_a_new_lyrics_request(self):
        self._child("test_cold_a_library_analysis_then_a_new_lyrics_request")

    def test_cold_a_library_analysis_then_a_legacy_lyrics_request(self):
        self._child("test_cold_a_library_analysis_then_a_legacy_lyrics_request")

    def test_a_new_lyrics_request_then_a_legacy_one(self):
        self._child("test_a_new_lyrics_request_then_a_legacy_one")

    def test_a_new_lyrics_request_then_a_library_analysis(self):
        self._child("test_a_new_lyrics_request_then_a_library_analysis")


@unittest.skipUnless(os.environ.get(_WARM_CHILD) == "1",
                     "run in a process of its own by WarmWorker")
class WarmWorkerBody(unittest.TestCase):
    """The `WarmWorker` scenarios, each run by it in a fresh process."""

    @classmethod
    def setUpClass(cls):
        import importlib.util
        import library.analysis as LA
        # The Library guard is active, at the unchanged default envelope, and
        # can read this process's resident memory. Never raised here: an
        # environment that sets another envelope fails this assertion by name.
        envelope = int(os.environ.get("LIBRARY_READER_MAX_RSS_MIB", "1024")) * 1024 * 1024
        assert envelope == 1 << 30, f"LIBRARY_READER_MAX_RSS_MIB moves the guard: {envelope}"
        assert LA._reader_rss_bytes() is not None, "the guard cannot read resident memory"
        cls.guard_calls = [0]
        real_guard = LA._resource_guard

        def counted(phase, extra_bytes=0):
            cls.guard_calls[0] += 1
            return real_guard(phase, extra_bytes)
        cls._real_guard = real_guard
        LA._resource_guard = counted
        cwd = os.getcwd()
        spec = importlib.util.spec_from_file_location(
            "lyric_worker_under_test", ROOT.parent / "mcp" / "worker.py")
        cls.W = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.W)          # chdirs to lyric-harness
        os.chdir(cwd)
        cls.fx = json.loads((HERE / "fixtures" / "reader_v1_defer_states.json")
                            .read_text(encoding="utf-8"))
        batch = ROOT / "imports" / "gutenberg-next-ten" / "pronunciations" / "69378.json"
        payloads = json.loads(batch.read_text(encoding="utf-8"))
        cls.rows = next(p["pronunciations"] for p in payloads.values()
                        if any(r["line"].startswith("U--h") for r in p["pronunciations"]))

    @classmethod
    def tearDownClass(cls):
        import library.analysis as LA
        LA._resource_guard = cls._real_guard

    def _report(self):
        """Print this child's peak resident memory for `WarmWorker`."""
        import platform
        peak = None
        for row in Path("/proc/self/status").read_text().splitlines():
            if row.startswith("VmHWM:"):
                peak = int(row.split()[1]) * 1024
        if peak is None:
            import resource
            peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024
        print("WARM_WORKER_PEAK_RSS " + json.dumps({
            "scenario": self._testMethodName, "peak_rss_bytes": peak,
            "guard_envelope_bytes": int(os.environ.get("LIBRARY_READER_MAX_RSS_MIB",
                                                       "1024")) * 1024 * 1024,
            "guard_calls": self.guard_calls[0],
            "library_analyses": getattr(self, "analyses", 0),
            "python": f"{platform.python_implementation()} {platform.python_version()}"}),
            flush=True)

    def _lyrics(self, state_text):
        """-> the `lyric result` of one revise request through `run_one`,
        resuming `state_text` (None: a new run)."""
        work = Path(tempfile.mkdtemp())
        self.addCleanup(__import__("shutil").rmtree, work, True)
        (work / "draft.txt").write_text("\n".join(self.fx["draft"]) + "\n", encoding="utf-8")
        if state_text is not None:
            (work / "state.json").write_text(state_text, encoding="utf-8")
        argv = [a.replace("<WORK>", str(work)) for a in self.fx["verb"]]
        code, out, _ = self.W.run_one(argv)
        self.assertEqual(code, 4, out[-600:])
        line = next(l for l in out.splitlines() if l.startswith("  lyric result: "))
        written = json.loads((work / "state.json").read_text(encoding="utf-8"))
        return json.loads(line[len("  lyric result: "):]), written

    def _library(self):
        """-> (result, rows the analysis bound) of one Library request
        through `run_reader`, acknowledging every checkpoint."""
        import io
        from unittest.mock import patch
        import library.analysis as LA
        made = []

        class Recording(LA.AnalysisSession):
            def __init__(self, *a, **kw):
                super().__init__(*a, **kw)
                made.append(self)
        lines = list(dict.fromkeys(r["line"] for r in self.rows))
        payload = {"source": {"reading_unit_id": "caller-owned-fixture:eng",
                              "reading_revision": "fixture-v1", "language": "eng",
                              "text": "\n".join(lines)},
                   "declarations": {"pronunciations": self.rows}, "requested": ["sound"]}
        ack = json.dumps({"id": "r", "event": "reader_ack", "continue": True}) + "\n"
        saved = sys.stdin, sys.stdout
        sys.stdin, sys.stdout = io.StringIO(ack * 5000), io.StringIO()
        try:
            with patch.object(LA, "AnalysisSession", Recording):
                result = self.W.run_reader(payload, "r")
        finally:
            sys.stdin, sys.stdout = saved
        self.assertEqual(result["status"], "complete")
        return made[0].phon.lexicon.pronunciations

    def _caches_agree(self):
        import quality.fit as FT
        import quality.lexicon_supplement as LS
        from quality.phonology import eng
        from quality.phonology import get as phonology
        self.assertEqual(LH.resolve_reader_scheme(None), "v2")
        self.assertFalse(LH._READER_SCHEME_DECLARED)
        for scheme, lex in eng._LEX.items():
            self.assertEqual(lex.reader_scheme, scheme)
        for key, lex in FT._LEX.items():
            if len(key) == 3:
                self.assertEqual(lex.reader_scheme, key[2])
        for key, lex in LS._SUPPLEMENTED.items():
            self.assertEqual(lex.reader_scheme, key[-1])
        for (scheme, aside), lex in eng._CUT_LEX.items():
            self.assertEqual((lex.reader_scheme, lex.strip_parens), (scheme, aside))
        import quality.meter_bands as MB
        for (mode, scheme), ph in MB._READERS.items():
            with LH.reader_scheme_scope(scheme):
                self.assertIs(MB.reader(mode), ph)
                fb = ph._fallback()
                self.assertEqual(fb.lex.reader_scheme, scheme, (mode, scheme))
        for scheme in LH.READER_SCHEMES:
            with LH.reader_scheme_scope(scheme):
                self.assertEqual(MB.reader(MB.ADOPTED_READER)._fallback().lex.reader_scheme,
                                 scheme)
        for scheme in LH.READER_SCHEMES:
            self.assertEqual(FT._english_lexicon(True, None, scheme).reader_scheme, scheme)
            with LH.reader_scheme_scope(scheme):
                self.assertEqual(eng._lexicon().reader_scheme, scheme)
                self.assertEqual(phonology("eng").reader_scheme, scheme)
        self.assertEqual(eng._lexicon().reader_scheme, "v2")

    def _caches_hold_their_schemes(self):
        """READ-ONLY: every lexicon cache entry that exists holds lexicons of
        the scheme it is keyed by, and no cache is keyed by a scheme beyond
        the two. Ownership only: it does not count entries (a key's other
        dimensions -- fallback, supplement version, aside rule -- can give a
        cache several entries per scheme).
        Builds nothing (no `eng._lexicon()`, `MB.reader`, `phonology` or
        `_fallback()` call), so the next request meets the caches exactly as
        the last one left them."""
        import quality.fit as FT
        import quality.lexicon_supplement as LS
        import quality.meter_bands as MB
        from quality.phonology import eng
        schemes = set(LH.READER_SCHEMES)
        self.assertEqual(LH.resolve_reader_scheme(None), "v2")
        self.assertFalse(LH._READER_SCHEME_DECLARED)
        self.assertLessEqual(set(eng._LEX), schemes)
        for scheme, lex in eng._LEX.items():
            self.assertEqual(lex.reader_scheme, scheme)
        for key, lex in FT._LEX.items():
            if len(key) == 3:
                self.assertIn(key[2], schemes)
                self.assertEqual(lex.reader_scheme, key[2])
        for key, lex in LS._SUPPLEMENTED.items():
            self.assertIn(key[-1], schemes)
            self.assertEqual(lex.reader_scheme, key[-1])
        for (scheme, aside), lex in eng._CUT_LEX.items():
            self.assertEqual((lex.reader_scheme, lex.strip_parens), (scheme, aside))
        for (mode, scheme), ph in MB._READERS.items():
            self.assertIn(scheme, schemes)
            fb = getattr(ph, "_fb", None)
            if fb is not None:
                # A fallback built so far reads through the lexicon it was
                # built on, never the other scheme's.
                built_on = getattr(fb[1], "lex", None)
                base = fb[0].cmu_lexicon() if hasattr(fb[0], "cmu_lexicon") else fb[0]
                self.assertEqual(built_on.reader_scheme, fb[0].reader_scheme, (mode, scheme))
                self.assertEqual(base.reader_scheme, fb[0].reader_scheme, (mode, scheme))

    def _rebound(self, bound):
        from quality.pronunciation import rebind_occurrences
        want = rebind_occurrences(self.rows, "v1", "v2", strip_parens=False)
        self.assertEqual([b["token"] for b in bound], [w["token"] for w in want])
        return sum(b["token"] != r["token"] for b, r in zip(bound, self.rows))

    def _analysed(self):
        """One Library analysis, through the guard: it rebinds and the guard
        was consulted (it is active, not bypassed)."""
        before = self.guard_calls[0]
        self.analyses = getattr(self, "analyses", 0) + 1
        moved = self._rebound(self._library())
        self.assertGreater(self.guard_calls[0], before)
        return moved

    def test_a_legacy_lyrics_request_then_a_library_analysis(self):
        legacy = self.fx["states"][0]["state"]
        rec, written = self._lyrics(legacy)
        self.assertEqual((rec["reader_scheme"], written["reader_scheme"]), ("v1", "v1"))
        self._caches_hold_their_schemes()
        moved = self._analysed()
        self.assertGreater(moved, 0)
        self._caches_hold_their_schemes()
        self._caches_agree()
        self._report()

    def test_a_new_lyrics_request_then_a_legacy_one(self):
        rec, written = self._lyrics(None)
        self.assertEqual((rec["reader_scheme"], written["reader_scheme"]), ("v2", "v2"))
        self._caches_hold_their_schemes()
        rec, written = self._lyrics(self.fx["states"][1]["state"])
        self.assertEqual((rec["reader_scheme"], written["reader_scheme"]), ("v1", "v1"))
        self._caches_hold_their_schemes()
        self.assertGreater(self._analysed(), 0)
        self._caches_hold_their_schemes()
        self._caches_agree()
        self._report()

    def test_a_new_lyrics_request_then_a_library_analysis(self):
        rec, written = self._lyrics(None)
        self.assertEqual((rec["reader_scheme"], written["reader_scheme"]), ("v2", "v2"))
        self._caches_hold_their_schemes()
        self.assertGreater(self._analysed(), 0)
        self._caches_hold_their_schemes()
        self._caches_agree()
        self._report()

    def _cold(self, scheme):
        """No lexicon of `scheme` is cached yet: its first use comes next."""
        from quality.phonology import eng
        self.assertNotIn(scheme, eng._LEX, f"{scheme} was primed before its first request")

    def test_cold_a_legacy_lyrics_request_then_a_new_one(self):
        rec, written = self._lyrics(self.fx["states"][0]["state"])
        self.assertEqual((rec["reader_scheme"], written["reader_scheme"]), ("v1", "v1"))
        self._caches_hold_their_schemes()
        self._cold("v2")
        rec, written = self._lyrics(None)
        self.assertEqual((rec["reader_scheme"], written["reader_scheme"]), ("v2", "v2"))
        self._caches_hold_their_schemes()
        self._caches_agree()
        self._report()

    def test_cold_a_library_analysis_then_a_new_lyrics_request(self):
        self.assertGreater(self._analysed(), 0)
        self._caches_hold_their_schemes()
        rec, written = self._lyrics(None)
        self.assertEqual((rec["reader_scheme"], written["reader_scheme"]), ("v2", "v2"))
        self._caches_hold_their_schemes()
        self._caches_agree()
        self._report()

    def test_cold_a_library_analysis_then_a_legacy_lyrics_request(self):
        self.assertGreater(self._analysed(), 0)
        self._caches_hold_their_schemes()
        rec, written = self._lyrics(self.fx["states"][1]["state"])
        self.assertEqual((rec["reader_scheme"], written["reader_scheme"]), ("v1", "v1"))
        self._caches_hold_their_schemes()
        self._caches_agree()
        self._report()


class NamedPlaceLookup(unittest.TestCase):
    """11. Identical cut, different END binding (BB8 #519 6161601064, A.2).

    The cause, with the harness's own functions: under v1 `line_anchors`
    re-cuts the words before the last from their space-joined text, which
    joins an enclitic the printed line sets apart (`knap, 's` -> `knap's`,
    `M.P.'s` -> `P's`); v2 reads each token at its own position. The page's
    named-place notice fires on exactly that condition
    (`lyLineCutChanged`, `CMLyricTokens.v1GraderLookup`); the population
    receipt is `quality/results/named_place_lookup_2026-10-14/`."""

    RECEIPT = HERE / "results" / "named_place_lookup_2026-10-14" / "result.json"

    @classmethod
    def setUpClass(cls):
        from quality.phonology import eng
        cls.r = json.loads(cls.RECEIPT.read_text(encoding="utf-8"))
        cls.lex = {}
        for scheme in LH.READER_SCHEMES:
            with LH.reader_scheme_scope(scheme):
                cls.lex[scheme] = eng._lexicon()

    def end(self, scheme, line):
        with LH.reader_scheme_scope(scheme):
            anchors, label, _ = LH.line_anchors(self.lex[scheme], line)
        return ([[(s["nucleus"], tuple(s["coda"]), tuple(s["onset"]), s["stress"]) for s in a]
                 for a in anchors], label)

    def cut(self, line):
        old = LH._v1_token_spans(line, True)
        cur = [(t.text, tuple(tuple(p) for p in t.pieces))
               for t in LH.reader_line(line, True, scheme="v2").tokens]
        return old, cur

    def lookup_differs(self, line):
        words = LH._line_tokens_v1(line, True)
        return (LH._line_tokens_v1(" ".join(words[:-1]), True) + words[-1:]) != words

    def test_the_six_and_their_cause(self):
        named = ["Below the knap, 's a runnèn still;", "When in that house M.P.'s divide,",
                 "\u201cAlso, some few I. O. U.\u2019s and bets,\u201d"]
        changed = [x for x in self.r["end_changed"] if x["latin"]]
        self.assertTrue(set(named) <= {x["line"] for x in changed})
        for x in changed:
            line = x["line"]
            old, cur = self.cut(line)
            self.assertEqual([(t, tuple(map(tuple, p))) for t, p in old], cur, line)
            self.assertTrue(self.lookup_differs(line), line)
            self.assertNotEqual(self.end("v1", line), self.end("v2", line), line)
        # The cause, named: v1 looked the enclitic up joined to the word before.
        with LH.reader_scheme_scope("v1"):
            _, words, oov = self.lex["v1"].transcribe("Below the knap 's a runnèn",
                                                      phrase_final=False)
        self.assertIn("knap's", words)

    def test_the_condition_is_broader_than_the_end_and_says_so(self):
        """The receipt's lookup lines whose end did not move keep their end:
        the condition is about the lines read, not a list of six."""
        quiet = [x["line"] for x in self.r["lookup_differs"] if not x["end_changed"]]
        self.assertEqual(len(quiet), len(self.r["lookup_differs"]) - len(
            [x for x in self.r["end_changed"] if x["lookup_differs"]]))
        for line in quiet:
            self.assertTrue(self.lookup_differs(line), line)
            self.assertEqual(self.end("v1", line), self.end("v2", line), line)

    def test_identical_cut_controls_do_not_fire(self):
        for line in ["we sing it plain tonight", "You are the one I dream of",
                     "It's the cat's own hat", "the bird 's song"]:
            old, cur = self.cut(line)
            self.assertEqual([(t, tuple(map(tuple, p))) for t, p in old], cur, line)
            self.assertFalse(self.lookup_differs(line), line)


class MirrorFixture(unittest.TestCase):
    """10. The website mirror's agreement fixture is what the reader returns."""

    def test_mirror_fixture_is_fresh(self):
        path = ROOT / RC.MIRROR_FIXTURE
        want = json.dumps(RC.mirror_fixture(), ensure_ascii=False, separators=(",", ":")) + "\n"
        self.assertTrue(path.read_text(encoding="utf-8") == want,
                        "rebuild: python3 quality/reader_cases.py --write")


if __name__ == "__main__":
    unittest.main()

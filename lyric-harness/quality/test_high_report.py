"""Public regressions for the report's remaining high-severity defects."""
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def run_cli(*args):
    result = subprocess.run([sys.executable, str(ROOT / "lyric_harness.py"), *map(str, args)],
                            cwd=ROOT, capture_output=True, text=True, timeout=90)
    records = [json.loads(line.split("lyric result: ", 1)[1])
               for line in result.stdout.splitlines() if "lyric result: " in line]
    return result, records


class HighReportTests(unittest.TestCase):
    def test_connector_line_admission_matches_current_planner(self):
        from quality.plan import ENVELOPE
        source = (ROOT.parent / "mcp/lyric_tools.js").read_text()
        self.assertEqual(int(re.search(r"const MAX_LINES = (\d+)", source)[1]),
                         ENVELOPE["total_lines"][1])

    def test_space_form_declarations_have_the_same_public_result(self):
        cases = [
            ("types", "cat", "--", "hat", "--lang", "eng"),
            ("cynghanedd", "the cat sat", "--lang", "eng"),
            ("brief", "quality/fixtures/song.txt", "--groups=1,2", "--blueprint", "/missing-blueprint.json"),
            ("finish", "quality/fixtures/song.txt", "--seed=21", "--relation", "not-a-relation"),
        ]
        for args in cases:
            with self.subTest(args=args):
                spaced, _ = run_cli(*args)
                joined, _ = run_cli(*args[:-2], args[-2] + "=" + args[-1])
                self.assertEqual((spaced.returncode, spaced.stdout, spaced.stderr),
                                 (joined.returncode, joined.stdout, joined.stderr))
        result, _ = run_cli("types", "cat", "--", "hat", "--lang")
        self.assertEqual(result.returncode, 2)
        self.assertIn("requires a value", result.stdout)

    def test_types_honors_fallback(self):
        plain, _ = run_cli("types", "viewest", "--", "renewest")
        derived, _ = run_cli("types", "viewest", "--", "renewest", "--fallback=high")
        self.assertIn("UNREADABLE", plain.stdout)
        self.assertNotIn("UNREADABLE", derived.stdout)
        self.assertIn("agreement", derived.stdout)

    def test_g_dropping_preserves_explicit_elision_and_bare_ambiguity(self):
        from lyric_harness import Lexicon
        from quality.phonology.eng import English
        lex = Lexicon()
        for word in ("goin", "makin", "lovin", "rollin", "fallin", "talkin", "nothin"):
            expected = lex.entries[word + "g"][0][:-1] + ["N"]
            self.assertEqual(lex.transcribe_word(word + "'")[0], expected)
            self.assertEqual(lex.transcribe_word(word + "’")[0], expected)
            self.assertIn(expected, lex.pronunciation_variants(word))
            self.assertNotEqual(English(lexicon=lex).reading_status(word)[0], "certain")
        self.assertEqual(lex.transcribe_word("tin")[0], lex.entries["tin"][0])

    def test_welsh_attested_glides_and_vocalic_controls(self):
        from quality.phonology.cym import Welsh
        phon = Welsh()
        # Welsh Academy Dictionary, Orthography and Pronunciation, and
        # Morris-Jones §26: attested controls, not values copied from code.
        for word in ("gwlad", "gwraig", "gwneud", "iaith", "iawn", "gwan"):
            self.assertEqual(len(phon.syllabify(word)), 1, word)
        for word, count in (("galwad", 2), ("dianc", 2), ("cwm", 1), ("gŵn", 1)):
            self.assertEqual(len(phon.syllabify(word)), count, word)

    def test_missing_runtime_lexicon_refuses_without_network(self):
        script = '''
import sys
from unittest.mock import patch
import lyric_harness as lh
sys.argv = ["lyric_harness.py", "scheme", "AA", "cat", "dog"]
with patch.object(lh, "CMUDICT_PATH", "/missing-cmudict.dict"), patch.object(lh, "download_to", side_effect=AssertionError("runtime downloaded")):
    lh.cli()
'''
        result = subprocess.run([sys.executable, "-c", script], cwd=ROOT,
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn("LEXICAL_ASSET_MISSING", result.stdout)
        self.assertNotIn("Traceback", result.stderr)

    def test_source_duplicates_refuse_and_unique_order_does_not_matter(self):
        import csv
        from quality.provenance import load_sources
        from quality.audit_corpus import Sources
        source = ROOT / "data/sources.tsv"
        with source.open() as stream:
            rows = list(csv.DictReader(stream, delimiter="\t"))
        self.assertEqual(len(rows), len({r["source_id"] for r in rows}))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sources.tsv"
            def write(items):
                with path.open("w") as out:
                    writer = csv.DictWriter(out, fieldnames=rows[0], delimiter="\t")
                    writer.writeheader()
                    writer.writerows(items)
            write(list(reversed(rows)))
            self.assertEqual(load_sources(source), load_sources(path))
            conflicting = dict(rows[0], pd_affirmed="true" if rows[0]["pd_affirmed"] != "true" else "false")
            write([rows[0], conflicting])
            for loader in (load_sources, Sources):
                with self.assertRaisesRegex(ValueError, "DUPLICATE_SOURCE_ID"):
                    loader(path)

    def test_literal_draft_keeps_apparatus_shaped_lyrics_and_coordinates(self):
        from lyric_harness import load_draft_lines, load_lyric_lines
        for first in ("#1 with a bullet and a song", "[Chorus] we sing along",
                      "--- and the morning too"):
            lines = [first, "The day is long", "We sing along", "The night is gray"]
            with self.subTest(first=first), tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / "draft.txt"
                path.write_text("\n".join(lines) + "\n")
                self.assertEqual(load_draft_lines(path), lines)
                self.assertEqual(load_lyric_lines(path), lines[1:])
                result, records = run_cli("brief", path, "--groups=1,4", "--relation=class:ASSONANCE")
                self.assertNotIn("outside 1..3", result.stdout)
                self.assertTrue(records, result.stdout + result.stderr)
                self.assertEqual(records[-1]["final_draft"], lines)

    def test_source_format_requires_an_explicit_declaration(self):
        from lyric_harness import load_draft_lines
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "source.txt"
            path.write_text("# author: Example\n[VERSE]\nThe day is long\nWe sing along\n")
            self.assertEqual(len(load_draft_lines(path)), 4)
            self.assertEqual(load_draft_lines(path, input_format="source"),
                             ["The day is long", "We sing along"])

    def test_requested_function_refusals_reach_coverage(self):
        from quality.revise import Reviser
        bp = json.loads((ROOT / "quality/fixtures/function_fixture.blueprint.json").read_text())
        bp.pop("hooks", None)
        bp["lines"] = [{"text": "", "bar": section["start_bar"], "beat": 1,
                        "duration": 4, "section": section["name"]}
                       for section in bp["sections"]]
        lines = ["The farmer carries apples through the open gate" for _ in bp["lines"]]
        coverage = []
        findings = Reviser()._function_findings(lines, bp, coverage_out=coverage)
        self.assertIn("HOOK_UNDECLARED", [f.code for f in findings])
        self.assertEqual(next(r["status"] for r in coverage if r["id"] == "function:draft"), "refused")
        self.assertTrue(any(r.get("code") == "HOOK_UNDECLARED" for r in coverage))
        self.assertEqual(next(r["status"] for r in coverage if r["id"] == "shape:draft"), "answered")
        with tempfile.TemporaryDirectory() as tmp:
            blueprint, draft = Path(tmp) / "blueprint.json", Path(tmp) / "draft.txt"
            blueprint.write_text(json.dumps(bp))
            draft.write_text("\n".join(lines))
            result, records = run_cli("song", blueprint, draft, "--groups=1,2",
                                      "--relation=class:ASSONANCE", "--isochronous", "--subdivision=4")
            self.assertTrue(records, result.stdout + result.stderr)
            self.assertFalse(records[-1]["coverage"]["certified"])
            self.assertIn("function:draft", records[-1]["coverage"]["refused_obligations"])
            self.assertNotEqual(result.returncode, 0)

    def test_bad_interview_answer_can_be_corrected_on_the_same_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            draft, state = Path(tmp) / "draft.txt", Path(tmp) / "state.json"
            draft.write_text("Copper cat\nAzure dog\n")
            args = ("revise", draft, "AA", "--relation=type:rime riche",
                    f"--propose=defer:{state}", "--max-rounds=1", "--backtrack=0")
            result, records = run_cli(*args)
            self.assertEqual(result.returncode, 4, result.stdout + result.stderr)
            original = json.loads(state.read_text())
            for bad in (["not a line"], "x" * 260, "x" * (512 * 1024)):
                current = json.loads(json.dumps(original))
                current["pending"]["answer"] = bad
                state.write_text(json.dumps(current))
                before = state.read_bytes()
                result, records = run_cli(*args)
                self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
                self.assertIn("INVALID_INTERVIEW_ANSWER", result.stdout)
                self.assertEqual(state.read_bytes(), before)
            original["pending"]["answer"] = "I left the basket underneath the oak"
            state.write_text(json.dumps(original))
            result, records = run_cli(*args)
            self.assertNotIn("JOURNAL_CAPACITY", result.stdout)
            self.assertNotIn("INVALID_INTERVIEW_ANSWER", result.stdout)
            self.assertIn(result.returncode, (0, 2, 3, 4), result.stderr)
            self.assertFalse(json.loads(state.read_text()).get("new_run_required"))

    def test_placed_returns_use_word_identity_in_public_grade(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "draft.txt"
            lines = ["The basket rests beside the open gate",
                     "A farmer waits beneath the fading light",
                     "The children bring their apples home at night"]
            for opening, broken in (("The", False), ("Some", True)):
                lines[2] = opening + " children bring their apples home at night"
                path.write_text("\n".join(lines))
                result, records = run_cli("brief", path, "--groups=1,2",
                                          "--relation=class:ASSONANCE", "--returns=1.head,3.head")
                self.assertTrue(records, result.stdout + result.stderr)
                flags = [f for f in records[-1]["findings"] if f["code"] == "RETURN_NOT_VERBATIM"]
                self.assertEqual(bool(flags), broken, result.stdout)


if __name__ == "__main__":
    unittest.main()

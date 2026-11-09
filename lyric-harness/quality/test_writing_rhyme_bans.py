#!/usr/bin/env python3
"""Writing policy rejects the two rhyme-ban tiers without changing readers.

Run: python3 quality/test_writing_rhyme_bans.py

The pair fixtures are existing measured controls from test_homeoteleuton.py
and test_screen.py. No corpus, comparator, ranked word menu or model is changed.
Only unrelated floor findings are silenced in the focused Python tests; the
actual pair judge, earned ban, inspection, brief, verification and loop run.
"""

from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import lyric_harness as LH
from quality import floor as FL
from quality import frequency as FREQ
from quality.loop import revise_loop, _cursor_key, _VerdictCache
from quality.revise import Reviser, ReviseDeclaration
from quality.schemes import mandate

BAN_CODES = frozenset({"HOMEOTELEUTON", "MODAL_RHYME"})
SAME = ["The harbour closes for the night", "A window holds the last of light"]
MODAL = ["We bend our will and then obey", "And watch the silent night away"]
CLEAN = ["Your laugh still shakes me to the bone", "The fields your steady hands have sown"]
OTHER_SAME = ["Cold morning light across your silver hair", "I first pulled up that chair"]


def bans(found):
    return [f for fs in found["per_line"].values() for f in fs
            if f.code in BAN_CODES]


def pair_mandate(n=2):
    return mandate([[i, i + 1] for i in range(1, n + 1, 2)], n_lines=n,
                   default_relation="class:RHYME")


class WritingRhymeBanTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reader = Reviser()
        cls.writer = Reviser(lex=cls.reader.lex, writing=True)
        cls.m = pair_mandate()

    def setUp(self):
        # Isolate this policy, not the measured orthography/modal detector.
        # Other floor flags must not supply a spurious rejection or repair.
        self.floor_check = patch.object(FL.SlopFloor, "check", return_value=[])
        self.floor_check.start()
        self.addCleanup(self.floor_check.stop)

    def test_same_draft_is_readable_but_blocked_for_writing(self):
        read = self.reader.inspect(SAME, self.m)
        write = self.writer.inspect(SAME, self.m)
        self.assertEqual(read["grade"], write["grade"])
        self.assertEqual(read["grade"]["pairs_judged"], 1)
        self.assertFalse(read["grade"]["violations"])
        self.assertFalse(bans(read))
        self.assertEqual({f.code for f in bans(write)}, {"HOMEOTELEUTON"})
        self.assertTrue(all(f.severity == "flag" for f in bans(write)))
        self.assertTrue(all(f.groups == ("A",) for f in bans(write)))
        # Capacity/read callers keep the existing note-returning detector.
        note = self.reader.earned_pair_ban(read["grade"]["verdicts"][0])
        self.assertEqual((note.code, note.severity), ("HOMEOTELEUTON", "note"))
        self.assertEqual(self.writer.earned_pair_ban(write["grade"]["verdicts"][0]),
                         note)

    def test_differently_spelled_modal_pair_has_real_evidence(self):
        self.assertNotEqual(self.writer._spelled_rime("obey"),
                            self.writer._spelled_rime("away"))
        observed = [FREQ.LAYER.conditional("eng-song", call,
                    scoring=FREQ.UNSEEN).get(partner, 0)
                    for call, partner in (("obey", "away"), ("away", "obey"))]
        self.assertGreater(max(observed), 0)
        read = self.reader.inspect(MODAL, self.m)
        write = self.writer.inspect(MODAL, self.m)
        self.assertFalse(bans(read))
        self.assertFalse(write["grade"]["violations"])
        findings = bans(write)
        self.assertEqual({f.code for f in findings}, {"MODAL_RHYME"})
        self.assertTrue(all(f.severity == "flag" for f in findings))
        counts = [int(n) for f in findings for n in re.findall(
            r"realised as its rhyme partner (\d+) time", f.evidence)]
        self.assertTrue(counts)
        self.assertTrue(all(n > 0 for n in counts))

    def test_shared_spelling_on_consonance_only_is_not_a_rhyme_ban(self):
        # have/save share -ave but their stressed vowels differ. A declared
        # consonance is satisfied without pretending this is an actual rhyme.
        lines = ["The things we have", "The things we save"]
        m = mandate("AA", n_lines=2, default_relation="class:CONSONANCE")
        found = self.writer.inspect(lines, m)
        self.assertFalse(found["grade"]["violations"])
        verdict, = found["grade"]["verdicts"]
        self.assertIn("CONSONANCE", verdict["relations"])
        self.assertFalse(set(verdict["relations"]) & {
            "RHYME", "RIME_RICHE", "PROMOTED_RHYME"})
        self.assertEqual(self.writer._spelled_rime("have"),
                         self.writer._spelled_rime("save"))
        self.assertFalse(bans(found))

    def test_non_rhyme_and_declared_return_are_not_spurious_bans(self):
        failed = self.writer.inspect([SAME[0], CLEAN[0]], self.m)
        self.assertTrue(failed["grade"]["violations"])
        self.assertFalse(bans(failed))
        repeated = [SAME[0], SAME[0]]
        m = mandate("AA", n_lines=2, returns=[[1, 2]],
                    default_relation="class:RHYME")
        found = self.writer.inspect(repeated, m)
        self.assertFalse(found["grade"]["violations"])
        self.assertTrue(found["grade"]["repeats"])
        self.assertFalse(bans(found))

    def test_replacing_banned_words_on_same_lines_is_a_new_ban(self):
        permissive = Reviser(lex=self.reader.lex, writing=True,
                             rdecl=ReviseDeclaration(allow_net_new=100))
        result = permissive.verify(SAME, OTHER_SAME, self.m, targeted={1, 2})
        self.assertFalse(result["accepted"], result["reasons"])
        old = [f for f in result["fixed_findings"] if f["code"] in BAN_CODES]
        new = [f for f in result["new_findings"] if f["code"] in BAN_CODES]
        self.assertTrue(old)
        self.assertTrue(new)
        self.assertEqual({tuple(f["locations"]) for f in old}, {(1, 2)})
        self.assertEqual({tuple(f["locations"]) for f in new}, {(1, 2)})
        self.assertNotEqual({tuple(f["subject"]) for f in old},
                            {tuple(f["subject"]) for f in new})

    def test_fixing_one_ban_cannot_introduce_another_elsewhere(self):
        r = Reviser(lex=self.reader.lex, writing=True,
                    rdecl=ReviseDeclaration(allow_net_new=100))
        before, after = SAME + CLEAN, CLEAN + MODAL
        result = r.verify(before, after, pair_mandate(4), targeted={1, 2, 3, 4})
        self.assertTrue(any(f["code"] == "HOMEOTELEUTON"
                            for f in result["fixed_findings"]))
        self.assertTrue(any(f["code"] == "MODAL_RHYME"
                            and f["locations"] == [3, 4]
                            for f in result["new_findings"]))
        self.assertFalse(result["accepted"], result["reasons"])

    def test_positive_repair_can_leave_an_existing_ban_for_next_step(self):
        self.assertFalse(bans(self.writer.inspect(CLEAN, self.m)))
        result = self.writer.verify(SAME, CLEAN, self.m, targeted={1, 2})
        self.assertTrue(result["accepted"], result["reasons"])
        before, after = SAME + MODAL, CLEAN + MODAL
        m = pair_mandate(4)
        remaining = bans(self.writer.inspect(after, m))
        self.assertEqual({f.code for f in remaining}, {"MODAL_RHYME"})
        self.assertTrue(all(f.locations == [3, 4] for f in remaining))
        result = self.writer.verify(before, after, m, targeted={1, 2})
        self.assertFalse(any(f["code"] in BAN_CODES for f in result["new_findings"]))
        self.assertTrue(result["accepted"], result["reasons"])

    def test_internal_bound_words_and_group_are_not_replaced_by_end_words(self):
        lines = ["Night settles through the bone", "Light falls where seeds were sown"]
        m = mandate([["1.T1", "2.T1"], [1, 2]], n_lines=2,
                    default_relation="class:RHYME")
        found = self.writer.inspect(lines, m)
        self.assertFalse(found["grade"]["violations"])
        findings = bans(found)
        self.assertTrue(findings)
        self.assertEqual({f.groups for f in findings}, {("A",)})
        subjects = " ".join(str(f.subject).lower() for f in findings)
        self.assertIn("night", subjects)
        self.assertIn("light", subjects)
        self.assertNotIn("bone", subjects)
        self.assertNotIn("sown", subjects)
        # Change the unrelated ends only: the internal obligation stays put.
        changed = ["Night crosses through the rain", "Light falls beside the lane"]
        second = bans(self.writer.inspect(changed, m))
        first_subjects = {tuple(f.subject) for f in findings if f.groups == ("A",)}
        next_subjects = {tuple(f.subject) for f in second if f.groups == ("A",)}
        self.assertEqual(first_subjects, next_subjects)

    def test_declaring_a_structure_cannot_bypass_actual_rhyme_bans(self):
        m = mandate([[1, 2]], n_lines=2,
                    structures={"A": "perfect-rhyme"})
        for lines, code in ((SAME, "HOMEOTELEUTON"), (MODAL, "MODAL_RHYME")):
            with self.subTest(code=code):
                read = self.reader.inspect(lines, m)
                write = self.writer.inspect(lines, m)
                self.assertEqual(read["grade"], write["grade"])
                self.assertFalse(write["grade"]["violations"])
                self.assertFalse(bans(read))
                self.assertEqual({f.code for f in bans(write)}, {code})
                self.assertTrue(all(f.severity == "flag" for f in bans(write)))
                verdict, = read["grade"]["verdicts"]
                self.assertIsNone(self.reader.earned_pair_ban(verdict))
                read_note = next(f for f in read["whole"]
                                 if f.code == "STRUCTURE_UNCALIBRATED")
                write_note = next(f for f in write["whole"]
                                  if f.code == "STRUCTURE_UNCALIBRATED")
                self.assertEqual(read_note.message,
                    "declared structure(s) 'perfect-rhyme' have no measured "
                    "laziness tier FOR THIS DRAFT'S LANGUAGE (eng) — "
                    "correctness is graded by the catalog's own judge, "
                    "laziness is NOT graded")
                self.assertIn("does not apply to their pairs", read_note.evidence)
                self.assertNotIn("does not apply to their pairs", write_note.evidence)
                self.assertIn("The writing bans (HOMEOTELEUTON / MODAL_RHYME) "
                              "still apply when the actual bound words rhyme",
                              write_note.evidence)

        # Existing non-rhyme control from test_structures.py: the declared
        # Kalevala onset relation holds, but no actual rhyme is being banned.
        near = mandate([[1, 2]], n_lines=2,
                       structures={"A": "kalevala-alliteration"})
        found = self.writer.inspect(["The wind", "The winter"], near)
        self.assertFalse(found["grade"]["violations"])
        verdict, = found["grade"]["verdicts"]
        self.assertFalse(set(verdict["relations"]) & {
            "RHYME", "RIME_RICHE", "PROMOTED_RHYME"})
        self.assertFalse(bans(found))

    def test_structured_rhyme_ban_scope_reports_what_writing_checked(self):
        from dataclasses import asdict

        m = mandate([[1, 2]], n_lines=2,
                    structures={"A": "perfect-rhyme"})
        for lines, expected in ((SAME, "HOMEOTELEUTON"),
                                (MODAL, "MODAL_RHYME"), (CLEAN, None)):
            with self.subTest(expected=expected):
                found = self.writer.inspect(lines, m)
                findings = [asdict(f) for f in bans(found)]
                scope = LH._ban_bindings(found, findings, writing=True)
                self.assertEqual(scope, {"asked": 1, "not_asked": []})
                self.assertEqual([f["code"] for f in findings],
                                 [expected] if expected else [])
                if findings:
                    self.assertEqual([b["word"] for b in findings[0]["binding"]],
                                     list(found["grade"]["verdicts"][0]["endwords"]))
                    self.assertEqual([b["line"] for b in findings[0]["binding"]],
                                     [1, 2])
                # The descriptive-reader reporting contract stays unchanged.
                read = self.reader.inspect(lines, m)
                self.assertEqual(LH._ban_bindings(read, [])["asked"], 0)

        near = mandate([[1, 2]], n_lines=2,
                       structures={"A": "kalevala-alliteration"})
        for lines in (["The wind", "The winter"], SAME):
            found = self.writer.inspect(lines, near)
            self.assertFalse(bans(found))
            scope = LH._ban_bindings(found, [], writing=True)
            self.assertEqual(scope["asked"], 0)
            self.assertEqual(scope["not_asked"], [
                {"lines": [1, 2], "group": "A",
                 "structure": "kalevala-alliteration"}])

    def test_same_words_at_distinct_slots_remain_distinct_obligations(self):
        before = ["Night carries into the night", "Light shines in the light"]
        after = ["Bone carries into the night", "Sown shines in the light"]
        m = mandate([["1.T1", "2.T1"], [1, 2]], n_lines=2,
                    default_relation="class:RHYME")
        original = bans(self.writer.inspect(before, m))
        self.assertEqual({f.groups for f in original}, {("A",), ("B",)})
        self.assertEqual(len({tuple(f.subject) for f in original}), 2)
        changed = bans(self.writer.inspect(after, m))
        self.assertEqual({f.groups for f in changed}, {("B",)})
        result = self.writer.verify(before, after, m, targeted={1, 2})
        self.assertFalse(any(f["code"] in BAN_CODES for f in result["new_findings"]))
        self.assertTrue(result["accepted"], result["reasons"])

    def test_brief_states_ban_without_reintroducing_word_menus(self):
        with patch.object(Reviser, "joint_field", side_effect=AssertionError(
                "writing policy must not build ranked word menus")):
            briefs = self.writer.brief(SAME, self.m)
        self.assertTrue(briefs)
        self.assertTrue(any(f.code == "HOMEOTELEUTON"
                            for b in briefs for f in b.findings))
        for b in briefs:
            self.assertFalse(b.field_computed)
            self.assertFalse(b.candidates)
            self.assertFalse(b.forbidden_modal)
            self.assertFalse(b.forbidden_incumbent)
            self.assertFalse(b.fields_by_slot)

    def test_zero_attempt_loop_cannot_finish_a_banned_draft(self):
        declaration = ReviseDeclaration(max_rounds=1, attempts_per_line=0,
                                         backtrack_width=0, pursue=frozenset())
        reader = Reviser(lex=self.reader.lex, rdecl=declaration)
        writer = Reviser(lex=self.reader.lex, rdecl=declaration, writing=True)
        read = revise_loop(reader, SAME, self.m)
        write = revise_loop(writer, SAME, self.m)
        self.assertEqual(read.stop_reason, "success")
        self.assertNotEqual(write.stop_reason, "success")
        self.assertEqual(write.lines, SAME)
        self.assertTrue(write.unresolved)
        self.assertTrue(any(f.code == "HOMEOTELEUTON" and f.severity == "flag"
                            for b in write.unresolved for f in b.findings))

    def test_cached_reader_acceptance_cannot_bypass_writing_policy(self):
        before, after = [SAME[0], CLEAN[0]], SAME
        cache, live, tally = {}, {}, {}
        reader = _VerdictCache(self.reader, cache, live, tally=tally)
        writer = _VerdictCache(self.writer, cache, live, tally=tally)
        accepted = reader.verify(before, after, self.m, targeted={2})
        self.assertTrue(accepted["accepted"], accepted["reasons"])
        rejected = writer.verify(before, after, self.m, targeted={2})
        self.assertFalse(rejected["accepted"], rejected["reasons"])
        self.assertEqual(tally["miss"], 2)
        self.assertEqual(len(cache), 2)
        again = writer.verify(before, after, self.m, targeted={2})
        self.assertFalse(again["accepted"])
        self.assertEqual(tally["miss"], 2)
        legacy = _cursor_key(before, after, {2})
        self.assertEqual(legacy, _cursor_key(before, after, {2}, None))
        self.assertIsNone(self.reader.writing_policy)
        self.assertEqual(self.writer.writing_policy, "rhyme-bans-v1")
        self.assertNotEqual(legacy, _cursor_key(
            before, after, {2}, self.writer.writing_policy))

    def test_standalone_writing_loop_cannot_use_reader_policy(self):
        with tempfile.TemporaryDirectory() as directory:
            draft = Path(directory) / "draft.txt"
            draft.write_text("\n".join(SAME) + "\n", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(Path(__file__).with_name("loop.py")),
                 str(draft), "AA"], capture_output=True, text=True,
                timeout=120)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("SUCCESS", result.stdout)
        self.assertIn("unresolved", result.stdout.lower())


class WritingScreenTests(unittest.TestCase):
    def test_screen_enforces_both_tiers_and_keeps_clean_pair(self):
        for words, expected in ((("night", "light"), {"HOMEOTELEUTON"}),
                                (("obey", "away"), {"MODAL_RHYME"}),
                                (("bone", "sown"), set())):
            with self.subTest(words=words):
                row, = LH.screen_pairs(list(words))
                self.assertFalse(row["refused"], row)
                self.assertIsNone(row["why"], row)
                self.assertEqual(set(row["codes"]), expected)


if __name__ == "__main__":
    unittest.main(verbosity=2)

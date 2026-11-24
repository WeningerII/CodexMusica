#!/usr/bin/env python3
"""Writing policy rejects the two rhyme-ban tiers without changing readers.

Run: python3 quality/test_writing_rhyme_bans.py

The pair fixtures are existing measured controls from test_homeoteleuton.py
and test_screen.py. No corpus, comparator, ranked word menu or model is changed.
Only unrelated floor findings are silenced in the focused Python tests; the
actual pair judge, earned ban, inspection, brief, verification and loop run.
"""

from pathlib import Path
import random
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

    def test_a_quote_mark_on_an_end_word_keeps_the_predictable_rhyme_ban(self):
        """Bug hunt F18 (2026-11-20): the rhyme judge folds and strips the
        end word, but the predictable-rhyme ban looked up the raw token, so a
        closing quote mark (straight or curly) on either end word switched
        the ban off while the rhyme still passed.

        The pairs are drawn by seed: calls from the whole dictionary, each
        partner from that call's own evidenced head, every one a pair the
        plain draft is banned on. Filler words are drawn the same way."""
        import random
        rng = random.Random(20261121)
        mono = sorted(w for w, rs in self.writer.lex.entries.items()
                      if w.isalpha() and w.islower() and len(w) > 1
                      and len(rs) == 1
                      and sum(ph[-1:].isdigit() for ph in rs[0]) == 1)
        fill = rng.sample(mono, 64)

        def draft(a, b, k):
            return [f"{fill[k % 64]} {fill[(k + 1) % 64]} {a}",
                    f"{fill[(k + 2) % 64]} {fill[(k + 3) % 64]} {b}"]

        def modal(lines):
            return "MODAL_RHYME" in {
                f.code for f in bans(self.writer.inspect(lines, self.m))}

        pairs = []
        for k, call in enumerate(rng.sample(mono, 200)):
            head = [p for p in self.writer.modal_head_evidenced(call)
                    if p.isalpha() and len(p) > 1
                    and self.writer._spelled_rime(p)
                    != self.writer._spelled_rime(call)]
            if head and modal(draft(call, head[0], k)):
                pairs.append((k, call, head[0]))
            if len(pairs) == 4:
                break
        self.assertEqual(len(pairs), 4, pairs)
        for k, call, partner in pairs:
            for a, b in ((call, partner + "'"), (call, partner + "’"),
                         (call + "’", partner)):
                with self.subTest(pair=(a, b)):
                    self.assertTrue(modal(draft(a, b, k)))

    def test_a_quote_mark_on_a_partner_word_does_not_empty_the_search_s_ban_list(self):
        """The review of the bug hunt's fixes, 2026-11-23: finding 18 on the
        other path. `earned_pair_ban` folds an end word before it looks up
        the word's most-paired partners. The lookups the loop's own search
        makes did not, and a brief hands them the end word as written. So
        with a closing quote mark on a partner line the search stopped
        leaving out the banned partners (measured on one word: 6 partners
        bare, none with the mark) while `verify` still banned them.

        Calls are drawn by seed from the whole dictionary: the first six
        whose evidenced head is not empty."""
        import random
        rng = random.Random(20261123)
        mono = sorted(w for w, rs in self.writer.lex.entries.items()
                      if w.isalpha() and w.islower() and len(w) > 1
                      and len(rs) == 1
                      and sum(ph[-1:].isdigit() for ph in rs[0]) == 1)
        fill = rng.sample(mono, 8)
        calls = []
        for call in rng.sample(mono, 300):
            if self.writer.modal_head_evidenced(call):
                calls.append(call)
            if len(calls) == 6:
                break
        self.assertEqual(len(calls), 6, calls)
        marks = (lambda w: w + "'", lambda w: w + "’", lambda w: "'" + w,
                 lambda w: "‘" + w + "’", lambda w: w.capitalize() + "'")
        for call in calls:
            head = self.writer.modal_head_evidenced(call)
            ranked = self.writer.modal_head(call)
            field = self.writer.joint_field([call])
            pool = self.writer._widen_pool(call)
            for written in (mark(call) for mark in marks):
                with self.subTest(call=written):
                    self.assertEqual(
                        self.writer.modal_head_evidenced(written), head)
                    # The marked word does not list itself as a word it bans.
                    self.assertEqual(self.writer.modal_head(written), ranked)
                    self.assertEqual(self.writer.joint_field([written]), field)
                    self.assertEqual(self.writer._widen_pool(written), pool)
        # A word the dictionary itself spells with an apostrophe in front,
        # written with a closing mark after it: it does not list its own
        # dictionary spelling as a word it bans either.
        fronted = [w for w in sorted(self.writer.lex.entries)
                   if w.startswith("'") and w[1:].isalpha() and w.islower()
                   and self.writer.modal_head(w)]
        self.assertTrue(fronted, "PREMISE: a dictionary word spelled with an "
                        "apostrophe in front, with a ranked list")
        for call in rng.sample(fronted, min(4, len(fronted))):
            ranked = self.writer.modal_head(call)
            field = self.writer.joint_field([call])
            for written in (call + "'", call + "’", "‘" + call + "’"):
                with self.subTest(call=written):
                    self.assertEqual(self.writer.modal_head(written), ranked)
                    self.assertEqual(self.writer.joint_field([written]), field)
        # An offer is dropped when taking it would make the pair one of the
        # offer's own most-paired answers. That screen looks the call up as
        # text too. Offers are drawn by seed until one is dropped for a call.
        reopened = None
        for call in rng.sample(mono, 300):
            got = self.writer._field_one(call)
            hit = [w for w in got[:40]
                   if self.writer._offer_reopens(w, [call], [got])]
            if hit:
                reopened = (hit[0], call, got)
                break
        self.assertIsNotNone(reopened, "PREMISE: an offer the screen drops")
        offer, call, got = reopened
        for written in (mark(call) for mark in marks):
            with self.subTest(offer=offer, call=written):
                self.assertTrue(
                    self.writer._offer_reopens(offer, [written], [got]))
        # The same through a real brief, against the ban itself. The word a
        # brief hands the search is the partner line's end word as written,
        # mark included; `verify` bans the pair under the folded word. The
        # search has to leave out exactly the partner the ban refuses.
        asked = 0
        for k, call in enumerate(calls):
            partner = self.writer.modal_head_evidenced(call)[0]
            lines = [f"{fill[k % 8]} {fill[(k + 1) % 8]} {call}’",
                     f"{fill[(k + 2) % 8]} {fill[(k + 3) % 8]} {partner}"]
            found = self.writer.inspect(lines, self.m)
            banned = [f for f in bans(found) if f.code == "MODAL_RHYME"]
            for b in self.writer.brief(lines, self.m):
                for _label, _group, mates in b.must_answer:
                    for _line, word in mates:
                        if word.lower().strip("'") != call:
                            continue
                        self.assertNotEqual(word, call, "PREMISE: the brief "
                                            "quotes the end word as written")
                        asked += 1
                        with self.subTest(brief=word):
                            self.assertTrue(banned, "PREMISE: the grader "
                                            "bans this pair")
                            offered, left_out = self.writer.joint_field([word])
                            self.assertIn(partner, left_out)
                            self.assertNotIn(partner, offered)
                            self.assertEqual((offered, left_out),
                                             self.writer.joint_field([call]))
        self.assertGreater(asked, 0, "PREMISE: a brief handed over a marked word")

    def test_a_word_s_own_apostrophe_with_a_quote_mark_after_it_follows_the_grader(self):
        """The review of the bug hunt's fixes, 2026-11-23, the planner owner's
        question: does a word that ends in its own apostrophe get the same
        pool and offers when a closing quote mark is typed after it?

        The search is handed a line's end word as the reader cuts it, and it
        hears that word through the reader the grader hears a line's end
        through (`Reviser._word_anchors`). So the answer is the reader's:
        - a double quotation mark never gets as far as the search;
        - a single one stays on the word as a second apostrophe. Where the
          grader hears the word with it as it hears the plain word, the
          search has to give the same words;
        - where the grader hears the two differently (a few words; the fix
          is the reader's and rides in the pronunciation batch), the search
          hears what the grader hears. A search that read the mark away on
          its own would offer words for a sound the grader does not judge.
        Once the reader reads the second mark away, no word is heard
        differently and the first case covers every word drawn.

        Words are drawn by seed from every dictionary word that ends in an
        apostrophe: some the grader hears differently with the second mark,
        while any exist, and five whose banned-partner list is not empty."""
        import random
        from lyric_harness import line_anchors, raw_final_token
        from quality.loop import _lex_cut
        rng = random.Random(20261123)
        ends = sorted(w for w in self.writer.lex.entries
                      if w.endswith("'") and not w.startswith("'")
                      and len(w) > 2 and w[:-1].isalpha() and w.islower())
        self.assertGreater(len(ends), 500, "PREMISE: the dictionary's words "
                           "that end in an apostrophe")

        def sounds(anchors):
            return [[(s["nucleus"], tuple(s["coda"]), tuple(s["onset"]),
                      s["stress"]) for s in a] for a in anchors]

        def heard(word):
            """-> the word as the grader hears it at a line's end."""
            return sounds(line_anchors(self.writer.lex, word,
                                       promote=self.writer._promote())[0])

        def handed(word, mark):
            """-> the end word a brief hands the search for a line that ends
            in this word with this mark after it."""
            return raw_final_token(f"they said {word}{mark}",
                                   *_lex_cut(self.writer))

        apart = [w for w in ends if heard(w + "'") != heard(w)]
        banning = []
        for call in rng.sample(ends, len(ends)):
            if call not in apart and self.writer.modal_head_evidenced(call):
                banning.append(call)
            if len(banning) == 5:
                break
        self.assertEqual(len(banning), 5, "PREMISE: five drawn words whose "
                         "banned-partner list is not empty")
        alike = 0
        for call in rng.sample(apart, min(3, len(apart))) + banning:
            written = call + "'"
            # What reaches the search: never a double quotation mark, and a
            # single one as the second apostrophe (or, once the reader reads
            # it away, the word itself).
            for mark in ("", '"', "”"):
                self.assertEqual(handed(call, mark), call)
            for mark in ("’", "'"):
                self.assertIn(handed(call, mark), (written, call))
            with self.subTest(call=written):
                # The search hears the call word as the grader hears it.
                self.assertEqual(
                    sounds(self.writer._word_anchors(written)[0]),
                    heard(written))
                if heard(written) != heard(call):
                    continue
                alike += 1
                self.assertEqual(self.writer.modal_head_evidenced(written),
                                 self.writer.modal_head_evidenced(call))
                self.assertEqual(self.writer.modal_head(written),
                                 self.writer.modal_head(call))
                self.assertEqual(self.writer.joint_field([written]),
                                 self.writer.joint_field([call]))
                self.assertEqual(self.writer._widen_pool(written),
                                 self.writer._widen_pool(call))
        self.assertGreaterEqual(alike, 5)

    def test_a_word_is_not_in_its_own_widened_pool_however_it_is_spelled(self):
        """R2's read of the quote-mark fold, 2026-11-23. The widened pool (the
        words that share the call's vowel) left the call word out by its
        spelling as typed. Once the call was read as the rhyme judge reads
        it, with the marks on its edges gone, a dictionary word spelled with
        an apostrophe in front no longer equalled itself there, and a line
        ending in such a word was offered that word back. The two other
        places that leave the call word out already left out both spellings.

        Every word the search can offer that is spelled with an apostrophe
        in front is tried, as typed and with a closing mark after it."""
        from quality.revise import _end_key
        offerable = {w for w, anc, _rank in self.writer.engine.index if anc}
        fronted = sorted(w for w in offerable if w.startswith("'"))
        self.assertGreater(len(fronted), 5, "PREMISE: words the search can "
                           "offer that are spelled with an apostrophe in front")
        pooled = 0
        for call in fronted:
            for written in (call, call + "’", call.upper()):
                pool = self.writer._widen_pool(written)
                pooled += bool(pool)
                with self.subTest(call=written):
                    self.assertEqual(
                        [w for w in pool if _end_key(w) == _end_key(call)], [])
            # The same word without its apostrophe, where the search can
            # offer that too: neither spelling is offered for the other.
            bare = call[1:]
            if bare in offerable:
                with self.subTest(call=bare):
                    self.assertNotIn(call, self.writer._widen_pool(bare))
        self.assertGreater(pooled, 0, "PREMISE: at least one of them has a "
                           "widened pool")

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

    def test_rejection_names_the_pair_the_answer_introduced(self):
        # The writer must be able to tell WHICH two words were refused. The
        # reason names the pair this answer made, with its lines and code,
        # and no other word.
        r = Reviser(lex=self.reader.lex, writing=True,
                    rdecl=ReviseDeclaration(allow_net_new=100))
        result = r.verify(SAME + CLEAN, CLEAN + MODAL, pair_mandate(4),
                          targeted={1, 2, 3, 4})
        self.assertFalse(result["accepted"], result["reasons"])
        reason = result["reasons"][0]
        self.assertIn("introduced a prohibited writing rhyme pair: "
                      "L3 'obey' / L4 'away' (MODAL_RHYME);", reason)
        self.assertNotIn("night", reason)      # the pair it REPAIRED is not named
        again = r.verify(SAME, OTHER_SAME, self.m, targeted={1, 2})
        self.assertIn("L1 'hair' / L2 'chair' (HOMEOTELEUTON)",
                      again["reasons"][0])
        # One entry per pair of words: the same two words on other lines
        # (a mirrored return, a second group) or under both codes are one row.
        from quality.revise import _ban_pairs
        key = lambda line, code, a, b, sa, sb, g: (
            line, code, "flag", (int(sa), int(sb)), (g,),
            ("rhyme-bans-v1", a, b, sa, sb))
        self.assertEqual(
            _ban_pairs({key(4, "HOMEOTELEUTON", "chair", "air", "1", "4", "A"),
                       key(16, "HOMEOTELEUTON", "chair", "air", "13", "16", "A"),
                       key(4, "MODAL_RHYME", "air", "chair", "4", "1", "B"),
                       key(6, "MODAL_RHYME", "air", "there", "4", "6", "A"),
                       (2, "SCHEME_VIOLATION", "flag", (1, 2), ("A",), ())}),
            "L1 'chair' / L4 'air' (HOMEOTELEUTON, MODAL_RHYME), "
            "L4 'air' / L6 'there' (MODAL_RHYME)")

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

    def test_no_drawable_end_rhyme_type_lets_a_banned_pair_pass(self):
        # A catalog form's prescribed group draws one of these types (#902).
        # Whichever it draws, a banned pair is a flag, a missed type or an
        # unjudged obligation for writing, and the reader still bans nothing.
        from quality import plan
        from quality.catalog_shape import terminal_rhyme_relation
        names = [n for n in plan.eligible_types() if terminal_rhyme_relation(n)]
        self.assertGreater(len(names), 1)
        for name in names:
            m = mandate([[1, 2]], n_lines=2, default_relation=f"schema:{name}")
            for lines, code in ((SAME, "HOMEOTELEUTON"), (MODAL, "MODAL_RHYME")):
                with self.subTest(type=name, code=code):
                    write = self.writer.inspect(lines, m)
                    self.assertFalse(bans(self.reader.inspect(lines, m)))
                    if write["grade"]["violations"] or write["grade"]["pairs_refused"]:
                        continue
                    self.assertEqual({f.code for f in bans(write)}, {code})
                    self.assertTrue(all(f.severity == "flag" for f in bans(write)))

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

    def test_differently_spelled_head_is_the_top_three(self):
        """The owner's ruling, 22 Nov 2026: the second tier bans at most the
        3 most predictable differently-spelled partners (it was 6), and the
        same-spelled tier stays without limit. The new second tier is the
        first three words of the old one, in the same order, so the ruling
        moves no word's rank, only where the head stops; the first tier is
        the same set as before. The call words are drawn by seed from the
        song table, from those whose old second tier held more than three
        words."""
        self.assertEqual(ReviseDeclaration().modal_exclusion, 3)
        six = Reviser(lex=self.reader.lex,
                      rdecl=ReviseDeclaration(modal_exclusion=6))
        source = FREQ.LAYER.source_for("eng-song")
        calls = sorted(FREQ.LAYER._song_tables(source)[1])
        random.Random(1).shuffle(calls)
        drawn = []
        for call in calls:
            old = six.modal_head_evidenced(call)
            if len(old) > 3:
                drawn.append((call, old))
            if len(drawn) == 5:
                break
        self.assertEqual(len(drawn), 5)
        for call, old in drawn:
            new = self.reader.modal_head_evidenced(call)
            self.assertEqual(list(new), list(old[:3]), call)
            # Tier 1 is what the whole head holds beyond tier 2.
            self.assertEqual(
                set(self.reader.modal_head(call)) - set(new),
                set(six.modal_head(call)) - set(old), call)


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

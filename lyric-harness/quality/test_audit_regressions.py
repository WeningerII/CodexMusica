"""Executable lyrics audit counterexamples and checkpoint boundary tests.

Run: python3 lyric-harness/quality/test_audit_regressions.py
The linguistic cases use the real dictionary, floor, grader and verifier.
The checkpoint tests replace only the writer, so no model request is made.
"""
import contextlib
import io
import json
import os
from pathlib import Path
import re
import sys
import subprocess
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lyric_harness as LH
from quality import replay_memo as RM
from quality.floor import Finding
from quality.loop import revise_loop, _try_tier2
from quality.propose import ProposerUnavailable
from quality.revise import Brief, Reviser, ReviseDeclaration
from quality.schemes import mandate


class AuditRegressions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rv = Reviser()

    def test_equal_count_pair_swap_is_a_regression(self):
        before = ['Copper cat', 'Azure dog', 'Silver bat',
                  'I left the heavy basket underneath the zzzqx']
        after = [before[0], before[1], 'Silver log',
                 'I left the heavy basket underneath the oak']
        m = mandate([[1, 3], [2, 3]], n_lines=4, default_relation='class:RHYME')
        out = self.rv.verify(before, after, m, targeted={3, 4})
        self.assertFalse(out['accepted'])
        self.assertIn((3, 'SCHEME_VIOLATION'), out['new_flags'])
        self.assertIn((4, 'UNREADABLE_END_WORD'), out['fixed'])
        finding = next(f for f in out['new_findings']
                       if f['code'] == 'SCHEME_VIOLATION')
        self.assertEqual(finding['locations'], [1, 3])
        self.assertEqual(finding['groups'], ['A'])
        # Positive control: the unrelated real readability repair is allowed.
        good = list(before)
        good[3] = after[3]
        self.assertTrue(self.rv.verify(before, good, m, targeted={4})['accepted'])

    def test_group_and_severity_survive_same_location(self):
        def found(fs):
            return {'per_line': {2: fs}, 'whole': [],
                    'grade': {'pairs_mandated': 1, 'pairs_judged': 1,
                              'pairs_refused': 0, 'refused_obligations': []}}
        repair = Finding('SLOTS_EXCEEDED', 'flag', '', '', [2])
        for old, new in [
            (Finding('SCHEME_VIOLATION', 'flag', '', '', [1, 2], ('A',)),
             Finding('SCHEME_VIOLATION', 'flag', '', '', [1, 2], ('B',))),
            (Finding('SAME_CODE', 'note', '', '', [2]),
             Finding('SAME_CODE', 'flag', '', '', [2]))]:
            with self.subTest(old=old, new=new), \
                 patch.object(self.rv, 'brief', return_value=[]), \
                 patch.object(self.rv, 'inspect', side_effect=[found([old, repair]),
                                                               found([new])]):
                out = self.rv.verify(['one', 'two'], ['one', 'changed'], 'AA', {2})
                self.assertFalse(out['accepted'])
                self.assertTrue(out['new_flags'])

    def test_note_budget_and_coverage_are_separate_acceptance_gates(self):
        # Exercise the verifier's decision with controlled inspection rows.
        # A repaired flag plus a new note is allowed. Promoting that same
        # row to a flag or losing judged coverage must independently refuse.
        def found(fs, refused=False):
            return {'per_line': {2: fs}, 'whole': [],
                    'grade': {'pairs_mandated': 1,
                              'pairs_judged': 0 if refused else 1,
                              'pairs_refused': int(refused),
                              'refused_obligations': [(1, 2, 0)] if refused else []}}
        repair = Finding('SLOTS_EXCEEDED', 'flag', '', '', [2])
        for severity, refused, accepted in (
                ('note', False, True), ('flag', False, False),
                ('note', True, False)):
            new = Finding('MODAL_RHYME', severity, '', '', [2])
            with self.subTest(severity=severity, refused=refused), \
                 patch.object(self.rv, 'brief', return_value=[]), \
                 patch.object(self.rv, 'inspect', side_effect=[found([repair]),
                                                               found([new], refused)]):
                out = self.rv.verify(['one', 'two'], ['one', 'changed'], 'AA', {2})
                self.assertEqual(out['accepted'], accepted, out['reasons'])
                self.assertEqual(bool(out['new_flags']), severity == 'flag')
                self.assertEqual(bool(out['new_notes']), severity == 'note')
                self.assertEqual(bool(out['coverage_regressions']), refused)

    def test_aggregate_pair_rows_keep_each_obligation(self):
        def found(f):
            return {'per_line': {ln: [f] for ln in f.locations}, 'whole': [],
                    'grade': {'pairs_mandated': 2, 'pairs_judged': 2,
                              'pairs_refused': 0, 'refused_obligations': []}}
        before = Finding('CLICHE_PAIR', 'flag', 'two pairs', '', [1, 2],
                         obligations=((1, 3), (2, 4)))
        for obligations, locations, accepted in (
                (((2, 4),), [2], True),
                (((1, 4), (2, 4)), [1, 2], False)):
            after = Finding('CLICHE_PAIR', 'flag', 'remaining pairs', '', locations,
                            obligations=obligations)
            with self.subTest(obligations=obligations), \
                 patch.object(self.rv, 'brief', return_value=[]), \
                 patch.object(self.rv, 'inspect', side_effect=[found(before), found(after)]):
                out = self.rv.verify(['a', 'b', 'c', 'd'], ['changed', 'b', 'c', 'd'],
                                     'ABAB', {1})
                self.assertEqual(out['accepted'], accepted)
                self.assertEqual(bool(out['new_flags']), not accepted)

    def test_declared_hook_swap_preserves_hook_identity(self):
        before = ['copper kettle turns', 'copper kettle falls',
                  'quiet river moves', 'silent water breaks']
        after = ['silver basket turns', 'silver basket falls', *before[2:]]
        bp = {'hooks': ['copper kettle', 'silver basket'],
              'sections': [{'name': 'verse', 'bars': 4, 'start_bar': 1,
                            'function': 'verse',
                            'meter': {'beats': 4, 'unit': 4, 'groups': [2, 2]}}],
              'lines': [{'text': text, 'bar': i + 1, 'beat': 1, 'duration': 4,
                         'section': 'verse'} for i, text in enumerate(before)]}
        m = mandate([[1, 2]], n_lines=4, default_relation='class:RHYME')
        out = self.rv.verify(before, after, m, {1, 2}, blueprint=bp)
        self.assertFalse(out['accepted'])
        hooks = [f for f in out['new_findings'] if f['code'] == 'HOOK_ABSENT']
        self.assertEqual([f['subject'] for f in hooks], [['hook', 0]])
        # Both hooks now recur. A caller may actually repair the missing
        # hook; fixing it must not be rejected merely because another remains.
        good = [*before[:2], 'silver basket moves', 'silver basket breaks']
        fixed = self.rv.verify(before, good, m, {3, 4}, blueprint=bp)
        self.assertTrue(fixed['accepted'], fixed['reasons'])
        self.assertEqual(fixed['new_flags'], [])

    def test_judged_to_refused_is_not_a_repair(self):
        before = ['I left the copper kettle near the cat',
                  'We watched the silent river while the dog']
        after = [before[0], 'We watched the silent river while the zzzqx']
        m = mandate('AA', n_lines=2, default_relation='class:RHYME')
        out = self.rv.verify(before, after, m, {2})
        self.assertFalse(out['accepted'])
        self.assertEqual(out['coverage_regressions'], [(1, 2, 0)])
        self.assertEqual(out['new_flags'], [])
        # M-304 keeps text-dependent unknown checks repairable. The
        # historical zero-question stop is no longer correct: ask only
        # the unreadable anchor, honor the writer's decline, and retain
        # its uncertified status without treating the unknown as a flag.
        asked = []
        def decline(brief, lines, attempt, reasons=None, whole=()):
            asked.append((brief.line_no, attempt))
        stopped = revise_loop(self.rv, after, m, propose=decline)
        self.assertEqual(stopped.stop_reason, 'no_progress')
        self.assertEqual(asked, [(2, 0)])
        self.assertEqual(stopped.lines, after)
        self.assertFalse(stopped.coverage_certified)
        self.assertEqual(stopped.whole_flags, [])
        self.assertEqual(stopped.unresolved_flagged, [])
        self.assertEqual(stopped.unresolved_pursued, [])
        self.assertEqual([b.line_no for b in stopped.unresolved], [2])
        self.assertEqual(stopped.unresolved, stopped.unresolved_unjudged)
        self.assertEqual((stopped.pairs_mandated, stopped.pairs_judged,
                          stopped.pairs_refused), (1, 0, 1))

    def test_direct_conflict_zero_width_and_profile(self):
        # Unambiguous declared class: the test is search/budget control,
        # not the default vocabulary's unresolved pronunciation rescue.
        lines = ['The kettle whistles near the cat',
                 'Your fingers brush a heavy dog',
                 'The copper basket hides a fish']
        m = mandate([[1, 3], [2, 3]], n_lines=3, default_relation='class:RHYME')
        rv = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=0,
                                            backtrack_width=0))
        briefs = rv.brief(lines, m)
        # A brief computes no candidate field since 2026-10-27 (D6 on #519),
        # so `joint_conflict` is never set; the pivot's brief is taken by line.
        self.assertFalse(any(b.joint_conflict or b.candidates for b in briefs))
        b = next(b for b in briefs if b.line_no == 3)
        seen = []
        result = revise_loop(rv, lines, m, propose=lambda *a, **k: None,
                             propose_group=lambda g: seen.append(g))
        self.assertEqual(seen, [])
        self.assertTrue(any('backtrack_width' in a.reason
                            for r in result.rounds for a in r.attempts))
        # Same real joint conflict, enabled budget: exercise the search seam
        # with a declared nondefault profile; no fake field is ever graded.
        rd = ReviseDeclaration(backtrack_width=1)
        for field in ([], ['willow']):
            with patch.object(rv, 'joint_field', return_value=(field, [])) as jf:
                _try_tier2(rv, b, lines, m, rd, None, None, None,
                           'declared-test-profile', lambda g: seen.append(g))
                self.assertTrue(jf.call_args_list)
                self.assertTrue(all(c.kwargs['profile'] == 'declared-test-profile'
                                    for c in jf.call_args_list))
        self.assertTrue(seen)

    def test_checkpoint_replays_paid_answers_and_preserves_accepted_draft(self):
        initial = ['original cat', 'original dog']
        accepted = ['original cat', 'accepted log']
        b = Brief(2, initial[1])
        b.round_no = 1
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp.json')}), \
             contextlib.redirect_stdout(io.StringIO()):
            called = []
            def writer(*args, **kwargs):
                called.append(True)
                return accepted[1]
            one, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
            one.checkpoint(initial, 0, 'started')
            self.assertEqual(one(b, initial, 0), accepted[1])
            state = json.loads((Path(tmp)/'cp.json').read_text())
            self.assertEqual(state['status'], 'proposal_completed')
            self.assertEqual(state['accepted_lines'], initial)
            self.assertEqual(len(state['proposals']), 1)
            one.checkpoint(accepted, 1, 'accepted')
            resumed, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
            resumed.checkpoint(initial, 0, 'started')
            self.assertEqual(json.loads((Path(tmp)/'cp.json').read_text())['accepted_lines'], accepted)
            self.assertEqual(resumed(b, initial, 0), accepted[1])
            self.assertEqual(len(called), 1)
            with self.assertRaises(ProposerUnavailable):
                LH._checkpoint_proposer(writer, None, initial, 'other-config', 'fake')
            # A replay that DIVERGED (another draft) is still refused by name.
            mismatched, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
            with self.assertRaises(ProposerUnavailable) as diverged:
                mismatched(b, ['different cat', initial[1]], 0)
            self.assertNotIsInstance(diverged.exception, LH._QuestionChanged)
            self.assertEqual(len(called), 1)
            # The SAME question in new wording -- what an update that rewords
            # the writer's questions does (2026-10-27, 3PO on #627) -- parks:
            # the accepted draft is kept, no writer call is made, and the
            # checkpoint is not rewritten.
            import quality.propose as PRM
            real_render = PRM.render_line
            with patch.object(PRM, 'render_line',
                              lambda *a, **k: real_render(*a, **k) + '\n(reworded)'):
                reworded, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
                before = (Path(tmp)/'cp.json').read_bytes()
                with self.assertRaises(LH._QuestionChanged) as parked:
                    reworded(b, initial, 0)
            self.assertEqual(parked.exception.code, 'QUESTION_CHANGED')
            self.assertEqual(parked.exception.lines, accepted)
            self.assertEqual((Path(tmp)/'cp.json').read_bytes(), before)
            self.assertEqual(len(called), 1)
            for bad in ([], dict(state, proposals=[None]),
                        dict(state, proposals=[{'kind': 'propose',
                                               'question_sha256': '0' * 64,
                                               'answer': {'wrong': 'type'}}])):
                (Path(tmp)/'cp.json').write_text(json.dumps(bad))
                with self.assertRaises(ProposerUnavailable):
                    LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
            self.assertEqual(len(called), 1)

    def test_replay_order_undo_then_park_then_refuse(self):
        # THE COMBINED ORDER in `ask()` (#626 + #627, agreed on #519), on one
        # real line checkpoint. A question recorded under the wording before
        # #626's NO_RELATION rewording:
        #   1. replays its answer when the ONLY change is that rewording --
        #      `LEGACY_QUESTION_RENDERINGS` restores the old bytes exactly;
        #   2. parks (QUESTION_CHANGED) when the wording moved in a way no
        #      undo restores, as #627's removed word lists do;
        #   3. refuses by name when the replay diverged (another draft).
        # No branch makes a writer request or rewrites the checkpoint.
        #
        # A QUESTION THAT OLD ALSO STATED THE 200-CHARACTER LINE LIMIT
        # (2026-11-12, #851: the limit a question states rose to 512 after
        # #626's rewording). The held question is therefore rendered as it
        # was then, with both, and branch 1 undoes the two changes in turn,
        # newest first. A question held between the two changes is
        # `test_a_question_held_under_the_200_line_limit_replays` below.
        import quality.propose as PRM
        initial = ['original cat', 'original dog']
        accepted = ['original cat', 'accepted log']
        b = Brief(2, initial[1])
        b.round_no = 1
        real_render = PRM.render_line
        old_tail = LH._UNADMITTED_DEFAULT_TAIL_BEFORE
        new_tail = LH._UNADMITTED_DEFAULT_TAIL
        # ...AND BEFORE #671 PASS 2 CUT THE QUESTION'S PROSE (2026-11-14), so
        # the held rendering has that rewording undone as well.
        # ...AND BEFORE THE QUESTION SAID WHAT THE TWO WRITING BANS FORBID
        # (REPINNED 2026-11-21, bug hunt finding 3: ~~the 671 undo alone~~;
        # this build's question carries that block, a held one did not).
        def render_at_200(*a, **k):
            with patch.object(PRM, 'MAX_LINE_CHARS', 200):
                text = real_render(*a, **k)
            text = LH._legacy_ban_definitions('propose', text) or text
            return LH._legacy_671_prose('propose', text) or text
        held = lambda *a, **k: render_at_200(*a, **k) + '\nwhy: x — ' + old_tail
        now = lambda *a, **k: real_render(*a, **k) + '\nwhy: x — ' + new_tail
        self.assertEqual(LH.legacy_question_texts('propose', now(b, initial))[-1],
                         held(b, initial))
        unrestorable = lambda *a, **k: now(*a, **k) + '\n(no word list)'
        calls = []
        def writer(*args, **kwargs):
            calls.append(True)
            return accepted[1]
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp.json')}), \
             contextlib.redirect_stdout(io.StringIO()):
            with patch.object(PRM, 'render_line', held):
                one, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
                one.checkpoint(initial, 0, 'started')
                self.assertEqual(one(b, initial, 0), accepted[1])
                one.checkpoint(accepted, 1, 'accepted')
            self.assertEqual(len(calls), 1)
            cp = Path(tmp)/'cp.json'
            with patch.object(PRM, 'render_line', now):
                undone, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
                self.assertEqual(undone(b, initial, 0), accepted[1],
                                 '1. the exact undo replays the recorded answer')
            self.assertEqual(len(calls), 1)
            with patch.object(PRM, 'render_line', unrestorable):
                parked_run, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
                before = cp.read_bytes()
                with self.assertRaises(LH._QuestionChanged) as parked:
                    parked_run(b, initial, 0)
                self.assertEqual(parked.exception.lines, accepted, '2. parks with the accepted draft')
                self.assertEqual(cp.read_bytes(), before)
                diverged_run, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
                with self.assertRaises(ProposerUnavailable) as diverged:
                    diverged_run(b, ['different cat', initial[1]], 0)
                self.assertNotIsInstance(diverged.exception, LH._QuestionChanged,
                                         '3. a diverged replay refuses by name')
                self.assertEqual(cp.read_bytes(), before)
            self.assertEqual(len(calls), 1, 'no branch made a writer request')

    def test_the_671_rewording_undoes_to_the_old_question(self):
        # 2026-11-14 (#671 pass 2, A9-A13): the question lost its prose and
        # its enforced rules became `VERIFY_REJECTIONS` rows. The newest
        # undo restores the earlier wording, so a run held across the change
        # still replays (`LEGACY_QUESTION_RENDERINGS`).
        import quality.propose as PRM
        b = Brief(2, 'original dog')
        now_line = PRM.render_line(b, ['original cat', 'original dog'])
        # REPINNED 2026-11-21 (bug hunt finding 3): ~~[0]~~ and, below,
        # ~~LEGACY_QUESTION_RENDERINGS[-1]~~. A newer change now sits after
        # this one (the question says what the two writing bans forbid), so
        # the 671 wording is the second undo, not the first.
        # REPINNED 2026-11-21 (bug hunt finding 5), below:
        # ~~LEGACY_QUESTION_RENDERINGS[-2]~~. One more change sits after it
        # (a group asked for after a rejected line answer says so). That one
        # touches group questions only, so this line question's second undo
        # is still the 671 wording.
        # REPINNED 2026-11-21 (bug hunt finding 2), below:
        # ~~LEGACY_QUESTION_RENDERINGS[-3]~~. One more change sits after it
        # (a question states the rule a declared group is graded by). This
        # line declares no rule, so that undo leaves its question alone.
        older = LH.legacy_question_texts('propose', now_line)[1]
        self.assertIn('Reviser.verify rejects an answer', now_line)
        self.assertNotIn('Reviser.verify rejects an answer', older)
        self.assertIn('  1. ONE line back, and it replaces L2. The draft stays 2 '
                      'lines — a different', older)
        self.assertIn('New NOTES do not reject.', older)
        # REPINNED 2026-11-21 (R2, the return-row rewording appends an entry
        # after this one): ~~`LEGACY_QUESTION_RENDERINGS[-1][1]` is
        # `_legacy_671_prose`~~ -- the claim is that the #671 undo is in the
        # tuple and comes after the line-limit change, not that it is last.
        undos = [e[1] for e in LH.LEGACY_QUESTION_RENDERINGS]
        self.assertIn(LH._legacy_671_prose, undos)
        self.assertLess(undos.index(LH._legacy_line_limit),
                        undos.index(LH._legacy_671_prose))
        # REPINNED 2026-11-22 (merge of main into the bug hunt branch):
        # ~~`LEGACY_QUESTION_RENDERINGS[-4][1]` is `_legacy_671_prose`~~.
        # That was this branch's own position pin. The return-row entry
        # reached main first and now sits between the 671 entry and this
        # branch's three, so the position-free claim above replaces it.
        # The undo reads a FROZEN copy of the rows it replaced; while the
        # table is unchanged the two agree, and a later change to the table
        # needs its own entry.
        self.assertEqual('\n'.join(PRM._rejection_rows()), LH._REJECTION_ROWS_671)
        # A QUOTED rejection names the banned pair now (same step). Undone,
        # it is the one fixed sentence a held run was asked under.
        named = ("introduced a prohibited writing rhyme pair: L1 'chair' / "
                 "L4 'prayer' (MODAL_RHYME); HOMEOTELEUTON and MODAL_RHYME "
                 "cannot be traded for a repair")
        fixed = ("introduced a prohibited writing rhyme pair; HOMEOTELEUTON "
                 "and MODAL_RHYME cannot be traded for a repair")
        quoted = PRM.render_line(b, ['original cat', 'original dog'],
                                 attempt=1, reasons=[named])
        self.assertIn(f"  - {named}", quoted)
        undone = LH.legacy_question_texts('propose', quoted)[1]
        self.assertIn(f"  - {fixed}", undone)
        self.assertNotIn("prayer", undone)
        self.assertNotIn("<pairs>", undone)

    def test_the_ban_definitions_undo_to_the_old_question(self):
        # 2026-11-21 (bug hunt 2026-11-20, finding 3): every question now
        # says what the two bans its writing-ban row names forbid. That moves
        # the bytes of every line, batch and group question, so a run held
        # across the change replays only because the newest undo restores the
        # earlier wording exactly (`LEGACY_QUESTION_RENDERINGS`,
        # `_legacy_ban_definitions`).
        import quality.propose as PRM
        from types import SimpleNamespace as NS
        lines = ['original cat', 'original dog']
        b = Brief(2, lines[1])
        group = NS(pivot_line_no=2, pivot_text=lines[1], pivot_word='dog',
                   anchors=(), label='A', members=(1, 2), brief=b,
                   lines=lines, attempt=0, reasons=None, whole=())
        # REPINNED 2026-11-21 (bug hunt finding 5):
        # ~~LEGACY_QUESTION_RENDERINGS[-1]~~. The undo for the rejected line
        # answer a group question now quotes was added after this one.
        # REPINNED 2026-11-21 (bug hunt finding 2):
        # ~~LEGACY_QUESTION_RENDERINGS[-2]~~. The undo for the rule a
        # declared group is graded by was added after that one.
        # REPINNED 2026-11-23 (the review of the bug hunt's fixes):
        # ~~LEGACY_QUESTION_RENDERINGS[-3][1] is `_legacy_ban_definitions`~~.
        # One more undo was added at the end, and every entry added after
        # this one has moved this pin. The claim is the order, so it is
        # stated as the order: this undo comes after the return row's and
        # before the rejected line answer's.
        undos = [e[1] for e in LH.LEGACY_QUESTION_RENDERINGS]
        self.assertLess(undos.index(LH._legacy_return_row),
                        undos.index(LH._legacy_ban_definitions))
        self.assertLess(undos.index(LH._legacy_ban_definitions),
                        undos.index(LH._legacy_pivot_rejection))
        # The undo reads a FROZEN copy of the block; while the block is
        # unchanged the two agree, and a later change needs its own entry.
        self.assertEqual('\n' + '\n'.join(PRM._writing_ban_rows()),
                         LH._BAN_DEFINITIONS_1121)
        for kind, render in (
                ('propose', lambda: PRM.render_line(b, lines)),
                ('propose', lambda: PRM.render_line(
                    b, lines, attempt=1, reasons=['nothing was fixed'])),
                ('propose', lambda: PRM.render_batch(
                    [Brief(1, lines[0]), b], lines)),
                ('propose_group', lambda: PRM.render_group(group))):
            now = render()
            with patch.object(PRM, '_writing_ban_rows',
                              lambda indent='  ': []):
                before = render()
            self.assertIn('HOMEOTELEUTON: two different paired words', now)
            self.assertNotIn('What each one forbids', before)
            self.assertEqual(LH.legacy_question_texts(kind, now)[0], before)
        # A question with no rules block (a whole-draft repair) is untouched.
        self.assertIsNone(LH._legacy_ban_definitions('propose', 'no rules'))

    def test_a_question_held_under_the_200_line_limit_replays(self):
        # 2026-11-12 (#851). The line limit a question states rose from 200
        # characters to 512, which moves the bytes of every question. A
        # checkpoint recorded while the question read "at most 200 characters"
        # replays its answer on this build with no writer request
        # (`LEGACY_QUESTION_RENDERINGS`, `_legacy_line_limit`). With that one
        # entry taken out the same checkpoint parks instead, so the entry is
        # what carries a run held across the change.
        import quality.propose as PRM
        initial = ['original cat', 'original dog']
        accepted = ['original cat', 'accepted log']
        b = Brief(2, initial[1])
        b.round_no = 1
        then = 'is at most 200 characters; a longer one is not accepted.'
        now = 'is at most 512 characters; a longer one is not accepted.'
        # A QUESTION HELD UNDER THE 200 LIMIT WAS WORDED BEFORE #671 PASS 2
        # TOO (2026-11-14, `_legacy_671_prose`), so the held bytes are this
        # build's question at 200 with that later rewording undone.
        real_render = PRM.render_line
        # ...AND BEFORE THE QUESTION SAID WHAT THE TWO WRITING BANS FORBID
        # (REPINNED 2026-11-21, bug hunt finding 3: ~~the 671 undo alone~~).
        def without_bans(*args, **kwargs):
            text = real_render(*args, **kwargs)
            return LH._legacy_ban_definitions('propose', text) or text
        def worded_then(*args, **kwargs):
            text = without_bans(*args, **kwargs)
            return LH._legacy_671_prose('propose', text) or text
        with patch.object(PRM, 'MAX_LINE_CHARS', 200):
            held_line = worded_then(b, initial)
        now_line = PRM.render_line(b, initial)
        self.assertEqual((held_line.count(then), held_line.count(now)), (1, 0))
        self.assertEqual((now_line.count(then), now_line.count(now)), (0, 1))
        # Undoing the change restores the old bytes exactly, for a line
        # question and for a group question's "Each line is at most ...".
        # REPINNED 2026-11-21: ~~[worded_then(b, initial), held_line]~~;
        # the newest undo (the ban definitions) comes first.
        self.assertEqual(LH.legacy_question_texts('propose', now_line),
                         [without_bans(b, initial), worded_then(b, initial),
                          held_line])
        self.assertEqual(
            LH.legacy_question_texts('propose_group', '  Each line ' + now),
            ['  Each line ' + then])
        self.assertEqual(LH.legacy_question_texts('propose', 'no limit stated'), [])
        calls = []
        def writer(*args, **kwargs):
            calls.append(True)
            return accepted[1]
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp.json')}), \
             contextlib.redirect_stdout(io.StringIO()):
            with patch.object(PRM, 'MAX_LINE_CHARS', 200), \
                    patch.object(PRM, 'render_line', worded_then):
                one, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
                one.checkpoint(initial, 0, 'started')
                self.assertEqual(one(b, initial, 0), accepted[1])
                one.checkpoint(accepted, 1, 'accepted')
            self.assertEqual(len(calls), 1)
            cp = Path(tmp)/'cp.json'
            before = cp.read_bytes()
            replayed, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
            self.assertEqual(replayed(b, initial, 0), accepted[1],
                             'the answer recorded under the 200 wording replays')
            self.assertEqual(len(calls), 1, 'no writer request was made')
            others = tuple(e for e in LH.LEGACY_QUESTION_RENDERINGS
                           if e[1] is not LH._legacy_line_limit)
            self.assertEqual(len(others), len(LH.LEGACY_QUESTION_RENDERINGS) - 1)
            with patch.object(LH, 'LEGACY_QUESTION_RENDERINGS', others):
                without, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
                with self.assertRaises(LH._QuestionChanged) as parked:
                    without(b, initial, 0)
                self.assertEqual(parked.exception.lines, accepted)
            self.assertEqual(cp.read_bytes(), before)
            self.assertEqual(len(calls), 1, 'no branch made a writer request')

    def test_group_question_reworded_parks_and_a_diverged_group_refuses(self):
        # 3PO on #627: a group question whose only change is its WORDING
        # parks like a line question does; changed members or a changed
        # draft under the members is a diverged replay and still refuses.
        from types import SimpleNamespace
        initial = ['first cat', 'second dog', 'third fox']
        answer = ['first hat', 'second log']

        def group(members, texts=None):
            texts = texts or initial
            return SimpleNamespace(members=tuple(members), lines=list(texts),
                                   brief=SimpleNamespace(round_no=1),
                                   proposal_for=lambda n: (texts[n - 1], 'word'))
        calls = []
        writer = lambda b: calls.append(True) or answer
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp.json')}), \
             contextlib.redirect_stdout(io.StringIO()):
            with patch('quality.propose.render_group', return_value='group question'):
                one, two = LH._checkpoint_proposer(None, writer, initial, 'config', 'fake')
                self.assertEqual(two(group((1, 2))), answer)
                one.checkpoint(answer + initial[2:], 1, 'accepted')
                _, same = LH._checkpoint_proposer(None, writer, initial, 'config', 'fake')
                self.assertEqual(same(group((1, 2))), answer, 'unchanged wording replays')
            self.assertEqual(len(calls), 1)
            with patch('quality.propose.render_group',
                       return_value='group question, reworded'):
                cases = (('only the wording', group((1, 2)), True),
                         ('changed members', group((1, 3)), False),
                         ('changed draft', group((1, 2), ['other cat'] + initial[1:]), False))
                for name, g, parks in cases:
                    with self.subTest(name):
                        _, replay = LH._checkpoint_proposer(None, writer, initial, 'config', 'fake')
                        before = (Path(tmp)/'cp.json').read_bytes()
                        with self.assertRaises((ProposerUnavailable, LH._QuestionChanged)) as raised:
                            replay(g)
                        self.assertIs(isinstance(raised.exception, LH._QuestionChanged), parks)
                        if parks:
                            self.assertEqual(raised.exception.lines, answer + initial[2:])
                        self.assertEqual((Path(tmp)/'cp.json').read_bytes(), before)
            self.assertEqual(len(calls), 1, 'no case made a writer request')

    def test_interrupted_real_loop_preserves_accepted_edit_before_next_request(self):
        # A real mandated-assonance violation (door/coat share no nucleus)
        # with one deterministic legal repair; neither end word has a second
        # dictionary reading. (It was a syllable-band violation until the
        # owner deleted that band 2026-09-28, and a prominence-band one until
        # the owner deleted that band 2026-10-01.)
        initial = ['Your fingers brush my heavy coat',
                   'My kettle whistles by the door']
        m = mandate('AA', n_lines=2, default_relation='class:ASSONANCE')
        rv = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=1,
                                            backtrack_width=0))
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp.json')}), \
             contextlib.redirect_stdout(io.StringIO()):
            calls = []
            def writer(*a, **kw):
                calls.append(True)
                return 'My kettle whistles by the stove'
            one, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
            save = one.checkpoint
            def interrupt(current, round_no, status):
                save(current, round_no, status)
                if status == 'accepted':
                    raise ProposerUnavailable('controlled interruption after accepted edit')
            one.checkpoint = interrupt
            with self.assertRaises(ProposerUnavailable):
                revise_loop(rv, initial, m, propose=one)
            cp = json.loads((Path(tmp)/'cp.json').read_text())
            self.assertEqual(cp['status'], 'accepted')
            self.assertEqual(cp['accepted_lines'][1], 'My kettle whistles by the stove')
            one, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
            result = revise_loop(rv, initial, m, propose=one)
            self.assertEqual(result.lines, cp['accepted_lines'])
            self.assertEqual(len(calls), 1)

    def test_malformed_completed_proposal_is_replayed_without_spending(self):
        initial = ['one cat', 'two dog']
        b = Brief(2, initial[1])
        b.round_no = 1
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp.json')}), \
             contextlib.redirect_stdout(io.StringIO()):
            called = []
            def writer(*args, **kwargs):
                called.append(True)
                return None
            one, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
            self.assertIsNone(one(b, initial, 0))
            one, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
            self.assertIsNone(one(b, initial, 0))
            self.assertEqual(len(called), 1)

    # -- bug hunt 2026-11-20: the revise loop and its replies -------------
    # Findings 5, 25, 28 and 29 are driven by one deterministic writer
    # (`_fake_writer` below): no model, every reply read from a spec, so what
    # the loop makes of a reply is the only thing that varies.
    DOOR = ['Your fingers brush my heavy coat',
            'My kettle whistles by the door']
    STOVE = 'My kettle whistles by the stove'

    @staticmethod
    def _fake_writer(spec):
        """-> `call(prompt) -> reply`, a stand-in for the writer a
        `ModelProposer` takes.

        `spec` is one object: {"L3": [the reply to the first question about
        L3, the reply to the second, ...], "group": [the reply to the first
        group question, ...]}. A line question is recognised by its own
        heading, `REVISE ONE LINE — L<n>` (`quality/propose.py:render_line`);
        every other question is a group question. Past the end of a list the
        writer DECLINES: it returns `None`, which is not a string, so
        `ModelProposer` reads it as a writer with nothing to offer and not as
        a reply it could not read. A reply may be any value, so a spec can
        also send a non-string through the seam. `calls` on the returned
        callable lists the questions it was asked, each `(kind, prompt)`.

        It is defined here and not in a module of its own: a module only a
        test imports is one the `wiring` verb reports as stranded
        (`test_verbs.py`, "`wiring` reports no STRANDED module").
        """
        asked = {}

        def call(prompt):
            head = re.match(r'^REVISE ONE LINE — L(\d+) ', prompt)
            key = f'L{head.group(1)}' if head else 'group'
            call.calls.append((key, prompt))
            k = asked.get(key, 0)
            asked[key] = k + 1
            replies = spec.get(key) or []
            return replies[k] if k < len(replies) else None

        call.calls = []
        return call

    def _door_loop(self, spec, attempts):
        from quality.propose import ModelProposer
        m = mandate('AA', n_lines=2, default_relation='class:ASSONANCE')
        rv = Reviser(rdecl=ReviseDeclaration(max_rounds=3, attempts_per_line=attempts,
                                            backtrack_width=0))
        call = self._fake_writer(spec)
        with contextlib.redirect_stdout(io.StringIO()):
            result = revise_loop(rv, list(self.DOOR), m,
                                 propose=ModelProposer(call).propose)
        return result, call

    def test_an_unreadable_reply_costs_one_attempt_not_the_line(self):
        # Finding 25. The question says an ambiguous answer "is discarded
        # unread and costs you this attempt". It cost the line's whole
        # budget: `ModelProposer` returned None for a reply it could not
        # read, tier 1 read None as "this writer has nothing further to
        # offer" and stopped asking, and the line was reported as declined.
        # With attempts above 1 that one round then ended the run.
        result, call = self._door_loop(
            {'L2': ['Here is my line:\n' + self.STOVE, self.STOVE]}, attempts=3)
        self.assertEqual([k for k, _p in call.calls], ['L2', 'L2'],
                         'the second attempt is asked')
        self.assertEqual(result.lines[1], self.STOVE)
        self.assertEqual(result.stop_reason, 'success')
        first = result.rounds[0].attempts[0]
        self.assertTrue(first.accepted)
        self.assertEqual(first.tried, 2, 'the unread reply used one attempt')
        second = call.calls[1][1]
        self.assertIn('This is ATTEMPT 2 of this line', second)
        # REPINNED 2026-11-23 (the review of the bug hunt's fixes):
        # ~~assertIn('The PREVIOUS attempt was REJECTED', second)~~. The
        # first reply was never read, so the grader rejected nothing, and
        # the question no longer says it did (the whole block is pinned in
        # `test_a_try_the_grader_never_read_is_not_called_a_rejected_attempt`).
        self.assertIn('The PREVIOUS attempt never reached the grader', second)
        self.assertIn('discarded unread', second)
        self.assertNotIn('No previous attempt was rejected', second)

    def test_unreadable_replies_are_reported_as_unread_and_a_decline_as_a_decline(self):
        # Every reply unreadable: each uses one attempt, and the report says
        # the replies could not be read. A writer that sends nothing back is
        # still a decline, asked once.
        result, call = self._door_loop(
            {'L2': ['one line\nand another', '"' + self.STOVE + '"']}, attempts=2)
        self.assertEqual(len(call.calls), 2)
        attempt = result.rounds[0].attempts[0]
        self.assertFalse(attempt.accepted)
        self.assertEqual(attempt.tried, 2)
        self.assertIn('discarded unread', attempt.reason)
        self.assertNotIn('declined', attempt.reason)
        self.assertEqual(result.lines, self.DOOR, 'nothing unread reaches the draft')
        declined, quiet = self._door_loop({'L2': []}, attempts=3)
        self.assertEqual(len(quiet.calls), 1)
        self.assertIn('the PROPOSER declined at attempt 0',
                      declined.rounds[0].attempts[0].reason)

    def test_an_unread_reply_is_journalled_and_replays_as_unread(self):
        # The checkpoint journal stored an unread reply as a bare None, the
        # same as a decline. A resumed run must make of it what the first
        # run did, so the journal now says which it was. A record without
        # the mark is a decline, as it always replayed.
        from quality.propose import UnreadReply
        initial = ['one cat', 'two dog']
        b = Brief(2, initial[1])
        b.round_no = 1
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp.json')}), \
             contextlib.redirect_stdout(io.StringIO()):
            called = []
            def writer(*args, **kwargs):
                called.append(True)
                return UnreadReply('the reply was two lines')
            one, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
            first = one(b, initial, 0)
            self.assertIsInstance(first, UnreadReply)
            cp = json.loads((Path(tmp)/'cp.json').read_text())
            self.assertEqual(cp['proposals'][-1]['answer'], None)
            self.assertEqual(cp['proposals'][-1]['unread'], 'the reply was two lines')
            one, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
            again = one(b, initial, 0)
            self.assertIsInstance(again, UnreadReply)
            self.assertEqual(again.unread_reason, 'the reply was two lines')
            self.assertEqual(len(called), 1, 'the replay made no writer request')

    # Four lines in two crossed pairs. L3's own answer changes nothing the
    # grader asked for, so the loop goes on to ask for L1 and L3 together;
    # that answer moves L3 and sends L1 back as it was.
    HILL = ['Your fingers brush my heavy coat',
            'We climbed together up the hill',
            'My kettle whistles by the door',
            'And I am standing in the sun']
    HILL_SPEC = {'L3': ['My kettle whistles by the door again'],
                 'L4': ['And I am standing in the sun again'],
                 'group': ['L3: My kettle whistles by the stove\n'
                           'L1: Your fingers brush my heavy coat']}

    def _hill_loop(self, spec=None):
        from quality.propose import ModelProposer
        m = mandate('ABAB', n_lines=4, default_relation='class:ASSONANCE')
        rv = Reviser(rdecl=ReviseDeclaration(max_rounds=2, attempts_per_line=1,
                                            backtrack_width=1))
        call = self._fake_writer(self.HILL_SPEC if spec is None else spec)
        writer, groups = ModelProposer(call), []

        def propose_group(group_brief):
            groups.append(group_brief)
            return writer.propose_group(group_brief)
        with contextlib.redirect_stdout(io.StringIO()):
            result = revise_loop(rv, list(self.HILL), m, propose=writer.propose,
                                 propose_group=propose_group)
        return result, call, groups

    def test_the_group_question_after_a_rejected_line_says_it_was_rejected(self):
        # Finding 5. A line answer is rejected, and the loop then asks for
        # the line's whole group. That question said "No previous attempt was
        # rejected on this line in this round", one question after rejecting
        # one, and never gave the grader's reason, so the same line could come
        # straight back inside the group answer. The loop already built the
        # words that cite the line question; nothing printed them.
        import dataclasses
        import quality.propose as PRM
        result, call, groups = self._hill_loop()
        self.assertEqual([k for k, _p in call.calls][:2], ['L3', 'group'])
        self.assertIn('last rejection: nothing was fixed',
                      result.rounds[0].attempts[0].reason)
        asked = call.calls[1][1]
        self.assertNotIn('No previous attempt was rejected', asked)
        self.assertIn("  L3's line question (attempt 1, round 1) was asked "
                      "first, and its answer was REJECTED. The grader's "
                      "reasons, verbatim:\n    - nothing was fixed\n", asked)
        # A run held across this change still replays: the undo restores
        # the question as it was worded before, byte for byte.
        # REPINNED 2026-11-21 (bug hunt finding 2):
        # ~~LEGACY_QUESTION_RENDERINGS[-1]~~, and in the comparisons below
        # ~~legacy_question_texts(...)[0] == before~~. The undo for the rule
        # a declared group is graded by was added after this one, and these
        # groups declare a relation, so their questions print that rule. The
        # question a held run was asked is the second undo, and `before` is
        # compared with its rule rows taken out the same way.
        # REPINNED 2026-11-23 (the review of the bug hunt's fixes):
        # ~~LEGACY_QUESTION_RENDERINGS[-2][1] is `_legacy_pivot_rejection`~~.
        # One more undo was added at the end (a line reply that was never
        # read is no longer called a rejected answer). The claim is the
        # order: this undo comes before the declared rule's, and the newer
        # one comes after both.
        undos = [e[1] for e in LH.LEGACY_QUESTION_RENDERINGS]
        self.assertLess(undos.index(LH._legacy_pivot_rejection),
                        undos.index(LH._legacy_group_rules))
        self.assertLess(undos.index(LH._legacy_group_rules),
                        undos.index(LH._legacy_pivot_unread))
        first = groups[0]
        self.assertEqual(first.path, 'escalation')
        before = PRM.render_group(dataclasses.replace(first, pivot_line_reasons=()))
        self.assertIn('  No previous attempt was rejected on this line in this '
                      'round.\n', before)
        self.assertEqual(LH.legacy_question_texts('propose_group', asked)[1],
                         LH._legacy_group_rules('propose_group', before))
        # With last round's rejection of the same group also on the question,
        # the old wording had that block and nothing after it.
        earlier = {'round': 1, 'text': 'x', 'reasons': ['nothing was fixed']}
        with_prior = dataclasses.replace(first, prior=earlier)
        now = PRM.render_group(with_prior)
        self.assertIn('Your rewrite of this group in ROUND 1 was REJECTED', now)
        self.assertIn("L3's line question (attempt 1, round 1) was asked first", now)
        self.assertEqual(
            LH.legacy_question_texts('propose_group', now)[1],
            LH._legacy_group_rules('propose_group', PRM.render_group(
                dataclasses.replace(with_prior, pivot_line_reasons=()))))
        # A second try at the group quotes the group's own rejection, the
        # latest one, and a group asked before any line question has no line
        # answer to cite: neither is reworded, so neither needs an undo.
        for same in (dataclasses.replace(first, attempt=1, reasons=('nothing was fixed',)),
                     dataclasses.replace(first, path='group_first', pivot_line_question='',
                                         pivot_line_reasons=())):
            text = PRM.render_group(same)
            self.assertNotIn('was asked first', text)
            self.assertIsNone(LH._legacy_pivot_rejection('propose_group', text))
        self.assertIsNone(LH._legacy_pivot_rejection('propose', asked))

    # A reply with words around the line and no marker: the writer's reader
    # cannot say which row is the line, so it is discarded unread.
    UNREAD_REPLY = ('Here is my line:\n'
                    'My kettle whistles by the door again\n'
                    'Hope that helps')
    UNREAD_ROWS = (
        "  L3's line question (attempt 1, round 1) was asked first, and the "
        "reply to it never reached the grader. Why, verbatim:\n"
        "    - {why}\n"
        "  This question is asked because that line still has no accepted "
        "answer. The reason above is about the reply to that earlier "
        "question; how to answer this one is stated below.\n")
    REJECTED_ROWS = (
        "  L3's line question (attempt 1, round 1) was asked first, and its "
        "answer was REJECTED. The grader's reasons, verbatim:\n"
        "    - {why}\n"
        "  This question is asked because of that rejection; do not send back "
        "something the same reason would reject again.\n")

    def test_a_group_asked_for_after_an_unread_line_reply_does_not_call_it_rejected(self):
        # The review of the bug hunt's fixes, 2026-11-23. A line reply that
        # could not be read never reaches the grader. The group question asked
        # next still said "its answer was REJECTED. The grader's reasons,
        # verbatim:" over the reader's own notice, and closed "do not send
        # back something the same reason would reject again" under a notice
        # that says to send one line alone, on a question that takes one row
        # for each line.
        import dataclasses
        import quality.propose as PRM
        result, call, groups = self._hill_loop(
            dict(self.HILL_SPEC, L3=[self.UNREAD_REPLY]))
        self.assertEqual([k for k, _p in call.calls][:2], ['L3', 'group'])
        self.assertIn('last rejection: ' + PRM.UNREAD_LINE,
                      result.rounds[0].attempts[0].reason)
        first, asked = groups[0], call.calls[1][1]
        self.assertEqual(first.pivot_line_reasons, (PRM.UNREAD_LINE,))
        self.assertNotIn('its answer was REJECTED', asked)
        self.assertIn(self.UNREAD_ROWS.format(why=PRM.UNREAD_LINE), asked)
        self.assertTrue(first.pivot_line_unread)
        self.assertNotIn('No previous attempt was rejected', asked)
        # "Stated below" is true: the answer format follows the block.
        self.assertIn('\nHOW TO ANSWER\n',
                      asked[asked.find('how to answer this one'):])
        # A run held across this change still replays: the newest undo
        # restores the words the question had, byte for byte, and the older
        # undos go on from there as they did.
        # The order is what replay needs: this undo is applied before the one
        # that looks for the words of a rejected answer. No position in the
        # table is pinned, so a later entry moves nothing here.
        undos = [e[1] for e in LH.LEGACY_QUESTION_RENDERINGS]
        self.assertLess(undos.index(LH._legacy_pivot_rejection),
                        undos.index(LH._legacy_pivot_unread))
        was = PRM.render_group(dataclasses.replace(first, pivot_line_unread=False))
        self.assertIn(self.REJECTED_ROWS.format(why=PRM.UNREAD_LINE), was)
        older = LH.legacy_question_texts('propose_group', asked)
        self.assertEqual(older[0], was)
        self.assertEqual(older[1:], LH.legacy_question_texts('propose_group', was))
        self.assertIn('  No previous attempt was rejected on this line in this '
                      'round.\n', older[2])
        # An answer the grader did reject keeps its words and needs no undo,
        # and a line question has no such block.
        graded = self._hill_loop()
        self.assertFalse(graded[2][0].pivot_line_unread)
        self.assertIn(self.REJECTED_ROWS.format(why='nothing was fixed'),
                      graded[1].calls[1][1])
        self.assertIsNone(LH._legacy_pivot_unread('propose_group',
                                                  graded[1].calls[1][1]))
        self.assertIsNone(LH._legacy_pivot_unread('propose', asked))
        # After an unread reply and then a graded one, the latest is the
        # grader's, and the group question says so.
        rv = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=2,
                                            backtrack_width=1))
        call2 = self._fake_writer(dict(
            self.HILL_SPEC, L3=[self.UNREAD_REPLY, self.HILL_SPEC['L3'][0]]))
        writer, groups2 = PRM.ModelProposer(call2), []

        def propose_group(group_brief):
            groups2.append(group_brief)
            return writer.propose_group(group_brief)
        with contextlib.redirect_stdout(io.StringIO()):
            revise_loop(rv, list(self.HILL),
                        mandate('ABAB', n_lines=4, default_relation='class:ASSONANCE'),
                        propose=writer.propose, propose_group=propose_group)
        self.assertEqual([k for k, _p in call2.calls][:3], ['L3', 'L3', 'group'])
        self.assertEqual(groups2[0].pivot_line_reasons, ('nothing was fixed',))
        self.assertFalse(groups2[0].pivot_line_unread)

    def test_a_reply_that_is_not_one_line_is_not_called_a_rejected_answer_either(self):
        # The same on the other way a reply never reaches the grader: a
        # caller's own proposer hands back text with a line break in it, and
        # on the question that asks for a group together with its copies.
        import dataclasses
        import quality.propose as PRM
        draft = self.HILL + [self.HILL[2]]
        m = mandate([[1, 3], [2, 4]], n_lines=5, returns=[[3, 5]],
                    default_relation='class:ASSONANCE')
        rv = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=1,
                                            backtrack_width=1))
        groups = []

        def propose(brief, lines, attempt, reasons=None, whole=()):
            return 'My kettle whistles\nby the door again'

        def propose_group(group_brief):
            groups.append(group_brief)
            return None
        with contextlib.redirect_stdout(io.StringIO()):
            revise_loop(rv, list(draft), m, propose=propose,
                        propose_group=propose_group)
        first = groups[0]
        self.assertTrue(first.whole_repair)
        self.assertEqual(first.pivot_line_reasons,
                         ('the answer was more than one line',))
        asked = PRM.render_group(first)
        self.assertTrue(asked.startswith('REPAIR THE DECLARED REQUIREMENTS'))
        self.assertNotIn('its answer was REJECTED', asked)
        self.assertIn(self.UNREAD_ROWS.format(
            why='the answer was more than one line'), asked)
        # "Stated below" is true on this question too, which has no heading
        # over its answer format.
        self.assertIn('\nReturn exactly these lines (include unchanged '
                      'members): L1, L3, L5\n',
                      asked[asked.find('how to answer this one'):])
        self.assertTrue(first.pivot_line_unread)
        self.assertEqual(
            LH.legacy_question_texts('propose_group', asked)[0],
            PRM.render_group(dataclasses.replace(
                first, pivot_line_unread=False)))

    # What a question asked again says over the reasons for the last try:
    # the words for a try the grader never read, and the words for one it
    # read and rejected.
    NEVER_GRADED_ROWS = (
        "  The PREVIOUS attempt never reached the grader. Why, verbatim:\n"
        "    - {why}\n"
        "  Do not send back a reply the same reason would stop again.\n")
    WAS_REJECTED_ROWS = (
        "  The PREVIOUS attempt was REJECTED. The grader's reasons, "
        "verbatim:\n"
        "    - {why}\n"
        "  Do not send back something the same reason would reject again.\n")

    @staticmethod
    def _attempt_rows(question):
        """-> the rows of `question` under its attempt row, to the next
        blank row."""
        at = question.index('\n', question.index('  This is ATTEMPT ')) + 1
        return question[at:question.index('\n\n', at) + 1]

    def test_a_try_the_grader_never_read_is_not_called_a_rejected_attempt(self):
        # The review of the bug hunt's fixes, 2026-11-23. The loop passes
        # some replies over before the grader reads them: one it could not
        # read, one that is not one line of text for each line asked for, one
        # with the wrong number of lines. Each uses its attempt and the
        # question is asked again with the reason. That question said "The
        # PREVIOUS attempt was REJECTED. The grader's reasons, verbatim:"
        # over a reason the grader never wrote.
        import dataclasses
        import quality.propose as PRM
        # A line reply the writer's reader could not read.
        result, call = self._door_loop(
            {'L2': ['Here is my line:\n' + self.STOVE, self.STOVE]}, attempts=3)
        unread_line = call.calls[1][1]
        self.assertEqual(self._attempt_rows(unread_line),
                         self.NEVER_GRADED_ROWS.format(why=PRM.UNREAD_LINE))
        self.assertEqual(result.lines[1], self.STOVE)
        # A line answer from a caller's own proposer that is not one line of
        # text.
        m = mandate('AA', n_lines=2, default_relation='class:ASSONANCE')
        held = []
        for first, why in (('My kettle whistles\nby the stove',
                            'the answer was more than one line'),
                           (42, 'the answer was not text'),
                           ('   ', 'the answer was empty')):
            with self.subTest(answer=first):
                rv = Reviser(rdecl=ReviseDeclaration(
                    max_rounds=1, attempts_per_line=2, backtrack_width=0))
                asked = []

                def propose(brief, lines, attempt, reasons=None, whole=()):
                    asked.append((brief, list(lines), attempt, reasons, whole))
                    return (first, self.STOVE)[attempt]
                with contextlib.redirect_stdout(io.StringIO()):
                    revise_loop(rv, list(self.DOOR), m, propose=propose)
                brief, lines, attempt, reasons, whole = asked[1]
                now = PRM.render_line(brief, lines, whole=whole,
                                      attempt=attempt, reasons=reasons)
                self.assertEqual(self._attempt_rows(now),
                                 self.NEVER_GRADED_ROWS.format(why=why))
                # The same reasons handed over as plain text are quoted as a
                # rejection, which is how the question read before.
                held.append(('propose', now, PRM.render_line(
                    brief, lines, whole=whole, attempt=attempt,
                    reasons=[str(r) for r in reasons]), why))
        # A group answer, on the question that asks for a group together
        # with its copies: unreadable, not one line of text for each line,
        # and the wrong number of lines.
        draft = self.HILL + [self.HILL[2]]
        m5 = mandate([[1, 3], [2, 4]], n_lines=5, returns=[[3, 5]],
                     default_relation='class:ASSONANCE')
        for first, why in (
                (PRM.UnreadReply(PRM.UNREAD_GROUP), PRM.UNREAD_GROUP),
                ('L1, L3 and L5', 'the answer was not a list of lines, one '
                                  'for each line asked for'),
                ((self.HILL[0], 7, self.HILL[2]), 'L3: the answer was not text'),
                ((self.HILL[0],), 'proposer returned 1 line(s) for atomic '
                                  'group {label}, which has {size} member(s) '
                                  '— one line per GroupBrief.members entry')):
            with self.subTest(group=str(first)[:30]):
                rv = Reviser(rdecl=ReviseDeclaration(
                    max_rounds=1, attempts_per_line=1, backtrack_width=2))
                groups = []

                def propose_group(group_brief):
                    groups.append(group_brief)
                    return first if len(groups) == 1 else None
                with contextlib.redirect_stdout(io.StringIO()):
                    revise_loop(rv, list(draft), m5,
                                propose=lambda *a, **k: None,
                                propose_group=propose_group)
                again = groups[1]
                self.assertEqual((again.members, again.attempt),
                                 (groups[0].members, 1),
                                 'PREMISE: the same group is asked again')
                why = why.format(label=again.label, size=len(again.members))
                now = PRM.render_group(again)
                self.assertTrue(now.startswith('REPAIR THE DECLARED REQUIREMENTS'))
                self.assertEqual(self._attempt_rows(now),
                                 self.NEVER_GRADED_ROWS.format(why=why))
                held.append(('propose_group', now, PRM.render_group(
                    dataclasses.replace(again, reasons=tuple(
                        str(r) for r in again.reasons))), why))
        # A try the grader read and turned down keeps the words it had, and
        # needs no undo.
        rv = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=2,
                                            backtrack_width=0))
        call = self._fake_writer({'L3': self.HILL_SPEC['L3'] * 2})
        with contextlib.redirect_stdout(io.StringIO()):
            revise_loop(rv, list(self.HILL),
                        mandate('ABAB', n_lines=4, default_relation='class:ASSONANCE'),
                        propose=PRM.ModelProposer(call).propose)
        self.assertEqual([k for k, _p in call.calls][:2], ['L3', 'L3'])
        graded = call.calls[1][1]
        self.assertEqual(self._attempt_rows(graded),
                         self.WAS_REJECTED_ROWS.format(why='nothing was fixed'))
        self.assertIsNone(LH._legacy_attempt_not_graded('propose', graded))
        # A run held across this change still replays: the newest undo
        # restores the words each question had, byte for byte, and the older
        # undos go on from there as they did. It is applied before the undos
        # that were there already; no position in the table is pinned.
        undos = [e[1] for e in LH.LEGACY_QUESTION_RENDERINGS]
        self.assertLess(undos.index(LH._legacy_pivot_unread),
                        undos.index(LH._legacy_attempt_not_graded))
        self.assertEqual(len(held), 7)
        for kind, now, was, why in held:
            with self.subTest(undo=why):
                self.assertEqual(self._attempt_rows(was),
                                 self.WAS_REJECTED_ROWS.format(why=why))
                self.assertEqual(
                    was, now.replace(self.NEVER_GRADED_ROWS.format(why=why),
                                     self.WAS_REJECTED_ROWS.format(why=why)),
                    'nothing else in the question moved')
                older = LH.legacy_question_texts(kind, now)
                self.assertEqual(older[0], was)
                self.assertEqual(older[1:], LH.legacy_question_texts(kind, was))
        # The group question that follows a line reply nobody read has its
        # own rows and its own undo; this one leaves it alone.
        after_unread = self._hill_loop(
            dict(self.HILL_SPEC, L3=[self.UNREAD_REPLY]))[1].calls[1][1]
        self.assertIn('the reply to it never reached the grader', after_unread)
        self.assertIsNone(
            LH._legacy_attempt_not_graded('propose_group', after_unread))

    def test_a_run_held_at_a_question_asked_again_still_finds_its_answers(self):
        # The same change, across a stop and a start. The journal keeps the
        # hash of each question and replays an answer only to the same
        # question, and the loop rebuilds every question as it walks the
        # journal again. So the mark on a reason has to come back on the
        # second walk exactly as it was made on the first, and a journal
        # written while the question still said "REJECTED" has to be found
        # by undoing the new words.
        import quality.propose as PRM
        m = mandate('AA', n_lines=2, default_relation='class:ASSONANCE')
        replies = [PRM.UnreadReply(PRM.UNREAD_LINE), self.STOVE]
        calls, asked = [], []

        def writer(brief, lines, attempt, reasons=None, whole=()):
            calls.append(attempt)
            return replies[len(calls) - 1]
        real_render = PRM.render_line

        def spy(*a, **k):
            asked.append(real_render(*a, **k))
            return asked[-1]

        def before_the_change(*a, **k):
            # The question as the build before this change printed it: the
            # loop's own reason arrived as plain text.
            if k.get('reasons'):
                k = dict(k, reasons=[str(r) for r in k['reasons']])
            return spy(*a, **k)

        def run(render):
            rv = Reviser(rdecl=ReviseDeclaration(
                max_rounds=1, attempts_per_line=2, backtrack_width=0))
            with patch.object(PRM, 'render_line', render):
                one, _ = LH._checkpoint_proposer(
                    writer, None, list(self.DOOR), 'config', 'fake')
                return revise_loop(rv, list(self.DOOR), m, propose=one)
        for held_by, render in (('this build', spy),
                                ('the build before', before_the_change)):
            with self.subTest(held_by=held_by), \
                 tempfile.TemporaryDirectory() as tmp, \
                 patch.dict(os.environ, {
                     'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp.json')}), \
                 contextlib.redirect_stdout(io.StringIO()):
                del calls[:], asked[:]
                first = run(render)
                self.assertEqual(calls, [0, 1])
                self.assertEqual(first.lines, [self.DOOR[0], self.STOVE])
                journal = json.loads((Path(tmp)/'cp.json').read_text())
                self.assertEqual(
                    [(p.get('unread'), p['answer']) for p in journal['proposals']],
                    [(PRM.UNREAD_LINE, None), (None, self.STOVE)])
                self.assertEqual(
                    self._attempt_rows(asked[1]),
                    (self.NEVER_GRADED_ROWS if render is spy
                     else self.WAS_REJECTED_ROWS).format(why=PRM.UNREAD_LINE))
                # Started again by this build: the unread reply is read off
                # the journal, the second question is rebuilt with the words
                # of this build, and its answer is found.
                del asked[:]
                again = run(spy)
                self.assertEqual(calls, [0, 1],
                                 'the second run made no writer request')
                self.assertEqual(again.lines, first.lines)
                self.assertEqual(
                    self._attempt_rows(asked[1]),
                    self.NEVER_GRADED_ROWS.format(why=PRM.UNREAD_LINE))

    # -- 2026-11-23: a rejection reason names its findings in words --------
    # A line answer that trades one fault for another is rejected, and the
    # next question quotes the grader's reason. That reason printed the
    # grader's own records of the new findings as Python wrote them, so a
    # writer read "[(3, 'SCHEME_VIOLATION', 'flag', (1, 3), ('A',), ())]".
    # Three lines in one rhyme group; L3 repeats L1's end word.
    GATE = ['The lantern swings above the gate',
            'We count the hours and we wait',
            'The river carries off the gate']
    GATE_SPEC = {'L3': ['The river carries off the kitchen',
                        'The river carries off the late']}
    GATE_OLD_ROW = ("    - introduced 2 new flagged finding(s) [(3, "
                    "'SCHEME_VIOLATION', 'flag', (1, 3), ('A',), ()), (3, "
                    "'SCHEME_VIOLATION', 'flag', (2, 3), ('A',), ())] while "
                    "fixing 1; a revision may not trade one defect for "
                    "another\n")
    GATE_NEW_ROW = ("    - introduced 2 new flagged finding(s) "
                    "(SCHEME_VIOLATION on lines 1 and 3, group A; "
                    "SCHEME_VIOLATION on lines 2 and 3, group A) while fixing "
                    "1; a revision may not trade one defect for another\n")

    def _gate_run(self, checkpointed=False):
        """-> (result, the fake writer). The writer answers L3 twice: first
        with a word that rhymes with nothing, then with one that does."""
        from quality.propose import ModelProposer
        m = mandate([[1, 2, 3]], n_lines=3, default_relation='class:RHYME')
        rv = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=3,
                                            backtrack_width=1))
        call = self._fake_writer(self.GATE_SPEC)
        writer = ModelProposer(call)
        one, two = writer.propose, writer.propose_group
        if checkpointed:
            one, two = LH._checkpoint_proposer(one, two, list(self.GATE),
                                               'config', 'fake')
        result = revise_loop(rv, list(self.GATE), m, propose=one,
                             propose_group=two)
        return result, call

    def test_a_rejection_names_its_findings_in_words(self):
        with contextlib.redirect_stdout(io.StringIO()):
            result, call = self._gate_run()
        self.assertEqual(result.lines[2], self.GATE_SPEC['L3'][1])
        asked = [p for k, p in call.calls if k == 'L3']
        self.assertEqual(len(asked), 2)
        self.assertIn("  The PREVIOUS attempt was REJECTED. The grader's "
                      "reasons, verbatim:\n" + self.GATE_NEW_ROW, asked[1])
        for question in (p for _k, p in call.calls):
            for python_text in ("[(", "'flag'", "('A',)", "())"):
                self.assertNotIn(python_text, question)

    def test_a_finding_is_put_in_words_whatever_it_is_about(self):
        import quality.propose as PRM
        words = PRM.findings_in_words
        self.assertEqual(words([(3, 'SCHEME_VIOLATION', 'flag', (1, 3), ('A',), ())]),
                         'SCHEME_VIOLATION on lines 1 and 3, group A')
        # The whole draft, one line, a line whose record names no other
        # line, three lines, two groups, a group with no name, and a record
        # that carries more than its lines and groups.
        self.assertEqual(
            words({(0, 'LEXICAL_MONOTONY', 'flag', (), (), ()),
                   (3, 'RETURN_NOT_VERBATIM', 'flag', (1, 3), ('',), ()),
                   (5, 'SLOTS_EXCEEDED', 'flag', (5,), (), ()),
                   (4, 'UNREADABLE_END_WORD', 'flag', (), (), ()),
                   (2, 'SCHEME_VIOLATION', 'flag', (2, 6, 9), ('A', 'B'), ()),
                   (0, 'HOOK_ABSENT', 'flag', (), (), ('hook', 0))}),
            'HOOK_ABSENT on the whole draft, hook 1; '
            'LEXICAL_MONOTONY on the whole draft; '
            'SCHEME_VIOLATION on lines 2, 6 and 9, groups A and B; '
            'RETURN_NOT_VERBATIM on lines 1 and 3; '
            'UNREADABLE_END_WORD on line 4; '
            'SLOTS_EXCEEDED on line 5')
        self.assertEqual(words(()), '')

    def test_a_finding_says_which_requirement_when_its_lines_do_not(self):
        # Two findings can share a code, their lines and their groups and
        # still be about two requirements: the record says which. The old
        # text printed that record raw; the words must not lose it, or a
        # writer with two declared hooks reads the same row twice.
        import quality.propose as PRM
        words = PRM.findings_in_words
        self.assertEqual(
            words({(0, 'HOOK_ABSENT', 'flag', (), (), ('hook', 0)),
                   (0, 'HOOK_ABSENT', 'flag', (), (), ('hook', 1))}),
            'HOOK_ABSENT on the whole draft, hook 1; '
            'HOOK_ABSENT on the whole draft, hook 2')
        # A check of the chosen form names itself the way its own finding
        # does (`Reviser.inspect` writes "<form>: <check> at <place>").
        self.assertEqual(
            words({(3, 'CATALOG_FORM_MISMATCH', 'flag', (3, 4), (),
                    ('catalog:form-x:part-bars:section[2]',)),
                   (3, 'CATALOG_FORM_MISMATCH', 'flag', (3, 4), (),
                    ('catalog:form-x:ending:A1',))}),
            'CATALOG_FORM_MISMATCH on lines 3 and 4, form check '
            'form-x:ending:A1; '
            'CATALOG_FORM_MISMATCH on lines 3 and 4, form check '
            'form-x:part-bars:section[2]')
        # A record these words have no name for is still COUNTED: two
        # findings never read as one, and none is printed as Python wrote it.
        both = words({(2, 'SOME_CODE', 'flag', (2,), ('A',), ('x', ('y', 3))),
                      (2, 'SOME_CODE', 'flag', (2,), ('A',), ('x', ('z', 4))),
                      (5, 'SOME_CODE', 'flag', (5,), ('A',), ('x', ('y', 3)))})
        self.assertEqual(both, 'SOME_CODE on line 2, group A (2 findings); '
                               'SOME_CODE on line 5, group A')
        # The real records, every shape `Reviser.inspect` writes today.
        for subject in (('hook', 0), ('catalog:form-x:ending:A1',),
                        ('unanchored_member', 3, 'gate', 'end'),
                        ('unreadable_anchor', 3, 4),
                        ('strict', 'gate', 'late', 'A1', 'A2')):
            text = words({(3, 'SOME_CODE', 'flag', (1, 3), ('A',), subject)})
            self.assertFalse(set("()'\"") & set(text.replace('section[', '')),
                             (subject, text))
        self.assertNotIn('[', words({(0, 'HOOK_ABSENT', 'flag', (), (),
                                      ('hook', 0))}))

    def test_the_other_two_reasons_print_no_python_list_either(self):
        import quality.propose as PRM
        keep = dict(PRM.LEGACY_REASONS)
        PRM.LEGACY_REASONS.clear()
        self.addCleanup(PRM.LEGACY_REASONS.update, keep)
        self.addCleanup(PRM.LEGACY_REASONS.clear)
        m = mandate([[1, 2, 3]], n_lines=3, default_relation='class:RHYME')
        stray = self.rv.verify(
            self.GATE, [self.GATE[0], 'We count the hours and we stay',
                        'The river carries off the late'], m, targeted=[3])
        self.assertEqual(stray['reasons'],
                         ['lines 2 were changed but not targeted; revise '
                          'flagged lines only'])
        # What a journal written before 2026-11-23 hashed is kept beside the
        # new words. These two literals are what main 83c28ec4d printed for
        # these two calls, copied from a run of that tree.
        self.assertEqual(
            PRM.LEGACY_REASONS[stray['reasons'][0]],
            'lines [2] were changed but not targeted; revise flagged lines '
            'only')

        # A requirement that HOLDS is a finding too, and ending one is not a
        # repair. The reason listed those the same way.
        def found(fs):
            return {'per_line': {2: fs}, 'whole': [],
                    'grade': {'pairs_mandated': 1, 'pairs_judged': 1,
                              'pairs_refused': 0, 'refused_obligations': []}}
        held = Finding('REFRAIN_REPEAT', 'note', '', '', [1, 2], ('R',))
        with patch.object(self.rv, 'brief', return_value=[]), \
             patch.object(self.rv, 'inspect',
                          side_effect=[found([held]), found([])]):
            out = self.rv.verify(['one', 'two'], ['one', 'changed'], 'AA', {2})
        self.assertFalse(out['accepted'])
        self.assertEqual(
            out['reasons'],
            ['nothing was fixed — the only finding(s) removed were '
             '(REFRAIN_REPEAT on lines 1 and 2, group R), which record a '
             'requirement or licence HOLDING, so ending one is a regression '
             'and not a repair'])
        self.assertEqual(
            PRM.LEGACY_REASONS[out['reasons'][0]],
            "nothing was fixed — the only finding(s) removed were [(2, "
            "'REFRAIN_REPEAT', 'note', (1, 2), ('R',), ())], which record a "
            "requirement or licence HOLDING, so ending one is a regression "
            "and not a repair")

    def test_a_run_held_at_a_question_that_quoted_the_list_still_replays(self):
        # The journal keeps the hash of each question, and the second L3
        # question quotes the reason. A journal written while the reason
        # printed the list has to be found by undoing the new words: the old
        # text is kept beside each new reason as the grader writes it, and
        # the undo puts it back, byte for byte.
        import quality.propose as PRM
        undos = [e[1] for e in LH.LEGACY_QUESTION_RENDERINGS]
        self.assertLess(undos.index(LH._legacy_attempt_not_graded),
                        undos.index(LH._legacy_reason_lists))

        def as_before(keys):
            # What the build before this change put in the reason.
            return str(sorted(keys))
        for held_by, old_build in (('this build', False),
                                   ('the build before', True)):
            with self.subTest(held_by=held_by), \
                 tempfile.TemporaryDirectory() as tmp, \
                 patch.dict(os.environ, {
                     'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp.json')}), \
                 contextlib.redirect_stdout(io.StringIO()):
                if old_build:
                    with patch.object(PRM, 'named_findings', as_before), \
                         patch.object(PRM, 'legacy_reason', lambda new, old: None):
                        first, call = self._gate_run(checkpointed=True)
                else:
                    first, call = self._gate_run(checkpointed=True)
                held = [p for k, p in call.calls if k == 'L3'][1]
                self.assertIn(self.GATE_OLD_ROW if old_build
                              else self.GATE_NEW_ROW, held)
                journal = json.loads((Path(tmp)/'cp.json').read_text())
                self.assertEqual(len(journal['proposals']), len(call.calls))
                PRM.LEGACY_REASONS.clear()
                again, second = self._gate_run(checkpointed=True)
                self.assertEqual(second.calls, [],
                                 'the second run made no writer request')
                self.assertEqual(again.lines, first.lines)
        # The undo itself, on the question this build asks: the row goes
        # back to the old bytes and nothing else moves.
        with contextlib.redirect_stdout(io.StringIO()):
            _result, call = self._gate_run()
        now = [p for k, p in call.calls if k == 'L3'][1]
        self.assertEqual(LH._legacy_reason_lists('propose', now),
                         now.replace(self.GATE_NEW_ROW, self.GATE_OLD_ROW))
        self.assertIsNone(LH._legacy_reason_lists('grade', now))
        self.assertIsNone(LH._legacy_reason_lists(
            'propose', [p for k, p in call.calls if k == 'L3'][0]))

    def test_a_group_question_that_quoted_the_list_is_undone_too(self):
        # One try a line, so the loop goes from L3's refused answer straight
        # to L3's whole group, and that question quotes the line's reason.
        import quality.propose as PRM
        from quality.propose import ModelProposer
        spec = {'L3': ['The river carries off the kitchen'] * 2,
                'group': ['L1: The lantern swings above the kitchen\n'
                          'L2: We count the hours and we wait\n'
                          'L3: The river carries off the garden'] * 2}

        def run():
            m = mandate([[1, 2, 3]], n_lines=3, default_relation='class:RHYME')
            rv = Reviser(rdecl=ReviseDeclaration(
                max_rounds=1, attempts_per_line=1, backtrack_width=1))
            call = self._fake_writer(spec)
            writer = ModelProposer(call)
            with contextlib.redirect_stdout(io.StringIO()):
                revise_loop(rv, list(self.GATE), m, propose=writer.propose,
                            propose_group=writer.propose_group)
            return [p for k, p in call.calls if k == 'group']

        # Every group question prints the grader's eight reasons as a list,
        # so the one that QUOTES a refusal is found by "while fixing 1".
        quoting = lambda qs: [q for q in qs if ') while fixing 1;' in q
                              or '] while fixing 1;' in q]
        # Its own table of old texts, so no other test's rows are read here.
        keep = dict(PRM.LEGACY_REASONS)
        PRM.LEGACY_REASONS.clear()
        self.addCleanup(PRM.LEGACY_REASONS.update, keep)
        self.addCleanup(PRM.LEGACY_REASONS.clear)
        now = quoting(run())
        with patch.object(PRM, 'named_findings',
                          lambda keys: str(sorted(keys))), \
             patch.object(PRM, 'legacy_reason', lambda new, old: None):
            was = quoting(run())
        self.assertEqual(len(now), 1)
        self.assertEqual(len(was), 1)
        for asked, before in zip(now, was):
            self.assertIn("L3's line question (attempt 1, round 1) was asked "
                          "first, and its answer was REJECTED. The grader's "
                          "reasons, verbatim:\n" + self.GATE_NEW_ROW, asked)
            self.assertNotIn("[(", asked)
            self.assertIn(self.GATE_OLD_ROW, before)
            self.assertEqual(LH._legacy_reason_lists('propose_group', asked),
                             before)
            self.assertEqual(
                LH.legacy_question_texts('propose_group', asked)[0], before)

        # Every block that quotes a reason prints it as the same kind of
        # row, so one undo serves them all: this try's rejection, last
        # round's, and the rejected line answer a group question follows.
        new, old = self.GATE_NEW_ROW.strip()[2:], self.GATE_OLD_ROW.strip()[2:]
        self.assertEqual(PRM.LEGACY_REASONS.get(new), old)
        earlier = lambda r: {'round': 1, 'text': 'x', 'reasons': [r]}
        for block in (lambda r: PRM._attempt_block(1, [r]),
                      lambda r: PRM._attempt_block(0, [], prior=earlier(r)),
                      lambda r: PRM._attempt_block(
                          0, [], prior=earlier(r), what='group rewrite')):
            text = '\n'.join(block(new)) + '\n'
            self.assertIn(new, text)
            self.assertEqual(LH._legacy_reason_lists('propose', text),
                             '\n'.join(block(old)) + '\n')

    def test_two_old_reasons_under_one_new_text_are_not_undone(self):
        # The words leave out part of the grader's record, so two different
        # records can read the same. Then no old text is known to be the one
        # that was asked, the row is left alone, and a held run parks as it
        # does for any question that changed. Wrong bytes are never offered.
        import quality.propose as PRM
        with patch.dict(PRM.LEGACY_REASONS, clear=True):
            PRM.legacy_reason('same words', 'old text one')
            row = "  heading\n    - same words\n  after\n"
            self.assertEqual(LH._legacy_reason_lists('propose', row),
                             "  heading\n    - old text one\n  after\n")
            PRM.legacy_reason('same words', 'old text one')
            self.assertEqual(LH._legacy_reason_lists('propose_group', row),
                             "  heading\n    - old text one\n  after\n")
            PRM.legacy_reason('same words', 'old text two')
            self.assertIsNone(LH._legacy_reason_lists('propose', row))
            PRM.legacy_reason('same words', 'old text one')
            self.assertIsNone(LH._legacy_reason_lists('propose', row))
            # The table is bounded: the oldest entry leaves first.
            for n in range(PRM.LEGACY_REASONS_CAP + 5):
                PRM.legacy_reason(f'new {n}', f'old {n}')
            self.assertEqual(len(PRM.LEGACY_REASONS), PRM.LEGACY_REASONS_CAP)
            self.assertNotIn('same words', PRM.LEGACY_REASONS)
            # A row written again is the newest, so it is not the next out.
            PRM.LEGACY_REASONS.clear()
            PRM.legacy_reason('written twice', 'its old text')
            for n in range(PRM.LEGACY_REASONS_CAP - 1):
                PRM.legacy_reason(f'new {n}', f'old {n}')
            PRM.legacy_reason('written twice', 'its old text')
            PRM.legacy_reason('one more', 'old')
            self.assertEqual(PRM.LEGACY_REASONS.get('written twice'),
                             'its old text')
            self.assertNotIn('new 0', PRM.LEGACY_REASONS)
            self.assertEqual(len(PRM.LEGACY_REASONS), PRM.LEGACY_REASONS_CAP)

    def test_every_reason_the_loop_writes_itself_is_marked_as_its_own(self):
        # The reasons a question asked again quotes come from two places: a
        # verdict (the grader's), or the loop, for a reply it passed over
        # before the grader read it. The loop marks its own where it makes
        # them, and the question says whose they are from that mark. This
        # reads the three functions that hand reasons on and holds every
        # assignment to one form or the other, so a new one cannot quietly
        # be printed as the grader's.
        import ast
        import inspect
        import textwrap
        import quality.loop as LP
        def assigned(node):
            # Each (name, value) an assignment makes, a tuple taken apart.
            for target in node.targets:
                if isinstance(target, ast.Name):
                    yield target.id, node.value
                elif isinstance(target, ast.Tuple) and isinstance(
                        node.value, ast.Tuple):
                    for name, value in zip(target.elts, node.value.elts):
                        if isinstance(name, ast.Name):
                            yield name.id, value
        own, graded, other = [], [], []
        for fn in (LP._try_tier1, LP._try_tier2, LP.revise_loop):
            src = textwrap.dedent(inspect.getsource(fn))
            for node in ast.walk(ast.parse(src)):
                if not isinstance(node, ast.Assign):
                    continue
                for name, made in assigned(node):
                    value = ast.get_source_segment(src, made)
                    if name not in ('reasons', '_reasons') or value == 'None':
                        continue
                    where = f'{fn.__name__}: {" ".join(value.split())[:70]}'
                    if '_NotGraded(' in value:
                        own.append(where)
                    elif re.search(r'\b_?(res|v)\b[^\n]*["\']reasons["\']',
                                   value):
                        graded.append(where)
                    else:
                        other.append(where)
        self.assertEqual(other, [], 'reasons that are neither read off a '
                         'verdict nor marked as the loop\'s own')
        self.assertTrue(own and graded, (own, graded))
        # A marked reason is still its text.
        mark = LP._NotGraded('the answer was empty')
        self.assertEqual(mark, 'the answer was empty')
        self.assertEqual(json.dumps([mark]), '["the answer was empty"]')
        self.assertIs(type(str(mark)), str)
        self.assertTrue(LP._not_graded([mark]))
        self.assertFalse(LP._not_graded([mark, 'nothing was fixed']))
        self.assertFalse(LP._not_graded(['the answer was empty']))
        self.assertFalse(LP._not_graded(None))

    def test_a_return_group_asked_for_after_a_rejected_line_says_so_too(self):
        # Finding 5, on the other question a rejected line answer leads to.
        # When a member of the group also returns word for word elsewhere,
        # the loop asks for the group and every copy together, under the
        # heading REPAIR THE DECLARED REQUIREMENTS. That question carried the
        # same false sentence (reproduced on the raw engine by the planner
        # owner, 2026-11-21).
        import dataclasses
        import quality.propose as PRM
        from quality.propose import ModelProposer
        draft = self.HILL + [self.HILL[2]]
        m = mandate([[1, 3], [2, 4]], n_lines=5, returns=[[3, 5]],
                    default_relation='class:ASSONANCE')
        rv = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=1,
                                            backtrack_width=1))
        call = self._fake_writer({'L3': ['My kettle whistles by the door again']})
        writer, groups = ModelProposer(call), []

        def propose_group(group_brief):
            groups.append(group_brief)
            return writer.propose_group(group_brief)
        with contextlib.redirect_stdout(io.StringIO()):
            result = revise_loop(rv, list(draft), m, propose=writer.propose,
                                 propose_group=propose_group)
        self.assertEqual([k for k, _p in call.calls][:2], ['L3', 'group'])
        self.assertIn('last rejection: nothing was fixed',
                      result.rounds[0].attempts[0].reason)
        first = groups[0]
        self.assertTrue(first.whole_repair)
        self.assertEqual(first.members, (1, 3, 5))
        asked = call.calls[1][1]
        self.assertTrue(asked.startswith('REPAIR THE DECLARED REQUIREMENTS'))
        self.assertNotIn('No previous attempt was rejected', asked)
        self.assertIn("  L3's line question (attempt 1, round 1) was asked "
                      "first, and its answer was REJECTED. The grader's "
                      "reasons, verbatim:\n    - nothing was fixed\n", asked)
        before = PRM.render_group(dataclasses.replace(first, pivot_line_reasons=()))
        self.assertIn('  No previous attempt was rejected on this line in this '
                      'round.\n', before)
        # REPINNED 2026-11-21 (bug hunt finding 2):
        # ~~legacy_question_texts(...)[0] == before~~. This question now
        # prints the rule its groups declare, under a newer undo; the wording
        # a held run was asked is the second undo, and `before` is compared
        # with its rule rows taken out the same way.
        self.assertEqual(LH.legacy_question_texts('propose_group', asked)[1],
                         LH._legacy_group_rules('propose_group', before))
        # L4's own line question got no answer, so its group question still
        # says, truly, that no attempt was rejected.
        later = [p for k, p in call.calls if k == 'group'][1]
        self.assertIn('No previous attempt was rejected', later)

    def test_a_declared_structure_is_not_reported_as_a_registry_schema(self):
        # Finding 9. A group that declares a catalog structure is recorded as
        # satisfied by the structure's own name. The report read that name as
        # a registry schema, so two clean declared rhymes came back as
        # "2 mandated pair(s) stand in at least one registry schema ...
        # laziness at these relations is UNCALIBRATED" and "not heard as end
        # rhyme: L1~L2: masculine-rhyme; L3~L4: perfect-rhyme".
        from quality.relations import REGISTRY
        lines = ['we climbed together up the hill',
                 'the evening air was very still',
                 'we walked together into town',
                 'and watched the sun go slowly down']
        m = mandate([[1, 2], [3, 4]], n_lines=4,
                    structures={'A': 'masculine-rhyme', 'B': 'perfect-rhyme'})
        with contextlib.redirect_stdout(io.StringIO()):
            records = Reviser().grade(lines, m)['pairs_schema_satisfied']
        self.assertEqual([(tuple(r['lines']), r['satisfied_by'])
                          for r in records],
                         [((1, 2), ['masculine-rhyme']),
                          ((3, 4), ['perfect-rhyme'])])
        self.assertNotIn('masculine-rhyme', REGISTRY)
        self.assertNotIn('perfect-rhyme', REGISTRY)
        self.assertEqual([LH._record_schemas(r) for r in records], [[], []])
        self.assertIsNone(LH.schema_default_disclosure(records))
        # What the block is for still prints: a registry schema is listed,
        # under its bare name or the declared spelling, and the structure
        # beside it is not.
        self.assertIn('perfect rhyme', REGISTRY)
        self.assertEqual(LH._record_schemas(
            {'satisfied_by': ['RHYME', 'class:RHYME', 'masculine-rhyme',
                              'perfect rhyme', 'schema:subtractive rhyme']}),
            ['perfect rhyme', 'subtractive rhyme'])
        said = LH.schema_default_disclosure(
            [{'lines': [1, 2], 'label': 'A',
              'satisfied_by': ['masculine-rhyme', 'perfect rhyme']}])
        self.assertIn('L1~L2 (group A): perfect rhyme', said)
        self.assertNotIn('masculine-rhyme', said)
        # A structure that shares its name with a registry schema is still
        # listed under that name, and so is a name nothing resolves.
        from quality.structures import names
        self.assertIn('pararhyme', names())
        self.assertIn('pararhyme', REGISTRY)
        self.assertEqual(LH._record_schemas(
            {'satisfied_by': ['pararhyme', 'no such schema']}),
            ['pararhyme', 'no such schema'])

    def test_the_partition_verb_puts_each_line_in_its_own_place(self):
        # Finding 36. Lines 1-2 rhyme and lines 3-4 rhyme, which `chains`
        # reports. `partition` printed the scheme with the first line's
        # letter on the last line: RGS (0, 1, 1, 0), letters ABBA, named as
        # the enclosed scheme.
        root = Path(__file__).resolve().parents[1]
        draft = ['i walked the road alone', 'the leaves were all blown',
                 'a candle on the sill', 'the house was very still']
        ran = subprocess.run([sys.executable, 'lyric_harness.py', 'partition',
                              *draft], cwd=root, capture_output=True,
                             text=True, timeout=180)
        self.assertEqual(ran.returncode, 0, ran.stderr[-2000:])
        self.assertIn('  canonical RGS: (0, 0, 1, 1)\n', ran.stdout)
        self.assertIn('  letters:       AABB\n', ran.stdout)
        self.assertNotIn('ABBA', ran.stdout)
        # A draft whose rhymes do enclose still prints as enclosed.
        ran = subprocess.run([sys.executable, 'lyric_harness.py', 'partition',
                              draft[0], draft[2], draft[3], draft[1]],
                             cwd=root, capture_output=True, text=True,
                             timeout=180)
        self.assertIn('  letters:       ABBA\n', ran.stdout)

    def test_the_repeated_opening_message_counts_the_lines_it_lists(self):
        # Finding 34, the count. 15 of 22 lines open with the same word; the
        # message said "14 of 22" over a list of 15 lines, because the count
        # was rebuilt from the rate (15/22 x 22 is 14.99..., cut to 14).
        from quality.floor import SlopFloor
        ends = ('river mountain window garden hammer candle ladder blanket '
                'pocket lantern basket meadow thunder feather harbor copper '
                'silver marble timber velvet pillow button').split()
        lines = [('I see the %s' if i < 15 else 'we found a %s') % w
                 for i, w in enumerate(ends)]
        self.assertEqual(int(15 / 22 * 22), 14)
        (found,) = [f for f in SlopFloor().check(lines)
                    if f.code == 'ANAPHORA_OVERLOAD']
        self.assertEqual(found.locations, list(range(1, 16)))
        self.assertEqual(found.message,
                         '15 of 22 lines open with the same word')

    STREET = ['we walked along the street',
              'a quiet word was all i had',
              'the morning brings the meat',
              'the evening leaves me in the sun']
    ONLY_THIS_RULE = ('the consonant sound(s) after the vowel at the stressed '
                      'syllable is present in P and absent in Q')

    def _street_briefs(self, relations):
        m = mandate([[1, 3], [2, 4]], n_lines=4, relations=relations)
        return m, {b.line_no: b for b in Reviser().brief(list(self.STREET), m)}

    def test_the_revise_question_states_the_rule_a_declared_group_is_graded_by(self):
        # Finding 2. Group A declares a type, so the grader holds street/meat
        # to that type's rule and rejects it, although the two words rhyme.
        # The question for L3 said only "this line must stand in at least
        # one relation with: L1 ('street')". That is the rule of a group
        # that declares nothing, it is weaker than the one graded, and the
        # type's rule appeared nowhere in the question. A writer told that
        # sends another plain rhyme and is rejected again.
        import dataclasses
        import quality.propose as PRM
        from quality.plan import type_rule
        from quality.relations import REGISTRY, declared_pair_schema
        lines = list(self.STREET)
        m, briefs = self._street_briefs({'A': 'schema:subtractive rhyme'})
        self.assertEqual(sorted(briefs), [3, 4])
        # The clauses of the type as a declared pair is judged (2026-11-22:
        # the row is worded from that, a promoted final included).
        clauses = type_rule(declared_pair_schema(REGISTRY['subtractive rhyme']))
        self.assertIn(self.ONLY_THIS_RULE, clauses)
        asked = PRM.render_line(briefs[3], lines)
        rows = asked[asked.index('THE RHYME MANDATE ON L3'):
                     asked.index('LINES THAT MUST NOT CHANGE')]
        self.assertNotIn('at least one relation', rows)
        self.assertIn("  group A [1, 3] at its end word — this line must "
                      "satisfy the rule printed under this row with each of: "
                      "L1 ('street') — VIOLATED, this is the word to change\n"
                      "    RULE of group A (subtractive rhyme), where N and M "
                      "are any two lines of the group, N first, P is the "
                      "part of line N the rule reads and Q the part of line "
                      "M: ", rows)
        for clause in clauses:
            self.assertIn(clause, rows)
        # The grader's own report of the line gives the rule as well.
        self.assertIn(self.ONLY_THIS_RULE, str(briefs[3]))
        # Group B declares nothing. "At least one relation" is its rule, and
        # its question is the one it always was.
        plain = PRM.render_line(briefs[4], lines)
        self.assertIn("  group B [2, 4] at its end word — this line must stand "
                      "in at least one relation with: L2 ('had')", plain)
        self.assertNotIn('RULE of group', plain)
        self.assertEqual(briefs[4].group_rules, {})
        self.assertIsNone(LH._legacy_group_rules('propose', plain))
        # A run held before this change recorded the old wording's hash, and
        # undoing the change restores that wording exactly.
        before = PRM.render_line(dataclasses.replace(briefs[3], group_rules={}),
                                 lines)
        self.assertIn("this line must stand in at least one relation with: "
                      "L1 ('street')", before)
        self.assertEqual(LH.legacy_question_texts('propose', asked)[0], before)
        # REPINNED 2026-11-23 (the review of the bug hunt's fixes):
        # ~~LEGACY_QUESTION_RENDERINGS[-1][1] is `_legacy_group_rules`~~. One
        # more undo was added at the end (a line reply that was never read is
        # no longer called a rejected answer); it touches group questions
        # only, so this line question's newest undo is still this one. The
        # claim is the order: this undo comes after the rejected line
        # answer's.
        undos = [e[1] for e in LH.LEGACY_QUESTION_RENDERINGS]
        self.assertLess(undos.index(LH._legacy_pivot_rejection),
                        undos.index(LH._legacy_group_rules))

    def test_a_group_question_states_the_rule_its_lines_are_coupled_by(self):
        # Finding 2, on the question that asks for a group's lines together.
        # It said each line "must stand in a relation with what every OTHER
        # member binds on", for a group graded by a declared rule.
        import dataclasses
        from types import SimpleNamespace
        import quality.loop as LP
        import quality.propose as PRM
        lines = list(self.STREET)
        m, briefs = self._street_briefs({'A': 'schema:subtractive rhyme'})
        other = SimpleNamespace(line_no=1, text=lines[0], word='', offered=(),
                                calls=(), slot=None)
        group = LP.GroupBrief(3, lines[2], '', (), (other,), 'A', (1, 3),
                              briefs[3], tuple(lines), 0)
        asked = PRM.render_group(group)
        self.assertNotIn('must stand in a relation with what', asked)
        self.assertNotIn('at least one relation', asked)
        self.assertIn("whatever each binds on must satisfy this group's rule, "
                      "printed under this paragraph, with what\n  every OTHER "
                      "member binds on, because group A [1, 3] still holds "
                      "after the rewrite.\n    RULE of group A (subtractive "
                      "rhyme), where ", asked)
        self.assertEqual(asked.count(self.ONLY_THIS_RULE), 2,
                         'under the pivot\'s mandate and under the paragraph')
        plain = dataclasses.replace(
            group, brief=dataclasses.replace(briefs[3], group_rules={}))
        before = PRM.render_group(plain)
        self.assertIn('must stand in a relation with what', before)
        self.assertEqual(LH.legacy_question_texts('propose_group', asked)[0],
                         before)
        # A group that requires two relations has two rules, and each is
        # printed.
        m2, both = self._street_briefs(
            {'A': ['schema:subtractive rhyme', 'class:ASSONANCE']})
        two = PRM.render_line(both[3], lines)
        self.assertIn('this line must satisfy every rule printed under this '
                      'row with each of: ', two)
        # REPINNED 2026-11-22 (the follow-up to finding 2): ~~"RULE of group
        # A (class:ASSONANCE), where ... of line M: P and Q stand in the
        # declared relation class:ASSONANCE."~~ That row showed an internal
        # id and stated no rule. A declared class now gets its plain name
        # and its clauses (`quality.plan.class_rule`).
        self.assertIn('    RULE of group A (vowel match), where N and M are '
                      'any two lines of the group, N first, P is the part of '
                      'line N the rule reads and Q the part of line M: P and Q '
                      'are each read from a syllable with any stress to the '
                      'end: ', two)
        self.assertIn('; the consonant sounds may differ.\n', two)
        self.assertNotIn('class:ASSONANCE', two)
        self.assertIn(self.ONLY_THIS_RULE, two)
        self.assertEqual(
            LH.legacy_question_texts('propose', two)[0],
            PRM.render_line(dataclasses.replace(both[3], group_rules={}), lines))
        coupled = PRM.render_group(dataclasses.replace(group, brief=both[3]))
        self.assertIn('must satisfy every rule printed under this paragraph '
                      'with what\n', coupled)
        self.assertEqual(
            LH.legacy_question_texts('propose_group', coupled)[0],
            PRM.render_group(dataclasses.replace(
                group, brief=dataclasses.replace(both[3], group_rules={}))))

    def test_the_question_that_repairs_the_declared_requirements_gives_each_rule(self):
        # Finding 2, on the question headed REPAIR THE DECLARED REQUIREMENTS.
        # It asks for "all declared relations" to be kept and listed each
        # group's lines under DECLARED MANDATE with no rule beside any of
        # them (reproduced on the raw engine by the planner owner,
        # 2026-11-21). The loop asks it here because L3 also returns as L5.
        import dataclasses
        import quality.propose as PRM
        from quality.propose import ModelProposer
        draft = self.HILL + [self.HILL[2]]
        m = mandate([[1, 3], [2, 4]], n_lines=5, returns=[[3, 5]],
                    relations={'A': 'class:ASSONANCE'})
        rv = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=1,
                                            backtrack_width=1))
        call = self._fake_writer({'L3': ['My kettle whistles by the door again']})
        writer, groups = ModelProposer(call), []

        def propose_group(group_brief):
            groups.append(group_brief)
            return writer.propose_group(group_brief)
        with contextlib.redirect_stdout(io.StringIO()):
            revise_loop(rv, list(draft), m, propose=writer.propose,
                        propose_group=propose_group)
        first = groups[0]
        self.assertTrue(first.whole_repair)
        asked = [p for k, p in call.calls if k == 'group'][0]
        # REPINNED 2026-11-22 (the follow-up to finding 2): ~~"RULE of group
        # A (class:ASSONANCE), where ... of line M: P and Q stand in the
        # declared relation class:ASSONANCE."~~ The row for a declared class
        # is its plain name and its clauses now (`quality.plan.class_rule`).
        from quality.plan import class_rule
        from quality.revise import RULE_LEGEND
        plain, clauses = class_rule('class:ASSONANCE')
        self.assertEqual(plain, 'vowel match')
        self.assertEqual(clauses[-1], 'the consonant sounds may differ')
        row = (f'  RULE of group A (vowel match), {RULE_LEGEND}: '
               + '; '.join(clauses) + '.')
        self.assertEqual(first.rule_rows, (row.strip(),))
        self.assertIn('\n\nTHE RULE EACH GROUP THAT DECLARES ONE IS GRADED BY\n'
                      + row + '\n\nCURRENT DRAFT\n', asked)
        # Group B declares nothing and has no row.
        self.assertNotIn('RULE of group B', asked)
        before = PRM.render_group(dataclasses.replace(first, rule_rows=()))
        self.assertNotIn('RULE', before)
        self.assertEqual(LH.legacy_question_texts('propose_group', asked)[0],
                         before)

    def test_a_group_question_gives_the_rule_of_a_members_other_groups(self):
        # A follow-up to finding 2 (2026-11-22, agreed with the planner
        # owner). A group question tells each other member what it "must
        # also answer": the words of that member's OTHER groups, which are
        # not being rewritten and still hold. One of those groups may
        # declare a type, and the block gave its word and never its rule. A
        # writer who moved the member to a plain rhyme of the listed word
        # was rejected for a rule the question had not stated.
        import dataclasses
        import quality.propose as PRM
        from quality.propose import ModelProposer
        from quality.revise import declared_rule_rows
        draft = ['we walked along the street',
                 'a quiet word was all i had',
                 'the morning brings the stone',
                 'the evening leaves me in the sun',
                 'i left my jacket by the tree']

        def first_group_question(relations):
            m = mandate([[1, 3], [1, 5]], n_lines=5, relations=relations)
            rv = Reviser(rdecl=ReviseDeclaration(
                max_rounds=1, attempts_per_line=1, backtrack_width=1))
            call = self._fake_writer({'L3': [draft[2]]})
            writer, groups = ModelProposer(call), []

            def propose_group(group_brief):
                groups.append(group_brief)
                return writer.propose_group(group_brief)
            with contextlib.redirect_stdout(io.StringIO()):
                revise_loop(rv, list(draft), m, propose=writer.propose,
                            propose_group=propose_group)
            asked = [p for k, p in call.calls if k == 'group'][0]
            return m, groups[0], asked

        m, first, asked = first_group_question(
            {'A': 'class:RHYME', 'B': 'schema:subtractive rhyme'})
        self.assertEqual((first.label, first.pivot_line_no, first.whole_repair),
                         ('A', 3, False))
        (member,) = first.anchors
        self.assertEqual((member.line_no, member.calls), (1, ('tree',)))
        (row,) = declared_rule_rows(m)['B']
        self.assertIn(self.ONLY_THIS_RULE, row)
        self.assertEqual(member.call_rules, (row,))
        self.assertIn("  Besides group A [1, 3], L1 must also answer: 'tree'.\n"
                      f"    {row}\n"
                      "  Those groups are NOT being rewritten", asked)
        # A run held before this change replays: the undo finding 2 added
        # takes every rule row out, these among them, and nothing else in
        # the block moved.
        before = PRM.render_group(dataclasses.replace(
            first, anchors=(dataclasses.replace(member, call_rules=()),)))
        self.assertIn("must also answer: 'tree'.\n  Those groups are NOT being "
                      "rewritten", before)
        self.assertEqual(LH._legacy_group_rules('propose_group', asked),
                         LH._legacy_group_rules('propose_group', before))
        # A member whose other group declares nothing gets its word alone.
        _m, plain_first, plain = first_group_question({'A': 'class:RHYME'})
        self.assertEqual(plain_first.anchors[0].calls, ('tree',))
        self.assertEqual(plain_first.anchors[0].call_rules, ())
        self.assertIn("must also answer: 'tree'.\n  Those groups are NOT being "
                      "rewritten", plain)
        self.assertNotIn('RULE of group B', plain)

    HARMONY = ['we sang in quiet harmony',
               'a quiet word was all i had',
               'the river runs down to the sea',
               'the evening leaves me in the sun']

    def test_a_rule_row_does_not_rule_out_what_the_grader_accepts(self):
        # A follow-up to finding 2 (2026-11-22, from the planner owner's
        # read of the rows). A type that reads a line's end is graded with a
        # last syllable promoted to stress taken as well, so harmony/sea
        # holds under a declared perfect rhyme. The row was worded from the
        # type as the registry holds it and said each part is read "from its
        # last stressed syllable", which rules that pair out. The question
        # stated a narrower rule than the one graded.
        import dataclasses
        import quality.propose as PRM
        from quality.plan import type_rule
        from quality.relations import REGISTRY, declared_pair_schema
        from quality.revise import RULE_LEGEND, declared_rule_rows
        m = mandate([[1, 3], [2, 4]], n_lines=4,
                    relations={'A': 'schema:perfect rhyme'})
        graded = Reviser()
        strict = Reviser(rdecl=ReviseDeclaration(promote=False))
        # The grade. The pair holds where the final is promoted, and only
        # there.
        self.assertNotIn(3, [b.line_no
                             for b in graded.brief(list(self.HARMONY), m)])
        self.assertIn(3, [b.line_no
                          for b in strict.brief(list(self.HARMONY), m)])

        def row_of(promote):
            clauses = type_rule(declared_pair_schema(
                REGISTRY['perfect rhyme'], promote=promote))
            return (f'RULE of group A (perfect rhyme), {RULE_LEGEND}: '
                    + '; '.join(clauses) + '.')
        also = ('or at its last syllable alone, counted as stressed, when '
                'that syllable is unstressed and follows a stressed one')
        self.assertEqual(row_of(True).count(also), 2, 'once for P, once for Q')
        self.assertNotIn(also, row_of(False))
        self.assertEqual(declared_rule_rows(m)['A'], (row_of(True),))
        self.assertEqual(declared_rule_rows(m, promote=False)['A'],
                         (row_of(False),))
        # The question for a line that breaks the rule gives the rule its
        # own reviser grades by, and a held run still replays.
        lines = list(self.HARMONY)
        lines[2] = 'the morning brings the stone'
        for rv, promote in ((graded, True), (strict, False)):
            (b3,) = [b for b in rv.brief(list(lines), m) if b.line_no == 3]
            self.assertEqual(b3.group_rules, {'A': (row_of(promote),)})
            asked = PRM.render_line(b3, lines)
            self.assertIn(f'    {row_of(promote)}\n', asked)
            self.assertEqual(
                LH.legacy_question_texts('propose', asked)[0],
                PRM.render_line(dataclasses.replace(b3, group_rules={}),
                                lines))

    def test_the_group_questions_give_the_rule_their_reviser_grades_by(self):
        # The same follow-up, on the two questions the loop builds its own
        # rows for: the whole repair, and a member's other groups.
        import quality.loop as LP
        from quality.propose import ModelProposer
        from quality.revise import declared_rule_rows
        draft = ['we walked along the street',
                 'a quiet word was all i had',
                 'the morning brings the stone',
                 'the evening leaves me in the sun',
                 'i left my jacket by the tree']
        m = mandate([[1, 3], [1, 5]], n_lines=5,
                    relations={'A': 'class:RHYME',
                               'B': 'schema:subtractive rhyme'})
        rows = {p: declared_rule_rows(m, promote=p) for p in (True, False)}
        self.assertNotEqual(rows[True]['B'], rows[False]['B'])
        for promote in (True, False):
            self.assertEqual(
                LP._all_rule_rows(m, promote),
                rows[promote]['A'] + rows[promote]['B'])
            rv = Reviser(rdecl=ReviseDeclaration(
                max_rounds=1, attempts_per_line=1, backtrack_width=1,
                promote=promote))
            call = self._fake_writer({'L3': [draft[2]]})
            writer, groups = ModelProposer(call), []

            def propose_group(group_brief):
                groups.append(group_brief)
                return writer.propose_group(group_brief)
            with contextlib.redirect_stdout(io.StringIO()):
                revise_loop(rv, list(draft), m, propose=writer.propose,
                            propose_group=propose_group)
            (member,) = groups[0].anchors
            self.assertEqual((member.line_no, member.calls), (1, ('tree',)))
            self.assertEqual(member.call_rules, rows[promote]['B'])

    def test_a_declared_class_gets_its_rule_in_plain_words(self):
        # The same follow-up. A group that declares a class was given "P and
        # Q stand in the declared relation class:RHYME": an internal id, and
        # no rule at all. A class is reached wherever a catalog form or a
        # caller declares one.
        from quality.plan import class_rule, type_rule
        from quality.relations import REGISTRY
        from quality.rhyme_types import CLASS_RELATIONS
        from quality.revise import RULE_LEGEND, declared_rule_rows
        self.assertEqual(
            [class_rule(f'class:{name}')[0] for name in CLASS_RELATIONS],
            ['rhyme', 'same-sound rhyme', "rhyme on a line's last syllable",
             'vowel match', 'consonant match'])
        for name in CLASS_RELATIONS:
            m = mandate([[1, 3], [2, 4]], n_lines=4,
                        relations={'A': f'class:{name}'})
            (row,) = declared_rule_rows(m)['A']
            plain, clauses = class_rule(f'class:{name}')
            self.assertTrue(clauses, name)
            self.assertEqual(row, f'RULE of group A ({plain}), {RULE_LEGEND}: '
                             + '; '.join(clauses) + '.')
            self.assertNotIn('class:', row)
            self.assertNotIn(name, row, 'the id in capitals is not shown')
            self.assertNotIn('stand in the declared relation', row)
        # A name in the third namespace has its own judge, which is not the
        # registry type of the same name, so that type's rule is not
        # printed for it.
        m = mandate([[1, 3], [2, 4]], n_lines=4,
                    relations={'A': 'type:pararhyme'})
        (row,) = declared_rule_rows(m)['A']
        self.assertIn('(type:pararhyme)', row)
        for clause in type_rule(REGISTRY['pararhyme'])[:2]:
            self.assertNotIn(clause, row)

    def test_a_round_reports_only_the_lines_it_changed(self):
        # Finding 28. An accepted group answer changed L3 and sent L1 back
        # byte-identical, and the round was reported as "fixed L1, L3": the
        # attempt recorded every member of the group as changed.
        result, _call, _groups = self._hill_loop()
        self.assertEqual(result.lines[0], self.HILL[0], 'L1 came back as it was')
        self.assertEqual(result.lines[2], self.STOVE)
        first = result.rounds[0]
        accepted = [a for a in first.attempts if a.accepted]
        self.assertEqual(len(accepted), 1)
        self.assertEqual(accepted[0].tier, 2)
        self.assertEqual(accepted[0].touched, (3,))
        self.assertEqual(first.fixed_lines, [3])
        self.assertIn('  round 1: fixed L3', str(result).splitlines())
        # The same on the question that asks for a group together with its
        # word-for-word copies: L3 and its copy L5 change, L1 comes back as
        # it was, and L1 is not reported as fixed.
        draft = self.HILL + [self.HILL[2]]
        m = mandate([[1, 3], [2, 4]], n_lines=5, returns=[[3, 5]],
                    default_relation='class:ASSONANCE')
        rv = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=1,
                                            backtrack_width=1))
        with contextlib.redirect_stdout(io.StringIO()):
            result = revise_loop(
                rv, list(draft), m,
                propose=lambda brief, *a, **k: (
                    'My kettle whistles by the door again'
                    if brief.line_no == 3 else None),
                propose_group=lambda group_brief: (
                    (draft[0], self.STOVE, self.STOVE)
                    if group_brief.members == (1, 3, 5) else None))
        self.assertEqual(result.lines, [draft[0], draft[1], self.STOVE, draft[3],
                                        self.STOVE])
        accepted = [a for a in result.rounds[0].attempts if a.accepted]
        self.assertEqual([(a.tier, a.touched) for a in accepted], [(2, (3, 5))])
        self.assertEqual(result.rounds[0].fixed_lines, [3, 5])

    def test_an_answer_that_is_not_one_line_of_text_never_reaches_the_draft(self):
        # Finding 29. The loop wrote whatever a proposer handed it into the
        # draft. A written answer is cut to one line before it gets here; a
        # recorded one (`--propose=replay:PATH`) is not, so a recorded text
        # with a line break in it was ACCEPTED as line 2 of a two-line draft
        # that then sang three, and a recorded number, list or empty text
        # ended the run on an error instead of costing the attempt.
        m = mandate('AA', n_lines=2, default_relation='class:ASSONANCE')

        def run(first):
            rv = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=2,
                                                backtrack_width=0))
            with tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp)/'replay.json'
                path.write_text(json.dumps({'propose': [
                    {'line': 2, 'attempt': 0, 'text': first},
                    {'line': 2, 'attempt': 1, 'text': self.STOVE}]}))
                with contextlib.redirect_stdout(io.StringIO()):
                    one, _two, _said = LH._replay_proposer(str(path))
                    seen = []

                    def propose(brief, lines, attempt, reasons=None, whole=()):
                        seen.append(reasons)
                        return one(brief, lines, attempt, reasons, whole)
                    return revise_loop(rv, list(self.DOOR), m, propose=propose), seen
        for first, why in (('My kettle whistles\nby the stove', 'more than one line'),
                           ('My kettle whistles by the stove\n', 'more than one line'),
                           (42, 'not text'),
                           ([self.STOVE], 'not text'),
                           ('', 'empty'),
                           ('   ', 'empty')):
            with self.subTest(answer=first):
                result, seen = run(first)
                self.assertEqual(len(seen), 2, 'it cost one attempt and the next was asked')
                self.assertEqual(len(seen[1]), 1)
                self.assertIn(why, seen[1][0])
                self.assertEqual(result.lines, [self.DOOR[0], self.STOVE])
                attempt = result.rounds[0].attempts[0]
                self.assertTrue(attempt.accepted)
                self.assertEqual(attempt.tried, 2)
        # The same holds for a group answer: one row with a line break in it
        # and the whole answer is refused, with the line named.
        import quality.loop as LP
        rv = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=1,
                                            backtrack_width=1))
        hill = mandate('ABAB', n_lines=4, default_relation='class:ASSONANCE')
        for answer, why in (((self.HILL[0], 'My kettle whistles\nby the stove'),
                             'L3: the answer was more than one line'),
                            ((self.HILL[0], 7), 'L3: the answer was not text'),
                            ('L1 and L3', 'the answer was not a list of lines, '
                                          'one for each line asked for')):
            with self.subTest(group=answer), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(LP._group_misshapen(answer, (1, 3)), why)
                result = revise_loop(
                    rv, list(self.HILL), hill,
                    propose=lambda *a, **k: 'My kettle whistles by the door again',
                    propose_group=lambda group_brief: (
                        answer if 3 in group_brief.members else None))
                self.assertEqual(result.lines, self.HILL)
                group = [a for a in result.rounds[0].attempts
                         if a.line_no == 3 and a.tier == 2]
                self.assertEqual(len(group), 1)
                self.assertFalse(group[0].accepted)
                self.assertEqual(group[0].tried, 1)
        self.assertIsNone(LP._group_misshapen((self.HILL[0], self.STOVE), (1, 3)))
        # A recorded group answer that is a text and not a list is a
        # malformed record: taken apart it is one letter for each line.
        with tempfile.TemporaryDirectory() as tmp, \
             contextlib.redirect_stdout(io.StringIO()), \
             contextlib.redirect_stderr(io.StringIO()):
            path = Path(tmp)/'replay.json'
            path.write_text(json.dumps({'propose_group': [
                {'members': [1, 3], 'texts': [self.HILL[0], self.HILL[2]],
                 'words': ['', ''], 'new': 'ab'}]}))
            with self.assertRaises(SystemExit):
                LH._replay_proposer(str(path))

    def test_seedless_cli_renders_and_resumes_exact_accepted_draft(self):
        root = Path(__file__).resolve().parents[1]
        # A real mandated-assonance violation (door/coat share no nucleus)
        # with one deterministic legal repair; neither end word has a second
        # dictionary reading. (It was a syllable-band violation until the
        # owner deleted that band 2026-09-28, and a prominence-band one until
        # the owner deleted that band 2026-10-01.)
        initial = ['Your fingers brush my heavy coat',
                   'My kettle whistles by the door']
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            (p/'draft.txt').write_text('\n'.join(initial) + '\n')
            (p/'auditwriter.py').write_text(
                'from pathlib import Path\n'
                'def make():\n'
                '    def call(prompt):\n'
                '        p = Path(__file__).with_suffix(".calls")\n'
                '        with p.open("a") as f: f.write("called\\n")\n'
                '        return "My kettle whistles by the stove"\n'
                '    return call\n')
            env = dict(os.environ, PYTHONPATH=tmp + os.pathsep + str(root),
                       LYRIC_CHECKPOINT_PATH=str(p/'cp.json'))
            argv = [sys.executable, 'lyric_harness.py', 'revise', str(p/'draft.txt'),
                    '--groups=1,2', '--relation=class:ASSONANCE', '--propose=call:auditwriter:make',
                    '--max-rounds=1', '--attempts=1', '--backtrack=0']
            first = subprocess.run(argv, cwd=root, env=env, capture_output=True,
                                   text=True, timeout=180)
            self.assertEqual(first.returncode, 0, first.stderr + first.stdout[-2000:])
            cp = json.loads((p/'cp.json').read_text())
            self.assertEqual(cp['status'], 'finished')
            self.assertNotEqual(cp['accepted_lines'], initial)
            self.assertEqual(cp['final_draft'], cp['accepted_lines'])
            self.assertIn('THE SONG, PERFORMANCE ORDER:', first.stdout)
            record = next(line.removeprefix('  lyric result: ')
                          for line in first.stdout.splitlines()
                          if line.startswith('  lyric result: '))
            self.assertEqual(json.loads(record)['final_draft'], cp['accepted_lines'])
            second = subprocess.run(argv, cwd=root, env=env, capture_output=True,
                                    text=True, timeout=180)
            self.assertEqual(second.returncode, first.returncode,
                             second.stderr + second.stdout[-2000:])
            self.assertEqual((p/'auditwriter.calls').read_text().splitlines(), ['called'])
            self.assertEqual(json.loads((p/'cp.json').read_text())['accepted_lines'],
                             cp['accepted_lines'])
            for invalid in (dict(cp, config_key='another-run'),
                            dict(cp, proposals=[None])):
                (p/'cp.json').write_text(json.dumps(invalid))
                refused = subprocess.run(argv, cwd=root, env=env, capture_output=True,
                                         text=True, timeout=180)
                self.assertEqual(refused.returncode, 2,
                                 refused.stderr + refused.stdout[-2000:])
                self.assertIn('REFUSED — the declared proposer cannot resume:',
                              refused.stdout)
                self.assertNotIn('Traceback', refused.stderr)
                self.assertEqual((p/'auditwriter.calls').read_text().splitlines(),
                                 ['called'])

    def test_memo_storage_budget_honestly_evicts_without_changing_answers(self):
        rv = type('Tiny', (), {'rdecl': ReviseDeclaration(max_rounds=1,
                                                         attempts_per_line=0,
                                                         backtrack_width=2)})()
        wrapped, say = RM.wrap(rv, 'audit-storage-test', 1)
        wrapped._slot['cap'] = 1
        self.assertEqual(wrapped._memo(('first',), lambda: [1]), [1])
        self.assertEqual(wrapped._memo(('second',), lambda: [2]), [2])
        self.assertEqual(wrapped._memo(('first',), lambda: [1]), [1])
        self.assertEqual(wrapped._slot['tally']['overflow'], 2)
        self.assertIn('entry storage budget', say())


if __name__ == '__main__':
    unittest.main(verbosity=2)

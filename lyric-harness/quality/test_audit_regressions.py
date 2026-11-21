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
        older = LH.legacy_question_texts('propose', now_line)[1]
        self.assertIn('Reviser.verify rejects an answer', now_line)
        self.assertNotIn('Reviser.verify rejects an answer', older)
        self.assertIn('  1. ONE line back, and it replaces L2. The draft stays 2 '
                      'lines — a different', older)
        self.assertIn('New NOTES do not reject.', older)
        self.assertEqual(LH.LEGACY_QUESTION_RENDERINGS[-3][1], LH._legacy_671_prose)
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
        self.assertEqual(LH.LEGACY_QUESTION_RENDERINGS[-2][1],
                         LH._legacy_ban_definitions)
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
    # (`quality/fixtures/fake_writer.py`): no model, every reply read from a
    # spec, so what the loop makes of a reply is the only thing that varies.
    DOOR = ['Your fingers brush my heavy coat',
            'My kettle whistles by the door']
    STOVE = 'My kettle whistles by the stove'

    @staticmethod
    def _fake_writer(spec):
        fixtures = str(Path(__file__).resolve().parent / 'fixtures')
        if fixtures not in sys.path:
            sys.path.insert(0, fixtures)
        import fake_writer
        return fake_writer.make(spec)

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
        self.assertIn('The PREVIOUS attempt was REJECTED', second)
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

    def _hill_loop(self):
        from quality.propose import ModelProposer
        m = mandate('ABAB', n_lines=4, default_relation='class:ASSONANCE')
        rv = Reviser(rdecl=ReviseDeclaration(max_rounds=2, attempts_per_line=1,
                                            backtrack_width=1))
        call = self._fake_writer(self.HILL_SPEC)
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
        # A run held across this change still replays: the newest undo
        # restores the question as it was worded before, byte for byte.
        self.assertEqual(LH.LEGACY_QUESTION_RENDERINGS[-1][1],
                         LH._legacy_pivot_rejection)
        first = groups[0]
        self.assertEqual(first.path, 'escalation')
        before = PRM.render_group(dataclasses.replace(first, pivot_line_reasons=()))
        self.assertIn('  No previous attempt was rejected on this line in this '
                      'round.\n', before)
        self.assertEqual(LH.legacy_question_texts('propose_group', asked)[0], before)
        # With last round's rejection of the same group also on the question,
        # the old wording had that block and nothing after it.
        earlier = {'round': 1, 'text': 'x', 'reasons': ['nothing was fixed']}
        with_prior = dataclasses.replace(first, prior=earlier)
        now = PRM.render_group(with_prior)
        self.assertIn('Your rewrite of this group in ROUND 1 was REJECTED', now)
        self.assertIn("L3's line question (attempt 1, round 1) was asked first", now)
        self.assertEqual(
            LH.legacy_question_texts('propose_group', now)[0],
            PRM.render_group(dataclasses.replace(with_prior, pivot_line_reasons=())))
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
        self.assertEqual(LH.legacy_question_texts('propose_group', asked)[0], before)
        # L4's own line question got no answer, so its group question still
        # says, truly, that no attempt was rejected.
        later = [p for k, p in call.calls if k == 'group'][1]
        self.assertIn('No previous attempt was rejected', later)

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

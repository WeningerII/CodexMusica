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
        repair = Finding('DENSITY_OUT_OF_BAND', 'flag', '', '', [2])
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
        repair = Finding('DENSITY_OUT_OF_BAND', 'flag', '', '', [2])
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
        stopped = revise_loop(self.rv, after, m, propose=lambda *a, **k: None)
        self.assertEqual(stopped.stop_reason, 'uncertified')
        self.assertFalse(stopped.coverage_certified)
        self.assertEqual(stopped.whole_flags, [])
        self.assertEqual(stopped.unresolved, [])

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
        b = next(b for b in briefs if b.joint_conflict)
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
            mismatched, _ = LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
            with self.assertRaises(ProposerUnavailable):
                mismatched(b, ['different cat', initial[1]], 0)
            self.assertEqual(len(called), 1)
            for bad in ([], dict(state, proposals=[None]),
                        dict(state, proposals=[{'kind': 'propose',
                                               'question_sha256': '0' * 64,
                                               'answer': {'wrong': 'type'}}])):
                (Path(tmp)/'cp.json').write_text(json.dumps(bad))
                with self.assertRaises(ProposerUnavailable):
                    LH._checkpoint_proposer(writer, None, initial, 'config', 'fake')
            self.assertEqual(len(called), 1)

    def test_interrupted_real_loop_preserves_accepted_edit_before_next_request(self):
        # A real density violation has one deterministic legal repair and
        # does not depend on ambiguous CMU pronunciations at own/gone.
        initial = ['The elephant elephant elephant elephant elephant elephant stove',
                   'Your fingers brush my heavy coat']
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
            self.assertEqual(cp['accepted_lines'][0], 'My kettle whistles by the stove')
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

    def test_seedless_cli_renders_and_resumes_exact_accepted_draft(self):
        root = Path(__file__).resolve().parents[1]
        # A real density violation has one deterministic legal repair and
        # does not depend on ambiguous CMU pronunciations at own/gone.
        initial = ['The elephant elephant elephant elephant elephant elephant stove',
                   'Your fingers brush my heavy coat']
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

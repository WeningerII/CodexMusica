"""Bounded continuation admission: real journals, deterministic writers, no API."""
import contextlib
import io
import json
import os
from pathlib import Path
import random
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lyric_harness as LH
from quality.revise import Brief
from quality.propose import ProposerUnavailable


class JournalCapacity(unittest.TestCase):
    def test_largest_legal_group_answer_and_exact_replay(self):
        rng = random.Random(71)
        initial = [''.join(chr(rng.randrange(0x10000, 0xDFFFD)) for _ in range(200))
                   for _ in range(31)]
        # Controls have JSON's six-byte expansion; high-plane Unicode has the
        # largest ordinary UTF-8 expansion. Both must fit without gzip luck.
        answer = [('\x01' * 100 + initial[n][:100]) for n in range(31)]
        calls = []
        group = SimpleNamespace(members=tuple(range(1, 32)), lines=initial,
                                brief=SimpleNamespace(round_no=1),
                                proposal_for=lambda n: (initial[n-1], 'word'))
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp')}), \
             patch('quality.propose.render_group', return_value='same exact question'), \
             contextlib.redirect_stdout(io.StringIO()):
            writer = lambda b: calls.append(True) or answer
            one, two = LH._checkpoint_proposer(None, writer, initial, 'cfg', 'fake')
            self.assertEqual(two(group), answer)
            one.checkpoint(answer, 1, 'accepted')
            saved = json.loads((Path(tmp)/'cp').read_text())
            self.assertLessEqual(LH._journal_bytes(saved), LH.JOURNAL_BYTES)
            self.assertEqual(saved['accepted_lines'], answer)
            self.assertEqual(saved['answered']['propose_group'][0]['new'], answer)
            _, replay = LH._checkpoint_proposer(None, writer, initial, 'cfg', 'fake')
            self.assertEqual(replay(group), answer)
            self.assertEqual(len(calls), 1)

    def test_capacity_stops_before_dispatch_and_exports_exact_artifact(self):
        initial = ['original line']
        accepted = ['accepted line']
        b = Brief(1, initial[0]); b.round_no = 1
        output = io.StringIO()
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp')}), \
             contextlib.redirect_stdout(output):
            calls = []
            one, _ = LH._checkpoint_proposer(lambda *a, **k: calls.append(True) or 'answer',
                                            None, initial, 'cfg', 'fake')
            one.checkpoint(accepted, 1, 'accepted')
            one.checkpoint_state['evidence'] = 'x' * (LH.JOURNAL_WORK_BYTES - 4096)
            before = json.loads(json.dumps(one.checkpoint_state))
            with self.assertRaises(LH._JournalCapacity) as stopped:
                one(b, accepted, 0)
            self.assertEqual(calls, [])
            self.assertEqual(stopped.exception.lines, accepted)
            self.assertEqual(stopped.exception.state, before)
            with self.assertRaises(SystemExit) as exited:
                LH._journal_stop(stopped.exception)
            self.assertEqual(exited.exception.code, 3)
            saved = json.loads((Path(tmp)/'cp').read_text())
            self.assertEqual(saved['accepted_lines'], accepted)
            self.assertTrue(saved['new_run_required'])
            self.assertEqual(saved['status'], 'journal_capacity')
            self.assertLessEqual(LH._journal_bytes(saved), LH.JOURNAL_BYTES)
            receipt = [json.loads(x.split('lyric result: ', 1)[1])
                       for x in output.getvalue().splitlines() if 'lyric result: ' in x][-1]
            self.assertEqual(receipt['final_draft'], accepted)
            self.assertFalse(receipt['certified'])
            self.assertFalse(receipt['resumable'])
            with self.assertRaises(LH._JournalCapacity):
                LH._checkpoint_proposer(None, None, initial, 'cfg', 'fake')

    def test_known_oversize_response_is_never_marked_for_automatic_replay(self):
        initial = ['original line']
        b = Brief(1, initial[0]); b.round_no = 1
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp')}), \
             contextlib.redirect_stdout(io.StringIO()):
            def writer(*args, **kwargs):
                e = ProposerUnavailable('settled response exceeds proposal bound')
                e.code = 'PROVIDER_PROPOSAL_TOO_LARGE'
                raise e
            one, _ = LH._checkpoint_proposer(writer, None, initial, 'cfg', 'fake')
            with self.assertRaises(LH._JournalCapacity) as stopped:
                one(b, initial, 0)
            with self.assertRaises(SystemExit):
                LH._journal_stop(stopped.exception)
            saved = json.loads((Path(tmp)/'cp').read_text())
            self.assertEqual(saved['stop_reason'], 'PROVIDER_PROPOSAL_TOO_LARGE')
            self.assertEqual(saved['accepted_lines'], initial)
            self.assertTrue(saved['new_run_required'])

    def test_deferred_prompt_reserves_before_question_and_keeps_prior_journal(self):
        with tempfile.TemporaryDirectory() as tmp, \
             patch('quality.propose.render_line', return_value='\x01' * 70000):
            path = str(Path(tmp)/'state')
            one, _, disclosure = LH._defer_proposer(path, ['original'])
            before = json.loads(json.dumps(disclosure.state))
            b = Brief(1, 'original'); b.round_no = 1
            with self.assertRaises(LH._JournalCapacity) as stopped:
                one(b, ['original'], 0)
            self.assertEqual(stopped.exception.state, before)
            self.assertIsNone(disclosure.state['pending'])

    def test_deferred_batch_splits_without_losing_questions_or_replay_outcomes(self):
        lines = ['original one', 'original two', 'original three', 'original four']
        briefs = [Brief(n, text) for n, text in enumerate(lines, 1)]
        for b in briefs:
            b.round_no = 1
        # Three complete briefs exceed the real journal bound, two fit.
        # High-plane characters exercise UTF-8 byte counting, not char count.
        prompts = {b.line_no: f'COMPLETE L{b.line_no}\n' + '\U0001f4a7' * 35000
                   for b in briefs}
        def render_one(b, *args, **kwargs):
            return prompts[b.line_no]
        def render_many(bs, *args, **kwargs):
            return '\n'.join(prompts[b.line_no] for b in bs)
        with tempfile.TemporaryDirectory() as tmp, \
             patch('quality.propose.render_line', side_effect=render_one), \
             patch('quality.propose.render_batch', side_effect=render_many):
            path = Path(tmp)/'state'
            one, _, disclosure = LH._defer_proposer(str(path), lines)
            with self.assertRaises(LH._NeedProposal) as first:
                one.prefetch(briefs[0], briefs[1:], lines)
            expected = '\n'.join(prompts[n] for n in [1, 2])
            self.assertEqual(first.exception.prompt, expected)
            self.assertEqual([r['line'] for r in first.exception.record['records']], [1, 2])
            self.assertEqual(disclosure.state['answered']['propose'], [])
            self.assertLess(LH._journal_bytes(disclosure.state), LH.JOURNAL_WORK_BYTES)
            path.write_text(json.dumps(disclosure.state))
            repeated_output = io.StringIO()
            with contextlib.redirect_stdout(repeated_output), self.assertRaises(SystemExit) as same:
                LH._defer_proposer(str(path), lines)
            self.assertEqual(same.exception.code, 4)
            self.assertTrue(repeated_output.getvalue().endswith(expected + '\n'))
            repeated = json.loads(path.read_text())
            self.assertEqual(repeated['pending']['record'], first.exception.record)
            self.assertEqual(repeated['pending']['prompt'], expected)
            repeated['pending']['answer'] = 'L1: accepted one\nL2: rejected two'
            path.write_text(json.dumps(repeated))
            resumed, _, result = LH._defer_proposer(str(path), lines)
            self.assertEqual(resumed(briefs[0], lines, 0), 'accepted one')
            self.assertEqual(resumed(briefs[1], lines, 0), 'rejected two')
            resumed.record(1, 0, 1, 'accepted one', True, [])
            resumed.record(2, 0, 1, 'rejected two', False, ['still violates the mandate'])
            result.state['accepted_lines'][0] = 'accepted one'
            accepted = list(result.state['accepted_lines'])
            with self.assertRaises(LH._NeedProposal) as later:
                resumed.prefetch(briefs[2], briefs[3:], accepted)
            self.assertEqual([r['line'] for r in later.exception.record['records']], [3, 4])
            self.assertEqual(later.exception.prompt, '\n'.join(prompts[n] for n in [3, 4]))
            self.assertEqual([r['line'] for r in result.state['answered']['propose']], [1, 2])
            self.assertEqual([r['accepted'] for r in result.state['outcomes']], [True, False])
            path.write_text(json.dumps(result.state))
            repeated_output = io.StringIO()
            with contextlib.redirect_stdout(repeated_output), self.assertRaises(SystemExit) as same:
                LH._defer_proposer(str(path), lines)
            self.assertEqual(same.exception.code, 4)
            self.assertTrue(repeated_output.getvalue().endswith(later.exception.prompt + '\n'))
            saved = json.loads(path.read_text())
            self.assertEqual(saved['pending']['record'], later.exception.record)
            # Answer the second subset before replaying the complete journal.
            saved['pending']['answer'] = 'L3: accepted three\nL4: accepted four'
            path.write_text(json.dumps(saved))
            final_replay, _, retained = LH._defer_proposer(str(path), lines)
            self.assertEqual(final_replay(briefs[0], lines, 0), 'accepted one')
            self.assertEqual(final_replay(briefs[1], lines, 0), 'rejected two')
            self.assertEqual(final_replay(briefs[2], accepted, 0), 'accepted three')
            self.assertEqual(final_replay(briefs[3], accepted, 0), 'accepted four')
            self.assertEqual([r['line'] for r in retained.state['answered']['propose']], [1, 2, 3, 4])
            self.assertEqual(retained.state['accepted_lines'], accepted)
            self.assertEqual(retained.state['outcomes'], result.state['outcomes'])

    def test_deferred_batch_atomic_pivot_cannot_be_skipped_for_smaller_questions(self):
        lines = ['original one', 'original two']
        briefs = [Brief(n, text) for n, text in enumerate(lines, 1)]
        for b in briefs:
            b.round_no = 1
        with tempfile.TemporaryDirectory() as tmp, \
             patch('quality.propose.render_line', return_value='\x01' * 70000), \
             patch('quality.propose.render_batch', return_value='\x01' * 80000):
            path = str(Path(tmp)/'state')
            one, _, disclosure = LH._defer_proposer(path, lines)
            before = json.loads(json.dumps(disclosure.state))
            with self.assertRaises(LH._JournalCapacity) as stopped:
                one.prefetch(briefs[0], briefs[1:], lines)
            self.assertEqual(stopped.exception.state, before)
            self.assertEqual(stopped.exception.lines, lines)
            self.assertEqual(disclosure.state, before)
            self.assertIn('identical restart can reach the same limit', str(stopped.exception))

    def test_deferred_oversized_verification_preserves_received_answer(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp)/'state')
            one, _, disclosure = LH._defer_proposer(path, ['original'])
            b = Brief(1, 'original'); b.round_no = 1
            with self.assertRaises(LH._NeedProposal):
                one(b, ['original'], 0)
            disclosure.state['pending']['answer'] = 'the accepted candidate'
            Path(path).write_text(json.dumps(disclosure.state))
            resumed, _, result = LH._defer_proposer(path, ['original'])
            self.assertEqual(resumed(b, ['original'], 0), 'the accepted candidate')
            before = json.loads(json.dumps(result.state))
            with self.assertRaises(LH._JournalCapacity) as stopped:
                resumed.record(1, 0, 1, 'the accepted candidate', True,
                               ['oversized reason' * 40000])
            self.assertEqual(stopped.exception.state, before)
            self.assertEqual(stopped.exception.state['answered']['propose'][0]['text'],
                             'the accepted candidate')
            self.assertEqual(stopped.exception.lines, ['original'])

    def test_final_metadata_capacity_preserves_final_accepted_lines(self):
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp')}), \
             contextlib.redirect_stdout(io.StringIO()):
            one, _ = LH._checkpoint_proposer(None, None, ['original'], 'cfg', 'fake')
            one.checkpoint(['accepted'], 1, 'accepted')
            with self.assertRaises(LH._JournalCapacity) as stopped:
                one.checkpoint(['accepted'], 1, 'finished',
                               coverage={'detail': 'x' * LH.JOURNAL_BYTES})
            self.assertEqual(stopped.exception.lines, ['accepted'])
            self.assertNotIn('coverage', stopped.exception.state)


class KitchenVerificationReceipts(unittest.TestCase):
    """Real verifier decisions, durable application and replay accounting."""
    @classmethod
    def setUpClass(cls):
        from quality.revise import Reviser, ReviseDeclaration
        from quality.schemes import mandate
        cls.r = Reviser(rdecl=ReviseDeclaration(attempts_per_line=1, max_rounds=2))
        cls.m = mandate('AA', n_lines=2, default_relation='class:ASSONANCE')
        cls.before = ['The elephant elephant elephant elephant elephant elephant stove',
                      'Your fingers brush my heavy coat']
        cls.after = ['My kettle whistles by the stove', cls.before[1]]

    def drive_one(self, one):
        from quality.loop import _try_tier1
        b = self.r.brief(self.before, self.m, include_offers=False,
                         target_lines={1})[0]
        b.round_no = 1
        return _try_tier1(self.r, b, list(self.before), self.m, self.r.rdecl,
                          None, None, None, None, one)

    def test_verified_acceptance_precedes_applied_checkpoint_and_replays_once(self):
        import hashlib
        calls = []
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp')}), \
             contextlib.redirect_stdout(io.StringIO()):
            cp = Path(tmp)/'cp'
            writer = lambda *a, **k: calls.append(True) or self.after[0]
            one, _ = LH._checkpoint_proposer(writer, None, self.before, 'cfg', 'fake')
            attempt, applied = self.drive_one(one)
            self.assertTrue(attempt.accepted)
            self.assertEqual(applied, self.after)
            verified = json.loads(cp.read_text())
            event = verified['verified_outcomes'][0]
            self.assertTrue(event['accepted'])
            self.assertFalse(event['applied'])
            self.assertEqual(verified['accepted_lines'], self.before)
            self.assertEqual(event['members'], [1])
            self.assertEqual(event['round'], 1)
            self.assertEqual(event['attempt'], 0)
            # A verified candidate is not evidence for a different applied draft.
            with self.assertRaises(ProposerUnavailable):
                one.checkpoint(['different', self.before[1]], 1, 'accepted')
            self.assertEqual(json.loads(cp.read_text()), verified)
            # Failure to persist application must leave the durable verifier
            # decision and provider answer intact, without an applied receipt.
            with patch.object(LH.os, 'replace', side_effect=OSError('disk failure')):
                with self.assertRaises(OSError):
                    one.checkpoint(applied, 1, 'accepted')
            self.assertEqual(json.loads(cp.read_text()), verified)
            self.assertFalse(one.verification_record()['verified_outcomes'][0]['applied'])
            self.assertEqual(verified['proposals'][0]['answer'], self.after[0])
            one.checkpoint(applied, 1, 'accepted')
            saved = json.loads(cp.read_text())
            self.assertEqual(saved['accepted_lines'], self.after)
            self.assertTrue(saved['verified_outcomes'][0]['applied'])
            self.assertEqual(saved['verified_outcomes'][0]['applied_draft_sha256'],
                             event['after_draft_sha256'])
            original_bytes = cp.read_bytes()
            resumed, _ = LH._checkpoint_proposer(writer, None, self.before, 'cfg', 'fake')
            # Stored answers/outcomes have not been visited by this verifier yet.
            self.assertEqual(resumed.verification_record()['verified_outcomes'], [])
            retry, applied_again = self.drive_one(resumed)
            self.assertTrue(retry.accepted)
            resumed.checkpoint(applied_again, 1, 'accepted')
            replay = resumed.verification_record()
            self.assertEqual(len(calls), 1)
            self.assertEqual(replay['verified_outcomes'], saved['verified_outcomes'])
            proof = replay['resume_proof']
            self.assertEqual(proof['input_checkpoint_sha256'], hashlib.sha256(original_bytes).hexdigest())
            self.assertEqual(proof['completed_proposals_at_start'], 1)
            self.assertEqual(proof['completed_proposals_replayed'], 1)
            self.assertEqual(proof['completed_proposal_redispatches'], 0)
            self.assertEqual(proof['new_proposer_dispatches'], 0)
            self.assertTrue(proof['replay_prefix_consumed'])
            self.assertEqual(proof['applied_outcome_ids_at_start'], [event['outcome_id']])
            self.assertEqual(proof['accepted_draft_sha256_at_start'], event['after_draft_sha256'])
            # The same request in an independent run has a distinct journal/ID.
            with patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'fresh')}):
                fresh, _ = LH._checkpoint_proposer(writer, None, self.before, 'cfg', 'fake')
                self.drive_one(fresh)
                self.assertNotEqual(fresh.verification_record()['verified_outcomes'][0]['outcome_id'],
                                    event['outcome_id'])

    def test_noop_rejection_and_decline_cannot_attest_applied_repair(self):
        with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()):
            for name, answer in [('noop', self.before[0]), ('decline', None)]:
                with self.subTest(name=name), \
                     patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/name)}):
                    one, _ = LH._checkpoint_proposer(lambda *a, **k: answer, None,
                                                     self.before, 'cfg', 'fake')
                    attempt, after = self.drive_one(one)
                    self.assertFalse(attempt.accepted)
                    self.assertEqual(after, self.before)
                    outcomes = one.verification_record()['verified_outcomes']
                    if name == 'decline':
                        self.assertEqual(outcomes, [])
                    else:
                        self.assertEqual(len(outcomes), 1)
                        self.assertFalse(outcomes[0]['accepted'])
                        self.assertFalse(outcomes[0]['applied'])
                        self.assertIn('nothing was fixed', outcomes[0]['reasons'])
                        one.checkpoint(after, 1, 'accepted')
                        self.assertFalse(one.verification_record()['verified_outcomes'][0]['applied'])

    def test_interruption_after_answer_before_verification_replays_without_fresh_call(self):
        calls = []
        b = self.r.brief(self.before, self.m, include_offers=False, target_lines={1})[0]
        b.round_no = 1
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp')}), \
             contextlib.redirect_stdout(io.StringIO()):
            writer = lambda *a, **k: calls.append(True) or self.after[0]
            one, _ = LH._checkpoint_proposer(writer, None, self.before, 'cfg', 'fake')
            self.assertEqual(one(b, self.before, 0), self.after[0])
            saved = json.loads((Path(tmp)/'cp').read_text())
            self.assertEqual(saved['verified_outcomes'], [])
            self.assertEqual(saved['accepted_lines'], self.before)
            resumed, _ = LH._checkpoint_proposer(writer, None, self.before, 'cfg', 'fake')
            attempt, after = self.drive_one(resumed)
            self.assertTrue(attempt.accepted)
            resumed.checkpoint(after, 1, 'accepted')
            self.assertEqual(len(calls), 1)
            self.assertEqual(len(resumed.verification_record()['verified_outcomes']), 1)
            self.assertTrue(resumed.verification_record()['verified_outcomes'][0]['applied'])
            proof = resumed.verification_record()['resume_proof']
            self.assertEqual(proof['applied_outcome_ids_at_start'], [])
            self.assertEqual(proof['new_proposer_dispatches'], 0)

    def test_actual_group_repair_is_verified_and_applied_by_the_loop(self):
        from quality.loop import revise_loop
        groups = []
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp')}), \
             contextlib.redirect_stdout(io.StringIO()):
            def group_writer(brief):
                groups.append(tuple(brief.members))
                return [self.after[n - 1] for n in brief.members]
            one, two = LH._checkpoint_proposer(lambda *a, **k: None, group_writer,
                                               self.before, 'cfg', 'fake')
            result = revise_loop(self.r, list(self.before), self.m,
                                 propose=one, propose_group=two)
            self.assertTrue(groups)
            self.assertEqual(result.lines, self.after)
            outcomes = one.verification_record()['verified_outcomes']
            self.assertEqual(len(outcomes), 1)
            self.assertEqual(outcomes[0]['kind'], 'propose_group')
            self.assertEqual(outcomes[0]['members'], [1, 2])
            self.assertTrue(outcomes[0]['accepted'])
            self.assertTrue(outcomes[0]['applied'])
            self.assertEqual(json.loads((Path(tmp)/'cp').read_text())['accepted_lines'], self.after)

    def test_whole_draft_hook_attests_actual_application_with_round(self):
        from quality.loop import revise_loop
        before = list(self.after)
        after = ['My warm kettle sings by the stove',
                 'Your warm kettle steams my heavy coat']
        bp = {'sections': [{'name': 'VERSE', 'bars': 2, 'start_bar': 1,
                            'function': 'verse',
                            'meter': {'beats': 4, 'unit': 4, 'groups': [2, 2]}}],
              'lines': [{'text': t, 'bar': i + 1, 'beat': 1, 'duration': 4,
                         'section': 'VERSE'} for i, t in enumerate(before)],
              'hooks': ['warm kettle']}
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp')}), \
             contextlib.redirect_stdout(io.StringIO()):
            blueprint = Path(tmp)/'bp.json'
            blueprint.write_text(json.dumps(bp))
            one, two = LH._checkpoint_proposer(lambda *a, **k: None,
                lambda b: after, before, 'whole-cfg', 'fake')
            result = revise_loop(self.r, before, self.m, blueprint=str(blueprint),
                                 propose=one, propose_group=two)
            self.assertEqual(result.stop_reason, 'success')
            self.assertEqual(result.lines, after)
            self.assertEqual([a.tier for r in result.rounds for a in r.attempts], [3])
            outcomes = one.verification_record()['verified_outcomes']
            self.assertEqual(len(outcomes), 1)
            self.assertEqual(outcomes[0]['round'], 1)
            self.assertEqual(outcomes[0]['attempt'], 0)
            self.assertEqual(outcomes[0]['members'], [1, 2])
            self.assertTrue(outcomes[0]['accepted'])
            self.assertTrue(outcomes[0]['applied'])

    def test_nested_partial_replay_preserves_furthest_artifact_and_restores_full_chain(self):
        from quality.loop import _try_tier1
        from quality.schemes import mandate
        import hashlib
        before = ['The elephant elephant elephant elephant elephant elephant ' + word
                  for word in ['stove', 'coat', 'rain', 'stone']]
        answers = ['My kettle whistles by the stove', 'Your fingers brush my heavy coat',
                   'The window shakes beneath the heavy rain',
                   'His folded paper rests upon the stone']
        m = mandate([[1, 2]], n_lines=4, default_relation='class:ASSONANCE')
        calls = []
        def writer(b, *args, **kwargs):
            calls.append(b.line_no)
            return answers[b.line_no - 1]
        def step(one, current, n):
            b = next(b for b in self.r.brief(current, m, include_offers=False)
                     if b.line_no == n)
            b.round_no = 1
            attempt, after = _try_tier1(self.r, b, list(current), m, self.r.rdecl,
                                        None, None, None, None, one)
            self.assertTrue(attempt.accepted, attempt.reason)
            one.checkpoint(after, 1, 'accepted')
            return after
        def digest(lines):
            return hashlib.sha256(json.dumps(lines, ensure_ascii=False,
                separators=(',', ':')).encode()).hexdigest()
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {'LYRIC_CHECKPOINT_PATH': str(Path(tmp)/'cp')}), \
             contextlib.redirect_stdout(io.StringIO()):
            cp = Path(tmp)/'cp'
            one, _ = LH._checkpoint_proposer(writer, None, before, 'nested-cfg', 'fake')
            current = list(before)
            for n in [1, 2, 3]:
                current = step(one, current, n)
            original = json.loads(cp.read_text())
            original_ids = [o['outcome_id'] for o in original['verified_outcomes']]
            self.assertEqual(len(original_ids), 3)
            resumed, _ = LH._checkpoint_proposer(writer, None, before, 'nested-cfg', 'fake')
            step(resumed, list(before), 1)
            partial = json.loads(cp.read_text())
            self.assertEqual(partial['accepted_lines'], original['accepted_lines'])
            self.assertEqual([o['outcome_id'] for o in partial['verified_outcomes']], original_ids[:1])
            self.assertEqual(calls, [1, 2, 3])
            # Another wall interrupts this replay. The next invocation must
            # reconstruct B/C as historical prefix, not lose them or call the
            # provider again. A new D then makes real post-checkpoint progress.
            twice, _ = LH._checkpoint_proposer(writer, None, before, 'nested-cfg', 'fake')
            current = list(before)
            for n in [1, 2, 3, 4]:
                current = step(twice, current, n)
            record = twice.verification_record()
            outcomes, proof = record['verified_outcomes'], record['resume_proof']
            self.assertEqual(current, answers)
            self.assertEqual(calls, [1, 2, 3, 4])
            self.assertEqual([o['outcome_id'] for o in outcomes[:3]], original_ids)
            self.assertEqual(len({o['outcome_id'] for o in outcomes}), 4)
            self.assertEqual(proof['applied_outcome_ids_at_start'], original_ids[:1])
            self.assertEqual(proof['accepted_draft_sha256_at_start'], digest(original['accepted_lines']))
            self.assertEqual(proof['completed_proposals_replayed'], 3)
            self.assertEqual(proof['completed_proposal_redispatches'], 0)
            self.assertEqual(proof['new_proposer_dispatches'], 1)
            position = digest(before)
            for outcome in outcomes:
                self.assertTrue(outcome['accepted'] and outcome['applied'])
                self.assertEqual(outcome['before_draft_sha256'], position)
                position = outcome['applied_draft_sha256']
            self.assertEqual(position, digest(answers))


class DeferredAuditRegressions(unittest.TestCase):
    def test_model_line_labels_are_bound_to_the_requested_target(self):
        from quality.propose import ModelProposer, parse_line
        text = 'I left the basket underneath the oak'
        b = Brief(1, 'Copper cat')
        for wrap in (lambda s: s, lambda s: '```text\n' + s + '\n```',
                     lambda s: 'LINE: ' + s):
            for line in (2, 31):
                raw = wrap(f'L{line}: {text}')
                self.assertIsNone(ModelProposer(lambda p: raw).propose(b, ['Copper cat'], 0))
            self.assertEqual(parse_line(wrap('L1: ' + text), line_no=1), text)
            self.assertEqual(parse_line(wrap(text), line_no=1), text)

    def test_batch_origin_survives_accepted_edits_but_external_mismatch_is_stale(self):
        lines = ['first original line', 'second original line']
        briefs = [Brief(i + 1, t) for i, t in enumerate(lines)]
        for b in briefs:
            b.round_no = 1
        with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()):
            path = Path(tmp) / 'state.json'
            one, _, say = LH._defer_proposer(str(path), lines)
            with self.assertRaises(LH._NeedProposal):
                one.prefetch(briefs[0], briefs[1:], lines)
            say.state['pending']['answer'] = 'L1: first accepted line\nL2: second proposed line'
            saved = json.dumps(say.state)
            for external in [False, True]:
                path.write_text(saved)
                current = list(lines)
                if external:
                    current[1] = 'genuinely changed replay input'
                one, _, say = LH._defer_proposer(str(path), current)
                current[0] = one(briefs[0], current, 0)
                self.assertEqual(one(briefs[1], current, 0), 'second proposed line')
                self.assertEqual(say.record()['stale_answers'], 2 if external else 0)

    def test_group_attempt_keys_and_legacy_binding_are_deterministic(self):
        g = SimpleNamespace(members=(1, 2), attempt=0,
                            brief=SimpleNamespace(round_no=1),
                            proposal_for=lambda n: ('old line', 'word'))
        first = LH._brief_key(g)
        groups = {first: ('new one', 'new two')}
        self.assertEqual(LH._group_lookup(groups, g), ('new one', 'new two'))
        g.attempt = 1
        self.assertNotEqual(first, LH._brief_key(g))
        self.assertIsNone(LH._group_lookup(groups, g))
        # Old journals cannot say which attempt they answered. Bind each old
        # record once, on the deterministic replay walk; repeat reads of that
        # exact question work, but a new retry must ask the writer.
        legacy = LH._group_key((1, 2), ('old line', 'old line'), ('word', 'word'), 1)
        groups = {legacy: ('legacy one', 'legacy two')}
        self.assertEqual(LH._group_lookup(groups, g), ('legacy one', 'legacy two'))
        self.assertEqual(LH._group_lookup(groups, g), ('legacy one', 'legacy two'))
        g.attempt = 2
        self.assertIsNone(LH._group_lookup(groups, g))

    def test_legacy_folded_batch_without_origin_refuses_without_rewriting_journal(self):
        from quality.revise import draft_fingerprint
        lines = ['first original line', 'second original line']
        old = {'version': 1, 'input_draft': lines, 'accepted_lines':
               ['first accepted line', lines[1]], 'pending': None,
               'answered': {'propose_group': [], 'propose': [
                   {'line': n, 'attempt': 0, 'round': 1,
                    'draft': draft_fingerprint(lines), 'text': text}
                   for n, text in enumerate(['first accepted line', 'second proposed line'], 1)]}}
        with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()) as out:
            path = Path(tmp) / 'state.json'
            path.write_text(json.dumps(old))
            before = path.read_bytes()
            with self.assertRaises(SystemExit) as stopped:
                LH._defer_proposer(str(path), lines)
            self.assertEqual(stopped.exception.code, 2)
            self.assertIn('legacy batch origin', out.getvalue())
            self.assertIn('accepted_lines', out.getvalue())
            self.assertEqual(path.read_bytes(), before)

    def test_atomic_round_two_prompt_carries_actual_round_one_rejection(self):
        from quality.revise import Reviser, ReviseDeclaration
        from quality.loop import _try_tier2
        from quality.schemes import mandate
        lines = ['Copper cat', 'Copper cat', 'Azure dog']
        m = mandate([[1, 3], [1, 2]], n_lines=3, returns=[[1, 2]],
                    default_relation='class:ASSONANCE')
        rv = Reviser(rdecl=ReviseDeclaration(max_rounds=2, attempts_per_line=1,
                                            backtrack_width=1))
        b = next(x for x in rv.brief(lines, m) if x.line_no == 1)
        witnessed = False
        with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()):
            path = Path(tmp) / 'state.json'
            for _ in range(8):
                _, group, say = LH._defer_proposer(str(path), lines)
                seen = []
                def capture(g):
                    seen.append(g)
                    return group(g)
                capture.record, capture.prior = group.record, group.prior
                try:
                    for rn in (1, 2):
                        b.round_no = rn
                        _try_tier2(rv, b, lines, m, rv.rdecl, None, None, None, None, capture)
                except LH._NeedProposal as question:
                    g = seen[-1]
                    if rn == 2 and g.prior:
                        self.assertTrue(g.whole_repair)
                        self.assertEqual(g.prior['round'], 1)
                        self.assertIn('ROUND 1', question.prompt)
                        for reason in g.prior['reasons']:
                            self.assertIn(reason, question.prompt)
                        witnessed = True
                        break
                    say.state['pending']['answer'] = '\n'.join(
                        f'L{n}: {lines[n-1]}' for n in question.record['members'])
                    path.write_text(json.dumps(say.state))
                    continue
                break
        self.assertTrue(witnessed, 'the actual atomic repair must reach the next round')

    def test_group_question_identity_includes_pivot_and_full_context(self):
        from dataclasses import replace
        from quality.revise import Reviser, ReviseDeclaration
        from quality.loop import _try_tier2
        from quality.schemes import mandate
        lines = ['Copper cat', 'Copper cat', 'Azure dog', 'The empty room is still']
        m = mandate([[1, 3]], n_lines=4, returns=[[1, 2]],
                    default_relation='class:ASSONANCE')
        rv = Reviser(rdecl=ReviseDeclaration(attempts_per_line=1, backtrack_width=1))
        captured = []
        def writer(g):
            captured.append(g)
            return tuple(lines[n-1] for n in g.members)
        for pivot in (1, 3):
            b = next(b for b in rv.brief(lines, m) if b.line_no == pivot)
            b.round_no = 1
            _try_tier2(rv, b, lines, m, rv.rdecl, None, None, None, None, writer)
        first, second = captured
        self.assertEqual(first.members, second.members)
        self.assertEqual(first.attempt, second.attempt)
        self.assertNotEqual(LH._brief_key(first), LH._brief_key(second),
                            'attempt numbering restarts for each pivot')
        changed = replace(first, lines=tuple(lines[:3] + ['The room now holds a crowd']))
        self.assertNotEqual(LH._brief_key(first), LH._brief_key(changed),
                            'an outside line changes the question context')


if __name__ == '__main__':
    unittest.main()

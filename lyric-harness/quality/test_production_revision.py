"""Production regressions: exact obligations, artifact identity and legal edits.

Offline only: real graders and a deterministic writer at the existing proposer seam.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from quality.revise import Reviser, ReviseDeclaration
from quality.schemes import mandate
from quality.loop import revise_loop, _try_tier2
from quality.propose import parse_group, parse_batch, render_line, render_group
from quality.recover import recover

CLEAN = ['My kettle whistles by the stove', 'Your fingers brush my heavy coat']
LONG = 'The elephant elephant elephant elephant elephant elephant stove'

class ProductionRevisionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reviser = Reviser(rdecl=ReviseDeclaration(max_rounds=2, attempts_per_line=1))
        cls.m = mandate('AA', n_lines=2, default_relation='class:ASSONANCE')

    def test_band_refusal_is_not_repair_or_completion(self):
        r = self.reviser
        result = r.verify([LONG, CLEAN[1]], ['The 123 stove', CLEAN[1]], self.m, targeted={1})
        self.assertFalse(result['accepted'])
        self.assertIn('density:L1', result['layer_coverage_regressions'])
        stopped = revise_loop(r, ['My 123 whistles by the stove', CLEAN[1]], self.m)
        self.assertFalse(stopped.coverage_certified)
        self.assertEqual(stopped.stop_reason, 'uncertified')
        self.assertTrue(any(f.code == 'BAND_UNJUDGED' for f in stopped.findings))
        self.assertTrue(r.inspect(CLEAN, self.m)['coverage']['certified'])

    def test_named_relation_offers_match_exact_grade(self):
        lines = [CLEAN[0], 'Your fingers brush a little leaf']
        for relation in ['class:CONSONANCE', 'class:ASSONANCE', 'type:masculine rhyme']:
            with self.subTest(relation=relation):
                m = mandate('AA', n_lines=2, default_relation=relation)
                b = next(b for b in self.reviser.brief(lines, m) if b.line_no == 2)
                self.assertTrue(b.candidates, relation)
                for word in b.candidates:
                    g = self.reviser.grade([lines[0], 'Your fingers brush a little ' + word], m)
                    self.assertFalse(g['violations'], (relation, word))
                    self.assertEqual(g['pairs_refused'], 0, (relation, word))

    def test_candidate_projection_keeps_exact_selected_verdicts(self):
        from unittest.mock import patch
        from quality import relations
        lines = [CLEAN[0], CLEAN[1], 'The copper basket holds a leaf',
                 'A silver spoon rests by the stove']
        m = mandate([['1.head', '2.head'], [3, 4]], n_lines=4,
                    relations={'A': 'schema:anaphora', 'B': 'schema:perfect rhyme'})
        for first in [lines[0], 'Your kettle whistles by the stove']:
            trial = [first, *lines[1:]]
            full = self.reviser.grade(trial, m)
            # Pair-bound anaphora has no use for a whole-song enumeration;
            # the selected grade must agree with its rows in the full grade.
            with patch.object(relations, 'line_pairs_for', wraps=relations.line_pairs_for) as enumeration:
                partial = self.reviser.grade(trial, m, _only_groups={0})
            self.assertFalse(enumeration.called)
            for key in ['verdicts', 'violations']:
                self.assertEqual(partial[key], [v for v in full[key] if v['group'] == 0])
            self.assertEqual(partial['refused_obligations'],
                             [row for row in full['refused_obligations'] if row[2] == 0])

    def test_per_slot_offer_preserves_existing_other_slot_failures(self):
        r = self.reviser
        lines = ['cat blue', 'sown shoe', 'plain home']
        m = mandate([['1.T1', '2.T1'], [1, 3]], n_lines=3, default_relation='class:RHYME')
        before = r.grade(lines, m)
        after = r.grade(['bone blue', *lines[1:]], m)
        self.assertEqual({v['group'] for v in before['violations']}, {0, 1})
        self.assertEqual({v['group'] for v in after['violations']}, {1})
        self.assertFalse(before['refusals'] or after['refusals'])
        self.assertEqual(r.declared_offer(['bone', 'leaf'], lines, m, 1, m.slot_of(0, 1), [0]),
                         (['bone'], ['leaf']))

        # The scalar/mosaic comparator still rechecks collateral obligations:
        # a previously satisfied different demand may not become a violation.
        lines = ['cat blue', 'sown shoe', 'coat home']
        m = mandate([['1.T1', '2.T1'], ['1.T1', '3.T1']], n_lines=3,
                    relations={'A': 'class:RHYME', 'B': 'class:CONSONANCE'})
        before = r.grade(lines, m)
        after = r.grade(['bone blue', *lines[1:]], m)
        self.assertEqual({v['group'] for v in before['violations']}, {0})
        self.assertEqual({v['group'] for v in after['violations']}, {1})
        self.assertEqual(r.declared_offer(['bone'], lines, m, 1, m.slot_of(0, 1), [0]),
                         ([], ['bone']))

        # Existing uncertainty is retained rather than advertised as a pass.
        lines = ['cat wind', 'sown shoe', 'plain find']
        m = mandate([['1.T1', '2.T1'], [1, 3]], n_lines=3, default_relation='class:RHYME')
        before = r.grade(lines, m)
        after = r.grade(['bone wind', *lines[1:]], m)
        self.assertTrue(before['refusals'])
        self.assertEqual(before['refused_obligations'], after['refused_obligations'])
        self.assertEqual(r.declared_offer(['bone'], lines, m, 1, m.slot_of(0, 1), [0]),
                         (['bone'], []))

    def test_requested_pair_grading_matches_full_stream_answers(self):
        from unittest.mock import patch
        from quality import relations
        cases = [
            (['A cat rests beside a gate', 'A hat waits beside a plate',
              'A dog sleeps beside a stone'], 'schema:perfect rhyme'),
            (['The dusty lamps grow dim and cold', 'I fold the morning in a sheet',
              'A dog sleeps beside a stone'], ''),
        ]
        lpf = relations.line_pairs_for
        wvp = relations.whole_vocabulary_pairs
        for lines, relation in cases:
            m = mandate([[1, 2]], n_lines=3, default_relation=relation)
            with patch.object(relations, 'line_pairs_for', wraps=lpf) as pair_query, \
                    patch.object(relations, 'whole_vocabulary_pairs', wraps=wvp) as fan_query:
                projected = self.reviser.grade(lines, m, sections=['verse'] * 3)
            calls = pair_query.call_args_list if relation else fan_query.call_args_list
            self.assertTrue(calls, relation)
            self.assertTrue(all(call.kwargs.get('requested_pairs') == {(1, 2)} for call in calls))
            def full_pairs(*args, **kwargs):
                kwargs.pop('requested_pairs', None)
                return lpf(*args, **kwargs)
            def full_fan(*args, **kwargs):
                kwargs.pop('requested_pairs', None)
                return wvp(*args, **kwargs)
            with patch.object(relations, 'line_pairs_for', side_effect=full_pairs), \
                    patch.object(relations, 'whole_vocabulary_pairs', side_effect=full_fan):
                complete = self.reviser.grade(lines, m, sections=['verse'] * 3)
            self.assertEqual(projected, complete, relation)

    def test_failed_requested_offer_does_not_evaluate_collateral_fan(self):
        from unittest.mock import patch
        r = self.reviser
        lines = ['cat blue', 'find shoe', 'plain home']
        m = mandate([['1.T1', '2.T1'], [1, 3]], n_lines=3,
                    relations={'A': 'class:RHYME'})
        actual_grade = r.grade
        measured = [actual_grade([word + ' blue', *lines[1:]], m, _only_groups={0})
                    for word in ['leaf', 'wind']]
        self.assertTrue(measured[0]['violations'])
        self.assertTrue(measured[1]['refused_obligations'])
        # Both definite failure and actual pronunciation uncertainty stop
        # before the unrelated default group's 77-schema fan is entered.
        with patch.object(r, 'grade', wraps=actual_grade) as graded:
            self.assertEqual(r.declared_offer(['leaf', 'wind'], lines, m, 1,
                                             m.slot_of(0, 1), [0]),
                             ([], ['leaf', 'wind']))
        self.assertEqual(len(graded.call_args_list), 2)
        self.assertTrue(all(call.kwargs['_only_groups'] == {0}
                            for call in graded.call_args_list))

    def test_requested_first_offer_matches_complete_grade_oracle(self):
        from quality.loop import swap_at_slot
        r = self.reviser
        cases = [
            (['cat blue', 'sown shoe', 'plain home'], 'class:RHYME',
             ['bone', 'leaf', 'wind', 'bone', 'zzunreadablezz']),
            (['cat blue', 'sown shoe', 'coat home'], 'class:CONSONANCE',
             ['leaf', 'bone', 'cat']),
            (['cat wind', 'sown shoe', 'plain find'], 'class:RHYME',
             ['leaf', 'bone', 'cat']),
        ]
        def failures(grade):
            return {(min(v['lines']), max(v['lines']), v['group'])
                    for v in grade['violations']}
        for lines, collateral, words in cases:
            m = mandate([['1.T1', '2.T1'],
                         ['1.T1', '3.T1'] if collateral == 'class:CONSONANCE' else [1, 3]],
                        n_lines=3, relations={'A': 'class:RHYME', 'B': collateral})
            before = r.grade(lines, m)
            before_bad = failures(before)
            before_unknown = set(map(tuple, before['refused_obligations']))
            for limit in [None, 1]:
                expected = ([], [])
                for word in dict.fromkeys(words):
                    trial = [swap_at_slot(lines[0], m.slot_of(0, 1), word), *lines[1:]]
                    # The oracle asks the whole mandate, with no group
                    # projection or early rejection, for every candidate.
                    after = r.grade(trial, m)
                    bad = failures(after)
                    unknown = set(map(tuple, after['refused_obligations']))
                    blocked = (any(k == 0 and 1 in (i, j) for i, j, k in bad | unknown)
                               or bool(bad - before_bad) or bool(unknown - before_unknown))
                    expected[1 if blocked else 0].append(word)
                    if limit is not None and len(expected[0]) >= limit:
                        break
                with self.subTest(lines=lines, limit=limit):
                    self.assertEqual(r.declared_offer(words, lines, m, 1, m.slot_of(0, 1),
                                                     [0], limit=limit), expected)

    def test_default_fan_keeps_real_unknown_out_of_verdicts(self):
        import battery
        lines = battery.parse_sonnets(battery.corpus_path('sonnets.txt'))[92]
        m = mandate('ABABCDCDEFEFGG', n_lines=14)
        result = self.reviser.grade(lines, m)
        self.assertIn((5, 7, 2), result['refused_obligations'])
        for key in ['verdicts', 'violations']:
            self.assertFalse(any(tuple(v['lines']) == (5, 7)
                                 for v in result[key]), key)

    def test_assessment_retains_findings_without_candidate_search(self):
        from unittest.mock import patch
        from dataclasses import asdict
        lines = [CLEAN[0], 'Your fingers brush a little leaf']
        m = mandate('AA', n_lines=2, default_relation='class:CONSONANCE')
        with patch.object(self.reviser, 'declared_offer', side_effect=AssertionError('unused menu')):
            assessed = self.reviser.brief(lines, m, include_offers=False)
        full = self.reviser.brief(lines, m)
        self.assertEqual([(b.line_no, b.findings, b.must_answer, b.return_members)
                          for b in assessed],
                         [(b.line_no, b.findings, b.must_answer, b.return_members)
                          for b in full])
        self.assertTrue(all(not b.offers_requested for b in assessed))
        selected = self.reviser.brief(lines, m, target_lines={2})
        self.assertEqual([asdict(b) for b in selected],
                         [asdict(b) for b in full if b.line_no == 2])

    def test_loop_materializes_only_imminent_writer_brief(self):
        from unittest.mock import patch
        class QuestionObserved(Exception):
            pass
        seen = []
        def writer(brief, lines, attempt, reasons=None, whole=()):
            seen.append(brief)
            self.assertTrue(brief.offers_requested)
            raise QuestionObserved()
        with patch.object(self.reviser, 'brief', wraps=self.reviser.brief) as calls:
            with self.assertRaises(QuestionObserved):
                revise_loop(self.reviser, [LONG, CLEAN[1]], self.m, propose=writer)
        self.assertEqual(len(seen), 1)
        actual = [c for c in calls.call_args_list if c.kwargs.get('include_offers', True)]
        self.assertEqual(len(actual), 1)
        self.assertEqual(actual[0].kwargs['target_lines'], {seen[0].line_no})

    def test_zero_writer_budgets_skip_offers_with_full_verdict_parity(self):
        from unittest.mock import patch
        r = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=0, backtrack_width=0))
        lines = [CLEAN[0], 'Your fingers brush a little leaf']
        m = mandate('AA', n_lines=2, default_relation='class:ASSONANCE')
        original = r.brief
        with patch.object(r, 'declared_offer', side_effect=AssertionError('unconsumed menu')), \
                patch.object(r, 'brief', wraps=original) as calls:
            result = revise_loop(r, lines, m,
                                 propose=lambda *args: self.fail('zero-budget line writer called'),
                                 propose_group=lambda *args: self.fail('zero-budget group writer called'))
        self.assertTrue(result.unresolved)
        self.assertTrue(all(c.kwargs.get('include_offers') is False for c in calls.call_args_list))
        self.assertTrue(all(not a.asked and a.tried == 0 for rr in result.rounds for a in rr.attempts))
        self.assertTrue(all('NOT ASKED' in a.reason for rr in result.rounds for a in rr.attempts))
        def full_menu(*args, **kwargs):
            kwargs['include_offers'] = True
            return original(*args, **kwargs)
        with patch.object(r, 'brief', side_effect=full_menu):
            baseline = revise_loop(r, lines, m)
        for key in ['stop_reason', 'lines', 'coverage', 'findings', 'whole']:
            self.assertEqual(getattr(result, key), getattr(baseline, key), key)
        self.assertEqual([(b.line_no, b.findings) for b in result.unresolved],
                         [(b.line_no, b.findings) for b in baseline.unresolved])

    def test_zero_line_budget_keeps_nonzero_backtrack_offer(self):
        from unittest.mock import patch
        class BacktrackReached(Exception):
            pass
        r = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=0, backtrack_width=1))
        def group_path(reviser, brief, *args, **kwargs):
            self.assertTrue(brief.offers_requested)
            raise BacktrackReached()
        with patch('quality.loop._try_tier2', side_effect=group_path), \
                patch.object(r, 'brief', wraps=r.brief) as calls:
            with self.assertRaises(BacktrackReached):
                revise_loop(r, [CLEAN[0], 'Your fingers brush a little leaf'],
                            mandate('AA', n_lines=2, default_relation='class:ASSONANCE'),
                            propose_group=lambda *args: None)
        self.assertTrue(any(c.kwargs.get('include_offers', True) for c in calls.call_args_list))

    def test_replay_memo_distinguishes_assessment_and_exact_questions(self):
        from quality.replay_memo import MemoReviser
        slot = {'store': {}, 'cap': 16,
                'tally': {'hit': 0, 'miss': 0, 'bypass': 0, 'overflow': 0}}
        memo = MemoReviser(self.reviser, slot)
        lines = [LONG, CLEAN[1]]
        assessed = memo.brief(lines, self.m, include_offers=False)
        target = assessed[0].line_no
        full = memo.brief(lines, self.m, target_lines={target})
        self.assertEqual([b.line_no for b in full], [target])
        self.assertTrue(full[0].offers_requested)
        self.assertTrue(all(not b.offers_requested for b in assessed))
        again = memo.brief(lines, self.m, target_lines={target})
        self.assertEqual(again, full)
        self.assertEqual(slot['tally']['miss'], 2)
        self.assertEqual(slot['tally']['hit'], 1)

    def test_proposal_work_overflow_preserves_artifact_before_assessment(self):
        from unittest.mock import patch
        original = [' '.join(['love'] * 12)] * 31
        before = list(original)
        after = [' '.join(['a'] * 100), *before[1:]]
        self.assertEqual(len(after[0]), 199)
        m = mandate([[1, 2]], n_lines=31, default_relation='class:RHYME')
        with patch.object(self.reviser, 'brief', side_effect=AssertionError('menu before admission')), \
                patch.object(self.reviser, 'inspect', side_effect=AssertionError('assessment before admission')):
            result = self.reviser.verify(before, after, m, targeted={1})
        self.assertFalse(result['accepted'])
        self.assertEqual(result['stop_reason'], 'RESOURCE_LIMIT')
        self.assertFalse(result['execution_limits']['within_budget'])
        self.assertEqual(before, original)

    def test_recovery_does_not_turn_equal_words_into_equal_lines(self):
        lines = ['You shut the little kitchen door', 'I leave my shoes beside your door']
        r = recover(lines, raw_lines=['[VERSE]'] + lines, placements=['end'])
        self.assertEqual(r['mandate_spelling']['--returns='], '')
        self.assertEqual(r.how['repeated_end_words'][0], 'REFUSED')
        r = recover([CLEAN[0]] * 2, raw_lines=['[CHORUS]'] + [CLEAN[0]] * 2, placements=['end'])
        self.assertEqual(r['mandate_spelling']['--returns='], '1,2')
        m = mandate([[1, 2]], n_lines=2, returns=[[1, 2]])
        self.assertFalse(m.returns_check([CLEAN[0]] * 2))

    def test_recovery_accounts_for_unmarked_prefix(self):
        r = recover(CLEAN, raw_lines=[CLEAN[0], '[CHORUS]', CLEAN[1]], placements=['end'])
        self.assertEqual(sum(s['lines'] for s in r['sections']), len(CLEAN))
        self.assertEqual(r.how['sections'][0], 'REFUSED')
        self.assertIsNone(r['sections'][0]['name'])

    def test_targets_are_exact_and_nonempty(self):
        before = [CLEAN[0], LONG.replace('stove', 'coat')]
        after = CLEAN
        self.assertTrue(self.reviser.verify(before, after, self.m, targeted={2})['accepted'])
        self.assertTrue(self.reviser.verify(before, after, self.m, targeted={1, 2})['accepted'])
        for targets in [set(), {1}, {2, 99}, {True, 2}]:
            self.assertFalse(self.reviser.verify(before, after, self.m, targeted=targets)['accepted'], targets)

    def test_group_answers_consume_every_row(self):
        for parse in [parse_group, parse_batch]:
            self.assertIsNone(parse('L1: outside one\nL2: outside two\n```\nL1: inside one\nL2: inside two\n```', (1, 2)))
            self.assertIsNone(parse('L1: the first\nunmarked lyric row\nL2: the second', (1, 2)))
            self.assertIsNone(parse('L1: first\nL1: correction\nL2: second', (1, 2)))
            self.assertIsNotNone(parse('```\nL2: second\nL1: first\n```', (1, 2)))
        self.assertEqual(parse_group('L2: second\nL1: first', (1, 2)), ('first', 'second'))

    def test_return_closure_from_actual_mandate_preserves_unrelated_line(self):
        before = [LONG, LONG, CLEAN[1]]
        for groups in [[[1, 2, 3]], [[1, 2, 3], [1, 2]], [[1, 3]]]:
            with self.subTest(groups=groups):
                m = mandate(groups, n_lines=3, returns=[[1, 2]], default_relation='class:ASSONANCE')
                r = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=1))
                b = next(b for b in r.brief(before, m) if b.line_no == 1)
                self.assertEqual(b.return_members, (1, 2))
                prompt = render_line(b, before)
                self.assertIn('applies your one answer to L1, L2', prompt)
                result = revise_loop(r, before, m, propose=lambda *args: CLEAN[0])
                self.assertEqual(result.lines, [CLEAN[0], CLEAN[0], CLEAN[1]])
                self.assertFalse(m.returns_check(result.lines))
                self.assertFalse(r.grade(result.lines, m)['violations'])

    def test_declared_returns_cannot_require_variation_of_fixed_openings(self):
        for n in [2, 12]:
            lines = [CLEAN[0]] * n
            m = mandate([list(range(1, n + 1))], n_lines=n, returns=[list(range(1, n + 1))])
            found = self.reviser.inspect(lines, m)
            fs = [f for rows in found['per_line'].values() for f in rows]
            self.assertFalse(any(f.code == 'ANAPHORA_OVERLOAD' for f in fs))
            self.assertTrue(any(f.code == 'ANAPHORA_DECLARED' for f in fs))
            self.assertFalse(any(f.code == 'LEXICAL_MONOTONY' for f in found['whole']))
            self.assertTrue(any(f.code == 'LEXICAL_REPETITION_DECLARED' for f in found['whole']))
        # Unrequired repetition remains a defect under the existing calibration.
        unrequired = self.reviser.inspect([CLEAN[0]] * 12, mandate([[1, 2]], n_lines=12))
        self.assertTrue(any(f.code == 'ANAPHORA_OVERLOAD' for rows in unrequired['per_line'].values() for f in rows))
        self.assertTrue(any(f.code == 'LEXICAL_MONOTONY' for f in unrequired['whole']))
        low = ['The kettle kettle kettle kettle kettle stove'] * 2
        poor = self.reviser.inspect(low, mandate([], n_lines=2, returns=[[1, 2]]))
        self.assertTrue(any(f.code == 'LEXICAL_MONOTONY' for f in poor['whole']))

    def test_whole_only_flag_calls_writer_and_rechecks(self):
        bp = {'sections': [{'name': 'VERSE', 'bars': 2, 'start_bar': 1, 'function': 'verse',
                            'meter': {'beats': 4, 'unit': 4, 'groups': [2, 2]}}],
              'lines': [{'text': t, 'bar': i + 1, 'beat': 1, 'duration': 4, 'section': 'VERSE'}
                        for i, t in enumerate(CLEAN)], 'hooks': ['warm kettle']}
        seen = []
        def writer(g):
            seen.append(render_group(g))
            return ['My warm kettle sings by the stove', 'Your warm kettle steams my heavy coat']
        result = revise_loop(self.reviser, CLEAN, self.m, blueprint=bp, propose_group=writer)
        self.assertTrue(seen)
        self.assertIn('HOOK_ABSENT', seen[0])
        self.assertFalse(any(f.code == 'HOOK_ABSENT' for f in result.whole_flags))
        self.assertNotEqual(result.lines, CLEAN)

    def test_backtracking_visits_earlier_sibling_alternatives(self):
        m = mandate([[1, 2, 3], [1, 4]], n_lines=4)
        fields = {('bound',): ['p'], ('p',): ['a', 'b'], ('p', 'a'): [], ('p', 'b'): ['c']}
        visited, asked = [], []
        class Search:
            def _incumbent(self, lines, n, slot): return lines[n - 1]
            def joint_field(self, calls, exclude=(), profile=None):
                visited.append(tuple(calls)); return fields.get(tuple(calls), []), []
        b = SimpleNamespace(line_no=1, text='old1', must_answer=[('A', [1, 2, 3], [(2, 'old2'), (3, 'old3')]),
                            ('B', [1, 4], [(4, 'bound')])], slot_groups=('A', 'B'), return_groups=(),
                            forbidden_incumbent='old1', round_no=1)
        def writer(g): asked.append(g); return None
        a, _ = _try_tier2(Search(), b, ['old1', 'old2', 'old3', 'bound'], m,
                         ReviseDeclaration(backtrack_width=2), None, None, None, None, writer)
        self.assertIn(('p', 'b'), visited)
        self.assertTrue(any(g.label == 'A' and [x.word for x in g.anchors] == ['b', 'c'] for g in asked))
        self.assertNotIn('unsatisfiable', a.reason)

    def test_unresolved_pronunciation_cannot_certify_scalar_rhyme(self):
        lines = ['A mighty wind', 'The things I find']
        for relation in ['', 'class:RHYME']:
            m = mandate('AA', n_lines=2, default_relation=relation)
            grade = self.reviser.grade(lines, m)
            self.assertEqual(grade['pairs_refused'], 1)
            self.assertFalse(grade['violations'])

    def test_whole_repair_suspends_and_resumes_through_cli(self):
        bp = {'sections': [{'name': 'VERSE', 'bars': 2, 'start_bar': 1, 'function': 'verse',
                            'meter': {'beats': 4, 'unit': 4, 'groups': [2, 2]}}],
              'lines': [{'text': t, 'bar': i + 1, 'beat': 1, 'duration': 4, 'section': 'VERSE'}
                        for i, t in enumerate(CLEAN)], 'hooks': ['warm kettle']}
        with tempfile.TemporaryDirectory() as tmp:
            draft, blueprint, state = (Path(tmp) / n for n in ['draft.txt', 'blueprint.json', 'state.json'])
            draft.write_text('\n'.join(CLEAN), encoding='utf-8')
            blueprint.write_text(json.dumps(bp), encoding='utf-8')
            argv = [sys.executable, str(Path(__file__).resolve().parents[1] / 'lyric_harness.py'),
                    'revise', str(draft), 'AA', '--relation=class:ASSONANCE',
                    '--attempts=1', '--backtrack=0', '--max-rounds=2',
                    '--blueprint=' + str(blueprint), '--propose=defer:' + str(state)]
            pending = subprocess.run(argv, text=True, capture_output=True, timeout=90)
            self.assertEqual(pending.returncode, 4, pending.stdout + pending.stderr)
            suspended_record = [json.loads(row.split('lyric result: ', 1)[1])
                                for row in pending.stdout.splitlines()
                                if row.startswith('  lyric result: ')][-1]
            self.assertEqual(suspended_record['status'], 'suspended')
            self.assertIn('memo_state', suspended_record)
            self.assertEqual(suspended_record['stale_answers'], 0)
            saved = json.loads(state.read_text())
            self.assertIn('HOOK_ABSENT', saved['pending']['prompt'])
            saved['pending']['answer'] = ('L1: My warm kettle sings by the stove\n'
                                          'L2: Your warm kettle steams my heavy coat')
            state.write_text(json.dumps(saved), encoding='utf-8')
            finished = subprocess.run(argv, text=True, capture_output=True, timeout=90)
            self.assertEqual(finished.returncode, 0, finished.stdout + finished.stderr)
            records = [json.loads(row.split('lyric result: ', 1)[1]) for row in finished.stdout.splitlines()
                       if row.startswith('  lyric result: ')]
            self.assertTrue(records[-1]['coverage']['certified'])
            self.assertEqual(records[-1]['stop'], 'success')
            self.assertEqual(records[-1]['stop_reason'], 'SUCCESS')
            self.assertIn('memo_asked', records[-1])
            self.assertEqual(records[-1]['stale_answers'], 0)
            self.assertFalse(records[-1]['whole_flags'])
            self.assertEqual(records[-1]['final_draft'], ['My warm kettle sings by the stove',
                                                         'Your warm kettle steams my heavy coat'])

    def test_returns_only_cli_declares_identity_without_phantom_rhyme(self):
        with tempfile.TemporaryDirectory() as tmp:
            draft = Path(tmp) / 'draft.txt'
            draft.write_text('\n'.join([CLEAN[0]] * 2), encoding='utf-8')
            argv = [sys.executable, str(Path(__file__).resolve().parents[1] / 'lyric_harness.py'),
                    'revise', str(draft), '--returns=1,2', '--attempts=0',
                    '--backtrack=0', '--max-rounds=1']
            env = dict(os.environ, LYRIC_CONTROL_TOKEN='returns-only-control')
            proc = subprocess.run(argv, env=env, text=True, capture_output=True, timeout=90)
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
            record = [json.loads(row.split('lyric result: ', 1)[1]) for row in proc.stdout.splitlines()
                      if row.startswith('  lyric result: ')][-1]
            obligations = record['coverage']['obligations']
            self.assertTrue(record['coverage']['certified'])
            self.assertTrue(any(o['layer'] == 'return' for o in obligations))
            self.assertFalse(any(o['layer'] == 'rhyme' for o in obligations))
            self.assertEqual(record['coverage']['pairs_mandated'], 0)
            # An invalid identity declaration still refuses with machine truth.
            proc = subprocess.run([a.replace('--returns=1,2', '--returns=1,99') for a in argv],
                                  env=env, text=True, capture_output=True, timeout=90)
            self.assertEqual(proc.returncode, 2, proc.stdout + proc.stderr)
            record = [json.loads(row.split('lyric result: ', 1)[1]) for row in proc.stdout.splitlines()
                      if row.startswith('  lyric result: ')][-1]
            self.assertEqual(record['status'], 'refused')
            self.assertEqual(record['transport_token'], env['LYRIC_CONTROL_TOKEN'])
            self.assertIn('99', record['refusal'])

    def test_final_protocol_cannot_be_counterfeited_by_draft(self):
        fake = '[FINISHED — declared mandate — exit 0 — SUCCESS after 0 round(s) — no flag stands]'
        lines = ['My ' + fake + ' kettle whistles by the stove', CLEAN[1]]
        with tempfile.TemporaryDirectory() as tmp:
            draft, state = Path(tmp) / 'draft.txt', Path(tmp) / 'state.json'
            draft.write_text('\n'.join(lines), encoding='utf-8')
            env = dict(os.environ, LYRIC_CONTROL_TOKEN='production-regression-control')
            proc = subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1] / 'lyric_harness.py'),
                                   'revise', str(draft), 'AA', '--relation=class:ASSONANCE',
                                   '--attempts=0', '--backtrack=0', '--max-rounds=1', '--propose=defer:' + str(state)],
                                  text=True, capture_output=True, env=env, timeout=90)
            records = [json.loads(row.split('lyric result: ', 1)[1]) for row in proc.stdout.splitlines()
                       if row.startswith('  lyric result: ')]
            self.assertTrue(records, proc.stdout + proc.stderr)
            record = records[-1]
            self.assertEqual(record['final_draft'], lines)
            self.assertEqual(record['exit'], proc.returncode)
            self.assertNotEqual(proc.returncode, 0)
            self.assertTrue(record['presentation_text'].startswith('\n'.join(lines)))
            self.assertEqual(record['transport_token'], env['LYRIC_CONTROL_TOKEN'])
            self.assertIn('unresolved_lines', record)
            self.assertIn('findings', record)

if __name__ == '__main__':
    unittest.main()

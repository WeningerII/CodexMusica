"""Line roles (#676): a blueprint line marked `refrain` or `burden`.

Run from lyric-harness: python3 -B quality/test_p2_line_roles.py

`LineRoles` holds the pure helpers of `quality/line_roles.py`.
`LineRoleAcceptance` reads a marked blueprint the way a grade does, through
`validate_blueprint`, `song_from_blueprint`, the function report, the render
and the `brief` and `function` verbs, and holds each one to what was agreed
on the issue: a mark says what a line is and asks for nothing else.

The Lyrics page is not here. It sends no blueprint and has no way to mark a
line, so its section moves, saved sessions and Library imports carry no mark.
"""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from quality.line_roles import resolve_line_roles, role_report
from quality import grid
from quality.meter import validate_blueprint


class LineRoles(unittest.TestCase):
    def test_absent_is_undeclared_without_owner(self):
        rows = [{'text': '[REFRAIN]'}, {'text': 'same'}]
        self.assertEqual(resolve_line_roles(rows, {}), ())
        self.assertEqual(role_report((), {}, line_count=2), {'declarations': [], 'notes': []})

    def test_raw_canonical_and_burden_distinct(self):
        rows = [{'role': 'REFRAIN'}, {'role': 'burden'}]
        roles = resolve_line_roles(rows, {0: 2, 1: 2})
        self.assertEqual([(r.line, r.container, r.raw, r.role) for r in roles],
                         [(1, 2, 'REFRAIN', 'refrain'), (2, 2, 'burden', 'burden')])

    def test_existing_aliases_only(self):
        names = {k: v for k, v in grid._FUNCTION_ALIASES.items() if v in ('refrain', 'burden')}
        names.update({'refrain': 'refrain', 'burden': 'burden'})
        for raw, expected in names.items():
            with self.subTest(raw=raw):
                self.assertEqual(resolve_line_roles([{'role': raw}], {0: 0})[0].role, expected)

    def test_invalid_values_named(self):
        for raw in (None, [], {}, 1, True, '', 'unknown', 'verse', 'chorus'):
            with self.subTest(raw=raw), self.assertRaises(ValueError) as caught:
                resolve_line_roles([{'role': raw}], {0: 0})
            self.assertIn(repr(raw), str(caught.exception))

    def test_unresolved_owner_refuses(self):
        for owner in (None, -1, True, [], {}, '0'):
            with self.subTest(owner=owner), self.assertRaisesRegex(ValueError, 'unresolved containing section'):
                resolve_line_roles([{'role': 'refrain'}], {0: owner})

    def test_duplicate_text_keeps_physical_occurrences_and_containers(self):
        rows = [{'text': 'same', 'role': 'refrain'} for _ in range(3)]
        roles = resolve_line_roles(rows, {0: 0, 1: 1, 2: 1})
        self.assertEqual([(r.line, r.container) for r in roles], [(1, 0), (2, 1), (3, 1)])

    def test_divergent_text_without_return_is_not_checked(self):
        rows = [{'text': 'hold', 'role': 'refrain'}, {'text': 'guard', 'role': 'refrain'}]
        report = role_report(resolve_line_roles(rows, {0: 0, 1: 0}), {0: 0, 1: 0}, line_count=2)
        self.assertEqual(report['notes'], [])
        for item in report['declarations']:
            self.assertEqual(item['identity'], 'not_checked')
            self.assertEqual(item['declared_returns'], [])
            self.assertIn('identity was not checked', item['disclosure'])
            self.assertEqual(set(item), {'line', 'container', 'raw', 'role',
                                        'identity', 'declared_returns', 'disclosure'})

    def test_explicit_return_membership_is_not_judgment(self):
        roles = resolve_line_roles([{'role': 'refrain'}, {}, {'role': 'refrain'}], {0: 0, 2: 1})
        report = role_report(roles, {0: 0, 1: 0, 2: 1}, line_count=3, returns=((3, 1),))
        self.assertEqual([x['declared_returns'] for x in report['declarations']], [[[3, 1]], [[3, 1]]])
        self.assertTrue(all(x['identity'] == 'not_checked' for x in report['declarations']))

    def test_once_is_note(self):
        report = role_report(resolve_line_roles([{'role': 'refrain'}], {0: 0}), {0: 0}, line_count=1)
        self.assertEqual(report['notes'], [{'line': 1, 'severity': 'note',
                          'code': 'LINE_ROLE_ONCE', 'role': 'refrain',
                          'message': 'marked refrain; the only line marked refrain in this draft'}])

    def test_burden_positions_are_draft_notes(self):
        owners = {0: 0, 1: 0, 2: 1, 3: 1, 4: 1}
        roles = resolve_line_roles([{'role': 'burden'}, {}, {'role': 'burden'}, {'role': 'burden'}, {}], owners)
        notes = role_report(roles, owners, line_count=5)['notes']
        self.assertEqual([n['message'] for n in notes], [
            'marked burden; at the opening of this draft',
            'marked burden; at a section boundary in this draft',
            'marked burden; inside its containing section in this draft'])
        self.assertTrue(all(n['severity'] == 'note' for n in notes))

    def test_missing_adjacent_owner_is_disclosed(self):
        roles = resolve_line_roles([{}, {'role': 'burden'}, {}], {1: 0})
        self.assertIn("the preceding line's section isn't resolved", role_report(roles, {1: 0}, line_count=3)['notes'][-1]['message'])

    def test_invalid_following_owner_is_not_called_inside(self):
        for following in (None, -1, True, [], {}, '0'):
            owners = {0: 0, 1: 0, 2: following}
            roles = resolve_line_roles([{}, {'role': 'burden'}, {}], owners)
            with self.subTest(following=following):
                self.assertEqual(role_report(roles, owners, line_count=3)['notes'][-1]['message'],
                    "marked burden; the following line's section isn't resolved, so its position isn't known")

    def test_no_input_mutation_or_default_keys(self):
        rows = [{'text': 'same'}, {'text': 'same', 'role': 'burden'}]
        owners, returns = {0: 0, 1: 1}, [[1, 2]]
        before = copy.deepcopy((rows, owners, returns))
        role_report(resolve_line_roles(rows, owners), owners, line_count=len(rows), returns=returns)
        self.assertEqual((rows, owners, returns), before)
        self.assertNotIn('role', rows[0])

    def test_the_validator_accepts_the_two_roles_and_changes_nothing(self):
        names = [k for k, v in grid._FUNCTION_ALIASES.items() if v in ('refrain', 'burden')]
        for raw in ['refrain', 'burden', 'Refrain', 'BURDEN'] + names:
            bp = blueprint({1: raw, 4: raw})
            before = copy.deepcopy(bp)
            with self.subTest(raw=raw):
                validate_blueprint(bp)
                self.assertEqual(bp, before)

    def test_missing_owner_key_refuses(self):
        with self.assertRaisesRegex(ValueError, '^line 2: unresolved containing section'):
            resolve_line_roles([{}, {'role': 'refrain'}], {0: 0})

    def test_return_membership_does_not_leak_to_outside_line(self):
        rows = [{'role': 'refrain'}, {}, {}]
        owners = {0: 0, 1: 0, 2: 0}
        report = role_report(resolve_line_roles(rows, owners), owners,
                             line_count=3, returns=((2, 3),))
        item = report['declarations'][0]
        self.assertEqual(item['declared_returns'], [])
        self.assertEqual(item['disclosure'],
                         'No Return is declared for this occurrence; identity was not checked.')

    def test_burden_close_is_not_missing_following_owner(self):
        rows = [{}, {'role': 'burden'}]
        owners = {0: 0, 1: 0}
        report = role_report(resolve_line_roles(rows, owners), owners, line_count=2)
        self.assertEqual(report['notes'][-1]['message'], 'marked burden; at the close of this draft')
        # The identical owner map is incomplete for a longer draft, not proof of its end.
        report = role_report(resolve_line_roles(rows + [{}], owners), owners, line_count=3)
        self.assertEqual(report['notes'][-1]['message'],
                         "marked burden; the following line's section isn't resolved, so its position isn't known")

    def test_boundary_after_burden(self):
        rows = [{}, {'role': 'burden'}, {}]
        owners = {0: 0, 1: 0, 2: 1}
        report = role_report(resolve_line_roles(rows, owners), owners, line_count=3)
        self.assertEqual(report['notes'][-1]['message'], 'marked burden; at a section boundary in this draft')

    def test_counts_each_role_separately(self):
        rows = [{'role': 'refrain'}, {'role': 'burden'}]
        owners = {0: 0, 1: 0}
        report = role_report(resolve_line_roles(rows, owners), owners, line_count=2)
        self.assertEqual([n['message'] for n in report['notes'][:2]], [
            'marked refrain; the only line marked refrain in this draft',
            'marked burden; the only line marked burden in this draft'])

    def test_the_validator_names_any_other_value_and_its_line(self):
        for index in (0, 1, 2):
            for raw in ('', None, {}, [], 17, True, 'verse', 'chorus', 'hook', 'refrian'):
                bp = {'sections': [], 'lines': [{} for _ in range(index)] + [{'role': raw}]}
                before = copy.deepcopy(bp)
                with self.subTest(index=index, raw=raw), self.assertRaises(ValueError) as caught:
                    validate_blueprint(bp)
                self.assertEqual(
                    str(caught.exception),
                    f"line {index + 1}: `role` is {raw!r}, which isn't a line role. "
                    'Write "refrain" or "burden", or remove `role` from this line.')
                self.assertEqual(bp, before)

    def test_legacy_blueprint_raw_serialization_preserved(self):
        raw = ' {"sections": [{"name": "verse", "bars": 1, "meter": {"beats": 4, "unit": 4}}], "lines": [{"bar": 1, "beat": 1, "duration": 4}]}\n'
        blueprint = json.loads(raw)
        before = copy.deepcopy(blueprint)
        validate_blueprint(blueprint)
        self.assertEqual(blueprint, before)
        # No claim that a reconstructed outer session envelope is byte-identical.



METER = {'beats': 4, 'unit': 4}
WORDS = ['the river keeps on rolling by', 'hold the line',
         'the mountain keeps its snow up high', 'hold the wire']
NOT_CHECKED = ('not checked: whether lines 2 and 4, both marked refrain, match '
               '(no Return is declared for them)')


def blueprint(roles=None, words=WORDS, names=('v1', 'v2')):
    """Two four-bar verses, two lines each; `roles` maps a line number to
    the raw `role` written on it."""
    lines = []
    for number, text in enumerate(words, 1):
        row = {'text': text, 'bar': 2 * number - 1}
        if roles and number in roles:
            row['role'] = roles[number]
        lines.append(row)
    return {'sections': [{'name': name, 'bars': 4, 'function': 'verse', 'meter': METER}
                         for name in names], 'lines': lines}


def read(bp, returns=()):
    song, hooks = grid.song_from_blueprint(bp)
    return song, grid.song_function_report(song, hooks=hooks, returns=returns)


def said(report):
    return [(f.code, f.severity, f.message) for f in report['findings']]


def brief(bp, *flags, words=WORDS):
    """The public `brief` verb over a declared blueprint -> its result."""
    with tempfile.TemporaryDirectory() as tmp:
        draft, declared = Path(tmp) / 'draft.txt', Path(tmp) / 'blueprint.json'
        draft.write_text('\n'.join(words) + '\n')
        declared.write_text(json.dumps(bp))
        done = subprocess.run(
            [sys.executable, str(ROOT / 'lyric_harness.py'), 'brief', str(draft),
             '--groups=1,3', f'--blueprint={declared}', *flags],
            cwd=ROOT, capture_output=True, text=True, timeout=180)
    records = [json.loads(line.split('lyric result: ', 1)[1])
               for line in done.stdout.splitlines() if 'lyric result: ' in line]
    assert records, done.stdout + done.stderr
    return records[-1]


def role_rows(result):
    return [row for row in result['coverage']['obligations']
            if row.get('code') == 'ROLE_MATCH_NOT_CHECKED']


class LineRoleAcceptance(unittest.TestCase):
    def test_a_blueprint_with_no_role_reads_as_it_did(self):
        empty = {'declarations': [], 'notes': [], 'findings': [], 'not_checked': []}
        for names in (('v1', 'v2'), ('Refrain', 'Burden')):
            with self.subTest(names=names):
                song, report = read(blueprint(names=names))
                self.assertEqual([line.role for line in song.lines], [''] * 4)
                self.assertEqual(report['line_roles'], empty)
                self.assertFalse([gap for gap in report['not_asked']
                                  if gap.code == 'ROLE_MATCH_NOT_CHECKED'])
                # A Return with no mark is the Return's business alone.
                self.assertEqual(read(blueprint(names=names), ((2, 4),))[1]['line_roles'], empty)

    def test_a_mark_keeps_its_spelling_its_line_and_its_section(self):
        song, report = read(blueprint({2: 'Refrain', 4: 'Burden'}))
        self.assertEqual([line.role for line in song.lines], ['', 'Refrain', '', 'Burden'])
        self.assertEqual(
            [(d['line'], d['container'], d['raw'], d['role'])
             for d in report['line_roles']['declarations']],
            [(2, 0, 'Refrain', 'refrain'), (4, 1, 'Burden', 'burden')])

    def test_two_sections_of_one_name_stay_two(self):
        _song, report = read(blueprint({2: 'refrain', 4: 'refrain'}, names=('verse', 'verse')))
        self.assertEqual([d['container'] for d in report['line_roles']['declarations']], [0, 1])

    def test_lines_of_the_same_words_stay_separate_lines(self):
        words = ['hold the line'] * 4
        _song, report = read(blueprint({n: 'refrain' for n in (1, 2, 3, 4)}, words))
        self.assertEqual([(d['line'], d['container']) for d in report['line_roles']['declarations']],
                         [(1, 0), (2, 0), (3, 1), (4, 1)])

    def test_a_mark_adds_one_sentence_and_changes_no_other_answer(self):
        _plain_song, plain = read(blueprint())
        _song, marked = read(blueprint({2: 'refrain', 4: 'refrain'}))
        # Different words under one mark: nothing is found against the draft.
        self.assertEqual(said(marked), said(plain))
        for count in ('asked', 'answered', 'refused'):
            self.assertEqual(marked[count], plain[count])
        for key in ('returns', 'reprises', 'refusals', 'profile', 'contrast'):
            self.assertEqual(marked[key], plain[key])
        extra = [gap for gap in marked['not_asked'] if gap not in plain['not_asked']]
        self.assertEqual([(gap.code, gap.message) for gap in extra],
                         [('ROLE_MATCH_NOT_CHECKED', NOT_CHECKED)])
        for item in marked['line_roles']['declarations']:
            self.assertEqual(item['identity'], 'not_checked')
            self.assertEqual(item['disclosure'],
                             'No Return is declared for this occurrence; identity was not checked.')

    def test_a_hook_in_marked_lines_is_counted_once(self):
        # A hook is its own declaration, and a mark on the lines it sits in
        # is not a second one: the same occurrences, the same answers and the
        # same three counts, and each marked line stated back once.
        read_both = []
        for roles in (None, {2: 'refrain', 4: 'refrain'}):
            bp = blueprint(roles)
            bp.update(title='Hold the Line', hooks=['hold the'])
            song, hooks = grid.song_from_blueprint(bp)
            read_both.append((song, hooks, grid.song_function_report(song, hooks=hooks)))
        (plain_song, plain_hooks, plain), (song, hooks, marked) = read_both
        self.assertEqual(hooks, plain_hooks)
        self.assertEqual([found.line_index for found in grid.hook_occurrences(song, hooks[0])],
                         [1, 3])
        self.assertEqual(grid.hook_occurrences(song, hooks[0]),
                         grid.hook_occurrences(plain_song, plain_hooks[0]))
        self.assertEqual(grid.hook_findings(song, hooks), grid.hook_findings(plain_song, plain_hooks))
        self.assertEqual(said(marked), said(plain))
        for count in ('asked', 'answered', 'refused'):
            self.assertEqual(marked[count], plain[count])
        self.assertEqual([item['line'] for item in marked['line_roles']['declarations']], [2, 4])

    def test_a_declared_return_over_the_marked_lines_ends_the_sentence(self):
        _song, report = read(blueprint({2: 'refrain', 4: 'refrain'}), ((2, 4),))
        self.assertEqual(report['line_roles']['not_checked'], [])
        self.assertEqual([d['declared_returns'] for d in report['line_roles']['declarations']],
                         [[[2, 4]], [[2, 4]]])
        # A mark is still not a verdict: the Return is judged where Returns are judged.
        self.assertEqual({d['identity'] for d in report['line_roles']['declarations']},
                         {'not_checked'})

    def test_a_return_over_some_of_the_marked_lines_says_which(self):
        _song, report = read(blueprint({1: 'refrain', 2: 'refrain', 4: 'refrain'}), ((2, 4),))
        self.assertEqual(
            [gap.message for gap in report['line_roles']['not_checked']],
            ['not checked: whether lines 1, 2 and 4, all marked refrain, match '
             '(no one Return covers all of them; declared: lines 2 and 4)'])

    def test_refrain_and_burden_are_counted_apart(self):
        _song, report = read(blueprint({1: 'refrain', 2: 'burden', 3: 'refrain', 4: 'burden'}))
        self.assertEqual(
            [gap.message for gap in report['line_roles']['not_checked']],
            ['not checked: whether lines 1 and 3, both marked refrain, match '
             '(no Return is declared for them); whether lines 2 and 4, both marked burden, '
             'match (no Return is declared for them)'])

    def test_a_role_used_once_and_a_burden_s_place_are_notes(self):
        _plain_song, plain = read(blueprint())
        _song, report = read(blueprint({2: 'burden'}))
        new = [row for row in said(report) if row not in said(plain)]
        self.assertEqual(new, [
            ('LINE_ROLE_ONCE', 'note', 'line 2 is the only line marked burden in this draft'),
            ('BURDEN_POSITION', 'note', 'marked burden: line 2, at a section boundary in this draft')])
        self.assertEqual(report['line_roles']['not_checked'], [])
        for count in ('asked', 'answered', 'refused'):
            self.assertEqual(report[count], plain[count])

    def test_any_other_value_is_refused_at_every_reader(self):
        from quality.fit import from_blueprint
        for raw in ('', None, {}, [], 17, 'verse', 'chorus'):
            wanted = (f"line 4: `role` is {raw!r}, which isn't a line role. "
                      'Write "refrain" or "burden", or remove `role` from this line.')
            for reader in (validate_blueprint, grid.song_from_blueprint, from_blueprint):
                with self.subTest(raw=raw, reader=reader.__name__), \
                        self.assertRaises(ValueError) as caught:
                    reader(blueprint({4: raw}))
                self.assertEqual(str(caught.exception), wanted)

    def test_a_blueprint_with_no_mark_loads_nothing_new(self):
        # The placement reader (`quality/fit.py`) reads a blueprint without
        # `quality/grid.py`. The role vocabulary lives there, so it is loaded
        # for a marked blueprint and only for one.
        probe = ('import json, sys\n'
                 'from quality.fit import from_blueprint\n'
                 'from_blueprint(json.loads(sys.argv[1]))\n'
                 'print(json.dumps([name in sys.modules '
                 'for name in ("quality.grid", "quality.line_roles")]))\n')
        for bp, loaded in ((blueprint(), [False, False]),
                           (blueprint({2: 'refrain', 4: 'refrain'}), [True, True])):
            done = subprocess.run([sys.executable, '-c', probe, json.dumps(bp)],
                                  cwd=ROOT, capture_output=True, text=True, timeout=120)
            self.assertEqual(json.loads(done.stdout or 'null'), loaded, done.stderr)

    def test_changing_a_mark_changes_no_word_and_no_placement(self):
        from quality.fit import from_blueprint
        from quality.plan import render_blueprint_song
        plain = blueprint()
        for roles in ({2: 'refrain', 4: 'refrain'}, {2: 'burden', 4: 'burden'}, {2: 'Burden'}):
            marked = blueprint(roles)
            before = copy.deepcopy(marked)
            with self.subTest(roles=roles):
                self.assertEqual([line.text for line in read(marked)[0].lines], WORDS)
                self.assertEqual(from_blueprint(marked), from_blueprint(plain))
                # The rendered song is the words under their headers: no mark is printed.
                self.assertEqual(render_blueprint_song(marked, WORDS),
                                 render_blueprint_song(plain, WORDS))
                self.assertEqual(marked, before)

    def test_the_planner_marks_no_line(self):
        from quality import plan
        made = plan.make_plan(3, lines=16, narrative='off')
        filled = plan.fill_plan(made, ['The red sun falls into the sea'] * 16)
        self.assertEqual(len(filled['lines']), 16)
        self.assertFalse([row for row in filled['lines'] if 'role' in row])
        song, _hooks = grid.song_from_blueprint(filled)
        self.assertEqual({line.role for line in song.lines}, {''})

    def test_a_section_named_for_a_line_kind_gets_no_marked_line_of_its_own(self):
        from quality.function_disclosure import LINE_ROLE, function_capabilities
        rows = {row['function']: row for row in function_capabilities()}
        self.assertEqual(LINE_ROLE, 'marked by hand; not planned')
        self.assertEqual({name for name, row in rows.items() if row['line_role']},
                         {'refrain', 'burden'})
        self.assertEqual({rows[name]['line_role'] for name in ('refrain', 'burden')}, {LINE_ROLE})

    def test_the_grade_says_what_it_did_not_compare(self):
        plain = brief(blueprint())
        marked = brief(blueprint({2: 'Refrain', 4: 'refrain'}))
        rows = role_rows(marked)
        self.assertEqual([(row['id'], row['layer'], row['status'], row['message']) for row in rows],
                         [('function:ROLE_MATCH_NOT_CHECKED:draft', 'function', 'not_requested',
                           NOT_CHECKED)])
        self.assertEqual(role_rows(plain), [])
        # Nothing else moves: the same findings, the same counts, the same status.
        codes = lambda result: [(f.get('line'), f['code'], f['severity']) for f in result['findings']]
        self.assertEqual(codes(marked), codes(plain))
        self.assertNotIn('RETURN_NOT_VERBATIM', [f['code'] for f in marked['findings']])
        self.assertEqual(marked['status'], plain['status'])
        for key in ('pairs_mandated', 'pairs_judged', 'pairs_refused', 'certified',
                    'refused_obligations'):
            self.assertEqual(marked['coverage'][key], plain['coverage'][key])
        self.assertEqual([row for row in marked['coverage']['obligations'] if row not in rows],
                         plain['coverage']['obligations'])

    def test_a_declared_return_judges_the_marked_lines(self):
        # Line 4 drifts from line 2 ("wire" for "line"). The Return says so,
        # with or without the marks, and the marks add nothing beside it.
        marked = brief(blueprint({2: 'refrain', 4: 'refrain'}), '--returns=2,4')
        plain = brief(blueprint(), '--returns=2,4')
        flags = lambda result: [(f.get('line'), f['code'], f['severity'], f['message'])
                                for f in result['findings'] if f['code'] == 'RETURN_NOT_VERBATIM']
        self.assertEqual(len(flags(marked)), 1)
        self.assertEqual(flags(marked)[0][2], 'flag')
        self.assertEqual(flags(marked), flags(plain))
        self.assertEqual(role_rows(marked), [])
        self.assertEqual(marked['coverage'], plain['coverage'])
        # The same lines made the same words: nothing is flagged.
        same = WORDS[:3] + [WORDS[1]]
        kept = brief(blueprint({2: 'refrain', 4: 'refrain'}, same), '--returns=2,4', words=same)
        self.assertEqual(flags(kept), [])
        self.assertEqual(role_rows(kept), [])

    def test_a_drifted_return_on_a_marked_line_is_asked_and_answered(self):
        # The whole round on one marked line: the declared Return finds the
        # drift, the loop asks for that line, the answer is applied, and the
        # song finishes with the Return answered and nothing left unsaid
        # about the marks, which stay where the blueprint put them.
        bp = blueprint({2: 'Refrain', 4: 'refrain'})
        with tempfile.TemporaryDirectory() as tmp:
            draft, declared, state = (Path(tmp) / name
                                      for name in ('draft.txt', 'blueprint.json', 'state.json'))
            draft.write_text('\n'.join(WORDS) + '\n')
            declared.write_text(json.dumps(bp))
            argv = [sys.executable, str(ROOT / 'lyric_harness.py'), 'revise', str(draft),
                    '--returns=2,4', '--attempts=1', '--backtrack=0', '--max-rounds=2',
                    f'--blueprint={declared}', f'--propose=defer:{state}']

            def run():
                done = subprocess.run(argv, cwd=ROOT, capture_output=True, text=True, timeout=180)
                records = [json.loads(line.split('lyric result: ', 1)[1])
                           for line in done.stdout.splitlines() if 'lyric result: ' in line]
                assert records, done.stdout + done.stderr
                return done.returncode, records[-1]

            code, asked = run()
            self.assertEqual((code, asked['status']), (4, 'suspended'))
            saved = json.loads(state.read_text())
            self.assertEqual((saved['pending']['kind'], saved['pending']['record']['line']),
                             ('propose', 4))
            self.assertIn("RETURN_NOT_VERBATIM: return  must come back VERBATIM: "
                          "L2 'hold the line' vs L4 'hold the wire'", saved['pending']['prompt'])
            saved['pending']['answer'] = 'hold the line'
            state.write_text(json.dumps(saved))
            code, result = run()
            self.assertEqual(json.loads(declared.read_text()), bp)
        self.assertEqual((code, result['status'], result['stop_reason']), (0, 'finished', 'SUCCESS'))
        self.assertEqual(result['final_draft'], [WORDS[0], WORDS[1], WORDS[2], WORDS[1]])
        self.assertTrue(result['coverage']['certified'])
        self.assertEqual([row['status'] for row in result['coverage']['obligations']
                          if row['id'] == 'return:2:4'], ['answered'])
        self.assertEqual(role_rows(result), [])
        self.assertNotIn('RETURN_NOT_VERBATIM', [found['code'] for found in result['findings']])

    def test_the_function_verb_prints_each_marked_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            declared = Path(tmp) / 'blueprint.json'
            declared.write_text(json.dumps(blueprint({2: 'Refrain', 4: 'burden'})))
            done = subprocess.run(
                [sys.executable, str(ROOT / 'lyric_harness.py'), 'function', str(declared)],
                cwd=ROOT, capture_output=True, text=True, timeout=180)
        out = done.stdout
        self.assertIn('line roles (this verb reads no --returns=, so no Return is declared here):', out)
        self.assertIn("L2: refrain (written 'Refrain'), in section 1 'v1'", out)
        self.assertIn("L4: burden, in section 2 'v2'", out)
        self.assertIn('No Return is declared for this occurrence; identity was not checked.', out)
        self.assertIn('LINE_ROLE_ONCE', out)
        self.assertIn('BURDEN_POSITION', out)


if __name__ == '__main__':
    unittest.main()

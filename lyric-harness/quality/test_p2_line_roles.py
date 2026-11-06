"""Reconstructed P2 pure-helper/admission controls; no typed-role integration."""
import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from quality.line_roles import resolve_line_roles, role_report
from quality import grid
from quality.meter import validate_blueprint


class LineRoles(unittest.TestCase):
    def test_absent_is_undeclared_without_owner(self):
        rows = [{'text': '[REFRAIN]'}, {'text': 'same'}]
        self.assertEqual(resolve_line_roles(rows, {}), ())
        self.assertEqual(role_report((), {}), {'declarations': [], 'notes': []})

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
        report = role_report(resolve_line_roles(rows, {0: 0, 1: 0}), {0: 0, 1: 0})
        self.assertEqual(report['notes'], [])
        for item in report['declarations']:
            self.assertEqual(item['identity'], 'not_checked')
            self.assertEqual(item['declared_returns'], [])
            self.assertIn('identity was not checked', item['disclosure'])
            self.assertFalse({'licence', 'hook', 'origin', 'certified'} & item.keys())

    def test_explicit_return_membership_is_not_judgment(self):
        roles = resolve_line_roles([{'role': 'refrain'}, {}, {'role': 'refrain'}], {0: 0, 2: 1})
        report = role_report(roles, {0: 0, 1: 0, 2: 1}, returns=((3, 1),))
        self.assertEqual([x['declared_returns'] for x in report['declarations']], [[[3, 1]], [[3, 1]]])
        self.assertTrue(all(x['identity'] == 'not_checked' for x in report['declarations']))

    def test_once_is_note(self):
        report = role_report(resolve_line_roles([{'role': 'refrain'}], {0: 0}), {0: 0})
        self.assertEqual(report['notes'], [{'line': 1, 'severity': 'note',
                          'message': 'marked refrain; the only line marked refrain in this draft'}])

    def test_burden_positions_are_draft_notes(self):
        owners = {0: 0, 1: 0, 2: 1, 3: 1, 4: 1}
        roles = resolve_line_roles([{'role': 'burden'}, {}, {'role': 'burden'}, {'role': 'burden'}, {}], owners)
        notes = role_report(roles, owners)['notes']
        self.assertEqual([n['message'] for n in notes], [
            'marked burden; at the opening of this draft',
            'marked burden; at a section boundary in this draft',
            'marked burden; inside its containing section in this draft'])
        self.assertTrue(all(n['severity'] == 'note' for n in notes))

    def test_missing_adjacent_owner_is_disclosed(self):
        roles = resolve_line_roles([{}, {'role': 'burden'}], {1: 0})
        self.assertIn("the preceding line's section isn't resolved", role_report(roles, {1: 0})['notes'][-1]['message'])

    def test_invalid_following_owner_is_not_called_inside(self):
        for following in (None, -1, True, [], {}, '0'):
            owners = {0: 0, 1: 0, 2: following}
            roles = resolve_line_roles([{}, {'role': 'burden'}, {}], owners)
            with self.subTest(following=following):
                self.assertEqual(role_report(roles, owners)['notes'][-1]['message'],
                    "marked burden; the following line's section isn't resolved, so its position isn't known")

    def test_no_input_mutation_or_default_keys(self):
        rows = [{'text': 'same'}, {'text': 'same', 'role': 'burden'}]
        owners, returns = {0: 0, 1: 1}, [[1, 2]]
        before = copy.deepcopy((rows, owners, returns))
        role_report(resolve_line_roles(rows, owners), owners, returns=returns)
        self.assertEqual((rows, owners, returns), before)
        self.assertNotIn('role', rows[0])

    def test_shared_presence_guard(self):
        for raw in ('refrain', '', None, {}, [], 17):
            bp = {'sections': [], 'lines': [{'role': raw}]}
            before = copy.deepcopy(bp)
            with self.subTest(raw=raw), self.assertRaisesRegex(ValueError, r"`role` isn't supported yet, so this blueprint was not accepted\. Remove `role` from this line and send it again\."):
                validate_blueprint(bp)
            self.assertEqual(bp, before)

    def test_legacy_blueprint_raw_serialization_preserved(self):
        raw = ' {"sections": [], "lines": []}\n'
        blueprint = json.loads(raw)
        before = copy.deepcopy(blueprint)
        validate_blueprint(blueprint)
        self.assertEqual(blueprint, before)
        self.assertEqual(raw, ' {"sections": [], "lines": []}\n')
        # No claim that a reconstructed outer session envelope is byte-identical.


if __name__ == '__main__':
    unittest.main()

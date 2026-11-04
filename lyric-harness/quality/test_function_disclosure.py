"""Direct preparation-slice tests; no cross-surface or restore claim.

Run from lyric-harness: python3 -B quality/test_function_disclosure.py
Expected readings and prose below are independently specified literals.
"""
import copy
import json
import os
import subprocess
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from quality import grid as G
from quality import plan as P
from quality.function_disclosure import (
    disclose_functions, disclose_section, function_contract_explanations,
)


class FunctionDisclosureTests(unittest.TestCase):
    def test_refused_mutable_raw_is_detached_from_caller(self):
        for value in (['Introduction'], {'function': ['Introduction']}):
            before = copy.deepcopy(value)
            row = disclose_functions([value])[0]
            self.assertIsNotNone(row['refusal'])
            self.assertIsNone(row['canonical'])
            if isinstance(value, list):
                row['raw'].append('changed')
            else:
                row['raw']['function'].append('changed')
            self.assertEqual(value, before)

    def test_no_label_preserves_missing_blank_and_nonstring_inputs(self):
        for section in ({}, {'name': None}, {'name': ''}, {'name': ' \t '},
                        {'name': 123}, {'name': ['Intro']}):
            before = copy.deepcopy(section)
            row = disclose_section(section)
            self.assertEqual(row['raw'], before)
            self.assertEqual(section, before)
            self.assertIsNone(row['label_recognized'])
            self.assertEqual(row['explanation'],
                             'No label supplied; no section function declared or checked.')

    def test_line_kind_acceptance_is_not_a_contained_role(self):
        for name in ('refrain', 'burden'):
            section = {'name': 'Label', 'function': name, 'bars': 8,
                       'meter': {'beats': 4, 'unit': 4}}
            song, _ = G.song_from_blueprint({'sections': [section], 'lines': []})
            self.assertEqual(song.sections[0].function, name)
            row = disclose_section(section)
            self.assertIsNone(row['declaration_refusal'])
            self.assertEqual(row['explanation'],
                             f"Blueprint reader accepts {name!r}, a line-kind name, on this section; "
                             'no contained line role is declared and no section-function assessment has run.')

    def test_raw_order_duplicates_spelling_semantic_and_scoped_alias(self):
        raw = [' Pre-Chorus ', 'instrumental-break', ' English_Song::BREAK ',
               'prechorus', ' Pre-Chorus ']
        before = json.dumps(raw)
        rows = disclose_functions(raw)
        self.assertEqual([r['raw'] for r in rows], raw)
        self.assertEqual([r['canonical'] for r in rows],
                         ['prechorus', 'interlude', 'interlude', 'prechorus', 'prechorus'])
        self.assertEqual([r['specialised_as'] for r in rows], ['', '', '', '', ''])
        self.assertEqual([r['refusal'] for r in rows], [None] * 5)
        self.assertEqual(rows[0]['explanation'],
                         'Name resolved only; planning and section function checks not run.')
        self.assertEqual(json.dumps(raw), before)
        rows[0]['raw'] = 'changed'
        self.assertEqual(raw[0], ' Pre-Chorus ')

    def test_unsupported_scope_and_explicit_refusal_do_not_fall_back(self):
        rows = disclose_functions(['sonata::bridge', 'unknown_scope::bridge'])
        self.assertEqual([r['canonical'] for r in rows], [None, None])
        self.assertEqual(rows[0]['refusal'],
                         'sonata::bridge: a connective transition that can recur, '
                         'not the once-only contrasting pop bridge; no connective '
                         'contract is declared. REFUSED rather than mapped to another tradition.')
        self.assertEqual(rows[1]['refusal'],
                         "no section-function name 'bridge' is declared in tradition "
                         "'unknown_scope'; no cross-tradition or canonical-ID fallback")
        for row in rows:
            self.assertEqual(row['explanation'], 'refused: ' + row['refusal'])

    def test_heading_is_never_a_declaration(self):
        cases = [
            ('Intro', True, "label 'Intro' recognised; no section function declared or checked"),
            ('Introduction', False, "label 'Introduction' not recognised; no section function checked"),
            ('Refrain', True, "section labelled 'Refrain'; no line refrain declared"),
            ('chorus2', False, "label 'chorus2' not recognised; no section function checked"),
        ]
        for label, recognized, explanation in cases:
            with self.subTest(label=label):
                with patch.object(G, 'song_from_blueprint', side_effect=AssertionError('not declared')):
                    row = disclose_section({'name': label})
                self.assertIs(row['label_recognized'], recognized)
                self.assertEqual(row['function']['canonical'], '')
                self.assertEqual(row['explanation'], explanation)
                self.assertIsNone(row['declaration_refusal'])

    def test_empty_and_absent_declarations_remain_distinguishable_in_raw(self):
        for function in (None, '', '   '):
            section = {'name': 'Chorus', 'function': function}
            row = disclose_section(section)
            self.assertEqual(row['raw'], section)
            self.assertEqual(row['function']['canonical'], '')
        self.assertNotIn('function', disclose_section({'name': 'Chorus'})['raw'])

    def test_supplied_refused_function_is_not_an_unknown_label(self):
        row = disclose_section({'name': 'Intro', 'function': 'Introduction'})
        self.assertIsNone(row['label_recognized'])
        self.assertIsNone(row['function']['canonical'])
        self.assertTrue(row['declaration_refusal'].startswith(
            "'Introduction' is not a declared section function."))
        self.assertEqual(row['explanation'], 'refused: ' + row['declaration_refusal'])

    def test_explicit_blueprint_specialization_is_separate_from_name_resolution(self):
        for bars in (8, 13):
            section = {'name': '  Middle Eight  ', 'function': ' Middle-Eight ',
                       'bars': bars, 'meter': {'beats': 4, 'unit': 4},
                       'source': {'labels': ['raw', 'raw']}}
            before = copy.deepcopy(section)
            row = disclose_section(section)
            self.assertEqual(section, before)
            self.assertEqual(row['raw'], before)
            self.assertEqual(row['function']['canonical'], 'bridge')
            self.assertEqual(row['function']['specialised_as'], 'middle-eight')
            if bars == 8:
                self.assertIsNone(row['declaration_refusal'])
                self.assertEqual(row['explanation'], 'This section on its own passed declaration validation (bars, meter and specialisation); its lines, placement, return and contrast were not checked.')
            else:
                self.assertIn("declared 'middle-eight' with bars=13", row['declaration_refusal'])
                self.assertIn('bars == 8', row['declaration_refusal'])
                with self.assertRaises(G.SpecialisationMismatch) as caught:
                    G.song_from_blueprint({'sections': [section], 'lines': []})
                self.assertEqual(row['declaration_refusal'], str(caught.exception))
            row['raw']['source']['labels'].append('mutation probe')
            self.assertEqual(section, before)

    def test_missing_grid_is_not_reported_as_validated(self):
        row = disclose_section({'name': 'Middle', 'function': 'middle-eight', 'bars': 8})
        self.assertIn('declares no time signature', row['declaration_refusal'])
        self.assertTrue(row['explanation'].startswith('refused: '))

    def test_scoped_blueprint_keeps_its_name_reading_and_raw_declaration(self):
        section = {'name': 'Break', 'function': ' English_Song::BREAK ',
                   'bars': 4, 'meter': {'beats': 4, 'unit': 4}}
        row = disclose_section(section)
        self.assertEqual(row['raw']['function'], ' English_Song::BREAK ')
        self.assertEqual(row['function']['canonical'], 'interlude')
        self.assertIsNone(row['declaration_refusal'])
        section['function'] = 'sonata::bridge'
        row = disclose_section(section)
        self.assertIsNone(row['function']['canonical'])
        self.assertIn('REFUSED rather than mapped to another tradition.', row['declaration_refusal'])

    def test_helper_does_not_run_planning_or_function_assessment(self):
        with patch.object(P, 'make_plan', side_effect=AssertionError('planner ran')), \
                patch.object(G, 'song_function_report', side_effect=AssertionError('assessment ran')):
            disclose_functions(['middle-eight', 'Introduction'])
            disclose_section({'name': 'M', 'function': 'middle-eight', 'bars': 8,
                              'meter': {'beats': 4, 'unit': 4}})
            function_contract_explanations()

    def test_existing_resolver_and_planner_contracts(self):
        self.assertEqual(G.as_function(' Pre-Chorus '), 'prechorus')
        self.assertEqual(G.as_function('english_song::break'), 'interlude')
        self.assertEqual(G.Section('Chorus', 8).function, '')
        self.assertEqual(G.Section('Middle', 8, function='middle-eight').specialised_as,
                         'middle-eight')
        with self.assertRaises(G.SpecialisationMismatch):
            G.Section('Middle', 13, function='middle-eight')
        with self.assertRaises(G.UnknownFunction):
            G.as_function('sonata::bridge')
        for raw in ('middle-eight', 'popular_song::middle-eight'):
            with self.subTest(raw=raw), self.assertRaisesRegex(P.PlanRefused, 'cannot promise that value'):
                P.make_plan(11, functions=['verse', raw], lines=24)

    def test_disclosure_does_not_change_plan_request_or_plan(self):
        functions = [' verse ', 'reprise', 'reprise']
        plan = P.make_plan(11, functions=functions, lines=24)
        self.assertEqual(plan['request']['functions'], [' verse ', 'reprise', 'reprise'])
        before = json.dumps(plan, sort_keys=True)
        rows = disclose_functions(plan['request']['functions'])
        self.assertEqual([r['canonical'] for r in rows], ['verse', 'reprise', 'reprise'])
        self.assertEqual(json.dumps(plan, sort_keys=True), before)
        self.assertEqual(functions, [' verse ', 'reprise', 'reprise'])

    def test_explanations_do_not_classify_or_change_existing_assessment(self):
        song = G.Song(sections=[G.Section('Ending', 8, function='outro'),
                                G.Section('Verse', 8, function='verse')])
        before = G.song_function_report(song)
        prose = function_contract_explanations()
        self.assertEqual(prose['convention'], 'Convention: musical advice; never withholds certification.')
        self.assertEqual(prose['declared'], 'Declared: the user or chosen form asked for it; an unjudged obligation can withhold certification.')
        self.assertEqual(prose['structural_repair'], 'Occurrence, order and grid changes require manual structural editing, redeclaration or replanning, followed by recheck; rewriting words alone does not repair them.')
        self.assertEqual(prose['word_repair'], 'Explicit Return identity obligations are separate from advisory function return measurements. Existing copy/rewrite operations may repair word identity; recheck the declared obligation.')
        self.assertEqual(prose['measurement'], 'Acoustic properties are not verified from text. A label or resolved name does not establish a performed musical result.')
        self.assertEqual(G.song_function_report(song), before)
        self.assertTrue(any(f.code == 'SECTION_NOT_AT_BOUNDARY' for f in before['findings']))
        self.assertEqual(set(prose), {'convention', 'declared', 'structural_repair', 'word_repair', 'measurement'})


class WriterDisclosureTests(unittest.TestCase):
    raw = [' verse ', '', ' English_Song::BREAK ', '  ', 'reprise', 'reprise']
    block = ('The request allowed these functions (as written → resolved name):\n'
             '  " verse " → "verse"\n'
             '  " English_Song::BREAK " → "interlude"\n'
             '  "reprise" → "reprise"\n'
             '  "reprise" → "reprise"\n'
             'Not drawn in this song: interlude, reprise.\n'
             'The sections above are the song; do not add or remove sections based on this list.\n')

    def test_exact_roster_and_blanks_preserve_request(self):
        raw = self.raw.copy()
        plan = P.make_plan(11, functions=raw, lines=24)
        self.assertEqual(raw, self.raw)
        self.assertEqual(plan['request']['functions'], self.raw)
        self.assertEqual([s['function'] for s in plan['sections']], ['verse'])
        self.assertEqual(plan['functions_unused'], ['interlude', 'reprise'])
        brief = plan['writer_brief']
        self.assertEqual(brief.count(self.block), 1)
        self.assertIn(self.block + 'Feel:', brief)
        self.assertLess(brief.rindex('syllables a line after the pickup'),
                        brief.index(self.block))
        # Removing blank inputs has no effect on the draw, only raw identity.
        clean = P.make_plan(11, functions=[r for r in raw if r.strip()], lines=24)
        clean['request']['functions'] = raw.copy()
        self.assertEqual(plan, clean)

    def test_seed_12_names_allowed_but_undrawn_functions(self):
        raw = ['verse', 'chorus', 'bridge']
        plan = P.make_plan(12, functions=raw, lines=24)
        self.assertEqual(plan['request']['functions'], raw)
        self.assertEqual([s['function'] for s in plan['sections']],
                         ['verse', 'verse', 'verse'])
        self.assertEqual(plan['functions_unused'], ['bridge', 'chorus'])
        block = ('The request allowed these functions (as written → resolved name):\n'
                 '  "verse" → "verse"\n'
                 '  "chorus" → "chorus"\n'
                 '  "bridge" → "bridge"\n'
                 'Not drawn in this song: bridge, chorus.\n'
                 'The sections above are the song; do not add or remove sections based on this list.\n')
        self.assertIn(block + 'Feel:', plan['writer_brief'])

    def test_all_allowed_functions_drawn_has_no_undrawn_line(self):
        plan = P.make_plan(11, functions=['verse'], lines=24)
        self.assertEqual(plan['functions_unused'], [])
        self.assertEqual([s['function'] for s in plan['sections']], ['verse'] * 4)
        block = ('The request allowed these functions (as written → resolved name):\n'
                 '  "verse" → "verse"\n'
                 'The sections above are the song; do not add or remove sections based on this list.\n')
        self.assertIn(block + 'Feel:', plan['writer_brief'])
        self.assertNotIn('Not drawn in this song:', plan['writer_brief'])

    def test_undrawn_display_reads_existing_order_without_mutation(self):
        plan = P.make_plan(11, functions=self.raw, lines=24)
        # Report supplied plan metadata, rather than rerunning a draw or
        # recomputing/sorting its unused list while rendering.
        plan['functions_unused'] = ['reprise', 'interlude']
        before = copy.deepcopy(plan)
        self.assertIn('Not drawn in this song: reprise, interlude.\n',
                      P.writer_brief(plan))
        self.assertEqual(plan, before)

    def test_brief_block_excludes_unrelated_prose(self):
        plan = P.make_plan(11, functions=self.raw, lines=24)
        plan.update(genre='GENRE_SENTINEL', theme='THEME_SENTINEL',
                    lyric_example='LYRIC_SENTINEL')
        plan['request'].update(genre='REQUEST_GENRE_SENTINEL')
        rendered = P.writer_brief(plan)
        start = rendered.index('The request allowed these functions')
        block = rendered[start:rendered.index('Feel:', start)]
        self.assertEqual(block, self.block)
        for word in ('GENRE_SENTINEL', 'THEME_SENTINEL', 'LYRIC_SENTINEL',
                     'REQUEST_GENRE_SENTINEL', 'refused', 'ignored blank'):
            self.assertNotIn(word, block)

    def test_refusal_precedes_brief_and_disclosure(self):
        for name in ('Introduction', 'sonata::bridge', 'unknown_scope::bridge',
                     'middle-eight', 'refrain', 'burden'):
            with self.subTest(name=name), \
                    patch.object(P, 'writer_brief', side_effect=AssertionError('brief ran')):
                with self.assertRaises(P.PlanRefused):
                    P.make_plan(11, functions=['verse', name], lines=24)

    def _process_plans(self, hashseed, baseline=None):
        program = """
import json, os, types
from pathlib import Path
from quality import plan
if os.environ.get('DISCLOSURE_OLD_SOURCE'):
    old = types.ModuleType('quality.disclosure_baseline')
    old.__file__ = plan.__file__
    exec(compile(Path(os.environ['DISCLOSURE_OLD_SOURCE']).read_text(),
                 old.__file__, 'exec'), old.__dict__)
    plan = old
cases = json.loads(os.environ['DISCLOSURE_CASES'])
print(json.dumps([plan.make_plan(**case) for case in cases]))
"""
        cases = [{'seed': seed, 'lines': 24, 'functions': functions}
                 for seed in (7, 11, 31)
                 for functions in (None, [], self.raw,
                                   [' Pre-Chorus ', 'chorus', ' Pre-Chorus '])]
        cases.extend([{'seed': 12, 'lines': 24,
                       'functions': ['verse', 'chorus', 'bridge']},
                      {'seed': 11, 'lines': 24, 'functions': ['verse']}])
        cases.append({'seed': 11, 'lines': 24, 'functions': ['bridge'],
                      'wants': ['sections.bridge=4']})
        env = dict(os.environ, PYTHONHASHSEED=str(hashseed),
                   DISCLOSURE_CASES=json.dumps(cases))
        env.pop('DISCLOSURE_OLD_SOURCE', None)
        if baseline:
            env['DISCLOSURE_OLD_SOURCE'] = baseline
        return cases, json.loads(subprocess.check_output(
            [sys.executable, '-B', '-c', program],
            cwd=Path(__file__).resolve().parents[1], env=env, text=True))

    def test_second_process_determinism(self):
        self.assertEqual(json.dumps(self._process_plans(1)),
                         json.dumps(self._process_plans(937)))

    @unittest.skipUnless(os.environ.get('FUNCTION_DISCLOSURE_BASELINE'),
                         'supply unchanged released plan.py via FUNCTION_DISCLOSURE_BASELINE')
    def test_released_baseline_whole_plan_invariants(self):
        # Explicitly skipped without a released source: ordinary CI's
        # determinism result must not claim a before/after comparison ran.
        cases, current = self._process_plans(1)
        _, previous = self._process_plans(43, os.environ['FUNCTION_DISCLOSURE_BASELINE'])
        for case, old, new in zip(cases, previous, current):
            with self.subTest(case=case):
                if not case['functions']:
                    self.assertEqual(json.dumps(old), json.dumps(new))
                    continue
                old_brief, new_brief = old.pop('writer_brief'), new.pop('writer_brief')
                self.assertEqual(json.dumps(old), json.dumps(new))
                start = new_brief.index('The request allowed these functions')
                end = new_brief.index('Feel:', start)
                self.assertEqual(old_brief, new_brief[:start] + new_brief[end:])
                self.assertNotEqual(old_brief, new_brief)


if __name__ == '__main__':
    unittest.main(verbosity=2)

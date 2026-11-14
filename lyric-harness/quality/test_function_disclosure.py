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
    disclose_functions, disclose_section, function_capabilities,
    function_contract_explanations,
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

    def test_refrain_and_burden_are_ordinary_section_declarations(self):
        for name in ('refrain', 'burden'):
            section = {'name': 'Label', 'function': name, 'bars': 8,
                       'meter': {'beats': 4, 'unit': 4}}
            song, _ = G.song_from_blueprint({'sections': [section], 'lines': []})
            self.assertEqual(song.sections[0].function, name)
            row = disclose_section(section)
            self.assertIsNone(row['declaration_refusal'])
            # Owner ruling 2026-11-13: the two are sections like any other,
            # so they read exactly as `verse` or `chorus` does here.
            self.assertEqual(row['explanation'], disclose_section(
                dict(section, function='verse'))['explanation'])
            self.assertNotIn('line', row['explanation'].replace('its lines', ''))

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
            ('Refrain', True, "label 'Refrain' recognised; no section function declared or checked"),
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
        self.assertEqual(prose['convention'], 'Convention: musical advice. It never withholds certification.')
        self.assertEqual(prose['declared'], "Declared: you, or the form you chose, asked for this. If it couldn't be judged, it can withhold certification.")
        self.assertEqual(prose['structural_repair'], "Structural repair: if a problem is how often a section occurs, its order or its bars, fix it by editing the structure, changing the declaration or replanning, then check again. Rewriting words alone won't fix it.")
        self.assertEqual(prose['word_repair'], 'Word repair: a declared Return asks for the same words to come back. Copying or rewriting the words can fix that; check the declaration again afterwards. This is separate from the advisory measurement of how much a section returns.')
        self.assertEqual(prose['measurement'], "Acoustic properties aren't verified from text. A section's label or resolved name doesn't show how it sounds when performed.")
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
                     'middle-eight'):
            with self.subTest(name=name), \
                    patch.object(P, 'writer_brief', side_effect=AssertionError('brief ran')):
                with self.assertRaises(P.PlanRefused):
                    P.make_plan(11, functions=['verse', name], lines=24)

    def test_refrain_and_burden_are_planned_like_any_other_section(self):
        # Owner ruling 2026-11-13. They were refused here as "line-kind".
        for name in ('refrain', 'burden'):
            with self.subTest(name=name):
                plan = P.make_plan(11, functions=['verse', name], lines=24)
                self.assertLessEqual({s['function'] for s in plan['sections']},
                                     {'verse', name})
        drawn = set()
        for seed in range(1, 60):
            sections = P.make_plan(seed, form='verse-chorus')['sections']
            order = [s['function'] for s in sections]
            drawn |= set(order)
            for i, fn in enumerate(order):
                if fn == 'burden':
                    self.assertEqual(order[i - 1] if i else None, 'verse', (seed, order))
        self.assertLessEqual({'refrain', 'burden'}, drawn)

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


class RecurrenceReportTests(unittest.TestCase):
    def fixture(self, functions, wants, drawn):
        # Independently specified final-plan facts for the pure report API.
        return {'request': {'functions': functions, 'wants': wants},
                'sections': [{'function': f} for f in drawn]}

    def test_named_equality_minimum_and_range_keep_operators(self):
        cases = [
            (['sections.reprise=2'], 2,
             'reprise ×2: the request specifies sections.reprise=2.'),
            (['sections.reprise>=2'], 3,
             'reprise ×3: at least the requested minimum: sections.reprise>=2.'),
            (['sections.reprise>=2', 'sections.reprise<=4'], 3,
             'reprise ×3: within the requested range: sections.reprise>=2, sections.reprise<=4.'),
            (['sections.reprise>=2', 'sections.reprise<=2'], 2,
             'reprise ×2: within the requested range: sections.reprise>=2, sections.reprise<=2.'),
        ]
        for wants, count, expected in cases:
            with self.subTest(wants=wants):
                p = self.fixture(['verse', 'reprise'], wants,
                                 ['verse'] + ['reprise'] * count)
                self.assertEqual(P.recurrence_report(p), [expected])

    def test_global_and_last_resort_bridge_sampler_wording(self):
        p = self.fixture(['false_ending', 'reprise'], ['sections>=4', 'sections<=6'],
                         ['false_ending', 'reprise', 'reprise', 'reprise'])
        self.assertEqual(P.recurrence_report(p), [
            'reprise ×3: the sampler chose this repeat after once-only limits were lifted because the requested minimum exceeded capacity: sections>=4, sections<=6.'])
        p = self.fixture(['bridge', 'reprise'], ['sections=4', 'sections.reprise<=2'],
                         ['bridge', 'reprise', 'bridge', 'reprise'])
        self.assertEqual(P.recurrence_report(p), [
            'bridge ×2: the sampler chose this repeat after the bridge limit was lifted because the other eligible lifts still left insufficient capacity for the requested minimum: sections=4.',
            'reprise ×2: the sampler chose this repeat after once-only limits were lifted because the requested minimum exceeded capacity: sections=4.'])

    def test_no_rows_for_unrepeated_unlifted_recurring_or_authored(self):
        cases = [
            (['false_ending', 'reprise'], ['sections=4'], ['verse', 'reprise']),
            (['verse', 'reprise'], ['sections.reprise<=4'], ['verse', 'reprise', 'reprise']),
            (['verse', 'chorus'], ['sections=4'], ['verse', 'chorus', 'verse', 'chorus']),
            (['verse', 'reprise'], [], ['verse', 'reprise', 'reprise']),
            (['intro', 'verse', 'outro'], [], ['intro', 'verse', 'outro']),
        ]
        for roster, wants, drawn in cases:
            with self.subTest(wants=wants, drawn=drawn):
                p = self.fixture(roster, wants, drawn)
                p['lines'] = ['Repeated authored words'] * 4
                self.assertEqual(P.recurrence_report(p), [])
        for f in ('intro', 'outro', 'coda'):
            with self.assertRaises(P.PlanRefused):
                P._recurrence_policy([P.parse_sweep_want('sections.' + f + '=2')])

    def test_scoped_duplicate_roster_is_resolved_without_mutation(self):
        raw = [' verse ', ' English_Song::BREAK ', '', 'reprise', 'reprise']
        p = self.fixture(raw, ['sections=4'], ['verse', 'reprise', 'reprise', 'verse'])
        before = copy.deepcopy(p)
        # The unbounded verse/interlude capacity prevents a total-induced lift.
        self.assertEqual(P.recurrence_report(p), [])
        self.assertEqual(p, before)
        p['request']['wants'] = ['sections.reprise=2']
        self.assertEqual(P.recurrence_report(p), [
            'reprise ×2: the request specifies sections.reprise=2.'])
        self.assertEqual(p['request']['functions'], raw)

    cases = [
        dict(seed=11, form='open', lines=24, functions=['false_ending', 'reprise'],
             wants=['sections=4', 'sections.false_ending<=2', 'sections.reprise<=2']),
        dict(seed=11, form='open', lines=24, functions=['verse', 'reprise'],
             wants=['sections=4', 'sections.verse<=1']),
        dict(seed=11, form='open', lines=24, functions=['bridge'],
             wants=['sections.bridge=4']),
        dict(seed=11, form='open', lines=24, functions=['verse', 'chorus', 'false_ending', 'reprise'],
             wants=['sections.false_ending=2']),
        dict(seed=2, form='verse-chorus', lines=24,
             functions=['verse', 'chorus', 'false_ending', 'reprise'],
             wants=['sections.reprise=2']),
    ]

    def test_real_final_plans_first_and_conditioned_paths_and_policy_agree(self):
        paths = set()
        for case in self.cases:
            p = P.make_plan(**case)
            before = json.dumps(p)
            paths.add(p['choices']['brief_selection']['policy'])
            wants = [P.parse_sweep_want(w) for w in p['request']['wants']]
            roster = tuple(dict.fromkeys(G.as_function(f.strip()) for f in case['functions']))
            policy = P._recurrence_policy(wants, roster)
            suffix = '; default once preferences lifted: ' + ', '.join(
                f'{f} ({why})' for f, why in sorted(policy.items()))
            self.assertTrue(p['choices']['pattern']['chosen_from'].endswith(suffix))
            rows = P.recurrence_report(p)
            counts = {f: sum(s['function'] == f for s in p['sections']) for f in policy}
            self.assertEqual(len(rows), sum(n > 1 for n in counts.values()))
            for f, n in counts.items():
                if n > 1:
                    self.assertTrue(any(row.startswith(f'{f} ×{n}: ') for row in rows))
            self.assertEqual(json.dumps(p), before)
            self.assertFalse(any(row in p['writer_brief'] for row in rows))
        self.assertEqual(paths, {
            "the seed's own plan satisfies every want; the draw was not conditioned",
            'first satisfying candidate; no ranking'})

    @unittest.skipUnless(os.environ.get('P1B_PLAN_BASELINE'),
                         'supply pinned pre-P1b plan.py via P1B_PLAN_BASELINE')
    def test_cli_report_only_delta_and_no_lift_byte_identity(self):
        import tempfile
        harness = Path(__file__).resolve().parents[1] / 'lyric_harness.py'
        baseline = Path(os.environ['P1B_PLAN_BASELINE']).parent.parent / 'lyric_harness.py'
        runner = ('import sys; from pathlib import Path; __file__ = sys.argv[0]; '
                  'exec(compile(Path(sys.argv.pop(1)).read_text(), '
                  'sys.argv[0], "exec"))')
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'plan.json'
            for roster, wants, expected in [
                ('verse', '', ''),
                ('bridge', 'sections.bridge=4',
                 '    bridge ×4: the request specifies sections.bridge=4.\n'),
            ]:
                args = ['plan', '--seed=11', '--lines=24', '--functions=' + roster,
                        '--out=' + str(target)]
                if wants:
                    args.append('--want=' + wants)
                # Same __file__, argv and dependencies: only the exact pinned
                # harness source differs. No modules or grading are doubled.
                def run(source):
                    code = 'import sys; sys.argv[0]=' + repr(str(harness)) + '; ' + runner
                    result = subprocess.run([sys.executable, '-B', '-c', code,
                                             str(source), *args],
                        cwd=harness.parent, text=True, capture_output=True, timeout=120)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    return result.stdout, target.read_bytes()
                old, old_bytes = run(baseline)
                new, new_bytes = run(harness)
                self.assertEqual(new_bytes, old_bytes)
                self.assertEqual(new.replace(expected, '', 1) if expected else new, old)
                if expected:
                    self.assertEqual(new.count(expected), 1)

    @unittest.skipUnless(os.environ.get('P1B_PLAN_BASELINE'),
                         'supply pinned pre-P1b plan.py via P1B_PLAN_BASELINE')
    def test_pinned_prechange_entire_plans_and_process_determinism(self):
        program = '''
import json, os, types
from pathlib import Path
from quality import plan as P
if os.environ.get('P1B_OLD'):
    old = types.ModuleType('quality.p1b_baseline')
    old.__file__ = P.__file__
    exec(compile(Path(os.environ['P1B_OLD']).read_text(), old.__file__, 'exec'), old.__dict__)
    P = old
print(json.dumps([P.make_plan(**c) for c in json.loads(os.environ['P1B_CASES'])]))
'''
        cases = self.cases + [dict(seed=11, lines=24, functions=WriterDisclosureTests.raw),
                              dict(seed=11, lines=24)]
        def run(hashseed, baseline=None):
            env = dict(os.environ, PYTHONHASHSEED=str(hashseed), P1B_CASES=json.dumps(cases))
            env.pop('P1B_OLD', None)
            if baseline:
                env['P1B_OLD'] = baseline
            return subprocess.check_output([sys.executable, '-B', '-c', program],
                cwd=Path(__file__).resolve().parents[1], env=env)
        import hashlib
        baseline = run(11, os.environ['P1B_PLAN_BASELINE'])
        for seed in (1, 937):
            current = run(seed)
            self.assertEqual(current, baseline)
            self.assertEqual(hashlib.sha256(current).hexdigest(), hashlib.sha256(baseline).hexdigest())


def _song(*functions):
    return G.Song(sections=[G.Section(f'S{i}', 8, function=f)
                            for i, f in enumerate(functions)])


class NotAskedTests(unittest.TestCase):
    """Issue #676 gaps 3 and 5. What the convention expects of the declared
    sections and nothing asks is said, instead of sitting under 'answered'."""

    CONTRAST = 'CONTRAST_NOT_CHECKED'
    EFFECT = 'EFFECT_NOT_VERIFIED'

    def test_every_contrast_the_table_names_is_measured_and_asked(self):
        self.assertEqual(G.MEASURED_CONTRASTS,
                         tuple((fn, other) for fn, spec in G.SECTION_FUNCTIONS.items()
                               for other in spec.contrasts_with))
        self.assertIn(('bridge', 'verse'), G.MEASURED_CONTRASTS)
        calls, real = [], G.bridge_contrast

        def spy(*args, **kwargs):
            calls.append((args, kwargs))
            return real(*args, **kwargs)
        with patch.object(G, 'bridge_contrast', spy):
            G.song_function_report(_song('verse', 'prechorus', 'chorus', 'bridge'))
        # One call per pair with both sides declared. The calls that measure
        # one comparator instance on its own carry `_ref` and are not pairs.
        asked = [(a[1], a[2][0]) if len(a) > 1 else ('bridge', 'verse')
                 for a, k in calls if '_ref' not in k]
        declared = {'verse', 'prechorus', 'chorus', 'bridge'}
        self.assertEqual(sorted(asked),
                         sorted(pair for pair in G.MEASURED_CONTRASTS
                                if set(pair) <= declared))
        self.assertEqual(len(asked), 5)

    def test_no_contrast_is_left_unasked(self):
        rep = G.song_function_report(_song('verse', 'prechorus', 'chorus', 'bridge'))
        self.assertEqual(rep['not_asked'], [])

    def test_a_section_that_copies_one_comparator_is_not_a_contrast(self):
        # A bridge that is the first verse again used to pass: pooled over
        # both verses the line length read 6.75 words against its 7.
        meter = {'beats': 4, 'unit': 4}
        v1 = ['I walk the road beside the sea', 'The wind is all that follows me']
        v2 = ['The harbor bells ring out at nine', 'I pour another glass of wine']
        rows = [('verse', v1), ('verse', v2), ('bridge', v1)]
        sections, lines, bar = [], [], 1
        for i, (fn, texts) in enumerate(rows):
            sections.append(dict(name=f'S{i}', function=fn, bars=2, start_bar=bar, meter=meter))
            for t in texts:
                lines.append(dict(text=t, bar=bar, beat=1, duration=4))
                bar += 1
        song, _ = G.song_from_blueprint({'sections': sections, 'lines': lines})
        findings, _refusals, _channels = G.bridge_contrast(song)
        self.assertEqual([f.code for f in findings], ['BRIDGE_IS_A_VERSE'])
        self.assertIn("measured against 'S0' alone", findings[0].evidence)

    def test_nothing_is_said_where_nothing_was_expected_or_all_of_it_was_asked(self):
        for functions in (('chorus',),            # the verse side is not declared
                          ('verse', 'bridge'),    # the one measured pair
                          ('verse', 'intro'),     # no contrast in the convention
                          ('postchorus', 'verse')):
            with self.subTest(functions=functions):
                self.assertEqual(G.song_function_report(_song(*functions))['not_asked'], [])
        # A label nobody declared a function on declares nothing.
        labelled = G.Song(sections=[G.Section('Chorus', 8), G.Section('Verse', 8),
                                    G.Section('Build', 4)])
        self.assertEqual(G.song_function_report(labelled)['not_asked'], [])

    def test_effects_a_name_promises_are_named_as_not_verified_from_text(self):
        rep = G.song_function_report(_song('verse', 'breakdown', 'build', 'drop', 'vamp'))
        self.assertEqual([g.code for g in rep['not_asked']], [self.EFFECT])
        gap = rep['not_asked'][0]
        self.assertEqual(
            gap.message,
            'not verified from text: breakdown (whether the arrangement thins); '
            'build (whether tension rises); drop (whether it lands as an arrival); '
            'vamp (whether a musical figure repeats under it)')
        self.assertEqual(
            gap.evidence,
            'The name promises something about the performance, and the words on a bar '
            'grid cannot show it. Placement, recurrence and return are still asked of '
            'these sections.')
        one = G.song_function_report(_song('verse', 'build', 'build'))['not_asked']
        self.assertEqual([g.message for g in one],
                         ['not verified from text: build (whether tension rises)'])
        self.assertTrue(one[0].evidence.endswith('still asked of this section.'))

    def test_unasked_is_in_none_of_the_counts_and_is_no_finding_or_refusal(self):
        song = _song('verse', 'chorus', 'build')
        rep = G.song_function_report(song)
        self.assertEqual([g.code for g in rep['not_asked']], [self.EFFECT])
        with patch.object(G, 'not_asked', lambda _song: []):
            bare = G.song_function_report(song)
        for key in ('asked', 'answered', 'refused', 'refusal_records', 'findings',
                    'refusals', 'contrast'):
            self.assertEqual(rep[key], bare[key], key)
        self.assertEqual(rep['asked'], rep['answered'] + rep['refused'])
        codes = {f.code for f in rep['findings']} | {r.code for r in rep['refusals']}
        self.assertFalse(codes & {self.CONTRAST, self.EFFECT})

    def test_the_grade_discloses_them_as_not_requested_rows_and_nothing_else_moves(self):
        from quality.revise import Reviser
        meter = {'beats': 4, 'unit': 4}
        sections = [dict(name='Verse', function='verse', bars=2, start_bar=1, meter=meter),
                    dict(name='Chorus', function='chorus', bars=2, start_bar=3, meter=meter),
                    dict(name='Build', function='build', bars=2, start_bar=5, meter=meter)]
        texts = ['the river runs beside the road', 'and carries what the hills have owed',
                 'come down come down to the water', 'come down come down to the sea',
                 'the cold wind rises in the pines', 'and every window holds a light']
        blueprint = {'sections': sections,
                     'lines': [dict(text=t, bar=i + 1, beat=1, duration=4)
                               for i, t in enumerate(texts)]}
        cov = []
        findings = Reviser()._function_findings(texts, blueprint, coverage_out=cov)
        rows = {o['id']: o for o in cov}
        gaps = {g.code: g for g in G.not_asked(G.song_from_blueprint(blueprint)[0])}
        self.assertEqual(set(gaps), {self.EFFECT})
        for code, gap in gaps.items():
            self.assertEqual(rows[f'function:{code}:draft'],
                             {'id': f'function:{code}:draft', 'layer': 'function',
                              'status': 'not_requested', 'code': code,
                              'message': gap.message, 'evidence': gap.evidence})
        self.assertNotIn(f'function:{self.CONTRAST}:draft', rows)
        # No finding carries them: nothing was measured, so nothing is noted.
        self.assertFalse({f.code for f in findings} & set(gaps))
        # Everything else is what it was without the disclosure.
        with patch.object(G, 'not_asked', lambda _song: []):
            bare = []
            bare_findings = Reviser()._function_findings(texts, blueprint, coverage_out=bare)
        self.assertEqual([o for o in cov if o.get('code') not in gaps], bare)
        self.assertEqual([(f.code, f.severity, f.message) for f in findings],
                         [(f.code, f.severity, f.message) for f in bare_findings])

    def test_the_function_verb_prints_them_with_the_measurement_sentence(self):
        meter = {'beats': 4, 'unit': 4}
        blueprint = {'sections': [
            dict(name='Verse', function='verse', bars=2, start_bar=1, meter=meter),
            dict(name='Chorus', function='chorus', bars=2, start_bar=3, meter=meter),
            dict(name='Drop', function='drop', bars=2, start_bar=5, meter=meter)],
            'lines': []}
        import tempfile
        harness = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'bp.json'
            path.write_text(json.dumps(blueprint))
            done = subprocess.run([sys.executable, '-B', 'lyric_harness.py', 'function', str(path)],
                                  cwd=harness, capture_output=True, text=True, timeout=300)
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        out = done.stdout
        self.assertNotIn('CONTRAST_NOT_CHECKED', out)
        self.assertIn('  NOT ASKED EFFECT_NOT_VERIFIED: not verified from text: drop '
                      '(whether it lands as an arrival)\n', out)
        self.assertIn('      ' + function_contract_explanations()['measurement'] + '\n', out)


class CapabilityTableTests(unittest.TestCase):
    """The #676 capability ledger (comment 6587459008) as data read off the
    registry and held to what the report does."""

    #: (function, placement, recurrence, returns_as, measured against,
    #:  not verified from text)
    TABLE = [
        ('intro', 'checked', 'once', 'n/a', [], ''),
        ('verse', 'no claim', 'returns', 'new words', [], ''),
        ('prechorus', 'checked', 'returns', 'varied', ['verse', 'chorus'], ''),
        ('chorus', 'no claim', 'returns', 'verbatim', ['verse'], ''),
        ('postchorus', 'checked', 'returns', 'verbatim', ['chorus'], ''),
        ('refrain', 'no claim', 'returns', 'verbatim', [], ''),
        ('burden', 'checked', 'returns', 'verbatim', [], ''),
        ('bridge', 'no claim', 'once', 'n/a', ['verse', 'chorus'], ''),
        ('breakdown', 'no claim', 'open', 'varied', [], 'whether the arrangement thins'),
        ('build', 'no claim', 'open', 'varied', [], 'whether tension rises'),
        ('drop', 'refused', 'returns', 'varied', [], 'whether it lands as an arrival'),
        ('vamp', 'no claim', 'open', 'varied', [],
         'whether a musical figure repeats under it'),
        ('patter', 'no claim', 'returns', 'new words', ['chorus'], ''),
        ('turnaround', 'checked', 'returns', 'verbatim', [], ''),
        ('interlude', 'checked', 'open', 'n/a', [], ''),
        ('solo', 'no claim', 'open', 'n/a', [], ''),
        ('tag', 'refused', 'returns', 'verbatim', [], ''),
        ('hook', 'no claim', 'returns', 'verbatim', [], ''),
        ('coda', 'checked', 'once', 'n/a', [], ''),
        ('outro', 'checked', 'once', 'n/a', [], ''),
        ('false_ending', 'checked', 'once', 'n/a', [], ''),
        ('reprise', 'checked', 'once', 'varied', [], ''),
    ]
    KEYS = ('function', 'placement', 'recurrence', 'returns_as', 'contrast_measured',
            'not_verified_from_text')

    def test_every_registered_function_has_one_row_and_the_rows_are_these(self):
        rows = function_capabilities()
        self.assertEqual([r['function'] for r in rows], list(G.SECTION_FUNCTIONS))
        self.assertEqual(len(rows), 22)
        self.assertEqual([tuple(r[k] for k in self.KEYS) for r in rows], self.TABLE)
        self.assertEqual([set(r) for r in rows], [set(self.KEYS)] * 22)

    def test_the_placement_column_is_what_the_placement_check_does(self):
        names = list(G.SECTION_FUNCTIONS)
        for row in function_capabilities():
            fn = row['function']
            # Alone, in the middle, at each end, and beside every other name:
            # a row with a claim is charged somewhere, a row without never is.
            orders = [[fn], ['verse', fn, 'verse'], [fn, 'verse'], ['verse', fn]]
            orders += [[other, fn, other] for other in names]
            charged = any(index == order.index(fn)
                          for order in orders
                          for _code, index, _evidence in G.placement_findings(order)
                          if order[index] == fn)
            with self.subTest(function=fn):
                self.assertEqual(charged, row['placement'] == 'checked')
                self.assertEqual(bool(G.SECTION_FUNCTIONS[fn].placement_refused),
                                 row['placement'] == 'refused')

    def test_the_contrast_and_effect_columns_are_what_the_report_says(self):
        for row in function_capabilities():
            fn = row['function']
            others = row['contrast_measured']
            gaps = {g.code: g for g in
                    G.song_function_report(_song(fn, *others))['not_asked']}
            with self.subTest(function=fn):
                self.assertEqual(sorted(others),
                                 sorted(G.SECTION_FUNCTIONS[fn].contrasts_with))
                self.assertNotIn('CONTRAST_NOT_CHECKED', gaps)
                if row['not_verified_from_text']:
                    self.assertIn(f"{fn} ({row['not_verified_from_text']})",
                                  gaps['EFFECT_NOT_VERIFIED'].message)
                else:
                    self.assertNotIn('EFFECT_NOT_VERIFIED', gaps)

    def test_a_role_on_a_blueprint_line_is_still_refused(self):
        # Refrain and burden are sections; nothing marks a single line.
        from quality import meter as M
        for role in ('refrain', 'burden'):
            blueprint = {'sections': [dict(name='Verse', function='verse', bars=2,
                                           start_bar=1, meter={'beats': 4, 'unit': 4})],
                         'lines': [dict(text='one line', bar=1, beat=1, duration=4, role=role)]}
            with self.subTest(role=role), self.assertRaises(ValueError) as refused:
                M.validate_blueprint(blueprint)
            self.assertIn("`role` isn't supported yet", str(refused.exception))


if __name__ == '__main__':
    unittest.main(verbosity=2)

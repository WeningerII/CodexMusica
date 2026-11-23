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
    NOT_VERIFIED_FROM_TEXT, disclose_functions, function_capabilities,
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

    def test_refrain_and_burden_are_ordinary_section_declarations(self):
        # Owner ruling 2026-11-13: the two are sections like any other, so
        # the blueprint reader takes them exactly as it takes `verse`.
        for name in ('refrain', 'burden', 'verse'):
            section = {'name': 'Label', 'function': name, 'bars': 8,
                       'meter': {'beats': 4, 'unit': 4}}
            song, _ = G.song_from_blueprint({'sections': [section], 'lines': []})
            self.assertEqual(song.sections[0].function, name)

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

    def test_helper_does_not_run_planning_or_function_assessment(self):
        with patch.object(P, 'make_plan', side_effect=AssertionError('planner ran')), \
                patch.object(G, 'song_function_report', side_effect=AssertionError('assessment ran')):
            disclose_functions(['middle-eight', 'Introduction'])

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

    def test_the_one_standing_sentence_is_the_one_the_function_verb_prints(self):
        # The four other sentences this module held were printed nowhere and
        # went with `disclose_section` (issue #676, 2026-11-15). What they
        # were for is tested where it is now said: the placement note in
        # `test_placement.py` and the `function:draft` row in
        # `test_song_function.py`.
        self.assertEqual(NOT_VERIFIED_FROM_TEXT, "Acoustic properties aren't verified from text. A section's label or resolved name doesn't show how it sounds when performed.")
        from quality import function_disclosure as FD
        self.assertEqual(sorted(n for n in vars(FD) if not n.startswith('_') and n not in ('deepcopy', 'grid')),
                         ['NOT_VERIFIED_FROM_TEXT', 'disclose_functions', 'function_capabilities'])


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
        # REPINNED 2026-11-21 from ~~'syllables a line after the pickup'~~:
        # the ceiling counts every syllable of the line (bug hunt F4).
        self.assertLess(brief.rindex('syllables in the whole line'),
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
        # A verse beside the bridge since 2026-11-15: a bridge needs a
        # section before it, so a roster of bridges alone plans nothing.
        cases.append({'seed': 11, 'lines': 24, 'functions': ['verse', 'bridge'],
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


class StatedCountDisclosureTests(unittest.TestCase):
    """STAGE 4 (2026-11-16): ~~`recurrence_report` explained a lifted "once"
    preference~~. There is no lift left to explain: only intro, outro and
    coda are dealt at most once, and a stated count is built into the draw.
    The pattern's `chosen_from` names the stated counts it was built with,
    and nothing else prints a recurrence line."""

    cases = [
        dict(seed=11, form='open', lines=24, functions=['false_ending', 'reprise'],
             wants=['sections=4', 'sections.false_ending<=2', 'sections.reprise<=2']),
        dict(seed=11, form='open', lines=24, functions=['verse', 'reprise'],
             wants=['sections=4', 'sections.verse<=1']),
        dict(seed=11, form='open', lines=24, functions=['verse', 'bridge'],
             wants=['sections.bridge=4']),
        dict(seed=11, form='open', lines=24, functions=['verse', 'chorus', 'false_ending', 'reprise'],
             wants=['sections.false_ending=2']),
        dict(seed=2, form='verse-chorus', lines=24,
             functions=['verse', 'chorus', 'false_ending', 'reprise'],
             wants=['sections.reprise=2']),
    ]

    def test_the_report_and_the_lift_are_gone(self):
        self.assertFalse(hasattr(P, 'recurrence_report'))
        harness = (Path(__file__).resolve().parents[1] / 'lyric_harness.py').read_text()
        self.assertNotIn('recurrence_report', harness)

    def test_chosen_from_names_the_stated_counts(self):
        for case in self.cases:
            with self.subTest(case=case):
                p = P.make_plan(**case)
                self.assertTrue(p['choices']['pattern']['chosen_from'].endswith(
                    '; stated counts built into the draw: ' + '; '.join(case['wants'])))
                self.assertNotIn('once preferences', p['writer_brief'])
        for f in G.single_use_functions():
            with self.assertRaises(P.PlanRefused):
                P._recurrence_policy([P.parse_sweep_want('sections.' + f + '=2')])


class PlanReceiptTests(unittest.TestCase):
    """#902: the plan says where its line total came from (it had no
    receipt), and the type receipt says what a rejection does."""

    def test_the_length_receipt_names_its_source(self):
        for form in ('open', 'verse-chorus'):
            with self.subTest(form=form):
                drawn = P.make_plan(5, form=form)
                self.assertEqual(drawn['choices']['total_lines'], {
                    'value': drawn['total_lines'],
                    'chosen_from': f'equal odds over the {len(P.fillable_line_counts(form))} '
                                   'line totals this request allows'})
                self.assertEqual(P.make_plan(5, form=form, lines=24)['choices']['total_lines'],
                                 {'value': 24, 'chosen_from': 'declared'})
        section = lambda role, lines=None: {'unit': 'section', 'role': role, 'lines': lines}
        catalog = lambda *parts: {'version': 1, 'id': 'probe', 'scope': 'rule', 'variant': 0,
                                  'counts': {}, 'rhymeGroups': [], 'returnGroups': [],
                                  'sections': list(parts)}
        # A fixed four-line section and a free one: every total of five or more.
        free = P.make_plan(2, song_form=catalog(section('verse', 4), section('chorus')))
        allowed = [n for n in P.fillable_line_counts('open') if n >= 5]
        self.assertEqual(free['choices']['total_lines'], {
            'value': free['total_lines'],
            'chosen_from': f'equal odds over the {len(allowed)} line totals the catalog form can fill'})
        fixed = P.make_plan(2, song_form=catalog(section('verse', 4), section('chorus', 4)))
        self.assertEqual(fixed['choices']['total_lines'],
                         {'value': 8, 'chosen_from': 'the only line total the catalog form can fill'})
        # Verses of stated, unequal lengths fix the total on a path of their own.
        verses = P.make_plan(0, song_form=catalog(*(section('verse', n) for n in (1, 2, 3))))
        self.assertEqual(verses['choices']['total_lines'],
                         {'value': 6, 'chosen_from': 'the only line total the catalog form can fill'})

    def test_the_split_phrase_and_order_receipts_say_what_was_drawn(self):
        # #902: the per-kind receipt printed the envelope [1, 463]; the
        # wordless sections' phrase draw and the order's redraw were unsaid.
        seen = set()
        for seed in range(12):
            built = P.make_plan(seed)
            sung = [f for f in dict.fromkeys(s['function'] for s in built['sections'])
                    if f not in P.WORDLESS_FUNCTIONS]
            for row in built['choices']['schemes'].values():
                self.assertTrue(row['lines_chosen_from'].startswith(
                    f"equal odds over every split of the {built['total_lines']} lines "
                    f"among the {len(sung)} sung kinds, at least 1 line each"))
            self.assertIn('an order the placement rules refuse is drawn again',
                          built['choices']['pattern']['chosen_from'])
            longest = max(r['lines'] for r in built['choices']['schemes'].values())
            for fn, row in built['choices'].get('wordless_phrases', {}).items():
                seen.add(fn)
                self.assertEqual(row['chosen_from'], [1, longest])
                self.assertLessEqual(1, row['value'])
                self.assertLessEqual(row['value'], longest)
                for section in built['sections']:
                    if section['function'] == fn:
                        self.assertEqual(section['bars'],
                                         row['value'] * built['choices']['bars_per_line'])
        self.assertTrue(seen)
        section = lambda role, lines=None: {'unit': 'section', 'role': role, 'lines': lines}
        catalog = {'version': 1, 'id': 'probe', 'scope': 'rule', 'variant': 0, 'counts': {},
                   'rhymeGroups': [], 'returnGroups': [],
                   'sections': [section('verse', 4), section('chorus')]}
        built = P.make_plan(2, song_form=catalog)
        for row in built['choices']['schemes'].values():
            self.assertEqual(row['lines_chosen_from'], "the catalog form's section lengths; "
                                                       "any it leaves open are split with equal odds")

    def test_the_hook_receipt_names_the_rule_that_chose_the_line(self):
        # #902: the comment said the chorus wins; the rule takes a returning
        # hook section, else the earliest recurring section whose row returns
        # word for word, in song order.
        rules = set()
        for seed in range(30):
            built = P.make_plan(seed, form='verse-chorus')
            count = {}
            for section in built['sections']:
                count[section['function']] = count.get(section['function'], 0) + 1
            returning = {f for f, n in count.items() if n > 1 and f not in P.WORDLESS_FUNCTIONS
                         and G.SECTION_FUNCTIONS[f].returns_as == 'verbatim'}
            pool = ({'hook'} & returning) or returning
            want = next(s['line'] for s in built['line_slots'] if s['function'] in pool)
            self.assertEqual(built['hook_slot'], want)
            receipt = built['choices']['hook']
            self.assertEqual(receipt['value'], want)
            self.assertEqual(receipt['chosen_from'], (
                'the first line of the first returning hook section' if 'hook' in pool else
                'the first line of the earliest sung section whose row returns word for word '
                'and that recurs'))
            fn = next(s['function'] for s in built['line_slots'] if s['line'] == want)
            rules.add(fn == 'chorus')
        self.assertEqual(rules, {True, False})
        self.assertNotIn('hook', P.make_plan(3, form='open')['choices'])

    def test_the_type_receipt_says_a_rejected_type_is_tried_first(self):
        # #902: a group tries a type an earlier group rejected before it
        # draws (`_assign_types`); the receipt said only that it redraws.
        # The seed is the first one whose draw carries a type, not a pin: the
        # 150-line writing cap (#902) re-dealt the seed this test first used.
        def carried(built):
            return any(r['chosen_from'].startswith('carried from an earlier group')
                       for r in built['choices']['relations']['groups'])
        built = next((b for b in map(P.make_plan, range(200)) if carried(b)), None)
        self.assertIsNotNone(built, 'no seed in 0..199 carries a type')
        self.assertIn('the group redraws, trying a type an earlier group rejected first',
                      built['choices']['relations']['chosen_from'])


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
        self.assertIn('      ' + NOT_VERIFIED_FROM_TEXT + '\n', out)


class CapabilityTableTests(unittest.TestCase):
    """The #676 capability ledger (comment 6587459008) as data read off the
    registry and held to what the report does."""

    #: (function, placement, recurrence, returns_as, measured against,
    #:  not verified from text).
    #: ~~The recurrence column is not copied here: since stage 4 it is
    #: checked against `SECTION_FUNCTIONS` itself, below.~~ Stage 4 fix
    #: round, 2026-11-18: that check compared the section table with itself
    #: (`function_capabilities` builds the column from the same field), so a
    #: changed value passed. Every row's value is typed out here again, as
    #: it stands since stage 4: bridge, false_ending and reprise are "open".
    #: Owner's ruling of 18 Nov 2026 (stage 4 fix round, 2026-11-18): the
    #: `returns_as` value is '' on a row that is not asked about its
    #: returns. ~~'n/a'~~ on seven rows and ~~'varied'~~ on breakdown, build,
    #: vamp and reprise were values no code read. Prechorus and drop keep
    #: 'varied', which has a reader now.
    TABLE = [
        ('intro', 'checked', 'once', '', [], ''),
        ('verse', 'no claim', 'returns', 'new words', [], ''),
        ('prechorus', 'checked', 'returns', 'varied', ['verse', 'chorus'], ''),
        ('chorus', 'no claim', 'returns', 'verbatim', ['verse'], ''),
        ('postchorus', 'checked', 'returns', 'verbatim', ['chorus'], ''),
        ('refrain', 'no claim', 'returns', 'verbatim', [], ''),
        ('burden', 'checked', 'returns', 'verbatim', [], ''),
        # 2026-11-15 (owner's ruling): a bridge needs a section before it,
        # so its placement is a claim the planner and the grader check.
        ('bridge', 'checked', 'open', '', ['verse', 'chorus'], ''),
        ('breakdown', 'no claim', 'open', '', [], 'whether the arrangement thins'),
        ('build', 'no claim', 'open', '', [], 'whether tension rises'),
        ('drop', 'refused', 'returns', 'varied', [], 'whether it lands as an arrival'),
        ('vamp', 'no claim', 'open', '', [],
         'whether a musical figure repeats under it'),
        ('patter', 'no claim', 'returns', 'new words', ['chorus'], ''),
        ('turnaround', 'checked', 'returns', 'verbatim', [], ''),
        ('interlude', 'checked', 'open', '', [], ''),
        ('solo', 'no claim', 'open', '', [], ''),
        ('tag', 'refused', 'returns', 'verbatim', [], ''),
        ('hook', 'no claim', 'returns', 'verbatim', [], ''),
        ('coda', 'checked', 'once', '', [], ''),
        ('outro', 'checked', 'once', '', [], ''),
        ('false_ending', 'checked', 'open', '', [], ''),
        ('reprise', 'checked', 'open', '', [], ''),
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

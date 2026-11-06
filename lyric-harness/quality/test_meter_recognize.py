"""Source-frozen supplied-vector contracts for the initial recognition milestone.

Run: python -m unittest quality.test_meter_recognize -v
No dictionary, provider, parser or live-wiring assertion is made here. Fixture
integrity runs separately with ...test_meter_recognize.FixtureIntegrity.
The core import intentionally fails if the separately owned module is absent;
these tests must not silently skip a missing implementation.
"""
import copy
import importlib
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
FIXTURE = Path(__file__).with_name('fixtures') / 'meter_recognize_cases.json'
DATA = json.loads(FIXTURE.read_text(encoding='utf-8'))
CASES = {case['id']: case for case in DATA['cases']}
LIST_BUCKETS = {'candidates', 'requires_unsupported_policy', 'prefix_agreeing',
                'excluded_by_reading'}
NOT_SEARCHED = [
    'mixed-foot composition', 'medial substitution', 'resolution', 'synizesis',
    'outrides', 'rove-over', 'anacrusis', 'stanza and printed-line structure',
]


def identity(row):
    return (row['reading_id'], row['family'], row['feet'],
            tuple(row['policies_used']))


def subset(actual, expected):
    """Match fixed fields; differences are exact, witness lists are subsets."""
    for field, value in expected.items():
        if field == 'conditional_contains':
            if not all(x in actual.get('conditional_on', []) for x in value):
                return False
        elif actual.get(field) != value:
            return False
    return True


class FixtureIntegrity(unittest.TestCase):
    def test_unique_ids_and_complete_correlated_vectors(self):
        self.assertEqual(len(CASES), len(DATA['cases']))
        for case in CASES.values():
            with self.subTest(case=case['id']):
                self.assertIn(case['source_id'], DATA['sources'])
                line = case['input']
                indices = list(range(1, len(line['tokens']) + 1))
                self.assertEqual([x['index'] for x in line['tokens']], indices)
                ids = [r['id'] for r in line['readings']]
                self.assertEqual(len(ids), len(set(ids)))
                for reading in line['readings']:
                    self.assertEqual([o['token'] for o in reading['occurrences']], indices)
                    for occurrence in reading['occurrences']:
                        digits = occurrence['digits']
                        if digits is None:
                            self.assertEqual(occurrence['source'], 'unknown')
                        else:
                            self.assertRegex(digits, r'^[012]+$')
                        self.assertTrue(occurrence['reading_id'])

    def test_exact_freeze_streams(self):
        expected = {'C1': ['1101110101', '0101110001'],
                    'C2': ['11111010', '10101010'],
                    'C3': ['11010010010010010', '00010010010010010'],
                    'C3-S-pair': ['10010010010010010', '00010010010010012'],
                    'RAVEN-S-pair': ['1010101010101010', '1010121010101010'],
                    'V1': ['10010101', '10010101'],
                    'A1': ['001001001001', '001011011001'],
                    'C4': ['01001001', '11011001'],
                    'M190-A': ['01010101010', '01010101011'],
                    'DA9': ['01010', '01012'], 'DA10': ['011', '0101']}
        for cid, streams in expected.items():
            self.assertEqual([''.join(o['digits'] for o in r['occurrences'])
                              for r in CASES[cid]['input']['readings']], streams, cid)

    def test_declaration_occurrences_are_exact(self):
        for cid, tokens in [('A1', [5, 8]), ('C4', [1, 3]), ('M190-A', [9])]:
            reading = CASES[cid]['input']['readings'][0]
            self.assertEqual([o['token'] for o in reading['occurrences']
                              if o['source'] == 'declared'], tokens)
            self.assertTrue(all(reading['occurrences'][t-1]['digits'] == '0'
                                for t in tokens))

    def test_source_text_punctuation_and_case(self):
        self.assertEqual(CASES['A1']['input']['text'],
                         'And the sheen of their spears was like stars on the sea,')
        self.assertEqual(CASES['M185-A']['input']['text'],
                         'Queen and huntress, chaste and fair,')
        self.assertEqual(CASES['M190-A']['input']['text'],
                         'I come to bury Caesar, not to praise him.')
        self.assertTrue(CASES['C3']['input']['text'].startswith('THIS is'))


class RecognitionContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meter = importlib.import_module('quality.meter_recognize')

    def recognize(self, line, **kwargs):
        before = copy.deepcopy(line)
        options = copy.deepcopy(kwargs)
        result = self.meter.recognize(line, **kwargs)
        self.assertEqual(line, before, 'recognition mutated a supplied reading vector')
        self.assertEqual(kwargs, options, 'recognition mutated caller search options')
        self.assertEqual(result['schema'], 'meter_recognize.v1')
        self.assertEqual(result.get('not_searched'), NOT_SEARCHED,
                         'every result must preserve the exact unsearched scope')
        buckets = sorted(LIST_BUCKETS)
        for i, bucket in enumerate(buckets):
            identities = {identity(row) for row in result[bucket]}
            for other in buckets[i + 1:]:
                overlap = identities & {identity(row) for row in result[other]}
                self.assertFalse(overlap,
                                 f'contradictory witness in {bucket} and {other}: {overlap}')
        return result

    def test_source_frozen_subsets(self):
        for case in CASES.values():
            with self.subTest(case=case['id']):
                result = self.recognize(copy.deepcopy(case['input']), **case.get('call', {}))
                for field, expected in case['expected'].items():
                    if field not in LIST_BUCKETS or expected == []:
                        self.assertEqual(result[field], expected, (case['id'], field))
                    else:
                        for witness in expected:
                            self.assertTrue(any(subset(row, witness) for row in result[field]),
                                            (case['id'], field, witness, result[field]))

    def test_default_policy_status_is_source_gated(self):
        registry = self.meter.POLICY_REGISTRY
        for name in ('initial_inversion', 'final_catalexis', 'extra_final_weak'):
            self.assertEqual(registry[name]['status'], 'admitted')
        self.assertEqual(registry['initial_truncation']['status'], 'unsupported')
        for name in ('final_catalexis', 'extra_final_weak'):
            self.assertIn('6642871642', str(registry[name]['source']))

    def test_extra_final_weak_requires_original_final_strong(self):
        result = self.recognize(copy.deepcopy(CASES['extra-final-weak-precondition']['input']))
        for bucket in LIST_BUCKETS:
            self.assertFalse(any(row['family'] == 'trochaic' and row['feet'] == 4
                                 and 'extra_final_weak' in row['policies_used']
                                 for row in result[bucket]), bucket)
        self.assertEqual(result['status'], 'no_candidate_in_searched_space')
        self.assertEqual(result['candidates'], [])

    def test_c4_both_segmentations_and_policy_gate(self):
        line = copy.deepcopy(CASES['C4']['input'])
        result = self.recognize(line)
        self.assertFalse(any('initial_truncation' in c['policies_used']
                             for c in result['candidates']))
        blocked = copy.deepcopy(self.meter.POLICY_REGISTRY)
        blocked['final_catalexis']['status'] = 'unsupported'
        result = self.recognize(line, policies=blocked)
        expected = CASES['C4']['expected']
        for witness in expected['candidates'] + expected['requires_unsupported_policy']:
            self.assertTrue(any(subset(c, witness) for c in result['requires_unsupported_policy']))
        self.assertFalse(any(c['reading_id'] == 'C4-D' and
                             c['policies_used'] == ['final_catalexis']
                             for c in result['candidates']))

    def test_no_silent_promotion_secondary_stress_or_lexical_substitution(self):
        line = copy.deepcopy(CASES['D1']['input'])
        result = self.recognize(line, policies={})
        self.assertEqual({identity(c) for c in result['candidates']},
                         {('D1-currentCMU', 'iambic', 1, ()),
                          ('D1-initial', 'trochaic', 1, ())})
        for r in line['readings']:
            for o in r['occurrences']:
                o['lexical'] = '222222'  # reporting only; must not drive comparison
        changed = self.recognize(line, policies={})
        self.assertEqual(changed['candidates'], result['candidates'])

    def test_declarations_and_guesses_remain_conditional(self):
        for cid in ('A1', 'C4', 'M190-A', 'C3-S-pair', 'RAVEN-S-pair',
                    'guessed-positive-control'):
            line = copy.deepcopy(CASES[cid]['input'])
            result = self.recognize(line)
            by_id = {r['id']: r for r in line['readings']}
            for candidate in result['candidates']:
                conditions = candidate['conditional_on']
                for o in by_id[candidate['reading_id']]['occurrences']:
                    if o['source'] == 'guessed':
                        self.assertIn('guessed: token '+str(o['token']), conditions)
                    if o['source'] == 'declared':
                        self.assertTrue(any(o['reading_id'] in str(c) for c in conditions),
                                        (cid, o['reading_id'], conditions))

    def test_c3_source_pair_preserves_exact_reader_provenance(self):
        case = CASES['C3-S-pair']
        line = copy.deepcopy(case['input'])
        self.assertEqual(line['text'], CASES['C3']['input']['text'])
        observation = case['reader_observation']
        self.assertEqual(observation['text'], line['text'])
        self.assertNotEqual(observation['guide_run']['text'], line['text'])
        self.assertTrue(observation['exact_text_receipt'].endswith('6643450918'))
        config = observation['configuration']
        self.assertEqual(config['constructor'], 'L.Lexicon()')
        self.assertEqual(config['reader_scheme'], 'v2')
        for field in ('fallback', 'supplement', 'declarations'):
            self.assertIsNone(config[field])
        source, reader = line['readings']
        self.assertEqual([o['token'] for o in source['occurrences']
                          if o['source'] == 'declared'], [1, 11])
        for token, occurrence, word in zip(line['tokens'], reader['occurrences'],
                                           observation['words']):
            self.assertEqual(token['word'], word['word'])
            self.assertEqual(occurrence['token'], word['token'])
            self.assertEqual(occurrence['digits'], word['stream'])
            self.assertEqual(occurrence['lexical'], word['lexical'])
            self.assertEqual(occurrence['source'], word['source'])
        hemlocks = reader['occurrences'][-1]
        self.assertEqual((hemlocks['digits'], hemlocks['lexical'], hemlocks['source']),
                         ('12', '12', 'rule'))
        self.assertEqual(observation['words'][-1]['detail'],
                         {'rule': 'plural', 'from': 'hemlock'})
        result = self.recognize(line)
        self.assertTrue(any(subset(row, case['expected']['candidates'][0])
                            for row in result['candidates']))
        self.assertFalse(any(row['reading_id'] == 'C3-reader'
                             for row in result['candidates']))
        self.assertTrue(any(subset(row, case['expected']['excluded_by_reading'][0])
                            for row in result['excluded_by_reading']))

    def test_raven_exact_text_and_single_declaration(self):
        case = CASES['RAVEN-S-pair']
        line = copy.deepcopy(case['input'])
        self.assertEqual(line['text'],
                         'Once upon a midnight dreary, while I pondered, weak and weary,')
        observation = case['reader_observation']
        self.assertEqual(observation['text'], line['text'])
        source, reader = line['readings']
        self.assertEqual([o['token'] for o in source['occurrences']
                          if o['source'] == 'declared'], [4])
        for token, actual, declared, word in zip(line['tokens'], reader['occurrences'],
                                                source['occurrences'], observation['words']):
            self.assertEqual(token['word'], word['word'])
            self.assertEqual(actual['token'], word['token'])
            self.assertEqual(actual['digits'], word['stream'])
            self.assertEqual(actual['lexical'], word['lexical'])
            self.assertEqual(actual['source'], word['source'])
            if actual['token'] != 4:
                self.assertEqual(declared, actual)
        midnight = source['occurrences'][3]
        self.assertEqual((midnight['digits'], midnight['lexical'], midnight['source'],
                          midnight['reading_id']), ('10', '12', 'declared', 'RAVEN-S:token:4'))
        self.assertEqual([w['token'] for w in observation['words'] if w['demoted']], [7])
        for field in ('supplement', 'fallback', 'declarations'):
            self.assertIsNone(observation['configuration'][field])
        result = self.recognize(line)
        self.assertTrue(any(subset(row, case['expected']['candidates'][0])
                            for row in result['candidates']))
        self.assertFalse(any(row['reading_id'] == 'RAVEN-reader'
                             for row in result['candidates']))
        self.assertTrue(any(subset(row, case['expected']['excluded_by_reading'][0])
                            for row in result['excluded_by_reading']))

    def test_bound_cannot_search_unsupplied_or_later_vectors(self):
        line = copy.deepcopy(CASES['correlation-control']['input'])
        positive = copy.deepcopy(line['readings'][0])
        positive['id'] = 'late-01'
        positive['occurrences'][1]['digits'] = '1'
        line['readings'].append(positive)
        capped = self.recognize(line, max_readings=2, policies={})
        self.assertEqual(capped['candidates'], [])
        self.assertEqual(capped['status'], 'no_candidate_in_searched_space')
        self.assertEqual(capped['search'], {'readings_supplied': 3,
                          'readings_examined': 2, 'max_readings': 2, 'complete': False})
        full = self.recognize(line, max_readings=3, policies={})
        self.assertTrue(full['search']['complete'])
        self.assertEqual([identity(c) for c in full['candidates']],
                         [('late-01', 'iambic', 1, ())])

    def test_no_reading_examined_is_not_computed(self):
        # Amendment 4 (#6776646385914): zero work is not evidence of absence.
        for empty, cap, supplied, complete in [(True, 64, 0, True),
                                               (False, 0, 2, False)]:
            with self.subTest(empty=empty, cap=cap):
                line = copy.deepcopy(CASES['correlation-control']['input'])
                if empty:
                    line['readings'] = []
                result = self.recognize(line, max_readings=cap, policies={})
                self.assertEqual(result['status'], 'not_computed')
                self.assertEqual(result.get('not_computed_reason'), 'no reading examined')
                self.assertEqual(result['search'], {'readings_supplied': supplied,
                                  'readings_examined': 0, 'max_readings': cap,
                                  'complete': complete})
                for bucket in LIST_BUCKETS:
                    self.assertEqual(result[bucket], [])

    def test_reading_order_retains_distinct_witnesses(self):
        line = copy.deepcopy(CASES['DA3']['input'])
        first = self.recognize(line, policies={})
        line['readings'].reverse()
        second = self.recognize(line, policies={})
        self.assertEqual({identity(c) for c in first['candidates']},
                         {identity(c) for c in second['candidates']})
        self.assertEqual(second, self.recognize(line, policies={}))

    def test_equal_vectors_keep_literal_witnesses_at_each_cap(self):
        line = {
            'text': 'fixture', 'language': 'eng',
            'tokens': [{'index': 1, 'word': 'x'}],
            'readings': [
                {'id': 'first', 'occurrences': [
                    {'token': 1, 'digits': '01', 'lexical': '01',
                     'source': 'dictionary', 'reading_id': None}]},
                {'id': 'second', 'occurrences': [
                    {'token': 1, 'digits': '01', 'lexical': '01',
                     'source': 'declared', 'reading_id': 'second-declaration'}]},
            ],
        }
        # Literal reviewer oracle: five assertions per cap, no self-reference.
        expected = [
            (0, [], [], [],
             {'readings_supplied': 2, 'readings_examined': 0,
              'max_readings': 0, 'complete': False}, [[], [], []]),
            (1, ['first'], [[]], [('iambic', 1, 'WS')],
             {'readings_supplied': 2, 'readings_examined': 1,
              'max_readings': 1, 'complete': False}, [[], [], []]),
            (2, ['first', 'second'], [[], ['declared: second-declaration']],
             [('iambic', 1, 'WS'), ('iambic', 1, 'WS')],
             {'readings_supplied': 2, 'readings_examined': 2,
              'max_readings': 2, 'complete': True}, [[], [], []]),
            (3, ['first', 'second'], [[], ['declared: second-declaration']],
             [('iambic', 1, 'WS'), ('iambic', 1, 'WS')],
             {'readings_supplied': 2, 'readings_examined': 2,
              'max_readings': 3, 'complete': True}, [[], [], []]),
        ]
        for cap, ids, conditions, geometry, search, empty in expected:
            with self.subTest(cap=cap):
                result = self.recognize(copy.deepcopy(line), families={'iambic': 'WS'},
                                        policies={}, max_readings=cap)
                self.assertEqual([c['reading_id'] for c in result['candidates']], ids)
                self.assertEqual([c['conditional_on'] for c in result['candidates']], conditions)
                self.assertEqual([(c['family'], c['feet'], c['surface'])
                                  for c in result['candidates']], geometry)
                self.assertEqual(result['search'], search)
                self.assertEqual([result[k] for k in ('requires_unsupported_policy',
                                  'prefix_agreeing', 'excluded_by_reading')], empty)

    def test_explicit_malformed_inputs_raise_value_error(self):
        # Only specified token/digit/policy/declaration requirements; no probes
        # of unresolved normalization, precedence or provenance resolution.
        base = {
            'text': 'a beat', 'language': 'eng',
            'tokens': [{'index': 1, 'word': 'a'}, {'index': 2, 'word': 'beat'}],
            'readings': [{'id': 'R', 'occurrences': [
                {'token': 1, 'digits': '0', 'lexical': '0',
                 'source': 'dictionary', 'reading_id': 'dict:a'},
                {'token': 2, 'digits': '1', 'lexical': '1',
                 'source': 'dictionary', 'reading_id': 'dict:beat'},
            ]}],
        }
        refusals = [
            ('duplicate-token-index', ('tokens', 1, 'index'), 1, {}),
            ('occurrences-out-of-order', ('readings', 0, 'occurrences'),
             list(reversed(base['readings'][0]['occurrences'])), {}),
            ('invalid-stress-digit', ('readings', 0, 'occurrences', 0, 'digits'), '3', {}),
            ('invalid-policy-status', (), None, {'policies': {
                'initial_inversion': {'status': 'other', 'source': 6642873705}}}),
            ('missing-declaration-id', ('readings', 0, 'occurrences', 0),
             {'token': 1, 'digits': '0', 'lexical': '0',
              'source': 'declared', 'reading_id': None}, {}),
        ]
        for name, path, value, options in refusals:
            with self.subTest(case=name):
                line = copy.deepcopy(base)
                if path:
                    target = line
                    for key in path[:-1]:
                        target = target[key]
                    target[path[-1]] = copy.deepcopy(value)
                # Other exception classes are errors, never successful refusals.
                with self.assertRaises(ValueError):
                    self.meter.recognize(line, **copy.deepcopy(options))

    def test_unknown_suffix_is_never_globally_aligned(self):
        line = copy.deepcopy(CASES['DA7']['input'])
        original = self.recognize(line)
        line['readings'][0]['occurrences'][3]['digits'] = '222222222'
        line['readings'][0]['occurrences'][4]['digits'] = '000000'
        self.assertEqual(self.recognize(line), original)
        self.assertEqual(original['candidates'], [])
        for bucket in LIST_BUCKETS:
            for row in original[bucket]:
                self.assertIsNone(row['feet'])
                self.assertIsNone(row['template'])
                self.assertIsNone(row['segmentation'])
                self.assertNotIn('final_catalexis', row['policies_used'])
                self.assertNotIn('extra_final_weak', row['policies_used'])
                for difference in row.get('differences', []):
                    self.assertLessEqual(difference['position'], 2)
                    self.assertLess(difference['token'], 3)

    def test_double_removal_and_forbidden_policy_combinations(self):
        result = self.recognize(copy.deepcopy(CASES['double-removal']['input']))
        self.assertTrue(any(c['family'] == 'amphibrachic' and c['feet'] == 3 and
                            c['policies_used'] == ['initial_truncation', 'final_catalexis']
                            for c in result['requires_unsupported_policy']))
        for case in CASES.values():
            result = self.recognize(copy.deepcopy(case['input']), **case.get('call', {}))
            for bucket in LIST_BUCKETS:
                for c in result[bucket]:
                    p = c['policies_used']
                    self.assertFalse({'initial_inversion', 'initial_truncation'} <= set(p))
                    self.assertFalse({'extra_final_weak', 'final_catalexis'} <= set(p))
                    self.assertEqual(len(p), len(set(p)))

    def test_unknown_agreement_under_unsupported_policy_is_separate(self):
        line = copy.deepcopy(CASES['DA7']['input'])
        line['readings'][0]['occurrences'][1]['digits'] = '1'
        result = self.recognize(line, families={'anapestic': 'WWS'})
        self.assertEqual(result['status'], 'not_computed')
        self.assertEqual(result['candidates'], [])
        self.assertEqual(result['prefix_agreeing'], [])
        self.assertTrue(any(c['policies_used'] == ['initial_truncation'] and
                            c['feet'] is None and c['surface'] == 'WS' and
                            c['positions_compared'] == 2
                            for c in result['requires_unsupported_policy']))

    def test_scope_refusals_do_not_search(self):
        for language, theory, reason in [
            ('ang', 'old_english_sievers',
             "language 'ang' is outside modern English scope"),
            ('eng', 'quantitative',
             "theory 'quantitative' is outside accentual-syllabic scope"),
            ('eng', 'sprung', "theory 'sprung' is outside accentual-syllabic scope"),
            ('eng', 'syllabic', "theory 'syllabic' is outside accentual-syllabic scope"),
        ]:
            line = copy.deepcopy(CASES['A1']['input'])
            line.update(language=language, theory=theory)
            result = self.recognize(line)
            self.assertEqual(result['status'], 'unsupported')
            self.assertEqual(result['unsupported_reason'], reason)
            self.assertEqual(result['search']['readings_examined'], 0)
            for bucket in LIST_BUCKETS:
                self.assertEqual(result[bucket], [])

    def test_long_families_are_repeated_feet_not_flat_templates(self):
        for n in (9, 10, 37):
            line = {'text': 'la', 'language': 'eng', 'tokens': [{'index':1,'word':'la'}],
                    'readings': [{'id': 'synthetic-long', 'occurrences': [
                        {'token':1,'digits':'01'*n,'lexical':'01'*n,
                         'source':'declared','reading_id':'synthetic-long'}]}]}
            result = self.recognize(line, policies={})
            self.assertEqual([identity(c) for c in result['candidates']],
                             [('synthetic-long', 'iambic', n, ())])
            self.assertEqual(result['candidates'][0]['template'], 'WS'*n)
            self.assertEqual(result['candidates'][0]['segmentation'], '|'.join(['WS']*n))
            self.assertTrue(result['search']['complete'])


if __name__ == '__main__':
    unittest.main()

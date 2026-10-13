#!/usr/bin/env python3
"""Regressions for the ten-collection Gutenberg data import.

Run: python3 quality/test_gutenberg_next_import.py
The suite_sweep quality/test_*.py discovery includes this executable suite.
"""
from collections import Counter
import hashlib
import importlib.util
import json
import re
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
BATCH = ROOT / 'imports' / 'gutenberg-next-ten'
SPEC = importlib.util.spec_from_file_location('gutenberg_next_ten_import', BATCH / 'integrate.py')
IMPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(IMPORT)
BOOKS = {'69378', '27195', '58414', '51226', '934', '40048',
         '50878', '13646', '1568', '3138'}


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


class DuplicateRegressionTests(unittest.TestCase):
    def setUp(self):
        self.index = IMPORT.Duplicates()

    def test_punctuation_case_and_spacing_do_not_import_same_words_twice(self):
        self.index.add("O bright morning, come!\nWake, my heart; rejoice.",
                       'existing:1', 'Morning')
        match = self.index.match('o BRIGHT morning come\n\nWake my heart rejoice!')
        self.assertIsNotNone(match)
        self.assertEqual(match['reference'], 'existing:1')
        self.assertIn('identical words', match['basis'])
        self.assertEqual(IMPORT.normalized('Mercy—JOY; café!'), 'mercy joy cafe')

    def test_changed_opening_with_substantial_shared_verse_is_same_work(self):
        self.index.add('\n'.join([
            'Lord, keep our hearts through darkest night',
            'The stars above proclaim thy light',
            'Our thankful voices greet the dawn',
            'And sing until the night is gone',
            'Let every heart in peace abide',
            'With mercy ever at our side',
        ]), 'old-hymnal:17', 'Morning hymn')
        match = self.index.match('\n'.join([
            'Our God, defend us through the night',
            'The stars above proclaim thy light',
            'Our thankful voices greet the dawn',
            'And sing until the night is gone',
            'Let every heart in peace abide',
            'With mercy ever at our side',
        ]))
        self.assertIsNotNone(match)
        self.assertEqual(match['reference'], 'old-hymnal:17')
        self.assertEqual(match['shared_distinct_lines'], 5)

    def test_generic_common_first_line_does_not_conflate_different_hymns(self):
        self.index.add('Glory be to God on high\nLet the morning bells reply\n'
                       'Every meadow greets the day\nChildren laugh along the way',
                       'existing:2', 'Praise')
        other = ('Glory be to God on high\nHear the weary sailor cry\n'
                 'Through the tempest guide our ship\nKeep thy promise on each lip')
        self.assertIsNone(self.index.match(other))

    def test_one_repeated_line_does_not_supply_false_corroboration(self):
        self.index.add('Alleluia\nAlleluia\nA little bird is singing',
                       'existing:3', 'Bird')
        self.assertIsNone(self.index.match(
            'Alleluia\nAlleluia\nThe winter wind is blowing'))


class SectionRegressionTests(unittest.TestCase):
    def test_supplied_bracketed_words_are_not_mistaken_for_control_marks(self):
        self.assertEqual(IMPORT.verse_lines('[The] sailors sing.\n[CHORUS]\nHome again!'),
                         ['[The] sailors sing.', 'Home again!'])

    def test_stanza_labels_leave_words_and_stanza_boundaries_intact(self):
        item = {'id': 'stanzas', 'text': 'The moon is bright,\nThe sea is still.\n\n'
                                       'We sing tonight,\nUpon the hill.'}
        self.assertEqual(IMPORT.marked_text(item),
                         '[VERSE 1]\nThe moon is bright,\nThe sea is still.\n\n'
                         '[VERSE 2]\nWe sing tonight,\nUpon the hill.')

    def test_printed_chorus_and_refrain_remain_in_order_without_new_words(self):
        item = {'id': 'chorus',
                'text': 'The sailor comes home.\n\nSing hey, sing ho!\n\n'
                        'His wandering is done.\n\nSing hey, sing ho!',
                'sections': [
                    {'type': 'verse', 'lines': ['The sailor comes home.']},
                    {'type': 'chorus', 'lines': ['Sing hey, sing ho!']},
                    {'type': 'verse', 'lines': ['His wandering is done.']},
                    {'type': 'refrain', 'lines': ['Sing hey, sing ho!']},
                ]}
        marked = IMPORT.marked_text(item)
        self.assertEqual(marked,
                         '[VERSE 1]\nThe sailor comes home.\n\n'
                         '[CHORUS]\nSing hey, sing ho!\n\n'
                         '[VERSE 2]\nHis wandering is done.\n\n'
                         '[REFRAIN]\nSing hey, sing ho!')
        self.assertEqual(IMPORT.verse_lines(marked), IMPORT.verse_lines(item['text']))
        item['sections'][1]['lines'] = ['Invented chorus words']
        with self.assertRaisesRegex(ValueError, 'changes verse words'):
            IMPORT.marked_text(item)


class BatchEvidenceTests(unittest.TestCase):
    def test_optional_pronunciations_bind_only_missing_imported_occurrences(self):
        # The approved asset was bound under reader scheme v1 (prepared
        # 2026-10-09, before the reader batch) and its bytes stay as approved:
        # every set validates verbatim under v1, and a v2 reader rebinds it by
        # raw span (`pronunciation.rebind_occurrences`) without losing a row.
        import lyric_harness as LH
        from quality.pronunciation import (rebind_occurrences, v1_bound_declarations,
                                           validate_choices)
        lex = LH.Lexicon(fallback='high', strip_parens=False, reader_scheme='v1')
        lex_v2 = lex.with_reader_scheme('v2')
        moved = []
        imported = {}
        for path in sorted(IMPORT.DEST.rglob('*.txt')):
            for title, _, rows in IMPORT.lyric_items(path):
                match = re.search(r'\[item: PG(\d+)-(.*?)\]$', title)
                imported[(match[1], match[2])] = {row.text for row in rows}
        words = set()
        work_count = declaration_count = 0
        for book in BOOKS:
            payloads = read_json(BATCH / 'pronunciations' / (book + '.json'))
            for candidate_id, payload in payloads.items():
                with self.subTest(book=book, candidate=candidate_id):
                    self.assertEqual(set(payload), {'pronunciations'})
                    lines = imported[(book, candidate_id)]
                    choices = validate_choices(payload['pronunciations'], lex)
                    self.assertTrue(choices)
                    self.assertTrue(v1_bound_declarations(payload['pronunciations']))
                    rebound = rebind_occurrences(choices, 'v1', 'v2', strip_parens=False)
                    self.assertEqual(validate_choices(rebound, lex_v2), rebound)
                    self.assertEqual(len(rebound), len(choices))
                    moved += [(a['line'], a['word'], a['token'], b['token'])
                              for a, b in zip(choices, rebound) if a['token'] != b['token']]
                    for choice in choices:
                        self.assertIn(choice['line'], lines)
                        self.assertEqual(choice['basis'], 'declared')
                        if choice['word'] not in words:
                            self.assertTrue(lex.transcribe_word(choice['word'])[1],
                                            choice['word'])
                            words.add(choice['word'])
                    work_count += 1
                    declaration_count += len(choices)
        self.assertEqual((work_count, declaration_count), (1030, 9638))
        # Exactly ten rows change position, all on the six `U--h` lines whose
        # dash run v2 reads as punctuation (`U--h, Lawdy` is three tokens).
        self.assertEqual(len(moved), 10, moved)
        self.assertEqual(len({line for line, *_ in moved}), 6, moved)
        self.assertTrue(all(line.startswith('U--h') and new > old
                            for line, word, old, new in moved), moved)
        coverage = read_json(BATCH / 'pronunciations' / 'coverage.json')
        self.assertEqual(coverage['works_with_prepared_declarations'], work_count)
        self.assertEqual(coverage['prepared_declarations'], declaration_count)

    def test_a_v2_library_analysis_rebinds_the_injected_set(self):
        # The scheduler injects one candidate's set verbatim. A v2 analysis
        # moves each row to the token with the same raw span before it
        # validates; the same rows refuse as declared under v2 positions.
        import lyric_harness as LH
        from library.analysis import AnalysisSession
        from quality.pronunciation import validate_choices
        payloads = read_json(BATCH / 'pronunciations' / '69378.json')
        rows = next(p['pronunciations'] for p in payloads.values()
                    if any(r['line'].startswith('U--h') for r in p['pronunciations']))
        lines = list(dict.fromkeys(r['line'] for r in rows))
        with self.assertRaises(ValueError):
            validate_choices(rows, LH.Lexicon(strip_parens=False, reader_scheme='v2'))
        reading = {'reading_unit_id': 'caller-owned-fixture:eng', 'reading_revision': 'fixture-v1',
                   'language': 'eng', 'text': '\n'.join(lines)}
        session = AnalysisSession(reading, {'pronunciations': rows},
                                  {'layers': ['sound'], 'schemas': []})
        bound = session.phon.lexicon.pronunciations
        self.assertEqual(len(bound), len(rows))
        self.assertTrue(any(b['token'] != r['token'] for b, r in zip(bound, rows)))
        for b in bound:
            self.assertEqual(LH.line_tokens(b['line'], strip_parens=False)[b['token'] - 1], b['word'])

    def test_every_imported_lyric_line_survives_the_actual_library_reader(self):
        candidates = {book + ':' + str(item['id']): item
                      for book in BOOKS
                      for item in read_json(BATCH / book / 'candidates.json')}
        audit = read_json(BATCH / 'audit.json')
        imported = {item['key'] for item in audit['entries'] if item['outcome'] == 'imported'}
        seen = set()
        for path in sorted(IMPORT.DEST.rglob('*.txt')):
            for title, _, rows in IMPORT.lyric_items(path):
                match = re.search(r'\[item: PG(\d+)-(.*?)\]$', title)
                self.assertIsNotNone(match, title)
                key = match[1] + ':' + match[2]
                self.assertNotIn(key, seen)
                seen.add(key)
                with self.subTest(key=key):
                    self.assertEqual([row.text for row in rows],
                                     IMPORT.verse_lines(candidates[key]['text']))
        self.assertEqual(seen, imported)

    @classmethod
    def setUpClass(cls):
        cls.candidates = {book: read_json(BATCH / book / 'candidates.json')
                          for book in BOOKS}
        cls.metadata = {book: read_json(BATCH / book / 'collection.json')
                        for book in BOOKS}

    def test_all_ten_sources_have_unique_accounted_candidate_identifiers(self):
        self.assertEqual(set(IMPORT.IDS), BOOKS)
        for book, rows in self.candidates.items():
            with self.subTest(collection=book):
                self.assertTrue(rows)
                identifiers = [str(row['id']) for row in rows]
                self.assertEqual(len(identifiers), len(set(identifiers)))
                for row in rows:
                    self.assertIn(row['disposition'], {'eligible', 'excluded'})
                    self.assertTrue(row.get('source_locator'))
                    if row['disposition'] == 'excluded':
                        self.assertTrue(row.get('reason'))
                    else:
                        self.assertTrue(IMPORT.verse_lines(row['text']))
    def test_supplied_edition_years_are_not_ebook_release_dates(self):
        expected = {'69378': 1926, '27195': 1922, '58414': 1851,
                    '51226': 1860, '40048': 1842, '50878': 1860,
                    '13646': 1894, '1568': 1907, '3138': 1911}
        for book, year in expected.items():
            self.assertEqual(self.metadata[book]['publication_year'], year, book)
        # Gilbert's supplied transcription credits two editions; do not
        # silently replace that evidence with a guessed single original date.
        self.assertIn('1884', self.metadata['934']['edition'])
        self.assertIn('1920', self.metadata['934']['edition'])

    def test_audit_is_complete_disjoint_and_traces_each_candidate_text(self):
        audit = read_json(BATCH / 'audit.json')
        entries = audit['entries']
        expected = {book + ':' + str(row['id']): (book, row)
                    for book, rows in self.candidates.items() for row in rows}
        actual = {row['key']: row for row in entries}
        self.assertEqual(len(actual), len(entries), 'audit has repeated candidate keys')
        self.assertEqual(set(actual), set(expected), 'audit omits or invents candidates')
        outcomes = Counter()
        for key, (book, candidate) in expected.items():
            row = actual[key]
            self.assertEqual(row['collection'], book)
            self.assertIn(row['outcome'], {'imported', 'duplicate', 'excluded'})
            outcomes[(book, row['outcome'])] += 1
            self.assertEqual(row['text_sha256'],
                             hashlib.sha256(candidate['text'].encode()).hexdigest())
            if candidate['disposition'] == 'excluded':
                self.assertEqual(row['outcome'], 'excluded')
                self.assertEqual(row['reason'], candidate['reason'])
            else:
                self.assertIn(row['outcome'], {'imported', 'duplicate'})
            if row['outcome'] == 'duplicate':
                self.assertTrue(row['duplicate_of']['reference'])
                self.assertTrue(row['duplicate_of']['basis'])
                self.assertNotEqual(row['duplicate_of']['reference'], key)
        summary = {row['collection']: row for row in audit['summary']}
        self.assertEqual(set(summary), BOOKS)
        for book, rows in self.candidates.items():
            with self.subTest(collection=book):
                counts = summary[book]
                self.assertEqual(counts['candidates'], len(rows))
                self.assertEqual(sum(counts[k] for k in ('imported', 'duplicate', 'excluded')),
                                 len(rows))
                for kind in ('imported', 'duplicate', 'excluded'):
                    self.assertEqual(counts[kind], outcomes[(book, kind)])

    def test_checked_import_reproduces_committed_outputs_without_writing(self):
        paths = [BATCH / 'audit.json', *sorted(IMPORT.DEST.rglob('*.txt'))]
        before = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
        result = subprocess.run([sys.executable, str(BATCH / 'integrate.py'), '--check'],
                                cwd=ROOT, capture_output=True, text=True, timeout=180)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(before, {p: hashlib.sha256(p.read_bytes()).hexdigest()
                                  for p in paths})
        self.assertEqual(set(IMPORT.DEST.rglob('*.txt')), set(paths[1:]))

    def test_source_manifest_pins_every_staged_import_file(self):
        manifest = {row['path']: row for row in read_json(BATCH / 'source_manifest.json')}
        for path in IMPORT.DEST.rglob('*.txt'):
            raw = path.read_bytes()
            record = manifest['lyric-harness/' + path.relative_to(ROOT).as_posix()]
            expected = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
            self.assertEqual(record['sha'], expected)
            self.assertEqual(record['size'], len(raw))

    def test_previous_batch_is_in_duplicate_comparison_population(self):
        audit = read_json(BATCH / 'audit.json')
        previous = set((ROOT / 'corpus/library/gutenberg-ten').rglob('*.txt'))
        compared = {ROOT / row['path'] for row in audit['existing_sources']}
        self.assertTrue(previous)
        self.assertTrue(previous.issubset(compared))

    def test_workaday_deduplication_retains_the_complete_longer_witness(self):
        rows = {row['id']: row for row in self.candidates['69378']}
        short, long = rows['line01857'], rows['line03773']
        self.assertEqual(len(IMPORT.verse_lines(short['text'])), 8)
        self.assertEqual(len(IMPORT.verse_lines(long['text'])), 48)
        audit = {row['key']: row for row in read_json(BATCH / 'audit.json')['entries']}
        self.assertEqual(audit['69378:line01857']['outcome'], 'duplicate')
        self.assertEqual(audit['69378:line03773']['outcome'], 'imported')
        self.assertEqual(audit['69378:line01857']['duplicate_of']['reference'],
                         '69378:line03773')



if __name__ == '__main__':
    unittest.main(verbosity=2)

"""Occurrence reading regressions against the real English dictionary/readers."""
import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lyric_harness as lh
from quality.phonology.eng import English
from quality import fit, pronunciation as P, rhyme_types as RT

LINE = 'Cut that record; let the bass shake glass'
NOUN = ['R', 'EH1', 'K', 'ER0', 'D']
VERB = ['R', 'IH0', 'K', 'AO1', 'R', 'D']
def choice(line=LINE, token=3, word='record', phones=None, basis='dictionary'):
    return dict(line=line, token=token, word=word, phones=phones or NOUN,
                basis=basis, source='Writer: noun, the disc; explicit performance reading')

class PronunciationChoices(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = lh.Lexicon()

    def lex(self, rows):
        lex = copy.copy(self.base)
        lex.pronunciations = P.validate_choices(rows, lex)
        return lex

    def test_selected_meter_and_verbatim_returns_but_no_dictionary_mutation(self):
        lex = self.lex([choice()])
        for text in [LINE, LINE]:
            read = fit.read_line(text, English(lexicon=lex))
            self.assertFalse(read.prominence_undecided)
            self.assertFalse(read.refused)
            self.assertEqual(read.syllables, 9)
        self.assertTrue(fit.read_line(LINE.replace('Cut', 'Play'), English(lexicon=lex)).prominence_undecided)
        self.assertGreater(len(self.base.entries['record']), 1)
        self.assertEqual(P.declaration_coverage(lex.pronunciations, [LINE, LINE])[0]['matching_lines'], [1, 2])
        self.assertEqual(P.declaration_coverage(lex.pronunciations, ['Play that record'])[0]['status'], 'refused')

    def test_two_identical_words_get_different_readings(self):
        line = 'record record'
        lex = self.lex([choice(line, 1), choice(line, 2, phones=VERB)])
        smap = lh.word_syllable_map(lex, line)
        self.assertEqual([s['stress'] for s in smap], [1, 0, 0, 1])
        read = fit.read_line(line, English(lexicon=lex))
        self.assertFalse(read.prominence_undecided)
        self.assertEqual([s.prominence for s in read.units], [1, 0, 0, 1])

    def test_declared_unknown_and_hyphenated_reading(self):
        for word in ['Zzyzx', 'Zzyzx-Quux']:
            line = 'I love ' + word
            lex = self.lex([choice(line, 3, word, ['Z', 'AY1', 'Z', 'IH0', 'K', 'S'], 'declared')])
            read = fit.read_line(line, English(lexicon=lex))
            self.assertFalse(read.refused, read.refused)
            self.assertEqual(read.syllables, 4)
            self.assertEqual(English(lexicon=lex).for_line(line).for_token(2).read(word).layer, 'declared')

    def test_options_are_actual_dictionary_choices_and_group_returns(self):
        opts = P.reading_options(self.base, [LINE, LINE])
        record = next(row for row in opts['items'] if row['word'] == 'record')
        self.assertEqual(record['matching_lines'], [1, 2])
        self.assertIn(NOUN, [r['phones'] for r in record['dictionary_readings']])

    def test_invalid_declarations_refuse(self):
        bad = [dict(choice(), token=True), dict(choice(), token=2), dict(choice(), source=' '),
               dict(choice(), phones=['R', 'EH', 'K']), dict(choice(), phones=['R', 'K']),
               dict(choice(), phones=['R', 'AA1']), dict(choice(), basis='guessed'),
               dict(choice(), extra=True)]
        for row in bad:
            with self.subTest(row=row), self.assertRaises(ValueError): self.lex([row])
        with self.assertRaises(ValueError): self.lex([choice(), choice()])
        with self.assertRaises(ValueError): self.lex({})

    def test_rhyme_consensus_changes_only_selected_occurrence(self):
        line = 'Feel the wind'
        lex = self.lex([choice(line, 3, 'wind', ['W', 'AY1', 'N', 'D'])])
        decl = lh.Declaration()
        self.assertIsNone(RT.coarse_relation_consensus(self.base, line, 'What we find', decl, relation='RHYME'))
        result = RT.coarse_relation_consensus(lex, line, 'What we find', decl, relation='RHYME')
        self.assertIsNotNone(result)
        self.assertIsNone(RT.coarse_relation_consensus(lex, 'Hear the wind', 'What we find', decl, relation='RHYME'))

    def test_named_pair_reads_each_occurrence_independently(self):
        line = 'wind wind'
        lex = self.lex([choice(line, 1, 'wind', ['W', 'AY1', 'N', 'D']),
                        choice(line, 2, 'wind', ['W', 'IH1', 'N', 'D'])])
        readers = tuple(English(lexicon=P.for_member(lex, line, 'wind', i)) for i in [0, 1])
        pair = RT.classify_pair('wind', 'wind', English(), member_phons=readers)
        self.assertIsNotNone(pair)
        self.assertEqual(readers[0].syllabify('wind')[0].nucleus, 'AY')
        self.assertEqual(readers[1].syllabify('wind')[0].nucleus, 'IH')
        self.assertFalse(pair.unknown_channels)

    def test_stream_tokens_respect_unsung_asides_and_keep_scope(self):
        from quality import relations as R
        line = 'I (whisper softly) hear wind'
        lex = self.lex([choice(line, 3, 'wind', ['W', 'AY1', 'N', 'D'])])
        stream = R.build_stream([line], English(lexicon=lex))
        self.assertEqual(stream.lexical_tokens, (('I', 'hear', 'wind'),))
        self.assertEqual(stream.units[stream.tokens[(0, 2)][0]].syl.nucleus, 'AY')
        lex.strip_parens = False
        lex.pronunciations = P.validate_choices([choice(line, 5, 'wind', ['W', 'IH1', 'N', 'D'])], lex)
        stream = R.build_stream([line], English(lexicon=lex))
        self.assertEqual(len(stream.lexical_tokens[0]), 5)
        self.assertEqual(stream.units[stream.tokens[(0, 4)][0]].syl.nucleus, 'IH')

    def test_scoped_cache_declarations_and_resource_bound(self):
        from quality.plan import draft_execution_bound
        line = 'record record'
        lex = self.lex([choice(line, 1), choice(line, 2, phones=VERB)])
        phon = English(lexicon=lex).for_line(line)
        self.assertNotEqual(phon.for_token(0).declaration(), phon.for_token(1).declaration())
        line = 'My Zzyzx'
        lex = self.lex([choice(line, 2, 'Zzyzx', ['AA1'] * 40, 'declared')])
        bound = draft_execution_bound([line], English(lexicon=lex))
        self.assertEqual(bound['observed_line_units'], [41])
        self.assertEqual(bound['unreadable_tokens_per_line'], [0])

    def test_no_hidden_fallback_when_adapter_declares_dictionary_only(self):
        lex = lh.Lexicon(fallback='low')
        self.assertIsNotNone(English(fallback='low', lexicon=lex).read('Moonshot'))
        self.assertIsNone(English(lexicon=lex).read('Moonshot'))

    def test_midline_and_named_grade_honor_selected_word(self):
        from quality.revise import Reviser
        from quality.schemes import mandate
        lines = ['Feel the wind against the glass', 'I seek the answer I must find']
        lex = self.lex([choice(lines[0], 3, 'wind', ['W', 'AY1', 'N', 'D'])])
        for relation in ['class:RHYME', 'type:perfect rhyme (last stressed syllable)']:
            m = mandate([['1.T3', '2.end']], n_lines=2, default_relation=relation)
            report = Reviser(lex=lex).grade(lines, m)
            self.assertEqual(report['pairs_judged'], 1, report)
            self.assertEqual(report['pairs_refused'], 0, report)
            self.assertFalse(report['violations'], report)

    def test_changing_bound_line_is_rejected_as_coverage_regression(self):
        from quality.revise import Reviser
        from quality.schemes import mandate
        before = [LINE, 'We hold our breath and let the feeling pass']
        after = [LINE.replace('Cut', 'Play'), before[1]]
        m = mandate('AA', n_lines=2, default_relation='class:ASSONANCE')
        result = Reviser(lex=self.lex([choice()])).verify(before, after, m, targeted={1})
        self.assertFalse(result['accepted'])
        self.assertIn('pronunciation:1', result['layer_coverage_regressions'])

    def test_actual_cli_parses_choices_and_exports_options(self):
        import json, subprocess, tempfile
        with tempfile.TemporaryDirectory() as directory:
            draft = Path(directory) / 'draft.txt'
            draft.write_text(LINE + '\nWe hold our breath and let the feeling pass\n')
            result = subprocess.run([sys.executable, str(Path(lh.__file__).resolve()),
                '--pronunciations=' + json.dumps([choice()]), 'brief', str(draft),
                '--groups=1,2', '--relation=class:ASSONANCE'], capture_output=True, text=True)
            self.assertIn(result.returncode, [0, 2, 3], result.stderr)
            self.assertIn('"pronunciation_options":', result.stdout)
            self.assertIn('"pronunciations":[', result.stdout)

    def test_cli_refuses_unsupported_command_without_crashing(self):
        import subprocess
        result = subprocess.run([sys.executable, str(Path(lh.__file__).resolve()),
            '--pronunciations=[]', 'score', 'cat', '--', 'hat'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn('--pronunciations is supported', result.stdout + result.stderr)

if __name__ == '__main__': unittest.main()

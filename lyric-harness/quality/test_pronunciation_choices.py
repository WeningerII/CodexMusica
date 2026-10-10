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

    def test_explicit_stress_survives_function_word_defaults_in_every_reader(self):
        # The frozen Dead Letter Office run exposed an unjudgeable T5
        # anchor on "back". Its documented explicit-reading recovery must
        # not silently demote the stress the writer has just declared.
        from quality.revise import Reviser
        from quality.schemes import mandate
        for line, token, word, phones in (
                ('I hear her call back: darling child', 5, 'back', ['B', 'AE1', 'K']),
                ('The last word is the', 5, 'the', ['DH', 'AH1'])):
            with self.subTest(word=word):
                lex = self.lex([choice(line, token, word, phones, 'declared')])
                chosen = [s for s in lh.word_syllable_map(lex, line)
                          if s['widx'] == token - 1]
                self.assertEqual([s['stress'] for s in chosen], [1])
                default = [s for s in lh.word_syllable_map(self.base, line)
                           if s['widx'] == token - 1]
                self.assertEqual([s['stress'] for s in default], [0])
                read = fit.read_line(line, English(lexicon=lex))
                self.assertEqual([s.prominence for s in read.units
                                  if s.word == word], [1])
                self.assertIn(phones[-2], lex.transcribe(line)[0])
                if word == 'back':
                    m = mandate([['1.T5', '2.end']], n_lines=2,
                                default_relation='class:RHYME')
                    lines = [line, 'We follow the track']
                    # Undeclared, `back` at T5 is no longer unanchorable: a
                    # small word may be sung stressed (standing rule 5), so the
                    # pair is judged rather than refused either way.
                    self.assertEqual(Reviser(lex=self.base).grade(lines, m)['pairs_refused'], 0)
                    report = Reviser(lex=lex).grade(lines, m)
                    self.assertEqual(report['pairs_refused'], 0, report)
                    self.assertFalse(report['violations'], report)
                else:
                    anchors, _, _ = lh.line_anchors(lex, line)
                    self.assertTrue(anchors)
                    self.assertTrue(all(a[-1]['stress'] == 1 for a in anchors))

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

    def test_options_are_scoped_to_lines_a_refused_obligation_names(self):
        other = 'The wind was in the trees'
        lines = [LINE, other, LINE]
        full = P.reading_options(self.base, lines)
        self.assertEqual(full['total'], len(full['items']))
        self.assertIn('the', {row['word'].lower() for row in full['items']
                              if row['line'] == other})
        # Nothing refused: every reading gave the same verdict, so no choice
        # can move one. Nothing is listed; the count of ambiguous words stays.
        clean = P.reading_options(self.base, lines, {'refused_obligations': []})
        self.assertEqual((clean['items'], clean['scope'], clean['eligible']),
                         ([], 'no_refused_obligation', 0))
        self.assertEqual(clean['total'], full['total'])
        self.assertFalse(clean['truncated'])
        # A refused rhyme names both its lines; a verbatim return of a named
        # line is the same text and so the same choice.
        rhyme = P.reading_options(self.base, lines, {'refused_obligations': ['rhyme:2:9:0']})
        self.assertEqual(rhyme['scope'], 'refused_lines')
        self.assertEqual({row['line'] for row in rhyme['items']}, {other})
        self.assertEqual(rhyme['eligible'], len(rhyme['items']))
        prom = P.reading_options(self.base, lines, {'refused_obligations': ['prominence:L3']})
        self.assertEqual({row['line'] for row in prom['items']}, {LINE})
        record = next(row for row in prom['items'] if row['word'] == 'record')
        self.assertEqual(record['matching_lines'], [1, 3])
        meter = P.reading_options(self.base, lines, {'refused_obligations': ['meter:SLOTS_EXCEEDED:L2']})
        self.assertEqual({row['line'] for row in meter['items']}, {other})
        # A refusal that names no line cannot rule any line out.
        unscoped = P.reading_options(self.base, lines,
                                     {'refused_obligations': ['rhyme:2:9:0', 'function:X:0']})
        self.assertEqual((unscoped['scope'], unscoped['items']), ('all', full['items']))
        self.assertEqual(P.refused_lines({'refused_obligations': ['return:4:36', 'prominence:L7']}),
                         ({4, 36, 7}, True))
        self.assertEqual(P.refused_lines(None), (set(), True))

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
        # Unanimity (the instruments' rule) is still undecided on the bare
        # spelling and decided once this occurrence declares a reading; the
        # declaration does not leak to another line's `wind`. The graders'
        # default asks whether ANY reading holds (standing rule 5): it does.
        self.assertIsNone(RT.coarse_relation_consensus(self.base, line, 'What we find', decl, relation='RHYME', quantifier='unanimous'))
        result = RT.coarse_relation_consensus(lex, line, 'What we find', decl, relation='RHYME', quantifier='unanimous')
        self.assertIsNotNone(result)
        self.assertIsNone(RT.coarse_relation_consensus(lex, 'Hear the wind', 'What we find', decl, relation='RHYME', quantifier='unanimous'))
        self.assertIs(RT.coarse_relation_consensus(self.base, line, 'What we find', decl, relation='RHYME'), True)

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

    def test_scoped_cache_declarations_and_declared_units(self):
        from quality import relations as R
        line = 'record record'
        lex = self.lex([choice(line, 1), choice(line, 2, phones=VERB)])
        phon = English(lexicon=lex).for_line(line)
        self.assertNotEqual(phon.for_token(0).declaration(), phon.for_token(1).declaration())
        line = 'My Zzyzx'
        lex = self.lex([choice(line, 2, 'Zzyzx', ['AA1'] * 40, 'declared')])
        # (Read through the draft work bound until the owner deleted it
        # 2026-09-28; the stream is the reader that bound counted.)
        st = R.build_stream([line], English(lexicon=lex))
        self.assertEqual(len(st.units), 41)

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
        # The regression this used to name, `prominence:L1`, was the deleted
        # prominence band's obligation (owner ruling 2026-10-01, CLAUDE.md
        # standing rule 5): no layer regresses now, and the retired reading
        # is still recorded as retired, never as a regression.
        self.assertEqual(result['layer_coverage_regressions'], [])
        self.assertNotIn('pronunciation:1', result['layer_coverage_regressions'])
        retired = next(row for row in result['coverage_after']['obligations']
                       if row['id'] == 'pronunciation:1')
        self.assertEqual(retired['status'], 'not_requested')
        self.assertTrue(retired['retired'])
        self.assertFalse(retired['matching_lines'])

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

    @staticmethod
    def function_blueprint(lines, size=2):
        return {'sections': [dict(name=f'chorus{i//size}', function='chorus',
                    bars=size, start_bar=i+1, meter={'beats': 4, 'unit': 4})
                    for i in range(0, len(lines), size)],
                'lines': [dict(text=t, bar=i+1, beat=1, duration=4)
                          for i, t in enumerate(lines)]}

    def test_function_uses_exact_endpoint_occurrence_not_first_repeated_token(self):
        from quality import grid as G
        line = 'Read record, record!'
        lex = self.lex([choice(line, 2, 'record', VERB), choice(line, 3, 'record', NOUN)])
        key = G.rime_cmudict(lex)
        self.assertEqual(key.end_occurrence(line), ('record', 3, 'EH K ER D'))
        self.assertEqual(key('record'), 'AO R D')
        self.assertEqual(G.rime_cmudict(self.base).end_occurrence(line)[2], 'AO R D')
        self.assertEqual(key.end_occurrence(line.replace('Read', 'Play'))[2], 'AO R D')
        self.assertEqual(key.end_occurrence(line)[2], 'EH K ER D')
        # An earlier occurrence must never lend its choice to the final word.
        earlier = self.lex([choice(line, 2, 'record', NOUN)])
        self.assertEqual(G.rime_cmudict(earlier).end_occurrence(line)[2], 'AO R D')
        # Parenthetical asides are not sung endpoints under the default coordinate.
        aside = 'Read record (softly)'
        declared = self.lex([choice(aside, 2, 'record', NOUN)])
        self.assertEqual(G.rime_cmudict(declared).end_occurrence(aside), ('record', 2, 'EH K ER D'))

    def test_function_partition_and_rendered_drift_use_the_same_occurrences(self):
        from quality import grid as G
        lines = ['Read record', 'Hold the cord', 'Play record', 'Strike the chord']
        lex = self.lex([choice(lines[0], 2, 'record', VERB),
                        choice(lines[2], 2, 'record', NOUN)])
        song, _ = G.song_from_blueprint(self.function_blueprint(lines))
        findings, refusals, returns = G.return_findings(song, 'chorus', rhyme_key=G.rime_cmudict(lex))
        self.assertFalse(returns[0][2].rhyme_scheme_preserved)
        drift = next(f for f in findings if f.code == 'RETURN_SCHEME_DRIFT')
        self.assertIn('is AA', drift.evidence)
        self.assertIn('is AB', drift.evidence)
        self.assertFalse([r for r in refusals if r.code == 'END_WORD_UNREADABLE'])

    def test_function_failed_words_survive_aggregation_and_coverage(self):
        from quality import grid as G
        from quality.revise import Reviser
        lines = ['We reach sixty-six', 'Wait for streetlights',
                 'We reach sixty-six', 'Wait for streetlights',
                 'We reach sixty-six', 'Wait for streetlights']
        bp = self.function_blueprint(lines)
        song, _ = G.song_from_blueprint(bp)
        report = G.song_function_report(song, rhyme_key=G.rime_cmudict(self.base))
        refusal = next(r for r in report['refusals'] if r.code == 'END_WORD_UNREADABLE')
        self.assertEqual(sorted((f.line, f.token, f.word) for f in refusal.failed_words),
                         [(n, 3, 'sixty-six' if n % 2 else 'streetlights') for n in range(1, 7)])
        self.assertIn('2 of 2 return comparison(s)', refusal.evidence)
        coverage = []
        findings = Reviser(lex=self.base)._function_findings(lines, bp, coverage_out=coverage)
        refused = [o for o in coverage if o['status'] == 'refused']
        self.assertEqual({o['id'] for o in refused}, {'function:draft'} |
                         {f'function:END_WORD_UNREADABLE:T3:L{n}' for n in range(1, 7)})
        note = next(f for f in findings if f.code == 'END_WORD_UNREADABLE')
        self.assertEqual(note.locations, list(range(1, 7)))
        for n in range(1, 7):
            self.assertIn(f'L{n} token 3', note.evidence)
        cov = {'refused_obligations': [o['id'] for o in refused], 'obligations': coverage}
        self.assertEqual(P.refused_lines(cov), (set(range(1, 7)), True))
        self.assertEqual(P.reading_options(self.base, lines + ['Read record'], cov)['scope'], 'refused_lines')
        self.assertNotIn('record', [o['word'] for o in P.reading_options(self.base, lines + ['Read record'], cov)['items']])
        cov['refused_obligations'].append('function:UNKNOWN:0')
        self.assertFalse(P.refused_lines(cov)[1])

    def test_function_oov_declaration_clears_only_its_exact_occurrence(self):
        from quality import grid as G
        from quality.revise import Reviser
        lines = ['We reach sixty-six', 'Wait for streetlights'] * 2
        rows = [choice(lines[0], 3, 'sixty-six', ['S', 'IH1', 'K', 'S'], 'declared')]
        lex = self.lex(rows)
        bp = self.function_blueprint(lines)
        coverage = []
        findings = Reviser(lex=lex)._function_findings(lines, bp, coverage_out=coverage)
        refusal = next(f for f in findings if f.code == 'END_WORD_UNREADABLE')
        self.assertEqual(refusal.locations, [2, 4])
        self.assertNotIn('sixty-six', refusal.evidence)
        self.assertIsNone(G.rime_cmudict(lex)('sixty-six'))
        self.assertIsNone(G.rime_cmudict(lex).end_occurrence('They reach sixty-six')[2])
        rows.append(choice(lines[1], 3, 'streetlights', ['S', 'T', 'R', 'IY1', 'T', 'L', 'AY2', 'T', 'S'], 'declared'))
        coverage = []
        findings = Reviser(lex=self.lex(rows))._function_findings(lines, bp, coverage_out=coverage)
        self.assertFalse([f for f in findings if f.code == 'END_WORD_UNREADABLE'])
        self.assertEqual(next(o['status'] for o in coverage if o['id'] == 'function:draft'), 'answered')
        self.assertNotIn('streetlights', self.base.entries)

    def test_generic_function_callback_and_unplaced_failure_stay_honest(self):
        from quality import grid as G
        result = G.compare_returns(['cat', 'zzz'], ['hat', 'yyy'], rhyme_key=lambda w: None if w in ('zzz', 'yyy') else 'AT')
        ref = next(r for r in result.refusals if r.code == 'END_WORD_UNREADABLE')
        self.assertEqual([(f.side, f.section_line, f.word, f.line) for f in ref.failed_words],
                         [('first', 2, 'zzz', None), ('again', 2, 'yyy', None)])
        self.assertIn("first line 2 token 1 'zzz'", ref.evidence)
        self.assertIsNone(result.rhyme_scheme_preserved)

    def test_function_bridge_and_reprise_share_occurrence_routing(self):
        from quality import grid as G
        lines = ['Read record', 'Hold the cord', 'Play record', 'Strike the chord']
        lex = self.lex([choice(lines[0], 2, 'record', NOUN)])
        bp = self.function_blueprint(lines)
        bp['sections'][0]['function'] = 'intro'
        bp['sections'][1]['function'] = 'outro'
        song, _ = G.song_from_blueprint(bp)
        self.assertEqual(G._channel_values(song, song.sections[:1], G.rime_cmudict(lex))['rhyme_inventory'],
                         {'EH K ER D', 'AO R D'})
        _, _, returns = G.reprise_findings(song, rhyme_key=G.rime_cmudict(lex))
        self.assertFalse(returns[0][2].rhyme_scheme_preserved)
        song.lines[0].text = 'Wait for streetlights'
        _, refs, _ = G.reprise_findings(song, rhyme_key=G.rime_cmudict(lex))
        refusal = next(r for r in refs if r.code == 'END_WORD_UNREADABLE')
        self.assertEqual([(f.line, f.token, f.word) for f in refusal.failed_words], [(1,3,'streetlights')])

    def test_function_blank_filter_preserves_original_draft_line(self):
        from quality import grid as G
        from quality.revise import Reviser
        lines = ['', 'Wait for streetlights', '', 'Wait for streetlights']
        coverage = []
        findings = Reviser(lex=self.base)._function_findings(lines, self.function_blueprint(lines), coverage_out=coverage)
        note = next(f for f in findings if f.code == 'END_WORD_UNREADABLE')
        self.assertEqual(note.locations, [2,4])
        self.assertEqual([o['line'] for o in coverage if o.get('word') == 'streetlights'], [2,4])
        # Expanded pointers do not pretend the expanded lines occupy the
        # abbreviated section's printed coordinates.
        song, _ = G.song_from_blueprint(self.function_blueprint(['Wait for streetlights', 'Sing home'] * 2))
        result = G.compare_returns(['Wait for streetlights'], ['Wait for streetlights'], rhyme_key=G.rime_cmudict(self.base))
        result.stub_resolutions = (('again', 1, 1, ('Wait for streetlights',)),)
        located = G._locate_failure(song, *song.sections, result, result.refusals[0])
        self.assertTrue(all(f.line is None for f in located.failed_words))

if __name__ == '__main__': unittest.main()

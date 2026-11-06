#!/usr/bin/env python3
"""Eight-arm #676 characterization; no browser or typed-role acceptance.

Replacement for the historical no-body floor skip, not the historical suite.
Oracle: #666 comments 6640589186/6640618457; existing core contracts are
already tested in test_revise/test_mandate_language. Additional coverage is
their interaction with the REAL floor and coverage in the same inspection.
Run: python3 -B lyric-harness/quality/test_p2_full_floor.py
Requires repository runtime requirements and verified staged assets; no fetch.
"""
import json
import os
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class FullFloorReturnCharacterization(unittest.TestCase):
    def test_full_floor_repeat_licence_and_return_flags(self):
        from quality.release_assets import verify_asset

        verified, unavailable = {}, []
        for name in ('cmudict', 'tagger_eng', 'wordnet', 'runtime_tables'):
            try:
                verified[name] = verify_asset(name)['files']
            except (OSError, ValueError) as error:
                unavailable.append(f'{name}: {error}')
        if unavailable:
            self.skipTest('Required pinned assets unavailable/unverified: '
                          + '; '.join(unavailable))

        # Verification must cover the actual tagger search root, not a spare
        # verified copy while NLTK silently consumes a different model.
        staged = Path(os.environ.get('LYRIC_STAGED_DATA') or ROOT / 'data')
        nltk_root = Path(os.environ.get('NLTK_DATA') or staged / 'nltk')
        self.assertEqual(nltk_root.resolve(), (staged / 'nltk').resolve(),
                         'NLTK_DATA must select the verified staged assets')
        import nltk
        from lyric_harness import Lexicon
        from quality import schemes as S
        from quality.revise import Reviser, ReviseDeclaration

        print(json.dumps({'python': sys.version, 'nltk': nltk.__version__,
                          'LYRIC_STAGED_DATA': str(staged.resolve()),
                          'NLTK_DATA': str(nltk_root.resolve()),
                          'verified_assets': verified}, sort_keys=True), flush=True)
        lex = Lexicon()
        original = ['I hold the light', 'We face the night',
                    'I hold the light', 'You face the night']
        selected_codes = {'LEXICAL_MONOTONY', 'LEXICAL_REPETITION_DECLARED',
                          'REPEAT_IN_VERSE', 'REFRAIN_REPEAT',
                          'SCHEME_VIOLATION', 'RETURN_NOT_VERBATIM'}
        for licence in ('unlicensed', 'refrain'):
            for declared in (False, True):
                for edited in (False, True):
                    with self.subTest(licence=licence, returns=declared, edited=edited):
                        lines = list(original)
                        if edited:
                            lines[0] = 'I guard the light'
                        before = list(lines)
                        mandate = S.mandate('ABAB', n_lines=4,
                                            returns=[[1, 3]] if declared else None)
                        # No floor double and no result/coverage substitution.
                        result = Reviser(lex=lex, rdecl=ReviseDeclaration(
                            repeat_licence=licence)).inspect(lines, mandate)
                        placed = result['whole'] + [f for bucket in
                            result['per_line'].values() for f in bucket]
                        findings = list({id(f): f for f in placed}.values())
                        triples = [(f.code, f.severity, tuple(f.locations))
                                   for f in findings]
                        coverage = result['coverage']
                        print(json.dumps({'licence': licence, 'returns': declared,
                            'edited': edited, 'placements': len(placed),
                            'identity_unique_findings': triples,
                            'coverage': coverage}, sort_keys=True), flush=True)

                        expected = [('LEXICAL_MONOTONY', 'flag', ())]
                        if declared:
                            expected += [('REPEAT_IN_VERSE', 'note', (2,)),
                                         ('SCHEME_VIOLATION', 'flag', (2, 4)),
                                         ('REFRAIN_REPEAT', 'note', (1, 3))]
                            if edited:
                                expected += [('RETURN_NOT_VERBATIM', 'flag', (1, 3))]
                            else:
                                expected[0] = ('LEXICAL_REPETITION_DECLARED', 'note', ())
                        else:
                            expected += [('REPEAT_IN_VERSE', 'flag', (1, 2))]
                            if licence == 'refrain':
                                expected += [('REFRAIN_REPEAT', 'note', (1, 3)),
                                             ('REFRAIN_REPEAT', 'note', (2, 4))]
                        # Count distinct Findings, never collapse equal fields.
                        self.assertCountEqual([t for t in triples
                                               if t[0] in selected_codes], expected)
                        obligations = coverage['obligations']
                        self.assertEqual([o for o in obligations if o['layer'] == 'return'],
                            [{'id': 'return:1:3', 'layer': 'return', 'status': 'answered'}]
                            if declared else [])
                        for layer in ('floor', 'sentencehood'):
                            self.assertIn({'id': layer + ':draft', 'layer': layer,
                                           'status': 'answered'}, obligations)
                        self.assertEqual(coverage['refused_obligations'], [])
                        self.assertEqual(tuple(coverage[k] for k in
                            ('pairs_mandated', 'pairs_judged', 'pairs_refused')), (2, 2, 0))
                        self.assertIs(coverage['certified'], True)
                        # Certified coverage coexists with quality flags in ALL arms.
                        self.assertTrue(any(f.severity == 'flag' for f in findings))
                        self.assertEqual(lines, before, 'inspection must not synchronize text')


if __name__ == '__main__':
    unittest.main(verbosity=2)

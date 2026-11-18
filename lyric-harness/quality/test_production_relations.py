#!/usr/bin/env python3
"""Production audit counterexamples: complete figures, boundaries and readings."""
import dataclasses
import os
import sys
import unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from quality import relations as R, rhyme_types as RT, figures
from quality.phonology import get, MERGED
from quality.phonology.eng import English
from quality.phonology.ltc import MiddleChinese


def stream(lines, phon=None):
    return R.build_stream(lines, phon or get('eng'), stanzas=[0]*len(lines),
                          stanza_source='test declaration')


def pair(name, lines, phon=None):
    return R.line_pairs_for(R.REGISTRY[name], stream(lines, phon))


class ProductionRelations(unittest.TestCase):
    def test_slang_requires_its_declared_surface_not_an_ordinary_dictionary(self):
        ordinary = stream(['cat', 'dog'])
        schema = R.REGISTRY['rhyming slang']
        self.assertTrue(ordinary.provides('lexicon'))
        self.assertFalse(ordinary.provides('slang'))
        result = R.line_pairs_for(schema, ordinary)
        self.assertIsInstance(result, R.Refusal)
        self.assertFalse(getattr(result, 'undecided', ()))
        vocabulary = R.whole_vocabulary_pairs(['cat', 'dog'], get('eng'))
        self.assertFalse(vocabulary)
        self.assertFalse(vocabulary.undecided)
        self.assertIn('slang', schema.capabilities())
        ordinary.alt['slang'] = stream(['cat', 'hat'])
        self.assertTrue(ordinary.provides('slang'))
        self.assertEqual(R.line_pairs_for(schema, ordinary), {(1, 2)})

    def test_schema_merge_cache_tracks_content_of_mutated_draft(self):
        from unittest.mock import patch
        from lyric_harness import Declaration
        from quality.revise import Reviser
        from quality.schemes import mandate
        rv = Reviser.__new__(Reviser)
        rv.decl = Declaration()
        lines = ['cat', 'hat']
        m = mandate('AA', n_lines=2)
        def answers(draft, *args, **kwargs):
            return {(1, 2): ['rhyme']} if draft[1] == 'hat' else {}
        with patch.object(rv, '_relation_phonology', return_value=None), \
                patch.object(R, 'whole_vocabulary_pairs', side_effect=answers) as judge:
            self.assertTrue(rv._schema_satisfies(lines, m, [(1, 2)]))
            lines[1] = 'dog'
            self.assertFalse(rv._schema_satisfies(lines, m, [(1, 2)]))
            self.assertFalse(rv._schema_satisfies(list(lines), m, [(1, 2)]))
            self.assertEqual(judge.call_count, 2)


    def test_requested_pairs_match_full_registry_in_full_context(self):
        from unittest.mock import patch
        contexts = [
            stream(['the silver cat', 'the winter hat', 'we hold the wind',
                    'you cannot find', 'we hold qzxqzx']),
            R.build_stream(['we hold the cat', 'we warm the cat',
                            'she sings the sun', 'a silver moon'], get('eng'),
                           sections=['a','a','b','b'], stanzas=[0,0,1,1],
                           stanza_source='test declared boundaries'),
            stream(['東','同','重','鐘'], MiddleChinese(standard='pingshui')),
            stream(['rāmaḥ','vanaṃ','kaviḥ','phalam'], get('san')),
        ]
        with patch.dict(os.environ, {'LYRIC_PAIR_MEMO':'0'}):
            for st in contexts:
                query = {(1,2), (1,3), (2,4)}
                for name, sch in R.REGISTRY.items():
                    full = R.line_pairs_for(sch, st)
                    got = R.line_pairs_for(sch, st, requested_pairs=query)
                    if isinstance(full, R.Refusal):
                        self.assertEqual(got, full, name)
                    else:
                        self.assertEqual(got, full & query, name)
                        self.assertEqual(got.undecided, full.undecided & query, name)
                        empty = R.line_pairs_for(sch, st, requested_pairs=[])
                        self.assertFalse(empty, name)
                        self.assertFalse(empty.undecided, name)

    def test_projection_keeps_global_members_and_quantifier_population(self):
        from unittest.mock import patch
        fixtures = [
            ('analysed rhyme', ['sun','tin','sick','suck'], True),
            ('analysed rhyme', ['sun','tin','sick','boat'], False),
            ('blues AAB stanza', ['we feed the cat','we feed the cat','a hat'], True),
            ('blues AAB stanza', ['we feed the cat','we feed the cat','the moon'], False),
            ('symploce', ['we hold qzxqzx','we warm qzxqzx','you warm cat'], None),
            ('monorhyme / leash', ['cat','hat','bat'], True),
            ('monorhyme / leash', ['cat','hat','moon'], False),
            ('monorhyme / leash', ['cat','hat','qzxqzx'], None),
        ]
        with patch.dict(os.environ, {'LYRIC_PAIR_MEMO':'0'}):
            for name, lines, expected in fixtures:
                st = stream(lines); sch = R.REGISTRY[name]
                full = R.line_pairs_for(sch, st)
                got = R.line_pairs_for(sch, st, requested_pairs=[(1,2)])
                self.assertIs(got.verdict((1,2)), expected, name)
                self.assertEqual(got, full & {(1,2)}, name)
                self.assertEqual(got.undecided, full.undecided & {(1,2)}, name)
                if not R.pair_scope_representable(sch):
                    with self.assertRaises(ValueError):
                        R.realise(sch, st, requested_line_pairs={(0,1)})

    def test_projection_does_not_cache_unasked_pairs_as_false(self):
        from unittest.mock import patch
        st = stream(['cat','hat','bat','qzxqzx'])
        sch = R.REGISTRY['perfect rhyme']
        R.pair_memo_clear()
        with patch.dict(os.environ, {'LYRIC_PAIR_MEMO':'1'}):
            with patch.object(R, 'evaluate', wraps=R.evaluate) as evaluate:
                one = R.line_pairs_for(sch, st, requested_pairs=[(2,1),(1,2)])
                self.assertTrue(evaluate.call_args_list)
                for call in evaluate.call_args_list:
                    self.assertEqual({R._span_line(call.args[1],st),
                                      R._span_line(call.args[2],st)}, {0,1})
            self.assertEqual(one, {(1,2)})
            self.assertEqual(R.pair_memo_tally()['miss'], 1)
            self.assertEqual(R.line_pairs_for(sch, st, requested_pairs=[(1,3)]), {(1,3)})
            self.assertEqual(R.pair_memo_tally()['miss'], 2)
            unknown = R.line_pairs_for(sch, st, requested_pairs=[(1,4)])
            self.assertIs(unknown.verdict((1,4)), None)
            warm = R.line_pairs_for(sch, st)
            self.assertEqual(R.pair_memo_tally()['miss'], 6)
        with patch.dict(os.environ, {'LYRIC_PAIR_MEMO':'0'}):
            cold = R.line_pairs_for(sch, st)
        self.assertEqual(warm, cold)
        self.assertEqual(warm.undecided, cold.undecided)
        for bad in ([0,1], [1,1], [1,5], [True,2], [1.,2]):
            with self.assertRaises(ValueError):
                R.line_pairs_for(sch, st, requested_pairs=[bad])

    def test_vocabulary_query_memo_does_not_cross_query_domains(self):
        lines = ['we hold the wind','we cannot find','a cat','qzxqzx']
        phon = get('eng'); R._WVP_MEMO.clear()
        kwargs = dict(sections=['a']*4, bearing={0,1,2,3})
        queries = [frozenset({(1,2)}), frozenset({(3,4)}), frozenset()]
        limited = [R.whole_vocabulary_pairs(lines, phon, requested_pairs=q, **kwargs)
                   for q in queries]
        full = R.whole_vocabulary_pairs(lines, phon, **kwargs)
        for q, got in zip(queries, limited):
            want = {p:v for p,v in full.items() if p in q}
            unknown = {p:v for p,v in full.undecided.items() if p in q}
            self.assertEqual(got, want)
            self.assertEqual(got.undecided, unknown)
            warm = R.whole_vocabulary_pairs(lines, phon, requested_pairs=q, **kwargs)
            self.assertEqual(warm, want)
            self.assertEqual(warm.undecided, unknown)
        self.assertEqual(len(R._WVP_MEMO), 4)

    def test_matrix_reuses_only_unchanged_line_reads(self):
        from quality import revise as RV
        from unittest.mock import patch
        rv = RV.Reviser()
        original = ['we hold the wind', 'we warm the cat', 'you see qzxqzx']
        changed = ['we warm the cat', 'we hold the reed', 'you see qzxqzx']
        with patch.object(RV, 'line_anchors', wraps=RV.line_anchors) as read:
            rv._matrix(original)
            got = rv._matrix(changed)
            self.assertEqual(read.call_count, 4)
        fresh = RV.Reviser(lex=rv.lex)._matrix(changed)
        self.assertEqual(got, fresh)
        self.assertEqual([r['line'] for r in got[2]], [1,2,3])
        self.assertTrue(got[2][2]['final_unreadable'])
        got[2][2]['unreadable'].append('caller mutation')
        got[0][0][0][0]['nucleus'] = 'caller mutation'
        rv._matrix_cache.clear()
        self.assertNotIn('caller mutation', rv._matrix(changed)[2][2]['unreadable'])
        self.assertNotEqual('caller mutation', rv._matrix(changed)[0][0][0][0]['nucleus'])
        for i in range(260):
            rv._matrix([f'the cat {i}'])
        self.assertLessEqual(len(rv._line_read_cache), 256)

    def test_a_renamed_figure_keeps_its_judge(self):
        # #519 finding c (2026-10-27): the whole-figure judge is the row's
        # declared `judge`, so a symploce row under another name (`replace`)
        # is judged as symploce, not refused as an unsupported shape.
        from dataclasses import replace
        renamed = replace(R.REGISTRY['symploce'], name='renamed symploce')
        good = ['we hold the cat', 'we warm the cat']
        got = R.line_pairs_for(renamed, stream(good))
        self.assertNotIsInstance(got, R.Refusal)
        self.assertIs(got.verdict((1, 2)), True)
        bad = R.line_pairs_for(renamed, stream(['we hold the cat',
                                                'we warm the moon']))
        self.assertIs(bad.verdict((1, 2)), False)
        plain = replace(renamed, judge='')
        self.assertEqual(getattr(R.line_pairs_for(plain, stream(good), keep_refusal=True),
                                 'kind', None), 'unsupported_shape')

    def test_named_figures_require_every_edge(self):
        good = ['we hold the cat', 'we warm the cat']
        self.assertIs(pair('symploce', good).verdict((1, 2)), True)
        for bad in (['we hold the cat', 'we warm the moon'],
                    ['we hold the cat', 'you warm the cat'],
                    [good[0], good[0]]):
            self.assertIs(pair('symploce', bad).verdict((1, 2)), False)
        good = ['sun', 'tin', 'sick', 'suck']
        result = pair('analysed rhyme', good)
        self.assertEqual(len(result), 6)
        self.assertFalse(pair('analysed rhyme', ['sun', 'much']))
        for i in range(4):
            self.assertFalse(pair('analysed rhyme', good[:i]+good[i+1:]))
            bad = good.copy(); bad[i] = 'boat'
            self.assertFalse(pair('analysed rhyme', bad))
        st = R.build_stream(good, get('eng'), stanzas=[0,0,1,1])
        self.assertFalse(R.line_pairs_for(R.REGISTRY['analysed rhyme'], st))
        self.assertNotIn('analysed rhyme', R.DRAWABLE_EXHIBITS)
        self.assertIsInstance(R.pair_satisfies(R.REGISTRY['analysed rhyme'],
            stream(good), (0,-1), (1,-1)), R.Refusal)
        self.assertTrue(pair('blues AAB stanza',
            ['we feed the cat', 'we feed the cat', 'she wears a hat']))

    def test_full_graph_unknown_stays_inside_its_frame(self):
        # An unreadable member can leave its own full graph unresolved; it
        # cannot create an unknown relation with an unrelated adjacent frame.
        got = pair('symploce', ['we hold qzxqzx', 'we warm qzxqzx',
                               'you hold cat', 'you warm cat'])
        self.assertIs(got.verdict((1,2)), None)
        self.assertIs(got.verdict((1,3)), False)
        self.assertIs(got.verdict((3,4)), True)
        # A failed known head cannot be rescued into uncertainty merely by
        # an unreadable end elsewhere in the declared members.
        got = pair('symploce', ['we hold qzxqzx', 'you warm qzxqzx'])
        self.assertIs(got.verdict((1,2)), False)

    def test_token_figures_judge_and_the_template_refuses_undeclared(self):
        # The three sain figures are judged over a line's own tokens and
        # answer on any stream (here: no instance, a real no); the 平仄
        # template needs a DECLARED pattern and refuses without one.
        st = stream(['cat hat bat', 'cat hat bat'])
        for name in ('cynghanedd sain', 'cynghanedd sain gadwynog',
                     'cynghanedd sain lafarog'):
            got = R.line_pairs_for(R.REGISTRY[name], st)
            self.assertNotIsInstance(got, R.Refusal)
            self.assertEqual(len(got), 0)
        self.assertIsInstance(
            R.line_pairs_for(R.REGISTRY['平仄 tonal template'], st), R.Refusal)
        self.assertIsInstance(
            R.realise(R.REGISTRY['平仄 tonal template'], st), R.Refusal)

    def test_aliases_have_identical_execution(self):
        from quality.rhyme_constraints import QUANTIFIER_ALIASES
        st = stream(['silver salmon softly sing stone'])
        for alias, canon in QUANTIFIER_ALIASES.items():
            sch = dataclasses.replace(R.REGISTRY['paroemion'], figure=R.Figure(
                quantifier=alias, k=3, fraction=.8, frame='line'))
            canonical = dataclasses.replace(sch, figure=dataclasses.replace(sch.figure,
                                            quantifier=canon))
            self.assertEqual(sch.figure.quantifier, canon)
            self.assertEqual(R.assemble(sch, R.realise(sch, st), st),
                             R.assemble(canonical, R.realise(canonical, st), st))

    def test_paroemion_counts_one_sound_and_every_token(self):
        cases = [(['silver salmon softly sing'], True),
                 (['silver salmon softly sing tree'], True),
                 (['silver salmon softly tree tall'], False),
                 (['silver salmon softly qzxqzx'], None),
                 (['silver salmon softly sing qzxqzx'], True)]
        sch = R.REGISTRY['paroemion']
        for lines, want in cases:
            st = stream(lines)
            found = R.assemble(sch, R.realise(sch, st), st)
            got = True if any(v is True for _,_,v in found) else None if found else False
            self.assertIs(got, want, (lines, found))
            st2 = stream(lines+['tall trees tower'])
            self.assertEqual(found, [x for x in R.assemble(sch, R.realise(sch, st2), st2)
                                     if x[0] == 0])
        # An intra-line figure cannot be requested as a between-line mandate.
        self.assertTrue(RT._all_same_line('paroemion'))

    def test_short_lifts_and_fourth_lift_predicate(self):
        sch = R.REGISTRY['fourth lift must not alliterate']
        for n in range(5):
            st = stream(['cat cow cap car'][:1])
            st.frames.lifts={0:tuple(range(n))}; st.frames.lift_source='declared'
            out = R.realise(sch, st, keep='all')
            self.assertFalse(isinstance(out, R.Refusal))
            self.assertEqual(any(e.verdict is True for e in out), n == 4)
        st = stream(['cat cow cap dog']); R.search_lifts(st)
        self.assertFalse(any(e.verdict is True for e in R.realise(sch, st, keep='all')))
        st = stream(['cat cow']); R.search_lifts(st)
        self.assertEqual(R.realise(sch, st), [])

    def test_undecided_survives_cold_and_warm_bridge(self):
        st = stream(['دل جان', 'گل جان'], get('fas'))
        R.mark_refrain_tail(st, lines=[0,1])
        sch = R.REGISTRY['qafiya (before the radif)']
        for _ in range(2):
            got = R.line_pairs_for(sch, st)
            self.assertIs(got.verdict((1,2)), None)
            self.assertIs(RT.satisfies_relation('schema:'+sch.name, None,
                          lines=(1,2), instances=got), None)
        self.assertIs(R.LinePairResults([(1,2)], [(1,2)]).verdict((1,2)), True)
        self.assertIs(R.LinePairResults().verdict((1,2)), False)

    def test_whole_vocabulary_keeps_unknown_through_memo(self):
        # A real default-band failure whose former consonance rescue depended
        # on the first pronunciation of history.
        import battery
        import lyric_harness as lh
        lines = battery.parse_sonnets(battery.corpus_path('sonnets.txt'))[92]
        for _ in range(2):
            got = R.whole_vocabulary_pairs(lines, get('eng'), bearing=set(range(14)))
            # REPINNED 2026-10-30 (`MISSING.md` M-323) from
            # `assertNotIn((5,7), got)`: unbound, the pair now stands in
            # `internal consonance` through two words inside the lines, and
            # in nothing else definite. The letter scheme binds the END
            # words, where neither interior schema can stand (at least one
            # member must not be line-final), so `check_scheme` below is
            # unchanged.
            self.assertEqual(sorted(got.get((5,7), ())), ['internal consonance'])
            self.assertIn('consonance', got.undecided[(5,7)])
        # The judge itself still answers None on the merged channels; a
        # grader resolves it over whole readings (standing rule 5): one
        # reading of `history` holds consonance, and the pair is neither
        # refused nor charged.
        self.assertEqual(got.resolve_readings((5,7), ['consonance'])[0],
                         {'consonance': ['history = HH IH1 S T ER0 IY0']})
        checked = lh.check_scheme(lh.Lexicon(), lines, 'ABABCDCDEFEFGG', lh.Declaration())
        self.assertFalse(any(tuple(v[:2]) == (5,7) for v in checked['violations']))
        self.assertFalse(any(tuple(v['lines']) == (5,7) for v in checked['refusals']))
        from unittest.mock import patch
        original = R.whole_vocabulary_pairs
        def full_query(*args, **kwargs):
            kwargs.pop('requested_pairs', None)
            return original(*args, **kwargs)
        with patch.object(R, 'whole_vocabulary_pairs', side_effect=full_query):
            baseline = lh.check_scheme(lh.Lexicon(), lines, 'ABABCDCDEFEFGG', lh.Declaration())
        self.assertEqual(checked, baseline)

    def test_exact_declared_endpoint(self):
        sch = R.REGISTRY['perfect rhyme']
        for line in ('cat qzxqzx', 'cat 我', 'cat sh'):
            st = stream([line, 'hat'])
            got = R.line_pairs_for(sch, st)
            self.assertIs(got.verdict((1,2)), None, line)
            self.assertIs(R.pair_satisfies(sch, st, (0,-1), (1,-1)), None, line)
            self.assertFalse(any(e.verdict is True for e in R.realise(sch,st)),line)
        self.assertIs(pair('perfect rhyme', ['qzxqzx cat', 'hat']).verdict((1,2)), True)

    def test_registered_english_keeps_homographs(self):
        phon = get('eng')
        self.assertEqual(phon.reading_status('wind')[0], MERGED)
        for _ in range(2):
            self.assertIs(pair('perfect rhyme', ['a mighty wind','what i did find']).verdict((1,2)),None)
        self.assertIs(pair('perfect rhyme',['wind','sand']).verdict((1,2)),False)
        same = ['wind','find']
        self.assertIs(pair('perfect rhyme',same).verdict((1,2)),None)
        self.assertIs(pair('perfect rhyme',same,English(readings='first')).verdict((1,2)),True)
        self.assertIs(pair('perfect rhyme',same).verdict((1,2)),None)

    def test_scalar_scheme_preserves_endpoint_and_reading_refusals(self):
        import lyric_harness as lh
        lex, decl = lh.Lexicon(), lh.Declaration()
        for lines in (['cat 我', 'hat'], ['cat sh', 'hat'],
                      ['cat qzxqzx', 'hat'], ['', 'hat']):
            for _ in range(2):
                got = lh.check_scheme(lex, lines, 'AA', decl)
                self.assertEqual(len(got['refusals']), 1, lines)
                self.assertFalse(got['violations'], lines)
                self.assertEqual(got['pairs_judged'], 0, lines)
        # A word with several readings is no longer a refusal (standing rule
        # 5): wind/find is JUDGED, and it holds, because one reading rhymes.
        got = lh.check_scheme(lex, ['a mighty wind', 'what i did find'], 'AA', decl)
        self.assertEqual((got['refusals'], got['violations'], got['pairs_judged']),
                         ([], [], 1))
        self.assertEqual(lh.raw_final_token('cat 我'), '我')
        self.assertEqual(lh.line_anchors(lex, 'cat sh')[0], [])
        control = lh.check_scheme(lex, ['qzxqzx cat', 'hat'], 'AA', decl)
        self.assertEqual(control['pairs_judged'], 1)
        self.assertFalse(control['violations'])

    def test_cli_scheme_surfaces_unknown_without_a_false_violation(self):
        import subprocess
        cli = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'lyric_harness.py')
        for lines in (['cat 我', 'hat'],):
            result = subprocess.run([sys.executable, cli, 'scheme', 'AA', *lines],
                                    capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('REFUSED', result.stdout.upper())
            self.assertNotIn('violations: 1', result.stdout)
        # Several readings are not an unknown (standing rule 5): judged, held.
        result = subprocess.run([sys.executable, cli, 'scheme', 'AA',
                                 'a mighty wind', 'what i did find'],
                                capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('mandated 1  judged 1  refused 0', result.stdout)
        self.assertNotIn('violations: 1', result.stdout)

    def test_endpoint_reading_does_not_rebind_an_earlier_homograph(self):
        import lyric_harness as lh
        lex=lh.Lexicon()
        pron=next(p for p in lex.entries['wind'] if 'IH1' in p)
        anchors,_,_=lh.line_anchors(lex,'wind the wind',endpoint_pronunciations=[pron])
        whole=max(anchors,key=len)
        self.assertEqual(whole[0]['nucleus'],'AY')
        self.assertEqual(whole[-1]['nucleus'],'IH')

    def test_chinese_tone_and_standard_native_parity(self):
        sch = R.REGISTRY['Middle Chinese end rhyme (同用 group)']
        for overlap in ('any','all','settled'):
            phon = MiddleChinese(standard='pingshui', overlap=overlap)
            for a,b in [('㐭','㓄'), ('流','樓'), ('東','同'), ('重','鐘')]:
                out = R.realise(sch, stream([a,b],phon), keep='all')
                self.assertEqual([e.verdict for e in out], [phon.rhymes(a,b)],(overlap,a,b))
        for standard in ('qieyun','cilin'):
            self.assertIsInstance(R.realise(sch,stream(['流','樓'],MiddleChinese(standard=standard))), R.Refusal)

    def test_full_population_and_report_do_not_accept_partial_edges(self):
        sch = R.REGISTRY['monorhyme / leash']
        positive = stream(['cat','hat','bat'])
        self.assertEqual(len(R.line_pairs_for(sch,positive)),3)
        negative = stream(['cat','hat','moon'])
        self.assertFalse(R.line_pairs_for(sch,negative))
        # Changing a third line invalidates a whole-frame figure even when
        # the queried pair stays byte-identical (cannot reuse pair-only memo).
        self.assertIs(R.line_pairs_for(sch,positive).verdict((1,2)),True)
        self.assertIs(R.line_pairs_for(sch,negative).verdict((1,2)),False)
        unreadable = stream(['cat','hat','qzxqzx'])
        self.assertIs(R.line_pairs_for(sch,unreadable).verdict((1,2)),None)
        for name, lines in [('symploce',['we hold the cat','we warm the moon']),
                            ('analysed rhyme',['sun','much']),
                            ('paroemion',['silver salmon softly tree tall'])]:
            report = R.relation_report(stream(lines),schemas={name:R.REGISTRY[name]})
            self.assertEqual(report['ran_and_fired'],0,(name,report))

    def test_chain_rhyme_judges_a_declared_pair_at_the_pair(self):
        # M-316 (M-311 F3). A DECLARED `schema:chain rhyme (rap)` pair was
        # answered by the REGISTRY's `forall`/song figure, which needs one
        # component spanning every line and never assembles, so a pair that
        # chains was a SCHEME_VIOLATION (crooked_waltz, group Q, stir~carpenter).
        from quality.revise import Reviser
        from quality.schemes import mandate
        sch = R.REGISTRY['chain rhyme (rap)']
        declared = R.declared_pair_schema(sch)
        self.assertEqual((sch.figure.quantifier, sch.figure.frame), ('forall', 'song'))
        self.assertFalse(R.pair_scope_representable(sch))
        self.assertTrue(R.pair_scope_representable(declared))
        self.assertEqual(dataclasses.replace(declared, figure=sch.figure), sch)
        chains = ['the kitchen light was fading fast', 'a silver ship went sailing past',
                  'go slow', 'we sat where the heater sighs']
        broken = [chains[0], chains[2], chains[1], chains[3]]
        # The premise: the whole-song assembly finds no pair anywhere here.
        self.assertFalse(R.line_pairs_for(sch, stream(chains)))
        self.assertIs(R.line_pairs_for(declared, stream(chains),
                                       requested_pairs=[(1, 2)]).verdict((1, 2)), True)
        self.assertIs(R.line_pairs_for(declared, stream(broken),
                                       requested_pairs=[(1, 2)]).verdict((1, 2)), False)
        rv = Reviser()
        for lines, violated in ((chains, False), (broken, True)):
            got = rv.grade(list(lines), mandate(
                [['1', '2']], n_lines=len(lines),
                default_relation='schema:chain rhyme (rap)'))
            self.assertFalse(got['refusals'], lines)
            self.assertEqual(bool(got['violations']), violated, lines)

    def test_chain_rhyme_rescues_nothing_under_the_default_rule(self):
        # M-316, the owner's scope: the declared-pair figure is read ONLY where
        # a mandate names chain rhyme. An UNDECLARED group (the whole-vocabulary
        # default, `battery.py`'s route) keeps the REGISTRY figure, so Sonnet
        # 105's L10/L12 words~affords stays flagged. ~~The mutation proves the
        # check live: with the declared figure in the REGISTRY, chain rhyme
        # would rescue exactly that pair.~~ Since 2026-10-02 (M-317) the swap
        # rescues nothing: the bound words keep the pair flagged either way.
        import lyric_harness as lh
        with open(os.path.join(os.path.dirname(os.path.dirname(
                os.path.abspath(__file__))), 'corpus', 'sonnets.txt'),
                encoding='utf-8') as f:
            text = [ln.strip() for ln in f.read().splitlines()]
        start = text.index('Let not my love be call’d idolatry,')
        sonnet = text[start:start + 14]
        self.assertTrue(sonnet[11].endswith('scope affords.'), sonnet[11])
        lex, decl = lh.Lexicon(), lh.Declaration()

        def flagged():
            R._WVP_MEMO.clear()
            res = lh.check_scheme(lex, sonnet, 'ABABCDCDEFEFGG', decl)
            return {(v[0], v[1]) for v in res['violations']}
        sch = R.REGISTRY['chain rhyme (rap)']
        # REPOINTED 2026-10-30 (M-322): words~affords now holds as consonance
        # (D Z) in one consistent non-rhotic accent, so L10/L12 is no longer
        # flagged by either figure. The pair still flagged under both, and so
        # the one this check can watch, is L9/L11 argument~spent.
        # superseded: assertIn((10, 12), flagged()) at all three points.
        self.assertIn((9, 11), flagged())
        R.REGISTRY['chain rhyme (rap)'] = R.declared_pair_schema(sch)
        try:
            # REPINNED 2026-10-02 (`MISSING.md` M-317, the bound words): the
            # declared figure used to rescue words~affords through spans
            # elsewhere in L10/L12. A pair now has to relate its BOUND words,
            # and the figure's instance there does not cover both end words,
            # so the pair stays flagged under either figure -- the bound rule
            # now stops this rescue on its own. MEASURED over the whole
            # battery: 40 violations with the swap and without it.
            # superseded: assertNotIn((10, 12), flagged()).
            self.assertIn((9, 11), flagged())
        finally:
            R.REGISTRY['chain rhyme (rap)'] = sch
            R._WVP_MEMO.clear()
        self.assertIn((9, 11), flagged())

    def test_scalar_pronunciation_consensus(self):
        import lyric_harness as lh
        lex, decl = lh.Lexicon(), lh.Declaration()
        judge = RT.coarse_relation_consensus
        # CLAUDE.md standing rule 5 (owner, 2026-10-01): an obligation holds
        # when ANY reading holds it (wind sung /W AY1 N D/ rhymes with find);
        # a prohibition is charged only when EVERY reading triggers it; the
        # instruments' unanimity is still reachable and still undecided here.
        self.assertIs(judge(lex,'a mighty wind','what i did find',decl),True)
        self.assertIs(judge(lex,'a mighty wind','what i did find',decl,
                            quantifier='all'),False)
        self.assertIs(judge(lex,'a mighty wind','what i did find',decl,
                            quantifier='unanimous'),None)
        self.assertIs(judge(lex,'cat','hat',decl,relation='RHYME'),True)
        self.assertIs(judge(lex,'wind','moon',decl,relation='RHYME'),False)
        self.assertIs(judge(lex,'qzxqzx','hat',decl),None)

    def test_no_candidate_pair_cap_remains(self):
        # The 2,000,000-comparison cap and the planning bound derived from it
        # are deleted (owner ruling 2026-09-28): realise() enumerates every
        # candidate pair unless a caller passes its own max_pairs.
        self.assertFalse(hasattr(R, 'MAX_CANDIDATE_PAIRS'))
        self.assertFalse(hasattr(R, 'planning_work_bound'))
        sch = R.REGISTRY['compound / phrasal rhyme']
        for n in (1, 3, 8):
            st = stream(['cat ' * 12] * n)
            self.assertIsInstance(R.realise(sch, st, keep='all'), list)

    def test_sanskrit_authoritative_line_and_boundaries(self):
        from quality import fit
        import unicodedata
        phon = get('san')
        for text in ('yam ayuṅkta', unicodedata.normalize('NFD','yam ayuṅkta')):
            a = phon.analyse_line(text)
            self.assertEqual(a.token_indices,(0,1,1,1))
            self.assertEqual(sum(s.moras for s in a.syllables),5)
            st = stream([text],phon)
            self.assertEqual([u.syl for u in st.units],list(a.syllables))
            self.assertEqual(fit.read_line(text,phon).count,5)
        paused = phon.analyse_line('yam | ayuṅkta')
        self.assertEqual(sum(s.moras for s in paused.syllables),6)
        bad = phon.analyse_line('yam XYZ ayuṅkta')
        self.assertEqual(bad.syllables,())
        self.assertEqual(bad.refused,((1,'XYZ'),))
        self.assertFalse(fit.read_line('yam XYZ ayuṅkta',phon).certain)


class FullShapeSearch(unittest.TestCase):
    """STAGE 4 FIX ROUND (2026-11-18). `_full_shape` searches for its member
    tuples instead of drawing every one, and must return what the plain
    enumeration returns: the same figures, edges and verdicts, in the same
    order. Streams are drawn by seed from dictionary words; the reference
    below restates the three line-member judges with no search and no
    early stop."""

    @staticmethod
    def _cells():
        """-> {(vowel, coda): [words]}: the dictionary's words of 3 to 5
        letters that the phonology reads as one syllable ending in a
        consonant, with nothing in the reading left open. The dictionary
        row picks the candidates; the phonology's own reading files them."""
        import collections
        import lyric_harness as LH
        eng, cells = get('eng'), collections.defaultdict(list)
        with open(LH.CMUDICT_PATH, encoding='utf-8') as fh:
            for ln in fh:
                w, *ph = ln.split('#')[0].split() or ['']
                if not (w.isalpha() and 3 <= len(w) <= 5 and ph
                        and sum(x[-1].isdigit() for x in ph) == 1
                        and not ph[-1][-1].isdigit()):
                    continue
                sy = eng.syllabify(w)
                if len(sy) == 1 and sy[0].coda and not any(
                        R.uncertain(x) for x in (sy[0].onset, sy[0].nucleus,
                                                 sy[0].coda, sy[0].prominence)):
                    cells[(sy[0].nucleus, tuple(sy[0].coda))].append(w)
        return cells

    @staticmethod
    def _grid(rng, cells, nv, nc):
        """-> (vowels, codas) drawn by seed with two or more words in every
        vowel x coda cell."""
        vowels = sorted({v for v, _ in cells})
        codas = sorted({c for _, c in cells})
        while True:
            vs, cs = rng.sample(vowels, nv), rng.sample(codas, nc)
            if all(len(cells.get((v, c), ())) >= 2 for v in vs for c in cs):
                return vs, cs

    def _streams(self):
        """-> [(kind, lines, stanzas)] by seed, in four kinds. No line is
        composed: each is zero to two head words and one end word, all
        drawn from the dictionary, or an earlier line again.

        'mixed': end words from a vowel x coda grid, so crossed pairs,
        full rhymes and misses all occur; a share of lines repeat an
        earlier line; a share end in a generated token no dictionary
        holds, so an edge reads None.
        'late crossed': three lines whose two bound edges hold, a fourth
        that breaks an edge only as the last-bound member, a fourth that
        closes the figure, and a line that ends unread, after other grid
        lines.
        'late repeat': one line twice, then lines that do not rhyme it,
        then a line that ends unread.
        'pairs': printed pairs of lines that share a first and a last word
        around a different middle word, among pairs that share nothing."""
        import random
        cells = self._cells()
        rng = random.Random('stage4-fix-full-shape-search')
        every = sorted(w for ws in cells.values() for w in ws)
        out = []

        def stanzas(n):
            k = rng.randint(1, min(3, n))
            cuts = sorted(rng.sample(range(1, n), k - 1))
            return [sum(1 for c in cuts if i >= c) for i in range(n)]

        def unread():
            # Consonants only: no dictionary word, so the stream gives it
            # no syllables and an edge that ends on it reads None.
            return ''.join(rng.choice('bcdfghjklmnpqrstvwxz') for _ in range(7))

        for n in (4, 5, 7, 9, 12, 16, 20, 24) * 3:
            vs, cs = self._grid(rng, cells, rng.randint(2, 3), rng.randint(2, 3))
            heads = rng.sample(every, 3)
            again, lost = rng.choice((0.1, 0.3, 0.5)), rng.choice((0.0, 0.1))
            lines = []
            for _ in range(n):
                if lines and rng.random() < again:
                    lines.append(rng.choice(lines))
                    continue
                end = (unread() if rng.random() < lost else
                       rng.choice(cells[(rng.choice(vs), rng.choice(cs))]))
                lines.append(' '.join(rng.choices(heads, k=rng.randint(0, 2))
                                      + [end]))
            out.append(('mixed', lines, stanzas(n)))
        for n in (6, 7, 9, 12):
            (v1, v2, v3), (c1, c2) = self._grid(rng, cells, 3, 2)
            five = [rng.choice(cells[cell]) for cell in
                    ((v1, c1), (v2, c1), (v2, c2), (v3, c2), (v1, c2))]
            rest = [rng.choice(cells[(rng.choice((v1, v2, v3)),
                                      rng.choice((c1, c2)))])
                    for _ in range(n - 6)]
            out.append(('late crossed', rest + five + [unread()], [0] * n))
        for n in (4, 6, 9):
            (v1, v2), (c1, c2) = self._grid(rng, cells, 2, 2)
            twice = rng.choice(cells[(v1, c1)])
            rest = [rng.choice(cells[(v2, c2)]) for _ in range(n - 3)]
            out.append(('late repeat', [twice, twice] + rest + [unread()],
                        [0] * n))
        for n in (4, 8, 12):
            lines = []
            for _ in range(n // 2):
                first, last, mid_a, mid_b, x, y, z = rng.sample(every, 7)
                lines += ([f'{first} {mid_a} {last}', f'{first} {mid_b} {last}']
                          if rng.random() < 0.6 else
                          [f'{first} {mid_a} {last}', f'{x} {y} {z}'])
            out.append(('pairs', lines, stanzas(n)))
        return out

    @staticmethod
    def _reference(schema, st):
        """The figures by plain enumeration -> ([(frame, members, edges,
        verdict)], late). Every member tuple of every frame, in
        `itertools.combinations` order; every edge of the judge is asked,
        with no early stop and no search; a tuple with a False edge is left
        out. `late` counts the tuples left out only by an edge on their
        last-bound member."""
        import itertools
        fig = schema.figure
        frames = {}
        for li in range(len(st.lines)):
            if st.lines[li] or st.lexical_tokens[li]:
                frames.setdefault(st.line_stanzas[li] if fig.frame == 'stanza'
                                  else li // 2, []).append(li)
        asked = {}

        def ask(base, la, lb, ta=-1, tb=-1):
            # -> ('missing', None) or ('judged', Instance): one pair of
            # lines under one edge schema, at the named word of each.
            key = (base.name, base.spans, la, lb, ta, tb)
            if key not in asked:
                spans = []
                for li, ti, rule in ((la, ta, base.spans[0]),
                                     (lb, tb, base.spans[-1])):
                    ti = len(st.lexical_tokens[li]) + ti if ti < 0 else ti
                    ids = st.tokens.get((li, ti), ())
                    try:
                        got = (list(R._spans_at(rule, st, ids, f"L{li}.T{ti}"))
                               if ids else [])
                    except R.NoReferent:
                        got = []
                    if not got:
                        break
                    spans.append(got[0])
                asked[key] = (('judged', R.evaluate(dataclasses.replace(
                    base, placement=(), figure=R.PAIR), *spans, st))
                    if len(spans) == 2 else ('missing', None))
            return asked[key]

        out, late = [], 0
        n = 2 if schema.judge == 'symploce' else fig.nodes
        for frame, ls in frames.items():
            for members in itertools.combinations(ls, n):
                if schema.judge == 'symploce':
                    wa, wb = (st.lexical_tokens[m] for m in members)
                    ep = dataclasses.replace(R.REGISTRY['anaphora'],
                                             spans=(R.END_WORD, R.END_WORD))
                    plan = [('value', len(wa) > 2 and len(wb) > 2 and
                             [w.lower() for w in wa[1:-1]] !=
                             [w.lower() for w in wb[1:-1]], 1),
                            ('edge', (R.REGISTRY['anaphora'], 0, 1, 0, 0), 1),
                            ('edge', (ep, 0, 1), 1)]
                elif schema.judge == 'crossed':
                    plan = [('edge', (R.crossed_edge(label), ai, bi),
                             max(ai, bi)) for ai, bi, label in fig.edges]
                else:
                    a, b, _ = members
                    pr = R.REGISTRY['perfect rhyme']
                    plan = [('value', st.text_lines[a].strip().casefold() ==
                             st.text_lines[b].strip().casefold(), 1),
                            ('edge', (pr, 0, 2), 2), ('edge', (pr, 1, 2), 2)]
                edges, values, false_at = [], [], []
                for what, arg, bound in plan:
                    if what == 'value':
                        values.append(arg)
                    else:
                        base, ai, bi, *tok = arg
                        state, e = ask(base, members[ai], members[bi], *tok)
                        if state == 'judged':
                            edges.append(e)
                        values.append(e.verdict if state == 'judged' else None)
                    if values[-1] is False:
                        false_at.append(bound)
                if false_at:
                    late += min(false_at) == n - 1
                    continue
                out.append((frame, tuple(m + 1 for m in members), edges,
                            R.tri_and(values)))
        return out, late

    def test_the_search_returns_what_enumeration_returns(self):
        import collections
        names = {'crossed': 'analysed rhyme', 'aab': 'blues AAB stanza',
                 'symploce': 'symploce'}
        self.assertEqual({R.REGISTRY[n].judge for n in names.values()},
                         set(R.LINE_MEMBER_JUDGES))
        figures, late, open_ = (collections.Counter() for _ in range(3))
        kinds = collections.Counter()
        for kind, lines, stanzas in self._streams():
            st = R.build_stream(lines, get('eng'), stanzas=stanzas,
                                stanza_source='test declaration')
            kinds[kind] += 1
            for judge, name in names.items():
                schema = R.REGISTRY[name]
                want, n_late = self._reference(schema, st)
                got = R._full_shape(schema, st)
                with self.subTest(kind=kind, judge=judge, lines=lines,
                                  stanzas=stanzas):
                    self.assertEqual(
                        [(f, e.members, list(e), v) for f, e, v in got], want)
                figures[judge] += len(want)
                open_[judge] += sum(1 for *_, v in want if v is None)
                late[(kind, judge)] += n_late
        # The draw itself: every judge finds figures, undecided ones among
        # them where the search prunes, and tuples that fall only at their
        # last-bound member occur in the kind built for it.
        self.assertEqual(set(kinds), {'mixed', 'late crossed', 'late repeat',
                                      'pairs'})
        self.assertTrue(all(figures[j] > open_[j] for j in names),
                        (figures, open_))
        self.assertTrue(open_['crossed'] and open_['aab'], open_)
        self.assertTrue(late[('late crossed', 'crossed')], late)
        self.assertTrue(late[('late repeat', 'aab')], late)


if __name__=='__main__':
    unittest.main()

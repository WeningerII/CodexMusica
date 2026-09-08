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
        self.assertNotIn('analysed rhyme', R.DRAWABLE_SCHEMAS)
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

    def test_graph_and_template_without_bindings_refuse(self):
        for name in ('cynghanedd sain', 'cynghanedd sain gadwynog',
                     'cynghanedd sain lafarog', '平仄 tonal template'):
            st = stream(['cat hat bat', 'cat hat bat'])
            self.assertIsInstance(R.line_pairs_for(R.REGISTRY[name], st), R.Refusal)
            self.assertIsInstance(R.realise(R.REGISTRY[name], st), R.Refusal)

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
            self.assertNotIn((5,7), got)
            self.assertIn('consonance', got.undecided[(5,7)])
        checked = lh.check_scheme(lh.Lexicon(), lines, 'ABABCDCDEFEFGG', lh.Declaration())
        self.assertFalse(any(tuple(v[:2]) == (5,7) for v in checked['violations']))
        self.assertTrue(any(tuple(v['lines']) == (5,7) for v in checked['refusals']))
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
                      ['cat qzxqzx', 'hat'], ['', 'hat'],
                      ['a mighty wind', 'what i did find']):
            for _ in range(2):
                got = lh.check_scheme(lex, lines, 'AA', decl)
                self.assertEqual(len(got['refusals']), 1, lines)
                self.assertFalse(got['violations'], lines)
                self.assertEqual(got['pairs_judged'], 0, lines)
        self.assertEqual(lh.raw_final_token('cat 我'), '我')
        self.assertEqual(lh.line_anchors(lex, 'cat sh')[0], [])
        control = lh.check_scheme(lex, ['qzxqzx cat', 'hat'], 'AA', decl)
        self.assertEqual(control['pairs_judged'], 1)
        self.assertFalse(control['violations'])

    def test_cli_scheme_surfaces_unknown_without_a_false_violation(self):
        import subprocess
        cli = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'lyric_harness.py')
        for lines in (['cat 我', 'hat'], ['a mighty wind', 'what i did find']):
            result = subprocess.run([sys.executable, cli, 'scheme', 'AA', *lines],
                                    capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('REFUSED', result.stdout.upper())
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

    def test_scalar_pronunciation_consensus(self):
        import lyric_harness as lh
        lex, decl = lh.Lexicon(), lh.Declaration()
        judge = RT.coarse_relation_consensus
        self.assertIs(judge(lex,'a mighty wind','what i did find',decl),None)
        self.assertIs(judge(lex,'cat','hat',decl,relation='RHYME'),True)
        self.assertIs(judge(lex,'wind','moon',decl,relation='RHYME'),False)
        self.assertIs(judge(lex,'qzxqzx','hat',decl),None)

    def test_planning_resource_bound_precedes_text(self):
        self.assertTrue(R.planning_work_bound(31,12)['within_budget'])
        self.assertFalse(R.planning_work_bound(32,12)['within_budget'])
        self.assertEqual(R.planning_work_bound(32,12)['max_pairs'],R.MAX_CANDIDATE_PAIRS)
        for n in (1,3,8):
            st = stream(['cat '*12]*n)
            bounds = {x['schema']:x['upper_bound'] for x in R.planning_work_bound(n,12)['schemas']}
            sch = R.REGISTRY['compound / phrasal rhyme']
            actual = R.realise(sch,st,keep='all')
            self.assertLessEqual(len(actual),bounds[sch.name])

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


if __name__=='__main__':
    unittest.main()

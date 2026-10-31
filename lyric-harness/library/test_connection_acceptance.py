"""Connection-view prerequisites at the existing Library evidence boundary.

Small authored fixtures only; no UI, writer-route substitute, or corpus run.
These regressions protect identity, native binding and durable replay. They do
not certify the proposed domain/search manifest, which needs its own producer
tests once implemented. Run from lyric-harness:
    python3 -m unittest library.test_connection_acceptance -v
"""
import copy
import json
import unittest
from unittest.mock import patch

from library.analysis import AnalysisSession, run_step
from library.contracts import canonical_json, method_id
from library.test_analysis import complete, source


class ConnectionAcceptance(unittest.TestCase):
    def assert_references(self, records):
        tokens = {r["token_id"]: r for r in records if r["kind"] == "token"}
        units = {r["unit_id"]: r for r in records if r["kind"] == "syllable"}
        self.assertEqual(len(tokens), sum(r["kind"] == "token" for r in records))
        for edge in (r for r in records if r["kind"] == "relation_instance"):
            for role in ("a", "b"):
                member = edge[role]
                self.assertTrue(member["token_ids"])
                for token_id in member["token_ids"]:
                    self.assertIn(token_id, tokens)
                    self.assertIn(tokens[token_id]["line_id"], member["line_ids"])
                for unit_id in member["unit_ids"]:
                    self.assertIn(unit_id, units)
                    self.assertIn(units[unit_id]["token_id"], member["token_ids"])

    def test_duplicate_spellings_bind_to_separate_source_occurrences(self):
        text = "cat cat bat\ncat bat cat"
        _, records, _ = complete(source(text), schemas=["internal rhyme"])
        cats = [r for r in records if r["kind"] == "token" and r["text"] == "cat"]
        self.assertEqual(len(cats), 4)
        self.assertEqual(len({r["token_id"] for r in cats}), 4)
        self.assertEqual({tuple(r["normalized_range"]["codepoint_range"]) for r in cats},
                         {(0, 3), (4, 7), (12, 15), (20, 23)})
        # Two identically spelled words on the same line each bind to bat.
        bindings = {(tuple(r["a"]["token_ids"]), tuple(r["b"]["token_ids"]))
                    for r in records if r["kind"] == "relation_instance"}
        self.assertIn((("line:0:token:0",), ("line:0:token:2",)), bindings)
        self.assertIn((("line:0:token:1",), ("line:0:token:2",)), bindings)
        self.assert_references(records)

    def test_function_words_participate_without_cross_line_alliteration(self):
        _, records, _ = complete(source("we will\nwe will"), schemas=["alliteration"])
        edges = [r for r in records if r["kind"] == "relation_instance"]
        self.assertEqual(len(edges), 2)
        self.assertEqual({(tuple(r["a"]["token_ids"]), tuple(r["b"]["token_ids"]))
                          for r in edges}, {
            (("line:0:token:0",), ("line:0:token:1",)),
            (("line:1:token:0",), ("line:1:token:1",)),
        })
        for edge in edges:
            self.assertEqual(edge["verdict"], "true")
            self.assertEqual(edge["a"]["line_ids"], edge["b"]["line_ids"])
        self.assert_references(records)

    def test_cross_rhyme_keeps_final_to_interior_role_order(self):
        _, records, _ = complete(source("cat cat bat\ncat bat cat"), schemas=["cross rhyme"])
        edges = [r for r in records if r["kind"] == "relation_instance" and r["verdict"] == "true"]
        self.assertTrue(edges)
        for edge in edges:
            self.assertEqual(edge["a"]["token_ids"], ["line:0:token:2"])
            self.assertEqual(edge["b"]["token_ids"], ["line:1:token:0"])
            self.assertEqual(edge["a"]["origin"], "L0.final")
            self.assertEqual(edge["b"]["origin"], "L1.T0")
            self.assertIn(["a_line_final", True], edge["placement_reads"])
        self.assert_references(records)

    def test_phrasal_members_remain_ordered_spans_not_token_pair_cliques(self):
        text = "cat bat\nhat mat"
        _, records, _ = complete(source(text), schemas=["compound / phrasal rhyme"])
        edges = [r for r in records if r["kind"] == "relation_instance"]
        self.assertEqual(len(edges), 1)
        edge = edges[0]
        self.assertEqual(edge["verdict"], "true")
        self.assertEqual(edge["a"]["token_ids"], ["line:0:token:0", "line:0:token:1"])
        self.assertEqual(edge["b"]["token_ids"], ["line:1:token:0", "line:1:token:1"])
        for role, words in (("a", ["cat", "bat"]), ("b", ["hat", "mat"])):
            ranges = edge[role]["normalized_ranges"]
            self.assertEqual([text[r["codepoint_range"][0]:r["codepoint_range"][1]] for r in ranges], words)
        self.assert_references(records)

    def test_semantic_changes_reject_checkpoint_even_when_tokens_look_identical(self):
        reading = source("cat\nhat")
        request = {"layers": ["sound"], "schemas": ["perfect rhyme"]}
        session = AnalysisSession(reading, requested=request)
        checkpoint = session.step(1)["checkpoint"]
        cases = []
        for field, value in (("reading_revision", "fixture-v2"),
                             ("reading_unit_id", "another-reading"),
                             ("source_sha256", "a" * 64),
                             ("source_map", {"edition": "another-source-map"})):
            changed = {**reading, field: value}
            cases.append((field, changed, request, None))
        cases.append(("requested methods", reading,
                      {"layers": ["sound"], "schemas": ["alliteration"]}, None))
        cases.append(("declared frame", reading, request,
                      {"sound": {"caesura": {"positions": {}, "source": "authored fixture"}}}))
        for label, changed, requested, declaration in cases:
            with self.subTest(change=label):
                with self.assertRaisesRegex(ValueError, "STALE_READING"):
                    AnalysisSession(changed, declaration, requested, checkpoint)
        # The exact question remains resumable; a stale-link check must bind
        # to semantic identity, not merely to line:N:token:M strings.
        resumed = AnalysisSession(reading, requested=request, checkpoint=checkpoint)
        self.assertEqual(resumed.identity["hash"], session.identity["hash"])

    def test_public_step_replays_serialized_commits_without_losing_bindings(self):
        reading = source("we will\ncat cat bat\ncat bat cat")
        schemas = ["alliteration", "internal rhyme", "cross rhyme"]
        _, expected, full = complete(reading, schemas=schemas)
        request = {"layers": ["sound"], "schemas": schemas}
        committed, checkpoint = [], None
        partial_seen = False
        for _ in range(300):
            result = run_step(reading, requested=request, checkpoint=checkpoint,
                              budget_candidates=1, max_bytes=65536,
                              load_records=lambda mid: (r for r in committed if r.get("method_id") == mid))
            self.assertEqual(result["provider_calls"], 0)
            self.assertLessEqual(sum(len(canonical_json(r).encode()) for r in result["records"]), 65536)
            committed.extend(json.loads(json.dumps(result["records"])))
            checkpoint = json.loads(json.dumps(result["checkpoint"]))
            self.assertEqual(checkpoint["sequence"], len(committed))
            if result["done"]:
                break
            partial_seen = True
            self.assertTrue(result["summary"]["coverage"]["partial"])
            self.assertFalse(result["summary"]["coverage"]["certified"])
        else:
            self.fail("small authored fixture did not finish in 300 batches")
        self.assertTrue(partial_seen)
        self.assertEqual(canonical_json(committed), canonical_json(expected))
        self.assertEqual(result["summary"], full["summary"])
        self.assertEqual(len(committed), len({r["id"] for r in committed}))
        self.assert_references(committed)

    def test_uncommitted_step_can_be_replayed_from_last_durable_checkpoint(self):
        reading = source("we will\ncat cold")
        request = {"layers": ["sound"], "schemas": ["alliteration"]}
        first = run_step(reading, requested=request, budget_candidates=1)
        durable = copy.deepcopy(first["checkpoint"])
        def next_step():
            return run_step(reading, requested=request, checkpoint=copy.deepcopy(durable),
                            budget_candidates=1,
                            load_records=lambda mid: (r for r in first["records"] if r.get("method_id") == mid))
        lost, retried = next_step(), next_step()
        self.assertTrue(lost["records"])
        self.assertEqual(canonical_json(lost), canonical_json(retried))
        self.assertEqual(durable, first["checkpoint"])

    def test_refused_method_does_not_become_a_false_pair_result(self):
        name = "cynghanedd groes"
        _, rows, result = complete(source("cat bat\nhat mat"), schemas=[name])
        method_rows = [r for r in rows if r.get("method_id") == method_id("schema", name)]
        terminal = next(r for r in method_rows if r["kind"] == "method_result")
        self.assertEqual(terminal["coverage"], "refused")
        self.assertEqual(terminal["verdict"], "undecided")
        self.assertIn("caesura", terminal["refusal"]["missing"])
        self.assertFalse(any(r.get("verdict") == "false" for r in method_rows))
        self.assertTrue(result["done"])
        self.assertFalse(result["summary"]["coverage"]["certified"])
        self.assertIn(method_id("schema", name), result["summary"]["coverage"]["refused_obligations"])


class ConnectionContractIntegration(unittest.TestCase):
    """Independent producer-boundary checks, pinned initially to PR641.

    Failing assertions are acceptance blockers, not expected failures. These
    tests do not implement the view's verdict resolver or a new engine route.
    """

    def test_equal_length_readings_with_different_anchors_are_discovered(self):
        from library.test_analysis import _with_words, _edge
        words = {"zanchor": [["Z", "IY1", "T", "AH0"], ["Z", "IY0", "T", "AH1"]],
                 "banchor": [["B", "IY1", "T", "AH0"]]}
        reading = source("zanchor\nbanchor\ncat\nhat")
        declaration = {"pronunciations": [{"line": "zanchor", "token": 1,
            "word": "zanchor", "phones": words["zanchor"][0],
            "basis": "dictionary", "source": "authored fixture"}]}
        with _with_words(words):
            session, rows, _ = complete(reading, schemas=["perfect rhyme"])
            _, pinned, _ = complete(reading, declarations=declaration, schemas=["perfect rhyme"])
        self.assertIn((0, 0), session._merged)
        self.assertNotIn((0, 0), session._disputed)
        self.assertEqual(_edge(pinned, (0, 0), (1, 0))["verdict"], "true",
                         "positive control: one complete compatible reading holds")
        self.assertEqual(_edge(rows, (2, 0), (3, 0))["verdict"], "true")
        edge = _edge(rows, (0, 0), (1, 0))
        self.assertIsNotNone(edge, "merged anchor disagreement must not silently remove an eligible pair")
        self.assertEqual(edge["verdict"], "true")
        self.assertEqual(edge["quantifier"], "exists_compatible_reading")

    def test_equal_span_rules_do_not_certify_role_sensitive_methods_as_unordered(self):
        from library.test_analysis import _with_words
        words = {"zopen": [["Z", "IY1"]], "bclosed": [["B", "IY1", "D"]]}
        fixtures = [("additive rhyme", "zopen\nbclosed"),
                    ("subtractive rhyme", "bclosed\nzopen"),
                    ("semirhyme", "grow\ngrowing")]
        with _with_words(words):
            for name, text in fixtures:
                with self.subTest(method=name):
                    session, rows, _ = complete(source(text), schemas=[name])
                    schema = session.RL.REGISTRY[name]
                    self.assertEqual(schema.spans[0], schema.spans[1])
                    a, b = list(session.RL.enumerate_spans(schema.spans[0], session.stream))[:2]
                    self.assertIs(session.RL.evaluate(schema, a, b, session.stream).verdict, True)
                    self.assertIs(session.RL.evaluate(schema, b, a, session.stream).verdict, False)
                    domain = next(r["domain"] for r in rows if r["kind"] == "method_result")
                    if domain["projection"] == "none":
                        self.assertTrue(domain["reason"])
                    else:
                        self.assertEqual(domain["ordering"], "role_ordered",
                                         "identical span rules do not make directional predicates symmetric")

    def test_first_witness_does_not_claim_unexamined_readings_are_exhausted(self):
        from library.test_analysis import _with_words, _edge
        words = {"zee": [["Z", "IY1"], ["Z", "AH0"]]}
        with _with_words(words):
            session, rows, _ = complete(source("zee is home\nand bee is too"), schemas=["internal rhyme"])
            combos, complete_population = session.RL.reading_combos(session.stream, {(0, 0)}, 64)
            edge = _edge(rows, (0, 0), (1, 1))
        self.assertTrue(complete_population)
        self.assertEqual(len(combos), 2)
        self.assertEqual(edge["verdict"], "true")
        self.assertEqual(edge["quantifier"], "exists_compatible_reading")
        self.assertEqual(edge["reading"]["witness"], ["zee = Z IY1"])
        self.assertEqual(edge["reading_search"]["combinations_examined"], 1)
        self.assertEqual(edge["reading_search"]["state"], "partial",
                         "a complete candidate population is not a completed search")

    def test_exact_domain_cannot_exclude_a_discovered_alternate_reading_edge(self):
        from library.test_analysis import _with_words, _domain_cells, _edge
        words = {"zub": [["Z", "AH1", "B"], ["Z", "IY1", "B", "AH0"]]}
        with _with_words(words):
            _, rows, _ = complete(source("bee zub\ncat rabbit"), schemas=["cynghanedd lusg"])
        edge = _edge(rows, (0, 0), (0, 1))
        self.assertIsNotNone(edge, "positive control: the alternate penult must be discovered")
        self.assertEqual(edge["verdict"], "true")
        self.assertEqual(edge["reading"]["witness"], ["zub = Z IY1 B AH0"])
        result = next(r for r in rows if r["kind"] == "method_result")
        domain = result["domain"]
        if domain["projection"] == "none":
            self.assertTrue(domain["reason"], "withholding an inexact domain is safe if explicit")
            return
        self.assertEqual(domain["ordering"], "role_ordered")
        self.assertIn(("line:0:token:0", "line:0:token:1"), _domain_cells(domain),
                      "outside-domain cannot mean outside method locus when this reading holds")

    def test_compared_penult_uses_witness_syllable_and_keeps_source_occurrence(self):
        from library.test_analysis import _with_words, _edge
        from library.contracts import json_safe
        words = {"zub": [["Z", "AH1", "B"], ["Z", "IY1", "B", "AH0"]]}
        with _with_words(words):
            session, rows, _ = complete(source("bee zub\ncat rabbit"), schemas=["cynghanedd lusg"])
        edge = _edge(rows, (0, 0), (0, 1))
        self.assertEqual(edge["a"]["token_ids"], ["line:0:token:0"])
        self.assertEqual(edge["b"]["token_ids"], ["line:0:token:1"])
        self.assertEqual(edge["b"]["anchor_position"], 0)
        self.assertEqual(edge["b"]["direction"], 1)
        # The work's one-syllable reading and the judged penult differ. Use
        # the backend's pinned stream, never a client phone/syllable parser.
        combos, _ = session.RL.reading_combos(session.stream, {(0, 1)}, 64)
        pinned = [session._line_stream([0], c) for c in combos]
        witness = next(st for st in pinned if session._witness(st, {(0, 1)}) == edge["reading"]["witness"])
        rule = session.RL.REGISTRY["cynghanedd lusg"].spans[1]
        span = next(s for s in session.RL.enumerate_spans(rule, witness)
                    if session._span(s, witness)["token_ids"] == edge["b"]["token_ids"])
        self.assertEqual(edge["compared"]["b"], [json_safe(witness.units[i].syl) for i in span.idx])
        own = [r["syllable"] for r in rows if r["kind"] == "syllable" and r["token_id"] == "line:0:token:1"]
        self.assertNotEqual(edge["compared"]["b"], own)
        self.assertEqual(edge["compared"]["b"][0]["nucleus"], "IY")

    def test_cap_unknown_and_refusal_remain_distinct_from_sparse_false(self):
        from library.test_analysis import _with_words, _edge, _domain_cells
        words = {"zeed": [["Z", "IY1", "D"], ["Z", "UW1", "T"]]}
        reading = source("zeed is home\nand beet is too")
        with _with_words(words):
            with patch.object(AnalysisSession, "EDGE_COMBOS", 1):
                _, capped, _ = complete(reading, schemas=["internal rhyme"])
            with patch.object(AnalysisSession, "_line_stream", return_value=None):
                _, unavailable, _ = complete(reading, schemas=["internal rhyme"])
            _, exhausted, _ = complete(reading, schemas=["internal rhyme"])
        for rows, reason in ((capped, "combination_cap"), (unavailable, "rebuild_unavailable")):
            edge = _edge(rows, (0, 0), (1, 1))
            self.assertEqual(edge["verdict"], "undecided")
            self.assertEqual(edge["undecided_reason"], reason)
            result = next(r for r in rows if r["kind"] == "method_result")
            self.assertEqual(result["coverage"], "answered")
            self.assertIn(("line:0:token:0", "line:1:token:1"), _domain_cells(result["domain"]))
        self.assertEqual(_edge(capped, (0, 0), (1, 1))["reading_search"]["state"], "partial")
        # Neither whole reading has both IY and T. A union of per-channel
        # successes would fabricate a hold. Absence is usable only with the
        # terminal answered result and its exact domain, never alone.
        self.assertIsNone(_edge(exhausted, (0, 0), (1, 1)))
        result = next(r for r in exhausted if r["kind"] == "method_result")
        self.assertEqual(result["coverage"], "answered")
        self.assertIn(("line:0:token:0", "line:1:token:1"), _domain_cells(result["domain"]))
        _, refused, _ = complete(reading, schemas=["cynghanedd groes"])
        result = next(r for r in refused if r["kind"] == "method_result")
        self.assertEqual(result["coverage"], "refused")
        self.assertEqual(result["domain"], {"projection": "none", "reason": "refused"})

    def test_interruption_and_domain_cap_never_supply_negative_cell_authority(self):
        reading = source("we will\ncat cold")
        request = {"layers": ["sound"], "schemas": ["alliteration"]}
        result = run_step(reading, requested=request, budget_candidates=1)
        self.assertFalse(result["done"])
        self.assertTrue(result["summary"]["coverage"]["partial"])
        self.assertFalse(any(r["kind"] == "method_result" for r in result["records"]))
        # A worker cancelled at this durable checkpoint has no completed
        # method/domain to justify filling absent records with False.
        checkpoint = json.loads(json.dumps(result["checkpoint"]))
        self.assertFalse(checkpoint["done"])
        with patch.object(AnalysisSession, "DOMAIN_CAP", 1):
            _, rows, finished = complete(reading, schemas=["alliteration"])
        self.assertTrue(finished["done"])
        terminal = next(r for r in rows if r["kind"] == "method_result")
        self.assertEqual(terminal["coverage"], "answered")
        self.assertEqual(terminal["domain"], {"projection": "none", "reason": "domain_cap", "cap": 1})


if __name__ == "__main__":
    unittest.main()


class SharedSoundAcceptance(unittest.TestCase):
    def sound(self, words, text, keys):
        from library.test_analysis import _sound, _with_words
        with _with_words(words):
            return _sound(source(text), keys)

    def edge(self, rows, key, a=(0, 0), b=(0, 1)):
        from library.test_analysis import _edge, _sound_edges
        return _edge(_sound_edges(rows, key), a, b)

    def test_namespace_and_repeated_occurrence_identity(self):
        from library.registry import build_registry
        _, rows, _ = self.sound({}, 'cat cat', ['vowel', 'coda', 'onset', 'stressed_onset'])
        registry = build_registry()['methods']
        for key in ('vowel', 'coda', 'onset', 'stressed_onset'):
            e = self.edge(rows, key)
            self.assertEqual(e['namespace'], 'shared_sound')
            self.assertEqual(e['method_id'], method_id('shared_sound', key+'@v1'))
            self.assertNotEqual(e['method_id'], method_id('sound', key+'@v1'))
            self.assertTrue(e['same_spelling'])
            self.assertEqual(e['a']['token_ids'], ['line:0:token:0'])
            self.assertEqual(e['b']['token_ids'], ['line:0:token:1'])
            self.assertEqual(e['layer'], 'Shared sound (not a registered figure)')
            self.assertEqual(sum(m['id']==e['method_id'] for m in registry), 1)

    def test_alternate_shape_can_turn_false_into_true(self):
        words={'zshape':[['Z','AY1','ER0'],['Z','AY1','R']]}
        _, rows, _ = self.sound(words, 'zshape bar', ['coda'])
        e=self.edge(rows,'coda')
        self.assertEqual(e['verdict'],'true')
        self.assertEqual(e['compared']['a'][0]['coda'],['R'])
        self.assertIn('zshape = Z AY1 R',e['reading']['witness'])

    def test_alternate_stress_anchor_hold_is_discovered(self):
        words={'zanchor':[['Z','IY1','T','AH0'],['Z','IY0','T','AH1']],
               'banchor':[['B','IY1','T','AH0']], 'zpartner':[['Z','IY1','T','AH0']]}
        for key,partner in [('vowel','banchor'),('stressed_onset','zpartner')]:
            with self.subTest(method=key):
                pinned={**words,'zanchor':[words['zanchor'][0]]}
                _, control, _=self.sound(pinned,'zanchor '+partner,[key])
                self.assertEqual(self.edge(control,key)['verdict'],'true')
                _, rows, _=self.sound(words,'zanchor '+partner,[key])
                e=self.edge(rows,key)
                self.assertIsNotNone(e,'a compatible whole reading has a valid anchor and holds')
                self.assertEqual(e['verdict'],'true')
        # Word-start is a different family; stress disagreement need not remove it.
        _, rows, _=self.sound(words,'zanchor zpartner',['onset'])
        self.assertEqual(self.edge(rows,'onset')['verdict'],'true')

    def test_each_channel_witness_is_one_complete_reading(self):
        from library.test_analysis import _with_words, _edge
        words={'zsplit':[['Z','IY1','D'],['Z','UW1','T']]}
        _, rows, _=self.sound(words,'zsplit beet',['vowel','coda'])
        vowel,coda=self.edge(rows,'vowel'),self.edge(rows,'coda')
        self.assertEqual(vowel['compared']['a'][0]['nucleus'],'IY')
        self.assertEqual(vowel['compared']['a'][0]['coda'],['D'])
        self.assertEqual(coda['compared']['a'][0]['nucleus'],'UW')
        self.assertEqual(coda['compared']['a'][0]['coda'],['T'])
        self.assertNotEqual(vowel['reading']['witness'],coda['reading']['witness'])
        with _with_words(words):
            _, schema, _=complete(source('zsplit beet'),schemas=['internal rhyme'])
        self.assertIsNone(_edge(schema,(0,0),(0,1)))

    def test_zero_and_capped_combinations_keep_explicit_unknown_records(self):
        from library.test_analysis import RL
        words={'zshape':[['Z','AY1','ER0'],['Z','AY1','R']]}
        for label, target, replacement, reason, state in [
            ('zero',RL,'reading_combos','no_reading_combination','unavailable'),
            ('cap',AnalysisSession,'EDGE_COMBOS','combination_cap','partial')]:
            with self.subTest(case=label):
                value=(lambda *args:([],True)) if label=='zero' else 1
                with patch.object(target,replacement,value):
                    _, rows, _=self.sound(words,'zshape bar',['coda'])
                e=self.edge(rows,'coda')
                self.assertEqual(e['verdict'],'undecided')
                self.assertEqual(e['undecided_reason'],reason)
                self.assertEqual(e['reading_search']['state'],state)

    def test_discovered_alternate_anchor_has_witness_and_exact_domain(self):
        from library.test_analysis import _domain_cells
        words={'zanchor':[['Z','IY1','T','AH0'],['Z','IY0','T','AH1']],
               'banchor':[['B','IY1','T','AH0']]}
        _, rows, _=self.sound(words,'zanchor banchor',['vowel'])
        edge=self.edge(rows,'vowel')
        self.assertEqual(edge['verdict'],'true')
        self.assertIn('zanchor = Z IY1 T AH0',edge['reading']['witness'])
        result=next(r for r in rows if r['kind']=='method_result')
        self.assertEqual(result['coverage'],'answered')
        domain=result['domain']
        self.assertEqual(domain['projection'],'exact_token_pair')
        self.assertIn(('line:0:token:0','line:0:token:1'),_domain_cells(domain))
        self.assertEqual(domain['reading_policy'],'exists_compatible_reading')
        self.assertEqual(domain['reading_dependent_tokens'],[])

    def test_pair_cap_withholds_absence_authority(self):
        with patch.object(AnalysisSession,'SOUND_PAIR_CAP',1):
            _, rows, _=self.sound({},'cat bat hat',['vowel'])
        result=next(r for r in rows if r['kind']=='method_result')
        self.assertEqual(result['coverage'],'refused')
        self.assertEqual(result['domain'],{'projection':'none','reason':'refused'})

    def test_sound_declaration_marks_first_reading_only_negative(self):
        from library.test_analysis import _with_words
        words={'zshape':[['Z','AY1','ER0'],['Z','AY1','R']]}
        _, control, _=self.sound(words,'zshape bar',['coda'])
        self.assertEqual(self.edge(control,'coda')['verdict'],'true')
        with _with_words(words):
            session=AnalysisSession(source('zshape bar'),
                {'sound':{'caesura':{'positions':{},'source':'authored fixture'}}},
                {'layers':['sound']},requested_methods=[method_id('shared_sound','coda@v1')])
            rows=[]
            while True:
                result=session.step()
                rows.extend(result['records'])
                if result['done']:
                    break
        self.assertIsNone(self.edge(rows,'coda'))
        terminal=next(r for r in rows if r['kind']=='method_result')
        # The aggregate counter discloses policy narrowing; answered alone
        # must not be read as existential exhaustion by a downstream view.
        self.assertEqual(terminal['counts']['first_reading_only'],1)
        self.assertEqual(terminal['counts']['false'],1)

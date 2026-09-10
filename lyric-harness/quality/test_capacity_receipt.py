"""Actual pair-proof controls and strict runtime receipt admission.

The tiny receipt exercises the protocol only; it does not claim to establish
the81-family qualification, which verify_all measures separately.
"""
import copy
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from quality import capacity as C
from quality.plan import make_plan, PlanRefused
from quality.revise import Reviser
from quality.verify_capacity import verify_witness, main as verify_main


class CapacityReceiptTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reviser = Reviser()
        cls.rows = [{'family': 'OW-N', 'relation': 'RHYME', 'words': 2,
                     'classes': 2, 'chain_hi': 2, 'certified': 1, 'chain_lo': 2,
                     'witness': 'bone sown', 'examples': 'bone sown'}]
        measured = verify_witness(cls.reviser, cls.rows[0])
        cls.receipt = {'version': 1, 'status': 'verified',
                       'scope': 'all_certified_capacity_witnesses', 'relation': 'RHYME',
                       'python': sys.version, 'source_identity': 'source-a', 'table_sha256': 'table-a',
                       'families_total': 1, 'witnesses_required': 1, 'witnesses_verified': 1,
                       'construction_attempt_cap': C.CERTIFY_ATTEMPT_CAP,
                       'summary': json.loads(json.dumps(C.summarize(cls.rows))),
                       'witnesses': [measured]}

    def validate(self, receipt, **overrides):
        args = dict(table_sha256='table-a', source_identity='source-a', python_version=sys.version)
        args.update(overrides)
        return C.validate_receipt(receipt, self.rows, **args)

    def test_actual_pair_measured_and_valid_unit_receipt(self):
        self.assertEqual(self.receipt['witnesses'][0]['pairs_judged'], 1)
        self.assertEqual(self.validate(copy.deepcopy(self.receipt)), self.receipt)

    def test_actual_producer_writes_then_admits_its_json_receipt(self):
        # This is an actual two-word judge and producer/write/read/admission
        # round trip over a deliberately tiny population, not the81-family proof.
        summary = C.summarize(self.rows)
        with tempfile.TemporaryDirectory() as temp, \
             patch.object(C, 'ADOPTED', summary), \
             patch.object(C, 'ADOPTED_MAX_GROUP', 2), \
             patch.object(C, 'CERTIFY_MIN_CLASSES', 2), \
             patch.object(C, 'families', return_value={('OW', 'N'): {
                 'one': ['bone'], 'own': ['sown']}}):
            table, receipt = Path(temp, 'table.tsv'), Path(temp, 'receipt.json')
            rows = C.CertifiedRows(C.certification_identity(self.reviser))
            rows.extend(self.rows)
            C.emit_table(rows, str(table))
            argv = ['--table', str(table), '--output', str(receipt), '--workers=1']
            self.assertEqual(verify_main(argv), 0)
            wire = json.loads(receipt.read_text())
            self.assertEqual(wire['summary']['chain_hi_at_least']['2'], 1)
            self.assertEqual(wire['witnesses'][0]['pairs_judged'], 1)
            self.assertEqual(verify_main([*argv, '--check']), 0)
            # --reuse-valid ADMITS the receipt this runtime would admit at boot
            # and does not measure again: the bytes stay, and verify_all is not
            # reached. The same flag over a receipt the runtime would refuse
            # measures, and what it writes is admitted afresh.
            before = receipt.read_bytes()
            import quality.verify_capacity as V
            with patch.object(V, 'verify_all', side_effect=AssertionError('measured a receipt it should have admitted')):
                self.assertEqual(verify_main([*argv, '--reuse-valid']), 0)
            self.assertEqual(receipt.read_bytes(), before)
            for wrong in (True, 1.0):
                changed = copy.deepcopy(wire)
                changed['summary']['chain_hi_at_least']['2'] = wrong
                receipt.write_text(json.dumps(changed))
                self.assertEqual(verify_main([*argv, '--check']), 2)
            self.assertEqual(verify_main([*argv, '--reuse-valid']), 0)
            self.assertEqual(receipt.read_bytes(), before)
            self.assertEqual(verify_main([*argv, '--check']), 0)
            receipt.unlink()
            self.assertEqual(verify_main([*argv, '--reuse-valid']), 0)
            self.assertEqual(receipt.read_bytes(), before)

    def test_wrong_runtime_source_table_and_incomplete_records_refuse(self):
        for overrides in ({'python_version': 'another Python build'},
                          {'source_identity': 'source-b'}, {'table_sha256': 'table-b'}):
            with self.subTest(overrides=overrides), self.assertRaisesRegex(ValueError, 'CAPACITY_UNVERIFIED'):
                self.validate(self.receipt, **overrides)
        for replacement in ([], self.receipt['witnesses'] * 2):
            changed = copy.deepcopy(self.receipt)
            changed['witnesses'] = replacement
            with self.assertRaisesRegex(ValueError, 'CAPACITY_UNVERIFIED'):
                self.validate(changed)
        changed = copy.deepcopy(self.receipt)
        changed['witnesses'][0]['pairs_judged'] = True
        with self.assertRaisesRegex(ValueError, 'CAPACITY_UNVERIFIED'):
            self.validate(changed)

    def test_actual_hidden_ban_refusal_and_wrong_relation_cannot_attest(self):
        for words in ('hair chair', 'wind find', 'bone bin'):
            row = dict(self.rows[0], witness=words)
            with self.subTest(words=words), self.assertRaisesRegex(ValueError, 'CAPACITY_UNVERIFIED'):
                verify_witness(self.reviser, row)

    def test_missing_receipt_blocks_installed_lookup_and_planning(self):
        with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, {
                'LYRIC_RELEASE_ASSETS_REQUIRED': '1',
                'LYRIC_CAPACITY_ATTESTATION': str(Path(temp, 'missing.json'))}):
            with self.assertRaisesRegex(ValueError, 'CAPACITY_UNVERIFIED'):
                C.read_table()
            with self.assertRaisesRegex(PlanRefused, 'CAPACITY_UNVERIFIED'):
                make_plan(seed=1, lines=12)

    def test_changed_adopted_bound_invalidates_admission_and_its_cache(self):
        with tempfile.TemporaryDirectory() as temp:
            receipt = Path(temp, 'receipt.json')
            receipt.write_text(json.dumps({}))
            before = C._proof_epoch(C.TABLE_PATH, receipt)
            with patch.object(C, 'ADOPTED_MAX_GROUP', C.ADOPTED_MAX_GROUP + 1):
                self.assertNotEqual(C._proof_epoch(C.TABLE_PATH, receipt), before)
                with self.assertRaisesRegex(ValueError, 'adopted generator capacity'):
                    C.require_current_proof(receipt_path=str(receipt))


if __name__ == '__main__':
    unittest.main()

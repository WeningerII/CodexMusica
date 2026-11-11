import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from paired_rebuild_admission import admit

class Rebuild(unittest.TestCase):
    def test_new_image_id_requires_exact_reviewed_inventory(self):
        with tempfile.TemporaryDirectory() as directory:
            original=Path(directory)/'original'; rebuilt=Path(directory)/'rebuilt'
            original.mkdir();rebuilt.mkdir()
            approval={'rebuild_rule':'exact-inventory-except-baked-release-v1'};images={}
            def save(root,name,obj):
                raw=json.dumps(obj).encode();(root/name).write_bytes(raw)
                return hashlib.sha256(raw).hexdigest()
            for arm in ('before','after'):
                row={'source_sha':arm,'baked':{'commit':arm,'release_id':'old'},
                     'runtime_source':{'files':{'code':'hash'}},'runtime_dependencies':{'lib':'1'}}
                approval[arm]={'image_id':'old-'+arm,
                    'inventory_sha256':save(original,arm+'-inventory.json',row),
                    'effective_config_sha256':save(original,arm+'-effective-config.json',{'Env':['fixed']})}
                row['baked']['release_id']='new';save(rebuilt,arm+'-inventory.json',row)
                save(rebuilt,arm+'-effective-config.json',{'Env':['fixed']})
                images[arm]={'image_id':'new-'+arm,'source_sha':arm}
                save(rebuilt,arm+'-image.json',[{'Id':'new-'+arm}])
                save(rebuilt,arm+'-status.json',{'status':'read','image_id':'new-'+arm})
            witness=admit(approval,images,original,rebuilt)
            self.assertEqual(witness['before']['encoding_image_id'],'old-before')
            self.assertEqual(witness['before']['measurement_image_id'],'new-before')
            with self.assertRaisesRegex(RuntimeError,'approved rebuild'):
                admit(dict(approval,rebuild_rule=''),images,original,rebuilt)
            p=rebuilt/'after-inventory.json';baseline=json.loads(p.read_text())
            for field in ('runtime_source','runtime_dependencies','source_sha'):
                row=copy.deepcopy(baseline);row[field]='drift';save(rebuilt,p.name,row)
                with self.assertRaises(RuntimeError):admit(approval,images,original,rebuilt)
            save(rebuilt,p.name,baseline)
            save(original,'before-inventory.json',{})
            with self.assertRaisesRegex(RuntimeError,'reviewed inventory bytes changed'):
                admit(approval,images,original,rebuilt)

import base64
import copy
import gzip
import json
from pathlib import Path
import tempfile
import time
import unittest
from paired_fixture_validation import PROTOCOL, digest, compare_sets, fixture_set

def packed(v):
    return json.dumps(v, ensure_ascii=False, separators=(',', ':')).encode()

class DerivedFixtures(unittest.TestCase):
    def fixture(self):
        state = {'version':1, 'accepted_lines':['same'], 'input_draft':['same']}
        row = {'key':'capacity:0', 'run_id':'run_'+'1'*64, 'state':state, 'checkpoint':state}
        common = packed({'protocol':PROTOCOL, 'bounds':{'count':1,'decoded':2048,'maxLines':1,'maxChars':4}, 'records':[row]})
        jobs = {'jobs/one.json': digest(packed({'state':'completed','updated_at':int(time.time()*1000)})), 'receipts.json':digest(b'{}')}
        out=[]
        for semantic in ('a'*64, 'b'*64):
            payload=packed(state)
            wire=packed({'semantic_identity':semantic,'connector_contract':3,'codec':1,'encoding':'gzip+base64',
                'decoded_bytes':len(payload),'sha256':digest(payload),'payload':base64.b64encode(gzip.compress(payload,mtime=0)).decode()}).decode()
            proof={'protocol':PROTOCOL,'semantic_identity':semantic,'common_sha256':digest(common),
                   'common_files':dict(jobs, **{'common.json':digest(common)}), 'evidence':[
                       {'key':'capacity:0','field':field,'decoded_sha256':digest(payload),
                        'wire_sha256':digest(wire.encode()),'wire_bytes':len(wire.encode()),
                        'serialized_wire_bytes':len(packed(wire))} for field in ('state','checkpoint')]}
            out.append({'files':jobs.copy(), 'proof':proof, 'prepared':{'version':1,'maxLines':1,'maxChars':4,
                'records':[dict(row,state=wire,checkpoint=wire)]}})
        return common,*out

    def test_valid_pair_and_causal_mutants(self):
        common,a,b=self.fixture()
        self.assertEqual(compare_sets(a,b,common),digest(common))
        mutations=[
            lambda x:x['files'].update({'jobs/one.json':'changed'}),
            lambda x:x['proof'].update(common_sha256='0'*64),
            lambda x:x['prepared']['records'].clear(),
            lambda x:x['prepared'].update(maxLines=2),
            lambda x:x['prepared']['records'][0].update(state=a['prepared']['records'][0]['state']),
            lambda x:x['proof']['evidence'][0].update(decoded_sha256='wrong'),
            lambda x:x['proof']['evidence'][0].update(wire_bytes=1),
        ]
        for mutate in mutations:
            value=copy.deepcopy(b);mutate(value)
            with self.assertRaises(RuntimeError):compare_sets(a,value,common)
        decoded=json.loads(common);decoded['records'][0]['state']['accepted_lines']=['changed']
        changed=packed(decoded)
        for value in (a,b):
            value['proof']['common_sha256']=digest(changed)
            value['proof']['common_files']['common.json']=digest(changed)
        with self.assertRaisesRegex(RuntimeError,'payload bytes differ'):compare_sets(a,b,changed)

    def test_manifest_image_script_ttl_and_mutation_bindings(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'jobs').mkdir(mode=0o700)
            image={'image_id':'sha256:'+'a'*64,'source_sha':'b'*40};scripts={'test.py':'c'*64}
            prepared=b'{}';common='d'*64
            proof=dict(image,protocol=PROTOCOL,semantic_identity='e'*64,runtime_source_sha256='f'*64,
                scripts=scripts,common_sha256=common,prepared_sha256=digest(prepared))
            values={'prepared-runs.json':prepared,'prepared-runs.json.sha256':digest(prepared).encode()+b'\n',
                'encoding-proof.json':packed(proof),'receipts.json':b'{}',
                'jobs/one.json':packed({'state':'completed','updated_at':int(time.time()*1000)})}
            def save():
                for name,value in values.items():
                    (root/name).write_bytes(value);(root/name).chmod(0o600)
                (root/'manifest.json').write_bytes(packed(dict(image,protocol=PROTOCOL,common_sha256=common,
                    files={n:digest(v) for n,v in values.items()})))
            save()
            original=fixture_set(root,image,scripts)
            with self.assertRaisesRegex(RuntimeError,'image/source'):fixture_set(root,dict(image,image_id='different'),scripts)
            with self.assertRaisesRegex(RuntimeError,'script trees'):fixture_set(root,image,{})
            (root/'prepared-runs.json').write_bytes(b'changed')
            with self.assertRaisesRegex(RuntimeError,'bytes differ'):fixture_set(root,image,scripts)
            save();self.assertEqual(original['manifest_sha256'],fixture_set(root,image,scripts)['manifest_sha256'])
            values['jobs/one.json']=packed({'state':'completed','updated_at':0});save()
            with self.assertRaisesRegex(RuntimeError,'TTL'):fixture_set(root,image,scripts)

if __name__=='__main__':unittest.main()

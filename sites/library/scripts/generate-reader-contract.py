"""Generate frontend vocabulary and publish the request contract for reader-v1."""
import gzip,hashlib,json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
bootstrap=json.loads((root/'public/catalog/bootstrap.json').read_text())
raw=gzip.decompress((root/'public/catalog'/bootstrap['result_schema']['path']).read_bytes())
assert hashlib.sha256(raw).hexdigest()==bootstrap['result_schema']['sha256']
schema=json.loads(raw)
types=['// Generated from the pinned reader JSON Schema. Run scripts/generate-reader-contract.py.']
for name in ('namespace','precision','coverage','verdict'):
 types.append('export type '+''.join(s.title() for s in name.split('_'))+' = '+' | '.join(json.dumps(x) for x in schema['$defs'][name]['enum'])+';')
types.append('export type EvidenceKind = '+' | '.join(json.dumps(x) for x in schema['$defs']['evidence']['properties']['kind']['enum'])+';')
types.append('export const resultSchemaSha256 = '+json.dumps(bootstrap['result_schema']['sha256'])+';')
(root/'lib/reader-contract.ts').write_text('\n'.join(types)+'\n')
request={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'https://codexmusica.com/api/library/reader-request.schema.json','title':'Codex Musica Library reader request v1','type':'object','additionalProperties':False,'required':['contract_version','snapshot_id','reading_unit_id','reading_revision','idempotency_key'],'properties':{'contract_version':{'const':1},'snapshot_id':{'type':'string','pattern':'^[a-f0-9]{64}$'},'reading_unit_id':{'type':'string','minLength':1,'maxLength':200},'reading_revision':{'type':'string','pattern':'^[a-f0-9]{64}$'},'declaration_set':{'type':'object'},'requested_layers':{'type':'array','maxItems':4,'uniqueItems':True,'items':{'enum':['sound','form','rhythm','language']}},'requested_methods':{'type':'array','maxItems':256,'items':{'type':'string','minLength':1,'maxLength':200}},'idempotency_key':{'type':'string','minLength':1,'maxLength':200}}}
(root/'public/reader-request.schema.json').write_text(json.dumps(request,ensure_ascii=False,separators=(',',':'))+'\n')
(root/'public/reader-result.schema.json').write_bytes(raw)
print(json.dumps({'contract_version':1,'result_schema_sha256':bootstrap['result_schema']['sha256'],'generated_types':5}))

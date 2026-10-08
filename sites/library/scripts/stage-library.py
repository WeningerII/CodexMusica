"""Stage only verified, rights-filtered artifacts from the pinned backend export."""
import argparse,gzip,hashlib,json,pathlib,shutil
p=argparse.ArgumentParser();p.add_argument('export');p.add_argument('snapshot');a=p.parse_args()
source=pathlib.Path(a.export);dest=pathlib.Path(__file__).resolve().parents[1]/'public/catalog'
im=json.loads((source/'import_manifest.json').read_text());manifest=json.loads((pathlib.Path(a.snapshot)/'manifest.json').read_text());assert im['snapshot_id']==manifest['snapshot_id']
refs=im['packs']+[im['site_index'],*im['references'].values()]
for r in refs:
 data=(source/r['path']).read_bytes();assert len(data)==r['gzip_bytes'] and hashlib.sha256(data).hexdigest()==r['gzip_sha256'];raw=gzip.decompress(data);assert len(raw)==r['raw_bytes'] and hashlib.sha256(raw).hexdigest()==r['raw_sha256']
if dest.exists():shutil.rmtree(dest)
dest.mkdir(parents=True,exist_ok=True)
for r in refs:
 data=(source/r['path']).read_bytes();assert len(data)==r['gzip_bytes'] and hashlib.sha256(data).hexdigest()==r['gzip_sha256'];raw=gzip.decompress(data);assert len(raw)==r['raw_bytes'] and hashlib.sha256(raw).hexdigest()==r['raw_sha256'];target=dest/r['path'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source/r['path'],target)
compact={k:v for k,v in manifest.items() if k not in ('artifacts','sources')};compact['counts']=im['counts'];compact['catalog_descriptor_sha256']=hashlib.sha256((source/'import_manifest.json').read_bytes()).hexdigest()
def ref(r):return {**r,'sha256':r['raw_sha256']}
# All referenced logical objects exist before any D1 metadata/search import.
chunks=sorted(im['packs'],key=lambda r:(r['kind']=='readings',r['path']))
b={'manifest':compact,'index':ref(im['site_index']),'methods':ref(im['references']['methods']),'result_schema':ref(im['references']['result_schema']),'references':{k:ref(v) for k,v in im['references'].items()},'chunks':[ref(x) for x in chunks],'whole_sources':im['whole_sources'],'exports':{}}
for hash,record in b['whole_sources'].items():
 artifact=im['artifacts'].get('sources/'+hash+'.bin',{})
 if artifact.get('representation')=='utf8_fragments':record['fragment_paths']=artifact['pack_paths']
(dest/'bootstrap.json').write_text(json.dumps(b,ensure_ascii=False,separators=(',',':'))+'\n')
# Unicode NFC + casefold matches the backend; JavaScript lowercase alone does not.
fold={chr(cp):chr(cp).casefold() for cp in range(0x110000) if chr(cp).casefold()!=chr(cp)}
(pathlib.Path(__file__).resolve().parents[1]/'lib/unicode-casefold.json').write_text(json.dumps(fold,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'snapshot':im['snapshot_id'],'packs':len(chunks),'bytes':sum(x['gzip_bytes'] for x in refs),'bootstrap_bytes':(dest/'bootstrap.json').stat().st_size}))

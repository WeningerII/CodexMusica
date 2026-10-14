import subprocess,pathlib,sys,json,time
root=pathlib.Path('/workspace/acceptance-68e'); out=pathlib.Path(__file__).parent
sys.path.insert(0,str(root/'lyric-harness'))
from quality.counters import symbol_reach
records={}
for ref in ['8ea94ac9d5141eb5062a8094351a9330f4edc38c','a09703a0eb9581a37b97c8041e8fcc640c7cf2b1','68e213d0aadf589319bce345b8eebc4b0d0a60f1']:
 dest=pathlib.Path('/tmp/acceptance-symbol-'+ref[:8]); dest.mkdir(exist_ok=True)
 entries=[]
 for line in subprocess.check_output(['git','ls-tree','-r',ref,'lyric-harness'],cwd=root,text=True).splitlines():
  meta,name=line.split('\t');
  if name.endswith('.py'): entries.append((meta.split()[2],name.removeprefix('lyric-harness/')))
 p=subprocess.Popen(['git','cat-file','--batch'],cwd=root,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
 for obj,name in entries:
  p.stdin.write((obj+'\n').encode());p.stdin.flush(); header=p.stdout.readline().split(); data=p.stdout.read(int(header[2]));p.stdout.read(1)
  path=dest/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
 p.stdin.close();p.wait()
 t=time.time(); rows,_=symbol_reach(str(dest)); records[ref]=rows
 print(ref,len(rows),time.time()-t,flush=True)
 (out/('symbols-'+ref[:8]+'.json')).write_text(json.dumps(rows,indent=2)+'\n')
base,old,head=records.values()
(out/'symbols_comparison.json').write_text(json.dumps({'base':'8ea94ac9','old':'a09703a0','head':'68e213d0','counts':{k:len(v) for k,v in records.items()},'base_equals_head':base==head,'base_equals_a097':base==old,'head_only_rows':[x for x in head if x not in base],'base_only_rows':[x for x in base if x not in head]},indent=2)+'\n')

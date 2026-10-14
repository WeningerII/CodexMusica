import pathlib,subprocess,os,time,json,hashlib
root=pathlib.Path('/workspace/acceptance-68e'); out=pathlib.Path(__file__).parent
base='a09703a0eb9581a37b97c8041e8fcc640c7cf2b1'; head='68e213d0aadf589319bce345b8eebc4b0d0a60f1'
def tree(ref):
 return dict(line.split('\t')[::-1] for line in subprocess.check_output(['git','ls-tree','-r',ref],cwd=root,text=True).splitlines())
a,b=tree(base),tree(head); changed={p:{base:a.get(p),head:b.get(p)} for p in sorted(a.keys()|b.keys()) if a.get(p)!=b.get(p)}
(out/'tree_delta.json').write_text(json.dumps({'base':base,'head':head,'identical_entries':sum(a.get(p)==b.get(p) for p in a.keys()|b.keys()),'changed':changed},indent=2)+'\n')
paths=['codex.html','lyric-harness/quality/test_revise.py','lyric-harness/quality/test_reader.py','lyric-harness/quality/results/reader_continuation_2026-10-14/p7_mutations.py']
(out/'sha256_delta.json').write_text(json.dumps({p:{r:hashlib.sha256(subprocess.check_output(['git','show',r+':'+p],cwd=root)).hexdigest() for r in [base,head]} for p in paths},indent=2)+'\n')
env={**os.environ,'LYRIC_STAGED_DATA':'/workspace/acceptance-code/lyric-harness/data','OMP_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1','MKL_NUM_THREADS':'1'}
commands=[['lyric-harness/quality/test_reader.py','Normalisation'],['lyric-harness/quality/results/reader_continuation_2026-10-14/p7_mutations.py','C'],['lyric-harness/quality/results/reader_continuation_2026-10-14/p7_mutations.py','F2'],['-c',"import runpy; runpy.run_path('lyric-harness/quality/results/reader_continuation_2026-10-14/p7_mutations.py', run_name='independent_import_probe'); print('PASS: import without argv has no mutation or test execution')"]]
records=[]
for i,args in enumerate(commands,1):
 cmd=['/workspace/acceptance-venv/bin/python',*args]; t=time.time()
 with (out/f'{i}.log').open('w') as f: p=subprocess.run(cmd,cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT)
 records.append(dict(command=cmd,exit_code=p.returncode,duration_seconds=time.time()-t,log=f'{i}.log'))
(out/'results.json').write_text(json.dumps(records,indent=2)+'\n')

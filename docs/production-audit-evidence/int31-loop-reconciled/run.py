from pathlib import Path
import concurrent.futures,hashlib,json,os,signal,subprocess,sys,time
root=Path('/workspace/scratch/b0544e4bbdd6/production-fixes');here=Path(__file__).resolve().parent
staged=Path('/workspace/scratch/b0544e4bbdd6/CodexMusica/lyric-harness/data')
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
def identity():
 paths=subprocess.check_output(['git','ls-files','lyric-harness/*.py','lyric-harness/**/*.py','mcp/requirements-runtime.txt'],cwd=root,text=True).splitlines()
 sources={p:digest(root/p) for p in paths}
 m=root/'lyric-harness/data/runtime_assets.json';data={'runtime_assets.json':digest(m)}
 for a in json.loads(m.read_text())['assets']:
  base=root/'lyric-harness' if a['base']=='root' else staged
  for f in a['files']:data[a['id']+':'+f['path']]=digest(base/f['path'])
 return {'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'python':sys.version,'node':subprocess.check_output(['node','--version'],text=True).strip(),'python_sources':sources,'declared_data':data,'runtime_source_sha256':subprocess.check_output(['node','--input-type=module','-e',"import {runtimeSourceFingerprint} from './mcp/build_identity.js';console.log(runtimeSourceFingerprint());"],cwd=root,text=True).strip(),'installed_receipt_sha256':digest(root/'mcp/capacity_verification.json')}
def save(record):
 p=here/'result.json.tmp';p.write_text(json.dumps(record,indent=2)+'\n');os.replace(p,here/'result.json')
env={**os.environ,'LYRIC_STAGED_DATA':str(staged),'NLTK_DATA':str(staged/'nltk'),'PYTHONPATH':str(root/'lyric-harness'),'PYTHONUNBUFFERED':'1','OMP_NUM_THREADS':'1','MKL_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1'}
for k in ['LYRIC_RELEASE_ASSETS_REQUIRED','LYRIC_CAPACITY_ATTESTATION','INT31_SELECTED_SHARD']:env.pop(k,None)
stages=[('loop',[sys.executable,str(here/'selected_sections.py'),'loop'])]
before=identity();record={'status':'running','identity_before':before,'scope':'INT31 direct Python dependencies; ordinary nonproduction mode; all Python source and declared asset bytes bound. Raw broader runtime and unused installed receipt identities are separately disclosed.','expected_stages':[n for n,_ in stages],'stage_timeout_s':1200,'results':[]};save(record)
def run(item):
 name,cmd=item;start=time.monotonic();p=subprocess.Popen(cmd,cwd=root/'lyric-harness',env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
 def kill():
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
 try:
  stdout,stderr=p.communicate(timeout=1200);code=p.returncode
 except subprocess.TimeoutExpired:
  kill();stdout,stderr=p.communicate();code=124
 finally:kill()
 (here/(name+'.stdout.log')).write_bytes(stdout);(here/(name+'.stderr.log')).write_bytes(stderr)
 complete=(name not in ['loop','verbs'] or f'SELECTED_SECTIONS_COMPLETED {2 if name=="loop" else 6} EXIT 0' in stdout.decode(errors='replace'))
 return {'name':name,'command':cmd,'exit_code':code,'wall_s':time.monotonic()-start,'selection_completed':complete,'stdout_sha256':hashlib.sha256(stdout).hexdigest(),'stderr_sha256':hashlib.sha256(stderr).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
 for row in pool.map(run,stages):record['results'].append(row);save(record)
after=identity();same=before['python_sources']==after['python_sources'] and before['declared_data']==after['declared_data'] and before['python']==after['python'];ok=same and len(record['results'])==1 and all(r['exit_code']==0 and r['selection_completed'] for r in record['results']);record.update(status='passed' if ok else 'failed_or_incomplete',identity_after=after,python_and_data_stable=same,broader_runtime_source_stable=before['runtime_source_sha256']==after['runtime_source_sha256']);save(record);print(json.dumps({'status':record['status'],'python_and_data_stable':same,'results':record['results']}),flush=True);raise SystemExit(0 if ok else 1)

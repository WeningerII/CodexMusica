from pathlib import Path
import hashlib,json,os,signal,subprocess,sys,time
root=Path('/workspace/scratch/b0544e4bbdd6/production-fixes');here=Path(__file__).resolve().parent
staged=Path('/workspace/scratch/b0544e4bbdd6/CodexMusica/lyric-harness/data')
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
def identity():
 m=root/'lyric-harness/data/runtime_assets.json';data={'runtime_assets.json':digest(m)}
 for a in json.loads(m.read_text())['assets']:
  base=root/'lyric-harness' if a['base']=='root' else staged
  for f in a['files']:data[a['id']+':'+f['path']]=digest(base/f['path'])
 return {'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'runtime_source_sha256':subprocess.check_output(['node','--input-type=module','-e',"import {runtimeSourceFingerprint} from './mcp/build_identity.js';console.log(runtimeSourceFingerprint());"],cwd=root,text=True).strip(),'python':sys.version,'node':subprocess.check_output(['node','--version'],text=True).strip(),'declared_data':data,'installed_receipt_sha256':digest(root/'mcp/capacity_verification.json')}
def save(r):
 p=here/'result.json.tmp';p.write_text(json.dumps(r,indent=2)+'\n');os.replace(p,here/'result.json')
stages=[('collector',['node','--test','mcp/test_battery_repairs.mjs'],'tests 5'),('kitchen_repairs_http',['node','mcp/test_kitchen_repairs.mjs'],'kitchen repair HTTP: accepted application=1, rejected noop=0'),('battery_lifecycle',['node','mcp/test_battery_lifecycle.mjs'],'43 battery lifecycle checks passed')]
env={**os.environ,'LYRIC_STAGED_DATA':str(staged),'NLTK_DATA':str(staged/'nltk'),'KITCHEN_REPAIR_TRACE':str(here/'kitchen-http-trace.json'),'OMP_NUM_THREADS':'1','MKL_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1'}
for k in ['LYRIC_RELEASE_ASSETS_REQUIRED','LYRIC_CAPACITY_ATTESTATION']:env.pop(k,None)
before=identity();r={'status':'running','worktree':str(root),'scope':'Final scoped two-file collector guard supplement after immutable candidate5: only an explicit interview writer may supply folded interview acceptance. Captures5 helper controls, actual HTTP kitchen/receipt/completion collection and43 battery lifecycle controls. All runtime source/data/installed receipt bytes are bound; unrelated Git report edits are outside this source identity. No further scanning or paid provider calls.','identity_before':before,'stage_timeout_s':180,'expected_stages':[n for n,_,_ in stages],'results':[]};save(r);active=None

def stop(signum,_frame):
 if active is not None:
  try:os.killpg(active.pid,signal.SIGKILL)
  except ProcessLookupError:pass
 raise SystemExit(128+signum)
signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
for name,cmd,marker in stages:
 start=time.monotonic();active=subprocess.Popen(cmd,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
 try:
  stdout,stderr=active.communicate(timeout=180);code=active.returncode
 except subprocess.TimeoutExpired:
  os.killpg(active.pid,signal.SIGKILL);stdout,stderr=active.communicate();code=124
 finally:
  try:os.killpg(active.pid,signal.SIGKILL)
  except ProcessLookupError:pass
 (here/(name+'.stdout.log')).write_bytes(stdout);(here/(name+'.stderr.log')).write_bytes(stderr)
 row={'name':name,'command':cmd,'exit_code':code,'wall_s':time.monotonic()-start,'completion_marker':marker,'completion_seen':marker in stdout.decode(errors='replace'),'stdout_sha256':hashlib.sha256(stdout).hexdigest(),'stderr_sha256':hashlib.sha256(stderr).hexdigest()};r['results'].append(row);save(r)
 active=None
end=identity();r.update(identity_after=end,source_and_data_stable=before==end);ok=before==end and len(r['results'])==3 and all(x['exit_code']==0 and x['completion_seen'] for x in r['results']);r['status']='passed' if ok else 'failed_or_incomplete';save(r);print(json.dumps({'status':r['status'],'source_and_data_stable':r['source_and_data_stable'],'results':r['results']}),flush=True);raise SystemExit(0 if ok else 1)

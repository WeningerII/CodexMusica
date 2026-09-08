import hashlib,json,subprocess,time,signal
from pathlib import Path
root=Path('/workspace/scratch/b0544e4bbdd6/production-fixes');out=root.parent/'production-fix-results/final-static';out.mkdir(exist_ok=True)
def source():return subprocess.check_output(['node','--input-type=module','-e',"import {runtimeSourceFingerprint} from './mcp/build_identity.js'; console.log(runtimeSourceFingerprint());"],cwd=root,text=True).strip()
before=source();commands=[('lint',['npm','run','lint']),('format',['npm','run','format:check']),('docs',['npm','run','check-docs']),('whitespace',['git','diff','--check','HEAD','--','.',':!docs/production-audit-evidence',':!lyric-harness/quality/results/production_data_2026-09-08'])];results=[]
for name,cmd in commands:
 start=time.monotonic();p=subprocess.Popen(cmd,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
 try:stdout,stderr=p.communicate(timeout=180);code=p.returncode
 except subprocess.TimeoutExpired:signal.pthread_kill if False else None;import os;os.killpg(p.pid,signal.SIGKILL);stdout,stderr=p.communicate();code=124
 (out/(name+'.stdout.log')).write_bytes(stdout);(out/(name+'.stderr.log')).write_bytes(stderr)
 results.append({'name':name,'command':cmd,'exit_code':code,'wall_s':time.monotonic()-start,'stdout_sha256':hashlib.sha256(stdout).hexdigest(),'stderr_sha256':hashlib.sha256(stderr).hexdigest()});print(name,code,flush=True)
a=json.load(open(root.parent/'production-audit/CodexMusica-audit-findings.json'));d=json.load(open(root/'docs/production-audit-fixes.json'));old={f['id']:f for f in a['findings']};new={f['id']:f for f in d['findings']};assert len(old)==len(new)==85 and old.keys()==new.keys()
for key,f in new.items():
 for field in ('id','title','severity'):assert f[field]==old[key][field],(key,field)
 assert f['original_acceptance']==old[key]['acceptance'] and f['original_test_gap']==old[key]['test_gap'],key
 for path in f['implementation_paths']+f['test_paths']:assert (root/path).is_file(),(key,path)
from collections import Counter
assert dict(Counter(f['status'] for f in d['findings']))==d['status_counts'];assert len(d['integration_repairs'])==37 and all(f['status']=='local_verified' for f in d['integration_repairs']);assert d['production_qualified'] is False
after=source();record={'status':'passed' if all(r['exit_code']==0 for r in results) and before==after else 'failed','source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'source_before':before,'source_after':after,'source_stable':before==after,'commands':results,'original_85_acceptance_and_test_gaps_preserved':True,'all_original_implementation_test_paths_exist':True,'integration_repairs':37,'production_qualified':False,'scope':'Final maintained lint/format/docs and original audit-contract integrity on committed runtime source. Raw archived reproductions are excluded from style checks; their exact bytes and index are independently checked. Report status bookkeeping after this gate cannot change runtime source.'};(out/'result.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'status':record['status'],'source_stable':record['source_stable']}),flush=True);raise SystemExit(0 if record['status']=='passed' else 1)

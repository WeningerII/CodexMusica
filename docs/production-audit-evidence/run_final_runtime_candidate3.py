import hashlib,importlib.util,json,os,signal,subprocess,sys,time,re
from pathlib import Path
base=Path('/workspace/scratch/b0544e4bbdd6/production-fix-results')
root=base.parent/'verification-candidate3'
out=base/'final-runtime-candidate3';out.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('identity_capture',base/'final-python88-round2/run_gate.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);m.ROOT=root
for k in list(os.environ):
 if k.startswith(('OPENAI_','ANTHROPIC_','GEMINI_','GOOGLE_','CLAUDE_')):os.environ.pop(k)
for k in ('LYRIC_RELEASE_ASSETS_REQUIRED','LYRIC_CAPACITY_ATTESTATION'):os.environ.pop(k,None)
os.environ['LYRIC_STAGED_DATA']=str(root.parent/'CodexMusica/lyric-harness/data')
os.environ['NLTK_DATA']=os.environ['LYRIC_STAGED_DATA']+'/nltk'
before=m.identity();cmd=['npm','run','test:lyrics:runtime'];start=time.monotonic()
record={'status':'running','command':cmd,'timeout_s':600,'identity_before':before,'scope':'Actual maintained offline and eight-file Node runtime stages on isolated final Python/Node source, ordinary nonproduction mode, no installed receipt and no ambient provider credentials.'}
(out/'result.json').write_text(json.dumps(record,indent=2)+'\n')
p=subprocess.Popen(cmd,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
try:stdout,stderr=p.communicate(timeout=600);code=p.returncode
except subprocess.TimeoutExpired:
 os.killpg(p.pid,signal.SIGKILL);stdout,stderr=p.communicate();code=124
(out/'stdout.log').write_bytes(stdout);(out/'stderr.log').write_bytes(stderr)
after=m.identity();text=(stdout+stderr).decode(errors='replace')
node_counts=[int(v) for v in re.findall(r'(?:#|ℹ) tests (\d+)',text)]
node_passes=[int(v) for v in re.findall(r'(?:#|ℹ) pass (\d+)',text)]
node_failures=[int(v) for v in re.findall(r'(?:#|ℹ) fail (\d+)',text)]
python_counts=[int(v) for v in re.findall(r'Ran (\d+) tests? in ',text)]
complete=node_counts==[67,65] and node_passes==[67,65] and node_failures==[0,0] and python_counts==[16,7,5,6]
good=code==0 and complete and before==after
record.update(status='passed' if good else 'failed_or_incomplete',exit_code=code,wall_s=time.monotonic()-start,identity_after=after,source_stable=before==after,completion_proven=complete,node_tests=node_counts,node_passes=node_passes,node_failures=node_failures,python_controls=python_counts,stdout_sha256=hashlib.sha256(stdout).hexdigest(),stderr_sha256=hashlib.sha256(stderr).hexdigest(),stdout_bytes=len(stdout),stderr_bytes=len(stderr))
(out/'result.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:record[k] for k in ['status','exit_code','wall_s','source_stable','completion_proven','node_tests','python_controls']}),flush=True)
sys.exit(0 if good else 1)

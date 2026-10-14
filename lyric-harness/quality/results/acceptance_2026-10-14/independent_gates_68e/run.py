import os, subprocess, json, time, pathlib, concurrent.futures, hashlib
root=pathlib.Path('/workspace/acceptance-code'); out=pathlib.Path('/workspace/acceptance-gates')
env=dict(os.environ); env.update(PATH='/workspace/acceptance-venv/bin:'+env['PATH'], LYRIC_PYTHON='/workspace/acceptance-venv/bin/python', OMP_NUM_THREADS='1', MKL_NUM_THREADS='1', OPENBLAS_NUM_THREADS='1', PYTHONUNBUFFERED='1', PLAYWRIGHT_BROWSERS_PATH='/tmp/acceptance-browsers')
for k in list(env):
 if any(x in k for x in ['API_KEY','ACCESS_TOKEN','AUTH_TOKEN']): env.pop(k)
scripts=json.loads((root/'package.json').read_text())['scripts']
def flatten(name):
 result=[]
 for cmd in scripts[name].split('&&'):
  cmd=cmd.strip()
  if cmd.startswith('npm run '): result.extend(flatten(cmd.split()[2]))
  else: result.append(cmd)
 return result
commands=flatten('test:connector:live')
extras=['test_reader_job_store.mjs','test_reader_store_bounds.mjs','test_reader_client.mjs','test_reader_integration.mjs','test_library_search.mjs','test_library_viewer_routes.mjs','test_library_exports.mjs','test_library_corpus.mjs','test_spend_store.mjs','test_resume_stopped.mjs']
commands.append('node --test --test-concurrency=1 '+' '.join('mcp/'+x for x in extras))
manifest={'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'mcp_commands':commands,'extra_files':extras,'parallelism':'2 revise shards + 1 serial MCP command; BLAS threads=1','environment_overrides':{k:env[k] for k in ['PATH','LYRIC_PYTHON','OMP_NUM_THREADS','MKL_NUM_THREADS','OPENBLAS_NUM_THREADS','PYTHONUNBUFFERED','PLAYWRIGHT_BROWSERS_PATH']},'excluded_mcp_files':{'test_library_fixtures.mjs':'shared fixture module, not test entry point','test_library_search_parity.mjs':'requires separately built pinned 317c corpus store; investigate separately','test_library_exports_parity.mjs':'requires separately built pinned 317c corpus store; investigate separately'}}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
def run(label,cmd,cwd,extra={}):
 start=time.time(); rec={'label':label,'command':cmd,'cwd':str(cwd),'environment':extra,'started_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(start))}
 (out/(label+'.status.json')).write_text(json.dumps(rec,indent=2))
 with (out/(label+'.log')).open('w') as f:
  p=subprocess.run(cmd,shell=True,cwd=cwd,env={**env,**extra},stdout=f,stderr=subprocess.STDOUT)
 rec.update(exit_code=p.returncode,duration_seconds=round(time.time()-start,3),log_sha256=hashlib.sha256((out/(label+'.log')).read_bytes()).hexdigest())
 (out/(label+'.status.json')).write_text(json.dumps(rec,indent=2)+'\n'); print(json.dumps(rec),flush=True)
 return rec
def mcp():
 return [run('mcp-%02d'%i,cmd,root) for i,cmd in enumerate(commands,1)]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 m=pool.submit(mcp)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as shards:
  r=list(shards.map(lambda k:run('revise-%d'%k,'python3 quality/test_revise.py',root/'lyric-harness',{'TEST_REVISE_SHARD':str(k)+'/4'}),range(1,5)))
 r+=m.result()
(out/'results.json').write_text(json.dumps(r,indent=2)+'\n')

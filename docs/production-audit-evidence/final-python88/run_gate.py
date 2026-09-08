#!/usr/bin/env python3
"""Local execution of the maintained CI88-suite shell; no alternate selection."""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]/'production-fixes'
SELECTION=json.loads((HERE/'selection.json').read_text())


def identity():
    source=subprocess.check_output(['node','--input-type=module','-e',"import {runtimeSourceFingerprint} from './mcp/build_identity.js'; console.log(runtimeSourceFingerprint());"],cwd=ROOT,text=True).strip()
    diff=subprocess.check_output(['git','diff','--binary','HEAD'],cwd=ROOT)
    data={}
    manifest=ROOT/'lyric-harness/data/runtime_assets.json'
    staged=Path(os.environ.get('LYRIC_STAGED_DATA') or ROOT/'lyric-harness/data')
    if manifest.exists():
        for asset in json.loads(manifest.read_text()).get('assets',[]):
            base=ROOT/'lyric-harness' if asset['base']=='root' else staged
            for item in asset['files']:
                file=base/item['path']
                data['declared:'+asset['id']+':'+item['path']]=hashlib.sha256(file.read_bytes()).hexdigest() if file.is_file() else None
    for path in [ROOT/'lyric-harness/data/rhyme_capacity_eng.tsv',ROOT/'mcp/capacity_verification.json']:
        data[str(path.relative_to(ROOT))]=hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None
    return dict(commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),worktree=str(ROOT),source_sha256=source,tracked_diff_sha256=hashlib.sha256(diff).hexdigest(),data=data,
                python=sys.version,node=subprocess.check_output(['node','--version'],text=True).strip(),packages={k:importlib.metadata.version(k) for k in ('nltk','numpy','scikit-learn','PyYAML')},
                staging={k:os.environ.get(k) for k in ('LYRIC_STAGED_DATA','NLTK_DATA','LYRIC_CAPACITY_ATTESTATION')})


def save(record):
    tmp=HERE/'result.json.tmp'; tmp.write_text(json.dumps(record,indent=2)+'\n');os.replace(tmp,HERE/'result.json')


def main():
    global ROOT
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worktree',type=Path,default=ROOT)
    args=parser.parse_args()
    ROOT=args.worktree.resolve()
    # Ordinary maintained CI suite semantics; a separate installed-runtime
    # proof may be generated elsewhere without entering this isolated tree.
    os.environ.pop('LYRIC_RELEASE_ASSETS_REQUIRED',None)
    os.environ.pop('LYRIC_CAPACITY_ATTESTATION',None)
    import yaml,re
    workflow=yaml.safe_load((ROOT/'.github/workflows/ci.yml').read_text())
    command=next(s['run'] for s in workflow['jobs']['suites']['steps'] if 'cheap suites (' in s.get('name',''))
    actual=re.search(r'for f in (.*?)\s*; do',command,re.S).group(1).replace('\\','').split()
    if actual!=SELECTION['names']:
        raise ValueError('The verification worktree does not match the prepared maintained suite selection')
    before=identity()
    record=dict(status='running',selection=SELECTION,identity_before=before,results=[],timeout_s=3600,scope='Ordinary nonproduction CI suite semantics; required release mode unset; isolated source/data snapshot; default receipt presence bound before and after')
    save(record)
    env={**os.environ,'SUITES_SHARD':'1','SUITES_SHARDS':'1','OMP_NUM_THREADS':'1','MKL_NUM_THREADS':'1','OPENBLAS_NUM_THREADS':'1','PYTHONUNBUFFERED':'1'}
    started=time.monotonic()
    with (HERE/'combined.log').open('wb') as log:
        proc=subprocess.Popen(['bash',str(HERE/'run-ci-suites.sh')],cwd=ROOT/'lyric-harness',stdout=log,stderr=subprocess.STDOUT,env=env,start_new_session=True)
        try:
            code=proc.wait(timeout=3600)
        except subprocess.TimeoutExpired:
            code=124
        finally:
            try: os.killpg(proc.pid,signal.SIGKILL)
            except ProcessLookupError: pass
            proc.wait()
    rows=[json.loads(p.read_text()) for p in (HERE/'logs').glob('*.status.json')]
    after=identity()
    completed=sorted(r['suite'] for r in rows)==sorted(SELECTION['names'])
    good=code==0 and completed and all(r['exit_code']==0 for r in rows) and before==after
    record.update(status='passed' if good else 'failed_or_incomplete',exit_code=code,wall_s=time.monotonic()-started,
                  results=rows,identity_after=after,source_stable=before==after,complete_inventory=completed)
    save(record)
    print(json.dumps({k:record[k] for k in ('status','exit_code','wall_s','source_stable','complete_inventory')}),flush=True)
    return 0 if good else 1

if __name__=='__main__':
    def interrupted(signum,_frame): raise SystemExit(128+signum)
    signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
    raise SystemExit(main())

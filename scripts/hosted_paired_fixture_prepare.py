"""Offline hosted preparation only; no workload execution or automatic approval."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid
sys.dont_write_bytecode = True
from paired_fixture_validation import fixture_set, compare_sets, scripts_inventory

def invoke(image, scripts, bundle, args, log, entry='node', program='prepare_paired_fixtures.mjs'):
    name='612-prepare-'+uuid.uuid4().hex
    try:
        with log.open('w') as output:
            subprocess.run(['docker','run','--name',name,'--rm','--pull=never','--network=none',
                '--cpus=1','--memory=2g','--memory-swap=2g','--pids-limit=256',
                '--tmpfs','/private-runtime:rw,mode=0700,size=64m',
                '-e','LYRIC_RUNTIME_DIR=/private-runtime',
                '--mount',f'type=bind,src={scripts.resolve()},dst=/app/scripts,readonly',
                '--mount',f'type=bind,src={bundle.resolve()},dst=/bundle',
                '--entrypoint',entry,image,'/app/scripts/'+program,*args],
                stdout=output,stderr=subprocess.STDOUT,timeout=1200,check=True)
    finally:
        result=subprocess.run(['docker','rm','-f',name],capture_output=True,text=True,timeout=30)
        if result.returncode and 'No such container' not in result.stderr:
            raise RuntimeError('fixture preparation cleanup failed: '+result.stderr)

def prepare(evidence, bundle, scripts):
    if shutil.disk_usage(evidence).free < 8*1024**3:
        raise RuntimeError('fixture preparation requires 8 GiB free headroom')
    available=int(next(l.split()[1] for l in Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
    if available < 4*1024**3:
        raise RuntimeError('fixture preparation requires 4 GiB available host memory')
    bundle.mkdir(mode=0o700)
    status={'status':'running','approval':'unreviewed','measurements_run':False,'steps':[]}
    receipt=evidence/'fixture-preparation.json'
    try:
        images={}
        for arm in ('before','after'):
            info=json.loads((evidence/f'{arm}-image.json').read_text())[0]
            env=dict(v.split('=',1) for v in info['Config']['Env'])
            images[arm]={'image_id':info['Id'],'source_sha':env['BUILD_GIT_COMMIT']}
        invoke(images['before']['image_id'],scripts,bundle,['generate','/bundle/common'],evidence/'fixture-generate.log')
        status['steps'].append('common-generated')
        for arm in images:
            invoke(images[arm]['image_id'],scripts,bundle,['encode','/bundle/common','/bundle/'+arm,images[arm]['image_id']],evidence/f'fixture-encode-{arm}.log')
            status['steps'].append(arm+'-encoded-and-decoded')
        script_hashes=scripts_inventory(scripts)
        sets={arm:fixture_set(bundle/arm,images[arm],script_hashes) for arm in images}
        for arm in sets:
            inventory=json.loads((evidence/f'{arm}-inventory.json').read_text())
            if sets[arm]['proof']['runtime_source_sha256'] != inventory['instrumented_runtime_sha256']:
                raise RuntimeError('encoding and inventoried instrumentation fingerprints differ')
        common=compare_sets(sets['before'],sets['after'],(bundle/'common/common.json').read_bytes())
        for arm in images:
            invoke(images[arm]['image_id'],scripts,bundle,['--fixtures','/bundle/'+arm,
                '--out','/bundle/'+arm+'-startup.json'],evidence/f'fixture-startup-{arm}.log',
                entry='python3',program='check_paired_fixture_startup.py')
            startup=json.loads((bundle/f'{arm}-startup.json').read_text())
            if startup.get('status')!='passed':raise RuntimeError('actual fixture startup/replay failed')
            if fixture_set(bundle/arm,images[arm],script_hashes)['manifest_sha256']!=sets[arm]['manifest_sha256']:
                raise RuntimeError('original fixture changed during startup preflight')
            status['steps'].append(arm+'-startup-replay-restart')
        status.update(status='prepared',common_corpus_sha256=common,
            fixture_manifests={arm:s['manifest_sha256'] for arm,s in sets.items()},images=images,
            scripts=script_hashes,jobstore_startup_replay='executed both images',
            byte_count=sum(p.stat().st_size for p in bundle.rglob('*') if p.is_file()))
    except BaseException as error:
        status.update(status='failed',error=type(error).__name__+': '+str(error));raise
    finally:
        receipt.write_text(json.dumps(status,indent=2)+'\n')

if __name__=='__main__':
    prepare(*(Path(p) for p in sys.argv[1:]))

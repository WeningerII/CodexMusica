#!/usr/bin/env python3
"""Run one same-host baseline/loaded/unloaded triplet with prebuilt pinned images.

No build, pull, retry, deployment or host-cache manipulation. Requires independent
review before execution. Each image starts a fresh 1 CPU / 2 GiB container.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import subprocess
import signal
import uuid
import sys
sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']


def docker_env():
    env = dict(os.environ)
    for key in ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'):
        env.pop(key, None)
    return env


def frozen_image(value):
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', value):
        raise ValueError('use the immutable local Docker image ID, never a mutable tag')
    return value


def command(image, scripts, output, cells, mode, arm, fixtures, container_name):
    return DOCKER + ['run', '--name', container_name, '--rm', '--pull=never', '--network=none', '--cpus=1',
        '--memory=2g', '--memory-swap=2g', '--pids-limit=256',
        '--mount', f'type=bind,src={scripts},dst=/app/scripts,readonly',
        '--mount', f'type=bind,src={output},dst=/evidence',
        '--mount', f'type=bind,src={fixtures},dst=/fixtures,readonly',
        '-e', 'PAIRED_CAPACITY_FIXTURES=/fixtures',
        '--workdir=/app', '--entrypoint=python3', frozen_image(image),
        '/app/scripts/paired_library_capacity_probe.py', f'--cells={cells}',
        f'--library-mode={mode}', f'--out=/evidence/{arm}.json']


def run_arm(argv, env, log, name):
    try:
        return subprocess.run(argv, env=env, stdout=log, stderr=subprocess.STDOUT,
                              timeout=60*60+120)
    finally:
        # A killed Docker client does not imply a stopped container. UUID names
        # belong only to this invocation, never to another owner's container.
        cleanup = subprocess.run(DOCKER + ['rm', '-f', name], env=env,
                                 capture_output=True, text=True, timeout=30)
        if cleanup.returncode and 'No such container' not in cleanup.stderr:
            raise RuntimeError('owned container cleanup failed: ' + cleanup.stderr)


def compare_searches(before, after):
    from paired_library_capacity_probe import SEARCH_QUERIES
    for phase, query in SEARCH_QUERIES.items():
        a = before['resident_runtime'][phase].get('search_result')
        b = after['resident_runtime'][phase].get('search_result')
        if (not a or not b or a.get('query') != query or a != b
                or not re.fullmatch(r'[0-9a-f]{64}', a.get('result_sha256', ''))):
            raise RuntimeError('paired search results differ or are missing: ' + phase)


def schedule(arms):
    # Every workload sees both complete orders on this SAME host.
    return [(rep, arm, image, mode) for rep, ordered in
            [(1, arms), (2, list(reversed(arms)))] for arm, image, mode in ordered]


def validate_preflight(record, images):
    # A reviewed external image-inventory receipt is a prerequisite, not a
    # claim this driver independently authenticates asset bytes.
    if record.get('status') != 'verified' or not record.get('reviewer') or not record.get('evidence_source'):
        raise RuntimeError('reviewed image/configuration preflight is required')
    for key in ('before', 'after'):
        if record.get(key, {}).get('image_id') != images[key]['image_id']:
            raise RuntimeError('preflight image mismatch')
        if record[key].get('source_sha') != images[key]['source_sha']:
            raise RuntimeError('preflight source mismatch')
    for field in ('assets_sha256', 'config_sha256', 'fixture_codec_sha256', 'node_version', 'python_version'):
        a, b = record['before'].get(field), record['after'].get(field)
        if not isinstance(a, str) or not a or a != b:
            raise RuntimeError('preflight equality missing or different: ' + field)
        if field.endswith('_sha256') and not re.fullmatch(r'[0-9a-f]{64}', a):
            raise RuntimeError('malformed preflight hash: ' + field)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--before-image', required=True, type=frozen_image)
    ap.add_argument('--after-image', required=True, type=frozen_image)
    ap.add_argument('--before-sha', required=True)
    ap.add_argument('--after-sha', required=True)
    ap.add_argument('--cells', required=True)
    ap.add_argument('--out', required=True, type=Path)
    ap.add_argument('--before-fixtures', required=True, type=Path)
    ap.add_argument('--after-fixtures', required=True, type=Path)
    ap.add_argument('--common-corpus', required=True, type=Path)
    ap.add_argument('--preflight', required=True, type=Path)
    ap.add_argument('--encoding-evidence', type=Path)
    ap.add_argument('--rebuild-evidence', type=Path)
    ap.add_argument('--candidate-first', action='store_true')
    args = ap.parse_args()
    from check_lyrics_capacity import parse_cells
    if len(parse_cells(args.cells)) < 2:
        ap.error('at least two declared cells are required for leak observations')
    if args.before_image == args.after_image:
        ap.error('before and after images must differ')
    for sha in (args.before_sha, args.after_sha):
        if not re.fullmatch(r'[0-9a-f]{40}', sha):
            ap.error('full source commits are required')
    from paired_library_capacity_probe import fixture_files
    from paired_fixture_validation import PROTOCOL, fixture_set, compare_sets, scripts_inventory
    fixtures = {'before': args.before_fixtures.resolve(), 'after': args.after_fixtures.resolve()}
    env = docker_env()
    images = {}
    for label, image, sha in [('before', args.before_image, args.before_sha),
                              ('after', args.after_image, args.after_sha)]:
        info = json.loads(subprocess.check_output(DOCKER + ['image', 'inspect', image], env=env))[0]
        config = dict(row.split('=', 1) for row in info['Config']['Env'])
        if info['Id'] != image or config.get('BUILD_GIT_COMMIT') != sha:
            raise RuntimeError(f'{label}: image/source identity mismatch')
        images[label] = {'image_id': image, 'source_sha': sha}
    preflight = json.loads(args.preflight.read_text())
    encoding_images = images
    rebuild_witnesses = None
    if args.encoding_evidence or args.rebuild_evidence:
        if not args.encoding_evidence or not args.rebuild_evidence:
            ap.error('both original encoding and current rebuild evidence are required')
        encoding_images = {arm: {'image_id':preflight[arm]['image_id'], 'source_sha':images[arm]['source_sha']} for arm in images}
        validate_preflight(preflight, encoding_images)
        from paired_rebuild_admission import admit
        rebuild_witnesses = admit(preflight, images, args.encoding_evidence, args.rebuild_evidence)
    else:
        validate_preflight(preflight, images)
    scripts = scripts_inventory(ROOT / 'scripts')
    sets = {key: fixture_set(fixtures[key], encoding_images[key], scripts) for key in images}
    if rebuild_witnesses and any(sets[key]['proof']['runtime_source_sha256'] != rebuild_witnesses[key]['instrumented_runtime_sha256'] for key in images):
        raise RuntimeError('encoding proof and reviewed rebuilt runtime fingerprints differ')
    common_identity = compare_sets(sets['before'], sets['after'], args.common_corpus.read_bytes())
    fixture_identity = {key: value['manifest_sha256'] for key, value in sets.items()}
    if preflight.get('fixture_protocol') != PROTOCOL or preflight.get('fixture_manifests') != fixture_identity or preflight.get('common_corpus_sha256') != common_identity:
        raise RuntimeError('independently reviewed v2 fixture evidence required')
    args.out.mkdir(parents=True, exist_ok=False)
    arms = [('before-loaded', args.before_image, 'loaded'),
            ('after-loaded', args.after_image, 'loaded'),
            ('after-unloaded', args.after_image, 'unloaded')]
    if args.candidate_first:
        arms.reverse()
    receipt = {'experiment_id': str(uuid.uuid4()), 'host': platform.uname()._asdict(),
               'fixture_protocol': PROTOCOL, 'fixture_manifests': fixture_identity,
               'common_corpus_sha256': common_identity, 'preflight': preflight,
               'encoding_images': encoding_images, 'rebuild_witnesses': rebuild_witnesses,
               'replications_per_cell': 2,
               'images': images, 'cells': args.cells, 'order': [{'replication': r, 'arm': a} for r,a,_,_ in schedule(arms)],
               'scripts_sha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                                  for p in sorted((ROOT / 'scripts').iterdir()) if p.is_file()},
               'scope': 'same-host diagnostic comparison; not official qualification', 'arms': []}
    receipt_path = args.out / 'pair.json'
    def interrupted(signum, _frame):
        raise SystemExit(f'measurement interrupted by signal {signum}')
    signal.signal(signal.SIGTERM, interrupted)
    for replication, base_arm, image, mode in schedule(arms):
        arm = f'r{replication}-' + base_arm
        receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
        name = 'capacity-pair-' + receipt['experiment_id'] + '-' + arm
        phase = 'precheck'
        measurement_invoked = False
        try:
            current = {key: fixture_set(fixtures[key], encoding_images[key], scripts_inventory(ROOT / 'scripts')) for key in images}
            if {key:value['manifest_sha256'] for key,value in current.items()} != fixture_identity:
                raise RuntimeError('derived fixtures changed between repetitions')
            if scripts_inventory(ROOT / 'scripts') != scripts:
                raise RuntimeError('measurement scripts changed')
            fixture_key = 'before' if base_arm == 'before-loaded' else 'after'
            with (args.out / f'{arm}.log').open('w') as log:
                phase = 'measurement'
                measurement_invoked = True
                result = run_arm(command(image, ROOT / 'scripts', args.out.resolve(), args.cells,
                                         mode, arm, fixtures[fixture_key], name), env, log, name)
        except BaseException as error:
            receipt['status'] = 'failed'
            receipt['arms'].append({'arm': arm, 'container_name': name,
                                    'status': 'failed', 'phase': phase,
                                    'measurement_invoked': measurement_invoked,
                                    'error': type(error).__name__ + ': ' + str(error)})
            receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
            raise
        receipt['arms'].append({'arm': arm, 'container_name': name, 'exit_code': result.returncode})
        receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
        if result.returncode:
            raise SystemExit('measurement failed; preserve receipt, no automatic retry')
    for replication in (1, 2):
        compare_searches(json.loads((args.out / f'r{replication}-before-loaded.json').read_text()),
                         json.loads((args.out / f'r{replication}-after-loaded.json').read_text()))
    receipt['search_results_equivalent'] = True
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')


if __name__ == '__main__':
    main()

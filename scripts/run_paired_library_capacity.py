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


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--before-image', required=True, type=frozen_image)
    ap.add_argument('--after-image', required=True, type=frozen_image)
    ap.add_argument('--before-sha', required=True)
    ap.add_argument('--after-sha', required=True)
    ap.add_argument('--cells', required=True)
    ap.add_argument('--out', required=True, type=Path)
    ap.add_argument('--fixtures', required=True, type=Path)
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
    fixtures = args.fixtures.resolve()
    fixture_identity = fixture_files(fixtures)
    env = docker_env()
    images = {}
    for label, image, sha in [('before', args.before_image, args.before_sha),
                              ('after', args.after_image, args.after_sha)]:
        info = json.loads(subprocess.check_output(DOCKER + ['image', 'inspect', image], env=env))[0]
        config = dict(row.split('=', 1) for row in info['Config']['Env'])
        if info['Id'] != image or config.get('BUILD_GIT_COMMIT') != sha:
            raise RuntimeError(f'{label}: image/source identity mismatch')
        images[label] = {'image_id': image, 'source_sha': sha}
    args.out.mkdir(parents=True, exist_ok=False)
    arms = [('before-loaded', args.before_image, 'loaded'),
            ('after-loaded', args.after_image, 'loaded'),
            ('after-unloaded', args.after_image, 'unloaded')]
    if args.candidate_first:
        arms.reverse()
    receipt = {'experiment_id': str(uuid.uuid4()), 'host': platform.uname()._asdict(),
               'fixture_sha256': fixture_identity,
               'images': images, 'cells': args.cells, 'order': [a[0] for a in arms],
               'scripts_sha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                                  for p in sorted((ROOT / 'scripts').iterdir()) if p.is_file()},
               'scope': 'same-host diagnostic comparison; not official qualification', 'arms': []}
    receipt_path = args.out / 'pair.json'
    def interrupted(signum, _frame):
        raise SystemExit(f'measurement interrupted by signal {signum}')
    signal.signal(signal.SIGTERM, interrupted)
    for arm, image, mode in arms:
        receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
        if fixture_files(fixtures) != fixture_identity:
            raise RuntimeError('shared fixtures changed between arms')
        name = 'capacity-pair-' + receipt['experiment_id'] + '-' + arm
        try:
            with (args.out / f'{arm}.log').open('w') as log:
                result = run_arm(command(image, ROOT / 'scripts', args.out.resolve(), args.cells,
                                         mode, arm, fixtures, name), env, log, name)
        except BaseException as error:
            receipt['arms'].append({'arm': arm, 'container_name': name,
                                    'error': type(error).__name__ + ': ' + str(error)})
            receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
            raise
        receipt['arms'].append({'arm': arm, 'container_name': name, 'exit_code': result.returncode})
        receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
        if result.returncode:
            raise SystemExit('measurement failed; preserve receipt, no automatic retry')
    compare_searches(json.loads((args.out / 'before-loaded.json').read_text()),
                     json.loads((args.out / 'after-loaded.json').read_text()))
    receipt['search_results_equivalent'] = True
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')


if __name__ == '__main__':
    main()

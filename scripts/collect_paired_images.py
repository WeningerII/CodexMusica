#!/usr/bin/env python3
"""Attempt both independent offline reads and retain failure evidence."""
import json
from pathlib import Path
import subprocess
import sys
import uuid
from paired_image_inventory import effective_config

SOURCES = {'before': '99c1586bfc994fd1b138632fe8c7845b40072142',
           'after': '960dd1820a643610ec69b782f4715821c1dcb6a8'}


def read_arm(arm, evidence, helper):
    status = {'status': 'failed', 'source_sha': SOURCES[arm]}
    name = '612-inventory-' + uuid.uuid4().hex
    try:
        info = json.loads((evidence / f'{arm}-image.json').read_text())[0]
        image = info['Id']
        status['image_id'] = image
        config = effective_config(info)
        (evidence / f'{arm}-effective-config.json').write_text(json.dumps(config, indent=2))
        with (evidence / f'{arm}-inventory.json').open('w') as out, \
                (evidence / f'{arm}-inventory.stderr').open('w') as err:
            result = subprocess.run(['docker', 'run', '--name', name, '--rm', '--pull=never',
                '--network=none', '--read-only', '--mount',
                f'type=bind,src={helper.resolve()},dst=/inventory.py,readonly',
                '--mount', f'type=bind,src={helper.resolve().parent},dst=/app/scripts,readonly',
                '--entrypoint', 'python3', image, '/inventory.py'],
                stdout=out, stderr=err, timeout=600)
        status['exit_code'] = result.returncode
        if result.returncode:
            raise ValueError('inventory process failed')
        row = json.loads((evidence / f'{arm}-inventory.json').read_text())
        required = ('assets', 'corpus_directory_present', 'configuration', 'fixture_dependencies',
                    'runtime_dependencies', 'runtime_source', 'runtime_inputs', 'generated_metadata', 'node_version', 'python_version', 'source_sha')
        if not isinstance(row, dict) or not all(k in row for k in required):
            raise ValueError('incomplete collector response')
        env = dict(s.split('=', 1) for s in info['Config']['Env'])
        if row['source_sha'] != SOURCES[arm] or any(
                env.get(k) != SOURCES[arm] for k in ('BUILD_GIT_COMMIT', 'RENDER_GIT_COMMIT')):
            raise ValueError('image source identity mismatch')
        status['status'] = 'read'
        return row, config, status
    except Exception as error:
        status['error'] = type(error).__name__ + ': ' + str(error)
        return None, None, status
    finally:
        try:
            cleanup = subprocess.run(['docker', 'rm', '-f', name], capture_output=True,
                                     text=True, timeout=30)
            if cleanup.returncode and 'No such container' not in cleanup.stderr:
                status.update(status='failed', cleanup_error=cleanup.stderr)
        except Exception as error:
            status.update(status='failed', cleanup_error=str(error))
        (evidence / f'{arm}-status.json').write_text(json.dumps(status, indent=2))


def collect(evidence, helper):
    rows = {arm: read_arm(arm, evidence, helper) for arm in SOURCES}
    result = {'status': 'unreviewed', 'measurements_run': False,
              'fixture_compatibility_verified': False,
              'arms': {arm: value[2] for arm, value in rows.items()}}
    failed = any(value[2]['status'] != 'read' for value in rows.values())
    if failed:
        result['status'] = 'failed'
    else:
        before, after = rows['before'][0], rows['after'][0]
        fields = ('assets', 'corpus_directory_present', 'configuration', 'fixture_dependencies',
                  'runtime_dependencies', 'runtime_inputs', 'node_version', 'python_version')
        result['differences'] = [f for f in fields if before[f] != after[f]]
        if rows['before'][1] != rows['after'][1]:
            result['differences'].append('effective_image_config')
        a, b = before['runtime_source']['files'], after['runtime_source']['files']
        result['source_delta'] = {p: {'before': a.get(p), 'after': b.get(p)}
                                  for p in sorted(a.keys() | b.keys()) if a.get(p) != b.get(p)}
        failed = bool(result['differences'])
    (evidence / 'comparison.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(collect(Path(sys.argv[1]), Path(sys.argv[2])))

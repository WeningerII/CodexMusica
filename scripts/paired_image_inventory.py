#!/usr/bin/env python3
"""Read actual image bytes for #612 review; never grant measurement acceptance."""
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def inventory(root, names):
    files = {}
    root = root.resolve()
    for name in names:
        path = root / name
        if not path.exists() or path.is_symlink() or not path.resolve().is_relative_to(root):
            raise ValueError('missing or unsafe inventory member: ' + name)
        entries = sorted(path.rglob('*')) if path.is_dir() else [path]
        if not entries:
            raise ValueError('empty inventory directory: ' + name)
        for item in entries:
            if item.is_symlink() or not item.resolve().is_relative_to(root):
                raise ValueError('unsafe inventory member: ' + str(item))
            if item.is_file():
                files[item.relative_to(root).as_posix()] = digest(item)
    if not files:
        raise ValueError('empty inventory')
    return {'files': files, 'sha256': hashlib.sha256(json.dumps(
        files, sort_keys=True, separators=(',', ':')).encode()).hexdigest()}


def collect(root):
    manifest = json.loads((root / 'lyric-harness/data/runtime_assets.json').read_text())
    names = ['lyric-harness/data/runtime_assets.json', 'library-data',
             'lyric-harness/library/snapshot']
    for asset in manifest['assets']:
        if asset['runtime'] is not True:
            continue
        if asset['decision'] != 'approved':
            raise ValueError('unapproved runtime asset: ' + asset['id'])
        if asset['base'] not in ('root', 'staged'):
            raise ValueError('unknown asset base: ' + asset['base'])
        base = 'lyric-harness/' if asset['base'] == 'root' else 'lyric-harness/data/'
        for item in asset['files']:
            rel = Path(item['path'])
            if rel.is_absolute() or '..' in rel.parts:
                raise ValueError('unsafe asset manifest path')
            names.append(base + str(rel))
    codec = ['mcp/' + name for name in (
        'state_codec.js', 'payload_limits.js', 'contract_version.js', 'schemas.js',
        'lyric_tools.js', 'job_store.js', 'package-lock.json')]
    baked = json.loads((root / 'mcp/build_identity.json').read_text())
    if baked['commit'] != os.environ['BUILD_GIT_COMMIT']:
        raise ValueError('baked and environment commit differ')
    return {'status': 'unreviewed', 'source_sha': baked['commit'], 'baked': baked,
            'node_version': subprocess.check_output(['node', '--version'], text=True).strip(),
            'python_version': platform.python_version(),
            'assets': inventory(root, names),
            'configuration': inventory(root, ['mcp/production-config.json']),
            'fixture_dependencies': inventory(root, codec),
            'scope': 'actual byte inventory; not fixture compatibility or acceptance'}


if __name__ == '__main__':
    print(json.dumps(collect(Path('/app')), sort_keys=True))

#!/usr/bin/env python3
"""Read actual image bytes for #612 review; never grant measurement acceptance."""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import subprocess
import shutil
import sys
import stat


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def inventory(root, names, allow_links=False):
    files = {}
    links = {}
    directories = set()
    root = root.resolve()
    for name in names:
        path = root / name
        if not path.exists() or (path.is_symlink() and not allow_links) or not path.resolve().is_relative_to(root):
            raise ValueError('missing or unsafe inventory member: ' + name)
        entries = sorted(path.rglob('*')) if path.is_dir() else [path]
        if path.is_dir() and not any(p.is_file() and not p.is_symlink() for p in entries):
            raise ValueError('no regular files in required directory: ' + name)
        for item in entries:
            relative = item.relative_to(root).as_posix()
            if not item.resolve().is_relative_to(root):
                raise ValueError('unsafe inventory member: ' + str(item))
            if item.is_symlink():
                if not allow_links or not item.exists():
                    raise ValueError('unsafe inventory link: ' + str(item))
                links[relative] = os.readlink(item)
                if item.is_file():
                    files[relative] = digest(item)
                continue
            if not (stat.S_ISREG(item.stat().st_mode) or item.is_dir()):
                raise ValueError('special inventory entry: ' + str(item))
            if item.is_dir():
                directories.add(relative)
            if item.is_file():
                files[relative] = digest(item)
    if not files:
        raise ValueError('empty inventory')
    record = {'files': files, 'links': links, 'directories': sorted(directories)}
    return dict(record, sha256=hashlib.sha256(json.dumps(
        record, sort_keys=True, separators=(',', ':')).encode()).hexdigest())


def effective_config(inspect):
    # Keep every field and environment entry except the two explicitly different
    # source labels, which are checked independently against pinned source SHAs.
    config = dict(inspect['Config'])
    config['Env'] = sorted(row for row in config.get('Env', [])
                           if row.split('=', 1)[0] not in ('BUILD_GIT_COMMIT', 'RENDER_GIT_COMMIT'))
    return {'Config': config, 'Os': inspect['Os'], 'Architecture': inspect['Architecture'],
            'Variant': inspect.get('Variant')}


def dependencies(root):
    python = []
    for dist in importlib.metadata.distributions():
        if dist.files is None:
            raise ValueError('Python distribution has no file inventory: ' + dist.metadata['Name'])
        names = [str(Path(dist.locate_file(p)).absolute().relative_to('/')) for p in dist.files]
        python.append({'name': dist.metadata['Name'], 'version': dist.version,
                       'inventory': inventory(Path('/'), names, allow_links=True)})
    python.sort(key=lambda row: (row['name'], row['version']))
    os_packages = subprocess.check_output(['dpkg-query', '-W',
        '-f=${Package}\t${Version}\t${Architecture}\t${db:Status-Status}\n'], text=True)
    # Versions alone miss modified installed files. Preserve actual SHA256s and
    # explicit missing paths from the package manager's shipped-file manifests.
    os_files, missing = {}, []
    for manifest in sorted(Path('/var/lib/dpkg/info').glob('*.md5sums')):
        for line in manifest.read_text().splitlines():
            _, name = line.split(None, 1)
            name = name.lstrip('./')
            path = Path('/') / name
            if path.is_file():
                os_files[name] = {'sha256': digest(path),
                                  'link': os.readlink(path) if path.is_symlink() else None}
            else:
                missing.append(name)
    binaries = [str(Path(shutil.which('node')).resolve()).lstrip('/'),
                str(Path(sys.executable).resolve()).lstrip('/')]
    return {'os_packages': sorted(os_packages.splitlines()),
            'os_packaged_files': os_files, 'os_missing_packaged_files': sorted(set(missing)),
            'python_distributions': python,
            'node_modules': inventory(root, ['mcp/node_modules'], allow_links=True),
            'runtime_binaries': inventory(Path('/'), binaries),
            'python_build': sys.version}


def collect(root):
    manifest = json.loads((root / 'lyric-harness/data/runtime_assets.json').read_text())
    if not isinstance(manifest, dict) or not isinstance(manifest.get('assets'), list) or not manifest['assets']:
        raise ValueError('malformed runtime asset manifest')
    names = ['lyric-harness/data', 'library-data',
             'lyric-harness/library/snapshot']
    # Explicit presence plus full membership catches undeclared staged/corpus data.
    corpus = root / 'lyric-harness/corpus'
    corpus_presence = corpus.exists()
    if corpus_presence:
        names.append('lyric-harness/corpus')
    # Include undeclared non-code assets anywhere in the shipped harness, not
    # just known data roots. Runtime Python source/bytecode belongs to code
    # provenance, not asset equality; candidate source intentionally differs.
    for item in (root / 'lyric-harness').rglob('*'):
        if item.is_symlink():
            raise ValueError('unexpected shipped harness symlink: ' + str(item))
        if item.is_file() and item.suffix not in ('.py', '.pyc'):
            names.append(item.relative_to(root).as_posix())
    for asset in manifest['assets']:
        if not isinstance(asset, dict) or type(asset.get('runtime')) is not bool:
            raise ValueError('malformed runtime asset entry')
        if asset['runtime'] is not True:
            continue
        if asset['decision'] != 'approved':
            raise ValueError('unapproved runtime asset: ' + asset['id'])
        if asset['base'] not in ('root', 'staged'):
            raise ValueError('unknown asset base: ' + asset['base'])
        if not isinstance(asset.get('files'), list) or not asset['files']:
            raise ValueError('missing runtime asset files')
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
            'corpus_directory_present': corpus_presence,
            'runtime_dependencies': dependencies(root),
            'runtime_source': inventory(root, [p.relative_to(root).as_posix()
                for directory in ('mcp', 'scripts', 'lyric-harness')
                for p in (root / directory).rglob('*')
                if p.is_file() and p.suffix in ('.js', '.mjs', '.py')
                and 'node_modules' not in p.parts]),
            'configuration': inventory(root, ['mcp/production-config.json']),
            'fixture_dependencies': inventory(root, codec),
            'scope': 'actual byte inventory; not fixture compatibility or acceptance'}


if __name__ == '__main__':
    print(json.dumps(collect(Path('/app')), sort_keys=True))

"""Validate v2 derived fixtures before measurement; never grant review approval."""
import base64
import gzip
import hashlib
import json
import io
import re
import time
from pathlib import Path
from paired_library_capacity_probe import fixture_files

PROTOCOL = 'paired-decoded-fixtures-v2'
def digest(value):
    return hashlib.sha256(value).hexdigest()

def scripts_inventory(root):
    files = {}
    for p in sorted(root.rglob('*')):
        if p.is_symlink():
            raise RuntimeError('script tree contains symlink')
        if p.is_file():
            files[p.relative_to(root).as_posix()] = digest(p.read_bytes())
    return files

def fixture_set(root, image, scripts):
    files = fixture_files(root)
    manifest_bytes = (root / 'manifest.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    proof = json.loads((root / 'encoding-proof.json').read_text())
    if not re.fullmatch('[a-f0-9]{64}', proof.get('semantic_identity', '')):
        raise RuntimeError('malformed semantic identity')
    if not re.fullmatch('[a-f0-9]{64}', proof.get('runtime_source_sha256', '')):
        raise RuntimeError('missing actual instrumented runtime identity')
    for name in files:
        if name.startswith('jobs/'):
            p = root / name
            if p.stat().st_mode & 0o077 or (root / 'jobs').stat().st_mode & 0o077:
                raise RuntimeError('JobStore fixture permissions differ')
            record = json.loads(p.read_text())
            # Preserve the actual default TTL; leave one full arm timeout before
            # expiry. Actual startup/replay remains an independent execution gate.
            if record.get('state') != 'completed' or time.time()*1000 - record['updated_at'] >= (24*60*60-3720)*1000:
                raise RuntimeError('JobStore fixture lacks safe remaining TTL')
    for record in (manifest, proof):
        if record.get('protocol') != PROTOCOL or any(record.get(k) != image[k] for k in ('image_id', 'source_sha')):
            raise RuntimeError('fixture image/source/protocol mismatch')
    if proof.get('scripts') != scripts:
        raise RuntimeError('preparation and measurement script trees differ')
    if manifest.get('common_sha256') != proof.get('common_sha256'):
        raise RuntimeError('common corpus binding differs')
    prepared = (root / 'prepared-runs.json').read_bytes()
    if proof.get('prepared_sha256') != digest(prepared) or (root / 'prepared-runs.json.sha256').read_text().strip() != digest(prepared):
        raise RuntimeError('prepared bytes binding differs')
    return {'files': files, 'manifest_sha256': digest(manifest_bytes), 'proof': proof,
            'prepared': json.loads(prepared)}

def compare_sets(before, after, common_bytes):
    common = json.loads(common_bytes)
    common_sha = digest(common_bytes)
    if common.get('protocol') != PROTOCOL:
        raise RuntimeError('wrong decoded corpus protocol')
    rows = common['records']
    jobs = lambda s: {p: h for p, h in s['files'].items() if p == 'receipts.json' or p.startswith('jobs/')}
    if not jobs(before) or jobs(before) != jobs(after):
        raise RuntimeError('JobStore fixture bytes differ')
    for arm in (before, after):
        proof = arm['proof']
        if proof['common_sha256'] != common_sha or proof.get('common_files', {}).get('common.json') != common_sha:
            raise RuntimeError('derived set names different common corpus')
        if any(proof['common_files'].get(p) != h for p, h in jobs(arm).items()):
            raise RuntimeError('JobStore bytes differ from common fixture')
        if len(arm['prepared']['records']) != len(rows) or len(rows) != common['bounds']['count']:
            raise RuntimeError('derived fixture count differs')
        if any(arm['prepared'].get(k) != common['bounds'][k] for k in ('maxLines', 'maxChars')):
            raise RuntimeError('derived schema maxima differ')
        evidence = proof.get('evidence', [])
        if len(evidence) != 2 * len(rows):
            raise RuntimeError('missing genuine codec evidence')
        for i, row in enumerate(rows):
            encoded = arm['prepared']['records'][i]
            if {k:v for k,v in encoded.items() if k not in ('state','checkpoint')} != {k:v for k,v in row.items() if k not in ('state','checkpoint')}:
                raise RuntimeError('derived record content differs')
            for n, field in enumerate(('state', 'checkpoint')):
                wire = encoded[field]
                envelope = json.loads(wire)
                if envelope['semantic_identity'] != proof['semantic_identity']:
                    raise RuntimeError('unbound semantic identity')
                with gzip.GzipFile(fileobj=io.BytesIO(base64.b64decode(envelope['payload'], validate=True))) as stream:
                    payload = stream.read(common['bounds']['decoded'] + 1)
                expected = json.dumps(row[field], ensure_ascii=False, separators=(',', ':')).encode()
                e = evidence[2*i+n]
                if payload != expected or envelope['sha256'] != digest(payload) or envelope['decoded_bytes'] != len(payload):
                    raise RuntimeError('decoded payload bytes differ')
                if e.get('decoded_sha256') != digest(payload) or e.get('wire_sha256') != digest(wire.encode()) or e.get('key') != row['key'] or e.get('field') != field:
                    raise RuntimeError('codec evidence differs')
                if e.get('wire_bytes') != len(wire.encode()) or e.get('serialized_wire_bytes') != len(json.dumps(wire, ensure_ascii=False, separators=(',', ':')).encode()):
                    raise RuntimeError('encoded size evidence differs')
    for i in range(len(rows)):
        for field in ('state', 'checkpoint'):
            a = before['prepared']['records'][i][field]
            b = after['prepared']['records'][i][field]
            x, y = json.loads(a), json.loads(b)
            x.pop('semantic_identity'); y.pop('semantic_identity')
            if x != y or len(a.encode()) != len(b.encode()):
                raise RuntimeError('unexpected envelope/length difference')
    if {k:v for k,v in before['prepared'].items() if k != 'records'} != {k:v for k,v in after['prepared'].items() if k != 'records'}:
        raise RuntimeError('prepared bounds metadata differs')
    return common_sha

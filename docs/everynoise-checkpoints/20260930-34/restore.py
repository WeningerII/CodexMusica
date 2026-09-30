import base64, hashlib, io, json, pathlib, sys, tarfile
here = pathlib.Path(__file__).resolve().parent
index = json.loads((here / 'index.json').read_text())
encoded = ''.join((here / name).read_text() for name in index['base64_parts'])
raw = base64.b64decode(encoded, validate=True)
assert hashlib.sha256(raw).hexdigest() == index['archive_sha256'], 'archive hash mismatch'
dest = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/codexmusica-checkpoint').resolve()
dest.mkdir(parents=True, exist_ok=True)
with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as archive:
    for member in archive.getmembers():
        target = (dest / member.name).resolve()
        assert target.is_relative_to(dest), 'unsafe archive member'
        assert not member.issym() and not member.islnk(), 'unexpected archive link'
    archive.extractall(dest, filter='data')
print('Verified source checkpoint extracted to', dest)
print('Read', dest / 'payload/checkpoint.json', 'before applying; this is not a completed merge.')

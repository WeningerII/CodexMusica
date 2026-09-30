import pathlib,json,base64,hashlib,zipfile,io,sys
here=pathlib.Path(__file__).resolve().parent
index=json.loads((here/'index.json').read_text())
raw=base64.b64decode(''.join((here/n).read_text() for n in index['base64_parts']),validate=True)
assert hashlib.sha256(raw).hexdigest()==index['archive_sha256']
dest=pathlib.Path(sys.argv[1]).resolve();dest.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(io.BytesIO(raw)) as z:
 for n in z.namelist():
  target=(dest/n).resolve();assert target.is_relative_to(dest) and len(pathlib.PurePosixPath(n).parts)==1
  b=z.read(n);assert hashlib.sha256(b).hexdigest()==index['file_sha256'][n];target.write_bytes(b)
print('Verified 100-entry incremental data-only source checkpoint:',dest)
print('Read README.txt before applying. No build, PR or merge completion is claimed.')

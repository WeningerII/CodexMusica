"""Bounded new synthetic-fixture transfer only, never image archives."""
import hashlib
import json
from pathlib import Path
import shutil
import tarfile
import sys

MAX_ARCHIVE=1024**3
MAX_EXPANDED=2*1024**3
MAX_FILES=4096
class CappedWriter:
    def __init__(self, target):
        self.target=target
        self.written=0
    def write(self, data):
        if self.written+len(data)>MAX_ARCHIVE:
            raise ValueError('compressed fixture budget exceeded during write')
        result=self.target.write(data);self.written+=result;return result
    def tell(self):return self.written
    def flush(self):return self.target.flush()

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    return h.hexdigest()

def pack(root, archive):
    files=[]
    for p in root.rglob('*'):
        if p.is_symlink() or not (p.is_file() or p.is_dir()):raise ValueError('nonregular fixture entry')
        if p.is_file():files.append(p)
    if len(files)>MAX_FILES or sum(p.stat().st_size for p in files)>MAX_EXPANDED:raise ValueError('expanded fixture budget exceeded')
    if shutil.disk_usage(archive.parent).free < MAX_ARCHIVE+1024**3:raise ValueError('insufficient archive headroom')
    with archive.open('xb') as target:
        with tarfile.open(fileobj=CappedWriter(target),mode='w|gz') as tar:
            for p in sorted(files):tar.add(p,arcname=p.relative_to(root).as_posix(),recursive=False)
    if archive.stat().st_size>MAX_ARCHIVE:raise ValueError('compressed fixture budget exceeded; do not upload')
    receipt={'status':'unreviewed','archive_sha256':sha(archive),'compressed_bytes':archive.stat().st_size,
        'expanded_bytes':sum(p.stat().st_size for p in files),'files':{p.relative_to(root).as_posix():sha(p) for p in sorted(files)}}
    archive.with_suffix('.receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    return receipt

def unpack(archive, root, expected):
    if archive.stat().st_size>MAX_ARCHIVE or sha(archive)!=expected:raise ValueError('fixture archive size/hash mismatch')
    if shutil.disk_usage(root.parent).free<MAX_EXPANDED+1024**3:raise ValueError('insufficient extraction headroom')
    with tarfile.open(archive,'r|gz') as tar:
        seen=set();expanded=0
        root.mkdir(mode=0o700)
        for member in tar:
            expanded+=member.size
            if len(seen)+1>MAX_FILES or expanded>MAX_EXPANDED:raise ValueError('expanded budget exceeded')
            p=Path(member.name)
            if not member.isfile() or member.issparse() or p.is_absolute() or '..' in p.parts or member.name in seen:
                raise ValueError('unsafe fixture archive member')
            seen.add(member.name)
            p=root/member.name;p.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
            with tar.extractfile(member) as source,p.open('xb') as dest:shutil.copyfileobj(source,dest)
            p.chmod(0o600)
    return {p.relative_to(root).as_posix():sha(p) for p in root.rglob('*') if p.is_file()}

if __name__=='__main__':
    mode,*args=sys.argv[1:]
    if mode=='pack':print(json.dumps(pack(Path(args[0]),Path(args[1]))))
    elif mode=='unpack':print(json.dumps({'files':unpack(Path(args[0]),Path(args[1]),args[2])}))
    else:raise SystemExit('expected pack or unpack')

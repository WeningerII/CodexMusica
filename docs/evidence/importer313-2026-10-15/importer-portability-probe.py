import hashlib, importlib.util, json, sys
from pathlib import Path
path = Path(sys.argv[1]).resolve()
spec = importlib.util.spec_from_file_location('importer_probe', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
files, summary = module.build()
changed = []
for p, text in files.items():
    if p.read_bytes() != text.encode('utf-8'):
        before, after = json.loads(p.read_text()), json.loads(text)
        changed.append({'path': str(p.relative_to(module.ROOT)),
                        'changed_keys': [k for k in before if before[k] != after[k]],
                        'before_deduplication': before.get('deduplication'),
                        'after_deduplication': after.get('deduplication')})
hashes = {str(p.relative_to(module.ROOT)): hashlib.sha256(t.encode()).hexdigest() for p,t in files.items()}
print(json.dumps({'python': sys.version, 'file_count': len(files), 'changed': changed,
                  'committed_sha256': hashlib.sha256(json.dumps({str(p.relative_to(module.ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}, sort_keys=True).encode()).hexdigest(),
                  'generated_sha256': hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest(),
                  'summary': summary}, indent=2))

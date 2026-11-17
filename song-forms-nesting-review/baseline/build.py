"""Compile the source rows and hand-checked structures into the browser catalog."""
import collections
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata

catalog_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("english-forms.md")
models = {}
for path in sorted(Path("models").glob("*.json")):
    entries = json.loads(path.read_text())
    assert not set(entries).intersection(models), path
    models.update(entries)

def validate(node):
    if isinstance(node, str):
        assert node.strip()
        return
    assert node["label"].strip() and node["children"]
    for child in node["children"]:
        validate(child)

def slug(name):
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub("[^a-z0-9]+", "-", ascii_name.lower()).strip("-")

rows = []
section = None
for line_number, line in enumerate(catalog_path.read_text().splitlines(), 1):
    if line.startswith("## "):
        heading = re.match(r"## ([A-E])\. ", line)
        section = heading.group(1) if heading else None
    if not section or not line.startswith("| ") or line.startswith("| Form |"):
        continue
    title, aliases, definition, length, roles = [cell.strip() for cell in line.strip("|").split("|")]
    model = models[title]
    assert model["mode"] in ("Rule", "Pattern", "Example") and model["tree"]
    for node in model["tree"]:
        validate(node)
    assert all(target in models and target != title for target in model.get("related", []))
    rows.append(dict(id=slug(title),name=title,family=section,aliases=aliases,shape=definition,length=length,roles=roles,
                     line=line_number,**model))
assert {row["name"] for row in rows} == models.keys()
assert len({row["id"] for row in rows}) == len(rows) == len(models)
Path("dist/catalog.js").write_text("const FORMS = " + json.dumps(rows, ensure_ascii=False, separators=(",",":")) + ";\n")
print(f"{len(rows)} rows", dict(collections.Counter(r['family'] for r in rows)), dict(collections.Counter(r['mode'] for r in rows)))
print("Source SHA256", hashlib.sha256(catalog_path.read_bytes()).hexdigest())


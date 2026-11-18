"""Build the offline review explorer from the posted inventory and reviewed records."""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def load(relative):
    return json.loads((ROOT / relative).read_text())

def parse_catalog(path):
    group = None
    for line_number, line in enumerate(path.read_text().splitlines(), 1):
        if line.startswith("## "):
            match = re.match(r"## ([A-E])\. ", line)
            group = match[1] if match else None
        if group and line.startswith("| ") and not line.startswith("| Form |"):
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            assert len(cells) == 5, (line_number, cells)
            yield group, line_number, cells

def validate_tree(node):
    if isinstance(node, str):
        assert node.strip()
    else:
        assert node["label"].strip() and node["children"]
        for child in node["children"]:
            validate_tree(child)

def slug(name):
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub("[^a-z0-9]+", "-", normalized.lower()).strip("-")

def build(source):
    models, reviews = {}, {}
    for path in sorted((ROOT / "models").glob("*.json")):
        segment = json.loads(path.read_text())
        audit = load(Path("audit") / path.name)
        assert segment.keys() == audit.keys() and not models.keys() & segment.keys()
        models.update(segment)
        reviews.update(audit)
    internal = load("comparison/title-map.json")
    public = {old: new for new, old in internal.items()}
    aliases = load("comparison/alias-overrides.json")
    discovery = load("comparison/search-terms.json")
    original_lines = {cells[0]: number for _, number, cells in parse_catalog(ROOT / "english-forms.md")}
    data = []
    for family, _, cells in parse_catalog(source):
        title = internal.get(cells[0], cells[0])
        model, review = models[title], reviews[title]
        assert model["mode"] in {"Example", "Pattern", "Rule"} and model["tree"]
        for node in model["tree"]:
            validate_tree(node)
        assert review["status"] in {"supported", "partial", "contested", "unresolved"}
        rendered_edges = []
        for edge in review["edges"]:
            assert edge["target"] in models and edge["target"] != title and edge["evidence"].strip()
            if edge["status"] == "supported":
                rendered_edges.append(dict(target=public.get(edge["target"], edge["target"]),
                    kind=edge["kind"], status=edge["status"], refs=edge.get("refs", []), evidence=edge["evidence"]))
        related = [public.get(t, t) for t in model.get("related", [])]
        assert set(related) == {e["target"] for e in rendered_edges}
        # The raw source prose, alias evidence and proposed planner roles remain research provenance.
        # Search and display share only reviewed headings, alternate names, trees and discovery terms.
        data.append(dict(name=public.get(title,title), id=slug(title), family=family, line=original_lines[title],
            aliases=aliases.get(title,{}).get("aliases", cells[1]), search_terms=discovery.get(title, []),
            mode=model["mode"], tree=model["tree"], related=related,
            review=dict(status=review["status"], note=review["note"], refs=review.get("attested_refs",[]),
                        edges=rendered_edges)))
    assert len(data) == len({row["id"] for row in data}) == len(models) == 364
    assert len({row["name"] for row in data}) == 364
    assert set(aliases) <= models.keys() and set(discovery) <= models.keys()
    return "const FORMS = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"

if __name__ == "__main__":
    source = Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/"comparison/r2-post.md"
    (ROOT/"dist/catalog.js").write_text(build(source))


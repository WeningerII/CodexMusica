"""Build the offline review explorer from the posted inventory and reviewed records."""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from evidence import CATALOG, DIRECT, INDIRECT, reviewed

def load(relative):
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))

def parse_catalog(path):
    group = None
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.startswith("## "):
            match = re.match(r"## ([A-E])\. ", line)
            group = match[1] if match else None
        if group and line.startswith("| ") and not line.startswith("| Form |"):
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            assert len(cells) == 5, (line_number, cells)
            yield group, line_number, cells

def public_label(value):
    # Reviewed terminology may include punctuation and rhyme symbols, but never links or markup.
    if not isinstance(value, str) or not value.strip() or "\n" in value or re.search(
        r"(?:[a-z][a-z0-9+.-]*://|\b(?:www\.|mailto:|javascript:|data:)|<[/!a-z]|\]\()", value, re.I
    ):
        raise ValueError("Expected a plain structural label")
    return value


def diagram_node(node):
    if isinstance(node, str):
        return public_label(node)
    if not isinstance(node, dict) or not isinstance(node.get("children"), list) or not node["children"]:
        raise ValueError("Expected a diagram group with children")
    # Build a new record so extra research fields on a node cannot become browser data.
    return {"label": public_label(node["label"]), "children": [diagram_node(n) for n in node["children"]]}


def node_paths(nodes, prefix=""):
    for index, node in enumerate(nodes, 1):
        path = prefix + str(index)
        yield path
        if isinstance(node, dict):
            yield from node_paths(node["children"], path + ".")


def choice(value, allowed):
    if value not in allowed:
        raise ValueError("Unknown value in a public catalog field")
    return value


def slug(name):
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub("[^a-z0-9]+", "-", normalized.lower()).strip("-")

def public_forms(source):
    """Return the closed explorer projection. Research notes and citations have no public fields."""
    models, reviews = {}, {}
    for path in sorted((ROOT / "models").glob("*.json")):
        segment = load(path)
        audit = load(Path("audit") / path.name)
        assert segment.keys() == audit.keys() and not models.keys() & segment.keys()
        models.update(segment)
        reviews.update(audit)

    vocabulary = load("public-vocabulary.json")
    titles = vocabulary["titles"]
    internal = {public: old for old, public in titles.items()}
    for field in ("titles", "aliases", "discovery"):
        assert vocabulary[field].keys() <= models.keys()

    records = []
    for family, _, cells in parse_catalog(source):
        title = internal.get(cells[0], cells[0])
        model, review = models[title], reviewed(title, reviews[title])
        tree = [diagram_node(n) for n in model["tree"]]
        assert tree
        valid_paths = set(node_paths(tree))
        edges = []
        for edge in review["edges"]:
            if edge["status"] != "supported":
                continue
            target = edge["target"]
            assert target in models and target != title
            paths = edge.get("scope_paths", [])
            assert isinstance(paths, list) and set(paths) <= valid_paths
            edges.append({
                "target": titles.get(target, target),
                "kind": choice(edge["kind"], {"variant", "contains", "shares-feature", "comparison", "other"}),
                "basis": choice(edge["basis"], {DIRECT, INDIRECT, CATALOG}),
                "scope_paths": paths,
            })
        related = [titles.get(t, t) for t in model.get("related", [])]
        assert set(related) == {e["target"] for e in edges}
        records.append({
            "name": public_label(titles.get(title, title)), "id": slug(title), "family": family,
            "aliases": [public_label(x) for x in vocabulary["aliases"].get(title, [])],
            "search_terms": [public_label(x) for x in vocabulary["discovery"].get(title, [])],
            "mode": choice(model["mode"], {"Example", "Pattern", "Rule"}), "tree": tree, "related": related,
            "review": {"status": choice(review["status"], {"supported", "partial", "contested", "unresolved"}),
                       "basis": choice(review["basis"], {DIRECT, INDIRECT, CATALOG}), "edges": edges},
        })
    assert len(records) == len({r["id"] for r in records}) == len({r["name"] for r in records}) == len(models) == 364
    return records


def build(source):
    return "const FORMS = " + json.dumps(public_forms(source), ensure_ascii=False, separators=(",", ":")) + ";\n"


if __name__ == "__main__":
    source = Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/"comparison/r2-post.md"
    (ROOT/"dist/catalog.js").write_text(build(source), encoding="utf-8")


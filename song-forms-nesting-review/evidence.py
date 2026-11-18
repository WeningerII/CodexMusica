"""Join claim-specific reading receipts to reviewed forms and relationships."""
from collections import defaultdict
from functools import lru_cache
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIRECT = "passage checked for stated scope"
INDIRECT = "reference recorded; passage unverified"
CATALOG = "catalog and model only"

def read(name):
    return json.loads((ROOT / "comparison" / name).read_text(encoding="utf-8"))

@lru_cache(maxsize=1)
def evidence_index():
    index = defaultdict(list)
    for name in ("rechecked-sources.json", "andrej-evidence.json"):
        for record in read(name)["claims"]:
            assert record["form"] and record["url"].startswith(("https://", "http://"))
            assert record["checked_on"] and record["access"]
            if record["access"] == "direct":
                assert record["locator"].strip() and record["passage"].strip(), record
            index[(record["form"], record.get("target") or "")].append(record)
    return index

@lru_cache(maxsize=1)
def statuses():
    return read("andrej-status.json")

def classify(form, target, original_refs):
    receipts = evidence_index().get((form, target), [])
    corroborated = list(dict.fromkeys(r["url"] for r in receipts if r["access"] == "direct"))
    # Cited passages and unverified bibliography have separate UI labels.
    refs = list(dict.fromkeys([*corroborated, *original_refs]))
    return (DIRECT if corroborated else INDIRECT if refs else CATALOG), refs, corroborated

def reviewed(title, raw):
    record = dict(raw)
    scope = statuses()[title]
    record.update(status=scope["status"], note=scope["note"])
    record["basis"], cited, checked = classify(title, "", raw.get("attested_refs", []))
    record["attested_refs"] = checked if checked else cited
    bibliography = list(dict.fromkeys([*raw.get("refs", []), *cited]))
    edges = []
    for item in raw["edges"]:
        edge = dict(item)
        edge["basis"], cited, checked = classify(title, edge["target"], item.get("refs", []))
        # Direct reading links can coexist with contextual references in the research bibliography.
        edge["refs"] = checked if checked else cited
        bibliography.extend(cited)
        edges.append(edge)
    record.update(edges=edges, refs=list(dict.fromkeys(bibliography)))
    return record

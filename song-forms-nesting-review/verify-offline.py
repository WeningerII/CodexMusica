#!/usr/bin/env python3
"""Verify the released figures and rebuild the seven derived products in isolation."""
import argparse
from collections import Counter
import csv
from hashlib import sha256
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


OUTPUTS = (
    "coverage.tsv", "relationships.tsv", "coverage-summary.json", "model-changes.json",
    "model-unit-crosswalk.tsv", "comparison/r2-row-diff.tsv", "dist/catalog.js",
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def obj(path):
    return json.loads(path.read_text(encoding="utf-8"))


def rows(path):
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def file_hashes(folder):
    return {p.relative_to(folder): sha256(p.read_bytes()).hexdigest()
            for p in folder.rglob("*") if p.is_file()}


def public_rows(package):
    script = (package / "dist/catalog.js").read_text(encoding="utf-8")
    require(script.startswith("const FORMS = ") and script.endswith(";\n"), "Catalog wrapper changed")
    return json.loads(script[len("const FORMS = "):-2])


def headline_checks(package):
    summary = obj(package / "coverage-summary.json")
    snapshot = obj(package / "comparison/reviewed-headlines.json")
    require(summary == snapshot["summary"], "Published summary differs from reviewed snapshot")
    docs = snapshot["documentation"]
    require({"README.md", "validation.md"} <= docs.keys(), "Missing headline document")
    for relative, fragments in docs.items():
        require(fragments and isinstance(fragments, list), "No expected passages for " + relative)
        require(any(any(c.isdigit() for c in fragment) for fragment in fragments),
                "Expected a numerical headline in " + relative)
        content = (package / relative).read_text(encoding="utf-8")
        for fragment in fragments:
            require(isinstance(fragment, str) and fragment.strip() and content.count(fragment) == 1,
                    f"Missing or non-unique reviewed passage in {relative}: {fragment!r}")

    forms = rows(package / "coverage.tsv")
    links = rows(package / "relationships.tsv")
    accepted = [e for e in links if e["verdict"] == "supported"]
    changes = obj(package / "model-changes.json")
    projected = public_rows(package)
    pending = [node for row in projected for node in row["tree"]]
    nodes = 0
    while pending:
        node = pending.pop()
        nodes += 1
        if isinstance(node, dict):
            pending.extend(node["children"])
    census = {
        "diagram_nodes": nodes,
        "candidate_relationships": len(links),
        "source_rows": len(forms),
        "row_counts": Counter(f["group"] for f in forms),
        "status": Counter(f["review_status"] for f in forms),
        "entry_evidence": Counter(f["review_status"] + " | " + f["evidence_basis"] for f in forms),
        "changed_models": sum(f["changed_fields"] != "unchanged" for f in forms),
        "fields_changed": Counter(k for change in changes for k in change["changes"]),
        "edge_verdicts": Counter(e["verdict"] for e in links),
        "edge_changes": Counter(e["change"] for e in links),
        "supported_kinds": Counter(e["kind"] for e in accepted),
        "supported_edge_evidence": Counter(e["evidence_basis"] for e in accepted),
        "unit_node_matches": len(rows(package / "model-unit-crosswalk.tsv")),
        "distinct_bibliography_urls": len({url for f in forms for url in f["review_bibliography"].split()}),
    }
    for field, count in census.items():
        require(count == summary[field], f"Row tally differs from summary.{field}")
    require(sum(int(f["supported_edges"]) for f in forms) == len(accepted), "Outgoing total differs")
    require(all(e["evidence_basis"].startswith("decision basis: ") for e in links if e["verdict"] != "supported"),
            "An archived decision has an unlabeled basis")
    form_to_public = {old: new for new, old in obj(package / "comparison/title-map.json").items()}
    public = {row["name"]: row for row in projected}
    require(len(public) == len(forms), "Public catalog length differs from reviewed forms")
    projected_edges = {}
    for form in forms:
        title = form_to_public.get(form["form"], form["form"])
        record = public[title]
        require((record["review"]["status"], record["review"]["basis"]) ==
                (form["review_status"], form["evidence_basis"]), "Public evidence differs for " + title)
        require(record["review"]["refs"] == form["attested_references"].split(), "Entry references differ for " + title)
        require(record["related"] == list(dict.fromkeys(record["related"])), "Duplicate target for " + title)
        require(set(record["related"]) == {e["target"] for e in record["review"]["edges"]},
                "Public navigation differs from public edge records for " + title)
        for edge in record["review"]["edges"]:
            key = title, edge["target"]
            require(key not in projected_edges, f"Duplicate public relationship {key}")
            projected_edges[key] = edge["kind"], edge["basis"], edge["evidence"], edge["refs"]
    expected_edges = {
        (form_to_public.get(e["source"], e["source"]), form_to_public.get(e["target"], e["target"])):
        (e["kind"], e["evidence_basis"], e["evidence"], e["link_specific_references"].split())
        for e in accepted
    }
    require(len(expected_edges) == len(accepted) and projected_edges == expected_edges,
            "Public relationships differ from adjudicated relationships")
    print(f"{len(forms)} forms, {len(links)} candidate rows, {len(accepted)} supported links verified")


def run(script, *args, cwd, utf8=False, options=("-I", "-B")):
    command = [sys.executable, *options, "-X", "utf8=" + str(int(utf8)), str(script), *map(str, args)]
    env = {**os.environ, "LANG": "C", "LC_ALL": "C"}
    result = subprocess.run(command, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if result.returncode:
        raise RuntimeError(f"{script.name} exited {result.returncode}:\n{result.stdout.decode('utf-8', 'replace')}")


def verify(package):
    headline_checks(package)
    with tempfile.TemporaryDirectory(prefix="song-forms-review-") as work:
        external = Path(work)
        clone = external / "review"
        shutil.copytree(package, clone, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".git"))
        before = file_hashes(clone)
        for name in OUTPUTS:
            (clone / name).unlink()
        run(clone / "reconcile.py", clone, cwd=external)
        after = file_hashes(clone)
        require(before == after, "Clean rebuild changed files: " +
                ", ".join(str(p) for p in sorted(before.keys() | after.keys()) if before.get(p) != after.get(p)))
        run(clone / "audit_units.py", "--check", cwd=external)
        for source in (clone / "english-forms.md", clone / "comparison/r2-post.md"):
            (clone / "dist/catalog.js").unlink()
            run(clone / "build.py", source, cwd=external)
            require(file_hashes(clone) == before, "Source variant changed the package: " + source.name)
        run(clone / "reconcile.py", clone, cwd=external, options=())
        require(file_hashes(clone) == before, "Ordinary invocation dirtied the package or wrote bytecode")
        # The archival builder retains its original default encoding. Pin UTF-8 for this process.
        (clone / "baseline/dist/catalog.js").unlink()
        run(clone / "baseline/build.py", clone / "english-forms.md", cwd=clone / "baseline", utf8=True)
        require(file_hashes(clone) == before, "Archival catalog failed to reproduce")
    print("Seven products regenerated; both source inventories, archival build and cache checks passed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", nargs="?", type=Path, default=Path(__file__).resolve().parent)
    verify(parser.parse_args().package.resolve())

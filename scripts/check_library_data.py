#!/usr/bin/env python3
"""Gate: the static Library data (library/data, built by
lyric-harness/library/catalog_static_export.py) against the canonical snapshot
it claims to project. The comparison reads the canonical files themselves, not
the site export the builder read, so the two are independent.

For every readable unit:
  - the u/ shard names its path key and collection, and the head lives there;
  - every head and page embeds the identity its path names (id, revision,
    page index and count); proj12 is the head's own hash; every page's sha256
    is the one the head lists, and its name carries it;
  - every line's projected fields equal the canonical line's;
  - the client's derivation (catalog_static_export.replay, from each page's
    start counters alone) gives every line's canonical id, analysis line and
    normalized code-point and UTF-16 ranges; normalized_text is the join of
    lyric rows; source_map.rows are the derived ids;
  - head descriptive fields equal the canonical reading's; rights_ref and
    metadata_ref are the canonical objects' hashes; source_basis composed from
    the rights equals the site export's (catalog_site_export.source_basis).
Across the set:
  - the readable set and readable_ids_sha256 equal the canonical index's;
  - c/ partitions the readable units; each head file lists its collection's
    readable ids in catalog order (Play opens readable_ids[0]); display rows
    are ordered by (title_search UTF-8 bytes, id) and equal the index summary;
  - w/title pages are every readable unit in that order;
  - catalog.json's cards and collections.json cover every collection, each
    card's Play target is its collection's first readable id;
  - every list file embeds the manifest's data_id, which recomputes;
  - manifest.json lists exactly the files present, with their sha256 and size;
  - budgets: catalog.json <= 4,096 B gz, collections.json <= 98,304 B gz, every
    head <= 24,576 B gz.

Run: python3 scripts/check_library_data.py DATA_DIR [--snapshot DIR]
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "lyric-harness"))

from library.catalog import canonical, sha  # noqa: E402
from library.catalog_site_export import source_basis  # noqa: E402
from library.catalog_static_export import (  # noqa: E402
    LIST_ROWS, PAGE_ROWS, SHELF_CARDS, SNIPPET_CODEPOINTS, WORKS_ROWS, compose_source_basis, line_id,
    replay, shard, short,
)

BUDGETS = {"catalog.json": 4096, "collections.json": 98304}
HEAD_BUDGET = 24576


LINE_KEYS = ("kind", "text", "indent", "physical_line", "analysis_line", "source_cp_range", "source_text",
             "source_ranges")


def unproject(row):
    """A projected line back to its canonical fields, independently of the
    builder's line_row: source_text null means equal to text."""
    kind, text, indent, physical_line, analysis_line, source_cp_range, source_text, ranges = row
    return {"kind": kind, "text": text, "indent": indent, "physical_line": physical_line,
            "analysis_line": analysis_line, "source_cp_range": source_cp_range,
            "source_text": text if source_text is None else source_text,
            "source_ranges": [{"codepoint_range": cp, "byte_range": byte, "utf16_range": utf, "physical_line": line,
                               "precision": precision} for cp, byte, utf, line, precision in ranges]}


class Gate:
    def __init__(self):
        self.failures = []

    def check(self, ok, message):
        if not ok and len(self.failures) < 200:
            self.failures.append(message)
        return ok


def load(path: Path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw), raw


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("data", type=Path)
    parser.add_argument("--snapshot", type=Path, default=ROOT / "lyric-harness/library/snapshot")
    args = parser.parse_args(argv)
    data, snap = args.data, args.snapshot
    gate = Gate()

    manifest_raw = (snap / "manifest.json").read_bytes()
    snapshot_manifest = json.loads(manifest_raw)
    index_raw = (snap / "index.json").read_bytes()
    if hashlib.sha256(index_raw).hexdigest() != snapshot_manifest["artifacts"]["index.json"]:
        sys.exit("canonical index hash mismatch")
    index = json.loads(index_raw)
    readings = {r["reading_unit_id"]: r for r in index["readings"]}
    readable = sorted(i for i, r in readings.items() if r["availability"] == "readable")
    title_key = lambda i: (readings[i]["title_search"].encode("utf-8"), i.encode("utf-8"))  # noqa: E731

    manifest, _ = load(data / "manifest.json")
    data_id = manifest["data_id"]
    present = {p.relative_to(data).as_posix() for p in data.rglob("*") if p.is_file()} - {"manifest.json"}
    gate.check(present == set(manifest["files"]), f"manifest lists {len(manifest['files'])} files, {len(present)} present")
    for path, info in manifest["files"].items():
        if path in present:
            raw = (data / path).read_bytes()
            gate.check(hashlib.sha256(raw).hexdigest() == info["sha256"] and len(raw) == info["bytes"],
                       f"manifest sha256 or size: {path}")

    lists, bodies = {}, {}
    for path in sorted(present):
        if path.startswith("r/"):
            continue
        value, raw = load(data / path)
        lists[path] = value
        gate.check(value.get("data_id") == data_id, f"data_id: {path}")
        bodies[path] = {k: v for k, v in value.items() if k != "data_id"}

    # u/ shards: exactly the readable units, each once.
    units = {}
    for path, value in lists.items():
        if path.startswith("u/"):
            gate.check(path == f"u/{value['shard']}.json.gz", f"shard identity: {path}")
            for unit, path_key, collection in value["units"]:
                gate.check(shard(unit) == value["shard"] and unit not in units, f"shard membership: {unit}")
                units[unit] = (path_key, collection)
    gate.check(sorted(units) == readable, f"u/ holds {len(units)} units, the snapshot {len(readable)} readable")

    by_work = {}
    for i in readable:
        by_work.setdefault(readings[i]["work_id"], []).append(i)
    snippets, checked = {}, 0
    for unit in readable:
        if unit not in units:
            continue
        path_key, collection = units[unit]
        summary = readings[unit]
        reading_raw = (snap / summary["path"]).read_bytes()
        artifact_sha = snapshot_manifest["artifacts"][summary["path"]]
        if not gate.check(hashlib.sha256(reading_raw).hexdigest() == artifact_sha, f"canonical reading hash: {unit}"):
            continue
        reading = json.loads(reading_raw)
        base = data / "r" / shard(unit) / unit / path_key
        head, head_raw = load(base / "head.json.gz")
        head_bytes = (base / "head.json.gz").stat().st_size
        gate.check(head_bytes <= HEAD_BUDGET, f"head over budget ({head_bytes} B): {unit}")
        gate.check(path_key == f"{reading['reading_revision'][:16]}-{hashlib.sha256(gzip.decompress(head_raw)).hexdigest()[:12]}",
                   f"path key is not rev16-proj12: {unit}")
        gate.check(gzip.decompress(head_raw) == canonical(head), f"head is not canonical JSON: {unit}")
        gate.check((head["reading_unit_id"], head["reading_revision"], head["page_index"], head["page_count"])
                   == (unit, reading["reading_revision"], 0, len(head["pages"]) + 1), f"head identity: {unit}")
        files = {p.name for p in base.iterdir()}
        expected = {"head.json.gz"} | {f"{k + 1}-{digest[:12]}.json.gz" for k, digest in enumerate(head["pages"])}
        gate.check(files == expected, f"directory contents: {unit}")
        lines, starts = list(head["lines"]), [head["start"]]
        for k, digest in enumerate(head["pages"], start=1):
            page_path = base / f"{k}-{digest[:12]}.json.gz"
            if not page_path.exists():
                continue
            page, page_raw = load(page_path)
            inner = gzip.decompress(page_raw)
            gate.check(hashlib.sha256(inner).hexdigest() == digest and inner == canonical(page), f"page hash: {unit} {k}")
            gate.check((page["reading_unit_id"], page["reading_revision"], page["page_index"], page["page_count"])
                       == (unit, reading["reading_revision"], k, head["page_count"]), f"page identity: {unit} {k}")
            starts.append(page["start"])
            lines += page["lines"]
        canonical_lines = reading["lines"]
        gate.check(len(lines) == len(canonical_lines), f"line count: {unit}")
        gate.check(all(len(chunk) <= PAGE_ROWS for chunk in [head["lines"]]), f"head rows: {unit}")
        # Projected fields, and the client's derivation page by page from its own counters.
        offset = 0
        derived_all = []
        for k, start in enumerate(starts):
            count = len(head["lines"]) if k == 0 else min(PAGE_ROWS, len(lines) - offset)
            chunk = lines[offset:offset + count]
            derived, _ = replay(chunk, start)
            derived_all += derived
            if chunk:
                gate.check(start["physical_line_start"] == chunk[0][3], f"physical_line_start: {unit} {k}")
            offset += count
        for row, (projected, original, derived) in enumerate(zip(lines, canonical_lines, derived_all)):
            if not gate.check(unproject(projected) == {k: original[k] for k in LINE_KEYS}, f"line content: {unit} row {row}"):
                break
            if not gate.check(derived["row"] == row and line_id(unit, row) == original["id"]
                              and derived["analysis_line"] == original["analysis_line"]
                              and derived["normalized_cp_range"] == original["normalized_cp_range"]
                              and derived["normalized_utf16_range"] == original["normalized_utf16_range"],
                              f"derived coordinates: {unit} row {row}"):
                break
        gate.check("\n".join(l[1] for l in lines if l[0] == "lyric") == reading["normalized_text"], f"normalized_text: {unit}")
        gate.check([line_id(unit, r) for r in range(len(lines))] == reading["source_map"]["rows"], f"source_map.rows: {unit}")
        for key in ("work_id", "edition_id", "title", "language", "direction", "notation", "completeness",
                    "source_path", "source_sha256", "normalized_sha256", "source_range", "parser_version",
                    "normalizer_version", "contributors", "census", "source_marks"):
            gate.check(head[key] == reading[key], f"head {key}: {unit}")
        gate.check(head["collection_id"] == reading["collection_ids"][0] == collection, f"collection: {unit}")
        gate.check(head["source_map"] == {k: v for k, v in reading["source_map"].items() if k != "rows"}, f"source_map: {unit}")
        gate.check(head["rights_ref"] == sha(reading["rights"]) and head["metadata_ref"] == sha(reading["metadata"]),
                   f"rights or metadata ref: {unit}")
        gate.check(head["rights"] == {"required_attribution": reading["rights"]["required_attribution"],
                                      "notices": [n["sha256"] for n in reading["rights"]["notices"]]}, f"inline rights: {unit}")
        gate.check(compose_source_basis(head["canonical_reading_sha256"], reading["rights"])
                   == source_basis(reading, artifact_sha), f"source_basis composition: {unit}")
        others = [[i, readings[i]["title"], readings[i]["source_path"]]
                  for i in sorted(by_work[summary["work_id"]], key=title_key) if i != unit]
        gate.check(head.get("work_readings", []) == others, f"work_readings: {unit}")
        snippets[unit] = reading["search"]["text"][:SNIPPET_CODEPOINTS]
        checked += 1

    def row(i):
        r = readings[i]
        return [i, units[i][0], r["title"], [[c["name"], c["role"]] for c in r.get("contributors", [])],
                r["language"], r["availability"], r["completeness"], short(r["edition_id"]), short(r["work_id"]),
                r["source_path"], snippets.get(i), r.get("contributor_search", "")]

    # c/: one file set per readable collection, partitioning the readable units.
    member = {}
    for collection in index["collections"]:
        ids, cid = collection["readable_reading_unit_ids"], collection["collection_id"]
        if not ids:
            gate.check(f"c/{cid}.json.gz" not in lists, f"a collection without readable units has c/: {cid}")
            continue
        display = sorted(ids, key=title_key)
        pages = [display[k:k + LIST_ROWS] for k in range(0, len(display), LIST_ROWS)]
        for k, chunk in enumerate(pages):
            path = f"c/{cid}.json.gz" if k == 0 else f"c/{cid}.p{k}.json.gz"
            value = lists.get(path)
            if not gate.check(value is not None, f"missing {path}"):
                continue
            gate.check((value["collection_id"], value["page_index"], value["page_count"], value["total"])
                       == (cid, k, len(pages), len(ids)), f"collection page identity: {path}")
            if k == 0:
                gate.check(value["readable_ids"] == ids, f"readable_ids (Play order): {path}")
            gate.check(value["rows"] == [row(i) for i in chunk if i in units], f"collection rows: {path}")
        for i in ids:
            gate.check(i not in member, f"unit in two collections: {i}")
            member[i] = cid
    gate.check(sorted(member) == readable, "collections do not partition the readable units")
    expected_c = sum(1 for c in index["collections"] for _ in range(0, len(c["readable_reading_unit_ids"]), LIST_ROWS))
    gate.check(sum(1 for p in lists if p.startswith("c/")) == expected_c, "unexpected c/ files")

    works = sorted(readable, key=title_key)
    pages = [works[k:k + WORKS_ROWS] for k in range(0, len(works), WORKS_ROWS)]
    gate.check(sum(1 for p in lists if p.startswith("w/")) == len(pages), "unexpected w/ files")
    for k, chunk in enumerate(pages):
        value = lists.get(f"w/title/{k}.json.gz")
        if gate.check(value is not None, f"missing w/title/{k}"):
            gate.check((value["page_index"], value["page_count"], value["total"]) == (k, len(pages), len(works))
                       and value["rows"] == [row(i) for i in chunk if i in units], f"works page: {k}")

    catalog, collections = lists.get("catalog.json", {}), lists.get("collections.json", {})
    gate.check(catalog.get("readable_ids_sha256") == hashlib.sha256("\n".join(readable).encode("utf-8")).hexdigest(),
               "readable_ids_sha256")
    gate.check(catalog.get("projected_from") == {"snapshot_id": snapshot_manifest["snapshot_id"],
                                                 "repository_commit": snapshot_manifest["repository_commit"]},
               "projected_from is not this snapshot")
    gate.check(catalog.get("census") == snapshot_manifest["counts"], "census")
    gate.check(catalog.get("languages") == sorted({c["language"] for c in index["collections"]}), "language list")
    gate.check(catalog.get("collections_sha256") == sha(bodies.get("collections.json")), "collections_sha256")
    rows = collections.get("collections", [])
    gate.check([r[0] for r in rows] == [c["collection_id"] for c in index["collections"]], "collections.json coverage or order")
    for r, c in zip(rows, index["collections"]):
        gate.check(r[1:5] == [c["title"], c["language"], len(c["readable_reading_unit_ids"]), len(c["reading_unit_ids"])],
                   f"collections.json row: {c['collection_id']}")
    by_id = {c["collection_id"]: c for c in index["collections"]}
    languages = []
    for c in index["collections"]:
        if c["readable_reading_unit_ids"] and c["language"] not in languages:
            languages.append(c["language"])
    shelves = catalog.get("shelves", [])
    gate.check([s["language"] for s in shelves] == languages, "shelf languages or order")
    for shelf in shelves:
        members = [c for c in index["collections"] if c["language"] == shelf["language"] and c["readable_reading_unit_ids"]]
        gate.check(shelf["total"] == len(members) and len(shelf["cards"]) == min(SHELF_CARDS, len(members)),
                   f"shelf size: {shelf['language']}")
        for card, c in zip(shelf["cards"], members):
            gate.check(card[0] == c["collection_id"] and card[5] == by_id[card[0]]["readable_reading_unit_ids"][0],
                       f"card or Play target: {card[0]}")

    content = {p: sha(b) for p, b in bodies.items() if p != "catalog.json"}
    content["catalog.json"] = sha({k: v for k, v in bodies.get("catalog.json", {}).items() if k != "projected_from"})
    gate.check(sha({"lists": content, "readings": {u: v[0] for u, v in units.items()}}) == data_id, "data_id does not recompute")
    for path, limit in BUDGETS.items():
        size = len(gzip.compress((data / path).read_bytes(), 9, mtime=0))
        gate.check(size <= limit, f"{path} is {size} B gz, over {limit}")

    if gate.failures:
        for failure in gate.failures:
            print("FAIL", failure)
        print(f"check_library_data: {len(gate.failures)} failure(s)")
        return 1
    print(f"check_library_data: PASS — {checked} readable units, {len(manifest['files'])} files, data_id {data_id[:12]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

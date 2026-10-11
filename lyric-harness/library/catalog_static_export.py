"""Static Library data for the native tab, served by Pages (docs/library-native-design.md,
"Data plane").

Projected from the verified site export (catalog_site_export: the packs the
approved Worker imported), never from the canonical files, so every byte equals
what the Worker served. Every load-path file is addressed by reading id,
reading revision and projection identity, and none carries a snapshot id, so a
sources.tsv edit that leaves the readable units unchanged changes nothing here.

    catalog.json            the only file before shelves-ready (plain JSON)
    collections.json        every collection (plain JSON)
    c/<collection>.json.gz  a readable collection: readable ids in catalog order,
                            then display rows 0-249; .p<k>.json.gz for later rows
    w/title/<k>.json.gz     the default Works list (readable, sort=title), 100 rows
    u/<hh>.json.gz          [id, path key, collection] for every readable unit
    r/<hh>/<id>/<rev16>-<proj12>/
                            head.json.gz (lines 0-249) and <k>-<sha12>.json.gz
                            pages; a published directory never changes
    manifest.json           every file's sha256 and bytes, and data_id

hh is the first two hex digits of the unit's uuid. rev16 is the first 16 hex of
the reading revision; proj12 the first 12 hex of the sha256 of the canonical
head, which embeds every page's sha256, so any change to what a reading shows
(an enrichment on an unchanged revision included) is a new directory. Every
head and page embeds {reading_unit_id, reading_revision, page_index,
page_count} and its page-start counters, so the client checks what it got and
derives every line's normalized ranges without a page it did not fetch.

data_id is the sha256 of the canonical {path: sha256} of every list file's body
without its data_id, plus every reading's path key; catalog.json, collections,
c/, w/ and u/ embed it, so a client can tell a stale file from a current one.

Run from lyric-harness: python -m library.catalog_static_export EXPORT OUT
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re
import uuid

from library.catalog import CatalogError, NAMESPACE, canonical, sha
from library.catalog_site_export import SOURCE_BASIS_FIELDS
from library.search_store import _Packs

FORMAT = 1
PAGE_ROWS = 250
LIST_ROWS = 250
WORKS_ROWS = 100
SHELF_CARDS = 12
SNIPPET_CODEPOINTS = 180
READING_ID = re.compile(r"^reading_([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
ARTWORK = Path(__file__).resolve().parents[2] / "sites/library/lib/artwork.json"


def u16(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def gz(raw: bytes) -> bytes:
    """gzip -9 with mtime 0: deterministic for a given zlib."""
    return gzip.compress(raw, compresslevel=9, mtime=0)


def shard(reading_unit_id: str) -> str:
    match = READING_ID.match(reading_unit_id)
    if not match:
        raise CatalogError(f"unexpected reading id: {reading_unit_id}")
    return match[1][:2]


def short(entity_id: str) -> str:
    """The first 8 hex of an entity's uuid (edition8, work8)."""
    return entity_id.split("_", 1)[1][:8]


def line_row(line):
    """[kind, text, indent, physical_line, analysis_line, source_cp_range,
    source_text when it differs from text (else null),
    source_ranges as [codepoint, byte, utf16, physical_line, precision]]."""
    ranges = [[r["codepoint_range"], r["byte_range"], r["utf16_range"], r["physical_line"], r["precision"]]
              for r in line["source_ranges"]]
    source_text = line["source_text"] if line["source_text"] != line["text"] else None
    return [line["kind"], line["text"], line["indent"], line["physical_line"], line["analysis_line"],
            line["source_cp_range"], source_text, ranges]


def replay(lines, start):
    """The client's derivation, as catalog.build_reading computes it: per line,
    its id, analysis line and normalized code-point and UTF-16 ranges, from the
    page's start counters. Returns the derived lines and the end counters."""
    row, cp, utf, sung = start["row_start"], start["normalized_cp_start"], start["normalized_utf16_start"], start["analysis_line_start"]
    out = []
    for kind, text, *_ in lines:
        derived = {"row": row, "analysis_line": None, "normalized_cp_range": None, "normalized_utf16_range": None}
        if kind == "lyric":
            if sung:
                cp += 1
                utf += 1
            sung += 1
            derived.update(analysis_line=sung, normalized_cp_range=[cp, cp + len(text)],
                           normalized_utf16_range=[utf, utf + u16(text)])
            cp += len(text)
            utf += u16(text)
        out.append(derived)
        row += 1
    return out, {"row_start": row, "normalized_cp_start": cp, "normalized_utf16_start": utf, "analysis_line_start": sung}


def line_id(reading_unit_id: str, row: int) -> str:
    return f"line_{uuid.uuid5(NAMESPACE, 'line:' + reading_unit_id + ':' + str(row))}"


def compose_source_basis(canonical_reading_sha256, rights):
    """catalog_site_export.source_basis, from the head's hash and the rights object."""
    return {"canonical_reading_sha256": canonical_reading_sha256,
            **{key: rights[key] for key in SOURCE_BASIS_FIELDS if key in rights}}


def art_id(collection, artwork):
    """The old Site's art() rule (sites/library/components/library/library-app.tsx)."""
    name = (collection["title"] + " " + collection["source_path"]).lower().replace("_", " ")
    for item in artwork:
        if item["id"] == "li-qingzhao":
            hit = re.search(r"li qingzhao|李清照", name)
        elif item["id"] == "bilhana":
            hit = re.search(r"bilhana|bilhaṇa|caurap", name)
        else:
            hit = item["id"] in name
        if hit:
            return item["id"]
    return None


class _Out:
    def __init__(self, root: Path):
        self.root = root
        self.files = {}

    def write(self, path: str, raw: bytes, compress: bool = True):
        data = gz(raw) if compress else raw
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        self.files[path] = {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}


def _reading_fields(packs, item):
    """The reading's lines and search text, joined from logical chunks for a
    header reading exactly as search_store reads them."""
    reading = item["reading"]
    if item.get("reading_is_header"):
        lines, _ = packs.logical(item, "lines")
        text, _ = packs.logical(item, "search.text")
    else:
        lines, text = reading["lines"], (reading.get("search") or {}).get("text", "")
    if not isinstance(lines, list) or not isinstance(text, str):
        raise CatalogError(f"readable lines or search text missing: {item['summary']['reading_unit_id']}")
    return reading, lines, text


def project_reading(item, lines, work_readings):
    """The head and page files of one readable unit, and its path key."""
    summary, reading = item["summary"], item["reading"]
    unit, revision = summary["reading_unit_id"], summary["reading_revision"]
    if len(reading["collection_ids"]) != 1:
        raise CatalogError(f"a readable unit must belong to exactly one collection: {unit}")
    rows = [line_row(line) for line in lines]
    chunks = [rows[i:i + PAGE_ROWS] for i in range(0, len(rows), PAGE_ROWS)] or [[]]
    page_count = len(chunks)
    starts, state = [], {"row_start": 0, "normalized_cp_start": 0, "normalized_utf16_start": 0, "analysis_line_start": 0}
    for chunk in chunks:
        start = dict(state)
        start["physical_line_start"] = chunk[0][3] if chunk else None
        starts.append(start)
        _, state = replay(chunk, state)
    identity = {"reading_unit_id": unit, "reading_revision": revision, "page_count": page_count}
    pages = []
    for index in range(1, page_count):
        body = canonical({"format": FORMAT, **identity, "page_index": index, "start": starts[index],
                          "lines": chunks[index]})
        pages.append((index, hashlib.sha256(body).hexdigest(), body))
    rights = reading["rights"]
    if compose_source_basis(summary["source_basis"]["canonical_reading_sha256"], rights) != summary["source_basis"]:
        raise CatalogError(f"source_basis is not a projection of the reading's rights: {unit}")
    head = {
        "format": FORMAT, **identity, "page_index": 0, "start": starts[0],
        "work_id": reading["work_id"], "edition_id": reading["edition_id"],
        "title": reading["title"], "language": reading["language"], "direction": reading["direction"],
        "notation": reading["notation"], "completeness": reading["completeness"],
        "collection_id": reading["collection_ids"][0], "source_path": reading["source_path"],
        "source_sha256": reading["source_sha256"], "normalized_sha256": reading["normalized_sha256"],
        "native_id": reading.get("native_id"), "source_range": reading["source_range"],
        "parser_version": reading["parser_version"], "normalizer_version": reading["normalizer_version"],
        "contributors": reading["contributors"], "census": reading["census"],
        "source_marks": reading["source_marks"], "source_labels": item.get("source_labels", []),
        # source_basis is {canonical_reading_sha256} plus the SOURCE_BASIS_FIELDS
        # of the interned rights object (rights_ref): the client composes it,
        # and check_library_data proves the composition equals the export's.
        "canonical_reading_sha256": summary["source_basis"]["canonical_reading_sha256"],
        "work_reviewed_equivalence": summary["work_reviewed_equivalence"],
        "source_map": {k: v for k, v in reading["source_map"].items() if k != "rows"},
        "rights": {"required_attribution": rights["required_attribution"],
                   "notices": [notice["sha256"] for notice in rights["notices"]]},
        "rights_ref": sha(rights), "metadata_ref": sha(reading["metadata"]),
        "pages": [digest for _, digest, _ in pages],
        "lines": chunks[0],
    }
    if "work_equivalence_basis" in summary:
        head["work_equivalence_basis"] = summary["work_equivalence_basis"]
    if work_readings:
        head["work_readings"] = work_readings
    head_raw = canonical(head)
    path_key = f"{revision[:16]}-{hashlib.sha256(head_raw).hexdigest()[:12]}"
    base = f"r/{shard(unit)}/{unit}/{path_key}"
    files = [(f"{base}/head.json.gz", head_raw)]
    files += [(f"{base}/{index}-{digest[:12]}.json.gz", body) for index, digest, body in pages]
    return path_key, files


def build_static(export, out, artwork_path=ARTWORK):
    export, out = Path(export), Path(out)
    if out.exists() and any(out.iterdir()):
        raise CatalogError("static output must be empty")
    descriptor = json.loads((export / "import_manifest.json").read_bytes())
    label_registry = (descriptor.get("derived_metadata") or {}).get("label_registry_sha256")
    references = descriptor.get("references") or {}
    if not label_registry or not {"label_prefixes", "source_records"} <= set(references):
        raise CatalogError("the export was built without its label registry or source records")
    packs = _Packs(export)
    artifacts = descriptor["artifacts"]

    def gz_artifact(name):
        info = artifacts[name]
        raw = gzip.decompress((export / info["gzip_path"]).read_bytes())
        if hashlib.sha256(raw).hexdigest() != info["sha256"]:
            raise CatalogError(f"export artifact hash: {name}")
        return json.loads(raw)

    manifest, index = gz_artifact("manifest.json"), gz_artifact("index.json")
    if manifest["snapshot_id"] != descriptor["snapshot_id"]:
        raise CatalogError("export snapshot mismatch")
    readings = {r["reading_unit_id"]: r for r in index["readings"]}
    readable = sorted(i for i, r in readings.items() if r["availability"] == "readable")
    title_key = {i: (r["title_search"].encode("utf-8"), i.encode("utf-8")) for i, r in readings.items()}

    # Other readable readings of the same work, title-ordered (the comparison picker's list).
    by_work = {}
    for i in readable:
        by_work.setdefault(readings[i]["work_id"], []).append(i)
    for ids in by_work.values():
        ids.sort(key=lambda i: title_key[i])

    writer = _Out(out)
    path_keys, snippets, seen = {}, {}, set()
    for pack_path in packs.readings:
        for item in packs.load(pack_path)["readings"]:
            summary = item["summary"]
            unit = summary["reading_unit_id"]
            if item.get("reading") is None:
                continue
            if summary["availability"] != "readable" or unit not in readings or unit in seen:
                raise CatalogError(f"an inadmissible or duplicate reading in the export: {unit}")
            seen.add(unit)
            reading, lines, text = _reading_fields(packs, item)
            item = {**item, "reading": reading}
            others = [[i, readings[i]["title"], readings[i]["source_path"]]
                      for i in by_work[summary["work_id"]] if i != unit]
            path_key, files = project_reading(item, lines, others)
            for path, raw in files:
                writer.write(path, raw)
            path_keys[unit] = path_key
            snippets[unit] = text[:SNIPPET_CODEPOINTS]
    if sorted(seen) != readable:
        raise CatalogError("the export's readable texts differ from its index")

    def row(i):
        r = readings[i]
        return [i, path_keys[i], r["title"], [[c["name"], c["role"]] for c in r.get("contributors", [])],
                r["language"], r["availability"], r["completeness"], short(r["edition_id"]), short(r["work_id"]),
                r["source_path"], snippets[i], r.get("contributor_search", "")]

    # List files are assembled without data_id first; data_id is their content identity.
    lists = {}
    collection_of = {}
    for collection in index["collections"]:
        ids = collection["readable_reading_unit_ids"]
        for i in ids:
            if i in collection_of:
                raise CatalogError(f"a readable unit is in two collections: {i}")
            collection_of[i] = collection["collection_id"]
        if not ids:
            continue
        display = sorted(ids, key=lambda i: title_key[i])
        chunks = [display[k:k + LIST_ROWS] for k in range(0, len(display), LIST_ROWS)]
        cid = collection["collection_id"]
        for k, chunk in enumerate(chunks):
            body = {"format": FORMAT, "collection_id": cid, "page_index": k, "page_count": len(chunks),
                    "total": len(ids), "rows": [row(i) for i in chunk]}
            if k == 0:
                body["readable_ids"] = ids
            lists[f"c/{cid}.json.gz" if k == 0 else f"c/{cid}.p{k}.json.gz"] = body
    if sorted(collection_of) != readable:
        raise CatalogError("collections do not partition the readable units")
    works = sorted(readable, key=lambda i: title_key[i])
    pages = [works[k:k + WORKS_ROWS] for k in range(0, len(works), WORKS_ROWS)]
    for k, chunk in enumerate(pages):
        lists[f"w/title/{k}.json.gz"] = {"format": FORMAT, "page_index": k, "page_count": len(pages),
                                         "total": len(works), "rows": [row(i) for i in chunk]}
    shards = {}
    for i in readable:
        shards.setdefault(shard(i), []).append([i, path_keys[i], collection_of[i]])
    for hh, units in sorted(shards.items()):
        lists[f"u/{hh}.json.gz"] = {"format": FORMAT, "shard": hh, "units": units}

    artwork = json.loads(Path(artwork_path).read_bytes())
    all_collections = [[c["collection_id"], c["title"], c["language"], len(c["readable_reading_unit_ids"]),
                        len(c["reading_unit_ids"]), art_id(c, artwork)] for c in index["collections"]]
    lists["collections.json"] = {"format": FORMAT, "collections": all_collections}
    collections_sha = sha(lists["collections.json"])
    shelves = []
    for c in index["collections"]:
        if c["readable_reading_unit_ids"] and c["language"] not in [s["language"] for s in shelves]:
            shelves.append({"language": c["language"]})
    for shelf in shelves:
        members = [c for c in index["collections"] if c["language"] == shelf["language"] and c["readable_reading_unit_ids"]]
        shelf["total"] = len(members)
        shelf["cards"] = [[c["collection_id"], c["title"], len(c["readable_reading_unit_ids"]),
                           len(c["reading_unit_ids"]), art_id(c, artwork), c["readable_reading_unit_ids"][0]]
                          for c in members[:SHELF_CARDS]]
    lists["catalog.json"] = {
        "format": FORMAT,
        "projected_from": {"snapshot_id": manifest["snapshot_id"], "repository_commit": manifest["repository_commit"]},
        "census": manifest["counts"],
        "readable_ids_sha256": hashlib.sha256("\n".join(readable).encode("utf-8")).hexdigest(),
        "shelves": shelves,
        "languages": sorted({c["language"] for c in index["collections"]}),
        "collections_sha256": collections_sha,
    }

    content = {path: sha(body) for path, body in lists.items() if path != "catalog.json"}
    content["catalog.json"] = sha({k: v for k, v in lists["catalog.json"].items() if k != "projected_from"})
    data_id = sha({"lists": content, "readings": path_keys})
    for path, body in sorted(lists.items()):
        body = {**body, "data_id": data_id}
        writer.write(path, canonical(body), compress=path.endswith(".gz"))
    writer.write("manifest.json", canonical({"format": FORMAT, "data_id": data_id,
                                             "projected_from": lists["catalog.json"]["projected_from"],
                                             "readable": len(readable), "files": writer.files}), compress=False)
    return {"data_id": data_id, "readable": len(readable), "files": len(writer.files),
            "bytes": sum(f["bytes"] for f in writer.files.values())}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("export", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args(argv)
    print(json.dumps(build_static(args.export, args.output)))


if __name__ == "__main__":
    main()

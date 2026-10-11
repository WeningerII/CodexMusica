"""Exact search store for the native Library tab (/library/v1/search).

Built once per image from the verified site export (catalog_site_export: the
same packs the approved Worker imported into D1), so every column below is
byte-for-byte what the Worker's `library_readings` table held:

    title       summary.title_search
    contributor summary.contributor_search or ""
    body        reading.search.text (or its logical chunks); "" when held
    metadata    JSON.stringify(summary), in the pack's key order

The Node side (mcp/library_search.js) answers the Worker's SQL from these
files without parsing any canonical reading on the request path:

    store.json             format, snapshot_id, counts, file sha256s
    units.json             per-unit columns and the two sort permutations
    title.bin, contributor.bin, contributor_lower.bin, body.bin
                           UTF-8 columns, each with a uint32 offset table in
                           offsets.bin (n+1 entries per column)
    metadata.bin           metadata JSON per unit, raw-deflate compressed,
                           offsets in offsets.bin
    projection.bin         per readable unit: search spans and the line
                           fields hit projection reads, in raw-deflate chunks
                           of at most SPAN_CHUNK spans / LINE_CHUNK lines,
                           each chunk located through units.json

Packs are processed one at a time, so memory stays near one pack plus the
small per-unit columns.

store.json's readable_ids_sha256 is sha256 of the readable unit ids, sorted
and joined with "\n" (UTF-8). /library/v1/health reports it, and the static
catalog.json must use the same definition, so the tab can compare them.

Sort permutations are computed here on UTF-8 bytes, which is SQLite's BINARY
collation: ORDER BY title,id and ORDER BY contributor,title,id.

Run: python -m library.search_store EXPORT_DIR OUT_DIR
"""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import struct
import sys
import zlib
from pathlib import Path

FORMAT = 1
SPAN_CHUNK = 500
LINE_CHUNK = 250
LINE_FIELDS = ("id", "physical_line", "normalized_cp_range", "source_cp_range",
               "source_utf16_range", "byte_range", "source_text", "transformation_spans")
SPAN_FIELDS = ("search_cp_range", "normalized_cp_range", "precision")


def _canonical(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def _deflate(data: bytes) -> bytes:
    """Raw deflate (no header), level 9: deterministic for a given zlib."""
    c = zlib.compressobj(9, zlib.DEFLATED, -15, 9)
    return c.compress(data) + c.flush()


def _js_json(value) -> bytes:
    """JSON.stringify of a value parsed from JSON: insertion order, no spaces."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"),
                      allow_nan=False).encode("utf-8")


class _Packs:
    """Verified pack reader: every pack's raw sha256 is checked once."""

    def __init__(self, export: Path):
        self.export = export
        manifest = json.loads((export / "import_manifest.json").read_text("utf-8"))
        self.snapshot_id = manifest["snapshot_id"]
        self.refs = {ref["path"]: ref for ref in manifest["packs"]}
        self.readings = sorted(p for p, r in self.refs.items() if r["kind"] == "readings")

    def load(self, path: str):
        ref = self.refs.get(path)
        if ref is None:
            raise ValueError(f"unregistered pack {path}")
        raw = gzip.decompress((self.export / path).read_bytes())
        if len(raw) != ref["raw_bytes"] or hashlib.sha256(raw).hexdigest() != ref["raw_sha256"]:
            raise ValueError(f"pack checksum mismatch: {path}")
        return json.loads(raw)

    def logical(self, item, field):
        """The Worker's logicalField: ordered parts, arrays extended, strings joined."""
        paths = (item.get("reading_chunks") or {}).get(field)
        if paths is None:
            return None, []
        value, refs = None, []
        unit, revision = item["summary"]["reading_unit_id"], item["summary"]["reading_revision"]
        for index, path in enumerate(paths):
            part = self.load(path)
            if (part["part_index"] != index or part["part_count"] != len(paths)
                    or part["field"] != field or part["reading_unit_id"] != unit
                    or part["reading_revision"] != revision):
                raise ValueError(f"logical parts do not reconcile: {unit} {field}")
            refs.append((self.refs[path], len(part["value"]) if isinstance(part["value"], list) else 0))
            if isinstance(part["value"], list):
                value = (value or []) + part["value"]
            elif isinstance(part["value"], str):
                value = (value if isinstance(value, str) else "") + part["value"]
            else:
                raise ValueError("invalid logical field")
        return value, refs


def _ascii_lower(text: str) -> str:
    """SQLite lower() without ICU: ASCII A-Z only."""
    return "".join(chr(ord(c) + 32) if "A" <= c <= "Z" else c for c in text)


def _lines_with_rows(lines, start_row=0):
    out = []
    for i, line in enumerate(lines):
        kept = {k: line[k] for k in LINE_FIELDS if k in line}
        kept["row"] = start_row + i
        out.append(kept)
    return out


def _chunks(items, size, lo_key, hi_key):
    """Chunks with their covering range (min start, max end) for intersection tests.

    A chunk with no ranged item gets None, which the reader treats as
    'always intersects', as the Worker does for a chunk without a bound.
    """
    for start in range(0, len(items), size):
        part = items[start:start + size]
        ranged = [it[lo_key] for it in part if it.get(lo_key)]
        bound = [min(r[0] for r in ranged), max(r[1] for r in ranged)] if ranged else None
        yield part, bound


def build(export: Path, out: Path) -> dict:
    packs = _Packs(export)
    out.mkdir(parents=True, exist_ok=True)
    names = ("title", "contributor", "contributor_lower", "body", "metadata")
    sinks = {name: open(out / f"{name}.bin", "wb") for name in names}
    sinks["projection"] = open(out / "projection.bin", "wb")
    size = {name: 0 for name in sinks}
    offsets = {name: [0] for name in names}
    units = {"ids": [], "availability": [], "language": [], "completeness": [], "work": [],
             "collections": [], "revision": [], "projection": []}
    sort_keys = []
    readable = []

    def put(name, data):
        sinks[name].write(data)
        size[name] += len(data)

    try:
        for path in packs.readings:
            for item in packs.load(path)["readings"]:
                s = item["summary"]
                reading = item.get("reading")
                if reading and s["availability"] != "readable":
                    raise ValueError(f"a held text cannot be admitted: {s['reading_unit_id']}")
                header = bool(item.get("reading_is_header"))
                if reading:
                    if header:
                        body, _ = packs.logical(item, "search.text")
                    else:
                        body = (reading.get("search") or {}).get("text", "")
                    if not isinstance(body, str):
                        raise ValueError(f"readable search text is missing: {s['reading_unit_id']}")
                else:
                    body = ""
                title = s["title_search"]
                contributor = s.get("contributor_search") or ""
                for name, text in (("title", title), ("contributor", contributor),
                                   ("contributor_lower", _ascii_lower(contributor)),
                                   ("body", body)):
                    put(name, text.encode("utf-8"))
                    offsets[name].append(size[name])
                put("metadata", _deflate(_js_json(s)))
                offsets["metadata"].append(size["metadata"])
                units["ids"].append(s["reading_unit_id"])
                units["availability"].append(s["availability"])
                units["language"].append(s["language"])
                units["completeness"].append(s["completeness"])
                units["work"].append(s["work_id"])
                units["collections"].append(s["collection_ids"])
                units["revision"].append(s["reading_revision"])
                sort_keys.append((title.encode("utf-8"), contributor.encode("utf-8"),
                                  s["reading_unit_id"].encode("utf-8")))

                projection = None
                if reading:
                    readable.append(s["reading_unit_id"])
                    if header:
                        spans, _ = packs.logical(item, "search.spans")
                        lines, _ = packs.logical(item, "lines")
                    else:
                        spans = reading["search"]["spans"]
                        lines = reading["lines"]
                    spans = [{k: sp[k] for k in SPAN_FIELDS} for sp in spans]
                    lines = _lines_with_rows(lines)
                    projection = {"spans": [], "lines": []}
                    for kind, items, chunk, key in (
                            ("spans", spans, SPAN_CHUNK, "search_cp_range"),
                            ("lines", lines, LINE_CHUNK, "normalized_cp_range")):
                        for part, bound in _chunks(items, chunk, key, key):
                            blob = _deflate(_canonical(part))
                            projection[kind].append([size["projection"], len(blob), bound])
                            put("projection", blob)
                units["projection"].append(projection)
    finally:
        for sink in sinks.values():
            sink.close()

    ids = units["ids"]
    if len(set(ids)) != len(ids):
        raise ValueError("duplicate reading unit ids")
    n = len(ids)
    units["sort_title"] = sorted(range(n), key=lambda i: (sort_keys[i][0], sort_keys[i][2]))
    units["sort_contributor"] = sorted(range(n), key=lambda i: (sort_keys[i][1], sort_keys[i][0],
                                                                 sort_keys[i][2]))
    table = bytearray()
    for name in names:
        if offsets[name][-1] >= 2 ** 32:
            raise ValueError(f"{name} column exceeds uint32 offsets")
        table += struct.pack(f"<{len(offsets[name])}I", *offsets[name])
    (out / "offsets.bin").write_bytes(bytes(table))
    (out / "units.json").write_bytes(_canonical(units))
    files = {}
    for name in sorted(p.name for p in out.iterdir() if p.name != "store.json"):
        digest = hashlib.sha256()
        with open(out / name, "rb") as f:
            for block in iter(lambda: f.read(1 << 20), b""):
                digest.update(block)
        files[name] = digest.hexdigest()
    store = {
        "format": FORMAT,
        "snapshot_id": packs.snapshot_id,
        "unit_count": n,
        "readable_count": len(readable),
        "readable_ids_sha256": hashlib.sha256("\n".join(sorted(readable)).encode("utf-8")).hexdigest(),
        "columns": list(names),
        "files": files,
    }
    (out / "store.json").write_bytes(_canonical(store))
    return store


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if len(argv) != 2:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    store = build(Path(argv[0]), Path(argv[1]))
    print(json.dumps({k: store[k] for k in ("snapshot_id", "unit_count", "readable_count")}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Rights-filtered deployment from a complete canonical Library snapshot.

Canonical manifest/index and admitted reading bytes stay identical. The separate
import manifest lists installed objects and explains every omitted body/source.
"""
import argparse
import csv
import gzip
import hashlib
import io
import json
from pathlib import Path

from library.catalog import CatalogError, canonical, range_in_row, sha, u16

SOURCE_BASIS_FIELDS = ("sources", "file_sources", "source_declarations", "source_locators", "required_attribution", "layers")


def source_basis(reading, artifact_sha256):
    """Recorded rights metadata only; never copy withheld transcription or notes."""
    return {"canonical_reading_sha256": artifact_sha256,
            **{key: reading["rights"][key] for key in SOURCE_BASIS_FIELDS if key in reading["rights"]}}


def source_labels(reading, declarations, registry_sha256):
    labels = []
    for row in reading["lines"]:
        declaration = declarations.get((reading["source_path"], row["physical_line"]))
        if declaration is None: continue
        prefix = declaration["prefix"]; raw = row["source_text"]
        start = len(raw) - len(raw.lstrip())
        if not raw[start:].startswith(prefix): raise CatalogError("declared label source projection drift")
        labels.append({"prefix": prefix, "kind": declaration.get("kind"),
                       "registry_sha256": registry_sha256, "basis": "declared_inline_prefix",
                       **range_in_row(row, start, start + len(prefix))})
    return labels


def export_snapshot(source, output, chunk_limit=1024 * 1024):
    source, output = Path(source), Path(output)
    if output.exists() and any(output.iterdir()): raise CatalogError("export output must be empty")
    output.mkdir(parents=True, exist_ok=True)
    manifest_raw = (source / "manifest.json").read_bytes(); manifest = json.loads(manifest_raw)
    if sha({k: v for k, v in manifest.items() if k != "snapshot_id"}) != manifest["snapshot_id"]: raise CatalogError("canonical manifest hash")
    index_raw = (source / "index.json").read_bytes()
    if sha(index_raw) != manifest["artifacts"]["index.json"]: raise CatalogError("canonical index hash")
    index = json.loads(index_raw)
    readable = {r["reading_unit_id"] for r in index["readings"] if r["availability"] == "readable"}
    by_source = {}
    for item in index["readings"]: by_source.setdefault(item["source_sha256"], []).append(item)
    admitted_sources = {digest for digest, units in by_source.items() if all(u["availability"] == "readable" for u in units)}
    installed, omitted = {}, []
    def copy(path, expected=None):
        raw = (source / path).read_bytes()
        digest = sha(raw)
        if expected is not None and digest != expected: raise CatalogError(f"artifact hash: {path}")
        target = output / path; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(raw)
        installed[path] = {"sha256": digest, "bytes": len(raw)}
    copy("manifest.json", sha(manifest_raw))
    for path, digest in manifest["artifacts"].items():
        if path.startswith("readings/"):
            unit_id = Path(path).stem
            if unit_id not in readable:
                omitted.append({"path": path, "sha256": digest, "reason": "reading is not admitted readable"}); continue
        elif path.startswith("sources/"):
            source_id = Path(path).stem
            if source_id not in admitted_sources:
                omitted.append({"path": path, "sha256": digest, "reason": "whole source contains unadmitted or unclassified material"}); continue
        elif path not in {"index.json", "identity_registry.json"}:
            raise CatalogError(f"unclassified deployment artifact: {path}")
        copy(path, digest)
    # Bounded entity records for D1 staging. Bodies remain in immutable R2 objects.
    chunk, size, chunk_paths = [], 2, []
    def flush():
        nonlocal chunk, size
        if not chunk: return
        path = f"imports/catalog-{len(chunk_paths):05d}.json"
        raw = canonical(chunk)
        if len(raw) > chunk_limit: raise CatalogError("import chunk size")
        target = output / path; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(raw)
        installed[path] = {"sha256": sha(raw), "bytes": len(raw)}; chunk_paths.append(path)
        chunk, size = [], 2
    for family in ("collections", "works", "editions", "readings"):
        for record in index[family]:
            row = {"family": family, "record": record}; row_size = len(canonical(row)) + 1
            if row_size + 2 > chunk_limit: raise CatalogError(f"catalog record exceeds import envelope: {family}")
            if size + row_size > chunk_limit: flush()
            chunk.append(row); size += row_size
    flush()
    descriptor = {"schema_version": 1, "snapshot_id": manifest["snapshot_id"], "canonical_manifest_sha256": sha(manifest_raw),
                  "counts": manifest["counts"], "artifacts": installed, "omitted": omitted, "import_chunks": chunk_paths,
                  "whole_sources": {digest: {"availability": "readable" if digest in admitted_sources else "held",
                       "source_paths": sorted({u["source_path"] for u in units}), "reason": "all reading units admitted" if digest in admitted_sources else "whole original withheld; admitted source transcription remains in its reading"} for digest, units in by_source.items()}}
    (output / "import_manifest.json").write_bytes(canonical(descriptor))
    return attach_references(output, pack_export(output, descriptor, source), source.parent)


def gunzip_checked(path, size):
    with gzip.GzipFile(fileobj=io.BytesIO(path.read_bytes())) as stream:
        raw = stream.read(size + 1)
        if len(raw) != size or stream.read(1): raise CatalogError("gzip raw size mismatch")
        return raw


def compact_summary(record, work=None):
    keep = {k: v for k, v in record.items() if k not in {"source_search", "contributors", "contributor_search", "availability_reason"}}
    keep["contributors"] = [{"name": r["name"], "role": r["role"]} for r in record.get("contributors", [])]
    keep["contributor_search"] = record.get("contributor_search", "")
    keep["availability_reason"] = record.get("availability_reason", {})
    work = work or {}
    keep["work_reviewed_equivalence"] = work.get("reviewed_equivalence") is True
    if "equivalence_basis" in work:
        keep["work_equivalence_basis"] = work["equivalence_basis"]
    return keep


def attach_references(output, descriptor, reference_dir):
    """Bind the generated engine registry/schema without changing catalog identity."""
    output, reference_dir = Path(output), Path(reference_dir); references = {}
    for name, filename, source in (("methods", "methods.json", reference_dir / "methods.json"),
                                   ("result_schema", "schema.json", reference_dir / "schema.json"),
                                   ("label_prefixes", "lyric_label_prefixes.json", reference_dir.parent / "data/lyric_label_prefixes.json"),
                                   ("source_records", "sources.tsv", reference_dir.parent / "data/sources.tsv")):
        if not source.is_file(): continue
        raw = source.read_bytes(); zipped = gzip.compress(raw, compresslevel=6, mtime=0)
        path = filename + ".gz"; (output / path).write_bytes(zipped)
        references[name] = {"path": path, "raw_sha256": sha(raw), "raw_bytes": len(raw), "gzip_sha256": sha(zipped), "gzip_bytes": len(zipped)}
        if name == "methods": references[name]["registry_hash"] = json.loads(raw)["registry_hash"]
    descriptor["references"] = references
    (output / "import_manifest.json").write_bytes(canonical(descriptor))
    verify_export(output)
    return descriptor


def annotate_chunks(output, descriptor):
    """Add seek metadata and header row counts without assembling a large unit."""
    output = Path(output); positions, utf16_positions = {}, {}
    for info in descriptor["packs"]:
        path = output / info["path"]; value = json.loads(gunzip_checked(path, info["raw_bytes"]))
        changed = False
        if info["kind"] == "reading_chunks":
            key = (value["reading_unit_id"], value["field"]); body = value["value"]
            start = positions.get(key, 0); count = len(body); positions[key] = start + count
            info.update(reading_unit_id=value["reading_unit_id"], reading_revision=value["reading_revision"], field=value["field"],
                        part_index=value["part_index"], part_count=value["part_count"], value_count=count)
            if isinstance(body, str):
                utf_start = utf16_positions.get(key, 0); utf_end = utf_start + u16(body); utf16_positions[key] = utf_end
                info.update(codepoint_range=[start, start + count], utf16_range=[utf_start, utf_end])
            else:
                info["value_range"] = [start, start + count]
                range_key = {"search.spans": "search_cp_range", "lines": "normalized_cp_range"}.get(value["field"])
                if range_key:
                    ranges = [row[range_key] for row in body if row.get(range_key) is not None]
                    info[range_key] = [ranges[0][0], ranges[-1][1]] if ranges else None
        elif info["kind"] == "readings":
            for row in value["readings"]:
                if row.get("reading_is_header"):
                    row["reading"]["line_count"] = positions[(row["summary"]["reading_unit_id"], "lines")]
                    row["reading"]["physical_row_count"] = row["reading"]["census"]["physical_source_rows"]
                    changed = True
        if changed:
            raw = canonical(value); zipped = gzip.compress(raw, compresslevel=6, mtime=0); path.write_bytes(zipped)
            info.update(raw_sha256=sha(raw), raw_bytes=len(raw), gzip_sha256=sha(zipped), gzip_bytes=len(zipped))
    (output / "import_manifest.json").write_bytes(canonical(descriptor))
    return descriptor


def pack_export(output, descriptor, canonical_source):
    """Convert approved raw objects to bounded gzip packs, then remove raw copies."""
    output = Path(output); canonical_source = Path(canonical_source); snapshot = descriptor["snapshot_id"]; packs = []
    artifacts = descriptor["artifacts"]
    index = json.loads((output / "index.json").read_bytes())
    works = {work["work_id"]: work for work in index["works"]}
    manifest = json.loads((output / "manifest.json").read_bytes())
    label_path = canonical_source.parent.parent / "data/lyric_label_prefixes.json"
    label_raw = label_path.read_bytes() if label_path.exists() else None
    label_sha = sha(label_raw) if label_raw is not None else None
    declarations = {("corpus/song/" + item["file"], item["line"]): item
                    for item in json.loads(label_raw)["prefixes"]} if label_raw is not None else {}
    descriptor["derived_metadata"] = {"version": 1, "label_registry_sha256": label_sha}
    for path in descriptor["import_chunks"]: (output / path).unlink()
    descriptor["import_chunks"] = []
    for path in list(artifacts):
        if path.startswith("imports/"): del artifacts[path]

    def compressed(path, raw):
        zipped = gzip.compress(raw, compresslevel=6, mtime=0)
        target = output / path; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(zipped)
        return {"path": path, "raw_sha256": sha(raw), "raw_bytes": len(raw), "gzip_sha256": sha(zipped), "gzip_bytes": len(zipped)}

    def pack(value, kind):
        raw = canonical(value)
        if len(raw) > 1024 * 1024: raise CatalogError("pack exceeds 1 MiB raw envelope")
        info = compressed(f"packs/{kind}-{len(packs):05d}.json.gz", raw); info["kind"] = kind; packs.append(info)
        return info["path"]

    for path in ("manifest.json", "index.json", "identity_registry.json"):
        raw = (output / path).read_bytes(); info = compressed(path + ".gz", raw)
        artifacts[path].update(representation="gzip_metadata", gzip_path=info["path"], gzip_sha256=info["gzip_sha256"], gzip_bytes=info["gzip_bytes"])
        (output / path).unlink()
    site_index = {"snapshot_id": snapshot, "counts": descriptor["counts"], "collections": index["collections"]}
    descriptor["site_index"] = compressed("site_index.json.gz", canonical(site_index))

    def fragments(path, raw):
        text = raw.decode("utf-8"); pieces = [text[i:i + 128 * 1024] for i in range(0, len(text), 128 * 1024)]; paths = []
        for i, piece in enumerate(pieces):
            paths.append(pack({"snapshot_id": snapshot, "artifact_path": path, "part_index": i, "part_count": len(pieces), "raw_utf8_fragment": piece}, "fragments"))
        artifacts[path].update(representation="utf8_fragments", pack_paths=paths)
        return paths

    def logical_chunks(unit, reading):
        fields = {"lines": reading["lines"], "source_text": reading["source_text"], "normalized_text": reading["normalized_text"],
                  "search.text": reading["search"]["text"], "search.spans": reading["search"]["spans"], "source_map.rows": reading["source_map"]["rows"]}
        references = {}
        for field, value in fields.items():
            pieces = []
            if isinstance(value, str): pieces = [value[i:i + 128 * 1024] for i in range(0, len(value), 128 * 1024)] or [""]
            else:
                piece, piece_bytes = [], 128
                for item in value:
                    size = len(canonical(item)) + 1
                    if size + 128 > 1024 * 1024: raise CatalogError("oversized logical source row")
                    if piece and piece_bytes + size > 768 * 1024: pieces.append(piece); piece, piece_bytes = [], 128
                    piece.append(item); piece_bytes += size
                if piece or not pieces: pieces.append(piece)
            paths = []
            for i, piece in enumerate(pieces):
                paths.append(pack({"snapshot_id": snapshot, "reading_unit_id": unit, "reading_revision": reading["reading_revision"],
                                   "field": field, "part_index": i, "part_count": len(pieces), "value": piece}, "reading_chunks"))
            references[field] = paths
        header = {k: v for k, v in reading.items() if k not in {"lines", "source_text", "normalized_text", "search", "source_map"}}
        header["source_map"] = {k: v for k, v in reading["source_map"].items() if k != "rows"}
        return header, references

    pending, pending_paths, size = [], [], 128
    def flush(family):
        nonlocal pending, pending_paths, size
        if not pending: return
        path = pack({"snapshot_id": snapshot, family: pending}, family)
        for raw_path in pending_paths: artifacts[raw_path]["pack_paths"] = [path]
        pending, pending_paths, size = [], [], 128

    for original_summary in index["readings"]:
        summary = compact_summary(original_summary, works.get(original_summary["work_id"]))
        path = summary["path"]; reading = None; part_paths = None; logical_paths = None; labels = []
        raw = (output / path if path in artifacts else canonical_source / path).read_bytes()
        if sha(raw) != manifest["artifacts"][path]: raise CatalogError("source metadata reading hash")
        original_reading = json.loads(raw)
        summary["source_basis"] = source_basis(original_reading, manifest["artifacts"][path])
        if path in artifacts:
            reading = original_reading
            labels = source_labels(reading, declarations, label_sha)
            row = {"summary": summary, "reading": reading}
            if labels: row["source_labels"] = labels
            if len(canonical(row)) + 128 > 1024 * 1024:
                part_paths = fragments(path, raw)
                reading, logical_paths = logical_chunks(summary["reading_unit_id"], reading)
            else: artifacts[path].update(representation="reading", pack_paths=[])
            (output / path).unlink()
        row = {"summary": summary, "reading": reading}
        if labels: row["source_labels"] = labels
        if part_paths: row["reading_parts"] = part_paths
        if logical_paths: row.update(reading_is_header=True, reading_chunks=logical_paths)
        length = len(canonical(row)) + 1
        if length + 128 > 1024 * 1024: raise CatalogError("summary exceeds pack envelope")
        if size + length > 1024 * 1024: flush("readings")
        pending.append(row); size += length
        if reading is not None and not logical_paths: pending_paths.append(path)
    flush("readings")
    for path in list(artifacts):
        if not path.startswith("sources/"): continue
        raw = (output / path).read_bytes(); row = {"path": path, "sha256": artifacts[path]["sha256"], "text": raw.decode("utf-8")}
        length = len(canonical(row)) + 1
        if length + 128 > 1024 * 1024: fragments(path, raw)
        else:
            if size + length > 1024 * 1024: flush("sources")
            artifacts[path].update(representation="utf8_source", pack_paths=[])
            pending.append(row); pending_paths.append(path); size += length
        (output / path).unlink()
    flush("sources")
    descriptor["packs"] = packs; descriptor["import_chunks"] = [p["path"] for p in packs]
    # Remove only registered, checksum-identical raw staging copies.
    for path, info in artifacts.items():
        leftover = output / path
        if leftover.exists():
            if sha(leftover.read_bytes()) != info["sha256"]: raise CatalogError("changed raw staging artifact")
            leftover.unlink()
    annotate_chunks(output, descriptor)
    verify_export(output)
    return descriptor


def verify_export(directory):
    """Read-only checksum, complete-census, readable-body and bounded-pack gate."""
    directory = Path(directory); descriptor = json.loads((directory / "import_manifest.json").read_bytes()); artifacts = descriptor["artifacts"]
    metadata, complete, files = {}, set(), {"import_manifest.json"}; reference_raw = {}
    for name, info in descriptor.get("references", {}).items():
        path = directory / info["path"]; files.add(info["path"])
        if path.stat().st_size != info["gzip_bytes"] or sha(path.read_bytes()) != info["gzip_sha256"]: raise CatalogError("reference gzip hash")
        raw = gunzip_checked(path, info["raw_bytes"])
        if sha(raw) != info["raw_sha256"]: raise CatalogError("reference raw hash")
        reference_raw[name] = raw
    for path, info in artifacts.items():
        if info["representation"] != "gzip_metadata": continue
        zipped = directory / info["gzip_path"]; files.add(info["gzip_path"])
        if zipped.stat().st_size != info["gzip_bytes"] or sha(zipped.read_bytes()) != info["gzip_sha256"]: raise CatalogError("metadata gzip hash")
        raw = gunzip_checked(zipped, info["bytes"])
        if sha(raw) != info["sha256"]: raise CatalogError("metadata raw hash")
        metadata[path] = raw; complete.add(path)
    manifest = json.loads(metadata["manifest.json"]); index = json.loads(metadata["index.json"]); snapshot = manifest["snapshot_id"]
    if sha(metadata["manifest.json"]) != descriptor["canonical_manifest_sha256"] or snapshot != descriptor["snapshot_id"]: raise CatalogError("canonical manifest identity")
    if sha({k: v for k, v in manifest.items() if k != "snapshot_id"}) != snapshot or descriptor["counts"] != manifest["counts"]: raise CatalogError("snapshot identity/census")
    source_records = None
    if "source_records" in reference_raw:
        if sha(reference_raw["source_records"]) != manifest["rights_registry_sha256"]: raise CatalogError("source registry identity")
        source_records = {row["source_id"]: row for row in csv.DictReader(io.StringIO(reference_raw["source_records"].decode()), delimiter="\t")}
    labels_sha = descriptor.get("derived_metadata", {}).get("label_registry_sha256")
    declarations = None
    if "label_prefixes" in reference_raw:
        if sha(reference_raw["label_prefixes"]) != labels_sha: raise CatalogError("label registry identity")
        declarations = {("corpus/song/" + item["file"], item["line"]): item for item in json.loads(reference_raw["label_prefixes"])["prefixes"]}
    units = {r["reading_unit_id"]: r for r in index["readings"]}; sources = {}
    works = {work["work_id"]: work for work in index["works"]}
    for unit in units.values(): sources.setdefault(unit["source_sha256"], []).append(unit)
    allowed = {"manifest.json", "index.json", "identity_registry.json"} | {r["path"] for r in units.values() if r["availability"] == "readable"}
    allowed |= {f"sources/{h}.bin" for h, records in sources.items() if all(r["availability"] == "readable" for r in records)}
    if set(artifacts) != allowed: raise CatalogError("installed artifact allowlist")
    for path in allowed - {"manifest.json"}:
        if artifacts[path]["sha256"] != manifest["artifacts"].get(path): raise CatalogError("canonical registered hash")
    expected = {p: h for p, h in manifest["artifacts"].items() if p not in allowed}
    if {r["path"]: r["sha256"] for r in descriptor["omitted"]} != expected: raise CatalogError("omission census")
    site = descriptor["site_index"]; site_path = directory / site["path"]; files.add(site["path"])
    if site_path.stat().st_size != site["gzip_bytes"] or sha(site_path.read_bytes()) != site["gzip_sha256"]: raise CatalogError("compact index gzip hash")
    site_raw = gunzip_checked(site_path, site["raw_bytes"])
    if sha(site_raw) != site["raw_sha256"] or json.loads(site_raw) != {"snapshot_id": snapshot, "counts": descriptor["counts"], "collections": index["collections"]}: raise CatalogError("compact index identity")
    seen, fragments_state, logical_state, headers = set(), {}, {}, {}
    def check(path, raw):
        if path not in allowed or path in complete: raise CatalogError("unadmitted/duplicate packed body")
        if len(raw) != artifacts[path]["bytes"] or sha(raw) != artifacts[path]["sha256"]: raise CatalogError("packed artifact identity")
        complete.add(path)
    def check_derived(row, reading):
        summary = row["summary"]; path = summary["path"]
        if summary["source_basis"] != source_basis(reading, manifest["artifacts"][path]): raise CatalogError("derived source basis")
        labels = row.get("source_labels", [])
        if declarations is not None and labels != source_labels(reading, declarations, labels_sha): raise CatalogError("declared label sidecar")
        for label in labels:
            matching = [line for line in reading["lines"] if line["physical_line"] == label["physical_line"]]
            if len(matching) != 1 or label["registry_sha256"] != labels_sha: raise CatalogError("source label identity")
            line = matching[0]; a, b = label["codepoint_range"]
            start, end = a - line["source_cp_range"][0], b - line["source_cp_range"][0]
            if start < 0 or end > len(line["source_text"]) or line["source_text"][start:end] != label["prefix"]: raise CatalogError("source label bytes")
            projection = range_in_row(line, start, end)
            if any(label.get(key) != value for key, value in projection.items()): raise CatalogError("source label coordinates")
    for info in descriptor["packs"]:
        if info["raw_bytes"] > 1024 * 1024: raise CatalogError("pack raw limit")
        path = directory / info["path"]; files.add(info["path"])
        if path.stat().st_size != info["gzip_bytes"] or sha(path.read_bytes()) != info["gzip_sha256"]: raise CatalogError("pack gzip hash")
        raw = gunzip_checked(path, info["raw_bytes"])
        if sha(raw) != info["raw_sha256"]: raise CatalogError("pack raw hash")
        value = json.loads(raw)
        if value["snapshot_id"] != snapshot: raise CatalogError("pack snapshot")
        if info["kind"] == "readings":
            for row in value["readings"]:
                summary = row["summary"]; unit_id = summary["reading_unit_id"]
                original = units.get(unit_id, {})
                base = {key: value for key, value in summary.items() if key != "source_basis"}
                if base != compact_summary(original, works.get(original.get("work_id"))) or unit_id in seen: raise CatalogError("reading summary identity")
                basis = summary.get("source_basis", {})
                if set(basis) - (set(SOURCE_BASIS_FIELDS) | {"canonical_reading_sha256"}) or basis.get("canonical_reading_sha256") != manifest["artifacts"][summary["path"]]: raise CatalogError("source basis identity")
                if source_records is not None:
                    for record in basis.get("sources", []) + basis.get("file_sources", []):
                        if record != source_records.get(record.get("source_id")): raise CatalogError("source basis registry record")
                seen.add(unit_id)
                if row.get("reading_is_header"):
                    headers[unit_id] = row
                elif row["reading"] is not None:
                    check(summary["path"], canonical(row["reading"]))
                    check_derived(row, row["reading"])
                if summary["availability"] != "readable" and (row["reading"] is not None or row.get("reading_parts")): raise CatalogError("held body packaged")
                if summary["availability"] != "readable" and row.get("source_labels"): raise CatalogError("held label bytes packaged")
        elif info["kind"] == "sources":
            for row in value["sources"]: check(row["path"], row["text"].encode())
        elif info["kind"] == "fragments":
            artifact = value["artifact_path"]
            if artifact not in allowed: raise CatalogError("unadmitted fragment")
            state = fragments_state.setdefault(artifact, [hashlib.sha256(), 0, 0, value["part_count"]])
            if state[2] != value["part_index"] or state[3] != value["part_count"]: raise CatalogError("fragment order")
            piece = value["raw_utf8_fragment"].encode(); state[0].update(piece); state[1] += len(piece); state[2] += 1
        elif info["kind"] == "reading_chunks":
            unit_id, field = value["reading_unit_id"], value["field"]
            if unit_id not in units or units[unit_id]["availability"] != "readable" or units[unit_id]["reading_revision"] != value["reading_revision"]: raise CatalogError("unadmitted logical chunk")
            state = logical_state.setdefault((unit_id, field), {"parts": [], "paths": [], "count": value["part_count"]})
            if len(state["parts"]) != value["part_index"] or state["count"] != value["part_count"]: raise CatalogError("logical chunk order")
            body = value["value"]; start = sum(len(part) for part in state["parts"])
            if info.get("value_count") != len(body): raise CatalogError("logical chunk count")
            if isinstance(body, str):
                utf_start = sum(u16(part) for part in state["parts"])
                if info.get("codepoint_range") != [start, start + len(body)] or info.get("utf16_range") != [utf_start, utf_start + u16(body)]: raise CatalogError("logical string seek range")
            else:
                if info.get("value_range") != [start, start + len(body)]: raise CatalogError("logical array seek range")
                range_key = {"search.spans": "search_cp_range", "lines": "normalized_cp_range"}.get(field)
                if range_key:
                    ranges = [item[range_key] for item in body if item.get(range_key) is not None]
                    expected_range = [ranges[0][0], ranges[-1][1]] if ranges else None
                    if info.get(range_key) != expected_range: raise CatalogError("logical mapped seek range")
            state["parts"].append(value["value"]); state["paths"].append(info["path"])
        else: raise CatalogError("unknown pack family")
    for path, state in fragments_state.items():
        if path in complete or state[2] != state[3] or state[1] != artifacts[path]["bytes"] or state[0].hexdigest() != artifacts[path]["sha256"]: raise CatalogError("fragment artifact hash")
        complete.add(path)
    for unit_id, row in headers.items():
        reading = dict(row["reading"])
        reading.pop("line_count", None); reading.pop("physical_row_count", None)
        for field, paths in row["reading_chunks"].items():
            state = logical_state.pop((unit_id, field), None)
            if not state or state["paths"] != paths or len(state["parts"]) != state["count"]: raise CatalogError("logical chunk completeness")
            joined = "".join(state["parts"]) if isinstance(state["parts"][0], str) else [item for part in state["parts"] for item in part]
            if "." in field:
                parent, key = field.split("."); reading.setdefault(parent, {})[key] = joined
            else: reading[field] = joined
        path = row["summary"]["path"]
        if sha(canonical(reading)) != artifacts[path]["sha256"]: raise CatalogError("logical reading reconstruction")
        if row["reading"].get("line_count") != len(reading["lines"]) or row["reading"].get("physical_row_count") != reading["census"]["physical_source_rows"]: raise CatalogError("derived header census")
        check_derived(row, reading)
    if logical_state: raise CatalogError("unreferenced logical reading chunks")
    if complete != allowed or seen != set(units): raise CatalogError("packed complete census")
    actual = {p.relative_to(directory).as_posix() for p in directory.rglob("*") if p.is_file()}
    if actual != files: raise CatalogError("unclassified export file")
    return descriptor


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    descriptor = export_snapshot(args.source, args.output)
    print(json.dumps({"snapshot_id": descriptor["snapshot_id"], "counts": descriptor["counts"], "installed_files": len(descriptor["artifacts"]),
                      "installed_bytes": sum(r["bytes"] for r in descriptor["artifacts"].values()), "compressed_bytes": sum(p.stat().st_size for p in args.output.rglob('*') if p.is_file()), "packs": len(descriptor["packs"]), "omitted_files": len(descriptor["omitted"]), "output": str(args.output)}))


if __name__ == "__main__": main()

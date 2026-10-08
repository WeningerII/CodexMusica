"""Deterministic, rights-filtered corpus downloads, with bounded upload parts.

Run from lyric-harness: python -m library.catalog_downloads SNAPSHOT OUTPUT
The canonical index is held in memory; only one complete reading is loaded at a
time. Artwork and device audio are not inputs to this exporter.
"""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import tempfile
import zipfile

from library.catalog import CatalogError, canonical, sha


MAX_PART_BYTES = 8 * 1024 * 1024
CSV_FIELDS = (
    "snapshot_id", "reading_unit_id", "work_id", "edition_id", "reading_revision",
    "title", "language", "source_path", "source_sha256", "row_id",
    "physical_line", "analysis_line", "sung_line", "indent", "kind", "structure",
    "voice", "couplet", "hemistich", "text", "source_text", "terminator",
    "source_ranges", "normalized_cp_range", "normalized_utf16_range",
    "transformation_spans",
)
PROVENANCE_KEYS = (
    "reading_unit_id", "work_id", "edition_id", "reading_revision", "collection_ids",
    "title", "language", "direction", "notation", "completeness", "contributors",
    "native_id", "native_fields", "metadata", "source_path", "source_sha256",
    "source_range", "normalized_sha256", "normalizer_version", "parser_version",
    "census", "rights", "source_marks",
)


def _artifact(source, path, expected):
    candidate = source / path
    if candidate.resolve().is_relative_to(source.resolve()) is False:
        raise CatalogError("artifact path escapes snapshot")
    raw = candidate.read_bytes()
    if sha(raw) != expected:
        raise CatalogError(f"artifact hash: {path}")
    return raw


def _json_text(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _safe_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise CatalogError("unsafe reading identity")
    return value


def _zip_info(name):
    info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    return info


class _Package:
    def __init__(self, path):
        self.path = path
        self.archive = zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED,
                                       compresslevel=6, allowZip64=True)
        self.names = set()
        self.entries = 0

    def open(self, name):
        if name in self.names:
            raise CatalogError(f"duplicate ZIP entry: {name}")
        self.names.add(name)
        self.entries += 1
        return self.archive.open(_zip_info(name), "w", force_zip64=True)

    def bytes(self, name, raw):
        with self.open(name) as target:
            target.write(raw)

    def file(self, name, path):
        with path.open("rb") as source, self.open(name) as target:
            shutil.copyfileobj(source, target, 1024 * 1024)

    def close(self):
        self.archive.close()


def _attribution(reading):
    """Keep every recorded credit; notices themselves are separate verbatim files."""
    lines = [f"{reading['title']} [{reading['reading_unit_id']}]",
             f"Source: {reading['source_path']} ({reading['source_sha256']})"]
    for row in reading.get("contributors", []):
        lines.append(f"{row.get('role', 'contributor')}: {row.get('name', '')}")
        if row.get("source_declaration"):
            lines.append(f"Printed credit: {row['source_declaration']}")
    rights = reading.get("rights", {})
    for credit in rights.get("required_attribution", []):
        lines.append(f"Required attribution: {credit}")
    for declaration in rights.get("source_declarations", []):
        lines.append(f"Source declaration: {declaration}")
    for row in rights.get("sources", []) + rights.get("file_sources", []):
        lines.append(f"Rights source: {row.get('source_id', '')}")
        for key in ("licence", "jurisdiction", "evidence", "publication_evidence", "note"):
            if row.get(key):
                lines.append(f"{key}: {row[key]}")
    for notice in rights.get("notices", []):
        lines.append(f"Notice: NOTICES/{notice['sha256']}.txt (scope: {_json_text(notice.get('scope', []))})")
    return "\n".join(lines) + "\n\n"


def _csv_rows(reading, snapshot_id):
    shared = {key: reading.get(key) for key in CSV_FIELDS if key in reading}
    shared["snapshot_id"] = snapshot_id
    marks = sorted(reading.get("source_marks", []), key=lambda mark: mark.get("physical_line", 0))
    mark_index, structure, voice = 0, "", ""
    for line in reading["lines"]:
        physical_line = line.get("physical_line", 0)
        while mark_index < len(marks) and marks[mark_index].get("physical_line", 0) <= physical_line:
            mark = marks[mark_index]
            name = mark.get("name", "")
            # Preserve literal declarations; do not infer a singer from a section.
            if name.upper().startswith(("VOICE", "SINGER", "SPEAKER")):
                voice = mark.get("raw", name)
            else:
                structure = mark.get("raw", name)
            mark_index += 1
        row = {**shared, **{key: line.get(key) for key in CSV_FIELDS if key in line},
               "row_id": line.get("id"), "structure": structure, "voice": line.get("voice", voice)}
        for key in CSV_FIELDS:
            value = row.get(key)
            if isinstance(value, (list, dict)):
                row[key] = _json_text(value)
            elif value is None:
                row[key] = ""
        yield row


def _split_package(path, output, part_bytes):
    parts, full_hash, offset = [], hashlib.sha256(), 0
    with path.open("rb") as source:
        while raw := source.read(part_bytes):
            filename = f"{path.name}.part-{len(parts):05d}"
            (output / filename).write_bytes(raw)
            full_hash.update(raw)
            parts.append({"path": filename, "sha256": sha(raw), "bytes": len(raw),
                          "offset": offset, "part_index": len(parts)})
            offset += len(raw)
    return full_hash.hexdigest(), offset, parts


def build_downloads(snapshot, output, reading_ids=None, part_bytes=MAX_PART_BYTES):
    """Build all admitted readings, or an explicit admitted-ID subset without clipping.

    Source-file admission always uses the complete canonical index, including for
    selected-ID exports. Selecting a readable neighbor cannot admit a held body.
    """
    snapshot, output = Path(snapshot), Path(output)
    if not isinstance(part_bytes, int) or not 1 <= part_bytes <= MAX_PART_BYTES:
        raise CatalogError("upload part limit must be between 1 byte and 8 MiB")
    if output.exists() and any(output.iterdir()):
        raise CatalogError("download output must be empty")
    manifest_raw = (snapshot / "manifest.json").read_bytes()
    manifest = json.loads(manifest_raw)
    if sha({key: value for key, value in manifest.items() if key != "snapshot_id"}) != manifest["snapshot_id"]:
        raise CatalogError("canonical manifest hash")
    index = json.loads(_artifact(snapshot, "index.json", manifest["artifacts"]["index.json"]))
    snapshot_id = manifest["snapshot_id"]
    all_readings = index["readings"]
    requested = None if reading_ids is None else set(reading_ids)
    if requested is not None:
        known = {row["reading_unit_id"]: row for row in all_readings}
        unknown = requested - known.keys()
        if unknown:
            raise CatalogError(f"unknown selected readings: {', '.join(sorted(unknown))}")
        if any(known[unit]["availability"] != "readable" for unit in requested):
            raise CatalogError("selected reading is not admitted readable")
        if not requested:
            raise CatalogError("selected reading set is empty")
    readings = [row for row in all_readings if row["availability"] == "readable"
                and (requested is None or row["reading_unit_id"] in requested)]
    if not readings:
        raise CatalogError("snapshot has no admitted readings")
    readable_sources, held_sources = set(), set()
    for row in all_readings:
        (readable_sources if row["availability"] == "readable" else held_sources).add(row["source_sha256"])
    readable_sources -= held_sources
    selected_sources = {row["source_sha256"] for row in readings}
    source_exports = selected_sources & readable_sources
    output.mkdir(parents=True, exist_ok=True)
    packages = {kind: _Package(output / f"codex-musica-library-{kind}-{snapshot_id[:12]}.zip")
                for kind in ("text", "json", "csv")}
    notices, row_count = {}, 0
    try:
        with tempfile.TemporaryDirectory(prefix="credits-", dir=output) as temporary:
            temp = Path(temporary)
            provenance_path, attribution_path = temp / "PROVENANCE.json", temp / "ATTRIBUTION.txt"
            with provenance_path.open("w", encoding="utf-8", newline="") as provenance, \
                    attribution_path.open("w", encoding="utf-8", newline="") as attribution:
                header = {"schema_version": 1, "snapshot_id": snapshot_id,
                          "canonical_manifest_sha256": sha(manifest_raw),
                          "repository_commit": manifest["repository_commit"],
                          "scope": "all_readable" if requested is None else "selected_readings",
                          "readable_reading_count": len(readings),
                          "excluded_availability_counts": {state: sum(r["availability"] == state for r in all_readings)
                              for state in sorted({r["availability"] for r in all_readings} - {"readable"})},
                          "body_policy": "Only admitted readable reading bodies are included. Whole originals are included in JSON only when every reading sharing the source SHA is admitted.",
                          "excluded_media": ["artwork", "device_audio"],
                          "whole_original_sources": [{"source_sha256": digest, "path": f"SOURCES/{digest}.bin"}
                               for digest in sorted(source_exports)]}
                provenance.write(_json_text(header)[:-1] + ',"readings":[')
                attribution.write("Codex Musica Library — required credits and recorded source declarations\n")
                attribution.write(f"Snapshot: {snapshot_id}\nPreserve this file, PROVENANCE.json, and every NOTICES entry with redistributed material.\n\n")
                for number, summary in enumerate(readings):
                    unit_id = _safe_id(summary["reading_unit_id"])
                    raw = _artifact(snapshot, summary["path"], manifest["artifacts"][summary["path"]])
                    reading = json.loads(raw)
                    if reading["availability"] != "readable" or reading["reading_unit_id"] != unit_id:
                        raise CatalogError("reading/index admission or identity mismatch")
                    if reading["source_sha256"] != summary["source_sha256"]:
                        raise CatalogError("reading/index source mismatch")
                    if sha(reading["normalized_text"].encode("utf-8")) != reading["normalized_sha256"]:
                        raise CatalogError("normalized reading hash")
                    credit = {key: reading[key] for key in PROVENANCE_KEYS if key in reading}
                    credit.update(availability="readable", canonical_reading_sha256=sha(raw),
                                  whole_source_availability="readable" if reading["source_sha256"] in readable_sources else "held")
                    if number:
                        provenance.write(",")
                    provenance.write(_json_text(credit))
                    attribution.write(_attribution(reading))
                    for notice in reading.get("rights", {}).get("notices", []):
                        text = notice["text"].encode("utf-8")
                        if sha(text) != notice["sha256"]:
                            raise CatalogError("notice hash")
                        notices[notice["sha256"]] = text
                    # The normalized body gets no invented newline, title, or header.
                    packages["text"].bytes(f"READINGS/{unit_id}.txt", reading["normalized_text"].encode("utf-8"))
                    packages["text"].bytes(f"SOURCE-TRANSCRIPTIONS/{unit_id}.txt", reading["source_text"].encode("utf-8"))
                    packages["json"].bytes(f"READINGS/{unit_id}.json", raw)
                    with packages["csv"].open(f"READINGS/{unit_id}.csv") as stream:
                        writer = io.TextIOWrapper(stream, encoding="utf-8", newline="", write_through=True)
                        csv_writer = csv.DictWriter(writer, fieldnames=CSV_FIELDS, extrasaction="ignore", lineterminator="\r\n")
                        csv_writer.writeheader()
                        for row in _csv_rows(reading, snapshot_id):
                            csv_writer.writerow(row)
                            row_count += 1
                        writer.flush()
                        writer.detach()
                provenance.write("]}")
            for package in packages.values():
                package.file("PROVENANCE.json", provenance_path)
                package.file("ATTRIBUTION.txt", attribution_path)
                for digest, notice in sorted(notices.items()):
                    package.bytes(f"NOTICES/{digest}.txt", notice)
            for digest in sorted(source_exports):
                path = f"sources/{digest}.bin"
                source_path = snapshot / path
                expected = manifest["artifacts"].get(path)
                if expected != digest:
                    raise CatalogError("original source is not canonical")
                hasher = hashlib.sha256()
                with source_path.open("rb") as source, packages["json"].open(f"SOURCES/{digest}.bin") as target:
                    while chunk := source.read(1024 * 1024):
                        hasher.update(chunk)
                        target.write(chunk)
                if hasher.hexdigest() != digest:
                    raise CatalogError("original source hash")
    finally:
        for package in packages.values():
            package.close()
    descriptor = {"schema_version": 1, "snapshot_id": snapshot_id,
                  "scope": "all_readable" if requested is None else "selected_readings",
                  "reading_count": len(readings), "csv_row_count": row_count,
                  "notice_count": len(notices), "whole_original_source_count": len(source_exports),
                  "part_byte_limit": part_bytes, "packages": {}}
    for kind, package in packages.items():
        digest, size, parts = _split_package(package.path, output, part_bytes)
        descriptor["packages"][kind] = {"format": kind, "filename": package.path.name,
                "sha256": digest, "bytes": size, "entry_count": package.entries,
                "content_type": "application/zip", "parts": parts}
    (output / "package-manifest.json").write_bytes(canonical(descriptor))
    return descriptor


def verify_downloads(snapshot, output):
    """Read-only complete hash, admission, credit, source and CSV-fidelity gate."""
    snapshot, output = Path(snapshot), Path(output)
    manifest = json.loads((snapshot / "manifest.json").read_bytes())
    if sha({key: value for key, value in manifest.items() if key != "snapshot_id"}) != manifest["snapshot_id"]:
        raise CatalogError("canonical manifest hash")
    index = json.loads(_artifact(snapshot, "index.json", manifest["artifacts"]["index.json"]))
    descriptor = json.loads((output / "package-manifest.json").read_bytes())
    part_limit = descriptor.get("part_byte_limit")
    if descriptor.get("schema_version") != 1 or not isinstance(part_limit, int) or not 1 <= part_limit <= MAX_PART_BYTES:
        raise CatalogError("download descriptor version or part limit")
    if descriptor.get("snapshot_id") != manifest["snapshot_id"] or descriptor.get("scope") not in {"all_readable", "selected_readings"}:
        raise CatalogError("download snapshot or scope mismatch")
    if set(descriptor.get("packages", {})) != {"text", "json", "csv"}:
        raise CatalogError("download formats")
    readable = {row["reading_unit_id"]: row for row in index["readings"] if row["availability"] == "readable"}
    admitted_sources, blocked_sources = set(), set()
    for row in index["readings"]:
        (admitted_sources if row["availability"] == "readable" else blocked_sources).add(row["source_sha256"])
    admitted_sources -= blocked_sources
    selected, common_hashes, notices, csv_count, details = None, {}, set(), 0, {}

    def checked_path(path):
        candidate = output / path
        if not candidate.resolve().is_relative_to(output.resolve()):
            raise CatalogError("download path escapes output")
        return candidate

    def stream_hash(stream):
        digest = hashlib.sha256()
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
        return digest.hexdigest()

    for kind in ("csv", "json", "text"):
        info = descriptor["packages"][kind]
        package_path = checked_path(info["filename"])
        digest, length = hashlib.sha256(), 0
        for number, part in enumerate(info["parts"]):
            if part.get("part_index") != number or part.get("offset") != length:
                raise CatalogError("download part order or offset")
            raw = checked_path(part["path"]).read_bytes()
            if not 0 < len(raw) <= part_limit or len(raw) != part["bytes"] or sha(raw) != part["sha256"]:
                raise CatalogError("download part hash or size")
            digest.update(raw)
            length += len(raw)
        if length != info["bytes"] or digest.hexdigest() != info["sha256"]:
            raise CatalogError("concatenated download hash or size")
        with package_path.open("rb") as stream:
            if package_path.stat().st_size != length or stream_hash(stream) != info["sha256"]:
                raise CatalogError("download ZIP hash")
        with zipfile.ZipFile(package_path) as archive:
            names = archive.namelist()
            if len(names) != len(set(names)) or len(names) != info["entry_count"]:
                raise CatalogError("download ZIP entry census")
            if any(info.compress_type != zipfile.ZIP_DEFLATED for info in archive.infolist()):
                raise CatalogError("download ZIP compression")
            ids, carry = set(), b""
            with archive.open("PROVENANCE.json") as stream:
                while chunk := stream.read(1024 * 1024):
                    block = carry + chunk
                    ids.update(match.decode() for match in re.findall(rb'"reading_unit_id":"([^"\\]+)"', block))
                    carry = block[-128:]
            if not ids or not ids <= readable.keys() or len(ids) != descriptor["reading_count"]:
                raise CatalogError("download provenance admission or census")
            if descriptor["scope"] == "all_readable" and ids != readable.keys():
                raise CatalogError("download incomplete readable census")
            if selected is not None and ids != selected:
                raise CatalogError("download formats select different readings")
            selected = ids
            sources = {readable[unit]["source_sha256"] for unit in selected} & admitted_sources
            extension = "txt" if kind == "text" else kind
            expected_names = {f"READINGS/{unit}.{extension}" for unit in selected} | {"PROVENANCE.json", "ATTRIBUTION.txt"}
            for unit_id in sorted(selected):
                summary = readable[unit_id]
                entry = f"READINGS/{unit_id}.{extension}"
                if kind == "json":
                    if sha(archive.read(entry)) != manifest["artifacts"][summary["path"]]:
                        raise CatalogError("exported canonical reading hash")
                    continue
                reading = json.loads(_artifact(snapshot, summary["path"], manifest["artifacts"][summary["path"]]))
                if kind == "text":
                    if sha(archive.read(entry)) != reading["normalized_sha256"]:
                        raise CatalogError("exported normalized text hash")
                    source_entry = f"SOURCE-TRANSCRIPTIONS/{unit_id}.txt"
                    if archive.read(source_entry) != reading["source_text"].encode("utf-8"):
                        raise CatalogError("exported source transcription")
                    expected_names.add(source_entry)
                else:
                    notices.update(notice["sha256"] for notice in reading.get("rights", {}).get("notices", []))
                    with archive.open(entry) as raw, io.TextIOWrapper(raw, encoding="utf-8", newline="") as text:
                        rows = iter(csv.DictReader(text))
                        for expected in _csv_rows(reading, descriptor["snapshot_id"]):
                            wanted = {key: str(expected.get(key, "")) for key in CSV_FIELDS}
                            if next(rows, None) != wanted:
                                raise CatalogError("exported CSV row fidelity or census")
                            csv_count += 1
                        if next(rows, None) is not None:
                            raise CatalogError("exported extra CSV row")
            expected_names |= {f"NOTICES/{digest}.txt" for digest in notices}
            if kind == "json":
                for source in sources:
                    path = f"SOURCES/{source}.bin"
                    with archive.open(path) as stream:
                        if stream_hash(stream) != source:
                            raise CatalogError("exported original source hash")
                    expected_names.add(path)
            if set(names) != expected_names:
                raise CatalogError("download unexpected, held, or missing ZIP entries")
            for path in ["PROVENANCE.json", "ATTRIBUTION.txt"] + sorted(name for name in names if name.startswith("NOTICES/")):
                with archive.open(path) as stream:
                    digest = stream_hash(stream)
                if path.startswith("NOTICES/") and digest != Path(path).stem:
                    raise CatalogError("exported notice hash")
                if path in common_hashes and common_hashes[path] != digest:
                    raise CatalogError("download formats have different credits")
                common_hashes[path] = digest
            details[kind] = {key: info[key] for key in ("bytes", "entry_count", "sha256")}
            details[kind]["parts"] = len(info["parts"])
    if csv_count != descriptor["csv_row_count"] or len(notices) != descriptor["notice_count"] or len(sources) != descriptor["whole_original_source_count"]:
        raise CatalogError("download final census")
    return {"result": "passed", "snapshot_id": descriptor["snapshot_id"], "reading_count": len(selected),
            "csv_row_count": csv_count, "notice_count": len(notices),
            "whole_original_source_count": len(sources), "packages": details}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot")
    parser.add_argument("output")
    parser.add_argument("--reading-id", action="append", dest="reading_ids")
    parser.add_argument("--part-bytes", type=int, default=MAX_PART_BYTES)
    parser.add_argument("--verify-existing", action="store_true")
    args = parser.parse_args()
    if args.verify_existing:
        print(_json_text(verify_downloads(args.snapshot, args.output)))
        return
    result = build_downloads(args.snapshot, args.output, args.reading_ids, args.part_bytes)
    print(_json_text({"snapshot_id": result["snapshot_id"], "reading_count": result["reading_count"],
                      "manifest": str(Path(args.output) / "package-manifest.json"),
                      "packages": {kind: {key: item[key] for key in ("filename", "bytes", "sha256", "entry_count")}
                                   for kind, item in result["packages"].items()}}))


if __name__ == "__main__":
    main()

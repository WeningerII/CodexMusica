"""Exact bytes and declared redistribution decisions for the production image.

--check is the release gate. --integrity verifies bytes for development without
turning an unresolved rights record into permission. --inventory reports actual
content hashes for build identity. No command creates or changes a decision.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
import re
import shutil
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "runtime_assets.json"
READER_DIRECTORY = "library/snapshot"
RETAINED_CATALOG_PREFIX = "library_catalog_"


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def relative_path(raw):
    if not isinstance(raw, str) or not raw:
        raise ValueError("invalid asset path")
    rel = Path(raw)
    if rel.is_absolute() or ".." in rel.parts or rel == Path(".") or "\\" in raw:
        raise ValueError("invalid asset path")
    return rel.as_posix()


def file_record(path, relative):
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"missing or linked reader asset: {relative}")
    return {"path": relative_path(relative), "bytes": path.stat().st_size, "sha256": sha256(path)}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def manifest(path=MANIFEST):
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if (not isinstance(value, dict) or value.get("version") != 1
            or not isinstance(value.get("assets"), list) or not value["assets"]):
        raise ValueError("invalid runtime asset manifest")
    ids, locations = set(), set()

    def relative(raw):
        if not isinstance(raw, str) or not raw:
            raise ValueError("invalid asset path")
        rel = Path(raw)
        if rel.is_absolute() or ".." in rel.parts or rel == Path("."):
            raise ValueError("invalid asset path")
        return str(rel)

    for asset in value["assets"]:
        if (not isinstance(asset, dict) or not isinstance(asset.get("id"), str)
                or not asset["id"] or asset["id"] in ids
                or asset.get("decision") not in ("approved", "unresolved", "refused")
                or type(asset.get("runtime")) is not bool):
            raise ValueError("invalid or duplicate asset decision")
        ids.add(asset["id"])
        if (asset.get("base") not in ("root", "staged")
                or not isinstance(asset.get("files"), list) or not asset["files"]):
            raise ValueError("invalid asset location")
        if asset.get("directory") is not None:
            relative(asset["directory"])
        for entry in asset["files"]:
            if not isinstance(entry, dict):
                raise ValueError("invalid asset file declaration")
            location = (asset["base"], relative(entry.get("path")))
            digest = entry.get("sha256")
            if (location in locations or type(entry.get("bytes")) is not int or entry["bytes"] < 0
                    or not isinstance(digest, str) or len(digest) != 64
                    or any(char not in "0123456789abcdef" for char in digest)):
                raise ValueError("invalid or duplicate asset file declaration")
            locations.add(location)
    return value


def file_errors(asset, base, actual_files=None, *, nested_assets=()):
    errors = []
    for entry in asset["files"]:
        path = Path(base) / entry["path"]
        actual = {"path": entry["path"], "sha256": None, "bytes": None}
        if not path.is_file() or path.is_symlink():
            errors.append(f"{asset['id']}: missing {entry['path']}")
        else:
            actual.update(bytes=path.stat().st_size, sha256=sha256(path))
            if actual["bytes"] != entry["bytes"] or actual["sha256"] != entry["sha256"]:
                errors.append(f"{asset['id']}: byte mismatch {entry['path']}")
        if actual_files is not None:
            actual_files.append(actual)
    # A package directory is an allowlist too: added files may alter the model
    # the library loads or introduce data which the release decision never saw.
    if asset.get("directory"):
        directory = Path(base) / asset["directory"]
        expected = {str(Path(base) / entry["path"]) for entry in asset["files"]}
        # The current catalog may contain independently admitted immutable
        # snapshots. Each nested package has its own complete byte allowlist.
        expected.update(str(Path(base) / entry["path"])
                        for nested in nested_assets for entry in nested["files"])
        extra = {str(path) for path in directory.rglob("*") if path.is_file()} - expected
        errors.extend(f"{asset['id']}: undeclared file {Path(path).relative_to(base)}" for path in sorted(extra))
    return errors


def verify_asset(asset_id, *, root=ROOT, staged=None):
    root = Path(root)
    assets = manifest(root / "data" / MANIFEST.name)["assets"]
    asset = next(a for a in assets if a["id"] == asset_id)
    staged = staged or os.environ.get("LYRIC_STAGED_DATA") or Path(root) / "data"
    nested = [a for a in assets if a["id"].startswith(RETAINED_CATALOG_PREFIX)] if asset_id == "library_catalog" else []
    errors = file_errors(asset, root if asset["base"] == "root" else staged, nested_assets=nested)
    if errors:
        raise ValueError("; ".join(errors))
    return asset


def reader_reference_asset(root):
    """The registry and schema are generated in the image's assets stage."""
    root = Path(root)
    paths = ("library/methods.json", "library/schema.json", "library/catalog_manifest.schema.json")
    records = [file_record(root / relative, relative) for relative in paths]
    registry = json.loads((root / paths[0]).read_bytes())
    schema = json.loads((root / paths[1]).read_bytes())
    expected = hashlib.sha256(canonical({key: value for key, value in registry.items()
                                        if key != "registry_hash"})).hexdigest()
    if (registry.get("registry_hash") != expected or not isinstance(registry.get("methods"), list)
            or not isinstance(schema, dict) or not isinstance(schema.get("$id"), str)):
        raise ValueError("reader registry or schema identity is invalid")
    return {"id": "library_reference", "base": "root", "runtime": True,
            "decision": "approved", "reason": "Repository-authored installed method registry and contracts.",
            "registry_hash": registry["registry_hash"], "schema_sha256": records[1]["sha256"],
            "files": records}


def reader_catalog_selection(directory):
    """Select complete admitted raw artifacts without copying withheld bodies.

    Site transport packaging is independent. The canonical manifest, index and
    each installed artifact retain the hashes from the same full source build.
    """
    directory = Path(directory)
    manifest_raw = (directory / "manifest.json").read_bytes()
    value = json.loads(manifest_raw)
    snapshot_id = hashlib.sha256(canonical({key: item for key, item in value.items()
                                          if key != "snapshot_id"})).hexdigest()
    if (value.get("schema_version") != 1 or value.get("snapshot_id") != snapshot_id
            or not re.fullmatch(r"[a-f0-9]{40}", value.get("repository_commit", ""))
            or not isinstance(value.get("artifacts"), dict)):
        raise ValueError("invalid canonical reader catalog manifest")
    index_raw = (directory / "index.json").read_bytes()
    if hashlib.sha256(index_raw).hexdigest() != value["artifacts"].get("index.json"):
        raise ValueError("reader catalog index hash mismatch")
    index = json.loads(index_raw)
    counts = value["counts"]
    for family, key, identity in (("collections", "collections", "collection_id"),
                                 ("works", "works", "work_id"),
                                 ("editions", "editions", "edition_id"),
                                 ("readings", "reading_units", "reading_unit_id")):
        rows = index.get(family)
        if (not isinstance(rows, list) or counts.get(key) != len(rows)
                or any(not isinstance(row, dict) or not isinstance(row.get(identity), str) for row in rows)
                or len({row[identity] for row in rows}) != len(rows)):
            raise ValueError(f"reader catalog {family} census mismatch")
    sources = value.get("sources")
    if not isinstance(sources, list) or counts.get("source_files") != len(sources):
        raise ValueError("reader catalog source census mismatch")
    source_hashes = {row["sha256"] for row in sources}
    by_source, availability = {}, {}
    for row in index["readings"]:
        state = row.get("availability")
        if state not in {"readable", "metadata_only", "held", "rejected", "research_only"}:
            raise ValueError("invalid reader catalog availability")
        availability[state] = availability.get(state, 0) + 1
        if row.get("source_sha256") not in source_hashes:
            raise ValueError("reader catalog reading has no registered source")
        expected = f"readings/{row['reading_unit_id']}.json"
        if row.get("path") != expected or relative_path(expected) != expected:
            raise ValueError("unregistered reader catalog reading path")
        by_source.setdefault(row["source_sha256"], []).append(row)
    readable = [row for row in index["readings"] if row["availability"] == "readable"]
    actual = {"availability": availability, "readable_reading_units": len(readable),
              "readable_collections": len({cid for row in readable for cid in row["collection_ids"]}),
              "readable_works": len({row["work_id"] for row in readable}),
              "readable_editions": len({row["edition_id"] for row in readable})}
    if any(counts.get(key) != item for key, item in actual.items()):
        raise ValueError("reader catalog readable census mismatch")
    expected_artifacts = {"index.json", "identity_registry.json"}
    expected_artifacts.update(row["path"] for row in index["readings"])
    expected_artifacts.update(f"sources/{digest}.bin" for digest in source_hashes)
    if set(value["artifacts"]) != expected_artifacts:
        raise ValueError("unclassified or missing canonical reader artifact")
    admitted_sources = {digest for digest, rows in by_source.items()
                        if rows and all(row["availability"] == "readable" for row in rows)}
    selected = {"manifest.json": hashlib.sha256(manifest_raw).hexdigest(),
                "index.json": value["artifacts"]["index.json"],
                "identity_registry.json": value["artifacts"]["identity_registry.json"]}
    selected.update((row["path"], value["artifacts"][row["path"]]) for row in readable)
    selected.update((f"sources/{digest}.bin", value["artifacts"][f"sources/{digest}.bin"])
                    for digest in admitted_sources)
    if any(not re.fullmatch(r"[a-f0-9]{64}", digest) for digest in selected.values()):
        raise ValueError("invalid reader artifact digest")
    return {"snapshot_id": snapshot_id, "repository_commit": value["repository_commit"],
            "canonical_manifest_sha256": selected["manifest.json"], "counts": counts,
            "selected": selected, "readable": readable,
            "omitted_artifact_count": len(expected_artifacts) + 1 - len(selected)}


def reader_catalog_asset(directory):
    directory = Path(directory)
    selection = reader_catalog_selection(directory)
    for row in selection["readable"]:
        reading = json.loads((directory / row["path"]).read_bytes())
        revision = hashlib.sha256(canonical({key: value for key, value in reading.items()
                                            if key != "reading_revision"})).hexdigest()
        if (reading.get("availability") != "readable" or reading.get("reading_revision") != revision
                or any(reading.get(key) != row.get(key) for key in
                       ("reading_unit_id", "reading_revision", "work_id", "edition_id", "source_sha256"))):
            raise ValueError(f"reader reading admission or revision mismatch: {row['path']}")
    files = []
    for relative, expected in sorted(selection["selected"].items()):
        record = file_record(directory / relative, f"{READER_DIRECTORY}/{relative}")
        if record["sha256"] != expected:
            raise ValueError(f"reader artifact byte mismatch: {relative}")
        files.append(record)
    return {"id": "library_catalog", "base": "root", "runtime": True,
            "decision": "approved", "directory": READER_DIRECTORY,
            "reason": "Complete pinned source census; only admitted reading bodies and wholly admitted originals.",
            "snapshot_id": selection["snapshot_id"], "counts": selection["counts"],
            "repository_commit": selection["repository_commit"],
            "canonical_manifest_sha256": selection["canonical_manifest_sha256"],
            "omitted_artifact_count": selection["omitted_artifact_count"], "files": files}


def retained_reader_catalog_metadata(selection, snapshot_id, source_image):
    if (not re.fullmatch(r"[a-f0-9]{64}", snapshot_id or "")
            or not re.fullmatch(r"ghcr\.io/weningerii/codexmusica/lyrics@sha256:[a-f0-9]{64}", source_image or "")):
        raise ValueError("retained reader catalog requires a snapshot and immutable qualified image")
    if selection["snapshot_id"] != snapshot_id:
        raise ValueError("retained reader catalog snapshot does not match its pin")
    return {"id": RETAINED_CATALOG_PREFIX + snapshot_id, "base": "root", "runtime": True,
            "decision": "approved", "directory": f"{READER_DIRECTORY}/{snapshot_id}",
            "source_image": source_image,
            "reason": "Admitted immutable snapshot retained for an existing Library Site.",
            **{key: selection[key] for key in ("snapshot_id", "counts", "repository_commit",
                                               "canonical_manifest_sha256", "omitted_artifact_count")}}


def retained_reader_catalog_asset(directory, snapshot_id, source_image):
    """Admit a prior qualified catalog without changing its canonical bytes."""
    asset = reader_catalog_asset(directory)
    asset.update(retained_reader_catalog_metadata(asset, snapshot_id, source_image))
    for entry in asset["files"]:
        relative = Path(entry["path"]).relative_to(READER_DIRECTORY)
        entry["path"] = f"{asset['directory']}/{relative.as_posix()}"
    return asset


def inventory(*, root=ROOT, staged=None, release=True, manifest_path=None):
    root = Path(root)
    manifest_path = Path(manifest_path) if manifest_path is not None else root / "data" / MANIFEST.name
    staged = Path(staged or os.environ.get("LYRIC_STAGED_DATA") or root / "data")
    value = manifest(manifest_path)
    errors, assets, reader = [], [], None
    retained = [asset for asset in value["assets"] if asset["id"].startswith(RETAINED_CATALOG_PREFIX)]
    for asset in value["assets"]:
        base = root if asset["base"] == "root" else staged
        present = any((base / entry["path"]).exists() for entry in asset["files"])
        required = asset["runtime"]
        if not required and not present:
            continue
        if release and (not required or asset["decision"] != "approved"):
            errors.append(f"{asset['id']}: {asset['decision']} or research-only asset is present/required in release")
        actual_files = []
        errors.extend(file_errors(asset, base, actual_files,
                                  nested_assets=retained if asset["id"] == "library_catalog" else ()))
        item = {"id": asset["id"], "decision": asset["decision"], "runtime": required}
        if asset["id"] == "library_catalog" or asset in retained:
            # A full catalog is not a preview-size list. Keep the CLI readiness
            # envelope bounded while hashing every declared file's actual bytes.
            item.update(artifact_count=len(actual_files),
                        content_sha256=hashlib.sha256(canonical(actual_files)).hexdigest())
        else:
            item["files"] = [{"path": entry["path"], "sha256": entry["sha256"]} for entry in actual_files]
        assets.append(item)
    reader_entries = {asset["id"]: asset for asset in value["assets"]
                      if asset["id"] in {"library_catalog", "library_reference"}}
    if reader_entries:
        try:
            if set(reader_entries) != {"library_catalog", "library_reference"}:
                raise ValueError("reader catalog and method reference must be installed together")
            catalog = reader_entries["library_catalog"]
            if catalog.get("directory") != READER_DIRECTORY:
                raise ValueError("reader catalog is outside the immutable installed directory")
            selection = reader_catalog_selection(root / READER_DIRECTORY)
            expected_paths = {f"{READER_DIRECTORY}/{path}" for path in selection["selected"]}
            if {entry["path"] for entry in catalog["files"]} != expected_paths:
                raise ValueError("reader installed allowlist differs from the complete admitted census")
            if any(entry["sha256"] != selection["selected"][str(Path(entry["path"]).relative_to(READER_DIRECTORY))]
                   for entry in catalog["files"]):
                raise ValueError("reader installed hashes differ from the canonical catalog")
            if any(catalog.get(key) != selection[key] for key in
                   ("snapshot_id", "repository_commit", "canonical_manifest_sha256", "counts", "omitted_artifact_count")):
                raise ValueError("reader catalog metadata fingerprint mismatch")
            reference = reader_reference_asset(root)
            if reference["files"] != reader_entries["library_reference"]["files"]:
                raise ValueError("reader reference bytes changed")
            reader = {key: selection[key] for key in
                      ("snapshot_id", "repository_commit", "canonical_manifest_sha256", "counts", "omitted_artifact_count")}
            reader.update(registry_hash=reference["registry_hash"], schema_sha256=reference["schema_sha256"],
                          artifact_count=len(expected_paths), directory=READER_DIRECTORY)
            # Do not retain two full indexes while admitting old snapshots.
            del selection
            retained_metadata = []
            for asset in retained:
                snapshot_id = asset["id"][len(RETAINED_CATALOG_PREFIX):]
                selection = reader_catalog_selection(root / asset["directory"])
                expected = retained_reader_catalog_metadata(selection, snapshot_id, asset.get("source_image"))
                expected_hashes = {f"{expected['directory']}/{relative}": digest
                                   for relative, digest in selection["selected"].items()}
                # file_errors already hashed every actual byte once. Bind those
                # declarations to the canonical admitted census without reading
                # every complete reading a second time during startup.
                if ({key: item for key, item in asset.items() if key != "files"} != expected
                        or {entry["path"]: entry["sha256"] for entry in asset["files"]} != expected_hashes):
                    raise ValueError("retained reader catalog declaration differs from its admitted canonical census")
                retained_metadata.append({key: expected[key] for key in
                    ("snapshot_id", "repository_commit", "canonical_manifest_sha256", "counts",
                     "omitted_artifact_count", "source_image", "directory")})
                del selection
            if retained_metadata:
                reader["retained_snapshots"] = retained_metadata
        except (OSError, ValueError, KeyError, TypeError) as error:
            errors.append(f"library_catalog: {error}")
    elif retained:
        errors.append("retained reader catalogs require a current catalog and method reference")
    if release:
        allowed = {str(root / "data" / "runtime_assets.json")}
        for asset in value["assets"]:
            if asset["runtime"] and asset["decision"] == "approved":
                base = root if asset["base"] == "root" else staged
                allowed.update(str(base / entry["path"]) for entry in asset["files"])
        extra = set()
        for directory in {root / "data", staged}:
            extra.update(str(path) for path in directory.rglob("*")
                         if path.is_file() and str(path) not in allowed)
        if extra:
            errors.append(f"{len(extra)} undeclared/research data files are present in release: "
                          + ", ".join(sorted(extra)[:20]))
        research = root / "corpus"
        if research.exists() and any(path.is_file() for path in research.rglob("*")):
            errors.append("research corpus files must not be bundled into the runtime image")
    try:
        nltk = importlib.metadata.version("nltk")
    except importlib.metadata.PackageNotFoundError:
        nltk = None
    return {"version": 1, "ok": not errors, "errors": errors, "assets": assets,
            "manifest_sha256": sha256(manifest_path), "python": sys.version.split()[0], "nltk": nltk,
            "reader": reader}


def runtime_modules(root=ROOT):
    """-> the source files `assemble` ships as runtime code, and no others.

    `lyric_harness.py` and every non-test module under `quality/` and
    `library/`. Research entry points, corpus source trees and writing
    fixtures are not runtime code, so a shipped module that imports one of them
    at import time runs in the source tree and crashes only in the image.
    `quality/test_production_data.py` builds a tree from this list and
    imports every module the runtime reaches inside it.
    """
    root = Path(root)
    return [root / "lyric_harness.py"] + [path for directory in ("quality", "library")
        for path in sorted((root / directory).rglob("*.py"))
        if not path.name.startswith("test_") and "__pycache__" not in path.parts]


def assemble(target, *, root=ROOT, staged=None, reader_catalog=None, retained_reader_catalogs=()):
    """Copy only executable runtime modules and approved, byte-verified assets."""
    root, target = Path(root).resolve(), Path(target).resolve()
    staged = Path(staged or os.environ.get("LYRIC_STAGED_DATA") or root / "data")
    if target == root or root in target.parents:
        raise ValueError("runtime assembly target must be outside the source harness")
    if target.exists():
        raise ValueError("runtime assembly target already exists; use a fresh build directory")
    source_manifest = root / "data" / MANIFEST.name
    value = manifest(source_manifest)
    catalog_asset = None
    retained_assets = []
    if retained_reader_catalogs and reader_catalog is None:
        raise ValueError("retained reader catalogs require a current reader catalog")
    if reader_catalog is not None:
        if any(asset["id"] in {"library_reference", "library_catalog"} for asset in value["assets"]):
            raise ValueError("source manifest already contains assembled reader assets")
        catalog_asset = reader_catalog_asset(reader_catalog)
        value["assets"].append(reader_reference_asset(root))
        seen = {catalog_asset["snapshot_id"]}
        for directory, snapshot_id, source_image in retained_reader_catalogs:
            if snapshot_id in seen:
                raise ValueError("duplicate current or retained reader snapshot")
            seen.add(snapshot_id)
            retained_assets.append((Path(directory), retained_reader_catalog_asset(directory, snapshot_id, source_image)))
    selected = [asset for asset in value["assets"] if asset["runtime"]]
    errors = []
    for asset in selected:
        if asset["decision"] != "approved":
            errors.append(f"{asset['id']}: runtime release decision is {asset['decision']}")
        errors.extend(file_errors(asset, root if asset["base"] == "root" else staged))
    if errors:
        raise ValueError("; ".join(errors))
    target.mkdir(parents=True)
    for source in runtime_modules(root):
        destination = target / source.relative_to(root)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
    for asset in selected:
        base = root if asset["base"] == "root" else staged
        for entry in asset["files"]:
            relative = Path(entry["path"])
            destination = target / relative if asset["base"] == "root" else target / "data" / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(base / relative, destination)
    if catalog_asset is not None:
        for entry in catalog_asset["files"]:
            relative = Path(entry["path"]).relative_to(READER_DIRECTORY)
            destination = target / entry["path"]
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(Path(reader_catalog) / relative, destination)
        value["assets"].append(catalog_asset)
        current_files = {str(Path(entry["path"]).relative_to(READER_DIRECTORY)): entry
                         for entry in catalog_asset["files"]}
        for directory, asset in retained_assets:
            for entry in asset["files"]:
                relative = Path(entry["path"]).relative_to(asset["directory"])
                destination = target / entry["path"]
                destination.parent.mkdir(parents=True, exist_ok=True)
                current = current_files.get(relative.as_posix())
                if (current and current["sha256"] == entry["sha256"]
                        and current["bytes"] == entry["bytes"]):
                    # Both independently admitted packages name the same bytes.
                    # Preserve their immutable paths without doubling unchanged
                    # reading bodies in the final image's filesystem layer.
                    os.link(target / current["path"], destination)
                else:
                    shutil.copyfile(directory / relative, destination)
            value["assets"].append(asset)
        (target / "data" / MANIFEST.name).write_bytes(canonical(value) + b"\n")
    else:
        shutil.copyfile(source_manifest, target / "data" / MANIFEST.name)
    return inventory(root=target, staged=target / "data")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--integrity", action="store_true")
    parser.add_argument("--inventory", action="store_true")
    parser.add_argument("--assemble", metavar="TARGET")
    parser.add_argument("--root", default=str(ROOT))
    parser.add_argument("--staged-data")
    parser.add_argument("--reader-catalog", metavar="CANONICAL_DIRECTORY")
    parser.add_argument("--retain-reader-catalog", nargs=3, action="append", default=[],
                        metavar=("DIRECTORY", "SNAPSHOT_ID", "QUALIFIED_IMAGE"))
    args = parser.parse_args()
    try:
        if (args.reader_catalog or args.retain_reader_catalog) and not args.assemble:
            raise ValueError("--reader-catalog requires --assemble")
        result = (assemble(args.assemble, root=args.root, staged=args.staged_data,
                           reader_catalog=args.reader_catalog,
                           retained_reader_catalogs=args.retain_reader_catalog) if args.assemble else
                  inventory(root=args.root, staged=args.staged_data, release=not args.integrity))
    except (OSError, ValueError, KeyError, StopIteration) as error:
        result = {"ok": False, "errors": [str(error)]}
    print(json.dumps(result, sort_keys=True))
    return 0 if result["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())

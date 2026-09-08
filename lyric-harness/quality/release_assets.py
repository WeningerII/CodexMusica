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
import shutil
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "runtime_assets.json"


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


def file_errors(asset, base):
    errors = []
    for entry in asset["files"]:
        path = Path(base) / entry["path"]
        if not path.is_file():
            errors.append(f"{asset['id']}: missing {entry['path']}")
        elif path.stat().st_size != entry["bytes"] or sha256(path) != entry["sha256"]:
            errors.append(f"{asset['id']}: byte mismatch {entry['path']}")
    # A package directory is an allowlist too: added files may alter the model
    # the library loads or introduce data which the release decision never saw.
    if asset.get("directory"):
        directory = Path(base) / asset["directory"]
        expected = {str(Path(base) / entry["path"]) for entry in asset["files"]}
        extra = {str(path) for path in directory.rglob("*") if path.is_file()} - expected
        errors.extend(f"{asset['id']}: undeclared file {Path(path).relative_to(base)}" for path in sorted(extra))
    return errors


def verify_asset(asset_id, *, root=ROOT, staged=None):
    root = Path(root)
    asset = next(a for a in manifest(root / "data" / MANIFEST.name)["assets"] if a["id"] == asset_id)
    staged = staged or os.environ.get("LYRIC_STAGED_DATA") or Path(root) / "data"
    errors = file_errors(asset, root if asset["base"] == "root" else staged)
    if errors:
        raise ValueError("; ".join(errors))
    return asset


def inventory(*, root=ROOT, staged=None, release=True, manifest_path=None):
    root = Path(root)
    manifest_path = Path(manifest_path) if manifest_path is not None else root / "data" / MANIFEST.name
    staged = Path(staged or os.environ.get("LYRIC_STAGED_DATA") or root / "data")
    value = manifest(manifest_path)
    errors, assets = [], []
    for asset in value["assets"]:
        base = root if asset["base"] == "root" else staged
        present = any((base / entry["path"]).exists() for entry in asset["files"])
        required = asset["runtime"]
        if not required and not present:
            continue
        if release and (not required or asset["decision"] != "approved"):
            errors.append(f"{asset['id']}: {asset['decision']} or research-only asset is present/required in release")
        errors.extend(file_errors(asset, base))
        assets.append({"id": asset["id"], "decision": asset["decision"], "runtime": required,
                       "files": [{"path": entry["path"], "sha256": sha256(base / entry["path"])
                                  if (base / entry["path"]).is_file() else None} for entry in asset["files"]]})
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
            "manifest_sha256": sha256(manifest_path), "python": sys.version.split()[0], "nltk": nltk}


def assemble(target, *, root=ROOT, staged=None):
    """Copy only executable runtime modules and approved, byte-verified assets."""
    root, target = Path(root).resolve(), Path(target).resolve()
    staged = Path(staged or os.environ.get("LYRIC_STAGED_DATA") or root / "data")
    if target == root or root in target.parents:
        raise ValueError("runtime assembly target must be outside the source harness")
    if target.exists():
        raise ValueError("runtime assembly target already exists; use a fresh build directory")
    source_manifest = root / "data" / MANIFEST.name
    value = manifest(source_manifest)
    selected = [asset for asset in value["assets"] if asset["runtime"]]
    errors = []
    for asset in selected:
        if asset["decision"] != "approved":
            errors.append(f"{asset['id']}: runtime release decision is {asset['decision']}")
        errors.extend(file_errors(asset, root if asset["base"] == "root" else staged))
    if errors:
        raise ValueError("; ".join(errors))
    target.mkdir(parents=True)
    files = [root / "lyric_harness.py"] + sorted((root / "quality").rglob("*.py"))
    for source in files:
        if source.name.startswith("test_"):
            continue
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
    args = parser.parse_args()
    try:
        result = (assemble(args.assemble, root=args.root, staged=args.staged_data) if args.assemble else
                  inventory(root=args.root, staged=args.staged_data, release=not args.integrity))
    except (OSError, ValueError, KeyError, StopIteration) as error:
        result = {"ok": False, "errors": [str(error)]}
    print(json.dumps(result, sort_keys=True))
    return 0 if result["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())

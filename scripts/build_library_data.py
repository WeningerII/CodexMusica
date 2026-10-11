#!/usr/bin/env python3
"""Build the native Library tab's static data (library/data) for Pages.

Four steps (docs/library-native-design.md, "Static builder"):
  1. the canonical catalog at lyric-harness/library/snapshot (the layout
     library-site.yml uses; --rebuild-snapshot runs `library.catalog build`
     there with the repository pin from library/catalog_sources.json);
  2. the unchanged verified site exporter over it, with the label registry and
     source records asserted attached (catalog_site_export silently attaches
     nothing when it cannot find them);
  3. the static projection from the verified packs
     (lyric-harness/library/catalog_static_export.py);
  4. retention: superseded reading directories of the committed tree are kept
     for 30 days (manifest.json `retained`), dropped at once when their unit
     stops being readable;
  5. scripts/check_library_data.py over the result, against the snapshot.

The output replaces library/data only after all five pass; unchanged files keep
their committed bytes (catalog_static_export --reuse). --check rebuilds and
compares instead (CI's library-data job).

Run: python3 scripts/build_library_data.py [--out library/data] [--rebuild-snapshot] [--check]
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "lyric-harness"
SNAPSHOT = HARNESS / "library/snapshot"
sys.path.insert(0, str(HARNESS))
from library.catalog import canonical  # noqa: E402
from library.catalog_static_export import FORMAT, gz, rows_shard  # noqa: E402


def run(args, **kwargs):
    print("$", " ".join(str(a) for a in args), flush=True)
    subprocess.run(args, check=True, **kwargs)


RETENTION_DAYS = 30


def retain(static: Path, committed: Path, built_on: str):
    """Keep superseded reading directories for RETENTION_DAYS (design:
    "Retention and eligibility"): every r/<hh>/<id>/<key> directory of the
    committed tree that the new build no longer produces is copied forward,
    with the day it was first superseded recorded in manifest.json's
    `retained`, until that day is more than RETENTION_DAYS before built_on.
    Eligibility wins: a directory whose unit is no longer readable is dropped
    at once. The manifest is rewritten to list the retained files."""
    manifest_path = static / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    readable = {u for p in static.glob("u/*.json.gz")
                for u, _k, _c in json.loads(gzip.decompress(p.read_bytes()))["units"]}
    previous = {}
    if (committed / "manifest.json").exists():
        previous = json.loads((committed / "manifest.json").read_text()).get("retained", {})
    today = date.fromisoformat(built_on)
    retained = {}
    for head in sorted(committed.glob("r/*/*/*/head.json.gz")) if committed.exists() else []:
        directory = head.parent.relative_to(committed).as_posix()
        unit = head.parent.parent.name
        if (static / directory).exists() or unit not in readable:
            continue
        since = previous.get(directory, built_on)
        if (today - date.fromisoformat(since)).days > RETENTION_DAYS:
            continue
        shutil.copytree(head.parent, static / directory)
        retained[directory] = since
        for f in sorted((static / directory).iterdir()):
            data = f.read_bytes()
            manifest["files"][f.relative_to(static).as_posix()] = {
                "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
        carry_references(static, committed, head, manifest)
    manifest["built_on"] = built_on
    manifest["retained"] = retained
    manifest["files"] = dict(sorted(manifest["files"].items()))
    manifest_path.write_bytes(json.dumps(manifest, ensure_ascii=False, sort_keys=True,
                                         separators=(",", ":")).encode("utf-8"))
    return retained


def carry_references(static: Path, committed: Path, head_path: Path, manifest: dict):
    """A retained head still names its rights object, that object's
    sources.tsv rows and notices, and its metadata header (rights_ref,
    metadata_ref). The new build writes those content-addressed shards from
    the current readings only, so whatever the retained head needs and the
    new tree lacks is carried forward from the committed tree: merged into
    the new shard files, or (a notice) copied. A retained reading then
    reconstructs exactly as it did when it was current."""
    head = json.loads(gzip.decompress(head_path.read_bytes()))

    def objects(root: Path, path: str, family: str) -> dict:
        file = root / path
        return json.loads(gzip.decompress(file.read_bytes()))[family] if file.is_file() else {}

    wanted = {}  # shard path -> (family, {ref: object})

    def want(path: str, family: str, ref: str):
        found = objects(committed, path, family)
        if ref not in found:
            raise SystemExit(f"retention: the committed tree lacks {family} {ref} ({path})")
        wanted.setdefault(path, (family, {}))[1][ref] = found[ref]

    rights_ref, metadata_ref = head["rights_ref"], head["metadata_ref"]
    want(f"rights/r-{rights_ref[:2]}.json.gz", "rights", rights_ref)
    interned = wanted[f"rights/r-{rights_ref[:2]}.json.gz"][1][rights_ref]
    for key in ("sources", "file_sources"):
        for digest in interned[key]:
            want(f"rights/rows-{rows_shard(digest)}.json.gz", "rows", digest)
    want(f"meta/{rows_shard(metadata_ref)}.json.gz", "metadata", metadata_ref)
    for notice in interned["notices"]:
        path = f"notices/{notice['sha256']}.json"
        if not (static / path).is_file():
            if not (committed / path).is_file():
                raise SystemExit(f"retention: the committed tree lacks notice {notice['sha256']}")
            (static / path).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(committed / path, static / path)
            data = (static / path).read_bytes()
            manifest["files"][path] = {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
    for path, (family, carried) in sorted(wanted.items()):
        current = objects(static, path, family)
        if all(ref in current for ref in carried):
            continue
        raw = canonical({"format": FORMAT, family: {**current, **carried}})
        old = committed / path
        # The committed bytes when they already hold exactly this content
        # (a rebuild never rewrites a published file over zlib differences).
        data = old.read_bytes() if old.is_file() and gzip.decompress(old.read_bytes()) == raw else gz(raw)
        (static / path).parent.mkdir(parents=True, exist_ok=True)
        (static / path).write_bytes(data)
        manifest["files"][path] = {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}


def compare(built: Path, committed: Path):
    """Differences between a fresh build and the committed tree. Every file is
    byte-compared (the build reused committed bytes wherever content matched),
    except catalog.json's projected_from, a provenance label that names the
    snapshot it was projected from and is excluded from freshness: a catalog
    input change that leaves the readable units unchanged moves only it, and
    so the manifest's entry for catalog.json."""
    def files(root):
        return {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()} if root.exists() else set()
    a, b = files(built), files(committed)
    problems = [f"missing: {p}" for p in sorted(a - b)] + [f"unexpected: {p}" for p in sorted(b - a)]
    for path in sorted(a & b):
        new, old = (built / path).read_bytes(), (committed / path).read_bytes()
        if path == "catalog.json":
            strip = lambda raw: {k: v for k, v in json.loads(raw).items() if k != "projected_from"}  # noqa: E731
            same = strip(new) == strip(old)
        elif path == "manifest.json":
            def strip(raw):
                value = json.loads(raw)
                value.pop("projected_from", None)
                value["files"] = {k: v for k, v in value["files"].items() if k != "catalog.json"}
                return value
            same = strip(new) == strip(old)
        else:
            same = new == old
        if not same:
            problems.append(f"differs: {path}")
    return problems


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=ROOT / "library/data")
    parser.add_argument("--rebuild-snapshot", action="store_true")
    parser.add_argument("--check", action="store_true",
                        help="rebuild and compare with the committed tree instead of replacing it")
    parser.add_argument("--built-on", help="the build day (YYYY-MM-DD) retention counts from; "
                        "default: today, or the committed tree's own day with --check")
    args = parser.parse_args(argv)
    built_on = args.built_on
    if built_on is None and args.check and (args.out / "manifest.json").exists():
        built_on = json.loads((args.out / "manifest.json").read_text()).get("built_on")
    built_on = built_on or datetime.now(timezone.utc).date().isoformat()

    if args.rebuild_snapshot or not (SNAPSHOT / "manifest.json").exists():
        pin = json.loads((HARNESS / "library/catalog_sources.json").read_text())["repository_commit"]
        shutil.rmtree(SNAPSHOT, ignore_errors=True)
        run([sys.executable, "-m", "library.catalog", "build", "--output", "library/snapshot",
             "--repo-sha", pin, "--source-manifest", "library/catalog_sources.json"], cwd=HARNESS)

    with tempfile.TemporaryDirectory(prefix="library-data-") as work:
        export, static = Path(work) / "export", Path(work) / "static"
        run([sys.executable, "-m", "library.catalog_site_export", "--source", "library/snapshot",
             "--output", str(export)], cwd=HARNESS)
        descriptor = json.loads((export / "import_manifest.json").read_text())
        want = hashlib.sha256((HARNESS / "data/lyric_label_prefixes.json").read_bytes()).hexdigest()
        if descriptor["derived_metadata"]["label_registry_sha256"] != want:
            sys.exit("the label registry was not attached to the export")
        if not {"label_prefixes", "source_records"} <= set(descriptor.get("references", {})):
            sys.exit("the source records or label prefixes were not attached to the export")
        reuse = ["--reuse", str(args.out)] if args.out.exists() else []
        run([sys.executable, "-m", "library.catalog_static_export", str(export), str(static), *reuse], cwd=HARNESS)
        retained = retain(static, args.out, built_on)
        print(f"retained {len(retained)} superseded reading directories (built_on {built_on})")
        run([sys.executable, str(ROOT / "scripts/check_library_data.py"), str(static), "--snapshot", str(SNAPSHOT)])
        if args.check:
            problems = compare(static, args.out)
            for problem in problems[:50]:
                print("STALE", problem)
            if problems:
                print(f"library/data is stale: {len(problems)} difference(s). Run: python3 scripts/build_library_data.py")
                return 1
            print("library/data is current")
            return 0
        shutil.rmtree(args.out, ignore_errors=True)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(static, args.out)
    print(f"library data written to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

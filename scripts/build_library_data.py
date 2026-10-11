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
  4. scripts/check_library_data.py over the result, against the snapshot.

The output replaces library/data only after all four pass.

Run: python3 scripts/build_library_data.py [--out library/data] [--rebuild-snapshot]
"""
from __future__ import annotations

import argparse
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


def run(args, **kwargs):
    print("$", " ".join(str(a) for a in args), flush=True)
    subprocess.run(args, check=True, **kwargs)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=ROOT / "library/data")
    parser.add_argument("--rebuild-snapshot", action="store_true")
    args = parser.parse_args(argv)

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
        run([sys.executable, "-m", "library.catalog_static_export", str(export), str(static)], cwd=HARNESS)
        run([sys.executable, str(ROOT / "scripts/check_library_data.py"), str(static), "--snapshot", str(SNAPSHOT)])
        shutil.rmtree(args.out, ignore_errors=True)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(static, args.out)
    print(f"library data written to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Stage the lexical resources the quality layer needs.

Everything here is fetched from hosts this environment's network policy
permits (GitHub raw, PyPI). Most text-archive hosts, including Gutenberg and
archive.org, are 403 at the gateway, which is why the corpus used in the first
run is the one that happened to be reachable rather than one chosen on merit.
See quality/PREREGISTRATION.md -- no corpus here is privileged, and English is
one cell in a matrix, not the referent.

Note also that the resources staged below are English-specific: Brysbaert
concreteness is an English norming study and the tagger is an English model.
Any port to a second tradition needs its own equivalents, and features that
cannot be restated without them are not language-agnostic.
"""

import os
import sys
import zipfile
import tempfile
import shutil
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

# THE RETRY POLICY IS NOT RESTATED HERE (doctrine 1). Both stagers fetch over
# the same network from the same host family, and two answers to "how many
# attempts, how long a wait, which errors" is how they start disagreeing.
# `lyric_harness` owns it because that is where the failure was measured.
from lyric_harness import download_to  # noqa: E402
# WHERE TO STAGE IS NOT DECIDED HERE EITHER (doctrine 1; `MISSING.md` M-188,
# 2026-09-01). `quality/features.py` reads both resources and is the one
# place the directory -- and its `LYRIC_STAGED_DATA` override -- is resolved;
# this stager imports it so nothing can be staged into one directory and
# looked for in another. ~~DATA = os.path.join(HERE, "..", "data") /
# NLTK_DIR = os.path.join(DATA, "nltk")~~ were this file's own copies.
from quality.features import DATA, NLTK_DIR, nltk_data_dir  # noqa: E402
from quality.release_assets import manifest, sha256, file_errors  # noqa: E402

RAW = "https://raw.githubusercontent.com"
_ASSETS = {asset["id"]: asset for asset in manifest()["assets"]}

# Historical packages are not dependencies of current research or production.
HISTORICAL_ASSETS = frozenset(("tagger_legacy", "punkt_tab"))


def selected_assets(*, runtime=True):
    """Default to production inputs; current research explicitly opts in."""
    return [asset for asset in _ASSETS.values()
            if asset["base"] == "staged"
            and (asset["runtime"] or not runtime)
            and asset["id"] not in HISTORICAL_ASSETS]


def _get(url, dest, expected_sha256=None):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        if expected_sha256 and sha256(dest) != expected_sha256:
            raise ValueError(f"staged asset checksum mismatch: {dest}; restore the declared bytes")
        return False
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    sys.stderr.write(f"  fetching {os.path.basename(dest)} ... ")
    sys.stderr.flush()
    # The guard above admits any file of NON-ZERO size, so a transfer that
    # died part-way used to be staged forever after. `download_to` writes to
    # `<dest>.part` and renames only on success, which is what makes that
    # guard safe rather than merely fast.
    download_to(url, dest)
    if expected_sha256 and sha256(dest) != expected_sha256:
        os.remove(dest)
        raise ValueError(f"downloaded asset checksum mismatch: {url}")
    sys.stderr.write(f"{os.path.getsize(dest):,} bytes\n")
    return True


def fetch_all(runtime=True):
    # Hashes and pinned URLs live in the same manifest the release image uses.
    # A nonempty file or empty package directory is never proof of staging.
    for asset in selected_assets(runtime=runtime):
        if not asset.get("directory"):
            entry = asset["files"][0]
            _get(asset["url"], os.path.join(DATA, entry["path"]), entry["sha256"])
            continue
        target = Path(DATA) / asset["directory"]
        if target.exists():
            errors = file_errors(asset, DATA)
            if errors:
                raise ValueError("; ".join(errors))
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        # Extract only after checking the official archive hash; verify the
        # exact decompressed population before atomically installing it.
        with tempfile.TemporaryDirectory(prefix="lyric-stage-", dir=target.parent) as temporary:
            temporary = Path(temporary)
            archive = temporary / "package.zip"
            _get(asset["url"], archive, asset["archive_sha256"])
            with zipfile.ZipFile(archive) as zipped:
                for member in zipped.infolist():
                    name = Path(member.filename)
                    if name.is_absolute() or ".." in name.parts:
                        raise ValueError("unsafe lexical package member")
                zipped.extractall(temporary)
            extracted = temporary / target.name
            check_base = temporary / "checked"
            installed = check_base / asset["directory"]
            installed.parent.mkdir(parents=True)
            shutil.move(extracted, installed)
            errors = file_errors(asset, check_base)
            if errors:
                raise ValueError("; ".join(errors))
            os.replace(installed, target)
    nltk_data_dir()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--runtime", action="store_true", help="stage production inputs (default)")
    modes.add_argument("--research", action="store_true", help="also stage current research feature inputs")
    args = parser.parse_args()
    fetch_all(runtime=not args.research)
    print(f"staged into {os.path.abspath(DATA)}")

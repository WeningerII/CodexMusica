"""Write the immutable per-unit manifest of one built Library snapshot.

The native Library tab promises no regression in readable works. That promise
is checked against these manifests, not against counts: every reading unit of
a snapshot, readable or not, is one row, so a later build can be classified id
by id (scripts/check_library_regression.js).

    python -m library.unit_manifest SNAPSHOT_DIR OUT.tsv.gz \\
        --builder-root=LYRIC_HARNESS_DIR --builder-commit=SHA

SNAPSHOT_DIR is the output of `python -m library.catalog build` (manifest.json,
index.json, identity_registry.json and readings/). LYRIC_HARNESS_DIR is the
lyric-harness tree that built it, and SHA the commit that tree came from; the
manifest records that builder's rights policy and the blob ids of its
library/catalog.py and quality/provenance.py, so the baseline names exactly
which rules produced it.

NOTHING IS COPIED ON TRUST. Before a row is written:
  - the manifest's snapshot_id must equal sha(manifest without it);
  - index.json must hash to the manifest's artifact entry;
  - every unit's reading file must exist, hash to its artifact entry, carry
    the same id and availability as the index, and hash to its own revision;
  - availability must be a known value, every hash a 64-hex digest, and a
    readable unit must hold at least one admitting verdict and no unresolved
    source (the catalog's own rule, library/catalog.py).
Any failure stops the run; a partial or stale snapshot cannot produce a
baseline.

The file is deterministic: rows sorted by reading_unit_id, gzip with mtime 0.
Columns: reading_unit_id, availability, reading_revision, artifact_sha256,
normalized_sha256, admission (sorted, de-duplicated verdicts).
"""

import argparse
import gzip
import hashlib
import importlib.util
import io
import json
import re
import subprocess
import sys
from pathlib import Path

COLUMNS = (
    "reading_unit_id",
    "availability",
    "reading_revision",
    "artifact_sha256",
    "normalized_sha256",
    "admission",
)
SNAPSHOT_FIELDS = (
    "snapshot_id",
    "repository_commit",
    "rights_registry_sha256",
    "identity_registry_sha256",
    "parser_version",
    "normalizer_version",
)
AVAILABILITY = {"readable", "held", "research_only", "rejected"}
HEX64 = re.compile(r"[0-9a-f]{64}")
UNIT_ID = re.compile(r"reading_[a-f0-9-]{36}")


class ManifestError(Exception):
    pass


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha(value):
    return hashlib.sha256(value if isinstance(value, bytes) else canonical(value)).hexdigest()


def load_policy(builder_root):
    """The builder's own rights policy, read from its quality/provenance.py."""
    path = builder_root / "quality" / "provenance.py"
    spec = importlib.util.spec_from_file_location("_builder_provenance", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules["_builder_provenance"] = module
    spec.loader.exec_module(module)
    declaration = module.ProvenanceDeclaration()
    return module.ADMITTED, {
        "policy.admitted_verdicts": ",".join(sorted(module.ADMITTED)),
        "policy.current_year": str(declaration.current_year),
        "policy.term_years": str(declaration.term_years),
        "policy.anon_term_years": str(declaration.anon_term_years),
        "policy.cutoff_death_year": str(declaration.cutoff_death_year()),
        "policy.allow_source_affirmation": str(declaration.allow_source_affirmation).lower(),
        "policy.gutenberg_basis": "Project Gutenberg USA public-domain affirmation (ADMIT_PD_AFFIRMED); a USA statement",
    }


def blob_id(path):
    return subprocess.run(
        ["git", "hash-object", str(path)], check=True, capture_output=True, text=True
    ).stdout.strip()


def rows(snapshot_dir, admitted):
    manifest_bytes = (snapshot_dir / "manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    if sha({k: v for k, v in manifest.items() if k != "snapshot_id"}) != manifest.get("snapshot_id"):
        raise ManifestError("manifest.json does not hash to its snapshot_id")
    artifacts = manifest["artifacts"]
    index_bytes = (snapshot_dir / "index.json").read_bytes()
    if sha(index_bytes) != artifacts.get("index.json"):
        raise ManifestError("index.json does not match its manifest artifact entry")
    index = json.loads(index_bytes)
    out = []
    for reading in index["readings"]:
        rid = reading.get("reading_unit_id", "")
        if not UNIT_ID.fullmatch(rid):
            raise ManifestError(f"malformed reading_unit_id {rid!r}")
        availability = reading.get("availability")
        if availability not in AVAILABILITY:
            raise ManifestError(f"{rid}: unknown availability {availability!r}")
        path = f"readings/{rid}.json"
        if reading.get("path") != path or path not in artifacts:
            raise ManifestError(f"{rid}: reading is not a registered artifact")
        raw = (snapshot_dir / path).read_bytes()
        if sha(raw) != artifacts[path]:
            raise ManifestError(f"{rid}: reading file does not match its artifact entry")
        body = json.loads(raw)
        if body.get("reading_unit_id") != rid or body.get("availability") != availability:
            raise ManifestError(f"{rid}: reading file disagrees with the index")
        if body.get("reading_revision") != reading.get("reading_revision"):
            raise ManifestError(f"{rid}: reading revision disagrees with the index")
        if sha({k: v for k, v in body.items() if k != "reading_revision"}) != body["reading_revision"]:
            raise ManifestError(f"{rid}: reading does not hash to its revision")
        if body.get("normalized_sha256") != reading.get("normalized_sha256"):
            raise ManifestError(f"{rid}: normalized hash disagrees with the index")
        reason = reading.get("availability_reason") or {}
        verdicts = sorted({e.get("verdict") for e in reason.get("admission", []) if e.get("verdict")})
        if availability == "readable":
            if not set(verdicts) & set(admitted):
                raise ManifestError(f"{rid}: readable without an admitting verdict")
            if reason.get("unresolved"):
                raise ManifestError(f"{rid}: readable with unresolved sources")
        values = (
            rid,
            availability,
            reading["reading_revision"],
            artifacts[path],
            reading.get("normalized_sha256") or "",
            ",".join(verdicts),
        )
        for value in values[2:5]:
            if not HEX64.fullmatch(value):
                raise ManifestError(f"{rid}: {value!r} is not a sha256 digest")
        for value in values:
            if "\t" in value or "\n" in value:
                raise ManifestError(f"{rid}: value holds a tab or newline")
        out.append(values)
    out.sort()
    if len({r[0] for r in out}) != len(out):
        raise ManifestError("duplicate reading_unit_id")
    counts = {}
    for row in out:
        counts[row[1]] = counts.get(row[1], 0) + 1
    if counts != manifest["counts"]["availability"]:
        raise ManifestError(f"availability counts {counts} differ from the manifest's")
    return manifest, out, counts


def render(manifest, table, counts, builder):
    lines = ["# codex-musica.library-unit-manifest v2"]
    for field in SNAPSHOT_FIELDS:
        lines.append(f"# {field}: {manifest.get(field, '')}")
    for key, value in builder.items():
        lines.append(f"# {key}: {value}")
    lines.append(f"# units: {len(table)}")
    for availability in sorted(counts):
        lines.append(f"# availability.{availability}: {counts[availability]}")
    lines.append("\t".join(COLUMNS))
    lines.extend("\t".join(row) for row in table)
    return ("\n".join(lines) + "\n").encode("utf-8")


def gzip_bytes(raw):
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode="wb", compresslevel=9, mtime=0, filename="") as out:
        out.write(raw)
    return buffer.getvalue()


def main(argv):
    parser = argparse.ArgumentParser(description="Write a Library per-unit manifest.")
    parser.add_argument("snapshot")
    parser.add_argument("output")
    parser.add_argument("--builder-root", required=True, help="the lyric-harness tree that built the snapshot")
    parser.add_argument("--builder-commit", required=True, help="the commit that tree came from")
    args = parser.parse_args(argv[1:])
    if not re.fullmatch(r"[0-9a-f]{40}", args.builder_commit):
        raise ManifestError("--builder-commit must be a full 40-hex commit id")
    root = Path(args.builder_root)
    admitted, policy = load_policy(root)
    builder = {
        "builder_commit": args.builder_commit,
        "builder_blob.library/catalog.py": blob_id(root / "library" / "catalog.py"),
        "builder_blob.quality/provenance.py": blob_id(root / "quality" / "provenance.py"),
        **policy,
    }
    manifest, table, counts = rows(Path(args.snapshot), admitted)
    data = gzip_bytes(render(manifest, table, counts, builder))
    Path(args.output).write_bytes(data)
    print(f"{args.output}: {len(table)} units, sha256 {hashlib.sha256(data).hexdigest()}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except ManifestError as error:
        print(f"unit_manifest: {error}", file=sys.stderr)
        sys.exit(1)

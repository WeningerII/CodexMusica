"""Write the immutable per-unit manifest of one built Library snapshot.

The native Library tab promises no regression in readable works. That promise
is checked against these manifests, not against counts: every reading unit of
a snapshot, readable or not, is one row, so a later build can be classified id
by id (scripts/check_library_regression.js).

    python -m library.unit_manifest SNAPSHOT_DIR OUT.tsv.gz

SNAPSHOT_DIR is the output of `python -m library.catalog build` (it holds
manifest.json and index.json). The file is deterministic: rows sorted by
reading_unit_id, gzip with mtime 0, so the same snapshot always yields the same
bytes and the checker can pin each committed manifest by sha256.

Columns:
  reading_unit_id   the stable unit id
  availability      readable | held | research_only | ...
  reading_revision  sha256 of the canonical reading
  artifact_sha256   manifest.artifacts[path], the stored reading's bytes
  normalized_sha256 sha256 of the normalized text
  admission         the sorted, de-duplicated admission verdicts
"""

import gzip
import hashlib
import io
import json
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
HEADER_FIELDS = (
    "snapshot_id",
    "repository_commit",
    "rights_registry_sha256",
    "identity_registry_sha256",
    "parser_version",
    "normalizer_version",
)


def rows(snapshot_dir):
    manifest = json.loads((snapshot_dir / "manifest.json").read_text(encoding="utf-8"))
    index = json.loads((snapshot_dir / "index.json").read_text(encoding="utf-8"))
    artifacts = manifest["artifacts"]
    out = []
    for reading in index["readings"]:
        verdicts = sorted(
            {
                entry.get("verdict", "")
                for entry in (reading.get("availability_reason") or {}).get("admission", [])
                if entry.get("verdict")
            }
        )
        values = (
            reading["reading_unit_id"],
            reading["availability"],
            reading["reading_revision"],
            artifacts.get(reading["path"], ""),
            reading.get("normalized_sha256") or "",
            ",".join(verdicts),
        )
        for value in values:
            if "\t" in value or "\n" in value:
                raise ValueError(f"unit manifest value holds a tab or newline: {value!r}")
        out.append(values)
    out.sort()
    if len({r[0] for r in out}) != len(out):
        raise ValueError("unit manifest: duplicate reading_unit_id")
    return manifest, out


def render(manifest, table):
    counts = {}
    for row in table:
        counts[row[1]] = counts.get(row[1], 0) + 1
    lines = ["# codex-musica.library-unit-manifest v1"]
    for field in HEADER_FIELDS:
        lines.append(f"# {field}: {manifest.get(field, '')}")
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
    if len(argv) != 3:
        print(__doc__.strip().splitlines()[0], file=sys.stderr)
        print("usage: python -m library.unit_manifest SNAPSHOT_DIR OUT.tsv.gz", file=sys.stderr)
        return 2
    manifest, table = rows(Path(argv[1]))
    data = gzip_bytes(render(manifest, table))
    Path(argv[2]).write_bytes(data)
    print(f"{argv[2]}: {len(table)} units, sha256 {hashlib.sha256(data).hexdigest()}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

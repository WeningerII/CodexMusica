#!/usr/bin/env python3
"""Download only API-selected comparison archives; verify their ZIP digests.

Receipts are copied byte for byte. A retry never relabels an old receipt as
new execution. The aggregate and deployment verifier retain both attempts.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import urllib.error
import urllib.request
import zipfile

from production_qualification import validate_provenance


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def download(repository, artifact_id, token):
    # Authenticate to GitHub only. Never forward its token to the signed blob URL.
    request = urllib.request.Request(
        f"https://api.github.com/repos/{repository}/actions/artifacts/{artifact_id}/zip",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"})
    try:
        response = urllib.request.build_opener(NoRedirect).open(request, timeout=30)
    except urllib.error.HTTPError as error:
        if error.code != 302:
            raise
        url = error.headers.get("Location", "")
        if not url.startswith("https://"):
            raise ValueError("Artifact redirect is not HTTPS") from None
        response = urllib.request.urlopen(url, timeout=30)
    with response:
        data = response.read(100 * 1024 * 1024 + 1)
    if len(data) > 100 * 1024 * 1024:
        raise ValueError("Comparison archive exceeds bounded size")
    return data


def receipt_bytes(entry, archive):
    if "sha256:" + hashlib.sha256(archive).hexdigest() != entry["artifact_digest"]:
        raise ValueError("Comparison archive digest mismatch")
    name = entry["component"] + ".json"
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        matches = [i for i in z.infolist() if i.filename == name]
        if len(matches) != 1 or matches[0].file_size > 4 * 1024 * 1024:
            raise ValueError("Missing, duplicated or oversized comparison receipt")
        # Read the exact named member, never extract paths from an archive.
        return z.read(matches[0])


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("provenance")
    ap.add_argument("--out-dir", required=True)
    args = ap.parse_args()
    provenance = json.loads(Path(args.provenance).read_text())
    validate_provenance(provenance, int(os.environ["GITHUB_RUN_ATTEMPT"]))
    repository = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GITHUB_TOKEN"]
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    if list(out.iterdir()):
        raise ValueError("Comparison receipt directory must be empty")
    for entry in provenance:
        data = receipt_bytes(entry, download(repository, entry["artifact_id"], token))
        (out / (entry["component"] + ".json")).write_bytes(data)
        print(f'{entry["component"]}: execution attempt {entry["executed_attempt"]}, artifact {entry["artifact_id"]}, digest verified')


if __name__ == "__main__":
    main()

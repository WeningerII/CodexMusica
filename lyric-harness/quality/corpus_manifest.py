#!/usr/bin/env python3
"""The calibration-set manifest: WHICH corpus state the adopted constants
were measured on, as a declared snapshot instead of an implication.

THE PROBLEM THIS SOLVES.  Every corpus-derived adoption (the meter bands,
the floor profiles, the tier-2 modal table, the structure-census chance
rates) is measured against "whatever is in corpus/ today", and the CI
--check lanes re-derive against the live tree — which is exactly right
for catching silent drift and exactly wrong for GROWTH: the moment a
loading pass stages one new song, every check lane goes red at once, and
the corpus cannot grow except in adoption-sized bites.  The manifest
turns the implicit population into a declared coordinate (the same move
Declaration made for thresholds): data/calibration_manifest.tsv records
file, md5, and line count for every file under corpus/ as of the
snapshot date, so "the corpus the constants describe" and "the corpus on
disk" become two things that can differ VISIBLY and be reconciled
DELIBERATELY, by re-adopting and re-snapshotting in one sitting.

WHAT THIS IS NOT (yet).  Nothing reads the manifest today — the --check
lanes still re-derive against the live tree, so the pre-manifest
discipline (batch loads, then re-adopt, then CI green) still binds.
Rewiring the lanes to measure against the manifest'd snapshot is its own
deliberate sitting, recorded in quality/CORPUS_LOADING_PROTOCOL.md; a
manifest nothing reads is a RECORD, and the record half is what loading
needs first: after a load, `--check` here names exactly which files are
new or changed relative to the state the adoptions describe.

Run: python3 quality/corpus_manifest.py --write   (snapshot, deliberate)
     python3 quality/corpus_manifest.py --check   (diff; exit 3 on drift)
--check's nonzero exit is exit 3, answered-with-a-difference — drift
against the manifest is the EXPECTED state mid-load, an answer and not a
failure, and it must not share exit 2 with refusals.
"""

import hashlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
CORPUS = os.path.join(ROOT, "corpus")
MANIFEST = os.path.join(ROOT, "data", "calibration_manifest.tsv")

#: What the snapshot covers: every regular file under corpus/.  The
#: gitignored staging caches (data/nltk etc.) live outside corpus/, so a
#: plain walk is the population — matching audit_corpus's own walk.


def scan():
    rows = []
    for dirpath, _dirs, files in os.walk(CORPUS):
        for f in sorted(files):
            p = os.path.join(dirpath, f)
            rel = os.path.relpath(p, ROOT)
            blob = open(p, "rb").read()
            rows.append((rel, hashlib.md5(blob).hexdigest(),
                         blob.count(b"\n")))
    return sorted(rows)


def write(stamp):
    rows = scan()
    with open(MANIFEST, "w", encoding="utf-8") as f:
        f.write("file\tmd5\tlines\tsnapshot\n")
        for rel, md5, lines in rows:
            f.write(f"{rel}\t{md5}\t{lines}\t{stamp}\n")
    print(f"MANIFEST: {len(rows)} corpus files snapshotted ({stamp})")
    return 0


def read_manifest():
    rows = {}
    with open(MANIFEST, encoding="utf-8") as f:
        f.readline()
        for ln in f:
            rel, md5, lines, stamp = ln.rstrip("\n").split("\t")
            rows[rel] = (md5, int(lines), stamp)
    return rows


def check():
    recorded = read_manifest()
    live = {rel: (md5, lines) for rel, md5, lines in scan()}
    new = sorted(set(live) - set(recorded))
    gone = sorted(set(recorded) - set(live))
    changed = sorted(rel for rel in set(live) & set(recorded)
                     if live[rel][0] != recorded[rel][0])
    if not (new or gone or changed):
        print(f"MANIFEST: the live corpus IS the calibration set — "
              f"{len(live)} files, byte-identical")
        return 0
    print(f"MANIFEST: the live corpus is NOT the state the adopted "
          f"constants describe — {len(new)} new, {len(gone)} gone, "
          f"{len(changed)} changed. An ANSWER, not a failure: finish the "
          f"loading batch, re-derive and re-adopt the corpus-calibrated "
          f"constants, then --write a fresh snapshot in the same sitting.")
    for rel in new:
        print(f"  NEW      {rel}")
    for rel in gone:
        print(f"  GONE     {rel}")
    for rel in changed:
        print(f"  CHANGED  {rel} (recorded {recorded[rel][0][:8]}… "
              f"measured {live[rel][0][:8]}…)")
    return 3


def main(argv):
    if argv == ["--check"]:
        return check()
    if len(argv) == 2 and argv[0] == "--write":
        return write(argv[1])
    print("REFUSED — usage: corpus_manifest.py --write YYYY-MM-DD | --check\n"
          "  --write is a DELIBERATE act: it declares 'the adopted "
          "constants describe this corpus state', so it belongs in the "
          "same sitting as a re-adoption, never in a loading loop.")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

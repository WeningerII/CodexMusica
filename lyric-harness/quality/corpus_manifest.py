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


#: THE CALIBRATED POPULATIONS.  quality/CORPUS_LOADING_PROTOCOL.md names four
#: corpus-derived adoptions and says a load's closing sitting must "re-derive
#: and re-adopt" them.  But a drift that lands OUTSIDE every one of those
#: populations owes no re-derivation at all — and until this table existed,
#: the two states were indistinguishable in the output: "I re-derived and
#: nothing moved" and "the glob never looked at those files" both showed up
#: as a green --check lane and a manifest --write.  That is the shape this
#: repo keeps filing against itself, so the difference is forced here.
#:
#: Each entry names the module that OWNS the population and is ASKED for it —
#: never told.  A re-typed glob here would be a second definition of the
#: question (doctrine 1), and the copy is what goes stale the first time a
#: load stages a new language prefix, which is exactly the case this table
#: exists to adjudicate.
CALIBRATED = (
    ("meter bands", "quality.meter_bands"),
    ("the song floor profile", "quality.song_profile_calibration"),
    ("the rhyme-position tables", "quality.build_song_frequency"),
    ("structure-census chance rates", "quality.structure_census"),
)


def _population(modname):
    """-> the set of repo-relative paths that module measures.

    Asks the module, three ways, in the order of decreasing directness: a
    `corpus_files()` accessor, then a declared `CORPUS_GLOB`.  A module that
    answers neither is a REFUSAL, not an empty set — an unaskable population
    is indistinguishable from a population nothing entered, and guessing
    which is exactly the error this table exists to prevent.
    """
    import glob as _glob
    import importlib
    if ROOT not in sys.path:
        sys.path.insert(0, ROOT)
    mod = importlib.import_module(modname)
    if hasattr(mod, "corpus_files"):
        paths = mod.corpus_files()
    elif hasattr(mod, "CORPUS_GLOB"):
        paths = _glob.glob(os.path.join(ROOT, mod.CORPUS_GLOB))
    else:
        raise LookupError(
            f"{modname} declares no corpus_files() and no CORPUS_GLOB, so "
            f"its population cannot be ASKED. Declare one there; do not "
            f"re-type its glob here.")
    return {os.path.relpath(os.path.abspath(p), ROOT) for p in paths}


def readoption_owed(drifted):
    """-> ([(adoption, [rel])], [(adoption, error)]) for the drifted files.

    The first list is the adoptions a re-derivation is OWED to; the second is
    the ones that could not be asked.  An unaskable population is reported,
    never counted as clean.
    """
    hits, unaskable = [], []
    for label, modname in CALIBRATED:
        try:
            pop = _population(modname)
        except Exception as exc:                     # noqa: BLE001 — reported
            unaskable.append((label, f"{type(exc).__name__}: {exc}"))
            continue
        inside = sorted(set(drifted) & pop)
        if inside:
            hits.append((label, inside))
    return hits, unaskable


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

    drifted = new + changed        # a GONE file cannot be re-measured
    hits, unaskable = readoption_owed(drifted)
    print()
    if unaskable:
        for label, err in unaskable:
            print(f"  UNASKABLE  {label} — {err}")
        print("  RE-ADOPTION VERDICT WITHHELD: a population that cannot be "
              "asked is not a population nothing entered.")
    elif hits:
        print("  RE-ADOPTION IS OWED — the drift lands inside:")
        for label, inside in hits:
            print(f"    {label}: {len(inside)} file(s)")
            for rel in inside[:8]:
                print(f"      {rel}")
            if len(inside) > 8:
                print(f"      … and {len(inside) - 8} more")
    else:
        print(f"  NO RE-ADOPTION IS OWED BY THIS DRIFT: all "
              f"{len(drifted)} drifted file(s) fall OUTSIDE every one of the "
              f"{len(CALIBRATED)} calibrated populations, so no adopted "
              f"constant can have moved.")
        print("  This is NOT the same claim as 're-derived, nothing "
              "changed' — nothing was re-derived, because nothing looked. "
              "--write is licensed on that ground and no other.")
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

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

The calibration --check lanes still re-derive against the live tree, so
the discipline (batch loads, then re-adopt, then CI green) still binds.
Since 2026-09-08, the corpus source-hash audit also reads this manifest
to verify staged bytes independently of upstream/source declarations.
It does not replace the live population with saved source text. After a
load, `--check` here names exactly which files are new, removed or changed
relative to the state the adoptions describe, including reader/policy drift.

Run: python3 quality/corpus_manifest.py --write   (snapshot, deliberate)
     python3 quality/corpus_manifest.py --check   (diff; exit 3 on drift)
--check's nonzero exit is exit 3, answered-with-a-difference — drift
against the manifest is the EXPECTED state mid-load, an answer and not a
failure, and it must not share exit 2 with refusals.
"""

import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
CORPUS = os.path.join(ROOT, "corpus")
MANIFEST = os.path.join(ROOT, "data", "calibration_manifest.tsv")
POPULATIONS = os.path.join(ROOT, "data", "calibration_populations.json")

#: What the snapshot covers: every regular file under corpus/.  The
#: gitignored staging caches (data/nltk etc.) live outside corpus/, so a
#: plain walk is the population — matching audit_corpus's own walk.


#: THE CALIBRATED POPULATIONS.  quality/CORPUS_LOADING_PROTOCOL.md names six
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
    ("the lyric length curves", "quality.length_curve_calibration"),
    ("the rhyme-position tables", "quality.build_song_frequency"),
    ("structure-census chance rates", "quality.structure_census"),
    ("certified rhyme-capacity witnesses", "quality.capacity"),
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


def readoption_owed(drifted, recorded_populations=None):
    """-> ([(adoption, [rel])], [(adoption, error)]) for the drifted files.

    The first list is the adoptions a re-derivation is OWED to; the second is
    the ones that could not be asked.  An unaskable population is reported,
    never counted as clean.
    """
    hits, unaskable = [], []
    if recorded_populations is None:
        try:
            with open(POPULATIONS, encoding="utf-8") as fh:
                recorded_populations = json.load(fh)["populations"]
        except (OSError, ValueError, KeyError):
            recorded_populations = {}
    for label, modname in CALIBRATED:
        try:
            pop = _population(modname)
            pop |= set(recorded_populations.get(modname, ()))
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
    import datetime
    import tempfile
    from quality.lyric_reader import population_fingerprint
    datetime.date.fromisoformat(stamp)
    rows = scan()
    if not rows:
        raise ValueError("cannot publish an empty calibration snapshot")
    manifest_text = "file\tmd5\tlines\tsnapshot\n" + "".join(
        f"{rel}\t{md5}\t{lines}\t{stamp}\n" for rel, md5, lines in rows)
    # Resolve every owner before opening either destination. A missing
    # module or failed population query must preserve the previous pair.
    try:
        populations = {module: sorted(_population(module)) for _label, module in CALIBRATED}
    except Exception as error:
        raise ValueError(f"cannot measure a calibration owner: {error}") from error
    population_text = json.dumps({"version": 2, "snapshot": stamp,
        "manifest_sha256": hashlib.sha256(manifest_text.encode()).hexdigest(),
        "reader_fingerprint": population_fingerprint(), "populations": populations}, indent=2) + "\n"
    staged = []
    try:
        for path, payload in ((MANIFEST, manifest_text), (POPULATIONS, population_text)):
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", delete=False,
                    dir=os.path.dirname(path), prefix=os.path.basename(path) + ".", suffix=".tmp") as stream:
                staged.append((stream.name, path))
                stream.write(payload)
        for temporary, path in staged:
            os.replace(temporary, path)
    finally:
        for temporary, _path in staged:
            if os.path.exists(temporary):
                os.unlink(temporary)
    print(f"MANIFEST: {len(rows)} corpus files and {len(populations)} populations snapshotted ({stamp})")
    return 0


def read_manifest():
    import datetime
    import re
    from pathlib import PurePosixPath
    rows = {}
    with open(MANIFEST, encoding="utf-8") as f:
        if f.readline().rstrip("\n") != "file\tmd5\tlines\tsnapshot":
            raise ValueError("invalid calibration manifest header")
        for number, ln in enumerate(f, 2):
            fields = ln.rstrip("\n").split("\t")
            if len(fields) != 4:
                raise ValueError(f"invalid calibration manifest row {number}")
            rel, md5, lines, stamp = fields
            path = PurePosixPath(rel)
            if (not rel.startswith("corpus/") or path.is_absolute() or ".." in path.parts
                    or str(path) != rel or rel in rows
                    or not re.fullmatch(r"[0-9a-f]{32}", md5)
                    or not re.fullmatch(r"[0-9]+", lines)):
                raise ValueError(f"invalid or duplicate calibration manifest row {number}")
            datetime.date.fromisoformat(stamp)
            rows[rel] = (md5, int(lines), stamp)
    if not rows:
        raise ValueError("empty calibration manifest")
    return rows


def check():
    recorded = read_manifest()
    live = {rel: (md5, lines) for rel, md5, lines in scan()}
    new = sorted(set(live) - set(recorded))
    gone = sorted(set(recorded) - set(live))
    changed = sorted(rel for rel in set(live) & set(recorded)
                     if live[rel][0] != recorded[rel][0])
    from quality.lyric_reader import population_fingerprint
    metadata = None
    try:
        with open(POPULATIONS, encoding="utf-8") as stream:
            metadata = json.load(stream)
        if not isinstance(metadata, dict) or not isinstance(metadata.get("populations"), dict):
            raise ValueError("invalid population snapshot")
        if metadata.get("version") == 2:
            with open(MANIFEST, "rb") as stream:
                digest = hashlib.sha256(stream.read()).hexdigest()
            if metadata.get("manifest_sha256") != digest:
                print("REFUSED — corpus manifest and population snapshot are from different publications")
                return 2
        reader_matches = (metadata.get("reader_fingerprint") == population_fingerprint()
                          and set(metadata["populations"]) == {module for _label, module in CALIBRATED})
    except (OSError, ValueError):
        metadata = None
        reader_matches = False
    if not (new or gone or changed) and reader_matches:
        print(f"MANIFEST: the live corpus IS the calibration set — "
              f"{len(live)} files, byte-identical")
        return 0
    if not reader_matches:
        print("READER/WORK POLICY MOVED: normalized rows or edition weights changed; every current calibration requires re-adoption.")
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

    drifted = new + changed + gone
    hits, unaskable = readoption_owed(drifted)
    if not reader_matches:
        present = {label for label, _inside in hits}
        hits.extend((label, ["normalized reader / explicit work policy"]) for label, _module in CALIBRATED if label not in present)
    if gone and metadata is None:
        unaskable.append(("historical calibration membership",
                          "the adopted population snapshot is missing; removed files cannot be classified"))
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
        try:
            return check()
        except (OSError, ValueError) as error:
            print(f"REFUSED — cannot read the calibration snapshot: {error}")
            return 2
    if len(argv) == 2 and argv[0] == "--write":
        try:
            return write(argv[1])
        except (OSError, ValueError) as error:
            print(f"REFUSED — cannot publish the calibration snapshot: {error}")
            return 2
    print("REFUSED — usage: corpus_manifest.py --write YYYY-MM-DD | --check\n"
          "  --write is a DELIBERATE act: it declares 'the adopted "
          "constants describe this corpus state', so it belongs in the "
          "same sitting as a re-adoption, never in a loading loop.")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

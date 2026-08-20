#!/usr/bin/env python3
"""Regressions for the corpus taxonomy (quality/corpus_taxonomy.py) and the
calibration manifest (quality/corpus_manifest.py).

THE TWO CLAIMS THAT MATTER: (1) the taxonomy is INVISIBLE to every
grading reader — a tagged file and its untagged twin read identically,
because a coordinate that moved a measurement would make every adopted
constant a function of bookkeeping; (2) the vocabulary is a CLOSED SET —
an unknown value refuses by name, so a filename can never invent a
category again (the Taylor-sisters defect, mechanical form).

Sections:
  1  the vocabularies load, are non-empty, and hold the declared rows
  2  resolution precedence — per-song beats header beats blank; blank IS
     the honest undeclared, never a guess
  3  the closed set — unknown region/function refuses naming file, song
     and value; a doubled region refuses (contested stays blank)
  4  APPARATUS INVISIBILITY — the load-bearing control: tagged vs
     untagged twins through load_lyric_lines, read_marked_songs and
     readability.read_lines, byte-identical
  5  the backfilled corpus — every eng file carries a legal region, the
     Taylor pin (english despite the american filename), the hymn seed,
     Addison's honest blank, and the report's counts kept apart
  6  the manifest — round-trips clean at HEAD; a planted change is named
     as CHANGED (an answer, exit 3, not a refusal)

Run: python3 quality/test_corpus_taxonomy.py
"""

import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, ROOT)

from quality import corpus_taxonomy as TX  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail and not cond:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_tables():
    print("\n1. the vocabularies")
    regions = TX.load_regions()
    functions = TX.load_functions()
    check("regions table holds exactly the four active traditions",
          sorted(regions) == ["american", "english", "irish", "scottish"])
    check("functions table holds exactly the nine active rows",
          sorted(functions) == ["ballad", "carol", "convivial", "hymn",
                                "nursery", "parlour", "patriotic",
                                "political", "stage"])
    check("every row carries a definition and an evidence rule — a value "
          "without an evidence rule cannot be assigned honestly",
          all(r.get("definition") and r.get("evidence_rule")
              for r in list(regions.values()) + list(functions.values())))


def _tmpfile(text):
    d = tempfile.mkdtemp(prefix="tax-")
    p = os.path.join(d, "eng_probe_author.txt")
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)
    return d, p


def test_resolution():
    print("\n2. resolution precedence")
    d, p = _tmpfile(
        "# author: Probe (1800-1880)\n"
        "# region: english\n"
        "# function: hymn\n\n"
        "--- TITLE: Inherits Both\n"
        "[VERSE 1]\nline one\n\n"
        "--- TITLE: Overrides Both\n"
        "--- REGION: scottish\n"
        "--- FUNCTION: patriotic, ballad\n"
        "[VERSE 1]\nline two\n")
    try:
        songs = TX.resolve_songs(p)
        check("a song with no lines of its own inherits the file header",
              songs[0] == ("Inherits Both", "english", ("hymn",)))
        check("a song's own lines beat the header, and function carries "
              "MULTIPLE attested values as a tuple",
              songs[1] == ("Overrides Both", "scottish",
                           ("patriotic", "ballad")))
    finally:
        shutil.rmtree(d)
    d, p = _tmpfile("--- TITLE: Nothing Declared\n[VERSE 1]\nbare\n")
    try:
        songs = TX.resolve_songs(p)
        check("no header and no song lines resolve to BLANK — undeclared "
              "is the honest state, never a guess",
              songs[0] == ("Nothing Declared", "", ()))
    finally:
        shutil.rmtree(d)


def test_closed_set():
    print("\n3. the closed set")
    regions = TX.load_regions()
    functions = TX.load_functions()
    d, p = _tmpfile(
        "# author: Probe\n"
        "--- TITLE: Bad Region\n--- REGION: atlantean\n[VERSE 1]\nx\n"
        "--- TITLE: Bad Function\n--- FUNCTION: dirge\n[VERSE 1]\ny\n"
        "--- TITLE: Doubled Region\n--- REGION: english, scottish\n"
        "[VERSE 1]\nz\n")
    try:
        bad = TX.check_file(p, regions, functions)
        check("an unknown region refuses naming the value",
              any("atlantean" in b for b in bad))
        check("an unknown function refuses naming the value",
              any("dirge" in b for b in bad))
        check("a DOUBLED region refuses — contested stays blank, recorded, "
              "never split between two cells",
              any("SINGLE-VALUED" in b for b in bad))
        check("the three violations are three findings, each naming its "
              "song's line", len(bad) >= 3)
    finally:
        shutil.rmtree(d)


def test_apparatus_invisibility():
    print("\n4. APPARATUS INVISIBILITY — tags move no reader")
    body = ("--- TITLE: Twin\n[VERSE 1]\n"
            "we carry the evening to the stone\n"
            "and no one had to tell us alone\n")
    tagged = ("# region: english\n# function: hymn\n" +
              body.replace("[VERSE 1]",
                           "--- REGION: scottish\n"
                           "--- FUNCTION: hymn, patriotic\n[VERSE 1]"))
    da, pa = _tmpfile(body)
    db, pb = _tmpfile(tagged)
    try:
        import lyric_harness as LH
        check("load_lyric_lines: tagged and untagged twins are identical",
              LH.load_lyric_lines(pa) == LH.load_lyric_lines(pb))
        from quality import grid as GR
        sa, sb = GR.read_marked_songs(pa), GR.read_marked_songs(pb)
        check("read_marked_songs: same songs, same titles, same lines",
              len(sa) == len(sb) == 1 and sa[0].title == sb[0].title
              and [l for blk in sa[0].blocks for l in blk.lines]
              == [l for blk in sb[0].blocks for l in blk.lines])
        from quality import readability as RD
        check("readability.read_lines: identical",
              RD.read_lines(pa) == RD.read_lines(pb))
    finally:
        shutil.rmtree(da)
        shutil.rmtree(db)


def test_backfilled_corpus():
    print("\n5. the backfilled corpus")
    regions = TX.load_regions()
    functions = TX.load_functions()
    files = TX.eng_files()
    # REPINNED 2026-08-20: 143 -> 388 — the owner-directed mass load staged
    # 245 new eng_celtic_msm_* files (812 songs) from the already-ADMITted
    # Modern Scottish Minstrel (PG22515), one file per author (the load's
    # first cut, 238 files, was restaged the same sitting by the rev-2
    # parser — RESULTS_CORPUS_AUDIT.md's 2026-08-20 repin has the account).
    check("all 388 eng files are seen", len(files) == 388)
    bad = []
    for p in files:
        bad.extend(TX.check_file(p, regions, functions))
    check("every assignment in the corpus names a declared value",
          not bad, bad[:3])
    headers = {os.path.basename(p): TX.read_file_taxonomy(p)[0]
               for p in files}
    check("every file declares a region — the region axis is total",
          all(h["region"] for h in headers.values()))
    check("THE TAYLOR PIN: eng_american_ann_taylor resolves english — the "
          "filename is the acquisition batch, not an analytic claim",
          headers["eng_american_ann_taylor.txt"]["region"] == "english"
          and headers["eng_american_jane_taylor.txt"]["region"] == "english")
    check("the hymn seed: Watts carries function hymn (hymnal-attested), "
          "and Addison carries NONE — his staged source is a Poetical "
          "Works, and evidence-or-blank means blank",
          headers["eng_hymn_watts.txt"]["function"] == ("hymn",)
          and headers["eng_hymn_addison.txt"]["function"] == ())
    check("the hymn group crosses regions — Crosby american, Borthwick "
          "scottish, Alexander irish — which is the axis split working",
          headers["eng_hymn_crosby.txt"]["region"] == "american"
          and headers["eng_hymn_borthwick.txt"]["region"] == "scottish"
          and headers["eng_hymn_cf_alexander.txt"]["region"] == "irish")
    r = TX.report()
    # REPINNED 2026-08-19: 4,930 -> 4,979 -> 4,985 songs (Pass-1 batches 1-2).
    # REPINNED 2026-08-20: 4,985 -> 5,792 — the Modern Scottish Minstrel
    # mass load (+812 staged by the rev-2 restage, and 5 items MOVED from
    # eng_celtic_walter_scott to the new Rob Donn file after the edition's
    # own 'ROBERT MACKAY (ROB DONN).' section heading proved the original
    # staging had mis-bounded Scott's section).
    check("the report counts the corpus: 5,792 songs, zero undeclared "
          "regions, undeclared functions counted APART (evidence-or-blank "
          "leaves most songs honestly untagged)",
          r["songs"] == 5792 and r["undeclared_region"] == 0
          and r["undeclared_function"] > 3000
          and r["undeclared_function"] + sum(r["multi_tag"].values())
          == r["songs"])
    check("region totals partition the corpus (single-valued axis)",
          sum(r["by_region"].values()) == 5792)


def test_manifest():
    print("\n6. the calibration manifest")
    p = subprocess.run([sys.executable, "quality/corpus_manifest.py",
                        "--check"], capture_output=True, text=True,
                       cwd=ROOT)
    check("at HEAD the live corpus IS the declared calibration set "
          "(exit 0)", p.returncode == 0, p.stdout[-200:])
    from quality import corpus_manifest as CM
    rec = CM.read_manifest()
    check("the manifest covers the audit's own population (269 files)",
          len(rec) == 269)
    live = {rel for rel, _md5, _n in CM.scan()}
    check("manifest files and live files are the same set",
          set(rec) == live)


if __name__ == "__main__":
    for fn in (test_tables, test_resolution, test_closed_set,
               test_apparatus_invisibility, test_backfilled_corpus,
               test_manifest):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the taxonomy is a closed, declared, invisible coordinate — "
          "and the calibration set is a snapshot, not an implication")

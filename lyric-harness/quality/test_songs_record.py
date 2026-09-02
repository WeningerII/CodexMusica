#!/usr/bin/env python3
"""The banked series, and the check aimed at the narrator.

`quality/song_record.py` exists because every report about these songs was a
PASS/FAIL bit read aloud as a judgement. This file keeps that instrument
honest: the series must be re-derivable, the drift check must be two-sided,
and the claim check must catch an uncited superlative AND pass a cited one.
"""
import os
import re
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from quality import song_record as R              # noqa: E402

FAILURES = []


def check(msg, ok, detail=""):
    print(f"  {'PASS' if ok else 'FAIL'}  {msg}")
    if detail:
        print(f"          {detail}")
    if not ok:
        FAILURES.append(msg)


def test_the_series_exists_and_is_rederivable():
    print("\n1. the series — banked, and re-derivable from the bytes")
    rows = R.read_rows()
    check("songs/RESULTS.tsv carries rows, so this file cannot pass by "
          "examining nothing", bool(rows), f"{len(rows)} row(s)")
    names = set(R.header())
    check("every banked row carries every declared column — a row missing a "
          "feature is a row that cannot be compared to the next one",
          all(set(r) == names for r in rows),
          f"{len(names)} column(s): {sorted(names - {'song'})[:4]}...")
    songs = {os.path.basename(p) for p in R.songs()}
    banked = {r["song"] for r in rows}
    check("every delivered song has a banked row — an unmeasured song is the "
          "hole the whole file was written to close",
          songs <= banked, f"unbanked: {sorted(songs - banked) or 'none'}")


def test_the_commit_is_a_key_column():
    """2. A ROW NOBODY CAN ATTRIBUTE IS A ROW NOBODY CAN TRUST.

    The song's bytes never change, so a moved number means the TREE moved.
    Without the commit the delta is a mystery; with it, it is attributable.
    A dirty tree is not a commit and must SAY so rather than pass as one.
    """
    print("\n2. the harness commit, and the dirty-tree disclosure")
    c = R.harness_commit()
    check("a commit column is produced at all", bool(c), c)
    check("...and a dirty working tree is DISCLOSED in the value rather than "
          "passing as a clean commit (doctrine 20)",
          c == "UNKNOWN" or re.fullmatch(r"[0-9a-f]{7,}(-WORKING)?", c),
          c)


def test_the_drift_check_is_two_sided():
    """3. MUTATION — perturb a banked number and require --check to FAIL."""
    print("\n3. the drift detector is two-sided")
    rc = R.cmd_check()
    check("--check PASSES against the series as banked, so it cannot be "
          "satisfied by failing on everything", rc == 0, f"rc={rc}")
    real = R.RESULTS
    backup = open(real, encoding="utf-8").read()
    try:
        lines = backup.splitlines()
        head = lines[0].split("\t")
        i = head.index("concreteness_mean")
        # The perturbed row must be one --check READS. The series is
        # append-only and GENERATIONAL — a song re-banked at a newer harness
        # commit gets a new row, and cmd_check consults newest_per_song only
        # (last occurrence wins). Perturbing lines[1] flat mutated a row the
        # detector never consults the day a second generation landed, and
        # this check sat green at rc=0 with the mutation in place. The row is
        # picked by the same last-wins rule the instrument applies, so a
        # later generation moves the target with it instead of vacating it.
        s = head.index("song")
        song0 = lines[1].split("\t")[s]
        idx = max(k for k in range(1, len(lines))
                  if lines[k].split("\t")[s] == song0)
        row = lines[idx].split("\t")
        row[i] = "9.999999"               # the tree "moved"
        lines[idx] = "\t".join(row)
        open(real, "w", encoding="utf-8").write("\n".join(lines) + "\n")
        rc_bad = R.cmd_check()
    finally:
        open(real, "w", encoding="utf-8").write(backup)
    check("...and with ONE banked feature perturbed it FAILS and names the "
          "song and the feature — a song's bytes cannot change, so a moved "
          "number is the tree moving and must be loud",
          rc_bad == 1, f"rc={rc_bad}")
    check("...and the mutation is reverted, leaving the series as found",
          open(real, encoding="utf-8").read() == backup)


def test_the_claim_check_is_two_sided():
    """4. THE ONE AIMED AT ME. An uncited superlative must fail; a cited,
    resolving one must pass. Both arms, or the check is decoration."""
    print("\n4. the claim check catches the narrator, both ways")
    rc = R.cmd_claims()
    check("--claims PASSES on songs/README.md as committed", rc == 0,
          f"rc={rc}")
    real = R.README
    backup = open(real, encoding="utf-8").read()
    try:
        open(real, "a", encoding="utf-8").write(
            "\nThis is the best song here by a mile.\n")
        rc_bad = R.cmd_claims()
        open(real, "w", encoding="utf-8").write(backup)
        song = sorted({r["song"] for r in R.read_rows()})[0]
        open(real, "a", encoding="utf-8").write(
            f"\nIt scores lowest on that feature "
            f"[RESULTS: concreteness_mean {song}].\n")
        rc_cited = R.cmd_claims()
        open(real, "w", encoding="utf-8").write(backup)
        open(real, "a", encoding="utf-8").write(
            "\nThe best one [RESULTS: not_a_column nope.txt].\n")
        rc_bogus = R.cmd_claims()
    finally:
        open(real, "w", encoding="utf-8").write(backup)
    check("an UNCITED superlative FAILS — 'the best song here by a mile' is "
          "the exact sentence this instrument exists to refuse",
          rc_bad == 1, f"rc={rc_bad}")
    check("...a CITED comparison that RESOLVES passes, so the check is not "
          "just a ban on the word 'best'", rc_cited == 0, f"rc={rc_cited}")
    check("...and a citation naming a column and a song that do not exist "
          "FAILS, so the citation cannot be decoration",
          rc_bogus == 1, f"rc={rc_bogus}")
    check("...and README is restored byte-for-byte",
          open(real, encoding="utf-8").read() == backup)


def test_the_sonnet_discriminator_is_refused():
    """5. THE REFUSAL IS STRUCTURAL, NOT A PROMISE IN PROSE.

    `discriminate.py` is fitted on 152 sonnets at a fixed 14-line scheme.
    Scoring a 25-line song through it would be a measurement laundered out of
    its domain. This file must not import it — checked, because a docstring
    saying "we don't do that" is not a reason we don't.
    """
    print("\n5. the sonnet-fitted discriminator is not reachable from here")
    src = open(os.path.join(ROOT, "quality", "song_record.py"),
               encoding="utf-8").read()
    body = "\n".join(l for l in src.splitlines()
                     if not l.strip().startswith("#"))
    check("song_record.py does not import `discriminate` — the refusal is "
          "enforced by absence, not asserted in prose",
          "import discriminate" not in body
          and "from quality.discriminate" not in body)
    check("...and it DOES read the pre-registered feature names from "
          "features.py rather than copying them, so it cannot drift from the "
          "pre-registration it reports",
          "QualityFeatures.NAMES" in src, str(R.feature_names()[:3]))


def test_a_row_is_written_on_a_commit():
    print("\n6. a row is keyed on a commit, so it is written on one "
          "(`MISSING.md` M-196)")
    # 124 of 164 banked rows carried `-WORKING` on 2026-09-01, every song's
    # latest among them. The bank was re-written once on a clean tree, the
    # writer refuses a dirty tree unless told, and this section holds both.
    import os
    import tempfile
    newest = R.newest_per_song(R.read_rows())
    dirty = sorted(n for n, r in newest.items()
                   if r["harness_commit"].endswith("-WORKING"))
    check("every song's LATEST banked row carries a clean sha — a "
          "measurement keyed to a tree that exists as a commit",
          newest and not dirty, f"dirty latest rows: {dirty}")
    real_commit, real_results = R.harness_commit, R.RESULTS
    tmp = tempfile.NamedTemporaryFile(suffix=".tsv", delete=False)
    tmp.close()
    try:
        R.harness_commit = lambda: "abc1234-WORKING"
        R.RESULTS = tmp.name
        rc = R.cmd_write()
        wrote = os.path.getsize(tmp.name) > 0
        check("`--write` on a dirty tree REFUSES (exit 2) and writes nothing",
              rc == 2 and not wrote, f"rc {rc}, wrote {wrote}")
    finally:
        R.harness_commit, R.RESULTS = real_commit, real_results
        os.unlink(tmp.name)
    from quality import song_log as SL
    import io
    import contextlib
    real_commit = R.harness_commit
    try:
        R.harness_commit = lambda: "abc1234-WORKING"
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            # `python3` by name, not `sys.executable`: `verb_of` reads the
            # verb past the interpreter's NAME, and a full path would make
            # the refusal below the "no parser" one — the wrong reason.
            rc2 = SL.record("no_such_song", ["python3", "lyric_harness.py",
                                             "screen", "cat", "hat"])
        check("`--record` on a dirty tree REFUSES before the command runs "
              "(a refused record costs nothing) — for the DIRTY reason, "
              "with the verb resolved",
              rc2 == 2 and "dirty" in buf.getvalue()
              and "no declared parser" not in buf.getvalue(),
              f"rc {rc2}: {buf.getvalue().strip()[:90]}")
    finally:
        R.harness_commit = real_commit
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "song_record.py"), encoding="utf-8").read()
    check("...and `--allow-dirty` is the DECLARED way past, in both writers",
          "--allow-dirty" in src
          and "--allow-dirty" in open(os.path.join(
              os.path.dirname(os.path.abspath(__file__)), "song_log.py"),
              encoding="utf-8").read())


if __name__ == "__main__":
    for fn in (test_the_series_exists_and_is_rederivable,
               test_the_commit_is_a_key_column,
               test_the_drift_check_is_two_sided,
               test_the_claim_check_is_two_sided,
               test_the_sonnet_discriminator_is_refused,
               test_a_row_is_written_on_a_commit):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {'; '.join(FAILURES)}")
        sys.exit(1)
    print("the series is re-derivable and a comparison must cite it")

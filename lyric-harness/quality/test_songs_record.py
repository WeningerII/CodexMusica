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
        head, first = lines[0].split("\t"), lines[1].split("\t")
        i = head.index("concreteness_mean")
        first[i] = "9.999999"               # the tree "moved"
        open(real, "w", encoding="utf-8").write(
            "\n".join([lines[0], "\t".join(first)] + lines[2:]) + "\n")
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


if __name__ == "__main__":
    for fn in (test_the_series_exists_and_is_rederivable,
               test_the_commit_is_a_key_column,
               test_the_drift_check_is_two_sided,
               test_the_claim_check_is_two_sided,
               test_the_sonnet_discriminator_is_refused):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {'; '.join(FAILURES)}")
        sys.exit(1)
    print("the series is re-derivable and a comparison must cite it")

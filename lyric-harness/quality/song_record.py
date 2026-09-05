#!/usr/bin/env python3
"""THE SONGS AS FIXED WITNESSES — a banked measurement, not an opinion.

    python3 quality/song_record.py --write    # score every song, append rows
    python3 quality/song_record.py --check    # re-derive; FAIL on drift
    python3 quality/song_record.py --claims   # README claims vs the numbers

WHY THIS EXISTS
---------------
Five songs shipped and nothing compared any of them to any other. Every
report about them was a PASS/FAIL bit — `song` exit 0, `revise` 0 rounds —
read aloud as if it were a judgement of quality. It is not: BOTH drafts of
`carry_it_over` were exit 0 with 0 rounds, the fragment version and the
rewrite, and no gate in this tree can tell them apart. A bit that cannot
separate those two cannot support a sentence containing the word "best".

WHAT IS RECORDED, AND WHAT IS REFUSED
-------------------------------------
RECORDED: the ten pre-registered features (`quality/features.py`) and the
shape. All of it re-derivable from the committed bytes, so a later run either
reproduces it or names the difference.

REFUSED: a corpus-relative "quality score". `quality/discriminate.py` fits
its discriminator on SONNETS under a fixed 14-line scheme, and `extract`
falls back to adjacent couplets for anything that is not that length. Pushing
a 25-line song in 8/8 through a sonnet-fitted model and printing the number
would be a measurement laundered out of its domain — the exact move doctrine
13/14 exists to stop. So this file computes the FEATURES the discriminator
reads and stops there; what those features mean against the song corpus is
`quality/floor.py`'s ~~song profile~~ LYRIC-SHEET PROFILE — repinned
2026-09-05 (`MISSING.md` M-239): that is `lyric` since 2026-09-04, calibrated
on all of `corpus/song/` (8,667 items, 4-3,245 tokens) with its five
thresholds as curves in ln N. The `song` row (200-400 tokens) and `short`
(50-150) are superseded band rows, kept in `PROFILES` for their own drift
checks and never applied by `declaration_for`.

THE PAIRING IS DECLARED, NOT INFERRED. `extract(lines)` with no scheme pairs
ADJACENT COUPLETS. Our mandates bind (line, locus) members that no letter
scheme can express, so there is no scheme to pass; using couplets for every
song uniformly is what makes one row comparable to the next and to itself six
weeks later. Stated here because a silent choice of pairing would move every
predictability number without appearing in any column.

WHY THE HARNESS COMMIT IS A KEY COLUMN
--------------------------------------
A song's bytes never change. So when its numbers move, THE TREE MOVED — a
corpus load, a recalibrated band, a changed tokeniser. Keyed on the commit, a
delta is attributable; keyed on the date alone it is a mystery. That is the
whole value of re-running: the songs become calibration standards for the
quality layer, and `--check` is the regression detector.
"""
import argparse
import datetime
import glob
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SONGS = os.path.join(ROOT, "songs")
RESULTS = os.path.join(SONGS, "RESULTS.tsv")
README = os.path.join(SONGS, "README.md")
sys.path.insert(0, ROOT)


def feature_names():
    """Resolved at run time so this file cannot drift from the
    pre-registration it reports."""
    from quality.features import QualityFeatures
    return list(QualityFeatures.NAMES)


def header():
    return ["song", "harness_commit", "measured", "n_lines", "n_sections"] \
           + feature_names()


def harness_commit():
    """-> the short SHA the measurement was taken at, or `<sha>-WORKING` when
    the tree is dirty. A dirty tree is NOT a commit and saying so is the
    point: a row nobody can re-derive is a row nobody should trust."""
    try:
        sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"],
                             cwd=ROOT, capture_output=True, text=True,
                             timeout=30).stdout.strip()
        dirty = subprocess.run(["git", "status", "--porcelain", "--", "."],
                               cwd=ROOT, capture_output=True, text=True,
                               timeout=30).stdout.strip()
    except Exception:                                   # noqa: BLE001
        return "UNKNOWN"
    if not sha:
        return "UNKNOWN"
    return f"{sha}-WORKING" if dirty else sha


def lyric_lines(path):
    out = []
    for raw in open(path, encoding="utf-8").read().splitlines():
        s = raw.strip()
        if not s or (s.startswith("[") and s.endswith("]")):
            continue
        out.append(s)
    return out


def section_count(path):
    return sum(1 for raw in open(path, encoding="utf-8").read().splitlines()
               if raw.strip().startswith("[") and raw.strip().endswith("]"))


def songs():
    return sorted(p for p in glob.glob(os.path.join(SONGS, "*.txt"))
                  if os.path.exists(p[: -len(".txt")] + ".blueprint.json"))


def score(qf, path):
    lines = lyric_lines(path)
    feats = qf.extract(lines)               # NO SCHEME — declared, see above
    row = {"song": os.path.basename(path),
           "harness_commit": harness_commit(),
           "measured": datetime.date.today().isoformat(),
           "n_lines": str(len(lines)),
           "n_sections": str(section_count(path))}
    for n in feature_names():
        v = feats.get(n, float("nan"))
        row[n] = "nan" if v != v else f"{v:.6f}"
    return row


def read_rows():
    if not os.path.exists(RESULTS):
        return []
    out = []
    with open(RESULTS, encoding="utf-8") as fh:
        head = fh.readline().rstrip("\n").split("\t")
        for line in fh:
            line = line.rstrip("\n")
            if line:
                out.append(dict(zip(head, line.split("\t"))))
    return out


def newest_per_song(rows):
    out = {}
    for r in rows:                          # append-only, so last wins
        out[r["song"]] = r
    return out


def cmd_write(allow_dirty=False):
    # A ROW IS KEYED ON A COMMIT, SO IT IS WRITTEN ON ONE (2026-09-01,
    # `MISSING.md` M-196): 124 of 164 banked rows, every song's latest
    # among them, carried a `-WORKING` stamp — a measurement keyed to a
    # tree that never existed as a commit, which nothing read and nothing
    # refused. A dirty tree refuses now; `--allow-dirty` is the declared
    # way past, for the sitting that knows what it is doing and says so.
    stamp = harness_commit()
    if stamp.endswith("-WORKING") and not allow_dirty:
        print(f"  REFUSED — the tree is dirty ({stamp}), so the row would be "
              f"keyed on a commit that does not exist. Commit first, or pass "
              f"--allow-dirty to bank a working-tree measurement on purpose "
              f"(it will be stamped as one).")
        return 2
    from quality.features import QualityFeatures
    qf = QualityFeatures()
    cols = header()
    rows = [score(qf, p) for p in songs()]
    fresh = not os.path.exists(RESULTS)
    with open(RESULTS, "a", encoding="utf-8") as fh:
        if fresh:
            fh.write("\t".join(cols) + "\n")
        for r in rows:
            fh.write("\t".join(r[c] for c in cols) + "\n")
    print(f"  {len(rows)} row(s) appended at "
          f"{rows[0]['harness_commit'] if rows else '-'}")
    for r in rows:
        print(f"    {r['song']:26s} {r['n_lines']:>3s} lines  "
              f"pred_mean {r['rhyme_predictability_mean']}  "
              f"conc_mean {r['concreteness_mean']}  "
              f"mattr {r['mattr']}")
    return 0


def cmd_check():
    """THE REGRESSION DETECTOR. Same bytes in, same numbers out — or the tree
    moved, and this says which feature and by how much."""
    from quality.features import QualityFeatures
    prior = newest_per_song(read_rows())
    if not prior:
        print("  REFUSED — songs/RESULTS.tsv has no rows, so there is nothing "
              "to re-derive against. Run --write first.")
        print("\nRESULT: REFUSED (not a pass — doctrine 20)")
        return 2
    qf = QualityFeatures()
    moved, checked = [], 0
    for p in songs():
        name = os.path.basename(p)
        if name not in prior:
            moved.append(f"{name}: NO PRIOR ROW — a song nothing has ever "
                         f"measured (run --write)")
            continue
        now, was = score(qf, p), prior[name]
        checked += 1
        for n in feature_names():
            if now[n] != was[n]:
                moved.append(f"{name}  {n}: {was[n]} -> {now[n]}  (last seen "
                             f"at {was['harness_commit']})")
    print(f"  {checked} song(s) re-derived against their newest banked row")
    for m in moved:
        print(f"  [MOVED] {m}")
    if moved:
        print("\n  THE SONGS' BYTES DID NOT CHANGE, SO THE TREE DID. Attribute "
              "the delta to what moved between the two commits, bank the new "
              "row with --write, and say WHY in songs/README.md. Do not tune "
              "the feature to the pin.")
        print("\nRESULT: FAIL")
        return 1
    print("\nRESULT: PASS")
    return 0


#: Words that make a sentence a COMPARISON. A claim with one of these is a
#: claim about the series, and the series lives in RESULTS.tsv.
COMPARATIVE = re.compile(
    r"\b(best|worst|better|worse|cleanest|strongest|weakest|finest|peak|"
    # `regression` — the NOUN — is dropped and `regressed` kept, and the
    # narrowing is declared rather than quiet: in this tree the noun almost
    # always means "regression test/detector" (a term of art) while the verb
    # is a claim that something got worse. Caught by this file's own first
    # run against the paragraph describing `--check` as a regression
    # detector. Widening it back would make the instrument something people
    # route around, which is the failure mode a false positive causes.
    r"improved|improvement|regressed|first song|only song|"
    # `highest` / `lowest` JOINED 2026-08-25 (`MISSING.md` M-109), and they
    # are the two words a superlative about a SERIES most naturally reaches
    # for. The gate could not see either, and this file's own §"What the
    # first measurement says" was already using `lowest` TWICE — voluntarily
    # cited, which is exactly the property a gate exists so nobody has to
    # supply voluntarily. A vocabulary that misses the commonest spelling of
    # the claim it polices is doctrine 48 inside the instrument aimed at the
    # narrator.
    r"highest|lowest|"
    r"never needed|no revision at all)\b", re.I)
#: The declared citation, in the TEXT beside the claim — the shape
#: `quality/triage.py` uses for `TESTED WHILE OPEN`.
CITATION = re.compile(r"\[RESULTS:\s*([a-z_0-9]+)\s+(\S+?)\s*\]", re.I)


def cmd_claims():
    """THE ONE CHECK AIMED AT THE NARRATOR.

    Every line in `songs/README.md` that COMPARES songs must carry a
    `[RESULTS: <column> <song>]` citation resolving to a real column of a real
    row. An uncited superlative is the failure mode this whole file was built
    for: a PASS/FAIL bit read aloud as a judgement.
    """
    if not os.path.exists(README):
        print("  REFUSED — no songs/README.md")
        return 2
    rows = newest_per_song(read_rows())
    cols = set(header())
    bad = []
    for i, line in enumerate(
            open(README, encoding="utf-8").read().splitlines(), 1):
        s = line.strip()
        if not s or s.startswith(("|", ">", "```")) or line.startswith("    "):
            continue                        # tables and code blocks are data
        m = COMPARATIVE.search(s)
        if not m:
            continue
        cites = CITATION.findall(s)
        if not cites:
            bad.append(f"line {i}: comparative '{m.group(0)}' with NO "
                       f"[RESULTS: column song] citation\n            {s[:92]}")
            continue
        for col, song in cites:
            if col not in cols:
                bad.append(f"line {i}: cites column '{col}', not a column of "
                           f"RESULTS.tsv")
            elif song not in rows:
                bad.append(f"line {i}: cites song '{song}', which has no "
                           f"banked row")
    print(f"  songs/README.md scanned; {len(rows)} song(s) banked, "
          f"{len(cols)} column(s) citable")
    for b in bad:
        print(f"  [UNCITED] {b}")
    if bad:
        print("\n  A COMPARISON IS A CLAIM ABOUT THE SERIES, AND THE SERIES IS "
              "songs/RESULTS.tsv. Cite it — e.g. `[RESULTS: concreteness_mean "
              "carry_it_over.txt]` — or do not make the comparison. `song` "
              "exit 0 does not mean better: BOTH drafts of carry_it_over were "
              "exit 0 and one of them was fragments.")
        print("\nRESULT: FAIL")
        return 1
    print("\nRESULT: PASS")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--allow-dirty", action="store_true",
                    help="bank on a dirty tree anyway (stamped -WORKING)")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--claims", action="store_true")
    a = ap.parse_args(argv)
    if a.write:
        return cmd_write(allow_dirty=a.allow_dirty)
    if a.check:
        return cmd_check()
    if a.claims:
        return cmd_claims()
    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())

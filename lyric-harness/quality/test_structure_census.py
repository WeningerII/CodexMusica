#!/usr/bin/env python3
"""Regressions for the structure census instrument
(quality/structure_census.py; protocol in
quality/STRUCTURE_CENSUS_PREREGISTRATION.md).

Sections:
  1  the censused rows — 57, comparator out, every row judgeable by name
  2  the three item readers are the EXISTING ones — the 4,930-item
     cross-check, the 152x14 oracle read, the 150-line control slice
  3  cell accounting — F1 on a real file, three counts never summed,
     dedup arm byte-identical to the live arm
  4  the constrained tag — declared cells only, whitman never
  5  the TSV round-trips

Run: python3 quality/test_structure_census.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality import structure_census as CEN  # noqa: E402
from quality import structures as ST         # noqa: E402
from quality import phonology as PH          # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


SMALL = os.path.join(HERE, "..", "corpus", "song", "eng_hymn_cennick.txt")


def test_rows():
    print("\n1. the censused rows")
    check("57 rows — every catalog row except the comparator sentinel, "
          "whose judge refuses by design",
          len(CEN.ROWS) == 57 and ST.DEFAULT not in CEN.ROWS
          and len(ST.STRUCTURES) == 58)
    check("every censused row resolves and is not a comparator",
          all(ST.get(r).kind != "comparator" for r in CEN.ROWS))


def test_item_readers():
    print("\n2. the item readers are the existing ones, never respelled")
    files = CEN.corpus_files()
    # REPINNED 2026-08-20: 143 -> 388 eng files — the owner-directed mass
    # load staged 245 eng_celtic_msm_* files from the Modern Scottish
    # Minstrel (PG22515). The run-1 CENSUS ARTIFACT itself still describes
    # the 143-file corpus (data/structure_census_eng.tsv is a snapshot,
    # dated); this check is about the READERS agreeing on the live tree.
    # REPINNED 2026-08-20 (Tier-1 concurrent load): 388 -> 622 eng files
    # — 234 new per-author files from the five Tier-1 anthologies.
    # REPINNED same sitting: 622 -> 616 (six twin files merged).
    check("the population: 616 eng_ files + 2 controls",
          len(files) == 618
          and sum(1 for f in files
                  if os.path.basename(f).startswith("eng_")) == 616)
    n_items = sum(len(CEN.items_of(f)) for f in files
                  if os.path.basename(f).startswith("eng_"))
    # REPINNED 2026-08-19: 4,930 -> 4,979 -> 4,985 — Pass-1 batch 1's 49
    # new eng_hymn_ hymns, then batch 2's 6 new eng_american_ items.
    # REPINNED 2026-08-20: 4,985 -> 5,792 — the Minstrel mass load (+812
    # staged by the rev-2 restage, and 5 items moved from
    # eng_celtic_walter_scott to the new Rob Donn file after the edition's
    # own section heading proved the original staging had mis-bounded
    # Scott's section). Real growth the two readers still agree on.
    # REPINNED 2026-08-20 (Tier-1 concurrent load): 5,792 -> 6,352 —
    # +560 songs (514 in new files, 46 top-ups) after the containment
    # dedup dropped 114 cross-source reprints.
    check("the --- TITLE: split reproduces build_song_frequency's own "
          "item count EXACTLY — 6,352 over the 622 files",
          n_items == 6352, n_items)
    son = CEN.items_of(os.path.join(HERE, "..", "corpus", "sonnets.txt"))
    check("sonnets.txt reads through battery.parse_sonnets: 152 items "
          "of 14 lines, Gutenberg matter excluded by the oracle's reader",
          len(son) == 152 and all(len(x) == 14 for x in son))
    whi = CEN.items_of(os.path.join(HERE, "..", "corpus", "whitman.txt"))
    check("whitman.txt reads through battery.whitman_verse: ONE item of "
          "the 150-line negative-control slice",
          len(whi) == 1 and len(whi[0]) == 150
          and whi[0][0].startswith("I celebrate myself"))


def test_cell_accounting():
    print("\n3. cell accounting on a real file")
    phon = PH.get("eng")
    cells = CEN.census_file(SMALL, CEN.Memo(phon), dedup=True)
    check("114 cells: 57 rows x 2 populations",
          len(cells) == 114)
    check("F1 — the three verdict counts sum to n_pairs in EVERY cell "
          "(also asserted at build time; this is the artifact-side read)",
          all(n == t + f + r for n, t, f, r in cells.values()))
    ec = cells[("masculine-rhyme", "endword-cross")]
    check("the endword population is non-empty and the canary row judges "
          "most of it (not 100% refused — falsifier F2's canary)",
          ec[0] > 0 and ec[3] < ec[0], ec)
    cells2 = CEN.census_file(SMALL, CEN.Memo(phon), dedup=False)
    check("the dedup arm is BYTE-IDENTICAL to the live arm — the "
          "registration's declared verification of the dedup rule",
          cells == cells2)


def test_constrained_tag():
    print("\n4. the constrained tag is the registration's, exactly")
    check("end-rhyme family x endword-cross x rhyme-constrained corpora "
          "-> constrained",
          CEN.constrained_tag("eng_song", "masculine-rhyme",
                              "endword-cross")
          and CEN.constrained_tag("sonnets", "feminine-rhyme",
                                  "endword-cross"))
    check("whitman is incidental on EVERY row — the declared negative "
          "control; within-line and non-family rows are incidental "
          "everywhere",
          not CEN.constrained_tag("whitman", "masculine-rhyme",
                                  "endword-cross")
          and not CEN.constrained_tag("eng_song", "masculine-rhyme",
                                      "word-within-line")
          and not CEN.constrained_tag("eng_song",
                                      "kalevala-alliteration",
                                      "endword-cross"))


def test_tsv_roundtrip():
    print("\n5. the TSV round-trips")
    import tempfile
    phon = PH.get("eng")
    cells = CEN.census_file(SMALL, CEN.Memo(phon), dedup=True)
    rows = CEN.rows_for(SMALL, cells)
    with tempfile.NamedTemporaryFile("w", suffix=".tsv",
                                     delete=False) as fh:
        tmp = fh.name
    try:
        CEN.write_tsv(tmp, rows)
        back = CEN.read_tsv(tmp)
        check("write -> read is identity (sorted rows, declared columns)",
              back == sorted(rows) and len(back) == 114)
        check("a rate cell is judged-base or EMPTY, never 0.0-for-nothing "
              "(doctrine 20)",
              all((r[12] == "" ) == (int(r[9]) + int(r[10]) == 0)
                  for r in back))
    finally:
        os.unlink(tmp)


def test_checkpointing():
    print("\n6. per-file checkpointing — an interruption costs one file")
    import shutil
    import tempfile
    d = tempfile.mkdtemp()
    try:
        out1 = os.path.join(d, "a.tsv")
        parts = os.path.join(d, "parts")
        CEN.run([SMALL], out1, "test", parts_dir=parts)
        base = os.path.basename(SMALL)
        part = os.path.join(parts, base + ".part.tsv")
        check("a finished file's cells land in an atomic part file",
              os.path.exists(part)
              and not os.path.exists(part + ".tmp")
              and len(CEN.read_tsv(part)) == 114)
        # plant a SENTINEL part: a resumed run must REUSE it verbatim,
        # proving no recompute happens for a checkpointed file.
        sentinel = [tuple(["eng", "eng", base, "eng_song", "masculine-rhyme",
                           "cell", "endword-cross", "no",
                           "1", "1", "0", "0", "1.000000"])]
        CEN.write_tsv(part, sentinel)
        out2 = os.path.join(d, "b.tsv")
        CEN.run([SMALL], out2, "test", parts_dir=parts)
        check("a restart reuses the part instead of recomputing — the "
              "planted sentinel comes back verbatim",
              CEN.read_tsv(out2) == sentinel)
    finally:
        shutil.rmtree(d, ignore_errors=True)


if __name__ == "__main__":
    for fn in (test_rows, test_item_readers, test_cell_accounting,
               test_constrained_tag, test_tsv_roundtrip,
               test_checkpointing):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("the census instrument: one judge, three counts, declared "
          "populations, and its readers are the repo's own")

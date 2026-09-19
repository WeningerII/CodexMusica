#!/usr/bin/env python3
"""THE SHAPE OF THE SERIES — what section orders the songs actually use.

    python3 quality/song_shape.py            # the census, duplicates named
    python3 quality/song_shape.py --check    # exit 3 when the census drifts

`MISSING.md` H-3's first item is *clichéd section orders*, and it had been a
phrase rather than a measurement. This answers it by MEASURING the series
rather than by asserting against a corpus, for a reason each half of which was
checked before this file was written:

  THE CORPUS CANNOT CALIBRATE IT. `MISSING.md` E-4 measured `grid`'s 22
  declared section functions against all 1,421 files of `corpus/song/`:
  verse 74,177 marks, chorus 236, and **bridge 0, hook 0**. The corpus is
  historical and traditional verse whose bracketed marks are dominated by
  `radif` and `bayt N`. A section-order cliché scored against it would be
  answering from an empty axis.

  AND SCORING THE SERIES AGAINST THE SERIES WOULD BE CIRCULAR. The delivered
  songs DO carry these marks — measured, 18 distinct functions over 16 songs —
  but they are this system's own output, so treating their frequencies as a
  norm is doctrine 13/14's error: a resource used to score a cell must be
  independent of that cell's label.

WHAT IS LEFT IS NOT A JUDGEMENT AND IS STILL A FACT: which songs share a
section order with which other songs. That is a property of the committed
bytes, needs no corpus and no threshold, and nothing in this tree could see
it. `songs/RESULTS.tsv` banks `n_sections` — a COUNT — so two songs with
byte-identical orders are INDISTINGUISHABLE in the register, and their counts
merely agree with each other.

NOTHING HERE FAILS A SONG. Two songs sharing a shape is not a defect (doctrine
96: a convention a writer may depart from cannot fail verification, and
doctrine 7: enforce a floor, do not order the permitted region). `--check`
gates the CENSUS against its own banked counts, the way
`quality/gate_census.py` does -- so the series moving is visible, and a shared
shape is disclosed rather than charged.

THE POPULATION IS `song_record.songs()`, NOT A SECOND GLOB. One definition of
what a delivered song is (doctrine 1).
"""

from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

#: A bracketed section mark, e.g. `[PRECHORUS1]` or `[VERSE 2]`.
_MARK = re.compile(r"^\[([^\]]+)\]$")

#: The trailing INSTANCE index, which is not part of the function's name.
_INSTANCE = re.compile(r"\s*\d+$")


def _functions(path):
    """-> (raw marks, function names) for one song, in order.

    BOTH are returned because they answer different questions and the
    difference is where a shape hides: `[VERSE1] [VERSE2]` and
    `[VERSE1] [VERSE1]` are the same FUNCTION sequence and different songs.
    """
    raw, fns = [], []
    for line in open(path, encoding="utf-8").read().splitlines():
        m = _MARK.match(line.strip())
        if not m:
            continue
        mark = m.group(1).strip()
        raw.append(mark)
        fns.append(_INSTANCE.sub("", mark).strip().lower())
    return tuple(raw), tuple(fns)


def census():
    """-> the shape of every delivered song, and who shares one with whom."""
    from quality import song_record as SR
    rows, by_seq = [], {}
    for p in SR.songs():
        raw, fns = _functions(p)
        name = os.path.basename(p)
        rows.append({"song": name, "n": len(fns), "raw": raw,
                     "functions": fns})
        by_seq.setdefault(fns, []).append(name)
    dupes = {k: sorted(v) for k, v in by_seq.items() if len(v) > 1}
    inventory = {}
    for r in rows:
        for f in r["functions"]:
            inventory[f] = inventory.get(f, 0) + 1
    return {"rows": rows, "duplicates": dupes, "inventory": inventory,
            "songs": len(rows), "distinct": len(by_seq),
            "duplicate_groups": len(dupes),
            "functions_used": len(inventory)}


#: MEASURED 2026-09-19. Counts, never a threshold — `--check` reports that the
#: series MOVED, which is an answer and not a failure of any song.
PINNED = {"songs": 16, "distinct": 14, "duplicate_groups": 2,
          "functions_used": 18}


def report(c=None):
    c = c or census()
    out = []
    for r in sorted(c["rows"], key=lambda r: r["song"]):
        out.append(f"  {r['song']:32s} {r['n']:2d}  "
                   f"{'-'.join(r['functions'])}")
    out.append("")
    out.append(f"songs {c['songs']}   distinct section orders {c['distinct']}"
               f"   shared by 2+ {c['duplicate_groups']}"
               f"   functions used {c['functions_used']}")
    if c["duplicates"]:
        out.append("")
        out.append("SONGS SHARING A SECTION ORDER — disclosed, not charged:")
        for seq, names in sorted(c["duplicates"].items(),
                                 key=lambda kv: kv[1]):
            out.append(f"  {', '.join(names)}")
            out.append(f"      {'-'.join(seq)}")
    else:
        out.append("")
        out.append("No two songs share a section order.")
    return "\n".join(out)


def check():
    """-> exit code. 3 when the census drifts from PINNED."""
    c = census()
    print(report(c))
    print()
    moved = {k: (PINNED[k], c[k]) for k in PINNED if PINNED[k] != c[k]}
    for k, (was, now) in sorted(moved.items()):
        print(f"MOVED  {k}: pinned {was}, measured {now}")
    if moved:
        print("DRIFT — the series moved. That is an answer, not a failure of "
              "any song: re-read the shapes, then repin.")
        return 3
    print("OK — the census reads as pinned.")
    return 0


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    bad = [a for a in argv if a != "--check"]
    if bad:
        print(f"REFUSED — song_shape takes only `--check`, not {bad[0]!r}")
        return 2
    if "--check" in argv:
        return check()
    print(report())
    return 0


if __name__ == "__main__":                               # pragma: no cover
    sys.exit(main())

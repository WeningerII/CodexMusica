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

import csv
import json
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


#: WHERE A SONG'S SEED IS RECORDED. `quality/song_log.py` banks one row per
#: (invocation, fact); the `seed` fact is the DECLARED one the plan was drawn
#: from. Read, never re-derived: a plan is a pure function of its seed AND the
#: planner's code, and the planner has been re-derived many times since these
#: songs were written, so re-running `make_plan` at HEAD answers a different
#: question (measured: seed 1 at HEAD gives a section order neither seed-1 song
#: has).
_SEED_FACT = "seed"


def _seed(stem):
    """-> the seed this song's log declares, or None.

    None is a REFUSAL and not a zero (doctrine 20): `oar_lair` logs no seed
    row, so its seed is not obtainable from the artifacts and is never
    guessed.
    """
    path = os.path.join("songs", f"{stem}.log.tsv")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        for row in csv.reader(fh, delimiter="\t"):
            if len(row) > 7 and row[6] == _SEED_FACT:
                return row[7]
    return None


def hook_census():
    """-> where the declared hook lands, over the songs that declare one.

    WHAT THIS IS AND IS NOT. It is a FACT about committed bytes: which section
    function each song's hook phrase occurs in, and whether it occurs in more
    than one. It is NOT a claim that any placement is clichéd — that would be
    a claim against a norm, and H-3's entry refuses both populations that
    could supply one.

    AND THE PROVENANCE IS REFUSED RATHER THAN ATTRIBUTED. The current planner
    DERIVES `hook_slot` from the drawn pattern, which would make a census of
    hook placement a census of the planner's own draw. That reasoning does not
    reach this population: `hook_slot` is present in **0 of 16** committed
    blueprints, which predate the field (`MISSING.md` M-212, 2026-09-03). So
    whether each committed song's hook position was drawn or chosen is NOT
    recoverable from the artifacts, and this census says so instead of
    crediting either.
    """
    from quality import grid as GR
    from quality import song_record as SR
    rows, with_slot = [], 0
    for path in sorted(SR.songs()):
        stem = os.path.basename(path)[:-4]
        bp = os.path.join("songs", f"{stem}.blueprint.json")
        if not os.path.exists(bp):
            rows.append({"song": stem, "hook": None, "functions": ()})
            continue
        with open(bp, encoding="utf-8") as fh:
            if json.load(fh).get("hook_slot"):
                with_slot += 1
        song, hooks = GR.song_from_blueprint(bp)
        fns = tuple(sorted({o.function for h in hooks
                            for o in GR.hook_occurrences(song, h)}))
        rows.append({"song": stem, "hook": bool(hooks), "functions": fns})
    declared = [r for r in rows if r["hook"]]
    spread = [r for r in declared if len(r["functions"]) > 1]
    where = {}
    for r in declared:
        if len(r["functions"]) == 1:
            where[r["functions"][0]] = where.get(r["functions"][0], 0) + 1
    return {"rows": rows, "songs": len(rows),
            "declared": len(declared),
            "undeclared": len(rows) - len(declared),
            "spread_over_functions": len(spread),
            "where": where,
            "blueprints_with_hook_slot": with_slot}


def census():
    """-> the shape of every delivered song, and who shares one with whom."""
    from quality import song_record as SR
    rows, by_seq, by_seed = [], {}, {}
    for p in SR.songs():
        raw, fns = _functions(p)
        name = os.path.basename(p)
        stem = name[:-4] if name.endswith(".txt") else name
        seed = _seed(stem)
        rows.append({"song": name, "n": len(fns), "raw": raw,
                     "functions": fns, "seed": seed})
        by_seq.setdefault(fns, []).append(name)
        if seed is not None:
            by_seed.setdefault(seed, []).append(name)
    dupes = {k: sorted(v) for k, v in by_seq.items() if len(v) > 1}
    seed_dupes = {k: sorted(v) for k, v in by_seed.items() if len(v) > 1}
    # THE CONFOUND, MEASURED RATHER THAN ARGUED. A shared section order is a
    # fact about two committed texts; it is a fact about two DRAWS if the two
    # songs were planned from one seed. Counted per duplicate group so the
    # question is asked of each, never summed with anything (doctrine 79).
    seed_of = {r["song"]: r["seed"] for r in rows}
    confounded = sorted(
        tuple(v) for v in dupes.values()
        if len({seed_of.get(n) for n in v}) == 1
        and seed_of.get(v[0]) is not None)
    inventory = {}
    for r in rows:
        for f in r["functions"]:
            inventory[f] = inventory.get(f, 0) + 1
    return {"rows": rows, "duplicates": dupes, "inventory": inventory,
            "songs": len(rows), "distinct": len(by_seq),
            "duplicate_groups": len(dupes),
            "functions_used": len(inventory),
            "seed_duplicates": seed_dupes,
            "seed_duplicate_groups": len(seed_dupes),
            "seeds_missing": sum(1 for r in rows if r["seed"] is None),
            "orders_confounded_by_seed": len(confounded),
            "confounded": confounded}


#: MEASURED 2026-09-19. Counts, never a threshold — `--check` reports that the
#: series MOVED, which is an answer and not a failure of any song.
PINNED = {"songs": 16, "distinct": 14, "duplicate_groups": 2,
          "functions_used": 18,
          # THE CONFOUND. Both duplicate section orders are also duplicate
          # SEEDS -- 2 of 2 -- so neither is evidence about craft that is
          # independent of the draw. Pinned so that a third duplicate order
          # arriving WITHOUT a shared seed moves a number and has to be read.
          "seed_duplicate_groups": 2, "orders_confounded_by_seed": 2,
          "seeds_missing": 1,
          # THE HOOK. Counts, not a norm.
          "hook_declared": 10, "hook_spread_over_functions": 0,
          "blueprints_with_hook_slot": 0}


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
        seed_of = {r["song"]: r["seed"] for r in c["rows"]}
        for seq, names in sorted(c["duplicates"].items(),
                                 key=lambda kv: kv[1]):
            out.append(f"  {', '.join(names)}")
            out.append(f"      {'-'.join(seq)}")
            seeds = [seed_of.get(n) for n in names]
            if len(set(seeds)) == 1 and seeds[0] is not None:
                out.append(f"      CONFOUNDED — both declare seed "
                           f"{seeds[0]}, so this is one draw and not two "
                           f"songs agreeing.")
            else:
                shown = ", ".join("REFUSED" if x is None else str(x)
                                  for x in seeds)
                out.append(f"      seeds differ ({shown}) — not explained "
                           f"by the draw.")
    else:
        out.append("")
        out.append("No two songs share a section order.")
    if c["seeds_missing"]:
        out.append("")
        out.append(f"{c['seeds_missing']} song(s) log no seed: REFUSED, "
                   f"never guessed (doctrine 20).")
    h = hook_census()
    out.append("")
    out.append(f"HOOK — declared by {h['declared']} of {h['songs']}, "
               f"{h['undeclared']} declare none.")
    out.append(f"  in one section function only: "
               f"{h['declared'] - h['spread_over_functions']}"
               f"   spread over two or more: {h['spread_over_functions']}")
    for fn, n in sorted(h["where"].items(), key=lambda kv: (-kv[1], kv[0])):
        out.append(f"    {fn:14s} {n}")
    out.append(f"  PROVENANCE REFUSED — `hook_slot` is in "
               f"{h['blueprints_with_hook_slot']} of {h['songs']} committed "
               f"blueprints, which predate the field, so whether a hook "
               f"position was DRAWN or CHOSEN is not recoverable here.")
    return "\n".join(out)


def check():
    """-> exit code. 3 when the census drifts from PINNED."""
    c = dict(census())
    print(report(c))
    print()
    h = hook_census()
    c["hook_declared"] = h["declared"]
    c["hook_spread_over_functions"] = h["spread_over_functions"]
    c["blueprints_with_hook_slot"] = h["blueprints_with_hook_slot"]
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

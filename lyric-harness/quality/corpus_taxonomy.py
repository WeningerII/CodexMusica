#!/usr/bin/env python3
"""The corpus taxonomy: language x region/tradition x function/venue.

WHAT THIS IS.  The six words that used to live only in filenames
(american, hymn, british, parlour, celtic, hall) answered two different
questions in one slot -- REGION (where is this tradition from) and
FUNCTION (what is the song for, where was it performed) -- and which
answer a file got was decided by which kind of book it was staged from.
Measured on the corpus's own files, 2026-08-19: ten-plus American
hymnists sit in `hymn` (filed by function) while "The Battle Hymn of the
Republic" sits in `american` (filed by region), and Ann and Jane Taylor
-- the ENGLISH nursery-rhyme sisters -- sit in `american` because their
anthology was published in New York.  This module splits the slot into
two DECLARED per-song coordinates and demotes the filename token to what
it truthfully is: the acquisition-batch label, carrying no analytic
weight.  Language stays the senior axis it has always been -- the corpus
filename prefix (eng_, cym_, fin_, ...), which dispatches the phonology
(doctrine 45) and scopes every calibration.

WHERE THE VALUES LIVE.  data/song_regions.tsv (global -- `welsh` is the
same tradition whether the song is in Welsh or English) and
data/song_functions_eng.tsv (per-language: functions are attested by
source types, and source types are a language community's own genres).
Both tables are CLOSED SETS: a value not in the table refuses by name,
and a new value enters by adding a defined row in the same commit as the
first song that needs it -- never by a filename inventing one (growth is
a row, not a habit).  Reserved values (work, spiritual, tin_pan_alley,
african_american, welsh, ...) are recorded in
quality/CORPUS_LOADING_PROTOCOL.md and deliberately NOT in the tables:
a declared value with zero members is the declared-but-unread defect
wearing a taxonomy hat.

WHERE THE ASSIGNMENTS LIVE.  Two spellings, both invisible to every
existing reader (verified against load_lyric_lines, read_marked_songs
and readability.read_lines before the first line shipped -- the `#`
header and `--- KEY:` shapes have been apparatus since 2026-08-12):

    # region: english          <- file header: the default for every
    # function: hymn              song in the file
    --- REGION: scottish       <- per-song override, directly under the
    --- FUNCTION: hymn, patriotic  song's --- TITLE: line

Resolution is per song: the song's own line if present, else the file
header, else BLANK -- and blank means UNDECLARED, never guessed
(evidence-or-blank: a value is assigned on its table row's evidence rule
or not at all).  REGION is single-valued; a genuinely contested case
stays blank with the dispute recorded.  FUNCTION takes any number of
values, each independently attested -- the bound is not a cap but the
evidence requirement, and report() measures the multi-tag distribution
so tag inflation drifts a number instead of becoming a habit.

WHAT THIS DOES NOT DO.  Nothing in the planner, grader, reviser or
connector reads this module.  It is corpus-side bookkeeping: coverage
becomes a grid (region x function cells you can count and deliberately
fill) instead of a filename accident.  No calibrated constant moves when
a tag is added -- pinned by test_taxonomy's apparatus-invisibility
section.

Run: python3 quality/corpus_taxonomy.py [--root=corpus/song] [--check]
  default: the coverage report (cells, undeclared counts -- region and
  function reported separately, never summed -- and the multi-tag
  distribution).  --check: validate every assignment against the tables
  and exit 2 on the first illegal value, naming file, song and value.
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
REGIONS_TSV = os.path.join(ROOT, "data", "song_regions.tsv")
FUNCTIONS_TSV = os.path.join(ROOT, "data", "song_functions_eng.tsv")
SONG_DIR = os.path.join(ROOT, "corpus", "song")

#: Header keys (in `# key: value` lines) and song keys (in `--- KEY: value`
#: lines).  The song spelling is uppercase by the corpus's own convention
#: for song-level apparatus (--- TITLE:, --- SOURCE:).
HEADER_REGION = "region"
HEADER_FUNCTION = "function"
SONG_REGION = "--- REGION:"
SONG_FUNCTION = "--- FUNCTION:"
SONG_TITLE = "--- TITLE:"


class TaxonomyRefused(Exception):
    """An assignment names a value outside its closed table."""


def _load_table(path, key_col):
    """-> {id: {col: value}}.  Refuses an empty table or duplicate ids --
    a vocabulary with a repeated word is two definitions fighting."""
    rows = {}
    with open(path, encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        if key_col not in header:
            raise TaxonomyRefused(f"{path}: no '{key_col}' column")
        for ln in f:
            if not ln.strip():
                continue
            cells = ln.rstrip("\n").split("\t")
            row = dict(zip(header, cells))
            rid = row[key_col].strip()
            if rid in rows:
                raise TaxonomyRefused(f"{path}: duplicate id '{rid}'")
            rows[rid] = row
    if not rows:
        raise TaxonomyRefused(f"{path}: empty vocabulary")
    return rows


def load_regions():
    return _load_table(REGIONS_TSV, "region")


def load_functions():
    return _load_table(FUNCTIONS_TSV, "function")


def _split_values(raw):
    return tuple(v.strip() for v in raw.split(",") if v.strip())


def read_file_taxonomy(path):
    """-> (header, songs).  header = {'region': str|'', 'function': tuple};
    songs = [{'title', 'region', 'functions', 'line_no'}] with PER-SONG
    values only (resolution against the header is resolve_songs' job, so
    a caller can tell an override from an inheritance)."""
    header = {"region": "", "function": ()}
    songs = []
    cur = None
    with open(path, encoding="utf-8") as f:
        for i, ln in enumerate(f, 1):
            line = ln.rstrip("\n")
            if line.startswith("#"):
                m = re.match(r"#\s*(region|function):\s*(.+)$", line)
                if m and cur is None:
                    if m.group(1) == "region":
                        header["region"] = m.group(2).strip()
                    else:
                        header["function"] = _split_values(m.group(2))
                continue
            if line.startswith(SONG_TITLE):
                cur = {"title": line[len(SONG_TITLE):].strip(),
                       "region": "", "functions": (), "line_no": i}
                songs.append(cur)
            elif line.startswith(SONG_REGION) and cur is not None:
                cur["region"] = line[len(SONG_REGION):].strip()
            elif line.startswith(SONG_FUNCTION) and cur is not None:
                cur["functions"] = _split_values(line[len(SONG_FUNCTION):])
    return header, songs


def resolve_songs(path):
    """-> [(title, region, functions)] with the per-song value winning,
    the header filling, and '' / () as the honest UNDECLARED."""
    header, songs = read_file_taxonomy(path)
    out = []
    for s in songs:
        region = s["region"] or header["region"]
        funcs = s["functions"] or header["function"]
        out.append((s["title"], region, funcs))
    return out


def check_file(path, regions, functions):
    """-> [violation strings].  Empty means every assignment is legal."""
    bad = []
    header, songs = read_file_taxonomy(path)
    rel = os.path.relpath(path, ROOT)
    if header["region"] and header["region"] not in regions:
        bad.append(f"{rel}: header region '{header['region']}' not in "
                   f"data/song_regions.tsv")
    for v in header["function"]:
        if v not in functions:
            bad.append(f"{rel}: header function '{v}' not in "
                       f"data/song_functions_eng.tsv")
    for s in songs:
        if s["region"] and s["region"] not in regions:
            bad.append(f"{rel} L{s['line_no']} '{s['title'][:40]}': region "
                       f"'{s['region']}' not in the table")
        if s["region"] and "," in s["region"]:
            bad.append(f"{rel} L{s['line_no']}: region is SINGLE-VALUED — "
                       f"a contested region stays blank, recorded, never "
                       f"doubled")
        for v in s["functions"]:
            if v not in functions:
                bad.append(f"{rel} L{s['line_no']} '{s['title'][:40]}': "
                           f"function '{v}' not in the table")
    return bad


def eng_files(root=SONG_DIR):
    return sorted(os.path.join(root, f) for f in os.listdir(root)
                  if f.startswith("eng_") and f.endswith(".txt"))


def report(root=SONG_DIR):
    """-> dict.  Counts are kept apart (doctrine 79/91): undeclared region
    and undeclared function are different facts about different axes, and
    the multi-tag histogram is per VALUE COUNT, never folded into cells."""
    regions = load_regions()
    functions = load_functions()
    by_region, by_function, cells = {}, {}, {}
    n_songs = 0
    und_region = 0
    und_function = 0
    multi = {}
    for path in eng_files(root):
        for _title, region, funcs in resolve_songs(path):
            n_songs += 1
            if region:
                by_region[region] = by_region.get(region, 0) + 1
            else:
                und_region += 1
            if funcs:
                for v in funcs:
                    by_function[v] = by_function.get(v, 0) + 1
                multi[len(funcs)] = multi.get(len(funcs), 0) + 1
                if region:
                    for v in funcs:
                        cells[(region, v)] = cells.get((region, v), 0) + 1
            else:
                und_function += 1
    return {"songs": n_songs, "by_region": by_region,
            "by_function": by_function, "cells": cells,
            "undeclared_region": und_region,
            "undeclared_function": und_function,
            "multi_tag": multi,
            "vocab": {"regions": sorted(regions),
                      "functions": sorted(functions)}}


def main(argv):
    root = SONG_DIR
    check = False
    for a in argv:
        if a.startswith("--root="):
            root = os.path.join(ROOT, a.split("=", 1)[1])
        elif a == "--check":
            check = True
        else:
            print(f"REFUSED — unknown argument {a!r}; taxonomy takes "
                  f"[--root=DIR] [--check]")
            return 2
    regions = load_regions()
    functions = load_functions()
    if check:
        bad = []
        for path in eng_files(root):
            bad.extend(check_file(path, regions, functions))
        if bad:
            print(f"TAXONOMY: {len(bad)} illegal assignment(s)")
            for b in bad:
                print(f"  {b}")
            return 2
        print("TAXONOMY: every assignment names a declared value — "
              "the closed set holds")
        return 0
    r = report(root)
    print(f"TAXONOMY REPORT — {r['songs']} songs over "
          f"{len(eng_files(root))} eng files")
    print(f"  regions declared: "
          + ", ".join(f"{k} {v}" for k, v in sorted(r["by_region"].items()))
          + f"   |   UNDECLARED {r['undeclared_region']}")
    print(f"  functions declared: "
          + ", ".join(f"{k} {v}" for k, v in sorted(r["by_function"].items()))
          + f"   |   UNDECLARED {r['undeclared_function']}")
    print(f"  multi-tag distribution (values per tagged song): "
          + ", ".join(f"{k}->{v}" for k, v in sorted(r["multi_tag"].items())))
    print("  cells (region x function), the coverage grid:")
    for (reg, fn), n in sorted(r["cells"].items()):
        print(f"    {reg} x {fn}: {n}")
    print("  Undeclared is an HONEST state (evidence-or-blank), and the "
          "two undeclared counts answer different axes — never sum them.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

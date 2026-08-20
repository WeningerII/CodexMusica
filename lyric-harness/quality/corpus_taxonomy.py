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

A VALUE IS ONE LOWERCASE TOKEN (VALUE_SHAPE), checked at the READ and
separately from the closed table: a shaped-but-unknown value is a typo
and refuses by name, while text that is not shaped like a value is not a
declaration at all and never becomes data.  Prose explaining a decision
belongs on a `-basis:` key (`# region-basis:`), which no reader parses.

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


#: THE SHAPE OF A DECLARED VALUE, and it is a SEPARATE GATE from the
#: closed table.  A taxonomy value is one lowercase ASCII token; the
#: underscore is in the class because two RESERVED values need it
#: (`african_american`, `tin_pan_alley` -- CORPUS_LOADING_PROTOCOL.md).
#:
#: WHY THE READER AND NOT ONLY `check_file`.  The two gates answer
#: different questions and a value must pass both, but they fail
#: DIFFERENTLY and only one of them was ever asked by `report()`:
#:
#:   shape  — is this line a declaration at all?
#:   table  — is this declared value in the closed vocabulary?
#:
#: A well-shaped value outside the table (`atlantean`) is a TYPO OF A
#: VALUE and must keep flowing through the reader so `check_file` can
#: refuse it BY NAME -- that behaviour is pinned and is unchanged here.
#: Text that fails the shape is NOT a value at all, and treating it as
#: one is what let a prose note become data: measured on a probe file
#: whose header read `# region: CONTESTED, therefore blank -- see the
#: note below`, `report()` invented a by_region CELL named after the
#: sentence, split the `# function:` prose on its commas into two more,
#: built a two-cell coverage grid from one song, counted it in the
#: multi-tag histogram -- the very inflation metric this taxonomy exists
#: to watch -- and reported `undeclared_region: 0` for a file that says
#: the word "blank" in its own header.
#:
#: `check_file` DID catch it (that is how it was found, during the
#: Montgomery merge) and `check_file` is a different function that no
#: caller of `report()` has to run.  Doctrine 48: validation that lives
#: beside the reader rather than inside it gets applied exactly as often
#: as someone remembers.  One definition, at the read (doctrine 1).
#:
#: LATENT BY MEASUREMENT, NOT BY CONSTRUCTION: swept over every header
#: and song value in the live corpus, the distinct set is {american,
#: english, hymn, irish, nursery, patriotic, scottish, stage} and
#: **0 fail this shape**, so no recorded count moves.  A planted prose
#: line is what turns the gate red.
VALUE_SHAPE = re.compile(r"^[a-z][a-z0-9_]*$")


def _split_values(raw):
    """-> (values, malformed).  Both are tuples and they are NEVER summed:
    a value is something the table can be asked about, a malformed
    fragment is something no table has an opinion on."""
    parts = tuple(v.strip() for v in raw.split(",") if v.strip())
    good = tuple(v for v in parts if VALUE_SHAPE.match(v))
    bad = tuple(v for v in parts if not VALUE_SHAPE.match(v))
    return good, bad


def read_file_taxonomy(path):
    """-> (header, songs).  header = {'region': str|'', 'function': tuple};
    songs = [{'title', 'region', 'functions', 'line_no'}] with PER-SONG
    values only (resolution against the header is resolve_songs' job, so
    a caller can tell an override from an inheritance).

    THREE STATES PER AXIS, NEVER TWO AND NEVER SUMMED (doctrine 20/79):
    a value, an honest blank, and a MALFORMED line -- text on a
    `# region:`/`# function:`/`--- REGION:`/`--- FUNCTION:` key that is
    not shaped like a declaration at all (see VALUE_SHAPE).  Malformed
    text never becomes a value, because a caller counting values would
    otherwise count a sentence; and it is never silently blanked either,
    because "nobody declared a region" and "somebody wrote something
    here and it cannot be read" are different facts and collapsing them
    is a false negative dressed as a finding.  It is carried on
    `header['malformed']` and each song's `['malformed']` as
    (line_no, key, raw) so `check_file` can name the LINE rather than
    the fragments a comma-split made of it.

    Prose belongs on a `-basis:` key (`# region-basis:`), which the
    header pattern below cannot match -- it requires the colon
    immediately after the key word -- and which is therefore ignored
    here exactly as any other comment is."""
    header = {"region": "", "function": (), "malformed": []}
    songs = []
    cur = None
    with open(path, encoding="utf-8") as f:
        for i, ln in enumerate(f, 1):
            line = ln.rstrip("\n")
            if line.startswith("#"):
                m = re.match(r"#\s*(region|function):\s*(.+)$", line)
                if m and cur is None:
                    key, raw = m.group(1), m.group(2).strip()
                    good, bad = _split_values(raw)
                    if key == "region":
                        # A region is SINGLE-VALUED, so a comma here is
                        # itself the defect the doubled-region check
                        # names; keep the raw text so that check still
                        # sees it and only divert what is not a value.
                        if len(good) == 1 and not bad:
                            header["region"] = good[0]
                        elif bad:
                            header["malformed"].append((i, "# region:", raw))
                        else:
                            header["region"] = raw
                    else:
                        # ALL OR NOTHING PER LINE. If any fragment fails
                        # the shape the whole line is prose, and pulling
                        # the well-shaped words out of a sentence is the
                        # same defect in miniature -- `# function: none,
                        # really; this file is mixed` would otherwise
                        # contribute the value `none` AND a malformed
                        # record, inflating by_function and the multi-tag
                        # histogram off a line already known unreadable.
                        if bad:
                            header["malformed"].append((i, "# function:", raw))
                        else:
                            header["function"] = good
                continue
            if line.startswith(SONG_TITLE):
                cur = {"title": line[len(SONG_TITLE):].strip(),
                       "region": "", "functions": (), "line_no": i,
                       "malformed": []}
                songs.append(cur)
            elif line.startswith(SONG_REGION) and cur is not None:
                raw = line[len(SONG_REGION):].strip()
                good, bad = _split_values(raw)
                if len(good) == 1 and not bad:
                    cur["region"] = good[0]
                elif bad:
                    cur["malformed"].append((i, SONG_REGION, raw))
                else:
                    cur["region"] = raw
            elif line.startswith(SONG_FUNCTION) and cur is not None:
                raw = line[len(SONG_FUNCTION):].strip()
                good, bad = _split_values(raw)
                if bad:  # all or nothing per line -- see the header case
                    cur["malformed"].append((i, SONG_FUNCTION, raw))
                else:
                    cur["functions"] = good
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
    """-> [violation strings].  Empty means every assignment is legal.

    TWO GATES, AND THE ORDER MATTERS.  The SHAPE gate ran at the read;
    what reaches here is either a value the table can be asked about or
    a malformed LINE.  A malformed line is reported ONCE, naming the key
    and quoting the raw text -- not once per comma-separated fragment,
    which is how a single prose note used to arrive as seven violations
    that each looked like a bogus vocabulary word (found on the
    Montgomery merge, whose `# function:` note produced exactly that)."""
    bad = []
    header, songs = read_file_taxonomy(path)
    rel = os.path.relpath(path, ROOT)
    for line_no, key, raw in header["malformed"]:
        bad.append(f"{rel} L{line_no}: '{key}' is not a declaration — "
                   f"a value is one lowercase token ({VALUE_SHAPE.pattern}) "
                   f"and this line reads {raw[:60]!r}. Prose belongs on a "
                   f"'-basis:' key, which no reader parses as a value")
    if header["region"] and header["region"] not in regions:
        bad.append(f"{rel}: header region '{header['region']}' not in "
                   f"data/song_regions.tsv")
    if header["region"] and "," in header["region"]:
        bad.append(f"{rel}: header region is SINGLE-VALUED — a contested "
                   f"region stays blank, recorded, never doubled")
    for v in header["function"]:
        if v not in functions:
            bad.append(f"{rel}: header function '{v}' not in "
                       f"data/song_functions_eng.tsv")
    for s in songs:
        for line_no, key, raw in s["malformed"]:
            bad.append(f"{rel} L{line_no} '{s['title'][:40]}': '{key}' is "
                       f"not a declaration — a value is one lowercase token "
                       f"({VALUE_SHAPE.pattern}) and this line reads "
                       f"{raw[:60]!r}. Prose belongs on a '-basis:' key")
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
    the multi-tag histogram is per VALUE COUNT, never folded into cells.

    MALFORMED IS COUNTED AT THE LINE, NOT AT THE SONG, AND THAT IS A
    DECISION RATHER THAN A CONVENIENCE.  A song under an unreadable
    header genuinely HAS no declared region -- nobody successfully
    declared one -- so it belongs in `undeclared_region`, and the
    invariant `by_region + undeclared == songs` is kept whole rather
    than grown a third term that every pin would have to restate.  What
    doctrine 20 forbids is the collapse being SILENT, and it is not:
    `malformed` carries (file, line, key, raw) for every unreadable
    declaration, `malformed_files` counts the files, the printed report
    shouts the block whenever it is non-empty, and `--check` refuses
    outright at exit 2.  So "nobody declared a region" and "somebody
    wrote something here and it cannot be read" remain separable facts,
    answered by two counts that are never summed -- one about songs, one
    about lines, which is why they are not summable even in principle."""
    regions = load_regions()
    functions = load_functions()
    by_region, by_function, cells = {}, {}, {}
    n_songs = 0
    und_region = 0
    und_function = 0
    malformed = []
    multi = {}
    for path in eng_files(root):
        head, songs = read_file_taxonomy(path)
        for rec in head["malformed"]:
            malformed.append((os.path.basename(path),) + rec)
        for s in songs:
            for rec in s["malformed"]:
                malformed.append((os.path.basename(path),) + rec)
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
            "malformed": malformed,
            "malformed_files": len({m[0] for m in malformed}),
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
    # A THIRD STATE, PRINTED ONLY WHEN IT IS NON-ZERO, and printed at all
    # because a silent zero and a silent seven look identical in a report
    # whose other lines would absorb the seven as ordinary blanks.
    if r["malformed"]:
        print(f"  MALFORMED declarations: {len(r['malformed'])} line(s) over "
              f"{r['malformed_files']} file(s) — NOT counted as values and "
              f"NOT counted as undeclared; run --check to see them")
        for fname, line_no, key, raw in r["malformed"][:5]:
            print(f"    {fname} L{line_no} {key} {raw[:52]!r}")
    print("  Undeclared is an HONEST state (evidence-or-blank), and the "
          "two undeclared counts answer different axes — never sum them. "
          "A MALFORMED line is a third state again: it is not a value and "
          "it is not a blank, and it is never folded into either.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

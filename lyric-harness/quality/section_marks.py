#!/usr/bin/env python3
"""THE BRACKETED MARKS THIS CORPUS PRINTS, TRIAGED BY KIND (`MISSING.md` M-52).

`grid.MARK_FUNCTION` maps five marks to section functions. It was the only
reader of any `[MARK]` line, so every other mark reached NO check at all:
measured, **125,465 of 202,532 marked lines — 62% — answered nothing**, and a
mark nobody classified is indistinguishable from a mark nobody printed.

THE FOUR KINDS ARE FOUR DIFFERENT QUESTIONS AND MUST NOT BE ONE COLUMN'S
WORTH OF GUESSING (the owner's ruling on `same_object_as`, M-48, one table
over):

  function   what this section is FOR. `maps_to` names a `SECTION_FUNCTIONS`
             key, or is EMPTY where the vocabulary has no such function yet --
             which is a finding, not a defect.
  movement   a level ABOVE the section: it GROUPS sections. The piobaireachd
             ground/variation/crowning marks are this and nothing else, and
             the corpus says so -- in 3 of 3 files every one of them is
             immediately followed by a `[VERSE n]`.
  form       a verse-form or prosodic unit. A `[BAYT]` is a couplet and a
             `[SLOKA]` is a stanza; neither is a section function, and mapping
             one to a function would put the form layer's answer in the
             function layer's slot.
  voice      WHO sings, not what the span is for. `--voices` already
             establishes that this repo treats a voice as a declared reading.
  apparatus  not sung and not structural.
  refused    the corpus does not decide (doctrine 20). One row today.

THE TABLE IS DATA AND THE COUNTS ARE MEASURED. `--check` re-walks the corpus
and re-derives every `lines` and `files` cell, so a load that prints a new
mark turns this red instead of slipping into the 62%.
"""

import os
import re
import sys
import glob
import collections

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

TABLE = os.path.join(HERE, "..", "data", "section_marks.tsv")
CORPUS = os.path.join(HERE, "..", "corpus")

#: The closed set. A row whose kind is outside this refuses.
KINDS = ("function", "movement", "form", "voice", "apparatus", "refused")

#: `^[MARK]$` on its own line. The SAME shape `grid.read_marked_songs` reads,
#: and the trailing instance number is stripped so `[VERSE 1]` and `[VERSE 2]`
#: are one mark -- which is what makes a table of 55 rows rather than 1,400.
_MARK = re.compile(r"^\s*\[([^\]]{1,40})\]\s*$")

#: THE CAP IS A DECLARED EXCLUSION NOW, WITH ITS POPULATION COUNTED
#: (M-52's close, 2026-08-28). The 40-character bound above was silent: a
#: mark longer than it simply never reached the census, so `--check`'s
#: "every printed mark has a row" was true only of the marks the scanner
#: could see -- found when the voice build read 13 part labels out of the
#: Kanteletar against this table's 12, the thirteenth being
#: `[PART: Vähäonnisen naisen neuo morsiamelle]` at 41 characters.
#: MEASURED over the whole corpus: **24 distinct marks / 50 lines** beyond
#: the cap, and they are annotation-bearing heads, not new vocabulary --
#: 21 lines of `[CHORUS: abbreviated return ...]` staging marks, Byron's
#: and Shelley's bracketed publication notes, Coleridge's Ancient Mariner
#: marginal glosses, one Durfey sidenote, and the one long part label.
#: Keying THESE by full content would put every distinct sidenote in the
#: table, so they stay out of the rows and IN a counted bucket the check
#: verifies: a new long mark moves a number instead of vanishing.
MARK_CONTENT_CAP = 40
_MARK_LONG = re.compile(r"^\s*\[([^\]]{41,400})\]\s*$")
PINNED_BEYOND_CAP = {"marks": 24, "lines": 50}


def census_beyond_cap(root=None):
    """-> (n_distinct_marks, n_lines) past `MARK_CONTENT_CAP` -- the
    population the row census DECLARES it does not key."""
    root = root or CORPUS
    seen, n = set(), 0
    for p in sorted(glob.glob(os.path.join(root, "**", "*.txt"),
                              recursive=True)):
        try:
            with open(p, encoding="utf-8") as fh:
                for ln in fh:
                    m = _MARK_LONG.match(ln)
                    if m:
                        seen.add(normalise(m.group(1)))
                        n += 1
        except (UnicodeDecodeError, OSError):
            continue
    return len(seen), n


def normalise(raw):
    """-> the table's key for one bracket's contents."""
    return re.sub(r"\s*\d+\s*$", "", raw).strip().upper()


def census(root=None):
    """-> ({mark: lines}, {mark: n_files}). ONE WALK, and it is the same walk
    `--check` re-derives the committed counts from."""
    root = root or CORPUS
    lines = collections.Counter()
    files = collections.defaultdict(set)
    for p in sorted(glob.glob(os.path.join(root, "**", "*.txt"),
                              recursive=True)):
        try:
            with open(p, encoding="utf-8") as fh:
                for ln in fh:
                    m = _MARK.match(ln)
                    if m:
                        k = normalise(m.group(1))
                        lines[k] += 1
                        files[k].add(p)
        except (UnicodeDecodeError, OSError):
            continue
    return lines, {k: len(v) for k, v in files.items()}


def rows(path=None):
    """-> [{mark, kind, maps_to, lines, files, note}, ...]"""
    out = []
    with open(path or TABLE, encoding="utf-8") as fh:
        for ln in fh:
            if ln.startswith("#") or not ln.strip():
                continue
            parts = ln.rstrip("\n").split("\t")
            if parts[0] == "mark":
                continue
            while len(parts) < 6:
                parts.append("")
            out.append({"mark": parts[0], "kind": parts[1],
                        "maps_to": parts[2], "lines": int(parts[3]),
                        "files": int(parts[4]), "note": parts[5]})
    return out


def by_kind(rs=None):
    """-> {kind: (n_marks, n_lines)}. NEVER SUMMED into a total (doctrine 79):
    a form mark and a function mark are not two of the same thing, and a
    headline that added them would be the number this whole entry is about."""
    rs = rs if rs is not None else rows()
    out = {}
    for k in KINDS:
        sel = [r for r in rs if r["kind"] == k]
        out[k] = (len(sel), sum(r["lines"] for r in sel))
    return out


def check(root=None):
    """-> list of complaints. Empty is green."""
    from quality import grid as GR
    bad = []
    rs = rows()
    seen = {r["mark"]: r for r in rs}
    lines, files = census(root)

    # THE DECLARED EXCLUSION IS GATED (M-52): the marks past
    # MARK_CONTENT_CAP are not keyed by this table, and the check holds
    # their COUNT so a newly staged long mark turns this red instead of
    # vanishing the way the Kanteletar's thirteenth part label did.
    beyond = census_beyond_cap(root)
    if root is None and beyond != (PINNED_BEYOND_CAP["marks"],
                                   PINNED_BEYOND_CAP["lines"]):
        bad.append(f"beyond-cap population moved: pinned "
                   f"{PINNED_BEYOND_CAP['marks']} marks / "
                   f"{PINNED_BEYOND_CAP['lines']} lines, measured "
                   f"{beyond[0]} / {beyond[1]} -- a mark longer than "
                   f"{MARK_CONTENT_CAP} chars was staged or removed; "
                   f"inspect it and repin")

    for r in rs:
        if r["kind"] not in KINDS:
            bad.append(f"{r['mark']!r} declares kind {r['kind']!r}; the "
                       f"declared kinds are {list(KINDS)}")
        if r["maps_to"] and r["maps_to"] not in GR.SECTION_FUNCTIONS:
            bad.append(f"{r['mark']!r} maps to {r['maps_to']!r} and there is "
                       f"no such section function")
        if r["maps_to"] and r["kind"] != "function":
            bad.append(f"{r['mark']!r} is kind {r['kind']!r} and carries a "
                       f"`maps_to` -- only a FUNCTION maps to a function, or "
                       f"the form layer's answer lands in the function "
                       f"layer's slot")
        if not r["note"]:
            bad.append(f"{r['mark']!r} carries no note; a classification "
                       f"nobody can check is the prose-in-a-code-seat defect "
                       f"this table exists to end")

    for m, n in sorted(lines.items()):
        if m not in seen:
            bad.append(f"the corpus prints {m!r} ({n} lines) and the table "
                       f"has no row -- a load added a mark and this is the "
                       f"gate that says so, rather than it joining the 62% "
                       f"that answer nothing")
        elif seen[m]["lines"] != n:
            bad.append(f"{m!r}: table says {seen[m]['lines']} lines, corpus "
                       f"has {n}")
        elif seen[m]["files"] != files[m]:
            bad.append(f"{m!r}: table says {seen[m]['files']} files, corpus "
                       f"has {files[m]}")
    for m in seen:
        if m not in lines:
            bad.append(f"the table declares {m!r} and the corpus prints it "
                       f"nowhere -- a row with zero members is the "
                       f"declared-but-unread defect in a taxonomy hat")

    # THE ONE CROSS-CHECK AGAINST THE OTHER TABLE. `grid.MARK_FUNCTION` is the
    # live reader; this table is the census. They must agree about which marks
    # ARE functions, or a mark could be a function to one and apparatus to the
    # other (doctrine 1).
    live = {k.upper(): v for k, v in GR.MARK_FUNCTION.items()}
    declared = {r["mark"]: r["maps_to"] for r in rs if r["maps_to"]}
    if live != declared:
        bad.append(f"`grid.MARK_FUNCTION` and this table disagree about which "
                   f"marks map to a function: reader {sorted(live)} vs table "
                   f"{sorted(declared)}")
    return bad


def report(root=None):
    rs = rows()
    lines, _ = census(root)
    print("=" * 70)
    print("THE BRACKETED MARKS, BY KIND — never summed (doctrine 79)")
    print("=" * 70)
    print(f"  {'kind':10} {'marks':>6} {'lines':>9}")
    for k, (nm, nl) in by_kind(rs).items():
        print(f"  {k:10} {nm:6} {nl:9}")
    unmapped = [r for r in rs if r["kind"] == "function" and not r["maps_to"]]
    print(f"\n  FUNCTION rows the vocabulary has NO function for: "
          f"{len(unmapped)}")
    for r in unmapped:
        print(f"     [{r['mark']}]  {r['note'][:60]}")
    mv = [r for r in rs if r["kind"] == "movement"]
    print(f"\n  MOVEMENT rows — a level the model has no layer for: {len(mv)}")
    for r in mv:
        print(f"     [{r['mark']}]  {r['lines']} lines in {r['files']} file(s)")
    bad = check(root)
    print()
    if bad:
        print(f"FAIL — {len(bad)} complaint(s)")
        for b in bad[:12]:
            print(f"  - {b}")
        return 1
    print("PASS — every printed mark has a row, every count re-derives, and "
          "the reader agrees with the table")
    return 0


if __name__ == "__main__":
    sys.exit(report())

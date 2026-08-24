#!/usr/bin/env python3
"""The DELIVERED songs, checked — the artifact a person actually opens.

    python3 quality/test_songs.py

WHY THIS FILE EXISTS, AND WHY IT IS LATE
----------------------------------------
`songs/` held five delivered songs and **nothing in the repository read one**:
zero checks under `quality/`, zero mentions in `.github/workflows/ci.yml`.
Every gate in the tree was green while two of the five shipped with their
section structure missing entirely.

THE GATE THAT EXISTED WAS AIMED ONE STEP UPSTREAM. `test_plan.py` §6 proves
`render_song` puts a section's apparatus INSIDE its bracket — `[VERSE — 4
lines — 8 bars of 3/8]` — and its mutation proves that the same apparatus
split out onto its own line is scored as LYRIC with end word 'pickup'. That
check is real and it has always passed. It gates the RENDERER. It cannot see
what ends up in `songs/*.txt`, and it cannot see a song retyped by hand into
a chat window with the apparatus dropped. The defect kept happening in the
two places the gate had no jurisdiction over, and "the renderer is correct"
is not the same claim as "the shipped song is correct" (doctrine 1's shape,
one step out: two artifacts, one of them checked).

WHAT A SHIPPED SONG MUST CARRY. Its blueprint's sections, as `[NAME]`
markers, in order, with the right number of lines under each. That is not a
formatting preference — the blueprint is a sibling JSON file, so a lyric with
no markers is a list of lines whose shape lives only somewhere else. The
three songs that predate this file carry it exactly (`keep_the_light.txt`'s
eleven markers ARE its blueprint's eleven section names); the two that do not
are the defect this file was written for.
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SONGS = os.path.join(ROOT, "songs")
FAILURES = []
MARKER = re.compile(r"^\[([^\]]+)\]$")


def check(msg, ok, detail=""):
    print(f"  {'PASS' if ok else 'FAIL'}  {msg}")
    if detail:
        print(f"          {detail}")
    if not ok:
        FAILURES.append(msg)


def read_marked(path):
    """-> [(section_name | None, [lyric lines])] in file order.

    A `None` section is lyric before any marker, which is the shape a song
    with no markers at all has: one bucket, everything in it.
    """
    out, cur, buf = [], None, []
    for raw in open(path, encoding="utf-8").read().splitlines():
        line = raw.strip()
        if not line:
            continue
        m = MARKER.match(line)
        if m:
            if cur is not None or buf:
                out.append((cur, buf))
            cur, buf = m.group(1), []
        else:
            buf.append(line)
    if cur is not None or buf:
        out.append((cur, buf))
    return out


def blueprint_shape(bp_path):
    """-> [(section name, line count)] in blueprint order."""
    bp = json.load(open(bp_path, encoding="utf-8"))
    counts = {}
    for l in bp.get("lines", []):
        counts[l["section"]] = counts.get(l["section"], 0) + 1
    return [(s["name"], counts.get(s["name"], 0)) for s in bp["sections"]]


def songs():
    return sorted(glob.glob(os.path.join(SONGS, "*.txt")))


def test_there_are_songs_and_each_has_a_blueprint():
    print("\n1. the population — this section cannot pass by examining nothing")
    found = songs()
    check("there are delivered songs to check", bool(found),
          f"{len(found)}: {[os.path.basename(p) for p in found]}")
    missing = [os.path.basename(p) for p in found
               if not os.path.exists(p[: -len(".txt")] + ".blueprint.json")]
    check("every delivered song has its blueprint beside it — the blueprint "
          "is the AUTHORITY every check below reads, so a song without one "
          "is unmeasurable rather than clean (doctrine 20)",
          not missing, f"missing blueprints: {missing or 'none'}")


def test_every_song_carries_its_sections():
    """2. THE DEFECT THIS FILE WAS WRITTEN FOR.

    A lyric file with no `[SECTION]` markers is a list of lines. Its shape
    lives only in the sibling JSON, so the artifact a person opens no longer
    says what the song IS.
    """
    print("\n2. every shipped song carries its section markers")
    for p in songs():
        bp = p[: -len(".txt")] + ".blueprint.json"
        if not os.path.exists(bp):
            continue
        name = os.path.basename(p)
        marks = [s for s, _ in read_marked(p) if s is not None]
        want = blueprint_shape(bp)
        check(f"`{name}` carries section markers",
              bool(marks),
              f"{len(marks)} marker(s) against {len(want)} declared section(s)")


def test_the_markers_are_the_blueprints_sections():
    """3. AND THEY ARE THE RIGHT ONES, IN THE RIGHT ORDER, THE RIGHT SIZE.

    Markers that merely EXIST would let a song carry a plausible-looking
    shape that is not its own. The blueprint is the authority: same names,
    same order, same line counts — instrumentals included, at zero lines,
    because a section with no words is still a section (the rule
    `quality/plan.py` renders as `— instrumental — ..., no words`).
    """
    print("\n3. the markers ARE the blueprint's sections — name, order, size")
    for p in songs():
        bp = p[: -len(".txt")] + ".blueprint.json"
        if not os.path.exists(bp):
            continue
        name = os.path.basename(p)
        got = [(s, len(b)) for s, b in read_marked(p) if s is not None]
        want = blueprint_shape(bp)
        if not got:
            check(f"`{name}` — markers match the blueprint", False,
                  "no markers at all; §2 names this")
            continue
        check(f"`{name}` — markers match the blueprint's sections in order, "
              f"with each section's line count",
              got == want,
              f"file {got}\n          blueprint {want}" if got != want
              else f"{len(want)} section(s), {sum(n for _, n in want)} line(s)")


def test_the_mutation():
    """4. THE MUTATION — strip a good song's markers and require a FAIL.

    Without this, §2 and §3 pass on a tree where `read_marked` returns
    something vacuous, or where `songs/` is empty. The planted defect is
    exactly the one that shipped twice: the lines, in order, with the
    brackets gone.
    """
    print("\n4. MUTATION — a song with its markers stripped must FAIL")
    good = [p for p in songs()
            if os.path.exists(p[: -len(".txt")] + ".blueprint.json")
            and [s for s, _ in read_marked(p) if s is not None]]
    if not good:
        check("there is a marked song to mutate — with none, §2 and §3 "
              "above are vacuous and this file proves nothing", False,
              "no song in songs/ carries markers")
        return
    p = good[0]
    bp = p[: -len(".txt")] + ".blueprint.json"
    want = blueprint_shape(bp)
    stripped = [l for l in open(p, encoding="utf-8").read().splitlines()
                if l.strip() and not MARKER.match(l.strip())]
    tmp = os.path.join(SONGS, ".mutation_probe.txt")
    try:
        open(tmp, "w", encoding="utf-8").write("\n".join(stripped) + "\n")
        got = [(s, len(b)) for s, b in read_marked(tmp) if s is not None]
        check(f"`{os.path.basename(p)}` with its brackets removed reads as "
              f"ZERO sections and therefore does not match its blueprint — "
              f"so §2 and §3 are two-sided and a markerless song cannot pass "
              f"them",
              got == [] and got != want,
              f"stripped -> {len(got)} section(s); blueprint declares "
              f"{len(want)}")
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


if __name__ == "__main__":
    for fn in (test_there_are_songs_and_each_has_a_blueprint,
               test_every_song_carries_its_sections,
               test_the_markers_are_the_blueprints_sections,
               test_the_mutation):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {'; '.join(FAILURES)}")
        sys.exit(1)
    print("every delivered song carries the shape its blueprint declares")

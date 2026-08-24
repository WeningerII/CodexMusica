#!/usr/bin/env python3
"""A SECTION BRACKET MAY NOT BE PRESENTED WITHOUT ITS APPARATUS.

    python3 quality/check_render_form.py --text FILE      # check a blob
    python3 quality/check_render_form.py --transcript P   # last assistant turn
    ... | python3 quality/check_render_form.py            # stdin

WHAT THIS REFUSES, AND WHY IT IS NOT A LINT
-------------------------------------------
`quality/plan.py`'s `section_header` builds ONE bracket and every renderer
uses it:

    [INTRO — 2 lines — 2 bars of 8/8, one-beat pickup]
    [INTERLUDE — instrumental — 2 bars of 8/8, no words]

The line count, the bar count, the METER and the pickup are inside the
bracket ON PURPOSE — the owner's rule, 2026-08-18: measured-and-followed
means required in the OUTPUT, as implementation, not prose. Flattening that
to `[INTRO]` when presenting a song throws away two thirds of what the
section declares, and it has happened repeatedly because it looks harmless
and because nothing could see it: `test_plan.py` §6 gates the RENDERER, and
`test_songs.py` gates the FILE, and neither can read a message.

This can. Given a blob of presented text it finds every section bracket and
refuses the ones with no apparatus. Wired as a Stop hook it runs against the
turn about to be delivered, so the flattened form is caught BEFORE a person
has to come back and say it again.

THE ONE DECLARED ESCAPE, AND IT IS DECLARED IN THE TEXT, NOT IN A SAFELIST
HERE (the shape `quality/triage.py` uses for `TESTED WHILE OPEN`): a lyric
FILE legitimately carries bare `[VERSE1]` markers — that is the form
`songs/*.txt` stores and `test_songs.py` requires. Text that says
`RAW LYRIC FILE` is quoting one, and is passed. Anything else presenting two
or more bare section brackets is the defect.
"""
import argparse
import json
import os
import re
import sys

#: A section bracket as this project writes them: an all-caps function name,
#: optionally an instance number, and THEN whatever else is inside the
#: bracket. `[VERSE]`, `[FALSE_ENDING1]`, `[INTRO — 2 lines — 2 bars of 8/8]`.
#:
#: THE SECOND GROUP IS THE POINT AND THIS FILE'S OWN TEST CAUGHT IT MISSING.
#: The first version was `\[([A-Z][A-Z0-9_]*)\]` — it matched ONLY the bare
#: form, so the built form was not recognised as a bracket at all: the count
#: it reported was a count of defects rather than of sections, and §2 of
#: `test_render_form.py` measured ZERO headers on a seed that builds
#: twenty-three. A detector that cannot see the correct form is a detector
#: that cannot say the incorrect one is a minority.
BRACKET = re.compile(r"^\s*\[([A-Z][A-Z0-9_]*)([^\]]*)\]")
#: The apparatus separator `section_header` builds with. An em dash, spaced.
#: Tested against the bracket's INSIDE, never the whole line — otherwise
#: `[INTRO]   Freight — grey water` would pass on a dash in the lyric.
APPARATUS = " — "
#: Declared in the TEXT, so the escape is visible to whoever reads the text
#: rather than hidden in this file (doctrine 48).
DECLARED_RAW = "RAW LYRIC FILE"
#: Two, not one: a single bracketed word is prose ("[NOTE]", "[FLAG]"), and
#: refusing that would make this instrument something people route around.
MIN_BRACKETS = 2


def violations(text):
    """-> (offending [(lineno, line)], total section brackets seen)."""
    if DECLARED_RAW in text:
        return [], 0
    bare, total = [], 0
    for i, line in enumerate(text.splitlines(), 1):
        m = BRACKET.match(line)
        if not m:
            continue
        total += 1
        if APPARATUS not in m.group(2):
            bare.append((i, line.strip()))
    return (bare if total >= MIN_BRACKETS else []), total


def last_assistant_turn(path):
    """-> the text of the newest assistant message in a Claude Code JSONL."""
    out = []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            raw = raw.strip()
            if not raw:
                continue
            try:
                rec = json.loads(raw)
            except ValueError:
                continue
            msg = rec.get("message") or {}
            if rec.get("type") != "assistant" and msg.get("role") != "assistant":
                continue
            content = msg.get("content")
            if isinstance(content, str):
                out = [content]
            elif isinstance(content, list):
                out = [c.get("text", "") for c in content
                       if isinstance(c, dict) and c.get("type") == "text"]
    return "\n".join(out)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", help="a file to check")
    ap.add_argument("--transcript", help="a Claude Code JSONL; checks the "
                                         "newest assistant turn")
    a = ap.parse_args(argv)
    if a.transcript:
        if not os.path.exists(a.transcript):
            return 0                      # nothing to read is not a verdict
        text = last_assistant_turn(a.transcript)
    elif a.text:
        text = open(a.text, encoding="utf-8", errors="replace").read()
    else:
        text = sys.stdin.read()

    bad, total = violations(text)
    if not bad:
        return 0
    print("A SECTION BRACKET WAS PRESENTED WITHOUT ITS APPARATUS.",
          file=sys.stderr)
    print(f"{len(bad)} of {total} section bracket(s) carry no "
          f"'{APPARATUS.strip()}' clause:", file=sys.stderr)
    for lineno, line in bad[:8]:
        print(f"  line {lineno}: {line[:70]}", file=sys.stderr)
    if len(bad) > 8:
        print(f"  ... and {len(bad) - 8} more", file=sys.stderr)
    print("", file=sys.stderr)
    print("`quality/plan.py:section_header` builds the ONLY correct form and "
          "every renderer uses it:", file=sys.stderr)
    print("    [INTRO — 2 lines — 2 bars of 8/8, one-beat pickup]",
          file=sys.stderr)
    print("    [INTERLUDE — instrumental — 2 bars of 8/8, no words]",
          file=sys.stderr)
    print("The line count, the bar count, the METER and the pickup live "
          "INSIDE the bracket.", file=sys.stderr)
    print("DO NOT RETYPE A SONG. Run `plan --seed=N --fill=DRAFT --out=BP` "
          "and present its bytes.", file=sys.stderr)
    print(f"(Quoting a lyric file on purpose? Say '{DECLARED_RAW}' in the "
          f"text — declared, not silent.)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())

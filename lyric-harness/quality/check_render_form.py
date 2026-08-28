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

AND A RENDERED SONG CARRIES ITS CONVERGENCE STATE — THE OPERATOR SEAM
(`MISSING.md` M-150). The working order is sweep -> screen -> plan -> write ->
grade -> revise to a STOP CONDITION, and the owner's standing rule is that
nothing is allowed to skip a step. Every step but the last is enforced by a
verb that refuses; the last was enforced by nothing, because "the run
reached a stop condition" is a fact about the RUN and the run's exit code
lives in a terminal no gate can read — except this one, which is already
reading the turn. A turn that presents the built form with not one word
about how the run ended reads as FINISHED with no instrument having said
so. So a turn presenting MIN_BRACKETS or more BUILT section headers must
also DECLARE the state — an exit code as the verbs print it ("exit 0",
"exit 3"), or UNCONVERGED / PARKED for a draft that has not reached a stop.
THE GATE REQUIRES THE DISCLOSURE AND NEVER ADJUDICATES IT: an exit-3 draft
presented WITH its state is a disclosed draft, and a false claim is
`quality/song_log.py --verdicts`' business, charged against the banked log
rather than guessed at here. `RAW LYRIC FILE` escapes this check too — a
quoted file is a record, not a presentation of finished work.
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
#: A convergence-state declaration, in the spellings the verbs themselves
#: print (`song`/`revise` end on an exit code; scripts spell it `exit=N`) plus
#: the two honest words for a draft that has not reached a stop condition.
#: DELIBERATELY NOT `exit 0` alone: the gate wants the state SAID, not the
#: state CLEAN — an exit-3 draft disclosed as exit 3 passes, because
#: disclosure is this instrument's whole question and truth is --verdicts'.
STATE = re.compile(r"\bexit\s+\d\b|\bexit=\d\b|\bUNCONVERGED\b|\bPARKED\b",
                   re.IGNORECASE)


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


def rendered_without_state(text):
    """-> the [(lineno, line)] BUILT section headers of a rendered song
    presented with no convergence state declared anywhere in the turn;
    [] when the turn declares one, quotes a RAW LYRIC FILE, or presents
    fewer than MIN_BRACKETS built headers (prose mentioning one bracket).

    Counts APPARATUS-CARRYING brackets, not bare ones: a turn whose brackets
    are bare is already the other check's defect, and this one asks a
    different question — the song is rendered correctly, and HOW DID THE RUN
    END was never said."""
    if DECLARED_RAW in text:
        return []
    built = []
    for i, line in enumerate(text.splitlines(), 1):
        m = BRACKET.match(line)
        if m and APPARATUS in m.group(2):
            built.append((i, line.strip()))
    if len(built) < MIN_BRACKETS or STATE.search(text):
        return []
    return built


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
    stateless = rendered_without_state(text)
    if not bad and not stateless:
        return 0
    if bad:
        print("A SECTION BRACKET WAS PRESENTED WITHOUT ITS APPARATUS.",
              file=sys.stderr)
        print(f"{len(bad)} of {total} section bracket(s) carry no "
              f"'{APPARATUS.strip()}' clause:", file=sys.stderr)
        for lineno, line in bad[:8]:
            print(f"  line {lineno}: {line[:70]}", file=sys.stderr)
        if len(bad) > 8:
            print(f"  ... and {len(bad) - 8} more", file=sys.stderr)
        print("", file=sys.stderr)
        print("`quality/plan.py:section_header` builds the ONLY correct form "
              "and every renderer uses it:", file=sys.stderr)
        print("    [INTRO — 2 lines — 2 bars of 8/8, one-beat pickup]",
              file=sys.stderr)
        print("    [INTERLUDE — instrumental — 2 bars of 8/8, no words]",
              file=sys.stderr)
        print("The line count, the bar count, the METER and the pickup live "
              "INSIDE the bracket.", file=sys.stderr)
        print("DO NOT RETYPE A SONG. Run `plan --seed=N --fill=DRAFT "
              "--out=BP` and present its bytes.", file=sys.stderr)
        print(f"(Quoting a lyric file on purpose? Say '{DECLARED_RAW}' in "
              f"the text — declared, not silent.)", file=sys.stderr)
    if stateless:
        if bad:
            print("", file=sys.stderr)
        print("A RENDERED SONG WAS PRESENTED WITH NO CONVERGENCE STATE "
              "DECLARED.", file=sys.stderr)
        print(f"{len(stateless)} built section header(s) and not one word "
              f"about how the run ended:", file=sys.stderr)
        for lineno, line in stateless[:4]:
            print(f"  line {lineno}: {line[:70]}", file=sys.stderr)
        if len(stateless) > 4:
            print(f"  ... and {len(stateless) - 4} more", file=sys.stderr)
        print("", file=sys.stderr)
        print("A rendered song shown bare reads as FINISHED, and only the "
              "instruments may say that", file=sys.stderr)
        print("— the owner's rule: nothing is allowed to skip a step. Say "
              "what the verbs said,", file=sys.stderr)
        print("in the turn text, beside the song:", file=sys.stderr)
        print("    `song`/`revise` print an exit code — quote it: \"exit 0\" "
              "(clean), \"exit 3\"", file=sys.stderr)
        print("    (a flag stands), \"exit 2\" (refused), \"exit 4\" "
              "(waiting on a writer);", file=sys.stderr)
        print("    or say UNCONVERGED / PARKED for a draft that reached no "
              "stop condition.", file=sys.stderr)
        print("This gate requires the DISCLOSURE and never adjudicates it: "
              "an exit-3 draft", file=sys.stderr)
        print("presented WITH its state is a disclosed draft. A false claim "
              "is `quality/song_log.py", file=sys.stderr)
        print("--verdicts`' business, charged against the banked log.",
              file=sys.stderr)
        print(f"(Quoting a lyric file on purpose? Say '{DECLARED_RAW}' in "
              f"the text — declared, not silent.)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())

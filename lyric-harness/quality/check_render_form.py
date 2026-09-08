#!/usr/bin/env python3
"""Check section apparatus and the provenance of a finished presentation.

``--text FILE`` and stdin perform FORMAT CHECKING ONLY. They cannot establish
that a revision ran. ``--transcript`` additionally requires a FINISHED artifact
to match the structured result of an actual ``lyric_revise`` tool invocation,
paired by tool-use ID. It never discovers receipts by searching lyric prose.

Bare section markers require the explicit RAW LYRIC FILE disclosure. Built
sections require a complete FINISHED/GRADED stamp or PARKED/UNCONVERGED.
GRADED and PARKED remain disclosures of interim work. A transcript FINISHED
claim, including an honestly stopped draft, requires the exact returned
``presentation_text``. Tool-only messages do not erase the last presentation.
"""
import argparse
import hashlib
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
BRACKET = re.compile(r"^\s*(?:#{1,6}\s+)?(?:\*\*|__)?\[([A-Z][A-Z0-9_]*)([^\]]*)\]")
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
#: The two stamps the verbs write under a rendered song, and they are the
#: ONLY exit-code spellings this gate accepts (M-243). Whitespace around the
#: em dashes is tolerated; the dash itself is not negotiable — a hyphenated
#: stamp is a retyped stamp, and M-97 says present the bytes.
STAMP_FINISHED = re.compile(
    r"\[FINISHED\s*—\s*(?:seed\s*-?\d+|declared mandate)\s*—\s*"
    r"exit\s*\d+\s*—\s*[A-Z_]+ after \d+ round\(s\)\s*—\s*[^\]\n]+\]")
STAMP_GRADED = re.compile(
    r"\[GRADED\s*—\s*seed\s*-?\d+\s*—\s*exit\s*\d+,"
    r"[^\]\n]+—\s*\d+ banned pair\(s\)\]")
STATE = re.compile(
    r"%s|%s|\bUNCONVERGED\b|\bPARKED\b"
    % (STAMP_FINISHED.pattern, STAMP_GRADED.pattern), re.IGNORECASE)
FINISHED_CLAIM = re.compile(r"\[FINISHED\b", re.IGNORECASE)
CONTROL_NAMES = frozenset(("FINISHED", "GRADED"))
#: The old spelling, kept as a NAME so `test_render_form.py` §8 can restore
#: it as a mutation and show the tightening is load-bearing. Read by nothing
#: else.
BARE_EXIT = re.compile(r"\bexit\s+\d\b|\bexit=\d\b", re.IGNORECASE)


def violations(text):
    """-> (offending [(lineno, line)], total section brackets seen)."""
    if DECLARED_RAW in text:
        return [], 0
    bare, total = [], 0
    for i, line in enumerate(text.splitlines(), 1):
        m = BRACKET.match(line)
        if not m or m.group(1) in CONTROL_NAMES:
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
        if m and m.group(1) not in CONTROL_NAMES and APPARATUS in m.group(2):
            built.append((i, line.strip()))
    if len(built) < MIN_BRACKETS or STATE.search(text):
        return []
    return built


def _text_blocks(content):
    if isinstance(content, str):
        return [content] if content.strip() else []
    if isinstance(content, list):
        return [c["text"] for c in content if isinstance(c, dict)
                and c.get("type") == "text" and isinstance(c.get("text"), str)
                and c["text"].strip()]
    return []


def _finished_receipt(content):
    """Read the documented MCP envelope, never JSON embedded in lyrics.

    Finished lyric_revise results have two content blocks: the human render,
    then one JSON verdict. Claude may encode that MCP envelope as a JSON text
    block or directly retain its content array. No other location is searched.
    """
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except (ValueError, TypeError):
            return None
    if isinstance(content, list) and len(content) == 1:
        block = content[0]
        if not isinstance(block, dict) or block.get("type") != "text":
            return None
        try:
            content = json.loads(block.get("text", ""))
        except (ValueError, TypeError):
            return None
    if isinstance(content, dict):
        content = content.get("content")
    if not isinstance(content, list) or len(content) != 2:
        return None
    human, machine = content
    if not all(isinstance(c, dict) and c.get("type") == "text"
               and isinstance(c.get("text"), str) for c in (human, machine)):
        return None
    try:
        verdict = json.loads(machine["text"])
    except (ValueError, TypeError):
        return None
    if not isinstance(verdict, dict):
        return None
    draft, presentation = verdict.get("final_draft"), verdict.get("presentation_text")
    if (not isinstance(draft, list) or not draft
            or not all(isinstance(line, str) for line in draft)
            or not isinstance(presentation, str) or not presentation.strip()
            or presentation not in human["text"]
            or type(verdict.get("exit_code")) is not int
            or not isinstance(verdict.get("loop_stop_reason"), str)
            or not isinstance(verdict.get("loop_unresolved_lines"), list)
            or type(verdict.get("loop_whole_flags")) is not int
            or not isinstance(verdict.get("coverage"), dict)):
        return None
    digest = hashlib.sha256(json.dumps(draft, ensure_ascii=False,
                                      separators=(",", ":")).encode("utf-8")).hexdigest()
    if digest != verdict.get("final_draft_sha256"):
        return None
    if verdict["exit_code"] == 0 and not (
            verdict.get("status") == "finished_clean"
            and verdict.get("certified") is True
            and verdict["coverage"].get("certified") is True
            and verdict["loop_stop_reason"] == "SUCCESS"
            and not verdict["loop_unresolved_lines"]
            and verdict["loop_whole_flags"] == 0):
        return None
    # The exact stamp must agree with the typed verdict; lyric-like stamps
    # earlier in the artifact never become machine status.
    last_line = presentation.strip().splitlines()[-1].strip()
    if not STAMP_FINISHED.fullmatch(last_line):
        return None
    if not re.search(r"—\s*exit\s*%d\s*—\s*%s after " % (
            verdict["exit_code"], re.escape(verdict["loop_stop_reason"])), last_line):
        return None
    return verdict


def transcript_presentation(path):
    """Latest nonempty assistant text and preceding, paired revision receipts."""
    out, pending, receipts, before_text = [], {}, [], []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            try:
                rec = json.loads(raw)
            except ValueError:
                continue
            if not isinstance(rec, dict):
                continue
            msg = rec.get("message") or {}
            if not isinstance(msg, dict):
                continue
            assistant = rec.get("type") == "assistant" or msg.get("role") == "assistant"
            content = msg.get("content")
            if assistant:
                parts = _text_blocks(content)
                if parts:
                    out, before_text = parts, list(receipts)
                for block in content if isinstance(content, list) else []:
                    if not isinstance(block, dict) or block.get("type") != "tool_use":
                        continue
                    name, identifier = block.get("name", ""), block.get("id")
                    if isinstance(name, str) and isinstance(identifier, str):
                        pending[identifier] = name.split("__")[-1] == "lyric_revise"
            elif rec.get("type") == "user" or msg.get("role") in ("user", "tool"):
                for block in content if isinstance(content, list) else []:
                    if not isinstance(block, dict) or block.get("type") != "tool_result":
                        continue
                    identifier = block.get("tool_use_id")
                    valid_call = pending.pop(identifier, False) if isinstance(identifier, str) else False
                    if valid_call and not block.get("is_error"):
                        receipt = _finished_receipt(block.get("content"))
                        if receipt is not None:
                            receipts.append(receipt)
    return "\n".join(out), before_text


def last_assistant_turn(path):
    return transcript_presentation(path)[0]


def receipt_violation(text, receipts):
    """A finished artifact must be quoted exactly from a paired tool receipt."""
    if not FINISHED_CLAIM.search(text):
        return None
    for receipt in reversed(receipts):
        artifact = receipt["presentation_text"].strip()
        if artifact not in text:
            continue
        outside = text.replace(artifact, "", 1)
        # Commentary is allowed; a second presentation or stamp is not covered
        # by this receipt. Complete user lyric bytes inside the artifact remain
        # data, even when they resemble a control stamp.
        if FINISHED_CLAIM.search(outside) or any(BRACKET.match(line)
                                                for line in outside.splitlines()):
            continue
        return None
    return ("FINISHED has no matching lyric_revise tool receipt for these exact "
            "presentation_text bytes. Present the tool artifact unchanged, or "
            "disclose an interim draft as GRADED, PARKED, or UNCONVERGED.")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--text", help="format check only; cannot certify a revision receipt")
    ap.add_argument("--transcript", help="a Claude Code JSONL; checks the "
                                         "newest assistant turn")
    a = ap.parse_args(argv)
    if a.transcript:
        if not os.path.exists(a.transcript):
            print("Cannot check the presentation: transcript file is missing.", file=sys.stderr)
            return 1
        text, receipts = transcript_presentation(a.transcript)
    elif a.text:
        text = open(a.text, encoding="utf-8", errors="replace").read()
    else:
        text = sys.stdin.read()

    receipt_error = receipt_violation(text, receipts) if a.transcript else None
    bad, total = violations(text)
    stateless = rendered_without_state(text)
    if not bad and not stateless and not receipt_error:
        return 0
    if receipt_error:
        print(receipt_error, file=sys.stderr)
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
        print("— the owner's rule: nothing is allowed to skip a step. Quote "
              "the STAMP the verb wrote,", file=sys.stderr)
        print("in the turn text, beside the song:", file=sys.stderr)
        print("    [FINISHED — seed N — exit E — STOP after R round(s) — …]  "
              "from `finish` / lyric_revise,", file=sys.stderr)
        print("        the only stamp written past a stop condition (exit 0 "
              "converged, exit 3 parked);", file=sys.stderr)
        print("    [GRADED — seed N — exit E, … — N banned pair(s)]          "
              "from lyric_grade — an INTERIM", file=sys.stderr)
        print("        draft, disclosed as one; or say UNCONVERGED / PARKED "
              "for a draft with no stop reached.", file=sys.stderr)
        if BARE_EXIT.search(text):
            print("A BARE \"exit N\" IS NOT ACCEPTED (M-243): grade and "
                  "finish both end in one, no verb prints", file=sys.stderr)
            print("those words into the text, so a bare code was typed here "
                  "and says nothing about WHICH", file=sys.stderr)
            print("verb produced it. That is how a graded draft was presented "
                  "as a run's exit 0.", file=sys.stderr)
        print("Transcript FINISHED claims require the exact artifact from a "
              "paired lyric_revise tool result. --text and stdin check format "
              "only; GRADED and PARKED disclose interim work.", file=sys.stderr)
        print(f"(Quoting a lyric file on purpose? Say '{DECLARED_RAW}' in "
              f"the text — declared, not silent.)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())

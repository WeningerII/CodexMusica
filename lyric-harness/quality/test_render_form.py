#!/usr/bin/env python3
"""The apparatus check, and the hook that gives it jurisdiction.

`quality/check_render_form.py` is the only thing in this repository that can
see a section bracket in a MESSAGE. `test_plan.py` §6 gates the renderer and
`test_songs.py` gates the shipped file; both pass while a song is retyped by
hand with `[INTRO — 2 lines — 2 bars of 8/8, one-beat pickup]` flattened to
`[INTRO]`. That is what kept happening, and it kept happening because it was
outside every gate's reach.

THE FIXTURES BELOW ARE THE REAL DEFECT, not an invented one: the bracket
column from the two songs this session presented flattened.
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(ROOT)
sys.path.insert(0, ROOT)
from quality import check_render_form as C          # noqa: E402

FAILURES = []

#: THE SHIPPED DEFECT, VERBATIM in shape: what was presented for `carry_it_over`.
FLATTENED = ("Here it is:\n\n"
             "[INTRO]         Freight, grey water, low in the hold\n"
             "[INTERLUDE]     (instrumental)\n"
             "[VAMP]          Down in the engine, counting strokes\n"
             "[CHORUS]        Carry it. Don't look down.\n")
#: What `plan.section_header` actually builds.
CORRECT = ("[INTRO — 2 lines — 2 bars of 8/8]\n"
           "Freight, grey water, low in the hold\n"
           "[INTERLUDE — instrumental — 2 bars of 8/8, no words]\n"
           "[VAMP — 2 lines — 2 bars of 8/8]\n"
           "Down in the engine, counting strokes\n")
#: The built form WITH its convergence state declared — what a finished
#: presentation looks like under ALL THREE gates (M-97's apparatus, M-150's
#: operator seam, M-243's provenance). CORRECT alone is the §7 defect:
#: rendered right, and not one word about how the run ended.
FINISHED_STAMP = ("[FINISHED — seed 6 — exit 0 — SUCCESS after 2 round(s) "
                  "— no flag stands]")
CORRECT_STATED = CORRECT + "\n  " + FINISHED_STAMP + "\n"
#: The INTERIM stamp `lyric_grade` writes — disclosed as a grade, so it
#: passes; the reader is TOLD it is not a run.
GRADED_STAMP = "[GRADED — seed 6 — exit 0, no FLAG stands — 0 banned pair(s)]"
CORRECT_GRADED = CORRECT + "\n" + GRADED_STAMP + "\n"
#: THE M-243 DEFECT, VERBATIM in shape: this was §6/§7's GOOD fixture until
#: 2026-09-05 — a bare exit code typed by the operator, which no verb prints
#: into text, so it says nothing about which verb produced it. It is the
#: exact spelling a session used to present a graded draft as a run's exit 0.
CORRECT_BARE_EXIT = CORRECT + "\nsong: exit 0 — revise SUCCESS in 0 rounds\n"


def check(msg, ok, detail=""):
    print(f"  {'PASS' if ok else 'FAIL'}  {msg}")
    if detail:
        print(f"          {detail}")
    if not ok:
        FAILURES.append(msg)


def test_the_predicate():
    print("\n1. the predicate — the flattened form is refused, the built one "
          "is not")
    bad, total = C.violations(FLATTENED)
    check("the SHIPPED flattened render is refused, and every bracket in it "
          "is named — this fixture is the real defect's shape, not an "
          "invented one",
          len(bad) == 4 and total == 4, f"{len(bad)} of {total} refused")
    good, gtotal = C.violations(CORRECT)
    check("what `plan.section_header` actually builds passes — the check "
          "cannot be satisfied by refusing everything",
          good == [] and gtotal == 3, f"{len(good)} of {gtotal} refused")


def test_the_builder_itself_passes():
    """2. AND THE PASSING ARM IS THE PRODUCTION BUILDER, NOT A HAND-TYPED
    IMITATION OF IT. If `section_header` ever changed its separator this
    would go red here rather than in a message six weeks later."""
    print("\n2. the real builder's output passes its own check")
    from quality import plan as P
    p = P.make_plan(394)
    heads = []
    for s in p["sections"]:
        slots = [ls for ls in p["line_slots"] if ls["section"] == s["name"]]
        heads.append(P.section_header(s, slots))
    bad, total = C.violations("\n".join(heads))
    check(f"all {total} header(s) `section_header` builds for seed 394 pass "
          f"the check that guards them",
          bad == [] and total == len(heads), f"{len(bad)} refused of {total}")


def test_the_escapes_and_the_floor():
    print("\n3. the declared escape, and the one-bracket floor")
    bad, _ = C.violations(FLATTENED + "\n" + C.DECLARED_RAW)
    check(f"text declaring `{C.DECLARED_RAW}` is passed — a lyric FILE "
          f"legitimately carries bare markers, and the escape is DECLARED IN "
          f"THE TEXT rather than hidden in a safelist here",
          bad == [], f"{len(bad)} refused")
    bad, _ = C.violations("the grader said [NOTE] and moved on")
    check("a single bracketed word is prose, not a song — refusing it would "
          "make this instrument something people route around",
          bad == [], f"{len(bad)} refused")


def test_the_transcript_reader():
    print("\n4. the transcript reader takes the NEWEST assistant turn")
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, "t.jsonl")
        with open(p, "w", encoding="utf-8") as fh:
            for text in (CORRECT, FLATTENED):
                fh.write(json.dumps({"type": "assistant", "message": {
                    "role": "assistant",
                    "content": [{"type": "text", "text": text}]}}) + "\n")
        got = C.last_assistant_turn(p)
        check("an earlier CLEAN turn does not excuse the newest one — the "
              "reader takes the last, which is the turn about to be delivered",
              "[INTRO]  " in got and "2 bars of 8/8" not in got,
              f"{len(got)} chars read")
        check("...and the CLI refuses on it, exit 1",
              C.main(["--transcript", p]) == 1)


def test_the_mutation():
    """5. MUTATION — blunt the separator and the flattened form must PASS.

    Without this, §1 could be passing because `violations` refuses nothing
    and the fixtures happen to agree.
    """
    print("\n5. MUTATION — with the apparatus test blunted, the defect passes")
    keep = C.APPARATUS
    try:
        C.APPARATUS = ""            # every line "contains" the empty string
        bad, _ = C.violations(FLATTENED)
        check("with the apparatus separator blunted to '', the SHIPPED "
              "flattened render is accepted — so §1's refusal is that "
              "separator doing the work and not the fixture",
              bad == [], f"{len(bad)} refused under the mutation")
    finally:
        C.APPARATUS = keep
    bad, _ = C.violations(FLATTENED)
    check("...and the mutation is reverted, so this file leaves the "
          "instrument as it found it", len(bad) == 4, f"{len(bad)} refused")


def test_the_hook_is_wired():
    """6. THE INSTRUMENT WITHOUT THE HOOK IS A SCRIPT NOBODY RUNS.

    The check only has jurisdiction over a message because a Stop hook hands
    it the transcript. So the wiring is part of the claim, and it is checked
    end to end by running the hook the way the harness runs it.
    """
    print("\n6. the Stop hook that gives the check its jurisdiction")
    hook = os.path.join(REPO, ".claude", "render_form_hook.sh")
    settings = os.path.join(REPO, ".claude", "settings.json")
    check("the hook script exists and is executable",
          os.path.exists(hook) and os.access(hook, os.X_OK), hook)
    ok = False
    if os.path.exists(settings):
        cfg = json.load(open(settings, encoding="utf-8"))
        ok = any(hk.get("command", "").endswith("render_form_hook.sh")
                 for entry in cfg.get("hooks", {}).get("Stop", [])
                 for hk in entry.get("hooks", []))
    check("...and `.claude/settings.json` registers it on Stop, so it runs "
          "against the turn about to be delivered", ok, settings)
    if not (os.path.exists(hook) and os.path.exists(settings)):
        return
    env = dict(os.environ, CLAUDE_PROJECT_DIR=REPO)
    with tempfile.TemporaryDirectory() as td:
        outcomes = {}
        for name, text in (("bad", FLATTENED), ("good", CORRECT_STATED)):
            tp = os.path.join(td, f"{name}.jsonl")
            with open(tp, "w", encoding="utf-8") as fh:
                fh.write(json.dumps({"type": "assistant", "message": {
                    "role": "assistant",
                    "content": [{"type": "text", "text": text}]}}) + "\n")
            for active in (False, True):
                r = subprocess.run(
                    [hook], input=json.dumps(
                        {"transcript_path": tp, "stop_hook_active": active}),
                    capture_output=True, text=True, env=env, timeout=60)
                outcomes[(name, active)] = r.returncode
    check("END TO END: a turn carrying the flattened render is BLOCKED "
          "(exit 2), which is the enforcement — not a note, not a reminder",
          outcomes[("bad", False)] == 2, str(outcomes))
    check("...a turn carrying the built form WITH its state declared is "
          "allowed (exit 0), so the hook is two-sided and cannot pass by "
          "blocking everything",
          outcomes[("good", False)] == 0, str(outcomes))
    check("...and `stop_hook_active` is honoured, so the hook blocks ONCE "
          "and can never trap the session in a loop",
          outcomes[("bad", True)] == 0, str(outcomes))


def test_the_operator_seam():
    """7. A RENDERED SONG CARRIES ITS CONVERGENCE STATE (M-150).

    The working order ends at a STOP CONDITION and every step but the last
    is enforced by a verb that refuses; this is the last step's gate. The
    check requires the state be DECLARED and never that it be clean — an
    exit-3 draft disclosed as exit 3 is a disclosed draft, and whether the
    claim is TRUE is `song_log.py --verdicts`' business, not this file's.
    """
    print("\n7. the operator seam — a rendered song carries its state")
    got = C.rendered_without_state(CORRECT)
    check("the built form presented with not one word about how the run "
          "ended is REFUSED — rendered right and stateless is the defect, "
          "and every built header is named",
          len(got) == 3, f"{len(got)} stateless header(s)")
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, "stateless.txt")
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(CORRECT)
        check("...and `main()` refuses it at exit 1, so the Stop hook that "
              "wraps this to exit 2 blocks the turn",
              C.main(["--text", p]) == 1)
    check("the same render beside the `[FINISHED — …]` stamp passes — the "
          "state the verb WROTE, quoted in the turn, is the whole ask",
          C.rendered_without_state(CORRECT_STATED) == [])
    check("...and beside an exit-3 `[FINISHED — declared mandate — …]` "
          "stamp it ALSO passes — disclosure, never adjudication: a parked "
          "draft presented AS parked is a disclosed draft",
          C.rendered_without_state(
              CORRECT + "\n[FINISHED — declared mandate — exit 3 — "
              "ROUND_LIMIT after 8 round(s) — UNRESOLVED: L4]\n") == [])
    check("...and UNCONVERGED passes too, case-insensitively — the honest "
          "word for a draft with no stop condition reached is a state",
          C.rendered_without_state(CORRECT + "\nstill unconverged.\n") == [])
    check(f"`{C.DECLARED_RAW}` escapes this gate exactly as it escapes the "
          f"apparatus gate — a quoted file is a record, not a presentation "
          f"of finished work",
          C.rendered_without_state(CORRECT + "\n" + C.DECLARED_RAW) == [])
    check("prose carrying ONE built bracket is below the floor — this "
          "instrument must not be something people route around",
          C.rendered_without_state(
              "the header reads [INTRO — 2 lines — 2 bars of 8/8] "
              "here") == [])
    # THE MUTATION, hand-proven: blunt STATE to match-anything and the
    # stateless render is accepted — so the refusal above is the state
    # regex doing the work, not the fixture or the bracket count.
    keep = C.STATE
    try:
        C.STATE = __import__("re").compile("")   # search('') hits any text
        got = C.rendered_without_state(CORRECT)
        check("MUTATION: with STATE blunted to match-anything, the "
              "stateless render is accepted — the state regex is what "
              "does the refusing",
              got == [], f"{len(got)} refused under the mutation")
    finally:
        C.STATE = keep
    check("...and the mutation is reverted, so this file leaves the "
          "instrument as it found it",
          len(C.rendered_without_state(CORRECT)) == 3)


def test_graded_is_not_finished():
    """8. THE STATE SAYS WHICH VERB SAID IT (M-243, 2026-09-05).

    M-150 accepted a bare `exit N`. A session then graded a draft, presented
    the render beside "exit 0", and stopped short of the loop — six lines
    still open — and this gate passed the turn, because an exit code was
    SAID. No CLI verb prints "exit N" into text; the verbs write STAMPS whose
    first word is the provenance. Those stamps, or UNCONVERGED / PARKED, are
    the whole accepted set now. Still disclosure: a GRADED turn passes AS a
    grade. What cannot happen any more is a grade's code read as a run's.
    """
    print("\n8. graded is not finished — the state carries its provenance")
    got = C.rendered_without_state(CORRECT_BARE_EXIT)
    check("the fixture that was §6/§7's GOOD arm until 2026-09-05 — the built "
          "render beside a bare \"song: exit 0\" — is REFUSED now, every "
          "header named", len(got) == 3, f"{len(got)} refused")
    check("...and so is a bare \"revise: exit 3\": the tightening is about "
          "PROVENANCE, not about the code being clean",
          len(C.rendered_without_state(
              CORRECT + "\nrevise: exit 3 — one flag standing\n")) == 3)
    check("the same render under the `[GRADED — …]` stamp PASSES — an "
          "interim draft disclosed as one is a disclosed draft",
          C.rendered_without_state(CORRECT_GRADED) == [])
    check("...and under the `[FINISHED — …]` stamp passes — the only stamp "
          "written past a stop condition",
          C.rendered_without_state(CORRECT_STATED) == [])
    check("a hyphenated stamp is a RETYPED stamp and does not count (M-97: "
          "present the bytes)",
          len(C.rendered_without_state(
              CORRECT + "\n[FINISHED - seed 6 - exit 0 - SUCCESS]\n")) == 3)
    # THE REFUSAL NAMES THE RULE: main() on the bare-exit turn says so.
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, "bare.txt")
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(CORRECT_BARE_EXIT)
        import io, contextlib
        buf = io.StringIO()
        with contextlib.redirect_stderr(buf):
            rc = C.main(["--text", p])
        err = buf.getvalue()
    check("`main()` refuses the bare-exit turn at exit 1 and its reason "
          "names BOTH stamps and the M-243 rule, so the blocked turn is "
          "told what to quote instead",
          rc == 1 and "[FINISHED — seed N" in err and "[GRADED — seed N" in err
          and "BARE \"exit N\" IS NOT ACCEPTED (M-243)" in err,
          err.strip().splitlines()[-1][:70] if err else "no stderr")
    # ONE DEFINITION OF THE FINISHED STAMP (doctrine 1): song_log.py PARSES
    # it for the bank, this module RECOGNISES it for the gate. Hold both to
    # the same samples — each must accept both shipped FINISHED shapes and
    # each must reject the GRADED stamp — so they cannot drift apart.
    from quality import song_log as SL
    samples_yes = (FINISHED_STAMP,
                   "[FINISHED — declared mandate — exit 3 — ROUND_LIMIT "
                   "after 8 round(s) — UNRESOLVED: L4]")
    check("song_log's `_STAMP` parser and this gate's `STAMP_FINISHED` agree "
          "on both shipped FINISHED shapes and both reject the GRADED stamp",
          all(SL._STAMP.search(x) and C.STAMP_FINISHED.search(x)
              for x in samples_yes)
          and not SL._STAMP.search(GRADED_STAMP)
          and not C.STAMP_FINISHED.search(GRADED_STAMP))
    # THE MUTATION, hand-proven: put the pre-M-243 rule back (bare exit
    # accepted) and the bare-exit turn PASSES — so the refusal above is the
    # tightening doing the work, not the fixture.
    keep = C.STATE
    try:
        C.STATE = __import__("re").compile(
            C.BARE_EXIT.pattern + r"|\bUNCONVERGED\b|\bPARKED\b",
            __import__("re").IGNORECASE)
        check("MUTATION: with the pre-M-243 bare-exit rule restored, the "
              "bare \"song: exit 0\" turn is ACCEPTED — the provenance "
              "requirement is what refuses it",
              C.rendered_without_state(CORRECT_BARE_EXIT) == [])
    finally:
        C.STATE = keep
    check("...and the mutation is reverted, so this file leaves the "
          "instrument as it found it",
          len(C.rendered_without_state(CORRECT_BARE_EXIT)) == 3)


if __name__ == "__main__":
    for fn in (test_the_predicate, test_the_builder_itself_passes,
               test_the_escapes_and_the_floor, test_the_transcript_reader,
               test_the_mutation, test_the_hook_is_wired,
               test_the_operator_seam, test_graded_is_not_finished):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {'; '.join(FAILURES)}")
        sys.exit(1)
    print("the section apparatus cannot leave this session flattened")

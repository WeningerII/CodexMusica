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
        for name, text in (("bad", FLATTENED), ("good", CORRECT)):
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
    check("...a turn carrying the built form is allowed (exit 0), so the "
          "hook is two-sided and cannot pass by blocking everything",
          outcomes[("good", False)] == 0, str(outcomes))
    check("...and `stop_hook_active` is honoured, so the hook blocks ONCE "
          "and can never trap the session in a loop",
          outcomes[("bad", True)] == 0, str(outcomes))


if __name__ == "__main__":
    for fn in (test_the_predicate, test_the_builder_itself_passes,
               test_the_escapes_and_the_floor, test_the_transcript_reader,
               test_the_mutation, test_the_hook_is_wired):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {'; '.join(FAILURES)}")
        sys.exit(1)
    print("the section apparatus cannot leave this session flattened")

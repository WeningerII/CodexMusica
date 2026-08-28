#!/usr/bin/env python3
"""measure_verb_memory.py — peak RSS of the connector's own harness calls (M-157).

WHY THIS IS A COMMITTED SCRIPT AND NOT A SHELL ONE-LINER: standing rule 3
(NO PRIVATE INSTRUMENTS). The 2026-08-28 sitting that found the deployed
service OOM-killing on every battery round measured the peaks with a scratch
wait4 wrapper used four times in one afternoon — which is that rule's exact
defect. This file is that wrapper, given a name, an argv, and a caller.

WHAT IT MEASURES: the maximum resident set size (ru_maxrss of the reaped
child, so the number includes everything the verb's process tree kept
resident) of the EXACT argv the connector runs for its two heavy tools —
`lyric_grade`'s `song` step (mandate coordinates read off the plan artifact,
the draft graded against the FILLED blueprint, byte-for-byte the argv
mcp/lyric_tools.js builds) and `lyric_revise`'s first call (`finish` with a
fresh `--propose=defer:` state). The draft is DETERMINISTIC FILLER sized to
the seed's own declared line count: the peak is dominated by the
lexicon-wide candidate machinery, not the words (measured 826MB at the
envelope's 22-line floor against 882MB at 50 lines — flat), so filler is the
honest cheap probe and the number is reproducible from the seed alone.

WHAT IT DOES NOT DO: it gates nothing (scripts/check_deploy_memory.js is
the gate and carries the banked figures), and it scores nothing — exit 3
and exit 4 from the verbs are ANSWERS here, not failures. Exit 0 means
every requested measurement ran; exit 2 means the plan itself refused.

Usage:
  python3 scripts/measure_verb_memory.py --seed=N [--verb=grade|revise|both]
"""

import json
import os
import re
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HARNESS = os.path.join(ROOT, "lyric-harness")

# Deterministic filler: ten openings crossed with sixty distinct CMUdict-
# readable end words, so any envelope-legal length (22-55 lines) gets a draft
# with no repeated end word and the graders do their full work.
_STARTS = [
    "The morning light fell over the", "I carried every question to the",
    "We waited out the weather by the", "She wrote her answer slowly on the",
    "A cold wind took the paper from the", "The city hummed its warning through the",
    "My brother kept his silence in the", "The garden gave its colors to the",
    "I traded all my silver for the", "The last bus rattled homeward past the",
]
_ENDS = [
    "river", "garden", "station", "window", "harbor", "mountain", "ladder",
    "ocean", "letter", "candle", "shoulder", "winter", "corner", "doorway",
    "meadow", "engine", "anchor", "feather", "lantern", "thunder", "valley",
    "mirror", "curtain", "gravel", "timber", "saddle", "copper", "marble",
    "cellar", "border", "willow", "ember", "hollow", "ribbon", "shadow",
    "summer", "supper", "hammer", "clover", "arrow", "sorrow", "yellow",
    "pillow", "canyon", "chapel", "wagon", "pepper", "cotton", "velvet",
    "salmon", "table", "basket", "bucket", "jacket", "magnet", "petal",
    "signal", "tunnel", "carpet", "planet",
]


def _run_measured(argv, out_path):
    """One child on `argv` under lyric-harness -> (exit, wall_s, peak_mb)."""
    t0 = time.time()
    with open(out_path, "w") as out:
        proc = subprocess.Popen(argv, cwd=HARNESS, stdout=out, stderr=subprocess.STDOUT)
    _, status, ru = os.wait4(proc.pid, 0)
    return os.waitstatus_to_exitcode(status), time.time() - t0, ru.ru_maxrss / 1024.0


def _run_plain(argv):
    r = subprocess.run(argv, cwd=HARNESS, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def main(argv):
    seed, verb = None, "both"
    for a in argv:
        m = re.fullmatch(r"--seed=(\d+)", a)
        if m:
            seed = int(m.group(1))
        m = re.fullmatch(r"--verb=(grade|revise|both)", a)
        if m:
            verb = m.group(1)
    if seed is None:
        print("REFUSED — --seed=N is required: a measurement with no declared seed is not reproducible")
        return 2

    with tempfile.TemporaryDirectory() as td:
        plan_path = os.path.join(td, "plan.json")
        bp_path = os.path.join(td, "bp.json")
        draft_path = os.path.join(td, "draft.txt")

        code, out = _run_plain(["python3", "lyric_harness.py", "plan", f"--seed={seed}", f"--out={plan_path}"])
        if code != 0:
            print(f"REFUSED — plan --seed={seed} exited {code}:\n{out[-500:]}")
            return 2
        m = re.search(r"Write a song: (\d+) lines", out)
        if not m:
            print("REFUSED — the plan report did not declare its line count")
            return 2
        n_lines = int(m.group(1))
        lines = [f"{_STARTS[i % len(_STARTS)]} {_ENDS[i % len(_ENDS)]}" for i in range(n_lines)]
        with open(draft_path, "w") as f:
            f.write("\n".join(lines) + "\n")
        print(f"seed={seed} lines={n_lines} (deterministic filler draft)")

        if verb in ("grade", "both"):
            # The connector's lyric_grade: fill the blueprint, then grade the
            # draft against it with the mandate read off the PLAN artifact —
            # the same three coordinates mcp/lyric_tools.js picks up.
            code, out = _run_plain(
                ["python3", "lyric_harness.py", "plan", f"--seed={seed}", f"--fill={draft_path}", f"--out={bp_path}"]
            )
            if code != 0:
                print(f"REFUSED — plan --fill exited {code}:\n{out[-500:]}")
                return 2
            plan = json.load(open(plan_path))
            args = ["python3", "lyric_harness.py", "song", bp_path, draft_path]
            if plan.get("groups"):
                args.append(f"--groups={plan['groups']}")
            if plan.get("returns"):
                args.append(f"--returns={plan['returns']}")
            if plan.get("relation"):
                args.append(f"--relation={plan['relation']}")
            rel = plan.get("relations") or {}
            if rel:
                args.append("--relations=" + ",".join(f"{k}:{rel[k]}" for k in sorted(rel)))
            args += ["--subdivision", str(plan["subdivision"])]
            code, wall, peak = _run_measured(args, os.path.join(td, "grade.out"))
            print(f"verb=grade  seed={seed} lines={n_lines} exit={code} wall={wall:.1f}s peak_mb={peak:.0f}")

        if verb in ("revise", "both"):
            state_path = os.path.join(td, "state.json")
            args = [
                "python3", "lyric_harness.py", "finish", draft_path,
                f"--seed={seed}", f"--propose=defer:{state_path}",
            ]
            code, wall, peak = _run_measured(args, os.path.join(td, "revise.out"))
            print(f"verb=revise seed={seed} lines={n_lines} exit={code} wall={wall:.1f}s peak_mb={peak:.0f}")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

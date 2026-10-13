#!/usr/bin/env python3
"""Capture pre-batch deferred-run states (`reader_v1_defer_states.json`).

Run ONCE, with the PRE-BATCH harness (commit fce4bf0f, before the reader
batch existed) exported beside its staged data:

    git archive fce4bf0f lyric-harness | tar -x -C SCRATCH
    cp cmudict.dict SCRATCH/lyric-harness/        # plus the staged data/
    python3 quality/fixtures/capture_reader_v1_defer_states.py \\
        SCRATCH/lyric-harness OUT

It records the deferred-run states that hold NO answer, NO pending question
and NO completion marker, as the pre-batch harness wrote them:

  * `stopped`: the safe-point stop (exit 5) the verb writes to the state file
    whenever the call has a deadline (`LYRIC_REQUEST_DEADLINE_MS`, here one
    that has already passed, so the loop stops before its first step);
  * `started` and `grading`: the mid-run saves the verb prints as
    `lyric checkpoint:` (the second carries a saved position, `cursor`),
    with the transport token taken off, as a caller holds them;

and `suspended+answer`, the state the verb wrote when the loop suspended on a
question, with that question answered (an ordinary continuation);

and, for each, what the pre-batch harness printed and wrote when it resumed
that state with no answer (`resume_*`), and when it resumed it without its
saved position (`replay_*`). `quality/test_reader.py` resumes the same states
with this build and no `--reader-scheme`: each must resume as `v1` and
reproduce `replay_*` once `reader_scheme` and the cursor fields are set
aside. It is `replay_*` and not `resume_*` because of the scorer-identity
rule that predates the batch (`_scorer_identity`): a position is trusted only
under the scorer that took it, and any source change moves that digest, so a
post-batch build replays a state carrying a cursor from round 1 where the
pre-batch harness resumed from the cursor; against `resume_*` those states
differ (stdout, the written cursor and, on a resumed run, the checkpoint
lines and memo counts), and the test asserts that too. The draft ends on a numeral, so a resume read
under `v2` (which refuses the numeral) is visible in the output. Re-running
this with a post-batch harness measures nothing: the file is the pre-batch
record, kept verbatim.
"""
import json
import os
import subprocess
import sys
import tempfile

DRAFT = ["My kettle whistles by the qzzxv", "Your fingers brush my heavy coat 4"]
VERB = ["revise", "<WORK>/draft.txt", "--groups=1,2", "--relation=class:ASSONANCE",
        "--max-rounds=1", "--attempts=1", "--backtrack=0", "--propose=defer:<WORK>/state.json"]
WORK = "<WORK>"
ANSWER = "My kettle whistles by the stove"


def _run(harness, work, deadline=None):
    env = {k: v for k, v in os.environ.items()
           if k not in ("LYRIC_CONTROL_TOKEN", "LYRIC_REQUEST_DEADLINE_MS",
                        "LYRIC_CHECKPOINT_PATH")}
    if deadline is not None:
        env["LYRIC_REQUEST_DEADLINE_MS"] = deadline
    argv = [a.replace(WORK, work) for a in VERB]
    r = subprocess.run([sys.executable, os.path.join(harness, "lyric_harness.py"), *argv],
                       capture_output=True, text=True, env=env, cwd=harness, timeout=900)
    return r.returncode, r.stdout


def main(harness, out):
    harness = os.path.abspath(harness)
    work = tempfile.mkdtemp()
    state = os.path.join(work, "state.json")
    with open(os.path.join(work, "draft.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(DRAFT) + "\n")
    states = {}
    code, _ = _run(harness, work, deadline="1")
    assert code == 5, code
    with open(state, encoding="utf-8") as fh:
        states["stopped"] = fh.read()
    os.unlink(state)
    code, stdout = _run(harness, work)
    assert code == 4, code
    # The suspended state, its pending question answered by the writer.
    with open(state, encoding="utf-8") as fh:
        answered = json.load(fh)
    answered["pending"]["answer"] = ANSWER
    states["suspended+answer"] = json.dumps(answered, indent=2) + "\n"
    for line in stdout.splitlines():
        if line.startswith("  lyric checkpoint: "):
            st = json.loads(line[len("  lyric checkpoint: "):])
            st.pop("transport_token", None)
            name = st["status"] + ("+cursor" if "cursor" in st else "")
            states.setdefault(name, json.dumps(st, indent=2) + "\n")
    os.unlink(state)
    assert {"stopped", "started", "grading+cursor"} <= set(states), sorted(states)
    records = []
    for name in ("stopped", "started", "grading+cursor", "suspended+answer"):
        for k in ("pending", "complete", "reader_scheme"):
            assert k == "pending" and name == "suspended+answer" \
                or not json.loads(states[name]).get(k), (name, k)
        rec = {"name": name, "state": states[name]}
        # A saved position is trusted only under the scorer that took it, so
        # a post-batch resume replays from round 1: record the pre-batch
        # resume of the same state without its position too.
        bare = json.loads(states[name])
        bare.pop("cursor", None)
        for key, text in (("resume", states[name]),
                          ("replay", json.dumps(bare, indent=2) + "\n")):
            with open(state, "w", encoding="utf-8") as fh:
                fh.write(text)
            code, stdout = _run(harness, work)
            with open(state, encoding="utf-8") as fh:
                resumed = fh.read()
            os.unlink(state)
            rec.update({key + "_exit": code, key + "_stdout": stdout.replace(work, WORK),
                        key + "_written": resumed})
        records.append(rec)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump({"captured_at": "fce4bf0f (pre-batch origin/main)", "draft": DRAFT,
                   "verb": VERB, "states": records}, fh, ensure_ascii=False, indent=1)
        fh.write("\n")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

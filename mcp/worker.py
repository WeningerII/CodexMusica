#!/usr/bin/env python3
"""worker.py — the connector's WARM harness process (`MISSING.md` M-155).

WHAT THIS IS, and what it is not. The connector has always run the harness
subprocess-per-call ("stateless because a plan is a pure function of its
seed" — CLAUDE.md's wrap paragraph), and the statelessness survives here
UNCHANGED at the request boundary: every request is a full `main()` call on
its own argv, and an identical argv answers with identical bytes whether it
is request 1 or request 1,000. What a persistent process adds is exactly
one thing — the interpreter and the module-level memos live between
requests, so `lyric_revise`'s replay (which re-briefs the SAME draft on
every call of a revision conversation) stops re-paying work the process
already did. The soundness argument is the loop's own: `revise_loop` is
deterministic (verified by inspection and across three separate processes —
quality/loop.py's record), and the one cross-request memo
(`relations._WVP_MEMO`) is keyed on declared coordinates and returns
answers only to IDENTICAL calls.

THE PROTOCOL is one JSON object per line, both directions, stdout used for
NOTHING else — the harness's own stdout is captured per request and
returned inside the reply, because a verb that printed straight through
would interleave with the protocol.

  request:  {"id": <any>, "argv": ["song", "BP", "DRAFT", ...]}
  reply:    {"id": <same>, "code": <int>, "stdout": "...", "stderr": "..."}

LIFECYCLE IS THE PARENT'S. This process serves requests serially and
forever; the connector kills it on a per-request timeout or a bad reply
and falls back to the cold subprocess for that request, so a wedged worker
costs one slow answer and never a wrong one. Nothing here traps signals.

A CRASH IS A REPLY, NOT AN EXIT: an exception escaping `main()` (which the
cold path would surface as Python's own exit 1 and a traceback on stderr)
is returned as code 1 with the traceback in stderr — the same shape the
cold path gives — and the worker keeps serving.
"""

import io
import json
import os
import sys

HARNESS = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)),
                 "..", "lyric-harness"))
os.chdir(HARNESS)
sys.path.insert(0, HARNESS)

import lyric_harness  # noqa: E402


def run_one(argv):
    """One full `main()` on `argv` -> (exit_code, stdout, stderr).

    stdout/stderr are swapped for the duration and ALWAYS restored — the
    protocol writes to the real stdout and a leaked swap would deadlock the
    parent. `SystemExit` is the harness's ordinary voice (every refusal is
    a printed message and an exit code), so it is read, never re-raised.

    `cli()`, NOT `main()` — the byte-equality battery's first full run
    caught the difference: the script wraps `main()` in refusal handlers
    (a missing file is `REFUSED` exit 2, a missing positional exit 2 with
    the count), and calling `main()` bare answered the same command exit 1
    with a traceback. One dispatch, two entrances (M-155).
    """
    out, err = io.StringIO(), io.StringIO()
    old_argv, old_out, old_err = sys.argv, sys.stdout, sys.stderr
    sys.argv = ["lyric_harness.py"] + list(argv)
    sys.stdout, sys.stderr = out, err
    code = 0
    try:
        rc = lyric_harness.cli()
        code = int(rc) if isinstance(rc, int) else 0
    except SystemExit as e:
        code = e.code if isinstance(e.code, int) else (0 if e.code is None
                                                       else 1)
    except BaseException:
        import traceback
        traceback.print_exc(file=err)
        code = 1
    finally:
        sys.argv, sys.stdout, sys.stderr = old_argv, old_out, old_err
    return code, out.getvalue(), err.getvalue()


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            argv = req.get("argv") or []
            if not isinstance(argv, list) \
                    or not all(isinstance(a, str) for a in argv):
                raise ValueError("argv must be a list of strings")
        except ValueError as e:
            print(json.dumps({"id": None, "code": -1, "stdout": "",
                              "stderr": f"worker: unreadable request: {e}"}),
                  flush=True)
            continue
        code, so, se = run_one(argv)
        print(json.dumps({"id": req.get("id"), "code": code,
                          "stdout": so, "stderr": se}),
              flush=True)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Persistent, serial harness worker with streamed output frames.

Each request still calls the real CLI with fresh argv. Lexical and grading
memos survive between requests, while request-only deadline, checkpoint and
budget-capability environment values are restored after each call.

Protocol (one UTF-8 JSON object per line):
  request: {"id": n, "argv": [...], "env": {...}}
  output:  {"id": n, "event": "output", "stream": "stdout", "data": "..."}
  result:  {"id": n, "code": 0, "stdout": "", "stderr": ""}

Every output frame is flushed to the OS pipe immediately. The parent can
retain an accepted checkpoint and known usage even if it kills this process.
The parent applies its output cap to decoded UTF-8 text, exactly as it does
for the cold CLI. Kernel control records carry a per-request nonce; ordinary
lyric text cannot impersonate a checkpoint or usage event.

Process death is not permission to repeat nondeterministic model calls. The
parent permits cold fallback only for deterministic verbs, under the original
admission deadline. Uncaught CLI exceptions remain code 1 plus traceback,
matching the cold entrance.
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


class ProtocolStream(io.TextIOBase):
    """Forward decoded output in bounded frames, flushing the OS pipe each time."""
    def __init__(self, target, request_id, stream):
        self.target, self.request_id, self.stream = target, request_id, stream

    def write(self, text):
        for offset in range(0, len(text), 16384):
            self.target.write(json.dumps({"id": self.request_id,
                "event": "output", "stream": self.stream,
                "data": text[offset:offset + 16384]}, ensure_ascii=False) + "\n")
        self.target.flush()
        return len(text)

    def flush(self):
        self.target.flush()


REQUEST_ENV = ("LYRIC_CONTROL_TOKEN", "LYRIC_REQUEST_DEADLINE_MS", "LYRIC_CHECKPOINT_PATH",
               "LYRIC_PROPOSER_BUDGET_USD", "LYRIC_BUDGET_URL", "LYRIC_BUDGET_TOKEN")


def run_one(argv, request_id=None, request_env=None):
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
    out, err = (io.StringIO(), io.StringIO()) if request_id is None else (
        ProtocolStream(sys.stdout, request_id, "stdout"),
        ProtocolStream(sys.stdout, request_id, "stderr"))
    old_env = {key: os.environ.get(key) for key in REQUEST_ENV}
    for key in REQUEST_ENV:
        value = (request_env or {}).get(key)
        if value is None:
            os.environ.pop(key, None)
        elif isinstance(value, str):
            os.environ[key] = value
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
        for key, value in old_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
    return code, (out.getvalue() if request_id is None else ""), (err.getvalue() if request_id is None else "")


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
        code, so, se = run_one(argv, req.get("id"), req.get("env"))
        print(json.dumps({"id": req.get("id"), "code": code,
                          "stdout": so, "stderr": se}, ensure_ascii=False),
              flush=True)


if __name__ == "__main__":
    main()

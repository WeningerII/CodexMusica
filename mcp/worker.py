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

import hashlib
import io
import json
import os
import sys
import time
import zlib

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


READER_OBJECT_BYTES = 2 * 1024 * 1024  # READER_LIMITS.objectBytes in reader_job_store.js


def read_page_object(page_path):
    """Read one content-addressed evidence page, plain or gzip (phase A).

    The store may hold either encoding; the bytes the filename stem hashes are
    always the uncompressed JSON, inflation is bounded by the object limit, and
    anything else is refused rather than parsed.
    """
    with open(page_path, "rb") as source_file:
        raw = source_file.read(READER_OBJECT_BYTES + 1)
    if raw[:2] == b"\x1f\x8b":
        inflater = zlib.decompressobj(16 + zlib.MAX_WBITS)
        try:
            body = inflater.decompress(raw, READER_OBJECT_BYTES + 1)
        except zlib.error as error:
            raise ValueError("reader page object is corrupt") from error
        # Exactly one member and no trailing bytes, as the Node reader requires.
        if (len(body) > READER_OBJECT_BYTES or inflater.unconsumed_tail
                or not inflater.eof or inflater.unused_data):
            raise ValueError("reader page object exceeds its bound, is truncated or has trailing data")
    elif len(raw) > READER_OBJECT_BYTES:
        raise ValueError("reader page object exceeds its bound")
    else:
        body = raw
    stem = os.path.splitext(os.path.basename(page_path))[0]
    if hashlib.sha256(body).hexdigest() != stem:
        raise ValueError("reader page object does not match its address")
    return json.loads(body.decode("utf-8"))


def run_reader(payload, request_id):
    """Typed deterministic leases; acknowledge durable state before continuing.

    This family cannot supply argv, import a proposer, or select a Python module.
    Catalog resolution and page paths originate in the authenticated Node adapter.
    """
    from library.analysis import AnalysisSession
    if not isinstance(payload, dict) or not isinstance(payload.get("source"), dict):
        raise ValueError("reader requires a registered source object")
    requested = payload.get("requested", ["sound", "form", "rhythm", "language"])
    if not isinstance(requested, list) or any(
            layer not in ("sound", "form", "rhythm", "language") for layer in requested):
        raise ValueError("reader requested layer is not supported")
    paths = list(payload.get("committed_pages") or [])
    if not all(isinstance(item, str) and os.path.isabs(item) for item in paths):
        raise ValueError("reader committed page paths must be registered absolute paths")

    def load_records(schema_id):
        for page_path in paths:
            page = read_page_object(page_path)
            for row in page.get("instances", []):
                engine = row.get("engine_payload") or {}
                if schema_id in (row.get("schema_id"), row.get("method_id"),
                                 row.get("schema_name"), engine.get("schema_id"),
                                 engine.get("schema_name")):
                    yield row

    lease_ms = min(600000, max(1, int(payload.get("lease_ms", 600000))))
    deadline = time.monotonic() + lease_ms / 1000
    session = AnalysisSession(payload["source"], payload.get("declarations"), requested,
                              payload.get("checkpoint"), load_records=load_records,
                              identity=payload.get("identity"),
                              requested_methods=payload.get("requested_methods"))
    while True:
        step = session.step(budget_candidates=256, deadline=min(deadline, time.monotonic() + 1),
                            max_bytes=1048576)
        if step.get("provider_calls") != 0:
            raise ValueError("reader provider isolation failed")
        frame = json.dumps({"id": request_id, "event": "reader_checkpoint", "data": step},
                           ensure_ascii=False, separators=(",", ":"))
        if len(frame.encode("utf-8")) > 2 * 1024 * 1024:
            raise ValueError("reader checkpoint frame exceeds byte limit")
        print(frame, flush=True)
        ack_line = sys.stdin.readline()
        if not ack_line:
            raise ValueError("reader durable acknowledgement was interrupted")
        ack = json.loads(ack_line)
        if ack.get("id") != request_id or ack.get("event") != "reader_ack":
            raise ValueError("reader durable acknowledgement is invalid")
        added = ack.get("added_page_paths") or []
        if not all(isinstance(item, str) and os.path.isabs(item) for item in added):
            raise ValueError("reader acknowledged page paths are invalid")
        paths.extend(added)
        if step.get("done") and ack.get("reason") in (None, "COMPLETE", "YIELD", "LEASE_EXHAUSTED"):
            return {"status": "complete", "reason": "COMPLETE", "provider_calls": 0}
        if not ack.get("continue") or time.monotonic() >= deadline:
            reason = ack.get("reason") or "LEASE_EXHAUSTED"
            return {"status": "yielded" if reason in ("YIELD", "LEASE_EXHAUSTED") else "paused",
                    "reason": reason, "provider_calls": 0}


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
            family = req.get("family", "lyrics")
            if family not in ("lyrics", "reader"):
                raise ValueError("worker family is not supported")
            argv = req.get("argv") or []
            if not isinstance(argv, list) \
                    or not all(isinstance(a, str) for a in argv):
                raise ValueError("argv must be a list of strings")
        except ValueError as e:
            print(json.dumps({"id": None, "code": -1, "stdout": "",
                              "stderr": f"worker: unreadable request: {e}"}),
                  flush=True)
            continue
        if family == "reader":
            try:
                result = run_reader(req.get("reader"), req.get("id"))
                print(json.dumps({"id": req.get("id"), "code": 0, "stdout": "", "stderr": "",
                                  "reader_result": result}), flush=True)
            except Exception as exc:
                # No traceback/source prose leaks through the reader protocol.
                reason = str(exc).split(":", 1)[0]
                if reason not in ("INVALID_DECLARATION", "UNSUPPORTED_METHOD", "STALE_READING",
                                  "RESOURCE_LIMIT", "RESULT_EXPIRED", "SNAPSHOT_CHANGED"):
                    reason = "READER_ERROR"
                print(json.dumps({"id": req.get("id"), "code": 1, "stdout": "",
                                  "stderr": "reader: " + str(exc),
                                  "error_code": reason,
                                  "reader_result": {"status": "paused", "reason": reason,
                                                    "provider_calls": 0}}), flush=True)
            continue
        code, so, se = run_one(argv, req.get("id"), req.get("env"))
        print(json.dumps({"id": req.get("id"), "code": code,
                          "stdout": so, "stderr": se}, ensure_ascii=False),
              flush=True)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""The kitchen proposer against a stub Gemini (M-254): one reply shape, one
429 with a hint, transport exhausted, no key, and the record line. No
network, no credential — the stub is a local HTTP server.

    python3 mcp/test_gemini_proposer.py       exit 0 all pass, 1 otherwise
"""
import io
import json
import os
import re
import sys
import threading
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "lyric-harness"))
import gemini_proposer as GP  # noqa: E402

FAILURES = []


def check(msg, ok, detail=""):
    print(f"  {'PASS' if ok else 'FAIL'}  {msg}" + (f"\n          {detail}" if detail and not ok else ""))
    if not ok:
        FAILURES.append(msg)


class Script:
    """Replies in order; each entry is (status, headers, body)."""

    def __init__(self, replies):
        self.replies = list(replies)
        self.seen = []


def serve(script):
    class H(BaseHTTPRequestHandler):
        def do_POST(self):
            n = int(self.headers.get("content-length", 0))
            body = json.loads(self.rfile.read(n) or b"{}")
            body["_path"] = self.path
            script.seen.append(body)
            status, headers, body = script.replies.pop(0) if script.replies else (500, {}, {})
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(data)))
            for k, v in headers.items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *a):
            pass

    srv = HTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def ok_body(text, t_in=100, t_out=8, finish="STOP"):
    return {"candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": finish}],
            "usageMetadata": {"promptTokenCount": t_in, "candidatesTokenCount": t_out}}


def env(**kw):
    for k in ("GEMINI_API_KEY", "LYRIC_PROPOSER_MODEL", "GEMINI_MODEL",
              "LYRIC_PROPOSER_API_BASE"):
        os.environ.pop(k, None)
    os.environ.update({k: v for k, v in kw.items() if v is not None})


def main():
    GP.time.sleep = lambda s: None          # the waits are the policy's; not paid here
    print("1. the reply shape, the record line, the totals")
    sc = Script([(200, {}, ok_body("the lantern swung", 300, 7)),
                 (200, {}, ok_body("", 310, 0, "MAX_TOKENS"))])
    srv = serve(sc)
    env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="stub-model",
        LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}")
    call = GP.make()
    buf = io.StringIO()
    with redirect_stdout(buf):
        got = call("BRIEF ONE")
        got2 = call("BRIEF TWO")
    check("the factory returns callable(prompt) -> str and the text comes back verbatim",
          got == "the lantern swung" and got2 == "", repr((got, got2)))
    body = dict(sc.seen[0])
    body.pop("_path", None)
    check("the request carries the fixed system instruction, the prompt as the one user part, "
          "and the declared generation config",
          body["systemInstruction"]["parts"][0]["text"] == GP.SYSTEM_INSTRUCTION
          and body["contents"] == [{"role": "user", "parts": [{"text": "BRIEF ONE"}]}]
          and body["generationConfig"]["temperature"] == 0.8
          and body["generationConfig"]["maxOutputTokens"] == 256, json.dumps(body)[:200])
    lines = [l for l in buf.getvalue().splitlines() if "PROPOSER CALL" in l]
    pat = re.compile(r"PROPOSER CALL (\d+): (\S+) (\d+) ms in=(\d+) out=(\d+)(?: finish=(\S+))? \| kitchen model=(\S+) calls=(\d+) ms=(\d+) in=(\d+) out=(\d+) empty=(\d+) retries=(\d+)")
    m1, m2 = pat.search(lines[0]), pat.search(lines[1])
    check("one record line per call, in the shape lyric_tools.js reads, totals on every line",
          len(lines) == 2 and m1 and m2 and m1.group(2) == "ok" and m2.group(2) == "empty"
          and m2.group(6) == "MAX_TOKENS" and m2.group(7) == "stub-model"
          and m2.group(8) == "2" and m2.group(10) == "610" and m2.group(11) == "7"
          and m2.group(12) == "1", "\n".join(lines))
    srv.shutdown()

    print("\n2. a 429 with the server's hint is waited out ONCE within the budget; past it, refused")
    sc = Script([(429, {"Retry-After": "2"}, {"error": {"message": "slow down"}}),
                 (200, {}, ok_body("after the wait"))])
    srv = serve(sc)
    env(GEMINI_API_KEY="k", GEMINI_MODEL="from-gemini-model",
        LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}")
    call = GP.make()
    with redirect_stdout(io.StringIO()):
        got = call("x")
    check("the hinted 429 is retried and the answer arrives; the retry is counted; "
          "GEMINI_MODEL is the fallback model name",
          got == "after the wait" and call.retries == 1 and len(sc.seen) == 2
          and "/models/from-gemini-model:generateContent" in sc.seen[0]["_path"], repr(got))
    srv.shutdown()
    sc = Script([(429, {"Retry-After": "60"}, {"error": {"message": "slow down"}})])
    srv = serve(sc)
    env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="m",
        LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}")
    call = GP.make()
    try:
        with redirect_stdout(io.StringIO()):
            call("x")
        raised = None
    except GP.ProposerUnavailable as e:
        raised = str(e)
    check("a hint past the eight-second budget is refused at once as ProposerUnavailable, naming 429",
          raised is not None and "429" in raised and len(sc.seen) == 1, raised)
    srv.shutdown()

    print("\n3. transport exhausted, and no key at all")
    sc = Script([(503, {}, {"error": {"message": "high demand"}})] * 4)
    srv = serve(sc)
    env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="m",
        LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}")
    call = GP.make()
    try:
        with redirect_stdout(io.StringIO()):
            call("x")
        raised = None
    except GP.ProposerUnavailable as e:
        raised = str(e)
    check("four 503s (one call, three retries) end in ProposerUnavailable naming the status and the retries",
          raised is not None and "503" in raised and "3 transient" in raised and len(sc.seen) == 4, raised)
    srv.shutdown()
    env(LYRIC_PROPOSER_MODEL="m")
    call = GP.make()                        # the factory must NOT raise
    try:
        call("x")
        raised = None
    except GP.ProposerUnavailable as e:
        raised = str(e)
    check("no key: the factory returns quietly and the FIRST CALL raises, naming GEMINI_API_KEY",
          raised is not None and "GEMINI_API_KEY" in raised, raised)
    check("...and the class IS the harness's own (quality/propose.ProposerUnavailable), so the verb's clause catches it",
          GP.ProposerUnavailable.__module__ == "quality.propose", GP.ProposerUnavailable.__module__)

    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILING")
        return 1
    print("all kitchen-proposer checks pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())

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
from datetime import datetime, timezone
from email.utils import format_datetime
from unittest.mock import patch
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
              "LYRIC_PROPOSER_API_BASE", "LYRIC_PROPOSER_WAIT_BUDGET_S",
              "LYRIC_REQUEST_DEADLINE_MS", "LYRIC_BUDGET_URL", "LYRIC_BUDGET_TOKEN",
              "LYRIC_PROPOSER_MAX_TOKENS"):
        os.environ.pop(k, None)
    os.environ.update({k: v for k, v in kw.items() if v is not None})


def main():
    GP.time.sleep = lambda s: None          # the waits are the policy's; not paid here
    print("1. the reply shape, the record line, the totals")
    sc = Script([(200, {}, ok_body("the lantern swung", 300, 7)),
                 (200, {}, ok_body("", 310, 0, "STOP"))])
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
          and body["generationConfig"]["maxOutputTokens"] == GP.OUTPUT_TOKENS_PER_LINE, json.dumps(body)[:200])
    lines = [l for l in buf.getvalue().splitlines() if "PROPOSER CALL" in l]
    pat = re.compile(r"PROPOSER CALL (\d+): (\S+) (\d+) ms in=(\d+) out=(\d+)(?: finish=(\S+))? \| kitchen model=(\S+) calls=(\d+) ms=(\d+) in=(\d+) out=(\d+) empty=(\d+) retries=(\d+)")
    m1, m2 = pat.search(lines[0]), pat.search(lines[1])
    check("one record line per call, in the shape lyric_tools.js reads, totals on every line",
          len(lines) == 2 and m1 and m2 and m1.group(2) == "ok" and m2.group(2) == "empty"
          and m2.group(6) is None and m2.group(7) == "stub-model"
          and m2.group(8) == "2" and m2.group(10) == "610" and m2.group(11) == "7"
          and m2.group(12) == "1", "\n".join(lines))
    srv.shutdown()

    print("\n2. a 429 is waited out on the hint or a doubling backoff, inside the run's wait budget (M-255)")
    slept = []
    GP.time.sleep = lambda s: slept.append(s)
    sc = Script([(429, {"Retry-After": "20"}, {"error": {"message": "slow down"}}),
                 (429, {}, {"error": {"message": "slow down"}}),
                 (429, {}, {"error": {"message": "slow down"}}),
                 (200, {}, ok_body("after the waits"))])
    srv = serve(sc)
    env(GEMINI_API_KEY="k", GEMINI_MODEL="from-gemini-model",
        LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}",
        LYRIC_PROPOSER_WAIT_BUDGET_S="100")
    call = GP.make()
    buf = io.StringIO()
    with redirect_stdout(buf):
        got = call("x")
    check("a hinted 429 waits the HINT (20 s, past the old eight-second ceiling), "
          "hintless 429s back off along the ladder by retry count (4 s, 8 s), and "
          "the answer arrives",
          got == "after the waits" and slept == [20.0, 4.0, 8.0] and call.retries == 3
          and len(sc.seen) == 4, f"slept {slept} retries {call.retries}")
    check("...the wait is on the record line as a running total, and GEMINI_MODEL is "
          "the fallback model name",
          "wait=32" in buf.getvalue() and call.waited_s == 32.0
          and "/models/from-gemini-model:generateContent" in sc.seen[0]["_path"],
          buf.getvalue().strip()[-120:])
    srv.shutdown()
    slept.clear()
    sc = Script([(429, {"Retry-After": "30"}, {}), (200, {}, ok_body("one")),
                 (429, {"Retry-After": "30"}, {}), (200, {}, ok_body("two"))])
    srv = serve(sc)
    env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="m",
        LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}",
        LYRIC_PROPOSER_WAIT_BUDGET_S="45")
    call = GP.make()
    with redirect_stdout(io.StringIO()):
        first = call("a")
    try:
        with redirect_stdout(io.StringIO()):
            call("b")
        raised = None
    except GP.ProposerUnavailable as e:
        raised = str(e)
    check("the budget is PER RUN, cumulative: a 30 s hint fits a 45 s budget once, and the "
          "second is refused naming the budget, the spend and the next wait",
          first == "one" and raised is not None and "wait budget is spent" in raised
          and "30s waited of 45s" in raised and "would be 30s" in raised
          and slept == [30.0], raised)
    srv.shutdown()
    sc = Script([(429, {"Retry-After": "600"}, {"error": {"message": "quota"}})])
    srv = serve(sc)
    env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="m",
        LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}",
        LYRIC_PROPOSER_WAIT_BUDGET_S="1000")
    call = GP.make()
    try:
        with redirect_stdout(io.StringIO()):
            call("x")
        raised = None
    except GP.ProposerUnavailable as e:
        raised = str(e)
    check("a hint past the hint cap is refused AT ONCE even inside a large budget — "
          "a far-off quota reset is a stopping place (M-249), not a wait",
          raised is not None and "past the" in raised and "hint cap" in raised
          and "stopping place" in raised and len(sc.seen) == 1, raised)
    srv.shutdown()
    GP.time.sleep = lambda s: None

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

    print("\n4. terminal records, retry ceilings and complete usage survive")
    sc = Script([(429, {"Retry-After": "30"}, {}),
                 *[(503, {}, {})] * 4])
    srv = serve(sc)
    env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="m",
        LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}")
    call = GP.make()
    buf = io.StringIO()
    try:
        with redirect_stdout(buf):
            call("terminal")
    except GP.ProposerUnavailable:
        pass
    events = [json.loads(line.split("proposer event: ", 1)[1])
              for line in buf.getvalue().splitlines() if "proposer event:" in line]
    final = events[-1]
    check("terminal transport failure emits cumulative attempts, retries and waits",
          final["status"] == "failed" and final["attempts"] == 5
          and final["retries"] == 4 and final["wait_s"] == 30
          and not final["in_flight"], final)
    srv.shutdown()

    sc = Script([(429, {"Retry-After": "0"}, {})] * (GP.RATE_RETRIES + 2))
    srv = serve(sc)
    env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="m",
        LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}")
    call = GP.make()
    try:
        with redirect_stdout(io.StringIO()):
            call("zero hints")
        raised = None
    except GP.ProposerUnavailable as error:
        raised = str(error)
    check("zero-second hints hit the independent paced retry cap",
          raised is not None and "retry cap" in raised
          and len(sc.seen) == GP.RATE_RETRIES + 1
          and call.waited_s == GP.RATE_RETRIES * GP.MIN_RATE_WAIT_S, raised)
    srv.shutdown()
    check("invalid and non-finite retry hints use bounded backoff",
          all(GP._retry_after_s({"Retry-After": value}, {}) is None
              for value in ("NaN", "Infinity", "-2", "garbage")))

    reply = ok_body("known usage", 300, 7)
    reply["usageMetadata"].update(thoughtsTokenCount=900,
        cachedContentTokenCount=200, totalTokenCount=1207)
    sc = Script([(200, {}, reply)])
    srv = serve(sc)
    env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="m",
        LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}")
    call = GP.make()
    buf = io.StringIO()
    with redirect_stdout(buf):
        call("thinking")
    final = [json.loads(line.split("proposer event: ", 1)[1])
             for line in buf.getvalue().splitlines() if "proposer event:" in line][-1]
    check("thinking, cache and provider total tokens reach the terminal record",
          final["tokens_in"] == 300 and final["tokens_out"] == 7
          and final["tokens_thoughts"] == 900 and final["tokens_cached"] == 200
          and final["tokens_total"] == 1207 and not final["usage_unknown"], final)
    srv.shutdown()

    sc = Script([(200, {}, {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "no usage"}]}}]})])
    srv = serve(sc)
    env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="m",
        LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}")
    call = GP.make()
    with redirect_stdout(io.StringIO()):
        call("unknown")
    check("a successful response without provider usage is explicitly unknown",
          call.unknown_attempts == 1 and call.calls == 1)
    srv.shutdown()

    env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="m",
        LYRIC_REQUEST_DEADLINE_MS="1")
    call = GP.make()
    try:
        with redirect_stdout(io.StringIO()):
            call("expired")
        raised = None
    except GP.ProposerUnavailable as error:
        raised = str(error)
    check("expired request refuses before starting a paid HTTP attempt",
          raised is not None and "deadline" in raised and call.attempts == 0, raised)

    print("\n5. malformed provider protocol and truncated proposals refuse before lyric parsing")
    malformed = [None, [], ["wrong root"], {"candidates": {}}, {"candidates": [None]},
                 {"candidates": [{"finishReason": "STOP", "content": {"parts": {}}}]},
                 ok_body(123), ok_body("x", "oops"), ok_body("x", -1),
                 ok_body("x", True), ok_body("x", 1.5),
                 {**ok_body("x"), "usageMetadata": []}]
    for index, payload in enumerate(malformed):
        sc = Script([(200, {}, payload)])
        srv = serve(sc)
        env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="m",
            LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}")
        call = GP.make()
        try:
            with redirect_stdout(io.StringIO()):
                call("invalid protocol")
            failure = None
        except GP.ProposerUnavailable as error:
            failure = error
        check(f"malformed provider case {index} is a typed refusal after exactly one dispatch",
              failure is not None and getattr(failure, "code", "").startswith("PROVIDER_")
              and len(sc.seen) == 1 and not call.in_flight)
        srv.shutdown()

    for finish in ("MAX_TOKENS", "SAFETY", "RECITATION"):
        sc = Script([(200, {}, ok_body("Hold my hand", finish=finish))])
        srv = serve(sc)
        env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="m",
            LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}")
        call = GP.make()
        buf = io.StringIO()
        # The real ModelProposer parser would accept these complete-looking
        # words, but the provider's completion policy must run before it.
        from quality.propose import ModelProposer
        check("the truncated text is superficially a valid line", ModelProposer(lambda prompt: prompt).parse("Hold my hand") is not None)
        try:
            with redirect_stdout(buf):
                ModelProposer(lambda prompt: prompt).parse(call("one line"))
            failure = None
        except GP.ProposerUnavailable as error:
            failure = error
        final = [json.loads(line.split("proposer event: ", 1)[1])
                 for line in buf.getvalue().splitlines() if "proposer event:" in line][-1]
        check(f"{finish} is refused before parsing with its exact structured reason and known usage",
              failure is not None and final["finish_reason"] == finish
              and final["failure_code"] == ("PROVIDER_TRUNCATED" if finish == "MAX_TOKENS" else "PROVIDER_REFUSAL")
              and final["tokens_in"] == 100 and not final["usage_unknown"])
        srv.shutdown()

    print("\n6. both Retry-After representations obey the same policy")
    now = 1800000000
    with patch.object(GP.time, "time", return_value=now):
        for delay in (110, 130, -10):
            date = format_datetime(datetime.fromtimestamp(now + delay, timezone.utc), usegmt=True)
            check(f"HTTP-date {delay}s is normalized with a controlled clock",
                  GP._retry_after_s({"rEtRy-AfTeR": date}, {}) == max(0, delay))
        for delay in (110, 130):
            slept = []
            GP.time.sleep = lambda seconds: slept.append(seconds)
            date = format_datetime(datetime.fromtimestamp(now + delay, timezone.utc), usegmt=True)
            sc = Script([(429, {"Retry-After": date}, {}), (200, {}, ok_body("arrived"))])
            srv = serve(sc)
            env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="m",
                LYRIC_PROPOSER_WAIT_BUDGET_S="240",
                LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}")
            try:
                with redirect_stdout(io.StringIO()):
                    GP.make()("date policy")
                refused = False
            except GP.ProposerUnavailable:
                refused = True
            check(f"HTTP-date {delay}s honors wait and hint cap before another dispatch",
                  (delay == 110 and not refused and slept == [110] and len(sc.seen) == 2)
                  or (delay == 130 and refused and not slept and len(sc.seen) == 1))
            srv.shutdown()

    print("\n7. provider capacity is declared before spending and bounded before journaling")
    for width in (1, 31):
        sc = Script([(200, {}, ok_body("L1: a line")),
                     (200, {}, ok_body("x" * (width * GP.MAX_PROPOSAL_BYTES_PER_LINE + 1)))])
        srv = serve(sc)
        env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="m",
            LYRIC_PROPOSER_API_BASE=f"http://127.0.0.1:{srv.server_port}")
        writer = GP.make()
        settlements = []
        writer._budget = lambda action, **fields: settlements.append((action, fields)) or {}
        with redirect_stdout(io.StringIO()):
            writer.with_capacity("declared width", max_lines=width)
            try:
                writer.with_capacity("oversized text", max_lines=width)
                failure = None
            except GP.ProposerUnavailable as error:
                failure = error
        check(f"{width}-line capacity is reserved and oversized known response never replayed",
              len(sc.seen) == 2 and sc.seen[0]["generationConfig"]["maxOutputTokens"] == width * GP.OUTPUT_TOKENS_PER_LINE
              and settlements[0][1]["maxOutputTokens"] == width * GP.OUTPUT_TOKENS_PER_LINE
              and settlements[-1][0] == "settle" and settlements[-1][1]["status"] == "success"
              and getattr(failure, "code", None) == "PROVIDER_PROPOSAL_TOO_LARGE" and not writer.unknown_attempts)
        srv.shutdown()
    env(GEMINI_API_KEY="k", LYRIC_PROPOSER_MODEL="m", LYRIC_PROPOSER_MAX_TOKENS="256")
    writer = GP.make()
    with patch.object(GP.urllib.request, "urlopen", side_effect=AssertionError("must refuse before network")):
        with redirect_stdout(io.StringIO()):
            try:
                writer.with_capacity("31-line request", max_lines=31)
                failure = None
            except GP.ProposerUnavailable as error:
                failure = error
    check("configured insufficient group output allowance refuses before any reservation",
          getattr(failure, "code", None) == "PROPOSER_CONFIG" and writer.attempts == 0)

    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILING")
        return 1
    print("all kitchen-proposer checks pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())

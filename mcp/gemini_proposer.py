#!/usr/bin/env python3
"""gemini_proposer.py — THE KITCHEN (owner ruling 2026-09-06, `MISSING.md`
M-254): a `--propose=call:gemini_proposer:make` proposer that asks Gemini
for ONE line per question, on the harness's own rendered brief, so the loop
runs to a stop condition on the server and the chat model only starts it.

WHY THIS FILE EXISTS, AND WHY IT LIVES HERE AND NOT IN THE HARNESS. Twenty-
two flash-battery rounds asked the CHAT model to be the writer through a
line-by-line interview carried in tool arguments: keep a state blob, answer
in `L<n>:` shapes, never re-send the draft, emit structured `answers`
arrays, across up to nine hops while also talking to the person. Every
model-side failure of those rounds was the model dropping one of those
shapes (M-158, M-219, M-221, M-226, M-229, M-232, M-233, M-248). The owner's
words on the alternative: *kitchen cooks* — the server runs the loop and,
each time it needs a line, makes its own tiny call with a one-question
form; the chatbot orders and reports. This is that call. It is CONNECTOR
code beside `gemini_agent.js`, reached by the harness only by the name the
connector puts on the command line (`lyric_harness.py`'s `call:` seam
imports exactly the module it is told and names none of its own — that
stance is UNCHANGED; what changed is that this repository now ships a
module for the connector to name). The harness still writes nothing: the
words are Gemini's.

THE CONTRACT (from `lyric_harness.py --propose=call:`): `make()` takes no
arguments and returns `callable(prompt) -> str`. `quality/propose.py`'s
`ModelProposer` renders the brief, calls this, and PARSES the reply with its
own strict parser — an ambiguous reply parses to None and the loop reads
that as "nothing further for this line", which is where a bad answer is
judged, not here. This file does not parse, does not grade and does not
retry a MALFORMED answer (the loop's `--attempts` decides that); it retries
TRANSPORT only.

EVERY CALL IS PRINTED, ONE LINE, TO STDOUT — `PROPOSER CALL n: …` — because
the verb's stdout is what the connector's warm worker returns and what
`lyric_tools.js` reads its run record off (M-216: a battery row that cannot
say what a run cost is a row that will be read wrong). The last such line
carries the running totals, so the record is complete whether or not the
loop reached its end.

CONFIGURATION IS ENVIRONMENT, DECLARED BY THE CONNECTOR AT WORKER SPAWN:
  GEMINI_API_KEY               required — absent, the FIRST CALL raises
                               ProposerUnavailable (the factory itself must
                               not raise: the harness calls it before the
                               loop, outside the clause that turns this
                               into a REFUSED)
  LYRIC_PROPOSER_MODEL         the model, set by the connector from the one
                               place the chat's model is declared
                               (`chat.js`: GEMINI_MODEL or DEFAULT_MODEL);
                               absent, GEMINI_MODEL; absent both, refused
  LYRIC_PROPOSER_API_BASE      default Gemini's; a test points it at a stub
  LYRIC_PROPOSER_TEMPERATURE   default 0.8 — NOT the chat driver's 0: a
                               rejected line is re-asked with its rejection
                               quoted, and at 0 the re-ask returns the same
                               bytes and spends the attempt for nothing
  LYRIC_PROPOSER_MAX_TOKENS    default 1024 per requested line, up to31;
                               an explicit lower allowance refuses dispatch

THE TRANSIENT POLICY RESTATES `gemini_agent.js`'s (RETRY_TRANSIENT
500/502/503/504, three retries at 1 / 2 / 4 s); `mcp/test.mjs` pins the two
equal by reading this file. THE 429 POLICY IS THE KITCHEN'S OWN, ON PURPOSE
(M-255, 2026-09-06): a chat hop has a person waiting and gives a 429 eight
seconds; a kitchen run has a SONG to protect and a declared budget to
protect it with. Round 23 died on seven consecutive 429s whose hints ran
13-60 s (M-249) — under an eight-second ceiling every one of them would have
ended the run as a refusal with nothing to resume. So a 429 is waited out on
the server's own hint, or on a doubling backoff when it names none, for as
long as the run's WAIT BUDGET allows:
  LYRIC_PROPOSER_WAIT_BUDGET_S   the most this run may spend waiting on
                                 429s in all — set by the connector as a
                                 declared share of the tool budget
                                 (lyric_tools.js KITCHEN_WAIT_SHARE);
                                 absent, WAIT_BUDGET_DEFAULT_S
A single hint past HINT_CAP_S is refused at once: a quota that resets on the
provider's clock is a STOPPING PLACE (M-249's ruling), not a wait. Every
wait is counted on the record line (`wait=`), so a run that spent its budget
says so.
"""
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request
from email.utils import parsedate_to_datetime

DEFAULT_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
MAX_RESPONSE_BYTES = 1024 * 1024
MAX_PROPOSAL_LINES = 31
MAX_PROPOSAL_BYTES_PER_LINE = 200 * 4 + 16  # UTF-8 lyric plus L<number> marker
OUTPUT_TOKENS_PER_LINE = 1024
MAX_TOKEN_COUNT = 9007199254740991  # same integer domain as the JS ledger

#: gemini_agent.js RETRY_TRANSIENT, restated (see above).
TRANSIENT_STATUSES = (500, 502, 503, 504)
TRANSIENT_RETRIES = 3
TRANSIENT_BACKOFF_S = (1.0, 2.0, 4.0)

#: THE 429 POLICY (M-255). `WAIT_BUDGET_DEFAULT_S` is the standalone fallback
#: only — the connector always sets LYRIC_PROPOSER_WAIT_BUDGET_S from the one
#: tool budget. A 429 with no hint backs off along RATE_BACKOFF_S (each step
#: doubling, the last repeated); a hint past HINT_CAP_S is refused at once.
WAIT_BUDGET_DEFAULT_S = 240.0
RATE_BACKOFF_S = (2.0, 4.0, 8.0, 16.0, 32.0, 60.0)
HINT_CAP_S = 120.0
# A zero-second hint is valid but cannot bypass every retry ceiling.
RATE_RETRIES = 32
MIN_RATE_WAIT_S = 0.25

#: What the writer is, in one breath. The brief itself (rendered by
#: quality/propose.py) carries the whole question, the forbidden words and
#: HOW TO ANSWER; this only fixes the role and the reply shape.
SYSTEM_INSTRUCTION = (
    "You are the WRITER inside a songwriting harness. Each message is one "
    "question from the harness's own grader: a brief for ONE line, or for one "
    "GROUP of lines that must rhyme together. Answer with the line(s) and "
    "nothing else, exactly in the shape the brief's HOW TO ANSWER section "
    "asks for: a single-line question gets one bare line (no quotation marks, "
    "no line number, no commentary, no code fence); a group question gets one "
    "`L<n>: text` row per asked line and nothing else. Never repeat the whole "
    "song. Never use a word the brief marks FORBIDDEN. Prefer the "
    "unexpected-but-earned word over the predictable one — the brief tells you "
    "which words are too predictable, and the grader rejects them."
)


try:
    # THE HARNESS'S OWN NAME FOR THIS FAILURE (quality/propose.py), so the
    # verb's clause catches it by identity. Importable whenever this module
    # is reached through the `call:` seam (the harness dir is sys.path[0]
    # there); the fallback keeps the module importable standalone.
    from quality.propose import ProposerUnavailable
except ImportError:                                        # standalone import
    class ProposerUnavailable(RuntimeError):
        """No key, no model, or transport exhausted — see quality/propose.py."""


def _env(name, default=None):
    v = os.environ.get(name)
    return v if v not in (None, "") else default


def _retry_after_s(headers, body):
    """The server's own hint, in seconds, or None."""
    ra = next((value for key, value in (headers.items() if headers else ())
               if key.lower() == "retry-after"), None)
    if ra:
        try:
            value = float(ra)
            if math.isfinite(value) and value >= 0:
                return value
        except (ValueError, TypeError):
            try:
                date = parsedate_to_datetime(ra)
                if date.tzinfo is not None:
                    return max(0.0, date.timestamp() - time.time())
            except (ValueError, TypeError, OverflowError):
                pass
    try:
        for d in (body or {}).get("error", {}).get("details", []):
            delay = d.get("retryDelay")
            if isinstance(delay, str) and delay.endswith("s"):
                value = float(delay[:-1])
                if math.isfinite(value) and value >= 0:
                    return value
    except (AttributeError, ValueError, TypeError):
        pass
    return None


def _usage_state(usage):
    """Validate without coercion; missing accounting remains explicitly unknown."""
    if usage is None or usage == {}:
        return {}, False, None
    if not isinstance(usage, dict):
        return {}, False, "usageMetadata must be an object"
    fields = ("promptTokenCount", "candidatesTokenCount", "thoughtsTokenCount",
              "cachedContentTokenCount", "totalTokenCount", "toolUsePromptTokenCount")
    for field in fields:
        if field in usage and (type(usage[field]) is not int or
                               not 0 <= usage[field] <= MAX_TOKEN_COUNT):
            return {}, False, f"invalid {field}"
    known = all(field in usage for field in fields[:2])
    total = sum(usage.get(key, 0) for key in
                ("promptTokenCount", "candidatesTokenCount", "thoughtsTokenCount",
                 "toolUsePromptTokenCount"))
    if "totalTokenCount" in usage and usage["totalTokenCount"] != total:
        return usage, False, "inconsistent totalTokenCount"
    if usage.get("cachedContentTokenCount", 0) > usage.get("promptTokenCount", 0):
        return usage, False, "cachedContentTokenCount exceeds promptTokenCount"
    return usage, known, None


class _Kitchen:
    def __init__(self):
        self._max_lines = 1
        self.calls = 0
        self.ms_total = 0
        self.tokens_in = 0
        self.tokens_out = 0
        self.empty = 0
        self.retries = 0
        self.waited_s = 0.0
        self.wait_pending_s = 0.0
        self._checked = False
        self.attempts = 0
        self.tokens_thoughts = 0
        self.tokens_cached = 0
        self.tokens_total = 0
        self.unknown_attempts = 0
        self.in_flight = False
        self._call_started = None
        self.finish_reason = None
        self.prompt_feedback = None
        self.failure_code = None
        self._configuration_error = None
        try:
            deadline = float(_env("LYRIC_REQUEST_DEADLINE_MS", "inf")) / 1000
            if math.isnan(deadline):
                raise ValueError("deadline is NaN")
            self.deadline = time.monotonic() + max(0, deadline - time.time())
        except ValueError:
            self.deadline = math.inf
            self._configuration_error = "invalid kitchen request deadline"

    def _refuse(self, code, message):
        self.failure_code = code
        error = ProposerUnavailable(message)
        error.code = code
        raise error

    def _remaining(self):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise ProposerUnavailable("the kitchen request deadline is spent")
        return remaining

    def _emit(self, status):
        elapsed = 0 if self._call_started is None else int((time.monotonic() - self._call_started) * 1000)
        record = {"transport_token": _env("LYRIC_CONTROL_TOKEN"), "model": _env("LYRIC_PROPOSER_MODEL") or _env("GEMINI_MODEL") or "unset",
            "calls": self.calls, "attempts": self.attempts,
            "ms": self.ms_total + elapsed,
            "tokens_in": self.tokens_in, "tokens_out": self.tokens_out,
            "tokens_thoughts": self.tokens_thoughts, "tokens_cached": self.tokens_cached,
            "tokens_total": self.tokens_total, "empty": self.empty,
            "retries": self.retries, "wait_s": self.waited_s, "wait_pending_s": self.wait_pending_s,
            "status": status, "in_flight": self.in_flight,
            "usage_unknown": bool(self.unknown_attempts), "unknown_attempts": self.unknown_attempts,
            "finish_reason": self.finish_reason, "prompt_feedback": self.prompt_feedback,
            "failure_code": self.failure_code}
        print("  proposer event: " + json.dumps(record, separators=(",", ":")), flush=True)

    def _budget(self, action, **fields):
        url = _env("LYRIC_BUDGET_URL")
        if not url:
            return {}  # standalone CLI; connector always installs the broker
        data = json.dumps({"action": action, **fields}).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST", headers={
            "content-type": "application/json",
            "authorization": "Bearer " + _env("LYRIC_BUDGET_TOKEN", "")})
        try:
            with urllib.request.urlopen(req, timeout=min(5, self._remaining())) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, OSError, ValueError) as error:
            raise ProposerUnavailable(f"kitchen spend admission unavailable: {error}") from None

    def _sleep(self, seconds, status):
        if seconds >= self._remaining():
            self._emit("deadline")
            raise ProposerUnavailable("the next retry wait would exceed the kitchen request deadline")
        self.wait_pending_s = seconds
        self._emit(status)
        time.sleep(seconds)
        if status == "rate_wait":
            self.waited_s += seconds
        self.wait_pending_s = 0.0
        self._emit("retry_ready")

    def _check(self):
        if self._checked:
            return
        if self._configuration_error:
            self._refuse("PROPOSER_CONFIG", self._configuration_error)
        if not _env("GEMINI_API_KEY"):
            raise ProposerUnavailable(
                "GEMINI_API_KEY is not set for the kitchen proposer — the "
                "connector's service env declares it (render.yaml); with it "
                "unset there is no writer to ask")
        if not (_env("LYRIC_PROPOSER_MODEL") or _env("GEMINI_MODEL")):
            raise ProposerUnavailable(
                "no model declared for the kitchen proposer — set "
                "LYRIC_PROPOSER_MODEL (the connector sets it from the chat's "
                "own declared model) or GEMINI_MODEL")
        self._checked = True

    def _post(self, prompt):
        key = _env("GEMINI_API_KEY")
        model = _env("LYRIC_PROPOSER_MODEL") or _env("GEMINI_MODEL")
        base = _env("LYRIC_PROPOSER_API_BASE", DEFAULT_API_BASE).rstrip("/")
        try:
            temperature = float(_env("LYRIC_PROPOSER_TEMPERATURE", "0.8"))
            required_tokens = OUTPUT_TOKENS_PER_LINE * self._max_lines
            max_tokens = int(_env("LYRIC_PROPOSER_MAX_TOKENS", str(required_tokens)))
            budget = float(_env("LYRIC_PROPOSER_WAIT_BUDGET_S", str(WAIT_BUDGET_DEFAULT_S)))
            if not (math.isfinite(temperature) and 0 <= temperature <= 2 and
                    required_tokens <= max_tokens <= 65536 and math.isfinite(budget) and budget >= 0):
                raise ValueError("out of bounds")
        except ValueError:
            self._refuse("PROPOSER_CONFIG", "invalid kitchen generation or wait configuration")
        body = {
            "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        data = json.dumps(body).encode("utf-8")
        url = f"{base}/models/{model}:generateContent"
        rate_limited, transient = 0, 0
        while True:
            self._remaining()
            reservation = self._budget("reserve", model=model,
                inputBytes=len(data), maxOutputTokens=body["generationConfig"]["maxOutputTokens"])
            reservation_id = reservation.get("reservation_id")
            self.attempts += 1
            self.in_flight = True
            self._emit("request")
            req = urllib.request.Request(
                url, data=data, method="POST",
                headers={"content-type": "application/json", "x-goog-api-key": key})
            try:
                with urllib.request.urlopen(req, timeout=min(60, self._remaining())) as resp:
                    raw = resp.read(MAX_RESPONSE_BYTES + 1)
            except urllib.error.HTTPError as error:
                self.in_flight = False
                self._budget("settle", reservation_id=reservation_id, usage=None, status="rejected")
                self._emit("rejected")
                status = error.code
                try:
                    payload = json.loads(error.read(MAX_RESPONSE_BYTES).decode("utf-8") or "null")
                except (ValueError, UnicodeDecodeError):
                    payload = None
                if status == 429:
                    hint = _retry_after_s(error.headers, payload)
                    if hint is not None and hint > HINT_CAP_S:
                        raise ProposerUnavailable(
                            f"Gemini 429 with Retry-After {hint:.0f}s, past "
                            f"the {HINT_CAP_S:.0f}s hint cap — a quota that "
                            f"resets on the provider's clock is a stopping "
                            f"place, not a wait (M-249); {self.waited_s:.0f}s "
                            f"of the {budget:.0f}s wait budget spent so far, "
                            f"{rate_limited} paced retry(ies) on this call") from None
                    wait = max(MIN_RATE_WAIT_S, hint if hint is not None else
                        RATE_BACKOFF_S[min(rate_limited, len(RATE_BACKOFF_S) - 1)])
                    if rate_limited >= RATE_RETRIES:
                        raise ProposerUnavailable(f"Gemini 429 paced retry cap spent ({RATE_RETRIES})") from None
                    if self.waited_s + wait > budget:
                        raise ProposerUnavailable(
                            f"Gemini 429 and the run's wait budget is spent: "
                            f"{self.waited_s:.0f}s waited of {budget:.0f}s "
                            f"(LYRIC_PROPOSER_WAIT_BUDGET_S), the next wait would be {wait:.0f}s; "
                            f"{rate_limited} paced retry(ies) on this call") from None
                    rate_limited += 1
                    self.retries += 1
                    self._sleep(wait, "rate_wait")
                    continue
                if status in TRANSIENT_STATUSES and transient < TRANSIENT_RETRIES:
                    wait = TRANSIENT_BACKOFF_S[transient]
                    transient += 1
                    self.retries += 1
                    self._sleep(wait, "transient_wait")
                    continue
                detail = payload.get("error") if isinstance(payload, dict) else None
                detail = detail.get("message") if isinstance(detail, dict) else None
                detail = detail if isinstance(detail, str) else ""
                raise ProposerUnavailable(
                    f"Gemini {status}{': ' + detail if detail else ''}"
                    + (f" after {transient} transient retries" if transient else "")) from None
            except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
                self.in_flight = False
                self.unknown_attempts += 1
                self._budget("settle", reservation_id=reservation_id, usage=None, status="unknown")
                if transient < TRANSIENT_RETRIES:
                    wait = TRANSIENT_BACKOFF_S[transient]
                    transient += 1
                    self.retries += 1
                    self._sleep(wait, "transport_wait")
                    continue
                raise ProposerUnavailable(f"transport failed after {transient} retries: {error}") from None
            self.in_flight = False
            try:
                if len(raw) > MAX_RESPONSE_BYTES:
                    raise ValueError("provider response exceeds size limit")
                reply = json.loads(raw.decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                self.unknown_attempts += 1
                self._budget("settle", reservation_id=reservation_id, usage=None, status="unknown")
                self._refuse("PROVIDER_PROTOCOL", "Gemini returned unreadable or oversized JSON")
            usage = reply.get("usageMetadata") if isinstance(reply, dict) else None
            usage, known, usage_error = _usage_state(usage)
            if not known:
                self.unknown_attempts += 1
            # Retain known usage before settlement itself can fail. The broker
            # conservatively holds a reservation if it loses the settlement.
            self.tokens_in += usage.get("promptTokenCount", 0)
            self.tokens_out += usage.get("candidatesTokenCount", 0)
            self.tokens_thoughts += usage.get("thoughtsTokenCount", 0)
            self.tokens_cached += usage.get("cachedContentTokenCount", 0)
            self.tokens_total += usage.get("totalTokenCount", sum(usage.get(key, 0) for key in
                    ("promptTokenCount", "candidatesTokenCount", "thoughtsTokenCount", "toolUsePromptTokenCount")))
            self._emit("response")
            settled = self._budget("settle", reservation_id=reservation_id,
                                   usage=usage, status="success")
            if settled.get("status") == "unknown" and known:
                self.unknown_attempts += 1
            if usage_error:
                self._refuse("PROVIDER_USAGE", f"Gemini returned invalid usage: {usage_error}")
            return reply, model

    def _text_of(self, reply):
        if not isinstance(reply, dict):
            self._refuse("PROVIDER_PROTOCOL", "Gemini response must be an object")
        self.prompt_feedback = reply.get("promptFeedback")
        if self.prompt_feedback is not None and not isinstance(self.prompt_feedback, dict):
            self._refuse("PROVIDER_PROTOCOL", "Gemini promptFeedback must be an object")
        candidates = reply.get("candidates", [])
        if not isinstance(candidates, list) or any(not isinstance(c, dict) for c in candidates):
            self._refuse("PROVIDER_PROTOCOL", "Gemini candidates must be objects in a list")
        if not candidates:
            self._refuse("PROVIDER_REFUSAL", "Gemini returned no candidate; see prompt_feedback")
        self.finish_reason = candidates[0].get("finishReason")
        if not isinstance(self.finish_reason, str):
            self._refuse("PROVIDER_PROTOCOL", "Gemini candidate is missing its finishReason")
        if self.finish_reason != "STOP":
            self._refuse("PROVIDER_TRUNCATED" if self.finish_reason == "MAX_TOKENS" else "PROVIDER_REFUSAL",
                         f"Gemini candidate did not complete: {self.finish_reason}")
        content = candidates[0].get("content")
        parts = content.get("parts") if isinstance(content, dict) else None
        if not isinstance(parts, list) or any(not isinstance(p, dict) or
                ("text" in p and not isinstance(p["text"], str)) or
                ("thought" in p and not isinstance(p["thought"], bool)) for p in parts):
            self._refuse("PROVIDER_PROTOCOL", "Gemini content parts must contain string text")
        if any("text" not in p for p in parts):
            self._refuse("PROVIDER_PROTOCOL", "Gemini returned a non-text proposal part")
        text = "".join(p["text"] for p in parts if not p.get("thought"))
        if len(text.encode("utf-8")) > self._max_lines * MAX_PROPOSAL_BYTES_PER_LINE:
            self._refuse("PROVIDER_PROPOSAL_TOO_LARGE", "Gemini proposal exceeds the declared line capacity")
        return text

    def __call__(self, prompt):
        return self.with_capacity(prompt, max_lines=1)

    def with_capacity(self, prompt, *, max_lines):
        if type(max_lines) is not int or not 1 <= max_lines <= MAX_PROPOSAL_LINES:
            self._refuse("PROPOSER_CONFIG", "proposal line capacity must be an integer from1 to31")
        self._max_lines = max_lines
        self._call_started = time.monotonic()
        self.finish_reason = self.prompt_feedback = self.failure_code = None
        t_in = t_out = 0
        finish = ""
        status = "failed"
        model = _env("LYRIC_PROPOSER_MODEL") or _env("GEMINI_MODEL") or "unset"
        try:
            self._check()
            reply, model = self._post(prompt)
            text = self._text_of(reply)
            usage = (reply or {}).get("usageMetadata") or {}
            t_in = int(usage.get("promptTokenCount") or 0)
            t_out = int(usage.get("candidatesTokenCount") or 0)
            finish = self.finish_reason
            self.calls += 1
            status = "ok" if text.strip() else "empty"
            if not text.strip():
                self.empty += 1
            return text
        except ProposerUnavailable:
            status = "truncated" if self.failure_code == "PROVIDER_TRUNCATED" else (
                "refused" if self.failure_code else "failed")
            finish = self.finish_reason
            raise
        finally:
            ms = int((time.monotonic() - self._call_started) * 1000)
            self.ms_total += ms
            self._call_started = None
            self._emit(status)
            # The legacy human-readable line remains byte-compatible through
            # wait=. Structured events above carry all added usage dimensions.
            print(f"  PROPOSER CALL {self.calls}: {status} {ms} ms in={t_in} "
                  f"out={t_out}"
                  + (f" finish={finish}" if finish and finish != "STOP" else "")
                  + f" | kitchen model={model} calls={self.calls} "
                  f"ms={self.ms_total} in={self.tokens_in} out={self.tokens_out} "
                  f"empty={self.empty} retries={self.retries} wait={int(self.waited_s)}",
                  flush=True)


def make():
    """The FACTORY the command line names: `--propose=call:gemini_proposer:make`.
    No arguments, returns callable(prompt) -> str. Everything it needs is
    read from the environment on the first call, never here (see the
    module docstring for why the factory must not raise)."""
    return _Kitchen()


if __name__ == "__main__":
    print(__doc__)

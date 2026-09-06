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
  LYRIC_PROPOSER_MAX_TOKENS    default 256 (one line, or one short group)

THE PACING POLICY RESTATES `gemini_agent.js`'s numbers (RATE_LIMIT_RETRY:
two 429 retries at 2 s / 4 s or the hint, eight seconds in all;
RETRY_TRANSIENT 500/502/503/504 three times at 1 / 2 / 4 s). Two statements
of one policy across two languages is doctrine 1's defect; `mcp/test.mjs`
pins the two equal by reading this file, so they cannot drift in silence.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

DEFAULT_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

#: gemini_agent.js RATE_LIMIT_RETRY / RETRY_TRANSIENT, restated (see above).
RATE_LIMIT_RETRIES = 2
RATE_LIMIT_BACKOFF_S = (2.0, 4.0)
RATE_LIMIT_MAX_WAIT_S = 8.0
TRANSIENT_STATUSES = (500, 502, 503, 504)
TRANSIENT_RETRIES = 3
TRANSIENT_BACKOFF_S = (1.0, 2.0, 4.0)

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
    ra = headers.get("Retry-After") if headers else None
    if ra:
        try:
            return float(ra)
        except ValueError:
            pass
    try:
        for d in (body or {}).get("error", {}).get("details", []):
            delay = d.get("retryDelay")
            if isinstance(delay, str) and delay.endswith("s"):
                return float(delay[:-1])
    except (AttributeError, ValueError, TypeError):
        pass
    return None


class _Kitchen:
    def __init__(self):
        self.calls = 0
        self.ms_total = 0
        self.tokens_in = 0
        self.tokens_out = 0
        self.empty = 0
        self.retries = 0
        self._checked = False

    def _check(self):
        if self._checked:
            return
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
        body = {
            "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": float(_env("LYRIC_PROPOSER_TEMPERATURE", "0.8")),
                "maxOutputTokens": int(_env("LYRIC_PROPOSER_MAX_TOKENS", "256")),
            },
        }
        data = json.dumps(body).encode("utf-8")
        url = f"{base}/models/{model}:generateContent"
        rate_limited, waited, transient = 0, 0.0, 0
        while True:
            req = urllib.request.Request(
                url, data=data, method="POST",
                headers={"content-type": "application/json",
                         "x-goog-api-key": key})
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    return json.loads(resp.read().decode("utf-8") or "null"), model
            except urllib.error.HTTPError as e:
                status = e.code
                try:
                    payload = json.loads(e.read().decode("utf-8") or "null")
                except (ValueError, UnicodeDecodeError):
                    payload = None
                if status == 429:
                    hint = _retry_after_s(e.headers, payload)
                    wait = hint if hint is not None else (
                        RATE_LIMIT_BACKOFF_S[min(rate_limited,
                                                 len(RATE_LIMIT_BACKOFF_S) - 1)])
                    if (rate_limited < RATE_LIMIT_RETRIES
                            and waited + wait <= RATE_LIMIT_MAX_WAIT_S):
                        rate_limited += 1
                        waited += wait
                        self.retries += 1
                        time.sleep(wait)
                        continue
                    raise ProposerUnavailable(
                        f"Gemini 429 after {rate_limited} bounded retr"
                        f"{'y' if rate_limited == 1 else 'ies'} "
                        f"({waited:.0f}s waited; hint "
                        f"{hint if hint is not None else 'none'})") from None
                if status in TRANSIENT_STATUSES and transient < TRANSIENT_RETRIES:
                    wait = TRANSIENT_BACKOFF_S[min(transient,
                                                   len(TRANSIENT_BACKOFF_S) - 1)]
                    transient += 1
                    self.retries += 1
                    time.sleep(wait)
                    continue
                detail = ""
                try:
                    detail = payload["error"]["message"]
                except (KeyError, TypeError):
                    pass
                raise ProposerUnavailable(
                    f"Gemini {status}{': ' + detail if detail else ''}"
                    + (f" after {transient} transient retries"
                       if transient else "")) from None
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                if transient < TRANSIENT_RETRIES:
                    wait = TRANSIENT_BACKOFF_S[min(transient,
                                                   len(TRANSIENT_BACKOFF_S) - 1)]
                    transient += 1
                    self.retries += 1
                    time.sleep(wait)
                    continue
                raise ProposerUnavailable(
                    f"transport failed after {transient} retries: {e}") from None

    @staticmethod
    def _text_of(reply):
        try:
            parts = reply["candidates"][0]["content"]["parts"]
        except (KeyError, IndexError, TypeError):
            return ""
        return "".join(p.get("text", "") for p in parts
                       if isinstance(p, dict) and not p.get("thought"))

    def __call__(self, prompt):
        self._check()
        t0 = time.monotonic()
        reply, model = self._post(prompt)
        ms = int((time.monotonic() - t0) * 1000)
        text = self._text_of(reply)
        usage = (reply or {}).get("usageMetadata") or {}
        t_in = int(usage.get("promptTokenCount") or 0)
        t_out = int(usage.get("candidatesTokenCount") or 0)
        finish = ""
        try:
            finish = reply["candidates"][0].get("finishReason", "") or ""
        except (KeyError, IndexError, TypeError):
            pass
        self.calls += 1
        self.ms_total += ms
        self.tokens_in += t_in
        self.tokens_out += t_out
        status = "ok" if text.strip() else "empty"
        if not text.strip():
            self.empty += 1
        # ONE LINE PER CALL, TOTALS ON EVERY LINE (the last line is the
        # summary whether or not the loop finishes).
        print(f"  PROPOSER CALL {self.calls}: {status} {ms} ms in={t_in} "
              f"out={t_out}"
              + (f" finish={finish}" if finish and finish != "STOP" else "")
              + f" | kitchen model={model} calls={self.calls} "
              f"ms={self.ms_total} in={self.tokens_in} out={self.tokens_out} "
              f"empty={self.empty} retries={self.retries}")
        sys.stdout.flush()
        return text


def make():
    """The FACTORY the command line names: `--propose=call:gemini_proposer:make`.
    No arguments, returns callable(prompt) -> str. Everything it needs is
    read from the environment on the first call, never here (see the
    module docstring for why the factory must not raise)."""
    return _Kitchen()


if __name__ == "__main__":
    print(__doc__)

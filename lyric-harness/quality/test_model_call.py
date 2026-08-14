#!/usr/bin/env python3
"""Regressions for the model adapter (quality/model_call.py).

EVERY TEST HERE RUNS WITH NO NETWORK AND NO KEY, and that is a claim about the
tests rather than a hope about the environment: §1 asserts it mechanically by
installing a transport that RAISES if anything reaches it, and leaving it
installed for the whole run. A test file for the one module in this package
that can open a socket is exactly the file where "surely nothing dialled out"
must be checked instead of assumed.

  §1  the module opens nothing, and the guard that proves it
  §2  the REFUSAL — a missing key names its input and does not fall back,
      at the API and at the command line (exit 2, the `--fallback=bogus`
      shape)
  §3  the SOURCING rule — Model and Decoding refuse construction without a
      source, and nothing has a silent default that changes the text
  §4  the (model, decoding) pair refuses LOCALLY where the service would
      have 400'd, naming the model
  §5  the LAYERS are distinguishable — every error kind fired from a stub
      transport and told apart by class and by `.layer`, including the two
      that share the SERVICE layer and have opposite remedies
  §6  RECORD -> REPLAY round-trips BYTE-IDENTICALLY, including non-ASCII,
      and two recordings of one stubbed run are byte-identical FILES
  §7  replay REFUSES rather than inventing — an unrecorded prompt, an
      exhausted queue, an edited file
  §8  the key never appears in a repr, a coordinate set, or a recording
  §9  retries are a declared coordinate: 0 by default, only the retryable
      layers are retried, and the attempt count reaches the recording

Run: python3 quality/test_model_call.py
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality import model_call as MC  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def raises(fn, cls):
    """-> the exception instance, or None. Never swallows a DIFFERENT class:
    the whole subject of §5 is that these are told apart, so a test that
    caught everything would pass while the module collapsed them."""
    try:
        fn()
    except cls as e:
        return e
    except BaseException as e:                   # noqa: BLE001
        return ("WRONG CLASS", type(e).__name__, str(e)[:120])
    return None


# ---------------------------------------------------------------------------
# THE STUBS
#
# A transport is `(url, body, headers, timeout) -> (status, headers, body)`,
# which is the entire seam. Nothing here monkeypatches urllib: the module takes
# the transport as a parameter precisely so a test does not have to trust that
# a patch landed.
# ---------------------------------------------------------------------------

def ok_body(text, stop="end_turn", usage=None):
    return json.dumps({
        "id": "msg_test", "type": "message", "role": "assistant",
        "model": "claude-opus-5",
        "content": [{"type": "text", "text": text}],
        "stop_reason": stop,
        "usage": usage or {"input_tokens": 11, "output_tokens": 7},
    }).encode("utf-8")


def stub(status=200, body=None, headers=None, seen=None):
    def _t(url, req_body, req_headers, timeout):
        if seen is not None:
            seen.append({"url": url, "body": json.loads(req_body.decode()),
                         "headers": dict(req_headers), "timeout": timeout})
        return status, dict(headers or {}), (body if body is not None
                                             else ok_body("stub answer"))
    return _t


def sequence_transport(steps, seen=None):
    """Yields a different outcome per attempt. A step is either a callable to
    raise from, or an (status, headers, body) triple."""
    box = {"i": 0}

    def _t(url, req_body, req_headers, timeout):
        if seen is not None:
            seen.append(json.loads(req_body.decode()))
        step = steps[min(box["i"], len(steps) - 1)]
        box["i"] += 1
        if callable(step):
            return step()
        return step
    return _t


DECL = MC.Decoding(max_tokens=256, temperature=None, thinking="disabled",
                   source="test_model_call.py fixture")


def live(**kw):
    """A ModelCall with a stub transport and an explicit key. `system=None` is
    passed everywhere because the module refuses an omitted one."""
    kw.setdefault("model", "claude-opus-5")
    kw.setdefault("decoding", DECL)
    kw.setdefault("system", None)
    kw.setdefault("api_key", "sk-test-not-a-real-key")
    kw.setdefault("transport", stub())
    return MC.anthropic_call(**kw)


# ---------------------------------------------------------------------------
# §1  NO NETWORK
# ---------------------------------------------------------------------------

NETWORK_TOUCHED = []


def _tripwire(*a, **k):
    NETWORK_TOUCHED.append(a[:1])
    raise AssertionError(
        "quality/test_model_call.py reached the real transport. Every test in "
        "this file is supposed to run with no network and no key.")


def test_no_network_and_no_key():
    print("\n§1  the module opens nothing")

    # Installed for the REST OF THE RUN, not just this test. A guard that is
    # uninstalled at the end of the first section proves only that the first
    # section was clean.
    MC.urllib_transport = _tripwire

    check("importing the module made no request",
          NETWORK_TOUCHED == [], NETWORK_TOUCHED)
    check("no key is present in this environment, so the refusal path is the "
          "one under test rather than a hypothetical",
          not os.environ.get(MC.KEY_ENV_VAR),
          repr(os.environ.get(MC.KEY_ENV_VAR)))

    # The report is the default __main__ path; it must not dial out either.
    text = MC.capability_report()
    check("capability_report() runs with the tripwire installed",
          "model_call" in text and NETWORK_TOUCHED == [])

    # A subprocess is the honest check that IMPORT is inert: it has no
    # tripwire, so if the module dialled out at import this would hang or
    # fail rather than pass.
    r = subprocess.run(
        [sys.executable, "-c",
         "import quality.model_call as m; print(len(m.CATALOGUE))"],
        cwd=os.path.join(HERE, ".."), capture_output=True, text=True,
        timeout=60)
    check("a fresh interpreter imports the module and exits 0 (import is "
          "inert)", r.returncode == 0 and r.stdout.strip().isdigit(),
          f"rc={r.returncode} out={r.stdout.strip()!r} "
          f"err={r.stderr.strip()[:200]!r}")


# ---------------------------------------------------------------------------
# §2  THE REFUSAL
# ---------------------------------------------------------------------------

def test_missing_key_refuses_and_does_not_fall_back():
    print("\n§2  a missing key REFUSES with a named message")

    e = raises(lambda: MC.anthropic_call(model="claude-opus-5",
                                         decoding=DECL, system=None,
                                         api_key=MC.FROM_ENV,
                                         transport=stub()),
               MC.KeyRefused)
    check("no key -> KeyRefused, not a generic Exception",
          isinstance(e, MC.KeyRefused), e)
    msg = str(e) if isinstance(e, MC.KeyRefused) else ""
    check("the message NAMES the missing input", MC.KEY_ENV_VAR in msg)
    check("the message says what to do instead — replay, which needs no key",
          "replay" in msg)
    check("the message says explicitly that this is NOT a fallback",
          "not a fallback" in msg.lower())
    check("the refusal is in the DECLARATION layer: nothing left the process",
          getattr(e, "layer", None) == "DECLARATION")
    check("a DECLARATION refusal is not retryable — retrying a thing you "
          "never supplied is meaningless",
          getattr(e, "retryable", None) is False)

    # An explicitly-empty key is the same refusal, and says which slot.
    e2 = raises(lambda: MC.anthropic_call(model="claude-opus-5",
                                          decoding=DECL, system=None,
                                          api_key="", transport=stub()),
                MC.KeyRefused)
    check("api_key='' refuses too, and names the ARGUMENT rather than the "
          "environment variable",
          isinstance(e2, MC.KeyRefused) and "api_key argument" in str(e2))

    # THE REFUSAL FIRES AT CONSTRUCTION. A loop that learns on its fortieth
    # line has already spent thirty-nine.
    check("the refusal fires at CONSTRUCTION — no call was needed to provoke "
          "it", isinstance(e, MC.KeyRefused))

    # The CLI shape this repo already uses: printed refusal, exit 2.
    env = dict(os.environ)
    env.pop(MC.KEY_ENV_VAR, None)
    r = subprocess.run([sys.executable, "quality/model_call.py", "--probe"],
                       cwd=os.path.join(HERE, ".."), capture_output=True,
                       text=True, env=env, timeout=120)
    check("`model_call.py --probe` with no key prints REFUSED and exits 2 — "
          "the same shape as --fallback=bogus",
          r.returncode == 2 and "REFUSED" in r.stdout,
          f"rc={r.returncode} out={r.stdout.strip()[:160]!r}")
    check("the printed refusal names its layer",
          "[DECLARATION]" in r.stdout, r.stdout.strip()[:160])

    # And the DEFAULT command-line path is not the probe: it exits 0 without
    # a socket, so CI can run it.
    r0 = subprocess.run([sys.executable, "quality/model_call.py"],
                        cwd=os.path.join(HERE, ".."), capture_output=True,
                        text=True, env=env, timeout=120)
    check("the DEFAULT command line exits 0 with no key and no network",
          r0.returncode == 0, f"rc={r0.returncode}")

    # There is no fallback anywhere in the file. Grepped, because the claim is
    # about the whole module and not about the one path a test happened to
    # walk.
    src = open(os.path.join(HERE, "model_call.py"), encoding="utf-8").read()
    check("the module imports nothing from quality.loop — it cannot reach the "
          "stub proposer even if someone wanted it to",
          "from quality.loop" not in src and "import quality.loop" not in src)


# ---------------------------------------------------------------------------
# §3  THE SOURCING RULE, AND NO SILENT DEFAULTS
# ---------------------------------------------------------------------------

def test_coordinates_must_be_declared():
    print("\n§3  every coordinate that changes the text is declared")

    e = raises(lambda: MC.Model(id="claude-opus-5", max_output_tokens=1000),
               ValueError)
    check("Model without a source refuses at construction",
          isinstance(e, ValueError) and "source" in str(e))
    check("the refusal explains WHY, and cites the near-miss that motivated "
          "it", isinstance(e, ValueError) and "from memory" in str(e))

    e = raises(lambda: MC.Decoding(max_tokens=10, temperature=None,
                                   thinking=None), ValueError)
    check("Decoding without a source refuses at construction",
          isinstance(e, ValueError) and "source" in str(e))

    # None of max_tokens / temperature / thinking has a default: omitting one
    # is a TypeError from Python itself, which is the strongest possible form
    # of "no silent default".
    e = raises(lambda: MC.Decoding(max_tokens=10, source="x"), TypeError)
    check("Decoding(max_tokens=..) alone is a TypeError — temperature and "
          "thinking cannot be omitted, so neither can acquire a default",
          isinstance(e, TypeError), e)

    # temperature=None is a DECISION and is legal; the point is that it must
    # be typed.
    d = MC.Decoding(max_tokens=10, temperature=None, thinking=None,
                    source="x")
    check("temperature=None is legal — declining to send it is a decision",
          d.coordinates()["temperature"] is None)

    # system is required, and None is legal.
    e = raises(lambda: MC.anthropic_call(model="claude-opus-5", decoding=DECL,
                                         api_key="k", transport=stub()),
               ValueError)
    check("an omitted system= refuses — an oversight must not be able to "
          "impersonate a made choice",
          isinstance(e, ValueError) and "system=None" in str(e))
    check("system=None is accepted once it is typed",
          live().system is None)

    # An unregistered id refuses and says what IS registered.
    e = raises(lambda: MC.get_model("claude-opus-4-5"), MC.KeyRefused)
    check("an unregistered model id refuses and lists what is registered",
          isinstance(e, MC.KeyRefused) and "claude-opus-5" in str(e))
    check("the id refusal explains why a guess is unsafe (the request surface "
          "is model-dependent)",
          isinstance(e, MC.KeyRefused) and "temperature" in str(e))

    # Every shipped catalogue row carries a DATED source.
    check("every catalogue row has a source naming a document and a date",
          all(m.source and "2026-06-24" in m.source
              for m in MC.CATALOGUE.values()),
          sorted(MC.CATALOGUE))
    check("register_model refuses an unsourced row",
          isinstance(raises(lambda: MC.register_model(
              MC.Model.__new__(MC.Model)), Exception), Exception))


# ---------------------------------------------------------------------------
# §4  THE PAIR REFUSES LOCALLY WHERE THE SERVICE WOULD 400
# ---------------------------------------------------------------------------

def test_model_decoding_pair_refuses_before_a_round_trip():
    print("\n§4  an impossible (model, decoding) refuses locally, by name")

    hot = MC.Decoding(max_tokens=64, temperature=0.0, thinking=None,
                      source="a caller reaching for temperature=0")
    e = raises(lambda: live(decoding=hot), MC.ServiceRefused)
    check("temperature on claude-opus-5 refuses HERE — the service would have "
          "answered 400 with the model id buried in it",
          isinstance(e, MC.ServiceRefused), e)
    check("the refusal names the model", "claude-opus-5" in str(e))
    check("and says temperature is not a reproducibility control on ANY "
          "current model — the specific wrong idea that leads a caller here",
          "never guaranteed identical output" in str(e))
    check("no request was made: the stub recorded nothing",
          isinstance(e, MC.ServiceRefused) and e.status is None)

    # The same value is fine on a model whose row says so. The catalogue is
    # load-bearing, not decorative.
    ok = live(model="claude-sonnet-4-6", decoding=hot)
    check("the identical Decoding is ACCEPTED on claude-sonnet-4-6, whose row "
          "says it takes temperature — the refusal is per-model, not a blanket"
          " ban", ok("x") == "stub answer")

    # thinking='adaptive' on a model whose row says it takes the older shape.
    ad = MC.Decoding(max_tokens=64, temperature=None, thinking="adaptive",
                     source="fixture")
    e = raises(lambda: live(model="claude-haiku-4-5", decoding=ad),
               MC.ServiceRefused)
    check("thinking='adaptive' on claude-haiku-4-5 refuses, listing what IS "
          "legal there", isinstance(e, MC.ServiceRefused) and "None" in str(e))

    big = MC.Decoding(max_tokens=999999, temperature=None, thinking=None,
                      source="fixture")
    e = raises(lambda: live(model="claude-haiku-4-5", decoding=big),
               MC.ServiceRefused)
    check("max_tokens over the model's ceiling refuses locally",
          isinstance(e, MC.ServiceRefused) and "64000" in str(e))

    # The SILENT half of the trap: omitting `thinking` means opposite things
    # on two ids, and the catalogue is where that is written down.
    check("the catalogue records that an omitted `thinking` means ADAPTIVE ON "
          "for opus-5 and NO THINKING for opus-4-8 — the same request body, "
          "two different spends, no error either way",
          "ADAPTIVE THINKING ON"
          in MC.CATALOGUE["claude-opus-5"].thinking_when_omitted
          and "NO THINKING"
          in MC.CATALOGUE["claude-opus-4-8"].thinking_when_omitted)

    # The wire body is built from the declaration and nothing else.
    seen = []
    c = live(transport=stub(seen=seen))
    c("hello")
    body = seen[0]["body"]
    check("the request body carries the declared max_tokens and thinking, "
          "and no temperature when none was declared",
          body["max_tokens"] == 256
          and body["thinking"] == {"type": "disabled"}
          and "temperature" not in body, body)
    check("system is omitted from the body when declared None",
          "system" not in body, body)
    check("the documented version header is sent",
          seen[0]["headers"]["anthropic-version"] == MC.API_VERSION)


# ---------------------------------------------------------------------------
# §5  THE LAYERS ARE DISTINGUISHABLE
# ---------------------------------------------------------------------------

def test_every_error_kind_is_told_apart():
    print("\n§5  the error kinds are distinguishable, by class and by layer")

    def boom():
        raise OSError("connection reset by peer")

    # TRANSPORT — raised BELOW http. Wrapped, and the cause is kept.
    def dead(url, b, h, t):
        try:
            boom()
        except Exception as e:                   # noqa: BLE001
            raise MC.TransportFailure(f"stub transport is dead: {e}", cause=e)
    e_transport = raises(lambda: live(transport=dead)("p"),
                         MC.TransportFailure)

    # SERVICE / retryable — 429 with the server's own retry-after.
    e_rate = raises(
        lambda: live(transport=stub(429, b'{"type":"error","error":'
                                         b'{"type":"rate_limit_error"}}',
                                    {"retry-after": "12"}))("p"),
        MC.RateLimited)

    # SERVICE / terminal — a key was sent and rejected.
    e_service = raises(
        lambda: live(transport=stub(
            401, b'{"type":"error","error":{"type":"authentication_error",'
                 b'"message":"bad key"},"request_id":"req_1"}'))("p"),
        MC.ServiceRefused)

    # CONTRACT — a 200 that is not the documented shape.
    e_malformed = raises(lambda: live(transport=stub(200, b"<html>nope"))("p"),
                         MC.MalformedResponse)

    # CONTRACT — a 200 that is well-formed and INCOMPLETE.
    e_trunc = raises(
        lambda: live(transport=stub(200, ok_body("half a li",
                                                 stop="max_tokens")))("p"),
        MC.Truncated)

    # MODEL — a 200 carrying a decision.
    refusal = json.dumps({"content": [], "stop_reason": "refusal",
                          "stop_details": {"type": "refusal",
                                           "category": "cyber"}}).encode()
    e_model = raises(lambda: live(transport=stub(200, refusal))("p"),
                     MC.ModelRefused)

    # DECLARATION — no key.
    e_key = raises(lambda: MC.anthropic_call(model="claude-opus-5",
                                             decoding=DECL, system=None,
                                             api_key="", transport=stub()),
                   MC.KeyRefused)

    kinds = {"KeyRefused": e_key, "TransportFailure": e_transport,
             "RateLimited": e_rate, "ServiceRefused": e_service,
             "MalformedResponse": e_malformed, "Truncated": e_trunc,
             "ModelRefused": e_model}
    for name, e in kinds.items():
        check(f"{name} fires as itself",
              type(e).__name__ == name, e)

    # THE FOUR THE BRIEF NAMED, told apart pairwise. A test that only checked
    # each in isolation would pass while the module raised one class for all.
    four = [e_key, e_transport, e_rate, e_malformed]
    check("the four named kinds are four DIFFERENT classes",
          len({type(x) for x in four}) == 4,
          [type(x).__name__ for x in four])
    check("every one of them is a ModelCallError, so a caller may catch the "
          "family without losing the distinction",
          all(isinstance(x, MC.ModelCallError) for x in four))
    check("their layers are DECLARATION / TRANSPORT / SERVICE / CONTRACT",
          [x.layer for x in four]
          == ["DECLARATION", "TRANSPORT", "SERVICE", "CONTRACT"],
          [x.layer for x in four])
    check("every layer used is in the closed vocabulary",
          all(x.layer in MC.LAYERS for x in kinds.values()))

    # The two that SHARE a layer have opposite remedies, which is why they are
    # two classes and not one.
    check("RateLimited and ServiceRefused share the SERVICE layer and differ "
          "on `retryable` — waiting is right for one and wrong for the other",
          e_rate.layer == e_service.layer == "SERVICE"
          and e_rate.retryable is True and e_service.retryable is False)
    check("MalformedResponse is never retryable — retrying reruns the same "
          "misunderstanding", e_malformed.retryable is False)

    # Each carries the evidence its own remedy needs.
    check("RateLimited carries the SERVER'S retry-after and does not invent "
          "one", e_rate.retry_after == 12.0, e_rate.retry_after)
    check("a 429 with no retry-after says so rather than guessing",
          "does not invent" in str(raises(
              lambda: live(transport=stub(429, b"{}"))("p"), MC.RateLimited)))
    check("ServiceRefused carries the status, the API error type and the "
          "request id",
          (e_service.status, e_service.api_error_type,
           e_service.request_id) == (401, "authentication_error", "req_1"))
    check("a 401 says explicitly that it is NOT KeyRefused — a key was sent "
          "and rejected", "different event from KeyRefused" in str(e_service))
    check("TransportFailure keeps the underlying cause",
          isinstance(e_transport.cause, OSError))
    check("Truncated carries the partial and never returns it as the answer",
          e_trunc.partial == "half a li"
          and e_trunc.max_tokens == 256)
    check("ModelRefused carries the service's own category",
          e_model.category == "cyber")
    check("a refusal is read from stop_reason BEFORE content — an empty "
          "content list becomes a named event, not an IndexError",
          isinstance(e_model, MC.ModelRefused))

    # A 200 of thinking blocks only: well-formed, no text, and the message
    # says what that means rather than returning "".
    thinking_only = json.dumps(
        {"content": [{"type": "thinking", "thinking": ""}],
         "stop_reason": "end_turn"}).encode()
    e = raises(lambda: live(transport=stub(200, thinking_only))("p"),
               MC.MalformedResponse)
    check("a 200 with thinking blocks and no text refuses, naming the block "
          "types present rather than returning an empty string",
          isinstance(e, MC.MalformedResponse) and "thinking" in str(e))

    # A transport that breaks its own contract is a CONTRACT failure too.
    e = raises(lambda: live(transport=lambda *a: "nope")("p"),
               MC.MalformedResponse)
    check("a transport returning the wrong shape is caught and named",
          isinstance(e, MC.MalformedResponse))


# ---------------------------------------------------------------------------
# §6  RECORD -> REPLAY
# ---------------------------------------------------------------------------

#: Deliberately not ASCII. This repo's corpora are Welsh, Persian, Finnish and
#: Middle Chinese; a recording that mangles them replays a different text.
UNICODE_ANSWER = "Mae'r nos yn hir — شب دراز است — 登鸛雀樓 — hyvää yötä\n\ttab"


def test_record_then_replay_round_trips():
    print("\n§6  record -> replay round-trips byte-identically")

    tmp = tempfile.mkdtemp(prefix="model_call_")
    try:
        path = os.path.join(tmp, "run.jsonl")
        answers = {"a": "first answer", "b": UNICODE_ANSWER,
                   "c": "third answer"}

        def by_prompt(url, body, headers, timeout):
            p = json.loads(body.decode())["messages"][0]["content"]
            return 200, {}, ok_body(answers[p])

        call = live(transport=by_prompt, record=path)
        got_live = [call(p) for p in ("a", "b", "c")]

        r = MC.replay(path)
        got_replay = [r(p) for p in ("a", "b", "c")]
        check("replay returns the recorded answers, byte-identically",
              got_replay == got_live == [answers[p] for p in "abc"],
              got_replay)
        check("the non-ASCII answer survives the round trip as itself",
              got_replay[1] == UNICODE_ANSWER
              and len(got_replay[1]) == len(UNICODE_ANSWER))

        # ORDER-INDEPENDENT: keyed by prompt, not by call index.
        r2 = MC.replay(path)
        check("replay is keyed by PROMPT, not by call order — visiting the "
              "lines in another order still returns the right answers",
              [r2("c"), r2("a"), r2("b")]
              == [answers["c"], answers["a"], answers["b"]])

        # The recording is a plain, readable file with a header.
        head, rows = MC.read_recording(path)
        check("the recording carries a header naming its coordinates",
              head["kind"] == MC.RECORDING_KIND
              and head["coordinates"]["model"] == "claude-opus-5")
        check("the header quotes the non-reproducibility sentence, so a "
              "reader of the file alone learns what it is conditional on",
              "NOT A FUNCTION" in head["coordinates"]["not_reproducible"])
        check("one row per answer, each with its prompt hash and attempt "
              "count",
              len(rows) == 3 and all(r_["attempts"] == 1 for r_ in rows)
              and all(r_["prompt_sha256"] for r_ in rows))

        # BYTE-IDENTICAL FILES from two runs of the same stubbed work. This is
        # doctrine 66 at the file level: nothing here is ordered by a set's
        # iteration, so the artefact is stable.
        p2 = os.path.join(tmp, "run2.jsonl")
        call2 = live(transport=by_prompt, record=p2)
        for p in ("a", "b", "c"):
            call2(p)
        a = open(path, "rb").read()
        b = open(p2, "rb").read()
        check("two recordings of the same stubbed run are byte-identical "
              "FILES", a == b, f"{len(a)} vs {len(b)} bytes")

        # Appending under DIFFERENT coordinates refuses.
        other = MC.Decoding(max_tokens=99, temperature=None,
                            thinking="disabled", source="a different run")
        e = raises(lambda: live(transport=by_prompt, decoding=other,
                                record=path), MC.RecordingCorrupt)
        check("appending to a recording made under different coordinates "
              "refuses — half a file from each of two writers is "
              "unattributable", isinstance(e, MC.RecordingCorrupt), e)

        # Appending under the SAME coordinates continues the file.
        call3 = live(transport=by_prompt, record=path)
        call3("a")
        _h, rows2 = MC.read_recording(path)
        check("appending under the same coordinates continues the numbering",
              len(rows2) == 4 and rows2[-1]["n"] == 3, len(rows2))

        # An unrecorded run writes nothing.
        call4 = live(transport=by_prompt)
        call4("a")
        check("record= is opt-in: an adapter built without it holds no "
              "recorder", call4.recorder is None)
        check("stats count calls and attempts and accumulate usage",
              call4.stats["calls"] == 1 and call4.stats["attempts"] == 1
              and call4.stats["output_tokens"] == 7, call4.stats)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------------------
# §7  REPLAY REFUSES RATHER THAN INVENTING
# ---------------------------------------------------------------------------

def test_replay_refuses_rather_than_inventing():
    print("\n§7  a replay returns what was recorded, or refuses")

    tmp = tempfile.mkdtemp(prefix="model_call_")
    try:
        path = os.path.join(tmp, "run.jsonl")
        box = {"n": 0}

        def twice(url, body, headers, timeout):
            box["n"] += 1
            return 200, {}, ok_body(f"answer {box['n']}")

        call = live(transport=twice, record=path)
        call("same prompt")
        call("same prompt")

        r = MC.replay(path)
        check("one prompt recorded twice replays in RECORDED ORDER",
              [r("same prompt"), r("same prompt")] == ["answer 1", "answer 2"])

        e = raises(lambda: r("same prompt"), MC.ReplayMiss)
        check("a third ask REFUSES rather than repeating the last answer",
              isinstance(e, MC.ReplayMiss), e)
        check("the exhaustion message says how many were recorded for THIS "
              "prompt", isinstance(e, MC.ReplayMiss) and "2 answer(s)"
              in str(e), str(e)[:200])

        e = raises(lambda: r("a prompt nobody recorded"), MC.ReplayMiss)
        check("an unrecorded prompt refuses and names its hash",
              isinstance(e, MC.ReplayMiss) and "PROMPT SHA" in str(e))
        check("the refusal states the rule — never a nearby answer",
              "never returns a nearby answer" in str(e))
        check("a ReplayMiss is in the RECORDING layer",
              e.layer == "RECORDING")

        # An EDITED recording is refused outright rather than replayed.
        edited = os.path.join(tmp, "edited.jsonl")
        lines = open(path, encoding="utf-8").read().rstrip("\n").split("\n")
        row = json.loads(lines[1])
        row["prompt"] = "a prompt somebody swapped in later"
        lines[1] = json.dumps(row, ensure_ascii=False, sort_keys=True)
        open(edited, "w", encoding="utf-8", newline="\n").write(
            "\n".join(lines) + "\n")
        e = raises(lambda: MC.replay(edited), MC.RecordingCorrupt)
        check("a recording whose prompt no longer matches its own hash is "
              "REFUSED — replaying it would be a fabricated measurement",
              isinstance(e, MC.RecordingCorrupt)
              and "fabricated" in str(e), e)

        # A file that is not a recording at all.
        junk = os.path.join(tmp, "junk.jsonl")
        open(junk, "w", encoding="utf-8").write("not json\n")
        check("a non-recording file refuses by name",
              isinstance(raises(lambda: MC.replay(junk),
                                MC.RecordingCorrupt), MC.RecordingCorrupt))
        empty = os.path.join(tmp, "empty.jsonl")
        open(empty, "w", encoding="utf-8").write("")
        e = raises(lambda: MC.replay(empty), MC.RecordingCorrupt)
        check("an empty recording refuses, because it has no header and so "
              "nothing says what produced it",
              isinstance(e, MC.RecordingCorrupt) and "header" in str(e))

        # A replay can be pinned to the coordinates the caller expected.
        head, _rows = MC.read_recording(path)
        ok = MC.replay(path, coordinates_required=head["coordinates"])
        check("replay accepts a coordinates_required that matches",
              ok("same prompt") == "answer 1")
        wrong = dict(head["coordinates"], model="claude-haiku-4-5")
        e = raises(lambda: MC.replay(path, coordinates_required=wrong),
                   MC.RecordingCorrupt)
        check("replay REFUSES a recording made by a different writer than the "
              "caller asked for", isinstance(e, MC.RecordingCorrupt), e)

        # The CLI can read a recording with no key and no network.
        env = dict(os.environ)
        env.pop(MC.KEY_ENV_VAR, None)
        rr = subprocess.run(
            [sys.executable, "quality/model_call.py", "--replay", path],
            cwd=os.path.join(HERE, ".."), capture_output=True, text=True,
            env=env, timeout=120)
        check("`model_call.py --replay PATH` summarises a recording, exit 0, "
              "no key", rr.returncode == 0 and "answers" in rr.stdout,
              f"rc={rr.returncode} {rr.stdout.strip()[:120]!r}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------------------
# §8  THE KEY NEVER LEAKS
# ---------------------------------------------------------------------------

def test_the_key_never_appears_anywhere_it_could_be_read():
    print("\n§8  the key stays out of every artefact this module produces")

    KEY = "sk-ant-THIS-IS-THE-SECRET-0123456789"
    tmp = tempfile.mkdtemp(prefix="model_call_")
    try:
        path = os.path.join(tmp, "run.jsonl")
        seen = []
        call = live(api_key=KEY, transport=stub(seen=seen), record=path)
        call("a prompt")

        check("the key IS sent on the wire (the test is not vacuous)",
              seen[0]["headers"]["x-api-key"] == KEY)
        check("the key is not in repr(call)", KEY not in repr(call))
        check("the key is not in coordinates()",
              KEY not in json.dumps(call.coordinates()))
        check("the key is not in the recording file",
              KEY not in open(path, encoding="utf-8").read())

        e = raises(lambda: live(api_key=KEY,
                                transport=stub(401, b'{"error":{}}'))("p"),
                   MC.ServiceRefused)
        check("the key is not in a ServiceRefused message",
              KEY not in str(e))
        e2 = raises(lambda: MC.anthropic_call(model="claude-opus-5",
                                              decoding=DECL, system=None,
                                              api_key="", transport=stub()),
                    MC.KeyRefused)
        check("the refusal message names the VARIABLE, never a value",
              MC.KEY_ENV_VAR in str(e2) and "sk-" not in str(e2))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------------------
# §9  RETRIES ARE A DECLARED COORDINATE
# ---------------------------------------------------------------------------

def test_retries_are_declared_and_layer_aware():
    print("\n§9  a retry is a SECOND SAMPLE, so it is declared, not default")

    def rate_then_ok():
        return 429, {"retry-after": "0"}, b'{"error":{}}'

    # Default: no retry at all.
    e = raises(lambda: live(transport=sequence_transport(
        [rate_then_ok, (200, {}, ok_body("recovered"))]))("p"),
        MC.RateLimited)
    check("retries default to 0 — a 429 raises rather than quietly drawing a "
          "second sample", isinstance(e, MC.RateLimited), e)

    # Declared: retried, and the attempt count is honest.
    c = live(transport=sequence_transport(
        [rate_then_ok, (200, {}, ok_body("recovered"))]), retries=2)
    check("retries=2 rides out the 429 and returns the answer",
          c("p") == "recovered")
    check("the adapter counts 2 attempts for 1 call",
          (c.stats["attempts"], c.stats["calls"]) == (2, 1), c.stats)

    # A NON-retryable layer is not retried, however many are allowed.
    n = {"i": 0}

    def count_401(url, b, h, t):
        n["i"] += 1
        return 401, {}, b'{"error":{"type":"authentication_error"}}'
    e = raises(lambda: live(transport=count_401, retries=5)("p"),
               MC.ServiceRefused)
    check("a 401 is NOT retried even at retries=5 — retrying a rejected key "
          "is spending money on the same answer",
          isinstance(e, MC.ServiceRefused) and n["i"] == 1, n["i"])

    e = raises(lambda: live(transport=stub(200, b"<html>"), retries=5)("p"),
               MC.MalformedResponse)
    check("a malformed 200 is NOT retried either",
          isinstance(e, MC.MalformedResponse))

    # The thrown-away sample reaches the recording, so a reader can see it.
    tmp = tempfile.mkdtemp(prefix="model_call_")
    try:
        path = os.path.join(tmp, "run.jsonl")
        c = live(transport=sequence_transport(
            [rate_then_ok, (200, {}, ok_body("recovered"))]),
            retries=2, record=path)
        c("p")
        _h, rows = MC.read_recording(path)
        check("the recording says the answer took 2 attempts — a run that "
              "drew twice does not read as a run that drew once",
              rows[0]["attempts"] == 2, rows[0])
        check("retries is in the recorded coordinates",
              _h["coordinates"]["retries"] == 2)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    check("nothing in this run reached the real transport",
          NETWORK_TOUCHED == [], NETWORK_TOUCHED)


if __name__ == "__main__":
    for fn in (test_no_network_and_no_key,
               test_missing_key_refuses_and_does_not_fall_back,
               test_coordinates_must_be_declared,
               test_model_decoding_pair_refuses_before_a_round_trip,
               test_every_error_kind_is_told_apart,
               test_record_then_replay_round_trips,
               test_replay_refuses_rather_than_inventing,
               test_the_key_never_appears_anywhere_it_could_be_read,
               test_retries_are_declared_and_layer_aware):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all model_call regressions pass")

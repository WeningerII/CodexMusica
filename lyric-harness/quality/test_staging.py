#!/usr/bin/env python3
"""REGRESSION TESTS for the staged-download policy.

    python3 quality/test_staging.py

WHY THIS FILE EXISTS. Run #1195's `verify` job died at "Stage the
pronunciation dictionary" with `ConnectionResetError: [Errno 104]` inside a
TLS handshake -- a whole CI run lost to one reset, in a step that had not
begun any test. The fetch had no retry, and the `suites` shard matrix landed
the same week took the number of jobs performing that unretried download from
5 to 8 per run, so the sharding made the failure MORE likely rather than less.

Two defects, and the second is the one nobody had seen:

  1. NO RETRY. One transport failure was fatal to a job whose work had not
     started.
  2. NO ATOMICITY. `urllib.request.urlretrieve` writes straight to the
     destination, so a transfer that died part-way left a TRUNCATED file at
     the path every later run tests with `os.path.exists` and trusts -- a
     half-downloaded pronunciation dictionary silently becoming the lexicon.
     On CI each job is a fresh runner so it never bit; on a developer machine
     it persists, which is the shape this repo calls a latent defect.

These drive the SHIPPED helper, `lyric_harness.download_to`, through an
injected opener -- never a copy of its control flow. A test that
re-implemented the retry would go green against a helper that had stopped
retrying, which is the whole point.
"""

from __future__ import annotations

import http.client
import io
import os
import sys
import tempfile
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import lyric_harness as LH  # noqa: E402

_FAILURES = []


def check(name, ok, detail=""):
    print("  [%s] %s%s" % ("ok  " if ok else "FAIL", name,
                           "" if ok else "   " + detail))
    if not ok:
        _FAILURES.append(name)


class _Body(io.BytesIO):
    """A urlopen() result: a readable context manager over fixed bytes."""

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
        return False


class _DyingBody(_Body):
    """A body that hands over `cut` bytes and THEN resets.

    THIS CLASS IS THE POINT OF SECTION 5 AND ITS ABSENCE WAS A VACUOUS TEST.
    The first draft of this suite raised only from `urlopen` itself, so the
    destination was never opened and "no file at dest" passed against a
    helper that wrote straight to it -- the exact mutation the section
    claims to kill, surviving. A truncation needs a transfer that STARTS:
    the connection is up, bytes are moving, and it dies part-way.
    """

    def __init__(self, payload, cut):
        super().__init__(payload)
        self._cut = cut
        self._sent = 0

    def read(self, n=-1):
        if self._sent >= self._cut:
            raise ConnectionResetError(104, "Connection reset by peer")
        take = self._cut - self._sent if n is None or n < 0 else min(
            n, self._cut - self._sent)
        chunk = super().read(take)
        self._sent += len(chunk)
        return chunk


def _opener(script, payload=b"AARDVARK  AA1 R D V AA2 R K\n"):
    """-> (fn, calls) where `script` is what each attempt does.

    An entry is an exception INSTANCE to raise or None to succeed. The list
    `calls` records the url of every attempt, so a test asserts how many
    times the helper actually reached the network rather than inferring it.
    """
    calls = []

    def fn(url, timeout=None):
        i = len(calls)
        calls.append(url)
        act = script[i] if i < len(script) else None
        if isinstance(act, int):       # die mid-body, after `act` bytes
            return _DyingBody(payload, act)
        if act is not None:
            raise act
        return _Body(payload)

    return fn, calls


def _run(script, attempts=None, payload=b"XYZ\n"):
    """-> (raised, bytes_at_dest, part_left, calls, waits) on a temp dest."""
    fn, calls = _opener(script, payload)
    waits = []
    with tempfile.TemporaryDirectory() as d:
        dest = os.path.join(d, "staged.dict")
        real = LH.urllib.request.urlopen
        LH.urllib.request.urlopen = fn
        raised = None
        try:
            kw = {} if attempts is None else {"attempts": attempts}
            LH.download_to("https://example.invalid/x", dest,
                           sleep=waits.append, **kw)
        except Exception as err:            # noqa: BLE001 - the subject
            raised = err
        finally:
            LH.urllib.request.urlopen = real
        got = open(dest, "rb").read() if os.path.exists(dest) else None
        part = os.path.exists(dest + ".part")
    return raised, got, part, calls, waits


def _reset():
    return ConnectionResetError(104, "Connection reset by peer")


def _http(code):
    return urllib.error.HTTPError("https://example.invalid/x", code,
                                  "no", {}, None)


# ---------------------------------------------------------------------------
# 1. A transient reset is retried, and the fetch succeeds
# ---------------------------------------------------------------------------


def test_a_reset_is_retried():
    print("\n1. a transport failure is retried rather than fatal")

    raised, got, part, calls, waits = _run([_reset(), _reset(), None],
                                           payload=b"HELLO\n")
    check("two resets then success raises nothing", raised is None,
          "raised %r" % (raised,))
    check("...and the third attempt is the one that ran", len(calls) == 3,
          "%d attempt(s)" % len(calls))
    check("...and the destination holds the WHOLE body", got == b"HELLO\n",
          "got %r" % (got,))
    check("...and no `.part` file is left behind", not part)

    # The control that stops this passing against a helper that retries
    # unconditionally: with the FIRST attempt succeeding there must be
    # exactly one call and no wait at all.
    raised, got, part, calls, waits = _run([None], payload=b"HELLO\n")
    check("a first-attempt success costs ONE call and ZERO waits",
          raised is None and len(calls) == 1 and waits == [],
          "calls %d waits %r" % (len(calls), waits))


# ---------------------------------------------------------------------------
# 2. The waits are the declared sequence, and the attempts the declared count
# ---------------------------------------------------------------------------


def test_the_policy_is_the_declared_one():
    print("\n2. the attempts and the backoff are READ off the declaration")

    script = [_reset()] * (LH.DOWNLOAD_ATTEMPTS + 2)
    raised, got, part, calls, waits = _run(script)
    check("a permanently reset host is tried exactly DOWNLOAD_ATTEMPTS times",
          len(calls) == LH.DOWNLOAD_ATTEMPTS,
          "%d against %d" % (len(calls), LH.DOWNLOAD_ATTEMPTS))
    check("...and waits DOWNLOAD_BACKOFF_S between them, in order",
          tuple(waits) == tuple(LH.DOWNLOAD_BACKOFF_S),
          "%r against %r" % (waits, LH.DOWNLOAD_BACKOFF_S))
    check("...which is one fewer wait than attempts — the waits SEPARATE the "
          "attempts and are never summed into a 'timeout' (doctrine 79)",
          len(waits) == len(calls) - 1,
          "%d waits, %d calls" % (len(waits), len(calls)))

    # `attempts=` is a real parameter and not decoration.
    raised, got, part, calls, waits = _run([_reset()] * 5, attempts=2)
    check("an explicit attempts= is honoured", len(calls) == 2,
          "%d attempt(s)" % len(calls))


# ---------------------------------------------------------------------------
# 3. Exhaustion raises DownloadFailed, with the transport error CHAINED
# ---------------------------------------------------------------------------


def test_exhaustion_is_its_own_answer():
    print("\n3. four resets running is a different answer from one")

    err = _reset()
    raised, got, part, calls, waits = _run([err] * 6)
    check("exhaustion raises DownloadFailed, not the raw transport error",
          isinstance(raised, LH.DownloadFailed), "raised %r" % (raised,))
    check("...and the final transport error is CHAINED, so nothing is lost",
          isinstance(getattr(raised, "__cause__", None), ConnectionResetError),
          "cause %r" % (getattr(raised, "__cause__", None),))
    check("...and the message names how many attempts were spent",
          bool(raised) and str(LH.DOWNLOAD_ATTEMPTS) in str(raised),
          "message %r" % (str(raised) if raised else None))


# ---------------------------------------------------------------------------
# 4. A 404 is the server's ANSWER and is not retried; a 503 is
# ---------------------------------------------------------------------------


def test_the_servers_answer_is_not_retried():
    print("\n4. a moved URL is not a flaky one")

    raised, got, part, calls, waits = _run([_http(404)] * 6)
    check("a 404 is raised on the FIRST attempt", len(calls) == 1,
          "%d attempt(s)" % len(calls))
    check("...and still as DownloadFailed, so one exception type covers "
          "every way a staging fetch can fail",
          isinstance(raised, LH.DownloadFailed), "raised %r" % (raised,))
    check("...and it waited for nothing", waits == [], "waits %r" % (waits,))

    # The contrast that makes the 404 case a RULING rather than a blanket
    # refusal to retry HTTP errors at all.
    raised, got, part, calls, waits = _run([_http(503), _http(503), None],
                                           payload=b"OK\n")
    check("a 503 IS retried and then succeeds",
          raised is None and len(calls) == 3 and got == b"OK\n",
          "raised %r calls %d got %r" % (raised, len(calls), got))

    # An `http.client` failure mid-body is transport, not an answer.
    raised, got, part, calls, waits = _run(
        [http.client.IncompleteRead(b"AA"), None], payload=b"OK\n")
    check("an IncompleteRead is retried like any other transport failure",
          raised is None and len(calls) == 2, "calls %d" % len(calls))


# ---------------------------------------------------------------------------
# 5. THE LOAD-BEARING ONE: a failed transfer leaves NO file at the destination
# ---------------------------------------------------------------------------


def test_a_failed_transfer_stages_nothing():
    print("\n5. a failed transfer leaves the destination ABSENT, never short")

    raised, got, part, calls, waits = _run([_reset()] * 6)
    check("a connection that never opens writes nothing", got is None,
          "found %r" % (got,))

    # THE CASE THAT ACTUALLY TRUNCATES, and the one the first draft of this
    # section could not see: the connection is UP, bytes are moving, and it
    # dies part-way through the body. An integer in the script means "hand
    # over this many bytes, then reset".
    big = b"".join(b"%08d\n" % i for i in range(40000))
    raised, got, part, calls, waits = _run([2048] * 6, payload=big)
    check("a transfer that dies MID-BODY leaves the destination ABSENT — not "
          "a short file every later `os.path.exists` would trust",
          got is None, "found %d byte(s)" % len(got or b""))
    check("...and no `.part` file is left for a later run to trip over",
          not part)
    check("...and it was retried like any other transport failure",
          len(calls) == LH.DOWNLOAD_ATTEMPTS,
          "%d attempt(s)" % len(calls))

    # The direction that actually bit: a body that ARRIVES must be whole, and
    # the destination must not exist until it is. Proven by writing a payload
    # bigger than one buffer so a naive write-as-you-go cannot pass by luck.
    raised, got, part, calls, waits = _run([2048, None], payload=big)
    check("a transfer retried after a mid-body death stages the COMPLETE "
          "body, byte for byte",
          got == big,
          "%d bytes against %d" % (len(got or b""), len(big)))


# ---------------------------------------------------------------------------
# 6. Both stagers read ONE policy (doctrine 1)
# ---------------------------------------------------------------------------


def test_one_policy_two_stagers():
    print("\n6. the two stagers do not each own a retry policy")

    src = open(os.path.join(HERE, "fetch_data.py"), encoding="utf-8").read()
    check("`quality/fetch_data.py` IMPORTS the shipped helper",
          "from lyric_harness import download_to" in src)
    check("...and calls it", "download_to(url, dest)" in src)
    check("...and no longer opens its own connection, which is what a second "
          "policy would have to be built on",
          "urlopen(" not in src, "still calls urlopen")

    # Identity, not spelling: the function the stager will actually run must
    # BE the one this suite just exercised.
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "_staging_probe", os.path.join(HERE, "fetch_data.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    check("...and it is the SAME function object, so the two cannot drift",
          mod.download_to is LH.download_to)

    # ON THE AST, not on the text: `download_to`'s own docstring NAMES
    # `urlretrieve` to explain the defect it replaces, and a grep cannot tell
    # a warning from a call. What must be absent is the CALL.
    import ast
    tree = ast.parse(open(os.path.join(ROOT, "lyric_harness.py"),
                          encoding="utf-8").read())
    called = {n.func.attr for n in ast.walk(tree)
              if isinstance(n, ast.Call)
              and isinstance(n.func, ast.Attribute)}
    check("`lyric_harness` CALLS `urlopen` and no longer calls `urlretrieve` "
          "— read off the AST, because the docstring names the thing it "
          "replaced and a grep cannot tell a warning from a call",
          "urlretrieve" not in called and "urlopen" in called,
          "urlretrieve %s / urlopen %s" % ("urlretrieve" in called,
                                           "urlopen" in called))


def main():
    print("=" * 78)
    print("STAGED DOWNLOADS — retried, atomic, and declared in one place")
    print("=" * 78)
    test_a_reset_is_retried()
    test_the_policy_is_the_declared_one()
    test_exhaustion_is_its_own_answer()
    test_the_servers_answer_is_not_retried()
    test_a_failed_transfer_stages_nothing()
    test_one_policy_two_stagers()
    print()
    print("=" * 78)
    if _FAILURES:
        print("FAIL — %d: %s" % (len(_FAILURES), ", ".join(_FAILURES)))
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())

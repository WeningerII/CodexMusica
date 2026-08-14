#!/usr/bin/env python3
"""The `callable(prompt) -> str` a proposer needs, and the boundary around it.

WHAT THIS FILE IS FOR

`quality/propose.py`'s `ModelProposer(call)` takes a `callable(prompt: str) ->
str` and deliberately contains no network code, so that the thing which WRITES
and the thing which GRADES stay separable and the grader can be tested with a
stub. That callable has to come from somewhere. This is it: the one place in
`quality/` that talks to a model, and the only file in this package that opens
a socket.

It is written to the same rule as everything else here — **a coordinate that
changes the answer must be named by whoever chose it** — and to one more rule
that only applies once a model is in the loop: **a measurement that involved a
model is not reproducible unless the model's answers were recorded.** Doctrine
66 says a tie broken by iterating a set is a result that does not reproduce. A
model is that failure mode with the volume turned up: it is not a function,
identical inputs do not give identical outputs, and no amount of care at this
call site changes that. So the deliverable is not "a reliable model call" —
there is no such object. The deliverable is a call that STATES ITS COORDINATES,
REFUSES BY NAME rather than degrading, and can be REPLAYED FROM A FILE.

    call   = anthropic_call(model=..., decoding=..., system=..., record=PATH)
    call   = replay(PATH)          # the same callable, no key, no network

The second line is the point of the first.

THE FOUR RULES THIS FILE OBEYS

1. **No network at import, and no network in any default path.** Importing this
   module opens nothing, reads no environment variable for a key, and resolves
   no hostname. `python3 quality/model_call.py` prints a report and exits 0
   without a socket. A test suite and a CI run cannot make an API call by
   accident, because the only object that can make one is constructed
   explicitly by a caller who typed its name. The transport itself is a
   PARAMETER (`transport=`), so a test substitutes it rather than trusting a
   monkeypatch to have landed.

2. **A missing key REFUSES; it never falls back.** `lyric_harness.py`'s
   `--fallback=bogus` handling is the shape copied here: a message that names
   the missing thing and exit 2, never a shrug and never a quietly worse
   answer. There is no "no key, so use the stub proposer" path in this file,
   because a run that silently swapped the writer for `swap_end_word` would
   produce a measurement whose subject nobody could name afterwards. The
   refusal fires at CONSTRUCTION, not at the first call, so a caller learns
   forty minutes before the loop does.

3. **Errors name the LAYER.** A refused key, a dead socket, a 429, a 200 whose
   body is not what the contract says, a model that declined, and a recording
   with no answer for this prompt are SIX different events with six different
   remedies, and collapsing them into one `Exception` charges the wrong layer
   — the same defect `quality/METHOD.md` doctrine 79 names for putting a
   refusal in a numerator. Every exception here carries `.layer`, and
   `LAYERS` is the closed vocabulary.

4. **Nothing is written from memory.** `Model` refuses construction without a
   `source`, exactly as `fit.Subdivision` and `declared_inputs.Orthography` do,
   and for a sharper reason than either: see the next section.

WHY THE MODEL ID DESERVES THE `_Sourced` TREATMENT — the argument, since this
was a real decision and not a reflex

A `Subdivision` is sourced because a slot count written from recall is
unsourced data in the evidence base. A model id looks like a lesser thing: it
is an opaque service identifier, not a claim about the world, and it is
tempting to let it be a plain string with a sensible default.

That is wrong here, for three reasons, and the first is not hypothetical.

  a. **A model id is the coordinate MOST likely to be written from memory and
     the coordinate that changes the output MOST.** The brief that commissioned
     this file named the current models as "Claude Opus 4.5 / Sonnet 4.5 /
     Haiku 4.5". The reference this file was actually written against
     (bundled `claude-api` skill, model table cached 2026-06-24) says the
     current line is Claude Opus 5 / Sonnet 5 / Haiku 4.5 — so two of the three
     ids in a brief whose own next sentence warned against hardcoding an id
     from memory were stale. That is the exact failure the sourcing rule
     exists for, caught inside the commissioning instruction for the file that
     implements the rule. It is recorded here rather than quietly corrected.

  b. **An id is not a version pin, so it cannot be sourced by itself.**
     `claude-opus-5` is an alias. What it resolves to on the service can move
     without the string changing, which means the id alone does not identify
     the writer of a lyric. A `source` field is where the caller says what they
     actually know — a date, a `GET /v1/models` response they read, a run they
     pinned — and `CATALOGUE`'s own entries say only that they are a dated
     snapshot of a document, which is the honest strength of that claim.

  c. **The parameter set is model-dependent in a way that fails LOUD in one
     direction and SILENT in the other.** `temperature` is not accepted by
     Claude Opus 5 / Sonnet 5 / Opus 4.8 / Opus 4.7 — it returns 400. That
     half is loud. The silent half: adaptive thinking is ON BY DEFAULT on
     Claude Opus 5 and OFF by default on Opus 4.8, so the identical request
     body spends `max_tokens` on two different things depending on a string,
     with no error either way. A bare string cannot carry that; a `Model`
     with `accepts_temperature` and `thinking_modes` can, and `check_pair()`
     turns both into a named refusal at construction instead of a 400 three
     frames down or a silently shorter lyric.

So: `Model` is `_Sourced`, `CATALOGUE` ships POPULATED (unlike
`meter.CATALOGUE` and `declared_inputs.DECLARED`, which ship empty), and it is
deliberate. An empty slot is right when the missing thing is LANGUAGE DATA that
only a scholar can supply. It is wrong here: this table is a transcription of a
vendor document, a caller cannot derive it, and shipping it empty would mean
every caller typing an id from memory — which is the failure the slot was
supposed to prevent. What ships is a table with a dated source on every row and
a constructor that refuses an undated addition.

WHICH COORDINATES MAKE A RUN NON-REPRODUCIBLE — read this before quoting any
number that passed through here

None of the following is fixable at this call site. They are listed so that a
result computed through this module can say what it is conditional on, the way
`fit.Isochrony.CONDITION` does.

  * **The model is not a function.** Identical `(id, prompt, max_tokens,
    system)` can return different text on two calls. No parameter available
    here removes that, and this module offers no seed, because the service
    exposes none.
  * **The one knob that used to be reached for is GONE on the current
    models.** `temperature=0` is rejected outright by Claude Opus 5 / Sonnet 5
    / Opus 4.8 / Opus 4.7 (HTTP 400), and on the models that still accept it,
    it never guaranteed identical output. So "we set temperature to zero" is
    not available as a reproducibility claim on any current model, and this
    file will refuse to let a caller write it down as if it were.
  * **Adaptive thinking is a hidden draw.** Where it is on, an unrecorded
    amount of the token budget goes to reasoning this module never sees
    (`display` defaults to omitted), and how much varies per call.
  * **An alias is not a pin.** See (b) above.
  * **A retry is a second sample.** `retries=` is 0 by default for that reason;
    a run with `retries>0` may have thrown away a first answer, so each
    recorded call carries its `attempts` count.
  * **The prompt is not the whole input.** The service's own system-side
    additions are not visible from here.

THE ONLY REPRODUCIBLE ARTEFACT IS THE RECORDING, and that is what `record=`
and `replay()` are for. A recorded run replays with no key and no network,
byte-identically, forever — and two recordings of the same stubbed run are
byte-identical FILES, because every line is `sort_keys=True` (doctrine 66
again: nothing here is ordered by a set's iteration). A measurement of this
harness that involved a model and shipped no recording is not a measurement
this repo can check, and should be read as an anecdote.

STDLIB ONLY. `urllib.request`, not `requests`; no `anthropic` SDK. CI's
`record` job asserts that boundary and `quality/declared_inputs.py` is its
written record. The cost is that retries, backoff and connection reuse are
hand-rolled and thin; that is the correct trade for one call site.

Run: python3 quality/model_call.py            # the boundary, no network
     python3 quality/model_call.py --replay PATH
     python3 quality/model_call.py --probe     # the ONLY path that dials out
"""

import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# THE LAYER VOCABULARY
#
# A caller's remedy differs per layer, which is the whole reason these are not
# one exception:
#
#   DECLARATION  nothing left this process. YOU did not supply something.
#                Fix the call site. Retrying is meaningless.
#   TRANSPORT    the request never got an answer. DNS, TLS, proxy, timeout.
#                Retrying may work; the service never saw you.
#   SERVICE      the service answered and said no. 429 is "later" (retry),
#                everything else is "no" (do not).
#   CONTRACT     a 200 arrived and does not mean what the documented shape
#                says. Retrying reruns the same misunderstanding.
#   MODEL        the model itself declined this prompt. A different prompt or
#                a different model, not a retry.
#   RECORDING    the answer was supposed to come from a file and the file does
#                not have it. Nothing to retry; re-record or fix the key.
# ---------------------------------------------------------------------------

LAYERS = ("DECLARATION", "TRANSPORT", "SERVICE", "CONTRACT", "MODEL",
          "RECORDING")


class ModelCallError(Exception):
    """Base for everything this module raises. `.layer` is in `LAYERS`."""
    layer = "DECLARATION"
    retryable = False


class KeyRefused(ModelCallError):
    """No API key was declared. NOT a reason to fall back to something worse.

    The same shape as `lyric_harness.py`'s `--fallback=bogus`: a message that
    names the missing input, and exit 2 at a command line. This project has a
    stub proposer (`quality/loop.py`'s `swap_end_word`) and it exists to prove
    the loop's control flow, not to write a line — so silently substituting it
    for an absent model would produce output nobody could attribute. Doctrine
    20: "inconclusive by construction" is not a null.
    """
    layer = "DECLARATION"


class TransportFailure(ModelCallError):
    """The request never received an answer. The service never saw it.

    DNS, TLS, a proxy, a socket timeout, a reset. `.cause` is the underlying
    exception, unwrapped, because "connection failed" without the reason is the
    same information loss this module exists to prevent one level up.
    """
    layer = "TRANSPORT"
    retryable = True

    def __init__(self, message, cause=None):
        self.cause = cause
        super().__init__(message)


class RateLimited(ModelCallError):
    """The service said LATER — HTTP 429, or 529 overloaded.

    Distinct from `ServiceRefused` because the remedy is opposite: this one is
    the only status where waiting is the correct response. `.retry_after` is
    the server's own figure in seconds when it sent one, and None when it did
    not — never a guess, because a made-up backoff is a threshold nobody wrote
    down (doctrine 58).
    """
    layer = "SERVICE"
    retryable = True

    def __init__(self, message, status=429, retry_after=None):
        self.status = status
        self.retry_after = retry_after
        super().__init__(message)


class ServiceRefused(ModelCallError):
    """The service answered and said NO — 400/401/403/404/413/5xx.

    `.status` and `.api_error_type` carry the service's own words. 401 here is
    NOT the same event as `KeyRefused`: a key was supplied and rejected, which
    is a fact about the key rather than about the call site.
    """
    layer = "SERVICE"

    def __init__(self, message, status=None, api_error_type="",
                 request_id=""):
        self.status = status
        self.api_error_type = api_error_type
        self.request_id = request_id
        super().__init__(message)


class MalformedResponse(ModelCallError):
    """A 200 arrived and is not the documented shape.

    Not JSON, no `content`, no text block in it, or a recording line that does
    not parse. Retrying reruns the same misunderstanding, so this is the one
    HTTP-adjacent failure that is never `retryable`.
    """
    layer = "CONTRACT"


class Truncated(ModelCallError):
    """The answer stopped at `max_tokens` and is therefore INCOMPLETE.

    A separate name because handing a half-written line to the grader as if it
    were the model's line is a wrong answer delivered confidently — the failure
    this whole package is organised against. The remedy (raise `max_tokens`) is
    nothing like the remedy for a malformed body, so it is not that error.
    `.partial` carries what did arrive, for a caller who wants to look; nothing
    in this module ever returns it as the answer.
    """
    layer = "CONTRACT"

    def __init__(self, message, partial="", max_tokens=None):
        self.partial = partial
        self.max_tokens = max_tokens
        super().__init__(message)


class ModelRefused(ModelCallError):
    """`stop_reason == "refusal"` — the model declined, at HTTP 200.

    A successful request carrying a decision, not a failure of any layer below
    it, and the reference is explicit that `stop_reason` must be read BEFORE
    `content` because the content array may be empty or partial. `.category` is
    the service's own label when it sent one.
    """
    layer = "MODEL"

    def __init__(self, message, category="", stop_reason="refusal"):
        self.category = category
        self.stop_reason = stop_reason
        super().__init__(message)


class RecordingError(ModelCallError):
    """Base for the two things a recording can fail at."""
    layer = "RECORDING"


class ReplayMiss(RecordingError):
    """This recording has no (remaining) answer for this prompt.

    A REFUSAL, and deliberately not a fallback: replaying a run means the model
    is not here, so there is nothing to ask, and returning a nearby prompt's
    answer or repeating the last one would be a fabricated measurement. The
    message names the prompt's hash and how many answers the recording holds,
    so the two ordinary causes — the prompt changed, or the loop asked more
    times than the recording covers — are distinguishable on sight.
    """


class RecordingCorrupt(RecordingError):
    """The recording file is not the shape this module writes."""


# ---------------------------------------------------------------------------
# THE DECLARED COORDINATES
# ---------------------------------------------------------------------------


class _Sourced:
    """Every declaration here refuses at construction without a `source`.

    Same rule and same wording as `quality/fit.py` and
    `quality/declared_inputs.py`. These objects are passed straight into a call
    that spends money and produces text a measurement will rest on, so the
    check has to be at construction or it can be walked around.
    """

    def _check_source(self):
        if not getattr(self, "source", ""):
            raise ValueError(
                f"{type(self).__name__} has no source. Say where the "
                f"coordinate came from — a vendor document and the date you "
                f"read it, a `GET /v1/models` response, a run you pinned — or "
                f"leave the slot empty and take the refusal. A model id typed "
                f"from memory is the single most likely unsourced coordinate "
                f"in this file; the brief that commissioned it got two of "
                f"three wrong.")


@dataclass(frozen=True)
class Model(_Sourced):
    """WHICH writer, and what its request surface will and will not accept.

    `id` is the wire string. `source` is where the id AND the two capability
    flags came from — they travel together, because a flag read off one vendor
    document and an id read off another is a row that describes no real model.

    `accepts_temperature`  False means the parameter returns HTTP 400 on this
                           model. Not "is ignored" — rejected. Checked here so
                           the refusal names the model instead of arriving as
                           an opaque 400 from inside `_post`.
    `thinking_modes`       the legal values of `Decoding.thinking` for this id.
                           `None` in the tuple means "omit the parameter", and
                           omitting it does NOT mean the same thing on every
                           model — see `thinking_when_omitted`, which is the
                           silent half of the trap this field exists for.
    `thinking_when_omitted` what the service does with no `thinking` field.
                           Carried explicitly because it differs across ids
                           that otherwise look interchangeable.
    `max_output_tokens`    the ceiling `Decoding.max_tokens` is checked against
                           locally, so a typo refuses here rather than at the
                           service.
    """
    id: str
    source: str = ""
    accepts_temperature: bool = False
    thinking_modes: tuple = (None,)
    thinking_when_omitted: str = "unknown"
    max_output_tokens: int = 0
    note: str = ""

    def __post_init__(self):
        self._check_source()
        if not self.id:
            raise ValueError("a Model must have an id")
        if not self.thinking_modes:
            raise ValueError(
                f"{self.id}: thinking_modes is empty, so no Decoding could "
                f"ever be valid for this model. State at least (None,).")
        if self.max_output_tokens < 1:
            raise ValueError(
                f"{self.id}: max_output_tokens must be a real ceiling. It is "
                f"what makes an over-large max_tokens refuse HERE, by name, "
                f"instead of as a 400 with the model id buried in it.")

    def describe(self):
        t = "accepts temperature" if self.accepts_temperature else (
            "REJECTS temperature (HTTP 400)")
        modes = ", ".join("omitted" if m is None else m
                          for m in self.thinking_modes)
        return (f"{self.id}\n"
                f"    {t}; thinking modes: {modes}; omitted means "
                f"{self.thinking_when_omitted}\n"
                f"    max output {self.max_output_tokens}\n"
                f"    source: {self.source}"
                + (f"\n    note: {self.note}" if self.note else ""))


#: A DATED SNAPSHOT, and it says so on every row.
#:
#: Populated rather than empty, unlike `meter.CATALOGUE` and
#: `declared_inputs.DECLARED` — the module docstring argues why. In one line:
#: an empty slot is right when the missing thing is language data a caller
#: cannot derive, and wrong when it is a vendor's transcription that every
#: caller would otherwise type from memory.
#:
#: WHAT THIS SOURCE IS AND IS NOT. It is a document read at a date. It is NOT
#: a live `GET /v1/models`, which is the only thing that can say what is served
#: today, and which is deliberately not implemented here: two network paths in
#: a file whose main claim is that it has no default network path would be one
#: too many. A caller who has run that endpoint can `register_model` their own
#: row with their own source, and their row wins.
_REF = ("Anthropic claude-api reference bundled with this session's tooling; "
        "model table + migration guide, cached 2026-06-24. A dated document, "
        "not a live GET /v1/models.")

CATALOGUE = {}


def register_model(model):
    """Add or replace a catalogue row. Refuses one with no source."""
    if not isinstance(model, Model):
        raise ValueError("register_model takes a Model")
    if not model.source:
        raise ValueError(
            f"{model.id} has no source; see _Sourced. An unsourced row is "
            f"worse than an absent one, because the next reader cannot tell "
            f"it was a guess.")
    CATALOGUE[model.id] = model
    return model


def get_model(model_id):
    """-> the catalogue row, or raise naming exactly what is registered."""
    if model_id in CATALOGUE:
        return CATALOGUE[model_id]
    raise KeyRefused(
        f"no model registered as {model_id!r}.\n"
        f"  REGISTERED  {', '.join(sorted(CATALOGUE)) or 'nothing'}\n"
        f"  DECLARE     model_call.register_model(Model(id={model_id!r}, "
        f"source='<where you read this>', ...))\n"
        f"  WHY         the request surface is model-dependent — temperature "
        f"is a 400 on some ids and legal on others, and adaptive thinking is "
        f"on by default on some and off on others. An id this file has never "
        f"seen has no known surface, and guessing one is how a silently "
        f"shorter lyric gets measured as a real one.")


for _m in (
    Model(id="claude-opus-5", source=_REF,
          accepts_temperature=False,
          thinking_modes=(None, "adaptive", "disabled"),
          thinking_when_omitted="ADAPTIVE THINKING ON — unlike opus-4-8",
          max_output_tokens=128000,
          note=("thinking is on by default and max_tokens caps thinking PLUS "
                "text together, so a budget sized for text alone truncates. "
                "`disabled` is accepted only at effort high or below; this "
                "module never sends effort, so the service default (high) "
                "applies and `disabled` is legal.")),
    Model(id="claude-sonnet-5", source=_REF,
          accepts_temperature=False,
          thinking_modes=(None, "adaptive", "disabled"),
          thinking_when_omitted="ADAPTIVE THINKING ON",
          max_output_tokens=128000,
          note="non-default sampling parameters are rejected."),
    Model(id="claude-opus-4-8", source=_REF,
          accepts_temperature=False,
          thinking_modes=(None, "adaptive", "disabled"),
          thinking_when_omitted="NO THINKING — the opposite of opus-5",
          max_output_tokens=128000,
          note=("the id/default pair this file's `thinking_when_omitted` "
                "field exists for: same request body, different spend, no "
                "error either way.")),
    Model(id="claude-sonnet-4-6", source=_REF,
          accepts_temperature=True,
          thinking_modes=(None, "adaptive", "disabled"),
          thinking_when_omitted="NO THINKING",
          max_output_tokens=128000,
          note="still accepts temperature; it still guarantees nothing."),
    Model(id="claude-haiku-4-5", source=_REF,
          accepts_temperature=True,
          thinking_modes=(None,),
          thinking_when_omitted="NO THINKING",
          max_output_tokens=64000,
          note=("takes the older {type:'enabled', budget_tokens:N} thinking "
                "shape, which this module does not send; `adaptive` is "
                "therefore refused here rather than sent and 400'd.")),
):
    register_model(_m)
del _m


#: The sentinel for "the caller did not say", used where `None` is itself a
#: legal, meaningful declaration ("send no temperature", "send no system
#: prompt"). Without it, `system=None` and an omitted `system=` would be the
#: same call, and one of those is a declaration and the other is an oversight.
class _Unset:
    def __repr__(self):
        return "<unset>"


UNSET = _Unset()


@dataclass(frozen=True)
class Decoding(_Sourced):
    """The coordinates that change the TEXT. None of them has a default.

    Every field is required, including the ones whose value is `None`, because
    `None` here is a decision ("send no temperature") and this object must not
    be constructible without someone having made it. `timeout` is NOT here: it
    changes whether an answer arrives, not what the answer says, so it lives on
    the call with a stated default (see `ModelCall`).

    `thinking`  None -> the parameter is omitted, and what that MEANS is
                `Model.thinking_when_omitted`, which differs by id.
                "adaptive" / "disabled" -> sent explicitly.
    """
    max_tokens: int
    temperature: object
    thinking: object
    source: str = ""

    THINKING = (None, "adaptive", "disabled")

    def __post_init__(self):
        self._check_source()
        if int(self.max_tokens) < 1:
            raise ValueError("max_tokens must be >= 1")
        if self.thinking not in self.THINKING:
            raise ValueError(
                f"thinking must be one of {self.THINKING} (None omits the "
                f"parameter); got {self.thinking!r}")
        if self.temperature is not None:
            t = float(self.temperature)
            if not 0.0 <= t <= 1.0:
                raise ValueError("temperature must be in [0, 1], or None to "
                                 "omit the parameter entirely")

    def coordinates(self):
        return {"max_tokens": int(self.max_tokens),
                "temperature": (None if self.temperature is None
                                else float(self.temperature)),
                "thinking": self.thinking,
                "source": self.source}


def check_pair(model, decoding):
    """Refuse an impossible (model, decoding) BEFORE it costs a round trip.

    Both refusals here would otherwise arrive as an opaque HTTP 400 from inside
    `_post`, several frames from the call site that chose the value, with the
    model id buried in a vendor message. Same move as `lyric_harness.py`
    validating `--fallback` ahead of the verb rather than letting a `KeyError`
    surface three frames down.
    """
    if decoding.temperature is not None and not model.accepts_temperature:
        raise ServiceRefused(
            f"REFUSED — {model.id} does not accept `temperature` (the "
            f"parameter returns HTTP 400 on this model), and a temperature of "
            f"{decoding.temperature!r} was declared.\n"
            f"  DECLARED BY  {decoding.source}\n"
            f"  MODEL SAYS   {model.source}\n"
            f"  NOTE         temperature is not a reproducibility control on "
            f"any current model: it is rejected outright here, and where it "
            f"is still accepted it has never guaranteed identical output. "
            f"Pass temperature=None and record the run instead.",
            status=None, api_error_type="declaration_conflict")
    if decoding.thinking not in model.thinking_modes:
        legal = ", ".join("None" if m is None else repr(m)
                          for m in model.thinking_modes)
        raise ServiceRefused(
            f"REFUSED — {model.id} does not take thinking="
            f"{decoding.thinking!r}. Legal here: {legal}.\n"
            f"  MODEL SAYS   {model.source}\n"
            f"  NOTE         thinking={None!r} omits the parameter, and on "
            f"this model that means: {model.thinking_when_omitted}.",
            status=None, api_error_type="declaration_conflict")
    if int(decoding.max_tokens) > model.max_output_tokens:
        raise ServiceRefused(
            f"REFUSED — max_tokens={decoding.max_tokens} exceeds "
            f"{model.id}'s ceiling of {model.max_output_tokens}.\n"
            f"  MODEL SAYS   {model.source}",
            status=None, api_error_type="declaration_conflict")


# ---------------------------------------------------------------------------
# THE TRANSPORT SEAM
#
# One function, one signature, injectable. The default is stdlib urllib and it
# is the ONLY thing in this package that opens a socket. It returns an HTTP
# error status rather than raising it, so that every status decision lives in
# ONE place (`_read_response`) and a stub can produce a 429 by returning a
# tuple instead of by constructing an HTTPError. Failures BELOW HTTP — DNS,
# TLS, timeout, proxy — still raise, and the adapter wraps them.
# ---------------------------------------------------------------------------

#: The documented endpoint and version header, from `_REF`. `base_url` is a
#: parameter because a different base is a different service and therefore a
#: different writer; it is not read from the environment, so that a stray
#: ANTHROPIC_BASE_URL cannot silently redirect a measurement.
DEFAULT_BASE_URL = "https://api.anthropic.com"
API_VERSION = "2023-06-01"

#: Not a measurement and not a threshold — a runaway guard. It does not change
#: what the model says, only whether this process waits forever to hear it,
#: which is why it is allowed a default at all while nothing in `Decoding` is.
DEFAULT_TIMEOUT_S = 60.0


def urllib_transport(url, body, headers, timeout):
    """-> (status, headers_dict, body_bytes). Raises only BELOW HTTP.

    `urllib.request.urlopen` honours HTTPS_PROXY/no_proxy from the environment
    through its default opener, which is what this environment needs and what
    its README requires (never disable TLS verification, never unset the
    proxy). Nothing here touches either.
    """
    req = urllib.request.Request(url, data=body, headers=dict(headers),
                                 method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return int(r.status), dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        # An HTTP status IS an answer. Hand it back so the one status decision
        # in this module can make it.
        return int(e.code), dict(e.headers or {}), (e.read() or b"")
    except Exception as e:                       # noqa: BLE001 — re-raised
        raise TransportFailure(
            f"the request to {url} never received an answer: "
            f"{type(e).__name__}: {e}", cause=e)


# ---------------------------------------------------------------------------
# THE RECORDING
#
# JSON Lines. Line 0 is a header carrying the coordinates; every later line is
# one ANSWER. Written with sort_keys=True and ensure_ascii=False, so two
# recordings of the same deterministic run are byte-identical FILES (doctrine
# 66: nothing is ordered by a set's iteration) and a Welsh, Persian or Middle
# Chinese prompt survives the round trip as itself rather than as \uXXXX.
#
# A record of ANSWERS, not of ATTEMPTS: a call that refused wrote nothing, so a
# replay of this file cannot reproduce a failure. Each line carries its own
# `attempts` count so a run with retries>0 still says how many samples were
# drawn and thrown away.
# ---------------------------------------------------------------------------

RECORDING_KIND = "model_call.recording"
RECORDING_VERSION = 1


def _sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _dump(obj):
    return json.dumps(obj, ensure_ascii=False, sort_keys=True)


class Recorder:
    """Append-only prompt/response log at a CALLER-NAMED path.

    Refuses to append to a recording whose header declares DIFFERENT
    coordinates. Two coordinate sets in one file is precisely the thing that
    makes a later replay unattributable — half the answers came from one
    writer and half from another, and the file cannot say which.
    """

    def __init__(self, path, coordinates):
        self.path = str(path)
        self.coordinates = dict(coordinates)
        self.n = 0
        if os.path.exists(self.path) and os.path.getsize(self.path) > 0:
            head, calls = _read_recording_file(self.path)
            if head.get("coordinates") != self.coordinates:
                raise RecordingCorrupt(
                    f"REFUSED — {self.path} was recorded under DIFFERENT "
                    f"coordinates and appending would make it unattributable."
                    f"\n  ON FILE   {_dump(head.get('coordinates'))}"
                    f"\n  THIS RUN  {_dump(self.coordinates)}"
                    f"\n  Write a new path, or replay the existing one.")
            self.n = len(calls)
        else:
            with open(self.path, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(_dump({"kind": RECORDING_KIND,
                                "version": RECORDING_VERSION,
                                "coordinates": self.coordinates}) + "\n")

    def write(self, prompt, response, attempts=1):
        row = {"kind": "call", "n": self.n, "prompt": prompt,
               "prompt_sha256": _sha(prompt), "response": response,
               "attempts": int(attempts)}
        with open(self.path, "a", encoding="utf-8", newline="\n") as fh:
            fh.write(_dump(row) + "\n")
        self.n += 1
        return row


def _read_recording_file(path):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            lines = [ln for ln in fh.read().split("\n") if ln.strip()]
    except OSError as e:
        raise RecordingCorrupt(f"cannot read recording {path!r}: {e}")
    if not lines:
        raise RecordingCorrupt(f"recording {path!r} is empty — it has no "
                               f"header, so nothing says what produced it.")
    try:
        head = json.loads(lines[0])
    except ValueError as e:
        raise RecordingCorrupt(f"{path!r} line 1 is not JSON: {e}")
    if head.get("kind") != RECORDING_KIND:
        raise RecordingCorrupt(
            f"{path!r} is not a {RECORDING_KIND} (its header says "
            f"{head.get('kind')!r}).")
    calls = []
    for i, ln in enumerate(lines[1:], start=2):
        try:
            row = json.loads(ln)
        except ValueError as e:
            raise RecordingCorrupt(f"{path!r} line {i} is not JSON: {e}")
        if row.get("kind") != "call":
            raise RecordingCorrupt(
                f"{path!r} line {i} is kind {row.get('kind')!r}, not 'call'")
        for key in ("prompt", "response"):
            if not isinstance(row.get(key), str):
                raise RecordingCorrupt(
                    f"{path!r} line {i} has no string {key!r}")
        got = row.get("prompt_sha256")
        if got and got != _sha(row["prompt"]):
            raise RecordingCorrupt(
                f"{path!r} line {i}: prompt_sha256 disagrees with the prompt "
                f"beside it. The file has been edited; a replay from it would "
                f"be a fabricated measurement.")
        calls.append(row)
    return head, calls


def read_recording(path):
    """-> (header, [call rows]). Raises `RecordingCorrupt` rather than
    skipping a bad line, because a silently short recording replays as a
    `ReplayMiss` somewhere unrelated."""
    return _read_recording_file(path)


class Replay:
    """`callable(prompt) -> str` served from a recording. No key, no network.

    This is how an end-to-end test of the writing loop runs in CI. Keyed BY
    PROMPT, never by call order, so a caller that visits its lines in a
    different order still gets the right answers; where one prompt was recorded
    more than once, the answers come back in RECORDED ORDER on successive
    calls, and the queue REFUSES when exhausted rather than repeating the last
    one. Both of those are the same rule: a replay may return what was
    recorded, or refuse. It may never invent.
    """

    def __init__(self, path, coordinates_required=None):
        self.path = str(path)
        self.header, rows = _read_recording_file(self.path)
        self.coordinates = self.header.get("coordinates", {})
        if (coordinates_required is not None
                and self.coordinates != dict(coordinates_required)):
            raise RecordingCorrupt(
                f"REFUSED — {self.path} was recorded under coordinates that "
                f"are not the ones asked for.\n"
                f"  ON FILE   {_dump(self.coordinates)}\n"
                f"  ASKED     {_dump(dict(coordinates_required))}")
        self._queues = {}
        self._recorded = {}
        for row in rows:
            key = _sha(row["prompt"])
            self._queues.setdefault(key, []).append(row["response"])
            self._recorded[key] = self._recorded.get(key, 0) + 1
        self.rows = rows
        self.calls = 0

    def __call__(self, prompt):
        key = _sha(prompt)
        queue = self._queues.get(key)
        if not queue:
            held = self._recorded.get(key, 0)
            raise ReplayMiss(
                f"REFUSED — the recording {self.path!r} has no "
                f"{'remaining ' if held else ''}answer for this prompt.\n"
                f"  PROMPT SHA  {key}\n"
                f"  RECORDED    {held} answer(s) for this prompt; "
                f"{len(self.rows)} in the file across "
                f"{len(self._recorded)} distinct prompt(s)\n"
                f"  MEANS       either the prompt changed since the recording "
                f"was made, or the loop asked more times than the recording "
                f"covers. A replay returns what was recorded or refuses; it "
                f"never returns a nearby answer.")
        self.calls += 1
        return queue.pop(0)

    def __repr__(self):
        return (f"<Replay {self.path!r} {len(self.rows)} answers, "
                f"{self.calls} served>")


def replay(path, coordinates_required=None):
    """-> a `callable(prompt) -> str` backed by a recording. No key, no
    network. Satisfies `propose.ModelProposer(call)` exactly as a live
    adapter does."""
    return Replay(path, coordinates_required=coordinates_required)


# ---------------------------------------------------------------------------
# THE CALL
# ---------------------------------------------------------------------------

#: `api_key=FROM_ENV` reads ANTHROPIC_API_KEY at CONSTRUCTION. Reading it at
#: construction rather than at call time is the whole point of the refusal: a
#: loop that discovers the key is missing on its fortieth line has already
#: spent forty lines' worth of somebody's afternoon.
FROM_ENV = "<ANTHROPIC_API_KEY>"
KEY_ENV_VAR = "ANTHROPIC_API_KEY"


class ModelCall:
    """The live adapter. `call(prompt) -> str`, and nothing else in its shape.

    Constructing one is the act that opts into the network; importing this
    module is not, and neither is anything else in `quality/`.
    """

    def __init__(self, model, decoding, system, api_key=FROM_ENV,
                 base_url=DEFAULT_BASE_URL, timeout=DEFAULT_TIMEOUT_S,
                 transport=None, record=None, retries=0):
        self.model = model
        self.decoding = decoding
        self.system = system
        self.base_url = str(base_url).rstrip("/")
        self.timeout = float(timeout)
        self.transport = transport or urllib_transport
        self.retries = int(retries)
        if self.retries < 0:
            raise ValueError("retries must be >= 0")

        check_pair(model, decoding)

        key = os.environ.get(KEY_ENV_VAR, "") if api_key is FROM_ENV else (
            api_key)
        if not key:
            where = (f"the {KEY_ENV_VAR} environment variable"
                     if api_key is FROM_ENV else "the api_key argument")
            raise KeyRefused(
                f"REFUSED — no API key: {where} is empty.\n"
                f"  MODEL     {model.id}\n"
                f"  DECLARE   export {KEY_ENV_VAR}=..., or pass "
                f"api_key='...' explicitly\n"
                f"  INSTEAD   if you have a recording of a previous run, "
                f"`model_call.replay(PATH)` is the same callable with no key "
                f"and no network — that is what it is for.\n"
                f"  NOT DONE  this is a refusal, not a fallback. Nothing here "
                f"substitutes the mechanical stub proposer for an absent "
                f"model: it exists to prove the loop's control flow, not to "
                f"write a line, and a run that quietly swapped one for the "
                f"other would produce a measurement nobody could attribute.")
        self._key = key

        self.stats = {"calls": 0, "attempts": 0, "input_tokens": 0,
                      "output_tokens": 0}
        self.recorder = (Recorder(record, self.coordinates())
                         if record else None)

    # -- coordinates ------------------------------------------------------

    def coordinates(self):
        """Everything that changes the text, as a plain dict. This is what a
        recording's header carries and what a `Verdict.conditional_on` should
        quote. The key is not in it and never will be."""
        return {"model": self.model.id,
                "model_source": self.model.source,
                "base_url": self.base_url,
                "api_version": API_VERSION,
                "system": self.system,
                "retries": self.retries,
                "decoding": self.decoding.coordinates(),
                "not_reproducible": NOT_REPRODUCIBLE}

    def __repr__(self):
        return (f"<ModelCall {self.model.id} max_tokens="
                f"{self.decoding.max_tokens} thinking="
                f"{self.decoding.thinking!r} "
                f"{'recording' if self.recorder else 'unrecorded'}>")

    # -- the wire ---------------------------------------------------------

    def _body(self, prompt):
        body = {"model": self.model.id,
                "max_tokens": int(self.decoding.max_tokens),
                "messages": [{"role": "user", "content": prompt}]}
        if self.system is not None:
            body["system"] = self.system
        if self.decoding.temperature is not None:
            body["temperature"] = float(self.decoding.temperature)
        if self.decoding.thinking is not None:
            body["thinking"] = {"type": self.decoding.thinking}
        return _dump(body).encode("utf-8")

    def _headers(self):
        return {"content-type": "application/json",
                "anthropic-version": API_VERSION,
                "x-api-key": self._key}

    def _once(self, prompt):
        url = f"{self.base_url}/v1/messages"
        self.stats["attempts"] += 1
        out = self.transport(url, self._body(prompt), self._headers(),
                             self.timeout)
        try:
            status, headers, raw = out
        except (TypeError, ValueError):
            raise MalformedResponse(
                f"the transport returned {out!r}; the contract is "
                f"(status:int, headers:dict, body:bytes).")
        return self._read_response(int(status), dict(headers or {}),
                                   raw or b"")

    def _read_response(self, status, headers, raw):
        if status in (429, 529):
            ra = headers.get("retry-after") or headers.get("Retry-After")
            try:
                ra = float(ra) if ra is not None else None
            except (TypeError, ValueError):
                ra = None
            raise RateLimited(
                f"the service said LATER: HTTP {status}"
                + (f", retry-after {ra}s" if ra is not None else
                   ", and sent no retry-after — this module does not invent "
                   "one"),
                status=status, retry_after=ra)
        if status != 200:
            etype, emsg, rid = "", "", ""
            try:
                doc = json.loads(raw.decode("utf-8"))
                etype = str(doc.get("error", {}).get("type", ""))
                emsg = str(doc.get("error", {}).get("message", ""))
                rid = str(doc.get("request_id", ""))
            except Exception:                    # noqa: BLE001
                emsg = raw[:400].decode("utf-8", "replace")
            hint = ""
            if status == 401:
                hint = ("\n  NOTE  a key WAS sent and the service rejected "
                        "it. That is a different event from KeyRefused, "
                        "which means no key was declared at all.")
            raise ServiceRefused(
                f"the service said NO: HTTP {status} {etype or ''} "
                f"{emsg}".rstrip() + hint,
                status=status, api_error_type=etype, request_id=rid)

        try:
            doc = json.loads(raw.decode("utf-8"))
        except Exception as e:                   # noqa: BLE001
            raise MalformedResponse(
                f"HTTP 200 whose body is not JSON ({type(e).__name__}): "
                f"{raw[:200]!r}")
        if not isinstance(doc, dict):
            raise MalformedResponse(
                f"HTTP 200 whose body is a {type(doc).__name__}, not an "
                f"object")

        # stop_reason BEFORE content, per the reference: on a refusal the
        # content array may be empty or partial, so reading content[0] first
        # is how a refusal becomes an IndexError instead of a named event.
        stop = doc.get("stop_reason")
        if stop == "refusal":
            details = doc.get("stop_details") or {}
            raise ModelRefused(
                f"the model declined this prompt (stop_reason=refusal"
                + (f", category={details.get('category')!r}"
                   if details.get("category") else "") + "). "
                f"Not a transport, service or contract failure: the request "
                f"succeeded and carried a decision.",
                category=str(details.get("category") or ""))

        usage = doc.get("usage") or {}
        for k in ("input_tokens", "output_tokens"):
            try:
                self.stats[k] += int(usage.get(k, 0) or 0)
            except (TypeError, ValueError):
                pass

        content = doc.get("content")
        if not isinstance(content, list):
            raise MalformedResponse(
                f"HTTP 200 with no `content` list (keys: "
                f"{sorted(doc)[:12]}). stop_reason={stop!r}")
        parts = [b.get("text", "") for b in content
                 if isinstance(b, dict) and b.get("type") == "text"]
        text = "".join(parts)

        if stop == "max_tokens":
            raise Truncated(
                f"the answer stopped at max_tokens="
                f"{self.decoding.max_tokens} and is INCOMPLETE. Handing a "
                f"half-written line to the grader would be a wrong answer "
                f"delivered confidently, so this refuses instead. Raise "
                f"max_tokens"
                + (" — and note that on this model thinking shares the same "
                   "budget as the text (thinking="
                   f"{self.decoding.thinking!r}; omitted means "
                   f"{self.model.thinking_when_omitted})."
                   if self.decoding.thinking != "disabled" else "."),
                partial=text, max_tokens=int(self.decoding.max_tokens))

        if not parts:
            kinds = sorted({b.get("type") for b in content
                            if isinstance(b, dict)})
            raise MalformedResponse(
                f"HTTP 200 with no text block. Block types present: "
                f"{kinds or 'none'}; stop_reason={stop!r}. On a model where "
                f"thinking is on, a response of thinking blocks alone means "
                f"the whole budget went to reasoning.")
        return text

    # -- the callable ------------------------------------------------------

    def __call__(self, prompt):
        """-> the model's text. Raises a LAYER-NAMING error, never a bare one.

        Retries only what is retryable (`TransportFailure`, `RateLimited`) and
        only `retries` times, which is 0 unless declared — because a retry is a
        SECOND SAMPLE from a non-deterministic writer, not a repeat of the same
        request, and a default that quietly drew again would put an unrecorded
        choice inside every measurement. This module does not sleep between
        attempts: what a backoff should be is a threshold nobody here wrote
        down (doctrine 58), and `RateLimited.retry_after` carries the service's
        own figure for a caller who wants to wait on it.
        """
        if not isinstance(prompt, str):
            raise ValueError(f"prompt must be a str, got "
                             f"{type(prompt).__name__}")
        attempts = 0
        last = None
        while attempts <= self.retries:
            attempts += 1
            try:
                text = self._once(prompt)
            except ModelCallError as e:
                last = e
                if e.retryable and attempts <= self.retries:
                    continue
                raise
            self.stats["calls"] += 1
            if self.recorder is not None:
                self.recorder.write(prompt, text, attempts=attempts)
            return text
        raise last                                # pragma: no cover


#: Quoted into every recording header and every `coordinates()`, so that a
#: number computed through this module carries the sentence a reader needs the
#: way `fit.Isochrony.CONDITION` does. The module docstring is the long form.
NOT_REPRODUCIBLE = (
    "A MODEL IS NOT A FUNCTION. Identical coordinates can return different "
    "text, this module exposes no seed because the service offers none, "
    "temperature is REJECTED outright by the current models (and guaranteed "
    "nothing on the older ones), adaptive thinking is an unrecorded draw "
    "where it is on, and a model id is an ALIAS rather than a version pin. "
    "The only reproducible artefact is the recording written by `record=` and "
    "read by `replay()`; a measurement that passed through here without one "
    "is an anecdote.")


def anthropic_call(model, decoding, system=UNSET, api_key=FROM_ENV,
                   base_url=DEFAULT_BASE_URL, timeout=DEFAULT_TIMEOUT_S,
                   transport=None, record=None, retries=0):
    """-> a `callable(prompt) -> str` against the Anthropic Messages API.

    `model` is a `Model` or a registered id string; `decoding` is a `Decoding`.
    Both carry their own source and neither has a default, so a caller cannot
    reach this function without having named a writer and a budget.

    `system` is REQUIRED and `None` is a legal value for it. It is not
    defaulted, because a system prompt changes the text as much as the model
    does, and `system=None` (a decision) and an omitted `system=` (an
    oversight) must not be the same call.

    `timeout` is the one coordinate here with a default, and the reason it is
    allowed one is that it changes whether an answer arrives, not what the
    answer says.

    `record=PATH` writes every prompt/response pair to a caller-named JSON
    Lines file that `replay(PATH)` reads back as this same callable, with no
    key and no network. That file is the only reproducible thing this module
    can produce; see the module docstring.
    """
    if system is UNSET:
        raise ValueError(
            "anthropic_call requires `system=`. Pass system=None to declare "
            "that no system prompt is sent — that is a decision and it is "
            "spelled out, because a system prompt changes the text as much as "
            "the model does and an omitted argument must not be able to "
            "impersonate a made choice.")
    m = model if isinstance(model, Model) else get_model(model)
    if not isinstance(decoding, Decoding):
        raise ValueError(
            "anthropic_call requires a Decoding — max_tokens, temperature and "
            "thinking, each named by whoever chose them, plus a source. None "
            "of them has a default because all three change the text.")
    return ModelCall(m, decoding, system, api_key=api_key, base_url=base_url,
                     timeout=timeout, transport=transport, record=record,
                     retries=retries)


# ---------------------------------------------------------------------------
# THE REPORT
# ---------------------------------------------------------------------------


def capability_report():
    """The boundary, in one page. Opens nothing."""
    key = os.environ.get(KEY_ENV_VAR, "")
    out = ["quality/model_call.py — the one place in quality/ that can talk "
           "to a model",
           "=" * 72,
           "stdlib only (urllib.request). No network at import. No network in "
           "any",
           "default path. The adapter is constructed explicitly or it does "
           "not exist.",
           "",
           f"KEY   {KEY_ENV_VAR} is "
           + (f"SET ({len(key)} chars) — a live call is possible"
              if key else
              "NOT SET — anthropic_call() REFUSES by name (exit 2 at a "
              "command line);"),
           ]
    if not key:
        out.append("      replay(PATH) is the same callable with no key and "
                   "no network.")
    out += ["", "MODELS (a dated snapshot; a caller with a newer source "
                "registers over it)", ""]
    for mid in sorted(CATALOGUE):
        out.append("  " + CATALOGUE[mid].describe().replace("\n", "\n  "))
        out.append("")
    out += [f"ERROR LAYERS — {len(LAYERS)} layers, and one exception class "
            f"per distinct remedy", ""]
    for cls in (KeyRefused, TransportFailure, RateLimited, ServiceRefused,
                MalformedResponse, Truncated, ModelRefused, ReplayMiss,
                RecordingCorrupt):
        first = (cls.__doc__ or "").strip().split("\n")[0]
        out.append(f"  {cls.__name__:<18} [{cls.layer}"
                   + (", retryable" if cls.retryable else "") + f"]  {first}")
    out += ["", "REPRODUCIBILITY", ""]
    line = ""
    for word in NOT_REPRODUCIBLE.split():
        if len(line) + len(word) > 68:
            out.append("  " + line)
            line = ""
        line += (" " if line else "") + word
    if line:
        out.append("  " + line)
    return "\n".join(out)


__all__ = ["LAYERS", "ModelCallError", "KeyRefused", "TransportFailure",
           "RateLimited", "ServiceRefused", "MalformedResponse", "Truncated",
           "ModelRefused", "RecordingError", "ReplayMiss", "RecordingCorrupt",
           "Model", "Decoding", "CATALOGUE", "register_model", "get_model",
           "check_pair", "UNSET", "FROM_ENV", "KEY_ENV_VAR",
           "DEFAULT_BASE_URL", "DEFAULT_TIMEOUT_S", "API_VERSION",
           "urllib_transport", "Recorder", "Replay", "replay",
           "read_recording", "ModelCall", "anthropic_call",
           "NOT_REPRODUCIBLE", "capability_report"]


def _main(argv):
    args = list(argv)
    if "--replay" in args:
        i = args.index("--replay")
        if i + 1 >= len(args):
            print("  REFUSED — --replay wants a PATH")
            return 2
        try:
            r = Replay(args[i + 1])
        except ModelCallError as e:
            print(f"  REFUSED — [{e.layer}] {e}")
            return 2
        print(f"recording {r.path}")
        print(f"  answers   {len(r.rows)} across "
              f"{len(r._recorded)} distinct prompt(s)")
        print("  coordinates")
        for k in sorted(r.coordinates):
            if k == "not_reproducible":
                continue
            print(f"    {k} = {_dump(r.coordinates[k])}")
        return 0

    if "--probe" in args:
        # THE ONLY PATH IN THIS FILE THAT DIALS OUT, and it is behind a flag
        # nothing in CI passes. It exists so the refusal is demonstrable
        # rather than merely asserted.
        try:
            call = anthropic_call(
                model="claude-opus-5",
                decoding=Decoding(max_tokens=64, temperature=None,
                                  thinking="disabled",
                                  source="--probe, a liveness check only"),
                system=None)
        except ModelCallError as e:
            print(f"  REFUSED — [{e.layer}] {e}")
            return 2
        try:
            print(call("Reply with the single word: ok"))
        except ModelCallError as e:
            print(f"  REFUSED — [{e.layer}] {e}")
            return 2
        return 0

    print(capability_report())
    return 0


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))

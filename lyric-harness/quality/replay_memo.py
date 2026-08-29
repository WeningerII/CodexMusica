"""replay_memo.py — the deferred-replay grading memo (`MISSING.md` M-167).

WHAT THIS CLOSES, measured before it was designed. `--propose=defer:` resumes
a run by REPLAYING it: every call re-briefs and re-verifies the same sequence
of intermediate drafts the previous call already judged, so call N costs the
whole prefix again — flash-battery rounds 6/8 measured the ladder at ~34s to
the first question and ~15s more per folded answer, and round 9 measured
single resumes at 340-515s by answer ~6 on a larger shape, crossing the
deployed 600s tool budget by turn 6 (M-166).  The ANSWERS were never the
cost: `_defer_proposer` replays them from the record instantly.  The cost is
the loop's own grading of drafts it has graded before, in a fresh process —
or, under the connector's warm worker (M-155), in the SAME process with a
fresh `Reviser` whose instance caches started empty.

THE DESIGN IS M-155's, ONE LAYER UP.  The warm worker already keeps one
cross-request memo (`relations._WVP_MEMO`) on the argument that a memo
"keyed on declared coordinates ... answers only IDENTICAL calls" leaves
statelessness UNCHANGED at the request boundary: identical argv answers with
identical bytes whether the memo is cold or warm, and the memo can always be
re-derived by simply doing the work (a miss IS the old behaviour).  This
module extends that to the four grading calls `revise_loop` makes on its
reviser — `brief`, `verify`, `inspect`, `joint_field` — behind a delegating
proxy, so `quality/loop.py` and `quality/revise.py` move by ZERO bytes.

WHY THE KEY IS SOUND, in two halves (doctrine 1 — every assumption a
declared coordinate):

  * THE RUN KEY freezes everything that is invariant across the resumes of
    one deferred run: the verb's own argv (minus `--propose=...`, whose state
    file is the one input that GROWS between calls, and with input PATHS
    replaced by digests of their bytes — the connector hands the same draft
    through a fresh temp path every request) plus the draft bytes and the
    blueprint bytes.  Two calls sharing a run key were built from identical
    inputs by deterministic code (`revise_loop`'s own verified determinism —
    quality/loop.py's record: no set iteration in its control flow, and
    byte-identical output across three separate processes), so the mandate,
    blueprint, subdivision, declarations and rdecl knobs those calls hand to
    the reviser are identical BY CONSTRUCTION and do not need to be
    re-digested per entry.
  * THE ENTRY KEY carries exactly what varies WITHIN a run: the draft lines
    a call is about (`lines` / `before`+`after`), the `targeted` set, the
    `calls`/`exclude` words, and the profile.  A wrapper handed an argument
    shape it does not recognise BYPASSES the memo for that call — a fallback,
    never a wrong answer, the same rule the warm worker holds itself to.

Results are deep-copied on the way in AND out, so a caller that mutates what
it was handed cannot poison the store, and the store cannot leak shared
mutable state into two callers.

`LYRIC_REPLAY_MEMO=0` disables the whole module (the wrap returns the bare
reviser), mirroring `LYRIC_WORKER=0` one layer down.
"""

import copy
import hashlib
import json
import os
from collections import OrderedDict

#: The four reviser methods the loop calls whose results this module may
#: memoise.  A method not on this tuple is delegated untouched.
MEMOISED = ("brief", "verify", "inspect", "joint_field")

#: How many deferred RUNS the registry holds at once.  DERIVED, not chosen:
#: the consumer this exists for is the connector's warm worker, whose chat
#: layer declares TWO concurrent conversations (mcp/chat.js CHAT_CONCURRENCY
#: default — restated here with its argument because the harness imports
#: nothing from mcp/, the dependency runs the other way, and mcp/test.mjs
#: holds the two figures in agreement), each allowed one superseded
#: predecessor (a user who restarts their song mid-run).  2 conversations x
#: (live + superseded) = 4.  Eviction is LRU; an evicted run replays in full
#: on its next resume — slower, never wrong.
RUNS_HELD = 2 * 2


def enabled():
    """The kill switch, read per call so a test can flip it."""
    return os.environ.get("LYRIC_REPLAY_MEMO") != "0"


def _digest(data):
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def run_key(argv, input_paths=()):
    """Freeze one deferred run's invariant inputs into a registry key.

    `argv` is the verb's own argument list; `input_paths` names the files
    whose CONTENT (never whose path) identifies the run — the draft, and the
    blueprint when one exists.  Every `--propose=...` argument is dropped
    (its state file is the one input that legitimately changes between the
    resumes of one run), and every occurrence of a named input path in the
    remaining argv is replaced by that file's content digest, because the
    connector writes the same bytes through a FRESH temp path per request
    and a path-keyed run would never match itself.
    """
    digests = {}
    for p in input_paths:
        if not p:
            continue
        try:
            with open(p, "rb") as fh:
                digests[p] = _digest(fh.read())
        except OSError:
            # An unreadable input cannot identify a run; the caller's own
            # refusal machinery owns the error. No key -> no memo.
            return None
    frozen = []
    for a in argv:
        if a.startswith("--propose"):
            continue
        for p, d in digests.items():
            if p and p in a:
                a = a.replace(p, f"<input:{d}>")
        frozen.append(a)
    return _digest(json.dumps({"argv": frozen,
                               "inputs": sorted(digests.values())}))


#: run key -> {"store": {entry key: result}, "tally": {...}, "cap": int}
_RUNS = OrderedDict()


def _run_slot(key, cap):
    slot = _RUNS.get(key)
    if slot is None:
        slot = {"store": {}, "tally": {"hit": 0, "miss": 0, "bypass": 0,
                                       "overflow": 0}, "cap": cap}
        _RUNS[key] = slot
        while len(_RUNS) > RUNS_HELD:
            _RUNS.popitem(last=False)
    _RUNS.move_to_end(key)
    return slot


def _freeze_lines(lines):
    return tuple(lines) if isinstance(lines, (list, tuple)) else None


class MemoReviser:
    """A delegating proxy over one `Reviser` for ONE deferred run.

    Everything not on `MEMOISED` passes straight through (`__getattr__`), so
    the loop's reads of `.rdecl`, `.floor`, `.mandate(...)` and every future
    attribute behave as if the proxy were not there.
    """

    def __init__(self, reviser, slot):
        self._rv = reviser
        self._slot = slot

    def __getattr__(self, name):
        return getattr(self._rv, name)

    # ── the four memoised calls ──────────────────────────────────────────
    #
    # Each wrapper spells its OWN entry key — the coordinates that vary
    # within a run — and bypasses on any shape it does not recognise.  The
    # run-invariant arguments (mandate, blueprint, subdivision, assume) are
    # deliberately NOT in the key: the run key already froze the inputs they
    # deterministically derive from, and a path-valued argument like
    # `blueprint` MUST stay out because the connector re-spells it through a
    # fresh temp path every request.

    def _memo(self, key, compute):
        if key is None:
            self._slot["tally"]["bypass"] += 1
            return compute()
        store = self._slot["store"]
        if key in store:
            self._slot["tally"]["hit"] += 1
            return copy.deepcopy(store[key])
        out = compute()
        self._slot["tally"]["miss"] += 1
        if len(store) >= self._slot["cap"]:
            # Past the derived ceiling the RUN's memo is cleared rather than
            # partially evicted: the replay walks its prefix from the start,
            # so holding a suffix serves nothing, and a cleared store is the
            # old full-replay behaviour — slow, never wrong.
            store.clear()
            self._slot["tally"]["overflow"] += 1
        store[key] = copy.deepcopy(out)
        return out

    def brief(self, lines, mandate=None, profile=None, blueprint=None,
              subdivision=None, assume=None):
        frozen = _freeze_lines(lines)
        key = None if frozen is None else ("brief", frozen, profile)
        return self._memo(key, lambda: self._rv.brief(
            lines, mandate, profile=profile, blueprint=blueprint,
            subdivision=subdivision, assume=assume))

    def verify(self, before, after, mandate=None, targeted=None,
               profile=None, blueprint=None, subdivision=None, assume=None):
        fb, fa = _freeze_lines(before), _freeze_lines(after)
        try:
            ft = None if targeted is None else tuple(sorted(targeted))
        except TypeError:
            ft, fb = None, None  # unorderable target set: bypass
        key = (None if fb is None or fa is None
               else ("verify", fb, fa, ft, profile))
        return self._memo(key, lambda: self._rv.verify(
            before, after, mandate, targeted=targeted, profile=profile,
            blueprint=blueprint, subdivision=subdivision, assume=assume))

    def inspect(self, lines, mandate=None, profile=None, blueprint=None,
                subdivision=None, assume=None):
        frozen = _freeze_lines(lines)
        key = None if frozen is None else ("inspect", frozen, profile)
        return self._memo(key, lambda: self._rv.inspect(
            lines, mandate, profile=profile, blueprint=blueprint,
            subdivision=subdivision, assume=assume))

    def joint_field(self, calls, exclude=(), profile=None):
        try:
            key = ("joint", tuple(calls), tuple(exclude), profile)
        except TypeError:
            key = None
        return self._memo(key, lambda: self._rv.joint_field(
            calls, exclude=exclude, profile=profile))


def wrap(reviser, key, n_lines):
    """-> (reviser-or-proxy, disclosure_callable).

    The proxy is returned only when the module is enabled AND the run has a
    key; either failure hands back the bare reviser with a disclosure that
    says so, because a memo that is off must LOOK off (doctrine 20 — "none"
    and "cannot tell" are different answers, and so are "cold" and
    "disabled").
    """
    if not enabled():
        return reviser, lambda: ("  REPLAY MEMO: off (LYRIC_REPLAY_MEMO=0) "
                                 "— every resume replays in full")
    if key is None:
        return reviser, lambda: ("  REPLAY MEMO: no run key (an input was "
                                 "unreadable) — this resume replays in full")
    # THE ENTRY CEILING IS DERIVED FROM THE RUN'S OWN DECLARED BUDGET, never
    # chosen: the loop proposes at most `max_rounds x attempts_per_line` times
    # per line, each proposal costs at most one call per memoised method, and
    # the round machinery adds at most one brief/inspect per line-round on
    # top — so the method count times the budget times the draft's own length
    # bounds what one run can ever ask.
    rd = reviser.rdecl
    cap = (len(MEMOISED) * max(1, int(rd.max_rounds))
           * max(1, int(rd.attempts_per_line)) * max(1, int(n_lines)))
    slot = _run_slot(key, cap)

    def disclosure():
        t = slot["tally"]
        asked = t["hit"] + t["miss"]
        state = "warm" if t["hit"] else "cold"
        line = (f"  REPLAY MEMO: {state} — {t['hit']} of {asked} grading "
                f"call(s) answered from the process memo "
                f"(runs held: {len(_RUNS)} of {RUNS_HELD})")
        if t["overflow"]:
            line += (f"; the derived entry ceiling ({cap}) was passed "
                     f"{t['overflow']} time(s) and the store fell back to "
                     f"full replay")
        if t["bypass"]:
            line += f"; {t['bypass']} call(s) bypassed on shape"
        return line

    return MemoReviser(reviser, slot), disclosure

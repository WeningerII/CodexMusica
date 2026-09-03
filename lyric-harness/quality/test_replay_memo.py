"""test_replay_memo.py — the deferred-replay memo answers identically and
only ever identically (`MISSING.md` M-167).

THE ORACLE IS THE LOOP'S OWN DETERMINISM. `revise_loop` is verified
deterministic (quality/loop.py's record), so the same deferred conversation
driven two ways — a fresh SUBPROCESS per resume (the memo can never be warm)
against ONE process resuming in-place the way the connector's warm worker
does (M-155's `run_one` shape) — must print the same bytes, modulo the two
things that legitimately differ: the memo's own disclosure line, and the
temp paths. A memo that changed anything else is answering a question it was
not asked, and this suite's first section is the gate on that.

Sections:
  1. equivalence — warm-in-one-process == cold-subprocess-per-step, and the
     warm arm's later resumes actually HIT (an equivalence between two cold
     arms would prove nothing about the memo).
  2. the proxy intercepts — the run's store holds brief AND verify entries,
     so the equivalence in §1 examined a live memo, not a bypassed one.
  3. the kill switch — LYRIC_REPLAY_MEMO=0 hands back the bare reviser and
     says so.
  4. key separation — a run differing in one draft byte or one mandate
     character freezes to a DIFFERENT run key.
  5. the registry evicts LRU at its derived bound, and a bypassed shape is
     counted as a bypass, never served.
"""

import io
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import lyric_harness as LH  # noqa: E402
from quality import replay_memo as RM  # noqa: E402

FAILS = []


def check(name, cond, detail=""):
    tag = "PASS" if cond else "FAIL"
    print(f"  {tag}  {name}" + (f"  [{detail}]" if detail and not cond
                                else ""))
    if not cond:
        FAILS.append(name)


def run_cold(*args, env=None):
    """One resume as its own subprocess — the memo is structurally cold."""
    e = dict(os.environ)
    if env:
        e.update(env)
    p = subprocess.run([sys.executable, "lyric_harness.py", *args],
                       cwd=ROOT, capture_output=True, text=True, timeout=900,
                       env=e)
    return p.returncode, p.stdout, p.stderr


def run_warm(*args):
    """One resume inside THIS process — worker.py's `run_one` shape, so the
    module-level memo survives to the next call exactly as it does under the
    connector's warm worker."""
    out, err = io.StringIO(), io.StringIO()
    old_argv, old_out, old_err = sys.argv, sys.stdout, sys.stderr
    old_cwd = os.getcwd()
    sys.argv = ["lyric_harness.py"] + list(args)
    sys.stdout, sys.stderr = out, err
    os.chdir(ROOT)
    code = 0
    try:
        rc = LH.cli()
        code = int(rc) if isinstance(rc, int) else 0
    except SystemExit as e:
        code = e.code if isinstance(e.code, int) else (0 if e.code is None
                                                       else 1)
    finally:
        sys.argv, sys.stdout, sys.stderr = old_argv, old_out, old_err
        os.chdir(old_cwd)
    return code, out.getvalue(), err.getvalue()


# The fixture is test_verbs §20's, unchanged on purpose: a four-line draft
# whose mandate asks exactly ONE question (L3 — four~own stands in no schema
# under the whole-vocabulary default), answered by a line measured clean.
LINES = ["The bank foreclosed and boarded up the store",
         "the freight train left the siding after four",
         "we packed the truck with everything we own",
         "and drove until the radio was gone"]
MAND = "--groups=2,3;1,4"
ANSWER = "we stacked our boxes on the hardwood floor"


def drive(runner, workdir, env=None):
    """Drive the deferred conversation to its stop. -> [(rc, stdout)]."""
    draft = os.path.join(workdir, "draft.txt")
    state = os.path.join(workdir, "state.json")
    with open(draft, "w", encoding="utf-8") as fh:
        fh.write("\n".join(LINES) + "\n")
    steps = []
    kw = {"env": env} if (env and runner is run_cold) else {}
    if env and runner is run_warm:
        os.environ.update(env)
    try:
        rc, out, _ = runner("revise", draft, MAND,
                            f"--propose=defer:{state}", **kw)
        steps.append((rc, out))
        # Answer whatever is pending until the loop stops asking. The walk is
        # driven by the STATE (test_verbs §20's own lesson): a fixed answer
        # list crashes the day the loop converges early.
        guard = 0
        while rc == 4 and guard < len(LINES) * 2:
            guard += 1
            st = json.load(open(state, encoding="utf-8"))
            if st.get("pending") is None:
                break
            st["pending"]["answer"] = ANSWER
            with open(state, "w", encoding="utf-8") as fh:
                json.dump(st, fh)
            rc, out, _ = runner("revise", draft, MAND,
                                f"--propose=defer:{state}", **kw)
            steps.append((rc, out))
    finally:
        if env and runner is run_warm:
            for k in env:
                os.environ.pop(k, None)
    return steps


def normalise(out, workdir):
    """Strip the two legitimate differences: temp paths and the memo line."""
    out = out.replace(workdir, "<TMP>")
    return "\n".join(l for l in out.splitlines()
                     if not l.strip().startswith("REPLAY MEMO:"))


print("test_replay_memo — the deferred-replay memo (M-167)")

# ── 1. equivalence, and the warm arm really was warm ─────────────────────
print("\n1. warm-in-one-process == cold-subprocess-per-step, byte for byte "
      "outside the memo's own disclosure")
d_cold = tempfile.mkdtemp(prefix="rm_cold_")
d_warm = tempfile.mkdtemp(prefix="rm_warm_")
cold = drive(run_cold, d_cold)
warm = drive(run_warm, d_warm)
check("both arms walk the same number of resumes",
      len(cold) == len(warm) and len(cold) >= 2,
      f"cold {len(cold)}, warm {len(warm)}")
check("both arms end at the same stop", cold[-1][0] == warm[-1][0] == 0,
      f"rc cold {cold[-1][0]}, warm {warm[-1][0]}")
same = all(normalise(c[1], d_cold) == normalise(w[1], d_warm)
           for c, w in zip(cold, warm))
check("every resume prints identical bytes modulo paths and the memo line",
      same)
check("the final draft line the answer wrote appears in both arms",
      ANSWER in cold[-1][1] and ANSWER in warm[-1][1])
check("the warm arm's later resumes HIT the memo — the equivalence above "
      "examined a live memo, not two cold arms",
      any("REPLAY MEMO: warm" in w[1] for w in warm[1:]))
check("the cold arm never reports warmth (a subprocess cannot inherit a "
      "process memo)",
      all("REPLAY MEMO: warm" not in c[1] for c in cold))

# ── 2. the proxy intercepts the grading calls ────────────────────────────
print("\n2. the run's store holds the calls this module claims to memoise")
kinds = set()
for slot in RM._RUNS.values():
    kinds.update(k[0] for k in slot["store"])
check("at least one `brief` result is in the store", "brief" in kinds,
      f"kinds seen: {sorted(kinds)}")
check("at least one `verify` result is in the store", "verify" in kinds,
      f"kinds seen: {sorted(kinds)}")

# ── 3. the kill switch ───────────────────────────────────────────────────
print("\n3. LYRIC_REPLAY_MEMO=0 hands back the bare reviser and says so")
d_off = tempfile.mkdtemp(prefix="rm_off_")
off = drive(run_warm, d_off, env={"LYRIC_REPLAY_MEMO": "0"})
check("the disabled arm reaches the same stop", off[-1][0] == 0,
      f"rc {off[-1][0]}")
check("the disabled arm discloses OFF on every resume, never warmth",
      all("REPLAY MEMO: off" in o[1] for o in off))
same_off = all(normalise(c[1], d_cold) == normalise(o[1], d_off)
               for c, o in zip(cold, off))
check("disabled output equals the cold arm's, byte for byte outside the "
      "memo line", same_off)

# ── 4. key separation ────────────────────────────────────────────────────
print("\n4. one changed input is a different run")
da = os.path.join(d_cold, "draft.txt")
db = os.path.join(d_cold, "draft_b.txt")
shutil.copy(da, db)
with open(db, "a", encoding="utf-8") as fh:
    fh.write("one more line the other draft does not have\n")
argv = ["revise", da, MAND]
k_same = RM.run_key(argv, input_paths=(da,))
check("the same inputs freeze to the same key",
      k_same == RM.run_key(list(argv), input_paths=(da,)))
check("a draft differing in content is a different run",
      k_same != RM.run_key(["revise", db, MAND], input_paths=(db,)))
check("a mandate differing in one character is a different run",
      k_same != RM.run_key(["revise", da, "--groups=2,3;1,3"],
                           input_paths=(da,)))
check("the growing --propose state is NOT part of the identity",
      k_same == RM.run_key(argv + ["--propose=defer:/tmp/x.json"],
                           input_paths=(da,)))
check("an unreadable input yields no key (no memo, never a guess)",
      RM.run_key(["revise", "nope.txt"], input_paths=("nope.txt",)) is None)

# ── 5. the registry's bound, and the bypass ──────────────────────────────
print("\n5. LRU at the derived bound; an unrecognised shape is bypassed")


class _Rd:
    max_rounds, attempts_per_line = 1, 1


class _StubRv:
    rdecl = _Rd()

    def verify(self, before, after, mandate=None, targeted=None,
               profile=None, blueprint=None, subdivision=None, assume=None):
        return {"stub": True}


RM._RUNS.clear()
for i in range(RM.RUNS_HELD + 2):
    RM.wrap(_StubRv(), f"unit-key-{i}", 1)
check("the registry never holds more runs than its derived bound",
      len(RM._RUNS) <= RM.RUNS_HELD,
      f"{len(RM._RUNS)} > {RM.RUNS_HELD}")
check("eviction is LRU — the oldest unit keys are gone, the newest stay",
      "unit-key-0" not in RM._RUNS
      and f"unit-key-{RM.RUNS_HELD + 1}" in RM._RUNS)
prox, _say = RM.wrap(_StubRv(), "unit-key-bypass", 1)
prox.verify(["a"], ["b"], targeted={3, "unsortable"})
slot = RM._RUNS["unit-key-bypass"]
check("an unsortable targeted set is BYPASSED (counted, not keyed, and the "
      "real method still answered)",
      slot["tally"]["bypass"] >= 1 and not any(
          k[0] == "verify" for k in slot["store"]),
      f"tally {slot['tally']}")

print(f"\n{'ALL PASS' if not FAILS else f'{len(FAILS)} FAILURE(S)'}")
print("\n6. THE PROCESS-LEVEL FIELD MEMO (M-217) — a second Reviser in the same "
      "process is served the first one's fields on an IDENTICAL key, a "
      "different declaration is a miss, and LYRIC_FIELD_MEMO=0 bypasses it")
from quality import revise as _RV
from quality.revise import Reviser as _Rv
_RV.field_memo_clear()
lex6 = LH.Lexicon()
r1 = _Rv(lex=lex6)
f1 = r1._field_one("rain")
t1 = _RV.field_memo_tally()
check("the first Reviser MISSES and stores (one miss, one held)",
      t1["miss"] == 1 and t1["hit"] == 0 and t1["held"] == 1, str(t1))
r2 = _Rv(lex=lex6)
f2 = r2._field_one("rain")
t2 = _RV.field_memo_tally()
check("a SECOND Reviser, same lexicon and declaration, HITS — and the field is "
      "the same list, not a recomputation",
      t2["hit"] == 1 and t2["miss"] == 1 and f2 == f1, str(t2))
r3 = _Rv(lex=lex6, decl=LH.Declaration(theta_rhyme=0.9))
f3 = r3._field_one("rain")
t3 = _RV.field_memo_tally()
check("a Reviser with a DIFFERENT declaration (theta 0.9) misses — the "
      "declaration is in the key",
      t3["miss"] == 2 and t3["hit"] == 1, str(t3))
lex_np = LH.Lexicon(strip_parens=False)
r4 = _Rv(lex=lex_np)
r4._field_one("rain")
t4 = _RV.field_memo_tally()
check("a Reviser over a lexicon with a different aside rule misses — the "
      "lexicon's identity is in the key",
      t4["miss"] == 3, str(t4))
os.environ["LYRIC_FIELD_MEMO"] = "0"
try:
    _RV.field_memo_clear()
    r5 = _Rv(lex=lex6); r5._field_one("rain")
    r6 = _Rv(lex=lex6); r6._field_one("rain")
    t5 = _RV.field_memo_tally()
    check("LYRIC_FIELD_MEMO=0 bypasses the store: two Revisers, zero hits, "
          "zero misses, nothing held",
          t5 == {"hit": 0, "miss": 0, "evicted": 0, "held": 0}, str(t5))
finally:
    del os.environ["LYRIC_FIELD_MEMO"]
_RV.field_memo_clear()
check("the cap is the planner's own envelope (55 lines x 4 places x 2 bands, "
      "rounded), stated once", _RV.FIELD_MEMO_CAP == 512)

sys.exit(1 if FAILS else 0)

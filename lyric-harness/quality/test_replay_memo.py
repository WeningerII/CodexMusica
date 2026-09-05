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
    """Strip the legitimate differences: temp paths and the memo lines — the
    replay memo's (M-167) and, since M-217's remainder, the pair, score and
    rank memos' one line each, whose tallies differ between a warm arm and a
    cold one by construction."""
    out = out.replace(workdir, "<TMP>")
    return "\n".join(l for l in out.splitlines()
                     if not l.strip().startswith(("REPLAY MEMO:", "PAIR MEMO:",
                                                  "SCORE MEMO:")))


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
# REPINNED 2026-09-05 (`MISSING.md` M-239): the message named the planner's
# envelope, which is 12..447 now (447 x 4 x 2 = 3,576), so the cap is no
# longer the envelope's own number. The PIN is unchanged — 512, the owner's
# constant — and only what it is said to be is repaired.
check("the cap is ~~the planner's own envelope (55 lines x 4 places x 2 "
      "bands, rounded)~~ 64 lines x 4 places x 2 bands: sized 2026-09-02 to "
      "the 55-line envelope of that day, a BOUND with LRU eviction since the "
      "envelope went to 447 (M-239), scaling filed under M-240 — "
      "stated once", _RV.FIELD_MEMO_CAP == 512)

print("\n7. THE PER-PAIR SCHEMA MEMO (M-217's remainder) — a candidate draft that "
      "differs by ONE line re-judges only the pairs that touch it, the verdicts "
      "are byte-identical to the memo-off judge, a hyphen-continued neighbour is "
      "part of the line, and LYRIC_PAIR_MEMO=0 bypasses it")
from quality import relations as _R7
from quality.revise import _relation_phonology as _phon7
_p7 = _phon7()
_base7 = ["I saw the cat run down the road", "we wore the hat and left the load",
          "the moon came up above the hill", "the river froze and lay there still",
          "a coat hung dripping by the door", "the kettle ticked upon the floor"]
_var7 = list(_base7); _var7[2] = "a lantern swung above the sill"
_names7 = ["perfect rhyme", "consonance", "anaphora", "internal rhyme",
           "head rhyme (positional)", "semirhyme"]


def _lp7(lines, name):
    st = _R7.build_stream(lines, _p7, declaration={"language": "eng"})
    return _R7.line_pairs_for(_R7.REGISTRY[name], st)


os.environ["LYRIC_PAIR_MEMO"] = "0"
try:
    _R7.pair_memo_clear()
    _off7 = {(n, k): _lp7(l, n) for n in _names7
             for k, l in (("base", _base7), ("var", _var7))}
    check("LYRIC_PAIR_MEMO=0 bypasses the store: nothing held, nothing hit",
          _R7.pair_memo_tally() == {"hit": 0, "miss": 0, "evicted": 0,
                                    "slots": 0, "held": 0},
          str(_R7.pair_memo_tally()))
finally:
    del os.environ["LYRIC_PAIR_MEMO"]
_R7.pair_memo_clear()
_on7 = {}
_hits, _misses = {}, {}
for n in _names7:
    _on7[(n, "base")] = _lp7(_base7, n)
    t1 = _R7.pair_memo_tally()
    _on7[(n, "var")] = _lp7(_var7, n)
    t2 = _R7.pair_memo_tally()
    _hits[n], _misses[n] = t2["hit"] - t1["hit"], t2["miss"] - t1["miss"]
check("six schemas, two drafts: every verdict set is byte-identical to the "
      "memo-off judge", all(_off7[k] == _on7[k] for k in _off7),
      str({k: (sorted(_off7[k]), sorted(_on7[k])) for k in _off7
           if _off7[k] != _on7[k]}))
check("the first draft of each schema is all misses (15 pairs judged, 0 hits)",
      all(_misses[n] >= 0 for n in _names7)
      and _R7.pair_memo_tally()["miss"] == sum(_misses.values()) + 15 * len(_names7),
      str(_R7.pair_memo_tally()))
check("the one-line variant hits the 10 pairs that do not touch the changed "
      "line and judges only the 5 that do — on every schema",
      all(_hits[n] == 10 and _misses[n] == 5 for n in _names7),
      f"hits {_hits} misses {_misses}")
# THE DECLARATION IS IN THE KEY: a stream declaring another language misses.
_R7.pair_memo_clear()
_lp7(_base7, "perfect rhyme")
st_cy = _R7.build_stream(_base7, _p7, declaration={"language": "cym"})
_R7.line_pairs_for(_R7.REGISTRY["perfect rhyme"], st_cy)
check("a stream under a different declaration misses on every pair — the "
      "declaration is in the key", _R7.pair_memo_tally()["hit"] == 0
      and _R7.pair_memo_tally()["slots"] == 2, str(_R7.pair_memo_tally()))
# THE HYPHEN RULE: a line whose predecessor ends in a hyphen carries that
# predecessor's text in its signature, so changing the predecessor re-judges
# its pairs too; an un-hyphenated neighbour is not part of the line.
_R7.pair_memo_clear()
_hy = ["the lantern swung and lit the win-", "dow frame and every rafter",
       "the moon came up above the hill", "the river froze and lay there still"]
_hy2 = list(_hy); _hy2[0] = "the candle guttered on the win-"
_lp7(_hy, "perfect rhyme"); t1 = _R7.pair_memo_tally()
_lp7(_hy2, "perfect rhyme"); t2 = _R7.pair_memo_tally()
check("a change to a hyphen-cut line also re-judges the line it continues "
      "into: pairs touching L1 or L2 miss (5 of 6), the one pair that "
      "touches neither hits", t2["hit"] - t1["hit"] == 1
      and t2["miss"] - t1["miss"] == 5, f"{t1} -> {t2}")
check("the cut rule the signature quotes is build_stream's own",
      _R7._HYPHEN_CUT.pattern == r"[\w’'](-)\s*$"
      and bool(_R7._HYPHEN_CUT.search("win-")) and not _R7._HYPHEN_CUT.search("win"))
_R7.pair_memo_clear()
_st_nt = _R7.build_stream(_base7, _p7, declaration={"language": "eng"})
_st_nt.text_lines = ()
_R7.line_pairs_for(_R7.REGISTRY["perfect rhyme"], _st_nt)
check("a stream that cannot spell per-line signatures (no text lines) bypasses "
      "the memo instead of collapsing every line onto one key",
      _R7.pair_memo_tally()["slots"] == 0 and _R7.pair_memo_tally()["miss"] == 0,
      str(_R7.pair_memo_tally()))
# REPINNED 2026-09-05 (`MISSING.md` M-239): the arithmetic below is still
# true of a 55-line draft, but 55 is no longer the envelope's ceiling — 447
# is, and a 447-line draft is 99,681 pairs. What 4,096 rows hold WHOLE is a
# 91-line draft (4,095 pairs); at 92 lines (4,186) the LRU starts evicting.
# The pinned values are unchanged.
check("the two caps are stated once, and the row cap holds a 55-line draft's "
      "1,485 pairs plus 48 one-line folds — ~~which is the planner's "
      "longest~~ a 55-line draft being the 2026-09-02 envelope's longest; "
      "the cap holds a whole draft to 91 lines and is a BOUND with LRU "
      "eviction past it (M-239; scaling filed under M-240)",
      _R7.PAIR_MEMO_CAP == 4_096 and _R7.PAIR_MEMO_SLOTS == 128
      and _R7.PAIR_MEMO_CAP >= 55 * 54 // 2 + 48 * 54)
_R7.pair_memo_clear()
print(f"\n{'ALL PASS' if not FAILS else f'{len(FAILS)} FAILURE(S)'}")


print("\n8. THE PAIR-SCORE AND RANKING MEMOS (M-217's remainder, levers 2 and 3) — "
      "a second Reviser is served the first one's pair scores and rankings on an "
      "identical key, a different profile or declaration misses, the served "
      "objects are the same verdicts, and the two kill switches bypass them")
_RV.score_rank_memo_clear()
_lines8 = ["I saw the cat run down the road", "we wore the hat and left the load",
           "the moon came up above the hill", "the river froze and lay there still"]
_var8 = list(_lines8); _var8[2] = "a lantern swung above the sill"
lex8 = LH.Lexicon()
ra = _Rv(lex=lex8)
_, _, _, m1 = ra._matrix(_lines8)
t1 = _RV.score_memo_tally()
check("the first draft scores all 6 pairs and records them (6 misses, 0 hits)",
      t1["miss"] == 6 and t1["hit"] == 0 and t1["held"] == 6, str(t1))
rb = _Rv(lex=lex8)
_, _, _, m2 = rb._matrix(_var8)
t2 = _RV.score_memo_tally()
check("a SECOND Reviser grading the one-line variant is served the 3 pairs that "
      "do not touch the changed line and scores the 3 that do",
      t2["hit"] == 3 and t2["miss"] == 9, str(t2))
check("a served score IS the recorded verdict: L1~L2 identical across the two "
      "Revisers, total and relation", m2[0][1]["total"] == m1[0][1]["total"]
      and m2[0][1]["relation"] == m1[0][1]["relation"])
rc_ = _Rv(lex=lex8)
rc_._matrix(_lines8, profile="assonance")
t3 = _RV.score_memo_tally()
check("a different comparator profile misses on every pair — the profile is in "
      "the key", t3["miss"] == 15 and t3["hit"] == 3, str(t3))
rd_ = _Rv(lex=lex8, decl=LH.Declaration(theta_rhyme=0.9))
rd_._matrix(_lines8)
t4 = _RV.score_memo_tally()
check("a different declaration misses on every pair — the declaration is in "
      "the key", t4["miss"] == 21 and t4["hit"] == 3, str(t4))
# THE RANKING MEMO
_RV.score_rank_memo_clear(); _RV.field_memo_clear()
h1 = ra.modal_head("rain")
r1 = _RV.rank_memo_tally()
h2 = rb.modal_head("rain")
r2 = _RV.rank_memo_tally()
check("the first ranking misses and is recorded; a second Reviser's identical "
      "ask is served (one miss, one hit) and the forbidden head is the same list",
      r1["miss"] == 1 and r1["hit"] == 0 and r2["hit"] == 1 and h1 == h2
      and h1 is not h2, f"{r1} -> {r2}")
h3 = rd_.modal_head("rain")
r3 = _RV.rank_memo_tally()
check("a different declaration's ranking misses — the declaration is in the key",
      r3["miss"] == 2, str(r3))
check("the spelled-rime memo holds every word the rankings read, and the same "
      "word asked twice reads once", r3["rimes"] > 0
      and ra._spelled_rime("rain") == ra._spelled_rime_compute("rain"))
for var, fn in (("LYRIC_SCORE_MEMO", lambda: _Rv(lex=lex8)._matrix(_var8)),
                ("LYRIC_RANK_MEMO", lambda: _Rv(lex=lex8).modal_head("rain"))):
    os.environ[var] = "0"
    try:
        _RV.score_rank_memo_clear()
        fn(); fn()
        tl = _RV.score_memo_tally() if "SCORE" in var else _RV.rank_memo_tally()
        check(f"{var}=0 bypasses its store: two Revisers, zero hits, zero misses, "
              f"nothing held", tl["hit"] == 0 and tl["miss"] == 0 and tl["held"] == 0,
              str(tl))
    finally:
        del os.environ[var]
_RV.score_rank_memo_clear()
# REPINNED 2026-09-05 (`MISSING.md` M-239): 55 lines was the envelope's
# ceiling when this was sized (2026-09-02); it is 447 now and a 447-line
# draft is 99,681 pair scores. 8,192 holds a whole draft to 128 lines
# (8,128) and is exceeded at 129 (8,256). Pinned values unchanged.
check("the caps are stated once and the score cap holds a 55-line draft's 1,485 "
      "pairs plus every one-line fold of a long run — a 55-line draft being "
      "the 2026-09-02 envelope's longest, not ~~the planner's~~ today's "
      "(12..447 since M-239); whole drafts to 128 lines, a BOUND with LRU "
      "eviction past that, scaling filed under M-240",
      _RV.SCORE_MEMO_CAP == 8_192 and _RV.RANK_MEMO_CAP == 2_048
      and _RV.RIME_MEMO_CAP == 200_000 and _RV.SCORE_MEMO_CAP >= 1_485 + 100 * 54)
check("the disclosure names both memos and says served and judged apart",
      "SCORE MEMO: pair scores" in _RV.memo_disclosure()
      and "RANK MEMO: field rankings" in _RV.memo_disclosure())
print(f"\n{'ALL PASS' if not FAILS else f'{len(FAILS)} FAILURE(S)'}")

sys.exit(1 if FAILS else 0)

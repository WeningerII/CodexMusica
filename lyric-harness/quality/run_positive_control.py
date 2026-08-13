#!/usr/bin/env python3
"""Part B of the positive control — run it on the real corpora.

Part A (`quality/positive_control.py`) planted a synthetic signal and showed the
phase statistic detects it: power 1.00 at ceiling, 0.05 at chance. That
validated the STATISTIC. It said nothing about whether the pipeline finds the
events a real form mandates in real text.

This runs the arms that the sourced corpora support:

  A  律詩 MANDATED rhyme      known answer, must detect
  B  律詩 INTERNAL placement  the open question, line-finals excluded
  C  律詩 SCRAMBLED           negative control, character order destroyed
  D  sonnets MANDATED rhyme   the same known answer in a second family

Arm A is deliberately near-tautological and that is the point: in 5-character
regulated verse the rhyme falls on lines 2, 4, 6, 8, so the mandated events sit
at syllable indices 9, 19, 29, 39 — period 10 exactly. If the pipeline cannot
see THAT on natural text, nothing else it reports means anything.

Arm B is the real question and is the Chinese analogue of H1: with the
guaranteed line-final periodicity removed, does anything remain?

Run: python3 quality/run_positive_control.py
     python3 quality/run_positive_control.py --check    (exit 0/1/2, below)

WHY THERE IS A `--check` AT ALL, ADDED 2026-08-13

Same story as part A next door, and it had already gone wrong here. `main()`
returned `None`, `sys.exit` was never called with a code, and nothing invoked
it — `quality/audit_tang_null.py` imports `tang_poems` from this module, which
is import reachability, not invocation reachability: the four ARMS below had no
automated caller of any kind. So this exited 0 whatever it printed.

AND IT HAD DRIFTED, silently, for as long as nobody typed the command. Measured
2026-08-13 against `POSITIVE_CONTROL.md`'s Part D table:

    arm A   recorded n=264 refused=36  sig 264/264      measured n=270 refused=30
    arm B   recorded med_p 0.529  sig 18/300  F 0.883   measured 0.543  15/300  0.923
    arm C2  recorded n=264 refused=36  sig 15/264       measured n=270 refused=30  14/270

Arm A's 264/300 = 88.0% is the same statistic `quality/audit_tang_null.py`
repinned to **90.0%** on this date when IT was wired to CI — 270/300. That file
found the drift, was fixed, and Part D's copy of the identical number was never
told. Doctrine 58 one axis out: a count is a coordinate of the rime table, and
two documents quoting it drift independently.

THREE EXITS, NOT TWO (doctrine 20/28), and here the third is the ORDINARY case.
This arm's corpus is `/workspace/chinese-poetry/...` — an absolute path OUTSIDE
the repository, not committed, not fetched by CI. `data/qieyun_mc.tsv` is
committed but `quality/phonology/ltc.py`'s `_load_table()` returns an EMPTY
DICT when it is missing rather than raising. Either absence produces the same
thing today: every poem refuses, `n=0`, and the arm prints `med_p=  nan
Fisher_p=      n/a` and exits 0 — a corpus that is not there, rendered as a
result. That is precisely the false negative dressed as a finding that doctrine
20 names. `--check` exits **2 — CANNOT TELL** when either input is absent, and
says which one.

WHAT IS PINNED, AND WHAT IS DELIBERATELY NOT
`--check` pins the DETERMINISTIC quantities — the poem count, and each arm's
admitted / refused / median-saturation — because those are exact functions of
the corpus and the rime table with no draw in them, and because those are what
moved. It does NOT pin the p-values, the medians or the Fisher figures: each
rides a seeded permutation draw, so pinning one to three decimals would witness
`n_perm` rather than the effect (doctrine 57 — the same reasoning
`quality/audit_time_pooled_null.py` applies to the pooled-Fisher calibration).
Those are checked as DIRECTIONS instead, and the four directions are exactly
what Part D's conclusions rest on:

  A  must detect      the mandated rhyme is periodic by construction; a null
                      here would void the whole pipeline
  C1 must MATCH A     the tautology tripwire. C1 drops the rhyme requirement
                      and keeps the positions; if it stops matching A, Part D's
                      "position, not rhyme" attribution has changed
  B  must be null     the open question, and the English null's replication
  C2 must be null     the negative control: same events, random positions

`--check` also caps `n_perm`, since the pinned quantities do not read the draw
and the directions are insensitive to it above the resolution floor.
"""

import glob
import json
import math
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.phonology import get  # noqa: E402
from quality.time_layer import (TimeDeclaration, analyse,  # noqa: E402
                                phase_statistic)

#: An absolute path outside the repository. `TANG_POOL` overrides it, so the
#: arm is runnable somewhere other than the machine it was written on and so
#: the CANNOT-TELL branch below is demonstrable. Unset, this is byte-for-byte
#: the path this module has always used.
POOL = os.environ.get("TANG_POOL",
                      "/workspace/chinese-poetry/chinese-poetry/全唐诗")
PUNCT = "，。！？、；：「」『』《》〈〉·（）"


def tang_poems(limit=400):
    """-> [(title, [lines])] for poems of 8 uniform lines of 5 or 7 chars.

    The filter is the FORM's, not a judgement: eight lines, one length. It will
    still admit some 古詩 (ancient-style) that does not follow regulated rhyme,
    which is part of why arm A is not expected to hit 100%.
    """
    out = []
    for path in sorted(glob.glob(os.path.join(POOL, "poet.tang.*.json"))):
        try:
            data = json.load(open(path, encoding="utf-8"))
        except Exception:
            continue
        for p in data:
            lines = [x for grp in (re.split(r"[，。]", s)
                                   for s in p["paragraphs"]) for x in grp if x]
            lines = ["".join(c for c in ln if c not in PUNCT) for ln in lines]
            lines = [ln for ln in lines if ln]
            if len(lines) != 8:
                continue
            if len({len(ln) for ln in lines}) != 1:
                continue
            if len(lines[0]) not in (5, 7):
                continue
            out.append((p.get("title", ""), lines))
            if len(out) >= limit:
                return out
    return out


def chinese_stream(lines):
    """A syllable stream from `ltc`: one character, one syllable.

    `stress` carries the 平/仄 binary, because that is the contrast the
    regulated-verse template constrains. It is NOT stress; Chinese has none.
    Unknown characters get 0 rather than being dropped, so positions stay
    aligned -- dropping them would shift every index after the gap.
    """
    ltc = get("ltc")
    out, w = [], 0
    for li, ln in enumerate(lines):
        for si, ch in enumerate(ln):
            t = ltc.tone_class(ch)
            out.append({
                "word": ch, "widx": w, "line": li, "pos_in_line": si,
                "line_final": (si == len(ln) - 1),
                "stress": 1 if t == 1 else 0, "nucleus": "", "coda": (),
                "onset": (), "tone": t,
            })
            w += 1
    return out


def mandated_rhyme_events(lines):
    """The positions the FORM fixes: line-final syllables of lines 2,4,6,8,
    kept only when `ltc` confirms they share a rhyme category. Ground truth
    from the tradition, not from a detector."""
    ltc = get("ltc")
    idx, pos = [], 0
    ends = {}
    for li, ln in enumerate(lines):
        pos += len(ln)
        ends[li] = (pos - 1, ln[-1])
    rhyme_lines = [1, 3, 5, 7]
    words = [ends[li][1] for li in rhyme_lines]
    if not all(ltc.rhymes(words[0], w) for w in words[1:]):
        return None                      # not a regulated rhyme; skip the item
    for li in rhyme_lines:
        idx.append(ends[li][0])
    return set(idx)


def internal_rhyme_events(lines, exclude_final=True):
    """Every position whose character shares a rhyme category with another
    character elsewhere in the poem. This is the Chinese analogue of the
    English internal-rhyme event set."""
    ltc = get("ltc")
    flat, pos = [], 0
    for li, ln in enumerate(lines):
        for si, ch in enumerate(ln):
            flat.append((pos, ch, si == len(ln) - 1))
            pos += 1
    keys = {}
    for i, ch, fin in flat:
        if exclude_final and fin:
            continue
        k = ltc.rhyme_keys(ch)
        if k:
            keys[i] = k
    ev = set()
    items = list(keys.items())
    for a in range(len(items)):
        for b in range(a + 1, len(items)):
            ia, ka = items[a]
            ib, kb = items[b]
            if ka & kb:
                ev.add(ia)
                ev.add(ib)
    return ev


def fisher(ps):
    ps = [p for p in ps if p is not None and p > 0]
    if not ps:
        return None, 0
    x = -2 * sum(math.log(p) for p in ps)
    df = 2 * len(ps)
    k2 = df // 2
    t = math.exp(-x / 2)
    s = t
    for i in range(1, k2):
        t *= (x / 2) / i
        s += t
    return min(1.0, s), len(ps)


def run_arm(name, items, event_fn, exclude_final, tdecl, note=""):
    ps, sats, refused = [], [], 0
    for title, lines in items:
        stream = chinese_stream(lines)
        ev = event_fn(lines)
        if ev is None or len(ev) < 4:
            refused += 1
            continue
        t = TimeDeclaration(**{**tdecl.__dict__,
                               "exclude_line_final": exclude_final})
        res = analyse(None, lines, tdecl=t, events=ev, stream=stream)
        if res.get("p") is None:
            refused += 1
            continue
        ps.append(res["p"])
        sats.append(res["saturation"])
    fp, k = fisher(ps)
    sig = sum(1 for p in ps if p < 0.05)
    med = sorted(ps)[len(ps) // 2] if ps else float("nan")
    msat = sorted(sats)[len(sats) // 2] if sats else float("nan")
    print(f"  {name:<34} n={len(ps):>3} refused={refused:>3} "
          f"sat={msat:>5.1%} med_p={med:>6.3f} sig={sig:>3}/{len(ps):<3} "
          f"Fisher_p={('%.3g' % fp) if fp is not None else 'n/a':>9}")
    if note:
        print(f"      {note}")
    # The measurement, so `--check` reads the same numbers the line above
    # prints rather than recomputing them beside it (doctrine 1: one source).
    return {"n": len(ps), "refused": refused, "sat": round(msat, 4),
            "sig": sig, "sig_share": (sig / len(ps)) if ps else float("nan"),
            "med_p": med, "fisher": fp, "ps": ps}


def main(n_perm=2000, limit=300):
    tdecl = TimeDeclaration(grid_unit="syllable", periods=(2, 4, 5, 7, 10, 14),
                            n_perm=n_perm, max_saturation=0.95)
    items = tang_poems(limit=limit)
    print(f"律詩 corpus: {len(items)} poems of 8 uniform lines "
          f"(5 or 7 characters)\n")
    print("  grid unit = syllable (one character = one syllable, so the grid "
          "is exact)")
    print("  periods swept = (2,4,5,7,10,14): a 5-char couplet is 10 "
          "syllables, a 7-char couplet is 14\n")

    measured = {"poems": len(items)}

    print("ARM A — MANDATED rhyme (known answer: must detect)")
    measured["A"] = run_arm(
            "律詩 line-final, lines 2/4/6/8", items, mandated_rhyme_events,
            False, tdecl,
            "rhyme at every second line-end IS periodic by construction; a "
            "null here would void the pipeline")

    print("\nARM B — INTERNAL placement (the open question)")
    measured["B"] = run_arm("律詩 internal, line-finals excluded", items,
                            lambda ls: internal_rhyme_events(ls, True),
                            True, tdecl)

    print("\nARM C1 — is arm A carried by RHYME, or only by POSITION?")
    # Same positions as arm A, but the rhyme requirement dropped: every
    # line-final of lines 2/4/6/8 whether or not `ltc` says they rhyme. If
    # this is as significant as arm A, then arm A measured the FORM's line
    # length and not its rhyme -- the H3 tripwire, and worse in Chinese
    # because one character is exactly one syllable so the grid is perfect.
    def positions_only(lines):
        pos, ends = 0, []
        for ln in lines:
            pos += len(ln)
            ends.append(pos - 1)
        return {ends[i] for i in (1, 3, 5, 7)}

    measured["C1"] = run_arm("律詩 same positions, rhyme NOT required", items,
                             positions_only, False, tdecl,
                             "if this matches arm A, arm A is positional and "
                             "says nothing about rhyme")

    print("\nARM C2 — NEGATIVE control: rhyme kept, POSITIONS destroyed")
    rng = random.Random(20260810)

    def shuffled_positions(lines):
        ev = mandated_rhyme_events(lines)
        if ev is None:
            return None
        total = sum(len(ln) for ln in lines)
        return set(rng.sample(range(total), len(ev)))

    measured["C2"] = run_arm(
            "律詩 rhyming, positions randomised", items,
            shuffled_positions, False, tdecl,
            "the same NUMBER of events, placed at random: must come out null")
    return measured


# --------------------------------------------------------------------------
# PREFLIGHT and CHECK. See the module docstring for why the third exit is the
# ordinary case here, and why the p-values are directions rather than pins.
# --------------------------------------------------------------------------

def preflight():
    """-> None if the arms can run, else the reason they cannot.

    Both inputs fail SILENTLY today rather than raising: a missing POOL makes
    `tang_poems` return `[]`, and a missing rime table makes
    `ltc.py::_load_table` return `{}`. Either way every arm refuses every poem
    and prints `nan`, which is a corpus that is not there rendered as a result.
    """
    if not os.path.isdir(POOL):
        return (f"the 全唐诗 pool is not on disk: {POOL}\n"
                f"  It is an absolute path OUTSIDE this repository, not "
                f"committed and not fetched by CI.")
    if not glob.glob(os.path.join(POOL, "poet.tang.*.json")):
        return (f"{POOL} exists but holds no poet.tang.*.json files.")
    try:
        ltc = get("ltc")
        n_chars = len(getattr(ltc, "_t", {}) or {})
    except Exception as exc:                       # pragma: no cover
        return f"the `ltc` phonology could not be built: {exc!r}"
    if not n_chars:
        return ("data/qieyun_mc.tsv is missing or empty, so the rime table "
                "answers `no` to every rhyme question.\n"
                "  `ltc.py::_load_table` returns {} rather than raising, so "
                "every arm would refuse every poem and print `nan`.")
    return None


#: THE COMMITTED SHAPE. Deterministic given the corpus and the rime table --
#: no permutation enters any of these. MEASURED 2026-08-13; arm A's 270/30 is
#: `quality/audit_tang_null.py`'s repinned 90.0%, and supersedes the 264/36
#: that POSITIVE_CONTROL.md's Part D table carried (doctrine 17: the
#: superseded value is kept visible there, not deleted).
PINNED = {
    "poems": 300,
    "A":  {"n": 270, "refused": 30, "sat": 0.10},
    "B":  {"n": 300, "refused":  0, "sat": 0.50},
    "C1": {"n": 300, "refused":  0, "sat": 0.10},
    "C2": {"n": 270, "refused": 30, "sat": 0.10},
}

#: THE DIRECTIONS. Not pinned numbers: each rides a seeded permutation draw,
#: and pinning one to three decimals would witness `n_perm` (doctrine 57).
#: Measured 2026-08-13 at n_perm=2000: A 270/270, C1 300/300, B 15/300 with
#: Fisher 0.923, C2 14/270 with Fisher 1.
MIN_DETECT_SHARE = 0.95     # arms A and C1 -- "must detect"
MAX_NULL_SHARE = 0.15       # arms B and C2 -- a null at alpha 0.05, with slack
MIN_NULL_FISHER = 0.10      # a pooled Fisher this large is not a detection

#: Below this the smallest attainable p is too coarse for `sig = p < 0.05` to
#: mean anything (doctrine 57). Exit 2, not 1.
CHECK_MIN_NPERM = 100


def _cannot_tell(reason):
    print()
    print("=" * 74)
    print("CANNOT TELL -- the arms could not be run (exit 2)")
    print("=" * 74)
    print(f"  {reason}")
    print()
    print("  This is NOT a null result and it is NOT a pass. An absent corpus")
    print("  rendered as `nan` is the false negative doctrine 20 is about.")
    return 2


def check(measured):
    """-> exit code. 0 pass / 1 the shape or a direction moved."""
    print()
    print("=" * 74)
    print("CHECK -- the committed shape and the four directions")
    print("=" * 74)
    bad = 0

    def judge(name, ok, detail):
        nonlocal bad
        bad += not ok
        print(f"  [{'ok  ' if ok else 'FAIL'}] {name}")
        print(f"         {detail}")

    judge("corpus shape: poems admitted by the form filter",
          measured["poems"] == PINNED["poems"],
          f"committed {PINNED['poems']}, measured {measured['poems']}")

    print("\n  THE DETERMINISTIC SHAPE -- no draw enters these")
    for arm in ("A", "B", "C1", "C2"):
        got, want = measured[arm], PINNED[arm]
        for k in ("n", "refused", "sat"):
            ok = (abs(got[k] - want[k]) < 5e-3 if k == "sat"
                  else got[k] == want[k])
            judge(f"arm {arm} {k}",
                  ok, f"committed {want[k]}, measured {got[k]}")

    print("\n  THE FOUR DIRECTIONS -- what Part D's conclusions rest on")
    a, b, c1, c2 = (measured[k] for k in ("A", "B", "C1", "C2"))
    judge("arm A must DETECT the mandated rhyme",
          a["sig_share"] >= MIN_DETECT_SHARE,
          f"{a['sig']}/{a['n']} significant = {a['sig_share']:.3f}, need >= "
          f"{MIN_DETECT_SHARE}. A null here would void the pipeline "
          f"(doctrine 76)")
    judge("arm C1 must MATCH arm A -- the tautology tripwire",
          c1["sig_share"] >= a["sig_share"] - 1e-9,
          f"C1 {c1['sig_share']:.3f} vs A {a['sig_share']:.3f}. If C1 falls "
          f"below A, Part D's 'position, not rhyme' attribution has changed")
    for arm, m in (("B", b), ("C2", c2)):
        judge(f"arm {arm} must come out NULL",
              m["sig_share"] <= MAX_NULL_SHARE
              and (m["fisher"] is not None
                   and m["fisher"] >= MIN_NULL_FISHER),
              f"{m['sig']}/{m['n']} = {m['sig_share']:.3f} significant "
              f"(need <= {MAX_NULL_SHARE}), Fisher {m['fisher']} "
              f"(need >= {MIN_NULL_FISHER})")

    if bad:
        print()
        print(f"  {bad} check(s) moved.")
        print("  A SHAPE failure is the ingestion or the rime table changing "
              "under the arm: repin here AND in POSITIVE_CONTROL.md Part D, "
              "with the date, keeping the superseded value (doctrine 17).")
        print("  A DIRECTION failure is a different thing entirely -- it is "
              "Part D's finding changing, and it is argued, never tuned "
              "(doctrine 58).")
    print()
    print("RESULT:", "PASS" if not bad else "FAIL")
    return 0 if not bad else 1


if __name__ == "__main__":
    _argv = [a for a in sys.argv[1:] if a != "--check"]
    _checking = "--check" in sys.argv
    # The pinned quantities do not read the draw, and the directions are
    # insensitive to it above the resolution floor, so the check pays for a
    # tenth of the permutations. 2000 stays the default for a real run.
    _n_perm = int(_argv[0]) if _argv else (200 if _checking else 2000)
    _why = preflight()
    if _why is not None:
        sys.exit(_cannot_tell(_why))
    if _checking and _n_perm < CHECK_MIN_NPERM:
        sys.exit(_cannot_tell(
            f"n_perm={_n_perm} puts the smallest attainable p at "
            f"{1 / (_n_perm + 1):.4f}; `sig = p < 0.05` cannot be resolved "
            f"reliably below n_perm={CHECK_MIN_NPERM} (doctrine 57)."))
    _m = main(n_perm=_n_perm)
    sys.exit(check(_m) if _checking else 0)

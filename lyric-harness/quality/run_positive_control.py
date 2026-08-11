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

POOL = "/workspace/chinese-poetry/chinese-poetry/全唐诗"
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
    return ps


def main():
    tdecl = TimeDeclaration(grid_unit="syllable", periods=(2, 4, 5, 7, 10, 14),
                            n_perm=2000, max_saturation=0.95)
    items = tang_poems(limit=300)
    print(f"律詩 corpus: {len(items)} poems of 8 uniform lines "
          f"(5 or 7 characters)\n")
    print("  grid unit = syllable (one character = one syllable, so the grid "
          "is exact)")
    print("  periods swept = (2,4,5,7,10,14): a 5-char couplet is 10 "
          "syllables, a 7-char couplet is 14\n")

    print("ARM A — MANDATED rhyme (known answer: must detect)")
    run_arm("律詩 line-final, lines 2/4/6/8", items, mandated_rhyme_events,
            False, tdecl,
            "rhyme at every second line-end IS periodic by construction; a "
            "null here would void the pipeline")

    print("\nARM B — INTERNAL placement (the open question)")
    run_arm("律詩 internal, line-finals excluded", items,
            lambda ls: internal_rhyme_events(ls, True), True, tdecl)

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

    run_arm("律詩 same positions, rhyme NOT required", items,
            positions_only, False, tdecl,
            "if this matches arm A, arm A is positional and says nothing "
            "about rhyme")

    print("\nARM C2 — NEGATIVE control: rhyme kept, POSITIONS destroyed")
    rng = random.Random(20260810)

    def shuffled_positions(lines):
        ev = mandated_rhyme_events(lines)
        if ev is None:
            return None
        total = sum(len(ln) for ln in lines)
        return set(rng.sample(range(total), len(ev)))

    run_arm("律詩 rhyming, positions randomised", items,
            shuffled_positions, False, tdecl,
            "the same NUMBER of events, placed at random: must come out null")


if __name__ == "__main__":
    main()

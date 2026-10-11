#!/usr/bin/env python3
"""Regressions for THE PILOT FRAME TOOL (quality/pilot_frame.py).

Synthetic frames only: nothing here reads the corpus or the converter.

Sections:
  1  a stored frame is drawn from only when its own payload, its header and
     the re-derived frame agree, with the same split and converter bindings
  2  the draw is a pure function of the frame and the seed: 59 from a large
     stratum, everything from a small one, in a fixed order
"""
import copy
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)

from quality import pilot_frame as P                             # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def _rec(n_large=80, n_small=10):
    frame = []
    for i in range(n_large):
        frame.append({"spelling": f"w{i:03d}", "stratum": "r-colour rule",
                      "readings": [{"moby": "x", "phones": "W ER1", "logs": []}]})
    for i in range(n_small):
        frame.append({"spelling": f"h{i:03d}", "stratum": "hw merger",
                      "readings": [{"moby": "y", "phones": "W AY1", "logs": []}]})
    frame.sort(key=lambda f: f["spelling"])
    return {"frame": frame, "frame_sha256": P.frame_digest(frame),
            "bindings": {"split": {"split_file_sha256": "s"},
                         "converter_output_sha256": "c",
                         "corpus_inputs_sha256": "i"}}


def test_authentication():
    print("\n1. a stored frame is authenticated before any draw")
    rec = _rec()
    check("an untouched frozen frame may be drawn from",
          P.authenticated(copy.deepcopy(rec), rec) is None)
    tampered = copy.deepcopy(rec)
    tampered["frame"][0]["readings"][0]["phones"] = "W AA1"
    check("an edited stored reading under the old header is refused "
          "(3PO's #541 finding)", P.authenticated(tampered, rec) is not None,
          P.authenticated(tampered, rec))
    moved = copy.deepcopy(rec)
    moved["frame"][-1]["stratum"] = "hw merger"
    moved["frame_sha256"] = P.frame_digest(moved["frame"])
    check("a consistent but different stored frame is refused against the "
          "re-derived one", P.authenticated(moved, rec) is not None)
    for key in ("split", "converter_output_sha256", "corpus_inputs_sha256"):
        b = copy.deepcopy(rec)
        b["bindings"][key] = "other"
        check(f"a moved {key} binding is refused", P.authenticated(b, rec) is not None)


def test_draw():
    print("\n2. the draw")
    rec = _rec()
    a, b = P.draw(rec), P.draw(copy.deepcopy(rec))
    check("the same frame and seed draw the same sample", a == b)
    large = [w for s, w, _r in a if s == "r-colour rule"]
    small = [w for s, w, _r in a if s == "hw merger"]
    check("a stratum of 59 or more yields exactly 59", len(large) == P.SAMPLE)
    check("a smaller stratum is audited in full", len(small) == 10)
    seed = P.SEED
    try:
        P.SEED = seed + "x"
        c = P.draw(rec)
    finally:
        P.SEED = seed
    check("a different seed draws a different sample", c != a)


if __name__ == "__main__":
    test_authentication()
    test_draw()
    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILED")
        sys.exit(1)
    print("ALL PASS")

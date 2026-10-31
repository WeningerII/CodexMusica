#!/usr/bin/env python3
"""An unread word never vanishes from a derived sequence (2026-10-31,
`MISSING.md` M-311 F4, doctrine 79).

    python3 quality/test_sequence_unread.py

A word the dictionary cannot read contributes no units, so a sequence-scoped
channel over a member that holds it (`_seq`) used to read the member's
skeleton WITHOUT it. Under `parechesis / general consonance`'s subsequence
test a shorter skeleton is easier to contain, so the unknown manufactured a
True on Kingsley's `And o'er and o'er the sand` / `And round and round the
sand` -- the census witness -- while the same word in the OTHER member made
the pair refuse. Now either member holding an unread word reads None.
BB8's finding, #637 6545548911.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import lyric_harness  # noqa: E402,F401
from quality import phonology as PH  # noqa: E402
from quality import relations as R  # noqa: E402

FAILURES = []
PAR = R.REGISTRY["parechesis / general consonance"]


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def grade(a, b):
    from quality.revise import Reviser
    from quality.schemes import mandate
    got = Reviser().grade([a, b], mandate([["1", "2"]], n_lines=2,
                                          default_relation="schema:" + PAR.name))
    return None if got["refusals"] else not got["violations"]


def test_symmetric_unknown():
    kingsley = ("And o'er and o'er the sand,", "And round and round the sand,")
    check("the unread word in member 1 refuses (was True)",
          grade(*kingsley) is None)
    check("and in member 2, as before",
          grade(*reversed(kingsley)) is None)
    check("a readable pair is still judged",
          grade("And over and over the sand,", "And round and round the hill,") is False)


def test_span_reader():
    st = R.build_stream(["And o'er and o'er the sand,"], PH.get("eng"),
                        declaration={"language": "eng"})
    whole = next(R.enumerate_spans(R.WHOLE_LINE, st))
    check("a whole-line member over an unread word has no sequence",
          R._seq(whole, st, "consonants", R.DEFAULT_CHANNELS, "phonemic",
                 rule=R.WHOLE_LINE) is None)
    st = R.build_stream(["red brick wall"], PH.get("eng"),
                        declaration={"language": "eng"})
    whole = next(R.enumerate_spans(R.WHOLE_LINE, st))
    check("a readable line keeps its sequence",
          R._seq(whole, st, "consonants", R.DEFAULT_CHANNELS, "phonemic",
                 rule=R.WHOLE_LINE) is not None)


if __name__ == "__main__":
    test_span_reader()
    test_symmetric_unknown()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all sequence-unread checks pass")

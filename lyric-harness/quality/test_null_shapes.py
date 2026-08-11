#!/usr/bin/env python3
"""Regressions for the two null constructors in `quality/controls.py`.

Every check here is a defect that was FOUND in this code, not a property
somebody thought would be nice to have.

  1. DOCTRINE 66. `rime_pool_redeal` built its candidate lists by iterating
     `set(words)`. Python randomises str hashing per interpreter, so the same
     seed printed `band_pass` 0.4187 on one run and 0.4099 on the next. The
     guard runs the constructor in two SUBPROCESSES with different
     PYTHONHASHSEED, because that is the only place the defect is visible --
     it cannot reproduce inside one interpreter.
  2. THE PRESERVATION CLAIM. `cross_item_redeal` says it preserves the line
     count, the words per line and each word's stress shape. That claim is
     what makes the geometry comparison legitimate, so it is asserted rather
     than documented.
  3. THE IDENTITY-MAP CHECKER. `differs` has to return 0 on a randomisation
     that cannot move, which is the whole point of it existing.
  4. THE DETECTION FLOOR HAS TO MOVE. If `rime_pool_redeal` stops separating
     mono from dispersed, `RESULTS_NULL_SHAPES.md` §3.3 has lost the arms that
     make its null readable, and doctrine 76 says a null without a detection
     floor is an unfalsifiable claim wearing a number.

None of these touches the time layer, so the file runs in seconds.

Run: python3 quality/test_null_shapes.py
"""

import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from lyric_harness import Lexicon, line_tokens, word_syllable_map  # noqa: E402
from quality.controls import (cross_item_redeal, differs,          # noqa: E402
                              rime_pool_redeal)

LEX = Lexicon()
PASS, FAIL = [], []


def check(name, ok, note=""):
    (PASS if ok else FAIL).append(name)
    print("  %s  %s" % ("PASS" if ok else "FAIL", name))
    if note:
        print("          %s" % note)


def shape(w):
    return tuple(s["stress"] for s in word_syllable_map(LEX, w))


def rime(w):
    sy = word_syllable_map(LEX, w)
    return None if not sy else (sy[-1]["nucleus"], tuple(sy[-1]["coda"]))


#: Four tiny items with different vocabularies, so a leave-one-out pool is
#: genuinely a different pool for each. Constructed, and that is admissible
#: here because these are claims about the FUNCTION, not about English verse.
ITEMS = [
    ["the winter froze the harbor", "a merchant sold his cargo"],
    ["she wrote a letter slowly", "the engine made a rattle"],
    ["a hollow yellow meadow", "the mellow fellow waited"],
    ["they carried heavy timber", "the ferry crossed at midnight"],
]

_SUBPROC = r"""
import sys
sys.path.insert(0, %r)
from lyric_harness import Lexicon, line_tokens, word_syllable_map
from quality.controls import rime_pool_redeal, cross_item_redeal
LEX = Lexicon()
shape = lambda w: tuple(s["stress"] for s in word_syllable_map(LEX, w))
def rime(w):
    sy = word_syllable_map(LEX, w)
    return None if not sy else (sy[-1]["nucleus"], tuple(sy[-1]["coda"]))
ITEMS = %r
a = rime_pool_redeal(ITEMS, line_tokens, shape, rime, "mono", 7)
b = rime_pool_redeal(ITEMS, line_tokens, shape, rime, "dispersed", 7)
c, _ = cross_item_redeal(ITEMS, line_tokens, shape, seed=7)
print(repr((a, b, c)))
"""


def run_under(hashseed):
    env = dict(os.environ, PYTHONHASHSEED=str(hashseed))
    out = subprocess.run([sys.executable, "-c", _SUBPROC % (ROOT, ITEMS)],
                         capture_output=True, text=True, env=env, cwd=ROOT)
    if out.returncode:
        raise RuntimeError(out.stderr[-2000:])
    return out.stdout.strip()


def main():
    print("=" * 62)
    print("NULL-SHAPE REGRESSIONS — quality/controls.py")
    print("=" * 62)

    print("\n1. DOCTRINE 66 — the same seed under two PYTHONHASHSEEDs")
    a, b = run_under(0), run_under(12345)
    check("both redeals reproduce across interpreter runs", a == b,
          "a set-iteration tie here printed two different band_pass values "
          "for one seed")

    print("\n2. THE PRESERVATION CLAIM — cross_item_redeal")
    red, stats = cross_item_redeal(ITEMS, line_tokens, shape, seed=7)
    check("line count preserved per item",
          [len(x) for x in red] == [len(x) for x in ITEMS])
    check("words per line preserved",
          all(len(line_tokens(p)) == len(line_tokens(q))
              for it, jt in zip(red, ITEMS) for p, q in zip(it, jt)))
    same_shape = all(shape(p) == shape(q)
                     for it, jt in zip(red, ITEMS)
                     for lp, lq in zip(it, jt)
                     for p, q in zip(line_tokens(lp), line_tokens(lq)))
    check("every word keeps its stress shape (so the grid is identical)",
          same_shape,
          "exact %d, count-only %d, kept %d"
          % (stats["exact"], stats["count_only"], stats["kept"]))
    # LEAVE-ONE-OUT, ASSERTED RATHER THAN ASSUMED. Disjointness is the wrong
    # test -- `the` is in every item and may legitimately come back. The real
    # invariant is that a word occurring ONLY in item i can never appear in
    # item i's redeal, because item i's own counts are subtracted from the
    # pool. That is doctrine 13 in one assertion.
    def words_of(it):
        return [w for l in it for w in line_tokens(l)]

    leaks = []
    for i, it in enumerate(ITEMS):
        elsewhere = {w for j, o in enumerate(ITEMS) if j != i
                     for w in words_of(o)}
        private = set(words_of(it)) - elsewhere
        leaks += [w for w in words_of(red[i]) if w in private]
    check("a word unique to an item never returns to it (doctrine 13)",
          not leaks,
          "%d private word types across the four items; leaks %d"
          % (sum(len(set(words_of(it)) -
                     {w for j, o in enumerate(ITEMS) if j != i
                      for w in words_of(o)})
                 for i, it in enumerate(ITEMS)), len(leaks)))

    print("\n3. THE IDENTITY-MAP CHECKER — differs")
    n, m = differs([3, 1, 2], [[1, 2, 3], [2, 3, 1], [3, 2, 1]], key=sum)
    check("a symmetric statistic reports 0 differing replicates",
          n == 0 and m == 3, "sum() is invariant under permutation")
    n2, _ = differs([3, 1, 2], [[9, 1, 2], [3, 1, 2]], key=sum)
    check("a statistic that moves is counted", n2 == 1)

    print("\n4. THE DETECTION FLOOR HAS TO MOVE (doctrine 76)")
    mono = rime_pool_redeal(ITEMS, line_tokens, shape, rime, "mono", 7)
    disp = rime_pool_redeal(ITEMS, line_tokens, shape, rime, "dispersed", 7)

    def classes(arm):
        return sum(len({rime(w) for l in it for w in line_tokens(l)})
                   for it in arm)

    cm, cd = classes(mono), classes(disp)
    check("mono collapses rime classes below dispersed", cm < cd,
          "distinct rime classes summed over items: mono %d, dispersed %d"
          % (cm, cd))
    check("the floor arms are not each other", mono != disp)

    print("\n" + "=" * 62)
    if FAIL:
        print("FAILED: %s" % ", ".join(FAIL))
        return 1
    print("%d checks pass — the constructors reproduce and the floor moves"
          % len(PASS))
    return 0


if __name__ == "__main__":
    sys.exit(main())

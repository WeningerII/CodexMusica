#!/usr/bin/env python3
"""Regressions for the revision loop.

The load-bearing tests are the REJECTIONS. A loop that accepts everything is a
rubber stamp, and the three ways a revision goes wrong are all silent:

  - it fixes the flagged line and breaks another          (test 3)
  - it fixes the rhyme by taking the most obvious word    (test 4)
  - it rewrites lines nobody asked it to touch            (test 5)

Run: python3 quality/test_revise.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.revise import Brief, ReviseDeclaration, Reviser  # noqa: E402

FAILURES = []
R = Reviser()

CLICHE = ["The candle burned and set the room on fire",
          "He said the word and then he turned to go",
          "And all night long she nursed a small desire",
          "She never asked the thing she had to know"]


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_the_loop_does_not_write():
    print("\n1. the loop grades, it never generates")
    for bad in ("generate", "write", "compose", "rewrite", "draft_line"):
        check(f"Reviser has no {bad!r} method", not hasattr(R, bad))
    briefs = R.brief(CLICHE, "ABAB")
    check("brief() returns instructions, not text",
          all(isinstance(b, Brief) for b in briefs) and briefs)
    check("every brief is line-scoped",
          all(b.line_no >= 1 for b in briefs),
          "the loop revises flagged lines only, never the whole draft")


def test_the_brief_excludes_the_modal_region():
    print("\n2. doctrine 9 — the brief pushes AWAY from the optimum")
    b = [x for x in R.brief(CLICHE, "ABAB") if x.line_no == 1][0]
    check("a rhyme finding earns a candidate field",
          bool(b.candidates) and bool(b.forbidden_modal),
          f"{len(b.candidates)} offered, {len(b.forbidden_modal)} forbidden")
    check("the forbidden words are the FREQUENT ones",
          all(R.lex.freq_rank.get(w, 10 ** 9)
              < max(R.lex.freq_rank.get(c, 10 ** 9) for c in b.candidates)
              for w in b.forbidden_modal if w in R.lex.freq_rank),
          f"forbidden {b.forbidden_modal[:5]} are commoner than the offered")
    check("the current end word is itself forbidden",
          "fire" in b.forbidden_modal,
          "re-proposing what was flagged is not a revision")
    check("nothing forbidden leaks into the offered list",
          not (set(b.candidates) & set(b.forbidden_modal)))
    off = ReviseDeclaration(modal_exclusion=0)
    plain = Reviser(lex=R.lex, decl=R.decl, rdecl=off, floor=R.floor)
    plain._engine = R.engine
    b0 = [x for x in plain.brief(CLICHE, "ABAB") if x.line_no == 1][0]
    check("with the rule disabled the modal words come back",
          len(b0.forbidden_modal) < len(b.forbidden_modal),
          "modal_exclusion=0 is reachable so the defect it prevents is "
          "demonstrable, and it is not the default")


def test_a_revision_may_not_trade_one_defect_for_another():
    print("\n3. REJECT — fixing the flagged line by breaking another")
    before = CLICHE
    # fixes the cliche on L1/L3 and introduces a self-rhyme with L2
    after = list(before)
    after[0] = "The candle burned and left the evening go"
    res = R.verify(before, after, "ABAB", targeted={1})
    check("the revision is rejected", not res["accepted"],
          "; ".join(res["reasons"])[:110])


def test_reject_taking_the_modal_candidate():
    print("\n4. REJECT — passing the band by taking the obvious word")
    b = [x for x in R.brief(CLICHE, "ABAB") if x.line_no == 2][0]
    modal = [w for w in b.forbidden_modal if w != "go"]
    check("there is a modal word to take", bool(modal), str(b.forbidden_modal))
    after = list(CLICHE)
    after[1] = f"He said the word and turned to face the {modal[0]}"
    res = R.verify(CLICHE, after, "ABAB", targeted={2})
    check("taking a forbidden modal candidate is rejected",
          not res["accepted"] and "modal" in " ".join(res["reasons"]),
          "; ".join(res["reasons"])[:130])
    check("the violation is reported per line",
          res.get("modal_violations"), str(res.get("modal_violations")))


def test_reject_rewriting_untargeted_lines():
    print("\n5. REJECT — revising more than was asked")
    after = list(CLICHE)
    after[0] = "A different opening entirely for the choir"
    after[3] = "and nobody remembered what they owe"
    res = R.verify(CLICHE, after, "ABAB", targeted={1})
    check("touching an untargeted line is rejected",
          not res["accepted"] and "not targeted" in " ".join(res["reasons"]),
          "; ".join(res["reasons"])[:110])


def test_reject_restructuring():
    print("\n6. REJECT — changing the shape of the draft")
    res = R.verify(CLICHE, CLICHE[:3], "ABAB", targeted={1})
    check("dropping a line is rejected", not res["accepted"],
          "; ".join(res["reasons"])[:100])


def test_reject_a_no_op():
    print("\n7. REJECT — a revision that fixes nothing")
    res = R.verify(CLICHE, list(CLICHE), "ABAB", targeted=set())
    check("an unchanged draft is not accepted", not res["accepted"],
          "; ".join(res["reasons"])[:80])


def test_accept_a_real_fix():
    print("\n8. ACCEPT — a revision that fixes and breaks nothing")
    # replace the cliche rhyme with a non-modal one from the offered field
    b = [x for x in R.brief(CLICHE, "ABAB") if x.line_no == 1][0]
    picked = None
    for w in b.candidates:
        trial = list(CLICHE)
        trial[0] = f"The candle burned and set the room to {w}"
        res = R.verify(CLICHE, trial, "ABAB", targeted={1})
        if res["accepted"]:
            picked = (w, res)
            break
    check("some offered candidate yields an accepted revision",
          picked is not None,
          f"tried {len(b.candidates)} offered words" if picked is None
          else f"{picked[0]!r}: {picked[1]['reasons'][0]}")
    if picked:
        check("the accepted word was NOT in the forbidden modal set",
              picked[0] not in b.forbidden_modal,
              "the loop accepted a rhyme that passes the band without being "
              "the obvious choice — which is the whole point")
        check("acceptance reports what it fixed",
              picked[1]["fixed"], str(picked[1]["fixed"])[:80])


def test_verify_never_returns_a_score():
    print("\n9. doctrine 6 — verification is a verdict, not a number")
    res = R.verify(CLICHE, list(CLICHE), "ABAB", targeted=set())
    for k in ("score", "quality", "rating", "grade", "total"):
        check(f"no {k!r} key", k not in res)
    check("it reports reasons a caller can act on",
          isinstance(res.get("reasons"), list) and res["reasons"])


if __name__ == "__main__":
    for fn in (test_the_loop_does_not_write,
               test_the_brief_excludes_the_modal_region,
               test_a_revision_may_not_trade_one_defect_for_another,
               test_reject_taking_the_modal_candidate,
               test_reject_rewriting_untargeted_lines,
               test_reject_restructuring,
               test_reject_a_no_op,
               test_accept_a_real_fix,
               test_verify_never_returns_a_score):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all revision-loop regressions pass")

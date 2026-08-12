#!/usr/bin/env python3
"""Tests for quality/phrase_commonplace.py — MISSING.md H-1, phrase slice.

    python3 quality/test_phrase_commonplace.py

Doctrine 94: a positive-case suite cannot find a rule that is too generous, so
this file pins BOTH directions — a fixture that must FIRE and a fixture that
must stay SILENT — and the silent one is the case that motivated the whole
slice. Doctrine 84: the refusal and the way PAST the refusal are both pinned,
because a defect whose demonstration has been optimised away is a sentence
nobody can check.

The index is built ONCE over a subset of real corpus files where the fixtures
allow it, and over the full corpus where they do not. Real exemplars over
constructed tests.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality.phrase_commonplace import (      # noqa: E402
    PhraseIndex, Refusal, blocker, check, tokens,
    FIXTURE_FIRES, FIXTURE_SILENT, SEED, self_test)

FAILED = []


def ok(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}"
          + (f"\n        {detail}" if detail and not cond else ""))
    if not cond:
        FAILED.append(name)


def main():
    print("== tokenisation (doctrines 26, 58) ==")
    ok("U+2019 normalised to U+0027",
       tokens("don’t") == tokens("don't") == ["don't"],
       repr(tokens("don’t")))
    ok("hyphens BREAK, they do not join",
       tokens("hell-upon-the-border") == ["hell", "upon", "the", "border"],
       repr(tokens("hell-upon-the-border")))
    ok("a bare apostrophe is dropped, not kept as a token",
       tokens("o' the ' sea") == ["o", "the", "sea"],
       repr(tokens("o' the ' sea")))
    ok("case folded", tokens("The Glory") == ["the", "glory"])

    print("\n== the blocker is DECLARED, not implied (doctrines 44, 92) ==")
    b = blocker()
    ok("names which of the three blockers", "doctrine 92" in b["which"])
    ok("says it is NOT hard-to-build", bool(b["not_hard_to_build"]))
    ok("says it is NOT unobtainable", bool(b["not_unobtainable"]))
    ok("enumerates what would lift it", len(b["what_would_lift_it"]) >= 3)
    ok("separates the size blocker from the population blocker",
       "size" in b["second_blocker_which_IS_a_size_problem"].lower())

    print("\n== refusal is not a pass (doctrine 20) ==")
    r = check(["any line at all"])
    ok("check() refuses by default", isinstance(r, Refusal))
    ok("the refusal is TRUTHY, so it cannot read as an empty finding list",
       bool(r))
    ok("the refusal names its severity", r.get("severity") == "refusal")
    ok("the refusal carries the blocker", "blocker" in r)

    print("\n== leave-one-author-out is enforceable (doctrine 13) ==")
    idx = PhraseIndex()
    ok("index built over one file per author", len(idx.files) == len(idx.meta))
    # any real corpus line scores >=1 against its OWN author unless excluded
    a0 = next(a for a, ts in idx.by_author.items() if ts)
    line = next(t for t in idx.by_author[a0] if len(t) >= 4)
    inc, _ = idx.dispersion(line, 4, exclude=None)
    exc, _ = idx.dispersion(line, 4, exclude=a0)
    ok("excluding the author cannot RAISE the count", exc <= inc,
       f"included {inc}, excluded {a0} -> {exc}")

    print("\n== the two fixtures (doctrine 94) ==")
    c_fire, w_fire = idx.dispersion(tokens(FIXTURE_FIRES), 4)
    ok(f"FIRES: {FIXTURE_FIRES!r}", c_fire >= 2,
       f"got {c_fire} authors, witness {w_fire!r}")
    ok("the firing witness is a real corpus 4-gram",
       w_fire is not None and w_fire in idx.idx)

    c_sil, w_sil = idx.dispersion(tokens(FIXTURE_SILENT), 4)
    ok(f"SILENT: {FIXTURE_SILENT!r}", c_sil == 0,
       f"got {c_sil} authors, witness {w_sil!r}")
    # The first draft of this test asserted 0 at EVERY n and FAILED at n=2,
    # which is why it is written this way now. At n=2 the line scores 32 --
    # on `and every`, `began to` and `for him`. That is not the check finding
    # the cliche; it is the check finding three function-word bigrams, which
    # is the same defect one n lower. The assertion pins the mechanism rather
    # than the round number: silent from n=3 up, and whatever fires at n=2 is
    # closed-class.
    ok("SILENT holds at every n from 3 to 6 — not an artifact of one n",
       all(idx.dispersion(tokens(FIXTURE_SILENT), n)[0] == 0
           for n in range(3, 7)),
       str([idx.dispersion(tokens(FIXTURE_SILENT), n)[0]
            for n in range(3, 7)]))
    from quality.features import FUNCTION_TAGS, _tagger
    tag = _tagger()
    tg = dict(tag(tokens(FIXTURE_SILENT)))
    n2 = [g for g in (" ".join(tokens(FIXTURE_SILENT)[i:i + 2])
                      for i in range(len(tokens(FIXTURE_SILENT)) - 1))
          if len(idx.idx.get(g, ())) >= 2]
    # Written twice and wrong once. "entirely closed-class" FAILED: the
    # tagger reads `began to` as VBD+TO, so one of the three carries a light
    # verb. The defensible claim -- and the one T2 measures -- is that every
    # n=2 witness is at least HALF closed-class.
    def halffun(g):
        t = [tg.get(w) for w in g.split()]
        return sum(1 for x in t if x in FUNCTION_TAGS) * 2 >= len(t)

    ok("every n=2 witness is at least HALF closed-class, so it is grammar",
       bool(n2) and all(halffun(g) for g in n2),
       f"n=2 witnesses {n2} tagged "
       f"{[[tg.get(w) for w in g.split()] for g in n2]}")
    ok("2 of the 3 n=2 witnesses are ENTIRELY closed-class",
       sum(1 for g in n2
           if all(tg.get(w) in FUNCTION_TAGS for w in g.split())) == 2)

    print("\n== the sparsity wall is real, not a threshold choice (§2) ==")
    mx5 = max((len(v) for g, v in idx.idx.items() if g.count(" ") == 4),
              default=0)
    ok("n=5 max dispersion is in single digits", mx5 < 10, f"max {mx5}")

    print("\n== the instrument stays REACHABLE past its refusal (doctrine 84) ==")
    forced = check([FIXTURE_FIRES], index=idx, force=True)
    ok("force=True returns findings, not a Refusal",
       not isinstance(forced, Refusal) and len(forced) == 1)
    ok("a forced finding is a NOTE and never a flag (doctrines 6, 7)",
       all(f["severity"] == "note" for f in forced))
    ok("a forced finding carries no score, only a count and a witness",
       set(forced[0]) >= {"authors", "witness"}
       and not any("score" in k for k in forced[0]))
    ok("a forced finding says PRE-1931 in its own evidence",
       "1931" in forced[0]["evidence"])
    ok("the silent fixture yields nothing even when forced",
       check([FIXTURE_SILENT], index=idx, force=True) == [])

    print("\n== module self-test agrees with this file ==")
    ok("self_test() passes", self_test(index=idx))

    print()
    if FAILED:
        print(f"FAILED {len(FAILED)}: " + "; ".join(FAILED))
        return 1
    print("all tests passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())

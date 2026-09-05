#!/usr/bin/env python3
"""The one dealing-and-timing idiom, held to its arithmetic.

`quality/shard.py` is what every dealt suite calls (`MISSING.md` M-244). A
suite that is dealt wrong fails in two silent ways: a section run by NO
shard passes by omission, and a shard that runs everything looks like a
shard that ran its share. Both are pinned here on the arithmetic, not on a
sample run.

Run: python3 quality/test_shard.py
"""
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
from quality import shard as S  # noqa: E402

FAILURES = []


def check(name, ok, detail=""):
    print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not ok:
        FAILURES.append(name)


def _env(val):
    if val is None:
        os.environ.pop("TEST_SHARD_PROBE", None)
    else:
        os.environ["TEST_SHARD_PROBE"] = val


def test_the_deal_is_exactly_once():
    print("\n1. every section runs EXACTLY ONCE across a full k=1..n matrix, "
          "for every n that CI uses or might")
    sections = tuple(f"s{i}" for i in range(53))
    for n in (1, 2, 3, 4, 5, 6, 8, 12):
        seen = []
        for k in range(1, n + 1):
            _env(f"{k}/{n}")
            chosen, kn = S.dealt(sections, "TEST_SHARD_PROBE")
            seen.extend(chosen)
            check(f"n={n} k={k}: the shard reports its coordinate and holds "
                  f"only indices ≡ {k - 1} (mod {n})",
                  kn == (k, n)
                  and all(sections.index(c) % n == k - 1 for c in chosen))
        check(f"n={n}: the union of the shards is the whole tuple, each "
              f"section once, in tuple order within a shard",
              sorted(seen) == sorted(sections) and len(seen) == len(sections))
    _env(None)
    chosen, kn = S.dealt(sections, "TEST_SHARD_PROBE")
    check("unset runs everything, in order, and reports no coordinate — "
          "the local command nobody has to relearn",
          chosen == list(sections) and kn is None)
    _env("")
    chosen, kn = S.dealt(sections, "TEST_SHARD_PROBE")
    check("an EMPTY value is unset, not a refusal",
          chosen == list(sections) and kn is None)


def test_a_bad_coordinate_refuses():
    print("\n2. a malformed or out-of-range coordinate REFUSES rather than "
          "running the whole suite as if it were its share")
    for bad in ("0/4", "5/4", "2", "a/b", "1/0"):
        _env(bad)
        try:
            S.dealt(("a", "b"), "TEST_SHARD_PROBE")
            refused = False
        except SystemExit as e:
            refused = "refuses" in str(e)
        check(f"{bad!r} refuses by name", refused)
    _env(None)


def test_run_sections_times_and_gates():
    print("\n3. run_sections times every section it ran, prints them slowest "
          "first, runs `always` on every shard, and gates on the failures "
          "list AFTER the sections ran")
    ran = []

    def mk(name):
        def fn():
            ran.append(name)
        fn.__name__ = name
        return fn
    secs = tuple(mk(f"sec{i}") for i in range(5))
    always = (mk("everywhere"),)
    fails = []
    for k in (1, 2):
        ran.clear()
        _env(f"{k}/2")
        out = io.StringIO()
        rc = S.run_sections(secs, "TEST_SHARD_PROBE", fails, "footer text",
                            always=always, out=out)
        text = out.getvalue()
        check(f"shard {k}/2: exit 0 on an empty failures list and the footer "
              f"is the last line", rc == 0 and text.rstrip().endswith("footer text"))
        check(f"shard {k}/2: `always` ran here too, first",
              ran and ran[0] == "everywhere")
        check(f"shard {k}/2: the dealt sections are the residue class",
              [r for r in ran[1:]] == [f"sec{i}" for i in range(5)
                                       if i % 2 == k - 1])
        check(f"shard {k}/2: SECTION COST names every section that ran and "
              f"the TOTAL counts them (dealt + always)",
              "SECTION COST" in text
              and all(r in text for r in ran)
              and f"TOTAL, this shard ({len(ran)} of {len(secs) + 1} "
                  f"sections)" in text)
    _env(None)
    out = io.StringIO()
    rc = S.run_sections(secs, "TEST_SHARD_PROBE", ["a check that failed"],
                        "footer text", out=out)
    check("a non-empty failures list exits 1 and prints FAILING, never the "
          "footer", rc == 1 and "1 FAILING: a check that failed" in out.getvalue()
          and "footer text" not in out.getvalue())
    check("...and unset ran all five", ran[-5:] == [f"sec{i}" for i in range(5)])


def test_every_dealt_suite_calls_the_one_idiom():
    print("\n4. every suite CI deals calls `quality.shard.run_sections` and "
          "keeps no residue arithmetic of its own (doctrine 1)")
    import re
    ci = open(os.path.join(HERE, "..", "..", ".github", "workflows",
                           "ci.yml"), encoding="utf-8").read()
    dealt = sorted(set(re.findall(r"TEST_([A-Z]+)_SHARD:", ci)))
    check("ci.yml deals at least the five suites this entry moved",
          {"VERBS", "PLAN", "REVISE", "LOOP", "CAPACITY"} <= set(dealt),
          str(dealt))
    for name in dealt:
        path = os.path.join(HERE, f"test_{name.lower()}.py")
        src = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
        # CODE, not comments: a suite may EXPLAIN the deal in prose beside
        # the call ("index ≡ k-1 (mod n)"); what it may not do is compute it.
        code = "\n".join(l for l in src.splitlines()
                         if not l.lstrip().startswith("#"))
        check(f"test_{name.lower()}.py calls run_sections and spells no "
              f"`% n ==` residue of its own (in code; comments may explain it)",
              "from quality.shard import run_sections" in src
              and f'"TEST_{name}_SHARD"' in src
              and not re.search(r"% *n *== *k *- *1", code),
              path)


if __name__ == "__main__":
    for fn in (test_the_deal_is_exactly_once, test_a_bad_coordinate_refuses,
               test_run_sections_times_and_gates,
               test_every_dealt_suite_calls_the_one_idiom):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("one deal, exactly once, timed, everywhere it is used")

#!/usr/bin/env python3
"""ONE IDIOM FOR DEALING A SUITE'S SECTIONS ACROSS CI SHARDS, AND TIMING THEM.

    from quality.shard import run_sections
    sys.exit(run_sections(_SECTIONS, "TEST_FOO_SHARD", FAILURES,
                          footer="all foo regressions pass"))

`test_verbs.py` grew this idiom in two sittings — residue dealing on
2026-08-18, per-section cost printed slowest-first on 2026-09-01 — and it
lived INLINE in that file's `__main__`, so no other suite had it: `test_plan`
(the longest process in CI, `MISSING.md` M-182/M-244), `test_revise` and
`test_loop` all ran their sections in one serial block with no shard
coordinate and no cost printout. A CI job's wall is its LONGEST SINGLE
PROCESS, and a suite that cannot be dealt is a floor no shard count can
beat. This module is the one definition (doctrine 1); every suite that
wants to be dealt calls it, and `test_verbs.py` calls it too rather than
keeping its own spelling.

THE DEAL. `ENV=k/n` runs the sections whose index in `sections` is
congruent to k-1 (mod n). Every section runs EXACTLY ONCE across a full
k=1..n matrix by the arithmetic of residue classes — a section skipped by
every shard is impossible by construction, not by review. Unset (or empty)
runs everything, byte-identical to an undealt suite: the coordinate is a
CI-shape one and never a semantics one. `k` outside 1..n REFUSES.

THE ORDER IS THE BALANCE. Residue dealing balances by ACCIDENT when the
tuple is in the order the sections were written (chronological); it
balances by DESIGN when the tuple is in COST ORDER, slowest first — then
the n most expensive sections land one per shard, and the tail is dealt
round-robin under them. So `sections` should be cost-ordered, and the
printout below is what a cost-ordered tuple is built from: every run prints
each section's cost slowest-first, on green runs too, because a cost that
is only visible when something fails is a cost nobody sees. The union of a
full matrix's printouts is the whole file's profile.

WHAT IT DOES NOT DO. It does not split a SECTION: a section that is itself
one long serial loop is the floor, and the remedy is inside that section
(see `test_plan.py` §3's seed pool and `TEST_PLAN_WORKERS`). It does not
reorder execution within a shard — sections run in tuple order, so a
suite whose sections share state through order still behaves.
"""
import os
import sys
import time


def dealt(sections, env):
    """-> (chosen sections in tuple order, (k, n) or None).

    Reads `ENV` as `k/n`. Refuses a malformed or out-of-range value rather
    than silently running everything, because a shard that runs the whole
    suite looks exactly like a shard that ran its share."""
    raw = os.environ.get(env, "").strip()
    if not raw:
        return list(sections), None
    try:
        k, n = (int(x) for x in raw.split("/"))
    except ValueError:
        raise SystemExit(f"{env}={raw!r} refuses: want k/n, two integers")
    if not (1 <= k <= n):
        raise SystemExit(f"{env}={raw!r} refuses: k must be in 1..n")
    return [f for i, f in enumerate(sections) if i % n == k - 1], (k, n)


def run_sections(sections, env, failures, footer, *, always=(), out=None):
    """Run the dealt sections, time each, print the profile, return the
    exit code (0 clean, 1 when `failures` is non-empty at the end).

    `failures` is the suite's own accumulating list — the shared state
    every `check()` appends to — read AFTER the sections ran.

    `always` names sections that run on EVERY shard, ahead of the dealt
    ones, because they deal their own work by the same coordinate: a
    section that is one long loop over independent items (`test_plan.py`
    §3's twenty seeds) reads `ENV` itself and takes the items ≡ k-1 (mod
    n), so the loop that no section deal could split is dealt inside. Its
    cost is timed and printed like any other, so the profile stays whole."""
    out = out or sys.stdout
    chosen, kn = dealt(sections, env)
    if kn:
        k, n = kn
        print(f"SHARD {k}/{n}: {len(chosen)} of {len(sections)} sections "
              f"(dealt by index residue over the cost-ordered tuple)"
              + (f" + {len(always)} run on every shard over their own "
                 f"residue" if always else ""), file=out)
    times = []
    for fn in list(always) + chosen:
        t0 = time.time()
        fn()
        times.append((time.time() - t0, fn.__name__))
    print("=" * 62, file=out)
    print("SECTION COST, slowest first — the top line is the floor a shard "
          "count cannot beat:", file=out)
    for sec, name in sorted(times, reverse=True):
        print(f"  {sec:8.1f}s  {name}", file=out)
    print(f"  {sum(s for s, _ in times):8.1f}s  TOTAL, this shard "
          f"({len(times)} of {len(sections) + len(always)} sections)",
          file=out)
    print("=" * 62, file=out)
    if failures:
        print(f"{len(failures)} FAILING: {', '.join(failures)}", file=out)
        return 1
    print(footer, file=out)
    return 0


def main(argv=None):
    """`python3 quality/shard.py k/n N` — print which of N sections (0-based
    indices) shard k of n runs, so a person can see a deal before running it.

    The run itself lives in each suite's `__main__`; this entrance exists so
    the module has a door of its own (`wiring` names a library with no caller
    and no way to run it STRANDED, and test imports are not callers)."""
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 2 or "/" not in argv[0] or not argv[1].isdigit():
        print("usage: python3 quality/shard.py k/n N   "
              "(the 0-based indices of N sections that shard k of n runs)",
              file=sys.stderr)
        return 2
    os.environ["SHARD_PROBE"] = argv[0]
    try:
        chosen, kn = dealt(list(range(int(argv[1]))), "SHARD_PROBE")
    except SystemExit as e:              # a refusal is exit 2 here, as on every verb
        print(f"REFUSED — {e}", file=sys.stderr)
        return 2
    k, n = kn
    print(f"shard {k}/{n} of {argv[1]} sections runs {len(chosen)}: "
          + " ".join(str(i) for i in chosen))
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""REGRESSION TESTS for `quality/verify_entries.py`'s prose scope.

    python3 quality/test_verify_entries.py

WHY THIS FILE EXISTS. `REPO_PATH_EXISTS` was a working instrument pointed at
two files. `MISSING.md` and `BACKLOG.md` were swept for stale paths and every
other document in the repo was swept by nothing, so a path could go stale in
CLAUDE.md and no check in the repository would say so. Widening the scope is
one line; keeping it honest is what these tests are for, and they hold three
separate things:

  1. THE SCOPE FIRES. A document naming a path that does not exist must
     produce a FALSE verdict. Without this the widening is unfalsifiable --
     `PROSE_DOCS` could be misspelled, `prose_entry` could drop every block,
     and a green run would prove nothing (doctrine 76).
  2. THE DISCLAIMER IS HONOURED. A document whose sentence says the path does
     not exist must PASS. A checker that failed a document for correctly
     recording a deletion would be punishing the most careful writing in the
     repo, which is the argument `PATH_ABSENT_PHRASES` already makes for
     the registers.
  3. THE WINDOW BINDS TO ITS OWN SUBJECT. An absence phrase belonging to a
     DIFFERENT path in the same sentence must not be borrowed. This is the
     live CLAUDE.md:958 defect that the widening exposed, and it is the one
     that decides whether the widened check is shippable at all.

They drive the SHIPPED reader and the SHIPPED shape -- `prose_entry` and
`shape_repo_path` -- never a copy of their logic. A test that re-implemented
the segmentation would go green against a reader that had stopped working,
which is the failure this whole layer exists to catch.
"""

from __future__ import annotations

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from quality.verify_entries import (           # noqa: E402
    FALSE, PROSE_DOCS, PROSE_SHAPES, REFUSED, TRUE,
    prose_entry, prose_self_test, read_prose, shape_repo_path, sweep_prose,
)

#: A path that cannot exist, so the STALE tests can never expire the way a
#: control pinned to a real defect does. `POSITIVE_CONTROLS`' own HASATTR note
#: records that lesson: a probe aimed at a live gap goes dark the moment
#: somebody closes the gap, which is exactly when it was worth having.
GONE = "quality/no_such_file_anywhere.py"
LIVE = "quality/counters.py"

_FAILURES = []


def check(name, ok, detail=""):
    print("  [%s] %s%s" % ("ok  " if ok else "FAIL", name,
                           "" if ok else "   " + detail))
    if not ok:
        _FAILURES.append(name)


def verdicts(doc):
    """-> [Verdict] from the SHIPPED reader and the SHIPPED shape."""
    out = []
    for seg in prose_entry("PROBE.md", doc).segments:
        v = shape_repo_path(seg)
        if v is not None:
            out.append(v)
    return out


# ---------------------------------------------------------------------------
# 1. A backticked path that does not exist must FAIL
# ---------------------------------------------------------------------------


def test_stale_path_fails():
    print("\n1. a cited path that is not on disk must be FALSE")

    vs = verdicts("The loop is built by `%s`, which grades every draft.\n" % GONE)
    check("a stale path produces exactly one verdict", len(vs) == 1,
          "got %d" % len(vs))
    check("and that verdict is FALSE", bool(vs) and vs[0].status == FALSE,
          "got %s" % [v.status for v in vs])
    check("and it names the path it failed on",
          bool(vs) and GONE in vs[0].claim,
          "claim was %r" % (vs[0].claim if vs else None))

    # The same document with the path REPLACED by a live one must pass, so the
    # test cannot go green by the shape refusing to fire on either.
    vs = verdicts("The loop is built by `%s`, which grades every draft.\n" % LIVE)
    check("the same sentence with a live path is TRUE",
          len(vs) == 1 and vs[0].status == TRUE,
          "got %s" % [v.status for v in vs])


# ---------------------------------------------------------------------------
# 2. A sentence that disclaims the path must PASS
# ---------------------------------------------------------------------------


def test_disclaimed_path_passes():
    print("\n2. a cited path the sentence disclaims must be TRUE")

    for phrase in ("does not exist",
                   "is not in the repository",
                   "no longer exists",
                   "was deleted"):
        vs = verdicts("The rule was implemented in `%s`, which %s.\n"
                      % (GONE, phrase))
        check("disclaimed by %r" % phrase,
              len(vs) == 1 and vs[0].status == TRUE,
              "got %s" % [(v.status, v.measured[:60]) for v in vs])

    # The inverse direction is a bug too, and the register relies on it: a
    # sentence claiming a LIVE path is absent is itself a false claim.
    vs = verdicts("`%s` does not exist.\n" % LIVE)
    check("a live path asserted ABSENT is FALSE",
          len(vs) == 1 and vs[0].status == FALSE,
          "got %s" % [v.status for v in vs])


# ---------------------------------------------------------------------------
# 3. The absence phrase must bind to its own subject
# ---------------------------------------------------------------------------


def test_absence_phrase_binds_to_its_own_path():
    print("\n3. an absence phrase belonging to another subject is not borrowed")

    # CLAUDE.md:958, verbatim in shape. `verse.txt` carries no `/`, so PATH_RE
    # never sees it and the phrase it owns had no subject to attach to.
    doc = ("`quality/RESULTS_NULL_SHAPES.md`, `quality/NULL_AUDIT.md` §1.1, "
           "and METHOD § The sonnet battery for why `verse.txt` was deleted.\n")
    vs = verdicts(doc)
    check("the live CLAUDE.md:958 sentence is TRUE",
          len(vs) == 1 and vs[0].status == TRUE,
          "got %s" % [(v.status, v.measured[:90]) for v in vs])

    # And the phrase still binds when it is genuinely that path's own.
    vs = verdicts("`%s` was deleted.\n" % GONE)
    check("an unbroken phrase still binds to its path",
          len(vs) == 1 and vs[0].status == TRUE,
          "got %s" % [v.status for v in vs])

    # A second path AFTER the phrase must not inherit it either.
    vs = verdicts("`%s` does not exist, unlike `%s`.\n" % (GONE, LIVE))
    check("a later live path does not inherit the phrase",
          len(vs) == 1 and vs[0].status == TRUE,
          "got %s" % [(v.status, v.measured[:90]) for v in vs])


# ---------------------------------------------------------------------------
# 4. A struck run is the document's own correction, not a live claim
# ---------------------------------------------------------------------------


def test_struck_paths_are_not_claims():
    print("\n4. a path inside a `~~...~~` run is not reported")

    vs = verdicts("~~The loop is built by `%s`.~~ It is not, any more.\n" % GONE)
    check("a struck stale path produces no FALSE",
          not [v for v in vs if v.status == FALSE],
          "got %s" % [(v.status, v.claim) for v in vs])

    # `_unstrike` must not move any line: a shifted line number silently broke
    # the register's status join once already, and the prose reader keys its
    # report on the same numbers.
    doc = "line one\n\n~~struck\nacross\nlines~~\n\nA stale `%s`.\n" % GONE
    segs = prose_entry("PROBE.md", doc).segments
    hit = [s for s in segs if GONE in s.text]
    check("a multi-line struck run does not shift line numbers",
          len(hit) == 1 and hit[0].lineno == 7,
          "reported line %s, wanted 7" % ([s.lineno for s in hit] or None))


# ---------------------------------------------------------------------------
# 5. The scope itself: the declared documents, and only the declared shape
# ---------------------------------------------------------------------------


def test_scope_is_declared_and_readable():
    print("\n5. the declared scope")

    check("CLAUDE.md, README.md and quality/METHOD.md are all in scope",
          set(PROSE_DOCS) >= {"CLAUDE.md", "README.md", "quality/METHOD.md"},
          "PROSE_DOCS is %s" % (PROSE_DOCS,))
    check("only REPO_PATH_EXISTS is asked of them",
          tuple(PROSE_SHAPES) == ("REPO_PATH_EXISTS",),
          "PROSE_SHAPES is %s" % (PROSE_SHAPES,))

    entries, refusals = read_prose()
    check("every declared document is readable at HEAD",
          not refusals, "refused: %s" % (refusals,))
    check("every declared document yields segments",
          len(entries) == len(PROSE_DOCS)
          and all(e.segments for e in entries),
          "segment counts %s" % [(e.id, len(e.segments)) for e in entries])

    # The live sweep must be GREEN, and it must be green having looked at
    # something. A scope that reads no path at all is the null this whole
    # widening would otherwise be indistinguishable from.
    results, refused = sweep_prose()
    false = [(s, v) for s, v in results if v.status == FALSE]
    check("the live prose sweep finds no stale path", not false,
          "; ".join("%s:%d %s" % (s.entry.source, s.lineno, v.measured)
                    for s, v in false))
    check("and it is green having read a real population",
          len(results) >= 50 and not refused,
          "%d verdict(s), refusals %s" % (len(results), refused))


# ---------------------------------------------------------------------------
# 6. The shipped module's own probes
# ---------------------------------------------------------------------------


def test_shipped_probes():
    print("\n6. verify_entries.py's own prose probes")
    for name, reason in prose_self_test():
        check(name, reason == "ok", reason)


def main():
    print("=" * 78)
    print("PROSE SCOPE — quality/verify_entries.py")
    print("=" * 78)
    test_stale_path_fails()
    test_disclaimed_path_passes()
    test_absence_phrase_binds_to_its_own_path()
    test_struck_paths_are_not_claims()
    test_scope_is_declared_and_readable()
    test_shipped_probes()
    print()
    print("=" * 78)
    if _FAILURES:
        print("FAIL — %d: %s" % (len(_FAILURES), ", ".join(_FAILURES)))
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())

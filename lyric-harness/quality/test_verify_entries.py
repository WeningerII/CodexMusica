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

import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import quality.verify_entries as VE  # noqa: E402
from quality.verify_entries import (           # noqa: E402
    FALSE, PROSE_DOCS, PROSE_SCOPE, PROSE_SHAPES, REFUSED, ROOT, TRUE,
    prose_entry, prose_self_test, read_prose, shape_capacity_figure,
    shape_floor_threshold, shape_repo_path, sweep_prose,
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
    check("REPO_PATH_EXISTS is asked of exactly those three and no RESULTS "
          "document — it answers 29 FALSE over the wider set, and a gate that "
          "opens red is one people learn to skip",
          PROSE_SHAPES["REPO_PATH_EXISTS"] == PROSE_DOCS,
          "its scope is %s" % (PROSE_SHAPES["REPO_PATH_EXISTS"],))
    check("CAPACITY_FIGURE reaches PAST them to the document that actually "
          "quotes the figures — a per-shape scope, which is the rule the file "
          "states about itself",
          "quality/RESULTS_RHYME_CAPACITY.md"
          in PROSE_SHAPES["CAPACITY_FIGURE"],
          "its scope is %s" % (PROSE_SHAPES["CAPACITY_FIGURE"],))
    check("FLOOR_THRESHOLD likewise reaches the document that restates the "
          "shipped profile",
          "quality/RESULTS_SONG_FLOOR.md" in PROSE_SHAPES["FLOOR_THRESHOLD"],
          "its scope is %s" % (PROSE_SHAPES["FLOOR_THRESHOLD"],))
    check("PROSE_SCOPE is DERIVED from the per-shape scopes, so a scope added "
          "above cannot leave a document unopened by the reader",
          set(PROSE_SCOPE)
          == {r for d in PROSE_SHAPES.values() for r in d},
          "PROSE_SCOPE is %s" % (PROSE_SCOPE,))

    entries, refusals = read_prose()
    check("every declared document is readable at HEAD",
          not refusals, "refused: %s" % (refusals,))
    check("every declared document yields segments",
          len(entries) == len(PROSE_SCOPE)
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
    # EACH SHAPE SEPARATELY. A pooled ">= 50" is satisfied by REPO_PATH_EXISTS
    # alone, so it would stay green with CAPACITY_FIGURE matching nothing at
    # all — which is the shape of failure this whole file is about (doctrine
    # 79: counts kept apart, never summed).
    for name in sorted(PROSE_SHAPES):
        n = sum(1 for _s, v in results if v.shape == name)
        check("...and %s fired on a real population of its own" % name, n > 0,
              "%d verdict(s)" % n)


# ---------------------------------------------------------------------------
# 6. The shipped module's own probes
# ---------------------------------------------------------------------------


def test_shipped_probes():
    print("\n6. verify_entries.py's own prose probes")
    for name, reason in prose_self_test():
        check(name, reason == "ok", reason)


# ---------------------------------------------------------------------------
# 7. A comma-grouped count is read whole, in BOTH directions
# ---------------------------------------------------------------------------


def test_comma_grouped_counts_are_read_whole():
    """`\b\d+` reads "1,297 English files" as 297 — the word boundary sits
    inside the comma and the thousands digit is silently dropped.

    THE FALSE-FAIL HALF is how it was found (2026-08-21): an entry repinned to
    the true 1,297 was reported FALSE against a measured 1,297. THE FALSE-PASS
    HALF is why it is pinned here rather than just fixed — the identical
    misread turns a stale "1,143 English files" TRUE the moment the real count
    reaches 143, and a shape that can pass for the wrong reason is worth more
    than a shape that fails for the wrong reason (doctrine 48). House style in
    this repo groups thousands, so every corpus claim written after the load
    was invisible to this check.
    """
    print("\n7. a comma-grouped count is read whole")
    for text, want in (("1,297 English files", 1297),
                       ("the 1,297 staged English files", 1297),
                       ("297 English files", 297),
                       ("143 English files", 143),
                       ("12,000 Persian texts", 12000)):
        m = VE.STAGED_RE2.search(text) or VE.STAGED_RE.search(text)
        got = None
        if m:
            tok = m.group(1).lower()
            got = VE.NUMWORD.get(tok)
            if got is None:
                got = int(tok.replace(",", ""))
        check("%-32s reads as %s" % (repr(text), want), got == want,
              "got %r" % (got,))
    # The false-PASS direction, stated as the thing the old pattern could do:
    old = re.compile(r"\b(\d+)\s+(?:staged\s+)?English\s+files\b", re.I)
    m = old.search("1,143 English files")
    check("the OLD pattern would have read '1,143 English files' as 143 — "
          "a stale claim passing against a real 143",
          m is not None and m.group(1) == "143",
          "this is the mutant, not the fix: it must still misread")


# ---------------------------------------------------------------------------
# 8. THE CAPACITY FIGURES, MUTATED IN THE DOCUMENTS THAT ACTUALLY CARRY THEM
#
# Not a synthetic fixture, and the difference is the point. The other sections
# here drive fabricated sentences through the reader, which is right for
# testing the READER. This one takes the SHIPPED documents, changes one digit
# or drops one family, and requires the shape to go FALSE — because the failure
# being guarded against is not "the shape is wrong", it is "the shape stopped
# matching the way this repo writes its sentences" and no fixture can catch
# that.
#
# Every mutation below is a real defect this repo has had or narrowly avoided:
# the first four are the exact figures that went stale on 2026-08-21 when the
# modal tables were rebuilt, restored to their pre-rebuild values.
# ---------------------------------------------------------------------------

#: (document, the shipped text, the mutant, what the mutant would mean).
#: The anchor must appear EXACTLY ONCE — an anchor that stops matching would
#: silently drop a mutation from the sweep and take the count down with it, so
#: a miss is a FAILURE here rather than a skip (doctrine 20).
CAPACITY_MUTANTS = [
    ("quality/RESULTS_RHYME_CAPACITY.md",
     "34 classes, certified", "35 classes, certified",
     "AY-ER's spelling-class ceiling off by one"),
    ("quality/RESULTS_RHYME_CAPACITY.md",
     "certified ~~33~~ **31**", "certified ~~33~~ **30**",
     "EH-R's certified floor off by one"),
    ("quality/RESULTS_RHYME_CAPACITY.md",
     "IY: attempts 40", "IY: attempts 41",
     "the attempt bound quoted above CERTIFY_ATTEMPT_CAP"),
    ("quality/RESULTS_RHYME_CAPACITY.md",
     "**27**-word clique", "**28**-word clique",
     "the `capacity fire` clique back to its pre-rebuild size"),
    ("quality/RESULTS_RHYME_CAPACITY.md",
     "IY: 228 classes", "IY: 229 classes",
     "the second family of a semicolon list, which is the elliptical form"),
    ("quality/RESULTS_RHYME_CAPACITY.md",
     "`EY-T-IH-NG` and `IH-Z-AH-M`", "and `IH-Z-AH-M`",
     "one family dropped from the tie at 40"),
    ("quality/RESULTS_RHYME_CAPACITY.md",
     "held by NINE families", "held by EIGHT families",
     "the spelled tie count wrong while the named list stays right"),
    ("CLAUDE.md",
     "chain is 40, held by NINE", "chain is 39, held by NINE",
     "the tie DEPTH moved, so those nine no longer hold it"),
]


def _capacity_false(rel, text):
    """-> the FALSE verdicts the shape returns over one document's text."""
    segs = prose_entry(rel, text).segments
    return [v for v in (shape_capacity_figure(sg) for sg in segs)
            if v is not None and v.status == FALSE]


def test_capacity_figures_are_re_derived():
    print("\n8. a per-family capacity figure is re-derived, not retyped")
    for rel, old, new, why in CAPACITY_MUTANTS:
        raw = io.open(os.path.join(ROOT, rel), encoding="utf-8").read()
        if raw.count(old) != 1:
            check("anchor %r is still in %s exactly once" % (old[:34], rel),
                  False, "found %d — the mutation could not be applied, so "
                         "this row proved nothing" % raw.count(old))
            continue
        clean = _capacity_false(rel, raw)
        mutant = _capacity_false(rel, raw.replace(old, new))
        check("%s: %s" % (rel.split("/")[-1], why),
              not clean and mutant,
              "shipped %d FALSE, mutated %d FALSE%s"
              % (len(clean), len(mutant),
                 " — " + mutant[0].measured.split(" (artifact")[0][:90]
                 if mutant else ""))

# ---------------------------------------------------------------------------
# 9. THE SHIPPED FLOOR THRESHOLDS, MUTATED IN RESULTS_SONG_FLOOR.md
#
# The first mutation below is not hypothetical: it restores the table exactly
# as it stood before this sitting, when §2 was headed "Shipped, 150-400
# tokens" and gave three of five cells at their pre-adoption values. Nothing
# caught it — `floor.py --check` compares the constants to a fresh derivation
# and `song_profile_calibration.py --check` reads the profile's own `note`
# docstring; neither reads this table. So the first row here is the regression
# for a defect that was found by eye, which is the thing this file exists to
# stop being the method (doctrine 48).
#
# The last three are the failures a value-only check would miss: a threshold
# asserted for a profile that has none, an absence asserted for one that ships
# a value, and two correct numbers in each other's columns.
# ---------------------------------------------------------------------------

FLOOR_DOC = "quality/RESULTS_SONG_FLOOR.md"

FLOOR_MUTANTS = [
    ("| song profile | 0.7128 |", "| song profile | 0.7226 |",
     "the pre-adoption mattr_min back under the word SHIPPED — the real one"),
    ("0.7128 | 0.4773 | 0.3000 | 0.1094 | 0.9286 |",
     "0.7128 | 0.4773 | 0.3000 | 0.1123 | 0.9286 |",
     "line_length_cv_min back to its pre-adoption value"),
    ("| (section, for contrast) | 0.7568 | 0.5161 | 0.5000 | 0.0525 | — |",
     "| (section, for contrast) | 0.7568 | 0.5161 | 0.5000 | 0.0525 | 0.9 |",
     "a threshold asserted for a profile that ships none"),
    ("| (sonnet, for contrast) | 0.7557 | 0.4788 | 0.2857 | 0.0939 | 0.8333 |",
     "| (sonnet, for contrast) | 0.7557 | 0.4788 | 0.2857 | 0.0939 | — |",
     "an absence asserted for a threshold the profile does ship"),
    ("| song profile | 0.7128 | 0.4773 |",
     "| song profile | 0.4773 | 0.7128 |",
     "two cells swapped — every number right, every column wrong"),
]


def _floor_false(text):
    segs = prose_entry(FLOOR_DOC, text).segments
    return [v for v in (shape_floor_threshold(sg) for sg in segs)
            if v is not None and v.status == FALSE]


def test_floor_thresholds_are_re_derived():
    print("\n9. a shipped floor threshold is re-derived, not retyped")
    raw = io.open(os.path.join(ROOT, FLOOR_DOC), encoding="utf-8").read()
    clean = _floor_false(raw)
    check("the shipped document is clean, so every kill below is the "
          "mutation and not a standing failure", not clean,
          "; ".join(v.measured[:80] for v in clean))
    for old, new, why in FLOOR_MUTANTS:
        if raw.count(old) != 1:
            check("anchor %r is still present exactly once" % old[:34], False,
                  "found %d — the mutation could not be applied, so this row "
                  "proved nothing" % raw.count(old))
            continue
        mutant = _floor_false(raw.replace(old, new))
        check(why, bool(mutant),
              mutant[0].measured.split(" (at ")[0][:100] if mutant
              else "the shape did not notice")

    # THE STRUCK ROW IS NOT A CLAIM. §2 keeps the superseded values visible on
    # their own row (doctrine 17), and if `_unstrike` ever stopped removing it
    # this shape would report the document false for having been corrected
    # properly — the worst possible direction for a staleness gate to fail in.
    # NOT "0.7226 is absent from the document" — it is legitimately present
    # in §5·A's shipped/adopted table and in §5's worked example, and asserting
    # its absence would demand the document delete exactly what doctrine 17
    # requires it to keep. The property is narrower: the `song` profile is
    # claimed ONCE, by the live row.
    verdicts = [v for v in (shape_floor_threshold(sg)
                            for sg in prose_entry(FLOOR_DOC, raw).segments)
                if v is not None and v.claim.startswith("song ")]
    check("the struck 'song profile, to 2026-08-21' row is not read as a "
          "second live claim — a document is never failed for keeping its "
          "own superseded values legible",
          len(verdicts) == 1,
          "%d live `song` row(s): %s"
          % (len(verdicts), " || ".join(v.claim[:60] for v in verdicts)))


# --- the discharge escape hatch ------------------------------------------

class _E:
    """A register entry with a real body, which is what `STATUS_XREF` reads.

    `_FakeEntry` in the shipped file carries no body because no probe needed
    one until now. This drives the SHIPPED shape -- `shape_status_xref` -- over
    synthetic entries, never a copy of its logic.
    """

    def __init__(self, ident, source, status, heading, body=""):
        self.id, self.source, self.status = ident, source, status
        self.heading, self.lineno = heading, 0
        self.body = [(i + 1, ln) for i, ln in enumerate(body.split("\n"))]
        self.segments = []


REASON = ("x" * (VE.DISCHARGE_REASON_CHARS + 20))
SHORT = "x" * 10


def _xref(status, body, missing_status="PARTIAL", ident="Z-9",
          heading=None):
    """-> the shipped shape's verdict on a BACKLOG heading citing `ident`."""
    real = VE._ALL_ENTRIES
    head = heading or ("### 9.9 · a probe entry `%s`%s"
                       % (ident, " — `CLOSED`" if status == "CLOSED" else ""))
    back = _E("9.9", "BACKLOG.md", status, head, body)
    miss = _E(ident, "MISSING.md", missing_status,
              "### %s · a probe capability `%s`" % (ident, missing_status))
    VE._ALL_ENTRIES = [back, miss]
    try:
        return VE.shape_status_xref(VE.Segment(back, head, 0, kind="heading"))
    finally:
        VE._ALL_ENTRIES = real


def test_the_discharge_hatch_is_narrow():
    print("\n10. STATUS_XREF — a CLOSED task over a still-missing capability")
    # THE DEFAULT IS STILL FALSE. Nothing below is worth anything if a closed
    # entry over an open MISSING half stops failing on its own.
    v = _xref("CLOSED", "no declaration here, just prose")
    check("a CLOSED entry citing a still-open MISSING id is FALSE with no "
           "declaration", v.status == VE.FALSE, "%s %s" % (v.status, v.measured))
    # THE HATCH.
    v = _xref("CLOSED",
              "**TASK DISCHARGED — `Z-9` STAYS OPEN.** " + REASON)
    check("...and REFUSED/DISCHARGED once the entry declares it and says why",
           v.status == VE.REFUSED and v.kind == VE.DISCHARGED,
           "%s %s" % (v.status, v.kind))
    # AND THE FOUR WAYS IT MUST NOT WIDEN.
    v = _xref("CLOSED", "**TASK DISCHARGED — `Z-9` STAYS OPEN.** " + SHORT)
    check("a declaration with no reason after it is FALSE — a bare marker is "
           "a green light with no argument attached",
           v.status == VE.FALSE and "no reason" in v.measured,
           "%s %s" % (v.status, v.measured))
    v = _xref("CLOSED",
              "**TASK DISCHARGED — `Q-1` STAYS OPEN.** " + REASON)
    check("a declaration naming a DIFFERENT id does not cover this citation",
           v.status == VE.FALSE, "%s %s" % (v.status, v.measured))
    v = _xref("CLOSED", "**TASK DISCHARGED — `Z-9` STAYS OPEN.** " + REASON,
              missing_status="CLOSED")
    check("a declaration whose MISSING half has since CLOSED is FALSE, not a "
           "pass — the entry is describing a state that moved on",
           v.status == VE.FALSE and "still-open" in v.measured,
           "%s %s" % (v.status, v.measured))
    v = _xref("OPEN", "**TASK DISCHARGED — `Z-9` STAYS OPEN.** " + REASON,
              missing_status="CLOSED")
    check("the hatch is ONE-DIRECTIONAL: an OPEN entry over a CLOSED MISSING "
           "half is a stale register and stays FALSE",
           v.status == VE.FALSE, "%s %s" % (v.status, v.measured))
    # AND THE LIVE REGISTER REALLY USES IT, so this is not a shape with no
    # instance (doctrine 20: the three below are why the hatch was built).
    ents = VE.read_entries()
    real = VE._ALL_ENTRIES
    VE._ALL_ENTRIES = ents
    try:
        got = {}
        for e in ents:
            if e.source != "BACKLOG.md":
                continue
            for seg in e.segments:
                if seg.kind != "heading":
                    continue
                vv = VE.shape_status_xref(seg)
                if vv is not None:
                    got.setdefault(vv.status, []).append(e.id)
    finally:
        VE._ALL_ENTRIES = real
    check("the shipped shape still ANSWERS live headings — zero resolved is "
           "a broken reader, not an empty register",
           len(got.get(VE.TRUE, [])) + len(got.get(VE.REFUSED, [])) >= 8,
           "TRUE %s | REFUSED %s | FALSE %s"
           % (got.get(VE.TRUE, []), got.get(VE.REFUSED, []),
              got.get(VE.FALSE, [])))
    check("...and the register carries real discharges, so the hatch is not "
           "a shape with no instance",
           bool(got.get(VE.REFUSED)), "discharged: %s" % got.get(VE.REFUSED, []))


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
    test_comma_grouped_counts_are_read_whole()
    test_capacity_figures_are_re_derived()
    test_floor_thresholds_are_re_derived()
    test_the_discharge_hatch_is_narrow()
    print()
    print("=" * 78)
    if _FAILURES:
        print("FAIL — %d: %s" % (len(_FAILURES), ", ".join(_FAILURES)))
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())

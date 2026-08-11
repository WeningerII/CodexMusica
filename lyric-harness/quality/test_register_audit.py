#!/usr/bin/env python3
"""Pins for `quality/audit_register.py` — the register auditor's own oracle.

Doctrine 94: a positive-case suite cannot find a rule that is too generous.
An auditor is exactly that shape of instrument, and the generous failure mode
is silence — a check that stops firing because a regex drifted looks identical
to a register that got fixed. So the calibration set here is the four entries
already KNOWN to have been wrong, and the test fails if the auditor stops
rediscovering them.

    python3 quality/test_register_audit.py

Deliberately cheap: no corpus scans, no `--slow` derivations, no subprocess.
Runs in about a second so there is no excuse for skipping it.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quality import audit_register as AR   # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    if cond:
        print("  ok    %s" % name)
    else:
        print("  FAIL  %s   %s" % (name, detail))
        FAILURES.append(name)


def _run(check_id):
    entries = AR.read_entries()
    for c in AR.CONSISTENCY:
        if c.id == check_id:
            return c.fn(entries)
    return None, "check %s not registered" % check_id


# ---------------------------------------------------------------------------
# The calibration set. Four entries that were wrong; the auditor must find them.
# ---------------------------------------------------------------------------


def test_calibration_shared_denominator():
    """M-3's 384 and M-4's 300 over one denominator of 471.

    The biggest error in the register, and it is visible from prose arithmetic
    with nothing loaded. If this stops failing, either MISSING.md was repaired
    (check the text) or the auditor went blind (check the regex). Both need a
    human; neither may pass silently.
    """
    ok, detail = _run("C1")
    check("C1 re-finds 384 + 300 > 471",
          ok is False and "684" in detail, detail)


def test_calibration_m2_enumeration():
    """M-2's 23-of-24 against a 19-item list. Same shape, one section earlier."""
    ok, detail = _run("C3")
    check("C3 re-finds 23 vs 19 arrow pairs",
          ok is False and "19 arrow pairs" in detail, detail)


def test_calibration_m3_after_column():
    """M-3's corrected table: 2 + 306 + 78 = 386 against a stated 384."""
    ok, detail = _run("C2")
    check("C2 re-finds the 386-vs-384 after column",
          ok is False and "386" in detail and "384" in detail, detail)


def test_calibration_finnish_arithmetic():
    """The Finnish row is the CONTROL: a corrected figure that reproduces.

    An auditor that only ever reports failures is not measuring anything. 8
    stubs x 2 vowelless tokens = 16 must come back CONFIRMED, or the derivation
    layer is broken in the direction nobody notices.
    """
    verdict, got, _ = AR._d_jne()
    check("D7 confirms Finnish j. n. e. at 8 stubs / 16 tokens",
          verdict == AR.CONFIRMED and "8 occurrences" in got, got)


def test_calibration_malay_withdrawal():
    """The fourth known-false entry, and the one whose verdict this round
    REVERSED: the withdrawal of M-4's Malay row is itself false.

    Guarded, not asserted: PG47873 is not in the repository. If it is absent
    the honest answer is UNVERIFIABLE, and this test accepts that — what it
    refuses is a silent CONFIRMED, which would mean the auditor had accepted
    a population substitution as a refutation.
    """
    verdict, got, _ = AR._d_dsb()
    check("D8 does not confirm the withdrawal",
          verdict in (AR.FALSE, AR.UNVERIFIABLE), "%s: %s" % (verdict, got))
    if verdict == AR.FALSE:
        check("D8 names the count and the line-final position",
              "108" in got and "line-final" in got, got)


# ---------------------------------------------------------------------------
# The instrument itself
# ---------------------------------------------------------------------------


def test_passing_checks_still_pass():
    """C5 and C6 must stay green, or the arithmetic pass is just noise."""
    for cid in ("C5", "C6"):
        ok, detail = _run(cid)
        check("%s passes" % cid, ok is True, detail)


def test_provenance_finds_no_external_citation():
    """RHYME_CANON.md has zero publication years and zero external citations.

    Not a bug to fix by loosening the detector. If this starts passing because
    somebody added citations, delete the test and say so in the report.
    """
    pr = AR.provenance_report()
    check("canon carries no publication-year token",
          pr["canon_year_tokens"] == 0, str(pr["canon_year_tokens"]))
    check("every canon entry lacks an external citation",
          len(pr["canon_unsourced"]) == len(pr["canon_entries"]),
          "%d of %d" % (len(pr["canon_unsourced"]), len(pr["canon_entries"])))
    check("every Tradition.source is an R<n> into RHYME_CANON.md",
          all(not s["external"] for s in pr["schemas"] if s["n_traditions"]),
          "some schema cites outside the repo -- update the report")


def test_coverage_is_reported_honestly():
    """The auditor must say how much of the register it did NOT check."""
    cov = AR.coverage()
    check("coverage names unaudited entries",
          cov["entries_with_numbers"] > cov["entries_audited"]
          and len(cov["unaudited"]) > 0,
          "audited %d of %d" % (cov["entries_audited"], cov["entries_with_numbers"]))


def test_entry_extraction_is_not_empty():
    entries = AR.read_entries()
    check("MISSING.md parses into entries", len(entries) > 40, str(len(entries)))
    check("every entry yields numbers with context",
          all(all("context" in n for n in e.numbers()) for e in entries[:5]))


def main():
    print("\nquality/test_register_audit.py — pins for the register auditor\n")
    print("CALIBRATION SET (four entries known to have been wrong):")
    test_calibration_shared_denominator()
    test_calibration_m2_enumeration()
    test_calibration_m3_after_column()
    test_calibration_finnish_arithmetic()
    test_calibration_malay_withdrawal()
    print("\nTHE INSTRUMENT:")
    test_passing_checks_still_pass()
    test_provenance_finds_no_external_citation()
    test_coverage_is_reported_honestly()
    test_entry_extraction_is_not_empty()
    print("\n%d failure(s)" % len(FAILURES))
    if FAILURES:
        print("An auditor that stops finding a known error is indistinguishable")
        print("from a register that no longer contains one. Check which it is.")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())

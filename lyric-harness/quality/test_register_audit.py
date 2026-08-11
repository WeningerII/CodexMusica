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


def _plant(*pairs):
    """Synthetic entries carrying a known error, so a PASS below can be told
    apart from a blind check. Doctrine 94: three of the four calibration cases
    in this file went green on 2026-08-11 because the register was REPAIRED,
    and a green that cannot fail is not evidence of a repair."""
    return [AR.Entry(i, "t", "OPEN", "1", b) for i, b in pairs]


def _fires(check_id, entries):
    for c in AR.CONSISTENCY:
        if c.id == check_id:
            return c.fn(entries)
    return None, "check %s not registered" % check_id


def test_calibration_shared_denominator():
    """M-3's 384 and M-4's 300 over one denominator of 471 — REPAIRED.

    This asserted the auditor still FOUND that error. It no longer does,
    because the 384/471 claim was withdrawn in place: C1 skips any figure
    inside a strike-through or marked WRONG/FALSE/withdrawn, which is what
    "withdrawn in place" means mechanically. Verified it is a repair and not
    a blind regex by planting the error back — see the second check.
    """
    ok, detail = _run("C1")
    check("C1 finds NO live shared-denominator contradiction in M-3/M-4",
          ok is True, detail)
    ok2, d2 = _fires("C1", _plant(
        ("M-3", "### M-3\n384 of 471 blocks are affected.\n"),
        ("M-4", "### M-4\n300 of 471 blocks are the other class.\n")))
    check("...and it still fires on the planted arithmetic",
          ok2 is False and "684" in d2, d2)


def test_calibration_m2_enumeration():
    """M-2's 23-of-24 against a 19-item list — REPAIRED. Same shape, one
    section earlier, and the entry now reads 19 of 24 recoverable with 19
    arrow pairs listed and 19 + 5 = 24 against a population of 24."""
    ok, detail = _run("C3")
    check("C3 finds M-2's enumeration consistent with its own claim",
          ok is True, detail)


def test_calibration_m3_after_column():
    """M-3's corrected table: 2 + 306 + 78 = 386 against a stated 384 —
    REPAIRED. Components now sum to their stated totals on BOTH sides,
    471 before and 394 after."""
    ok, detail = _run("C2")
    check("C2 finds M-3's before/after components summing to their totals",
          ok is True, detail)


def test_calibration_finnish_arithmetic():
    """The Finnish row is the CONTROL: a corrected figure that reproduces.

    An auditor that only ever reports failures is not measuring anything, so
    this row must come back CONFIRMED or the derivation layer is broken in the
    direction nobody notices.

    REPINNED 2026-08-11, and it is a CORPUS move, not a register move: 8 stubs
    / 16 tokens became 9 / 18 when corpus/song/fin_wahanen_laulukirja.txt
    landed at debf64e carrying one more `j. n. e.`. Exactly the hazard that
    broke quality/test_msa_fin.py the same day — a constant that is really a
    measurement over a growing corpus. So this asserts the DERIVATION (two
    vowelless tokens per stub, because `e` is readable) rather than the
    product, and prints both numbers.
    """
    verdict, got, why = AR._d_jne()
    check("D7 measures Finnish j. n. e. at 9 stubs / 18 tokens, 2 per stub",
          "9 occurrences" in got and "18 tokens" in got,
          "%s   (register still claims: %s)" % (got, why))
    check("...and it reports MOVED rather than CONFIRMED, because the "
          "REGISTER is what is now stale — not the derivation",
          verdict == "MOVED",
          "verdict %r. MOVED is the honest verdict here and repinning it to "
          "CONFIRMED would mean editing MISSING.md's claim from inside a "
          "test. The register's own owner moves the 8/16; this file only "
          "asserts that the auditor still measures correctly." % verdict)


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
    """RENAMED IN SPIRIT, 2026-08-11: the gap this pinned is REPAIRED (M-15a).

    It used to assert that RHYME_CANON.md carried zero publication years and
    zero external citations, and said in its own docstring to delete it if
    that ever stopped being true because somebody added citations. Somebody
    did: `quality/canon_index.tsv` inlines the survey array the canon's 781
    `from:` references point at, and §8.5 names three dated primary sources
    held in this repository. What is pinned now is the SHAPE of the repair,
    not the absence of one.

    ONE NUMBER DELIBERATELY NOT PINNED HERE: `canon_unsourced` is 112 of 117,
    and that is NOT the repair's measure. `_EXTERNAL_HINT` looks for a year or
    one of six repository names inside the §2 entry block, while the new
    `- witness:` lines carry hostnames and work titles it does not read.
    Re-tuning that regex until the number looked like a repair would be
    fitting the detector to the answer. The repair's own measure is the
    `resolved_*` block under §4b of `audit_register.py --provenance`.
    """
    pr = AR.provenance_report()
    check("the canon now carries publication-year tokens",
          pr["canon_year_tokens"] > 0, str(pr["canon_year_tokens"]))
    check("Tradition.source is STILL the R<n> canon pointer, deliberately",
          all(not s["external"] for s in pr["schemas"] if s["n_traditions"]),
          "the external citation lives in Tradition.witness/.cites/.why. "
          "Overwriting `source` would lose which canon entry names the "
          "tradition, which is the one thing the canon does say.")
    check("the index resolves and reports THREE counts, never two",
          pr["index_loaded"]
          and pr["traditions"]["external"] + pr["traditions"]["project"]
          + pr["traditions"]["cannot_tell"] == pr["traditions"]["distinct"],
          str(pr["traditions"]))
    check("the traditions this project invented are still LISTED",
          len(pr["coined_traditions"]) > 0,
          "%d labelled; an invented name that says so is fine, an invented "
          "name that reads as attested is the defect"
          % len(pr["coined_traditions"]))
    check("the single-line `from:` count is kept beside the multi-line one",
          pr["canon_cell_ref_total_singleline"]
          < pr["canon_cell_ref_total_multiline"],
          "%d vs %d -- the old reader missed R1's and R29's continuations and "
          "§H/§I's inline `from:`. Both are printed; neither replaces the "
          "other (doctrine 58)."
          % (pr["canon_cell_ref_total_singleline"],
             pr["canon_cell_ref_total_multiline"]))


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

#!/usr/bin/env python3
"""Regression tests for the provenance gate.

The load-bearing test is `test_model_recall_is_not_evidence`. The project has
already been burned twice by model-derived claims entering as data (the
Shakespeare anthologization label, and an OOV artifact read as signal). If the
gate admitted a date because its author was confident, it would be reproducing
that failure in a new place.

Run: python3 quality/test_provenance.py
"""

import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.provenance import (ADMIT_DATE_VERIFIED,  # noqa: E402
                                ADMIT_PD_AFFIRMED, ADMITTED,
                                REJECT_CONTESTED_NO_DATE, REJECT_GENERATED,
                                REJECT_NO_EVIDENCE, REJECT_TOO_RECENT,
                                REJECT_UNVERIFIED_DATE, Item,
                                ProvenanceDeclaration, ProvenanceGate, report,
                                load_authority, load_sources)

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def gate(strict=True):
    return ProvenanceGate(ProvenanceDeclaration(strict=strict),
                          load_sources(), load_authority())


def verdict(g, **kw):
    kw.setdefault("item_id", "x")
    kw.setdefault("language", "xx")
    return g.admit(Item(**kw))[0]


# ---------------------------------------------------------------------------

def test_route_one_pd_affirmation():
    print("\n1. ROUTE 1 — express PD affirmation")
    g = gate()
    v = verdict(g, source_id="projectbenyehuda/public_domain_dump")
    check("source affirming public domain admits", v == ADMIT_PD_AFFIRMED,
          f"got {v}")
    v = verdict(g, source_id="openscriptures/morphhb")
    check("second PD-affirming source admits", v == ADMIT_PD_AFFIRMED,
          f"got {v}")


def test_open_licence_is_not_a_pd_claim():
    print("\n2. OPEN LICENCE != PD CLAIM")
    g = gate()
    v = verdict(g, source_id="srophe/syriac-corpus")
    check("CC-BY source alone does NOT admit", v not in ADMITTED,
          f"got {v} — a redistribution grant is not a public-domain claim")
    v = verdict(g, source_id="srophe/syriac-corpus",
                author_key="ephrem_the_syrian")
    check("same source WITH a verified date admits",
          v == ADMIT_DATE_VERIFIED, f"got {v}")


def test_software_licence_never_admits():
    print("\n3. SOFTWARE LICENCE ON TEXT")
    g = gate()
    for src in ("Sefaria/hebrew_library", "AKS-DHLAB/KPoEM"):
        v = verdict(g, source_id=src)
        check(f"{src.split('/')[0]}: software licence does not admit",
              v not in ADMITTED, f"got {v}")


def test_contested_source_forces_dates():
    print("\n4. CONTESTED LICENCE FORCES PER-ITEM DATES")
    g = gate()
    v = verdict(g, source_id="AliMuhammad73/Pashto-Poetry")
    check("contested source with no author is rejected",
          v == REJECT_CONTESTED_NO_DATE, f"got {v}")
    v = verdict(g, source_id="AliMuhammad73/Pashto-Poetry",
                author_key="khushal_khan_khattak")
    check("the genuinely PD poet still admits (d.1689)",
          v == ADMIT_DATE_VERIFIED, f"got {v}")


def test_generated_is_hard_rejected():
    print("\n5. MODEL-GENERATED CONTENT (science-safety, not legal)")
    g = gate()
    v = verdict(g, source_id="nafisehNik/ganjoor-ipa-scansion")
    check("generated source rejected despite a CC-BY tag",
          v == REJECT_GENERATED, f"got {v}")
    v = verdict(g, source_id="nafisehNik/ganjoor-ipa-scansion",
                author_key="yehuda_halevi")
    check("generated rejection outranks a verified date",
          v == REJECT_GENERATED, f"got {v}")
    v = verdict(g, source_id="openscriptures/morphhb", generated=True)
    check("item-level generated flag beats a PD-affirming source",
          v == REJECT_GENERATED, f"got {v}")


def test_model_recall_is_not_evidence():
    """THE LOAD-BEARING TEST."""
    print("\n6. MODEL RECALL IS NOT EVIDENCE")
    g = gate(strict=True)
    v = verdict(g, source_id="AKS-DHLAB/KPoEM", author_key="im_hwa")
    check("a recalled death year is REJECTED under strict",
          v == REJECT_UNVERIFIED_DATE, f"got {v}")
    v = verdict(g, source_id="pruizf/disco", author_key="recalled_victorian")
    check("recalled date rejected even though 1900 clears the term",
          v == REJECT_UNVERIFIED_DATE,
          f"got {v} — the year is fine; the SOURCING is not")

    lax = gate(strict=False)
    v = lax.admit(Item("x", "xx", "pruizf/disco",
                       author_key="recalled_victorian"))[0]
    check("non-strict admits it, so relaxing the rule is explicit and visible",
          v == ADMIT_DATE_VERIFIED, f"got {v}")

    v = verdict(g, source_id="pruizf/disco", author_key="some_1930s_spaniard")
    check("a recalled date inside the term fails on BOTH grounds",
          v in (REJECT_UNVERIFIED_DATE, REJECT_TOO_RECENT), f"got {v}")


def test_term_boundary():
    print("\n7. TERM ARITHMETIC")
    g = gate()
    cutoff = g.decl.cutoff_death_year()
    check("cutoff is current_year - term_years", cutoff == 2026 - 95,
          f"cutoff {cutoff}: an author must have died by then to clear")
    v = verdict(g, source_id="srophe/syriac-corpus", author_key="im_hwa")
    check("a 1953 death is inside the term",
          v in (REJECT_TOO_RECENT, REJECT_UNVERIFIED_DATE), f"got {v}")


def test_no_evidence():
    print("\n8. NO EVIDENCE AT ALL")
    g = gate()
    v = verdict(g, source_id="some/unknown-corpus")
    check("unknown source with no author is rejected",
          v == REJECT_NO_EVIDENCE, f"got {v}")
    v = verdict(g, source_id="linhd-postdata/metrique-en-ligne")
    check("no-licence source with no author is rejected",
          v == REJECT_NO_EVIDENCE, f"got {v}")


def test_report_counts():
    print("\n9. LEDGER AND REPORT")
    g = gate()
    items = [
        Item("he1", "he", "projectbenyehuda/public_domain_dump"),
        Item("he2", "he", "projectbenyehuda/public_domain_dump"),
        Item("syc1", "syc", "srophe/syriac-corpus", "ephrem_the_syrian"),
        Item("syc2", "syc", "srophe/syriac-corpus"),
        Item("ps1", "ps", "AliMuhammad73/Pashto-Poetry",
             "khushal_khan_khattak"),
        Item("ps2", "ps", "AliMuhammad73/Pashto-Poetry"),
        Item("fa1", "fa", "nafisehNik/ganjoor-ipa-scansion"),
        Item("ko1", "ko", "AKS-DHLAB/KPoEM", "im_hwa"),
    ]
    admitted, ledger = g.gate(items)
    check("ledger has one row per item, always",
          len(ledger) == len(items), f"{len(ledger)} rows for {len(items)}")
    check("admitted count is correct", len(admitted) == 4,
          f"admitted {[i.item_id for i in admitted]}")

    buf = io.StringIO()
    summary = report(ledger, stream=buf)
    check("Persian is eliminated entirely (all generated)",
          "fa" in summary["languages_eliminated"],
          f"eliminated: {summary['languages_eliminated']}")
    check("Korean is eliminated entirely (recalled date only)",
          "ko" in summary["languages_eliminated"],
          f"eliminated: {summary['languages_eliminated']}")
    check("three languages survive", summary["languages_surviving"] == 3,
          f"surviving {summary['languages_surviving']}")
    print("\n" + buf.getvalue())


if __name__ == "__main__":
    test_route_one_pd_affirmation()
    test_open_licence_is_not_a_pd_claim()
    test_software_licence_never_admits()
    test_contested_source_forces_dates()
    test_generated_is_hard_rejected()
    test_model_recall_is_not_evidence()
    test_term_boundary()
    test_no_evidence()
    test_report_counts()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all provenance regressions pass")

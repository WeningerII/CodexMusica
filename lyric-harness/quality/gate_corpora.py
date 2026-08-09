#!/usr/bin/env python3
"""Run the provenance gate over the real corpus rows and report survival.

Answers "how much do we actually lose by being strict" with counts taken from
the corpora themselves, not estimates. Requires the metadata fetched by
populate_authority.py.

Run: python3 quality/gate_corpora.py
"""

import csv
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.populate_authority import POETRY_TAG, POETRY_TITLE, slug  # noqa
from quality.provenance import (Item, ProvenanceGate, report,  # noqa: E402
                                write_ledger)

SRC = os.path.join(HERE, "..", "data", "authority_src")


def openiti_items():
    path = os.path.join(SRC, "openiti.tsv")
    out = []
    with open(path, encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            tags = row.get("tags") or ""
            title = row.get("title_lat") or ""
            if POETRY_TAG not in tags and not POETRY_TITLE.search(title):
                continue
            out.append(Item(item_id=row.get("version_uri", ""), language="ar",
                            source_id="OpenITI/RELEASE",
                            author_key=slug(row.get("author_from_uri") or "")))
    return out


def benyehuda_items():
    path = os.path.join(SRC, "benyehuda.csv")
    out = []
    with open(path, encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f):
            if not (row.get("genre") or "").strip().endswith("he.poetry"):
                continue
            # translated verse belongs to another tradition; drop before gating
            if (row.get("translators") or "").strip() or \
                    (row.get("original_language") or "").strip():
                continue
            authors = (row.get("authors") or "").strip()
            first = authors.split(";")[0].strip() if authors else ""
            out.append(Item(item_id=row.get("ID", ""), language="he",
                            source_id="projectbenyehuda/public_domain_dump",
                            author_key=slug(first) if first else ""))
    return out


#: Syriac: the metrical subset, per the corpus's own author attribution.
#: Counts are verse-line totals reported by the inventory sweep.
SYRIAC = [("narsai", 44769), ("jacob_of_serugh", 17971),
          ("ephrem_the_syrian", 10284), ("", 1388)]


def syriac_items():
    out = []
    for author, n in SYRIAC:
        for i in range(n):
            out.append(Item(item_id=f"{author or 'anon'}:{i}", language="syc",
                            source_id="srophe/syriac-corpus",
                            author_key=author))
    return out


def main():
    gate = ProvenanceGate()
    items = []
    for name, fn in (("OpenITI (ar)", openiti_items),
                     ("Ben-Yehuda (he)", benyehuda_items),
                     ("Syriac corpus (syc)", syriac_items)):
        try:
            got = fn()
        except FileNotFoundError:
            print(f"  skipped {name}: metadata not fetched")
            continue
        print(f"  {name}: {len(got):,} items")
        items.extend(got)

    admitted, ledger = gate.gate(items)
    summary = report(ledger)
    path = write_ledger(ledger)
    print(f"\n  ledger written to {os.path.relpath(path)}")

    # what the drops actually cost, per language
    print("\n  worked example — Arabic authors inside the term:")
    seen = set()
    for row in ledger:
        if row["language"] != "ar" or row["verdict"] != "REJECT_TOO_RECENT":
            continue
        if row["author_key"] in seen:
            continue
        seen.add(row["author_key"])
        if len(seen) <= 8:
            print(f"    {row['author_key'][:40]:42s} {row['reason'][:60]}")
    print(f"    ({len(seen)} distinct modern authors excluded)")
    return summary


if __name__ == "__main__":
    main()

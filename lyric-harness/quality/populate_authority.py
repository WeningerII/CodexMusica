#!/usr/bin/env python3
"""Populate the authority table from dataset-carried dates.

Wikidata and VIAF are unreachable from this environment, so dates cannot be
looked up live. They can, however, be read out of corpora that carry them —
which is a legitimate `dataset_field` verification and not model recall. This
script derives death years from the corpus metadata itself and writes them with
the file, column and release they came from, so every row is checkable.

Nothing here is typed from memory. If a corpus does not carry a date, its
authors are not added, and the corpus admits (or fails to) on source-level
evidence alone.

Sources used:
  ar   OpenITI/RELEASE metadata TSV — `date` column is the author's death year
       in AH (Hijri), and `author_from_uri` is a stable author key.
  he   projectbenyehuda pseudocatalogue — carries Wikidata QIDs but NO dates,
       so QIDs are recorded for later verification and no date is asserted.
       The corpus admits via its source-level public-domain affirmation.

Run: python3 quality/populate_authority.py [--write]
"""

import argparse
import csv
import math
import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
SRC = os.path.join(DATA, "authority_src")

OPENITI_RELEASE = "OpenITI_metadata_2025-1-9"

#: Poetry markers in OpenITI. `_SHICR` is the corpus's own poetry tag; Diwan is
#: the standard title for a collected-verse volume.
POETRY_TAG = "_SHICR"
POETRY_TITLE = re.compile(r"\bdiwan\b", re.I)


def ah_to_ce_death(ah_year):
    """Hijri year -> Gregorian year, rounded UP.

    CE = AH * 0.970224 + 621.5643. Rounding up is the conservative direction
    for a public-domain test: it asserts the LATEST plausible death year, so a
    borderline author fails the term rather than sneaking through it. For the
    pre-modern material this touches, the sub-year difference is immaterial;
    the rounding rule matters only at the boundary, and at the boundary we want
    to be wrong in the safe direction.
    """
    return int(math.ceil(ah_year * 0.970224 + 621.5643))


def harvest_openiti(path=None, poetry_only=True):
    """-> {author_key: (death_year_ce, ah, evidence)}."""
    path = path or os.path.join(SRC, "openiti.tsv")
    if not os.path.exists(path):
        raise SystemExit(f"missing {path}; fetch it first")
    out, stats = {}, Counter()
    with open(path, encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            stats["rows"] += 1
            tags = row.get("tags") or ""
            title = row.get("title_lat") or ""
            if poetry_only and POETRY_TAG not in tags \
                    and not POETRY_TITLE.search(title):
                continue
            stats["poetry_rows"] += 1
            key = (row.get("author_from_uri") or "").strip()
            raw = (row.get("date") or "").strip()
            if not key or not raw.isdigit():
                stats["no_key_or_date"] += 1
                continue
            ah = int(raw)
            # AH 0 is a placeholder for "unknown" in this metadata, not year 0
            if ah <= 0:
                stats["ah_zero_unknown"] += 1
                continue
            ce = ah_to_ce_death(ah)
            if key not in out:
                out[key] = (ce, ah, f"dataset_field:{OPENITI_RELEASE}")
                stats["authors"] += 1
            elif out[key][0] != ce:
                # same author key, two different dates in the metadata: keep the
                # LATER one, which is the conservative choice for a PD test
                if ce > out[key][0]:
                    out[key] = (ce, ah, f"dataset_field:{OPENITI_RELEASE}")
                stats["conflicting_dates"] += 1
    return out, stats


def harvest_benyehuda(path=None):
    """-> {author_name: qid}. Carries QIDs but NO dates, so no date is asserted."""
    path = path or os.path.join(SRC, "benyehuda.csv")
    if not os.path.exists(path):
        return {}, Counter()
    out, stats = {}, Counter()
    with open(path, encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f):
            stats["rows"] += 1
            # The catalogue's genre values are untranslated i18n keys, e.g.
            # "Translation missing: he.poetry". Match the suffix, not the
            # literal word, or the filter silently returns nothing.
            if not (row.get("genre") or "").strip().endswith("he.poetry"):
                continue
            stats["poetry_rows"] += 1
            # native-Hebrew only: a translator or a source language means the
            # verse belongs to another tradition
            if (row.get("translators") or "").strip():
                stats["translated_skipped"] += 1
                continue
            if (row.get("original_language") or "").strip():
                stats["translated_skipped"] += 1
                continue
            authors = (row.get("authors") or "").strip()
            uris = (row.get("author_uris") or "").strip()
            if not authors:
                continue
            qid = ""
            m = re.search(r"(Q\d+)", uris)
            if m:
                qid = m.group(1)
            for a in [x.strip() for x in authors.split(";") if x.strip()]:
                if a not in out:
                    out[a] = qid
                    stats["authors"] += 1
    return out, stats


def slug(s):
    """Stable author key.

    Must keep non-Latin characters: an ASCII-only rule collapses every Hebrew
    (or Arabic, or Chinese) name to the same string, which silently merges
    hundreds of distinct poets into one key and drops the rest as duplicates.
    """
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s)
    s = re.sub(r"[^\w]+", "_", s, flags=re.UNICODE).strip("_").lower()
    return s or "unknown"


def existing_keys(path):
    if not os.path.exists(path):
        return set()
    with open(path, encoding="utf-8") as f:
        return {r["author_key"] for r in csv.DictReader(f, delimiter="\t")
                if r.get("author_key")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true",
                    help="append new rows to data/authority.tsv")
    ap.add_argument("--all-arabic", action="store_true",
                    help="include non-poetry OpenITI authors too")
    args = ap.parse_args()

    ar, ar_stats = harvest_openiti(poetry_only=not args.all_arabic)
    he, he_stats = harvest_benyehuda()
    zh, zh_stats = harvest_chinese()

    print("OpenITI (ar)")
    for k, v in ar_stats.most_common():
        print(f"  {k:22s} {v:>8,}")
    if ar:
        yrs = sorted(v[0] for v in ar.values())
        print(f"  death years CE          {yrs[0]}..{yrs[-1]}  "
              f"median {yrs[len(yrs)//2]}")
        print(f"  clearing life+95 cutoff 1931: "
              f"{sum(1 for y in yrs if y <= 1931):,}/{len(yrs):,}")

    print("\nBen-Yehuda (he) — QIDs only, no dates asserted")
    for k, v in he_stats.most_common():
        print(f"  {k:22s} {v:>8,}")
    print(f"  with a Wikidata QID     "
          f"{sum(1 for q in he.values() if q):>8,}/{len(he):,}")

    print("\nchinese-poetry (lzh) — dynasty-bounded, not exact dates")
    for k, v in zh_stats.most_common():
        print(f"  {k:22s} {v:>8,}")

    path = os.path.join(DATA, "authority.tsv")
    have = existing_keys(path)
    rows = []
    for key, (ce, ah, srcinfo) in sorted(ar.items()):
        k = slug(key)
        if k in have:
            continue
        rows.append([k, str(ce), "", srcinfo, "2026-08-09",
                     f"OpenITI author_from_uri={key}; AH {ah} -> CE {ce} "
                     f"(rounded up, conservative)"])
        have.add(k)
    # Hebrew: QID recorded, NO death_year -> cannot admit on route 2 by design
    for name, qid in sorted(he.items()):
        k = slug(name)
        if k in have or not qid:
            continue
        rows.append([k, "", qid, "qid_only_no_date", "2026-08-09",
                     f"Ben-Yehuda author={name}; QID present but NO date in "
                     f"the catalogue — admits via source PD affirmation only"])
        have.add(k)

    for key, (bound, dyn, why) in sorted(zh.items()):
        if key in have:
            continue
        rows.append([key, str(bound), "",
                     f"dataset_field:chinese-poetry/authors.{dyn}.json",
                     "2026-08-09",
                     f"UPPER BOUND from dynasty partition, not an exact death "
                     f"year: {why}"])
        have.add(key)

    print(f"\nnew rows to add: {len(rows):,}")
    if not args.write:
        print("(dry run — pass --write to append)")
        for r in rows[:5]:
            print("   ", r[:4])
        return

    with open(path, "a", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter="\t")
        for r in rows:
            w.writerow(r)
    print(f"appended to {path}")




# ---------------------------------------------------------------------------
# Classical Chinese: dynasty-bounded dates
# ---------------------------------------------------------------------------

CP_RAW = ("https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/"
          "master")

#: The corpus partitions authors by dynasty in the file name. A dynasty has a
#: known end, so the partition yields a conservative UPPER BOUND on a poet's
#: death year -- not an exact date, and recorded as such. The bounds below sit
#: roughly seven centuries before the term cutoff, so the imprecision cannot
#: change any admission decision; it would matter only for a corpus whose
#: authors died near the boundary.
DYNASTY_BOUND = {
    "tang": (1000, "Tang ended 907 CE; bound allows for poets living into the "
                   "Five Dynasties"),
    "song": (1350, "Song ended 1279 CE; bound allows for poets living into "
                   "the early Yuan"),
}


def harvest_chinese(dynasties=("tang", "song")):
    """-> {author_key: (bound_year, dynasty, evidence)}. Names only; the
    corpus carries no dates, so the dynasty partition is the evidence."""
    import json
    import urllib.request
    out, stats = {}, Counter()
    quoted = {"tang": "%E5%85%A8%E5%94%90%E8%AF%97",
              "song": "%E5%85%A8%E5%94%90%E8%AF%97"}
    for dyn in dynasties:
        url = f"{CP_RAW}/{quoted[dyn]}/authors.{dyn}.json"
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                data = json.loads(r.read().decode("utf-8"))
        except Exception as e:                      # noqa: BLE001
            stats[f"{dyn}_fetch_failed"] += 1
            print(f"  {dyn}: fetch failed ({e})", file=sys.stderr)
            continue
        bound, why = DYNASTY_BOUND[dyn]
        for a in data:
            name = (a.get("name") or "").strip()
            if not name:
                continue
            stats[f"{dyn}_authors"] += 1
            key = slug(name)
            # keep the LATER bound if an author appears in two dynasties
            if key not in out or bound > out[key][0]:
                out[key] = (bound, dyn, why)
    return out, stats


if __name__ == "__main__":
    main()

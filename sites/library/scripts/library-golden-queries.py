"""Write the fixed query set the Worker goldens are captured against.

The native Library tab re-implements the Worker's search, reading pages, hit
projection and selection ZIPs on Render. Before the Worker is retired its own
code answers a fixed, deterministic set of requests on the pinned 317c catalog
(capture-library-goldens.cjs), and the native routes must reproduce every
answer (mcp/test_library_routes.mjs, the library-parity job).

    python3 scripts/library-golden-queries.py SNAPSHOT_DIR OUT.json

The set is derived from the snapshot itself with a fixed stride, so it is the
same on every run: title, contributor and body fragments from readable units
in every language, held-only titles, filters, sorts, offsets, and the edge
cases the Worker's folding must survive (RTL, CJK, astral code points, sharp
s, whitespace runs, the 500-character cap).
"""

import json
import sys
from pathlib import Path


def fold(text):
    import unicodedata

    return " ".join(unicodedata.normalize("NFC", text).casefold().split())


def stride(items, count):
    if not items:
        return []
    step = max(1, len(items) // count)
    return items[::step][:count]


def main(argv):
    snapshot = Path(argv[1])
    index = json.loads((snapshot / "index.json").read_text(encoding="utf-8"))
    readings = sorted(index["readings"], key=lambda r: r["reading_unit_id"])
    readable = [r for r in readings if r["availability"] == "readable"]
    held = [r for r in readings if r["availability"] != "readable"]
    by_language = {}
    for r in readable:
        by_language.setdefault(r["language"], []).append(r)

    queries = []

    def add(label, **params):
        queries.append({"label": label, "params": {k: str(v) for k, v in params.items()}})

    # Default listings, sorts, offsets and availability views.
    add("default")
    add("default-offset-50", offset=50)
    add("default-offset-25000", offset=25000, limit=50)
    add("sort-contributor", sort="contributor")
    add("sort-contributor-offset", sort="contributor", offset=1000)
    for availability in ("all", "held", "research_only", "readable", "metadata_only", "rejected"):
        add(f"availability-{availability}", availability=availability)
    for completeness in sorted({r.get("completeness") or "" for r in readings} - {""}):
        add(f"completeness-{completeness}", completeness=completeness)
    for language in sorted({r["language"] for r in readings}):
        add(f"language-{language}", language=language)
        add(f"language-{language}-all", language=language, availability="all")

    # Title, contributor and body fragments, per language, by fixed stride.
    for language, units in sorted(by_language.items()):
        for r in stride(units, 20):
            title = r["title"]
            add(f"title-{language}", q=title[: max(4, min(24, len(title)))])
            if r.get("contributor_search"):
                add(f"contributor-q-{language}", q=r["contributor_search"][:20])
                add(f"contributor-filter-{language}", contributor=r["contributor_search"][:12])
    for r in stride(readable, 90):
        reading = json.loads((snapshot / r["path"]).read_text(encoding="utf-8"))
        lyric = [line["text"] for line in reading.get("lines", []) if line.get("kind") == "lyric" and line.get("text")]
        if lyric:
            line = lyric[len(lyric) // 2]
            add(f"body-{r['language']}", q=line[:40])
    for r in stride(held, 30):
        add("held-title", q=r["title"][:24], availability="held")

    # Collections and works.
    collections = sorted(index["collections"], key=lambda c: c["collection_id"])
    for c in stride([c for c in collections if c.get("readable_reading_unit_ids")], 15):
        add("collection", collection=c["collection_id"])
        add("collection-offset", collection=c["collection_id"], offset=50)
    for c in stride([c for c in collections if not c.get("readable_reading_unit_ids")], 5):
        add("collection-held", collection=c["collection_id"], availability="all")
    works = {}
    for r in readable:
        works.setdefault(r["work_id"], []).append(r["reading_unit_id"])
    for work in stride(sorted(w for w, ids in works.items() if len(ids) > 1), 10):
        add("work", work=work)

    # Edge cases for folding and limits.
    add("edge-sharp-s", q="Straße")
    add("edge-capital-sharp-s", q="STRASSE")
    add("edge-whitespace", q="  the   sea  ")
    add("edge-astral", q="\U0001d11e")
    add("edge-cap-500", q="a" * 500)
    add("edge-over-cap", q="a" * 501)
    add("edge-empty-q", q="")
    add("edge-limit-250", limit=250)
    add("edge-limit-0", limit=0)
    add("edge-negative-offset", offset=-1)
    add("edge-contributor-ascii-lower", contributor="WHITMAN")
    add("edge-contributor-nonascii", contributor="ḤĀFEẒ")
    for language in ("fas", "ltc"):
        for r in stride(by_language.get(language, []), 5):
            add(f"edge-script-{language}", q=fold(r["title"])[:8])

    seen, unique = set(), []
    for query in queries:
        key = json.dumps(query["params"], sort_keys=True, ensure_ascii=False)
        if key not in seen:
            seen.add(key)
            unique.append(query)

    reading_samples = [r["reading_unit_id"] for r in stride(readable, 40)]
    largest = max(readable, key=lambda r: r.get("lines") or 0)
    reading_samples.append(largest["reading_unit_id"])
    metadata_samples = [r["reading_unit_id"] for r in stride(readable, 10)] + [
        r["reading_unit_id"] for r in stride(held, 10)
    ]
    whole_source = [r for r in readable if r.get("whole_source_availability") == "readable"]
    partial_source = [r for r in readable if r.get("whole_source_availability") != "readable"]
    exports = [
        {"label": "single", "ids": [readable[0]["reading_unit_id"]]},
        {"label": "five-stride", "ids": [r["reading_unit_id"] for r in stride(readable, 5)]},
        {"label": "whole-source", "ids": [whole_source[0]["reading_unit_id"]]} if whole_source else None,
        {"label": "partial-source", "ids": [partial_source[0]["reading_unit_id"]]} if partial_source else None,
    ]
    out = {
        "format": 1,
        "snapshot_id": json.loads((snapshot / "manifest.json").read_text())["snapshot_id"],
        "search": unique,
        "readings": [
            {"id": rid, "offset": offset}
            for rid in reading_samples
            for offset in (0, 250)
        ]
        + [{"id": largest["reading_unit_id"], "offset": 22500}],
        "whole_readings": reading_samples[:5],
        "metadata": metadata_samples,
        "exports": [e for e in exports if e],
    }
    Path(argv[2]).write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{argv[2]}: {len(unique)} search queries, {len(out['readings'])} reading pages, {len(out['exports'])} exports")


if __name__ == "__main__":
    sys.exit(main(sys.argv))

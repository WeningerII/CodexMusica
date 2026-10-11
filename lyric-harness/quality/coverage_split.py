#!/usr/bin/env python3
"""THE COVERAGE SPLIT: a frozen, work-grouped dev / validation split of the
song corpus for the dictionary lane (#527 plan item C2).

    python3 quality/coverage_split.py --catalog DIR --write   # freeze it
    python3 quality/coverage_split.py --catalog DIR --check   # re-derive, compare

WHAT IT IS, AND WHAT IT IS NOT. Ranking and batch selection read the DEV
split only; the VALIDATION split is only ever reported. It is retrospective
validation: these works were surveyed before the split existed, so it is
unseen by SELECTION, not by people, and repeated batch feedback against it
keeps it validation, never a benchmark. Claims about modern songs need the
separate unseen test the plan leaves to John.

GROUP BEFORE SPLITTING, BY THE STRONGEST IDENTITY AVAILABLE (R2's order,
agreed on #527). An item is a corpus item (`--- TITLE:`, read as
quality/coverage_census.items_of reads it), identified as `<file>#<ordinal>`.
Items are joined into one group by any of:
  1. the Library catalog's `work_id`, where the item maps to a catalog reading
     (same source file, same position, the catalog title starting with the
     item's title);
  2. the corpus audit's reviewed edition decisions
     (data/calibration_work_editions.json: printings of one work in a file);
  3. the same normalized title AND the same normalized first line, across
     files;
  4. near-duplicates: two items sharing at least half of the smaller item's
     distinct normalized lines (lines under 12 letters, and lines found in
     more than 25 items, carry no evidence and are ignored).
Over-grouping is harmless and under-grouping leaks, so every rule only joins.

THE SPLIT IS A PURE FUNCTION OF THE GROUP KEY: a group's key is its smallest
member id, and the group is VALIDATION when the first 16 hex digits of
sha256(SALT + ":" + key), read as an integer, are 0 mod 5 -- about a fifth of
groups. The salt is published here and never changed for this split; a new
split is a new salt and a new file. The frozen assignment is
quality/results/coverage_split_2026-10-11.tsv, and its header records the
population digest, a digest of the catalog work identities it read, and the
counts.
"""
import argparse
import collections
import glob
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

SALT = "codexmusica-coverage-split-2026-10-11"
MODULUS = 5
POPULATION = "corpus/song/eng_*.txt"
SPLIT_PATH = os.path.join(HERE, "results", "coverage_split_2026-10-11.tsv")
EDITIONS_PATH = os.path.join(ROOT, "data", "calibration_work_editions.json")
NEAR_DUP_SHARE = 0.5
MIN_LINE_LETTERS = 12
MAX_LINE_ITEMS = 25


def norm(text):
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def units():
    """-> [(unit id, file, title, [sung line, ...], title line)] in a fixed
    order. The title line is the item's physical `--- TITLE:` line (1-based),
    the coordinate the reviewed edition decisions are keyed on."""
    from quality.audit_corpus import CorpusFile
    from quality.coverage_census import items_of
    out = []
    for path in sorted(glob.glob(os.path.join(ROOT, POPULATION))):
        rel = os.path.relpath(path, ROOT)
        items = items_of(path)
        title_lines = [i + 1 for i, l in enumerate(CorpusFile(path)._lines)
                       if l.rstrip().startswith("--- TITLE:")]
        if len(title_lines) != len(items):
            title_lines = [None] * len(items)
        ordinal = 0
        for (title, lines), at in zip(items, title_lines):
            if not lines:
                continue
            out.append((f"{rel}#{ordinal}", rel, title, lines, at))
            ordinal += 1
    return out


class Groups:
    def __init__(self, ids):
        self.parent = {i: i for i in ids}
        self.joins = collections.Counter()

    def find(self, x):
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def join(self, a, b, rule):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[max(ra, rb)] = min(ra, rb)
            self.joins[rule] += 1


def work_map_sha256(readings):
    """Digest of the catalog identities this split reads -- each song
    reading's source file, title and work_id -- rather than the catalog's
    snapshot id, which also moves with provenance text that names no work."""
    h = hashlib.sha256()
    for r in sorted((r for r in readings
                     if r.get("source_path", "").startswith("corpus/song/eng_")),
                    key=lambda r: (r["source_path"], r["reading_unit_id"])):
        h.update(f"{r['source_path']}\t{r['title']}\t{r['work_id']}\n".encode())
    return h.hexdigest()


def group(us, catalog_dir):
    """-> (Groups, evidence counts)."""
    g = Groups([u[0] for u in us])
    by_file = collections.defaultdict(list)
    for u in us:
        by_file[u[1]].append(u)
    evidence = {}

    # 1. Library catalog work_id, matched by file and position.
    with open(os.path.join(catalog_dir, "index.json"), encoding="utf-8") as fh:
        readings = json.load(fh)["readings"]
    cat = collections.defaultdict(list)
    for r in readings:
        cat[r.get("source_path", "")].append(r)
    by_work, matched = collections.defaultdict(list), 0
    for rel, items in by_file.items():
        rs = cat.get(rel, [])
        if len(rs) != len(items):
            continue
        for u, r in zip(items, rs):
            if norm(r["title"]).startswith(norm(u[2])):
                by_work[r["work_id"]].append(u[0])
                matched += 1
    for ids in by_work.values():
        for other in ids[1:]:
            g.join(ids[0], other, "catalog work_id")
    evidence["items mapped to a catalog work"] = matched
    evidence["catalog_work_map_sha256"] = work_map_sha256(readings)

    # 2. The corpus audit's reviewed editions of one work, matched by their
    #    physical title line.
    with open(EDITIONS_PATH, encoding="utf-8") as fh:
        works = json.load(fh)["works"]
    at = {(u[1], u[4]): u[0] for u in us if u[4] is not None}
    unmatched = 0
    for w in works:
        ids = []
        for e in w["editions"]:
            uid = at.get((w["file"], e["title_line"]))
            if uid is None:
                unmatched += 1
            else:
                ids.append(uid)
        for other in ids[1:]:
            g.join(ids[0], other, "reviewed editions")
    evidence["reviewed editions not matched to an item"] = unmatched

    # 3. Same normalized title and first line, across files.
    first = collections.defaultdict(list)
    for u in us:
        first[(norm(u[2]), norm(u[3][0]))].append(u[0])
    for ids in first.values():
        for other in ids[1:]:
            g.join(ids[0], other, "title and first line")

    # 4. Near-duplicates by shared normalized lines.
    linesets = {}
    holders = collections.defaultdict(set)
    for u in us:
        s = {n for n in (norm(l) for l in u[3])
             if len(re.sub(r"[^a-z]", "", n)) >= MIN_LINE_LETTERS}
        linesets[u[0]] = s
        for n in s:
            holders[n].add(u[0])
    shared = collections.Counter()
    for n, ids in holders.items():
        if 1 < len(ids) <= MAX_LINE_ITEMS:
            ids = sorted(ids)
            for i, a in enumerate(ids):
                for b in ids[i + 1:]:
                    shared[(a, b)] += 1
    for (a, b), k in shared.items():
        small = min(len(linesets[a]), len(linesets[b]))
        if small and k / small >= NEAR_DUP_SHARE:
            g.join(a, b, "near-duplicate lines")
    return g, evidence


def assign(us, g):
    """-> [(unit id, group key, split)] in unit order."""
    rows = []
    for u in us:
        key = g.find(u[0])
        h = int(hashlib.sha256(f"{SALT}:{key}".encode()).hexdigest()[:16], 16)
        rows.append((u[0], key, "validation" if h % MODULUS == 0 else "dev"))
    return rows


def build(catalog_dir):
    from quality.coverage_census import inputs_sha256
    us = units()
    g, evidence = group(us, catalog_dir)
    rows = assign(us, g)
    files = {u[1] for u in us}
    groups = collections.defaultdict(set)
    for uid, key, split in rows:
        groups[split].add(key)
    count = collections.Counter(split for _u, _k, split in rows)
    vfiles = {uid.split("#")[0] for uid, _k, s in rows if s == "validation"}
    meta = {
        "salt": SALT, "modulus": MODULUS, "population": POPULATION,
        "inputs_sha256": inputs_sha256(
            [os.path.join(ROOT, f) for f in sorted(files)]),
        "items": len(rows), "files": len(files),
        "groups": len(groups["dev"]) + len(groups["validation"]),
        "dev_items": count["dev"], "dev_groups": len(groups["dev"]),
        "validation_items": count["validation"],
        "validation_groups": len(groups["validation"]),
        "files_with_validation_items": len(vfiles),
        "joins": dict(sorted(g.joins.items())),
        "evidence": evidence,
    }
    return meta, rows


def render(meta, rows):
    out = ["# coverage split -- generated by quality/coverage_split.py --write;"
           " never edit by hand",
           "# " + json.dumps(meta, sort_keys=True),
           "unit\tgroup\tsplit"]
    out += ["\t".join(r) for r in rows]
    return "\n".join(out) + "\n"


def read_split(path=SPLIT_PATH):
    """-> ({unit id: split}, meta) from the frozen file."""
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().splitlines()
    meta = json.loads(lines[1][2:])
    return {l.split("\t")[0]: l.split("\t")[2] for l in lines[3:] if l}, meta


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--catalog", required=True,
                    help="a built Library catalog directory (python3 -m "
                         "library.catalog build ...): the work identities")
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)
    meta, rows = build(a.catalog)
    text = render(meta, rows)
    print(json.dumps(meta, indent=1, sort_keys=True))
    if a.write:
        os.makedirs(os.path.dirname(SPLIT_PATH), exist_ok=True)
        with open(SPLIT_PATH, "w", encoding="utf-8") as fh:
            fh.write(text)
        print(f"wrote {os.path.relpath(SPLIT_PATH, ROOT)}")
        return 0
    if not os.path.exists(SPLIT_PATH):
        print(f"CANNOT TELL: {os.path.relpath(SPLIT_PATH, ROOT)} is not written")
        return 2
    with open(SPLIT_PATH, encoding="utf-8") as fh:
        same = fh.read() == text
    print("RESULT: " + ("PASS -- the frozen split re-derives byte for byte" if same
                        else "MOVED -- the population, catalog or grouping changed; "
                             "a moved split is a NEW split, never an edit"))
    return 0 if same else 1


if __name__ == "__main__":
    sys.exit(main())

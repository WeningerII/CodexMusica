#!/usr/bin/env python3
"""Re-derive the two residue measurements `MISSING.md` M-25 quotes.

    python3 quality/results/otterbein_m25_2026-10-04/final/residue_measure.py

Run from `lyric-harness/`. Read-only: it reads the corpus at HEAD, the same
files at commit 62b4fb87 (the Otterbein staging, before either apparatus pass)
through `git show`, and the two apparatus receipts. It writes
`residue_measure.json` beside itself.

1. SHRUNK ITEMS. Every item the two passes touched, compared before (62b4fb87)
   and after (HEAD) through the shared reader `quality/lyric_reader.lyric_items`.
   An item is listed when the passes left it with 3 sung lines or fewer, or
   with under 34% of the lines it had. This is a measurement of WHERE to
   look, not a reading: which of the listed lines are editorial is decided by
   reading them (M-25 records that reading).

2. ADJACENT SUNG ROWS. A sung row (reader kind `lyric`) whose nearest line
   above or below -- skipping only bracketed section marks, never a blank line
   or a title -- is a line either pass annotated whose printed text is 25
   characters or longer and is not itself a bracketed mark (shorter annotated
   lines are labels, numerals and bylines). Counted once per row, and split by
   which pass annotated the neighbour. Most such rows are correctly sung, so the
   set is a list of places to start reading, not a count of residue.
"""
import collections
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "quality"))
from quality import lyric_reader as R  # noqa: E402

BEFORE = "62b4fb87"
RECEIPTS = (("M-25(a)", "data/english_apparatus_m25_2026-10-04.json"),
            ("label pass", "data/english_apparatus_labels_2026-10-04.json"))
MARK = re.compile(r"^(# APPARATUS:\s*)?\[[^\]]*\]$")


def _git_show(rev, rel):
    return subprocess.run(["git", "show", f"{rev}:lyric-harness/{rel}"], cwd=ROOT,
                          capture_output=True, text=True).stdout


def _main():
    annotated = collections.defaultdict(dict)      # file -> {line: pass}
    for label, rec in RECEIPTS:
        for f in json.load(open(os.path.join(ROOT, rec), encoding="utf-8"))["files"]:
            for ln, rep in f["replacements"].items():
                annotated[f["file"]][int(ln)] = (label, rep["before"].strip())
    shrunk = []
    with tempfile.TemporaryDirectory() as tmp:
        for name in sorted(annotated):
            rel = "corpus/song/" + name
            old = _git_show(BEFORE, rel)
            if not old:
                continue
            path = os.path.join(tmp, name)
            open(path, "w", encoding="utf-8").write(old)
            before = {at: len(body) for _t, at, body in R.lyric_items(path)}
            for title, at, body in R.lyric_items(os.path.join(ROOT, rel)):
                n0, n1 = before.get(at), len(body)
                if n0 is None or n1 >= n0 or n1 == 0:
                    continue
                if n1 <= 3 or n1 / n0 < 0.34:
                    shrunk.append({"file": name, "title_line": at, "title": title,
                                   "sung_lines_before": n0, "sung_lines_after": n1,
                                   "left": [[r.lineno, r.text] for r in body]})
    adjacent = collections.Counter()
    rows = []
    for name, lines in sorted(annotated.items()):
        prose = {ln: who for ln, (who, text) in lines.items()
                 if len(text) >= 25 and not MARK.match(text)}
        if not prose:
            continue
        path = os.path.join(ROOT, "corpus/song", name)
        raw = open(path, encoding="utf-8").read().splitlines()
        kinds = {row.lineno: row for row in R.normalized_rows(path)}
        for ln, row in kinds.items():
            if row.kind != "lyric":
                continue
            who = set()
            for step in (-1, 1):
                j = ln + step
                while j in kinds and kinds[j].kind == "apparatus" and j not in prose \
                        and MARK.match(raw[j - 1].strip()):
                    j += step
                if j in prose:
                    who.add(prose[j])
            if who:
                key = " + ".join(sorted(who))
                adjacent[key] += 1
                rows.append([name, ln, key])
    out = {"before_commit": BEFORE,
           "shrunk_items": shrunk,
           "shrunk_summary": {"items": len(shrunk),
                              "lines_left": sum(s["sung_lines_after"] for s in shrunk)},
           "adjacent_summary": {"rows": len(rows),
                                "files": len({r[0] for r in rows}),
                                "by_pass": dict(adjacent)},
           "adjacent_rows": rows}
    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "residue_measure.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print(json.dumps({"shrunk": out["shrunk_summary"], "adjacent": out["adjacent_summary"]}))


if __name__ == "__main__":
    _main()

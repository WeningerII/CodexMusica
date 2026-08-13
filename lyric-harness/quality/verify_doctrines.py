#!/usr/bin/env python3
"""Doctrine cross-reference verifier.

The split of CLAUDE.md into CLAUDE.md + quality/METHOD.md is only safe if every
`doctrine N` reference in the repository still resolves to exactly one
definition. This asserts three things:

  1. every number DEFINED across the two files is defined exactly ONCE
  2. every number REFERENCED anywhere in the repo is defined somewhere
  3. no number that was defined before the split has been lost

Run:  python3 verify_doctrines.py [--baseline]
`--baseline` writes the pre-split definition set to disk so (3) can be checked
against it afterwards.
"""
import json
import os
import re
import sys

ROOT = "/home/user/CodexMusica/lyric-harness"
SCRATCH = os.path.dirname(os.path.abspath(__file__))
BASELINE = os.path.join(SCRATCH, "baseline_defined.json")

#: A doctrine DEFINITION is a numbered item at the head of a line whose title is
#: bold.  Both files use it; nothing else in the repo does.
DEF = re.compile(r"^(\d+)\. \*\*", re.M)

#: A REFERENCE is "doctrine"/"doctrines" followed by one or more numbers joined
#: by /, comma, &, +, "and", "or".  The separator run must be followed by a
#: BARE number, so "doctrine 88, and doctrine 79" yields {88, 79} as two
#: references rather than swallowing the word "doctrine".
#: a literal SPACE, not \s -- `data/concreteness.txt` has a lexicon row
#: "doctrine\t0\t2.12" that a \s would read as a reference to doctrine 0.
REF_HEAD = re.compile(r"doctrines?[ ]+(\d+)", re.I)
REF_TAIL = re.compile(r"\s*(?:[,/&+]|and|or)\s*(\d+)", re.I)

SKIP_DIRS = {"__pycache__", ".git", "node_modules"}
# THIS FILE EXCLUDES ITSELF, and the reason is a small instance of the general
# problem. The checker documents the `data/concreteness.txt` trap -- a lexicon
# row `doctrine<TAB>0` that a \s-based reference regex reads as a citation of
# "doctrine 0" -- and writing that sentence down created a real citation of a
# doctrine that does not exist. Promoted from a sibling's scratch directory
# into quality/ on 2026-08-11, it failed on its own prose within one run.
# An instrument placed inside the population it measures becomes part of it.
SKIP_FILES = {"cmudict.dict", "wordfreq20k.txt",
              os.path.basename(os.path.abspath(__file__))}
TEXTY = (".md", ".py", ".tsv", ".txt", ".json", ".sh", ".toml", ".cfg", ".yml",
         ".yaml")


def walk():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in sorted(filenames):
            if fn in SKIP_FILES or not fn.endswith(TEXTY):
                continue
            yield os.path.join(dirpath, fn)


def references():
    """-> {number: {relpath: count}} over the whole repo."""
    out = {}
    for path in walk():
        try:
            text = open(path, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        rel = os.path.relpath(path, ROOT)
        for m in REF_HEAD.finditer(text):
            nums = [int(m.group(1))]
            pos = m.end()
            while True:
                t = REF_TAIL.match(text, pos)
                if not t:
                    break
                nums.append(int(t.group(1)))
                pos = t.end()
            for n in nums:
                out.setdefault(n, {}).setdefault(rel, 0)
                out[n][rel] += 1
    return out


def definitions():
    """-> {number: [relpath, ...]} across the two doctrine files."""
    out = {}
    for rel in ("CLAUDE.md", "quality/METHOD.md"):
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            continue
        text = open(path, encoding="utf-8").read()
        # Only the delimited doctrine runs define numbers.  The `Known gaps`
        # list (1-7, cited elsewhere as `known gap N`) uses the same markdown
        # shape and must stay out of the count, so definitions are read ONLY
        # from between the DOCTRINE-BLOCK markers.
        runs = re.findall(r"<!-- DOCTRINE-BLOCK -->(.*?)<!-- /DOCTRINE-BLOCK -->",
                          text, re.S)
        assert runs, f"{rel} carries no <!-- DOCTRINE-BLOCK --> markers"
        for run in runs:
            for m in DEF.finditer(run):
                out.setdefault(int(m.group(1)), []).append(rel)
    return out


def gap_check():
    """`known gap N` must still resolve against CLAUDE.md's 1-7 list."""
    claude = open(os.path.join(ROOT, "CLAUDE.md"), encoding="utf-8").read()
    body = claude.split("## Known gaps, priority order")[1].split("\n## ")[0]
    defined = {int(m.group(1)) for m in DEF.finditer(body)}
    cited = set()
    for path in walk():
        try:
            t = open(path, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        cited |= {int(n) for n in re.findall(r"known gaps?[ ]+(\d+)", t, re.I)}
    return defined, cited


def main():
    refs = references()
    defs = definitions()
    if "--baseline" in sys.argv:
        json.dump(sorted(defs), open(BASELINE, "w"))
        print(f"baseline written: {len(defs)} numbers -> {BASELINE}")

    print("=" * 74)
    print("DOCTRINE CROSS-REFERENCE VERIFICATION")
    print("=" * 74)

    per_file = {}
    for n, homes in defs.items():
        for h in homes:
            per_file.setdefault(h, []).append(n)
    for f in sorted(per_file):
        ns = sorted(per_file[f])
        print(f"  defined in {f:22s} {len(ns):3d}  {_ranges(ns)}")
    print(f"  {'TOTAL DEFINED':33s} {len(defs):3d}")

    ok = True

    dup = {n: h for n, h in defs.items() if len(h) > 1}
    print()
    print(f"[{'ok  ' if not dup else 'FAIL'}] no number is defined twice")
    for n, h in sorted(dup.items()):
        ok = False
        print(f"         doctrine {n} defined in {h}")

    n_ref_sites = sum(sum(v.values()) for v in refs.values())
    unresolved = {n: v for n, v in refs.items() if n not in defs}
    print(f"[{'ok  ' if not unresolved else 'FAIL'}] every referenced number "
          f"resolves  ({n_ref_sites} reference sites, "
          f"{len(refs)} distinct numbers)")
    for n, where in sorted(unresolved.items()):
        ok = False
        tot = sum(where.values())
        print(f"         doctrine {n}: {tot} references, no definition "
              f"({', '.join(sorted(where)[:3])})")

    if os.path.exists(BASELINE):
        base = set(json.load(open(BASELINE)))
        lost = base - set(defs)
        gained = set(defs) - base
        print(f"[{'ok  ' if not lost else 'FAIL'}] nothing defined before the "
              f"split has been lost  (baseline {len(base)})")
        for n in sorted(lost):
            ok = False
            print(f"         doctrine {n} LOST")
        if gained:
            print(f"         (new since baseline: {sorted(gained)})")
    else:
        print("[skip] no baseline on disk; run with --baseline first")

    gaps = [n for n in range(1, max(defs) + 1) if n not in defs] if defs else []
    print(f"[{'ok  ' if not gaps else 'FAIL'}] the definition set is a "
          f"contiguous run 1..{max(defs) if defs else 0}")
    for n in gaps:
        print(f"         doctrine {n} missing from the run")
    # A GAP IS A FAILURE, not a warning. Until 2026-08-13 this printed WARN and
    # left `ok` alone, so a deleted or renumbered doctrine exited 0 -- while
    # CLAUDE.md's own statement of the invariant reads "that set must be
    # exactly 1-95, with no number in both", and the whole point of the
    # numbering is that `doctrine 79` resolves from any of ~3,266 citation
    # sites. Found while adding the CI job that runs this: an injected
    # out-of-range doctrine printed WARN and the process still exited 0, so
    # the step would have been green on exactly the breakage it is named for.
    # A check that cannot fail is decoration (doctrine 48).
    if gaps:
        ok = False

    gdef, gcited = gap_check()
    missing_gaps = gcited - gdef
    print(f"[{'ok  ' if not missing_gaps else 'FAIL'}] every `known gap N` "
          f"resolves against CLAUDE.md's own 1-{max(gdef)} list  "
          f"(cited: {sorted(gcited)})")
    for n in sorted(missing_gaps):
        ok = False
        print(f"         known gap {n} cited, not defined")

    uncited = sorted(set(defs) - set(refs))
    print(f"[note] {len(uncited)} doctrines are cited nowhere but this file "
          f"pair: {uncited}")

    print()
    print("MOST-CITED DOCTRINES (reference sites across the whole repo)")
    top = sorted(refs.items(), key=lambda kv: -sum(kv[1].values()))[:12]
    for n, where in top:
        home = defs.get(n, ["UNDEFINED"])[0]
        print(f"  doctrine {n:<3d} {sum(where.values()):4d} sites  "
              f"in {len(where):2d} files   home: {home}")

    print()
    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


def _ranges(ns):
    out, i = [], 0
    while i < len(ns):
        j = i
        while j + 1 < len(ns) and ns[j + 1] == ns[j] + 1:
            j += 1
        out.append(str(ns[i]) if i == j else f"{ns[i]}-{ns[j]}")
        i = j + 1
    return ", ".join(out)


if __name__ == "__main__":
    sys.exit(main())

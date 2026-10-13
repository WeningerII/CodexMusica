"""The CMUdict apostrophe rows whose exact reading the approved batch (M2a,
exact entry first) would select over today's reading while disagreeing with
it: John's separate data decision (PR #527, R2 6136624835; 3PO 6136650105).
Read-only. It changes no reading and adjudicates none.

    python3 quality/results/acceptance_2026-10-13/disputed_rows.py OUT.json [MPRON]

Two shapes, each defined by spelling: `<w>s'` rows whose bare plural `<w>s`
is a row, and `<w>in'` rows whose `-ing` word `<w>ing` is a row. "Today" is
what `pronunciation_variants` returns for the token now: the bare plural's
readings for `s'`, the `-ing` reduction for `in'`. ONE criterion for both:
  disputed      NO exact reading equals ANY of today's readings under the
                `bb8` normalization: the data decision
  first_switch  they share a reading, but the exact row's FIRST reading is not
                today's first: a variant-order change M2a makes, disclosed and
                tested, not a data dispute
NORMALIZATIONS (each row carries all three verdicts):
  strict  phones compared as written
  bb8     stress digits dropped; unstressed AH0, IH0 and ER0 merged into one
          reduced vowel (BB8's 56)
  broad   stress digits dropped, then AH, IH and ER merged at every stress
          (a candidate reading of R2's 52, which strips stress first)
`in_broad` marks disputed rows that also share nothing under `broad`. Dev occurrences count words cut by the dash rule (`line_tokens`, then
`-{2,}`), apostrophes folded, case folded. MPRON (default: the staged
`data/moby/mpron.txt`) must be the pinned Moby file; its readings are listed
as reference only, never as a verdict, for the row, its bare or `-ing` word and an `s'` row's singular stem (Moby lists few plurals); omitted if it is not staged.
"""
import collections, glob, hashlib, json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, ROOT)
import lyric_harness as LH  # noqa: E402
from quality import moby_convert as MC  # noqa: E402
from quality.coverage_census import POPULATIONS, items_of  # noqa: E402
from quality.coverage_split import SPLIT_PATH, checked_assignment  # noqa: E402


def _bb8(p):
    return tuple("@" if x in ("AH0", "IH0", "ER0") else re.sub(r"\d", "", x) for x in p)


def _broad(p):
    return tuple("@" if re.sub(r"\d", "", x) in ("AH", "IH", "ER") else re.sub(r"\d", "", x) for x in p)


def _share(a, b, f):
    return bool({f(tuple(x)) for x in a} & {f(tuple(x)) for x in b})


def _dev_counts():
    assignment, _ = checked_assignment()
    keep = {u for u, s in assignment.items() if s == "dev"}
    c = collections.Counter(); end = collections.Counter()
    for path in sorted({p for g in POPULATIONS["song"] for p in glob.glob(os.path.join(ROOT, g), recursive=True)}):
        rel = os.path.relpath(path, ROOT); ordinal = -1
        for _t, ls in items_of(path):
            if not ls:
                continue
            ordinal += 1
            if f"{rel}#{ordinal}" not in keep:
                continue
            for line in ls:
                ws = [p.strip("-") for t in LH.line_tokens(line) for p in re.split(r"-{2,}", t)]
                ws = [LH.fold_apostrophes(w).lower() for w in ws if w]
                for i, w in enumerate(ws):
                    c[w] += 1
                    end[w] += i == len(ws) - 1
    return c, end


def _main():
    out = sys.argv[1]
    mpron = sys.argv[2] if len(sys.argv) > 2 else MC.staged_mpron()
    E = LH.Lexicon().entries
    lex = LH.Lexicon()
    moby = {}
    if os.path.exists(mpron):
        if hashlib.sha256(open(mpron, "rb").read()).hexdigest() != MC.MPRON_SHA256:
            sys.exit(f"REFUSED: {mpron} is not the pinned Moby file")
        moby = MC.load(mpron)
    occ, occ_end = _dev_counts()
    rows = []
    for k in sorted(E):
        if k.endswith("s'") and k[:-1] in E:
            shape, today, refs = "s'", E[k[:-1]], (k, k[:-1], k[:-2])
        elif k.endswith("in'") and (k[:-1] + "g") in E:
            shape, today, refs = "in'", lex.pronunciation_variants(k), (k, k[:-1] + "g")
        else:
            continue
        if not today:
            continue
        if _share(E[k], today, _bb8):
            if list(E[k][0]) == list(today[0]):
                continue
            kind = "first_switch"
        else:
            kind = "disputed"
        rows.append({
            "row": k, "shape": shape, "kind": kind,
            "exact": [" ".join(p) for p in E[k]],
            "today": [" ".join(p) for p in today],
            "in_broad": not _share(E[k], today, _broad) if kind == "disputed" else None,
            "dev_occurrences": occ[k], "dev_line_end": occ_end[k],
            "moby_reference": {w: [" ".join(p) for p in moby.get(w, [])] for w in refs} if moby else None,
        })
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    rec = {"commit": commit, "split": os.path.relpath(SPLIT_PATH, ROOT), "dictionary": "CMUdict (plain Lexicon)",
           "mpron_sha256": MC.MPRON_SHA256 if moby else None,
           "counts": {f"{kind} {shape}": {"rows": sum(r["kind"] == kind and r["shape"] == shape for r in rows),
                                           "rows_seen_on_dev": sum(r["kind"] == kind and r["shape"] == shape
                                                                   and r["dev_occurrences"] > 0 for r in rows),
                                           "dev_occurrences": sum(r["dev_occurrences"] for r in rows
                                                                  if r["kind"] == kind and r["shape"] == shape)}
                      for kind in ("disputed", "first_switch") for shape in ("s'", "in'")},
           "disputed_also_under_broad": sum(bool(r["in_broad"]) for r in rows),
           "rows": rows}
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(rec, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(json.dumps(rec["counts"]))


if __name__ == "__main__":
    _main()

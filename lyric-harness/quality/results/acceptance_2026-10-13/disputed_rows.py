"""The CMUdict edge-apostrophe rows whose exact reading the approved batch (M2a,
exact entry first) would select over today's first reading: the input to John's
separate data decision (PR #527, R2 6136624835; 3PO 6136650105). Read-only. It
changes no reading and adjudicates none.

    python3 quality/results/acceptance_2026-10-13/disputed_rows.py quality/results/acceptance_2026-10-13/disputed_rows.json MPRON

SHAPES, by spelling, each against "today", which is what the reader returns for
the token now (`Lexicon.pronunciation_variants`):
  s'     `<w>s'` with a bare plural row `<w>s` (today: the plural's readings)
  in'    `<w>in'` with an `-ing` row `<w>ing` (today: the `-ing` reduction)
  other  any other row with an edge apostrophe (today: the stripped key's
         readings, or nothing)
A row is listed when its first reading is not today's first reading.

KIND, one criterion for every shape:
  disputed     no exact reading equals any of today's readings under `bb8`
               (below): the data decision
  equivalent   they share a reading under `bb8` but not as written
  reorder      they share a reading as written; only the first choice moves
`letter_name_today` marks rows whose today-first reading is the key's spelled
letters under CMUdict's dotted alphabet (`a.`..`z.`): the misreading M2a exists
to fix, not a dispute. `first_change` compares the exact row's first reading
with today's first: `stress/reduced only`, `other phones` or `syllable count`.

NORMALIZATIONS (every row carries all three `share_*` verdicts):
  strict  phones as written
  bb8     stress kept until the unstressed AH0, IH0 and ER0 are merged into one
          reduced vowel, then the remaining stress digits dropped
  broad   stress dropped first, then AH, IH and ER merged at every stress. It
          gives 48 disputed `s'` rows; R2's 52 on #527 is not reproduced by
          any normalization tried here.

Dev occurrences count words cut by the dash rule (`line_tokens`, then
`-{2,}`, edge hyphens off), apostrophes folded, case folded. MPRON must be the
pinned Moby file (sha256 below); its readings are reference only, never a
verdict, for the row, today's word and an `s'` row's singular (derived by
rule: -ies to -y, -es after s/x/z/ch/sh dropped, else -s dropped).
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


def _vowels(p):
    return sum(1 for x in p if x[-1:].isdigit())


def _first_change(x, y):
    if _vowels(x) != _vowels(y):
        return "syllable count"
    return "stress/reduced only" if _bb8(x) == _bb8(y) else "other phones"


def _singular(plural):
    if plural.endswith("ies"):
        return plural[:-3] + "y"
    if re.search(r"(s|x|z|ch|sh)es$", plural):
        return plural[:-2]
    return plural[:-1]


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
    out, mpron = sys.argv[1], sys.argv[2]
    if not os.path.exists(mpron):
        sys.exit(f"CANNOT TELL: MPRON {mpron} does not exist (stage the pinned Moby file)")
    if hashlib.sha256(open(mpron, "rb").read()).hexdigest() != MC.MPRON_SHA256:
        sys.exit(f"REFUSED: {mpron} is not the pinned Moby file")
    moby = MC.load(mpron)
    lex = LH.Lexicon()
    E = lex.entries
    names = {ch: [_bb8(p) for p in E.get(ch + ".", [])] for ch in "abcdefghijklmnopqrstuvwxyz"}

    def spelled(key, phones):
        if not (key.isascii() and key.isalpha()):
            return False
        opts = {()}
        for ch in key:
            opts = {o + n for o in opts for n in names[ch]}
        return _bb8(phones) in opts

    occ, occ_end = _dev_counts()
    rows = []
    for k in sorted(E):
        if not (k.startswith("'") or k.endswith("'")) or not k.strip("'"):
            continue
        if k.endswith("s'") and k[:-1] in E:
            shape, today, refs = "s'", E[k[:-1]], (k, k[:-1], _singular(k[:-1]))
        elif k.endswith("in'") and (k[:-1] + "g") in E:
            shape, today, refs = "in'", lex.pronunciation_variants(k), (k, k[:-1] + "g")
        else:
            shape, today, refs = "other", lex.pronunciation_variants(k), (k, k.strip("'"))
        today = [list(p) for p in today]
        if today and list(E[k][0]) == today[0]:
            continue
        s_strict, s_bb8, s_broad = (_share(E[k], today, f) for f in (tuple, _bb8, _broad))
        rows.append({
            "row": k, "shape": shape,
            "kind": "reorder" if s_strict else ("equivalent" if s_bb8 else "disputed"),
            "share_strict": s_strict, "share_bb8": s_bb8, "share_broad": s_broad,
            "letter_name_today": bool(today) and spelled(k.strip("'"), today[0]),
            "first_change": _first_change(E[k][0], today[0]) if today else "today unread",
            "exact": [" ".join(p) for p in E[k]], "today": [" ".join(p) for p in today],
            "dev_occurrences": occ[k], "dev_line_end": occ_end[k],
            "moby_reference": {w: [" ".join(p) for p in moby.get(w, [])] for w in refs},
        })
    counts = {}
    for r in rows:
        key = f"{r['shape']} {r['kind']}"
        c = counts.setdefault(key, {"rows": 0, "rows_seen_on_dev": 0, "dev_occurrences": 0})
        c["rows"] += 1; c["rows_seen_on_dev"] += r["dev_occurrences"] > 0; c["dev_occurrences"] += r["dev_occurrences"]
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    rec = {"commit": commit, "split": os.path.relpath(SPLIT_PATH, ROOT), "dictionary": "CMUdict (plain Lexicon)",
           "mpron_sha256": MC.MPRON_SHA256, "counts": dict(sorted(counts.items())),
           "disputed_s'_under_broad": sum(r["shape"] == "s'" and not r["share_broad"] for r in rows),
           "letter_name_today_rows": sum(r["letter_name_today"] for r in rows),
           "dev_seen_rows_changing_more_than_a_reduced_vowel": [
               {k: r[k] for k in ("row", "kind", "first_change", "exact", "today", "dev_occurrences")}
               for r in rows if r["dev_occurrences"] and r["first_change"] != "stress/reduced only"],
           "rows": rows}
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(rec, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(json.dumps({k: rec[k] for k in ("counts", "disputed_s'_under_broad", "letter_name_today_rows")}))


if __name__ == "__main__":
    _main()

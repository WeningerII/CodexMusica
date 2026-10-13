"""Item 6's four classes of hyphenated anchor end tokens, with a stable id per
line, under two stated selection definitions (PR #527: BB8 6135254060, R2
6135431977, 3PO 6135442083). Read-only; dev side; SupplementedLexicon(v2),
no fallback; the end token is `raw_final_token`, as the grader takes it.

    python3 quality/results/scope_2026-10-12/hyphen_end_classes.py quality/results/scope_2026-10-12/hyphen_end_classes.jsonl.gz

Definitions (each record carries both):
  bb8  the token matches `\\w[-‑]\\w` somewhere; then `-`/`‑` stripped from its
       edges (the definition behind BB8's 86 / 2,962 / 147 / 411).
  r2   dashes (`-`, `‑`, `–`, `—`) stripped from the edges; then the token
       must contain a single hyphen between letter-bearing pieces and no
       internal `--` (R2's third row, as BB8 reads its description).
  policy  the agreed dash rule applied: edge dashes stripped, the token split
       into words at every internal dash (`--`, `–`, `—`), and the LAST word
       taken; it is in the population when that word has a true hyphen
       between letter-bearing pieces (an apostrophe may sit beside it).
Classes: whole (the stripped token has a whole-word reading), pieces (no
whole entry; every piece reads), earlier (last piece reads, an earlier one
does not), last (last piece unread). `read_whole_today` says whether the
grader's own `word_pieces(raw token)` reads it as one piece today.
"""
import glob, gzip, json, os, re, subprocess, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, ROOT)
import lyric_harness as LH  # noqa: E402
from quality.coverage_census import POPULATIONS, build_lexicon, items_of  # noqa: E402
from quality.coverage_split import SPLIT_PATH, checked_assignment  # noqa: E402

_HY = "-‑"
_DASH = "-‑–—"


def _classify(lex, w):
    if not lex.transcribe_word(w)[1]:
        return "whole"
    pieces = [p for p in re.split("[" + _HY + "]", w) if p]
    if all(not lex.transcribe_word(p)[1] for p in pieces):
        return "pieces"
    if not lex.transcribe_word(pieces[-1])[1]:
        return "earlier"
    return "last"


def _main():
    out = sys.argv[1]
    lex = build_lexicon("v2", "none")
    assignment, _ = checked_assignment()
    keep = {u for u, s in assignment.items() if s == "dev"}
    paths = sorted({p for g in POPULATIONS["song"] for p in glob.glob(os.path.join(ROOT, g), recursive=True)})
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    counts = {"bb8": collections.Counter(), "r2": collections.Counter(), "policy": collections.Counter()}
    lines = 0
    with gzip.open(out, "wt", encoding="utf-8") as fh:
        fh.write(json.dumps({"header": True, "commit": commit, "split": os.path.relpath(SPLIT_PATH, ROOT),
                             "lexicon": {"supplement": "v2", "fallback": "none"}}) + "\n")
        for path in paths:
            rel = os.path.relpath(path, ROOT); ordinal = -1
            for _t, ls in items_of(path):
                if not ls:
                    continue
                ordinal += 1
                if f"{rel}#{ordinal}" not in keep:
                    continue
                for li, line in enumerate(ls):
                    at = LH.raw_final_token(line, strip_parens=lex.strip_parens)
                    if not at:
                        continue
                    lines += 1
                    rec = {}
                    if re.search(r"\w[" + _HY + r"]\w", at):
                        w = at.strip(_HY)
                        rec["bb8"] = {"word": w, "class": _classify(lex, w)}
                    w2 = at.strip(_DASH)
                    if "--" not in w2 and re.search(r"[^\W\d_]['’]?[" + _HY + r"]['’]?[^\W\d_]", w2):
                        rec["r2"] = {"word": w2, "class": _classify(lex, w2)}
                    w3 = re.split(r"(?:--+|[\u2013\u2014])", at.strip(_DASH))[-1].strip(_DASH)
                    if re.search(r"[^\W\d_]['’]?[" + _HY + r"]['’]?[^\W\d_]", w3):
                        rec["policy"] = {"word": w3, "class": _classify(lex, w3)}
                    if not rec:
                        continue
                    pcs = [p for p in lex.word_pieces(at) if p]
                    rec.update({"id": f"{rel}#{ordinal}:{li}", "line": line, "raw_token": at,
                                "read_whole_today": len(pcs) == 1 and not lex.transcribe_word(pcs[0])[1]})
                    for d in ("bb8", "r2", "policy"):
                        if d in rec:
                            counts[d][rec[d]["class"]] += 1
                            if rec[d]["class"] == "whole":
                                counts[d]["whole, read whole today" if rec["read_whole_today"] else "whole, NOT read whole today"] += 1
                    fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(json.dumps({"anchor_end_lines": lines, **{d: dict(c) for d, c in counts.items()},
                      "totals": {d: sum(c[k] for k in ("whole", "pieces", "earlier", "last")) for d, c in counts.items()}}, indent=1))


if __name__ == "__main__":
    _main()

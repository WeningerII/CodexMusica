"""The unmarked-voices residual: token positions where (token N, word) is the
same with voices on and off but names a different physical word. A
declaration numbered under one setting and sent unmarked to a run with the
other passes the token/word check there and binds that other word (PR #527,
6148492945; documented as a residual by the agreed design, 6148531804).

    python3 quality/results/acceptance_2026-10-13/voices_exposure.py quality/results/acceptance_2026-10-13/voices_exposure.json [HARNESS_ROOT]

Physical identity is the character span in the harness's own tokenizer
(`_TOKEN_RUN` over the line after `join_spaced_enclitics`). These are offsets
in that joined, apostrophe-folded text, NOT original-source offsets; a
declaration-binding oracle built on them must keep that distinction (3PO,
6148925490). A voices-off token is a voices-on token outside every `(...)`
span. A line where this rebuild does not reproduce `line_tokens` exactly,
either way, is counted as unmapped and never guessed. Every row is counted,
so a repeated identical line counts each time.

Three populations over `corpus/song/eng_*`, reported side by side (3PO,
6148890765, 6148925490):
- `reader`: the harness's own sung lines, `load_lyric_lines(path)`. This
  applies apparatus filtering, bracket edits, stripping and the declared
  label prefixes.
- `raw_non_header`: a RAW FILTER, the non-blank rows not beginning '#' or
  '['. This is R2's population for the v1/v2 count (#519, 6147888133).
- `raw_sung`: a RAW FILTER, as above but also excluding rows beginning '---'.
"""
import glob, json, os, re, sys
ROOT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else
                       os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
sys.path.insert(0, ROOT)
from lyric_harness import (line_tokens, join_spaced_enclitics, load_lyric_lines,  # noqa: E402
                           _TOKEN_RUN, LATIN_SCRIPT)


def measure(t):
    """None when voices cuts the line the same either way; else (unmapped,
    [(token, word, span_on, span_off)])."""
    if "(" not in t:
        return None
    on_w, off_w = line_tokens(t, strip_parens=False), line_tokens(t, strip_parens=True)
    if on_w == off_w:
        return None
    joined = join_spaced_enclitics(t)
    parens = [m.span() for m in re.finditer(r"\([^)]*\)", joined)]
    on = [(m.group(), m.span()) for m in _TOKEN_RUN.finditer(joined) if LATIN_SCRIPT.search(m.group())]
    off = [(w, s) for w, s in on if not any(a <= s[0] and s[1] <= b for a, b in parens)]
    if [w for w, _ in on] != on_w or [w for w, _ in off] != off_w:
        return True, []
    return False, [(i + 1, on[i][0], list(on[i][1]), list(off[i][1]))
                   for i in range(min(len(on), len(off))) if on[i][0] == off[i][0] and on[i][1] != off[i][1]]


def count(rows):
    out = {"lines": 0, "lines_cut_differently_by_voices": 0, "unmapped_lines": 0,
           "ambiguous_positions": 0, "ambiguous_lines": 0}
    found = []
    for name, t in rows:
        out["lines"] += 1
        m = measure(t)
        if m is None:
            continue
        out["lines_cut_differently_by_voices"] += 1
        unmapped, hits = m
        out["unmapped_lines"] += unmapped
        out["ambiguous_positions"] += len(hits)
        out["ambiguous_lines"] += bool(hits)
        found += [{"file": name, "line": t, "token": n, "word": w, "span_voices_on": a, "span_voices_off": b}
                  for n, w, a, b in hits]
    return out, found


files = sorted(glob.glob(os.path.join(ROOT, "corpus", "song", "eng_*")))
raw = []
reader = []
for f in files:
    name = os.path.basename(f)
    with open(f, encoding="utf-8") as fh:
        raw += [(name, r.rstrip("\n")) for r in fh]
    reader += [(name, t) for t in load_lyric_lines(f)]
non_header = [(n, t) for n, t in raw if t.strip() and not t.startswith(("#", "["))]
pops = {"reader": reader, "raw_non_header": non_header,
        "raw_sung": [(n, t) for n, t in non_header if not t.startswith("---")]}
result = {"files": len(files), "populations": {}, "positions": {}}
for p, rows in pops.items():
    result["populations"][p], result["positions"][p] = count(rows)
with open(sys.argv[1], "w", encoding="utf-8") as fh:
    json.dump(result, fh, indent=1, ensure_ascii=False)
    fh.write("\n")
print(json.dumps(result["populations"], indent=1))

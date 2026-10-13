"""The unmarked-voices residual: token positions where (token N, word) is the
same with voices on and off but names a different physical word. A
declaration numbered under one setting and sent unmarked to a run with the
other passes the token/word check there and binds that other word (PR #527,
6148492945; documented as a residual by the agreed design, 6148531804).

    python3 quality/results/acceptance_2026-10-13/voices_exposure.py quality/results/acceptance_2026-10-13/voices_exposure.json [HARNESS_ROOT]

Physical identity is the character span in the harness's own tokenizer
(`_TOKEN_RUN` over the enclitic-joined text). A voices-off token is a
voices-on token outside every `(...)` span. A line where this rebuild does not
reproduce `line_tokens` exactly, either way, is counted as unmapped and never
guessed. The population is every row of `corpus/song/eng_*` that the source
reader treats as a sung line, so rows beginning '#', '[' or '---' are excluded.
"""
import glob, json, os, re, sys
ROOT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else
                       os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
sys.path.insert(0, ROOT)
from lyric_harness import line_tokens, join_spaced_enclitics, _TOKEN_RUN, LATIN_SCRIPT  # noqa: E402

files = sorted(glob.glob(os.path.join(ROOT, "corpus", "song", "eng_*")))
lines = differ = unmapped = 0
positions, hit = [], set()
for f in files:
    with open(f, encoding="utf-8") as fh:
        for raw in fh:
            t = raw.rstrip("\n")
            if not t.strip() or t.startswith(("#", "[", "---")):
                continue
            lines += 1
            if "(" not in t:
                continue
            on_w, off_w = line_tokens(t, strip_parens=False), line_tokens(t, strip_parens=True)
            if on_w == off_w:
                continue
            differ += 1
            cut = join_spaced_enclitics(t)
            parens = [m.span() for m in re.finditer(r"\([^)]*\)", cut)]
            on = [(m.group(), m.span()) for m in _TOKEN_RUN.finditer(cut) if LATIN_SCRIPT.search(m.group())]
            off = [(w, s) for w, s in on if not any(a <= s[0] and s[1] <= b for a, b in parens)]
            if [w for w, _ in on] != on_w or [w for w, _ in off] != off_w:
                unmapped += 1
                continue
            for i in range(min(len(on), len(off))):
                if on[i][0] == off[i][0] and on[i][1] != off[i][1]:
                    positions.append({"file": os.path.basename(f), "line": t, "token": i + 1, "word": on[i][0],
                                      "span_voices_on": list(on[i][1]), "span_voices_off": list(off[i][1])})
                    hit.add((f, t))
out = {"files": len(files), "lines": lines, "lines_cut_differently_by_voices": differ,
       "unmapped_lines": unmapped, "ambiguous_positions": len(positions), "ambiguous_lines": len(hit),
       "positions": positions}
with open(sys.argv[1], "w", encoding="utf-8") as fh:
    json.dump(out, fh, indent=1, ensure_ascii=False)
    fh.write("\n")
print(json.dumps({k: v for k, v in out.items() if k != "positions"}))

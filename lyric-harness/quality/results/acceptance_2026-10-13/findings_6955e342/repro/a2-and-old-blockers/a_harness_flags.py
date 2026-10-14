"""(a) independent harness-side flags, per corpus line, for a line-level parity
check against the candidate page's lyLineCutChanged. Run from <tree>/lyric-harness.
Writes <out>.tsv: file, line_no (0-based raw line index), identical_off, lookup_off,
identical_on, lookup_on ; and <out>.json: voices-on END changes on lines with '('.
Usage: python a_harness_flags.py <out-prefix>"""
import json, sys, os, unicodedata
from pathlib import Path
sys.path.insert(0, os.getcwd())
import lyric_harness as LH
OUT = sys.argv[1]
ROOT = Path(os.getcwd())

def identical(line, strip):
    old = LH._v1_token_spans(line, strip)
    if old is None:
        return None
    cur = [(t.text, tuple(tuple(p) for p in t.pieces)) for t in LH.reader_line(line, strip, scheme="v2").tokens]
    old = [(t, tuple(tuple(p) for p in ps)) for t, ps in old]
    return [t for t, _ in old] if old == cur else None

def lookup(words, strip):
    if not words:
        return False
    return LH._line_tokens_v1(" ".join(words[:-1]), strip) + [words[-1]] != words

lex_on = {}
for sch in ("v1", "v2"):
    with LH.reader_scheme_scope(sch):
        lex_on[sch] = LH.Lexicon(strip_parens=False, reader_scheme=sch)

def end_key(sch, line):
    with LH.reader_scheme_scope(sch):
        a, label, _ = LH.line_anchors(lex_on[sch], line)
    return ([[(s["nucleus"], list(s["coda"]), list(s["onset"]), s["stress"]) for s in x] for x in a], label)

rows, on_changes = [], []
paren_identical_on = 0
for path in sorted((ROOT / "corpus" / "song").glob("eng_*.txt")):
    for i, raw in enumerate(path.read_text(encoding="utf-8").split("\n")):
        line = raw.strip()
        if not line or line.startswith(("#", "---", "[")):
            continue
        w_off = identical(line, True)
        w_on = identical(line, False)
        lo = lookup(w_off, True) if w_off is not None else False
        lon = lookup(w_on, False) if w_on is not None else False
        rows.append(f"{path.name}\t{i}\t{int(w_off is not None)}\t{int(lo)}\t{int(w_on is not None)}\t{int(lon)}")
        if "(" in line and w_on is not None:
            paren_identical_on += 1
            k1, k2 = end_key("v1", line), end_key("v2", line)
            if k1 != k2:
                nfc = (not k1[0] and not k2[0] and unicodedata.normalize("NFC", k1[1]) == k2[1])
                on_changes.append({"file": path.name, "i": i, "line": line, "lookup_on": lon, "nfc_only": nfc, "v1": k1, "v2": k2})
Path(OUT + ".tsv").write_text("\n".join(rows) + "\n", encoding="utf-8")
summ = {"lines": len(rows),
        "identical_off": sum(r.split("\t")[2] == "1" for r in rows),
        "lookup_off": sum(r.split("\t")[3] == "1" for r in rows),
        "identical_on": sum(r.split("\t")[4] == "1" for r in rows),
        "lookup_on": sum(r.split("\t")[5] == "1" for r in rows),
        "paren_lines_identical_on": paren_identical_on,
        "voices_on_end_changes_on_paren_identical_lines": on_changes}
Path(OUT + ".json").write_text(json.dumps(summ, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in summ.items()}, indent=1))

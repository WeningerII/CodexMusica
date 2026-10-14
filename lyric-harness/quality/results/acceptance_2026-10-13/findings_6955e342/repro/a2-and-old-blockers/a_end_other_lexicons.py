"""(a) extension, NOT part of R2's receipt: END binding changes on identical-cut
lines (voices off) under lexicons other than the production default:
argv[2] = supplement ('none' | 'v2'), argv[3] = fallback ('none' | 'high').
The page's condition is lexicon-free, so any END change on an identical-cut
line it does not fire on would be a silent miss under that lexicon.
Run from <tree>/lyric-harness. Usage: python a_end_other_lexicons.py <out.json> <supplement> <fallback>"""
import json, os, sys, unicodedata
from pathlib import Path
sys.path.insert(0, os.getcwd())
import lyric_harness as LH
from quality.coverage_census import build_lexicon
OUT, SUP, FB = sys.argv[1], sys.argv[2], sys.argv[3]
ROOT = Path(os.getcwd())
lexes = {}
for sch in ("v1", "v2"):
    with LH.reader_scheme_scope(sch):
        lexes[sch] = build_lexicon(SUP, FB, reader_scheme=sch)
def identical(line):
    old = LH._v1_token_spans(line, True)
    if old is None: return None
    cur = [(t.text, tuple(tuple(p) for p in t.pieces)) for t in LH.reader_line(line, True, scheme="v2").tokens]
    old = [(t, tuple(tuple(p) for p in ps)) for t, ps in old]
    return [t for t, _ in old] if old == cur else None
def lookup(words):
    return bool(words) and LH._line_tokens_v1(" ".join(words[:-1]), True) + [words[-1]] != words
def end_key(sch, line):
    with LH.reader_scheme_scope(sch):
        a, label, _ = LH.line_anchors(lexes[sch], line)
    return ([[(s["nucleus"], list(s["coda"]), list(s["onset"]), s["stress"]) for s in x] for x in a], label)
seen, changed, identical_n = {}, [], 0
for path in sorted((ROOT / "corpus" / "song").glob("eng_*.txt")):
    for raw in path.read_text(encoding="utf-8").split("\n"):
        line = raw.strip()
        if not line or line.startswith(("#", "---", "[")): continue
        w = identical(line)
        if w is None: continue
        identical_n += 1
        if line in seen: continue
        k1, k2 = end_key("v1", line), end_key("v2", line)
        if k1 == k2: seen[line] = 0; continue
        nfc = not k1[0] and not k2[0] and unicodedata.normalize("NFC", k1[1]) == k2[1]
        seen[line] = 1
        changed.append({"file": path.name, "line": line, "lookup_differs": lookup(w), "nfc_only": nfc, "v1": k1, "v2": k2})
summ = {"supplement": SUP, "fallback": FB, "identical_cut": identical_n, "unique": len(seen),
        "end_changed": len(changed), "end_changed_not_nfc": sum(not c["nfc_only"] for c in changed),
        "end_changed_not_nfc_and_condition_silent": sum((not c["nfc_only"]) and not c["lookup_differs"] for c in changed),
        "changed": changed}
Path(OUT).write_text(json.dumps(summ, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps({k: v for k, v in summ.items() if k != "changed"}, indent=1))

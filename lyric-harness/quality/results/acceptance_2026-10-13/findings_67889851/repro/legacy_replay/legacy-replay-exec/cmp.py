#!/usr/bin/env python3
"""BB8 compare: cmp.py A.out B.out [A.state B.state]. Normalises only the
random /tmp/finish_bp_*.json blueprint path. Reports raw byte equality, then
a structural diff of every JSON line (lyric checkpoint/result) and of the
written state files, by key path."""
import json, re, sys
BP = re.compile(r"/tmp/finish_bp_[a-z0-9_]+\.json")
TAGS = ("  lyric result: ", "  lyric checkpoint: ")
def short(v, n=160):
    s = json.dumps(v, ensure_ascii=False); return s if len(s) <= n else s[:n] + "..."
def ddiff(a, b, path=""):
    out = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in list(a) + [k for k in b if k not in a]:
            if k not in b: out.append((path + "/" + k, "only-A", a[k], None))
            elif k not in a: out.append((path + "/" + k, "only-B", None, b[k]))
            else: out += ddiff(a[k], b[k], path + "/" + k)
    elif isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        for i, (x, y) in enumerate(zip(a, b)): out += ddiff(x, y, f"{path}[{i}]")
    elif a != b:
        out.append((path, "differ", a, b))
    return out
def lines(p):
    return [BP.sub("/tmp/finish_bp_X.json", l) for l in open(p, encoding="utf-8").read().splitlines()]
a, b = sys.argv[1], sys.argv[2]
ra, rb = open(a, "rb").read(), open(b, "rb").read()
print(f"stdout raw bytes equal: {ra == rb}")
la, lb = lines(a), lines(b)
print(f"stdout lines: A={len(la)} B={len(lb)}; equal after bp-path normalisation: {la == lb}")
import difflib
if la != lb:
    sm = difflib.SequenceMatcher(a=la, b=lb, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal": continue
        pa, pb = la[i1:i2], lb[j1:j2]
        if op == "replace" and len(pa) == len(pb):
            for x, y in zip(pa, pb):
                tag = next((t for t in TAGS if x.startswith(t) and y.startswith(t)), None)
                if tag:
                    d = ddiff(json.loads(x[len(tag):]), json.loads(y[len(tag):]))
                    print(f"  ~ {tag.strip()} (A line {i1+1}): {len(d)} differing path(s)")
                    for p, kind, va, vb in d: print(f"      {kind} {p}: A={short(va)} B={short(vb)}")
                else:
                    print(f"  ~ A{i1+1}: {x[:220]}\n    B{j1+1}: {y[:220]}")
                i1 += 1; j1 += 1
        else:
            for x in pa: print(f"  - A{i1+1}: {x[:220]}"); i1 += 1
            for y in pb: print(f"  + B{j1+1}: {y[:220]}"); j1 += 1
if len(sys.argv) > 4:
    sa, sb = sys.argv[3], sys.argv[4]
    print(f"written state raw bytes equal: {open(sa,'rb').read() == open(sb,'rb').read()}")
    d = ddiff(json.load(open(sa)), json.load(open(sb)))
    print(f"written state: {len(d)} differing path(s)")
    for p, kind, va, vb in d: print(f"      {kind} {p}: A={short(va)} B={short(vb)}")

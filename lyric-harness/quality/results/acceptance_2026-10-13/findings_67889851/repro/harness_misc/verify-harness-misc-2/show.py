import json, sys
D = sys.argv[1]
runs = {m: json.load(open(f"{D}/out_{m}.json", encoding="utf-8")) for m in ("v2", "v1", "base")}
def fmt(v):
    if isinstance(v, list) and len(v) == 2 and isinstance(v[1], bool):
        return ("OOV" if v[1] else " ".join(v[0])) if v[0] or v[1] else "[] (not oov)"
    if isinstance(v, list) and v and v[0] == "Reading":
        return "Reading " + " ".join(v[1]) + f" src={v[2]}"
    if isinstance(v, list) and len(v) == 3 and isinstance(v[1], list) and v and isinstance(v[0], list) and all(isinstance(x, str) for x in v[0]):
        return f"{' '.join(v[0])} | words={v[1]} | oov={v[2]}"
    if isinstance(v, list):
        return "[]" if not v else " / ".join(" ".join(p) if isinstance(p, list) else str(p) for p in v)
    if isinstance(v, tuple):
        return str(v)
    return str(v)
for w in [k for k in runs["v2"] if k not in ("tree", "mode", "has_normalise_word")]:
    print("###", w)
    for field in runs["v2"][w]:
        print("  ", field)
        for m in ("v2", "v1", "base"):
            print(f"      {m:4}: {fmt(runs[m].get(w, {}).get(field, 'n/a'))}")

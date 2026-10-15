"""null-and-variants (a): summarise run_full/results.json -> table + cand-vs-prev comparisons."""
import json, os, re, sys, hashlib
R = sys.argv[1]
recs = json.load(open(R + "/results.json"))
by = {r["name"]: r for r in recs}
def norm(name, text):
    return text.replace(f"{R}/wk/{name}", "<WK>")
def outtext(name):
    t = open(f"{R}/out/{name}.out").read()
    t = norm(name, t)
    t = re.sub(r"/tmp/finish_bp_[a-z0-9_]+\.json", "/tmp/finish_bp_X.json", t)
    t = re.sub(r"/tmp/tmp[a-z0-9_]+", "/tmp/tmpX", t)
    return t
rows = []
for r in recs:
    if r["tree"] != "cand": continue
    p = by.get(r["name"].replace("_cand_", "_prev_", 1))
    same_out = p is not None and outtext(r["name"]) == outtext(p["name"])
    same_state_after = p is not None and r["state_sha_after"] == p["state_sha_after"]
    rows.append((r["name"].replace("_cand", ""), r["rc"], r["status"], r["reader_scheme"], r["state_unchanged"],
                 ",".join(x for x in r["changed_files"] if x != r.get("state")) or "-",
                 (r["refusal"] or "")[:150],
                 p and p["rc"], p and p["status"], p and p["reader_scheme"], p and p["state_unchanged"], (p and p["refusal"] or "")[:150],
                 same_out, same_state_after))
hdr = "case | cand rc | cand status | cand scheme | cand state unchanged | other files changed | cand refusal | prev rc | prev status | prev scheme | prev state unchanged | prev refusal | stdout identical | state-after identical"
print(hdr)
for row in rows:
    print(" | ".join(str(x) for x in row))

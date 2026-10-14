import json, glob, os, sys, difflib
cold = {}
for p in glob.glob("cold/*.json"):
    r = json.load(open(p))[0]; cold[r["req"]] = r
print("cold requests:", len(cold))
def norm(r):
    if "api" in r: return json.dumps(r["api"], sort_keys=True, ensure_ascii=False)
    return json.dumps([r["code"], r["stdout"], r["stderr"]], ensure_ascii=False)
bad = 0
for f in ["warm_v2_then_v1.json", "warm_v1_then_v2.json"]:
    for i, r in enumerate(json.load(open(f))):
        c = cold[r["req"]]
        same = norm(r) == norm(c)
        print(f"{f:24} #{i:2} {r['req']:16} code={r.get('code')} cold_code={c.get('code')} "
              f"stdout_len={len(r.get('stdout',''))} {'SAME' if same else 'DIFF'}")
        if not same:
            bad += 1
            a, b = norm(c).split("\\n"), norm(r).split("\\n")
            for l in list(difflib.unified_diff(a, b, "cold", "warm", lineterm="", n=0))[:20]:
                print("    ", l[:300])
print("DIFFS:", bad)
# scheme sanity: v1 vs v2 cold outputs differ (the probe distinguishes schemes)
for n in ["meter","meterlow","api","gradesup","gradeplain","gradevoices","gradepron"]:
    print(f"cold {n}: v1==v2? {norm(cold[n+'@v1'])==norm(cold[n+'@v2'])}")
for p in glob.glob("cold2/*.json"):
    r = json.load(open(p))[0]
    print(f"cold2 {r['req']}: equals cold? {norm(r)==norm(cold[r['req']])}")

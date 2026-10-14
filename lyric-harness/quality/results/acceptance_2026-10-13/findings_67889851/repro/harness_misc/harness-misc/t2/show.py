import json, sys
O = {m: json.load(open(f)) for m, f in (("v2","out_cand_v2.json"),("v1","out_cand_v1.json"),("base","out_base.json"))}
sec = sys.argv[1]
for k in O["v2"][sec]:
    print("###", k)
    vals = {m: O[m][sec].get(k) for m in O}
    if isinstance(vals["v2"], dict):
        for f in vals["v2"]:
            row = {m: (vals[m].get(f) if isinstance(vals[m], dict) else vals[m]) for m in O}
            same = row["v1"] == row["base"]
            print(f"   {f}:")
            for m in O: print(f"      {m:4}: {json.dumps(row[m], ensure_ascii=False)[:260]}")
    else:
        for m in O: print(f"   {m:4}: {json.dumps(vals[m], ensure_ascii=False)[:300]}")

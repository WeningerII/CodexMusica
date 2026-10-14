import json, sys
K = sys.argv[1]
names = ["base", "695_v1", "0af_v1", "678_v2", "695_v2", "0af_v2"]
D = {n: json.load(open(f"{K}/a/{n}.json")) for n in names}
for n in names:
    print(n, D[n]["judge"])
def v(x):
    return {True: "T", False: "F", None: "-"}.get(x, str(x))
print()
print(f"{'case':38s} " + " ".join(f"{n:>9s}" for n in names) + "   (broken/perfect)")
for i, r in enumerate(D["base"]["rows"]):
    cells = []
    for n in names:
        rr = D[n]["rows"][i]
        cells.append(f"{v(rr.get('broken rhyme'))}/{v(rr.get('perfect rhyme'))}" + ("E" if "error" in rr else ""))
    print(f"{r['label'][:38]:38s} " + " ".join(f"{c:>9s}" for c in cells))
print()
print("unread_L1 per mode")
for i, r in enumerate(D["base"]["rows"]):
    print(f"{r['label'][:38]:38s} " + " | ".join(f"{n}:{D[n]['rows'][i].get('unread_L1')}" for n in names))

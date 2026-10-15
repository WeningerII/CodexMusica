"""null-and-variants: extend BB8's 67889851 fixtures (verify-legacy-replay-exec-0/fx)
with the '' / 'V2' (and checkpoint absent/v1/v9) variants, derived by ONE field edit
from the existing v2 file of each kind. Also two edge states whose answered block holds null."""
import json, copy, sys, os
FX = sys.argv[1]
ABSENT = object()
def load(n): return json.load(open(os.path.join(FX, n)))
def put(n, d):
    p = os.path.join(FX, n)
    if os.path.exists(p): raise SystemExit("exists " + p)
    json.dump(d, open(p, "w"), indent=1)
variants = {"empty": "", "upper": "V2"}
for kind in ("ans", "unans", "replay", "ck"):
    src = load(f"{kind}_v2.json")
    vs = dict(variants)
    if kind == "ck":
        vs.update({"absent": ABSENT, "v1": "v1", "v9": "v9"})
    for name, val in vs.items():
        t = copy.deepcopy(src)
        if val is ABSENT:
            t.pop("reader_scheme")
            t.get("answered", {}).pop("reader_scheme", None)
        else:
            t["reader_scheme"] = val
        put(f"{kind}_{name}.json", t)
# edge: deferred state whose TOP field is valid but whose answered block holds null
for top in ("v2", ABSENT):
    t = copy.deepcopy(load("ans_v2.json" if top == "v2" else "ans_absent.json"))
    t["answered"]["reader_scheme"] = None
    put(f"ans_{'v2' if top == 'v2' else 'absent'}_answerednull.json", t)
print(sorted(os.listdir(FX)))

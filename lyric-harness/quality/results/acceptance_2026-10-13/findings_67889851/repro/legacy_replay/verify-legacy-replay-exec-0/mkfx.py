import json, sys, copy
D = sys.argv[1]
s = json.load(open(f"{D}/st/base.json"))
assert "reader_scheme" not in s and "reader_scheme" not in s["answered"]
s["pending"]["answer"] = "L6: the water ran so cold\nL9: the stone is in the yard"
variants = {"absent": None, "null": "NULL", "v1": "v1", "v2": "v2", "v9": "v9"}
for name, val in variants.items():
    t = copy.deepcopy(s)
    if val == "NULL":
        t["reader_scheme"] = None
    elif val is not None:
        t["reader_scheme"] = val
    json.dump(t, open(f"{D}/fx/ans_{name}.json", "w"), indent=1)
    # unanswered variants for tryline (pending answer empty)
    u = copy.deepcopy(t); u["pending"]["answer"] = None
    json.dump(u, open(f"{D}/fx/unans_{name}.json", "w"), indent=1)
print("ok")

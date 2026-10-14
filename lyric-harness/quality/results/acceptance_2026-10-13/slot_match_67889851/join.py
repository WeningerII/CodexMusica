import json, collections, sys
SLOTS = ["end","endword","head","headrime"] + [f"T{n}" for n in range(1,9)]
FAIL = {"wrong_word","grader_elsewhere","no_op_edit","resolver_mismatch"}
def load(p):
    d = {}
    for l in open(p, encoding="utf-8"):
        r = json.loads(l); mode, aside = r["mode"].split(":")
        if r["slot"] is None:
            for s in SLOTS: d[(mode, r["line"], s, aside)] = {"kind": r["kind"]}
        else:
            d[(mode, r["line"], r["slot"], aside)] = r
    return d
B = load(sys.argv[1]); C = load(sys.argv[2])
keys = sorted({k[1:] for k in B})
def get(D, mode, k): return D.get((mode,) + k, {"kind": "absent"})
sig = lambda r: (r["kind"], r.get("named"), r.get("bound"), r.get("edited"))
out = {"cases": len(keys)}
# 1. v1 preservation: base vs candidate v1
same = diff = 0; dk = collections.Counter(); dex = []
for k in keys:
    b, c = get(B, "base", k), get(C, "v1", k)
    if sig(b) == sig(c): same += 1
    else:
        diff += 1; dk[(b["kind"], c["kind"])] += 1
        if len(dex) < 12: dex.append({"line": k[0], "slot": k[1], "aside": k[2], "base": sig(b), "cand_v1": sig(c)})
out["v1_vs_base"] = {"identical": same, "different": diff, "transitions": {f"{a} -> {b}": n for (a, b), n in dk.most_common()}, "examples": dex}
# 2/3. failures under candidate v2 and v1, by base outcome
for mode in ("cur", "v1"):
    t = collections.Counter(); ex = collections.defaultdict(list)
    for k in keys:
        c = get(C, mode, k)
        if c["kind"] not in FAIL: continue
        b = get(B, "base", k)
        cls = ("unchanged_same_failure" if sig(b) == sig(c) else
               "same_kind_other_words" if b["kind"] == c["kind"] else
               "base_refused_now_fails" if b["kind"] in ("refused","refused_unbound","refused_grader_elsewhere","no_word_refused") else
               "base_agreed_now_fails" if b["kind"] in ("agree","agree_unbound") else
               "base_excluded_now_measured" if b["kind"].startswith("excluded") or b["kind"] == "absent" else
               "base_other_failure")
        t[(cls, c["kind"])] += 1
        if len(ex[cls]) < 4: ex[cls].append({"line": k[0], "slot": k[1], "aside": k[2], "base": sig(b), "cand": sig(c)})
    out[f"failures_{'v2' if mode=='cur' else 'v1'}_by_base"] = {f"{a} | {b}": n for (a, b), n in sorted(t.items())}
    out[f"examples_{'v2' if mode=='cur' else 'v1'}"] = ex
# 4. base failures and where they went under v2
t = collections.Counter()
for k in keys:
    b = get(B, "base", k)
    if b["kind"] in FAIL: t[(b["kind"], get(C, "cur", k)["kind"], get(C, "v1", k)["kind"])] += 1
out["base_failures_to_v2_v1"] = {f"{a} -> v2 {b} / v1 {c}": n for (a, b, c), n in t.most_common()}
# 5. refusal transitions base -> v2 (all kinds)
m = collections.Counter((get(B, "base", k)["kind"], get(C, "cur", k)["kind"]) for k in keys)
out["base_to_v2_matrix"] = {f"{a} -> {b}": n for (a, b), n in m.most_common()}
json.dump(out, open(sys.argv[3], "w"), indent=1, ensure_ascii=False)
print(json.dumps({k: v for k, v in out.items() if not k.startswith("examples")}, indent=1, ensure_ascii=False)[:6000])

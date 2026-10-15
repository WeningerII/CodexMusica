"""null-and-variants (a): rebuild per-case records for run_full (stopped before results.json) from
out/<case>.out and wk/<case>/ against the fixture sources each case copied in; merge run_rest/results.json;
write matrix.json + matrix.tsv (cand vs prev)."""
import hashlib, json, os, re
A = "/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/h0af/null-and-variants/a"
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
cases = json.load(open(A + "/cases_full.json")) + json.load(open(A + "/cases_x.json"))
rest = {r["name"]: r for r in json.load(open(A + "/run_rest/results.json"))} if os.path.exists(A + "/run_rest/results.json") else {}
xres = {r["name"]: r for r in json.load(open(A + "/run_x/results.json"))}
def result_line(text):
    for l in reversed(text.splitlines()):
        if l.startswith("  lyric result: "):
            try: return json.loads(l[len("  lyric result: "):])
            except ValueError: return {}
    return {}
def norm(text, wk):
    t = text.replace(wk, "<WK>")
    t = re.sub(r"/tmp/finish_bp_[A-Za-z0-9_]+\.json", "/tmp/finish_bp_X.json", t)
    return re.sub(r"/tmp/tmp[A-Za-z0-9_]+", "/tmp/tmpX", t)
recs = {}
for c in cases:
    n = c["name"]
    run = "run_rest" if n in rest else ("run_x" if n in xres else "run_full")
    out = f"{A}/{run}/out/{n}.out"
    if not os.path.exists(out):
        continue
    wk = f"{A}/{run}/wk/{n}"
    text = open(out).read()
    res = result_line(text)
    before = {dst: sha(src) for dst, src in c["files"].items()}
    after = {os.path.relpath(os.path.join(r, f), wk): sha(os.path.join(r, f)) for r, _, fs in os.walk(wk) for f in fs}
    changed = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
    st = c.get("state")
    recs[n] = {"name": n, "tree": c["tree"], "run": run,
               "exit": res.get("exit"), "status": res.get("status"), "reader_scheme": res.get("reader_scheme"),
               "accepted": res.get("accepted"),
               "refusal": (res.get("refusal") or "").replace(wk, "<WK>"),
               "state_unchanged": st is None or before.get(st) == after.get(st),
               "state_sha_after": after.get(st) if st else None,
               "other_changed": [x for x in changed if x != st],
               "stdout_norm_sha": hashlib.sha256(norm(text, wk).encode()).hexdigest()}
json.dump(recs, open(A + "/matrix.json", "w"), indent=1)
rows = ["case\tcand exit\tcand status\tcand scheme\tcand state unchanged\tcand other files changed\tcand refusal\tprev exit\tprev status\tprev scheme\tprev state unchanged\tprev refusal\tstdout identical (normalised)\tstate bytes after identical"]
for n, r in recs.items():
    if r["tree"] != "cand": continue
    p = recs.get(n.replace("_cand_", "_prev_", 1), {})
    rows.append("\t".join(str(x) for x in (n.replace("_cand", ""), r["exit"], r["status"], r["reader_scheme"], r["state_unchanged"],
        ",".join(r["other_changed"]) or "-", r["refusal"][:200], p.get("exit"), p.get("status"), p.get("reader_scheme"),
        p.get("state_unchanged"), (p.get("refusal") or "")[:200], r["stdout_norm_sha"] == p.get("stdout_norm_sha"),
        r["state_sha_after"] == p.get("state_sha_after"))))
open(A + "/matrix.tsv", "w").write("\n".join(rows) + "\n")
print(len(recs), "records;", len(rows) - 1, "cand rows")

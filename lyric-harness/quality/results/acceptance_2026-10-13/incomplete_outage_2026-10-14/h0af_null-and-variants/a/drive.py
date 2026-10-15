"""null-and-variants (a): run each recorded-scheme case on a tree, in its own fresh
work dir, and record rc / refusal / scheme / every file's sha256 before and after.
usage: python3 drive.py OUTDIR CASES.json  (CASES: list of case dicts; see mkcases.py)"""
import hashlib, json, os, shlex, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
S = "/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad"
H = S + "/h0af/null-and-variants/a"
PY = S + "/venv311/bin/python"
TREES = {"cand": S + "/wt-0af", "prev": S + "/wt-695", "t678": S + "/wt-678", "base": S + "/wt-base"}
OUT, CASES = sys.argv[1], json.load(open(sys.argv[2]))
os.makedirs(OUT + "/out", exist_ok=True)

def snap(d):
    r = {}
    for root, _, fs in os.walk(d):
        for f in fs:
            p = os.path.join(root, f)
            r[os.path.relpath(p, d)] = hashlib.sha256(open(p, "rb").read()).hexdigest()
    return r

def one(c):
    name, tree = c["name"], c["tree"]
    wk = os.path.join(OUT, "wk", name)
    shutil.rmtree(wk, ignore_errors=True); os.makedirs(wk)
    for dst, src in c["files"].items():
        shutil.copyfile(src, os.path.join(wk, dst))
    args = [a.replace("{WK}", wk) for a in c["args"]]
    env_extra = {k: v.replace("{WK}", wk) for k, v in c.get("env", {}).items()}
    env = {k: v for k, v in os.environ.items()
           if k not in ("LYRIC_CONTROL_TOKEN", "LYRIC_REQUEST_DEADLINE_MS", "LYRIC_CHECKPOINT_PATH")}
    env["LYRIC_STAGED_DATA"] = "/home/user/CodexMusica/lyric-harness/data"
    env.update(env_extra)
    cwd = TREES[tree] + "/lyric-harness"
    before = snap(wk)
    t0 = time.time()
    p = subprocess.run([PY, "lyric_harness.py"] + args, cwd=cwd, env=env,
                       capture_output=True, text=True, timeout=1800)
    dt = time.time() - t0
    after = snap(wk)
    open(f"{OUT}/out/{name}.out", "w").write(p.stdout)
    open(f"{OUT}/out/{name}.err", "w").write(p.stderr)
    res = None
    for l in p.stdout.splitlines():
        if l.startswith("  lyric result: "):
            try: res = json.loads(l[len("  lyric result: "):])
            except ValueError: pass
    changed = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
    rec = {"name": name, "tree": tree, "rc": p.returncode, "secs": round(dt, 1),
           "status": res and res.get("status"), "reader_scheme": res and res.get("reader_scheme"),
           "refusal": res and res.get("refusal") and res["refusal"].replace(wk, "<WK>"),
           "accepted": res and res.get("accepted"),
           "changed_files": changed,
           "state_unchanged": (c.get("state") is None) or (before.get(c["state"]) == after.get(c["state"])),
           "state_sha_before": before.get(c.get("state")), "state_sha_after": after.get(c.get("state"))}
    cmd = ("cd " + shlex.quote(cwd) + " && env -u LYRIC_CONTROL_TOKEN -u LYRIC_REQUEST_DEADLINE_MS -u LYRIC_CHECKPOINT_PATH "
           "LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data "
           + " ".join(f"{k}={shlex.quote(v)}" for k, v in env_extra.items()) + " "
           + shlex.quote(PY) + " lyric_harness.py " + " ".join(shlex.quote(a) for a in args))
    rec["cmd"] = cmd
    rec["fixture"] = c["files"]
    return rec

with ThreadPoolExecutor(int(os.environ.get("J", "4"))) as ex:
    recs = list(ex.map(one, CASES))
json.dump(recs, open(OUT + "/results.json", "w"), indent=1, ensure_ascii=False)
with open(OUT + "/COMMANDS.txt", "a") as fh:
    for r in recs:
        fh.write(f"### {r['name']} (tree={r['tree']} rc={r['rc']} {r['secs']}s)\n"
                 f"# fixtures copied into {OUT}/wk/{r['name']}/ first: {json.dumps(r['fixture'])}\n{r['cmd']}\n"
                 f"  -> {OUT}/out/{r['name']}.out .err\n\n")
for r in recs:
    print(r["name"], r["tree"], "rc", r["rc"], r["status"], r["reader_scheme"], "state_unchanged", r["state_unchanged"],
          "changed", r["changed_files"], (r["refusal"] or "")[:160])

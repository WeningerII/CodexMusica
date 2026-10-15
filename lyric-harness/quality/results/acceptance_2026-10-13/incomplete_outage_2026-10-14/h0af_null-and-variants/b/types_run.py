"""null-and-variants (b): the `types` verb on soft-hyphen / U+2010 spellings vs plain, per tree and scheme.
Writes types/<tree>_<scheme>_<case>_{var,plain}.out and types/summary.json."""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
S = "/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad"
B = S + "/h0af/null-and-variants/b"
PY = S + "/venv311/bin/python"
TREES = {"cand": S + "/wt-0af", "prev": S + "/wt-695"}
SH = "­"
CASES = [("live", "li" + SH + "ve", "live -- five", []),
         ("read", "re" + SH + "ad", "read -- bed", []),
         ("hello", "hel" + SH + "lo", "hello -- below", []),
         ("twentytwo2010", "twenty‐two", "twenty-two -- blue", []),
         ("twentytwoSHY", "twen" + SH + "ty-two", "twenty-two -- blue", []),
         ("streetlight_sup", "street" + SH + "light", "streetlight -- night", ["--lexicon-supplement=v2"]),
         ("eightytwo_sup", "eighty‐two", "eighty-two -- blue", ["--lexicon-supplement=v2"])]
plain_of = {"live": "live", "read": "read", "hello": "hello", "twentytwo2010": "twenty-two", "twentytwoSHY": "twenty-two",
            "streetlight_sup": "streetlight", "eightytwo_sup": "eighty-two"}
env = {k: v for k, v in os.environ.items() if k not in ("LYRIC_CONTROL_TOKEN", "LYRIC_REQUEST_DEADLINE_MS", "LYRIC_CHECKPOINT_PATH")}
env["LYRIC_STAGED_DATA"] = "/home/user/CodexMusica/lyric-harness/data"
jobs = []
for tree in TREES:
    for scheme in ("v1", "v2"):
        for name, var, plain_pair, extra in CASES:
            pw = plain_of[name]
            for kind, pair in (("var", plain_pair.replace(pw, var, 1)), ("plain", plain_pair)):
                jobs.append((tree, scheme, name, kind, [f"--reader-scheme={scheme}"] + extra + ["types", pair, "--position=end"], pw, var))
def run(j):
    tree, scheme, name, kind, args, pw, var = j
    p = subprocess.run([PY, "lyric_harness.py"] + args, cwd=TREES[tree] + "/lyric-harness", env=env, capture_output=True, text=True)
    fn = f"{B}/types/{tree}_{scheme}_{name}_{kind}.out"
    open(fn, "w").write(p.stdout + ("\n--- stderr\n" + p.stderr if p.stderr else ""))
    return (tree, scheme, name, kind, p.returncode, p.stdout, args)
res = list(ThreadPoolExecutor(4).map(run, jobs))
by = {(r[0], r[1], r[2], r[3]): r for r in res}
summary = []
with open(B + "/types/COMMANDS.txt", "w") as fh:
    for r in res:
        fh.write(f"cd {TREES[r[0]]}/lyric-harness && LYRIC_STAGED_DATA=/home/user/CodexMusica/lyric-harness/data {PY} lyric_harness.py " + " ".join(json.dumps(a, ensure_ascii=True) for a in r[6]) + f"   # rc={r[4]} -> types/{r[0]}_{r[1]}_{r[2]}_{r[3]}.out\n")
for tree in TREES:
    for scheme in ("v1", "v2"):
        for name, var, _, _ in CASES:
            v, pl = by[(tree, scheme, name, "var")], by[(tree, scheme, name, "plain")]
            vt = v[5].replace(var, plain_of[name])
            diff = [(a, b) for a, b in zip(vt.splitlines(), pl[5].splitlines()) if a != b]
            summary.append({"tree": tree, "scheme": scheme, "case": name, "rc_var": v[4], "rc_plain": pl[4],
                            "identical_after_respelling": vt == pl[5], "n_diff_lines": len(diff),
                            "first_diffs": diff[:4]})
json.dump(summary, open(B + "/types/summary.json", "w"), indent=1, ensure_ascii=True)
for s in summary:
    print(s["tree"], s["scheme"], f"{s['case']:16s}", "rc", s["rc_var"], s["rc_plain"], "AGREES" if s["identical_after_respelling"] else f"DIFFERS ({s['n_diff_lines']} lines)")

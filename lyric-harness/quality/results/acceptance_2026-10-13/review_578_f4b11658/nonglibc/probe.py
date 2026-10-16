import json, os, subprocess, sys, time
tree, site, label = sys.argv[1], sys.argv[2], sys.argv[3]
env = dict(os.environ); env["PYTHONPATH"] = site if site != "-" else ""
# a. what the worker module resolves _malloc_trim to under this environment (worker.py imported, main() not run)
code = ("import sys,runpy; sys.argv=['worker.py']; g=runpy.run_path(%r, run_name='w'); "
        "print('malloc_trim', g['_malloc_trim']); "
        "import gc; n=[0]; gc.callbacks.append(lambda ph,info: n.__setitem__(0,n[0]+(ph=='start'))); "
        "g['release_heap'](); print('gc_collect_runs', n[0])") % os.path.join(tree, "mcp", "worker.py")
r = subprocess.run([sys.executable, "-c", code], cwd=os.path.join(tree, "lyric-harness"), env=env, capture_output=True, text=True)
print(label, "import:", r.returncode, r.stdout.strip().replace("\n", " | "), r.stderr.strip()[-300:])
# b. a real worker process under this environment serves two requests
w = subprocess.Popen([sys.executable, os.path.join(tree, "mcp", "worker.py")], cwd=os.path.join(tree, "lyric-harness"),
                     env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
out, err = w.communicate("".join(json.dumps({"id": i, "argv": ["plan", "--seed=20260908", "--lines=18"], "env": {}}) + "\n" for i in (1, 2)), timeout=300)
replies = [json.loads(l) for l in out.splitlines() if l.strip()]
res = [m for m in replies if "code" in m]
print(label, "worker:", "exit", w.returncode, "results", [(m["id"], m["code"], len(m["stdout"])) for m in res],
      "same_stdout", len(res) == 2 and res[0]["stdout"] == res[1]["stdout"], "stderr_tail", err.strip()[-200:])

import sys, subprocess, json, os
PY = "/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/venv311/bin/python"
def run(tree, argv):
    env = dict(os.environ, LYRIC_STAGED_DATA="/home/user/CodexMusica/lyric-harness/data")
    p = subprocess.run([PY, os.path.join(tree, "lyric-harness", "lyric_harness.py")] + argv,
                       capture_output=True, text=True, env=env, cwd=os.path.join(tree, "lyric-harness"))
    rec = None
    for line in p.stdout.splitlines():
        if line.startswith("  lyric result: "):
            rec = json.loads(line[len("  lyric result: "):])
    return p.returncode, rec, p.stdout, p.stderr
if __name__ == "__main__":
    tree = sys.argv[1]; argv = json.loads(sys.argv[2])
    rc, rec, out, err = run(tree, argv)
    print("rc", rc)
    print(json.dumps(rec, ensure_ascii=False)[:1500] if rec else out[-1500:] + err[-800:])

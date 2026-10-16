"""Independent recapture of quality/fixtures/reader_v1_checkpoint.json.
usage: python3 recapture.py <tree/lyric-harness> <fixture.json> <out.json>
Runs the fixture's own recorded `how` twice (fresh checkpoint, then resume of a
copy) and compares every field to the fixture, with the random journal_id
normalised."""
import json, os, re, shutil, subprocess, sys, tempfile
H, FX, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
fx = json.load(open(FX, encoding="utf-8"))
w = tempfile.mkdtemp()
open(os.path.join(w, "stubwriter.py"), "w").write(
    "def factory():\n    def call(prompt):\n        return %r\n    return call\n" % fx["stub_answer"])
import re as _re
_jid = sorted(set(_re.findall(r'journal_id"\s*:\s*"([0-9a-f]{32})', fx["checkpoint"])))[0]
open(os.path.join(w, "sitecustomize.py"), "w").write(
    "import uuid\n_U = uuid.UUID(%r)\nuuid.uuid4 = lambda: _U\n" % _jid)
draft = os.path.join(w, "draft.txt"); open(draft, "w").write("\n".join(fx["draft"]) + "\n")
env = {k: v for k, v in os.environ.items() if k != "LYRIC_CONTROL_TOKEN"}; env["PYTHONPATH"] = w
def run(ck):
    return subprocess.run([sys.executable, "lyric_harness.py", "revise", draft, "AA", "--propose=call:stubwriter:factory"],
                          capture_output=True, text=True, env=dict(env, LYRIC_CHECKPOINT_PATH=ck), cwd=H, timeout=900)
ck = os.path.join(w, "ck.json"); r1 = run(ck)
checkpoint = open(ck).read()
ck2 = os.path.join(w, "ck2.json"); shutil.copy(ck, ck2); r2 = run(ck2)
got = {"checkpoint": checkpoint, "resume_stdout": r2.stdout, "resume_exit": r2.returncode, "resumed_checkpoint": open(ck2).read()}
J = re.compile(r'[0-9a-f]{32}')
def norm(s):  # journal ids are uuid4 hex; normalise only those that are journal ids
    return re.sub(r'"journal_id\\?":\\?"[0-9a-f]{32}', '"journal_id":"<J>', s) if isinstance(s, str) else s
res = {}
for k in got:
    a, b = got[k], fx[k]
    res[k] = {"raw_equal": a == b, "equal_modulo_journal_id": norm(a) == norm(b)}
jid = re.findall(r'journal_id\\?":\\?"([0-9a-f]{32})', checkpoint)
res["_journal_ids_seen"] = sorted(set(jid))
res["_first_exit"] = r1.returncode
json.dump({"got": got, "compare": res}, open(OUT, "w"), indent=1, ensure_ascii=False)
print(json.dumps(res, indent=1))
shutil.rmtree(w, True)

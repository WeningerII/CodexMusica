import sys, json
sys.path.insert(0, sys.argv[1] + "/probes")
from cli import run
H = sys.argv[1]
for extra in ([], ["--lexicon-supplement=v2"]):
  for groups in (["--groups=1.T2,2.T2", "--numbering=v2"], ["--groups=1.T2,2.T2"]):
    for t in ("tree_pre", "tree"):
        argv = extra + ["--reader-scheme=v2", "brief", H + "/drafts/pin.txt"] + groups
        rc, rec, out, err = run(H + "/" + t, argv)
        if rec is None:
            print(t, extra, groups, "rc", rc, "NO RECORD", (out+err)[-400:]); continue
        cov = rec.get("coverage") or {}
        obs = [(o["id"], o["status"]) for o in cov.get("obligations", []) if o["layer"] in ("rhyme",)]
        fl = sorted({f.get("code") for f in rec.get("findings", [])})
        print(t, extra, groups[1:] or "", "rc", rc, rec.get("status"), rec.get("refusal"), "certified", cov.get("certified"),
              "pairs", cov.get("pairs_judged"), "/", cov.get("pairs_mandated"), "refused", cov.get("pairs_refused"), obs, fl)

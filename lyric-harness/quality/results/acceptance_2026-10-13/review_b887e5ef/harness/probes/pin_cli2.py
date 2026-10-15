import sys, json
sys.path.insert(0, sys.argv[1] + "/probes")
from cli import run
H = sys.argv[1]
for extra in ([], ["--lexicon-supplement=v2"]):
  for rel in (["--relation=perfect rhyme"], ["--relations=A:perfect rhyme"]):
    for t, num in (("tree_pre", []), ("tree", ["--numbering=v2"])):
        argv = extra + ["--reader-scheme=v2", "brief", H + "/drafts/pin.txt", "--groups=1.T2,2.T2"] + rel + num
        rc, rec, out, err = run(H + "/" + t, argv)
        if rec is None:
            print(t, extra, rel, "rc", rc, "NO RECORD", (out+err)[-300:]); continue
        cov = rec.get("coverage") or {}
        obs = [(o["id"], o["status"]) for o in cov.get("obligations", []) if o["layer"] not in ("function","shape","meter","slot_grid","setting","sentencehood","floor")]
        fl = sorted({f.get("code") for f in rec.get("findings", [])})
        print(t, extra, rel, "rc", rc, rec.get("status"), (rec.get("refusal") or "")[:200], "cert", cov.get("certified"),
              "judged", cov.get("pairs_judged"), "/", cov.get("pairs_mandated"), "ref", cov.get("pairs_refused"), obs, fl,
              "refused_obl", cov.get("refused_obligations"))

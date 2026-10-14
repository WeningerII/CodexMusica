"""Real requests through ONE warm worker (`mcp/worker.py` `run_one`, loaded the
way WarmWorkerBody loads it), varying only the harness's GLOBAL request
coordinates (--reader-scheme, --fallback, --voices, --lexicon-supplement).
After each request: entries retained per module-level lexicon cache, process
RSS, and whether the Library guard (`library.analysis._resource_guard`, the
unchanged 1 GiB default) would admit a Library analysis in this process now.

Run from <tree>/lyric-harness:  python probe_requests.py <out.json>
Each request is a NEW run of the WarmWorker fixture draft and verb
(quality/fixtures/reader_v1_defer_states.json), in its own scratch dir.
"""
import importlib.util
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, os.getcwd())
out = sys.argv[1]
HERE = Path(os.getcwd())
fx = json.loads((HERE / "quality" / "fixtures" / "reader_v1_defer_states.json")
                .read_text(encoding="utf-8"))
cwd = os.getcwd()
spec = importlib.util.spec_from_file_location("lyric_worker_probe", HERE.parent / "mcp" / "worker.py")
W = importlib.util.module_from_spec(spec)
spec.loader.exec_module(W)
os.chdir(cwd)
import library.analysis as LA  # noqa: E402

assert int(os.environ.get("LIBRARY_READER_MAX_RSS_MIB", "1024")) == 1024


def rss():
    d = {}
    with open("/proc/self/status") as fh:
        for row in fh:
            if row.startswith(("VmRSS:", "VmHWM:")):
                k, v = row.split(":")
                d[k] = int(v.split()[0]) // 1024
    return d


def caches():
    m = sys.modules
    res = {}
    eng = m.get("quality.phonology.eng")
    res["eng._LEX"] = None if eng is None else [repr(k) for k in eng._LEX]
    res["eng._CUT_LEX"] = None if eng is None else [repr(k) for k in eng._CUT_LEX]
    ft = m.get("quality.fit")
    res["fit._LEX"] = None if ft is None else [repr(k) for k in ft._LEX]
    ls = m.get("quality.lexicon_supplement")
    res["LS._SUPPLEMENTED"] = None if ls is None else [
        repr((k[0], k[1], os.path.basename(str(k[2])), k[4])) for k in ls._SUPPLEMENTED]
    mb = m.get("quality.meter_bands")
    res["MB._READERS"] = None if mb is None else [repr(k) for k in mb._READERS]
    return res


def guard():
    try:
        LA._resource_guard("probe: next Library analysis")
        return "admits"
    except ValueError as e:
        return str(e).split(";")[0]


REQUESTS = [
    [],
    ["--reader-scheme=v1"],
    ["--fallback=high"],
    ["--fallback=low"],
    ["--voices"],
    ["--voices", "--fallback=high"],
    ["--voices", "--fallback=low"],
    ["--reader-scheme=v1", "--voices"],
    ["--reader-scheme=v1", "--fallback=high"],
    ["--lexicon-supplement"],
    ["--lexicon-supplement", "--voices"],
    ["--reader-scheme=v1", "--lexicon-supplement"],
]
steps = [{"flags": None, "rss_mib": rss(), "caches": caches(), "guard": guard()}]
for flags in REQUESTS:
    work = Path(tempfile.mkdtemp(dir=os.environ.get("PROBE_TMP")))
    try:
        (work / "draft.txt").write_text("\n".join(fx["draft"]) + "\n", encoding="utf-8")
        argv = flags + [a.replace("<WORK>", str(work)) for a in fx["verb"]]
        code, stdout, stderr = W.run_one(argv)
        result = next((l for l in stdout.splitlines() if l.startswith("  lyric result: ")), None)
        scheme = json.loads(result[len("  lyric result: "):]).get("reader_scheme") if result else None
    finally:
        shutil.rmtree(work, True)
    c = caches()
    steps.append({"flags": flags, "exit": code, "reader_scheme": scheme,
                  "tail": (stdout + stderr)[-300:] if code != 4 else "",
                  "rss_mib": rss(), "counts": {k: (None if v is None else len(v)) for k, v in c.items()},
                  "caches": c, "guard": guard()})
    s = steps[-1]
    print(flags, "exit", code, scheme, s["counts"], s["rss_mib"], s["guard"][:60], flush=True)

with open(out, "w", encoding="utf-8") as fh:
    json.dump({"tree_head": os.popen("git rev-parse HEAD").read().strip(), "steps": steps}, fh, indent=1)

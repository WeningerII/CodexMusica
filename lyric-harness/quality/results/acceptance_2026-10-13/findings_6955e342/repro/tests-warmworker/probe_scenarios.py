"""Instrument the WarmWorkerBody scenarios of quality/test_reader.py WITHOUT
editing them: wrap the body's own helpers to record, at every step, which
lexicon-cache entries exist (key, scheme, object id) and the process RSS.

Run from <tree>/lyric-harness:
    python probe_scenarios.py <scenario_name> <out.json>
One scenario per process (as WarmWorker runs them). The probe only READS
caches of modules already in sys.modules (it never imports one itself), so it
cannot prime anything.
"""
import json
import os
import sys
import unittest

os.environ["READER_TEST_WARM_WORKER_CHILD"] = "1"
sys.path.insert(0, os.getcwd())

name, out = sys.argv[1], sys.argv[2]
import quality.test_reader as TR  # noqa: E402

B = TR.WarmWorkerBody
LOG = []


def rss():
    d = {}
    with open("/proc/self/status") as fh:
        for row in fh:
            if row.startswith(("VmRSS:", "VmHWM:")):
                k, v = row.split(":")
                d[k] = int(v.split()[0]) // 1024
    return d


def lexid(lex):
    return {"id": id(lex), "scheme": getattr(lex, "reader_scheme", None),
            "strip_parens": getattr(lex, "strip_parens", None),
            "cls": type(lex).__name__}


def inventory(tag):
    m = sys.modules
    inv = {}
    eng = m.get("quality.phonology.eng")
    inv["eng._LEX"] = None if eng is None else {repr(k): lexid(v) for k, v in eng._LEX.items()}
    inv["eng._CUT_LEX"] = None if eng is None else {
        repr(k): lexid(v) for k, v in eng._CUT_LEX.items()}
    ft = m.get("quality.fit")
    inv["fit._LEX"] = None if ft is None else {repr(k): lexid(v) for k, v in ft._LEX.items()}
    ls = m.get("quality.lexicon_supplement")
    inv["LS._SUPPLEMENTED"] = None if ls is None else {
        repr((k[0], k[1], os.path.basename(str(k[2])), k[4])): lexid(v)
        for k, v in ls._SUPPLEMENTED.items()}
    mb = m.get("quality.meter_bands")
    inv["MB._READERS"] = None if mb is None else {
        repr(k): {"fb_base_scheme": (v._fb[0].reader_scheme if v._fb else None)}
        for k, v in mb._READERS.items()}
    counts = {k: (None if v is None else len(v)) for k, v in inv.items()}
    # distinct lexicon objects held across all caches
    ids = set()
    for k in ("eng._LEX", "eng._CUT_LEX", "fit._LEX", "LS._SUPPLEMENTED"):
        for e in (inv[k] or {}).values():
            ids.add(e["id"])
    LOG.append({"tag": tag, "rss_mib": rss(), "counts": counts,
                "distinct_lexicon_objects": len(ids), "inv": inv})


def wrap(attr):
    real = getattr(B, attr)

    def wrapped(self, *a, **kw):
        inventory(f"before {attr}")
        try:
            return real(self, *a, **kw)
        finally:
            inventory(f"after {attr}")
    setattr(B, attr, wrapped)


for attr in ("_lyrics", "_library", "_rebound", "_caches_hold_their_schemes",
             "_caches_agree", "_report"):
    wrap(attr)

inventory("module imported (before setUpClass)")
suite = unittest.TestSuite([B(name)])
res = unittest.TextTestRunner(verbosity=2).run(suite)
inventory("end")
with open(out, "w", encoding="utf-8") as fh:
    json.dump({"scenario": name, "ok": res.wasSuccessful(), "tests_run": res.testsRun,
               "skipped": len(res.skipped), "log": LOG}, fh, indent=1)
print("PROBE", name, "ok" if res.wasSuccessful() else "FAIL", res.testsRun)
sys.exit(0 if res.wasSuccessful() and res.testsRun == 1 and not res.skipped else 1)

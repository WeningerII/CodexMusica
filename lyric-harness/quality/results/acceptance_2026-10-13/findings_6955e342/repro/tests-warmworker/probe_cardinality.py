"""Can one lexicon cache retain more than two entries? (3PO: the WarmWorker
docstring says "at most two retained per cache"; the helper checks scheme
ownership, not cardinality.)

Fresh process, run from <tree>/lyric-harness:
    python probe_cardinality.py <out.json>

Warms the module-level lexicon caches through their own public/cache entry
points along their OTHER key dimensions (strip_parens, fallback, aside rule),
under the two declared schemes only, counts retained entries and RSS after
each, then runs the test's own read-only helper
`WarmWorkerBody._caches_hold_their_schemes` on the resulting state. Also
leaves a v2-keyed meter-band reader holding a fallback built on the v1
lexicon (the SharedFallback path) and runs the helper again.
"""
import json
import os
import sys

os.environ["READER_TEST_WARM_WORKER_CHILD"] = "1"
sys.path.insert(0, os.getcwd())
out = sys.argv[1]

import lyric_harness as LH  # noqa: E402
import quality.test_reader as TR  # noqa: E402
import quality.fit as FT  # noqa: E402
import quality.lexicon_supplement as LS  # noqa: E402
import quality.meter_bands as MB  # noqa: E402
from quality.phonology import eng  # noqa: E402
from quality.phonology.eng import English  # noqa: E402


def rss():
    d = {}
    with open("/proc/self/status") as fh:
        for row in fh:
            if row.startswith(("VmRSS:", "VmHWM:")):
                k, v = row.split(":")
                d[k] = int(v.split()[0]) // 1024
    return d


def counts():
    return {"eng._LEX": len(eng._LEX), "eng._CUT_LEX": len(eng._CUT_LEX),
            "fit._LEX": len(FT._LEX), "LS._SUPPLEMENTED": len(LS._SUPPLEMENTED),
            "MB._READERS": len(MB._READERS)}


def schemes_of(cache, scheme_at):
    return sorted({scheme_at(k, v) for k, v in cache.items()})


steps = []


def step(tag):
    steps.append({"tag": tag, "counts": counts(), "rss_mib": rss()})
    print(tag, steps[-1]["counts"], steps[-1]["rss_mib"], flush=True)


helper = TR.WarmWorkerBody("test_a_new_lyrics_request_then_a_legacy_one")
result = {"tree_head": os.popen("git rev-parse HEAD").read().strip(),
          "declared_schemes": list(LH.READER_SCHEMES)}
step("start (modules imported)")

# 1. fit._LEX along (strip_parens, fallback), each under both schemes.
for strip in (True, False):
    for fb in (None, "high", "low"):
        for scheme in ("v2", "v1"):
            lex = FT._english_lexicon(strip, fb, scheme)
            assert lex.reader_scheme == scheme
        step(f"fit._english_lexicon strip_parens={strip} fallback={fb} x (v2,v1)")

# 2. eng._CUT_LEX along (scheme, aside): three keys reachable with the
#    process at v2 (the shared v2 lexicon strips asides, so (v2, True) is it).
English(strip_parens=False).cut_lexicon()                 # (v2, False)
English(reader_scheme="v1").cut_lexicon()                 # (v1, True)
with LH.reader_scheme_scope("v1"):
    English(reader_scheme="v2").cut_lexicon()             # (v2, True): shared is v1 here
step("eng English(...).cut_lexicon() x3")

# 3. LS._SUPPLEMENTED along (strip_parens, fallback), both schemes.
for strip in (True, False):
    for fb in (None, "low"):
        for scheme in ("v2", "v1"):
            lex = LS.supplemented_lexicon(strip_parens=strip, fallback=fb,
                                          reader_scheme=scheme)
            assert lex.reader_scheme == scheme
        step(f"LS.supplemented_lexicon strip_parens={strip} fallback={fb} x (v2,v1)")

# 4. eng._LEX: only the two schemes are possible keys.
for scheme in ("v2", "v1"):
    with LH.reader_scheme_scope(scheme):
        eng._lexicon()
step("eng._lexicon() x (v2,v1)")

result["cache_schemes"] = {
    "eng._LEX": schemes_of(eng._LEX, lambda k, v: k),
    "eng._CUT_LEX": schemes_of(eng._CUT_LEX, lambda k, v: k[0]),
    "fit._LEX(3-key views)": schemes_of({k: v for k, v in FT._LEX.items() if len(k) == 3},
                                        lambda k, v: k[2]),
    "fit._LEX(all, by lexicon)": schemes_of(FT._LEX, lambda k, v: v.reader_scheme),
    "LS._SUPPLEMENTED": schemes_of(LS._SUPPLEMENTED, lambda k, v: k[-1]),
}
result["cache_keys"] = {
    "eng._CUT_LEX": [repr(k) for k in eng._CUT_LEX],
    "fit._LEX": [repr(k) for k in FT._LEX],
    "LS._SUPPLEMENTED": [repr((k[0], k[1], os.path.basename(str(k[2])), k[4]))
                         for k in LS._SUPPLEMENTED],
}
distinct = {id(v) for c in (eng._LEX, eng._CUT_LEX, FT._LEX, LS._SUPPLEMENTED)
            for v in c.values()}
result["distinct_lexicon_objects_retained"] = len(distinct)

# 5. The test's own read-only helper on this state.
try:
    helper._caches_hold_their_schemes()
    result["helper_on_multi_entry_state"] = "PASSED"
except AssertionError as e:
    result["helper_on_multi_entry_state"] = f"FAILED: {e}"

# 6. A v2-keyed meter-band reader left holding a fallback built on v1.
r = MB.reader("fallback-low")
assert ("fallback-low", "v2") in MB._READERS
with LH.reader_scheme_scope("v1"):
    r._fallback()
key_scheme, fb_base = "v2", MB._READERS[("fallback-low", "v2")]._fb[0].reader_scheme
result["mb_reader_keyed_v2_fallback_base_scheme"] = fb_base
try:
    helper._caches_hold_their_schemes()
    result["helper_on_mb_v2_key_with_v1_fallback"] = "PASSED"
except AssertionError as e:
    result["helper_on_mb_v2_key_with_v1_fallback"] = f"FAILED: {e}"
step("MB reader fallback-low (v2 key) used under v1 scope")

result["steps"] = steps
result["max_entries_in_one_cache"] = max(steps[-1]["counts"].values())
with open(out, "w", encoding="utf-8") as fh:
    json.dump(result, fh, indent=1)
print(json.dumps({k: v for k, v in result.items() if k != "steps"}, indent=1))

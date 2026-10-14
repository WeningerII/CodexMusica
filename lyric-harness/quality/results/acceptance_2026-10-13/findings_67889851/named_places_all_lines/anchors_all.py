"""Named places (end = bare N, endword, head, headrime, line): does the
grader's ANCHOR (the syllables it compares: onset, nucleus, stress, coda per
syllable, every reading) change between v1 and v2? Crossed with the
occurrence class of the bound word (same / punct_only / recut / one-only /
different / mismatch). Population: every reader line whose v1 and v2 cuts
differ, plus a seeded sample of 10,000 lines whose cuts are identical (control)."""
import sys, collections, glob, os, random, json
root = sys.argv[1]; sys.path.insert(0, root); os.chdir(root)
import lyric_harness as H
from quality import slots as SL
from quality.coverage_census import build_lexicon
files = sorted(glob.glob(os.path.join(sys.argv[2], "corpus", "song", "eng_*")))
rows = [t for f in files for t in H.load_lyric_lines(f)]
base = build_lexicon("v2", "none")
lex = {s: base.with_reader_scheme(s) for s in ("v1", "v2")}
PLACES = ("end", "endword", "head", "headrime", "line")
def res(s, line, slot):
    anchors, _, _ = SL.resolve(lex[s], line, SL.parse_slot(f"1.{slot}"))
    if not anchors: return None, None
    sig = tuple(sorted({tuple((tuple(y.get("onset") or ()), y.get("nucleus"), y.get("stress"), tuple(y.get("coda") or ())) for y in r) for r in anchors}))
    picks = set()
    for r in anchors:
        w = [y.get("widx") for y in r]
        if not r or None in w: return sig, "mismatch"
        picks.add(w[-1] if slot in ("end", "endword") else w[0])
    if slot == "line": return sig, "line"
    if len(picks) != 1: return sig, "mismatch"
    sp = H.reader_token_spans(line, True, s); i = picks.pop()
    return sig, (tuple(map(tuple, sp[i][1])) if sp and 0 <= i < len(sp) else "mismatch")
def cps(p): return {i for a, b in p for i in range(a, b)}
def occ(line, p, q):
    if p == q: return "same"
    if p is None or q is None: return "one_only"
    if "mismatch" in (p, q): return "mismatch"
    a, b = cps(p), cps(q)
    if not a & b: return "different"
    core = lambda s: "".join(line[i] for i in sorted(s) if line[i].isalnum())
    return "punct_only" if core(a) == core(b) else "recut"
differ, same = [], []
for t in rows:
    a = H.reader_token_spans(t, True, "v1"); b = H.reader_token_spans(t, True, "v2")
    if a is None or b is None: continue
    (same if [p for _, p in a] == [p for _, p in b] else differ).append(t)
SHARD, NSH = int(sys.argv[3]), int(sys.argv[4])
differ = differ[SHARD::NSH]; same = same[SHARD::NSH]
c = collections.Counter(); ex = collections.defaultdict(list)
for pop, lines in (("cut_differs", differ), ("cut_same_all", same)):
    c[pop, "lines"] = len(lines)
    for t in lines:
        for slot in PLACES:
            (s1, b1), (s2, b2) = res("v1", t, slot), res("v2", t, slot)
            o = occ(t, b1, b2)
            an = "no_anchor_v1" if s1 is None and s2 is not None else "no_anchor_v2" if s2 is None and s1 is not None else \
                 "none_both" if s1 is None else ("anchor_same" if s1 == s2 else "anchor_changed")
            c[pop, slot, o, an] += 1
            if an == "anchor_changed" and len(ex[pop, slot, o]) < 3: ex[pop, slot, o].append(t)
print(json.dumps({"shard": SHARD, "of": NSH, "rows": len(rows), "cut_differs": len(differ), "cut_same": len(same)}))
for k in sorted(c): print(k, c[k])
for k in sorted(ex): print(k, ex[k])

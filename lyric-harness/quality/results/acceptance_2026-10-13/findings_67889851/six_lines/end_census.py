"""Unrestricted census: every reader line in corpus/song/eng_* (load_lyric_lines)
whose v1 and v2 token spans are IDENTICAL, compared on the grader's 1.end slot
by PHONOLOGY ONLY (onset, nucleus, stress, coda per syllable, every reading;
v2's extra word/widx tags are ignored). Emits the identity of every line whose
end phonology changes. usage (candidate tree as cwd):
    end_census.py ROOT SHARD NSHARDS OUT.json"""
import sys, os, glob, json
root = sys.argv[1]; shard, nsh = int(sys.argv[2]), int(sys.argv[3]); sys.path.insert(0, root); os.chdir(root)
import lyric_harness as LH
from quality import slots as SL
from quality.coverage_census import build_lexicon
base = build_lexicon("v2", "none"); lex = {s: base.with_reader_scheme(s) for s in ("v1", "v2")}
files = sorted(glob.glob("/home/user/CodexMusica/lyric-harness/corpus/song/eng_*"))
rows = [(os.path.basename(f), i, t) for f in files for i, t in enumerate(LH.load_lyric_lines(f))]
def phon(t, s):
    a, label, _ = SL.resolve(lex[s], t, SL.parse_slot("1.end"))
    return label, sorted({json.dumps([[y.get("onset"), y.get("nucleus"), y.get("stress"), y.get("coda")] for y in r]) for r in a})
n_same = 0; hits = []
for k, (f, i, t) in enumerate(rows):
    if k % nsh != shard: continue
    a = LH.reader_token_spans(t, True, "v1"); b = LH.reader_token_spans(t, True, "v2")
    if a is None or b is None or [p for _, p in a] != [p for _, p in b]: continue
    n_same += 1
    (l1, p1), (l2, p2) = phon(t, "v1"), phon(t, "v2")
    if p1 != p2:
        hits.append({"file": f, "line_index": i, "text": t, "token_spans": [[w, [list(x) for x in ps]] for w, ps in b],
                     "end_label_v1": l1, "end_label_v2": l2, "end_readings_v1": [json.loads(x) for x in p1], "end_readings_v2": [json.loads(x) for x in p2]})
json.dump({"candidate": "67889851144dd2a7eefedd9960a868978fb7bfae", "shard": shard, "of": nsh, "rows_total": len(rows), "identical_cut_lines_in_shard": n_same, "hits": hits}, open(sys.argv[4], "w"), ensure_ascii=False, indent=1)
print(shard, n_same, len(hits))

"""Corpus check of the commit's figure (13 of 18 English song lines read; 5 refused)
and the residual: line-final token ending in a hyphen followed by punctuation.
usage: corpus.py TREE MODE OUT.json"""
import glob, json, os, re, sys, unicodedata
TREE, MODE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
H = os.path.join(TREE, "lyric-harness"); os.chdir(H); sys.path.insert(0, H)
import lyric_harness as LH, quality.relations as RL, quality.revise as RV
files = sorted(glob.glob("corpus/song/eng_*.txt"))
res = {"files": len(files), "lines_all": 0, "lines_nonblank": 0, "split": [], "punct_after_hyphen": []}
with LH.reader_scheme_scope(MODE):
    lex = LH.Lexicon(reader_scheme=MODE)
    judge = RV.relation_phonology_for(lex)
    for fn in files:
        for raw in open(fn, encoding="utf-8").read().split("\n"):
            res["lines_all"] += 1
            if raw.strip():
                res["lines_nonblank"] += 1
            if judge.split_final(raw):
                st = RL.build_stream([raw], judge)
                last = st.lexical_tokens[0][-1] if st.lexical_tokens[0] else None
                unread = [w for (_, _, w) in st.unreadable]
                anc, lw, _ = LH.line_anchors(lex, raw)
                res["split"].append({"file": os.path.basename(fn), "line": raw, "last": last,
                                     "stream_reads_last": last is not None and last not in unread,
                                     "anchors": bool(anc), "anchor_last": lw})
            else:
                n = LH.normalise_word(raw)
                if re.search(r"[\w’']-[^\w\s-]+\s*$", n):
                    st = RL.build_stream([raw], judge)
                    toks = st.lexical_tokens[0]
                    last = toks[-1] if toks else None
                    unread = [w for (_, _, w) in st.unreadable]
                    anc, lw, _ = LH.line_anchors(lex, raw)
                    res["punct_after_hyphen"].append({"file": os.path.basename(fn), "line": raw, "last": last,
                                                      "stream_reads_last": last is not None and last not in unread,
                                                      "anchors": bool(anc), "anchor_last": lw})
s = res["split"]
res["summary"] = {"split_lines": len(s), "stream_reads": sum(r["stream_reads_last"] for r in s),
                  "anchors_read": sum(r["anchors"] for r in s),
                  "disagree": sum(r["stream_reads_last"] != r["anchors"] for r in s),
                  "punct_after_hyphen": len(res["punct_after_hyphen"]),
                  "punct_disagree": sum(r["stream_reads_last"] != r["anchors"] for r in res["punct_after_hyphen"])}
json.dump(res, open(OUT, "w"), ensure_ascii=False, indent=1)
print(json.dumps(res["summary"]), res["lines_all"], res["lines_nonblank"])

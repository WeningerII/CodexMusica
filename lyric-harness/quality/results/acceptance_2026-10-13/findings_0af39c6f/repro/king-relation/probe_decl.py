"""A declared occurrence reading of `king-` answers before the stem.
usage: probe_decl.py LH_DIR MODE OUT.json   (LH_DIR = <tree>/lyric-harness)"""
import json, os, sys
LHD, MODE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.chdir(LHD); sys.path.insert(0, LHD)
import lyric_harness as LH, quality.relations as RL, quality.revise as RV
L1 = "I caught this morning morning's minion, king-"
TAIL = ["dom of daylight's dauphin, dapple-dawn-drawn Falcon, in his riding",
        "Of the rolling level underneath him steady air, and striding",
        "High there, how he rung upon the rein of a wimpling wing"]
res = {}
with LH.reader_scheme_scope(MODE):
    toks = LH.line_tokens(L1, True, MODE)
    res["tokens"] = toks
    for label, phones in (("none", None),
                          ("declared kingdom K IH1 NG D AH0 M", ["K", "IH1", "NG", "D", "AH0", "M"]),
                          ("declared kin K IH1 N", ["K", "IH1", "N"]),
                          ("declared king K IH1 NG", ["K", "IH1", "NG"])):
        if phones:
            pr = [{"line": L1, "token": len(toks), "word": toks[-1], "phones": phones,
                   "basis": "declared", "source": "acceptance probe"}]
            try:
                lex = LH.Lexicon(reader_scheme=MODE, pronunciations=pr)
            except Exception as e:
                res[label] = {"error": repr(e)}
                continue
        else:
            lex = LH.Lexicon(reader_scheme=MODE)
        judge = RV.relation_phonology_for(lex)
        st = RL.build_stream([L1] + TAIL, judge)
        row = {rel: RL.line_pairs_for(RL.REGISTRY[rel], st, keep_refusal=True,
                                      requested_pairs={(1, 4)}).verdict((1, 4))
               for rel in ("broken rhyme", "perfect rhyme")}
        row["unread_L1"] = [w for (li, _, w) in st.unreadable if li == 0]
        row["L1_last_syllables"] = [(u.syl.get("nucleus") if isinstance(u.syl, dict) else str(u.syl))
                                    for u in st.units if u.line == 0 and u.token == len(toks) - 1]
        anc, lw, oov = LH.line_anchors(lex, L1)
        row["anchor0"] = [(s["nucleus"], list(s["coda"])) for s in anc[0]] if anc else None
        row["judge_fallback"] = getattr(judge, "fallback", "NA")
        res[label] = row
json.dump(res, open(OUT, "w"), indent=1, default=repr)
print(json.dumps(res, default=repr))

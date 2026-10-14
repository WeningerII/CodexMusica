"""(a)+(c)+(d): the registered production relation judge on line-final broken
words, every spelling, with controls; plus line_anchors on the same line.

usage: probe_rel.py TREE MODE OUT.json      MODE in base|v1|v2
Run from TREE/lyric-harness (the script chdirs there).
"""
import contextlib, json, os, sys
TREE, MODE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
H = os.path.join(TREE, "lyric-harness"); os.chdir(H); sys.path.insert(0, H)
import lyric_harness as LH, quality.relations as RL, quality.revise as RV

BASE = MODE == "base"
HY = {"-": "-", "u2010": "‐", "u2011": "‑", "-u00ad": "-­", "u00ad-": "­-"}
L1 = "I caught this morning morning's minion, "
L2 = "dom of daylight's dauphin, dapple-dawn-drawn Falcon, in his riding"
L3 = "Of the rolling level underneath him steady air, and striding"
WING = "High there, how he rung upon the rein of a wimpling wing"
LANG = "High there, how he rung upon the rein of a wimpling languish"
KANGA = "High there, how he rung upon the rein of a kangaroo"
DAWN = "High there, how he rung upon the rein of a wimpling dawn"

cases = []   # (label, first, last)
for k, h in HY.items():
    cases.append((f"king{k}|wing", L1 + "king" + h, WING))
for k, h in HY.items():
    cases.append((f"anguish{k}|languish", L1 + "anguish" + h, LANG))
cases += [
    ("king(bare)|wing", L1 + "king", WING),
    ("anguish-|wing [non-rhyme]", L1 + "anguish-", WING),
    ("queen-|wing [non-rhyme]", L1 + "queen-", WING),
    ("king-,|wing", L1 + "king-,", WING),
    ("king-.|wing", L1 + "king-.", WING),
    ("king-!|wing", L1 + "king-!", WING),
    ('king-"|wing', L1 + 'king-"', WING),
    ("king- (trailing spaces)|wing", L1 + "king-   ", WING),
    # printed boundaries
    ("king -|wing [spaced hyphen]", L1 + "king -", WING),
    ("king--|wing [double hyphen]", L1 + "king--", WING),
    ("king—|wing [em dash]", L1 + "king—", WING),
    ("king —|wing [spaced em dash]", L1 + "king —", WING),
    ("king–|wing [en dash]", L1 + "king–", WING),
    ("king‒|wing [figure dash]", L1 + "king‒", WING),
    ("king-—|wing", L1 + "king-—", WING),
    # numerals
    ("2-|wing", L1 + "2-", WING),
    ("2‐|wing", L1 + "2‐", WING),
    ("22-|wing", L1 + "22-", WING),
    ("king2-|wing", L1 + "king2-", WING),
    # x / foreign script / test's controls
    ("क-|wing", L1 + "क-", WING),
    ("×king-|wing", "I caught this minion, ×king-", WING),
    ("我king-|wing", "the minion, 我king-", WING),
    ("king×-|wing", L1 + "king×-", WING),
    ("king-×|wing", L1 + "king-×", WING),
    # fragments / unread stems / hyphenated stems
    ("roo-|kangaroo", L1 + "roo-", KANGA),
    ("xyzzq-|wing", L1 + "xyzzq-", WING),
    ("dapple-dawn-|dawn", L1 + "dapple-dawn-", DAWN),
    ("hill-zide-|wing", L1 + "hill-zide-", WING),
    ("a-king-|wing", L1 + "a-king-", WING),
    ("king-dom|wing [no break]", L1 + "king-dom", WING),
    # mid-line broken token must stay as before
    ("mid king- then wing", "the king- of all and wing", WING),
    # non-hyphen unreadable word
    ("wimplingz|wing", L1 + "wimplingz", WING),
    ("o'er|wing", L1 + "o'er", WING),
]

scope = contextlib.nullcontext() if BASE else LH.reader_scheme_scope(MODE)
out = {"tree": TREE, "mode": MODE, "rows": []}
with scope:
    lex = LH.Lexicon() if BASE else LH.Lexicon(reader_scheme=MODE)
    judge = RV.relation_phonology_for(lex)
    out["judge"] = {"type": type(judge).__name__, "fallback": getattr(judge, "fallback", "NA"),
                    "reader_scheme": getattr(judge, "reader_scheme", "NA"),
                    "has_split_final_stem": hasattr(judge, "split_final_stem")}
    try:
        from quality import phonology as PH
        out["judge"]["is_registered_eng"] = judge is PH.get("eng")
    except Exception as e:
        out["judge"]["is_registered_eng"] = repr(e)
    out["judge"]["read_king-"] = repr(judge.read("king-")) if hasattr(judge, "read") else "NA"
    out["judge"]["syllabify_king-"] = repr(judge.syllabify("king-"))
    out["judge"]["syllabify_king"] = bool(judge.syllabify("king"))
    if hasattr(judge, "split_final_stem"):
        out["judge"]["stems"] = {w: judge.split_final_stem(w) for w in
                                 ("king-", "king", "2-", "king--", "dapple-dawn-", "×king-", "king-,")}
    for label, first, last in cases:
        lines = [first, L2, L3, last]
        row = {"label": label, "first": first, "last": last}
        try:
            st = RL.build_stream(lines, judge)
            for rel in ("broken rhyme", "perfect rhyme"):
                row[rel] = RL.line_pairs_for(RL.REGISTRY[rel], st, keep_refusal=True,
                                             requested_pairs={(1, 4)}).verdict((1, 4))
            row["unread_L1"] = [w for (li, _, w) in st.unreadable if li == 0]
            row["L1_tokens"] = list(st.lexical_tokens[0])
            last_ids = st.lines[0]
            row["L1_last_unit_token"] = (st.units[last_ids[-1]].token_text if last_ids else None)
            row["L1_split_right"] = (st.units[last_ids[-1]].split_right if last_ids else None)
        except Exception as e:
            row["error"] = repr(e)
        # (d) line_anchors through the same plain lexicon
        try:
            anc, lastw, oov = LH.line_anchors(lex, first)
            row["anchors_last"] = lastw
            row["anchors_n"] = len(anc)
            row["anchors_oov"] = list(oov)
            row["anchors_first"] = ([(s["nucleus"], list(s["coda"]), s.get("word")) for s in anc[0]]
                                    if anc else None)
        except Exception as e:
            row["anchors_error"] = repr(e)
        out["rows"].append(row)

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=True, indent=1, default=repr)
print("wrote", OUT, len(out["rows"]))

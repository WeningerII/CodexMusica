"""Independent probe: broken-rhyme verdict per hyphen spelling x phonology x scheme.
usage: python3 br.py TREE MODE   (MODE = v1 | v2 | base)"""
import contextlib, json, os, sys
TREE, MODE = sys.argv[1], sys.argv[2]
H = os.path.join(TREE, "lyric-harness"); os.chdir(H); sys.path.insert(0, H)
import lyric_harness as LH
import quality.relations as RL
import quality.revise as RV
from quality import phonology as PH
from quality.phonology.eng import English
BASE = MODE == "base"
scope = contextlib.nullcontext() if BASE else LH.reader_scheme_scope(MODE)
HY = {"ascii -": "-", "U+2010": "‐", "U+2011": "‑", "-U+00AD": "-­", "U+00AD-": "­-"}
TAIL = ["dom of daylight's dauphin, dapple-dawn-drawn Falcon, in his riding",
        "Of the rolling level underneath him steady air, and striding",
        "High there, how he rung upon the rein of a wimpling wing"]
out = {"tree": TREE, "mode": MODE}
with scope:
    lex = LH.Lexicon() if BASE else LH.Lexicon(reader_scheme=MODE)
    reg = PH.get("eng")
    out["registered_eng_fallback"] = getattr(reg, "fallback", "?")
    judge = RV.relation_phonology_for(lex)
    out["production_judge"] = {"is_registered": judge is reg, "fallback": getattr(judge, "fallback", "?"),
                               "type": type(judge).__name__}
    phons = {"PH.get('eng')": lambda: PH.get("eng"),
             "relation_phonology_for(Lexicon())": lambda: RV.relation_phonology_for(lex),
             "English(fallback='high')": lambda: English(fallback="high"),
             "English(fallback='low')": lambda: English(fallback="low")}
    for pname, mk in phons.items():
        res = {}
        for hn, h in HY.items():
            lines = ["I caught this morning morning's minion, king" + h] + TAIL
            ph = mk()
            st = RL.build_stream(lines, ph)
            lp = RL.line_pairs_for(RL.REGISTRY["broken rhyme"], st, keep_refusal=True, requested_pairs={(1, 4)})
            v = lp.verdict((1, 4))
            units0 = [u for u in st.units if getattr(u, "line", None) == 0] if hasattr(st, "units") else []
            last = units0[-1] if units0 else None
            res[hn] = {"verdict": v,
                       "tok0_last": LH.line_tokens(lines[0])[-1],
                       "unreadable": [list(x) for x in getattr(st, "unreadable", [])],
                       "last_unit_word": last.token_text if last is not None else None,
                       "last_unit_split_right": getattr(last, "split_right", None) if last is not None else None,
                       "line1_first_split_left": next((getattr(u, "split_left", None) for u in st.units if getattr(u, "line", None) == 1), None) if hasattr(st, "units") else None}
            if hn == "ascii -":
                try:
                    r = ph.read("king-")
                    res["read('king-')"] = None if r is None else [list(r.phones), r.layer]
                except Exception as e:
                    res["read('king-')"] = "EXC %r" % e
                r = ph.read("king")
                res["read('king')"] = None if r is None else [list(r.phones), r.layer]
                res["split_final?"] = ph.split_final(lines[0]) if hasattr(ph, "split_final") else "n/a"
        out[pname] = res
    out["lex.transcribe_word('king-')"] = lex.transcribe_word("king-")
    try:
        out["line_anchors(L1)"] = repr(LH.line_anchors(["I caught this morning morning's minion, king-"][0], lex))[:300]
    except Exception as e:
        out["line_anchors(L1)"] = "EXC %r" % e
print(json.dumps(out, indent=1, default=repr))

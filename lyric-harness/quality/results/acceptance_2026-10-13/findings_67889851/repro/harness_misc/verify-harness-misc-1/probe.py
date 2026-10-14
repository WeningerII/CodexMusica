"""probe.py TREE LABEL -- broken rhyme / perfect rhyme verdicts for (1,4) on Windhover-like lines,
per hyphen spelling, per phonology (production relation_phonology_for(None) / English() / English(fallback='high')),
per scheme (v1/v2 where the tree has schemes)."""
import sys, os, json, contextlib
tree, label = sys.argv[1], sys.argv[2]
os.chdir(os.path.join(tree, "lyric-harness")); sys.path.insert(0, os.getcwd())
import lyric_harness as LH
import quality.relations as RL
from quality.phonology.eng import English
try:
    from quality.revise import relation_phonology_for
except ImportError:
    relation_phonology_for = None
schemes = ("v2", "v1") if hasattr(LH, "reader_scheme_scope") else ("base",)
tail = ["dom of daylight's dauphin, dapple-dawn-drawn Falcon, in his riding",
        "Of the rolling level underneath him steady air, and striding",
        "High there, how he rung upon the rein of a wimpling wing"]
HY = {"ascii -": "-", "U+2010": "‐", "U+2011": "‑", "-U+00AD": "-­", "U+00AD-": "­-"}
out = {}
for sc in schemes:
    scope = LH.reader_scheme_scope(sc) if sc != "base" else contextlib.nullcontext()
    with scope:
        phons = {"prod relation_phonology_for(None)": (relation_phonology_for(None) if relation_phonology_for else None),
                 "prod relation_phonology_for(Lexicon())": (relation_phonology_for(LH.Lexicon()) if relation_phonology_for else None),
                 "English()": English(), "English(fallback='high')": English(fallback="high")}
        for pn, phon in phons.items():
            if phon is None: continue
            for hn, h in HY.items():
                lines = ["I caught this morning morning's minion, king" + h] + tail
                toks = LH.line_tokens(lines[0])
                st = RL.build_stream(lines, phon)
                res = {"last_token": toks[-1], "fallback": getattr(phon, "fallback", "?"),
                       "unreadable_line0": [u for u in st.unreadable if u[0] == 0],
                       "split_right_units_line0": sum(1 for u in st.units if u.line == 0 and u.split_right)}
                for rel in ("broken rhyme", "perfect rhyme"):
                    try:
                        res[rel] = RL.line_pairs_for(RL.REGISTRY[rel], st, keep_refusal=True,
                                                     requested_pairs={(1, 4)}).verdict((1, 4))
                    except Exception as e:
                        res[rel] = "EXC %r" % e
                out[f"{label}|{sc}|{pn}|{hn}"] = res
for k, v in out.items():
    print(k, json.dumps(v, ensure_ascii=True, default=str))

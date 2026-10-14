"""Six-line ledger: lines whose v1 and v2 token spans are IDENTICAL but whose
end changes. Two measures: (a) the grader's 1.end slot (slots.resolve readings,
bound widx -> raw-line span), as in legacyrows/anchors_all.py; (b) line_anchors,
as record.py records it. Population (a): every reader line in corpus/song/eng_*
(281,069) with identical spans and a "'s" or "’s"; (b): the six from the
recorder diff (diff_breakdown_67889851). usage: run in the candidate tree."""
import sys, os, glob, json, re
root = sys.argv[1]; sys.path.insert(0, root); os.chdir(root)
import lyric_harness as LH
from quality import slots as SL
from quality.coverage_census import build_lexicon
base = build_lexicon("v2", "none"); lex = {s: base.with_reader_scheme(s) for s in ("v1", "v2")}
files = sorted(glob.glob("/home/user/CodexMusica/lyric-harness/corpus/song/eng_*"))
rows = [(os.path.basename(f), i, t) for f in files for i, t in enumerate(LH.load_lyric_lines(f))]
rec_six = [x["text"] for x in json.load(open(sys.argv[2]))]
def spans(t, s):
    sp = LH.reader_token_spans(t, True, s); return None if sp is None else [(w, [list(p) for p in ps]) for w, ps in sp]
def end(t, s):
    anchors, label, _ = SL.resolve(lex[s], t, SL.parse_slot("1.end"))
    sig = sorted({json.dumps([[y.get("onset"), y.get("nucleus"), y.get("stress"), y.get("coda"), y.get("widx"), y.get("word")] for y in r]) for r in anchors})
    return {"label": label, "readings": [json.loads(x) for x in sig]}
out = []
for f, i, t in rows:
    if not (re.search(r"['’]s\b", t) or t in rec_six): continue
    a, b = spans(t, "v1"), spans(t, "v2")
    if a is None or b is None or [p for _, p in a] != [p for _, p in b]: continue
    e1, e2 = end(t, "v1"), end(t, "v2")
    la1 = LH.line_anchors(lex["v1"], t); la2 = LH.line_anchors(lex["v2"], t)
    la1 = [" ".join("/".join(x) if isinstance(x, (list, tuple)) else str(x) for x in r) if isinstance(r, (list, tuple)) else str(r) for r in (la1[0] or [])]
    la2 = [" ".join("/".join(x) if isinstance(x, (list, tuple)) else str(x) for x in r) if isinstance(r, (list, tuple)) else str(r) for r in (la2[0] or [])]
    if e1 != e2 or t in rec_six:
        out.append({"file": f, "line_index": i, "text": t, "in_recorder_six": t in rec_six, "token_spans_v1_eq_v2": a,
                    "end_slot_changed": e1 != e2, "end_v1": e1, "end_v2": e2,
                    "line_anchors_changed": la1 != la2, "line_anchors_v1": la1, "line_anchors_v2": la2,
                    "A2_trigger_fires": False})
json.dump({"candidate": "67889851144dd2a7eefedd9960a868978fb7bfae", "population_scanned": len(rows), "rows": out}, open(sys.argv[3], "w"), ensure_ascii=False, indent=1)
print("rows", len(out), "end_slot_changed", sum(r["end_slot_changed"] for r in out), "line_anchors_changed", sum(r["line_anchors_changed"] for r in out), "recorder six present", sum(r["in_recorder_six"] for r in out))
for r in out: print(r["end_slot_changed"], r["line_anchors_changed"], r["in_recorder_six"], "|", r["file"], r["line_index"], "|", r["text"][:70], "|", r["end_v1"]["label"], "->", r["end_v2"]["label"])

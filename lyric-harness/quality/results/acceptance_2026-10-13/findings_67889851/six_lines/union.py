"""Union of the two identical-cut end-change measures, with explicit pairs.
usage (candidate tree lyric-harness as cwd):
    union.py ROOT end_census_0.json end_census_1.json six_lines.json union.json
Grader measure: end_census_*.json hits (unrestricted census over load_lyric_lines).
Recorder measure: six_lines.json (record.py's line_anchors over its population).
For every line in either: v1/v2 token spans (raw-line pieces), the grader's 1.end
readings by phonology under v1 and v2, line_anchors under v1 and v2, and which
measure found it. A recorder line is taken by its recorded text."""
import sys, os, json
root = sys.argv[1]; sys.path.insert(0, root); os.chdir(root)
import lyric_harness as LH
from quality import slots as SL
from quality.coverage_census import build_lexicon
base = build_lexicon("v2", "none"); lex = {s: base.with_reader_scheme(s) for s in ("v1", "v2")}
grader = [h for p in sys.argv[2:4] for h in json.load(open(p))["hits"]]
recorder = json.load(open(sys.argv[4]))
def spans(t, s):
    sp = LH.reader_token_spans(t, True, s)
    return None if sp is None else [[w, [list(x) for x in ps]] for w, ps in sp]
def phon(t, s):
    a, label, _ = SL.resolve(lex[s], t, SL.parse_slot("1.end"))
    return label, sorted({json.dumps([[y.get("onset"), y.get("nucleus"), y.get("stress"), y.get("coda")] for y in r]) for r in a})
def la(t, s):
    r = LH.line_anchors(lex[s], t)[0] or []
    return [" ".join("/".join(x) if isinstance(x, (list, tuple)) else str(x) for x in rr) if isinstance(rr, (list, tuple)) else str(rr) for rr in r]
lines = {}
for h in grader: lines.setdefault(h["text"], {"ids": set(), "by": set()}); lines[h["text"]]["ids"].add(f"{h['file']}#{h['line_index']}"); lines[h["text"]]["by"].add("grader_census")
for r in recorder: lines.setdefault(r["text"], {"ids": set(), "by": set()}); lines[r["text"]]["ids"].add(r["id"]); lines[r["text"]]["by"].add("recorder_line_anchors")
out = []
for t, m in sorted(lines.items()):
    (l1, p1), (l2, p2) = phon(t, "v1"), phon(t, "v2")
    s1, s2 = spans(t, "v1"), spans(t, "v2")
    out.append({"text": t, "ids": sorted(m["ids"]), "found_by": sorted(m["by"]),
                "spans_v1": s1, "spans_v2": s2, "spans_identical": s1 is not None and s2 is not None and [p for _, p in s1] == [p for _, p in s2],
                "end_label_v1": l1, "end_label_v2": l2, "end_phonology_v1": [json.loads(x) for x in p1], "end_phonology_v2": [json.loads(x) for x in p2],
                "end_phonology_changed": p1 != p2, "line_anchors_v1": la(t, "v1"), "line_anchors_v2": la(t, "v2"),
                "A2_trigger_fires": False})
json.dump({"candidate": "67889851144dd2a7eefedd9960a868978fb7bfae", "union": len(out),
           "grader_census_hits": sum("grader_census" in r["found_by"] for r in out),
           "recorder_hits": sum("recorder_line_anchors" in r["found_by"] for r in out),
           "both": sum(len(r["found_by"]) == 2 for r in out), "rows": out}, open(sys.argv[5], "w"), ensure_ascii=False, indent=1)
print(len(out), [ (r["text"][:40], r["found_by"], r["end_phonology_changed"], r["spans_identical"]) for r in out])

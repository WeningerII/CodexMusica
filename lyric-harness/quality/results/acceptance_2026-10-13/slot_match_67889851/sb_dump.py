"""Per-case slot-binding outcomes for identity matching across trees.
usage: sb_dump.py ROOT select OUT.txt        -> the gate's aside-line selection on this tree
       sb_dump.py ROOT dump LINES.txt OUT.jsonl
Reuses slot_binding.py (tool v2, committed 0568c4c9) functions unchanged."""
import sys, os, glob, copy, json, importlib.util
root = sys.argv[1]; sys.path.insert(0, root); os.chdir(root)
import lyric_harness as LH
from quality import slots as SL
from quality.coverage_census import build_lexicon
from quality.loop import swap_at_slot
try:
    from quality.loop import _WORD_RE as WR
except ImportError:
    WR = None
spec = importlib.util.spec_from_file_location("sb", "/home/user/CodexMusica/lyric-harness/quality/results/acceptance_2026-10-13/slot_binding.py")
sb = importlib.util.module_from_spec(spec); spec.loader.exec_module(sb)
sb.LH, sb.SL, sb.swap_at_slot, sb.LOOP_WORD_RE, sb.ROOT = LH, SL, swap_at_slot, WR, root
_, _, _, sb.SWAP_KEYWORDS = sb._production_uses()
if sys.argv[2] == "select":
    files = sorted(glob.glob(os.path.join(root, "corpus", "song", "eng_*")))
    sel = [t for f in files for t in LH.load_lyric_lines(f)
           if "(" in t and LH.line_tokens(t, strip_parens=False) != LH.line_tokens(t, strip_parens=True)]
    open(sys.argv[3], "w").write("\n".join(sb.SYNTHETIC + sel) + "\n"); print(len(sb.SYNTHETIC) + len(sel)); sys.exit()
lines = [l for l in open(sys.argv[3], encoding="utf-8").read().split("\n") if l]
base = build_lexicon("v2", "none"); sung = copy.copy(base); sung.strip_parens = False
schemed = hasattr(base, "with_reader_scheme")
lexes = {("cur" if schemed else "base") + ":stripped": base, ("cur" if schemed else "base") + ":sung": sung}
if schemed:
    v1 = base.with_reader_scheme("v1"); v1s = copy.copy(v1); v1s.strip_parens = False
    lexes.update({"v1:stripped": v1, "v1:sung": v1s})
with open(sys.argv[4], "w", encoding="utf-8") as out:
    for t in lines:
        for m, lex in lexes.items():
            sp = sb._spans(t, lex.strip_parens, lex)
            if sp is None or sp is False:
                out.write(json.dumps({"line": t, "mode": m, "slot": None, "kind": "excluded_" + ("transformed" if sp is None else "not_reproduced")}, ensure_ascii=False) + "\n"); continue
            for slot in sb.SLOTS:
                k, named, bound, edited, new = sb._classify(t, slot, lex, sp)
                f = lambda s: None if not s else t[s[0]:s[1]]
                out.write(json.dumps({"line": t, "mode": m, "slot": slot, "kind": k, "named": f(named), "bound": f(bound) if bound not in (None, "mismatch") else bound, "edited": f(edited)}, ensure_ascii=False) + "\n")
print("done", len(lines))

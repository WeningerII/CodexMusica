"""(b) zero-anchor default-end residual: swap_at_slot(text, 1, 'zqx', lex=lex)
with the default v2 lexicon, where the grader binds no syllable on the end word.
Run from <tree>/lyric-harness. Prints JSON."""
import json, os, sys, inspect, subprocess
sys.path.insert(0, os.getcwd())
import lyric_harness as LH
from quality import loop as L
from quality import slots as SL
out = {"tree": subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip(),
       "swap_at_slot_sig": str(inspect.signature(L.swap_at_slot))}
has_lex = "lex" in inspect.signature(L.swap_at_slot).parameters
has_scope = hasattr(LH, "reader_scheme_scope")
cases = []
lines = ["the night was zzqx", "I sing of 45", "the night was long"]  # last: readable control
def lexes():
    res = {}
    if has_scope:
        from quality.phonology import eng
        with LH.reader_scheme_scope("v2"):
            res["eng._lexicon() under v2 scope"] = eng._lexicon()
        res["Lexicon(reader_scheme='v2')"] = LH.Lexicon(reader_scheme="v2")
    else:
        res["Lexicon()"] = LH.Lexicon()
    return res
for name, lex in lexes().items():
    for text in lines:
        rec = {"lexicon": name, "text": text, "lex_scheme": getattr(lex, "reader_scheme", None)}
        try:
            ctx = LH.reader_scheme_scope("v2") if has_scope else None
            if ctx: ctx.__enter__()
            try:
                anchors, label, unread = SL.resolve(lex, text, 1) if hasattr(SL, "resolve") else LH.line_anchors(lex, text)
                rec["resolve_default"] = {"n_anchors": len(anchors), "label": label, "unread": list(unread) if unread else unread}
                rec["line_anchors"] = {"n": len(LH.line_anchors(lex, text)[0])}
                if has_lex:
                    rec["swap_at_slot_lex"] = L.swap_at_slot(text, 1, "zqx", lex=lex)
                    rec["swap_at_slot_lex_scheme_v2"] = L.swap_at_slot(text, 1, "zqx", scheme="v2", lex=lex)
                rec["swap_at_slot_nolex"] = L.swap_at_slot(text, 1, "zqx")
                if has_lex:
                    rec["swap_end_word_lex"] = L.swap_end_word(text, "zqx", lex=lex)
                    if hasattr(L, "_end_occurrence_bound"):
                        tok = LH.reader_line(text, True, scheme="v2").tokens[-1]
                        rec["_end_occurrence_bound"] = L._end_occurrence_bound(lex, text, tok)
            finally:
                if ctx: ctx.__exit__(None, None, None)
        except Exception as e:
            rec["error"] = f"{type(e).__name__}: {e}"
        cases.append(rec)
out["cases"] = cases
print(json.dumps(out, indent=1, ensure_ascii=False))

# usage: cd <tree>/lyric-harness && python probe_resolve.py [scheme]
import sys, os, json
sys.path.insert(0, os.getcwd())
import lyric_harness as LH
from quality import slots as SL
scheme = sys.argv[1] if len(sys.argv) > 1 else None
has_scheme = hasattr(LH, "resolve_reader_scheme")
kw = {}
if has_scheme and scheme:
    kw["reader_scheme"] = scheme
lex = LH.Lexicon(**kw)
lines = ["I gave it all my heart.    10",
         "I gave it all my heart zzzqx",
         "I gave it all my heart.",
         "we met in nineteen 99",
         "the year was 1999"]
ctx = LH.reader_scheme_scope(scheme) if (has_scheme and scheme) else None
if ctx: ctx.__enter__()
print("tree has reader schemes:", has_scheme, "| scheme in force:", LH.resolve_reader_scheme(None) if has_scheme else "n/a (pre-batch)")
for t in lines:
    rft = LH.raw_final_token(t)
    smap = LH.word_syllable_map(lex, t)
    words = sorted({(s.get("widx"), s.get("word")) for s in smap if s.get("widx") is not None})
    la = LH.line_anchors(lex, t)
    print(f"\nLINE {t!r}")
    print(f"  raw_final_token        -> {rft!r}")
    print(f"  word_syllable_map words-> {words}")
    print(f"  line_anchors label     -> {la[1]!r} anchors={len(la[0])}")
    for m in ("1", "1.end", "1.endword", "1.head"):
        a, label, oov = SL.resolve(lex, t, SL.parse_slot(m))
        print(f"  slots.resolve {m:10s} -> label={label!r} anchors={len(a)}")
if ctx: ctx.__exit__(None, None, None)

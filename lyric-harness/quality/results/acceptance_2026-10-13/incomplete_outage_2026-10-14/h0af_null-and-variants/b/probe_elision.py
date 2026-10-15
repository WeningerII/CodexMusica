"""null-and-variants (b, extra): -in' elision and edge apostrophes with a soft hyphen / U+2010 inside, v1 and v2."""
import json, os, sys
sys.path.insert(0, os.getcwd())
import lyric_harness as LH
import quality.lexicon_supplement as LS
W = ["feelin'", "feel­in'", "feelin­'", "rockin'", "rock­in'", "feeling", "feel­ing", "'twas", "'t­was", "o'er", "o­'er"]
out = {}
for s in ("v1", "v2"):
    with LH.reader_scheme_scope(s):
        L = LH.Lexicon(reader_scheme=s)
        SL = LS.SupplementedLexicon(version=LS.canonical_version("v2"), reader_scheme=s)
        for w in W:
            out[f"{s}|{w!a}"] = {"pv": L.pronunciation_variants(w), "tw": list(L.transcribe_word(w)),
                                 "sup.pv": SL.pronunciation_variants(w), "sup.whole": SL.whole_reading(w),
                                 "tok": LH.line_tokens("I " + w, True, s)}
json.dump(out, open(sys.argv[1], "w"), indent=0, ensure_ascii=True)

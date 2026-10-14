"""English.read provenance for a raw vs normalised supplement-only spelling. usage: probe_eng.py TREE MODE"""
import os, sys
TREE, MODE = sys.argv[1], sys.argv[2]
H = os.path.join(TREE, "lyric-harness"); os.chdir(H); sys.path.insert(0, H)
import lyric_harness as LH
from quality import lexicon_supplement as LS
from quality.phonology.eng import English
kw = {} if MODE == "base" else {"reader_scheme": MODE}
SL = LS.SupplementedLexicon(version=LS.canonical_version("v2"), **kw)
E = English(lexicon=SL, **kw)
for w in ["streetlight", "street­light", "twenty‐two", "twenty-two"]:
    r = E.read(w)
    print(MODE, repr(w), "->", None if r is None else (r._asdict() if hasattr(r, "_asdict") else r))
    print("   whole_reading:", SL.whole_reading(w), "| reading_source(raw):", SL.reading_source(w, ["S","T","R","IY1","T","L","AY2","T"]))
    print("   syllabify:", E.syllabify(w) if hasattr(E, "syllabify") else None)

"""English.parses / syllabify (readings='all') raw vs normalised. usage: probe_parses.py TREE MODE SUPP(0|1)"""
import os, sys
TREE, MODE, SUPP = sys.argv[1], sys.argv[2], sys.argv[3] == "1"
H = os.path.join(TREE, "lyric-harness"); os.chdir(H); sys.path.insert(0, H)
import lyric_harness as LH
from quality import lexicon_supplement as LS
from quality.phonology.eng import English
kw = {} if MODE == "base" else {"reader_scheme": MODE}
lex = LS.SupplementedLexicon(version=LS.canonical_version("v2"), **kw) if SUPP else LH.Lexicon(**kw)
E = English(lexicon=lex, **kw)
for w in ["live", "li­ve", "hello", "hel­lo", "read", "re­ad"]:
    ps = E.parses(w)
    print(MODE, "supp" if SUPP else "plain", repr(w), "parses:", len(ps), [" ".join(f"{s.onset}{s.nucleus}{s.coda}" for s in p) for p in ps],
          "| pv:", lex.pronunciation_variants(w), "| tw:", lex.transcribe_word(w))

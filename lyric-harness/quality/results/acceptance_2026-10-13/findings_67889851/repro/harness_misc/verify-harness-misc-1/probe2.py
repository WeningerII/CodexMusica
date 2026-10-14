import sys, os, contextlib
tree = sys.argv[1]
os.chdir(os.path.join(tree, "lyric-harness")); sys.path.insert(0, os.getcwd())
import lyric_harness as LH
import quality.relations as RL
from quality.phonology.eng import English
schemes = ("v2", "v1") if hasattr(LH, "reader_scheme_scope") else ("base",)
line = "I caught this morning morning's minion, king-"
for sc in schemes:
    scope = LH.reader_scheme_scope(sc) if sc != "base" else contextlib.nullcontext()
    with scope:
        for fb in (None, "high"):
            e = English(fallback=fb)
            tfl = e.tokens_for_line(line) if hasattr(e, "tokens_for_line") else "n/a"
            st = RL.build_stream([line, "wing"], e)
            print(sc, "fb=", fb, "| syllabify('king-'):", e.syllabify("king-"), "| syllabify('king'):", bool(e.syllabify("king")),
                  "| read('king-'):", e.read("king-"), "| tokens_for_line:", tfl, "| stream lexical:", st.lexical_tokens[0],
                  "| transcribe_word king-:", LH.Lexicon().transcribe_word("king-") if hasattr(LH.Lexicon(), "transcribe_word") else "n/a")

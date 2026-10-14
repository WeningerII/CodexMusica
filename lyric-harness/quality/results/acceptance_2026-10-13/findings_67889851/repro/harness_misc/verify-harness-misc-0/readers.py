import contextlib, os, sys
TREE, MODE = sys.argv[1], sys.argv[2]
H = os.path.join(TREE, "lyric-harness"); os.chdir(H); sys.path.insert(0, H)
import lyric_harness as LH
from quality import phonology as PH
from quality.phonology.eng import English
scope = contextlib.nullcontext() if MODE == "base" else LH.reader_scheme_scope(MODE)
line = "I caught this morning morning's minion, king-"
with scope:
    lex = LH.Lexicon() if MODE == "base" else LH.Lexicon(reader_scheme=MODE)
    print(MODE, "lex.transcribe(line) tail:", lex.transcribe(line)[0][-3:], "oov:", lex.transcribe(line)[1] if len(lex.transcribe(line))>1 else None)
    print(MODE, "lex.transcribe_word('king-'):", lex.transcribe_word("king-"))
    e = PH.get("eng")
    print(MODE, "PH.get('eng').syllabify('king-'):", e.syllabify("king-"))
    print(MODE, "PH.get('eng').syllabify('king'):", [str(s) for s in e.syllabify("king")])
    if hasattr(e, "tokens_for_line"):
        try: print(MODE, "eng.tokens_for_line:", e.tokens_for_line(line))
        except Exception as x: print(MODE, "tokens_for_line EXC", x)
    import quality.relations as RL
    print(MODE, "relations.tokenise:", RL.tokenise(line))
    w = LH.word_syllable_map(lex, line) if hasattr(LH, "word_syllable_map") else None
    print(MODE, "word_syllable_map tail:", repr(w)[-200:] if w is not None else None)

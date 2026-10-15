"""null-and-variants (b): the R2 test's declared-reading stand-in (copy.copy + _pronunciation_choice only)
vs the production construct (Lexicon(pronunciations=rows) -> for_line -> for_token). cwd = <tree>/lyric-harness."""
import copy, json, os, sys
sys.path.insert(0, os.getcwd())
import lyric_harness as LH
import quality.pronunciation as PRON
from quality.phonology.eng import English
out = {}
with LH.reader_scheme_scope("v2"):
    v2 = LH.Lexicon(reader_scheme="v2")
    stand = copy.copy(v2)
    stand._pronunciation_choice = {"word": "read", "phones": ["R", "IY1", "D"], "source": "me"}
    rows = [{"line": "I read", "token": 2, "word": "read", "phones": ["R", "IY1", "D"], "basis": "declared", "source": "me"}]
    prod = PRON.for_token(PRON.for_line(LH.Lexicon(reader_scheme="v2", pronunciations=rows), "I read"), 1)
    for label, lex in (("test stand-in", stand), ("production for_token", prod)):
        for w in ("read", "re­ad"):
            out[f"{label} | {w!a}"] = {"pronunciation_variants": lex.pronunciation_variants(w),
                                       "transcribe_word": list(lex.transcribe_word(w)),
                                       "English.read": repr(English(lexicon=lex).read(w))}
print(json.dumps(out, indent=1))

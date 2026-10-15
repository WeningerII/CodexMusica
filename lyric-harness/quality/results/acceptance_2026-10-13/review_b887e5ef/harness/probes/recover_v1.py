import sys
sys.path.insert(0, sys.argv[1])
import lyric_harness as LH
from quality import recover as REC
import quality.revise as RV
from quality.lexicon_supplement import SupplementedLexicon
from unittest.mock import patch
songs = [["I see the streetlights", "You hear the nights", "the king of it", "a wing (oh)"],
         ["Oh--oh, oh my love", "I 2 love you love", "the dove above (cat)", "the glove of"]]
def lexes(s):
    yield "plain", LH.Lexicon(reader_scheme=s)
    yield "voices", LH.Lexicon(reader_scheme=s, strip_parens=False)
    yield "supp", SupplementedLexicon(version="v2", reader_scheme=s)
    yield "decl", LH.Lexicon(reader_scheme=s, pronunciations=[{"line": "the king of it", "token": 3, "word": "of",
        "phones": ["AH1","V"], "basis": "dictionary", "source": "probe"}])
for active in ("v1", "v2"):
    with LH.reader_scheme_scope(active):
        for s in ("v1", "v2"):
            for name, lex in lexes(s):
                for lines in songs:
                    new = REC.recover(lines, lex=lex, placements=("end",))
                    with patch.object(RV, "relation_phonology_for", lambda lx: RV._relation_phonology()):
                        old = REC.recover(lines, lex=lex, placements=("end",))
                    same = new["web"] == old["web"] and new.get("mandate_spelling") == old.get("mandate_spelling")
                    print(f"process={active} lex={s}/{name} song={lines[0][:12]!r} identical_to_prefix={same}")

"""For the 1,760 (c) cases: does the lexicon read the LAST reader token at all (word_syllable_map),
i.e. is the zero binding an unreadable word or line_anchors' printed-end guard (raw run != token)?
usage: cd <0af>/lyric-harness; python -I c_lastword.py ROOT reason_c_0af.json"""
import os, sys, json, collections
ROOT = os.path.abspath(sys.argv[1]); os.chdir(ROOT); sys.path.insert(0, ROOT)
import lyric_harness as LH
from quality.coverage_census import build_lexicon
from quality import lexicon_supplement as LS
LEX = {"sup:stripped": build_lexicon("v2", "none"),
       "sup:voices": LS.SupplementedLexicon(fallback=None, strip_parens=False, version=LS.canonical_version("v2"))}
rows = json.load(open(sys.argv[2], encoding="utf-8"))["rows"]
c = collections.Counter(); lines = collections.defaultdict(set)
for r in rows:
    lex = LEX[r["mode"]]
    toks = LH.reader_line(r["line"], lex.strip_parens, "v2").tokens
    read = {s["widx"] for s in LH.word_syllable_map(lex, r["line"])}
    k = "last token read by lexicon" if (len(toks) - 1) in read else "last token unread"
    c[k] += 1; lines[k].add(r["line"])
print(dict(c), {k: len(v) for k, v in lines.items()})
print(sorted(lines["last token read by lexicon"])[:15])

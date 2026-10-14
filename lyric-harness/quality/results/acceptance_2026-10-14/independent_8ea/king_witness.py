import sys,json
sys.path.insert(0,sys.argv[1]+'/lyric-harness')
import lyric_harness as H
import quality.revise as R
import quality.relations as L
from quality.phonology.eng import English
out=[]
for scheme in ['v1','v2']:
 for strip in [True,False]:
  with H.reader_scheme_scope(scheme):
   lex=H.Lexicon(reader_scheme=scheme,strip_parens=strip);p=R.relation_phonology_for(lex)
   for text in ['“It’s a Boo-”','king-,','king- (aside)','king-','savour-','inden-']:
    st=L.build_stream([text,'wing'],p)
    out.append(dict(scheme=scheme,strip_asides=strip,text=text,fallback=p.fallback,split=p.split_final(text),unread=[x for x in st.unreadable],units=[str(u.syl) for u in st.units if u.line==0],stem_high_readable=bool(English(fallback='high').read(text[:-1])) if text in ['savour-','inden-'] else None))
print(json.dumps(out,indent=2,default=str))

from pathlib import Path
from PIL import ImageFont
poemfont=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",25)
import html
P=Path(__file__).parent
ink='#202524';muted='#58615d';teal='#087E8B';purple='#7954B3'
def txt(x,y,s,size=16,fill=ink,weight=400,extra=''):
 return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{weight}" {extra}>{html.escape(s)}</text>'
def line(x,y,X,Y,stroke='#dce1de',w=1,extra=''): return f'<line x1="{x}" y1="{y}" x2="{X}" y2="{Y}" stroke="{stroke}" stroke-width="{w}" {extra}/>'
def rect(x,y,w,h,fill='white',stroke='#dce1de',r=10,sw=1):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
def svg(body,w=1600,h=1370): return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="font-family:Arial,sans-serif"><defs><pattern id="hatch" patternUnits="userSpaceOnUse" width="7" height="7"><path d="M-1,1 L1,-1 M0,7 L7,0 M6,8 L8,6" stroke="#d3d9d5" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="white"/>{body}</svg>'
def inspector():
 b=rect(1174,286,378,612)+txt(1200,322,'PAIR INSPECTOR',12,muted,700)+txt(1200,359,'Alliteration · same line',21,ink,700)
 for y,s in [(397,'watch · L4 w2'),(426,'↔ woods · L4 w4')]: b+=txt(1200,y,s,20,ink,700)
 b+=rect(1200,447,105,32,'white',teal,16)+txt(1216,469,'A  Holds',15,teal,700)+txt(1200,507,'Illustrative witness · authored shared onset W',13,muted)
 for y,title,values in [(550,'WITNESS PRONUNCIATIONS · illustrative',['watch   W AA1 CH','woods   W UH1 D Z','Compared anchors: not reported by route.']),(661,'CONTRACT',['Registered figure · same-line locus','Compatible-reading witness','Licence: none']),(770,'READING EVIDENCE',['Alternate outcomes: not supplied.','Runtime search: not computed (fixture).','Target: Library schema analysis.'])]:
  b+=txt(1200,y,title,11,muted,700)
  for i,v in enumerate(values):b+=txt(1200,y+27+i*23,v,14)
 return b

def countstrip():
 return txt(48,342,'4 authored holds shown · fixture only',14,ink,700)+txt(48,364,'Does not hold / Undecided / Refused / Not yet computed: not supplied · outside locus is method-specific',12,muted)

def methodmenu():
 b=line(48,1120,1552,1120)+txt(48,1147,'METHOD MENU · expanded design example · one grouped multiselect',12,muted,700)
 b+=rect(48,1164,1092,160,'white','#aab3ad',8)
 b+=txt(70,1190,'REGISTERED FIGURES',11,muted,700)
 for y,label in [(1221,'✓  Alliteration'),(1250,'✓  End rhyme')]: b+=txt(70,y,label,15,ink,600)
 b+=txt(340,1190,'REGISTERED FIGURES · unavailable',11,muted,700)+txt(340,1221,'Interior assonance · Not registered yet',13,muted)+txt(340,1250,'Interior consonance · Not registered yet',13,muted)+txt(340,1280,'Disabled until registered',11,muted)
 b+=txt(775,1190,'SHARED SOUND · unavailable',11,muted,700)+txt(775,1221,'Sound layer not implemented',13,muted)+txt(775,1250,'Disabled until implemented',11,muted)
 b+=rect(1174,1164,378,160)+txt(1194,1190,'FILTER RECOVERY · example only',11,muted,700)+txt(1194,1223,'Selected pair hidden by current filter',14,ink,600)+txt(1194,1250,'Show selected pair',14,ink,700)+line(1194,1255,1316,1255,ink,1)+txt(1194,1280,'Selection is retained, never replaced.',12,muted)
 return b

def filters(active):
 values=[('METHOD', 'Alliteration + end rhyme'),('LOCATION','Supported positions'),('COLOR','Relation family')]
 b=''
 for x,w,(label,value) in zip([48,430,765],[355,308,320],values):
  b+=rect(x,240,w,37,'white','#aab3ad',7)+txt(x+12,264,label,10,muted,700)+txt(x+83,264,value,14,ink,600)+txt(x+w-18,263,'⌄',14,ink)
 return b

def chrome(active,sub,coverage):
 b=txt(48,49,'CodexMusica',24,ink,700)+txt(1552,47,'CONNECTION STUDY / REVIEW DRAFT',12,muted,600,'text-anchor="end"')+line(48,74,1552,74)
 b+=txt(48,123,'Stopping by Woods on a Snowy Evening',32,ink,600)+txt(48,153,'Robert Frost · first stanza · authored six-occurrence fixture',15,muted)
 b+=rect(1132,102,420,38,'white','#aab3ad',19)+txt(1150,127,'Illustrative subset · not computed',17,ink,600)
 for x,name in [(48,'Poem + arcs'),(220,'Matrix'),(333,'Grouped network')]:
  b+=txt(x,211,name,18,ink,700 if name==active else 400)
  if name==active:b+=line(x,224,x+(140 if name=='Poem + arcs' else 75 if name=='Matrix' else 170),224,ink,3)
 b+=filters(active)
 b+=txt(48,944,'COVERAGE · '+coverage,13,ink,600)
 b+=txt(48,969,'Target evaluator: Library schema analysis · illustrative fixture, no runtime search.',13,muted)
 b+=line(48,990,1552,990)+txt(48,1015,'STATE KEY · examples only, not outcomes assigned to Frost words',12,muted,700)
 samples=[('A','Holds',teal),('·','Does not hold',muted),('?','Undecided',muted),('×','Refused',muted),('','Outside method locus',muted),('…','Not yet computed',muted)]
 for i,(sym,lab,c) in enumerate(samples):
  x=48+i*250;b+=(rect(x,1034,31,31,'#eef0ee' if i==4 else 'white','none' if i==4 else c,5).replace('/>', ' stroke-dasharray="2 3"/>') if i==5 else rect(x,1034,31,31,'#eef0ee' if i==4 else 'white','none' if i==4 else c,5))+txt(x+15.5,1056,sym,19,c,700,'text-anchor="middle"')+txt(x+42,1055,lab,14)
 b+=txt(48,1093,'Families: A alliteration · R rhyme · V assonance · C consonance · = repetition. Selection uses ink, never hue.',12,muted)
 b+=methodmenu()
 return b+inspector()

b=chrome('Poem + arcs','Methods: Alliteration + end rhyme   /   Location: all supported positions   /   Color: relation family','Alliteration: same line; rhyme: end words. Reading: illustrative standard English.')
b+=txt(48,315,'Six illustrative occurrences · alliteration + end rhyme',19,ink,600)+countstrip()
# poem tokens carefully laid out with separate ports
poem=[['Whose','woods','these','are','I','think','I','know.'],['His','house','is','in','the','village','though;'],['He','will','not','see','me','stopping','here'],['To','watch','his','woods','fill','up','with','snow.']]
coords={}; starts=[435,535,635,735]
for li,words in enumerate(poem,1):
 x=92;y=starts[li-1];b+=txt(50,y,str(li),13,muted)
 for wi,word in enumerate(words,1):
  width=poemfont.getlength(word)+15
  selected=(li,wi) in [(4,2),(4,4)]
  if selected:b+=rect(x-5,y-30,width-5,43,'white',ink,6,2)
  b+=txt(x,y,word,25,ink,400,'font-family="DejaVu Serif,serif"');coords[(li,wi)]=(x+width/2-7,y-35)
  x+=width
# separate duplicate-word port, no relation edge
x,y=coords[(1,2)];b+=f'<circle cx="{x}" cy="{y}" r="4" fill="white" stroke="{muted}" stroke-width="1.5"/>'+txt(x,384,'woods · L1 w2',12,muted,400,'text-anchor="middle"')
for key in [(1,2),(1,8),(2,7),(4,2),(4,4),(4,8)]:
 x,y=coords[key];b+=line(x,y+4,x,y+(5 if key in [(4,2),(4,4)] else 17),ink,1)
# end rhyme ports and margin arcs
for key,label,yy in [((1,8),'know · L1 w8',414),((2,7),'though · L2 w7',514),((4,8),'snow · L4 w8',714)]:
 x,y=coords[key];b+=f'<circle cx="{x}" cy="{y}" r="4" fill="white" stroke="{purple}" stroke-width="2"/>'+line(x,y,875,y,purple,1)+txt(890,yy,label,14,ink)
for y1,y2,cx in [(400,500,1060),(400,700,1130),(500,700,1095)]:b+=f'<path d="M1030,{y1} C{cx},{y1} {cx},{y2} 1030,{y2}" fill="none" stroke="{purple}" stroke-opacity=".25" stroke-width="2"/>'
# explicit separate top-centre ports and same-line low arc
x1,y=coords[(4,2)];x2,y=coords[(4,4)]
b+=f'<path d="M{x1},{y} C{x1},656 {x2},656 {x2},{y}" fill="none" stroke="{teal}" stroke-width="2.5" stroke-dasharray="2 5"/>'
for x,label,tx in [(x1,'watch · L4 w2',90),(x2,'woods · L4 w4',332)]:
 b+=f'<circle cx="{x}" cy="{y}" r="4" fill="white" stroke="{ink}" stroke-width="2"/>'+txt(tx,783,label,15,ink,700)
b+=txt(90,817,'A  Same-line alliteration · shared /w/',15,teal,700)+txt(90,861,'woods · L1 w2 ≠ woods · L4 w4',15,ink,600)+txt(90,886,'Duplicate spelling; separate occurrence IDs. No cross-line alliteration edge.',14,muted)
(P/'01-poem-arcs.svg').write_text(svg(b))

ids=['woods · L1 w2','know · L1 w8','though · L2 w7','watch · L4 w2','woods · L4 w4','snow · L4 w8'];lines=[1,1,2,4,4,4]
b=chrome('Matrix','Method: Alliteration only   /   Symmetric pairs   /   Order: poem order   /   Color: relation family','Alliteration: same-line occurrence pairs. Reading policy: compatible reading (illustrative).')
b+=txt(48,309,'Six illustrative occurrences · unordered pairs shown once',19,ink,600)+txt(48,344,'Cell shows',12,muted,700)+rect(134,323,135,32,'white',ink,6)+txt(146,344,'Alliteration',14,ink,700)+rect(276,323,122,32,'white','#dce1de',6)+txt(288,344,'End rhyme',14,muted)
x0=350;y0=458;sz=66
for i,label in enumerate(ids):
 b+=txt(x0+i*sz+32,y0-18,label,13,ink,700 if i in [3,4] else 400,f'transform="rotate(-42 {x0+i*sz+32} {y0-18})"')
 b+=txt(x0-21,y0+i*sz+39,label,14,ink,700 if i in [3,4] else 400,'text-anchor="end"')
 for j in range(i,6):
  x=x0+j*sz;y=y0+i*sz
  if i==j:b+=rect(x,y,sz,sz,'#fafbfa','#e3e7e4',0);continue
  sel=(i,j)==(3,4);outside=lines[i]!=lines[j]
  b+=rect(x,y,sz,sz,'#eef0ee' if outside else 'white',ink if sel else ('#eef0ee' if outside else '#dce1de'),0,2 if sel else 1)
  b+=txt(x+33,y+41,'A' if sel else '' if outside else 'NS',23 if sel else 13,teal if sel else muted,700 if sel else 400,'text-anchor="middle"')
b+=line(x0,y0+3*sz+33,x0+6*sz,y0+3*sz+33,ink,1,'opacity=".18"')+line(x0+4*sz+33,y0,x0+4*sz+33,y0+6*sz,ink,1,'opacity=".18"')
b+=txt(816,487,'SELECTED PAIR',11,muted,700)+txt(816,516,'watch · L4 w2',17,ink,700)+txt(816,543,'woods · L4 w4',17,ink,700)+txt(816,586,'A  Illustrated hold',15,teal,700)
for y,s in [(641,'Light grey: outside method locus'),(669,'NS  Not supplied (fixture only)'),(692,'       Not an engine state.'),(742,'4 eligible pairs in this fixture;'),(767,'1 authored hold. Not evaluated'),(792,'coverage or a production total.')]:b+=txt(816,y,s,14,muted)
b+=txt(48,898,'Keyboard: arrows move · Enter inspects · Esc clears · Order: poem order',13,muted)
(P/'02-token-matrix.svg').write_text(svg(b))

b=chrome('Grouped network','Methods: Alliteration + end rhyme (explicit mixed-family view)   /   Location: all supported positions','Alliteration: same line; rhyme: end words. Reading: illustrative standard English.')
b+=txt(48,315,'Six illustrative occurrences · four authored connections',19,ink,600)+countstrip()
b+=rect(48,383,517,386)+rect(590,383,550,386)
b+=txt(74,419,'A  Alliteration',19,teal,700)+txt(74,448,'2 occurrences · 1 of 1 eligible pair illustrated',14,muted)+txt(74,473,'Joint reading consistency not assessed',12,muted)
b+=txt(616,419,'R  End rhyme',19,purple,700)+txt(616,448,'3 occurrences · 3 of 3 eligible pairs illustrated',14,muted)+txt(616,473,'Joint reading consistency not assessed',12,muted)
# two nodes
b+=line(177,574,427,574,teal,3,'stroke-dasharray="2 6"')
for x,label in [(177,'watch · L4 w2'),(427,'woods · L4 w4')]:
 b+=f'<circle cx="{x}" cy="574" r="48" fill="white" stroke="{ink}" stroke-width="2"/>'+txt(x,581,label.split(' · ')[0],21,ink,700,'text-anchor="middle"')+txt(x,650,label.split(' · ')[1],14,ink,700,'text-anchor="middle"')
b+=rect(286,557,32,32,'white','white',4)+txt(302,580,'A',18,teal,700,'text-anchor="middle"')
pts=[(860,524,'know · L1 w8'),(718,666,'though · L2 w7'),(1000,666,'snow · L4 w8')]
for i in range(3):
 for j in range(i+1,3):b+=line(*pts[i][:2],*pts[j][:2],purple,2,'opacity=".25"')
for x,y,label in pts:b+=f'<circle cx="{x}" cy="{y}" r="37" fill="white" stroke="{ink}" stroke-width="1.5"/>'+txt(x,y+6,label.split(' · ')[0],18,ink,600,'text-anchor="middle"')+txt(x,y+59,label.split(' · ')[1],13,ink,400,'text-anchor="middle"')
b+=rect(48,796,1092,102)+txt(72,832,'woods · L1 w2',17,ink,600)+txt(72,863,'Outside the selected watch pair’s same-line alliteration locus; not globally “unexamined”.',14,muted)+txt(72,885,'No other edge supplied for this occurrence in the authored fixture.',13,muted)
(P/'03-grouped-network.svg').write_text(svg(b))

b=txt(20,36,'CodexMusica',21,ink,700)+txt(20,72,'Illustrative subset · not computed',13,ink,600)+line(20,90,370,90)
b+=txt(20,123,'Connections',27,ink,600)+txt(20,153,'Frost · first stanza · six occurrences',13,muted)
for x,name in [(20,'Poem'),(105,'Matrix'),(207,'Network')]:b+=txt(x,196,name,16,ink,700 if name=='Matrix' else 400)
b+=line(105,208,160,208,ink,3)+rect(20,220,350,32,'white','#aab3ad',7)+txt(32,241,'Methods: Alliteration + end rhyme',13,ink,600)+txt(350,241,'⌄',14,ink)+txt(20,310,'Cell shows: Alliteration · same line',11,muted)+txt(20,269,'Matrix row · watch · L4 w2',18,ink,700)+txt(20,294,'Same selection as desktop · pair mode',12,muted)
items=[('woods · L4 w4','A  Holds · illustrative',True),('snow · L4 w8','NS  Not supplied (fixture only)',False),('woods · L1 w2','Outside this method’s locus',False),('know · L1 w8','Outside this method’s locus',False),('though · L2 w7','Outside this method’s locus',False)]
for i,(label,state,sel) in enumerate(items):
 y=318+i*68;b+=rect(20,y,350,59,'white',ink if sel else '#dce1de',8,2 if sel else 1)+txt(34,y+24,label,15,ink,700 if sel else 400)+txt(34,y+46,state,12,teal if sel else muted)
b+=txt(20,679,'COVERAGE / same-line alliteration',12,ink,700)+txt(20,700,'Compatible-reading policy · fixture only.',12,muted)+txt(20,721,'Target evaluator: Library schema analysis.',12,muted)
b+=rect(0,746,390,301,'white','#aab3ad',18)+rect(170,757,50,4,'#8b938e','#8b938e',2)+txt(20,792,'PAIR INSPECTOR',11,muted,700)+txt(20,823,'watch · L4 w2 ↔ woods · L4 w4',17,ink,700)+txt(20,852,'A  Holds · same-line alliteration',15,teal,700)+txt(20,880,'W AA1 CH ↔ W UH1 D Z (illustrative)',13)+txt(20,907,'Illustrative witness · authored shared onset W',13,muted)+txt(20,930,'Licence: none · alternates not supplied',13,muted)+txt(20,953,'Runtime search: not computed (fixture)',13,muted)+txt(20,985,'Compared anchors: not reported by route.',12,muted)+txt(20,1006,'Arrow keys navigate · Esc clears selection',12,muted)
b+=txt(20,1080,'STATE KEY · examples only',12,ink,700)
for i,(sym,label) in enumerate([('A','Holds'),('·','Does not hold'),('?','Undecided'),('×','Refused'),('','Outside method locus'),('…','Not yet computed')]):
 x=20+(i%2)*181;y=1098+(i//2)*41;b+=(rect(x,y,25,25,'#eef0ee' if i==4 else 'white','none' if i==4 else '#929b95',4).replace('/>', ' stroke-dasharray="2 3"/>') if i==5 else rect(x,y,25,25,'#eef0ee' if i==4 else 'white','none' if i==4 else '#929b95',4))+txt(x+12.5,y+18,sym,16,teal if i==0 else muted,600,'text-anchor="middle"')+txt(x+33,y+18,label,11)
b+=txt(20,1240,'NS = not supplied by this authored fixture.',11,muted)
b+=txt(20,1272,'METHOD MENU · expanded design example',11,muted,700)+txt(20,1297,'REGISTERED FIGURES',10,muted,700)+txt(20,1323,'✓ Alliteration    ✓ End rhyme',13,ink,600)+txt(20,1349,'Interior assonance / consonance',12,muted)+txt(20,1371,'Not registered yet · disabled',11,muted)+txt(20,1399,'SHARED SOUND',10,muted,700)+txt(20,1424,'Sound layer not implemented · disabled',12,muted)
(P/'04-phone-matrix.svg').write_text(svg(b,390,1450))
import subprocess,hashlib,base64,json
manifest={}
for f in sorted(P.glob('*.svg')):
 subprocess.run(['inkscape',str(f),'--export-type=png','--export-filename='+str(f.with_suffix('.png'))],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 data=f.with_suffix('.png').read_bytes()
 f.with_suffix('.png.base64.txt').write_text(base64.b64encode(data).decode())
 manifest[f.with_suffix('.png').name]=hashlib.sha256(data).hexdigest()
 f.with_suffix('.html').write_text('<!DOCTYPE html><html><meta charset="utf-8"><body style="margin:0;background:white">'+f.read_text()+'</body></html>')
(P/'manifest-sha256.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))

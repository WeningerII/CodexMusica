from PIL import Image, ImageDraw, ImageFont, PngImagePlugin
from pathlib import Path
import json, math, textwrap

ROOT = Path(__file__).resolve().parent
W, H, S = 1800, 3120, 2
C = {'paper':'#f5f2ea','ink':'#202f32','muted':'#65716e','line':'#cdd4cd',
     'teal':'#166963','red':'#a9503e','wash':'#e8eeE8','white':'#fffdf7','amber':'#996d2d'}
FONTS = {
 'serif':'/usr/share/fonts/opentype/urw-base35/P052-Roman.otf',
 'italic':'/usr/share/fonts/opentype/urw-base35/P052-Italic.otf',
 'serifbold':'/usr/share/fonts/opentype/urw-base35/P052-Bold.otf',
 'sans':'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
 'bold':'/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
 'mono':'/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
 'cjk':str(ROOT/'assets/NotoSansCJKkr-Regular.otf'),
 'music':str(ROOT/'assets/Bravura.otf'),
}
im=Image.new('RGB',(W*S,H*S),C['paper']); d=ImageDraw.Draw(im)
cache={}; boxes=[]
def font(size,face='sans'):
 key=(size,face)
 if key not in cache: cache[key]=ImageFont.truetype(FONTS[face],round(size*S))
 return cache[key]
def T(x,y,text,size=18,face='sans',color='ink',anchor='lt',maxw=None):
 f=font(size,face); fill=C.get(color,color)
 if maxw and d.textlength(text,font=f)>maxw*S:
  raise ValueError(f'Text too wide ({d.textlength(text,font=f)/S:.1f}>{maxw}): {text}')
 d.text((round(x*S),round(y*S)),text,font=f,fill=fill,anchor=anchor)
def wrap(x,y,text,maxw,size=18,face='sans',color='ink',leading=1.35):
 f=font(size,face); lines=[]; line=''
 for word in text.split():
  test=f'{line} {word}'.strip()
  if d.textlength(test,font=f)>maxw*S and line: lines.append(line); line=word
  else: line=test
 if line:lines.append(line)
 for i,line in enumerate(lines):T(x,y+i*size*leading,line,size,face,color,maxw=maxw)
 return y+len(lines)*size*leading
def L(x1,y1,x2,y2,color='line',width=1):
 d.line((round(x1*S),round(y1*S),round(x2*S),round(y2*S)),fill=C.get(color,color),width=max(1,round(width*S)))
def R(x,y,w,h,fill='white',outline=None,r=0):
 box=(round(x*S),round(y*S),round((x+w)*S),round((y+h)*S))
 if r:d.rounded_rectangle(box,radius=round(r*S),fill=C.get(fill,fill),outline=C.get(outline,outline) if outline else None,width=S)
 else:d.rectangle(box,fill=C.get(fill,fill),outline=C.get(outline,outline) if outline else None,width=S)
def dot(x,y,r=3,color='teal'):
 d.ellipse(((x-r)*S,(y-r)*S,(x+r)*S,(y+r)*S),fill=C.get(color,color))
def arc(x,y,w,h,color='ink',width=1.5,start=0,end=180):
 d.arc((x*S,y*S,(x+w)*S,(y+h)*S),start=start,end=end,fill=C.get(color,color),width=round(width*S))
def brace(x1,x2,y,label=None,color='muted'):
 L(x1,y+5,x1,y,color,1);L(x1,y,x2,y,color,1);L(x2,y,x2,y+5,color,1)
 if label:T((x1+x2)/2,y-4,label,15,'sans',color,anchor='mb')
def note(x,y,dur='8',color='ink',stem=40,flag=False,dotted=False):
 # Head is an exact, tilted filled oval; the rhythm-only staff specifies no pitch.
 head=Image.new('RGBA',(40*S,28*S),(0,0,0,0));hd=ImageDraw.Draw(head)
 hd.ellipse((10*S,8*S,28*S,18*S),fill=C.get(color,color))
 head=head.rotate(20,resample=Image.Resampling.BICUBIC)
 im.paste(head,(round((x-20)*S),round((y-14)*S)),head)
 L(x+7,y-1,x+7,y-stem,color,1.7)
 if flag:
  # SMuFL eighth-note up flag, origin at the stem's upper end.
  T(x+7,y-stem,'\ue240',40,'music',color,anchor='ls')
 if dotted:dot(x+20,y-2,2.5,color)
def beam(x1,x2,y,color='ink'):
 R(x1+7,y,x2-x1,5,color)
def music_glyph(x,y,char,size=42,color='ink'):
 T(x,y,char,size,'music',color,anchor='ls')
def breve(x,y,color='muted',scale=1):
 arc(x-8*scale,y-9*scale,16*scale,11*scale,color,1.4*scale)
def stress(x,y,strong,color=None):
 if strong:L(x-4,y+2,x+5,y-10,color or 'teal',2)
 else:breve(x,y,color or 'muted')

POEM=[
 'Whose woods these are I think I know.',
 'His house is in the village though;',
 'He will not see me stopping here',
 'To watch his woods fill up with snow.',
 'My little horse must think it queer',
 'To stop without a farmhouse near',
 'Between the woods and frozen lake',
 'The darkest evening of the year.',
 'He gives his harness bells a shake',
 'To ask if there is some mistake.',
 'The only other sound’s the sweep',
 'Of easy wind and downy flake.',
 'The woods are lovely, dark and deep,',
 'But I have promises to keep,',
 'And miles to go before I sleep,',
 'And miles to go before I sleep.'
]
SYLS=[
 ['Whose','woods','these','are','I','think','I','know.'],
 ['His','house','is','in','the','vil','lage','though;'],
 ['He','will','not','see','me','stop','ping','here'],
 ['To','watch','his','woods','fill','up','with','snow.'],
 ['My','lit','tle','horse','must','think','it','queer'],
 ['To','stop','with','out','a','farm','house','near'],
 ['Be','tween','the','woods','and','fro','zen','lake'],
 ['The','dark','est','eve','ning','of','the','year.'],
 ['He','gives','his','har','ness','bells','a','shake'],
 ['To','ask','if','there','is','some','mis','take.'],
 ['The','on','ly','oth','er','sound’s','the','sweep'],
 ['Of','ea','sy','wind','and','down','y','flake.'],
 ['The','woods','are','love','ly,','dark','and','deep,'],
 ['But','I','have','prom','is','es','to','keep,'],
 ['And','miles','to','go','be','fore','I','sleep,'],
 ['And','miles','to','go','be','fore','I','sleep.']
]
# Connections identify syllables belonging to the same word (zero-based index).
JOINS=[[],[5],[5],[],[1],[2,5],[0,5],[1,3],[3],[6],[1,3],[1,5],[3],[3,4],[4],[4]]
RHYMES=list('AABABBCBCC DCDDDD'.replace(' ',''))
assert len(RHYMES)==16
for line,syll,joins in zip(POEM,SYLS,JOINS):
 assert len(syll)==8
 out=''
 for j,syl in enumerate(syll):
  out+=syl+('' if j in joins or j==7 else ' ')
 assert out==line,(out,line)

# Editorial header.
T(75,48,'A STUDY IN WORDS, BEATS & NOTATION',16,'bold','teal')
T(75,88,'Stopping by Woods',65,'serif','ink',maxw=1020)
T(75,162,'on a Snowy Evening',65,'serif','ink',maxw=1040)
T(1180,92,'ROBERT FROST',17,'bold','teal')
T(1180,130,'Iambic tetrameter',29,'serifbold',maxw=550)
T(1180,175,'4 feet · 8 syllables per line',19,'sans',maxw=550)
wrap(1180,211,'Four stanzas. One recurring metrical framework. Several ways to see and hear it.',540,17,color='muted')
L(75,270,1725,270,'ink',1.4)

# Shared symbol legend.
stress(95,307,False); T(116,294,'unstressed',17)
stress(285,307,True);T(306,294,'stressed',17)
L(470,294,470,312,'muted',1.5);T(485,294,'foot boundary',17)
L(690,294,690,312,'red',1.5);L(696,294,696,312,'red',1.5);T(710,294,'pause / caesura',17)
T(1020,294,'Hyphens connect syllables within a word.',17,'sans','muted')

def stanza(x,y,start,roman):
 w,h=800,510
 R(x,y,w,h,'white',r=8)
 T(x+25,y+20,roman,18,'bold','teal')
 T(x+85,y+20,'SCANSION · ONE POSSIBLE READING',13,'bold','muted')
 T(x+w-25,y+20,'8.8.8.8',15,'mono','teal',anchor='rt')
 for k in range(4):
  idx=start+k; ry=y+66+k*105
  T(x+23,ry+7,f'{idx+1:02}',12,'mono','muted')
  T(x+60,ry,POEM[idx],25,'serif',maxw=690)
  T(x+w-24,ry+5,RHYMES[idx],14,'bold','red',anchor='rt')
  gridx=x+67; cw=85.5
  for j in range(8):
   xx=gridx+(j+.5)*cw
   strong=j%2==1
   if idx in (7,13) and j==5:strong=False
   col='amber' if idx in (7,13) and j in (4,5) else ('teal' if strong else 'muted')
   stress(xx,ry+56,strong,col)
   T(xx,ry+67,SYLS[idx][j],17,'sans',col,anchor='mt',maxw=cw-4)
   if j in JOINS[idx]:
    L(xx+cw/2-3,ry+77,xx+cw/2+3,ry+77,'muted',1)
  for j in (2,4,6):L(gridx+j*cw,ry+40,gridx+j*cw,ry+89,'line',1)
  if idx==12:
   # Caesura after 'lovely', i.e. after syllable five, within foot three.
   xx=gridx+5*cw
   L(xx-2,ry+41,xx-2,ry+59,'red',1.4);L(xx+3,ry+41,xx+3,ry+59,'red',1.4)
  if k<3:L(x+60,ry+97,x+w-26,ry+97,'line',.6)

stanza(75,350,0,'I')
stanza(925,350,4,'II')
stanza(75,900,8,'III')
stanza(925,900,12,'IV')

# Commentary attached to the specific analytical decisions.
R(75,1450,1650,155,'wash',r=8)
T(100,1471,'METER AND SPEECH',14,'bold','teal')
wrap(100,1500,'The underlying pattern is four iambs. In lines 8 and 14, amber marks show a possible weak third foot: “-ning of” and “-is-es”. Read evening as two syllables; the word stress in promises stays on PROM-.',760,17,leading=1.35)
T(920,1471,'BOUNDARIES AND COUNTS',14,'bold','teal')
wrap(920,1500,'The pause after “lovely,” falls inside the third foot. Foot boundaries may split words. Each stanza’s 8.8.8.8 syllable count matches the Long Meter pattern; rhyme runs AABA / BBCB / CCDC / DDDD.',775,17,leading=1.35)

# A fully consistent, optional rhythm for line 1.
T(75,1650,'One possible rhythm for the first line',32,'serifbold')
T(75,1695,'Illustrative 4/4 recitation. The poem specifies no melody, tempo, or note lengths.',17,'sans','muted')
R(75,1740,1650,465,'white',r=8)
xs=[340+i*155 for i in range(9)]
staff=1840
# Shading is a study overlay, not part of conventional staff notation.
for j in (1,3,5,7):R(xs[j]-35,1870,70,264,'wash',r=5)
T(100,1780,'RHYTHM',13,'bold','teal')
T(100,1803,'pitch unspecified',13,'sans','muted')
L(285,staff,1700,staff,'muted',1)
T(258,1801,'4',35,'bold',anchor='mt');T(258,1837,'4',35,'bold',anchor='mt')
for j,x in enumerate(xs):note(x,staff,flag=j==0)
for a,b in ((1,2),(3,4),(5,6),(7,8)):beam(xs[a],xs[b],staff-40)
L((xs[0]+xs[1])/2,staff-34,(xs[0]+xs[1])/2,staff+34,'ink',1.4)
L(1686,staff-34,1686,staff+34,'ink',1.2);L(1694,staff-34,1694,staff+34,'ink',3)
T(xs[0],1761,'pickup',15,'sans','muted',anchor='mt')
T((xs[7]+xs[8])/2,1761,'tie: hold “know”',15,'sans','muted',anchor='mt')
arc(xs[7]+3,staff+6,xs[8]-xs[7]-6,25,'ink',1.7)
T(100,1882,'LYRIC UNDERLAY',13,'bold','teal')
for x,sy in zip(xs,SYLS[0]):T(x,1880,sy,23,'serif',anchor='mt')
L(xs[7]+43,1902,xs[8]+8,1902,'ink',1)
T(100,1930,'COUNT',13,'bold','teal')
for x,ct in zip(xs,['&','1','&','2','&','3','&','4','&']):T(x,1925,ct,22,'mono',anchor='mt')
T(100,1971,'TAKADIMI',13,'bold','teal')
for x,ct in zip(xs,['di','ta','di','ta','di','ta','di','ta','(di)']):T(x,1965,ct,20,'sans','muted' if ct=='(di)' else 'ink',anchor='mt')
L(100,2004,1700,2004,'line',1)
for yy,name,active in [(2023,'MEASURE',[1]),(2050,'HALF-MEASURE',[1,5]),(2077,'BEAT',[1,3,5,7]),(2104,'SUBDIVISION',list(range(9)))]:
 T(100,yy-5,name,12,'bold','teal')
 for j in active:dot(xs[j],yy,3)
T(100,2150,'Grid dots show metrical hierarchy. The final (di) is counted without a new attack.',16,'sans','muted')
T(100,2175,'The opening pickup precedes the barline; the tied final eighths fill beat 4.',16,'sans','muted')

T(75,2247,'Notation comparisons',31,'serifbold')
T(75,2290,'Independent examples of the other systems; they do not assign new meters or traditions to Frost’s text.',17,'sans','muted')
CW=516.6666667;GAP=50
def card(col,row,title):
 x=75+col*(CW+GAP);y=2330+row*340
 R(x,y,CW,310,'white',r=8)
 T(x+22,y+19,title,21,'serifbold',maxw=CW-44)
 return x,y

# Conventional note values, tuplets, rest, and syllabic underlay.
x,y=card(0,0,'Durations, rests & underlay')
note(x+48,y+112,dur='4',dotted=True,stem=38)
T(x+85,y+84,'dotted quarter',16)
T(x+85,y+110,'1½ beats in 4/4',14,'sans','muted')
music_glyph(x+342,y+116,'\ue4e6',44)
T(x+380,y+84,'eighth rest',14)
T(x+380,y+110,'½ beat',14,'sans','muted')
tx=[x+45,x+100,x+155];ny=y+220
for xx in tx:note(xx,ny,stem=35)
beam(tx[0],tx[2],ny-35)
brace(tx[0],tx[2],ny-58,'3','ink')
T(x+205,y+182,'Triplet: three eighths',16)
T(x+205,y+208,'in one quarter-note beat.',15,'sans','muted')
T(x+25,y+269,'Syllable underlay:  vil - lage',17,'sans','teal')

# Other ways to count and group.
x,y=card(1,0,'Counting & additive notation')
T(x+24,y+65,'4/4 · sixteenth-note subdivisions',15,'sans','muted')
T(x+24,y+92,'1 e & a 2 e & a 3 e & a 4 e & a',17,'mono',maxw=CW-48)
T(x+24,y+139,'6/8 · two compound beats',15,'sans','muted')
T(x+24,y+166,'1 la li   2 la li',20,'mono')
T(x+24,y+196,'ta-ki-da   ta-ki-da',17,'sans','teal')
T(x+24,y+239,'7/8 = (2+2+3)/8',20,'mono')
T(x+24,y+270,'1 2  |  1 2  |  1 2 3',17,'mono','muted')

# Quantity is explicitly a comparison, not a stress-to-duration conversion.
x,y=card(2,0,'Quantitative scansion')
T(x+24,y+65,'Classical syllable length',16,'sans','muted')
breve(x+45,y+124,'ink',1.7);L(x+80,y+116,x+106,y+116,'ink',2)
T(x+148,y+104,'iamb: short–long',18)
L(x+30,y+178,x+56,y+178,'ink',2);breve(x+87,y+186,'ink',1.7);breve(x+127,y+186,'ink',1.7)
T(x+165,y+166,'dactyl: long–short–short',16,maxw=CW-180)
wrap(x+24,y+222,'The breve marks a short syllable; the horizontal stroke marks a long one. These are quantity marks, distinct from the poem’s stress marks.',CW-48,15,leading=1.38)

# Hindustani cycle with X/2/0/3 and accurate unit counts.
x,y=card(0,1,'Tāl chart · tīntāl')
T(x+24,y+65,'16 mātrās · four divisions',17,'sans','muted')
for j,lab in enumerate(['X','2','0','3']):
 xx=x+24+j*117
 R(xx,y+105,116,88,'wash' if j!=2 else '#ece8dc',outline='line')
 T(xx+58,y+116,lab,25,'bold','teal',anchor='mt')
 T(xx+58,y+157,' '.join(str(n) for n in range(j*4+1,j*4+5)),14,'mono',anchor='mt')
wrap(x+24,y+215,'X = sam; 0 = khālī (wave). 2 and 3 mark further claps. A wave does not imply silence.',CW-48,16,leading=1.4)

# Exact Malfuf reference pattern; arbitrary ornamentation is not implied.
x,y=card(1,1,'Arabic stroke notation · Malfuf')
T(x+24,y+65,'2/4 · sixteenth-note grid',17,'sans','muted')
for j,(ct,stroke) in enumerate(zip(['1','e','&','a','2','e','&','a'],['dum','·','·','tak','·','·','tak','·'])):
 xx=x+25+(j+.5)*58
 T(xx,y+112,ct,18,'mono',anchor='mt')
 T(xx,y+153,stroke,16,'sans','red' if stroke=='dum' else 'teal',anchor='mt')
L(x+24,y+143,x+CW-24,y+143,'line',1)
wrap(x+24,y+211,'dum = low stroke; tak = sharp stroke. A dot marks no stroke in this basic pattern; performers may ornament it.',CW-48,16,leading=1.4)

# Jeongganbo: a pitch onset followed by an empty duration cell.
x,y=card(2,1,'Jeongganbo · a time grid')
R(x+27,y+71,100,100,'white',outline='ink');R(x+27,y+171,100,100,'white',outline='ink')
T(x+77,y+78,'黃',68,'cjk',anchor='mt')
L(x+146,y+91,x+146,y+248,'teal',1.5)
L(x+146,y+248,x+140,y+236,'teal',1.5);L(x+146,y+248,x+152,y+236,'teal',1.5)
T(x+179,y+78,'Read downward.',17,'bold','teal')
wrap(x+179,y+117,'One cell equals one beat in this example. 黃 names Hwangjong.',CW-205,16,face='cjk',leading=1.45)
wrap(x+179,y+196,'The empty cell continues the preceding note: one onset, two beats.',CW-205,16,leading=1.4)

# Source credits and artifact provenance. No invented score attribution.
L(75,3025,1725,3025,'line',1)
T(75,3045,'TEXT: Robert Frost · supplied poem. ANALYSIS: an illustrative reading; musical realization newly devised for this study.',13,'sans','muted',maxw=1650)
T(75,3070,'REFERENCES: poets.org · poetry.harvard.edu · Open Music Theory · takadimi.net · brucehayes.org · UPF CompMusic · MaqamWorld · DCC · ETRI.',12,'sans','muted',maxw=1650)

meta=PngImagePlugin.PngInfo()
meta.add_text('Title','Stopping by Woods on a Snowy Evening — annotated notation study')
meta.add_text('Poem','\n\n'.join('\n'.join(POEM[i:i+4]) for i in range(0,16,4)))
meta.add_text('Description','Complete poem with syllabic scansion; one possible musical setting of line 1; notation comparisons. The musical setting is newly devised, not attributed to Robert Frost.')
meta.add_text('Sources',json.dumps([
 'https://www.poetryfoundation.org/poems/42891/stopping-by-woods-on-a-snowy-evening',
 'https://poetry.harvard.edu/guide-prosody',
 'https://viva.pressbooks.pub/openmusictheory/chapter/simple-meter-and-time-signatures/',
 'https://takadimi.net/documents/Takadimi%20short%20guide%20for%20Web.pdf',
 'https://brucehayes.org/Metrics.htm',
 'https://compmusic.upf.edu/examples-taal-hindustani',
 'https://maqamworld.com/en/iqaa/malfuf.php',
 'https://dcc.dickinson.edu/seneca-hercules-furens/intro/meters',
 'https://patents.google.com/patent/KR20060090157A/en'
]))
out=ROOT/'frost_poem_notation.png'
staged=ROOT/'frost_render_complete.png'
im.save(staged,pnginfo=meta,optimize=True,dpi=(240,240))
with Image.open(staged) as check:
 check.load()
staged.replace(out)
preview=im.resize((900,1560),Image.Resampling.LANCZOS)
preview.save(ROOT/'preview.png')
im.crop((150,700,1750,1720)).save(ROOT/'detail_stanza.png')
im.crop((150,3480,3450,4410)).save(ROOT/'detail_score.png')
im.crop((150,4660,3450,5960)).save(ROOT/'detail_comparisons.png')
print(json.dumps({'output':str(out),'pixels':im.size,'bytes':out.stat().st_size,'poem_lines':len(POEM),'syllables':sum(map(len,SYLS))}))

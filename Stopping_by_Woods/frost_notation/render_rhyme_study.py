from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, PngImagePlugin
import ast
import hashlib
import json

ROOT = Path(__file__).resolve().parent
# Reuse the validated text data without executing an earlier renderer.
source = ast.parse((ROOT/'render_cohesive.py').read_text())
data = {}
for statement in source.body:
    if isinstance(statement,ast.Assign):
        for target in statement.targets:
            if isinstance(target,ast.Name) and target.id in ('POEM','SYLS','JOINS'):
                data[target.id] = ast.literal_eval(statement.value)
POEM, SYLS, JOINS = (data[k] for k in ('POEM','SYLS','JOINS'))
RHYMES = list('AABA'+'BBCB'+'CCDC'+'DDDD')
SPEAK = [
    ['whose','WOODS','these','ARE','eye','THINK','eye','NOH'],
    ['his','HOUSE','is','IN','the','VIL','ij','THOH'],
    ['he','WILL','not','SEE','me','STOP','ing','HEER'],
    ['to','WATCH','his','WOODS','fill','UP','with','SNOH'],
    ['my','LIT','ul','HORSE','must','THINK','it','KWEER'],
    ['to','STOP','with','OUT','a','FARM','house','NEER'],
    ['bih','TWEEN','the','WOODS','and','FROH','zun','LAYK'],
    ['the','DARK','ist','EEV','ning','of','the','YEER'],
    ['he','GIVES','his','HAR','niss','BELLS','a','SHAYK'],
    ['to','ASK','if','THERE','is','SOME','mis','TAYK'],
    ['the','OHN','lee','UTH','er','SOUNDZ','the','SWEEP'],
    ['of','EE','zee','WIND','and','DOWN','ee','FLAYK'],
    ['the','WOODS','are','LUV','lee,','DARK','and','DEEP'],
    ['but','EYE','have','PROM','ih','siz','to','KEEP'],
    ['and','MILES','to','GO','bih','FORE','eye','SLEEP'],
    ['and','MILES','to','GO','bih','FORE','eye','SLEEP'],
]
# Highlight spellings that represent the matching vowel and following sounds.
TAILS = ['ow','ough','ere','ow','eer','ear','ake','ear',
         'ake','ake','eep','ake','eep','eep','eep','eep']
SOUNDS = {'A':'OH','B':'EER','C':'AYK','D':'EEP'}
PAL = {
    'A': {'ink':'#875c05','fill':'#f6e5a7','line':'#c4a551'},
    'B': {'ink':'#286a90','fill':'#d9eaf4','line':'#83b2cc'},
    'C': {'ink':'#8c4764','fill':'#f0dce5','line':'#c393a8'},
    'D': {'ink':'#256e59','fill':'#d6eadd','line':'#85b6a0'},
}
C = {'paper':'#faf8f1','ink':'#23322f','muted':'#68736c',
     'rule':'#d7dbd2','wash':'#efeee7','white':'#fffef9','internal':'#696a7d'}
FONTS = {
    'serif':'/usr/share/fonts/opentype/urw-base35/P052-Roman.otf',
    'serifbold':'/usr/share/fonts/opentype/urw-base35/P052-Bold.otf',
    'italic':'/usr/share/fonts/opentype/urw-base35/P052-Italic.otf',
    'sans':'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    'bold':'/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
}
W,H,S = 1760,3380,2
im = Image.new('RGB',(W*S,H*S),C['paper'])
d = ImageDraw.Draw(im)
cache = {}
def color(c):
    return C.get(c,c)
def font(size,face='sans'):
    key=(size,face)
    if key not in cache:
        cache[key]=ImageFont.truetype(FONTS[face],round(size*S))
    return cache[key]
def width(s,size=22,face='sans'):
    return d.textlength(s,font=font(size,face))/S
def text(x,y,s,size=22,face='sans',fill='ink',anchor='lt',maxw=None):
    if maxw is not None:
        assert width(s,size,face)<=maxw,(s,width(s,size,face),maxw)
    d.text((round(x*S),round(y*S)),s,font=font(size,face),fill=color(fill),anchor=anchor)
def line(x1,y1,x2,y2,fill='rule',weight=1):
    d.line((round(x1*S),round(y1*S),round(x2*S),round(y2*S)),fill=color(fill),width=max(1,round(weight*S)))
def rect(x,y,w,h,fill,outline=None,r=0,weight=1):
    box=tuple(round(v*S) for v in (x,y,x+w,y+h))
    if r:
        d.rounded_rectangle(box,radius=round(r*S),fill=color(fill) if fill else None,
                            outline=color(outline) if outline else None,width=round(weight*S))
    else:
        d.rectangle(box,fill=color(fill) if fill else None,
                    outline=color(outline) if outline else None,width=round(weight*S))
def paragraph(x,y,s,maxw,size=22,face='sans',fill='muted',leading=1.42):
    lines=[]; current=''
    for word in s.split():
        test=(current+' '+word).strip()
        if current and width(test,size,face)>maxw:
            lines.append(current); current=word
        else: current=test
    if current: lines.append(current)
    for n,t in enumerate(lines): text(x,y+n*size*leading,t,size,face,fill,maxw=maxw)
    return y+len(lines)*size*leading
def stress(x,y,strong):
    if strong: line(x-4,y+3,x+5,y-10,'ink',2)
    else:
        d.arc(tuple(round(v*S) for v in (x-7.5,y-9,x+7.5,y+3)),0,180,
              fill=C['muted'],width=round(1.7*S))
def pause(x,y):
    line(x-3,y-11,x-3,y+7,'muted',1.5)
    line(x+3,y-11,x+3,y+7,'muted',1.5)
def arrow(x1,y,x2,fill='muted',weight=1.6):
    line(x1,y,x2,y,fill,weight)
    line(x2-8,y-5,x2,y,fill,weight)
    line(x2-8,y+5,x2,y,fill,weight)
def scheme(x,y,letters,size=26,box=38):
    for i,letter in enumerate(letters):
        p=PAL[letter]
        rect(x+i*(box+7),y,box,box,p['fill'],r=5)
        text(x+i*(box+7)+box/2,y+box/2,letter,size,'bold',p['ink'],anchor='mm')
    return x+len(letters)*(box+7)-7
def family_title(x,y,family):
    p=PAL[family]
    rect(x,y,45,42,p['fill'],r=5)
    text(x+22.5,y+21,family,25,'bold',p['ink'],anchor='mm')
    text(x+60,y+7,f'“{SOUNDS[family]}” sound',27,'serifbold',p['ink'])
def note(x,y,title,body,fill='ink',size=22):
    text(x,y,title,19,'bold',fill,maxw=455)
    return paragraph(x,y+33,body,455,size=size)+22
def dotted_rect(x,y,w,h):
    for xx in range(round(x),round(x+w),10):
        line(xx,y,min(xx+4,x+w),y,'muted',.9)
        line(xx,y+h,min(xx+4,x+w),y+h,'muted',.9)
    for yy in range(round(y),round(y+h),10):
        line(x,yy,x,min(yy+4,y+h),'muted',.9)
        line(x+w,yy,x+w,min(yy+4,y+h),'muted',.9)

# Header: the analytical framework is visible once, above the poem it describes.
text(90,54,'ROBERT FROST',21,'bold','muted')
text(1670,54,'METER · PRONUNCIATION · RHYME',18,'sans','muted',anchor='rt')
text(90,104,'Stopping by Woods on a Snowy Evening',72,'serif',maxw=1580)
text(90,200,'Iambic tetrameter: four feet, eight syllables per line · Four quatrains',25,'sans','muted',maxw=1580)

stress(103,269,False); text(124,255,'unstressed',20,'sans','muted')
stress(310,269,True); text(330,255,'stressed',20,'sans','muted')
line(517,257,517,278,'muted',1.3); text(534,255,'foot division',20,'sans','muted')
pause(761,268); text(783,255,'pause / caesura',20,'sans','muted')
text(1074,255,'CAPS = emphasis in the reading guide',20,'sans','muted',maxw=596)
text(90,300,'Read aloud beneath each line. Hyphens join syllables within a word; respellings are sound cues.',21,'sans','muted',maxw=1580)

text(90,349,'INTERLOCKING END RHYME',17,'bold','muted')
sx=90
for n,pat in enumerate(('AABA','BBCB','CCDC','DDDD')):
    end=scheme(sx,381,pat,24,37)
    if n<3: arrow(end+16,400,end+62)
    sx=end+80
paragraph(1137,350,'The third line’s rhyme carries into the next stanza. The last stanza closes on one rhyme.',530,21,fill='muted')
line(90,450,1670,450,'rule',1.3)

BODY_X, BODY_SIZE = 145,42
GRID_X, GRID_W = 145,950
CELL = GRID_W/8
SIDE_X, BRACKET_X = 1210,1142
FIRST, STRIDE, ROW_H = 488,641,134
line_records=[]

for st in range(4):
    top=FIRST+st*STRIDE
    roman=('I','II','III','IV')[st]
    primary='ABCD'[st]
    text(90,top+2,roman,28,'serifbold','ink')
    text(145,top+2,'FOUR FEET · READ ALOUD',16,'bold','muted')
    for foot in range(4):
        text(GRID_X+(foot+.5)*(GRID_W/4),top+33,str(foot+1),14,'sans','muted',anchor='mt')
    family_title(SIDE_X,top,primary)
    group_y=[]

    for row in range(4):
        i=st*4+row
        original=POEM[i]
        ry=top+61+row*ROW_H
        baseline=ry+37
        ylink=baseline-12
        rhyme=RHYMES[i]; p=PAL[rhyme]
        stem=original.rstrip('.,;')
        tail=TAILS[i]
        assert stem.endswith(tail),(i,stem,tail)
        tail_start=len(stem)-len(tail)
        hx=BODY_X+width(original[:tail_start],BODY_SIZE,'serif')
        hw=width(stem[tail_start:],BODY_SIZE,'serif')
        rect(hx-3,baseline-33,hw+6,39,p['fill'],r=3)
        text(118,baseline-1,f'{i+1:02}',16,'sans','muted',anchor='rs')
        text(BODY_X,baseline,original,BODY_SIZE,'serif',anchor='ls',maxw=950)
        if rhyme==primary:
            end_x=BODY_X+width(original,BODY_SIZE,'serif')+16
            line(end_x,ylink,BRACKET_X,ylink,p['line'],1.25)
            group_y.append(ylink)
        else:
            # The new sound is labelled at its line, then explicitly carried below.
            word_end=BODY_X+width(original,BODY_SIZE,'serif')
            text(word_end+18,baseline-5,f'→ {rhyme}',19,'bold',p['ink'],anchor='ls')

        # Mark a same-line rhyme separately from the end-rhyme highlights.
        if i==2:
            for token in ('see','me'):
                start=original.index(' '+token+' ')+1
                ux=BODY_X+width(original[:start],BODY_SIZE,'serif')
                uw=width(token,BODY_SIZE,'serif')
                line(ux,baseline+4,ux+uw,baseline+4,'internal',1.7)

        # Four visible foot groups; each contains two syllable positions.
        for foot in range(4):
            fx=GRID_X+foot*(GRID_W/4)
            rect(fx+2,ry+59,GRID_W/4-4,64,'white' if foot%2==0 else 'wash',r=4)
        for j in (2,4,6):
            gx=GRID_X+j*CELL
            line(gx,ry+64,gx,ry+117,'rule',1.4)
        if i in (7,13):
            dotted_rect(GRID_X+4*CELL+3,ry+59,2*CELL-6,64)

        guide=[]
        for j,sy in enumerate(SPEAK[i]):
            cx=GRID_X+(j+.5)*CELL
            strong=j%2==1 and not(i in (7,13) and j==5)
            assert sy.isupper()==strong,(i,j,sy,strong)
            stress(cx,ry+78,strong)
            f='bold' if strong else 'sans'
            if j==7:
                sound=SOUNDS[rhyme]
                assert sy.endswith(sound),(i,sy,sound)
                tw=width(sy,24,f)
                pre=sy[:-len(sound)]
                rect(cx-tw/2+width(pre,24,f)-2,ry+94,
                     width(sound,24,f)+4,29,p['fill'],r=2)
            text(cx,ry+96,sy,24,f,'ink' if strong else 'muted',anchor='mt',maxw=CELL-2)
            if j in JOINS[i]:
                # A hyphen at the word's syllable join remains visible across a foot edge.
                mx=GRID_X+(j+1)*CELL
                if j in (1,3,5): rect(mx-6,ry+104,12,8,'paper')
                text(mx,ry+108,'-',17,'sans','muted',anchor='mm')
            guide.append(sy+('-' if j in JOINS[i] else ''))
        if i==12:
            pause(GRID_X+5*CELL,ry+78)
        line_records.append({'line':i+1,'text':original,'rhyme':rhyme,
                             'highlighted_spelling':tail,'guide':guide,
                             'foot_pattern':['u/','u/','uu' if i in(7,13) else 'u/','u/']})

    # One bracket joins the actual line endings of the stanza's main rhyme.
    pp=PAL[primary]
    line(BRACKET_X,min(group_y),BRACKET_X,max(group_y),pp['line'],2.2)
    line(BRACKET_X-11,min(group_y),BRACKET_X,min(group_y),pp['line'],2.2)
    line(BRACKET_X-11,max(group_y),BRACKET_X,max(group_y),pp['line'],2.2)

    if st==0:
        y=top+69
        y=note(SIDE_X,y,'PERFECT / FULL END RHYME  [1]',
               'know · though · snow. The stressed vowel and all following sounds match.')
        y=note(SIDE_X,y+7,'MASCULINE / SINGLE RHYME  [2]',
               'The rhyme lands on one final stressed syllable. All sixteen line endings do this.')
        y=note(SIDE_X,y+7,'INTERNAL RHYME  [1]',
               'see / me, underlined in line 3, rhyme within the line. Their shared sound is “EE”.')
        text(145,top+602,'here → queer · near · year',22,'bold',PAL['B']['ink'])
        text(618,top+604,'B becomes the next stanza’s main rhyme.',20,'sans','muted')
    elif st==1:
        y=top+69
        y=note(SIDE_X,y,'B CARRIES ACROSS STANZAS',
               'here → queer · near · year. The blue endings connect stanza I to stanza II.',PAL['B']['ink'])
        y=note(SIDE_X,y+10,'THE NEXT RHYME BEGINS',
               'lake introduces “AYK”. It will return as shake, mistake and flake.',PAL['C']['ink'])
        y=note(SIDE_X,y+10,'METER IN LINE 8  [3]',
               'EEV-ning has two syllables. “ning of” can form a weak third foot; its guide is outlined.')
        text(145,top+602,'lake → shake · mistake · flake',22,'bold',PAL['C']['ink'])
        text(703,top+604,'C becomes the next stanza’s main rhyme.',20,'sans','muted')
    elif st==2:
        y=top+69
        y=note(SIDE_X,y,'C CARRIES ACROSS STANZAS',
               'lake → shake · mistake · flake. The pink endings share “AYK”.',PAL['C']['ink'])
        y=note(SIDE_X,y+10,'WHY mis–TAKE IS MASCULINE  [2]',
               'The word has two syllables, but only its final stressed syllable makes the rhyme.')
        y=note(SIDE_X,y+10,'THE FINAL RHYME BEGINS',
               'sweep introduces “EEP”, the sound that will occupy every ending in stanza IV.',PAL['D']['ink'])
        text(145,top+602,'sweep → deep · keep · sleep · sleep',22,'bold',PAL['D']['ink'])
        text(787,top+604,'D fills the final stanza.',20,'sans','muted')
    else:
        y=top+69
        y=note(SIDE_X,y,'MONORHYME · DDDD  [2]',
               'deep · keep · sleep · sleep. One rhyme family fills the entire closing stanza.',PAL['D']['ink'])
        y=note(SIDE_X,y+9,'METER IN LINE 14  [3]',
               'PROM-ih-siz has three syllables. Stress stays on PROM; “ih-siz” is a possible weak third foot.')
        y=note(SIDE_X,y+9,'IDENTICAL RHYME  [2]',
               'sleep / sleep repeats the same ending word. The final line’s wording also repeats.',PAL['D']['ink'])
        # Nested bracket distinguishes the identical pair from the four-line family.
        y15=top+61+2*ROW_H+25
        y16=top+61+3*ROW_H+25
        bx=1172
        line(bx,y15,bx,y16,PAL['D']['ink'],2)
        line(BRACKET_X+3,y15,bx,y15,PAL['D']['ink'],2)
        line(BRACKET_X+3,y16,bx,y16,PAL['D']['ink'],2)
        text(145,top+602,'The closing sound repeats; no new rhyme opens another stanza.',22,'sans',PAL['D']['ink'])

    if st<3: line(90,top+635,1670,top+635,'rule',1.2)

# A short interpretive key and primary sources stay attached to the analysis.
FOOTER=FIRST+3*STRIDE+653
line(90,FOOTER,1670,FOOTER,'rule',1.3)
text(90,FOOTER+27,'READING THE MARKS',17,'bold','muted')
paragraph(90,FOOTER+61,
          'The guides show one possible reading. An iamb rises from weak to strong: da-DUM. Four feet organize each line; actual spoken emphasis can vary. The pause after “lovely,” falls inside the third foot.',
          960,21,fill='muted')
paragraph(1110,FOOTER+27,
          'Highlights follow rhyme sounds; spellings can differ. Rhyme labels describe different features: position, sound match, stress and stanza pattern.',
          560,20,fill='muted')
text(90,FOOTER+176,'DEFINITIONS & SCANSION',15,'bold','muted')
text(90,FOOTER+206,'[1] Academy of American Poets · poets.org/glossary/rhyme',16,'sans','muted')
text(90,FOOTER+231,'[2] Poetry Foundation · poetryfoundation.org/education/glossary/rhyme',16,'sans','muted')
text(90,FOOTER+256,'[3] Harvard Guide to Prosody · poetry.harvard.edu/guide-prosody',16,'sans','muted')
assert FOOTER+280 < H,(FOOTER,H)

meta=PngImagePlugin.PngInfo()
meta.add_text('Title','Stopping by Woods on a Snowy Evening — Meter, pronunciation and rhyme')
meta.add_text('Author','Robert Frost')
meta.add_text('Poem','\n\n'.join('\n'.join(POEM[i:i+4]) for i in range(0,16,4)))
meta.add_text('Description','Complete poem with color-highlighted rhyme sounds, connecting end-rhyme brackets, interlocking stanza pattern, named rhyme types, four-foot scansion, syllabic read-aloud pronunciation cues, and interpretive notes. One possible English reading.')
meta.add_text('Sources','https://poets.org/glossary/rhyme\nhttps://www.poetryfoundation.org/education/glossary/rhyme\nhttps://poetry.harvard.edu/guide-prosody')
out=ROOT/'frost_poem_notation.png'
staged=ROOT/'frost_rhyme_complete.png'
im.save(staged,pnginfo=meta,optimize=True,dpi=(240,240))
with Image.open(staged) as checked:
    checked.load()
    assert checked.size==(W*S,H*S)
    assert len([s for s in checked.info['Poem'].splitlines() if s])==16
staged.replace(out)
im.resize((1056,round(H*1056/W)),Image.Resampling.LANCZOS).save(ROOT/'rhyme_preview.png')
im.crop((60*S,465*S,1700*S,1108*S)).resize((1640,643),Image.Resampling.LANCZOS).save(ROOT/'rhyme_stanza1.png')
im.crop((60*S,(FIRST+3*STRIDE-10)*S,1700*S,(FIRST+3*STRIDE+635)*S)).resize((1640,645),Image.Resampling.LANCZOS).save(ROOT/'rhyme_stanza4.png')
(ROOT/'rhyme_audit.json').write_text(json.dumps(line_records,ensure_ascii=False,indent=2))
print(json.dumps({'path':str(out),'dimensions':im.size,'bytes':out.stat().st_size,
                  'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))

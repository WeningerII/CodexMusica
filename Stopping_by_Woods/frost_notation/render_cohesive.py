from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, PngImagePlugin
import hashlib
import json

ROOT = Path(__file__).resolve().parent
W, H, S = 1300, 1980, 2
C = {'paper': '#faf8f1', 'ink': '#23332f', 'muted': '#64736d',
     'rule': '#cdd5ce', 'teal': '#206e62', 'soft': '#956d3e'}
FONTS = {
    'serif': '/usr/share/fonts/opentype/urw-base35/P052-Roman.otf',
    'italic': '/usr/share/fonts/opentype/urw-base35/P052-Italic.otf',
    'sans': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    'bold': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
}
POEM = [
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
    'And miles to go before I sleep.',
]
SYLS = [
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
    ['And','miles','to','go','be','fore','I','sleep.'],
]
JOINS = [[],[5],[5],[],[1],[2,5],[0,5],[1,3],
         [3],[6],[1,3],[1,5],[3],[3,4],[4],[4]]
RHYMES = list('AABA'+'BBCB'+'CCDC'+'DDDD')
assert len(POEM) == len(SYLS) == len(JOINS) == len(RHYMES) == 16

im = Image.new('RGB', (W*S,H*S), C['paper'])
d = ImageDraw.Draw(im)
cache = {}
def font(size, face='sans'):
    key = size,face
    if key not in cache:
        cache[key] = ImageFont.truetype(FONTS[face], round(size*S))
    return cache[key]
def width(text, size=20, face='sans'):
    return d.textlength(text,font=font(size,face))/S
def text(x,y,string,size=20,face='sans',color='ink',anchor='lt',maxw=None):
    if maxw is not None:
        assert width(string,size,face) <= maxw, (string,width(string,size,face),maxw)
    d.text((round(x*S),round(y*S)),string,font=font(size,face),
           fill=C[color],anchor=anchor)
def line(x1,y1,x2,y2,color='rule',weight=1):
    d.line((round(x1*S),round(y1*S),round(x2*S),round(y2*S)),
           fill=C[color],width=max(1,round(weight*S)))
def stress(cx,cy,strong,color=None):
    if strong:
        line(cx-4,cy+3,cx+5,cy-10,color or 'teal',2.1)
    else:
        d.arc((round((cx-7.5)*S),round((cy-9)*S),
               round((cx+7.5)*S),round((cy+3)*S)),0,180,
              fill=C[color or 'muted'],width=round(1.7*S))
def bar(cx,cy,double=False):
    for dx in (-2.8,2.8) if double else (0,):
        line(cx+dx,cy-11,cx+dx,cy+5,'muted',1.35)

# A single hierarchy: title, compact key, uninterrupted poem, short reading note.
text(100,62,'ROBERT FROST',18,'bold','muted')
text(1200,62,'ENGLISH SCANSION',16,'sans','muted',anchor='rt')
text(100,108,'Stopping by Woods on a Snowy Evening',58,'serif',maxw=1100)
text(100,191,'Iambic tetrameter · four feet · eight syllables per line',21,'sans','muted',maxw=1100)

legend_y = 255
stress(110,legend_y,False)
text(130,legend_y-14,'unstressed',18,'sans','muted')
stress(340,legend_y,True)
text(360,legend_y-14,'stressed',18,'sans','muted')
bar(540,legend_y)
text(560,legend_y-14,'foot boundary',18,'sans','muted')
bar(815,legend_y,True)
text(836,legend_y-14,'pause',18,'sans','muted')
text(1031,legend_y-14,'A–D',18,'bold','teal')
text(1081,legend_y-14,'rhyme',18,'sans','muted')
line(100,290,1200,290)

body_size, body_x = 44, 165
audit = []
for i,(original,syllables,joins,rhyme) in enumerate(zip(POEM,SYLS,JOINS,RHYMES)):
    assert len(syllables) == 8
    constructed = ''
    spans = []
    for j,syl in enumerate(syllables):
        start = len(constructed)
        constructed += syl
        end = len(constructed)
        spans.append((start,end))
        if j < 7 and j not in joins:
            constructed += ' '
    assert constructed == original, (i,constructed,original)
    row_y = 325 + (i//4)*368 + (i%4)*82
    mark_y, baseline = row_y+5,row_y+62
    text(121,baseline-1,str(i+1),17,'sans','muted',anchor='rs')
    # Draw each entire line once, preserving natural word spacing and punctuation.
    text(body_x,baseline,original,body_size,'serif',anchor='ls',maxw=900)
    text(1167,baseline-5,rhyme,20,'bold','teal',anchor='ms')
    positions = []
    marks = []
    for j,(start,end) in enumerate(spans):
        clean_end = end
        while clean_end > start and original[clean_end-1] in '.,;':
            clean_end -= 1
        left = body_x+width(original[:start],body_size,'serif')
        right = body_x+width(original[:clean_end],body_size,'serif')
        cx = (left+right)/2
        strong = (j%2==1)
        weak_variant = i in (7,13) and j in (4,5)
        if i in (7,13) and j == 5:
            strong = False
        stress(cx,mark_y,strong,'soft' if weak_variant else None)
        positions.append(cx)
        marks.append('/' if strong else 'u')
    for j in (1,3,5):
        # Foot boundaries stay in the scansion row, even when a foot splits a word.
        end_x = body_x+width(original[:spans[j][1]],body_size,'serif')
        next_x = body_x+width(original[:spans[j+1][0]],body_size,'serif')
        bar((end_x+next_x)/2,mark_y)
    if i == 12:
        end_x = body_x+width(original[:spans[4][1]],body_size,'serif')
        next_x = body_x+width(original[:spans[5][0]],body_size,'serif')
        bar((end_x+next_x)/2,mark_y,True)
    audit.append({'line':i+1,'text':original,'syllables':syllables,
                  'marks':marks,'rhyme':rhyme,'mark_centres':positions})

line(100,1798,1200,1798)
text(100,1822,'One possible reading',22,'italic','ink')
text(100,1860,'Read “evening” as two syllables. The warm-colored marks in lines 8 and 14',18,'sans','muted',maxw=1100)
text(100,1888,'show a possible weak third foot; the word stress in “promises” stays on PROM-.',18,'sans','muted',maxw=1100)
text(100,1934,'Scansion references: Poetry Foundation · Harvard Guide to Prosody',14,'sans','muted',maxw=1100)

meta = PngImagePlugin.PngInfo()
meta.add_text('Title','Stopping by Woods on a Snowy Evening — English scansion')
meta.add_text('Author','Robert Frost')
meta.add_text('Description','The complete poem in four stanzas, with one possible English scansion aligned directly above its syllables. Foot boundaries, an optional caesura, and end-rhyme letters are included. Lines 8 and 14 permit weak third feet; evening is counted as two syllables.')
meta.add_text('Poem','\n\n'.join('\n'.join(POEM[i:i+4]) for i in range(0,16,4)))
meta.add_text('Sources','https://www.poetryfoundation.org/poems/42891/stopping-by-woods-on-a-snowy-evening\nhttps://www.poetryfoundation.org/education/glossary/scansion\nhttps://poetry.harvard.edu/guide-prosody')
out = ROOT/'frost_poem_notation.png'
staged = ROOT/'frost_cohesive_complete.png'
im.save(staged,pnginfo=meta,optimize=True,dpi=(240,240))
with Image.open(staged) as verified:
    verified.load()
    assert verified.size == (W*S,H*S)
    assert verified.info['Poem'] == '\n\n'.join('\n'.join(POEM[i:i+4]) for i in range(0,16,4))
staged.replace(out)
im.resize((910,round(H*910/W)),Image.Resampling.LANCZOS).save(ROOT/'cohesive_preview.png')
im.crop((110*S,1405*S,1050*S,1767*S)).save(ROOT/'cohesive_detail.png')
(ROOT/'cohesive_audit.json').write_text(json.dumps(audit,indent=2,ensure_ascii=False))
print(json.dumps({'path':str(out),'dimensions':im.size,'bytes':out.stat().st_size,
                  'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))

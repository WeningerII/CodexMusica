from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, PngImagePlugin
import ast
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parent
PAIR_PATH = ROOT.parent / 'frost_pair_analysis' / 'frost_rhyme_pairs.json'
PAIR_BYTES = PAIR_PATH.read_bytes()
PAIR_DATA = json.loads(PAIR_BYTES)
PAIR_SHA256 = hashlib.sha256(PAIR_BYTES).hexdigest()
TOKENS = PAIR_DATA['tokens']
CATEGORIES = {item[0]: {'name': item[1], 'schema': item[2]}
              for item in PAIR_DATA['categories']}
RAW_PAIRS = {(int(i), int(j)): int(mask) for i,j,mask in PAIR_DATA['pairs']}
ABSENCE_ONLY = {(int(i), int(j)): int(mask)
                for i,j,mask in PAIR_DATA.get('absence_only', [])}
DISPLAY_PAIRS = {pair: mask & ~ABSENCE_ONLY.get(pair, 0)
                 for pair,mask in RAW_PAIRS.items()}
assert len(TOKENS) == 108
assert len(RAW_PAIRS) == 108*107//2
assert all(1 <= i < j <= 108 for i,j in RAW_PAIRS)
assert all(0 <= mask < 1<<22 for mask in RAW_PAIRS.values())
TYPE_COUNTS = {f'E{k}': sum(bool(mask & (1<<(k-1))) for mask in DISPLAY_PAIRS.values())
               for k in range(1,23)}
DISPLAY_MATCHES = sum(bool(mask) for mask in DISPLAY_PAIRS.values())
MAX_TYPES = max(mask.bit_count() for mask in DISPLAY_PAIRS.values())
assert TYPE_COUNTS == PAIR_DATA['counts']['nonabsence_by_category']
assert DISPLAY_MATCHES == PAIR_DATA['counts']['pairs_with_nonabsence_matches']
SOURCE_COMMIT = PAIR_DATA['source']['commit']
def type_ids(mask):
    return [f'E{k}' for k in range(1,23) if mask & (1<<(k-1))]
OPENING_TYPES = type_ids(DISPLAY_PAIRS[(1,9)])
OPENING_IDS = ' · '.join(OPENING_TYPES)
tree = ast.parse((ROOT / 'render_cohesive.py').read_text())
saved = {}
for node in tree.body:
    if isinstance(node, ast.Assign):
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id in ('POEM', 'SYLS', 'JOINS'):
                saved[target.id] = ast.literal_eval(node.value)
POEM, SYLS, JOINS = (saved[k] for k in ('POEM', 'SYLS', 'JOINS'))
RHYMES = list('AABA' + 'BBCB' + 'CCDC' + 'DDDD')
TAILS = ['ow', 'ough', 'ere', 'ow', 'eer', 'ear', 'ake', 'ear',
         'ake', 'ake', 'eep', 'ake', 'eep', 'eep', 'eep', 'eep']
SOUNDS = {'A': 'OH', 'B': 'EER', 'C': 'AYK', 'D': 'EEP'}
IPA = {'A': '/oʊ/', 'B': '/ɪr/', 'C': '/eɪk/', 'D': '/ip/'}

# One broad rhotic American respelling system. Every syllable is encoded.
SPEAK = [
    ['hooz', 'WUUDZ', 'dheez', 'AHR', 'eye', 'THINGK', 'eye', 'NOH'],
    ['hiz', 'HOWS', 'iz', 'IN', 'dhuh', 'VIL', 'ij', 'DHOH'],
    ['hee', 'WIL', 'naht', 'SEE', 'mee', 'STAH', 'ping', 'HEER'],
    ['tuh', 'WAHCH', 'hiz', 'WUUDZ', 'fil', 'UP', 'widh', 'SNOH'],
    ['meye', 'LIT', 'uhl', 'HORS', 'must', 'THINGK', 'it', 'KWEER'],
    ['tuh', 'STAHP', 'widh', 'OWT', 'uh', 'FAHRM', 'hows', 'NEER'],
    ['bi', 'TWEEN', 'dhuh', 'WUUDZ', 'uhnd', 'FROH', 'zuhn', 'LAYK'],
    ['dhuh', 'DAHRK', 'ist', 'EEV', 'ning', 'uhv', 'dhuh', 'YEER'],
    ['hee', 'GIVZ', 'hiz', 'HAHR', 'nuhs', 'BELZ', 'uh', 'SHAYK'],
    ['tuh', 'ASK', 'if', 'DHAIR', 'iz', 'SUM', 'mis', 'TAYK'],
    ['dhee', 'OHN', 'lee', 'UDH', 'er', 'SOWNDZ', 'dhuh', 'SWEEP'],
    ['uhv', 'EE', 'zee', 'WIND', 'uhnd', 'DOW', 'nee', 'FLAYK'],
    ['dhuh', 'WUUDZ', 'er', 'LUV', 'lee', 'DAHRK', 'uhnd', 'DEEP'],
    ['but', 'EYE', 'hav', 'PRAH', 'mi', 'siz', 'tuh', 'KEEP'],
    ['uhnd', 'MEYELZ', 'tuh', 'GOH', 'bi', 'FOR', 'eye', 'SLEEP'],
    ['uhnd', 'MEYELZ', 'tuh', 'GOH', 'bi', 'FOR', 'eye', 'SLEEP'],
]

# Alternatives replace only the identified feet, or redistribute prominence
# without changing the binary scan. They are editorial readings, not recordings.
ALTS = [
    [
        'F1 HOOZ wuudz (/ ˘) or HOOZ WUUDZ (/ /): foreground ownership.',
        'F2 dheez ahr (˘ ˘) or DHEEZ ahr (/ ˘): soften “are” or emphasize “these”.',
        'Give THINK or KNOW the chief accent: tentative knowledge or greater assurance.',
    ],
    [
        'F2 iz in (˘ ˘): a conversational light foot; “in” need not carry a full beat.',
        'F1 HIZ HOWS (/ /): the owner. Give THOUGH more weight to sharpen the contrast.',
    ],
    [
        'F1–2 hee wil | NAHT SEE (˘ ˘ | / /), or hee wil | NAHT see (˘ ˘ | / ˘).',
        'F3 MEE STAH- (/ /): emphasize who would be seen; HERE can stress the place.',
    ],
    [
        'F3 FIL UP (/ /) or FIL up (/ ˘): weight the filling as well as, or more than, “up”.',
        'F2 HIZ wuudz (/ ˘) recalls ownership; WATCH foregrounds the act of looking.',
    ],
    [
        'F3 MUST THINGK (/ /): strengthen the speaker’s inference about the horse.',
        'F1 MEYE LIT- (/ /): personal attachment. The lexical stress stays on LIT-.',
    ],
    [
        'Same scan; emphasize STOP, with-OUT, FARM-house or NEAR.',
        'The focus becomes the unusual stop, lack of shelter, human habitation or proximity.',
    ],
    [
        'Same scan; weight WOODS and LAKE equally to balance the two boundaries.',
        'Or give FRO-zen the chief accent, foregrounding the condition of the landscape.',
    ],
    [
        'F3 ning uhv (˘ ˘) is natural speech; ning UV (˘ /) gives “of” a light metrical lift.',
        'Keep EEV-ning at two syllables. The expected third beat can remain lightly voiced.',
    ],
    [
        'F1 HEE givz (/ ˘): foreground the horse as the acting subject.',
        'Or let hee givz (˘ ˘) pass lightly, with BELLS and SHAKE carrying the action.',
    ],
    [
        'F2–3 if dhair | iz suhm (˘ ˘ | ˘ ˘): conversationally light between ASK and TAKE.',
        'SOME can imply an unspecified error; F3 IZ suhm (/ ˘) asks whether one exists.',
    ],
    [
        'Same scan; emphasize ON-ly for exclusion, OTH-er for contrast, or SWEEP for motion.',
        'sound’s = sound is, contracted to one syllable: SOWNDZ.',
    ],
    [
        'Same scan; weight WIND and FLAKE to identify the sources of the sound.',
        'Or weight EA-sy and DOWN-y to foreground gentleness and softness.',
    ],
    [
        'Same scan; let LOVE-ly govern the description, with “dark and deep” elaborating it.',
        'Or give all three adjectives comparable force. A pause after lovely falls inside F3.',
    ],
    [
        'F1 BUT eye (/ ˘) sharpens the turn; BUT EYE (/ /) also foregrounds the speaker.',
        'F2 HAV PRAH- (/ /) stresses obligation. Keep F3 mi-siz light (˘ ˘).',
        'A four-beat recitation can preserve timing without moving the stress off PRAH-.',
    ],
    [
        'Same scan; MILES / GO / be-FORE / SLEEP shift the focus: distance / action / order / rest.',
        'F1 AND MEYELZ (/ /) adds insistence; AND is the full form of weak uhnd.',
    ],
    [
        'Keep the same scan, or choose any of line 15’s emphasis variants.',
        'Renewed resolve, weary repetition, plain restatement or reflective slowing are possible.',
    ],
]

# P = printed punctuation, G = grammatical boundary, V = performed delivery,
# R = rhetorical or sound device with its local evidence and plausible effect.
NOTES = [
    ('. at the end',
     'Sentence closes; the fronted clause ends after “are”.',
     'Flow, or pause after are ‖ before the statement of knowledge.',
     'Inversion + hedge: ownership comes first; “I think” qualifies certainty.'),
    ('; at the end',
     'Main clause closes; the sentence continues through line 4.',
     'A small reset; “though” may sound like an afterthought.',
     'Alliteration: His / house share /h/. The owner is associated with the village.'),
    ('no end mark',
     'Line 4 adds the purpose of stopping →',
     'Carry into To watch, or briefly suspend after here.',
     'Internal rhyme: He / see / me share EE. will / fill links lines 3–4.'),
    ('. at the end',
     'Purpose phrase and sentence close.',
     'Close the thought; stanza silence has no fixed duration.',
     'Alliteration: watch / woods, /w/. Snow filling the woods supplies visual imagery.'),
    ('no end mark',
     '“It” is explained by the following “To stop…” →',
     'Flow onward, or briefly suspend the horse’s imagined judgment.',
     'Anthropomorphism: the speaker attributes “think it queer” to the horse.'),
    ('no end mark',
     'The stopping gains circumstances; location follows →',
     'Flow into Between, or lightly separate the added setting.',
     'Contrast develops: an expected farmhouse is absent from this stopping place.'),
    ('no end mark',
     'The place phrase ends; the time phrase follows →',
     'Possible caesura after woods ‖; a small reset before line 8.',
     'Spatial and visual imagery: woods / frozen lake place the speaker between landmarks.'),
    ('. at the end',
     'Time phrase and the four-line sentence close.',
     'Close or linger on year. Do not add a syllable to evening.',
     'Superlative: “darkest” intensifies the setting; it does not by itself establish hyperbole.'),
    ('no end mark',
     'Main-clause core; the attributed purpose follows →',
     'Flow into To ask, or briefly let the bell action register.',
     'Auditory imagery: harness bells interrupt the scene. he / his / harness echo /h/.'),
    ('. at the end',
     'The purpose and indirect question close the sentence.',
     'A completed thought; no direct question mark is printed.',
     'Personification: “To ask” turns the bell shake into a practical objection.'),
    ('apostrophe in sound’s; no end mark',
     '“sweep / Of…” continues one noun phrase →',
     'Carry sweep into Of; a suspension must preserve their link.',
     'Alliteration + sibilance: sound’s / sweep repeat /s/; /z/ adds a voiced hiss.'),
    ('. at the end',
     'The Of-phrase and sentence close.',
     'A gentle or distinct close; whispering is a reader’s choice.',
     'Metaphorical, tactile imagery: “downy” likens the flake’s softness to down feathers.'),
    ('commas after lovely and deep',
     'Description ends; But introduces a counterstatement →',
     'lovely ‖ dark is optional; the endpoint pause may be light or strong.',
     'Three-part description: lovely, dark, deep; dark / deep alliterate on /d/.'),
    (', at the end',
     '“I have” also governs the following “miles…” phrases →',
     'Light pause, or continue to let obligations accumulate.',
     'Turn / antithesis at But. Parallel noun + infinitive: promises to keep / miles to go.'),
    (', at the end',
     'The miles-phrase ends and is immediately repeated →',
     'Optional pause after go ‖; a short or long gap before line 16.',
     'Anaphoric opening + repeated ending begin the final pair. go recalls rhyme family A.'),
    ('. at the end',
     'Repeated phrase and the entire sentence close.',
     'Firm fall, fading weariness or reflective slowing; none is compulsory.',
     'Immediate full-line repetition (epizeuxis); identical sleep / sleep inside monorhyme.'),
]
NOTES[0] = NOTES[0][:-1] + (
    'Inversion + hedge: ownership comes first; “I think” qualifies certainty. '
    'Whose / His also share /h…z/ across the line openings.',)
NOTES[1] = NOTES[1][:-1] + (
    NOTES[1][-1] + ' Whose / His: '
    + ('pararhyme; ' if 'E7' in OPENING_TYPES else 'opening consonant echo; ')
    + OPENING_IDS + '.',)

PAL = {
    'A': {'ink': '#875c05', 'fill': '#f6e5a7', 'line': '#bfa04d'},
    'B': {'ink': '#286a90', 'fill': '#d9eaf4', 'line': '#7eaec9'},
    'C': {'ink': '#8c4764', 'fill': '#f0dce5', 'line': '#bd8ba0'},
    'D': {'ink': '#256e59', 'fill': '#d6eadd', 'line': '#7eaf99'},
}
C = {'paper': '#faf8f1', 'ink': '#23322f', 'muted': '#626e67',
     'rule': '#d5dad0', 'wash': '#efeee7', 'white': '#fffef9',
     'internal': '#65697d', 'soft': '#f4f3eb', 'opening': '#75617f'}
FONTS = {
    'serif': '/usr/share/fonts/opentype/urw-base35/P052-Roman.otf',
    'serifbold': '/usr/share/fonts/opentype/urw-base35/P052-Bold.otf',
    'italic': '/usr/share/fonts/opentype/urw-base35/P052-Italic.otf',
    'sans': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    'bold': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
}
W, MAX_H, S = 2400, 13500, 2
Image.MAX_IMAGE_PIXELS = 200_000_000
im = Image.new('RGB', (W*S, MAX_H*S), C['paper'])
d = ImageDraw.Draw(im)
fonts = {}
audit = []
section_bounds = []
def col(c): return C.get(c, c)
def font(size, face='sans'):
    key = (size, face)
    if key not in fonts:
        fonts[key] = ImageFont.truetype(FONTS[face], round(size*S))
    return fonts[key]
def width(s, size=25, face='sans'):
    return d.textlength(s, font=font(size, face))/S
def text(x, y, s, size=25, face='sans', fill='ink', anchor='lt', maxw=None):
    if maxw is not None:
        assert width(s, size, face) <= maxw + .1, (s, width(s,size,face), maxw)
    d.text((round(x*S), round(y*S)), s, font=font(size,face), fill=col(fill), anchor=anchor)
def line(x1,y1,x2,y2,fill='rule',weight=1):
    d.line(tuple(round(v*S) for v in (x1,y1,x2,y2)), fill=col(fill), width=max(1,round(weight*S)))
def rect(x,y,w,h,fill,outline=None,r=0,weight=1):
    box = tuple(round(v*S) for v in (x,y,x+w,y+h))
    if r:
        d.rounded_rectangle(box, radius=round(r*S), fill=col(fill) if fill else None,
                            outline=col(outline) if outline else None, width=max(1,round(weight*S)))
    else:
        d.rectangle(box, fill=col(fill) if fill else None, outline=col(outline) if outline else None,
                    width=max(1,round(weight*S)))
def wrap(s,maxw,size=25,face='sans'):
    result=[]
    for raw in s.split('\n'):
        current=''
        for word in raw.split():
            trial=(current+' '+word).strip()
            if current and width(trial,size,face)>maxw:
                result.append(current); current=word
            else: current=trial
        result.append(current)
    return result
def paragraph(x,y,s,maxw,size=25,face='sans',fill='muted',leading=1.32):
    lines=wrap(s,maxw,size,face)
    for j,t in enumerate(lines): text(x,y+j*size*leading,t,size,face,fill,maxw=maxw)
    return y+len(lines)*size*leading
def stress(x,y,strong,fill='ink'):
    if strong: line(x-5,y+4,x+6,y-11,fill,2.2)
    else:
        d.arc(tuple(round(v*S) for v in (x-8,y-10,x+8,y+4)),0,180,
              fill=col('muted'),width=round(1.8*S))
def dotted_rect(x,y,w,h):
    for xx in range(round(x),round(x+w),12):
        line(xx,y,min(xx+5,x+w),y,'muted',1)
        line(xx,y+h,min(xx+5,x+w),y+h,'muted',1)
    for yy in range(round(y),round(y+h),12):
        line(x,yy,x,min(yy+5,y+h),'muted',1)
        line(x+w,yy,x+w,min(yy+5,y+h),'muted',1)
def arrow(x1,y,x2,fill='muted'):
    line(x1,y,x2,y,fill,1.7)
    line(x2-10,y-6,x2,y,fill,1.7); line(x2-10,y+6,x2,y,fill,1.7)
def scheme(x,y,letters,box=43):
    for j,letter in enumerate(letters):
        p=PAL[letter]
        rect(x+j*(box+8),y,box,box,p['fill'],r=5)
        text(x+j*(box+8)+box/2,y+box/2,letter,27,'bold',p['ink'],anchor='mm')
    return x+len(letters)*(box+8)-8
def label(x,y,s):
    rect(x,y,28,28,'wash',r=4)
    text(x+14,y+14,s,18,'bold','muted',anchor='mm')
def note_track(x,y,tag,body,maxw=606,size=24):
    label(x,y,tag)
    return paragraph(x+42,y+1,body,maxw-42,size=size,fill='ink' if tag=='R' else 'muted',leading=1.24)+10
def underline_word(original,token,y,fill='internal',dash=False):
    matches=list(re.finditer(r'(?<!\w)'+re.escape(token)+r'(?!\w)',original))
    for m in matches:
        x=BODY_X+width(original[:m.start()],BODY_SIZE,'serif')
        end=x+width(token,BODY_SIZE,'serif')
        if dash:
            for a in range(round(x),round(end),10): line(a,y,min(a+5,end),y,fill,1.8)
        else: line(x,y,end,y,fill,1.8)

# The header teaches the single system used throughout the sheet.
text(100,55,'ROBERT FROST',25,'bold','muted')
text(2300,55,'METER · VOICE · RHYME · RHETORIC',23,'sans','muted',anchor='rt')
text(100,112,'Stopping by Woods on a Snowy Evening',91,'serif',maxw=2200)
text(100,226,'Iambic tetrameter · four feet, eight syllables per line · four quatrains',31,'sans','muted')
line(100,284,2300,284,'rule',1.4)

text(100,315,'ONE GRID, SEVERAL DEFENSIBLE READINGS  [1]',23,'bold','ink')
text(100,364,'Expected meter',25,'sans','muted')
for foot in range(4):
    fx=360+foot*147
    rect(fx,351,132,56,'wash',r=4)
    stress(fx+38,381,False); stress(fx+94,381,True)
text(1004,365,'˘ light   / prominent   | foot boundary   ‖? optional performed pause',26,'sans','ink',maxw=1296)
y=paragraph(100,436,
    'The pronunciation grid gives one reading; ALT gives other defensible choices for every line. F1–F4 identify the foot to replace; unmentioned feet stay as shown. Capitals indicate relative prominence, not four equally loud beats.',
    1060,size=25)
intro_right=paragraph(1240,436,
    'P = printed punctuation. G = grammar. V = optional vocal delivery. R = rhetorical device with textual evidence. Gray S brackets group whole sentences. A pause has no fixed duration; a line break does not require silence.',
    1060,size=25)
y=max(y,intro_right,570)
paragraph(100,y+12,
    'Alternatives may combine. Stress, tempo, pitch and intention allow indefinitely many performances; this sheet maps the principal defensible choices rather than claiming a finite list of all possible readings.',
    2200,size=24,fill='muted')
y+=103

text(100,y,'PRONUNCIATION KEY · ONE BROAD RHOTIC U.S. MODEL  [2]',23,'bold')
y+=45
paragraph(100,y,
    'Every pronunciation syllable uses the same sound key. Hyphens join syllables of a word, even across a foot. IPA values clarify the key; vowel length marks are omitted consistently. English r is pronounced.',
    2200,size=24)
y+=82
keys=[('a','/æ/','cat'),('ah','/ɑ/','father'),('e','/ɛ/','bed'),('ee','/i/','see'),('i','/ɪ/','sit'),('u','/ʌ/','cup'),
      ('uh','/ə/','about'),('oo','/u/','moon'),('uu','/ʊ/','book'),('ay','/eɪ/','day'),('eye','/aɪ/','eye'),('oh','/oʊ/','go'),
      ('ow','/aʊ/','now'),('ahr','/ɑr/','car'),('or','/ɔr/','horse'),('eer','/ɪr/','near'),('air','/ɛr/','there'),('er','/ɚ/','other')]
for n,(symbol,ipa,example) in enumerate(keys):
    xx=100+(n%6)*371
    yy=y+(n//6)*54
    rect(xx,yy,345,44,'wash',r=5)
    text(xx+12,yy+11,symbol,24,'bold')
    text(xx+92,yy+11,ipa,23,'sans','muted')
    text(xx+207,yy+11,example,23,'sans','muted')
y+=178
y=paragraph(100,y,
    'Consonants: dh = /ð/ this; th = /θ/ thin; ng = /ŋ/ sing; j = /dʒ/ jam; ch = /tʃ/; sh = /ʃ/; kw = /kw/. Other consonants use their usual values. THINGK includes /ŋk/. MEYELZ spells /maɪlz/ (“miles”).',
    2200,size=23)+13
y=paragraph(100,y,
    'Weak forms are intentional: the = dhuh / dhee; are = er / ahr; to = tuh / too; of = uhv / uv; and = uhnd / and; some = suhm / sum. with uses voiced dh here; th is also possible. Flaps and other fine accent details are not separately transcribed.',
    2200,size=23)+28
line(100,y,2300,y,'rule',1.4)
y+=32
text(100,y,'FOLLOW THE COLORED ENDINGS',23,'bold')
sx=100
for n,pat in enumerate(('AABA','BBCB','CCDC','DDDD')):
    ex=scheme(sx,y+46,pat)
    if n<3: arrow(ex+17,y+67,ex+69)
    sx=ex+89
paragraph(1390,y+1,
    'Highlights mark the spelling that carries the rhyme. Underlines mark interior echoes. Brackets join related line endings; the last pair also receives a nested bracket. Violet links Whose / His at the openings.',
    910,size=24)
y+=128
for n,fam in enumerate('ABCD'):
    p=PAL[fam]; xx=100+n*550
    text(xx,y,f'{fam}  {SOUNDS[fam]}  {IPA[fam]}',27,'bold',p['ink'])
    examples={'A':'know · though · snow','B':'here · queer · near · year',
              'C':'lake · shake · mistake · flake','D':'sweep · deep · keep · sleep'}
    text(xx,y+43,examples[fam],23,'sans','muted',maxw=530)
y+=103
line(100,y,2300,y,'rule',1.4)
y+=35

BODY_X, BODY_SIZE = 170, 52
GRID_X, GRID_W = 170, 1344
CELL = GRID_W/8
BRACKET_X, NEST_X = 1597, 1625
SIDE_X, SIDE_W = 1690, 610
STANZA_HEADS = [
    ('I','Observation and ownership'),
    ('II','The horse’s imagined objection'),
    ('III','The interruption, then the ambient sound'),
    ('IV','Attraction, obligation and repetition'),
]
SENTENCE_GROUPS = [[(0,0,'S1'),(1,3,'S2')],[(0,3,'S3')],
                   [(0,1,'S4'),(2,3,'S5')],[(0,3,'S6')]]
OPTIONAL_PAUSES = {0:4,6:4,12:5,14:4,15:4}

for st in range(4):
    section_top=y
    roman,title=STANZA_HEADS[st]
    primary='ABCD'[st]
    pp=PAL[primary]
    text(100,y,roman,41,'serifbold')
    text(170,y+4,title,34,'serifbold')
    scheme(1400,y-3,('AABA','BBCB','CCDC','DDDD')[st],box=35)
    text(SIDE_X,y+9,'PUNCTUATION · GRAMMAR · VOICE · DEVICE',17,'bold','muted',maxw=SIDE_W)
    y+=69
    text(170,y,'TEXT / PRONUNCIATION / ALTERNATIVE EMPHASIS',18,'bold','muted')
    for foot in range(4):
        text(GRID_X+(foot+.5)*GRID_W/4,y+35,f'FOOT {foot+1}',16,'sans','muted',anchor='mt')
    y+=70
    group_y=[]
    line_positions=[]
    opening_pair_y=[]
    for row in range(4):
        i=st*4+row
        top=y
        original=POEM[i]
        base=top+44
        family=RHYMES[i]; p=PAL[family]
        stem=original.rstrip('.,;')
        tail=TAILS[i]
        assert stem.endswith(tail)
        start=len(stem)-len(tail)
        hx=BODY_X+width(original[:start],BODY_SIZE,'serif')
        hw=width(tail,BODY_SIZE,'serif')
        rect(hx-4,base-41,hw+8,49,p['fill'],r=4)
        text(140,base-3,f'{i+1:02}',21,'sans','muted',anchor='rs')
        text(BODY_X,base,original,BODY_SIZE,'serif',anchor='ls',maxw=GRID_W)
        endpoint=BODY_X+width(original,BODY_SIZE,'serif')
        assert endpoint < BRACKET_X-40,(i,endpoint)
        if family==primary:
            line(endpoint+18,base-15,BRACKET_X,base-15,p['line'],1.3)
            group_y.append(base-15)
        else:
            text(endpoint+22,base-6,f'→ {family}',24,'bold',p['ink'],anchor='ls')
        line_positions.append((base-15,endpoint))
        if i in (0,1):
            underline_word(original, 'Whose' if i==0 else 'His', base+12, 'opening')
            opening_pair_y.append(base+12)
        if i==1:
            for token in ('His','is'): underline_word(original,token,base+7,dash=True)
        if i==2:
            for token in ('He','see','me'): underline_word(original,token,base+7)
            underline_word(original,'will',base+7,dash=True)
        if i==3: underline_word(original,'fill',base+7,dash=True)
        if i in (14,15): underline_word(original,'go',base+7,PAL['A']['ink'])

        grid_y=top+70
        for foot in range(4):
            fx=GRID_X+foot*GRID_W/4
            rect(fx+2,grid_y,GRID_W/4-4,79,'white' if foot%2==0 else 'wash',r=5)
        for j in (2,4,6):
            xx=GRID_X+j*CELL
            line(xx,grid_y+5,xx,grid_y+73,'rule',1.5)
        if i in (7,13): dotted_rect(GRID_X+4*CELL+3,grid_y,2*CELL-6,79)
        stresses=[]
        for j,sy in enumerate(SPEAK[i]):
            cx=GRID_X+(j+.5)*CELL
            strong=sy.isupper()
            stresses.append('/' if strong else 'u')
            stress(cx,grid_y+24,strong)
            face='bold' if strong else 'sans'
            if j==7:
                ending=SOUNDS[family]
                assert sy.endswith(ending),(i,sy,ending)
                total=width(sy,29,face)
                pre=sy[:-len(ending)]
                rect(cx-total/2+width(pre,29,face)-3,grid_y+43,
                     width(ending,29,face)+6,34,p['fill'],r=3)
            text(cx,grid_y+46,sy,29,face,'ink' if strong else 'muted',anchor='mt',maxw=CELL-5)
            if j in JOINS[i]:
                xx=GRID_X+(j+1)*CELL
                if j in (1,3,5): rect(xx-8,grid_y+54,16,17,'paper')
                text(xx,grid_y+62,'-',23,'sans','muted',anchor='mm')
        if i in OPTIONAL_PAUSES:
            px=GRID_X+OPTIONAL_PAUSES[i]*CELL
            rect(px-21,grid_y+7,42,33,'paper',r=3)
            text(px,grid_y+24,'‖?',20,'sans','muted',anchor='mm')
        ay=grid_y+98
        text(170,ay+1,'ALT',17,'bold','muted')
        for alt in ALTS[i]:
            ay=paragraph(231,ay,alt,1283,size=24,fill='ink',leading=1.27)+7

        ny=top+3
        for tag,body in zip(('P','G','V','R'),NOTES[i]):
            ny=note_track(SIDE_X,ny,tag,body,SIDE_W,size=24)
        row_end=max(ay,ny)+24
        line(1653,top-2,1653,row_end-16,'rule',1)
        if row<3: line(170,row_end,2300,row_end,'rule',.8)
        audit.append({'line':i+1,'text':original,'rhyme':family,
                      'pronunciation':SPEAK[i],'joins':JOINS[i],
                      'stress':' '.join(stresses),'alternatives':ALTS[i],
                      'P':NOTES[i][0],'G':NOTES[i][1],'V':NOTES[i][2],'R':NOTES[i][3],
                      'y_top':top,'y_bottom':row_end})
        y=row_end+23
    line(BRACKET_X,min(group_y),BRACKET_X,max(group_y),pp['line'],2.4)
    for endpoint_y in (min(group_y),max(group_y)):
        line(BRACKET_X-12,endpoint_y,BRACKET_X,endpoint_y,pp['line'],2.4)
    if st==0 and len(opening_pair_y)==2:
        line(157,opening_pair_y[0],157,opening_pair_y[1],'opening',1.5)
        for oy in opening_pair_y:
            line(157,oy,168,oy,'opening',1.5)
    for start_row,end_row,name in SENTENCE_GROUPS[st]:
        sy=line_positions[start_row][0]
        ey=line_positions[end_row][0]
        if start_row==end_row:
            sy-=15; ey+=15
        line(96,sy,96,ey,'muted',1.2)
        line(96,sy,107,sy,'muted',1.2)
        line(96,ey,107,ey,'muted',1.2)
        text(80,(sy+ey)/2,name,18,'bold','muted',anchor='rm')
    if st==3:
        y15,y16=line_positions[2][0],line_positions[3][0]
        line(NEST_X,y15,NEST_X,y16,pp['ink'],2.2)
        line(BRACKET_X+3,y15,NEST_X,y15,pp['ink'],2.2)
        line(BRACKET_X+3,y16,NEST_X,y16,pp['ink'],2.2)
    bridges=[
        ('B','here → queer · near · year','The third ending becomes the next stanza’s main rhyme.'),
        ('C','lake → shake · mistake · flake','The same interlocking relation carries the poem forward.'),
        ('D','sweep → deep · keep · sleep','The new sound will occupy every ending of the final stanza.'),
        ('D','deep · keep · sleep · sleep','DDDD closes the chain; sleep / sleep forms a nested identical pair.'),
    ]
    fam,phrase,explanation=bridges[st]
    text(170,y+2,phrase,28,'bold',PAL[fam]['ink'])
    tx=170+width(phrase,28,'bold')+35
    paragraph(tx,y+4,explanation,2300-tx,size=24)
    y+=71
    line(100,y,2300,y,'rule',1.5)
    section_bounds.append((section_top,y))
    y+=38

# The full upper triangle records every occurrence pair once. A cell is an
# aggregate of the existing English schemas, not a rating of rhyme strength.
sound_map_top=y
text(100,y,'ALL-WORD RHYME MAP  [9]',34,'serifbold')
y+=57
y=paragraph(100,y,
    'All 108 word occurrences are compared with every later occurrence: 108 × 107 ÷ 2 = 5,778 pairs. Shading counts dictionary-dependent E1–E22 schema matches. Categories may depend on different dictionary readings.',
    2200,size=25)+22
text(100,y,f'{DISPLAY_MATCHES:,} PAIRS WITH DISPLAYED MATCHES',22,'bold','opening')
text(2300,y,'A CELL COUNTS CATEGORIES, NOT RHYME STRENGTH',20,'bold','muted',anchor='rt')
y+=42

# A perceptually ordered neutral-violet scale keeps A–D reserved for the poem.
def mix_color(a,b,t):
    aa=tuple(int(a[k:k+2],16) for k in (1,3,5))
    bb=tuple(int(b[k:k+2],16) for k in (1,3,5))
    return '#' + ''.join(f'{round(x+(z-x)*t):02x}' for x,z in zip(aa,bb))

COUNT_COLORS={0:C['white']}
for count in range(1,MAX_TYPES+1):
    COUNT_COLORS[count]=mix_color('#eeebf0','#574460',
                                  (count-1)/max(1,MAX_TYPES-1))
legend_x=320
text(100,y+10,'TYPES / PAIR',15,'bold','muted')
for count in range(MAX_TYPES+1):
    xx=legend_x+count*73
    rect(xx,y,32,32,COUNT_COLORS[count],'rule',r=2,weight=.7)
    text(xx+42,y+7,str(count),18,'sans','muted')
key_end=legend_x+(MAX_TYPES+1)*73
text(key_end+16,y+9,'0 = no displayed match',17,'sans','muted')
y+=67

MAP_X, MAP_CELL, MAP_N = 320,18,108
MAP_W=MAP_CELL*MAP_N
map_y=y+62
map_bottom=map_y+MAP_W
text(100,y+4,'OCCURRENCE / WORD',14,'bold','muted')
text(308,y+30,'LINE.WORD',11,'sans','muted',anchor='rt')

# Line bands make both axes traceable back to the reading above.
line_groups=[]
for line_number in range(1,17):
    indices=[k for k,token in enumerate(TOKENS) if token[1]==line_number]
    assert indices and indices==list(range(indices[0],indices[-1]+1))
    line_groups.append((line_number,indices[0],indices[-1]+1))
for line_number,start,end in line_groups:
    xx=MAP_X+start*MAP_CELL
    band_fill='wash' if line_number%2 else 'soft'
    rect(xx,y,(end-start)*MAP_CELL,23,band_fill)
    text(xx+(end-start)*MAP_CELL/2,y+11,f'L{line_number:02}',13,
         'bold','muted',anchor='mm')
    rect(96,map_y+start*MAP_CELL,216,(end-start)*MAP_CELL,band_fill)

# The lower half has no pairs: duplicates and the diagonal are excluded.
rect(MAP_X,map_y,MAP_W,MAP_W,'wash')
for (i,j),mask in DISPLAY_PAIRS.items():
    xx=MAP_X+(j-1)*MAP_CELL
    yy=map_y+(i-1)*MAP_CELL
    rect(xx,yy,MAP_CELL,MAP_CELL,COUNT_COLORS[mask.bit_count()],
         '#e4e1e6',weight=.5)
for k in range(MAP_N):
    xx=MAP_X+k*MAP_CELL
    yy=map_y+k*MAP_CELL
    rect(xx,yy,MAP_CELL,MAP_CELL,'rule')

# Boundaries stay in the upper triangle, leaving the lower legend clean.
for line_number,start,end in line_groups:
    if start:
        xx=MAP_X+start*MAP_CELL
        yy=map_y+start*MAP_CELL
        strong=(line_number-1)%4==0
        rule_color='#adada9' if strong else '#d1cfd2'
        weight=1.4 if strong else .8
        line(xx,map_y,xx,yy,rule_color,weight)
        line(xx,yy,MAP_X+MAP_W,yy,rule_color,weight)
        line(96,yy,312,yy,rule_color,weight)
rect(MAP_X,map_y,MAP_W,MAP_W,None,'rule',weight=1)

for k,(word,line_number,position) in enumerate(TOKENS):
    cy=map_y+(k+.5)*MAP_CELL
    cx=MAP_X+(k+.5)*MAP_CELL
    display_word=word[0].upper()+word[1:] if position==1 else word
    highlighted=k in (0,8)
    fill='opening' if highlighted else 'muted'
    face='bold' if highlighted else 'sans'
    if highlighted:
        rect(96,cy-MAP_CELL/2,216,MAP_CELL,'#e6dfe9')
        rect(cx-MAP_CELL/2,y+27,MAP_CELL,25,'#e6dfe9')
    text(102,cy,f'{k+1:03}',12,face,fill,anchor='lm')
    text(135,cy,display_word,13,face,fill,anchor='lm',maxw=125)
    text(306,cy,f'{line_number:02}.{position}',11,'sans',fill,anchor='rm')
    text(cx,y+40,str(k+1),9,face,fill,anchor='mm')

# The selected opening echo is marked without connecting thousands of words.
opening_x=MAP_X+8*MAP_CELL
rect(opening_x-.5,map_y-.5,MAP_CELL+1,MAP_CELL+1,None,'opening',weight=2)

# Use the otherwise empty lower triangle for the aggregate category key.
active_types=[f'E{k}' for k in range(1,23) if TYPE_COUNTS[f'E{k}']]
key_x=390
key_y=map_y+930
key_w=810
assert key_x+key_w < MAP_X+(key_y-map_y)-10
text(key_x,key_y,'MATCHING PAIRS BY CATEGORY',23,'bold','ink')
key_y+=42
key_y=paragraph(key_x,key_y,
    'The same pair may appear in several totals. Names and IDs follow the Codex Musica English registry.',
    key_w,size=20,fill='muted',leading=1.24)+22
text(key_x,key_y,'ID',16,'bold','muted')
text(key_x+61,key_y,'CATEGORY',16,'bold','muted')
text(key_x+key_w,key_y,'PAIRS',16,'bold','muted',anchor='rt')
key_y+=31
line(key_x,key_y-8,key_x+key_w,key_y-8,'rule',1)
for category in active_types:
    name=CATEGORIES[category]['name']
    name_lines=wrap(name,key_w-150,20)
    row_h=max(31,len(name_lines)*25+5)
    text(key_x,key_y,category,19,'bold','opening')
    for r,name_line in enumerate(name_lines):
        text(key_x+61,key_y+r*25,name_line,20,'sans','ink')
    text(key_x+key_w,key_y,f'{TYPE_COUNTS[category]:,}',20,'sans','ink',anchor='rt')
    key_y+=row_h
line(key_x,key_y+2,key_x+key_w,key_y+2,'rule',1)
key_y+=24
key_y=paragraph(key_x,key_y,
    f'Outlined cell: Whose 001 ↔ His 009.  {OPENING_IDS}.',
    key_w,size=20,fill='opening',leading=1.24)
assert key_y < map_bottom-25,(key_y,map_bottom)

y=map_bottom+32
y=paragraph(100,y,
    'Method: existing General American dictionary readings; earlier → later orientation for directional types. E10 includes E4 or E5, so the categories are not independent; E20 is spelling-based. Empty-only consonant agreements are omitted from shading and retained in the pair data. E6 requires a whole-line comparison; E17 needs a performance; E21 needs historical pronunciation; E22 has no executable rule. E18 is partly unresolved. White cells have no displayed match; unresolved tests are not negative findings.',
    2200,size=23,fill='muted',leading=1.3)+26
line(100,y,2300,y,'rule',1.4)
sound_map_bottom=y
y+=38

# One shared matrix makes classification overlap explicit.
matrix_top=y
text(100,y,'HOW RHYME LABELS OVERLAP  [3–4]',34,'serifbold')
y+=55
y=paragraph(100,y,
    'Read across a row: the labels accumulate because they describe different features. Placement, sound match, stressed ending and stanza organization are separate questions.',
    2200,size=25)+25
cols=[100,605,861,1295,1652,2300]
headings=['EXAMPLE / SOUND','PLACEMENT','SOUND RELATION','ENDING','ORGANIZATION']
rect(100,y,2200,53,'wash',r=4)
for j,h in enumerate(headings): text(cols[j]+15,y+17,h,19,'bold','muted')
y+=64
matrix=[
    ('A  know / though / snow · OH','End','Perfect / full','Masculine','Stanza I: AABA'),
    ('B  here / queer / near / year · EER','End','Perfect / full','Masculine','Interlocks I → II'),
    ('C  lake / shake / mistake / flake · AYK','End','Perfect / full','Masculine','Interlocks II → III'),
    ('D  sweep / deep / keep / sleep · EEP','End','Perfect across different words','Masculine','III → IV; IV is monorhyme'),
    ('D  sleep / sleep · same word','End','Identical-word rhyme','Masculine','Nested inside DDDD'),
    ('He / see / me · EE; will / fill · IL','Internal','Matching vowel and tail','Prominence varies','Within L3; across L3–4'),
    ('go · OH, echoing know / though / snow','Internal ↔ end','Perfect sound match','Stressed go','Recalls A inside L15–16'),
]
for idx,row in enumerate(matrix):
    row_heights=[]
    for j,cell in enumerate(row):
        row_heights.append(len(wrap(cell,cols[j+1]-cols[j]-30,23,'bold' if j==0 else 'sans'))*23*1.28)
    rh=max(row_heights)+28
    if idx%2==1: rect(100,y,2200,rh,'soft')
    for j,cell in enumerate(row):
        fill=PAL[row[0][0]]['ink'] if j==0 and row[0][0] in PAL else 'ink'
        paragraph(cols[j]+15,y+14,cell,cols[j+1]-cols[j]-30,size=23,
                  face='bold' if j==0 else 'sans',fill=fill,leading=1.28)
    line(100,y+rh,2300,y+rh,'rule',.8)
    y+=rh
y+=24
y=paragraph(100,y,
    'Perfect / full rhyme matches the last stressed vowel and every sound after it. End / internal locate the match. Masculine classifies the stressed ending. Monorhyme describes a stanza using one rhyme family.',
    2200,size=24)+16
y=paragraph(100,y,
    '“Masculine” means the rhyme ends on a stressed syllable: mis-TAKE qualifies even though the word has two syllables. In D, different words rhyme perfectly; sleep / sleep is the more specific identical-word case. One repeated pair also belongs to a masculine, end-rhymed, monorhymed stanza.',
    2200,size=24)+16
y=paragraph(100,y,
    'Smaller echoes: His / is can share IZ in full speech; house returns inside farmhouse. only / easy / downy / lovely share a weak final EE, a vowel echo rather than a full rhyme. These interior echoes do not change the end-rhyme scheme. know / though / snow rhyme by sound despite unlike spellings.',
    2200,size=23)+30
line(100,y,2300,y,'rule',1.4)
section_bounds.append((matrix_top,y))
y+=38

closing_top=y
text(100,y,'BOUNDARIES, RHETORICAL TURNS AND INTERPRETIVE CHOICES  [5–7]',34,'serifbold')
y+=64
left_y=y
left_y=paragraph(100,left_y,'PUNCTUATION, SYNTAX AND SILENCE',1030,size=22,face='bold',fill='ink')+17
left_y=paragraph(100,left_y,
    'The six sentences span lines 1 | 2–4 | 5–8 | 9–10 | 11–12 | 13–16. A semicolon ends a clause in line 2; a comma ends the main clause in line 13. Neither ends its sentence in this supplied text.',
    1030,size=24)+18
left_y=paragraph(100,left_y,
    'Enjambment: syntax continues through unpunctuated ends at 3, 5, 6, 7, 9 and 11. The tightest noun–modifier link is “sweep / Of…”. Some other line ends already complete a smaller unit, even while the sentence continues.',
    1030,size=24)+18
left_y=paragraph(100,left_y,
    'Caesura: an audible pause within a line. After are (1), woods (7), lovely (13) or go (15–16), a reader can pause or flow. Only lovely has a printed comma at that internal position. Lengthening or a pitch change can mark a boundary without silence.',
    1030,size=24)+18
left_y=paragraph(100,left_y,
    'Dotted feet in 8 and 14 separate the expected beat from light speech. EEV-ning has two syllables; PRAH-mi-siz has three. A metrical position, word stress and emotional emphasis are related but distinct.',
    1030,size=24)

right_y=y
right_y=paragraph(1240,right_y,'WHAT THE RHETORIC DOES',1060,size=22,face='bold',fill='ink')+17
right_y=paragraph(1240,right_y,
    'Observation and ownership (1–4) → imagined practical objection (5–10) → renewed sensory attention (11–13) → obligation and self-address (14–16). “But” is the explicit turn. Repeated woods links the opening, middle and final assessment.',
    1060,size=24)+18
right_y=paragraph(1240,right_y,
    'Sound devices overlap too: sound’s / sweep is both alliteration and sibilance; the EE of see, sweep, easy, deep, keep and sleep supplies assonance across the poem. Whose begins with /h/, so Whose woods is not /w/ alliteration.',
    1060,size=24)+18
right_y=paragraph(1240,right_y,
    'The last two lines are one repeated event viewed several ways: full-line repetition / epizeuxis; anaphoric beginning; repeated ending; identical end rhyme. A second delivery can renew resolve, expose weariness, or make the statement newly reflective.',
    1060,size=24)+18
right_y=paragraph(1240,right_y,
    'Interpretive alternatives: literal travel before sleep; duties before rest; a larger life-journey or mortality association. These readings may coexist. The words do not establish “sleep = death” or prove that the two sleeps change meaning. The poem does not narrate a departure.',
    1060,size=24)
y=max(left_y,right_y)+35
line(100,y,2300,y,'rule',1.4)
y+=32
text(100,y,'TEXT, ANALYSIS AND SOURCES',20,'bold','muted')
y+=38
y=paragraph(100,y,
    'Wording and punctuation follow the supplied poem, including deep, in line 13. Stress alternatives, grammar labels and device-to-effect connections are close readings offered here; they are not attributed to a recording by Frost. Device labels describe evidence; suggested effects and symbolic readings remain interpretations.',
    2200,size=22)+18
sources=[
    '[1] Harvard · Guide to Prosody · poetry.harvard.edu/guide-prosody',
    '[2] Cambridge · English pronunciation; evening, promise, whose · dictionary.cambridge.org/us/pronunciation/',
    '[3] Academy of American Poets · Rhyme · poets.org/glossary/rhyme',
    '[4] University of Toronto RPO · Rhyme · rpo.library.utoronto.ca/glossary/rhyme',
    '[5] Harvard · Guide to Poetic Terms · poetry.harvard.edu/guide-poetic-terms',
    '[6] Academy of American Poets · Enjambment; Caesura · poets.org/glossary/enjambment · /caesura',
    '[7] BYU · Silva Rhetoricae · anastrophe; antithesis; anaphora; epizeuxis; figures of sound · rhetoric.byu.edu',
    '[8] Poem text · Poetry Foundation · poetryfoundation.org/poems/42891/stopping-by-woods-on-a-snowy-evening',
    f'[9] Codex Musica · English E1–E22 + relation engine · github.com/WeningerII/CodexMusica · commit {SOURCE_COMMIT[:12]}',
]
for source in sources:
    text(100,y,source,20,'sans','muted',maxw=2200)
    y+=32
H=round(y+60)
assert H<MAX_H,(H,MAX_H)
assert len(audit)==16
for i,a in enumerate(audit):
    assert len(a['pronunciation'])==8
    assert a['text']==POEM[i]
    assert a['stress'].count('/')==(3 if i in (7,13) else 4)

im=im.crop((0,0,W*S,H*S))
meta=PngImagePlugin.PngInfo()
meta.add_text('Title','Stopping by Woods on a Snowy Evening — Meter, pronunciation, rhyme and rhetoric')
meta.add_text('Author','Robert Frost; annotations are editorial readings')
meta.add_text('Poem','\n\n'.join('\n'.join(POEM[i:i+4]) for i in range(0,16,4)))
meta.add_text('Description','Four-foot pronunciation and scansion for all sixteen lines; alternative emphasis; a complete consistent rhotic US respelling key; colored end-rhyme highlights and brackets; full 108-occurrence upper-triangle map of all 5,778 pairs showing counts of dictionary-dependent E1–E22 schema matches after empty-only consonant agreement flags are removed; overlapping rhyme classifications; punctuation, grammar and optional performance distinguished; rhetorical devices with evidence and interpretive qualifications.')
meta.add_text('Analysis',json.dumps(audit,ensure_ascii=False))
meta.add_text('Sources','\n'.join(sources))
meta.add_text('PairAnalysis',json.dumps({'source':PAIR_DATA['source'],
    'method':PAIR_DATA.get('method',{}),'occurrences':len(TOKENS),
    'unordered_pairs':len(RAW_PAIRS),'displayed_pairs':DISPLAY_MATCHES,
    'displayed_category_counts':TYPE_COUNTS,'max_types_per_pair':MAX_TYPES,
    'opening_types':OPENING_TYPES,'data_file':PAIR_PATH.name,
    'data_sha256':PAIR_SHA256},ensure_ascii=False))
meta.add_text('SourceURLs','\n'.join(
    f'https://github.com/WeningerII/CodexMusica/blob/{SOURCE_COMMIT}/lyric-harness/{path}'
    for path in ('quality/canon_index.tsv','quality/relations.py','quality/phonology/eng.py')))
out=ROOT/'frost_full_sound_study.png'
temp=ROOT/'frost_full_sound_study_staged.png'
im.save(temp,pnginfo=meta,optimize=True,dpi=(240,240))
with Image.open(temp) as checked:
    checked.load()
    assert checked.size==(W*S,H*S)
    assert checked.info['Poem']=='\n\n'.join('\n'.join(POEM[i:i+4]) for i in range(0,16,4))
    assert len([s for s in checked.info['Poem'].splitlines() if s])==16
temp.replace(out)
im.resize((1200,round(H/2)),Image.Resampling.LANCZOS).save(ROOT/'full_sound_preview.png')
im.crop((0,0,W*S,round(section_bounds[0][0]*S))).resize((1600,round(section_bounds[0][0]*1600/W)),Image.Resampling.LANCZOS).save(ROOT/'full_sound_key.png')
for n,(top,bottom) in enumerate(section_bounds):
    crop=im.crop((20*S,round((top-15)*S),2320*S,round((bottom+15)*S)))
    crop.resize((1680,round(crop.height*1680/crop.width)),Image.Resampling.LANCZOS).save(ROOT/f'full_sound_section_{n+1}.png')
crop=im.crop((80*S,round((sound_map_top-15)*S),2320*S,round((sound_map_bottom+15)*S)))
crop.resize((2400,round(crop.height*2400/crop.width)),Image.Resampling.LANCZOS).save(ROOT/'full_sound_map.png')
crop=im.crop((80*S,round((closing_top-15)*S),2320*S,H*S))
crop.resize((1680,round(crop.height*1680/crop.width)),Image.Resampling.LANCZOS).save(ROOT/'full_sound_closing.png')
(ROOT/'full_sound_audit.json').write_text(json.dumps({'dimensions':im.size,
    'lines':audit,'section_bounds':section_bounds,'height':H,
    'sound_map_bounds':[sound_map_top,sound_map_bottom],
    'source_commit':SOURCE_COMMIT,'pair_data_sha256':PAIR_SHA256,
    'occurrences':len(TOKENS),'pairs':len(RAW_PAIRS),
    'displayed_pairs':DISPLAY_MATCHES,'displayed_category_counts':TYPE_COUNTS,
    'opening_types':OPENING_TYPES,'max_types_per_pair':MAX_TYPES},ensure_ascii=False,indent=2))
print(json.dumps({'path':str(out),'dimensions':im.size,'bytes':out.stat().st_size,
                  'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'height':H}))

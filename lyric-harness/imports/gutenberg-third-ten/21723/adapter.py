#!/usr/bin/env python3
"""Offline source-specific extraction; source-defined work boundaries only."""
import gzip, hashlib, json, re, sys
from pathlib import Path
from bs4 import BeautifulSoup
HERE=Path(__file__).resolve().parent
ID='21723'
SHA='1bc24def9759cb384153ee07d02539f79e21a31d62206ab109dff5582004c560'
URL=f'https://www.gutenberg.org/files/{ID}/{ID}-h/{ID}-h.htm'
EXCLUSIONS={'THE COWBOY OFF GUARD': 'section_epigraph: unheaded prefatory verse, not a separately titled work.', 'COWBOY TYPES': 'section_epigraph: unheaded prefatory verse, not a separately titled work.', 'WHISKEY BILL,— A FRAGMENT': 'incomplete_source: title explicitly identifies a fragment.', 'BRONCHO VERSUS BICYCLE': 'long_narrative_poem: extended comic cowboy story; excluded intact.', 'LASCA': 'long_narrative_poem: extended tragic cowboy narrative; excluded intact.', 'MARTA OF MILRONE': 'long_narrative_poem: extended narrative of Marta; excluded intact.', "THE CLOWN'S BABY": 'long_narrative_poem: extended narrative yarn; excluded intact.'}
def clean(node):
    n=BeautifulSoup(str(node),'html.parser')
    for br in n.find_all('br'):br.replace_with(' ')
    for x in n.select('.pagenum,.pageno,.fnanchor,a[href^="#footnote"],a[href^="#Footnote"],a[href^="#f"]'):x.decompose()
    return re.sub(r'\s+',' ',n.get_text().replace('\n',' ')).strip()
def extract(path=None):
    raw=gzip.decompress((Path(path) if path else HERE/'source.html.gz').read_bytes())
    assert hashlib.sha256(raw).hexdigest()==SHA
    s=BeautifulSoup(raw,'html.parser');rows=[]
    heads=s.select('h1' if ID=='50666' else 'h3,h4')
    for h in heads:
        title=clean(h);blocks=[];notes=[];author='Charles Godfrey Leland' if ID=='50666' else 'Anonymous / traditional'
        if ID=='50666' and title in ('CONTENTS','APPENDIX','TRANSCRIBER NOTES'):continue
        start=h.parent if ID=='50666' else h
        for n in start.find_next_siblings():
            if (ID=='50666' and n.find('h1')) or (ID!='50666' and n.name in ('h2','h3','h4')):break
            if ID=='1030':
                if n.name=='p' and 'poetry' in n.get('class',[]):
                    c=BeautifulSoup(str(n),'html.parser')
                    for junk in c.select('.pagenum,a[href^="#footnote"],a[href^="#Footnote"]'):junk.decompose()
                    for br in c.find_all('br'):br.replace_with('\n')
                    blocks.append('\n'.join(re.sub(r'\s+',' ',l).strip() for l in c.get_text().split('\n') if l.strip()))
                elif n.name in ('p','blockquote'):notes.append(clean(n))
            elif ID=='21723':
                if n.name=='div' and 'poem' in n.get('class',[]):
                    for stanza in n.select('.stanza'):
                        lines=[]
                        for span in stanza.find_all('span',recursive=False):
                            if not any(re.fullmatch(r'i\d+',c) for c in span.get('class',[])):continue
                            text=clean(span)
                            if text:lines.append(text)
                        if lines:blocks.append('\n'.join(lines))
                elif n.name=='p':notes.append(clean(n))
            else:
                if n.name=='div' and 'poetry-container' in n.get('class',[]):
                    lines=[clean(p) for p in n.select('p.line0')];blocks.append('\n'.join(x for x in lines if x))
                elif n.name=='p' and any(c.startswith('dramaline') for c in n.get('class',[])):
                    if 'dramaline-cont' in n.get('class',[]) or not blocks:blocks.append('')
                    text=clean(n)
                    if text:blocks[-1]+=('\n' if blocks[-1] else '')+text
                elif n.name=='p':notes.append(clean(n))
        blocks=[x for x in blocks if x.strip()]
        if not blocks:continue
        ordinal=len(rows)+1
        if ID=='21723':
            # Printed terminal author credit is not a sung line; explicit reviewed mapping below.
            credit=CREDITS.get(title)
            if credit:
                assert blocks[-1].endswith(credit),(title,credit)
                blocks[-1]=blocks[-1][:-len(credit)].rstrip();author=AUTHOR_OVERRIDES.get(title,credit.rstrip('.'))
        if ID=='50666' and title in ('THE MERMAID','TIME FOR US TO GO','ROLLING OVER','JACK OF ALL TRADES'):author='Anonymous / traditional'
        if title == "RIDIN' UP THE ROCKY TRAIL FROM TOWN":
            k=next(i for i,b in enumerate(blocks) if b.startswith("WE'RE the children of the open"))
            notes.append('Excluded prefatory Ballad of Billy Leamont fragment: '+'\n\n'.join(blocks[:k]))
            notes.append('Source footnote 5: This fragment is not included in Mr. Clark’s poem.')
            blocks=blocks[k:]
        text='\n\n'.join(x for x in blocks if x)
        text='\n'.join('# APPARATUS: printed separator '+line if re.fullmatch(r'(?:[·*]\s*){3,}',line) else line for line in text.splitlines())
        reason=EXCLUSIONS.get(title)
        anchor=h.find('a',attrs={'name':True}) or h.find('a',id=True) or h.find_previous('a',attrs={'name':True})
        page=(h.parent.find('span',class_='pageno') if ID=='50666' else None)
        locator=URL+('#'+anchor.get('id',anchor.get('name')) if anchor else '#'+page['id'] if page and page.get('id') else '#work-'+str(ordinal))
        rows.append(dict(id=f'work-{ordinal:03}',title=title,author=author,text=text,text_sha256=hashlib.sha256(text.encode()).hexdigest(),source_sha256=SHA,source_locator=locator,source_ordinal=ordinal,disposition='excluded' if reason else 'eligible',reason=reason or 'Complete independently headed English lyric/short verse unit, retaining source wording and stanza order.',translation_evidence='Source heading and attached editorial matter reviewed; no translation attribution for eligible units.',editorial_notes_excluded=notes,verse_line_count=sum(bool(x.strip()) and not x.startswith(('#','[')) for x in text.splitlines())))
    return rows
AUTHOR_OVERRIDES={"THE LEGEND OF BOASTFUL BILL": "Charles Badger Clark, Jr. (oral version)", "THE TEXAS COWBOY AND THE MEXICAN GREASER":"Anonymous / traditional", "HIGH CHIN BOB":"Anonymous / traditional", "TO HEAR HIM TELL IT":"Anonymous / traditional", "SNAGTOOTH SAL":"Anonymous / traditional", "THE CHASE":"Roger Pocock", "A COWBOY'S SON":"Roger Pocock", "A COWBOY SONG":"Roger Pocock", "THE COWBOYS' CHRISTMAS BALL":"Larry Chittenden", "JUST A-RIDIN'!":"Charles Badger Clark, Jr.", "THE END OF THE TRAIL":"Roger Pocock"}
CREDITS={'OUT WHERE THE WEST BEGINS': 'Arthur Chapman.', 'THE SHALLOWS OF THE FORD': 'Henry Herbert Knibbs.', 'THE DANCE AT SILVER VALLEY': 'William Maxwell.', 'THE LEGEND OF BOASTFUL BILL': 'From recitation, original, by Charles Badger Clark, Jr.', 'THE TEXAS COWBOY AND THE MEXICAN GREASER': 'From recitation. Anonymous.', 'BRONCHO VERSUS BICYCLE': 'Anonymous.', 'RIDERS OF THE STARS': 'Henry Herbert Knibbs.', 'LASCA': 'Frank Desprez.', 'THE TRANSFORMATION OF A TEXAS GIRL': 'James Barton Adams.', 'THE GLORY TRAIL': 'Charles Badger Clark.', 'HIGH CHIN BOB': 'From oral rendition.', 'TO HEAR HIM TELL IT': 'From the Wild Bunch.', "THE CLOWN'S BABY": 'Margaret Vandergrift.', 'THE DRUNKEN DESPERADO': 'Baird Boyd.', 'MARTA OF MILRONE': 'Herman Scheffauer.', "JACK DEMPSEY'S GRAVE": 'MacMahon.', 'THE CATTLE ROUND-UP': 'H. D. C. McLaclachlan.', "A COWBOY'S WORRYING LOVE": 'James Barton Adams.', 'THE COWBOY AND THE MAID': 'Anonymous.', "A COWBOY'S LOVE SONG": 'Anonymous.', 'A BORDER AFFAIR': 'Charles B. Clark, Jr.', 'SNAGTOOTH SAL': 'In the Saturday Evening Post.', 'LOVE LYRICS OF A COWBOY': 'R. V. Carr.', 'THE BULL FIGHT': 'L. Worthington Green.', "THE COWBOY'S VALENTINE": 'C. F. Lummis.', "A COWBOY'S HOPELESS LOVE": 'James Barton Adams.', 'THE CHASE': 'Pocock in "Curley."', 'RIDING SONG': 'Anonymous.', 'OUR LITTLE COWGIRL': 'Anonymous.', 'I WANT MY TIME': 'Anonymous.', "WHO'S THAT CALLING SO SWEET?": 'Deveen.', 'SONG OF THE CATTLE TRAIL': 'Anonymous.', "A COWBOY'S SON": 'Pocock in "Curley."', 'A COWBOY SONG': 'Pocock in "Curley."', 'A NEVADA COWPUNCHER TO HIS BELOVED': 'Anonymous.', 'THE COWBOY TO HIS FRIEND IN NEED': 'Burke Jenkins.', 'WHEN BOB GOT THROWED': 'Ray.', 'COWBOY VERSUS BRONCHO': 'James Barton Adams.', "WHEN YOU'RE THROWED": 'Anonymous.', 'PARDNERS': 'Berton Braley.', "THE BRONC THAT WOULDN'T BUST": 'Anonymous.', "THE OL' COW HAWSE": 'E. A. Brinninstool.', 'THE BUNK-HOUSE ORCHESTRA': 'Charles Badger Clark.', "THE COWBOY'S DANCE SONG": 'James Barton Adams.', "THE COWBOYS' CHRISTMAS BALL": 'Larry Chittenden in "Ranch Verses."', 'A DANCE AT THE RANCH': 'Anonymous.', 'AT A COWBOY DANCE': 'James Barton Adams.', "THE COWBOYS' BALL": 'Henry Herbert Knibbs.', 'THE COWBOY': 'Anonymous.', 'BAR-Z ON A SUNDAY NIGHT': 'Percival Combes.', 'A COWBOY RACE': 'J. C. Davis.', 'THE HABIT': 'Berton Braley.', 'A RANGER': 'Charles Badger Clark, Jr.', 'THE INSULT': 'Anonymous.', '"THE ROAD TO RUIN"': 'Anonymous.', 'THE OUTLAW': 'Charles B. Clark, Jr.', 'THE DESERT': 'Henry Herbert Knibbs.', 'WHISKEY BILL,— A FRAGMENT': 'Anonymous.', 'DENVER JIM': 'Sherman D. Richardson.', 'THE VIGILANTES': 'Margaret Ashmun.', "THE BANDIT'S GRAVE": 'Charles Pitt.', 'THE OLD MACKENZIE TRAIL': 'John A. Lomax.', 'THE SHEEP-HERDER': 'Charles Badger Clark, Jr.', 'A COWBOY AT THE CARNIVAL': 'Anonymous.', 'THE OLD COWMAN': 'Charles Badger Clark, Jr.', 'THE GILA MONSTER ROUTE': 'L. F. Post and Glenn Norton.', 'THE CALL OF THE PLAINS': 'Ethel MacDiarmid.', 'WHERE THE GRIZZLY DWELLS': 'James Fox.', 'A COWBOY TOAST': 'James Barton Adams.', 'THE DISAPPOINTED TENDERFOOT': 'E. A. Brinninstool.', 'A COWBOY ALONE WITH HIS CONSCIENCE': 'James Barton Adams.', "JUST A-RIDIN'!": '(As sent by Elwood Adams, a Colorado\ncowpuncher.) See "Sun and Saddle\nLeather," by Charles Badger Clark, Jr.', 'THE END OF THE TRAIL': 'From Pocock\'s "Curley."'}
if __name__=='__main__':
    rows=extract(sys.argv[1] if len(sys.argv)>1 else None);value=json.dumps(rows,ensure_ascii=False,indent=2)+'\n'
    if len(sys.argv)>2:Path(sys.argv[2]).write_text(value)
    else:print(value,end='')

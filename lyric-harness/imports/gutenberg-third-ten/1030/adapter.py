#!/usr/bin/env python3
"""Offline source-specific extraction; source-defined work boundaries only."""
import gzip, hashlib, json, re, sys
from pathlib import Path
from bs4 import BeautifulSoup
HERE=Path(__file__).resolve().parent
ID='1030'
SHA='9671acb4486fa8f3fbbb6c744d3e39a31272362df22b80b673a31fa1471b2cec'
URL=f'https://www.gutenberg.org/files/{ID}/{ID}-h/{ID}-h.htm'
EXCLUSIONS={'THE TALE OF THE COBBLER AND THE VICAR OF BRAY.':'long_narrative_poem: extended tale occupying pp.166–190; excluded intact, never split.'}
def clean(node):
    n=BeautifulSoup(str(node),'html.parser')
    for x in n.select('.pagenum,.pageno,.fnanchor,a[href^="#footnote"],a[href^="#f"]'):x.decompose()
    return re.sub(r'\s+',' ',n.get_text()).strip()
def extract(path=None):
    raw=gzip.decompress((Path(path) if path else HERE/'source.html.gz').read_bytes())
    assert hashlib.sha256(raw).hexdigest()==SHA
    s=BeautifulSoup(raw,'html.parser');rows=[]
    heads=s.select('h1' if ID=='50666' else 'h3')
    for h in heads:
        title=clean(h);blocks=[];notes=[];author='Charles Godfrey Leland' if ID=='50666' else 'Anonymous / traditional'
        if ID=='50666' and title in ('CONTENTS','APPENDIX','TRANSCRIBER NOTES'):continue
        start=h.parent if ID=='50666' else h
        for n in start.find_next_siblings():
            if (ID=='50666' and n.find('h1')) or (ID!='50666' and n.name in ('h2','h3')):break
            if ID=='1030':
                if n.name=='p' and 'poetry' in n.get('class',[]):
                    c=BeautifulSoup(str(n),'html.parser')
                    for junk in c.select('.pagenum,a[href^="#footnote"]'):junk.decompose()
                    for br in c.find_all('br'):br.replace_with('\x00')
                    blocks.append('\n'.join(re.sub(r'\s+',' ',l).strip() for l in c.get_text().split('\x00') if l.strip()))
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
        author={1: 'Martin Parker', 3: 'Alexander Brome', 4: 'Alexander Brome', 5: 'Alexander Brome', 6: 'Alexander Brome', 7: 'Alexander Brome', 16: 'Francis Quarles', 19: 'Sir F. W. (printed initials)', 38: 'Samuel Butler', 40: 'Samuel Butler', 44: 'T. J. (printed initials)', 45: 'Alexander Brome', 47: 'Alexander Brome', 58: 'Ned Ward', 69: 'Alexander Brome', 70: 'Alexander Brome', 71: 'Alexander Brome', 72: 'Samuel Butler', 81: 'Alexander Brome'}.get(ordinal,author)
        if ID=='21723':
            # Printed terminal author credit is not a sung line; explicit reviewed mapping below.
            credit=CREDITS.get(title)
            if credit:
                assert blocks[-1].endswith(credit),(title,credit)
                blocks[-1]=blocks[-1][:-len(credit)].rstrip();author=credit.rstrip('.')
        if ID=='50666' and title in ('THE MERMAID','TIME FOR US TO GO','ROLLING OVER','JACK OF ALL TRADES'):author='Anonymous / traditional'
        if ordinal == 48:
            assert blocks[0].startswith('Some Christian kings began to quake,')
            assert blocks[2].startswith('A Brewer may be a burgess grave,')
            notes.append('Editorial contrasting-original quotation excluded: '+'\n\n'.join(blocks[:2]))
            blocks=blocks[2:]
        text='\n\n'.join(x for x in blocks if x)
        if ordinal == 1:
            # Source brackets enclose an editorially supplied stanza, not a section label.
            assert '[Did Walker no predictions lack' in text
            text=text.replace('[Did Walker no predictions lack','Did Walker no predictions lack').replace('When the King enjoys his own again?]','When the King enjoys his own again?')
        text='\n'.join('# APPARATUS: printed separator '+line if re.fullmatch(r'(?:[·*]\s*){3,}',line) else line for line in text.splitlines())
        reason=EXCLUSIONS.get(title)
        anchor=h.find('a',attrs={'name':True}) or h.find('a',id=True) or h.find_previous('a',attrs={'name':True})
        page=(h.parent.find('span',class_='pageno') if ID=='50666' else None)
        locator=URL+('#'+anchor.get('id',anchor.get('name')) if anchor else '#'+page['id'] if page and page.get('id') else '#work-'+str(ordinal))
        rows.append(dict(id=f'work-{ordinal:03}',title=title,author=author,text=text,text_sha256=hashlib.sha256(text.encode()).hexdigest(),source_sha256=SHA,source_locator=locator,source_ordinal=ordinal,disposition='excluded' if reason else 'eligible',reason=reason or 'Complete independently headed English lyric/short verse unit, retaining source wording and stanza order.',translation_evidence='Source heading and attached editorial matter reviewed; no translation attribution for eligible units.',editorial_notes_excluded=notes,verse_line_count=sum(bool(x.strip()) and not x.startswith(('#','[')) for x in text.splitlines())))
    return rows
CREDITS={}
if __name__=='__main__':
    rows=extract(sys.argv[1] if len(sys.argv)>1 else None);value=json.dumps(rows,ensure_ascii=False,indent=2)+'\n'
    if len(sys.argv)>2:Path(sys.argv[2]).write_text(value)
    else:print(value,end='')

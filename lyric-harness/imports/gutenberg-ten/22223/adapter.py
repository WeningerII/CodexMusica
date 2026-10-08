"""Parse the exact 1903 Gutenberg 22223 plain-text transcription, without splitting parts."""
import hashlib, json, re, sys
from pathlib import Path

def parse(path):
    raw=Path(path).read_bytes(); full=raw.decode('utf-8-sig').replace('\r\n','\n')
    start=full.index('SONGS AND BALLADS',full.index('INDEX OF AUTHORS'))
    end=full.index('End of the Project Gutenberg',start)
    body=full[start:end]; headings=[]; author='Anonymous'
    pattern=r'(?m)^(?:_?[A-Z][A-Z ,\x27’.?!;:0-9-]*_?)(?:\n[A-Z][A-Z ,\x27’.?!;:0-9-]*)?(?=\n\n)'
    for m in re.finditer(pattern,body):
        h=m[0]
        if h.startswith('_') or h in ['JAMES THOMSON','ROBERT SOUTHEY']:
            author=h.strip('_'); headings.append((m.start(),m.end(),None,author)); continue
        if h.startswith('PART ') or re.fullmatch('[IVXLC]+',h) or h=='SONGS AND BALLADS':continue
        headings.append((m.start(),m.end(),' '.join(h.split()),author))
    long={'THE BEGGAR\'S DAUGHTER OF BEDNALL-GREEN','THE BABES IN THE WOOD','THE NUT-BROWN MAID','THE HEIR OF LINNE','CHEVY CHASE','THE DIVERTING HISTORY OF JOHN GILPIN','EDWIN AND ANGELINA','BRISTOW TRAGEDY','THE RIME OF THE ANCIENT MARINER','THE DREAM OF EUGENE ARAM','THE LADY OF SHALOTT'}
    items=[]
    for i,(a,b,title,author) in enumerate(headings):
        if title is None:continue
        stop=headings[i+1][0] if i+1<len(headings) else len(body)
        text=body[b:stop].strip()
        # Part/verse numerals are layout, not lyric lines. Keep every stanza.
        text=re.sub(r'(?m)^(?:PART [IVX]+|[IVX]+)\.?\s*\n','',text)
        text=re.sub(r'\n{3,}','\n\n',text).strip()
        transformations=[]; cleaned=[]
        for line in text.splitlines():
            t=line.strip(); replacement=None
            if re.fullmatch(r'[. *·—–-]{3,}',t):
                replacement='# APPARATUS: '+t
            elif t in ('_First Voice_', '_Second Voice_'):
                replacement='# APPARATUS: '+t.strip('_')
            elif re.match(r'^(?:He|She)\. ',t):
                label, words=t.split('. ',1)
                replacement='# APPARATUS: '+label+'.\n'+words
            if replacement is not None:
                transformations.append({'source_text':line,'output_text':replacement,'kind':'apparatus_annotation'})
            cleaned.append(replacement if replacement is not None else line)
        text='\n'.join(cleaned)
        reason='long_narrative_poem: individually identified extended narrative; retained whole in audit and excluded whole from import' if title in long else None
        if reason is None:
            supplied=[]
            for line in text.splitlines():
                replacement=line if line.startswith(('#','[CHORUS]')) else line.replace('[','').replace(']','')
                if replacement!=line:
                    transformations.append({'source_text':line,'output_text':replacement,'kind':'editorial_bracket_typography','note':'Supplying brackets removed so the existing reader retains the supplied verse words.'})
                supplied.append(replacement)
            text='\n'.join(supplied)
        items.append({'id':f'pg22223-{len(items)+1:03d}','title':title.title(),'author':author.title(),'text':text,'disposition':'excluded' if reason else 'eligible','reason':reason,'source_locator':f'plain-text lines {full[:start+a].count(chr(10))+1}-{full[:start+stop].count(chr(10))+1}','translation_evidence':'English anthology heading and attributed English original; no translator attribution. Scots originals retained as supplied.','source_url':'https://www.gutenberg.org/ebooks/22223','transformations':transformations})
    return items
if __name__=='__main__':
    items=parse(sys.argv[1]); Path(__file__).with_name('candidates.json').write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n');print(len(items))

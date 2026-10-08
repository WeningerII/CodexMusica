"""Parse Gutenberg 76941's 1908 edition. Preserve complete contents units and stanzas."""
import json,re,sys
from pathlib import Path

def parse(path):
    full=Path(path).read_text(); start=full.index('SONGS AND BALLADS',full.index('CONTENTS')); end=full.index('\nNOTES',start)
    lines=full[start:end].splitlines(); heads=[]
    for i,line in enumerate(lines):
        if not re.match(r'^(?:_|\[_|‘_)',line):continue
        letters=[c for c in line if c.isalpha()]
        if not letters or sum(c.isupper() for c in letters)/len(letters)<.9:continue
        j=i; title=line
        while not re.search(r'_.*$',title[title.find('_')+1:]):
            j+=1; title+=' '+lines[j]
        # A title may contain the editorial italic break around [sic].
        if j+1<len(lines) and lines[j+1].startswith('[_sic_]'):
            j+=1;title+=' '+lines[j]
        heads.append((i,j+1,title.replace('_','').removeprefix('[').removesuffix(']').removeprefix('‘').removesuffix('’').rstrip('.,;:')))
    items=[]
    for k,(a,b,title) in enumerate(heads):
        stop=heads[k+1][0] if k+1<len(heads) else len(lines)
        source=lines[b:stop]; verse=[]; metadata=[]
        for line in source:
            t=line.strip()
            if not t:
                if verse and verse[-1]!='':verse.append('')
            elif line.startswith('    ') and not re.fullmatch(r'(?:[IVX]+|[0-9]+)[.]?',t):
                verse.append(line[4:].rstrip().replace('_',''))
            else:metadata.append(t)
        text='\n'.join(verse).strip();text=re.sub(r'\n{3,}','\n\n',text)
        # Editorial tune/byline/speaker labels are recorded separately, never lyric lines.
        drops = {7:['T(HOMAS) D(ELONEY).'],8:['(By THOMAS DELONEY.)'],14:['[Probably by LAWRENCE PRICE.]'],18:['M[ARTIN] P[ARKER].'],25:['CHARLES SACKVILLE, Earl of Dorset, 1665.'],31:['[Sir JOHN BIRKENHEAD.]']}
        cleaned=[];transformations=[]
        for line in text.splitlines():
            t=line.strip()
            replacement=None
            if re.match(r'(?i)^chorus[.:]?(?:\s|$)',t):
                words=re.sub(r'(?i)^chorus[.:]?\s*','',t)
                replacement='[CHORUS]'+('\n'+words if words else '')
            elif t in ['MAID.','MAN.','MOLLY.','BILLY.','TOM.','JACK.','BOTH.','CAPTAIN.','THE CAPTAIN’S ANSWER.','MESSENGER.','1ST WOMAN.','2ND WOMAN.','A NEW SONG, ADAPTED TO THE TIMES.','A NEW SONG.','The Second Part.','(? 1756)','By Sir H. S.','By J. PRAT.','Air--The Landlady of France.','Air--Tars of the ‘Blanche.’'] or re.fullmatch(r'[. *·—–-]{3,}',t):
                replacement='# APPARATUS: '+t
            if replacement is not None:
                cleaned.append(replacement)
                transformations.append({'source_text':line,'output_text':replacement,'stage':'after removing four-space verse margin and underscore italic markup','kind':'chorus_label' if replacement.startswith('[CHORUS]') else 'apparatus_annotation'})
                continue
            if t in drops.get(k+1,[]) or re.match(r'^(?:\(?Tune\b|\[?To the [Tt]une|Printed in |The [Tt]une |To a Tune |To as merry a new Tune|To a Pleasant Tune|COMPOS’D BY|A New Ballad to the tune|The words by |\(In Harlequin|A New Song\.|A NEW WAR SONG\.|\(1[0-9]{3}[.)])',t) or t in ['MOLLY.','BILLY.','TOM.','JACK.','CAPTAIN.','MESSENGER.','1ST WOMAN.','2ND WOMAN.','CHORUS.','[Fragment.]'] or t.startswith('[They '):
                metadata.append(t)
            else:cleaned.append(line)
        text='\n'.join(cleaned)
        starts={23:'Great Charles,',27:'I am an undaunted seaman',29:'Rejoyce, rejoyce',35:'Come, all you brave sea-men',114:'  Come cheer up',130:'Ye bold British tars',136:'On board the noble Ann'}
        if k+1 in starts:
            pos=text.index(starts[k+1]);metadata.extend(text[:pos].splitlines());text=text[pos:]
        text=re.sub(r'\n{3,}','\n\n',text).strip()
        reason=None
        if title=='SIR ANDREW BARTON':reason='long_narrative_poem: extended complete narrative, approximately 330 verse lines; excluded whole'
        elif title=='COPENHAGEN':reason='long_narrative_poem: extended narrative recounting the battle in approximately 160 verse lines; excluded whole'
        elif title.startswith('AN ELEGIE ON THE DEATH'):reason='long_non_lyric_poem: extended 170-line elegy, outside requested short poems'
        if k+1 in (35,60,82):reason='incomplete_source_text: source explicitly marks a lost or missing line'
        if k+1==164:reason='incomplete_source_text: source explicitly labels this item Fragment'
        if k+1==138:reason='incomplete_source_text: source explicitly marks Two lines missing'
        if reason is None:
            supplied=[]
            for line in text.splitlines():
                if line.startswith(('#','[CHORUS]')):
                    supplied.append(line);continue
                replacement=re.sub(r'\s*\[sic\]', '', line)
                replacement=re.sub(r'\s*\[\?\]', '', replacement)
                replacement=replacement.replace('[','').replace(']','')
                if replacement!=line:
                    transformations.append({'source_text':line,'output_text':replacement,'kind':'editorial_bracket_typography','note':'Remove editorial sic/query markers and supplying brackets; preserve all supplied verse words. Paired brackets may span multiple verse lines.'})
                supplied.append(replacement)
            text='\n'.join(supplied)
        author='Anonymous (not attributed in item)'
        if k in (0,1):author='Laurence Minot'
        if title.startswith('A JOYFUL NEW BALLAD') or title.startswith('AN EXCELLENT SONG ON THE WINNING'):author='Thomas Deloney'
        if k+1==83:author='George Barker'
        if k+1==18:author='Martin Parker'
        if k+1==31:author='John Birkenhead'
        if k+1==149:author='George Cook'
        if title=='HEARTS OF OAK':author='David Garrick'
        if title=='HOSIER’S GHOST':author='Richard Glover'
        if title=='SONG WRITTEN AT SEA':author='Charles Sackville, Earl of Dorset'
        if title=='LA LOIRE FRIGATE, OR YEO! YEO!':author='Charles Dibdin, Jr.'
        items.append({'id':f'pg76941-{k+1:03d}','title':title.title(),'author':author,'text':text,'disposition':'excluded' if reason else 'eligible','reason':reason,'source_locator':f'plain-text lines {full[:start].count(chr(10))+a+1}-{full[:start].count(chr(10))+stop}','source_url':'https://www.gutenberg.org/ebooks/76941','translation_evidence':'Original English broadside/song or Middle English verse; source introduction and endnotes identify English source witnesses. No translation attribution in item.','source_metadata':metadata,'transformations':transformations})
    assert len(items)==199,len(items)
    assert all(x['text'] for x in items)
    return items
if __name__=='__main__':
    items=parse(sys.argv[1]);Path(__file__).with_name('candidates.json').write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n');print(len(items))

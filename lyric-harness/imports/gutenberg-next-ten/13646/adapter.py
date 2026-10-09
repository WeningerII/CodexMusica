#!/usr/bin/env python3
"""Extract 112 numbered limericks plus complete introductory verse; HTML br preserved."""
import gzip,hashlib,html,json,re,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent

def extract():
    meta=json.loads((HERE/'collection.json').read_text());raw=gzip.decompress((HERE/'source.txt.gz').read_bytes())
    assert hashlib.sha256(raw).hexdigest()==meta['source_sha256']
    source=raw.decode('latin1')
    blocks=re.findall(r'<p class="rhyme" id="([^"]+)">(.*?)</p>',source,re.S)
    assert [k for k,_ in blocks]==['rhyme1_intro']+['rhyme1_'+str(n) for n in range(1,113)]
    rows=[]
    for key,block in blocks:
        block=re.sub(r'<br\s*/?>','\n',block)
        block=re.sub(r'<span class="i[24]">','\n',block)
        lines=[re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>','',s))).strip() for s in block.splitlines()]
        lines=[s for s in lines if s]
        assert len(lines)==(3 if key=='rhyme1_intro' else 4),(key,lines)
        text='\n'.join(lines)
        rows.append(dict(id=key,title=lines[0].rstrip(',;.!'),author='Edward Lear',text=text,
            disposition='eligible',reason=None,source_locator=meta['source_url']+'#'+key,
            source_sha256=meta['source_sha256'],verse_line_count=len(lines),
            translation_evidence='Original English nonsense verse by Edward Lear in supplied 1894 collection. Foreign place names are not translations.'))
    return rows
if __name__=='__main__':
    result=json.dumps(extract(),ensure_ascii=False,indent=2)+'\n';path=HERE/'candidates.json'
    if '--check' in sys.argv:assert path.read_text()==result
    else:path.write_text(result)
    print(len(extract()),'whole source units')

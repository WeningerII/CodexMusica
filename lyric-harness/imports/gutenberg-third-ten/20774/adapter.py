#!/usr/bin/env python3
"""Replay the 30 complete printed lyric blocks, excluding notes and score images."""
import gzip,hashlib,json,re,sys
from pathlib import Path
from bs4 import BeautifulSoup
HERE=Path(__file__).resolve().parent
SHA='1a533b028e5854cb5d113994b517a4a12d7e76a06094941369f6df660eb46720'
URL='https://www.gutenberg.org/files/20774/20774-h/20774-h.htm'
def extract(path=None):
 raw=gzip.decompress((Path(path) if path else HERE/'source.html.gz').read_bytes());assert hashlib.sha256(raw).hexdigest()==SHA
 s=BeautifulSoup(raw,'html.parser');rows=[]
 for h in s.find_all('h1'):
  heading=re.sub(r'\s*\[\d+\]','',h.get_text(' ',strip=True));m=re.match(r'(\d+)\. (.+)',heading)
  if not m:continue
  n=int(m[1]);title=m[2].rstrip('.');verse=h.find_next('div',class_='blockquot')
  assert verse and verse.find_previous('h1')==h
  blocks=[]
  for p in verse.find_all('p',recursive=False):
   copy=BeautifulSoup(str(p),'html.parser')
   for j in copy.select('.pagenum,.fnanchor,a[href^="#Footnote"]'):j.decompose()
   for br in copy.find_all('br'):br.replace_with('\x00')
   lines=[re.sub(r'\s+',' ',l).strip() for l in copy.get_text().split('\x00')]
   lines=[re.sub(r'^\d+\.\s*','',l) for l in lines]
   blocks.append('\n'.join(lines).strip())
  text='\n\n'.join(blocks);text=re.sub(r'\n{3,}','\n\n',text)
  text=text.replace('(INTRODUCTION.)','# APPARATUS: INTRODUCTION.')
  text=re.sub(r' \((twice|thrice)\)',lambda m:'\n# APPARATUS: repeat preceding line '+m[1],text)
  a=h.find('a');locator=URL+'#'+a['id'];notes=[]
  for nh in s.find_all('h3'):
   if nh.get_text(' ',strip=True).startswith(str(n)+'. '):
    for sib in nh.find_next_siblings():
     if sib.name in ('h2','h3','h1'):break
     if sib.name=='p':notes.append(sib.get_text(' ',strip=True))
    break
  rows.append(dict(id=f'song-{n:02}',title=title,author='Anonymous / traditional (Terry edited witness)',text=text,text_sha256=hashlib.sha256(text.encode()).hexdigest(),source_sha256=SHA,source_locator=locator,source_ordinal=n,disposition='eligible',reason='Complete source lyric block, including every supplied stanza and abbreviated chorus; traditional open-ended shanty form, not a fragment assembled from notes.',translation_evidence='English traditional song; heading and source notes reviewed, no translated original identified.',editorial_notes_excluded=notes,verse_line_count=sum(bool(x.strip()) and not x.startswith(('#','[')) for x in text.splitlines())))
 assert len(rows)==30
 return rows
if __name__=='__main__':
 rows=extract(sys.argv[1] if len(sys.argv)>1 else None);out=json.dumps(rows,ensure_ascii=False,indent=2)+'\n'
 if len(sys.argv)>2:Path(sys.argv[2]).write_text(out)
 else:print(out,end='')

#!/usr/bin/env python3
"""Extract the complete 1870 Christian Hymn Book's explicit hymn/verse markup."""
import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path

class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []
    def text(self):
        return ''.join(c.text() if isinstance(c, Node) else c for c in self.children)
    def find(self, cls):
        out = []
        for c in self.children:
            if isinstance(c, Node):
                if cls in c.attrs.get('class','').split(): out.append(c)
                out.extend(c.find(cls))
        return out

class Tree(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Node(); self.stack = [self.root]; self.feed(source)
    def handle_starttag(self, tag, attrs):
        n=Node(tag,attrs); self.stack[-1].children.append(n)
        if tag not in ('br','hr','img','meta','link','input'): self.stack.append(n)
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag,attrs)
        if tag not in ('br','hr','img','meta','link','input'): self.handle_endtag(tag)
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag:
                self.stack=self.stack[:i]; return
    def handle_data(self,data): self.stack[-1].children.append(data)

def compact(t): return re.sub(r'\s+',' ',t).strip()

def extract(source):
    root=Tree(source).root
    out=[]
    for hymn in root.find('hymn'):
        number=int(hymn.attrs['id'][1:])
        author=hymn.find('author')
        author=compact(author[0].text()) if author else 'Anonymous'
        stanzas=[]
        sections=[]
        for v in hymn.find('verse'):
            lines=[]
            kind='verse'
            for line in v.children:
                if not isinstance(line,Node) or line.tag!='p': continue
                for cls in ('vn','scripRef'):
                    for node in line.find(cls): node.children=[]
                value=compact(line.text())
                if re.match(r'^Chorus\.',value,re.I):
                    if lines:
                        stanzas.append(lines); sections.append({'type':kind,'lines':lines})
                    lines=[]; kind='chorus'
                    value=re.sub(r'^Chorus\.[—\s]*','',value,flags=re.I)
                if value: lines.append(value)
            if lines:
                stanzas.append(lines); sections.append({'type':kind,'lines':lines})
        assert stanzas, number
        out.append({'id':str(number),'title':stanzas[0][0].rstrip('!,;:.—'),'author':author,'printed_heading':compact(hymn.find('ttl')[0].text()) if hymn.find('ttl') else '','text':'\n\n'.join('\n'.join(x) for x in stanzas),'stanzas':stanzas,'sections':sections,'source_locator':f'https://www.gutenberg.org/cache/epub/46041/pg46041-images.html#c{number}','source_anchor':f'c{number}','disposition':'eligible','reason':'Complete short hymn printed as a separate numbered entry; no translation identified in attribution/first-line review.','translation_evidence':'Original-language English hymnal entry; attributed author and first line screened for translated hymns.'})
    assert [int(x['id']) for x in out]==list(range(1,1325))
    exclusions=json.loads(Path(__file__).with_name('exclusions.json').read_text())
    for row in out:
        if row['id'] in exclusions:
            evidence=exclusions[row['id']]
            row.update(disposition='excluded',reason=evidence['reason'],translation_evidence=evidence['evidence'])
    return out

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('--output',type=Path,default=Path(__file__).with_name('candidates.json'));args=p.parse_args()
    rows=extract(args.source.read_bytes().decode('utf-8-sig'))
    args.output.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    print(f'Extracted {len(rows)} entries')

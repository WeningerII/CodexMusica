"""Extract all 88 numbered items from the exact PG59263 HTML edition.
Usage: python adapter.py /path/to/59263-h.htm
Outputs candidates.json beside this adapter. No inferred publication year.
"""
import sys,re,html,json,pathlib
source=pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig')
blocks=re.findall(r'<h2 id="ch(\d+)">(.*?)(?=<h2|\*\*\* END)',source,re.S)
assert [int(n) for n,_ in blocks]==list(range(1,89))
translated={44:('Paul Gerhardt','https://hymnary.org/text/how_shall_i_meet_my_savior'),81:('Paul Gerhardt','https://hymnary.org/text/how_shall_i_meet_my_savior'),68:('Anonymous Latin hymn','https://hymnary.org/text/jesus_christ_is_risen_today_our_triumphant')}
# The edition does not credit individual authors. Known credits aid deduplication;
# other English traditional hymns retain the source’s anonymous attribution.
authors={1:'John Byrom',2:'Isaac Watts',10:'James Montgomery',12:'Charles Wesley',14:'Reginald Heber',15:'Nahum Tate',19:'Charles Wesley',23:'Philip Doddridge',26:'Charles Wesley',34:'Isaac Watts',36:'John Cawood',38:'James Montgomery',45:'Henry Kirke White',46:'James Montgomery',48:'Charles Wesley and Henry Kirke White (composite)',49:'Edward Perronet',51:'Charles Wesley',54:'Richard Burdsall',56:'Isaac Watts',58:'Joseph Grigg',61:'Charles Wesley',63:'Isaac Watts',70:'Isaac Watts',72:'Isaac Watts',74:'Charles Wesley',75:'Isaac Watts',76:'Andrew Young',79:'Anonymous and William Bengo Collyer',82:'Isaac Watts',86:'Isaac Watts',88:'Charles Wesley'}
rows=[]
for ns,b in blocks:
 n=int(ns);sections=[];pending_kind='verse'
 for verse in re.findall(r'<div class="verse">(.*?)</div>',b,re.S):
  lines=[];kind=pending_kind;pending_kind='verse'
  for p in re.findall(r'<p\b[^>]*>(.*?)</p>',verse,re.S):
   line=html.unescape(re.sub('<[^>]+>','',p));line=re.sub(r'\s+',' ',line).strip()
   label=re.match(r'^(?:chorus|cho)\b\.?\s*(?:[:—–-]\s*)?(.*)$',line,re.I)
   if label:
    # A printed label starts a chorus, including abbreviated repeat cues.
    # It is structural apparatus, never a sung line. Keep the printed
    # abbreviated lyric (such as "Welcome news, &c.") without expansion.
    if lines:sections.append({'type':kind,'lines':lines});lines=[]
    kind='chorus';line=label[1]
   if line:lines.append(line)
  if lines:sections.append({'type':kind,'lines':lines})
  elif kind=='chorus':pending_kind='chorus'
 assert sections,n
 assert pending_kind=='verse',f'unattached chorus label: {n}'
 text='\n\n'.join('\n'.join(section['lines']) for section in sections);reason=None
 evidence='Anonymous English hymn/carol in supplied Christmas collection; screened against identified Latin/German translations; no translation indication for this entry.'
 author=authors.get(n,'Anonymous')
 if n in translated:
  author,url=translated[n];reason='translation';evidence='Identified translation: '+url
 if n==18:
  reason='original_language_unresolved';evidence='Moravian text Thou Child Divine; supplied edition omits author/translator, and consulted attribution does not establish original English: https://hymnary.org/text/thou_child_divine_immanuel'
 rows.append(dict(sections=sections,id=ns,title=text.splitlines()[0].rstrip(' ,.!;'),author=author,text=text,disposition='excluded' if reason else 'eligible',reason=reason,source_locator='https://www.gutenberg.org/files/59263/59263-h/59263-h.htm#ch'+ns,translation_evidence=evidence))
pathlib.Path(__file__).with_name('candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(len(rows),sum(x['disposition']=='eligible' for x in rows))

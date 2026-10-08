#!/usr/bin/env python3
"""Replay PG69378 plaintext verse boundaries against the byte-pinned witness.

Only indented verse is extracted; prose, bibliography, footnote paragraphs and
musical notation are never spliced into songs. Printed alphabetic versions are
independent units. Review decisions live beside their exact source coordinates.
"""
import gzip
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
URL = 'https://www.gutenberg.org/ebooks/69378'
SOURCE_URL = 'https://www.gutenberg.org/ebooks/69378.txt.utf-8'
SHA = '8096bfdd2f84cc31253e99146fa4ae77bdbfc6ed1e4c8ef6254d13de4dcc54ae'
# Untitled units require affirmative source-framing review; never infer
# completeness from the number of lines or from dictionary coverage.
UNTITLED = {
    812: ('I’m gwine to Alabamy', 'Complete untitled song expressly introduced as a Civil War song; incipit title supplied, no text assembled.'),
    7988: ('Do, Lawd, remember me', 'Complete three-stanza untitled spiritual introduced as a current workers’ favorite; incipit title supplied.'),
    8958: ('Louisiana Blues — Left Wing Gordon version', 'The following prose explicitly names this continuous performance Louisiana Blues; preserved as one supplied version.'),
    9094: ('Anna yo’ peaches, but I’s yo’ man', 'Prose introduces the exact record of Left Wing Gordon’s songs; one uninterrupted supplied performance, incipit title.'),
    9141: ('Eddy Studow been here', 'Prose explicitly introduces a new song by the singer; one continuous supplied performance, not assembled from excerpts.'),
    9208: ('I ruther be dead', 'Continuous self-contained performance on the singer’s stated theme; incipit title, source sequence kept intact.'),
    9275: ('I seed a pretty brown', 'Complete narrative chant sequence introduced by the singer’s account, ends with its resolution before prose resumes; incipit title.'),
    10261: ('Stagolee', 'Chapter XIV explicitly says these words are reprinted in full; complete lyric block apart from score underlay.'),
    10301: ('Railroad Bill', 'Chapter XIV explicitly says these words are reprinted in full; complete lyric block apart from score underlay.'),
    10342: ('She Asked Me in de Parlor', 'Chapter XIV explicitly says these words are reprinted in full; complete lyric block apart from score underlay.'),
}
EXCLUDED_TITLES = {
    'I CAN’T KEEP FROM CRYIN’': 'incomplete_source: note 25 explicitly calls this a condensed version of Death Letter Blues.',
    'STEWBALL WAS A RACER': 'incomplete_source: note 67 explicitly calls this a fragment of Skewball.',
}

def extract(path=None):
    path = Path(path) if path else HERE / 'source.txt.gz'
    raw = gzip.decompress(path.read_bytes()) if path.suffix == '.gz' else path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == SHA, 'source witness byte mismatch'
    lines = raw.decode('utf-8-sig').splitlines()
    rows=[]; title=None; title_line=None; variant=None; chapter=None
    block=[]; starts=[]; context=[]; notes=[]
    def flush():
        nonlocal block, starts, notes
        if not starts:
            block=[]; return
        text='\n'.join(block).strip(); start=starts[0]; end=starts[-1]
        heading=title
        eligible=bool(heading) and chapter not in ('I','II','XII','XIV','XV')
        reason='Complete separately headed English song/version as supplied; no verses assembled or pronunciation normalization applied.'
        if not eligible:
            reason='source_excerpt: unheaded verse passage within analytical or biographical prose; no affirmative complete-song framing in this review.'
        if chapter in ('XIV','XV'):
            reason='musical_example: score/transcription illustration, not another standalone lyric work.'
        if start in UNTITLED:
            heading,reason=UNTITLED[start];eligible=True
        if heading in EXCLUDED_TITLES:
            eligible=False;reason=EXCLUDED_TITLES[heading]
        display=heading or next((x for x in text.splitlines() if x and not x.startswith('[')), 'Untitled verse extract')
        if variant and heading:display += ' — version '+variant
        rows.append(dict(id=f'line{start:05d}',title=display,author=('Sanctified Mary Harris (claimed composition)' if title in {'GONNA TURN BACK PHARAOH’S ARMY', 'DIDN’T OL’ PHARAOH GET LOST?', 'WHO BUILT DE ARK?'} else 'Anonymous / traditional'),text=text,
                         disposition='eligible' if eligible else 'excluded',reason=reason,
                         source_locator=SOURCE_URL+f'#L{start}-L{end}',source_line_start=start,source_line_end=end,
                         source_heading_line=title_line,source_variant=variant,source_chapter=chapter,
                         source_sha256=SHA,text_sha256=hashlib.sha256(text.encode()).hexdigest(),
                         translation_evidence='English-language witness; title, surrounding prose and footnotes reviewed for foreign-original or translation attribution. Historical represented speech and vocables preserved; no translator attribution identified.',
                         editorial_notes_excluded=notes[:],performer=('Left Wing Gordon' if chapter=='XII' else None),context_before='\n'.join(context[-12:]),
                         verse_line_count=sum(bool(x.strip()) and not x.startswith(('#','[')) for x in text.splitlines())))
        block=[];starts=[];notes=[]
    for i,line in enumerate(lines,1):
        if i<288:continue
        if line.startswith('SELECTED BIBLIOGRAPHY'):
            flush();break
        if line.startswith('    ') and line.strip():
            value=line.strip()
            if re.fullmatch(r'\[Illustration.*',value):
                continue
            value=re.sub(r'\[\d+\]','',value)
            if re.fullmatch(r'_?Chorus_?\s*:',value,re.I):value='[CHORUS]'
            if re.fullmatch(r'(?:\.\s*){3,}',value):value='# APPARATUS: '+value
            value=value.replace('_', '')
            block.append(value);starts.append(i)
        elif not line.strip():
            if block and block[-1]!='':block.append('')
        elif line.startswith('  '):
            # Two-space blocks are footnotes and their wrapped continuations.
            if starts:notes.append(line.strip())
        else:
            flush()
            clean=re.sub(r'\[\d+\]','',line).strip()
            m=re.fullmatch(r'CHAPTER ([IVX]+)',clean)
            if m:
                chapter=m.group(1);title=None;variant=None;title_line=None
            elif re.fullmatch('[A-K]',clean) and title:
                variant=clean
            elif clean==clean.upper() and any(c.isalpha() for c in clean):
                title=clean;title_line=i;variant=None
            else:
                title=None;variant=None;title_line=None
            context.append(line)
    flush()
    # Exact reviewed containment pair: let the complete 48-line supplied
    # performance win ordinary deduplication, retaining its forty other lines.
    # The eight-line witness remains eligible in the ledger with original
    # coordinates; no text assembly or general duplicate exemption is applied.
    long_index = next(i for i, row in enumerate(rows) if row['id'] == 'line03773')
    longer = rows.pop(long_index)
    short_index = next(i for i, row in enumerate(rows) if row['id'] == 'line01857')
    rows.insert(short_index, longer)
    return rows

if __name__=='__main__':
    rows=extract(sys.argv[1] if len(sys.argv)>1 else None)
    payload=json.dumps(rows,ensure_ascii=False,indent=2)+'\n'
    if len(sys.argv)>2:Path(sys.argv[2]).write_text(payload)
    else:print(payload,end='')

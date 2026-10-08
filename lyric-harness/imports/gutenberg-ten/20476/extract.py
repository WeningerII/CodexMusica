#!/usr/bin/env python3
"""Extract PG20476's complete numbered hymns from the pinned XHTML edition.

Usage: python extract.py /tmp/pg20476.html
The downloaded source is deliberately external; candidates and evidence are local.
"""
import hashlib
import html
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
SHA256 = '44d22d3307bb2f228ad674894e28199418c877a45fc0e84ef548aeb0ce5c0b42'
RAW_URL = 'https://raw.githubusercontent.com/GITenberg/Hymns-for-Christian-DevotionEspecially-Adapted-to-the-Universalist-Denomination_20476/6196bc7e228a999fa0e57902d9202c7916bac00d/20476-h/20476-h.htm'
SOURCE = 'https://www.gutenberg.org/files/20476/20476-h/20476-h.htm'
NS = {'x': 'http://www.w3.org/1999/xhtml'}
# Number-specific review: a denominational collection credit alone is NOT a
# translation flag (e.g. Moravian #100 is by the English author L. R. West).
EXCLUSIONS = {
    612: ('translation', 'Pluralized adaptation of stanzas5,6,8 of Jesus thy boundless love to me, Paul Gerhardt translated by John Wesley, explicitly credited in PG76498 hymn84. https://www.gutenberg.org/ebooks/76498.txt.utf-8'),
    667: ('translation', 'This child we dedicate to thee matches PG76498 hymn404, explicitly credited From the German. S. Gilman, tr.,1823. https://www.gutenberg.org/ebooks/76498.txt.utf-8'),
    164: ('translation', 'Patrick’s rendering of the Latin Te Deum; https://hymnary.org/text/o_god_we_praise_thee_and_confess'),
    244: ('translation', 'Jesus thou source of calm repose is John Wesley’s translation of Johann Anastasius Freylinghausen; https://hymnary.org/text/jesus_thou_source_of_calm_repose'),
    467: ('translation', 'Guide me O thou great Jehovah derives from William Williams’s Welsh hymn Arglwydd arwain trwy’r anialwch; https://hymnary.org/text/guide_me_o_thou_great_jehovah'),
    68: ('translation', 'Printed credit Roman Breviary: translated Latin liturgical hymn.'),
    76: ('translation', 'Dryden adaptation of the Latin Veni Creator Spiritus; https://hymnary.org/text/creator_spirit_by_whose_aid'),
    121: ('translation', 'Printed credit Mme. Guion: French original by Jeanne-Marie Guyon in English translation.'),
    131: ('translation', 'Printed credit Mme. Guion: French original by Jeanne-Marie Guyon in English translation.'),
    176: ('translation', 'Printed credit Zinzendorf: German hymn rendered in English.'),
    330: ('translation', 'Printed credit Breviary: translated Latin liturgical hymn.'),
    331: ('translation', 'Source explicitly prints Translated by J. Wesley beneath the credit Richter.'),
    462: ('original_language_unresolved', 'Printed credit Grünbeck (Esther Grünbeck); original-English origin not established; held out rather than infer from English rendering. https://hymnary.org/person/Grunbeck_Esther'),
    497: ('original_language_unresolved', 'Printed credit J. F. Oberlin; original-English origin not established for this French/German author.'),
    508: ('translation', 'Printed credit Mme. Guion: French original by Jeanne-Marie Guyon in English translation.'),
    637: ('translation', 'Give to the winds thy fears is Wesley’s translation from Paul Gerhardt, Befiehl du deine Wege. https://hymnary.org/text/give_to_the_winds_thy_fears'),
    979: ('original_language_unresolved', 'Ancient Hymns includes both Mant translations and originals. This martyrs hymn resembles the Latin Sanctorum meritis; original-English origin not established. Held out.'),
    980: ('translation', 'Printed credit Luther; Flung to the heedless winds is an English rendering of Luther’s German martyr hymn. https://hymnary.org/text/flung_to_the_heedless_winds'),
}

def text(node):
    return ''.join(node.itertext()).strip() if node is not None else ''

def extract(data):
    assert hashlib.sha256(data).hexdigest() == SHA256, 'Wrong edition/source bytes'
    source = data.decode('utf-8')
    # Convert XHTML named entities to numeric references for the stdlib parser.
    source = re.sub(r'&([A-Za-z]+);', lambda m: ''.join(f'&#{ord(c)};' for c in html.unescape(m[0])), source)
    root = ET.fromstring(source)
    hymns = root.findall('.//x:div[@class="hymn"]', NS)
    assert [x.attrib['id'] for x in hymns] == [f'h{i:04d}' for i in range(1, 1009)]
    rows = []
    for number, hymn in enumerate(hymns, 1):
        head = hymn.find('x:h3', NS)
        author = text(head.find('x:span[@class="sc"]', NS)) or 'Anonymous'
        subtitle = text(hymn.find('x:p[@class="argument"]', NS))
        stanzas = []
        for verse in hymn.findall('x:div[@class="verse"]', NS):
            lines = []
            for line in verse.findall('x:div', NS):
                for span in list(line):
                    if span.attrib.get('class') == 'vn':
                        # Remove only printed stanza numerals, retain the tail.
                        line.text = (line.text or '') + (span.tail or '')
                        line.remove(span)
                value = text(line)
                assert value
                lines.append(value)
            assert lines, (number, 'empty stanza')
            stanzas.append('\n'.join(lines))
        assert stanzas
        reason, evidence = EXCLUSIONS.get(number, ('', 'No translation credit or identified non-English original; English hymn as printed. Biblical paraphrases are original English hymn settings, not classified as translated literary works.'))
        body = '\n\n'.join(stanzas)
        # The same pinned edition's 20476-8.txt retains the accented e lost
        # in its XHTML transcription. This is the sole documented correction.
        if number == 923:
            assert 'Give us in thy belovd house,' in body
            body = body.replace('Give us in thy belovd house,', 'Give us in thy belovéd house,')
        rows.append({
            'id': str(number), 'title': body.splitlines()[0].rstrip(' ,;.!'),
            'printed_subtitle': subtitle, 'author': author.rstrip('.'),
            'meter': text(head.find('x:span[@class="meter"]', NS)),
            'text': body, 'disposition': 'excluded' if reason else 'eligible',
            'reason': reason, 'translation_evidence': evidence,
            'source_locator': SOURCE + '#' + hymn.attrib['id'],
            'stanza_count': len(stanzas),
            'line_count': sum(len(s.splitlines()) for s in stanzas),
        })
    return rows

def main():
    rows = extract(Path(sys.argv[1]).read_bytes())
    (ROOT / 'candidates.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
    counts = {'source_entries': len(rows), 'eligible_before_deduplication': sum(r['disposition'] == 'eligible' for r in rows), 'excluded_translation': sum(r['reason'] == 'translation' for r in rows), 'excluded_original_language_unresolved': sum(r['reason'] == 'original_language_unresolved' for r in rows)}
    collection = {
        'gutenberg_id': '20476', 'title': 'Hymns for Christian Devotion',
        'source_url': 'https://www.gutenberg.org/ebooks/20476',
        'raw_url': RAW_URL, 'sha256': SHA256, 'encoding': 'UTF-8',
        'publication_year': 1853,
        'edition': 'Twenty-second edition; Boston: Abel Tompkins, 1853',
        'rights_evidence': [
            {'url': SOURCE, 'locator': 'title page', 'excerpt': 'TWENTY-SECOND EDITION. BOSTON: ABEL TOMPKINS. 1853.', 'conclusion': 'Edition-specific publication evidence: supplied 1853 edition, not the 1846 first copyright or 2007 eBook release.'},
            {'url': 'https://www.gutenberg.org/ebooks/20476', 'locator': 'About this eBook / Copyright', 'excerpt': 'Public domain in the USA.', 'conclusion': 'PG public-domain assessment corroborates the pre-1931 printed edition.'}
        ],
        'counts': counts,
        'scope': 'Every numbered hymn 1–1008, including the three closing doxologies. Preface, indexes, headings, meters and editorial arguments are not lyric text. Complete printed stanzas; no splitting or length truncation.',
        'attribution_policy': 'Author field retains the exact printed credit; collection names are source credits, not invented personal authors. First lines distinguish generic repeated subjects such as The Same.',
        'translation_review': 'Reviewed explicit translation notice, foreign-language authors, denominational and Ancient Hymns credits. Ancient Hymns alone is not an exclusion: Mant included original English hymns, confirmed for #903 and #981 in Julian’s Dictionary of Hymnology as reproduced by Hymnary. #979 remains held out as unresolved.',
        'review_urls': ['https://hymnary.org/text/o_it_is_joy_in_one_to_meet', 'https://www.hymnary.org/text/for_all_thy_saints_o_lord', 'https://hymnary.org/text/thy_name_be_hallowed_evermore_o_god_thy'],
        'transcription_corrections': [{'entry': '923', 'from': 'Give us in thy belovd house,', 'to': 'Give us in thy belovéd house,', 'evidence': 'Same pinned mirror plain-text 20476-8.txt; SHA256 504b0907149678e2ccd0804fa71c9adeeae8711fa336a458a8dbcd61136e255f', 'url': RAW_URL.replace('20476-h/20476-h.htm', '20476-8.txt')}],
        'deduplication': 'Deferred to the integrator against all ten collections and the existing corpus; these are eligibility counts, not imported counts.'
    }
    (ROOT / 'collection.json').write_text(json.dumps(collection, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(counts))

if __name__ == '__main__':
    main()

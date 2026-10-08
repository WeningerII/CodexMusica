#!/usr/bin/env python3
"""Integrate the ten reviewed Gutenberg collections with the existing Library.

This batch adapter never changes the shared reader or a calibration population.
Run from any directory: python3 integrate.py [--check] [--allow-partial]
"""
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT))
from quality.lyric_reader import lyric_items
from quality.audit_corpus import (
    _norm_line, ITEM_LINE_MIN_CHARS, ITEM_LINE_UBIQUITY,
    ITEM_SHARED_MIN, ITEM_OVERLAP_FLOOR, ITEM_SIG_MIN,
)

IDS = ('46041', '20476', '76498', '22223', '76941', '21300',
       '65524', '30418', '56625', '59263')
DEST = ROOT / 'corpus/library/gutenberg-ten'


def normalized(text):
    text = unicodedata.normalize('NFKD', text.casefold())
    return ' '.join(re.findall(r'[^\W_]+', ''.join(c for c in text if not unicodedata.combining(c))))


def verse_lines(text):
    return [line.strip() for line in text.splitlines()
            if line.strip() and not line.lstrip().startswith(('#', '---'))
            and not re.fullmatch(r'\[(?:VERSE(?: \d+)?|CHORUS|REFRAIN)\]', line.strip())]


class Duplicates:
    """Work matching: full normalized text or corroborated same opening.

    The opening alone never decides: at least half the distinct lines of the
    shorter version must match, and at least two lines must match. Different
    texts sharing only a common title or generic opening remain distinct.
    """
    def __init__(self):
        self.exact = {}
        self.openings = defaultdict(list)
        self.by_line = defaultdict(list)
        self.audit_lines = defaultdict(list)
        self.rows = []

    def add(self, text, reference, title):
        lines = [normalized(line) for line in verse_lines(text)]
        lines = [line for line in lines if line]
        if not lines:
            raise ValueError('empty verse: ' + reference)
        row = {'reference': reference, 'title': title, 'lines': lines}
        row['audit_signature'] = {n for n in map(_norm_line, verse_lines(text))
                                  if len(n) > ITEM_LINE_MIN_CHARS}
        self.exact.setdefault(normalized(' '.join(lines)), row)
        self.openings[lines[0]].append(row)
        for line in set(lines):
            self.by_line[line].append(len(self.rows))
        for line in row['audit_signature']:
            self.audit_lines[line].append(len(self.rows))
        self.rows.append(row)

    def match(self, text):
        lines = [normalized(line) for line in verse_lines(text)]
        lines = [line for line in lines if line]
        exact = self.exact.get(normalized(' '.join(lines)))
        if exact:
            return {'reference': exact['reference'], 'title': exact['title'],
                    'basis': 'identical words after case/punctuation/whitespace normalization'}
        if not lines:
            return None
        candidates = []
        for row in self.openings.get(lines[0], []):
            shared = len(set(lines) & set(row['lines']))
            smaller = min(len(set(lines)), len(set(row['lines'])))
            if shared >= 2 and shared / smaller >= 0.5:
                candidates.append((shared / smaller, shared, row))
        if candidates:
            ratio, shared, row = max(candidates, key=lambda x: (x[0], x[1]))
            return {'reference': row['reference'], 'title': row['title'],
                    'basis': 'same complete first line and corroborating shared verse lines',
                    'shared_distinct_lines': shared, 'shorter_version_overlap': ratio}
        # An anthology can start at a later stanza; older corpus files can
        # retain an editorial heading before the actual first sung line.
        hits = Counter(i for line in set(lines) for i in self.by_line.get(line, []))
        candidates = []
        for i, shared in hits.items():
            row = self.rows[i]
            smaller = min(len(set(lines)), len(set(row['lines'])))
            if shared >= 4 and shared / smaller >= 0.75:
                candidates.append((shared / smaller, shared, row))
        if candidates:
            ratio, shared, row = max(candidates, key=lambda x: (x[0], x[1]))
            return {'reference': row['reference'], 'title': row['title'],
                    'basis': 'at least four identical normalized verse lines covering 75% of the shorter witness',
                    'shared_distinct_lines': shared, 'shorter_version_overlap': ratio}
        signature = {n for n in map(_norm_line, verse_lines(text))
                     if len(n) > ITEM_LINE_MIN_CHARS}
        if len(signature) >= ITEM_SIG_MIN:
            hits = Counter(i for line in signature
                           if len(self.audit_lines.get(line, [])) <= ITEM_LINE_UBIQUITY
                           for i in self.audit_lines.get(line, []))
            candidates = []
            for i, shared in hits.items():
                row = self.rows[i]
                other = row['audit_signature']
                if len(other) < ITEM_SIG_MIN:
                    continue
                ratio = shared / min(len(signature), len(other))
                if shared >= ITEM_SHARED_MIN and ratio >= ITEM_OVERLAP_FLOOR:
                    candidates.append((ratio, shared, row))
            if candidates:
                ratio, shared, row = max(candidates, key=lambda x: (x[0], x[1]))
                return {'reference': row['reference'], 'title': row['title'],
                        'basis': 'existing corpus audit long-line containment criterion',
                        'shared_distinct_lines': shared, 'shorter_version_overlap': ratio}
        return None


def existing_index():
    result = Duplicates()
    files = []
    for path in sorted((ROOT / 'corpus').rglob('*.txt')):
        if path.is_relative_to(DEST) or '.LICENSE.' in path.name:
            continue
        if not path.name.startswith('eng_') and path.name not in {'sonnets.txt', 'whitman.txt'}:
            continue
        files.append({'path': path.relative_to(ROOT).as_posix(),
                      'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        if path.name in {'sonnets.txt', 'whitman.txt'}:
            from library.catalog import gutenberg_units, physical_rows
            _, physical = physical_rows(path.read_bytes())
            items = [(unit['title'], unit.get('title_line', 0),
                      '\n'.join(r['text'] for r in unit['rows'] if r['kind'] == 'lyric'))
                     for unit in gutenberg_units(path, physical)]
        else:
            items = [(title, line, '\n'.join(r.text for r in body))
                     for title, line, body in lyric_items(path)]
        for title, line, text in items:
            if verse_lines(text):
                result.add(text, path.relative_to(ROOT).as_posix() + ':' + str(line), title)
    return result, files


def dump(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'


def marked_text(item):
    """Use source chorus labels where declared; otherwise number printed stanzas."""
    sections = item.get('sections')
    if not sections:
        result, verse, pending_label = [], 0, False
        for stanza in re.split(r'\n\s*\n', item['text'].strip()):
            if not verse_lines(stanza):
                result += [stanza, '']
                pending_label = stanza.strip() in {'[CHORUS]', '[REFRAIN]'}
            elif pending_label or stanza.lstrip().startswith(('[CHORUS]', '[REFRAIN]')):
                result += [stanza, '']
                pending_label = False
            else:
                verse += 1
                result += ['[VERSE ' + str(verse) + ']', stanza, '']
        return '\n'.join(result).rstrip()
    result = []
    verse = 0
    for section in sections:
        kind = section['type'].lower()
        if kind == 'verse':
            verse += 1
            label = 'VERSE ' + str(verse)
        elif kind in {'chorus', 'refrain'}:
            label = kind.upper()
        else:
            raise ValueError('undeclared section type ' + kind)
        result += ['[' + label + ']', *section['lines'], '']
    if verse_lines('\n'.join(result)) != verse_lines(item['text']):
        raise ValueError('section declaration changes verse words: ' + item['id'])
    return '\n'.join(result).rstrip()


def build(allow_partial=False):
    duplicates, baseline = existing_index()
    records, summary, files = [], [], {}
    seen_ids = set()
    for book in IDS:
        folder = HERE / book
        if not (folder / 'candidates.json').exists() or not (folder / 'collection.json').exists():
            if allow_partial:
                continue
            raise ValueError('collection not finished: ' + book)
        metadata = json.loads((folder / 'collection.json').read_text())
        candidates = json.loads((folder / 'candidates.json').read_text())
        grouped = defaultdict(list)
        counts = Counter()
        for candidate in candidates:
            key = book + ':' + str(candidate['id'])
            if key in seen_ids:
                raise ValueError('duplicate candidate identifier ' + key)
            seen_ids.add(key)
            text = candidate['text']
            disposition = candidate['disposition']
            if disposition not in {'eligible', 'excluded'}:
                raise ValueError('unresolved candidate ' + key + ': ' + disposition)
            record = {k: v for k, v in candidate.items() if k != 'text'}
            record.update(collection=book, key=key,
                          text_sha256=hashlib.sha256(text.encode()).hexdigest())
            if disposition == 'excluded':
                if not candidate.get('reason'):
                    raise ValueError('unexplained exclusion ' + key)
                record['outcome'] = 'excluded'
            else:
                if not verse_lines(text) or not candidate.get('source_locator'):
                    raise ValueError('incomplete candidate ' + key)
                match = duplicates.match(text)
                if match:
                    record['outcome'] = 'duplicate'
                    record['duplicate_of'] = match
                else:
                    record['outcome'] = 'imported'
                    duplicates.add(text, key, candidate['title'])
                    grouped[candidate.get('author') or 'Anonymous'].append(candidate)
            counts[record['outcome']] += 1
            records.append(record)
        for author, items in sorted(grouped.items()):
            slug = re.sub(r'[^a-z0-9]+', '_', normalized(author)).strip('_')[:100] or 'anonymous'
            suffix = hashlib.sha256(author.encode()).hexdigest()[:8]
            path = DEST / book / ('eng_' + slug + '_' + suffix + '.txt')
            source = 'ProjectGutenberg/ebook_' + book
            lines = [f'# author: {author}', '# language: eng',
                     f'# source: {source} https://www.gutenberg.org/ebooks/{book}',
                     '# licence: public domain in the USA; Project Gutenberg ebook rights affirmation',
                     f'# edition: {metadata.get("edition", metadata.get("title", book))}',
                     '# attribution: printed author credit retained; see per-item source and batch evidence',
                     '# structure: stanza boundaries retained from the supplied edition',
                     '# stripped: source typography, stanza numerals, page numbers and editorial apparatus',
                     f'# songs: {len(items)}', '']
            for item in items:
                lines += [f'--- TITLE: {item["title"]} [item: PG{book}-{item["id"]}]',
                          f'--- SOURCE: PG{book} {item["source_locator"]}',
                          f'--- AUTHOR: {author}', '']
                lines += [marked_text(item), '']
            files[path] = '\n'.join(lines).rstrip() + '\n'
        summary.append({'collection': book, 'candidates': len(candidates),
                        **{k: counts[k] for k in ('imported', 'duplicate', 'excluded')}})
    report = {'version': 1, 'collection_order': list(IDS),
              'deduplication': Duplicates.__doc__, 'existing_sources': baseline,
              'summary': summary, 'entries': records}
    files[HERE / 'audit.json'] = dump(report)
    return files, summary


def _main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--allow-partial', action='store_true')
    args = parser.parse_args()
    files, summary = build(args.allow_partial)
    obsolete = set(DEST.rglob('*.txt')) - set(files) if DEST.exists() else set()
    changed = [p for p, text in files.items() if not p.exists() or p.read_text() != text]
    if args.check:
        if changed or obsolete:
            raise SystemExit('import drift: ' + ', '.join(str(p.relative_to(ROOT)) for p in changed + sorted(obsolete)))
    else:
        for path in obsolete:
            path.unlink()
        for path, text in files.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding='utf-8')
    print(dump(summary), end='')


if __name__ == '__main__':
    _main()

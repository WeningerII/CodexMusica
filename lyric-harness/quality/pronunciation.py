"""Explicit occurrence readings. No dictionary mutation or context guessing.

A declaration binds an exact lyric line and a one-based sung-token position.
It applies to all verbatim occurrences of that line, including chorus returns.
Changing that line invalidates the declaration; callers must re-declare it.
"""
import copy
import hashlib
import json
from collections import ChainMap

VOWELS = frozenset('AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW'.split())
CONSONANTS = frozenset('B CH D DH F G HH JH K L M N NG P R S SH T TH V W Y Z ZH'.split())
MAX_CHOICES = 128


def validate_choices(rows, lex):
    from lyric_harness import line_tokens, fold_apostrophes
    if not isinstance(rows, list) or len(rows) > MAX_CHOICES:
        raise ValueError('pronunciations must be a list of at most 128 occurrence declarations')
    out, seen = [], set()
    for row in rows:
        if not isinstance(row, dict) or set(row) != {'line', 'token', 'word', 'phones', 'basis', 'source'}:
            raise ValueError('each pronunciation requires line, token, word, phones, basis and source')
        line, token, word, phones = (row[k] for k in ('line', 'token', 'word', 'phones'))
        if not isinstance(line, str) or not line.strip() or len(line) > 4000 or any(c in line for c in '\r\n'):
            raise ValueError('pronunciation line must be one exact nonempty lyric line, at most 4000 characters')
        words = line_tokens(line, strip_parens=lex.strip_parens)
        if type(token) is not int or not 1 <= token <= len(words) or words[token-1] != word:
            raise ValueError('pronunciation token/word must match the exact sung token in its declared line')
        if (line, token) in seen:
            raise ValueError('duplicate pronunciation occurrence; declare one reading per token')
        seen.add((line, token))
        if not isinstance(phones, list) or not 1 <= len(phones) <= 128 or any(
            not isinstance(p, str) or not (p in CONSONANTS or
                (len(p) > 1 and p[-1] in '012' and p[:-1] in VOWELS)) for p in phones):
            raise ValueError('phones must be stressed ARPABET vowels and unnumbered ARPABET consonants')
        if not any(p[:-1] in VOWELS for p in phones):
            raise ValueError('a pronunciation requires at least one syllable nucleus')
        if row['basis'] not in ('dictionary', 'declared'):
            raise ValueError('pronunciation basis must be dictionary or declared')
        if not isinstance(row['source'], str) or not row['source'].strip() or len(row['source']) > 1000:
            raise ValueError('pronunciation source must state who chose the reading and why, or its source')
        key = fold_apostrophes(word).lower()
        if row['basis'] == 'dictionary' and phones not in lex.entries.get(key, []):
            raise ValueError(f'{word!r}: chosen phones are not a CMUdict reading; use declared with an explicit source for a supplied pronunciation')
        out.append(copy.deepcopy(row))
    return out


def fingerprint(rows):
    return hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def for_line(lex, text):
    if getattr(lex, '_pronunciation_line', None) is not None:
        return lex
    rows = getattr(lex, 'pronunciations', ())
    selected = {r['token']-1: r for r in rows if r['line'] == text}
    if not selected:
        return lex
    out = copy.copy(lex)
    out._pronunciation_line = text
    out._pronunciation_tokens = selected
    return out


def for_token(lex, index):
    if getattr(lex, '_pronunciation_choice', None):
        return lex
    row = getattr(lex, '_pronunciation_tokens', {}).get(index)
    if not row:
        return lex
    from lyric_harness import fold_apostrophes
    out = copy.copy(lex)
    out._pronunciation_choice = row
    out.entries = ChainMap({fold_apostrophes(row['word']).lower(): [row['phones']]}, lex.entries)
    return out


def declaration_coverage(rows, lines):
    return [{'id': f'pronunciation:{i+1}', 'layer': 'pronunciation',
             'status': 'answered' if row['line'] in lines else 'refused',
             'basis': row['basis'], 'source': row['source'],
             'detail': 'Explicit occurrence reading applied' if row['line'] in lines else
                       'Stale pronunciation: exact line is absent. Re-declare for the changed draft and regrade.',
             'line': row['line'], 'token': row['token'], 'word': row['word'], 'phones': row['phones'],
             'matching_lines': [n+1 for n, text in enumerate(lines) if text == row['line']]}
            for i, row in enumerate(rows)]


def reading_options(lex, lines):
    """Bounded choices from the actual lexicon, not guessed POS labels."""
    from lyric_harness import line_tokens, fold_apostrophes, syllabify
    items, total = [], 0
    seen = set()
    for line in lines:
        if line in seen:
            continue
        seen.add(line)
        for index, word in enumerate(line_tokens(line, strip_parens=lex.strip_parens)):
            prons = lex.entries.get(fold_apostrophes(word).lower(), [])
            distinct = sorted({tuple(p) for p in prons})
            if len(distinct) == 1:
                continue
            total += 1
            if len(items) < MAX_CHOICES:
                items.append({'line': line, 'token': index+1, 'word': word,
                    'matching_lines': [i+1 for i, text in enumerate(lines) if text == line],
                    'dictionary_readings': [{'phones': list(p),
                        'stress': [s['stress'] for s in syllabify(p)],
                        'syllables': len(syllabify(p))} for p in distinct],
                    'supplied_reading_requires_source': not bool(distinct)})
    return {'items': items, 'total': total, 'truncated': total > len(items)}


def for_member(lex, line, member, endpoint=-1):
    """Scope an extracted anchor label without leaking its reading elsewhere."""
    from lyric_harness import line_tokens
    scoped = for_line(lex, line)
    if not getattr(scoped, '_pronunciation_tokens', None):
        return scoped
    words = line_tokens(line, strip_parens=lex.strip_parens)
    tokens = line_tokens(member, strip_parens=lex.strip_parens)
    end = endpoint % len(words) if endpoint is not None and words else None
    starts = [i for i in range(len(words)-len(tokens)+1)
              if words[i:i+len(tokens)] == tokens and
              (end is None or i+len(tokens)-1 == end)]
    if len(starts) != 1:
        raise ValueError('cannot bind pronunciation to the extracted rhyme span unambiguously')
    start = starts[0]
    out = copy.copy(scoped)
    out._pronunciation_tokens = {i-start: row for i, row in scoped._pronunciation_tokens.items()
                                if start <= i < start+len(tokens)}
    # A one-token member is also consumed through bare-word adapter methods.
    return for_token(out, 0) if len(tokens) == 1 else out

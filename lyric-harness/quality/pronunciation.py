"""Explicit occurrence readings. No dictionary mutation or context guessing.

A declaration binds an exact lyric line and a one-based sung-token position.
It applies to all verbatim occurrences of that line, including chorus returns.
Changing that line never transports its reading. A revision may retire a
declaration whose original occurrence is gone; new text is judged independently.
"""
import copy
import hashlib
import json
from collections import ChainMap

VOWELS = frozenset('AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW'.split())
CONSONANTS = frozenset('B CH D DH F G HH JH K L M N NG P R S SH T TH V W Y Z ZH'.split())
MAX_CHOICES = 128


def dictionary_readings(lex, word):
    """-> the readings a `basis: dictionary` choice may name for `word`, in
    the lexicon's own order. A `Lexicon` answers from its exact entry, as it
    always has; a lexicon that defines `dictionary_readings` (the reviewed
    supplement, quality/lexicon_supplement.py) answers with every whole-entry
    reading it would itself consider, so the menu, the validator and the
    reader cannot disagree about what is in the dictionary."""
    own = getattr(lex, "dictionary_readings", None)
    if own is not None:
        return own(word)
    from lyric_harness import fold_apostrophes
    return [list(p) for p in lex.entries.get(fold_apostrophes(word).lower(), [])]


def validate_choices(rows, lex):
    from lyric_harness import line_tokens
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
        if row['basis'] == 'dictionary' and phones not in dictionary_readings(lex, word):
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


def declaration_coverage(rows, lines, *, original_lines=None):
    original = set(original_lines or ())
    return [{'id': f'pronunciation:{i+1}', 'layer': 'pronunciation',
             'status': ('answered' if row['line'] in lines else
                        'not_requested' if row['line'] in original else 'refused'),
             'retired': row['line'] not in lines and row['line'] in original,
             'basis': row['basis'], 'source': row['source'],
             'detail': ('Explicit occurrence reading applied' if row['line'] in lines else
                        'Original occurrence removed by revision; its reading is not applied to new text.'
                        if row['line'] in original else
                        'Stale pronunciation: exact line is absent. Re-declare for the changed draft and regrade.'),
             'line': row['line'], 'token': row['token'], 'word': row['word'], 'phones': row['phones'],
             'matching_lines': [n+1 for n, text in enumerate(lines) if text == row['line']]}
            for i, row in enumerate(rows)]


def refused_lines(coverage):
    """-> (lines, scoped): the 1-based lines a refused obligation names.

    `scoped` is False when some refused obligation names no line (a
    `function:` refusal, or an id this reader does not know), because then
    no line can be ruled out. Formats, as the grader writes them:
    `rhyme:I:J:K` and `return:I:J` name lines I and J; `prominence:LN` and
    `meter:CODE:LN` name line N.
    """
    lines, scoped = set(), True
    for oid in (coverage or {}).get('refused_obligations') or []:
        parts = str(oid).split(':')
        if parts[0] in ('rhyme', 'return') and len(parts) >= 3 \
                and parts[1].isdigit() and parts[2].isdigit():
            lines.update((int(parts[1]), int(parts[2])))
        elif parts[0] in ('prominence', 'meter') and parts[-1][:1] == 'L' \
                and parts[-1][1:].isdigit():
            lines.add(int(parts[-1][1:]))
        else:
            scoped = False
    return lines, scoped


def reading_options(lex, lines, coverage=None):
    """Bounded choices from the actual lexicon, not guessed POS labels.

    With `coverage` (the grade's own), only occurrences on a line that a
    REFUSED obligation names are listed. A reading choice can only matter
    where the grader could not decide between readings, and that is exactly
    what refuses an obligation: on a fully judged draft every reading gave
    the same verdict. Listing every ambiguous token instead filled the list
    with 'the', 'and' and 'a' (64 of 128 on a 56-line song) and let the cap
    cut off the words that were actually refused. `total` still counts every
    ambiguous occurrence; `scope` says which rule chose the listed ones.
    Without `coverage` every ambiguous occurrence is eligible, as before.
    """
    from lyric_harness import line_tokens, syllabify
    if coverage is None:
        wanted, scope = None, 'all'
    else:
        named, scoped = refused_lines(coverage)
        if not (coverage.get('refused_obligations') or []):
            wanted, scope = set(), 'no_refused_obligation'
        elif scoped:
            wanted, scope = named, 'refused_lines'
        else:
            wanted, scope = None, 'all'
    items, total, eligible = [], 0, 0
    seen = set()
    for line in lines:
        if line in seen:
            continue
        seen.add(line)
        matching = [i+1 for i, text in enumerate(lines) if text == line]
        for index, word in enumerate(line_tokens(line, strip_parens=lex.strip_parens)):
            prons = dictionary_readings(lex, word)
            distinct = sorted({tuple(p) for p in prons})
            if len(distinct) == 1:
                continue
            total += 1
            if wanted is not None and not wanted.intersection(matching):
                continue
            eligible += 1
            if len(items) < MAX_CHOICES:
                items.append({'line': line, 'token': index+1, 'word': word,
                    'matching_lines': matching,
                    'dictionary_readings': [dict({'phones': list(p),
                        'stress': [s['stress'] for s in syllabify(p)],
                        'syllables': len(syllabify(p))},
                        # Per-reading provenance where the lexicon keeps it
                        # (the reviewed supplement); absent otherwise.
                        **({'source': lex.reading_source(word, p) or 'cmudict'}
                           if hasattr(lex, 'reading_source') else {}))
                        for p in distinct],
                    'supplied_reading_requires_source': not bool(distinct)})
    out = {'items': items, 'total': total, 'truncated': eligible > len(items)}
    if coverage is not None:
        out['scope'] = scope
        out['eligible'] = eligible
    return out


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


# THE ANY-READING RULE's occurrence helpers (owner ruling 2026-10-01). The
# relation judge (`quality/relations.py`) pins one whole dictionary reading
# per cause token as an occurrence reading and asks again; these map its
# stream tokens onto the `line_tokens` coordinate occurrence readings are
# declared in, and build the declared rows. They live here, beside
# `validate_choices`, because relations.py imports nothing from
# `lyric_harness` (its P10 close).

def _occurrence_key(word):
    from lyric_harness import fold_apostrophes
    return fold_apostrophes(str(word)).lower().strip("'\".,;:!?()[]")


def occurrence_position(words, t, other_words):
    """The t-th token of `words` -> the same word's index in `other_words`
    (matched by text and by how many times it occurred before), or None."""
    if t < 0:
        t = len(words) + t
    if not (0 <= t < len(words)):
        return None
    target = _occurrence_key(words[t])
    k = sum(1 for w in words[:t] if _occurrence_key(w) == target)
    hits = [j for j, w in enumerate(other_words) if _occurrence_key(w) == target]
    return hits[k] if k < len(hits) else None


def occurrence_readings(lex, line, words, t):
    """-> (1-based line token, word, [distinct whole readings]) for the t-th
    of `words` in `line`, or None when it cannot be located or has no reading.
    A token the writer already declared answers only the declared reading."""
    from lyric_harness import line_tokens
    lt = line_tokens(line, strip_parens=lex.strip_parens)
    j = occurrence_position(words, t, lt)
    if j is None:
        return None
    tok, word = j + 1, lt[j]
    for row in getattr(lex, "pronunciations", ()) or ():
        if row["line"] == line and row["token"] == tok:
            return tok, word, [list(row["phones"])]
    uniq = []
    for p in lex.pronunciation_variants(word):
        if list(p) not in uniq:
            uniq.append(list(p))
    return (tok, word, uniq) if uniq else None


def pin_readings(lex, occurrences, source):
    """A copy of `lex` with each (line, token, word, phones) declared as an
    occurrence reading beside the writer's own, or None if one is invalid."""
    rows = [dict(r) for r in (getattr(lex, "pronunciations", ()) or ())]
    taken = {(r["line"], r["token"]) for r in rows}
    for line, tok, word, phones in occurrences:
        if (line, tok) in taken:
            continue
        rows.append({"line": line, "token": tok, "word": word,
                     "phones": list(phones),
                     "basis": ("dictionary" if list(phones) in
                               dictionary_readings(lex, word)
                               else "declared"),
                     "source": source})
        taken.add((line, tok))
    pinned = copy.copy(lex)
    for attr in ("_pronunciation_line", "_pronunciation_tokens",
                 "_pronunciation_choice"):
        pinned.__dict__.pop(attr, None)
    try:
        pinned.pronunciations = validate_choices(rows, lex)
    except ValueError:
        return None
    return pinned

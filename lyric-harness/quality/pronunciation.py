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


def _scheme(lex):
    from lyric_harness import resolve_reader_scheme
    return resolve_reader_scheme(getattr(lex, 'reader_scheme', None))


NUMBERINGS = ('v1', 'v1+voices', 'v2', 'v2+voices')


def numbering_of(lex):
    return _scheme(lex) + ('' if lex.strip_parens else '+voices')


def declared_spelling(word, token_text, line, pieces):
    """-> True when the declared `word` is the scheme-v2 token `token_text`,
    at raw `pieces` of `line`, with the printed opening quotation mark the
    reader left out of that word (`lyric_harness._opening_quotes`): for the
    token `This` of `\u2018This fair child`, a declaration naming `\u2018This`,
    or `'This` as the reader folds it, binds the token and its reading is the
    one read there.

    The source decides, not the spelling: the character just before the
    token must be an opening quotation mark the reader dropped (one mark,
    not one of a run), and `word` must be that occurrence -- the token less
    nothing but that mark. An unquoted token, another leading mark, or a doubled one is
    an ordinary spelling and is refused as one. Scheme v1 never drops a mark,
    so its callers never ask."""
    from lyric_harness import _OPENING_QUOTES, fold_apostrophes
    if not (isinstance(word, str) and isinstance(token_text, str)
            and isinstance(line, str) and pieces):
        return False
    start = pieces[0][0]
    if not 1 <= start <= len(line):
        return False
    mark = line[start - 1]
    # A mark the reader never folds to `'` (U+201B today) was never word
    # material under either scheme, so no mark was taken off this word.
    if mark not in _OPENING_QUOTES or fold_apostrophes(mark) != "'":
        return False
    if start >= 2 and fold_apostrophes(line[start - 2]) == "'":
        return False
    return word in (mark + token_text, "'" + token_text)


def _quoted_here(line, token, word, strip_parens):
    # `declared_spelling` at the v2 token `token` of `line`, read off its span.
    from lyric_harness import reader_token_spans
    spans = reader_token_spans(line, strip_parens, 'v2') or []
    if not 1 <= token <= len(spans):
        return False
    text, pieces = spans[token - 1]
    return declared_spelling(word, text, line, pieces)


def numbered_token(line, token, lex, numbering=None, word=None):
    """Resolve a caller coordinate by identical server-derived raw pieces."""
    from lyric_harness import reader_token_spans
    current = numbering_of(lex)
    if numbering is not None and numbering not in NUMBERINGS:
        raise ValueError('numbering must be v1, v1+voices, v2 or v2+voices')

    def tokens(mark):
        return reader_token_spans(line, '+voices' not in mark, mark.split('+')[0]) or []

    def at(mark):
        rows = tokens(mark)
        if type(token) is int and 1 <= token <= len(rows):
            value = rows[token - 1]
            # Quote removal is a v2 reading: under a v1 reader, or at v1
            # coordinates, the word must be exactly as written, as before.
            if (word is None or value[0] == word
                    or current.split('+')[0] == mark.split('+')[0] == 'v2'
                    and declared_spelling(word, value[0], line, value[1])):
                return value
        return None

    dst = tokens(current)
    if numbering is not None:
        origin = at(numbering)
    else:
        now = at(current)
        oldmark = 'v1' + ('' if lex.strip_parens else '+voices')
        old = at(oldmark)
        if now and old and now[1] != old[1]:
            raise ValueError(f'ambiguous token {token} in {line!r}: '
                             f'{oldmark} binds {old!r}; {current} binds {now!r}; '
                             'declare numbering explicitly')
        origin = now or old
    hits = [i + 1 for i, item in enumerate(dst) if origin is not None and item == origin]
    if len(hits) != 1:
        raise ValueError(f'cannot resolve token {token} in {line!r} under {current}: '
                         'no unique token has the same word and raw pieces; declare numbering')
    if hits[0] != token:
        notices = getattr(lex, '_numbering_notices', None)
        if notices is not None:
            notices.append(f'NUMBERING: token {token} -> {hits[0]} in {line!r} '
                           f'under {current}; identical raw pieces preserved')
    return hits[0]


def numbered_groups(groups, lines, lex, numbering=None):
    """Normalize explicit Tn slots only; named placements retain their meaning."""
    import re
    out = []
    for group in groups:
        members = []
        for member in group:
            match = re.fullmatch(r'(\d+)\.T([1-9]\d*)', str(member))
            if match:
                line, token = map(int, match.groups())
                if not 1 <= line <= len(lines):
                    raise ValueError(f'{member}: line does not exist')
                mapped = numbered_token(lines[line - 1], token, lex, numbering)
                member = f'{line}.T{mapped}'
            members.append(member)
        out.append(members)
    return out


def validate_choices(rows, lex):
    """A declaration's `token` is a 1-based position in `line_tokens` of its
    exact line, cut under the lexicon's own reader scheme: under `v2` a
    numeral token (`1966`) is a position like any other, and a declared
    reading is the only way it reads."""
    from lyric_harness import line_tokens
    if not isinstance(rows, list) or len(rows) > MAX_CHOICES:
        raise ValueError('pronunciations must be a list of at most 128 occurrence declarations')
    out, seen = [], set()
    for row in rows:
        guard = getattr(lex, '_numbering_guard', False)
        required = {'line', 'token', 'word', 'phones', 'basis', 'source'}
        if not isinstance(row, dict) or not (set(row) == required or
                guard and set(row) == required | {'numbering'}):
            raise ValueError('each pronunciation requires line, token, word, phones, basis and source')
        if 'numbering' in row and row['numbering'] not in NUMBERINGS:
            raise ValueError('numbering must be v1, v1+voices, v2 or v2+voices')
        line, token, word, phones = (row[k] for k in ('line', 'token', 'word', 'phones'))
        if not isinstance(line, str) or not line.strip() or len(line) > 4000 or any(c in line for c in '\r\n'):
            raise ValueError('pronunciation line must be one exact nonempty lyric line, at most 4000 characters')
        scheme = _scheme(lex)
        if guard and (scheme == 'v2' or 'numbering' in row):
            row = copy.deepcopy(row)
            original_token = token
            token = numbered_token(line, token, lex, row.get('numbering'), word)
            row['token'] = token
            # Keep explicit provenance and record every migrated coordinate.
            # Unmarked unchanged rows alone preserve the historical six fields.
            if 'numbering' in row or token != original_token:
                row['numbering'] = numbering_of(lex)
        words = line_tokens(line, strip_parens=lex.strip_parens, scheme=scheme)
        if (scheme == 'v2' and type(token) is int and 1 <= token <= len(words)
                and word != words[token-1] and _quoted_here(line, token, word, lex.strip_parens)):
            # The declaration names the word with its opening quotation mark;
            # it binds the token, and the row records the token's own text.
            row = copy.deepcopy(row)
            row['word'] = word = words[token-1]
        if type(token) is not int or not 1 <= token <= len(words) or words[token-1] != word:
            # Under v2 the refusal names what the position holds, because the
            # numbering moved for some lines; v1 keeps the pre-batch text.
            found = ('' if scheme == 'v1' else
                     f' ({word!r} declared; token {token} there is {words[token-1]!r})'
                     if type(token) is int and 1 <= token <= len(words)
                     else f' ({word!r} declared; the line has {len(words)} sung tokens)')
            raise ValueError('pronunciation token/word must match the exact sung token in its declared line'
                             + found)
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


def rebind_occurrences(rows, from_scheme, to_scheme, strip_parens=True):
    """-> `rows` with each declaration's `token` moved from its position under
    `from_scheme` to the token with the IDENTICAL raw span under `to_scheme`.

    A declaration names a physical token of an exact line. When the reader
    scheme changes, the same token can sit at another position (`U--h, Lawdy`
    is two tokens under `v1` and three under `v2`, so `Lawdy` moves from 2 to
    3). Its raw span does not move, so that is what binds it: the row moves to
    the one token whose pieces are the same codepoints and whose text is the
    declared word. When no such token exists the row cannot be carried and
    this raises ValueError naming it -- a declaration is never re-attached to
    a nearby word. Nothing but `token` changes, and `word` only where the
    target token is the declared word less an opening quotation mark the v2
    reader leaves out of it (`declared_spelling`); rows are copied.
    """
    from lyric_harness import reader_token_spans, resolve_reader_scheme
    out = []
    for row in rows:
        row = copy.deepcopy(row)
        line, token, word = row['line'], row['token'], row['word']
        src = reader_token_spans(line, strip_parens, from_scheme)
        if src is None or type(token) is not int or not 1 <= token <= len(src) \
                or src[token-1][0] != word:
            raise ValueError(f'cannot rebind {word!r} at token {token} of {line!r}: '
                             f'it is not that token under scheme {from_scheme}')
        dst = reader_token_spans(line, strip_parens, to_scheme)
        span = src[token-1][1]
        # The same raw occurrence, or it less the opening quotation mark the
        # reader now leaves out of the word (`declared_spelling`).
        unquoted = ((span[0][0] + 1, span[0][1]),) + tuple(span[1:]) if span else span
        to_v2 = resolve_reader_scheme(to_scheme) == 'v2'
        hits = [k for k, (text, pieces) in enumerate(dst or ())
                if (pieces == span and text == word)
                or (to_v2 and pieces == unquoted and declared_spelling(word, text, line, pieces))]
        if len(hits) != 1:
            raise ValueError(f'cannot rebind {word!r} at token {token} of {line!r}: '
                             f'no token under scheme {to_scheme} has the same raw span')
        row['token'] = hits[0] + 1
        # A row bound by its span less a dropped opening quote names the v2
        # token's own text, as `validate_choices` records it there.
        row['word'] = dst[hits[0]][0]
        out.append(row)
    return out


#: The approved runtime asset whose declarations were BOUND UNDER READER
#: SCHEME v1: prepared 2026-10-09, before the reader batch, and hash-pinned in
#: `data/runtime_assets.json` (the reader scheduler injects one candidate's
#: set as a Library analysis's declarations). Its bytes stay as approved; a
#: `v2` reader rebinds a set from it by raw span (`rebind_occurrences`), and a
#: `v1` replay reads it verbatim.
V1_BOUND_ASSET = 'gutenberg_next_ten_pronunciations'
_V1_BOUND_SETS = None


def v1_bound_declarations(rows):
    """-> True when `rows` is exactly one candidate's declaration set from
    `V1_BOUND_ASSET`, read from the files whose sizes and sha256 the runtime
    registry pins (a file that is not those bytes contributes nothing)."""
    global _V1_BOUND_SETS
    if _V1_BOUND_SETS is None:
        import os
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sets = set()
        try:
            with open(os.path.join(root, 'data', 'runtime_assets.json'), encoding='utf-8') as fh:
                registry = json.load(fh)
            asset = next(a for a in registry.get('assets', []) if a.get('id') == V1_BOUND_ASSET)
            for entry in asset.get('files', []):
                if entry['path'].endswith('/bindings.json'):
                    continue
                with open(os.path.join(root, entry['path']), 'rb') as fh:
                    raw = fh.read()
                if len(raw) != entry['bytes'] or hashlib.sha256(raw).hexdigest() != entry['sha256']:
                    continue
                for payload in json.loads(raw.decode('utf-8')).values():
                    sets.add(fingerprint(payload.get('pronunciations') or []))
        except (OSError, ValueError, StopIteration, KeyError):
            sets = set()
        _V1_BOUND_SETS = frozenset(sets)
    return bool(rows) and fingerprint(rows) in _V1_BOUND_SETS


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
    `function:` refusal without a location, or an id this reader does not know), because then
    no line can be ruled out. Formats, as the grader writes them:
    `rhyme:I:J:K` and `return:I:J` name lines I and J; `prominence:LN` and
    `meter:CODE:LN` and `function:CODE:TN:LN` name line N.
    """
    lines, scoped = set(), True
    refused = (coverage or {}).get('refused_obligations') or []
    details = [oid for oid in refused if oid.startswith('function:') and oid != 'function:draft']
    located_function = details and all(oid.split(':')[-1][:1] == 'L' and
                                     oid.split(':')[-1][1:].isdigit() for oid in details)
    for oid in refused:
        if oid == 'function:draft' and located_function:
            continue
        parts = str(oid).split(':')
        if parts[0] in ('rhyme', 'return') and len(parts) >= 3 \
                and parts[1].isdigit() and parts[2].isdigit():
            lines.update((int(parts[1]), int(parts[2])))
        elif parts[0] in ('prominence', 'meter', 'function') and parts[-1][:1] == 'L' \
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
        for index, word in enumerate(line_tokens(line, strip_parens=lex.strip_parens,
                                                 scheme=_scheme(lex))):
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
                    'numbering': numbering_of(lex),
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
    words = line_tokens(line, strip_parens=lex.strip_parens, scheme=_scheme(lex))
    tokens = line_tokens(member, strip_parens=lex.strip_parens, scheme=_scheme(lex))
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
    lt = line_tokens(line, strip_parens=lex.strip_parens, scheme=_scheme(lex))
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
    # THE SERVER'S OWN ROWS SAY WHICH CUT THEY WERE TAKEN UNDER (H1,
    # 2026-10-15). `occurrences` are this lexicon's own token positions, so
    # under the CLI's numbering guard each synthesized row carries
    # `numbering_of(lex)`: the unmarked-caller ambiguity rule exists for
    # rows whose cut nobody recorded, and applying it here refused a reading
    # the server itself chose wherever the v1 and v2 cuts put different
    # words at one index (`Read--read, read it again`, T2). Caller rows are
    # validated exactly as before; an unguarded lexicon keeps six fields.
    mark = ({"numbering": numbering_of(lex)}
            if getattr(lex, "_numbering_guard", False) else {})
    for line, tok, word, phones in occurrences:
        if (line, tok) in taken:
            continue
        rows.append({"line": line, "token": tok, "word": word,
                     "phones": list(phones),
                     "basis": ("dictionary" if list(phones) in
                               dictionary_readings(lex, word)
                               else "declared"),
                     "source": source, **mark})
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

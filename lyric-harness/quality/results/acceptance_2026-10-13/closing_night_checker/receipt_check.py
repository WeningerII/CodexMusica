"""Independent receipt checks for the "Closing Night" acceptance run (agreement v2, items 5 and 6).

BB8 wrote this; Don checks the same evidence by his own method, and the two results are compared.
It reads captured tool results only. It calls nothing and changes nothing.

Inputs are captured tool results in whatever wrapper the capture used: the raw MCP result
({"content": [{"type": "text", "text": ...}]}), a get_operation reply ({"tool_result": {...}}),
the inner JSON, or a text block followed by a JSON receipt. Every string that is itself JSON is
opened, so nested wrappers don't matter. Redacted ids ("[REDACTED…]") are fine: no compared field
is an id.

  python3 receipt_check.py recover BEFORE AFTER [--accepted-edit --changed=5,7]
      Compares two `lyric_revise recover_only: true` exports, read just before an interruption
      and just after the resume.
      Without --accepted-edit: every identity field must be equal (no accepted edit between them).
      With --accepted-edit: the lines in --changed may differ and the answers on record must grow;
      every other line must be byte-identical. The scorer must be kept.

  python3 receipt_check.py final RECEIPT SONG.txt
      RECEIPT is the final get_operation result; SONG.txt is the song exactly as the host showed it
      to the user. The song in the receipt must equal SONG.txt byte for byte (one trailing newline
      on SONG.txt is tolerated and reported). Every final_draft in the receipt must match. Also prints reader_scheme and comparator_fingerprint
      for the release gate (item 3).

Exit 0 = every check passed, 1 = a check failed, 2 = the input couldn't be read as a receipt.
"""
import hashlib
import json
import sys

IDENTITY = ('original_wire_sha256', 'original_wire_bytes', 'cursor_seal', 'scorer', 'digest',
            'connector_semantic_identity', 'source_semantic_identity', 'checksum_verified',
            'reader_scheme', 'comparator_fingerprint')


def opened(value):
    """The value with every JSON-in-a-string opened, recursively."""
    if isinstance(value, str):
        s = value.strip()
        if s[:1] in '{[':
            try:
                return opened(json.loads(s))
            except ValueError:
                pass
        # a text block that ends with a JSON receipt
        cut = s.find('\n{')
        if cut >= 0:
            try:
                return [s[:cut], opened(json.loads(s[cut + 1:]))]
            except ValueError:
                pass
        return value
    if isinstance(value, list):
        return [opened(v) for v in value]
    if isinstance(value, dict):
        return {k: opened(v) for k, v in value.items()}
    return value


def load(path):
    raw = open(path, 'rb').read()
    try:
        return opened(json.loads(raw.decode('utf-8')))
    except ValueError:
        return opened(raw.decode('utf-8'))


def every(node, key, path=''):
    """(path, value) for every occurrence of key, in document order."""
    if isinstance(node, dict):
        for k, v in node.items():
            p = f'{path}.{k}'
            if k == key:
                yield p, v
            yield from every(v, key, p)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from every(v, key, f'{path}[{i}]')


def first(node, key):
    return next((v for _, v in every(node, key)), None)


def short(v):
    s = json.dumps(v, ensure_ascii=False)
    return s if len(s) <= 90 else s[:87] + '...'


def recover(before_p, after_p, accepted_edit, changed):
    b, a = load(before_p), load(after_p)
    if first(b, 'final_draft') is None or first(a, 'final_draft') is None:
        print('UNREADABLE: no final_draft in one of the exports (is this a recover_only result?)')
        return 2
    ok = True
    print(f'recover_only comparison ({"accepted edit expected" if accepted_edit else "no accepted edit"})')
    for key in IDENTITY:
        bv, av = [v for _, v in every(b, key)], [v for _, v in every(a, key)]
        if not bv and not av:
            print(f'  absent  {key} (in neither export)')
            continue
        moves = accepted_edit and key not in ('scorer', 'checksum_verified', 'reader_scheme', 'comparator_fingerprint')
        same = bv == av
        if not same and not moves:
            ok = False
        tag = 'EQUAL ' if same else ('moved ' if moves else 'DIFFER')
        print(f'  {tag}  {key}: {short(bv[0]) if bv else "-"}' + ('' if same else f'  ->  {short(av[0]) if av else "-"}'))
    for v in [v for _, v in every(a, 'checksum_verified')]:
        if v is not True:
            ok = False
            print('  FAIL    checksum_verified is not true after the resume')
    bd, ad = first(b, 'final_draft'), first(a, 'final_draft')
    if len(bd) != len(ad):
        ok = False
        print(f'  FAIL    line count {len(bd)} -> {len(ad)}')
    for i, (x, y) in enumerate(zip(bd, ad), 1):
        if x == y:
            continue
        if accepted_edit and i in changed:
            print(f'  edit    L{i}: {x!r} -> {y!r}')
        else:
            ok = False
            print(f'  FAIL    L{i} changed and is protected: {x!r} -> {y!r}')
    if accepted_edit:
        unchanged = [i for i in changed if i <= len(bd) and bd[i - 1] == ad[i - 1]]
        if unchanged:
            print(f'  note    lines allowed to change but unchanged: {unchanged}')
        nb = len(json.dumps(first(b, 'answered'), sort_keys=True))
        na = len(json.dumps(first(a, 'answered'), sort_keys=True))
        if na <= nb:
            ok = False
            print('  FAIL    no new answer on record after an accepted edit')
    print('PASS' if ok else 'FAIL')
    return 0 if ok else 1


def final(receipt_p, song_p):
    r = load(receipt_p)
    shown = open(song_p, 'rb').read()
    candidates = []
    for key in ('final_draft', 'song', 'lyrics', 'draft'):
        for path, v in every(r, key):
            if isinstance(v, list) and v and all(isinstance(x, str) for x in v):
                candidates.append((path, '\n'.join(v).encode('utf-8')))
            elif isinstance(v, str) and '\n' in v:
                candidates.append((path, v.encode('utf-8')))
    if not candidates:
        print('UNREADABLE: no song found in the receipt (looked for final_draft, song, lyrics, draft)')
        return 2
    print(f'shown song: {len(shown)} bytes, sha256 {hashlib.sha256(shown).hexdigest()}')
    for key in ('reader_scheme', 'comparator_fingerprint', 'certified', 'exit_code', 'status'):
        vals = sorted({json.dumps(v) for _, v in every(r, key)})
        print(f'  {key}: {", ".join(vals) if vals else "absent"}')
    # PASS needs at least one equal copy, and every final_draft equal: a receipt whose final_draft
    # disagrees with the shown song fails even if some other copy (an earlier draft) happens to match
    ok, all_final = False, True
    for path, song in candidates:
        h = hashlib.sha256(song).hexdigest()
        if song == shown:
            verdict = 'EQUAL'
        elif song + b'\n' == shown:
            verdict = 'EQUAL apart from one trailing newline on the shown copy'
        else:
            verdict = 'DIFFERENT'
        ok |= verdict.startswith('EQUAL')
        if path.endswith('.final_draft') and not verdict.startswith('EQUAL'):
            all_final = False
        print(f'  receipt {path}: {len(song)} bytes, sha256 {h}: {verdict}')
        if verdict == 'DIFFERENT':
            sl, rl = shown.decode('utf-8', 'replace').split('\n'), song.decode('utf-8', 'replace').split('\n')
            for i in range(max(len(sl), len(rl))):
                x, y = (sl[i] if i < len(sl) else None), (rl[i] if i < len(rl) else None)
                if x != y:
                    print(f'      first difference at line {i + 1}: shown {x!r} vs receipt {y!r}')
                    break
    ok = ok and all_final
    print('PASS' if ok else 'FAIL')
    return 0 if ok else 1


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a.split('=')[0]: (a.split('=', 1)[1] if '=' in a else True) for a in sys.argv[1:] if a.startswith('--')}
    if len(args) == 3 and args[0] == 'recover':
        changed = {int(x) for x in str(flags.get('--changed', '')).split(',') if x.strip().isdigit()}
        sys.exit(recover(args[1], args[2], bool(flags.get('--accepted-edit')), changed))
    if len(args) == 3 and args[0] == 'final':
        sys.exit(final(args[1], args[2]))
    print(__doc__)
    sys.exit(2)

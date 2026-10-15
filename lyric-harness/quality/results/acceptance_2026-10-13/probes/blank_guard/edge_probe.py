"""Edge cases for the #570 rule "a replacement must hold a letter or a numeral".

    cd <tree>/lyric-harness && python3 edge_probe.py <tree>/lyric-harness OUT.json

Every case with a letter (str.isalpha) or a Unicode numeral (category N*) must
splice at both the end slot and 1.T2 under v1 and v2; every case with neither
must decline at both. Exit 0 when all cases match.
"""
import json, sys, unicodedata
ROOT, OUT = sys.argv[1], sys.argv[2]
sys.path.insert(0, ROOT)
from lyric_harness import Lexicon
from quality.loop import swap_end_word, swap_at_slot
from quality.slots import parse_slot

CASES = ['2', '7th', '1999', "don't", "rock'n'roll", '—love', 'love!', 'café', 'naïve',
         '日本', 'Ⅻ', '½', '٣', 'x​', '​x', 'A',
         '♪', '!!', '́', '#', '$', '…']
def expect(w):
    return 'spliced' if any(c.isalpha() or unicodedata.category(c)[0] == 'N' for c in w) else 'declined'
LINE = 'the room on fire'
rows, ok = [], True
for scheme in ('v1', 'v2'):
    lex = Lexicon(reader_scheme=scheme)
    for w in CASES:
        e = swap_end_word(LINE, w, scheme=scheme, lex=lex)
        s = swap_at_slot(LINE, parse_slot('1.T2'), w, scheme=scheme, lex=lex)
        res = {'end': 'declined' if e is None else 'spliced', 'T2': 'declined' if s is None else 'spliced'}
        want = expect(w)
        good = res['end'] == res['T2'] == want
        ok &= good
        rows.append({'scheme': scheme, 'word': w, 'codepoints': [f'U+{ord(c):04X}' for c in w],
                     'expect': want, 'end': e, 'T2': s, 'result': res, 'pass': good})
        print(scheme, f"{json.dumps(w):16s}", f"want={want:8s}", res, 'PASS' if good else 'FAIL', repr(e)[:40])
json.dump({'ok': ok, 'line': LINE, 'rows': rows}, open(OUT, 'w'), indent=1, ensure_ascii=False)
print('OK' if ok else 'FAIL')
sys.exit(0 if ok else 1)

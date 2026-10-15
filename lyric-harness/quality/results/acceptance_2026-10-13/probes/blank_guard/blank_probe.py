"""Acceptance probe for #561 (blank-replacement guard, head d85d2f26).

    cd <tree>/lyric-harness && python3 blank_probe.py <tree>/lyric-harness OUT.json

For each replacement word, under reader schemes v1 and v2, it calls the
tree's own `swap_end_word` and `swap_at_slot` (slot 1.T2) on
'the room on fire'. A replacement is classified by what it would leave:
- `blank`: empty or whitespace only (the case #561 targets);
- `invisible`: only Unicode format/space characters (category Cf or Zs);
- `punct`: only punctuation;
- `word`: has a letter (control; must still splice).
`declined` means the swap returned None. The exit status is 0 when every
`blank` case declines and every `word` case splices; `invisible` and `punct`
are reported, not gated, until a rule is set (#527 6194001452).
"""
import json, os, sys, unicodedata
ROOT, OUT = sys.argv[1], sys.argv[2]
sys.path.insert(0, ROOT)
from lyric_harness import Lexicon
from quality.loop import swap_end_word, swap_at_slot
from quality.slots import parse_slot

WORDS = ['', ' ', '\t', ' ', '　', '​', '­', '⁠', '﻿', '᠎', '‍',
         '-', "'", '...', '—', 'blaze', 'x']
def kind(w):
    if not w.strip():
        return 'blank'
    if any(unicodedata.category(c).startswith('L') for c in w):
        return 'word'
    if all(unicodedata.category(c) in ('Cf', 'Zs') for c in w):
        return 'invisible'
    return 'punct'
LINE = 'the room on fire'
rows, ok = [], True
for scheme in ('v1', 'v2'):
    lex = Lexicon(reader_scheme=scheme)
    for w in WORDS:
        k = kind(w)
        e = swap_end_word(LINE, w, scheme=scheme, lex=lex)
        s = swap_at_slot(LINE, parse_slot('1.T2'), w, scheme=scheme, lex=lex)
        res = {'end': 'declined' if e is None else 'spliced', 'T2': 'declined' if s is None else 'spliced'}
        if k == 'blank':
            good = res['end'] == res['T2'] == 'declined'
        elif k == 'word':
            good = res['end'] == res['T2'] == 'spliced'
        else:
            good = None
        if good is False:
            ok = False
        rows.append({'scheme': scheme, 'word': w, 'codepoints': [f'U+{ord(c):04X}' for c in w], 'kind': k,
                     'end': e, 'T2': s, 'result': res, 'gated_pass': good})
        print(scheme, f"{json.dumps(w):10s}", f"{k:9s}", res, '' if good is None else ('PASS' if good else 'FAIL'))
json.dump({'ok': ok, 'line': LINE, 'rows': rows}, open(OUT, 'w'), indent=1, ensure_ascii=False)
print('OK' if ok else 'FAIL')
sys.exit(0 if ok else 1)

import sys
sys.path.insert(0, sys.argv[1])
import lyric_harness as LH
from quality.pronunciation import pin_readings, dictionary_readings
line = "Read--read, read it again"
for scheme in ("v2",):
    lex = LH.Lexicon(reader_scheme=scheme)
    print("tokens", LH.line_tokens(line, strip_parens=True, scheme=scheme))
    rd = dictionary_readings(lex, "read")
    print("readings of read:", rd)
    for guard in (False, True):
        if guard:
            lex._numbering_guard = True; lex._numbering_notices = []
        for tok in (1, 2, 3):
            w = LH.line_tokens(line, strip_parens=True, scheme=scheme)[tok-1]
            r = dictionary_readings(lex, w.lower()) or dictionary_readings(lex, w)
            got = pin_readings(lex, [(line, tok, w, list(r[0]))], "probe")
            print(f"guard={guard} tok={tok} word={w!r} pinned={'None (refused)' if got is None else [ (p['token'], p.get('numbering')) for p in got.pronunciations]}")

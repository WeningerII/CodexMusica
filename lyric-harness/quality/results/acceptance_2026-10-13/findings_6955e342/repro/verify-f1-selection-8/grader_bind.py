# Which word the candidate harness binds for 1.T4 / 1.T5 on the fixture line,
# under the default reader scheme and under v1 / v2 explicitly (scratch only).
import sys, json
import lyric_harness as LH
from quality import slots as SL
line = "Oh--oh, oh my love"
out = {}
for scheme in (None, "v1", "v2"):
    lex = LH.Lexicon() if scheme is None else LH.Lexicon(reader_scheme=scheme)
    row = {}
    for slot in ("1.T4", "1.T5", "1.end"):
        try:
            r = SL.resolve(lex, line, SL.parse_slot(slot))
            row[slot] = r[1]
        except Exception as e:
            row[slot] = "ERR " + type(e).__name__ + ": " + str(e)[:120]
    out[str(scheme) + (" (default=%s)" % getattr(lex, "reader_scheme", "?") if scheme is None else "")] = row
print(json.dumps(out, indent=1))

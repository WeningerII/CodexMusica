"""Generated lines for the English reader's property tests and fixtures.

`generated_lines(n, seed)` builds lyric-shaped lines from an alphabet that
carries every character class the reader treats specially: Latin letters
inside and outside ASCII, the eight folded apostrophes, single hyphens,
ASCII dash runs, U+2010/U+2011/U+00AD, the em and en dash, combining marks,
digits and other General_Category N characters (fractions, superscripts,
Arabic-Indic digits, Roman numerals, circled numbers), letters of scripts
CMUdict cannot read, U+00D7/U+00F7 inside the repertoire range, U+2032,
Hangul jamo (a starter-starter NFC composition), spaced enclitics,
parentheses (nested and unclosed), NBSP and U+0085.

The generator is a fixed xorshift, not `random`, so the same seed gives the
same lines on every Python version and the fixtures built from it
(`quality/fixtures/reader_v1_oracle.json`, `reader_v2_mirror.json`) can be
checked for freshness. No line here is a named-word acceptance list: the
inputs are generated, and `REGRESSIONS` holds only the reproductions of
defects the reader batch was measured on.

RESIDUAL, DISCLOSED: the website mirror (`src/lyric-tokens.js`) agrees with
the grader only inside the Unicode version both runtimes carry. General
categories come from Python's `unicodedata` and from the JavaScript engine's
own tables, so a character assigned in a newer Unicode than Python's reads as
a letter or numeral on the page and as nothing in the grader (measured: Node
22 carries Unicode 16.0, Python 3.13 carries 15.1, and `love \U0001CCF1` is
two tokens on the page and one in the grader). The alphabet here stays inside
characters both versions assign.
"""

LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
ACCENTED = ["é", "ÿ", "â", "ŵ", "ø", "ẞ", "ñ", "Ó", "ǣ", "ḿ"]
MARKS = ["́", "̈", "̧", "̃"]
APOSTROPHES = ["'", "’", "‘", "ʼ", "ʻ", "՚",
               "＇", "`", "´"]
HYPHENS = ["-", "-", "--", "---", "‐", "‑", "­", "—",
           "–", "-­-"]
NUMERALS = ["0", "1", "2", "4", "7", "9", "19", "66", "½", "٣",
            "²", "Ⅻ", "①", "१"]
FOREIGN = ["δ", "我", "ж", "ا", "א"]
ODD = ["×", "÷", "′", "가", "&", "_", "*"]
SEPARATORS = [" ", " ", " ", " ", "  ", " ", "\u0085", "\t", ", ",
              ". ", "! ", "; ", ": ", " — ", " -- ", " (", ") ",
              " (oh) ", "((", "))", " \"", "\" "]
ENCLITICS = [" 's", " 'll", " 're", " 've", " 'd", " 'm", " ’s",
             " 'll", " 't", " 'n"]


def _xorshift(seed):
    x = (seed or 1) & 0xFFFFFFFF
    while True:
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        yield x


def generated_lines(n=1500, seed=20261013):
    """-> n generated lines, deterministic in `seed`."""
    rnd = _xorshift(seed)

    def pick(seq):
        return seq[next(rnd) % len(seq)]

    def chance(k):
        return next(rnd) % 100 < k

    out = []
    for _ in range(n):
        words = []
        for _w in range(1 + next(rnd) % 6):
            frag = []
            for _f in range(1 + next(rnd) % 7):
                r = next(rnd) % 100
                if r < 55:
                    frag.append(pick(LETTERS))
                elif r < 62:
                    frag.append(pick(ACCENTED))
                elif r < 66:
                    frag.append(pick(MARKS))
                elif r < 73:
                    frag.append(pick(APOSTROPHES))
                elif r < 81:
                    frag.append(pick(HYPHENS))
                elif r < 90:
                    frag.append(pick(NUMERALS))
                elif r < 94:
                    frag.append(pick(FOREIGN))
                else:
                    frag.append(pick(ODD))
            word = "".join(frag)
            if chance(8):
                word += pick(ENCLITICS)
            words.append(word)
        line = words[0]
        for w in words[1:]:
            line += pick(SEPARATORS) + w
        if chance(10):
            line += pick(SEPARATORS).rstrip() or ","
        out.append(line)
    return out


#: Reproductions of the defects the reader batch was measured on (its spec's
#: `verified_by_running`). Regression inputs, not an acceptance list.
REGRESSIONS = [
    "There 's (oh) 'em ol' 4ever--no",
    "we sing 4ever",
    "I love the B-52s",
    "I read Catch-22",
    "the year 1999",
    "thee--Arise",
    "--and so",
    "word--word and --and",
    "co‐operate now",
    "co‑operate now",
    "soft­ware",
    "Read cafés record",
    "Sing cafés",
    "we go (oh) 's the night",
    "There 's high",
    "U--h, u--h, Lawdy,",
    "U--h, Lawdy, ol’ lady got rough,",
    "The rose prepar’d",
    "a (b (c) d) e",
    "a (b c",
    "heart.    10",
    "I said ×",
    "x ×2",
    "cat 我",
    "abcδef",
    "1-2",
    "R2-D2 song",
    "line 12",
    "Wha 'll buy caller herrin'",
    "`tis the season",
    "pie--'",
    "we drove away (chorus)",
    "the minute′s mark",
    "가 is jamo",
]


#: Reproductions found after the v1 oracle was captured (so they are not in
#: `REGRESSIONS`, whose v1 answers the oracle pins): read under v2 only, and
#: carried into the mirror fixture. A soft hyphen beside or inside an
#: enclitic, a Hangul jamo composition beside Latin words, a numeral run that
#: is not one whole English token, and a starter NFC replaces on its own
#: (U+2000/U+2001 quads, U+037E, U+0387) before combining marks, whose raw
#: runs must not take the space or the punctuation in.
V2_REGRESSIONS = [
    "go 'm\u00adidst",
    "There '\u00ads high",
    "There\u00ad 's high",
    "love,night \u1100\u1161 sing",
    "\u1100\u1161\u11a8 cafe\u0301, night",
    "x \u00d72",
    "go \u043a\u043e\u04425",
    "I love\u2001\u0308night",
    "go\u2000\u0301bed",
    "love\u037e\u0301night",
    "a\u0387\u0327\u0301b",
]


#: Codepoints where a character class the mirror spells out has differed, or
#: could differ, from Python's -- enumerated over every codepoint both Unicode
#: versions assign, not chosen by example. U+0345 is the one character a
#: case-insensitive `[\p{L}\p{N}_]` matches and Python's `\w` does not (it
#: case-folds to Greek iota); U+017F is the one non-ASCII letter `re.I`
#: matches for an enclitic letter (`s`); U+FEFF is in JavaScript's `\s` and
#: not Python's, U+001C-U+001F and U+0085 the reverse; U+180E was whitespace
#: in older Unicode. `scripts/test_lyric_tokens.js` re-enumerates the
#: case-fold difference in the engine it runs on and checks every codepoint it
#: finds is here.
CLASS_BOUNDARY_CODEPOINTS = ["\u0345", "\u017f", "\ufeff", "\u001c", "\u001d",
                             "\u001e", "\u001f", "\u0085", "\u180e"]


def class_boundary_lines():
    """-> lines putting each `CLASS_BOUNDARY_CODEPOINTS` character where a
    class decides the cut: after a spaced enclitic (the `\\b`), before the
    space a join removes (the `\\w`), as that space, as an enclitic letter's
    neighbour, and inside a word."""
    out = []
    for c in CLASS_BOUNDARY_CODEPOINTS:
        out += [f"dog 's{c} bone", f"dog{c} 's bone", f"dog{c}'s bone",
                f"dog {c}'s bone", f"dog '{c} bone", f"dog 'm{c}e x",
                f"a{c}b night", f"night{c}"]
    return out


MIRROR_FIXTURE = "quality/fixtures/reader_v2_mirror.json"


def mirror_fixture():
    """-> the Python side of the website mirror's agreement check: for every
    generated line and regression, under both paren declarations, each
    `reader_line` token and run as [text, codepoint pieces, numeral, aside].
    `scripts/test_lyric_tokens.js` reads `MIRROR_FIXTURE` and compares
    `src/lyric-tokens.js` with it; `quality/test_reader.py` checks the file is
    what this function returns now (its freshness)."""
    import lyric_harness as LH

    def rows(seq):
        return [[t.text, [list(p) for p in t.pieces], t.numeral, t.aside] for t in seq]
    out = []
    for text in (generated_lines(1000, seed=7) + REGRESSIONS + V2_REGRESSIONS
                 + class_boundary_lines()):
        row = {"text": text}
        for sp, key in ((True, "strip"), (False, "keep")):
            rl = LH.reader_line(text, strip_parens=sp, scheme="v2")
            row[key] = {"tokens": rows(rl.tokens), "runs": rows(rl.runs)}
        out.append(row)
    return {"scheme": "v2", "generator": "quality/reader_cases.py mirror_fixture()",
            "cases": out}


if __name__ == "__main__":
    import json
    import os
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        MIRROR_FIXTURE)
    text = json.dumps(mirror_fixture(), ensure_ascii=False, separators=(",", ":")) + "\n"
    if sys.argv[1:] == ["--write"]:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)
    elif sys.argv[1:] == ["--check"]:
        with open(path, encoding="utf-8") as fh:
            sys.exit(0 if fh.read() == text else 1)
    else:
        sys.exit("usage: python3 quality/reader_cases.py --write|--check")

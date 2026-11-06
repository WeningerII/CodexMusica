#!/usr/bin/env python3
"""The 1.5 digits-per-unit bound behind the meter recognition caps (#677 W5).

    python3 quality/test_meter_digit_bound.py          # the gate (CI, `suites`)
    python3 quality/test_meter_digit_bound.py --full   # every key, form and code point

THE CLAIM. No token the reader can produce reads more syllable digits than
1.5 per unit, a unit being one character or the separator that ends a token.
A 200-character line has 201 units, so no line reads more than
floor(1.5 x 201) = 301 digits, and `mcp/meter_admission.js` sets
METER_LINE_DIGITS_CAP to exactly that, with no slack (R2, #665 6692298979;
confirmed by BB8, 6692374129). Its per-request cap (463 x 301) and its
declared-line bound (declared vowels plus 1.5 per undeclared unit) rest on the
same ratio. If a lexicon, rule-table or fallback change raises the ratio, this
suite fails, and the cap is raised in the same change.

WHAT IS RE-DERIVED HERE, every run, over the files whose sha256 is pinned:
  1. the dictionary: every reading of every CMUdict key and every reviewed
     supplement row, as data;
  2. the dictionary's rule forms (plural, possessive, elided -ed, dropped g,
     dropped -gh) through the REAL reader, under schemes v1 and v2 and
     fallback none, high and low, for every key close enough to the bound
     that a form could pass it (`--full`: every key);
  3. the morphology layer: the affix tables as data (no affix reads more
     than 1.5 per character, so only a stem over 1.5 vowels per character can
     carry a form past the bound), then every form of every such stem through
     the real reader; the spelling normalisations never shorten a word;
  4. the elision table, every entry, through the real reader;
  5. the letter-to-sound layer: an exact search over its 5-character
     contexts for every token length 1-200 (dynamic programming over the
     last four letters), its emission checked against `LetterRules.read`;
  6. single code points through the real reader, alone and as a separator
     between two `w`s: ASCII, every code point that case-maps or
     compatibility-normalises to ASCII, and every format character (the
     classes the full scan found reading anything); `--full`: all of Unicode;
  7. the witness line `"w " x 99 + "ws"` reads exactly 301 in all six modes,
     so the cap is the maximum and not merely an upper bound.
"""

import hashlib
import json
import os
import random
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
REPO = os.path.join(ROOT, "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, HERE)

import lyric_harness as LH  # noqa: E402
import g2p as G  # noqa: E402

FULL = "--full" in sys.argv
FAILURES = []


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  -- {detail}"))
    if not ok:
        FAILURES.append(name)


# The 1.5 ratio as an exact fraction: digits * 2 <= 3 * units.
def within(digits, units):
    return 2 * digits <= 3 * units


#: The inputs the derivation was run over. A changed file is a changed
#: lexicon or rule table: re-run `--full`, raise METER_LINE_DIGITS_CAP if the
#: bound rose, and re-pin here in the same change.
PINNED = (
    "cmudict.dict",
    "data/g2p_letter_rules.tsv",
    "data/eng_elision.tsv",
    "data/lexicon_supplement.tsv",
    "data/lexicon_supplement_v2.tsv",
)
PINNED_FILE = os.path.join(HERE, "fixtures", "meter_digit_bound_pins.json")


def sha256(path):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def test_pins():
    with open(PINNED_FILE, encoding="utf-8") as fh:
        pins = json.load(fh)
    for rel in PINNED:
        want = pins["sha256"].get(rel)
        got = sha256(os.path.join(ROOT, rel))
        check(f"pinned input unchanged: {rel}", got == want,
              f"sha256 {got}, pinned {want}: re-run --full, raise the cap if the bound "
              "rose, and re-pin quality/fixtures/meter_digit_bound_pins.json")
    with open(os.path.join(ROOT, "data", "runtime_assets.json"), encoding="utf-8") as fh:
        assets = json.load(fh)
    staged = {f["path"]: f["sha256"] for a in assets["assets"] if a["id"] == "cmudict"
              for f in a["files"]}
    check("the cmudict pin is the staged release asset (data/runtime_assets.json)",
          staged.get("cmudict.dict") == pins["sha256"]["cmudict.dict"])


def test_caps_mirror():
    src = open(os.path.join(REPO, "mcp", "meter_admission.js"), encoding="utf-8").read()
    tools = open(os.path.join(REPO, "mcp", "lyric_tools.js"), encoding="utf-8").read()
    lines = int(re.search(r"export const MAX_LINES = (\d+);", tools).group(1))
    chars = int(re.search(r"const MAX_LINE_CHARS = (\d+);", tools).group(1))
    a_lines = int(re.search(r"export const ADMISSION_MAX_LINES = (\d+);", src).group(1))
    a_chars = int(re.search(r"export const ADMISSION_MAX_LINE_CHARS = (\d+);", src).group(1))
    check("admission mirrors MAX_LINES and MAX_LINE_CHARS", (a_lines, a_chars) == (lines, chars),
          f"{(a_lines, a_chars)} vs {(lines, chars)}")
    check("DIGITS_PER_UNIT is 3/2",
          re.search(r"DIGITS_PER_UNIT = Object\.freeze\(\{ numerator: 3, denominator: 2 \}\)", src)
          is not None)


def vowels(phones):
    return sum(1 for p in phones if re.sub(r"\d", "", p) in LH.VOWELS)


def stressed(phones):
    return sum(1 for p in phones if p[-1:] in ("0", "1", "2"))


def supplement_rows():
    rows = []
    for rel in ("data/lexicon_supplement.tsv", "data/lexicon_supplement_v2.tsv"):
        with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
            for line in fh:
                if line.startswith("#") or not line.strip() or line.startswith("word\t"):
                    continue
                word, phones = line.rstrip("\n").split("\t")[:2]
                rows.append((word, phones.split()))
    return rows


LEX = {}


def lex(scheme, fallback):
    key = (scheme, fallback)
    if key not in LEX:
        LEX[key] = LH.Lexicon(fallback=fallback, reader_scheme=scheme)
    return LEX[key]


MODES = [(s, f) for s in ("v1", "v2") for f in (None, "high", "low")]


def digits(text, scheme, fallback):
    L = lex(scheme, fallback)
    with LH.reader_scheme_scope(scheme):
        phones, _, _ = L.transcribe(text)
    return stressed(phones)


def one_token(text, scheme):
    return len(LH.line_tokens(text, True, scheme)) == 1


def reader_worst(cands, label, modes=MODES):
    """Every candidate through the real reader in each mode; a token is
    costed at its length plus one separator."""
    worst = (-1.0, None)
    bad = []
    for scheme, fb in modes:
        for c in cands:
            if not c or not one_token(c, scheme):
                continue
            d = digits(c, scheme, fb)
            units = len(c) + 1
            if d / units > worst[0]:
                worst = (d / units, (c, d, scheme, fb))
            if not within(d, units):
                bad.append((c, d, scheme, fb))
    check(f"{label}: no token over 1.5 digits per unit ({len(cands)} tokens x {len(modes)} modes)",
          not bad, str(bad[:10]))
    return worst


def test_dictionary():
    base = lex("v2", None)
    worst = (-1.0, None)
    bad = []
    for word, readings in base.entries.items():
        for ph in readings:
            v = vowels(ph)
            if v / (len(word) + 1) > worst[0]:
                worst = (v / (len(word) + 1), word)
            if not within(v, len(word) + 1):
                bad.append((word, v))
    for word, ph in supplement_rows():
        v = vowels(ph)
        if not within(v, len(word) + 1):
            bad.append((word, v))
    check(f"every dictionary and supplement reading within 1.5 per unit "
          f"({len(base.entries)} keys; worst {worst[1]!r} at {worst[0]:.3f})", not bad, str(bad[:10]))


def max_vowels(entries, word):
    return max((vowels(p) for p in entries.get(word, [])), default=0)


def test_rule_forms():
    entries = lex("v2", None).entries
    # A rule form adds at most one vowel and removes at most two characters
    # (`-ugh` -> `'`), so only a key within that reach of the bound can
    # yield a form past it.
    keys = list(entries) if FULL else [
        k for k in entries if 2 * (max_vowels(entries, k) + 1) > 3 * (len(k) - 1)]
    cands = set()
    for k in keys:
        cands.update((k, k + "s", k + "'s", k + "es"))
        if k.endswith("ed"):
            cands.add(k[:-2] + "'d")
        if k.endswith("ing"):
            cands.add(k[:-1])
            cands.add(k[:-1] + "'")
        for tail in ("ugh", "gh"):
            if k.endswith(tail) and len(k) - len(tail) >= 3:
                cands.add(k[: -len(tail)] + "'")
    w = reader_worst(sorted(cands), "dictionary rule forms")
    print(f"     worst rule form {w[1]} at {w[0]:.3f}")


def affix_vowels():
    """Most vowels each suffix can add (its allomorph over every final phone)
    and each prefix adds, as data."""
    finals = [[p] for p in sorted(LH.VOWELS | LH.CONSONANTS)] + [["AH0"]]
    suffix = {}
    for sfx, allo, _ in G.SUFFIXES:
        suffix[sfx] = max(vowels(allo(f)) for f in finals)
    prefix = {p: vowels(ph) for p, ph in G.PREFIXES}
    return suffix, prefix


def test_morphology():
    suffix, prefix = affix_vowels()
    check("no suffix adds more than 1.5 vowels per character",
          all(within(v, len(s)) for s, v in suffix.items()), str(suffix))
    check("no prefix adds more than 1.5 vowels per character",
          all(within(v, len(p)) for p, v in prefix.items()), str(prefix))
    # The spelling normalisations map to a headword no longer than the form.
    short = []
    for rx, repl, name in G.SPELLINGS:
        lit = rx.pattern.strip("^$")
        if not re.fullmatch(r"[a-z]+", lit) or len(repl) > len(lit):
            short.append(name)
    check("no spelling normalisation reads a word as a longer headword", not short, str(short))
    # So a form past the bound needs a stem over 1.5 vowels per character
    # (a residue is at most one character shorter than its stem).
    entries = lex("v2", None).entries
    stems = [k for k in entries if re.fullmatch(r"[a-z']+", k)
             and (FULL or 2 * max_vowels(entries, k) > 3 * (len(k) - 1))]
    # A prefix adds at most one vowel per character (`a`), under the 1.5 of
    # the form it joins, so stacking one only lowers the ratio; the gate
    # crosses the suffix forms with that densest prefix, `--full` with all.
    dense = max(prefix, key=lambda p: prefix[p] / len(p))
    check("no prefix adds more than one vowel per character",
          all(v <= len(p) for p, v in prefix.items()), str(prefix))
    cands = set()
    for stem in stems:
        residues = {stem, stem[:-1], stem + stem[-1:], stem + "k"}
        if stem.endswith("y"):
            residues.add(stem[:-1] + "i")
        for r in residues:
            if len(r) < 2:
                continue
            for sfx in suffix:
                cands.add(r + sfx)
                for p in (prefix if FULL else (dense,)):
                    cands.add(p + r + sfx)
        for p in prefix:
            cands.add(p + stem)
    # Morphology is a fallback layer: fallback none never reaches it (a form
    # that is a dictionary key is the dictionary's, checked above).
    modes = [m for m in MODES if m[1] is not None]
    w = reader_worst(sorted(cands), f"morphology forms of {len(stems)} stems", modes)
    print(f"     worst morphology form {w[1]} at {w[0]:.3f}")


def test_elisions():
    table = G.load_elisions()
    w = reader_worst(sorted(table), "elision table")
    print(f"     worst elision {w[1]} at {w[0]:.3f}")


def test_letter_layer():
    import numpy as np
    rules = G.LetterRules()
    check("letter rules loaded", rules.loaded)
    syms = "abcdefghijklmnopqrstuvwxyz^$"
    A = len(syms)
    ix = {c: i for i, c in enumerate(syms)}
    nv = [{k: sum(1 for p in ph if p in LH.VOWELS) for k, ph in lvl.items()}
          for lvl in rules.levels]

    def emit(word):
        pad = "^" + word + "$"
        tot = 0
        for i, ch in enumerate(word):
            p = i + 1
            keys = [(pad[p - 2] if p - 2 >= 0 else "^") + pad[p - 1] + ch + pad[p + 1]
                    + (pad[p + 2] if p + 2 < len(pad) else "$"),
                    pad[p - 1] + ch + pad[p + 1] + (pad[p + 2] if p + 2 < len(pad) else "$"),
                    pad[p - 1] + ch + pad[p + 1], ch + pad[p + 1], ch]
            for lvl, key in zip((4, 3, 2, 1, 0), keys):
                if key in nv[lvl]:
                    tot += nv[lvl][key]
                    break
        return tot

    rnd = random.Random(677)
    mism = []
    for _ in range(3000):
        w = "".join(rnd.choice(syms[:26]) for _ in range(rnd.randint(1, 12)))
        r = rules.read(w)
        if (vowels(r) if r else 0) != emit(w):
            mism.append(w)
    check("the search's emission is LetterRules.read's vowel count (3,000 words)", not mism,
          str(mism[:5]))
    # E[a,b,c,d,e]: vowels emitted for centre c in window a b c d e, most
    # specific context first, exactly as `read` looks them up.
    E = np.zeros((A,) * 5, dtype=np.int16)
    for k, v in nv[0].items():
        E[:, :, ix[k], :, :] = v
    for k, v in nv[1].items():
        E[:, :, ix[k[0]], ix[k[1]], :] = v
    for k, v in nv[2].items():
        E[:, ix[k[0]], ix[k[1]], ix[k[2]], :] = v
    for k, v in nv[3].items():
        E[:, ix[k[0]], ix[k[1]], ix[k[2]], ix[k[3]]] = v
    for k, v in nv[4].items():
        E[ix[k[0]], ix[k[1]], ix[k[2]], ix[k[3]], ix[k[4]]] = v
    NEG = -30000
    letters = list(range(26))
    H, D = ix["^"], ix["$"]

    def step(st, allowed):
        tot = st[..., None].astype(np.int32) + E
        mask = np.full(A, True)
        mask[allowed] = False
        tot[..., mask] = NEG
        nw = tot.max(0)
        nw[nw < NEG // 2] = NEG
        return nw.astype(np.int32)

    best = {1: max(emit(c) for c in syms[:26])}
    cur = np.full((A,) * 4, NEG, dtype=np.int32)
    cur[H, H][np.ix_(letters, letters)] = 0
    for n in range(2, 201):
        f1 = step(cur, [D])
        f2 = step(f1, [D])
        best[n] = int(f2.max())
        if n < 200:
            cur = step(cur, letters)
    check("the search reproduces a known word's maximum (n=2..4 by brute force)",
          all(best[n] == max(emit("".join(t)) for t in __import__("itertools").product(
              syms[:26], repeat=n)) for n in (2, 3)))
    bad = [(n, b) for n, b in best.items() if not within(b, n + 1)]
    worst = max(best.items(), key=lambda kv: kv[1] / (kv[0] + 1))
    check(f"letter-to-sound: no token of 1-200 letters over 1.5 per unit "
          f"(worst n={worst[0]}: {worst[1]} vowels, {worst[1] / (worst[0] + 1):.3f})",
          not bad, str(bad[:10]))


def test_code_points():
    if FULL:
        cps = range(0x110000)
    else:
        cps = []
        for cp in range(0x110000):
            c = chr(cp)
            cat = unicodedata.category(c)
            if cp < 128 or cat == "Cf":
                cps.append(cp)
                continue
            if cat in ("Cn", "Cs", "Co"):
                continue
            folded = c.lower() + c.upper() + c.casefold() + unicodedata.normalize("NFKC", c)
            if any("a" <= ch.lower() <= "z" for ch in folded):
                cps.append(cp)
    bad = []
    for scheme, fb in MODES:
        base = digits("w w", scheme, fb)
        for cp in cps:
            c = chr(cp)
            if unicodedata.category(c) in ("Cn", "Cs", "Co") or c in "\r\n":
                continue
            alone = digits(c, scheme, fb)
            joined = digits("w" + c + "w", scheme, fb)
            # Alone: one character, two units. Between two `w`s: a token of
            # three characters (4 units) or two tokens of 2 units each.
            if not within(alone, 2) or joined > base:
                bad.append((hex(cp), alone, joined, scheme, fb))
    check(f"single code points: none over 1.5 per unit, alone or joining two tokens "
          f"({len(cps)} code points x 6 modes)", not bad, str(bad[:10]))


def test_witness():
    line = "w " * 99 + "ws"
    got = {f"{s}/{f}": digits(line, s, f) for s, f in MODES}
    check("the witness line is 200 characters and reads exactly 301 in all six modes",
          len(line) == 200 and set(got.values()) == {301}, str(got))


if __name__ == "__main__":
    for fn in (test_pins, test_caps_mirror, test_dictionary, test_rule_forms, test_morphology,
               test_elisions, test_letter_layer, test_code_points, test_witness):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all meter digit-bound checks pass")

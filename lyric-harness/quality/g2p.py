#!/usr/bin/env python3
"""Known gap 1 — a transcription fallback for English words CMUdict cannot read.

WHAT THIS IS, AND THE ONE SENTENCE THAT SHAPES IT

It is not a G2P. It is a fallback with a DECLARED CONFIDENCE, and its whole
design constraint is that **it must not become a guess wearing a verdict**.
`quality/phonology/eng.py` refuses today and that refusal is honest; anything
that replaces a refusal has to be strictly better than one, and has to be able
to say WHICH WORDS IT IS CONFIDENT ABOUT. So every reading this module returns
carries the layer that produced it and the dictionary headwords it rests on,
and a word it cannot read still REFUSES.

THE FOUR LAYERS, IN DECLARED PRIORITY ORDER

    dictionary   CMUdict, or one of `Lexicon.transcribe_word`'s own inherited
                 reductions (`cats` -> `cat`+Z, `crown'd` -> `crowned`,
                 `feelin'` -> `feeling` with NG realised as N). CERTAIN.
    morphology   the word decomposes into a dictionary-attested STEM plus an
                 affix from the closed set declared in `SUFFIXES` / `PREFIXES`,
                 or normalises to a dictionary headword by a declared
                 orthographic rule (`savour` -> `savor`, `offence` ->
                 `offense`). Every phone still comes from a CMUdict entry; the
                 rule supplies only the affix and its allomorph. HIGH.
    elision      a member of the closed table in `data/eng_elision.tsv` — the
                 standard English poetic contractions (`o'er`, `e'en`,
                 `'twas`), each row carrying its uncontracted form so the
                 derivation is visible. HIGH.
    letter       letter-to-sound, from rules aligned out of CMUdict itself
                 (`data/g2p_letter_rules.tsv`, built by `--train` on a declared
                 split). LOW, **and off by default**: see MEASURED, below.

and then REFUSAL, which is `read()` returning None and is not a failure
(doctrine 79).

WHY `letter` IS OFF BY DEFAULT, MEASURED RATHER THAN ASSUMED

The sonnets are ground truth about English sound that no resource here
supplied: the form MANDATES that 50 refused pairs rhyme (doctrine 37, test a
phonology against its tradition). Run with the letter layer on, a guessed
pronunciation that does not rhyme turns a refusal into a VIOLATION — the
harness reporting Shakespeare as failing to rhyme, which is exactly the defect
doctrine 79 was written about, arriving through a new door. The numbers are in
this module's test file and in the report; the short version is that the
morphology and elision layers convert refusals into rhymes at a rate the letter
layer does not come close to, and the letter layer's errors are not detectable
from inside it. `min_confidence="low"` reaches it, so the defect is
demonstrable rather than hidden; it is not the default.

WHAT IS DELIBERATELY NOT HERE: DIALECT

The head of the English song corpus's refusal distribution is William Barnes's
Dorset (`zide`, `vall`, `stwone`, `hwome`, `veet`) and Scots (`awa`, `weel`,
`gane`, `thegither`) — 20.08% of one file's line ends against under 0.5%
elsewhere. `zide` is not a misspelling of `side`; it is initial fricative
voicing, and the difference between them IS the phonology. Reading it as `side`
would silently move the declaration's dialect coordinate (doctrine 1) while
reporting a General American verdict. That is refused here and recorded as the
remaining gap, with its route: a declared `eng-dor` / `eng-sco` phonology in
`quality/phonology/`, which is doctrine 45 — give a form's checker the language
of the form — applied to a dialect.

USE

    from quality.g2p import Fallback
    fb = Fallback(lex)                      # dictionary+morphology+elision
    r = fb.read("viewest")
    r.phones      -> ('V', 'Y', 'UW1', 'IH0', 'S', 'T')
    r.layer       -> 'morphology'
    r.confidence  -> 'high'
    r.basis       -> ('view',)
    r.rule        -> "-est (archaic 2sg / superlative) on view"
    fb.read("zzzqx") is None                # REFUSED, and that is an answer

    python3 quality/g2p.py --train          # rebuild data/g2p_letter_rules.tsv
    python3 quality/g2p.py --evaluate       # held-out CMUdict accuracy
    python3 quality/g2p.py --counts=high FILE.txt   # doctrine 79's three
                                            # counts over a lyric file, or
                                            # over words given on the line
    python3 quality/g2p.py WORD ...         # read some words

`--train` is the only producer `data/g2p_letter_rules.tsv` has, and it is
reachable from nowhere else in the repo — so the rules ship without anything
that re-derives them on a run. VERIFIED 2026-08-13: it still executes and
reproduces the shipped file BYTE-IDENTICALLY (65s over 105,744 training
headwords), and `quality/test_g2p.py` §21 now pins that, cheaply by default
and in full under `--slow`.
"""

import os
import random
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import VOWELS, fold_apostrophes  # noqa: E402

DATA = os.path.join(ROOT, "data")
LETTER_RULES_PATH = os.path.join(DATA, "g2p_letter_rules.tsv")
ELISION_PATH = os.path.join(DATA, "eng_elision.tsv")

#: The training/held-out split for the letter layer, and for any accuracy
#: number quoted about it. Doctrine 13: rules derived from CMUdict and then
#: evaluated on CMUdict need a held-out split, and the split has to be STATED
#: rather than implied. `HOLDOUT_SEED` fixes it so the number reproduces
#: (doctrine 66).
HOLDOUT_FRACTION = 0.10
HOLDOUT_SEED = 20260811

#: Layer names, in the order they are tried. `dictionary` is not produced here
#: — it is what `Lexicon.transcribe_word` already returns — but it is named so
#: a consumer counting by layer has one vocabulary for all four.
LAYERS = ("dictionary", "morphology", "elision", "letter")

#: Confidence is DECLARED, not computed from a model score. Three values, and
#: they mean: `certain` a dictionary entry; `high` every phone came from a
#: dictionary entry and a declared rule supplied only an affix or a spelling
#: normalisation; `low` no phone came from a dictionary entry for this word.
CONFIDENCE = {"dictionary": "certain", "morphology": "high",
              "elision": "high", "letter": "low"}
CONFIDENCE_RANK = {"certain": 3, "high": 2, "low": 1}


# ---------------------------------------------------------------------------
# The reading, and its provenance
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Reading:
    """A pronunciation AND where it came from.

    Doctrine 1 puts assumptions in the declaration, and "this rhyme rests on a
    guessed pronunciation" is an assumption. There is no way to hold one of
    these and not know which layer produced it, because `layer` has no default.
    """
    phones: tuple
    layer: str
    rule: str = ""
    basis: tuple = ()          #: the CMUdict headwords the phones came from

    @property
    def confidence(self):
        return CONFIDENCE[self.layer]

    @property
    def dictionary_derived(self):
        """True when every phone came out of a CMUdict entry.

        The distinction a consumer actually needs: `morphology` and `elision`
        are dictionary-derived and `letter` is not. It is NOT the same as
        `layer == 'dictionary'`, which is stricter and is about whether the
        headword itself was present.
        """
        return self.layer != "letter"

    def __str__(self):
        b = (" <- " + "+".join(self.basis)) if self.basis else ""
        return (f"{' '.join(self.phones)}  [{self.layer}/{self.confidence}]"
                f"{b}  {self.rule}")


# ---------------------------------------------------------------------------
# Morphology — the high-confidence layer
#
# Allomorphy is conditioned on the STEM'S FINAL PHONE, which is the only reason
# this is a rule and not a table of guesses: `-s` after a sibilant is IH0 Z,
# after a voiceless stop is S, otherwise Z, and CMUdict agrees with that for
# every regular plural it lists. Doctrine 46's shape — a piece of English
# phonology, not an optimisation.
# ---------------------------------------------------------------------------

SIBILANTS = frozenset("S Z SH ZH CH JH".split())
VOICELESS = frozenset("P T K F TH S SH CH HH".split())


def _bare(ph):
    return re.sub(r"\d$", "", ph)


def _final(phones):
    return _bare(phones[-1]) if phones else ""


def _alveolar_stop(p):
    return p in ("T", "D")


def _sfx_s(phones):
    f = _final(phones)
    if f in SIBILANTS:
        return ["IH0", "Z"]
    return ["S"] if f in VOICELESS else ["Z"]


def _sfx_ed(phones):
    f = _final(phones)
    if _alveolar_stop(f):
        return ["IH0", "D"]
    return ["T"] if f in VOICELESS else ["D"]


def _sfx_st(phones):
    """The archaic 2sg `-st`, with the same epenthesis `-s` and `-ed` have.

    `grow'st` is /-st/ but `usest` is /-ɪst/, and the conditioning environment
    is the one English already uses: a sibilant or a coronal stop takes the
    vowel. Writing it as a constant `S T` produced `Y UW1 S S T`, which is not
    a possible English word, and nothing downstream would have said so.
    """
    f = _final(phones)
    return ["IH0", "S", "T"] if (f in SIBILANTS or _alveolar_stop(f)) \
        else ["S", "T"]


def _sfx_const(*phones):
    return lambda _: list(phones)


#: The closed suffix set. Fixed before any accuracy was measured; see the cell's
#: pre-registration. Each row is (orthographic suffix, allomorph function,
#: human-readable name). Longest orthographic suffix is tried first, and among
#: parses that succeed the one with the LONGEST STEM wins — that is what makes
#: `usest` read as `use`+`-st` rather than as `us`+`-est`.
SUFFIXES = [
    ("iness", _sfx_const("IH0", "N", "AH0", "S"), "-ness"),
    ("ness", _sfx_const("N", "AH0", "S"), "-ness"),
    ("less", _sfx_const("L", "AH0", "S"), "-less"),
    ("fully", _sfx_const("F", "AH0", "L", "IY0"), "-fully"),
    ("ful", _sfx_const("F", "AH0", "L"), "-ful"),
    ("eth", _sfx_const("IH0", "TH"), "-eth (archaic 3sg)"),
    ("th", _sfx_const("IH0", "TH"), "-eth (archaic 3sg)"),
    ("est", _sfx_const("IH0", "S", "T"), "-est (archaic 2sg / superlative)"),
    ("st", _sfx_st, "-st (archaic 2sg)"),
    ("'st", _sfx_st, "-'st (archaic 2sg, elided)"),
    ("ing", _sfx_const("IH0", "NG"), "-ing"),
    ("ings", _sfx_const("IH0", "NG", "Z"), "-ings"),
    ("edly", _sfx_const("IH0", "D", "L", "IY0"), "-edly"),
    ("ed", _sfx_ed, "-ed"),
    ("'d", _sfx_ed, "-'d (elided -ed)"),
    ("ly", _sfx_const("L", "IY0"), "-ly"),
    ("er", _sfx_const("ER0"), "-er"),
    ("ers", _sfx_const("ER0", "Z"), "-ers"),
    ("es", _sfx_s, "-s"),
    ("s", _sfx_s, "-s"),
    ("'s", _sfx_s, "-'s"),
]

#: Stress-neutral prefixes: the stem keeps its own stress, so the ANCHOR — the
#: last stressed syllable onward, which is what a rhyme is on — is untouched by
#: this layer. That is why the prefix list is allowed to be liberal in a way the
#: suffix list is not.
PREFIXES = [
    ("counter", ["K", "AW1", "N", "T", "ER0"]),
    ("under", ["AH1", "N", "D", "ER0"]),
    ("inter", ["IH2", "N", "T", "ER0"]),
    ("over", ["OW1", "V", "ER0"]),
    ("o'er", ["AO1", "R"]),
    ("fore", ["F", "AO1", "R"]),
    ("self", ["S", "EH1", "L", "F"]),
    ("semi", ["S", "EH1", "M", "IY0"]),
    ("with", ["W", "IH0", "DH"]),
    ("dis", ["D", "IH0", "S"]),
    ("mis", ["M", "IH0", "S"]),
    ("non", ["N", "AA1", "N"]),
    ("pre", ["P", "R", "IY0"]),
    ("out", ["AW1", "T"]),
    ("un", ["AH0", "N"]),
    ("im", ["IH0", "M"]),
    ("in", ["IH0", "N"]),
    ("en", ["EH0", "N"]),
    ("em", ["EH0", "M"]),
    ("re", ["R", "IY0"]),
    ("be", ["B", "IH0"]),
    ("up", ["AH1", "P"]),
    ("a", ["AH0"]),
]

#: Orthographic normalisations to a dictionary headword. Every one requires the
#: RESULT to be in CMUdict, which is what bounds the false positives: `are` does
#: not become `aer` because `aer` is not a word.
SPELLINGS = [
    (re.compile(r"our$"), "or", "British -our"),
    (re.compile(r"ours$"), "ors", "British -our"),
    (re.compile(r"ourable$"), "orable", "British -our"),
    (re.compile(r"ence$"), "ense", "British -ce"),
    (re.compile(r"ences$"), "enses", "British -ce"),
    (re.compile(r"isation$"), "ization", "British -isation"),
    (re.compile(r"ise$"), "ize", "British -ise"),
    (re.compile(r"ised$"), "ized", "British -ise"),
    (re.compile(r"ising$"), "izing", "British -ise"),
    (re.compile(r"tre$"), "ter", "British -re"),
    (re.compile(r"tres$"), "ters", "British -re"),
    (re.compile(r"logue$"), "log", "British -logue"),
    (re.compile(r"^ae"), "e", "British ae-"),
    (re.compile(r"^oe"), "e", "British oe-"),
    (re.compile(r"lling$"), "ling", "British doubled l"),
    (re.compile(r"lled$"), "led", "British doubled l"),
    (re.compile(r"ller$"), "ler", "British doubled l"),
    (re.compile(r"^ph"), "f", "orthographic ph-"),
]

_DOUBLE = re.compile(r"([bcdfglmnprstvz])\1$")


_SINGLE_CONS = re.compile(r"[^aeiouy][aeiou][bdgklmnprstvz]$")


def stem_candidates(residue):
    """Orthographic stems a suffix-stripped residue could have come from.

    Standard English stem-form adjustments and nothing else: the identity,
    undoubling (`runn` -> `run`), doubling (`dul` -> `dull`, `ful` -> `full`),
    restoring a dropped `e` (`gaz` -> `gaze`), restoring `y` for `i`
    (`jolli` -> `jolly`), and the `-ck` of `panick`.

    -> [(stem, order_index)]. The order is DECLARED and fixed, because it is
    half of the tie-break in `_suffix` and a tie broken by iterating a set is a
    result that does not reproduce (doctrine 66). The other half is stem
    LENGTH, which dominates: `gazeth` has to reach `gaze` and not the CMUdict
    headword `gaz`, and `usest` has to reach `use` and not `us`.
    """
    if not residue:
        return []
    out = [(residue, 0)]
    if _DOUBLE.search(residue):
        out.append((residue[:-1], 1))
    if _SINGLE_CONS.search(residue):
        out.append((residue + residue[-1], 2))
    out.append((residue + "e", 3))
    if residue.endswith("i"):
        out.append((residue[:-1] + "y", 4))
        out.append((residue[:-1] + "ie", 5))
    if residue.endswith("ck"):
        out.append((residue[:-1], 6))
    seen, uniq = set(), []
    for s, k in out:
        if s and s not in seen:
            seen.add(s)
            uniq.append((s, k))
    return uniq


# ---------------------------------------------------------------------------
# The letter layer — CMUdict aligned against itself
#
# Doctrine 13 is the whole reason this has a `--train` verb and a stated split.
# Rules derived from CMUdict and then scored on CMUdict words are scored on
# their own training labels; the number is meaningless without the holdout, and
# the holdout has to be reproducible, so it is a seed and a fraction declared at
# the top of this file rather than a shuffle.
# ---------------------------------------------------------------------------

_LETTER = re.compile(r"^[a-z]+$")


def _split_dict(entries):
    """-> (train, heldout) word lists. Deterministic given HOLDOUT_SEED."""
    words = sorted(w for w in entries if _LETTER.match(w))
    rnd = random.Random(HOLDOUT_SEED)
    heldout = set(rnd.sample(words, int(len(words) * HOLDOUT_FRACTION)))
    return ([w for w in words if w not in heldout],
            [w for w in words if w in heldout])


def _align(word, phones, table):
    """Viterbi alignment of letters to 0/1/2 phones under log-ish scores.

    -> list of (letter, phone-chunk-as-tuple) or None when no alignment exists.
    """
    n, m = len(word), len(phones)
    NEG = -1e9
    best = [[NEG] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    best[0][0] = 0.0
    for i in range(n):
        ch = word[i]
        for j in range(m + 1):
            if best[i][j] == NEG:
                continue
            for k in (0, 1, 2):
                if j + k > m:
                    break
                chunk = tuple(phones[j:j + k])
                sc = table.get((ch, chunk), 1e-4)
                v = best[i][j] + (sc if sc > 0 else 1e-9)
                if v > best[i + 1][j + k]:
                    best[i + 1][j + k] = v
                    back[i + 1][j + k] = (j, chunk)
    if best[n][m] == NEG:
        return None
    out, i, j = [], n, m
    while i > 0:
        pj, chunk = back[i][j]
        out.append((word[i - 1], chunk))
        i, j = i - 1, pj
    out.reverse()
    return out


def train_letter_rules(entries, out_path=LETTER_RULES_PATH, iterations=4,
                       min_count=3, verbose=True):
    """Derive the letter layer's rules from the TRAIN split and write them.

    Hard (Viterbi) EM on the letter/phone-chunk table, then context rules with
    back-off. A rule is stored at a context level only when its majority chunk
    DISAGREES with the shorter context's — so the table is the exceptions, and
    the bare letter is the default.
    """
    train, heldout = _split_dict(entries)
    pairs = [(w, [_bare(p) for p in entries[w][0]]) for w in train]
    # initialise: every letter may spell every chunk it co-occurs with
    table = defaultdict(float)
    for w, ph in pairs:
        for ch in set(w):
            for k in (0, 1, 2):
                for j in range(len(ph) - k + 1):
                    table[(ch, tuple(ph[j:j + k]))] += 1.0
    tot = sum(table.values())
    table = {k: v / tot for k, v in table.items()}
    for it in range(iterations):
        counts = defaultdict(float)
        ok = 0
        for w, ph in pairs:
            a = _align(w, ph, table)
            if a is None:
                continue
            ok += 1
            for ch, chunk in a:
                counts[(ch, chunk)] += 1.0
        s = sum(counts.values()) or 1.0
        table = {k: v / s for k, v in counts.items()}
        if verbose:
            print(f"  EM iteration {it + 1}: aligned {ok}/{len(pairs)}",
                  file=sys.stderr)
    # context rules
    ctx = [defaultdict(Counter) for _ in range(5)]
    for w, ph in pairs:
        a = _align(w, ph, table)
        if a is None:
            continue
        pad = "^" + w + "$"
        for i, (ch, chunk) in enumerate(a):
            p = i + 1
            keys = (
                (ch,),
                (ch, pad[p + 1]),
                (pad[p - 1], ch, pad[p + 1]),
                (pad[p - 1], ch, pad[p + 1], pad[p + 2] if p + 2 < len(pad)
                 else "$"),
                (pad[p - 2] if p - 2 >= 0 else "^", pad[p - 1], ch,
                 pad[p + 1], pad[p + 2] if p + 2 < len(pad) else "$"),
            )
            for lvl, key in enumerate(keys):
                ctx[lvl][key][chunk] += 1
    rows = []
    default = {}
    for key, c in ctx[0].items():
        default[key] = c.most_common(1)[0][0]
        rows.append((0, key, default[key], c[default[key]]))
    for lvl in range(1, 5):
        for key, c in ctx[lvl].items():
            chunk, n = c.most_common(1)[0]
            if n < min_count:
                continue
            prev = None
            for l2 in range(lvl - 1, -1, -1):
                k2 = _shorter_key(lvl, key, l2)
                if k2 in ctx[l2]:
                    cc = ctx[l2][k2].most_common(1)[0][0]
                    prev = cc
                    break
            if prev is not None and prev == chunk:
                continue
            rows.append((lvl, key, chunk, n))
    # stress model: (n_vowels, last-3, last-2, "") -> most common stress string
    stress = [defaultdict(Counter) for _ in range(3)]
    for w in train:
        ph = entries[w][0]
        pat = "".join(m for m in (re.search(r"\d$", p).group(0)
                                  for p in ph if re.search(r"\d$", p)))
        if not pat:
            continue
        nv = len(pat)
        stress[0][(nv, w[-3:])][pat] += 1
        stress[1][(nv, w[-2:])][pat] += 1
        stress[2][(nv,)][pat] += 1
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("# CMUdict letter-to-sound rules, derived by Viterbi-EM "
                "alignment.\n")
        f.write(f"# BUILT BY quality/g2p.py --train.  Training split = "
                f"{len(train)} CMUdict headwords; {len(heldout)} held out "
                f"(fraction {HOLDOUT_FRACTION}, seed {HOLDOUT_SEED}).\n")
        f.write("# Doctrine 13: these rules come from CMUdict, so any accuracy "
                "quoted for them is on the HELD-OUT split and nowhere else.\n")
        f.write("#kind\tlevel\tkey\tphones\tcount\n")
        for lvl, key, chunk, n in sorted(rows):
            f.write("L\t%d\t%s\t%s\t%d\n"
                    % (lvl, "".join(key), " ".join(chunk), n))
        for lvl in range(3):
            for key, c in sorted(stress[lvl].items(), key=lambda kv: repr(kv[0])):
                pat, n = c.most_common(1)[0]
                f.write("S\t%d\t%s\t%s\t%d\n"
                        % (lvl, "%d|%s" % (key[0], key[1] if len(key) > 1
                                           else ""), pat, n))
    if verbose:
        print(f"  wrote {len(rows)} letter rules and a stress model to "
              f"{out_path}", file=sys.stderr)
    return out_path


def _shorter_key(lvl, key, target=None):
    """The same alignment site's key at a shorter context level."""
    if lvl == 4:
        l, ll, ch, r, rr = key
        full = {4: key, 3: (ll, ch, r, rr), 2: (ll, ch, r), 1: (ch, r),
                0: (ch,)}
    elif lvl == 3:
        ll, ch, r, rr = key
        full = {3: key, 2: (ll, ch, r), 1: (ch, r), 0: (ch,)}
    elif lvl == 2:
        ll, ch, r = key
        full = {2: key, 1: (ch, r), 0: (ch,)}
    elif lvl == 1:
        ch, r = key
        full = {1: key, 0: (ch,)}
    else:
        full = {0: key}
    return full[target if target is not None else lvl - 1]


class LetterRules:
    """The `letter` layer. Loaded from the derived table; refuses if absent."""

    def __init__(self, path=LETTER_RULES_PATH):
        self.levels = [dict() for _ in range(5)]
        self.stress = [dict() for _ in range(3)]
        self.path = path
        self.loaded = False
        if not os.path.exists(path):
            return
        with open(path, encoding="utf-8") as f:
            for line in f:
                if line.startswith("#") or not line.strip():
                    continue
                parts = line.rstrip("\n").split("\t")
                if parts[0] == "L":
                    lvl, key, ph = int(parts[1]), parts[2], parts[3]
                    self.levels[lvl][key] = tuple(ph.split()) if ph else ()
                elif parts[0] == "S":
                    self.stress[int(parts[1])][parts[2]] = parts[3]
        self.loaded = any(self.levels)

    def read(self, word):
        """-> phone list, or None. NEVER consults a dictionary entry."""
        if not self.loaded or not _LETTER.match(word):
            return None
        pad = "^" + word + "$"
        out = []
        for i, ch in enumerate(word):
            p = i + 1
            keys = [
                (pad[p - 2] if p - 2 >= 0 else "^") + pad[p - 1] + ch
                + pad[p + 1] + (pad[p + 2] if p + 2 < len(pad) else "$"),
                pad[p - 1] + ch + pad[p + 1]
                + (pad[p + 2] if p + 2 < len(pad) else "$"),
                pad[p - 1] + ch + pad[p + 1],
                ch + pad[p + 1],
                ch,
            ]
            for lvl, key in zip((4, 3, 2, 1, 0), keys):
                if key in self.levels[lvl]:
                    out.extend(self.levels[lvl][key])
                    break
        if not out:
            return None
        nv = sum(1 for p in out if p in VOWELS)
        if nv == 0:
            return None
        pat = (self.stress[0].get("%d|%s" % (nv, word[-3:]))
               or self.stress[1].get("%d|%s" % (nv, word[-2:]))
               or self.stress[2].get("%d|" % nv)
               or "1" + "0" * (nv - 1))
        if len(pat) != nv:
            pat = ("1" + "0" * (nv - 1))
        k, res = 0, []
        for p in out:
            if p in VOWELS:
                res.append(p + pat[k])
                k += 1
            else:
                res.append(p)
        return res


# ---------------------------------------------------------------------------
# The elision table
# ---------------------------------------------------------------------------

def load_elisions(path=ELISION_PATH):
    """-> {form: (full, basis, ops, note)}. Missing file = empty layer.

    The rows carry NO PHONES. Each names a CMUdict headword and an operation on
    its pronunciation, so the elision layer is dictionary-derived in exactly the
    sense the morphology layer is: the table supplies the change, the dictionary
    supplies the sound. See the header of `data/eng_elision.tsv`.
    """
    out = {}
    if not os.path.exists(path):
        return out
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 4:
                continue
            form, full, basis, ops = parts[0], parts[1], parts[2], parts[3]
            note = parts[4] if len(parts) > 4 else ""
            out[form.lower()] = (full, basis, ops, note)
    return out


class ElisionRowFailed(Exception):
    """A row's basis is absent, or an index does not land. The layer refuses;
    it does not fall back to a hand-written phone string, because there are no
    hand-written phone strings here to fall back to."""


def apply_elision_ops(phones, ops):
    """Apply a row's declared operations.

    **Every index is into the ORIGINAL pronunciation**, so a row with two
    deletions does not have to know what the first one did to the offsets. That
    is stated here and in the data file's header because an index scheme a
    reader has to infer is a rule that lives only in prose (doctrine 48).
    """
    kept = list(phones)
    drop = set()
    prepend = []
    for op in ops.split(","):
        op = op.strip()
        if not op or op == "=":
            continue
        if op.startswith("del:"):
            i = int(op[4:])
            if not 0 <= i < len(phones):
                raise ElisionRowFailed(f"del:{i} does not land in {phones}")
            drop.add(i)
        elif op.startswith("sub:"):
            raw, _, ph = op[4:].partition("=")
            i = int(raw)
            if not 0 <= i < len(phones):
                raise ElisionRowFailed(f"sub:{i} does not land in {phones}")
            kept[i] = ph
        elif op.startswith("pre:"):
            prepend.append(op[4:])
        else:
            raise ElisionRowFailed(f"unknown op {op!r}")
    return prepend + [p for i, p in enumerate(kept) if i not in drop]


# ---------------------------------------------------------------------------
# The fallback itself
# ---------------------------------------------------------------------------

class Fallback:
    """Read a word CMUdict cannot, or REFUSE, and always say which.

    `min_confidence` is the switch the tripwire needs. `"high"` (the default)
    admits `morphology` and `elision` and leaves `letter` unreachable; `"low"`
    turns the letter layer on and is how its cost was measured. There is no
    setting that turns a refusal into an unlabelled answer.
    """

    def __init__(self, lex, min_confidence="high",
                 letter_rules_path=LETTER_RULES_PATH,
                 elision_path=ELISION_PATH, extra_g2p=None):
        self.lex = lex
        self.entries = lex.entries
        self.min_confidence = min_confidence
        self.min_rank = CONFIDENCE_RANK[min_confidence]
        self.elisions = load_elisions(elision_path)
        self._letter = None
        self._letter_path = letter_rules_path
        #: An optional externally supplied letter-to-sound callable, used for
        #: the `g2p-en` arm of the route comparison. It is NOT a shipped
        #: dependency: `data/CHANNELS.md` records that pip is reachable, and the
        #: package is still not imported anywhere in the default path.
        self.extra_g2p = extra_g2p
        #: A running tally of LEAF reads by layer -- a hyphenated compound
        #: contributes one entry per piece, not one for the compound. It is a
        #: convenience for a caller watching a stream go past; the reported
        #: three counts come from `three_counts`, which counts words.
        self.counts = Counter()

    # ------------------------------------------------------------- dictionary
    def _dictionary(self, w):
        phones, oov = self.lex.transcribe_word(w)
        if oov or not phones:
            return None
        return Reading(tuple(phones), "dictionary", "CMUdict", (w,))

    def _lookup(self, w):
        """Bare CMUdict headword lookup — no reductions, no fallbacks."""
        e = self.entries.get(w)
        return list(e[0]) if e else None

    # ------------------------------------------------------------- morphology
    def _spelling(self, w, depth=0):
        for rx, repl, name in SPELLINGS:
            if not rx.search(w):
                continue
            cand = rx.sub(repl, w)
            if cand == w:
                continue
            ph = self._lookup(cand)
            if ph:
                return Reading(tuple(ph), "morphology",
                               f"{name}: {w} -> {cand}", (cand,))
        return None

    def _suffix(self, w):
        """The declared tie-break, in one place so it can be argued with.

        `(-stem length, suffix index, stem-form order, frequency rank)`.

        Length first because the ambiguity that actually bites is a SHORT
        accidental headword — CMUdict lists `gaz` and `us`, so `gazeth` and
        `usest` both have a wrong short parse available. **Suffix index
        second**, which is what makes `deceivest` read as `deceive` + `-est`
        (/-ɪst/) rather than `deceive` + `-st` (/-st/): both reach the same
        7-letter stem, and `-est` is the archaic 2sg ending while `-st` is its
        post-vocalic reduction, so the list order is the linguistic claim and
        it has to outrank the orthographic one. `D IH0 S IY1 V S T` is not a
        possible English word and nothing downstream would have said so.
        Stem-form order third (`dul` is absent, `dull` and `dule` are both
        present and `-ness` wants the doubled one). Frequency last, from the
        lexicon's own `freq_rank` (a spoken-register list, currently
        data/opensubtitles_en_50k.tsv), which is independent of the
        pronunciation being predicted (doctrine 13).
        """
        cands = []
        for sfx_i, (sfx, allo, name) in enumerate(SUFFIXES):
            if not w.endswith(sfx) or len(w) - len(sfx) < 2:
                continue
            residue = w[:-len(sfx)]
            for stem, order in stem_candidates(residue):
                ph = self._lookup(stem) or self._spelling_phones(stem)
                if not ph:
                    continue
                rank = self.lex.freq_rank.get(stem, 10 ** 9) if hasattr(
                    self.lex, "freq_rank") else 10 ** 9
                cands.append(((-len(stem), sfx_i, order, rank), stem, name,
                              tuple(list(ph) + allo(ph))))
        if not cands:
            return None
        cands.sort(key=lambda c: c[0])
        key, stem, name, phones = cands[0]
        # Provenance, not just phones: if a less-modified stem gives the SAME
        # pronunciation, name that one. `grow'st` rests on `grow`, and the
        # CMUdict headword `growe` is an accident of the dictionary.
        for k2, s2, n2, p2 in cands:
            if p2 == phones and k2[2] < key[2]:
                key, stem, name = k2, s2, n2
        return Reading(phones, "morphology", f"{name} on {stem}", (stem,))

    def _spelling_phones(self, w):
        r = self._spelling(w)
        return list(r.phones) if r else None

    def _prefix(self, w):
        for pfx, ph in PREFIXES:
            if not w.startswith(pfx) or len(w) - len(pfx) < 3:
                continue
            rest = w[len(pfx):].lstrip("-'")
            if len(rest) < 3:
                continue
            inner, basis = self._lookup(rest), (rest,)
            if inner is None:
                sub = self._spelling(rest) or self._suffix(rest)
                if sub is not None:
                    inner, basis = list(sub.phones), sub.basis
            if inner:
                return Reading(tuple(list(ph) + list(inner)), "morphology",
                               f"{pfx}- on {rest}", basis)
        return None

    def _final_apostrophe(self, w):
        """`groun'`, `roun'`, `thro'` — a word-final elided segment.

        Two sub-rules and no more: one elided consonant LETTER, which removes
        one trailing consonant PHONE; and an elided silent `gh`/`ugh`, which
        removes none. Anything else refuses.
        """
        if not w.endswith("'"):
            return None
        base = w[:-1]
        if len(base) < 3:
            return None
        for tail in ("gh", "ugh"):
            ph = self._lookup(base + tail)
            if ph:
                return Reading(tuple(ph), "morphology",
                               f"final elision: {w} <- {base + tail} "
                               f"(silent {tail})", (base + tail,))
        for c in "bcdfgklmnprstvz":
            ph = self._lookup(base + c)
            if ph and _bare(ph[-1]) not in VOWELS and len(ph) > 1:
                return Reading(tuple(ph[:-1]), "morphology",
                               f"final elision: {w} <- {base + c}, "
                               f"final {_bare(ph[-1])} dropped", (base + c,))
        return None

    # ---------------------------------------------------------------- elision
    def _elision(self, w):
        hit = self.elisions.get(w)
        if not hit:
            return None
        full, basis, ops, note = hit
        base = self._lookup(basis)
        if not base:
            return None            # REFUSAL, not a hand-written substitute
        try:
            phones = apply_elision_ops(base, ops)
        except ElisionRowFailed:
            return None
        if not phones:
            return None
        return Reading(tuple(phones), "elision",
                       f"{w} = elision of {full}, from CMUdict {basis} "
                       f"[{ops}]" + (f"; {note}" if note else ""), (basis,))

    # ----------------------------------------------------------------- letter
    def letter_rules(self):
        if self._letter is None:
            self._letter = LetterRules(self._letter_path)
        return self._letter

    def _letter_layer(self, w):
        if self.extra_g2p is not None:
            ph = self.extra_g2p(w)
            if ph:
                return Reading(tuple(ph), "letter",
                               "external letter-to-sound; NO phone here came "
                               "from a dictionary entry for this word", ())
            return None
        ph = self.letter_rules().read(w)
        if not ph:
            return None
        return Reading(tuple(ph), "letter",
                       "CMUdict-aligned letter-to-sound; NO phone here came "
                       "from a dictionary entry for this word", ())

    # -------------------------------------------------------------- compounds
    def _compound(self, w):
        """`to-day`, `Easter-day`, `woe-winged` — read each piece, or refuse.

        `Lexicon.transcribe` has always split on the hyphen before looking a
        piece up, so the LINE path reads `to-day` and a per-word path that did
        not would disagree with it. That disagreement was measured before this
        existed: 305 line ends in the first 40 English song files where
        `line_readability` says READABLE and a per-token read said REFUSED,
        every one of them a hyphenated compound or a token with a trailing
        em-dash. The refusal was in the tokeniser, not in the dictionary, and
        the two definitions have to agree or the three counts are counting
        different things (doctrine 26's shape: normalise where the word is
        extracted).

        The compound's layer is the WEAKEST of its pieces, which is the only
        safe rule: a compound half-guessed is guessed.
        """
        pieces = [p for p in re.split(r"[-‑]", w) if p]
        if not pieces:
            return None
        readings = []
        for p in pieces:
            r = self.read(p)
            if r is None:
                return None            # a compound half-read is not read
            readings.append(r)
        worst = min(readings, key=lambda r: CONFIDENCE_RANK[r.confidence])
        return Reading(tuple(ph for r in readings for ph in r.phones),
                       worst.layer,
                       "compound " + " + ".join(pieces) + "; layer is the "
                       "weakest piece's (" + worst.layer + ")",
                       tuple(b for r in readings for b in r.basis))

    # ------------------------------------------------------------------ read
    def read(self, word):
        """-> Reading, or None for a REFUSAL.

        None is an answer. It means no declared layer at or above
        `min_confidence` could read the word, and a caller must record it as a
        refusal rather than as an absent relation (doctrine 79).
        """
        w = fold_apostrophes(word).lower().strip("\"“”.,;:!?()[]-‑—–")
        if not w or not re.search(r"[a-z]", w):
            self.counts["refused"] += 1
            return None
        if re.search(r"[-‑]", w):
            return self._compound(w)
        r = self._dictionary(w)
        if r is not None:
            self.counts["dictionary"] += 1
            return r
        if self.min_rank <= CONFIDENCE_RANK["high"]:
            # THE ORDER IS LOAD-BEARING and it is not a style choice. CMUdict
            # lists `o'` as a headword (OW1), so the productive `-er` rule
            # parses `o'er` as `o'` + `-er` and returns a TWO-syllable
            # `OW1 ER0`. Both readings are dictionary-derived; only the closed
            # attested table has the right one. A tier that is a CLOSED LIST OF
            # ATTESTED FORMS therefore outranks a tier that is a productive
            # rule, always, and `quality/test_g2p.py` pins exactly this case.
            for fn in (self._elision, self._spelling, self._suffix,
                       self._final_apostrophe, self._prefix):
                r = fn(w)
                if r is not None:
                    self.counts[r.layer] += 1
                    return r
        if self.min_rank <= CONFIDENCE_RANK["low"]:
            r = self._letter_layer(w)
            if r is not None:
                self.counts["letter"] += 1
                return r
        self.counts["refused"] += 1
        return None

    def transcribe_word(self, word):
        """`Lexicon.transcribe_word`'s signature: -> (phones, oov_flag).

        Provided so a spine patch is a one-line delegation rather than a
        rewrite. A caller that uses THIS instead of `read` has thrown the
        provenance away, which is why `read` is the documented entry point.
        """
        r = self.read(word)
        return ([], True) if r is None else (list(r.phones), False)

    def three_counts(self, words):
        """-> dict with the three counts doctrine 79 asks for, kept apart.

        `dictionary`, `fallback` (morphology + elision + letter, itemised), and
        `refused`. A rate computed off this must divide by dictionary+fallback
        and report `refused` beside it, never inside it.

        **WHICH LEXICON THIS IS BOUND TO CHANGES THE ANSWER, and a report has
        to use the right one.** `dictionary` here means only "`self.lex
        .transcribe_word` read it". Built over the real `Lexicon` — what
        `quality/phonology/eng.py` does — that phrase covers
        `Lexicon.transcribe_word`'s own inherited reductions (`wights`,
        `crown'd`, `feelin'`), exactly as this module's header declares the
        dictionary layer. Built over `lyric_harness._DictionaryOnlyLexicon` —
        what `Lexicon(fallback=...)` does, to break the recursion — those
        reductions are invisible to `self.lex`, the morphology layer
        re-derives them from scratch, and they land in the MIDDLE column
        instead. The same nine words come out `5 / 2 / 2` one way and
        `2 / 5 / 2` the other, and only the first is what the harness
        actually read. So a caller holding a `Lexicon` wants
        `lexicon_three_counts(lex, words)` below, which asks the harness's own
        pre-fallback path what it could already read and charges the fallback
        with what it ADDED and nothing else. `quality/test_g2p.py` §22 pins
        both answers so the wrong one cannot be wired into a report by
        accident.
        """
        out = Counter()
        by_layer = Counter()
        for w in words:
            r = self.read(w)
            if r is None:
                out["refused"] += 1
            elif r.layer == "dictionary":
                out["dictionary"] += 1
            else:
                out["fallback"] += 1
                by_layer[r.layer] += 1
        return {"dictionary": out["dictionary"], "fallback": out["fallback"],
                "refused": out["refused"], "by_layer": dict(by_layer),
                "total": len(words)}


# ---------------------------------------------------------------------------
# THE REPORTING PATH FOR THE THREE COUNTS
#
# `Fallback.three_counts` (above) and `English.three_counts`
# (`quality/phonology/eng.py`) have both existed since this layer was built,
# and NOTHING THAT REPORTS HAS EVER CALLED EITHER. A run that opts in with
# `--fallback=high` has the three counts sitting in memory and prints none of
# them: `lyric_harness.py`'s `readability` verb prints READ and REFUSED, two
# counts, and the middle column — how much of READ was DERIVED rather than
# looked up — is exactly what doctrine 79 says may not be folded away. That
# is doctrine 79's own instrument built and left in the drawer, which is the
# defect this section closes on the library side.
#
# Two functions, because they are two different jobs and a caller may want
# only the first: `lexicon_three_counts` COUNTS (correctly, over a `Lexicon`),
# `format_three_counts` RENDERS. Neither computes a rate over `total`.
# ---------------------------------------------------------------------------

class _NoFallbackView:
    """A `Lexicon` seen as it was BEFORE the fallback was opted into.

    Same `entries`, same `freq_rank`, same `strip_parens`, `g2p_fallback` set
    to None — so `Lexicon.transcribe_word` runs its dictionary lookup and its
    own inherited reductions (plural `-s` with conditioned voicing, `crown'd`,
    `feelin'`) and then stops at the OOV return instead of consulting the
    fallback. That is the boundary the `dictionary` column has to be drawn on:
    a word the harness could ALREADY read is not something the fallback added.

    It borrows the caller's dicts rather than copying them and never writes to
    the `Lexicon` it was handed, because that object belongs to the caller and
    a counting helper that mutates its input is a counting helper nobody can
    call twice.
    """

    def __init__(self, lex):
        from lyric_harness import Lexicon
        self.entries = lex.entries
        self.freq_rank = getattr(lex, "freq_rank", {})
        self.strip_parens = getattr(lex, "strip_parens", True)
        self.g2p_fallback = None
        # Bound once, not per word: a corpus file is ~100k tokens and this is
        # called on every one of them.
        self._read = Lexicon.transcribe_word

    def transcribe_word(self, word):
        return self._read(self, word)


def lexicon_three_counts(lex, words):
    """-> doctrine 79's three counts over a `lyric_harness.Lexicon`.

    `dictionary` is what the harness reads with NO fallback declared,
    `fallback` is what `lex.g2p_fallback` added on top of that (itemised by
    layer), `refused` is what neither reached. They sum to `total`, and
    `total` is never a denominator here — see `format_three_counts`.

    WITH NO FALLBACK DECLARED the middle column is 0 and PRESENT, not absent
    (doctrine 20's shape: a layer that was not asked reports zero answers, and
    that is different from a layer that was asked and found none). The mode it
    was asked under is returned as `fallback_mode` so a reader of the numbers
    can see which of the three declarations produced them.

    A token that is not a word at all — punctuation the tokeniser let through,
    a bare apostrophe — is neither read nor refused, so it is counted apart as
    `skipped` rather than being billed to the dictionary or to the fallback.
    `given == total + skipped`, always.

    A READING THAT COMES BACK LABELLED `dictionary` IS COUNTED AS ONE, even
    though the harness's own pre-fallback path refused it. That is not a
    contradiction and the case is real: `double-eyed` in `metidja.txt`.
    `Lexicon.transcribe_word` refuses the hyphenated token whole;
    `Fallback._compound` splits on the hyphen exactly as `Lexicon.transcribe`
    has always split a LINE, finds `double` and `eyed` both in CMUdict, and
    returns layer `dictionary` because the weakest piece is a dictionary
    piece. Nothing was derived — a tokenisation disagreement was settled — so
    charging it to the middle column would report a derivation that did not
    happen. `quality/phonology/eng.py`'s header makes the same call for the
    same reason, on the nine sonnet compounds (`to-day`, `Easter-day`) that
    move into the first column rather than the second. This function was
    written charging them to `fallback` and its own first run over
    `metidja.txt` printed `by layer: dictionary 1`, which is how the case was
    found: a layer name that cannot occur in the column it was printed under.
    """
    fb = getattr(lex, "g2p_fallback", None)
    base = _NoFallbackView(lex)
    out, by = Counter(), Counter()
    skipped = 0
    for w in words:
        phones, oov = base.transcribe_word(w)
        if phones and not oov:
            out["dictionary"] += 1
            continue
        if not phones and not oov:
            skipped += 1               # nothing there to read or to refuse
            continue
        r = fb.read(w) if fb is not None else None
        if r is None:
            out["refused"] += 1
        elif r.layer == "dictionary":
            out["dictionary"] += 1     # a tokenisation agreement, not a
            out["compound_agreement"] += 1   # derivation; see the docstring
        else:
            out["fallback"] += 1
            by[r.layer] += 1
    total = out["dictionary"] + out["fallback"] + out["refused"]
    return {"dictionary": out["dictionary"], "fallback": out["fallback"],
            "refused": out["refused"], "by_layer": dict(by),
            "total": total, "skipped": skipped, "given": len(words),
            "compound_agreement": out["compound_agreement"],
            "fallback_mode": None if fb is None else fb.min_confidence}


def format_three_counts(c, what="words", indent="  "):
    """-> [str] ready to print. THE RATE DIVIDES BY `dictionary + fallback`.

    That division is the whole point of the function existing: a caller left
    to render this itself divides by `total` — the sonnet battery did exactly
    that and recorded Shakespeare as failing to rhyme `viewest`/`renewest`
    (doctrine 79) — so the arithmetic is done here once, with the refusals
    printed BESIDE the rate and never inside it.

    The fallback column is itemised even when it is empty, and the mode is
    named, so a reader can tell "nothing was derived" from "nothing was
    asked".
    """
    read = c["dictionary"] + c["fallback"]
    tot = c["total"]
    mode = c.get("fallback_mode", None)
    lines = [
        f"{indent}three counts ({what}, doctrine 79 — never summed): "
        f"dictionary {c['dictionary']}   fallback {c['fallback']}   "
        f"REFUSED {c['refused']}   of {tot}",
    ]
    if c.get("skipped"):
        lines.append(f"{indent}  ({c['skipped']} token(s) skipped: nothing "
                     f"there to read or to refuse)")
    if c.get("compound_agreement"):
        lines.append(f"{indent}  {c['compound_agreement']} of the dictionary "
                     f"column is hyphenated compounds the fallback split and "
                     f"read from CMUdict whole — a tokenisation agreement, "
                     f"not a derivation")
    if mode is None:
        lines.append(f"{indent}  fallback: NONE DECLARED, so the middle "
                     f"column is a zero and not a measurement — "
                     f"`--fallback=high|low` asks the question")
    else:
        itemised = ", ".join(f"{k} {v}" for k, v in
                             sorted(c["by_layer"].items())) or "none fired"
        lines.append(f"{indent}  fallback={mode}, by layer: {itemised}")
        if "letter" in c["by_layer"]:
            lines.append(
                f"{indent}  WARNING {c['by_layer']['letter']} reading(s) came "
                f"from the LETTER layer, whose phones no dictionary entry "
                f"supplied — measured net harmful on the sonnets' own "
                f"mandated rhymes (quality/test_g2p.py §10)")
    if read:
        lines.append(f"{indent}  refusal rate {c['refused']}/{tot} = "
                     f"{c['refused'] / tot:.2%} of {what}; the derived share "
                     f"of what WAS read is {c['fallback']}/{read} = "
                     f"{c['fallback'] / read:.2%}")
    else:
        lines.append(f"{indent}  nothing was read, so there is no rate to "
                     f"report — {c['refused']} refusal(s) and that is the "
                     f"whole finding")
    return lines


def _counts_main(args):
    """`--counts[=high|low|off] WORD-OR-FILE ...` — the three counts, printed.

    A file argument is read through `load_lyric_lines`/`line_tokens`, the same
    two definitions every CLI verb uses for "the sung words of a lyric file",
    so this counts the same population the rest of the harness scores rather
    than a second, private idea of what a word is.
    """
    from lyric_harness import Lexicon, load_lyric_lines, line_tokens
    mode = args[0].split("=", 1)[1] if "=" in args[0] else "high"
    if mode not in ("high", "low", "off"):
        print(f"  --counts wants high, low or off, got {mode!r} "
              f"(Fallback.min_confidence's own vocabulary plus `off` for the "
              f"no-fallback baseline; doctrine 1 — not free text)",
              file=sys.stderr)
        return 2
    rest = args[1:]
    if not rest:
        print("  --counts needs words or a lyric file to count",
              file=sys.stderr)
        return 2
    lex = Lexicon(fallback=None if mode == "off" else mode)
    words, sources = [], []
    for a in rest:
        if os.path.exists(a):
            n0 = len(words)
            for line in load_lyric_lines(a):
                words.extend(line_tokens(line, strip_parens=lex.strip_parens))
            sources.append(f"{a}: {len(words) - n0} token(s)")
        else:
            words.append(a)
    for s in sources:
        print(f"  read {s}")
    for line in format_three_counts(lexicon_three_counts(lex, words)):
        print(line)
    return 0


# ---------------------------------------------------------------------------
# Evaluation — held-out CMUdict
# ---------------------------------------------------------------------------

def _phone_accuracy(gold, pred):
    """Levenshtein-based phoneme accuracy, 1 - errors/len(gold)."""
    n, m = len(gold), len(pred)
    prev = list(range(m + 1))
    for i in range(1, n + 1):
        cur = [i] + [0] * m
        for j in range(1, m + 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1,
                         prev[j - 1] + (gold[i - 1] != pred[j - 1]))
        prev = cur
    return max(0.0, 1.0 - prev[m] / max(1, n))


def evaluate_heldout(lex, fallback_factory, limit=None, stressless=False):
    """Accuracy of a fallback on words HIDDEN from it.

    The dictionary entry is removed from the fallback's view before it reads
    the word, so a `morphology` reading has to reach a DIFFERENT headword.
    """
    train, heldout = _split_dict(lex.entries)
    if limit:
        heldout = heldout[:limit]
    hidden = dict(lex.entries)
    for w in heldout:
        hidden.pop(w, None)

    class _Shim:
        entries = hidden

        def transcribe_word(self, w):
            e = hidden.get(w)
            return (list(e[0]), False) if e else ([], True)

    fb = fallback_factory(_Shim())
    exact = phon = read = 0
    per_layer = Counter()
    per_layer_exact = Counter()
    for w in heldout:
        gold = [p for p in lex.entries[w][0]]
        r = fb.read(w)
        if r is None:
            continue
        read += 1
        per_layer[r.layer] += 1
        g = [_bare(p) for p in gold] if stressless else gold
        p = [_bare(x) for x in r.phones] if stressless else list(r.phones)
        if g == p:
            exact += 1
            per_layer_exact[r.layer] += 1
        phon += _phone_accuracy(g, p)
    return {"heldout": len(heldout), "read": read,
            "coverage": read / len(heldout) if heldout else 0.0,
            "exact": exact,
            "whole_word_accuracy_of_read": exact / read if read else 0.0,
            "whole_word_accuracy_of_all": exact / len(heldout) if heldout
            else 0.0,
            "phoneme_accuracy_of_read": phon / read if read else 0.0,
            "per_layer": dict(per_layer),
            "per_layer_exact": dict(per_layer_exact)}


# ---------------------------------------------------------------------------

def main(argv):
    from lyric_harness import Lexicon
    args = argv[1:]
    if not args:
        print(__doc__)
        return 0
    # Ahead of `Lexicon()` because this verb builds its own, with the declared
    # fallback mode on it — `lexicon_three_counts` reads `lex.g2p_fallback`,
    # so a second dictionary-only one built here first would be 126k entries
    # loaded for nothing.
    if args[0].startswith("--counts"):
        return _counts_main(args)
    lex = Lexicon()
    if args[0] == "--train":
        train_letter_rules(lex.entries)
        return 0
    if args[0] == "--evaluate":
        lim = int(args[1]) if len(args) > 1 else 3000
        for name, mk in (
                ("morphology+elision (high)",
                 lambda s: Fallback(s, min_confidence="high")),
                ("+ letter (low)",
                 lambda s: Fallback(s, min_confidence="low"))):
            r = evaluate_heldout(lex, mk, limit=lim)
            print(f"{name}: heldout {r['heldout']}  read {r['read']} "
                  f"({r['coverage']:.1%})  whole-word {r['exact']}/{r['read']} "
                  f"= {r['whole_word_accuracy_of_read']:.1%} of read, "
                  f"{r['whole_word_accuracy_of_all']:.1%} of all;  phoneme "
                  f"{r['phoneme_accuracy_of_read']:.1%}")
            print(f"    by layer {r['per_layer']}  exact {r['per_layer_exact']}")
        return 0
    fb = Fallback(lex, min_confidence="low")
    for w in args:
        r = fb.read(w)
        print(f"{w:>18}  {r if r is not None else 'REFUSED'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

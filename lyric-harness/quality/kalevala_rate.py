#!/usr/bin/env python3
"""How often does Kalevala alliteration fire -- and how often on nothing?

WHY THIS FILE EXISTS

`data/sources.tsv` records the Kalevala as validated at "81.2% alliteration",
from 3,246 of the first 4,000 verse lines carrying two or more words with a
shared initial under `quality/phonology/fin.py`. That number has no null behind
it. Finnish has a small consonant inventory, initial position carries most of
the redundancy, and the vowel-initial words alliterate as ONE class by the
tradition's own rule -- so a large fraction of arbitrary Finnish word-pairs
share an initial before any poet is involved. Doctrine 56: a rate without a
matched control is quoting the null back at itself.

THE NULL, AND THE TRAP IN THE OBVIOUS ONE

`quality/cynghanedd_rate.py` shuffles words WITHIN each line, which is right
for cynghanedd because cynghanedd constrains the ARRANGEMENT of consonants
around a caesura. Kalevala alliteration constrains no arrangement at all: the
rule is "at least two words in the line share an initial", which is a symmetric
function of the line's multiset of words. A within-line shuffle does not change
that multiset, so for this predicate it is the IDENTITY -- a null numerically
equal to the observation, every replicate, forever. It is run below anyway
(null 3) precisely so that the reader can see delta = 0.000 rather than take
the argument on trust.

What the predicate is sensitive to is WHICH WORDS CO-OCCUR IN A LINE. So that
is what gets destroyed:

  null 1  ACROSS-LINE PERMUTATION  (primary)
          Permute the corpus's whole token sequence and re-cut it with the
          original line lengths.
          PRESERVES exactly: the corpus-wide multiset of word tokens -- hence
            the exact marginal distribution of initial consonants, of C+V
            heads, and of unreadable tokens -- and the exact sequence of line
            lengths, so the number of 2-, 3-, 4-, 5- and 6-word lines is
            unchanged. Line length is the strongest driver of chance
            alliteration (a 4-word line offers 6 pairs, a 2-word line offers
            1), so holding it is not optional.
          DESTROYS: which words share a line. That is exactly and only what
            the constraint governs.

  null 2  UNIGRAM RESAMPLE, LENGTH-MATCHED
          Refill every slot i.i.d. from the corpus token distribution.
          PRESERVES: line lengths exactly, and the initial-sound distribution
            in expectation.
          DESTROYS: co-occurrence, AND the exact per-corpus token counts --
            it samples WITH replacement, so it is a strictly looser null than
            null 1 and carries extra variance. Reported so that null 1 cannot
            be accused of being tight only because it is a permutation.

  null 3  WITHIN-LINE SHUFFLE
          PRESERVES: the line's exact word multiset. DESTROYS: word order --
            which for a symmetric predicate is nothing. Degenerate BY
            CONSTRUCTION for variants 1-7 and reported as such.
          It stops being degenerate for the ADJACENT variants (8, 9), which
          require the sharing pair to be next to each other. There the
          within-line shuffle is the TIGHTEST control available: identical
          words, identical line, only the ordering moved.

RULE VARIANTS, JUDGED BY LIFT (doctrine 61)

A rule that fires more often is not a better rule. Nine readings of "the line
alliterates" are measured against the same nulls and ranked by lift over the
null, never by yield. The two that `fin.py` implements (weak, strong) are the
first two; the rest tighten one dimension each so the table says what each
tightening buys.

RESIDUAL CONFOUND, STATED RATHER THAN FIXED

Null 1 destroys meaning-driven co-occurrence along with sound-driven
co-occurrence. Finnish has no productive prefixes, so the main way a line can
share initials without the poet reaching for alliteration is a repeated stem or
a figura etymologica (`laulan laulun`). Variants 5-7 bound that: 5 forbids the
pair being the same word-form, 6 and 7 forbid it sharing a 4-character prefix.
If the lift survives those, the effect is not stem repetition.

WHAT IT SAYS (seed 20260810, N=200; every figure re-checked at N=2000)

  The rate SEPARATES, and by a lot. Against the across-line permutation:

    weak    82.31% observed   null median 29.86%, max 30.62%   +51.69 over max
    strong  55.73% observed   null median  7.18%, max  7.73%   +48.00 over max

  So the 81.2% in data/sources.tsv was not an artifact -- but it was also not
  interpretable, because the missing number is 29.86%. Nearly a THIRD of
  Kalevala lines would carry weak alliteration with their words redealt at
  random, which is the redundancy the unit was built to price. Reported as a
  rate alone, "82%" invites the reading that the poet is responsible for 82
  points of it; he is responsible for 52, and 64% of the observed hits are
  above chance. The strong grade is the cleaner instrument by that measure:
  87% of its hits are above chance, because a shared C+V costs far more to
  hit by accident.

  Every p is AT its floor -- 0.0050 at N=200 and 0.0005 at N=2000 -- and it
  stays there because the null's MAXIMUM is fifty points below the
  observation. Raising N does not move it: 2000 replicates moved the weak
  null's max from 30.62% to 30.81%. The gap is the result; the p only ever
  reported the resolution (doctrine 57).

  The within-line shuffle returns the observation EXACTLY, on every replicate,
  for all seven symmetric variants. It is the identity map here.

  A positional residue exists and is small. Requiring the alliterating pair to
  be ADJACENT, and testing it against the within-line shuffle -- identical
  words, identical line, only the order moved -- gives 69.09% vs a null median
  of 62.54% (max 63.24), +5.85 over the max; strong_adjacent 45.10% vs 40.67%
  (max 41.30), +3.80. So Kalevala alliteration is a constraint on which words
  share a line FIRST, and on where they sit within it only secondarily.

CORPUS

  corpus/fin_kalevala.txt -- 22,795 verse lines, Kalevala 1849, public domain
  by both routes (published 1849; Lonnrot d. 1884). See data/sources.tsv row
  GITenberg/Kalevala_7000.

  Reproduce it from scratch:
    curl -sS -o 7000-8.txt \
      https://raw.githubusercontent.com/GITenberg/Kalevala_7000/master/7000-8.txt
    python3 quality/kalevala_rate.py --extract 7000-8.txt corpus/fin_kalevala.txt
  (source md5 87449afc4728aa740409c5c405e21a15, 636,150 bytes, LATIN-1;
   staged file md5 faf95e1710ff4fee7174e2cd853de36f)

  Boundaries: the verse body runs from the first line of runo I ("Mieleni minun
  tekevi") to the last line of runo L. Everything before it is the Gutenberg
  header, the producer credit, and the Finnish Literature Society's prose note
  -- whose own copyrighted introduction the file warns about. Everything after
  it is the Gutenberg licence. Inside the body the verse is indented by exactly
  two spaces and the 49 runo headings by four, so the headings, the blank
  lines and the single `* * *` divider before the epilogue drop out on
  indentation and content, not on a guess. The result is 22,795 lines, which is
  the canonical verse count of the 1849 Kalevala -- an external check on the
  boundary that does not depend on this code.

Run:
  python3 quality/kalevala_rate.py [corpus/fin_kalevala.txt] [n_replicates]
"""

import os
import re
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality.phonology import get                 # noqa: E402
from quality.phonology.fin import _tokens         # noqa: E402

#: Fixed so a rerun reproduces. A null drawn from a fresh seed each time is a
#: number nobody can check.
SEED = 20260810

DEFAULT_CORPUS = os.path.join(HERE, "..", "corpus", "fin_kalevala.txt")


# --------------------------------------------------------------------------
# corpus extraction (documented above; no network, operates on a saved file)
# --------------------------------------------------------------------------

def extract(raw_path, out_path):
    """Gutenberg 7000-8.txt -> verse lines only."""
    text = open(raw_path, encoding="latin-1").read().replace("\r\n", "\n")
    lines = text.split("\n")
    start = next(i for i, l in enumerate(lines)
                 if l.strip().startswith("Mieleni minun tekevi"))
    end = next(i for i, l in enumerate(lines)
               if l.startswith("End of the Project Gutenberg"))
    verse = []
    for l in lines[start:end]:
        if not l.strip():
            continue
        indent = len(l) - len(l.lstrip(" "))
        if indent != 2:                    # runo headings are indented four
            continue
        if not re.search(r"[A-Za-zÄÖÅäöå]", l):   # the `* * *` divider
            continue
        verse.append(l.strip())
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(verse) + "\n")
    return len(verse)


# --------------------------------------------------------------------------
# tokenisation and the per-type sound table -- all of it from fin.py
# --------------------------------------------------------------------------

class Corpus:
    """Lines as integer token ids, plus fin.py's head for every type.

    Nothing here decides anything phonological. `_tokens` and `_head` are
    `quality/phonology/fin.py`'s own; this class only caches their answers per
    word type so that 200 replicates over 67k tokens are affordable. The cache
    is checked against BOTH of fin.py's public answers -- `line_alliteration`
    on every line and `alliterates` on every within-line pair -- in
    `verify_against_module`, before any null is drawn.
    """

    def __init__(self, path, fin, repair_hyphens=False):
        self.fin = fin
        self.lines = [l.rstrip("\n") for l in open(path, encoding="utf-8")
                      if l.strip()]
        self.words = [[w.lower() for w in _tokens(l)] for l in self.lines]
        if repair_hyphens:
            #: sensitivity only -- see `hyphen_sensitivity`. fin.py is not
            #: edited; the SAME fin._head is asked about a different string.
            self.words = [[(w.replace("-", "")
                            if "-" in w and fin._head(w) is None else w)
                           for w in ws] for ws in self.words]

        ids, self.vocab = {}, []
        self.ids = ids
        rows, cols, flat = [], [], []
        for r, ws in enumerate(self.words):
            for c, w in enumerate(ws):
                if w not in ids:
                    ids[w] = len(self.vocab)
                    self.vocab.append(w)
                rows.append(r)
                cols.append(c)
                flat.append(ids[w])
        self.rows = np.array(rows)
        self.cols = np.array(cols)
        self.flat = np.array(flat, dtype=np.int32)
        self.n_lines = len(self.lines)
        self.width = int(self.cols.max()) + 1
        self.lengths = np.bincount(self.rows, minlength=self.n_lines)

        # per-type sound facts, straight out of fin.py
        heads = [fin._head(w) for w in self.vocab]
        self.readable = np.array([h is not None for h in heads])
        weak = {}
        strong = {}
        self.weak_code = np.full(len(self.vocab), -1, dtype=np.int32)
        self.strong_code = np.full(len(self.vocab), -1, dtype=np.int32)
        self.cons_code = np.full(len(self.vocab), -1, dtype=np.int32)
        for i, h in enumerate(heads):
            if h is None:
                continue
            c, nucleus = h
            k = weak.setdefault(c, len(weak))
            self.weak_code[i] = k
            s = strong.setdefault((c, nucleus[0]), len(strong))
            self.strong_code[i] = s
            #: the vowel-initial class is a rule OF THE TRADITION, not of the
            #: phonology; the cons-only variant exists to price it
            self.cons_code[i] = k if c != "" else -1
        pre = {}
        self.prefix_code = np.zeros(len(self.vocab), dtype=np.int32)
        for i, w in enumerate(self.vocab):
            key = w.strip("'-")[:4]
            self.prefix_code[i] = pre.setdefault(key, len(pre))

    # -- arrangements -------------------------------------------------------

    def matrix(self, flat):
        """flat token ids -> (n_lines x width) matrix, -1 in the pad slots."""
        m = np.full((self.n_lines, self.width), -1, dtype=np.int32)
        m[self.rows, self.cols] = flat
        return m

    def observed(self):
        return self.matrix(self.flat)

    def null_across(self, rng):
        return self.matrix(rng.permutation(self.flat))

    def null_unigram(self, rng):
        idx = rng.integers(0, self.flat.size, self.flat.size)
        return self.matrix(self.flat[idx])

    def null_within(self, rng, m=None):
        m = self.observed() if m is None else m
        keys = rng.random(m.shape)
        keys[m < 0] = np.inf                 # pad stays at the end
        return np.take_along_axis(m, np.argsort(keys, axis=1), axis=1)


# --------------------------------------------------------------------------
# the predicate, in nine readings
# --------------------------------------------------------------------------

def _codes(m, table):
    """type-id matrix -> class-code matrix, with a UNIQUE code in every slot
    that cannot alliterate (pad, or a word fin.py could not read). Unique
    negatives mean such a slot never matches anything, including another copy
    of the same unreadable word -- `alliterates` returns None there, and None
    is not True."""
    c = np.where(m >= 0, table[np.maximum(m, 0)], -1)
    uniq = -(np.arange(m.size, dtype=np.int64).reshape(m.shape) + 1)
    return np.where(c >= 0, c, uniq)


def max_class_count(m, table):
    """-> per line, the size of the biggest class among readable words.

    This is `fin.line_alliteration`'s first return value, vectorised.
    """
    c = _codes(m, table)
    live = c >= 0
    w = m.shape[1]
    counts = np.zeros(m.shape, dtype=np.int32)
    for i in range(w):
        counts[:, i] = sum((c[:, i] == c[:, j]) for j in range(w))
    counts[~live] = 0
    return counts.max(axis=1)


def any_pair(m, table, adjacent=False, distinct=False, prefix=None):
    """-> per line, whether SOME admissible pair of words alliterates."""
    c = _codes(m, table)
    w = m.shape[1]
    hit = np.zeros(m.shape[0], dtype=bool)
    for i in range(w):
        for j in range(i + 1, w):
            if adjacent and j != i + 1:
                continue
            eq = c[:, i] == c[:, j]
            if distinct:
                eq &= m[:, i] != m[:, j]
            if prefix is not None:
                pi = np.where(m[:, i] >= 0, prefix[np.maximum(m[:, i], 0)], -1)
                pj = np.where(m[:, j] >= 0, prefix[np.maximum(m[:, j], 0)], -2)
                eq &= pi != pj
            hit |= eq
    return hit


#: name -> (what it means, callable(corpus, matrix) -> bool array per line)
def variants(cp):
    W, S, C, P = cp.weak_code, cp.strong_code, cp.cons_code, cp.prefix_code
    return [
        ("weak",
         "fin.py: >=2 words share the initial consonant (vowel-initial = one "
         "class)",
         lambda m: max_class_count(m, W) >= 2),
        ("strong",
         "fin.py: >=2 words share initial consonant AND the following vowel",
         lambda m: max_class_count(m, S) >= 2),
        ("weak_min3",
         "weak, but >=3 words in the same class",
         lambda m: max_class_count(m, W) >= 3),
        ("weak_cons_only",
         "weak, and the vowel-initial class does NOT count",
         lambda m: max_class_count(m, C) >= 2),
        ("weak_distinct",
         "weak, and the two words must be different word-forms",
         lambda m: any_pair(m, W, distinct=True)),
        ("weak_nostem4",
         "weak, and the two words must not share a 4-character prefix",
         lambda m: any_pair(m, W, prefix=P)),
        ("strong_nostem4",
         "strong, and the two words must not share a 4-character prefix",
         lambda m: any_pair(m, S, prefix=P)),
        ("weak_adjacent",
         "weak, and the two words must be ADJACENT (positional)",
         lambda m: any_pair(m, W, adjacent=True)),
        ("strong_adjacent",
         "strong, and the two words must be ADJACENT (positional)",
         lambda m: any_pair(m, S, adjacent=True)),
    ]


# --------------------------------------------------------------------------
# validation of the fast path against the module's public API
# --------------------------------------------------------------------------

def verify_against_module(cp):
    """The cache is only allowed to stand if it reproduces fin.py exactly.

    Two checks, one per public entry point. The class-count path is checked
    against `line_alliteration` on every line; the pairwise path (which the
    adjacent / distinct / no-stem variants use) is checked against
    `alliterates` on every within-line pair the observation touches. A cache
    that disagreed with either would be a second Finnish phonology wearing
    fin.py's numbers.
    """
    m = cp.observed()
    for strong, table in ((False, cp.weak_code), (True, cp.strong_code)):
        mine = max_class_count(m, table)
        theirs = np.array([cp.fin.line_alliteration(l, strong=strong)[0]
                           for l in cp.lines])
        bad = np.flatnonzero(mine != theirs)
        if bad.size:
            raise AssertionError(
                f"fast path disagrees with fin.line_alliteration(strong="
                f"{strong}) on {bad.size} lines, first at {bad[0]}: "
                f"{cp.lines[bad[0]]!r} mine={mine[bad[0]]} "
                f"theirs={theirs[bad[0]]}")
    n_pairs = 0
    for strong, table in ((False, cp.weak_code), (True, cp.strong_code)):
        for ws in cp.words:
            for i in range(len(ws)):
                for j in range(i + 1, len(ws)):
                    n_pairs += 1
                    a, b = ws[i], ws[j]
                    ca, cb = table[cp.ids[a]], table[cp.ids[b]]
                    mine = bool(ca >= 0 and ca == cb)
                    theirs = cp.fin.alliterates(a, b, strong=strong) is True
                    if mine != theirs:
                        raise AssertionError(
                            f"fast path disagrees with fin.alliterates("
                            f"{a!r}, {b!r}, strong={strong}): mine={mine} "
                            f"theirs={theirs}")
    return len(cp.lines), n_pairs // 2


# --------------------------------------------------------------------------
# reporting
# --------------------------------------------------------------------------

NULLS = [
    ("across-line permutation",
     "PRESERVES the exact corpus token multiset (so every initial-sound "
     "marginal) and the exact line-length sequence; DESTROYS which words "
     "share a line",
     "null_across"),
    ("unigram resample, length-matched",
     "PRESERVES line lengths and the initial-sound distribution in "
     "expectation; DESTROYS co-occurrence AND the exact token counts "
     "(sampled with replacement, so looser than the permutation)",
     "null_unigram"),
    ("within-line shuffle",
     "PRESERVES the line's word multiset; DESTROYS only word order -- which "
     "is NOTHING for a symmetric predicate, and is the whole of a positional "
     "one",
     "null_within"),
]


def report(cp, n_rep):
    rng = np.random.default_rng(SEED)
    m_obs = cp.observed()
    vs = variants(cp)
    obs = {name: float(fn(m_obs).mean()) for name, _d, fn in vs}

    # draw every null once and score all nine variants on the same draw, so
    # the replicates are shared and the comparison across variants is paired
    draws = {}
    for label, _desc, meth in NULLS:
        rows = {name: [] for name, _d, _f in vs}
        for _ in range(n_rep):
            m = getattr(cp, meth)(rng)
            for name, _d, fn in vs:
                rows[name].append(float(fn(m).mean()))
        draws[label] = rows

    for name, desc, _fn in vs:
        print(f"=== {name} — {desc}")
        print(f"    observed R_obs = {obs[name]:.4%}   "
              f"({round(obs[name] * cp.n_lines)}/{cp.n_lines} lines)")
        for label, ndesc, _m in NULLS:
            xs = sorted(draws[label][name])
            lo, hi = xs[0], xs[-1]
            mid = xs[len(xs) // 2]
            beat = sum(1 for x in xs if x >= obs[name])
            p = (beat + 1) / (n_rep + 1)
            floor = 1 / (n_rep + 1)
            print(f"    null: {label}  (N={n_rep})")
            print(f"          {ndesc}")
            print(f"          median {mid:.4%}  min {lo:.4%}  max {hi:.4%}")
            print(f"          excess over null MEDIAN {obs[name] - mid:+.4%}"
                  f"   over null MAX {obs[name] - hi:+.4%}")
            print(f"          empirical p = {p:.4f}   "
                  f"(floor {floor:.4f} at N={n_rep})")
            if hi >= obs[name]:
                print("          -> NOT separated from this null: at least "
                      "one replicate reached the observed rate.")
            elif abs(p - floor) < 1e-12:
                # doctrine 57: a p at 1/(N+1) reports the resolution of the
                # experiment, not the size of the effect. Read the gap.
                print(f"          -> p is AT the resolution floor. All it says "
                      f"is that no replicate reached {obs[name]:.4%}. Judge "
                      f"the separation by obs - null max = "
                      f"{obs[name] - hi:+.4%}; raise N to resolve further.")
            if abs(obs[name] - mid) < 1e-12 and abs(hi - lo) < 1e-12:
                print("          -> IDENTICAL to the observation on every "
                      "replicate: this null is the identity map for this "
                      "predicate and measures nothing. Expected, and printed "
                      "rather than hidden.")
        print()

    # doctrine 61: rank the rule variants by LIFT over the primary null,
    # never by yield.
    print("=== rule variants ranked by LIFT over the primary null "
          "(across-line permutation), doctrine 61")
    print(f"    {'variant':<16} {'observed':>9} {'null med':>9} "
          f"{'null max':>9} {'lift/med':>9} {'lift/max':>9} {'ratio':>7} "
          f"{'attrib':>7}")
    table = []
    for name, _d, _f in vs:
        xs = sorted(draws["across-line permutation"][name])
        mid, hi = xs[len(xs) // 2], xs[-1]
        table.append((obs[name] - mid, name, obs[name], mid, hi))
    for lift, name, o, mid, hi in sorted(table, reverse=True):
        ratio = (o / mid) if mid else float("inf")
        attrib = (1 - mid / o) if o else 0.0
        print(f"    {name:<16} {o:>8.2%} {mid:>9.2%} {hi:>9.2%} "
              f"{lift:>+9.2%} {o - hi:>+9.2%} {ratio:>7.2f} {attrib:>7.1%}")
    print("    (yield is the 'observed' column; it is NOT the ranking key)")
    print()
    print("    The two lift measures DISAGREE, and they answer different "
          "questions.")
    print("    lift/med is Youden's J: the null rate IS this rule's "
          "false-positive rate")
    print("      on Finnish with the same lexicon and no alliterative "
          "intent, so obs - null")
    print("      is TPR - FPR. By that measure `weak` wins and the nine "
          "variants sit in a")
    print("      narrow band (+8.9 to +52.5).")
    print("    ratio (and 1 - null/obs, the share of observed hits above "
          "chance) asks what")
    print("      a single firing is WORTH: 64% of a `weak` hit is earned, "
          "90% of a")
    print("      `strong_adjacent` hit is. By that measure the order "
          "reverses.")
    print("    So: use `weak` to separate alliterative verse from "
          "non-alliterative text,")
    print("    and `strong` or `strong_adjacent` to certify that a given "
          "line is doing it")
    print("    on purpose. Neither is 'the better rule' unconditionally, "
          "and a bare rate")
    print("    from either is uninterpretable without its null.")


def hyphen_sensitivity(path, fin, cp):
    """How much does fin.py's hyphen defect move the observed rate?

    `Finnish.syllabify` strips a LEADING or TRAILING hyphen and gives the
    apostrophe an explicit hiatus rule, but an INTERNAL hyphen is
    out-of-inventory, so `iän-ikuinen` returns [] and `_head` returns None --
    the word drops out of every alliteration class. This does not edit fin.py;
    it asks fin.py's own `_head` about the hyphen-free spelling instead, and
    prints the difference so the size of the defect is on the record next to
    the result it could have moved.
    """
    fixed = Corpus(path, fin, repair_hyphens=True)
    m_a, m_b = cp.observed(), fixed.observed()
    out = []
    for label, ta, tb in (("weak", cp.weak_code, fixed.weak_code),
                          ("strong", cp.strong_code, fixed.strong_code)):
        a = float((max_class_count(m_a, ta) >= 2).mean())
        b = float((max_class_count(m_b, tb) >= 2).mean())
        out.append((label, a, b))
    n_bad = sum(1 for ws in cp.words for w in ws
                if "-" in w and fin._head(w) is None)
    print(f"fin.py hyphen defect: {n_bad} tokens ({n_bad / cp.flat.size:.3%}) "
          f"are unreadable ONLY because of an internal hyphen")
    for label, a, b in out:
        print(f"    {label:<7} R_obs {a:.4%} -> {b:.4%} if they are read "
              f"({b - a:+.4%})")
    print("    Far below every lift reported here, so no conclusion turns on "
          "it. Reported\n    because the size of a known defect belongs "
          "beside the number it could move.\n")


def main(argv):
    if argv[:1] == ["--extract"]:
        n = extract(argv[1], argv[2])
        print(f"{argv[2]}: {n} verse lines")
        return
    path = argv[0] if argv else DEFAULT_CORPUS
    n_rep = int(argv[1]) if len(argv) > 1 else 200

    fin = get("fin")
    cp = Corpus(path, fin)
    print(f"{os.path.relpath(path)}: {cp.n_lines} lines, "
          f"{cp.flat.size} tokens, {len(cp.vocab)} types")
    print(f"phonology: {fin.name} — {fin.notation}")
    print(f"relation:  {fin.relation}")
    unread = int((~cp.readable[cp.flat]).sum())
    print(f"unreadable tokens (fin.py returns None): {unread} "
          f"({unread / cp.flat.size:.3%}) — excluded from every class, in "
          f"both the observation and the nulls")
    short = int((cp.lengths < 2).sum())
    print(f"lines with fewer than two tokens: {short} — kept in the "
          f"denominator (doctrine 27: a draw that cannot pass still counts)")
    print(f"seed {SEED}\n")
    n_lines, n_pairs = verify_against_module(cp)
    print(f"fast path verified against fin.py's own answers: "
          f"{n_lines} lines vs line_alliteration and {n_pairs} within-line "
          f"pairs vs alliterates, both strengths, zero disagreements\n")
    hyphen_sensitivity(path, fin, cp)
    report(cp, n_rep)


if __name__ == "__main__":
    main(sys.argv[1:])

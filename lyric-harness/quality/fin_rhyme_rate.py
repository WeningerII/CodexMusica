#!/usr/bin/env python3
"""Does the staged Finnish corpus satisfy loppusointu -- and what would chance give?

`quality/kalevala_rate.py` did this for the FIRST Finnish relation, alliteration.
This does it for the SECOND, end-rhyme, and it exists because every corpus figure
`quality/phonology/fin.py` quotes lived only in that module's docstring: not one
of them named the file set, the unit rule, the tokenisation or the sampling that
produced it, so not one of them could be re-derived. Doctrine 58, and doctrine 70's
amendment in particular -- *the coordinate nobody wrote down was the TOKENISATION*.

WHAT MOVED WHEN THIS RAN (all measured below; `--verify` re-checks each one)

  1. There are ELEVEN staged Finnish files, not ten. `corpus/song/`
     `fin_wahanen_laulukirja.txt` (1864 song-book, 390 printed units) landed
     AFTER fin.py was written, so the module's "nine rhymed volumes, 1,132
     four-line units" is now ten volumes and 1,346 units.
  2. Every figure in fin.py's GRADES table reproduces EXACTLY on the nine-volume
     set at the coordinates recovered here. The tables it does NOT label with a
     depth -- the scheme table and the negative-control table -- are at DEPTH 2,
     while the module's shipped default is depth 1. Same numbers, unstated
     coordinate.
  3. The false-positive triple (5.09 / 0.81 / 0.18) reproduces under NO sampling
     rule tried: end-word tokens, end-word types, all tokens, all types, at three
     seeds each (twelve draws). Re-measured here with the rule declared.
  4. "Nine of the ten staged Finnish files are rhymed strophic verse"
     (BACKLOG §2.7, MISSING M-6) is too strong, and the counter-instances are
     measured rather than argued: `fin_aleksis_kivi.txt` clears its own null max
     at NO offset (-1.39 / -0.15 / -0.97; its offset-2 empirical p is 0.0100, so
     it sits AT the top of its null and not past it, against Kramsu's +28.34pp on
     the same statistic), and `fin_jaakko_juteini.txt` carries a HIGHER
     alliteration excess than the Kanteletar (+58.86pp against +50.65pp, with
     53.2% of its lines at exactly eight syllables). The corpus's Kalevala-metre
     arm has two members and its rhymed arm has fewer than nine.
  5. THE FOUR-LINE UNIT IS A MINORITY OF THE PRINTED UNITS in nine of eleven
     files -- 14.0% of the Kanteletar's, 22.9% of Erkko's. Conditioning on
     `len(unit) == 4` is a selection rule, and it is the one this file adds an
     arm WITHOUT (§4, the offset profile over units of every length).

THE UNIT, AND WHY IT IS NOT CALLED WHAT YOU EXPECT

The corpus marks its units `[VERSE n]`, `[REFRAIN]`, `[PART n]`. The Finnish word
for the unit is *säkeistö* and for the line *säe*; the form the rhymed volumes are
in is the *rekilaulu*, which is also the name `quality/RHYME_CANON.md` gives the
Finnish cell of R1. This file says "unit" and "four-line unit" throughout.

THE NULL

Permute each printed unit's own end words among its own line slots. PRESERVES
that unit's exact end-word inventory -- its rime classes, word lengths, harmony
class and suffix mix -- and DESTROYS only WHICH SLOTS the form pairs. It is not
the identity map and §3 prints the differ-fraction rather than asserting it
(doctrines 63 and 68). N=200 replicates, seed below.

WHAT IT SAYS

  * The rhymed arm separates hugely and the separation is not the rate. Pooled
    over the ten rhymed volumes, depth 1, the 2&4 slot is 62.58% observed against
    a null median of 24.76% -- a QUARTER of the corpus's own re-pairings rhyme
    before any poet is involved, which is doctrine 64 in Finnish.
  * The Kanteletar is a negative control that clears its own null in the right
    direction at the 2&4 slot and FAILS to at the adjacent slot, where Kalevala
    parallelism repeats an inflectional ending across two lines. Both arms are
    printed, because only the second makes the first mean anything (doctrine 76).
  * `rule="prominent"` -- the English predicate ported to fixed initial stress --
    is falsified by attested rhymes, and on the ten-volume corpus it also loses
    the lift advantage that was the only argument for it (§2).

Run:  python3 quality/fin_rhyme_rate.py            (the standing tables)
      python3 quality/fin_rhyme_rate.py --verify   (fin.py's own recorded figures)
      python3 quality/fin_rhyme_rate.py --quick    (fewer replicates, for a smoke test)
"""

import collections
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.phonology import fin as FINMOD                      # noqa: E402

F = FINMOD.Finnish()
SONG = os.path.join(HERE, "..", "corpus", "song")

# --------------------------------------------------------- DECLARED SETTINGS
# Doctrine 58: every coordinate this file's numbers are a function of, named
# here, because the figures it replaces were not.

#: Fixed so a rerun reproduces. Doctrine 66.
SEED = 20260811

#: Replicates per null. 200 puts the empirical p floor at 1/201 = 0.0050, which
#: is the resolution and NOT an effect size (doctrine 57) -- a row printing
#: p 0.0050 is saying "no replicate reached the observation", nothing finer.
REPS = 200

#: THE UNIT RULE. A unit is the run of verse lines between two bracket markers
#: (`[VERSE n]`, `[REFRAIN]`, `[PART n]`, `[VARIANT]`, `[NOTE ...]`) as the
#: stagers printed them. Header lines (`#`), field lines (`--- TITLE:` etc.) and
#: the bracket markers themselves are not verse and are dropped.
#: §3 conditions on `len(unit) == 4`; §4 does not, and the two disagree.

#: THE END-WORD RULE. The last token of a line, lower-cased, where a token is a
#: maximal run of `[A-Za-zÀ-ÿŠšŽžÄäÖöÅå'’-]` carrying at least one letter. This
#: is `fin._tokens`' class plus U+2019 (doctrine 26), so the apostrophe of
#: `Onk'` and the hyphen of `iän-ikuinen` stay inside the word -- in Finnish
#: both are word-internal marks and removing either changes the syllabification
#: (doctrine 65).
END = re.compile(r"[A-Za-zÀ-ÿŠšŽžÄäÖöÅå'’\-]+")

#: THE SAMPLING RULE for §6 and §7, which is the coordinate the replaced
#: false-positive triple did not carry. RANDOM pairs are drawn from the arm's
#: line-final TOKENS with replacement -- tokens, not types, because a rate that
#: a caller compares against the mandated rate has to be over the population the
#: mandated pairs are drawn from, and that population is token-weighted.
#: CANDIDATE pairs are drawn the same way and REJECTED unless the two words
#: already agree on their final nucleus; drawing a nucleus class first and then
#: two members of it is a different population (it weights small classes up) and
#: gives a four-times-higher refusal, which is printed in §7 rather than hidden.
N_SAMPLE = 20000

#: The file the whole corpus's Kalevala-metre arm was assumed to be. §1 checks
#: that assumption rather than taking it, and it does not entirely survive.
ASSUMED_KALEVALA = "fin_kanteletar.txt"


def files():
    return [n for n in sorted(os.listdir(SONG)) if n.startswith("fin_")]


def body_lines(name):
    """Verse lines of a staged file. See THE UNIT RULE."""
    for raw in open(os.path.join(SONG, name), encoding="utf-8"):
        t = raw.strip()
        if (not t or t.startswith("#") or t.startswith("---")
                or (t.startswith("[") and t.endswith("]"))):
            continue
        yield t


def units(name):
    """-> [(end_word, ...)] one tuple per printed unit. See THE UNIT RULE."""
    out, cur = [], []
    for raw in open(os.path.join(SONG, name), encoding="utf-8"):
        t = raw.strip()
        if not t or t.startswith("#") or t.startswith("---"):
            continue
        if t.startswith("[") and t.endswith("]"):
            if cur:
                out.append(tuple(cur))
            cur = []
            continue
        toks = [w for w in END.findall(t) if w.strip("'’-")]
        if toks:
            cur.append(toks[-1].lower())
    if cur:
        out.append(tuple(cur))
    return out


def end_tokens(names):
    out = []
    for n in names:
        for ln in body_lines(n):
            ts = [w for w in END.findall(ln) if w.strip("'’-")]
            if ts:
                out.append(ts[-1].lower())
    return out


# --------------------------------------------------------------------------
# the predicate, memoised. Nothing here decides anything phonological: every
# verdict is `fin.Finnish.rhymes`'s, cached per (pair, settings) so 200
# replicates over 3,000 units are affordable. `_CACHE` is checked against the
# module on every run by `--verify`.
# --------------------------------------------------------------------------

_CACHE = {}


def rh(a, b, depth=1, rule="depth", harmony="strict"):
    k = (a, b, depth, rule, harmony)
    if k not in _CACHE:
        _CACHE[k] = F.rhymes(a, b, depth=depth, rule=rule, harmony=harmony)
    return _CACHE[k]


class Counts:
    """THE THREE COUNTS, never two (doctrine 79).

    `mandated` the pairs the form puts in the slot -- what was ASKED.
    `judged`   the pairs the phonology returned True or False on.
    `refused`  the pairs it returned None on. A refusal is not a failure and
               putting it in the numerator charges the comparator for the
               ingestion layer's misses.
    The rate is over JUDGED and is printed as such everywhere.
    """

    __slots__ = ("t", "f", "n")

    def __init__(self):
        self.t = self.f = self.n = 0

    def add(self, v):
        if v is None:
            self.n += 1
        elif v:
            self.t += 1
        else:
            self.f += 1

    @property
    def mandated(self):
        return self.t + self.f + self.n

    @property
    def judged(self):
        return self.t + self.f

    @property
    def refused(self):
        return self.n

    @property
    def rate(self):
        return self.t / self.judged if self.judged else 0.0


def _pairs_at(us, k):
    """Every (line i, line i+k) pair inside one printed unit."""
    for u in us:
        for i in range(len(u) - k):
            yield u[i], u[i + k]


def _pairs_slots(us, slots):
    for u in us:
        for i, j in slots:
            yield u[i], u[j]


def measure(us, select, reps=REPS, **kw):
    """-> (Counts, null median, null max, empirical p, differ-fraction).

    `select` is a generator over pairs given a list of units, so the SAME null
    serves the fixed-slot arm and the offset arm.
    """
    c = Counts()
    for a, b in select(us):
        c.add(rh(a, b, **kw))
    obs = c.rate
    rng = random.Random(SEED)
    vals, differ, total = [], 0, 0
    for _ in range(reps):
        perm = []
        for u in us:
            q = list(u)
            rng.shuffle(q)
            total += 1
            differ += tuple(q) != u
            perm.append(tuple(q))
        t = f = 0
        for a, b in select(perm):
            v = rh(a, b, **kw)
            if v is True:
                t += 1
            elif v is False:
                f += 1
        vals.append(t / (t + f) if (t + f) else 0.0)
    vals.sort()
    ge = sum(1 for v in vals if v >= obs)
    return (c, vals[len(vals) // 2], vals[-1], (ge + 1) / (reps + 1),
            differ / total if total else 0.0)


def row(label, c, med, mx, p, width=32):
    print(f"  {label:<{width}} mand {c.mandated:>5} judged {c.judged:>5} "
          f"refused {c.refused:>4} | obs {c.rate:7.2%}  null med {med:6.2%} "
          f"max {mx:6.2%} | excess {100 * (c.rate - mx):+6.2f}pp  "
          f"lift {c.rate / mx if mx else float('inf'):.2f}x  p {p:.4f}")


# ==========================================================================
# §1 · WHAT IS ACTUALLY STAGED, AND WHICH METRE EACH FILE IS IN
# ==========================================================================

def section_corpus(reps):
    print("\n" + "=" * 78)
    print("§1 · THE CORPUS, COUNTED -- and the metre MEASURED, not assumed")
    print("=" * 78)
    ns = files()
    print(f"\n  {len(ns)} staged Finnish files (BACKLOG §2.7 and MISSING M-6 "
          f"say ten)\n")
    print(f"  {'file':<32} {'units':>6} {'4-line':>7} {'share':>7} "
          f"{'lines':>7} {'syl/line':>9} {'8-syl':>7}")
    tot = collections.Counter()
    for n in ns:
        us = units(n)
        lines = list(body_lines(n))
        nsyl = [sum(len(F.syllabify(w)) for w in FINMOD._tokens(ln))
                for ln in lines]
        q4 = sum(1 for u in us if len(u) == 4)
        tot["units"] += len(us)
        tot["q4"] += q4
        print(f"  {n:<32} {len(us):>6} {q4:>7} {q4 / len(us):>7.1%} "
              f"{len(lines):>7} {sum(nsyl) / len(nsyl):>9.2f} "
              f"{sum(1 for x in nsyl if x == 8) / len(nsyl):>7.1%}")
    print(f"  {'TOTAL':<32} {tot['units']:>6} {tot['q4']:>7} "
          f"{tot['q4'] / tot['units']:>7.1%}")
    print("\n  THE FOUR-LINE UNIT IS A MINORITY OF THE PRINTED UNITS. Every")
    print("  fixed-slot figure in fin.py and in §3 below is conditioned on it,")
    print("  which is a SELECTION and not a neutral one -- §4 drops it.")

    print("\n  ALLITERATION, with the across-line permutation null "
          "`kalevala_rate.py` uses.")
    print("  This is what separates a Kalevala-metre file from a rhymed one, "
          "and it is\n  measured per file rather than read off the filename.\n")
    print(f"  {'file':<32} {'weak':>8} {'null med':>9} {'excess':>8}")
    rng = random.Random(SEED)
    allit = {}
    for n in ns:
        lines = list(body_lines(n))
        obs = sum(1 for ln in lines
                  if F.line_alliteration(ln)[0] >= 2) / len(lines)
        toks = [w for ln in lines for w in FINMOD._tokens(ln)]
        lens = [len(FINMOD._tokens(ln)) for ln in lines]
        meds = []
        for _ in range(max(5, reps // 10)):
            pool = toks[:]
            rng.shuffle(pool)
            i, h = 0, 0
            for L in lens:
                if L and F.line_alliteration(" ".join(pool[i:i + L]))[0] >= 2:
                    h += 1
                i += L
            meds.append(h / len(lines))
        meds.sort()
        med = meds[len(meds) // 2]
        allit[n] = obs - med
        print(f"  {n:<32} {obs:>8.2%} {med:>9.2%} {100 * (obs - med):>+8.2f}pp")
    print(f"\n  The file this corpus assumed was its whole Kalevala-metre arm "
          f"is\n  `{ASSUMED_KALEVALA}`. It is not the only one: see the excess "
          f"column.")
    return allit


# ==========================================================================
# §2 · THE GRADES, AND WHAT LIFT DOES AND DOES NOT ADJUDICATE
# ==========================================================================

READINGS = (
    ("depth 1  (SHIPPED DEFAULT)", dict(depth=1)),
    ("depth 2  (rich grade)", dict(depth=2)),
    ("depth 3", dict(depth=3)),
    ("prominent  (the ENGLISH PORT)", dict(rule="prominent")),
    ("depth 2, harmony=paired", dict(depth=2, harmony="paired")),
)


def section_grades(rhymed, reps):
    print("\n" + "=" * 78)
    print("§2 · THE GRADES, on the 2&4 slot of the four-line units")
    print("=" * 78)
    print("\n  `yksitavuinen` and `kaksitavuinen loppusointu` are the "
          "tradition's own two\n  GRADES, not two rival readings of one rule, "
          "so lift does not choose between\n  them (doctrine 61 adjudicates "
          "rivals). `prominent` IS a rival reading and\n  lift is entitled to "
          "judge it -- and on this corpus it no longer wins.\n")
    us = [u for u in rhymed if len(u) == 4]
    for label, kw in READINGS:
        c, med, mx, p, _d = measure(us, lambda x: _pairs_slots(x, [(1, 3)]),
                                    reps, **kw)
        row(label, c, med, mx, p)


# ==========================================================================
# §3 · WHICH SLOT -- the fixed-slot arm, pooled and per file
# ==========================================================================

SLOTS = (("2&4", [(1, 3)]), ("1&3", [(0, 2)]), ("1&2 + 3&4", [(0, 1), (2, 3)]))


def section_slots(rhymed, per_file, reps):
    print("\n" + "=" * 78)
    print("§3 · WHICH SLOT THE FORM PAIRS -- four-line units only")
    print("=" * 78)
    us = [u for u in rhymed if len(u) == 4]
    for depth in (1, 2):
        print(f"\n  pooled, depth {depth}:")
        for tag, sl in SLOTS:
            c, med, mx, p, d = measure(us, lambda x, s=sl: _pairs_slots(x, s),
                                       reps, depth=depth)
            row(tag, c, med, mx, p)
        print(f"  {'':<32} the null is not the identity map: "
              f"{d:.1%} of permuted units differ")
    print("\n  PER FILE, depth 1 -- because the pooled row is an average over")
    print("  volumes in DIFFERENT schemes, and doctrine 33 says correcting "
          "across\n  items is not combining evidence across them.\n")
    print(f"  {'file':<32} {'n':>5} | {'2&4 exc':>9} {'p':>7} "
          f"| {'1&3 exc':>9} {'p':>7}")
    for n, us_f in per_file:
        q = [u for u in us_f if len(u) == 4]
        if not q:
            continue
        c1, _m, x1, p1, _ = measure(q, lambda x: _pairs_slots(x, [(1, 3)]),
                                    reps, depth=1)
        c2, _m, x2, p2, _ = measure(q, lambda x: _pairs_slots(x, [(0, 2)]),
                                    reps, depth=1)
        print(f"  {n:<32} {len(q):>5} | {100 * (c1.rate - x1):>+9.2f} "
              f"{p1:>7.4f} | {100 * (c2.rate - x2):>+9.2f} {p2:>7.4f}")


# ==========================================================================
# §4 · THE OFFSET PROFILE -- units of EVERY length
# ==========================================================================

def section_offsets(per_file, reps):
    print("\n" + "=" * 78)
    print("§4 · THE OFFSET PROFILE -- every printed unit, no length filter")
    print("=" * 78)
    print("\n  `offset k` is: does line i rhyme line i+k, pooled over every i")
    print("  with both inside one printed unit. Offset 2 is the ABCB slot "
          "generalised;\n  offset 1 is the adjacent slot Kalevala parallelism "
          "fires on. Depth 1.\n")
    print(f"  {'file':<32} {'units':>6} | " +
          " | ".join(f"{'offset ' + str(k):>16}" for k in (1, 2, 3)))
    for n, us_f in per_file:
        us = [u for u in us_f if len(u) >= 2]
        if not us:
            continue
        cells = []
        for k in (1, 2, 3):
            c, _m, mx, p, _ = measure(us, lambda x, kk=k: _pairs_at(x, kk),
                                      reps, depth=1)
            cells.append(f"{100 * (c.rate - mx):+7.2f} p{p:6.4f}"
                         if c.judged else "        n/a     ")
        print(f"  {n:<32} {len(us):>6} | " + " | ".join(cells))


# ==========================================================================
# §5 · THE NEGATIVE ARM
# ==========================================================================

def section_negative(reps):
    print("\n" + "=" * 78)
    print("§5 · THE NEGATIVE ARM -- Kalevala metre, same language, same "
          "instrument")
    print("=" * 78)
    print("\n  Doctrine 76: a null is only as good as the demonstration that "
          "the instrument\n  COULD have found something. §2 is that "
          "demonstration; this is the null.\n")
    us = [u for u in units(ASSUMED_KALEVALA) if len(u) == 4]
    for depth in (1, 2):
        print(f"\n  {ASSUMED_KALEVALA}, four-line units, depth {depth}:")
        for tag, sl in SLOTS:
            c, med, mx, p, _ = measure(us, lambda x, s=sl: _pairs_slots(x, s),
                                       reps, depth=depth)
            row(tag, c, med, mx, p)
    print("\n  THE SECOND ROW IS THE TRAP AND IT IS WHY THE NULL IS NOT "
          "DECORATIVE.")
    print("  `N% of adjacent Kanteletar lines rhyme` is TRUE and is not "
          "rhyme: Kalevala\n  parallelism repeats a syntactic frame across "
          "two lines, so both end in the\n  same inflectional ending. Without "
          "the null it reads as a discovery.")


# ==========================================================================
# §6 · THE FALSE-POSITIVE RATE (doctrine 22)
# ==========================================================================

def section_fpr(names):
    print("\n" + "=" * 78)
    print("§6 · WHAT EACH READING ADMITS ON RANDOM PAIRS -- a rate, not a "
          "point on a scale")
    print("=" * 78)
    print(f"\n  Doctrine 22. {N_SAMPLE:,} pairs drawn WITH REPLACEMENT from "
          f"the rhymed arm's\n  line-final TOKENS, seed {SEED}. The sampling "
          f"rule is the coordinate the\n  figure this replaces did not carry, "
          f"and it moves the answer: see --verify.\n")
    ends = end_tokens(names)
    rng = random.Random(SEED)
    pairs = [(rng.choice(ends), rng.choice(ends)) for _ in range(N_SAMPLE)]
    for label, kw in READINGS:
        c = Counts()
        for a, b in pairs:
            c.add(rh(a, b, **kw))
        print(f"  {label:<32} mandated {c.mandated:>6} judged {c.judged:>6} "
              f"refused {c.refused:>5} ({c.refused / c.mandated:5.2%}) | "
              f"admits {c.rate:7.2%}")
    print("\n  UNCALIBRATED. These are the readings' chance rates on this "
          "corpus, not a\n  threshold anybody swept and not a target anybody "
          "hit (doctrines 16 and 22).")


# ==========================================================================
# §7 · WHERE THE REFUSAL FALLS (doctrine 67)
# ==========================================================================

def section_refusal(rhymed, names):
    print("\n" + "=" * 78)
    print("§7 · WHERE THE REFUSAL FALLS -- three matched populations")
    print("=" * 78)
    print("\n  Doctrine 67: a refusal rate is not a tax, it is a question "
          "about WHERE.\n  `fas.py` refuses 60.2% of real Hafez rhyme pairs "
          "and ~5% of random ones --\n  an AIMED refusal. This one is asked "
          "the same question.\n")
    ends = end_tokens(names)
    rng = random.Random(SEED)
    rand = [(rng.choice(ends), rng.choice(ends)) for _ in range(N_SAMPLE)]
    cand = []
    while len(cand) < N_SAMPLE:
        a, b = rng.choice(ends), rng.choice(ends)
        sa, sb = F.syllabify(a), F.syllabify(b)
        if sa and sb and sa[-1].nucleus == sb[-1].nucleus:
            cand.append((a, b))
    bykey = {}
    for w in set(ends):
        s = F.syllabify(w)
        if s:
            bykey.setdefault(s[-1].nucleus, []).append(w)
    keys = sorted(k for k, v in bykey.items() if len(v) > 1)
    byclass = []
    for _ in range(N_SAMPLE):
        k = rng.choice(keys)
        byclass.append((rng.choice(bykey[k]), rng.choice(bykey[k])))
    mand = [(u[1], u[3]) for u in rhymed if len(u) == 4]
    pops = (("MANDATED (the 2&4 pairs)", mand),
            ("RANDOM end-word tokens", rand),
            ("CANDIDATE, rejection-sampled", cand),
            ("CANDIDATE, uniform over classes", byclass))
    for depth in (1, 2):
        print(f"\n  depth {depth}:")
        for pop, pairs in pops:
            c = Counts()
            for a, b in pairs:
                c.add(rh(a, b, depth=depth))
            print(f"    {pop:<34} mandated {c.mandated:>6} judged "
                  f"{c.judged:>6} refused {c.refused:>5} "
                  f"({c.refused / c.mandated:5.2%}) | True|judged {c.rate:7.2%}")
    print("\n  The two CANDIDATE rows are the SAME English sentence -- 'pairs "
          "that already\n  agree on the final nucleus' -- read two ways, and "
          "they differ by 4x on the\n  refusal. Drawing the class first "
          "weights the small classes up, and the small\n  classes are where "
          "`ie`/`uo`/`yö` live. Doctrine 58: the sampling rule IS a\n  "
          "coordinate of the number.")


# ==========================================================================
# §8 · THE TRADITION TEST (doctrine 37)
# ==========================================================================

#: Kramsu, `Haihtumaton muisto`, refrain, in `corpus/song/fin_kaarlo_kramsu.txt`
#: -- an unambiguous ABCB unit, printed twice in the poem as the refrain.
KRAMSU_REFRAIN = ("katoaa", "yksinään", "suruinen", "itsekään")
#: Same poem, verse 4: `tahdokaan : niitäkään` differ ONLY in harmony class.
KRAMSU_V4 = ("tahdokaan", "vanhentuu", "niitäkään", "muu")
#: Krohn, `Armasta odottaessa`, verse 2 -- an AAAx unit with a refrain word at
#: slot 4, which is why Krohn's 2&4 rate sits BELOW his own null.
KROHN_V2 = ("lentimin", "nope'in", "kuitenkin", "riennä")


def section_tradition():
    print("\n" + "=" * 78)
    print("§8 · THE TRADITION TEST -- known answers, from the staged corpus")
    print("=" * 78)
    print("\n  Doctrine 37: a phonology is tested against its tradition, never "
          "against its\n  own rules. Every pair below is a real line-end from "
          "a staged file.\n")
    cases = [
        ("Kramsu refrain 2&4  yksinään : itsekään",
         (KRAMSU_REFRAIN[1], KRAMSU_REFRAIN[3]), True),
        ("  ... the same pair at the rich grade (depth 2)",
         (KRAMSU_REFRAIN[1], KRAMSU_REFRAIN[3]), False, dict(depth=2)),
        ("  ... and under the ENGLISH PORT",
         (KRAMSU_REFRAIN[1], KRAMSU_REFRAIN[3]), False, dict(rule="prominent")),
        ("Kramsu refrain 1&3  katoaa : suruinen (no rhyme)",
         (KRAMSU_REFRAIN[0], KRAMSU_REFRAIN[2]), False),
        ("Kramsu v4 harmonic pair  tahdokaan : niitäkään",
         (KRAMSU_V4[0], KRAMSU_V4[2]), False),
        ("  ... which harmony='paired' would admit",
         (KRAMSU_V4[0], KRAMSU_V4[2]), True, dict(harmony="paired")),
        ("Krohn v2 1&2  lentimin : nope'in", (KROHN_V2[0], KROHN_V2[1]), True),
        ("Krohn v2 2&3  nope'in : kuitenkin", (KROHN_V2[1], KROHN_V2[2]), True),
        ("Krohn v2 2&4  nope'in : riennä (the refrain word)",
         (KROHN_V2[1], KROHN_V2[3]), False),
        ("maa : vapaa -- what Finnish poets do", ("maa", "vapaa"), True),
        ("  ... and what the ENGLISH PORT says about it",
         ("maa", "vapaa"), False, dict(rule="prominent")),
    ]
    bad = 0
    for case in cases:
        label, (a, b), want = case[0], case[1], case[2]
        kw = case[3] if len(case) > 3 else {}
        got = rh(a, b, **kw)
        ok = got is want
        bad += not ok
        print(f"  {'ok ' if ok else 'MISS'} {label:<50} -> {got}")
    print(f"\n  {len(cases) - bad}/{len(cases)} known answers hold.")
    return bad


# ==========================================================================
# --verify · fin.py's own recorded figures, re-derived
# ==========================================================================

NINE = ("the module's own nine-volume set: every fin_*.txt except "
        "fin_kanteletar.txt and fin_wahanen_laulukirja.txt")

RECORDED = {                      # label -> (recorded, coordinate it omitted)
    "depth 1 2&4": (0.6228, 0.2364, 0.2692),
    "depth 2 2&4": (0.4362, 0.1323, 0.1575),
    "depth 3 2&4": (0.3787, 0.1116, 0.1394),
    "prominent 2&4": (0.3161, 0.0877, 0.1090),
    "depth 2 paired 2&4": (0.4389, 0.1376, 0.1656),
}


def section_verify(reps):
    print("\n" + "=" * 78)
    print("§V · fin.py's RECORDED FIGURES, re-derived")
    print("=" * 78)
    print(f"\n  Population: {NINE}\n")
    ns = [n for n in files()
          if n not in (ASSUMED_KALEVALA, "fin_wahanen_laulukirja.txt")]
    us = [u for n in ns for u in units(n) if len(u) == 4]
    print(f"  four-line units: {len(us)}   (fin.py records 1,132)")
    ok = len(us) == 1132
    for (label, kw), key in zip(READINGS, RECORDED):
        c, med, mx, _p, _d = measure(us, lambda x: _pairs_slots(x, [(1, 3)]),
                                     reps, **kw)
        want = RECORDED[key]
        hit = (round(c.rate, 4) == want[0] and round(med, 4) == want[1]
               and round(mx, 4) == want[2])
        ok &= hit
        print(f"  {'ok  ' if hit else 'MISS'} {key:<22} "
              f"obs {c.rate:7.4%} (rec {want[0]:.2%})  "
              f"med {med:7.4%} (rec {want[1]:.2%})  "
              f"max {mx:7.4%} (rec {want[2]:.2%})")
    print("\n  The scheme table and the negative-control table in fin.py carry "
          "NO DEPTH.\n  Both are at depth 2, and the module's default is depth "
          "1 -- so the two most\n  quotable tables in the module are "
          "coordinates of a setting it does not ship.")
    kant = [u for u in units(ASSUMED_KALEVALA) if len(u) == 4]
    for depth, want in ((2, (0.0743, 0.1424)), (1, None)):
        c, _m, mx, p, _ = measure(kant, lambda x: _pairs_slots(x, [(1, 3)]),
                                  reps, depth=depth)
        tag = "" if want is None else f"  (recorded {want[0]:.2%} / {want[1]:.2%})"
        print(f"  Kanteletar 2&4 at depth {depth}: obs {c.rate:.2%} "
              f"null max {mx:.2%} p {p:.4f}{tag}")
    print("\n  NOT RE-DERIVABLE, and each is a missing coordinate rather than "
          "a wrong sum:")
    print("    * the false-positive triple 5.09 / 0.81 / 0.18 -- twelve draws "
          "tried\n      (end-word tokens/types, all tokens/types, three "
          "seeds); none matches.")
    print("    * the RANDOM and CANDIDATE rows of the refusal table; the "
          "MANDATED row\n      reproduces to the printed digit (2.39% "
          "refused, 43.62% True|judged).")
    print("    * '155 unreadable -- 118 vowelless_token and 37 "
          "out_of_inventory': the\n      TOTAL reproduces exactly on the ten "
          "files that existed, the SPLIT does\n      not (130 / 25), and it is "
          "the split doctrine 88 exists to protect.")
    return ok


def main(argv):
    reps = 20 if "--quick" in argv else REPS
    print(__doc__.split("Run:")[0].rstrip())
    print("\nDECLARED COORDINATES OF EVERY NUMBER BELOW")
    for k, v in F.rhyme_declaration().items():
        print(f"  {k:<22} {v}")
    print(f"  {'seed':<22} {SEED}")
    print(f"  {'replicates':<22} {reps}")
    if "--verify" in argv:
        return 0 if section_verify(reps) else 1
    ns = files()
    section_corpus(reps)
    rhymed_names = [n for n in ns if n != ASSUMED_KALEVALA]
    rhymed = [u for n in rhymed_names for u in units(n)]
    per_file = [(n, units(n)) for n in ns]
    section_grades(rhymed, reps)
    section_slots(rhymed, per_file, reps)
    section_offsets(per_file, reps)
    section_negative(reps)
    section_fpr(rhymed_names)
    section_refusal(rhymed, rhymed_names)
    bad = section_tradition()
    print("\n" + "=" * 78)
    print("Every rate above is printed as THREE COUNTS -- mandated, judged, "
          "refused\n(doctrine 79) -- and beside its own null, because the rate "
          "alone is not the\nfinding (doctrine 64).")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

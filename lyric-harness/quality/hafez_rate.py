#!/usr/bin/env python3
"""Radif and qāfiya in Hafez -- and what the same detectors report on nothing.

WHY THIS FILE EXISTS

`quality/phonology/fas.py` produces three numbers that this project has started
quoting:

    radif detected in 315 of 495 ghazals            (min_fraction=0.60)
    rhymes() returns None on 60.2% of 20,388 pairs, True on 38.8%, False on 1.0%
    a threshold sweep 318/318/315/311/310/306/301/297

Every one of them is a bare rate. Doctrine 56: a rate without a matched control
is quoting the null back at itself -- a caesura search scored ~25% on SHUFFLED
Welsh. Doctrine 58: a bare n-of-N is a coordinate of some threshold. This file
puts a matched null under each number and writes the setting beside it.

THE NULLS, AND WHY NOT A WITHIN-LINE SHUFFLE

Radif and qāfiya are LINE-FINAL relations. `cynghanedd_rate.py` shuffles words
WITHIN a line because cynghanedd is a within-line relation and that shuffle
holds the line's consonant inventory fixed while destroying its arrangement.
Copying that null here would be copying the mechanism instead of the reasoning:
a within-line shuffle moves an arbitrary word of the line to the end, so it does
not test "were these lines composed to share an ending" -- it tests "is Persian
word order random", which nobody asked and which is trivially false for any
language. It is included below as NULL 3 precisely so that its answer can be
seen to be the largest and the least informative.

Three nulls for the radif, stated as preserve/destroy:

  NULL 1  REDEAL -- pool the rhyme-lines of all 495 ghazals, shuffle, deal them
          back into ghazals of the same sizes.
          PRESERVES  every line intact and unaltered; every ghazal's rhyme-line
                     count; the corpus-wide distribution of line-final tokens,
                     of line lengths, of vocabulary, of morphology.
          DESTROYS   only this: that the lines inside one ghazal were composed
                     to share an ending.
          This is the primary null. It is the only one of the three whose
          alternative hypothesis is the claim actually being made.

  NULL 2  FINAL-TOKEN PERMUTATION -- inside each ghazal, permute which line each
          line-final token sits on. Bodies stay put.
          PRESERVES  each ghazal's MULTISET of line-final tokens, exactly.
          DESTROYS   the pairing of a line-final token with its own line body,
                     i.e. the alignment of qāfiya and radif with the line.
          It is a null for the RADIF claim in name only, and this file proves
          it twice over. First: a radif is a count over a multiset and this null
          does not touch the multiset, so the k=1 detection is invariant by
          construction rather than by luck. Second, and worse: a ghazal that
          HAS a radif has identical line-final tokens, and permuting identical
          elements is the identity map -- measured, 297 of the 315 detected
          ghazals come back byte-for-byte unchanged, and 94.6% of detected
          ghazals are unchanged in any given replicate. The null is a no-op on
          exactly the population it was pointed at. It is reported anyway,
          because a null that returns the observed value to four significant
          figures is the clearest possible statement that a randomisation can
          be run, look rigorous, and test nothing.

  NULL 3  WITHIN-LINE SHUFFLE -- shuffle the tokens inside each line.
          PRESERVES  each line's exact token multiset, length, and consonant
                     inventory.
          DESTROYS   Persian word order, and with it the line-final token.
          The wrong null, kept and reported so the wrongness is visible.
          PREDICTED, BEFORE THE RUN: that it would inflate the excess, because
          destroying word order destroys the radif outright.
          MEASURED: the opposite. It is uniformly the WEAKEST separation of the
          three -- null max 19 at min_fraction=0.40 against NULL 1's 2 -- and
          the false radifs it manufactures are که, و, باد, کرد. A ghazal
          repeats its own function words across its own lines, so shuffling
          throws the SAME frequent word to the end of several lines of the SAME
          ghazal, inventing a within-ghazal repetition out of nothing. That is
          doctrine 28 in Persian: a within-item null cannot help containing what
          the item's own inventory already contains. The prediction is left
          written down beside the number that refuted it (doctrine 17).

And two for the qāfiya verdict distribution -- the important half of this file,
because 38.8% True means nothing until two arbitrary Hafez words have been
scored by the same function:

  NULL 4  QĀFIYA REDEAL -- pool the corpus's qāfiya words, shuffle, deal them
          back so every ghazal keeps its own slot count and the pair count stays
          at exactly 20,388.
          PRESERVES  the multiset of qāfiya words; the per-ghazal pair counts;
                     the total number of comparisons.
          DESTROYS   that two words compared together came from one ghazal.
          Length-matched by construction: the same 20,388 comparisons.

  NULL 5  ARBITRARY TOKEN PAIRS -- draw both members uniformly from all 64,325
          in-inventory tokens of the corpus (and, as 5b, uniformly from the
          word TYPES, so the answer is not carried by و and که).
          PRESERVES  the corpus vocabulary.
          DESTROYS   position, line, ghazal -- everything.
          This is the coarseness test: if random Hafez words also score ~39%
          True, then rhymes() is reading the orthography's bluntness and not
          Hafez's rhyming.

REPORTING CONTRACT (doctrines 56 and 57)
Every number below prints: observed; N replicates with median/min/max; the
excess over the null MAXIMUM, not over its median; an empirical p AND its floor
1/(N+1); and a note when p is sitting ON that floor, because a p at the floor
reports the resolution of the experiment and not the size of the effect.

Nothing here writes to `quality/phonology/`. Every phonological judgement is
made by `fas` through its own public API -- `normalise`, `tokens`,
`in_inventory`, `ghazal_rhyme_lines`, `radif_detail`, `tails`, and
`Persian.rhymes` / `.qafiya`. There is no second Persian phonology in this file.

Run:
  python3 quality/hafez_rate.py [n_replicates]
"""

import collections
import itertools
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality.phonology import fas                      # noqa: E402
from quality.phonology.fas import Persian              # noqa: E402

#: Fixed so a rerun reproduces. A null drawn from a fresh seed each time is a
#: number nobody can check.
SEED = 20260810

#: Replicates. The empirical p cannot go below 1/(N+1) = 0.00498 at N=200.
N_DEFAULT = 200

#: The sweep whose observed values are already on record (doctrine 58: the
#: recorded 297 was min_fraction=1.0 and the recorded 315 was 0.60).
SWEEP = (0.40, 0.50, 0.60, 0.70, 0.75, 0.80, 0.90, 1.00)

CORPUS = os.path.join(HERE, "..", "corpus", "fas_hafez.json")
CORPUS_FALLBACK = "/tmp/hafez_raw.json"

_MISS = object()


# ---------------------------------------------------------------------------
# CORPUS
# ---------------------------------------------------------------------------

def load(path=None):
    """-> list of ghazals as {"id", "poem"}. Prefers the staged, cleared copy
    under corpus/; falls back to an ephemeral raw download. The staged file is
    the poem-only PROJECTION of kavehbc/hafez -- see corpus/fas_hafez.LICENSE.txt
    for why the interpretation/alt_interpretation/mp3 fields are not in it."""
    for p in ([path] if path else [CORPUS, CORPUS_FALLBACK]):
        if p and os.path.exists(p):
            with open(p, encoding="utf-8") as fh:
                return json.load(fh), os.path.abspath(p)
    raise SystemExit(
        "no corpus: expected corpus/fas_hafez.json (staged) or "
        "/tmp/hafez_raw.json (ephemeral). Refetch with\n"
        "  curl -sSL -o /tmp/hafez_raw.json https://raw.githubusercontent.com/"
        "kavehbc/hafez/master/hafez/data/hafez.json")


def rhyme_line_sets(data):
    """-> per ghazal, the hemistichs it rhymes on. fas applies the convention:
    both halves of the maṭlaʿ, then the second hemistich of every bayt."""
    return [fas.ghazal_rhyme_lines(g["poem"]) for g in data]


# ---------------------------------------------------------------------------
# REPORTING -- the contract, in one place so no number can skip a field
# ---------------------------------------------------------------------------

def report(label, obs, nulls, unit="", pad="    "):
    """observed, null median/min/max, excess over the null MAX, p and its floor.

    One-sided: how many replicates reached the observed value. Never prints an
    observed rate on its own line without the null beside it.
    """
    n = len(nulls)
    s = sorted(nulls)
    lo, hi = s[0], s[-1]
    mid = s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2
    beat = sum(1 for x in s if x >= obs)
    p = (beat + 1) / (n + 1)
    floor = 1 / (n + 1)
    f = (lambda v: f"{v:.4g}{unit}")
    print(f"{pad}{label}")
    print(f"{pad}  observed          {f(obs)}")
    print(f"{pad}  null (N={n})      median {f(mid)}   min {f(lo)}   max {f(hi)}")
    print(f"{pad}  excess over MAX   {obs - hi:+.4g}{unit}"
          f"   (over median {obs - mid:+.4g}{unit})")
    print(f"{pad}  empirical p       {p:.5f}   floor 1/(N+1) = {floor:.5f}")
    if abs(p - floor) < 1e-12 and floor > 0.05:
        # Doctrine 20/57: at this N the experiment cannot reach alpha=0.05 at
        # all, so "p > 0.05" here is a statement about N and not about Hafez.
        print(f"{pad}  -> p is AT the floor AND the floor is above 0.05: "
              f"N={n} cannot reach significance whatever the data do. "
              f"Read the gap to the null MAX ({obs - hi:+.4g}{unit}); raise N.")
    elif p > 0.05:
        print(f"{pad}  -> NOT separated from this null.")
    elif abs(p - floor) < 1e-12:
        print(f"{pad}  -> p is AT the floor: no replicate reached the observed "
              f"value, which is all N={n} can say. Read the gap to the null "
              f"MAX ({obs - hi:+.4g}{unit}), not the p.")
    return p, floor, mid, lo, hi


# ---------------------------------------------------------------------------
# RADIF -- detection, and the equivalence that makes the sweep cheap
# ---------------------------------------------------------------------------

def probe(lines):
    """-> fas.radif_detail restricted to the single-token candidate.

    `radif_detail` grows k from 1 and BREAKS at the first k that fails its
    gates, keeping the last k that passed. So a ghazal is detected at threshold
    mf if and only if the k=1 candidate passes at mf. Probing k=1 once per
    ghazal therefore answers the whole sweep, and `check_equivalence` asserts
    that against the unrestricted function rather than trusting the argument.
    """
    return fas.radif_detail(lines, min_count=1, min_fraction=0.0, max_tokens=1)


def detected(d, mf):
    return (d["radif"] is not None
            and d["count"] >= fas.RADIF_MIN_COUNT
            and d["fraction"] >= mf - 1e-12
            and d["lines"] >= fas.RADIF_MIN_LINES)


def sweep_counts(sets, probes=None):
    """-> {min_fraction: number of ghazals with a radif}."""
    ps = probes if probes is not None else [probe(s) for s in sets]
    return {mf: sum(1 for d in ps if detected(d, mf)) for mf in SWEEP}


def check_equivalence(sets, tag):
    """Assert the k=1 shortcut against fas.radif itself, on this exact data."""
    ps = [probe(s) for s in sets]
    for mf in SWEEP:
        fast = sum(1 for d in ps if detected(d, mf))
        full = sum(1 for s in sets if fas.radif(s, min_fraction=mf) is not None)
        assert fast == full, (tag, mf, fast, full)
    return True


# -- the three radif nulls ---------------------------------------------------

def null_redeal(tok_sets, rng):
    """NULL 1. Pool every rhyme-line, shuffle, deal back into same-size sets."""
    pool = [t for s in tok_sets for t in s]
    rng.shuffle(pool)
    out, i = [], 0
    for s in tok_sets:
        out.append(pool[i:i + len(s)])
        i += len(s)
    return out


def null_final_token(tok_sets, rng):
    """NULL 2. Permute which line each line-final token sits on, per ghazal."""
    out = []
    for s in tok_sets:
        finals = [t[-1] for t in s]
        rng.shuffle(finals)
        out.append([t[:-1] + [f] for t, f in zip(s, finals)])
    return out


def null_within_line(tok_sets, rng):
    """NULL 3. Shuffle tokens inside each line. The WRONG null -- see module
    docstring. Kept so that its inflation can be seen rather than asserted."""
    out = []
    for s in tok_sets:
        new = []
        for t in s:
            t = list(t)
            rng.shuffle(t)
            new.append(t)
        out.append(new)
    return out


def as_lines(tok_sets):
    return [[" ".join(t) for t in s] for s in tok_sets]


def radif_lengths(sets):
    """-> list of radif token counts, at the default setting. NULL 2's live
    statistic: the multiset it preserves fixes k=1, not k>1."""
    out = []
    for s in sets:
        r = fas.radif(s)
        if r:
            out.append(len(r.split()))
    return out


# ---------------------------------------------------------------------------
# QĀFIYA -- verdict distribution over pairs
# ---------------------------------------------------------------------------

class Verdicts:
    """`Persian.rhymes` memoised on the TAIL SET, not on the word pair.

    `rhymes()` is a function of (tails(a), tails(b)) plus the identity check, so
    two words with the same tail set are interchangeable inside it. Caching on
    tail-set identity turns 20,388 comparisons per replicate into a dict lookup
    while still calling `fas`'s own `rhymes()` for every distinct question.
    `self_test` asserts the memo reproduces an uncached pass exactly.
    """

    def __init__(self, phon):
        self.P = phon
        self.ids = {}         # normalised word -> tail-set id (-1 = refuses)
        self.by_tails = {}    # frozenset of tails -> id
        self.reps = {}        # id -> up to two distinct representative words
        self.memo = {}

    def tail_id(self, w):
        i = self.ids.get(w, _MISS)
        if i is not _MISS:
            return i
        t = fas.tails(w)
        if t is None or not t:
            self.ids[w] = -1          # rhymes() returns None against anything
            return -1
        k = frozenset(t)
        i = self.by_tails.get(k)
        if i is None:
            i = len(self.by_tails)
            self.by_tails[k] = i
            self.reps[i] = []
        if len(self.reps[i]) < 2 and w not in self.reps[i]:
            self.reps[i].append(w)
        self.ids[w] = i
        return i

    def verdict(self, a, b):
        ia, ib = self.tail_id(a), self.tail_id(b)
        if ia < 0 or ib < 0:
            return None               # fas refuses first, before identity
        if a == b:
            return True               # fas types identity as REPEAT/radif
        k = (ia, ib) if ia <= ib else (ib, ia)
        v = self.memo.get(k, _MISS)
        if v is _MISS:
            ra, rb = self.reps[ia][0], self.reps[ib][-1]
            if ra == rb:              # same id, one representative seen so far
                ra, rb = self.reps[ia][0], self.reps[ib][0]
            v = self.P.rhymes(ra, rb)
            self.memo[k] = v
        return v

    def tally(self, groups):
        c = collections.Counter()
        for g in groups:
            for a, b in itertools.combinations(g, 2):
                c[self.verdict(a, b)] += 1
        return c

    def self_test(self, groups):
        direct = collections.Counter()
        for g in groups:
            for a, b in itertools.combinations(g, 2):
                direct[self.P.rhymes(a, b)] += 1
        memo = self.tally(groups)
        assert direct == memo, (direct, memo)
        return direct


def qafiya_words(sets, phon):
    """-> per ghazal, its qāfiya words, normalised, Nones dropped.

    `Persian.qafiya` returns the token immediately before the radif, or the
    line-final token where no radif was detected, or None where a line does not
    carry the detected radif. Dropping the Nones is what makes the pair count
    20,388 rather than 20,661.
    """
    return [[fas.normalise(q) for q in phon.qafiya(s)[1] if q] for s in sets]


def split(counter):
    t = sum(counter.values()) or 1
    return {k: counter[k] / t for k in (True, False, None)}


# ---------------------------------------------------------------------------
# JOINED vs SPACED -- verifying a recorded claim about the TEXT
# ---------------------------------------------------------------------------

def classify_lines(lines, radif):
    """-> Counter over {'carries', 'joined', 'absent'} for one ghazal.

    'joined' means: the line does not end with the radif AS TOKENS, but the
    line with all spaces removed DOES end with the radif with all spaces
    removed, and something precedes it. That is ناولها against ... و ناولها:
    the same characters in the same order, written without the space.
    """
    rt = radif.split()
    rj = "".join(rt)
    c = collections.Counter()
    for ln in lines:
        t = fas.tokens(ln)
        if len(t) > len(rt) and t[-len(rt):] == rt:
            c["carries"] += 1
            continue
        flat = "".join(t)
        c["joined" if (flat.endswith(rj) and len(flat) > len(rj))
          else "absent"] += 1
    return c


def gap_report(sets, lo=0.60, hi=1.00):
    """-> (indices, per-ghazal Counters) for ghazals found at `lo` and missed at
    `hi`. The recorded claim is that 16 of these 18 are joined-writing."""
    idx, cls = [], []
    for i, s in enumerate(sets):
        d = probe(s)
        if detected(d, lo) and not detected(d, hi):
            r = fas.radif(s, min_fraction=lo)
            if r is None:
                continue
            idx.append(i)
            cls.append(classify_lines(s, r))
    return idx, cls


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main(n=N_DEFAULT):
    data, path = load()
    phon = Persian()
    sets = rhyme_line_sets(data)
    tok_sets = [[fas.tokens(l) for l in s] for s in sets]
    ids = [g["id"] for g in data]

    n_hemi = sum(len(g["poem"]) for g in data)
    n_lines = sum(len(s) for s in sets)
    print("=" * 78)
    print("HAFEZ: RADIF AND QĀFIYA AGAINST MATCHED NULLS")
    print("=" * 78)
    print(f"corpus      {path}")
    print(f"            {len(data)} ghazals, {n_hemi} hemistichs, "
          f"{n_lines} rhyme-lines")
    print(f"phonology   quality/phonology/fas.py -- {phon.language} / {phon.name}")
    print(f"seed        {SEED}   replicates N={n}   p floor {1/(n+1):.5f}")
    print(f"settings    min_count={fas.RADIF_MIN_COUNT} "
          f"min_lines={fas.RADIF_MIN_LINES} max_tokens={fas.RADIF_MAX_TOKENS}; "
          f"min_fraction swept over {SWEEP}")

    # -- sanity: the k=1 shortcut, and normalisation idempotence -------------
    check_equivalence(sets, "observed")
    check_equivalence(as_lines(tok_sets), "observed-normalised")
    obs_sweep = sweep_counts(sets)
    print(f"\nobserved sweep (reproduces the record): "
          + " ".join(f"{obs_sweep[mf]}@{mf:.2f}" for mf in SWEEP))

    # =====================================================================
    print("\n" + "=" * 78)
    print("1. RADIF: THE THRESHOLD SWEEP UNDER THREE NULLS")
    print("=" * 78)
    print("A threshold whose null rate is high is not buying anything. The\n"
          "column that matters is 'excess over MAX', not the p.")
    fin = collections.Counter(t[-1] for s in tok_sets for t in s)
    top = fin.most_common(6)
    print(f"\n  What NULL 1 deals from: {len(fin)} distinct line-final tokens "
          f"over {sum(fin.values())} rhyme-lines. The commonest are\n  "
          + ", ".join(f"{w} ({c}, {c/sum(fin.values()):.2%})" for w, c in top)
          + f".\n  So a redealt {sum(len(s) for s in tok_sets)//len(tok_sets)}"
            f"-line ghazal needs {fas.RADIF_MIN_COUNT}+ of its lines to land on "
            f"one token by chance: rare, but NOT impossible, which is what makes\n"
            f"  this a live null rather than a degenerate one.\n")

    nulls = [
        ("NULL 1  redeal rhyme-lines across ghazals  [PRIMARY]", null_redeal),
        ("NULL 2  permute final token within ghazal  [degenerate]",
         null_final_token),
        ("NULL 3  shuffle words within line          [WRONG null]",
         null_within_line),
    ]
    summary = {}
    for title, fn in nulls:
        rng = random.Random(SEED)
        draws = {mf: [] for mf in SWEEP}
        first = None
        for r in range(n):
            rep = fn(tok_sets, rng)
            lines = as_lines(rep)
            if first is None:
                first = lines
            ps = [probe(s) for s in lines]
            for mf in SWEEP:
                draws[mf].append(sum(1 for d in ps if detected(d, mf)))
        check_equivalence(first, title)          # shortcut valid on null data too
        print(f"\n{title}")
        print(f"  (k=1 shortcut re-validated against fas.radif on a replicate)")
        for mf in SWEEP:
            p, floor, mid, lo_, hi_ = report(
                f"min_fraction={mf:.2f}   detections out of {len(sets)}",
                obs_sweep[mf], draws[mf])
            summary.setdefault(mf, {})[title.split()[1]] = (mid, hi_, p)
            print()

    print("\n  LIFT TABLE -- observed minus the null MAX, per threshold")
    print(f"  {'mf':>5}  {'obs':>5}  " + "  ".join(
        f"{'N' + t.split()[1]:>16}" for t, _ in nulls))
    for mf in SWEEP:
        row = f"  {mf:5.2f}  {obs_sweep[mf]:5d}  "
        for t, _ in nulls:
            mid, hi_, p = summary[mf][t.split()[1]]
            row += f"  max {hi_:4d} {obs_sweep[mf]-hi_:+5d}"
        print(row)

    # -- NULL 2's live statistic --------------------------------------------
    # NULL 3 was predicted to be the LOOSEST null and measured as the tightest.
    # Doctrine 17: print the failed expectation beside the working one.
    rng = random.Random(SEED)
    false_radif = collections.Counter()
    for _ in range(min(n, 20)):
        for s in as_lines(null_within_line(tok_sets, rng)):
            d = probe(s)
            if detected(d, 0.40):
                false_radif[d["radif"]] += 1
    print("\n  FAILED EXPECTATION, recorded rather than quietly dropped. NULL 3 "
          "was\n  predicted to give the LARGEST excess (destroying word order "
          "destroys the\n  radif). It gives the SMALLEST at every threshold. "
          "The radifs it invents:\n    "
          + ", ".join(f"{w} ({c})" for w, c in false_radif.most_common(6))
          + "\n  -- a ghazal repeats its own function words across its own "
            "lines, so the\n  shuffle throws the same one to the end of several "
            "lines of the SAME ghazal.\n  A within-item null cannot help "
            "containing what the item already contains\n  (doctrine 28). It is "
            "not a conservative null; it is a null about vocabulary.\n")

    print("\n  WHY NULL 2 RETURNS THE OBSERVED VALUE EXACTLY. Two reasons, and\n"
          "  the second is the damning one:")
    print("   (a) detection reads the k=1 count, which is a count over the\n"
          "       multiset of line-final tokens -- and this null PERMUTES that\n"
          "       multiset rather than changing it. Invariant by construction.")
    det_idx = [i for i, s in enumerate(sets) if detected(probe(s), 0.60)]
    allsame = sum(1 for i in det_idx
                  if len(set(t[-1] for t in tok_sets[i])) == 1)
    rng = random.Random(SEED)
    unchanged = tot_seen = 0
    for _ in range(min(n, 20)):
        rep = null_final_token(tok_sets, rng)
        for i in det_idx:
            tot_seen += 1
            unchanged += (rep[i] == tok_sets[i])
    print(f"   (b) a ghazal that HAS a radif has identical line-final tokens, "
          f"and\n       permuting identical elements is the identity map. Of "
          f"the {len(det_idx)} ghazals\n       detected at 0.60, {allsame} have "
          f"ALL rhyme-line finals identical; over\n       {min(n, 20)} "
          f"replicates {unchanged}/{tot_seen} = {unchanged/tot_seen:.1%} of "
          f"detected ghazals come back\n       BYTE-FOR-BYTE UNCHANGED. The "
          f"null is a no-op on exactly the\n       population it was pointed "
          f"at.")
    print("\n  Its one candidate live statistic was radif LENGTH, which k>1 "
          "reads.\n  It is invariant too, and (b) is why:")
    obs_len = radif_lengths(sets)
    obs_multi = sum(1 for x in obs_len if x > 1)
    rng = random.Random(SEED)
    multi_null = []
    for _ in range(n):
        rep = as_lines(null_final_token(tok_sets, rng))
        ls = radif_lengths(rep)
        multi_null.append(sum(1 for x in ls if x > 1))
    report(f"radif longer than one token (of {len(obs_len)} detected)",
           obs_multi, multi_null, pad="      ")

    # =====================================================================
    print("\n" + "=" * 78)
    print("2. QĀFIYA: WHAT rhymes() SAYS ABOUT TWO ARBITRARY HAFEZ WORDS")
    print("=" * 78)

    qw = qafiya_words(sets, phon)
    V = Verdicts(phon)
    obs_c = V.self_test(qw)                 # asserts the memo == uncached pass
    total = sum(obs_c.values())
    ident = sum(1 for g in qw for a, b in itertools.combinations(g, 2) if a == b)
    o = split(obs_c)
    print(f"\nobserved: {total} within-ghazal qāfiya pairs "
          f"(both members present; 20,661 line-pairs minus 273 with a None slot)")
    print(f"  True  {obs_c[True]:6d}  {o[True]:.4%}"
          f"   of which bare identity (REPEAT, not rhyme): {ident} "
          f"({ident/total:.4%})")
    print(f"  False {obs_c[False]:6d}  {o[False]:.4%}")
    print(f"  None  {obs_c[None]:6d}  {o[None]:.4%}"
          f"   <- the declared refusal on unwritten short vowels")
    dec = obs_c[True] + obs_c[False]
    print(f"  decided {dec} ({dec/total:.4%}); True among decided "
          f"{obs_c[True]/dec:.4%}")

    sizes = [len(g) for g in qw]
    pool = [w for g in qw for w in g]
    all_tok = [t for g in data for l in g["poem"] for t in fas.tokens(l)]
    all_tok = [t for t in all_tok if fas.in_inventory(t)]
    types = sorted(set(all_tok))
    n_pairs = total

    def deal(rng):
        p = list(pool)
        rng.shuffle(p)
        out, i = [], 0
        for k in sizes:
            out.append(p[i:i + k])
            i += k
        return out

    def uniform(rng, src):
        return [[rng.choice(src), rng.choice(src)] for _ in range(n_pairs)]

    arms = [
        ("NULL 4  qāfiya words redealt across ghazals  [length-matched]", deal),
        ("NULL 5  both members drawn from all 64,325 corpus TOKENS",
         lambda r: uniform(r, all_tok)),
        ("NULL 5b both members drawn from the corpus word TYPES",
         lambda r: uniform(r, types)),
    ]
    for title, fn in arms:
        rng = random.Random(SEED)
        tr, fa, no, dt = [], [], [], []
        for _ in range(n):
            c = V.tally(fn(rng))
            s = split(c)
            tr.append(s[True]); fa.append(s[False]); no.append(s[None])
            d = c[True] + c[False]
            dt.append(c[True] / d if d else 0.0)
        print(f"\n{title}")
        report("True rate", o[True], tr, unit="")
        print()
        report("True among DECIDED pairs", obs_c[True] / dec, dt)
        print()
        print(f"    False rate  observed {o[False]:.4%}   "
              f"null median {sorted(fa)[n//2]:.4%}  "
              f"range {min(fa):.4%}-{max(fa):.4%}")
        print(f"    None  rate  observed {o[None]:.4%}   "
              f"null median {sorted(no)[n//2]:.4%}  "
              f"range {min(no):.4%}-{max(no):.4%}")

    # =====================================================================
    print("\n" + "=" * 78)
    print("3. THE 0.60-vs-1.00 GAP: IS IT JOINED WRITING?")
    print("=" * 78)
    print("Recorded claim: of the 18 ghazals that min_fraction=0.60 finds and\n"
          "1.00 misses, 16 are explained by the radif being written JOINED on\n"
          "the missing lines (ناولها joined against مشکل ها spaced).\n"
          "Test: the line does not end with the radif AS TOKENS, but with all\n"
          "spaces removed it DOES end with the radif with spaces removed.\n")
    idx, cls = gap_report(sets)
    full = sum(1 for c in cls if c["absent"] == 0)
    part = sum(1 for c in cls if c["absent"] and c["joined"])
    none_ = sum(1 for c in cls if c["joined"] == 0)
    miss = sum(c["joined"] + c["absent"] for c in cls)
    mj = sum(c["joined"] for c in cls)
    print(f"  gap ghazals                 {len(idx)}  (ids "
          f"{', '.join(str(ids[i]) for i in idx)})")
    print(f"  fully explained by joining  {full}")
    print(f"  partly explained            {part}")
    print(f"  not explained at all        {none_}")
    print(f"  non-carrying lines          {miss}, of which joined {mj} "
          f"({mj/miss:.1%}), genuinely absent {miss - mj}")
    print("\n  examples:")
    shown = 0
    for i, c in zip(idx, cls):
        if shown >= 3:
            break
        r = fas.radif(sets[i], min_fraction=0.60)
        rj = "".join(r.split())
        for ln in sets[i]:
            t = fas.tokens(ln)
            rt = r.split()
            if len(t) > len(rt) and t[-len(rt):] == rt:
                continue
            if "".join(t).endswith(rj):
                print(f"    ghazal {ids[i]:>3}  radif {r!r}   joined as "
                      f"{t[-1]!r}   in: {' '.join(t[-4:])}")
                shown += 1
                break

    for i, c in zip(idx, cls):
        if c["joined"] == 0:
            r = fas.radif(sets[i], min_fraction=0.60)
            rt = r.split()
            bad = [" ".join(fas.tokens(l)[-3:]) for l in sets[i]
                   if not (len(fas.tokens(l)) > len(rt)
                           and fas.tokens(l)[-len(rt):] == rt)]
            print(f"\n    NOT explained -- ghazal {ids[i]}, radif {r!r}, "
                  f"{len(bad)} line(s) that simply do not carry it:")
            for b in bad:
                print(f"      ... {b}")

    # -- the explanation needs its OWN chance rate (doctrine 56 applied to it)
    #
    # The obvious control -- run gap_report on NULL 1 -- is VACUOUS: NULL 1
    # produces almost no radif at all, so it produces almost no gap ghazals and
    # there is nothing to classify. That count is printed rather than silently
    # turned into a 0. The live control is the CRITERION itself: replace the
    # real radif with a random corpus token of the same character length and
    # ask how often a non-carrying line still despace-ends with it. If ها and را
    # are just frequent word endings, this fires at the observed rate.
    rng = random.Random(SEED)
    vacuous = 0
    for _ in range(min(n, 25)):
        _i, cc = gap_report(as_lines(null_redeal(tok_sets, rng)))
        if sum(c["joined"] + c["absent"] for c in cc) == 0:
            vacuous += 1
    print(f"\n  Control attempt 1 (rejected as vacuous): NULL 1 replicates with "
          f"NO gap ghazal at all: {vacuous} of {min(n, 25)}. A redealt corpus "
          f"has no radif to be written joined, so there is nothing to classify "
          f"and the '0%' it would report is an empty denominator, not a rate.")

    by_len = collections.defaultdict(list)
    for t in types:
        by_len[len(t)].append(t)
    rng = random.Random(SEED)
    fake = []
    for _ in range(n):
        j = m = 0
        for i in idx:
            r = fas.radif(sets[i], min_fraction=0.60)
            rt = r.split()
            alt = rng.choice(by_len.get(len("".join(rt)))
                             or by_len[max(by_len)])
            for ln in sets[i]:
                t = fas.tokens(ln)
                if len(t) > len(rt) and t[-len(rt):] == rt:
                    continue
                m += 1
                flat = "".join(t)
                if flat.endswith(alt) and len(flat) > len(alt):
                    j += 1
        fake.append(j / m if m else 0.0)
    print("\n  Control attempt 2: same criterion, same lines, but the radif "
          "replaced\n  by a random corpus token of the same character length.")
    report("fraction of non-carrying lines classified 'joined'",
           mj / miss, fake, pad="      ")

    # -- two further recorded claims about this same measurement -------------
    print("\n  Two adjacent recorded claims, checked while here:")
    for gid, note in ((422, "1.00 truncates the radif"),
                      (100, "0.60 wrongly admits it")):
        k = ids.index(gid)
        r60 = fas.radif(sets[k], min_fraction=0.60)
        r100 = fas.radif(sets[k], min_fraction=1.00)
        d = probe(sets[k])
        print(f"    ghazal {gid:>3}  ({note})  0.60 -> {r60!r}   "
              f"1.00 -> {r100!r}   modal-final {d['count']}/{d['lines']} "
              f"= {d['fraction']:.2f}")

    print("\n" + "=" * 78)


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else N_DEFAULT)

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

THREE COUNTS, NOT TWO, AT EVERY GATE (doctrine 79) -- ADDED 2026-08-13
A refusal is not a failure and must never sit in the numerator. This file has
three separate places where a question is REFUSED rather than answered NO, and
until this date all three were collapsed into the NO:

  RADIF     `radif_detail` returns a `reason` on every call, and three of its
            five reasons say REFUSED in as many words -- one of them literally
            ("a single pair is no evidence either way, so this is a refusal and
            not a negative"). `detected()` was a bare boolean over all five.
  QĀFIYA    `Persian.qafiya` returns None for a line that does not carry the
            radif, so there IS no qāfiya word to compare. `qafiya_words` DROPPED
            those, correctly, and then reported the two counts it had dropped
            between as the hard-coded literals "20,661" and "273" in a print
            string, computed by nobody and checked by nothing.
  VERDICT   `Verdicts.verdict` already BRANCHES on the two causes of None and
            then throws the branch away -- see the next paragraph, which is the
            finding of the 2026-08-13 audit and the reason this file was opened.

WHAT THE 60.2% ACTUALLY IS -- MEASURED 2026-08-13, and it is not what fourteen
places in this repo say it is. The rate reproduces exactly (None 60.2462%, True
38.7532%, False 1.0006%, 20,388 pairs; nothing has drifted). But `rhymes()`
returns None from two structurally different places, and `verdict()` has always
had the branch that tells them apart:

  REFUSED_SCRIPT          7 pairs   0.0343%   `tails()` is None: the word is
                                              out of the declared Perso-Arabic
                                              inventory, or its parse
                                              enumeration hit MAX_PARSES. This
                                              is the SCRIPT refusal.
  REFUSED_INDETERMINATE  12,276     60.2119%  both words read perfectly well;
                                              `_tail_verdict` returns None
                                              because the two nucleus sets are
                                              COMPATIBLE and the short vowel
                                              that would separate them is not
                                              written.

Exactly ONE qāfiya word TYPE of 2,675 refuses on script. So doctrine 59's
"refusing on SCRIPT has a measurable cost" names the wrong cost by a factor of
1,754: the script axis costs 0.03%, and the 60.2% is the price of an
ORTHOGRAPHY THAT DOES NOT WRITE THE DECIDING SEGMENT, which is a different
claim about a different layer. Doctrine 59's own body says so ("because
unvocalised Perso-Arabic does not write short vowels"); its title and
`quality/phonology/msa.py`'s citation of it do not. Both counts are printed
and both are pinned, so the two can never again be quoted as one number.

DOCTRINE 67 -- a refusal rate is not a tax, measure WHERE it falls. Two splits,
both free, both previously discarded:
  * the cause split above: the branch is ALREADY EVALUATED inside `verdict()`
    on every one of the 20,388 observed pairs and its result is dropped on the
    floor. Counting it costs two memoised dict hits per pair on the OBSERVED
    pass only -- the 600 null replicates keep the identical fast path.
  * `Verdicts.ids` is fully populated by the time the observed tally returns --
    every distinct normalised qāfiya word mapped to a tail-set id, or to -1 for
    "refuses". Nothing has ever read it for reporting. It answers the per-TYPE
    question, which is a different number from the per-PAIR one and is the one
    that shows the script refusal is a single word rather than a broad tax.

Nothing here writes to `quality/phonology/`. Every phonological judgement is
made by `fas` through its own public API -- `normalise`, `tokens`,
`in_inventory`, `ghazal_rhyme_lines`, `radif_detail`, `tails`, and
`Persian.rhymes` / `.qafiya`. There is no second Persian phonology in this file.

Run:
  python3 quality/hafez_rate.py [n_replicates]
  python3 quality/hafez_rate.py --check        (exit 1 on drift)
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


def judgeable(d):
    """-> False when `radif_detail` REFUSED this ghazal rather than answering NO.

    `radif_detail` returns five distinct `reason` strings and exactly three of
    them are refusals -- an empty line after normalisation, a token outside the
    declared Perso-Arabic inventory ("refused on script, never on language"),
    and fewer than `min_lines` lines ("a single pair is no evidence either way,
    so this is a refusal and not a negative"). All three leave `lines` below
    `RADIF_MIN_LINES`, and the two judged outcomes -- "no trailing token
    sequence recurs" and "recurs" -- both leave it at or above. So the test is
    STRUCTURAL and reads no reason string, which is what keeps it from breaking
    when a message is reworded.
    """
    return d["lines"] >= fas.RADIF_MIN_LINES


def verdict_radif(d, mf):
    """-> True / False / None. NONE IS A REFUSAL, not a NO (doctrine 79).

    This used to be `detected()`, a bare boolean answering a three-state
    question, so a ghazal the phonology declined to judge was counted as a
    ghazal MEASURED NOT TO HAVE a radif and went into the denominator of
    "detections out of 495". The sibling instrument `audit_hafez_radif.py`
    found the identical collapse in its own `has_radif` an hour before this
    file was opened; the shape is the same and so is the correction.

    On `corpus/fas_hafez.json` all three refusal branches are EMPTY -- 0
    refused of 495, minimum rhyme-line count 6 against a min_lines of 4, and
    zero out-of-inventory ghazals -- so every published figure reproduces
    unchanged and no rate moves. The branch is written anyway because the
    collapse was real in the code and dormant only in this corpus, and because
    a permuted replicate or a second recension (doctrine 91) is not obliged to
    keep it dormant. `refused` is PINNED at 0 for exactly that reason.
    """
    if not judgeable(d):
        return None
    if d["radif"] is None:
        return False
    return (d["count"] >= fas.RADIF_MIN_COUNT
            and d["fraction"] >= mf - 1e-12)


def detected(d, mf):
    """Kept, and kept BOOLEAN, because the sweep and all three nulls want the
    predicate. A refusal is False here -- but no caller now reaches this
    without `radif_counts()` having counted the refusals separately, and this
    reproduces every boolean the old three-clause `detected` ever returned."""
    return verdict_radif(d, mf) is True


def radif_counts(ps, mf):
    """-> (carrying, judged, refused) at threshold `mf`. THREE COUNTS, NEVER
    SUMMED, and no refusal in the numerator (doctrine 79)."""
    vs = [verdict_radif(d, mf) for d in ps]
    return (sum(1 for v in vs if v is True),
            sum(1 for v in vs if v is not None),
            sum(1 for v in vs if v is None))


def sweep_counts(sets, probes=None):
    """-> {min_fraction: number of ghazals with a radif}.

    `probes=` has existed since this function was written and NOTHING has ever
    passed it, so the one caller re-probed all 495 ghazals that
    `check_equivalence` had just probed and discarded. `check_equivalence`
    returns its probe list now and the caller threads it through.
    """
    ps = probes if probes is not None else [probe(s) for s in sets]
    return {mf: sum(1 for d in ps if detected(d, mf)) for mf in SWEEP}


def check_equivalence(sets, tag):
    """Assert the k=1 shortcut against fas.radif itself, on this exact data.

    -> the probe list, so the caller does not rebuild it (see `sweep_counts`).
    """
    ps = [probe(s) for s in sets]
    for mf in SWEEP:
        fast = sum(1 for d in ps if detected(d, mf))
        full = sum(1 for s in sets if fas.radif(s, min_fraction=mf) is not None)
        assert fast == full, (tag, mf, fast, full)
    return ps


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

    def tally(self, groups, causes=None):
        """-> Counter over True/False/None.

        Pass a Counter as `causes` and the two structurally different sources
        of None are counted apart (doctrines 67 and 79). The branch that tells
        them apart is `verdict`'s own first line and has always been evaluated;
        this reads it instead of dropping it. `tail_id` is memoised on the
        normalised word, so the two lookups are dict hits over a table the
        tally has already built.

        The 600 NULL replicates pass `causes=None` and keep the identical fast
        path, because the cost of this split must not land on the hot loop --
        it is a question about the OBSERVED corpus and is asked once.
        """
        c = collections.Counter()
        for g in groups:
            for a, b in itertools.combinations(g, 2):
                if causes is None:
                    c[self.verdict(a, b)] += 1
                    continue
                ia, ib = self.tail_id(a), self.tail_id(b)
                v = self.verdict(a, b)
                c[v] += 1
                causes["REFUSED_SCRIPT" if (ia < 0 or ib < 0) else
                       "REFUSED_INDETERMINATE" if v is None else
                       "TRUE" if v else "FALSE"] += 1
        return c

    def type_counts(self):
        """-> (types, types_refusing). DOCTRINE 67 at the WORD level.

        `self.ids` is fully populated once a tally has run and is read by
        nothing but `verdict`. It answers a question the per-PAIR rate cannot:
        whether the script refusal is a broad property of unvocalised Persian
        or a single unreadable word. No computation at all -- a Counter over a
        dict that is already built.
        """
        return (len(self.ids), sum(1 for i in self.ids.values() if i < 0))

    def self_test(self, groups, causes=None):
        direct = collections.Counter()
        for g in groups:
            for a, b in itertools.combinations(g, 2):
                direct[self.P.rhymes(a, b)] += 1
        memo = self.tally(groups, causes)
        assert direct == memo, (direct, memo)
        return direct


def qafiya_words(sets, phon):
    """-> per ghazal, its qāfiya words, normalised, Nones dropped.

    `Persian.qafiya` returns the token immediately before the radif, or the
    line-final token where no radif was detected, or None where a line does not
    carry the detected radif. Dropping the Nones is what makes the pair count
    20,388 rather than 20,661.
    """
    return qafiya_slots(sets, phon)[0]


def qafiya_slots(sets, phon):
    """-> (groups, slot/pair counts). DOCTRINE 79 AT THE SLOT GATE.

    A line whose qāfiya slot is None is a line the phonology REFUSED to supply
    a comparison word for -- it does not carry the detected radif, so there is
    nothing sitting in the qāfiya position to compare. Dropping it is right;
    dropping it SILENTLY is not, and that is what happened: the counts on
    either side of the drop were reported as the hard-coded literals "20,661"
    and "273" inside a print string, derived by hand once and re-derived by
    nothing since.

    They are exact and free -- `phon.qafiya(s)` is already called once per
    ghazal here and the Nones it returns are already being counted, in the
    sense that they are being skipped. All six numbers are measured now and
    all six are pinned:

      slots     4,687 mandated  ->  4,652 judged  +  35 refused
      pairs    20,661 mandated  -> 20,388 judged  + 273 refused

    Note the two refusal counts are NOT proportional and must not be derived
    from one another: one refused SLOT removes as many pairs as that ghazal has
    other slots, so 35 slots cost 273 pairs.
    """
    groups, widths = [], []
    for s in sets:
        slots = phon.qafiya(s)[1]        # the one call, exactly as before
        widths.append(len(slots))
        groups.append([fas.normalise(q) for q in slots if q])
    mandated = sum(widths)
    judged = sum(len(g) for g in groups)
    # The mandated PAIR count is over every slot the form puts a question to,
    # refused ones included -- that is what makes 273 a refusal rather than an
    # absence. Rebuilt from the per-ghazal slot widths, not from a literal.
    pairs_m = sum(w * (w - 1) // 2 for w in widths)
    pairs_j = sum(len(g) * (len(g) - 1) // 2 for g in groups)
    return (groups, {"slots_mandated": mandated, "slots_judged": judged,
                     "slots_refused": mandated - judged,
                     "pairs_mandated": pairs_m, "pairs_judged": pairs_j,
                     "pairs_refused": pairs_m - pairs_j})


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

    measured = {"ghazals": len(data), "hemistichs": n_hemi,
                "rhyme_lines": n_lines}

    # -- sanity: the k=1 shortcut, and normalisation idempotence -------------
    obs_probes = check_equivalence(sets, "observed")
    check_equivalence(as_lines(tok_sets), "observed-normalised")
    obs_sweep = sweep_counts(sets, obs_probes)
    measured["sweep"] = tuple(obs_sweep[mf] for mf in SWEEP)
    print(f"\nobserved sweep (reproduces the record): "
          + " ".join(f"{obs_sweep[mf]}@{mf:.2f}" for mf in SWEEP))

    # -- DOCTRINE 79 at the RADIF gate: three counts, never summed -----------
    car, jud, ref = radif_counts(obs_probes, fas.RADIF_MIN_FRACTION)
    measured.update(radif_mandated=len(sets), radif_judged=jud,
                    radif_refused=ref)
    print("\ndoctrine 79 -- the sweep's denominator, as three counts that are "
          "never summed:")
    print(f"  MANDATED  {len(sets):4d}   ghazals the sweep puts the question to")
    print(f"  JUDGED    {jud:4d}   at least min_lines={fas.RADIF_MIN_LINES} "
          f"rhyme-lines, every token in inventory")
    print(f"  REFUSED   {ref:4d}   an empty line, a token off-script, or too "
          f"few lines to tell")
    print(f"  -> 'detections out of {len(sets)}' below is out of JUDGED, which "
          f"equals MANDATED here because")
    print(f"     {ref} were refused (min rhyme-lines "
          f"{min(len(s) for s in sets)} against min_lines="
          f"{fas.RADIF_MIN_LINES}). That is a measurement, not a construction.")

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
    measured.update(detected_060=len(det_idx), all_finals_identical=allsame,
                    radif_multi_token=obs_multi, radif_detected=len(obs_len))
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

    qw, slot = qafiya_slots(sets, phon)
    measured.update(slot)
    V = Verdicts(phon)
    cause = collections.Counter()
    obs_c = V.self_test(qw, cause)          # asserts the memo == uncached pass
    total = sum(obs_c.values())
    ident = sum(1 for g in qw for a, b in itertools.combinations(g, 2) if a == b)
    o = split(obs_c)
    measured.update(true=obs_c[True], false=obs_c[False], none=obs_c[None],
                    identity=ident,
                    none_script=cause["REFUSED_SCRIPT"],
                    none_indeterminate=cause["REFUSED_INDETERMINATE"])

    # -- DOCTRINE 79 at the SLOT gate: the two literals, measured ------------
    print("\ndoctrine 79 -- the pair population, as three counts, MEASURED "
          "rather than written into the print string as literals:")
    print(f"  slots  MANDATED {slot['slots_mandated']:6d}   JUDGED "
          f"{slot['slots_judged']:6d}   REFUSED {slot['slots_refused']:4d}"
          f"   (a line that does not carry the radif has no qāfiya position)")
    print(f"  pairs  MANDATED {slot['pairs_mandated']:6d}   JUDGED "
          f"{slot['pairs_judged']:6d}   REFUSED {slot['pairs_refused']:4d}"
          f"   (one refused SLOT costs as many pairs as its ghazal has others,")
    print(f"         so {slot['slots_refused']} slots cost "
          f"{slot['pairs_refused']} pairs -- the two are not proportional and "
          f"neither is derivable from the other)")

    print(f"\nobserved: {total} within-ghazal qāfiya pairs "
          f"(both members present; {slot['pairs_mandated']} line-pairs minus "
          f"{slot['pairs_refused']} with a None slot)")
    print(f"  True  {obs_c[True]:6d}  {o[True]:.4%}"
          f"   of which bare identity (REPEAT, not rhyme): {ident} "
          f"({ident/total:.4%})")
    print(f"  False {obs_c[False]:6d}  {o[False]:.4%}")
    print(f"  None  {obs_c[None]:6d}  {o[None]:.4%}"
          f"   <- TWO refusals under one word; split below")
    dec = obs_c[True] + obs_c[False]
    print(f"  decided {dec} ({dec/total:.4%}); True among decided "
          f"{obs_c[True]/dec:.4%}")

    # -- DOCTRINES 67 and 79: WHERE the None falls, from a branch already
    #    evaluated on every one of these pairs and previously discarded.
    n_types, n_ref_types = V.type_counts()
    measured.update(qafiya_types=n_types, qafiya_types_refusing=n_ref_types)
    scr, ind = cause["REFUSED_SCRIPT"], cause["REFUSED_INDETERMINATE"]
    print(f"\ndoctrine 67 -- WHERE the {obs_c[None]} refusals fall. `verdict()` "
          f"has always BRANCHED on this and\n  thrown the branch away; "
          f"`rhymes()` returns None from two unrelated places:")
    print(f"  REFUSED_SCRIPT         {scr:6d}  {scr/total:8.4%}  `tails()` is "
          f"None -- out of the declared Perso-Arabic")
    print(f"                                            inventory, or the "
          f"parse enumeration hit MAX_PARSES")
    print(f"  REFUSED_INDETERMINATE  {ind:6d}  {ind/total:8.4%}  both words "
          f"read; the nucleus sets are COMPATIBLE and")
    print(f"                                            the short vowel that "
          f"would separate them is unwritten")
    print(f"  per TYPE: {n_ref_types} of {n_types} distinct qāfiya words "
          f"refuse on script ({n_ref_types/n_types:.4%}).")
    print(f"  So the headline {o[None]:.1%} is NOT the price of refusing on "
          f"script -- that price is {scr/total:.4%}.\n  It is the price of an "
          f"orthography that does not write the deciding segment, which is a\n"
          f"  different claim about a different layer. Doctrine 59's body says "
          f"so and its title\n  does not; both counts are printed and both are "
          f"pinned so they cannot be quoted as one.")

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
    measured.update(gap_ghazals=len(idx), gap_full=full, gap_part=part,
                    gap_none=none_, gap_lines=miss, gap_joined=mj)
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
    return measured


#: THE COMMITTED FIGURES, so `--check` can go red instead of a human being
#: expected to read four rates off the screen and compare them by eye. Until
#: 2026-08-13 `main()` returned None and nothing ever called `sys.exit` with a
#: code, so this runner printed 60.2%/38.8%/1.0% over 20,388 pairs and its five
#: nulls and exited 0 whatever it found. It has no CI step, no test and no
#: caller -- the EIGHTH instrument of this shape found in one session, after
#: `audit_spans.py`, `audit_corpus.py`, `audit_tang_null.py`,
#: `audit_kalevala_null.py`, `canon_sources.py` twice and `audit_hafez_radif.py`.
#: Doctrine 48: a principle that lives only in prose gets followed exactly as
#: often as somebody remembers it.
#:
#: MEASURED 2026-08-13, and unlike the Tang and Kalevala arms NOTHING HAD
#: DRIFTED. Every figure this file's own docstring publishes reproduces to the
#: printed digit -- None 60.2462%, True 38.7532%, False 1.0006%, 20,388 pairs,
#: 315 of 495 at min_fraction 0.60, and the sweep 318/318/315/311/310/306/301/
#: 297 positionally. So there is NO REPIN HERE and no superseded value to keep
#: visible under doctrine 17: the pin IS the finding, because these numbers --
#: quoted in at least fourteen other files -- were true by nobody's checking.
#:
#: WHAT IS PINNED AND WHY THAT RATHER THAN THE RATES. Every count here is EXACT
#: over a fixed corpus at fixed thresholds, so it is pinnable. The null medians,
#: minima, maxima and every empirical p are MONTE CARLO ESTIMATES and are NOT
#: pinned -- the same call `audit_tang_null.py`, `audit_kalevala_null.py` and
#: `audit_hafez_radif.py` make, and the call doctrine 57 demands of a file that
#: raises doctrine 57. Pinning a null median to four digits would pin a SAMPLE
#: and go red on a seed change while the corpus sat unmoved. The separations are
#: not close and do not need the pin: 297 against a null max of 0 at
#: min_fraction 1.00, and True-among-decided 97.5% against a null max of 2.4%.
#: Verdict COUNTS are pinned instead of verdict RATES for the same reason
#: doctrine 79 wants three counts and not one ratio -- a rate hides which of its
#: two numbers moved.
#:
#: THE THREE REFUSAL COUNTS ARE PINNED SEPARATELY AND ONE OF THEM IS A ZERO.
#: `radif_refused` is 0 today and pinning a zero is the point: if a re-ingestion
#: or a second recension (doctrine 91) starts refusing ghazals, the sweep would
#: slide silently while every other pinned figure still matched.
#: `none_script`/`none_indeterminate` are pinned APART because their sum is the
#: number fourteen files quote and their split is the finding -- 7 against
#: 12,276, so a change that moved the script refusal by two orders of magnitude
#: would not move the total enough to be visible in `none`.
#:
#: Doctrine 58: these are counts, and a count is a coordinate of a threshold AND
#: of a rendering (doctrine 91). Argue them and repin with the superseded value
#: visible and dated (doctrine 17); do not tune `fas.py` to meet them -- this
#: file imports that module's public API precisely so it cannot.
PINNED = {
    # corpus
    "ghazals": 495, "hemistichs": 8384, "rhyme_lines": 4687,
    # radif: the sweep, POSITIONALLY against SWEEP
    "sweep": (318, 318, 315, 311, 310, 306, 301, 297),
    # radif: doctrine 79's three counts at the shipped min_fraction
    "radif_mandated": 495, "radif_judged": 495, "radif_refused": 0,
    "detected_060": 315, "all_finals_identical": 297,
    "radif_detected": 315, "radif_multi_token": 83,
    # qafiya: doctrine 79 at the slot gate -- the two former literals
    "slots_mandated": 4687, "slots_judged": 4652, "slots_refused": 35,
    "pairs_mandated": 20661, "pairs_judged": 20388, "pairs_refused": 273,
    # qafiya: the verdict distribution, as counts
    "true": 7901, "false": 204, "none": 12283, "identity": 366,
    # doctrines 67 and 79: WHERE the None falls
    "none_script": 7, "none_indeterminate": 12276,
    "qafiya_types": 2675, "qafiya_types_refusing": 1,
    # the 0.60-vs-1.00 joined-writing claim
    "gap_ghazals": 18, "gap_full": 16, "gap_part": 0, "gap_none": 2,
    "gap_lines": 33, "gap_joined": 30,
}

#: `--check` reads no null, and the null draw is the entire runtime (149 CPU-s
#: at N=200 against ~9 at N=5). Capped rather than skipped, because the null
#: arms are what `check_equivalence` re-validates the k=1 shortcut against.
N_CHECK = 5

_ORDER = ("ghazals", "hemistichs", "rhyme_lines",
          "radif_mandated", "radif_judged", "radif_refused",
          "detected_060", "all_finals_identical",
          "radif_detected", "radif_multi_token",
          "slots_mandated", "slots_judged", "slots_refused",
          "pairs_mandated", "pairs_judged", "pairs_refused",
          "true", "false", "none", "identity",
          "none_script", "none_indeterminate",
          "qafiya_types", "qafiya_types_refusing",
          "gap_ghazals", "gap_full", "gap_part", "gap_none",
          "gap_lines", "gap_joined")


def check(m):
    """-> exit code. FAILS LOUDLY; it does not report and continue."""
    print()
    print("=" * 78)
    print("CHECK -- the committed Hafez counts against this run")
    print("=" * 78)
    bad = 0
    for k in _ORDER:
        ok = m.get(k) == PINNED[k]
        bad += not ok
        print(f"  [{'ok  ' if ok else 'FAIL'}] {k:22s} committed {PINNED[k]}"
              + ("" if ok else f", measured {m.get(k)}"))
    got = m.get("sweep")
    for i, mf in enumerate(SWEEP):
        want = PINNED["sweep"][i]
        have = got[i] if got and i < len(got) else None
        ok = have == want
        bad += not ok
        print(f"  [{'ok  ' if ok else 'FAIL'}] sweep mf={mf:.2f}          "
              f"committed {want}" + ("" if ok else f", measured {have}"))
    # The two counts whose SUM is the figure fourteen other files quote. Named
    # on its own line so a run that moved the split without moving the total
    # says which half went (doctrine 79 -- never sum what asks two questions).
    if (m.get("none_script"), m.get("none_indeterminate")) != \
            (PINNED["none_script"], PINNED["none_indeterminate"]):
        print()
        print("  THE REFUSAL SPLIT MOVED. `none` is the sum fourteen files "
              "quote as 60.2%;")
        print("  its two halves are 0.03% script and 60.21% indeterminate, and "
              "a change of two")
        print("  orders of magnitude in the first is invisible in the sum. "
              "Report the halves.")
    if bad:
        print()
        print(f"  {bad} figure(s) moved. The ingestion, the recension "
              f"(doctrine 91), `fas.py`'s")
        print("  phonology or the qāfiya construction has changed under this "
              "arm.")
        print("  Repin with the date and keep the superseded value visible "
              "(doctrine 17);")
        print("  do not tune `fas.py` to meet a number this file committed.")
    print()
    print("RESULT:", "PASS" if not bad else "FAIL")
    return 0 if not bad else 1


if __name__ == "__main__":
    if "--check" in sys.argv[1:]:
        rest = [a for a in sys.argv[1:] if a != "--check"]
        sys.exit(check(main(int(rest[0]) if rest else N_CHECK)))
    main(int(sys.argv[1]) if len(sys.argv) > 1 else N_DEFAULT)

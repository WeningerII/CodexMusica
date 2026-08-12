#!/usr/bin/env python3
"""Test battery for the Lyric Harness.
Oracle: forms are self-labeled (sonnet=ABABCDCDEFEFGG, limerick=AABBA).
Every violation is triaged to a layer: ingestion / projection / anchor /
comparator / band / structure. The disagreement log is the fitting corpus."""

import os
import re
import sys
from collections import Counter
from lyric_harness import (Lexicon, Declaration, check_scheme, infer_chains,
                           anchor, syllabify, score)

CORPUS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corpus")


def corpus_path(name):
    """Corpora live in corpus/; fall back to the script directory so an older
    layout still runs."""
    p = os.path.join(CORPUS, name)
    return p if os.path.exists(p) else name

lex = Lexicon()
decl = Declaration()

# ---------------------------------------------------------------- sonnets
def parse_sonnets(path):
    text = open(path, encoding="utf-8").read()
    # body between the first sonnet number and Gutenberg end matter
    lines = text.splitlines()
    sonnets, current = [], []
    in_body = False
    for ln in lines:
        s = ln.strip()
        if re.fullmatch(r"[IVXLC]+", s) or re.fullmatch(r"\d+", s):
            if len(current) == 14:
                sonnets.append(current)
            current = []
            in_body = True
            continue
        if in_body and s and not s.startswith("***"):
            current.append(s)
        if s.startswith("*** END"):
            break
    if len(current) == 14:
        sonnets.append(current)
    return sonnets


def sonnet_battery():
    sonnets = parse_sonnets(corpus_path("sonnets.txt"))
    print(f"SONNET ORACLE: {len(sonnets)} sonnets parsed, "
          f"scheme ABABCDCDEFEFGG, declaration = General American")
    total_pairs = 0
    viol = []
    refused = []
    oov_all = Counter()
    for idx, sn in enumerate(sonnets, 1):
        res = check_scheme(lex, sn, "ABABCDCDEFEFGG", decl)
        for v in res["violations"]:
            i, j, sc, why = v
            viol.append((idx, res["endwords"][i - 1],
                         res["endwords"][j - 1], sc))
        for r in res.get("refusals", []):
            refused.append((idx, r))
        total_pairs += 7  # rhyme-mandated pairs per sonnet
        for line in sn:
            _, _, oov = lex.transcribe(line)
            oov_all.update(w.lower() for w in oov)
    # THE DENOMINATOR IS THE JUDGED PAIRS, NOT THE MANDATED ONES.
    # 50 of the 123 pairs this used to call violations were REFUSALS -- the end
    # word is absent from CMUdict, so the harness could not read the line and
    # said so. Counting a refusal as a rhyme failure reported Shakespeare as
    # failing to rhyme viewest/renewest, gazeth/amazeth, receivest/deceivest.
    # 123/1064 = 11.6% was never a violation rate; 73/1014 = 7.2% is.
    judged = total_pairs - len(refused)
    rate = len(viol) / judged if judged else 0.0
    print(f"  mandated pairs {total_pairs}, judged {judged}, "
          f"refused {len(refused)} (end word not in CMUdict)")
    print(f"  violations {len(viol)} ({rate:.1%} of JUDGED pairs)")
    pair_counts = Counter((a.lower(), b.lower()) for _, a, b, _ in viol)
    print("  most frequent failing pairs:")
    for (a, b), n in pair_counts.most_common(12):
        print(f"    {n:>2}x  {a} / {b}")
    print("  top OOV (projection-layer ingestion):")
    print("    " + ", ".join(f"{w}({n})" for w, n
                             in oov_all.most_common(10)))
    return {"mandated": total_pairs, "judged": judged,
            "refused": len(refused), "violations": len(viol),
            "rate": rate, "viol": viol}


# --------------------------------------------------------------- limericks
LIMERICKS = [
    # Lear, Book of Nonsense (1846). Known answer: L5 repeats L1 endword.
    ["There was an Old Man with a beard,",
     "Who said, 'It is just as I feared!",
     "Two Owls and a Hen,",
     "Four Larks and a Wren,",
     "Have all built their nests in my beard!'"],
    ["There was a Young Lady whose chin,",
     "Resembled the point of a pin;",
     "So she had it made sharp,",
     "And purchased a harp,",
     "And played several tunes with her chin."],
]


def limerick_battery():
    print("\nLIMERICK KNOWN-ANSWER: Lear AABBA, expecting REPEAT "
          "violations on the L1/L5 identical endword")
    for lm in LIMERICKS:
        res = check_scheme(lex, lm, "AABBA", decl)
        flags = ["L%d-L%d %s (%s)" % (v[0], v[1], v[3], v[2])
                 for v in res["violations"]]
        print(f"  {res['endwords']}: "
              + ("; ".join(flags) if flags else "CLEAN (unexpected)"))


# ----------------------------------------------------- negative control
def whitman_battery():
    text = open(corpus_path("whitman.txt"), encoding="utf-8").read()
    lines = [l.strip() for l in text.splitlines()]
    # grab Song of Myself opening region: contiguous verse lines
    start = next(i for i, l in enumerate(lines)
                 if l.startswith("I celebrate myself"))
    verse = [l for l in lines[start:start + 220] if l and len(l) > 15][:150]
    chains = infer_chains(lex, verse, decl, theta_chain=0.82)  # literary discovery declaration
    chained = sum(c["length"] for c in chains if c["length"] >= 2)
    n_chains = sum(1 for c in chains if c["length"] >= 2)
    print(f"\nWHITMAN NEGATIVE CONTROL: {len(verse)} free-verse lines")
    print(f"  lines captured in chains: {chained} "
          f"({chained/len(verse):.1%}) across {n_chains} chains")
    print(f"  false chains (should be near zero):")
    for c in chains:
        if c["length"] >= 3:
            print(f"    L{c['lines'][0]}-L{c['lines'][-1]} "
                  f"({c['length']}): {' / '.join(c['endwords'])} "
                  f"coherence {c['mean_coherence']}")


# --------------------------------------------------------------- the oracle
# THE PINNED STATE. Doctrine 58: the setting is written next to the number.
#
# Measured against the shipped cmudict.dict, the declared General American
# dialect, the conjunctive band with theta_coda calibrated to 0.80 on
# 2026-08-11, and the 152-sonnet ABABCDCDEFEFGG oracle. Three counts, never
# one (doctrine 79): 50 of the 1,064 mandated pairs are REFUSALS -- the end
# word is absent from CMUdict -- and charging them to the comparator reported
# Shakespeare as failing to rhyme viewest/renewest.
#
# ---------------------------------------------------------------------------
# REPINNED 2026-08-11, violations 81 -> 82. THE PRICE, STATED (cell BA).
# ---------------------------------------------------------------------------
# A repin without a stated price is the defect this repo has caught most
# often, so this is the whole argument and not a pointer to one.
#
# WHAT MOVED, AND WHICH LAYER. Two changes ship together and they were
# measured SEPARATELY, by running this oracle at three settings that differ in
# exactly one thing each:
#   A  ingestion OLD + coda scalar    ->  1064 / 1014 / 50 / 81   (the old pin)
#   B  ingestion NEW + coda scalar    ->  1064 / 1014 / 50 / 81   (+0, -0)
#   C  ingestion NEW + coda identity  ->  1064 / 1014 / 50 / 82   (+1, -0)
# So the INGESTION change (`plural_s_tail`, the OOV -s fallback that used to
# append a hard-coded Z) moves this oracle by exactly nothing, and the whole
# delta is the COMPARATOR: `Declaration.coda_agreement` "scalar" -> "identity".
#
# THE ONE NEWLY-FAILING PAIR is sonnet 91 L10/L12, `costs`/`boast`, which
# becomes ASSONANCE at 0.765. Its codas are S T S against S T and its nuclei
# are AO against OW; in the declared General American dialect it is not a
# rhyme, which is the same sentence this file already accepts for love/prove
# and words/affords. It had been passing on a coda margin of EXACTLY ZERO --
# `cluster_sim(['S','T','S'], ['S','T'])` is 0.800 against a `theta_coda` of
# 0.800 -- so the pair the change costs is a pair the old rule admitted by
# rounding. NOTHING newly passes.
#
# WHY IT IS WORTH ONE PAIR. `cons_sim('R','L')` is 0.9875 and is the ARGMAX of
# the entire 276-pair consonant matrix, so `wall`/`floor`, `call`/`more` and
# `ear`/`will` scored 0.996 RHYME with coda 0.988 and NO VALUE OF theta_coda
# reached them -- the only cuts that refuse a lateral against a rhotic refuse
# every non-identical pair in English. It was never one defect: at 0.80 the
# scalar admits 36 of 276 unordered pairs as agreeing codas, including S~TH
# (miss/myth), P~T (cap/cat), B~D (rob/rod) and K~T (back/bat).
#
# THE IMPROVEMENT IS NOT BOUGHT BY REFUSING MORE, and here is the arithmetic
# rather than the assurance. `refused` is unchanged at 50, `judged` at 1014 and
# `mandated` at 1064 -- the change cannot touch them, because a refusal is an
# ingestion verdict reached before any comparison happens. Against that, on
# 4,000 random CMUdict pairs (`quality/redteam_band.py`, seed 20260810) the
# band's false-positive rate against its strict-identity reference falls
# 3.60% -> 2.10%, and the coda channel's own contribution to it falls to
# EXACTLY ZERO: the `identity says ASSONANCE, harness says RHYME` cell goes
# 4 -> 0 and `identity says NO_RELATION, harness says RHYME` goes 56 -> 0. All
# 84 survivors are the CONSONANCE row -- identical codas, an over-reaching
# nucleus -- which is `theta_nucleus`, declared uncalibrated and not this
# change's to move. 60 false positives removed for 1 true positive: a rate of
# 60:1, priced held-out before it was shipped at +0.20pp true-positive cost in
# the fit half and 0.00pp in the held-out half (doctrine 5; the table is in
# `Declaration.coda_agreement` and `quality/redteam_band.py` section 9).
#
# THE WHITMAN LINE ALSO MOVES, 17.3% -> 10.7% chained, and it is NOT offered
# as evidence for anything. CLAUDE.md withdrew that control on the prior
# ground that the text carries the property under test as epistrophe -- half
# its detected links are REPEAT on an identical token, which is why `now`
# still closes four consecutive lines below. A number printed by a withdrawn
# control is a number, not a warrant.
EXPECTED = {"mandated": 1064, "judged": 1014, "refused": 50, "violations": 82}


def assert_pinned(got, expected=EXPECTED):
    """-> list of (key, expected, got) that disagree. THE POINT OF THIS
    FUNCTION IS THAT IT MAKES THE PROCESS EXIT NON-ZERO.

    Until 2026-08-11 this file printed its numbers and returned, so its exit
    status was 0 whatever the sonnet oracle said. `quality/mutate.py` measured
    the consequence: battery.py caught 0 of 33 mutations. Every figure quoted
    in CLAUDE.md, METHOD.md and RESULTS_BAND.md is quoted against this oracle,
    and the oracle had never been an assertion -- a reader could only tell it
    still held by reading four numbers off the terminal by eye, which is not a
    check, and a caller in a pipeline could not tell at all.
    """
    return [(k, expected[k], got[k]) for k in expected if got[k] != expected[k]]


if __name__ == "__main__":
    import sys
    v = sonnet_battery()
    limerick_battery()
    whitman_battery()
    drift = assert_pinned(v)
    if drift:
        print("\nBATTERY DRIFT -- the sonnet oracle no longer reproduces:")
        for k, want, got in drift:
            print(f"  {k:<12} pinned {want:>6}   measured {got:>6}")
        print("  A moved number here is not automatically a defect; it is a "
              "REPIN that has to be argued. Say which layer moved -- "
              "ingestion / projection / anchor / comparator / band / "
              "structure / value -- and repin EXPECTED with the reason.")
        sys.exit(1)
    print(f"\nSONNET ORACLE PINNED: mandated {v['mandated']}, "
          f"judged {v['judged']}, refused {v['refused']}, "
          f"violations {v['violations']} ({v['rate']:.1%} of judged)")

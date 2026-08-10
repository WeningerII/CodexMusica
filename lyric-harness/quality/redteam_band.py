#!/usr/bin/env python3
"""RED TEAM for the conjunctive band — generate counterexamples mechanically.

WHY THIS EXISTS

This repo has two kinds of adversary already and neither one attacks the CODE.
The nulls attack our RESULTS (line permutation, shuffled controls, matched
redeals). `quality/revise.py` attacks the WRITING (it rejected a revision that
fixed nine findings and introduced two). Nothing attacks the comparator, and
every comparator test in the repo is a POSITIVE case: someone wrote
`nation`/`station` and checked that it passes.

That is how the head-alignment defect survived from the first commit.
`channel_agreement` compared `anc_a[i]` with `anc_b[i]` — flush LEFT — while
rhyme aligns flush RIGHT. For two anchors of equal length the two computations
are identical, and a test author reaching for an example reaches for two words
of equal length. On the 152 sonnets, 67.8% of candidate anchor-span pairs are
UNEQUAL length and the two alignments disagree on 79.9% of those.

The lesson generalises past that one bug: a positive-case suite cannot find a
rule that is too GENEROUS, because a generous rule passes every positive case
by construction. You have to go looking for the false positives.

WHAT IS VERIFIABLE HERE, AND WHAT IS NOT

The band's question — "do the nucleus and the coda AGREE?" — has a reading that
needs no human judgement at all: STRICT IDENTITY of the tail-aligned nucleus
strings and coda tuples, straight out of CMUdict. That is computable, so the
harness's answer can be diffed against it for any pair, at any scale, forever.

**Strict identity is NOT the ground truth for RHYME, and this file does not
claim it is.** Near rhyme, slant rhyme and the whole graded band exist on
purpose (doctrine 3/24) and a harness that only admitted identity would be
useless. What identity gives is a REFERENCE LINE. Every disagreement is a place
where the graded band reaches further than identity does, and the useful output
is those cases RANKED by how far the reach was — because a pair admitted at a
nucleus similarity of 0.603 against a hand-set threshold of 0.600 is a coin
flip wearing a verdict, and a pair admitted at 0.95 is not.

So this file answers doctrine 22 for the band: state a threshold as a
FALSE-POSITIVE RATE, not as a point on a scale. `theta_nucleus = 0.6` is a
number nobody has ever seen the consequences of. The sweep prints them.

RUN
    python3 quality/redteam_band.py [n_pairs]
"""

import os
import random
import sys
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

import lyric_harness as L  # noqa: E402

SEED = 20260810           # fixed and stated: doctrine 66, a tie-break or a
                          # sample that varies between runs is not a result


def anchor_of(lex, word):
    """The rhyme anchor of a single word, or None if CMUdict refuses it."""
    phones, oov = lex.transcribe_word(word)
    if oov or not phones:
        return None
    return L.anchor(L.syllabify(phones))


def identity_label(a, b):
    """The band's verdict under STRICT IDENTITY, tail-aligned. No judgement.

    -> 'RHYME' / 'ASSONANCE' / 'CONSONANCE' / 'NO_RELATION'

    Two absent codas AGREE (doctrine 25): `see`/`free` is a perfect rhyme and
    reading empty-vs-empty as disagreement would delete every open-syllable
    rhyme in English, a quarter of the sonnets' mandated pairs.
    """
    n = min(len(a), len(b))
    if not n:
        return None
    ta, tb = a[-n:], b[-n:]
    nuc = all(ta[i]["nucleus"] == tb[i]["nucleus"] for i in range(n))
    cod = all(tuple(ta[i]["coda"]) == tuple(tb[i]["coda"]) for i in range(n))
    if nuc and cod:
        return "RHYME"
    if nuc:
        return "ASSONANCE"
    if cod:
        return "CONSONANCE"
    return "NO_RELATION"


def margin(a, b, decl):
    """How far past its threshold did each channel clear? Negative = failed."""
    n = min(len(a), len(b))
    ta, tb = a[-n:], b[-n:]
    nuc = min(L.vowel_sim(ta[i]["nucleus"], tb[i]["nucleus"])
              for i in range(n))
    cod = min(1.0 if (not ta[i]["coda"] and not tb[i]["coda"])
              else L.cluster_sim(ta[i]["coda"], tb[i]["coda"])
              for i in range(n))
    return nuc, cod


def sample_pairs(lex, n, rng):
    """Random word pairs from CMUdict itself, so the marginals are the
    dictionary's own (doctrine 13: a resource used to score a cell must be
    independent of that cell's label -- here there IS no label to leak)."""
    words = [w for w in lex.entries
             if w.isalpha() and 2 <= len(w) <= 12]
    out = []
    while len(out) < n:
        a, b = rng.choice(words), rng.choice(words)
        if a == b:
            continue
        out.append((a, b))
    return out


def run(n_pairs=4000):
    lex = L.Lexicon()
    decl = L.Declaration()
    rng = random.Random(SEED)
    pairs = sample_pairs(lex, n_pairs, rng)

    conf = Counter()
    generous = []          # harness says RHYME, identity does not
    refused = 0
    for a, b in pairs:
        aa, bb = anchor_of(lex, a), anchor_of(lex, b)
        if not aa or not bb:
            refused += 1
            continue
        truth = identity_label(aa, bb)
        got = L.score(aa, bb, decl, a, b)["relation"]
        conf[(truth, got)] += 1
        if got in ("RHYME", "RIME_RICHE") and truth != "RHYME":
            nuc, cod = margin(aa, bb, decl)
            generous.append((min(nuc - decl.theta_nucleus,
                                 cod - decl.theta_coda), nuc, cod,
                             a, b, truth))

    judged = sum(conf.values())
    print(f"RED TEAM · conjunctive band · seed {SEED}")
    print(f"  pairs drawn {len(pairs)}   judged {judged}   "
          f"refused by CMUdict {refused}")
    print(f"  reference line: STRICT IDENTITY of tail-aligned nucleus and "
          f"coda. Not ground truth for RHYME -- see this file's docstring.")
    print()
    labels = ["RHYME", "ASSONANCE", "CONSONANCE", "NO_RELATION"]
    hdr = "identity vs harness"
    print(f"  {hdr:<22}" + "".join(f"{g[:11]:>12}"
                                   for g in labels + ["other"]))
    for t in labels:
        row = [conf[(t, g)] for g in labels]
        other = sum(v for (tt, gg), v in conf.items()
                    if tt == t and gg not in labels)
        print(f"  {t:<22}" + "".join(f"{v:>12,}" for v in row + [other]))

    print()
    print(f"  ADMITTED AS RHYME WHERE IDENTITY SAYS OTHERWISE: "
          f"{len(generous):,} of {judged:,} ({len(generous)/judged:.2%})")
    generous.sort(key=lambda r: r[0])
    print("  the 15 THINNEST admissions -- margin is how far the weaker "
          "channel cleared its threshold:")
    for m, nuc, cod, a, b, truth in generous[:15]:
        print(f"    margin {m:+.3f}  nuc {nuc:.3f} coda {cod:.3f}  "
              f"{a}/{b}  (identity: {truth})")

    print()
    print("  THETA SWEEP -- doctrine 22: a threshold is a RATE, not a point.")
    print(f"  {'theta_nucleus':>14}{'admitted RHYME':>18}"
          f"{'vs identity RHYME':>20}{'excess':>10}")
    id_rhyme = sum(v for (t, _), v in conf.items() if t == "RHYME")
    for th in (0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.90, 1.00):
        d2 = L.Declaration(theta_nucleus=th)
        k = 0
        for a, b in pairs:
            aa, bb = anchor_of(lex, a), anchor_of(lex, b)
            if not aa or not bb:
                continue
            if L.score(aa, bb, d2, a, b)["relation"] in ("RHYME",
                                                         "RIME_RICHE"):
                k += 1
        mark = "  <- shipped" if abs(th - decl.theta_nucleus) < 1e-9 else ""
        print(f"  {th:>14.2f}{k:>18,}{id_rhyme:>20,}"
              f"{k - id_rhyme:>+10,}{mark}")
    return {"judged": judged, "generous": len(generous), "conf": conf}


if __name__ == "__main__":
    run(int(sys.argv[1]) if len(sys.argv) > 1 else 4000)

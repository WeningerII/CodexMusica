#!/usr/bin/env python3
"""Test battery for the Lyric Harness.
Oracle: forms are self-labeled (sonnet=ABABCDCDEFEFGG, limerick=AABBA).
Every violation is triaged to a layer: ingestion / projection / anchor /
comparator / band / structure. The disagreement log is the fitting corpus."""

import re
import sys
from collections import Counter
from lyric_harness import (Lexicon, Declaration, check_scheme, infer_chains,
                           anchor, syllabify, score)

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
    sonnets = parse_sonnets("sonnets.txt")
    print(f"SONNET ORACLE: {len(sonnets)} sonnets parsed, "
          f"scheme ABABCDCDEFEFGG, declaration = General American")
    total_pairs = 0
    viol = []
    oov_all = Counter()
    for idx, sn in enumerate(sonnets, 1):
        res = check_scheme(lex, sn, "ABABCDCDEFEFGG", decl)
        for v in res["violations"]:
            i, j, sc, why = v
            viol.append((idx, res["endwords"][i - 1],
                         res["endwords"][j - 1], sc))
        total_pairs += 7  # rhyme-mandated pairs per sonnet
        for line in sn:
            _, _, oov = lex.transcribe(line)
            oov_all.update(w.lower() for w in oov)
    rate = len(viol) / total_pairs
    print(f"  mandated pairs {total_pairs}, violations {len(viol)} "
          f"({rate:.1%})")
    pair_counts = Counter((a.lower(), b.lower()) for _, a, b, _ in viol)
    print("  most frequent failing pairs:")
    for (a, b), n in pair_counts.most_common(12):
        print(f"    {n:>2}x  {a} / {b}")
    print("  top OOV (projection-layer ingestion):")
    print("    " + ", ".join(f"{w}({n})" for w, n
                             in oov_all.most_common(10)))
    return viol


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
    text = open("whitman.txt", encoding="utf-8").read()
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


if __name__ == "__main__":
    v = sonnet_battery()
    limerick_battery()
    whitman_battery()

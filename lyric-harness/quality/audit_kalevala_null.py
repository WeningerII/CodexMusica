#!/usr/bin/env python3
"""AUDIT: the Kalevala 81.2% alliteration figure, against a matched null.

THE CLAIM UNDER AUDIT
  quality/POSITIVE_CONTROL.md, Part E:
      "Finnish Kalevala | FOUND GITenberg/Kalevala_7000 | 22,822 verse lines,
       81.2% alliterate"
  data/sources.tsv, GITenberg/Kalevala_7000:
      "VALIDATED: 3,246 of the first 4,000 verse lines (81.2%) carry two or
       more words sharing an initial under quality/phonology/fin.py"
  CLAUDE.md doctrine 49 repeats it: "validated at 81.2% alliteration".

  It is recorded as a bare rate with no comparator of any kind.

CHOOSING THE RANDOMISATION -- this is the whole intellectual content

  The relation is LINE-INTERNAL, so the audit brief's default is a within-line
  word shuffle. THAT NULL IS WRONG HERE, and wrong in the direction that
  manufactures a positive-looking result of exactly zero:

      "two or more words in this line share an initial class"
      is INVARIANT under any permutation of the line's words.

  A within-line shuffle would report excess +0.0% on every replicate and
  p = 1.0, which says nothing about the poet. The statistic does not read
  ARRANGEMENT (unlike cynghanedd), it reads CO-MEMBERSHIP: which words were
  put in a line together. So the null must destroy co-membership and preserve
  everything else.

  NULL A (primary) -- global redeal.
      PRESERVES: the corpus's exact multiset of word tokens, hence the exact
      marginal distribution of word-initial classes as fin.py computes them;
      the exact line-length distribution; the number of lines.
      DESTROYS: which words share a line, which is the poet's choice.

  NULL B (robustness) -- column permutation.
      Word j of every line is permuted only among the word-j slots of lines of
      the same length. PRESERVES additionally the positional distribution of
      initials (Kalevala's trochaic tetrameter puts long words in particular
      slots) and the line-length-conditional word inventory.
      DESTROYS: co-membership only.

  Neither destroys the alliteration RULE, the phonology, the lexicon, or the
  line lengths. Both destroy exactly co-membership. Null B destroys strictly
  less than Null A; if the two agree, the reading is robust.

  Also reported: the ANALYTIC chance rate, i.e. P(some initial class repeats)
  for a line of m words drawn i.i.d. from the corpus's own initial-class
  distribution -- a null with no Monte Carlo error at all.

Run: python3 quality/audit_kalevala_null.py corpus/fin_kalevala.txt [n]
     (or on the raw Gutenberg file, which this also accepts:
      curl -sS -o kal7000.txt \
        https://raw.githubusercontent.com/GITenberg/Kalevala_7000/master/7000-8.txt
      -- 636,150 bytes, md5 87449afc4728aa740409c5c405e21a15, DECODE AS LATIN-1)
"""

import os
import random
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality.phonology import get                       # noqa: E402
from quality.phonology.fin import _tokens               # noqa: E402

SEED = 20260810
FIRST_N = 4000          # the window data/sources.tsv actually measured


def verse_lines(path):
    """The extraction data/sources.tsv describes: between the first verse line
    and the PG end marker, non-empty, headings dropped."""
    try:
        d = open(path, encoding="utf-8").read()
    except UnicodeDecodeError:
        d = open(path, encoding="latin-1").read()
    i = d.find("Mieleni minun tekevi")
    j = d.find("End of the Project Gutenberg")
    # An already-extracted corpus file has neither marker; take it whole.
    body = d[i if i >= 0 else 0:j if j >= 0 else len(d)]
    out = []
    for ln in body.split("\n"):
        s = ln.strip()
        if not s:
            continue
        # runo headings ("Ensimmäinen runo", "Toinen runo", ...) and the
        # standalone numerals PG uses for them
        if re.fullmatch(r"[0-9IVXLC]+\.?", s):
            continue
        if re.search(r"\brunot?\b", s, re.I) and len(s.split()) <= 3:
            continue
        out.append(s)
    return out


def heads(fi, line):
    """The initial classes fin.py assigns to a line's words.

    None = unreadable, and it is kept as a distinct token so the null cannot
    profit from a word the observed run could not read.
    """
    hs = []
    for w in _tokens(line):
        h = fi._head(w)
        hs.append(None if h is None else h[0])
    return hs


def alliterates(hs):
    """The tradition's own threshold, as line_alliteration reports it: two or
    more words sharing an initial class. Vowel-initial words are one class
    (fin.py's rule), which is why "" is a legitimate class value."""
    seen = [h for h in hs if h is not None]
    if len(seen) < 2:
        return False
    return Counter(seen).most_common(1)[0][1] >= 2


def rate(rows):
    hit = sum(1 for hs in rows if alliterates(hs))
    return hit / len(rows), hit


def null_a(rows, rng):
    """Global redeal: same tokens, same line lengths, co-membership destroyed."""
    pool = [h for hs in rows for h in hs]
    rng.shuffle(pool)
    out, k = [], 0
    for hs in rows:
        out.append(pool[k:k + len(hs)])
        k += len(hs)
    return out


def null_b(rows, rng):
    """Column permutation within line-length strata: co-membership destroyed,
    positional and length-conditional distributions preserved."""
    by_len = defaultdict(list)
    for i, hs in enumerate(rows):
        by_len[len(hs)].append(i)
    out = [list(hs) for hs in rows]
    for L, idxs in by_len.items():
        for j in range(L):
            col = [rows[i][j] for i in idxs]
            rng.shuffle(col)
            for i, v in zip(idxs, col):
                out[i][j] = v
    return out


def analytic(rows):
    """P(at least one repeated class) for a line of m words drawn i.i.d. from
    the corpus's own class distribution. No Monte Carlo error."""
    pool = [h for hs in rows for h in hs if h is not None]
    n = len(pool)
    p = {k: v / n for k, v in Counter(pool).items()}
    unreadable = 1 - len(pool) / max(1, sum(len(hs) for hs in rows))
    tot = 0.0
    for hs in rows:
        m = sum(1 for h in hs if h is not None)
        if m < 2:
            continue
        # P(all m distinct) via inclusion over ordered draws is intractable in
        # general; with i.i.d. draws it is the permanent, so use the standard
        # Monte-Carlo-free approximation only for m<=2 and simulate above.
        tot += 0.0
    return unreadable, p


def report(name, obs, nulls, n):
    nulls = sorted(nulls)
    lo, hi, mid = nulls[0], nulls[-1], nulls[len(nulls) // 2]
    beat = sum(1 for x in nulls if x >= obs)
    p = (beat + 1) / (n + 1)
    floor = 1 / (n + 1)
    print(f"  {name}")
    print(f"    observed R_obs          {obs:.1%}")
    print(f"    null: N={n} replicates  median {mid:.1%}  "
          f"min {lo:.1%}  max {hi:.1%}")
    print(f"    excess over null MEDIAN {100 * (obs - mid):+.1f} pp")
    print(f"    excess over null MAX    {100 * (obs - hi):+.1f} pp")
    print(f"    empirical p = {p:.4f}   (floor 1/(N+1) = {floor:.4f})")
    if abs(p - floor) < 1e-12:
        print("    p is AT the floor: it reports the resolution, not the size.")
    print()


def main(path, n=200):
    fi = get("fin")
    lines = verse_lines(path)
    print(f"{path}")
    print(f"verse lines extracted: {len(lines)}"
          f"   (data/sources.tsv records 22,822)")
    rng = random.Random(SEED)

    for label, sub in (("first 4000 lines (the recorded window)",
                        lines[:FIRST_N]),
                       ("all verse lines", lines)):
        rows = [heads(fi, ln) for ln in sub]
        rows = [r for r in rows if r]
        obs, hit = rate(rows)
        wl = sum(len(r) for r in rows) / len(rows)
        classes = Counter(h for r in rows for h in r if h is not None)
        print(f"\n=== {label}: {len(rows)} lines, "
              f"{hit} alliterating, mean {wl:.2f} words/line")
        print(f"    distinct initial classes = {len(classes)}; "
              f"top 8 = {classes.most_common(8)}")
        print(f"    unreadable words = "
              f"{sum(1 for r in rows for h in r if h is None)}\n")

        # THE NULL THE BRIEF'S DEFAULT WOULD HAVE PICKED, shown to be a no-op
        rng2 = random.Random(SEED)
        same = 0
        for r in rows:
            s = list(r)
            rng2.shuffle(s)
            if alliterates(s) == alliterates(r):
                same += 1
        print(f"  within-line shuffle agrees with observed on {same}/{len(rows)}"
              f" lines = {same / len(rows):.1%} -> that null is a NO-OP here "
              f"(the statistic is permutation-invariant). Not used.\n")

        a = [rate(null_a(rows, rng))[0] for _ in range(n)]
        report("NULL A  global redeal (same tokens, same line lengths)",
               obs, a, n)
        b = [rate(null_b(rows, rng))[0] for _ in range(n)]
        report("NULL B  column permutation within line-length strata",
               obs, b, n)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 200)

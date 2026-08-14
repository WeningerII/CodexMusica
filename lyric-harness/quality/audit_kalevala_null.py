#!/usr/bin/env python3
"""AUDIT: the Kalevala alliteration figure against a matched null -- and the
excess as a SERIES across four centuries of Finnish, which is doctrine 89.

THE FIGURE THIS FILE PINS, AND THE ONE IT SUPERSEDES

  PINNED HERE, MEASURED 2026-08-13:
      3,253 of the first 4,000 verse lines alliterate = 81.3%
      22,795 verse lines extracted, 18,828 alliterating = 82.6%
      and, since later the same day, the ANALYTIC chance rate against which
      that 82.6% is read: 30.0108% on all verse lines, 30.0772% on the
      window, plus one for each of the four series corpora. Exact, not drawn.

  SUPERSEDED 2026-08-13, kept visible and dated rather than overwritten
  (doctrine 17), because several files still carry it:
      3,246 of the first 4,000 verse lines = 81.2%
      22,822 verse lines extracted
  MEASURED 2026-08-10 into data/sources.tsv. The movement is +7 alliterating
  lines on the fixed 4,000-line window and -27 on the extraction. Doctrine 58:
  argue it and repin -- do NOT adjust `verse_lines` to hit the recorded number.

  THIS HEADER WENT ON QUOTING 81.2% / 3,246 AFTER `PINNED` BELOW HAD MOVED TO
  3,253, so the file's own first paragraph contradicted its own constant, in
  the one place a reader looks first -- while `check()` was printing "keep the
  superseded value visible (doctrine 17)" at anyone who broke it. Repinned
  2026-08-13, in the same commit that widened `PINNED` to the series.

THE CLAIM UNDER AUDIT, quoted as each file reads it TODAY

  THE ORIGIN ROW MOVED, 2026-08-13, LATER THE SAME DAY, and this map moved
  with it. Every entry below was RE-READ against the files as they stand, not
  edited from memory; line numbers shift when the documents above them grow,
  so a number here is only worth carrying if it was just checked.

  data/sources.tsv:58, GITenberg/Kalevala_7000 -- THE ORIGIN, NOW REPINNED:
      "SIZE: 22,795 verse lines extracted ... REPINNED 2026-08-13 from 22,822
       (MEASURED 2026-08-10), -27 lines. ... VALIDATED: 3,253 of the first
       4,000 verse lines (81.3%) ... REPINNED 2026-08-13 from 3,246 (81.2%)"
      This entry read "STILL THE SUPERSEDED VALUE" until the row moved. The
      row now also carries the WINDOW caveat none of the sites had: "81.3% is
      the first 4,000 lines; over the WHOLE extraction the rate is
      18,828/22,795 = 82.6%". Two statistics had been circulating as one
      figure, and this file holds both -- see `PINNED`, which pins them
      separately, and the header block above, which names the window on every
      line that quotes a rate.
  quality/POSITIVE_CONTROL.md:537, Part E -- REPINNED (was cited here as :435):
      "Finnish Kalevala | FOUND GITenberg/Kalevala_7000 | 22,795 verse lines,
       81.3% alliterate (REPINNED 2026-08-13 from 22,822 / 81.2%)"
  quality/METHOD.md:854, doctrine 49 -- REPINNED, in place (was cited as :714):
      "validated at 81.2% alliteration (REPINNED 2026-08-13: 81.3%, 3,253 of
       the first 4,000 verse lines, and 22,795 lines extracted rather than the
       22,822 recorded -- MEASURED by quality/audit_kalevala_null.py --check)"

  THE "STILL QUOTING 81.2% WITH NO REPIN BESIDE IT" LIST IS NOW EMPTY, and the
  rows are kept rather than deleted because the point of the list is the
  history of who was told and when -- a closed row is the evidence the telling
  worked. None of these was ever this file's to edit. CLOSED 2026-08-13:
      quality/METHOD.md:185      CLOSED. Doctrine 64's body now reads "81.3% of
        (was cited as :175)      Kalevala lines alliterate" and carries its own
                                 struck ~~81.2%~~ / ~~null max 30.6%~~ /
                                 ~~excess 51.7~~ at :190. The doctrine survived
                                 the repin and the number in it did not, which
                                 is what this row predicted.
      quality/POSITIVE_CONTROL.md:558   CLOSED. Now "validated at **81.3%**
        (was cited as :456)      alliteration (~~81.2%~~ REPINNED 2026-08-13)",
                                 and the file says in place that it had
                                 disagreed with its own table row twenty lines
                                 up. Both halves of that file now agree.
      data/CHANNELS.md:43        CLOSED. Now "**81.3%** (~~81.2%~~ REPINNED
                                 2026-08-13 ... the origin row is
                                 data/sources.tsv:58)". Line unmoved.
      data/sources.tsv:58        CLOSED -- the origin, quoted above.

  ALREADY DATED WHERE THEY STAND, so they are quotations and not claims.
  RE-READ 2026-08-13 and both still hold:
      quality/NULL_AUDIT.md:462, :487, :517 -- §2.2 carries the 2026-08-13
                                 repin in a block quote directly under its own
                                 heading, so its 81.2% mentions read as the
                                 superseded figure they are. Lines unmoved.
      quality/kalevala_rate.py:6, :85 -- both say "data/sources.tsv records",
                                 so they quote row :58 and move when it moves.
                                 THE ROW HAS NOW MOVED AND THEY HAVE NOT: both
                                 still say the row records 81.2%, which it no
                                 longer does. The construction that was meant
                                 to keep them current is what let them go
                                 stale -- "X records Y" is only self-updating
                                 if somebody re-reads X. Not this file's to
                                 fix; recorded here for the cell that holds it.

  It was recorded as a bare rate with no comparator of any kind.

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

  ALSO REPORTED, AND SINCE 2026-08-13 ACTUALLY COMPUTED: the ANALYTIC chance
  rate. P(some initial class repeats) in a line of m slots drawn i.i.d. from
  the corpus's own initial-class distribution -- Null A's own generative story
  with replacement instead of a permutation, and with no Monte Carlo error at
  all. `PINNED_ANALYTIC` holds it for all five corpora.

  THIS PARAGRAPH WAS FALSE FROM THE DAY IT WAS WRITTEN UNTIL 2026-08-13, and
  the shape of the falsehood is doctrine 20/28's. `analytic()` existed, was
  called by nothing, and its accumulator loop was `tot += 0.0` under a comment
  calling the quantity intractable -- so it COMPUTED A ZERO while MEANING "not
  computed", returned `(unreadable, p)` rather than a rate, and dropped `tot`
  on the floor. Doctrine 48 in its purest form: a capability that lives only
  in prose gets used exactly as often as someone remembers it, and nobody ever
  did. The module claimed a report it never produced, in the paragraph a
  reader would trust most, for as long as the paragraph existed.

  THE INTRACTABILITY CLAIM IS THE THING THAT WAS WRONG, and it is named here
  because it is what stopped the work. P(all r draws distinct) is a sum over
  injections; for draws from DIFFERENT per-slot distributions that sum is a
  permanent and is genuinely #P-hard. Under the i.i.d. draws THIS PARAGRAPH
  ITSELF DECLARES, every slot carries the same distribution, the sum collapses
  to r! * e_r(p) -- the elementary symmetric polynomial -- and an
  O(classes * m) dynamic program gets every e_r once per corpus. Verified
  against brute-force enumeration of ordered tuples (agreement < 1e-12), the
  uniform-alphabet birthday closed form, and the pigeonhole case r > classes.
  Doctrine 44/92: this was never "hard to build" and never "cannot obtain".
  It was "nobody did it", behind a wrong reason.

  WHAT IT ADDS OVER THE PERMUTATION NULL, which is the only question that
  justifies carrying it at all. Null A already answers the poet's question
  empirically, so the analytic rate is not a second finding -- it is the
  DEMONSTRATION THAT THE INSTRUMENT COULD HAVE FOUND SOMETHING (doctrine 76),
  and this file needs one more than most: doctrine 63 is NAMED for a null on
  this exact corpus that ran, looked rigorous, and tested nothing. Every bound
  below rides `null_a`'s median, and a `null_a` that quietly stopped shuffling
  would raise every median toward the observation and LOWER every excess --
  which reads as a real collapse of the constraint, not as a broken tool. The
  analytic rate is computed without `null_a`, without `random`, and without a
  replicate, so the two agreeing is a fact about the MACHINERY and not about
  Finland. MEASURED: they agree to 1.93 pp at worst over five corpora x eight
  seeds, and the per-corpus SPREAD of that gap (0.311 / 0.470 / 3.052 / 0.561
  / 0.971) reproduces the recorded jitter of the excess itself to three
  decimals -- necessarily, because both quantities move only through the same
  median, which is the arithmetic proof that the analytic half contributes no
  noise of its own. An identity-map `null_a` would show 11.5 to 52.6.

DOCTRINE 89: THE EXCESS IS A SERIES, AND ONE POINT CANNOT CARRY IT

  "Report the excess as a SERIES, because a falling raw rate can hide a
  collapsing constraint." One corpus and one null give a LEVEL: 82.6% against
  ~30%. The doctrine's content is what happens to that gap across corpora, and
  a check that pins only the level is blind to exactly the failure the doctrine
  is named for -- the raw rate sliding gently while the constraint falls off a
  cliff underneath it, because the null rises with the line length.

  So the same statistic, the same Null A, and the same seed are run over the
  five points data/sources.tsv already records under
  NOTE:finnish-alliteration-across-four-centuries (measured 2026-08-10 by
  quality/kalevala_rate.py) -- and the arithmetic is the doctrine:

      corpus                            raw rate     excess over null median
      Kalevala 1849 (oral epic)           82.6%              +52.7
      Kanteletar 1840 (oral song)         81.8%              +50.8
      'uudempia' 1840 (Lonnrot's foil)    71.8%              +14.6
      literary Finnish 1840-1926          63.5%              +15.5
      Aleksis Kivi alone                  58.4%              +12.2

  The raw rates fall 82.6 -> 58.4, a spread of 24.2 points, and read as a
  gentle decline. The excesses fall 52.7 -> 12.2, a spread of 40.5 points, and
  read as a constraint that STOPS BEING A CONSTRAINT. The excess spread is 1.7x
  the raw spread, in the same direction, over the same texts: that ratio IS
  doctrine 89, and `--check` now fails if it stops holding.

  WHY THE UUDEMPIA SIT WITH THE LITERARY ARM AND NOT WITH THE FOLK BOOKS they
  were printed inside: Lonnrot says so himself, in the 1840 preface, about his
  own newer songs -- "sanojen yksialanta (allitteratio) on sattumoissa", the
  word-alliteration is by accident (doctrine 62). He is right in direction and
  wrong in degree; +14.6 is 3.5x weaker than the books beside them, not zero.

  WHAT IS PINNED AND WHAT IS DELIBERATELY NOT: see `PINNED_SERIES` and the
  comment above it. The short version is that the COUNTS are exact and the
  EXCESSES are bounded, never pinned to a decimal, because `--check` caps the
  replicates and an exact pin on a capped draw witnesses the replicate count
  rather than the effect (doctrine 57). The line between the two is NOT
  count-versus-rate, and 2026-08-13 is when that became visible: the ANALYTIC
  chance rate is a rate and is pinned EXACTLY (`PINNED_ANALYTIC`), because it
  carries no draw. The question is only ever whether a figure rides the Monte
  Carlo, and the file now holds one of each kind on the same corpus.

  WHAT THE SERIES COSTS, MEASURED rather than estimated, 1 core, 2026-08-13:
      `--check`  BEFORE  2.03 s wall / 2.02 s CPU
      `--check`  AFTER   4.02 s wall / 4.02 s CPU   (+1.99 s, x1.98)
      n=200 (a human run, both arms)  76.5 s wall / 76.1 s CPU
  So the CI step's own comment ("~5 s") is now nearer 4 s than 5 s on this
  box and the widening roughly DOUBLES it in ratio while adding two seconds
  in absolute -- against a job whose other steps run 4 s, 25 s, ~1 min, 64 s
  and ~3 min. It is paid in one step and not split, because the four extra
  corpora share nothing with the Kalevala arm and a split would run the
  Kalevala's ingestion twice to save one second. THE COST IS ALL IN NULL A:
  the observed counts are ~1.0 s of tokenizing and the five-replicate draws
  are ~0.9 s, which is why Null B is not run over the series.

  AND THE ANALYTIC RATE ADDED ESSENTIALLY NOTHING TO THAT, MEASURED the same
  way on 2026-08-13 when it was finally implemented:
      `--check`  BEFORE  4.12 / 4.12 / 4.23 s CPU over three runs
      `--check`  AFTER   4.18 / 4.13 / 4.11 s CPU over three runs
  i.e. the delta is INSIDE the run-to-run spread of the measurement, and the
  six `analytic()` calls time at 0.076 s in total (~1.8% of the step). Wall
  clock is not quoted for this comparison because the box was loaded when it
  was taken -- 11 s wall against 4.1 s CPU -- which is exactly the condition
  under which a wall-clock number would say something untrue about the code.
  The reason it is this cheap is that the closed form is evaluated ONCE PER
  DISTINCT LINE LENGTH and the symmetric polynomials ONCE PER CORPUS, so it
  is O(classes * m + lines) against Null A's O(replicates * tokens).

  AND THE BOUNDS WERE CHECKED AT THE FULL n BEFORE BEING WRITTEN. At n=200
  the series reads +52.6 / +50.8 / +15.8 / +15.2 / +11.6, which reproduces
  data/sources.tsv's 2026-08-10 census (+52.5 / +50.8 / +15.7 / +15.0 /
  +11.6) to a tenth of a point on four of five points and exactly on Kivi --
  measured by a different instrument (quality/kalevala_rate.py, numpy fast
  path) over a different reader. Every one of them clears these bounds with
  at least 7 pp to spare.

Run: python3 quality/audit_kalevala_null.py corpus/fin_kalevala.txt [n]
     (or on the raw Gutenberg file, which this also accepts:
      curl -sS -o kal7000.txt \
        https://raw.githubusercontent.com/GITenberg/Kalevala_7000/master/7000-8.txt
      -- 636,150 bytes, md5 87449afc4728aa740409c5c405e21a15, DECODE AS LATIN-1)
     The four SERIES corpora are read from corpus/song/ and are not arguments;
     they are declared in `SERIES` below, one file list per point.
"""

import os
import random
import re
import sys
from collections import Counter, defaultdict
from math import comb

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality.phonology import get                       # noqa: E402
from quality.phonology.fin import _tokens               # noqa: E402
from quality.readability import read_lines              # noqa: E402

SEED = 20260810
FIRST_N = 4000          # the window data/sources.tsv actually measured

#: WHAT THE RECORD SAYS, as against `PINNED["extracted"]`, which is what THIS
#: FILE MEASURES. Deliberately a second constant and not a reuse: they are two
#: different facts that happen to coincide today, and on 2026-08-10..13 they
#: did not (the row said 22,822 against this file's 22,795). Collapsing them
#: would make the disagreement this instrument exists to print unprintable.
#:
#: REPINNED 2026-08-13 from 22,822, kept visible and dated (doctrine 17): the
#: origin row `data/sources.tsv:58` was itself repinned to 22,795 by the cell
#: that owns it, closing a drift this file had been PRINTING and exiting 0 on
#: since it was written. This literal was `22,822` inside an f-string until
#: that moment, which is why the print went stale silently -- doctrine 48, in
#: the file that already had a header paragraph about the same line going
#: stale. A number quoted from another file is now named, dated and compared
#: mechanically rather than typed into a format string.
SOURCES_TSV_EXTRACTED = 22795

ORAL, LITERARY = "oral", "literary"

#: The seven author files data/sources.tsv's own
#: NOTE:finnish-alliteration-across-four-centuries pooled, NAMED rather than
#: globbed: `corpus/song/fin_*.txt` would silently admit
#: fin_kasimir_leino.txt (staged minutes after that measurement was taken) and
#: fin_wahanen_laulukirja.txt (a songbook, staged the following day), and the
#: pool would then move whenever somebody stages another Finnish file. A
#: corpus is a declaration, not a glob (doctrine 1).
LITERARY_SEVEN = ("fin_aleksis_kivi", "fin_eino_leino", "fin_jaakko_juteini",
                  "fin_jh_erkko", "fin_julius_krohn", "fin_kaarlo_kramsu",
                  "fin_paavo_cajander")

#: DOCTRINE 89's SERIES: (key, printed name, arm, corpus files).
#: The Kalevala's own point is NOT here -- it is the `all verse lines` block
#: `main` already computes, reused rather than redrawn, so the series and the
#: report above it cannot disagree about the same corpus.
SERIES = (
    ("kanteletar", "Kanteletar 1840, books I-III (the sung half)", ORAL,
     ("corpus/song/fin_kanteletar.txt",)),
    ("uudempia", "Kanteletar 1840 'uudempia' (the editor's own foil)",
     LITERARY, ("corpus/song/fin_kanteletar_uudempia.txt",)),
    ("literary7", "literary Finnish 1840-1926, seven authors pooled",
     LITERARY, tuple("corpus/song/%s.txt" % n for n in LITERARY_SEVEN)),
    #: NOT an independent point -- Kivi is INSIDE literary7 above. It is
    #: carried because the record carries it, and because a single author is
    #: the sharpest end of the series; it is never the value that drives
    #: MAX_EXCESS_LITERARY, which is the pool's.
    ("kivi", "Aleksis Kivi alone (a member of the pool above)", LITERARY,
     ("corpus/song/fin_aleksis_kivi.txt",)),
)


def verse_lines(path):
    """The extraction data/sources.tsv describes: between the first verse line
    and the PG end marker, non-empty, headings dropped.

    THREE LINE COUNTS ARE ON THE RECORD FOR THIS CORPUS AND THEY HAVE TWO
    DIFFERENT CAUSES, measured 2026-08-13 rather than guessed:

      22,795  what this returns, and what `data/sources.tsv:58` and `:83` now
              both record.
      22,822  the 2026-08-10 figure, superseded. The +27 is the RAW Gutenberg
              file's runo headings counted as verse -- `sources.tsv:83` says
              so, and it is not reproducible here because the staged
              `corpus/fin_kalevala.txt` had them dropped at staging time.
      22,796  `quality/NULL_AUDIT.md:686` carries this and calls it "a filter
              difference, almost certainly runo headings". IT IS NOT. On the
              staged file NO heading filter in this function fires at all --
              zero numeral-only lines, zero runo headings -- and every variant
              (no filters, numerals only, runo only, <=2 or <=4 words, an
              indentation rule, "contains no letter") returns 22,795
              identically. 22,796 is the TRAILING NEWLINE: the file ends with
              one, so `read().split("\\n")` yields 22,796 elements of which the
              last is "". `splitlines()`, `list(open(...))` and this function
              all give 22,795. An off-by-one in the reader, not a filter, and
              so it says nothing about headings. Not this file's row to fix.
    """
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
    """-> P(this corpus's average line alliterates) under i.i.d. draws.

    NULL A'S OWN STORY WITH REPLACEMENT, and that is the whole point of it:
    `null_a` deals the corpus's pool of initial classes into the observed line
    lengths by permutation, so a line of m slots receives m draws WITHOUT
    replacement; this computes the same quantity for m draws WITH replacement,
    exactly, from the same pool. For a pool of this size the two models differ
    by O(m^2 / pool) -- ~3e-4 here -- so a disagreement between them is a
    disagreement about the machinery, not about the model. Nothing in this
    function calls `random`, draws a replicate, or reads a seed.

    THE ARITHMETIC. Each slot draws a class, or None (an unreadable word) with
    probability q; `alliterates` reads only the readable draws, so condition on
    how many there are:

        P(alliterates | m slots) = SUM_r C(m,r) (1-q)^r q^(m-r) (1 - D_r)

    where r is the readable count and D_r = P(r i.i.d. draws from the readable
    class distribution `p` are ALL DISTINCT). D_r is a sum over injections,
    which is a permanent -- and a permanent whose rows are all identical,
    because the draws are i.i.d., so it collapses to

        D_r = r! * e_r(p),      e_r = the elementary symmetric polynomial

    built by the standard O(classes * m) dynamic program below, ONCE for the
    corpus rather than once per line. r=0 and r=1 give D_r = 1 and contribute
    nothing, which is `alliterates`'s own "fewer than two readable words is
    not alliteration". r above the class count gives e_r = 0 and D_r = 0: with
    more draws than classes a repeat is certain, which is the pigeonhole rule
    and falls out of the polynomial rather than being special-cased.

    See the module docstring for why this returned a hard-coded 0.0 under an
    "intractable in general" comment until 2026-08-13.
    """
    pool = [h for hs in rows for h in hs]
    readable = [h for h in pool if h is not None]
    q = 1 - len(readable) / max(1, len(pool))
    n = max(1, len(readable))
    p = [v / n for v in Counter(readable).values()]

    #: e_0..e_rmax. Past `len(p)` every e_r is 0 by pigeonhole, so the table
    #: stops there and `dist` below reads 0.0 beyond it rather than growing a
    #: tail of zeros the loop would still have to walk.
    rmax = min(max((len(hs) for hs in rows), default=0), len(p))
    e = [0.0] * (rmax + 1)
    e[0] = 1.0
    for x in p:
        for r in range(rmax, 0, -1):
            e[r] += x * e[r - 1]
    dist, f = [1.0] * (rmax + 1), 1.0
    for r in range(1, rmax + 1):
        f *= r
        dist[r] = f * e[r]        # bounded by 1: e_r <= (SUM p)^r / r! = 1/r!

    #: Keyed on the LINE LENGTH, which is the only thing the per-line term
    #: depends on -- a corpus of 22,795 lines has ~10 distinct lengths.
    per_m, tot = {}, 0.0
    for hs in rows:
        m = len(hs)
        if m not in per_m:
            per_m[m] = sum(comb(m, r) * (1 - q) ** r * q ** (m - r)
                           * (1 - (dist[r] if r <= rmax else 0.0))
                           for r in range(2, m + 1))
        tot += per_m[m]
    return tot / max(1, len(rows))


def report(name, obs, nulls, n, ana=None):
    """`ana` is the ANALYTIC chance rate, and it is passed to the Null A call
    only. Null B preserves each slot's POSITION, so i.i.d. draws are not its
    generative story and the gap below would not be a check on anything."""
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
    out = {"median": mid, "max": hi, "excess": 100 * (obs - mid),
           "excess_over_max": 100 * (obs - hi), "p": p}
    if ana is not None:
        print(f"    ANALYTIC chance rate    {ana:.4%}  "
              f"(i.i.d., exact, no replicates)")
        print(f"    null median - analytic  {100 * (mid - ana):+.3f} pp  "
              f"-> the redeal agrees with the closed form; doctrine 76")
        out["analytic"] = ana
        out["gap"] = 100 * (mid - ana)
    print()
    return out


def series_rows(fi, rels, cache):
    """Heads for one series point, over `quality/readability.py`'s `read_lines`
    -- the one apparatus filter this repo has (CLAUDE.md's own centralization
    note), not a fourth spelling of `#`/`---`/`[`. Cached per FILE because
    `literary7` and `kivi` share fin_aleksis_kivi.txt and tokenizing it twice
    would be paid for on every CI run.
    """
    rows = []
    for rel in rels:
        p = os.path.join(HERE, "..", rel)
        if rel not in cache:
            cache[rel] = [r for r in (heads(fi, ln) for ln in read_lines(p))
                          if r]
        rows += cache[rel]
    return rows


def series(fi, n, kalevala):
    """Doctrine 89's series. -> {key: {...}}, `kalevala` already measured.

    EACH POINT GETS ITS OWN random.Random(SEED), deliberately: a shared stream
    would make every corpus's null a function of how many replicates the
    corpora before it happened to draw, so adding or reordering a point would
    silently move its neighbours' numbers. Only NULL A is drawn here -- Null B
    is the robustness null for the Kalevala reading and adds no series
    information, and it would double the cost of the CI step.
    """
    #: A DECLARED CORPUS THAT IS NOT ON DISK IS A REFUSAL, NOT A FAILURE, and
    #: the two must not collapse into one exit code (doctrine 20/79). Checked
    #: up front so a half-drawn series never reaches `check`, where a missing
    #: point would read as a moved figure and send somebody to repin fin.py.
    gone = [rel for _, _, _, rels in SERIES for rel in rels
            if not os.path.exists(os.path.join(HERE, "..", rel))]
    if gone:
        print("\nREFUSED -- the series is declared over corpora that are not "
              "on disk:")
        for rel in gone:
            print(f"    {rel}")
        print("  This is a refusal, not a drift: nothing was measured, so "
              "nothing moved.")
        sys.exit(2)

    out = {"kalevala": dict(kalevala, arm=ORAL,
                            name="Kalevala 1849 (the block above, reused)")}
    cache = {}
    for key, name, arm, rels in SERIES:
        rows = series_rows(fi, rels, cache)
        obs, hit = rate(rows)
        print(f"\n=== {name}: {len(rows)} lines, {hit} alliterating, "
              f"mean {sum(len(r) for r in rows) / len(rows):.2f} words/line")
        rng = random.Random(SEED)
        r = report("NULL A  global redeal (same tokens, same line lengths)",
                   obs, [rate(null_a(rows, rng))[0] for _ in range(n)], n,
                   ana=analytic(rows))
        out[key] = dict(r, lines=len(rows), alliterating=hit, rate=obs,
                        arm=arm, name=name)
    return out


def main(path, n=200):
    fi = get("fin")
    lines = verse_lines(path)
    print(f"{path}")
    agree = "agrees" if len(lines) == SOURCES_TSV_EXTRACTED else "DISAGREES"
    print(f"verse lines extracted: {len(lines)}"
          f"   (data/sources.tsv:58 records {SOURCES_TSV_EXTRACTED:,}"
          f" -- {agree})")
    rng = random.Random(SEED)
    measured = {"extracted": len(lines)}

    for label, sub in (("first 4000 lines (the recorded window)",
                        lines[:FIRST_N]),
                       ("all verse lines", lines)):
        rows = [heads(fi, ln) for ln in sub]
        rows = [r for r in rows if r]
        obs, hit = rate(rows)
        wl = sum(len(r) for r in rows) / len(rows)
        classes = Counter(h for r in rows for h in r if h is not None)
        measured[label] = {"lines": len(rows), "alliterating": hit}
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
        ra = report("NULL A  global redeal (same tokens, same line lengths)",
                    obs, a, n, ana=analytic(rows))
        b = [rate(null_b(rows, rng))[0] for _ in range(n)]
        report("NULL B  column permutation within line-length strata",
               obs, b, n)
        measured[label] = dict(ra, lines=len(rows), alliterating=hit, rate=obs)

    print("=" * 74)
    print("DOCTRINE 89 -- the same statistic and the same Null A, as a SERIES")
    print("=" * 74)
    measured["series"] = series(fi, n, measured["all verse lines"])
    return measured


#: THE DETERMINISTIC COUNTS, which is what makes this one pinnable at all.
#: Unlike `audit_time_pooled_null.py` -- where every figure is a Monte Carlo
#: estimate and only a DIRECTION can be checked -- the alliteration counts here
#: are exact over a fixed window. The null medians are samples and are STILL
#: not pinned -- but as of 2026-08-13 the SEPARATION is no longer left to the
#: printed p alone either: it is bounded, not pinned, by the four constants
#: below `PINNED_SERIES`. This sentence used to end "and is left to the printed
#: p", which was true when one point was checked and became a half-truth the
#: moment the series joined.
#:
#: MEASURED 2026-08-13, and two of the three had drifted from the record:
#:   verse lines extracted   22,822 recorded  ->  22,795   (the script already
#:                           printed this disagreement and exited 0 anyway)
#:   first-4000 alliterating  3,246 recorded  ->   3,253   (81.2% -> 81.3%)
#: Doctrine 58: argue these and repin. Do not adjust `verse_lines` to hit them.
#:
#: AND THE RECORD HAS SINCE CAUGHT UP, LATER THE SAME DAY: `data/sources.tsv:58`
#: was repinned to 22,795 and 3,253 (81.3%) by the cell that owns it, with
#: 22,822 and 3,246 (81.2%) kept visible and dated beside them. So both figures
#: above are now AGREEMENTS rather than drifts, and the arrow reads left-to-
#: right as history, not as a live disagreement. Nothing here moved to make
#: that true -- the measurement is the same measurement; the record moved to
#: it, which is the direction doctrine 58 asks for.
PINNED = {"extracted": 22795,
          "first 4000 lines (the recorded window)": {"lines": 4000,
                                                     "alliterating": 3253},
          "all verse lines": {"lines": 22795, "alliterating": 18828}}

#: DOCTRINE 89's SERIES, MEASURED 2026-08-13. Same shape and same argument as
#: `PINNED` above: these are EXACT counts over fixed files, with no Monte Carlo
#: in them at all. `kalevala` is absent on purpose -- its counts are
#: PINNED["all verse lines"] and pinning them twice is two numbers for one
#: fact, which is the drift this whole file exists to catch.
PINNED_SERIES = {"kanteletar": {"lines": 22110, "alliterating": 18094},
                 "uudempia": {"lines": 852, "alliterating": 612},
                 "literary7": {"lines": 15331, "alliterating": 9734},
                 "kivi": {"lines": 2884, "alliterating": 1684}}

#: THE ANALYTIC CHANCE RATE, MEASURED 2026-08-13 -- the first run of a report
#: this module's docstring had promised since the docstring was written. A
#: PERCENTAGE, and pinned in the EXACT half of `--check` beside the counts
#: rather than bounded in the Monte Carlo half beside the excesses, because it
#: is not a draw: `analytic()` reads the corpus's class distribution and line
#: lengths and evaluates a polynomial. Same file, same value, every run, in
#: every process -- verified bit-identical across processes before pinning.
#:
#: THIS IS NOT REDUNDANT WITH THE COUNTS ABOVE, and the reason is the sentence
#: three blocks down that declines to pin the RAW rate: a raw rate is
#: `alliterating / lines`, both already pinned, so it "cannot drift
#: independently of them (doctrine 91)". The analytic rate can. It is a
#: function of the corpus's INITIAL-CLASS INVENTORY and its LINE-LENGTH
#: PROFILE, and nothing else in this file pins either -- `quality/phonology/
#: fin.py` could merge two classes, or `read_lines` could start admitting a
#: prose file's long lines, and both would move this number while
#: `alliterating` and `lines` sat still or moved for unrelated reasons.
#:
#: `kalevala` is absent for the reason `PINNED_SERIES` gives: the series
#: reuses `all verse lines` and one fact gets one number.
PINNED_ANALYTIC = {"first 4000 lines (the recorded window)": 30.0772,
                   "all verse lines": 30.0108,
                   "kanteletar": 31.0587,
                   "uudempia": 56.1596,
                   "literary7": 48.2890,
                   "kivi": 46.8582}

#: The pin above is to four decimal places of a percentage, so this tolerance
#: is a FLOAT-COMPARISON slack and NOT headroom in the doctrine-57 sense --
#: there is no sampling error here to leave room for. Sensitivity, so the
#: number is chosen rather than assumed: dropping ONE line from the 22,795
#: moves the mean by ~0.002 pp, i.e. twice this tolerance, so a pin this tight
#: still catches a one-line ingestion change. Contrast the 1.93 pp of jitter
#: `MAX_NULL_ANALYTIC_GAP` below has to absorb: three orders of magnitude, and
#: that difference IS the difference between the two halves of `--check`.
ANALYTIC_TOL_PP = 0.001

#: WHAT IS DELIBERATELY *NOT* PINNED, and why the four constants below are
#: INEQUALITIES rather than the five numbers a reader would expect.
#:
#: The excess is `observed - null median`, and the null median is a MONTE CARLO
#: DRAW. `--check` caps the replicates at 5 because the draw costs the whole
#: runtime -- so an exact pin on any of these five excesses would be a pin on
#: the median of five samples, i.e. a witness to the replicate count and the
#: seed rather than to the effect. That is doctrine 57 in the file that already
#: prints "p is AT the floor: it reports the resolution, not the size."
#: `audit_time_pooled_null.py` next door reached the same conclusion about
#: every figure it prints and checks a DIRECTION; `audit_tang_null.py` pinned
#: the deterministic coverage counts and left the permutation p alone. This
#: file does both, because it has both kinds of quantity.
#:
#: MEASURED JITTER, so the headroom is a number and not a feeling. Each point
#: re-drawn at n=5 under eight seeds (20260810, 1, 2, 3, 12345, 999, 77, 4242):
#:   Kalevala  +52.44..+52.75 spread 0.31   Kanteletar +50.54..+51.01  0.47
#:   uudempia  +14.55..+17.61 spread 3.05   literary7  +14.99..+15.55  0.56
#:   Kivi      +11.27..+12.24 spread 0.97
#: The uudempia are the loose one at 852 lines, and they are the point the
#: literary CEILING has to clear -- hence 25.0 and not 20.0.
#:
#: NOR IS THE RAW RATE PINNED as a percentage: `lines` and `alliterating` above
#: are its numerator and denominator, exactly, and a rate derived from two
#: pinned integers cannot drift independently of them (doctrine 91).

#: The oral arm (Kalevala, Kanteletar) must stay far above its own chance rate.
#: Measured +52.7 and +50.8; floor is 5.5 pp under the smaller, ~12x its
#: jitter. A break here means the constraint stopped being detectable in
#: kalevalaic metre, which would be a finding about fin.py, not about Finland.
MIN_EXCESS_ORAL = 45.0

#: The literary arm (uudempia, literary7, Kivi) must stay far BELOW it.
#: Measured +14.6, +15.5, +12.2 at this seed and never above +17.61 in the
#: eight-seed sweep. A break here means the collapse stopped reproducing.
MAX_EXCESS_LITERARY = 25.0

#: THE COLLAPSE ITSELF, which is the figure the level alone cannot see:
#: min(oral excess) - max(literary excess). Measured 50.8 - 15.5 = +35.3, and
#: +32.9 at the worst seed in the sweep. Not implied by the two bounds above --
#: they permit a gap of 20.0 and this requires 25.0.
MIN_COLLAPSE_GAP = 25.0

#: DOCTRINE 89'S OWN SENTENCE, made arithmetic: "a falling raw rate can HIDE a
#: collapsing constraint". Across the five points the raw rate falls 82.6 ->
#: 58.4 (spread 24.2) and the excess falls 52.7 -> 12.2 (spread 40.5), so the
#: excess spread is 1.67x the raw spread. If that ratio ever drops to 1.0 the
#: two readings agree and the doctrine has nothing left to say on this corpus;
#: the floor is 1.30, and the worst seed in the sweep gives 1.44.
#: This is the ONE pin that a check on the level could never have carried.
MIN_EXCESS_DROP_RATIO = 1.30

#: DOCTRINE 76, AND IT IS THE ONLY CONSTANT HERE THAT CHECKS THE INSTRUMENT
#: RATHER THAN FINLAND. The four bounds above all ride `null_a`'s median, so
#: none of them can see a `null_a` that has quietly stopped destroying
#: co-membership: a degraded redeal raises every median toward the observation
#: and LOWERS every excess, which arrives at `check_series` looking exactly
#: like a real collapse of the constraint. Doctrine 63 is NAMED for a null on
#: this corpus that ran, looked rigorous and tested nothing, and the within-
#: line no-op `main` prints is only the demonstration for the null NOT used.
#: This is the demonstration for the null that IS: `analytic()` computes the
#: same chance rate with no `random`, no replicate and no seed, so the two
#: agreeing is a fact about the machinery.
#:
#: MEASURED JITTER, five points x eight seeds (20260810, 1, 2, 3, 12345, 999,
#: 77, 4242), as |null median - analytic| in pp:
#:   Kalevala  spread 0.311   Kanteletar 0.470   uudempia 3.052
#:   literary7 spread 0.561   Kivi       0.971   worst single value 1.934
#: Those five spreads reproduce the recorded jitter of the EXCESS above to
#: three decimals, necessarily: excess is `obs - median` and this gap is
#: `median - analytic`, both vary only through the median, and `obs` and the
#: analytic rate are each exact. That identity is the check that the closed
#: form adds no noise of its own -- if it drifted, the two spreads would part.
#:
#: 4.0 is 2.07x the worst measured value and 0.35x the SMALLEST break it has
#: to catch: an identity-map `null_a` shows a gap of 11.5 pp on Kivi, the
#: weakest of the five, and 52.6 pp on the Kalevala. Wide of the noise, well
#: inside the failure.
#:
#: AND IT CATCHES A BREAK THE FOUR BOUNDS ABOVE DO NOT, which is the claim
#: that had to be MEASURED rather than asserted -- a FULL identity map also
#: trips MIN_EXCESS_ORAL, so on its own it would prove nothing about this row
#: earning its place. Degrade the redeal partially instead: shuffle only a
#: fraction f of the pool and leave the rest where it lay.
#:      f      kalev  kante  uude   lit7   kivi   worst|gap|  4 bounds  d76
#:      1.00   +52.5  +50.7  +16.3  +15.2  +11.7      0.64      pass    pass
#:      0.90   +51.9  +50.2  +15.1  +15.1  +11.1      0.71      pass    pass
#:      0.70   +47.6  +45.8  +14.8  +13.6  +10.5      5.03      pass    FAIL
#:      0.50   +39.0  +37.6  +10.7  +11.6   +8.8     13.54      FAIL    FAIL
#:      0.00     0.0    0.0    0.0    0.0    0.0     52.59      FAIL    FAIL
#: At f=0.70 a null that has stopped destroying a THIRD of the co-membership
#: it claims to destroy sails through every excess bound -- the Kalevala still
#: reads +47.6 against a floor of 45.0 -- and this row is the only thing in
#: the file that says so. Confirmed end to end as mutation M3 below.
MAX_NULL_ANALYTIC_GAP = 4.0

#: THE PINS WERE PROVEN ABLE TO FAIL, 2026-08-13, because a pin that has never
#: gone red is a check nobody has seen work (doctrine 48). Four mutations, each
#: applied to this file, run, and reverted from a byte-for-byte snapshot whose
#: sha256 was compared after every restore. Baseline exit 0, 0 FAIL rows.
#:   M1  PINNED_ANALYTIC["kanteletar"] 31.0587 -> 31.0687, a 0.01 pp move
#:       = 10x ANALYTIC_TOL_PP        -> exit 1, 1 FAIL  (that row alone)
#:   M2  `analytic()` drops the unreadable-slot term, q forced to 0
#:                                    -> exit 1, 3 FAIL  (kanteletar 31.0704,
#:       uudempia 56.1965, literary7 48.4361 -- and NOT the Kalevala or Kivi,
#:       whose q is 0.0000, so the mutation is invisible exactly where the
#:       corpus has nothing for it to break. The pin is on the FORMULA.)
#:   M3  `null_a` degraded to the f=0.70 partial redeal tabulated above
#:                                    -> exit 1, 2 FAIL, AND BOTH ARE
#:       null-vs-analytic rows (kalevala +4.91, kanteletar +4.96). Every count
#:       pin, every excess bound, the collapse gap and the doctrine-89 ratio
#:       all still PASS. This is the whole argument for the row in one run.
#:   M4  `report(... ana=None)` -- the dead state this file shipped in until
#:       today                        -> exit 1, 3 FAIL, all of them reading
#:       NOT COMPUTED rather than a moved number. Doctrine 20/28: the check
#:       tells "nobody called it" apart from "it was called and it agreed",
#:       so the defect cannot reopen quietly the way it opened.
#: All four reverts returned exit 0 and the snapshot's sha.

DEFAULT_CORPUS = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                              "..", "corpus", "fin_kalevala.txt")


def _row(ok, text):
    print(f"  [{'ok  ' if ok else 'FAIL'}] {text}")
    return 0 if ok else 1


def check_counts(m):
    """-> number of figures that moved. The EXACT half: every quantity here is
    deterministic over a fixed file. The counts are pinned to the INTEGER; the
    analytic chance rate is a real number and is pinned to `ANALYTIC_TOL_PP`,
    which is float slack and not headroom -- see that constant."""
    print("=" * 74)
    print("CHECK 1 -- the committed alliteration counts against this run")
    print("=" * 74)
    bad = _row(m.get("extracted") == PINNED["extracted"],
               f"verse lines extracted   committed {PINNED['extracted']}"
               + ("" if m.get("extracted") == PINNED["extracted"]
                  else f", measured {m.get('extracted')}"))
    for label in ("first 4000 lines (the recorded window)", "all verse lines"):
        want, got = PINNED[label], m.get(label, {})
        for k in ("lines", "alliterating"):
            ok = got.get(k) == want[k]
            bad += _row(ok, f"{label[:28]:28s} {k:13s} committed {want[k]}"
                        + ("" if ok else f", measured {got.get(k)}"))
    ser = m.get("series", {})
    for key in ("kanteletar", "uudempia", "literary7", "kivi"):
        want, got = PINNED_SERIES[key], ser.get(key, {})
        for k in ("lines", "alliterating"):
            ok = got.get(k) == want[k]
            bad += _row(ok, f"{key:28s} {k:13s} committed {want[k]}"
                        + ("" if ok else f", measured {got.get(k)}"))

    #: The analytic chance rate, read out of whichever block computed it --
    #: the two Kalevala windows off `m` directly and the four series points
    #: off `m["series"]`. A MISSING one is a FAIL and not a skip: `analytic`
    #: is absent from the dict exactly when nothing called it, which is the
    #: state this whole check exists to make impossible to reach again.
    for key in PINNED_ANALYTIC:
        got = (m.get(key) or ser.get(key) or {}).get("analytic")
        want = PINNED_ANALYTIC[key]
        ok = got is not None and abs(100 * got - want) <= ANALYTIC_TOL_PP
        bad += _row(ok, f"{key[:28]:28s} {'analytic':13s} committed {want:.4f}%"
                    + ("" if ok else
                       "  NOT COMPUTED -- nothing called analytic()"
                       if got is None else f", measured {100 * got:.4f}%"))
    return bad


def check_series(m):
    """-> number of figures that moved. The BOUNDED half: every quantity here
    rides a capped Monte Carlo draw, so it is checked as a direction."""
    print()
    print("=" * 74)
    print("CHECK 2 -- doctrine 89: the excess SERIES, and the collapse")
    print("=" * 74)
    ser = m.get("series", {})
    oral = {k: v for k, v in ser.items() if v.get("arm") == ORAL}
    lit = {k: v for k, v in ser.items() if v.get("arm") == LITERARY}
    if not oral or not lit:
        print("  [FAIL] the series is missing an arm entirely; "
              "nothing to read")
        return 1
    bad = 0
    for key, v in ser.items():
        print(f"         {key:12s} {v['arm']:8s} rate {v['rate']:6.1%}  "
              f"null median {v['median']:6.1%}  excess {v['excess']:+6.2f} pp")
    print()
    for key, v in sorted(oral.items()):
        bad += _row(v["excess"] >= MIN_EXCESS_ORAL,
                    f"{key:12s} ORAL     excess {v['excess']:+6.2f} pp   "
                    f"floor {MIN_EXCESS_ORAL:+.2f}")
    for key, v in sorted(lit.items()):
        bad += _row(v["excess"] <= MAX_EXCESS_LITERARY,
                    f"{key:12s} LITERARY excess {v['excess']:+6.2f} pp   "
                    f"ceiling {MAX_EXCESS_LITERARY:+.2f}")

    lo_oral = min(v["excess"] for v in oral.values())
    hi_lit = max(v["excess"] for v in lit.values())
    bad += _row(lo_oral - hi_lit >= MIN_COLLAPSE_GAP,
                f"{'collapse':12s} gap      {lo_oral - hi_lit:+6.2f} pp   "
                f"floor {MIN_COLLAPSE_GAP:+.2f}   "
                f"(weakest oral {lo_oral:+.2f} - strongest literary "
                f"{hi_lit:+.2f})")

    ex = [v["excess"] for v in ser.values()]
    rt = [100 * v["rate"] for v in ser.values()]
    d_ex, d_rt = max(ex) - min(ex), max(rt) - min(rt)
    ratio = d_ex / d_rt if d_rt > 0 else float("inf")
    bad += _row(ratio >= MIN_EXCESS_DROP_RATIO,
                f"{'doctrine 89':12s} ratio    {ratio:6.2f}x     "
                f"floor {MIN_EXCESS_DROP_RATIO:.2f}x   "
                f"(excess spread {d_ex:.2f} pp / rate spread {d_rt:.2f} pp)")

    #: DOCTRINE 76, and it is the last row on purpose: every row above it is a
    #: claim about Finnish that is only worth reading if this one holds. Five
    #: independent redeals against five closed forms -- a break in `null_a`
    #: shows up in all five at once, which no single-corpus check could say.
    print()
    for key, v in sorted(ser.items()):
        if "gap" not in v:
            bad += _row(False, f"{key:12s} analytic NOT COMPUTED -- the null "
                                "has no independent comparator this run")
            continue
        bad += _row(abs(v["gap"]) <= MAX_NULL_ANALYTIC_GAP,
                    f"{key:12s} null-vs-analytic {v['gap']:+6.2f} pp   "
                    f"bound +/-{MAX_NULL_ANALYTIC_GAP:.2f}   "
                    f"(median {100 * v['median']:.2f}% vs closed form "
                    f"{100 * v['analytic']:.2f}%)")
    return bad


def check(m):
    """-> exit code. FAILS LOUDLY; it does not report and continue."""
    print()
    bad = check_counts(m)
    bad += check_series(m)
    if bad:
        print()
        print(f"  {bad} figure(s) moved. An EXACT one means the ingestion or "
              f"quality/phonology/fin.py")
        print("  has changed under this arm. A BOUNDED one means the series "
              "itself moved --")
        print("  re-run at the full n before repinning, because these ride a "
              "5-replicate draw,")
        print("  and do NOT widen a bound to make a real collapse fit inside "
              "it.")
        print("  A NULL-VS-ANALYTIC one is neither, and it is read FIRST: it "
              "says the redeal")
        print("  and the closed form disagree, so the instrument is what "
              "moved and every")
        print("  other row above it is unreadable until that is settled "
              "(doctrine 76).")
        print("  Repin with the date and keep the superseded value visible "
              "(doctrine 17).")
    print()
    print("RESULT:", "PASS" if not bad else "FAIL")
    return 0 if not bad else 1


if __name__ == "__main__":
    argv = [a for a in sys.argv[1:] if a != "--check"]
    if "--check" in sys.argv:
        # The null draw costs the runtime and `check` does not read it.
        sys.exit(check(main(argv[0] if argv else DEFAULT_CORPUS, 5)))
    if not argv:
        sys.exit(__doc__)
    main(argv[0], int(argv[1]) if len(argv) > 1 else 200)

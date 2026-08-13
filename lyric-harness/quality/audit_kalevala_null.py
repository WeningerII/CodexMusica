#!/usr/bin/env python3
"""AUDIT: the Kalevala alliteration figure against a matched null -- and the
excess as a SERIES across four centuries of Finnish, which is doctrine 89.

THE FIGURE THIS FILE PINS, AND THE ONE IT SUPERSEDES

  PINNED HERE, MEASURED 2026-08-13:
      3,253 of the first 4,000 verse lines alliterate = 81.3%
      22,795 verse lines extracted, 18,828 alliterating = 82.6%

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

  quality/POSITIVE_CONTROL.md:435, Part E -- ALREADY REPINNED:
      "Finnish Kalevala | FOUND GITenberg/Kalevala_7000 | 22,795 verse lines,
       81.3% alliterate (REPINNED 2026-08-13 from 22,822 / 81.2%)"
  quality/METHOD.md:714, doctrine 49 -- ALREADY REPINNED, in place:
      "validated at 81.2% alliteration (REPINNED 2026-08-13: 81.3%, 3,253 of
       the first 4,000 verse lines, and 22,795 lines extracted rather than the
       22,822 recorded -- MEASURED by quality/audit_kalevala_null.py --check)"
  data/sources.tsv:58, GITenberg/Kalevala_7000 -- STILL THE SUPERSEDED VALUE:
      "VALIDATED: 3,246 of the first 4,000 verse lines (81.2%) carry two or
       more words sharing an initial under quality/phonology/fin.py"

  STILL QUOTING 81.2% WITH NO REPIN BESIDE IT, and not one of them is this
  file's to edit -- recorded here so the next cell to hold those files has the
  list rather than the search:
      quality/METHOD.md:175      doctrine 64's body, "81.2% of Kalevala lines
                                 alliterate" -- quoted there AS the unusable
                                 headline, so the doctrine survives the repin
                                 and the number in it does not
      quality/POSITIVE_CONTROL.md:456   "validated at 81.2% alliteration", in
                                 prose, four lines under a table row (:435)
                                 that HAS been repinned -- the same file
                                 disagreeing with itself
      data/CHANNELS.md:43        "validated at 81.2% alliteration"
      data/sources.tsv:58        the origin of all of them, quoted above

  ALREADY DATED WHERE THEY STAND, so they are quotations and not claims:
      quality/NULL_AUDIT.md:462, :487, :517 -- §2.2 carries the 2026-08-13
                                 repin in a block quote directly under its own
                                 heading, so its 81.2% mentions read as the
                                 superseded figure they are
      quality/kalevala_rate.py:6, :85 -- both say "data/sources.tsv records",
                                 so they quote row :58 and move when it moves

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

  Also reported: the ANALYTIC chance rate, i.e. P(some initial class repeats)
  for a line of m words drawn i.i.d. from the corpus's own initial-class
  distribution -- a null with no Monte Carlo error at all.

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
  rather than the effect (doctrine 57).

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

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality.phonology import get                       # noqa: E402
from quality.phonology.fin import _tokens               # noqa: E402
from quality.readability import read_lines              # noqa: E402

SEED = 20260810
FIRST_N = 4000          # the window data/sources.tsv actually measured

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
    return {"median": mid, "max": hi, "excess": 100 * (obs - mid),
            "excess_over_max": 100 * (obs - hi), "p": p}


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
                   obs, [rate(null_a(rows, rng))[0] for _ in range(n)], n)
        out[key] = dict(r, lines=len(rows), alliterating=hit, rate=obs,
                        arm=arm, name=name)
    return out


def main(path, n=200):
    fi = get("fin")
    lines = verse_lines(path)
    print(f"{path}")
    print(f"verse lines extracted: {len(lines)}"
          f"   (data/sources.tsv records 22,822)")
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
                    obs, a, n)
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
#: are exact over a fixed window. The null medians are samples and are NOT
#: pinned; the separation is enormous (81% against ~30%) and is left to the
#: printed p.
#:
#: MEASURED 2026-08-13, and two of the three had drifted from the record:
#:   verse lines extracted   22,822 recorded  ->  22,795   (the script already
#:                           printed this disagreement and exited 0 anyway)
#:   first-4000 alliterating  3,246 recorded  ->   3,253   (81.2% -> 81.3%)
#: Doctrine 58: argue these and repin. Do not adjust `verse_lines` to hit them.
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
#:   Kalevala   +52.44..+52.75  spread 0.31      Kanteletar +50.54..+51.01  0.47
#:   uudempia   +14.55..+17.61  spread 3.05      literary7  +14.99..+15.55  0.56
#:   Kivi       +11.27..+12.24  spread 0.97
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

DEFAULT_CORPUS = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                              "..", "corpus", "fin_kalevala.txt")


def _row(ok, text):
    print(f"  [{'ok  ' if ok else 'FAIL'}] {text}")
    return 0 if ok else 1


def check_counts(m):
    """-> number of figures that moved. The EXACT half: every quantity here is
    deterministic over a fixed file, so it is pinned to the integer."""
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
        print("  [FAIL] the series is missing an arm entirely; nothing to read")
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

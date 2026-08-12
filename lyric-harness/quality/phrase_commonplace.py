#!/usr/bin/env python3
"""PHRASE COMMONPLACE — the phrase-level half of MISSING.md H-1, MEASURED,
and REFUSED as a rejection on the evidence it produced.

    python3 quality/phrase_commonplace.py --measure         # every table
    python3 quality/phrase_commonplace.py FILE              # score a lyric
    python3 quality/phrase_commonplace.py --self-test       # the fixtures

WHAT H-1 ASKED FOR, AND WHAT THIS ANSWERS.

`MISSING.md` H-1 lists ten unmeasured craft properties and the last is
"cliché at the PHRASE level rather than the rhyme-pair level". The harness's
only cliché check is `CLICHE_PAIRS` in `lyric_harness.py` — thirty RHYME
PAIRS, consumed by `quality/floor.py` — so a line can be a total cliché as a
phrase and the harness has nothing to say. That is verified here and it
reproduces: see `quality/RESULTS_PHRASE_CLICHE.md` §1.

This module builds the obvious instrument, measures it, and then DECLINES TO
SHIP IT AS A REJECTION. `check()` returns a REFUSAL by default and `main()`
exits 2, because a caller in a pipeline has to be able to tell a refusal from
a pass (doctrine 20). The instrument stays reachable and every number stays
re-derivable, because a doctrine whose demonstration has been optimised away
is a sentence nobody can check (doctrine 84).

THE STATISTIC, DECLARED (doctrine 1).

  population    corpus/song/eng_*.txt — 143 files, one per AUTHOR,
                991,751 tokens. PRE-1931 BY CONSTRUCTION: the provenance
                gate admits nothing newer.
  line count    TWO, because they are two statistics (doctrine 58).
                **152,313** is MISSING.md K-1's rule verbatim. **152,154**
                is the subset carrying at least one alphabetic token, and
                is what the index is built on; the 159-line difference is
                rows of `*  *  *  *` and bare years like `1845.` —
                editorial furniture, not sung lines. Quoting either as the
                other is the defect doctrine 58 exists to name.
  unit          a sung line. LENGTH-INDEPENDENT, so unlike five of the six
                existing floor checks it needs no length profile
                (doctrine 15) — this is the one axis on which it is better
                behaved than what ships.
  statistic     disp(L) = the largest number of DISTINCT AUTHORS OTHER THAN
                this line's own carrying any n-gram of L.
  leave-one-out MANDATORY, not hygiene. Scoring an author's line against an
                index containing that author makes every n-gram in it score
                at least 1, which is doctrine 13's Finnish case exactly — a
                feature that is a monotone function of its own label.
  why AUTHORS   not raw token count. `the hills and far away` is 30 tokens
                in TWO authors: it is a burden, repeated by a form that
                requires repeating it. Author-dispersion correctly declines
                to call that a commonplace and raw frequency would not
                (doctrine 8 at the author level).
  tokenisation  lowercase; U+2019 -> U+0027 (doctrine 26); a token is a
                maximal run of [a-z'] with a bare apostrophe dropped;
                hyphens BREAK. n-grams do not cross a line boundary.
                Stated because a bare n-of-N is a coordinate of a rule
                nobody wrote down (doctrine 58).

WHY IT IS REFUSED. Four measurements, in the order they were made.

  1. THE STATISTIC HAS NO OPERATING POINT. At n=3 it fires on 26.3% of
     ordinary held-out verse and 11.7% of its witnesses are ENTIRELY
     closed-class — `it was a`, `and all the`, `of all the`. At n=4 it
     fires on 1.01% and 86.4% of witnesses are at least HALF closed-class.
     There is no n at which it fires on craft rather than on grammar.

  2. WHAT IT FIRES ON IS GRAMMAR, SCRIPTURE AND PERIOD. All 72 distinct
     witnesses at n=4 are enumerated in the results file. They are the
     genitive frame (`the glory of the`, `the shade of the`, `the soul of
     the`), King James formulae (`let there be light`, `thy will be done`,
     `the lamb of god`) and archaisms (`ah woe is me`, `tis the voice of`).
     A writer told that `thy will be done` is over-familiar has been told
     that other people have read the Bible. Roughly 10 of the 72 are things
     a writer might reasonably reconsider.

  3. IT IS SILENT ON THE CASE THAT MOTIVATED H-1. `and every rope in
     Arkansas began to braid for him` scores ZERO at every n, because it is
     a cliché as a FIGURE and this is a statistic over STRINGS. A stock
     trope realised in fresh words has no string overlap with any earlier
     realisation of it. Doctrine 61 in its sharpest form: this rule fires
     often and it fires on the wrong thing.

  4. THE POPULATION IS THE WRONG ONE AND CANNOT BE THE RIGHT ONE. See
     `blocker()` below — this is doctrine 92 and it is the load-bearing
     result.

Period-reading (doctrine 11) was tested and is NOT the primary defect, which
was a surprise: the check's firing rate against author death year runs
spearman +0.07 to +0.10 across 1620-1929, against -0.367 for an archaic-2sg
positive control that proves the design can see a period effect at all
(doctrines 31, 76). The check is period-flat WITHIN the corpus's span. That
buys nothing, because the corpus's span is not the writer's — see `blocker()`.
"""

import argparse
import collections
import os
import random
import re
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

SONG = os.path.join(HERE, "..", "corpus", "song")

#: doctrine 66 — any tie-break or seed must be FIXED and stated.
SEED = 20260811

TOKEN = re.compile(r"[a-z']+")


# ---------------------------------------------------------------------------
# The declared blocker — doctrines 44 and 92
# ---------------------------------------------------------------------------

def blocker():
    """Which of the three blockers this is, and what would lift it.

    Doctrine 44 separates "hard to build" from "cannot obtain"; doctrine 92
    adds the third, where the admissible source and the complete source are
    DISJOINT sets. A gap entry has to say which, because "find a better
    source" is the answer to only one of them.
    """
    return {
        "which": "ADMISSIBLE-AND-COMPLETE-ARE-DISJOINT (doctrine 92)",
        "not_hard_to_build": (
            "The instrument is an afternoon. It is in this file, it runs, "
            "and every table in the results doc re-derives from it."),
        "not_unobtainable": (
            "The corpus is on disk — 143 authors, 152,313 sung lines. "
            "Nothing was blocked, refused or missing."),
        "the_disjunction": (
            "A cliche is a phrase OVER-FAMILIAR TO A LISTENER, which is a "
            "claim about a living population. corpus/song/ is pre-1931 BY "
            "CONSTRUCTION — the provenance gate admits nothing newer, and "
            "in 2026 a 95-year term puts the cutoff at 1931 exactly. So the "
            "corpus that is ADMISSIBLE and the population that CARRIES the "
            "property do not overlap at any point. This is not fixable by "
            "fetching more text: every additional admissible file is also "
            "pre-1931."),
        "the_three_classes": (
            "(i) common pre-1931 AND common now -> detected. "
            "(ii) common pre-1931, dead now -> FALSE POSITIVE; the witness "
            "list is full of these (`ah woe is me`, `tis the voice of`). "
            "(iii) rare pre-1931, cliche now -> INVISIBLE, and this is the "
            "entire modern cliche stock. Class (iii) is unmeasurable with "
            "this corpus and its size is unknown, because measuring it "
            "requires the population the gate forbids."),
        "what_would_lift_it": [
            "A post-1931 English song-lyric population, which the provenance "
            "gate refuses and which no amount of pre-1931 text substitutes "
            "for. Under a 95-year term, 1990s song language becomes "
            "admissible in 2085.",
            "OR a non-lyric contemporary phrase resource admissible on its "
            "own terms — a PD/CC0 modern n-gram frequency table. None is in "
            "this repo (searched; see the sources.tsv row this cell reports "
            "and HOLDS). It would still be the wrong register: web or news "
            "English is not song English, which is the defect data/sources."
            "tsv already records against wordfreq20k.txt.",
            "OR redefine the property away from 'cliche' to 'PRE-1931 "
            "COMMONPLACE', which this instrument does measure and which is a "
            "real object — but it is a philological finding about the "
            "corpus, not a check on the writing path, and it must not be "
            "labelled cliche.",
        ],
        "second_blocker_which_IS_a_size_problem": (
            "Separately and less fundamentally: n>=5 has no counts at all "
            "(max dispersion 3 authors at n=5, 2 at n=6), and the n=4 "
            "inventory grows SUPER-LINEARLY with corpus size (82 -> 297 -> "
            "457 n-grams at k>=3 for 479k/776k/992k tokens). So sparsity is "
            "genuinely 'hard to build' in doctrine 44's sense and more "
            "pre-1931 text would relieve it. It would not touch the "
            "disjunction above, and relieving it alone would give a "
            "better-powered detector of the wrong thing."),
    }


# ---------------------------------------------------------------------------
# Corpus reading — K-1's own declared counting rule, reused verbatim
# ---------------------------------------------------------------------------

def tokens(line):
    line = line.replace("’", "'").lower()
    return [t for t in (x.strip("'") for x in TOKEN.findall(line)) if t]


def sung_lines(path):
    """A SUNG LINE is a non-blank line not beginning '#', '---' or '['.

    Not this cell's rule: it is `MISSING.md` K-1's, reused verbatim so the
    two cannot drift apart (doctrine 58).
    """
    with open(path, encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            s = raw.strip()
            if not s or s[0] == "#" or s.startswith("---") or s[0] == "[":
                continue
            yield s


_AUTHOR = re.compile(r"^#\s*author:\s*(.+?)\s*(?:\((.*?)\))?\s*$")
_YEARS = re.compile(r"(\d{3,4})")


def author_meta(path):
    with open(path, encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            if not raw.startswith("#"):
                break
            m = _AUTHOR.match(raw.rstrip())
            if m:
                ys = _YEARS.findall(m.group(2) or "")
                return (m.group(1),
                        int(ys[0]) if ys else None,
                        int(ys[1]) if len(ys) > 1 else None)
    return None, None, None


class PhraseIndex:
    """n-gram -> {author_index: count}, over one file per author."""

    def __init__(self, files=None, nmin=2, nmax=6, root=None):
        root = root or SONG
        self.root = root
        self.files = files if files is not None else sorted(
            f for f in os.listdir(root)
            if f.startswith("eng_") and f.endswith(".txt"))
        self.nmin, self.nmax = nmin, nmax
        self.idx = collections.defaultdict(collections.Counter)
        self.meta, self.nlines, self.ntok = [], 0, 0
        #: TWO line counts, because they are two statistics and quoting one
        #: as the other is doctrine 58. `nlines_k1` is MISSING.md K-1's rule
        #: exactly (non-blank, not '#'/'---'/'['): 152,313. `nlines` drops
        #: the 159 of those that carry no alphabetic token at all -- rows of
        #: `*  *  *  *` and bare years like `1845.`, which are editorial
        #: furniture rather than sung lines. The index is built on `nlines`;
        #: K-1's figure is carried alongside so the two never look like a
        #: drift in one number.
        self.nlines_k1 = 0
        self.by_author = collections.defaultdict(list)
        for ai, fn in enumerate(self.files):
            p = os.path.join(root, fn)
            nm, born, died = author_meta(p)
            self.meta.append({"file": fn, "author": nm,
                              "born": born, "died": died})
            for line in sung_lines(p):
                self.nlines_k1 += 1
                ts = tokens(line)
                if not ts:
                    continue
                self.nlines += 1
                self.ntok += len(ts)
                self.by_author[ai].append(ts)
                for n in range(nmin, nmax + 1):
                    for i in range(len(ts) - n + 1):
                        self.idx[" ".join(ts[i:i + n])][ai] += 1

    def dispersion(self, toks, n, exclude=None):
        """(distinct OTHER authors, witness n-gram) — the statistic.

        `exclude` is the author being scored. Passing None is correct for
        text from OUTSIDE the corpus and wrong for text inside it; there is
        no default that is right for both, so the caller states which
        (doctrine 13).
        """
        best, wit = 0, None
        for i in range(len(toks) - n + 1):
            g = " ".join(toks[i:i + n])
            v = self.idx.get(g)
            if not v:
                continue
            c = len(v) - (1 if exclude is not None and exclude in v else 0)
            if c > best:
                best, wit = c, g
        return best, wit

    def scan(self, lines, n=4, exclude=None):
        """[(line_no, line, authors, witness)] for every line that scores."""
        out = []
        for i, raw in enumerate(lines, 1):
            c, w = self.dispersion(tokens(raw), n, exclude)
            if c:
                out.append((i, raw, c, w))
        return out


# ---------------------------------------------------------------------------
# The gate that refuses
# ---------------------------------------------------------------------------

class Refusal(dict):
    """A refusal is not a failure and must not read as a pass (doctrine 20)."""


def check(lines, index=None, n=4, k=None, force=False):
    """The floor-shaped entry point. REFUSES unless `force` is set.

    Returns a Refusal, which is falsy in the way an empty finding list is
    NOT: `if check(...)` is True for a refusal and False for a clean pass,
    so a caller cannot silently read one as the other.
    """
    if not force:
        b = blocker()
        return Refusal(
            code="PHRASE_CLICHE_REFUSED",
            severity="refusal",
            message=("phrase-level cliche is not measurable against this "
                     "corpus; no finding was computed"),
            evidence=(f"{b['which']}. {b['the_disjunction']} "
                      f"Pass force=True to reach the instrument anyway — it "
                      f"reproduces the documented wrong answer rather than "
                      f"hiding it (doctrine 84). "
                      f"quality/RESULTS_PHRASE_CLICHE.md"),
            blocker=b)
    idx = index or PhraseIndex()
    k = k or 2
    hits = [h for h in idx.scan(lines, n=n) if h[2] >= k]
    return [{"code": "PHRASE_COMMONPLACE", "severity": "note",
             "line": i, "text": t, "authors": c, "witness": w,
             "message": (f"{w!r} is carried by {c} of {len(idx.files)} "
                         f"corpus authors"),
             "evidence": ("PRE-1931 commonplace, NOT a cliche — the "
                          "population is pre-1931 by construction. "
                          "quality/RESULTS_PHRASE_CLICHE.md")}
            for i, t, c, w in hits]


# ---------------------------------------------------------------------------
# Fixtures — doctrine 94: a positive-case suite cannot find a generous rule
# ---------------------------------------------------------------------------

#: MUST FIRE. A real corpus 4-gram at the top of the dispersion ranking.
FIXTURE_FIRES = "the glory of the morning on the water"

#: MUST STAY SILENT. The line from `examples/cherokee_bill.txt` that H-1's
#: brief names — a cliche as a FIGURE (the stock hanging-ballad trope) and
#: unique as a STRING. That the instrument is silent here is the finding,
#: not a bug to be tuned away.
FIXTURE_SILENT = "and every rope in Arkansas began to braid for him"


def self_test(index=None):
    idx = index or PhraseIndex()
    ok = True

    c, w = idx.dispersion(tokens(FIXTURE_FIRES), 4)
    fired = c >= 2
    print(f"  FIRE   {'PASS' if fired else 'FAIL'}  "
          f"{FIXTURE_FIRES!r}\n         -> {c} authors, witness {w!r}")
    ok &= fired

    c, w = idx.dispersion(tokens(FIXTURE_SILENT), 4)
    silent = c == 0
    print(f"  SILENT {'PASS' if silent else 'FAIL'}  "
          f"{FIXTURE_SILENT!r}\n         -> {c} authors, witness {w!r}")
    ok &= silent

    r = check([FIXTURE_FIRES])
    refused = isinstance(r, Refusal) and bool(r)
    print(f"  REFUSE {'PASS' if refused else 'FAIL'}  "
          f"check() refuses by default and is TRUTHY, so it cannot be read "
          f"as a clean pass")
    ok &= refused

    forced = check([FIXTURE_FIRES], index=idx, force=True)
    reach = not isinstance(forced, Refusal) and len(forced) == 1
    print(f"  REACH  {'PASS' if reach else 'FAIL'}  "
          f"force=True reaches the instrument (doctrine 84): "
          f"{len(forced) if not isinstance(forced, Refusal) else 0} note(s)")
    ok &= reach
    return ok


# ---------------------------------------------------------------------------
# --measure — every table in the results file
# ---------------------------------------------------------------------------

def measure(idx):
    from quality.features import FUNCTION_TAGS, _tagger
    tag = _tagger()
    rng = random.Random(SEED)
    lines = [(a, t) for a, ts in idx.by_author.items() for t in ts]
    print(f"population: {len(idx.files)} authors, {idx.ntok} tokens")
    print(f"  sung lines, MISSING.md K-1's rule          : {idx.nlines_k1}")
    print(f"  ...of which carry >=1 alphabetic token     : {idx.nlines}")
    print(f"  difference (rows of '* * *', bare years)   : "
          f"{idx.nlines_k1 - idx.nlines}   <- two statistics, doctrine 58")

    print("\n== T1  the sparsity wall ==")
    print(" n | distinct  |  max | ngrams reaching k authors")
    print("   |  ngrams   | disp |    k=3     k=5     k=8    k=13")
    for n in range(2, idx.nmax + 1):
        rows = [len(v) for g, v in idx.idx.items() if g.count(" ") == n - 1]
        c = {k: sum(1 for a in rows if a >= k) for k in (3, 5, 8, 13)}
        print(f" {n} | {len(rows):9d} | {max(rows):4d} | "
              f"{c[3]:7d} {c[5]:7d} {c[8]:7d} {c[13]:6d}")

    sel = rng.sample(lines, min(8000, len(lines)))
    print(f"\n== T2  firing rate and the FPR lower bound "
          f"(n={len(sel)} held-out lines) ==")
    print("  n |  k | fires on | witness ALL closed-class | >=half")
    for n in (3, 4, 5):
        for k in (2, 3, 5, 8):
            hits = []
            for a, t in sel:
                c, w = idx.dispersion(t, n, exclude=a)
                if c >= k and w:
                    hits.append((w, t))
            if not hits:
                continue
            allf = half = 0
            for w, t in hits:
                tg = {}
                for word, tt in tag(t):
                    tg.setdefault(word, tt)
                ts = [tg.get(x, "NN") for x in w.split()]
                nf = sum(1 for x in ts if x in FUNCTION_TAGS)
                allf += nf == len(ts)
                half += nf * 2 >= len(ts)
            print(f"  {n} | {k:2d} | {len(hits)/len(sel):7.2%}  |  "
                  f"{allf:5d}/{len(hits):<5d} = {allf/len(hits):6.1%}     | "
                  f"{half/len(hits):6.1%}")

    print("\n== T3  every witness at n=4, k>=2 ==")
    w4 = collections.Counter()
    for a, t in sel:
        c, g = idx.dispersion(t, 4, exclude=a)
        if c >= 2 and g:
            w4[g] += 1
    print(f"  {sum(w4.values())} firings, {len(w4)} distinct witnesses")
    for g, c in w4.most_common():
        print(f"    x{c}  {g}")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("file", nargs="?")
    ap.add_argument("--measure", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("-n", type=int, default=4)
    ap.add_argument("-k", type=int, default=2)
    ap.add_argument("--force", action="store_true",
                    help="reach the instrument past its refusal")
    a = ap.parse_args(argv)

    if a.self_test:
        return 0 if self_test() else 1
    if a.measure:
        measure(PhraseIndex())
        return 0
    if not a.file:
        ap.print_help()
        return 2

    lines = [l.rstrip() for l in open(a.file, encoding="utf-8") if l.strip()]
    r = check(lines, n=a.n, k=a.k, force=a.force)
    if isinstance(r, Refusal):
        print(f"\n[REFUSAL] {r['code']}: {r['message']}")
        print(f"          {r['evidence']}")
        print("\n  what would lift it:")
        for w in r["blocker"]["what_would_lift_it"]:
            print(f"    - {w}")
        return 2                      # doctrine 20: refusal != pass
    print(f"\nPHRASE COMMONPLACE — {len(r)} note(s), n={a.n} k>={a.k}")
    print("  MEASURED AGAINST A PRE-1931 POPULATION. Not a cliche check.")
    for f in r:
        print(f"  line {f['line']:3d}  {f['authors']:3d} authors  "
              f"{f['witness']!r}\n            {f['text']}")
    if not r:
        print("  no line reaches the threshold")
    return 0


if __name__ == "__main__":
    sys.exit(main())

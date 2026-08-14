#!/usr/bin/env python3
"""PHRASE COMMONPLACE — the phrase-level half of MISSING.md H-1, MEASURED,
and REFUSED as a rejection on the evidence it produced.

    python3 quality/phrase_commonplace.py --measure    # §1 §2 §3 §4
    python3 quality/phrase_commonplace.py --nulls      # §5, the two nulls
    python3 quality/phrase_commonplace.py --period     # §6, and its control
    python3 quality/phrase_commonplace.py --scaling    # §9's second table
    python3 quality/phrase_commonplace.py --self-test  # §8, the fixtures
    python3 quality/phrase_commonplace.py FILE         # score a lyric
    python3 quality/phrase_commonplace.py --check      # 0 ok 1 moved 2 unknown

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
     Arkansas began to braid for him` scores ZERO AT n>=3 — CORRECTED
     2026-08-14 from "ZERO at every n", which was already known false and
     had escaped correction here. At n=2 that line scores 32 authors, on
     `and every`; `quality/RESULTS_PHRASE_CLICHE.md` §7 recorded the
     correction on 2026-08-11 and this docstring went on asserting the
     round number for three days. The mechanism is unchanged and the
     n=2 witnesses strengthen it: `and every` (CC+DT), `for him` (IN+PRP),
     `began to` (VBD+TO) are grammar, not figure. The line is a cliché as a
     FIGURE and this is a statistic over STRINGS, so a stock trope realised
     in fresh words has no string overlap with any earlier realisation of
     it. Doctrine 61 in its sharpest form: this rule fires often and it
     fires on the wrong thing.

     NOTE that `FIXTURE_SILENT` is NO LONGER that line. It was replaced in
     commit 11aa19b (2026-08-12) by `and every gallows post remembered his
     weight` when the Claude-authored `examples/` were removed; the results
     file's §8 transcript still showed the old string until 2026-08-14.

  4. THE POPULATION IS THE WRONG ONE AND CANNOT BE THE RIGHT ONE. See
     `blocker()` below — this is doctrine 92 and it is the load-bearing
     result.

PERIOD-READING (doctrine 11). This paragraph used to read: "tested and is NOT
the primary defect ... spearman +0.07 to +0.10 across 1620-1929, against
-0.367 for an archaic-2sg positive control". THAT WAS DRIFT ON AN
UNREPRODUCIBLE BASE and it is corrected 2026-08-14. No code in this repo had
ever produced those correlations — `author_meta` parsed death years into
`PhraseIndex.meta` and nothing read the field — and the "+0.10" upper end
appears in no document at all. `quality/RESULTS_PHRASE_CLICHE.md` §6 recorded
the withdrawal on 2026-08-13 and said the escape "is corrected at the same
date"; it was not, and this line is that correction.

THE PRODUCER NOW EXISTS: `period()` below, `--period`, and its figures are
PINNED. Measured against a DECLARED closed paradigm (`ARCHAIC_2SG`) rather
than the undeclared one the withdrawn figures used, so the values are NOT
comparable to the withdrawn ones and do not supersede them by matching —
see §6 of the results file, where both stand side by side (doctrine 17).
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

#: The held-out sample every rate below is measured on. Hoisted out of
#: `measure()` on 2026-08-14 so `nulls()` draws THE SAME 8,000 lines rather
#: than its own — a null measured on a different sample from the observation
#: it is compared against is not a null, it is two experiments.
HELD_OUT = 8000

#: §5's replicate count. Five, not two hundred: each replicate re-scores all
#: 8,000 lines and the separation being measured is 20x, not 1.2x. Stated
#: because a replicate count is a coordinate of every rate drawn from it
#: (doctrine 58) and because doctrine 68's "fraction of replicates that
#: differ" is meaningless without it.
NULL_REPLICATES = 5

#: §5 NULL C. The vocabulary is ranked by corpus frequency and cut into this
#: many EQUAL-SIZE bands of TYPES (not of tokens). Declared because "frequency
#: decile" names two different constructions and the numbers differ.
FREQ_BANDS = 10

#: §6's operating point. n=3 k>=5 is the setting the withdrawn §6 named, kept
#: so the two designs are compared at one point rather than at two.
PERIOD_N, PERIOD_K = 3, 5

#: §6. An author with fewer lines than this has a fire rate that is mostly
#: its own denominator. 40 is the withdrawn section's own figure, reused
#: verbatim so the author set is the one thing not re-chosen here.
MIN_AUTHOR_LINES = 40

#: §6's bands, [lo, hi). The withdrawn section's own cuts, reused for the
#: same reason.
DEATH_BANDS = ((1600, 1830), (1830, 1870), (1870, 1900), (1900, 1930))

#: §9's scaling rows: how many AUTHORS in each sub-corpus. The selection rule
#: is the first m files in the canonical sorted order — DETERMINISTIC and
#: stated, which is exactly what the recorded §9 table lacked. See `scaling()`.
SCALE_AUTHORS = (71, 107, 143)

#: THE ARCHAIC 2nd-PERSON-SINGULAR PARADIGM — §6's positive control, and a
#: DECLARED CLOSED LIST (doctrine 46: a function-word list is part of a
#: phonology, not an optimisation).
#:
#: WHAT IS IN IT: the 2sg pronoun/determiner paradigm, and the 2sg forms of
#: the CLOSED auxiliary and copula class. Both are closed sets in the
#: grammar's own sense — no new member can be coined.
#:
#: WHAT IS DELIBERATELY OUT, and this is the load-bearing exclusion: the
#: productive `-est` on LEXICAL verbs (`knowest`, `givest`, `seest`). That
#: suffix is open-class — any verb takes it — so any list of them is a list
#: somebody chose, which is an optimisation wearing a paradigm's clothes. A
#: control whose strength can be tuned by adding words to it is not a
#: control (doctrines 16, 31).
#:
#: WHAT IS ALSO OUT, and it differs from the withdrawn §6: `hath` and `doth`.
#: The withdrawn section named them ("thou/thee/thy/hath/doth/dost/…"), but
#: they are 3rd-person singular `-th`, not 2sg. A paradigm that mixes two
#: persons is not the paradigm it says it is. This is one reason the figures
#: below cannot be read as a re-measurement of the withdrawn ones.
ARCHAIC_2SG = frozenset((
    # pronoun / determiner paradigm
    "thou", "thee", "thy", "thine", "thyself",
    # copula and auxiliary 2sg — a closed class
    "art", "wast", "wert", "hast", "hadst", "dost", "doest", "didst",
    "shalt", "wilt", "canst", "couldst", "shouldst", "wouldst",
    "mayst", "mayest", "mightst", "mightest",
))


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
            "The instrument is an afternoon. It is in this file and it "
            "runs. CORRECTED 2026-08-14: this clause used to end 'and every "
            "table in the results doc re-derives from it', which was FALSE "
            "for five of the results file's twelve sections between "
            "2026-08-11 and 2026-08-14 — two had no producer at all. The "
            "producers exist now (--measure, --nulls, --period, --scaling) "
            "and --check pins them, which is what makes the clause "
            "checkable rather than merely asserted."),
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

#: MUST STAY SILENT. A cliche as a FIGURE (the stock hanging-ballad trope)
#: and unique as a STRING (dispersion 0 over the corpus index, measured).
#: That the instrument is silent here is the finding, not a bug to be
#: tuned away.
FIXTURE_SILENT = "and every gallows post remembered his weight"


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

def held_out(idx):
    """The seeded held-out sample. ONE definition, so §3, §4 and §5 share it.

    Extracted from `measure()` unchanged on 2026-08-14 — same construction
    order, same `random.Random(SEED)`, same `rng.sample` — so every T2 and T3
    figure the results file publishes reproduces byte-for-byte across the
    refactor. Verified by re-running `--measure` and diffing.
    """
    lines = [(a, t) for a, ts in idx.by_author.items() for t in ts]
    return random.Random(SEED).sample(lines, min(HELD_OUT, len(lines)))


def _tagger_or_none():
    """-> (tag, FUNCTION_TAGS) or (None, None), never a traceback.

    The tagger is FETCHED (`quality/fetch_data.py`), not committed, and
    `data/nltk/` is gitignored — so its absence is an ordinary state of a
    fresh checkout and not a defect in anything this module measures. It is
    probed with a real call because `_tagger()` only returns `nltk.pos_tag`;
    the missing-model `LookupError` does not arrive until the first tag.

    Returning None rather than raising is what lets `check_pins` answer
    CANNOT TELL for the rows that need it, instead of a traceback that
    reads, to a CI log, exactly like a broken corpus (doctrines 20, 28).
    """
    try:
        from quality.features import FUNCTION_TAGS, _tagger
        tag = _tagger()
        tag(["probe"])
        return tag, FUNCTION_TAGS
    except (ImportError, LookupError, OSError) as e:
        print(f"  TAGGER UNAVAILABLE — {type(e).__name__}: {e}")
        return None, None


def measure(idx):
    """-> the measured dict `check_pins` reads. Prints §1-§4 unchanged."""
    tag, FUNCTION_TAGS = _tagger_or_none()
    m = {"authors": len(idx.files), "tokens": idx.ntok,
         "nlines_k1": idx.nlines_k1, "nlines": idx.nlines}
    print(f"population: {len(idx.files)} authors, {idx.ntok} tokens")
    print(f"  sung lines, MISSING.md K-1's rule          : {idx.nlines_k1}")
    print(f"  ...of which carry >=1 alphabetic token     : {idx.nlines}")
    print(f"  difference (rows of '* * *', bare years)   : "
          f"{idx.nlines_k1 - idx.nlines}   <- two statistics, doctrine 58")

    print("\n== T1  the sparsity wall ==")
    print(" n | distinct  |  max | ngrams reaching k authors")
    print("   |  ngrams   | disp |    k=3     k=5     k=8    k=13")
    t1 = {}
    for n in range(2, idx.nmax + 1):
        rows = [len(v) for g, v in idx.idx.items() if g.count(" ") == n - 1]
        c = {k: sum(1 for a in rows if a >= k) for k in (3, 5, 8, 13)}
        t1[n] = (len(rows), max(rows), c[3], c[5], c[8], c[13])
        print(f" {n} | {len(rows):9d} | {max(rows):4d} | "
              f"{c[3]:7d} {c[5]:7d} {c[8]:7d} {c[13]:6d}")
    m["t1"] = t1

    sel = held_out(idx)
    m["held_out"] = len(sel)
    print(f"\n== T2  firing rate and the FPR lower bound "
          f"(n={len(sel)} held-out lines) ==")
    print("  n |  k | fires on | witness ALL closed-class | >=half")
    #: ONE TAGGING PASS, memoised by line INDEX. This loop used to call the
    #: tagger once per (n, k, hit), so a line firing at nine of the twelve
    #: settings was tagged nine times and the whole table cost ~5 CPU-min. The
    #: per-line dict is built exactly as before — first tag wins, `setdefault`
    #: — so every published T2 figure is byte-identical across the change,
    #: verified by diffing the full `--measure` output before and after.
    #: The point is not speed for its own sake: `--check` reads these counts,
    #: and a check nobody can afford to run is a check nobody runs.
    tags = [None] * len(sel)
    t2 = {} if tag else None
    for n in (3, 4, 5) if tag else ():
        for k in (2, 3, 5, 8):
            hits = []
            for i, (a, t) in enumerate(sel):
                c, w = idx.dispersion(t, n, exclude=a)
                if c >= k and w:
                    hits.append((w, i))
            if not hits:
                continue
            allf = half = 0
            for w, i in hits:
                if tags[i] is None:
                    tg = {}
                    for word, tt in tag(sel[i][1]):
                        tg.setdefault(word, tt)
                    tags[i] = tg
                ts = [tags[i].get(x, "NN") for x in w.split()]
                nf = sum(1 for x in ts if x in FUNCTION_TAGS)
                allf += nf == len(ts)
                half += nf * 2 >= len(ts)
            t2[(n, k)] = (len(hits), allf, half)
            print(f"  {n} | {k:2d} | {len(hits)/len(sel):7.2%}  |  "
                  f"{allf:5d}/{len(hits):<5d} = {allf/len(hits):6.1%}     | "
                  f"{half/len(hits):6.1%}")
    if t2 is None:
        print("  NOT MEASURED — both closed-class columns are the tagger's, "
              "so the whole\n  table is a CANNOT TELL rather than a partial "
              "answer (doctrines 20, 28).")
    m["t2"] = t2

    print("\n== T3  every witness at n=4, k>=2 ==")
    w4 = collections.Counter()
    for a, t in sel:
        c, g = idx.dispersion(t, 4, exclude=a)
        if c >= 2 and g:
            w4[g] += 1
    print(f"  {sum(w4.values())} firings, {len(w4)} distinct witnesses")
    for g, c in w4.most_common():
        print(f"    x{c}  {g}")
    m["t3_firings"] = sum(w4.values())
    m["t3_distinct"] = len(w4)
    return m


# ---------------------------------------------------------------------------
# §5 — the two randomisations. BUILT 2026-08-14; there was no producer before.
# ---------------------------------------------------------------------------
#
# WHAT WAS HERE BEFORE THIS FUNCTION: nothing. §5 of
# `quality/RESULTS_PHRASE_CLICHE.md` published NULL A at 97.8-98.0%, NULL C at
# 100.0%, observed 0.98%/0.85%, null 0.02%/0.05% and lifts 59x and 17x, and
# no code in this repo — at head or
# in any commit reachable from it — computed any of them. That was established
# on 2026-08-13 and the section was annotated WITHDRAWN.
#
# THIS IS NOT A RE-DERIVATION OF THOSE NUMBERS AND MUST NOT BE READ AS ONE.
# The withdrawn figures have no declared sample, seed, replicate count or
# substitution rule, so there is no design to reproduce — only a design to
# choose. What follows is a choice, stated, and the values it returns stand on
# their own. The withdrawn ones stay visible in §5 under doctrine 17.

def _null_a(toks, rng):
    """WITHIN-LINE WORD SHUFFLE.

    PRESERVES  the word multiset, the line length, every unigram frequency,
               and therefore the author's whole vocabulary.
    DESTROYS   word order, hence which n-grams exist at all.
    A NULL ABOUT  whether the words are arranged the way English arranges
               them. NOT about over-familiarity — see `blocker()`.
    """
    out = list(toks)
    rng.shuffle(out)
    return out


def freq_bands(idx):
    """-> (word -> band index) over the corpus vocabulary, `FREQ_BANDS` bands.

    Types ranked by corpus token frequency, ties broken ALPHABETICALLY
    (doctrine 66 — a tie broken by iterating a dict is a result that does not
    reproduce), then cut into equal-size bands OF TYPES. Stated because
    "frequency decile" names at least two constructions — equal type count and
    equal token mass — which put different words in the same band.
    """
    freq = collections.Counter()
    for ts in idx.by_author.values():
        for t in ts:
            freq.update(t)
    ranked = sorted(freq, key=lambda w: (-freq[w], w))
    per = max(1, len(ranked) // FREQ_BANDS)
    return {w: min(i // per, FREQ_BANDS - 1) for i, w in enumerate(ranked)}


def _null_c(toks, mask, band, pools, rng):
    """FREQUENCY-MATCHED CONTENT SUBSTITUTION.

    PRESERVES  word order, every non-content token in place — hence the
               syntactic frame — and each content word's frequency band.
    DESTROYS   which content words fill the frame.
    A NULL ABOUT  whether the dispersion belongs to the PHRASE or to the
               FRAME. Again NOT about over-familiarity.

    `mask[i]` is True only where the tagger read a CONTENT tag. Everything
    else — closed-class, numerals, symbols, anything the tagger would not
    commit on — is left alone, because substituting a token this module
    cannot classify is a substitution nobody declared.

    The replacement pool for a band is the set of word types observed with a
    CONTENT tag somewhere in the held-out sample — derived from the tagger,
    not a list this module wrote (doctrine 16).
    """
    out = []
    for w, sub in zip(toks, mask):
        pool = pools.get(band.get(w)) if sub else None
        out.append(rng.choice(pool) if pool else w)
    return out


def nulls(idx, replicates=NULL_REPLICATES, n=4, k=2):
    """§5, MEASURED. -> dict.

    DOCTRINE 68 IS THE POINT OF THE `differ` COLUMN. A randomisation that
    returns the observation is the identity map, and the identity map is the
    most dangerous object in this repo because it produces a clean-looking
    null with no randomisation in it. `differ` is the fraction of randomised
    LINES whose token sequence is not the original's — measured, per
    replicate, and reported whatever it says.
    """
    from quality.features import CONTENT_TAGS
    tag, _ = _tagger_or_none()
    if tag is None:
        print("\n== §5  NOT MEASURED — NULL C's frame and its band pools are "
              "both the\n  tagger's, and NULL A alone is half a section "
              "(doctrines 20, 28).")
        return {}
    sel = held_out(idx)
    band = freq_bands(idx)

    # ONE tagging pass over the sample, serving both of NULL C's needs: the
    # per-token content mask, and the band pools it draws replacements from.
    tagged, pools = [], collections.defaultdict(set)
    for a, t in sel:
        mask = []
        for (w, tg) in tag(t):
            content = tg in CONTENT_TAGS and w in band
            mask.append(content)
            if content:
                pools[band[w]].add(w)
        if len(mask) != len(t):        # tagger did not align; substitute none
            mask = [False] * len(t)
        tagged.append((a, t, mask))
    pools = {b: sorted(v) for b, v in pools.items()}   # doctrine 66

    def rate(rows):
        fires = sum(1 for a, t in rows
                    if idx.dispersion(t, n, exclude=a)[0] >= k)
        return fires / len(rows)

    obs = rate([(a, t) for a, t, _ in tagged])
    out = {"held_out": len(sel), "replicates": replicates,
           "n": n, "k": k, "observed": obs, "pool_bands": len(pools)}

    print(f"\n== §5  the two randomisations "
          f"(n={len(sel)} held-out lines, {replicates} replicates, "
          f"seed {SEED}) ==")
    print(f"  observed fire rate at n={n} k>={k}: {obs:.2%}")
    print("  null | mean fire rate |  lift | replicates DIFFERING from the "
          "observation")
    for name, mk in (("A", "a"), ("C", "c")):
        rates, diffs = [], []
        rng = random.Random(SEED)
        for _ in range(replicates):
            rows, d = [], 0
            for a, t, mask in tagged:
                r = (_null_a(t, rng) if mk == "a"
                     else _null_c(t, mask, band, pools, rng))
                d += r != t
                rows.append((a, r))
            rates.append(rate(rows))
            diffs.append(d / len(rows))
        mean = sum(rates) / len(rates)
        out[f"null_{mk}_rate"] = mean
        out[f"null_{mk}_differ"] = (min(diffs), max(diffs))
        lift = obs / mean if mean else float("inf")
        print(f"   {name}   |     {mean:7.3%}    | {lift:5.1f}x | "
              f"{min(diffs):.1%} – {max(diffs):.1%}")
    print("  NEITHER IS A NULL ABOUT OVER-FAMILIARITY. A restores "
          "grammaticality's\n  contribution; C restores the frame's. See "
          "blocker() for why no null here can\n  be about the property H-1 "
          "asked for.")
    return out


# ---------------------------------------------------------------------------
# §6 — period-reading and its positive control. BUILT 2026-08-14.
# ---------------------------------------------------------------------------

def _pearson(xs, ys):
    n = len(xs)
    if n < 3:
        return 0.0
    mx, my = sum(xs) / n, sum(ys) / n
    num = sum((a - mx) * (b - my) for a, b in zip(xs, ys))
    dx = sum((a - mx) ** 2 for a in xs) ** 0.5
    dy = sum((b - my) ** 2 for b in ys) ** 0.5
    return num / (dx * dy) if dx and dy else 0.0


def period(idx):
    """§6, MEASURED, against a DECLARED paradigm. -> dict.

    Doctrine 11 says assume a new feature reads period until a measurement
    says otherwise. The measurement needs a positive control or its flat
    result means nothing (doctrines 31, 76): if the DESIGN cannot see a period
    effect, the check being period-flat is not evidence of anything.

    The control is `ARCHAIC_2SG` — a closed grammatical paradigm whose
    period-dependence is not a hypothesis. Run over the SAME authors, the SAME
    lines and the SAME rate construction as the check, so the two differ in
    the statistic and in nothing else.

    `spearman` is imported from `quality.song_profile_calibration` rather than
    rewritten: two rank correlations in one repo is one too many.
    """
    from quality.song_profile_calibration import spearman
    rows = []
    for ai, meta in enumerate(idx.meta):
        died, lines = meta["died"], idx.by_author.get(ai, ())
        if died is None or len(lines) < MIN_AUTHOR_LINES:
            continue
        fire = sum(1 for t in lines
                   if idx.dispersion(t, PERIOD_N, exclude=ai)[0] >= PERIOD_K)
        arch = sum(1 for t in lines if ARCHAIC_2SG.intersection(t))
        rows.append((died, fire / len(lines), arch / len(lines)))
    rows.sort()

    yr = [r[0] for r in rows]
    fr = [r[1] for r in rows]
    ar = [r[2] for r in rows]
    out = {"period_authors": len(rows),
           "period_span": (min(yr), max(yr)) if rows else (None, None),
           "check_pearson": round(_pearson(yr, fr), 4),
           "check_spearman": round(spearman(yr, fr), 4),
           "ctrl_pearson": round(_pearson(yr, ar), 4),
           "ctrl_spearman": round(spearman(yr, ar), 4)}

    print(f"\n== §6  period-reading (doctrine 11) and its positive control "
          f"(doctrines 31, 76) ==")
    print(f"  n={PERIOD_N} k>={PERIOD_K}, {len(rows)} authors with a death "
          f"year and >={MIN_AUTHOR_LINES} lines, "
          f"{out['period_span'][0]}..{out['period_span'][1]}")
    print(f"    CHECK        fire-rate vs death year:   "
          f"pearson {out['check_pearson']:+.4f}  "
          f"spearman {out['check_spearman']:+.4f}")
    print(f"    POS CONTROL  archaic-2sg vs death year: "
          f"pearson {out['ctrl_pearson']:+.4f}  "
          f"spearman {out['ctrl_spearman']:+.4f}")
    print()
    print("  death band | authors | mean fire-rate | mean archaic rate")
    bands = []
    for lo, hi in DEATH_BANDS:
        sub = [r for r in rows if lo <= r[0] < hi]
        if not sub:
            bands.append((len(sub), None, None))
            print(f"  {lo}-{hi}  |       0 |         —      |         —")
            continue
        f = sum(r[1] for r in sub) / len(sub)
        a = sum(r[2] for r in sub) / len(sub)
        bands.append((len(sub), round(f, 4), round(a, 4)))
        print(f"  {lo}-{hi}  |    {len(sub):4d} |        {f:6.2%}  |"
              f"          {a:6.2%}")
    out["bands"] = tuple(bands)
    banded = sum(b[0] for b in bands)
    out["banded"] = banded
    if banded != len(rows):
        print(f"  NOTE {len(rows) - banded} author(s) fall outside every "
              f"band and are in NO row above.")
    print("  The control is what licenses reading the CHECK row at all. If "
          "the control\n  is flat, the design has no power and the check's "
          "flatness means nothing.")
    return out


# ---------------------------------------------------------------------------
# §9's second table — the sparsity scaling. BUILT 2026-08-14.
# ---------------------------------------------------------------------------

def scaling(idx):
    """§9's `authors | tokens | n=4 k>=3 | n=5 k>=3` table. -> dict.

    THE SELECTION RULE IS THE WHOLE POINT AND THE RECORDED TABLE DID NOT HAVE
    ONE. §9 published 71 authors at 478,763 tokens and 107 at 775,914, and no
    deterministic or seeded rule over `corpus/song/eng_*.txt` reproduces either
    figure — first-m-alphabetically gives 414,250 and 863,565; `random.Random`
    at this module's own SEED and at seven others gives neither; and
    smallest-first, largest-first and stride-2 give neither. So those two
    rows are a count that is a coordinate of a rule nobody wrote down, which
    is doctrine 58's exact case, and they cannot be re-derived from anything
    that ships.

    THE RULE HERE IS: the first m files in the canonical sorted order. Boring
    and arbitrary with respect to token count — which is the property a
    sub-sample needs — and, unlike a seeded draw, it does not depend on which
    `random` implementation the interpreter ships.
    """
    print("\n== §9  the sparsity scaling (rule: first m files, sorted) ==")
    print(" authors | tokens  | n=4 reaching k>=3 | n=5 reaching k>=3")
    out = {}
    for m in SCALE_AUTHORS:
        sub = idx if m >= len(idx.files) else PhraseIndex(
            files=idx.files[:m], nmin=4, nmax=5, root=idx.root)
        c4 = sum(1 for g, v in sub.idx.items()
                 if g.count(" ") == 3 and len(v) >= 3)
        c5 = sum(1 for g, v in sub.idx.items()
                 if g.count(" ") == 4 and len(v) >= 3)
        out[m] = (sub.ntok, c4, c5)
        print(f"    {m:4d} | {sub.ntok:7d} | {c4:11d}       | {c5:11d}")
    return out


# ---------------------------------------------------------------------------
# THE PINS, and the check that can go red. BUILT 2026-08-14.
# ---------------------------------------------------------------------------
#
# WHY THIS EXISTS. Until today this module could exit non-zero for exactly two
# reasons — `--self-test` failing a fixture, and the refusal path returning 2 —
# and NEITHER of them reads a published figure. Every number in
# `quality/RESULTS_PHRASE_CLICHE.md` could move by any amount and every
# command in this file would still exit 0. That is the same shape found in
# `audit_hafez_radif.py`, `audit_spans.py`, `audit_tang_null.py`,
# `audit_kalevala_null.py` and `canon_sources.py`: an instrument that reports
# and a human who is expected to read. Doctrine 48.
#
# WHAT IS PINNED: everything EXACT over a fixed corpus at fixed thresholds —
# the population counts, all five T1 rows, all nine T2 rows, T3's two totals,
# and the whole of §6, which has no randomisation in it at all.
#
# WHAT IS NOT PINNED, and why: §5's two null RATES and the lifts computed from
# them. They ride a five-replicate seeded draw, and while `random.Random` is
# reproducible within an interpreter, `shuffle`/`choice` are not a stable
# contract across CPython versions — pinning them would produce a red that
# says "your Python changed", which is not a finding about this corpus. Same
# call `audit_tang_null.py` and `audit_kalevala_null.py` make about their null
# medians. §5's doctrine-68 `differ` fractions ARE pinned, as a FLOOR rather
# than a value (see `check_pins`): the question doctrine 68 asks is whether the
# randomisation randomises anything, and the answer to that is not a third
# decimal.
#
# MEASURED 2026-08-14, on the run that built the producers. Doctrine 58: these
# are counts, and a count is a coordinate of a threshold AND of a rendering.
# Argue them and repin with the superseded value visible and dated
# (doctrine 17); do not tune the statistic to meet them.
PINNED = {
    # §1 — the population
    "authors": 143, "tokens": 991751,
    "nlines_k1": 152313, "nlines": 152154, "held_out": 8000,
    # §2 — T1, per n: (distinct ngrams, max disp, k>=3, k>=5, k>=8, k>=13)
    "t1": {2: (348858, 109, 32939, 14659, 6736, 2815),
           3: (569549, 33, 9264, 2406, 664, 136),
           4: (508723, 13, 457, 43, 8, 1),
           5: (378575, 3, 21, 0, 0, 0),
           6: (251614, 2, 0, 0, 0, 0)},
    # §3 — T2, per (n, k): (firings, witness ALL closed-class, >= half)
    #: NOTE the (4, 8) row. `--measure` has always printed it and the results
    #: file's §3 table has always omitted it — a producer printing nine rows
    #: and a document publishing eight. Pinned here so the omission cannot
    #: quietly become a drift.
    "t2": {(3, 2): (2102, 246, 1506), (3, 3): (1490, 196, 1105),
           (3, 5): (888, 122, 659), (3, 8): (482, 77, 371),
           (4, 2): (81, 0, 70), (4, 3): (40, 0, 37),
           (4, 5): (11, 0, 11), (4, 8): (1, 0, 1),
           (5, 2): (5, 0, 4)},
    # §4 — T3
    "t3_firings": 81, "t3_distinct": 72,
    # §6 — no randomisation anywhere in this block, so every figure is exact
    "period_authors": 115, "period_span": (1620, 1929), "banded": 115,
    "check_pearson": 0.1110, "check_spearman": 0.0554,
    "ctrl_pearson": -0.1868, "ctrl_spearman": -0.3503,
    "bands": ((27, 0.1488, 0.1325), (34, 0.1259, 0.0888),
              (43, 0.1473, 0.0628), (11, 0.1792, 0.0802)),
    # §9 — the scaling table, under THIS module's declared selection rule
    "scaling": {71: (414250, 104, 5), 107: (863565, 342, 15),
                143: (991751, 457, 21)},
}

#: §5's doctrine-68 floor. A randomisation that leaves most lines untouched is
#: the identity map with extra steps, and that is what this floor catches. It
#: is deliberately far below the measured 97.6% / 99.9% — it is a guard against
#: the randomisation breaking, not a pin on its third decimal.
DIFFER_FLOOR = 0.90


def check_pins(m):
    """-> exit code. 0 PASS · 1 a figure MOVED · 2 CANNOT TELL.

    THREE STATES, NOT TWO, and the third is the one doctrine 20/28 exists for.
    A figure that was never measured on this run — because the corpus is not
    on disk, or because the tagger the T2 columns need is not installed — has
    not moved. Reporting it as a drift sends somebody to repin a number that
    is fine; reporting it as a pass is worse. It is counted separately, named,
    and it decides the exit code only when nothing actually moved.
    """
    print()
    print("=" * 74)
    print("CHECK — the committed figures against this run")
    print("=" * 74)
    bad = untold = 0

    def row(key, want, got, label=None):
        nonlocal bad, untold
        label = label or key
        if got is None:
            untold += 1
            print(f"  [??  ] {label:22s} committed {want} — NOT MEASURED on "
                  f"this run")
        elif got == want:
            print(f"  [ok  ] {label:22s} committed {want}")
        else:
            bad += 1
            print(f"  [FAIL] {label:22s} committed {want}, measured {got}")

    for k in ("authors", "tokens", "nlines_k1", "nlines", "held_out",
              "t3_firings", "t3_distinct"):
        row(k, PINNED[k], m.get(k))

    t1 = m.get("t1") or {}
    for n, want in sorted(PINNED["t1"].items()):
        row(f"t1[{n}]", want, t1.get(n) if t1 else None, f"T1 n={n}")
    t2 = m.get("t2") or {}
    for (n, k), want in sorted(PINNED["t2"].items()):
        row("t2", want, t2.get((n, k)) if t2 else None, f"T2 n={n} k>={k}")

    for k in ("period_authors", "period_span", "banded", "check_pearson",
              "check_spearman", "ctrl_pearson", "ctrl_spearman", "bands"):
        row(k, PINNED[k], m.get(k))

    sc = m.get("scaling") or {}
    for a, want in sorted(PINNED["scaling"].items()):
        row("scaling", want, sc.get(a) if sc else None, f"scaling m={a}")

    # §5 — a FLOOR, not a value. See DIFFER_FLOOR.
    for name in ("a", "c"):
        d = m.get(f"null_{name}_differ")
        if d is None:
            untold += 1
            print(f"  [??  ] {'NULL ' + name.upper() + ' differ':22s} "
                  f"floor {DIFFER_FLOOR:.0%} — NOT MEASURED on this run")
        elif min(d) >= DIFFER_FLOOR:
            print(f"  [ok  ] {'NULL ' + name.upper() + ' differ':22s} "
                  f"{min(d):.1%}–{max(d):.1%} >= floor {DIFFER_FLOOR:.0%}")
        else:
            bad += 1
            print(f"  [FAIL] {'NULL ' + name.upper() + ' differ':22s} "
                  f"{min(d):.1%} < floor {DIFFER_FLOOR:.0%} — the "
                  f"randomisation is not randomising (doctrine 68)")

    print()
    if untold:
        print(f"  {untold} figure(s) CANNOT BE TOLD from this run. That is "
              f"not a drift and not a")
        print("  pass: nothing was measured, so nothing moved and nothing "
              "was confirmed.")
    if bad:
        print(f"  {bad} figure(s) MOVED. Either the corpus under "
              f"`corpus/song/` changed, or the")
        print("  statistic did. Read §6 FIRST if it is in the list: the "
              "positive control is what")
        print("  licenses reading the check row at all (doctrine 76). Repin "
              "with the date and")
        print("  keep the superseded value visible (doctrine 17); do not tune "
              "to meet a pin.")
    print()
    print("RESULT:", "FAIL" if bad else ("CANNOT TELL" if untold else "PASS"))
    return 1 if bad else (2 if untold else 0)


def run_all(idx=None):
    """Every producer, one index, -> the measured dict `check_pins` reads.

    REFUSES rather than half-measures if the declared corpus is not on disk:
    a missing population is not a moved figure, and collapsing the two into
    one exit code is doctrine 20's own failure mode (the shape
    `audit_kalevala_null.py` writes out at its `series` guard).
    """
    if idx is None:
        if not os.path.isdir(SONG):
            print(f"REFUSED — the declared population is not on disk: {SONG}")
            print("  Nothing was measured, so nothing moved.")
            sys.exit(2)
        idx = PhraseIndex()
        if not idx.files:
            print(f"REFUSED — {SONG} holds no eng_*.txt file.")
            print("  Nothing was measured, so nothing moved.")
            sys.exit(2)
    m = measure(idx)
    m.update(nulls(idx))          # returns {} and says so if the tagger is out
    m.update(period(idx))
    m["scaling"] = scaling(idx)
    return m


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("file", nargs="?")
    ap.add_argument("--measure", action="store_true")
    ap.add_argument("--nulls", action="store_true",
                    help="§5 — the two randomisations (doctrines 63, 68, 69)")
    ap.add_argument("--period", action="store_true",
                    help="§6 — period-reading and its positive control")
    ap.add_argument("--scaling", action="store_true",
                    help="§9 — the sparsity scaling table")
    ap.add_argument("--check", action="store_true",
                    help="every producer against its pin; "
                         "exit 0 pass / 1 moved / 2 cannot tell")
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("-n", type=int, default=4)
    ap.add_argument("-k", type=int, default=2)
    ap.add_argument("--force", action="store_true",
                    help="reach the instrument past its refusal")
    a = ap.parse_args(argv)

    if a.self_test:
        return 0 if self_test() else 1
    if a.check:
        return check_pins(run_all())
    if a.measure or a.nulls or a.period or a.scaling:
        idx = PhraseIndex()
        if a.measure:
            measure(idx)
        if a.nulls:
            nulls(idx)
        if a.period:
            period(idx)
        if a.scaling:
            scaling(idx)
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

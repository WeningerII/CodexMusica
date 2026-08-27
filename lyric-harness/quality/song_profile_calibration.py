#!/usr/bin/env python3
"""Re-derive the `song` profile in quality/floor.py from corpus/song/.

    python3 quality/song_profile_calibration.py             # the full report
    python3 quality/song_profile_calibration.py --check     # numbers only, exit 1 on drift
    python3 quality/song_profile_calibration.py --seeds 50  # faster, wider intervals
    python3 quality/song_profile_calibration.py --sample 400  # bounded, NO VERDICT, exit 3
    python3 quality/song_profile_calibration.py --check --without-predictability
                                                # ~75 CPU-s cold; judges 15
                                                # of 20 constants, refuses 5
                                                # (was 13 of 18 until the
                                                #  CLICHE_PAIR FPR joined
                                                #  2026-08-14)
    python3 quality/song_profile_calibration.py --no-cache  # recompute every item

WHAT IT COSTS, AND WHY THAT IS THE FIRST THING THIS FILE SAYS. A drift
detector nobody can afford to run is decoration (doctrine 48), so the cost is
a declared, measured, dated coordinate here, exactly like every threshold
below it.

  COLD (nothing cached, the state a fresh clone is in):
      --check    2.0-2.2 CPU-hours   PROJECTED 2026-08-13, see below
      full run   2.0-2.2 CPU-hours   (sections 3 and 5 add ~9 CPU-s)
  WARM (this run's cache fingerprint matches the last run's):
      --check    ~85 CPU-s   MEASURED 2026-08-13 at reduced --seeds/--draws
      full run   ~95 CPU-s   and extrapolated over the two linear loops
  PARTIAL, and it needs no cache at all (--without-predictability, 4 checks):
      --check    ~75 CPU-s   MEASURED 2026-08-13: 53.9 CPU-s at --seeds 30
                             --draws 200, over the whole 4,930-item corpus

  REPINNED 2026-08-13. This docstring said "on the order of an hour" from
  2026-08-12 until now, and observed `--check` runs took 2.5-4 hours -- so the
  figure was wrong by more than a factor of two in the one place a reader is
  invited to trust it, and the check went unrun for exactly that reason. The
  old figure stays visible here rather than being overwritten, the same way
  every superseded number in this repo does.

  WHAT WAS WRONG WITH IT IS DOCTRINE 58, PRECISELY. The RATE it quoted was
  right and reproduces: "~0.5-0.8s per DISTINCT end word" measures 0.64 CPU-s
  (se 0.04, uniform sample of 100). The COUNT it multiplied that rate by was
  never written down anywhere, and it was wrong -- "a few thousand distinct
  end words" is 11,941, counted. A rate nobody could check, against a count
  nobody had taken, is exactly the shape of threshold this file was written to
  abolish, sitting in this file's own docstring.

  HOW THE FIGURE WAS ARRIVED AT, and it IS a projection -- a full cold run was
  deliberately not sat through. The unit of work is not the item and not even
  the end word: `RhymeField.field(w)` scores `w` against every candidate in
  the nucleus buckets near its own, and THAT count is derivable without doing
  the work. Summed over all 11,941 distinct call words it is exactly
  331,604,100 candidate scorings. So:

      T_pred = 331,604,100 * c_score      c_score = 21-23 microseconds
             = 7,100-7,700 CPU-s
      T_cold = T_pred + P*c_pair + T_rest
             = ~7,400 + 75,397*0.0019 + ~85    = ~7,600 CPU-s = 2.1 h

  The work count is EXACT. c_score was measured three independent ways and
  they agree: 23.2 us from a uniform sample of 100 distinct words, 21.3 us
  from a real cold run over 20 randomly drawn ITEMS, and 21.2 us from a real
  cold `--sample 12` (79.7 CPU-s / 112 distinct calls). T_rest was measured
  directly at reduced --seeds/--draws and extrapolated linearly, which is
  exact for those two -- both are `for _ in range(n)` loops with a constant
  body.

  ONE TRAP WORTH RECORDING, because the obvious validation gets it wrong.
  Timing a sample of ITEMS and dividing by the distinct words it touched reads
  0.72 CPU-s per word against the uniform sample's 0.64, which looks like a
  12% modelling error and is not one: end words reached by drawing items are
  size-biased toward common words, which sit in the biggest nucleus buckets.
  Measured, not argued -- item-drawn words score 33,534 candidates each
  against the population's 27,770, a ratio of 1.21, while the uniform sample
  stood in for the whole population at 0.991. Per CANDIDATE the two agree, and
  the candidate is the thing that costs. A per-item validation would have
  talked this file into a 15% overestimate.

  WALL-CLOCK IS NOT THE UNIT and neither figure above is one. The machine this
  was calibrated on was descheduled about 4.7x (200s wall against 52s CPU on a
  known workload), so its own wall reading for a cold run is ~10 h and means
  nothing anywhere else. Every run now prints a PHASE COST block with wall AND
  CPU per phase, so the next reader measures instead of recalling.

WHY THIS FILE EXISTS. The song profile ships five thresholds, a token band, a
tolerance, six false-positive rates and a period slope. Every one of those is
a coordinate of a setting, and a number whose setting lives only in a scratchpad
is a threshold nobody wrote down (doctrine 58). So the profile's constants are
re-derivable by one command, and `--check` compares what floor.py ships against
what the corpus says today. If a corpus cell stages a file, this drifts and says
so, which is the whole point: `corpus/song/` is volatile by design.

WHAT IS AND IS NOT INDEPENDENT HERE.

  * Held out BY AUTHOR (= by file; the 143 English files carry 143 distinct
    `# author:` headers). Items by one author are not independent of each other,
    so an item-level split scores a cell with a resource that is not independent
    of it (doctrine 13). The item-level split is computed anyway, and reported,
    purely to price what the wrong split would have bought.
  * Every rate off a randomised split is reported as a distribution over seeds,
    never as one draw (doctrine 73).
  * `predictability` DOES now read the frequency layer, and it is the one
    check here that does: `quality.features.QualityFeatures._predictability`,
    scored through `RhymeField`, which is built on `Lexicon.freq_rank` --
    `data/opensubtitles_en_50k.tsv` since the 2026-08-11 swap this file used
    to say blocked it. It is real corpus scoring, not the other four checks'
    plain string/POS arithmetic, and it is where ~96% of this script's cost
    goes -- see the cost block at the top, and the CACHE note below it.
    `population(with_predictability=False)` skips it for a fast four-check
    pass, and `--without-predictability` is that pass at the command line;
    every other invocation computes all five.
  * The two lyrics in `examples/` are not in `corpus/song/` -- checked by
    normalised line overlap, 0 of 27 and 0 of 37 -- so the profile scores them
    without having seen them. `quality/test_floor.py` test 17 pins that.

WHAT THE CACHE DOES AND DOES NOT CHANGE. `predictability_frac(qf, body)` is a
pure function of the item's own bytes and of the comparator (cmudict, the
frequency table, `Declaration`, the scoring code) -- `corpus/song/` decides
WHICH items are asked, never what any one of them answers. So the answers are
stored, keyed by a hash of the item and guarded by a fingerprint of every one
of those inputs, and a run whose fingerprint matches reads them back instead
of recomputing 331 million identical candidate scorings. A hit returns the same
float a miss would compute -- bit-identical, by construction, and
`--verify-cache N` re-derives N cached items the slow way and prints any
disagreement rather than asserting there is none. RUN 2026-08-13 on a real
12-item draw: cold 79.7 CPU-s, warm 2.3 CPU-s for the same rows, and 12 of 12
re-derived (a further 75.3 CPU-s, i.e. the full cold arithmetic again) with 0
disagreements. A fingerprint MISMATCH
discards the whole file loudly and recomputes; it never silently half-trusts
one. Nothing about the measurement changes: same items, same corpus, same
tolerances, same thresholds. The cache is written incrementally, so a cold run
that is interrupted keeps its progress and the next one resumes -- the 2.1
CPU-hours are payable in chunks, and payable once.

WHAT WAS MEASURED AND NOT DONE, so it is not re-proposed as new. Restricting
the expensive feature to items that can ever land in a band (nothing outside
50-1000 tokens can reach one in `--check`) removes 796 of the 11,941 distinct
end words: 6.7% of the cost. It is not taken. A pruned item carries NaN, and
NaN is already load-bearing here in two OPPOSITE directions -- `thresholds()`
filters it out as a non-measurement, `fpr()` counts it as a true negative --
so a row skipped for cost would be indistinguishable from a row that genuinely
could not be scored, in a file where that distinction decides numbers. 6.7% is
not worth buying a silent one.

WHAT `--sample N` IS, AND WHAT IT REFUSES TO BE. It scores N randomly drawn
items instead of all 4,930 and prints exactly what it drew (N, the seed, the
surviving authors, the distinct end words actually scored). It CANNOT
certify agreement with floor.py: a 5th percentile over a few hundred items is
a different statistic from one over 1,859, and calling a sampled agreement a
pass would be inconclusive-by-construction reported as a result (doctrine 20).
So it prints every comparison with the shipped constant, prints the resampling
spread that says which of those deltas its own size could even resolve, gives
NO verdict, and exits **3** -- never 0, never 1. `--check` exits 0/1 only from
a full population.

WHAT `--without-predictability` IS, AND WHY IT IS THE ONE TO PUT IN CI. It is
the opposite trade from `--sample`: instead of asking all five checks of a
FRACTION of the corpus, it asks four of them of ALL of it. Those four are the
whole of what the profile shipped before 2026-08-13 and they cost ~75 CPU-s
from cold with no cache at all, because none of them touches `RhymeField`.
Their answers are EXACT -- not sampled, not interpolated -- so the mode can
genuinely FAIL on drift, which is what a gate has to be able to do and what
`--sample` can never do. It refuses five of the nineteen shipped constants and
names all five (`DROPPED_BY_NO_PRED`): the band, whose selection rule reads
every check's sub-bin homogeneity and is therefore a DIFFERENT rule with four;
`predictability`'s own threshold and FPR; and the union FPR, which over four
checks is not the shipped union over five and can only be lower. It exits 0 on
a clean run and says PARTIAL PASS with the counts on the same line, so a green
tick cannot be mistaken for a full check.

WHAT THIS CANNOT SAY. There is no generated song class in this repo, so there
is no separation, no AUC, and no claim that any of these checks detects machine
text. An FPR on human song says how often the gate interrupts a human
songwriter and nothing else (doctrine 22). And the corpus is pre-1931 by
construction: latest birth 1872, latest death 1929. Section 4 measures period
drift INSIDE that window; it cannot measure drift to 2026 and does not try.
"""

import argparse
import datetime
import glob
import hashlib
import inspect
import os
import random
import re
import statistics
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

import lyric_harness  # noqa: E402
import quality.features  # noqa: E402
from quality.features import FUNCTION_TAGS, QualityFeatures, _tagger  # noqa: E402
from quality.floor import FloorDeclaration, PROFILES, SlopFloor  # noqa: E402

ROOT = os.path.join(HERE, "..")

#: THE DECLARED POPULATION.  Named once so `corpus_manifest.py` can ASK this
#: module which files it measures instead of re-typing the glob: a second
#: copy of a population is a second definition of the question (doctrine 1),
#: and the copy is what goes stale when a load stages a new language prefix.
CORPUS_GLOB = os.path.join("corpus", "song", "eng_*.txt")


def corpus_files(root=None):
    """-> the sorted paths this calibration measures."""
    return sorted(glob.glob(os.path.join(root or ROOT, CORPUS_GLOB)))

#: The item unit and the marker rule are quality/audit_corpus.py's, verbatim,
#: so this and the corpus audit cannot disagree about what an item is.
_MARKER = re.compile(r"^(#|--- |\[)")

#: MATTR's window, READ OFF THE SHIPPED DECLARATION rather than left to
#: `_mattr`'s own default. This file computes the `mattr` percentile that
#: `floor.PROFILES`' `song` entry ships, so if the two ever disagreed about
#: the window, `--check` would be comparing a threshold against a different
#: statistic and would report agreement or drift for the wrong reason. Taking
#: it from `FloorDeclaration` makes that disagreement impossible to have.
#: The window itself is a coordinate with a sweep behind it -- see
#: `quality.floor.CALIBRATION["mattr_window"]`; every song-band item is
#: 150-400 tokens, comfortably past 50, so every `mattr` below IS a genuine
#: moving average (unlike the `section` profile's, which is plain TTR).
MATTR_WINDOW = FloorDeclaration().mattr_window

#: (feature, side, percentile). "lo" flags below the 5th, "hi" above the 95th.
#: `predictability` closes the gap this file's own module docstring names:
#: the fifth floor threshold with no song reading, blocked on the frequency
#: layer this project swapped 2026-08-11 (`Lexicon.freq_rank` now reads
#: `data/opensubtitles_en_50k.tsv`) and never recalibrated since. It is a
#: "hi" 0.95 check exactly like `fwr`/`anaphora`: `predictable_pair_
#: fraction_max` is a ceiling on how much of an item's rhyme is obvious.
CHECKS = [("mattr", "lo", 0.05), ("fwr", "hi", 0.95),
          ("anaphora", "hi", 0.95), ("cv", "lo", 0.05),
          ("predictability", "hi", 0.95)]

#: floor.py's key for each of them.
FLOOR_KEY = {"mattr": "mattr_min", "fwr": "function_word_ratio_max",
             "anaphora": "anaphora_max", "cv": "line_length_cv_min",
             "predictability": "predictable_pair_fraction_max"}

#: The band-selection rule, declared here so it is visible before its answer.
#: (i) every 50-token sub-bin inside [lo, hi] holds >= MIN_BIN items -- a 5th
#: percentile needs somewhere to sit (doctrine 72); (ii) every sub-bin's own
#: threshold stays within HOM of the band-wide one, because a threshold that
#: moves across its own band is two profiles reported as one, which is the
#: defect doctrine 15 names; (iii) the band is the WIDEST contiguous range
#: satisfying both. HOM is 0.03 on anaphora because that is one line's worth on
#: a 33-line item, the coarsest the statistic resolves.
#: `predictability`'s tolerance is coarser than the other four's because its
#: RESOLUTION is coarser: it is a fraction of an item's PAIRS, not of its
#: lines or tokens, and a typical item in the band has on the order of 7-12
#: pairs, so one pair's worth of movement is already 0.08-0.14. 0.05 is
#: still tighter than that floor, not a number chosen to make the band pass.
HOM = {"mattr": 0.02, "fwr": 0.02, "cv": 0.02, "anaphora": 0.03,
       "predictability": 0.05}
BIN, MIN_BIN, MIN_BAND_N = 50, 100, 300
EDGES = list(range(50, 1001, BIN))

#: Default sample seed, DECLARED rather than left to the clock, so a `--sample`
#: run reproduces and two people quoting one can be talking about the same draw.
SAMPLE_SEED = 20260813

#: Exit codes. 0/1 are `--check`'s existing pass/drift contract and do not
#: move. 3 is new and is the only code a `--sample` run can produce: a caller
#: in a pipeline has to be able to tell "no drift" from "not asked" from "asked
#: and could not answer", and collapsing the third into either of the first two
#: is doctrine 20's exact failure (2 is left to argparse's usage errors).
EXIT_OK, EXIT_DRIFT, EXIT_NO_VERDICT = 0, 1, 3


# ---------------------------------------------------------------------------
# cost: the deterministic intermediate, cached
#
# ~96% of a cold run is `RhymeField.field()` over 11,941 distinct end words
# (see the cost block in the module docstring). None of that work depends on
# `corpus/song/`: the corpus decides which words get ASKED, and the lexicon,
# the frequency table and the `Declaration` decide what each one ANSWERS. So
# the answer is memoized on disk, and the memo is guarded by a fingerprint of
# every input that can change an answer. This is a cache of a deterministic
# intermediate, not a shortcut through the measurement -- the alternative
# moves (score fewer items, widen a tolerance, move a threshold) all change
# what the check MEANS and none of them are taken here.
# ---------------------------------------------------------------------------

CACHE_VERSION = 1
DEFAULT_CACHE = os.path.join(
    os.environ.get("XDG_CACHE_HOME",
                   os.path.join(os.path.expanduser("~"), ".cache")),
    "lyric-harness", "song_predictability_v%d.tsv" % CACHE_VERSION)


def _sha256(*chunks):
    h = hashlib.sha256()
    for c in chunks:
        h.update(c if isinstance(c, bytes) else c.encode("utf-8"))
        h.update(b"\0")
    return h.hexdigest()


def comparator_fingerprint():
    """Everything that can change what `predictability_frac` answers.

    Deliberately OVER-inclusive on the two comparator modules: a whole-file
    hash of `lyric_harness.py` and `quality/features.py` means editing a
    comment in either throws away a 2.1-CPU-hour cache. That is the correct
    direction to be wrong in -- a stale hit is a wrong number reported as a
    measurement, and this repo has already been bitten by a rate that was a
    coordinate of a comparator that had moved underneath it (CLAUDE.md, Test
    discipline, on the Whitman figures). Recomputing costs time; trusting a
    moved comparator costs the result.

    THIS file is included only by the two functions that define the QUESTION
    -- `predictability_frac` (whose source carries its own 0.90 cutoff) and
    `_couplet_pairs` -- and not as a whole file, because the rest of it is reporting: an edit
    to a print statement in section 4 cannot change what an item scores, and
    invalidating on one would make the cache useless in a file under active
    edit, which is doctrine 48's failure mode wearing a different hat.
    """
    parts = []
    for p in (lyric_harness.__file__, quality.features.__file__,
              lyric_harness.CMUDICT_PATH, lyric_harness.FREQ_PATH):
        try:
            with open(p, "rb") as fh:
                parts.append(os.path.basename(p) + ":"
                             + hashlib.sha256(fh.read()).hexdigest())
        except OSError:
            # A missing input is a real state (no cmudict yet) and it must
            # hash DIFFERENTLY from a present one, not crash the fingerprint.
            parts.append("ABSENT:" + os.path.basename(p))
    parts.append(repr(lyric_harness.Declaration()))
    parts.append(inspect.getsource(predictability_frac))
    parts.append(inspect.getsource(_couplet_pairs))
    return _sha256(*parts)


def item_key(body):
    """A cache key for one item: the exact sung lines, nothing else."""
    return _sha256("\n".join(body))[:32]


class PredictabilityCache:
    """Persistent memo for `predictability_frac`, fingerprint-guarded.

    Every run PRINTS what it did with this file (path, fingerprint, hits,
    misses, and whether an existing file was discarded as stale). A run that
    silently read a cache would be a number whose provenance lives in
    somebody's home directory, which is the shape of defect this whole script
    exists to remove (doctrine 58).

    The fingerprint is the whole design, and doctrine 16 is why: an unguarded
    memo does not fail safe, it fails toward WHOEVER RAN IT LAST -- their
    lexicon, their frequency table, their edit to `score()` -- and it does so
    silently, in the file that decides whether floor.py's thresholds still
    hold. So the guard is over-inclusive by construction and the failure mode
    is a wasted recomputation, never a stale number wearing a measurement's
    clothes.
    """

    def __init__(self, path=DEFAULT_CACHE, enabled=True, flush_every=200,
                 why_off=""):
        self.path, self.enabled, self.flush_every = path, enabled, flush_every
        self.entries, self.fp, self.why_off = {}, None, why_off
        self.hits = self.misses = self.pending = 0
        self.status = "disabled"

    def open(self):
        self.fp = comparator_fingerprint()
        if not self.enabled:
            self.status = self.why_off or "disabled"
            return self
        if not os.path.exists(self.path):
            self.status = "new (no file yet)"
            return self
        try:
            with open(self.path, encoding="utf-8") as fh:
                head = {}
                for line in fh:
                    if line.startswith("#"):
                        k, _, v = line[1:].rstrip("\n").partition("\t")
                        head[k] = v
                        continue
                    k, _, v = line.rstrip("\n").partition("\t")
                    if k and v:
                        self.entries[k] = float(v)
                if head.get("version") != str(CACHE_VERSION):
                    self.entries, self.status = {}, (
                        "DISCARDED: version %s, this build writes %d"
                        % (head.get("version"), CACHE_VERSION))
                elif head.get("fingerprint") != self.fp:
                    self.entries, self.status = {}, (
                        "DISCARDED: comparator fingerprint moved (file %s, "
                        "now %s) -- recomputing from scratch"
                        % ((head.get("fingerprint") or "?")[:12], self.fp[:12]))
                else:
                    self.status = ("read %d entries, written %s"
                                   % (len(self.entries),
                                      head.get("written", "?")))
        except (OSError, ValueError) as e:
            self.entries, self.status = {}, "DISCARDED: unreadable (%s)" % e
        return self

    def get(self, body):
        if not self.enabled:
            return None
        v = self.entries.get(item_key(body))
        if v is None:
            self.misses += 1
        else:
            self.hits += 1
        return v

    def put(self, body, value):
        if not self.enabled:
            return
        self.entries[item_key(body)] = value
        self.pending += 1
        if self.pending >= self.flush_every:
            self.flush()

    def flush(self):
        """Rewrite atomically. Called every `flush_every` puts so that an
        INTERRUPTED cold run keeps its progress: the expensive half of this
        script is resumable, which is what makes 2.1 CPU-hours payable in
        chunks by someone who does not have 2.1 CPU-hours at once."""
        if not self.enabled or not self.pending:
            return
        d = os.path.dirname(self.path)
        if d:
            os.makedirs(d, exist_ok=True)
        tmp = self.path + ".tmp%d" % os.getpid()
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write("#version\t%d\n" % CACHE_VERSION)
            fh.write("#fingerprint\t%s\n" % self.fp)
            fh.write("#written\t%s\n"
                     % datetime.datetime.now().replace(microsecond=0).isoformat())
            for k in sorted(self.entries):
                fh.write("%s\t%r\n" % (k, self.entries[k]))
        os.replace(tmp, self.path)
        self.pending = 0

    def report(self):
        print("CACHE  %s\n       fingerprint %s | %s | hits %d, misses %d"
              % (self.path if self.enabled else "(off)", (self.fp or "?")[:12],
                 self.status, self.hits, self.misses))


class Scorer:
    """`predictability_frac` with the cache in front of it, and a LAZY
    `QualityFeatures`.

    Lazy on purpose: building one costs ~15s and a ~20k-entry rhyme index, and
    a fully warm run never needs it at all. A cache hit is bit-identical to
    the miss it replaces -- same function, same arguments -- and
    `verify_cache()` re-derives a random subset the slow way rather than
    leaving that as an assertion in a comment (doctrine 48).
    """

    def __init__(self, cache, qf=None):
        self.cache, self._qf = cache, qf

    @property
    def qf(self):
        if self._qf is None:
            self._qf = QualityFeatures()
        return self._qf

    def frac(self, body):
        hit = self.cache.get(body)
        if hit is not None:
            return hit
        v = predictability_frac(self.qf, body)
        self.cache.put(body, v)
        return v


def verify_cache(scorer, bodies, n, seed=SAMPLE_SEED):
    """Re-derive `n` cached items the expensive way; print any disagreement.

    -> (checked, disagreements). NOT cheap -- a re-derivation is a real cold
    `field()` sweep over that item's end words, roughly 6 CPU-s each -- but it
    is the only thing that turns "a hit is identical by construction" from a
    claim into a measurement, and N is the caller's to choose.
    """
    # read `entries` directly, NOT through .get(), so verification does not
    # pollute the hit/miss counts the run reports for its real lookups
    have = [b for b in bodies if item_key(b) in scorer.cache.entries]
    if not have:
        print("VERIFY-CACHE  nothing cached to verify")
        return 0, 0
    rnd = random.Random(seed)
    sel = rnd.sample(have, min(n, len(have)))
    bad = 0
    for b in sel:
        cached = scorer.cache.entries[item_key(b)]
        fresh = predictability_frac(scorer.qf, b)
        same = (cached == fresh) or (cached != cached and fresh != fresh)
        if not same:
            bad += 1
            print("   DISAGREES  %s cached %r fresh %r"
                  % (item_key(b)[:12], cached, fresh))
    print("VERIFY-CACHE  %d of %d cached items re-derived, %d disagreements"
          % (len(sel), len(have), bad))
    return len(sel), bad


# ---------------------------------------------------------------------------
# the population
# ---------------------------------------------------------------------------

def items_in(path):
    cur, body, out = None, [], []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for l in fh:
            s = l.rstrip()
            if s.startswith("--- TITLE:"):
                if cur is not None:
                    out.append((cur, body))
                cur, body = s[10:].strip(), []
            elif cur is not None and s.strip() and not _MARKER.match(s):
                body.append(s.strip())
    if cur is not None:
        out.append((cur, body))
    return out


def author_of(path):
    a = ""
    with open(path, encoding="utf-8", errors="replace") as fh:
        for l in fh:
            if not l.startswith("#"):
                break
            if l.startswith("# author:"):
                a = l[9:].strip()
    # FOUR DIGITS, NOT THREE. `\d{3,4}` read Thomas Heywood's printed
    # `(157?-1650)` as BORN IN THE YEAR 157 and Giles Fletcher's `(158?-`
    # as 158 -- a ~1,400-year error on the very axis section 4
    # correlates against, silently, from whichever staging first
    # introduced an approximate date. A three-digit run before a `?` is a
    # TRUNCATED year, not a small one; it is the same class as the HBV
    # safe-subset gate's `186?--`, one module over, and the same answer:
    # unreadable, so the author is UNDATED and section 4 drops it with
    # the count reported. Verified before tightening -- every 3-digit
    # match in `corpus/song/eng_*` is a truncated date (`157?`, `158?`,
    # `187 `) and this corpus holds no genuine pre-1000 birth year, so
    # the stricter read loses no real author.
    m = re.search(r"\((\d{4})\??\s*[-–—]\s*(\d{4})", a)
    return a, (int(m.group(1)) if m else None), (int(m.group(2)) if m else None)


def n_all_items():
    """Every `--- TITLE:` item with a non-empty body, counted cheaply.

    A `--sample` run has to report N of WHAT, and the denominator has to come
    off the corpus rather than out of a docstring that could go stale the same
    way this file's runtime figure did.
    """
    return sum(1 for p in corpus_files()
               for _, body in items_in(p) if body)


def anaphora(lines):
    """floor.SlopFloor._anaphora's rate, with its first-occurrence tie break
    (doctrine 66 -- iterating a set is iterating a randomised hash order)."""
    firsts = [(l.split() or [""])[0].lower().strip(",.;:!?—-") for l in lines]
    if not firsts:
        return 0.0
    first_at = {}
    for i, w in enumerate(firsts):
        first_at.setdefault(w, i)
    top = min(firsts, key=lambda w: (-firsts.count(w), first_at[w]))
    return firsts.count(top) / len(firsts)


def line_cv(lines):
    n = [len(l.split()) for l in lines]
    if not n:
        return 0.0
    m = statistics.mean(n)
    return (statistics.pstdev(n) / m) if m else 0.0


#: floor.SlopFloor._pairs' own fallback, verbatim: no corpus item declares a
#: mandate, so every item is read as naive adjacent couplets, the same shape
#: a live, mandate-less call to `check()` would use.
def _couplet_pairs(lines):
    return [(i, i + 1) for i in range(0, len(lines) - 1, 2)]


def predictability_frac(qf, lines, obvious_cutoff=0.90):
    """floor.py's own PREDICTABLE_RHYME computation, verbatim: the fraction
    of an item's pairs whose answer sits above `obvious_cutoff` in its own
    frequency-ranked candidate field.

    Returns NaN, not 0.0, when no pair resolves (every end word OOV, or the
    item is one line). NaN is the honest value: 0.0 would claim "this item's
    rhyme was measured and found unpredictable," when what actually happened
    is nothing here could be scored at all. `thresholds()` filters NaN out of
    the percentile it computes FROM (a non-measurement cannot inform what a
    normal value looks like); `fpr()` needs no filter at all, because a NaN
    comparison is False either direction in Python, which is exactly "this
    check does not fire on an item it cannot read" -- the same behaviour
    `floor.py`'s live `if preds:` guard gives a real draft.
    """
    preds = [v for _i, _j, v
             in qf._predictability(lines, _couplet_pairs(lines))]
    if not preds:
        return float("nan")
    obvious = [p for p in preds if p > obvious_cutoff]
    return len(obvious) / len(preds)


def population(verbose=True, qf=None, with_predictability=True, scorer=None,
               sample=None, sample_seed=SAMPLE_SEED):
    """-> ([row], scorer), one row per `--- TITLE:` item in corpus/song/eng_*.txt.

    `qf`/`scorer` let a caller share one `QualityFeatures` (and its
    `RhymeField` index, and the on-disk memo) across a run instead of
    rebuilding it; `with_predictability=False` skips the expensive fifth
    feature entirely for callers who only want the original four (a COLD
    `RhymeField` lookup is 0.64-0.72 CPU-s per DISTINCT end word against the
    ~20k-entry index -- fine for one song, ~2.1 CPU-hours over the corpus's
    11,941 of them, and the other four checks owe nothing to it).

    `sample=N` draws N items at random, BEFORE any of them is scored, which is
    the only place a sample can save anything. It is a bounded run and it says
    so everywhere it reports; see the module docstring for what it refuses.
    """
    tag = _tagger()
    tok = QualityFeatures._tokens
    if scorer is None:
        scorer = Scorer(PredictabilityCache(enabled=False).open(), qf)
    elif qf is not None and scorer._qf is None:
        scorer._qf = qf
    files = corpus_files()
    raw = []
    for p in files:
        a, born, died = author_of(p)
        base = os.path.basename(p)
        for title, body in items_in(p):
            if body:
                raw.append((base, a, born, died, title, body))
    n_all = len(raw)
    if sample is not None and sample < n_all:
        raw = random.Random(sample_seed).sample(raw, sample)
    rows = []
    for base, a, born, died, title, body in raw:
        per = [tok(l) for l in body]
        words = [w.lower() for t in per for w in t]
        if not words:
            continue
        flat = [(w.lower(), tg) for t in per for w, tg in tag(t)]
        rows.append({
            "file": base, "author": a, "born": born, "died": died,
            "title": title, "n_lines": len(body), "n_tokens": len(words),
            "mattr": QualityFeatures._mattr(words, MATTR_WINDOW),
            "fwr": (sum(1 for _, tg in flat if tg in FUNCTION_TAGS)
                    / len(flat)) if flat else float("nan"),
            "predictability": (scorer.frac(body)
                               if with_predictability else float("nan")),
            "anaphora": anaphora(body), "cv": line_cv(body),
            # kept so --verify-cache can re-derive an item without re-parsing
            # the corpus; nothing statistical reads it
            "_body": body})
    scorer.cache.flush()
    if verbose:
        print("POPULATION  %d files, %d distinct authors, %d items, "
              "%d sung lines"
              % (len({r["file"] for r in rows}),
                 len({r["author"] for r in rows}), len(rows),
                 sum(r["n_lines"] for r in rows)))
        if sample is not None:
            # Say what fraction of the WORK this was, not only what fraction
            # of the items: the expensive unit is the distinct end word, and
            # distinct words saturate, so N/4930 of the items is never N/4930
            # of the cost and quoting the item ratio alone would flatter it.
            calls = set()
            for _, _, _, _, _, body in raw:
                for i, j in _couplet_pairs(body):
                    if i < len(body) and j < len(body):
                        c, ans, _k = QualityFeatures._strip_radif(body[i],
                                                                  body[j])
                        if c and ans:
                            calls.add(c)
            print("            SAMPLED %d of %d items at seed %d -- %d of the "
                  "%d files survive the draw, and %d distinct end words of the "
                  "corpus's 11,941 get scored. This is a BOUNDED run: every "
                  "number below is a statistic of the sample, and section 6 "
                  "gives no verdict (doctrine 20)."
                  % (len(rows), n_all, sample_seed,
                     len({r["file"] for r in rows}), len(files), len(calls)))
    return rows, scorer


# ---------------------------------------------------------------------------
# statistics
# ---------------------------------------------------------------------------

def q(v, p):
    v = sorted(v)
    if not v:
        return float("nan")
    i = (len(v) - 1) * p
    lo = int(i // 1)
    return v[lo] + (v[min(lo + 1, len(v) - 1)] - v[lo]) * (i - lo)


def band(rows, lo, hi):
    return [r for r in rows if lo <= r["n_tokens"] <= hi]


def thresholds(items):
    """A percentile per check, over items that actually carry a value.

    Every existing check (mattr/fwr/anaphora/cv) is defined on every item, so
    the NaN filter below is a no-op for them. `predictability` is not: an
    item whose rhyme pairs are all unreadable (OOV end words, or a single
    line with none) is a non-measurement, and a percentile is a statement
    about what NORMAL looks like, so a non-measurement cannot be counted
    into it -- unlike `fpr()`, below, which treats the identical NaN as a
    true negative because that IS what a live, mandate-less `check()` does
    with it.
    """
    return {f: q([v for r in items if (v := r[f]) == v], p)
            for f, _, p in CHECKS}


def fpr(items, thr):
    """-> {check: rate}, plus 'ANY', the union over the four."""
    keys = [c[0] for c in CHECKS]
    if not items:
        return {k: float("nan") for k in keys + ["ANY"]}
    hits = dict.fromkeys(keys, 0)
    anyh = 0
    for r in items:
        f = {k: (r[k] < thr[k] if s == "lo" else r[k] > thr[k])
             for k, s, _ in CHECKS}
        for k in keys:
            hits[k] += f[k]
        anyh += any(f.values())
    out = {k: hits[k] / len(items) for k in keys}
    out["ANY"] = anyh / len(items)
    return out


def cliche_fires(body, _floor=[]):
    """Does `floor.SlopFloor`'s CLICHE_PAIR fire on this item?

    Asked of the LIVE gate rather than reimplemented, unlike the four checks
    above it: `anaphora`/`line_cv` are three-line statistics this file copies
    verbatim so the copy is auditable, but CLICHE_PAIR rides `_strip_radif`,
    the radif-licensing rule and a declared 30-pair list, and a second copy of
    that would be a second thing to keep in step. The naive adjacent-couplet
    pairing is `_couplet_pairs`' own, which is `SlopFloor._pairs`' fallback --
    no corpus item declares a mandate.

    NO SEVERITY IS READ HERE, on purpose. This measures how often the CHECK
    FIRES on held-out human song in the band, which is the quantity
    `floor.py`'s `held_out_fpr["cliche"]` ships; whether the gate is then
    ALLOWED to emit it as a flag is a length question `sev()` answers, and
    inside this band the two coincide by construction.
    """
    if not _floor:
        _floor.append(SlopFloor())
    f = _floor[0]
    return any(x.code == "CLICHE_PAIR"
               for x in f._relation_findings(body, _couplet_pairs(body)))


def cliche_held_out(items, seeds, key="file"):
    """-> ([rate] over `seeds` 50/50 splits as PROPORTIONS, n firing overall).

    Its own function because CLICHE_PAIR has NO THRESHOLD: `author_held_out`
    fits a percentile on the calibration half and scores the held-out half
    with it, and there is nothing here to fit. What the split still buys is
    the SPREAD -- 200 draws of "half the authors" is what makes the reported
    interval an author-level one rather than an item-level one (doctrine 13),
    and one draw is a coin flip reported as a verdict (doctrine 73).

    The per-item answer is computed ONCE, before the seed loop. It is a pure
    function of the item's own bytes and of the declared list, so scoring it
    inside 200 splits would be the same 186,000 answers to 1,859 questions.
    Returned alongside the rates so the caller's point estimate is the SAME
    per-item answers the interval is built from, rather than a second pass
    that could silently disagree with it.
    """
    scored = [(r[key], cliche_fires(r["_body"])) for r in items]
    keys = sorted({k for k, _ in scored})
    rates = []
    for s in range(seeds):
        rnd = random.Random(s)
        sh = keys[:]
        rnd.shuffle(sh)
        cal = set(sh[:len(sh) // 2])
        h = [hit for k, hit in scored if k not in cal]
        if len(h) < 50:
            continue
        rates.append(sum(h) / len(h))
    return rates, sum(hit for _, hit in scored)


def author_held_out(items, seeds, key="file"):
    """-> [(thresholds, fpr)] over `seeds` 50/50 splits of the given key."""
    keys = sorted({r[key] for r in items})
    runs = []
    for s in range(seeds):
        rnd = random.Random(s)
        sh = keys[:]
        rnd.shuffle(sh)
        cal = set(sh[:len(sh) // 2])
        c = [r for r in items if r[key] in cal]
        h = [r for r in items if r[key] not in cal]
        if len(c) < 50 or len(h) < 50:
            continue
        # thresholds(c) was computed TWICE here (once for the tuple, once
        # inside the fpr call) for every seed of every split. Identical input,
        # identical output, half the work thrown away -- no number moves.
        t = thresholds(c)
        runs.append((t, fpr(h, t)))
    return runs


def spearman(xs, ys):
    def rank(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            for k in range(i, j + 1):
                r[order[k]] = (i + j) / 2.0 + 1
            i = j + 1
        return r
    rx, ry = rank(xs), rank(ys)
    n = len(xs)
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    dx = sum((a - mx) ** 2 for a in rx) ** 0.5
    dy = sum((b - my) ** 2 for b in ry) ** 0.5
    return num / (dx * dy) if dx and dy else 0.0


# ---------------------------------------------------------------------------
# the sections of the report
# ---------------------------------------------------------------------------

def band_ok(rows, lo, hi):
    items = band(rows, lo, hi)
    if len(items) < MIN_BAND_N:
        return False, "band n=%d < %d" % (len(items), MIN_BAND_N)
    full = thresholds(items)
    for b in range(lo, hi, BIN):
        sub = [r for r in items if b <= r["n_tokens"] < min(b + BIN, hi + 1)]
        if len(sub) < MIN_BIN:
            return False, "sub-bin %d-%d n=%d < %d" % (b, b + BIN, len(sub),
                                                       MIN_BIN)
        st = thresholds(sub)
        for f, _, _ in CHECKS:
            # NaN loses every ordinary comparison in Python, so `abs(nan -
            # x) > HOM[f]` is silently False -- exactly backwards here. A
            # sub-bin with no DECIDABLE `predictability` value (every pair
            # OOV) is not evidence of homogeneity, it is an absence of
            # evidence, and doctrine 72 treats those the same: refuse.
            if st[f] != st[f] or full[f] != full[f]:
                return False, ("sub-bin %d-%d %s has no decidable value "
                               "(NaN) to compare against the band" % (b,
                               b + BIN, f))
            if abs(st[f] - full[f]) > HOM[f]:
                return False, ("sub-bin %d-%d %s %.4f vs band %.4f, |d| %.4f "
                               "> %.2f" % (b, b + BIN, f, st[f], full[f],
                                           abs(st[f] - full[f]), HOM[f]))
    return True, "ok"


class NoBandSatisfiesTheRule(Exception):
    """No (lo, hi) in EDGES clears band_ok's rule for every declared check.

    This used to be unreachable in practice: four checks on the full
    150,000-line corpus always found the 150-400 band. `predictability`
    makes it reachable on any SMALL population, because its resolution is
    coarser (doctrine 15's own point: a check's resolution is a property of
    what it counts, and this one counts pairs, not tokens) -- a handful of
    files is not enough support for a 50-token sub-bin to hold a stable
    percentile of it. Refusing loudly here, rather than indexing into
    `None`, is the same "fails loud, not safe" the rest of this project
    insists calibration failures do (doctrine 16).
    """


def pick_band(rows, verbose=True):
    best = None
    for i, lo in enumerate(EDGES):
        for hi in EDGES[i + 1:]:
            good, _ = band_ok(rows, lo, hi)
            if good:
                w, n = hi - lo, len(band(rows, lo, hi))
                if best is None or (w, n) > (best[0], best[1]):
                    best = (w, n, lo, hi)
    if best is None:
        raise NoBandSatisfiesTheRule(
            "no (lo, hi) band cleared band_ok() over %d rows -- population "
            "too small, or one CHECK's per-sub-bin variance exceeds its "
            "HOM tolerance everywhere. Not a crash: report this, don't "
            "extrapolate a band the rule refused." % len(rows))
    if verbose:
        print("\n1. THE BAND, from the rule declared at the top of this file")
        print("   widest range satisfying it: %d-%d tokens, %d items, "
              "%d authors" % (best[2], best[3], best[1],
                              len({r["file"]
                                   for r in band(rows, best[2], best[3])})))
        for lo, hi in [(50, 400), (100, 400), (150, 400), (150, 450),
                       (200, 400), (200, 500), (100, 800)]:
            good, why = band_ok(rows, lo, hi)
            print("     %4d-%4d n=%5d  %-3s %s"
                  % (lo, hi, len(band(rows, lo, hi)), "OK" if good else "no",
                     why))
        print("   the drift the rule is refusing, 5th/95th percentile by "
              "token bin:")
        print("     %-10s %5s %8s %8s %8s %8s"
              % ("tokens", "n", "mattr5", "fwr95", "anaph95", "cv5"))
        for lo, hi in [(50, 80), (80, 110), (110, 150), (150, 200), (200, 250),
                       (250, 300), (300, 350), (350, 400), (400, 500),
                       (500, 700), (700, 1200)]:
            sel = [r for r in rows if lo <= r["n_tokens"] < hi]
            if len(sel) < 20:
                continue
            t = thresholds(sel)
            print("     %-10s %5d %8.4f %8.4f %8.4f %8.4f"
                  % ("%d-%d" % (lo, hi), len(sel), t["mattr"], t["fwr"],
                     t["anaphora"], t["cv"]))
    return best[2], best[3]


def report_fpr(rows, lo, hi, seeds):
    items = band(rows, lo, hi)
    print("\n2. THE THRESHOLDS AND THEIR HELD-OUT FALSE-POSITIVE RATE "
          "(doctrine 22)")
    print("   band %d-%d tokens: %d items, %d authors"
          % (lo, hi, len(items), len({r["file"] for r in items})))
    full = thresholds(items)
    print("   SHIPPED thresholds (5th/95th percentile of the whole band): "
          + "  ".join("%s %.4f" % (f, full[f]) for f, _, _ in CHECKS))
    out = {}
    for key, name in (("file", "AUTHOR-held out — the honest split"),
                      ("title", "item-held out — the WRONG split, priced")):
        runs = author_held_out(items, seeds, key)
        print("   %s, %d seeds, 50%% held out" % (name, len(runs)))
        if not runs:
            # Every seed was skipped for having <50 items on one side. That is
            # a REFUSAL, not an FPR of zero, and it is reachable the moment a
            # `--sample` run is small enough. Crashing in statistics.median on
            # an empty list would report the same fact as a traceback.
            print("      REFUSED: no split left >=50 items on both sides at "
                  "n=%d over %d authors. Nothing to report here (doctrine 20)."
                  % (len(items), len({r[key] for r in items})))
            for f in [c[0] for c in CHECKS] + ["ANY"]:
                out.setdefault(f, (float("nan"),) * 3)
            continue
        for f in [c[0] for c in CHECKS] + ["ANY"]:
            v = [r[1][f] for r in runs]
            m, p5, p95 = statistics.median(v), q(v, 0.05), q(v, 0.95)
            print("      FPR %-9s median %6.2f%%  [5th-95th percentile of "
                  "seeds %5.2f-%5.2f%%]  min %5.2f%% max %5.2f%%"
                  % (f, 100 * m, 100 * p5, 100 * p95, 100 * min(v),
                     100 * max(v)))
            if key == "file":
                out[f] = (round(100 * m, 2), round(100 * p5, 2),
                          round(100 * p95, 2))
    # CLICHE_PAIR, which is NOT one of the five and is NOT in "ANY".
    #
    # It reads no percentile and no length, so it is not a sixth member of the
    # union above: the band rule, the tolerance and all five thresholds were
    # chosen against those five, and folding a sixth in would silently
    # redefine the one number this profile's note quotes as "one human song in
    # five trips something". What the band DOES give it is the only population
    # its interruption rate has ever been measured on -- which is why
    # `floor.py`'s `sev()` lets it reject here and nowhere else, and why the
    # rate belongs in this profile even though the check does not.
    cl, k = cliche_held_out(items, seeds)
    if cl:
        m, p5, p95 = statistics.median(cl), q(cl, 0.05), q(cl, 0.95)
        out["cliche"] = (round(100 * m, 2), round(100 * p5, 2),
                         round(100 * p95, 2))
        print("   CLICHE_PAIR (no threshold, not in ANY), %d seeds, "
              "AUTHOR-held out" % len(cl))
        print("      FPR %-9s median %6.2f%%  [5th-95th percentile of "
              "seeds %5.2f-%5.2f%%]  min %5.2f%% max %5.2f%%"
              % ("cliche", 100 * m, 100 * p5, 100 * p95, 100 * min(cl),
                 100 * max(cl)))
        print("      point estimate over the whole band %d/%d = %.2f%%. It "
              "has no percentile to fit, so the split buys the SPREAD and "
              "not the threshold." % (k, len(items), 100.0 * k / len(items)))
    else:
        out["cliche"] = (float("nan"),) * 3
        print("   CLICHE_PAIR REFUSED: no split left >=50 items held out.")
    print("   The two splits agree on the MEDIAN and disagree on the SPREAD "
          "by about a factor of two. That gap is doctrine 13's price: the "
          "item split reports an interval that is roughly half as wide as "
          "the evidence supports, because it lets an author's other songs "
          "vouch for this one.")
    print("\n   author concentration in the band, since the percentiles are "
          "ITEM-weighted:")
    cnt = {}
    for r in items:
        cnt[r["file"]] = cnt.get(r["file"], 0) + 1
    top = sorted(cnt.items(), key=lambda t: -t[1])[:5]
    print("      median items per author %d; top five %.1f%% of the band: %s"
          % (statistics.median(cnt.values()),
             100 * sum(n for _, n in top) / len(items),
             ", ".join("%s %d" % (f.replace("eng_", "").replace(".txt", ""), n)
                       for f, n in top)))
    # One threshold set per dropped author, read by all five checks. It used
    # to be recomputed inside the per-check loop, so each author's leave-one-out
    # was built len(CHECKS) times and four fifths of it discarded. Same numbers.
    loo = [thresholds([r for r in items if r["file"] != a]) for a in cnt]
    for f, _, _ in CHECKS:
        print("      leave-one-author-out %-9s max |shift| %.4f"
              % (f, max(abs(t[f] - full[f]) for t in loo)))
    ab = {f: q([statistics.median([r[f] for r in items if r["file"] == a])
                for a in cnt], p) for f, _, p in CHECKS}
    print("      author-weighted alternative (one median per author, n=%d): %s"
          % (len(cnt), "  ".join("%s %.4f" % (f, ab[f]) for f, _, _ in CHECKS)))
    return full, out


def report_tolerance(rows, lo, hi, seeds):
    print("\n3. THE TOLERANCE, which floor.py had at 2.0 with no measurement "
          "anywhere behind it")
    core = band(rows, lo, hi)
    auths = sorted({r["file"] for r in core})
    print("   thresholds calibrated on half the in-band authors, applied to "
          "held-out authors' items across the whole applied band")
    print("   %-6s %-12s %s" % ("factor", "applied", "  ".join(
        "%-9s" % c[0] for c in CHECKS) + "  ANY"))
    for t in (1.0, 1.1, 1.25, 1.5, 2.0, 3.0):
        a, b = int(lo / t), int(hi * t)
        runs = []
        for s in range(seeds):
            rnd = random.Random(s)
            sh = auths[:]
            rnd.shuffle(sh)
            cal = set(sh[:len(sh) // 2])
            c = [r for r in core if r["file"] in cal]
            sc = [r for r in rows
                  if r["file"] not in cal and a <= r["n_tokens"] <= b]
            if len(c) < 50 or len(sc) < 50:
                continue
            runs.append(fpr(sc, thresholds(c)))
        print("   %-6.2f %-12s %s" % (t, "%d-%d" % (a, b), " ".join(
            "%8.2f%%" % (100 * statistics.median([r[f] for r in runs]))
            for f in [c[0] for c in CHECKS] + ["ANY"])))
    print("   Every check gets worse monotonically, so the tolerance is a "
          "real cost and not a free courtesy. The song profile declares 1.25. "
          "The other two profiles keep 2.0 because re-measuring them needs "
          "the sonnet classes, and that is a different cell's to move.")


def report_period(rows, lo, hi, draws=2000):
    print("\n4. PERIOD (doctrine 11), inside the provenance gate")
    items = band(rows, lo, hi)
    byauth = {}
    for r in items:
        byauth.setdefault(r["file"], []).append(r)
    # AN AUTHOR WITH NO PRINTED DATES IS A REFUSAL, NOT A ZERO AND NOT A
    # CRASH (doctrine 79/20). This section correlates a quality feature
    # against BIRTH YEAR, so an author the corpus cannot date has no
    # coordinate on this axis and is dropped from THIS check with the
    # count reported -- exactly as `predictability` already drops an
    # author whose every end word is OOV, twenty lines below.
    #
    # IT USED TO CRASH. `min(births)` on a list holding None raised
    # `TypeError: '<' not supported between instances of 'NoneType' and
    # 'NoneType'` and took the whole run down at section 4 -- after the
    # expensive predictability half had already been paid. Two corpus
    # events put Nones there and neither existed when this was written:
    # the mass load's derived dates were WITHDRAWN (they were reading
    # other people's deaths), and the Oxford/PAH/HBV anthologies print
    # dates for some authors and not others.
    all_auths = sorted(byauth)
    auths = [a for a in all_auths
             if byauth[a][0]["born"] is not None
             and byauth[a][0]["died"] is not None]
    undated = len(all_auths) - len(auths)
    if not auths:
        print("   REFUSED — no author in the band carries printed dates, so "
              "there is no birth-year axis to correlate against.")
        return {}
    births = [byauth[a][0]["born"] for a in auths]
    print("   %d of %d authors carry printed dates and are correlated below; "
          "%d are UNDATED and dropped from this check alone (counted apart, "
          "never as a zero). Dated: born %d-%d, median %d; latest death %d. "
          "No song here is by anyone alive after 1929 — that is the "
          "safe-subset gate's doing and not an accident of sampling, so "
          "nothing below extrapolates to a lyric written now."
          % (len(auths), len(all_auths), undated,
             min(births), max(births), statistics.median(births),
             max(byauth[a][0]["died"] for a in auths)))
    n_checks = len(CHECKS)
    bonf = 0.05 / n_checks
    print("   4a. author-level Spearman against birth year, with a "
          "label-permutation null over authors (%d draws). Bonferroni over "
          "the %d checks cuts at %.4f." % (draws * 5, n_checks, bonf))
    rnd = random.Random(20260811)
    slopes = {}
    for f, _, _ in CHECKS:
        # `predictability` can leave an author with NO decidable item (every
        # end word OOV) -- that author is dropped from THIS check's
        # correlation, not given a NaN median statistics.median cannot sort.
        # The other four checks have no NaN, so ba/bi/va reproduce the
        # original births/vals for them exactly.
        pairs = []
        for a in auths:
            vs = [v for r in byauth[a] if (v := r[f]) == v]
            if vs:
                pairs.append((byauth[a][0]["born"], statistics.median(vs)))
        bi, vals = ([p_ for p_, _ in pairs], [v for _, v in pairs])
        rho = spearman(bi, vals)
        null = []
        for _ in range(draws * 5):
            sh = vals[:]
            rnd.shuffle(sh)
            null.append(abs(spearman(bi, sh)))
        p = (sum(1 for v in null if v >= abs(rho)) + 1) / (len(null) + 1)
        slopes[f] = (round(rho, 3), round(p, 4))
        dropped = len(auths) - len(pairs)
        print("      %-15s rho %+.3f  p_perm %.4f  %s%s"
              % (f, rho, p, "SURVIVES Bonferroni" if p < bonf else
                 "does not survive Bonferroni",
                 "  (%d/%d authors had no decidable value)"
                 % (dropped, len(auths)) if dropped else ""))
    med = statistics.median(births)
    early = [a for a in auths if byauth[a][0]["born"] <= med]
    ei = [r for a in early for r in byauth[a]]
    li = [r for a in auths if a not in early for r in byauth[a]]
    # (len(CHECKS) + 1) for ANY, x2 directions -- was hardcoded "eight" /
    # 0.00625 back when CHECKS held four entries (doctrine 91: a count is a
    # coordinate of the RENDERING, not only of the threshold). Computed here
    # the same way 4a's n_checks/bonf already are, so a sixth check added
    # later cannot leave this print silently quoting a stale denominator
    # again.
    n_comparisons = (len(CHECKS) + 1) * 2
    bonf2 = 0.05 / n_comparisons
    print("   4b. cross-cohort threshold transfer at the median birth year "
          "%d: EARLY %d authors / %d items, LATE %d authors / %d items. The "
          "control permutes the COHORT LABEL over the same authors at the "
          "same partition sizes, %d draws — it varies only the thing under "
          "test (doctrine 14). Bonferroni over the %d comparisons cuts at "
          "%.5f." % (med, len(early), len(ei), len(auths) - len(early),
                     len(li), draws, n_comparisons, bonf2))
    null = {"EARLY -> LATE": [], "LATE -> EARLY": []}
    rnd2 = random.Random(20260812)
    for _ in range(draws):
        sh = auths[:]
        rnd2.shuffle(sh)
        ga = set(sh[:len(early)])
        ia = [r for r in items if r["file"] in ga]
        ib = [r for r in items if r["file"] not in ga]
        null["EARLY -> LATE"].append(fpr(ib, thresholds(ia)))
        null["LATE -> EARLY"].append(fpr(ia, thresholds(ib)))
    for nm, (src, dst) in (("EARLY -> LATE", (ei, li)),
                           ("LATE -> EARLY", (li, ei))):
        obs = fpr(dst, thresholds(src))
        print("      %s" % nm)
        for f in [c[0] for c in CHECKS] + ["ANY"]:
            v = [d[f] for d in null[nm]]
            p = (sum(1 for x in v if x >= obs[f]) + 1) / (len(v) + 1)
            print("         %-9s observed %5.2f%%   null median %5.2f%% "
                  "[5th-95th %5.2f-%5.2f%%]   p %.4f%s"
                  % (f, 100 * obs[f], 100 * statistics.median(v),
                     100 * q(v, 0.05), 100 * q(v, 0.95), p,
                     "  SURVIVES" if p < bonf2 else ""))
    print("      The direction is the part that matters and it is not "
          "symmetric: thresholds fitted on earlier-born authors OVER-flag "
          "later-born ones, and the reverse runs at or below nominal. A 2026 "
          "lyric sits further along that same axis than any author here.")
    return slopes


def report_examples(rows, lo, hi, full, scorer):
    print("\n5. THE TWO EXAMPLE SONGS, which are NOT in the calibration set")
    tag = _tagger()
    ex = sorted(glob.glob(os.path.join(ROOT, "examples", "*.txt")))
    for p in ex:
        with open(p, encoding="utf-8") as fh:
            body = [l.strip() for l in fh
                    if l.strip() and not (l.strip().startswith("[")
                                          and l.strip().endswith("]"))]
        per = [QualityFeatures._tokens(l) for l in body]
        words = [w.lower() for t in per for w in t]
        flat = [(w.lower(), tg) for t in per for w, tg in tag(t)]
        v = {"mattr": QualityFeatures._mattr(words, MATTR_WINDOW),
             "fwr": sum(1 for _, tg in flat if tg in FUNCTION_TAGS) / len(flat),
             "predictability": scorer.frac(body),
             "anaphora": anaphora(body), "cv": line_cv(body)}
        inb = lo <= len(words) <= hi
        print("   %s — %d lines, %d tokens, %s"
              % (os.path.basename(p), len(body), len(words),
                 "inside the band" if inb else "OUTSIDE the band"))
        for f, side, _ in CHECKS:
            if v[f] != v[f]:
                print("      %-9s no decidable pair (NaN)" % f)
                continue
            hit = (v[f] < full[f]) if side == "lo" else (v[f] > full[f])
            print("      %-9s %.4f  vs %.4f  %s"
                  % (f, v[f], full[f], "FIRES" if hit else "clear"))


def report_sample_resolution(rows, lo, hi, full, boot=200, seed=SAMPLE_SEED):
    """What size of drift could a sample of THIS size even see?

    Bootstrap the sampled band items and report each threshold's own 5th-95th
    spread. Without this a `--sample` run is a pile of numbers next to
    floor.py's with no way to tell a real move from the draw -- which is the
    "inconclusive by construction" doctrine 20 refuses, dressed as a table.
    With it the refusal is quantified: a delta inside this interval is
    invisible to this run at this N, and one outside it is worth a full run.
    """
    items = band(rows, lo, hi)
    print("\n5s. WHAT THIS SAMPLE COULD RESOLVE (%d bootstrap redraws of the "
          "%d in-band items, seed %d)" % (boot, len(items), seed))
    if len(items) < 20:
        print("    REFUSED: %d in-band items is not enough to bootstrap."
              % len(items))
        return {}
    rnd = random.Random(seed)
    draws = [thresholds([items[rnd.randrange(len(items))]
                         for _ in range(len(items))]) for _ in range(boot)]
    out = {}
    for f, _, _ in CHECKS:
        v = [d[f] for d in draws if d[f] == d[f]]
        out[f] = (q(v, 0.05), q(v, 0.95)) if v else (float("nan"),) * 2
        print("    %-15s point %.4f  bootstrap 5th-95th %.4f-%.4f  "
              "half-width %.4f"
              % (f, full[f], out[f][0], out[f][1], (out[f][1] - out[f][0]) / 2))
    return out


#: Constants `--without-predictability` cannot decide, and why. Each is named
#: rather than silently dropped: a check that quietly stops asking about three
#: of nineteen constants is a partial check reported as a whole one, and the
#: whole argument for that mode is that it says which is which.
DROPPED_BY_NO_PRED = [
    ("band lo (tokens)", "the band rule tests every CHECK's sub-bin "
                         "homogeneity; without the fifth it is a different rule"),
    ("band hi (tokens)", "same rule"),
    ("threshold predictability", "the check is not computed in this mode"),
    ("held-out FPR predictability (%)", "the check is not computed"),
    ("held-out FPR ANY (%)", "a union over four checks is not the shipped "
                             "union over five, and can only be lower"),
]


def check_shipped(lo, hi, full, fprs, slopes, sampled=None, resolution=None,
                  no_pred=False):
    """Compare what floor.py ships against what the corpus says today.

    `sampled` (a dict describing a `--sample` draw) turns every comparison
    into a REPORT with no verdict: the deltas are printed, and every one of
    them is counted as REFUSED rather than passed or failed, because a
    percentile over a few hundred drawn items is not the statistic floor.py
    ships. Three counts, always -- asked, answered, refused (doctrine 79).
    """
    song = [p for p in PROFILES if p.name == "song"]
    print("\n6. WHAT floor.py SHIPS, against what the corpus says today")
    if sampled:
        print("   SAMPLED RUN — %d of %d items, seed %d. Every row below is "
              "reported and NONE is judged; this run cannot pass or fail the "
              "profile (doctrine 20). Exit %d means exactly that."
              % (sampled["n"], sampled["of"], sampled["seed"], EXIT_NO_VERDICT))
    if not song:
        print("   FAIL: no `song` profile in quality/floor.py")
        return EXIT_DRIFT
    p = song[0]
    bad = []
    counts = {"asked": 0, "answered": 0, "refused": 0}
    skip = {lbl for lbl, _ in DROPPED_BY_NO_PRED} if no_pred else set()

    def cmp(label, shipped, measured, tol):
        if label in skip:
            return
        counts["asked"] += 1
        if measured != measured:
            # NaN is "this run could not measure it", which is a REFUSAL and
            # not a disagreement with floor.py. Charging it to the drift count
            # would put a refusal in the numerator (doctrine 79).
            counts["refused"] += 1
            print("   %-34s shipped %-10s measured %-10s REFUSED: no "
                  "decidable value this run"
                  % (label, "%.4f" % shipped if isinstance(shipped, float)
                     else shipped, "nan"))
            return
        delta = abs(shipped - measured)
        if sampled:
            # The interval is the bootstrap spread of the MEASURED statistic,
            # so the informative question is whether the SHIPPED value sits
            # outside it -- asking whether the measured value sits inside its
            # own bootstrap interval is circular and always true.
            res = (resolution or {}).get(label.replace("threshold ", ""))
            note = "no verdict (sampled)"
            if res and res[0] == res[0] and not (res[0] <= shipped <= res[1]):
                note += " | shipped is OUTSIDE this sample's 5th-95th " \
                        "%.4f-%.4f (|d| %.4f) — worth a full run" \
                        % (res[0], res[1], delta)
            counts["refused"] += 1
        else:
            ok = delta <= tol
            note = "ok" if ok else "DRIFT"
            counts["answered"] += 1
            if not ok:
                bad.append(label)
        print("   %-34s shipped %-10s measured %-10s %s"
              % (label, "%.4f" % shipped if isinstance(shipped, float)
                 else shipped, "%.4f" % measured if isinstance(measured, float)
                 else measured, note))

    if no_pred:
        print("   PARTIAL RUN (--without-predictability). %d constants are "
              "REFUSED by name below and the rest are judged exactly:"
              % len(DROPPED_BY_NO_PRED))
        for lbl, why in DROPPED_BY_NO_PRED:
            counts["asked"] += 1
            counts["refused"] += 1
            print("   %-34s REFUSED: %s" % (lbl, why))
    if sampled and (lo, hi) != (p.lo, p.hi):
        # The band is chosen by a rule with an item-count floor per sub-bin,
        # so a sample does not merely add noise to it -- it can return a
        # different band outright, and then every threshold below is a
        # percentile of a DIFFERENT population from the one floor.py ships.
        # Those deltas are not small-sample versions of the real ones; they
        # are answers to another question, and saying so is the point.
        print("   NOTE: the band rule returned %d-%d on this draw, not the "
              "shipped %d-%d. Every threshold and FPR below is therefore "
              "measured over a different population than floor.py's, and the "
              "deltas are not comparable to a full run's at all."
              % (lo, hi, p.lo, p.hi))
    cmp("band lo (tokens)", float(p.lo), float(lo), 0)
    cmp("band hi (tokens)", float(p.hi), float(hi), 0)
    # THE MATTR WINDOW IS A COORDINATE OF EVERY ROW BELOW, and until
    # 2026-08-14 nothing here named it. `threshold mattr` and `held-out FPR
    # mattr` are readings at `FloorDeclaration.mattr_window` = 50 tokens; the
    # band lo/hi above are too, because the band rule's homogeneity test is
    # computed on the same statistic (at window 20 the rule returns 100-350,
    # 2,953 items over 132 authors, instead of 150-400 / 1,859 / 108 -- so
    # every threshold in this block would then be a percentile of a different
    # population). `MATTR_WINDOW` at the top of this file is read off the
    # shipped declaration precisely so this comparison cannot become a
    # threshold from one window against a statistic from another. If a future
    # run moves the window, these rows drift for a reason that is NOT corpus
    # change and must not be repinned as if it were. The sweep, the
    # admissible set [1,22] u [40,93], and why 50 is kept rather than retuned
    # toward the gradient: `quality.floor.CALIBRATION["mattr_window"]`.
    #
    # STRUCTURAL, like the two checks at the end of this function: it reads
    # the band edge and the declaration and owes nothing to how many items
    # were scored, so a `--sample` run judges it exactly as a full one does.
    # What it asserts is ADMISSIBILITY at this profile: the band's lower edge
    # must EXCEED the window, so that every item in the calibration set is on
    # the moving-average side of `_mattr`'s `len(words) <= window` branch. If
    # it ever did not, `threshold mattr` below would be a percentile over a
    # MIXTURE of two statistics and would be unreadable rather than merely
    # drifted -- the defect doctrine 15 names, and the one the `section`
    # profile is on the other side of (every quatrain there falls back, so
    # its `mattr` figures are plain TTR; that is stated in its own note).
    # The JUDGED edge is the SHIPPED profile's `p.lo`, not this run's `lo`:
    # `lo` is refused outright in `--without-predictability` (a four-check
    # band rule is a different rule) and carries no verdict under `--sample`,
    # so judging on it would manufacture a DRIFT out of a mode. This run's
    # edge is printed beside it as context.
    counts["asked"] += 1
    counts["answered"] += 1
    if p.lo > MATTR_WINDOW:
        print("   %-34s shipped lo %d > window %d (this run's band lo %d): "
              "every item is a genuine moving average"
              % ("MATTR window admissibility", p.lo, MATTR_WINDOW, lo))
    else:
        bad.append("the shipped band lo %d does not exceed the MATTR window "
                   "%d, so the mattr percentile mixes moving-average and "
                   "plain-TTR items" % (p.lo, MATTR_WINDOW))
        print("   %-34s DRIFT: shipped lo %d <= window %d"
              % ("MATTR window admissibility", p.lo, MATTR_WINDOW))
    for f, _, _ in CHECKS:
        # A check absent from the SHIPPED profile is not drift -- it is the
        # gap this file's own module docstring names (`predictability`, as
        # of this run, until its measured number below is actually pasted
        # into floor.py). Comparing against a key that does not exist would
        # raise, not report, which is a worse failure mode than skipping.
        if FLOOR_KEY[f] not in p.percentiles:
            counts["asked"] += 1
            counts["refused"] += 1
            print("   %-34s NOT YET SHIPPED (measured %.4f below)"
                  % ("threshold %s" % f, full[f]))
            continue
        cmp("threshold %s" % f, p.percentiles[FLOOR_KEY[f]], full[f], 0.0001)
    FPR_KEY = {"mattr": "mattr", "fwr": "function_word_ratio",
              "anaphora": "anaphora", "cv": "line_length_cv",
              "predictability": "predictability", "ANY": "ANY"}
    for f in [c[0] for c in CHECKS] + ["ANY"]:
        k = FPR_KEY[f]
        if "held-out FPR %s (%%)" % k in skip:
            continue
        if k not in p.held_out_fpr:
            counts["asked"] += 1
            counts["refused"] += 1
            print("   %-34s NOT YET SHIPPED (measured %.2f%% below)"
                  % ("held-out FPR %s (%%)" % k, fprs[f][0]))
            continue
        # seeds are deterministic, so the median reproduces exactly at the
        # same --seeds; the tolerance is for a shorter run
        cmp("held-out FPR %s (%%)" % k, p.held_out_fpr[k][0], fprs[f][0], 1.0)
    # CLICHE_PAIR's rate is a SHIPPED CONSTANT of this profile like any other
    # -- `floor.py`'s `sev()` reads the band it was measured in to decide
    # whether the check may reject, and the finding quotes the number on its
    # face -- so it is checked here rather than left as a figure in a
    # docstring nothing re-derives (doctrine 58). NOT in DROPPED_BY_NO_PRED:
    # it touches no frequency layer, so `--without-predictability` judges it
    # exactly.
    measured_cl = fprs.get("cliche", (float("nan"),) * 3)[0]
    if "cliche" not in p.held_out_fpr:
        counts["asked"] += 1
        counts["refused"] += 1
        print("   %-34s NOT YET SHIPPED (measured %.2f%% below)"
              % ("held-out FPR cliche (%)", measured_cl))
    else:
        cmp("held-out FPR cliche (%)", p.held_out_fpr["cliche"][0],
            measured_cl, 1.0)
    cmp("profile n_generated", float(p.n_generated), 0.0, 0)
    # The period slope is quoted in the profile note AND inside the
    # ANAPHORA_OVERLOAD finding, so it is a shipped constant like any other.
    #
    # AND AS OF 2026-08-20 IT IS QUOTED IN BOTH PLACES AS A **STRUCK** VALUE.
    # Re-derived over 407 dated authors against the 108 it was measured on, the
    # slope is rho -0.008, p_perm 0.8695 -- absent and sign-flipped -- so both
    # surfaces now carry a doctrine-17 withdrawal and neither states it as a
    # live claim (`quality/RESULTS_SONG_FLOOR.md` §4·R).
    # THE TWO PINS BELOW ARE DELIBERATELY NOT REPINNED, and their DRIFT is the
    # correct answer rather than a defect: 0.275 is what the SHIPPED constant
    # says, the corpus now answers -0.008, and this runner's own contract is
    # that a drift here is argued and repinned in a closing sitting, never
    # tuned to (doctrine 58). Repinning them is the same sitting that repins
    # the five thresholds, and it is held open on the predictability arm.
    rho, pp = slopes["anaphora"]
    #: REPINNED 2026-08-21 from ~~0.275~~ / ~~0.0042~~ with the rest of the
    #: profile. The DRIFT these two reported was never a defect -- it was the
    #: withdrawal arriving at the constants, months after it arrived at the
    #: prose. The struck pair stays visible in the note (doctrine 17) and the
    #: structural gate below is what keeps it there.
    #:
    #: REPINNED AGAIN 2026-08-26 from ~~-0.008~~ / ~~0.8695~~ with the band.
    #: These are a correlation over the DATED authors of the band, so moving
    #: the band moves them by construction: 312 of the 200-400 band's 663
    #: authors carry printed dates, against 407 of the 150-400 band's 879.
    #: The WITHDRAWAL IS UNAFFECTED and that is the point of repinning rather
    #: than re-adopting -- anaphora reads no period signal on this band either
    #: (p_perm 0.6605, nowhere near the Bonferroni cut at 0.0100), so the
    #: struck 0.275 stays struck. What DID change is which check carries the
    #: signal: `mattr` now survives Bonferroni here (rho -0.177, p_perm
    #: 0.0029) where it did not before, and it is NOT adopted as a caution
    #: for the reason the note gives -- 351 of 663 in-band authors are UNDATED
    #: and not missing at random, so a correlation on a 47% subsample is not
    #: a clean finding in either direction (doctrine 20).
    cmp("anaphora period slope rho", -0.025, rho, 0.01)
    cmp("anaphora period slope p_perm", 0.6605, pp, 0.05)
    # The two below are STRUCTURAL, not statistical: they read floor.py alone
    # and owe nothing to how many items were scored, so a sampled run judges
    # them exactly as a full one does. They are the whole of what `--sample`
    # can actually decide, and they are counted as answered in both modes.
    # THIS GATE SURVIVES THE WITHDRAWAL, and its job changed rather than
    # ending: doctrine 17 keeps a falsified figure VISIBLE and forbids quoting
    # it as if it were not falsified, so the note must go on carrying +0.275.
    # What would now trip it is a later edit that DELETES the struck figure
    # instead of striking it.
    quoted = "+%.3f" % 0.275
    counts["asked"] += 1
    counts["answered"] += 1
    if quoted not in p.note:
        bad.append("the profile note no longer quotes rho %s (it is STRUCK, "
                   "and doctrine 17 keeps a struck figure legible)" % quoted)
        print("   profile note quotes rho             DRIFT")
    counts["asked"] += 1
    counts["answered"] += 1
    if p.measured_auc:
        bad.append("measured_auc is not empty on a profile with no negative "
                   "class")
        print("   measured_auc                       DRIFT: %s" %
              (p.measured_auc,))
    print("\n   asked %d, answered %d, refused %d (doctrine 79)"
          % (counts["asked"], counts["answered"], counts["refused"]))
    if bad:
        print("   %d value(s) DRIFTED: %s" % (len(bad), ", ".join(bad)))
        print("   `corpus/song/` is volatile by design, so a drift here is a "
              "corpus change, not automatically a defect. Argue it and "
              "repin; do not tune to it (doctrine 58).")
        return EXIT_DRIFT
    if sampled:
        print("   NO VERDICT on the %d statistical constants: this run scored "
              "%d of %d items and a percentile over a draw is not the "
              "statistic floor.py ships. The %d structural constants above "
              "ARE decided and reproduce. Run without --sample to decide the "
              "rest." % (counts["refused"], sampled["n"], sampled["of"],
                         counts["answered"]))
        return EXIT_NO_VERDICT
    if no_pred:
        # Exit 0, but the last line a reader or a CI log sees says PARTIAL and
        # names the count. This mode judges the constants it judges EXACTLY --
        # it is not a sample of them -- so a clean result is a real result about
        # those; it is simply not a result about the other five, and a green
        # tick that did not say so would be the decoration doctrine 48 names.
        print("   PARTIAL PASS: %d constants judged and reproducing, %d "
              "REFUSED by name above. This is NOT a full check -- the "
              "predictability threshold, its FPR, the union FPR and the band "
              "rule are undecided. Run without --without-predictability (and "
              "with a warm cache) to decide them."
              % (counts["answered"], counts["refused"]))
        return EXIT_OK
    print("   every shipped constant reproduces.")
    return EXIT_OK


class Phases:
    """Wall AND CPU per phase, printed at the end of every run.

    The reason this file's cost claim was wrong for a day and a half is that
    nothing measured it: the figure lived in a docstring and the docstring was
    the only place anyone could read it. A run that prints its own cost cannot
    develop that defect again -- and wall and CPU are reported SEPARATELY
    because they disagreed by 4.7x on the machine this was calibrated on, and
    quoting either alone would mislead somebody with different hardware.
    """

    def __init__(self):
        self.rows, self._t = [], None

    def __call__(self, name):
        self.stop()
        self._t = (name, time.perf_counter(), time.process_time())
        return self

    def stop(self):
        if self._t:
            n, w, c = self._t
            self.rows.append((n, time.perf_counter() - w,
                              time.process_time() - c))
            self._t = None

    def report(self):
        self.stop()
        print("\nPHASE COST  (wall / cpu seconds; they are not the same "
              "number and neither is the other's estimate)")
        for n, w, c in self.rows:
            print("   %-28s %8.1f  %8.1f" % (n, w, c))
        print("   %-28s %8.1f  %8.1f"
              % ("TOTAL", sum(r[1] for r in self.rows),
                 sum(r[2] for r in self.rows)))


def main():
    ap = argparse.ArgumentParser(
        description="Re-derive quality/floor.py's `song` profile from "
                    "corpus/song/. A COLD run is 2.0-2.2 CPU-hours (projected "
                    "2026-08-13); a run whose cache fingerprint still matches "
                    "is ~85 CPU-s, and --without-predictability is ~75 "
                    "CPU-s with no cache at all. See the module docstring.")
    ap.add_argument("--check", action="store_true",
                    help="numbers only; exit 1 if floor.py has drifted")
    ap.add_argument("--seeds", type=int, default=200)
    ap.add_argument("--draws", type=int, default=2000)
    ap.add_argument("--sample", type=int, default=None, metavar="N",
                    help="score N randomly drawn items instead of all 4,930. "
                         "Bounded run: reports everything, DECIDES nothing "
                         "statistical, always exits %d." % EXIT_NO_VERDICT)
    ap.add_argument("--sample-seed", type=int, default=SAMPLE_SEED,
                    help="declared seed for --sample (default %d)"
                         % SAMPLE_SEED)
    ap.add_argument("--without-predictability", action="store_true",
                    help="drop the one expensive check and judge the other "
                         "four EXACTLY over the whole corpus: ~75 CPU-s from "
                         "cold, no cache needed. Refuses 5 of the 18 shipped "
                         "constants BY NAME and says so in its last line. The "
                         "cheapest run that can still fail on real drift.")
    ap.add_argument("--no-cache", action="store_true",
                    help="recompute every item; do not read or write the "
                         "on-disk predictability memo")
    ap.add_argument("--cache-path", default=DEFAULT_CACHE,
                    help="where the memo lives (default %s)" % DEFAULT_CACHE)
    ap.add_argument("--verify-cache", type=int, default=0, metavar="N",
                    help="re-derive N cached items the slow way and refuse if "
                         "any disagrees. Meant for a WARM run, where the "
                         "values came off disk and the re-derivation is "
                         "genuinely independent; on a cold run it re-checks "
                         "arithmetic done seconds earlier and proves less. "
                         "Costs roughly N x 6 CPU-s.")
    a = ap.parse_args()
    if a.sample is not None and a.sample < 1:
        ap.error("--sample takes a positive item count")

    global CHECKS
    if a.without_predictability:
        # A DECLARED reduction, announced before any number is printed, and
        # named again in section 6's own refusal list. `CHECKS` is the one
        # place every section reads the roster from, so removing it here
        # removes it consistently -- the band rule, the thresholds, the FPRs
        # and 4b's Bonferroni denominator all follow from the same list
        # (doctrine 91: a count is a coordinate of the rendering).
        CHECKS = [c for c in CHECKS if c[0] != "predictability"]
        # `20` IS HAND-KEPT AND HAS NOW GONE STALE TWICE -- 18 -> 19 when
        # the CLICHE_PAIR FPR joined, 19 -> 20 when `mattr_window` did,
        # and it was still printing 18 after both. It cannot be derived
        # here: the authoritative count is the `asked` half of the
        # doctrine-79 triple, which is accumulated by the checks BELOW and
        # does not exist yet at this line. So it is repinned by hand and
        # the triple is named as the thing to trust -- if the two ever
        # disagree again, the triple is right and this sentence is not.
        print("MODE  --without-predictability: %d checks, not 5. The dropped "
              "one is the whole cost (96%% of a cold run) and 5 of the 20 "
              "shipped constants go undecided with it (that 20 is hand-kept; "
              "the `asked` count in the doctrine-79 triple below is the "
              "derived one); they are listed by name in section 6."
              % len(CHECKS))

    ph = Phases()
    cache = PredictabilityCache(
        a.cache_path, enabled=not (a.no_cache or a.without_predictability),
        why_off=("disabled (--no-cache)" if a.no_cache else
                 "disabled (--without-predictability: nothing to memoize)")
    ).open()
    cache.report()
    scorer = Scorer(cache)

    ph("population")
    rows, scorer = population(scorer=scorer, sample=a.sample,
                              sample_seed=a.sample_seed,
                              with_predictability=not a.without_predictability)
    cache.flush()
    print("CACHE  after population: hits %d, misses %d%s"
          % (cache.hits, cache.misses,
             "" if cache.enabled else " (disabled)"))
    if a.verify_cache:
        ph("verify_cache")
        _, disagreements = verify_cache(scorer, [r["_body"] for r in rows],
                                        a.verify_cache)
        if disagreements:
            # A cache that disagrees with the function it memoizes is worse
            # than no cache: it reports a stale number as a measurement. Stop
            # rather than continue on values now known to be unreliable.
            print("REFUSED: the memo disagrees with a fresh computation. "
                  "Delete %s and re-run, and treat the fingerprint rule as "
                  "the defect." % a.cache_path)
            sys.exit(EXIT_DRIFT)
    sampled = ({"n": len(rows), "of": n_all_items(), "seed": a.sample_seed}
               if a.sample is not None else None)

    ph("pick_band")
    try:
        lo, hi = pick_band(rows, verbose=not a.check)
    except NoBandSatisfiesTheRule as e:
        ph.stop()
        print("\nREFUSED: %s" % e)
        if sampled:
            print("This is the expected outcome for a small --sample: the "
                  "band rule needs >=%d items in every 50-token sub-bin, and "
                  "a draw of %d cannot supply them. It is a refusal, not a "
                  "finding about the corpus (doctrine 20)."
                  % (MIN_BIN, len(rows)))
        ph.report()
        sys.exit(EXIT_NO_VERDICT if sampled else EXIT_DRIFT)

    # A FOUR-CHECK BAND IS A DIFFERENT BAND, AND EVERY THRESHOLD MEASURED OVER
    # IT INHERITS THAT (2026-08-26, MISSING.md M-131).
    #
    # `--without-predictability` already REFUSES `band lo`/`band hi` by name,
    # on the argument this file states twice: the rule "reads every CHECK's
    # sub-bin homogeneity and is therefore a DIFFERENT rule with four", and
    # judging on this run's `lo` "would manufacture a DRIFT out of a mode".
    # Both sentences were true and the refusal was applied to ONE downstream
    # value -- the MATTR window admissibility check, which was deliberately
    # keyed to the SHIPPED `p.lo`. The four THRESHOLDS were left measured over
    # whatever band the four-check rule returned.
    #
    # THAT WAS HARMLESS ONLY WHILE THE TWO RULES AGREED. On 2026-08-26 the
    # five-check rule moved the band 150-400 -> 200-400 -- and the check that
    # moved it is precisely the one this mode drops, so the four-check rule
    # still returns 150-400 and always will. The mode then measured
    # thresholds on 3,575 items and judged them against constants adopted on
    # 2,261, reporting mattr/fwr/cv as DRIFT on a tree where nothing had
    # drifted: a red manufactured out of a mode, which is the outcome the
    # comment three hundred lines down already names.
    #
    # So the SHIPPED band is what this mode measures over. The band constants
    # stay refused -- this mode cannot decide them and does not pretend to --
    # but their consequences are no longer judged against a population the
    # shipped set was never adopted on (doctrine 20/79).
    if a.without_predictability:
        song = [p for p in PROFILES if p.name == "song"]
        if song:
            derived = (lo, hi)
            lo, hi = song[0].lo, song[0].hi
            if derived != (lo, hi):
                print("   BAND: measuring over the SHIPPED %d-%d, not this "
                      "mode's own %d-%d — a four-check band rule is a "
                      "different rule, and its answer may not be the "
                      "population the shipped thresholds are judged on."
                      % (lo, hi, derived[0], derived[1]))

    ph("report_fpr")
    full, fprs = report_fpr(rows, lo, hi, a.seeds)
    if not a.check:
        ph("report_tolerance")
        report_tolerance(rows, lo, hi, a.seeds)
    ph("report_period")
    slopes = report_period(rows, lo, hi, a.draws)
    if not a.check:
        ph("report_examples")
        report_examples(rows, lo, hi, full, scorer)
        cache.flush()
    resolution = None
    if sampled:
        ph("sample_resolution")
        resolution = report_sample_resolution(rows, lo, hi, full)
    ph("check_shipped")
    rc = check_shipped(lo, hi, full, fprs, slopes, sampled, resolution,
                       no_pred=a.without_predictability)
    ph.stop()
    cache.flush()
    cache.report()
    ph.report()
    sys.exit(rc)


if __name__ == "__main__":
    main()

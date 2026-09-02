#!/usr/bin/env python3
"""CROSS-SONG WORD REUSE, DISCLOSED AND NEVER GRADED — `MISSING.md` M-111.

    python3 lyric_harness.py screen light shore --bank   # the verb route
    python3 quality/cross_song.py --sweep                # the whole bank
    python3 quality/cross_song.py --check       # re-derive; FAIL on drift
    python3 quality/cross_song.py --sweep --subset=panel6 [--unmatched]

THE RULING THIS FILE IMPLEMENTS (2026-09-02, under the owner's delegation).
A check MAY read `songs/` to DISCLOSE cross-song word reuse, and MAY NOT
read it to grade, gate, threshold, calibrate or rank. The four arguments,
because a module that only asserts the conclusion is a sentence, not a
ruling:

  DOCTRINE 34 — does reading `songs/` make it corpus by the back door?
  No, and the tree had already ruled it twice. `quality/song_record.py` and
  `quality/ban_convergence.py` both read this bank and neither carries a
  `data/sources.tsv` row, because neither CALIBRATES on it: song_record
  explicitly refuses a corpus-relative quality score in its own docstring,
  for exactly this reason. Doctrine 34's row exists so that a resource
  whose CONTENTS ENTER A SCORE has answerable provenance. What makes a
  directory corpus is the job, not the read: a population you SAMPLE from,
  fit on, or draw a null from. Here the bank is the OBSERVATION and the
  null is drawn from `corpus/song/`, which is corpus and does carry rows.
  That is the right way round, and `_refuse_bank_as_population` below makes
  the wrong way round raise rather than merely be discouraged.
  THE COROLLARY IS WHY NOTHING HERE IS CACHED: a derived `data/*.tsv` of
  bank frequencies would be a corpus file by construction, would need a row
  under doctrine 34, and would be the back door this paragraph denies. The
  frequencies are derived live from the committed bytes on every call. The
  cost of that decision is measured and stated under COST below.

  DOCTRINE 13 — the bank is this harness's own output, so a resource read
  from it is NOT independent of the label. That is fatal to a GRADE and
  survivable by a DISCLOSURE. Scoring a candidate word by how often the
  harness previously emitted it closes a loop the harness itself drives:
  the ban tables push a draft off the modal candidate, the survivor is sung,
  the survivor enters the bank, and a check reading the bank would push the
  next draft off the survivor — measuring novelty against a target the
  instrument is moving. Doctrine 13 says that where independence is
  impossible you state the dependence and argue its DIRECTION before the
  run: the direction here is positive feedback onto exactly the second mode
  M-88 and M-111 identified, so an automatic response would compound the
  defect it is named after. A disclosure changes no score, so it never
  enters the dependence at all.

  DOCTRINE 14 — is this the `--cliques` problem, a control defined in terms
  of the quantity it controls? A GATE would be, precisely: the ban's clean
  lists MANUFACTURE the reuse (M-111's funnel receipt), so a control reading
  the reuse back would be defined in terms of a quantity the ban already
  determines. A disclosure is different in kind, and the difference is
  doctrine 79's — a REPORT is not a CONTROL, and putting a report in the
  control layer charges the wrong layer. That difference has to be
  MECHANICAL or it is only a promise: `screen --bank` may only APPEND to
  `screen`'s output (`test_cross_song.py` §5 pins the un-flagged run as a
  byte PREFIX of the flagged one), so a finding, a code or a moved count
  cannot be introduced here without turning a suite red.

  DOCTRINE 6 / 7 — flag or note? NOTE, and not for want of nerve. A flag is
  a floor; a floor needs a calibrated threshold stated as a false-positive
  rate (doctrine 22) measured at a length that could falsify it (doctrine
  72, 15). The statistic below is NOT SCALE-INVARIANT — see WHAT THE
  RE-MEASUREMENT FOUND — so any fixed threshold on it silently asks a
  different question every time a song is banked, which is doctrine 15's
  failure with the BANK SIZE as the length. And a writer reusing their own
  word across their own songs is a style fact: doctrine 7's floor is for
  defects, and `light` in five songs is a signature, not a violation.

WHAT THE RE-MEASUREMENT FOUND (2026-09-02, and it is why this file exists
in this shape). Every figure below is re-derivable by command — that is
what `--subset=panel6` / `--subset=after_panel` exist for, because this
measurement had by then been recomputed BY HAND five times (panel runs 1,
3, 4, 5 and this sitting) at four bank sizes and in at least two spellings
the register itself records disagreeing by one type. An improvised script
used twice is a defect report (standing rule 3), and this one was used
five times.

    python3 quality/cross_song.py --sweep --subset=panel6
    python3 quality/cross_song.py --sweep --subset=after_panel
    python3 quality/cross_song.py --sweep
    python3 quality/cross_song.py --sweep [--subset=panel6] --unmatched

`quality/RESULTS_PANEL.md` §4 recorded, on SIX songs:
content types shared by >= 4 of 6 = 10, against a null median of 1 and a
max of 8. Re-measured here at the bank's SIXTEEN songs with a matched null:

  * ON THE SIX, IT REPRODUCES AND IS STRONG. 11 types at >= 4 of 6 (the
    one-type gap from the recorded 10 is panel run 5's own recorded
    spelling difference), against a length-matched null median of 2 and
    max 7, with 0 of 300 draws reaching 11.
  * AT THE SAME PROPORTION ON SIXTEEN, IT IS GONE. `>= 4 of 6` is
    two-thirds of the bank; two-thirds of sixteen is `>= 11 of 16`, where
    the bank holds ZERO types and so does the null's median. At `>= 8 of
    16` — half — the bank holds 2 against a null median of 3, i.e. BELOW
    the null.
  * AT THE SAME ABSOLUTE k IT SURVIVES, BUT IT IS A DIFFERENT QUESTION.
    `>= 4 of 16` is a QUARTER of the bank: 53 types against a matched-null
    median of 32, 0 of 300 draws reaching 53.
  * AND THE TEN SONGS WRITTEN AFTER THE PANEL SHOW NOTHING. At `>= 4 of
    10` the ten hold 8 types against a null median of 13 — below the null —
    and no k from 3 upward separates from its null. The panels' own prose
    had been saying this for four runs ("the core cluster stays confined to
    the first five songs"); this is the mechanical confirmation.

So the number the open question quoted is STALE IN ITS STRENGTH, and the
reason is doctrine 15 wearing a different hat: a count of types at a FIXED
depth is a function of the bank size, and the panel's null was never
matched on song length either (unmatched, the k=4 excess at sixteen is
p=0.11 and does not separate at all). Nothing here retracts the finding on
the six — it holds. What it retracts is any reading of "10 against a null
of 1" as a live property of the bank, and with it the case for a gate.

WHAT THIS FILE MEASURES, AND NOTHING ELSE
  * BANK DEPTH. For each content type, in how many banked songs it appears
    as a content word. The population is `song_record.songs()` and no
    second copy of it (doctrine 1; `ban_convergence.py` reaches it the
    same way and `test_cross_song.py` §1 pins the identity).
  * THE MATCHED NULL. For each k, how many types a draw of N HUMAN songs
    puts at depth >= k, where each human song is drawn to match the
    content-type count of the banked song it replaces (+/-15%, widening in
    10-point steps until the pool holds 30), no source file used twice in
    a draw. Human population: `corpus/song/eng_*` read by
    `grid.read_marked_songs` — the one existing reader, and the population
    `narrative_bands.py` already declares.
  * NOTHING ELSE. No threshold is defined in this module, no finding code
    is emitted from it, and nothing downstream reads its numbers.

WHY A LENGTH-MATCHED NULL AND NOT THE PANEL'S. Vocabulary size is the
nuisance parameter: two long songs share more types than two short ones for
no stylistic reason at all. The banked songs run 33-179 content types
(median 85) against a human median of 75 with a q1-q3 of 51-120, so an
unmatched draw is not comparing like with like — and at n=6 the mismatch
was small enough to hide (unmatched p=0.0133, matched p<=0.0033) while at
n=16 it DECIDES THE ANSWER (unmatched p=0.1063, matched p<=0.0033), both
at k=4. `--unmatched` runs the panel's own construction, because the case
for matching is a measurement and a measurement whose alternative cannot
be run is an assertion (doctrine 61: pick between rule variants by lift
over a matched control, and record the table).

DOCTRINE 57 AND 20, ON THE p COLUMN. An empirical p at 1/(draws+1) is
reporting the RESOLUTION, not the effect, and `--sweep` prints `<=` on
every row that sits on the floor. At high k both the observed and the null
counts are 0-3, so those rows have almost no resolution and are reported
as measured rather than as nulls.

COST, MEASURED 2026-09-02. Tagging the bank: 0.5 s for 16 songs plus the
tagger's own load. Building the human population for the null: ~60 s for
8,666 songs. So the null is `--sweep`/`--check`'s business and never the
screen's: `screen --bank` reads the BANK and the PINNED spectrum, and a
caller who does not write `--bank` imports nothing from this module and
pays none of it.

Determinism: sorted paths, sorted sizes, and the only randomness is
`random.Random(NULL_SEED)` (doctrine 66).
"""

import argparse
import glob
import os
import random
import statistics
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SONGS = os.path.join(ROOT, "songs")
HUMAN_ROOT = os.path.join(ROOT, "corpus", "song")
HUMAN_GLOB = "eng_*"
sys.path.insert(0, ROOT)

#: The null's declared coordinates. Changing any of them changes every
#: number in PINNED, which is what `--check` exists to make loud.
NULL_SEED = 20260902
NULL_DRAWS = 300
#: Length matching: a human song stands in for a banked song when its
#: content-type count is within this fraction of it. Widened in
#: MATCH_STEP increments until the pool holds MATCH_POOL_MIN members, so a
#: banked song at the tail of the length distribution still gets a draw
#: rather than silently narrowing the null to one file.
MATCH_TOL = 0.15
MATCH_STEP = 0.10
MATCH_POOL_MIN = 30

#: PINNED 2026-09-02, from this module's own first recorded run at the
#: bank's sixteen songs (`MISSING.md` M-111). MEASURED FACTS, NOT
#: THRESHOLDS — nothing in this tree compares a draft, a word or a song
#: against any of them, and `test_cross_song.py` §4 is what holds that.
#: `--check` re-derives them and exits 3 on drift.
PINNED = {
    "bank_songs": 16,
    "bank_types": 951,
    "human_songs": 8666,
    "human_files": 1297,
    # per k: (observed types at depth >= k, null median, null max)
    "spectrum": {
        2: (263, 194.0, 235), 3: (110, 71.0, 98), 4: (53, 32.0, 50),
        5: (27, 17.0, 28), 6: (13, 9.0, 18), 7: (5, 5.0, 10),
        8: (2, 3.0, 8), 9: (2, 2.0, 6), 10: (0, 1.0, 4),
        11: (0, 0.0, 3), 12: (0, 0.0, 2), 13: (0, 0.0, 1),
        14: (0, 0.0, 1), 15: (0, 0.0, 1), 16: (0, 0.0, 0),
    },
}


class BankIsNotCorpus(Exception):
    """Raised when the BANKED songs are handed to a population that
    samples, calibrates or draws a null.

    THIS IS THE RULING MADE MECHANICAL, and it is here rather than in a
    paragraph because M-111 sat open for eight days on an argument, and an
    argument is exactly what a later session can talk itself out of. The
    songs register's first rule is that the bank is NOT corpus (doctrine
    13/14, doctrine 34): it may be OBSERVED and it may not be SAMPLED. A
    reading that puts `songs/` on the null's side of the comparison
    inverts the dependence — the harness's own output would become the
    yardstick its own output is measured against — so that reading raises
    here instead of returning a number somebody would go on to quote.
    """


def _refuse_bank_as_population(paths):
    """The guard every null population passes through. -> the paths."""
    bank = os.path.realpath(SONGS) + os.sep
    inside = [p for p in paths if os.path.realpath(p).startswith(bank)]
    if inside:
        raise BankIsNotCorpus(
            f"{len(inside)} path(s) under songs/ were handed to the NULL "
            f"population, starting with {os.path.basename(inside[0])!r}. "
            f"The banked songs are this harness's own output: they are the "
            f"OBSERVATION here and may never be the population a null is "
            f"drawn from, because a resource used to score a cell must be "
            f"independent of that cell's label (doctrine 13) and a control "
            f"may not be defined in terms of the quantity it controls "
            f"(doctrine 14). Draw the null from corpus/song/, which carries "
            f"data/sources.tsv rows (doctrine 34); the bank carries none "
            f"BECAUSE it is not corpus, and giving it one to silence this "
            f"is the back door, not the fix.")
    return list(paths)


# ------------------------------------------------------------- the bank

def songs():
    """The ONE definition of the banked population: a lyric with a
    blueprint, `song_record.songs()`. Reached the same way
    `ban_convergence.songs()` reaches it, and pinned equal to it by
    `test_cross_song.py` §1 — a second copy of a population is a second
    answer waiting to disagree (doctrine 1)."""
    from quality.song_record import songs as _songs
    return _songs()


def _tag():
    from quality.features import _tagger
    return _tagger()


def _types_of_file(path, tag):
    """The declared content partition of one banked lyric's sung lines,
    through `narrative_bands.content_types` — the ONE spelling, made
    public for this caller (panel run 5 caught two hand computations of it
    disagreeing by one type).

    THE CALLER'S `--voices` IS NOT CONSULTED HERE, AND THE COST IS A
    MEASURED ZERO. `content_types` reads through `line_tokens` at its
    default `strip_parens=True`, so a screen run under `--voices` would in
    principle read the BANK one way and the caller's own words another.
    Measured 2026-09-02: **0 sung lines across all sixteen banked songs
    carry a parenthetical**, so the two readings are identical on this
    population and threading the coordinate through would be a knob with
    nothing to turn. Recorded rather than assumed, because the day a
    banked song carries voice-attribution notation this sentence is the
    defect report (doctrine 58: an exclusion nobody wrote down is a
    threshold nobody wrote down).
    """
    from quality.narrative_bands import content_types
    return content_types(
        open(path, encoding="utf-8").read().splitlines(), tag)


def bank(tag=None):
    """-> ({song basename: set of content types}, [unreadable basenames]).

    Two counts, never summed (doctrine 79): what was read and what was
    not. A lyric the tagger cannot read is not a lyric with no words."""
    tag = tag or _tag()
    out, refused = {}, []
    for p in songs():
        name = os.path.basename(p)
        try:
            out[name] = _types_of_file(p, tag)
        except Exception as e:                          # noqa: BLE001
            refused.append(f"{name}: {e}")
    return out, refused


def depth(types_by_song):
    """-> Counter{type: how many banked songs sing it as a content word}."""
    c = Counter()
    for s in types_by_song.values():
        c.update(s)
    return c


def spectrum(sets_, ks=None):
    """-> {k: how many types sit at depth >= k} over any list of type sets."""
    c = Counter()
    for s in sets_:
        c.update(s)
    ks = ks or range(2, len(sets_) + 1)
    return {k: sum(1 for _w, v in c.items() if v >= k) for k in ks}


# ------------------------------------------------- the human null (corpus)

def human_population(root=None, pattern=HUMAN_GLOB, tag=None):
    """-> [(file_index, n_types, set)] over `corpus/song/eng_*`.

    The population `narrative_bands.py` declares, minus the songs with no
    content type at all (which cannot join a depth count in either
    direction). Passes through `_refuse_bank_as_population` — that guard
    is the whole reason this function takes a root rather than hard-coding
    one: a later session pointing it at `songs/` gets an exception, not a
    number.
    """
    from quality import grid as G
    tag = tag or _tag()
    files = sorted(glob.glob(os.path.join(root or HUMAN_ROOT, pattern)))
    _refuse_bank_as_population(files)
    pop, empty = [], 0
    for fi, p in enumerate(files):
        try:
            marked = G.read_marked_songs(p)
        except Exception:                               # noqa: BLE001
            continue
        for s in marked:
            from quality.narrative_bands import content_types
            cs = content_types([l for b in s.blocks for l in b.lines], tag)
            if cs:
                pop.append((fi, len(cs), cs))
            else:
                empty += 1
    return pop, len(files), empty


def _pools(pop, targets, matched=True):
    """-> one candidate pool per banked song. `matched=False` gives every
    song the WHOLE population, which is the panel's own construction and is
    reachable ON PURPOSE: the case for matching is a measurement, and a
    measurement whose alternative cannot be run is an assertion."""
    if not matched:
        return [list(range(len(pop)))] * len(targets)
    by_size = {}
    for i, (_fi, sz, _cs) in enumerate(pop):
        by_size.setdefault(sz, []).append(i)
    sizes = sorted(by_size)
    out = []
    for t in targets:
        tol = MATCH_TOL
        while True:
            lo, hi = t * (1 - tol), t * (1 + tol)
            pool = [i for sz in sizes if lo <= sz <= hi for i in by_size[sz]]
            if len(pool) >= MATCH_POOL_MIN:
                out.append(pool)
                break
            tol += MATCH_STEP
    return out


def null_spectra(pop, targets, draws=NULL_DRAWS, seed=NULL_SEED,
                 matched=True):
    """-> [ {k: count} ] , one dict per draw. Length-matched by default,
    one source file per draw, seeded."""
    rnd = random.Random(seed)
    pools = _pools(pop, targets, matched)
    n = len(targets)
    out = []
    for _ in range(draws):
        chosen, used = [], set()
        for pool in pools:
            i = pool[rnd.randrange(len(pool))]
            for _try in range(200):
                if pop[i][0] not in used:
                    break
                i = pool[rnd.randrange(len(pool))]
            used.add(pop[i][0])
            chosen.append(pop[i][2])
        out.append(spectrum(chosen, ks=range(2, n + 1)))
    return out


#: The panel's own six, named so `--subset=panel6` re-derives the figure
#: `RESULTS_PANEL.md` §4 recorded and this module's docstring re-reads.
#: A NAMED SUBSET IS NOT A SECOND POPULATION: it is a filter over
#: `songs()`, refused by name if it names a song the bank does not hold.
PANEL_SIX = ("one_more.txt", "turn_the_wheel.txt", "long_bridge.txt",
             "stay_awake.txt", "carry_it_over.txt", "keep_the_light.txt")


def subset(name, all_names):
    """-> the ordered subset `name` selects, or raises ValueError naming the
    vocabulary. `after_panel` is the complement of `panel6` — the songs
    written since the concentration was measured, which is the comparison
    the register's claim actually rests on."""
    if name in (None, "", "all"):
        return list(all_names)
    if name == "panel6":
        missing = [s for s in PANEL_SIX if s not in all_names]
        if missing:
            raise ValueError(
                f"the bank no longer holds {missing} — `panel6` names the "
                f"six songs RESULTS_PANEL.md measured, and a subset that "
                f"silently shrank would restate its figure on a different "
                f"set")
        return [s for s in all_names if s in PANEL_SIX]
    if name == "after_panel":
        return [s for s in all_names if s not in PANEL_SIX]
    raise ValueError(f"--subset={name!r} names no declared subset; the "
                     f"vocabulary is all / panel6 / after_panel")


def measure(draws=NULL_DRAWS, seed=NULL_SEED, verbose=True, which=None,
            matched=True):
    """-> the whole reading: bank, spectrum, null, p per k."""
    tag = _tag()
    types_by_song, refused = bank(tag)
    names = subset(which, sorted(types_by_song))
    sets_ = [types_by_song[n] for n in names]
    n = len(sets_)
    obs = spectrum(sets_)
    pop, n_files, n_empty = human_population(tag=tag)
    nulls = null_spectra(pop, [len(s) for s in sets_], draws, seed,
                         matched=matched)
    rows = {}
    for k in range(2, n + 1):
        g = [d[k] for d in nulls]
        hit = sum(1 for x in g if x >= obs[k])
        rows[k] = {"observed": obs[k],
                   "null_median": statistics.median(g),
                   "null_max": max(g), "null_min": min(g),
                   "p": (hit + 1) / (draws + 1), "at_floor": hit == 0}
    # THE TYPE COUNT IS THE SUBSET'S OWN, never the whole bank's — a
    # subset run printing the bank's 951 beside its own six-song spectrum
    # would be two populations in one table (doctrine 15).
    sub = {n: types_by_song[n] for n in names}
    return {"songs": names, "refused": refused, "matched": matched,
            "types": len(depth(sub)),
            "human_songs": len(pop), "human_files": n_files,
            "human_empty": n_empty, "rows": rows,
            "depth": depth(sub), "by_song": sub}


# ------------------------------------------------------ the disclosure

def disclose(words, tag=None):
    """-> [{word, depth, songs, pinned_at_depth, pinned_null_median}].

    THE PER-WORD HALF, and the only half a writing session touches. For
    each word: how many banked songs sing it as a content word, which
    ones, and — from PINNED, so the screen never builds a null — how many
    types the bank holds at that depth or deeper against the matched
    null's median at the same depth.

    NO VERDICT COLUMN, BY THE RULING. There is no boolean here, no code,
    no label and no threshold: the reader is handed the depth and the
    null's own reading of that depth and does their own thinking, because
    a writer reusing their own word is a style fact and doctrine 7's floor
    is for defects. `depth` 0 is an ordinary answer, not a good one.
    """
    tag = tag or _tag()
    types_by_song, refused = bank(tag)
    d = depth(types_by_song)
    spec = PINNED["spectrum"]
    out = []
    for w in words:
        key = w.strip().lower()
        k = d.get(key, 0)
        obs, med, _mx = spec.get(k, (None, None, None))
        out.append({"word": w, "depth": k,
                    "songs": sorted(n for n, s in types_by_song.items()
                                    if key in s),
                    "bank_songs": len(types_by_song),
                    "pinned_at_depth": obs,
                    "pinned_null_median": med,
                    "refused": refused})
    return out


def disclosure_lines(rows):
    """-> the printed block, as lines. Kept here rather than in the CLI so
    the verb and any later reader render one text (doctrine 1)."""
    if not rows:
        return []
    n = rows[0]["bank_songs"]
    out = [f"  BANK   : cross-song depth over the {n} banked songs "
           f"(`quality/cross_song.py`, M-111) — how many of YOUR OWN songs "
           f"already sing each word as a content word. A DISCLOSURE: it "
           f"moves no verdict, no count and no exit code above, and there "
           f"is no threshold on it (doctrine 6/7 — reusing your own word "
           f"is a style fact, not a defect)."]
    w = max(len(r["word"]) for r in rows)
    for r in rows:
        line = f"  {r['word'].ljust(w)}  {r['depth']} of {n}"
        if r["songs"]:
            line += f" — {', '.join(s[:-4] for s in r['songs'])}"
        if r["pinned_at_depth"] is not None and r["depth"] >= 2:
            line += (f"   [the bank holds {r['pinned_at_depth']} type(s) "
                     f"at depth >= {r['depth']} against a matched-null "
                     f"median of {r['pinned_null_median']:.0f}]")
        elif r["depth"] < 2:
            line += "   [depth 0 or 1 is not a cross-song fact at all]"
        else:
            # THE BANK GREW PAST THE PIN. Saying nothing here would render
            # a depth with no null beside it exactly like a depth the null
            # calls ordinary, which is doctrine 20 inside one column: the
            # reading is UNAVAILABLE, not reassuring.
            line += (f"   [no pinned null at depth {r['depth']} — the bank "
                     f"has grown past the 2026-09-02 spectrum; re-derive "
                     f"with `python3 quality/cross_song.py --check`]")
        out.append(line)
    if rows[0]["refused"]:
        out.append(f"  BANK   : {len(rows[0]['refused'])} banked song(s) "
                   f"UNREADABLE and counted separately (doctrine 79): "
                   f"{rows[0]['refused'][0]}")
    return out


# ------------------------------------------------------------------- CLI

def _print_sweep(m):
    n = len(m["songs"])
    print(f"  BANK   : {n} song(s) read, {len(m['refused'])} refused, "
          f"{m['types']} distinct content type(s) — "
          f"`song_record.songs()`, the one population")
    print(f"  NULL   : {m['human_songs']} human song(s) in "
          f"{m['human_files']} corpus/song/{HUMAN_GLOB} file(s), "
          f"{m['human_empty']} with no content type and skipped; "
          f"{NULL_DRAWS} draws at seed {NULL_SEED}, "
          + ("LENGTH-MATCHED (each human song drawn within "
             f"{MATCH_TOL:.0%} of the banked song it replaces — vocabulary "
             "size is the nuisance parameter)"
             if m["matched"] else
             "UNMATCHED — the panel's own construction, kept reachable so "
             "the case for matching is a measurement and not an assertion"))
    print(f"  {'k':>3}  {'share':>6}  {'obs':>5}  {'null med':>8}  "
          f"{'null max':>8}   p")
    for k, r in sorted(m["rows"].items()):
        p = f"<={r['p']:.4f}" if r["at_floor"] else f"  {r['p']:.4f}"
        print(f"  {k:3d}  {k / n:6.2f}  {r['observed']:5d}  "
              f"{r['null_median']:8.1f}  {r['null_max']:8d}   {p}")
    print("  a p on the floor is printed `<=` because an empirical p at "
          "1/(draws+1) reports the RESOLUTION, not the effect (doctrine "
          "57); rows where both columns sit in 0-3 have almost no "
          "resolution either way (doctrine 20)")
    print("  NOTHING IN THIS TABLE IS A THRESHOLD. It is a measurement of "
          "the bank against a "
          + ("matched" if m["matched"] else "deliberately UNMATCHED")
          + " human null, and no draft, word or song is scored against it "
            "anywhere in this tree.")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--sweep", action="store_true",
                    help="the depth spectrum against the matched null")
    ap.add_argument("--check", action="store_true",
                    help="re-derive PINNED; exit 3 on drift")
    ap.add_argument("--words", default="",
                    help="comma-separated words: the per-word disclosure")
    ap.add_argument("--draws", type=int, default=NULL_DRAWS)
    ap.add_argument("--unmatched", action="store_true",
                    help="draw the null WITHOUT length matching — the "
                         "panel's construction, for pricing the matching")
    ap.add_argument("--subset", default="all",
                    help="all | panel6 | after_panel — the register's own "
                         "two sub-readings, re-derivable rather than "
                         "recomputed by hand (standing rule 3)")
    a = ap.parse_args(argv)

    if a.words:
        for l in disclosure_lines(
                disclose([w for w in a.words.split(",") if w.strip()])):
            print(l)
        return 0
    if not (a.sweep or a.check):
        ap.print_help()
        return 0

    # A PIN IS A CLAIM AT A DECLARED RESOLUTION (doctrine 30/57): the
    # spectrum's null median and max were measured at NULL_DRAWS, so
    # re-deriving them at another draw count and calling the difference
    # DRIFT would charge the tree for the caller's own coordinate.
    if a.check and a.draws != NULL_DRAWS:
        print(f"  REFUSED — --check is pinned at {NULL_DRAWS} draws and "
              f"you asked for {a.draws}. A null measured at another "
              f"resolution is a different claim, not a moved figure; run "
              f"--sweep --draws={a.draws} to read it, and repin with a "
              f"date if you mean to change the resolution.")
        return 2
    try:
        m = measure(draws=a.draws, which=a.subset,
                    matched=not a.unmatched)
    except ValueError as e:
        print(f"  REFUSED — {e}")
        return 2
    _print_sweep(m)
    if not a.check:
        return 0
    if a.unmatched:
        print("\n  --check is pinned at the LENGTH-MATCHED null; an "
              "unmatched run prices the matching and pins nothing.")
        return 0
    if a.subset != "all":
        print("\n  --check is pinned at the WHOLE bank; a subset re-derives "
              "a figure and pins nothing (doctrine 20: a reading is not a "
              "pin).")
        return 0

    bad = []
    for key, want in (("bank_songs", len(m["songs"])),
                      ("bank_types", m["types"]),
                      ("human_songs", m["human_songs"]),
                      ("human_files", m["human_files"])):
        if PINNED[key] != want:
            bad.append(f"{key}: pinned {PINNED[key]}, measured {want}")
    for k, (o, med, mx) in sorted(PINNED["spectrum"].items()):
        r = m["rows"].get(k)
        if r is None:
            bad.append(f"k={k}: pinned but not measured (the bank changed "
                       f"size — repin, and say so in MISSING.md M-111)")
        elif (r["observed"], r["null_median"], r["null_max"]) != (o, med, mx):
            bad.append(f"k={k}: pinned {(o, med, mx)}, measured "
                       f"{(r['observed'], r['null_median'], r['null_max'])}")
    if bad:
        print("\n  DRIFT — the pins did not re-derive:")
        for b in bad:
            print(f"    {b}")
        print("  A pin that moved is a defect report until somebody names "
              "the cause: the bank grew, the tagger moved, or the corpus "
              "load changed. Repin WITH the date and a MISSING.md line.")
        return 3
    print("\n  --check: every pin re-derived exactly.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

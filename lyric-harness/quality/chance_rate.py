#!/usr/bin/env python3
"""HOW OFTEN DOES THE SHIPPED DOOR CALL TWO RANDOM WORDS A RHYME — and the
SAMPLER is a DECLARED COORDINATE.

**WHY THIS MODULE EXISTS, and it is a defect report** (`MISSING.md` M-138,
standing rule 3). The chance rate is this repository's oldest comparator
argument: `quality/RESULTS_REDTEAM.md` recorded that the harness was likelier
to call two random dictionary words a rhyme (11.10%) than to fail one of
Shakespeare's mandated pairs (7.2%), a **1.5x** gap, and that sentence got
`theta_coda` recalibrated 0.60 -> 0.80. M-138 then re-ran the same shape of
measurement against the WIDENED door and recorded 350/4000 — **from a script
that lived in one session and was never committed.** Two later re-derivations
disagree with that figure AND WITH EACH OTHER, and the reason is this module's
whole subject: the POPULATION, its ORDER and the DRAW are three coordinates
nobody wrote down, and `rng.choice(sorted(entries))` is not
`rng.choice([w for w in entries if ...])`. A rate is a coordinate of its
sampler (doctrine 58, one axis out), so the sampler is a declared object here
and every reported figure names the cell it came from.

**TWO DOORS, MEASURED SIDE BY SIDE, NEVER SUMMED** (doctrine 79). The complete
default has moved twice and in two different coordinates (`MISSING.md` M-139):

  ADMIT   `admits(s, theta_rhyme, decl.admit)` — read from the DECLARATION,
          never spelled as a literal, which is the exact defect M-138 names in
          `quality/redteam_band.py` and `quality/negative_control.py`.
  SCHEMA  `relations.whole_vocabulary_pairs` — all 77 schemas (M-116, owner
          ruling 2026-08-25). A pair the ADMIT door refuses is still admitted
          by the default when any registered schema answers on it.
  NARROW  the historical `{RHYME, RIME_RICHE}`, carried for the ladder only.

A pair can be admitted by both, so the two counts are reported apart and
`--check` never adds them.

**WHAT THE SCHEMA ARM MEASURES, STATED BEFORE IT IS READ** (doctrine 20). It
judges each drawn pair as a TWO-LINE STREAM of one word each. That is the
question the default asks per pair — do these two lines stand in any named
relation — but it is NOT the production frame: `grade()` hands
`whole_vocabulary_pairs` the WHOLE draft, so a schema reading a stanza, a
refrain tail or a positional frame sees context here that a real song would
supply differently. This arm is a chance rate for the pair IN ISOLATION and it
is not interchangeable with a rate measured on songs.

**IT ADOPTS A BAND, NEVER A POINT** (doctrine 57/73). One seed is a coin flip
reported as a verdict, so `ADOPTED` holds the min and max over the declared
grid and `--check` requires every cell to sit inside it.

    python3 quality/chance_rate.py            # the shipped cell, both doors
    python3 quality/chance_rate.py --sweep    # every declared sampler cell
    python3 quality/chance_rate.py --check    # re-derive the band, exit 3 on drift
"""
import os
import random
import sys
from dataclasses import dataclass

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lyric_harness as L  # noqa: E402
from quality import redteam_band as RB  # noqa: E402


# ---------------------------------------------------------------------------
# The sampler, which is the coordinate M-138 did not declare
# ---------------------------------------------------------------------------

def _pop_redteam(entries):
    """`redteam_band.sample_pairs`' own population. Not respelled here for
    fun: `--check` asserts this reproduces that function's draw exactly, so
    the two cannot drift (doctrine 1)."""
    return [w for w in entries if w.isalpha() and 2 <= len(w) <= 12]


def _pop_all(entries):
    """Every CMUdict key, unfiltered — punctuation, digits, one-letter
    entries and all. The other re-derivation of M-138 used this."""
    return list(entries)


POPULATIONS = {
    "redteam(isalpha,2..12)": _pop_redteam,
    "all entries": _pop_all,
}


def _read_word(lex, w):
    """`quality/redteam_band.py`'s reader: the word's own anchor, scored by
    `score`. This is what adversary 3 does, so the 11.10% precedent is on it."""
    return RB.anchor_of(lex, w), w


def _read_line(lex, w):
    """`Reviser._matrix`'s reader: `line_anchors` over the text, scored by
    `best_score`. THIS IS THE PRODUCTION PATH — `check_scheme` reads the same
    way — so it is the reader a chance rate about the SHIPPED grader wants."""
    ancs, last, _ = L.line_anchors(lex, w)
    return ancs, last


def _score_word(aa, bb, decl, wa, wb):
    return L.score(aa, bb, decl, wa, wb)


def _score_line(aa, bb, decl, wa, wb):
    return L.best_score(aa, bb, decl, wa, wb)


#: A READER is an (anchor, comparator) PAIR and they do not mix: `best_score`
#: takes a max over SPAN pairs and needs `line_anchors`' span dict, and handing
#: it `anchor_of`'s single anchor raises `KeyError: 0`. Measured, not reasoned.
READERS = {
    "word anchor + score": (_read_word, _score_word),
    "line anchor + best_score": (_read_line, _score_line),
}


@dataclass(frozen=True)
class Sampler:
    """WHAT A RATE IS A COORDINATE OF. Every field here moves the number, and
    two fields a session would reach for FIRST do not — see MEASURED INERT."""
    seed: int
    n: int
    population: str
    reader: str

    def label(self):
        return (f"seed {self.seed} n {self.n} | {self.population} | "
                f"{self.reader}")

    def pairs(self, lex):
        words = POPULATIONS[self.population](lex.entries)
        rng = random.Random(self.seed)
        out = []
        while len(out) < self.n:
            a, b = rng.choice(words), rng.choice(words)
            if a == b:
                continue
            out.append((a, b))
        return out


#: **MEASURED INERT, and recorded rather than omitted (doctrine 20).** Two
#: coordinates that look like they must move the number and do not on this
#: population, so they are not fields of `Sampler`:
#:
#:   ORDER — `sorted(pop)` against the dict's own insertion order. CMUdict's
#:     keys are all but sorted already: over the 114,591-word redteam
#:     population `sorted` moves a handful of adjacent entries (`sepulveda`/
#:     `sepultura`, `stilton`/`stilted`), and 8,000 draws never land on one.
#:     Measured: the two orders give byte-identical counts in every cell.
#:   DRAW — `rng.sample(words, 2)` against two `rng.choice(words)` calls with
#:     the identical rejection of `a == b`. `sample` at k=2 over a population
#:     this size consumes `_randbelow` exactly twice, so the two draws are
#:     BYTE-IDENTICAL pair for pair. Measured on the first 5 pairs at seed 1
#:     and on all 4,000 at seed 20260810.
INERT = ("order (sorted vs entries)", "draw (sample-2 vs choice-pair)")

#: The cell a claim about THE SHIPPED GRADER is read off: production's own
#: reader on the precedent's own population.
SHIPPED = Sampler(seed=RB.SEED, n=4000,
                  population="redteam(isalpha,2..12)",
                  reader="line anchor + best_score")

#: The grid the band is adopted over. It is a 2x2 and it is not decorative:
#: **both of M-138's disagreeing re-derivations are exact cells of it**, which
#: is what turns "the figures do not reproduce" into an attribution.
GRID = tuple(Sampler(RB.SEED, 4000, p, r)
             for p in POPULATIONS for r in READERS)


# ---------------------------------------------------------------------------
# The measurement
# ---------------------------------------------------------------------------

def measure(sampler, lex, decl, phon=None, schema=True):
    """-> dict. THREE COUNTS NEVER SUMMED: drawn / refused / judged, and the
    door counts are shares of JUDGED, because a pair CMUdict cannot read was
    never put to any door (doctrine 79)."""
    from collections import Counter
    wide = frozenset(decl.admit)
    narrow = frozenset(L.RHYME_RELATIONS)
    out = {"sampler": sampler, "drawn": 0, "refused": 0, "judged": 0,
           "admit": 0, "narrow": 0, "schema": 0,
           "relations": Counter(), "schema_names": Counter(),
           "schema_only": 0, "admit_only": 0, "both": 0,
           "schema_sole_forbidden": 0, "schema_any_forbidden": 0}
    if schema and phon is None:
        from quality.revise import _relation_phonology
        phon = _relation_phonology()
    disowned = frozenset()
    if schema:
        from quality import relations as RF
        # THE REGISTRY DISOWNS SOME OF ITS OWN NAMES and the judge does not
        # read the field: `RelationSchema.normative` is `forbidden` on
        # `homoioteleuton` (whose own note calls it "THE SINGLE MOST
        # IMPORTANT FALSE-POSITIVE CLASS for any tail comparator", and whose
        # spelled-rime class is this repo's TIER-1 OUTRIGHT BAN) and on
        # `fourth lift must not alliterate`, and `deprecated` on two more.
        # `whole_vocabulary_pairs` iterates `sorted(REGISTRY)` and filters on
        # nothing, so a pair satisfied ONLY by a disowned schema satisfies the
        # default. Counted, never assumed — see `MISSING.md` M-140.
        disowned = frozenset(
            n for n, sc in RF.REGISTRY.items()
            if getattr(sc, "normative", None) in ("forbidden", "deprecated"))
    read, cmp_ = READERS[sampler.reader]
    for a, b in sampler.pairs(lex):
        out["drawn"] += 1
        aa, wa = read(lex, a)
        bb, wb = read(lex, b)
        by_admit = False
        s = None
        if aa and bb:
            try:
                s = cmp_(aa, bb, decl, wa, wb)
            except (KeyError, IndexError, ValueError):
                s = None
        if s is None:
            out["refused"] += 1
        else:
            out["judged"] += 1
            if L.admits(s, decl.theta_rhyme, wide):
                out["admit"] += 1
                out["relations"][s["relation"]] += 1
                by_admit = True
            if L.admits(s, decl.theta_rhyme, narrow):
                out["narrow"] += 1
        if not schema:
            continue
        hit = RF.whole_vocabulary_pairs([a, b], phon).get((1, 2))
        if hit:
            out["schema"] += 1
            for name in hit:
                out["schema_names"][name] += 1
            if any(n in disowned for n in hit):
                out["schema_any_forbidden"] += 1
            if all(n in disowned for n in hit):
                out["schema_sole_forbidden"] += 1
        if hit and by_admit:
            out["both"] += 1
        elif hit:
            out["schema_only"] += 1
        elif by_admit:
            out["admit_only"] += 1
    return out


def rate(m, key):
    """A share of JUDGED, or None when nothing was judged — never 0.0, which
    would read as a measured zero (doctrine 20). The schema arm's denominator
    is DRAWN, because that door needs no anchor to answer."""
    den = m["drawn"] if key == "schema" else m["judged"]
    return (m[key] / den) if den else None


#: The canon arm this rate is read against: the sonnet battery's own violation
#: share, MEASURED and repinned 2026-08-25 (`CLAUDE.md` Test discipline —
#: `python3 battery.py` prints `mandated 1064, judged 1014, refused 50` and
#: `violations 12`). Stated as a coordinate rather than a literal in prose so
#: a battery repin moves this file's ratio too.
CANON_VIOLATIONS, CANON_JUDGED = 12, 1014
CANON_RATE = CANON_VIOLATIONS / CANON_JUDGED

#: THE BAND, adopted over `GRID` (doctrine 57: a figure from a sampler is
#: pinned as a band, never as a cell). Counts, not rates, so the arithmetic
#: is checkable against the printed table.
ADOPTED = {
    "admit": (289, 339),
    "narrow": (36, 46),
    "schema": (897, 932),
}


# ---------------------------------------------------------------------------

def _print(m, decl):
    s = m["sampler"]
    print(f"  {s.label()}")
    print(f"    drawn {m['drawn']}   refused by CMUdict {m['refused']}   "
          f"judged {m['judged']}      (never summed)")
    for key, gloss in (("admit", f"ADMIT  decl.admit={sorted(decl.admit)}"),
                       ("narrow", "NARROW {RHYME, RIME_RICHE} (historical)"),
                       ("schema", "SCHEMA all 77, two-line stream")):
        r = rate(m, key)
        shown = "cannot tell" if r is None else f"{100 * r:6.2f}%"
        ratio = "" if r is None else f"   {r / CANON_RATE:5.2f}x canon"
        print(f"    {key.upper():<7}{m[key]:>6} {shown}{ratio}   {gloss}")
    if m["relations"]:
        print("    ADMIT by relation : "
              + "  ".join(f"{k}={v}" for k, v in
                          sorted(m["relations"].items())))
    if m["schema_names"]:
        top = m["schema_names"].most_common(8)
        print("    SCHEMA top names  : "
              + "  ".join(f"{k}={v}" for k, v in top))
        print(f"    ADMIT only {m['admit_only']}   SCHEMA only "
              f"{m['schema_only']}   both {m['both']}   "
              f"(three counts, never summed)")
        print(f"    DISOWNED  a schema the registry marks forbidden or "
              f"deprecated answered on {m['schema_any_forbidden']}, and was "
              f"the SOLE satisfier on {m['schema_sole_forbidden']}")


def main(argv):
    sweep = "--sweep" in argv
    check = "--check" in argv
    lex, decl = L.Lexicon(), L.Declaration()
    print(f"CHANCE RATE · the shipped door against random CMUdict pairs")
    print(f"  canon arm: {CANON_VIOLATIONS}/{CANON_JUDGED} = "
          f"{100 * CANON_RATE:.2f}% of Shakespeare's mandated pairs fail")
    print()
    cells = GRID if (sweep or check) else (SHIPPED,)
    rows = []
    for s in cells:
        m = measure(s, lex, decl)
        rows.append(m)
        _print(m, decl)
        print()
    if not check:
        return 0

    # --- the band, and the draw-equality assertion ---------------------
    bad = []
    for key, (lo, hi) in sorted(ADOPTED.items()):
        got = [m[key] for m in rows]
        if min(got) < lo or max(got) > hi:
            bad.append(f"{key}: measured {min(got)}..{max(got)}, "
                       f"adopted {lo}..{hi}")
        else:
            print(f"  HOLDS  {key:<7} {min(got)}..{max(got)} "
                  f"inside {lo}..{hi}")
    mine = SHIPPED.pairs(lex)
    theirs = RB.sample_pairs(lex, SHIPPED.n, random.Random(SHIPPED.seed))
    # `SHIPPED` differs from adversary 3 in its READER, never in its DRAW —
    # that is the whole point of holding the population fixed across the grid.
    if mine == theirs:
        print(f"  HOLDS  the SHIPPED cell reproduces "
              f"`redteam_band.sample_pairs` exactly ({len(mine)} pairs)")
    else:
        first = next((i for i, (x, y) in enumerate(zip(mine, theirs))
                      if x != y), min(len(mine), len(theirs)))
        bad.append(f"the SHIPPED cell no longer reproduces "
                   f"`redteam_band.sample_pairs` (first differs at {first})")
    if bad:
        print()
        print(f"MOVED {len(bad)}:")
        for b in bad:
            print(f"  - {b}")
        return 3
    print()
    print("all pins hold")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

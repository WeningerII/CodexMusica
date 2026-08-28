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
    python3 quality/chance_rate.py --null     # does the 77-door separate from a matched redeal?
    python3 quality/chance_rate.py --null --check   # ...and has that answer moved? (exit 3)
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
#:
#: `schema` REPINNED 2026-08-28 from ~~(897, 932)~~ (doctrine 17): the
#: M-148 repair — `relations._seq` reading the post-vocalic CLUSTER and
#: `pair_satisfies` judging at declared tokens — moved which random pairs
#: the consonance-family schemas answer, so the door's chance rate rose
#: with its correctness. Measured 960..994 over the same grid (`--check`'s
#: own MOVED line, reproduced locally the same day); `admit` and `narrow`
#: HELD, which is the control that the sampler and the other two doors did
#: not move. A higher chance rate is a fact about the door and stays
#: unpriced exactly as M-138/M-140 record.
ADOPTED = {
    "admit": (289, 339),
    "narrow": (36, 46),
    "schema": (960, 994),
}


# ---------------------------------------------------------------------------
# THE SEPARATION ARM — does the whole-vocabulary door find anything?
# ---------------------------------------------------------------------------

#: The positive corpus and the null design, DECLARED (doctrine 14: a control
#: may not be defined in terms of the quantity it controls).
#:
#: POSITIVE — a sonnet's own 14 lines, the item this repository's oracle is
#:   built on.
#: NULL — a MATCHED REDEAL: 14 lines, each taken from a DIFFERENT sonnet AT
#:   THE SAME POSITION INDEX. Position is held fixed by construction, so the
#:   null and the observation share their positional marginals and differ only
#:   in whether the fourteen lines came from one poem.
#:
#: **THE OBVIOUS NULL IS THE IDENTITY MAP AND IT WAS TRIED FIRST** (doctrine
#: 63). `quality/negative_control.py`'s line permutation is the null this tree
#: reaches for, and it does NOTHING here: nearly every registered schema is
#: pair-local (`both_line_final` on two words), so permuting WHICH line sits
#: WHERE leaves the set of unordered pairs identical and only jiggles the few
#: gap-bounded schemas. Measured on sonnet 1: real order answers 58 of 91
#: pairs, three permutations answer 62 / 59 / 57. A null centred on the
#: observation is not a null.
NULL_ITEMS = 24
NULL_DRAWS = 20
NULL_LINES = 14


#: THE SEPARATION, ADOPTED (`MISSING.md` M-140). Pinned EXACTLY rather than as
#: a band, and the reason is the opposite of doctrine 57's: this arm draws from
#: a FIXED seed over a FIXED corpus, so it is deterministic and a band would be
#: pretending to a spread it does not have. Drift here means the CORPUS or the
#: COMPARATOR moved, which is an answer.
#:
#: **TWO POPULATIONS, TWO OPPOSITE VERDICTS, NEVER SUMMED** (doctrine 79).
#: The `all` arm does not separate — it sits BELOW its own null — so the
#: "the door answers on three line pairs in four" headline is at chance. The
#: `mandated` arm separates clear of the null's MAXIMUM, so the default is
#: doing real work on the pairs a writer actually declared.
#:
#: GATED BECAUSE THE UNGATED VERSION IS THE DEFECT THIS MODULE WAS BUILT OVER:
#: M-138's figures were recorded from an uncommitted script and did not
#: reproduce. Recording these and gating them with nothing would be the same
#: sitting's own lesson unlearned.
ADOPTED_SEPARATION = {
    "all": {"r_obs": 0.6905, "median": 0.7102, "max": 0.7257},
    "mandated": {"r_obs": 0.9643, "median": 0.7917, "max": 0.8393},
}

#: How far a re-derivation may sit from the pin before it is DRIFT. The figures
#: are means over 24 items, so the fourth decimal is rendering; this is a
#: rounding tolerance and NOT a band (doctrine 58 — a tolerance nobody writes
#: down is a threshold nobody wrote down).
SEPARATION_TOL = 0.0001


def check_separation(log=None):
    """-> exit code. Re-derive the separation arm against `ADOPTED_SEPARATION`.
    Exits 3 on drift, matching this module's other check: a moved figure is an
    ANSWER, not a refusal."""
    r = separation(log=log)
    print()
    _print_separation(r)
    print()
    bad = []
    for key, want in sorted(ADOPTED_SEPARATION.items()):
        got = r[key]
        for field, w in sorted(want.items()):
            g = got[field]
            if abs(g - w) > SEPARATION_TOL:
                bad.append(f"{key}.{field}: adopted {w:.4f}, "
                           f"measured {g:.4f}")
            else:
                print(f"  HOLDS  {key + '.' + field:<18} {w:.4f}")
    # THE VERDICT IS PINNED TOO, not only the numbers: the whole point of the
    # entry is that one arm separates and the other does not, and a tree where
    # both moved to the same side would hold every number above and mean
    # something else entirely.
    for key, want_sep in (("all", False), ("mandated", True)):
        got_sep = r[key]["excess_over_median"] > 0
        if got_sep != want_sep:
            bad.append(f"{key}: adopted separates={want_sep}, "
                       f"measured separates={got_sep} — THE VERDICT MOVED, "
                       f"which is a different finding from a moved number")
        else:
            print(f"  HOLDS  {key} separates={want_sep}")
    if bad:
        print()
        print(f"MOVED {len(bad)}:")
        for b in bad:
            print(f"  - {b}")
        return 3
    print()
    print("the separation holds, and so does each arm's verdict")
    return 0


def _sonnets(path="corpus/sonnets.txt"):
    import battery
    out = [s["lines"] if isinstance(s, dict) else s
           for s in battery.parse_sonnets(path)]
    return [s for s in out if len(s) == NULL_LINES]


#: The sonnet oracle's own scheme, ABAB CDCD EFEF GG, as 1-based line pairs.
#: These are the pairs the POET declared; everything else in the 91 is a pair
#: nobody asked about. The two populations answer DIFFERENT questions and are
#: never summed (doctrine 79):
#:   ALL PAIRS - how much of the relation graph this door lights up. This is
#:     the population the M-139 lane's 73.09% is over.
#:   MANDATED  - whether "the default satisfied it" carries information about
#:     a pair somebody DECLARED. This is the ENFORCEMENT question, and it is
#:     the one the mandate layer actually asks.
SONNET_MANDATED = ((1, 3), (2, 4), (5, 7), (6, 8), (9, 11), (10, 12), (13, 14))


def _answered(lines, phon, RF):
    """-> (all-pairs rate, mandated-pairs rate) off ONE stream build."""
    n = len(lines)
    got = RF.whole_vocabulary_pairs(list(lines), phon)
    allr = len(got) / (n * (n - 1) / 2)
    hit = sum(1 for pr in SONNET_MANDATED if pr in got)
    return allr, hit / len(SONNET_MANDATED)


def separation(seed=None, items=NULL_ITEMS, draws=NULL_DRAWS, log=None):
    """-> dict. The whole-vocabulary door's observed rate against its matched
    redeal. Reports the excess over the null MEDIAN and over the null MAX as
    TWO statistics under two labels, because this repository has quoted those
    two under one word before and `CLAUDE.md` records what it cost."""
    import random as _r
    import statistics
    from quality import relations as RF
    from quality.revise import _relation_phonology
    phon = _relation_phonology()
    son = _sonnets()
    rng = _r.Random(RB.SEED if seed is None else seed)
    pos = son[:items]
    obs = [_answered(s, phon, RF) for s in pos]
    r_all = statistics.mean(x[0] for x in obs)
    r_man = statistics.mean(x[1] for x in obs)
    n_all, n_man = [], []
    for d in range(draws):
        va, vm = [], []
        for _ in pos:
            picks = rng.sample(range(len(son)), NULL_LINES)
            a, m = _answered([son[p][i] for i, p in enumerate(picks)],
                             phon, RF)
            va.append(a)
            vm.append(m)
        n_all.append(statistics.mean(va))
        n_man.append(statistics.mean(vm))
        if log:
            log(f"    null draw {d + 1}/{draws}: all {n_all[-1]:.4f}  "
                f"mandated {n_man[-1]:.4f}")
    out = {"items": len(pos), "draws": draws}
    for key, r_obs, null in (("all", r_all, n_all),
                             ("mandated", r_man, n_man)):
        null = sorted(null)
        # An empirical p at 1/(n+1) reports the RESOLUTION, not the effect
        # (doctrine 57), so the draw count is carried beside it.
        at_least = sum(1 for x in null if x >= r_obs)
        out[key] = {"r_obs": r_obs, "median": statistics.median(null),
                    "min": null[0], "max": null[-1],
                    "excess_over_median": r_obs - statistics.median(null),
                    "excess_over_max": r_obs - null[-1],
                    "p_empirical": (at_least + 1) / (draws + 1)}
    return out


def _print_separation(r):
    print("  SEPARATION - the 77-schema door against a MATCHED REDEAL")
    print(f"    {r['items']} sonnets, {r['draws']} null draws, "
          f"{NULL_LINES} lines each; null = each line from a DIFFERENT "
          f"sonnet at the SAME position index")
    for key, gloss in (("all", "ALL 91 line pairs - how much of the graph "
                               "this door lights up"),
                       ("mandated", "the 7 pairs the POET declared - the "
                                    "ENFORCEMENT question")):
        d = r[key]
        print()
        print(f"    {key.upper()}: {gloss}")
        print(f"      R_obs                   : {100 * d['r_obs']:.2f}%")
        print(f"      null median / min / max : "
              f"{100 * d['median']:.2f}% / {100 * d['min']:.2f}% / "
              f"{100 * d['max']:.2f}%")
        print(f"      excess over null MEDIAN : "
              f"{100 * d['excess_over_median']:+.2f} pp")
        print(f"      excess over null MAX    : "
              f"{100 * d['excess_over_max']:+.2f} pp   "
              f"(TWO statistics, two labels - never one word for both)")
        print(f"      empirical p             : {d['p_empirical']:.4f} at "
              f"{r['draws']} draws (doctrine 57: a p at "
              f"{1 / (r['draws'] + 1):.4f} is the resolution, not the effect)")
        if d["excess_over_median"] <= 0:
            print("      VERDICT: does NOT separate from its own null - it "
                  "sits AT OR BELOW it. Doctrine 71: a rate that does not "
                  "separate from its null is not a finding about the text.")
        else:
            print(f"      VERDICT: separates by "
                  f"{100 * d['excess_over_median']:+.2f} pp over the median "
                  f"and {100 * d['excess_over_max']:+.2f} pp over the max.")
    print()
    print("    THE TWO ARE NEVER SUMMED AND NEVER READ AS ONE (doctrine 79): "
          "a door can light up an arbitrary pair at chance and still "
          "discriminate a DECLARED one, and only the second is what the "
          "mandate layer asks.")


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
    if "--null" in argv:
        lg = (lambda t: print(t, flush=True))
        if check:
            return check_separation(log=lg)
        r = separation(log=lg)
        print()
        _print_separation(r)
        return 0
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

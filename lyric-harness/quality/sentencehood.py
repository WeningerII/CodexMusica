#!/usr/bin/env python3
"""The sentencehood layer: a line of stacked nouns is not a sung phrase.

    python3 quality/sentencehood.py DRAFT      # report one draft
    python3 quality/sentencehood.py --check    # re-derive the calibration

WHY THIS EXISTS. Every enforcement layer in this tree checks SOUND — rhyme,
meter, syllable bands, predictability, density. None asked whether a line has
a verb in it, so `songs/long_bridge.txt` satisfied every constraint while its
lines were comma-spliced inventories ("Spark, full height, cinder, ash,
sleeve") and shipped at exit 0. A blind five-judge panel (2026-08-25, run 1,
`quality/RESULTS_PANEL.md`) rejected it 5/5 — every lens converging on one
cause: lines without verbs, "no phrase a melody could carry."

WHAT IS GATED IS NARROWER THAN WHAT THE PANEL HEARD, AND THE NUMBERS SAY WHY.
Two modes were measured (all figures re-derived by `--check`):

  - THE FLAGRANT MODE — the noun stack: verbless AND function-word-poor AND
    comma-dense. Separable at line grain: `long_bridge` carries 4 such lines
    in 25 where the 500-song human calibration sample runs a p99 of 0.125
    stacked-line fraction per song. THIS GATES (`STACKED_DRAFT`, a flag).
  - THE SUBTLE MODE — merely verbless lines, even two adjacent: REFUSED AS A
    GATE BY MEASUREMENT. Human songs carry a verbless line in 33% of lines
    and a 2-run in 32% of sections, and the seven lines of the panel's three
    subtly-rejected sections are statistically IDENTICAL to human verbless
    lines on every surface feature measured (function share 0.40 vs 0.38,
    commas/token 0.143 vs 0.143). A gate here would charge a third of the
    canon (doctrine 7/22). The panel remains the only instrument for that
    mode, and this docstring is the record that the gate was refused rather
    than forgotten (doctrine 20).

SEVERITY. `STACKED_DRAFT` is a WHOLE-DRAFT FLAG, the same species as the
floor's `LEXICAL_MONOTONY` / `FUNCTION_WORD_HEAVY`: it fails `song` (exit 3)
and rejects a regressing revision through `verify()`'s `new_flags`, and it
cannot stop `revise_loop` (no single line names it, and the loop's own
docstring prices what promoting such a code costs). `STACKED_LINE` is a
per-line NOTE naming each stacked line, so the brief can show a writer WHERE.

THE TAGGER IS `quality/features.py`'s OWN (one definition, doctrine 1), and
its absence is a disclosed refusal, never a silent pass: `report()` returns
`available=False` and `Reviser.inspect` carries `sentencehood_checked` the
way it carries `blueprint_declared`.
"""
import argparse
import os
import re
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

#: ADOPTED 2026-08-25, every value a measurement (`--check` re-derives all of
#: them; `quality/RESULTS_PANEL.md` §4 is the derivation record):
#:   FUNC_SHARE_MAX / COMMAS_PER_TOKEN_MIN — the cell of the swept 2-D grid
#:     with the tightest human false-positive rate that still reads
#:     `long_bridge`'s stacked lines: 1.17% of 3,000 human song lines, 0.80%
#:     of 1,500 sonnet lines (doctrine 22 — the threshold IS the FPR).
#:   STACKED_FRACTION_MAX — the p99 of per-song stacked-line fraction over a
#:     fixed-seed 500-song sample of `corpus/song/eng_*` (1.4% of human songs
#:     sit at or above it; `long_bridge` reads 0.16).
#:   MIN_LINES — the calibration sample admitted songs of >= 8 lines, so the
#:     gate asks nothing of drafts shorter than its own population.
#:   MIN_TOKENS — a line of one to three tokens ("Almost.", "Hands up.") is
#:     below the texture the predicate reads; the panel charged none.
ADOPTED = {
    "FUNC_SHARE_MAX": 0.15,
    "COMMAS_PER_TOKEN_MIN": 0.15,
    "MIN_TOKENS": 4,
    "STACKED_FRACTION_MAX": 0.125,
    "MIN_LINES": 8,
}

#: Finite-verb tags. VB counts only OUTSIDE `to`/modal scope — an imperative
#: ("Carry it") is finite, an infinitive ("Nothing to spare") is not.
FINITE = ("VBD", "VBP", "VBZ", "MD")

_TAGGER = None


def tagger():
    """-> the pos tagger, or None with the reason recorded. One definition:
    `quality/features.py`'s own `_tagger`, never a second nltk setup."""
    global _TAGGER
    if _TAGGER is None:
        try:
            from quality import features as F
            _TAGGER = ("ok", F._tagger())
        except Exception as e:                            # noqa: BLE001
            _TAGGER = ("unavailable", str(e))
    return _TAGGER[1] if _TAGGER[0] == "ok" else None


@dataclass
class Finding:
    """Same shape as `quality.floor.Finding`, deliberately — a caller that
    renders floor findings renders these with no new code. Declared here
    rather than imported so this module stands alone."""
    code: str
    severity: str            # "flag" | "note"
    message: str
    evidence: str
    locations: list = field(default_factory=list)

    def __str__(self):
        loc = f" (lines {', '.join(map(str, self.locations))})" if \
            self.locations else ""
        return f"[{self.severity.upper():4}] {self.code}: {self.message}{loc}\n" \
               f"         {self.evidence}"


def _tokens(line):
    return re.findall(r"[A-Za-z']+", line)


def line_is_stacked(line, tag=None):
    """-> True when the line is a NOUN STACK: no finite verb, at most
    FUNC_SHARE_MAX function-tag share, at least COMMAS_PER_TOKEN_MIN commas
    per token, and at least MIN_TOKENS tokens. Ordinary verbless lines — a
    prepositional phrase, a one-word fragment — are NOT stacked; the human
    calibration is what holds that boundary."""
    tag = tag or tagger()
    if tag is None:
        raise RuntimeError("no tagger — callers go through report()")
    from quality.features import FUNCTION_TAGS
    tt = tag(_tokens(line))
    if not tt or len(tt) < ADOPTED["MIN_TOKENS"]:
        return False
    prev, finite = "", False
    for _w, t in tt:
        if t in FINITE or (t == "VB" and prev not in ("TO", "MD")):
            finite = True
        prev = t
    if finite:
        return False
    func = sum(1 for _w, t in tt if t in FUNCTION_TAGS) / len(tt)
    commas = line.count(",") / len(tt)
    return (func <= ADOPTED["FUNC_SHARE_MAX"]
            and commas >= ADOPTED["COMMAS_PER_TOKEN_MIN"])


def report(lines):
    """-> {"available", "findings", "stacked", "fraction"}.

    `available=False` means the tagger could not be built — a refusal, not a
    clean draft (doctrine 20) — and carries zero findings so an environment
    without nltk grades exactly as it did before this module existed."""
    tag = tagger()
    if tag is None:
        return {"available": False, "findings": [], "stacked": [],
                "fraction": 0.0, "why": _TAGGER[1]}
    stacked = [i for i, l in enumerate(lines, 1) if line_is_stacked(l, tag)]
    frac = len(stacked) / len(lines) if lines else 0.0
    out = []
    for ln in stacked:
        out.append(Finding(
            "STACKED_LINE", "note",
            "a stack of words, not a sung phrase — no finite verb, almost no "
            "function words, comma-spliced",
            f"L{ln}: {lines[ln - 1]!r}. The panel's own words for this "
            f"texture: 'no phrase a melody could carry'. One such line is a "
            f"choice; the draft gate below is what a pattern of them trips.",
            [ln]))
    if len(lines) >= ADOPTED["MIN_LINES"] and \
            frac >= ADOPTED["STACKED_FRACTION_MAX"]:
        out.append(Finding(
            "STACKED_DRAFT", "flag",
            f"{len(stacked)} of {len(lines)} lines are word stacks "
            f"({frac:.0%}) — at or above the calibrated ceiling "
            f"({ADOPTED['STACKED_FRACTION_MAX']:.1%}, the p99 of 500 human "
            f"songs; 1.4% of the canon sits there)",
            "lines " + ", ".join(map(str, stacked)) + ". This is the failure "
            "no sound-layer check can hear: every rhyme and bar can be "
            "satisfied by lines that are lists. Rewrite the named lines as "
            "utterances — the pin words can stay; the syntax around them is "
            "what is missing.",
            []))
    return {"available": True, "findings": out, "stacked": stacked,
            "fraction": frac}


# ------------------------------------------------------------ calibration
def _calibration(n_songs=500, seed=20260825):
    """Re-derive every ADOPTED figure on the fixed protocol. Deterministic:
    sorted file list, seeded shuffle, first `n_songs` marked songs of >= 8
    lines."""
    import glob
    import random
    from quality import grid as GR
    tag = tagger()
    if tag is None:
        return None
    files = sorted(glob.glob(os.path.join(ROOT, "corpus/song/eng_*.txt")))
    rng = random.Random(seed)
    rng.shuffle(files)
    fracs, lines_seen, stacked_lines = [], 0, 0
    n = 0
    for p in files:
        if n >= n_songs:
            break
        try:
            marked = GR.read_marked_songs(p)
        except Exception:                                 # noqa: BLE001
            continue
        for ms in marked:
            if n >= n_songs:
                break
            ls = [l for b in ms.blocks for l in b.lines]
            if len(ls) < ADOPTED["MIN_LINES"]:
                continue
            n += 1
            k = sum(1 for l in ls if line_is_stacked(l, tag))
            lines_seen += len(ls)
            stacked_lines += k
            fracs.append(k / len(ls))
    fracs.sort()
    return {"songs": n, "line_fpr": stacked_lines / max(1, lines_seen),
            "p99": fracs[int(0.99 * len(fracs))],
            "song_fpr": sum(1 for x in fracs
                            if x >= ADOPTED["STACKED_FRACTION_MAX"]) / n}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("draft", nargs="?")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)
    if a.check:
        cal = _calibration()
        if cal is None:
            print("REFUSED — no tagger in this environment; the calibration "
                  "cannot be re-derived and is not thereby confirmed "
                  "(doctrine 20)")
            return 2
        ok = True
        print(f"  {cal['songs']} songs re-measured on the fixed protocol")
        # the line FPR is PROTOCOL-SCOPED and not an adopted constant: this
        # sample reads 0.0086; the flat 3,000-line sample in the RESULTS doc
        # reads 0.0117. Two populations, two figures, one name would be
        # doctrine 1's own defect — so only the ceiling and the witnesses can
        # FAIL this check, and the rate is printed for the reader.
        print(f"  human line FPR {cal['line_fpr']:.4f} (protocol-scoped; "
              f"the flat-sample figure in RESULTS_PANEL.md is 0.0117)")
        print(f"  per-song fraction p99 {cal['p99']:.4f} "
              f"(adopted ceiling {ADOPTED['STACKED_FRACTION_MAX']})")
        print(f"  songs at/over ceiling {cal['song_fpr']:.4f} "
              f"(adopted claim ~0.014)")
        if abs(cal["p99"] - ADOPTED["STACKED_FRACTION_MAX"]) > 1e-9:
            ok = False
            print("  DRIFT: the sample's p99 no longer equals the adopted "
                  "ceiling — re-adopt deliberately, do not average")
        # the banked songs are fixed witnesses (their bytes never move),
        # so their readings are pinned here the way `song_record --check`
        # pins their features: a moved reading means the INSTRUMENT moved.
        from lyric_harness import load_lyric_lines
        witness = {"long_bridge": 4, "one_more": 0, "turn_the_wheel": 0,
                   "stay_awake": 0, "carry_it_over": 0, "keep_the_light": 0,
                   # the forward-validation song (M-110): written WITH the
                   # gate live, banked at 0 stacked lines — the pinned proof
                   # the gate changed the writing and not only the grading.
                   "taught_me_time": 0,
                   # series song #3 (seed 2), written screen-first under the
                   # same live gate: 0 stacked lines on its first grading.
                   "wheat_mane": 0}
        for s, want in sorted(witness.items()):
            p = os.path.join(ROOT, "songs", s + ".txt")
            if not os.path.exists(p):
                continue
            got = len(report(load_lyric_lines(p))["stacked"])
            mark = "ok" if got == want else "MOVED"
            if got != want:
                ok = False
            print(f"  witness {s}: {got} stacked line(s), pinned {want} "
                  f"[{mark}]")
        print("\nRESULT:", "PASS" if ok else "FAIL")
        return 0 if ok else 3
    if not a.draft:
        ap.print_help()
        return 2
    from lyric_harness import load_lyric_lines
    lines = load_lyric_lines(a.draft)
    rep = report(lines)
    if not rep["available"]:
        print(f"REFUSED — no tagger: {rep['why']}")
        return 2
    print(f"  {len(rep['stacked'])} stacked line(s) of {len(lines)} "
          f"({rep['fraction']:.1%})")
    for f in rep["findings"]:
        print(f)
    return 3 if any(f.severity == "flag" for f in rep["findings"]) else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Adversary 4 — mutation testing. Can this suite detect a broken harness?

    python3 quality/mutate.py             # declared subsets, escalate on survival
    python3 quality/mutate.py --full      # every mutation against every green test
    python3 quality/mutate.py --dry-run   # only check the mutation list still applies
    python3 quality/mutate.py --only M1 M12 --jobs 4
    python3 quality/mutate.py --only QF1 --tests quality/test_floor.py

WHAT IS MUTATED, AND THE GAP THAT WAS FOUND IN 2026-08-13
---------------------------------------------------------
Until 2026-08-13 every mutation in this file landed in `lyric_harness.py` or
`battery.py`: 2 of the repo's 64 production `.py` files, 4,794 of its 50,722
production lines, and NOTHING under `quality/`. So the entire quality layer --
`floor.py` (the slop floor), `revise.py` (the loop's gate), `schemes.py`
(mandate semantics), `grid.py`, `fit.py` -- had its tests written, run and
believed with no measurement of whether they could fail at all, which is
precisely the population doctrine 94 says a positive-case suite cannot police.
`test_mutation.py`'s own coverage check did not see it, because that check is
keyed on LAYER and every layer was already covered inside one file: a coverage
check keyed on layer is blind to a coverage gap keyed on file.

The `Q*` block at the end of `MUTATIONS` is that layer, and most of its
mutations are chosen to make a rule MORE GENEROUS rather than merely different
-- a check that fires more often is caught by any positive assertion that
happens to run, and a check that fires LESS often is invisible to every one of
them.

WHY THIS FILE EXISTS
--------------------
On 2026-08-11 the head/tail alignment fix in `channel_agreement` -- the most
consequential fix in the project, changing the band's verdict on 79.9% of
unequal-length anchor pairs across the 152 sonnets -- was reverted by hand, and
all 23 test files plus `battery.py` were run. Nothing failed. Two controls
(`theta_rhyme` 0.75 -> 0.50, and the coda channel forced True) were both caught,
so the suite is not inert; it is BLIND TO THAT CLASS. A passing suite was
therefore evidence about nothing in particular.

A test suite is an instrument, and an instrument that has never been pointed at
a known signal has no measured sensitivity (doctrine 31, arriving one layer up:
run the positive control before believing any null, and a green suite is a
null). This file is that positive control. Each MUTATION is a planted defect
with a known location; a mutation that no test kills is a HOLE, reported by
name, and the hole names the test that should have existed.

WHAT "CAUGHT" MEANS, PRECISELY
------------------------------
A test file catches a mutation when it is GREEN at baseline and RED under the
mutation. A test already red at baseline is excluded from the detector set for
the whole run and reported separately: it cannot distinguish anything, because
it fails either way.

`quality/test_fwer.py` USED TO BE THE STANDING EXAMPLE HERE and no longer is.
This paragraph read "at the time of writing `quality/test_fwer.py` is in that
state -- its four failures are real findings about the time layer and they are
also, for this instrument, a blind spot". MEASURED 2026-08-13: `python3
quality/test_fwer.py` exits 0, `all family-wise-error regressions pass`. So the
blind spot named here closed and the sentence naming it did not, which is
doctrine 58's shape one layer over -- a RED-AT-BASELINE list is a coordinate of
the suite on the day it was written, and this one went stale in the only place
a reader is invited to trust it. The list is not maintained in prose at all
now: `baseline()` computes it every run and `report()` prints it, so the
authority is the run and never this docstring.

A TIMEOUT IS NOT A CATCH, corrected 2026-08-13. `run_test` returns four
statuses and the runner used to treat all three non-PASS ones alike, so a test
killed at its wall-clock limit -- routine on a box shared with five sibling
sessions, where load average sat at 34 on four cores while this was written --
was recorded as the DETECTOR of whatever mutation happened to be running. That
is a refusal in the numerator (doctrine 79) with the worst possible sign: it
credits the suite with a detection it never made and reports a hole as covered.
Every timeout is now re-run alone, unconditionally, and if it still does not
finish the mutation is INDETERMINATE -- neither caught nor survived, counted
and printed separately, because "no test disagreed" and "one test never got to
the end of itself" are different facts.

`battery.py` is included and it IS a detector, as of `9396946` (2026-08-11):
`assert_pinned` compares the sonnet oracle against `EXPECTED` and `__main__`
exits 1 on any drift. It appears in the table on that ground now.

CORRECTED 2026-08-13. This paragraph, and `discover_tests`'s docstring below,
both read "NOT a detector: its `__main__` prints and returns, so its exit
status is 0 whatever it observes" -- true when written, false for two days
before anyone re-read it, and load-bearing here because the inclusion was
justified ON that ground. The mutation table's own figures for `battery.py`
were therefore collected against an instrument the comment said could not
catch anything. What it pins is narrow (`mandated`/`judged`/`refused`/
`violations`); Whitman and the limericks still print unasserted, so a mutation
that moves only those is still invisible to it.

A SHRINKING INVENTORY IS A FAILURE, NOT A "CANNOT TELL"
--------------------------------------------------------
`--dry-run` exits 0 when every declared mutation applies to the current source
and 1 when any does not, naming each mutation, the KIND of defect and the file
it targets. It costs ~0.15 s and reads 0.7 MB, so there is no budget argument
for not asking.

It is the only carrier of that fact that cannot be silenced by writing a file.
`quality/counters.py`'s `mutations declared` row is derived from this command
and it does fail -- once. Its remedy for a moved value cell is `--write`, and
`--write` commits `REFUSED (cost) — the instrument did not answer` into
BACKLOG.md and exits 0, after which `--check` compares REFUSED against REFUSED
and prints PASS with the mutations still inert. That path is not hypothetical:
the `public symbols` row moves under sibling lots every few hours and `--write`
is its remedy too, so a lot clearing an unrelated red cell launders this one in
the same command. Measured, both directions, in `main()`'s comment below.

FOUR KINDS, BECAUSE FOUR REMEDIES. STALE (anchor gone -- re-anchor or retire
with a reason), AMBIGUOUS (anchor names more than one site -- `apply_mutation`
replaces EVERY occurrence, so the planted defect would be larger than the
`rationale` describes, and a mutation that silently MOVES is worse than one
that fails), NO-OP (`old` == `new` -- nothing is planted), NO-FILE (the target
module is gone). `anchor_defect` is the single predicate; `apply_mutation`,
`--dry-run` and `quality/test_mutation.py` section 2 are its three callers,
which until 2026-08-14 were three separately-maintained spellings of it.

NEVER LEAVES A MUTATED FILE ON DISK
-----------------------------------
No mutation is ever written into the working tree. ONE frozen snapshot of the
repo is taken per run, and each mutation gets a private SHADOW TREE copied from
it and removed in a `finally`. Everything writable is COPIED and only the bulk
read-only data is SYMLINKED, because `open(path, "w")` FOLLOWS a symlink: with
`data/` linked whole, a mutant's `feature_cache.json` would land in the real
repo and be read back by the next honest run. The snapshot is taken once rather
than per mutation so that thirty mutations are thirty readings of ONE codebase
-- five sibling sessions are editing this repo, and building each mutant from
the live tree would make "caught" mean "somebody saved a file between two
builds".

`verify_pristine()` then reads the real files at the end and separates three
outcomes that look alike and are not: the mutant text being PRESENT (a failed
restore, loud), the anchor being GONE (a sibling refactor -- the list is stale,
which is a finding about the list), and a sha256 diff over every root `.py`
(information, since this runner cannot cause it).

RUNTIME
-------
The suite is ~106 s of CPU serial and there are thirty mutations, so the honest
version of this instrument is ~53 minutes of CPU. Four things make it runnable:
each mutation declares a test SUBSET chosen by LAYER (not by which tests were
observed to catch it -- a subset derived from the answer proves nothing); the
runner escalates a mutation that survives its subset to the FULL suite before
ever calling it a survivor, so the expensive path is paid only where the answer
matters; parallelism runs on two axes (tests within a mutation, and mutations
against each other); and the baseline is cached against a fingerprint of every
`.py` in the repo, so it is recomputed exactly when the code changes.

`--full` runs everything against everything and is the audit -- the table that
names WHICH test caught each mutation, and therefore which single file a hole
depends on.

Doctrine 66: `SEED` below is fixed and stated, and every child process runs
under `PYTHONHASHSEED=SEED` so that a tie broken by iterating a set cannot make
a mutation look caught on one run and survived on the next. That is not the
only source of irreproducibility here, and the other one bit: see
LOAD_SENSITIVE.
"""

import argparse
import collections
import concurrent.futures as futures
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field

#: Doctrine 66. Every child process gets this as PYTHONHASHSEED, so a result
#: that depends on set-iteration order is reproducible instead of flapping.
SEED = 20260811

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

#: Bulk data directories symlinked WHOLE: 291 of the repo's 295 MB, and read
#: -only in every code path the suite exercises. Everything else is mirrored as
#: real directories so that a test which WRITES lands inside the shadow.
#:
#: That distinction is not fussiness. `quality/discriminate.py` writes
#: `data/feature_cache.json` and `quality/provenance.py` writes a ledger beside
#: it. Under a whole-tree symlink, `open(path, "w")` FOLLOWS the link and
#: writes through to the real file -- so a mutant's cached features would land
#: in the working tree and be read back by the next honest run. A mutation
#: runner that poisons the thing it is measuring is worse than none.
#:
#: `corpus/` is on the list for the same reason and with the same evidence:
#: `grep -l 'kalevala_rate\|prasa_rate' quality/test_*.py` is empty, so the
#: only two modules that write into it are reached from their own `__main__`
#: staging paths and never from a test. It is 21 of the 23 MB a shadow tree
#: would otherwise copy, and this runner shares a disk with five sibling
#: sessions -- the first full audit died on ENOSPC.
SYMLINK_DIRS = (os.path.join("data", "labels"),
                os.path.join("data", "authority_src"),
                os.path.join("data", "nltk"),
                "corpus")
#: Files at or below this are copied; above it they are symlinked. The 16 files
#: over the line are dictionaries and label tables, none of them written.
COPY_MAX_BYTES = 2 * 1024 * 1024
SKIP_NAMES = {"__pycache__", ".git", ".pytest_cache", ".mypy_cache"}

#: `quality/test_mutation.py` drives THIS module, so running it as a child
#: would recurse. It is excluded here and it also refuses to run when it sees
#: LYRIC_MUTATE_ACTIVE in the environment -- two independent guards, because
#: one of them is a list somebody will edit.
EXCLUDE_TESTS = {os.path.join("quality", "test_mutation.py")}

#: Tests whose verdict depends on WALL CLOCK, and which therefore cannot be
#: trusted while other processes are on the machine. Derived by grep, not by
#: taste: `grep -n 'time.time()' quality/test_*.py` returns exactly one file.
#: `test_relations.py` requires 30k units to build in under 3 seconds, so under
#: nine processes on four cores it goes red under a mutation it cannot see --
#: and the runner would then report a HOLE AS COVERED, which is the worst
#: direction for this instrument to fail in. Reds in this set are re-run with
#: the machine to themselves before they count. `--confirm-all` applies the
#: same treatment to every red, which is the honest setting if this list is
#: ever suspected of being incomplete.
LOAD_SENSITIVE = {os.path.join("quality", "test_relations.py")}


# ---------------------------------------------------------------------------
# The declared mutations
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Mutation:
    """A planted defect with a known location.

    `subset` is declared by LAYER and by hand. It is deliberately NOT the set
    of tests observed to catch the mutation: a subset derived from the answer
    proves nothing, and the escalation path below means a wrong subset costs
    time rather than correctness.
    """
    name: str
    layer: str
    file: str
    old: str
    new: str
    rationale: str
    subset: tuple = ()


def _q(*names):
    return tuple(os.path.join("quality", n) for n in names)


# The declared per-layer subsets. Two rules govern what goes in them, and the
# second is the one that makes the first safe:
#
#   1. Chosen by LAYER, by hand, from what the file is ABOUT -- never from
#      which tests were observed to catch the mutation. A subset derived from
#      the answer is a tautology dressed as a shortcut.
#   2. Chosen CHEAP. `test_readability.py` is the canonical ingestion test and
#      it is deliberately NOT in T_INGEST, because it costs 39 s and appears
#      in five subsets. That costs nothing in correctness: a mutation its
#      subset misses ESCALATES to the entire green suite before it is allowed
#      to be called a survivor, so the subset is a speed heuristic and the
#      full suite is the verdict.
#
# Cheapness is not cosmetic here. A sibling session running
# `for f in quality/test_*.py` will run `test_mutation.py`, which runs all of
# this; a default that takes ten minutes gets killed by somebody's `timeout`
# and reported as a failure of the harness.
# test_coda.py ADDED 2026-08-11 (cell BA's owed patch): it is a band-layer
# file -- M3 (`min(codas)` -> `max(codas)`) was SURVIVING the whole suite
# because nothing in the fast subset exercised the coda channel's own
# per-syllable conjunction, and only escalation to the full green suite
# caught it. Adding it here catches M3/M5/M6 in the subset pass instead of
# paying the full-suite escalation for every mutation that touches this file.
T_BAND = _q("test_band.py", "test_mut_band.py", "test_coda.py")
T_CMP = _q("test_band.py", "test_mut_band.py", "test_taxonomy.py")
T_ANCHOR = _q("test_mut_band.py", "test_meter.py", "test_taxonomy.py")
T_STRUCT = _q("test_mut_oracle.py", "test_english_text.py", "test_grid.py")
T_VALUE = _q("test_mut_oracle.py", "test_band.py", "test_relations.py")
T_INGEST = _q("test_mut_oracle.py", "test_english_text.py",
              "test_mut_band.py")
T_PROJ = _q("test_mut_band.py", "test_phonology.py", "test_meter.py")

# THE QUALITY LAYER'S OWN SUBSETS, ADDED 2026-08-13. Rule 1 above still holds
# and it bites harder here: these are chosen from what the MODULE is about,
# and for four of the five there is exactly one test file that imports it at
# all, so "chosen by layer" and "chosen by importer" coincide. Rule 2 does NOT
# hold here and saying so is the point -- `test_floor.py` is 82 s solo and it
# is the ONLY importer of `quality/floor.py` in the repo, so there is no cheap
# proxy to put in front of it. A cheap subset would be a subset that cannot
# catch anything, which is worse than an expensive one.
#
# The escalation rule is what makes an expensive subset affordable and a wrong
# one harmless: a mutation its subset misses runs the rest of the inventory
# before it is allowed to be called a survivor.
T_FLOOR = _q("test_floor.py")
T_LOOP = _q("test_revise.py", "test_loop.py")
T_MANDATE = _q("test_mandate_language.py", "test_grid.py", "test_taxonomy.py")
T_SONG = _q("test_grid.py", "test_song_function.py")
T_METER = _q("test_fit.py", "test_grid.py")

LH = "lyric_harness.py"
BAT = "battery.py"
FLOOR = os.path.join("quality", "floor.py")
REVISE = os.path.join("quality", "revise.py")
SCHEMES = os.path.join("quality", "schemes.py")
GRID = os.path.join("quality", "grid.py")
FIT = os.path.join("quality", "fit.py")

MUTATIONS = [
    # ---------------------------------------------------------------- band
    Mutation(
        name="M1", layer="band", file=LH,
        old="    ta, tb = anc_a[-n:], anc_b[-n:]",
        new="    ta, tb = anc_a[:n], anc_b[:n]",
        subset=T_BAND,
        rationale=(
            "THE ONE. Revert the 2026-08-11 fix: align the two anchors flush "
            "LEFT, as the comparator did from the first commit, while rhyme "
            "aligns flush RIGHT. Equal-length spans compute identically, which "
            "is why `nation`/`station` cannot see it and why the sonnet oracle "
            "did not move. 67.8% of candidate anchor-span pairs on the sonnets "
            "are unequal-length and the two alignments disagree on 79.9% of "
            "those. Survived the whole suite once; if it ever survives again "
            "this file has stopped working."),
    ),
    Mutation(
        name="M2", layer="band", file=LH,
        old='    nuc = min(vowel_sim(ta[i]["nucleus"], tb[i]["nucleus"])',
        new='    nuc = max(vowel_sim(ta[i]["nucleus"], tb[i]["nucleus"])',
        subset=T_BAND,
        rationale=(
            "min -> max in the conjunctive-across-syllables reduction, nucleus "
            "channel. The whole point of the reduction is that the weakest "
            "aligned syllable decides; max lets a strong first syllable BUY a "
            "weak second, which is doctrine 21's compensation defect moved "
            "from the comparator into the band."),
    ),
    Mutation(
        name="M3", layer="band", file=LH,
        old="    return nuc >= decl.theta_nucleus, min(codas) >= decl.theta_coda",
        new="    return nuc >= decl.theta_nucleus, max(codas) >= decl.theta_coda",
        subset=T_BAND,
        rationale=(
            "Same reduction, coda channel. One agreeing syllable would then "
            "carry the whole anchor, so `nation`/`ration` and `nation`/"
            "`nasal` become indistinguishable on the channel that decides "
            "between RHYME and ASSONANCE. The nucleus half of this is M2; "
            "both are here because the two channels are read by different "
            "lines and a fix to one need not fix the other."),
    ),
    Mutation(
        name="M4", layer="band", file=LH,
        old="        codas.append(1.0 if (not ca and not cb) else cluster_sim(ca, cb))",
        new="        codas.append(cluster_sim(ca, cb))",
        subset=T_BAND,
        rationale=(
            "Doctrine 25's TRIPWIRE, planted -- and it turns out to be an "
            "EQUIVALENT MUTANT, which is a finding about the doctrine rather "
            "than about the suite. Dropping the `not ca and not cb` clause "
            "ought to stop two ABSENT codas agreeing and delete every "
            "open-syllable rhyme in English, a quarter of the sonnets' "
            "mandated pairs. It deletes nothing: 0 differences in "
            "`channel_agreement` and 0 in the resulting relation over 4,000 "
            "random CMUdict pairs, 1,206 of which have a both-absent aligned "
            "coda -- because `cluster_sim` opens with its own `if not a and "
            "not b: return 1.0`. The band's clause RESTATES a guarantee the "
            "comparator already gives, so the tripwire the record calls "
            "'registered and checked first' lives one layer DOWN, and THAT "
            "line is protected: M11 mutates it and is caught. Kept in the "
            "list and allowlisted in test_mutation.py with the proof, because "
            "it stops being equivalent the moment `cluster_sim` changes."),
    ),
    Mutation(
        name="M5", layer="band", file=LH,
        old="    return nuc >= decl.theta_nucleus, min(codas) >= decl.theta_coda",
        new="    return nuc >= decl.theta_nucleus, True",
        subset=T_BAND,
        rationale=(
            "CONTROL. The coda channel forced True: the band degenerates to "
            "nucleus-only and the `sun`/`much` leak reopens. Recorded as "
            "caught on 2026-08-11, so a run where this survives means the "
            "runner is broken, not the suite."),
    ),
    Mutation(
        name="M6", layer="band", file=LH,
        old=('    return s is not None and s["total"] >= theta and \\\n'
             '        s["relation"] in RHYME_RELATIONS'),
        new='    return s is not None and s["total"] >= theta',
        subset=T_BAND,
        rationale=(
            "`admits` drops the RELATION clause and keeps only the scalar. "
            "This is the sun/much leak in its original form: an ASSONANCE edge "
            "whose nucleus carried it over theta is admitted as rhyme. "
            "Doctrine 3 says the band is TYPED; this untypes it."),
    ),
    Mutation(
        name="M7", layer="band", file=LH,
        old="    conjunctive_band: bool = True",
        new="    conjunctive_band: bool = False",
        subset=T_BAND,
        rationale=(
            "The band switched off at the declaration. It is a legitimate "
            "declared coordinate (doctrine 1) and `Declaration(conjunctive_"
            "band=False)` must stay reachable -- what must not change silently "
            "is the DEFAULT."),
    ),
    # Three coordinates shipped on 2026-08-11, three new places for a silent
    # drift. NONE of them is a hole -- each is caught today by exactly the file
    # that declares it -- and that is the reason they are here rather than the
    # reason they are not: doctrine 48 says a principle that lives only in
    # prose gets followed exactly as often as somebody remembers it, and "the
    # mutation list matches the code" is such a principle. A new default with
    # no mutation is a coordinate whose test nobody is checking is still there.
    Mutation(
        name="M32", layer="band", file=LH,
        old='    nucleus_agreement: str = "scalar"          # "scalar"|"identity"|"licensed"',
        new='    nucleus_agreement: str = "identity"        # "scalar"|"identity"|"licensed"',
        subset=_q("test_nucleus.py", "test_band.py", "test_mut_band.py"),
        rationale=(
            "The nucleus channel silently promoted to strict identity. It "
            "LOOKS like a tightening and it deletes near rhyme, which is "
            "doctrine 94's own warning about a band tuned to agree with the "
            "reference line. Held-out FPR falls 3.67% -> 0.20% and mandated "
            "refusals rise 9.44% -> 20.08%, so a run that read only the FPR "
            "would file this as an improvement."),
    ),
    Mutation(
        name="M33", layer="band", file=LH,
        old="    nucleus_licence_unstressed_only: bool = True",
        new="    nucleus_licence_unstressed_only: bool = False",
        subset=_q("test_nucleus.py", "test_band.py"),
        rationale=(
            "The AH0~IH0 licence stops being conditioned on stress, which "
            "turns an INGESTION fact about CMUdict into a claim about vowels. "
            "In mandated positions the pair is doubly-unstressed 6 of 6; in a "
            "random background 394 of 545. Doubles the licensed shape's "
            "held-out FPR, 0.33% -> 0.67%."),
    ),
    # ------------------------------------------------------------ comparator
    Mutation(
        name="M8", layer="comparator", file=LH,
        old="    theta_coda: float = 0.80      # coda AGREEMENT, not coda evidence",
        new="    theta_coda: float = 0.60      # coda AGREEMENT, not coda evidence",
        subset=T_CMP,
        rationale=(
            "theta_coda reverted to the hand-set 0.60. Held out, 0.80 cuts the "
            "false-positive rate on random CMUdict pairs 11.93% -> 4.67% for "
            "0.6pp of true-positive cost (RESULTS_REDTEAM.md). Reverting it "
            "restores a NEGATIVE separation: the harness marries two random "
            "dictionary words more often than it fails one of Shakespeare's."),
    ),
    Mutation(
        name="M9", layer="comparator", file=LH,
        old="    theta_rhyme: float = 0.75                 # lower edge of the match band",
        new="    theta_rhyme: float = 0.50                 # lower edge of the match band",
        subset=T_CMP,
        rationale=(
            "CONTROL. Recorded as caught by test_readability on 2026-08-11. "
            "Present so that a run in which everything survives is "
            "distinguishable from a run in which the runner is misconfigured."),
    ),
    Mutation(
        name="M10", layer="comparator", file=LH,
        old="    theta_nucleus: float = 0.60",
        new="    theta_nucleus: float = 0.20",
        subset=T_CMP,
        rationale=(
            "The channel the record calls a coin flip (`five`/`of` passes at "
            "0.603 against 0.600) opened four-fold. BACKLOG 1.3 says 0.600 is "
            "undecided; undecided is not the same as unpinned, and nothing "
            "should be able to move it without a test saying so."),
    ),
    Mutation(
        name="M11", layer="comparator", file=LH,
        old="    if not a and not b:\n        return 1.0",
        new="    if not a and not b:\n        return 0.0",
        subset=T_CMP,
        rationale=(
            "`cluster_sim` on two empty clusters returns 0.0 instead of 1.0. "
            "Doctrine 25 again, but one layer DOWN: here the answer really is "
            "0.000 bits of evidence, and the comparator is the place that "
            "conflates evidence with agreement if it reports 0."),
    ),
    Mutation(
        name="M12", layer="comparator", file=LH,
        old="        if i == 0:",
        new="        if False:",
        subset=T_CMP,
        rationale=(
            "The first onset stops being the rhyme-defining EXCLUSION and "
            "starts being scored. `night`/`light` would then be penalised for "
            "differing exactly where rhyme requires them to differ."),
    ),
    Mutation(
        name="M13", layer="comparator", file=LH,
        old="    trailing_syllable_penalty: float = 0.15   # semirhyme discount / extra syllable",
        new="    trailing_syllable_penalty: float = 0.0    # semirhyme discount / extra syllable",
        subset=T_CMP,
        rationale=(
            "The semirhyme discount removed, so an anchor with an extra "
            "unmatched syllable costs nothing. Unequal-length spans again -- "
            "the same blind spot M1 lives in, approached from the scalar side."),
    ),
    # --------------------------------------------------------------- anchor
    Mutation(
        name="M14", layer="anchor", file=LH,
        old=('    for i in range(len(sylls) - 1, -1, -1):\n'
             '        if sylls[i]["stress"] in (1, 2):\n'
             '            idx = i\n'
             '            break'),
        new=('    for i in range(len(sylls) - 2, -1, -1):\n'
             '        if sylls[i]["stress"] in (1, 2):\n'
             '            idx = i\n'
             '            break'),
        subset=T_ANCHOR,
        rationale=(
            "Off-by-one in the last-stressed search: the final syllable is "
            "never examined, so a monosyllable and any word stressed on its "
            "last syllable anchors one syllable too early or falls through to "
            "the fallback. The anchor rule is a declared coordinate; this "
            "changes it without changing the declaration."),
    ),
    Mutation(
        name="M15", layer="anchor", file=LH,
        old=('    for i in range(len(sylls) - 1, -1, -1):\n'
             '        if sylls[i]["stress"] in (1, 2):\n'
             '            idx = i\n'
             '            break'),
        new=('    for i in range(len(sylls) - 1, -1, -1):\n'
             '        if sylls[i]["stress"] == 1:\n'
             '            idx = i\n'
             '            break'),
        subset=T_ANCHOR,
        rationale=(
            "Secondary stress stops anchoring. The docstring says rap anchors "
            "on late secondaries (`applesauce`); this is that sentence deleted "
            "in code while the sentence stays in the docstring."),
    ),
    Mutation(
        name="M16", layer="anchor", file=LH,
        old="        starts = stressed[-2:] if stressed else [len(sylls) - 1]",
        new="        starts = stressed[-1:] if stressed else [len(sylls) - 1]",
        subset=T_ANCHOR,
        rationale=(
            "The mosaic / multisyllabic reach removed: `line_anchors` stops "
            "offering the second-to-last stress as a span start. This is the "
            "generator of exactly the unequal-length spans M1 mis-aligns, so a "
            "suite that catches M16 but not M1 is reading the input side of "
            "the defect and not the comparison."),
    ),
    # ------------------------------------------------------------- structure
    Mutation(
        name="M17", layer="structure", file=LH,
        old="    return None if c in SCHEME_FREE else c",
        new="    return c",
        subset=T_STRUCT,
        rationale=(
            "`scheme_class` treats X as a rhyme class again. This bug was LIVE "
            "until 2026-08-10: declaring 24 lines of a 41-line lyric free "
            "mandated all 276 of their pairs to rhyme with each other, and the "
            "brief demanded that `does` rhyme with `heat`. The sonnet oracle "
            "cannot see it, because ABABCDCDEFEFGG contains no X."),
    ),
    Mutation(
        name="M18", layer="structure", file=LH,
        old="    return ca is not None and ca == cb",
        new="    return ca is not None and ca != cb",
        subset=T_STRUCT,
        rationale=(
            "The mandate built from `!=` instead of `==`: every pair the scheme "
            "declares UNRELATED is required to rhyme and every declared rhyme "
            "goes unchecked. The loudest possible structural inversion, here to "
            "calibrate the other end of the scale -- if this survives, the "
            "structure layer has no test at all."),
    ),
    Mutation(
        name="M19", layer="structure", file=LH,
        old="                    if sum(edges) == 2:\n                        defect += 1",
        new="                    if sum(edges) == 3:\n                        defect += 1",
        subset=T_STRUCT,
        rationale=(
            "The transitivity defect counter inverted: it now counts COMPLETE "
            "triangles as defects and reports a broken rhyme class as clean. "
            "Doctrine 2 says the graph is the primary object; this is the graph "
            "layer's only self-consistency check."),
    ),
    Mutation(
        name="M20", layer="structure", file=LH,
        old=('                if (i + 1, j + 1) in refused:\n'
             '                    continue          # refused: recorded, never judged'),
        new=('                if False:\n'
             '                    continue          # refused: recorded, never judged'),
        subset=T_STRUCT + T_INGEST,
        rationale=(
            "DOCTRINE 79, planted. Refusals fold back into the violation "
            "numerator, so an end word CMUdict cannot read is reported as "
            "Shakespeare failing to rhyme `viewest`/`renewest`. An ingestion "
            "miss billed to the comparator, in the headline number."),
    ),
    Mutation(
        name="M21", layer="structure", file=BAT,
        old="    judged = total_pairs - len(refused)",
        new="    judged = total_pairs",
        subset=T_STRUCT + T_INGEST,
        rationale=(
            "Doctrine 79 again, at the other end: the battery's DENOMINATOR "
            "goes back to the mandated pairs. 73/1014 = 7.2% becomes 73/1064 = "
            "6.9%. A rate whose denominator silently includes the cases the "
            "instrument refused is not a rate -- and this one moves the "
            "headline in the direction that flatters the harness."),
    ),
    # ------------------------------------------------------------- ingestion
    Mutation(
        name="M22", layer="ingestion", file=LH,
        old='    norm = text.replace("\u2019", "\'").replace("\u2018", "\'")',
        new="    norm = text",
        subset=T_INGEST,
        rationale=(
            "Doctrine 26, planted: U+2019 stops being normalised where a word "
            "is extracted from text. In the matrix fitter this split "
            "`prepar\u2019d`, made the bare letter `d` an end word 75 times, "
            "corrupted 9.2% of the training pairs and flipped two of eight "
            "registered predictions."),
    ),
    Mutation(
        name="M23", layer="ingestion", file=LH,
        old="    final_unreadable = not anchors",
        new="    final_unreadable = False",
        subset=T_INGEST,
        rationale=(
            "The RECORDED REFUSAL stops being recorded: an unreadable end word "
            "reports as readable, so the refusal becomes silence and silence is "
            "indistinguishable from a measurement. Every rate downstream loses "
            "its denominator correction."),
    ),
    Mutation(
        name="M24", layer="ingestion", file=LH,
        old="    return toks[-1] if toks else None",
        new="    return toks[0] if toks else None",
        subset=T_INGEST,
        rationale=(
            "`raw_final_token` returns the line's FIRST word. The recorded "
            "defect this function exists to prevent is the same shape -- a path "
            "that reports the rhyme word as `thou` on a line ending `grow'st` -- "
            "and it was measured at 5.14% of song lines before it was fixed."),
    ),
    Mutation(
        name="M30", layer="comparator", file=LH,
        old="        sa, sb = anc_a[i], anc_b[i]",
        new="        sa, sb = anc_a[len(anc_a) - n + i], anc_b[len(anc_b) - n + i]",
        subset=T_CMP,
        rationale=(
            "NOT A KNOWN DEFECT — an OPEN QUESTION, planted to find out "
            "whether anything in the suite depends on the answer. `score()` "
            "reads `anc_a[i]` against `anc_b[i]` — flush LEFT — fifty lines "
            "below `channel_agreement`, which was fixed on 2026-08-11 to read "
            "flush RIGHT. So the scalar and the band align the same two "
            "anchors differently, and on `remember`/`her` the scalar compares "
            "EH with ER while the band compares ER with ER. THE CODE HALF of "
            "the choice: this mutation moves the loop's indices, where M31 "
            "moves the DECLARED DEFAULT that selects between them. When this "
            "was written the only thing recording the choice was a comment "
            "reading 'left-align at the stressed syllable', and doctrine 95's "
            "complaint was that nothing else said so. Something does now — "
            "`Declaration.scalar_alignment`, both readings reachable, priced "
            "held-out in `quality/test_align.py` — and the comment is gone, "
            "so this rationale no longer quotes it."),
    ),
    Mutation(
        name="M31", layer="comparator", file=LH,
        old='    scalar_alignment: str = "head"            # "head" | "tail"',
        new='    scalar_alignment: str = "tail"            # "head" | "tail"',
        subset=_q("test_align.py", "test_mut_band.py", "test_band.py"),
        rationale=(
            "The scalar's alignment flipped by its DEFAULT rather than by its "
            "code — M30 is the code half of the same question. Held out this "
            "changes no relation and no sonnet verdict (82/1014 either way, "
            "in both halves, 43/510 and 39/504 -- repinned 2026-08-11 from "
            "81/1014 after cell BA's coda-identity fix; the invariant itself "
            "is unchanged, only its digit moved with the shared oracle) "
            "while moving the scalar total on 59% of random pairs, which is "
            "exactly why it needs a mutation: the corpus that catches "
            "everything else is structurally incapable of seeing it, which "
            "is doctrine 95's own lesson about the sonnet oracle."),
    ),
    # ------------------------------------------------------------ projection
    Mutation(
        name="M25", layer="projection", file=LH,
        old=("            for j in range(len(cluster)):\n"
             "                cand = tuple(cluster[j:])\n"
             "                if len(cand) == 1 or cand in LEGAL_ONSETS:\n"
             "                    cut = j\n"
             "                    break"),
        new="            pass   # MUTANT: maximal onset disabled",
        subset=T_PROJ,
        rationale=(
            "Maximal legal onset disabled in `syllabify`: every medial cluster "
            "goes to the CODA of the preceding syllable. Interior codas and "
            "onsets are separate channels with separate weights, so this moves "
            "material between channels on every polysyllable while leaving the "
            "phoneme string identical."),
    ),
    # ----------------------------------------------------------------- value
    Mutation(
        name="M26", layer="value", file=LH,
        old='        if wa == wb:\n            out["relation"] = "REPEAT"',
        new='        if False:\n            out["relation"] = "REPEAT"',
        subset=T_VALUE,
        rationale=(
            "The REPEAT identity check disabled. Doctrine 3: identity is not "
            "rhyme, and REPEAT inverts by context -- a violation inside a verse, "
            "the requirement across chorus instances, licensed as radif. "
            "Without the check a self-rhyme scores 1.0 and passes as the best "
            "rhyme in the item."),
    ),
    Mutation(
        name="M27", layer="value", file=LH,
        old='        elif full_identity:\n            out["relation"] = "RIME_RICHE"',
        new='        elif False:\n            out["relation"] = "RIME_RICHE"',
        subset=T_VALUE,
        rationale=(
            "RIME_RICHE disabled: same sound, different word (`sea`/`see`) "
            "reports as ordinary RHYME. The relation exists because the "
            "taxonomy has to be able to SAY it (doctrine 24)."),
    ),
    Mutation(
        name="M28", layer="value", file=LH,
        old="        if frozenset((la, lb)) in CLICHE_PAIRS:",
        new="        if False:",
        subset=T_VALUE,
        rationale=(
            "The cliche-pair flag disabled. Doctrine 9: passing the band by "
            "reaching for fire/desire is the slop direction, and the revision "
            "loop's modal exclusion is built on flags like this one."),
    ),
    Mutation(
        name="M29", layer="value", file=LH,
        old='                out["flags"].append(f"shared_suffix: -{suf}")',
        new='                pass',
        subset=T_VALUE,
        rationale=(
            "The shared-suffix stem check silenced, so `running`/`gunning` "
            "stops being flagged as grammatical rather than phonetic rhyme. A "
            "value-layer finding, deleted without changing any score."),
    ),

    # =======================================================================
    # THE QUALITY LAYER, ADDED 2026-08-13 — and the reason it was added is
    # itself a doctrine-94 finding about THIS FILE.
    #
    # Every mutation above this line lands in `lyric_harness.py` or
    # `battery.py`. That is 2 of the repo's 64 production `.py` files and
    # 4,794 of its 50,722 production lines: 9.45% of the code, 0% of
    # `quality/`. So `quality/floor.py` (the slop floor), `quality/revise.py`
    # (the loop's gate), `quality/schemes.py` (mandate semantics),
    # `quality/grid.py` and `quality/fit.py` had every one of their tests
    # written, run, and believed WITHOUT ANY MEASUREMENT OF WHETHER THOSE
    # TESTS COULD FAIL. Doctrine 94 names that population exactly: a
    # positive-case suite cannot find a rule that is too GENEROUS, and the
    # only instrument in this repo that can is this one — which had never
    # been pointed at the layer.
    #
    # The bias in the old list is not random. `mutate.py` was written the
    # week the head/tail alignment defect was found in the COMPARATOR, so it
    # mutates the comparator; `test_mutation.py` guards against the author's
    # own layer bias with `LAYERS` (every triage layer must be mutated) and
    # that check passed the whole time, because a layer can be covered in one
    # file and absent in sixty-one others. A coverage check keyed on LAYER is
    # blind to a coverage gap keyed on FILE.
    #
    # DIRECTION MATTERS, and most of these are deliberately chosen to make a
    # rule MORE GENEROUS rather than merely different — doctrine 94's actual
    # subject. A mutation that makes a check fire more often is caught by any
    # positive-case assertion that happens to run; a mutation that makes it
    # fire LESS often is invisible to every one of them, and that is the
    # class this layer has never been tested against.
    # =======================================================================

    # ------------------------------------------------ quality/floor.py (value)
    # The floor is CLAUDE.md's value layer at song length: it decides what
    # counts as slop and it is the only shipped gate whose thresholds are
    # calibrated rather than declared.
    Mutation(
        name="QF1", layer="value", file=FLOOR,
        old='            return default if exact else "note"',
        new='            return default',
        subset=T_FLOOR,
        rationale=(
            "`SlopFloor.check`'s `sev()` no longer downgrades an EXTRAPOLATED "
            "finding to a note, so a text inside a profile's tolerance band "
            "but outside its measured range is REJECTED on a threshold that "
            "was never measured at its length. Doctrine 15 (length is a "
            "coordinate, not a detail) and the module's own rule that an "
            "extrapolated measurement may not reject. The mutant is silent on "
            "every text of a measured length, which is every positive case "
            "anybody writes by hand — doctrine 94 exactly."),
    ),
    Mutation(
        name="QF2", layer="value", file=FLOOR,
        old="                if len(ps) >= 2 and len(ps) / npairs >= need}",
        new="                if len(ps) >= 2}",
        subset=T_FLOOR,
        rationale=(
            "The radif licence loses its FRACTION condition and keeps the bare "
            "count of two — which is the exact defect `_relation_findings`'s "
            "docstring says it was written to fix: in a 31-pair verse, two "
            "pairs that happen to end in `it` are licensed as a refrain and "
            "REPEAT_IN_VERSE goes silent on real self-rhyme. Doctrine 18: a "
            "licence granted by pattern must be earned by systematicity. "
            "GENEROUS DIRECTION — the mutant only ever REMOVES findings, so "
            "nothing that asserts a clean text stays clean can see it."),
    ),
    Mutation(
        name="QF3", layer="value", file=FLOOR,
        old="                    if len(suf) <= 2 and not (",
        new="                    if len(suf) <= 0 and not (",
        subset=T_FLOOR,
        rationale=(
            "The same-stem guard on SHARED_SUFFIX disabled, so `-ed`/`-er`/"
            "`-es`/`-s` fire on any two words that merely END in those "
            "letters: `shed`/`bred` is reported as homeoteleuton though they "
            "share no morpheme. The comment on the line calls that a false "
            "accusation about craft. Unlike QF1/QF2 this one is generous in "
            "the OTHER direction (more findings, not fewer), and it is here to "
            "keep the set from testing only one sign."),
    ),
    Mutation(
        name="QF4", layer="value", file=FLOOR,
        old="    return min(reach, key=lambda p: (gap(p), p.hi - p.lo)), False",
        new="    return reach[0], False",
        subset=T_FLOOR,
        rationale=(
            "`declaration_for` reverts to taking the FIRST profile that "
            "reaches the length instead of the one with the smallest "
            "extrapolation. `PROFILES` is ordered section, sonnet, song, so a "
            "150-token lyric that the song profile MEASURED is graded on the "
            "section profile's 29-37-token percentiles, extrapolating 113 "
            "tokens past a measured edge. The module's own comment records "
            "this class of bug (the midpoint rule choosing the sonnet at 149 "
            "tokens); this plants a worse version of it."),
    ),
    Mutation(
        name="QF5", layer="value", file=FLOOR,
        old="        tolerance=1.25,",
        new="        tolerance=2.0,",
        subset=T_FLOOR,
        rationale=(
            "The `song` profile's tolerance goes back to the unmeasured 2.0 "
            "that the first two profiles shipped with. Measured (floor.py's "
            "own note on `Profile.tolerance`), carrying the 150-400 thresholds "
            "out to 2.0x raises the union false-positive rate from 23.12% to "
            "26.33%, and 1.25 is the only one of the three tolerances that "
            "anybody ever measured. Doctrine 16: an uncalibrated threshold "
            "fails toward whoever guessed."),
    ),

    # ------------------------------------- quality/revise.py (the loop's gate)
    # `verify()` is the only thing standing between a proposed revision and
    # acceptance, and CLAUDE.md names four rejections it enforces. Each of the
    # first four mutations below deletes or blunts one of them.
    Mutation(
        name="QR1", layer="structure", file=REVISE,
        old="        if len(new_flags) > self.rdecl.allow_net_new:",
        new="        if len(new) > self.rdecl.allow_net_new:",
        subset=T_LOOP,
        rationale=(
            "`verify()`'s net-new gate goes back to counting NOTES against "
            "`allow_net_new` alongside flags — the severity-blind gate whose "
            "removal CLAUDE.md records, and which rejected a tier-2 backtrack "
            "for the crime of landing on a pair conventional enough to earn a "
            "MODAL_RHYME note. Doctrine 7: a floor may not order the permitted "
            "region, and blocking a correct fix on a note is ordering it. The "
            "mutant only ever REJECTS MORE, so a suite that checks accepted "
            "revisions were accepted can see it and one that checks rejected "
            "revisions were rejected cannot."),
    ),
    Mutation(
        name="QR2", layer="value", file=REVISE,
        old="        k = self.rdecl.modal_exclusion",
        new="        k = 0",
        subset=T_LOOP,
        rationale=(
            "Doctrine 9's ENTIRE mechanism disabled at its one implementation "
            "point: `joint_field`/`modal_field` forbid nothing, `Brief."
            "forbidden_modal` is empty for every line (TRUE AS WRITTEN since "
            "2026-08-16 and not before it: until the incumbent moved to its "
            "own field this list still held one entry per briefed line at "
            "k=0, so the sentence was accidentally wrong about a mutation it "
            "was accidentally right about — the kill behaviour never moved, "
            "because rule 3's rejection is already dead at k=0), and "
            "`verify()`'s rule-3 "
            "modal check can therefore never fire. `modal_exclusion=0` is a "
            "reachable declared setting on purpose — CLAUDE.md says so, and "
            "says it is NOT the default — so this mutation is precisely 'the "
            "demonstrable defect became the shipped behaviour'. Doctrine 48: a "
            "principle is only real once it is mechanical, and this deletes "
            "the mechanism while leaving the prose."),
    ),
    Mutation(
        name="QR3", layer="structure", file=REVISE,
        old="            stray = changed - set(targeted)",
        new="            stray = set()",
        subset=T_LOOP,
        rationale=(
            "The third of `verify()`'s four rejections deleted: a revision may "
            "now quietly rewrite lines nobody targeted and still be accepted. "
            "Doctrine 47 names this as one of the three silent ways a revision "
            "goes wrong — 'a model that quietly rewrites the whole draft has "
            "replaced the work rather than revised it'. GENEROUS DIRECTION: "
            "every revision that was accepted before is still accepted, so "
            "only a test that asserts a REFUSAL can see it."),
    ),
    Mutation(
        name="QR4", layer="structure", file=REVISE,
        old="        gone, new = set(cb - ca), set(ca - cb)",
        new="        gone, new = set(cb) - set(ca), set(ca) - set(cb)",
        subset=T_LOOP,
        rationale=(
            "The finding diff reverts from MULTISET subtraction to a plain set "
            "difference, undoing the `collections.Counter` fix CLAUDE.md "
            "records: a pivot line trading ONE SCHEME_VIOLATION for TWO shows "
            "the same `(line, code)` key before and after, so the regression "
            "lands in neither `fixed` nor `new` and `verify()` accepts it. "
            "Doctrine 47 again — a loop that cannot see the change it asked "
            "for is a rubber stamp, and that is as true of a count as of a "
            "key. Invisible to every assertion that checks membership rather "
            "than multiplicity. ANCHOR REPINNED 2026-08-14: the left-hand "
            "side was renamed `fixed` -> `gone` when `verify()` split a "
            "holding requirement out of `fixed` into `broken`. The "
            "MUTATION IS UNCHANGED -- it still reverts multiset "
            "subtraction to a plain set difference; only the line it "
            "anchors on moved."),
    ),
    Mutation(
        name="QR5", layer="structure", file=REVISE,
        old="                if not (is_violation if declared else "
            "not default_licensed):",
        new="                if not (not default_licensed):",
        subset=T_LOOP,
        rationale=(
            "`grade()` stops asking the MANDATE's own per-pair "
            "`repeat_is_violation` and falls back to the song-wide "
            "`repeat_licence` switch for every REPEAT — the exact state "
            "CLAUDE.md records as fixed on 2026-08-11, in which a CORRECT "
            "verbatim refrain required by the mandate itself is charged "
            "SCHEME_VIOLATION and `revise_loop` tries to 'fix' a line that was "
            "already right. Doctrine 3: the REPEAT band inverts by context and "
            "a per-song switch cannot express a per-pair inversion. A plain "
            "letter scheme with no declared returns is UNAFFECTED, which is "
            "why a positive-case suite built on letter schemes cannot see it."),
    ),
    Mutation(
        name="QR6", layer="comparator", file=LH,
        old="THETA_COLLISION = 0.9",
        new="THETA_COLLISION = 1.1",
        subset=T_LOOP,
        rationale=(
            "The unintended-rhyme threshold raised above the top of the scale, "
            "so `grade()`'s collision scan can never fire and every "
            "SCHEME_COLLISION / NEAR_COLLISION finding disappears from the "
            "report and from `verify()`'s diff. Doctrine 58: a recorded "
            "constant is a threshold nobody wrote down, and 0.9 appears in no "
            "results document. GENEROUS DIRECTION — it only ever removes "
            "findings."),
    ),

    # ------------------------------- quality/schemes.py (mandate semantics)
    # `Mandate.requirement` is the closed-set answer the whole loop is built
    # on: five singletons, one call, no boolean to collapse them into. These
    # mutate what it ANSWERS rather than whether it is asked.
    Mutation(
        name="QS1", layer="structure", file=SCHEMES,
        old="            if r.verbatim is True:\n                "
            "return REQUIRE_RETURN",
        new="            if r.verbatim is True:\n                "
            "return REQUIRE_RHYME",
        subset=T_MANDATE,
        rationale=(
            "A DECLARED VERBATIM RETURN answers REQUIRE_RHYME instead of "
            "REQUIRE_RETURN, which inverts doctrine 3's second half at its one "
            "mechanical point: identity goes from REQUIRED to FORBIDDEN, so "
            "every correct chorus/refrain declared through `--returns=` is a "
            "violation again. This is the same defect `--returns=` was built "
            "to close, planted one layer below the CLI that reaches it."),
    ),
    Mutation(
        name="QS2", layer="structure", file=SCHEMES,
        old="        return min(r.lines) if r is not None else line",
        new="        return max(r.lines) if r is not None else line",
        subset=T_MANDATE,
        rationale=(
            "`_rep` returns the LAST line of a return class rather than the "
            "first, so the canonical member of an identity class moves. Every "
            "question about a returned line is a question about the line it "
            "returns, and `requirement()`'s licence-transport rule asks it of "
            "the representatives — so this silently re-points which declared "
            "group a returned line inherits its REQUIRE_RHYME from. A "
            "symmetric-looking edit with an asymmetric effect, which is the "
            "kind of change a positive case reproduces unchanged."),
    ),
    Mutation(
        name="QS3", layer="structure", file=SCHEMES,
        old="            if r.verbatim is not True:\n                continue",
        new="            if r.verbatim is not False:\n                continue",
        subset=T_MANDATE,
        rationale=(
            "`returns_check` inverts which returns it grades: the VERBATIM "
            "ones — the only ones the mandate requires to be identical — are "
            "skipped, and the non-verbatim ones, which the mandate explicitly "
            "does not require identity of, are graded instead. A villanelle "
            "whose second refrain has drifted by a word passes silently, which "
            "`RefrainScheme.check_identity`'s docstring calls the commonest way "
            "the form fails. RETURN_NOT_VERBATIM stops being reachable, so "
            "`verify()`'s net-negative diff loses the one finding that let it "
            "see a broken declared return."),
    ),
    Mutation(
        name="QS4", layer="structure", file=SCHEMES,
        old="        if not (self.in_scope(a) and self.in_scope(b)):",
        new="        if not (self.in_scope(a) or self.in_scope(b)):",
        subset=T_MANDATE,
        rationale=(
            "`requirement()` stops returning UNDECLARED for a pair with ONE "
            "line outside the mandate's scope and falls through to the group "
            "tests, which answer FREE. Doctrine 28 and doctrine 20 in one "
            "line: 'nothing is required here' and 'I was not asked about this' "
            "become the same answer, and the whole point of the five-singleton "
            "closed set is that a caller cannot collapse them. Every pair a "
            "test bothers to declare is in scope, so no positive case reaches "
            "the mutated branch."),
    ),
    Mutation(
        name="QS5", layer="structure", file=SCHEMES,
        old="        if ra != rb and any(ra in g and rb in g "
            "for g in self.groups):",
        new="        if False and any(ra in g and rb in g for g in self.groups):",
        subset=T_MANDATE,
        rationale=(
            "The licence-transport rule deleted, so a pair joined only through "
            "a RETURN (L13/L37, where L37 IS L17) falls through to "
            "LICENSE_REPEAT instead of inheriting L13/L17's REQUIRE_RHYME. "
            "That is the whole reason a return is not merely a bigger group, "
            "per the comment on the line: an identical word across a "
            "transported pair stops being a violation. Reachable only on a "
            "mandate that has BOTH declared groups and declared returns, which "
            "is why a letter-scheme suite cannot get near it."),
    ),

    # ------------------------------------- quality/grid.py (song structure)
    Mutation(
        name="QG1", layer="structure", file=GRID,
        old="    if not varied and not unmatched_a and not unmatched_b:",
        new="    if not varied:",
        subset=T_SONG,
        rationale=(
            "`compare_returns` calls a return VERBATIM when no PAIRED line "
            "differs, ignoring lines that are missing from one side "
            "altogether — so a truncated or extended chorus reports as an "
            "exact return. VERBATIM is first in `VARIATION_KINDS`, so it wins "
            "the `kind` precedence and TRUNCATED_RETURN / EXTENDED_RETURN "
            "become unreachable as the reported kind. Doctrine 24: the twelve "
            "named kinds exist so the harness can say MORE, and this collapses "
            "three of them into one."),
    ),
    Mutation(
        name="QG2", layer="structure", file=GRID,
        old="            if ts[k:k + len(need)] == need:",
        new="            if ts[k:k + 1] == need[:1]:",
        subset=T_SONG,
        rationale=(
            "`hook_occurrences` matches on the hook's FIRST WORD instead of "
            "the whole fragment, so any line containing that word counts as an "
            "occurrence. HOOK_ABSENT is the ONLY `flag` in "
            "`song_function_report` — everything else there is a note against "
            "a labelled convention (doctrine 6) — so this is the single "
            "song-function finding `verify()` can reject a revision on, and "
            "the mutant makes it near-unreachable. GENEROUS DIRECTION: it "
            "finds MORE hooks, never fewer, so no positive case notices."),
    ),
    Mutation(
        name="QG3", layer="ingestion", file=GRID,
        old='    t = _PUNCT.sub(" ", t)',
        new="    t = t",
        subset=T_SONG,
        rationale=(
            "`normalise_line` stops stripping punctuation. The declared "
            "normalisation is what decides whether Russell's third chorus "
            "line, which differs between returns by ONE COMMA, is a variation "
            "or is not — the docstring says so and calls it a coordinate of "
            "the result. This is the ingestion layer under BOTH refrain "
            "checkers (`RefrainScheme.check_identity` and `Mandate."
            "returns_check` both call it), so a punctuation-only drift is "
            "reported as a broken refrain everywhere at once."),
    ),
    Mutation(
        name="QG4", layer="projection", file=GRID,
        old="    kind = next(k for k, _ in VARIATION_KINDS if k in q)",
        new="    kind = next(k for k, _ in reversed(VARIATION_KINDS) if k in q)",
        subset=T_SONG,
        rationale=(
            "The precedence order of the twelve `VARIATION_KINDS` is reversed, "
            "so the single `kind` reported for a return is the LEAST specific "
            "quality it holds rather than the most. `qualities` is unchanged, "
            "which is the point: every assertion written against the frozenset "
            "still passes and only one written against the projection to a "
            "single name can fail. Doctrine 2, one layer up — the lossy "
            "projection is where the reader actually looks."),
    ),

    # -------------------------------------------- quality/fit.py (the bars)
    Mutation(
        name="QT1", layer="structure", file=FIT,
        old="        if units.count > len(slots):",
        new="        if units.count > len(slots) + 1:",
        subset=T_METER,
        rationale=(
            "SLOTS_EXCEEDED off by one, so a line with exactly one syllable "
            "more than the declared subdivision has slots for is reported as "
            "satisfiable. This is the ONE meter finding CLAUDE.md makes a hard "
            "flag in the revision loop — because `fit.py`'s own "
            "`satisfiable=False` already says the declaration is "
            "mathematically impossible — so the mutant reopens the gate "
            "`revise.py` rides. An off-by-one is invisible to any test that "
            "over-fills a line by two or more, which is how such a test gets "
            "written."),
    ),
    Mutation(
        name="QT2", layer="structure", file=FIT,
        old="        return all(f.satisfiable for f in self.findings)",
        new="        return any(f.satisfiable for f in self.findings)",
        subset=T_METER,
        rationale=(
            "`LineFit.satisfiable` becomes an ANY over its findings, so one "
            "satisfiable finding excuses every unsatisfiable one and a line "
            "carrying a real placement contradiction reports as satisfiable. "
            "Note the direction: with NO findings `all` and `any` disagree "
            "(True vs False), so the mutant also calls a CLEAN line "
            "unsatisfiable — two opposite errors from one operator, and a "
            "suite that only ever checks clean lines sees the second while a "
            "suite that only ever checks broken ones sees the first."),
    ),
    Mutation(
        name="QT3", layer="anchor", file=FIT,
        old="    lo = math.ceil(placement.start * s)",
        new="    lo = math.floor(placement.start * s)",
        subset=T_METER,
        rationale=(
            "`_slot_positions` anchors the slot grid BELOW the line's start "
            "instead of at or above it, handing an off-grid start one extra "
            "slot it does not have. The docstring says the grid is anchored to "
            "the CYCLE and not to the line precisely so that a start CAN be "
            "reported off-grid; this quietly buys back the slot that made it "
            "reportable. Every on-grid start computes identically, which is "
            "every start anybody writes into a fixture by hand."),
    ),
    Mutation(
        name="QT4", layer="structure", file=FIT,
        old="        return math.ceil(Fraction(self.count, 1) / self.pulses)",
        new="        return math.floor(Fraction(self.count, 1) / self.pulses)",
        subset=T_METER,
        rationale=(
            "`required_subdivision` — the smallest slots-per-pulse that holds "
            "one unit per slot — rounds DOWN, so it answers with a subdivision "
            "that provably cannot hold the line whenever the division is not "
            "exact. The number is what a writer is told to declare, so a wrong "
            "one sends them to a setting `fit_line` will then refuse. Exact "
            "divisions are unaffected, and a hand-built fixture tends to be an "
            "exact division."),
    ),
]


# ---------------------------------------------------------------------------
# Does the list still fit the code? -- ONE predicate, three callers
# ---------------------------------------------------------------------------
#
# THIS EXISTS BECAUSE THE PREDICATE HAD THREE COPIES AND THEY HAD ALREADY
# STARTED TO DIFFER. `apply_mutation` rejected `src.count(old) != 1` and then
# separately rejected `out == src`; `main`'s `--dry-run` rejected
# `src.count(old) != 1` and then separately rejected `old == new`;
# `quality/test_mutation.py`'s section 2 rejected `n != 1 or old == new` in one
# expression and reported a count for the no-op case that had nothing to do
# with the defect (`anchor occurs 1x` on a mutation whose real fault is that it
# changes nothing). Three spellings of one question is the shape doctrine 48
# keeps naming: the copies agree exactly as long as somebody remembers to edit
# all of them, and the one that goes stale is the one nobody runs. All three
# call this now, so a repair lands once.
#
# THE KINDS ARE SEPARATE BECAUSE THE REMEDIES ARE. Collapsing them under one
# word -- `--dry-run` printed `STALE` for every kind, including an anchor
# matching TWICE, which is not stale at all -- tells a reader the code moved
# when what actually happened is that the anchor stopped naming one site.

#: An anchor that is GONE. The mutation is declared and inert: it will never be
#: applied, so whatever it was planted to detect is no longer being asked.
STALE = "STALE"
#: An anchor that names MORE THAN ONE site. Not a smaller defect than STALE and
#: arguably a worse one -- `apply_mutation` patches with `str.replace`, which
#: rewrites EVERY occurrence, so the mutation silently becomes a different and
#: larger planted defect than the one its own `rationale` describes, and a
#: mutation that quietly moves is worse than one that fails.
AMBIGUOUS = "AMBIGUOUS"
#: `old` and `new` are the same text. Nothing is planted, so a "caught" verdict
#: would be the suite disagreeing with an unmodified tree.
NO_OP = "NO-OP"
#: The file the mutation names is not there at all. Kept apart from STALE
#: because a moved anchor is repaired inside a file that exists and this is not.
MISSING_FILE = "NO-FILE"

#: What a reader is owed the moment any of the above fires. A drifted anchor is
#: a repair somebody makes DELIBERATELY, and there are exactly two honest ones.
REPAIR = (
    "A mutation that does not apply is DECLARED AND INERT: adversary 4 is "
    "smaller than it says it is, and nothing else in this repo is looking. "
    "There are exactly two honest repairs and deleting the line is neither.\n"
    "  1. THE CODE MOVED -- re-anchor `old=` on the line that now carries the "
    "decision. The planted defect is still detectable; only its coordinates "
    "changed.\n"
    "  2. THE DECISION IS GONE -- retire the mutation WITH A REASON, the way "
    "`quality/test_mutation.py`'s ALLOWLIST carries prose: a bare deletion "
    "gives the next reader no way to tell 'we decided' from 'we gave up', and "
    "the mutation is the only record that the defect was ever detectable.\n"
    "  Do NOT close this by shortening the list. A hole closed by deleting "
    "the mutation that found it is the one repair this instrument cannot "
    "survive.")


def anchor_defect(mut, src):
    """-> None if `mut` applies cleanly to `src`, else (kind, why).

    `src` is the CURRENT text of `mut.file`. The caller supplies it because the
    two callers read it differently: `apply_mutation` reads a shadow tree and
    `survey_anchors` reads the working tree once per FILE rather than once per
    mutation (32 of the 57 target `lyric_harness.py`, so re-reading per
    mutation was 7.7 MB of reads to answer a 0.7 MB question).
    """
    n = src.count(mut.old)
    if n == 0:
        return (STALE,
                "anchor occurs 0x — the code moved out from under it, so this "
                "mutation can never be applied and detects nothing")
    if n > 1:
        return (AMBIGUOUS,
                f"anchor occurs {n}x — `apply_mutation` replaces EVERY "
                f"occurrence, so this would plant a bigger defect than its "
                f"rationale describes and a 'caught' verdict would be about "
                f"the wrong site. Lengthen `old=` until it names one")
    if mut.old == mut.new:
        return (NO_OP,
                "`old` and `new` are the same text, so nothing is planted and "
                "any red test is disagreeing with an unmodified tree")
    return None


def survey_anchors(muts, root=ROOT):
    """-> [(name, kind, file, why), ...] for every mutation that does not apply.

    ONE READ PER FILE, and a target file that is absent is a NAMED finding
    rather than a traceback. That is not tidiness: `quality/counters.py`'s
    `mutations_declared()` parses this runner's `N/M mutations apply cleanly`
    line, and a `FileNotFoundError` kills the line entirely -- so a mutation
    pointed at a renamed module used to reach the counters table as `the
    instrument did not answer` (a parse failure, doctrine 79's refusal) rather
    than as the mutation's own name. Same fact, and only one of the two
    spellings tells anybody which mutation to repair.
    """
    cache, bad = {}, []
    for m in muts:
        if m.file not in cache:
            try:
                cache[m.file] = open(os.path.join(root, m.file),
                                     encoding="utf-8").read()
            except OSError as e:
                cache[m.file] = e
        src = cache[m.file]
        if isinstance(src, OSError):
            bad.append((m.name, MISSING_FILE, m.file,
                        f"cannot read the file this mutation targets: {src}"))
            continue
        d = anchor_defect(m, src)
        if d:
            bad.append((m.name, d[0], m.file, d[1]))
    return bad


# ---------------------------------------------------------------------------
# Test inventory
# ---------------------------------------------------------------------------

def discover_tests(only=None):
    """Every runnable check in the repo, as repo-relative paths.

    `battery.py` is here on purpose, and since `9396946` (2026-08-11) it IS an
    assertion: `assert_pinned` diffs the sonnet oracle against `EXPECTED` and
    `__main__` exits 1 on drift, so its returncode is a real verdict on the
    four counts it pins. CORRECTED 2026-08-13 -- this docstring previously
    said the opposite ("exit status is 0 whatever the numbers say"), which was
    the stated reason for including it.

    `only` BOUNDS THE INVENTORY, and bounding it changes what SURVIVED means.
    The full inventory is what makes "nothing caught it" a statement about the
    suite; a bounded one makes it a statement about the files named, and those
    are different claims. Every caller that bounds is required to say so, and
    `report()` prints the bound at the top of the table rather than leaving a
    reader to infer it from a shorter run -- doctrine 79's own shape, one layer
    over: a run that ASKED LESS has to say it asked less, or the silence reads
    as full coverage.
    """
    qdir = os.path.join(ROOT, "quality")
    tests = []
    for name in sorted(os.listdir(qdir)):
        if name.startswith("test_") and name.endswith(".py"):
            rel = os.path.join("quality", name)
            if rel not in EXCLUDE_TESTS:
                tests.append(rel)
    tests.append("battery.py")
    if only:
        want = {os.path.normpath(t) for t in only}
        missing = sorted(want - set(tests))
        if missing:
            raise ValueError(
                "--tests names %s, which %s not in the inventory. A bound that "
                "silently drops a name it cannot resolve is a smaller run "
                "reported as a full one."
                % (", ".join(missing), "is" if len(missing) == 1 else "are"))
        tests = [t for t in tests if t in want]
    return tests


# ---------------------------------------------------------------------------
# Shadow tree — the copy every mutation is applied to
# ---------------------------------------------------------------------------

def _mirror(src_dir, dst_dir, links):
    """Real directories all the way down; copy small files, symlink big ones."""
    os.makedirs(dst_dir, exist_ok=True)
    for name in sorted(os.listdir(src_dir)):
        if name in SKIP_NAMES:
            continue
        s, d = os.path.join(src_dir, name), os.path.join(dst_dir, name)
        rel = os.path.relpath(s, ROOT)
        # A sibling session writing atomically (tmp file + rename) makes files
        # appear and vanish under the walk. Skipping them is correct: they are
        # not part of the repo, and crashing here would make this runner fail
        # whenever anyone else was working.
        try:
            if os.path.isdir(s):
                if rel in SYMLINK_DIRS:
                    os.symlink(os.path.realpath(s), d)
                    links.append(rel)
                else:
                    _mirror(s, d, links)
            elif name.endswith(".py") or os.path.getsize(s) <= COPY_MAX_BYTES:
                shutil.copy2(s, d)
            else:
                os.symlink(os.path.realpath(s), d)
                links.append(rel)
        except FileNotFoundError:
            continue


_SNAPSHOT = {}


def snapshot(base):
    """ONE frozen copy of the repo per run; every mutant is copied from it.

    Building each mutant straight from ROOT would read the working tree at
    thirty different instants. With five sibling sessions editing the repo that
    is thirty different codebases, and a mutation that looks caught would be
    somebody else's edit landing between two builds. The snapshot is taken
    once, before the baseline, and is what the baseline is a baseline OF.
    """
    if "path" not in _SNAPSHOT:
        dst = tempfile.mkdtemp(prefix="snapshot-", dir=base)
        _mirror(ROOT, dst, [])
        _SNAPSHOT["path"] = dst
    return _SNAPSHOT["path"]


def build_shadow(base):
    """A private tree: everything writable COPIED, bulk data SYMLINKED.

    Copying the Python is what makes a run reproducible while sibling sessions
    edit the repo. Copying the small NON-Python files is what stops a mutant's
    output escaping into the working tree (see SYMLINK_DIRS).
    """
    src = snapshot(base)
    dst = tempfile.mkdtemp(prefix="mutant-", dir=base)
    shutil.rmtree(dst)
    shutil.copytree(src, dst, symlinks=True)
    return dst


def sweep_scratch(base, older_than=3600):
    """Delete shadow trees left by a run that was killed before its `finally`.

    A `finally` does not run through SIGKILL, and this runner shares a disk
    with five sibling sessions -- the first full audit died on ENOSPC. Every
    tree this module makes is named `mutant-*` or `snapshot-*` under its own
    scratch base, so sweeping them is unambiguous and touches nothing else.
    """
    now = time.time()
    freed = 0
    for name in os.listdir(base):
        if not (name.startswith("mutant-") or name.startswith("snapshot-")):
            continue
        p = os.path.join(base, name)
        try:
            if os.path.isdir(p) and now - os.path.getmtime(p) > older_than:
                shutil.rmtree(p, ignore_errors=True)
                freed += 1
        except OSError:
            pass
    return freed


def _scratch_base():
    base = os.environ.get("MUTATE_SCRATCH")
    if base and os.path.isdir(base):
        return base
    if base:
        os.makedirs(base, exist_ok=True)
        return base
    return tempfile.gettempdir()


# ---------------------------------------------------------------------------
# Running one test
# ---------------------------------------------------------------------------

class Gate:
    """Shared/exclusive access to the machine.

    Ordinary test runs share it. A CONFIRMATION run gets it alone, because at
    least one file in this suite asserts on WALL CLOCK -- `test_relations.py`
    requires 30k units to build in under 3 seconds -- and a wall-clock
    assertion makes the suite's verdict a function of machine load. Run nine
    processes on four cores and that file goes red under a mutation it cannot
    see, which reports a HOLE AS COVERED: the worst possible direction for this
    instrument to fail in. Doctrine 66 says a result that does not reproduce is
    not a result; this is that, with load in place of a hash seed.
    """

    def __init__(self):
        self._cv = __import__("threading").Condition()
        self._active = 0
        self._exclusive = False

    def acquire_shared(self):
        with self._cv:
            while self._exclusive:
                self._cv.wait()
            self._active += 1

    def release_shared(self):
        with self._cv:
            self._active -= 1
            self._cv.notify_all()

    def acquire_exclusive(self):
        with self._cv:
            while self._exclusive:
                self._cv.wait()
            self._exclusive = True
            while self._active:
                self._cv.wait()

    def release_exclusive(self):
        with self._cv:
            self._exclusive = False
            self._cv.notify_all()


GATE = Gate()


def run_test(tree, rel_path, timeout=420):
    """-> (status, seconds, tail-of-output). status in PASS/FAIL/ERROR/TIMEOUT.

    FAIL and ERROR are distinguished because they are different evidence: FAIL
    means an assertion in that file disagreed with the mutant, ERROR means the
    mutant broke the file badly enough that it could not run. Both count as
    caught; only FAIL means somebody wrote a check.
    """
    env = dict(os.environ)
    env["PYTHONHASHSEED"] = str(SEED)          # doctrine 66
    env["PYTHONDONTWRITEBYTECODE"] = "1"       # no shared/stale bytecode
    env["LYRIC_MUTATE_ACTIVE"] = "1"           # recursion guard
    t0 = time.time()
    GATE.acquire_shared()
    try:
        p = subprocess.run([sys.executable, rel_path], cwd=tree, env=env,
                           capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return "TIMEOUT", round(time.time() - t0, 1), "timed out"
    finally:
        GATE.release_shared()
    dt = round(time.time() - t0, 1)
    if p.returncode == 0:
        return "PASS", dt, ""
    err = (p.stderr or b"").decode("utf-8", "replace")
    out = (p.stdout or b"").decode("utf-8", "replace")
    status = "ERROR" if "Traceback (most recent call last)" in err else "FAIL"
    tail = (err.strip() or out.strip()).splitlines()
    return status, dt, " | ".join(tail[-3:])[:400]


def confirm_failure(tree, rel_path, timeout=420, attempts=3):
    """Re-run a failing test with the machine to itself. -> (verdict, detail).

    `verdict` is one of three, and the third one was being read as the first:

      CAUGHT    the test went red again, with a verdict, on an isolated re-run.
      FLAKY     it PASSED on an isolated re-run, so the red was load and not
                the mutation. Not counted as a catch.
      REFUSED   it never finished. A timeout is not a verdict -- the test did
                not disagree with the mutant, it never got to the end of
                itself -- and counting it as a catch reports a HOLE AS COVERED,
                which is the one direction this instrument must never fail in.
                Doctrine 79: a refusal belongs in its own count, never in the
                numerator of the thing it could not measure.

    A catch is only a catch if it reproduces. Without this the runner reports
    `test_relations.py` as the detector of the head/tail alignment mutation --
    which it is not; it went red on its 3-second budget under load, and passes
    that mutation cleanly when run alone.

    The gate only quiets THIS runner's processes. Five sibling sessions share
    the machine and cannot be quieted, so a single isolated re-run is not
    enough: the test is retried up to `attempts` times and ONE pass is enough
    to call it load-sensitive. That asymmetry is deliberate. Calling a genuine
    catch load-sensitive costs an escalation to the rest of the inventory and a
    line in the report; calling a load flake a catch reports a hole as covered.
    """
    last = "failed on every isolated re-run"
    timed_out = 0
    for _ in range(max(1, attempts)):
        GATE.acquire_exclusive()
        try:
            env = dict(os.environ)
            env["PYTHONHASHSEED"] = str(SEED)
            env["PYTHONDONTWRITEBYTECODE"] = "1"
            env["LYRIC_MUTATE_ACTIVE"] = "1"
            try:
                p = subprocess.run([sys.executable, rel_path], cwd=tree,
                                   env=env, capture_output=True,
                                   timeout=timeout)
            except subprocess.TimeoutExpired:
                timed_out += 1
                last = "timed out on every isolated re-run (%ds)" % timeout
                continue
        finally:
            GATE.release_exclusive()
        if p.returncode == 0:
            return "FLAKY", ("passed on an isolated re-run: LOAD-SENSITIVE, "
                             "not counted as a catch")
        err = (p.stderr or b"").decode("utf-8", "replace")
        out = (p.stdout or b"").decode("utf-8", "replace")
        tail = (err.strip() or out.strip()).splitlines()
        last = " | ".join(tail[-3:])[:400]
        return "CAUGHT", last
    if timed_out:
        return "REFUSED", last
    return "CAUGHT", last


# ---------------------------------------------------------------------------
# Baseline
# ---------------------------------------------------------------------------

def source_fingerprint():
    """sha256 over every `.py` the shadow tree copies, so a baseline computed
    against one snapshot is never reused against another."""
    h = hashlib.sha256()
    for d in (ROOT, os.path.join(ROOT, "quality"),
              os.path.join(ROOT, "quality", "phonology")):
        for name in sorted(os.listdir(d)):
            if name.endswith(".py"):
                p = os.path.join(d, name)
                h.update(name.encode())
                h.update(open(p, "rb").read())
    return h.hexdigest()[:16]


def baseline(tests, jobs, cache_path, force=False, confirm_all=False,
             timeout=420):
    """Which tests are GREEN right now. A test red at baseline is excluded
    from the detector set: it fails either way, so it distinguishes nothing."""
    fp = source_fingerprint()
    if not force and cache_path and os.path.exists(cache_path):
        try:
            cached = json.load(open(cache_path))
            if cached.get("fingerprint") == fp and \
                    set(cached["results"]) >= set(tests):
                print(f"baseline: cached ({fp})")
                return cached["results"]
        except Exception:
            pass
    print(f"baseline: running {len(tests)} checks unmutated ({fp}) ...")
    tree = build_shadow(_scratch_base())
    results = {}
    try:
        with futures.ThreadPoolExecutor(max_workers=jobs) as ex:
            fs = {ex.submit(run_test, tree, t, timeout): t for t in tests}
            for f in futures.as_completed(fs):
                t = fs[f]
                st, dt, tail = f.result()
                if st != "PASS" and (confirm_all or t in LOAD_SENSITIVE
                                     or st == "TIMEOUT"):
                    # Same rule as a catch: red under load is not red. A
                    # TIMEOUT is ALWAYS re-run, whatever LOAD_SENSITIVE says —
                    # that list is about wall-clock ASSERTIONS, and a timeout
                    # is the runner's own clock, which every test is exposed to
                    # once siblings are on the machine.
                    verdict, detail = confirm_failure(tree, t, timeout)
                    if verdict == "FLAKY":
                        st, tail = "PASS", ""
                    else:
                        tail = detail
                results[t] = {"status": st, "seconds": dt, "detail": tail}
                if st != "PASS":
                    print(f"  BASELINE-RED  {t}  ({st})  {tail[:120]}")
    finally:
        shutil.rmtree(tree, ignore_errors=True)
    if cache_path:
        json.dump({"fingerprint": fp, "results": results},
                  open(cache_path, "w"), indent=1)
    green = [t for t, r in results.items() if r["status"] == "PASS"]
    print(f"baseline: {len(green)}/{len(tests)} green, "
          f"{len(tests) - len(green)} excluded as already-red")
    return results


# ---------------------------------------------------------------------------
# Running one mutation
# ---------------------------------------------------------------------------

def apply_mutation(tree, mut):
    """Write the mutant into the SHADOW copy. Never touches the real tree.

    The precondition is `anchor_defect`'s, not a second spelling of it: this
    function and `--dry-run` and `quality/test_mutation.py` section 2 all ask
    one question of one predicate, so `--dry-run` reporting clean can never
    mean anything other than that the sweep would apply.
    """
    path = os.path.join(tree, mut.file)
    src = open(path, encoding="utf-8").read()
    d = anchor_defect(mut, src)
    if d:
        raise ValueError(f"{mut.name} [{d[0]}] in {mut.file}: {d[1]}")
    out = src.replace(mut.old, mut.new)
    if out == src:                       # unreachable via anchor_defect; belt
        raise ValueError(f"{mut.name}: mutation is a no-op")
    open(path, "w", encoding="utf-8").write(out)


def run_mutation(mut, green, jobs, mode, base, confirm_all=False,
                 timeout=420):
    """-> result dict. Runs the declared subset; escalates to the full green
    suite if the subset finds nothing, because a SURVIVOR is a finding and a
    finding has to be checked against everything before it is reported."""
    tree = build_shadow(base)
    try:
        try:
            apply_mutation(tree, mut)
        except ValueError as e:
            # The code moved under the mutation list. That is a finding about
            # the LIST, not about the suite, and it must not be reported as a
            # survivor -- a stale anchor and an undetected defect look nothing
            # alike and only one of them is the suite's fault.
            return {"name": mut.name, "layer": mut.layer, "file": mut.file,
                    "rationale": mut.rationale,
                    "subset_declared": list(mut.subset),
                    "subset_missing_from_green": [], "scope_run": "STALE",
                    "tests_run": [], "caught_by": {}, "load_sensitive": {},
                    "refused_by": {}, "indeterminate": False,
                    "survived": False, "stale": str(e), "seconds": 0.0}
        if mode == "full":
            plan = [("full", list(green))]
        else:
            # dict.fromkeys: subsets are concatenated tuples (T_STRUCT +
            # T_INGEST), so a test can appear twice and would otherwise be run
            # twice for nothing.
            declared = [t for t in dict.fromkeys(mut.subset) if t in green]
            plan = [("subset", declared),
                    ("escalated-full", [t for t in green if t not in declared])]
        caught, flaky, refused, ran, timings, scope = {}, {}, {}, [], {}, None
        for label, batch in plan:
            if not batch:
                continue
            scope = label if scope is None else f"{scope}+{label}"
            reds = []
            with futures.ThreadPoolExecutor(max_workers=jobs) as ex:
                fs = {ex.submit(run_test, tree, t, timeout): t
                      for t in batch}
                for f in futures.as_completed(fs):
                    t = fs[f]
                    st, dt, tail = f.result()
                    ran.append(t)
                    timings[t] = dt
                    if st != "PASS":
                        reds.append((t, st, tail))
            # A red in the load-sensitive set is re-run ALONE before it is
            # allowed to be a catch. So is EVERY timeout, unconditionally: a
            # test that never finished did not disagree with the mutant, and
            # the old code put it straight into `caught` (doctrine 79 -- a
            # refusal in the numerator charges the wrong layer, and here the
            # layer it charges is the SUITE, credited with a detection it
            # never made).
            for t, st, tail in reds:
                if confirm_all or t in LOAD_SENSITIVE or st == "TIMEOUT":
                    verdict, detail = confirm_failure(tree, t, timeout)
                else:
                    verdict, detail = "CAUGHT", tail
                if verdict == "CAUGHT":
                    caught[t] = {"status": st, "detail": detail}
                elif verdict == "REFUSED":
                    refused[t] = detail
                else:
                    flaky[t] = detail
            if caught:
                break                      # subset did its job; do not pay full
        return {
            "name": mut.name, "layer": mut.layer, "file": mut.file,
            "rationale": mut.rationale,
            "subset_declared": list(mut.subset),
            "subset_missing_from_green": [t for t in mut.subset
                                          if t not in green],
            "scope_run": scope or "none", "tests_run": sorted(ran),
            "caught_by": caught, "load_sensitive": flaky,
            "refused_by": refused,
            # Three outcomes, not two. A mutation nothing caught is a SURVIVOR
            # only if every test in scope actually reached a verdict on it;
            # where one refused, the honest answer is that this run does not
            # know, and calling that a hole would be as wrong as calling it
            # covered.
            "indeterminate": bool(refused) and not caught,
            "survived": not caught and not refused,
            "seconds": round(sum(timings.values()), 1),
        }
    finally:
        shutil.rmtree(tree, ignore_errors=True)   # never leave a mutant on disk


# ---------------------------------------------------------------------------
# Restore verification
# ---------------------------------------------------------------------------

def root_hashes():
    out = {}
    for d in (ROOT, os.path.join(ROOT, "quality")):
        for name in sorted(os.listdir(d)):
            if name.endswith(".py"):
                p = os.path.join(d, name)
                out[os.path.relpath(p, ROOT)] = hashlib.sha256(
                    open(p, "rb").read()).hexdigest()[:12]
    return out


def verify_pristine(muts, before, after):
    """The working tree must be exactly as we found it.

    Three outcomes, kept apart because they mean different things:

      PROBLEM   a mutation's `new` text is present in the real file. Only this
                is a failed restore, and it is the loud one.
      STALE     `old` is gone and `new` never arrived. A sibling refactored the
                code; the LIST is out of date, and reporting it as a restore
                failure would send the next reader hunting for damage that
                does not exist.
      CHANGED   a sha256 diff over every root `.py`. Under five concurrent
                sessions this fires routinely and is INFORMATION, not an
                error: mutations touch shadow copies only, so this runner
                cannot produce it.

    The test is PRESENCE OF `old`, not absence of `new`, and the difference
    is not pedantry -- searching for `new` gives false alarms, because a
    mutation is often a TRUNCATION of the line it replaces. `M22` rewrites
    `norm = text.replace(...)` to `norm = text`, and `norm = text` is a prefix
    of the original, so an absence-of-`new` check reports THE RESTORE FAILED
    on a pristine file. Four of thirty mutations had that shape and all four
    fired falsely on the first run. Presence of `old` has no such failure
    mode: applying a mutation removes `old`, so `old` present means, exactly,
    not applied.
    """
    problems, stale = [], []
    for m in muts:
        try:
            src = open(os.path.join(ROOT, m.file), encoding="utf-8").read()
        except OSError as e:
            problems.append(f"{m.name}: cannot read {m.file}: {e}")
            continue
        if m.old in src:
            continue                      # not applied. Definitive.
        if m.new in src:
            problems.append(f"{m.name}: the ORIGINAL text is gone from "
                            f"{m.file} and the MUTANT text is there — "
                            f"THE RESTORE FAILED")
        else:
            stale.append(f"{m.name}: anchor text no longer in {m.file} "
                         f"(the code moved; the mutation list needs updating)")
    changed = sorted(k for k in set(before) | set(after)
                     if before.get(k) != after.get(k))
    return problems, changed, stale


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def report(results, baseline_results, elapsed, mode, bounded=None):
    print()
    print("=" * 78)
    print(f"MUTATION REPORT  ({mode} mode, seed {SEED})")
    print("=" * 78)
    if bounded:
        # Printed FIRST, above the excluded-at-baseline block, because it
        # changes what every line below it means. "SURVIVED" under a bounded
        # inventory is "nothing in these files caught it", not "nothing in the
        # suite caught it", and a reader who skims the table has to be told
        # before they read it, not after.
        print(f"INVENTORY BOUNDED to {len(bounded)} file(s) — SURVIVED below "
              f"means 'survived these', NOT 'survived the suite':")
        for t in bounded:
            print(f"    {t}")
        print()
    red = [t for t, r in baseline_results.items() if r["status"] != "PASS"]
    if red:
        print("EXCLUDED, already red at baseline (cannot distinguish anything):")
        for t in red:
            print(f"  {t}  {baseline_results[t]['status']}  "
                  f"{baseline_results[t]['detail'][:90]}")
        print()
    print(f"{'mut':5s} {'layer':11s} {'scope':22s} caught by")
    print("-" * 78)
    survivors, indeterminate = [], []
    flaky = {}
    for r in results:
        for t, d in r.get("load_sensitive", {}).items():
            flaky.setdefault(t, []).append(r["name"])
        if r.get("stale"):
            who = f"STALE ANCHOR — {r['stale'][:60]}"
        elif r.get("indeterminate"):
            indeterminate.append(r["name"])
            who = ("??? INDETERMINATE — " + ", ".join(
                os.path.basename(t) for t in sorted(r.get("refused_by", {})))
                + " never finished")
        elif r["survived"]:
            survivors.append(r["name"])
            who = "*** SURVIVED ***"
        else:
            who = ", ".join(f"{os.path.basename(t)}[{d['status']}]"
                            for t, d in sorted(r["caught_by"].items()))
        print(f"{r['name']:5s} {r['layer']:11s} {r['scope_run']:22s} {who}")
    print("-" * 78)
    if flaky:
        print("LOAD-SENSITIVE: went red under a mutation and passed on an "
              "isolated re-run, so NOT counted as a catch:")
        for t, names in sorted(flaky.items()):
            print(f"  {t}  on {', '.join(names)}")
        print()
    stale = [r["name"] for r in results if r.get("stale")]
    # FOUR counts, never three summed into two (doctrine 79). CAUGHT is a
    # detection, SURVIVED is a hole, INDETERMINATE is a refusal -- a test in
    # scope never reached a verdict, so this run cannot say which of the other
    # two it is -- and STALE is a finding about the LIST, not about the suite.
    caught_n = (len(results) - len(survivors) - len(stale)
                - len(indeterminate))
    print(f"{caught_n}/{len(results)} caught, {len(survivors)} SURVIVED, "
          f"{len(indeterminate)} INDETERMINATE, {len(stale)} stale   "
          f"wall clock {elapsed:.1f}s")
    if stale:
        print(f"  STALE anchors (the code moved, the list did not): "
              f"{', '.join(stale)}")
    if indeterminate:
        print()
        print("INDETERMINATE — a test in scope never finished, so neither "
              "'caught' nor 'a hole' is earned here:")
        for r in results:
            if r.get("indeterminate"):
                print(f"  {r['name']} [{r['layer']}] {r['file']}  "
                      f"refused by " + ", ".join(
                          f"{os.path.basename(t)} ({d})"
                          for t, d in sorted(r["refused_by"].items())))
    if survivors:
        print()
        print("SURVIVING MUTATIONS — each one is a hole in the suite, named:")
        for r in results:
            if r["survived"]:
                print(f"\n  {r['name']} [{r['layer']}] {r['file']}")
                print(f"    {r['rationale']}")
                print(f"    ran {len(r['tests_run'])} checks, none failed: "
                      + ", ".join(os.path.basename(t)
                                  for t in r["tests_run"]))
    return survivors


# ---------------------------------------------------------------------------

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--full", action="store_true",
                    help="every mutation against every green test (the audit)")
    ap.add_argument("--dry-run", action="store_true",
                    help="only check that every mutation still applies cleanly")
    ap.add_argument("--only", nargs="*", default=None, help="mutation names")
    ap.add_argument("--layer", nargs="*", default=None, help="layers to run")
    ap.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 2)),
                    help="test processes per mutation")
    ap.add_argument("--mutation-jobs", type=int, default=2,
                    help="mutations in flight at once, each with its own "
                         "shadow tree; the outer axis exists because one 40 s "
                         "test file otherwise sets the floor for every mutation")
    ap.add_argument("--tests", nargs="*", default=None,
                    help="BOUND the inventory to these repo-relative test "
                         "files. SURVIVED then means 'survived these', not "
                         "'survived the suite', and the report says so at the "
                         "top of the table")
    ap.add_argument("--timeout", type=int, default=420,
                    help="seconds one test file may take. Raise it on a "
                         "loaded machine: a timeout is now a REFUSAL, not a "
                         "catch, so a tight limit buys indeterminate "
                         "results rather than wrong ones")
    ap.add_argument("--rebaseline", action="store_true")
    ap.add_argument("--confirm-all", action="store_true",
                    help="re-run EVERY red alone before counting it a catch, "
                         "not only those in LOAD_SENSITIVE")
    ap.add_argument("--json", default=None, help="write results here")
    a = ap.parse_args(argv)

    muts = MUTATIONS
    if a.only:
        muts = [m for m in muts if m.name in set(a.only)]
    if a.layer:
        muts = [m for m in muts if m.layer in set(a.layer)]
    if not muts:
        print("no mutations selected")
        return 2

    if a.dry_run:
        # THE INVENTORY SHRINKING MUST READ AS "SOMETHING IS BROKEN", NOT AS
        # "CANNOT TELL". That distinction is the whole reason this branch has
        # an exit code and a shaped message rather than a count.
        #
        # On 2026-08-13 a lot refactoring `Mandate.returns_check` folded QS3's
        # anchor into a list comprehension. `--dry-run` fell to 56/57 and
        # adversary 4 lost a member from a tidy refactor in a different file.
        # It was caught because a THIRD lot happened to run
        # `quality/counters.py --write` in that window. That is luck, and the
        # instrument it relied on is the wrong KIND of signal: an anchor that
        # stops matching makes `mutations_declared()` RAISE, which
        # `counters.py` renders as `REFUSED (cost) — the instrument did not
        # answer`. Doctrine 79 says a refusal is not a failure and that is
        # correct in its own terms -- but `--check`'s own printed remedy for a
        # value cell that moved is `--write`, and `--write` COMMITS the refusal
        # into BACKLOG.md and exits 0, after which `--check` reads REFUSED
        # against REFUSED and prints PASS. Measured 2026-08-14 on a shadow
        # tree with M1 and QS3 both drifted: `--check` exit 1, then `--write`
        # exit 0, then `--check` exit 0 with two mutations permanently inert.
        # `--write` is run routinely, because the `public symbols` row moves
        # under sibling lots and that is its remedy too -- so the mute is not
        # an edge case, it is the ordinary repair path.
        #
        # THIS exit code cannot be laundered by writing a file. It is a
        # question asked of the source every time it is asked at all.
        bad = survey_anchors(muts, ROOT)
        # THE BOUND IS A COORDINATE, NOT A FOOTNOTE (doctrine 91, the shape
        # `report()` already prints for `--tests`). `--only`/`--layer` make
        # `2/2 mutations apply cleanly` render identically to a run that asked
        # the whole inventory, and `counters.py` reads that line by regex. It
        # invokes this command unbounded, so nothing is mis-stated today; it is
        # one flag away from being so, and a run that ASKED LESS has to say it
        # asked less rather than let the silence read as full coverage.
        if len(muts) != len(MUTATIONS):
            print("INVENTORY BOUNDED to %d of the %d declared mutation(s) — "
                  "'apply cleanly' below is a statement about THESE only"
                  % (len(muts), len(MUTATIONS)))
        for name, kind, path, why in bad:
            print(f"{kind:9s} {name:5s} {path:22s} {why}")
        # Byte-shape of the next line is load-bearing: `counters.py`'s
        # `mutations_declared()` greps `(\d+)/(\d+) mutations apply cleanly`
        # out of this stdout and REFUSES rather than guessing if it moves.
        print(f"{len(muts) - len(bad)}/{len(muts)} mutations apply cleanly")
        if not bad:
            # Disclosed on the clean path too, so a SHRINKING inventory is
            # visible by eye and not only by an exit code nobody reads: a
            # deleted mutation leaves 57/57 behind, and only these numbers move
            # (`quality/test_mutation.py` section 1 is what asserts them).
            series = collections.Counter(
                "M-series" if m.name.startswith("M") else "Q-series"
                for m in muts)
            print("  " + ", ".join("%s %d" % (k, series[k])
                                   for k in sorted(series))
                  + " across %d target file(s)" % len({m.file for m in muts}))
            return 0
        kinds = collections.Counter(k for _, k, _, _ in bad)
        print()
        print("REFUSED — %d of %d declared mutation(s) do not apply (%s)."
              % (len(bad), len(muts),
                 ", ".join("%d %s" % (n, k) for k, n in sorted(kinds.items()))))
        print(REPAIR)
        return 1

    base = _scratch_base()
    swept = sweep_scratch(base)
    if swept:
        print(f"swept {swept} shadow tree(s) left by an interrupted run")
    try:
        tests = discover_tests(a.tests)
    except ValueError as e:
        print("REFUSED — %s" % e)
        return 2
    t0 = time.time()
    before = root_hashes()
    # A bounded run gets its OWN cache file. The baseline is keyed on a source
    # fingerprint, not on which tests were asked for, so sharing one file would
    # let a 9-file bounded baseline satisfy a later 44-file run's cache check
    # -- the bound would leak forward into a run that never declared it.
    cache = os.path.join(base, "baseline.json" if not a.tests else
                         "baseline-bounded-%s.json"
                         % hashlib.sha256(
                             "\n".join(sorted(tests)).encode()).hexdigest()[:8])
    bl = baseline(tests, a.jobs, cache, force=a.rebaseline,
                  confirm_all=a.confirm_all, timeout=a.timeout)
    green = [t for t, r in bl.items() if r["status"] == "PASS"]

    mode = "full" if a.full else "subset"
    results = []
    # Two axes of parallelism, because the suite's cost is one long pole: the
    # slowest single test file is ~40 s, so a mutation can never finish faster
    # than that however many workers it gets. Running several MUTATIONS in
    # flight is what hides it. Each has its own shadow tree, so they cannot
    # interfere; the trees are ~1.7 MB of copied .py over symlinked data.
    with futures.ThreadPoolExecutor(max_workers=max(1, a.mutation_jobs)) as ex:
        fs = {ex.submit(run_mutation, m, green, a.jobs, mode, base,
                        a.confirm_all, a.timeout): m
              for m in muts}
        for f in futures.as_completed(fs):
            r = f.result()
            results.append(r)
            mark = "SURVIVED" if r["survived"] else "caught"
            print(f"  {r['name']:4s} {r['layer']:11s} {mark:9s} "
                  f"{r['scope_run']:16s} {r['seconds']:6.1f}s  "
                  + (", ".join(os.path.basename(t) for t in r["caught_by"])
                     or "-"))
    order = {m.name: i for i, m in enumerate(muts)}
    results.sort(key=lambda r: order[r["name"]])

    elapsed = time.time() - t0
    survivors = report(results, bl, elapsed, mode,
                       bounded=tests if a.tests else None)

    problems, changed, stale_now = verify_pristine(muts, before, root_hashes())
    print()
    if stale_now:
        print("STALE ANCHORS (a sibling moved the code; update the list):")
        for t in stale_now:
            print("  " + t)
    if problems:
        print("RESTORE CHECK: *** FAILED ***")
        for p in problems:
            print("  " + p)
    else:
        print("RESTORE CHECK: clean — every mutation's original text is intact "
              "in the working tree and no mutant text is present")
    if changed:
        print(f"  note: {len(changed)} root .py file(s) changed during the run "
              f"— a sibling session's edit, not this runner (mutations are "
              f"applied only to shadow copies): {', '.join(changed)}")

    if _SNAPSHOT.get("path"):
        shutil.rmtree(_SNAPSHOT["path"], ignore_errors=True)
        _SNAPSHOT.pop("path", None)

    if a.json:
        json.dump({"seed": SEED, "mode": mode, "elapsed": elapsed,
                   "inventory": tests, "bounded": bool(a.tests),
                   "baseline": bl, "results": results,
                   "survivors": survivors,
                   "indeterminate": [r["name"] for r in results
                                     if r.get("indeterminate")]},
                  open(a.json, "w"), indent=1)
    return 1 if (survivors or problems) else 0


if __name__ == "__main__":
    sys.exit(main())

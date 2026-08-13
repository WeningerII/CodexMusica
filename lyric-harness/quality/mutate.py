#!/usr/bin/env python3
"""Adversary 4 — mutation testing. Can this suite detect a broken harness?

    python3 quality/mutate.py             # declared subsets, escalate on survival
    python3 quality/mutate.py --full      # every mutation against every green test
    python3 quality/mutate.py --dry-run   # only check the mutation list still applies
    python3 quality/mutate.py --only M1 M12 --jobs 4

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
it fails either way. (At the time of writing `quality/test_fwer.py` is in that
state. Its four failures are real findings about the time layer and they are
also, for this instrument, a blind spot: whatever it would have detected, it
cannot report while it is red.)

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

LH = "lyric_harness.py"
BAT = "battery.py"

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
]


# ---------------------------------------------------------------------------
# Test inventory
# ---------------------------------------------------------------------------

def discover_tests():
    """Every runnable check in the repo, as repo-relative paths.

    `battery.py` is here on purpose, and since `9396946` (2026-08-11) it IS an
    assertion: `assert_pinned` diffs the sonnet oracle against `EXPECTED` and
    `__main__` exits 1 on drift, so its returncode is a real verdict on the
    four counts it pins. CORRECTED 2026-08-13 -- this docstring previously
    said the opposite ("exit status is 0 whatever the numbers say"), which was
    the stated reason for including it.
    """
    qdir = os.path.join(ROOT, "quality")
    tests = []
    for name in sorted(os.listdir(qdir)):
        if name.startswith("test_") and name.endswith(".py"):
            rel = os.path.join("quality", name)
            if rel not in EXCLUDE_TESTS:
                tests.append(rel)
    tests.append("battery.py")
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
    """Re-run a failing test with the machine to itself. -> (bool, detail).

    A catch is only a catch if it reproduces. Without this the runner reports
    `test_relations.py` as the detector of the head/tail alignment mutation --
    which it is not; it went red on its 3-second budget under load, and passes
    that mutation cleanly when run alone.

    The gate only quiets THIS runner's processes. Five sibling sessions share
    the machine and cannot be quieted, so a single isolated re-run is not
    enough: the test is retried up to `attempts` times and ONE pass is enough
    to call it load-sensitive. That asymmetry is deliberate. Calling a genuine
    catch load-sensitive costs an escalation to the full suite and a line in
    the report; calling a load flake a catch reports a HOLE AS COVERED, which
    is the failure this whole file exists to prevent.
    """
    last = "failed on every isolated re-run"
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
                last = "timed out"
                continue
        finally:
            GATE.release_exclusive()
        if p.returncode == 0:
            return False, ("passed on an isolated re-run: LOAD-SENSITIVE, "
                           "not counted as a catch")
        err = (p.stderr or b"").decode("utf-8", "replace")
        out = (p.stdout or b"").decode("utf-8", "replace")
        tail = (err.strip() or out.strip()).splitlines()
        last = " | ".join(tail[-3:])[:400]
    return True, last


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


def baseline(tests, jobs, cache_path, force=False, confirm_all=False):
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
            fs = {ex.submit(run_test, tree, t): t for t in tests}
            for f in futures.as_completed(fs):
                t = fs[f]
                st, dt, tail = f.result()
                if st != "PASS" and (confirm_all or t in LOAD_SENSITIVE):
                    # Same rule as a catch: red under load is not red.
                    ok, detail = confirm_failure(tree, t)
                    if not ok:
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
    """Write the mutant into the SHADOW copy. Never touches the real tree."""
    path = os.path.join(tree, mut.file)
    src = open(path, encoding="utf-8").read()
    n = src.count(mut.old)
    if n != 1:
        raise ValueError(
            f"{mut.name}: anchor text occurs {n} times in {mut.file} "
            f"(need exactly 1). The code moved under the mutation list.")
    out = src.replace(mut.old, mut.new)
    if out == src:
        raise ValueError(f"{mut.name}: mutation is a no-op")
    open(path, "w", encoding="utf-8").write(out)


def run_mutation(mut, green, jobs, mode, base, confirm_all=False):
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
        caught, flaky, ran, timings, scope = {}, {}, [], {}, None
        for label, batch in plan:
            if not batch:
                continue
            scope = label if scope is None else f"{scope}+{label}"
            reds = []
            with futures.ThreadPoolExecutor(max_workers=jobs) as ex:
                fs = {ex.submit(run_test, tree, t): t for t in batch}
                for f in futures.as_completed(fs):
                    t = fs[f]
                    st, dt, tail = f.result()
                    ran.append(t)
                    timings[t] = dt
                    if st != "PASS":
                        reds.append((t, st, tail))
            # A red in the load-sensitive set is re-run ALONE before it is
            # allowed to be a catch.
            for t, st, tail in reds:
                if confirm_all or t in LOAD_SENSITIVE:
                    ok, detail = confirm_failure(tree, t)
                else:
                    ok, detail = True, tail
                if ok:
                    caught[t] = {"status": st, "detail": detail}
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
            "survived": not caught,
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

def report(results, baseline_results, elapsed, mode):
    print()
    print("=" * 78)
    print(f"MUTATION REPORT  ({mode} mode, seed {SEED})")
    print("=" * 78)
    red = [t for t, r in baseline_results.items() if r["status"] != "PASS"]
    if red:
        print("EXCLUDED, already red at baseline (cannot distinguish anything):")
        for t in red:
            print(f"  {t}  {baseline_results[t]['status']}  "
                  f"{baseline_results[t]['detail'][:90]}")
        print()
    print(f"{'mut':5s} {'layer':11s} {'scope':22s} caught by")
    print("-" * 78)
    survivors = []
    flaky = {}
    for r in results:
        for t, d in r.get("load_sensitive", {}).items():
            flaky.setdefault(t, []).append(r["name"])
        if r.get("stale"):
            who = f"STALE ANCHOR — {r['stale'][:60]}"
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
    print(f"{len(results) - len(survivors) - len(stale)}/{len(results)} "
          f"caught, {len(survivors)} SURVIVED, {len(stale)} stale   "
          f"wall clock {elapsed:.1f}s")
    if stale:
        print(f"  STALE anchors (the code moved, the list did not): "
              f"{', '.join(stale)}")
    if survivors:
        print()
        print("SURVIVING MUTATIONS — each one is a hole in the suite, named:")
        for r in results:
            if r["survived"]:
                print(f"\n  {r['name']} [{r['layer']}] {r['file']}")
                print(f"    {r['rationale']}")
                print(f"    ran {len(r['tests_run'])} checks, none failed")
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
        bad = []
        for m in muts:
            src = open(os.path.join(ROOT, m.file), encoding="utf-8").read()
            n = src.count(m.old)
            if n != 1:
                bad.append(f"{m.name}: anchor occurs {n}x in {m.file}")
            elif m.old == m.new:
                bad.append(f"{m.name}: no-op")
        for b in bad:
            print("STALE  " + b)
        print(f"{len(muts) - len(bad)}/{len(muts)} mutations apply cleanly")
        return 1 if bad else 0

    base = _scratch_base()
    swept = sweep_scratch(base)
    if swept:
        print(f"swept {swept} shadow tree(s) left by an interrupted run")
    tests = discover_tests()
    t0 = time.time()
    before = root_hashes()
    bl = baseline(tests, a.jobs, os.path.join(base, "baseline.json"),
                  force=a.rebaseline, confirm_all=a.confirm_all)
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
                        a.confirm_all): m
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
    survivors = report(results, bl, elapsed, mode)

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
                   "baseline": bl, "results": results,
                   "survivors": survivors},
                  open(a.json, "w"), indent=1)
    return 1 if (survivors or problems) else 0


if __name__ == "__main__":
    sys.exit(main())

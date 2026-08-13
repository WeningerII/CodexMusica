#!/usr/bin/env python3
"""Doctrine cross-reference verifier, and the doctrine -> check REGISTRY.

The split of CLAUDE.md into CLAUDE.md + quality/METHOD.md is only safe if every
`doctrine N` reference in the repository still resolves to exactly one
definition. This asserts:

  1. every number DEFINED across the two files is defined exactly ONCE
  2. every number REFERENCED anywhere in the repo is defined somewhere
  3. no number that was defined before the split has been lost
  4. the definition set is a contiguous run
  5. every `known gap N` resolves against CLAUDE.md's own list
  6. every defined doctrine carries a REGISTRY row: either the command that
     goes red when it is violated, or an explicit PROSE / N-A marker with a
     reason. A doctrine with neither FAILS.

Run:  python3 quality/verify_doctrines.py
      python3 quality/verify_doctrines.py --baseline   (re-derive (3)'s file)

WHAT CHANGED, AND WHY (2026-08-13)
----------------------------------
CHECK (3) WAS DEAD. `quality/baseline_defined.json` did not exist, so the
branch printed `[skip] no baseline on disk` and left the exit code at 0 --
"cannot tell" collapsed into "pass", which is doctrine 20/28's exact failure
and the one this file is otherwise built to catch. Two changes, and both were
needed:

  * the baseline is now ON DISK and DERIVED FROM HISTORY, not from the working
    tree. `--baseline` used to write `sorted(defs)` -- the CURRENT definition
    set -- so anyone who ran it made check (3) vacuous by construction: it
    would compare the tree against itself and never report a loss. It now
    re-reads `CLAUDE.md` at the commit BEFORE the split (`9b5f7c9`, the parent
    of `d11ca0a` "Split the doctrine file") and extracts the pre-split set the
    way that tree required -- by `## ` section, since the
    `<!-- DOCTRINE-BLOCK -->` markers did not exist yet and the `Known gaps`
    list uses the same markdown shape.
  * a MISSING or MALFORMED baseline is now a REFUSAL that exits non-zero, not
    a skip. A check that cannot run is not a check that passed.

CHECK (6) IS NEW, and it is doctrine 48 turned on the doctrine file itself.
Doctrine 48 says a principle is only real once it is mechanical -- and doctrine
48 was one of the principles that lived only in prose. Nothing mapped a
doctrine to a check, so a doctrine could be silently outlived by its own code
and no run would say so. The REGISTRY below is that map, and this file is now
doctrine 48's own mechanism.

THE REGISTRY IS NOT A HAND-WRITTEN TABLE NOBODY RE-DERIVES. Every row is
re-checked on every run:

  * every DEFINED number has exactly one row, and every row's number is
    defined -- so adding doctrine 96 without a row FAILS, and so does a row
    for a doctrine that does not exist;
  * a MECHANICAL row's command must be REAL: the script exists, every `--flag`
    in the command appears literally in that script's source, the script has a
    `__main__` so it can be run at all, and it has a NON-ZERO EXIT PATH -- this
    repo has shipped four instruments that printed their own drift and returned
    0 (`audit_spans`, `audit_tang_null`, `audit_kalevala_null`, and this file's
    own contiguity check), so "can this command fail?" is checked rather than
    assumed;
  * the link is corroborated AT BOTH ENDS. A MECHANICAL row is either
    `CITED` -- and then the cited script must itself carry a `doctrine N`
    reference, so stripping the citation out of the checker turns this red --
    or it carries a written reason why the check does not name the doctrine.
    There is no third state: a row cannot quietly assert a binding it has not
    declared;
  * every file path named in any row must exist.

WHAT MECHANICAL DOES AND DOES NOT CLAIM. It claims that at least one INSTANCE
of the doctrine is pinned by a command that goes red. It does not claim the
doctrine is exhaustively enforced -- no command can see that a future analysis
forgot to declare a coordinate; what the command sees is that the coordinates
already declared stay declared. The three other statuses are the honest
remainder and are counted separately, doctrine 79's shape: ASSERTED (an
instrument exists and prints the quantity, nothing exits non-zero), PROSE (no
instrument; the rule binds on a human at a moment no command observes), N-A
(a recorded finding or a retraction, not a rule anything can violate).

RUNNING the cited commands is deliberately NOT done here. Measured on this
repo the registry's 30 distinct commands include `test_revise.py` and
`test_loop.py` at 15+ minutes each; the set is hours. This file checks that
each command EXISTS and CAN FAIL, in about a second.
"""
import json
import os
import re
import subprocess
import sys

ROOT = "/home/user/CodexMusica/lyric-harness"
SCRATCH = os.path.dirname(os.path.abspath(__file__))
BASELINE = os.path.join(SCRATCH, "baseline_defined.json")

#: The tree the pre-split definition set is read from: the commit BEFORE
#: `d11ca0a` ("Split the doctrine file: 20 for writing, 75 for method,
#: numbering intact"). Recorded here as well as in the baseline file so
#: `--baseline` and the file it writes cannot drift apart.
PRESPLIT_COMMIT = "9b5f7c9c31b2e186f8a95855afa71070f1d9f629"
PRESPLIT_PATH = "./CLAUDE.md"
#: The `Known gaps` list uses the same `^\d+\. \*\*` shape for a DIFFERENT
#: numbering (cited as `known gap N`). Pre-split there were no DOCTRINE-BLOCK
#: markers, so the section heading is what separates them.
PRESPLIT_EXCLUDE = "## Known gaps, priority order"

#: A doctrine DEFINITION is a numbered item at the head of a line whose title is
#: bold.  Both files use it; nothing else in the repo does.
DEF = re.compile(r"^(\d+)\. \*\*", re.M)

#: A REFERENCE is "doctrine"/"doctrines" followed by one or more numbers joined
#: by /, comma, &, +, "and", "or".  The separator run must be followed by a
#: BARE number, so "doctrine 88, and doctrine 79" yields {88, 79} as two
#: references rather than swallowing the word "doctrine".
#: a literal SPACE, not \s -- `data/concreteness.txt` has a lexicon row
#: "doctrine\t0\t2.12" that a \s would read as a reference to doctrine 0.
REF_HEAD = re.compile(r"doctrines?[ ]+(\d+)", re.I)
REF_TAIL = re.compile(r"\s*(?:[,/&+]|and|or)\s*(\d+)", re.I)

SKIP_DIRS = {"__pycache__", ".git", "node_modules"}
# THIS FILE EXCLUDES ITSELF, and the reason is a small instance of the general
# problem. The checker documents the `data/concreteness.txt` trap -- a lexicon
# row `doctrine<TAB>0` that a \s-based reference regex reads as a citation of
# "doctrine 0" -- and writing that sentence down created a real citation of a
# doctrine that does not exist. Promoted from a sibling's scratch directory
# into quality/ on 2026-08-11, it failed on its own prose within one run.
# An instrument placed inside the population it measures becomes part of it.
SKIP_FILES = {"cmudict.dict", "wordfreq20k.txt",
              os.path.basename(os.path.abspath(__file__))}
TEXTY = (".md", ".py", ".tsv", ".txt", ".json", ".sh", ".toml", ".cfg", ".yml",
         ".yaml")

MECHANICAL, ASSERTED, PROSE, NA = "MECHANICAL", "ASSERTED", "PROSE", "N-A"
STATUSES = (MECHANICAL, ASSERTED, PROSE, NA)
#: A MECHANICAL row's `binding` is either this -- and then the cited script
#: must carry a `doctrine N` reference of its own -- or a written reason why
#: it does not.
CITED = "cited"

#: n -> (status, command, binding, note)
#:
#: SEEDED BY DERIVATION, not by recall: for every number, the citation index
#: this file already builds was split by file kind, and every citation inside a
#: RUNNABLE check was read in place to see whether it sat on an assertion or in
#: a comment. A number whose only citations are prose is not MECHANICAL however
#: often it is quoted -- doctrine 79 is cited at 336 sites and its row names the
#: one command that goes red.
REGISTRY = {
    1: (MECHANICAL, "python3 quality/test_band.py", CITED,
        "the band's coordinates are read off the Declaration rather than "
        "chosen at the call site; a coordinate that silently picks a value is "
        "the defect"),
    2: (MECHANICAL, "python3 quality/test_mandate_language.py", CITED,
        "a declared return builds a COVER; the letter-scheme projection cannot "
        "state the question, so the graph stays the primary object"),
    3: (MECHANICAL, "python3 quality/test_declared_inputs.py", CITED,
        "REPEAT / RIME_RICHE / ASSONANCE / CONSONANCE stay separate types and "
        "the band inverts by declared context rather than by a global switch"),
    4: (MECHANICAL, "python3 quality/test_fit.py", CITED,
        "isochrony is an ASSUMED coordinate and the finding says so; the layer "
        "is not permitted to report it as a measurement"),
    5: (MECHANICAL, "python3 quality/test_matrix.py", CITED,
        "Declaration.fitted stays False and the shipped weights stay hand-set"),
    6: (MECHANICAL, "python3 quality/test_floor.py", CITED,
        "the floor emits a vector of findings and never a weighted score"),
    7: (MECHANICAL, "python3 quality/test_phrase_commonplace.py", CITED,
        "a forced finding is a NOTE and never a flag -- a floor may not order "
        "the permitted region"),
    8: (PROSE, None, None,
        "an experimental-design rule that binds before a fit is designed. "
        "Nothing in the repo can see that a fit was run on one tradition; the "
        "cross-tradition arm is a choice made at the point of designing the "
        "run, and there is no artifact left behind by its absence."),
    9: (MECHANICAL, "python3 quality/test_revise.py", CITED,
        "modal_exclusion: the brief marks the most frequent band-passing "
        "candidates FORBIDDEN and verify() rejects a revision that lands on "
        "one. ~15 min -- not a per-PR gate."),
    10: (ASSERTED, None, None,
         "the numbers (1/8 hits per experiment, Exp 1 at 0.604 with n=15) are "
         "recorded in quality/RESULTS.md and quality/discriminate.py is the "
         "instrument that produced them, so the claim is re-derivable on "
         "demand. Nothing re-derives it on a schedule and no command goes red "
         "if a later session builds on the features anyway."),
    11: (MECHANICAL, "python3 quality/test_floor.py", CITED,
         "anaphora's author-level Spearman against birth year -- the "
         "period-reading test the two caught features failed"),
    12: (PROSE, None, None,
         "'Stop rescuing it' binds on whoever proposes the next "
         "operationalization. Both recorded operationalizations were run once "
         "and returned null; there is no standing instrument, and the number "
         "has zero citation sites anywhere outside the two doctrine files."),
    13: (MECHANICAL, "python3 quality/test_floor.py", CITED,
         "a resource used to score a cell is checked for independence from "
         "that cell's own label"),
    14: (MECHANICAL, "python3 quality/test_time_layer.py", CITED,
         "a control defined in terms of the quantity it controls is rejected "
         "rather than reported"),
    15: (MECHANICAL, "python3 quality/test_floor.py", CITED,
         "every length-sensitive threshold carries the length it was measured "
         "at, and text outside every profile gets no length-sensitive finding"),
    16: (MECHANICAL, "python3 quality/test_grid.py", CITED,
         "an uncalibrated threshold names what it CANNOT separate in its own "
         "finding instead of deciding"),
    17: (MECHANICAL, "python3 quality/test_grid.py", CITED,
         "a check kept after its premise was falsified says so in every "
         "finding it emits"),
    18: (MECHANICAL, "python3 quality/test_phon_fas.py", CITED,
         "a shared tail ONCE is not a refrain: the radif licence needs a count "
         "AND a declared fraction, and a single pair refuses"),
    19: (MECHANICAL, "python3 quality/test_fit.py", CITED,
         "the sweep's maximizing ordering is withheld where the cycle has not "
         "declared which ordering it means"),
    20: (MECHANICAL, "python3 quality/test_mandate_language.py", CITED,
         "the refusal paths: a refusal is its own outcome and none of them "
         "degrade into a null"),
    21: (MECHANICAL, "python3 quality/test_band.py",
         "test_band.py section 2 pins sun/much -- this doctrine's own case -- "
         "as ASSONANCE, which is the conjunctive band rule firing rather than "
         "the comparator's floor. The file does not carry the doctrine number.",
         "removing the floor did not remove the compensation; the band rule is "
         "what closes sun/much, and this is where that is visible"),
    22: (MECHANICAL, "python3 quality/test_floor.py", CITED,
         "a threshold is stated as a false-positive rate against a named "
         "population, never as a point on a scale"),
    23: (PROSE, None, None,
         "the rule is 'when you remove one unconditional gift, look for the "
         "one you just handed out'. The fitted matrix that motivated it is not "
         "shipped -- Declaration.fitted is False, which doctrine 5's check "
         "pins -- so there is no live artifact to gate, and the number has "
         "zero citation sites outside the two doctrine files."),
    24: (MECHANICAL, "python3 quality/test_coda.py", CITED,
         "each band failure is RELABELLED into a named type and never "
         "rejected, so the vocabulary grows rather than shrinks"),
    25: (MECHANICAL, "python3 quality/test_homograph.py", CITED,
         "the registered tripwire, checked first: two ABSENT codas carry no "
         "evidence and still AGREE"),
    26: (MECHANICAL, "python3 quality/test_g2p.py", CITED,
         "U+2019 is folded wherever a word is extracted, including in the "
         "layer that reads the apostrophe as data"),
    27: (MECHANICAL, "python3 quality/test_phon_san.py", CITED,
         "a draw that fails the filter stays in the DENOMINATOR rather than "
         "being dropped out of the null"),
    28: (MECHANICAL, "python3 quality/test_g2p.py", CITED,
         "'cannot read' is a distinct value, not a low score in the same range "
         "as an answer"),
    29: (MECHANICAL, "python3 quality/test_fwer.py", CITED,
         "FWER's cut stays orders of magnitude coarser than BH's on the same "
         "item, and the test prints the amendment rather than the retired "
         "m ~ 15"),
    30: (MECHANICAL, "python3 quality/test_fwer.py", CITED,
         "a zero rate is accounted for and never just accepted: a mute layer "
         "and a controlled one are told apart"),
    31: (ASSERTED, None, None,
         "quality/positive_control.py is the instrument and "
         "quality/test_positive_control.py pins its planted-signal power and "
         "its chance-level false-positive rate, so the control's sensitivity "
         "is a command. What no command can see is the ORDERING this doctrine "
         "is about -- a null believed without running it first passes every "
         "check in the repo."),
    32: (PROSE, None, None,
         "a corpus-scoping rule. data/sources.tsv records what was admitted "
         "and why, but no command can see that a corpus was chosen by genre or "
         "by language rather than by the property under test."),
    33: (ASSERTED, None, None,
         "quality/time_layer.py carries both corrections and "
         "quality/audit_time_pooled_null.py prints the pooled Fisher arm "
         "beside the per-item BH one, so the distinction is visible on every "
         "run. Nothing exits non-zero if a future arm reports a BH result as "
         "though it had answered the aggregate question."),
    34: (MECHANICAL, "python3 quality/test_corpus_audit.py", CITED,
         "the live assertion: every corpus file reaches a row in "
         "data/sources.tsv, and a file with no row IS the defect"),
    35: (MECHANICAL, "python3 quality/test_fit.py", CITED,
         "a module that cannot supply a stress grid raises rather than "
         "returning a plausible-looking one"),
    36: (MECHANICAL, "python3 quality/test_declared_inputs.py", CITED,
         "流/樓: the granularity the rime book records is not the granularity "
         "the form works at, and the 同用 grouping is what answers"),
    37: (MECHANICAL, "python3 quality/test_coda.py", CITED,
         "the phonology is tested against attested lines of its own tradition "
         "rather than against its own rules"),
    38: (ASSERTED, None, None,
         "quality/som_channel_audit.py is the instrument and prints the bind "
         "-- a 1972 script against a 1931 cutoff -- and quality/provenance.py "
         "keys admission on the AUTHOR with no edition layer, which is this "
         "doctrine's own recorded gap. Nothing exits non-zero when a row is "
         "staged on an author date alone."),
    39: (PROSE, None, None,
         "'record the search as a row' binds at the moment a search fails. "
         "data/sources.tsv holds the rows that were written, and "
         "quality/audit_corpus.py checks rows against files -- but no command "
         "can see a search that was run and never written down."),
    40: (PROSE, None, None,
         "a reading rule for a licence document: the outer layer covers the "
         "collection, the inner layer the work. Which is which is recorded per "
         "row in data/sources.tsv; nothing derives it, and nothing fails when "
         "a row conflates the two."),
    41: (MECHANICAL, "python3 quality/test_phonology.py", CITED,
         "a control that passes for the wrong reason is caught by a second, "
         "same-positions-no-signal arm"),
    42: (NA, None, None,
         "a recorded result rather than a rule: two cross-family replications "
         "came back negative (Fisher p 0.950 on the sonnets, 0.883 on Tang "
         "regulated verse). There is nothing a later session can violate; the "
         "standing record is quality/RESULTS_FWER.md."),
    43: (MECHANICAL, "python3 quality/test_relations.py", CITED,
         "a rule implemented on a foreign phonology reports rule_shape rather "
         "than in_tradition, and the output is what says which"),
    44: (MECHANICAL, "python3 quality/test_relations.py", CITED,
         "every gap entry's blocker is one of the three named kinds, so 'hard "
         "to build' and 'cannot obtain' cannot be conflated"),
    45: (MECHANICAL, "python3 quality/test_ltc.py", CITED,
         "the rhyme standard is a declared coordinate and an undeclared value "
         "refuses instead of picking one"),
    46: (MECHANICAL, "python3 quality/test_msa_fin.py", CITED,
         "the function-word list is a declared part of the phonology, not an "
         "optimisation bolted on afterwards"),
    47: (MECHANICAL, "python3 quality/test_revise.py", CITED,
         "the four rejections on 41 real lines: verify() diffs the whole "
         "finding set, not the flagged line. ~15 min -- not a per-PR gate."),
    48: (MECHANICAL, "python3 quality/verify_doctrines.py", CITED,
         "this registry. Every doctrine carries a check or a declared "
         "PROSE / N-A marker with a reason, and one that carries neither fails "
         "the run -- which is the doctrine applied to itself"),
    49: (PROSE, None, None,
         "'re-test the channel map before believing a NOT-FOUND row' binds "
         "when a row is read. The overturned rows carry their re-test dates in "
         "data/sources.tsv, but no command can see a NOT-FOUND row that was "
         "trusted without re-testing."),
    50: (MECHANICAL, "python3 quality/test_declared_inputs.py", CITED,
         "a modernised edition is refused outright rather than admitted and "
         "then silently measured"),
    51: (MECHANICAL, "python3 quality/test_corpus_audit.py", CITED,
         "the byte-identical cltk pair, planted and live: corroboration is "
         "counted in distinct BYTES, never in distinct URLs"),
    52: (MECHANICAL, "python3 quality/test_corpus_audit.py", CITED,
         "the Háttatal consonant wipe: the specific channel under test is "
         "checked, not the general legibility"),
    53: (MECHANICAL, "python3 quality/test_phon_non.py", CITED,
         "the ǫ/ø -> ö merger is admissible per RELATION -- refused for one "
         "predicate and definite for the other"),
    54: (MECHANICAL, "python3 quality/audit_corpus.py --verify-shape", CITED,
         "check B's licence-scope findings sit inside the pinned "
         "FAIL/WARN/NOTE shape, so a licence name arriving without a scope "
         "moves the counts and the run goes red"),
    55: (MECHANICAL, "python3 quality/test_relations.py", CITED,
         "all three printed caesura marks are expressible, and a printed mark "
         "is never inferred from ordinary editorial punctuation"),
    56: (MECHANICAL, "python3 quality/test_relations.py", CITED,
         "Span.search_k counts the hypotheses a placement search makes, so a "
         "searched rate is reported against a null under the same search"),
    57: (MECHANICAL, "python3 quality/test_relations.py", CITED,
         "an empirical p is reported beside its own resolution and the gap to "
         "the null's max"),
    58: (MECHANICAL, "python3 quality/counters.py --check", CITED,
         "every committed counter in BACKLOG.md is checked against the command "
         "that measures it, so a bare n-of-N cannot drift from its setting"),
    59: (MECHANICAL, "python3 quality/test_phon_fas.py",
         "test_phon_fas.py section 13 pins that the refusal is on SCRIPT and "
         "not on language, and pins its declared limit -- Arabic in Arabic "
         "script is NOT refused. The file does not carry the doctrine number.",
         "the refusal is declared and its cost is paid in the open rather than "
         "patched with an uncalibrated language detector"),
    60: (MECHANICAL, "python3 quality/test_homograph.py", CITED,
         "two identical absences cannot be said to DIFFER: the refusal is "
         "derived from what the relation needs"),
    61: (MECHANICAL, "python3 quality/test_ltc.py", CITED,
         "a rule variant is chosen by lift over a matched control, never by "
         "how often it fires"),
    62: (MECHANICAL, "python3 quality/test_relations.py", CITED,
         "the tradition's own statement of its rules is read as a spec, and "
         "the checker is pinned against it"),
    63: (MECHANICAL, "python3 quality/test_relations.py", CITED,
         "every null in the registry states what it PRESERVES and what it "
         "DESTROYS, and the identity-map case is measured rather than argued"),
    64: (MECHANICAL, "python3 quality/test_msa_fin.py", CITED,
         "the excess over the matched null is the finding; the raw rate alone "
         "is not"),
    65: (MECHANICAL, "python3 quality/test_msa_fin.py", CITED,
         "the apostrophe's rule is derived per language -- five positions, "
         "none of them portable between modules"),
    66: (MECHANICAL, "python3 quality/test_null_shapes.py", CITED,
         "the constructor runs in two SUBPROCESSES under different "
         "PYTHONHASHSEED, which is the only place a set-iteration tie-break is "
         "visible at all"),
    67: (ASSERTED, None, None,
         "quality/hafez_rate.py measures the None-rate on real pairs and on "
         "matched random pairs -- exactly the comparison this doctrine demands "
         "-- and prints both. Nothing exits non-zero if a later refusal rate "
         "is quoted as a flat tax again."),
    68: (MECHANICAL, "python3 quality/test_null_shapes.py", CITED,
         "the derivation is not the authority: a null derived to be degenerate "
         "is still RUN, and the fraction of differing replicates is measured"),
    69: (PROSE, None, None,
         "'name what each null is a null ABOUT, then check it empirically' "
         "binds while a null is being designed. One citation site in the whole "
         "repository and no instrument: the Persian instance it records is "
         "closed, and nothing detects the next one."),
    70: (MECHANICAL, "python3 quality/test_corpus_audit.py", CITED,
         "the doctrine's own figure re-measured on the staged file, with the "
         "tokenisation that produced it named"),
    71: (MECHANICAL, "python3 quality/test_ltc.py", CITED,
         "a filter that moves the observation and the null together has not "
         "tightened anything, and the arm says so on its own numbers"),
    72: (MECHANICAL, "python3 quality/test_fwer.py", CITED,
         "the alpha claim is measured at n=20 with a tolerance set from the "
         "CLAIM, at a width where the 2x miss this doctrine recorded FAILS"),
    73: (ASSERTED, None, None,
         "quality/song_profile_calibration.py's --seeds and the seed arguments "
         "in quality/floor.py make the seed a declared coordinate and the "
         "multi-seed distribution reachable. Nothing fails when a verdict is "
         "read off a single seed anyway."),
    74: (MECHANICAL, "python3 quality/audit_time_pooled_null.py --check",
         CITED,
         "the per-item p under H0 is measured for uniformity before a pooled "
         "Fisher p is quoted from it, and the check fails in the direction the "
         "record actually rests on"),
    75: (MECHANICAL, "python3 quality/test_relations.py", CITED,
         "the null is chosen per PREDICATE, and the derivation says so before "
         "the measurement does"),
    76: (MECHANICAL, "python3 quality/test_null_shapes.py", CITED,
         "the detection floor has to MOVE: a null ships with the sensitivity "
         "arm that shows the instrument could have found something"),
    77: (PROSE, None, None,
         "an orchestration rule for whoever writes a parallel round's briefs. "
         "It binds outside this repository's runtime -- there is no scratch "
         "tree here to inspect, and no command can see a brief that failed to "
         "namespace one."),
    78: (PROSE, None, None,
         "the same round-level rule as doctrine 77: one shared channel-map "
         "file, updated as the round runs. Nothing in this repository is that "
         "file, and nothing can detect six cells re-probing one blocked host."),
    79: (MECHANICAL, "python3 quality/audit_spans.py --check", CITED,
         "refused, judged and mandated stay three counts: the sweep REFUSES "
         "the rows whose number is a different quantity rather than charging "
         "them to the comparator"),
    80: (MECHANICAL, "python3 quality/audit_register.py",
         "audit_register's `_d_noneng_table` derivation re-counts the "
         "non-English lyricist rows and MOVES when any is SOURCED rather than "
         "PENDING_TEXT, which is this doctrine's own enforcement clause. The "
         "file does not carry the doctrine number.",
         "a staged row says PENDING_TEXT, never SOURCED, because the binding "
         "constraint is the edition and the author gate is the cheap one"),
    81: (MECHANICAL, "python3 quality/audit_register.py",
         "audit_register's `_d_century_only` derivation re-counts the rows "
         "whose pd_route records a century-only upper bound and MOVES when the "
         "count changes. The file does not carry the doctrine number.",
         "a vague life is bounded at the END of its window and the row says in "
         "its own pd_route that it was"),
    82: (MECHANICAL, "python3 quality/test_phonology.py",
         "test_phonology.py pins `an extent must be declared, never defaulted` "
         "and pins that the three spans differ on an unaccented end -- the "
         "defect this doctrine records. It does not carry the doctrine "
         "number.",
         "the span is a property of the diweddeb, so `extent` has no default "
         "and an absent argument raises"),
    83: (MECHANICAL, "python3 quality/test_taxonomy.py", CITED,
         "the anchor is per MEMBER: kukka/kalevala is the standing "
         "demonstration and consult=False keeps it reachable"),
    84: (MECHANICAL, "python3 quality/test_align.py", CITED,
         "the declared relation answers and the channel path stays REACHABLE, "
         "so the defect it names stays demonstrable"),
    85: (MECHANICAL, "python3 quality/test_declared_inputs.py", CITED,
         "an express non-commercial grant is a rejection in every language, "
         "checked on the grant's own string"),
    86: (NA, None, None,
         "a recorded POSITIVE instance of doctrine 50 rather than a rule of "
         "its own: a 20th-century editor's punctuation supplies the constraint "
         "(45.2% agreement at 。-ends against 2.7% at ，). The rule it revises "
         "-- name the layer and measure what it does to the channel under test "
         "-- is doctrine 50's, and 50 carries the check. Zero citation sites "
         "outside the two doctrine files."),
    87: (NA, None, None,
         "a recorded NEGATIVE instance of doctrine 51 rather than a rule of "
         "its own: two 花間集 witnesses share only 91 of 369 poems and each "
         "corrected the other. The rule -- count distinct bytes -- is doctrine "
         "51's, and 51 carries the check."),
    88: (MECHANICAL, "python3 quality/test_cym.py", CITED,
         "an ingestion refusal and a correct refusal are counted separately "
         "rather than pooled into one unreadable rate"),
    89: (MECHANICAL, "python3 quality/test_corpus_audit.py", CITED,
         "the near-duplication population is reported as a SERIES across cuts, "
         "so one count at one cut cannot stand in for the population"),
    90: (MECHANICAL, "python3 quality/relations_null.py --verify", CITED,
         "the ledger pins each schema's verdict against its derived (statistic, "
         "null) PAIR, so a null carried onto a statistic it says nothing about "
         "moves the ledger and the run goes red"),
    91: (MECHANICAL, "python3 quality/test_relations.py", CITED,
         "a count is reported with the rendering that produced it, and two "
         "denominators are never made into a ratio"),
    92: (MECHANICAL, "python3 quality/test_phrase_commonplace.py", CITED,
         "the blocker is DECLARED and names which of the three kinds it is"),
    93: (PROSE, None, None,
         "'the TEXT has to carry a mark of it' binds while a corpus is staged. "
         "The detector's floor is printed beside the zero in "
         "quality/POSITIVE_CONTROL.md, but no command can see a text staged as "
         "sung because the tradition says it was sung."),
    94: (MECHANICAL, "python3 quality/test_coda.py", CITED,
         "the false-positive direction: the cost of a tightening is priced out "
         "loud on the same run that reports its benefit"),
    95: (MECHANICAL, "python3 quality/test_align.py", CITED,
         "channel_agreement aligns flush RIGHT, pinned on the unequal-length "
         "pairs the sonnet oracle was structurally incapable of reaching"),
}

#: Anything shaped like a repo path inside a registry row has to exist. A
#: reason that names a dead file is the same defect one layer out.
PATHISH = re.compile(r"\b[A-Za-z0-9_][A-Za-z0-9_./-]*\."
                     r"(?:py|md|tsv|json|txt|yml|yaml|sh)\b")
def _nonzero_const(node):
    """Is this expression a literal non-zero exit code, or a branch on one?"""
    if isinstance(node, ast.Constant):
        return isinstance(node.value, int) and not isinstance(
            node.value, bool) and node.value != 0
    if isinstance(node, ast.IfExp):
        return _nonzero_const(node.body) or _nonzero_const(node.orelse)
    return False


def can_fail(text):
    """-> True when this module has a reachable NON-ZERO process exit.

    Regex was tried first and got this wrong in both directions, so it is an
    AST walk. `quality/audit_time_pooled_null.py` ends in
    `sys.exit(check(main(CHECK_REPS)))` where `check` ends in
    `return 0 if not bad else 1` -- no `sys.exit(1)` anywhere, and it fails
    perfectly well. Meanwhile the defect this guard exists for is the opposite
    shape: `audit_spans.py`'s `main` returned a LITERAL 0 whatever the sweep
    found, so the process exited clean while printing its own drift, and three
    more instruments in this repo shipped the same way.

    The rule: an explicit non-zero `sys.exit`/`SystemExit` argument counts on
    its own; otherwise there must be BOTH a `sys.exit` call AND some function
    that can return a non-zero code for it to carry. A module whose only exit
    code is a literal 0 fails this, which is the case worth catching.
    """
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return False
    exits, nonzero_exit, nonzero_return = False, False, False
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            f = node.func
            name = (f.attr if isinstance(f, ast.Attribute) else
                    f.id if isinstance(f, ast.Name) else "")
            if name in ("exit", "SystemExit"):
                exits = True
                if node.args and _nonzero_const(node.args[0]):
                    nonzero_exit = True
        elif isinstance(node, ast.Raise):
            e = node.exc
            if isinstance(e, ast.Name) and e.id == "SystemExit":
                exits, nonzero_exit = True, True
        elif isinstance(node, ast.Return) and node.value is not None:
            if _nonzero_const(node.value):
                nonzero_return = True
    return nonzero_exit or (exits and nonzero_return)


def walk():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in sorted(filenames):
            if fn in SKIP_FILES or not fn.endswith(TEXTY):
                continue
            yield os.path.join(dirpath, fn)


def _numbers_in(text):
    """-> set of doctrine numbers cited in `text`, same reader as references()."""
    out = set()
    for m in REF_HEAD.finditer(text):
        out.add(int(m.group(1)))
        pos = m.end()
        while True:
            t = REF_TAIL.match(text, pos)
            if not t:
                break
            out.add(int(t.group(1)))
            pos = t.end()
    return out


def references():
    """-> {number: {relpath: count}} over the whole repo."""
    out = {}
    for path in walk():
        try:
            text = open(path, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        rel = os.path.relpath(path, ROOT)
        for m in REF_HEAD.finditer(text):
            nums = [int(m.group(1))]
            pos = m.end()
            while True:
                t = REF_TAIL.match(text, pos)
                if not t:
                    break
                nums.append(int(t.group(1)))
                pos = t.end()
            for n in nums:
                out.setdefault(n, {}).setdefault(rel, 0)
                out[n][rel] += 1
    return out


def definitions():
    """-> {number: [relpath, ...]} across the two doctrine files."""
    out = {}
    for rel in ("CLAUDE.md", "quality/METHOD.md"):
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            continue
        text = open(path, encoding="utf-8").read()
        # Only the delimited doctrine runs define numbers.  The `Known gaps`
        # list (cited elsewhere as `known gap N`) uses the same markdown
        # shape and must stay out of the count, so definitions are read ONLY
        # from between the DOCTRINE-BLOCK markers.
        runs = re.findall(r"<!-- DOCTRINE-BLOCK -->(.*?)<!-- /DOCTRINE-BLOCK -->",
                          text, re.S)
        assert runs, f"{rel} carries no <!-- DOCTRINE-BLOCK --> markers"
        for run in runs:
            for m in DEF.finditer(run):
                out.setdefault(int(m.group(1)), []).append(rel)
    return out


def gap_check():
    """`known gap N` must still resolve against CLAUDE.md's own list."""
    claude = open(os.path.join(ROOT, "CLAUDE.md"), encoding="utf-8").read()
    body = claude.split("## Known gaps, priority order")[1].split("\n## ")[0]
    defined = {int(m.group(1)) for m in DEF.finditer(body)}
    cited = set()
    for path in walk():
        try:
            t = open(path, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        cited |= {int(n) for n in re.findall(r"known gaps?[ ]+(\d+)", t, re.I)}
    return defined, cited


# ── the pre-split baseline ────────────────────────────────────────────────
#
# DERIVED FROM HISTORY, NEVER FROM THE WORKING TREE. `--baseline` used to
# write `sorted(defs)`, so running it made the check it feeds compare the tree
# against itself. The only tree that can answer "was anything defined before
# the split lost?" is the tree before the split.

def presplit_from_git():
    """-> sorted list of numbers, or None when the history is not reachable.

    `actions/checkout` is shallow by default, so in CI this returns None and
    the caller REFUSES to re-derive rather than inventing a baseline.
    """
    try:
        text = subprocess.run(
            ["git", "show", f"{PRESPLIT_COMMIT}:{PRESPLIT_PATH}"],
            cwd=ROOT, capture_output=True, text=True, timeout=30).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    if not text.strip():
        return None
    heads = [(m.start(), m.group(0).strip())
             for m in re.finditer(r"^## .*$", text, re.M)] + [(len(text), "")]
    nums = set()
    for i in range(len(heads) - 1):
        if heads[i][1] == PRESPLIT_EXCLUDE:
            continue
        nums |= {int(m.group(1))
                 for m in DEF.finditer(text[heads[i][0]:heads[i + 1][0]])}
    return sorted(nums)


def write_baseline():
    """-> exit code. REFUSES rather than writing a baseline it cannot derive."""
    nums = presplit_from_git()
    if nums is None:
        print("REFUSED — cannot read "
              f"{PRESPLIT_COMMIT[:7]}:{PRESPLIT_PATH}. The pre-split baseline "
              "is derived from history, never from the working tree; a shallow "
              "clone cannot produce it. Fetch the full history and re-run.")
        return 2
    obj = {
        "schema": "doctrine-baseline/1",
        "derived_from": {
            "commit": PRESPLIT_COMMIT,
            "commit_subject": "CHECKPOINT: cell K's Syllable change, in "
                              "progress and not yet reported",
            "commit_date": "2026-08-11",
            "path": "lyric-harness/CLAUDE.md",
            "why": "the commit immediately before d11ca0a, 'Split the doctrine "
                   "file: 20 for writing, 75 for method, numbering intact' -- "
                   "the last tree in which every doctrine was defined in one "
                   "file",
            "method": "^(\\d+)\\. \\*\\* over each '## ' section of that file, "
                      "EXCLUDING '" + PRESPLIT_EXCLUDE + "', which uses the "
                      "same markdown shape for a different numbering (cited as "
                      "`known gap N`). The <!-- DOCTRINE-BLOCK --> markers did "
                      "not exist yet, so the section boundary is what "
                      "separates them.",
            "sections_read": ["## Core doctrine (do not drift from these)",
                              "## Quality layer (quality/)"],
        },
        "count": len(nums),
        "defined": nums,
    }
    with open(BASELINE, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=1)
        fh.write("\n")
    print(f"baseline written: {len(nums)} numbers -> {BASELINE}")
    print(f"  derived from {PRESPLIT_COMMIT[:7]}:{PRESPLIT_PATH}")
    return 0


def load_baseline():
    """-> (numbers, error). `error` is a printable REFUSAL, never a skip."""
    if not os.path.exists(BASELINE):
        return None, (f"{os.path.relpath(BASELINE, ROOT)} is not on disk. "
                      "Check (3) cannot run, and a check that cannot run is "
                      "not a check that passed (doctrine 20/28). Re-derive it "
                      "with `python3 quality/verify_doctrines.py --baseline`.")
    try:
        obj = json.load(open(BASELINE, encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return None, f"{os.path.relpath(BASELINE, ROOT)} does not parse: {exc}"
    if not isinstance(obj, dict) or obj.get("schema") != "doctrine-baseline/1":
        return None, (f"{os.path.relpath(BASELINE, ROOT)} is not a "
                      "doctrine-baseline/1 object. The bare list this file "
                      "used to write carried no provenance and no way to tell "
                      "a derived baseline from a self-fulfilling one.")
    nums = obj.get("defined")
    if (not isinstance(nums, list) or not nums
            or not all(isinstance(n, int) for n in nums)
            or sorted(set(nums)) != nums):
        return None, ("`defined` must be a sorted list of distinct integers; "
                      f"got {type(nums).__name__}")
    if obj.get("count") != len(nums):
        return None, (f"`count` says {obj.get('count')} and `defined` holds "
                      f"{len(nums)}. The file disagrees with itself.")
    if obj.get("derived_from", {}).get("commit") != PRESPLIT_COMMIT:
        return None, ("`derived_from.commit` is "
                      f"{obj.get('derived_from', {}).get('commit')!r}, this "
                      f"file expects {PRESPLIT_COMMIT!r}. One of the two moved "
                      "without the other.")
    return nums, None


# ── the registry ──────────────────────────────────────────────────────────

def _flags(cmd):
    out = []
    for tok in cmd.split():
        if tok.startswith("--"):
            out.append(tok.split("=", 1)[0])
    return out


def _script(cmd):
    for tok in cmd.split()[1:]:
        if tok.endswith(".py"):
            return tok
    return None


def registry_check(defs):
    """-> (problems, counts). Every row is re-verified, none is trusted."""
    problems = []
    counts = {s: 0 for s in STATUSES}
    src_cache = {}

    def source(rel):
        if rel not in src_cache:
            path = os.path.join(ROOT, rel)
            try:
                src_cache[rel] = open(path, encoding="utf-8",
                                      errors="replace").read()
            except OSError:
                src_cache[rel] = None
        return src_cache[rel]

    for n in sorted(set(defs) | set(REGISTRY)):
        if n not in REGISTRY:
            problems.append(f"doctrine {n} is DEFINED and has no registry row. "
                            f"Give it a check, or mark it PROSE / N-A with a "
                            f"reason.")
            continue
        if n not in defs:
            problems.append(f"doctrine {n} has a registry row and is defined "
                            f"nowhere.")
            continue
        status, cmd, binding, note = REGISTRY[n]
        if status not in STATUSES:
            problems.append(f"doctrine {n}: status {status!r} is not one of "
                            f"{STATUSES}")
            continue
        counts[status] += 1
        if not note or len(note) < 20:
            problems.append(f"doctrine {n}: the row carries no reason.")
        for tok in PATHISH.findall(f"{cmd or ''} {binding or ''} {note or ''}"):
            if not os.path.exists(os.path.join(ROOT, tok)):
                problems.append(f"doctrine {n}: row names {tok}, which does "
                                f"not exist.")
        if status != MECHANICAL:
            if cmd or binding:
                problems.append(f"doctrine {n}: a {status} row may not carry a "
                                f"command or a binding.")
            continue
        if not cmd:
            problems.append(f"doctrine {n}: MECHANICAL with no command.")
            continue
        rel = _script(cmd)
        if not rel:
            problems.append(f"doctrine {n}: `{cmd}` names no .py script.")
            continue
        text = source(rel)
        if text is None:
            problems.append(f"doctrine {n}: `{cmd}` -> {rel} does not exist.")
            continue
        for flag in _flags(cmd):
            if flag not in text:
                problems.append(f"doctrine {n}: `{cmd}` passes {flag}, which "
                                f"{rel} never mentions.")
        if "__main__" not in text:
            problems.append(f"doctrine {n}: {rel} has no __main__, so `{cmd}` "
                            f"runs nothing.")
        if not CAN_FAIL.search(text):
            problems.append(f"doctrine {n}: {rel} has no non-zero exit path, "
                            f"so `{cmd}` cannot fail. A check that cannot fail "
                            f"is decoration.")
        if binding == CITED:
            if n not in _numbers_in(text):
                problems.append(f"doctrine {n}: the row claims {rel} cites it, "
                                f"and {rel} does not. Either the citation was "
                                f"removed or the binding is wrong.")
        elif not binding or len(binding) < 20:
            problems.append(f"doctrine {n}: MECHANICAL rows are either "
                            f"{CITED!r} -- and then the script must carry the "
                            f"citation -- or they say why not. This one says "
                            f"neither.")
    return problems, counts


def main():
    if "--baseline" in sys.argv:
        return write_baseline()

    refs = references()
    defs = definitions()

    print("=" * 74)
    print("DOCTRINE CROSS-REFERENCE VERIFICATION")
    print("=" * 74)

    per_file = {}
    for n, homes in defs.items():
        for h in homes:
            per_file.setdefault(h, []).append(n)
    for f in sorted(per_file):
        ns = sorted(per_file[f])
        print(f"  defined in {f:22s} {len(ns):3d}  {_ranges(ns)}")
    print(f"  {'TOTAL DEFINED':33s} {len(defs):3d}")

    ok = True
    refused = 0

    dup = {n: h for n, h in defs.items() if len(h) > 1}
    print()
    print(f"[{'ok  ' if not dup else 'FAIL'}] no number is defined twice")
    for n, h in sorted(dup.items()):
        ok = False
        print(f"         doctrine {n} defined in {h}")

    n_ref_sites = sum(sum(v.values()) for v in refs.values())
    unresolved = {n: v for n, v in refs.items() if n not in defs}
    print(f"[{'ok  ' if not unresolved else 'FAIL'}] every referenced number "
          f"resolves  ({n_ref_sites} reference sites, "
          f"{len(refs)} distinct numbers)")
    for n, where in sorted(unresolved.items()):
        ok = False
        tot = sum(where.values())
        print(f"         doctrine {n}: {tot} references, no definition "
              f"({', '.join(sorted(where)[:3])})")

    # UNTIL 2026-08-13 THIS PRINTED `[skip]` AND LEFT THE EXIT CODE AT 0, so
    # the third of the three things this file's own docstring promises never
    # ran and never said it had not run. That is the collapse doctrine 20/28
    # names, committed by the file that checks the doctrine numbering.
    base, err = load_baseline()
    if err is not None:
        ok = False
        print("[FAIL] nothing defined before the split has been lost")
        print(f"         REFUSED — {err}")
    else:
        lost = set(base) - set(defs)
        gained = set(defs) - set(base)
        print(f"[{'ok  ' if not lost else 'FAIL'}] nothing defined before the "
              f"split has been lost  (baseline {len(base)}, from "
              f"{PRESPLIT_COMMIT[:7]})")
        for n in sorted(lost):
            ok = False
            print(f"         doctrine {n} LOST")
        if gained:
            print(f"         (new since the split: {sorted(gained)})")
        # THE BASELINE'S OWN PROVENANCE, re-derived when the history is
        # reachable. This is a REFUSAL when it is not, never a pass: a shallow
        # CI clone cannot answer it, and the primary check above does not
        # depend on the answer.
        fresh = presplit_from_git()
        if fresh is None:
            refused += 1
            print("[refu] the baseline's own derivation could not be re-run "
                  "(history not reachable — a shallow clone). The check above "
                  "still ran; this line is the corroboration, not the check.")
        elif fresh != base:
            ok = False
            print("[FAIL] the baseline file disagrees with a fresh derivation "
                  f"from {PRESPLIT_COMMIT[:7]}")
            print(f"         on disk {len(base)}, derived {len(fresh)}; "
                  f"only in file {sorted(set(base) - set(fresh))}, "
                  f"only derived {sorted(set(fresh) - set(base))}")
        else:
            print(f"[ok  ] ...and the baseline re-derives from "
                  f"{PRESPLIT_COMMIT[:7]} exactly ({len(fresh)} numbers)")

    gaps = [n for n in range(1, max(defs) + 1) if n not in defs] if defs else []
    print(f"[{'ok  ' if not gaps else 'FAIL'}] the definition set is a "
          f"contiguous run 1..{max(defs) if defs else 0}")
    for n in gaps:
        print(f"         doctrine {n} missing from the run")
    # A GAP IS A FAILURE, not a warning. Until 2026-08-13 this printed WARN and
    # left `ok` alone, so a deleted or renumbered doctrine exited 0 -- while
    # CLAUDE.md's own statement of the invariant reads "that set must be
    # exactly 1-95, with no number in both", and the whole point of the
    # numbering is that `doctrine 79` resolves from any of ~3,266 citation
    # sites. Found while adding the CI job that runs this: an injected
    # out-of-range doctrine printed WARN and the process still exited 0, so
    # the step would have been green on exactly the breakage it is named for.
    # A check that cannot fail is decoration (doctrine 48).
    if gaps:
        ok = False

    gdef, gcited = gap_check()
    missing_gaps = gcited - gdef
    print(f"[{'ok  ' if not missing_gaps else 'FAIL'}] every `known gap N` "
          f"resolves against CLAUDE.md's own 1-{max(gdef)} list  "
          f"(cited: {sorted(gcited)})")
    for n in sorted(missing_gaps):
        ok = False
        print(f"         known gap {n} cited, not defined")

    problems, counts = registry_check(defs)
    print(f"[{'ok  ' if not problems else 'FAIL'}] every doctrine carries a "
          f"registry row that names a real check or a declared refusal")
    for p in problems:
        ok = False
        print(f"         {p}")

    uncited = sorted(set(defs) - set(refs))
    print(f"[note] {len(uncited)} doctrines are cited nowhere but this file "
          f"pair: {uncited}")

    print()
    print("THE DOCTRINE -> CHECK REGISTRY")
    print(f"  ASKED           {len(defs):3d}")
    for s in STATUSES:
        print(f"  {s:15s} {counts[s]:3d}")
    ungated = sorted(n for n in defs
                     if REGISTRY.get(n, (None,))[0] != MECHANICAL)
    print(f"  the {len(ungated)} without a command, by number: {ungated}")
    cmds = sorted({REGISTRY[n][1] for n in defs
                   if REGISTRY.get(n, (None,))[0] == MECHANICAL})
    print(f"  {len(cmds)} distinct commands stand behind the "
          f"{counts[MECHANICAL]} mechanical rows")

    print()
    print("MOST-CITED DOCTRINES (reference sites across the whole repo)")
    top = sorted(refs.items(), key=lambda kv: -sum(kv[1].values()))[:12]
    for n, where in top:
        home = defs.get(n, ["UNDEFINED"])[0]
        print(f"  doctrine {n:<3d} {sum(where.values()):4d} sites  "
              f"in {len(where):2d} files   home: {home}")

    print()
    if refused:
        print(f"REFUSED (counted, not passed): {refused}")
    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


def _ranges(ns):
    out, i = [], 0
    while i < len(ns):
        j = i
        while j + 1 < len(ns) and ns[j + 1] == ns[j] + 1:
            j += 1
        out.append(str(ns[i]) if i == j else f"{ns[i]}-{ns[j]}")
        i = j + 1
    return ", ".join(out)


if __name__ == "__main__":
    sys.exit(main())

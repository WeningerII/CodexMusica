#!/usr/bin/env python3
"""THE PROCESS BESIDE THE PRODUCT — what the verbs said while a song was written.

    python3 quality/song_log.py --record SONG -- CMD...   # run a verb, bank what it emitted
    python3 quality/song_log.py --show SONG               # render one song's log
    python3 quality/song_log.py --verdicts                # README process claims vs the logs
    python3 quality/song_log.py --drafts                  # every banked md5 vs the bytes behind it
    python3 quality/song_log.py --bank-draft SONG MD5 FILE  # bank bytes a log already names (M-196)

WHY THIS EXISTS, AND WHY IT IS NOT `RESULTS.tsv`
------------------------------------------------
`quality/song_record.py` banks what a song IS: ten features over the committed
bytes, re-derivable forever. It says nothing about how the song got there —
which pairs were screened and refused, which seed the sweep accepted, what the
grader said on the first pass, how many rounds the loop took. That history was
living in `songs/README.md` as PROSE, written from a session's memory, and a
sentence nobody can check is a story (standing rule 3: an improvised step used
twice is a defect report, not a convenience).

WHAT IS RECORDED: WHAT A VERB PRINTED. NOTHING ELSE.
----------------------------------------------------
`--record` RUNS the command, keeps its exit code, and parses its stdout with a
parser DECLARED for that verb. A verb with no declared parser REFUSES at exit 2
rather than banking a row with no facts in it — an invocation whose output
nothing read looks exactly like an invocation that went well (doctrine 20).

So this file cannot record an intention, a plan, a reason or a regret. It
records emitted text. Everything a session BELIEVES about a song stays in the
README, where `--verdicts` can charge it against these rows.

AND SINCE 2026-09-02 IT ALSO RECORDS THE INVOCATION — WHICH IS NOT A BELIEF
---------------------------------------------------------------------------
`MISSING.md` M-196's addendum, and M-168's "THE BAN AGAINST THE BANK", name the
same hole from two sides: the verb that GRADES a draft banked an md5 of what it
graded and not the bytes, and banked no spelling of the mandate it graded them
under. So `ban_convergence.py` could prove that crooked_waltz step 19 graded
`29697fccfe8d` and could not read one word of it, and two of sixteen songs'
graded mandates were unrecoverable outright.

The rule above is unchanged for OUTPUT facts and is now stated with its true
boundary: this file banks facts about the INVOCATION as well as facts about the
output, and they are different species kept apart by name. The log has always
banked one invocation fact — `exit`, which is not emitted text either — and the
argv is exactly as verifiable as an exit code: it is what was RUN, not what a
session thinks it meant. The invocation facts are:

  command                 the argv, shell-quoted — the whole truth, so a
                          coordinate a future verb grows is on record without
                          this file learning its name
  mandate_groups_text     `--groups=` VERBATIM, and the other declared mandate
  mandate_returns_text    spellings beside it (`--relations=`, `--structures=`,
  ...                     `--cliques`, `--relation=`, a bare letter scheme).
                          `_text` because `song` already banks `mandate_groups`
                          as an integer COUNT and `plan` banks `groups` as the
                          PLANNED string: three quantities, three names, one
                          reader who cannot confuse them (doctrine 1).
  draft_file              the path this record wrote the graded bytes to
  draft_lines             how many lines those bytes are

THE BYTES, AND WHY THE FILE'S NAME CANNOT DISAGREE WITH THE ROW
---------------------------------------------------------------
On the grading verbs (`song`, `brief`, `revise`, `finish`) `--record` also
writes the `load_lyric_lines` text it was handed to
`songs/drafts/<song>.<md5>.draft.txt` — and the `<md5>` is the one THE VERB
ITSELF PRINTED, read back out of the parser's own facts, never re-derived for
the purpose. Before writing, the bytes are fingerprinted through the harness's
own two definitions — `lyric_harness.load_lyric_lines` for what counts as sung
text, `quality.revise.draft_fingerprint` for the identity — and a disagreement
WRITES NOTHING and says so. That is not a second md5 hoped to match: it is the
one md5, checked, with a refusal on the far side. A verb that printed no
fingerprint gets no file and a printed line saying which.

The bytes written are what was GRADED, not what was on disk: markers, the
`--- TITLE:` line and blank lines are apparatus and the grader never saw them.
Round-tripping is exact — `load_lyric_lines` of the draft file returns the same
list — so a later reader grades the same population, which is the whole point.

`songs/drafts/` AND NOT `songs/`, MEASURED. The design in the register says
`songs/<name>.<md5>.draft.txt`; `quality/test_songs.py` §1 globs `songs/*.txt`
and FAILS on any file there without a `.blueprint.json` beside it, so that
spelling turns a green population gate red. The subdirectory needs no exclusion
anywhere, and an exclusion carved into a population gate is how a lyric with no
blueprint learns to pass by being named `.draft.txt` (doctrine 58).

THEY ARE COMMITTED, AND THAT IS THE MECHANISM RATHER THAN A PREFERENCE. The
point of banking a draft is that a later reader can grade the same bytes; a
gitignored file is one machine's disk, so a clone would hold the md5 and not
the text — the exact state M-168 measured. Cost, measured 2026-09-02: 50 md5
rows over 16 songs are 20 DISTINCT md5s, because the file is keyed on CONTENT
and a step that graded bytes already banked re-uses their file — and the
sixteen committed lyrics are 13,411 bytes of graded text, so all twenty land
near 16.8 KB.

THE SHAPE IS LONG, NOT WIDE
---------------------------
One row per (invocation, fact). `screen` emits a verdict per pair and `revise`
emits a stop reason; a wide table would have to invent an empty cell for every
fact the other verb does not answer, and an empty cell reads as a measurement
that came back zero. A fact a verb does not emit has NO ROW, which is the only
spelling of "not asked" that cannot be misread as "asked and clean".

`step` is the ordinal within one song's log, so the SEQUENCE survives — the
order in which a writing session asked its questions is itself the record.

A CITATION IS KEYED ON A WORD, NEVER ON THAT ORDINAL
----------------------------------------------------
`[LOG: clean_or_non_rhyme carry_it_over.txt bell]` in `songs/README.md` names
the screen run that screened `bell`, and the value written immediately before
it must EQUAL the banked one. Keyed on the step instead, a citation would be
an offset from a moving origin — the defect this repository already found in
its own `data/sources.tsv` line-number citations, where an unrelated insertion
made a true sentence false without one character of it changing. A word
screened by two runs REFUSES as ambiguous rather than resolving to the first.

WHAT A ROW DOES NOT CLAIM
-------------------------
The commit and date stamp when the row was RECORDED, not the hour of the
original writing session — a re-recording of the same command against the same
committed bytes produces the same facts, which is the property that makes this
a log rather than a memoir. The genuinely unrepeatable half — a superseded
draft nobody committed — has no rows and cannot get any, so `--verdicts`
REFUSES those claims rather than passing them.
"""
import argparse
import datetime
import os
import re
import shlex
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SONGS = os.path.join(ROOT, "songs")
DRAFTS = os.path.join(SONGS, "drafts")
README = os.path.join(SONGS, "README.md")
sys.path.insert(0, ROOT)

HEADER = ["song", "step", "measured", "harness_commit", "verb", "exit",
          "fact", "value"]

#: THE DAY THE BYTES STARTED BEING BANKED (`MISSING.md` M-196, 2026-09-02).
#: A rule that cannot tell "banked before this mechanism existed" from "banked
#: after it and missing" is worthless, and one that passes both is worse. This
#: constant is the whole discriminator, and it is a DECLARED date rather than a
#: list of grandfathered rows: a list would have to be edited every time a row
#: joined it, and an exception list nobody maintains is a gate nobody has.
#: Every md5 row in the bank on this date was measured 2026-08-24..2026-08-30,
#: so nothing sits on the boundary. `--drafts` reports the two sides apart, and
#: is red on the second only.
DRAFT_BANKING_SINCE = "2026-09-02"

#: The verbs that GRADE a draft, and the fact each one prints its INPUT's
#: fingerprint under. `revise`/`finish` also print `md5_out` — the bytes the
#: loop EMITTED — and that is deliberately not banked here: this record holds
#: what was handed in, which is the file it can read. An emitted draft that
#: differs from its input exists only inside the loop's own report, and
#: claiming to have banked it would be the fabrication this entry is about.
#: (Every banked `revise` row in the bank has md5_in == md5_out, so today the
#: two coincide; that is a measurement about this bank, not a rule.)
DRAFT_FACT = {"song": "md5", "brief": "md5",
              "revise": "md5_in", "finish": "md5_in"}

#: The mandate spellings `lyric_harness.py:_mandate_arg` accepts, banked
#: VERBATIM off the argv. Transcribed, not parsed — `schemes.mandate` stays the
#: one reader of `3.T2` (doctrine 1), and this file stays unable to grade.
MANDATE_FLAGS = [("--groups=", "mandate_groups_text"),
                 ("--returns=", "mandate_returns_text"),
                 ("--relations=", "mandate_relations_text"),
                 ("--structures=", "mandate_structures_text"),
                 ("--relation=", "mandate_relation_text")]


def log_path(song):
    return os.path.join(SONGS, song.replace(".txt", "") + ".log.tsv")


def draft_path(song, md5):
    """-> where the bytes fingerprinted `md5` for `song` live. ONE spelling of
    the name, so the writer and every reader cannot drift apart."""
    return os.path.join(DRAFTS,
                        "%s.%s.draft.txt" % (song.replace(".txt", ""), md5))


def harness_commit():
    """One definition, borrowed rather than respelled — a second copy of the
    commit rule is how two registers start disagreeing about which tree a
    measurement was taken on (doctrine 1)."""
    from quality.song_record import harness_commit as hc
    return hc()


# ---------------------------------------------------------------- parsers
# DECLARED per verb. Each returns [(fact, value), ...] read from the verb's
# OWN printed text. A parser that finds nothing returns [] and `--record`
# refuses the row: a verb that printed something this file could not read is
# a defect report, not a silent success.

def _p_screen(out):
    """A REFUSAL IS A ROW. The first draft matched only the scored shape
    (`a ~ b  RHYME 1.000  CLEAN`), so a pair the grader could not read —
    which prints `a ~ b  REFUSED — CMUdict has no pronunciation ...` and
    carries no relation and no number — produced NO ROW while the summary
    still counted it. The family whose members are unreadable and the family
    whose members are all banned then looked identical pair by pair, which is
    doctrine 79 in the one register built to keep the two apart."""
    facts = []
    for m in re.finditer(r"^\s{2}(\S+) ~ (\S+)\s\s+(.+)$", out, re.M):
        tail = m.group(3).strip()
        scored = re.match(r"\S+\s+[\d.]+\s+(.+)$", tail)
        if scored:
            verdict = scored.group(1).strip()
        elif tail.startswith("REFUSED"):
            # Keep the CAUSE, drop the standing paragraph the verb prints
            # after it — a row records what could not be read, not the
            # sentence explaining why refusing beats guessing.
            cause = tail.split("\u2014", 1)[-1].split(";")[0].strip()
            verdict = "REFUSED — " + cause
        else:
            verdict = tail
        facts.append(("pair:%s~%s" % (m.group(1), m.group(2)), verdict))
    # M-113 split the screen's third bucket: CLEAN answered two questions
    # (a clean rhyme and a clean non-rhyme) and the verb now counts them
    # apart, so the log records them apart — two facts, never summed
    # (doctrine 79). The old one-bucket shape is kept as a fallback so a
    # pre-split transcript still parses to its own honest fact name.
    # M-189 (2026-09-01) split the clean bucket AGAIN: a pair the default
    # door ADMITS as a near relation is neither a rhyme nor a non-rhyme the
    # mandate will charge, so the tail counts it apart — three clean
    # facts now, never summed. The M-113 four-count tail and the one-bucket
    # tail stay readable for the transcripts that carry them.
    m = re.search(r"^\s*(\d+) banned, (\d+) refused, (\d+) clean and "
                  r"rhyming, (\d+) clean and ADMITTED[^,]*, (\d+) clean but "
                  r"not a rhyme", out, re.M)
    if m:
        facts += [("banned", m.group(1)), ("refused", m.group(2)),
                  ("clean_rhyming", m.group(3)),
                  ("clean_admitted", m.group(4)),
                  ("clean_non_rhyme", m.group(5))]
        return facts
    m = re.search(r"^\s*(\d+) banned, (\d+) refused, (\d+) clean and "
                  r"rhyming, (\d+) clean but not a rhyme", out, re.M)
    if m:
        facts += [("banned", m.group(1)), ("refused", m.group(2)),
                  ("clean_rhyming", m.group(3)),
                  ("clean_non_rhyme", m.group(4))]
    else:
        m = re.search(r"^\s*(\d+) banned, (\d+) refused, (\d+) clean",
                      out, re.M)
        if m:
            facts += [("banned", m.group(1)), ("refused", m.group(2)),
                      ("clean_or_non_rhyme", m.group(3))]
    return facts


def _p_plan(out):
    facts = []
    m = re.search(r"PLAN: form=(\S+) seed=(\d+) -> (\d+) line\(s\), "
                  r"(\d+) section\(s\): (\S+)", out)
    if m:
        facts += [("form", m.group(1)), ("seed", m.group(2)),
                  ("lines", m.group(3)), ("sections", m.group(4)),
                  ("pattern", m.group(5))]
    m = re.search(r"METER: (\S+) as (\([^)]*\))", out)
    if m:
        facts.append(("meter", m.group(1) + " as " + m.group(2)))
    m = re.search(r"subdivision (\d+)", out)
    if m:
        facts.append(("subdivision", m.group(1)))
    m = re.search(r"^\s*GROUPS\s*: (.+)$", out, re.M)
    if m:
        facts.append(("groups", m.group(1).strip()))
    m = re.search(r"^\s*RETURNS: (.+)$", out, re.M)
    if m:
        facts.append(("returns", m.group(1).strip()))
    return facts


def _p_sweep(out):
    facts = []
    m = re.search(r"SWEEP: seeds (\S+) \((\d+)\), form=(\S+)", out)
    if m:
        facts += [("sweep_range", m.group(1)), ("swept", m.group(2)),
                  ("form", m.group(3))]
    # ONE ROW, NOT ONE PER PREDICATE. The verb prints a WANT line per
    # predicate; banking each as its own `want` fact puts five values under
    # one name in one invocation, and every reader of the log then has to
    # pick. The declaration was `--want=a;b;c` — one coordinate — so the row
    # is the coordinate, spelled the way it was declared.
    wants = [m.group(1).strip()
             for m in re.finditer(r"^\s*WANT (.+?) — ", out, re.M)]
    if wants:
        facts.append(("want", ";".join(wants)))
    m = re.search(r"swept (\d+)\s+planned (\d+)\s+REFUSED by the planner "
                  r"(\d+)\s+accepted (\d+) \(([\d.]+)%", out)
    if m:
        facts += [("planned", m.group(2)), ("planner_refused", m.group(3)),
                  ("accepted", m.group(4)), ("accepted_rate", m.group(5))]
    m = re.search(r"ACCEPTED[^\n]*\n\s*([\d, ]+)$", out, re.M)
    if m:
        facts.append(("accepted_seeds", re.sub(r"\s+", "", m.group(1))))
    return facts


def _p_song(out):
    facts = []
    m = re.search(r"MANDATE: (\d+) group\(s\) over (\d+) lines, "
                  r"(\d+) mandated pair\(s\), source=(\S+)", out)
    if m:
        # `mandate_groups` and NOT `groups`: `plan` already banks a `groups`
        # fact and it is the mandate STRING (`1.T4,2.endword;...`), where
        # this one is an integer COUNT. One name over two quantities inside
        # one register is doctrine 1's own case, and a reader comparing them
        # would be comparing a spelling with a cardinality.
        facts += [("mandate_groups", m.group(1)), ("lines", m.group(2)),
                  ("mandated_pairs", m.group(3)), ("mandate_source",
                                                   m.group(4))]
    m = re.search(r"draft: (\d+) line\(s\), md5 (\w+)", out)
    if m:
        facts.append(("md5", m.group(2)))
    m = re.search(r"REPORT: (\d+) line\(s\) briefed — (\d+) FLAG, (\d+) NOTE"
                  r"[^\n]*?(\d+) WHOLE-DRAFT finding\(s\), (\d+) of them",
                  out)
    if m:
        facts += [("briefed", m.group(1)), ("per_line_flag", m.group(2)),
                  ("per_line_note", m.group(3)),
                  ("whole_draft", m.group(4)),
                  ("whole_draft_flag", m.group(5))]
    # Every finding CODE the report named, with the count it named itself.
    # Counted from the report rather than re-derived: this file records what
    # was printed, and re-deriving would make it a second grader.
    codes = {}
    for m in re.finditer(r"\[(FLAG|NOTE)\] ([A-Z][A-Z0-9_]+)\s*(?:x(\d+))?",
                         out):
        codes.setdefault((m.group(1), m.group(2)), 0)
        codes[(m.group(1), m.group(2))] += int(m.group(3) or 1)
    for (sev, code) in sorted(codes):
        facts.append(("finding:%s" % code, "%s x%d" % (sev, codes[(sev, code)])))
    return facts


def _p_revise(out):
    facts = []
    m = re.search(r"revise_loop: (\S+) after (\d+) round\(s\)", out)
    if m:
        facts += [("stop_reason", m.group(1)), ("rounds", m.group(2))]
    m = re.search(r"DRAFT: handed in (\d+) line\(s\), md5 (\w+) — emitted "
                  r"(\d+) line\(s\), md5 (\w+)(.*)$", out, re.M)
    if m:
        facts += [("md5_in", m.group(2)), ("md5_out", m.group(4)),
                  ("unchanged", "yes" if "UNCHANGED" in m.group(5) else "no")]
    m = re.search(r"PAIRS: mandated (\d+), judged (\d+), refused (\d+)", out)
    if m:
        facts += [("mandated", m.group(1)), ("judged", m.group(2)),
                  ("pairs_refused", m.group(3))]
    facts += _stamp_facts(out)
    return facts


#: THE STOP STAMP, one regex for both verbs that print it (2026-09-01,
#: triage finding C27 / `MISSING.md` M-196): `finish` has printed
#: `[FINISHED — seed N — exit E — STOP after R round(s) — …]` since M-169
#: and `revise` under `defer:` prints the same shape with `declared mandate`
#: where a seed would stand (M-195); the whole-draft clause joined at M-186.
#: `mcp/lyric_tools.js:extractLoopRecord` reads the identical shape, and
#: this is the log's copy of that reading — the working order's LAST verb
#: had no declared parser, so a finished song's stop was the one fact the
#: log could not hold.
_STAMP = re.compile(
    r"\[FINISHED\s*—\s*(?:seed\s*(-?\d+)|(declared mandate))\s*—\s*exit\s*(\d+)"
    r"\s*—\s*([A-Z_]+)\s+after\s+(\d+)\s+round\(s\)\s*—\s*"
    r"(?:UNRESOLVED:\s*([^\]—]*)|no flag stands)"
    r"(?:\s*—\s*WHOLE-DRAFT FLAG:\s*([^\]]*))?\]")


def _stamp_facts(out):
    m = _STAMP.search(out)
    if not m:
        return []
    open_lines = [x.strip() for x in (m.group(6) or "").split(",") if x.strip()]
    whole = [x.strip() for x in (m.group(7) or "").split(",") if x.strip()]
    return [("stamp_seed", m.group(1) if m.group(1) is not None
             else "declared mandate"),
            ("stamp_exit", m.group(3)),
            ("stop_reason", m.group(4)), ("rounds", m.group(5)),
            ("unresolved", str(len(open_lines))),
            ("whole_flags", str(len(whole)))]


def _p_finish(out):
    """`finish` prints the loop's own lines (`revise_loop:`, `DRAFT:`,
    `PAIRS:`) and then the stamp; the stamp's stop_reason/rounds AGREE with
    the loop line's by construction (one `LoopResult` prints both), and the
    later pair wins in the fact list, which is the stamp's."""
    return _p_revise(out)


PARSERS = {
    "screen": _p_screen,
    "plan": _p_plan,
    "plan --sweep": _p_sweep,
    "song": _p_song,
    "revise": _p_revise,
    "finish": _p_finish,
    "brief": _p_song,
}


def verb_of(argv):
    """-> the declared parser key, or None. `plan --sweep` is its OWN verb
    here and not a flag on `plan`: it emits an acceptance RATE and no plan,
    so a parser reading it as a plan would find nothing and report that the
    command said nothing."""
    rest = [a for a in argv if not a.startswith("-")]
    head = None
    for a in argv:
        if a.endswith(".py") or a in ("python3", "python"):
            continue
        if not a.startswith("-"):
            head = a
            break
    if head == "plan" and any(a.startswith("--sweep") for a in argv):
        return "plan --sweep"
    if head in PARSERS:
        return head
    # `python3 quality/plan.py --sweep=...` reaches the same instrument
    # without naming a verb; read the module.
    if any(a.endswith("plan.py") for a in argv):
        return "plan --sweep" if any(a.startswith("--sweep")
                                     for a in argv) else "plan"
    del rest
    return None


# -------------------------------------------------- the invocation, banked
# `MISSING.md` M-196 (2026-09-02). Facts about WHAT WAS RUN and WHAT IT WAS RUN
# ON, kept apart by name from the facts about what the run SAID. Nothing here
# reads stdout and nothing here grades: the mandate is transcribed off argv,
# the bytes are copied off the file the argv named, and the identity is the one
# the verb printed.


def lyric_arg(argv):
    """-> (path, None) or (None, why-there-is-no-draft-to-bank).

    THE RULE IS UNIQUENESS, AND AMBIGUITY REFUSES. Across the whole declared
    vocabulary of grading verbs — `brief LYRIC`, `song BLUEPRINT LYRIC`,
    `revise LYRIC`, `finish LYRIC` — exactly one POSITIONAL names a `.txt`
    file (the blueprint is `.json`), so "the unique existing `.txt`
    positional" picks the right one on every command this file can record.
    Read by INDEX instead it would have to respell `_mandate_arg`'s
    flag-stripping pass, and a space-separated `--subdivision 2` moves every
    index behind it — a wrong file picked silently is the one outcome this
    whole entry exists to prevent, so two candidates write nothing and say
    both names.
    """
    hits = []
    for a in argv[1:]:
        if a.startswith("-") or not a.endswith(".txt"):
            continue
        p = a if os.path.isabs(a) else os.path.join(ROOT, a)
        if os.path.isfile(p):
            hits.append(p)
    if not hits:
        return None, "no positional argument names an existing .txt file"
    if len(set(hits)) > 1:
        return None, ("%d positional .txt files (%s) — which one was graded "
                      "is not guessed"
                      % (len(hits), ", ".join(os.path.relpath(h, ROOT)
                                              for h in hits)))
    return hits[0], None


def mandate_facts(argv):
    """-> [(fact, value)] — the mandate this invocation declared, VERBATIM.

    The gap this closes, in the register's own words: `oar_lair.txt` has no
    README command, no `plan` row and none in its commit message, so the
    mandate its banked bytes were graded under is recoverable from nowhere.
    A `song` run recorded through here can never reach that state again.
    """
    facts = []
    for flag, name in MANDATE_FLAGS:
        vals = [a[len(flag):] for a in argv if a.startswith(flag)]
        # A spelling handed in twice is a REFUSAL at the harness
        # (`_mandate_arg` will not choose between them), so it cannot reach a
        # banked row; if it somehow does, both are kept rather than one
        # silently winning.
        for v in vals:
            if v:
                facts.append((name, v))
    if "--cliques" in argv:
        facts.append(("mandate_cliques", "declared"))
    # A BARE LETTER SCHEME is a mandate spelling with no flag on it: the only
    # positional past the lyric that is all letters. Anchored so `ABAB` is
    # read and `songs/x.txt`, `2` and `--groups=…` are not.
    for a in argv[1:]:
        if re.fullmatch(r"[A-Za-z]{2,}", a) and a not in PARSERS \
                and a.lower() != a:
            facts.append(("mandate_scheme_text", a))
    return facts


def bank_draft(song, verb, argv, facts):
    """-> (relpath, None) or (None, why-no-file-was-written).

    DOCTRINE 1, SPELLED AS A CONSTRUCTION. The file's name carries the md5 the
    VERB printed — taken out of `facts`, which is the parser's reading of the
    verb's own line, never a second regex and never a second hash. The bytes
    are then fingerprinted through the harness's own two definitions and must
    EQUAL it; on a disagreement nothing is written and the reason is printed.
    The alternative — write the bytes under the printed name and trust — is a
    file whose name states an identity its contents may not have, which is the
    one artifact worse than no file at all.
    """
    d = dict(facts)
    fp = d.get(DRAFT_FACT.get(verb, ""))
    if not fp:
        return None, ("`%s` printed no draft fingerprint, so there is no name "
                      "to bank bytes under" % verb)
    path, why = lyric_arg(argv)
    if path is None:
        return None, why
    # BORROWED, NOT RESPELLED, both of them — `load_lyric_lines` is the one
    # definition of what counts as sung text and `draft_fingerprint` the one
    # definition of the identity printed above. Neither is a grader: one
    # selects lines, the other hashes them, and no verdict passes through
    # either (§5 of `test_songs_log.py` is about GRADING, and stands).
    import lyric_harness as LH
    from quality.revise import draft_fingerprint
    lines = LH.load_lyric_lines(path)
    got = draft_fingerprint(lines)
    if got != fp:
        return None, ("%s fingerprints %s and `%s` graded %s — the input "
                      "changed under the record; no draft file written"
                      % (os.path.relpath(path, ROOT), got, verb, fp))
    text = "\n".join(lines) + "\n"
    out = draft_path(song, fp)
    if os.path.exists(out):
        with open(out, encoding="utf-8") as fh:
            if fh.read() != text:
                return None, ("%s already holds DIFFERENT bytes under this "
                              "fingerprint; nothing overwritten"
                              % os.path.relpath(out, ROOT))
        return os.path.relpath(out, ROOT), None
    os.makedirs(DRAFTS, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(text)
    return os.path.relpath(out, ROOT), None


def bank_draft_file(song, md5, path):
    """-> (relpath, None) or (None, why-nothing-was-written).

    THE RECOVERY VERB M-196 NAMED AND DID NOT BUILD. A draft that was graded
    before the bytes were banked (`DRAFT_BANKING_SINCE`) is LOST, and one of
    the four -- the_long_way_back `687eaa34c949` -- is readable from git
    history for that song and no other. Writing those bytes into
    `songs/drafts/` BY HAND would produce a file that looks
    banked-by-construction and was not; this is the declared route, and it
    REFUSES unless three things hold, each checked and none assumed:

      1. `song`'s log HOLDS `md5` -- on an `md5`, `md5_in` or `md5_out` row.
         A fingerprint the log never printed is not a draft of this song,
         whatever the file contains, and banking it would invent a step.
      2. `path` FINGERPRINTS to `md5` through the harness's own two
         definitions (`load_lyric_lines`, `draft_fingerprint`) -- the same
         borrowed pair `bank_draft` uses, never a second hash.
      3. the destination holds nothing, or holds these exact bytes.

    Nothing is looked up FOR the caller: the md5 is typed, the file is named,
    and the verb says yes or no. A `--bank-draft` that searched git history
    itself would be the backfill `drafts()` refuses to perform.
    """
    rows = [r for r in _md5_rows(song) if r[3] == md5]
    if not rows:
        held = sorted({r[3] for r in _md5_rows(song)})
        return None, ("%s's log holds no row fingerprinted %s -- it holds %s "
                      "-- so these bytes are not a draft this log ever named; "
                      "nothing banked"
                      % (song, md5, ", ".join(held) if held else "no md5 at all"))
    import lyric_harness as LH
    from quality.revise import draft_fingerprint
    try:
        lines = LH.load_lyric_lines(path)
    except (OSError, UnicodeDecodeError) as e:
        return None, "%s cannot be read: %s" % (path, e)
    got = draft_fingerprint(lines)
    if got != md5:
        return None, ("%s fingerprints %s, not %s; nothing banked under a "
                      "name its bytes do not carry" % (path, got, md5))
    text = "\n".join(lines) + "\n"
    out = draft_path(song, md5)
    if os.path.exists(out):
        with open(out, encoding="utf-8") as fh:
            if fh.read() != text:
                return None, ("%s already holds DIFFERENT bytes under this "
                              "fingerprint; nothing overwritten"
                              % os.path.relpath(out, ROOT))
        return os.path.relpath(out, ROOT), None
    os.makedirs(DRAFTS, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(text)
    return os.path.relpath(out, ROOT), None


# ---------------------------------------------------------------- the log

def read_log(song):
    p = log_path(song)
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8") as f:
        rows = [ln.rstrip("\n").split("\t") for ln in f if ln.strip()]
    return [dict(zip(HEADER, r)) for r in rows[1:]]


def append(song, rows):
    p = log_path(song)
    new = not os.path.exists(p)
    with open(p, "a", encoding="utf-8") as f:
        if new:
            f.write("\t".join(HEADER) + "\n")
        for r in rows:
            f.write("\t".join(str(r[k]) for k in HEADER) + "\n")


def record(song, argv, allow_dirty=False):
    verb = verb_of(argv)
    if verb is None:
        print("  REFUSED — no declared parser for this command.")
        print("    declared: " + ", ".join(sorted(PARSERS)))
        print("    A row banked from output nothing read is a row that looks")
        print("    like a record and is a memory (doctrine 20).")
        return 2
    # THE ROW IS KEYED ON A COMMIT (M-196, 2026-09-01) — refused BEFORE the
    # command runs, so a refused record costs nothing; `--allow-dirty` is
    # the declared way past, and the row is then stamped as working-tree.
    stamp = harness_commit()
    if stamp.endswith("-WORKING") and not allow_dirty:
        print("  REFUSED — the tree is dirty (%s): a log row keyed on a commit "
              "that does not exist. Commit first, or pass --allow-dirty to "
              "record a working-tree run on purpose." % stamp)
        return 2
    proc = subprocess.run(argv, cwd=ROOT, capture_output=True, text=True)
    out = proc.stdout + proc.stderr
    facts = PARSERS[verb](out)
    if not facts:
        print("  REFUSED — `%s` ran (exit %d) and this parser read NOTHING "
              "from it." % (verb, proc.returncode))
        print("    The verb's output moved, or the command did not do what "
              "its name says. Either way the row is not banked: an empty")
        print("    record of a real run is worse than no record.")
        sys.stdout.write(out[-1200:])
        return 2
    # THE INVOCATION, BANKED BESIDE WHAT IT SAID (M-196, 2026-09-02). Only on
    # the verbs that GRADE a draft: `screen` and `plan` declare no mandate and
    # are handed no draft, and inventing empty rows for them would be the
    # empty cell this file's shape exists to refuse.
    if verb in DRAFT_FACT:
        facts = facts + [("command", shlex.join(argv))] + mandate_facts(argv)
        rel, why = bank_draft(song, verb, argv, facts)
        if rel:
            facts.append(("draft_file", rel))
            with open(os.path.join(ROOT, rel), encoding="utf-8") as _fh:
                facts.append(("draft_lines",
                              str(len(_fh.read().splitlines()))))
        else:
            # SAID, NEVER SWALLOWED. A record that quietly banked no bytes
            # looks exactly like one that banked them, and `--drafts` will
            # charge this row as FAILING — so the reason is on the page at the
            # moment it can still be fixed (doctrine 20).
            print("  NO DRAFT BANKED — %s" % why)
    # A TAB OR A NEWLINE IN A VALUE SPLITS THE ROW IT IS WRITTEN INTO, and an
    # argv can carry either where a stdout regex group could not. Dropped and
    # NAMED rather than escaped: a value this file had to rewrite to store is
    # no longer the value that was handed in.
    unstorable = [f for f, v in facts if "\t" in v or "\n" in v]
    if unstorable:
        print("  NOT BANKED (a tab or newline would split the row): %s"
              % ", ".join(unstorable))
        facts = [(f, v) for f, v in facts if f not in unstorable]
    step = 1 + max([int(r["step"]) for r in read_log(song)] or [0])
    stamp = datetime.date.today().isoformat()
    sha = harness_commit()
    append(song, [{"song": song, "step": step, "measured": stamp,
                   "harness_commit": sha, "verb": verb,
                   "exit": proc.returncode, "fact": f, "value": v}
                  for f, v in facts])
    print("  RECORDED step %d — `%s` exit %d, %d fact(s) -> %s"
          % (step, verb, proc.returncode, len(facts),
             os.path.relpath(log_path(song), ROOT)))
    for f, v in facts:
        print("    %-28s %s" % (f, v))
    return 0


def show(song):
    rows = read_log(song)
    if not rows:
        print("  no log for %s" % song)
        return 2
    print("  %s — %d fact(s) over %d invocation(s)"
          % (song, len(rows), len(set(r["step"] for r in rows))))
    last = None
    for r in rows:
        if r["step"] != last:
            last = r["step"]
            print("  [%s] %s  exit %s  (%s @ %s)"
                  % (r["step"], r["verb"], r["exit"], r["measured"],
                     r["harness_commit"]))
        print("      %-28s %s" % (r["fact"], r["value"]))
    return 0


# ------------------------------------------------------- the claim gate
# The README states process outcomes in prose. Each of these patterns names
# a fact the LOG holds, so a sentence and a row can be put beside each other.
# Anything not matched here is not charged — this gate is about the claims
# it can resolve, and says how many it could not (doctrine 79).

CLAIMS = [
    (re.compile(r"`song` exit (\d+)"), "song", ["exit"]),
    (re.compile(r"(\d+) FLAG\b"), "song", ["per_line_flag"]),
    (re.compile(r"`revise` (\w+) in (\d+) rounds?"), "revise",
     ["stop_reason", "rounds"]),
    (re.compile(r"`finish` exit (\d+)"), "finish", ["stamp_exit"]),
    (re.compile(r"`finish` (\w+) in (\d+) rounds?"), "finish",
     ["stop_reason", "rounds"]),
    (re.compile(r"md5 `(\w+)`"), "revise", ["md5_out"]),
    (re.compile(r"(\d+) pairs mandated / (\d+) judged / (\d+) refused"),
     "revise", ["mandated", "judged", "pairs_refused"]),
    (re.compile(r"plans all (\d+) seeds"), "plan --sweep", ["swept"]),
    (re.compile(r"refused by the planner on (\d+) of them"), "plan --sweep",
     ["planner_refused"]),
    (re.compile(r"accepts \**(\d+)\**\s*\(([\d.]+)%\)"), "plan --sweep",
     ["accepted", "accepted_rate"]),
    (re.compile(r"\*\*(\d+) lines, (\d+) sections"), "plan",
     ["lines", "sections"]),
]
# EVERY GROUP IS CHARGED TO ITS OWN FACT, INDEX-ALIGNED. The first draft
# tested "does any captured number equal the one fact we looked up", which
# passes a triple whose three numbers are the right SET in the wrong ORDER —
# a mandated/judged/refused claim that swaps refused and judged is exactly the
# doctrine 79 error this repository spells out, and a gate that admits it is
# reporting the multiset rather than the counts.
for _pat, _verb, _facts_ in CLAIMS:
    assert _pat.groups == len(_facts_), (_pat.pattern, _facts_)


def _sections():
    """-> [(song, text)] — the README's per-song sections, keyed by the lyric
    file each heading names."""
    with open(README, encoding="utf-8") as f:
        text = f.read()
    out, cur, buf = [], None, []
    for ln in text.splitlines():
        m = re.match(r"^## `([a-z_0-9]+\.txt)`", ln)
        if m:
            if cur:
                out.append((cur, "\n".join(buf)))
            cur, buf = m.group(1), []
        elif ln.startswith("## "):
            # ANY heading closes the section, not only the next SONG heading.
            # Read the other way, the file's general prose — which talks about
            # exit codes and round counts in the abstract — would be charged to
            # whichever song happened to be written about last, and would pass
            # or fail against a log it is not about.
            if cur:
                out.append((cur, "\n".join(buf)))
            cur, buf = None, []
        elif cur is not None:
            buf.append(ln)
    if cur:
        out.append((cur, "\n".join(buf)))
    return out


LOG_CITE = re.compile(
    r"(\S+?)(\s*)\[LOG:\s*([a-z_0-9:~']+)\s+([a-z_0-9]+\.txt)"
    r"(?:\s+([a-z']+))?\s*\]", re.I)
# AN EXAMPLE IS A CITATION INSIDE A CODE SPAN, AND THE DISCRIMINATOR IS
# ADJACENCY. Prose that TEACHES the notation has to be able to spell it —
# `[LOG: clean_or_non_rhyme carry_it_over.txt bell]` — and a real citation is
# always `VALUE [LOG: ...]` with the value and a space in front of it. So a
# `[LOG:` with a backtick FLUSH against it is notation and a `[LOG:` with
# whitespace in front of its value is a claim. The escape is COUNTED and
# printed rather than silently skipped: an un-charged citation nobody can see
# is a way to smuggle a claim past the gate wearing a code span.


def _steps(song):
    """-> {step: {fact: value}} — the log grouped back into invocations."""
    out = {}
    for r in read_log(song):
        out.setdefault(int(r["step"]), {})[r["fact"]] = r["value"]
        out[int(r["step"])]["exit"] = r["exit"]
        out[int(r["step"])]["_verb"] = r["verb"]
    return out


def resolve_cite(song, fact, word=None):
    """-> (value, None) or (None, why-it-is-REFUSED).

    THE KEY IS A WORD, NOT A STEP ORDINAL, and that is the whole design. A
    citation into an append-only log keyed on position is an offset from a
    moving origin — the same defect this repository already found in its own
    `data/sources.tsv:NNN` citations, where an unrelated insertion made a true
    sentence false without one character of it changing. A screen run is named
    by any word it screened, which survives reordering, re-recording and
    insertion; a word screened by two runs REFUSES as ambiguous rather than
    resolving to whichever came first.
    """
    steps = _steps(song)
    if not steps:
        return None, "no log for %s" % song
    if word:
        hits = [n for n, d in steps.items()
                if any(k.startswith("pair:") and
                       word.lower() in k[5:].split("~") for k in d)]
        if not hits:
            return None, "no screen run in %s includes %r" % (song, word)
        if len(hits) > 1:
            return None, ("%r names %d runs in %s; a citation must name one"
                          % (word, len(hits), song))
        d = steps[hits[0]]
        if fact not in d:
            return None, ("the run naming %r holds no %r" % (word, fact))
        return d[fact], None
    hits = [n for n in sorted(steps) if fact in steps[n]]
    if not hits:
        return None, "the log for %s holds no %r" % (song, fact)
    return steps[hits[-1]][fact], None


def _facts(song):
    """-> {verb: {fact: value}} for the LAST invocation of each verb.

    A song's prose describes the state it SHIPPED in, so a verb run more than
    once is answered by its final run. Earlier runs are not discarded — they
    are rows in the log, and `--show` prints every one in order; what this
    view does is refuse to let an earlier answer stand in for the shipped one.
    """
    steps = {}
    for r in read_log(song):
        steps.setdefault((r["verb"], int(r["step"])), {})[r["fact"]] = r["value"]
        steps[(r["verb"], int(r["step"]))]["exit"] = r["exit"]
    d = {}
    for (verb, step) in sorted(steps, key=lambda k: k[1]):
        d[verb] = steps[(verb, step)]
    return d


def verdicts():
    ok = bad = refused = 0
    for song, text in _sections():
        f = _facts(song)
        if not f:
            print("  REFUSED  %s — no log; nothing to charge its prose "
                  "against" % song)
            refused += 1
            continue
        for pat, verb, facts in CLAIMS:
            for m in pat.finditer(text):
                claim = m.group(0)
                for i, fact in enumerate(facts):
                    said = m.group(i + 1)
                    if verb not in f or fact not in f[verb]:
                        print("  REFUSED  %s: %r — the log holds no %s/%s"
                              % (song, claim, verb, fact))
                        refused += 1
                        continue
                    got = str(f[verb][fact])
                    if got == said:
                        ok += 1
                    else:
                        print("  MISMATCH %s: %r — the log says %s = %s, the "
                              "README says %s" % (song, claim, fact, got, said))
                        bad += 1
    # A BANKED SONG WITH NO README SECTION IS A REFUSED ROW, NOT AN INVISIBLE
    # ONE (2026-09-01, `MISSING.md` M-196): the loop above charges only the
    # songs the README talks about, so a song in the bank at exit 3 with no
    # section was charged nothing and looked clean (doctrine 79/20).
    listed = {os.path.basename(song).replace(".txt", "")
              for song, _ in _sections()}
    banked = set()
    for f in sorted(os.listdir(os.path.dirname(README))):
        if f.endswith(".log.tsv"):
            banked.add(f[:-len(".log.tsv")].replace(".txt", ""))
    for song in sorted(banked - listed):
        print("  REFUSED  %s — banked (a log exists) and no README section "
              "names it; nothing can be charged against prose that is not "
              "there" % song)
        refused += 1
    with open(README, encoding="utf-8") as fh:
        whole = fh.read()
    cited = examples = 0
    for m in LOG_CITE.finditer(whole):
        said, gap, fact, song, word = m.groups()
        if not gap and said.endswith("`"):
            examples += 1
            continue
        said = said.strip("`*_ ")
        got, why = resolve_cite(song, fact, word)
        if got is None:
            print("  REFUSED  %s: %r — %s" % (song, m.group(0), why))
            refused += 1
        elif str(got) == said:
            ok += 1
            cited += 1
        else:
            print("  MISMATCH %s: %r — the log says %s, the README says %s"
                  % (song, m.group(0), got, said))
            bad += 1
    print()
    print("  %d claim(s) RESOLVED (%d of them by an explicit [LOG:] "
          "citation), %d MISMATCHED, %d REFUSED — three counts, never summed "
          "(doctrine 79)" % (ok, cited, bad, refused))
    print("  %d [LOG:] occurrence(s) read as NOTATION rather than as a claim "
          "— prose teaching the citation form, marked by a code span flush "
          "against the bracket" % examples)
    print()
    print("RESULT: %s" % ("PASS" if bad == 0 else "FAIL"))
    return 0 if bad == 0 else 3


# --------------------------------------------------- the draft gate
# `MISSING.md` M-196 (2026-09-02). Every md5 the log banked, against the bytes
# behind it. FOUR counts, never summed (doctrine 79) — and the third exists
# because "banked before this mechanism" and "banked after it and missing" are
# different findings and a rule that cannot tell them apart is worthless.
#
#   BANKED       a draft file exists AND re-fingerprints to the banked md5, so
#                a later reader can grade the same bytes. The only bucket that
#                is the mechanism working.
#   RECOVERABLE  no draft file, but the song's own COMMITTED lyric fingerprints
#                to this md5 — the bytes are in the bank under the song's name.
#                Nothing is lost and nothing was banked; named, never counted
#                as BANKED, because a backfilled file would erase exactly the
#                distinction this bucket is (doctrine 20: absent is not zero,
#                and neither is recoverable-by-hand the same as recorded).
#   LOST         measured before DRAFT_BANKING_SINCE and matching nothing on
#                disk: provable and unreadable, which is M-168's whole finding
#                stated as a number rather than a sentence. Kept VISIBLE
#                (doctrine 17) and never turns the gate red — history cannot be
#                made true by a check written after it.
#   FAILING      measured on or after DRAFT_BANKING_SINCE with no readable
#                draft. The mechanism was live and did not bank the bytes.
#                This is the only bucket that is red.


def _md5_rows(song):
    """-> [(step, verb, fact, md5, measured, draft_file-or-None)] for every
    draft fingerprint the log holds. `md5_out` is included: a loop that
    EMITTED bytes named an identity too, and leaving it out would make an
    unbanked emitted draft invisible rather than counted."""
    steps = {}
    for r in read_log(song):
        steps.setdefault(int(r["step"]), {})[r["fact"]] = r["value"]
        steps[int(r["step"])]["_verb"] = r["verb"]
        steps[int(r["step"])]["_measured"] = r["measured"]
    out = []
    for n in sorted(steps):
        d = steps[n]
        for fact in ("md5", "md5_in", "md5_out"):
            if fact in d:
                out.append((n, d["_verb"], fact, d[fact], d["_measured"],
                            d.get("draft_file")))
    return out


def drafts(stream=sys.stdout):
    p = lambda s="": print(s, file=stream)          # noqa: E731
    import lyric_harness as LH
    from quality.revise import draft_fingerprint
    from quality.song_record import songs as _songs

    def fp_of(path):
        try:
            return draft_fingerprint(LH.load_lyric_lines(path))
        except (OSError, UnicodeDecodeError):
            return None

    names = sorted(os.path.basename(x) for x in _songs())
    for f in sorted(os.listdir(SONGS)):
        if f.endswith(".log.tsv"):
            n = f[:-len(".log.tsv")] + ".txt"
            if n not in names:
                names.append(n)
    n = {"BANKED": 0, "RECOVERABLE": 0, "LOST": 0, "FAILING": 0}
    p("THE DRAFTS BEHIND THE MD5s — four counts, never summed (doctrine 79)")
    for song in sorted(names):
        rows = _md5_rows(song)
        if not rows:
            continue
        committed = os.path.join(SONGS, song)
        here = fp_of(committed) if os.path.exists(committed) else None
        # ONE LINE PER (song, md5), COUNTED IN ROWS. The question is about a
        # set of BYTES and a `song`/`revise` pair naming the same draft is one
        # artifact seen twice; the count stays on rows because the assertion
        # is "every md5 fact names bytes", and the two are printed together so
        # neither can be read off as the other.
        seen = []
        for step, verb, fact, md5, measured, said in rows:
            for grp in seen:
                if grp["md5"] == md5:
                    break
            else:
                grp = {"md5": md5, "where": [], "measured": measured,
                       "said": None}
                seen.append(grp)
            grp["where"].append("%s %s/%s" % (step, verb, fact))
            grp["measured"] = min(grp["measured"], measured)
            grp["said"] = grp["said"] or said
        for grp in seen:
            md5, said = grp["md5"], grp["said"]
            where = "step " + ", ".join(grp["where"])
            path = draft_path(song, md5)
            if os.path.exists(path) and fp_of(path) == md5:
                if said and os.path.normpath(os.path.join(ROOT, said)) != \
                        os.path.normpath(path):
                    verdict, why = "FAILING", (
                        "the row points at %s and the bytes are at %s"
                        % (said, os.path.relpath(path, ROOT)))
                else:
                    verdict, why = "BANKED", os.path.relpath(path, ROOT)
            elif md5 == here:
                verdict, why = "RECOVERABLE", ("no draft file; the committed "
                                               "lyric IS these bytes")
            elif grp["measured"] < DRAFT_BANKING_SINCE:
                verdict, why = "LOST", ("graded %s, before the bytes were "
                                        "banked; provable and unreadable"
                                        % grp["measured"])
            else:
                verdict, why = "FAILING", ("recorded %s, on or after %s, and "
                                           "no readable draft"
                                           % (grp["measured"],
                                              DRAFT_BANKING_SINCE))
            n[verdict] += len(grp["where"])
            p("  %-11s %s %s %s — %s" % (verdict, song, md5, where, why))
    p()
    p("  %d BANKED, %d RECOVERABLE (in the committed lyric, not in a draft "
      "file), %d LOST before %s, %d FAILING — four counts of md5 ROWS, never "
      "summed" % (n["BANKED"], n["RECOVERABLE"], n["LOST"],
                  DRAFT_BANKING_SINCE, n["FAILING"]))
    p()
    p("RESULT: %s" % ("PASS" if not n["FAILING"] else "FAIL"))
    return 0 if not n["FAILING"] else 3


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--record", metavar="SONG")
    ap.add_argument("--allow-dirty", action="store_true",
                    help="record on a dirty tree anyway (stamped -WORKING)")
    ap.add_argument("--show", metavar="SONG")
    ap.add_argument("--verdicts", action="store_true")
    ap.add_argument("--drafts", action="store_true",
                    help="every banked md5 against the bytes behind it")
    ap.add_argument("--bank-draft", nargs=3, metavar=("SONG", "MD5", "FILE"),
                    help="bank FILE as SONG's draft MD5 -- refuses unless the "
                         "log holds MD5 and FILE fingerprints to it (M-196)")
    ap.add_argument("cmd", nargs="*")
    a = ap.parse_args()
    if a.bank_draft:
        song, md5, path = a.bank_draft
        if not song.endswith(".txt"):
            song += ".txt"
        rel, why = bank_draft_file(song, md5, path)
        if rel is None:
            print("  REFUSED -- %s" % why)
            return 2
        print("  BANKED %s %s -> %s" % (song, md5, rel))
        return 0
    if a.record:
        argv = list(a.cmd)
        if argv and argv[0] == "--":
            argv = argv[1:]
        if not argv:
            print("  REFUSED — --record needs a command: "
                  "--record SONG -- python3 lyric_harness.py song ...")
            return 2
        return record(a.record, argv, allow_dirty=a.allow_dirty)
    if a.show:
        return show(a.show)
    if a.verdicts:
        return verdicts()
    if a.drafts:
        return drafts()
    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())

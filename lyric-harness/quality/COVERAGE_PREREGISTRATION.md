# Pre-registration — does writing a song actually reach what we built?

Committed **before** the draft exists and **before** the denominator is
derived. `git log` proves the order, and the order is the whole method: a
coverage claim written after the run is a description of what happened, not a
test of anything.

## The question, stated so it can fail

The hypothesis under test is NOT "the harness forces a writer to use every
layer." That would be a defect if it were true, and this file says so up front
so nobody mistakes a correct refusal for a gap. Half of what this repo ships is
deliberately opt-in with an argument:

| capability | why it is not imposed |
|---|---|
| `--blueprint` | the structure is an INPUT; the harness cannot derive bars from lyrics |
| `--subdivision` | assuming a sixteenth-note grid "would put a number in the output that nobody declared" |
| `--isochronous` | there is no audio, so even spacing is a DECISION (doctrine 4) |
| the time layer | underpowered at an honest family size, and says so |
| g2p `low` fallback | measured NET HARMFUL — 50.0% wrong against 5.1% |

A harness that fired all of those unbidden would be manufacturing claims nobody
asked for. So the criterion is not usage. It is:

> **Every capability in the declared surface either FIRES, or REFUSES with a
> named cause, or is DISCLOSED as not-asked. Nothing is silent and
> undisclosed.**

A layer that is neither used nor disclosed as unused is the finding. That is
doctrine 20 pointed at the whole pipeline rather than at one check: silence and
a clean bill of health must not look alike.

## The four states, assigned BEFORE the run

Each item in the denominator is marked, in advance, as **EXPECTED REACHABLE**
or **DECLARED UNREACHABLE** at the rung being run, with the reason. Without
that split, `silent` conflates "this is broken" with "a couplet has no chorus,"
and the experiment cannot distinguish them afterwards.

After the run each item lands in exactly one state:

| state | meaning |
|---|---|
| `FIRED` | produced a finding, verdict or report |
| `REFUSED` | declined and named the missing coordinate |
| `DISCLOSED` | did not run, and the run SAID it did not run |
| **`SILENT`** | **none of the above — the finding** |

Reported as **four counts, never summed** (doctrine 79). The headline result is
the `SILENT ∩ EXPECTED REACHABLE` cell. `FIRED ∩ DECLARED UNREACHABLE` is a
second, smaller finding: something fired that this draft should not have been
able to reach, which means either the reachability argument or the layer is
wrong.

## Rung 1 — the couplet, and why not one line

MEASURED before choosing (this is not an argument from taste):

```
1 line : NoMandate — "declares no group of two or more lines, so it
         mandates NO pair and cannot flag anything"
2 lines: OK — mandated 1, collisions 0, whole-draft codes 1
```

A mandate is a statement about PAIRS. One line has none, so `grade`, `brief`,
`verify`, the revision loop, the collision cut and `--propose=defer:` cannot
engage at all — the entire spine sits out. One additional line starts all of
it. One line is therefore run FIRST as an instrument check only, never as a
test of the hypothesis, and its result is reported separately.

## The draft specification, fixed in advance

Declared here so that reachability is a COORDINATE and not a coincidence. The
draft is chosen to make layers reachable, and that choice is disclosed rather
than presented as a natural writing session.

1. **Two lines, one mandated group** — `A A`, the minimum that mandates a pair.
2. **The pair must FAIL on its first draft.** A couplet that already rhymes
   cleanly gives `brief` nothing to flag, the loop exits SUCCESS on round one,
   and the write-check-fix cycle is never exercised. The first draft is
   therefore written to break its own mandate.
3. **A blueprint is passed**, declaring one section, a time signature and a
   line count of 2, so meter and song-function are ASKED rather than skipped.
4. **`--subdivision` and `--isochronous` are both run in BOTH states** — given
   and withheld — because the claim under test is about disclosure, and a
   coordinate's absence is exactly as much a subject of this experiment as its
   presence.
5. **`--propose=defer:` is the proposer.** The shipped stub exists to prove the
   loop's control flow and is explicitly "not a way to get a good line." A run
   on the stub tests the loop; a run on `defer:` tests the harness against an
   actual writer, which is the thing being claimed.
6. **The writer is told nothing the CLI does not print.** Every coordinate I
   reach for that the run did not name is logged as a reach-around, which is
   the human half of the same measurement.

## Predicted refusals, written down so a surprise is legible

If these do NOT appear, the prediction was wrong and that is itself a result.

- `EXTRAPOLATED_LENGTH` / `OUT_OF_CALIBRATED_LENGTH` — two lines is far under
  every calibrated profile, so the floor's length-sensitive half must downgrade
  to notes AND SAY SO.
- `NO_SUBDIVISION` on the arm that withholds it, naming
  `Subdivision(slots_per_pulse=n, source=...)` as the closing work.
- `NO_SETTING` on the arm that withholds `--isochronous`, with status
  `PERMANENT` and the "there is no audio here" detail.
- `HOOK_UNDECLARED` / `FUNCTION_UNDECLARED` — a two-line blueprint declares no
  hook and one section.
- The `LAYERS:` disclosure naming meter and song-function as NOT ASKED on the
  arm with no blueprint.

## The instrument

A wrapper logs every invocation: `argv`, exit code, stdout, the finding codes
matched in it, and the **draft fingerprint** the run printed (built
2026-08-16 for exactly this — a recorded figure that cannot be tied back to its
input is the defect that produced the collisions-69 misattribution). The log is
machine-diffed against the denominator; no coverage claim is made from
recollection.

Exit codes are read as the declared vocabulary: `0` clean, `1` Python's own,
`2` REFUSED, `3` answered with a flag standing, `4` SUSPENDED.

## Bias controls

The failure this design exists to avoid is the one this repo keeps finding in
itself: a measurement taken by whoever already knows the answer.

1. **The denominator is derived by an independent agent** with no access to the
   draft, to the specification above, or to this session — reading the codebase
   ONLY. It cannot be shaped by what I intend to use.
2. **The diff is run by a second independent agent** against the log.
3. **A third adversarially attacks the conclusion**, with the standing
   instruction to default to refuted when it cannot reproduce a claim.
4. This file is committed before any of the three run.

## What would falsify the hypothesis

If `SILENT ∩ EXPECTED REACHABLE` is **empty** at this rung, the claim that
there are gaps to harden is NOT supported here, and the correct move is to
climb a rung — not to declare the pipeline sound. A couplet cannot exercise
returns, the length-calibrated floor, or the whole-draft/per-line seam, and an
empty result at rung 1 says nothing about any of them.

## Standing predictions about WHERE gaps will be

Recorded so the result can embarrass them:

1. **Not in the layers — in the handoffs.** The session that produced this file
   spent itself wiring layers; the remaining defects should be at seams.
2. **The whole-draft / per-line seam is the top candidate.** `verify()` reads
   whole-draft findings and can REJECT on them, but every stop condition in the
   loop is per-line, so a whole-draft flag can veto a revision and can never ask
   for one. Documented; never lived through.
3. **The blueprint is hand-written JSON and nothing checks it against intent**
   before the run consumes it.

<!-- DENOMINATOR BOUNDARY. Nothing above this line describes the draft's
     content. Below it, PROVENANCE IS MIXED and is marked per section: the
     surface enumeration is an independent derivation; the scoping ruling is
     the author's. Saying "nothing below was written by the author" would be
     false now that the ruling is here, so it is not said. -->

## Provenance of what follows

- **§A–§D are an INDEPENDENT DERIVATION**, produced by an agent reading the
  source only, barred from this file and from any draft, with no knowledge of
  the specification above. It verified reachability by running the toolkit on a
  real two-line draft rather than reasoning about it.
- **The scoping ruling below is the AUTHOR'S**, dated, with its argument. It is
  kept separate because a decision made by whoever benefits from it is exactly
  what the bias controls exist to expose, and hiding it inside the derivation
  would launder it.

## Scoping ruling — the 44 API-only coordinates (author, 2026-08-16)

The derivation found **44 declared coordinates with no CLI spelling**:
`Declaration` (17 of its 18 fields — every threshold and channel rule),
`ReviseDeclaration` (13), `FloorDeclaration` (9), plus `Mandate.scope`,
`fit.AssumedMeter`, `declared_inputs.BeatGrid`, `grid.VariationDeclaration`,
`grid.FormConvention`. MEASURED: no `Declaration(...)` construction anywhere in
`lyric_harness.py` sets a single field, so the comparator every score is read
under sits at its defaults on every CLI path; only `--profile` moves anything,
and only the two `channel_weights*`.

**RULED OUT OF SCOPE: 42 of them.** A calibrated band is not a per-song knob.
`theta_rhyme` at 0.750 is a measured cut with a held-out price recorded against
it; a writer moving it per draft would be tuning the ruler to the plank, and
the harness would stop being a comparator and become a mirror. Their being
API-only is a DECISION, not an omission, and counting them as coverage gaps
would manufacture 42 fake findings — the exact error the (B) column exists to
prevent.

**RULED IN SCOPE: 2.** `Mandate.scope` and `declared_inputs.BeatGrid` are not
tuning knobs — they are SONG FACTS a writer legitimately possesses: which lines
the mandate speaks about, and where syllables actually land. Their absence from
the CLI is what makes 4 of the 9 unreachable finding codes unreachable
(`COLLISION_UNDECLARED`, `MANDATE_SCOPE_DECLARED`, `PROMINENCE_OFF_HEAD`,
`BEATGRID_INCOMPLETE`). A writer who knows a fact the grader accepts, and has
no way to say it, is a plumbing gap and belongs in the denominator.

## Findings produced by the derivation itself, before any draft

Recorded because a pre-registration that produced results before its own
experiment ran should say so rather than let them surface later as if the run
found them.

1. **`NO_TEMPO` is a refusal that cannot fire.** `_no_tempo()` is defined at
   `quality/fit.py:184` and referenced only inside its own body and one
   docstring at `:568`. **No production caller.** Verified by grep over every
   non-test `.py`. Doctrine 48's shape, in the meter layer.
2. **The comparator is unreachable from the command line**, as measured above.
   Not itself a defect under the ruling, but it means every CLI figure this
   project has ever printed was computed at `Declaration()`'s defaults, which
   is worth knowing when reading any of them.

## A. Song-writing surface — 22 verbs

`declaration` · `score` · `candidates` · `chains` · `graph` · `scheme` ·
`meter` · `internal` · `density` · `types` · `partition` · `cycle` · `grid` ·
`fit` · `function` · `refrain` · `brief` · `verify` · `song` · `revise` ·
`readability` · `wiring`

All REACHABLE-AT-2. Sub-behaviours needing more: `graph`'s overlapping-clique
case (≥3 lines), `partition`'s "no letter scheme exists" refusal (≥3 lines with
overlapping cliques), `function`'s return-comparison half (two instances),
`refrain`'s named forms (villanelle 19 lines, triolet, rondel, ballade),
`revise`'s `ROUND_LIMIT` stop.

## A2. CLI-reachable coordinates — 22

`--fallback` · `--voices` · `--blueprint` · `--subdivision` · `--isochronous` ·
`--profile` · MANDATE letter string · `--groups` · `--returns` · `--cliques` ·
`--pursue` · `--propose` (all four spellings) · `--modal` · `-v` ·
`--function` · `--title` · `--hook` · `--rhyme-key` · `--preset` (English
members) · `--lang=eng` · `theta` positional · `n` positional

All REACHABLE-AT-2. `--cliques` only when the two lines actually rhyme — it
refuses on a non-rhyming pair, verified.

## A3. In-scope API-only coordinates — 2

`Mandate.scope` · `declared_inputs.BeatGrid`

## A4. Finding codes — 94

`R2` reachable at two lines · `R2*` reachable only at a calibrated token count
· `NM` needs more lines/sections/instances · `NC` not CLI-reachable

**Rhyme / mandate (11):** `SCHEME_VIOLATION` R2 · `MODAL_RHYME` R2 ·
`REFRAIN_REPEAT` R2 · `RETURN_NOT_VERBATIM` R2 · `SCHEME_UNREADABLE` R2 ·
`MANDATE_NOT_INDEPENDENT` R2 · `MANDATE_EXCUSED_BY_OVERLAP` NM ·
`GROUPS_DECLARED_RETURN` NM · `MANDATE_GROUPS_INDISTINGUISHABLE` NM ·
`MANDATE_SCOPE_DECLARED` NC · `RETURN_OUT_OF_RANGE` NC

**Collisions (5):** `SCHEME_COLLISION` NM · `NEAR_COLLISION` NM ·
`REPEAT_ACROSS_GROUPS` NM · `COLLISION_CUT_IS_SCALAR_ONLY` NM ·
`COLLISION_UNDECLARED` NC

**Slop floor (11):** `OUT_OF_CALIBRATED_LENGTH` R2 · `EXTRAPOLATED_LENGTH` R2 ·
`CLICHE_PAIR` R2 · `SHARED_SUFFIX` R2 · `REPEAT_IN_VERSE` R2 (NOTE only; FLAG
needs ≥2 mandated pairs) · `LEXICAL_MONOTONY` R2* · `FUNCTION_WORD_HEAVY` R2* ·
`ANAPHORA_OVERLOAD` R2* · `UNIFORM_LINE_LENGTH` R2* · `PREDICTABLE_RHYME` NM
(needs ≥108 tokens) · `RADIF_LICENSED` NM

**Meter / fit findings (18):** `ZERO_DURATION` · `BEAT_OUTSIDE_CYCLE` ·
`START_BEFORE_SECTION` · `OVERRUNS_SECTION` · `CROWDED` · `SPARSE` ·
`ANACRUSIS` · `LATE_ENTRY` · `START_OFF_GRID` · `SLOTS_EXCEEDED` ·
`PROMINENCE_EXCEEDS_HEADS` · `HEADS_EXCEED_UNITS` · `PROMINENCE_CANNOT_ALIGN` ·
`OVERLAPPING_SPANS` · `UNCOVERED_BARS` — all R2, verified · `TUPLET_REQUIRED`
R2 and `EVEN_DIVISION_LANDINGS` R2, both requiring `--isochronous` ·
`PROMINENCE_OFF_HEAD` NC

**Meter / fit refusals (9):** `UNDECLARED_GROUPING` R2 · `NOTHING_READ` R2 ·
`COUNT_IS_A_LOWER_BOUND` R2 · `NO_SUBDIVISION` R2 · `NO_SETTING` R2 ·
`ASSUMED_METER` NC · `BEATGRID_INCOMPLETE` NC · `PROMINENCE_UNDECIDED` NM ·
`NO_TEMPO` NC — **and dead, see Findings above**

**Song function findings (14):** `HOOK_ABSENT` R2 (the layer's only FLAG) ·
`HOOK_DOES_NOT_RECUR` R2 · `TITLE_NOT_IN_HOOK` R2 · `RETURN_NEVER_RETURNS` R2 ·
`HOOK_CONFINED` NM · `SINGLE_USE_RECURRED` NM · `BRIDGE_IS_A_VERSE` NM ·
`RETURN_LOCKED` NM · `RETURNS_WITH_SAME_WORDS` NM · `RETURN_LENGTH_DRIFT` NM ·
`RETURN_METER_DRIFT` NM · `RETURN_SLOT_DRIFT` NM · `RETURN_SCHEME_DRIFT` NM ·
`CROSS_FUNCTION_REPRISE` NM

**Song function refusals (15):** `FUNCTION_UNDECLARED` R2 · `SINGLE_INSTANCE`
R2 · `HOOK_UNDECLARED` R2 · `TITLE_UNDECLARED` R2 ·
`HOOK_PLACEMENT_UNDECLARED` R2 · `HOOK_PLACEMENT_PARTLY_UNDECLARED` NM ·
`NO_COMPARATOR` NM · `CHANNEL_NOT_MEASURED` NM (`function` verb only) ·
`NO_RHYME_KEY` NM (`function` verb only) · `END_WORD_UNREADABLE` NM ·
`STUB_RETURN` NM · `REPRISE_IS_NOT_LATER` NM · `REPRISE_SIDE_HAS_NO_WORDS` NM ·
`REPRISE_STUB` NM · `REPRISE_SIDE_UNDECLARED` NC

**Grid SHAPE layer (6):** `METER_LOCKED` R2 · `SECTION_LENGTH_LOCKED` NM ·
`QUATRAIN_LOCK` NM · `DOWNBEAT_LOCKED` NM · `UNIFORM_ANACRUSIS` NM ·
`PHRASE_LENGTH_LOCKED` NM

**Readability (5):** `UNREADABLE_END_WORD` R2 · `UNREADABLE_END_WORD_PIECE` R2
· `END_WORD_LABEL_OVERSTATES` R2 · `UNREADABLE_INTERIOR_WORD` R2 ·
`SUBSTITUTED_END_WORD` R2

## B. Out of scope, with the argument for each

| item | argument |
|---|---|
| `demo` | the harness's own acceptance suite — grades nothing you wrote |
| `qafiya` | Arabic/Persian rawi/ridf/taʾsis audit; English vowel classes only "stand in for Arabic letters" |
| `prasa` | Sanskrit *dvitīyākṣara-prāsa*, an Indic positional constraint no English song declares |
| `cynghanedd` | its own header prints "ENGLISH IMITATION of a Welsh form, not cynghanedd on Welsh" |
| `relations` | the 77-schema comparative-poetics census — a taxonomy instrument, not a revision instruction |
| `weight` | guru/laghu + *matra* counts; quantitative-prosody research with no consumer on the English path |
| `--schema=` | filters that tradition census; no other consumer |
| `--lang=` non-English (fin som ltc cym san non fas msa) | scores English words under a phonology that cannot read them |
| `--preset=` tradition members | rebinds the anchor rule to a specific non-English constraint |
| `Declaration.fitted` | doctrine 5 pins it False and a test enforces it; a caller cannot usefully set it |
| `PROMINENCE_DECLINED` | fires only on stressless phonologies (som/msa/fas); unreachable on CMUdict |
| `POLYCENTRIC_CYCLE` | a blueprint's `{beats,unit,groups}` cannot construct a polycentric cycle |
| `MARK_IS_A_NUMERAL` / `MARK_NOT_A_FUNCTION` / `MARK_UNRECOGNISED` | `grid.ingest_mark` reads a printed source's bracket marks in `corpus/song/`; on no draft-grading path |
| the 42 tuning coordinates | see the scoping ruling above |

## C. Totals — four buckets, never summed

| bucket | (A) | (B) |
|---|---|---|
| verbs | 22 | 6 |
| CLI coordinates | 22 | 4 |
| API-only coordinates | 2 in scope | 42 ruled out |
| finding codes | 94 | 5 |

Reachability of the 94: **R2 48** · **R2\* 4** · ~~**NM 33** · **NC 9**~~
**NM 34** · **NC 8** — REPINNED 2026-08-16, before rung 2 leans on the NM list.

Parsing §A4's own table returns 48 / 4 / 34 / 8. `R2` and `R2*` reproduce
EXACTLY, so **the reachable set is 52 either way and rung 1's entire score is
unaffected** — the disagreement is a single code sitting on the NM/NC line.
The TABLE is the authority and this line is a derived summary of it (doctrine
91: a count is a coordinate of the rendering, so the rendering must not be the
source of the count), so the summary is repinned rather than the table
re-marked. Nothing about rung 1 moves; what moves is the list rung 2 is about
to be measured against, which is why it is settled now rather than after.

**Rung 1 therefore tests at most 52 of 94 codes.** An empty result means CLIMB,
not sound — a couplet cannot reach returns, cross-section reprise, the collision
cut, or the stanza-lock shape layer.

## Rung 0 — the instrument check, RUN 2026-08-16

Run on ONE line, where the answer is already known, so a surprise indicts the
instrument rather than the harness. It is not a test of the hypothesis and no
coverage claim is made from it.

**It found two defects in the instrument, both on the exact distinction the
experiment rests on, and both are fixed in `quality/coverage_log.py`:**

1. **Codes were matched by a regex over prose with a noise blocklist.**
   `readability` on one bad line reported `ALREADY`, `CHARGE`, `EARLIER`,
   `REPLACED`, `SECOND`, `SILENTLY`, `UNKNOWN`, `WHICH` beside the two real
   codes. The vocabulary is now CLOSED and extracted from SOURCE — every
   `Finding`/`FitFinding`/`FitRefusal`/`GridFinding`/`Refusal` construction —
   so a match is a real code or it is nothing. Deliberately NOT read from the
   denominator below: a vocabulary matched against the denominator could never
   reveal a code the denominator forgot, which is one of the two findings this
   experiment is hunting.
2. **A REFUSAL WAS INDISTINGUISHABLE FROM SILENCE.** `brief <one line> A`
   exits 2 with a rich named cause in PROSE and no finding code at all, so the
   log recorded `codes=[]` — byte-identical to a layer that said nothing. That
   collapses the four states to three, *in the instrument*, on the precise
   distinction being measured. Exit 2 now captures the `REFUSED` line and its
   cause.

**A third, left standing and declared rather than fixed:** verbs like
`internal`, `score`, `density` and `types` evidence their firing with a REPORT,
not a finding code, so the code list alone reads them as silent. The diff stage
must therefore use different evidence per denominator kind — exit code plus
output presence for verbs, the code list for finding codes. Recorded here
because an instrument that needs a rule to read it should carry the rule.

**Predicted refusal confirmed, at the predicted exit code:** one line refuses at
**rc=2** with *"the mandate declares no group of two or more lines, so it
mandates NO pair and cannot flag anything."* The positive control also holds —
`readability` on a planted bad end word still reports `UNREADABLE_END_WORD` and
`SUBSTITUTED_END_WORD`, so the instrument's silence elsewhere is real silence
and not blindness.

## The 95-vs-99 discrepancy, RESOLVED 2026-08-16 — the answer is 100

Resolved before the rung-1 diff, as this file required, and NEITHER original
number was right. A third method (a naive AST pass) gave a third answer, 101.
The three were reconciled by enumerating and diffing rather than arguing, and
they converge:

```
AST   101 − 7 bogus letters + 6 it could not see = 100
agent  99 + 1 module it never read               = 100
```

**Four causes, each verified at a line of source:**

1. **`A`–`G` are not finding codes.** `quality/audit_corpus.py` reuses
   `Finding()` with a CHECK LETTER as its first argument, so a bare AST pass
   collects seven. Excluded by MINIMUM LENGTH 4 — deliberately not by
   "must contain an underscore", which would have deleted `CROWDED`, `SPARSE`
   and `ANACRUSIS`.
2. **A conditional first argument.** `grid.ingest_mark` builds
   `Refusal("MARK_NOT_A_FUNCTION" if reason else "MARK_UNRECOGNISED", ...)` —
   an `ast.IfExp`, invisible to a pass reading only `ast.Constant`. The agent
   had both; the AST had neither.
3. **A variable first argument, which no static pass can resolve.**
   `Reviser._collision_code()` RETURNS the code and `quality/revise.py:2025`
   passes it as `Finding(code, ...)`, so `SCHEME_COLLISION`, `NEAR_COLLISION`,
   `REPEAT_ACROSS_GROUPS` and `COLLISION_UNDECLARED` are invisible statically.
   The agent read them correctly; the extractor was blind. They are now
   DECLARED in `quality/coverage_log.py` with that reason attached.
4. **The derivation missed `PHRASE_CLICHE_REFUSED`**
   (`quality/phrase_commonplace.py:402`) because that module was outside the
   seven it read. Found only because the vocabulary is built independently of
   the denominator — which is the reason this file forbids seeding one from the
   other.

**A THIRD FINDING, produced by the reconciliation itself:**
`quality/phrase_commonplace.py` **has no production caller.** Every reference
to it in `grid.py`, `floor.py` and `relations.py` is PROSE inside a docstring;
no module imports it. It escapes the stranded-module check only by having a
`__main__`. So `PHRASE_CLICHE_REFUSED` joins `NO_TEMPO` as a second refusal
that cannot fire on any path a session takes — and unlike `NO_TEMPO` it is a
whole layer, not one function. Classified `(A)` + NOT-CLI-REACHABLE, on the
derivation's own convention: "is this phrase a commonplace" is a writing
question whose only blocker is plumbing, and its rhyme-pair sibling
`CLICHE_PAIR` is already in scope.

**The corrected totals: 100 finding codes — (A) 95, (B) 5**, and the NOT-CLI-
REACHABLE count rises from 9 to **10**. Rung 1 still tests at most 52.

`quality/coverage_log.py`'s extractor now reproduces 100 independently, with
the letter exclusion, the `IfExp` walk and the declared indirect four; the
three defect classes are recorded in its docstring rather than fixed silently.

## Rung 1 — STARTED 2026-08-16, HALTED ON THE INSTRUMENT

The draft, fixed per the specification: a two-line couplet mandated `AA` whose
pair FAILS on first writing — `four` ~ `stairs`, **0.612 NO_RELATION**, below
`theta_rhyme` 0.750, so `brief` has something to flag and the write-check-fix
cycle can actually run. Blueprint: one section, 2 bars, 4/4 as 2+2, two placed
lines. Draft fingerprint `385ff1e4055e`.

**HALTED BEFORE THE `defer:` SESSION, DELIBERATELY.** The pre-registration says
rung 0 validates the apparatus; rung 1 showed the apparatus is still not fit to
measure the thing. Running the writer session on a device known to be wrong
would be the exact error this repo keeps correcting — a measurement taken with
an instrument whose defects are already visible.

**THE DECIDING RESULT: the logger reported 18 fired codes where the API
reports 8.** On one two-line draft, grepping `brief`'s output for code names
inflated coverage by **125%**, and every one of the ten extras was PROSE:
`PREDICTABLE_RHYME` appears inside `EXTRAPOLATED_LENGTH`'s explanation of
tolerance bands; `RADIF_LICENSED`, `CLICHE_PAIR` and `REPEAT_IN_VERSE` inside
other findings' evidence. **A report that explains which checks did not run
necessarily names them**, so grepping counts the disclosure as the finding —
and inflates in the OPTIMISTIC direction, which is the direction that would
have made this experiment report a healthier pipeline than exists.

Two of the ten would have been recorded as `FIRED ∩ DECLARED UNREACHABLE` —
the pre-registration's *second* finding type — and both were artefacts. The
experiment would have manufactured its own headline.

**The true fired set at rung 1, read from `Reviser.inspect()`: 8 codes.**
per-line `CROWDED`, `PROMINENCE_EXCEEDS_HEADS`, `SCHEME_VIOLATION`,
`SLOTS_EXCEEDED`; whole-draft `EXTRAPOLATED_LENGTH`, `FUNCTION_UNDECLARED`,
`HOOK_UNDECLARED`, `NO_SETTING`. All eight are in the denominator's R2 set. No
surprises in either direction.

**Doctrine 91 is the rule that was broken and is now obeyed:** a count is a
coordinate of the RENDERING, so the rendering must not be the source of the
count. `coverage_log.inspect_codes()` reads the structured finding set;
output-grepping survives only for pure-CLI surfaces exposing no API.

### Instrument defects found by rungs 0 and 1 — six, and zero harness defects

| # | defect | direction of error |
|---|---|---|
| 1 | codes matched by regex over prose with a noise blocklist | false positives |
| 2 | a REFUSAL was indistinguishable from SILENCE | collapsed 4 states to 3 |
| 3 | verbs evidence firing with a REPORT, not a code | false silence |
| 4 | the refusal detector caught a report's `REFUSED, by cause:` HEADER | false refusals |
| 5 | coverage depended on the verb's VERBOSITY — `fit` without `-v` hides real fired codes | false silence |
| 6 | prose mentions counted as fired findings — 18 against a true 8 | **+125%, optimistic** |

Defect 5 nearly produced a fake finding of its own: `--isochronous` appeared to
retire `NO_SETTING` and add nothing, and a mechanism was hypothesised (an early
return in `_place_isochronous` swallowing the finding) before `-v` showed
`TUPLET_REQUIRED` and `EVEN_DIVISION_LANDINGS` both firing normally. The
prediction had been right; only the measurement was blind.

**That the apparatus is harder to build than the thing it measures is itself a
result**, and it is the one this rung actually produced. Six defects, all in
the instrument; none yet in the harness.

### The measurement, REBUILT AND RE-VALIDATED 2026-08-16

`quality/coverage_log.py --validate` — 9 known-answer checks, **9 passing**,
and proved two-sided by mutation rather than asserted.

**Two functions replace the grep.** `codes_for()` reads `Reviser.inspect()`'s
structured `per_line` and `whole` halves; refusal codes count as FIRED, because
`NO_SETTING` firing IS the layer refusing and that is a state the experiment
must see rather than a silence it must explain away.

**`effect_of()` is the more important one: coordinates are now measured
DIFFERENTIALLY.** Seeing `--isochronous` in an argv proves the flag was TYPED,
never that it was READ — and "declared, consumed, and dropped" is a defect
shape this repo has shipped more than once. A coordinate whose finding set does
not move, on a draft that gives it something to say, is UNREAD on that draft.
Two inspects, one diff, no prose anywhere in the path.

**The cases carry the defects they regress.** Defect 6 is pinned by a NEGATIVE:
`PREDICTABLE_RHYME` must NOT be in the fired set for the rung-1 draft, though
it is named in `EXTRAPOLATED_LENGTH`'s prose about tolerance bands. Defect 5 is
pinned by the DIFFERENTIAL: `--isochronous` must retire `NO_SETTING` and add
`TUPLET_REQUIRED` + `EVEN_DIVISION_LANDINGS`.

**Two-sidedness, by mutation on a symlinked copy — and the two kill DIFFERENT
checks, which is the property that matters:**

| mutation | fails | which |
|---|---|---|
| `codes_for` returns nothing — a BLIND instrument | 6 of 9 | every POSITIVE, plus all three coordinate checks |
| `codes_for` returns the whole vocabulary — a CREDULOUS instrument | 6 of 9 | every NEGATIVE, plus all three coordinate checks |

A validator that only caught blindness could not have caught defect 6, which
was an over-report; one that only caught credulity could not have caught
defects 3 and 5, which were under-reports. Both directions are now pinned, and
the three coordinate checks die under either — they are the strictest cases
because a differential needs the instrument to be right about two runs at once.

### RUNG 1 RESULT — the `defer:` session, RUN 2026-08-16. Two harness defects, and they compound.

The prediction was that gaps would sit in HANDOFFS rather than layers. Both do.
Neither is reachable by the stub proposer; both required a writer.

**DEFECT A — a line's brief states something FALSE about the mandate.**
The loop flagged **L1** for a METER flag (`SLOTS_EXCEEDED`, 11 syllables into 8
slots) and told the writer, under the heading `THE RHYME MANDATE ON L1`:

> `(no rhyme group declared for this line)`

L1 is in group A. `m.groups_of(1)` is `[0]`, label `A`; `m.requirement(1,2)` is
`REQUIRE_RHYME`. MECHANISM, `quality/revise.py:2377`:

```python
wants = any(f.code in RHYME_FINDINGS for f in fs)
if wants and groups:        # populates must_answer / must_rhyme_with
```

`must_answer` is gated on the line carrying a RHYME FINDING, not on the
mandate. L1 carried only meter findings, so the block fell through to a default
sentence that makes a claim about the MANDATE while the true condition is about
FINDINGS. The two are different statements and only one of them is true.

**Consequence, demonstrated:** told no rhyme group existed, the writer rewrote
L1 to fix the meter — `the kitchen light still burns`, 5 syllables — changing
the end word from `four` to `burns`. **The loop ACCEPTED it.** A writer
following the brief exactly silently redefined the word the other half of the
only mandated pair has to answer.

**DEFECT B — the next line's brief then cites the DELETED word, and offers a
field computed against it.** L2's brief displays the current draft correctly:

```
   L1  the kitchen light still burns
>> L2  and nobody came back to climb the stairs
```

and two lines later says `group A [1, 2] — this line must rhyme with: L1
('four')`, followed by **24 offered words** — `war, floor, store, bore,
implore, for, your, are, sure, car, far, anymore, poor, bar, star, nor, tour,
pure, whore, therefore, score, cure, secure, ignore`. Every one answers the
deleted word. MEASURED: `four ~ floor` **1.000 RHYME**; `burns ~ floor`
**0.555 NO_RELATION**. Taking the brief at its word and answering with an
offered word leaves `SCHEME_VIOLATION` standing and the loop re-asks.

**THIS HALF IS DOCUMENTED — AND THE ARGUMENT FOR IT DOES NOT COVER A WRITER.**
`quality/loop.py:741-748` states the tradeoff plainly: one `brief()` per round,
so a later line's candidate list "can go stale mid-round… deliberately not
chased: `verify()` always re-derives the true finding set… so a stale candidate
is simply rejected rather than wrongly accepted — correctness does not depend
on re-briefing every line."

That argument is **sound about acceptance and silent about guidance**. Nothing
wrong is accepted, which is what it claims. But it was written when the only
proposer was the mechanical stub, for which a rejected attempt costs nothing.
**`--propose=defer:` changed the economics of a retry** — the proposer is now a
person or a model — and "rejected rather than wrongly accepted" stops being a
sufficient defence when the rejection follows a 24-word list the harness
offered and the writer had no way to doubt. A stale field is cheap to reject
and expensive to follow.

**How they compound:** B alone would be a bounded annoyance — a stale field
inside one round, self-correcting at the next. A is what lets the end word move
at all, because it is the reason the writer never knew L1 was half of a
mandated pair. Neither is visible to the stub, which never reads the mandate
block and never reasons about a word it was offered.

**Not fixed here, on purpose.** Defect A looks small and local — gate the block
on the mandate rather than on the finding set. Defect B is architecturally
significant: re-briefing per line changes the loop's cost model, and
`loop.py`'s own docstring argues the current shape on measured grounds. That is
a decision to take deliberately, not inside the run that found it.

#### DEFECT A IS FIXED — 2026-08-16, in the next commit and not in this run

The gate is split: `must_answer`/`must_rhyme_with` are populated whenever the
line has a mandated group, and the CANDIDATE FIELD stays behind `wants`.
`brief()`'s own long-standing argument for the second gate — *"a meter-only
line is never handed a list of rhyme words it has no use for"* — is about the
OFFER and is untouched. It also keeps the enforcement honest by construction:
`verify()`'s RULE 3 reads `b.forbidden_modal`, the brief's own list, so a line
offered no field is a line the modal rule does not enforce against, and no
writer is rejected for taking a word nobody forbade. `joint_conflict` stays
inside the field branch — it reports that a search came back empty, and setting
it from a branch that runs no search would be a claim about a search nobody
performed (doctrine 20).

**MEASURED BLAST RADIUS, on this repo's own shipped fixtures rather than on the
probe draft.** Briefed lines that were in a mandated group and carried no rhyme
finding — every one of which the tier-1 prompt told `(no rhyme group declared
for this line)`:

| mandate | briefed lines | newly stated | rate |
|---|---:|---:|---:|
| DECLARED (`mandate_song` 41-char, `song` `ABABCCDDEEFFGGHH`), with and without a blueprint | 106 | 23 | **21.7%** |
| DERIVED (`mandate_from_graph`, three fixtures, with and without a blueprint) | 140 | 32 | **22.9%** |

The two agree to about a point, which is the check that the derived cover's
own bias — it is a fixed point of the grader, so it produces fewer rhyme
findings and would inflate this count — is not what is driving the number
(doctrine 14). **So roughly one briefed line in five was being told the
mandate said nothing about it.** The rate rises with a blueprint declared, as
it must: meter is the layer that flags a line without implicating its rhyme.

**Defect B is still unfixed and still a deliberate decision**, unchanged from
the paragraph above.

`quality/test_revise.py` §40 is 7 checks and fails exactly 2 against the
pre-fix gate, proved by restoring it; the other 5 are the premise and three
controls, which must pass on both trees — including the one that matters most,
that a line in NO mandated group **still** gets the default sentence. The
repair states a fact; it does not delete a line of the prompt. §32's own
`not b1.must_answer` clause carried the identical conflation — it read the
mandate block as a second proof of a claim about the candidate field — and is
repaired in the same commit; it also dies under the same mutant.

### What rung 1 still owes

~~The `--propose=defer:` writer session, `verify`, and the diff — none of which
mean anything until the measurement is rebuilt on `inspect_codes()` and
re-validated against a known answer, exactly as rung 0 was.~~ **REPINNED
2026-08-16.** The rebuild landed at `9a8a426` (9 known-answer cases, two
mutations killing different halves) and the `defer:` session ran against it;
its result is the section above. TWO ITEMS REMAIN, and they are both about the
DENOMINATOR rather than about the draft:

- **`verify` on the before/after pair.** The session ended at exit 4 with
  `SCHEME_VIOLATION` standing, so there is no converged AFTER to verify yet —
  and producing one means answering L2 against `burns`, which is answering a
  question the harness asked wrongly (defect A). ~~Held until the fix
  decision.~~ **The decision is taken and defect A is fixed** (section above),
  so this is no longer held — it needs the session RE-RUN against the repaired
  brief, not waiting on anything.
- **The coverage diff against §A–D.** Deferred for the same reason and NOT
  because it is expensive: a code that fired only because the writer was
  following a false brief is not evidence that a writing session reaches it.
  Scoring this run's codes against the denominator would put defect A's own
  output in the numerator (doctrine 79 — the refusal and the answer are not
  summed, and a wrong answer is neither). **The 2026-08-16 run's codes stay
  out of the numerator whatever happens next** — a repaired harness does not
  retroactively make that session's numbers honest, and a re-run produces its
  own.

That was a HALT, not a completion: rung 1 found what it was built to find at
the first handoff and the ladder does not advance past an instrument reading a
brief the harness got wrong.

**THE HALT NARROWS TO ONE DEFECT, IT DOES NOT LIFT.** Defect B still stands, so
a re-run can still hand a writer a candidate field computed against a word that
is no longer in the draft. What changes is that the writer now knows the line
is half of a mandated pair before they move its end word, which is the
condition under which B was reachable at all on this draft. Whether B fires
without A in front of it is a QUESTION FOR THE RE-RUN and is not answered here
— predicting it would be exactly the reasoning-instead-of-measuring this whole
experiment exists to avoid.

### RUNG 1, RE-RUN — the `defer:` session against the repaired brief, 2026-08-16

Same draft, same fingerprint `385ff1e4055e`, same mandate `AA`, same blueprint
at `--subdivision 2`. **It answers the question the paragraph above declined to
predict, and the answer is the uncomfortable one: B fires HARDER, and A was
hiding it.**

**Defect A does not recur.** L1's brief now reads
`group A [1, 2] — this line must rhyme with: L2 ('stairs')`, live, at exit 4.

**The writer's two answers**, both checked against the harness's own verbs
before submitting (`weight` for the syllable count, `score` for the pair — a
fact that turns out to matter, see the bias note below):

    L1  at four the kitchen light still glares      8 syllables, 8 slots
    L2  and nobody climbed the stairs               7 syllables

`glares ~ stairs` is **1.000 RHYME**. So L1's answer repaired BOTH its own
`SLOTS_EXCEEDED` and the pair's `SCHEME_VIOLATION` in one move.

#### B is worse when A is fixed, because the pair is now CLEAN when it goes stale

In run 1 the stale field pointed at a deleted word and the violation it named
was genuine — the field merely failed to fix. Here the violation has ALREADY
BEEN REPAIRED inside the round, and L2's brief:

1. displays `[flag] SCHEME_VIOLATION … evidence: score 0.612; 'four' ~ 'stairs'`
   — a flag that no longer exists;
2. offers **24 words all answering `four`**, every one of which would BREAK the
   pair that now holds (`glares ~ floor` = **0.612 NO_RELATION**);
3. **FORBIDS `stairs`** — the end word that is now correct — under
   `3. The end word is NOT one of the FORBIDDEN words above … rejects on its
   own.`

So the field would MANUFACTURE the violation the brief claims is standing. A
fixed defect A is what made this reachable: while A stood, the pair really was
broken at this point in the round, and the stale field was merely useless
rather than actively destructive.

#### BOTH PATHS RUN FROM THE SAME SUSPENDED STATE, and the loop inverts

| the writer | L2 answer | outcome |
|---|---|---|
| **ignores** the stale field, keeps the word the brief FORBADE | `and nobody climbed the stairs` | **SUCCESS**, 1 round, md5 `0a394f1f1442` |
| **follows** the brief, takes offered words (`floor`, `star`, `car`) | 3 attempts x 2 rounds | **NO_PROGRESS**, L2 `unresolved`, md5 `01897e80c1e8` |

The rejection, verbatim and identical on every one of the six attempts:
`introduced 1 new flagged finding(s) [(2, 'SCHEME_VIOLATION')] while fixing 3;
a revision may not trade one defect for another`. Round 2 re-asked the same
three `(line, attempt)` keys and the replay served the same answers back, which
is correct determinism and is why `NO_PROGRESS` is the right stop.

**The loop rewards ignoring its own brief and punishes following it**, and the
punished move is the one doctrine 9's machinery explicitly offered.

#### WHY `stairs` SURVIVED RULE 3 — the exact anatomy of B

`verify()` re-derives `b_before` from the lines it is HANDED. The loop hands it
the MID-ROUND draft, where L1 is already `glares`. Measured, that fresh brief
for L2 is:

    must_answer : [('A', [1, 2], [(1, 'glares')])]
    candidates  : 0        forbidden : []
    codes       : CROWDED, PROMINENCE_EXCEEDS_HEADS, SLOTS_EXCEEDED

No rhyme finding, so `wants` is False, so no field and no forbidden list — and
RULE 3, which reads `b.forbidden_modal`, is inert. **The brief a writer READS
and the brief `verify()` ENFORCES are two different objects, and only the
second is current.** `quality/loop.py:741-748` is exactly right about the
second and says nothing about the first; that is the sentence, stated as a
measurement rather than an argument.

Note what let the correct answer through: the field staying behind `wants` —
the half of the defect-A fix that was deliberately NOT changed. Unplanned, and
it is the "keeps the enforcement honest by construction" clause doing real
work.

#### DEFECT C — `revise` and `verify` disagree about the same before/after pair

The `verify` verb, on the draft the LOOP accepted:

    BEFORE: 2 line(s), md5 385ff1e4055e
    AFTER : 2 line(s), md5 0a394f1f1442
    VERDICT: REJECTED
      L2 took the modal candidate 'stairs' …
      fixed: [(0,'EXTRAPOLATED_LENGTH'), (1,'SLOTS_EXCEEDED'),
              (2,'SCHEME_VIOLATION'), (2,'SLOTS_EXCEEDED')]

Same draft, same mandate, same blueprint, same subdivision — **SUCCESS from
`revise`, REJECTED from `verify`.** Root: `b_before` is derived from whatever
`before` the caller passes, the loop passes a mid-round draft and the verb
passes the original, and the modal exclusion is computed against it. So a
writer driving by hand (`brief` then `verify`) gets the opposite verdict from
one driving with `revise`, and the hand-driver is told the right answer is
slop. Doctrine 1, between two surfaces of one module.

#### DEFECT D — `forbidden_modal` carries two rules and the message names the wrong one

`brief()` builds the list as the modal head **plus the incumbent word**:
`joint_field(calls, exclude=(cur,))` then
`if cur and cur not in b.forbidden_modal: b.forbidden_modal.append(cur)`.
MEASURED: `modal_field('four')` is `['door','more','before','shore','sore',
'or']` with and without the exclusion — **`stairs` is not a modal candidate for
`four` under any spelling.** It is on the list only as the word already there.

`verify()`'s rejection nonetheless reads `L2 took the modal candidate
'stairs'`, which is false in its own terms. Two reasons to forbid a word — *it
is the slop direction* and *re-proposing what is there is not a revision* — one
list and one message (doctrine 79's shape, applied to a rejection rather than a
count). Both rules are right; the report cannot say which fired, and here it
names the one that did not.

#### C AND D ARE FIXED — 2026-08-16. TAKING REQUIRES A CHANGE.

RULE 3 now skips a line whose end word is byte-identical before and after.
Doctrine 9 is about REACHING for the obvious answer, and a line that kept its
end word reached for nothing; the revision happened somewhere else in the line
— here, in the meter. Measured on the pair that exposed it, `verify` now
returns **ACCEPTED**, agreeing with the loop:

    BEFORE: 385ff1e4055e   AFTER: 0a394f1f1442   VERDICT: ACCEPTED
      fixed 4, introduced 0, disclosing 4 new note(s) …
      L2 KEPT its end word 'stairs', which is on this line's forbidden list …

**IT DOES NOT WEAKEN THE RULE.** The incumbent clause's real work is done by
RULE 4 one block down: a line that keeps its end word keeps its rhyme finding,
so *"nothing was fixed"* refuses it unless the revision repaired something
ELSE — which is exactly the case this guard exists to let through. Doctrine 7
is why it must be let through: a line already sitting on a conventional word
may still have its METER fixed, and blocking that is the floor ordering the
region it already passed. Control, measured: a revision that really does land
on a modal candidate is still refused in the same words —
`L2 took the modal candidate 'door'`, `modal_violations [(2, 'door')]`, one
reason and nothing else, so the rule still rejects on its own before the
fixed/new accounting.

**THE FIELD IS STILL READ OFF `before`, DELIBERATELY.** Recomputing it against
`after` was the other candidate fix and it is doctrine 48: a revision that
repairs the rhyme clears the finding, so `brief(after)` offers no field, so the
rule could never fire on any accepted revision — a check that cannot fail. The
field belongs to the state in which the line was flagged and a replacement was
being searched for, which is also the field the WRITER was shown, so the offer
and the enforcement stay one object.

**D CLOSES AS A COROLLARY, PROVABLY AND NOT INCIDENTALLY.**
`forbidden_modal` is `modal_head + [cur]` and `cur` IS the `before` end word,
so `got == cur` now implies `got == was` and is skipped. Therefore
`modal_violations ⊆ modal_head` **by construction**, and the sentence "took the
modal candidate" is true of every entry the list can ever hold rather than true
of most of them. §41's last check asserts the subset rather than leaving it as
an argument.

**THE SKIP IS DISCLOSED, NOT SWALLOWED.** `modal_endword_unchanged` carries
the `(line, word)` pairs and the acceptance reasons say so in words, because
"kept a forbidden word" and "was never on the list" are different outcomes
(doctrine 20) and a silent skip would collapse them.

`quality/test_revise.py` §41 is 7 checks and fails exactly 2 with the end-word
test removed; the other 5 are two premises and three controls that must pass on
both trees. The second premise is itself the disagreement made mechanical — the
loop still converges under the mutant while `verify` rejects, which is defect C
reproduced inside the test written to close it.

#### D's SECOND HALF IS FIXED TOO — the field is split, 2026-08-16

The corollary above closed D's *message*. Its *container* stayed merged, and
that half was audited before it was touched — five independent read-only lenses
over consumers, renderers, test blast radius, the same conflation elsewhere, and
checks that pass for an unstated reason, each finding then handed to an
adversary told to refute it. **One of my own framings came back refuted and the
correction is in the record below**, which is the argument for running the audit
rather than trusting the plan.

`forbidden_modal` is the modal head alone; `forbidden_incumbent` is its own
field; every renderer names the rule it is stating.

**THE OBVIOUS PARTITION IS A LIVE REGRESSION, and this is the finding the audit
was worth running for.** `joint_field`'s `exclude=(cur,)` never filtered the
FORBIDDEN half — it builds `drop` and applies it only to the offered `rest` —
so the head contains the incumbent whenever the word already there is genuinely
modal. MEASURED: **2 of 2 briefed lines** on this repo's own `MODAL_DRAFT`
(`down` at index 0 for the call `town`, `more` at index 1 for `four`). Writing
`[w for w in forb if w != cur]` would therefore DROP a genuine modal-head
member on both, and `verify()` would stop rejecting a revision that moves a
DIFFERENT line onto that word. The fields overlap on purpose; what they no
longer do is answer for each other.

**THE LOAD-BEARING EDIT IS RULE 3's GATE, NOT THE DECLARATION.** Gating the
loop on `forbidden_modal` alone would `continue` past every line whose only
exclusion is its incumbent, emptying `modal_endword_unchanged` and deleting the
doctrine-20 disclosure that had shipped hours earlier. The audit measured this
by monkeypatching the split at runtime before any file was edited: `[(2,
'stairs')] → []`. RULE 3 now reads a field per branch.

**MY OWN CLAIM, REFUTED.** I recorded D as "no consumer can tell a modal-head
entry from the incumbent". That is false: `verify()` already told them apart,
because `got == was` IS `got == cur`. The real, narrower defect is that nothing
could tell whether an entry EQUALING the incumbent is ALSO a head member — and
that the RENDERERS never distinguished the rules at all. Recorded rather than
quietly reworded (doctrine 17).

**THREE FALSE SENTENCES, ONE OF THEM WRITTEN THE SAME DAY BY THE C FIX.** The
tier-1 prompt's `do not end L{n} on any of these` is false of a word the line
KEEPS, so it is `do not MOVE TO`; `Taking any one of them is REJECTED
OUTRIGHT` was true of the head and false of the incumbent; and RULE 3's own new
comment claimed *"The LAST entry is `brief()`'s incumbent clause"*, which is
false whenever the incumbent is already modal — on `MODAL_DRAFT` the last
entries are `renown` and `or`. Nothing indexed `[-1]`, so the code was never
wrong and the prose was.

**AND THE SPLIT MADE A THIRD CAUSE SAYABLE.** `candidates == []` means one of
three things and the prompt enumerated two; in the third — every answering word
is inside the modal head — both stated causes were false at once. It could not
be named while the head also carried the incumbent.

**THE TEST THAT PASSED FOR THE OTHER RULE.** §2's check named the incumbent
clause and evidenced it with `"fire" in b.forbidden_modal` — which passes, but
`fire`/`desire` is the canonical modal pair, so `fire` is head[0] on its own
merits and would sit there with the incumbent clause deleted entirely.
Repointed at the new field, with the overlap asserted beside it.

**AND A DRIFT HAZARD ONE LAYER OUT.** `quality/test_propose.py`'s `class B`
enumerates `Brief`'s fields by hand and `render_line` reads them through
`getattr(..., default)`, so a stand-in that has not grown a field renders the
new rule as an EMPTY BLOCK — no error, no red — and a writer-facing rule
disappears with the suite green. `PB`/`PairBrief` already had that guard;
`B`/`Brief` did not. It does now, and it fails under mutation.

§42 is 10 checks. `test_revise` 295→ with §42, `test_propose` 107→109,
`test_loop` and `test_verbs` unmoved in count.

#### THE AUDIT OUTLIVED THE COMMIT, and it caught a defect the split INTRODUCED

The workflow was killed by a worker restart at 35 agents / 3.4M tokens, with
the Audit phase complete and Verify at 16 of 30. **Five of the sixteen verdicts
came back REFUTED, and I had read exactly one of them before shipping.**
Harvesting the rest found three things worth having.

**A DEFECT I INTRODUCED, and it is the same class as the one I was fixing.**
`quality/propose.py`'s empty-head branch prints *"(none — no modal head was
computed for this line)"*, and after the split that is FALSE on two reachable
populations: a JOINT-CONFLICT pivot, where `joint_field` ran over every call
word and returned nothing — on `SILVER_MIND` L3 the same prompt says *"nothing
in the lexicon answers all of those groups at once"* eleven lines above, so it
contradicted itself — and `modal_exclusion=0`, where `ranked[:0]` is empty on
EVERY line while the field is fully computed (2 of 2 on `CLICHE`, each with 24
candidates offered). **Before the split both printed the incumbent under "the
most predictable answers in this field" instead**, so one false sentence was
traded for another. `Brief.field_computed` is the third state, and the branch
now says which.

**MY OWN RATE WAS A FIXTURE, NOT A RATE.** I recorded "2 of 2 briefed lines on
`MODAL_DRAFT`", which is true and reads as though the overlap is typical. An
adversary refuted the load-bearing reading — that the overlap is *why* the
blast radius is small. Re-measured over the two shipped lyric fixtures under
their declared mandates: the incumbent is inside its own head on **10 of 18**
briefed-with-field lines (55.6%), and **on the lines carrying
`SCHEME_VIOLATION` — the population this loop exists to revise — it is 0 of
8.** A line the loop is working on does not have its end word in its own modal
head, because that is what a violated pair means. The overlap is a property of
lines that are already fine; the split changes the field on every line that is
not; and the small test churn was never evidence that little changed.

**AND THE `B`/`Brief` GUARD DID NOT COVER WHAT I CLAIMED.** It pins the stub
CLASS to the dataclass's field list — but every fixture in `test_propose.py`
left `forbidden_incumbent` at the default, so the entire writer-facing
statement of rule 2 could still be deleted with that suite green. A pinned
class says nothing about an INSTANCE that never sets the field. `PLAIN_BRIEF`
and `PIVOT_BRIEF` carry it now and §2 asserts the block.

**THREE MORE, ALL "PASSES FOR AN UNSTATED REASON".** `verify()`'s new
kept-branch guard `got == b.forbidden_incumbent` can never be false when
reached — doctrine 48 inside the fix — and is replaced by the invariant stated
in a comment, with §42's precision check as the thing that would go red.
§22's `if w == cur: continue` was written for the merged field and now discards
10 genuine head words from its own sample. And §2's `modal_exclusion=0` check
was a strict length inequality that passed while the "disabled" list still held
one entry — the same false sentence `mutate.py`'s QR2 rationale carried; it
asserts `== 0` now.

**ONE LATENT DIVERGENCE, MEASURED AND NOT "FIXED".** The three spellings of the
incumbent rule are built from different functions. Over 881 real lines of
`corpus/song/eng_*`, `raw_final_token` and `line_anchors` agree on **0.00%**
— one spelling in two places — while both differ from `_endword` on **7.83%**
(69 of 881), on CASE (`'Lee'`/`'lee'`). It is LATENT, not live: `joint_field`
lowercases its own `exclude`, so the difference is absorbed at the one site
that consumes tier 2's values. Recorded as a hazard with a number rather than
repaired, because nothing is broken today and the honest claim is the narrow
one.

**TWO SIBLINGS FOUND AND NOT FIXED**, recorded at `BACKLOG.md` §4.8:
`quality/loop.py` prints `"no candidates offered"` when the PROPOSER declined
(reproduced with `brief.candidates` holding 24 words), and
`LoopResult.unresolved` merges a FLAG with a pursued NOTE against its own
comment. Folding a second module's report semantics into this commit would make
the mutation evidence for either half unreadable.

#### THE COVERAGE DIFF IS STILL NOT SCORED, and the reason is now about the WRITER

**The SUCCESS arm is contaminated and the contamination is me.** I checked
`score glares -- stairs` outside the loop and I already knew defect B existed,
so I knowingly ignored a FORBIDDEN list I had reason to distrust. A writer who
trusts the harness cannot do that. The honest measure of what this harness does
to such a writer is the other arm: **NO_PROGRESS, L2 unresolved, six answers
spent, final draft carrying its original second line.**

So this run's codes stay out of the numerator too — not because a defect
produced a wrong answer, as in run 1, but because the run that converged did so
by routing around the instrument. That is the bias control this
pre-registration named in §"bias controls" and it is firing on its author.
Scoring coverage needs a rung whose writer has no privileged knowledge of the
harness's defects, which is a condition on the SESSION and not on the draft.

### RUNG 1 — COMPLETE. The blind run, and the coverage diff, 2026-08-16

The two earlier `defer:` sessions were written by an author who knew every
defect in the harness, so neither could be scored (§"the coverage diff is still
not scored"). This one was written by an agent with **no session history, no
repository access and no tools** — it was handed the rendered `pending.prompt`
text and nothing else, and answered from that alone (`tool_uses: 0` on both
turns). Repo access was withheld deliberately: `CLAUDE.md` now documents
defects A–D in full, so a writer allowed to read the tree would have been
handed the answer key.

That also sharpens the question from "can a writer converge" to **"is the brief
sufficient on its own"**.

Same draft, same fingerprint `385ff1e4055e`, mandate `AA`, blueprint at
`--subdivision 2`.

    L1  the kitchen light is on their chairs
    L2  and no one came back up the stairs        md5 c70eb712783e

**SUCCESS after 1 round, 2 answers, 0 rejections.**

#### THE BRIEF WAS SUFFICIENT, AND DEFECT B FIRED ANYWAY

B fired exactly as before and on an independent writer, which is what makes it
a property of the harness rather than of how I write: after L1 moved to
`chairs`, L2's brief still showed `SCHEME_VIOLATION … 'four' ~ 'stairs'`, still
said `must rhyme with: L1 ('four')`, and still offered 24 words answering
`four` — while the true pair `chairs ~ stairs` was **1.000 RHYME**, already
repaired.

**The writer converged anyway, and the reason is the defect-D fix.** It kept
`stairs` and shortened the line for meter — it never touched the stale field.
The block that told it that was legal is `THE WORD ALREADY THERE`, added hours
earlier when the two rules were split: *"keeping the word you were given takes
nothing … a line that keeps it is refused by rule 4 UNLESS the rewrite repaired
something else — a meter finding, say — in which case keeping it is accepted."*
So the D repair gave a blind writer a correct path that did not require
trusting the half of the brief B corrupts. Not designed for that; measured.

#### THE FOUR CELLS — scored from §A4's own table, never summed

The denominator is parsed out of §A4 in this file rather than re-derived, so
the score cannot drift from the record. The parse returns **94 codes, 52
EXPECTED-REACHABLE**, reproducing this document's own "rung 1 tests at most 52
of 94" exactly.

| cell | count |
|---|---:|
| `FIRED` ∩ EXPECTED-REACHABLE | **12 of 52** |
| `SILENT` ∩ EXPECTED-REACHABLE | **40** ← headline |
| `FIRED` ∩ DECLARED-UNREACHABLE | **0** |
| observed outside §A4 entirely | **0** |

FIRED: `CROWDED`, `EXTRAPOLATED_LENGTH`, `FUNCTION_UNDECLARED`,
`HOOK_UNDECLARED`, `MODAL_RHYME`, `NO_SETTING`, `PROMINENCE_CANNOT_ALIGN`,
`PROMINENCE_EXCEEDS_HEADS`, `SCHEME_VIOLATION`, `SHARED_SUFFIX`,
`SINGLE_INSTANCE`, `SLOTS_EXCEEDED`.

**THE TWO ZERO CELLS ARE THE RESULT MOST WORTH KEEPING.** Nothing fired that
the model declared unreachable, and nothing fired that the model does not list
at all. §A4's reachability marks — written before any draft — held exactly,
which is the pre-registration doing the one job a pre-registration exists for.

**AND 40 IS NOT 40 DEFECTS. Saying so is not a hedge, it is the definition.**
`EXPECTED REACHABLE` was assigned as *"a two-line draft CAN reach this"*, not
*"this draft WILL"*. `UNREADABLE_END_WORD` needs an unreadable word;
`CLICHE_PAIR` needs a cliché; `NO_SUBDIVISION` fires only when a subdivision is
NOT declared, and this run declared one. So the 40 is the honest measure of a
different quantity: **how much of the reachable surface one ordinary writing
session touches — 23%.** The experiment's own hypothesis was that gaps where
the program does not force usage are where it is soft, and this is that number.

**WHAT SEPARATES THE TWO POPULATIONS IS THE NEXT MEASUREMENT AND IS NOT DONE.**
Of the 40, some need a different DRAFT (a cliché pair, an OOV word), some need
a different DECLARATION at the same rung (`--cliques` for
`MANDATE_NOT_INDEPENDENT`, omitting `--subdivision` for `NO_SUBDIVISION`, a
declared hook for `HOOK_ABSENT`), and some may be marked `R2` and be reachable
by NO rung-1 configuration at all — that last set is the only one that is a
finding about the harness, and it is unmeasured. It is a mechanical sweep over
declarations, not a writing task, so it does not need a blind writer.

#### ONE MORE DEFECT, FOUND IN THE PROMPT BEFORE THE WRITER ANSWERED

`THE WORD ALREADY THERE` printed *"(none — this line has no readable end word
to keep)"* on L1 — whose end word is `four`, plainly readable. The incumbent is
only recorded where the FIELD is computed, and L1 carried a meter flag and no
rhyme finding, so an empty value stated the wrong reason for being empty. That
is the twin of the empty-head branch repaired the same day, one rule down, and
it was fixed after the run rather than during it: the harness must not move
while it is being measured. Three states there too now, and the no-field case
says explicitly that it implies nothing about readability.

**RUNG 1 IS COMPLETE.** It cost six harness defects (A, B, C, D, and the two
renderer twins), of which five are fixed and B stands as a declared decision.

### THE DECLARATION SWEEP — what the 40 SILENT actually were, 2026-08-16

The writing session's 40 silent codes conflate two populations, and only one is
a fact about the harness: *"a different two-line configuration would trip this"*
versus *"no rung-1 run can trip this at all, despite the `R2` mark"*. The second
is a mis-marking or a dead check — the shape that already caught `NO_TEMPO`.
Separating them needs no writer and no bias control, because it varies the
DECLARATIONS and the draft's SHAPE, never the quality of the writing. That is
what `R2` was defined to mean: *a two-line draft CAN reach it*.

**36 configurations, in two rounds plus one correction.** Round 1 was 23 broad
configurations — omitting `--subdivision`, omitting the blueprint, `--cliques`,
`--isochronous`, `Subdivision(1)`, zero-duration and out-of-cycle and
overrunning and overlapping spans, an 8-bar section with 2 bars sung, a 7/8
meter, declared hooks and titles, OOV end words, hyphenated pieces, a cliché
pair, a repeated end word, anaphora. Round 2 was one configuration aimed at
each code still silent.

| stage | EXPECTED-REACHABLE reached |
|---|---:|
| the blind writing session | 12 of 52 |
| after round 1 (23 configs) | 40 of 52 |
| after round 2 (12 configs) | 51 of 52 |
| after one correction | **52 of 52** |

**THE RESIDUE IS ZERO, AND THAT IS THE RESULT.** Every code the
pre-registration marked `R2` or `R2*` is reachable by some rung-1
configuration. Nothing is mis-marked; no reachable check is dead at this rung.
Combined with the session's own two zero cells — nothing fired that was marked
unreachable, nothing fired that §A4 does not list — **the reachability model
written before any draft existed is correct in both directions across 36
configurations.** That is the strongest thing this experiment has produced, and
it is a negative result: there was nothing rotten behind the 40.

**THE LAST ONE TOOK TWO ATTEMPTS AND THE FIRST WAS MY ERROR, not the
harness's.** `HOOK_PLACEMENT_UNDECLARED` needs a hook that RECURS into sections
that declare no function; my first attempt declared `function: "chorus"`, so
the hook was placed, and it occurred once, so `HOOK_DOES_NOT_RECUR` fired
instead. With the hook in both lines and the section's `function` omitted it
fires immediately. Recorded because a single failed attempt looked exactly like
a dead check for as long as it took to read the emission site — which is the
argument for chasing a residue to zero rather than reporting it.

**SO THE 23% STANDS AND ITS MEANING NARROWS.** One ordinary writing session
touches 12 of 52; the whole 52 is reachable, but only under deliberate,
adversarial configuration — 36 hand-built cases against 1 song. The gap is not
harness rot. It is that **nothing about writing a song exercises the surface**,
which is the hypothesis this experiment was built to test, now measured rather
than argued: a writer cannot be relied on to reach a check, so every check has
to be reachable by a test that does not depend on one.

## RUNG 2 — PRE-REGISTERED 2026-08-16, BEFORE ANY DRAFT EXISTS

Everything below is written before a line is drafted, a blueprint declared or
a writer spawned. That is the only property that makes the classification in
§R2.3 worth anything: rung 1 earned the right to be believed here by having
its own marks come back correct in both directions across 36 configurations,
and the way to keep that is to be able to be wrong in public.

### R2.1 The draft specification, fixed in advance

**8 sung lines, 3 sections, and the chorus RETURNS.** That last clause is the
whole reason rung 2 exists — a couplet cannot have a second instance of
anything, so the entire return/reprise layer was unreachable at rung 1 by
construction, not by accident.

    CHORUS   2 lines   function="chorus"
    VERSE    4 lines   function="verse"
    CHORUS   2 lines   function="chorus"   -- VERBATIM return of lines 1-2

Declared alongside it: a **hook** (a fragment, present in the chorus), a
**title**, a per-section **meter**, `--subdivision 2`, and a mandate covering
the verse's rhyme plus `--returns=` naming the chorus pair. A 2-line chorus is
thin as songwriting and is chosen anyway: it is the SMALLEST shape in which
"does this come back, and did it come back unchanged" is a question the
harness can be asked at all, and rung 2's job is to make that question
sayable, not to be a good song.

**WHY NOT 12 LINES.** Every extra line costs a full `inspect()` in the loop
and rung 1 measured 30s for 41 lines with a warm cache; 8 keeps a blind
writer's session inside a handful of turns. If the classification below is
wrong in the direction of "needs more", rung 3 is where that is paid.

### R2.2 Bias controls — BLIND FROM LINE ONE

Rung 1's first two sessions were unscoreable because I wrote them knowing
every defect in the harness, and the coverage number only became honest on the
third attempt with an outside writer. Rung 2 therefore fixes the protocol in
advance:

- every prompt goes to a writer with **no session history, no repository
  access and no tools** — the rendered `pending.prompt` and nothing else;
- **I never touch the draft**, at any point, including to "unstick" it;
- if the writer stalls, that is a RESULT about the brief and is recorded as
  one, not repaired by me stepping in;
- repo access is withheld specifically because `CLAUDE.md` now documents
  defects A–D and their fixes in full — a writer allowed to read the tree
  would be handed the answer key.

### R2.3 THE FALSIFIABLE CLAIM — which of the 34 `NM` codes rung 2 reaches

Marked now, per code. **`R8` = reachable at this rung's declared shape · `R3`
= still needs a fuller song.** The headline check afterwards is the same pair
of cells rung 1 used: an `R8` code that stays SILENT after the declaration
sweep is a mis-marking, and an `R3` code that FIRES is the model being wrong
in the other direction.

**Reachable at rung 2 (`R8`) — 19 predicted.** The return family, which a
second chorus instance makes sayable for the first time: `RETURN_LOCKED`,
`RETURNS_WITH_SAME_WORDS`, `RETURN_LENGTH_DRIFT`, `RETURN_METER_DRIFT`,
`RETURN_SLOT_DRIFT`, `RETURN_SCHEME_DRIFT`, `STUB_RETURN`,
`GROUPS_DECLARED_RETURN`, `SINGLE_USE_RECURRED`, `HOOK_CONFINED`,
`HOOK_PLACEMENT_PARTLY_UNDECLARED`, `END_WORD_UNREADABLE`. The collision
family, which needs enough cross pairs to have an unmandated one:
`SCHEME_COLLISION`, `NEAR_COLLISION`, `REPEAT_ACROSS_GROUPS`,
`COLLISION_CUT_IS_SCALAR_ONLY`. The overlap family, which needs a line in two
groups: `MANDATE_EXCUSED_BY_OVERLAP`, `MANDATE_GROUPS_INDISTINGUISHABLE`. And
`RADIF_LICENSED`, which needs a repetend closing two pairs.

**Still needs rung 3 (`R3`) — 15 predicted.** The reprise family, because a
reprise is a relation between two DIFFERENT declared functions and this shape
declares only verse and chorus: `CROSS_FUNCTION_REPRISE`, `REPRISE_IS_NOT_
LATER`, `REPRISE_SIDE_HAS_NO_WORDS`, `REPRISE_STUB`. The shape-lock family,
because uniformity across sections cannot be measured with three:
`QUATRAIN_LOCK`, `SECTION_LENGTH_LOCKED`, `DOWNBEAT_LOCKED`,
`UNIFORM_ANACRUSIS`, `PHRASE_LENGTH_LOCKED`. `BRIDGE_IS_A_VERSE`, which needs
a bridge. `PREDICTABLE_RHYME`, which needs ≥108 tokens. And the four
comparator/refusal codes whose own table entry already scopes them to the
`function` verb or to a channel this path does not measure: `NO_COMPARATOR`,
`CHANNEL_NOT_MEASURED`, `NO_RHYME_KEY`, `PROMINENCE_UNDECIDED`.

So **rung 2's denominator is 52 + 19 = 71 of 94**, and the 8 `NC` codes plus
15 `R3` codes are declared unreachable in advance.

### R2.4 Predicted refusals, written down so a surprise is legible

The declared shape answers `function`, `hook` and `title`, so rung 1's four
loudest refusals — `FUNCTION_UNDECLARED`, `HOOK_UNDECLARED`,
`TITLE_UNDECLARED`, `SINGLE_INSTANCE` on the chorus — should all go quiet, and
`SINGLE_INSTANCE` should survive on the VERSE alone. `NO_SETTING` stays: there
is still no audio and no beat grid, and R5 is permanent. If
`FUNCTION_UNDECLARED` fires anyway, the blueprint reader is not seeing a
declaration this spec makes.

### R2.5 Standing predictions about WHERE the defects will be

Rung 1's six defects were ALL in the handoff between harness and writer —
brief, prompt, verdict, report — and NONE in a checking layer. Those handoffs
are now repaired, so the prediction for rung 2 is that its yield moves:

1. **The return layer's own reports are the most likely site**, because
   `compare_returns` has never once been driven by a writing session — every
   test of it constructs its input directly.
2. **A second prediction, riskier and therefore worth writing down:** the
   VARIATION_KINDS ladder will name a kind that the loop can neither ask for
   nor act on, the same shape `HOOK_ABSENT` had — a finding with no move.
3. **And a null prediction:** the per-line re-brief landed hours ago and has
   never run against a draft with a returning section. If defect B's fix has a
   bug, a chorus whose two instances must stay identical is where it surfaces,
   because fixing instance one changes what instance two must match.

### R2.6 What would falsify the setup rather than the harness

If the blind writer cannot converge at all, the honest reading is FIRST that
the brief is insufficient at this shape — a rung-2 brief carries return and
hook material a rung-1 brief never did — and only SECOND that the draft spec
is too tight. Rung 1 has one precedent for each, so neither gets assumed.

### R2.7 RUNG 2 — RUN 2026-08-16. The prediction is FALSIFIED on two codes.

**The seed was written blind and it PASSED.** A writer with no session
history, no repository access and no tools (`tool_uses: 0`) was given the FORM
from §R2.1 and nothing else — not a subject, not an example, not a word of
mine — and returned eight lines, a title and a hook. I built the blueprint
around them and edited nothing.

    i keep the porch light on for you        md5 fb9b542845c7
    in case the long road lets you through
    your coat still hangs behind the door
    the kettle knows your name
    i sweep the same three feet of floor
    the radio plays the same
    i keep the porch light on for you
    in case the long road lets you through

`brief` reports **0 FLAG, 32 NOTE**; `revise` returns **SUCCESS after 0
rounds** with the draft UNCHANGED.

**THAT IS ITSELF A RESULT AND IT COST RUNG 2 ITS REVISION PATH.** Rung 1's
spec deliberately seeded a draft that failed its own mandate, so the loop had
work and every handoff got exercised. Rung 2's spec did not, and a competent
writer given only the form satisfied all five declared groups on the first
attempt. The whole write-check-fix cycle therefore ran zero times in the
writing session. A future rung either seeds a failing draft on purpose — which
is a spec decision, not something the measurer may do afterwards — or accepts
that a clean seed measures the REPORT and not the LOOP.

#### The four cells, against the pre-registered denominator of 71

| cell | count |
|---|---:|
| `FIRED` ∩ denominator (52 `R2` + 19 `R8`) | **12 of 71** |
| `SILENT` ∩ denominator | 59 |
| **`FIRED` ∩ `R3` — the falsification cell** | **2** |
| `FIRED` ∩ `NC`, and codes outside the model | **0**, **0** |

#### THE PREDICTION IS WRONG, SPECIFICALLY, AND THE ERROR IS INSTRUCTIVE

`DOWNBEAT_LOCKED` and `PHRASE_LENGTH_LOCKED` were both marked `R3` — *"the
shape-lock family, because uniformity across sections cannot be measured with
three"* — and both fired at rung 2. **The error is that I filed all five
shape-lock codes under one argument and two of them are not about sections at
all.** Their own evidence says so: *"every line starts on beat one"* and
*"every line is the same length in beats"*. That is uniformity across LINES,
and eight lines supplies it.

**AND THEY FIRED OFF MY DECLARATION, NOT THE WRITER'S WORDS** — the finding is
stamped `[SHAPE: read off the DECLARED grid — bars, meters and line
placement]`, and the grid is mine: I gave every line `beat: 1, duration: 4`,
which is maximally uniform. So the layer is correct, my reachability argument
was lazy, and the trigger is a blueprint I wrote. All three are worth saying
separately (doctrine 79) rather than collapsing into "prediction missed".

The three still marked `R3` on the same argument — `QUATRAIN_LOCK`,
`SECTION_LENGTH_LOCKED`, `UNIFORM_ANACRUSIS` — are NOT repinned here, because
this run did not test them and correcting a mark by analogy is how the
original error was made.

#### The declaration sweep, round 1 — and a monotonicity shortcut

Reachability is MONOTONE IN LENGTH: any code a two-line draft can reach, an
eight-line draft containing those two lines also reaches. So rung 1's 52 are
reachable at rung 2 by construction and need no re-sweeping, and the sweep
chased the 19 `R8` alone. Eight configurations, varying the mandate, the
return declaration, the hook's placement, section functions, meters, line
slots and one OOV end word — **the eight sung lines are the writer's
throughout and were never edited.**

**9 of 19 `R8` reached.** Ten remain: `COLLISION_CUT_IS_SCALAR_ONLY`,
`GROUPS_DECLARED_RETURN`, `HOOK_CONFINED`, `MANDATE_EXCUSED_BY_OVERLAP`,
`NEAR_COLLISION`, `RADIF_LICENSED`, `RETURNS_WITH_SAME_WORDS`,
`RETURN_LENGTH_DRIFT`, `SINGLE_USE_RECURRED`, `STUB_RETURN`.

**THE RESIDUE IS NOT A FINDING YET, and rung 1 is the reason to say so
out loud.** That sweep needed a second round plus a correction to get from 12
to 52, and its last survivor looked exactly like a dead check until the
emission site was read — the failure was my configuration, not the harness.
Ten after one round is an ordinary round-1 number. Round 2 is owed.

#### What prediction 3 got, and what it did not

The forced-loop variant (mandate `1,3;2,4` against returns `1,7;2,8` — a
declaration change, no words touched) made the loop work: **SUCCESS in 1
round, fixing L3 and L4**. It chose to move the VERSE rather than break the
verbatim chorus, which is the right answer and is the re-brief operating on a
draft with a returning section for the first time. But it never had to choose
between fixing a line and preserving a return, so the collision prediction 3
names is still untested. That needs a mandate that can only be satisfied by
editing a chorus line, and it is owed with the sweep's round 2.

### R2.8 Sweep rounds 2–3, prediction 3, and RUNG 2's ACTUAL YIELD

**15 of 19 `R8` reached.** Round 2 took four more (`HOOK_CONFINED` by naming a
hook that recurs more than twice, `RETURN_LENGTH_DRIFT` by giving chorus 2 one
line, `SINGLE_USE_RECURRED` by declaring `reprise` twice — its own
`recurrence` is `"once"` — and `GROUPS_DECLARED_RETURN` by merging two groups
the mandate declares a return). Round 3 took two more once I read the emission
sites instead of guessing, which is rung 1's lesson applied on purpose:

- `RETURNS_WITH_SAME_WORDS` fires when a function whose `returns_as` is **"new
  words"** returns VERBATIM. That is a VERSE, not a chorus. L1–L2 and L7–L8
  are identical, so declaring those two sections as verses is the whole trick.
  My round-2 attempt reordered the words instead, which is the wrong axis.
- `MANDATE_EXCUSED_BY_OVERLAP` needs BOTH endpoints of the failing pair to
  fully answer another group — the excusal is PER LINE (`grade()`'s own
  argument). Round 2 gave only one endpoint a second group.

**THE FOUR THAT REMAIN ARE OUT OF REACH BY PROTOCOL, NOT BY DEFECT.** Every
one needs the DRAFT'S WORDS to contain something, and §R2.2 forbids the
measurer from editing them:

- `NEAR_COLLISION` and `COLLISION_CUT_IS_SCALAR_ONLY` need an unmandated pair
  that scores ≥ 0.9 and is NOT a rhyme. MEASURED on this draft: **every one of
  its eight cross pairs at ≥ 0.9 is RHYME or REPEAT** — `you`/`through`,
  `door`/`floor`, `name`/`same` and the two verbatim repeats. There is no
  near-relation in it to collide. This is a fact about the writer's words, and
  no declaration reaches it.
- `STUB_RETURN` needs a line that is an ABBREVIATED POINTER — *"an abbreviated
  reference is a POINTER, not a reproduction"* — the printer's `[Chorus]`
  convention. A declaration cannot manufacture one.
- `RADIF_LICENSED` needs a repetend the floor recognises; not reached by
  `repeat_licence="refrain"` alone, and its exact trigger is identified but
  UNCONFIRMED. This one is the weakest of the four and is owed a read.

  **THE READ IS PAID, 2026-08-17, AND THE CLASSIFICATION HOLDS.**
  `SlopFloor._relation_findings` licenses a run when BOTH conditions hold: the
  same trailing token-run closes **at least 2** mandated pairs, AND its share
  of all mandated pairs is **at or above `radif_min_pair_fraction`, declared
  0.50**. The run is taken from `QualityFeatures._strip_radif`, which is what
  exposes the qafiya underneath — so the finding is a statement about
  IDENTICAL TRAILING WORDS across half the pairs, and the rhyme is then scored
  on what precedes them. `repeat_licence="refrain"` is a different switch and
  does not reach it.

  **So it is words-bound, and now mechanically so rather than by assertion.**
  The declared coordinate is a FRACTION of pairs carrying a repetend; lowering
  it cannot manufacture a repetend that is not in the draft, and doctrine 14
  forbids defining it in terms of the quantity it controls. MEASURED on rung
  3's draft: 13 mandated pairs, **zero** repetends of any length, so no value
  of `radif_min_pair_fraction` reaches it. The debt this entry recorded is
  discharged; the code stays in the words-bound set for a stated reason.

**PREDICTION 3 IS ANSWERED, AND IT IS A NULL.** Forced with a mandate
satisfiable only by touching a chorus line (`--groups=1,4;4,6
--returns=1,7`), the loop **backtracked through tier 2** — changed L4 AND its
anchor L6, keeping the verbatim chorus intact — and reached SUCCESS in one
round. It never chose to break the return. The re-brief landed the same day
and this is the first time it has run against a returning section under a
conflict; it behaved correctly.

#### RUNG 2 FOUND ZERO HARNESS DEFECTS, and that is the headline

Rung 1 found six. Rung 2 found none. Its entire yield is **one falsified
prediction, which was mine** (`DOWNBEAT_LOCKED` / `PHRASE_LENGTH_LOCKED`
marked `R3` on a lazy argument), and **one protocol limit** (four codes
reachable at this shape but not on this draft's words). The three standing
predictions in §R2.5 all came back null: the return layer's reports were
correct under seven configurations, no `VARIATION_KINDS` member turned out to
be unaskable, and the re-brief handled a returning section correctly.

**THE MOST LIKELY EXPLANATION IS NOT THAT THE RETURN LAYER IS CLEAN.** It is
that rung 2 never exercised the handoff, because the blind writer's seed
passed and the revision path only ran under declarations I authored. Rung 1's
six defects were ALL in the handoff, and rung 2's writer never had to receive
a brief, act on it and be graded. **A rung that does not make the writer work
does not test the thing rung 1 found defects in** — which is the real lesson
for rung 3's spec, and it is a lesson about the EXPERIMENT rather than about
the harness.

## RUNG 3 — PRE-REGISTERED 2026-08-16, BEFORE ANY DRAFT EXISTS

### R3.1 The draft specification, and the ONE change rung 2 earned

**A full song: 7 sections, 26 lines, ≥ 108 tokens.**

    INTRO      2 lines   function="intro"
    VERSE 1    4 lines   function="verse"
    CHORUS 1   4 lines   function="chorus"
    VERSE 2    4 lines   function="verse"
    BRIDGE     4 lines   function="bridge"
    CHORUS 2   4 lines   function="chorus"    -- returns
    OUTRO      4 lines   function="outro"     -- reprises the INTRO

Seven sections give the shape-lock family something to measure uniformity
across; an intro/outro pair is what makes a CROSS-FUNCTION REPRISE sayable at
all; a bridge is what `BRIDGE_IS_A_VERSE` needs; and ≥108 tokens is
`PREDICTABLE_RHYME`'s own stated floor.

**THE SEED IS SPECIFIED TO FAIL, and this is the change.** Rung 2's writer was
given the complete form and produced a draft that satisfied every declared
group first time, so `revise` returned SUCCESS in 0 rounds and **the loop ran
zero times**. Rung 1's six defects were all in the handoff between harness and
writer; rung 2 found none, and the most likely reason is that its writer never
had to receive a brief, act on it and be graded. A rung that does not make the
writer work does not test the thing rung 1 found defects in.

**HOW THE FAILURE IS GUARANTEED WITHOUT ME TOUCHING A WORD.** The writer is
told the SHAPE and the WITHIN-SECTION rhyme scheme. The harness then grades
against a declaration that is STRICTER than what the writer was shown — a
cross-section mandate tying chorus line 1 to verse line 1, plus `--returns=`
on the chorus and `--subdivision 2` against a bar grid the writer is not given
a syllable budget for. Declarations are mine; words are the writer's; the gap
between what a writer was told and what a producer's chart actually demands is
the ordinary condition of songwriting, not an artificial cruelty. Rung 1 set
the precedent by specifying a seed that failed its own mandate.

### R3.2 Bias controls — unchanged from rung 2, plus one addition

Blind from line one: no session history, no repository access, no tools, the
rendered prompt and nothing else, and I never touch the draft including to
unstick it. **NEW: the writer is not told the stricter declaration**, and that
withholding is recorded here in advance so it cannot be mistaken later for an
oversight. If the writer stalls under it, that is a RESULT about the brief.

### R3.3 THE FALSIFIABLE CLAIM

Rung 2 established that reachability is MONOTONE IN LENGTH, so all 71 of rung
2's denominator carry forward untested. The claim is about the 15 codes marked
`R3` — **minus the two rung 2 already falsified** (`DOWNBEAT_LOCKED`,
`PHRASE_LENGTH_LOCKED`, which fired at eight lines and are hereby repinned
`R8`), leaving 13:

**Reached at rung 3 (10 predicted):** `CROSS_FUNCTION_REPRISE`,
`REPRISE_IS_NOT_LATER`, `REPRISE_SIDE_HAS_NO_WORDS` (a declared instrumental
section), `QUATRAIN_LOCK`, `SECTION_LENGTH_LOCKED`, `UNIFORM_ANACRUSIS`,
`BRIDGE_IS_A_VERSE`, `PREDICTABLE_RHYME`, `NO_COMPARATOR`,
`PROMINENCE_UNDECIDED`.

**NOT reached, and the reason is the SURFACE rather than the length (3):**
`CHANNEL_NOT_MEASURED` and `NO_RHYME_KEY` are scoped by their own table entry
to the `function` verb, which is not on the writing path at any rung;
`REPRISE_STUB` needs an abbreviated pointer in the WORDS, the same
words-bound limit rung 2 hit.

**CARRIED FORWARD UNRESOLVED — rung 2's four words-bound codes.**
`NEAR_COLLISION`, `COLLISION_CUT_IS_SCALAR_ONLY`, `STUB_RETURN` and
`RADIF_LICENSED` need the draft to CONTAIN something. A 26-line song is far
likelier than an 8-line one to hold a near-relation pair, so the first two are
predicted to fire **without any declaration aimed at them** — and if they do
not, that is the second measurement of the same limit rather than a defect.

**SETTLED AT RUNG 3, TWO OF FOUR (see §R3.7).** `NEAR_COLLISION` and
`COLLISION_CUT_IS_SCALAR_ONLY` FIRED, with no declaration aimed at them, on
`'ear'~'chair'` and `'ear'~'there'` at 0.927 — the prediction as written. The
other two remain words-bound and both now say WHY mechanically rather than by
assertion: `RADIF_LICENSED`'s trigger is read and recorded above (a repetend
closing ≥2 pairs and ≥50% of them; rung 3's draft has zero), and `STUB_RETURN`
needs an abbreviated pointer — the printer's `[Chorus]` convention — which
§R2.2 forbids the measurer from writing in. **Reaching either one needs a
BLIND WRITER ASKED FOR IT IN THE SPEC**, which is a rung-4 seed decision and
not a repair: it is the same lever that made rung 3 work, applied to the
words instead of to the mandate.

~~Rung 3's denominator is therefore **71 + 10 = 81 of 94**.~~

**REPINNED 2026-08-17 — 73 + 10 = 83, AND THE OLD LINE IS STRUCK RATHER THAN
CORRECTED (doctrine 17).** The repin of `DOWNBEAT_LOCKED` and
`PHRASE_LENGTH_LOCKED` from `R3` to `R8` two paragraphs above was SUBTRACTED
from the `R3` list and never ADDED to the `R8` one, so the cumulative total
carried the old marks. Post-repin the partition is **`R8` 21 · `R3` 13**, and
the ladder is:

| rung | denominator | derivation |
|---|---:|---|
| 1 | 52 | `R2` 48 + `R2*` 4 |
| 2 | **73** | 52 + `R8` 21 ~~71~~ |
| 3 | **83** | 73 + the 10 `R3` codes predicted reachable ~~81~~ |

**The check that the repin is right is that the remainder now closes.** At 81
the leftover was 13 with no account of it; at 83 it is **11 = 8 `NC` + 3
surface-blocked** (`CHANNEL_NOT_MEASURED`, `NO_RHYME_KEY`, `REPRISE_STUB`),
every one of them named. Two codes that had already FIRED sat in no
denominator at all, which is the same defect as the 48/4/34/8 line above and
the same fix: **doctrine 91 — a count is a coordinate of the RENDERING, so
the rendering must not be the source of the count.** The TABLE is the
authority; this line is derived from it and follows it.

**Nothing about rung 2's reported RESULT moves**, and that is deliberate: its
four cells were scored against the denominator as it stood, `FIRED ∩
denominator 12 of 71` with the two repinned codes reported SEPARATELY in the
falsification cell. Folding them in retroactively would erase the falsified
prediction, which is the most informative thing rung 2 produced (doctrine 79 —
they are different counts and are never summed).

### R3.4 Predicted refusals

Seven declared functions should silence `FUNCTION_UNDECLARED` entirely, which
has fired on every rung so far. `SINGLE_INSTANCE` should survive on intro,
bridge and outro and vanish on verse and chorus. `NO_SETTING` stays: there is
still no audio.

### R3.5 Standing predictions

1. **The handoff is where the defects will be, if there are any** — that is
   rung 1's pattern and rung 2 did not test it. The specific site to watch is
   the brief for a line inside a RETURNING section: fixing chorus 1 line 1
   must not silently desynchronise chorus 2.
2. **The reprise layer's refusals are the least-driven code in the repo** and
   have never been produced by anything but a constructed test.
3. **A null prediction, stated so it can fail:** the shape-lock family will
   fire on MY declared grid rather than on the writer's words, exactly as
   `DOWNBEAT_LOCKED` did at rung 2. If so, the family is measuring the
   blueprint author and not the songwriter, and that is worth saying plainly
   rather than counting as coverage.

### R3.6 What would falsify the setup rather than the harness

If the writer cannot converge under the withheld declaration, the first
reading is that the brief does not carry enough to repair a cross-section
mandate — a real finding about the brief. Only if the brief demonstrably
carries it does the spec become the suspect.

### R3.7 RUNG 3 — RUN 2026-08-17. The spec change worked, and it found DEFECT E.

**The seed failed as specified.** A blind writer (no history, no repo, no
tools, `tool_uses: 0`) was given the SHAPE and the WITHIN-SECTION rhyme scheme
and returned 26 lines, a title and a hook — *night tower*, md5 `3ff8efd288f3`,
~235 tokens, 7 sections. Graded against the stricter declaration it was never
shown, `brief` reports **1 FLAG**: `SCHEME_VIOLATION` on L7, which is exactly
the planted cross-section mandate `3,7`. **Rung 2's failure mode did not
recur** — the loop had work, and it went to the handoff.

**Predictions that came in.** `CROSS_FUNCTION_REPRISE` fired (INTRO → OUTRO,
reported as `EXTENDED_RETURN`), as did `HOOK_CONFINED`, `METER_LOCKED`,
`TITLE_NOT_IN_HOOK`, `COUNT_IS_A_LOWER_BOUND` and `UNREADABLE_INTERIOR_WORD`.
**And the carried-forward prediction was right**: `NEAR_COLLISION` and
`COLLISION_CUT_IS_SCALAR_ONLY` — two of rung 2's four words-bound codes —
fired with **no declaration aimed at them**, because a 26-line song contains
near-relation pairs that an 8-line one did not (`'ear'~'chair'` 0.927,
`'ear'~'there'` 0.927).

#### DEFECT E — a declared RETURN is rendered to the writer as a rhyme

The loop went straight to TIER 2: L7 is in three groups and nothing answers
all of them, which is correct — the planted mandate IS unsatisfiable, and the
prompt says so (*"The MANDATE is what needs revising"*). What it also says,
and should not, is this:

    group D [7, 8]  — this line must rhyme with: L8 ('hear')
    group M [3, 7]  — this line must rhyme with: L3 ('break')
    group N [7, 19] — this line must rhyme with: L19 ('ear')

**Group N is not a rhyme group. It is the declared verbatim chorus return.**
MEASURED: `requirement(7, 8)` and `requirement(7, 3)` are `REQUIRE_RHYME`;
`requirement(7, 19)` is `REQUIRE_RETURN` — identity REQUIRED, the two lines
must be THE SAME LINE. All three printed the same sentence, on BOTH the tier-1
and tier-2 surfaces.

**THE REQUIREMENT HANDED TO THE WRITER IS THE WRONG ONE AND STRICTLY WEAKER.**
A writer who supplies a different line that rhymes with `ear` has done exactly
what the brief asked and has silently broken the return. And it is worse than
a mislabel: rule 2 forbids changing L19, so the return cannot be satisfied by
ANY legal answer — the writer is being asked for something impossible while
being told it is an ordinary rhyme.

**MECHANISM.** `Brief.must_answer` carries every group a line is in and **no
requirement kind**, so both renderers had nothing to distinguish on. Same
shape as defect D one layer over: one container, two kinds, one sentence that
names only the first. The mandate has always known; the brief never asked.

**FIXED.** `Brief.return_groups` carries the labels whose requirement is
`REQUIRE_RETURN`, asked of `Mandate.requirement` rather than inferred from
`returns` membership (doctrine 1 — a second derivation drifts). Both renderers
name it, and the tier-1/tier-2 prompt states the honest consequence: *"if this
line has to move to satisfy something else, the RETURN is what breaks, and
that is a fact about the mandate rather than about anything you can write."*
A set of labels rather than a fourth tuple field, because `must_answer`'s
3-tuple is read by tier 2's search, by `propose.py` and by `__str__`, and
widening it would turn a rendering fix into a four-site refactor.

**PINNED.** `quality/test_revise.py` §43, 8 checks on a 4-line fixture whose
one draft carries both kinds at once — group A is the declared verbatim
return, group B an ordinary rhyme group — so the positive and its control are
the same run. FOUR MUTATIONS, each red in exactly the checks that own it:
killing the field reds 5; reverting `Brief.__str__` reds 1; reverting
`propose._mandate_block` reds 3 (both prompts plus the consequence); and
deriving `return_groups` from `returns` MEMBERSHIP instead of
`Mandate.requirement` reds exactly 1 — the `Return(verbatim=False)` control,
which is `LICENSE_REPEAT` and must NOT be rendered as a return. That last
mutation is the one that matters: it is the fix a reader would call
equivalent, and it is the check that says it is not. `quality/test_propose.py`
§7c caught the stand-in `class B` going blind to the new field on the same
run, which is the guard behaving as specified rather than a second defect.

#### DEFECT F — the pair tier 2 OFFERS is rejected by the grader that offers it

**Found by completing the defer session**, which is the half rung 1 could only
do once. With defect E fixed the corrected prompt went to a fresh blind writer
(no history, no repo, no tools, `tool_uses: 0`), and it did **exactly the right
thing**: it returned L7 BYTE-IDENTICAL — preserving the declared return — and
moved the anchor to `chair`, which rhymes with `ear` at 0.927. Under the OLD
prompt that answer is unreachable: a writer told "L7 must rhyme with L19
('ear')" is entitled to move L7, and doing so silently breaks the return.
**The fix changed the answer, which is the only evidence that the rendering
was load-bearing.**

**And the loop rejected it**: `introduced 1 new flagged finding(s) [(5,
'SCHEME_VIOLATION')] while fixing 4`. L3 is in TWO groups — `partners(3)` is
`[(1, [5]), (12, [7])]` — and the tier-2 prompt renders **THE RHYME MANDATE ON
THE PIVOT** only. The writer was told to move the anchor's end word and never
told what else that anchor has to answer.

**THE SHARPER MEASUREMENT: the grader's own proposal fails its own check.**
Running the pair the prompt offers under *THE PAIR THE GRADER'S OWN SEARCH IS
PROPOSING* — L7 → `care`, L3 → `share` — through `verify()`:

    accepted  : False
    new_flags : [(5, 'SCHEME_VIOLATION'), (19, 'RETURN_NOT_VERBATIM')]

Two rejections, and they are the two halves of one sentence. `_try_tier2`
builds both searches out of the PIVOT's group list and nothing else:

    other_calls = [w for lab2, _m2, cl2 in b.must_answer if lab2 != label
                   for _, w in cl2]
    p_offered, _ = reviser.joint_field(other_calls, exclude=(pivot_current,))
    a_offered, _ = reviser.modal_field(w, exclude=(anchor_current,))

- `other_calls` does not read `return_groups`, so group N contributes `'ear'`
  to a RHYME search — **the search half of defect E**, still open after the
  rendering half was fixed. Every one of the 24 pivot options breaks the
  return; the field cannot contain the one legal answer, which is the word
  already there.
- `a_offered` is derived from the pivot's candidate `w` ALONE. The anchor's
  own `must_answer` is never consulted, so an anchor that is itself a pivot is
  searched as though it had no other obligations. All 24 anchor options are
  `-air`/`-are` words and L5 ends on `awake`.

**This is doctrine 48 one layer over.** The offered pair is not merely
unhelpful — it is unacceptable BY CONSTRUCTION, and nothing in the loop could
report that, because the offer is never put through the check that judges the
answer.

**FIXED.** Both searches now ask the MANDATE before either runs.
`_anchor_obligations(reviser, mandate, lines, anchor_line, pivot_line)` reads
`Mandate.partners`/`requirement` for the anchor, drops only the group being
backtracked, and returns `(other call words, return-group labels)`; the anchor
field is `joint_field([w] + a_other)`. A line pinned by a verbatim return —
pivot or anchor — is **NOT SEARCHED**, with the group named, and a group that
IS a return has no backtrack at all. `PairBrief.anchor_calls` carries the
anchor's obligations to `render_pair`, which prints them under **AND THE
ANCHOR HAS GROUPS OF ITS OWN**.

**Three counts, never summed** (doctrine 79). `tried` is pairs actually put to
a proposer; `pinned` is groups REFUSED unsearched; `starved` is groups whose
anchor conjunction came back EMPTY. The last one was unsayable before the
fold: `modal_field(w)` was never empty here — it returned 24 words each of
which broke a group nobody had mentioned — so a dead end that is a fact about
the MANDATE was reported as a proposer that could not find anything.

**MEASURED AFTER.** Rung 3's own draft now runs to a stop condition with no
suspension and no prompt issued: `NOT ATTEMPTED — all 3 two-line group(s) are
pinned by a declared verbatim return, so this tier has no legal move and the
MANDATE is what needs revising`, draft byte-identical at md5 `3ff8efd288f3`,
L7 reported unresolved. **That is the whole planted seed answered correctly**
— the cross-section mandate `3,7` really is unsatisfiable against the return
`7,19`, and the loop now says so instead of spending a writer's attempts on
pairs it would reject.

**PINNED.** `quality/test_loop.py` §19, 8 checks, and the isolation is in the
fixtures: `ANCHOR_IS_A_PIVOT` has no returns anywhere (the anchor half alone),
`ANCHOR_HAS_A_LIVE_GROUP` gives the anchor's conjunction a non-empty answer so
a prompt is actually built, and the pin fixture puts the PIVOT in a return.
Check 8 is the control that keeps the fix inert on the ordinary shape — an
anchor in one group carries no extra calls and renders no new block. FIVE
MUTATIONS, each red in the checks that own it: unfolding the anchor field
reds 1, removing the return pin reds 2, inferring a return from `returns`
membership reds exactly the `verbatim=False` control, dropping the prompt
block reds 1, and folding `starved` into "none accepted" reds 1.

**AND THREE OLDER SECTIONS WERE PINNING THE DEFECT — restated 2026-08-17.**
`test_loop.py` §5 asserted *"tier 2 DID search (`tried > 0`), it did not bail
out early"* on `SILVER_NIGHT_LOCKED`, a fixture whose own comment says every
backtrack here breaks a real mandated pair because L1 and L2 are locked to
families of their own. Both halves were true, and together they said the loop
was RIGHT to propose 50 pairs it would reject every time. §13 and §16 then
measured the SIZE of that doomed search — 8 at width 2, 50 at width 5 — and
called the numbers a contract. **A test that measures a wrong behaviour
precisely is what keeps it.** §5 now asserts the opposite and says why; §13
and §16 keep their subjects and their two numbers exactly, on the same draft
with the anchor locks removed and a NO-OP PROPOSER supplying the rejections,
so the count is still `2 x width²` and the rejection is still `verify()`'s own
verdict — just not one manufactured by an unsatisfiable mandate.

**THE GENERAL SHAPE, now five instances deep.** The instrument built to close
a defect reproduces that defect one layer up, and the test written to pin a
behaviour is one of the layers.

**RUNG 3 CONFIRMS RUNG 2'S DIAGNOSIS.** Rung 2 found nothing and the
hypothesis was that it never exercised the handoff. Rung 3 changed exactly one
thing — a seed specified to fail — and the first defect it found is in the
handoff, in the same family as all six of rung 1's. **The spec decision was
the whole difference.**

### R3.8 THE DECLARATION SWEEP — rung 3 scored, 2026-08-17

The words never change; only the declaration does (§R2.2). Each of the 9 codes
that stayed SILENT on the draft as written got a declaration aimed at it.

| code | verdict | what was declared |
|---|---|---|
| `CROSS_FUNCTION_REPRISE` | **FIRED** | nothing — fired on the draft as written |
| `SECTION_LENGTH_LOCKED` | **FIRED** | every section 8 bars |
| `UNIFORM_ANACRUSIS` | **FIRED** | alternate lines on beat 4, one shared pickup |
| `NO_COMPARATOR` | **FIRED** | every section a `bridge`; no verse or chorus to contrast with |
| `REPRISE_IS_NOT_LATER` | **FIRED** | the `outro` declared at bar 1 and the `intro` at bar 45 |
| `REPRISE_SIDE_HAS_NO_WORDS` | **FIRED** | an INSTRUMENTAL intro — a declared `intro` whose bar span holds no line |
| `PREDICTABLE_RHYME` | **FIRED** | `predictability_max` 0.90 → 0.50, a declared coordinate |
| `QUATRAIN_LOCK` | SILENT | **unreachable at 26 lines — see below** |
| `BRIDGE_IS_A_VERSE` | SILENT | 6 of 7 channels matched; `line_length` separates |
| `PROMINENCE_UNDECIDED` | SILENT | no undecided unit exists in the words |

#### The four cells, against the repinned denominator of 83

| cell | count |
|---|---:|
| `FIRED` ∩ denominator | **78 of 83** |
| `SILENT` ∩ denominator | 5 |
| `FIRED` ∩ outside the denominator | 0 |
| codes outside the model | 0 |

78 = rung 1's 52 + rung 2's 19 + rung 3's 7.

**~~83~~ 82, REPINNED 2026-08-17 — `PROMINENCE_UNDECIDED` LEAVES THE
DENOMINATOR.** The sweep of the 16 (§E3b) established that its branch is live
and NOTHING PRODUCES ITS INPUT: no shipped phonology returns a multi-valued
`Readings` for prominence, and wiring one naively would report vowel reduction
as "the phonology declined to say", which is a wrong answer rather than a
missing one (`BACKLOG.md` §4.10, now declared inert with the measurement). A
code no draft can reach is not a coverage gap in the WRITING path — it belongs
with the `NC` codes and the surface-blocked three, outside the denominator and
disposed of by argument. **The score is therefore 78 of 82 with 4 SILENT**,
and the 12 outside are 8 `NC` + 3 surface-blocked + this one. Rung 3's cells
above are left as measured on the day (doctrine 17).

#### `QUATRAIN_LOCK` IS A MIS-MARKING, AND IT IS ARITHMETIC

`stanza_lock` fires it at `four_lines_per_section >= 0.90`. On a 26-line draft
the best attainable partition is six 4-line sections and a remainder, so
**6/7 = 0.857 < 0.90 and no declaration reaches it**. It was filed `R3` —
"needs a fuller song" — and the true constraint is that the LINE COUNT MUST BE
DIVISIBLE BY 4. A 24- or 28-line draft reaches it and a 26-line one never
will, however many sections it declares. **This is the same error rung 2
made** (`DOWNBEAT_LOCKED` filed under a section argument when it measures
lines), and the same lesson: a reachability mark asserted by family rather
than measured is wrong about roughly one code in ten.

#### THE OTHER TWO ARE WORDS-BOUND, AND THE SWEEP PROVED IT RATHER THAN ASSUMING IT

`BRIDGE_IS_A_VERSE` needs every declared contrast channel to agree. Six of the
seven were forced to agree by declaration — `meter`, `bars`, `line_count`,
`line_duration`, `downbeat_rate`, `rhyme_inventory` — and the seventh is
`line_length`, measured **9.25 against 8.875**. That is the writer's own line
lengths and no declaration moves it.

`PROMINENCE_UNDECIDED` needs a unit whose readings DISAGREE — a homograph the
phonology will not resolve. Every line of this draft was checked and **none
carries one**. The remedy the refusal itself names ("a declared reading for the
ambiguous word") RESOLVES the ambiguity; nothing declares one INTO a draft.

#### THE LADDER IS EXHAUSTED, AND THAT IS THE RESULT THAT CLOSES IT

Five codes remain inside the denominator. **Four are words-bound**
(`BRIDGE_IS_A_VERSE`, `PROMINENCE_UNDECIDED`, `STUB_RETURN`,
`RADIF_LICENSED`) **and the fifth is arithmetic** (`QUATRAIN_LOCK`). **Not one
of them is reachable by writing a LONGER song**, which was the ladder's entire
premise. A further rung of the same kind would score exactly 78 again.
*(`PROMINENCE_UNDECIDED` left the denominator later the same day — see the
repin above — so the standing figure is 4 SILENT of 82.)*

The ladder answered the question it could answer: **78 of 83 codes are reached
by the CLI writing path, and the remaining 5 are blocked by what the words
contain, not by how many there are.** Reaching them needs a different lever —
a seed that specifies a FORM rather than a length — and that is a new
pre-registration, not another rung of this one.

## E. DISPOSITIONS — the 16 codes no rung reaches, and why, 2026-08-17

Written so that "not reached" is never mistaken for "not working", and never
for "we stopped bothering". Each is a REFUSAL WITH A STATED REASON (doctrine
20), and the four groups below are different kinds of fact and are never
summed (doctrine 79).

### E1. The 5 inside the denominator — blocked by the WORDS, not the length

| code | blocked by | proven to fire? |
|---|---|---|
| `STUB_RETURN` | needs an abbreviated pointer — the printer's `[Chorus]` | **YES**, `quality/test_song_function.py` §322 |
| `RADIF_LICENSED` | needs a repetend closing ≥2 pairs and ≥50% of them | **YES**, `quality/test_floor.py` §113, a ghazal fixture |
| `BRIDGE_IS_A_VERSE` | `line_length` 9.25 vs 8.875; six channels forced, this one is the words | see §R3.8 |
| `PROMINENCE_UNDECIDED` | needs a homograph the phonology leaves undecided | see §R3.8 |
| `QUATRAIN_LOCK` | needs a line count divisible by 4; 26 cannot reach 0.90 | see §R3.8 |

**"NOT YET REACHED BY THE BLIND PATH" IS THE CLAIM, AND IT IS NOT
"UNREACHABLE".** Two of these five are already PROVEN to fire on constructed
input. The open question is narrower and is about SONGWRITING rather than
about the harness: *does a blind writer, writing a song, produce a draft that
contains one?* That question is answerable and the method does not break
anything:

**A FORM-SPECIFIED SEED KEEPS THE WRITER BLIND.** §R2.2 forbids telling the
writer what the harness checks. It does not forbid choosing a genre — every
rung already specified shape (line count, section count, which sections
rhyme), and rung 3's whole lesson was that the SPEC is the lever. A **ghazal**
has a radif by definition; a **printed lead sheet** abbreviates the return by
convention; a **24-line** draft is divisible by 4. None of those mentions the
harness, a finding code, or what is being measured. A future run whose seed
names a form rather than a length is a clean measurement of exactly this, with
its own falsifiable claim: *does a writer asked for a ghazal produce a radif
the floor recognises?* If they do not, that is a finding about the gap between
a named form and what writers do with it, and it is worth more than the code.

**Deliberately NOT done inside this experiment.** This pre-registration's
denominator, bias controls and four cells are built around length. Bolting a
form-based seed onto it would silently change the instrument mid-run, which is
the one thing a pre-registration exists to prevent.

### E2. The 3 blocked by SURFACE, at every rung

`CHANNEL_NOT_MEASURED` and `NO_RHYME_KEY` are scoped by their own §A4 entry to
the `function` verb, **which is not on the song-writing path at any rung** —
no length and no declaration puts them there. `REPRISE_STUB` is words-bound in
exactly the way E1 describes. These three were excluded in §R3.3 BEFORE rung 3
ran and are recorded here unchanged.

### E3. The 8 `NC` codes — a different instrument, named as one

Not CLI-reachable at all. Reaching them means driving the API directly, which
is **a different experiment with a different denominator and different bias
controls**, not a further rung of this one. Naming it as separate is the
honest disposition; folding it in would let an API result be read as a
statement about the writing path, which is the exact confusion this
pre-registration was built to avoid. **No claim is made here about whether the
8 work** — only that this instrument cannot ask.

### E3b. The sweep of the 16, RUN 2026-08-17 — and two of them cannot fire

The dispositions above say what no RUNG reached. That is not the same question
as whether the checks WORK, and the second question is answerable now, by
construction, without a writer and without touching the blind experiment.
Constructing an input to see whether a check fires is a unit test, not a
coverage claim, and this repo already does it (`quality/test_floor.py`'s
ghazal fixture for `RADIF_LICENSED`).

**Triage first: 13 of the 16 were already positively tested.** A mention is
not a test — `quality/coverage_log.py` asserts `RADIF_LICENSED` is ABSENT,
which proves nothing — so each was checked for an assertion that it FIRES on
an input containing its condition. All five rhyme/mandate codes, three of the
five meter codes, and three of the six structure codes had one.

**Two fired and merely had no test.** `NO_RHYME_KEY` refuses correctly when
`compare_returns` is given no phonology, and `REPRISE_STUB` refuses correctly
when one side of a reprise is `&c.` — with the aside that `[Chorus]` is NOT a
form `is_chorus_stub` recognises, which is worth knowing since it is the shape
a reader assumes. Both are now `quality/test_grid.py` §30, with controls in
both directions.

**Two cannot fire in any real run — `BACKLOG.md` §4.10, doctrine 48.**
`NO_TEMPO` is constructed by no production path at all (its only caller is its
own test), and `tempo_bpm` is a declared coordinate with no reader, so both
halves of the tempo story are scaffolding. `PROMINENCE_UNDECIDED`'s branch
WORKS when fed a multi-valued `Readings` — measured, 2 undecided units and a
`?` in the pattern — but no shipped phonology produces one, so the guard
cannot be entered on the default path. Neither makes anything the harness says
false today; both are checks that cannot participate, which is exactly what
this sweep was for.

### E4. What this experiment now says, in one sentence

**78 of the 83 finding codes a song-writer can reach from the command line
were reached, every one of the remaining 5 is blocked by what a draft
CONTAINS rather than by how long it is, and 11 more are out of this
instrument's reach for stated reasons.** The ladder is closed. Eight harness
defects were found along the way, all eight in the writer handoff.

## F. THE FORM SEED — PRE-REGISTERED 2026-08-17, BEFORE ANY DRAFT EXISTS

**NOT A RUNG.** The length ladder is closed at §E4 and this does not extend
it. It is a separate one-claim run with its own seed, its own denominator of
ONE, and its own falsifiable statement. Calling it "rung 4" would imply the
ladder's premise — that more length reaches more codes — which §R3.8
disproved.

### F1. Why only ONE of the four remaining codes gets a run

All four are **already proven to fire**: `STUB_RETURN`
(`quality/test_song_function.py` §322), `RADIF_LICENSED`
(`quality/test_floor.py` §113), `BRIDGE_IS_A_VERSE`
(`quality/test_song_function.py::_bridge_is_a_verse_fires`) and `QUATRAIN_LOCK`
(`quality/test_grid.py` §4, on `cliche_song()`). **So no draft can tell us
whether the code works.** The only open question is whether a WRITER'S OWN
SONG reaches them, and that question is worth asking of exactly one.

**THE TEST THAT INVALIDATES ITSELF.** If the seed specifies the form tightly
enough to GUARANTEE the condition, the run stops measuring the writer and
starts measuring the seed — and "does it fire when the condition is present"
is what the four unit tests above already answer. Judged one at a time:

- **`STUB_RETURN` — DICTATION, no run.** It needs a line that IS the pointer.
  Asking for one is not a form request, it is transcription. (And the
  convention it recognises is `&c.`, NOT `[Chorus]` — measured 2026-08-17,
  `quality/test_grid.py` §30.)
- **`QUATRAIN_LOCK` — MY DECLARATION, no run.** It reads lines-per-section off
  the BLUEPRINT, which the measurer writes. Six sections of four lines would
  fire it because of the grid I declared, not because of anything written.
- **`BRIDGE_IS_A_VERSE` — ALREADY ANSWERED, no run.** It fires when a bridge
  FAILS to contrast. Rung 3's blind writer produced a bridge that DID contrast
  — six channels forced to agree by declaration and `line_length` still
  separated them at 9.25 against 8.875 (§R3.8). A writer contrasting a bridge
  unprompted is the finding; asking for a bridge that does not contrast would
  be asking for a defect.
- **`RADIF_LICENSED` — A REAL QUESTION, and the run below.** "Write a ghazal"
  names a FORM, not a feature. A ghazal has a radif by definition, and whether
  a writer executes one as a repetend the floor recognises is genuinely
  unknown.

### F2. The seed, fixed in advance

A blind writer (no history, no repo, no tools) is asked for **a ghazal in
English, 5 couplets**. The word "radif" may be used — it is the form's own
vocabulary, in every description of it, and withholding the name of the form
while asking for the form would be a stranger instruction than giving it. What
is NOT said: that anything is being measured, that a harness exists, what
`RADIF_LICENSED` is, or what threshold it applies.

### F3. Bias controls

As §R2.2, unchanged. The writer never sees the harness, the codes, the
declaration, or this file. The declaration is written AFTER the draft arrives
and may not edit the words.

### F4. THE FALSIFIABLE CLAIM

**`RADIF_LICENSED` fires on the draft under a mandate that pairs the couplets'
end lines.** The trigger, read from `SlopFloor._relation_findings` on
2026-08-17: the same trailing token-run must close **at least 2** mandated
pairs AND at least **`radif_min_pair_fraction` = 0.50** of them.

**What each outcome means, written before the run so neither is a surprise:**

- **FIRES** — the code closes, the score goes to 79 of 82, and the writing
  path is shown to reach it when the form is named.
- **SILENT** — a finding about the gap between naming a form and producing it,
  and it is worth MORE than the code. It would mean a writer asked for a
  ghazal produced something ghazal-shaped whose repetend the floor does not
  recognise, and the next question is which half is wrong: the draft, or a
  0.50 threshold calibrated on nothing this repo has measured.
- **REFUSED or SUSPENDED** — reported as neither, per doctrine 20.

### F5. What would falsify the SETUP rather than the harness

If the writer returns something that is not a ghazal — no repeated closing
phrase at all, or couplets that do not share a rhyme before it — the run says
nothing about `RADIF_LICENSED` and the seed is what needs rewriting. That is
recorded as a REFUSAL of the run, not as a SILENT cell.

### F6. RESULT — RUN 2026-08-17. The claim held, and the run paid for itself twice.

**A blind writer (no history, no repo, no tools, `tool_uses: 0`) returned a
correct ghazal.** Radif `turn`; the matla ends both lines of the first couplet
on it and every second line after; a takhallus in the last couplet. 10 lines.

**`RADIF_LICENSED` FIRED, as pre-registered.** Under a mandate grouping the six
radif lines, `'turn'` closes **15 of 15** mandated pairs — 100% against the
declared 50% floor and the ≥2 minimum. **The code closes and the score is 79 of
82.** The writing path DOES reach it when the seed names the form, which is
what §E1 predicted and what the length ladder could not test.

#### AND THE SAME RUN FOUND A MESSAGE THAT OVERCLAIMED

The run reported `RADIF_LICENSED` **and 15 `SCHEME_VIOLATION`s on the very
pairs the note calls licensed**, every one of them `REPEAT not rhyme
(identical word) 'turn' ~ 'turn'`. The note read *"self-rhyme checking is
suppressed for it"* — full stop.

**BOTH WERE CORRECT AND THE SENTENCE WAS NOT.** The floor suppresses its OWN
`REPEAT_IN_VERSE`. The mandate layer judges an identical end word on a
different, separately declared coordinate — `ReviseDeclaration.repeat_licence`,
default `'unlicensed'`. MEASURED on this draft: **15 violations at the default
and 0 at `repeat_licence='refrain'`, with `RADIF_LICENSED` unmoved in both.**
So the two layers are two questions and the caller's declaration settles the
second; what was wrong was one sentence claiming a settlement for a layer its
module does not own (doctrine 1). The message now says *"THIS FLOOR's
self-rhyme check"* and its evidence names the coordinate that governs the
other. `quality/test_floor.py` pins all four properties including the control.

**MY DECLARATION WAS THE THING AT FAULT, AND THAT IS WORTH RECORDING.** A radif
IS a licensed repeat; grading a ghazal at `repeat_licence='unlicensed'` is a
mis-declaration, not a harness defect. The finding is that the harness let the
mis-declaration read as a contradiction instead of as a coordinate nobody set.

#### A SECOND OBSERVATION, NOT A CLAIM THIS RUN PRE-REGISTERED

The qafiya — the rhyme that must precede the radif — does **not** rhyme:
stripped of `turn` the five pairs read `to`~`the`, `the`~`leaving's`,
`leaving's`~`its`, `its`~`my`, `my`~`poem's`. A ghazal requires both. So the
writer produced the radif and not the qafiya. **This is recorded and NOT
scored**: §F pre-registered one claim and this is not it, and a finding
promoted after the fact is the thing pre-registration exists to prevent. It is
the obvious seed for any future run.

### F7. DISPOSITIONS — the other three, and why no run is owed

Written before F6 was run (§F1) and unchanged by it.

- **`STUB_RETURN`** — reaching it means asking for a line that IS the pointer.
  That is transcription, not a form request, and the unit test already answers
  what it would show.
- **`QUATRAIN_LOCK`** — reads lines-per-section off the BLUEPRINT, which the
  measurer writes. It would fire because of a grid I declared.
- **`BRIDGE_IS_A_VERSE`** — fires when a bridge FAILS to contrast. Rung 3's
  writer produced one that DID contrast, on `line_length` at 9.25 against
  8.875, with six channels forced to agree by declaration (§R3.8). Asking for
  a bridge that does not contrast is asking for a defect.

**All three are proven to fire and none is reachable by a seed that still
measures the writer.** They stay SILENT with this argument attached, which is
a refusal with a stated reason and not a gap (doctrine 20).

### F8. FINAL: 79 of 82

`FIRED` 79 · `SILENT` 3 · outside the denominator 12 (8 `NC`, 3
surface-blocked, `PROMINENCE_UNDECIDED`). **Nine harness findings across the
whole experiment** — six at rung 1, zero at rung 2, two at rung 3, one here —
and every one of them in a message or a handoff rather than in a verdict.

## D. Judgement calls carried forward

The derivation flagged its own uncertainty; carried here unresolved rather than
silently settled.

- **`wiring` in (A) is the most arguable inclusion.** It is repo meta-tooling by
  the rubric, but `CLAUDE.md`'s Commands section opens with "Run `wiring`
  first," addressed at a writing session. Kept in (A); one row, touches no draft.
- **`types` splits at the flag's VOCABULARY, not the flag.** English default and
  four English-general presets (A); its non-English phonologies and six
  tradition presets (B).
- **`partition` and `cycle` earn (A) on their load-bearing use**, not their
  headline output: `partition` answers "your cliques overlap, so no letter
  scheme exists" (the choice between a letter mandate and `--groups=`), and
  `cycle` is how you pick the `groups` a blueprint must declare, since
  `UNDECLARED_GROUPING` refuses to guess among 2^(n-1).
- **`STUB_RETURN` in (A), reluctantly** — corpus-shaped, but unlike the `MARK_*`
  refusals it fires on the live `_function_findings` path, so a writer who
  abbreviates a chorus return does get it.
- **The nine NC codes stay in (A), not (B).** They are song-writing questions
  whose only blocker is plumbing. Moving them to (B) would misfile a gap as a
  scope decision; leaving them unmarked would manufacture one.

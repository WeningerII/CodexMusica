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

Reachability of the 94: **R2 48** · **R2\* 4** · **NM 33** · **NC 9**.

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

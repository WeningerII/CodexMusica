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
  question the harness asked wrongly (defect A). Held until the fix decision.
- **The coverage diff against §A–D.** Deferred for the same reason and NOT
  because it is expensive: a code that fired only because the writer was
  following a false brief is not evidence that a writing session reaches it.
  Scoring this run's codes against the denominator would put defect A's own
  output in the numerator (doctrine 79 — the refusal and the answer are not
  summed, and a wrong answer is neither).

That is a HALT, not a completion: rung 1 found what it was built to find at the
first handoff and the ladder does not advance past an instrument reading a
brief the harness got wrong.

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

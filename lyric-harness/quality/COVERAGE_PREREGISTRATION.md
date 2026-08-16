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

<!-- DENOMINATOR — filled by an independent derivation, see Bias controls #1.
     Nothing above this line describes the draft's content, and nothing below
     it was written by the author of the draft. -->

## The denominator

*Pending independent derivation.*

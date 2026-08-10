# Pre-registration — the conjunctive coda band

Committed **before** the rule exists. `git log` proves the order.

## Why a conjunctive rule, and why it must not be a rejection

`RESULTS_MATRIX.md` established that `sun`/`much` was never an additive-floor
case. Its nucleus is *identical* — S-**AH**-N against M-**AH**-CH — so half the
score is earned, and what it exploits is **channel compensation**: a strong
nucleus outweighing a coda mismatch. Log-odds reproduced that in a new
currency. Compensation is a property of any additive combination rule, so no
comparator fixes it. It has to be fixed in the band.

The naive rule — *"rhyme requires the coda to match"* — would delete assonance,
consonance, oblique rhyme and slant rhyme from a taxonomy this project exists to
represent. That is the flattening this whole design was meant to avoid, and it
would be a worse defect than the leak.

**So the rule types the edge instead of rejecting it.** `sun`/`much` is not
"not a relation". It is **assonance**, which is a named member of the taxonomy,
and the correct output is that name.

| nucleus agrees | coda agrees | relation |
|---|---|---|
| yes | yes | RHYME |
| yes | no | **ASSONANCE** |
| no | yes | **CONSONANCE** |
| no | no | no relation |

This converts a scalar band-pass into a **typed** one. Doctrine 2 says the graph
is the primary object; this makes its edges carry a type rather than only a
weight.

## Agreement is not evidence

`see`/`free` is a perfect rhyme and both codas are **empty**. The fitted matrix
correctly gave empty-vs-empty **zero evidence** — two absent codas tell you
nothing. But for the conjunctive rule they **agree**, and agreement is the
question the band asks.

These are different predicates and conflating them would silently delete every
open-syllable rhyme in English. Registered as the tripwire below.

## Declared coordinates

| coordinate | value |
|---|---|
| `theta_coda` | calibrated, not guessed: the 95th percentile of coda similarity over random line-final pairs |
| `theta_nucleus` | same rule, on the nucleus channel |
| both-empty codas | **agree** |
| profile `full` | conjunctive ON |
| profile `assonance` | conjunctive **OFF** — the profile exists to score nucleus-only agreement |
| profile `rawi` | already requires the final consonant; the existing rule becomes a special case |

Thresholds are percentiles of a measured background, for the same reason the
slop floor's are (doctrine 16: an uncalibrated threshold fails loud, and it
fails toward whoever guessed).

## Predictions

**P1 — the leak closes, by naming.** `sun`/`much` types as ASSONANCE and is no
longer admitted as RHYME under the `full` profile.

**P2 — NO FLATTENING.** Under the `assonance` profile, `sun`/`much` is still
admitted. The relation vocabulary grows from three names (RHYME, REPEAT,
RIME_RICHE) to five. A rule that closes the leak by shrinking what the harness
can say has failed, whatever it does to the numbers.

**P3 — the residue decomposes.** The sonnet battery's documented 85/1064 (8.0%)
violations are currently one undifferentiated bucket described as "Early Modern
-y class, archaic -st morphology, rhotic ER/AOR class". Under typing they
acquire names. Direction: the RHYME-only violation count **rises**, because a
conjunctive rule is strictly stricter than a scalar one, and the rise is
reported rather than hidden.

`love`/`prove` is the case to watch: coda V-V agrees, nucleus AH/UW does not, so
it types as **CONSONANCE** — which is correct for the declared dialect (CMUdict
General American), where it is not a rhyme. The residue is a dialect mismatch
and typing should say so.

**P4 — NEGATIVE CONTROL, the real test.** Whitman free-verse chain capture
**falls below its documented 26.0%**, because chains linked only by nucleus
agreement stop counting as rhyme. The fitted matrix failed exactly here, going
to 35.3% at matched false-positive rate. A rule that tightens the negative
control *while* keeping the taxonomy intact is the actual fix; one that does not
tighten it is not.

**P5 — TRIPWIRE, must not fire.** Perfect rhymes on open syllables must remain
RHYME: `see`/`free`, `day`/`way`, `low`/`snow`. If both-empty codas are read as
disagreement, the rule deletes a large fraction of English rhyme while appearing
to work on the test case that motivated it. This is the failure mode to check
first, not last.

## What would falsify the rule

- P5 fires. The rule is broken in the most common case in the language.
- P2 fails. The leak was closed by flattening, which is the defect this project
  was built to avoid.
- P4 fails. The rule renames things without tightening anything, in which case
  it is bookkeeping rather than a fix.
- P3's rise is large enough that the `full` profile rejects most genuine sonnet
  rhymes. Then the conjunctive rule is wrong for English end-rhyme and belongs
  only in `rawi`, where a final-consonant requirement is a fact about the form.

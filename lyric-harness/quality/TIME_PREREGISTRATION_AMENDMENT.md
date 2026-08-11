# Amendment 1 to the time-layer pre-registration

> **RAP ARM WITHDRAWN.** Every rap figure in this document came from
> `verse.txt`, an in-copyright commercial transcription that predated the
> provenance gate, was never declared in `data/sources.tsv`, and was never run
> through it. It is deleted. Under `ProvenanceDeclaration(term_years=95,
> current_year=2026)` the cutoff is **1931** and rap begins in **1979**, so no
> rap corpus is admissible here before roughly 2075 — the arm cannot be
> replicated, only replaced. The aggregate statistics are kept as an audit
> trail; the text is gone. H1's positive half is **untestable under the
> provenance policy** rather than refuted, and its replacement is a
> cross-family corpus defined by structural property rather than genre
> (`quality/POSITIVE_CONTROL.md`).

Committed **before** the amended analysis is run, for the same reason the
original was: `git log` has to show the parameters were fixed before the
numbers existed.

## What happened to the original registration

It ran, and the instrument failed. Not the hypothesis — the instrument.

The registered event definition (theta 0.80, window 32 syllables, spans up to
3) marks **87–97% of eligible slots as rhyme events** on every corpus in this
repository:

| item | eligible slots | events | saturation |
|---|---|---|---|
| Shakespeare sonnets (4 sampled) | 63–74 | 59–70 | 91–95% |
| generated sonnets (2 sampled) | 56–61 | 49–59 | 88–97% |
| `verse.txt` (rap, 62 lines) | 302 | 278 | 92% |
| `lyric.txt` | 97 | 93 | 96% |
| `metidja.txt` | 27 | 18 | 67% |

When nearly every slot carries an event, the event phase distribution and the
slot phase distribution coincide **by construction**, KL goes to zero, and the
test has no power. The first run returned p = 0.087 on the rap verse, which
reads like a near-miss and is nothing of the kind — it is a measurement of
nothing.

**So H1, H2 and H5 were not evaluated and are not reported as null.** They are
inconclusive by construction, which is a different and weaker outcome, and
recording it as "null" would be a false negative dressed as a finding.

### Why it saturates

Known gap 2, already on the books: the comparator's additive floor puts
unrelated pairs above threshold (`sun`/`much` at .777 is the recorded example).
A 32-syllable window with three span lengths gives each stressed syllable on the
order of 135 comparisons, and at theta 0.80 something clears it nearly every
time. The window multiplied a known defect until it consumed the measurement.

## The second failure: the H3 control could never have fired

The registered H3 tripwire compares line-final events against line-final slots.
On these corpora **86–100% of line-final syllables rhyme**, so the event set
equals the slot set, KL is identically 0 and p is identically 1.

A control that cannot fire is not a control. That is doctrine 14 — a control
defined in terms of the quantity it controls — reproduced in this module's own
first draft, four commits after the doctrine was written. It was caught by
running it, which is the only way anything in this project has ever been
caught.

`line_final_control(mode="within")` still implements the registered form and
now labels itself degenerate when it saturates, rather than reporting p = 1.0
as though the control had passed. A post-hoc variant, `mode="against_all"`,
compares line-final events against **all** grid slots and is expected to fire;
it is labelled post-hoc in its own output and its result is not registered.

## What changes, and on what basis

**Only the event definition.** Every prediction below is carried over
unchanged.

| coordinate | was | now |
|---|---|---|
| theta | 0.80 | **0.90** |
| window | 32 syllables | **16 syllables** |
| max span | 3 | 3 (unchanged) |
| saturation ceiling | *none* | **0.75**, and the layer refuses above it |

### The criterion, and why it is not the hypothesis in disguise

The parameters were chosen to put median saturation in a **25–40%** band, a
target stated before the sweep was run. The sweep script computes **saturation
only — it contains no KL calculation at all**, so the choice could not have
been contaminated by which parameters produce a significant result. This is the
same discipline as the slop floor's thresholds, which are percentiles of a
distribution rather than judgements about it.

Measured saturation over the grid (median per class, 12 sonnets / 6 generated /
2 rap blocks):

```
                generated   rap   sonnet
theta=0.80 w=8      68%      59%    70%
theta=0.85 w=8      41%      44%    53%
theta=0.90 w=8      25%      21%    32%
theta=0.90 w=16     38%      30%    44%     <- selected
theta=0.90 w=32     49%      51%    62%
theta=0.95 w=16     25%      23%    31%
```

`theta=0.90, w=8` and `theta=0.90, w=16` tie on maximum deviation from the band
(4 points each, in opposite directions). The tie is broken toward the larger
window because 16 syllables spans roughly one and a half lines, which is the
reach of the cross-line internal rhyme the layer exists to see; an 8-syllable
window does not reach out of the line at all.

**What theta 0.90 changes about the claim.** It is well above the harness's
declared `theta_rhyme` of 0.75, so events are now *strong* internal matches
only. The layer's claim narrows accordingly: it is about the placement of
strong internal rhyme, not of rhyme in general. Stated here rather than
discovered later.

## Predictions, carried over unchanged

- **H1** — rap shows KL above its permutation null at p < .05; the sonnets, in
  aggregate, do not. Direction: rap > sonnet. The sonnet arm is still predicted
  **null**, and a significant sonnet result still most likely means the
  statistic is reading the pentameter.
- **H2** — the recovered period in `verse.txt` is in {2, 4, 8} rather than
  {3, 6}.
- **H3** — the registered control must be null, and is now reported as
  DEGENERATE rather than as passing wherever it saturates.
- **H4** — the permutation null preserves the position multiset and destroys
  only the pairing.
- **H5** — a result that holds on the stress grid and reverses on the syllable
  grid is an artifact of the isochrony assumption, not a fact about the verse.

## What would still falsify the layer outright

Unchanged from the original, plus one addition: **if the amended parameters
still saturate above the ceiling on most items, the event definition is not
rescuable by tuning** and the layer needs the fitted substitution matrix
(known gap 2) before it can be built at all. That would be the honest end of
this line of work rather than a third set of parameters.

# Pre-registration — the time layer

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

Committed **before** any time-layer feature code exists. `git log` proves the
order; that is the point of the file. Directions below are predictions, so a
result with the wrong sign is a failed prediction and gets reported as one.

Doctrine 4 has listed the time layer as NOT BUILT since the first commit:
"Time (NOT BUILT — no beat grid anywhere)". Known gap 3 asks for a beat grid
and on/off-grid placement; known gap 4 asks for a verse-wide positional rhyme
graph. This registers what the layer will claim, and what would sink it.

## The assumption that has to be declared first

**There is no audio anywhere in this project.** Text does not contain timing.
So a "beat grid" here is not measured, it is *assumed*, and the assumption is:

> Syllables (or stresses — see the grid unit below) are evenly spaced in time.

For English this is known to be false. English is stress-timed, not
syllable-timed, so syllable-isochrony is the wrong model and stress-isochrony
is the less wrong one. The assumption is less bad for rap over short spans than
for sung verse over long ones, and it is a *declared coordinate*, not a
finding. Anything the layer reports is conditional on it, and any claim that
outruns it is void.

## The measure

Lay an item's syllables end to end and index them. Some syllables participate
in a rhyme relation — these are the **rhyme events**. Reduce each event's index
modulo a candidate period `P` to get its **phase**. Then:

```
KL( phase distribution of rhyme events || phase distribution of ALL syllables )
```

Two properties make this the right shape, and both were arrived at
independently before this file was written:

- **Phase-invariant.** Both distributions live in the same phase frame, so the
  statistic never needs to know where the downbeat is. No downbeat detection,
  nothing to get wrong.
- **Self-normalizing.** The null is the item's *own* syllable stream, so no
  external corpus is consulted. That matters for doctrine 13: a resource used
  to score a cell must be independent of that cell's label, and the safest way
  to satisfy it is to use no external resource at all. It also absorbs the
  truncation artifact — 47 syllables at P=4 gives phases 0,1,2 twelve slots and
  phase 3 eleven, and a uniform null would read that asymmetry as signal.

## The degeneracy that would void the whole thing

In an isosyllabic form, **line-final rhyme phase is determined by the form.**
Every line of a sonnet is ten syllables, so every line-final syllable sits at
the same phase, and KL goes to its maximum by construction — measuring the form
and calling it craft. This is exactly the shape of the blocker recorded as
doctrine 14: a control defined in terms of the quantity it controls.

Two commitments follow, both binding:

1. **Line-final events are excluded from the primary statistic.** The claim is
   about *internal* rhyme placement. A separate line-final-only run is
   registered below as a NEGATIVE control that must come out null.
2. **The permutation null preserves line-length structure.** Positions are
   permuted within the item's own line-length layout, so anything the form
   forces is present in the null too.

## Declared parameters, fixed now

| coordinate | value |
|---|---|
| grid unit, primary | **stress** — English is stress-timed |
| grid unit, secondary | syllable — reported, not primary |
| period range swept | P ∈ {2, 3, 4, 6, 8} |
| rhyme threshold | `Declaration.theta_rhyme + 0.05` = 0.80, the same value `internal_matches` already uses |
| event definition | a syllable participating in at least one internal match at or above theta |
| permutations | 2000 per item |
| sweep correction | the null is computed over the SAME sweep, i.e. the permuted statistic is `max_P KL`, so the maximum-over-P is inside the null and needs no separate correction |
| multiple items | Benjamini-Hochberg at q=0.10, as in the rest of this project |

The sweep correction is the load-bearing one. Reporting `max_P KL` against a
null built at fixed P would find a period in pure noise.

## Predictions

**H1 — rap organizes internal rhyme against a period; the sonnet does not.**
`verse.txt` (62 lines) shows KL above its permutation null at p < .05; the 152
sonnets do not, in aggregate. Predicted direction: **rap > sonnet**.

I expect the sonnet arm to be **null**, and I am registering that as the
prediction rather than as a fallback. Internal rhyme in the sonnets is sparse
and mostly incidental. If the sonnets come out significant, the most likely
explanation is not that Shakespeare wrote to a beat but that the statistic is
reading the pentameter — which is a defect, not a discovery.

**H2 — the recovered period is binary in rap.** The best-fitting P in
`verse.txt` is in {2, 4, 8} rather than {3, 6}.

**H3 — NEGATIVE CONTROL, must come out null.** Line-final-only events in the
isosyllabic sonnets must NOT separate from their permutation null. If this
control fires, the statistic is reading form rather than placement and every
other result in the layer is void. This one is not a prediction I want to be
right about; it is the tripwire.

**H4 — NEGATIVE CONTROL, must come out null.** Shuffling the rhyme *labels*
across syllable positions while holding the position multiset fixed must
destroy the effect. Same logic as the shuffle twin in `controls.py`: preserve
every marginal, destroy only the pairing.

**H5 — the effect survives the grid-unit swap in direction, not magnitude.**
If rap is significant on the stress grid but reverses sign on the syllable
grid, the result is an artifact of the isochrony assumption rather than a fact
about the verse.

## What would falsify the layer outright

- H3 fires. The statistic reads form.
- H4 fires. The statistic reads position density, not rhyme.
- H1 comes out with rap null and sonnet significant. That is the pentameter
  hypothesis and it means the measure is inverted from its stated purpose.
- The permutation null's own false-positive rate, measured by running the
  whole sweep on label-permuted input, exceeds its nominal alpha by more than
  a factor of two. That would mean the sweep correction does not work.

## What this layer will NOT claim

It will not claim to measure timing. It measures **rhyme placement in syllable
or stress coordinates under a declared isochrony assumption**, which is a
weaker and different thing. Until audio or a declared tempo enters the project,
"on the beat" is not a statement this code can make, and no output of it should
be worded as though it were.

It will also not produce a score. Doctrine 6 applies here as everywhere: the
layer reports a statistic, its null, and its p-value, and any weighting against
other layers has to be invented in the open by whoever wants it.

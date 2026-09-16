# Declaring metric complexity

A blueprint section accepts an optional `metric_complexity` array. The shared
validator rejects unknown kinds, unknown fields, invalid numbers and events
outside the section. Both blueprint readers preserve the declarations;
`fit.fit_song(...).table()` returns their exact calculated results and the
`fit` command prints them. Without the field, existing fit output is unchanged.

Run from `lyric-harness/`:

```sh
python3 lyric_harness.py fit quality/fixtures/metric_complexity.blueprint.json
python3 quality/test_meter.py
```

The fixture is an artificial instrumental example, not a transcription or a
claim about any tradition. It exercises all seven kinds without requiring a
pronunciation model.

## Coordinates and kinds

Numbers may be integers, finite decimals, or rational strings such as `"2/3"`.
Decimals retain their written decimal value. Results serialize fractions as
strings so a consumer does not lose exact timing to floating-point conversion.
Booleans are not numbers. Required fields have no implicit musical defaults.

| `kind` | Required fields | Optional fields | Result |
|---|---|---|---|
| `metric_modulation` | `old_pivot`, `new_pivot`, `old_beat`, `new_beat` | `at=0`, `old_bpm` | Exact new/old BPM multiplier; new BPM only when old BPM is supplied |
| `hemiola` | `span` | `start=0`, `target_groups=3`, `mode="successive"` | Reference and target accent onsets, two against three or the reverse; `simultaneous` also accepted |
| `tuplet` | `count`, `normal`, `note_pulses` | `start=0`, `parent_scale=1` | Span, note duration, onsets and duration multiplier |
| `swing` | `ratio`, `pair_span`, `pairs` | `start=0` | Two durations and the onsets of every pair |
| `rubato` | `span` | `start=0`, `mode="rubato"`, `anchors=[]` | Declared relative performed span, or unknown timing; `senza_misura` also accepted |
| `hypermeter` | `groups` | `phase=0` | Period, cycle heads and group heads in bars |
| `metric_dissonance` | `reference_period`, `competing_period`, `span` | `reference_phase=0`, `competing_phase=0`, `start=0` | Grouping/displacement flags, composite period and both accent layers |

Except for modulation note values and hypermeter, coordinates use the section
meter's **denominator pulses**, measured from zero at the section's beginning.
A 6/8 section therefore has six pulses per bar. Event spans are half-open;
an onset at their end belongs to the following event. Phases are relative to
the section origin, not the event's start. Repeated section names retain
independent declarations.

Modulation's note values are **whole-note fractions**. `old_pivot` equals
`new_pivot` in elapsed time across the change. The multiplier is
`(new_pivot / new_beat) / (old_pivot / old_beat)`. Old dotted quarter = new
quarter, with quarter-note BPM on both sides, changes 120 to 80. A modulation
is a local relationship, not a song tempo map; absent BPM stays unknown.

A tuplet puts `count` notes into the span of `normal` notes. Nesting multiplies
the enclosing duration scales: a triplet's `2/3` parent scale applied to a
5:4 group of quarter-pulse notes gives five durations of `2/15` pulse.

Swing accepts any positive ratio, including `1.37`, straight `1`, and reversed
ratios below one. Every pair conserves `pair_span`. No binary straight/swing
switch or tempo-dependent ratio is inferred.

Rubato anchors are `[score_offset, performed_offset]` pairs, local to the
event. They start at `[0, 0]`, end at the score span and increase strictly
in both coordinates. `Rubato.performed_at()` interpolates linearly between
anchors; it neither extrapolates nor invents compensation. Performed offsets
are **relative pulse units, not seconds**. Without anchors, both rubato and
senza misura express intent and return unknown timing. The section meter
remains a score-address scaffold even for senza misura; it does not establish
a performed pulse or barline.

Hypermeter uses whole **bars**, not pulses; `[2, 3]` is an ordered five-bar
cycle. Its phase and every accent head are zero-based section bar offsets.

Metric dissonance describes two explicitly periodic accent layers. Non-nesting
periods are grouping dissonance; a phase difference incompatible with their
common rational tick is displacement. The flags may coexist. Aligned nested
periods remain consonant in this structural model. The composite period is a
repeat period of the combined pattern, not a promise of coincident accents
(displaced equal-period layers never coincide). This is not a perceptual score.

## Scope

These are independently declared layers, not a chain of automatic transforms.
The fit report labels them as rhythmic intent. It continues to grade the
**score-pulse** placements and any explicitly requested subdivision/isochrony.
These events do not assign syllables, infer timing from words, change a
`BeatGrid`, generate audio, or silently alter the planner's sampling space.
A caller that needs syllable onsets must still supply a setting. There is no
new work in the lyric pipeline for blueprints that omit the field beyond
checking whether the field exists.

Expansion is bounded before event results are built: at most 1,000 declarations
and 100,000 expanded positions per section, using the meter module's existing
resource-limit convention. Direct positional expansions are bounded too.
Malformed declarations raise `ValueError` through the CLI's existing refusal
path. `quality/test_meter.py` covers calculation, refusal, resource bounds,
reader parity, repeated names, absent-field conservation and the real CLI.

Terminology reference: [Integrated Musicianship, Advanced rhythm and meters](https://intmus.github.io/inttheory18-19/21-beyond-simple-compound-meters/a2-tx-advancedmeterandrhythm.html).
The coordinate schema and exact algorithms above are this project's declared
representation choices, not a sourced catalogue of repertoire practices.

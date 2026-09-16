# Melody-first writing

Declare a monophonic phrase before writing. The phrase repeats for every lyric
line. The planner draws song structure and rhyme constraints while taking the
meter, phrase length and subdivision from your tune. It does not draw a pickup.
The lyric and recipe engines remain independent.

From `lyric-harness/`:

```sh
python3 lyric_harness.py plan --seed=3 --lines=16 --narrative=off --melody='{"meter":{"beats":4,"unit":4,"groups":[2,2]},"bars":2,"subdivision":2,"notes":[{"pitch_hz":432.5,"ticks":3},{"pitch_hz":null,"ticks":1},{"pitch_hz":487.2,"ticks":4},{"pitch_hz":432.5,"ticks":8}]}'
```

The printed writer brief includes every note and rest. Write the words, then
use the printed fill command to obtain the blueprint and rendered song. Carry
the identical declaration to `finish --melody=JSON` for revision. The shared
connector accepts the same JSON string as `melody` on `lyric_sweep`,
`lyric_plan`, `lyric_grade`, and `lyric_revise`. Hosted continuation carries it
with the other run declarations; changing it requires a new run.

The Python entrance accepts a dictionary as `make_plan(melody=...)`.

| Coordinate | Meaning |
|---|---|
| `meter.beats`, `meter.unit`, `meter.groups` | Existing meter grid; groups of 2 or 3 sum to beats |
| `bars` | Positive integer bars per lyric line |
| `subdivision` | 1, 2, or 4 ticks per beat |
| `notes[].pitch_hz` | Positive finite frequency, or null for a rest; no assumed tuning |
| `notes[].ticks` | Positive integer duration; events are contiguous in order |

Event durations must sum exactly to bars × beats × subdivision, with at least
one pitched event. The phrase must fit the planner's existing beat/slot
envelope. Unknown fields and unsupported shapes refuse rather than being
silently simplified. No melody declaration leaves existing seeded planning
unchanged.

This entrance consumes a symbolic repeating phrase. It does not transcribe
recordings or MIDI, arrange different phrases per section, assign syllables to
notes, or certify sung pitches. Rests and note durations are instructions to
the writer; existing grading checks the full phrase's line grid capacity, not
an exact underlay. A successful lyric grade does not certify those axes.

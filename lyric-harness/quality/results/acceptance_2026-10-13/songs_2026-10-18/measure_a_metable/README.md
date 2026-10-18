# Measurement (a): can every line of a plan be met with no unavoidable note? (BB8, 2026-10-18)

The team asked for this after John rejected the line-length premise (#519). It measures the
instrument, not taste. `measure.py` is a scratch simulation: it wraps the planner's own draw
functions in one process and changes no repository file. Seeds 0–999, 16 lines, verse-chorus,
on the brief branch (`bb8/brief-pulses-heads`), whose only change is brief text, so the draws are
main's.

**What "metable" means.** A line of d pulses with H group heads is metable when some syllable
count avoids SPARSE, CROWDED, HEADS_EXCEED_UNITS and PROMINENCE_EXCEEDS_HEADS:
- **Today's grader:** d must be whole, H at least 1, and H at most d.
- **With R2's gate** (CROWDED only when the line needs a finer grid than the plan declared):
  ceil(d) syllables also work on a fractional span when the declared subdivision covers it.

A plan is metable when every one of its lines is.

| default draw | plans | metable today | with R2's gate | beats/line p10 / median / p90 | ≤16 beats | >64 beats |
|---|---|---|---|---|---|---|
| uniform over beat counts (today) | 998 | 37.4% | 98.9% | 20 / 97 / 179 | 8.0% | 68.5% |
| log-uniform (equal weight per doubling) | 976 | 34.7% | 84.6% | 3 / 17 / 114 | 49.4% | 25.5% |
| uniform, whole-pulse pickups only | 998 | 98.9% | 98.9% | 20 / 97 / 179 | 8.0% | 68.5% |

**What this says:**
1. **The draw isn't the main defect.** Under today's grader, nearly two thirds of plans contain a
   line no writer can meet without a note. The cause is fractional spans from half- and
   quarter-beat pickups meeting a CROWDED rule that ignores the plan's own subdivision.
2. **Two fixes reach about 99%.** R2's grader gate keeps every pickup reachable. Banning
   fractional pickups removes legitimate shapes, so the gate is the fix that keeps everything
   reachable.
3. **Log-uniform is worse on this measure,** 84.6% even with the gate. 150 of its 1,000 plans
   contain a short pickup line whose span holds no group head. Seed 11 has a 3/8 bar in one group
   and a line entering at beat 1.5 for 2.5 pulses, ending on the barline. Any stressed syllable
   there draws PROMINENCE_EXCEEDS_HEADS. That's a second unmeetable class; under today's long
   lines it's rare (about 1%).
4. **The choice of default measure is still John's.** This table says it should be made apart
   from the two instrument faults above.

## Correction (19:55 UTC), following 3PO's caution on #519 (6254354023)

"Metable" here means **no unavoidable informational note**. It doesn't mean an obligation can be
met or failed: every code counted (SPARSE, CROWDED, HEADS_EXCEED_UNITS,
PROMINENCE_EXCEEDS_HEADS) has severity *note*, and none of the counted cases is a standing flag or
a refused obligation. So the columns are:
- **today:** plans with no unavoidable informational note;
- **with R2's gate:** satisfiable at the plan's declared subdivision.

"Nothing can satisfy" above overstates it. Group heads are grid landmarks, not a required stress
count. Log-uniform here means discrete weights of 1/n over the integer beat values 2–200.

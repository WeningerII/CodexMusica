# Pre-registration — bounding the schema door by LINE DISTANCE

**Registered 2026-09-18, before any number is read.** `MISSING.md` M-240 names
the remedy and says in the same breath what it owes:

> a schema door that considers a pair only within a bounded LINE DISTANCE,
> which makes the stream linear in the draft and removes the wall. It changes
> what "the 77 schemas over the whole draft" MEANS — a cross-line schema
> satisfied at distance 40 would no longer be found — so it needs its own
> preregistration with a null (what fraction of the pairs the whole-draft door
> rescues today lie beyond the window, over the corpus)

This is that registration. It is written before the runner exists, and the
window is declared here rather than chosen after the answer, because a window
picked to make a table look good is doctrine 19's argmax over a swept parameter
wearing a histogram.

## The defect being removed, stated as a cost and not as a complaint

`relations.whole_vocabulary_pairs` builds every candidate pair over the WHOLE
draft, so its cost grows with the square of the line count, and
`relations.realise` stops at a declared guard. MEASURED by M-240 on the
planner's own dummy draft through `Reviser.inspect`:

| lines | result |
|--:|---|
| 53 | graded, 56 s |
| 108 | graded, 330 s |
| 144 | refused, candidate explosion, 7.7 s |
| 314 | the same, 77 s |

A named refusal shipped for the wall; the door that scales did not. A writer
whose draft is 144 lines cannot be graded at the default door at all.

## What is NOT in dispute

The 77-schema default stays and is not narrowed by name. This registration
changes WHICH PAIRS THE DOOR IS ASKED ABOUT, never which schemas answer. A pair
inside the window is judged exactly as it is today, by the same judge, with the
same names, and a declared relation per group still bypasses the door entirely.

## The hypothesis

**H.** The line distances at which the whole-draft schema door actually rescues
a mandated pair are concentrated near zero, so a window small enough to make the
stream linear retains almost every rescue the door makes today.

H is plausible and is NOT assumed: several of the schemas that do most of the
rescuing are already gap-bounded by their own declarations, and M-140's split
measured the rescue population as `consonance` 10, `internal rhyme` 10,
`multisyllabic rhyme` 3, `assonance` 2, `anaphora` 2 on the sonnet battery. It
is also possible that the mandate's own shape does the work: a rhyme scheme
binds lines a few apart, so a rescue at distance 40 may be rare because the
MANDATE rarely reaches that far, which would make the window nearly free for a
reason that has nothing to do with the schemas.

## The declared windows, fixed before the run

`W ∈ {2, 4, 8, 16, 32}` lines, plus `∞` as the control, which is the shipped
door. Five values and no others; a sixth added after seeing the table would be
the sweep this registration exists to refuse.

**THE SELECTION RULE IS DECLARED HERE AND IS NOT AN ARGMAX.** The adopted window
is **the SMALLEST declared `W` that retains at least 99.0% of the `∞` door's
rescues on every population measured**. If no declared `W` reaches 99.0% on
every population, the answer is that no window in this set is free and the
remedy is **REFUSED** rather than adopted at a lower bar.

## The populations, with their sizes

1. **The maintained sonnet battery**, 152 sonnets under `SONNET_SCHEME`, whose
   whole-draft rescue count is already pinned at 17 by
   `quality/schema_end_reading.py`. Small, and named first because its answer is
   already banked and so cannot be quietly re-derived to suit.
2. **`corpus/song/eng_*` items inside the gradeable range**, under the mandate
   `recover.py` derives from the printed text, which is the only mandate a
   corpus item has. Reported per item and pooled only as a rate.
3. **The shipped lyric fixtures and `songs/` drafts**, under their own declared
   mandates, which is the population a writer actually meets.

Counts are reported per population and **never pooled across them** (doctrine
79): a sonnet's mandated pairs and a song's are different objects, and M-140's
entry already records that a one-word-line chance rate does not transfer.

## The statistic

For each population and each declared `W`:

1. `rescues(W)` — mandated pairs the scalar door fails and the schema door
   rescues when only pairs at line distance ≤ W are considered.
2. `retained(W) = rescues(W) / rescues(∞)`, the quantity the selection rule
   reads.
3. `lost(W)` — the pairs `∞` rescues and `W` does not, listed with their line
   distance and the schema that answered, because a rate without its members is
   a number nobody can argue with.
4. The distribution of line distance over `rescues(∞)`, which is the null this
   registration owes and is reported whether or not any window is adopted.

## The falsifiers, each with the number that fires it

### E1 — no declared window is free

No `W` reaches 99.0% retention on every population. **The remedy is REFUSED**
and the entry records that the whole-draft door is doing work a window cannot
reproduce. This is a real possible outcome and is named first so that adopting a
weaker bar later reads as the retreat it would be.

### E2 — the window is free because the MANDATE is short, not because the
### schemas are local

If the line-distance distribution of `rescues(∞)` is bounded above by the
distribution of the MANDATE's own pair distances, then the window is free for a
reason that has nothing to do with the schema door, and the finding is about
mandates rather than about schemas. Adopted either way, **reported as the
mandate's property** and not as the door's, because the two would be one claim
otherwise.

### E3 — the wall does not move

If a 144-line draft still refuses at the guard under the adopted `W`, the
remedy has not done the thing it was proposed for. **Adoption is withdrawn.**
The check is the measured ladder above re-run at 144 and 314 lines.

### E4 — a verdict moves inside the window

Any pair at distance ≤ W whose `satisfied_by`, `relation`, `score` or violation
status differs between the `∞` door and the windowed door. **This must be zero**
by construction, and measuring it is how the construction is checked rather than
trusted.

## What is adopted if it holds

`relations.whole_vocabulary_pairs` takes a declared window, `Declaration` or the
call site carries it, and the shipped value is the `W` the selection rule picks.
The window is a DECLARED coordinate and is disclosed in the grade's own report
beside the rescue count, so a reader can tell a draft graded at `W=8` from one
graded at `∞`.

## What this will NOT claim

That a rescue beyond the window was wrong. It was a real relation correctly
judged, and dropping it is a COST this registration prices rather than a defect
it repairs. That the adopted window is transferable to a population not measured
here. That the wall is the only square law the connector meets: M-240 records a
SECOND one, the report's own output cap, which this does not touch.

## The runner

`python3 quality/schema_window.py` derives the table over every population and
window and prints the line-distance distribution; `--check` re-derives the
adopted retention against the committed figures. Registered before it was
written.

# Songs this harness produced

Every song here was PLANNED by `quality/plan.py`, screened pair-by-pair
BEFORE a word was written, graded by `song`, and driven to a stop condition
by `revise`. Each carries the seed and the exact commands that re-derive it,
because a song that cannot be re-derived is a text file with a story attached.

**These are NOT corpus.** Nothing here is measured, calibrated or sampled
from — `data/sources.tsv` governs `corpus/`, and admitting the harness's own
output to the population it calibrates against would be the circularity
doctrine 13/14 forbids: a resource used to score a cell may not be defined in
terms of that cell.

The blueprint beside each lyric is the FILLED plan (`plan --fill`), so the
grading command below runs without re-deriving anything.

**THE COMMITTED BLUEPRINTS ARE PRETTIER-FORMATTED AND `plan --out` IS NOT**
(`MISSING.md` M-94). Re-running any reproduction command below rewrites its
blueprint at `indent=1` and the repository's `gate` job refuses that file, so
the re-derived artifact is byte-different from the committed one. It is not a
different DECLARATION: whitespace cannot reach a grade through a parser, and
`song` returns a byte-identical finding set on either spelling. Run
`npx prettier --write` on the file after re-deriving it.

---

## `keep_the_light.txt` — seed 22, 3/8 grouped 3

    python3 lyric_harness.py plan --seed=22
    python3 lyric_harness.py plan --seed=22 --fill=songs/keep_the_light.txt \
        --out=songs/keep_the_light.blueprint.json
    python3 lyric_harness.py song songs/keep_the_light.blueprint.json \
        songs/keep_the_light.txt \
        '--groups=1.T3,3.T7,4.T7;2.headrime,3;1.T7,2;11.T5,12.T2;10.T6,12.endword;16.head,17.T1;15.T7,16,17.T3;15.headrime,16.T3,17' \
        '--returns=6,9;6,14' --subdivision 2

`song` exit 0, 0 FLAG. `revise` SUCCESS in 0 rounds, draft unchanged
(md5 `4f1eea69e65c`), 16 pairs mandated / 16 judged / 0 refused.

The first pass did NOT pass: `SLOTS_EXCEEDED` on L5, "11 syllables, 10
slots". The prechorus carries a one-beat pickup that eats 2 of the 12
pulses and the line had been counted against the full bar. Recorded because
the meter layer caught an arithmetic error the writer made, which is what it
is for.

## `one_more.txt` — seed 102, 4/4

    python3 lyric_harness.py song songs/one_more.blueprint.json \
        songs/one_more.txt \
        '--groups=1.endword,2.endword;4.T3,5.T1;4.T4,5.T3;4.T6,5.endword;10.T4,11.T6;10.T3,11.T4;18.head,19;17.headrime,18.T2;17.T7,19.headrime;17.T5,18.endword' \
        '--returns=9,15' --subdivision 4

`song` exit 0, 0 FLAG. `revise` SUCCESS in 0 rounds, md5 `69a6577d4a5c`,
11 pairs mandated / 11 judged / 0 refused.

## `turn_the_wheel.txt` — seed 189, 3/8 grouped 3

    python3 lyric_harness.py song songs/turn_the_wheel.blueprint.json \
        songs/turn_the_wheel.txt \
        '--groups=1.T4,2.endword;3.endword,4.headrime;8.headrime,9;8.T3,9.head;8.T7,9.T5;8.T5,9.T6' \
        '--returns=1,5;2,6;1,10;2,11' --subdivision 4

`song` exit 0, 0 FLAG. `revise` SUCCESS in 0 rounds, md5 `f5ed3b7d8cea`,
10 pairs mandated / 10 judged / 0 refused.

## `stay_awake.txt` — seed 568, 2/4 grouped 2, title DECLARED

    python3 lyric_harness.py plan --seed=568
    python3 lyric_harness.py plan --seed=568 --title='Stay Awake' \
        --fill=songs/stay_awake.txt --out=songs/stay_awake.blueprint.json
    python3 lyric_harness.py song songs/stay_awake.blueprint.json \
        songs/stay_awake.txt \
        '--groups=1.T3,2.endword;1.T1,2.T1;1.T5,2.T5;5.T6,7.T5;5,6.T4;5.T1,6.T3;9.T7,10.T4,11.T6;9.T4,10.T5,11.headrime;15.headrime,16.headrime;15.T2,16;15.T3,16.T4' \
        '--returns=4,13' --subdivision 2

`song` exit 0, 0 FLAG. `revise` SUCCESS in 0 rounds on the committed draft,
UNCHANGED (md5 `df36634e2601`), 16 pairs mandated / 16 judged / 0 refused.

The seed came from the sweep verb, not from taste — the sweep plans all 899
seeds in `1-899`, refuses none, and **accepts 23** (2.6%). 568 is one of them,
named in seed order because a sweep does not rank (doctrine 7/19):

    python3 lyric_harness.py plan --sweep=1-900 \
        --want='slots_per_line>=10;pins_per_line<=3;lines>=16;lines<=30'

Ten sections — `intro-build-chorus-false_ending-turnaround-verse-prechorus-`
`chorus-reprise-coda` — 10 beats a line over 5 bars of 2/4, 20 slots at
subdivision 2, hook at line 4 returning verbatim at line 13.

**THE FIRST GREEN DRAFT WAS NOT THE FIRST DRAFT, AND THE LOOP SAID WHY.**
`song` came back exit 3 on the M-88 ban gate: `PREDICTABLE_RHYME`, 6 of 7
rhymes above 0.90 predictability against a `predictable_pair_fraction_max` of
0.8333. Two hand-picked swaps did not move it, which is the point at which
guessing stops being work — so the fix went through `revise --propose=defer:`
instead, and the loop asked for two COUPLED rewrites it could not make itself
(both pivots whose complete-pool joint search came back empty). The writer
answered both, and the second draft is what shipped:

| line | was | became |
|---|---|---|
| L5 | `Cinder goes down to one ember, night lifts siege` | `Cinder goes down to one ember in the metal` |
| L6 | `Down below, winter hedge holds its own dark` | `Down below, winter nettle holds its own vigil` |
| L16 | `Siren in the weather takes what we offer` | `Siren in the weather empties the coffer` |

The loop scored the first pair **fixed 8, introduced 0** and the second
**fixed 2, introduced 0**, and closed L7 without asking about it — an earlier
fix in the same round had already resolved it.

`hedge` is why the loop had to backtrack rather than swap one word. Screened
before anything was rewritten: `ledge`, `wedge`, `pledge`, `sledge` and
`dredge` all come back BANNED as tier-1 HOMEOTELEUTON — one spelled rime
`edge` on both sides — and the only clean answer the pool had was `allege`,
which is not a word this song can end a line on. A family whose members all
spell their rime the same way has a rhyme CEILING near one, and `screen` says
so before a word is written. `metal ~ nettle` scores the same 1.000 and is
CLEAN, because `etal` and `ettle` are two spellings of one sound.

This is the first song here whose blueprint carries a `title`, so it is the
first whose `TITLE_UNDECLARED` refusal is answered rather than reported —
`MISSING.md` M-93, and `plan --title=` is the entrance that made it possible
without editing the planner's own output by hand.

---

## What the screen cost, measured

The first draft of the flood song (seed 108, since superseded) had **15 of
16 rhyme pairs come back BANNED as MODAL_RHYME** — every one the most
predictable partner in its family. Two whole sound families, `/OW/` and
`/AA-R-K/`, turned out unusable: every pair inside them is somebody's modal
answer. That is doctrine 9 enforced before a word ships rather than argued
about afterwards.

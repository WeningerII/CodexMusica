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

---

## What the screen cost, measured

The first draft of the flood song (seed 108, since superseded) had **15 of
16 rhyme pairs come back BANNED as MODAL_RHYME** — every one the most
predictable partner in its family. Two whole sound families, `/OW/` and
`/AA-R-K/`, turned out unusable: every pair inside them is somebody's modal
answer. That is doctrine 9 enforced before a word ships rather than argued
about afterwards.

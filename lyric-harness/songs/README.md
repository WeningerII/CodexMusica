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

Its blueprint carries a declared `title`, so `TITLE_UNDECLARED` is answered
here rather than reported —
`MISSING.md` M-93, and `plan --title=` is the entrance that made it possible
without editing the planner's own output by hand.

## `carry_it_over.txt` — "Carry It", seed 394, 8/8 grouped 3+3+2

    python3 lyric_harness.py plan --sweep=1-700 \
        --want='uses=bridge;lines>=20;lines<=28;slots_per_line>=8;pins_per_line<=3'
    python3 lyric_harness.py plan --seed=394
    python3 lyric_harness.py plan --seed=394 --title='Carry It' \
        --fill=songs/carry_it_over.txt --out=songs/carry_it_over.blueprint.json
    python3 lyric_harness.py song songs/carry_it_over.blueprint.json \
        songs/carry_it_over.txt \
        '--groups=1.head,2.endword;1.T2,2.T1;3,4.T2;5.T6,6.head;5.T3,6.T6;9.T4,10.headrime;9,10.T3;9.T5,10.T6;11.T6,12.headrime' \
        '--returns=7,17;7,20' --subdivision 1

`song` exit 0, 0 FLAG. `revise` SUCCESS in 0 rounds, draft UNCHANGED
(md5 `89bcde433fbe`), 11 pairs mandated / 11 judged / 0 refused.

**25 lines, 23 sections, 8/8 grouped 3+3+2** — an additive limp rather than a
march, one bar to a line, so the lines are SHORT: 8 slots on a downbeat and
**7 on the one-beat pickup**. Three instrumental INTERLUDEs carry bars and no
words. Hook at line 7, verbatim at 17 and 20. Its roster declares a
`bridge`, and its blueprint a title — "Carry It" is in the hook.

**THE FIRST DRAFT PASSED EVERY GATE AND WAS NOT A SONG.** It is worth
recording what it looked like, because nothing in this repository can tell
the difference and a reader will otherwise assume exit 0 means the writing is
fine:

| first draft | rewrite |
|---|---|
| `Tide is cussed, iron, salt, mourn` | `Father crossed tide, ice and war` |
| `Over. Over. The far bank.` | `He went last winter. Quick, they said.` |
| `A name on every crate` | `He said that. Now I say it.` |

The left column is atmosphere stacked into token positions. It happened
because the order got inverted: eight of nine screened pairs came back
BANNED, so the design was rebuilt by shopping for rhyme WORDS and then
building lines backwards from *token 6 must be `arc`, at most 7 syllables*.
The words chose the sentences. `Tide is cussed, iron, salt, mourn` is what
falls out when a line needs six tokens with rhymes pinned at 3 and 6 and the
writer stops insisting it be a sentence.

**THE REWRITE KEEPS EVERY CONSTRAINT AND CHANGES THE ORDER OF WORK.** Same
seed, same 9 groups, same slot budget, every pair still screened first — but
each line is written as something a person says, and the pin word is chosen
from the clean set that *fits that sentence*. Three people now: a father who
crossed in the war, the speaker he taught, and the boy being taught tonight.
The hook is inherited rather than stated — `He said that. Now I say it.` —
and the last line is what happens to an inherited instruction when the person
who gave it is gone.

**WHAT THE SCREEN COST, AND THE TWO FAMILIES THAT COST EVERYTHING.** Eleven
families went through `screen`; the clean yield per family is the
measurement:

| family | clean pairs of 15 |
|---|---|
| `-ell` (bell, knell, quell, gel…) | 7 |
| `-ear` (year, here, near, fear, clear, sheer) | 7 |
| `-ide` (tide, sighed, dyed, wide…) | 6 |
| `-ay` (weigh, grey, prey, sleigh…) | 5 |
| `-ust` (rust, dust, bust ~ cussed) | 4 |
| `-ark` (spark, arc, hark, lark) | 3 |
| `-or` (oar, shore, soar, war, door) | 3 |
| `-orn` (torn, borne, mourn…) | 1 |
| `-eight/-ait` (freight, strait…) | 1 |
| `-old` (cold, rolled, tolled, hauled…) | **0** |
| `-ame` (name, came, blame, shame…) | **0** |

Two families have a rhyme CEILING of zero: every member is either
homoeoteleuton with the others or somebody's modal answer. `-ame` is the
starker case — `name`, `came`, `blame`, `shame`, `claim`, `flame`, and not
one usable pair among all fifteen.

**AND THE SLOT FLAGS WERE ALL THE PICKUP.** Every `SLOTS_EXCEEDED` came from
a one-beat pickup eating a slot, so a CHORUS line has seven and not eight.
`wire` cost one on its own — CMUdict reads it as two syllables (`W AY1 ER0`),
which is what a count in the head gets wrong and a grader does not.

## What the first measurement says, including about me

`songs/RESULTS.tsv` is the series: one row per (song, harness commit, date),
carrying the ten pre-registered features from `quality/features.py`. It exists
because every report about these songs until 2026-08-24 was a PASS/FAIL bit —
`song` exit 0, `revise` 0 rounds — read aloud as a judgement of quality. It is
not one. BOTH drafts of `carry_it_over` were exit 0 with 0 rounds, the
fragment version and the rewrite, and no gate in this tree can tell them apart.

    python3 quality/song_record.py --write    # score every song, append rows
    python3 quality/song_record.py --check    # re-derive; FAIL on drift
    python3 quality/song_record.py --claims   # README claims vs the numbers

**THE SONGS ARE FIXED WITNESSES.** Their bytes never change, so when a number
moves, THE TREE MOVED — a corpus load, a recalibrated band, a changed
tokeniser. That is why `harness_commit` is a key column and why `--check` is a
regression detector for the whole quality layer rather than a check on the
writing.

**WHAT IS REFUSED HERE:** a corpus-relative "quality score".
`quality/discriminate.py` fits its discriminator on SONNETS at a fixed 14-line
scheme; pushing a 25-line song in 8/8 through it and printing the number is a
measurement laundered out of its domain. The features are recorded; the
verdict against the song corpus is `quality/floor.py`'s song profile, which
already runs inside `song`.

**AND THE FIRST RUN DID NOT FLATTER THE NEWEST SONG.** On concreteness —
pre-registered as HIGHER in the survived/human class — `carry_it_over.txt` is
the lowest of the five at 3.043667 [RESULTS: concreteness_mean
carry_it_over.txt], against 3.909818 for `turn_the_wheel.txt`
[RESULTS: concreteness_mean turn_the_wheel.txt]. On rhyme predictability —
pre-registered as LOWER — `keep_the_light.txt` sits lowest at 0.816206
[RESULTS: rhyme_predictability_mean keep_the_light.txt]. Both readings run
against the story I had been telling, which is the point of writing the
numbers down before making the claim.

A comparison in this file must carry a `[RESULTS: <column> <song>]` citation
that resolves, or `--claims` fails. That check is aimed at the narrator.

---

## What the screen cost, measured

The first draft of the flood song (seed 108, since superseded) had **15 of
16 rhyme pairs come back BANNED as MODAL_RHYME** — every one the most
predictable partner in its family. Two whole sound families, `/OW/` and
`/AA-R-K/`, turned out unusable: every pair inside them is somebody's modal
answer. That is doctrine 9 enforced before a word ships rather than argued
about afterwards.

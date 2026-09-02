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

**THE `plan --seed=N` LINES BELOW DO NOT REPRODUCE AT HEAD, AND THE
BLUEPRINTS ARE WHAT REPRODUCE (recorded 2026-09-01 by the triage audit).**
The planner has moved since these seeds were banked — `stanza_line_floor`
(M-106), the song band 150 -> 200 (M-131/M-133), the participation reserve
(M-171), the density and recurrence coordinates of 2026-09-01 (M-190,
M-191), and the SHORT floor profile of the same day (M-193), which took the
planner's length envelope from 22–55 lines to **12–55** and re-rolled every
seed's drawn length — and a plan is a function of the seed AND the planner.
MEASURED before M-193: `plan --seed=22` drew **30 lines** at HEAD against
`keep_the_light.txt`'s 18; after it, every seed below draws a different
length again. Each song's `*.log.tsv` names the harness commit its plan was drawn at;
re-derive a plan at THAT commit, or grade against the committed blueprint,
which is the declaration the song was actually written to.

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

The seed came from the sweep and not from taste: it plans all 699 seeds in
`1-700`, is refused by the planner on 0 of them, and accepts 6 (0.9%) —
`2,232,394,503,510,614` [LOG: accepted_seeds carry_it_over.txt], named in seed
order because a sweep does not rank (doctrine 7/19).

**THE FIVE PREDICATES ARE ONE SESSION'S DECLARATION AND NO RULE IN THIS TREE
STANDS BEHIND ANY OF THEM.** `uses=bridge;lines>=20;lines<=28;slots_per_line>=8;pins_per_line<=3`
was typed on a command line while this song was being written. Checked rather
than remembered: `--want` has NO default (omit it and every seed is accepted,
and the verb says so out loud); no section function REQUIRES a bridge — the
only `requires` edges in the vocabulary are `burden`->`verse`,
`postchorus`->`chorus` and `prechorus`->`chorus`; and the string `uses=bridge`
occurs in exactly ONE place in this repository, which is the command line
above. A sweep does not decide what you want, so what a sweep accepted is a
fact about the want and never a fact about songs.
**AND THE BRIDGE PREDICATE HAS A NOTE STANDING BEHIND IT THAT IT SHOULD NOT
BE ANSWERING** (`MISSING.md` M-101). `song_function_report` emits
`FUNCTION_UNDECLARED: no section declares 'bridge'` — visible as
`finding:FUNCTION_UNDECLARED` in `turn_the_wheel.log.tsv` — and a sweep
predicate demanding a bridge silences it by steering the PLAN to satisfy the
CHECKER. That is doctrine 9's failure mode pointed at structure instead of
rhyme, and doctrine 7 says a floor may not order the region it already passed.
The note measures a CONVENTION a writer is free to depart from; designing the
plan around it is the error, whatever the note says.

**THOSE ARE THREE COUNTS AND ONLY ONE OF THEM IS ABOUT LEGALITY** (doctrine
79). `planned 699` beside `REFUSED by the planner 0` says every seed in the
range produced a WRITABLE plan — which is not luck but the plan-time joint
satisfiability gate working, since that gate went from 376 of 400 plans
failing to 0 of 400 when the three derivations behind it were repaired, and a
MUTATION is now the only way to fire it. The 0.9% is the acceptance rate for
the FIVE PREDICATES declared above and says nothing about legality: declare
fewer and it rises, declare none and it is 100%, which the verb itself calls
honest and useless. Reading the acceptance rate as a legality rate would put
the writer's own narrow want in the numerator and charge it to the planner.

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
families went through `screen`. Every row below is re-derived from
`carry_it_over.log.tsv` and each cell carries a `[LOG:]` citation, so a number
here that stops matching the log FAILS `--verdicts`. Three counts, never
summed (doctrine 79) — a BAN is the grader answering and a REFUSAL is the
grader saying it cannot read the word:

| family (members screened) | banned | refused | clean |
|---|---|---|---|
| `-ell` bell knell quell gel swell shell | 8 [LOG: banned carry_it_over.txt bell] | 0 [LOG: refused carry_it_over.txt bell] | 7 [LOG: clean_or_non_rhyme carry_it_over.txt bell] |
| `-ear` year here near fear clear sheer | 8 [LOG: banned carry_it_over.txt year] | 0 [LOG: refused carry_it_over.txt year] | 7 [LOG: clean_or_non_rhyme carry_it_over.txt year] |
| `-ide` tide sighed dyed wide | 2 [LOG: banned carry_it_over.txt tide] | 0 [LOG: refused carry_it_over.txt tide] | 4 [LOG: clean_or_non_rhyme carry_it_over.txt tide] |
| `-ay` weigh grey prey sleigh | 2 [LOG: banned carry_it_over.txt weigh] | 0 [LOG: refused carry_it_over.txt weigh] | 4 [LOG: clean_or_non_rhyme carry_it_over.txt weigh] |
| `-ust` rust dust bust cussed | 3 [LOG: banned carry_it_over.txt rust] | 0 [LOG: refused carry_it_over.txt rust] | 3 [LOG: clean_or_non_rhyme carry_it_over.txt rust] |
| `-ark` spark arc hark lark | 3 [LOG: banned carry_it_over.txt spark] | 0 [LOG: refused carry_it_over.txt spark] | 3 [LOG: clean_or_non_rhyme carry_it_over.txt spark] |
| `-or` oar shore soar war door | 7 [LOG: banned carry_it_over.txt oar] | 0 [LOG: refused carry_it_over.txt oar] | 3 [LOG: clean_or_non_rhyme carry_it_over.txt oar] |
| `-orn` torn borne mourn | 2 [LOG: banned carry_it_over.txt torn] | 0 [LOG: refused carry_it_over.txt torn] | 1 [LOG: clean_or_non_rhyme carry_it_over.txt torn] |
| `-eight/-ait` freight strait | 0 [LOG: banned carry_it_over.txt freight] | 0 [LOG: refused carry_it_over.txt freight] | 1 [LOG: clean_or_non_rhyme carry_it_over.txt freight] |
| `-old` cold rolled tolled hauled bowled scrolled | 10 [LOG: banned carry_it_over.txt cold] | 5 [LOG: refused carry_it_over.txt cold] | 0 [LOG: clean_or_non_rhyme carry_it_over.txt cold] |
| `-ame` name came blame shame claim flame | 15 [LOG: banned carry_it_over.txt name] | 0 [LOG: refused carry_it_over.txt name] | 0 [LOG: clean_or_non_rhyme carry_it_over.txt name] |

**THE TABLE THIS REPLACES HAD ONE DENOMINATOR AND ELEVEN POPULATIONS, AND
FIVE OF ITS ROWS WERE ARITHMETICALLY IMPOSSIBLE.** It read
~~`| family | clean pairs of 15 |`~~ with the members abbreviated behind an
ellipsis, and 15 is `C(6, 2)` — the pair count of a SIX-member family. Five
rows name four or five members, where the pair count is 6 or 10, so
~~`-ark (spark, arc, hark, lark) | 3`~~ claimed three clean pairs out of
fifteen in a family that has six. The denominator was written once and
carried across every row (doctrine 91: a count is a coordinate of the
RENDERING, not only of the threshold).

**THE NEW NUMBERS ARE NOT A CORRECTION OF THE OLD ONES**, and saying so
matters more than the numbers. The old table's member sets were never
recorded — the ellipses hid them — so ~~6~~ for `-ide` and ~~5~~ for `-ay`
were taken over LARGER sets than the four members named here. Two
measurements over two populations are two measurements; only the ones with a
`[LOG:]` citation are re-derivable, and that is exactly the property the old
table lacked.

**WHAT SURVIVES UNCHANGED IS THE FINDING.** Two families have a rhyme CEILING
of zero: every member is either homoeoteleuton with the others or somebody's
modal answer. `-ame` is the
starker case — `name`, `came`, `blame`, `shame`, `claim`, `flame`, and not
one usable pair among all fifteen.

**AND THE SLOT FLAGS WERE ALL THE PICKUP.** Every `SLOTS_EXCEEDED` came from
a one-beat pickup eating a slot, so a CHORUS line has seven and not eight.
`wire` cost one on its own — CMUdict reads it as two syllables (`W AY1 ER0`),
which is what a count in the head gets wrong and a grader does not.

## `long_bridge.txt` — "Where the Long Bridge Is Shown", seed 1, 3/8 grouped 3

    python3 lyric_harness.py plan --seed=1
    python3 lyric_harness.py plan --seed=1 --title='Where the Long Bridge Is Shown' \
        --fill=songs/long_bridge.txt --out=songs/long_bridge.blueprint.json
    python3 lyric_harness.py song songs/long_bridge.blueprint.json \
        songs/long_bridge.txt \
        '--groups=2.T5,3.T6,5.T3;4.T7,5.T2;1.T5,2.endword,3.T1;1.head,3.T7;6.T6,7.T7;8.headrime,9.T3;9.headrime,10.endword,11.T3;8.T3,9.T4,10.T7,11;9.T6,11.head;12,13.T7;12.T7,14.headrime;13.T4,14.T2,15.T5;12.T2,14.T5,15.T3;16.headrime,17.T1;18.endword,20.T6;19.T6,20.T1;19,20;21.T4,23.T4;21.T3,22.T3,23.headrime;21.T6,22.T7;22.T5,23.T5;24.T7,25.T5;24.T3,25.T2;3,5;6,7;8,9;16,17;21,23;24,25' --subdivision 4

`song` exit 0, 0 FLAG. `revise` SUCCESS in 0 rounds, draft UNCHANGED
(md5 `496d29cf7c02`), 46 pairs mandated / 46 judged / 0 refused.

**25 lines, 8 sections**, 3 beats a line over 1 bar of 3/8, 12 slots at
subdivision 4. Seed 1, no sweep and no `--want=`, so nothing about this shape
was selected for.

**AND IT IS NOT A GOOD SONG.** Recorded because that is the whole use of this
file: every gate above passed it, and the gates cannot hear it. The lines are
runs of short concrete nouns with the connective tissue squeezed out — the
same failure `carry_it_over`'s first draft is kept here for, and the note
under it applies unchanged: exit 0 is not a verdict about the writing, and no
measurement in this tree separates a stacked line from a sung one.

**I BLAMED THE PLAN FOR IT AND THE MEASUREMENT REFUSED THE BLAME.** The first
version of this paragraph read *"the plan is the suspect — 29 groups over 25
lines is 46 mandated pairs"*, i.e. that the line was too pinned to be written
as a sentence. Over the planner's first 120 seeds, mandated pairs per line
runs **min 0.88, p25 2.69, median 3.77, p75 5.04, max 10.14** — and this plan
is **1.84**, with **108 of 120 (90.0%)** at or above it. Line length does not
rescue the story either: median slots per line across those plans is **11**
and this plan's is **11**, dead on it, with 51.7% at or below. So the shape
was ORDINARY-TO-LOOSE on both axes and the writing still came out as
fragments. The pressure I described is real at the writing desk and it is not
what this plan applied.

**WHICH LEAVES THE FINDING WHERE IT IS LEAST CONVENIENT: THE DRAFT.** There is
no instrument here that could have told me so — that is the gap, and it is the
same one M-99 records for songs. The question this song does raise about the
planner is a different one and is not answered by it: if a plan in the bottom
decile of binding density reads like this, the median at 3.77 pairs per line
is worth looking at as a distribution rather than seed by seed.

**WHAT WENT WRONG BEFORE IT SHIPPED**, neither draft committed, so neither
has a row and `song_log.CLAIMS` charges nothing here. Draft 1: `SLOTS_EXCEEDED`
on L9 — `wire` is two syllables in CMUdict (`W AY1 ER0`) — plus a whole-draft
`FUNCTION_WORD_HEAVY`, from padding with `the`/`of`/`it` to reach a bound token
position. Draft 2 over-corrected into the opposite defect and the band caught
it: nine lines at 8–9 prominent syllables against the calibrated PROMINENCE
band's `[2, 7]`. The third shipped. The pair is the argument for the band
having two ends, and the direction of the over-correction is the same pressure
the paragraph above names.

**ITS PLAN DRAWS NO RETURNS, WHICH NO OTHER SONG HERE CAN SAY**, so the
grading command is `--groups=` and nothing else — 29 groups, **6 of them bare
line-number pairs** (`3,5`, `6,7`, `8,9`, `16,17`, `21,23`, `24,25`) added by
the end-rhyme pass (`MISSING.md` M-107). `RETURN_NEVER_RETURNS` therefore
stands as a NOTE, correctly: a plan with no declared return has nothing to
bring back.

**AND BANKING IT FOUND A LIVE DEFECT** (`MISSING.md` M-108). Every song above
declares `--returns=` beside its groups, which builds a real `Mandate` and
prints `N group(s) over L lines, P mandated pair(s)`. The bare `--groups=`
branch printed the group count and stopped, so `quality/song_log.py`'s
declared `song` parser banked NONE of its four mandate facts for this row and
did not refuse the row for it. Five songs went by without that being visible,
because all five decorate their groups. One header now; the 46-pair figure
above is the count it was withholding.

## `taught_me_time.txt` — "Wheels Hum", seed 1 AGAIN, the forward validation

    python3 lyric_harness.py plan --seed=1
    python3 lyric_harness.py plan --seed=1 --title='Wheels Hum' \
        --fill=songs/taught_me_time.txt --out=songs/taught_me_time.blueprint.json
    python3 lyric_harness.py song songs/taught_me_time.blueprint.json \
        songs/taught_me_time.txt \
        '--groups=2.T5,3.T6,5.T3;4.T7,5.T2;1.T5,2.endword,3.T1;1.head,3.T7;6.T6,7.T7;8.headrime,9.T3;9.headrime,10.endword,11.T3;8.T3,9.T4,10.T7,11;9.T6,11.head;12,13.T7;12.T7,14.headrime;13.T4,14.T2,15.T5;12.T2,14.T5,15.T3;16.headrime,17.T1;18.endword,20.T6;19.T6,20.T1;19,20;21.T4,23.T4;21.T3,22.T3,23.headrime;21.T6,22.T7;22.T5,23.T5;24.T7,25.T5;24.T3,25.T2;3,5;6,7;8,9;16,17;21,23;24,25' --subdivision 4

`song` exit 0, 0 FLAG. `revise` SUCCESS in 0 rounds, draft UNCHANGED
(md5 `09ff4ea8c521`), 46 pairs mandated / 46 judged / 0 refused.

**THE SEED IS 1 ON PURPOSE: THIS IS `long_bridge`'s PLAN, WRITTEN AGAIN WITH
THE GATES ITS FAILURE BUILT.** A plan is a pure function of its seed, so the
two songs are a matched pair — identical 29 groups, identical 3/8 bar,
identical pins — differing in exactly one thing: this one was written with
the sentencehood gate live (`MISSING.md` M-110) and every mandated pair
screened before a word went down. `long_bridge` reads 4 stacked lines and
grades exit 3 at head; this one reads 0 and grades exit 0. That pair is the
strong-form control the blind panel lacked, and the M-99 training shape.

**IT TOOK FOUR GRADING ROUNDS AND EVERY CATCH WAS A DIFFERENT LAYER'S.**
Round 1: 19 flags — the writer (me) ignored the pickups (a one-beat pickup
leaves a PRECHORUS line 8 slots, not 12 — the arithmetic error
`keep_the_light` has on record), and four pins sat on weak function words
(`out/We/I/Are`), which the anchor refuses: A RHYME PIN MUST BE A CONTENT
WORD. Round 2: 2 flags — `cruel` is two syllables and cannot answer
`school/rule`. Round 3: 0 flags and REFUSED anyway — the two-tier ban gate
stood on 15 lines of unscreened modal pairs, the exact price of skipping
`screen`, paid in full: 42 screen invocations follow in this song's log.
Round 4: one prominence flag, then green.

**WHAT THE SCREENS SAID ABOUT ENGLISH, banked as rows:** `taught~thought`,
`time~climb`, `home~roam`, `wait~straight` and the whole `guide/ride/wide`
family are BANNED — the obvious pairs are the modal pairs, which is doctrine
9 doing its job on the writer's first instincts. Seven common monosyllable
families (`-ap -ip -ump -ance -ill -op -ack`) measured ZERO clean pairs,
every member one spelled rime — the `-ame` ceiling again, five families
wider. What survived instead: a true 4-clique (`beware~midair~square~wear`)
and the odd couples (`hop~swap`, `again~zen`, `far~bizarre`).

**AND THE M-111 GLOSSARY WAS AVOIDED ON PURPOSE, MEASURED:** zero of the
twelve tic words the panel and the DF measurement flagged (`light, ache,
groan, nigh, thread, spare, stair, stone, crossed, quay, plea, grey`) appear
in this lyric. That is a writer discipline, not a gate — M-111 stays open,
and the next song should not need the discipline to be remembered.

## `wheat_mane.txt` — "Wheat Mane", seed 2, series song 3: first-round green

    python3 lyric_harness.py plan --seed=2
    python3 lyric_harness.py plan --seed=2 --title='Wheat Mane' \
        --fill=songs/wheat_mane.txt --out=songs/wheat_mane.blueprint.json
    python3 lyric_harness.py song songs/wheat_mane.blueprint.json \
        songs/wheat_mane.txt \
        '--groups=1.T2,2.headrime;1.headrime,2.T3,3.T1;1.endword,2.T2;4.T2,5.head,6.endword;4.T4,5.endword,6.headrime;7.T1,9.T3;8.T3,11.T2;10.T1,12.T2;7.T2,8.headrime,10.T3,12;7,9,10.T2;7.T4,9.head,12.T4;8.T4,9.T2,10.endword;9.T4,10.T4;13.headrime,14.T2,15.T1;13.endword,14.T3,15.endword;14.T4,15.T4;16,17.head;16.T1,18.endword;19.T2,20.T3;8,11;19,20' --subdivision 2

`song` exit 0, 0 FLAG **on the first grading round**. `revise` SUCCESS in 0
rounds, draft unchanged (md5 `9d305ba7768f`), 42 pairs mandated / 42 judged /
0 refused, 0 banned pairs, 0 stacked lines. The two forward-loop predecessors
priced the same gates at four grading rounds (`taught_me_time`) and a
post-hoc exit 3 (`long_bridge`); no other banked song has cleared them on
its opening pass, which is the per-song trend the series exists to measure
— one song is a point, not a slope.

**THE SCREEN DID THE WRITING'S HARD HALF, AND THE LOG SHOWS IT.** Seed 2's
plan is 20 six-slot lines in 3/8 at subdivision 2 — five to six syllables a
line — carrying 21 overlapping groups whose 42 mandated pairs bind HALF the
song's tokens, with chorus lines 9 and 10 bound at EVERY token position. All
21 families were screened before a line was written, and the ban refused the
first-choice family in seven groups: turn~stern, aligns~lines, come~drum,
seas~breeze~ease, loud~crowd, beat~sleet, shoals~rolls, oars~shores~pours,
old~rolled, broke~oak, wet~sweat, dark~arc and gloom~plume all came
back MODAL_RHYME — the seas/breeze/ease run screened three pairs and
banned 3 [LOG: banned wheat_mane.txt ease] with clean
0 [LOG: clean_or_non_rhyme wheat_mane.txt ease] — and the -url family
died at the dictionary, refused 4 [LOG: refused wheat_mane.txt furl]
because CMUdict cannot read `furl`. What survived is fresh inventory —
the 4-clique row/toe/though/sew, the 3-cliques squalls/hauls/crawls,
grain/mane/feign, freight/gait/slate, break/opaque/quake, tide/sighed/dried,
keel/zeal/squeal, haze/praise/phase, noon/dune/strewn — screened as fresh
candidate pools with the earlier songs' clean lists deliberately
unconsulted, and none of the M-111 glossary words appears in the lyric.

**AND THE FUNNEL DELIVERED ANYWAY, WHICH IS M-111'S MECHANISM STRIPPED
OF ITS LAST INNOCENT READING.** Measured after banking: eleven of this song's 52
bound words — row, sew, though, tide, slate, freight, opaque, feign,
four, core, dried — were SUNG in `long_bridge.txt`, a song whose lists
this session never opened. No shopping happened and the overlap arrived
anyway, because the ban tables and the lexicon are fixed: two
independent sessions screening different candidate pools converge on
the same short clean survivors. The prior receipt (16 of
`carry_it_over`'s 50 screened words sung in `long_bridge`) could still
be read as shopping; this one cannot. The old tic glossary itself did
rotate out — of the sixteen content types now shared by four or more
banked songs, this song appears in two (`hands`, `all`), and
light/ache/groan/stair/stone/crossed/dark stay confined to the first
five songs — so avoidance works on the WORDS a writer watches, and the
funnel keeps operating on the words the SCREEN hands out. M-111's
reuse-disclosure check remains the open remedy, awaiting the owner's
ruling on the songs-are-not-corpus boundary.

**WHAT THE BANKED NUMBERS SAY, cited not remembered.** Rhyme predictability
came in at 0.609665, the lowest of the eight banked songs [RESULTS: rhyme_predictability_mean wheat_mane.txt]
— a fifth of a unit under the prior floor — which is the direction the two-tier ban pushes when every
family is screened first rather than repaired after. MATTR is the
highest of the eight at 0.994286 [RESULTS: mattr wheat_mane.txt]: twenty short lines
with almost no repeated vocabulary. Concreteness sits mid-pack at 3.644821
[RESULTS: concreteness_mean wheat_mane.txt]. Whether first-round green plus
whether those extremes read as a better song [RESULTS: rhyme_predictability_mean wheat_mane.txt]
is the owner's ear's question, not these instruments' — the panel measures it separately, and `long_bridge` is
the standing proof that green and good are different claims.

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
the lowest of the six at 3.043667 [RESULTS: concreteness_mean carry_it_over.txt].
~~against 3.909818 for `turn_the_wheel.txt`~~ — that was the top of FIVE and a
sixth has since been banked; turn_the_wheel's own 3.909818 has not moved
[RESULTS: concreteness_mean turn_the_wheel.txt]. On
rhyme predictability — pre-registered as LOWER —
~~`keep_the_light.txt` sits lowest at 0.816206~~ [RESULTS: rhyme_predictability_mean keep_the_light.txt]
(SUPERSEDED 2026-08-25: it held that floor among the six then banked;
`wheat_mane.txt` now sits lowest at 0.609665 [RESULTS: rhyme_predictability_mean wheat_mane.txt],
and keep_the_light's own reading has not moved).
Both readings ran against the story I had been telling, which is the point of
writing the numbers down before making the claim.

A comparison in this file must carry a `[RESULTS: <column> <song>]` citation
that resolves, or `--claims` fails. That check is aimed at the narrator.

---

## `matinee.txt` — "Matinee", seed 3, series song 4: the mandate was the defect

    python3 lyric_harness.py plan --seed=3
    python3 lyric_harness.py song songs/matinee.blueprint.json \
        songs/matinee.txt \
        '--groups=1.T2,3.T6;2.T6,3.T1;1.T3,2.T3,3.T2;4.T3,5.T6;8.T3,9.T1;7.T4,9.T4,10.T5;7,9.T7,10.headrime;9.T3,10.T4;12,14,23.T4;13,22.T1;15.T5,16.T1,19.headrime;17.T7,20;12.T3,13.T1,16,18.T4,19.T6,20.T1,22.T4;18.T6,21.T3,22;12.T1,13.T2,20.T2,21,22.T6;12.T7,21.T7;12.T6,13.T6,14.T3,21.T1;13.T4,14.T1,16.T7,21.T6;14.T2,18.T2;24.T4,27.T6,28.T7;26.T5,32.T3;25.T6,26,28.T3,29.headrime,31.T3;25.T5,28.T1,31;25.T2,29,30.T6,31.T1,32.T5;25,26.headrime,30.T3;25.T1,29.T2,32.T6;26.T7,30.T7,31.T7,32.headrime;1,3;4,5;8,9;15,19;24,27,28' --subdivision 1

`song` exit 0, md5 `c64331aba1ba`, 116 pairs mandated / 116 judged / 0
refused, 0 banned pairs; `revise` SUCCESS in 0 rounds, draft unchanged.
Four grading rounds to get there — the inverse of wheat_mane's opening-pass
green — and the words were almost never the problem: THE MANDATE WAS.

**ROUND 1 CHARGED 22 SCHEME VIOLATIONS AND 19 OF THEM WERE ONE SPELLING
ERROR (M-114).** The hand mandate bound eight members at `.head` and seven
at `.endword`, written as if they meant "the first word's rime" and "the
end rhyme" — and the slot vocabulary declares both as WHOLE-WORD spans
(`word_start -> to_word_end`), where `T<n>` and `headrime` read the rime
from the last stressed syllable. `deceit` at `21.endword` is scored on
both its syllables, head-aligned, and reads 0.13 against a partner the
bare pair scores 1.0. Respelling the loci — `.head` -> `.T1`, `.endword`
-> the bare line number — removed 19 of the 22 violations with ZERO word
changes — the round-1 row in the log (step 54, fingerprint
`707c48614794`) and the green row bind the identical slot words. Filed as `MISSING.md` M-114: a whole-word locus in a rime
family refuses nothing at declaration time, and the writer discovers it a
hundred mandated pairs later.

**THE THREE SURVIVING VIOLATIONS WERE ALL ONE WORD, AND THE SCREEN HAD
CALLED IT CLEAN (M-113).** `haiku` is `HH AY1 K UW0` — final syllable
unstressed, so its rime span reaches back to `AY1` and no `UW` family can
answer it. The screen printed `pair:haiku~taboo CLEAN` because CLEAN
answers the BAN question only; the log fact is honestly named
`clean_or_non_rhyme`, and the printed word is what a writer reads. The
replacement `revue` was screened against the family first —
clean 15 [LOG: clean_or_non_rhyme matinee.txt revue] with
banned 0 [LOG: banned matinee.txt revue] and
refused 0 [LOG: refused matinee.txt revue] — and the re-grade went green.

**THE BANDS PRICED THE REST.** The early rounds also charged 11
`PROMINENCE_OUT_OF_BAND` lines (eight or more prominent syllables against
the calibrated ceiling of seven) and 2 `SLOTS_EXCEEDED`; every repair was
a function-word dilution or a one-syllable trim that held every bound word
at its declared token index, verified against the mandate before
re-grading. The banked text carries 2 stacked lines (L7, L21) at 0.0625 —
under the 0.125 `STACKED_DRAFT` ceiling, and no other banked song has
carried one since the sentencehood gate shipped; both lines hold a real
verb, and the fraction is the coordinate that decides. The witness is
pinned in `quality/sentencehood.py`.

**WHAT THE BANKED NUMBERS SAY, cited not remembered.** At 32 lines this is the longest banked song [RESULTS: n_lines matinee.txt],
and its rhyme predictability 0.787907 is the second-lowest of the nine [RESULTS: rhyme_predictability_mean matinee.txt],
with only wheat_mane's 0.609665 lower [RESULTS: rhyme_predictability_mean wheat_mane.txt]
— the screen-first direction holding on a second consecutive song. MATTR
0.896166 [RESULTS: mattr matinee.txt] and concreteness 3.658712
[RESULTS: concreteness_mean matinee.txt] sit inside the banked range on
both sides.

**AND THE FUNNEL RECEIPT, THIRD CONSECUTIVE SONG.** Fifteen of this song's
95 bound words were sung in earlier banked songs whose clean lists this
session never consulted — eight of them in `long_bridge.txt` alone (buy,
door, height, heir, high, prayer, rye, weigh), the same song wheat_mane's
eleven landed in. Fixed ban tables and a fixed lexicon keep converging on
the same short survivors whatever the writer avoids; M-111 stays the open
remedy.

---

## `crooked_waltz.txt` — "Crooked Waltz", seed 31, series song 5: the dice drew the relations

    python3 lyric_harness.py plan --seed=31 --title='Crooked Waltz'
    python3 lyric_harness.py song songs/crooked_waltz.blueprint.json \
        songs/crooked_waltz.txt \
        '--groups=1.T7,2.T4;1.T5,2.T5;3.T4,5.T2;4.head,6.T3,8.T4;7.head,9;3.T6,4.T2,5.T1,7.T2;3.endword,4.T6,5.T5,6.head,7.endword,8.head;4.T4,6.endword,8.endword;4.T5,8.T6;12.headrime,13.T4;10.T1,11.head,12.T3,13.endword;10.T2,12.T7,13.headrime;10,12;15,16.T2;16.T4,17.T1;15.headrime,17.endword;1,2' \
        '--relations=A:schema:anaphora,B:schema:light rhyme,C:schema:chain rhyme (rap),D:schema:pararhyme,E:schema:family rhyme,F:schema:chain rhyme (rap),H:schema:head rhyme (positional),I:schema:chain rhyme (rap),J:schema:pantun ABAB,K:schema:anaphora,L:schema:internal rhyme,M:schema:family rhyme,N:schema:subtractive rhyme,O:schema:anaphora,P:schema:head rhyme (positional),Q:schema:chain rhyme (rap)' --subdivision 2

`song` exit 0, md5 `2673775a65a1`, 47 pairs mandated / 47 judged / 0
refused; `revise` SUCCESS in 0 rounds, draft unchanged. Seventeen lines of
11/8 grouped 3+3+2+3, and the relation coordinates came from the PLANNER'S
OWN DICE (M-117), which no banked song before this one could say: sixteen
of the seventeen groups carry a drawn `schema:` name — light rhyme,
pararhyme, pantun, subtractive, head rhyme, chain, anaphora, internal,
family — and the writer declared none of them. The one bare group (G, six
loci across the chorus) rode the M-116 whole-vocabulary default.

**THE FIRST DRAWN PLAN COULD NOT BE WRITTEN, AND THE DEFECT WAS THE
GATE'S, NOT THE DICE'S (M-119).** Grading the first draft returned nine
scheme violations of which seven were mandate contradictions no words can
satisfy: the draw had put cluster consonance — whose registry row demands
pairwise-DIFFERENT nuclei on the very end words — onto the postchorus
group whose ends family rhyme and pantun already held nucleus-AGREE, and
head rhyme (positional), which REFUSES token identity at the line head,
onto a pair that anaphora required to OPEN ON THE SAME WORD. The M-118
conjunction gate saw neither, because cluster consonance spells its
line-finality in the span LOCUS (its placement row is empty) and the line
HEAD had no claim store at all. `MISSING.md` M-119 carries the account and
the measurement — 33 of 40 seeds drew one of the two shapes through the
old gate, 0 of 40 through the widened one, 0 seeds lost, seed shapes
byte-identical — and `test_plan.py` §14 pins the widened derivation by
name. Seed 31 was then re-planned: same seventeen lines, same groups, five
groups' relations re-drawn.

**THE ONE ROUND THE WORDS OWNED WAS A MODAL TRAP OF MY OWN MAKING.** Head
rhyme on the chorus triple needs three DIFFERENT line-opening words
sharing an open-AY first syllable; the first repair opened L8 on "High"
beside L6's "Sky" — and those two words are G's own slot pair, a bare
group where the two-tier ban is live, and sky/high is the canonical modal
pair. The grade refused at exit 3 on exactly that note. The replacement
head was screened against "sky" and against "guy" before it was written —
the working order the screen exists for; both runs are banked in the
log's own rows, unbanned in each — and "Pylons at the stiles swing" took
the head. The intro's light-rhyme pair was screened the same way —
clean 1 [LOG: clean_or_non_rhyme crooked_waltz.txt carpenter] — before
either end word was sung.

**WHAT THE BANKED NUMBERS SAY, cited not remembered.** Rhyme
predictability 0.718198 is the second-lowest of the ten banked songs [RESULTS: rhyme_predictability_mean crooked_waltz.txt],
above only wheat_mane's 0.609665 [RESULTS: rhyme_predictability_mean wheat_mane.txt]
— the screen-first direction holding on a third consecutive song — and
concreteness 3.715714 sits in the banked range's upper half [RESULTS: concreteness_mean crooked_waltz.txt],
under long_bridge's 3.945395 [RESULTS: concreteness_mean long_bridge.txt].
At 17 lines [RESULTS: n_lines crooked_waltz.txt] its column records what
the dice asked a writer to do, with no second drawn-relation song banked
yet to compare it against.

---

## `the_frost_ledger.txt` — "The Frost Ledger", seed 32, pair 1's BARE twin: the experiment begins by breaking the gate three more times

    python3 lyric_harness.py plan --seed=32 --narrative=off --title='The Frost Ledger'
    python3 lyric_harness.py song songs/the_frost_ledger.blueprint.json \
        songs/the_frost_ledger.txt \
        '--groups=1.head,5.headrime,6.T5,10.endword;2.endword,4.head,8;2.headrime,3.T7,6.headrime,7.T3,8.T6,9,10.T7;4.T3,5.T4,6;3.head,4.T7,5.T5,7.headrime,10.T6;3.T6,5.T3,10.headrime;5,8.T7,10.T3;13.head,14;13.T4,17.head;15.T2,16.T4,17;14.T4,15.T3,17.T6;14.T2,17.T2;14.T7,17.T5;19.T1,20.endword;18.T7,20.T5,21.T2;18.T3,19.T3,20.T1,21.endword;19.T4,21.headrime;19.endword,20.T6' \
        '--relations=A:schema:perfect rhyme,B:schema:multisyllabic rhyme,C:schema:compound / phrasal rhyme,D:schema:anaphora,E:schema:internal rhyme,F:schema:anaphora,G:schema:perfect rhyme,H:schema:perfect rhyme,I:schema:rime riche,K:schema:Scots vowel-length rhyme (Aitken'"'"'s Law),L:schema:anaphora,M:schema:compound / phrasal rhyme,N:schema:head rhyme (positional),O:schema:anaphora,P:schema:chain rhyme (rap),Q:schema:light rhyme,R:schema:multisyllabic rhyme' --subdivision 2

`song` exit 0, md5 `5f2a1371b4d8`, 71 pairs mandated / 71 judged / 0
refused; `revise` SUCCESS in 0 rounds, draft unchanged. Twenty-one lines of
10/8 grouped 2+3+2+3, and this is the FIRST HALF OF PAIR 1 of the
preregistered narrative harm check (`quality/NARRATIVE_PREREGISTRATION.md`):
the BARE twin, planned with `--narrative=off` and written before the story
draw for this seed was ever read, per the registration's ordering rule.
ONE DISCLOSURE ON THAT RULE, recorded rather than omitted: during the
M-122/M-123/M-125 gate measurements, `make_plan(32)` was called without
`narrative="off"`, which draws a story line-up as a side effect. The draw
was consumed into no report and read by nobody — the scripts read only
`relations` and `groups` — but "never generated" is not a sentence this
bank can carry, so the sentence it carries is "generated in memory by an
instrument, never surfaced, never read."

**THREE OF THE FIVE GATE DEFECTS THIS SONG'S DEMAND SHEETS EXPOSED WERE
FOUND BEFORE A WORD WAS WRITTEN, AND TWO MORE BY WRITING IT.** Seed 32's
first drawn sheet was doubly unsatisfiable (M-122: `adjacent_lines` read as
no gap at all, and a rime-riche/semirhyme/assonance chain whose equality is
transitive); the re-drawn sheet put light rhyme — whose `prominence Differ`
rides a BINARY channel — on a seven-line group (M-123, the pigeonhole);
the third sheet forced nine identical line-openers against the floor's own
calibrated ANAPHORA_OVERLOAD share and drew a perfect/rime-riche/semirhyme
length triangle (M-125), while grading the first actual draft found the
identity machinery charging REPEAT on the anaphora its own mandate demanded
(M-124). Every one of those closes in `MISSING.md` with measurements either
side; this file records only what the WRITING then owed: the two-tier ban
turned the intro's rhyme family over twice (days~strays and weighs~sleighs
fell to SHARED_SUFFIX, haze~glaze to HOMEOTELEUTON on group B's own bound
end pair), and the compound/phrasal web across seven intro ends settled on
uniform two-syllable "the/a + monosyllable" closes after the mixed-length
spans measured unjudgeable.

**WHAT THE BANKED NUMBERS SAY, cited not remembered.** Rhyme
predictability 0.790336 is the fourth-lowest of the eleven banked songs [RESULTS: rhyme_predictability_mean the_frost_ledger.txt],
above wheat_mane, crooked_waltz and matinee [RESULTS: rhyme_predictability_mean matinee.txt]
— the screen-first direction holding on a fourth consecutive song — and
concreteness 3.750000 sits third-highest [RESULTS: concreteness_mean the_frost_ledger.txt],
under long_bridge and turn_the_wheel [RESULTS: concreteness_mean turn_the_wheel.txt].
MATTR 0.726486 is the third-lowest [RESULTS: mattr the_frost_ledger.txt],
above turn_the_wheel and keep_the_light [RESULTS: mattr keep_the_light.txt]
— the visible price of a mandate that forces five lines to open on one
word and four more on two homophones, which is a fact about THIS drawn
sheet and not yet a trend.

---

## `the_river_keeps_the_score.txt` — "The River Keeps the Score", seed 32, pair 1's NARRATIVE twin: the joker card played on a real song

    python3 lyric_harness.py plan --seed=32 --title='The River Keeps the Score'
    # identical GROUPS, RELATIONS and meter to the_frost_ledger.txt — one seed,
    # two drafts — plus the drawn story plan the bare twin was never shown

`song` exit 0, md5 `73f4f1b6ff80`, 71 pairs mandated / 71 judged / 0
refused; `revise` SUCCESS in 0 rounds, draft unchanged. The SECOND HALF OF
PAIR 1 of the preregistered narrative harm check
(`quality/NARRATIVE_PREREGISTRATION.md`): same seed, same demand sheet,
written AGAINST the drawn story line-up the bare twin was written without —
the intro puts the world in place, the drop states the claim it earns
("The river keeps the score"), the verse lets the pressure in because of
it (the drought), the chorus returns the claim AGAINST that pressure
("Drought is just another way to steal / Still the water owes its turn"),
and the postchorus holds the moment without advancing. The writing paid
three grading rounds: a mixed-length compound phrase ("the summer eel"
carries an ER syllable where the web wants a schwa), the Q pair's -ing
ending falling to the suffix stemmer (morning~spring read as rhyming on
the shared ending alone), and the modal table catching 'Under' as a
top-six answer to 'silver' on Q's own bound words — each cleared by
rewriting the line, never by moving a threshold.

**WHAT THE BANKED NUMBERS SAY, cited not remembered.** Rhyme
predictability 0.768832 is the third-lowest of the twelve banked songs [RESULTS: rhyme_predictability_mean the_river_keeps_the_score.txt],
above wheat_mane and crooked_waltz [RESULTS: rhyme_predictability_mean crooked_waltz.txt],
and concreteness 3.907971 sits third-highest [RESULTS: concreteness_mean the_river_keeps_the_score.txt],
under long_bridge and turn_the_wheel [RESULTS: concreteness_mean long_bridge.txt].
The registration's own question about the story plan's effect on the
writing is reserved for the blind panel after at least three completed
pairs — no sentence here answers it, and the feature register is the
deterministic control, not the verdict.

---

## The series to date — four songs under one set of instruments, 2026-08-25

The forward loop closed today on the owner's instruction, four songs in:
`long_bridge` (the defect record), `taught_me_time` (the forward
validation), `wheat_mane` (seed 2), `matinee` (seed 3). Seed 4's plan is
drawn and recorded (`songs/song5.log.tsv`, plan step 1 plus the first
family screens) and stops there — a stub for whichever session reopens the
loop. What four points support, stated as four points and not a slope:

**The cause profile moved even where the round count did not.**
taught_me_time needed four grading rounds of WRITING repairs;
matinee also needed four rounds, and nineteen of its twenty-two round-1
scheme violations fell to a mandate respelling with zero word changes
(M-114), with the screen's verdict vocabulary supplying the rest (M-113).
The gates are catching authoring errors upstream of the words now, which
is where wheat_mane's opening-pass green said the words had stopped
needing them.

**Screen-first pushes predictability the pre-registered direction, twice.**
The two screen-first songs hold the floor of the banked set: wheat_mane lowest at 0.609665 [RESULTS: rhyme_predictability_mean wheat_mane.txt]
and matinee second-lowest at 0.787907 [RESULTS: rhyme_predictability_mean matinee.txt].

**The glossary stays confined to the pre-gate songs, on every instrument.**
Panel runs 3 and 4 both return STRONG at 3/3 with every evidence list
locating the iron/groan/ache/stone/spare cluster in the first six songs;
the mechanical DF agrees (fifteen content types shared by four or more of
the nine, matinee in two of them, wheat_mane in two of sixteen at the
eight-song count). Avoidance works on the words a writer watches.

**And the funnel operates on the words the screen hands out.** Fifteen of
matinee's 95 bound words were sung in earlier banked songs never
consulted; eleven of wheat_mane's 52; and run 4 produced the first
PHRASE-level receipt — "dried salt" verbatim in both sea songs. M-111's
reuse disclosure remains the open remedy, awaiting the owner's ruling.

**Each closed gate moves the pressure one surface over, which is the
series' core finding.** Verbless stacks were gated (M-110) and did not
recur; the binding pressure that produced them moved into semantics in the
maximally bound sections (wheat_mane CHORUS1 2/3, matinee VAMP1 3/3
unanimous — M-112, third reproduction); and the prominence band's repairs
were then heard by a blind judge as padding and clot the count cannot see
(M-115). Grammar gate live, drift into semantics; count band live, drift
into adjacency. The quantity underneath all three is the mandate's local
weight on a section, and M-112's disclosure is the named next instrument.

**Green and good stay different claims.** Run 4's three set judges, asked
to name one song to cut, all three named wheat_mane — the series' only
opening-pass green — for its drawn SHAPE ("never returns to a chorus"), a
taste question about the planner's form draw that belongs to the owner,
not to a gate.

---

## What the screen cost, measured

The first draft of the flood song (seed 108, since superseded) had **15 of
16 rhyme pairs come back BANNED as MODAL_RHYME** — every one the most
predictable partner in its family. Two whole sound families, `/OW/` and
`/AA-R-K/`, turned out unusable: every pair inside them is somebody's modal
answer. That is doctrine 9 enforced before a word ships rather than argued
about afterwards.

---

## The process beside the product

`RESULTS.tsv` says what a song IS. `songs/<name>.log.tsv` says what the verbs
SAID while it was being written — one row per (invocation, fact), in the order
the questions were asked.

    python3 quality/song_log.py --record SONG -- CMD...   # run a verb, bank what it printed
    python3 quality/song_log.py --show SONG               # render one song's log
    python3 quality/song_log.py --verdicts                # this file's process claims vs the rows

**IT RECORDS EMITTED TEXT AND NOTHING ELSE.** `--record` runs the command,
keeps its exit code, and parses stdout with a parser declared for that verb. A
command with no declared parser REFUSES at exit 2; so does a declared verb
whose output the parser reads nothing from, because an invocation whose output
nothing read looks exactly like an invocation that went well. It cannot bank
an intention, a reason or a regret — everything a session BELIEVES stays in
this README, where `--verdicts` charges it against a row.

**EVERY PROCESS CLAIM ABOVE IS NOW GATED.** An exit code, a stop reason, a
round count, an md5, a mandated/judged/refused triple — each must resolve to a
row in that song's log or `--verdicts` fails. Three counts, never summed:
RESOLVED, MISMATCHED and REFUSED, the third being a claim the log cannot
answer, which is not the same thing as a claim it agrees with (doctrine 20).

**WHAT THE LOG DOES NOT CLAIM.** A row is stamped with the commit and date it
was RECORDED at, not with the hour of the original writing session. The rows
banked on 2026-08-24 are re-derivations of the same commands against the same
committed bytes — the stronger property, because a log nobody can re-run is
the memoir this file was written to replace. The genuinely unrepeatable half —
a superseded draft that was never committed, the two hand-picked swaps that
did not move `stay_awake`'s ban gate — has no rows and cannot get any. Those
sentences stay prose and are REFUSED by the gate rather than passed by it.

**THE ZERO-CEILING FAMILIES ARE ROWS NOW, NOT A TABLE.** `-old` and `-ame`
each yield zero clean pairs, and that is a measurement about English taken
through this harness's own two-tier ban. It sat in a markdown table nothing
could re-derive — a table whose single denominator was impossible for five of
its own rows, which is what a number nobody can re-run does. `screen`'s own
verdict per pair is banked now, `scrolled`'s five refusals included, each one
naming the word CMUdict could not read.

**A CITATION IS KEYED ON A WORD, NOT A ROW NUMBER.**
`[LOG: clean_or_non_rhyme carry_it_over.txt bell]` names the screen run that
screened `bell`, so it survives re-recording, reordering and insertion. A
citation into an append-only log keyed on POSITION is an offset from a moving
origin — the defect this repository already found in its own
`data/sources.tsv` line-number citations, where an unrelated insertion made a
true sentence false without one character of it changing. A word screened by
two runs REFUSES as ambiguous rather than resolving to whichever came first.

## `till_the_light_comes_home.txt` — "Till the Light Comes Home", seed 143: banked the day M-148 was recorded, written entirely on the writer's declared route

    python3 lyric_harness.py plan --seed=143 --relation=class:RHYME \
        --title="Till the Light Comes Home"

**THE DECLARATION IS THE POINT OF THIS ENTRY.** M-148 (recorded the same day)
measures that at least one relation in the planner's certified draw pool
refuses its own canonical answers through the mandate route, so this song does
what that entry's "until then" clause prescribes: `--relation=class:RHYME`
silences the draw — a writer's declaration, disclosed here, never a quiet
workaround. Every mandated pair in the song is judged as strict RHYME by the
scalar comparator's named class: identity refused, rime riche refused,
assonance refused.

**SCREEN-FIRST IS WHY THE LOOP HAD NOTHING TO DO.** Every rhyme family was
certified through `screen` before a line was written, and the banked screens
are the certificates: the reprise's eight end words, the vamp's five, the
tag's four, the coda's six, the intro's three. The screens that FAILED are
the story the log cannot hold — the first-choice pair in nearly every family
came back MODAL_RHYME (the most predictable partner in its own field), so the
committed words are the field's non-modal tail, which is doctrine 9 doing the
writing. Two banked screens carry banned pairs and that is BY CONSTRUCTION,
not an oversight: the reprise and coda components are not complete graphs, so
their word sets were assigned so that every banned pair lands on a slot pair
the mandate never binds — `raid`/`afraid` share a spelled ending and no group
holds lines 7 and 10 together.

**ONE REWRITE BETWEEN FIRST GRADE OF THIS DESIGN AND EXIT 0.** The grader
caught `blockade`/`decayed` at score 1.000 and refused it — identical anchor
syllable, RIME_RICHE, which `class:RHYME` correctly rejects and the screen
correctly does not ban (rime riche is a relation, not a laziness). `decayed`
became `displayed`, screened clean against all five of its mandated partners
before the line was retyped.

**THE VERDICTS, CHARGED AGAINST THE LOG.** The grade is exit 0 with 0
per-line flags and 0 whole-draft flags on md5 9100acec755a; 76 pairs
mandated, 76 judged, 0 refused. The loop reports SUCCESS after 0 rounds with
the draft unchanged. No MODAL_RHYME, HOMEOTELEUTON or PREDICTABLE_RHYME note
stands anywhere in the report, because the screening happened before the
writing rather than after it.

## the_long_way_back — the song M-148 parked, finished the day the judge was repaired

**"The Long Way Back", seed 28 of the verse-chorus form, 29 lines in 7
sections, graded at exit 0 with 0 per-line flags and 0 whole-draft flags on
md5 687eaa34c949; 75 pairs mandated, 36 judged, 39 refused. The loop reports
SUCCESS after 0 rounds with the draft unchanged.** [RESULTS: n_lines
the_long_way_back]

**THIS IS THE SONG `MISSING.md` M-148 PARKED OPEN AT EXIT 3**, when the
schema judge refused canonical answers to the planner's own drawn relations
and eight flags stood that no word available to a writer could clear. It was
not presented then, on the owner's standing rule that nothing skips a step;
it is presented now because the judge was repaired, not because the gate was
argued down. The finishing order after the repair: re-grade, rewrite to the
repaired judge's honest coordinates, grade to exit 0, revise to SUCCESS,
render, bank.

**THE REWRITE THE REPAIRED JUDGE ASKED FOR IS THE OPPOSITE OF THE ONE THE
BROKEN JUDGE GOT.** The parked draft had been written TO the defect: every
chorus line opened with one word because the anaphora verdict was read at
the lines' initial tokens rather than at the declared slots — which
satisfied the broken judge and tripped the floor's calibrated
ANAPHORA_OVERLOAD at 12 of 29 openings. Under the repaired judge the
anaphora groups bind the DECLARED tokens (a chorus line's second word
answering another's last), the skothending groups take post-vocalic
clusters with differing stressed vowels at their declared placements, and
the chorus that satisfies them carries four distinct opening words — the
overload flag cleared in the same rewrite that closed the scheme
violations, because writing to the real coordinates is less repetitive
than writing to the broken ones.

**39 OF THE 75 MANDATED PAIRS ARE REFUSALS AND EVERY ONE IS NAMED, NOT
FAILED.** The plan drew `multisyllabic rhyme`, `compound / phrasal rhyme`,
`chain rhyme (rap)` and `monai` onto declared token slots, and those span
shapes search windows or read their own magnitudes — one declared token
cannot bind them, so the repaired judge refuses by name instead of
answering a different question under the schema's name (doctrine 20/79).
Under the broken judge three of those groups' pairs graded as VIOLATIONS no
writing could fix; the refusal is the honest state and `MISSING.md` M-149
records the seam (the relation draw and the placement draw compose into
conjunctions nothing prices) as an open entry rather than a footnote.

**THE BAN GATE DID THE LAST THIRD OF THE WORK.** The first exit-0-shaped
draft still carried PREDICTABLE_RHYME (97% of the mandate-class pairs above
0.90 predictability, driven by high-frequency line-end words) and one
SHARED_SUFFIX pair whose spelled rimes were identical at every level. The
gate held exit 0 back until the line-ends moved to the rare tail —
non-modal content words in the outro, a chorus couplet re-pivoted off the
shared spelled ending — which is doctrine 9 doing the writing at the layer
the screen could not reach, since these were incidental class pairs rather
than declared rhyme families.

### the_long_way_back, re-banked the day M-149(b) un-silenced its siblings

**Re-graded and re-banked 2026-08-28 at exit 0 with 0 per-line and 0
whole-draft flags on md5 794df4513589; 75 pairs mandated, 27 judged, 48
refused. The loop reports SUCCESS after 0 rounds with the draft
unchanged.** The bank-day verdict above was true of the bank-day tree and
stays recorded; what changed is the JUDGE: `MISSING.md` M-149(b) repaired
the refused-set key that had let one group's refusal on a line pair
silence every sibling group's different reading of the same two lines,
and under the honest key TEN of this song's mandated questions were asked
for the first time — nine came back violations and one (a stanza-framed
monorhyme) could only be asked under the blueprint's own frame. The
rewrite went through the full order: the screen banned five candidate
pairs on the way (a spelled-identical skothending, two homeoteleuta, and
one word that is the modal head of every partner's field), the grade came
back to exit 0, and the loop closed at SUCCESS with nothing left to hold
open. The vamp now answers its own echo, the postchorus counts what the
dark hours lost, and the coda's ledger is sewn, on loan, and unknown —
which is to say the mandated web finally says what the plan drew, at the
placements it drew them.

# Song run A — 20-line sung folk ballad, declared melody

## 1. Outcome

**COMPLETED CLEAN** — `lyric_revise` stopped at exit 0, `SUCCESS after 3 round(s)`, `certified: true`, `status: finished_clean`, 0 banned pairs, `blocking: []`.

## 2. Declarations

| field | value |
|---|---|
| form | `verse-chorus` (default) |
| lines | `20` |
| functions | `verse,chorus,bridge` |
| relation | none |
| title | `Keep the Lamp` |
| narrative | not declared (plan reported `NO STORY PLAN: this shape carries no legal story line-up`) |
| melody | `{"meter":{"beats":4,"unit":4,"groups":[2,2]},"bars":2,"subdivision":2,"notes":[{"pitch_hz":392,"ticks":2},{"pitch_hz":440,"ticks":2},{"pitch_hz":494,"ticks":2},{"pitch_hz":523,"ticks":4},{"pitch_hz":494,"ticks":2},{"pitch_hz":440,"ticks":2},{"pitch_hz":392,"ticks":2}]}` |
| want / wants | `["uses=verse,chorus", "before=verse,chorus", "binding_cap<=1"]` |
| seed | `22` (the only seed accepted in sweep 0..27) |
| pronunciations / fallback / voices | none |

Subject: a lighthouse keeper's last night before the light is automated, talking to his dead wife.

## 3. Timeline (wall clock, UTC)

| step | submitted | took | notes |
|---|---|---|---|
| begin_lyrics (create) | 18:40:17 | instant | |
| lyric_sweep 0..27 | 18:40:22 | ~2 s (`ms 2099`) | 28 planned, 0 refused, **1 accepted (seed 22)** |
| lyric_screen (5 words) | 18:40:31 | 11.7 s | ~15 k chars for 10 pairs; stone/bone banned HOMEOTELEUTON |
| lyric_plan seed 22 | 18:40:59 | 0.8 s | shape `bridge-verse-chorus-chorus-verse` (a 14-line BRIDGE opens the song; both verses are one line) |
| lyric_grade | 18:42:54 | ~50 s | exit 2, 7 banned pairs (all MODAL_RHYME), L9/L11 unjudged (`wire` has 2 readings) |
| lyric_revise open | 18:44:31 | 12 s | batch question L4, L8, L10, L12, L17 — **result 82,133 chars** (see Bug 4) |
| round 1 batch answer | 18:45:58 | 6.4 s | L4 rejected (PROMINENCE_OUT_OF_BAND, K2); L8, L10, L12 later accepted; L17 rejected (Bug 1) → group question L1+L4 |
| round 1 group L1+L4 | 18:47:35 | 80 s | accepted (`fixed 2, introduced 0`) → group question L16–L19 |
| round 1 group L16–L19 | 18:49:09 | 5.6 s | rejected: `previously judged required check(s) became refused: rhyme:16:17:5` (Observation 1) |
| round 2 batch L12, L17 | 18:51:49 | **427 s** (`ms 426923`) | both accepted |
| round 3 single L9 | 18:59:25 | ~147 s | accepted → FINISHED exit 0 |

Revise: 3 rounds, 9 answers on record. Total from begin to finish ≈ 21.5 min, most of it server queue/compute time in round 2.

Side probes during the run (a separate `phase:"edit"` session plus caller-managed lookups) are listed under Bugs/Observations. A 2-line `lyric_check` in the edit session took **422 s** (`ms 422277`) while the round-2 revise was running; a 2-line check afterwards took 142 s, and a 5-line check took 95 s.

## 4. The song (revise's first content block, verbatim)

```
[BRIDGE — 14 lines — 28 bars of 4/4]
Brine upon the tower glass
Cold the wind across the bay
Her shawl still hangs upon the door
And they tell me I must resign at last
She would sing against the tide
We would watch the rain fall down
Vane was creaking, wind was loud
Then the winter fever's reign; the bells rang out
Men have pried the lens for a buyer
Maps are closed and left to fade
Sighed the sea, a humming choir
Radios will give the call offshore
Morning brings a timer's hum
One more night to keep it whole

[VERSE — 1 line — 2 bars of 4/4]
Bring your shawl and climb with me

[CHORUS — 2 lines — 4 bars of 4/4]
Keep the lamp until the dawn
Bright as swan wings in the dark

[CHORUS — 2 lines — 4 bars of 4/4]
Keep the lamp until the dawn
Bright as swan wings in the dark

[VERSE — 1 line — 2 bars of 4/4]
White the tower, dark the glass

[FINISHED — seed 22 — exit 0 — SUCCESS after 3 round(s) — no line flag stands]
```

## 5. Bugs

### Bug 1 — revise OFFERS a word (`on`) that the grader can't anchor at that slot, so the answer is rejected

- **Severity:** wrong result. The brief contradicts itself and costs the writer a round.
- **Where:** round-1 `lyric_revise` batch brief for L17 (group F = `16.endword & 17.T3`, L16 ends `dawn`).
- **Observed:** the brief reads `OFFERED — words for the word 3 that answer every group bound there` … `on, sean, von, anton, swan, …`, with `on` listed first. I answered `L17: Leave it on, the dark is long` (word 3 = `on`). The round-2 brief then reported: `Your line for this slot in ROUND 1 was REJECTED: 'Leave it on, the dark is long'. The grader's reasons, verbatim: - previously judged required check(s) became refused: rhyme:16:17:5`.
- **Minimal repro (off-song):** a `begin_lyrics {phase:"edit"}` session, then `lyric_check` with `lines: ["Keep the lamp until the dawn", "Leave it on, the dark is long"]` and `groups: "1.endword,2.T3"`. Result: `SCHEME_UNREADABLE … the declared slot resolves to NO ANCHOR on L2 — the token that slot names is a word this phonology cannot anchor, so the pair was never compared`, with `refused_obligations: ["rhyme:1:2:0"]`. A second check with the function word `the` at T3 (`"Swim upon the swan and on"`) gave the same `NO ANCHOR` refusal. Content words at T3 (`swan` after `Let it` and after `Bright as`) were judged normally, so the `it` before the slot is not the cause. The unanchorable token is the function word itself.
- **Expected:** the brief says the offered words "answer every group bound there". A word the grader can't anchor at that placement should not be offered, least of all first.
- **Reproduced:** 3 times (once in the song, twice with `lyric_check`).

### Bug 2 — `lyric_types` names multi-word rhyme types for two monosyllables, contradicting `lyric_screen`

- **Severity:** wrong result (taxonomy).
- **Repro:** `lyric_types {word_a:"cat", word_b:"hat"}` with the default position `end`. The same happens with `dawn`/`gone`.
- **Observed:** the report says `boundary: simple`, `length: equal`, and then `NAMES: masculine rhyme, single rhyme, …, mosaic rhyme, compound rhyme, broken rhyme, split rhyme, phrasal rhyme, perfect rhyme (last stressed syllable), cynghanedd lusg`. By definition mosaic, compound, broken, split and phrasal rhyme need a span that crosses a word boundary. Cynghanedd lusg is a line-internal form.
- **Contradiction:** `lyric_screen` in this run lists `mosaic rhyme` among the `39 schemas — stream, stanza, figure or placement forms no pair of end words can instantiate` (`NOT APPLICABLE to two line-final end words`). Also, the "as two line-final words" line of the same `lyric_types` output does not include any of these names.
- **Also in both outputs:** `'qafiya' is sourced to S1, S74, I29 but the canon index could not be loaded, so the tradition CANNOT BE TOLD here` (the same for antya-prasa and cynghanedd lusg). A server-side resource fails to load on every call.
- **Reproduced:** 2 times (cat/hat and dawn/gone), with the same output both times.

### Bug 3 — synchronous lookups exceed the connector's 60 s call timeout

- **Severity:** annoyance, and a blocker for that lookup.
- **Observed:** these calls all failed with `MCP server "…" tool "lyric_types" timed out after 60s`: `lyric_types` on choir/higher (twice), wire/tired (once) and dawn/on (once). A caller-managed `lyric_screen {words:["dawn","on"]}` failed the same way (`tool "lyric_screen" timed out after 60s`). Earlier, `lyric_types` on dawn/gone took 54.5 s (`ms 54507`) and cat/hat took 7.5 s. All the timeouts happened while a session operation (grade or revise) was running or queued.
- **Expected:** each description promises an answer within a `shared 600-second deadline`, and `lyric_types` is described as a lookup that "answers at once". The client-side call limit is 60 s, so on this connector these synchronous calls can't use the budget they advertise.
- **Reproduced:** 5 timeouts across 4 inputs.

### Bug 4 — the first revise response for a 20-line song is 82,133 chars, too large to display

- **Severity:** annoyance (the response is unusable inline).
- **Observed:** `get_operation` on the first `lyric_revise` operation (a batch question for 5 lines) returned `Error: result (82,133 characters) exceeds maximum allowed tokens`, so it had to be read from a saved file with `jq`. The block is 79,523 chars. Each per-line brief repeats all 10 whole-draft findings in full. That includes the `COLLISION_CUT_IS_SCALAR_ONLY` evidence paragraph, about 1,800 chars of changelog prose, repeated once per line (5×). It ends: `This sentence names a deliberate difference, not an open defect`. The 4 SHAPE notes (METER_LOCKED, etc.) are also repeated, although they "do not move when the words are revised".
- **Expected:** a response that can be displayed. This is the revise-side counterpart of K4 (screen). Here the cause is per-line duplication of whole-draft notes in a batch brief, not pair enumeration.
- **Reproduced:** once (the only 5-line batch). The later 1- and 2-line briefs were 15–30 k chars for the same reason.

## 6. Observations

1. **Chorus rewrite `sea`/`reach` refused, not judged (new K3 evidence).** The L16–L19 group answer `Keep the lamp above the sea / Let it reach the ships at night` was rejected with `rhyme:16:17:5 … became refused`. Off-song, `lyric_check` with `["Keep the lamp until the sea", "Let it reach along the dark"]` and `groups "1.endword,2.T3"` refused the pair: `the default relation remains unresolved in schema(s): cross rhyme, internal rhyme`. No coarse relation was found, although `sea` (S IY1) and `reach` (R IY1 CH) share the stressed vowel, so ASSONANCE should hold. This adds a trigger to K3: a stressed-vowel match of `endword` (front span) against `T3` (rime span) is not heard as assonance. The check itself printed `MIXED SPANS: group … binds front-of-word span(s) (1.endword) beside rime span(s) (2.T3)`. Checked once.
2. **The plan draws a group type its own checker warns about.** Seed 22 planned `16.endword & 17.T3`. `lyric_check` flags every such group with `MIXED SPANS … a non-initial-stress polysyllable's front span cannot answer a rime family`. This mixed-span hook group was the hardest pair in the song (3 rejected chorus attempts).
3. **A pair with no relation is REFUSED rather than VIOLATED.** When nothing holds, the "unresolved schemas" (`cross rhyme, internal rhyme`, etc.) turn a plain miss into "UNKNOWN". The screen shows the same thing (`tonight ~ stone 0 relation(s): none | grade: the default relation remains unresolved in schema(s): …`). This may be intended, but in revise it shows up as `became refused`, not "does not rhyme", which is less useful to a writer.
4. **Batch verdicts are deferred.** After the round-1 batch answer, `folded` showed L8/L10/L12/L17 as `"verdict":"unknown","source":"unverified"`. The next two questions (L1+L4 group, then L16–L19 group) came before the L17 rejection was shown. The reason appeared only in the round-2 brief. It isn't lost, but a writer answers the L16–L19 group question without knowing that their L17 line was already rejected.
5. **Plan shape.** With `want before=verse,chorus`, the song opens with a 14-line BRIDGE before any verse, and each VERSE is a single line. The roster is an allow-list, so "bridge" is legal, but a 14-line opening bridge fits no usual reading of the function. `binding_cap<=1` is described as "the classic end-rhyme song with one web binding a line", yet lines 1, 2, 3, 4, 8, 9, 10, 12 and 17 are each bound at 2 places. The DENSITY line says the end-rhyme pass binds "on top", so this is documented, but the want's description is misleading.
6. **`MANDATE_GROUPS_INDISTINGUISHABLE` wording.** It says `every cross pair rhymes`, but every edge it lists is `ASSONANCE` (door~dawn, shore~on). It is a note, not a flag.
7. **L11 unreadable blames the wrong words.** The grade's `blocking` said `L11: not judged — rhyme with L9 (SCHEME_UNREADABLE); words with more than one reading: the, a`. The real cause was `wire` on L9 (two readings, W AY1 ER0 / W AY1 R). `the` and `a` on L11 are not rhyme anchors. `lyric_types wire/choir` only says `UNREADABLE in eng: the phonology refuses one or both members`, without naming which member or why.
8. **K1 (latency) — new measurements on a small song.** The round-2 revise (2 lines, 20-line song) took 426.9 s, and a concurrent 2-line `lyric_check` took 422.3 s. Both were close to the 600 s kill. Later the same kind of 2-line check took 142 s. On a 20-line song, heavy latency seems to come from queueing or concurrency, not from song length.
9. **K2 seen once.** The L4 answer `Forty years I climbed these stairs; tonight will be the last` (13 syllables) was rejected for PROMINENCE_OUT_OF_BAND. This is expected under K2 for a long sung line. I shortened it.
10. Working as documented: MODAL_RHYME banned white/height, Cold/rolled, bay/grey, shawl/wall, door/shore, loud/crowd and dawn/gone. HOMEOTELEUTON banned stone/bone on the screen.

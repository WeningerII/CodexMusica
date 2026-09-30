# Song run B — 40 lines, sung soul/R&B, declared perfect-rhyme relation

## 1. Outcome

**COMPLETED CLEAN**: `lyric_revise` stopped at exit 0, `certified: true`, `status: finished_clean`, `loop_stop_reason: SUCCESS`, 0 banned pairs. The stamp says "after 0 round(s)" because the clean draft came from a **second** revise run. The first run could not be continued after repeated 600 s kills (B1). Its accepted lines, plus my own fixes, were re-graded to exit 0 and then passed to a `new_run`.

## 2. Declarations

| | |
|---|---|
| form | verse-chorus (default, not passed) |
| lines | 40 |
| functions | omitted. The plan drew: prechorus, chorus, verse, false_ending, reprise, hook, reprise, prechorus, chorus, outro (10 sections; "roster 20 of 22 functions") |
| relation | `schema:perfect rhyme` (plan, grade, revise) |
| title | `Porch Light On` (hook = line 3, the chorus's first line, which contains "porch light on") |
| narrative | omitted. The plan drew COMPLICATE, ANCHOR, JUDGE, RESOLVE, ANCHOR, ANCHOR, ANCHOR, COMPLICATE, ANCHOR, DEPART |
| melody | none |
| wants (sweep `want`, plan/grade/revise `wants`) | `["uses=verse,chorus", "group<=4", "binding_cap<=1"]` |
| seed | 10 (sweep of seeds 0–27 accepted 10, 12, 16, 22; I took the first) |
| drawn shape | meter 127/8, one bar per line (127 beats, 508 slots, "up to 505 syllables a line"); 25 rhyme groups / 42 mandated pairs, many bound at T-n / head / headrime / endword places; returns `3,22;4,23` |
| reading declarations | none (no pronunciations, no fallback, voices off) |

## 3. Timeline

Wall-clock times, taken from `ms` / `elapsed_ms` where present and otherwise from poll timestamps. Every step was a session call.

| step | time | notes |
|---|---|---|
| begin_lyrics (create) | instant | |
| lyric_sweep 0–27 | 2.6 s | 28 planned, 0 refused, 4 accepted |
| lyric_screen (on, gone, dawn, drawn; relation declared) | 14.9 s | ~9 KB with 4 words, so fine. `on` vs gone/dawn/drawn: RHYME 1.000 but `schema:perfect rhyme` REFUSED (see O1) |
| lyric_plan seed 10 | 0.9 s | |
| lyric_grade draft 1 | ~140 s | exit 2, 23 per-line flags, 25 banned pairs (mostly MODAL_RHYME, plus PROMINENCE_OUT_OF_BAND on 20 lines) |
| lyric_revise open (run 1) | 139.6 s | batch question for 15 lines, **265 KB** (B2) |
| round 1: 15-line batch | 487.4 s | accepted L2, L3(+22), L5. Rejected L8 (whole-draft FUNCTION_WORD_HEAVY) and L11 ("previously judged required check(s) became refused"). 10 answers got no recorded outcome (O4) |
| round 1: 9-line batch | 103.2 s | accepted L4(+23). Rejected L9 (FUNCTION_WORD_HEAVY). 7 answers "unverified". Then the loop escalated to a tier-2 group question for L6/L8/L9 |
| group C, attempt 1 | 499.1 s | rejected: introduced FUNCTION_WORD_HEAVY + PROMINENCE on L9 |
| group C, attempt 2 | **killed at 599.0 s** | B1 |
| same answer re-sent | 440.4 s | accepted ("fixed 5, introduced 0") → next question: group E (L10/L11) |
| group E answer | **killed at 599.0 s** | wrapper `completed`/`resumable:false`, inner `status:"interrupted"` |
| resume_operation | instant | refused `RESUME_NOT_INTERRUPTED` |
| re-send the same answer | instant | refused: "`state` holds no pending question" |
| continuation with no answer | **killed at 599.1 s** | 27 answers replayed |
| lyric_revise recover_only | instant | journal exported. `new_run_required: true` |
| lyric_grade drafts 2–5 (my own manual fixes, same declarations) | ~290 s, ~390 s, ~260 s, ~160 s | flags 7 → 6 → 3 → 2, bans 12 → 7 → 1 → 0 |
| lyric_grade draft 6 | ~18 s | **exit 0, certified**, 0 flags, 0 bans |
| lyric_revise `new_run: true` on draft 6 | ~125 s | **[FINISHED … exit 0 — SUCCESS after 0 round(s)]** |

Total ≈ 2 h 05 min. Revise run 1 had 27 answers on record over 2 rounds (tier 1) plus 3 group questions (tier 2); run 2 needed 0 rounds.

## 4. The song

Reproduced character for character from the first content block of the finished `lyric_revise`:

```
[PRECHORUS — 2 lines — 2 bars of 127/8, half-beat pickup]
Clock on the wall says three and the kettle gone cold
Radio's got a drawl, and the thunder not consoled

[CHORUS — 2 lines — 2 bars of 127/8, three-quarter-beat pickup]
Whenever you ride the bus, there's a porch light on down the street
No fuss, no questions, your supper and my heartbeat

[VERSE — 5 lines — 5 bars of 127/8, three-quarter-beat pickup]
Grease on his collar and his lunch pail, I know my man is near
He walks home, his time card punched, humming up the lane
They say the owners brought police down to the depot yard today
And the guard says the night shift is an open vein
He swings his wrench, hands scarred, survivor of each campaign

[FALSE_ENDING — 2 lines — 2 bars of 127/8, half-beat pickup]
Keys at the door at a quarter to five, and I hear his sigh
Squeeze me tight, I tell him, this is love we can't deny

[REPRISE — 1 line — 1 bar of 127/8, half-beat pickup]
Porch light on for the one who comes home late

[HOOK — 6 lines — 6 bars of 127/8, half-beat pickup]
However long the nights, I will see you through
No matter what the bosses say, the lamp is lit
When the rent is due, I let no worry creep
Each word I ever promised you, I mean it, I renew
Shoe polish on the table, and the coffee black and cheap
Porch light burning like a lantern in the hallway

[REPRISE — 1 line — 1 bar of 127/8, half-beat pickup]
Porch light on, and the moths are singing low

[PRECHORUS — 2 lines — 2 bars of 127/8, half-beat pickup]
A note tucked in his jacket pocket, and his cap upon the floor
He swore to mend any rowboat, as in the war

[CHORUS — 2 lines — 2 bars of 127/8, three-quarter-beat pickup]
Whenever you ride the bus, there's a porch light on down the street
No fuss, no questions, your supper and my heartbeat

[OUTRO — 17 lines — 17 bars of 127/8, three-quarter-beat pickup]
Slow sun on the depot fence, the block gone gold
We walk arm in arm through the bakery smoke
We laugh about bosses and those folk up high
Baker's boy sweeps crumbs down a gutter stream
Twenty years he had to soak it up, no goodbye
Neighbor on her step, a rose behind her ear, looks out on the road
Warm elbows touching, the sky about to explode
Your coat hangs off my shoulders like a flag above the sea
Come layoffs, we stand firm, even though
Each window on the block lights up like a daydream
A kid on a bike tosses news at the gate
The fear froze in my chest, but we have paid what we owed
Blues from a neighbor's radio, like a slow freight
I hum a hymn Mama wrote, and the cold lifts by degree
Frost on the windows, and the whole street shining like a coin
No one lost tonight, the fear gets tossed
Heel to toe up the steps, and I turn the porch light off

[FINISHED — seed 10 — exit 0 — SUCCESS after 0 round(s) — no line flag stands]
```

## 5. Bugs

### B1. A revise continuation on a 40-line song is killed at the 600 s deadline, and the run cannot be continued afterwards — **blocker**

- **Tool:** `lyric_revise` (session mode), continuing call with `answers` (or with no answer after a kill).
- **Song:** 40 lines, seed 10, `relation: "schema:perfect rhyme"`, wants `["uses=verse,chorus","group<=4","binding_cap<=1"]`, title "Porch Light On", default `attempts`/`backtrack`.
- **What happens:** every continuation spawns a fresh process that replays the whole journal (`"PROPOSER: … 26 answer(s) already given, replayed in order"`) and then re-grades. Wall time per call on this run: open 139.6 s → batch of 15 answers 487.4 s → batch of 9 answers 103.2 s → group answer 499.1 s → next group answer **killed at 599 030 ms** → identical re-send 440.4 s (accepted) → next group answer **killed at 598 984 ms** → no-answer continuation **killed at 599 057 ms**.
- **Observed after a kill (3 of 3 times):** `"exit_code":-1,"meaning":"subprocess failure (-1): verb killed at the shared tool deadline"`. On the second kill the inner verdict says `"status":"interrupted"` and `"Resume explicitly with run_id or state under the same declarations; completed proposals are in that journal."`, but the operation wrapper says `"status":"completed","resumable":false`, and:
  - `resume_operation` on it → `RESUME_NOT_INTERRUPTED: Only an interrupted operation can be resumed; this one is completed.`
  - re-sending the same `answers` from its session_id → ``Error: `answer`/`answers` was given and `state` holds no pending question — there is nothing it answers`` (the answer had been journalled; 27 answers were on record).
  - calling `lyric_revise` with only the session_id (no answer) → killed again at 599 s.
  - `lyric_revise {recover_only:true}` → works, and says `"new_run_required": true`.
- **Expected:** `get_operation`'s own description says "interrupted: when resumable is true, call resume_operation; otherwise accepted_draft holds the accepted lyrics…". A kill mid-revise on a 40-line song should either be resumable or at least report `status: interrupted` at the wrapper, and the in-band advice ("Resume explicitly with run_id or state") must not point to fields the session surface refuses ("never send those with a session_id").
- **Why it is new relative to K1:** K1 is a single `lyric_grade` on 104 lines. Here the grade itself finishes (140–390 s on 40 lines), but each revise continuation replays every answer on record, so the per-call cost grows with the number of answers; a 40-line song reached the deadline after 26 answers. The same input took 599 s (killed) and then 440 s (accepted), so whether a call completes depends on server load.
- **Reproduced:** killed 3 times. The wrapper/inner status mismatch was seen once (the second kill); the other two kills had no inner `status` field.

### B2. A revise batch question is ~265 KB and cannot be displayed — **annoyance**

- **Tool:** `get_operation` on the first `lyric_revise` operation (no `detail` is available for a pending question).
- **Observed:** content block 0 was **264 759 characters** for a 15-line batch question (the client refused it: "result (271,012 characters) exceeds maximum allowed tokens"). The next batch (9 lines) was **167 368 characters**. Each per-line brief repeats the whole 40-line draft, the same 12 whole-draft notes (including the ~1.5 KB `COLLISION_CUT_IS_SCALAR_ONLY` paragraph) and the same "WHAT THE GRADER ENFORCES" boilerplate, so the size is about 17 KB × lines asked.
- **Expected:** the rule "a response is unusable (e.g. too large to display)". A question is the one response the writer must read in full to answer, and `get_operation`'s `detail`/`lines` narrowing only applies to a finished grade/revise.
- **Reproduced:** 2 of 2 batch questions (15 lines → 265 KB, 9 lines → 167 KB). The single-group questions were about 20 KB each.

### B3. `lyric_types` and caller-managed `lyric_screen` time out at the client's 60 s limit while the server is busy — **annoyance**

- **Tool:** `lyric_types {word_a:"on", word_b:"con"}` (twice), `lyric_types {word_a:"sea", word_b:"company"}` (3 times), `lyric_types {word_a:"sea", word_b:"reality"}` (once), `lyric_screen {words:["sea","company","reality"], relation:"schema:perfect rhyme"}` (no session_id; once).
- **Observed:** `MCP server … tool "lyric_types" timed out after 60s` every time a grade or revise was running (from this session or, presumably, from the other parallel runs). The same tool answered in 1.0–20.1 s when nothing was running (`on/gone` 1 026 ms and 1 731 ms, `stove/mauve` 20 127 ms).
- **Expected:** the description says "Computation has a shared 600-second deadline". A lookup that "answers at once and takes no session" (server instructions) is starved behind queued lyric work and cannot be used for the "minimal separate check" the song run needs.
- **Reproduced:** 7 of 7 calls made while a grade or revise was pending. Some of this may be the MCP client's 60 s budget rather than the server, but the lookup is synchronous and has no queue/poll path.

### B4. `schema:perfect rhyme` accepts sea ~ company and sea ~ reality (stress-mismatched, run-on), and the revise brief offers them as perfect rhymes — **wrong result**

- **Where it surfaced:** the round-1 brief for L37 (end word bound to L31's "sea", relation `schema:perfect rhyme`) offered `company, degree, xi, reality` and said: "The list below is what that relation accepts — the same judge the verdict uses."
- **Minimal repro:** `lyric_types {word_a:"sea", word_b:"company"}` and `lyric_types {word_a:"sea", word_b:"reality"}`. Each was run twice with identical output:
  - `agreement (onset,nucleus,coda) per syllable: ((False, True, True),)`
  - `cells: [('assonance', 'vowel rhyme', 'consonance', 'perfect rhyme', 'full rhyme', 'true rhyme')]`
  - `length: subtractive`
  - `NAMES: subtractive rhyme, perfect rhyme (last stressed syllable), …`
  - `registry schemas: …, perfect rhyme; …`
- **Control:** `lyric_types {word_a:"sea", word_b:"money"}` has the same shape (stressed first syllable, unstressed final /i/) but gives `((False, False, True),)`, `cells: [('consonance',)]`, `registry schemas: consonance, light rhyme, pantun ABAB` and **no** perfect rhyme. So company/reality are anchored on their unstressed final syllable while money is anchored on its stressed one.
- **Expected:** the plan's own brief defines the relation: "perfect rhyme (also: full rhyme): the bound words agree on nucleus, coda, onset (after the stressed syllable), **prominence**; differ on onset (at the stressed syllable); **neither word runs on past the rhyme**". "company" (K AH1 M P AH0 N IY0) and "reality" (R IY0 AE1 L AH0 T IY0) carry primary stress elsewhere, and the tool itself labels the pair `length: subtractive` / "subtractive rhyme". The same pattern is plausible for the L8/L9 offer of "timeframe/mainframe/nickname" against "same", but I did not isolate those.
- **Impact:** a writer who takes an offered word can pass a declared perfect-rhyme mandate with a stressed-vs-unstressed pair (sea/company), and the verdict certifies it.
- **Reproduced:** 2 of 2 for each pair; the control was run once.

## 6. Observations

- **O1 (K3, new word).** `lyric_screen` with `relation: "schema:perfect rhyme"` on `on ~ gone`, `on ~ dawn`, `on ~ drawn` gives `schema:perfect rhyme REFUSED: 'perfect rhyme' could not be read at the pair (a channel or anchor the two words do not supply) — a refusal, not a no`. Yet in the same row it gives coarse `RHYME … 1.000`. `lyric_types on/gone` (run twice) reports `agreement … ((False, False, True),)`, i.e. nucleus disagrees under its reading (`on` = AA, `gone` = AO), and also `coarse relations: ASSONANCE, CONSONANCE, RHYME` together with `relations: rhyme (channels)=False`. The same pattern happened with `won` at L39 (grade 1: `SCHEME_UNREADABLE; words with more than one reading: … won`) and with `erode` at L30 (grade 2). This looks like the K3 multi-reading behaviour on new words, not a new cause. Title "Porch Light On": I kept "on" out of every bound slot because of this.
- **O2 (K2, new genre evidence).** The drawn plan gives every line 127 beats and "up to 505 syllables a line". Yet PROMINENCE_OUT_OF_BAND flagged ordinary 12–16-syllable **sung** soul lines with 8–11 prominences (20 lines in grade 1). The band is the right size for sung English. It is the plan brief that invites far longer lines than the band will pass. Most of the 2 h went into trimming lines to ≤7 prominences.
- **O3.** The whole-draft note `COLLISION_CUT_IS_SCALAR_ONLY` says "This run declared ('ASSONANCE', 'CONSONANCE', 'PROMOTED_RHYME', 'RHYME', 'RIME_RICHE')". The run declared `schema:perfect rhyme`, and the grade report itself says so: "RELATION: every group is judged under 'schema:perfect rhyme'". It appeared in all 4 revise questions. It is a note, so it doesn't block anything, but the sentence is false for this run. `MANDATE_GROUPS_INDISTINGUISHABLE` is also printed twice, once for groups "B [3, 4]" and once for "Q [3, 4]" (the internal-slot and end-rhyme groups over the same lines), with identical edges.
- **O4. Batch answers disappear without a verdict.** The two batches took 15 + 9 answers. The journal (`recover_only`) records outcomes for only L2, L3, L5, L8, L11 (batch 1) and L4, L9 (batch 2). Batch-1 answers for L12, L14, L15, L19, L21, L24, L25, L30, L33, L34 and batch-2 answers for L16, L18, L26, L35, L36, L37, L40 have no outcome (the next question's `folded` list showed them as `"verdict":"unknown","source":"unverified"`). None of those lines was asked again before the run died. Whether they would have been re-asked is unknown, because the run could not continue (B1).
- **O5. Group questions offer nothing.** Both tier-2 group questions (C = L6/L8/L9, E = L10/L11) printed `PIVOT OPTIONS … (none offered)` for every member. Yet the tier-1 brief for L8 in the same round had offered `nickname, surname, mainframe, timeframe, username` for the same slot.
- **O6. L2's slot had no legal answer.** L1 "stove" / L2 T4: every OW-V perfect rhyme is either `-ove` (HOMEOTELEUTON with stove) or on the forbidden modal list, and "mauve" is AO. So no single-line answer existed, which is working as designed. I fixed it by changing L1 instead, in a fresh draft.
- **O7 (K1, measurements).** A full `lyric_grade` of this 40-line song took 140 s cold, 290–390 s while other runs were loaded, and 18 s for the final clean draft. It was never killed. The kills were all in `lyric_revise` continuations (B1).
- **O8. Every revise question repeats the same explanation.** Each per-line brief repeats a ~51-entry `HEADS_EXCEED_UNITS` pulse list, `SPARSE`, `LATE_ENTRY` and the `NO_SETTING` paragraph, because the 127/8 bar is meaningless for sung lines. These are notes, but they account for much of B2's size.
- Working as documented, noted but not reported: MODAL_RHYME bans with a corpus count of 1 ("'Suits' is the most-predictable answer to 'Boots' — realised … 1 time(s)"; "'road' is the most-predictable answer to 'code' — … 1 time(s)"); HOMEOTELEUTON on claim/aim, rule/mule, renew/stew; the `binding_cap<=1` want still binding lines at two places (the plan says "the end-rhyme pass binds free line ends on top").

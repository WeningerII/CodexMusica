# The 2026-09-01 triage of how a song is written — index and dispositions

The audit itself is the owner's private artifact *Lyric Harness Triage*
(claude.ai, 2026-09-01), built by reading the working order end to end and
verifying each finding by a second, skeptical reader before it was banked;
31 findings survived, 6 skeptic refutations are recorded inside it. This
file is the REPOSITORY's copy of what the audit found and what became of
each finding, so the artifact is not the only place the map lives. The
owner's answer to the audit's questions was a delegation — *"I leave the
answers to your capable hands and taste"* — and every ruling taken on it
is listed in `BACKLOG.md` § RULINGS TAKEN UNDER DELEGATION, one line each,
with the argument in the named `MISSING.md` entry.

Tiers are the audit's own: **A** blocks a finished song; **B** why every
song sounds the same; **C** cost, clocks and the deploy; **D** the record.
"Where it went" names the register entry that closed, repinned or records
it; an OPEN row says what it waits on.

| id | tier | finding, in one line | where it went |
|---|---|---|---|
| C16 | A | a tier-1 answer was keyed on (line, attempt) and `attempt` restarts each round, so a stuck line was never asked twice; a finished deferred state re-ran as live | M-183 CLOSED |
| C17 | A | the brief intersected one candidate field ACROSS a line's binding places; tier 2 rewrote the wrong line | M-184 CLOSED |
| C02 | A | the chat surface finished zero songs: the suspended run was re-injected after a stop, and an unseeded song could not be carried | M-183, M-195 CLOSED |
| C14 | A | `quality/recover.py` — the human door — had no verb and no tool | M-195 CLOSED (`recover`, `lyric_recover`) |
| C05 | A | a pasted song could be looped but never FINISHED: only `finish` rendered, and it needs a seed | M-195 CLOSED (`revise` under `defer:` renders and stamps) |
| C20 | B | the participation draw pinned the mean density near 2.5 bound words a line; the sparse band was unreachable at any seed | M-191 CLOSED (the density cap) |
| C03 | B | the length envelope's floor rose past four of the five listenable songs | M-193 CLOSED (the `short` profile; envelope 12–55) |
| C04 | B | a 108–126-token song was graded on the sonnet profile by list order | M-193 CLOSED (the line-count tie-break) |
| C09 | B | a drawn end-web can be inaudible as rhyme and nothing said so (M-120) | M-192 CLOSED (disclosed); RULINGS WANTED #18 for the draw |
| C19 | B | the brief named `T5`, `headrime` and a schema with no gloss, and never the syllable ceiling `SLOTS_EXCEEDED` grades against | M-192 CLOSED (legend, capacity line) |
| C12 | B | the screen could not ask the question the grade asks of a drawn schema | M-189 CLOSED |
| C18 | B | the two-tier ban closes every common rhyme family; its effect on convergence and end-word rarity is measured nowhere | OPEN — M-168's measurement (screen the 16 banked songs' first drafts against their exit-0 versions for ban share and frequency rank) is a sitting and was not taken |
| C07 | B | the instructions let a chat skip the sweep and the screen | M-189 CLOSED (sweep-first sentence; the screen judges the drawn relation) |
| C22 | B | a chorus drawn once finished at exit 0 with no hook askable | M-190 CLOSED |
| C08 | B | every song shops the same clean glossary (M-111) | OPEN — RULINGS WANTED #5 is the owner's (may a check read `songs/`) |
| C21 | A | `revise`/`finish` exited 0 over a standing whole-draft flag; the stop printed no findings | M-186 CLOSED |
| C15 | B | `lyric_check`'s verdict dropped the whole-draft flags and unreadable end words | M-186 CLOSED |
| C06 | B | `--voices` / `--fallback` were unreachable from the connector | M-189 CLOSED |
| C23 | B | the song-length floor has a false-positive rate and no true-positive rate (no generated class) | OPEN — RULINGS WANTED #20 (a sitting) |
| C13 | B | three parked grader rulings (M-136, M-138, M-140) live on bare groups | M-140 CLOSED (normative filter); M-136, M-138 ruled in part, the verdict-moving halves parked with reasons |
| C10 | B | the empty/empty coda gift (E-5), cheap half | NOT TAKEN — the owner's 2026-08-21 deferral stands |
| C01 | C | the image never shipped `mcp/worker.py` | M-187 PARTIAL (shipped; the live-engagement probe open) |
| C11 | C | late in a song a chat turn buys ~4 tool calls under the re-sent transcript and the $0.10 cap | M-197: `cost` and `usage` ride the `/chat` response now; `CHAT_MAX_TURN_USD` and brief pruning are the owner's, with the numbers to rule from |
| C29 | C | tool descriptions promised 10–25 s; a grade measures 88–167 s, past an external client's 60 s default | M-189 CLOSED (measured envelope in every description); the SDK-default-client question is the owner's |
| C24 | C | the CI record was stale in two figures and the nightly sized on a rate nobody re-ran | M-187 PARTIAL |
| C28 | C | a mid-turn 429 throws the turn away and is never charged; the spend counter is in-memory | M-197 CLOSED (the throw carries its partial usage and is charged); the counter's disk is AUDIT.md F128, an ops decision |
| C25 | C | five deploys of one sha in 38 h | M-187 PARTIAL (push-only deploys; the re-run case open) |
| C30 | C | a missing staged resource crashed every grading verb at exit 1 in three voices | M-188 CLOSED |
| C26 | C | `main` is unprotected | RULINGS WANTED #19 (a repository setting) |
| C31 | C | M-170's unmeasured fold costs | M-170 addendum (the clean-regime fold timed; the flagged regime open) |
| C27 | D | 124 of 164 RESULTS rows and 93% of log rows carry a dirty-tree stamp; `song_log` had no parser for `finish`; two songs sit in the bank at exit 3 with no README entry | the `finish` parser SHIPS (`quality/song_log.py`, `test_songs_log.py`); the dirty-tree share and the two unlisted songs are recorded in M-196 as open, with the refuse-on-dirty design and its cost |

What the audit got WRONG is inside it and is repeated here so it is not
lost: M-94 was moot (prettier stopped reading the blueprints on 08-25);
M-139's site count was stale; M-135's null exists and gates CI; the
multi-answer fold remedy for C11 does not exist (the loop cannot brief a
question it has not reached); M-168's per-minute-limiter attribution is
asserted, not measured.

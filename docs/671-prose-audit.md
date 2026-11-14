<!-- #671 plan for review (draft). The fixes are being built on this branch; until
then this file is the plan. It will be removed or folded into the PR body before merge. -->

# #671 audit, pass 2: instructions that steer only through wording

- **Code checked:** main `d07b57cbd` (14 Nov 2026), read-only. No code was changed.
- **Definition (John):** *prose* is any instruction whose effect lives only in its wording, so nothing in code checks or acts on it. Replace it with data the code acts on: variables, values and rules the planner and grader compute and enforce. Models read code and data directly.
- **Rules for the fixes:** nothing over-engineered; reuse existing fields, codes and checks; no new abstractions.

Each finding gives:
- **Where:** the file and line.
- **Text:** the exact words.
- **Steers:** what the text pushes the reader to do.
- **Backed:** whether code checks it today.
- **Existing:** what already exists that can carry it.
- **Fix:** the recommended replacement.
- **Verify:** a check a verifier can run.

"Writer" means the lyric writer model. "Agent" means a connecting agent. "Repo" means an agent working from a copy of the repository.

Each fix is sized as follows:
- **S:** delete or reword only.
- **M:** a small code change that reuses existing logic.
- **L:** needs a decision first.

---

## A. The lyric writer's brief: what the writer reads (`lyric-harness/quality/plan.py` and others)

**The headline:** nothing grades the story plan. The code says so itself, in `plan.py:4708` ("No grader reads this coordinate") and in the `lyric_plan` field text (`mcp/lyric_tools.js:1804`): "A RECORD, not a gate: nothing grades a draft against its story plan". The writer is never told this.

**A1. Story jobs (S)**
- **Where:** `plan.py:5149-5157` (`atom_say`), printed at :5165-5172. Read by the writer.
- **Text:** "puts the world and its cast in place" / "lets the pressure in" / "flips the reading of everything before it" / "holds the moment and deepens it, without advancing" / "is the fixed claim the song keeps returning to" / "is a compressed verdict on what has happened" / "cashes the standing pressure" / "is the leave-taking".
- **Steers:** what each section must do with its meaning.
- **Backed:** no. The planner uses the labels only for ordering rules: which job may follow which, and RESOLVE needs an earlier COMPLICATE (`narrative.py` `validate_lineup`). No grader file reads `plan["narrative"]`.
- **Contradictions with the plan's own data:**
  - Sections that occur only once are told they are "the fixed claim the song keeps returning to". That happened in 9 of 12 sample plans.
  - An open-form reprise gets ANCHOR but no return pair, so a draft written to that brief draws `REPRISE_BRINGS_NOTHING_BACK`.
- **Existing:** `plan["narrative"].atoms` (`[index, function, atom]`), `narrative.ATOMS`, and the "RECORD, not a gate" wording.
- **Fix:** delete `atom_say`. If the story record stays visible, print the atom triples as data, tagged "record, not graded". No honest grader check exists, because every job is a claim about meaning.
- **Verify:** from `lyric-harness/`: `python3 -I -c "import sys,os;sys.path.insert(0,os.getcwd());from quality import plan as P;b=P.writer_brief(P.make_plan(1,form='verse-chorus'));assert 'pressure' not in b and 'keeps returning' not in b"`

**A2. Story links between sections (S)**
- **Where:** `plan.py:5158-5162` (`junc_say`), plus the header at :5165-5166. Read by the writer.
- **Text:** "because of" / "against" / "after" / "elsewhere during" / "deeper into" / "set beside (connection unstated)"; "each enters from the section before it as stated".
- **Backed:** no. The links only limit which labels the planner draws. The output can be nonsense: a chorus that repeats word for word is told it enters "after" or "set beside" its own previous copy (seeds 42 and 7).
- **Existing:** `plan["narrative"].junctions`.
- **Fix:** delete `junc_say` and the "as stated" header, and keep the triples as data only.
- **Verify:** `grep -n "junc_say\|enters from the section before" lyric-harness/quality/plan.py` returns nothing.

**A3. The "no story plan" sentence (S)**
- **Where:** `plan.py:5174`.
- **Text:** "NO STORY PLAN: this shape carries no legal story line-up, so nothing is asked of the meaning axis."
- **Backed:** it accurately reports that no story plan was drawn, but by contrast it implies other plans do ask something of the meaning, and none of them does.
- **Fix:** fold it into the same data row (`mode: none`) and delete the sentence.
- **Verify:** `writer_brief(make_plan(42))` contains no "meaning axis".

**A4. The hook line contradicts the grader (S)**
- **Where:** `plan.py:5197`.
- **Text:** "Line N is the hook line; it comes back with its section."
- **Backed:** partly. `HOOK_ABSENT` and `HOOK_DOES_NOT_RECUR` are flags. But if the hook appears only inside its section, `HOOK_CONFINED` fires (a note, `grid.py:2552`), and that note's evidence says the opposite of the brief: "one that only ever appears where it is expected is a section, not a hook".
- **Existing:** `plan.hook_slot` and `grid.SEVERITY`.
- **Fix:** print `hook_slot` with the codes that grade it and their severities, read from `grid.SEVERITY`. Delete "it comes back with its section". Drop the opinion sentence from `HOOK_CONFINED`'s evidence.
- **Verify:** the brief's hook row lists the codes; `grep -n "is a section, not a hook" lyric-harness/quality/grid.py` returns nothing.

**A5. The patter note (S)**
- **Where:** `plan.py:5191`.
- **Text:** "Patter lines carry more words to the beat than the lines of every other part."
- **Backed:** only as a note: `PATTER_NOT_DENSER` (`grid.py:3930`) never rejects anything, yet the brief states it as fact.
- **Fix:** replace it with the check as data: `{code: PATTER_NOT_DENSER, severity: note}`.
- **Verify:** the patter row prints the severity from `grid.severity_of("PATTER_NOT_DENSER")`.

**A6. The tag note (S)**
- **Where:** `plan.py:5194`.
- **Text:** "The tag is no longer than any other sung part of the song."
- **Backed:** yes, by construction. The planner already guarantees it (`plan.py:4139-4150`), and the writer cannot change line counts anyway.
- **Fix:** delete it.
- **Verify:** over seeds 1-200, no plan with a tag meets the condition for `TAG_NOT_SHORT`.

**A7. Repeats and reprise (M)**
- **Where:** `plan.py:5180-5182` and :5187-5189.
- **Text:** "Every {fn} after the first repeats the first {fn} word for word…" / "Line b opens the reprise by repeating line a word for word; the rest of the reprise is new."
- **Backed:** mostly. `RETURN_NOT_VERBATIM` is a flag. "The rest is new" is not checked. In open form a reprise gets no return pair at all.
- **Fix:** keep these, or print `plan.returns` as data. Have the planner emit the reprise return pair in every form, reusing the existing `returns` mechanism. Drop "the rest is new".
- **Verify:** `make_plan(7)["returns"]` is non-empty whenever the plan contains a reprise.

**A8. Reassurances about filling lines (S, optional)**
- **Where:** `plan.py:5058-5093` and :5122.
- **Text:** "a setting choice, not a fault" / "the ceiling below is room, not a target".
- **Backed:** yes, by the severities in `fit.py`.
- **Fix:** replace the phrases with the codes and their severities: `CROWDED`, `SPARSE` and `PROMINENCE_EXCEEDS_HEADS` are notes; `SLOTS_EXCEEDED` is a flag.
- **Verify:** the existing `test_plan` counts still pass.

**A9. Rejection rules that contradict each other (S)**
- **Where:** `propose.py:243-244`, the revise prompt.
- **Text:** "The grader reads them too: a revision that makes one WORSE is rejected."
- **Backed:** no. Only new FLAGS reject (`revise.py:6869`). The same prompt's rule 4 says "New NOTES do not reject".
- **Fix:** delete the sentence.
- **Verify:** `grep -n "WORSE is rejected" lyric-harness/quality/propose.py` returns nothing.

**A10. The "complete" list of rejection rules is incomplete (M)**
- **Where:** `propose.py:343-379` (`_enforced_block`, documented as "and NOTHING ELSE") and the group block at :897-905.
- **Backed:** partly. The listed rules are real, but three rejections in `Reviser.verify` are missing:
  - a required check becoming refused (`revise.py:6838`);
  - a judged obligation becoming refused (:6842);
  - a new HOMEOTELEUTON or MODAL_RHYME flag (:6855).
- **Fix:** generate the list from `verify`'s reason strings, using one table that both read.
- **Verify:** a test that every `verify` rejection has a matching row.

**A11. "Leave that word alone" (S)**
- **Where:** `propose.py:300` and :327.
- **Text:** "HOLDS as written; leave that word alone" / "keep the word at any place that holds".
- **Backed:** no. Only breaking the group rejects.
- **Fix:** keep "HOLDS" as status data and drop the instruction.
- **Verify:** the rendered prompt has "HOLDS as written" and no "leave that word alone".

**A12. Instructions about meaning (S)**
- **Where:**
  - `propose.py:623`: "Keep the intended meaning; do not invent a pronunciation to obtain a pass."
  - `propose.py:812-813` (whole-draft repair): "Preserve the song's meaning…" / "Change only what is needed…"
- **Backed:** meaning and minimal change are not checked. Line count, targets and relations are checked by `verify`.
- **Fix:** delete the meaning and "only what is needed" phrases. The member list already bounds the edit.
- **Verify:** `grep -n "intended meaning\|song's meaning" lyric-harness/quality/propose.py` returns nothing.

**A13. Advice inside a ban finding (S)**
- **Where:** `revise.py:3842-3848`, the HOMEOTELEUTON message quoted to the writer.
- **Text:** "the laziest class, banned before any frequency judgment" / "reach for a differently-spelled partner or a declared near rhyme…"
- **Backed:** the ban is enforced, and stays (John's #843). "Laziest" and the "reach for" advice are word steers.
- **Fix:** keep the code and its evidence; delete the adjective and the advice.
- **Verify:** `grep -n "reach for a\|laziest class" lyric-harness/quality/revise.py` returns nothing.

**A14. The melody note (S)**
- **Where:** `melody.py:64-66`.
- **Text:** "Write to this tune."
- **Backed:** partly. Meter and bars come from the melody and are graded. Pitches and how syllables sit on notes are not graded.
- **Fix:** keep the notes as data and delete the sentence.
- **Verify:** `melody_brief` output has no "Write to this tune".

**Already backed (no change):** the rhyme group rules (`SCHEME_VIOLATION`), the Feel/meter line, "do not add or remove sections" (`fill_plan` refuses), and the writer system instruction (`gemini_proposer.py`, reply shapes parsed).

---

## B. The connector's instructions and tool descriptions (read by connecting agents)

**How enforcement works today:**
- The website chat and `/mcp` sessions in "create" phase enforce most rules in code: `creationRefusal` in `mcp/lyric_workflow.js`, the session refusals in `workflow_sessions.js`, and the chat host's finish in `gemini_agent.js:3070-3165`.
- The raw endpoints (`/mcp/recipe`, `/mcp/lyrics`, stdio) and session-less calls get the same rules only as sentences.

**B1. Edit phase switches off the whole creation gate (M) — the most important item**
- **Where:** `mcp/workflow_tools.js:133` and :302.
- **Text:** "Phase 'edit' is only for lyrics the user supplied … so choose it only then."
- **Backed:** no. `create()` (`lyric_workflow.js:131`) returns false for edit, so an edit session can sweep, plan and write a new song with no order checks. This is the main bypass, and only a sentence guards it.
- **Existing:** the mirror rule already exists. In create, `lyric_check` and `lyric_recover` are refused (`lyric_workflow.js:356`).
- **Fix:** in an edit session, refuse `lyric_sweep`, `lyric_plan`, and any `lyric_grade` or `lyric_revise` carrying a `seed`, with "a new song needs begin_lyrics phase 'create'". Then delete "choose it only then".
- **Verify:** a test where `begin_lyrics {phase:'edit'}` then `lyric_plan {seed:1}` gives `tool_error` naming "phase 'create'".

**B2. Recipe versus lyrics separation (S)**
- **Where:** `tools.js:363-365`, plus copies in `lyric_tools.js` and `workflow_tools.js:119`.
- **Text:** "Only execute the task the user requested… a lyric request never derives declarations from a recipe."
- **Backed:** partly. Chat: only one domain's tools are offered (`gemini_agent.js:1106`, :2315). Sessions: `SESSION_SCOPE`. The single-family endpoints are structural. Raw and `/mcp`: unknowable.
- **Fix:**
  - On the single-family endpoints, delete it.
  - On the mixed endpoints, keep one fact: "a session refuses the other family (SESSION_SCOPE)".
  - Delete "never derives declarations from a recipe": no lyric tool takes recipe input.
- **Verify:** `grep -c "never derives declarations" mcp/tools.js` gives 0.

**B3. "The default seed is scaffolding" (S)**
- **Where:** `tools.js:347`, and `tools.js:190` (start_recipe).
- **Text:** "…if the user expressed ANY preference … follow with edit_recipe before presenting."
- **Backed:** in chat (`RECIPE_UNFINISHED`, `chat.js:881`). Elsewhere, prose: the server cannot see the user's words.
- **Existing:** each card's `changed` field, which is absent on an untouched card.
- **Fix:** keep the chat rule. Elsewhere replace it with the fact "a card with no `changed` field is the stock default", and drop the shouted framing.
- **Verify:** `grep -n "SCAFFOLD" mcp/tools.js` shows only the reduced sentence.

**B4. Routing words to tools (S)**
- **Where:**
  - `tools.js:350`: "Map intent to edits…", "set_preface on EACH instrument";
  - `tools.js:208`: "apply per instrument, not just once";
  - `tools.js:247`: "reach for search_prefaces instead";
  - `tools.js:265`: "whenever the user says ANY stylistic adjective".
- **Backed:** no. Any routing is accepted.
- **Fix:** delete the steers. Keep what each edit action does, which the schema already lists.
- **Verify:** `grep -nE "reach for|ANY stylistic|EACH instrument|not just once" mcp/tools.js` returns nothing.

**B5. "Iterate until every word the user said" lands (S)**
- **Where:** `tools.js:218` and :359.
- **Backed:** "verbatim" is enforced in chat. "Every requested word survives" is checked by `render_warnings` (`engine.js:612-697`). Words the user said but never edited in cannot be checked.
- **Fix:** replace it with "an empty `render_warnings` means every requested part, preface and environment word is in the output". Keep "verbatim" once for external hosts.
- **Verify:** `grep -n "every word the user said" mcp/tools.js` returns nothing.

**B6. Order of edits inside a batch (S)**
- **Where:** `tools.js:215`, `schemas.js:139`, and the copies in `AGENTS.md` (~178), the recipe plugin skill step 4 and `mcp/README.md:38`.
- **Text:** "put set_environment after set_preface in a batch".
- **Backed:** partly. Doing it the other way is reported as `ENVIRONMENT_OVERWRITTEN`, whose message teaches the fix.
- **Fix:** replace the order rule with the fact: "a set_preface on the environment card after a set_environment overwrites it; render_warnings reports ENVIRONMENT_OVERWRITTEN". Delete the copies in the docs.
- **Verify:** the batch `[set_environment, set_preface]` on the environment card yields `ENVIRONMENT_OVERWRITTEN`.

**B7. Small steers with no check behind them (S)**
- `schemas.js:120`: "usually best omitted". `ENVIRONMENT_NOT_RENDERED` already warns. Delete the phrase.
- `tools.js:282` and `schemas.js:312`: "Narrow it rather than raising limit" / "which knob you are turning". `truncated` and `variant_count` already say so. Delete both.
- **Verify:** `grep -n "usually best omitted\|Narrow it rather\|which knob" mcp/` returns nothing.

**B8. Rules already enforced (S, shorten only)**
- "never guess ids" (unknown ids are refused, `engine.js:1570`, :1685);
- "list each once" (`engine.js:752` refuses);
- the session rules (`SESSION_SCOPE`, `SESSION_BUSY`, `STALE_SESSION`, `RESUME_NOT_INTERRUPTED`, and the mixed-state refusal).
- **Fix:** reword each as "X is refused (CODE)", or delete.

**B9. The lyric working order as a paragraph (M)**
- **Where:** `lyric_tools.js:3940-3960`, plus the per-field copies: "keep it for the whole song", "carry unchanged", "grade the rewrite first".
- **Backed:** in create sessions and chat (`CREATION_ORDER`, `_PLAN`, `_DRAFT` and `_GRADE`, which restore and refuse). Raw calls are stateless, so it is prose there.
- **Existing:** `nextCreationCall` and `formatNextCall` (`lyric_workflow.js:744`, :784) already build the exact next call.
- **Fix:** make each lyric verdict's `next` the structured `{tool, args}` from `nextCreationCall`, instead of the `gradeNext` sentence. Cut the paragraph to one line: "Each verdict's `next` names the next call; a create session refuses others (CREATION_*)". Delete the per-field "carry unchanged" copies.
- **Verify:** a raw `lyric_grade` verdict has `next.tool === 'lyric_revise'`; `grep -c "The working order" mcp/lyric_tools.js` gives 0.

**B10. "Screen the pairs you mean to write" (S)**
- **Where:** `lyric_tools.js:2509`, the instructions step 1, `gemini_agent.js:929` and :986, `lyric_workflow.js:794`, and `README:89`.
- **Backed:** partly. A screen must run before the plan, but which words were screened (`w.screen.words`, recorded at `lyric_workflow.js:613`) is never compared with the draft.
- **Fix:** delete "you mean to write" and the parked note's "screen … first". Keep "a screen is required before the plan". Optional, if John wants it checked: the grade receipt lists draft end-word pairs that were not screened, as a disclosed count.
- **Verify:** `grep -rn "you mean to write" mcp/` returns nothing.

**B11. "Declare only what the user asked for" (S)**
- **Where:** `lyric_tools.js:3944` and :1689; `lyric_sweep` `want`.
- **Text:** "…and nothing they did not ask for" / "declare one only when the user gave or asked for one" / "honest and useless".
- **Backed:** no. The server cannot check intent.
- **Fix:** keep the facts (the title is optional; without one the report says `TITLE_UNDECLARED`). Delete the steers.
- **Verify:** `grep -n "nothing they did not ask for\|honest and useless" mcp/lyric_tools.js lyric-harness/lyric_harness.py` returns nothing.

**B12. "Pick from the list on taste" (S)**
- **Where:** `lyric_tools.js:3605`.
- **Fix:** delete "on taste". Keep "plan any seed in `accepted_shown` with the same coordinates".
- **Verify:** `grep -n "on taste" mcp/lyric_tools.js` returns nothing.

**B13. Presentation rhetoric (S)**
- **Where:** `lyric_tools.js:3963-3972`, :2609, :2452 and :3502.
- **Text:** "THE FINISHED SONG COMES FROM lyric_revise AND NOWHERE ELSE … the exact hand-wash…" / "present it as parked".
- **Backed:** in chat (`creationQualified`). External hosts get the facts as data: the stamp, `certified`, `status`.
- **Fix:** replace it with one fact: "Block 0 is the deliverable; finished means `certified: true` at exit 0, which the stamp shows". Drop the rhetoric, and drop the paragraph from the chat prompt, where the host enforces it.
- **Verify:** `grep -n "hand-wash\|present it as parked" mcp/` returns nothing.

**B14. Pronunciation honesty steers (S)**
- **Where:** `lyric_tools.js:3988`, :1741 and :1780; `gemini_agent.js:1270`; `coverage_advice.js:38`; `README:311`.
- **Text:** "honest source" / "Never choose phones just to pass a check" / "Never silently guess" / "never guess a reading".
- **Backed:** the mechanics are (`basis` and `source` fields, marker refusals); motive is not.
- **Fix:** delete the motive words. Keep "copy the marker from the option".
- **Verify:** `grep -rn "just to pass a check\|silently guess\|never guess a reading" mcp/` returns nothing.

**B15. Other small items (S)**
- "FLAGS are defects; NOTES … are not to be 'fixed'" (`lyric_tools.js:3983`): keep the definition and delete "not to be fixed".
- "Never edit the envelope" (`lyric_tools.js:2121`): replace it with "an altered envelope is refused" (backed by the digest in `state_codec.js`).
- "Never mix the two modes" (`workflow_tools.js:137`): replace it with "raw calls leave no session receipt".
- "fewer `placements`… practical cover": keep the fact and drop "practical".
- **Verify:** grep each phrase.

**B16. The chat system prompt (S)**
- **Where:** `gemini_agent.js`.
- **Delete, because they are enforced by the host:**
  - "Stay in this domain" and "verbatim" (:1553-1560);
  - SKIPPED_STEPS_NOTE (:921). It is also wrongly shown in edit-phase tasks.
- **Delete, because it contradicts the code:** "The brief and current plan remain authoritative…" (:1555). The brief is explicitly ungraded.
- **Replace with data:**
  - RECIPE_BATCH_NOTE's "one per word… ONE step" (:1481) becomes "Hop budget: N (`limits.maxSteps`)";
  - the "Do not…" lines in SUSPENDED_RUN_NOTE (:968) and uncertifiedRunNote (:1266) are all enforced by `wanderRefusal` and `parkedRefusal`, so keep only the state line.
- **Verify:** `buildSystemInstruction` for `{domain:'lyrics', phase:'edit'}` has no "WORKING ORDER"; `grep -n "remain authoritative" mcp/gemini_agent.js` returns nothing.

**B17. Parked run: "keep every other line byte-identical" (M)**
- **Where:** `gemini_agent.js:986` (PARKED_RUN_NOTE).
- **Backed:** no. A rewrite can change lines that weren't flagged.
- **Existing:** `parkedRefusal` (:1241) and `sameDraft`.
- **Fix:** in `parkedRefusal`, refuse a draft whose lines outside `lyr.open` differ from `lyr.draft`. Then shorten the note to the open line numbers and the call shape.
- **Verify:** a test where a parked run with open `[3]` gets a draft that also changes line 1, and is refused.

**B18. A bug: the review sentence is added twice (S)**
- **Where:** `task_contract.js:172` and :180.
- **Fix:** delete the second push.
- **Verify:** `lyricContextText({intent:'review', brief:'x', document:'', declarations:{}})` contains "REVIEW ONLY" once.

**B19. "[SETUP] rows" (S)**
- **Where:** `task_contract.js:186`.
- **Backed:** yes, by `sungRow` (`lyric_text.js:6`).
- **Fix:** keep the fact and drop the imperative.
- **Verify:** `draftFromText('[SETUP — x]\nla')` gives `['la']`.

---

## C. What tool calls return to agents (hints, refusals, warnings)

**C1. The sweep's next-step line drops the user's wants (S)**
- **Where:** `lyric_harness.py:12525`.
- **Text:** "NEXT: python3 lyric_harness.py plan --seed=N …"
- **Backed:** it prints form, lines and functions but not `--want`, so following it plans a different song.
- **Existing:** `want_raw` is in scope, and the plan branch's builder already appends `--want` (~:12735).
- **Fix:** add `want` to the printed flags.
- **Verify:** `plan --sweep=0-20 --lines=12 --want="sections>=3"` prints `--want=` on its NEXT line.

**C2. The raw connector rewrites that line to the seed only (M)**
- **Where:** `lyric_tools.js:995` (`publishedReport`).
- **Text:** "NEXT: lyric_plan with seed 0".
- **Backed:** no. It drops form, lines, functions, wants and melody.
- **Existing:** `formatNextCall`, as the session path already uses it (`withSweepNext`).
- **Fix:** build the line with `formatNextCall` from the sweep's own arguments.
- **Verify:** a raw `lyric_sweep{lines:12, want:"sections>=3"}` report contains `lines 12` and `wants`.

**C3. A tool description that contradicts the code (S)**
- **Where:** `lyric_tools.js:2548-2551` and ~3600.
- **Text:** "`wants` conditions the draw … the planned shape … can differ from the shape the sweep tested".
- **Backed:** contradicted. `make_plan` returns the seed's own plan when it already holds the wants. Checked on seeds 0, 3, 5 and 14.
- **Fix:** replace it with: "for a seed the sweep accepted under the same declarations, the plan is that seed's shape; `choices.seed_redraw` appears only when the draw was conditioned".
- **Verify:** a `test_plan` case: every sweep-accepted seed plans identically with and without the wants.

**C4. The grade's next-step sentence (M)**
- **Where:** `lyric_tools.js:2486` (`gradeNext`).
- **Text:** "…Add new_run: true if a revise run is still open…"
- **Backed:** the server already knows whether a run is open.
- **Fix:** in a session, set `verdict.next` from `nextCreationCall` (the same idea as B9). Keep `gradeNext` for raw only, without the "if" clause.
- **Verify:** a session test where a grade with an open run has `new_run: true` in `next`, and one without an open run does not.

**C5. Presentation instructions in results (S)**
- **Where:**
  - `lyric_workflow.js:~555`: "When you present the song, say which of the first plan's declarations it no longer answers to";
  - `coverage_advice.js:~104`: "…present the song as uncertified and say which question went unjudged";
  - `engine.js:629`, 644, 663, 673 and 693: "Do not claim they survived";
  - AGENTS.md: "Neither may be reported as a part that survived".
- **Backed:** the facts are data (`plan_lineage`, `certified`, `blocking`, the warning codes). The instructions can't be checked.
- **Fix:** keep the data and end each message at the fact.
- **Verify:** `grep -rn "When you present the song\|Do not claim\|present the song as" mcp/` returns nothing.

**C6. A stale pointer (S)**
- **Where:** `lyric_tools.js:351` (`EXIT_MEANING[3]`).
- **Text:** "the report names the lines".
- **Problem:** the session view leaves out `report`, so the lines are actually in `blocking`.
- **Fix:** "`blocking` (or the report) names the lines".

**C7. The seeded-recipe `guidance` (S)**
- **Where:** `engine.js:700`.
- **Text:** "if the user gave any stylistic words, edit before presenting … Batch edits in one edit_recipe call".
- **Backed:** no.
- **Fix:** keep one copy of the intent-to-edit map, here, because it arrives at the moment of decision. Delete the duplicates in AGENTS.md, llms.txt and the server instructions. Drop "Batch edits in one call".
- **Verify:** `grep -n "Batch edits in one" mcp/engine.js llms.txt AGENTS.md` gives at most one hit.

**C8. The no-predicate sweep note (S)**
- **Where:** `lyric_harness.py:12452`.
- **Text:** "…honest and useless…"
- **Fix:** shorten it to the fact.

**Already backed (no change):**
- the CREATION_* refusals;
- the attempt notes;
- the CONTINUE notes;
- the environment warnings' advice (`check_env_advice.mjs` proves "repeat without card" works);
- the NEXT_STEP refusals;
- `verdict_view.js`;
- the "WHAT THE GRADER ENFORCES" rules.

---

## D. Agent guides in the repository

**D1. The plugin lyrics guide contradicts the server (S)**
- **Where:** `plugins/codex-musica/skills/lyric-workflows/SKILL.md:28`.
- **Text:** "If a run has stopped with open lines … grade the complete rewritten draft … then call lyric_revise with that exact draft and `new_run: true`."
- **Problem:** the server's own CONTINUE line (`lyric_tools.js:3497`) says to continue the same run with `run_id`, `run_revision` and `draft_text`.
- **Fix:** replace the paragraph with "follow the stop's CONTINUE/NEXT line".
- **Verify:** `grep -n "new_run: true"` in that file finds only the interrupted-operation case.

**D2. SKILL.md invents limits the engine doesn't have (S)**
- **Where:** `SKILL.md` §6.4-6.5 (~852-856) and §9.5 (~1213-1219).
- **Text:** "mixing tunings from different families is a hard flag unless intentional" / "flag obvious anachronisms" / "a 1949 song must not contain '1980s'".
- **Problem:** this contradicts AGENTS.md ("There are no coherence fences") and the engine, which accepts any valid combination.
- **Fix:** delete these as rules.
- **Verify:** `grep -n "hard flag\|must not contain" SKILL.md` returns nothing.

**D3. A validation rule that exists only in the docs (L)**
- **Where:** `SKILL.md:42`, §6 and its inline validator snippet (~862-895).
- **Text:** "MUST pass §6 before you return it".
- **Backed:** no. `scripts/validate.js` checks the catalog, not an arrangement. The connector already refuses bad ids.
- **Fix:** either drop the doc-only validator and the "MUST", which is the smaller option, or move it into `scripts/validate.js` behind a flag.
- **Verify:** the rule is gone, or `node scripts/validate.js --arrangement bad.json` exits 1.

**D4. A wrong claim (S)**
- **Where:** `SKILL.md` §9.4c (~1187).
- **Text:** "The engine is PERMISSIVE — it never validates your ids".
- **Problem:** this is true only of the raw `compileRecipeStack`. The connector and CLI refuse bad ids.
- **Fix:** name the layer it applies to.

**D5. Doc copies of rules the code teaches (S)**
- AGENTS.md ~95-97: "carry the sweep's declarations unchanged". The gate refuses and NEXT carries them. Delete it.
- AGENTS.md ~185: "Batch a set_preface first if you want to steer the cascade". `changed` shows the cascade. Delete it.
- AGENTS.md ~212-238: the intent table, the worked exchange and "One search per user-word, one batched edit call, done". Keep one copy (see C7) and delete these.
- `mcp/README.md:330`: duplicates a CREATION_GRADE rule. Delete it.
- **Verify:** `grep -c "One search per user-word" AGENTS.md llms.txt` gives 0.

---

## Not covered by this pass
- `floor.py` and `fit.py` finding messages beyond the codes named above.
- `grid.py` evidence strings beyond the four named.
- The `lyric_check`, `lyric_recover` and `lyric_verify` report text.
- `docs/connector.md`, `LYRICS_RUNTIME.md` and `HANDBOOK.md` (the first audit pass listed their example text).
- No live deployment was fetched.
- `HOOK_CONFINED` firing on a brief-compliant draft (A4) was read from the code, not run.

The probe scripts and rendered briefs behind this list were scratch files and are not committed.

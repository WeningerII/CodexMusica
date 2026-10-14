# Reader batch, commit 1: CI parity, held pins and slot binding (2026-10-14)

Evidence for the head that carries the slot-binding repair: code commit
`58de181633f44195da3d78ce4a2736fb57e0ea32` on top of `678898511`, the last pushed head of
`claude/reader-batch-2026-10-13`. This file's own commit adds this file and
nothing else.

**The verified tree is not the pushed tree.** `678898511` is pushed, and its
CI run is the one cited below. When this section was written the repair
commit and this file were local, with no GitHub CI run; they have since been
pushed (see "Push state"). Every result below that names the new head is
local, under the interpreter it states.

**Update, broad fix round.** Code commit
`643e292e6586d5aa5aea57e9ede231e360d5590d` (on top of `61b6618a`) addresses
BB8's F1, F4-F10 and A.2-six findings; see "Broad fix round" below. Every
section before it describes `58de1816`, unchanged.

**Update, contract-blocker round.** Code commits `3e77a5d97`, `82fe130e4` and
`0af39c6ff` (on top of `6955e342`) address 3PO's contract blockers (#519
6163216518) and the three items of #527 6163315071; see "Contract-blocker
round". Items those commits left open (returns annotations and Library
coverage, punctuated hyphen ends, F4 retention, F1 member mapping, the form and
Library cross-draft evidence blockers) are handled in the fourth pass ("Fourth pass" at the end).

**Push state.** Everything up to and including `43d32cdf` is pushed (CI run
38554634818; see "Fourth pass"). The fourth pass's commits and this file's
latest section are local, with no CI run.

## Baselines

- Harness baseline: `fce4bf0f`. Main's seven later commits touch no harness
  file.
- Page baseline: `8b1d2ad2` (main after #556).

## GitHub CI at 678898511

Run: https://github.com/WeningerII/CodexMusica/actions/runs/38503980117 (push,
head `67889851144dd2a7eefedd9960a868978fb7bfae`).

- 48 jobs: 42 success, 3 failed, 3 skipped. The failed jobs are `record`,
  `suites (shard 2/3)` and `suites-result`. The skipped jobs are `tandem`,
  `mutation` and `nightly`.
- Shard 2 lists one failing suite, `quality/test_comparator_pin.py`. Nothing
  else is hidden behind it.
- The three failures are the held pins listed next, and nothing else.

## Held pins, not applied on this branch

Each pin below is held at its accepted value. The re-pin proposals live on the
separate local branch `claude/reader-batch-2026-10-13-repins`. They are
owner-gated: each needs John's explicit approval of an old/new-value proposal
with reasons. They are never applied to this branch, so these checks are
expected to be red here.

1. **Comparator fingerprint.** The pin is unchanged and the measured value has
   MOVED (input: the `lyric_harness.py` closure). This is the agreed explicit
   qualification exception until closure. "Qualification against the existing
   comparator" (pin unchanged, MOVED) is kept separate from any proposed
   re-pin. A proposal states only old/new fingerprints and the reason.
   Failing checks: the comparator pin in `record`, and
   `quality/test_comparator_pin.py` in suites shard 2. Locally (`quality/check_comparator_pin.py`,
   3.11.17): pin `9d5d8146…0df8`, measured `515cac8d…5e42b`, 1 of 7 inputs
   moved (the `lyric_harness.py` closure). The measured value is the same on
   the 678898511 tree and on this head: `quality/loop.py` and
   `quality/revise.py` lie outside the pinned closure, so the repair does not
   move the comparator further.
2. **search_null, sonnet bucket**, per the documented `per_k.py` method:
   k=3-4 813 -> 808, k=5-8 208 -> 207 (all pairs 1108 -> 1102).
   `theta_rhyme` 0.75 against the historical crossover 0.72 is not fresh
   qualification. The song-corpus rows of the 2026-09-18 record are
   **UNREMEASURED**. No banked command exists for them, `--check` does not
   re-derive them, and neither a passing `--check` nor the sonnet
   reproduction qualifies them.
3. **audit_corpus NOTE** 1856 -> 1861. The five added NOTEs are all CHECK L:
   footnote markers that v2 now reads as numeral tokens. None was removed or
   changed.
4. **counters, public-symbol row.** The committed row is 1719. CI measured
   1739 at 67889851. Locally at this head (`quality/counters.py --check`,
   3.11.17), the measured row is **1739** (434 production-referenced, 511
   tests-only, 655 self-only, 4 nowhere, 135 refused: 86 ambiguous, 38
   dynamic, 11 shadowed). That is identical to 67889851, because this round
   adds no public symbol. It adds three private helpers (`_lex_line`,
   `_end_occurrence_bound`, `_bound_index`) and one private constant
   (`_RESOLVE`) in `quality/loop.py`, and `quality.loop.swap_at_slot` stays
   outside the declared population (omitted by `loop.__all__`). It is the only
   failing row.

## WarmWorker

At 67889851 in CI (shard 3, CPython 3.11.16), `test_reader` ran 69 tests OK
with 3 skips. That was ONE whole-file invocation. Three warm-worker cases are
deliberately isolated into subprocesses, so not every case shares a process.
Their peaks were 575, 633 and 575 MiB, under the unchanged 1024 MiB guard.

This is test-process isolation. It is not a runtime resource fix, and it
claims no long-lived runtime capacity bound. In the dual-scheme measurement
(`warm_worker_rss_2026-10-13/README.md`, local 3.11.17), one process held
the v1 and v2 lexicons and a Library analysis. It peaked at 539,365,376
bytes, 50.2% of the guard. No guard was raised.

## Exit-2 cohort

HOLDS 1 / MOVED 0 / CANNOT RUN 2. `audit_tang_null` and
`run_positive_control` are CANNOT-TELL. They are not passing evidence.

## Gate: library.test_unit_manifest

8 tests passed in CI. That is a non-reproduction of the local failure. It
does NOT establish the failure's cause.

## Legacy resumes

Legacy resumes are not claimed to be preserved byte for byte. Precisely: the
deferred replay test invalidates pre-batch cursors after scorer-identity drift
and replays from round 1. It compares the result with the historical replay
of the same state with the cursor removed, excluding the scheme and cursor
fields. It explicitly differs from the historical trusted-cursor resume.
Call-checkpoint equality is a separate, narrower assertion.

## Library saved-choice routes

Acceptance: in `Oh--oh, oh my love`, token 2 `oh` binds chars 8-10, as on
fce4bf0f, or refuses visibly. It never binds 4-6.

| route | behaviour | pinned by |
|---|---|---|
| 1. Device store re-sent on a new analysis | Unmarked records are rebound once by raw span, written back marked `token_cut: "v2"`, and the originals are kept. A row no word covers exactly, or a row in a record with an unknown mark, is set aside, never sent, and blocks analysis. | `scripts/test_library_declarations.js`: "an unmarked choice is rebound to the same characters, with a notice (R3 repro)", "a line whose cut did not change binds byte-identically", "a choice no current word covers exactly is set aside, never sent", "a record marked with the current cut is left untouched", "an unknown cut mark refuses, naming the accepted value", "the rebinding is written back once, marked, and survives a reload". Also `scripts/check_library_page.js`, declarations section. |
| 2. Server job queued or paused across the release | The scheduler's identity recheck refuses it `STALE_READING`. It never runs, and its stored request and identity are not rewritten. | `mcp/test_reader_client.mjs`: "a job queued across the word-cut release is refused, never run, never rewritten" |
| 3. In-page whole-reading handoff to Lyrics | The handoff carries only the current cut's rows. Imported choices are source history and never reach the grader. | `scripts/test_library_declarations.js`: "the Lyrics handoff carries the current cut's rows only (route 3)". `scripts/test_library_import.js`: "Lyrics activation preserves the old private continuation without aborting it or inheriting its certification" |
| 4. Downloaded import bundle (pre-release, imported post-release) | The bundle is kept verbatim, because the digest covers it, and is never rewritten. Its choices bind no word in Lyrics and are never sent to the grader. | `scripts/test_library_import.js`: same test as route 3 |
| `declaration_hash` | A new job made from rebound choices gets a different hash, as expected. The stored hash of a pre-batch job is not rewritten. | `mcp/test_reader_client.mjs`: same test as route 2 |

## Slot binding: the reviser edits the grader-bound occurrence, or refuses

**The defect.** BB8 found it (#519 6160491240 and 6160589340; receipts on
`bb8/shape-sweep-2026-10-13`, folder `acceptance_2026-10-13/`). Under v2,
`quality/loop.py swap_at_slot` spliced the literal first, last or n-th reader
token. The grader's `slots.resolve` skips an unreadable token (a numeral, a
dash fragment, an unread word) to the nearest readable word. v1's refusal
guard had been dropped in the v2 branch with nothing in its place.

**The repair**, per the contract (#519 6160940820) as reviewed by 3PO
(6160977437). It touches only reviser selection and mapping, its call
plumbing and its tests. No shared reader or grader semantics changed.

- Under v2, a non-default slot (`head`, `headrime`, `endword`, `T<n>`) replaces
  exactly the reader token whose `widx` `slots.resolve(lex, text, slot)` puts on
  the syllables it binds. `lex` is the grading lexicon, with its scheme, aside
  rule, declared readings and `for_line`/`for_token` context. The token is
  spliced through its raw pieces, which are half-open codepoint offsets into
  the original line.
  - Occurrence identity is the `widx`, never the spelling.
  - `T<n>` keeps its index and refuses an unreadable target. It is never
    compacted onto a neighbour.
  - The swap refuses on any of these: no anchors; a syllable with no `widx` or
    with the wrong spelling; readings on more than one token; an index outside
    the line; the `line` locus; a span holding non-word material; a re-read
    splice that fused onto a neighbour.
  - `lex` is required under v2. Without it, no binding is known and the helper
    refuses. A `scheme` or `strip_parens` that conflicts with `lex` also refuses.
- The default end keeps `swap_end_word` and its protections. Given `lex`, it
  also checks the ENDPOINT occurrence. Every reading's last syllable must carry
  the last token's `widx` and spelling. Where nothing is bound,
  `line_anchors`' own named endpoint must be the token being replaced.
- `Reviser._splice`/`_anchors_at` and the stock line and group stubs (bound in
  `revise_loop`) now pass the reviser's own `lex`.
- v1 is unchanged. The pre-batch body still runs, including its refusal guard,
  and `lex` is not read.

### BB8's acceptance tool, run on this head

`sb_dump.py` and `join.py` (folder `slot_match_67889851/` at `12a8ebb3`) were
run on the documented 3,990-line `population.txt`. The interpreter was
`/dev/shm/py311` (CPython 3.11.17; CI pins 3.11.16). The base was `fce4bf0f`,
exported with `git archive` under `/dev/shm`. Cases: 95,760 (3,990 lines x 12
slots x 2 aside modes, under base, candidate v2 and candidate v1).

Two disclosed deltas, both mechanical:

- `sb_dump.py` loads `slot_binding.py` from a hard-coded
  `/home/user/CodexMusica/...` path that does not exist on this machine. The
  path was changed to the exported copy. Run unchanged otherwise, the base dump
  reproduces BB8's committed `fce4bf0f.jsonl.gz` **byte for byte**.
- The tool replicates production's `swap_at_slot` keywords only within
  `{scheme, strip_parens}`. Production now also passes `lex=` (the grading
  lexicon). With the tool literally unchanged, it therefore calls
  `swap_at_slot(text, slot, word)` with no keywords. Every v2 non-default slot
  then refuses for want of a lexicon, and its "v1" modes run under the process
  scheme. That run was made and is not a measurement of production.
- The measured run adds `lex` to the replicated set, passing the tool's own
  grading lexicon, exactly as it passes that lexicon's scheme and aside rule.
  In `slot_binding.py` that is one line (`REPLICATED_KEYWORDS`) plus two lines
  in `_swap_kw`.
- With that delta, the gate reports `production_uses_not_replicated: 0`.

`join.py` (base `fce4bf0f` against this head):

| | count |
|---|---:|
| cases | 95,760 |
| v1 vs base: identical | 92,436 (540 joint exclusions + 91,896 base-measurable) |
| v1 vs base: different | 3,324, all base `excluded_transformed`, now measured (2,315 refused, 654 no_word_refused, 182 agree, 123 refused_unbound, 42 refused_grader_elsewhere, 8 agree_unbound), as at 67889851 |
| v1 records, this head vs 67889851 | 0 of 95,265 differ |
| v2 `grader_elsewhere` | **0** (989 at 67889851: 138 base-agreed, 42 base-excluded, 113 base-refused, 10 same-kind-other-words, 686 unchanged) |
| v2 tool `wrong_word` | 989: the same 989 cases, now edited at the bound word (see below) |
| v1 failures (unchanged, as on base) | 696 grader_elsewhere, 5 wrong_word, 4 resolver_mismatch |

**Why the tool reports 989 `wrong_word`.** The tool's `named` is the literal
first, last or n-th token, and it classifies any edit other than `named` as
`wrong_word`. Under the contract, these 989 cases now edit the word the
grader binds, which is not the literal token.

**Span-level check.** `span_check.py` reuses the tool's `_spans`, `_bound`
and `_edited` unchanged and compares raw offsets, not text. Over the same
population, in both aside modes:

- Every v2 edit lands on the grader-bound span.
- 0 edits land elsewhere.
- 0 no-op edits.
- 0 edits on a binding the oracle cannot place.

**The 67889851 cohort** (989 v2 `grader_elsewhere` cases): **REPAIRED 989 /
REFUSED 0 / NO-OP 0.** Here REPAIRED means the edited span equals the bound
span by offsets.

**Every other v2 change against 67889851** goes from `agree_unbound` to
`refused_unbound`, where the grader binds nothing and the reviser now refuses.
There are 2,342 such cases:

| slot | cases |
|---|---:|
| `T<n>` | 2,292 |
| `headrime` | 26 |
| `head` | 12 |
| `endword` | 12 |

Nothing else under v2 moved. The default `end` slot did not change on any
case.

**The gate** (`slot_binding.py` main, aside-line selection of 1,056 lines,
same lex delta):

- Controls: 0 failed. All 12 agree in all four modes.
- Negative controls: 0 failed. Both `first_occurrence` rigs come out
  `grader_elsewhere`, and both `mixed_tags` rigs come out
  `resolver_mismatch`. The loop binds `slots.resolve` at import, so a rig that
  replaces it afterwards still simulates a disagreeing grader.
- Coverage: 0 unexpected exclusions.
- Verdict: FAIL, on the same `wrong_word` reading. v2 has 66 (stripped) and
  231 (sung) such cases, every one an edit of the bound span. The v1 failures
  are unchanged: 35 grader_elsewhere and 5 wrong_word stripped, 35
  grader_elsewhere sung, and 1 resolver_mismatch in each mode.

**Residual, itemised.** The default end still edits its endpoint where the
grader binds no syllable but `line_anchors` names that endpoint once its
`actual_last` guard holds. This is the tool's `agree_unbound` for `end`: 191
cases per mode, the same as at 67889851. They split as 181 unread words
(`Exmoor`, `Quean`, `Cuckolds`, `upon't`, ...), 7 numerals (`10`, `45`, `2`,
`20`, ...) and 3 hyphenated words (`a-heavèn`, ...). This keeps the reviser's
repair of an unreadable end word by replacement. 3PO's review kept the
non-default one-token rule off the default end. Refusing these too is a
one-line change, if BB8 or 3PO rule so.

**Equality target.** The 92,436 identical diagnostic signatures include 540
joint exclusions, and 91,896 are base-measurable. This string-signature gate
does not establish raw-span identity or end-to-end replay.

### Tests (each fails when the repair is reverted)

`quality/test_reader.py` `SlotBinding` adds 14 tests. One is a v1
preservation guard, which passes on revert by design.

- **Cohort cases:**
  - numeral head, `(1) An' teäke ...`, sung and stripped;
  - margin numeral endword, `... deed, _110`, together with the default end on
    that line;
  - dash head, `Meinself--und Gott.`;
  - the base-refused aside endword, `"Abraham, forbear, (the angel cry'd)`;
  - the cases that were already wrong (`O'er the parchment ...` head,
    `... his sight o’erwhelm,)` endword).
- **Slots and occurrences:**
  - T1/T2 after a numeral;
  - repeated words, checked by exact offsets, with a rigged grader followed
    by `widx`, plus a negative control in which the oracle catches a
    wrong-occurrence edit of the same spelling;
  - both aside modes, NFD normalisation (raw offsets [0, 5)) and a disjoint
    enclitic token.
- **Grading context:** the reviser's own declared pronunciation context
  decides the occurrence.
- **Refusals:** empty, unread and unplaceable bindings (two tokens, untagged,
  respelled, out of range, unsupported, the `line` locus).
- **Default end:** multi-word default-end anchors with an endpoint check;
  delegation to `swap_end_word` carrying `lex`.
- **Paths:**
  - the direct helper, the line stub and the group stub, with and without
    `lex`, including conflicting coordinates;
  - v1 unchanged for any `lex`.
- **Property:** a corpus property test over 1,200 lines in both aside modes.

Behavioural revert: the old v2 splice bodies, accepting `lex` and ignoring
it. Result: 13 of the 14 fail. So do 2 of the updated `LoopSwaps` tests (the
stub carries `lex`; `(oh) zzzqx world` T2 now refuses). Three existing
`LoopSwaps` tests and five test call sites in `test_revise.py` and
`test_production_revision.py` now pass the grading lexicon.

## Local suites at this head

Interpreter: `/dev/shm/py311/bin/python`, CPython 3.11.17, built from
`/usr/bin/python3.11` with `mcp/requirements-runtime.txt` installed by hash,
plus numpy, nltk and PyYAML. CI pins 3.11.16, so these are not CI results.

Tree: `58de1816` (the code commit; this file adds nothing a suite reads).

| suite | command | result |
|---|---|---|
| revision-loop job, shards 1-4 | `TEST_REVISE_SHARD`/`TEST_LOOP_SHARD`/`TEST_LOOP_REDESIGN_SHARD`=k/4, the three suites at once (ci.yml `revision-loop`) | 12 of 12 rc=0: test_revise 457/475/195/205 s, test_loop 201/239/195/131 s, test_loop_redesign 920/526/242/293 s |
| test_reader | `python3 quality/test_reader.py` (one process) | 83 tests OK, 3 skips (69 + 14 new). Isolated warm-worker children 570/628/568 MiB under the unchanged 1024 MiB guard (1,692 guard checks each) |
| test_verbs | `TEST_VERBS_SHARD=k/4 python3 quality/test_verbs.py` | 4 of 4 rc=0 (637/954/525/960 s). One earlier 4/4 run was stopped and re-run because the working tree was briefly swapped while it ran; that run is not counted |
| test_production_revision | `python3 quality/test_production_revision.py` | 44 tests OK |
| test_mutation | `python3 quality/test_mutation.py --static` | rc=0, every anchor still applies (the sweep was not run) |
| mutate | `python3 quality/mutate.py --dry-run` | 59/59 mutations apply cleanly |
| test_mut_oracle | `python3 quality/test_mut_oracle.py` | rc=0 |
| lyric map | `python3 map/build.py`, then `--check` | regenerated (`map/files.md`: loop.py 46k -> 48k), then current |
| comparator pin | `python3 quality/check_comparator_pin.py` | MOVED, held (above), as expected |
| counters | `python3 quality/counters.py --check` | FAIL on the public-symbol row only, held (above), as expected |

Not re-run locally: `search_null --check` and `audit_corpus --verify-shape`
(their held failures are cited from CI at 678898511), and the JS and page
suites (this round touches no JS or page file).

## Broad fix round (BB8 #519 6161601064, 3PO triage 6161637870 and limits 6161683534)

Code commit `643e292e6586d5aa5aea57e9ede231e360d5590d`, on top of `61b6618a`. When this section
was written it had no CI run; it has since been pushed (see "Push state" at
the top). Interpreter for every Python result
here: `/dev/shm/py311/bin/python`, CPython 3.11.17 (CI pins 3.11.16). The page
baseline stays `8b1d2ad2`. `codex.html` was rebuilt with
`node scripts/build_html.js --out=codex.html`, and `library/code/` was then
restored (generations.json included). `npm run check:fresh` passes on the
result.

| item | what changed | test that fails when it is reverted |
|---|---|---|
| F1 | The migration of unmarked saved word numbers runs only at a boundary: open (session restored at start, saved session loaded or copied, session file imported, page mounted), import (.txt, Library working copy) and send. It never runs from the 120 ms typing refresh. No Undo step of its own: the open or import step holds the migrated text, and at an in-page boundary the writer's text is recorded first and the migrated text replaces that same step. Undo and Redo never run it. The selection (start, end, direction) is mapped onto the same characters. | Browser 9d. Putting the migration back into `lyRefresh` fails 6 assertions, including the exact typed text, the caret position, and the BB8 worst case (`--oh my` typed after "dove" with an unmarked row last). Unit B §1-3 cover history and selection: reverting the record-first step fails 2; dropping the selection mapping fails 1. |
| F4 | A Review card lists every renumbered number ("the reading for “oh”, line 1: word 2 → 3") until dismissed. It is kept in `app.lyricMeta.ui.renumbered`, bounded under the 4,000-character display-state limit with the overflow counted. It survives a later import and a reload. | Unit B §4 (4 assertions fail with the card removed); browser 9d (a .txt import, the toast overwritten, a reload, Dismiss, then a Library working-copy import). |
| F5 | "Remove the link" no longer says "saved before this release". It names the reason: a number read under the earlier cut by compatibility policy, or a mark for a cut the page does not read (`cut v9`). | Unit B §5 (2 fail with the old wording). |
| F6 | Default kept to the existing Lyrics text contract (`lyCanonical`; the trade-off and the minimal marker-only exception are in the owner-decision note F6_MARKER_TRADEOFF.md, kept with the round's specs outside the repository): a row whose binding the migration does not change keeps every byte and gains no mark. A rewritten row respells only the members that changed and keeps the writer's spelling (`2.end` stays `2.end`). | Unit B §6 (2 fail when unchanged readings are marked); unit P plus B §6 (5 fail when unchanged group rows are rewritten). |
| F7 | `quality/slots.py` `placement_word` docstring: `head` and `T1` are filed under word 1 but bind different words when the first token is unreadable (`4ever we go home`: `head` binds `we`, `T1` binds nothing; verified by `slots.resolve`). Doc only. | none (doc) |
| F8 | `quality/loop.py` `swap_at_slot` and `swap_end_word` docstrings: the v1 default end slot splices into an echo aside (`my love (my love)` becomes `my love (my dove)`). Only non-default v1 slots refuse every line whose aside holds a word. Doc only, verified by running both. | none (doc) |
| F9 | WarmWorker children only READ the caches between requests (`_caches_hold_their_schemes`, which builds nothing). The priming `_caches_agree` runs only after a scenario's last request. Three cold scenarios were added: a v1 lyrics request then a v2 one (asserting no v2 lexicon is cached before it), Library then v2 lyrics, and Library then v1 lyrics. | Putting `_caches_agree()` back after the first request makes the cold v1-to-v2 child fail ("v2 was primed before its first request"). |
| F10 | The parent asserts each child's VmHWM is below the unchanged 1 GiB guard (`assert_within_guard`). Wording: the per-scheme caches are bounded by the two schemes, not growing per request. | `test_the_peak_assertion_refuses_a_peak_at_the_guard` (a peak at the guard fails). |
| A.2-six | Diagnosed: v1 `line_anchors` re-cut the words before the last from their space-joined text, which joined an enclitic set apart by punctuation (`knap, 's` became `knap's`; `M.P.'s` became `P's`, P IY1 Z). v2 reads `'s` alone. The cut is identical; the lookup words differ. `lyLineCutChanged` now also fires when v1's lookup words (`CMLyricTokens.v1GraderLookup`) differ from an identical cut. This is a general condition, not a list. | Unit B §7: removing the lookup clause fails 15. The page scan of 271,092 identical-cut corpus lines fires on exactly the receipt's 24 lines. `quality/test_reader.py` `NamedPlaceLookup` checks the cause with the harness's own functions. |

Receipt for A.2-six: `quality/results/named_place_lookup_2026-10-14/`.
- On the English song corpus (281,399 sung lines; 271,092 with an identical cut), 8 Latin-script lines change their END binding, and the condition names all 8. BB8 counted six on a slightly different population (about 270,861 lines). The three lines BB8 quoted are among the 8.
- The condition fires on 24 lines: the 8, plus 16 where the lookup differs but the end anchor does not reach the joined word. Those 16 keep their END binding, which `NamedPlaceLookup` asserts.
- It fires on none of the other 271,068 identical-cut lines.
- 7 polytonic Greek lines differ only in the end label's NFC form, with nothing bound under either scheme. They are listed apart, not counted as binding changes.

Pre-existing items, labelled in `mcp/LYRICS_RUNTIME.md` and not fixed:
- the impossible Resume on a `STALE_READING` Library job;
- the v1 echo-aside wrong edit kept byte-identical in v1 replay;
- `sites/library` posting device declarations unmigrated.

F2 and F3 await the owner's scope decision and were not touched.

### Local results at `643e292e6586d5aa5aea57e9ede231e360d5590d`

| suite | result |
|---|---|
| `node scripts/check_lyrics_page.js` (unit + browser) | PASS, 529 assertions (333 unit, the rest browser, including the new step 9d) |
| `quality/test_reader.py`, one process | 93 tests OK, 6 skips (the six child bodies, each run by its parent). Child peaks (VmHWM) under the unchanged 1024 MiB guard: 455 / 538 / 457 MiB for the three existing scenarios, 536 / 470 / 470 MiB for the cold ones. These are lower than at 58de1816 (570/628/568) because the children no longer prime both schemes after every step. |
| `scripts/check_library_page.js` | PASS, 270/270. A first run concurrent with `test_reader` gave 269/270 ("collection page renders — 0 rows"); it was re-run alone twice and passed both times. Recorded as a load flake, not a pass of the first run. |
| `scripts/test_library_import.js`, `test_library_declarations.js`, `test_lyric_tokens.js`, `test_library_chunk_generations.js` | 15, 8, 5 and 6 tests pass, 0 fail |
| `test_library_import_browser.js`, `test_library_import_shipped.js`, `check_layout_usability.js` | All pass (1 test; SHIPPED LIBRARY IMPORT PASS; layout usability PASS at every width). Run with a scratch preload that points Playwright at the preinstalled Chromium 1194. The pinned headless shell 1223 is not installed here, and without the preload these fail to launch. This is an environment limit; the repo was not changed for it. |
| `check_workbench.js`, `check_ui_foundation.js`, `check_lazy_app.js`, `check_library_shell.js` | All PASS (workbench integration, UI foundation 252 assertions, LAZY-APP parity, LIBRARY SHELL) |
| `npm run check:fresh`, `test:minified`, `check:budget` | All PASS (check:fresh: api/, codex.html and the other published files are byte-identical to a fresh build; minified equivalence across 7755 traditions; 13 budgets hold) |
| `npm run lint`, `npm run format:check`, `scripts/check_doc_paths.js` | All PASS |
| `map/build.py`, then `--check` | regenerated, then current |
| `quality/test_mutation.py --static`, `quality/mutate.py --dry-run` | rc=0; 59/59 apply |
| `quality/check_comparator_pin.py` | MOVED, held: pin `9d5d8146…`, measured `515cac8d…`, unchanged from 678898511. slots.py and loop.py are outside the pinned closure. |
| `quality/counters.py --check` | FAIL on the public-symbol row only, held: measured **1739**, the same as at 67889851, so the row did not move this round. The receipt script's helpers are private; while they were public they moved it to 1743 (self-only 655 -> 659). |

Not re-run at `643e292e`, with the reason for each:

- `search_null --check` and `audit_corpus --verify-shape`: their held failures are cited from CI 38503980117.
- The revision-loop job, `test_verbs` and `test_production_revision`: the only harness code changed is two docstrings (`quality/slots.py`, `quality/loop.py`). The comparator closure fingerprint is unchanged, and `quality/test_mutation.py --static` still applies every anchor.

## Contract-blocker round (3PO #519 6163216518; #527 6163315071)

Code commits, on top of `6955e342` (pushed since, with `43d32cdf`; see "Push
state" at the top):

- `3e77a5d97` — default end: zero bound syllables refuse (item 1);
- `82fe130e4` — Lyrics: an explicit `N.end` and a bare `N` keep their
  identity (item 2);
- `0af39c6ff` — the declared relation reads the word broken at the line
  end; a present-`null` scheme is refused; bare-word variants are normalised
  (items 3-5).

Interpreter for every Python result in this section: `/dev/shm/py311/bin/python`,
CPython 3.11.17 (CI pins 3.11.16). Each behaviour change has a test that fails
when the change is reverted; the revert results are given per item.

| item | what changed | test that fails when it is reverted |
|---|---|---|
| 1. default end, zero binding | Under v2, `quality/loop.py` `_end_occurrence_bound` refuses where `slots.resolve` binds ZERO syllables on the line's end (an unread word, a numeral, a hyphenated word without a whole reading). Before, it accepted `line_anchors`' endpoint label there. Readable ends, multi-word anchors included, splice exactly as before. v1 is untouched. Without a grading lexicon the direct helper keeps its protections-only behaviour; every production path passes the lexicon. | `quality/test_reader.py` `SlotBinding`, 15 tests: the new `test_a_default_end_binding_zero_syllables_refuses` (through `swap_end_word`, `swap_at_slot`, `default_propose`, `default_propose_group` and `Reviser._splice`, both aside modes, with readable controls); `test_a_trailing_margin_numeral` now requires the refusal (it permitted the edit); `test_the_default_end_checks_its_endpoint_occurrence` lost its permitted unread-end edit and gained a rigged zero binding whose label names the replaced token; the corpus property `test_every_v2_edit_lands_on_the_bound_token` now covers the default end. Reverting `loop.py` fails 4 of the 15. |
| 2. `N.end` vs bare `N` | `lyParseGroups` records, for every member shape, whether the place was written (`explicit`); `lyMemberSpelling` spells from that flag. `N.end` stays `N.end`, a bare `N` stays bare, and a member the page makes for the end is bare. `.end` is never added globally. This covers the row text, the wire (`lyDeclarationsOf`), Keep, the rhymes and repeats forms (`lySetSetup`), section reorder and assembly, and untouched sibling groups. At 61b6618a every end member was written bare. The broad fix (643e292e) had closed most paths by re-reading raw text; members of a row marked with an unknown cut still lost `.end` when a form merged the row, and Review named them bare. | `scripts/check_lyrics_page.js` unit E (13 assertions): a row mixing `2.end`, bare `4` and `1.T2` with untouched siblings, plus a returns row, through migration (carried members included), the wire, Keep, both forms, a section reorder, export/import, and an unknown-cut row merged by a form and re-read. Reverting the page to 643e292e fails 2; 61b6618a's page fails 8 before the import step, which that page lacks. |
| 3. declared broken / perfect rhyme on `king-` | Under v2 the registered relation reader (`relation_phonology_for` of a plain lexicon: fallback refused) read the canonical token `king-` as no word. `line_anchors` read `king`. `English.split_final_stem` names the printed part of a line-final broken word (v2 only), and `relations.build_stream` reads it through the same phonology and fallback policy. It does so only for the last token of a split line, only after the token itself read nothing, and never for a printed boundary. `2-` stays a refused numeral, `read('king-')` is still None, and there is no G2P or relation-engine change. | `Normalisation.test_a_declared_relation_reads_the_word_broken_at_the_line_end`: the production reader, 5 spellings × v1/v2 × declared broken/perfect, numeral and printed-boundary controls. `Normalisation.test_the_brief_verb_judges_the_declared_broken_word`: `brief` with declared broken, declared perfect and undeclared, under v2 and v1. Reverting the stream change fails the first test and both declared v2 `brief` runs. |
| 4. present-`null` scheme | `_record_scheme`: an absent field is v1, and a present value is returned as written. The deferred resume (checked first, before the state is touched), `tryline`'s pre-flight, the replay file and the kitchen checkpoint refuse a present value they do not read (`null` included) in one message. The checkpoint no longer advises `--reader-scheme=None`. | `LegacyReplay.test_a_present_null_scheme_is_malformed_not_pre_batch`; the files are byte-identical after each refusal. Reverting it fails: a null deferred state resumed. |
| 5. bare-word variants | Under v2, `Lexicon.pronunciation_variants` and `SupplementedLexicon.pronunciation_variants`/`reading_source` look a bare word up under `normalise_word`, as `transcribe_word` and line tokens already were. A row found that way is credited to its own source. Declared readings are matched on the spelling they name. v1 is unchanged. | `Normalisation.test_bare_word_variants_are_normalised_as_a_token_is`; reverting the Lexicon lookup, the supplement lookup or the provenance key each fails it. |

### Item 1: BB8's tool, re-run

Receipt: `quality/results/slot_default_end_zero_binding_2026-10-14/` (README,
`summary.json`, `changed_cases.json`).

- **Tool and inputs.** BB8's `slot_occurrence.py` 3.3 and `slot_binding.py`,
  from `bb8/shape-sweep-2026-10-13` at `9ae80be5`, on the documented 3,990-line
  population.
- **Run unmodified.** Version 3.3 replicates the `lex=` keyword itself, so the
  `sb_dump.py` lexicon delta and path change disclosed above are not needed
  here.
- **Trees.** `git archive` copies with the staged data copied in, so the
  tool's commit pins read null and the commits are named in the receipt.

| | `61b6618a` (reproduction) | `0af39c6f` |
|---|---:|---:|
| v2 gate | FAIL | **PASS** |
| v2 `edit_unbound` (stripped / sung) | 191 / 191 | **0 / 0** |
| v2 `refused_unbound` | 1,071 / 1,331 | 1,262 / 1,522 |
| v2 `occ_agree` | 33,591 / 39,143 | 33,591 / 39,143 (unchanged) |
| v2 `occ_wrong` / unplaceable / no-op | 0 | 0 |
| controls / readable controls / negative controls / v2 declared paths failed | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| v1 | pre-batch failures | identical, record for record |

- The `61b6618a` run reproduces BB8's committed outcome counts exactly.
- **Exactly 382 records change**, all v2 default `end`: 191 per mode go from
  `edit_unbound` to `refused_unbound`. That is REPAIRED 0 / REFUSED 191 /
  NO-OP 0 per mode.
- Per mode, those 191 split as 181 unread words, 7 numerals and 3 hyphenated
  words.
- All 6,052 readable v2 default-end `occ_agree` records have identical normalized serialized content,
  multi-word anchors included.
- No non-end record changed, so the 989-case cohort is as at `61b6618a`,
  where BB8 reproduced it as REPAIRED 989 (all `occ_agree`).
- The overall verdict is still FAIL, on v1 alone: 353/348 `occ_wrong` and
  1,099 `edit_unbound` per mode, 18 declared-path cases and 2 resolver
  mismatches per mode. That is unchanged pre-batch behaviour.
- The verdict per scheme reads v2 PASS.

### Item 3: corpus reach

On the English song corpus (281,069 lines), 18 lines end on a word broken by a
hyphen (`split_final`, not a printed boundary).

- 13 are now read in the relation stream: `Fears-`, `Yes-`, `modi-`,
  `anguish-`, `e-`, `im-`, `in-`, `them-`, `over-`, `Gentle-`, `turnpike-`,
  `red-` and `heart-`.
- 5 stay refused, because the stem has no reading: `roo-`, `rotundi-`,
  `brevi-`, `pati-`, `inden-`.
- BB8's 18 was a raw grep, not an affected-run count. The change touches
  only those lines' relation streams.

Verdicts, the five spellings (ASCII `-`, U+2010, U+2011, `-`U+00AD,
U+00AD`-`):

| | before (0af39c6f's parent) | after |
|---|---|---|
| v2 declared broken rhyme | None, all five | True, all five |
| v2 declared perfect rhyme | None, all five | True, all five |
| v1 declared broken rhyme | True (ASCII), False (other four) | unchanged |
| v1 declared perfect rhyme | True, all five | unchanged |
| v2, `2-` (numeral) | None | None |

- `brief` under v2 certifies all five pairs: declared broken, declared perfect
  and undeclared.
- `brief` under v1 certifies declared perfect and undeclared on all five, and
  declared broken on ASCII.
- `brief` under v1 was not run on the four non-ASCII broken-rhyme pairs, which
  read False. There `brief` runs its candidate search: 4,126 grade calls in 80
  s, unfinished. Those four are asserted in-process instead.
- Under v2 the supplemented relation reader now reads `king-` too, because the
  rule lives in the shared English stream. Under base and v1 it refused there,
  and v1 still does.

### Local results at `0af39c6ff`

| suite | result |
|---|---|
| Python suites (CI `suites` list, all 3 shards' 109 files, test_reader included, 3 at a time) | 108 rc=0; 1 failing, `quality/test_comparator_pin.py`, the held comparator exception (the same and only failing suite as CI shard 2 at 678898511) |
| `quality/test_reader.py`, one process | 98 tests OK, 6 skips (the six child bodies, each run by its parent; 93 + 5 new). Child peaks (VmHWM) under the unchanged 1024 MiB guard: 453 / 538 / 459 MiB for the three existing scenarios, 537 / 468 / 471 MiB for the cold ones |
| `quality/test_plan.py`, `quality/test_capacity.py` | rc=0, rc=0 |
| revision-loop job, shards 1-4 (`TEST_REVISE_SHARD`/`TEST_LOOP_SHARD`/`TEST_LOOP_REDESIGN_SHARD`=k/4) | 12 of 12 rc=0: test_revise 516/454/192/188 s, test_loop 220/228/186/116 s, test_loop_redesign 924/544/230/262 s |
| `quality/test_verbs.py`, `TEST_VERBS_SHARD`=k/8 (CI's eight shards) | 8 of 8 rc=0 (264/350/328/540/278/490/178/340 s) |
| `node scripts/check_lyrics_page.js` (unit + browser) | PASS, 542 assertions (346 unit, unit E's 13 among them) |
| `npm run lint`, `npm run format:check`, `npm run check:fresh`, `scripts/check_doc_paths.js` | All PASS. check:fresh: api/, codex.html and the other published files are byte-identical to a fresh build |
| `map/build.py --check` | current |
| `quality/test_mutation.py --static`, `quality/mutate.py --dry-run` | rc=0, every anchor applies; 59/59 (33 M, 26 Q) |
| `meter_bands --check`, `schema_end_reading --check`, `schema_window --check`, `door_census --check`, `chance_rate --check` | All PASS |
| `search_null --check`, `audit_corpus --verify-shape`, `check_comparator_pin.py`, `counters.py --check` | The held failures, exactly as listed below; nothing else moved |

### Held pins at this head

- **Comparator: MOVED, held**, the agreed exception, still 1 of 7 inputs (the
  `lyric_harness.py` closure). Pin `9d5d8146…`. The measured value is now
  `51316f79…` (it was `515cac8d…` at 58de1816 and 643e292e), because items 4
  and 5 edit `lyric_harness.py`. Nothing re-pins it.
- **search_null**: sonnet k=3-4 813 -> 808 and k=5-8 208 -> 207, the same held
  drift. Every theta row is `[ok]`.
- **audit_corpus**: NOTE 1856 -> 1861, the same held figure.
- **counters, public-symbol row**: committed 1719, measured **1739**, the same
  as at 67889851. This round adds no symbol to the declared population. The
  new helpers `_record_scheme` and `_malformed_scheme_message` are private, and
  `English.split_final_stem` is a method, which the row does not count.

No re-pin is applied on this branch. The proposals stay on
`claude/reader-batch-2026-10-13-repins`.

## Scope qualification (P8)

Accumulating `.txt` migration logs, making Dismiss permanent across every
history path, and preserving the browser's native Undo stack are not newly
promised-contract blockers. The implemented retention and application
history behavior below are evidence of those specific paths, not broader
new guarantees. The real Library cross-draft overwrite remains a blocker
covered by browser 9e: draft A's stored record and session must not receive
B's migration evidence.

An empty initial page mount does not establish lost startup migration:
`uiRestoreSession` restores startup content and runs its boundary migration.
That distinction is documentation only; no new empty-mount repair is claimed.

## Fourth pass (3PO #519 6164274432, 6165168676, 6166169619, 6166749777, 6167042191; #527 6164215811; BB8 66cef416)

Code commits, on top of `43d32cdf` (pushed), local and with no CI run:

- `34ecc6bcc` — Lyrics page: F4 retention, F1 member mapping, the form-writer
  blocker, the Library cross-draft evidence blocker, whole-line vs placed returns (items 1,
  2, 6, 7, 8, 9);
- `7c26d40c4` — harness: punctuated hyphen ends, the two slot-guard
  qualification tests, the WarmWorker wording (items 10, 4, 3).

Interpreter for every Python result in this section: `/dev/shm/py311/bin/python`,
CPython 3.11.17. CI pins 3.11.16, so these are local results, distinct from
CI and from an independent final-head qualification. The page baseline stays
`8b1d2ad2`, the harness baseline `fce4bf0f`. `codex.html` was rebuilt with
`node scripts/build_html.js --out=codex.html` and `library/code/` restored
(generations.json included); `npm run check:fresh` passes on the result.

| item | what changed | test that fails when it is reverted |
|---|---|---|
| 1. F4 retention | The renumbering record keeps every entry whole (no 40-character word cut, no four-line cap, no eviction) in its own page-context field, `app.lyricMeta.renumbered`, which `src/app.js` `lyricMetaOf` keeps whole. The card shows the first 20 entries; "Show all N" lists every one; Dismiss is the only removal. A record from the 6955e342 page (`ui.renumbered` with an evicted count) is carried over and its count still said. This supersedes the F4 row of "Broad fix round" (the 3,200-character bound with eviction). | Unit B §4 (replaces the test that approved eviction): one import moving 501 numbers, the 45-character word and all six lines of a reading listed after Show all, the shipped `lyricMetaOf`/`lyricMetaHistory` keeping all 501. Reverting the paging and the word cut fails 2. |
| Library-card qualification (#527 6164215811) | Stated in `mcp/LYRICS_RUNTIME.md` and the page comment: the record belongs to its draft. Importing ANOTHER draft (a Library working copy, a saved draft reopened) shows that draft's record; the earlier draft's record stays with that draft (Undo, reopening it) and is never carried into or saved under the other. A `.txt` import replaces the same draft's text, so its entries join the same list. No claim that evidence survives a later import of another draft. | Browser 9e (below). |
| 2. F1 member mapping | `lyMapOffset` aligns a rewritten row unit by unit (separators `;` `,` ` — ` `]`, longest common subsequence); a character in a unit present in both spellings maps onto itself; a selection's start follows the character after it, its end the character before. | Unit B §1b: the unchanged `2.end` in `[SETUP — returns — 1.T2, 2.end]` -> `… 1.T3, 2.end — cut v2]` keeps [25,30] (it became [39,39]); every caret inside it; the changed member's selection is exactly `1.T3`; a multi-member row (two renumbered, one carried, three unchanged). Restoring the one-prefix/one-suffix mapping fails 14. |
| 6. Form writers (BLOCKER) | Every rhyme groups / returns form writer (Link endings, Remove link, a placed return, Declare exact repeat, removing links that bind no word, Keep / Remove on a carried member) reads the rows of its key through `lyFormBase`: unmarked rows rebound by span or kept undecided and named places carried, exactly as the boundary migration does, BEFORE the row is written back marked. The renumbering is recorded on the card and said in the form's own message. The typing refresh still never rewrites the draft. Remaining, disclosed: before any boundary or form, the Rhymes and Repeats display still shows an unmarked row under the current cut (display only). | Unit O: six writer/row-type pairs; form-then-send and send-then-form give the same final text and `1.T5` (`love`), and the harness's placed-return verdict on the payload (`1.T5,8.T2` on `And love above`) is the same in both orders. Removing the policy pass fails 25. |
| 7. Library cross-draft evidence overwrite (BLOCKER) | The record is tied to its draftId and is part of each history step (`lyricMetaHistory`); `_restoreSnapshot` restores the step's record instead of keeping the live one; `lyLibraryCapture` saves a record only under the draft it belongs to (an unowned record is the current draft's). No history redesign, no separate migration Undo step; Dismiss updates the current step in place. | Browser 9e: `.txt` draft A (renumbers a reading) -> Library working copy B (renumbers a rhyme link) -> Undo. A's text and id come back with A's card; after the page's re-save A's IndexedDB record, the saved session and the card hold only A's entries and B's record keeps B's; after a reload A shows A's, and B reopened from History shows B's. Reverting the history and capture changes fails 4 (B's card over A, A's stored record and the session overwritten, A's after reload). |
| 8. N.end identity follow-up | See "Item 8: the exact delta" below. | Unit E (rewritten), browser 9e. |
| 9. Returns classes | In a returns row bare `N` is a whole-line return judged by `returns_check`; explicit `N.line` is a placed return judged by `placed_returns_check`, using the `line` placement. These have distinct harness semantics. Both are exempt from word-offset migration and are never carried, annotated, labelled "last rhyme" or shown with endpoint words; other placed returns (`N.end`, `N.endword`, `N.head`, `N.headrime`, `N.T<k>`) follow the word-place rules through import, Keep and the outgoing payload. A whole-line member an earlier page annotated is named a whole-line return in Review (no word shown) and Keep drops the note. The parser comment claiming bare `N` and `N.end` bind alike is corrected (true for rhyme groups, false for returns). | Unit E on valid classes only (`2.end,6.end;1,5;1.line,3.line;1.head,7.head;2,4`, no mixed class): migration, Review, Keep, the wire, and the harness's own `schemes.mandate` / `returns_check` / `placed_returns_check` run on the exact `returns` payload (two whole-line classes, three placed; the whole-line judge fires only on `1,5`, the placed judge on `head` and `line`). Browser 9e: the same classes through the Library working-copy receiver (`lyLibraryImport`). Making `lyWholeLineReturn` false fails 10 (E 6, P 2, R 2). Units P and R were updated where they expected bare returns to be carried. |
| 4. Slot guards | `SlotBinding.test_a_span_holding_more_than_word_material_refuses` pins `_only_word_material` on the non-default splice (`love×you more`, `lo÷ve`, U+1FEF, each with a declared reading so the grader binds the token) and on the default end (U+1FEF, U+1FFD), through `swap_at_slot`, `swap_end_word` and `Reviser._splice`, with word-material controls. `test_the_default_end_endpoint_must_be_the_replaced_pieces` pins the endpoint-pieces check of `_end_occurrence_bound` by direct call: on the 3,990-line population the asides-kept cut and the lexicon's cut differ at the end on 264 line-modes and an earlier guard refuses every one, so no production splice reaches the check with a mismatch; it is defence in depth, and the test says so. | Removing the non-default guard fails 10 subtests, the default-end guard 4, the pieces check 1. No `loop.py` change. |
| 10. Punctuated hyphen ends | `relations.build_stream` reads the printed part of the line's last token whenever it ends in a hyphen (a closing quote after it allowed), through the same phonology, so `king-,`, `king-.`, `king-;`, `king-'` read `king`, as `line_anchors` reads them. Whether the line is SPLIT stays `split_final`'s answer, so punctuation never becomes a broken-word continuation. v2 now answers exactly as v1: declared perfect rhyme True, declared broken rhyme False (they were None/None). | `Normalisation.test_punctuation_after_the_hyphen_is_read_not_continued`: 11 shapes x v1/v2, the `line_anchors` premise, split, numeral (`2-,`) and printed-boundary controls, a mid-word hyphen. Reverting the stream change fails 11 subtests; dropping the closing-quote allowance fails 2. |
| 3. WarmWorker wording | `_caches_hold_their_schemes` is described as what it checks: scheme ownership, not a count (BB8 counted 4 entries in `fit._LEX`). The child peak assertion is unchanged. | none (wording) |
| 5. Empty pivot | `mcp/LYRICS_RUNTIME.md` (pre-existing items) and the slot receipt: the stock proposer forwarding an EMPTY `GroupBrief` pivot through the splice (an empty replacement deleting a word) is a PRE-EXISTING shared-loop candidate-validity issue, separate from occurrence targeting, owner-gated (needs John's bounded approval), not fixed here. The marker-only slot oracle does not show production candidates are safe. | none (wording) |

Reverting `src/pages/lyrics.js` alone to `43d32cdf` fails 53 unit assertions
(B 18, E 6, O 25, P 2, R 2).

### Item 8: the exact delta

- **Already fixed before this pass, and not credited to it or to `82fe130e`:**
  explicit `N.end` preserved in text and wire on the 6955e342 paths
  (643e292e re-read each member's raw text; BB8's 39-send / three-parser
  receipt at 66cef416).
- **`82fe130e`'s own delta over 6955e342:** the `explicit` flag in every member
  shape, so members of a row marked with an unknown cut keep `.end` when a
  form merges the row, and Review names them as written.
- **This pass:** bare whole-line returns and explicit `N.line` placements
  (distinct harness classes) are no longer carried
  or annotated on changed-cut lines (the 6955e342/43d32cdf page carried them,
  `lyrics.js` ~314-319); no returns member is called "last rhyme" or shown
  with endpoint words unless it is a placed end (~1407-1417); `N.line` and
  the Library working-copy receiver are covered; and the return classes are
  checked in what the harness reads from the payload, not by spelling alone.

### Item 10: corpus reach and the acceptance matrix

| shape | v1 broken / perfect | v2 before (43d32cdf) | v2 now |
|---|---|---|---|
| `king-` (split) | True / True | True / True | True / True |
| `king-,` `king-.` `king-;` `king-!` `king- ,` `king-)` `king-—` | False / True | None / None | False / True |
| `king-'` `king-’` | False / True | None / None | False / True |
| `king‐,` (U+2010), `king-`U+00AD`.` | False / True | None / None | False / True |
| `2-,` (numeral) | — | None / None | None / None |
| `×king-,` (printed boundary) | — | None / None | None / None |

On the English song corpus (281,399 sung lines by the page's filter), 2 lines
end on a hyphen followed by punctuation: `Then the ominous words “It’s a
Boo-”` is now read (`Boo`); `Yecleap'd _Buce-_` stays refused (the stem has
no reading). The `Boo-”` witness was still refused at `0af39c6f`; "now"
refers to the punctuation/closing-quote repair in `7c26d40c4`. A focused
probe with `we knew` as the comparison line finds unread `Boo-` and
None/None perfect/broken verdicts before, versus no unread token and
True/False after, in both aside-stripped and voices modes. This witness
has no parenthetical aside. Those modes remain distinct for corpus counts:
aside-stripped mode removes parenthetical material, while voices retains it.
The focused check loaded the historical `relations.py` and `phonology/eng.py`
against this continuation's unchanged supporting reader modules; it is not
an independent full-tree run or a live-service acceptance result. Reproduce
with `quality/results/reader_continuation_2026-10-14/boo_quote_probe.py`;
its adjacent `boo_quote_probe.json` records exact pins, loaded-module hashes,
dictionary hash and both modes. Supporting module bytes are checked against
`8ea94ac9d5141eb5062a8094351a9330f4edc38c` before the result is emitted.
No earlier shape is claimed closed beyond this matrix.

### Item 4: the five excluded witnesses

At `61b6618a` a direct call finds 196 unbound default-end edits per v2 mode,
the slot tool's 191 plus 5 lines it excludes as `excluded_transformed`
(spaced enclitics: `An' Charlie he 's our ain.` and four more, listed in the
slot receipt). At `7c26d40c4`: 0 changed outputs per mode. This direct probe skips
both refusal (`None`) and unchanged outputs; the zeros alone do not
distinguish those outcomes. The guard and focused refusal tests support
the zero-binding refusal interpretation. "Default end unchanged" is scoped to the measured 3,990-line
population and lexicon; BB8's 1,760 crafted/fuzzed conservative refusals at
`61b6618a` stay disclosed (the probed examples bind zero syllables at this
head; the full crafted set was not re-run).

### Item 11: the slot receipt, completed

`quality/results/slot_default_end_zero_binding_2026-10-14/` now holds the full
per-case dumps for `61b6618a` and the code head `7c26d40c4` (with the tool's
summaries, sha256 in its README; the previously named run logs are absent),
`compare_runs.py` (the exact comparison, reading only per-case records) and its output, and
`default_end_direct.py` with both outputs. Reconstructed from the dumps:
190,530 cases each; exactly 382 differ, all v2 default `end` (191 per mode
`edit_unbound` -> `refused_unbound`; 181 unread, 7 numeral, 3 hyphenated);
6,052 of 6,052 readable v2 default-end cases have identical normalized
serialized records; so do 95,265 of 95,265 v1 cases and 174,660 non-end
cases; the 989 cohort (v2 `grader_elsewhere` at 67889851, from BB8's committed dump) all `occ_agree`
and identical under that comparison. `compare_runs.py` compares decoded
serialized record strings with trailing newlines stripped, not raw file
bytes; its historical `byte_identical` keys name that normalization.
The code head's per-case dump is byte-identical (decompressed) to the `0af39c6f` run's, and the `61b6618a` dump to BB8's
committed one. The five witnesses and any alternate lexicon are kept apart
from the 3,990-line gate. The trees are archives, not checkouts (the
attestation limitation is in the receipt).

### Local results at `7c26d40c4` (page code `34ecc6bcc`)

| suite | result |
|---|---|
| `node scripts/check_lyrics_page.js` (unit + browser) | PASS, 594 assertions (384 unit, 210 browser, step 9e new). Run with a scratch preload that points Playwright at the preinstalled Chromium (environment limit, repo unchanged) |
| `quality/test_reader.py`, one process | 101 tests OK, 6 skips (the six child bodies, each run by its parent; 98 + 3 new). Child peaks (VmHWM) under the unchanged 1024 MiB guard: 456 / 538 / 459 MiB, cold 538 / 471 / 471 MiB |
| `scripts/check_library_page.js` | PASS, 270/270 |
| `scripts/test_library_import.js`, `test_library_declarations.js`, `test_lyric_tokens.js`, `test_library_chunk_generations.js` | 34 tests pass, 0 fail |
| `test_library_import_browser.js`, `test_library_import_shipped.js` | pass (1 test; SHIPPED LIBRARY IMPORT PASS), same preload |
| `mcp/test_high_report.mjs` | 10/10, under both CPython 3.11.17 and the system 3.13.16 (see CI below) |
| `npm run lint`, `npm run format:check`, `npm run check:fresh`, `npm run check:budget`, `npm run test:minified`, `scripts/check_doc_paths.js` | All PASS (check:fresh byte-identical to a fresh build; 13 budgets hold; minified equivalence across 7755 traditions) |
| `map/build.py`, then `--check` | regenerated (`map/files.md`), then current |
| `search_null --check`, `audit_corpus --verify-shape`, `check_comparator_pin.py`, `counters.py --check` | Only the held failures: search_null k=3-4 813 -> 808 and k=5-8 208 -> 207; audit NOTE 1856 -> 1861; comparator MOVED 1 of 7 inputs; counters public-symbol row only (below) |

Not re-run at this head, with the reason: the revision-loop job, `test_verbs`
and `test_production_revision` (`loop.py`, `revise.py`, `slots.py` and
`lyric_harness.py` are unchanged; the harness change is the relation stream's
line-final token and test files).

### CI at 43d32cdf and held pins

- Run https://github.com/WeningerII/CodexMusica/actions/runs/38554634818
  (push, head `43d32cdf`): 48 jobs, 41 success / 4 failed / 3 skipped. Failed:
  `record`, `suites (shard 2/3)`, `suites-result` (the held pins, as at
  `678898511`) and **`verify`**.
- **UNEXPECTED: `verify` failed on `node --test mcp/test_high_report.mjs`
  (exit 1)**, the only failing leaf it lists. It passed at `678898511`. It does
  not reproduce locally at `7c26d40c4` (10/10 under 3.11.17 and 3.13.16), and
  the failing assertion is not in the retrievable tail of the job log (the
  full log download is blocked from this environment), so its cause is not
  established here. It needs a look at the full CI log, or a re-run, before
  qualification.
- Held, unapplied (proposals stay on `claude/reader-batch-2026-10-13-repins`):
  comparator fingerprint; search_null 813 -> 808, 208 -> 207; audit NOTE
  1856 -> 1861; counters public-symbol row 1719 committed, measured **1739**
  (production 434, tests-only 511, self-only 655, nowhere 4, refused 135);
  the total is the same as at `43d32cdf`, and this pass adds no declared-public module-level symbol (the
  receipt scripts' helpers are private and behind a `__main__` guard; an
  unguarded draft briefly tripped the "stranded modules" row, fixed before
  commit).

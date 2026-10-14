# Reader batch, commit 1: CI parity, held pins and slot binding (2026-10-14)

Evidence for the head that carries the slot-binding repair: code commit
`58de181633f44195da3d78ce4a2736fb57e0ea32` on top of `678898511`, the last pushed head of
`claude/reader-batch-2026-10-13`. This file's own commit adds this file and
nothing else.

**The verified tree is not the pushed tree.** `678898511` is pushed, and its
CI run is the one cited below. The repair commit and this file are local. They
have not been pushed, and no GitHub CI run exists for them. Every result below
that names the new head is local, under the interpreter it states.

**Update, broad fix round.** Code commit
`643e292e6586d5aa5aea57e9ede231e360d5590d` (on top of `61b6618a`) closes BB8's
F1, F4-F10 and A.2-six findings. It is also local and unpushed, with no CI
run; see "Broad fix round" below. Every section before it describes
`58de1816`, unchanged.

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

Code commit `643e292e6586d5aa5aea57e9ede231e360d5590d`, on top of `61b6618a`. Like everything after `678898511`,
it is local, unpushed, and has no CI run. Interpreter for every Python result
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

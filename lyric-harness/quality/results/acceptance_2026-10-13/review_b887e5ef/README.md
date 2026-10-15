# Independent review of the outage work, up to merged main `b887e5ef`

The scope is `8b1d2ad2...b887e5ef`, plus the off-main commits `132cec38` and `d85d2f26`, as 3PO asked (#527 6192809675). Everything below is local: unit probes, the repository's tests, and MCP emulated in-process (SDK `InMemoryTransport` driving `buildServer()` and the real Python worker). **No live MCP host, provider, deployment, native keyboard, zoom or assistive-technology run is included.**

**Folders:**
- `harness/`: the harness and MCP reviewer's probes, logs and `COMMANDS.txt`. Copied trees are left out.
- `records/`: the records, tests and CI reviewer's scripts and `COMMANDS.txt`. Downloaded receipts are left out; they are listed in `COMMANDS.txt`.
- `repro_pin_guard/`: BB8's own reproduction of finding H1 on clean worktrees.
- `page/`: the page reviewer's node replicas, Chromium scripts, logs and `COMMANDS.txt`.

## Harness and MCP

**H1 — MAJOR, reproduced by BB8, NEW in `539931f5`: a declared relation that was judged is now refused.**
- **Mechanism:** `lyric_harness.py:10000` sets `lex._numbering_guard = True` on every CLI lexicon. `quality/pronunciation.py:126` then applies the unmarked-caller v1/v2 ambiguity rule to every guarded validation. That includes the server's own `pin_readings` (`pronunciation.py:460`), which the any-reading judge uses. When a v2 token holds the same word at the same index under v1 but at different characters, `pin_readings` returns `None`, and the relation goes unjudged.
- **Failing input** (`repro_pin_guard/`):
  - draft: `Read--read, read it again` / `the bed is made for me`;
  - command: `--reader-scheme=v2 brief --groups=1.T2,2.T2 --relation="perfect rhyme"`.

  | Tree | Supplement | Result |
  |---|---|---|
  | `5e97e06f` | `none` | HOLDS |
  | `5e97e06f` | `v2` | HOLDS |
  | `b887e5ef` (`--numbering=v2`) | `none` | HOLDS |
  | `b887e5ef` (`--numbering=v2`) | `v2` | **UNJUDGED**, `SCHEME_UNREADABLE` |
- **Why it matters:** the `v2` supplement is the MCP default basis for new work.
- **Scope:** narrow — a repeated word with more than one reading, at a position that shifts between the v1 and v2 cuts.
- **Confirming the cause:** the reviewer removed the guard inside `pin_readings` alone, and `certified` came back true. Emulated MCP `lyric_check` gives the same split.
- **Doc conflict:** `docs/reader-numbering-safeguards-2026-10-14.md:38` says "No tokenizer, grading … change is part of this contract."

**H2 — minor, `d85d2f26` (unpublished): the blank guard rejects only whitespace-blank replacements.**
- Replacements made only of invisible format characters or punctuation still get through: zero-width space, soft hyphen, word joiner, BOM, `-`, `'`, `...`. For example, `swap_end_word('the room on fire', '​')` gives `'the room on ​'`.
- The production trigger it was written for (an empty `whole_repair` or `pivot_word`) is closed.
- An intended behaviour change is not described in its doc: atomic verbatim-return backtracks now decline instead of splicing `""`.

**H3 — minor, NEW in `539931f5`: the creation gate doesn't normalize.** `mcp/lyric_workflow.js:271-272,353` accepts only the two exact JSON spellings. So rows with re-ordered keys, or a `numbering:'v1'`-marked equivalent, are refused with `CREATION_GRADE … differs`. This fails safe, but it contradicts the doc's rule to compare only after normalizing. (Found by code reading.)

**Notes:**
- **H4:** fresh v2 work with unmarked `N.Tn` rows now refuses where the v1 and v2 cuts bind different characters (`lyric_harness.py:12880`). This is intended and documented, but it breaks v2-native callers that don't send `numbering`.
- **H5:** `client.js:125` leaves checkpoint declaration equality to the server, which compares only when `connector_declarations` is present.

**Checked with no defect found:**
- the normalization matrix: 16 cases, with no non-equivalent resend accepted;
- v1 preservation, including recover under v1;
- `132cec38`: all 15 SHA256SUMS match, and `real_tail` passes at `b887e5ef`;
- the test changes are not weakened. Repository tests run: `test_pronunciation_choices` (43 OK), the `mcp` pronunciation tests (7/7, 1/1, 1/1), `test_reader` OneCoordinate and V1Frozen (11 OK), `test_recover`, the map check, the `search_null` check, and the comparator pin.

## Records, tests and CI

No blockers. Every number the reviewer could check against a receipt holds: the comparator fingerprint (recomputed at `b887e5ef`), the prior pin, the sonnet rows, the unchanged thresholds, the census counts, and the split bodies, which are byte-identical.

- **R1 — minor, leaning major, `6d5c8d8f`: the split relaxes a deadline.** Node's `--test-timeout=120000` applies to each file, so the split gives the native and checkpoint cases their own 120 s each, where before all nine shared one budget (probe: `records/nodetimeout/`). The design doc's line "No … timeout … changed" (`docs/reader-numbering-safeguards-2026-10-14.md:144-145`) overstates.
- **R2 — minor, disclosed, `88fa63a8`: test 8 now runs on a smaller input.**
  - The draft went from 4 lines to 2, and the assertions went from 14 to 19, all unconditional. The 60 s deadline is unchanged.
  - It no longer covers the three-member, one-line-at-a-time path or the original latency workload.
- **R3 — minor, `f2e973db`:** the calibration receipts the adoption links by SHA are reachable only from the branch `codex/reader-timeout-evidence-20261014`, not from main.
- **R4 — minor:** `search_null.py:127-132` still shows the old 813/208 values as current, against the dict's 808/207.
- **R5 — minor:** `BACKLOG.md:2196` shows 1742, but its note at :2225 still says 1739.
- **Notes:**
  - assertions were removed in `44f93fcf` together with the feature they tested;
  - the checkpoint test calls use a 120 s timeout;
  - the owner-approval statements have no receipt.

## Page

**P-items — all PASS at `b887e5ef`:**

| Item | Verdict | Evidence |
|---|---|---|
| 1. 3PO's `lyAlignUnits` case (above 250,000 unit pairs) | PASS | 140 selections from 1 to 50,000 members, forward and backward: 0 fail at `b887e5ef`, 72 fail at `8ea94ac9` (124 copies: [29,34] → [1396,1396], as predicted). `page/item1_*` |
| 2. Legacy `more` count | PASS | 7 earlier entries stay stated through an appending migration and a history round trip, until Dismiss. `8ea94ac9` lost them. `page/item2_*` |
| 3. Tab→mouse review | PASS | Real Chromium: 16 of 16 cases keep the text and direction. Without the handler, 14 of 16 fail. `page/item3_*` |
| 4. `check_lyrics_page.js` weakening | PASS | No `check(` was removed (376 → 400). The changed expectations are still exact. The full unit and browser run at `b887e5ef` passes 651 assertions. |

**P-A — MAJOR, NEW in `539931f5`: after a voices toggle, a migrated row binds the wrong word, silently.**
- **Mechanism:**
  - At send time, `src/pages/lyrics.js:1483-1484` stamps `numbering = lyNumbering(model.voices)` on every `N.Tk` group or return, from the current voices setting.
  - The migration's group rewrite (`lyRespellGroupRow`, `:386-402`) records only `— cut v2`, not the voices setting the token was numbered under.
  - Reading rows behave the same way (`:1507-1510`).
- **Repro:**
  1. Line `Oh--oh, (ah) oh my love`, voices off, legacy `[SETUP — rhyme groups — 1.T4,2.end]` (v1 token 4 = love).
  2. Migration gives `1.T5,2.end — cut v2`.
  3. Voices are set to sung in the page's form.
  4. The send carries `groups 1.T5,2.end`, `numbering v2+voices`, and in v2+voices token 5 is `my`.
- **Harness `normalize-numbering` at `b887e5ef`:** `normalized`, binding `my`. On the `8ea94ac9` payload, with no numbering, the same verb **refuses**: "v1+voices binds love; v2+voices binds my; declare numbering explicitly" (`page/item5_harness.log`). Expected: `love` (1.T6), which is what a form-written row gives at `b887e5ef`.
- **Reading variant:** the send is refused loudly at `b887e5ef` ("cannot resolve token 5 … under v2+voices"), where `8ea94ac9` resolved it to `love`.
- **Exercised:** a node replica of the page's send, plus the harness CLI. BB8 checked the page source lines. It was not run through a live `/chat` send.

**P-B — minor, NEW in `a09703a0` (`lyrics.js:6380-6392`):** clicking or tapping Run review now always focuses the draft, even when nothing was selected. Chromium with touch emulation at 1024×1366 shows focus moving from BODY to `lyrics-draft`. Whether this raises the on-screen keyboard on a real tablet is inferred, not observed.

**P-C — minor (`84f7fa94`, plus the pre-existing `LY.songCaret`):** after a migration, the phone Song/Review round trip restores the selected text, but a backward selection comes back forward.

**Notes:**
- **P-D:** the Hirschberg branch of `lyAlignUnits` is correct (0 of 40 fuzz mismatches) but quadratic: about 11 s on an 8,000-unit row. It is reached only when the delimiter sequences differ, which the migration never causes in these tests.
- **P-E (pre-existing):** `lyRenumberedCheck` does not check `draftId`.

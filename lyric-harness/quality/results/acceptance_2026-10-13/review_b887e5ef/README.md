# Independent review of the outage work, up to merged main `b887e5ef`

The scope is `8b1d2ad2...b887e5ef`, plus the off-main commits `132cec38` and `d85d2f26`, as 3PO asked (#527 6192809675). Everything below is local: unit probes, the repository's tests, and MCP emulated in-process (SDK `InMemoryTransport` driving `buildServer()` and the real Python worker). **No live MCP host, provider, deployment, native keyboard, zoom or assistive-technology run is included.**

**Folders:**
- `harness/`: the harness and MCP reviewer's probes, logs and `COMMANDS.txt`. Copied trees are left out.
- `records/`: the records, tests and CI reviewer's scripts and `COMMANDS.txt`. Downloaded receipts are left out; they are listed in `COMMANDS.txt`.
- `repro_pin_guard/`: BB8's own reproduction of finding H1 on clean worktrees.
- The page track is still running. Its folder will be added.

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

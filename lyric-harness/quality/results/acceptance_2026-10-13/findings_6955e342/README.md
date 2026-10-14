# Runtime acceptance of R2's broad-fix head `6955e342`

**Candidate:** `6955e342963a90bdf470741266cea0dd84f0a797` (code `643e292e`: F1, F4–F10, A.2-six), on top of `61b6618a`.

**Controls:**
- main `8b1d2ad2` for the page and the Library;
- `61b6618a` and `67889851` as earlier candidates;
- `fce4bf0f` for the harness.

**Why, and on whose evidence.** R2 pushes code heads as they land, and the handoff is estimated at 12:30 UTC, so this is early feedback. 3PO's static review of this head (#527 6164215811) named F4 retention, F1 selection mapping and cross-import card persistence, and 3PO set the protocol for the two follow-up probes (#527 6165283798).

**Who ran what.** Five independent testers drove the built pages in Chromium and the harness under CPython 3.11. Every failing check or non-note finding then goes to a skeptic agent.

**Receipts:**
- `testers_and_skeptics.json` holds the testers' and finished skeptics' results.
- `protocol_probes.json` holds the two protocol probes and their independent re-runs.
- `repro/<agent>/` holds each agent's scripts, logs and `COMMANDS.txt`. Scratch paths there read as written, and the README of `findings_67889851/` explains the layout.
- What is left out: built pages, files over 2 MB (some JSON summaries and copies of harness data), and copies of the trees' own data and code. Files over 200 KB are gzipped in place.

**Scope.** This workflow was stopped at 12:55 UTC, when R2's fourth pass `8ea94ac9` (code `34ecc6bc` and `7c26d40c`) superseded this head. Not run: the F6, A.2 and test-suite skeptics, and `verify:f1-selection:9`. Those items are re-measured at `8ea94ac9`.

**Status labels:**
- **CONFIRMED:** reproduced by an independent re-run or a skeptic.
- **TESTER:** one tester's result, with its skeptic still queued.
- **PENDING:** not run yet.

The F4 and F1 skeptics finished. The **Scope** paragraph above says which did not run.

## New at `6955e342`

1. **BLOCKER, CONFIRMED (the action-order probe and its independent re-run): a form commit marks an unmarked row as current-cut without migrating it.**
   - **Mechanism.** Migration is now boundary-only, so a rhyme-groups or returns row typed or pasted by hand stays unmarked until the next open, import or send. The Rhymes form (Remove link, Link endings), the Repeats placed-return Apply and Declare exact repeat read that row with `lyRowGroups`. They write it back through `lySetSetup`, whose `mark()` appends `— cut v2` (`src/pages/lyrics.js:2476`), and `lyMigrateSavedReadings` is never called on it.
   - **The two orders**, from the same starting text and state:
     - form commit → send: sends `1.T4,8`, which the harness binds to `my` at raw [11,13];
     - send → form commit: sends `1.T5,8`, which it binds to `love` at [14,18].
   - **Scale:** 20 of 20 pairs in the probe and 25 of 25 in the re-run, across rhyme-groups and returns rows, all four form writers, Run review and the dock's Send, and paste and typing.
   - **The placed-return verdict flips with the order** when line 8 is `And love above`: NOT_RETURNED_AT in one order, clean in the other.
   - **No notice on the form path.** Only the form's own toast appears; there is no renumber toast or card.
   - **Controls:** `61b6618a` (which migrates on the typing refresh) and main (which has no cut mark) bind the same word in both orders on every pair.
   - **Precision from the re-run:** before any boundary, the candidate's own Rhymes and Repeats display reads the unmarked row under the current cut, so the form-first order sends the word the page displayed. The meaning differs from main's, from `61b6618a`'s and from the page's own policy that an unmarked row is read under the earlier cut.
   - **Files:** `repro/order-marker/` and `repro/check-order-marker/`, each with `summary.txt` and `orders_*.json`.
2. **CONFIRMED (the Library-Undo probe and its re-run): after Undo, the Review card stays over another draft and overwrites that draft's stored evidence.** The sequence is a `.txt` draft A (renumbers) → Library working copy B (renumbers) → the page's own Undo.
   - **What happens:**
     - the draft returns to A's text and draftId, but the card still lists B's entries in B's wording;
     - about 0.4–1.9 s later, with no user action, `lyLibraryPersist` re-saves A's IndexedDB record with B's entries;
     - localStorage and sessionStorage carry B's too;
     - after a reload, A's entries are found nowhere.
   - **Session import:**
     - a quiet session followed by Undo loses A's evidence;
     - a renumbering session followed by Undo puts its card over A.
   - **The payload is right:** it carries A's own declarations, bound to A's words.
   - **Browser-native Undo** (Ctrl+Z inside the textarea) is a no-op on all three trees. **Plain per-draft isolation** (opening another draft from History) is correct.
   - **The card's line numbers are historical import coordinates.** They are not remapped after an edit above them.
   - **Mechanism:**
     - `_restoreSnapshot` keeps the live `lyricMeta.ui` (pre-existing);
     - `lyLibraryPersist` re-saves the restored draft's record from the live meta (pre-existing);
     - the card exists only at `643e292e`.
   - **Files:** `repro/library-undo-card/` and `repro/check-library-undo-card/`.
   - **Side finding:** a migrating Library import sets `libraryOrigin.adapted` with no edit, which adds one Undo step. The same happens at `61b6618a`. By code reading only, a later working-copy download would then drop the Library declarations.
3. **CONFIRMED (skeptics on F4): the renumbering card loses entries from one large import.** The card's display state has a 3,200-character budget (`lyrics.js:468`) and evicts from the front (`:497`).
   - **Measured:** at 50, 200 and 500 moved entries it lists 48–49 and says how many it dropped. A skeptic found the first drop at about 52–56 short entries, or 32–34 at 40-character words.
   - **Truncation:** words longer than 40 code units are cut silently (`:478`), and matching lines are cut at 4 with no "more" marker (`:485`).
   - **Not a breach of the card's written contract.** As one skeptic notes, R2's plan promised "a card listing every renumbered item", and both import paths do list every item at small sizes (7 of 7, and 5 of 5).
   - **Also (TESTER):** Dismiss has no Undo, and the card is hidden in a closed section once a review returns items.
   - **Files:** `repro/f4-card/` and `repro/verify-f4-card-*/`.
4. **CONFIRMED (eight F1 skeptics, `repro/verify-f1-selection-0..8/`): selection mapping across a rewritten row.** `lyMapOffset` takes one common prefix and suffix for the whole row. A node replica predicts the page's offsets 96/96.
   - **Unchanged members after the changed one collapse.** In `[SETUP — returns — 1.T2, 2.end]`, a selection `[25,30]` on `2.end` becomes `[39,39]` before `]`.
   - **A selection ending in the changed member grows** to cover `1.T3, 2.end — cut v2`, and typing over it deletes `2.end` and the mark.
   - **Members before the changed one map correctly.**
   - **Confirmed, with the skeptics' corrections:**
     - a real mouse click on Run review loses the selection to [0,0], but only when that send actually rewrites the draft. The page maps it correctly; Chromium then resets the unfocused editor;
     - the line merge is a pre-existing defect reached from a new place. In the narrow layout (under 960 px), returning to Song restores `LY.songCaret`'s raw pre-boundary offsets over the correctly mapped ones;
     - native undo before a send is wiped when that send rewrites rows (`draft.value = …`, `lyrics.js:432`). It is unchanged when nothing is rewritten;
     - the mount boundary (`lyrics.js:6148`) is dead: it always sees an empty draft, and boot migration happens in `uiRestoreSession`.
   - **Files:** `repro/f1-selection/`.
5. **TESTER: the WarmWorker "at most two retained per cache" claim is false.** Twelve real requests leave 4 entries in `fit._LEX` and 3 in the supplemented-lexicon cache. Of the three "cold-first-use" scenarios, only v1→v2 asserts that it is cold. Files: `repro/tests-warmworker/`.

## Fixed or holding at `6955e342` (TESTER unless marked)

- **F1, caret:** the `67889851` caret-jump repro passes. The row is unchanged and the final text equals main's. Migration runs only at boundaries, and Undo/Redo never runs it.
- **F6, bytes:** unchanged rows keep every byte, 308/308, with no notice; `61b6618a` gave 165/308. Rewritten rows respell only their changed members, in the writer's spelling, 364/364. The wire is exact, 384/384.
- **Returns `N.end` stays placed through every path.** `payload_and_mandate.py` was run unchanged on the song8 rows at 13 stages each: load, reload, Keep, reorder, the three forms, and the imports. The candidate keeps 39/39 placed; main loses 12/39 and `61b6618a` loses 39/39. On this evidence, the `67889851` returns blocker is fixed at this head. Two minor items remain:
  - whole-line return members (bare `N`, `N.line`) on a changed line are still annotated and marked, and need a Keep, and a bare `N` is still called "last rhyme";
  - Keep rewrites the whole row in the page's format, collapsing the writer's whitespace.
- **A.2-six:** all 8 lines of BB8's union fire with voices off and on; R2's 24 fire, and 0 of 7 NFC-only lines do. `measure.py` reproduces 271,092 identical-cut lines, 24 firing and 8 END changes. A page scan of 281,399 rows matches the receipt. **Note:** on the 16 lookup-only lines, rows whose binding cannot move are also rewritten, and the notice says the cut changed, which it did not.
- **Author tests:**
  - `check_lyrics_page` PASS, 529 assertions (471 at `61b6618a`);
  - `check_library_page` 270/270;
  - `check_library_regression` PASS;
  - `test_reader` NamedPlaceLookup, WarmWorker, SlotBinding and LoopSwaps: 31 OK, with child peaks 458–543 MiB under the 1 GiB guard;
  - all four `test_revise` shards pass, 62 of 62 sections.
- **Slot binding:** the records are byte-identical to `61b6618a`'s (`../slot_occurrence_6955e342/`).

## Unchanged from `67889851` (TESTER)

- **The stale Library tab** still moves a choice to another word: S1/S2/S3/B1 outputs are identical.
- **An old page against a new server** still binds silently to another word: all 8 server runs match.
- **The default end still edits an unread end word** where `T<n>` refuses (`the night was zzqx`).

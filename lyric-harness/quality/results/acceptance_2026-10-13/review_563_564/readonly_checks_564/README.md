# #564: read-only checks at `feca512a` against base `b887e5ef` (2026-10-15, 15:46–16:04 UTC)

No decision was needed for these checks. Nothing was written, repinned or regenerated. `COMMANDS.txt` holds every command.

| Check (qualification item) | Head result | Base result | What #564 moves |
|---|---|---|---|
| `quality/capacity.py --check` (item 9) | rc 1 | rc 1 | **Nothing.** The same failure appears at both: `CAPACITY_UNVERIFIED`, because the gitignored runtime receipt `mcp/capacity_verification.json` is missing and only `verify_capacity.py` writes it. The table sha and the identity are equal at both. So this is not evidence that the witnesses are certified. It only shows that #564 changes nothing here. |
| `quality/search_null.py --check` (item 12) | rc 0 | rc 0 | **Nothing** on the sonnet arm: output byte-identical, 808/808 and 207/207. `--check` doesn't re-sweep the song arm, which is the corpus #564 edits, so the song arm is still unqualified. |
| `scripts/build_library_data.py --check` (item 13) | **rc 1** | rc 0 (`25525` units, `data_id 709469a17dc5`) | **A real failure from #564:** `CatalogError: pinned source drift` on 3 of 2,328 pins (Lovelace 127420 → 127810 bytes, Browning 112101 → 112179, Herrick 305099 → 305242; `library_pin_drift.log`). Whether the published Library data would change after a repin is unknown without that repin. |

**Notes:**
- The base Library check took 775 s and writes a gitignored 2.3 GB `lyric-harness/library/snapshot/`, as CI does. That copy was deleted afterwards.
- These are local runs with CPython 3.11 (capacity, search_null) and 3.13 (Library). CI runs the Library check on 3.12.

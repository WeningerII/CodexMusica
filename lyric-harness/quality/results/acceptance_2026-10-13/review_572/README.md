# BB8 independent pass on #572 (M-25 residue: editor's-notes cleanup and song-length yardstick re-measure). Verdict: PASS, with one item pending.

**Heads.** The verdict names **`1dbc75cf`**, the PR head merged with main `6eaa8e4c`.
- Most runs were at `90d6de13`. `08c95c83` (a map line) and `3045a1cd` (the `qualify_reader.mjs` count 25525 → 25512) change nothing those runs exercise.
- The merge-affected set was rerun on the merge `851adaf0`. `1dbc75cf` differs from it only by one `map/files.md` line, and the map check passes on a clean `1dbc75cf`.

The base is main `5ad10a62`. Runs used CPython 3.11, except the Library check (system 3.13) and the map check.

## Results

| Item | Result |
|---|---|
| Corpus edits (3 song files) | byte-identical to #564's head `feca512a`: 47 `# APPARATUS:` lines (Lovelace 30, Browning 6, Herrick 11), line counts unchanged, no other added text |
| Gates that failed on #564 | **all PASS**: `audit_corpus --verify-shape`, `mark_coverage --check`, `section_marks --check`, `corpus_manifest --check`, `structure_census --check`, `test_corpus_taxonomy`, `test_corpus_audit` (all pins hold), `test_structure_census`, `test_section_marks` (`gates/SUMMARY.txt`) |
| Derived tables | `build_song_frequency.py` rebuilds `song_endword_en.tsv` and `song_rhymepair_en.tsv` **byte-identically** (`git status` clean). `verify_asset('runtime_tables')` OK, plus 8 other assets. `moby_mpron` isn't staged in my environment and #572 doesn't touch it. |
| Yardstick | `length_curve_calibration.py check --rows` on the committed `current-calibration-rows.tsv`: **HOLDS**, 5/5 curves. Row provenance verified against this tree. `cv` matches shipped to about 1e-8 on 3.11; the lane's record shows exact. |
| Shipped lower bound | `floor.py` lyric profile `lo` 4 → 9, `n_human` 8597 → 8585. **Visible effect, measured:** an 8-token draft now gets `OUT_OF_CALIBRATED_LENGTH` in place of `FUNCTION_WORD_HEAVY` and `UNIFORM_LINE_LENGTH`. A 12-token draft is unchanged (`short_draft/`). |
| Coverage split | the 2026-10-11 and `-r2` files are byte-unchanged. `coverage_split.py --catalog <fresh snapshot> --check`: **the new split re-derives byte for byte.** |
| Replay fixture | independent recapture with the random `journal_id` pinned to the fixture's own (`recapture.py`, `sitecustomize` patching `uuid.uuid4`). `fce4bf0f` + only #572's `floor.py` patch reproduces the **new** fixture **raw byte for byte** in all 4 fields; untouched `fce4bf0f` reproduces the **old** fixture byte for byte (`recapture_pinned.txt`). |
| Library | `scripts/build_library_data.py --check`: **library/data is current** (634 s). Fresh snapshot `readable_reading_units` 25512, matching `qualify_reader.mjs`. |
| Comparator | fingerprint `51316f79…`, `check_comparator_pin` HOLDS (pre-merge and merged) |
| Tests, pre-merge | `test_floor`, `test_readability`, `test_relations`, `test_loop`, `test_reader` LegacyReplay + V1Frozen: all pass. `search_null --check` PASS. |
| Tests, merged `851adaf0` | `test_floor`, LegacyReplay + V1Frozen, `test_readability`, `test_relations`, `test_loop`: all pass. Comparator pin HOLDS (`merge_851adaf0/`). |
| Fail identically at base `5ad10a62` (not #572) | `capacity.py --check`: `CAPACITY_UNVERIFIED`, missing gitignored runtime receipt. `test_production_data`: the same 2 staging tests fail at base. |

## Pending

- **Independent cold recompute of all 8,585 calibration rows** (4 shards, `cal.sh`), then `check --rows` on my own rows. Started 01:27; the lane's equivalent took 1 h 46 min. I'll add it here and on #572.
- **Not run:** the cold `song_profile_calibration.py --check`, 2–4 CPU-hours. It needs the recompute's merged memo.
- CI on `1dbc75cf` was in progress at 01:52 (35 pass, 0 fail so far).

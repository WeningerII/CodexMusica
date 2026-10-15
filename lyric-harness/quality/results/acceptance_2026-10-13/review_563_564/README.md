# Independent review of #563 (importer) and #564 (M25, unqualified)

The heads reviewed were `3de4fd0e` and `13f88932`. The findings apply unchanged to the replacement heads `315c2aa8` and `feca512a`, because `git diff --stat <old> <new> -- lyric-harness` is empty for both. Each run was local. `COMMANDS.txt` holds every command, and `gates/` holds the gate logs.

## #563: verdict correct, no blockers

- **What changed:** the audit's dedup description is now a constant (`integrate.py:33-39`, used at `:275`) instead of `Duplicates.__doc__`. Python 3.13 strips docstring indentation, so the old output differed on 3.13.
- **Byte stability:**
  - the constant equals the committed `audit.json["deduplication"]`;
  - on 3.11 and 3.12 the old `__doc__` gave the same string, so those versions are unchanged;
  - under `-OO` only the constant works.
- **Tests:** `test_gutenberg_import.py` passes 14 of 14 on CPython 3.11.17, 3.12.3 and 3.13.16 (`t563_head_*.log`). As a red control, the base implementation under 3.13 fails 2 tests (`t563_baseimpl_py313.log`).
- **The 725-file claim, regenerated with the committed probe on all three Pythons:** 725 files, 0 changed, aggregate `4c08d4c2…` (`probe563_*.json`).
- **Minor:** `importer313-commands.txt` cites an uncommitted `/tmp/importer312-before-delta.json`. And `importer313-before-delta.json` came from an earlier version of the probe; it lacks `committed_sha256`.
- **Note:** the docstring and the constant now hold the same text twice. The test pins the bytes.

## #564: claims verified; not mergeable as is (expected, but the CI impact is not disclosed)

**Verified** (`verify564_rows.py`, `verify564_rows.out`):
- **Corpus edits:** 47 lines (Lovelace 30, Browning 6, Herrick 11), each prefixed `# APPARATUS: `. Line counts are unchanged, and the before and after hashes match the preservation receipt.
- **Rows:** 8,597 → 8,585.
  - The 8,585 survivors are **byte-identical** lines.
  - 12 rows were removed and none added. The summary matches `row-comparison.json`.
  - Every committed `artifact-hashes.json` entry matches. `current-field-cache.sqlite` is not committed.
- **Pins:** the `sources.tsv` and `runtime_assets.json` hashes are consistent. Nothing claims qualification.
- **Tests:** `test_production_data.py` has 40 of 42 passing. The 2 failures are environmental and fail identically at the base.

**Findings:**
- **Blocker for merge, expected for an unqualified draft but not disclosed:** these checks fail at the head and pass at the base.
  - `audit_corpus.py --verify-shape` (check C ×3);
  - `mark_coverage.py --check`;
  - `section_marks.py --check` and `test_section_marks.py`;
  - `test_corpus_taxonomy.py`;
  - `test_corpus_audit.py` (3);
  - `corpus_manifest.py --check` (6 populations owed);
  - `structure_census.py --check` (7 figures).
- **Major:** `data/song_endword_en.tsv` goes stale. `build_song_frequency.py` reproduces it exactly at the base but changes it by +6/−18 lines at the head, and no CI check catches this. The same is true of `data/section_marks.tsv`.
- **Major:** the shipped lyric floor moves. The minimum measured length becomes 9 tokens, against the pinned `lo=4` (`floor.py:1258-1259`), so re-adoption needs an explicit 4-or-9 decision.
- **Minor:**
  - the Library source pins (`library/catalog_sources.json:5675,5685,5700`) still name the old blobs, and `build_library_data.py --check` was not run;
  - the copied `measurement/baseline/README.md` names a stale pin (`9d5d8146…`).

## #564: qualification still needed

Run everything from `lyric-harness` at the candidate head, with CI's Python. Each item needs a receipt and, where marked, owner approval.

1. **Owner approval of the editorial classification:** the 13 items and 47 lines, as an adoption doc.
2. **Calibration rows:** reuse the committed measurement if the head corpus sha256 is `90a8b88d…`, or rerun `quality/calibration_rebuild.py`.
3. **Length curves:** run `length_curve_calibration.py check`. If MOVED, refit as a set. Then repin `floor.py` (`n_human` 8585, items 527, and an explicit `lo` decision) with superseded values kept. Needs approval.
4. **Song profiles:** run `song_profile_calibration.py --check` (song and short) and `expected_drift.py song_profile_calibration-fast`.
5. **Corpus manifest:** run `corpus_manifest.py --write`, in the same sitting as items 3, 4, 6, 7 and 8. Then `--check` must return 0 and `test_corpus_taxonomy.py` must pass.
6. **Rhyme-position tables:** rebuild `song_endword_en.tsv` and update the `sources.tsv` and `runtime_assets.json` hashes. `verify_asset('runtime_tables')` must pass.
7. **Section marks:** rebuild `data/section_marks.tsv` (VERSE 94472 → 94458) and update its hashes.
8. **Structure census:** re-record its 7 figures with dated superseded values.
9. **Rhyme capacity:** run `capacity.py --check`.
10. **Results files:** repin `RESULTS_MARK_COVERAGE.md` and `RESULTS_CORPUS_AUDIT.md` (back to 0 FAIL after item 5), and update `test_corpus_audit.py` 742/433 → 741/432 with a dated note.
11. **Meter bands and counters:** these already hold. Re-confirm them in the final sitting.
12. **Comparator pin:** unchanged (`51316f79…`). Confirm it on a full checkout, plus `search_null.py --check`.
13. **Library:** after owner review, refresh `catalog_sources.json`, then run `build_library_data.py --rebuild-snapshot` and `check_library_data.py`, and get `library-data.yml` green.
14. **Final:** full CI green on record, suites, library-data and the nightly or production-qualification jobs, plus owner sign-off on the combined adoption.

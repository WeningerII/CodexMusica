# #572 rework at `c765ca44`: declared 4-token reach, notes only. PASS. 2026-10-16, 02:57–03:28 UTC

This supersedes the `1dbc75cf` verdict in `../README.md`. The delta from `1dbc75cf` is `floor.py` (`Profile.reach_lo`; the lyric profile gets `reach_lo=4`; `band()` returns the reach) plus `test_floor`, `test_loop` and `test_plan`. Everything in `../` not touched by that delta carries over: corpus edits, gates, derived tables, coverage split, Library, comparator, and the calibration recompute (`../calibration_recompute/`, which **equals the committed rows exactly**).

## Tony's two questions

**1. No editorial note counts toward length or calibration.**
- The calibration population is 8,585 rows, shortest 9 tokens. That item is Lovelace's "Cinna seems poor in show, / And he is so." (a Martial epigram translation, `--- TITLE: In English`), genuine verse.
- `# APPARATUS:` lines are non-lyric to the line classifier (`lyric_harness.py:1412`) and skipped by the calibration reader (`song_profile_calibration.py:502`).
- My independent recompute of the rows gives the same 8,585 records.

**2. 4–8 tokens are graded but cannot reject; 9+ is unchanged from base.** `probe.py` ran `brief` with an `AA`/`AABB` scheme on base `5ad10a62`, superseded `1dbc75cf` and rework `c765ca44` (`probe.json`):

| Draft (tokens) | base `5ad10a62` | `1dbc75cf` | rework `c765ca44` |
|---|---|---|---|
| `t4b` (4) | ANAPHORA_OVERLOAD **flag**, LEXICAL_MONOTONY **flag**, SCHEME_VIOLATION flag | OUT_OF_CALIBRATED_LENGTH note, SCHEME_VIOLATION flag | ANAPHORA_OVERLOAD **note**, LEXICAL_MONOTONY **note**, EXTRAPOLATED_LENGTH note, SCHEME_VIOLATION flag |
| `t6` (6) | FUNCTION_WORD_HEAVY **flag** | OUT_OF_CALIBRATED_LENGTH note | FUNCTION_WORD_HEAVY **note**, EXTRAPOLATED_LENGTH note |
| `t8` (8) | FUNCTION_WORD_HEAVY **flag**, SCHEME_VIOLATION flag, UNIFORM_LINE_LENGTH note | OUT_OF_CALIBRATED_LENGTH note, SCHEME_VIOLATION flag | FUNCTION_WORD_HEAVY **note**, UNIFORM_LINE_LENGTH note, EXTRAPOLATED_LENGTH note, SCHEME_VIOLATION flag |
| `t9` (9) | FUNCTION_WORD_HEAVY flag, SCHEME_VIOLATION flag | same | **same as base** |
| `t12` (12) | none | none | **same as base** |
| `t36` (36) | CLICHE_PAIR flag, LEXICAL_MONOTONY flag | same | **same as base** |

At 4–8 tokens every length-sensitive finding is a note, so none can reject. `SCHEME_VIOLATION`, the rhyme scheme, still flags, which is correct: it is not length-sensitive. At 9+ the findings are identical to base on these drafts. That is a sample, not proof for every 9+ draft: the curves were refit on the 8,585 population, so a borderline draft could move.

## Other checks at `c765ca44`

| Check | Result |
|---|---|
| `length_curve_calibration check --rows` (committed rows) | HOLDS 5/5. The range guard (9, 3244) passes; the reach is a separate field. |
| Fixture recapture with c765's `floor.py` on `fce4bf0f`, journal id pinned | **raw byte-identical** to the committed fixture in all 4 fields. The reach doesn't change the prompt. |
| `map/build.py --check` | current |
| comparator pin | HOLDS |
| `test_floor`, `test_plan`, LegacyReplay + V1Frozen, `test_loop` | all pass |

## Open at 03:28

#574 merged into main as `ad4d954f`, so #572 is dirty again. The conflict is only in generated `map/files.md`. But `quality/test_loop.py` **auto-merges** (both #570 and #572 edit it), so a merged head needs `test_loop` rerun and the map regenerated. CI on `c765ca44` shows only push checks (22 skipped, 1 pass).

# Timings

One run of the reference song (`map/song.txt`, 16 lines, seed 0) through the connector with the warm Python worker, 2026-10-03. Each call's limit is 600 s. Revise questions were answered mechanically, so the song is not the point; the times are. Regenerate: `node map/trace.mjs && python3 map/build.py`.

| # | flow | tool | seconds | exit | result |
|---:|---|---|---:|---:|---|
| 1 | create | lyric_sweep | 1.7 | 0 |  |
| 2 | create | lyric_screen | 30.4 | 0 |  |
| 3 | create | lyric_plan | 0.8 | 0 |  |
| 4 | create | lyric_grade | 11.2 | 2 |  |
| 5 | create | lyric_revise | 50.0 | 4 | awaiting_proposal |
| 6 | create | lyric_revise | 10.9 | 4 | awaiting_proposal |
| 7 | create | lyric_revise | 10.6 | 4 | awaiting_proposal |
| 8 | create | lyric_revise | 22.6 | 4 | awaiting_proposal |
| 9 | create | lyric_revise | 9.5 | 4 | awaiting_proposal |
| 10 | create | lyric_revise | 17.6 | 3 | [FINISHED — seed 0 — exit 3 — ROUND_LIMIT after 2 round(s) — UNRESOLVED: L4, L12 — WHOLE-DRAFT FLAG: HOOK_DOES_NOT_RECUR — COVERAGE UNCERTIFIED: meter:PROMINENCE_UNDECIDED:L11, meter:COUNT_IS_A_LOWER_BOUND:L16] |
| 11 | pasted | lyric_recover | 5.0 | 3 |  |
| 12 | pasted | lyric_check | 23.3 | 0 |  |
| 13 | pasted | lyric_revise | 6.9 | 4 | awaiting_proposal |
| 14 | pasted | lyric_revise | 13.3 | 0 | [FINISHED — declared mandate — exit 0 — SUCCESS after 1 round(s) — no line flag stands] |
| 15 | pasted | lyric_verify | 7.8 | 0 |  |
| 16 | lookup | lyric_types | 1.1 | 0 |  |

Total: 223 s.

# Timings

One run of the reference song (`map/song.txt`, 16 lines, seed 0) through the connector with the warm Python worker, 2026-10-12. Each call's limit is 600 s. Revise questions were answered mechanically, so the song is not the point; the times are. Regenerate: `node map/trace.mjs && python3 map/build.py`.

| # | flow | tool | seconds | exit | result |
|---:|---|---|---:|---:|---|
| 1 | create | lyric_sweep | 0.6 | 0 |  |
| 2 | create | lyric_screen | 10.0 | 0 |  |
| 3 | create | lyric_plan | 0.4 | 0 |  |
| 4 | create | lyric_grade | 6.7 | 3 |  |
| 5 | create | lyric_revise | 11.1 | 4 | awaiting_proposal |
| 6 | create | lyric_revise | 8.3 | 4 | awaiting_proposal |
| 7 | create | lyric_revise | 6.6 | 4 | awaiting_proposal |
| 8 | create | lyric_revise | 11.7 | 4 | awaiting_proposal |
| 9 | create | lyric_revise | 6.8 | 3 | [FINISHED — seed 0 — exit 3 — ROUND_LIMIT after 2 round(s) — UNRESOLVED: L12, L13 — WHOLE-DRAFT FLAG: HOOK_DOES_NOT_RECUR] |
| 10 | pasted | lyric_recover | 2.9 | 3 |  |
| 11 | pasted | lyric_check | 21.9 | 0 |  |
| 12 | pasted | lyric_revise | 3.4 | 0 | [FINISHED — declared mandate — exit 0 — SUCCESS after 0 round(s) — no line flag stands] |
| 13 | pasted | lyric_verify | 5.0 | 0 |  |
| 14 | lookup | lyric_types | 1.9 | 0 |  |

Total: 97 s.

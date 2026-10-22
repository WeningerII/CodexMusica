# Timings

One run of the reference song (`map/song.txt`, 16 lines, seed 0) through the connector with the warm Python worker, 2026-10-22. Each call's limit is 600 s. Revise questions were answered mechanically, so the song is not the point; the times are. Regenerate: `node map/trace.mjs && python3 map/build.py`.

| # | flow | tool | seconds | exit | result |
|---:|---|---|---:|---:|---|
| 1 | create | lyric_sweep | 0.7 | 0 |  |
| 2 | create | lyric_screen | 17.2 | 0 |  |
| 3 | create | lyric_plan | 0.7 | 0 |  |
| 4 | create | lyric_grade | 8.6 | 3 |  |
| 5 | create | lyric_revise | 13.9 | 4 | awaiting_proposal |
| 6 | create | lyric_revise | 11.1 | 4 | awaiting_proposal |
| 7 | create | lyric_revise | 9.8 | 4 | awaiting_proposal |
| 8 | create | lyric_revise | 5.8 | 3 | [FINISHED — seed 0 — exit 3 — ROUND_LIMIT after 2 round(s) — UNRESOLVED: L13] |
| 9 | pasted | lyric_recover | 2.3 | 3 |  |
| 10 | pasted | lyric_check | 22.1 | 0 |  |
| 11 | pasted | lyric_revise | 6.1 | 0 | [FINISHED — declared mandate — exit 0 — SUCCESS after 0 round(s) — no line flag stands] |
| 12 | pasted | lyric_verify | 6.2 | 0 |  |
| 13 | lookup | lyric_types | 2.0 | 0 |  |

Total: 107 s.

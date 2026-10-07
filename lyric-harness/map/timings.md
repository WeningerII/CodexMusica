# Timings

One run of the reference song (`map/song.txt`, 16 lines, seed 0) through the connector with the warm Python worker, 2026-10-04. Each call's limit is 600 s. Revise questions were answered mechanically, so the song is not the point; the times are. Regenerate: `node map/trace.mjs && python3 map/build.py`.

| # | flow | tool | seconds | exit | result |
|---:|---|---|---:|---:|---|
| 1 | create | lyric_sweep | 0.7 | 0 |  |
| 2 | create | lyric_screen | 28.8 | 0 |  |
| 3 | create | lyric_plan | 0.8 | 0 |  |
| 4 | create | lyric_grade | 10.9 | 2 |  |
| 5 | create | lyric_revise | 8.3 | 4 | awaiting_proposal |
| 6 | create | lyric_revise | 22.9 | 4 | awaiting_proposal |
| 7 | create | lyric_revise | 9.0 | 2 | [FINISHED — seed 0 — exit 2 — ROUND_LIMIT after 2 round(s) — no line flag stands — COVERAGE UNCERTIFIED: meter:PROMINENCE_UNDECIDED:L11, meter:COUNT_IS_A_LOWER_BOUND:L16] |
| 8 | pasted | lyric_recover | 5.4 | 3 |  |
| 9 | pasted | lyric_check | 26.6 | 0 |  |
| 10 | pasted | lyric_revise | 6.0 | 0 | [FINISHED — declared mandate — exit 0 — SUCCESS after 0 round(s) — no line flag stands] |
| 11 | pasted | lyric_verify | 6.7 | 0 |  |
| 12 | lookup | lyric_types | 0.8 | 0 |  |

Total: 127 s.

# Timings

One run of the reference song (`map/song.txt`, 16 lines, seed 0) through the connector with the warm Python worker, 2026-11-04. Each call's limit is 600 s. Revise questions were answered mechanically, so the song is not the point; the times are. Regenerate: `node map/trace.mjs && python3 map/build.py`.

| # | flow | tool | seconds | exit | result |
|---:|---|---|---:|---:|---|
| 1 | create | lyric_sweep | 2.9 | 0 |  |
| 2 | create | lyric_screen | 14.5 | 0 |  |
| 3 | create | lyric_plan | 1.2 | 0 |  |
| 4 | create | lyric_grade | 10.0 | 3 |  |
| 5 | create | lyric_revise | 4.2 | 4 | awaiting_proposal |
| 6 | create | lyric_revise | 3.3 | 4 | awaiting_proposal |
| 7 | create | lyric_revise | 3.7 | 4 | awaiting_proposal |
| 8 | create | lyric_revise | 3.7 | 4 | awaiting_proposal |
| 9 | create | lyric_revise | 4.0 | 4 | awaiting_proposal |
| 10 | create | lyric_revise | 3.9 | 4 | awaiting_proposal |
| 11 | create | lyric_revise | 4.0 | 4 | awaiting_proposal |
| 12 | create | lyric_revise | 3.6 | 4 | awaiting_proposal |
| 13 | create | lyric_revise | 4.0 | 4 | awaiting_proposal |
| 14 | pasted | lyric_recover | 3.1 | 3 |  |
| 15 | pasted | lyric_check | 12.4 | 0 |  |
| 16 | pasted | lyric_revise | 11.6 | 0 | [FINISHED — declared mandate — exit 0 — SUCCESS after 0 round(s) — no line flag stands] |
| 17 | pasted | lyric_verify | 8.3 | 0 |  |
| 18 | lookup | lyric_types | 5.1 | 0 |  |

Total: 103 s.

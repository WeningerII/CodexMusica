# Timings

One run of a supplied song (16 lines, seed 0) through the connector with the warm Python worker, 2026-11-09. Each call's limit is 600 s. Revise questions were answered mechanically, so the song is not the point; the times are. Regenerate: `node map/trace.mjs --song=FILE && python3 map/build.py`.

| # | flow | tool | seconds | exit | result |
|---:|---|---|---:|---:|---|
| 1 | create | lyric_sweep | 3.1 | 0 |  |
| 2 | create | lyric_screen | 16.1 | 0 |  |
| 3 | create | lyric_plan | 1.2 | 0 |  |
| 4 | create | lyric_grade | 13.0 | 3 |  |
| 5 | create | lyric_revise | 5.7 | 4 | awaiting_proposal |
| 6 | create | lyric_revise | 5.4 | 4 | awaiting_proposal |
| 7 | create | lyric_revise | 5.9 | 4 | awaiting_proposal |
| 8 | create | lyric_revise | 6.0 | 4 | awaiting_proposal |
| 9 | create | lyric_revise | 5.9 | 4 | awaiting_proposal |
| 10 | create | lyric_revise | 5.1 | 4 | awaiting_proposal |
| 11 | create | lyric_revise | 6.0 | 4 | awaiting_proposal |
| 12 | create | lyric_revise | 6.6 | 4 | awaiting_proposal |
| 13 | create | lyric_revise | 5.4 | 4 | awaiting_proposal |
| 14 | pasted | lyric_recover | 3.4 | 3 |  |
| 15 | pasted | lyric_check | 9.9 | 0 |  |
| 16 | pasted | lyric_revise | 4.7 | 4 | awaiting_proposal |
| 17 | pasted | lyric_revise | 4.7 | 4 | awaiting_proposal |
| 18 | pasted | lyric_revise | 4.8 | 4 | awaiting_proposal |
| 19 | pasted | lyric_revise | 5.0 | 4 | awaiting_proposal |
| 20 | pasted | lyric_revise | 5.0 | 4 | awaiting_proposal |
| 21 | pasted | lyric_revise | 5.1 | 4 | awaiting_proposal |
| 22 | pasted | lyric_revise | 5.6 | 4 | awaiting_proposal |
| 23 | pasted | lyric_revise | 6.0 | 4 | awaiting_proposal |
| 24 | pasted | lyric_revise | 6.3 | 4 | awaiting_proposal |
| 25 | pasted | lyric_verify | 6.8 | 0 |  |
| 26 | lookup | lyric_types | 5.1 | 0 |  |

Total: 158 s.

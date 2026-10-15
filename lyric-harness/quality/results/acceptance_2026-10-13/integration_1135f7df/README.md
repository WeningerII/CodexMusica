# Qualification of release candidate `1135f7df` (#569), 2026-10-15, 20:01–20:17 UTC

This was `probes/combined/qualify_combined.sh` on the exact head `1135f7df022453d9745cd0b9bc39fb2fad0dc4fa`. The control (`76020a01`) is the same head with the evidence-sibling hunks removed from `lyric_harness.py`.

**An operator error, disclosed:** I launched the qualifier twice, at 20:01 and 20:02, because I misread the first launch as having failed. **So two full runs went concurrently into the same output folder.** `SUMMARY.txt` therefore has every line twice and **two `VERDICT PASS` lines: both runs passed every step.** The per-step logs here were overwritten, last writer wins, so each `*.tail.txt` belongs to one run or the other. The concurrency only added CPU contention. That makes the timing-sensitive checks harder to pass, not easier.

| Check | Result (both runs) |
|---|---|
| build | `codex.html` `d17e5263…` = fresh `--out` build, matching 3PO's posted hash |
| H1 probe | 14/14 |
| P-A probe | 162 cases, 0 failures |
| unchanged fields (v2) | 18/18 |
| page suite | 809 |
| viewport / gate / natural-timing | 30/30, 37/37, 40/40, no errors |
| `test_lyrics_evidence.js` | pass |
| real keys | type 0/16/33/settle and ArrowRight 5/5 visible; ArrowDown 2/5 and PageDown 1/5 (deliberate navigation, under 2× load) |
| lint | 26 changed files |

**Carried over from `be96c359`**, since `lyric-harness/` is unchanged: v1 records frozen; LegacyReplay 18 OK.

**Not covered:**
- CI;
- devices, IME and assistive technology;
- the live site.

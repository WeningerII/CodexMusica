# Combined-tree dry run on a local scratch merge (2026-10-15, 17:55–18:09 UTC)

**This is not the release tree.** It is a local merge, never pushed, built to test `probes/combined/qualify_combined.sh` end to end and to find integration collisions early. The release qualification will run on the single combined SHA that 3PO names.

**How the tree was built** (`fc972546`):
- integration checkpoint `9172dd32` (#569: #562 UI + writing);
- + tools `b51438c8` (#567), which merged cleanly;
- + P-A `26a2c76f` (#566). Only `codex.html` conflicted, and the sources auto-merged;
- + H1 `b5a274ad` (#565), which merged cleanly;
- then `python3 map/build.py` (`map/files.md` was stale) and `node scripts/build_html.js --out=codex.html`.

**The control tree for the unchanged-fields gate** (`e7f94efe`) is the same tree with only the tools lane's 8 `lyric_harness.py` lines reverse-applied. Both trees carry the H1 and P-A fixes.

**Results: VERDICT PASS** (`SUMMARY.txt`)

| Check | Result |
|---|---|
| build | the committed `codex.html` `d7010cb8…` equals a fresh build |
| H1 probe | 14/14 |
| P-A probe | 162 cases: 93 SAME_WORD, 69 REFUSED, 0 failures |
| unchanged fields | 18 runs; no field other than `schema_instance_evidence` moved |
| page suite | 809 assertions |
| viewport | 30 of 30 |
| gate | 37 of 37 |
| natural-timing resize | 40 of 40 |
| `test_lyrics_evidence.js` | pass |
| real key events, 5 reps | typing at 0/16/33 ms and after settle: 5/5 visible; ArrowRight 5/5; ArrowDown 5/5; PageDown 4/5; scroll away then type 0/5 (deliberate navigation, not revealed, as at `3ff4aff7`) |
| lint | ESLint and Prettier, 14 changed files |

**Not covered:**
- tools `9ab789f0`, which is newer than `b51438c8`;
- the writing PR #568, beyond what #569 already contains;
- CI;
- real devices, IME and assistive technology;
- the `finish` record site.

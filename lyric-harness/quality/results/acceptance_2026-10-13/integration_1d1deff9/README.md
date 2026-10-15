# Qualification of integration head `1d1deff9` (#569), 2026-10-15, 19:17–19:31 UTC

`probes/combined/qualify_combined.sh` was run on the exact head `1d1deff91993de7347fddebce6c18d3667c86b48`. **VERDICT PASS** (`SUMMARY.txt`).

The control tree for the unchanged-fields gate (`e2f48a8c`) is the same head with only the tools lane's 8 `lyric_harness.py` lines reverse-applied (`git diff 3ff4aff7e 61b84515e -- lyric-harness/lyric_harness.py | git apply -R`). Both trees therefore carry the merged H1 and P-A fixes. Lint was diffed against `origin/main` `f4b84158`.

| Check | Result |
|---|---|
| build | the committed `codex.html` `b05b30fb…` equals a fresh `--out` build |
| H1 probe | 14/14 |
| P-A probe | 162 cases: 93 SAME_WORD, 69 REFUSED, 0 failures |
| unchanged fields | 18 of 18 runs; no field other than `schema_instance_evidence` moved |
| page suite | 809 assertions |
| viewport | 30 of 30, no errors |
| gate | 37 of 37, no errors |
| natural-timing resize | 40 of 40, no errors |
| `test_lyrics_evidence.js` | pass |
| real `page.keyboard` events, 5 reps | type at 0/16/33 ms and after settle 5/5 visible; ArrowRight 5/5; ArrowDown 4/5; PageDown 4/5; scroll away then type 0/5 (deliberate navigation, not revealed, as at `3ff4aff7`) |
| lint | ESLint and Prettier, 25 changed files |

**Not covered:**
- CI. Two reds are expected on this head: the `verify` NOT_SHIPPED list, and `test_reader.py` LegacyReplay.
- The full Python and Node suites.
- Real devices, IME and assistive technology.
- The live site.
- The `finish` record site.

**Earlier head `25a3b20d`:** the run died with a container disconnect at about 18:32, after build, H1, P-A and 12 of 18 unchanged-fields runs had passed. It's not a qualification, and nothing here carries back to it.

# Qualification of release candidate `f8093986` (#569, minified payload), 2026-10-15, 20:56–21:10 UTC

This was `probes/combined/qualify_combined.sh` on the exact head `f8093986db0eeaf7cac6e3745f8cbd019022a846`, with every output in its own folder. **VERDICT PASS.** It was a single run: the #571 tests were paused (SIGSTOP) for its whole length.

From `1135f7df`, this head changes only the minifier (`scripts/_minify.js`, `check_minified_equivalence.js`, the new `check_runtime_minify.js`) and the generated `codex.html`. `src/`, `mcp/` and `lyric-harness/` are byte-identical. **Every browser check below ran against the committed minified artifact.**

The control (`4e259883`) is the same head without the evidence-sibling hunks in `lyric_harness.py`.

| Check | Result |
|---|---|
| build | `codex.html` `94dbde6a…` = fresh `--out` build, matching 3PO's posted hash |
| H1 probe | 14/14 |
| P-A probe | 162 cases, 0 failures |
| unchanged fields (v2) | 18/18 |
| page suite | 809 |
| viewport / gate / natural-timing | 30/30, 37/37, 40/40, no errors |
| `test_lyrics_evidence.js` | pass |
| real keys, 5 reps | type 0/16/33/settle and ArrowRight 5/5 visible; ArrowDown 2/5, PageDown 4/5, scroll-away 0/5 (deliberate navigation) |
| lint | 28 changed files |

**Carried over from `be96c359`** (harness unchanged): v1 records frozen; LegacyReplay 18 OK.

**Not covered:**
- CI;
- devices, IME and assistive technology;
- the live site.

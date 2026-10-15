# Diff-scoped recheck of release candidate `be96c359` (#569), 2026-10-15, 19:38–19:46 UTC

**Scope.** From `1d1deff9` (fully qualified, `../integration_1d1deff9/`) to `be96c359`:
- `lyric_harness.py` now emits `schema_instance_evidence` only under the v2 reader;
- `test_reader.py`, `mcp/test.mjs`, `package.json` and `scripts/check_lyrics_readable_lines.js` changed;
- receipts were added;
- `src/` and `codex.html` are unchanged.

The page suite, viewport, gate, natural-timing and real-key results therefore carry over from `1d1deff9`.

**Control tree** (`b851a1b0`): `be96c359` with `lyric_harness.py` replaced by the `1d1deff9` control's copy, which has no evidence sibling. The diff between the two harness files is exactly the sibling hunks.

| Check | Result |
|---|---|
| build | the committed `codex.html` `b05b30fb…` equals a fresh `--out` build |
| H1 probe | 14/14 |
| P-A probe | 162 cases, 0 failures (93 SAME_WORD, 69 REFUSED) |
| unchanged fields (v2) | 18/18; nothing but the sibling moved |
| v1 reader record (`--reader-scheme=v1 brief`) | byte-identical to the control, with no sibling |
| `test_reader` LegacyReplay + V1Frozen at `be96c359` | 18 tests OK (288 s) |
| red control: LegacyReplay at `1d1deff9` | **FAILED, 3 failures** (14 tests), as reported |

**Not covered:**
- CI;
- the full suites;
- real devices, IME and assistive technology;
- the live site.

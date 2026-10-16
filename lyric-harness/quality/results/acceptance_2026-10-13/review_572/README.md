# Independent pass on #572 (M-25 residue: editor's-notes cleanup and song-length yardstick re-measure). IN PROGRESS.

Most runs were at `90d6de13`. The later heads `08c95c83` (one `map/files.md` line) and `3045a1cd` (one `mcp/qualify_reader.mjs` assertion, 25525 → 25512) change nothing those runs exercise. The map check was rerun on a clean `3045a1cd`. The base is main `5ad10a62`. The verdict will be posted on #572. **The cold length-curve check is still running.**

**#572 now conflicts with main `6eaa8e4c`** (#569 merged), in the generated `lyric-harness/map/files.md` only. Its pull_request CI has not run on the last two heads. This pass covers the **pre-merge** tree.

Results so far: `gates/SUMMARY.txt`, the `*.tail.txt` files and the scripts here (`gates.sh`, `recapture.py`).

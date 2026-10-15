# #562 standalone qualification at `95d41ce6`, 2026-10-15, 20:19–20:26 UTC

**Why it was rerun:** the main merge `e757fe72` brought P-A (`src/pages/lyrics.js`), H1, #561 and the importer into #562. `codex.html` moved from `9683457f…` (my `3ff4aff7` pass, `../rev5/`) to `fff0bf2f…`. #562 ships without the writing and tools lanes, so the #569 runs don't cover this tree.

This was `probes/combined/qualify_combined.sh` on the exact head, with no control tree (#562 has no tools lane). **VERDICT PASS.**

| Check | Result |
|---|---|
| build | `codex.html` `fff0bf2f…` = fresh `--out` build |
| H1 probe | 14/14 |
| P-A probe | 162 cases, 0 failures |
| page suite | 795 |
| viewport / gate / natural-timing | 30/30, 37/37, 40/40, no errors |
| real keys, 5 reps | type 0/16/33/settle and ArrowRight 5/5 visible; ArrowDown 2/5, PageDown 0/5, scroll-away 0/5 (deliberate navigation, as before) |
| lint | 6 changed files |
| unchanged fields, evidence tests | skipped: not in this tree |

**Not covered:**
- CI;
- devices, IME and assistive technology;
- the live site.

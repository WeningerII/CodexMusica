# Pending-review gate correction receipt

Baseline is published head1b819d587's saved bundle `/tmp/ui-gate-correction/before.html`, SHA256 `90431a928789ce879b9e719571ea450b5df21593b3f338e177be35306e99dd3f`. Corrected local bundle SHA256 `1b4f22cdf8cef0ba62c22a5dab0573a674195c7aa56ae7e1b8a349b8ced3643d`. Source implementation belongs to root; this worker owns `scripts/check_lyrics_gate.js` only.

## Reproduction

From `/workspace/musica-ui-three`:

```sh
NODE_PATH=/workspace/musica-repair/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/musica-browsers TEST_HTML=/tmp/ui-gate-correction/before.html TEST_EVIDENCE=/tmp/ui-gate-correction/red node scripts/check_lyrics_gate.js
NODE_PATH=/workspace/musica-repair/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/musica-browsers TEST_EVIDENCE=/tmp/ui-gate-correction/green node scripts/check_lyrics_gate.js
```

Final identical-script receipts: `red19.log`/`red19/results.json` (19 cases, 26 failed assertions), `green19.log`/`green19/results.json` (19 cases, zero failures). `apply-baseline/results.json` separately confirms pre-existing Apply selection behavior. Earlier red17/green17 receipts are superseded. Running baseline intentionally exits1. Final script SHA256 `ceb74851379598c4cd12220c6e0e2ee3cb788993a35602a8f83ff57b67aa58f6`.

## Outcomes

The final19-case baseline failed 26 assertions (two immediate warning/button checks for each short-height case, plus two desktop opener checks): all12 short-height gates (390×508/600, touch/keyboard, Apply/Saved/Cancel) were not immediately visible/hittable; desktop Tools-header Cancel lost the actual opener under mouse and keyboard. Offscreen baseline actions were not rescued by scrolling and were not exercised.

Final19 cases pass: warning fully within viewport above bottom navigation, all three buttons visible/hittable immediately after opening, Apply all focused, opening preserves draft/selection/tab/pending state. Actual Apply all applies6/8, clears pending and sends that committed document; Review saved version retains pending, sends unchanged saved document and preserves selected lyric; Cancel sends nothing and preserves draft/selection/tab/pending state, restoring a visible actual opener. Desktop default Tools/header mouse and keyboard plus desktop Review-panel control are covered.

Normal390×844 and1180×757 button and full warning geometries equal baseline in all seven matching cases. See `summary.json`.

## Existing selection limit

Apply all uses the existing form commit path, which collapses selection[30,35] (`quiet`) to draft end[1015,1015]. This is independently reproduced in the saved baseline at390×844 and1180×757, and unchanged in final. This gate correction does not promise generic Apply-all selection preservation. Opening, Cancel and Review saved version preserve selection in these tests.

## Limits and isolation

All traffic is intercepted: local files served, MCP responses fixture-only, everything else aborted. No provider calls. A deterministic40-line fixture is used. Mouse wheel reaches the opener before opening; no scrolling is used to make gate actions pass after opening. Touchscreen taps and viewport sizes are emulation, not real mobile keyboards/finger drags, native zoom, or assistive technology. Screenshots accompany each gate case. Lint/Prettier checked. No commit or external write by this worker.

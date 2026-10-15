# UI-three focused receipt

Test: `scripts/check_lyrics_viewport.js`, SHA256 `d83de609a37359e00a7cec75d9bf4e6d9f52b5aa1e4ea9c674623537df3dfb6a`.

Baseline: preserved `/workspace/musica-ui-eight`, bundle SHA256 `37ff79578415f3a2bf2d92bc882421ecaff2bab2c8e754d4230728388e78786d`.
Final: `/workspace/musica-ui-three`, bundle SHA256 `90431a928789ce879b9e719571ea450b5df21593b3f338e177be35306e99dd3f`.
No commits or publication performed by this worker.

## Commands

Run from `/workspace/musica-ui-three`:

```sh
NODE_PATH=/workspace/musica-repair/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/musica-browsers TEST_ROOT=/workspace/musica-ui-eight TEST_EVIDENCE=/tmp/ui-three-evidence/red-final node scripts/check_lyrics_viewport.js
NODE_PATH=/workspace/musica-repair/node_modules PLAYWRIGHT_BROWSERS_PATH=/tmp/musica-browsers TEST_EVIDENCE=/tmp/ui-three-evidence/green-center node scripts/check_lyrics_viewport.js
```

The first command exits 1 intentionally; the second exits 0. Logs: `red-final.log`, `green-center.log`. Full geometry/requests/results and screenshots are in their corresponding directories. `focused-summary.json` contains compact comparisons.

## Results

15 cases: six keyboard-rise paths (lines 1/9/30, set+focus and touchscreen tap), one visualViewport-only scale-1 shrink, four negative guards (scale2, queued scale1→2, unfocused, queued blur), four gate paths (390×508 wheel+tap and Tab, 390×844 Tab, 1180×757 Tab).

Baseline has 18 failed assertions: all six rise and subsequent typing checks, visualViewport-only positive, four same-panel focus checks, and one restored opener hit-test. Final has zero failures. Every case verifies zero chat POSTs. Gate tests retain Review, pending change, and document text. Final visualViewport-only shrink bounds the row to height508 (not innerHeight844), moves scroll, retains editor focus and unchanged text.

All six complete initial844 geometry objects are equal between baseline and final, including line dock bounds. The fixture's line30 set+focus row574.90625–603.703125 overlaps dock603–716 by0.703125px on BOTH trees. This unchanged limitation is explicitly recorded, not treated as a new failure or fixed here. Other five initial paths are clear. Surface padding remains0.

## Scope and limitations

The earlier H1 fix already makes Cancel reachable by wheel and Tab in this fixture. Its gate may start above the visible area, so wheel direction follows measured position. The probe never uses programmatic scrolling to claim a wheel route. Redundant new surface scrolling CSS was removed; the remaining gate repair restores and reveals the same Review-panel opener. Nearest alignment failed the short keyboard path; center alignment passed.

The original fixture.js was unavailable; this is a deterministic40-line fixture. Geometry is not claimed identical to historical comments. Viewport resize emulates keyboard rise; visualViewport scale/height is stubbed. Touchscreen tap and mouse wheel do not prove real finger drag, physical keyboard/IME, actual pinch, true browser zoom, or assistive technology. All network requests are locally fulfilled or aborted; no provider is called.

Intermediate `red`, `red40`, `green40`, and `green-final` directories/logs are preserved but superseded. `green-final` used nearest alignment and intentionally exposed the short-height opener obstruction; only `green-center` is final acceptance. Early red30 also exposed fixture-end setup limitations. Prior full-gate evidence is owned by root, not substituted for this focused receipt.

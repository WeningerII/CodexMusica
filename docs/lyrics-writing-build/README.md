# Writing component handoff

Based on #562 `3ff4aff7eed653d62d346ecfca186c5899f8cd78`; frozen plan: [#553 comment 6197181134](https://github.com/WeningerII/CodexMusica/pull/553#issuecomment-6197181134). This is a component, not the finished integrated redesign.

Implemented in `src/pages/lyrics.js`:

- Empty document: Write myself / Write with the writer / Import lyrics, using existing actions.
- Declared scheme visible by default. Labels continue A…Z/AA; overlapping memberships survive. Only two existing word tints; gutter labels carry identity without a tint. Proposed selections remain labelled proposed, never measured.
- Exact UTF-16 range consumers and editor overlay spans; no word search, new tokenization, requests or candidate-to-evidence inference.
- `lyWritingLineActions(n)` supplies Rhythm / Pronunciation / Undo / Redo using existing handlers.

## Integration API

Tools validates source identity, freshness, reader, voices, declarations and pair capabilities **before** calling these hooks. The hooks add raw-text and grapheme-boundary checks; they cannot certify evidence.

```js
const parts = [{ start: 123, end: 128, text: 'night' }]; // full raw draft, half-open UTF-16
lySetWritingRangeMarks({
  text: exactRawDraft,
  occurrences: [{ id: 'opaque-source-occurrence-id', parts, canPaint: true }],
});
lySetWritingRangeMarks(null); // end inspection / invalidate source binding
const origin = lyCaptureWritingOrigin();
lyGoToRangeParts({ text: exactRawDraft, parts, canGo: true }, partIndex);
lyRestoreWritingOrigin(origin);
```

All mutating hooks return `{ok, reason?}`. `lyPrepareRangeMarks(text, view)` additionally returns nonoverlapping `segments` with **all** occurrence IDs and `rejected` reasons. Partial placement is not a completeness claim. Duplicate occurrence IDs reject the whole view. IDs are carried escaped in `.ly-relation-mark[data-occurrences]` as JSON; these spans intentionally add no verdict/type/color styling. The evidence adapter supplies that mapping through the integration owner's CSS/rendering.

Go requires an explicit part index when an occurrence is discontinuous (`choose-part`); it never selects unrelated gaps. Go/Return refuse stale raw text or an active modal/hidden editor without changing focus, selection or scroll. The navigation owner must first reveal Song and close the modal. Return restores the original selection direction and ancestor/window scroll. A refused Return needs the agreed explanatory UI and **Stay here** option; do not silently ignore the reason. Close and Back do not call Return. Clear marks when evidence identity becomes invalid, even if raw text did not change.

## Separate shared patch

`shared-dock.patch` is **not applied** to this branch. It replaces the floating linebar with one existing dock, mounts the Line actions helper, opens its menu upward, and refreshes every Undo/Redo button. It is for 3PO to combine serially with the actual Relations control and inspection row. It is not a finished Relations dock. Apply after the component commit using `git apply docs/lyrics-writing-build/shared-dock.patch` and rebuild. Writer/composer and shared shell/CSS remain 3PO-owned; this component does not claim to fix Send reachability.

## Verification and evidence

Build: `node scripts/build_html.js --out=codex.html --check --quiet`. Generated output is intentionally left to the integration owner, not committed here.

- `node scripts/check_lyrics_writing.js`: 87 checks, desktop 1180×757 light and phone 390×844 light/dark. Covers exact repeated-word targets, discontinuous/overlapping parts, invalid Unicode boundaries, stale text, modal focus protection, origin restoration, overlay text fidelity, header-only invalidation and family IDs.
- With the separate patch applied: `TEST_SHARED_DOCK=1 node scripts/check_lyrics_writing.js` also checks menu bounds and actual Undo/Redo history. Initial patch run: 75 checks before the extra overlay checks were added.
- ESLint and Prettier pass on changed source and test.
- All browser evidence is local Chromium emulation with remote traffic blocked. No non-GET requests were attempted. Native keyboard/IME/touch/assistive technology is unverified.

Screenshots: [primary phone start](phone-start.png); [patch-applied phone Line actions, light](phone-line-actions-light.png); [patch-applied phone Line actions, dark](phone-line-actions-dark.png). These show the component/patch at the stated stage, not the final integrated geometry. Receipts: `writing-results.json` and `dock-results.json`.

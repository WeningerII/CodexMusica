# Lyrics evidence component integration

This component belongs to the existing Lyrics page. Base: #562 `3ff4aff7eed653d62d346ecfca186c5899f8cd78`. Shared shell/receive/navigation and generated HTML belong to 3PO; writing hooks belong to #568. No P-A symbols are changed here.

## Load and receive

Load `src/pages/lyrics-evidence.js` after `src/pages/lyrics.js` as a runtime block in `scripts/build_html.js`, then rebuild. The component calls existing `lySha256`; loading it performs no inspection or requests.

At the end of `lyReceive`, select the latest tool with `schema_instance_evidence` version 1. Preserve that exact envelope and its request ID with the run. Do not reuse a prior run's envelope when none was returned. Establish a binding only when the existing `matches` check proved the request baseline. Select `asked` or `resultModel` by equality of their full ordered sung-line array to `evidence.source_text.split('\n')`; do not search for matching words. Then:

```js
const binding = lyRelationBindReport(evidence, {
  model: matchedSourceModel,
  requestId: request.request_id,
  semanticId: lyIdentity(matchedSourceModel),
  readerScheme: LY_READING_CUT,
  voices: matchedSourceModel.voices,
});
```

If neither model matches, retain the evidence with a null binding. The report has its own immutable identity. `lyRelationBindReport` uses known row ordinals and trim offsets, verifies every sung line, and returns null if the source cannot be projected. It never binds candidate options or declared groups as measurements. The result model is a basis only for the version actually measured; edits since then do not rebind it.

## Refresh

After `LY.model` updates, before rendering the inspector:

```js
const view = lyRelationEvidenceView(evidence, {
  requestId: storedRequestId,
  document: { semanticId: lyIdentity(LY.model), text: LY.model.text,
    readerScheme: LY_READING_CUT, voices: LY.model.voices },
  binding,
  declarations: [],       // independently labelled declaration records, if used
  candidateOptions: [],  // independently labelled candidate options, if used
});
lySetWritingRangeMarks(lyRelationWritingMarks(view, session));
```

`RelationEvidenceView.occurrences` is an ID-keyed object. `lyRelationWritingMarks` converts only the selected pair into #568's `{text, occurrences:[{id,parts,canPaint}]}` shape, or returns null. Always call it on invalidation, even when raw text is unchanged. Each part is `{start,end,text}` in full-editor half-open UTF-16 coordinates. Stale/unknown identities, source-map failures, row precision, missing records and invalid boundaries cannot enable navigation. Original report coordinates remain inspectable separately.

## Explicit dock and actions

`lyRelationDockMarkup(view, session)` renders either **Relations**, or the source label plus **Back to relations** / **Return to editing**. Mount it in the one shared reserved context row; do not create a second bar.

On `ly-relations`, capture `lyCaptureWritingOrigin()` before moving focus. `lyRelationOccurrenceChoices(view, {start,end})` returns the actual validated occurrences intersecting that selection. When several are returned, offer those explicit choices; do not choose the first automatically. Pass the selected ID as `sourceOccurrence` below. With no valid occurrence, the complete document evidence list can still disclose unavailable/stale/partial coverage without claiming an occurrence-specific result.

```js
session = lyRelationSessionOpen(view, origin, actualPreviousPanel, sourceOccurrence);
```

`actualPreviousPanel` is opaque integration state containing panel/focus/scroll, including History's Writer nesting; use null when there was no prior panel. The list renderer is `lyRelationInspectorMarkup(view, session)`.

| `data-ui` | Action |
| --- | --- |
| `ly-relation-go` | Read `data-pair`, `data-side`, integer `data-part`; call `lyRelationSessionSelect`, close modal/reveal Song, then `lyRelationSessionGo(session, freshView, {go: lyGoToRangeParts})`. |
| `ly-relation-close` / Escape | `lyRelationSessionClose(session)`; dismiss list, retain armed session and current location. |
| `ly-relation-reopen` | `lyRelationSessionReopen(session)`; reopen the same source/list without recapturing origin. |
| `ly-relation-return` | Close modal/reveal Song, then `lyRelationSessionReturn(session, {restore: lyRestoreWritingOrigin})`. On refusal show `session.reason` and Stay here, retaining current edits/selection/scroll. |
| `ly-relation-stay` | `lyRelationSessionStay(session)`; end inspection and clear marks, no editor mutation. |
| `ly-relation-back` | `lyRelationSessionBack(session, {back: restoreActualPanel})`; restore that panel/focus/scroll without focusing the editor. Success ends inspection. |

All transitions return the next session; assign it and rerender. Go preserves the original origin across jumps. Discontinuous parts always have their own explicit Go action and part index. The writing hook rechecks grapheme boundaries and editor/modal availability. No action dispatches a writer request. `lyShowTab` remains integration-owned: preserve tool values and unsent input, close modals before background focus, and never invent a previous panel.

## Report population and limits

The producer recomputes existing pair-local registry instances using the whole-vocabulary grade's input stream construction, phonology and declared frames. The report is not mandate satisfaction. Whole-figure assembly and alternative-reading witness searches are explicitly outside this first bounded population. It retains true/undecided instance records, counts false instances, names refused schemas, and reports record/byte/candidate limits. Completeness refers only to the declared executed population; missing/refused/limited data is never certified as all pairs. Candidate-word options retain their existing separate 66-row contract.

This is a component handoff, not a claim that the integrated page is complete. Final shared wiring, modal/dock geometry, complete Lyrics gate, build parity and independent reviews belong on the combined source head.

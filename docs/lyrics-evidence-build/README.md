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
  readerScheme: LY_TOKEN_SCHEME,
  voices: matchedSourceModel.voices,
  submittedContext: request.submittedContext,
});
```

**Declaration proof is required and now produced on the existing authenticated path.** Keep an immutable JSON snapshot of the exact submitted `lyric_context` beside `UI.lyricRequest` as `submittedContext` (with the existing ID, revision and raw text). Pass that snapshot to `lyRelationBindReport`; do not manufacture a receipt or copy report hashes. A continuation without a provable retained submitted context stays unknown.

For `lyric_check`, after normalizing its input and applying the existing lexicon basis, the tool wrapper associates the actual invocation arguments with the authenticated Python `graded/brief` result only if its final sung lines equal the invocation lines and the evidence source exactly. The new nested `invocation` records those lines, every declaration argument (voices explicitly boolean), the separate engine lexicon basis, reader scheme and report/declaration hashes. No internal mandate/comparator/phonology translation occurs.

The existing `/chat` projection compares that invocation with the authenticated task's `lyric_context`: the complete context document is projected using the existing `mcp/lyric_text.js` sung-row convention, its ordered sung source must exactly equal the authenticated invocation/report source, and all declaration fields must match (only omitted voices maps to the tool's existing false default). It also verifies report hashes, reader/voices and lexicon provenance. Only then does it emit `request_binding` containing the exact task context, measured identities and explicit `source_projection`. It discards any pre-existing request binding before this check.

The adapter independently compares the server binding's context with `submittedContext`, then verifies its document against `lyWriterText(model.text)`, declarations against `lyDeclarationsOf(model)`, and `binding.document_sha256` against the matched model's semantic ID. Equality sorts object keys recursively; array order, string bytes, numbers and embedded JSON strings are preserved. There is no equivalence inference. Server context normalization that differs from the submitted snapshot fails closed.

**Positive scope:** unchanged `lyric_check` source and exact tool declarations representable by the existing frontend declaration serializer. Real local Python → authenticated MCP → agent → `/chat` → actual frontend-parser tests prove plain and sectioned-page paths without modified report metadata, including blank rows, repeated words and Unicode offsets. **Unknown scope:** blueprint/declaration transformations that cannot be compared exactly, extra/missing declarations, tool-edited or final `lyric_revise` drafts, or unproved continuation context. These require an additional exact mapping and are not certified by sung-text equality. Their evidence remains inspectable; Go/paint stay disabled. No new endpoint, checkpoint field, grading semantics or dictionary change is introduced.

### Ordinal projection contract

`request_binding.source_projection` is `{version:1, convention:"lyric_text/sung-rows-v1", document_sha256, source_text, rows}`. `document_sha256` hashes the exact full `context.document` UTF-8 bytes, not the semantic ID. Every row appears once in order as `{row, kind, start, end}`; kinds are `sung`, `blank`, or `section` (the existing whole-line bracket convention, including stamps). Sung rows additionally carry `{source_start, source_end, text_start, text_end}`. All offsets are half-open UTF-16: source offsets address the graded joined sung text, and text offsets address context.document. Trimmed whitespace is accounted for by the full row bounds.

The server uses the same sung-row predicate as existing tool normalization, retaining all structural exclusions. The frontend independently rebuilds the complete projection using `lyParse(context.document)` and requires exact equality, including its document hash. The existing ordinal sung-row map then projects into full editor text, including stored SETUP rows absent from writer context. No spelling search or arbitrary omitted content is accepted. A malformed bracket or an inline bracket remains sung and cannot be silently excluded. Ordinary headers and blank rows are supported as explicit structural exclusions; the receipt does not claim those excluded headers were graded as obligations. Actual invocation declaration fields still must match exactly.

`LY_TOKEN_SCHEME` is the producer-compatible value `v2`; `LY_READING_CUT` is presentation text `cut v2` and must not be used.

If neither model matches, retain the evidence with a null binding. The report has its own immutable identity. `lyRelationBindReport` uses known row ordinals and trim offsets, verifies every sung line, and returns null if the source cannot be projected. It never binds candidate options or declared groups as measurements. The result model is a basis only for the version actually measured; edits since then do not rebind it.

## Refresh

After `LY.model` updates, before rendering the inspector:

```js
const view = lyRelationEvidenceView(evidence, {
  requestId: storedRequestId,
  document: { semanticId: lyIdentity(LY.model), text: LY.model.text,
    readerScheme: LY_TOKEN_SCHEME, voices: LY.model.voices },
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
| `ly-relation-expand` | `lyRelationSessionExpand(session)`; show every delivered pair in the selected population; preserve this expansion across jumps and Close/reopen. |
| `ly-relation-close` / Escape | `lyRelationSessionClose(session)`; dismiss list, retain armed session and current location. |
| `ly-relation-reopen` | `lyRelationSessionReopen(session)`; reopen the same source/list without recapturing origin. |
| `ly-relation-return` | Close modal/reveal Song, then `lyRelationSessionReturn(session, {restore: lyRestoreWritingOrigin})`. On refusal show `session.reason` and Stay here, retaining current edits/selection/scroll. |
| `ly-relation-stay` | `lyRelationSessionStay(session)`; end inspection and clear marks, no editor mutation. |
| `ly-relation-back` | `lyRelationSessionBack(session, {back: restoreActualPanel})`; restore that panel/focus/scroll without focusing the editor. Success ends inspection. |

All transitions return the next session; assign it and rerender. Go preserves the original origin across jumps. Discontinuous parts always have their own explicit Go action and part index. The writing hook rechecks grapheme boundaries and editor/modal availability. No action dispatches a writer request. `lyShowTab` remains integration-owned: preserve tool values and unsent input, close modals before background focus, and never invent a previous panel.

## Report population and limits

The producer recomputes existing pair-local registry instances using the whole-vocabulary grade's input stream construction, phonology and declared frames. The report is not mandate satisfaction. Whole-figure assembly and alternative-reading witness searches are explicitly outside this first bounded population. It retains true/undecided instance records, counts false instances, names refused schemas, and reports record/byte/candidate limits. Completeness refers only to the declared executed population; missing/refused/limited data is never certified as all pairs. Candidate-word options retain their existing separate 66-row contract.

This is a component handoff, not a claim that the integrated page is complete. Final shared wiring, modal/dock geometry, complete Lyrics gate, build parity and independent reviews belong on the combined source head.

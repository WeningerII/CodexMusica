# Optional occurrence pronunciation readings

The ten numbered JSON files are keyed by the corresponding collection's candidate ID (for example, `../69378/candidates.json`). They contain 9,638 existing-API pronunciation declarations for 1,030 imported works, covering 2,809 folded spellings. Select the work using its preserved `[item: PG<number>-<candidate ID>]` title marker and its current catalog identity.

Across all 1,299 imports, the production tokenizer yields 192,587 sung token occurrences. Default lookup supports 179,707; explicitly selecting high-confidence fallback supplies another 2,200. Of the remaining 10,680 occurrences, these choices cover 10,342 (a declaration also applies to verbatim repeated lines). Another 338 occurrences remain without a selected reading. All 9,638 declarations concern words refused by both default and high-confidence lookup; none override an already-supported reading. Low-confidence spelling guesses are not counted as established coverage. See `coverage.json` for collection counts.

The 2026-10-09 completion pass reviewed all 3,299 previously uncovered occurrences across 1,419 folded spellings in their lyric contexts. It added 2,665 declarations covering 2,961 occurrences, using familiar language knowledge rather than a broad research pass. Context-specific readings distinguish Roman IV from dialect iv and the nickname Cud from modal cud. The 338 remaining occurrences span 178 spellings (175 have no prepared reading anywhere). They include censored or split fragments such as `mn`, `dle` and `orthumbria’s`; unfamiliar names such as `Nqsha’s` and `Jottrat`; unresolved regional forms such as `gyen` and `poweyin`; ambiguous vocables such as `he-he-heira`; and apparent textual anomalies such as `Fluttersd`. These were reviewed and left unresolved, not silently converted to standard-English words. The earlier supplement already held some ambiguous contexts, but did not document an exhaustive individual review of its remainder.

These counts measure available analysis coverage, not valid versus invalid language. Source spellings remain intact. Historical orthography, caricature, local variation, and nonsense do not establish one authentic pronunciation. The `source` field therefore records the import preparer's selected performance reading, not dictionary or historical attestation. Multiple-choice and unresolved contexts were not silently collapsed to fill gaps.

These are optional, preparer-selected performance readings for exact imported occurrences. They are not claims of authentic historical dialect pronunciation and are applied only to their source-bound Library readings unless a caller supplies an explicit pronunciation set. Existing dictionary readings remain unchanged.

Select the JSON value for the candidate ID of the work being analyzed, then pass that object as `declaration_set` in the existing reader request:

```js
const declaration_set = collectionReadings[candidateId];
const request = {
  contract_version: 1,
  snapshot_id: currentSnapshotId,
  reading_unit_id: currentReadingUnitId,
  reading_revision: currentReadingRevision,
  declaration_set,
  requested_layers: ['sound', 'form', 'rhythm', 'language'],
};
```

Submit through the existing authenticated `POST /internal/reader/jobs` protocol. Use the current registered reading identity; do not submit an entire collection wrapper or reuse declarations for edited text. The server verifies each line/token/word and stressed ARPABET reading. Declaration changes have a distinct analysis identity. The existing native Python entry point accepts the same object: `AnalysisSession(registered_reading, declaration_set, requested={'layers': ['sound']})`.

The optional existing `declaration_set.phonology = {fallback: 'high'}` enables supported dictionary-derived morphology and standard poetic elisions. This is an explicit analysis assumption; it does not enable a historical dialect profile. Do not add an alias merely because a contextual draft uses the same phones as a standard word.

The reader backend supplies these defaults before computing a new analysis identity.
`bindings.json` pins each selected work to its complete reading ID, revision and
source hash. The resolver also verifies every packaged asset's byte hash and
requires each declared line to be present. Changed bindings or text are rejected
as stale; missing, corrupt or unapproved assets make the affected request
unavailable. Older collections and retained snapshots keep their existing behavior.

An explicit `declaration_set.pronunciations` field is the caller's complete set:
`[]` opts out, and a nonempty array replaces the defaults rather than merging
with them. Other declarations are preserved; an explicit non-English language
choice also prevents these English defaults. Resuming a job uses its stored
choices. The Library's **Reading interpretations** controls and declarations
JSON editor can supply these explicit choices through the existing request API.

The ten collection files and binding index are approved, byte-pinned assets in
the existing [runtime asset manifest](../../../data/runtime_assets.json), so the
release assembler packages them. No shared dictionary, fallback policy or
grade-selection rule changes.

Shared dictionary changes are a separate option with broader effects. Inspection
found no actionable spelling-alias additions: the existing alias mechanism only
extends headwords already in its dictionary population. Twenty-two standard
poetic-elision candidates fit the existing table format, affecting 47 occurrences;
only ten (24 occurrences) match the prepared choices. They were not adopted:
table changes would apply across every high-fallback caller, and the table
explicitly excludes dialect mappings. Remaining uncertainty is not resolved by
silently assigning a standard-English homophone.

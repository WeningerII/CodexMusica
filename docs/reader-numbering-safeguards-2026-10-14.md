# Caller-held numbering safeguards

Implementation base: `5e97e06fd0fbf6c08cd2b196cb3a29f06606bf2e`.

The approved contract is the [combined declaration design](https://github.com/WeningerII/CodexMusica/pull/527#issuecomment-6148531804),
including its [seven regression requirements](https://github.com/WeningerII/CodexMusica/pull/527#issuecomment-6148492945),
[owner approval relay](https://github.com/WeningerII/CodexMusica/pull/519#issuecomment-6148581324),
and the later [numbered groups/returns extension](https://github.com/WeningerII/CodexMusica/pull/519#issuecomment-6155211950).
The extension is bounded by [section B of the proposal](https://github.com/WeningerII/CodexMusica/pull/519#issuecomment-6155002227).

The numbering marker identifies reader scheme and voices: `v1`, `v1+voices`,
`v2`, or `v2+voices`. The values without `+voices` strip parenthetical asides.
A pronunciation carries its own marker; numbered groups/returns use the call's
marker. Named places keep their existing meanings.

For fresh v2 work, an unmarked pronunciation valid under both reader cuts but
at different raw pieces must refuse. Valid only under v1 rebinds to identical raw
pieces with a notice, or refuses if no whole target token exists. Valid only
under v2, or at identical pieces under both, keeps its existing interpretation.
Neither matching refuses. Both unmarked interpretations use the requested voices
setting: the existing unmarked-voices limitation is deliberately preserved.
Marked input derives raw pieces from its declared scheme and voices, then binds
only the identical occurrence in the run's coordinate. Callers supply no offsets.

Normalize newly submitted lyric input. A cached run or verified signed interview
state accepts its exact returned normalized declaration as an alias, restoring
original arguments before worker identity checks. Groups, returns and their
marker form one atomic tuple. Standalone kitchen checkpoints without a verified
normalized receipt still require original declarations or omission: broader
normalized checkpoint resubmission remains a limitation, not a claimed pass.
Aliases that would exceed the existing combined 32 KiB declaration receipt
allowance are omitted with `numbering_alias_unavailable`; original replay stays
usable. The worker journal capacity and all limits are unchanged.
Preserve pre-batch v1 rows and fingerprints. Options and actual
first-party producers retain the numbering of their originating evidence;
a generic client must not stamp a guessed marker onto held unmarked data.

This work does not implement the separately proposed old/new Library page,
`declaration_set`, evidence or queued-job compatibility extensions. Library's
existing validation boundary is retained. No tokenizer, grading, fallback,
contract-version or deployment-policy change is part of this contract.

The historical “at most one continuation” instruction is a separate interface
exercise budget. It is not a production completion cap and causes no runtime
limit change here. Merge coordination remains with the parent; deployment is
not authorized.

Validation uses local data and fixture replies; none is live-service acceptance.
The before/after probe loads `quality/pronunciation.py` from the implementation
base and compares it with this change: unmarked token 2 `oh` in
`Oh--oh, oh my love` was accepted although v1 names raw pieces `(8,10)` and v2
names `(4,6)`. It now refuses with both interpretations. Marking that same row
`v1` returns token 3 marked `v2`, preserving `(8,10)` with a migration notice.

The generated regression matrix covers six separators, repeated words and
parenthetical arrangements, all four source and target coordinates, exact
raw-piece matches, split/removed targets and normalized resends. Additional
controls retain unchanged six-field rows, frozen v1 behavior, retired readings,
and Library's strict six-field boundary.

Local integration checks:

- `node scripts/check_lyrics_page.js`: 651 assertions, including browser paths.
- `node --test mcp/test_pronunciation_choices.mjs`: 8 passing tests, including
  real local harness calls, original then normalized resends, cache/worker loss,
  signed-state recovery, and changed-phones/member/mixed-marker/unsealed refusals.
- `node --test mcp/test_lyric_workflow.mjs mcp/test_verdict_view.mjs`: 35 passing.
- `node --test scripts/test_lyric_tokens.js scripts/test_library_declarations.js`:
  13 passing.
- `python -m unittest quality.test_pronunciation_choices quality.test_source_identity`:
  41 passing tests (76.133 seconds).
- `node mcp/test_run_continuation.mjs`: real MCP/Python continuation checks pass,
  including immutable inputs, concurrency, stale revisions and capacity artifacts.
- `node mcp/test_state_codec.mjs`: codec and exact worker/metadata boundary
  checks pass; one extra metadata byte refuses.
- Comparator pin: measured unchanged
  `51316f79c5093fa1750fbcde04975ddf8444407e38d8d929d73dc0086ddac2f4`.
- Documented commands and paths, generated HTML, targeted JavaScript lint and
  schema/Gemini checks pass. Generated map and counters accompany the change.

The interpreter must have the repository's staged research data for the local
harness checks. A missing browser installation initially prevented browser
execution; using the already staged browser completed the full check above.

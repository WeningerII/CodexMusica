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

Normalize newly submitted lyric input and compare resubmissions only after
normalizing both original and supplied declarations with the private Python
`normalize-numbering` action. It uses the existing reader and pronunciation
validator without grading or provider calls. Cached runs, interview state and
standalone checkpoints use this same comparison; equal canonical declarations
restore original arguments before the unchanged worker identity check.
No normalized alias receipt or added metadata capacity is needed. Pre-batch v1
rows and fingerprints are never rewritten. Newly generated options carry their
actual source marker under all four coordinates; stored historical options are
not restamped. Lyrics, Gemini and the native client retain originating evidence.

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
- `node --test mcp/test_pronunciation_choices.mjs`: 9 passing tests, including
  real local harness calls, original then normalized resends, cache/worker loss,
  signed and replayed state, and changed-phones/member/mixed-marker refusals.
  A standalone kitchen checkpoint replay uses zero proposer calls and no extra
  localhost fixture requests. The 32 KiB original-declaration boundary also passes.
- `node --test mcp/test_lyric_workflow.mjs mcp/test_verdict_view.mjs`: 35 passing.
- `node --test scripts/test_lyric_tokens.js scripts/test_library_declarations.js`:
  13 passing.
- `python -m unittest quality.test_pronunciation_choices quality.test_source_identity quality.test_reader.V1Frozen`:
  47 passing tests (115.758 seconds).
- `node mcp/test_run_continuation.mjs`: real MCP/Python continuation checks pass,
  including immutable inputs, concurrency, stale revisions and capacity artifacts.
- `node mcp/test_state_codec.mjs`: existing codec and capacity checks pass.
- Comparator pin: measured unchanged
  `51316f79c5093fa1750fbcde04975ddf8444407e38d8d929d73dc0086ddac2f4`.
- Documented commands and paths, generated HTML, targeted JavaScript lint and
  schema/Gemini checks pass. Generated map and counters accompany the change.

The interpreter must have the repository's staged research data for the local
harness checks. A missing browser installation initially prevented browser
execution; using the already staged browser completed the full check above.

The follow-up closes the standalone checkpoint and metadata-capacity gaps in
initial commit `539931f5f0bd9fc437e402f299633959dde301f0`; exact returned aliases
were insufficient for the approved normalize-before-compare rule. That initial
head also completed the full reader suite: 105 tests, 99 passed and 6 skipped,
618.991 seconds. Fresh v1 option provenance was subsequently corrected; six
focused/private-normalization/frozen-v1 tests pass in 11.736 seconds. A real
CMUdict probe additionally returned `record` token 2 with `v1+voices` from
`(oh) record record`, then preserved the first physical `record` as v2 token 1
with voices off.

An independent native-client probe executed sweep, screen, plan, grade and
revise with local judges. Original v1 token 3 continued as the same run using
v2+voices token 4, a semantically equivalent marker never emitted verbatim.
Changed phones and a second same-spelled occurrence refused; original-source
resend then remained usable. No external provider calls occurred. The probe
source SHA256 is
`4a586d0e0d59a6c6d0c924e527520ab2e9597f86e6dff210e9294fb671243131`;
normalized continuation took 7.749 seconds. This is local interface evidence,
not live-service or lost-provider-response acceptance.

A subsequent review found that JSON serialization order is not structural
identity: an originally unmarked v1-only pronunciation acquired `numbering`
at the end of its canonical Python row, while the marked resend placed that
key first. The comparison now ignores object-key ordering while preserving
array order and every value. The standalone-checkpoint regression starts with
that unmarked v1-only row, verifies its migrated marker, and resends the marked
result after cache and worker loss. No declaration or fingerprint is rewritten.
Both real MCP cases failed before the structural-equality fix (0/2, 37.269s)
and passed afterward (2/2, 53.522s), with changed-phone and physical-occurrence
negative controls retained and no additional writer request during replay.

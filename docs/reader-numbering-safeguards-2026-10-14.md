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

Correction, 2026-10-15 (H1): as merged in `539931f5` the guard also reached the
server's own any-reading trial rows (`pronunciation.pin_readings`), so a
declared relation on a repeated multi-reading word at a position the v1 and v2
cuts number differently (`Read--read, read it again`, T2) was refused as
`SCHEME_UNREADABLE` under the `v2` supplement: a grading change, contrary to
the sentence above. The repair marks only those server-synthesized rows with
the lexicon's own numbering; caller rows are validated exactly as before, and
an unmarked caller row at a shifting position is still refused as ambiguous.

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

Cumulative CI then caught an integration omission: the normalization entrance
was dispatched but absent from `VERB_LAYERS` and help. Registering it as a
connector comparison command (no grading or proposing) fixes the command
census without exclusions. The exact failed census section passes, as do five
normalization/frozen-v1 tests (16.899s); generated maps remain current.

The next command-census check found the comparison entrance missing from the
shared execution fixture roster. The roster now invokes `normalize-numbering`
on a real draft with a token-position group and named-place returns. Section 7
also checks its exact canonical result, and section 47 requires it to answer
at exit 0 with all staged grading resources hidden. Both complete affected
sections pass: 18 assertions, all 35 dispatched verbs exercised in each resource
condition, no tracebacks, and the existing five-verb resource-refusal partition
unchanged. No command is excluded from a census. The other census sites are the
already-registered dispatch/map/help checks and `wiring`.

CI run 38664097864 at `1c1e62` passed all 10 high-report cases. Its revise
request took 16121.629805ms, leaving 43878.370195ms under the unchanged
60000ms request limit; the full high-report file took 161088.52024ms. The
verify job 116193948741 instead hit the separate 120000ms file limit in
`mcp/test_pronunciation_choices.mjs` at 120052.696145ms: the native case had
passed in 66479.970652ms and the capacity case in 2551.884998ms, while the
checkpoint case was still running. This evidence does not establish contention
as the cause.

The native and cacheless checkpoint cases now live in
`mcp/test_pronunciation_native.mjs` and
`mcp/test_pronunciation_checkpoint.mjs`. Their test bodies and assertions are
unchanged; the original file retains all seven schema/unit/capacity cases.
Both new files are registered in `test:production:offline`,
`test:pronunciations`, and the connector image census. No production behavior,
timeout, concurrency setting, or coverage changed.

Local sequential runs used `node --test --test-concurrency=1
--test-timeout=120000 FILE` with the staged local Python environment. Results:

| File | Passed | File duration (ms) |
| --- | ---: | ---: |
| `mcp/test_pronunciation_choices.mjs` | 7/7 | 1620.666404 |
| `mcp/test_pronunciation_native.mjs` | 1/1 | 44327.383915 |
| `mcp/test_pronunciation_checkpoint.mjs` | 1/1 | 32282.129232 |

The native test itself took 44122.699461ms and the checkpoint test
32196.263341ms. All nine original tests remain present, including changed
phones/physical occurrence refusal and cacheless replay without an additional
writer request. The kitchen writer is a localhost fixture, not live-service
acceptance evidence. Prettier, targeted ESLint, and `git diff --check` pass.
Exact-head CI after this test-only split remains pending.

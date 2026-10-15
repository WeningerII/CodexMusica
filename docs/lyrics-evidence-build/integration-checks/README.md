# Lyrics integration verification

The subsequent [main reconciliation receipt](main-merge/README.md) supersedes the
branch ancestry below and records fresh checks on the merged source. The generated
HTML and Lyrics implementation remain byte-identical.

Local checks pass for implementation/test commit
`40284863aa3efa971ac1db5ef878fcdde15b59b7` on [PR #569](https://github.com/WeningerII/CodexMusica/pull/569).
The tested Build 8 and committed `codex.html` have SHA-256
`ad8332b85263638c5da92b2c0401adad09da70e529720d81b37d4b5d155f19ad`.
An independent explicit-output rebuild is byte-identical. This receipt qualifies
the local combined page and the binding paths below; it does not claim CI,
external independent review, hosted-service acceptance, merge or deployment.
Machine-readable summary: [final-verification.json](final-verification.json).

## Component provenance

| Component | Input commit |
| --- | --- |
| H1 | `b5a274ad1ab385bcb0fb0bba0df84ccad1679e1b` |
| P-A | `26a2c76f2d39d5bd78ea09f5ba4961c92235749b` |
| Tools evidence/binding, before section repair | `c69731523a780b3e8cb0c67bc790638f7385a79f` |
| Tools ordinary-section projection repair | `9ab789f0b854675f4b99ce6898d7bd63b9c5506b` |

The [component handoff](../README.md) describes the binding contract.
[Historical verification](../verification.json), including its earlier P-A
reference, scratch hash and 754-assertion gate, retains its component scope.
Existing backend receipts remain preserved: [producer](producer.txt),
[adapter](adapter.txt), [chat](chat.txt), [pronunciation](pronunciation.txt),
[map](map.txt), [baseline fingerprint](baseline-fingerprint.json), and
[sample comparison](sample-comparison.json). The sample compares existing fields
and exit codes after excluding the new evidence field; it is not universal
input coverage or proof of the rendered page's authenticated transport.

## Final combined checks

| Check | Result and receipt |
| --- | --- |
| Full Lyrics page | [809 assertions PASS](final-page.txt), fixture replies, no provider |
| Writing | [90 PASS](final-writing.txt), desktop/phone and both themes; no non-GET requests |
| Shared controls | [13 cases PASS](final-shared.txt) |
| Inspector | [16 cases PASS](final-inspector.txt); [results](final-inspector-results.json) |
| Actual-page transport | [8 cases PASS](final-transport.txt); [per-case summary](transport/summary.json) |
| Viewport | [30 cases PASS](final-viewport.txt) |
| Natural editing/resize | [40 cases PASS](final-natural.txt) |
| Pending gate | [37 cases PASS](final-gate.txt) |
| Adapter | [12 PASS](final-adapter.txt) |
| Authenticated binding pipeline | [3 PASS](final-binding.txt) |
| Focused J3 | [10 assertions PASS](final-j3.txt) |
| Generated map | [Regenerated](final-map-build.txt); [check current](final-map-check.txt) |
| Bundle | [Explicit-output build PASS](final-build.txt); [independent build](final-independent-build.txt) byte-identical |

The actual-page transport uses ordinary Run review through local HTTP/chat,
authenticated MCP/Python and the page's receive/binding path. Only model tool
selection is stubbed. Positive reports are forwarded unchanged; one explicitly
labelled negative tampers with a projection. No provider calls occurred.

[Headerless](transport/headerless.json) and
[ordinary sectioned](transport/ordinary-sections.json) sources establish current
binding and enable Go with the exact submitted context. The server-generated
ordinal projection is validated by the actual page parser. The component API
still receives `submittedContext`; no locally fabricated proof substitutes for
authenticated request binding.

The [repeated-spelling/UTF-16 case](transport/sections-blanks-repeated-utf16-go.json)
includes section headers, internal blank rows, an astral header character and
repeated `cat`. Go selects the specified third part at UTF-16 offsets [49,52],
and the actual editor selection is `cat`.
[Tampered projection](transport/tampered-projection.json),
[changed groups](transport/changed-groups.json),
[changed readings](transport/changed-readings.json), and
[unsupported transformation](transport/unsupported-text-transformation.json)
correctly remain unknown with Go disabled.

## Limits and retained failures

The [line-edge whitespace case](transport/sections-whitespace-repeated-utf16.json)
is a passing **stale/refusal** check, not positive current-binding coverage.
`artifact.final_draft` strips line-edge spaces/tabs and the existing page applies
that result. Original bound bytes then differ from the current document even
though semantic IDs agree. Freshness remains truthfully stale and Go is disabled;
no identity comparison was weakened. The earlier intended-current expectation
failed and led to this measured distinction. Internal blank rows are covered by
the positive Go case; arbitrary normalization or transformed results are not.
Unproved continuation context remains unknown. Equality of sung lines alone does
not establish declaration identity or authorize navigation/painting.

Historical failures are retained:

- [Initial runtime failure](before-binding-runtime.txt): missing `nltk` caused a staged-resource refusal, exit 2. The pinned-runtime binding retry passed; the final pipeline passes three checks.
- [Before-section transport](before-section-transport.json): 4 PASS / 1 FAIL, ordinary sections unknown instead of current. The final ordinary-section receipt above closes this positive-path gap.
- [Before-menu check](before-menu.txt): 13 cases, one failure because Undo was not visible and hit-testable at 844 × 390. [Before](menu-before.json)/[after](menu-after.json) geometry and the final shared gate cover the repair.
- [Build 7 page gate](before-page7.txt): two unexpected J3 stale-suggestion failures. Final Build 8 passes both the full 809-assertion gate and focused J3. No contention cause is claimed.

The earlier Build 5 inspector's 15 passing fixture checks establish UI behavior
only; they are not authenticated binding proof. The final local transport receipts
supply that proof for their stated inputs, not every possible source or hosted run.

## Reproduction

Use the combined checkout's Node dependencies, Playwright Chromium and pinned
Python/staged harness resources. From the repository root:

```sh
node scripts/build_html.js --out=codex.html
node scripts/check_lyrics_page.js
node scripts/check_lyrics_inspection.js
node scripts/check_lyrics_inspection_transport.mjs
node --test --test-force-exit mcp/test_lyrics_evidence_binding.mjs
```

Set `CHROMIUM_PATH` to the installed browser and the Python/staged-data environment
to the pinned local runtime. Inspector scripts accept `TEST_HTML`, `TEST_ROOT`
and `TEST_EVIDENCE` to identify the bundle and receipt destination. No provider
credentials are required. The initial runtime failure above is preserved because
successful resource staging is a premise of the authenticated checks.

## CI formatting correction

The implementation-head PR run `38782485114`, job `116586026898`, failed
Prettier on ten archived writing-evidence JSON files. This receipt commit formats
those files and the new receipts; [verification](format-verification.txt) confirms
that every parsed JSON value is unchanged and the changed-file formatting checks
pass. The resulting remote CI run must be assessed separately; this is not a
claim that CI passed.

# Lyrics report fixes — 2026-09-22

Source: the owner-supplied `REPORT.md` reporting 243 findings against
`claude/epic-gates-qs16b4`. This batch was checked against main commit
`08adfcff`; it does not close the full report.

## Fixed in this batch

| Report ID | Defect and repair | Regression evidence |
| --- | --- | --- |
| C-1 / P9 | Ordinary lexical capability incorrectly supplied the missing slang surface, making a failed default rhyme undecidable. Require the separate declared slang surface. Missing slang input is an explicit schema capability refusal; it cannot contaminate ordinary pair judgments. | `test_production_relations.py`: missing-surface refusal, default negative pair, supplied-surface positive control. Public `scheme AA cat dog` now reports one violation, one judged pair and zero refused pairs. |
| O-1 | Creation admission rejected the documented `draft_text` form before the handler normalized it. Share normalization with the tool handler and bind receipts to those lines. Conflicting representations still refuse. | `test_lyric_workflow.mjs`; `test_session_repairs.mjs` executes native sweep, screen, plan and grade using `draft_text`. |
| B-1 | Recovery appended lyric state after the task and signed a field order different from the HTTP verifier. Rebuild the recovered envelope in the existing verifier order, preserving the signing format. | `test_chat_production.mjs` submits the recovered envelope and its durable receipt through HTTP; both reach the correct signed turn-limit response, instead of signature rejection. |
| G-2 | Brief provenance ignored the flat completed records actually written by the harness. Read flat and wrapped records, batch records and group members while retaining the draft fingerprint requirement. | `test_brief_provenance.py` covers completed single/group answers, pending batches and mismatched-draft negative controls. |
| M14 | Resending a subset of a retained mandate compared an incomplete key before carrying omitted fields. Use the existing explicit-declaration comparison, then carry omissions and derive the complete key. | `test_run_continuation.mjs` resumes through real MCP/Python with scheme resent and relation omitted; changed declarations, stale revisions and concurrent advancement remain refused. |
| M15 | Leading/trailing array whitespace prevented an executed grade from qualifying for revision because Python trims lines. Normalize array whitespace before qualification and tool execution. | `test_lyric_workflow.mjs` binds a trimmed grade to a whitespace-padded array and admits revision. |
| M16 | The merge cache used Python object identity, allowing changed or recycled lists to inherit an earlier draft's answer. Key by immutable line contents and groups. | `test_production_relations.py` mutates the same list, verifies the answer changes, and checks an equal-content copy reuses only the correct entry. |
| T20 | Structured answers with no pending question failed with an empty list of required lines. Check the pending question before converting structured answers. | `test_continuation_audit.mjs` exercises the real tool with an exported state and requires the missing-question diagnosis. |

## Oracle effect

The same 1,064 mandated sonnet pairs changed from 967 judged / 97 refused /
4 violations to 970 judged / 94 refused / 7 violations. The three newly judged
pairs are eye/alchemy, dead/astonished and words/affords; each previously named
only rhyming slang as unresolved. No satisfied pair changed. Other unresolved
schemas still refuse. The evidence is in
`lyric-harness/quality/report_slang_oracle.json`; the battery pin and the stale
current-baseline prose (R14) are updated together.

## Verification

- Full MCP suite: 167 checks passed, including real worker grading, revision,
  continuation and warm/cold parity checks.
- Chat and workflow suites: 39 tests passed. Native session repair suite:
  7 tests passed, including actual creation with `draft_text`.
- Production relation suite: 25 tests passed. The full relation suite and
  brief-provenance suite passed.
- Real run-continuation script passed, including partial declaration carry,
  stale-revision rejection and competing continuation handling. The additional
  real-tool missing-question test passed.
- All 59 revision-suite sections executed. The sole failure was the previous
  sonnet-oracle pin. After the measured update, the entire affected section was
  rerun and passed: both graders agree over all 152 sonnets, including every
  violation pair, with the new 1064/970/94/7 pin.
- Tests copied to an isolated checkout of untouched main reproduced the
  draft-text, whitespace, recovered-signature, content-cache and flat/group/batch
  provenance failures. They pass with these fixes.
- Changed JavaScript passed ESLint and Prettier checks; documented-path and
  whitespace checks passed.

These are regression fixtures. HTTP model responses are stubbed where specified
by the existing suites; the native creation and run tests execute the real MCP
handlers and Python worker. No paid provider requests or fresh-song completion
claims are involved.

## Scope and remaining work

H-2 is not changed: the owner's M-116 ruling in `lyric-harness/MISSING.md`
explicitly admits any represented cross-line schema under an undeclared
relation. Converting that default into an end-rhyme-only gate would reverse the
recorded ruling. A declared relation remains the narrowing mechanism.

The other report findings remain open or unreconciled. In particular, this batch
does not claim to fix draft apparatus loss (A-3), malformed-answer journal stops
(D-1), deferred journal validation/identity/atomicity, the coverage-ledger gaps,
phonology issues, or the deployment/accounting findings. No full-report closure,
fresh-song qualification, paid-provider acceptance, or production deployment is
claimed by these regression results.

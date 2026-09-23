# Lyrics report fixes — 2026-09-22

Source: the owner-supplied `REPORT.md` reporting 243 findings against
`claude/epic-gates-qs16b4`. This batch was checked against main commit
`08adfcff`; it does not close the full report.

PR #370 merged this batch as `3c14ea29`. A subsequent check on that main
reproduced C-1's corrected public verdict (one judged violation, zero
refused pairs) and passed the missing/supplied slang-surface regression.

PR #371 was merged during this follow-up as `cd20232f`. Its comparator
identity, nightly-budget and endpoint-verification changes are preserved;
it does not duplicate the report repairs below.

## High-priority follow-up in progress

The owner's order is A-3, Q20, D-1, Q21, E-1/E-2, C-2/J-1, J-3, I-1,
K-1 and W2F-1. Q6, Q7 and R16 require explicit assessment. None of these
is marked merged by the work-in-progress changes below.

- A-3: literal draft input preserves all nonblank lines. Source apparatus
  removal requires the explicit CLI declaration `--input-format=source`;
  corpus-library readers retain their source conventions. The three reported
  prefix cases pass public `brief` regressions with exact draft preservation.
- Q20: requested function refusals now contribute to coverage; shape has an
  explicit row. Convention-based findings remain notes. Focused function
  refusal coverage passes; public `song` certification reports incomplete coverage on the requested
  refusal. Narrowed 2026-09-23: "requested" is decided per refusal. Refusals
  whose premise is simply absent from the declaration (FUNCTION_UNDECLARED,
  SINGLE_INSTANCE, NO_COMPARATOR, REPRISE_SIDE_UNDECLARED, TITLE_UNDECLARED,
  and HOOK_UNDECLARED when no title is declared) are convention questions
  nobody asked; they stay on the report and are disclosed as `not_requested`
  coverage rows, but no longer make every blueprinted `song`/`finish`/`revise`
  run uncertified (the regression that turned main's verbs, suites,
  revision-loop and continuation-audit jobs red).
- D-1: malformed interview answers refuse without changing the retained state.
  Public tests submit wrong-type, oversized and over-capacity strings, verify
  byte-identical state, then resume the same run with a corrected answer.
  Actual journal-capacity limits still stop oversized runs.
- Q21: placed returns use the placement-aware judge; whole-line return checks
  exclude them. CLI and native MCP tests accept matching heads with different
  tails and detect a changed head. Undecidable placement checks refuse coverage.
- E-1/E-2: normalize space-form declarations before verb dispatch. Public
  equality tests cover language, blueprint and relation declarations; missing
  values refuse instead of disappearing.
- C-2: explicit apostrophized g-dropping derives the colloquial reading;
  unmarked ambiguous forms retain dictionary and derived readings. J-1:
  attested Welsh consonantal glides no longer add vowel nuclei. The full
  phonology suite passes; three assertions that encoded erroneous glide
  consequences were updated with measured explanations, without changing
  the 51/51 production depth-anchor result.
- J-3: `types` passes the declared fallback to its English reader; public
  missing-reading and supplied-fallback controls pass.
- I-1: runtime lexicon construction cannot download missing assets. The public
  CLI returns a named refusal within the regression timeout, without network
  access or a traceback. Explicit setup retains its download path.
- K-1: both source readers reject duplicate identifiers. Four conflicting
  shipped pairs retain their previously operative completed record and record
  the earlier superseded claims in its note. Reversing source order preserves
  provenance; conflicting duplicates fail in both orders.
- W2F-1: README deployment, provider-call and retention statements now match
  the configuration and existing privacy policy.

Verification to date: 12 public/high regression tests, the native MCP high
regression, all 25 production-relation tests and the full phonology suite
pass. Required CI and merge are still pending.

### Explicit assessment of the later mixed-severity findings

- **Q6 — High, admission mismatch confirmed.** The musical envelope is
  12–463; the executable creation limit is independently 31. The connector's
  old 447 ceiling made 448–463 unavailable even for explicit inspection.
  Admission now matches 463, with a regression against the planner's derived
  envelope and a schema description distinguishing inspection from execution.
  The 65,536-character mandate ceiling is an independent argv bound, not a
  derivation from the obsolete 447 value.
- **Q7 — Medium operational limitation, deferred while serious repairs are
  verified.** The 28-seed page still uses the obsolete 201-line cost premise;
  current executable plans are capped at 31. Pagination preserves the complete
  requested search rather than discarding seeds or falsely certifying an empty
  search. Raising this bound needs current deployment timing, and is a
  throughput optimization rather than a repair to certification or lost data.
  No new performance guarantee or remeasurement on the deployment is claimed.
- **R16 — High evidence-integrity claim corrected; research still open.**
  The public check still exits 1 with 31/34 pins moved, over 1,297 authors and
  1,881,636 tokens. The results document now prominently marks its PINNED/YES
  claims as historical. The instrument remains withheld from rejection;
  its study and pins were not silently re-adopted or adjusted.

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
- CI exposed two additional stale sonnet summaries. The counters writer updated
  the backlog row; the independent span audit measured 605 attributed pairs,
  365 misnamed pairs, and four mosaic violations over the new population.
  Current span and G2P tests use the exact new partition while the previous
  production oracle remains historical.
- Follow-up CI exposed stale slot/readability expectations and missing slang
  capability disclosures. The capability census now supplies and names a
  constructed slang fixture; the null-panel audit records the absent sourced
  slang projection as an input blocker.

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

# Accepted lyrics across repeated interruptions

The shared MCP recovery work left a second-interruption defect in
`WorkflowSessions`: a safe `resume_operation` copied the exact replay state into
its private session, but did not retain a separately readable accepted draft.
If the resumed worker stopped before its first checkpoint, `get_operation`
returned no `accepted_draft`. Storage reclamation also treated the interrupted
receipt as holding no accepted work. Once its earlier receipt expired, capacity
pressure could remove the remaining copy.

The resumed operation now persists the parent's accepted lines with its admission
checkpoint, before dispatch. Status reads fresh worker progress first and uses
the inherited draft only when fresh accepted lines are absent. The same choice
protects interrupted receipts from payload reclamation. The existing receipt
expiry still applies; this is temporary recovery, not permanent song storage.

The inherited draft is never installed as current worker progress. It cannot
authorize another resume, change the original replay input, clear uncertain
provider accounting, or certify lyrics. No provider call is made to recover it.
Existing new-run behavior and ordinary completed-session continuations are
outside this repair.

## Regression evidence

The three added tests in `mcp/test_chatgpt.mjs` exercise:

- Safe resume followed by another interruption before a checkpoint, with and
  without a newly in-flight provider request. A fresh store and MCP connection
  recover exact Unicode text and blank lines without another dispatch; unsafe
  resume stays refused.
- Expiry of the earlier receipt, then completed and pending receipt pressure.
  Admission refuses for capacity instead of retiring the remaining accepted
  lyrics. The protected receipt subsequently expires at its own deadline.
- New progress superseding inherited text, including an explicitly empty draft,
  while retaining the new operation's uncertain-outcome refusal.

On base `f90c0522`, the first two tests fail: the first returns no accepted draft;
the second admits another request by retiring the remaining recovery payload.
The newer-progress control passes on both implementations. All three pass with
the repair. They run in the existing `test:chatgpt` and
`test:production:offline` gates.

Validation on the repaired tree: all 22 shared-session tests and all 14 durable
job-store tests pass, with no failures or skips. The shared-session suite includes
actual recipe edits, lyric sweep/screen/plan, and interview revision across
reconnects. Changed JavaScript passes ESLint and Prettier; documented paths and
the traced build dependency closure pass.

This is a local code and recovery-contract verification. It does not establish
production deployment, native ChatGPT acceptance, or paid-song qualification.

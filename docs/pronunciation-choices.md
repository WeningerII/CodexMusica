# Explicit pronunciation repair

The Moonshots draft previously ended at exit 2 because “record” had unresolved
noun/verb stress on two verbatim chorus lines. Four obligations remained refused:
line prominence and placement prominence on lines 23 and 28. The fix adds an
explicit reading declaration; it does not reinterpret exit 2 as success or weaken
the meter checks.

## Behavior

The existing grade/check tools expose actual dictionary options. The writer
selects an intended reading by exact full line and one-based sung-token position,
or supplies ARPABET with a declared source. Dictionary selections are verified
against CMUdict. Supplied pronunciations remain caller declarations.

The shared occurrence reader carries the choice through transcription,
syllabification, stress, placement, calibrated-band reading, scalar rhyme,
mid-line/named relations, whole-stream relations, verification and candidate-work
bounds. Each layer keeps its existing fallback policy on unselected words.
No process-global dictionary entry is changed. Cache identities distinguish both
the declaration set and individual bound occurrences.

Identical chorus lines share the declaration. Changed text receives no old
reading; a declaration with no matching line is a refused coverage obligation.
Verification rejects losing previously answered pronunciation coverage. Readings
are frozen during a revision run. The creation workflow binds the exact draft,
plan, pronunciations, fallback and voices to its grade receipt and restores
omitted reading settings when revision starts.

The connector schemas bound choices and payloads. Python additionally validates
ARPABET, source, token identity, duplicate declarations and dictionary membership.
Supplied syllables also count toward the existing execution-capacity limit.
A crash now includes bounded stderr in the connector verdict instead of
promising a diagnostic that was omitted.

## Evidence

- `npm run test:pronunciations`: 17 Node tests and 14 Python tests, including actual CLI execution.
  Includes distinct readings of identical tokens, changed lines, chorus reuse,
  hyphenated/OOV names, dictionary integrity, invalid declarations, unsung asides,
  per-occurrence cache identity, resource accounting, mid-line/named grading,
  verification coverage regression, workflow binding, continuation changes,
  CLI argument handling and bounded crash diagnostics.
- `npm run test:production:offline`: 86 Node tests and 53 Python tests passed.
  This gate now includes the new pronunciation regressions.
- `node --test mcp/test_connector_contracts.mjs`: 20 passing tests.
- Existing production revision suite: 26 passing tests.
- Existing production relation suite: 23 passing tests.
- Changed JavaScript passes ESLint; the diff passes whitespace checks.
- `npm run qualify:session:workflow`: actual maintained MCP client, server, Python
  harness and interview continuation. No mocked grader or paid writer. It runs
  sweep → screen → generated plan → initial grade → pronunciation selection and
  regrade → revision question → actual repair answers → finished assessment.

The checked-in replay script requires the final result to have exit 0, complete
requested coverage, the exact pronunciation declaration, and all seven original
section/meter headers. Raw receipts and rendered output are in
`session-repair-evidence/moonshots-pronunciation-replay.json` and `.txt`.
The original exit-2 evidence is retained separately.

## Limits

Exit 0 means this run passed its requested checks under its declared readings.
It does not prove a perfect song, performed meter, factual name pronunciation,
or production-host reliability. This draft still opts into low fallback for
undeclared names; those guesses were not upgraded into verified facts.

The exact-line API deliberately shares readings across verbatim repeats. It does
not support two independently pronounced instances of an otherwise identical
line. Source strings are recorded, not independently authenticated.

These are local implementation and connector qualification results. They do not
constitute deployment, external-host qualification, or a successful paid
40-minute kitchen run.

# Lyrics runtime: durable requests and paid-work recovery

The lyrics kitchen — the service's own Gemini writer, which runs only inside the
website chat (no MCP connector endpoint offers it) — spans an
HTTP request, Gemini chat hops, MCP calls, a serialized Python worker and paid
proposal calls. A caller timeout does not establish which
of those operations completed. Recovery therefore follows a durable request
receipt; it does not automatically repeat an uncertain request.

## Runtime configuration

The legacy Render Blueprint declares a **1 GB persistent disk** at `/data/lyrics`
and sets `LYRIC_RUNTIME_DIR` to that path. The image-backed release migration must
preserve that disk, the Standard plan and single-instance operation; see
[IMAGE_RELEASE.md](./IMAGE_RELEASE.md). The release check requires the live recovery
store to be healthy and durable.
A source commit alone does not prove that the mount is active.

Render's [persistent disk documentation](https://render.com/docs/disks) states
that mounted data survives deploys/restarts, a disk belongs to a single instance,
and disk-backed services briefly stop during deployments. These stores therefore
support **one Node process and one instance**. Multiple processes or replicas need
a transactional shared store before they can safely use this protocol.

| State | Default file under `LYRIC_RUNTIME_DIR` |
|---|---|
| Request intents, progress and responses | `jobs/<request_id>.json` |
| Connector workflow sessions and operations (`/mcp` and its aliases) | `sessions/<id>.json` |
| Generated chat signing key | `chat-secret.key` |
| Shared model admission/accounting ledger | `model-spend.json` |
| Legacy chat turn counters | `chat-spend.json` |

`CHAT_SECRET` remains an explicit signing-key override; otherwise
`CHAT_SECRET_FILE` may override the generated key's path. Preserve the existing
`CHAT_SECRET` during migration if existing signed conversations must continue.
Do not rotate it while recovering retained receipts. An unreadable or malformed
configured signing key disables paid chat instead of silently generating a new
one. A corrupt accounting file closes paid admission instead of resetting spend.
Do not delete corrupted files to make a run proceed: reconcile them against the
provider's records and retained receipts first.

Without `LYRIC_RUNTIME_DIR`, local development is explicitly **process-local**.
`/health.recovery.durable` is false; this mode does not establish restart recovery.
Setting a path by itself cannot prove that the hosting provider mounted persistent
storage. The Blueprint supplies that mount. For a different host, arrange the
mount before setting the variable.

Files are replaced atomically after file fsync and directory fsync, using mode
0600; the job directory uses mode0700. Receipts contain private lyric drafts and
signed continuation envelopes. Treat both the disk and downloaded battery
artifacts after decryption as private working data. The battery workflow requires
a dedicated `BATTERY_RECOVERY_KEY` and uploads only authenticated encrypted
archives plus a nonsecret manifest; see [BATTERY_RECOVERY.md](./BATTERY_RECOVERY.md).
Do not publish plaintext receipts, decrypted artifacts or the key in a public issue.

## Request and recovery protocol

Generate `request_id` from **32 cryptographically random bytes**, encoded as 64
lowercase hexadecimal characters. Save the complete request and this identifier
locally **before** sending `POST /chat`. The identifier is a bearer capability:
knowing it grants access to that receipt. Seeds and run titles grant no access.
The server redacts it from its inbound HTTP log.

A legacy request without `request_id` has no receipt to recover. The shipped
browser and battery persist an identifier on every attempt.

1. After request validation and admission, before dispatch, the server atomically
   records the original request body,
   its canonical SHA256 digest, build identity and `pending` state.
2. Repeating the same identifier with the same body returns `202` while pending,
   and never dispatches the work twice. Different input returns `409`.
3. Safe chat boundaries retain a signed continuation checkpoint. Python progress
   is stored separately, since it can be newer than the latest complete chat
   exchange. A raw worker checkpoint is not a signed model conversation. Proposer
   admission is persisted before the local broker gives Python permission to
   dispatch; `proposer_usage` retains its most recent admission or usage event.
4. Before sending the final JSON response, the server commits its HTTP status,
   JSON body and any `Retry-After` header. A completed duplicate replays those
   recorded values.
5. `GET /chat/jobs/<request_id>` returns the receipt. On process restart, an
   unfinished receipt becomes `interrupted`; submitting it again returns `409`.
   It never authorizes replay of uncertain paid work.

To continue a completed or recoverable receipt, submit a new `request_id` with its
`continuation_id`. The server resolves the retained signed envelope without
requiring the browser to resend it. Each parent durably records one successor
before provider dispatch; a different successor is refused. Recover the existing
successor after a lost response rather than starting a competing continuation.

The GET response has this shape:

```json
{
  "request_id": "<64 random hexadecimal characters>",
  "state": "pending | completed | interrupted | retired",
  "checkpoint": "null or signed history/workspace/lyric/sig plus turn progress",
  "progress": "null or the latest worker progress object",
  "response": { "status": 200, "body": {}, "headers": { "retry-after": "41" } },
  "build": { "commit": "...", "source_sha256": "...", "config_sha256": "..." },
  "durable": true,
  "retention_ms": 86400000
}
```

`response` is null until completed; `headers` is absent when no pacing header was
set. The actual checkpoint and progress values are objects, not the descriptive
strings in this example. GET responses are marked `Cache-Control: no-store`.

The battery's explicit `--resume` path can continue a retained signed checkpoint
with a **new** request identifier. An interrupted `uncertain_proposal` receipt
refuses automatic continuation: the provider may have returned an answer that was
not yet journalled. A `proposing` checkpoint is conservatively uncertain even when
no paid dispatch can be proved. Keep its accepted lines and start a deliberately
independent run when appropriate; do not replay its original proposal. Otherwise,
inspect `progress` before choosing to repeat a repair; paid-call reservations with missing usage remain unknown spend,
not zero-cost attempts. A `404` means no retained receipt, **not** proof that the
request never executed. It must not trigger transparent resubmission.

## Capacity and identity

The `/chat` store is bounded to 128 full payloads, 8192 receipt identifiers, 18 MiB per record
and 256 MiB total. Connector sessions have their own store with limits sized for
connector traffic (`SESSION_STORE_LIMITS` in `mcp/workflow_sessions.js`); the same
retirement rules apply to it. To admit new requests within these limits, the oldest completed
or interrupted payload can be retired early. Its small `retired` tombstone retains
the identifier and request digest, preventing that identifier from executing again.
A retired receipt returns no checkpoint or response and cannot itself be resumed.

The store decides an admission before it writes anything: an adopted earlier-release
parent, the new record and the parent's successor link are planned together, against
both the byte cap and the payload-record cap, and only the fewest receipts that make
room are retired. A call that cannot fit retires nothing. On the session endpoints it
is refused, before any work is queued, as:

- `SESSION_STORE_FULL` (`code` `JOB_CAPACITY`): insufficient capacity because the store is
  full of work it must keep, running operations and interrupted receipts holding accepted
  lines. Retry the same call once one completes or its receipt expires.
- `SESSION_RECORD_TOO_LARGE` (`code` `JOB_CAPACITY`): one record of the admission, such as
  the parent with its successor link, would be over the per-record cap. Free room or
  waiting does not change that, so it asks for a smaller request or a new session, never a retry.
- `SESSION_RECORDS_FULL` (`code` `JOB_RECORDS_FULL`): the store holds its maximum number
  of receipt ids. `retry_at` is when the oldest receipt that can expire does, the
  earliest opportunity rather than a promise of admission; with only running work
  there is no known time, and `retry_at` is omitted.

A retired receipt keeps its `successor_id`, and `get_operation` shows it. The identical
retry of the call that advanced it, or `resume_operation` when that successor is its
own resume, reaches the live successor; any other call is refused as stale. This
follows one hop only: when the successor is retired or gone too, the call is refused
with `SESSION_RETIRED`.

Terminal receipt metadata expires 24 hours after the last work update. Pending
records never expire or retire inside a running process. Full storage with no
retirable terminal payload refuses new admission. Invalid and rate-limited requests
are rejected before occupying storage. A persistence failure refuses new paid chat;
GET still exposes already-retained records with a `persistence_error` and an
interrupted state for an unpersisted final response. Download full results promptly:
the 24-hour metadata retention is not a promise to keep every response body that
long.

`/health` keeps top-level `commit` and adds `build` plus `recovery`. Build identity
contains the baked commit and unique release identifier when available,
runtime-reported commit, source and configuration SHA256, asset and asset-manifest
SHA256, and Node/Python/NLTK versions. The source digest covers the deployed MCP,
lyric harness, scripts, references and dependency locks. Lexical data is identified
separately by the release asset inventory. The promoted registry digest identifies
the tested image, including its installed operating-system packages; these fields
do not identify the provider's model weights. Configuration
fingerprinting covers CHAT/LYRIC/MODEL settings, model choice and trusted-proxy
count, excluding keys, secrets and tokens. Each receipt retains the identity that
accepted it. A fingerprint is useful for mismatch detection, not independent
attestation of the hosting provider.

For a long kitchen measurement, require durable recovery and the intended SHA,
record the tested image identity and configuration fingerprints, and stop if either changes. First prove
one bounded request can stop and resume from its receipt; then attempt a full song.
This code and the offline regression suite do not prove live provider latency,
writer convergence, the actual mounted disk, or sustained memory headroom.

## Reading basis: the lexicon supplement

Every tool that reads words (`lyric_screen`, `lyric_grade`, `lyric_revise`,
`lyric_check`, `lyric_verify`, `lyric_recover`) reads CMUdict plus one frozen
version of the reviewed lexicon supplement, named in
`lyric-harness/data/lexicon_supplement_versions.json`. The declaration is
`lexicon_supplement` (a version id, or `none` for CMUdict alone), and the record
keeps the version's file SHA256 beside it as `lexicon_supplement_sha256`
(`mcp/lexicon_basis.js`).

- **New work** that omits the field reads the manifest's `default`.
- **A continued run** (by `run_id`, `state`, `checkpoint`, or a session's grade
  receipt) keeps the version and SHA256 it recorded. A record written before
  this field existed reads `none`: it stays on CMUdict alone whatever the
  default now is. Inheritance is applied first, the default only after it.
- **An explicit different version** on a continuation is a moved declaration and
  refuses, like any other declaration.
- **A version this build does not ship**, a missing file, or a file whose bytes
  are not the recorded SHA256 refuses as `LEXICON_SUPPLEMENT_UNAVAILABLE`. No
  other version is ever substituted. The harness checks the file's bytes again
  (`--lexicon-supplement=<id> --lexicon-supplement-sha256=<hex>`).
- Every verdict carries `lexicon: {supplement_id, sha256}` from the harness's
  authenticated record, `null`/`null` for CMUdict alone. A creation session's
  grade receipt takes its basis from that field, never from the call's arguments.

A shipped version's file is never edited; a new batch is a new version and a new
file. Adding one changes the release asset inventory, so an in-flight
continuation from the previous image still meets `CONTINUATION_MIGRATION_REQUIRED`:
a stable version identity does not promise resume across deployments.

## Word numbering: declarations held from before the reader change

A pronunciation declaration names a word by its one-based sung-token position
in an exact line (`{line, token, word, …}`). The English reader cuts a line
under reader scheme v2 (ASCII dash runs split words, digit-bearing runs are
numeral tokens, NFC and the Unicode-hyphen folds apply); reader scheme v1 is
the earlier cut.
Each pronunciation may carry `numbering`: `v1`, `v1+voices`, `v2`, or
`v2+voices`. Values without `+voices` strip parenthetical asides. The marker
records the numbering of the source evidence, not the server currently reading
a saved response. What follows protects fresh lyric calls without rewriting
legacy v1 state rows or their fingerprints.

- **A continuation whose semantic identity does not match is refused.** A
  `state`, `checkpoint`, `run_id` or session receipt carries the
  `connector_semantic_identity` of the image that wrote it. When that identity
  differs from the running image's, `assertContinuationSemantics`
  (`mcp/state_codec.js`) refuses it as `CONTINUATION_MIGRATION_REQUIRED`, and
  the declarations inside it are never replayed under the running image's
  cut. `recover_only:true` extracts the stored lyrics and journal without
  replay.
- **Every newly generated option carries its numbering on each item.** Copy
  it verbatim with the exact line, token and word, including `v1` and
  `v1+voices` options. Stored historical responses are not restamped as
  current evidence; legacy declaration rows and fingerprints are unchanged.
- **Marked input binds raw pieces, not a matching spelling nearby.** The
  server derives the source token from its scheme and voices, then finds the
  identical raw pieces in the requested run's coordinate. If no whole token
  preserves that occurrence, the call refuses; callers supply no offsets.
- **Unmarked v2 inputs are checked under both schemes with the requested
  voices setting.** If both cuts validate the word at different raw pieces,
  the call refuses and asks for `numbering`. Valid only under v2, or at identical
  pieces under both cuts, retains its interpretation. Valid only under v1
  rebinds by exact raw pieces with a notice, or refuses if v2 splits the token.
  Neither matching refuses.
- **Unmarked rows do not record voices.** An unmarked row does
  not say whether its producer sang parentheses. The guard compares v1/v2
  under the requested voices setting, not all four coordinates. Marked rows
  preserve their originating voices coordinate; an unsung target refuses.
- **Re-sent declarations are normalized before comparison.** For a cached
  run, interview state or standalone checkpoint, the connector asks the
  private Python normalization action to resolve original and supplied
  declarations under the recorded reader scheme and voices. Only equal
  canonical occurrences restore the original arguments for the unchanged
  worker identity check. Changed phones, occurrences and other declarations
  still refuse. This does not depend on cached aliases or extra receipt
  capacity and never rewrites legacy rows or fingerprints.
- **Scope:** these safeguards apply to lyric calls, not the separately held
  old/new Library `declaration_set`, evidence and queued-job compatibility
  extension. The Library path keeps its existing validation boundary.
- **The website's own saved choices retain their provenance.** The Lyrics
  page and the Library tab mark, migrate and report the choices they save
  under rules no connector call acts on; the website's developer
  documentation states them. Either surface refuses a saved mark naming a cut it does not
  read (`— cut v3`, `token_cut: "v3"`), naming the accepted value.
- **Word places in `groups` and `returns`: counts and definitions.** A member
  `N.Tk` (`--groups=1.T4,2`, `--returns=1.T2,3.T2`) is a COUNT: word k of line
  N, with no word to validate against, read under v2 by a new call. A
  bare `N` and the named places (`end`, `endword`, `head`, `headrime`, `line`)
  are DEFINITIONS the grader applies to the line as the running reader cuts it
  (`lyric-harness/quality/slots.py`: `head` and `endword` take the word start, `end`,
  `headrime` and `T<k>` the last stressed syllable from there), so what they
  bind moves with the cut too. Where the current cut reads a numeral end that
  v1 skipped, `end` leaves a visible hole in `blocking` unless a reading is
  declared. A named place is never converted to a number. In a rhyme groups
  row a bare `N` is placed by its group's type (`group_types` or `relation`),
  and is the end only in a group with no type. In a returns row a bare `N` is
  a whole-line return judged by `returns_check`; explicit `N.line` is a placed
  return judged by `placed_returns_check` through the `line` placement, not an
  alias for bare `N`. Mixed whole-line/placed classes are refused.
  - **Connector callers' held `N.Tn` members use `numbering`.** The optional
    call field names the same four scheme/voices coordinates as pronunciation
    rows. Fresh v2 unmarked members compare raw pieces under v1 and v2 with
    the requested voices setting: ambiguous positions refuse; v1-only positions
    rebind by exact pieces with a notice or refuse. Marked positions preserve
    their source occurrence or refuse. Named places keep their existing
    semantics and are never converted to numbered tokens. Resumed v1 runs
    retain their recorded coordinate.
- **A run resumed under v1 resolves every place under v1.** A state recorded
  under reader scheme v1 (a v1 harness state replayed with the harness, or an
  explicit `--reader-scheme=v1`) keeps the whole v1 reading:
  counts and named places alike resolve under the earlier cut, exactly as they
  did when the state was written.
- **A recorded reader scheme is absent or named; `null` is malformed.** A
  deferred state, a kitchen checkpoint, a replay file or an `answered` block
  without the `reader_scheme` field predates it and resumes as v1. A field that
  is present but holds `null` (or any name other than `v1`/`v2`) is malformed:
  the resume, `tryline`'s pre-flight, the checkpoint and the replay all refuse
  it with one message, before the record is touched. This build never writes
  `null`; only a hand-edited or foreign record holds one. Whether a connector
  caller can deliver such a record at all is established by source reading
  only, not by a test: the refusal is the harness's, wherever the record
  arrives from.
- **A word broken across the line end** (`king-`): the current cut keeps the
  hyphen inside the token, and a hyphenated word reads only whole, so the
  declared-relation reader (the registered English reader a plain lexicon
  gets, fallback refused) reads `king-` as no word while `line_anchors` reads
  `king`. The relation stream reads the printed part of the line-final broken
  word through the same phonology and its own fallback policy
  (`English.split_final_stem`), and only after the token itself reads nothing
  (a declared reading of `king-` answers first). A numeral broken there
  (`2-`) and a printed boundary are refused, and the bare word `king-` has no
  reading. All five hyphen spellings give one verdict; v1 keeps its own
  answers (ASCII `-` only).
  - The same holds when punctuation or a closing quote follows the hyphen
    (`king-,`, `king-.`, `king-;`, `king-'`), which `line_anchors` also reads as
    `king`: the stream reads the printed part, and the line is NOT split,
    because punctuation never makes the word continue on the next line. So a
    declared perfect rhyme holds and a declared broken rhyme is false, exactly
    as v1 answers.
- **A bare word is looked up as a token is.** Under v2,
  `pronunciation_variants` (and `English.parses`, `whole_reading` and the
  `types` verb built on it) looks a bare word up under the reader's entry
  normalisation, as `transcribe_word` and every line token do, and a
  supplement row found that way is credited to its own source. v1 and declared
  readings are unchanged.

### Known open limitations (pre-existing items)

These defects are open. Each is listed so it is not read as fixed, or as a
regression of the rules above.

- A Library job refused `STALE_READING` (queued or paused across a release)
  offers a Resume that cannot succeed: `src/library/analysis.js` shows the
  Resume button for every paused, cancelled or failed job. (tracking: [#656 L1](https://github.com/WeningerII/CodexMusica/issues/656#issuecomment-6614429602))
- Under reader scheme v1, the default end slot's swap splices into an echo
  aside that repeats the end word, so it edits the aside instead of the end
  word the grader binds. The v1 replay keeps that wrong edit byte-identical,
  because v1 runs the earlier code verbatim (`lyric-harness/quality/loop.py`
  `swap_at_slot` docstring). (tracking: [#656 L2](https://github.com/WeningerII/CodexMusica/issues/656#issuecomment-6614429602))
- A retained 30-day Library chunk saved before the cut-marker fix keeps its
  declarations without their cut (F2). No repair is planned: the owner decided
  to let affected chunks expire within their 30-day retention (2026-11-04).
  (tracking: [#656 L4](https://github.com/WeningerII/CodexMusica/issues/656#issuecomment-6614429602))
- During a deploy there is a window in which the page, the server and queued
  jobs can run different versions (F3). The owner accepted this window rather
  than engineering it away (2026-11-04). What already holds in it: a lyric
  continuation signed by the old server is refused with
  `CONTINUATION_MIGRATION_REQUIRED` and resumes with `recover_only: true`, and a
  Library job queued or paused across the release is refused `STALE_READING`
  rather than resumed against the new reader.
  (tracking: [#656 L5](https://github.com/WeningerII/CodexMusica/issues/656#issuecomment-6614429602))

## What the money limits establish

The shared model ledger reserves an allowance before each network dispatch, across
chat and kitchen operations. The current reservation is calculated from serialized
request bytes plus 1024 input-token allowance, configured maximum output tokens,
and a separate 65,536-token thinking allowance (overridable with
`MODEL_THINKING_RESERVE_TOKENS`). These are conservative engineering assumptions
for the current text workflow, **not** a provider-certified maximum token count.
Changing models, modalities or the allowance requires rechecking those assumptions.

Settlement uses reported prompt, tool-input, candidate and thinking token counts at
the repository's declared input/output prices. This follows Google's documented
[usage categories](https://googleapis.github.io/js-genai/release_docs/classes/types.GenerateContentResponseUsageMetadata.html).
Cached token counts remain in the record; the current arithmetic charges all prompt
tokens at the ordinary input rate, without applying cache discounts. The resulting
USD figure is a conservative list-price calculation, not an invoice reconciliation.
Missing, malformed or inconsistent usage retains the reservation as unknown spend.

The proposer's bounded transport retry policy can issue a replacement after an
uncertain network failure. Every attempt reserves separately, and the earlier
attempt remains charged as unknown; this is not exactly-once provider execution.
Worker timeout/crash recovery never silently restarts that kitchen invocation.
An interrupted proposal without a journaled answer stops automatic continuation;
starting again from the accepted draft is an explicit fresh-run choice.

A reservation can stop work before the remaining allowance is actually exhausted.
Conversely, if reported usage exceeds the reserved amount, that request has already
occurred: the ledger records its reported cost and persistently blocks further paid
admission. The mechanism cannot retroactively prevent that one provider-side
overshoot. Unknown reservations survive a restart; completed usage is assigned to
the UTC day of settlement, and clock rollback closes admission rather than refunding
spend. These rules make the accounting limitations visible instead of assigning
missing usage a zero price.

## Offline regression coverage

Battery request capabilities are saved and encrypted for remote artifact upload
before each paid dispatch. Hosted execution refuses to dispatch if that upload
fails. Checkpoints and terminal verdicts are saved atomically, and later uploads
retain updated recovery records. A local-only run explicitly lacks hosted recovery
qualification. The release acceptance gate also requires an actual hosted archive
restore; local filesystem tests do not establish that external result.

Run `node --test mcp/test_job_store.mjs`. The suite uses real Express HTTP and real
filesystem writes, with fixture work instead of a paid model. It checks intent
before dispatch, concurrent duplicate rejection, lost-socket final recovery,
SIGKILL/restart interruption, safe checkpoint preservation, corrupt persisted
state, storage failure, bounded retention and recovered retry pacing. It does not
make live Gemini calls or deploy a service.


## Production contract after the audit

AI hosts connect to the shared `/mcp` endpoint, which serves both tool families
and keeps workflow sessions on the server; a lyrics session opened with
`begin_lyrics` in phase `create` enforces the creation order from receipts the
server records. The task-scoped views `/mcp/recipe` and `/mcp/lyrics` (used by the
maintained client) and the browser task selector dispatch only one tool family
and preserve the task outside the model transcript. Recipe creation uses Rich and
a maximum of 1,000 characters; its delivery is the engine's exact rendered string.
No endpoint can enforce a task an external host never states: `/mcp` serves
whichever family the host calls.

Direct lyric continuations require the returned `run_revision` with `run_id`.
A concurrent continuation or stale revision refuses before work starts. That holds
after the run's cached record is gone (a clean finish deletes it, a restart loses it):
a run ledger keeps each run's latest revision, whether it finished, and a digest of
every state or checkpoint the run has moved past. It holds digests only, never a
`run_id` or a wire, in `run-ledger.json` under `LYRIC_RUNTIME_DIR` (`RUN_LEDGER_FILE`
overrides; in memory otherwise), replaced atomically after a file and a directory
fsync. A wire is identified by its decoded content, so a re-spaced or re-encoded
copy is the same wire (and a wire whose decoded content differs, even by one added
field, is a different wire). Runs on the paid website writer are kept apart from free
ones: up to 20,000 of their runs and moved-past wires, with no age limit (a signed
`/chat` envelope does not expire), so free calls cannot push them out; other runs
are kept 30 days within a cap of 5,000 runs and 5,000 wires. So, with nothing run:

- a revision behind the run's latest, or any revision of a finished run, refuses;
- a state or checkpoint the run already moved past refuses whether or not the call
  names its `run_id` (the `/chat` checkpoint recovery carries none);
- while the ledger cannot be read or saved, every continuation refuses
  (`RUN_LEDGER_UNAVAILABLE`); a fresh run on a draft is unaffected.

Limits: replay prevention is bounded, not unlimited. A run the ledger never saw
(from before it shipped) continues as before, and so does one it has dropped — the
oldest entry is evicted first: a paid run once 20,000 newer paid entries exist, any
other run past 30 days or once 5,000 newer ones exist — and a continuation it
covered would run again. An unreadable ledger file is never written over, so a
restart still finds it unreadable and continuations stay refused. It is not repaired
by moving the file aside: an empty ledger forgets that history and readmits every
older continuation it covered, as runs it never saw. Restoring a readable copy is
the repair; starting empty is a decision to readmit those continuations, not a
routine fix. "Behind" and "never delivered" look the same from a revision:
a call interrupted after its run advanced but before its result reached the caller
leaves the caller holding the earlier one, which then refuses; `recover_only` reads
its accepted lyrics and `new_run` goes on as an independent run. On `/chat` a model
never holds the wire: a bare `recover_only` there recovers the conversation's
carried continuation. A `/chat` result recorded in its receipt is fetchable by
`request_id`; one lost between the run ledger and the receipt (a crash in that
window) is not — the receipt is `interrupted`, and continuing it by
`continuation_id` resumes from the receipt's progress as an independent run. When
both are open, recover by `continuation_id` first: it keeps answers the receipt's
progress recorded, which a `recover_only` export of an older wire does not. A repeated question
(the run still on the same state) is not moved past. `new_run` stays the explicit way
to start independent work on a draft. Original
replay input, accepted lines and immutable declarations have separate fields;
accepted lines never silently replace the replay input. The bounded state codec
identifies the scorer source, lexical data and runtime. Signed chat continuations
and worker recovery enforce the same identity. A mismatch preserves the original
artifact and refuses automatic replay; recover its accepted lyrics before starting
independent work under the changed implementation.

Completion is based on authenticated harness metadata containing requested-layer
coverage and the exact final draft. Display text cannot create a clean verdict.
The host's completion receipt hashes both the final draft and the exact delivered
text. An unknown, refused or incomplete layer cannot become a finished song.

`node mcp/check_live.mjs --commit=FULL_SHA --ready --config=render --image-manifest=lyrics-image.json`
checks the full MCP surface and initialization, exact tested image build identity,
lyrics readiness, durable recovery and effective public configuration.
`/health` remains a liveness endpoint. A successful
source test is not evidence of a completed paid song or a successful long wall
continuation; those require the maintained battery acceptance gate.

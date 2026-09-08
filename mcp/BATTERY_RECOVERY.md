# Lyrics battery measurement and recovery

The default battery verdict is **every requested song finished**. A green survey
is a different result: select `--expect=survey` explicitly to record coverage
without requiring a finished song. Finished means the latest successful
`lyric_revise` certifies the exact delivered artifact: task, final draft and
presentation hashes must agree. An earlier zero exit or a model's finished claim
cannot certify later output.

`--expect=turn-wall` requires `stopped: MAX_TURN_MS`, a checksummed kitchen
journal with completed proposals, and a successful continuation on the same build
and signed task. The native resume receipt must bind the original checkpoint,
replay its entire completed prefix without redispatching those proposals, and
show a newly verified, applied edit beyond the saved accepted draft. The final
response must carry either a certified finished artifact or an exact parked
artifact after an executed repair. A changed signature, another tool call, or a
refused continuation cannot qualify. Fresh-song and wall outcomes are both
required for production qualification.

## Run and resume

Use the exact deployed commit and require durable recovery for a paid measurement:

```sh
node scripts/flash_battery.mjs --out=battery-out --songs=1 --commit=FULL_SHA --require-recovery
```

`FULL_SHA` is the full deployed 40-character Git commit. The driver checks it
before each new paid request and records the baked per-build release ID, runtime
source, effective-configuration, lexical-asset and asset-manifest fingerprints
from `/health`. A changed identity stops the measurement before
its next request, even if the Git commit is unchanged. After a successful paid
response, it also verifies the build stored on that request's receipt; this
detects a deployment between the health probe and the POST. The Actions workflow
requires the SHA, checks out that revision, and checks initialization plus the complete live tool
surface. `mcp/check_live.mjs` without readiness/configuration/image flags remains
a **surface smoke**; it is not a kitchen-readiness or image-qualification measure.
Deployment additionally compares the live image's baked identity with the image
manifest from the exact successful CI run and attempt.

To continue an interrupted battery, keep its output directory and use:

```sh
node scripts/flash_battery.mjs --out=battery-out --resume
```

The original base URL, commit, song selection, and options are loaded from
`run.json`. A larger `--turns=N` may be supplied if the earlier run exhausted its
turn allowance. `--expect=finished` may replace `--expect=turn-wall` when continuing work after
that canary. The Actions `resume_run` input selects the newest retained final or
incremental encrypted archive from that run by artifact ID, authenticates and
decrypts it with the same recovery key, then invokes the same CLI. Keep the original song selection
and commit in the dispatch inputs.

The recovery cases are deliberately different:

| Existing record | What resume does |
| --- | --- |
| A completed response was saved locally | Reuses that receipt; no repeated POST |
| Request started, server says pending | Polls the same 256-bit request capability |
| Server says completed, including a signed error | Reads its original response and continues through that receipt capability |
| Server says interrupted and has a safe signed checkpoint | Explicit `--resume` uses a fresh request ID with the interrupted receipt as parent; accepted progress is recovered only when its semantic identity still matches |
| Parent already has a successor | Reads the recorded successor receipt; it cannot create a second paid branch |
| Server says missing or retired, or recovery cannot be read | Records uncertainty and refuses automatic re-execution |
| Server reports persistence failure | Retains the checkpoint and stops; resume cannot start more work until storage is repaired |
| Server reports an uncertain proposal | Stops automatic continuation, including plain `--resume`; an operator must explicitly choose an independent `new_run` from the last accepted draft |
| Process stopped before a durable dispatch marker | A new request can be sent because the old request never reached the socket-opening step |

Server recovery has a declared retention period. A missing record after expiry
is still ambiguous; the driver does not assume that no work happened. If an
interrupted job lacks a signed checkpoint, its original input is not silently
submitted again.

## What is durable

Before the first paid request the driver creates `run.json`, `summary.json`, a
song checkpoint, and a request-intent journal. It writes and fsyncs the dispatch
marker and any new journal directory entry before opening the POST socket. Every received HTTP response is saved before
recovery lookup or tool interpretation. Atomic checkpoint files contain the actual
`history`, `workspace`, `lyric`, and `sig`, together with the battery's counters
and transcript offset. Resume can replay analysis from saved receipts without
repeating model work. The signed task travels with the continuation, including
the original brief, current plan and scorer semantic identity. Hosted durable
runs send `continuation_id` referring to the last receipt instead of repeatedly
posting potentially oversized envelopes. A changed source/data/runtime contract
refuses replay; retain the accepted draft and original journal for recovery.

`summary.json` and `songN.jsonl` are the human-readable verdict/transcript files.
`songN.attempts.jsonl` records request starts, dispatches, receipts, recovery
observations, and identity checks. Journals roll at 8MiB into consecutively numbered
`songN.attempts.000001.jsonl` segments; resume refuses missing historical segments.
Repeated identical recovery polls add no duplicate records. Changing progress
atomically replaces `songN.recovery.json`, including the exact completed response
when available; the journal retains at most 1024 compact progress fingerprints per
request plus its terminal observation. `songN.checkpoint.json` contains the latest
battery continuation state and, when terminal, its verdict in the same atomic
replacement. Resume reconstructs a lost summary from those verdicts; a missing or
sparse song cannot pass by being omitted. Transcripts, journals, checkpoints and driver logs
can all contain continuation capabilities or private lyrics. Local output files
use mode 0600 inside a mode 0700 output directory. Their presence proves what was
recorded; it does not prove progress that the server never returned or checkpointed.

## Recording capacity

Before every fresh paid request, the driver reserves 64MiB within the archive's
128MiB plaintext limit and 16MiB of headroom on each file that does not rotate.
It also reserves directory entries for new records. Request bodies are capped
at 2MiB, received JSON at 4MiB both on the wire and after serialization, and driver
diagnostics at 4MiB per invocation. Snapshots use compact JSON; attempt journals
rotate before they can reach the archive's 32MiB per-file limit. These reserves
cover the duplicated analytical transcript, checkpoint, summary, and response
evidence, including changing recovery progress.

If those reserves cannot be met, `storage_budget` stops fresh paid requests and
leaves the latest checkpoint resumable. The completed work and exact receipts
remain in the encrypted archive. After decrypting a copy, move bulky diagnostics
or unrelated files out of the working directory (retain them separately), then
resume. Preserve every attempt-journal segment, `run.json`, the song checkpoint,
and its transcript: removing history is not a safe way to manufacture capacity.
The lower-only `--recording-limit-bytes` option can enforce a smaller total limit.
Recovery lookups remain read-only and never authorize a new POST without capacity.

## Encrypted workflow artifacts

Before running or resuming the Actions workflow, configure the repository Actions
secret **`BATTERY_RECOVERY_KEY`** as 32 cryptographically random bytes encoded in
64 hexadecimal characters. Use a dedicated archive key, separate from the service's
model or signing keys. The workflow refuses to start paid work without it and
proves that it can seal an archive before sending the first request. With
`--require-remote-recovery`, before **every** paid dispatch the driver fsyncs the
request capability, seals the current records, and requires the Actions artifact
service to acknowledge the upload within 60 seconds. Admission is checked again
after upload. Missing acknowledgement means no paid POST. A runner lost during a
call can therefore recover the request capability from the preceding archive and
ask the server for its receipt. Local plaintext runs do not require this secret
and do not claim recovery after loss of the whole local directory.

Incremental archives are named `flash-battery-checkpoint-...` and contain only
`battery-recovery.enc`; the final `flash-battery-recovery` artifact also includes
a nonsecret manifest. The archive uses AES-256-GCM with a fresh nonce and
authenticated format metadata. Its contents include all plaintext records and
`driver.log`; none of those files is uploaded directly. Only allowlisted aggregate
counts and outcome enums reach the public log. Public artifact visibility must
not be treated as access control for plaintext recovery capabilities.

Keep the same key available to decrypt retained artifacts. Rotation does not
re-encrypt old archives. `resume_run` accepts the encrypted artifact format;
legacy plaintext artifacts are not automatically restored. For local restoration,
make `BATTERY_RECOVERY_KEY` available in the environment and run:

```sh
node scripts/battery_archive.mjs open --archive=battery-recovery.enc --out=restored-battery
```

The destination must not already exist. Authentication and all path checks finish
before a private staging directory is installed as the destination; tampering,
a wrong key, path traversal, duplicate paths and symlinks are refused.

Sealing writes a replacement atomically. If the final seal fails, the workflow
keeps the plaintext source on the runner and any prior valid sealed archive;
it never falls back to a plaintext upload. The public manifest records
`latest_seal_succeeded: false` so an older archive cannot be mistaken for the latest
record. Unsealed files on a disposable runner are not durable after runner cleanup.
Incremental and preflight artifacts are retained for 7 days; final recovery
artifacts for 30 days. An expired remote archive cannot be used to recover a lost
capability. The local upload/seal/loss/restore regression does not prove actual
GitHub artifact availability or a hosted runner-loss recovery; those require an
actual workflow acceptance run.

## Time and outcome policy

The per-request client ceiling remains derived from the server's declared turn
wall plus its declared tool allowance. `--turn-deadline-ms` may lower that
ceiling for a transport canary, but cannot raise it.

`--max-runtime=SECONDS` bounds a driver session (default 18,000 seconds).
Before a request, retry, or re-ask, admission requires enough time for the full
client request ceiling, any pacing delay, and `--delivery-reserve=SECONDS`
(default 30). Insufficient room produces `aggregate_deadline` with a checkpoint;
it is not a finished song. The Actions job subtracts setup and deployment-wait
time from its 355-minute wall and leaves five additional minutes for recording
and artifact upload. No fixed number of songs or turns is promised to fit.

Paced HTTP 429s spend only the paced retry count and total-wait budget. Ordinary
HTTP 429/502/503 retries spend their separate bounded budget; one budget cannot
admit requests rejected by the other. A partial turn ending `UPSTREAM_429`
preserves its returned envelope and honors the recorded wait hint before the
next continuation. A stream aborted after headers, invalid JSON, or client
deadline always settles into a transport outcome and recovery lookup.

For a wall-recovery canary, `--expect=turn-wall` drives the wall response and the
next accepted continuation within the same measurement. A later invocation can
resume an interrupted measurement, but cannot mark a bare wall checkpoint as a
passed canary. Total request latency includes recovery lookup; lookup latency is
recorded separately rather than replacing elapsed request time.

After fresh finished-song and wall-canary measurements on the same exact live
build, validate their evidence:

```sh
node scripts/check_battery_acceptance.mjs --songs=fresh-song-out --wall=wall-canary-out
```

The oracle requires program-generated plans, exact certified delivery, at least
one measured accepted repair, and the exact signed wall continuation in the
request journal. The task hash binds its contract version, domain, original
brief, accumulated user instructions and program plan. Clean first drafts alone
do not prove revision.

Kitchen repair counts come from authenticated verifier outcomes followed by an
atomic application checkpoint. An accepted but unapplied candidate does not
count. Unvisited proposals, stored answers, changed lyrics and inferred interview
outcomes do not count. Stable outcome IDs contribute once across continuation
and driver restarts; the deduplication ledger is saved with the song checkpoint.
Missing or malformed kitchen evidence produces `repair_evidence_unavailable`
and preserves the raw receipt. A simultaneous actual quota refusal retains its
`rate_limited` operational reason and the evidence failure flag. CI proves these
counterexamples; it does not create paid production acceptance evidence.

## Offline regression gate

```sh
node mcp/test_battery_lifecycle.mjs
node --test mcp/test_battery_archive.mjs
node --test mcp/test_battery_storage.mjs
node --test mcp/test_release_gates.mjs mcp/test_battery_repairs.mjs mcp/test_chat_production.mjs
```

This drives the unchanged public CLI against localhost HTTP servers. It covers
bounded persistent 429s and wait sums, post-header failure paths, process death
before the first response, completion retrieval without a repeated POST,
ambiguous missing-job refusal, signed-error and receipt-capability continuation,
interrupted-job recovery, aggregate admission, exact-artifact completion policies,
atomic terminal verdict recovery, complete build identity checks,
durable-recovery admission, pending-job polling, and partial-429 pacing. The persistence-failure and retired-receipt cases use the actual job router
and receipt store. Actual HTTP tests also cover completed error receipts, stale
parent exclusion, and refusal of old semantic identities before provider dispatch. Archive tests exercise authenticated round trips, wrong keys,
tampering, path safety, and the actual workflow preflight. Storage tests drive
480 accelerated recovery polls into the real journal and seal/restore the result;
they also test total/per-file admission and missing-segment refusal. These
are local protocol fixtures; they do not claim a paid provider soak or deployment
restart measurement.

The staged-data `test:connector:live` gate also runs
`node mcp/test_kitchen_repairs.mjs`: actual HTTP, the host driver, MCP, Python
verification, a localhost writer, durable receipts and the production repair
collector. Its accepted application, rejected no-op, repeated-receipt and exact
completion controls use no paid provider. This proves the local integration; it
does not qualify a fresh full song or a real forty-minute deployment run.

# Lyrics battery measurement and recovery

The default battery verdict is **every requested song finished**. A green survey
is a different result: select `--expect=survey` explicitly to record coverage
without requiring a finished song. `--expect=turn-wall` requires a response with
`stopped: MAX_TURN_MS` and a returned signed continuation envelope. It does not
claim that the song finished or that a later continuation has been accepted.

## Run and resume

Use the exact deployed commit and require durable recovery for a paid measurement:

```sh
node scripts/flash_battery.mjs --out=battery-out --songs=1 --commit=FULL_SHA --require-recovery
```

`FULL_SHA` is the full deployed 40-character Git commit. The driver checks it
before each new paid request and records the implementation/configuration
fingerprints from `/health`. A changed fingerprint stops the measurement before
its next request, even if the Git commit is unchanged. After a successful paid
response, it also verifies the build stored on that request's receipt; this
detects a deployment between the health probe and the POST. The Actions workflow
requires the SHA, checks out that revision, and checks the live tool surface too.
The standalone `mcp/check_live.mjs` command without `--commit` remains a
**schema-only smoke** and is not a kitchen-readiness measurement.

To continue an interrupted battery, keep its output directory and use:

```sh
node scripts/flash_battery.mjs --out=battery-out --resume
```

The original base URL, commit, song selection, and options are loaded from
`run.json`. A larger `--turns=N` may be supplied if the earlier run exhausted its
turn allowance. `--expect=finished` may replace `--expect=turn-wall` to continue
from a returned wall checkpoint. The Actions `resume_run` input downloads that
run's `flash-battery-transcripts` artifact before invoking the same CLI; keep the
original song selection and commit in the dispatch inputs.

The recovery cases are deliberately different:

| Existing record | What resume does |
| --- | --- |
| A completed response was saved locally | Reuses that receipt; no repeated POST |
| Request started, server says pending | Polls the same 256-bit request capability |
| Server says completed | Reads its original response and continues from its signed envelope |
| Server says interrupted and has a signed checkpoint | Explicit `--resume` starts a new request ID from that checkpoint, recording that newer unfinished work is not recovered |
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
marker before opening the POST socket. Every received HTTP response is saved before
recovery lookup or tool interpretation. Atomic checkpoint files contain the actual
`history`, `workspace`, `lyric`, and `sig`, together with the battery's counters
and transcript offset. Resume can replay analysis from saved receipts without
repeating model work.

`summary.json` and `songN.jsonl` are the human-readable verdict/transcript files.
`songN.attempts.jsonl` records request starts, dispatches, receipts, recovery
observations, and identity checks. `songN.checkpoint.json` contains the latest
battery continuation state. Those last two files contain continuation
capabilities and are uploaded as artifacts, **not printed into public logs**.
Their presence proves what was recorded; it does not prove progress that the
server never returned or checkpointed.

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

For a wall-recovery canary, first require the wall outcome, then resume with
`--expect=finished` (or an explicitly chosen survey scope). The first stage
proves receipt/checkpoint delivery; the later stage tests acceptance of the
continuation. Neither substitutes for a completed, fully checked song.

## Offline regression gate

```sh
node mcp/test_battery_lifecycle.mjs
```

This drives the unchanged public CLI against localhost HTTP servers. It covers
bounded persistent 429s and wait sums, post-header failure paths, process death
before the first response, completion retrieval without a repeated POST,
ambiguous missing-job refusal, signed-envelope continuation, interrupted-job
recovery, aggregate admission, completion policies, SHA/configuration checks,
durable-recovery admission, pending-job polling, and partial-429 pacing. The persistence-failure and retired-receipt cases use the actual job router
and receipt store. These
are local protocol fixtures; they do not claim a paid provider soak or deployment
restart measurement.

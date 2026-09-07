# Lyrics runtime: durable requests and paid-work recovery

The lyrics kitchen spans an HTTP request, Gemini chat hops, MCP calls, a serialized
Python worker and paid proposal calls. A caller timeout does not establish which
of those operations completed. Recovery therefore follows a durable request
receipt; it does not automatically repeat an uncertain request.

## Runtime configuration

The proposed Render Blueprint mounts a **1 GB persistent disk** at `/data/lyrics`
and sets `LYRIC_RUNTIME_DIR` to that path. It retains the existing Standard plan
and disabled automatic deployment. Applying this Blueprint adds billable disk
storage; no deployment is implied by committing these files.

Render's [persistent disk documentation](https://render.com/docs/disks) states
that mounted data survives deploys/restarts, a disk belongs to a single instance,
and disk-backed services briefly stop during deployments. These stores therefore
support **one Node process and one instance**. Multiple processes or replicas need
a transactional shared store before they can safely use this protocol.

| State | Default file under `LYRIC_RUNTIME_DIR` |
|---|---|
| Request intents, progress and responses | `jobs/<request_id>.json` |
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

A request without `request_id` retains the browser's ordinary response protocol,
but has no receipt to recover. The battery uses an identifier on every attempt.

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

Storage is bounded to 128 full payloads, 8192 receipt identifiers, 4 MiB per record
and 256 MiB total. To admit new requests within these limits, the oldest completed
or interrupted payload can be retired early. Its small `retired` tombstone retains
the identifier and request digest, preventing that identifier from executing again.
A retired receipt returns no checkpoint or response and cannot be resumed.

Terminal receipt metadata expires 24 hours after the last work update. Pending
records never expire or retire inside a running process. Full storage with no
retirable terminal payload refuses new admission. Invalid and rate-limited requests
are rejected before occupying storage. A persistence failure refuses new paid chat;
GET still exposes already-retained records with a `persistence_error` and an
interrupted state for an unpersisted final response. Download full results promptly:
the 24-hour metadata retention is not a promise to keep every response body that
long.

`/health` keeps top-level `commit` and adds `build` plus `recovery`. Build identity
contains the baked commit when available, runtime-reported commit, source SHA256,
configuration SHA256 and Node version. The source digest covers deployed MCP JS/PY
and lyric-harness Python code plus package locks; it is **not** a hash of lexical
datasets, the provider's model weights or all installed dependencies. Configuration
fingerprinting covers CHAT/LYRIC/MODEL settings, model choice and trusted-proxy
count, excluding keys, secrets and tokens. Each receipt retains the identity that
accepted it. A fingerprint is useful for mismatch detection, not independent
attestation of the hosting provider.

For a long kitchen measurement, require durable recovery and the intended SHA,
record the source/configuration fingerprints, and stop if any change. First prove
one bounded request can stop and resume from its receipt; then attempt a full song.
This code and the offline regression suite do not prove live provider latency,
writer convergence, the actual mounted disk, or sustained memory headroom.

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

Battery request journals and checkpoints are written to the runner's local disk,
then encrypted before artifact upload. The workflow uploads at the end; its
preflight archive contains only the records present before paid work starts.
An abrupt loss of the runner before final sealing and upload can therefore lose
newer local records. Local fsync and the server's durable receipts do not prove
that the newest request capability has reached a downloadable artifact.

Run `node --test mcp/test_job_store.mjs`. The suite uses real Express HTTP and real
filesystem writes, with fixture work instead of a paid model. It checks intent
before dispatch, concurrent duplicate rejection, lost-socket final recovery,
SIGKILL/restart interruption, safe checkpoint preservation, corrupt persisted
state, storage failure, bounded retention and recovered retry pacing. It does not
make live Gemini calls or deploy a service.

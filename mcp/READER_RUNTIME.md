# Private Library reader runtime

Reader analysis is a deterministic, read-only family on the existing Python
worker. It never dispatches a lyric CLI verb, chat request or proposer. Its
durable jobs and immutable evidence live in `reader-jobs-v1`, separate from chat
receipts. The existing dedicated lyric lookup queue remains independent; a
reader adds no resident Python process and yields when writing work queues.

## Configuration

| Variable                      | Required behavior                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `READER_CATALOG_DIR`          | Installed immutable catalog directory containing the pinned canonical manifest, index and approved readable units. No remote source fetch.   |
| `READER_RUNTIME_DIR`          | Durable directory; defaults to `LYRIC_RUNTIME_DIR/reader-jobs`. Analysis fails closed without durable storage.                               |
| `READER_STORAGE_MAX_BYTES`    | Quota for the reader namespace; defaults to 256 MiB. Reserve metadata space and pause with `RESOURCE_LIMIT` before exhausting it.            |
| `READER_BRIDGE_SECRET`        | Server-only shared HMAC secret of at least 32 UTF-8 bytes.                                                                                   |
| `READER_SITE_ID`              | Exact trusted Site instance identifier.                                                                                                      |
| `READER_RESOURCE_FINGERPRINT` | Optional explicit qualified resource fingerprint; otherwise use the checked runtime asset inventory hash.                                    |
| `READER_REQUIRED`             | Set to `1` for a release that requires reader readiness; otherwise missing reader configuration leaves existing writing readiness unchanged. |
| `LIBRARY_SEARCH_DIR`          | The search store `lyric-harness/library/search_store.py` builds from the verified site export. Without it, `/library/v1/search` and `/metadata` answer 503. |
| `LIBRARY_PUBLIC`              | `1` mounts the credentialed `/library/v1` viewer routes (analysis). Unset or `0` until the native Library tab ships.                          |

Use the existing immutable image assembly, qualification and promotion pipeline.
Install the same canonical catalog snapshot on the Site and Render. A separate
export descriptor lists physically installed artifacts and reviewed omissions;
rights-held source bodies are omitted without changing the canonical snapshot
identity. Include `library` Python modules and generated `methods.json` and
`schema.json` in the runtime inventory. Qualification must include the combined
Node, warm writing/reader worker and independent lookup peak below 80 percent of
the deployed memory limit (1638 MiB on the current 2 GiB profile).

The CI image job runs `mcp/qualify_reader.mjs` on the exact assembled image with
one CPU, a 2 GiB memory limit and network access disabled. Its receipt binds the
baked release identity, approved asset hash, method registry and pinned snapshot.
It warms the existing writer, traverses admitted English, Welsh, Old Norse,
Finnish, Persian and Middle Chinese units, and overlaps the independent type
lookup with reader checkpoints. The memory sampler includes all descendant
processes; a result without overlapping workers cannot pass. These deterministic
calls spend no model budget. Local receipts identify their scope as
`local-runtime`; they do not replace the image gate.

## Public Library browser API (`/library/v1`)

The native Library tab on codexmusica.com reads three public, uncredentialed
routes. They are CORS simple GETs with no cookie, and every response names the
server's own snapshot (the client never sends one):

- `GET /library/v1/health`: passive (no cookie, no writes). Reports the
  snapshot, `readable_ids_sha256`, unit counts, `search_ready`, and
  `analysis_available` (true only with `LIBRARY_PUBLIC=1` and a ready reader).
- `GET /library/v1/search?q&language&availability&completeness&work&collection&contributor&sort&offset&limit<=100`:
  a line-for-line port of the approved Worker's search over the store at
  `LIBRARY_SEARCH_DIR`. It reproduces SQLite's `instr`, `substr`, ASCII
  `lower()` and BINARY ordering. Every one of the Worker's 363 search goldens
  replays byte-identically (`mcp/test_library_search_parity.mjs`, run by
  `library-site.yml`); the only intended difference is the page cap of 100
  instead of 250. No canonical reading is parsed on a request: a hit reads
  only the compressed projection chunks it intersects.
- `GET /library/v1/metadata/:id`: one unit's recorded metadata, any
  availability (held units carry no body, snippet or labels).

Search and metadata are `Cache-Control: public, max-age=300` with an ETag;
errors are `no-store`. The application's request log drops the search query
string; Render's platform logs may still hold it (see `PRIVACY.md`).

## Private pull API

All routes are under `/internal/reader`. Only the Site server calls them. The
browser receives Site reference IDs; raw backend capabilities stay in the Site's
server binding and never appear in URLs, client persistence, analytics or logs.

| Method and suffix                                       | Result                                                                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /jobs`                                            | Version 1 request with snapshot/unit/revision, declarations and requested layers. Return 202 for new work or 200 for exact retry, with the private job capability. |
| `GET /jobs/:id`                                         | Public job state, semantic identity, coverage, progress, attempt, generation and current immutable manifest hash.                                                  |
| `POST /jobs/:id/cancel`                                 | Stop at the next durable safe checkpoint; keep partial evidence.                                                                                                   |
| `POST /jobs/:id/resume`                                 | Explicitly resume a paused/cancelled job with unchanged source, declaration and runtime identity.                                                                  |
| `DELETE /jobs/:id`                                      | Delete the private analysis; retain an idempotency tombstone against implicit redispatch.                                                                          |
| `GET /jobs/:id/manifests/:sha`                          | Exact immutable manifest bytes and `X-Reader-SHA256`.                                                                                                              |
| `GET /jobs/:id/manifests/:sha/pages?offset=0&limit=100` | Ordered page references; maximum 250 references per response.                                                                                                      |
| `GET /jobs/:id/pages/:sha?manifest=:fixed_sha`          | Exact evidence page bytes, verified as a member of that committed manifest.                                                                                        |

Each evidence page contains `instances`, with at most 250 records and at most
2 MiB of encoded UTF-8. Manifest roots and control messages are also bounded;
page references use content-addressed index chunks. Old committed generations
remain independently addressable. Partial results never impersonate a completed
report. Site handlers verify hashes before returning or caching bytes in R2;
cache failure does not invalidate a durable Render result. Render performs no
inbound callback to private Site hosting.

## Signing

`reader_protocol.js` is portable to the Site edge runtime. SHA-256 hashes are
lowercase hexadecimal. `canonicalReaderSigningInput` returns these newline
separated UTF-8 fields, without a trailing newline:

```text
reader-v1
UPPERCASE_METHOD
exact URL pathname
canonical query
SHA256(exact body bytes, or empty bytes)
Site ID
viewer ID
job ID, or empty for create
attempt, or empty when unknown
generation, or empty when unknown
idempotency key, or empty for GET
SHA256(capability UTF-8, or empty bytes)
epoch seconds
random hexadecimal nonce
```

Query fields are decoded, sorted by key and value, then encoded with
`URLSearchParams`; duplicate keys refuse. Headers are `x-reader-site`,
`x-reader-viewer`, `x-reader-job`, `x-reader-attempt`, `x-reader-generation`,
`x-reader-idempotency`, `x-reader-capability`, `x-reader-time`, `x-reader-nonce`
and `x-reader-signature`. The signature is HMAC-SHA256 of that exact input. Use
the same body bytes for signing and sending. Accept a five-minute clock window.
Exact nonce replay is idempotent; changed replay refuses. Mutating actions also
have durable idempotency receipts, so a retry cannot restart a later failed
attempt. Optional control attempt/generation bindings are checked after that
durable replay lookup.

## Leases and persistence

Admission allows 16 waiting jobs, one active reader lease and two outstanding
jobs per viewer. Waiting jobs consume no Python bridge tokens. A lease lasts at
most 600 seconds and traverses the complete reading unit through safe points
every 256 candidates or one second. Successful exhaustion or writing demand
commits and requeues at the tail. A full waiting queue temporarily defers that
successful requeue until a slot opens; it still continues automatically. Failure,
restart and explicit cancellation require explicit Resume. Closing the browser
or a polling request does not cancel work.

Python emits a bounded `reader_checkpoint` frame and waits. Node fsyncs immutable
pages, then commits the fenced checkpoint cursor and page-hash index before
sending `reader_ack`. Stale attempts cannot publish. Completion requires an
exhausted committed cursor, reconciled method/evidence census and zero provider
calls; refusals produce `completed_with_refusals`. The final manifest is fsynced
before its completed pointer. Resource exhaustion preserves the preceding
cursor. A process interruption never automatically replays writing or paid work.

Private results retain 30 days without authorized access; access refreshes their
advertised expiry. Expired and deleted jobs never silently redispatch. Resume
after incompatible source/resource changes requires a separate analysis.

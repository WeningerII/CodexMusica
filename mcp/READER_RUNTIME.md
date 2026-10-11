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
errors are `no-store`. Search has a per-address abuse ceiling of 600 a minute
(owner decision 4; `LIBRARY_LIMITS` in `ratelimit.js`), refused with 429 and
Retry-After. The application's request log drops the search query string;
Render's platform logs may still hold it (see `PRIVACY.md`).

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
advertised expiry. The refresh slides in memory on every authorized read and is
persisted at most once an hour, so a restart can shorten a result's retention by
up to one hour, never lengthen it. Expiry binds at read time: a result past its
expiry is refused with `RESULT_EXPIRED` before any sweep has marked it, and a
job past its expiry is tombstoned the moment dispatch, deferred promotion or
its running lease touches it, so expired work never runs. Expired
and deleted jobs never silently redispatch. Resume after incompatible
source/resource changes requires a separate analysis.

## Storage accounting and maintenance

Reads never scan the store. Usage is an exact byte counter (the capability key,
records, pages, indexes, checkpoints and manifests) kept by deltas under the
writer lock. Every mutation first writes a `pending` marker, then bumps the
store `generation` and removes the marker when it leaves the lock. On taking the
lock, an instance that finds a marker (a crashed writer) or a generation it did
not write (another instance) reloads its records and treats its counter as
unknown.

Every job holds a 16 KiB reservation for its own record. The quota invariant is
usage plus slack at most `READER_STORAGE_MAX_BYTES`, where slack sums each
record's unused reservation, so one job's growth can never consume another's
room and any record can always grow to 16 KiB. While usage is unknown, a write
that would raise usage plus slack (a new job, a new object, or a record
outgrowing its reservation) is refused with 503 `STORE_RECOUNTING`; a record
transition inside its reservation still commits, a paused lease requeues as for
`RESOURCE_LIMIT`, and deletes and reads proceed.

A verification scan runs in slices outside the lock and is accepted only if
every measurement succeeded, no marker appeared and the generation did not move
across it. Anything else, including a failed `stat` or lock contention at
acceptance, is a failed attempt, logged as `READER_RECOUNT_FAILED` and retried
with backoff; it never marks the store unavailable. A drift found by an accepted
scan is logged as `READER_USAGE_DRIFT` and corrected.

Collection runs off the request path. Each timer slice examines at most 100
records for expiry and at most 500 objects or 64 MiB across marking and
sweeping, and stops at 50 ms. Every bound is checked before the work it limits:
an object's size before it is read or deleted, and the clock between operations.
Work that would cross a bound waits for the next slice, where expiry, the mark
(mid-chain) and the sweep's directory enumeration all resume. A slice's byte
bound may not be below the 2 MiB object limit, so an empty slice can always take
the largest object. An object is marked live only after it is read, and a failed
read abandons the whole collection, so a partial mark never sweeps. Every record
saved while a collection is open is re-marked under the lock within the same
slice budget, and the sweep is withheld until that re-mark completes inside one
hold of the lock, so under sustained writes reclamation waits rather than the
bound; another writer's commit abandons the collection. The sweep also deletes
only unreferenced objects last written before its mark began; rewriting an
object or referencing a page by hash refreshes its time. A full verification
scan runs every 15 minutes.

Object readers in Node and in the Python worker accept a stored file of at most
2 MiB holding a plain object or exactly one gzip member with no trailing bytes,
bound inflation by the same 2 MiB, and verify the address against the
uncompressed bytes. The store writes plain objects until gzip writes are
separately approved.

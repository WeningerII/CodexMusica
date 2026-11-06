# Persisted discovery state, v1 (#656)

**Status.** This is the store and wire contract for persisted discovery state. Nothing
in production reads or writes it yet. It revises R2's proposal (#665 6676478568). It
folds in 3PO's six #721 source-review obligations (6676909499), R2's ownership and
handoff decision (6676918434) and BB8's nine semantic rulings (6676928839). It is held to
BB8's reconstruction contract (6673031748) and replay ruling (6675208404 §1). Where this
text and the proposal differ, this text governs. 3PO's acknowledgement (6677006069) fixes
the `contracts.py` reservation to the checkpoint declaration and schema; the shared
`CONTRACT_VERSION` does not change.

**Base.** a0 (draft PR #816, head `aabf6eeb0`): checkpoint objects carry no cursor, and the
job record holds the one cursor that resume reads. Line references are at that head.
`analysis.py`, `worker.py` and `reader_scheduler.js` are unchanged there from main
`21e013507`.

**The interface.** The fixtures under `mcp/fixtures/discovery_v1/` are the wire interface.
Both sides implement against them. `mcp/test_discovery_v1_fixtures.mjs` recomputes every
digest and address in them from this text (§13).

| Side | Files | Owner |
| --- | --- | --- |
| Contract text, fixtures, validator | this file, `mcp/fixtures/discovery_v1/`, `mcp/test_discovery_v1_fixtures.mjs` | R2 |
| Store and scheduler | `mcp/reader_job_store.js`, `mcp/reader_scheduler.js`, `mcp/test_reader_job_store.mjs` | R2 |
| Frame plumbing | `mcp/worker.py`: segment reads by path, the frame bounds, the refusal whitelist | R2, the #721 author reviews |
| Worker and analysis | `lyric-harness/library/analysis.py`, `test_analysis.py`, and the checkpoint declaration and schema in `contracts.py` (cursor v2) | the #721 author, sole writer |
| Semantics | what counts as exact | BB8 |

Every figure measured on #656 is marked as measured (§10). None of them is a bound. The
bounds are the constants in §3, and passing any of them is a named refusal, never a
truncation.

## 1. Terms

- **Entry.** One value appended to a log (§2.1).
- **Log.** A named, append-only sequence of entries, kept for one method traversal (§2.3).
- **Chain.** A log's entries within one epoch since the log's last reset, stored as a
  linked list of segments plus a tail.
- **Segment.** One immutable, content-addressed object that holds a fixed range of a
  chain's entries (§2.5).
- **Seal.** What the worker sends to have one segment written (§2.9).
- **Tail.** The chain's entries after its last segment. It lives in the cursor and is
  always shorter than one segment (§2.4).
- **Epoch.** The method a chain belongs to: the cursor's `method_index` (§2.6).
- **Reset.** Restarting one resettable log inside an epoch (§2.6).
- **Frame.** One `reader_checkpoint` step the worker emits; the store commits it with
  `commitCheckpoint`.
- **Walk.** Reading a chain back from its head and checking it (§5).

## 2. Format

### 2.1 Entries (rules F1, F2)

- **F1, the subset.** An entry is built only from arrays, strings, booleans, `null` and
  integers n with |n| ≤ 2⁵³ − 1. Objects and non-integers are not entries. Strings are
  well-formed Unicode with no lone surrogate (Node `String.prototype.isWellFormed`; in
  Python, strict UTF-8 encoding succeeds).
- **Canonical form.** `canonical(entry)` is the UTF-8 encoding of the entry serialised with
  no whitespace:
  - Node: `JSON.stringify(entry)`. For this subset it is identical to `canonical()` in
    `reader_job_store.js:52-59`, because the subset has no objects.
  - Python: `json.dumps(entry, ensure_ascii=False, separators=(",", ":"), allow_nan=False)`.
    For this subset it is identical to `canonical_json` in `contracts.py:208-210`.
  - Non-ASCII text is raw UTF-8. `"`, `\` and U+0000–U+001F are escaped: `\b \f \n \r \t`
    in short form, the rest as `\u00xx` in lowercase hex. `/`, U+007F, U+2028 and U+2029
    stay raw. The fixture vectors pin each case, and the validator checks them against
    Python's `canonical_json` itself.
  - A Python float with an integral value, such as `1.0`, is not an entry. Python would
    write `1.0`, while Node parses it as `1` and writes `1`, so the two digests diverge.
    Node cannot see the float, but it refuses that seal by its digest (F5).
- **F2, the entry bound.** `ENTRY_BYTES = 4096`: no entry's canonical form is longer.

### 2.2 Ordered digest (rule F5)

- `d₀(D) = sha256(UTF-8(D))` for a domain string D.
- `dᵢ = sha256(dᵢ₋₁ as 32 raw bytes ‖ canonical(entryᵢ))`.
- It is lowercase hex on the wire. An empty sequence's digest is `d₀`. The digest of a
  sequence does not depend on how it is split into segments.
- Domains:
  - log L: `"codexmusica.reader.discovery.v1\n" + L`;
  - the target inventory (§6.5): `"codexmusica.reader.inventory.v1\n"`;
  - the contribution witness of method m (§6.9): `"codexmusica.reader.witness.v1\n" + m`.

### 2.3 Logs

The set of log names is closed. Any other name is refused (W1). The layout of the entries
inside each log is declared by `analysis.py` (the #721 author). This contract treats
entries as opaque §2.1 values, and the fixtures use synthetic entries.

| Log | Holds | Semantics | Resettable |
| --- | --- | --- | --- |
| `seen` | primary-phase pairs that touch a disputed word (`analysis.py:2038-2044`) | ordered set log: each key at its first insertion only | no |
| `row_seen` | the lower traversal's row dedup keys that can still recur: the current row's, and those of earlier rows whose left span has occurrences left (`lyric-harness/quality/relations.py:3351-3357`) | ordered set log, first insertion | yes |
| `variants` | preparation output, one descriptor per variant span: the line, each pinned token's full reading choice (all of `c`, not only `c[2]`), the span key, the frame key and both bucket keys | list, in preparation order | no |
| `alt_cells` | judged alternate cells, one per yielded alternate pair, false verdicts included (`analysis.py:2512-2519`). In a shared-sound epoch: its in-domain judged cells (`:2537-2546`), never an outside-domain binding | list with multiplicity | no |
| `alt_seen` | alternate keys within one line, and keys spilled from the current group past its bound (§6.4) | ordered set log, first insertion | no |

What is not logged, and why:

- **Domain tallies.** They are rebuilt from committed evidence under option 2 (§6.9).
- **Two-line alternate keys of a passed line pair.** They are retired at the group
  boundary, under a runtime guard (§6.4).
- **The target inventory.** It is recomputed on each lease from `variants` plus `seen`, and
  checked against its witness (§6.5).

### 2.4 Cut rule (rule F4)

- **Constants.** `SEGMENT_ENTRIES = 1024` and `SEGMENT_BYTES = 16384` canonical entry bytes
  (the sum of `|canonical(e)|`; separators are not counted).
- **Greedy cut, by content only.** Number a chain's entries e₀, e₁, … with bᵢ =
  `|canonical(eᵢ)|`. The first segment starts at s₀ = 0. Segment j runs from sⱼ to
  sⱼ₊₁ − 1, where sⱼ₊₁ is the largest k with k − sⱼ ≤ 1024 and Σ_{sⱼ ≤ i < k} bᵢ ≤ 16384.
  The boundaries depend only on the chain's entries, never on where steps ended, so a
  re-seal after a crash gives the same bytes and the same address.
- **Complete.** A segment is complete when it holds 1024 entries, or its entry bytes sum to
  exactly 16384, or the entry after it exists and does not fit. Only complete segments are
  sealed.
- **Open tail.** The tail must not contain a complete segment: fewer than 1024 entries and
  fewer than 16384 entry bytes. Because every entry is at most 4096 bytes, every sealed
  segment holds at least 4 entries.
- **What Node checks.** For each seal: 1 ≤ count ≤ 1024, entry bytes ≤ 16384, and
  completeness. Completeness is shown by count = 1024, or bytes = 16384, or by the next
  entry of the same log in this frame. That next entry is the first entry of the log's
  next seal in the frame, otherwise the first entry of the cursor's new tail. A seal that
  shows none of these is premature and is refused.

### 2.5 Segments (rules F3, F6)

- **Where.** A new logical object, `reader_discovery_segment`, stored as
  `pages/<sha256>.json` through `_blob('pages', …)` (`reader_job_store.js:585-624`). With
  `READER_STORE_GZIP=1` it may be stored gzipped by the existing pages rule (`:597-601`).
  It is never in an index chain, so `readPage` refuses it by membership (`:1491-1512`).
- **F3, the schema.** The field order is fixed, because `_blob` hashes `JSON.stringify`
  bytes:

  ```
  {"version":1,"kind":"reader_discovery_segment","job_id":<record id>,
   "identity_hash":<record identity_hash>,"epoch":<int>,"log":<log>,
   "previous_hash":<sha256 | null>,"first":<int>,"count":<int>,
   "digest_before":<hex>,"digest_after":<hex>,"entries":[<entry>…]}
  ```

  - `previous_hash` is the address of the previous segment of the same chain, or `null`
    for the chain's first segment.
  - `first` is the index of its first entry within the chain, and `count` equals
    `entries.length`.
  - `digest_before` is the chain digest before `first`, and `digest_after` the digest
    after its last entry (§2.2).
- **F6, the address.** The address is the sha256 of exactly those plain bytes. In Node
  that is `JSON.stringify` of an object built in this field order. In Python it is
  `json.dumps` of a dict in this order with `ensure_ascii=False` and
  `separators=(",", ":")`, and **without** `sort_keys`. It is not `canonical()` of the
  segment, which would sort the keys. With gzip, the address still covers the plain bytes.

### 2.6 Epochs and resets

- **The epoch is `cursor.method_index`** of the cursor committed with the frame. It never
  decreases over a job's commits (W2).
- **An epoch advance releases every log.** When a frame's epoch is greater than the
  record's, the record keeps none of the old epoch's chains, every seal in the frame
  belongs to the new epoch, and the frame lists no reset. The epoch may jump by more than
  one, because one step can finish a method, pass an empty or refused one and start a third
  (`analysis.py:2589-2615`). A method's logs serve only its own traversal: `seen` is
  created fresh in each `_candidates` call (`:2038`), and `_advance` already drops the
  terminal inputs (`:2445-2458`).
- **A reset restarts one resettable log inside an epoch.** Only `row_seen` is resettable.
  Resets are listed in `frame.discovery.resets`. They are applied before the frame's
  seals, and the log restarts empty (head `null`, count 0, digest `d₀`). Its old chain is
  released. A reset of a log the record does not hold is refused (W3).

### 2.7 `record.discovery`

It is owned by Node and covered by `record_digest` (`reader_job_store.js:564-567`).

```
null
| {"version":1,"epoch":<int>,
   "logs":{"<log>":{"head":<sha256 | null>,"segments":<int>,"count":<int>,"digest":<hex>}},
   "unavailable":null | {"cause":"segment_missing" | "chain_broken","log":"<log>"}}
```

- `null` means the job holds no discovery state: its frames carry none, it has completed,
  or it is a tombstone.
- `logs` names every log of the current epoch that any committed cursor of that epoch has
  named, including logs that have only a tail (head `null`, segments 0, count 0, digest
  `d₀`).
- The heads are the only GC roots (§7.2).
- `unavailable` is set only by the reconciliation pass (§7.4), in the same save that
  empties `logs`. Lease, commit and resume then refuse the job with
  `DISCOVERY_UNAVAILABLE`, naming that cause (§8).

### 2.8 Cursor v2

The cursor is owned by the worker and stored as `record.cursor`. Its declaration and schema
in `contracts.py` belong to the #721 author. Today's fields stay: `identity_hash`, `phase`,
`method_index`, `candidate`, `emission`, `sequence`, `counters`, `methods`, `done` and
`incomplete`. The changes:

- **`contract_version: 2`.** This is the cursor version. It is separate from
  `CONTRACT_VERSION` (1) in the identity (`contracts.py:18`, `:253`), which does not move.
- **`incomplete`** (`{name: reason}`) is also written at the moment either preparation flag
  is set (§6.6).
- **`discovery`:**

  ```
  {"version":1,"epoch":<int>,
   "logs":{"<log>":{"sealed":<int>,"sealed_digest":<hex>,"tail":[<entry>…]}},
   "inventory":null | {"count":<int>,"digest":<hex>},
   "groups":{"through":null | [<int>,<int>],
             "current":null | {"lines":[<int>,<int>],"keys":[<entry>…]}}}
  ```

- **`witness`:** `null`, or
  `{"version":1,"epoch":<int>,"method_id":<str>,"fields":[<str>…],"count":<int>,"digest":<hex>}`
  (§6.9).
- **`continuation`:** the worker's positions, opaque to Node beyond its bound (§3). The
  agreed minimum of names (3PO 2 and 4; the #721 author fixes the inner schema):
  - `stage`, `position`;
  - `row`: the row index and the position within it;
  - `pending`: `{"binding": <entry>}`, the binding being emitted; its fragment offset is the
    existing `emission`;
  - `shared_sound`: `{"token", "span", "missing_word"}`.

Node checks the cursor's shape and bounds and its agreement with the record (W4), nothing
of its meaning.

### 2.9 `frame.discovery`

The worker's `step()` adds it to the step (`analysis.py:2622-2624`). The scheduler passes it
as `discovery` in the `commitCheckpoint` payload (`reader_scheduler.js:553-558`).

```
{"epoch":<int>,"resets":[<log>…],
 "seals":[{"log":<log>,"first":<int>,"entries":[<entry>…],
           "digest_before":<hex>,"digest_after":<hex>}…]}
```

A frame carries `discovery` exactly when its cursor carries `discovery`. A frame and cursor
with neither leave the store as it is today, which is how the store half stays inert until
the worker half ships. A frame whose record holds discovery but whose cursor has none is
refused (W4).

### 2.10 Lease payload `discovery`

`workerPayload` (`reader_job_store.js:1513-1531`) adds it, and the scheduler passes it to the
worker beside `checkpoint` (`reader_scheduler.js:523-532`).

```
null
| {"version":1,
   "summary":{"epoch":<int>,"logs":{"<log>":{"head","segments","count","digest"}}},
   "paths":{"<log>":["<store>/pages/<sha256>.json", …]}}
```

- `summary.logs` equals `record.discovery.logs`.
- Every log in the summary has a `paths` entry holding exactly `segments` absolute paths,
  **oldest first**.
- A record whose `discovery.unavailable` is set never reaches a lease payload: the lease is
  refused first.

## 3. Hard limits

Each limit is a contract constant. Passing one is a named refusal on each side, never a
truncation.

| Constant | Value | Worker, before it emits | Store, on the frame |
| --- | --- | --- | --- |
| `ENTRY_BYTES` | 4096 per entry | `RESOURCE_LIMIT` (cause `discovery_entry_bytes`) | `READER_PROTOCOL` (F2) |
| `SEGMENT_ENTRIES` | 1024 per segment | cut rule (§2.4) | `READER_PROTOCOL` (F4) |
| `SEGMENT_BYTES` | 16384 entry bytes per segment | cut rule (§2.4) | `READER_PROTOCOL` (F4) |
| tail | fewer than 1024 entries and 16384 bytes | seal | `READER_PROTOCOL` (W4) |
| `FRAME_SEALS` | 8 seals per frame (≤ 128 KiB of entry bytes) | end the step at the next safe point; a unit that alone needs more: `RESOURCE_LIMIT` (cause `discovery_frame_seals`) | `READER_PROTOCOL` (W1) |
| `CHAIN_SEGMENTS` | 2048 segments per chain (≤ 32 MiB of entry bytes) | `RESOURCE_LIMIT` (cause `discovery_chain_segments`) | `READER_PROTOCOL` (W5) |
| `GROUP_KEYS`, `GROUP_BYTES` | 32 keys and 8192 entry bytes in the current group | spill to `alt_seen` (§6.4): a spill rule, not a refusal | `READER_PROTOCOL` (W4) |
| `WITNESS_FIELDS` | 16 field names, each ≤ 64 bytes | — | `READER_PROTOCOL` (W4) |
| `CONTINUATION_BYTES` | 8192 canonical bytes | `INVARIANT_FAILURE` (an engine defect) | `READER_PROTOCOL` (W4) |
| frame | 2 MiB (`worker.py:166`, `python_bridge.js:16`) | the existing frame refusal | — |
| control payload and record | 2 MiB (`READER_LIMITS.objectBytes`) | — | the existing `RESOURCE_LIMIT` 413 (`reader_job_store.js:78-83`) |

A worker `RESOURCE_LIMIT` pauses the job with that reason and does not requeue it
(`reader_scheduler.js:592-597`).

Derived bounds, computed from the constants (not measured):

- **`cursor.discovery`** is at most five tails of under 16384 entry bytes plus 1024
  separators each, plus one group of 8192 bytes plus 32 separators, plus about 1 KiB of
  envelope: about 96 KiB.
- **A frame** is at most 1 MiB of records (`worker.py:161`), plus the cursor (about 96 KiB
  of discovery, 8 KiB of continuation, the witness and today's fields), plus 8 seals of
  under 17.5 KiB each, plus the summary: about 1.3 MiB, under the 2 MiB caps.
- **The record test bound** is derived the same way: logs × (16 KiB + 1 KiB) + 8 KiB + 32
  KiB, plus the inline page refs while `page_count` ≤ 250 (`reader_job_store.js:1062`).

## 4. Write path

There is no new channel. A frame's seals ride the existing step and its acknowledgement.

1. `step()` emits `discovery` (§2.9).
2. The scheduler passes it to `commitCheckpoint`.
3. Under the lock, after `_leaseRecord` and the exact-retry check
   (`reader_job_store.js:1042-1045`), the store checks everything below **before it writes
   anything**. The retry digest covers `discovery`, so an exact retry writes nothing. Every
   failure is refused with `READER_PROTOCOL` (400) and nothing is written. The job then
   pauses with that reason and is not requeued.
   - **W1, the frame's shape and bounds.** `epoch` is an integer ≥ 0. `resets` lists only
     resettable logs, each at most once. There are at most `FRAME_SEALS` seals, each naming
     a log in §2.3, with an integer `first` ≥ 0, a nonempty `entries` array and two
     64-character lowercase hex digests.
   - **F1, F2** on every entry in the seals, in the cursor tails and in the group keys.
   - **W2, the epoch rule.** `epoch` equals `cursor.method_index` and
     `cursor.discovery.epoch`, and it is at least `record.discovery.epoch`. If it is greater,
     every old chain is released and `resets` is empty.
   - **W3, continuity.** Apply the frame to the record's chains: release on an advance, then
     the resets (each must name a log the record holds in this epoch), then each seal in
     order. Each seal's `first` equals the log's count, and its `digest_before` equals the
     log's digest, both taken after the seals before it.
   - **F5.** The store recomputes `digest_after` from `digest_before` and the entries, and
     it must equal the seal's.
   - **F4, the cut rule** on each seal (§2.4).
   - **W5.** No chain holds more than `CHAIN_SEGMENTS` segments.
   - **W6, append-only tails.** In the same epoch, for every log not reset by the frame,
     the previous cursor's tail (`record.cursor`) is a prefix of this frame's seal entries
     for that log followed by the new tail, compared entry by entry in canonical form.
   - **W4, agreement.** After the frame, `cursor.discovery` names exactly the record's logs.
     For each log, `sealed` equals the count and `sealed_digest` equals the digest. Every
     tail is open (§2.4). `groups` keeps within `GROUP_KEYS` and `GROUP_BYTES`, and
     `through` and `lines` are integer pairs. `inventory` is `null` or a count and digest,
     and once it is non-null in an epoch it does not change until the epoch advances.
     `witness` is `null` or well formed, with its `epoch` equal to the frame's.
     `continuation` stays within `CONTINUATION_BYTES`. A record holding discovery with a
     cursor that has none also fails W4.
4. **Write order:** pages, indexes, manifest and checkpoint as today
   (`reader_job_store.js:1051-1097`), then one segment per seal in seal order (each
   `previous_hash` is the log's head at that point), then the record (`:1098-1111`). The
   record's `discovery` becomes `{version: 1, epoch, logs, unavailable: null}`, where each
   seal sets `head` to the new address, adds one to `segments`, adds its count to `count`
   and sets `digest` to the recomputed digest.

## 5. Resume path

### 5.1 The store's walk

`workerPayload` and `resume` run it, so a lease checks the walk before the worker starts,
and `resume()` refuses a dead job at once instead of queueing it
(`reader_job_store.js:1369-1408`).

- If `record.discovery.unavailable` is set, the store refuses with `DISCOVERY_UNAVAILABLE`
  and that cause, without walking.
- For each log whose head is not `null`, it reads back from the head through
  `previous_hash`. Each read goes through `_object('pages', …)`, which is bounded and
  address-checked. A missing segment or changed bytes found there are `STORAGE_CORRUPT`
  (503), as for every object (§7.4).
- **F3** on each segment: the kind, the version, `job_id`, `identity_hash`, `epoch` equal
  to the record's epoch, and `log`.
- **R2, one chain per log.** Following the rules below, any failure is
  `DISCOVERY_UNAVAILABLE` (409) with cause `chain_broken`:
  - each segment's `first` equals the previous segment's `first + count`, and its
    `digest_before` equals the previous `digest_after`;
  - the oldest segment has `previous_hash: null`, `first: 0` and `digest_before = d₀`;
  - the head's `first + count` equals the record's `count`, and its `digest_after` equals
    the record's `digest`;
  - the number of segments equals the record's `segments`.
- It returns `discovery: {version: 1, summary, paths}`, oldest first (§2.10). For #656 that
  is 99 objects in about 10 ms (measured, §10).

### 5.2 The worker's load

- The worker reads each path with the bounded, address-checked page reader
  (`worker.py:97-123`).
  - **R1.** Every path resolves; otherwise `DISCOVERY_UNAVAILABLE`, cause
    `segment_missing`. This can happen when an older image sweeps a segment after the walk.
  - **F6.** Changed bytes are `STORAGE_CORRUPT`.
- **F3 and R2** as in §5.1, with cause `chain_broken`.
- **F5.** Every segment's `digest_after` is recomputed from its entries. A mismatch is cause
  `digest_mismatch`.
- **R3, cursor agreement.** The summary's epoch and log names equal `cursor.discovery`'s.
  For each log, `count` equals `sealed` and `digest` equals `sealed_digest`. A mismatch is
  cause `cursor_disagrees`.
- **Membership.** It is then each log's sealed entries followed by its tail.
- **When `alt_cells` is read.** It is read only when the terminal record is built
  (`analysis.py:2386-2403`, `:1870-1879`). Until then the store's walk still checks its
  chain on every lease, and the cursor carries its count and digest.

### 5.3 The target inventory (R4)

On each lease after preparation, the worker recomputes the target inventory from `variants`
plus `seen`. Its count and ordered digest (§2.2, inventory domain) must equal
`cursor.discovery.inventory`; a mismatch is `DISCOVERY_UNAVAILABLE`, cause
`inventory_mismatch`. The inventory is recorded once, when preparation completes, and Node
holds it fixed for the rest of the epoch (W4).

## 6. Worker semantics

These are BB8's rulings applied to the wire. `analysis.py` and its tests belong to the #721
author; each item names the test that has to fail before the change and pass after it.

### 6.1 `seen`

`seen` is persisted (BB8 4) as an ordered set log: first insertion only (BB8 5). It is read
only for membership (`analysis.py:1012`, `:1079`) and never iterated, so membership is all
its meaning; the order only makes the bytes canonical. **Test:** a guard that no consumer
iterates `seen`. If one ever does, ruling 5 is reopened.

### 6.2 `row_seen` and the lower traversal

`_candidate_pairs` supports repeated left spans: it keeps a row's dedup state until that
left span's last occurrence (`lyric-harness/quality/relations.py:3351-3357`). The #656
layout has 1,560 rows and no repeated left span, but that is a measurement (3PO 1), so it
cannot justify discarding dedup history. The row dedup keys that can still recur are
therefore persisted in `row_seen`, first insertion only. The log is reset at a row
boundary once no live row state remains, so it holds no more than the live dedup state and
no more garbage than the rows' sealed segments. The row index and the position within the
row are in `continuation.row`. **Test:** a fixture with repeated left spans, restarted
mid-row, matches the uninterrupted run (BB8 4).

### 6.3 The pending binding

Membership is updated before the yield. At a checkpoint the pending binding
(`continuation.pending` plus `emission`) is kept exactly. On resume the pending binding
wins: it is re-emitted from its fragment offset even though its key is already in `seen` or
the group, and the key is not added again (3PO 2). **Test:** restart between the `seen.add`
and the yield, and at every boundary inside a binding whose membership was already
recorded; nothing is skipped and nothing is counted twice.
`good/retired_group_then_within_line.json` carries a checkpoint and resume inside a pending
binding.

### 6.4 Alternate keys and their groups (rule S1)

The argument holds (BB8 1). A target's stream is non-blank only on its own lines (`:570`),
every cell of a span key carries its line (`:612-627`), and targets sort by their lines first
(`:1020`, `:1039`). So a two-line key can only recur inside its own contiguous line-pair
group. The code checks this while it runs, and does not assume it. For an alternate key k
with line pair L (compared as pairs, lexicographically):

- **Within one line** (L = [l, l]): k goes to `alt_seen`, always. If a current group exists
  and L comes after it, that group is retired first.
- **The current group's pair:** k is checked against `current.keys` and `alt_seen`. A new
  key joins `current.keys` while the group stays within `GROUP_KEYS` and `GROUP_BYTES`;
  past that bound it spills to `alt_seen`, where it is kept for the whole epoch.
- **After the current group** (or after `through` when there is no current group): this is
  the group boundary. The current group is retired (`through` becomes its pair), and L opens
  a new current group holding k.
- **Before or at the last retired pair, or before the current pair:** the traversal refuses
  with `DISCOVERY_UNAVAILABLE`, cause `retired_key_recurred`. It never counts the key as
  new. This refuses every key of a retired group, and conservatively every pair the sort
  says was already passed.
- A group is retired only at its boundary, after its pending emission has completed.
- **Test:** a fixture whose sort is broken on purpose triggers the refusal
  (`bad/retired_key_recurring.json`).

### 6.5 The target stage (BB8 3)

The inventory is recomputed on each lease, with a witness (§5.3). BB8's criterion, made
precise: after preparation, resume cost does not depend on where the cursor is and never
re-traverses work already emitted; recomputing from logged state is allowed. A fixed
recompute of 0.9–2.4 s (measured) meets it.

### 6.6 Incomplete-search flags (BB8 6)

Variant preparation's flag (`analysis.py:958`) and the `MINI_CAP` flag (`:1036`) are not
in the cursor today; they "replay themselves" (`:474-476`). Once variants are read from the
log, they would be lost, and `_finish` would report an incomplete search as answered
(`:2396-2401`). Each is written into `cursor["incomplete"]` at the moment it is set, as
`:717` already does. **Test:** for each flag, a restart after it is set still reports the
method incomplete.

### 6.7 Progress ticks (BB8 7)

Ticks give zero-record preparation and duplicate scans their own safe points (6675208404
§1). A tick emits no record and moves no counter: it is not a candidate
(`delta["candidates"] = 1` at `:2556` must not apply to it), and records and counters are
unchanged from an uninterrupted run. The step deadline also applies to a step with no
records: `if records and …` (`:2590`) becomes `if (records or used) and …`. Otherwise 256
preparation ticks (4–12 s, measured) can straddle the lease end (`reader_scheduler.js:533-539`),
which ends in `INTERRUPTED` with no requeue (`reader_job_store.js:930-950`). **Test:** a run
that ends on tick-only steps gives the same records and counters as an uninterrupted run,
and a tick-only step stops by its deadline.

### 6.8 Shared-sound traversal (3PO 4)

The traversal at `analysis.py:2537-2546` gets the same treatment, held to everything in §6.
It has its own continuation (`continuation.shared_sound`: token, span and missing-word
positions). It keeps "false with a domain" apart from "outside the domain": an in-domain
judged cell, false included, is an `alt_cells` entry of its epoch, and an outside-domain
binding moves no counter and logs nothing.

### 6.9 Domain tallies: option 2 (BB8 2, under 6673031748; rule S2)

Domain tallies are not logged. They are rebuilt from committed evidence.

- **The governing rule.** A record missing from committed history is never negative
  evidence. A reconstruction that cannot prove it read the whole committed contribution
  stream refuses. It never computes `judged_false` from what it has.
- **The witness.** `cursor.witness` holds a count and an ordered digest (§2.2, witness
  domain) over **every** record on the method's stream, in commit order, eligible or not.
  Each record contributes the tuple of `witness.fields`, read from the record, with `null`
  for an absent field. The v1 fields are
  `["method_id", "id", "verdict", "a.token_ids", "b.token_ids"]`: everything
  `_domain_tally` reads (`analysis.py:1466-1479`), endpoint roles included. The field
  list is the one place they are enumerated, and it travels with the cursor. Adding a
  field the reducer reads changes the cursor; each field needs one mutant in the tests.
- **Commit before terminal.** Positive emissions are acknowledged durably before the step
  that reconstructs. The reconstruction reads durable history only (`load_records`), never
  `_local_records`, so a durable/local overlap never counts twice.
- **Multiplicity.** Repeated ids are distinct emissions. Nothing deduplicates by public id
  or token pair, or normalises roles, before hashing or counting.
- **Retention.** The witness stays in the cursor until the epoch advances, which is after
  the terminal detail emission has finished.
- **Refusal.** A count or digest mismatch, a missing, inserted or reordered record, a
  same-count replacement or an endpoint-role swap refuses as `RESULT_EXPIRED`
  (6673031748 §2), before pair reduction, with no partial terminal.
- **The store's part is its delivery promise.** `load_records(method_id)` yields exactly
  the committed records, in commit order, with their multiplicity: no redelivery, no
  deduplication, no reordering (R2's store test, #665 6674027857 §1).
- **Fallback.** If reading the evidence at finish is too slow (about 63 MB plain on #656,
  time not yet measured), the fallback is domain logs, with the same semantics and no new
  ruling.

### 6.10 What exact means (6675208404 §1)

At every checkpoint boundary, a resumed run's committed transcript equals an uninterrupted
run's: the same records, in the same order, with endpoint roles as first discovered, and the
same multiplicity, repeated public ids on distinct bindings included. Incomplete-search
behaviour is preserved too. **Test:** restarting at every step boundary equals the
uninterrupted run. The restart points include mid-preparation, a zero-yield target,
mid-target, mid-group, mid-emission and across a method boundary.

### 6.11 Resume cost (BB8 8)

A fixed resume cost of about 8–19 s (measured: construct plus load plus recompute) meets
the criterion in §6.5. It does not depend on position after the primary phase, and nothing
is re-traversed. The measured gate stays: in the proof run, every lease's first commit lands
within 30 s of the lease start.

## 7. Retention, GC roots and crash ordering

### 7.1 What stays live

Segments reachable from the heads of records in the queued, running, paused or cancelled
states stay live.

- Cancelled jobs can resume (`reader_job_store.js:1381-1385`), so they keep their discovery.
- So do jobs paused by quota (`_quotaPause`, `:972-990`), by lease expiry (`:930-950`), or by
  `READER_ERROR`.

### 7.2 Release points and GC roots

Each release point is a single record save; GC then reclaims the segments.

- an epoch advance (§2.6);
- a `row_seen` reset (§2.6);
- `complete()`, which saves `discovery: null` (`:1236-1246`);
- expiry or delete: `_tombstone` rebuilds the record without the field (`:1532-1566`);
- reconciliation (§7.4).

GC:

- Add one `['discovery', head]` root per non-null head, next to the checkpoint root, in
  three places: `_markRecord` (`:1667-1671`), the mark loop (`:1783`) and the re-mark
  (`:1804`).
- In `_markStep` (`:1632-1662`), a `discovery` entry reads from `pages/`, marks `live.pages`
  and pushes its `previous_hash`. `live` holds only `OBJECT_KINDS` (`:45`), so the kind must
  be mapped to `pages`; indexing `live.discovery` would throw.
- The sweep is unchanged.
- Chains are append-only and their tails live in the record, so a running job creates no
  discovery garbage except a reset `row_seen`'s sealed segments.

### 7.3 Crash ordering

- **A segment is synced but the record is not saved.** The orphan is collected. On resume
  the worker re-seals identical bytes (the cut rule), and `_blob` refreshes the file's
  mtime (`:592-595`).
- **The record is saved but not acknowledged.** Resume continues from the new cursor.
- **A crash during a release or `complete()`, before the record save.** The old chain is
  still referenced, so the job resumes, or is marked interrupted and completes again.
- **`RESOURCE_LIMIT` (507) or `STORE_RECOUNTING` during a commit.** `_quotaPause` keeps the
  previous cursor and heads. The orphans are up to about 1 MiB of pages, indexes, manifest
  and checkpoint, as today, plus at most 8 segments. They count against quota until swept.
- **A seal lands while a collection is open.** The new file is newer than the mark, and the
  record is marked dirty, so it is never swept.
- **An exact retry** writes nothing.
- **Only GC deletes.**

### 7.4 Missing segments: where tolerance is allowed

- **Who can delete a live segment:** only an older image, because its GC has no discovery
  root. Instances share the store directory and the lock is held per write
  (`mcp/READER_RUNTIME.md`), so an old instance can sweep while a new one runs.
- **Where the store can notice:** in exactly two places, at startup (`:342-379`) and when
  it finds a generation it did not write (`_enterLock`, `:435-448`, which already reloads
  the records and abandons the GC).
- **Reconciliation.** Only there does the store stat every segment of every live chain
  (about 100 stats for a #656-sized job, computed from its 99 segments). A chain with a missing segment is
  released in one save: `logs` emptied and `unavailable: {cause: "segment_missing", log}`.
  A log line is written. Lease, commit and resume then refuse that job from the record.
- **Startup order.** At startup the pass runs before the startup collection, which a0 moved
  ahead of the pauses (`:351-352`). Otherwise the mark would meet the missing segment and
  fail the store. The release only shrinks a record, so it commits before usage is known.
- **Everywhere else** a missing segment is `STORAGE_CORRUPT`, like any other object, and a
  mark that meets one abandons the collection, as today. The new image's own bugs stay
  visible. Implementation: stat each segment before reading it, because `_object` maps
  `ENOENT` to `STORAGE_CORRUPT` (`:668-683`), and an error without a status inside `_open`
  makes the whole store unavailable.

## 8. Refusals

Nothing is ever reinterpreted, and missing state is never rebuilt.

| Code | Status | Raised by | When |
| --- | --- | --- | --- |
| `READER_PROTOCOL` | 400 | store, `commitCheckpoint` | any of F1–F6 or W1–W6 on a frame. Nothing is written; the job pauses with this reason and is not requeued. |
| `DISCOVERY_UNAVAILABLE` | 409 | store (lease, commit, resume from `unavailable`; walk) and worker (load, traversal) | causes below |
| `STORAGE_CORRUPT` | 503 | store; worker | a segment's bytes do not match its address (F6), or the store meets a missing segment outside reconciliation |
| `STALE_READING` | 409 | worker | a v1 cursor on a v2 worker, or a v2 cursor on a v1 worker (`analysis.py:464`) |
| `RESULT_EXPIRED` | 410 | worker | the option 2 witness disagrees with durable history (§6.9) |
| `RESOURCE_LIMIT` | — (the job pauses) | worker | a §3 limit the worker cannot meet by ending its step |

`DISCOVERY_UNAVAILABLE` always names its cause. 409 matches `STALE_READING`; 410 stays with
`RESULT_EXPIRED`, because here the result is not gone. The causes:

| Cause | Rule | Raised by | Message |
| --- | --- | --- | --- |
| `segment_missing` | R1 | worker; store from `unavailable` | This analysis can no longer resume exactly: part of its saved progress is missing. Its committed evidence stays readable. Delete it, then create a new analysis with a new key. |
| `chain_broken` | R2, F3 at read | store walk; worker | This analysis can no longer resume exactly: part of its saved progress does not fit together. Its committed evidence stays readable. Delete it, then create a new analysis with a new key. |
| `digest_mismatch` | F5 at read | worker | This analysis can no longer resume exactly: part of its saved progress does not match its record. Its committed evidence stays readable. Delete it, then create a new analysis with a new key. |
| `cursor_disagrees` | R3 | worker | the `digest_mismatch` message |
| `inventory_mismatch` | R4 | worker | the `digest_mismatch` message |
| `retired_key_recurred` | S1 | worker | This analysis cannot continue exactly: its search met a line pair it had already finished. Its committed evidence stays readable. A new analysis of the same text would stop at the same place. |

Plumbing (R2's side):

- `worker.py`'s whitelist (`:263-264`) gains `DISCOVERY_UNAVAILABLE` and `STORAGE_CORRUPT`;
  otherwise they surface as `READER_ERROR`.
- The worker's reply gains `error_cause`, from the closed cause set; anything else is
  dropped.
- The paused record's reason carries `{code, cause, message}`.

**There is no new job state.** Every image's `_reload` refuses an unknown state as
`STORAGE_CORRUPT` (`:491-498`), so adding a state would be a format break. A job refused with
`DISCOVERY_UNAVAILABLE` therefore stays `paused`. It holds one of its viewer's two slots
(`:12`, `:832`, `:1389`), and a create with the same key returns it.

## 9. Compatibility and release

- **Store format.** There is no change to `store-format.json`, `min_reader`, the format gate
  (`scripts/reader_format_gate.mjs`), the image label or the inflate tool. With gzip on,
  segments follow the existing marker logic.
- **Old images on a new store.** They count segments, and sweep them as unreferenced pages.
  They keep `record.discovery` through their `_save` spreads, and their `_reload` accepts
  the unknown field. When the new image returns, reconciliation releases those jobs, which
  then refuse to resume. Their evidence stays readable.
- **Cursor v2.** One cursor version carries the continuation, the discovery logs and option
  2's witness (6675208404 §3). It has its own `contract_version: 2`, which old workers
  already refuse at `analysis.py:464`. That matters because the job identity does not always
  change between images: with no baked build identity, the commit is null
  (`mcp/build_identity.js:31`) and the resource fingerprint falls back
  (`mcp/server_http.js:302-306`); the scheduler acknowledges this at
  `reader_scheduler.js:133-136`. New workers must refuse v1 cursors with `STALE_READING`;
  that check does not exist yet. There is no implicit migration.
- **The shared `CONTRACT_VERSION` does not move.** It is part of the identity
  (`contracts.py:253`), the result schemas and the registry.
- **Release.** The store half and the worker half ride one runtime train; both change the
  fingerprint (`mcp/IMAGE_RELEASE.md`). The store half does nothing while frames carry no
  `discovery`. Jobs paused on the previous image refuse `STALE_READING` anyway
  (`reader_scheduler.js:519-521`).
- **Proof run (R2).** It runs on a fresh disposable store with `READER_STORE_GZIP=1`, on the
  qualified image. It passes when the run completes, every lease's first commit lands within
  30 s of the lease start, discovery is about 1.6 MB plain and 0.2 MB stored, the store is at
  or below 40 MiB, frames are at or below 1.3 MiB and the record stays within its bound. It
  records the restart count, each restart's cost, `row_seen`'s size and worker memory in the
  alternate phase. It is the completed run that Phase B needs (`mcp/READER_RUNTIME.md`).

## 10. Measured on #656, not bounds

All of these were measured read-only on the #656 run store, or computed from measured entry
sizes. Times are light host / loaded host. None is a bound; the bounds are in §3.

| Figure | #656 value | Kind |
| --- | --- | --- |
| `seen` | 19,880 entries, 80 segments, 1.34 MB with envelopes, about 0.15 MB gzip | measured |
| `seen` key | 65.3 B mean, 1.6 B per primary pair; 2.45% of pairs touch a varying word | measured |
| `variants` | 165 descriptors of about 240 B (211 B measured for `c[2]` alone), 3 segments, 0.04 MB | measured |
| `alt_cells` | 12,105 entries of 20.45 B, 16 segments, 0.25 MB | measured |
| `alt_seen` | 0 entries: no within-line alternate pair, 6,250 line pairs each one contiguous run, at most 2 pairs per line pair | measured (BB8 1, 3PO 6) |
| primary rows | 1,560 rows, no repeated left-span index | measured (3PO 1) |
| `row_seen` | not measured; added by this revision | the proof run records it |
| segment envelope | about 550 B | measured |
| discovery total | about 1.64 MB plain, about 0.2 MB gzip | computed |
| per lease | walk about 10 ms; load 20,045 entries × 30.4 µs = 0.6 / 1.5 s; recompute 0.9 / 2.4 s; construct 6.4 / 15.2 s; about 8 / 19 s in all | measured |
| per commit | about 0.22 KB retained on average | computed |
| GC at the end of the run | about 80 min per cycle, against 17 | computed |
| preparation ticks | 256 ticks take 4–12 s | measured |
| option 2's read at finish | about 63 MB plain; time not measured | 3PO measures |
| store at the end | about 31.2 MiB with gzip on, about 115 MiB with it off | computed |
| resume growth (3PO's fixtures) | 33 / 129 / 513 work units for 8 / 32 / 128 discoveries, against 61 / 625 / 8,641 for earliest-existing-owner | measured |

## 11. Cross-reference

| # | Source | Obligation or ruling | Contract | Fixture or test |
| --- | --- | --- | --- | --- |
| 1 | 3PO 1 (6676909499) | `_candidate_pairs` supports repeated left spans; Whitman's unique rows justify nothing in general | §2.3 `row_seen`, §6.2, §10 | #721: repeated left spans restarted mid-row |
| 2 | 3PO 2 | membership is updated before yield; the pending binding is restored with no skip and no double count | §2.8 `continuation.pending`, §6.3 | `good/retired_group_then_within_line.json`; #721: restart between `seen.add` and the yield |
| 3 | 3PO 3 | option 2: ordered contribution witness, commit-before-terminal boundary, witness kept through terminal detail emission, no public-id or token-pair dedup | §2.8 `witness`, §6.9 | `good/witness_cursor_option2.json` |
| 4 | 3PO 4 | shared-sound traversal: its own token, span and missing-word continuation; false-with-domain apart from outside-domain | §2.3 `alt_cells`, §2.8 `continuation.shared_sound`, §6.8 | #721 |
| 5 | 3PO 5 | cursor v2 touches `contracts.py`'s checkpoint declaration and schema | owners table, §2.8, §9 | — |
| 6 | 3PO 6 | descriptor sizes, an empty `alt_seen` and lease timings are measurements, not bounds | §3, §10 | `bad/over_bound_seal.json` |
| 7 | BB8 1 (6676928839) | retire passed two-line groups with a runtime refusal if a retired key recurs; within-line keys always logged | §2.3 `alt_seen`, §2.8 `groups`, §6.4, §8 | `good/retired_group_then_within_line.json`, `bad/retired_key_recurring.json` |
| 8 | BB8 2 | option 2 for tallies | §6.9 | `good/witness_cursor_option2.json` |
| 9 | BB8 3 | recompute targets on each lease, with an inventory count and digest checked each lease | §2.8 `inventory`, §5.3, §6.5, W4 | `good/lease_payload_summary_paths.json` (R4) |
| 10 | BB8 4 | persist `seen`; row dedup persisted, or proven by a mid-row test | §2.3, §6.1, §6.2 | `good/seal_sequence_two_logs.json`; #721 mid-row test |
| 11 | BB8 5 | `seen` as an ordered set log is fine; guard that no consumer iterates it | §2.3, §6.1 | #721 guard test |
| 12 | BB8 6 | the two flags go into `cursor.incomplete` (required) | §2.8, §6.6 | `good/lease_payload_summary_paths.json` cursor; #721 |
| 13 | BB8 7 | ticks: records-or-used deadline; records and counters unchanged | §6.7 | #721 |
| 14 | BB8 8 | a fixed 8–19 s resume is acceptable; the 30 s proof-run gate stays | §6.11, §9, §10 | proof run |
| 15 | BB8 9 | `DISCOVERY_UNAVAILABLE`, 409, with the cause named | §8 | `bad/missing_segment.json`, `bad/reordered_segment.json`, `bad/retired_key_recurring.json` |
| 16 | BB8 6673031748 | exact ordered delivery; witness over every record; refusal, never a quieter fallback | §6.9 | `good/witness_cursor_option2.json` |
| 17 | BB8 6675208404 §1 | replay is exact at every boundary; ticks and pending state checkpointable | §6.3, §6.7, §6.10 | #721 restart-at-every-boundary test |
| 18 | R2 6676918434 | one interface, tested from both sides, as versioned fixtures | §13 | the whole fixture set |

## 12. Added in this revision, for confirmation

None of these is in the posted comments. They fill gaps the rulings left open, and BB8 (the
semantics) and 3PO (the cursor fields) confirm or strike each one.

1. `row_seen` as a log that is reset at row boundaries, and the frame's `resets` field: the
   mechanism for 3PO 1 and BB8 4. Logging every row's dedup keys without a reset would
   retain every primary candidate pair.
2. W6, append-only tails: Node checks that the previous cursor's tail is a prefix of what
   follows it.
3. `CHAIN_SEGMENTS = 2048` per chain, which bounds the walk.
4. The group bound (`GROUP_KEYS = 32`, `GROUP_BYTES = 8192`), with spill to `alt_seen`. This
   puts a number on the proposal's "a group's keys beyond the cursor bound".
5. `record.discovery.unavailable`, which records a reconciliation release.
6. The closed cause set and the per-cause messages. `retired_key_recurred` is deterministic,
   so its message does not tell the reader to create a new analysis.
7. The worker's whitelist gains `STORAGE_CORRUPT` as well, and its reply gains
   `error_cause`.
8. The inventory and witness digest domains, and the v1 witness fields.
9. Node holds the inventory fixed within an epoch, and requires `discovery` on a frame
   exactly when the cursor has it.

## 13. Fixtures and validator

`mcp/fixtures/discovery_v1/README.md` lists every fixture, one line each, with the rule it
exercises and the refusal it expects. The good fixtures are accepted with no refusal. Each
bad fixture violates exactly the rule it is named for and passes every other rule.

- `good/seal_sequence_two_logs.json`: three frames in one epoch that seal `seen` and
  `alt_cells` in one frame and `alt_cells` again in the next (a chain across frames), with
  tails, canonical-form vectors and cut-rule vectors.
- `good/epoch_jump.json`: a frame from epoch 2 to epoch 5 that releases the old chains.
- `good/retired_group_then_within_line.json`: group retirement, then a within-line key
  going to `alt_seen`, with a checkpoint and resume inside a pending binding.
- `good/witness_cursor_option2.json`: a full cursor v2 carrying the option 2 witness, over
  a stream with a repeated id and a durable/local overlap.
- `good/lease_payload_summary_paths.json`: the record, cursor and lease payload after the
  seal sequence, with the inventory witness.
- `bad/missing_segment.json`, `bad/reordered_segment.json`, `bad/changed_digest_after.json`,
  `bad/over_bound_seal.json`, `bad/retired_key_recurring.json`,
  `bad/epoch_backwards.json`, `bad/cursor_record_disagreement.json`.

The validator rebuilds every segment from the seals, recomputes every digest and address,
checks Python's `canonical_json` and `json.dumps` against Node's bytes, and checks this
document's constants and cross-reference rows. It runs in `npm run test:library`:

```sh
node --test mcp/test_discovery_v1_fixtures.mjs
```

# Persisted discovery state, v1 (#656)

**Status.** This is the store and wire contract for persisted discovery state. Nothing
in production reads or writes it yet. It revises R2's proposal (#665 6676478568). It
folds in 3PO's six #721 source-review obligations (6676909499), R2's ownership and
handoff decision (6676918434) and BB8's nine semantic rulings (6676928839). It is held to
BB8's reconstruction contract (6673031748) and replay ruling (6675208404 §1). It folds in
BB8's rulings on §12 (6678599629): the store's walk is incremental (§5.1), `alt_seen` has a
cap derived from the first-commit budget (§3, §6.11), and §12 records each ruling. Where this
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
- **Walk.** Reading a chain back and checking it (§5).
- **Verified head.** How far the store has read a chain back and checked it. It is kept per
  log in `record.discovery.verified`, and it is never ahead of the head (§5.1).
- **Full read.** A walk that reads and checks every segment of a chain, oldest first (§5.1).
- **Terminal suffix.** A method's terminal records on its own stream: its `method_result`
  records and their detail parts (§6.9).

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
- **Equality.** Two entries are equal exactly when their canonical forms are byte-equal.
  Every membership test, duplicate check and prefix comparison in this contract uses that
  equality. Python value equality is not it: there `1 == True` and `1 == 1.0`, and a JSON
  array is not the tuple the worker held. A Python implementation keys its sets by
  `canonical_json(entry)`, so `["9:2", 1]` and `["9:2", true]` stay two members
  (`good/within_line_inside_group.json`).

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
| `alt_cells` | judged alternate cells, one per yielded alternate pair, false verdicts included (`analysis.py:2512-2519`), appended when the event's delta is applied (§6.3). In a shared-sound epoch: its in-domain judged cells (`:2537-2546`), never an outside-domain binding | list with multiplicity | no |
| `alt_seen` | alternate keys within one line, and keys spilled from the current group past its bound (§6.4) | ordered set log, first insertion, at most `ALT_SEEN_ENTRIES` entries (§3) | no |

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
   "logs":{"<log>":<state>},
   "verified":{"<log>":<state>},
   "unavailable":null | {"cause":<cause>,"log":"<log>" | null,
                         "released":{"<log>":<sha256 | null>}}}

<state> = {"head":<sha256 | null>,"segments":<int>,"count":<int>,"digest":<hex>}
<cause> = "segment_missing" | "chain_broken" | "digest_mismatch"
        | "cursor_disagrees" | "inventory_mismatch" | "retired_key_recurred"
```

- `null` means the job holds no discovery state: its frames carry none, it has completed,
  or it is a tombstone.
- `logs` names every log of the current epoch that any committed cursor of that epoch has
  named, including logs that have only a tail (head `null`, segments 0, count 0, digest
  `d₀`).
- **`verified`** names exactly the logs `logs` names (BB8 (a), 6678599629). Each is the state
  of a prefix of that log's chain: the segments the store has read back and checked (§5.1).
  It is never ahead of the head. Its `segments` and `count` are at most the head's; it is the
  empty state (head `null`, segments 0, count 0, digest `d₀`) when its `segments` is 0, and the
  head's own state when its `segments` equals the head's. A commit never moves it (§4); only
  the walk does (§5.1).
- The heads are the only GC roots (§7.2). A verified head needs none: it is on its chain, at
  or behind the head.
- `unavailable` is set in the same save that empties `logs` and `verified` (a release, §7.2;
  rule U1, §8), by any of:
  - reconciliation (§7.4), with cause `segment_missing`, or `chain_broken` for any other
    failure of its full read;
  - a store walk that fails (§5.1), with cause `chain_broken`;
  - a pause with code `DISCOVERY_UNAVAILABLE` (§8), with the cause the worker named.

  `log` names the log the cause is about, or is `null` when the cause belongs to no one
  log (`inventory_mismatch`, `retired_key_recurred`, and `cursor_disagrees` over the epoch
  or the log names). `released` names every log `logs` held at the release, with its head
  then (`null` for a log with only a tail), so the cause stays traceable after GC reclaims
  the segments.
- Once it is set, `_dispatchable` skips the job, and `workerPayload`, `commitCheckpoint`
  and `resume` refuse it with `DISCOVERY_UNAVAILABLE`, naming the cause (§8). The lease
  itself never refuses (§7.4). A tombstone drops the field with the rest of `discovery`.

### 2.8 Cursor v2

The cursor is owned by the worker and stored as `record.cursor`. Its declaration and schema
in `contracts.py` belong to the #721 author. Today's fields stay: `identity_hash`, `phase`,
`method_index`, `candidate`, `emission`, `sequence`, `counters`, `methods`, `done` and
`incomplete`. The changes:

- **`contract_version: 2`.** This is the cursor version. It is separate from
  `CONTRACT_VERSION` (1) in the identity (`contracts.py:18`, `:253`), which does not move.
- **`incomplete`** (`{name: reason}`) is also written at the moment either preparation flag
  is set (§6.6).
- **`methods[*]` holds none of the terminal inputs** `domain_true`, `domain_undecided` and
  `alt_cells` (`_TERMINAL_INPUTS`, `analysis.py:2439`). Today they accumulate in
  `methods[mid]` with every event's delta (`:2600-2605`) until `_advance` pops them
  (`:2445-2458`), so nothing bounds them. In v2, `alt_cells` is a log (§2.3) and the domain
  tallies are rebuilt under option 2 (§6.9). What stays in the cursor outside `discovery`
  and `continuation`, `witness` included, is at most `CURSOR_BYTES` (§3); Node checks both
  rules under W4.
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
  (§6.9). It is `null` only on a method that option 2 does not qualify; a qualified method
  carries one from its first step.
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

A frame carries `discovery` exactly when its cursor carries `discovery`; one without the
other is refused (W1). A frame and cursor with neither leave the store as it is today,
which is how the store half stays inert until the worker half ships. A frame with neither
whose record holds discovery is refused (W4).

### 2.10 Lease payload `discovery`

`workerPayload` (`reader_job_store.js:1513-1531`) adds it, and the scheduler passes it to the
worker beside `checkpoint` (`reader_scheduler.js:523-532`).

```
null
| {"version":1,
   "summary":{"epoch":<int>,"logs":{"<log>":{"head","segments","count","digest"}}},
   "paths":{"<log>":["<store>/pages/<sha256>.json", …]}}
```

- `summary.logs` equals `record.discovery.logs`. `verified` is the store's own and is not
  sent.
- Every log in the summary has a `paths` entry holding exactly `segments` absolute paths,
  **oldest first**.
- `workerPayload` builds it under the writer lock, after the walk (§5.1), from the store's
  address list.
- A record whose `discovery.unavailable` is set never reaches a lease payload:
  `_dispatchable` does not offer it, and `workerPayload` refuses it (§2.7).

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
| `ALT_SEEN_ENTRIES` | 65536 entries in `alt_seen`, sealed and tail together: the bound derived from the first-commit budget (§6.11) | `RESOURCE_LIMIT` (cause `discovery_alt_seen`) | `READER_PROTOCOL` (W7) |
| `GROUP_KEYS`, `GROUP_BYTES` | 32 keys and 8192 entry bytes in the current group | spill to `alt_seen` (§6.4): a spill rule, not a refusal | `READER_PROTOCOL` (W4) |
| `WITNESS_FIELDS` | 16 field names, each ≤ 64 bytes | `INVARIANT_FAILURE` (an engine defect: the field list is the reducer's constant, five names in v1) | `READER_PROTOCOL` (W4) |
| `CONTINUATION_BYTES` | 8192 canonical bytes | `INVARIANT_FAILURE` (an engine defect, never a truncation) | `READER_PROTOCOL` (W4) |
| `CURSOR_BYTES` | 65536 canonical bytes of the cursor outside `discovery` and `continuation` | `INVARIANT_FAILURE` (an engine defect: the method registry and the refusal shapes are fixed) | `READER_PROTOCOL` (W4) |
| frame | 2 MiB (`worker.py:166`, `python_bridge.js:16`) | the existing frame refusal | — |
| control payload and record | 2 MiB (`READER_LIMITS.objectBytes`) | — | the existing `RESOURCE_LIMIT` 413 (`reader_job_store.js:78-83`) |

A worker `RESOURCE_LIMIT` names its cause (§8), pauses the job with that reason and does not
requeue it (`reader_scheduler.js:592-600`). The worker's `INVARIANT_FAILURE` for the two byte
bounds, `CONTINUATION_BYTES` and `CURSOR_BYTES`, is confirmed (BB8 6678599629): each is an
engine defect, never a truncation. `WITNESS_FIELDS` takes it for the same reason (§12,
item 17).

Derived bounds, computed from the constants (not measured):

- **`cursor.discovery`** is at most five tails of under 16384 entry bytes plus 1024
  separators each, plus one group of 8192 bytes plus 32 separators, plus about 1 KiB of
  envelope: about 96 KiB.
- **The whole cursor** is `cursor.discovery`, plus `continuation` (8 KiB), plus everything
  else (`CURSOR_BYTES`, 64 KiB, `witness` included): about 168 KiB. This holds only because
  `methods[*]` carries no terminal input (§2.8).
- **A frame** is at most 1 MiB of records (`worker.py:161`), plus the cursor (about 168 KiB),
  plus 8 seals of about 17.2 KiB each (16384 entry bytes, 1023 separators, two digests and
  the envelope), plus the summary, which this contract does not change: about 1.3 MiB plus
  the summary, under the 2 MiB caps.
- **The record** is the cursor (about 168 KiB), plus `record.discovery` (five logs, each
  about 200 bytes in `logs` and as much again in `verified`), plus today's record fields,
  including the inline page refs while `page_count` ≤ 250 (`reader_job_store.js:1062`). R2's
  store tests hold a record to that bound.

## 4. Write path

There is no new channel. A frame's seals ride the existing step and its acknowledgement.

1. `step()` emits `discovery` (§2.9).
2. The scheduler passes it to `commitCheckpoint`.
3. Under the lock, after `_leaseRecord` and the exact-retry check
   (`reader_job_store.js:1042-1045`), the store checks everything below **before it writes
   anything**. The retry digest covers `discovery`, so an exact retry writes nothing. If
   `record.discovery.unavailable` is set, the commit is refused with
   `DISCOVERY_UNAVAILABLE` and its cause before any rule runs. Every rule failure is refused
   with `READER_PROTOCOL` (400) and nothing is written. The job then pauses with that reason
   and is not requeued.
   - **W1, the frame's shape and bounds.** The frame carries `discovery` exactly when its
     cursor does (§2.9). `epoch` is an integer ≥ 0. `resets` lists only resettable logs,
     each at most once. There are at most `FRAME_SEALS` seals, each naming a log in §2.3,
     with an integer `first` ≥ 0, a nonempty `entries` array and two 64-character lowercase
     hex digests.
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
   - **W7, the `alt_seen` cap.** After the frame, `alt_seen` holds at most `ALT_SEEN_ENTRIES`
     entries: the log's count plus its new tail (§3, §6.11).
   - **W6, append-only tails.** In the same epoch, for every log not reset by the frame,
     the previous cursor's tail (`record.cursor`) is a prefix of this frame's seal entries
     for that log followed by the new tail, compared entry by entry in canonical form.
   - **W4, agreement.** After the frame, `cursor.discovery` names exactly the record's logs.
     For each log, `sealed` equals the count and `sealed_digest` equals the digest. Every
     tail is open (§2.4). `groups` keeps within `GROUP_KEYS` and `GROUP_BYTES`. `through`
     and `current.lines` are integer pairs of two different lines, `current.lines` comes
     after `through`, and `through` never moves back within an epoch. `inventory` is `null`
     or a count and digest, and once it is non-null in an epoch it does not change until the
     epoch advances. `witness` is `null` or well formed, with its `epoch` equal to the
     frame's. `continuation` stays within `CONTINUATION_BYTES`. `methods[*]` carries no
     terminal input, and the cursor outside `discovery` and `continuation` stays within
     `CURSOR_BYTES` (§2.8). A record holding discovery with a frame and cursor that have
     none also fails W4.
4. **Write order:** pages, indexes, manifest and checkpoint as today
   (`reader_job_store.js:1051-1097`), then one segment per seal in seal order (each
   `previous_hash` is the log's head at that point), then the record (`:1098-1111`). The
   record's `discovery` becomes `{version: 1, epoch, logs, verified, unavailable: null}`,
   where each seal sets `head` to the new address, adds one to `segments`, adds its count to
   `count` and sets `digest` to the recomputed digest. `verified` keeps each log's state
   unless the frame releases or resets that log; a log that is new, reset or of a new epoch
   starts at the empty state. A commit never advances `verified`: only a read of the stored
   segment does (§5.1). The store appends each seal's address to its address list (§5.1).

## 5. Resume path

### 5.1 The store's walk (BB8 (a), 6678599629)

`workerPayload` and `resume` run it, so a lease checks the walk before the worker starts,
and `resume()` refuses a dead job at once instead of queueing it
(`reader_job_store.js:1369-1408`).

- **Under the writer lock.** Both run the walk through `_open` (`:759`), never through
  `_cached` (`:734-742`), which skips the lock while the generation has not moved.
  Entering the lock runs `_enterLock` (`:435-448`), so a segment an older image swept is
  found by reconciliation (§7.4) before the walk reads anything, and no other writer can
  delete one while it reads. `workerPayload` runs inside the scheduler's try block
  (`reader_scheduler.js:523`), so a refusal there pauses that one job.
- If `record.discovery.unavailable` is set, the store refuses with `DISCOVERY_UNAVAILABLE`
  and that cause, without walking.
- **The address list.** Statting a segment needs its address, and only the segment after it
  names it (the record names the head). So the store keeps in memory, for each live chain,
  the addresses of its segments, oldest first:
  - a commit appends each seal's address (§4);
  - a release empties the list;
  - reconciliation rebuilds every list by a full read (§7.4).

  `_reload` drops the lists with the rest of the cache. A starting store holds generation −1
  (`:331`), so its first lock entry reloads and reconciles: every list in use was built by a
  reconciliation in this process. The list is never persisted; the record holds the heads
  and the verified heads.
- **On a lease the walk is incremental.** For each log, with `v` its verified state:
  1. **R5, the verified prefix**, checked from the record before anything is read.
     `verified` names exactly the logs `logs` names. `v` is never ahead of the head (§2.7):
     its `segments` and `count` are at most the head's, it is the empty state when its
     `segments` is 0, and it is the head's own state when its `segments` equals the head's.
     Otherwise the list's address number `v.segments`, counting from 1, is `v.head`.
  2. **Stat** each of the first `v.segments` addresses. Reconciliation has already run
     under this lock (§7.4), so a missing one is `STORAGE_CORRUPT`.
  3. **Read and check the rest**: the segments appended since the verified head, oldest
     first. Each read goes through `_object('pages', …)`, which is bounded and address-checked
     (F6: changed bytes are `STORAGE_CORRUPT`). Then **F3** on each segment: the kind, the
     version, `job_id`, `identity_hash`, `epoch` equal to the record's epoch, and `log`.
     **R2** links each segment to the one before it, and the last one to the record's head,
     `count` and `digest`. **R5** checks the junction: the first segment read names `v.head`
     as its `previous_hash`, and its `first` and `digest_before` equal `v.count` and
     `v.digest`.
  4. **Advance.** When every log passes, `verified` becomes each log's head state. That is
     one record save, in the same lock hold as the reads, so no commit can come between them:
     the save writes each verified head together with the head it verifies. A walk that read
     nothing saves nothing. If the save needs capacity the store cannot grant
     (`STORE_RECOUNTING` or `RESOURCE_LIMIT`, `_capacity` `:534-563`), the store skips it and
     leaves `verified` where it was. The next walk then reads from there. The advance is never
     forced, and it never refuses the lease.
- **Failures.** A failure of R2, R5 or F3 is `DISCOVERY_UNAVAILABLE` (409) with cause
  `chain_broken`. The store releases the logs and sets `unavailable` in one save under the
  same lock (rule U1, §8), then refuses. `bad/verified_ahead_of_head.json` is refused this way
  before anything is read.
- **A full read** reads and checks every segment from the oldest. The oldest has
  `previous_hash: null`, `first: 0` and `digest_before = d₀`. Every segment is then checked as
  in step 3, and the number of segments equals the record's `segments`. Apart from the
  membership logs the worker loads on every lease (§5.2), which is logged membership state
  that ruling (a) lets resume grow with, a chain is read in full in exactly three places:
  1. the worker's load of `alt_cells` when it builds the terminal record (§5.2);
  2. reconciliation after a foreign generation, which includes startup (§7.4);
  3. `resume()` of a paused or cancelled job. Its own save (`:1392-1407`) carries the advanced
     `verified`.
- **Crash safety.** `verified` lives in the record, written in the same save as the heads it
  verifies, and it is never ahead of the head:
  - a commit moves the head and leaves `verified` (§4);
  - a release empties both in one save (§7.2);
  - the walk sets it to heads it has just read, under the lock that every commit needs.

  A crash before the walk's save leaves the older verified head, so the next walk reads more,
  never less. A record whose verified head is ahead of its head fails R5.
- It returns `discovery: {version: 1, summary, paths}`, every path oldest first (§2.10), from
  the address list.
- **Cost.** A lease stats the verified segments and reads only the ones appended since: in
  steady state, the previous lease's seals (`good/lease_incremental_walk.json`). For #656 a
  full walk is 99 objects in about 10 ms (measured, §10). At the bounds a full read is five
  chains of `CHAIN_SEGMENTS` segments of about 17.5 KiB: about 175 MiB (computed). It now
  happens only in the three places above.

### 5.2 The worker's load

- The worker reads each path with the bounded, address-checked page reader
  (`worker.py:97-123`).
  - **R1.** Every path resolves; otherwise `DISCOVERY_UNAVAILABLE`, cause
    `segment_missing`. This happens only when an older image sweeps a segment after the
    walk has left the lock.
  - **F6.** Changed bytes are `STORAGE_CORRUPT`.
- **F3 and R2** as in §5.1, with cause `chain_broken`.
- **F5.** Every segment's `digest_after` is recomputed from its entries. A mismatch is cause
  `digest_mismatch`.
- **R3, cursor agreement.** The summary's epoch and log names equal `cursor.discovery`'s.
  For each log, `count` equals `sealed` and `digest` equals `sealed_digest`. A mismatch is
  cause `cursor_disagrees`.
- **Membership.** It is then each log's sealed entries followed by its tail.
- **When `alt_cells` is read.** The worker reads its segments, and checks them by R1, F6,
  F3, R2 and F5, only when it builds the terminal record (`analysis.py:2386-2403`,
  `:1870-1879`). That is a full read (§5.1). On every other lease it checks `alt_cells` by R3
  alone, and the store's walk stats its verified segments and reads only those appended since
  (§5.1).

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
therefore persisted in `row_seen`, first insertion only. The row index and the position
within the row are in `continuation.row`.

- **What the log holds.** It is not only the live dedup state. A key stays in the log after
  its row's state is dead, until the log is reset or compacted: when one left span repeats
  far apart, every row in between keeps its dead keys there.
- **Reset.** At a row boundary where no live row state remains, the worker resets
  `row_seen` (§2.6).
- **Compaction.** At a row boundary where the log holds more than twice as many keys as
  are live, and the cut of the live keys needs at most `FRAME_SEALS` seals, the worker
  resets `row_seen` and appends the live keys again, in their first-insertion order, in the
  same frame: a reset, then its seals, then its tail (§2.6 applies resets first, and W6
  does not apply to a reset log). The decision depends only on the traversal, so a run
  restarted after a crash compacts at the same boundary and seals the same bytes.
- **The bound that follows.** The log holds at most twice the live keys plus one segment,
  except while the live keys alone need more than `FRAME_SEALS` seals. Then compaction
  waits and the log grows; a chain that would pass `CHAIN_SEGMENTS` refuses with
  `RESOURCE_LIMIT`, cause `discovery_chain_segments`.
- **Confirmed** (BB8 6678599629). The compaction decision depends only on the traversal,
  keeps the live keys in their first-insertion order and leaves membership unchanged.
- **Tests, both required** (BB8 6678599629):
  - a fixture with repeated left spans, restarted mid-row, matches the uninterrupted run
    (BB8 4);
  - one whose left spans repeat far apart compacts, and its restart at the compaction
    boundary matches the uninterrupted run too.

### 6.3 The pending binding

Membership is updated before the yield. At a checkpoint the pending binding
(`continuation.pending` plus `emission`) is kept exactly. On resume the pending binding
wins: it is re-emitted from its fragment offset even though its key is already in `seen` or
the group, and the key is not added again (3PO 2).

Appends ride the delta. An `alt_cells` entry is part of its event's delta, and the delta is
applied once, with the counters, when the event's records are exhausted
(`analysis.py:2512-2519`, `:2600-2605`). The entry is appended to the log then, not when the
event is prepared. An event re-prepared after a checkpoint inside its emission would
otherwise append it twice, and 1 true / 2 false would become 1 true / 3 false. A record's
contribution to the witness is folded at the same moment (§6.9).

**Tests:**
- Restart between the `seen.add` and the yield, and at every boundary inside a binding
  whose membership was already recorded: nothing is skipped and nothing is counted twice.
- Restart at a checkpoint inside the emission of a binding that carries an `alt_cells`
  entry: the entry is logged once, and 1 true / 2 false stays 1 true / 2 false.
- `good/retired_group_then_within_line.json` carries a checkpoint and resume inside a
  pending binding.

### 6.4 Alternate keys and their groups (rule S1)

The argument holds (BB8 1). A target's stream is non-blank only on its own lines (`:570`),
every cell of a span key carries its line (`:612-627`), and targets sort by their lines first
(`:1020`, `:1039`). So a two-line key can only recur inside its own contiguous line-pair
group. The code checks this while it runs, and does not assume it.

For an alternate key k, let L be the sorted pair of the lines of its two members. Pairs are
compared lexicographically.

- **Membership**, as `_new_pairs` checks it (`analysis.py:1079`). k has already been met
  when it is in the primary `seen` log, in `current.keys` or in `alt_seen`, or when its
  reverse is in one of them and the schema is same-rule. Equality is §2.1's. A key already
  met is skipped. A new key becomes the pending binding.
- **A key within one line** (L = [l, l]). A new k goes to `alt_seen`, which keeps it for the
  epoch. It never retires a group, opens one or is refused by one. A two-line target yields
  within-line keys on both of its lines (`analysis.py:1017-1019`, `:1055-1062`), and other
  targets cover those lines too, so such a key can recur in any group.
- **A two-line key** (l₁ < l₂) is compared with the current group's pair, or with `through`
  when there is no current group:
  - **The current pair.** A new k joins `current.keys` while the group stays within
    `GROUP_KEYS` and `GROUP_BYTES`. Past that bound it spills to `alt_seen`, where it is
    kept for the whole epoch.
  - **After it: the group boundary.** The current group is retired (`through` becomes its
    pair), and L opens a new current group. k is then checked like any key of that group.
    A key already met, such as a primary `seen` pair, still opens the group.
  - **Before the current pair, or at or before `through`.** The traversal refuses with
    `DISCOVERY_UNAVAILABLE`, cause `retired_key_recurred`. It never counts the key as new.
    This refuses every key of a retired group, and conservatively every pair the sort says
    was already passed.
- A group is retired only at its boundary, which only a two-line key reaches, and only
  after its pending emission has completed.
- **The `alt_seen` cap.** `alt_seen` holds at most `ALT_SEEN_ENTRIES` entries for the epoch
  (§3, derived in §6.11). A new key that would pass it is refused with `RESOURCE_LIMIT`, cause
  `discovery_alt_seen`, before the frame is emitted. It is never dropped, and never kept only
  in memory (`bad/alt_seen_over_cap.json`).
- **Tests:**
  - A correctly sorted run of (3,7), then (7,7), then (3,7) is accepted, and the second
    (3,7) key joins the group (`good/within_line_inside_group.json`).
  - A fixture whose sort is broken on purpose triggers the refusal
    (`bad/retired_key_recurring.json`).

### 6.5 The target stage (BB8 3)

The inventory is recomputed on each lease, with a witness (§5.3). BB8's criterion, made
precise: after preparation, resume cost does not depend on where the cursor is and never
re-traverses work already emitted; recomputing from logged state is allowed. The recompute
itself is a fixed cost, 0.9–2.4 s measured on #656. The whole resume cost is in §6.11.

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
  domain) over **every** contribution record on the method's stream, in commit order,
  eligible or not. A record here is resolved: its detail parts are folded into it, as
  `resolve_detail_records` folds them (`analysis.py:218-256`), and a detail part is never a
  witness record of its own. Each record contributes the tuple of `witness.fields`, read
  from the resolved record, with `null` for an absent field. The v1 fields are
  `["method_id", "id", "verdict", "a.token_ids", "b.token_ids"]`: everything
  `_domain_tally` reads (`analysis.py:1466-1479`), endpoint roles included. The field
  list is the one place they are enumerated, and it travels with the cursor. Adding a
  field the reducer reads changes the cursor; each field needs one mutant in the tests.
- **When a record is folded.** With its event's delta (§6.3), so a checkpoint inside the
  event's emission never folds it twice. A method that option 2 qualifies carries a
  witness from its first step (count 0, digest d₀).
- **The boundary: commit before terminal.** Positive emissions are acknowledged durably
  before the step that reconstructs. The witness is fixed there: from the method's first
  terminal record on, it does not change. It stays in the cursor until the epoch
  advances, which is after the terminal detail emission has finished.
- **Reconstruction** reads durable history only (`load_records`), never `_local_records`,
  so a durable/local overlap never counts twice:
  1. Fold exactly the first `witness.count` records of the method's stream, each resolved
     with its detail parts. A terminal record before that count is a mismatch.
  2. Every later record must belong to the method's terminal suffix. The suffix is
     contiguous, running to the end of the stream, and it belongs to that method alone
     (BB8 6678599629). Each record in it is either a `method_result` record of that method
     (`analysis.py:2401`), or a detail part of that method whose parent is the latest such
     record before it, because parts are written immediately after their parent
     (`analysis.py:221`). The suffix is filtered out before resolving. So a resume inside
     a terminal emission that spans frames, with its parent durable and its parts not yet,
     reads as consistent, not as a missing record. Any other record after the boundary is an
     inserted record, and it refuses `RESULT_EXPIRED`. That covers a contribution, a record
     or detail part of another method, a contribution's detail part, and a part outside its
     parent's run. A non-terminal record after a suffix record is one of these.
  3. The count and the digest must equal the witness's.
- **Multiplicity.** Repeated ids are distinct emissions. Nothing deduplicates by public id
  or token pair, or normalises roles, before hashing or counting.
- **Refusal.** All of these refuse as `RESULT_EXPIRED` (6673031748 §2), before pair
  reduction, with no partial terminal:
  - a count or digest mismatch;
  - a missing, inserted, duplicated or reordered record, or a same-count replacement;
  - an endpoint-role swap, or a change in any witness field;
  - a record after the boundary that is not the terminal suffix: an inserted record,
    including one that breaks the suffix's run or belongs to another method;
  - a detail part that is missing, out of order or changed;
  - a null witness on a method that option 2 qualifies. It is never read as empty
    history.

  `bad/witness_mismatch.json` holds one mutant for each.
  `bad/terminal_suffix_not_contiguous.json` holds the suffix's own mutants, and controls that
  keep the suffix contiguous and are accepted.
- **The fields are part of the cursor's meaning.** A worker whose reducer reads fields
  other than `witness.fields` refuses the cursor with `STALE_READING`.
- **The store's part is its delivery promise.** `load_records(method_id)` yields exactly
  the committed records, in commit order, with their multiplicity: no redelivery, no
  deduplication, no reordering (R2's store test, #665 6674027857 §1).
- **Acceptance tests** (6673031748; each fails before the change and passes after):
  - whole-record deletion, duplicate insertion, reorder, same-count replacement and
    endpoint-role swap all refuse, and so does one mutant per witness field;
  - the 20-records/16-ids multiplicity is preserved;
  - a durable/local overlap does not double-count;
  - an old-version checkpoint is refused (`STALE_READING`, §9);
  - `alt_cells` still gives 1 true / 2 false;
  - continuing and fresh streams are equal;
  - the no-callback in-memory path is byte-identical before and after;
  - the five whole-figure paths keep their id deduplication over durable plus local
    (`_assembly_records`, `analysis.py:2325-2345`).
- **Fallback.** If reading the evidence at finish is too slow (about 63 MB plain on #656,
  time not yet measured), the fallback is domain logs, with the same semantics and no new
  ruling. It adds two logs to §2.3, so it is a revision of this contract.

### 6.10 What exact means (6675208404 §1)

At every checkpoint boundary, a resumed run's committed transcript equals an uninterrupted
run's: the same records, in the same order, with endpoint roles as first discovered, and the
same multiplicity, repeated public ids on distinct bindings included. Incomplete-search
behaviour is preserved too. **Test:** restarting at every step boundary equals the
uninterrupted run. The restart points include mid-preparation, a zero-yield target,
mid-target, mid-group, mid-emission and across a method boundary.

### 6.11 Resume cost (BB8 8; BB8 (a), 6678599629)

Measured on #656, a resume costs about 8–19 s (construct plus load plus recompute, §10), and
nothing is re-traversed. In the previous revision two terms grew with position after the
primary phase: the worker's load of `alt_seen`, and the store's walk of `alt_cells`. Ruling
(a) fixes both, so in the alternate phase the cost of a lease is bounded by a constant:

- the store's walk is incremental (§5.1): it stats the verified segments and reads only the
  ones appended since;
- `alt_cells` is loaded only at finish (§5.2);
- `alt_seen` has its own cap, derived below from the lease's first-commit budget.

**The derivation.** The budget is 30 s from a lease's start to its first commit (§9). The
inputs are §10's measurements, not bounds; the result, `ALT_SEEN_ENTRIES = 65536`, is the
bound.

| Term, on a loaded host | Value | Source |
| --- | --- | --- |
| load rate | 30.4 µs per entry, × 3 = 91.2 µs | measured (§10), scaled as below |
| construct | 15.2 s | measured on #656, loaded host (§10) |
| recompute | 2.4 s | measured on #656, loaded host (§10) |
| load of `seen` and `variants` | 20,045 entries × 91.2 µs = 1.83 s | the measured entry count (§10) at the scaled rate |
| incremental walk | at most 10,240 segments × 10 ms / 99 × 3 = 3.10 s | the measured walk rate (§10), computed at the bounds |
| load of `alt_seen` | n entries × 91.2 µs | computed |

- **The scale factor is 3.** §10's loaded-host times are 2.375 (construct), 2.5 (load) and
  2.67 (recompute) times its light-host ones, and 3 is the smallest whole factor at or above
  all three. The earlier #656 analysis used a production host 2× slower. That is below the
  measured 2.5 of the load term itself, so it would understate the load. The walk has a
  single measured figure, so it is scaled by the same factor.
- **The walk term** is a full read of five chains of `CHAIN_SEGMENTS` (10,240 segments) at the
  measured rate, about 0.1 ms per segment. An incremental walk stats the verified segments,
  which costs less than reading them, and reads only the appended ones, so it costs at most
  this.
- **The sum.** The fixed terms come to 15.2 + 2.4 + 1.83 + 3.10 = 22.53 s. That leaves 7.47 s,
  or 81,895 entries at 91.2 µs each.
- **The bound.** `ALT_SEEN_ENTRIES = 65536`, which is 64 segments full by count. At the cap
  the load is 5.98 s and the sum is 28.51 s, 1.49 s under the budget. That margin holds the
  first step's 1 s deadline (`analysis.py:2582`).
- `row_seen` is empty in the alternate phase: the lower traversal's last row boundary resets
  it (§6.2).

What the bound leaves out (§12, item 18):

- Construct and recompute are #656's measurements. They depend on the text, not on the
  cursor's position.
- `seen` and `variants` enter at #656's size. Neither changes in the alternate phase, but at
  its `CHAIN_SEGMENTS` bound each would hold 2,097,152 entries: about 191 s to load
  (computed).
- The finish lease loads `alt_cells` in full: 12,105 entries on #656, about 1.1 s at 91.2 µs,
  and about 191 s at its bound (computed).

The measured gate stays: in the proof run, every lease's first commit lands within 30 s of the
lease start.

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
- reconciliation (§7.4), a store walk that fails (§5.1), and a pause with code
  `DISCOVERY_UNAVAILABLE` (§8), each of which also sets `unavailable` (§2.7, U1).

Every release empties the released logs' `verified` states in the same save. The walk's
advance of `verified` (§5.1) is not a release: it moves no head and frees nothing.

GC:

- Add one `['discovery', head]` root per non-null head, next to the checkpoint root, in
  three places: `_markRecord` (`:1667-1671`), the mark loop (`:1783`) and the re-mark
  (`:1804`).
- In `_markStep` (`:1632-1662`), a `discovery` entry reads from `pages/`, marks `live.pages`
  and pushes its `previous_hash`. `live` holds only `OBJECT_KINDS` (`:45`), so the kind must
  be mapped to `pages`; indexing `live.discovery` would throw.
- The sweep is unchanged. A verified head needs no root (§2.7).
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
- **The walk's save of `verified` is lost.** The older verified head stays, and the next walk
  reads the appended segments again (§5.1). A verified head is never saved ahead of its head.
- **A release** empties `logs` and `verified` in one save, so a verified head never outlives
  its head.
- **Only GC deletes.**

### 7.4 Missing segments: where tolerance is allowed

- **Who can delete a live segment:** only an older image, because its GC has no discovery
  root. Instances share the store directory and the lock is held per write
  (`mcp/READER_RUNTIME.md`), so an old instance can sweep while a new one runs. Its
  deletes go through `_unlinkCounted`, which begins a write, so the generation moves.
- **Where the store notices: reconciliation**, whenever it enters the lock and finds a
  generation it did not write (`_enterLock`, `:435-448`, which already reloads the records
  and abandons the GC). Startup is one such entry: a starting store holds generation −1
  (`:331`), so its first lock entry (`:342-379`) always reconciles. Every discovery read the
  store makes is the walk or reconciliation, and both run under the lock (§5.1), so a walk
  always runs after the reconciliation it needs.
- **Reconciliation is a full read** (§5.1) of every live chain, one of the three places a
  chain is read in full. It stats each segment before reading it, because `_object` maps
  `ENOENT` to `STORAGE_CORRUPT` (`:668-683`), and it rebuilds the address lists. For a
  #656-sized job that is 99 segments (measured), and at the bounds up to 5 ×
  `CHAIN_SEGMENTS` per job (computed). It saves no verified head: usage is unknown until the
  recount (`:444-447`), and only a save that does not grow a record commits then. The job's
  next walk reads from its saved verified head.
- **A chain it cannot use is released**, in one save:
  - a missing segment: `unavailable` becomes `{cause: "segment_missing", log, released}`;
  - any other failure of the full read (F6, F3 or R2): `{cause: "chain_broken", log,
    released}`. It releases that job and does not fail the store, so one job's chain never
    stops a startup;
  - `logs` and `verified` are emptied in the same save (U1, §8);
  - a queued job is also set to `paused`, with `deferred_requeue: false` and a null fence.
    Its reason is `{code: "DISCOVERY_UNAVAILABLE", cause, log, released}` with no message
    text; the message is rendered from the cause (§8). This is confirmed (BB8 6678599629):
    it is better than leasing a job that must fail, and `_dispatchable` skips it, so the
    queue never spins;
  - a running job's state is left to its lease, whose next commit refuses;
  - paused and cancelled jobs keep their state and their reason. `unavailable.released`
    keeps their trace, and `resume` refuses them.

  A log line is written. For each released log the save drops its two states, in `logs` and
  in `verified` (about 190 bytes each with a head), and adds its head twice, in
  `unavailable.released` and in a queued job's reason (about 80 bytes each). It adds about
  150 bytes of envelope once. Since every release holds at least one log with a head, the
  save is a shrink.
- **No refusal at lease time.** `store.lease()` is called outside the scheduler's try block
  (`reader_scheduler.js:514`) and takes the head of the queue
  (`reader_job_store.js:889-891`), so a lease that threw would pick the same job on every
  pump. `_dispatchable` (`:957-962`) skips a record whose `discovery.unavailable` is set,
  and refusals are raised only by `workerPayload`, `resume` and `commitCheckpoint`.
- **Startup order.** At startup the pass runs before the startup collection, which a0 moved
  ahead of the pauses (`:351-352`). Otherwise the mark would meet the missing segment and
  fail the store. The release only shrinks a record, so it commits before usage is known.
- **Everywhere else** a missing segment is `STORAGE_CORRUPT`, like any other object, and a
  mark that meets one abandons the collection, as today. The new image's own bugs stay
  visible. An error without a status inside `_open` makes the whole store unavailable, which
  is why reconciliation stats before it reads.

## 8. Refusals

Nothing is ever reinterpreted, and missing state is never rebuilt.

| Code | Status | Raised by | When |
| --- | --- | --- | --- |
| `READER_PROTOCOL` | 400 | store, `commitCheckpoint` | any of F1–F6 or W1–W7 on a frame. Nothing is written; the job pauses with this reason and is not requeued. |
| `DISCOVERY_UNAVAILABLE` | 409 | store (`workerPayload`, `commitCheckpoint` and `resume` from `unavailable`; the walk; reconciliation's pause of a queued job) and worker (load, traversal) | causes below |
| `STORAGE_CORRUPT` | 503 | store; worker | a segment's bytes do not match its address (F6), or the store meets a missing segment, outside reconciliation; reconciliation releases that job instead (§7.4) |
| `STALE_READING` | 409 | worker | a v1 cursor on a v2 worker, a v2 cursor on a v1 worker (`analysis.py:464`), or a witness whose fields are not the ones the worker's reducer reads (§6.9) |
| `RESULT_EXPIRED` | 410 | worker | the option 2 witness disagrees with durable history, or is null on a qualified method (§6.9) |
| `RESOURCE_LIMIT` | — (the job pauses) | worker | a §3 limit the worker cannot meet by ending its step; it names its cause (below) |

`DISCOVERY_UNAVAILABLE` always names its cause. 409 matches `STALE_READING`; 410 stays with
`RESULT_EXPIRED`, because here the result is not gone. The causes:

| Cause | Rule | Raised by | Message |
| --- | --- | --- | --- |
| `segment_missing` | R1 | worker; store from `unavailable` | This analysis can no longer resume exactly: part of its saved progress is missing. Its committed evidence stays readable. Delete it, then create a new analysis with a new key. |
| `chain_broken` | R2, R5, F3 at read | store walk and reconciliation; worker | This analysis can no longer resume exactly: part of its saved progress does not fit together. Its committed evidence stays readable. Delete it, then create a new analysis with a new key. |
| `digest_mismatch` | F5 at read | worker | This analysis can no longer resume exactly: part of its saved progress does not match its record. Its committed evidence stays readable. Delete it, then create a new analysis with a new key. |
| `cursor_disagrees` | R3 | worker | the `digest_mismatch` message |
| `inventory_mismatch` | R4 | worker | the `digest_mismatch` message |
| `retired_key_recurred` | S1 | worker | This analysis cannot continue exactly: its search met a line pair it had already finished. Its committed evidence stays readable. A new analysis of the same text would stop at the same place. |

The `RESOURCE_LIMIT` causes, which the worker names for a §3 limit it cannot meet:

| Cause | Limit | Message |
| --- | --- | --- |
| `discovery_entry_bytes` | `ENTRY_BYTES` | This analysis stopped: one piece of its saved progress is larger than the format allows. Its committed evidence stays readable. |
| `discovery_frame_seals` | `FRAME_SEALS` | This analysis stopped: one step of its search needs more saved progress than one checkpoint can carry. Its committed evidence stays readable. |
| `discovery_chain_segments` | `CHAIN_SEGMENTS` | This analysis stopped: its saved progress grew past the format's limit. Its committed evidence stays readable. |
| `discovery_alt_seen` | `ALT_SEEN_ENTRIES` | This analysis stopped: its search of alternate readings kept more pairs than a resume can reload in time. Its committed evidence stays readable. |

Plumbing (R2's side):

- `worker.py`'s whitelist (`:263-264`) gains `DISCOVERY_UNAVAILABLE` and `STORAGE_CORRUPT`;
  otherwise they surface as `READER_ERROR`.
- The worker's reply gains `error_cause`, from the closed set of the ten causes in the two
  tables above, and `error_log`, a §2.3 log name, for a cause about one log. Anything else in
  either field is dropped. The cause sets are closed and confirmed (BB8 6678599629);
  `discovery_alt_seen` is the fourth `RESOURCE_LIMIT` cause.
- The scheduler passes `error_cause` and `error_log` to `store.pause` on both of its failure
  paths: the error it throws for a failed reply (`reader_scheduler.js:568-572`) carries them,
  and the catch that pauses (`:592-600`) passes them on.
- `store.pause` with code `DISCOVERY_UNAVAILABLE` releases the logs and sets
  `unavailable: {cause, log | null, released}` in the same save (§2.7). This is how a refusal
  the worker raises (R1, `digest_mismatch`, `cursor_disagrees`, `inventory_mismatch`,
  `retired_key_recurred`) frees the job's chains and quota, and why a later `resume()`
  refuses at once instead of requeueing a job that would fail the same way. Confirmed, with
  one condition (BB8 6678599629): the paused reason records the released log names and
  their heads at release.
- The paused record's reason carries `{code, cause, log, released, message}`. A pause the
  store makes on its own (reconciliation, §7.4) stores no message; it is rendered from the
  cause.
- **U1, the release record.** Every release that sets `unavailable`, from reconciliation, a
  failed walk or a `DISCOVERY_UNAVAILABLE` pause, is one save. It empties `logs` and
  `verified`, and it sets `unavailable` with `released`: each log the record held, with its
  head at release. A pause's reason carries the same `cause`, `log` and `released`, so the
  cause stays traceable after GC reclaims the segments. The committed evidence stays
  readable: a release frees discovery segments only, never pages, indexes, manifests or
  checkpoints (§7.2). `good/unavailable_pause_reason.json` pins both pauses.

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
  or below 40 MiB, and frames and the record stay within their derived bounds (§3). It
  records the restart count, each restart's cost, the segments each lease's walk read and
  statted, `row_seen`'s size, `alt_seen`'s size against `ALT_SEEN_ENTRIES`, and worker memory
  in the alternate phase. It is the completed run that Phase B needs (`mcp/READER_RUNTIME.md`).

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
| loaded / light | construct 2.375, load 2.5, recompute 2.67 | computed from the measured times; §6.11 scales by 3 |
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
| 2 | 3PO 2 | membership is updated before yield; the pending binding is restored with no skip and no double count | §2.8 `continuation.pending`, §6.3 | `good/retired_group_then_within_line.json`; #721: restart between `seen.add` and the yield, and inside a binding with an `alt_cells` entry |
| 3 | 3PO 3 | option 2: ordered contribution witness, commit-before-terminal boundary, witness kept through terminal detail emission, no public-id or token-pair dedup | §2.8 `witness`, §6.9 | `good/witness_cursor_option2.json`, `bad/witness_mismatch.json` |
| 4 | 3PO 4 | shared-sound traversal: its own token, span and missing-word continuation; false-with-domain apart from outside-domain | §2.3 `alt_cells`, §2.8 `continuation.shared_sound`, §6.8 | #721 |
| 5 | 3PO 5 | cursor v2 touches `contracts.py`'s checkpoint declaration and schema | owners table, §2.8, §9 | — |
| 6 | 3PO 6 | descriptor sizes, an empty `alt_seen` and lease timings are measurements, not bounds | §3, §6.11, §10 | `bad/over_bound_seal.json`, `bad/premature_seal.json`, `good/seal_completeness.json` |
| 7 | BB8 1 (6676928839) | retire passed two-line groups with a runtime refusal if a retired key recurs; within-line keys always logged | §2.3 `alt_seen`, §2.8 `groups`, §6.4, §8 | `good/retired_group_then_within_line.json`, `good/within_line_inside_group.json`, `bad/retired_key_recurring.json` |
| 8 | BB8 2 | option 2 for tallies | §6.9 | `good/witness_cursor_option2.json`, `bad/witness_mismatch.json` |
| 9 | BB8 3 | recompute targets on each lease, with an inventory count and digest checked each lease | §2.8 `inventory`, §5.3, §6.5, W4 | `good/lease_payload_summary_paths.json`, `bad/inventory_mismatch.json` (R4) |
| 10 | BB8 4 | persist `seen`; row dedup persisted, or proven by a mid-row test | §2.3, §6.1, §6.2 | `good/seal_sequence_two_logs.json`; #721 mid-row test |
| 11 | BB8 5 | `seen` as an ordered set log is fine; guard that no consumer iterates it | §2.3, §6.1 | #721 guard test |
| 12 | BB8 6 | the two flags go into `cursor.incomplete` (required) | §2.8, §6.6 | `good/lease_payload_summary_paths.json` cursor; #721 |
| 13 | BB8 7 | ticks: records-or-used deadline; records and counters unchanged | §6.7 | #721 |
| 14 | BB8 8 | a fixed 8–19 s resume is acceptable; the 30 s proof-run gate stays | §6.11, §9, §10, §12 | proof run; the §6.11 derivation test |
| 15 | BB8 9 | `DISCOVERY_UNAVAILABLE`, 409, with the cause named | §2.7, §7.4, §8 | `bad/missing_segment.json`, `bad/reordered_segment.json`, `bad/cursor_summary_disagreement.json`, `bad/inventory_mismatch.json`, `bad/retired_key_recurring.json` |
| 16 | BB8 6673031748 | exact ordered delivery; witness over every record; refusal, never a quieter fallback | §6.9 | `good/witness_cursor_option2.json`, `bad/witness_mismatch.json` |
| 17 | BB8 6675208404 §1 | replay is exact at every boundary; ticks and pending state checkpointable | §6.3, §6.7, §6.10 | #721 restart-at-every-boundary test |
| 18 | R2 6676918434 | one interface, tested from both sides, as versioned fixtures | §13 | the whole fixture set |
| 19 | BB8 (a) (6678599629) | the store's walk is incremental: it stats every segment and reads and verifies only those appended since a persisted verified head; a full read happens in exactly three places | §1, §2.7 `verified`, §4, §5.1, §7.3, §7.4 | `good/lease_incremental_walk.json`, `bad/verified_ahead_of_head.json` |
| 20 | BB8 (a) | `alt_seen` gets its own cap, derived from the 30 s first-commit budget on a loaded host; passing it is `RESOURCE_LIMIT`, cause `discovery_alt_seen` | §3, §4 W7, §6.4, §6.11, §8 | `bad/alt_seen_over_cap.json`; the §6.11 derivation test |
| 21 | BB8 (b) | confirmed: `row_seen` reset and compaction, with both tests required; `CURSOR_BYTES`, `CONTINUATION_BYTES` and `WITNESS_FIELDS`, with `INVARIANT_FAILURE` on the worker for the byte bounds; `methods[*]` holds no terminal input; the closed cause sets | §2.8, §3, §6.2, §8 | `good/lease_payload_summary_paths.json`; #721: both §6.2 tests |
| 22 | BB8 (b) | the terminal suffix is contiguous and belongs to its method alone; a non-terminal record after a suffix record is an inserted record | §6.9 | `bad/terminal_suffix_not_contiguous.json`, `bad/witness_mismatch.json` |
| 23 | BB8 (b) | reconciliation pauses a released queued job, with its reason rendered from the cause, and `_dispatchable` skips it | §2.7, §7.4 | `good/unavailable_pause_reason.json` |
| 24 | BB8 (b) | a `DISCOVERY_UNAVAILABLE` pause releases the logs; its reason keeps the released log names and their heads, and committed evidence stays readable | §2.7, §8 U1 | `good/unavailable_pause_reason.json` |

## 12. Rulings on the items added for confirmation

The previous revision listed items 1–14 for confirmation. BB8 ruled on every one of them
(6678599629). BB8 has no semantic objection to the structural items (2–4, 6, 10 and 12), and
the cursor fields are 3PO's to confirm.

1. **Ruled: confirmed** (BB8 6678599629). `row_seen`'s reset at row boundaries and its
   compaction (§6.2), and the frame's `resets` field. The compaction decision depends only on
   the traversal, keeps the live keys in their first-insertion order and leaves membership
   unchanged, so a restart compacts at the same boundary and seals the same bytes. Both §6.2
   tests are required.
2. **Ruled: no semantic objection** (BB8 6678599629). W6, append-only tails.
3. **Ruled: no semantic objection** (BB8 6678599629). `CHAIN_SEGMENTS = 2048` per chain. It
   no longer bounds the per-lease walk (item 14).
4. **Ruled: no semantic objection** (BB8 6678599629). The group bound (`GROUP_KEYS = 32`,
   `GROUP_BYTES = 8192`), with spill to `alt_seen`, which now has its own cap (item 13).
5. **Ruled: confirmed** (BB8 6678599629). `CURSOR_BYTES = 65536`, `CONTINUATION_BYTES = 8192`
   and `WITNESS_FIELDS = 16`, with `INVARIANT_FAILURE` on the worker for the two byte bounds:
   both are engine defects, never truncations (§3). Also confirmed: `methods[*]` holds no
   terminal input (§2.8).
6. **Ruled: no semantic objection** (BB8 6678599629). A string with a lone surrogate is not an
   entry, and entries are equal exactly when their canonical bytes are (§2.1).
7. **Ruled: confirmed** (BB8 6678599629). Reconciliation pauses a queued job it releases, and
   the lease never refuses (§7.4). That is better than leasing a job that must fail: the
   reason is rendered from the cause, and `_dispatchable` skips the job, so the queue never
   spins.
8. **Ruled: confirmed** (BB8 6678599629). The closed cause sets and their messages (§8),
   including `retired_key_recurred`'s message, which is honest because that cause is
   deterministic. `discovery_alt_seen` is added as the fourth `RESOURCE_LIMIT` cause.
9. **Ruled: confirmed, with one condition** (BB8 6678599629). A `DISCOVERY_UNAVAILABLE` pause
   releases the logs; the worker's whitelist gains `STORAGE_CORRUPT`, its reply gains
   `error_cause`, and the scheduler passes it to `store.pause` (§8). The condition: the paused
   reason records the released log names and their heads at release, so the cause stays
   traceable after GC reclaims the segments (U1, §8). The committed evidence stays readable.
10. **Ruled: no semantic objection** (BB8 6678599629). The inventory and witness digest
    domains, and the v1 witness fields.
11. **Ruled: confirmed, with one addition** (BB8 6678599629). Option 2's terminal-suffix rule,
    the refusal of a null witness on a qualified method, and `STALE_READING` for a witness
    whose fields the reducer does not read. The addition: the suffix is contiguous and belongs
    to its method alone, and a non-terminal record after a suffix record is an inserted record
    (§6.9).
12. **Ruled: no semantic objection** (BB8 6678599629). Node holds the inventory fixed within an
    epoch, holds `groups.through` from moving back, and requires `discovery` on a frame exactly
    when the cursor has it.
13. **Ruled: accepted only with a fixed budget and an incremental walk** (BB8 6678599629,
    ruling (a)). After preparation, resume may grow with logged membership state, never with
    re-traversal, and its worst case at the contract's own bounds must fit the lease's
    first-commit budget. `alt_seen` gets `ALT_SEEN_ENTRIES`, derived from that budget (§6.11).
14. **Ruled by (a)** (BB8 6678599629). The walk is incremental (§5.1). A full read, the 175 MiB
    figure at the bounds, happens in exactly three places.

BB8 still re-checks §6.9's acceptance list against the worker half once 3PO publishes it.

### New in this revision, for confirmation

These fill gaps that ruling (a) left open. BB8 confirms or strikes each one.

15. **Where the walk gets its addresses** (§5.1). Statting a segment needs its address, and
    only the segment after it names it (the record names the head). So the store keeps each
    live chain's address list in memory. Reconciliation rebuilds the lists by a full read, and
    a starting store always reconciles, because it holds generation −1. Reconciliation saves
    no verified head, because usage is unknown until the recount.
16. **R5, and how the advance fails** (§5.1, §7.4). A verified state that is not a prefix of
    its chain is `chain_broken`. The walk's save is skipped, never forced, when it cannot get
    capacity. Reconciliation releases one job with `chain_broken` for any failure of its full
    read other than a missing segment; it does not fail the store.
17. **The derivation's inputs** (§6.11): the scale factor 3, and the walk term taken at five
    full chains. Also, `WITNESS_FIELDS` on the worker is `INVARIANT_FAILURE`, for item 5's
    reason: the field list is the reducer's constant.
18. **What the bound leaves out** (§6.11). `seen` and `variants` enter at #656's size; at their
    `CHAIN_SEGMENTS` bound each would load for about 191 s (computed). The finish lease's full
    load of `alt_cells` is also outside the bound: about 1.1 s on #656, and about 191 s at the
    bound (computed). Does ruling (a)'s criterion need caps for these too?
19. **`unavailable.released` on every release** (§2.7, U1), not only on a pause, so a paused or
    cancelled job that reconciliation releases keeps its trace. And `error_log` in the worker's
    reply (§8), which the release needs for its `log`.

## 13. Fixtures and validator

`mcp/fixtures/discovery_v1/README.md` lists every fixture, one line each, with the rule it
exercises and the refusal it expects. The good fixtures are accepted with no refusal. Each
bad fixture violates exactly the rule it is named for and passes every other rule.

Good:

- `good/seal_sequence_two_logs.json`: three frames in one epoch that seal `seen` and
  `alt_cells` in one frame and `alt_cells` again in the next (a chain across frames), with
  tails, canonical-form vectors and cut-rule vectors.
- `good/epoch_jump.json`: a frame from epoch 2 to epoch 5 that releases the old chains.
- `good/seal_completeness.json`: one seal complete because the next entry would not fit,
  and one complete by its 16,384 entry bytes.
- `good/retired_group_then_within_line.json`: group retirement, then a within-line key
  going to `alt_seen` with the current group left open, with a checkpoint and resume
  inside a pending binding.
- `good/within_line_inside_group.json`: (3,7), (7,7), (3,7) accepted, with membership
  through primary `seen`, reversed keys and canonical bytes.
- `good/witness_cursor_option2.json`: a full cursor v2 carrying the option 2 witness,
  resumed inside a terminal emission, over a stream with a repeated id, a detached
  endpoint and a durable/local overlap.
- `good/lease_payload_summary_paths.json`: the record, cursor and lease payload after the
  seal sequence, with the inventory witness.
- `good/lease_incremental_walk.json`: the same record with verified heads saved after the
  second frame. A lease stats `seen`'s and `alt_cells`' verified segments, reads only
  `alt_cells`' newest, and advances its verified head in one save. The next lease reads and
  saves nothing, and a full read reads all three.
- `good/unavailable_pause_reason.json`: a `DISCOVERY_UNAVAILABLE` pause the worker raises, and
  reconciliation's pause of a queued job. Each is one save that empties `logs` and `verified`;
  `unavailable` and the reason keep the released log names and their heads (U1).

Bad:

- write (`READER_PROTOCOL` 400): `bad/changed_digest_after.json` (F5),
  `bad/float_entry.json` (F1, which Node meets as F5), `bad/over_bound_seal.json` (F4),
  `bad/premature_seal.json` (F4), `bad/epoch_backwards.json` (W2),
  `bad/reset_unheld_log.json` (W3), `bad/cursor_record_disagreement.json` (W4),
  `bad/tail_rewritten.json` (W6);
- limit: `bad/alt_seen_over_cap.json` (W7). The worker refuses it first, as `RESOURCE_LIMIT`
  with cause `discovery_alt_seen`; a store sent the frame refuses it `READER_PROTOCOL` 400;
- resume (`DISCOVERY_UNAVAILABLE` 409): `bad/missing_segment.json` (R1),
  `bad/reordered_segment.json` (R2), `bad/cursor_summary_disagreement.json` (R3),
  `bad/inventory_mismatch.json` (R4);
- walk (`DISCOVERY_UNAVAILABLE` 409 `chain_broken`): `bad/verified_ahead_of_head.json` (R5),
  refused before anything is read, with the release it saves;
- traversal: `bad/retired_key_recurring.json` (S1, `DISCOVERY_UNAVAILABLE` 409),
  `bad/witness_mismatch.json` and `bad/terminal_suffix_not_contiguous.json` (S2,
  `RESULT_EXPIRED` 410).

**How the #721 author consumes them.** The worker's encoder, fed each good fixture's state,
produces exactly its seals, tails, cursor fields and digests, byte for byte. Its load,
traversal and reconstruction accept each good fixture and refuse each bad one with the same
rule, code, status and cause. For `bad/float_entry.json` the worker refuses by F1, where
Node can only refuse by F5. `bad/alt_seen_over_cap.json` is the frame the worker must refuse
to emit. The walk and pause fixtures are the store's (R2's side).

The validator rebuilds every segment from the seals, recomputes every digest and address,
and checks this document's constants, causes and cross-reference rows. It also runs Python
over the same bytes: `canonical_json` and `json.dumps` against Node's bytes, the segment
addresses, `resolve_detail_records` and the witness over the filtered stream, the terminal
suffix's mutants and controls, and the float fixture. It recomputes the §6.11 derivation from
§10's figures and §3's constants. Where one failure leaves a later check undefined (a log
whose seal fails F5 has no digest for W4 to compare), it skips that check. It runs in
`npm run test:library`:

```sh
node --test mcp/test_discovery_v1_fixtures.mjs
```

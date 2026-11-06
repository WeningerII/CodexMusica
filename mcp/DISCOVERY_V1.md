# Persisted discovery state, v1 (#656)

**Status.** This is the store and wire contract for persisted discovery state. Nothing
in production reads or writes it yet. It revises R2's proposal (#665 6676478568). It
folds in 3PO's six #721 source-review obligations (6676909499), R2's ownership and
handoff decision (6676918434) and BB8's nine semantic rulings (6676928839). It is held to
BB8's reconstruction contract (6673031748) and replay ruling (6675208404 §1). It folds in
BB8's rulings on §12 (6678599629): the store's walk is incremental (§5.1), `alt_seen` has a
cap derived from the first-commit budget (§3, §6.11), and §12 records each ruling. It also
fixes the eight findings of an adversarial review of that revision. It folds BB8's rulings on
3PO's amendments (6678702125): an atomic `row_seen` compaction (§6.2), a derived
`CURSOR_BYTES` (§3.1), the terminal suffix's integrity (§6.9), the cause sets enforced at the
reply boundary (§8, C1), a release that is provably no larger and keeps fencing (§7.4), and
§6.8's counters. And it carries 3PO's resolver results (6678848728) into §6.9 as required
worker refusals, under BB8's acceptance requirement (6678856548). It folds BB8's rulings on §12
items 15–20 (6681838131): a byte mismatch at a full read is `segment_corrupt` (§5.1, §7.4), one
combined cap bounds the four membership logs (§3, §6.11), `row_seen` is not assumed empty in the
alternate phase (§6.2), finish work and reconciliation are named exclusions (§6.11), and a thrown
save is an unknown outcome (§4, §5.1). It answers 3PO's review of `2e8ae0239` (6681823180), and
fixes an adversarial review of `8732918312`: the reply plumbing C1 needs (§8), the other
`RESOURCE_LIMIT` raisers (§8), and the precision of §6.9's nine cases. Where this text and the
proposal differ, this text governs. 3PO's
acknowledgement (6677006069) fixes the `contracts.py` reservation to the checkpoint declaration
and schema; the shared `CONTRACT_VERSION` does not change.

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
| Frame plumbing | `mcp/worker.py`: segment reads by path, the frame bounds, the refusal whitelist and the reply's cause fields; `mcp/python_bridge.js`: forwarding those fields (§8) | R2, the #721 author reviews |
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
- **Full read.** A walk that starts at the record's head, follows `previous_hash` back to the
  chain's first segment and checks every segment. It uses neither the verified head nor the
  address list (§5.1).
- **Address list.** The store's in-memory list of a live chain's segment addresses, oldest
  first (§5.1).
- **Terminal suffix.** A method's terminal records on its own stream: its `method_result`
  records and their detail parts (§6.9).
- **Split point.** Where a frame boundary falls inside a terminal emission that spans frames:
  after the terminal parent, or after one of its detail parts. A resume there reads a durable
  suffix whose last terminal record is partial (§6.9).
- **Compaction.** A `row_seen` reset followed, in the same frame, by the log's live keys sealed
  again (§6.2).
- **Membership logs.** `seen`, `variants`, `row_seen` and `alt_seen`: the logs the worker loads
  on every lease. One cap, `MEMBERSHIP_ENTRIES`, bounds them together (§3, §6.11).
- **Reply.** The bridge's result for the worker's own final frame, marked `reply: true` (§8). An
  error a Node sink throws inside the lease, and a bridge failure with no worker reply, are not
  replies.

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
| `row_seen` | the row dedup keys that can still recur in the `_candidate_pairs` enumeration under way: the current row's, and those of earlier rows whose left span has occurrences left (`lyric-harness/quality/relations.py:3351-3357`); in the lower traversal, and within each alternate-phase call (§6.2) | ordered set log, first insertion | yes |
| `variants` | preparation output, one descriptor per variant span: the line, each pinned token's full reading choice (all of `c`, not only `c[2]`), the span key, the frame key and both bucket keys | list, in preparation order | no |
| `alt_cells` | judged alternate cells, one per yielded alternate pair, false verdicts included (`analysis.py:2512-2519`), appended when the event's delta is applied (§6.3). In a shared-sound epoch: its in-domain judged cells (`:2537-2546`), never an outside-domain binding | list with multiplicity | no |
| `alt_seen` | alternate keys within one line, and keys spilled from the current group past its bound (§6.4) | ordered set log, first insertion | no |

`seen`, `variants`, `row_seen` and `alt_seen` are the membership logs (§1): together they hold at
most `MEMBERSHIP_ENTRIES` entries, sealed and tail (§3).

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
- **No reset after a seal of the same log.** Because a frame's resets are applied before its
  seals, a frame cannot seal a log and then reset it: the seal from before the reset would fail
  W3. So a step that has already sealed `row_seen` ends at the safe point before a row boundary
  that resets it, and the reset opens the next frame (§6.2).

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
<cause> = "segment_missing" | "segment_corrupt" | "chain_broken" | "digest_mismatch"
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
  - reconciliation (§7.4), with cause `segment_missing`, `segment_corrupt` for a segment whose
    bytes do not match its address (F6), or `chain_broken` for a structural failure of its full
    read (F3, R2);
  - a full read in `resume()` that fails (§5.1), with cause `segment_corrupt` (F6) or
    `chain_broken` (F3, R2);
  - a pause with code `DISCOVERY_UNAVAILABLE` (§8), with the cause the worker named.

  A lease's walk never sets it (§5.1). `log` names the log the cause is about, or is `null`
  when the cause belongs to no one log (`inventory_mismatch`, `retired_key_recurred`, and
  `cursor_disagrees` over the epoch or the log names). `released` names every log `logs`
  held at the release, with its head then (`null` for a log with only a tail; never its
  verified head), so the cause stays traceable after GC reclaims the segments.
- Once it is set, it does not change: a later release of the record releases nothing (U1,
  §8). While it is set, it is the job's reason (U2, §8), `_dispatchable` skips the job, and
  `workerPayload`, `commitCheckpoint` and `resume` refuse it with `DISCOVERY_UNAVAILABLE`,
  naming its cause and log. The lease itself never refuses (§7.4). A tombstone drops the
  field with the rest of `discovery`.

### 2.8 Cursor v2

The cursor is owned by the worker and stored as `record.cursor`. Its declaration and schema
in `contracts.py` belong to the #721 author. Today's fields stay: `identity_hash`, `phase`,
`method_index`, `candidate`, `emission`, `sequence`, `counters`, `methods`, `done` and
`incomplete`, and `refused_schemas` once a schema has refused (`analysis.py:2563-2564`). The
changes:

- **`contract_version: 2`.** This is the cursor version. It is separate from
  `CONTRACT_VERSION` (1) in the identity (`contracts.py:18`, `:253`), which does not move.
- **`incomplete`** (`{name: reason}`) is also written at the moment either preparation flag
  is set (§6.6).
- **`methods[*]` holds none of the terminal inputs** `domain_true`, `domain_undecided` and
  `alt_cells` (`_TERMINAL_INPUTS`, `analysis.py:2439`). Today they accumulate in
  `methods[mid]` with every event's delta (`:2600-2605`) until `_advance` pops them
  (`:2445-2458`), so nothing bounds them. In v2, `alt_cells` is a log (§2.3) and the domain
  tallies are rebuilt under option 2 (§6.9). What stays in the cursor outside `discovery`
  and `continuation`, `witness` included, is at most `CURSOR_BYTES`, a bound derived from the
  engine's constants (§3.1), and each method's `refusal` is at most `REFUSAL_BYTES`; Node checks
  these rules under W4.
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
| `MEMBERSHIP_ENTRIES` | 32768 entries in the four membership logs together (`seen`, `variants`, `row_seen` and `alt_seen`, each sealed and tail): the bound derived from the first-commit budget (§6.11) | `RESOURCE_LIMIT`, naming the log whose append passes it: cause `discovery_seen`, `discovery_variants`, `discovery_row_seen` or `discovery_alt_seen` | `READER_PROTOCOL` (W7) |
| `GROUP_KEYS`, `GROUP_BYTES` | 32 keys and 8192 entry bytes in the current group | spill to `alt_seen` (§6.4): a spill rule, not a refusal | `READER_PROTOCOL` (W4) |
| `WITNESS_FIELDS` | 16 field names, each a dot path of lowercase names (`[a-z0-9_]`, joined by `.`) of at most 64 bytes | `INVARIANT_FAILURE` (an engine defect: the field list is the reducer's constant, five names in v1) | `READER_PROTOCOL` (W4) |
| `CONTINUATION_BYTES` | 8192 canonical bytes | `INVARIANT_FAILURE` (an engine defect, never a truncation) | `READER_PROTOCOL` (W4) |
| `REFUSAL_BYTES` | 1024 canonical bytes of one method's refusal (`methods[*].refusal`) | `RESOURCE_LIMIT` (cause `cursor_refusal_bytes`): its detail can carry text from the input, which makes this a regression for a long declared source label (§3.1, §12 item 27) | `READER_PROTOCOL` (W4) |
| `CURSOR_BYTES` | 163840 canonical bytes (160 KiB) of the cursor outside `discovery` and `continuation`, derived in §3.1 | `INVARIANT_FAILURE` (an engine defect: the largest cursor the constants allow is 142,912 bytes, §3.1) | `READER_PROTOCOL` (W4) |
| frame | 2 MiB (`worker.py:166`, `python_bridge.js:16`) | the existing frame refusal | — |
| control payload and record | 2 MiB (`READER_LIMITS.objectBytes`) | — | the existing `RESOURCE_LIMIT` 413 (`reader_job_store.js:78-83`) |

A worker `RESOURCE_LIMIT` names its cause (§8), pauses the job with that reason and does not
requeue it (`reader_scheduler.js:592-600`). Every `RESOURCE_LIMIT` raise the reader reaches names
one, not only this table's: the resident-capacity guard (`analysis.py:40-55`,
`resident_capacity`) and the meter's two budgets (`quality/meter.py:94-96`,
`declared_coordinate_bits`; `:110-113`, `expansion_budget`), which the reader reaches through
`library/form.py:351-372` and `quality/fit.py`. §8 lists every raise site, the validator fails on
a site it does not list, and C1 refuses a reply without a cause (§8). The worker's
`INVARIANT_FAILURE` for the two byte bounds, `CONTINUATION_BYTES` and `CURSOR_BYTES`, is
confirmed (BB8 6678599629): each is an engine defect, never a truncation. For `CURSOR_BYTES`
that holds only once the bound is derived from the constants (BB8 6678702125, ruling 2). §3.1
derives it, and the previous revision's 64 KiB does not hold the largest cursor, so the bound
is 160 KiB. `WITNESS_FIELDS` takes `INVARIANT_FAILURE` for the same reason as the byte bounds
(§12, item 17).

Derived bounds, computed from the constants (not measured):

- **`cursor.discovery`** is at most five tails of under 16384 entry bytes plus 1024
  separators each, plus one group of 8192 bytes plus 32 separators, plus about 1 KiB of
  envelope: about 96 KiB.
- **The whole cursor** is `cursor.discovery`, plus `continuation` (8 KiB), plus everything
  else (`CURSOR_BYTES`, 160 KiB, `witness` included): about 264 KiB. This holds only because
  `methods[*]` carries no terminal input (§2.8).
- **A frame** is at most 1 MiB of records (`worker.py:161`), plus the cursor (about 264 KiB),
  plus 8 seals of about 17.2 KiB each (16384 entry bytes, 1023 separators, two digests and
  the envelope), plus the summary, which this contract does not change: about 1.4 MiB plus
  the summary, under the 2 MiB caps.
- **The record** is the cursor (about 264 KiB), plus `record.discovery` (five logs, each
  about 200 bytes in `logs` and as much again in `verified`), plus today's record fields,
  including the inline page refs while `page_count` ≤ 250 (`reader_job_store.js:1062`). R2's
  store tests hold a record to that bound.

### 3.1 Deriving `CURSOR_BYTES` (BB8 6678702125, ruling 2)

The worker refuses a cursor past `CURSOR_BYTES` as `INVARIANT_FAILURE`, an engine defect, only
because no input can get it there. That holds when the bound is at least the largest cursor the
engine's own constants allow. This section builds that cursor from those constants, and
`bad/cursor_over_bound.json` builds it byte for byte.

**What the cursor outside `discovery` and `continuation` holds**, at this head:

| Part | Bound | Source |
| --- | --- | --- |
| integers | each at most 2⁵³ − 1: 16 digits | F1's range |
| the envelope | `contract_version`, `identity_hash` (64 hex digits), `phase` (at most 12 bytes: `native_pairs`, `shared_sound`), `method_index`, `candidate`, `emission`, `sequence`, `counters` (five integers) and `done` | the cursor's fixed fields (`analysis.py:466-476`); the phases are the task list's and `"complete"` (`:440-462`, `:2457`) |
| `methods` | one entry per method a job names: at most 91, each key at most 37 bytes (`shared_sound:` and 24 hex digits) | the task list (`analysis.py:440-462`): `coordinates`, `form`, `language`, three native work methods (the most any language has, `fas`), its relation method, the 80 schemas and the four shared-sound methods; an assembly task shares its schema's id |
| one method's entry | seven integer counters (`candidates`, `true`, `false`, `undecided`, `refused_questions`, `first_reading_only`, `unreadable_tokens`), `coverage` (`answered` or `refused`, at most 8 bytes), `figure_counts` (three integers) and at most one `refusal` | every key the method's counts take (`analysis.py:2484-2490`, `:2556-2605`, `:2366`, `:2379-2398`, `:1871-1876`); the terminal inputs are gone (§2.8) |
| a refusal | at most `REFUSAL_BYTES` | its own bound, below |
| `incomplete` | one reason per schema, at most 80; the longest is 68 bytes (70 canonical): "its disputed words' readings collide on more than 1375311 line pairs", with `MINI_CAP` | the three writers (`analysis.py:716`, `:958`, `:1036`) |
| `refused_schemas` | at most the 80 schema names, each at most 39 bytes | the registry |
| `witness` | `WITNESS_FIELDS` dot paths of 64 bytes, a method id, a count and a digest; v1 holds five fields, the ids and every field `_domain_tally` reads (`analysis.py:1466-1479`) | §2.8, §3 |

**The refusal is the one part that grows with the input.** Its shape is fixed,
`{schema, capability, detail, missing, kind, vacuous}` (`quality/relations.py:184-236`), and its
names come from the registry. But its detail is a message built from the text: counts of loci
and pairs (`relations.py:2070-2072`, `analysis.py:1625-1628`), and, where `relations.py` builds
a vacuous-frame refusal, a declared source label (`relations.py:3586-3588`). So a long detail
cannot be an engine defect. It gets its own bound, `REFUSAL_BYTES = 1024`, and its own cause: a
refusal past it is `RESOURCE_LIMIT`, cause `cursor_refusal_bytes`, raised when the refusal is
stored, before the frame is emitted. The longest refusal at this head with no input text in it,
the stub-resolution refusal (`relations.py:4665-4676`), is 543 bytes (measured).

**This is a regression, stated** (§12, item 27). The vacuous-frame refusal embeds the declared
source label of each empty frame (`relations.py:3586-3588`), and `form.py:66-68` requires a label
only to be nonempty. No schema at this head has more than one frame capability, so a refusal
carries one label. With a one-byte label, the largest such refusal is 756 bytes (measured: `平仄
tonal template`, with a second capability missing), so a label of about 270 bytes or more passes
`REFUSAL_BYTES`. Today such a job completes with that method refused. Under v2 it stops with
`RESOURCE_LIMIT`, cause `cursor_refusal_bytes`, and does so every time. The other ways out are
BB8's to choose: bound a declared source label at validation, so that the refusal is bounded by
constants and the cause can go, or keep the detail out of the cursor (its sha256 and byte length,
since the refusal record the step emits keeps the words), which changes the shape of
`summary().methods[*].refusal`.

**The largest cursor.** Every integer at 2⁵³ − 1, 91 methods each at its fullest with a refusal
of exactly `REFUSAL_BYTES`, the longest reason for all 80 schemas, every schema refused, and the
widest witness:

| Part | Canonical bytes |
| --- | --- |
| `methods` | 128,766: 91 entries of 1,414 bytes each with its key, and their separators |
| `incomplete` | 9,041 |
| `refused_schemas` | 3,361 |
| `witness` | 1,274 |
| the envelope and its separators | 470 |
| the largest cursor | 142,912 |

- **The bound.** `CURSOR_BYTES = 163840` (160 KiB), 20,928 bytes above the largest cursor: room
  for 14 more methods at their fullest before the bound has to be derived again. The previous
  revision's 64 KiB does not hold the largest cursor, so it is replaced (§12, item 21).
- **What the worker does past it.** A cursor past `CURSOR_BYTES` has every refusal within
  `REFUSAL_BYTES`, which is checked first, so only content no constant allows can get it there,
  such as a method the registry does not have. That is `INVARIANT_FAILURE`, never a truncation.
- **When it is derived again.** On any change to the inputs above: a method, a schema, a
  counter, a reason or a refusal bound. On each run the validator reads, from the registry and
  the source: the methods and their ids, the schema names, the phases, the coverage values, the
  cursor's counters (`analysis.py:470`), every key a method's counts take, the incomplete
  writers and their templates, and the fields `_domain_tally` reads. It fails when any of them
  passes this table's inputs.
- **Tests** (`bad/cursor_over_bound.json`): the largest cursor and a cursor of exactly
  `CURSOR_BYTES` are accepted. One byte over is refused by W4, and by the worker as
  `INVARIANT_FAILURE`. One refusal one byte over `REFUSAL_BYTES` is refused by W4, and by the
  worker as `RESOURCE_LIMIT`, cause `cursor_refusal_bytes`.

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
   - **W7, the membership cap.** After the frame, the four membership logs hold at most
     `MEMBERSHIP_ENTRIES` entries together: for each of `seen`, `variants`, `row_seen` and
     `alt_seen`, its count plus its new tail (§3, §6.11).
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
     frame's and its fields dot paths within `WITNESS_FIELDS`. `continuation` stays within
     `CONTINUATION_BYTES`. `methods[*]` carries no terminal input, each method's `refusal`
     stays within `REFUSAL_BYTES`, and the cursor outside `discovery` and `continuation` stays
     within `CURSOR_BYTES` (§2.8, §3.1). A record holding discovery with a frame and cursor
     that have none also fails W4.
4. **Write order:** pages, indexes, manifest and checkpoint as today
   (`reader_job_store.js:1051-1097`), then one segment per seal in seal order (each
   `previous_hash` is the log's head at that point), then the record (`:1098-1111`). The
   record's `discovery` becomes `{version: 1, epoch, logs, verified, unavailable: null}`,
   where each seal sets `head` to the new address, adds one to `segments`, adds its count to
   `count` and sets `digest` to the recomputed digest. `verified` keeps each log's state
   unless the frame releases or resets that log; a log that is new, reset or of a new epoch
   starts at the empty state. A commit never advances `verified`: only a read of the stored
   segment does (§5.1). The store appends each seal's address to that chain's address list
   (§5.1) only after the record save that sets its new head returns. A commit whose record
   save throws leaves every list as it was. A throw that carries a status (`encoded`'s 413,
   `_capacity`'s 507 or 503, `:568-571`) comes before the record is written, `_quotaPause`
   included (`:1118-1119`), so only orphans changed (§7.3). A throw without a status can come
   after the rename (`atomicWrite`, `:125-128`), so the record may have landed: the outcome is
   unknown (BB8 6681838131; 3PO 6681823180). The store then uses no list again until it has
   rebuilt them from the durable record's heads (§5.1).

## 5. Resume path

### 5.1 The store's walk (BB8 (a), 6678599629)

`workerPayload` and `resume` run it, so a lease checks the walk before the worker starts,
and `resume()` refuses a dead job at once instead of queueing it
(`reader_job_store.js:1369-1408`).

- **Under the writer lock.** Both run the walk through `_open` (`:759`), never through
  `_cached` (`:734-742`), which skips the lock while the generation has not moved.
  Entering the lock runs `_enterLock` (`:435-448`): after any foreign writer, a generation this
  instance did not write or a pending marker, it reloads, and reconciliation (§7.4) runs before
  the walk reads anything, so a segment an older image swept is found there. No other writer can
  delete one while the walk reads. `workerPayload` runs inside the scheduler's try block
  (`reader_scheduler.js:523`), so a refusal there pauses that one job.
- If `record.discovery.unavailable` is set, the store refuses with `DISCOVERY_UNAVAILABLE`,
  naming its cause and log, without walking.
- **The address list.** Statting a segment needs its address, and only the segment after it
  names it (the record names the head). So the store keeps in memory, for each live chain,
  the addresses of its segments, oldest first. A list changes only after the record save
  that changes its chain returns:
  - a commit appends each seal's address once its record save returns (§4). A commit that
    throws, `_quotaPause` included, leaves every list as it was, so a refused commit's
    orphans (§7.3) are never in a list (`good/lease_after_refused_commit.json`);
  - a release, a reset or an epoch advance empties the lists of the chains it releases;
  - a full read replaces the list with the addresses it read from the head;
  - **a save whose outcome is unknown** (BB8 6681838131; 3PO 6681823180 (a)) drops every list. A
    save that throws without a status may have landed after its rename (§4). `_open` then sets
    `this.failure` (`:759-772`), so the instance serves nothing more, its lists included, until a
    restart (`:389-395`). The restart's first lock entry reconciles, and its full read rebuilds
    every list from the durable record's heads, whichever record landed
    (`good/thrown_save_outcome_unknown.json`; the store's own test,
    `mcp/test_reader_job_store.mjs:310-327`, already holds a restart to the generation that
    landed). That is BB8's rule, "rebuild the address list from the record's head before using
    it", and in this store the rebuild is the restart's reconciliation, so it adds no place a
    chain is read in full. Required store test (R2's side): a commit whose record save throws
    after its rename, for each outcome, leaves no list in use until the rebuild, and the rebuilt
    list ends at the durable head.

  `_reload` drops the lists with the rest of the cache. A starting store holds generation −1
  (`:331`), so its first lock entry reloads and reconciles, which full-reads every live
  chain. So every list in use was built by a full read in this process and then extended
  only by commits whose saves returned. The list is never persisted; the record holds the
  heads and the verified heads.
- **On a lease the walk is incremental.** For each log, with `v` its verified state:
  1. **R5, the store's own bookkeeping**, checked for every log before anything is read.
     `verified` names exactly the logs `logs` names. The address list holds exactly the
     head's `segments` addresses and ends at the head (it is empty when the head is
     `null`). `v` is never ahead of the head (§2.7): its `segments` and `count` are at most
     the head's, it is the empty state when its `segments` is 0, it is the head's own state
     when its `segments` equals the head's, and otherwise the list's address number
     `v.segments`, counting from 1, is `v.head`.
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
- **A mismatch on a lease** (confirmed, BB8 6681838131). A lease's walk reads only segments
  this process listed itself: a commit wrote each one after W3 checked its link, or a full read
  checked it, and F6 holds its bytes to its address. Only this image's own bookkeeping writes
  the list and `verified`. So a failure of R5, R2, F3 or F6 on a lease is this image's
  bookkeeping disagreeing with the record or with the stored segments. It is not evidence that
  the chain is broken. It is
  `STORAGE_CORRUPT` (503), like the image's other defects (§7.4): nothing is released or
  saved, and the job keeps its chains. The scheduler pauses the job with that reason
  (`reader_scheduler.js:592-600`). `resume()` then decides by a full read, which uses
  neither `verified` nor the list. `bad/verified_ahead_of_head.json` is refused this way
  before anything is read; its full read passes and saves the corrected verified heads.
- **A full read** starts at the record's head and follows `previous_hash` back to the chain's
  first segment, reading each segment once and at most the head's `segments` of them. It
  never uses the address list. Each read goes through `_object('pages', …)` (F6). The chain
  is then checked oldest first: the oldest has `previous_hash: null`, `first: 0` and
  `digest_before = d₀`; each segment passes F3 and links to the one before it; and the chain
  holds exactly the head's `segments`, `count` and `digest` (R2). The list is replaced with
  what was read. A segment whose bytes do not match its address (F6) is
  `DISCOVERY_UNAVAILABLE` (409), cause `segment_corrupt`, logged at error level: corruption,
  never relabelled as breakage (BB8 6681838131). A structural failure, R2 or F3 (a link, a
  count, `first` or a field), is cause `chain_broken`. Either way the store releases the logs in
  one save (U1, §8), then refuses, naming the cause and the log. To tell F6 apart, the full read
  takes `_object`'s hash-verification refusal (`:679-680`), and a failed bounded inflation of a
  segment (`decodeStoredObject`, `:164-214`), as F6; any other error keeps its own code. In
  `resume()` this is new (§12, item 26): `_object` turns F6 into `STORAGE_CORRUPT`
  (`:668-683`), which would leave the job paused at `STORAGE_CORRUPT` on every resume. Apart
  from the membership logs the worker loads on every lease (§5.2), which is logged membership
  state that ruling (a) lets resume grow with, a chain is read in full in exactly three places:
  1. the worker's load of `alt_cells` when it builds the terminal record (§5.2), by its
     paths;
  2. reconciliation after any foreign writer, which includes startup (§7.4);
  3. `resume()` of a paused or cancelled job. Its own save (`:1392-1407`) carries the advanced
     `verified`.
- **Crash safety.** `verified` lives in the record, written in the same save as the heads it
  verifies, and it is never ahead of the head:
  - a commit moves the head and leaves `verified` (§4);
  - a release empties both in one save (§7.2);
  - the walk sets it to heads it has just read, under the lock that every commit needs.

  A crash before the walk's save leaves the older verified head, so the next walk reads more,
  never less. A crash loses the address lists, and the restart's reconciliation rebuilds them
  from the heads. A record whose verified head is ahead of its head fails R5 and releases
  nothing.
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
  - **F6.** Changed bytes are `STORAGE_CORRUPT`: the job pauses with it, nothing is released,
    and `resume()`'s full read then releases it as `segment_corrupt` (§5.1).
- **F3 and R2** as in §5.1, with cause `chain_broken`.
- **F5.** Every segment's `digest_after` is recomputed from its entries. A mismatch is cause
  `digest_mismatch`.
- **R3, cursor agreement.** The summary's epoch and log names equal `cursor.discovery`'s.
  For each log, `count` equals `sealed` and `digest` equals `sealed_digest`. A mismatch is
  cause `cursor_disagrees`.
- **Membership.** It is then each log's sealed entries followed by its tail.
- **When `alt_cells` is read.** The worker reads its segments, and checks them by R1, F6,
  F3, R2 and F5, only when it builds the terminal record (`analysis.py:2386-2403`,
  `:1870-1879`). That is one of the three full reads (§5.1), by its paths, oldest first. On
  every other lease it checks `alt_cells` by R3 alone, and the store's walk stats its verified
  segments and reads only those appended since (§5.1).

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
its meaning; the order only makes the bytes canonical. It counts toward `MEMBERSHIP_ENTRIES`
(§3): an append that would pass the cap refuses with `RESOURCE_LIMIT`, cause `discovery_seen`, and
so does `variants`' with `discovery_variants`. **Test:** a guard that no consumer iterates
`seen`. If one ever does, ruling 5 is reopened.

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
- **The alternate phase** (BB8 6681838131; 3PO 6681823180 (c)). `_new_pairs` enumerates with
  `_candidate_pairs(prune=True)` as well (`analysis.py:1063-1082`), and that call's row dedup
  lives within the call (`relations.py:3351-3357`). So in the alternate phase `row_seen` holds the
  row dedup keys of the call under way that can still recur, under the same reset and compaction
  rules. The end of each call, like the end of the lower traversal, is a row boundary with no
  live row state, where the worker resets the log if it holds any entry. It is not assumed
  empty: it counts toward `MEMBERSHIP_ENTRIES` with the other membership logs (§3), and an append
  that would pass the cap refuses with `RESOURCE_LIMIT`, cause `discovery_row_seen`.
- **Compaction.** At a row boundary where the log holds more than twice as many keys as
  are live, the worker resets `row_seen` and appends the live keys again, in their
  first-insertion order: a reset, then its seals, then its tail (§2.6 applies resets first,
  and W6 does not apply to a reset log). The decision depends only on the traversal, so a run
  restarted after a crash compacts at the same boundary and seals the same bytes.
- **A compaction is atomic within one frame** (BB8 6678702125, ruling 1). Its reset and every
  seal of the live keys land in one frame, or none of them does; a compaction is never split
  across frames. It joins the current frame only when the frame's seals so far plus the
  compaction's seals fit `FRAME_SEALS`, and the frame holds no seal of `row_seen` (§2.6).
  Otherwise the step ends at the safe point before that row boundary, and the compaction runs
  first in the next frame. Where a step ends never changes a segment's bytes: the cut rule
  depends only on content, and the compaction's seals are the cut of the live keys from an
  empty chain. A plain reset follows the same rule about a seal of `row_seen` already in the
  frame.
- **The bound that follows.** The log holds at most twice the live keys plus one segment,
  except while the live keys alone need more than `FRAME_SEALS` seals. Then no frame can hold
  the compaction, so it waits and the log grows, until `MEMBERSHIP_ENTRIES` stops it with
  `discovery_row_seen` (§3).
- **Confirmed** (BB8 6678599629). The compaction decision depends only on the traversal,
  keeps the live keys in their first-insertion order and leaves membership unchanged.
  Atomicity is the amendment of 6678702125.
- **Tests, all four required** (BB8 6678599629, 6678702125, 6681838131):
  - a fixture with repeated left spans, restarted mid-row, matches the uninterrupted run
    (BB8 4);
  - one whose left spans repeat far apart compacts, and its restart at the compaction
    boundary matches the uninterrupted run too;
  - a frame that already carries seals reaches a compaction boundary: a restart there matches
    the uninterrupted run, and no frame holds part of a compaction (BB8 6678702125; the store's
    side is `good/row_seen_compaction_next_frame.json`);
  - a run restarted mid-row inside the alternate phase matches the uninterrupted run, and
    `row_seen` is reset at the end of each alternate call (BB8 6681838131).

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
- **The membership cap.** `alt_seen` counts toward `MEMBERSHIP_ENTRIES` with the other
  membership logs (§3, derived in §6.11). A new key that would take them past it is refused with
  `RESOURCE_LIMIT`, cause `discovery_alt_seen`, before the frame is emitted. It is never dropped,
  and never kept only in memory (`bad/membership_over_cap.json`).
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
judged cell, false included, is an `alt_cells` entry of its epoch. An outside-domain binding
logs nothing and moves no domain tally, but it is still a candidate: `candidates` increments,
as it does today (`delta["candidates"] = 1`, `analysis.py:2556`). So records and counters equal
an uninterrupted run's, which the tick test of §6.7 pins (BB8 6678702125, ruling 6). Only a tick
moves no counter (§6.7).

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
     (BB8 6678599629). It is a run of that method's `method_result` records
     (`analysis.py:2401`), each followed by its own detail parts, because parts are written
     immediately after their parent (`analysis.py:221`). Within the suffix the parts follow
     their parent exactly as `resolve_detail_records` requires (`analysis.py:218-256`):
     each part is of that method, its `parent_id` is its parent's id, its `detail_id` is one
     of the parent's `$detail_ref`s, its `part` runs 0, 1, … within that ref, and its
     `total` equals the ref's `parts`. Once a ref's parts are complete, their bytes must
     match its `byte_length` and `sha256`. Every terminal record but the last is complete;
     only the last may be partial, because the stream may end inside its emission. The
     suffix is filtered out before resolving. So a resume inside a terminal emission that
     spans frames, with its parent durable and its parts not yet, reads as consistent, not as
     a missing record. Any other record after the boundary is an inserted record, and it
     refuses `RESULT_EXPIRED`. That covers a contribution, a record or detail part of
     another method, a contribution's detail part, a part outside its parent's run, a
     duplicated part, and a terminal record cut off by the next record before its parts are
     complete. A non-terminal record after a suffix record is one of these. Changed detail
     bytes, a wrong part index and a wrong total refuse the same way.
  3. The count and the digest must equal the witness's.
- **The suffix stays checked, at a resume and at every read** (BB8 6678702125, ruling 3).
  Filtering the suffix out of reconstruction does not exempt it. Whenever the terminal record is
  resolved, or a resume reads a durable suffix that ends at a split point,
  `resolve_detail_records`' own checks apply to the suffix: a missing, out-of-order, stale or
  changed part, or a part naming another parent, refuses `RESULT_EXPIRED`, and only the last
  terminal record may be partial. A suffix part whose parent is not that method's
  `method_result` is an inserted record.
- **Resolver success is not suffix validation** (3PO 6678848728; BB8 6678856548). The generic
  resolver checks parts against their parent. It does not check which method a record or part
  belongs to, or that the records after the boundary are terminal. 3PO ran #721's actual
  resolver at three split points: it refused 15 integrity faults and accepted 9 cases that are
  not the method's terminal suffix. The table below is this contract's reading of those cases
  (§12, item 24). So the worker's suffix-membership check is a separate check, an acceptance
  requirement of its own, and it **runs before resolving** (BB8 6678856548): every record after
  the boundary is this method's `method_result` or one of its parts, in its run, and nothing
  else. The worker must refuse each of the 9 as `RESULT_EXPIRED`, whatever the resolver says.
  Each is a required worker refusal. Generic resolver success never counts as suffix
  validation.
- **What membership is.** A record after the boundary is a member when it is a `method_result`
  whose `method_id` equals `witness.method_id`, or a `detail_part` whose `method_id` equals
  `witness.method_id` and that sits in its parent's run. The check is on the parent and on every
  part, and `method_id` is the only field that counts. `load_records` also matches `schema_id`,
  `schema_name` and the engine payload's ids (`worker.py:143-151`); none of them makes a record a
  member or stops one being one, so a part whose `schema_name` alone changes is accepted (the
  `after_part_0_schema_name_only` control).
- **The cases.** A terminal record whose detail is four parts is emitted across frames, and a
  resume reads it at three split points: after the parent, after part 0 and after part 1
  (`bad/terminal_suffix_resume_faults.json`). Each case is derived from its split point's
  durable prefix: the contributions, the parent and the parts written before the split. The
  Read column says when the worker meets the fault:
  - **at the resume** (`read: "resume"`): the fault is in that prefix, and the resume at that
    split point reads it;
  - **later** (`read: "later_read"`): the fault is in the first part the resumed lease writes,
    and it is read by the next resume in the same epoch whose durable suffix holds that part: a
    resume at a later split point, or a resume after the last part when the step ended before
    the advance.

  At each split point:

  | Fault | Where | Read | Refused by |
  | --- | --- | --- | --- |
  | a missing part | the first part the resumed lease writes is skipped | later | `resolve_detail_records` |
  | reordered parts | that part and the next one swap | later | `resolve_detail_records` |
  | a stale part | that part is from an earlier emission, under another `detail_id` | later | `resolve_detail_records` |
  | a changed part | that part's bytes change | later | `resolve_detail_records` |
  | a wrong parent id | that part names another parent | later | `resolve_detail_records` |
  | a part of another method | that part's `method_id` is another method's | later | the worker's suffix-membership check alone |
  | a parent of another method | the durable terminal parent's `method_id` is another method's | at the resume | the worker's suffix-membership check alone |
  | an inserted record | a contribution between the boundary and the terminal parent | at the resume | the worker's suffix-membership check alone |

  Five faults at three split points are the 15 refusals the resolver gives itself. Three at
  three are the 9 required worker refusals. Each refuses `RESULT_EXPIRED` 410. The durable
  prefix at each split point, and the complete suffix, are accepted.
- **Multiplicity.** Repeated ids are distinct emissions. Nothing deduplicates by public id
  or token pair, or normalises roles, before hashing or counting.
- **Refusal.** All of these refuse as `RESULT_EXPIRED` (6673031748 §2), before pair
  reduction, with no partial terminal:
  - a count or digest mismatch;
  - a missing, inserted, duplicated or reordered record, or a same-count replacement;
  - an endpoint-role swap, or a change in any witness field;
  - a record after the boundary that is not the terminal suffix: an inserted record,
    including one that breaks the suffix's run or belongs to another method;
  - a detail part that is missing, out of order, stale, changed or naming another parent,
    including after a resume inside a terminal emission that spans frames;
  - a null witness on a method that option 2 qualifies. It is never read as empty
    history.

  `bad/witness_mismatch.json` holds one mutant for each.
  `bad/terminal_suffix_not_contiguous.json` holds the suffix's own mutants, its parts' among
  them, and controls that keep the suffix contiguous and complete and are accepted.
  `bad/terminal_suffix_resume_faults.json` holds the 24 faults at the three split points, and
  its controls.
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
    (`_assembly_records`, `analysis.py:2325-2345`);
  - at each of the three split points, the worker refuses the 15 integrity faults through
    `resolve_detail_records`, and the 9 cases the resolver accepts through its own
    suffix-membership check, which runs before resolving (3PO 6678848728, BB8 6678856548,
    `bad/terminal_suffix_resume_faults.json`);
  - the 3 valid restores, one at each split point, finish the emission byte-identical to the
    uninterrupted run (BB8 6678856548, from 3PO's disk-backed restores in 6678848728), and the
    durable prefixes, the complete suffix and the `schema_name` control are accepted.
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

### 6.11 Resume cost (BB8 8; BB8 (a), 6678599629; BB8 6681838131)

Measured on #656, a resume costs about 8–19 s (construct plus load plus recompute, §10), and
nothing is re-traversed. In an earlier revision two terms grew with position after the primary
phase: the worker's load of `alt_seen`, and the store's walk of `alt_cells`. Ruling (a) fixes
both, and 6681838131 widens the cap to every log the worker loads on every lease, so the cost of
a lease up to its first commit is bounded by a constant:

- the store's walk is incremental (§5.1): it stats the verified segments and reads only the
  ones appended since;
- `alt_cells` is loaded only at finish (§5.2);
- the four membership logs, `seen`, `variants`, `row_seen` and `alt_seen`, share one cap,
  derived below from the lease's first-commit budget. Each is loaded on every lease, and `seen`
  alone at `CHAIN_SEGMENTS` would load for about 191 s, so a cap on `alt_seen` alone did not meet
  the criterion.

**The derivation.** The budget is 30 s from a lease's start to its first commit (§9). The
inputs are §10's measurements, not bounds; the result, `MEMBERSHIP_ENTRIES = 32768`, is the
bound. Every term is at the loaded-host factor (BB8 6681838131).

| Term, at the loaded-host factor | Value | Source |
| --- | --- | --- |
| load rate | 30.4 µs per entry × 3 = 91.2 µs | measured on the light host (§10) |
| construct | 6.4 s × 3 = 19.2 s | measured on #656, light host (§10) |
| recompute | 0.9 s × 3 = 2.7 s | measured on #656, light host (§10) |
| incremental walk | at most 10,240 segments × 10 ms / 99 × 3 = 3.10 s | the measured walk rate (§10), computed at the bounds |
| load of the membership logs | n entries × 91.2 µs | computed |

- **The factor is 3.** It is the load's own measured loaded/light ratio, 2.5, rounded up to a
  whole factor (§10). It is above each term's own measured ratio (construct 2.375, recompute
  2.67), so every term is at or above its loaded-host measurement: construct 19.2 s against
  15.2 s measured, recompute 2.7 s against 2.4 s.
- **The walk term** is a full read of five chains of `CHAIN_SEGMENTS` (10,240 segments) at the
  measured rate, about 0.3 ms per segment once scaled. An incremental walk stats the verified
  segments, which costs less than reading them, and reads only the appended ones, so it costs
  at most this.
- **The sum.** The fixed terms come to 19.2 + 2.7 + 3.10 = 25.00 s. That leaves 5.00 s, or
  54,791 entries at 91.2 µs each, and 43,826 once the first step's 1 s deadline
  (`analysis.py:2582`) is kept as margin.
- **The bound.** `MEMBERSHIP_ENTRIES = 32768`, the power of two within that margin: 32 segments
  full by count. At the cap the load is 2.99 s and the sum is 27.99 s, 2.01 s under the budget.
- **#656 fits.** Its `seen` and `variants` hold 20,045 entries (§10), leaving 12,723 for
  `row_seen` and `alt_seen`; its `alt_seen` is empty (measured), and its `row_seen` holds one
  row's keys at a time, since no left span repeats. The figure 16,384 in 6681838131 is the
  previous revision's cap for `alt_seen` alone, with `seen` and `variants` as fixed terms. As a
  combined cap it would refuse #656's own primary phase with `discovery_seen`, so the same
  derivation over the combined sum gives 32,768 (§12, item 25).
- **The cause names the log.** An append that would take the four logs past the cap refuses
  with `RESOURCE_LIMIT`, cause `discovery_seen`, `discovery_variants`, `discovery_row_seen` or
  `discovery_alt_seen`: the log whose append passes it (`bad/membership_over_cap.json`). A store
  sent such a frame refuses it as `READER_PROTOCOL` (W7).

**What the bound leaves out** (§12, item 18, ruled by 6681838131). The cap bounds a lease's cost
up to its first commit, and only that. It is never a qualification of a whole lease's cost.
Each exclusion is named, and each is either capped or left out on purpose:

- **Construct and recompute are #656's measurements**, scaled. They depend on the text, not on
  the cursor's position.
- **Finish work is outside the first-commit criterion, and open.** The finish lease loads
  `alt_cells` in full: 12,105 entries on #656, about 1.10 s at 91.2 µs, and up to 2,097,152
  entries at `CHAIN_SEGMENTS`, about 191.26 s. It reads the committed evidence for option 2's
  reconstruction (`load_records`, about 63 MB plain on #656, not timed, §6.9). And it runs
  `_domain`'s unpruned enumeration (`analysis.py:1426-1432`), up to `DOMAIN_CAP` = 248,661,361
  pairs, not timed. It happens once, so the first-commit criterion does not cover it, but the
  finish lease must complete before the lease expires, or it loops. The proof run measures it
  (§9). If it does not fit, it needs checkpointable progress of its own or option 2's domain-log
  fallback (§6.9). It is listed as open, not as qualified (§12, item 29).
- **Reconciliation inside a lease's lock entry is an accepted exclusion.** After any foreign
  writer, a generation this instance did not write or a pending marker (`_enterLock`,
  `reader_job_store.js:435-448`), the lease's first lock entry reconciles, which full-reads
  every live chain of every job (§7.4). At the default 256 MiB quota (`server_http.js:336`), if
  all of it were segments of about 17.5 KiB, that is 14,979 segments: 4.54 s at the scaled walk
  rate, more than the margin above. The proof run records each one (§9).

The measured gate stays: in the proof run, every lease's first commit lands within 30 s of the
lease start, and each walk's time is recorded (§9).

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
- reconciliation (§7.4), a full read in `resume()` that fails (§5.1), and a pause with code
  `DISCOVERY_UNAVAILABLE` (§8), each of which also sets `unavailable` (§2.7, U1).

Every release empties the released logs' `verified` states in the same save, and their
address lists once it returns. The walk's advance of `verified` (§5.1) is not a release: it
moves no head and frees nothing. A lease's walk never releases.

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
  The address lists are as they were (§4), so the next lease never reads an orphan, and the
  re-seal writes the same addresses (`good/lease_after_refused_commit.json`).
- **A seal lands while a collection is open.** The new file is newer than the mark, and the
  record is marked dirty, so it is never swept.
- **An exact retry** writes nothing.
- **The walk's save of `verified` is lost.** The older verified head stays, and the next walk
  reads the appended segments again (§5.1). A verified head is never saved ahead of its head.
- **A crash loses the address lists.** The restart reconciles, and its full read rebuilds them
  from the heads (§5.1).
- **A record save throws after its rename.** The record may have landed, so the outcome is
  unknown: the instance serves nothing more until a restart, and the restart's reconciliation
  rebuilds every list from the durable heads, whichever record landed (§4, §5.1,
  `good/thrown_save_outcome_unknown.json`). A throw with a status came before the write, so only
  orphans changed.
- **A release** empties `logs` and `verified` in one save, so a verified head never outlives
  its head.
- **Only GC deletes.**

### 7.4 Missing segments: where tolerance is allowed

- **Who can delete a live segment:** only an older image, because its GC has no discovery
  root. Instances share the store directory and the lock is held per write
  (`mcp/READER_RUNTIME.md`), so an old instance can sweep while a new one runs. Its
  deletes go through `_unlinkCounted`, which begins a write, so the generation moves.
- **Where the store notices: reconciliation**, whenever it enters the lock after any foreign
  writer: a generation it did not write, or a pending marker (`_enterLock`, `:435-448`, which
  already reloads the records and abandons the GC). A foreign writer is any other instance, of
  this image or an older one, not only an image that sweeps (3PO 6681823180 (b)). Startup is
  one such entry: a starting store holds generation −1 (`:331`), so its first lock entry
  (`:342-379`) always reconciles. Every discovery read the
  store makes is the walk or reconciliation, and both run under the lock (§5.1), so a walk
  always runs after the reconciliation it needs.
- **Reconciliation is a full read** (§5.1) of every live chain, one of the three places a
  chain is read in full. It starts at each head and stats each segment before reading it,
  because `_object` maps `ENOENT` to `STORAGE_CORRUPT` (`:668-683`), and it replaces the
  address lists with what it read. For a #656-sized job that is 99 segments (measured), and
  at the bounds up to 5 × `CHAIN_SEGMENTS` per job (computed). It saves no verified head:
  usage is unknown until the recount (`:444-447`), and only a save that does not grow a
  record commits then. The job's next walk reads from its saved verified head.
- **A chain it cannot use is released**, in one save:
  - a missing segment: `unavailable` becomes `{cause: "segment_missing", log, released}`;
  - a segment whose bytes do not match its address (F6): `{cause: "segment_corrupt", log,
    released}`, and a log line at error level (BB8 6681838131). Corruption stays visible as
    corruption; it is never relabelled as breakage (`bad/segment_corrupt_at_reconciliation.json`);
  - a structural failure of the full read (F3 or R2: a link, a count, `first` or a field):
    `{cause: "chain_broken", log, released}`. `chain_broken` is structural only;
  - each of these releases that job and does not fail the store, so one job's chain never stops
    a startup;
  - `logs` and `verified` are emptied in the same save (U1, §8);
  - a queued job is also set to `paused`, with `deferred_requeue: false` and a null fence. It
    keeps its `queued_at`, `queue_order` and `cancel_requested`: the release is not
    `store.pause`, which rewrites them (`:1253-1290`). Its reason is
    `{code: "DISCOVERY_UNAVAILABLE", cause, log, released}` with no message text; the message
    is rendered from the cause (§8). This is confirmed (BB8 6678599629):
    it is better than leasing a job that must fail, and `_dispatchable` skips it, so the
    queue never spins;
  - a running job's state and reason are left to its lease: its next refusal, from
    `workerPayload` or `commitCheckpoint`, pauses it with the reason copied from
    `unavailable` (U2, §8);
  - **fencing** (BB8 6678702125, ruling 5): the release goes through the normal record save.
    A running job's lease, fence and attempt are untouched, so its holder's next commit is
    refused (`DISCOVERY_UNAVAILABLE`, from `unavailable`, before any rule) and writes nothing.
    A queued job becomes `paused` with a null fence, as above, and keeps its attempt counter,
    as paused and cancelled jobs do. Nothing resets a fence on a job some instance holds.
    **Test** (`good/release_fencing.json`): reconciliation on one instance during a live lease
    on another does not let that lease's next commit land, and does not change its fence;
  - paused and cancelled jobs keep their state. Their reason becomes the one copied from
    `unavailable` (U2), and `resume` refuses them.

  A log line is written, at error level for `segment_corrupt`. **The release is provably no
  larger** (BB8 6678702125, ruling 5). In `unavailable.released`, each released log's state,
  `{head, segments, count, digest}`, collapses to its name and its head, `{"<log>": <head>}`, as
  the previous revision (`2e8ae0239`) already defined it, and the reason copies the same map
  (U2). For each released log the save drops its two states, in `logs` and in `verified` (about
  190 bytes with a head, about 125 for an empty state), and adds its head twice (about 80 bytes
  each, or about 20 for a log with only a tail). It adds the cause and the log twice (about 30
  bytes each time) and about 90 bytes of envelope once. Reconciliation releases a chain because
  one of its segments is missing, damaged or does not fit, so at least one released log has a
  head. The validator holds the property over every combination of logs at the bounds: each log
  absent, with only a tail, or with a head at the smallest or the largest count; verified heads
  lagging or not; the three causes a full read releases with; and every job state with its
  attempt counter, its fence and its queue fields (`queued_at`, `queue_order`,
  `cancel_requested`) at their widest, kept as they were. The release is never larger than the
  record it replaces. The worst case is one log at its smallest count, with the longest cause
  and log names: the save shrinks by 13 bytes. The margin is small. A field added to this reason
  or to `unavailable`, such as a message or a time, would make the release grow, and a growth
  before usage is known is refused (`STORE_RECOUNTING`), which would fail the startup. Startup's
  commit-before-usage ordering relies on this property.
- **No refusal at lease time.** `store.lease()` is called outside the scheduler's try block
  (`reader_scheduler.js:514`) and takes the head of the queue
  (`reader_job_store.js:889-891`), so a lease that threw would pick the same job on every
  pump. `_dispatchable` (`:957-962`) skips a record whose `discovery.unavailable` is set,
  and refusals are raised only by `workerPayload`, `resume` and `commitCheckpoint`.
- **Startup order.** At startup the pass runs before the startup collection, which a0 moved
  ahead of the pauses (`:351-352`). Otherwise the mark would meet the missing segment and
  fail the store. The release only shrinks a record, so it commits before usage is known.
- **Everywhere else** a missing segment is `STORAGE_CORRUPT`, like any other object, and a
  mark that meets one abandons the collection, as today. Every other object kind (pages,
  indexes, manifests, checkpoints, records) keeps today's `STORAGE_CORRUPT`, which fails the
  whole store (BB8 6681838131). The new image's own bugs stay
  visible, and so does a lease's walk that finds this image's bookkeeping disagreeing with
  the record (§5.1): it releases nothing. An error without a status inside `_open` makes the
  whole store unavailable, which is why reconciliation stats before it reads.

## 8. Refusals

Nothing is ever reinterpreted, and missing state is never rebuilt.

| Code | Status | Raised by | When |
| --- | --- | --- | --- |
| `READER_PROTOCOL` | 400 | store, `commitCheckpoint`; scheduler, at the reply boundary | any of F1–F6 or W1–W7 on a frame. Nothing is written; the job pauses with this reason and is not requeued. The scheduler pauses a job with this code, without a status, for a reply that breaks C1. |
| `DISCOVERY_UNAVAILABLE` | 409 | store (`workerPayload`, `commitCheckpoint` and `resume` from `unavailable`; a full read in `resume()`; reconciliation's release) and worker (load, traversal) | causes below |
| `STORAGE_CORRUPT` | 503 | store; worker | a segment's bytes do not match its address (F6) on a lease's walk or the worker's load, which releases nothing, while a full read releases that job with `segment_corrupt` instead (§5.1, §7.4); the store meets a missing segment outside reconciliation, which releases that job instead (§7.4); or a lease's walk fails R5, R2 or F3 (§5.1), which releases nothing |
| `STALE_READING` | 409 | worker | a v1 cursor on a v2 worker, a v2 cursor on a v1 worker (`analysis.py:464`), or a witness whose fields are not the ones the worker's reducer reads (§6.9) |
| `RESULT_EXPIRED` | 410 | worker | the option 2 witness disagrees with durable history, or is null on a qualified method (§6.9) |
| `RESOURCE_LIMIT` | — (the job pauses) | worker | a §3 limit the worker cannot meet by ending its step, or another raise of §8's list; it names its cause (below) |
| `INVARIANT_FAILURE` | — (the job pauses) | worker | `CURSOR_BYTES`, `CONTINUATION_BYTES` or `WITNESS_FIELDS` passed: an engine defect (§3, §3.1) |

`DISCOVERY_UNAVAILABLE` always names its cause. 409 matches `STALE_READING`; 410 stays with
`RESULT_EXPIRED`, because here the result is not gone. The Log column says whether a reply's
`error_log` names a log (`required`), may (`optional`) or must not (`none`); §2.7's `log` follows
it. The causes:

| Cause | Rule | Raised by | Log | Message |
| --- | --- | --- | --- | --- |
| `segment_missing` | R1 | worker; store from `unavailable` | required | This analysis can no longer resume exactly: part of its saved progress is missing. Its committed evidence stays readable. Delete it, then create a new analysis with a new key. |
| `segment_corrupt` | F6 at a full read | the store's full read only (reconciliation, `resume()`), logged at error level; never a worker | required | This analysis can no longer resume exactly: part of its saved progress is damaged. Its committed evidence stays readable. Delete it, then create a new analysis with a new key. |
| `chain_broken` | R2, F3 at read | the store's full read (reconciliation, `resume()`); worker | required | This analysis can no longer resume exactly: part of its saved progress does not fit together. Its committed evidence stays readable. Delete it, then create a new analysis with a new key. |
| `digest_mismatch` | F5 at read | worker | required | This analysis can no longer resume exactly: part of its saved progress does not match its record. Its committed evidence stays readable. Delete it, then create a new analysis with a new key. |
| `cursor_disagrees` | R3 | worker | optional | the `digest_mismatch` message |
| `inventory_mismatch` | R4 | worker | none | the `digest_mismatch` message |
| `retired_key_recurred` | S1 | worker | none | This analysis cannot continue exactly: its search met a line pair it had already finished. Its committed evidence stays readable. A new analysis of the same text would stop at the same place. |

The `RESOURCE_LIMIT` causes, one for each §3 limit the worker cannot meet and one for each other
raise the reader reaches:

| Cause | Limit | Log | Message |
| --- | --- | --- | --- |
| `discovery_entry_bytes` | `ENTRY_BYTES` | required | This analysis stopped: one piece of its saved progress is larger than the format allows. Its committed evidence stays readable. |
| `discovery_frame_seals` | `FRAME_SEALS` | none | This analysis stopped: one step of its search needs more saved progress than one checkpoint can carry. Its committed evidence stays readable. |
| `discovery_chain_segments` | `CHAIN_SEGMENTS` | required | This analysis stopped: its saved progress grew past the format's limit. Its committed evidence stays readable. |
| `discovery_seen` | `MEMBERSHIP_ENTRIES`, by an append to `seen` | none | This analysis stopped: its search of the text's own readings kept more pairs than a resume can reload in time. Its committed evidence stays readable. |
| `discovery_variants` | `MEMBERSHIP_ENTRIES`, by an append to `variants` | none | This analysis stopped: it prepared more reading variants than a resume can reload in time. Its committed evidence stays readable. |
| `discovery_row_seen` | `MEMBERSHIP_ENTRIES`, by an append to `row_seen` | none | This analysis stopped: its search kept more pairs of one row than a resume can reload in time. Its committed evidence stays readable. |
| `discovery_alt_seen` | `MEMBERSHIP_ENTRIES`, by an append to `alt_seen` | none | This analysis stopped: its search of alternate readings kept more pairs than a resume can reload in time. Its committed evidence stays readable. |
| `cursor_refusal_bytes` | `REFUSAL_BYTES` | none | This analysis stopped: one of its methods' refusals is longer than a checkpoint can keep. Its committed evidence stays readable. |
| `resident_capacity` | the reader's memory envelope (`analysis.py:40-55`) | none | This analysis stopped: it needs more memory than this reader may use. No source or comparison was skipped. Its committed evidence stays readable. |
| `declared_coordinate_bits` | the meter's 256-bit coordinate budget (`quality/meter.py:94-96`) | none | This analysis stopped: a declared beat or meter position is larger than the reader can compute with. Its committed evidence stays readable. |
| `expansion_budget` | the meter's per-operation expansion budget (`quality/meter.py:110-113`) | none | This analysis stopped: a declared meter or beat pattern expands to more positions than the reader can compute with. Its committed evidence stays readable. |

Every `RESOURCE_LIMIT` raise the reader reaches, by module and enclosing function, and the cause
it names (review H2). The validator walks the imports of `library/analysis.py`, function-local
ones included, finds every raise whose message starts `RESOURCE_LIMIT`, and fails on one this
table does not list, unless its message names a cause of the set itself (`RESOURCE_LIMIT[cause]:`):

| Module | Function | Cause |
| --- | --- | --- |
| `library/analysis.py` | `_resource_guard` | `resident_capacity` |
| `quality/meter.py` | `exact_number` | `declared_coordinate_bits` |
| `quality/meter.py` | `guard_expansion` | `expansion_budget` |
| `lyric_harness.py` | `main` | none: the lyrics command line's writer check (`:15309-15312`); `library/form.py` imports the module for its lexicon, and the reader never runs `main` |

Plumbing (R2's side, with the #721 author for the worker's raises):

- **The whitelist.** `worker.py`'s whitelist (`:263-264`) gains `DISCOVERY_UNAVAILABLE`,
  `STORAGE_CORRUPT` and `INVARIANT_FAILURE`; otherwise they surface as `READER_ERROR`.
- **How the worker names a cause.** A refusal's message starts `CODE[cause]:` or
  `CODE[cause,log]:`, for example `RESOURCE_LIMIT[declared_coordinate_bits]: …` or
  `DISCOVERY_UNAVAILABLE[segment_missing,alt_cells]: …`. `worker.py` (`:261-264`) reads the code,
  the cause and the log from that head, applies the whitelist to the code, and sends
  `error_cause` and `error_log` beside `error_code`. A head that does not parse is
  `READER_ERROR`. Every raise site in the table above gains its cause this way: `analysis.py`'s
  (the #721 author's) and the meter's two, whose message heads change and nothing else.
- **The bridge forwards them, and marks a reply.** On the worker's final frame
  (`python_bridge.js:352-367`) the bridge passes `error_cause` and `error_log` beside
  `reader_result` and `error_code`, and sets `reply: true`. Today it forwards only
  `reader_result` and `error_code` (`:366`), so a worker's cause never reaches the scheduler.
- **The scheduler tells a reply from its own errors.** An error a Node sink throws inside
  `onReaderCheckpoint` (`reader_scheduler.js:549-567`: `commitCheckpoint`'s refusals, and
  `packReaderPages`' `RESOURCE_LIMIT`, `:452-456`) reaches the scheduler today only as a bridge
  result with code −1 and no status, cause or log (`python_bridge.js:347-349`, `:751`,
  `:657-676`). The scheduler keeps that error itself (`let sinkError`, set in
  `onReaderCheckpoint` before it rethrows) and, when the lease fails, rethrows it as it was, with
  its code, status, cause and log, instead of building one from the bridge result
  (`reader_scheduler.js:568-572`). Only a result with `reply: true` is a reply. A bridge failure
  with no reply (a kill, a timeout, an unreadable frame) pauses as today.
- **The pause.** The catch that pauses (`:592-600`) passes `failure.error_cause ?? failure.cause`
  and `failure.error_log ?? failure.log`, and for C1's reason `reply_code`, `field` and `value`;
  `store.pause` accepts them. A refusal the store raises from `unavailable` (`workerPayload`,
  `commitCheckpoint`, `resume`) or from a failed full read carries `cause` and `log`; one raised
  inside the sink reaches the catch through `sinkError`. The scheduler logs a reply's stderr,
  the worker's message with the meter's or the resident guard's figures, because a reason with
  a named cause stores no message.
- `store.pause` with code `DISCOVERY_UNAVAILABLE` releases the logs and sets
  `unavailable: {cause, log | null, released}` in the same save (§2.7). This is how a refusal
  the worker raises (R1, `digest_mismatch`, `cursor_disagrees`, `inventory_mismatch`,
  `retired_key_recurred`) frees the job's chains and quota, and why a later `resume()`
  refuses at once instead of requeueing a job that would fail the same way. Confirmed, with
  one condition (BB8 6678599629): the paused reason records the released log names and
  their heads at release.
- **U1, the release record.** Every release that sets `unavailable`, from reconciliation, a
  failed full read or a `DISCOVERY_UNAVAILABLE` pause, is one save. It empties `logs` and
  `verified`, and it sets `unavailable` with `released`: each log the record held, with its
  head at release. The committed evidence stays readable: a release frees discovery segments
  only, never pages, indexes, manifests or checkpoints (§7.2). **A release of a record whose
  `unavailable` is already set releases nothing and leaves `unavailable` unchanged**, so the
  first release's trace wins. That covers a pause after reconciliation released a running
  job, and a later pause that names another cause. A reply that names no cause never gets
  here: C1 refuses it first.
- **U2, the reason follows `unavailable`.** While it is set, every save that writes the job's
  reason writes `{code: "DISCOVERY_UNAVAILABLE", cause, log, released}`, copied from it, and
  stores no message: the job view renders the message from the cause, by the table above.
  The saves are a release itself (reconciliation's, of a queued, paused or cancelled job), a
  `store.pause` of any code, `_quotaPause` (`:972-990`), startup's `INTERRUPTED` pause
  (`:357-376`), `_expireLeases` (`:930-948`) and `cancel()` (`:1342-1360`). Each changes the
  state as it does today, except that while `unavailable` is set a pause never requeues the
  job: its state is `paused` (or `cancelled` on a requested cancel), with
  `deferred_requeue: false`. So the trace stays in the reason whatever happens to the job
  after the release, and the cause stays traceable after GC reclaims the segments.
  `good/unavailable_pause_reason.json` pins each path.
- **C1, the cause sets at the reply boundary.** This is BB8 6678702125, ruling 4, and it
  replaces an earlier revision's rule that anything outside the sets was discarded. The
  scheduler checks every reply, a result marked `reply: true`, before it pauses the job
  (`reader_scheduler.js:568-572`). Errors a Node sink threw, and bridge failures with no reply,
  are not replies, and C1 never checks them:
  - `DISCOVERY_UNAVAILABLE` needs an `error_cause` from the worker's six causes (every cause in
    the table above but `segment_corrupt`, which is the store's alone), and `RESOURCE_LIMIT` one
    from its eleven. So a missing cause, an unknown one, the store's own cause, and a cause of
    one code's set used with the other code all fail;
  - any other code carries no `error_cause`;
  - `error_log` follows the Log column: a §2.3 log name where the cause's is `required`, absent
    or a log name where it is `optional`, and absent where it is `none` or the code takes no
    cause.

  A reply that fails is a protocol failure. Nothing is released, and the failed value is never
  stored as a cause. The job pauses, and is not requeued, with the reason
  `{code: "READER_PROTOCOL", reply_code, field, value, message}`. `field` is `error_cause` or
  `error_log`. `value` names the bad value verbatim, a string as itself and anything else as
  its JSON text, cut to at most 64 bytes at a character boundary, or `null` for a missing one.
  The message names it too, so the pause always renders: "The reader worker replied
  DISCOVERY_UNAVAILABLE with no cause.", "The reader worker replied RESOURCE_LIMIT with the
  cause "chain_broken", which RESOURCE_LIMIT does not take.", "The reader worker replied
  DISCOVERY_UNAVAILABLE with the log "alt_cellz", which is not a discovery log.", "The reader
  worker replied DISCOVERY_UNAVAILABLE with the cause "segment_missing" and no log." or "The
  reader worker replied STALE_READING with the log "seen", which STALE_READING does not take."
  If `unavailable` is already set, U2 governs the stored reason, and the store logs the bad
  value instead. A worker `RESOURCE_LIMIT` with a valid cause pauses the job with
  `{code: "RESOURCE_LIMIT", cause}`, its message rendered from the table above.

  The store's and the scheduler's own refusals are not replies. A `RESOURCE_LIMIT` that Node
  raises (the record bound's 413, `reader_job_store.js:78-83`; `packReaderPages`,
  `reader_scheduler.js:452-456`) carries no cause and pauses as today, through `sinkError`. A
  sink's `DISCOVERY_UNAVAILABLE` carries its own cause and log to the pause and logs no bad value.
  `store.pause` still refuses, whoever calls it, a `DISCOVERY_UNAVAILABLE` without a cause from
  its set, and a cause outside its code's set. `bad/reply_cause_invalid.json` holds a missing, an
  unknown and a cross-code cause for each of the two codes, the other faults, and controls that
  pause as before: valid replies, the sink errors and a bridge failure.

  **C1 ships with the worker half.** It changes how every reply pauses: a worker of this head
  names no cause, so under C1 its `RESOURCE_LIMIT` would pause as `READER_PROTOCOL`. So C1 is
  switched on in the same change that makes the worker name its causes, and until then the
  scheduler pauses replies as today. Both halves ride one runtime train (§9), so a reply always
  comes from a worker of the scheduler's own image.

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
  `discovery`. C1 is switched on with the worker half, in the change that makes the worker
  name its causes (§8). Jobs paused on the previous image refuse `STALE_READING` anyway
  (`reader_scheduler.js:519-521`).
- **Proof run (R2).** It runs on a fresh disposable store with `READER_STORE_GZIP=1`, on the
  qualified image. It passes when the run completes, every lease's first commit lands within
  30 s of the lease start, discovery is about 1.6 MB plain and 0.2 MB stored, the store is at
  or below 40 MiB, and frames and the record stay within their derived bounds (§3). It
  records the restart count, each restart's cost, the segments each lease's walk read and
  statted and the time each walk took, any reconciliation and its time, `row_seen`'s size in
  both phases, the four membership logs' total against `MEMBERSHIP_ENTRIES`, worker memory in
  the alternate phase, and the finish lease's time: its full `alt_cells` load, option 2's read
  of the evidence and `_domain`'s enumeration, against the lease (§6.11). It is the completed
  run that Phase B needs (`mcp/READER_RUNTIME.md`).

## 10. Measured on #656, not bounds

All of these were measured read-only on the #656 run store, or computed from measured entry
sizes. Times are light host / loaded host. None is a bound; the bounds are in §3.

| Figure | #656 value | Kind |
| --- | --- | --- |
| `seen` | 19,880 entries, 80 segments, 1.34 MB with envelopes, about 0.15 MB gzip | measured |
| `seen` key | 65.3 B mean, 1.6 B per primary pair; 2.45% of pairs touch a varying word | measured |
| `variants` | 165 descriptors of about 240 B (211 B measured for `c[2]` alone), 3 segments, 0.04 MB | measured |
| `alt_cells` | 12,105 entries of 20.45 B, 16 segments, 0.25 MB | measured |
| `seen` plus `variants` | 20,045 entries, against `MEMBERSHIP_ENTRIES` (32,768) | measured |
| `alt_seen` | 0 entries: no within-line alternate pair, 6,250 line pairs each one contiguous run, at most 2 pairs per line pair | measured (BB8 1, 3PO 6) |
| primary rows | 1,560 rows, no repeated left-span index | measured (3PO 1) |
| `row_seen` | not measured; added by this revision | the proof run records it |
| segment envelope | about 550 B | measured |
| discovery total | about 1.64 MB plain, about 0.2 MB gzip | computed |
| per lease | walk about 10 ms; load 20,045 entries × 30.4 µs = 0.6 / 1.5 s; recompute 0.9 / 2.4 s; construct 6.4 / 15.2 s; about 8 / 19 s in all | measured |
| loaded / light | construct 2.375, load 2.5, recompute 2.67 | computed from the measured times; §6.11 rounds the load's 2.5 up to 3 |
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
| 19 | BB8 (a) (6678599629) | the store's walk is incremental: it stats every segment and reads and verifies only those appended since a persisted verified head; a full read happens in exactly three places | §1, §2.7 `verified`, §4, §5.1, §7.3, §7.4 | `good/lease_incremental_walk.json`, `good/lease_after_refused_commit.json`, `bad/verified_ahead_of_head.json` |
| 20 | BB8 (a) | `alt_seen` gets its own cap, derived from the 30 s first-commit budget on a loaded host; passing it is `RESOURCE_LIMIT`, cause `discovery_alt_seen` (widened to the four membership logs by row 33) | §3, §4 W7, §6.4, §6.11, §8 | `bad/membership_over_cap.json`; the §6.11 derivation test |
| 21 | BB8 (b) | confirmed: `row_seen` reset and compaction, with both tests required; `CURSOR_BYTES`, `CONTINUATION_BYTES` and `WITNESS_FIELDS`, with `INVARIANT_FAILURE` on the worker for the byte bounds; `methods[*]` holds no terminal input; the closed cause sets | §2.8, §3, §6.2, §8 | `good/lease_payload_summary_paths.json`; #721: both §6.2 tests |
| 22 | BB8 (b) | the terminal suffix is contiguous and belongs to its method alone; a non-terminal record after a suffix record is an inserted record | §6.9 | `bad/terminal_suffix_not_contiguous.json`, `bad/witness_mismatch.json` |
| 23 | BB8 (b) | reconciliation pauses a released queued job, with its reason rendered from the cause, and `_dispatchable` skips it | §2.7, §7.4, §8 U2 | `good/unavailable_pause_reason.json` |
| 24 | BB8 (b) | a `DISCOVERY_UNAVAILABLE` pause releases the logs; its reason keeps the released log names and their heads, and committed evidence stays readable | §2.7, §8 U1 and U2 | `good/unavailable_pause_reason.json` |
| 25 | 3PO 6678688668 recommendation 1; BB8 6678702125 ruling 1 | a `row_seen` compaction is atomic within one frame; when the frame lacks room, the step ends at the safe point before the boundary, and the compaction runs first in the next frame | §1, §2.6, §6.2 | `good/row_seen_compaction_next_frame.json` |
| 26 | 3PO recommendation 2; BB8 ruling 2 | `CURSOR_BYTES` is `INVARIANT_FAILURE` only once derived from the constants, with a max-cursor test; a part that grows with the input gets its own `RESOURCE_LIMIT` cause | §2.8, §3, §3.1, §4 W4, §8 | `bad/cursor_over_bound.json` |
| 27 | 3PO recommendation 3; BB8 ruling 3 | the terminal suffix stays checked by `resolve_detail_records`' own rules, at a resume and at every read; a part whose parent is not the method's `method_result` is an inserted record | §1, §6.9 | `bad/terminal_suffix_resume_faults.json`, `bad/terminal_suffix_not_contiguous.json` |
| 28 | 3PO recommendation 4; BB8 ruling 4 | a missing, unknown or cross-code cause is `READER_PROTOCOL`, naming the bad cause; it is never discarded | §8 C1 | `bad/reply_cause_invalid.json` |
| 29 | 3PO recommendation 5; BB8 ruling 5 | the release save is provably no larger, each released entry collapsed to `{log, head}`; the fence and the attempt counter are kept; a live lease on another instance cannot commit | §7.4, §8 U1 | `good/release_fencing.json`; the §7.4 property test |
| 30 | 3PO's §6.8 mismatch; BB8 ruling 6 | an outside-domain shared-sound binding moves no domain tally, and `candidates` increments as today | §6.7, §6.8 | #721 tick test |
| 31 | 3PO 6678848728 | the generic resolver accepts 9 wrong-method parents and parts and inserted non-terminal records; the worker's suffix-membership check refuses each, as a required acceptance case | §6.9 | `bad/terminal_suffix_resume_faults.json`, its 9 `accepts` cases |
| 32 | BB8 6678856548 | the suffix-membership check is separate and runs before resolving; the 9, the 15 and the 3 byte-identical valid restores are in the worker's acceptance list; resolver success never counts as suffix validation; membership is `method_id` alone | §6.9 | `bad/terminal_suffix_resume_faults.json`, each case derived from its split's durable prefix, and its five controls |
| 33 | BB8 6681838131 item 18; 3PO 6681823180 (d) | every term at the loaded-host factor; one combined cap over `seen`, `variants`, `row_seen` and `alt_seen`, with a named cause per log; the cap is never a whole lease's qualification | §1, §3, §4 W7, §6.1, §6.4, §6.11, §8 | `bad/membership_over_cap.json`; the §6.11 derivation test |
| 34 | BB8 6681838131 item 18; 3PO 6681823180 (c) | `row_seen` in the alternate phase is not assumed empty: it is in the shared budget, and a restart mid-row inside the alternate phase is tested | §2.3, §6.2 | #721: a restart mid-row in the alternate phase |
| 35 | BB8 6681838131 item 18; 3PO 6681823180 (d) | finish work is outside the first-commit criterion and open, and the proof run measures it; reconciliation inside a lease is an accepted, explicit exclusion | §6.11, §9 | proof run |
| 36 | BB8 6681838131 item 16; 3PO 6681823180 (e) | at lease time, corruption is `STORAGE_CORRUPT` with no save and no release; at reconciliation a byte mismatch is `segment_corrupt`, logged at error level and contained to the job; `chain_broken` is structural only; every other object keeps `STORAGE_CORRUPT` | §2.7, §5.1, §7.4, §8 | `bad/segment_corrupt_at_reconciliation.json`, `bad/verified_ahead_of_head.json` |
| 37 | BB8 6681838131; 3PO 6681823180 (a) | a thrown save is an unknown outcome: the address lists are rebuilt from the durable record head before use | §4, §5.1, §7.3 | `good/thrown_save_outcome_unknown.json` |
| 38 | BB8 6681838131; 3PO 6681823180 (b) | reconciliation follows any foreign writer, not only an older image | §5.1, §6.11, §7.4 | — |
| 39 | BB8 6681838131 | items 15, 17, 19 and 20: no semantic objection | §12 | — |

## 12. Rulings on the items added for confirmation

An earlier revision listed items 1–14 for confirmation. BB8 ruled on every one of them
(6678599629). BB8 has no semantic objection to the structural items (2–4, 6, 10 and 12), and
the cursor fields are 3PO's to confirm. BB8 then ruled on 3PO's amendments to items 1, 5, 7–9
and 11, and on §6.8's wording (6678702125), made item 11's suffix check an explicit acceptance
requirement (6678856548), and ruled on items 15–20 (6681838131). Each ruling is marked on its
item below. Items 21–29 are open.

1. **Ruled: confirmed** (BB8 6678599629). `row_seen`'s reset at row boundaries and its
   compaction (§6.2), and the frame's `resets` field. The compaction decision depends only on
   the traversal, keeps the live keys in their first-insertion order and leaves membership
   unchanged, so a restart compacts at the same boundary and seals the same bytes. Both §6.2
   tests are required. **Amended** (BB8 6678702125, ruling 1): a compaction is atomic within
   one frame; when the frame lacks room, the step ends before the boundary, and the compaction
   runs first in the next frame (§6.2, `good/row_seen_compaction_next_frame.json`).
2. **Ruled: no semantic objection** (BB8 6678599629). W6, append-only tails.
3. **Ruled: no semantic objection** (BB8 6678599629). `CHAIN_SEGMENTS = 2048` per chain. It
   no longer bounds the per-lease walk (item 14).
4. **Ruled: no semantic objection** (BB8 6678599629). The group bound (`GROUP_KEYS = 32`,
   `GROUP_BYTES = 8192`), with spill to `alt_seen`, which counts toward the membership cap
   (items 13 and 18).
5. **Ruled: confirmed** (BB8 6678599629). `CURSOR_BYTES = 65536` (163840 since the amendment
   below), `CONTINUATION_BYTES = 8192` and `WITNESS_FIELDS = 16`, with `INVARIANT_FAILURE` on
   the worker for the two byte bounds: both are engine defects, never truncations (§3). Also
   confirmed: `methods[*]` holds no terminal input (§2.8). **Amended** (BB8 6678702125, ruling
   2): `INVARIANT_FAILURE` for
   `CURSOR_BYTES` holds only once the bound is derived from the constants. §3.1 derives it. The
   64 KiB did not hold, so the bound is 160 KiB, and a refusal, the one part that grows with the
   input, gets `REFUSAL_BYTES` and cause `cursor_refusal_bytes` (item 21,
   `bad/cursor_over_bound.json`).
6. **Ruled: no semantic objection** (BB8 6678599629). A string with a lone surrogate is not an
   entry, and entries are equal exactly when their canonical bytes are (§2.1).
7. **Ruled: confirmed** (BB8 6678599629). Reconciliation pauses a queued job it releases, and
   the lease never refuses (§7.4). That is better than leasing a job that must fail: the
   reason is rendered from the cause, and `_dispatchable` skips the job, so the queue never
   spins. **Amended** (BB8 6678702125, ruling 5): the release keeps a running job's lease and
   fence and every job's attempt counter (§7.4, `good/release_fencing.json`).
8. **Ruled: confirmed** (BB8 6678599629). The closed cause sets and their messages (§8),
   including `retired_key_recurred`'s message, which is honest because that cause is
   deterministic. `discovery_alt_seen` is added as the fourth `RESOURCE_LIMIT` cause.
   **Amended** (BB8 6678702125, ruling 4): the sets are enforced at the reply boundary. A
   missing, unknown or cross-code cause is `READER_PROTOCOL`, naming the bad cause, never
   discarded (C1, §8, `bad/reply_cause_invalid.json`).
9. **Ruled: confirmed, with one condition** (BB8 6678599629). A `DISCOVERY_UNAVAILABLE` pause
   releases the logs; the worker's whitelist gains `STORAGE_CORRUPT`, its reply gains
   `error_cause`, and the scheduler passes it to `store.pause` (§8). The condition: the paused
   reason records the released log names and their heads at release, so the cause stays
   traceable after GC reclaims the segments (U1 and U2, §8). The committed evidence stays
   readable. **Amended** (BB8 6678702125, ruling 5): the release save is provably no larger.
   Each released entry collapses to `{log, head}`, which the previous revision already did, and
   a property test over every combination of logs holds it; the fence and the attempt counter
   are kept (§7.4).
10. **Ruled: no semantic objection** (BB8 6678599629). The inventory and witness digest
    domains, and the v1 witness fields.
11. **Ruled: confirmed, with one addition** (BB8 6678599629). Option 2's terminal-suffix rule,
    the refusal of a null witness on a qualified method, and `STALE_READING` for a witness
    whose fields the reducer does not read. The addition: the suffix is contiguous and belongs
    to its method alone, and a non-terminal record after a suffix record is an inserted record
    (§6.9). **Amended** (BB8 6678702125, ruling 3): filtering the suffix does not exempt it.
    `resolve_detail_records`' checks apply to it at a resume and at every read, and a part
    whose parent is not the method's `method_result` is an inserted record. 3PO's resolver run
    (6678848728) adds 9 cases only the worker's suffix-membership check refuses (§6.9,
    `bad/terminal_suffix_resume_faults.json`).
12. **Ruled: no semantic objection** (BB8 6678599629). Node holds the inventory fixed within an
    epoch, holds `groups.through` from moving back, and requires `discovery` on a frame exactly
    when the cursor has it.
13. **Ruled: accepted only with a fixed budget and an incremental walk** (BB8 6678599629,
    ruling (a)). After preparation, resume may grow with logged membership state, never with
    re-traversal, and its worst case at the contract's own bounds must fit the lease's
    first-commit budget. `alt_seen` got its own cap, derived from that budget, which item 18's
    ruling widens to the four membership logs, `MEMBERSHIP_ENTRIES` (§6.11).
14. **Ruled by (a)** (BB8 6678599629). The walk is incremental (§5.1). A full read, the 175 MiB
    figure at the bounds, happens in exactly three places.

BB8 still re-checks §6.9's acceptance list against the worker half once 3PO publishes it.

### Added for confirmation since 6678599629

Items 15–20 filled gaps that ruling (a) left open, and are ruled by 6681838131. Items 21–24
came with the fold of 6678702125 (`8732918312`), and items 25–29 with this revision's fold of
6681838131 and its review. Items 21–29 are open for BB8, and item 24 for 3PO.

15. **Ruled: no semantic objection** (BB8 6681838131). **Where the walk gets its addresses**
    (§4, §5.1). Statting a segment needs its address,
    and only the segment after it names it (the record names the head). So the store keeps
    each live chain's address list in memory. A list changes only after the record save that
    changes its chain returns, so a commit refused after writing segments leaves no orphan in
    a list (`good/lease_after_refused_commit.json`). A full read rebuilds a list from the
    head by `previous_hash`, and a starting store always reconciles, because it holds
    generation −1. Reconciliation saves no verified head, because usage is unknown until the
    recount. 6681838131 adds that a thrown save is an unknown outcome: the lists are rebuilt from
    the durable record head before use, which in this store is the restart's reconciliation
    (§5.1, `good/thrown_save_outcome_unknown.json`).
16. **Ruled** (BB8 6681838131): confirmed at lease time, amended at reconciliation. **A lease's
    walk never releases** (§5.1, §7.4). It reads only segments this process
    listed itself, and only this image's bookkeeping writes the list and `verified`. So R5
    (now also covering the list), or R2 or F3 on the appended segments, is `STORAGE_CORRUPT`
    on a lease: nothing is released or saved, and `resume()`'s full read, which uses neither,
    decides. Only a full read releases with `chain_broken`. The review proposed instead a full
    read on the lease itself; that would be a fourth place a chain is read in full, against
    ruling (a), so it is not taken unless BB8 prefers it. Also: the walk's save is skipped,
    never forced, when it cannot get capacity. **The ruling:** at lease time a problem in the
    segments this process listed is `STORAGE_CORRUPT`, with no save and no release, and
    `resume()`'s full read decides; no fourth full-read place. At reconciliation, segment bytes
    that do not match their address get a cause of their own, `segment_corrupt`, with its own
    message, logged at error level, and contained to that job: it is released and the store does
    not fail. `chain_broken` stays structural (a link, a count, `first`). Every other object
    keeps `STORAGE_CORRUPT`, failing the whole store (§7.4, §8,
    `bad/segment_corrupt_at_reconciliation.json`). That answers 3PO's (e) (6681823180).
17. **Ruled: no semantic objection** (BB8 6681838131). **The derivation's inputs** (§6.11). The
    factor 3 scales the per-entry load rate only, rounding up the load's measured loaded/light
    ratio of 2.5. Construct and recompute enter
    at their loaded-host measurements, not scaled. The walk's single measured figure is
    scaled by 3 and taken at five full chains. Also, `WITNESS_FIELDS` on the worker is
    `INVARIANT_FAILURE`, for item 5's reason: the field list is the reducer's constant. Item 18's
    ruling then scales every term by 3 (§6.11).
18. **Ruled** (BB8 6681838131). **What the bound leaves out** (§6.11). The ruling: derive the cap
    with every term at the loaded-host factor; `seen`, `variants`, `alt_seen` and `row_seen`
    share one budget, with one combined cap and a named `RESOURCE_LIMIT` cause per log, since
    `seen` alone at `CHAIN_SEGMENTS` would load for about 191 s; `row_seen` in the alternate
    phase is not assumed empty, and a restart mid-row there is tested; finish work (the full
    `alt_cells` load and option 2's read) is outside the first-commit criterion but must fit a
    lease, the proof run measures it, and it stays open; reconciliation inside a lease, after any
    foreign writer, is an accepted exclusion that the proof run records. §3, §6.2 and §6.11 now
    say this, and the cap's value is item 25.
19. **Ruled: no semantic objection** (BB8 6681838131). **The release trace** (§2.7, §8).
    `unavailable.released` is set on every release, not only on a pause, so a paused or
    cancelled job that reconciliation releases keeps its trace. U1: a release of a record
    already released releases nothing, so the first trace
    wins. U2: while `unavailable` is set, every save that writes the reason writes it copied
    from `unavailable`, with no stored message, and a pause never requeues; the view renders
    the message from the cause. The worker's reply gains `error_log`, and the scheduler
    passes `error_cause ?? cause` and `error_log ?? log` on.
20. **Ruled: no semantic objection** (BB8 6681838131, which finds the rule consistent with
    6678856548). **The suffix's parts** (§6.9), which item 11's addition left open. Inside the
    terminal suffix, each terminal record's parts are held to `resolve_detail_records`'s own
    rules: its `$detail_ref`s, the part order, the totals and the bytes. Every terminal record
    but the last is complete; only the last may be partial. Ruling 3 of 6678702125 keeps these
    checks at a resume and at every read.
21. **The `CURSOR_BYTES` derivation** (§3.1), which ruling 2 asked for. The largest cursor the
    constants allow is 142,912 bytes, so 64 KiB is replaced by 160 KiB, with 20,928 bytes of
    room. A refusal's detail, the one part that grows with the input, gets
    `REFUSAL_BYTES = 1024` and cause `cursor_refusal_bytes`. Witness fields are dot paths, so
    their canonical bytes are bounded. The validator fails when the registry passes the
    derivation's inputs. BB8 confirms the derivation and the new bound.
22. **The reply boundary's details** (§8, C1), beyond ruling 4's three cases. An `error_log`
    outside §2.3, and a cause on a code that takes none, are protocol failures the same way.
    Extended in this revision: each cause says whether it takes a log (§8's Log column), so a
    log missing where its cause needs one, or present where it takes none, fails too; and a
    worker naming `segment_corrupt`, the store's own cause, fails. The echo is cut to 64 bytes at
    a character boundary, and a value that is not a string is echoed as its JSON text. After a
    release, U2 keeps the copied reason and the bad value is logged. The worker's
    resident-capacity guard names a new `RESOURCE_LIMIT` cause, `resident_capacity`, so its reply
    is not a protocol failure. BB8 confirms or strikes each.
23. **No reset after a seal of the same log** (§2.6, §6.2). A frame applies its resets first,
    so a step that has already sealed `row_seen` ends before a row boundary that resets it,
    whether a plain reset or a compaction. This follows from ruling 1 and W3, and it moves only
    where steps end. BB8 confirms.
24. **Where the nine cases sit** (§6.9), for 3PO. This contract places the three
    membership-only faults at three split points of a four-part terminal detail: a part of
    another method at the junction, read later; and a parent of another method and an inserted
    contribution, read at the resume. Membership is `method_id` alone, so a part whose
    `schema_name` alone changes is accepted. 3PO confirms they match the nine his resolver run
    accepted, or names the difference.
25. **The combined cap's value** (§6.11). Ruling 18 names 16,384, which was the previous
    revision's cap for `alt_seen` alone, with `seen` and `variants` as fixed terms at #656's size.
    Under one combined cap they are part of the capped sum, and #656's own `seen` and `variants`
    hold 20,045 entries, so 16,384 would refuse #656 in its primary phase with `discovery_seen`.
    The same derivation, every term at the loaded-host factor, over the combined sum, gives
    43,826 entries with the margin, so `MEMBERSHIP_ENTRIES = 32768`: 27.99 s at the cap, 2.01 s
    under the budget, and #656 uses 20,045 of it. BB8 confirms 32,768, or names another figure.
26. **`resume()`'s full read on a byte mismatch** (§5.1). The ruling names reconciliation. At
    this head `_object` turns F6 into `STORAGE_CORRUPT`, so a job whose segment is damaged
    would stay paused at `STORAGE_CORRUPT` on every resume. This contract gives `resume()`'s
    full read the same cause, `segment_corrupt`, releasing the job. BB8 confirms.
27. **The refusal's regression** (§3.1, from the review of `8732918312`). `REFUSAL_BYTES` and
    `cursor_refusal_bytes` follow ruling 2, but a declared source label of about 270 bytes or
    more now stops a job that completes today with that method refused. BB8 keeps that, or picks
    one of the two ways out §3.1 names: bound labels at validation, or keep the detail out of the
    cursor.
28. **The new causes and how the worker names them** (§3, §8, from the same review). The meter's
    two budgets get `declared_coordinate_bits` and `expansion_budget`, so every `RESOURCE_LIMIT`
    raise the reader reaches names a cause; the four membership causes and `segment_corrupt` get
    messages; a refusal names its cause in its message head, `CODE[cause]:` or
    `CODE[cause,log]:`; the bridge marks a worker's reply `reply: true`, and the scheduler keeps a
    sink's own error, so C1 checks replies only; and C1 is switched on with the worker half. BB8
    confirms the causes, their messages and the sequencing.
29. **Finish work must fit a lease** (§6.11, ruling 18). It stays open: the full `alt_cells`
    load, option 2's read of about 63 MB, and `_domain`'s enumeration, up to `DOMAIN_CAP` pairs,
    are not timed. The proof run measures the finish lease against the lease; if it does not
    fit, it needs checkpointable progress or option 2's domain-log fallback.

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
  saves nothing, and a full read from the heads reads all three and rebuilds the list.
- `good/lease_after_refused_commit.json`: the second frame's record after a refused third
  commit left its segment an orphan. The list was not extended, so a lease reads and saves
  nothing and its payload leaves the orphan out.
- `good/row_seen_compaction_next_frame.json`: a frame that already carries seven seals reaches a
  compaction boundary whose two seals would pass `FRAME_SEALS`, so the step ends before it and
  the compaction runs first, whole, in the next frame. A restart at the boundary seals the same
  bytes; a split the store would accept is one the worker must never emit.
  `good/row_seen_compaction_next_frame.json` is store-only: its entries are integers and its
  positions labels, so no traversal produced it, and the worker's half of ruling 1 is §6.2's
  third test.
- `good/release_fencing.json`: reconciliation on one instance while another holds a live lease.
  The lease's next commit is refused and writes nothing, its fence is unchanged, its pause
  carries the sink refusal's own cause and log, and a queued job keeps its attempt counter and
  its queue fields.
- `good/thrown_save_outcome_unknown.json`: a commit's record save throws. With a status it came
  before the write, so only orphans changed; without one the outcome is unknown, the instance
  serves nothing, and the restart's full read rebuilds every list from the durable heads,
  whether the save landed or not.
- `good/unavailable_pause_reason.json`: every path that releases, and the saves that follow a
  release: a `DISCOVERY_UNAVAILABLE` pause the worker raises, reconciliation's release of a
  queued, running or paused job, then a refusal, a yield, a lease expiry or a cancel. Each
  release is one save that empties `logs` and `verified`; `unavailable` and the reason keep
  the released log names and their heads, the first release's trace wins, and a released job
  is never requeued (U1, U2).

Bad:

- write (`READER_PROTOCOL` 400): `bad/changed_digest_after.json` (F5),
  `bad/float_entry.json` (F1, which Node meets as F5), `bad/over_bound_seal.json` (F4),
  `bad/premature_seal.json` (F4), `bad/epoch_backwards.json` (W2),
  `bad/reset_unheld_log.json` (W3), `bad/cursor_record_disagreement.json` (W4),
  `bad/cursor_over_bound.json` (W4, built from §3.1's inputs: the worker refuses first, with
  `INVARIANT_FAILURE` past `CURSOR_BYTES`, or `RESOURCE_LIMIT` for a refusal past
  `REFUSAL_BYTES`), `bad/tail_rewritten.json` (W6);
- reply (`READER_PROTOCOL`, no status): `bad/reply_cause_invalid.json` (C1), with sink errors
  and a bridge failure among its controls;
- limit: `bad/membership_over_cap.json` (W7). For each membership log, the worker refuses first,
  as `RESOURCE_LIMIT` with cause `discovery_<log>`; a store sent the frame refuses it
  `READER_PROTOCOL` 400. A control per log reaches the cap exactly and is accepted;
- full read (`DISCOVERY_UNAVAILABLE` 409): `bad/segment_corrupt_at_reconciliation.json` (F6,
  cause `segment_corrupt`), with a lease's `STORAGE_CORRUPT` on the same store and a structural
  control that is `chain_broken`;
- resume (`DISCOVERY_UNAVAILABLE` 409): `bad/missing_segment.json` (R1),
  `bad/reordered_segment.json` (R2), `bad/cursor_summary_disagreement.json` (R3),
  `bad/inventory_mismatch.json` (R4);
- walk (`STORAGE_CORRUPT` 503): `bad/verified_ahead_of_head.json` (R5), refused before
  anything is read, releasing nothing; its `resume()` full read passes and saves the
  corrected verified heads;
- traversal: `bad/retired_key_recurring.json` (S1, `DISCOVERY_UNAVAILABLE` 409),
  `bad/witness_mismatch.json`, `bad/terminal_suffix_not_contiguous.json` and
  `bad/terminal_suffix_resume_faults.json` (S2, `RESULT_EXPIRED` 410).

**How the #721 author consumes them.** The worker's encoder, fed each good fixture's state,
produces exactly its seals, tails, cursor fields and digests, byte for byte. Its load,
traversal and reconstruction accept each good fixture and refuse each bad one with the same
rule, code, status and cause. For `bad/float_entry.json` the worker refuses by F1, where
Node can only refuse by F5. `bad/membership_over_cap.json`'s mutants are frames the worker must
refuse to emit, each naming the cause of the log whose append passes the cap, and so are
`bad/cursor_over_bound.json`'s mutants, each with the code it names.
`bad/terminal_suffix_resume_faults.json`'s nine `accepts` cases are required worker refusals:
`resolve_detail_records` accepts each, and the worker's suffix-membership check, run before
resolving, must refuse it; its five controls must be accepted. `bad/reply_cause_invalid.json`'s
`reply` cases are what the worker's reply must look like after `worker.py` reads its message
head (§8). `good/row_seen_compaction_next_frame.json`'s `worker_must_not_emit` frames are ones a
store accepts and the worker never emits. The walk, full-read, thrown-save, pause, fencing and
reply fixtures, and the compaction fixture, are the store's and the scheduler's (R2's side).

The validator rebuilds every segment from the seals, recomputes every digest and address,
and checks this document's constants, causes and cross-reference rows. It also runs Python
over the same bytes: `canonical_json` and `json.dumps` against Node's bytes, the segment
addresses, `resolve_detail_records` and the witness over the filtered stream, the terminal
suffix's mutants and controls (resolving the suffix itself with `resolve_detail_records`), and
the float fixture. It recomputes the §6.11 derivation and what it leaves out from §10's
figures and §3's constants, and it holds §7.4's release property over every combination of
logs. It builds the largest cursor from §3.1's inputs and checks those inputs against the
registry and the source. It walks the reader's imports for every `RESOURCE_LIMIT` raise and
holds each to §8's list. It models C1, the sink errors it never checks, the fencing of a
release, a byte mismatch at a full read and a thrown save, and it rebuilds each resume case from
its split point's durable prefix. Each R5
clause, the junction and the full read's refusals are checked one at a time. Where one
failure leaves a later check undefined (a log whose seal fails F5 has no digest for W4 to
compare), it skips that check. It runs in `npm run test:library`:

```sh
node --test mcp/test_discovery_v1_fixtures.mjs
```

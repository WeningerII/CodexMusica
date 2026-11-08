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
combined cap bounds the four membership logs' entries (§3, §6.11; 6688972927 adds a second cap,
on their bytes), `row_seen` is not assumed empty in the
alternate phase (§6.2), finish work and reconciliation are named exclusions (§6.11), and a thrown
save is an unknown outcome (§4, §5.1). It answers 3PO's review of `2e8ae0239` (6681823180), and
fixes an adversarial review of `8732918312`: the reply plumbing C1 needs (§8), the other
`RESOURCE_LIMIT` raisers (§8), and the precision of §6.9's nine cases. It folds BB8's
correction of the budget (6682942783, option (b)): only the per-entry load rate is scaled, and
the combined cap is 65,536 entries (§3, §6.11, §12 item 25). It folds BB8's rulings on items
21–29 (6683944548) and BB8's revision of item 27 (6684866461), on 3PO's reachability correction
(6684847656): the refusal stays in the cursor, `REFUSAL_BYTES` is derived from how the adapter
builds a refusal and passing it is `INVARIANT_FAILURE` (§3.2), `CURSOR_BYTES` is derived again
from that refusal (§3.1), C1 is switched on in the worker half's runtime train (§8), and BB8's
correction of where the `row_seen` figure comes from is carried through (§6.11, §10). It fixes a
review of `2a610d053` and reconciles 3PO's guard derivation (6684968306): `REFUSAL_BYTES` stays
543 as a conservative bound, the largest construction in the adapter's call closure, which its
dispatch never builds; the largest refusal the dispatch can build is 336 bytes (§3.2).
`CURSOR_BYTES` says what it measures and states its allowance, and the whole cursor's bound is
that plus `discovery`'s, `continuation`'s and their keys (§3, §3.1). W4 also holds the cursor's
numbers and `discovery`'s keys (§4), and R2 turns C1 on in the worker half's train (§8). It
folds BB8's completeness ruling (6688972927): an `INVARIANT_FAILURE` message names the bound it
passed (§3, §8); the cap's derivation is 90,975 entries with the margin, rounded down to 65,536
(§6.11); `MEMBERSHIP_BYTES` caps the membership logs' entry bytes from a per-byte load rate
measured at 4,096-byte entries, and the first-commit claim is scoped to the load and the walk
(§3, §6.11, §10); an oversized `row_seen` compaction defers (§3, §6.2); and a full read is the
store's alone, while the worker's finish-time `alt_cells` load is a complete verified load
(§1, §5.1, §5.2, §8). A review of `465582a78` then measured the per-byte rate over nested
shapes, which halved `MEMBERSHIP_BYTES` to 2 MiB (restored to 4 MiB under `ENTRY_DEPTH`, below),
made the single-pass membership key a requirement, and scoped the two-rate sum to a derivation
(§2.1, §5.2, §6.11, §9, §10). It folds BB8's proposal for the #721 handoff's items 2 and 3,
which R2 accepted, BB8's review of the #721 entry codec
(should-fix 1), and BB8's emit-precedence ruling: the codec raises a tagged local error and the
enclosing operation maps it; a worker's F1 is `INVARIANT_FAILURE`; persisted content is F3, and
the store decodes it strictly; precedence is pinned F1 before F2 on the worker's emit and
unpinned elsewhere; F2 is measured on the canonical form; integer-only fields get their own tag;
and a lone surrogate is refused where caller text is admitted (§2.5, §2.11, §3, §4, §5, §8, §9,
§12, §13). It folds BB8's two rulings of 6693502369 and the nits of his review 6693638249: each
log's state carries a verified `bytes` member, so W7 holds `MEMBERSHIP_BYTES` and R2, R5 and R3
check the member where it is read (§2.7, §2.10, §3, §4, §5); F1 bounds an entry's nesting depth
by `ENTRY_DEPTH`, provisional until the #721 author declares the entry shapes, and
`MEMBERSHIP_BYTES` is re-derived over the 17 shapes capped at it, provisional with it (§2.1, §2.11,
§3, §6.11, §8, §9, §10, §12, §13). It folds BB8's confirmations of 21:31Z: segment bytes that are
not UTF-8 are F3 in both languages, decoded in Node by a fatal `TextDecoder`, never
`Buffer.toString`; and admission's lone-surrogate refusal has a guard test on both create paths
and a stored-request case at `workerPayload` (§2.11, §9, §13). A review of `04495c233`
corrected that case: the store leases the record before the check, and the check keeps it from
the bridge lease (§2.11). BB8's review of `a12c35b4d` (6699352254) accepts `MEMBERSHIP_BYTES` at
4 MiB, provisional with `ENTRY_DEPTH`, on two conditions (§6.11, §12, item 31), keeps the
stored-request check where §2.11 has it, not in the store's lease (§2.11), and counts the 17
named shapes as 13 distinct loads at this cap (§10). Where this text and the proposal differ,
this text governs. 3PO's acknowledgement (6677006069) fixes the `contracts.py` reservation to the
checkpoint declaration and schema; the shared `CONTRACT_VERSION` does not change.

**Base.** a0 (draft PR #816, head `aabf6eeb0`): checkpoint objects carry no cursor, and the
job record holds the one cursor that resume reads. Every code citation in this contract is
`file:symbol`, never a line number: a function, method, constant or class (`Class.method` for a
method or attribute of a class, `outer.inner` for a function inside another, `file:module` for a
file's top-level statements), and a bare `:symbol` takes the file of the nearest file-qualified
citation in its bullet, table row or paragraph. `mcp/test_discovery_v1_fixtures.mjs` holds each
cited range as an anchor inside its symbol, so a line shift never changes the text, and a
statement about the code's state there names Base. It holds §2.11's ranges and §2.1's depth basis
as anchors of their own, and every other citation (§2.1's other bullets, §2.3, §3 and the later
sections) as one row per cited range, made from the line references at Base (`CONTRACT_CITES`).
It also holds the code of each cited range to a digest: blank lines, comments and docstrings
aside, code beside a comment still code, and a Python line's indentation kept relative to the
range's first. A docstring is only a bare string that opens a def or class body; an f-string, or a
string inside brackets, is code. Each range is whole statements: it opens a statement (a row whose
anchor line is inside one names the line it opens with), runs on through every statement it
starts, a compound one with its body, and a Python definition starts at its first decorator; the
language's own parser checks each. So any change to that code fails until the claim it backs is
read again and the digest pinned again, and a citation of a line number, or of a symbol no row
pins, fails too. A `file:symbol` citation names the symbol; its rows name the statements the
claim rests on. Each row names the sections it backs, each citation of a row's symbol in a section
has a row there, and the rows' ranges, digests aside, are held to the digest `5d681f36afb808d3` in this
note, so a row deleted, narrowed or moved changes this text. Two citations name a comment or a
docstring, not code (`reader_scheduler.js:createCatalogResolver`'s note on engine commits and
`analysis.py:resolve_detail_records`' docstring); those rows hold the text as written. Every
statement in §2.1's depth symbols that builds or reshapes a cell, a span key or a key is a pinned
anchor, and each depth symbol's code is held to a digest whole. Every call in one, read by
Python's own parser, is to a depth symbol, to a builtin on a short list, or to a helper or callee
listed with the reason it builds no entry; a callee computed or read by name fails. `analysis.py`, `worker.py` and `reader_scheduler.js` are unchanged there from
main `21e013507`.

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
- **Depth.** The count of nested arrays in an entry: a scalar is 0, `["a"]` is 1 and `[["a"]]`
  is 2. F1 holds it to `ENTRY_DEPTH` (§2.1).
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
- **Full read.** A walk by the store that starts at the record's head, follows `previous_hash`
  back to the chain's first segment and checks every segment. It uses neither the verified head
  nor the address list. Only the store makes one, in reconciliation and in `resume()`, and only a
  full read releases with `segment_corrupt` (§5.1; BB8 6688972927, amending 6678599629).
- **Complete verified load.** The worker's finish-time load of `alt_cells` (§5.2). It reads every
  segment by its path, checks each `previous_hash` link back from the record's head, and checks
  the count and digest against `record.discovery`. It is not a full read: on F6 it raises
  `STORAGE_CORRUPT` and releases nothing, like a lease-time load, and `resume()`'s full read then
  decides (BB8 6688972927).
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
  on every lease. Two caps bound them together: `MEMBERSHIP_ENTRIES` their entries and
  `MEMBERSHIP_BYTES` their entry bytes (§3, §6.11).
- **Reply.** The bridge's result for the worker's own final frame, marked `reply: true` (§8). An
  error a Node sink throws inside the lease, and a bridge failure with no worker reply, are not
  replies.

## 2. Format

### 2.1 Entries (rules F1, F2)

- **F1, the subset.** An entry is built only from arrays, strings, booleans, `null` and
  integers n with |n| ≤ 2⁵³ − 1, and its depth is at most `ENTRY_DEPTH`. Objects and
  non-integers are not entries. Strings are well-formed Unicode with no lone surrogate (Node
  `String.prototype.isWellFormed`; in Python, strict UTF-8 encoding succeeds).
- **The depth bound** (BB8 6693502369, item 31). `ENTRY_DEPTH` is derived from the #721 author's
  declared entry shapes: the smallest power of two at least twice the largest depth they declare,
  and at least 8. It is never above 64, well under any recursion limit, so `canonical_json`
  completes on every entry. Nothing in v1 needs deep entries: §2.3's logs hold fixed-shape keys and
  descriptors that `analysis.py` declares, and caller text cannot deepen them. **Required** (§9):
  the #721 author declares each log's entry shape and its largest depth. That declaration does not
  exist yet, so `ENTRY_DEPTH = 8` is provisional, and open for BB8 (§12, item 31). Its basis is the
  deepest shape the source builds at this head: a `seen` or `alt_seen` key is a pair of span keys
  (`analysis.py:_candidates`, `:_new_pairs`), each span key the locus, a string (`:_origin`), the
  direction and the cells (`:_span_key`), and each cell a line and a token, with its syllable
  outside a disputed word (`:_cell`), so depth 4; an `alt_cells` entry is a pair of cells, at the
  pair build and at the shared-sound build (`:_prepare_event`), the latter a pair of the stream's
  words (`:_sound_candidates`), each a word with a span (`:_sound_spans`) or a varying word with
  none (`:_sound_unspanned`), depth 2. `variants`' descriptor and `row_seen`'s keys are
  not built yet. Twice 4 is 8, which is also the floor. If the declared largest depth is 5 or more,
  `ENTRY_DEPTH` becomes 16 or more, and `MEMBERSHIP_BYTES` is derived again with it (§6.11). So
  `MEMBERSHIP_BYTES = 4194304`, derived at `ENTRY_DEPTH = 8`, is provisional with it, until the #721
  author (3PO) declares the entry shapes (§3, §9, §12, item 31).
- **Canonical form.** `canonical(entry)` is the UTF-8 encoding of the entry serialised with
  no whitespace:
  - Node: `JSON.stringify(entry)`. For this subset it is identical to `canonical()` in
    `reader_job_store.js:canonical`, because the subset has no objects.
  - Python: `json.dumps(entry, ensure_ascii=False, separators=(",", ":"), allow_nan=False)`.
    For this subset its output is identical to `canonical_json`'s (`contracts.py:canonical_json`).
    `json_safe` recurses once per level, and F1's depth bound keeps every entry far under
    Python's recursion limit, so both complete on every entry (BB8 6693502369).
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
  array is not the tuple the worker held. A Python implementation **must** key its sets by
  each entry's canonical form as the Python line above writes it, computed once per entry and
  shared with F5's digest (§5.2). Those bytes equal `canonical_json(entry)`'s, so `["9:2", 1]`
  and `["9:2", true]` stay two members (`good/within_line_inside_group.json`).
  It **must not** compute a key by calling `canonical_json` on an entry: that call first walks
  the entry value by value in Python (`json_safe`, `contracts.py:canonical_json`), which costs five to
  nine times the load's per-byte rate (measured, §10), and `MEMBERSHIP_BYTES` is derived from the
  single pass (§6.11). That rule is about the rate, not recursion, so the depth bound leaves it
  as it was (BB8 6693502369). The validator checks the byte equality on every vector and fixture
  entry through Python itself, and on every §10 load shape, each capped at `ENTRY_DEPTH`.

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
| `seen` | primary-phase pairs that touch a disputed word (`analysis.py:_candidates`) | ordered set log: each key at its first insertion only | no |
| `row_seen` | the row dedup keys that can still recur in the `_candidate_pairs` enumeration under way: the current row's, and those of earlier rows whose left span has occurrences left (`lyric-harness/quality/relations.py:_candidate_pairs`); in the lower traversal, and within each alternate-phase call (§6.2) | ordered set log, first insertion | yes |
| `variants` | preparation output, one descriptor per variant span: the line, each pinned token's full reading choice (all of `c`, not only `c[2]`), the span key, the frame key and both bucket keys | list, in preparation order | no |
| `alt_cells` | judged alternate cells, one per yielded alternate pair, false verdicts included (`analysis.py:_prepare_event`), appended when the event's delta is applied (§6.3). In a shared-sound epoch: its in-domain judged cells (`:_prepare_event`), never an outside-domain binding | list with multiplicity | no |
| `alt_seen` | alternate keys within one line, and keys spilled from the current group past its bound (§6.4) | ordered set log, first insertion | no |

`seen`, `variants`, `row_seen` and `alt_seen` are the membership logs (§1): together they hold at
most `MEMBERSHIP_ENTRIES` entries and `MEMBERSHIP_BYTES` entry bytes, sealed and tail (§3).

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
  `pages/<sha256>.json` through `_blob('pages', …)` (`reader_job_store.js:_blob`). With
  `READER_STORE_GZIP=1` it may be stored gzipped by the existing pages rule (`:_blob`).
  It is never in an index chain, so `readPage` refuses it by membership (`:readPage`).
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
  - **F3 holds the content too** (BB8, #721 item 2 (c)): every entry passes F1 and F2, and
    every integer field is an integer. So a segment whose bytes match its address (F6 passed)
    but do not parse (invalid UTF-8 included, which the store decodes strictly, §2.11), hold an
    entry that fails F1 or F2, or hold a `first`, `count` or `epoch` that is not an integer
    fails F3: bad content, not corruption. F3's mapping does not change:
    on a lease's walk `STORAGE_CORRUPT` with nothing released (§5.1), at a full read
    (reconciliation, `resume()`) `DISCOVERY_UNAVAILABLE`, cause `chain_broken` (§5.1), and at
    the worker's load `chain_broken` (§5.2). `segment_corrupt` stays F6's alone, and the
    store's alone; a failed gzip inflation stays F6 (§2.11).
- **F6, the address.** The address is the sha256 of exactly those plain bytes. In Node
  that is `JSON.stringify` of an object built in this field order. In Python it is
  `json.dumps` of a dict in this order with `ensure_ascii=False` and
  `separators=(",", ":")`, and **without** `sort_keys`. It is not `canonical()` of the
  segment, which would sort the keys. With gzip, the address still covers the plain bytes.
  **A segment file larger than `READER_LIMITS.objectBytes` (2 MiB) fails F6 without being read**
  (BB8 6700200435, condition 7, on R2's question 7): the store stats every segment before it
  reads it, and a stored size over the bound is F6, exactly like bytes that do not match the
  address. A gzip-stored segment within the bound whose inflation passes it is F6 by the bounded
  inflation, as before. A file replaced by a larger one between that stat and the read (only a
  foreign writer or damage can do it: a segment is written once) meets `_readFile`'s own size
  refusal, and anything at the address that is not a regular file (a directory) is refused by
  the stat or by the read; both are F6 of that one segment, never a store-wide
  `STORAGE_CORRUPT` (BB8 6707363590, condition 7).

### 2.6 Epochs and resets

- **The epoch is `cursor.method_index`** of the cursor committed with the frame. It never
  decreases over a job's commits (W2).
- **An epoch advance releases every log.** When a frame's epoch is greater than the
  record's, the record keeps none of the old epoch's chains, every seal in the frame
  belongs to the new epoch, and the frame lists no reset. The epoch may jump by more than
  one, because one step can finish a method, pass an empty or refused one and start a third
  (`analysis.py:step`). A method's logs serve only its own traversal: `seen` is
  created fresh in each `_candidates` call (`:_candidates`), and `_advance` already drops the
  terminal inputs (`:_advance`).
- **A reset restarts one resettable log inside an epoch.** Only `row_seen` is resettable.
  Resets are listed in `frame.discovery.resets`. They are applied before the frame's
  seals, and the log restarts empty (head `null`, count 0, bytes 0, digest `d₀`). Its old chain is
  released. A reset of a log the record does not hold is refused (W3).
- **No reset after a seal of the same log.** Because a frame's resets are applied before its
  seals, a frame cannot seal a log and then reset it: the seal from before the reset would fail
  W3. So a step that has already sealed `row_seen` ends at the safe point before a row boundary
  that resets it, and the reset opens the next frame (§6.2).

### 2.7 `record.discovery` (rule M1)

It is owned by Node and covered by `record_digest` (`reader_job_store.js:_save`).

```
null
| {"version":1,"epoch":<int>,
   "logs":{"<log>":<state>},
   "verified":{"<log>":<state>},
   "unavailable":null | {"cause":<cause>,"log":"<log>" | null,
                         "released":{"<log>":<sha256 | null>}}}

<state> = {"head":<sha256 | null>,"segments":<int>,"count":<int>,"bytes":<int>,"digest":<hex>}
<cause> = "segment_missing" | "segment_corrupt" | "chain_broken" | "digest_mismatch"
        | "cursor_disagrees" | "inventory_mismatch" | "retired_key_recurred"
```

- `null` means the job holds no discovery state: its frames carry none, it has completed,
  or it is a tombstone. A record with no `discovery` key holds none either.
- **M1, a malformed `record.discovery`** (BB8 6709891376, ruling 3). A `record.discovery` that is
  present, not `null`, and not of §2.7's shape is malformed: released `chain_broken`, log `null`,
  never dispatched and never a GC root (§7.4). It is not of the shape when its keys or their types
  differ, or when `verified` does not name exactly the logs `logs` names (below; #656 Step 6
  review, D1, which BB8 ruled is this rule's reading of §2.7, 6709891376, ruling 1). Only a writer
  other than the store can produce one. `bad/malformed_record_discovery.json` pins M1.
- `logs` names every log of the current epoch that any committed cursor of that epoch has
  named, including logs that have only a tail (head `null`, segments 0, count 0, bytes 0, digest
  `d₀`).
- **`bytes`** (BB8 6693502369, item 30) is the sum of `|canonical(e)|` over the state's sealed
  entries, separators not counted, so 0 for the empty state. A commit adds each seal's entry
  bytes (§4), the bytes F2, F4 and F5 already compute, and W7 holds the membership logs to
  `MEMBERSHIP_BYTES` with it. It is verified wherever it is read: R2 at a full read and R5 at a
  lease's walk (§5.1), and R3 at the worker's load (§5.2). An unverified count would be worse
  than none. `record.discovery` has not shipped, so the member costs no format break now.
- **`verified`** names exactly the logs `logs` names (BB8 (a), 6678599629). Each is the state of a
  prefix of that log's chain: the segments the store has read back and checked (§5.1). It is never
  ahead of the head. Its `segments`, `count` and `bytes` are at most the head's; it is the empty
  state (head `null`, segments 0, count 0, bytes 0, digest `d₀`) when its `segments` is 0, and the
  head's own state when its `segments` equals the head's. A commit never moves it (§4); only the
  walk does (§5.1).
- The heads are the only GC roots (§7.2). A verified head needs none: it is on its chain, at
  or behind the head.
- `unavailable` is set in the same save that empties `logs` and `verified` (a release, §7.2;
  rule U1, §8), by any of:
  - reconciliation (§7.4), with cause `segment_missing`, `segment_corrupt` for a segment whose
    bytes do not match its address (F6), or `chain_broken` for a structural failure of its full
    read (F3, R2) or a malformed `record.discovery` (M1), whose log is `null`;
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
`incomplete`, and `refused_schemas` once a schema has refused (`analysis.py:_prepare_event`). The
changes:

- **`contract_version: 2`.** This is the cursor version. It is separate from
  `CONTRACT_VERSION` (1) in the identity (`contracts.py:CONTRACT_VERSION`, `:semantic_identity`), which does not move.
- **`incomplete`** (`{name: reason}`) is also written at the moment either preparation flag
  is set (§6.6).
- **`methods[*]` holds none of the terminal inputs** `domain_true`, `domain_undecided` and
  `alt_cells` (`_TERMINAL_INPUTS`, `analysis.py:AnalysisSession._TERMINAL_INPUTS`). Today they accumulate in
  `methods[mid]` with every event's delta (`:step`) until `_advance` pops them
  (`:_advance`), so nothing bounds them. In v2, `alt_cells` is a log (§2.3) and the domain
  tallies are rebuilt under option 2 (§6.9). What stays in the cursor outside `discovery`
  and `continuation`, `witness` included, is at most `CURSOR_BYTES`, a bound derived from the
  engine's constants (§3.1): the canonical bytes of the cursor object with those two members
  removed. Each method's `refusal` is at most `REFUSAL_BYTES`, a bound derived from how the
  adapter builds a refusal (§3.2). Every number in the cursor outside its entries and
  `continuation` is an integer from 0 to 2⁵³ − 1: each is a count, an index or an epoch. Node
  checks these rules under W4.
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
  (§6.9), with exactly those six keys. It is `null` only on a method that option 2 does not qualify; a qualified method
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

The worker's `step()` adds it to the step (`analysis.py:step`). The scheduler passes it
as `discovery` in the `commitCheckpoint` payload (`reader_scheduler.js:pump`).

```
{"epoch":<int>,"resets":[<log>…],
 "seals":[{"log":<log>,"first":<int>,"entries":[<entry>…],
           "digest_before":<hex>,"digest_after":<hex>}…]}
```

A frame carries `discovery` exactly when its cursor carries `discovery`; one without the
other is refused (W1). A `frame.discovery` of `null` is not the frame's shape and is refused
(W1), and a `cursor.discovery` of `null` with a frame that carries `discovery` is not the cursor's
shape and is refused (W4, §2.8): neither is read as absent (#656 Step 8). A frame and cursor with neither leave the store as it is today,
which is how the store half stays inert until the worker half ships. A frame with neither
whose record holds discovery is refused (W4).

### 2.10 Lease payload `discovery`

`workerPayload` (`reader_job_store.js:workerPayload`) adds it, and the scheduler passes it to the
worker beside `checkpoint` (`reader_scheduler.js:pump`).

```
null
| {"version":1,
   "summary":{"epoch":<int>,"logs":{"<log>":{"head","segments","count","bytes","digest"}}},
   "paths":{"<log>":["<store>/pages/<sha256>.json", …]}}
```

- `summary.logs` equals `record.discovery.logs`. `verified` is the store's own and is not
  sent.
- Every log in the summary has a `paths` entry holding exactly `segments` absolute paths,
  **oldest first**.
- `workerPayload` builds it under the writer lock, after the walk (§5.1), from the store's
  address list. The payload is the record without its `discovery`, whose `verified` and
  `unavailable` are the store's own, with this value in its place (#656 Step 10, c14). A
  record with no `discovery` key gains none, so a lease of a job holding no discovery is byte
  for byte what it was, and the scheduler passes `discovery` to the worker only when it is
  not `null`.
- A record whose `discovery.unavailable` is set never reaches a lease payload:
  `_dispatchable` does not offer it, and `workerPayload` refuses it (§2.7).

### 2.11 Codec errors and where they are mapped (BB8, #721 items 2–3)

This is BB8's proposal for the #721 handoff's items 2 and 3, which R2 accepted, with BB8's review
of the #721 entry codec (should-fix 1) and BB8's ruling on the worker's emit precedence (his
19:40Z DM of 2026-11-06). `good/codec_error_mapping.json` pins each byte and mapping claim below,
and the validator checks it in Node and in Python and builds this section's text from it (§13).

- **The principle.** The codec raises a local error with a rule tag; the enclosing operation maps
  it; the codec never chooses a public code. The codec is whatever decodes, checks or encodes
  entries: the #721 author's entry codec in the worker, and the store's entry checks (§4). Its
  tags:
  - `F1`: a value inside an entry that is outside §2.1's subset: a float (`1.0` included), a
    nonfinite number, an object, an integer past ±(2⁵³ − 1), a lone surrogate, a cyclic array, an
    array past `ENTRY_DEPTH` or a value of another type;
  - `F2`: an entry whose canonical form is longer than `ENTRY_BYTES`;
  - `JSON`: input that is not one JSON value: invalid UTF-8, a truncated value or trailing
    content;
  - `INTEGER_FIELD`: an integer-only field outside the entries that is not an integer in its
    range: a frame's `epoch`, a seal's `first`, a cursor number, or a segment's `epoch`, `first`
    or `count`. `F1` stays for integers inside entries, on the decode and the encode paths alike
    (BB8's review; required of the codec, §9).
- **(a) The store, on a submitted frame** (§4 step 3). `F1` or `F2` on any entry in the seals, the
  cursor tails or the group keys is `READER_PROTOCOL` (400), and nothing is written. `INTEGER_FIELD`
  is the same code under the frame's own rule, not F1: W1 for `epoch` and a seal's `first`, W4 for a
  cursor number. Same code, different tag. A frame whose `discovery` is not JSON never reaches the
  store, because the frame is one JSON line: it is the step channel's existing failure for a
  malformed step, and there is no new code. The bridge parses each line
  (`python_bridge.js:spawnWorker`) inside the try whose catch kills the worker, a bridge failure
  with no reply that pauses as it does at Base (§8), and refuses a reader line past
  `READER_FRAME_CAP` (`:READER_FRAME_CAP`) as `READER_PROTOCOL`.
- **(b) The worker, on an entry it generated, before it emits.** `F2` is `RESOURCE_LIMIT`, cause
  `discovery_entry_bytes`, naming the log (§3, §8). `F1` (a float, a lone surrogate, an object, an
  integer out of range, a depth past `ENTRY_DEPTH`) is `INVARIANT_FAILURE`, an engine defect, with a
  message that names the rule, like the other `INVARIANT_FAILURE` messages (§3, §8). The worker
  never truncates or skips the entry. It refuses before it builds the frame. Without that refusal a
  lone surrogate would fail later, still before the write: `worker.py` builds each frame with
  `ensure_ascii=False` (`worker.py:run_reader`), and the size check's strict encode raises
  `UnicodeEncodeError` before the frame is printed, so the lease would end as `READER_ERROR`
  (`:main`).
- **(c) A persisted segment that passed F6.** Bytes that do not parse, an entry failing F1 or F2,
  and a `first`, `count` or `epoch` that is not an integer are F3, not corruption (§2.5). The
  mapping is F3's, unchanged: a lease's walk refuses `STORAGE_CORRUPT` (503) and releases
  nothing (§5.1); a full read (reconciliation, `resume()`) releases with `DISCOVERY_UNAVAILABLE`,
  cause `chain_broken` (§5.1); the worker's load refuses with `chain_broken` (§5.2).
  `segment_corrupt` stays F6's alone, and the store's alone, and a failed gzip inflation and a
  stored size over `READER_LIMITS.objectBytes` stay F6 (§2.5).
- **Invalid UTF-8 in a segment, in both languages** (BB8, 21:31Z). The worker's load decodes
  strictly (`worker.py:read_page_object`), so bytes that are not UTF-8 are `JSON`, and F3. At Base
  the store parses the verified bytes with `JSON.parse` on the buffer
  (`reader_job_store.js:_object`), which decodes invalid UTF-8 as U+FFFD instead of refusing it, so
  the same bytes would pass or meet F5. **Required** (R2's, in the store half): the store decodes a
  segment's verified bytes with a fatal UTF-8 decoder (`new TextDecoder('utf-8', { fatal: true })`)
  before it parses them, never with `Buffer.toString` or `JSON.parse` on the buffer, which replace
  bytes that are not UTF-8, and a failure is F3, so both languages refuse the same bytes for the
  same rule: a full read releases with `chain_broken`, a lease's walk refuses `STORAGE_CORRUPT`, and
  the worker's load refuses with `chain_broken`. A failed gzip inflation comes before the decode and
  stays F6. Only a writer other than the store can produce such bytes. `persisted_bytes` in
  `good/codec_error_mapping.json` pins it: Python's load and the required store are F3 (`JSON`), and
  a non-fatal decode, as the store's is at Base, passes the bytes. Its `read_back` is an
  address-valid segment holding a string with a lone 0xFF byte. **Required test** (R2's store
  tests): a full read and a lease's walk of that segment each refuse it as F3, and the same test run
  against a replacing decode fails, because that decode passes the content and meets F5 instead, so
  the test shows the store does not use one.
- **The integral float `1.0`, across languages.** Take a persisted segment whose digests a
  Python writer computed over the bytes `1.0`. Python's load meets a float: F1, so F3, cause
  `chain_broken`. Node parses it as the integer 1, so the entry passes F1 and its recomputed
  digest does not match: F5, cause `digest_mismatch`. The divergence is accepted: both refuse,
  with different causes. Each side pins its own cause in `good/codec_error_mapping.json`:
  `cross_language.python` for the worker's codec, `cross_language.node` for a Node reader and
  this validator's model of the load. Neither side's tests assert the other side's cause. On a
  submitted frame the same divergence is `bad/float_entry.json`'s (F1 in Python, F5 in Node),
  where both are `READER_PROTOCOL`.
- **(d) Precedence is pinned on the worker's emit path only** (BB8, 19:40Z). An entry the worker
  generated that breaks F1 is `INVARIANT_FAILURE` whatever else it breaks, F2 included:
  `INVARIANT_FAILURE` reports an engine defect, and `RESOURCE_LIMIT` would blame the input and hide
  the defect. The worker's encoder makes two passes. The first is the F1 walk: §2.1's types with no
  subclasses, integers within ±(2⁵³ − 1), cycles, the depth, and lone surrogates found by a scan
  that encodes nothing. It serialises nothing, holds iterators rather than a stack proportional to
  an array's width, allocates in proportion to the depth and takes time in proportion to the nodes.
  Only an entry that passes it reaches the second pass, the worker's encoder at Base with its early
  F2 guards unchanged. `emit_precedence` in `good/codec_error_mapping.json` holds BB8's cases.
- **Elsewhere precedence is not pinned.** On a submitted frame and on a persisted segment, an
  input that breaks more than one rule carries the tag of its first failure in §4's listed
  order, and within one entry whichever check the bounded scan reaches first. No test depends on
  which. A test of such an input asserts the code and that nothing was written; it never asserts
  the tag or the rule. Only a single-fault case asserts its tag. The same holds for (c): a
  segment with several content faults is F3, whichever comes first.
- **F2 is measured on the canonical form, not on the raw input** (BB8, #721 item 3). The
  decoder's time and peak memory grow with the raw bytes it is given, whitespace included. F2
  bounds only the canonical form: an entry passes F2 when its canonical form is at most 4,096
  bytes, however it was spaced. The raw input is bounded only by the enclosing reader's existing
  limit, and this contract adds no raw-input constant:
  - a submitted frame is one step line of at most `READER_FRAME_CAP`, 2 MiB plus 16 KiB, which the
    bridge holds each line to (`python_bridge.js:READER_FRAME_CAP`, `:spawnWorker`) and its
    unterminated buffer too; the worker holds its own frames to 2 MiB before it writes them
    (`worker.py:run_reader`);
  - a segment the worker reads goes through the bounded page reader, `read_page_object`
    (`worker.py:read_page_object`): it reads at most `READER_OBJECT_BYTES`, 2 MiB
    (`:READER_OBJECT_BYTES`), and inflates at most as much, before it parses;
  - a segment the store reads is stat'ed first, and a stored size over
    `READER_LIMITS.objectBytes`, 2 MiB (`reader_job_store.js:READER_LIMITS`), is F6 without a read
    (`:_segment`), and so is a stat that is not a regular file; within the bound `_readFile`
    reads it (`:_readFile`), its own size refusal (a file replaced after the stat) and `EISDIR`
    are F6 of that segment too (§2.5), and `decodeStoredObject` holds the inflated bytes to the
    same bound (`:decodeStoredObject`).

  Required acceptance tests, of the worker half's codec (the validator runs both against its own
  model): a valid entry whose canonical form is 4,096 bytes, padded with whitespace to about
  1 MiB, decodes and passes F2 within those bounds, with its peak memory measured; and an entry
  whose canonical form is 4,097 bytes fails F2 however it is spaced. `raw_transport` in
  `good/codec_error_mapping.json` builds both.
- **A lone surrogate is refused where caller text is admitted.** (b) calls a lone surrogate in a
  generated entry an engine defect. That holds only if no caller text can carry one into the
  analysis, and at Base caller text can:
  1. Both create paths parse the body with `express.json` (`server_http.js:module`), whose
     `JSON.parse` turns the escape `\ud800` into a lone surrogate, and both call `validateRequest`
     (`reader_routes.js:validateRequest`): the Site bridge (`:createReaderRouter`) and `/library/v1`
     (`library_viewer_routes.js:libraryViewerRouter`). At Base it holds `declaration_set` only to
     being an object (`reader_routes.js:validateRequest`). The three bindings are ASCII by
     `validBinding` (`:validBinding`), and the layers and methods are a closed set or ASCII by
     `validBinding`. `idempotency_key` is on the allow-list and nothing in `validateRequest` checks
     it; `/library/v1` holds it only to a string of at most 200 characters
     (`library_viewer_routes.js:libraryViewerRouter`), and the store keeps it with the request
     (`reader_job_store.js:create`). It never reaches the worker: the lease payload carries the
     declarations, the layers and the methods, not the key (`reader_scheduler.js:pump`), and the
     identity holds only hashes of the request (`:resolveIdentity`).
  2. `createAnalysisJob` (`reader_routes.js:createAnalysisJob`) stores the request as it is:
     `prepareRequest` (`reader_scheduler.js:prepareRequest`) keeps a caller's declaration set, and
     only adds a collection's default pronunciations to a set that has none.
  3. Each lease passes `record.request.declaration_set` to the worker (`reader_scheduler.js:pump`).
     The bridge writes it with `JSON.stringify` (`python_bridge.js:warm`), which writes a lone
     surrogate as the escape `\ud800`, and `worker.py` reads it with `json.loads`
     (`worker.py:main`), which makes it a lone surrogate again. `worker.py` replaces lone surrogates
     only in a lyrics request's `argv` (`:_LONE_SURROGATE`, `:main`); the reader family hands
     `declarations` to `AnalysisSession` as they are (`:run_reader`).
  4. In the analysis, `_public_declarations` (`analysis.py:_public_declarations`) redacts only
     `source`, `provenance` and `citation`, and no check on the way holds a string to well-formed
     Unicode: a pronunciation's `line` is held to 4,000 characters
     (`quality/pronunciation.py:validate_choices`) and refused later only because no registered line
     matches it (`analysis.py:AnalysisSession.__init__`).

  The registered reading is not caller text: it comes from the approved snapshot, checked against
  its pinned hash (`reader_scheduler.js:verifyReading`, read off the event loop by
  `reader_source_worker.js:module`). **Required** (R2's, in the store half's runtime train, which
  is the worker half's, §9): `validateRequest` refuses a request whose `declaration_set` holds a
  string or a key, at any depth, that is not well-formed Unicode
  (`String.prototype.isWellFormed`), as `INVALID_DECLARATION` (400), "The declaration set contains
  text that is not well-formed Unicode.", in the style of its other declaration refusal
  (`reader_routes.js:validateRequest`). It runs before the store creates a job, so no lease is
  ever offered. Because the job identity does not always change between images (§9), the scheduler
  holds a stored request to the same check before `workerPayload` (`reader_scheduler.js:pump`) and
  pauses a job that fails it with that code, so a job admitted by an image without the check never
  reaches the worker either. **Guard test** (BB8's; R2's store and route tests): a create whose
  declaration set holds a lone-surrogate pronunciation `line` (`"Bad \ud800"`, sent as the JSON
  escape), and one whose declaration key holds one, are each refused `INVALID_DECLARATION` (400)
  on both create paths, the Site bridge and `/library/v1`, before any lease: no job record is
  written and the bridge's `runReaderLease` is never called. The same text with a well-formed pair
  (`\ud83d\ude00`) is admitted. **Stored-request case** (BB8's, 21:31Z; R2's scheduler test): a
  job record written before the check, whose stored declaration set holds the same lone-surrogate
  `line`, is leased by the store first (`this.store.lease()`, `reader_scheduler.js:pump`, saves it
  `running` with a lease, `reader_job_store.js:lease`). It is then refused at the check before
  `workerPayload` (`reader_scheduler.js:pump`) with `INVALID_DECLARATION`, and the scheduler's
  catch pauses it with that code (`:pump`), which ends the store's lease. The bridge lease is
  never taken: `runReaderLease` is never called, and the worker never sees the request.
  `admission.stored_request` in `good/codec_error_mapping.json` is that record's request. The
  check stays there, not in `this.store.lease()` (BB8 6699352254, ruling 2): "refused before
  hand-out" means before the worker, and a refusal inside `lease()` would add a queued → paused
  transition with no fence, a new state edge for a case that exists only for records written
  before the check.
  **A deliberate change** (BB8's ruling): a keyed replay of a body an older image admitted, whose
  declaration set holds a lone surrogate, got 200 with the job that create made, and now gets
  `INVALID_DECLARATION` (400) on both create paths, because the check runs before either path
  looks up the key's job. For a job still queued the two agree: when next leased, it pauses at the
  stored-request check with the same code. A job no longer queued (paused, completed, failed or
  cancelled) is not leased by a replay, so nothing pauses: the replay gets the same 400 and the job
  itself is not touched.

## 3. Hard limits

Each limit is a contract constant. Passing one is a named refusal on each side, never a
truncation.

| Constant | Value | Worker, before it emits | Store, on the frame |
| --- | --- | --- | --- |
| `ENTRY_BYTES` | 4096 per entry, measured on the canonical form, not the raw input (§2.11) | `RESOURCE_LIMIT` (cause `discovery_entry_bytes`); an entry it generated that breaks F1 is `INVARIANT_FAILURE` (§2.11) | `READER_PROTOCOL` (F2) |
| `ENTRY_DEPTH` | 8 nested arrays per entry (a scalar is 0, `[["a"]]` is 2): provisional until the #721 author (3PO) declares the entry shapes, then derived from them as the smallest power of two at least twice their largest depth, at least 8 and at most 64 (§2.1, BB8 6693502369) | `INVARIANT_FAILURE`: an entry it generated past the bound breaks F1, an engine defect, since no input can deepen an entry (§2.11) | `READER_PROTOCOL` (F1) |
| `SEGMENT_ENTRIES` | 1024 per segment | cut rule (§2.4) | `READER_PROTOCOL` (F4) |
| `SEGMENT_BYTES` | 16384 entry bytes per segment | cut rule (§2.4) | `READER_PROTOCOL` (F4) |
| tail | fewer than 1024 entries and 16384 bytes | seal | `READER_PROTOCOL` (W4) |
| `FRAME_SEALS` | 8 seals per frame (≤ 128 KiB of entry bytes) | end the step at the next safe point; a unit that must be emitted and alone needs more: `RESOURCE_LIMIT` (cause `discovery_frame_seals`). A `row_seen` compaction is not such a unit: it is deferrable, so one whose live keys need more seals waits and the log grows until a membership cap stops it (§6.2; BB8 6688972927) | `READER_PROTOCOL` (W1) |
| `CHAIN_SEGMENTS` | 2048 segments per chain (≤ 32 MiB of entry bytes) | `RESOURCE_LIMIT` (cause `discovery_chain_segments`) | `READER_PROTOCOL` (W5) |
| `MEMBERSHIP_ENTRIES` | 65536 entries in the four membership logs together (`seen`, `variants`, `row_seen` and `alt_seen`, each sealed and tail): the bound derived from the first-commit budget, with only the per-entry load rate scaled: 90,975 with the margin, rounded down to 65,536 (§6.11, BB8 6682942783, 6688972927) | `RESOURCE_LIMIT`, naming the log whose append passes it: cause `discovery_seen`, `discovery_variants`, `discovery_row_seen` or `discovery_alt_seen` | `READER_PROTOCOL` (W7) |
| `MEMBERSHIP_BYTES` | 4194304 canonical entry bytes (4 MiB) in the same four logs together, each sealed and tail: provisional with `ENTRY_DEPTH`, until the #721 author (3PO) declares the entry shapes (§2.1); derived from a per-byte load rate measured at 4,096-byte entries, the worst of 17 entry shapes capped at `ENTRY_DEPTH`, scaled by 3 and fitted into the same budget beside `MEMBERSHIP_ENTRIES`' load (§6.11, BB8 6688972927, 6693502369) | `RESOURCE_LIMIT`, with the same cause for each log as `MEMBERSHIP_ENTRIES` | `READER_PROTOCOL` (W7), totalled from each log's `bytes` (§2.7; BB8 6693502369) |
| `GROUP_KEYS`, `GROUP_BYTES` | 32 keys and 8192 entry bytes in the current group | spill to `alt_seen` (§6.4): a spill rule, not a refusal | `READER_PROTOCOL` (W4) |
| `WITNESS_FIELDS` | 16 field names, each a dot path of lowercase names (`[a-z0-9_]`, joined by `.`) of at most 64 bytes | `INVARIANT_FAILURE` (an engine defect: the field list is the reducer's constant, five names in v1), its message naming `WITNESS_FIELDS (16)` | `READER_PROTOCOL` (W4) |
| `CONTINUATION_BYTES` | 8192 canonical bytes | `INVARIANT_FAILURE` (an engine defect, never a truncation), its message naming `CONTINUATION_BYTES (8192)` | `READER_PROTOCOL` (W4) |
| `REFUSAL_BYTES` | 543 canonical bytes of one method's refusal (`methods[*].refusal`): the largest construction in the call closure of the adapter's refusals, a conservative bound that the dispatch never builds; the largest refusal the dispatch can build is 336 bytes (§3.2) | `INVARIANT_FAILURE` (an engine defect: no input can lengthen a refusal, §3.2), its message naming `REFUSAL_BYTES (543)` | `READER_PROTOCOL` (W4) |
| `CURSOR_BYTES` | 131072 canonical bytes (128 KiB) of the cursor object with its `discovery` and `continuation` members removed: the largest such cursor, 99,141 bytes, plus an allowance of 31,931 bytes (§3.1) | `INVARIANT_FAILURE` (an engine defect: the largest cursor the constants allow is 99,141 bytes, §3.1), its message naming `CURSOR_BYTES (131072)` | `READER_PROTOCOL` (W4) |
| cursor numbers | every number in the cursor outside its entries and `continuation` is an integer from 0 to 2⁵³ − 1 | none: each is a count, an index or an epoch, which never reaches 2⁵³ | `READER_PROTOCOL` (W4) |
| frame | 2 MiB (`worker.py:run_reader`, `python_bridge.js:READER_FRAME_CAP`) | the existing frame refusal | — |
| control payload and record | 2 MiB (`READER_LIMITS.objectBytes`) | — | the existing `RESOURCE_LIMIT` 413 (`reader_job_store.js:encoded`) |

A worker `RESOURCE_LIMIT` names its cause (§8), pauses the job with that reason and does not requeue
it (`reader_scheduler.js:pump`). Every `RESOURCE_LIMIT` raise the reader reaches names one, not
only this table's: the resident-capacity guard (`analysis.py:_resource_guard`, `resident_capacity`) and the
meter's two budgets (`quality/meter.py:exact_number`, `declared_coordinate_bits`; `:guard_expansion`,
`expansion_budget`), which the reader reaches through `library/form.py:decode_beatgrid` and
`quality/fit.py`. §8 lists every raise site, the validator fails on a site it does not list, and C1
refuses a reply without a cause (§8). The worker's `INVARIANT_FAILURE` for the byte bounds
`CONTINUATION_BYTES` and `CURSOR_BYTES` is confirmed (BB8 6678599629): each is an engine defect,
never a truncation. For `CURSOR_BYTES` that holds only once the bound is derived from the constants
(BB8 6678702125, ruling 2), and §3.1 derives it: 128 KiB, a largest cursor of 99,141 bytes plus an
allowance of 31,931 bytes. `REFUSAL_BYTES` takes `INVARIANT_FAILURE` too, because §3.2 derives it
from how the adapter builds a refusal, so no input can pass it (BB8 6684866461). `WITNESS_FIELDS`
takes `INVARIANT_FAILURE` for the same reason as the byte bounds (§12, item 17). An entry the worker
generates that breaks F1 takes it too (§2.11; BB8, #721 item 2 (b)). That is BB8's classification:
the engine builds the entries, and the caller text known to reach the analysis, a declaration's
strings, is held to well-formed Unicode at admission (§2.11). That no caller number reaches an entry
is not traced here: `declaration_set` admits any finite JSON number (`reader_job_store.js:jsonValue`),
and the #721 author shows it from the declared entry shapes (§9). None of the five names a cause
(§8), and each one's message names the bound it passed, with the bound's value and the size found,
or the rule it broke, so an engine-defect report says which invariant broke (BB8 6688972927):

- `INVARIANT_FAILURE: the refusal of <method> is <n> canonical bytes, past REFUSAL_BYTES (543)`;
- `INVARIANT_FAILURE: the cursor without discovery and continuation is <n> canonical bytes, past CURSOR_BYTES (131072)`;
- `INVARIANT_FAILURE: the continuation is <n> canonical bytes, past CONTINUATION_BYTES (8192)`;
- `INVARIANT_FAILURE: the witness field list breaks WITNESS_FIELDS (16): <what>`, where `<what>` is
  the field count or the field name that is not a dot path of at most 64 bytes;
- `INVARIANT_FAILURE: a generated entry of <log> breaks F1: <what>`, where `<log>` is the log the
  entry was for and `<what>` is `a float`, `a nonfinite number`, `an object`, `an integer past 2⁵³ −
  1`, `a lone surrogate`, `a cyclic array`, `a nesting depth past ENTRY_DEPTH (8)` or `a value of
  another type`.

`<method>` is the method's key in `methods` and `<n>` a decimal integer. `bad/cursor_over_bound.json`
pins the first two messages for its two worker mutants.

Derived bounds, computed from the constants (not measured):

- **`cursor.discovery`** is at most 96,190 canonical bytes: five logs, each with every integer
  at 2⁵³ − 1 (W5 and W7 keep the counts far smaller) and a tail of 1,023 entries in 16,383 entry
  bytes with their 1,022 separators; the inventory; and a current group of 32 keys in 8,192
  entry bytes. It holds because W4 refuses a tail that is not open, a group past its bounds and
  any key §2.8 does not give, and W1 any log outside §2.3.
- **The whole cursor** is `CURSOR_BYTES`, plus `cursor.discovery`, plus `CONTINUATION_BYTES`,
  plus 29 bytes for the two members' keys and separators (`,"discovery":` is 13 bytes and
  `,"continuation":` 16): 131,072 + 96,190 + 8,192 + 29 = 235,483 bytes, about 230 KiB. This
  holds only because `methods[*]` carries no terminal input (§2.8).
- **A frame** is at most 1 MiB of records (`worker.py:run_reader`), plus the cursor (at most
  235,483 bytes), plus 8 seals of about 17.2 KiB each (16384 entry bytes, 1023 separators, two
  digests and the envelope), plus the summary, which this contract does not change: about
  1.4 MiB plus the summary, under the 2 MiB caps.
- **The record** is the cursor (at most 235,483 bytes), plus `record.discovery` (five logs, each
  about 200 bytes in `logs` and as much again in `verified`), plus today's record fields,
  including the inline page refs while `page_count` ≤ 250 (`reader_job_store.js:commitCheckpoint`). R2's
  store tests hold a record to that bound.
- **The declaration set** takes no bound of its own (BB8, on c21). It is bounded at admission by
  the request body it arrives in: both create paths parse the body with `express.json` at
  `HTTP_REQUEST_BYTES`, 4.5 MiB (`payload_limits.js:HTTP_REQUEST_BYTES`, `server_http.js:module`).
  The store then holds the request to 2 MiB when it creates the job, and a record past 2 MiB is
  refused 413 at its save (`reader_job_store.js:encoded`).

### 3.1 Deriving `CURSOR_BYTES` (BB8 6678702125, ruling 2)

The worker refuses a cursor past `CURSOR_BYTES` as `INVARIANT_FAILURE`, an engine defect, only
because no input can get it there. That holds when the bound is at least the largest cursor the
engine's own constants allow. This section builds that cursor from those constants, and
`bad/cursor_over_bound.json` builds it byte for byte. Every figure here is canonical bytes of
the cursor object with its `discovery` and `continuation` members removed, which is what W4
holds to `CURSOR_BYTES`; §3 adds those two members back for the whole cursor's bound.

**What the cursor outside `discovery` and `continuation` holds**, at this head:

| Part | Bound | Source |
| --- | --- | --- |
| integers | each an integer from 0 to 2⁵³ − 1: at most 16 digits | W4, which refuses any other number outside the entries and `continuation` (§2.8, §4) |
| the envelope | `contract_version`, `identity_hash` (64 hex digits), `phase` (at most 12 bytes: `native_pairs`, `shared_sound`), `method_index`, `candidate`, `emission`, `sequence`, `counters` (five integers) and `done` | the cursor's fixed fields (`analysis.py:AnalysisSession.__init__`); the phases are the task list's and `"complete"` (`:AnalysisSession.__init__`, `:_advance`) |
| `methods` | one entry per method a job names: at most 91, each key at most 37 bytes (`shared_sound:` and 24 hex digits) | the task list (`analysis.py:AnalysisSession.__init__`): `coordinates`, `form`, `language`, three native work methods (the most any language has, `fas`), its relation method, the 80 schemas and the four shared-sound methods; an assembly task shares its schema's id |
| one method's entry | seven integer counters (`candidates`, `true`, `false`, `undecided`, `refused_questions`, `first_reading_only`, `unreadable_tokens`), `coverage` (`answered` or `refused`, at most 8 bytes), `figure_counts` (three integers) and at most one `refusal` | every key the method's counts take (`analysis.py:_prepare_event`, `:step`, `:_assembly_records`, `:_finish`, `:_sound_result`); the terminal inputs are gone (§2.8) |
| a refusal | at most `REFUSAL_BYTES`, 543 bytes | the largest construction in the call closure of the adapter's refusals (§3.2) |
| `incomplete` | one reason per schema, at most 80; the longest is 68 bytes (70 canonical): "its disputed words' readings collide on more than 1375311 line pairs", with `MINI_CAP` | the three writers (`analysis.py:_any_reading`, `:_alternate_edges`) |
| `refused_schemas` | at most the 80 schema names, each at most 39 bytes | the registry |
| `witness` | `WITNESS_FIELDS` dot paths of 64 bytes, a method id, a count and a digest; v1 holds five fields, the ids and every field `_domain_tally` reads (`analysis.py:_domain_tally`) | §2.8, §3 |

**The refusal does not grow with the input** (BB8 6684866461, on 3PO 6684847656). The previous
revision read a refusal's detail as text from the input, because `relations.realise` embeds a
declared source label in its vacuous-frame detail (`relations.py:realise`), and it bounded the
refusal as `RESOURCE_LIMIT`, cause `cursor_refusal_bytes`. The adapter never builds that refusal.
§3.2 lists every refusal construction in the call closure of what the adapter can put in a
cursor, derives `REFUSAL_BYTES` from them, and makes passing it `INVARIANT_FAILURE`, as this
section's bound is.

**The largest cursor.** Every integer at 2⁵³ − 1, and 91 methods each at its fullest, holding a
refusal of exactly `REFUSAL_BYTES`: `search_stub_resolution`'s own text, not padding (§3.2). The
dispatch never builds that refusal, so the figure is conservative: with the largest refusal the
dispatch can build, 336 bytes, each method would be 207 bytes smaller. Then the longest reason
for all 80 schemas, every schema refused, and the widest witness:

| Part | Canonical bytes |
| --- | --- |
| `methods` | 84,995: 91 entries of 933 bytes each with its key, and their separators |
| `incomplete` | 9,041 |
| `refused_schemas` | 3,361 |
| `witness` | 1,274 |
| the envelope and its separators | 470 |
| the largest cursor | 99,141 |

- **The bound.** `CURSOR_BYTES = 131072` (128 KiB): the largest cursor, 99,141 bytes, plus an
  allowance of 31,931 bytes, room for 34 more methods at their fullest (934 bytes each with its
  separator) before the bound has to be derived again. It covers the cursor without `discovery`
  and `continuation`; with them, the whole cursor is at most 235,483 bytes (§3). It replaces
  160 KiB, whose derivation took every refusal at the previous revision's 1,024 bytes and found
  a largest cursor of 142,912 bytes. That figure is not reused (BB8 6684866461; §12, item 21).
- **3PO's reconstruction agrees** (6684968306): the same five parts (methods 84,995, incomplete
  9,041, refused schemas 3,361, witness 1,274, envelope 470) and the same 99,141 bytes, from the
  same method count, identifier width, integer width and 543-byte refusal, and it likewise
  leaves out `discovery` and `continuation`. Each of those inputs is checked: the methods, their
  ids and the schema names against the registry on every run, below, the refusal by §3.2, and
  the integers by W4.
- **What the worker does past it.** It checks each refusal against `REFUSAL_BYTES` first, then
  the cursor against `CURSOR_BYTES`. Either one passed is `INVARIANT_FAILURE`, never a
  truncation, with the message §3 gives, which names `REFUSAL_BYTES (543)` or
  `CURSOR_BYTES (131072)`: only content no constant allows gets there, such as a method the registry does not
  have, or a refusal from a construction §3.2 does not list.
- **When it is derived again.** On any change to the inputs above: a method, a schema, a
  counter, a reason, or `REFUSAL_BYTES` (§3.2). On each run the validator reads, from the
  registry and the source: the methods and their ids, the schema names, the phases, the coverage values, the
  cursor's counters (`analysis.py:AnalysisSession.__init__`), every key a method's counts take, the incomplete
  writers and their templates, and the fields `_domain_tally` reads. It fails when any of them
  passes this table's inputs.
- **Tests** (`bad/cursor_over_bound.json`): the largest cursor and a cursor of exactly
  `CURSOR_BYTES` are accepted. One byte over is refused by W4, and by the worker as
  `INVARIANT_FAILURE`, naming `CURSOR_BYTES (131072)`. One refusal one byte over `REFUSAL_BYTES`
  is refused by W4, and by the worker as `INVARIANT_FAILURE` too, naming `REFUSAL_BYTES (543)`. Three cursors that each hold one number W4 refuses (2⁵³,
  −1 and 0.5) are refused by W4, and name no worker code: the engine never builds such a
  number. The validator holds the fixture to exactly these cases.

### 3.2 Deriving `REFUSAL_BYTES` (BB8 6684866461)

`REFUSAL_BYTES` bounds one method's `refusal` in the cursor. The refusal stays in the cursor,
whole. Its bound is derived from how the adapter builds a refusal: fixed text, plus parts whose
size is bounded. It is not a guess about inputs, so passing it is `INVARIANT_FAILURE`, an engine
defect. This replaces the previous revision's 1,024 bytes as `RESOURCE_LIMIT`, and BB8's earlier
ruling to move the detail out of the cursor behind a fixed-size reference (6683944548, item 27).
3PO showed that no input reaches a long refusal through the real adapter (6684847656), so a
reference encoding would protect against a case that cannot occur.

**Where a cursor's refusal comes from.** `analysis.py` writes `counts["refusal"]` in four places,
and nowhere else:

- `_sound_result` (`analysis.py:_sound_result`) and `_finish` (`:_finish`): the unread-members
  refusal, fixed text;
- `_finish` (`analysis.py:_finish`): the reading-combinations refusal, fixed text around one incomplete
  reason, at most 68 bytes (§3.1's three writers);
- `_prepare_event` (`analysis.py:_prepare_event`): `json_safe(exc.refusal)` for every `_Refused` (`:_Refused`)
  the traversal raises. That is a `Refusal` (`quality/relations.py:Refusal`), written field by
  field (`library/contracts.py:json_safe`).

The validator holds that list closed. It lists every place `analysis.py` names a refusal in any
form, with the statement it sits in: the key `"refusal"` as a subscript, a dict key or a call's
argument, a keyword `refusal=`, and an attribute `.refusal`. The only writes among them are the
four above and `_Refused`'s own field, and a call names the key only to read it
(`counts.get("refusal")`). So a write by `setdefault`, by `update`, by `+=` on a field, or in a
second statement is a new entry, and the validator fails on it. `_Refused` is used only to raise
(seven times), to catch (once, `analysis.py:_prepare_event`) and in its own class: an alias, a subclass or a stored
instance fails, and so does any other module under `library/` or `quality/` that names it.

The traversal raises `_Refused` in seven places. Four build the refusal there, and three pass on
one an engine function built:

| Raise | Refusal | Its variable parts |
| --- | --- | --- |
| `_sound_candidates` (`analysis.py:_sound_candidates`) | `pair_cap` | the shared-sound method's name (`library/registry.py:shared_sound_name`), the word count, the pair count, and `SOUND_PAIR_CAP` (`analysis.py:AnalysisSession.SOUND_PAIR_CAP`) |
| `_candidates` (`analysis.py:_candidates`) | `beat` | the schema name |
| `_candidates` (`analysis.py:_candidates`) | a missing capability | the schema name, its missing and vacuous capabilities, and each one's `REMEDIES` text (`library/registry.py:REMEDIES`) |
| `_candidates` (`analysis.py:_candidates`) | `span` | the schema name, and `str()` of the `NoReferent` that `enumerate_spans` raises: its own message (`relations.py:enumerate_spans`) or `_loci`'s (`:_loci`), each naming the rule's anchor and locus and, for the first, a count of loci; `_anchor_pos`'s messages (`:_anchor_pos`) are caught inside `enumerate_spans` and counted as skipped, and are bounded with the rest |
| `_candidates` (`analysis.py:_candidates`) | what `_stub_resolved_stream` returns (`relations.py:_stub_resolved_stream`) | fixed text (`:_stub_resolved_stream`); four counts (`:_stub_resolved_stream`); or `search_stub_resolution`'s refusal (`:search_stub_resolution`), passed on at `:_stub_resolved_stream`, fixed text |
| `_assembly_records` (`analysis.py:_assembly_records`) | what `assemble` returns (`relations.py:assemble`): `_full_shape`'s (`:assemble`) | the schema name and its missing and vacuous capabilities (`:_full_shape`) |
| `_prepare_event` (`analysis.py:_prepare_event`) | what `_shape` returns (`:_shape`): `_full_shape`'s | the same |

`assemble` passes on a refusal it is given (`relations.py:assemble`), but the adapter gives it
the list of edges it rebuilt (`analysis.py:_assembly_records`). In the closure of those three functions
in `relations.py` (every module function they call or name, and every one those call or name),
only `_stub_resolved_stream`, `search_stub_resolution` and `_full_shape` build a `Refusal`. Every
call in that closure that could copy a refusal with a field changed (`replace`, `setattr`,
`__replace__`, `__setattr__`) is listed with its first argument, and none takes a refusal: a new
one fails the validator. `Refusal` is a frozen dataclass, so no field can be assigned.

**The declared label never reaches a refusal.** `_apply_declarations` reads a declaration's
`source` only to require one (`analysis.py:_apply_declarations`), except the beatgrid's, which
is dropped further on. `decode_beatgrid` requires that one too (`library/form.py:decode_beatgrid`, through
`_source_basis`, `:_source_basis`) and copies it into `BeatGrid.source` (`:decode_beatgrid`). `_apply_declarations`
passes it on (`analysis.py:_apply_declarations`), and `declare_beat` (`relations.py:declare_beat`) reads only
the grid's positions and cycle (`_beat_from_grid`, `:_beat_from_grid`) and sets `beat_source` itself.
(The `self.source` that `analysis.py:_apply_declarations` passes to `decode_beatgrid` is the reading, not a
declaration's source.) `_apply_declarations` sets every frame's source to `"declared"` (`:_apply_declarations`) or `"none"` (`:_apply_declarations`), never to
the label. And no construction above reads a frame's source: the capability refusals name
capabilities and `REMEDIES` text, never `Supply.source`. 3PO measured it through the real
adapter (6684847656, 6684968306): with real 4,096-byte and 65,536-byte declared labels,
`AnalysisSession` completes identical continuing and restored 18-record streams, and the refusal
is 187 bytes. A scratch run of guard test 1 (below) at this head gives the same with every
declaration that takes a source carrying the label, in two runs (one with `sound.beat`, one with
`beatgrid`), continuing and restored at every step: twelve 42-record streams identical to the
1-byte runs, no label in any record, refusals of 187 to 291 bytes, and every number in every
cursor an integer from 0 to 2⁵³ − 1.

**Context, not a regression.** `relations.realise` does embed the label in its vacuous-frame
detail (`relations.py:realise`). On a separately built, lower-level stream with a 4 KiB label,
3PO measured 4,607 detail bytes. The adapter never calls `realise`, so that detail never reaches
a cursor. It shows lower-level behaviour, and it is not an adapter regression.

**The bounds of the variable parts.**

- A name, a capability, a list of capabilities or a `REMEDIES` text is taken at the longest value
  its expression gives over the registry: the 80 schemas; as what is missing, every non-empty
  subsequence of each schema's capabilities, in their order, as `_candidates` and `_full_shape`
  build it, and as what is empty, every subsequence of that; the four shared-sound methods; and
  the anchors and loci of the schemas' span rules.
- Every count is a `len()` of a CPython container, or a counter that moves once per element of
  one, so it is at most `sys.maxsize`, 2⁶³ − 1 = 9223372036854775807, on the 64-bit build the
  reader runs on: the loci `enumerate_spans` skipped, and the four stub counts. `pair_cap`'s word
  count is two such lengths, at most 2(2⁶³ − 1), and its pair count is that count's n(n − 1)/2
  (`analysis.py:_sound_candidates`), at most 39 digits.
- `SOUND_PAIR_CAP` is a constant, and so is the incomplete reason's longest form (§3.1).

**The largest refusal.** With every variable part at its maximum, each construction gives the
figure in the first column. That column takes each part independently of the others, so a
construction's figure can join one schema's name to another's capabilities. At this head, 386
joins the longest schema name, Scots vowel-length rhyme (Aitken's Law), whose only capability is
`prominence`, to mosaic rhyme's `quotient:reduced_vowel` as the first missing capability,
proest's two capabilities as the list, and offbeat internal rhyme's two `REMEDIES` texts. It is
an upper bound, and `REFUSAL_BYTES` is taken over it. The second column builds each
construction schema by schema: from one schema's own name, capabilities and span rules, with
every non-empty subsequence of its capabilities missing and every subsequence of those empty, over
the schemas the condition before the construction selects (`beat` only where the schema needs
`beat`, `span` only outside `FULL_SHAPES`, `_full_shape`'s capability refusal only for the token
and template judges, its stanza refusal only for a stanza frame). That is still an upper bound for
each schema, and it is how 3PO (6684968306) and the review measured. Where a construction has no
part that depends on the schema, the two columns agree.

| Construction | Where | Independent bound | Per schema |
| --- | --- | --- | --- |
| `search_stub_resolution`: no line is declared a pointer, which the dispatch never builds | `relations.py:search_stub_resolution` | 543 | 543 |
| `_candidates`: a missing capability | `analysis.py:_candidates` | 386 | 334, chain rhyme (interlocking scheme) |
| `_full_shape`: a missing capability | `relations.py:_full_shape` | 339 | 259, 平仄 tonal template |
| `_stub_resolved_stream`: no stub resolves | `relations.py:_stub_resolved_stream` | 336 | 336 |
| `_finish`: reading combinations | `analysis.py:_finish` | 297 | 297 |
| `_stub_resolved_stream`: nothing is declared | `relations.py:_stub_resolved_stream` | 297 | 297 |
| `_sound_candidates`: `pair_cap` | `analysis.py:_sound_candidates` | 285 | 285 |
| `_full_shape`: no member bindings | `relations.py:_full_shape` | 264 | 264, Scots vowel-length rhyme (Aitken's Law) |
| `_candidates`: `span` | `analysis.py:_candidates` | 261 | 249, Scots vowel-length rhyme (Aitken's Law) |
| `_candidates`: `beat` | `analysis.py:_candidates` | 236 | 219, offbeat internal rhyme |
| `_finish`: unread members | `analysis.py:_finish` | 209 | 209 |
| `_sound_result`: unread members | `analysis.py:_sound_result` | 209 | 209 |
| `_full_shape`: no stanza frame | `relations.py:_full_shape` | 177 | 154, blues AAB stanza |

**543 is in the call closure, but the dispatch never builds it.** `_stub_resolved_stream` calls
`search_stub_resolution` only when `stream.supply("line_status")` is `present`: it returns first
when the state is `absent` or `empty` (`relations.py:_stub_resolved_stream`). A real stream reports `present`
only for a non-empty `line_status` that holds a non-empty label (`relations.py:supply`,
`:_frame_supply`). `search_stub_resolution` then reads that `line_status` (`:search_stub_resolution`), so the
refusal it builds when none is declared and no `is_stub` is passed (`:search_stub_resolution`) is never built
from the adapter. The validator shows both halves: called directly on a stream with no
`line_status`, `search_stub_resolution` builds it; through `_stub_resolved_stream`, on streams
whose state the real `Stream.supply` reads from an empty, a blank and a labelled `line_status`, it
never does. **The largest refusal the dispatch can build is 336 bytes**: `_stub_resolved_stream`'s
"no stub resolves", with its four counts at `sys.maxsize`. That is 3PO's 336 (6684968306): built
per schema, it is the largest of every construction but `search_stub_resolution`'s. In the
independent column, `_candidates`' and
`_full_shape`'s capability refusals reach 386 and 339 bytes only because that column joins parts
of different schemas.

- **The bound.** `REFUSAL_BYTES = 543`: the largest construction in the call closure,
  `search_stub_resolution`'s refusal, which has no variable part. It is kept although the dispatch
  never builds it, as a conservative bound: a later change that routes a stream without
  `line_status` there still fits, and every refusal the dispatch builds is at least 207 bytes
  under it. 3PO supports the same conservative figure, and does not claim it is the largest
  reachable refusal (6684968306). It has no headroom over that construction, on purpose: a change
  that lengthens any construction past it moves the figure, and the validator fails until the
  bound is derived again.
- **What the worker does past it.** `INVARIANT_FAILURE`, raised when the refusal is stored,
  before the frame is emitted, and never a truncation. It names no cause, as the other byte
  bounds do not (§8), so `cursor_refusal_bytes` is retired. Its message names the limit:
  `INVARIANT_FAILURE: the refusal of <method> is <n> canonical bytes, past REFUSAL_BYTES (543)`
  (§3; BB8 6688972927, the condition of accepting the retirement). BB8 left the name open (rename it to
  match, or keep it under `INVARIANT_FAILURE`); it matches the other `INVARIANT_FAILURE` bounds
  by naming none, and C1's rule that only `DISCOVERY_UNAVAILABLE` and `RESOURCE_LIMIT` carry a
  cause stands as confirmed (§12, item 22). The store refuses it by W4.
- **Guard tests** (BB8 6684866461, both required):
  1. **The worker half (#721), with the dictionary.** An analysis in which every declaration that
     takes a source has a source label of 4,096 bytes, and one in which each has 65,536 bytes,
     completes as it does today, continuing and restored at every step boundary: the same records
     as an uninterrupted run with 1-byte labels, and every refused method's refusal
     byte-identical to the one 1-byte labels give, within `REFUSAL_BYTES`. The declarations that
     take a source are the five frames (`caesura`, `refrain_tail`, `lifts`, `beat` and
     `tonal_template`), `stanzas`, `stub_resolution` and `beatgrid`. A `beatgrid` excludes
     `sound.beat`, so it takes a run of its own.
  2. **The validator, without the dictionary** (`good/refusal_construction.json`). It walks the
     source: every write of a `refusal` key and every `_Refused` raise in `analysis.py`, every
     `Refusal` and `NoReferent` the engine functions those raises pass on can build, over their
     closure in `relations.py`, every place `analysis.py` names a refusal, every use of
     `_Refused`, and every call in that closure that could copy a refusal with a field changed.
     It fails on a construction, a variable part, a name, a use or a call this section does not
     list, and on a construction that reads a schema without the guard that selects it. It
     evaluates each variable part over the registry, builds each construction's largest refusal
     in both columns, and shows the largest of all is `REFUSAL_BYTES` and the largest the
     dispatch can build is 336 bytes. It shows the dispatch never builds
     `search_stub_resolution`'s refusal. It runs the real `_candidates`, `_full_shape` and
     `_stub_resolved_stream` on streams whose every frame has a source label of 1, 4,096 and
     65,536 bytes (for the stub resolution, whose `line_status` is empty, blank or that label),
     and holds the refusals byte-identical across the three and within the bound. It checks that
     `_apply_declarations` sets a frame's source only to `"declared"` or `"none"` and reads a
     declaration's source only to require one or to hand the beatgrid's to `declare_beat`, and
     that `declare_beat` reads no source.

  If a later change lets label text into a refusal, the walk finds a part with no bound and the
  labelled runs differ, so the validator fails: the derivation catches it, not the input. If a
  future adapter does put input text into a refusal, the guard fails first, and the reference
  design comes back then (BB8 6684866461); 3PO's scratch reference oracle is kept for that.
- **When it is derived again.** On any change to a construction above, to `REMEDIES`, to
  `SOUND_PAIR_CAP` or the incomplete reasons, to the registry's names, capabilities, anchors or
  loci, or to the dispatch that reaches `search_stub_resolution`. `CURSOR_BYTES` is derived again
  with it (§3.1).

## 4. Write path

There is no new channel. A frame's seals ride the existing step and its acknowledgement.

1. `step()` emits `discovery` (§2.9).
2. The scheduler passes it to `commitCheckpoint`.
3. Under the lock, after `_leaseRecord` and the exact-retry check
   (`reader_job_store.js:commitCheckpoint`), the store checks everything below **before it writes
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
   - **F1, F2** on every entry in the seals, in the cursor tails and in the group keys, F1's
     depth bound included (§2.1). They hold entries only: a frame field that must be an integer
     and is not is W1 (`epoch`, a seal's `first`), and a cursor number W4 (§2.11).
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
   - **W7, the membership caps.** After the frame, the four membership logs hold at most
     `MEMBERSHIP_ENTRIES` entries and at most `MEMBERSHIP_BYTES` entry bytes together: for each of
     `seen`, `variants`, `row_seen` and `alt_seen`, its count plus its new tail's length, and its
     `bytes` plus its new tail's canonical bytes (§2.7, §3, §6.11; BB8 6693502369).
   - **W6, append-only tails.** In the same epoch, for every log not reset by the frame,
     the previous cursor's tail (`record.cursor`) is a prefix of this frame's seal entries
     for that log followed by the new tail, compared entry by entry in canonical form.
   - **W4, agreement.** After the frame, `cursor.discovery` names exactly the record's logs.
     For each log, `sealed` equals the count and `sealed_digest` equals the digest. Every
     tail is open (§2.4). `groups` keeps within `GROUP_KEYS` and `GROUP_BYTES`. `through`
     and `current.lines` are integer pairs of two different lines, `current.lines` comes
     after `through`, and `through` never moves back within an epoch. Nor does the current
     group, even with `through` null (BB8 6715584092, F-6): where both `record.cursor`, in the
     same epoch, and the frame have a current group, the frame's `current.lines` is at or after
     the previous `current.lines`. That is the check as narrowed (BB8 6717719856): a frame with
     no current group is held only by `through`, so a group dropped without retiring, or a
     `through` behind the previous group, is accepted until 3PO confirms (#721) that the worker
     never makes either within an epoch. If it does confirm, the check widens to the frame's
     `through` when it has no current group, and those cases, kept as accepted controls in both
     sides' tests, are refused. `inventory` is `null`
     or a count and digest, and once it is non-null in an epoch it does not change until the
     epoch advances. `witness` is `null` or well formed, with its `epoch` equal to the
     frame's and its fields dot paths within `WITNESS_FIELDS`. `continuation` stays within
     `CONTINUATION_BYTES`. `cursor.discovery`, each of its logs, `inventory`, `groups`,
     `groups.current` and a non-null `witness` hold exactly the keys §2.8 gives (the witness's
     six, BB8 6715584092), and every number in the cursor outside
     its entries and `continuation` is an integer from 0 to 2⁵³ − 1. `methods[*]` carries no
     terminal input, each method's `refusal`
     stays within `REFUSAL_BYTES`, and the cursor outside `discovery` and `continuation` stays
     within `CURSOR_BYTES` (§2.8, §3.1, §3.2). A record holding discovery with a frame and cursor
     that have none also fails W4.
4. **Write order:** pages, indexes, manifest and checkpoint as today
   (`reader_job_store.js:commitCheckpoint`), then one segment per seal in seal order (each `previous_hash`
   is the log's head at that point), then the record (`:commitCheckpoint`). The record's `discovery`
   becomes `{version: 1, epoch, logs, verified, unavailable: null}`, where each seal sets `head` to
   the new address, adds one to `segments`, adds its count to `count`, adds its entry bytes to
   `bytes` and sets `digest` to the recomputed digest. `verified` keeps each log's state unless the
   frame releases or resets that log; a log that is new, reset or of a new epoch starts at the empty
   state. A commit never advances `verified`: only a read of the stored segment does (§5.1). The
   store appends each seal's address to that chain's address list (§5.1) only after the record save
   that sets its new head returns. A commit whose record save throws leaves every list as it was. A
   throw that carries a status (`encoded`'s 413, `_capacity`'s 507 or 503, `:_save`) comes before
   the record is written, `_quotaPause` included (`:commitCheckpoint`), so only orphans changed (§7.3). A
   throw without a status can come after the rename (`atomicWrite`, `:atomicWrite`), so the record may
   have landed: the outcome is unknown (BB8 6681838131; 3PO 6681823180). The store then uses no list
   again until it has rebuilt them from the durable record's heads (§5.1).

## 5. Resume path

### 5.1 The store's walk (BB8 (a), 6678599629)

`workerPayload` runs it, so a lease checks the walk before the worker starts. `resume()` runs
a full read instead (below), so it refuses a dead job at once instead of queueing it
(`reader_job_store.js:resume`).

- **Under the writer lock.** Both run the walk through `_open` (`reader_job_store.js:_open`), never through
  `_cached` (`:_cached`), which skips the lock while the generation has not moved.
  Entering the lock runs `_enterLock` (`:_enterLock`): after any foreign writer, a generation this
  instance did not write or a pending marker, it reloads, and reconciliation (§7.4) runs before
  the walk reads anything, so a segment an older image swept is found there. No other writer can
  delete one while the walk reads. `workerPayload` runs inside the scheduler's try block
  (`reader_scheduler.js:pump`), so a refusal there pauses that one job. Because it takes the
  lock, `workerPayload` is refused `STORE_BUSY` (503) while another process holds it, for a job
  holding no discovery too, before anything is stat'ed or read. Before the walk, a lease of such
  a job read the cache without the lock while the generation had not moved. That one refusal is
  not paused (BB8 6717719856, F5): lock contention is transient and nobody did anything wrong,
  so it must not leave a job waiting for a resume. The lease ends, the job goes back to `queued`
  in the place it held, with no reason, and its attempt is not counted: the attempt counter is
  what it was before the lease. The store's `returnLease` does it, under the lock like any
  write, and every path through it clears `cancel_requested`. A cancel asked for meanwhile lands
  as `cancelled` with reason `CANCELLED`, as `cancel()` writes it, never `STORE_BUSY`, on every
  path but U2's, which holds the release's reason as it does in `cancel()` (BB8 6719406992,
  call 2); a job released meanwhile is paused
  with the U2 reason and never requeued (§8), and with no queue room the job is paused to return
  by itself when a slot opens, never `QUEUE_FULL`; the attempt is uncounted in each. There is no
  retry loop in `workerPayload`: the scheduler's next pump comes one poll interval later, and
  while the lock is still held the return is refused `STORE_BUSY` too and is tried once more at
  each pump, the job staying `running` meanwhile, with its lease's expiry as the backstop. The
  return sits in the pump's dispatch try with `listQueued()` and `lease()`, so a refusal at
  dispatch while the busy lease is held (a `STORE_BUSY` from either, say) is caught, logged and
  retried with backoff, never an unhandled rejection, and the next pump tries the return first. A
  `STORE_BUSY` from any other call in the lease (a commit, the completion, the pause) is paused
  as before. A return refused for any other reason is logged and not tried again; the job stays
  `running` and its lease's expiry ends it. A thrown value with no code, even `null`, is such a
  refusal, logged as `READER_ERROR`, so the return never throws out of the pump's catch. The
  return is not one of the three transitions out of `running` exempt from quota (§8): its
  cancel and no-room paths give the record a reason, so at exactly full quota a record past its
  reservation is refused `RESOURCE_LIMIT` and nothing is written, and the lease's expiry, which is
  exempt, then pauses the job `INTERRUPTED` with its attempt counted. So on main, while another
  process holds the lock at a lease's payload, the lease waits one pump interval, with three
  exceptions: a hold that outlasts the lease ends it as any expired lease ends, paused
  `INTERRUPTED` with its attempt counted, and it needs a resume; with no queue room the job waits
  paused until a slot opens; and at exactly full quota a return that would add a reason to a
  record past its reservation is refused, so that lease too ends at its expiry. The attempt
  number of a returned lease is the next lease's again, so a control signed with
  `expected_attempt` during the returned lease is accepted against the next one. That is benign:
  the returned lease never started a worker, so there was no work for the control to race.
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
    `this.failure` (`reader_job_store.js:_open`), so the instance serves nothing more, its lists included, until a
    restart (`:_locked`). The restart's first lock entry reconciles, and its full read rebuilds
    every list from the durable record's heads, whichever record landed
    (`good/thrown_save_outcome_unknown.json`; the store's own test,
    `mcp/test_reader_job_store.mjs:module`, already holds a restart to the generation that
    landed). That is BB8's rule, "rebuild the address list from the record's head before using
    it", and in this store the rebuild is the restart's reconciliation, so it adds no place a
    chain is read in full. Required store test (R2's side): a commit whose record save throws
    after its rename, for each outcome, leaves no list in use until the rebuild, and the rebuilt
    list ends at the durable head.

  `_reload` drops the lists with the rest of the cache. A starting store holds generation −1
  (`reader_job_store.js:constructor`), so its first lock entry reloads and reconciles, which full-reads every live
  chain. So every list in use was built by a full read in this process and then extended
  only by commits whose saves returned. The list is never persisted; the record holds the
  heads and the verified heads.
- **On a lease the walk is incremental.** For each log, with `v` its verified state:
  1. **R5, the store's own bookkeeping**, checked for every log before anything is read.
     `verified` names exactly the logs `logs` names. The address list holds exactly the
     head's `segments` addresses and ends at the head (it is empty when the head is
     `null`). `v` is never ahead of the head (§2.7): its `segments`, `count` and `bytes` are at
     most the head's, it is the empty state when its `segments` is 0, it is the head's own state
     when its `segments` equals the head's, and otherwise the list's address number
     `v.segments`, counting from 1, is `v.head`.
  2. **Stat** each of the first `v.segments` addresses. Reconciliation has already run
     under this lock (§7.4), so a missing one is `STORAGE_CORRUPT`. The stat holds it as step
     3's stat does: a name that is not a regular file, or a stored size over the bound, is F6,
     `STORAGE_CORRUPT` too, and it is not read. Any other stat error is not a verdict on the
     segment and is thrown as the read's own stat throws it.
  3. **Read and check the rest**: the segments appended since the verified head, oldest
     first. Each is stat'ed, then read through `_object('pages', …)`, which is bounded and
     address-checked (F6: changed bytes, and a stored size over the bound, which is never read,
     are `STORAGE_CORRUPT`). Then **F3** on each segment: the kind, the
     version, `job_id`, `identity_hash`, `epoch` equal to the record's epoch, and `log`, and its
     content (§2.5): every entry passes F1 and F2, and every integer field is an integer.
     **R2** links each segment to the one before it, and the last one to the record's head,
     `count` and `digest`. **R5** checks the junction: the first segment read names `v.head`
     as its `previous_hash`, and its `first` and `digest_before` equal `v.count` and
     `v.digest`; and the walk's bytes start from `v.bytes` and, with each segment read's entry
     bytes added, end at the head's `bytes` (BB8 6693502369).
  4. **Advance.** When every log passes, `verified` becomes each log's head state. That is
     one record save, in the same lock hold as the reads, so no commit can come between them:
     the save writes each verified head together with the head it verifies. A walk that read
     nothing saves nothing. If the save needs capacity the store cannot grant
     (`STORE_RECOUNTING` or `RESOURCE_LIMIT`, `_capacity` `reader_job_store.js:_capacity`), the store skips it and
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
  (`reader_scheduler.js:pump`). `resume()` then decides by a full read, which uses
  neither `verified` nor the list. `bad/verified_ahead_of_head.json` is refused this way
  before anything is read; its full read passes and saves the corrected verified heads.
- **A full read** starts at the record's head and follows `previous_hash` back to the chain's first
  segment, reading each segment once and at most the head's `segments` of them. A head whose
  `segments` is past `CHAIN_SEGMENTS`, the most W5 lets a chain hold, is R2 before any read,
  so a stored count never bounds the reads by itself. It never uses the
  address list. Each read goes through `_object('pages', …)` (F6). The chain is then checked oldest
  first: the oldest has `previous_hash: null`, `first: 0` and `digest_before = d₀`; each segment
  passes F3 and links to the one before it; and the chain holds exactly the head's `segments`,
  `count`, `bytes` and `digest` (R2): its summed entry bytes equal the head's `bytes`, and a
  mismatch is structural (BB8 6693502369). The list is replaced with what was read. A segment whose
  bytes do not match its address (F6) is `DISCOVERY_UNAVAILABLE` (409), cause `segment_corrupt`,
  logged at error level: corruption, never relabelled as breakage (BB8 6681838131). A structural
  failure, R2 or F3 (a link, a count, `first` or a field), is cause `chain_broken`. Either way the
  store releases the logs in one save (U1, §8), then refuses, naming the cause and the log. To tell
  F6 apart, the full read takes `_object`'s hash-verification refusal (`reader_job_store.js:_object`), a failed
  bounded inflation of a segment (`decodeStoredObject`, `:decodeStoredObject`), and a stored size over
  `READER_LIMITS.objectBytes` found by the stat that precedes every read (§2.5), with the file never
  read, as F6. The store's full read makes these reads through `_segment` (`:_segment`), which
  returns each of them as a fault of that one segment rather than refusing. Bytes that match the
  address but do not parse (`JSON.parse`, `:_object`), or are not UTF-8 under the required fatal decode
  (§2.11), are F3, so `chain_broken` (§2.5); any other error keeps its own code. In `resume()` this
  is new (§12, item 26): `_object` turns F6 into `STORAGE_CORRUPT` (`:_object`), which would leave
  the job paused at `STORAGE_CORRUPT` on every resume. Apart from the membership logs the worker
  loads on every lease (§5.2), which is logged membership state that ruling (a) lets resume grow
  with, a chain is read in full in exactly two places by the store, and once by the worker (BB8
  6688972927, amending the three sites of 6678599629):
  1. reconciliation after any foreign writer, which includes startup (§7.4): a full read;
  2. `resume()` of a paused or cancelled job: a full read. Its own save (`reader_job_store.js:resume`) carries
     the advanced `verified`. If that save needs capacity the store cannot grant (`STORE_RECOUNTING`
     or `RESOURCE_LIMIT`), it is made once more without the advance, as the walk skips its own
     (step 4 above), and `verified` stays where it was, so the next lease's walk reads from there;
     a second refusal is thrown as it is (BB8 6719406992, call 6). A pending release, then a saved `unavailable`, refuses first, before
     the identity and state checks, with nothing read; the full read comes after those checks and
     before the queue's, so a dead job is refused even when the queue is full. A pass replaces
     the job's address lists with the ones read, as reconciliation's does. They stand when the
     save is never tried (a `QUEUE_FULL` after the read): they are read from the durable heads,
     which nothing has changed. A save that fails discards them, so the job's lists are as they
     were before the resume (BB8 6719406992, call 5), and one that fails without a status then
     drops every list (`_open`);
  3. the worker's load of `alt_cells` when it builds the terminal record (§5.2), by its paths:
     a complete verified load, not a full read (§1). It releases nothing on F6; it raises
     `STORAGE_CORRUPT`, and `resume()`'s full read then decides.
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
  happens only in the two places above; the worker's complete verified load reads one chain,
  `alt_cells`, once.

### 5.2 The worker's load

- The worker reads each path with the bounded, address-checked page reader
  (`worker.py:read_page_object`).
  - **R1.** Every path resolves; otherwise `DISCOVERY_UNAVAILABLE`, cause
    `segment_missing`. This happens only when an older image sweeps a segment after the
    walk has left the lock.
  - **F6.** Changed bytes are `STORAGE_CORRUPT`: the job pauses with it, nothing is released,
    and `resume()`'s full read then releases it as `segment_corrupt` (§5.1).
- **F3 and R2** as in §5.1, with cause `chain_broken`. F3 includes the content (§2.5): bytes
  that do not parse (`json.loads`, `worker.py:read_page_object`), an entry the codec refuses as F1 or F2, and
  a `first`, `count` or `epoch` that is not an integer are `chain_broken`, never
  `STORAGE_CORRUPT`. A failed inflation in the page reader (`:read_page_object`) stays F6 (§2.11).
- **F5.** Every segment's `digest_after` is recomputed from its entries. A mismatch is cause
  `digest_mismatch`.
- **R3, cursor agreement.** The summary's epoch and log names equal `cursor.discovery`'s.
  For each log, `count` equals `sealed` and `digest` equals `sealed_digest`, and for each log it
  loads, the summary's `bytes` equals the worker's own sum of its loaded entries' canonical bytes,
  the bytes it computes once for F5 (§2.1; BB8 6693502369). A mismatch is cause
  `cursor_disagrees`.
- **Membership.** It is then each log's sealed entries followed by its tail. **Required**
  (§2.1): the worker computes each loaded entry's canonical form once, hashes those bytes for
  F5, and keys its sets by the same bytes, which equal `canonical_json(entry)`'s wherever that
  completes (§2.1).
  It never calls `canonical_json` on a loaded entry. That call walks the entry value by value in
  Python first, five to nine times the per-byte cost on value-dense entries (measured, §10), and
  `MEMBERSHIP_BYTES` is derived from this single pass (§6.11, §10): a worker that keys through
  `canonical_json` voids the derivation, and the proof run then re-derives the cap from its
  measurement (§9). The validator checks, through Python, that the single-pass bytes equal
  `canonical_json`'s on every canonical vector, every fixture entry and every §10 load shape
  `canonical_json` completes on, and that it fails only on the two nested past 1,000 levels.
- **When `alt_cells` is read.** The worker reads its segments, and checks them by R1, F6,
  F3, R2 and F5, only when it builds the terminal record (`analysis.py:_finish`,
  `:_sound_result`). That is a **complete verified load** (§1; BB8 6688972927), not a full read: it
  reads every segment by its path, checks each `previous_hash` link back from the record's head
  (R2), and checks the chain's count and digest against `record.discovery` (the summary, §2.10).
  On F6 it raises `STORAGE_CORRUPT` and releases nothing, exactly like a lease-time load, and
  `resume()`'s full read then decides, as the one that releases with `segment_corrupt`. R1 is
  `segment_missing`, F3 and R2 `chain_broken` and F5 `digest_mismatch`, as on every load, and a
  pause with any of them releases (§8). On every other lease it checks `alt_cells` by R3 alone,
  and the store's walk stats its verified segments and reads only those appended since (§5.1).

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

`seen` is persisted (BB8 4) as an ordered set log: first insertion only (BB8 5). It is read only for
membership (`analysis.py:target`, `:_new_pairs`) and never iterated, so membership is all its meaning; the
order only makes the bytes canonical. It counts toward `MEMBERSHIP_ENTRIES` and `MEMBERSHIP_BYTES`
(§3): an append that would pass either cap refuses with `RESOURCE_LIMIT`, cause `discovery_seen`,
and so does `variants`' with `discovery_variants`. **Test:** a guard that no consumer iterates
`seen`. If one ever does, ruling 5 is reopened.

### 6.2 `row_seen` and the lower traversal

`_candidate_pairs` supports repeated left spans: it keeps a row's dedup state until that
left span's last occurrence (`lyric-harness/quality/relations.py:_candidate_pairs`). The #656
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
  `_candidate_pairs(prune=True)` as well (`analysis.py:_new_pairs`), and that call's row dedup
  lives within the call (`relations.py:_candidate_pairs`). So in the alternate phase `row_seen` holds the
  row dedup keys of the call under way that can still recur, under the same reset and compaction
  rules. The end of each call, like the end of the lower traversal, is a row boundary with no
  live row state, where the worker resets the log if it holds any entry. It is not assumed
  empty: it counts toward `MEMBERSHIP_ENTRIES` and `MEMBERSHIP_BYTES` with the other membership
  logs (§3), and an append that would pass either cap refuses with `RESOURCE_LIMIT`, cause
  `discovery_row_seen`.
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
  the compaction, so it waits and the log grows, until `MEMBERSHIP_ENTRIES` or
  `MEMBERSHIP_BYTES` stops it with `discovery_row_seen` (§3).
- **An oversized compaction defers; this section wins over §3's `FRAME_SEALS` row** (BB8
  6688972927). A compaction is deferrable: the log is correct uncompacted, only larger. So a
  compaction whose live keys need more than `FRAME_SEALS` seals is never a unit that must be
  emitted, and it never raises `discovery_frame_seals`. That cause is for units that must be
  emitted (§3).
- **Confirmed** (BB8 6678599629). The compaction decision depends only on the traversal,
  keeps the live keys in their first-insertion order and leaves membership unchanged.
  Atomicity is the amendment of 6678702125.
- **Tests, all four required** (BB8 6678599629, 6678702125, 6681838131; four everywhere,
  BB8 6688972927):
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
(`analysis.py:_prepare_event`, `:step`). The entry is appended to the log then, not when the
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

The argument holds (BB8 1). A target's stream is non-blank only on its own lines (`analysis.py:_line_stream`),
every cell of a span key carries its line (`:_cell`, `:_span_key`), and targets sort by their lines first
(`:target`, `:_alternate_edges`). So a two-line key can only recur inside its own contiguous line-pair
group. The code checks this while it runs, and does not assume it.

For an alternate key k, let L be the sorted pair of the lines of its two members. Pairs are
compared lexicographically.

- **Membership**, as `_new_pairs` checks it (`analysis.py:_new_pairs`). k has already been met
  when it is in the primary `seen` log, in `current.keys` or in `alt_seen`, or when its
  reverse is in one of them and the schema is same-rule. Equality is §2.1's. A key already
  met is skipped. A new key becomes the pending binding.
- **A key within one line** (L = [l, l]). A new k goes to `alt_seen`, which keeps it for the
  epoch. It never retires a group, opens one or is refused by one. A two-line target yields
  within-line keys on both of its lines (`analysis.py:target`, `:_discover`), and other
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
- **The membership caps.** `alt_seen` counts toward `MEMBERSHIP_ENTRIES` and `MEMBERSHIP_BYTES` with
  the other membership logs (§3, derived in §6.11). A new key that would take them past either is
  refused with `RESOURCE_LIMIT`, cause `discovery_alt_seen`, before the frame is emitted. It is
  never dropped, and never kept only in memory (`bad/membership_over_cap.json`).
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

Variant preparation's flag (`analysis.py:_alternate_edges`) and the `MINI_CAP` flag (`:_alternate_edges`) are not
in the cursor today; they "replay themselves" (`:AnalysisSession.__init__`). Once variants are read from the
log, they would be lost, and `_finish` would report an incomplete search as answered
(`:_finish`). Each is written into `cursor["incomplete"]` at the moment it is set, as
`:_any_reading` already does. **Test:** for each flag, a restart after it is set still reports the
method incomplete.

### 6.7 Progress ticks (BB8 7)

Ticks give zero-record preparation and duplicate scans their own safe points (6675208404
§1). A tick emits no record and moves no counter: it is not a candidate
(`delta["candidates"] = 1` at `analysis.py:_prepare_event` must not apply to it), and records and counters are
unchanged from an uninterrupted run. The step deadline also applies to a step with no
records: `if records and …` (`:step`) becomes `if (records or used) and …`. Otherwise 256
preparation ticks (4–12 s, measured) can straddle the lease end (`reader_scheduler.js:pump`),
which ends in `INTERRUPTED` with no requeue (`reader_job_store.js:_expireLeases`). **Test:** a run
that ends on tick-only steps gives the same records and counters as an uninterrupted run,
and a tick-only step stops by its deadline.

### 6.8 Shared-sound traversal (3PO 4)

The traversal at `analysis.py:_prepare_event` gets the same treatment, held to everything in §6.
It has its own continuation (`continuation.shared_sound`: token, span and missing-word
positions). It keeps "false with a domain" apart from "outside the domain": an in-domain
judged cell, false included, is an `alt_cells` entry of its epoch. An outside-domain binding
logs nothing and moves no domain tally, but it is still a candidate: `candidates` increments,
as it does today (`delta["candidates"] = 1`, `analysis.py:_prepare_event`). So records and counters equal
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
  `resolve_detail_records` folds them (`analysis.py:resolve_detail_records`), and a detail part is never a
  witness record of its own. Each record contributes the tuple of `witness.fields`, read
  from the resolved record, with `null` for an absent field. The v1 fields are
  `["method_id", "id", "verdict", "a.token_ids", "b.token_ids"]`: everything
  `_domain_tally` reads (`analysis.py:_domain_tally`), endpoint roles included. The field
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
     (`analysis.py:_finish`), each followed by its own detail parts, because parts are written
     immediately after their parent (`analysis.py:resolve_detail_records`). Within the suffix the parts follow
     their parent exactly as `resolve_detail_records` requires (`analysis.py:resolve_detail_records`):
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
  `schema_name` and the engine payload's ids (`worker.py:load_records`); none of them makes a record a
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
    (`_assembly_records`, `analysis.py:_assembly_records`);
  - at each of the three split points, the worker refuses the 15 integrity faults through
    `resolve_detail_records`, and the 9 cases the resolver accepts through its own
    suffix-membership check, which runs before resolving (3PO 6678848728, BB8 6678856548,
    `bad/terminal_suffix_resume_faults.json`);
  - the 3 valid restores, one at each split point, finish the emission byte-identical to the
    uninterrupted run (BB8 6678856548, from 3PO's disk-backed restores in 6678848728), and the
    durable prefixes, the complete suffix and the `schema_name` control are accepted;
  - a non-terminal record inserted after the terminal suffix refuses `RESULT_EXPIRED`, as a test
    of its own (3PO's qualification of item 24, kept by BB8 6683944548): a contribution after the
    complete suffix (`bad/terminal_suffix_not_contiguous.json`'s `contribution_after_suffix`). It
    is separate from the contribution inserted between the boundary and the terminal parent at
    each split point (`bad/terminal_suffix_resume_faults.json`'s `inserted_record`), and neither
    stands in for the other.
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

### 6.11 Resume cost (BB8 8; BB8 (a), 6678599629; BB8 6681838131; BB8 6682942783; BB8 6688972927)

Measured on #656, a resume costs about 8–19 s (construct plus load plus recompute, §10), and
nothing is re-traversed. In an earlier revision two terms grew with position after the primary
phase: the worker's load of `alt_seen`, and the store's walk of `alt_cells`. Ruling (a) fixes
both, and 6681838131 widens the cap to every log the worker loads on every lease. **What the
caps bound, and what they do not** (BB8 6688972927): the logged-state load and the walk are
bounded by the caps, `MEMBERSHIP_ENTRIES` and `MEMBERSHIP_BYTES` for the load and
`CHAIN_SEGMENTS` and `FRAME_SEALS` for the walk. Construct and recompute depend on the text: they
are measured, not bounded. The proof run's 30 s first-commit gate is what qualifies the whole
(§9). So:

- the store's walk is incremental (§5.1): it stats the verified segments and reads only the
  ones appended since;
- `alt_cells` is loaded only at finish (§5.2);
- the four membership logs, `seen`, `variants`, `row_seen` and `alt_seen`, share two caps, one
  on entries and one on entry bytes, derived below from the lease's first-commit budget. Each is loaded on every lease, and `seen`
  alone at `CHAIN_SEGMENTS` would load for about 191 s, so a cap on `alt_seen` alone did not meet
  the criterion.

**The derivation** (BB8 6682942783, option (b); 6688972927). The budget is 30 s from a lease's
start to its first commit (§9). The inputs are §10's measurements, not bounds; the results,
`MEMBERSHIP_ENTRIES = 65536` and `MEMBERSHIP_BYTES = 4194304`, are the bounds, and
`MEMBERSHIP_BYTES` is provisional with `ENTRY_DEPTH = 8` (§2.1). Only the load
rates are scaled. Construct, recompute and the walk enter at their loaded-host measurements, as
in the derivation of `8732918312`.

| Term | Value | Source |
| --- | --- | --- |
| load rate per entry | 30.4 µs per entry × 3 = 91.2 µs | measured on the light host at #656's 65.3-byte mean entry (§10), scaled |
| load rate per byte | 138.8 ns per entry byte × 3 = 416.4 ns | measured at 4,096-byte entries, the worst of 17 shapes capped at `ENTRY_DEPTH` (§10), scaled |
| construct | 15.2 s | measured on #656, loaded host (§10), not scaled |
| recompute | 2.4 s | measured on #656, loaded host (§10), not scaled |
| incremental walk | at most 10,240 segments × 10 ms / 99 × 3 = 3.10303 s | the measured walk rate (§10), computed at the bounds |
| load of the membership logs | n entries × 91.2 µs + b entry bytes × 416.4 ns | computed |

- **The factor is 3, and it scales the load rates only.** 30.4 µs is a light-host rate, and the
  load is the term the loaded/light ratio was measured for: §10 measured the same load at 0.6 s
  light and 1.5 s loaded, a ratio of 2.5, and 3 rounds that up to a whole factor. Construct and
  recompute already enter at their loaded-host measurements. Scaling them again would count the
  same slowdown twice, for a host nobody measured.
- **The per-byte rate** (BB8 6688972927). The per-entry rate was measured on #656's 65.3-byte
  mean entries, while an entry may be up to 4,096 bytes, so the per-entry rate alone does not
  bound the load at the contract's own bounds. The per-byte rate was measured on entries of
  exactly `ENTRY_BYTES`, four to a segment, through the worker's page reader and the §5.2 checks,
  keyed by the single pass §2.1 requires. The cost per byte rises with nesting, and F1 bounds the
  nesting at `ENTRY_DEPTH` (§2.1), so the rate is the worst of 17 entry shapes, from long strings
  to arrays nested to that bound, each shape's depth capped at `ENTRY_DEPTH`, each stored plain
  and gzipped, in two passes (§10; BB8 6693502369). It is scaled by the same 3.
- **What the sum claims, and what it does not.** On one load path, a rate measured where the
  other term's share is small includes some of that term's cost, so on one path the per-entry
  term plus the per-byte term bounds a load of any mix of entry sizes. The two rates here come
  from two paths and two hosts. The per-entry rate is a0's load on #656's light host. The
  per-byte rate is the §5.2 load path rebuilt from the worker's page reader, because this head
  has no worker load, on a loaded host. At #656's 65-byte entries that rebuilt path costs about
  3.5 µs per entry on its host, against a0's 30.4 µs (§10), and nothing here explains the
  8.7-fold gap. So nothing here shows that the factor 3 is conservative for the per-byte term,
  and the sum is a derivation over two paths, not a bound on the worker's load. **Required:** the
  worker half measures its own load, the per-entry rate at #656's entries and the per-byte rate
  at §10's 17 shapes, before the proof run; if either, scaled by 3, is above the rate used here,
  both caps are re-derived from it (§9).
- **The walk term** is bounded by two caps (BB8 6688972927). Its stats are bounded by
  `CHAIN_SEGMENTS`: five chains, at most 10,240 stats. Its reads are bounded by `FRAME_SEALS`:
  at most that many segments per frame committed since the verified head. The walk has one
  measured figure, not split by host, so, as in `8732918312`, it enters at 3× that figure, about
  0.3 ms per segment, as its loaded-host figure, here taken for all 10,240 segments. A stat
  costs less than a read, so this bounds the stats and the reads together.
- **The sum.** The fixed terms come to 15.2 + 2.4 + 3.10303 s = 20.70303 s. #656's own entries
  count inside the combined cap, so the room over the whole sum is 9.29697 s, or
  101,940 entries, and 90,975 once the first step's 1 s deadline (`analysis.py:step`) is
  kept as margin. Every count in this section is computed from the unrounded terms, which are
  printed to five places (BB8 6693638249), with one exception: the per-byte rate enters as
  printed, §10's worst median of 138.846 ns rounded to 138.8 ns and scaled to 416.4 ns, so the
  byte room below is the unrounded time over 416.4 ns.
- **The entry bound.** `MEMBERSHIP_ENTRIES = 65536`, combined over `seen`, `variants`,
  `alt_seen` and `row_seen`: 90,975 with the margin, rounded down to 65,536, a power of two
  (BB8 6682942783, as 6688972927 states it). 101,940 rounds down to the same power. It is 64
  segments full by count. No #656 entry count is a term in it: #656's own entries count inside
  the cap.
- **The byte bound.** At the entry cap the per-entry term is 65,536 × 91.2 µs = 5.97688 s, which
  leaves 29 − 20.70303 − 5.97688 = 2.32009 s with the margin. At 416.4 ns per byte that is
  5,571,773 bytes, rounded down to a power of two: `MEMBERSHIP_BYTES = 4194304` (4 MiB), combined
  over the same four logs. Its term is 1.75 s. At 4,096-byte entries it holds 1,024 of them,
  256 segments. #656's measured `seen` and `variants` hold about 1,337,764 entry bytes
  (19,880 × 65.3 + 165 × about 240, computed from §10), so the cap leaves 2,856,540 bytes of
  headroom for the alternate phase, not a measured margin. The byte bound is provisional: its
  rate is the worst of 17 shapes capped at `ENTRY_DEPTH = 8`, itself provisional until the #721
  author declares the entry shapes, and a declared depth of 5 or more re-derives both (§2.1, §12,
  item 31).
- **BB8's acceptance, and its two conditions** (BB8 6699352254, ruling 1). `MEMBERSHIP_BYTES =
  4194304` stands, provisional with `ENTRY_DEPTH`. Rounding it down to a power of two is
  accepted: it gives up 1,377,469 bytes of room (5,571,773 less 4,194,304) and keeps the two
  caps alike. (a) The per-byte rate is re-measured on a quiet host before the proof run. The
  worst median's two passes differ by 4.8%, and the worst single load with the nested shapes
  capped at 64, 208.1 ns, is past the 184.4 ns at which the cap stops fitting, so the medians
  carry the claim and a noisy run could flip it. (b) If the declared entry shapes put
  `ENTRY_DEPTH` at 64, `MEMBERSHIP_BYTES` is re-derived, not inherited: the median at that cap,
  169.9 ns, is within 8% of 184.4 ns.
- **What it replaces** (BB8 6693502369). The previous revision's 2,097,152 (2 MiB) came from
  251.4 ns per byte, the 17 shapes measured up to 2,040 levels deep, which F1 no longer admits.
  That rate was about 2.3-fold the 107.3 ns the five shapes of `465582a78` peaked at on the same
  host (§10), not the 102.4 ns they gave on the measurement before. The cap returns to 4 MiB, now
  from the measurement over the capped shapes, not from 102.4 ns: it stops fitting only past
  184.4 ns per byte, measured, beside the per-entry term at its cap.
- **The figures at the caps are a derivation, not a bound** (BB8 6688972927). At the entry cap
  alone the sum is 26.68 s, 3.32 s under the budget; with the byte term at its cap as well,
  28.43 s, 1.57 s under it, which holds the first step's 1 s deadline. Each uses construct,
  recompute, the walk rate and the two load rates, which are measured terms (§10).
- **The proof run decides whether #656 fits** (BB8 6682942783, corrected by 6683944548). The one
  Whitman figure here is its primary phase's 20,045 `seen` and `variants` entries (§10). The
  45,491 entries the cap leaves are headroom for the alternate phase, not a measured margin:
  Whitman's alternate phase is not measured. The figure "`row_seen` live at only 6 of 42
  boundaries", cited in 6682942783, comes from 3PO's two-line synthetic fixture, not from
  Whitman, so it says nothing about Whitman's alternate phase. The proof run is the only evidence
  for that phase, and its gates decide (§9): every lease's first commit within 30 s, and finish
  work measured, which is still open. If a lease's first commit misses 30 s on the qualified
  image, the cap is re-derived from that measurement. It is never waived.
- **What this replaces.** 6681838131 took every term at the loaded-host factor, construct and
  recompute included (19.2 s and 2.7 s). That gave BB8's 16,384, and over the combined sum the
  previous revision's 32,768 (`147f5dd3d`). A combined cap of 16,384 would refuse #656's own
  run before its alternate phase. BB8 retracts that rule (6682942783), and both figures go with
  it.
- **Two caps, with a cause for each log.** An append that would take the four logs past either
  cap refuses with `RESOURCE_LIMIT`, cause `discovery_seen`, `discovery_variants`,
  `discovery_row_seen` or `discovery_alt_seen`: the log whose append passes it
  (`bad/membership_over_cap.json`, for the entries and for the bytes). A store sent a frame past
  either cap refuses it as `READER_PROTOCOL` (W7): each log's state carries its `bytes` (§2.7;
  BB8 6693502369), so the store totals the entry bytes as it totals the counts. The caps are
  shared, so no single log can reach the 191 s load of one log at `CHAIN_SEGMENTS`.

**What the bound leaves out** (§12, item 18, ruled by 6681838131). The cap bounds a lease's cost
up to its first commit, and only that. It is never a qualification of a whole lease's cost.
Each exclusion is named, and each is either capped or left out on purpose:

- **Construct and recompute are #656's loaded-host measurements**, not scaled. They depend on
  the text, not on the cursor's position.
- **Finish work is outside the first-commit criterion, and open.** The finish lease loads
  `alt_cells` in full: 12,105 entries on #656, about 1.10 s at 91.2 µs, and up to 2,097,152
  entries at `CHAIN_SEGMENTS`, about 191.26 s. It reads the committed evidence for option 2's
  reconstruction (`load_records`, about 63 MB plain on #656, not timed, §6.9). And it runs
  `_domain`'s unpruned enumeration (`analysis.py:_domain`), up to `DOMAIN_CAP` = 248,661,361
  pairs, not timed. It happens once, so the first-commit criterion does not cover it, but the
  finish lease must complete before the lease expires, or it loops. The proof run measures it
  (§9). If it does not fit, it needs checkpointable progress of its own or option 2's domain-log
  fallback (§6.9). It is listed as open, not as qualified (§12, item 29).
- **Reconciliation inside a lease's lock entry is an accepted exclusion.** After any foreign
  writer, a generation this instance did not write or a pending marker (`_enterLock`,
  `reader_job_store.js:_enterLock`), the lease's first lock entry reconciles, which full-reads
  every live chain of every job (§7.4). At the default 256 MiB quota (`server_http.js:module`), if
  all of it were segments of about 17.5 KiB, that is 14,979 segments: 4.54 s at the walk term's
  rate, more than the 1.57 s margin above. The proof run records each one (§9).

The measured gate stays: in the proof run, every lease's first commit lands within 30 s of the
lease start, and each walk's time is recorded (§9).

## 7. Retention, GC roots and crash ordering

### 7.1 What stays live

Segments reachable from the heads of records in the queued, running, paused or cancelled
states stay live.

- Cancelled jobs can resume (`reader_job_store.js:resume`), so they keep their discovery.
- So do jobs paused by quota (`_quotaPause`, `reader_job_store.js:_quotaPause`), by lease expiry (`:_expireLeases`), or by
  `READER_ERROR`.

### 7.2 Release points and GC roots

Each release point is a single record save; GC then reclaims the segments.

- an epoch advance (§2.6);
- a `row_seen` reset (§2.6);
- `complete()`, which saves `discovery: null` (`reader_job_store.js:complete`). On a job whose
  release was saved already, that null erases its trace, `unavailable`: the trace is read under
  the lock before the save and, once the save lands, logged once as
  `READER_DISCOVERY_TRACE_ERASED`, at error level for `segment_corrupt` and warn for any other
  cause, as the release's own line is (BB8 6715584092), with the job, `outcome: "saved"`, the cause, the log and the
  released heads, all from the record's validated `unavailable` (§2.7). A completion refused at its
  save erases nothing and logs nothing, and a job with no saved release logs no such line (BB8
  6714569541, Q5). A completing save that throws without a status may have landed (§4), and
  nothing could log the trace later if it did, so the trace is logged then, once, with
  `outcome: "unknown"`; a throw before that save starts logs nothing, and so does a save that
  throws with a status, which wrote no record (BB8 6715909159). If that save did not land,
  the trace stays in the record, and a later completion that lands logs it again, as `saved`;
- expiry or delete: `_tombstone` rebuilds the record without the field (`reader_job_store.js:_tombstone`);
- reconciliation (§7.4), a full read in `resume()` that fails (§5.1), and a pause with code
  `DISCOVERY_UNAVAILABLE` (§8), each of which also sets `unavailable` (§2.7, U1).

Every release empties the released logs' `verified` states in the same save, and their
address lists once it returns. The walk's advance of `verified` (§5.1) is not a release: it
moves no head and frees nothing. A lease's walk never releases.

GC:

- Add one `['discovery', head]` root per non-null head, next to the checkpoint root, in
  three places: `_markRecord` (`reader_job_store.js:_markRecord`), the mark loop (`:maintain`) and the re-mark
  (`:maintain`).
- In `_markStep` (`reader_job_store.js:_markStep`), a `discovery` entry reads from `pages/`, marks `live.pages`
  and pushes its `previous_hash`. `live` holds only `OBJECT_KINDS` (`:OBJECT_KINDS`), so the kind must
  be mapped to `pages`; indexing `live.discovery` would throw.
- The sweep is unchanged. A verified head needs no root (§2.7).
- Chains are append-only and their tails live in the record, so a running job creates no
  discovery garbage except a reset `row_seen`'s sealed segments and, at an epoch advance, every
  segment of the logs the advance releases (§2.6).

### 7.3 Crash ordering

- **A segment is synced but the record is not saved.** The orphan is collected. On resume
  the worker re-seals identical bytes (the cut rule), and `_blob` refreshes the file's
  mtime (`reader_job_store.js:_blob`).
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
- **Another instance releases while a collection is open.** The mark reads the cached records
  without the lock, so it may still count the released job's segments live; that only keeps
  them. The release is one record save that moves the generation, so the collection's next
  lock entry, its next slice or its sweep, abandons it, and it sweeps nothing. A release tried
  while the sweep holds the lock is refused `STORE_BUSY` (503) and writes nothing; retried, it
  lands. The next full collection reclaims the released segments, and every segment a
  surviving record references stays (BB8 6710235213). A release only removes roots, so what
  this protects is a write the mark never saw: a seal another instance commits at the same
  point is kept by the same abandon, even with its file back-dated past the mark's start, and
  one tried while the sweep holds the lock is refused `STORE_BUSY` and writes no segment.
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
  writer: a generation it did not write, or a pending marker (`_enterLock`, `reader_job_store.js:_enterLock`, which
  already reloads the records and abandons the GC). A foreign writer is any other instance, of
  this image or an older one, not only an image that sweeps (3PO 6681823180 (b)). Startup is
  one such entry: a starting store holds generation −1 (`:constructor`), so its first lock entry
  (`:constructor`) always reconciles. Every discovery read the
  store makes is the walk or reconciliation, and both run under the lock (§5.1), so a walk
  always runs after the reconciliation it needs.
- **Reconciliation is a full read** (§5.1) of every live chain, one of the store's two
  full-read places (the other is `resume()`). It starts at each head and stats each segment before reading it,
  because `_object` maps `ENOENT` to `STORAGE_CORRUPT` (`reader_job_store.js:_object`) and `_readFile` refuses a file
  over its bound as `STORAGE_CORRUPT` before any address check (`:_readFile`), either of which would
  fail the whole store: a missing segment is `segment_missing`, and a stored size over the bound is
  F6, `segment_corrupt`, without a read. It replaces the address lists with what it read. For a #656-sized job that is 99 segments (measured), and
  at the bounds up to 5 × `CHAIN_SEGMENTS` per job (computed). It saves no verified head:
  usage is unknown until the recount (`:_enterLock`), and only a save that does not grow a
  record commits then. The job's next walk reads from its saved verified head. `resume()`'s full
  read is the other way round: its own save carries the verified heads, made once more without
  them if it is refused for room, and a save that fails discards the lists it read (§5.1).
- **A chain it cannot use is released**, in one save:
  - a missing segment: `unavailable` becomes `{cause: "segment_missing", log, released}`;
  - a segment whose bytes do not match its address, or whose stored size is over the bound
    (F6, §2.5): `{cause: "segment_corrupt", log, released}`, and a log line at error level (BB8
    6681838131). Corruption stays visible as
    corruption; it is never relabelled as breakage (`bad/segment_corrupt_at_reconciliation.json`);
  - a structural failure of the full read (F3 or R2: a link, a count, `first` or a field):
    `{cause: "chain_broken", log, released}`. `chain_broken` is structural only;
  - each of these releases that job and does not fail the store, so one job's chain never stops
    a startup;
  - `logs` and `verified` are emptied in the same save (U1, §8);
  - a queued job is also set to `paused`, with `deferred_requeue: false` and a null fence. It
    keeps its `queued_at`, `queue_order` and `cancel_requested`: the release is not
    `store.pause`, which rewrites them (`reader_job_store.js:pause`). Its reason is
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
  `{head, segments, count, bytes, digest}`, collapses to its name and its head, `{"<log>": <head>}`, as
  the previous revision (`2e8ae0239`) already defined it, and the reason copies the same map
  (U2). For each released log the save drops its two states, in `logs` and in `verified` (about
  200 bytes with a head, about 130 for an empty state), and adds its head twice (about 80 bytes
  each, or about 20 for a log with only a tail). It adds the cause and the log twice (about 30
  bytes each time) and about 90 bytes of envelope once. Reconciliation releases a chain because
  one of its segments is missing, damaged or does not fit, so at least one released log has a
  head. The validator holds the property over every combination of logs at the bounds: each log
  absent, with only a tail, or with a head at the smallest or the largest count; verified heads
  lagging or not; the three causes a full read releases with; and every job state with its
  attempt counter, its fence and its queue fields (`queued_at`, `queue_order`,
  `cancel_requested`) at their widest, kept as they were. The release is never larger than the
  record it replaces. The property covers every well-formed `record.discovery`, whose `verified` names exactly the
  logs `logs` names (§2.7; BB8's ruling on D1, 6709891376: a value that breaks it is malformed, and
  never takes a pending path of its own); a malformed one is
  ruled by the bullet below, never by this property. A log whose head is `null` but whose
  `segments` is not 0 fails R2 and releases with no head; its two dropped states still outweigh
  what the release adds. The worst case is one log at its smallest count, with the longest cause
  and log names: the save shrinks by 33 bytes. The margin is small. A field added to this reason
  or to `unavailable`, such as a message or a time, would make the release grow, and a growth
  before usage is known is refused (`STORE_RECOUNTING`), which would fail the startup. Startup's
  commit-before-usage ordering relies on this property.
- **A malformed `record.discovery`** (§2.7, M1; BB8 6700200435, condition 4, on R2's question 4;
  BB8 6709891376, ruling 3).
  Reconciliation finds it, in a queued, running, paused or cancelled record, and releases it as
  above: cause `chain_broken`, log `null`, `released` naming each well-formed log name with its
  head if that is a 64-hex string and `null` otherwise, `epoch` the value's own if it is an
  integer from 0 to 2⁵³ − 1 and 0 otherwise, and the same per-state rules. It must never sit
  silently undispatched: from that reconciliation on, the job shows as `paused` (or its own
  `paused` or `cancelled`) with the U2 reason.
  - The property above does not cover it: a malformed value can be shorter than the released
    shape, so its release can grow. The store saves it at once whenever `_capacity` admits the
    save: inside the record's reservation while usage is unknown (a growth that
    only moves bytes from slack to usage), or when it shrinks.
  - A release `_capacity` refuses (`STORE_RECOUNTING` while usage is unknown, `RESOURCE_LIMIT` at
    full quota) is pending: the store holds it in memory, the job view shows it, `_dispatchable`
    skips the job, and `workerPayload`, `commitCheckpoint` and `resume` refuse with
    `DISCOVERY_UNAVAILABLE`, cause `chain_broken`, log `null`, exactly as after the save. It is
    saved at the first point usage is known: startup after the usage scan, a recount's
    acceptance, or a `lease()` with usage known. A save refused there is logged and retried at the
    next such point, and never thrown from `lease()`, a recount or startup. A delete or an expiry
    of a pending job drops the pending release with the rest of `discovery`: the tombstone holds
    none, and the job view shows the tombstone.
  - It is logged once at error level when found (`READER_DISCOVERY_MALFORMED`), and its release
    once when its save lands (`READER_DISCOVERY_RELEASED`, cause `chain_broken`, log `null`), as
    every release is: at once, at the first point usage is known, or in a U2 save that carries it
    (§8). A running job keeps its lease; its next refusal pauses it with the U2 reason (§8).
    `complete()` is not among its refusers, as it is not among a saved release's: its save writes
    `discovery: null` (§7.2), which releases the whole of the value, so when it lands the release
    is no longer pending and is logged once there. A completion refused with a status is a quota
    pause, which is a U2 save that carries the release.
  `bad/malformed_record_discovery.json` pins it.
- **A queued job whose `unavailable` is set** (BB8 6700200435, on R2's question 6). An older
  image's `resume()` or `_promoteDeferred` can leave a released job `queued`, or `paused` with
  `deferred_requeue: true`. `_promoteDeferred` never requeues a record whose `unavailable` is set.
  A queued one is repaired to `paused` with the U2 reason, `deferred_requeue: false` and a null
  fence, keeping its attempt and queue fields: at startup beside the `INTERRUPTED` pauses, and in
  `lease()` when usage is known, so a small growth is admitted. A repair `_capacity` refuses is
  logged (`READER_REPAIR_DEFERRED`) and retried at the next such point, and never thrown. Until it
  lands, `_dispatchable` skips the record, `lease(id)` returns null for it, and the job view shows
  the repair, so no record that is not dispatched is ever shown `queued`.
- **No refusal at lease time.** `store.lease()` takes the first queued job whose lease fits
  (`reader_job_store.js:lease`), passing over a job only for a room refusal. Any other refusal it
  throws is caught by the scheduler's dispatch try (`reader_scheduler.js:pump`), logged and
  retried with backoff, and the next pump picks the same job again, so a discovery refusal raised
  inside `lease()` would hold up that job and every job behind it, since the loop throws before it
  reaches a later candidate. `_dispatchable` (`reader_job_store.js:_dispatchable`) skips a record whose `discovery.unavailable` is set,
  and refusals are raised only by `workerPayload`, `resume` and `commitCheckpoint`.
- **Startup order.** At startup the pass runs before the startup collection, which a0 moved
  ahead of the pauses (`reader_job_store.js:constructor`). Otherwise the mark would meet the missing segment and
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
| `READER_PROTOCOL` | 400 | store, `commitCheckpoint`; scheduler, at the reply boundary and as the fallback pause | any of F1–F6 or W1–W7 on a frame. Nothing is written; the job pauses with this reason and is not requeued. The scheduler pauses a job with this code, without a status, for a reply that breaks C1, and as the one fallback pause when `store.pause` refuses the pause it was given (§8, the pause). |
| `DISCOVERY_UNAVAILABLE` | 409 | store (`workerPayload`, `commitCheckpoint` and `resume` from `unavailable` or from a pending release; a full read in `resume()`; reconciliation's release, a malformed `record.discovery`'s included) and worker (load, traversal) | causes below |
| `STORAGE_CORRUPT` | 503 | store; worker | a segment's bytes do not match its address (F6) on a lease's walk or the worker's load, the finish-time complete verified load of `alt_cells` included (§5.2), which releases nothing, while a full read releases that job with `segment_corrupt` instead (§5.1, §7.4); the store meets a missing segment outside reconciliation, which releases that job instead (§7.4); or a lease's walk fails R5, R2 or F3 (§5.1), which releases nothing |
| `STALE_READING` | 409 | worker | a v1 cursor on a v2 worker, a v2 cursor on a v1 worker (`analysis.py:AnalysisSession.__init__`), or a witness whose fields are not the ones the worker's reducer reads (§6.9) |
| `RESULT_EXPIRED` | 410 | worker | the option 2 witness disagrees with durable history, or is null on a qualified method (§6.9) |
| `RESOURCE_LIMIT` | — (the job pauses) | worker | a §3 limit the worker cannot meet by ending its step, or another raise of §8's list; it names its cause (below) |
| `INVARIANT_FAILURE` | — (the job pauses) | worker | `CURSOR_BYTES`, `CONTINUATION_BYTES`, `REFUSAL_BYTES` or `WITNESS_FIELDS` passed, or an entry the worker generated breaks F1 (a float, a lone surrogate, an object, an integer out of range or a depth past `ENTRY_DEPTH`; §2.11): an engine defect, naming no cause, never a truncation or a skip; its message names the bound and its value, such as `REFUSAL_BYTES (543)`, or the rule, `breaks F1: <what>` (§3, §3.1, §3.2) |

`DISCOVERY_UNAVAILABLE` always names its cause. 409 matches `STALE_READING`; 410 stays with
`RESULT_EXPIRED`, because here the result is not gone. A route's 409 error body names it too
(BB8 6719406992, call 7): on the Site bridge and on `/library/v1`, the body of a
`DISCOVERY_UNAVAILABLE` refusal, a resume's included, carries `cause` and `log` beside `code`,
`message` and `remedy`, copied only when the cause is one of the table's and the log one of §2.3's
or `null`, so it names nothing the record's validated `unavailable` does not. The Log column says whether a reply's
`error_log` names a log (`required`), may (`optional`) or must not (`none`); §2.7's `log` follows
it. The one exception is `chain_broken` for a malformed `record.discovery`, whose release is the
store's own and names log `null` (§2.7, §7.4; BB8 6709891376, ruling 2). That release is not a
reply, so C1 still holds every reply naming `chain_broken` to `required`. The causes:

| Cause | Rule | Raised by | Log | Message |
| --- | --- | --- | --- | --- |
| `segment_missing` | R1 | worker; store from `unavailable` | required | This analysis can no longer resume exactly: part of its saved progress is missing. Its committed evidence stays readable. Delete it, then create a new analysis with a new key. |
| `segment_corrupt` | F6 at a full read | the store's full read only (reconciliation, `resume()`), logged at error level; never a worker, whose loads, the complete verified load of `alt_cells` included, raise `STORAGE_CORRUPT` on F6 | required | This analysis can no longer resume exactly: part of its saved progress is damaged. Its committed evidence stays readable. Delete it, then create a new analysis with a new key. |
| `chain_broken` | R2, F3 at read; §2.7 shape (malformed record) | the store's full read (reconciliation, `resume()`); reconciliation of a malformed `record.discovery` (§2.7, §7.4); worker | required, except null for a malformed record (§2.7, §7.4) | This analysis can no longer resume exactly: part of its saved progress does not fit together. Its committed evidence stays readable. Delete it, then create a new analysis with a new key. |
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
| `discovery_seen` | `MEMBERSHIP_ENTRIES` or `MEMBERSHIP_BYTES`, by an append to `seen` | none | This analysis stopped: its search of the text's own readings kept more pairs than a resume can reload in time. Its committed evidence stays readable. |
| `discovery_variants` | `MEMBERSHIP_ENTRIES` or `MEMBERSHIP_BYTES`, by an append to `variants` | none | This analysis stopped: it prepared more reading variants than a resume can reload in time. Its committed evidence stays readable. |
| `discovery_row_seen` | `MEMBERSHIP_ENTRIES` or `MEMBERSHIP_BYTES`, by an append to `row_seen` | none | This analysis stopped: its search kept more row pairs than a resume can reload in time. Its committed evidence stays readable. |
| `discovery_alt_seen` | `MEMBERSHIP_ENTRIES` or `MEMBERSHIP_BYTES`, by an append to `alt_seen` | none | This analysis stopped: its search of alternate readings kept more pairs than a resume can reload in time. Its committed evidence stays readable. |
| `resident_capacity` | the reader's memory envelope (`analysis.py:_resource_guard`) | none | This analysis stopped: it needs more memory than this reader may use. No source or comparison was skipped. Its committed evidence stays readable. |
| `declared_coordinate_bits` | the meter's 256-bit coordinate budget (`quality/meter.py:exact_number`) | none | This analysis stopped: a declared beat or meter position is larger than the reader can compute with. Its committed evidence stays readable. |
| `expansion_budget` | the meter's per-operation expansion budget (`quality/meter.py:guard_expansion`) | none | This analysis stopped: a declared meter or beat pattern expands to more positions than the reader can compute with. Its committed evidence stays readable. |

Every `RESOURCE_LIMIT` raise the reader reaches, by module and enclosing function, and the cause
it names (review H2). The validator walks the imports of `library/analysis.py`, function-local
ones included, finds every raise whose message starts `RESOURCE_LIMIT`, and fails on one this
table does not list, unless its message names a cause of the set itself (`RESOURCE_LIMIT[cause]:`):

| Module | Function | Cause |
| --- | --- | --- |
| `library/analysis.py` | `_resource_guard` | `resident_capacity` |
| `quality/meter.py` | `exact_number` | `declared_coordinate_bits` |
| `quality/meter.py` | `guard_expansion` | `expansion_budget` |
| `lyric_harness.py` | `main` | none: the lyrics command line's writer check (`lyric_harness.py:main`); `library/form.py` imports the module for its lexicon, and the reader never runs `main` |

Plumbing (R2's side, with the #721 author for the worker's raises):

- **The whitelist.** `worker.py`'s whitelist (`worker.py:main`) gains `DISCOVERY_UNAVAILABLE`,
  `STORAGE_CORRUPT` and `INVARIANT_FAILURE`; otherwise they surface as `READER_ERROR`.
- **How the worker names a cause.** A refusal's message starts `CODE[cause]:` or
  `CODE[cause,log]:`, for example `RESOURCE_LIMIT[declared_coordinate_bits]: …` or
  `DISCOVERY_UNAVAILABLE[segment_missing,alt_cells]: …`. `worker.py` (`worker.py:main`) reads the code,
  the cause and the log from that head, applies the whitelist to the code, and sends
  `error_cause` and `error_log` beside `error_code`. A head that does not parse is
  `READER_ERROR`. Every raise site in the table above gains its cause this way: `analysis.py`'s
  (the #721 author's) and the meter's two, whose message heads change and nothing else.
- **The bridge forwards them, and marks a reply.** On the worker's final frame
  (`python_bridge.js:spawnWorker`) the bridge passes `error_cause` and `error_log` beside
  `reader_result` and `error_code`, and sets `reply: true`. At Base it forwarded only
  `reader_result` and `error_code`, so a worker's cause never reached the scheduler; R2's Step 4
  adds the two fields and the mark (`:spawnWorker`), and a bridge failure (`:createPythonBridge.failure`)
  never sets `reply`.
- **The scheduler tells a reply from its own errors.** An error a Node sink throws inside
  `onReaderCheckpoint` (`reader_scheduler.js:pump`: `commitCheckpoint`'s refusals, and
  `packReaderPages`' `RESOURCE_LIMIT`, `:packReaderPages`) reaches the scheduler today only as a bridge
  result with code −1 and no status, cause or log (`python_bridge.js:spawnWorker`, `:execute`,
  `:createPythonBridge.failure`). The scheduler keeps that error itself (`let sinkError`, set in
  `onReaderCheckpoint` before it rethrows) and, when the lease fails, rethrows it as it was, with
  its code, status, cause and log, instead of building one from the bridge result
  (`reader_scheduler.js:pump`). Only a result with `reply: true` is a reply. A bridge failure
  with no reply (a kill, a timeout, an unreadable frame) pauses as today.
- **The pause.** The catch that pauses (`reader_scheduler.js:pump`) passes `failure.error_cause ?? failure.cause`
  and `failure.error_log ?? failure.log`, and for C1's reason `reply_code`, `field` and `value`;
  `store.pause` accepts them. A refusal the store raises from `unavailable` (`workerPayload`,
  `commitCheckpoint`, `resume`) or from a failed full read carries `cause` and `log`; one raised
  inside the sink reaches the catch through `sinkError`. The scheduler logs a reply's stderr,
  the worker's message with the meter's or the resident guard's figures, because a reason with
  a named cause stores no message. It logs that line too for every reply whose pause
  `store.pause` refuses, with a cause or without one (BB8 6705927389): `[reader] worker reply
  <code>[<cause>]: <stderr>`, the `[<cause>]` only when the reply names one, each echoed as C1's
  `value` is (at most 64 bytes) and the stderr cut to 4,096 characters. A reply whose pause is
  refused `STALE_ATTEMPT` is logged as stale, `[reader] worker reply <code>[<cause>] (stale:
  STALE_ATTEMPT): <stderr>`, with the same echo and cut, because its lease was already over or
  another's and that is not a defect (BB8 6707363590); no other line says stale. The line is
  written once the pause is answered, never before.
  **The fallback pause** (BB8 6700200435, condition 3, on R2's question 3). If `store.pause`
  refuses with any code but `STALE_ATTEMPT`, the scheduler logs the refusal and makes exactly one
  more `store.pause`. The log line, `[reader] checkpoint recovery failed: <refusal> refusing
  <code>[<cause>]`, names the refused pause's code and, when it has one, its cause, echoed as
  above, so the original stays recoverable once the fallback has replaced it (BB8 6705927389).
  The fallback is `{code: "READER_PROTOCOL", message: "The reader reply could not be
  recorded: <code>.", requeue: false}`, where `<code>` is the refusal's code. It carries no cause,
  no log and no release, and `discovery` is unchanged. So the lease ends whatever the reply held.
  If the fallback is refused too, that is logged, no further call is made, and lease expiry
  (`_expireLeases`) ends the lease as at Base. The fallback follows only a refused catch-pause:
  after a sink, worker or bridge error the catch-pause is the first `store.pause` and the fallback
  the second; when the scheduler's own end-of-lease `store.pause` or `store.complete` is refused
  first, that refusal reaches the catch as at Base, the catch-pause (with the refusal's code) is
  the second store call and the fallback the third. There is never a second fallback.
  `STALE_ATTEMPT` takes no fallback: the lease is already over or another's. The fallback is the
  same with C1 on and off; with C1 on it is a logged safety net. `store.pause` refuses an argument
  outside its sets (a cause outside every set, a cause that is not a string, a log outside §2.3's),
  a cause of the wrong family (a `RESOURCE_LIMIT` cause on `DISCOVERY_UNAVAILABLE`, a
  `DISCOVERY_UNAVAILABLE` cause on `RESOURCE_LIMIT`, any cause on another code; BB8 6705927389),
  and a `DISCOVERY_UNAVAILABLE` that names no cause (the strict pause, which U1 and U2 need: both
  name the cause), with the internal code `INVALID_PAUSE` (500), which is never a job's reason and never collides
  with admission's `INVALID_DECLARATION`; a cause is never dropped to `{code, message}`.
  `bad/reply_pause_refused.json` pins every case.
- `store.pause` with code `DISCOVERY_UNAVAILABLE` releases the logs and sets
  `unavailable: {cause, log | null, released}` in the same save (§2.7). This is how a refusal
  the worker raises (R1, `chain_broken` from F3 or R2 at its load, `digest_mismatch`,
  `cursor_disagrees`, `inventory_mismatch`, `retired_key_recurred`) frees the job's chains and
  quota, and why a later `resume()`
  refuses at once instead of requeueing a job that would fail the same way. Confirmed, with
  one condition (BB8 6678599629): the paused reason records the released log names and
  their heads at release. The job's address lists (§5.1) go once that save returns, and the
  release is logged as reconciliation's is. A record that holds no discovery state (`null`, or no
  key) has nothing to release: the pause stores `{code, cause, log}` and adds no `discovery`.
- **U1, the release record.** Every release that sets `unavailable`, from reconciliation, a
  failed full read or a `DISCOVERY_UNAVAILABLE` pause, is one save. It empties `logs` and
  `verified`, and it sets `unavailable` with `released`: each log the record held, with its
  head at release. The committed evidence stays readable: a release frees discovery segments
  only, never pages, indexes, manifests or checkpoints (§7.2). **A release of a record whose
  `unavailable` is already set releases nothing and leaves `unavailable` unchanged**, so the
  first release's trace wins. That covers a pause after reconciliation released a running
  job, and a later pause that names another cause. A reply that names no cause never gets
  here: C1 refuses it first, and with C1 off `store.pause` refuses it `INVALID_PAUSE` (the
  strict pause, above), so the fallback pause ends the lease (`bad/reply_pause_refused.json`).
- **U2, the reason follows `unavailable`.** While it is set, every save that writes the job's
  reason writes `{code: "DISCOVERY_UNAVAILABLE", cause, log, released}`, copied from it, and
  stores no message: the job view renders the message from the cause, by the table above.
  The saves are a release itself (reconciliation's, of a queued, paused or cancelled job, a
  malformed `record.discovery`'s included, which the job view shows from the moment it is decided
  until its save lands, §7.4), a
  `store.pause` of any code, `_quotaPause` (`reader_job_store.js:_quotaPause`), startup's `INTERRUPTED` pause
  (`:constructor`), `_expireLeases` (`:_expireLeases`) and `cancel()` (`:cancel`). Each changes the
  state as it does today, except that while `unavailable` is set a pause never requeues the
  job: its state is `paused` (or `cancelled` on a requested cancel), with
  `deferred_requeue: false`. So the trace stays in the reason whatever happens to the job
  after the release, and the cause stays traceable after GC reclaims the segments.
  `good/unavailable_pause_reason.json` pins each path. A job whose malformed release is pending
  (§7.4) has its `unavailable` there: each of these saves writes the release too, and so is the
  durable release when it lands. If `_capacity` refuses such a save (`STORE_RECOUNTING` while usage
  is unknown, `RESOURCE_LIMIT` at full quota), it is logged (`READER_REPAIR_DEFERRED`) and made
  without the release, with the reason it would hold without U2; the release stays pending and
  shown, so none of these saves fails where it did not before. Startup's pause, a lease's expiry
  and a commit's quota pause are transitions out of `running` that are never refused for quota.
  Such a save that carries a pending release is not exempt, since the release grows the record
  beyond its reason, but its fallback is: so the transition always commits, and at a full quota
  the release stays pending, as before. This holds at exactly full quota, with no headroom for
  the fallback's own growth (pinned by the U2-path test at full quota). `returnLease` is not one
  of these transitions (§5.1). It is deferred, never lost (BB8's
  call 3 on Step 7): the record keeps its malformed value, so once room is freed the next save
  that carries it, the next point usage is known, or the reconciliation after a restart completes
  the release in one save, with the U2 reason, logged once. A C1 reason that U2 replaces is
  logged as `READER_REPLY_UNRECORDED`, with its `reply_code`, `field` and `value`.
- **C1, the cause sets at the reply boundary.** This is BB8 6678702125, ruling 4, and it
  replaces an earlier revision's rule that anything outside the sets was discarded. The
  scheduler checks every reply, a result marked `reply: true`, before it pauses the job
  (`reader_scheduler.js:pump`). Errors a Node sink threw, and bridge failures with no reply,
  are not replies, and C1 never checks them:
  - `DISCOVERY_UNAVAILABLE` needs an `error_cause` from the worker's six causes (every cause in
    the table above but `segment_corrupt`, which is the store's alone), and `RESOURCE_LIMIT` one
    from its ten. So a missing cause, an unknown one, the store's own cause, and a cause of
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
  raises (the record bound's 413, `reader_job_store.js:encoded`; `packReaderPages`,
  `reader_scheduler.js:packReaderPages`) carries no cause and pauses as today, through `sinkError`. A
  sink's `DISCOVERY_UNAVAILABLE` carries its own cause and log to the pause and logs no bad value.
  `store.pause` still refuses, whoever calls it, a `DISCOVERY_UNAVAILABLE` without a cause from
  its set, and a cause outside its code's set. `bad/reply_cause_invalid.json` holds a missing, an
  unknown and a cross-code cause for each of the two codes, the other faults, and controls that
  pause as before: valid replies, the sink errors and a bridge failure.

  **C1 is switched on in the same runtime train as the worker half, never before** (BB8
  6683944548, item 28). A worker of this head names no cause, so under C1 its every
  `RESOURCE_LIMIT` and `DISCOVERY_UNAVAILABLE` reply would pause as `READER_PROTOCOL`. The
  mechanism is one switch, and it is the same for both implementers:
  - R2's scheduler change carries C1 behind one constant in `reader_scheduler.js`, off. Off, the
    scheduler forwards every reply's `error_cause` and `error_log` to `store.pause` unchecked, and a
    pause `store.pause` refuses takes the fallback pause (above); on, it applies C1 to every reply.
    R2's tests run both settings against `bad/reply_cause_invalid.json` and
    `bad/reply_pause_refused.json`.
  - The #721 author's worker half names its causes in its message heads, as above, and is tested
    against that fixture's `reply` cases. The #721 author's change does not touch
    `reader_scheduler.js`.
  - R2 turns the constant on, in the runtime train that carries the worker half. No change turns
    it on without the worker half, and the worker half enters no train with it off.

  So the off setting exists only on branches and on `main` between the two merges, and never in a
  released image: the store half is released only in the train that carries the worker half
  (§9), and that train has the constant on. No image runs C1 against a worker that names no
  causes, and no image runs the worker half without C1. Both halves ride one runtime train, so a
  reply always comes from a worker of the scheduler's own image.

**There is no new job state.** Every image's `_reload` refuses an unknown state as
`STORAGE_CORRUPT` (`reader_job_store.js:_reload`), so adding a state would be a format break. A job refused with
`DISCOVERY_UNAVAILABLE` therefore stays `paused`. It holds one of its viewer's two slots
(`:READER_LIMITS`, `:create`, `:resume`), and a create with the same key returns it.

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
  already refuse at `analysis.py:AnalysisSession.__init__`. That matters because the job identity does not always
  change between images: with no baked build identity, the commit is null
  (`mcp/build_identity.js:releaseIdentity`) and the resource fingerprint falls back
  (`mcp/server_http.js:readerResourceFingerprint`); the scheduler acknowledges this at
  `reader_scheduler.js:createCatalogResolver`. New workers must refuse v1 cursors with `STALE_READING`;
  that check does not exist yet. There is no implicit migration.
- **The shared `CONTRACT_VERSION` does not move.** It is part of the identity
  (`contracts.py:semantic_identity`), the result schemas and the registry.
- **Release.** The store half and the worker half ride one runtime train; both change the
  fingerprint (`mcp/IMAGE_RELEASE.md`). The store half does nothing while frames carry no
  `discovery`. C1 is switched on in the same runtime train as the worker half, never before: R2
  turns its constant on in that train, and the #721 author's change does not touch
  `reader_scheduler.js` (§8). The off setting exists only on branches and on `main` between the
  merges, never in a released image. Jobs paused on the previous image refuse `STALE_READING` anyway
  (`reader_scheduler.js:pump`).
- **The entry codec (the #721 author's; BB8's review, should-fix 1; BB8's emit ruling, 19:40Z).**
  The codec raises a local error with a rule tag and never a public code; the enclosing
  operation maps it (§2.11). Before the worker half enters a train, the #721 author changes the
  handoff's codec so that:
  - `require_integer` raises `EntryError` with `rule == 'INTEGER_FIELD'` for an integer-only
    field outside the entries, never `'F1'`. The entry paths (`decode_entry`, `canonical_bytes`)
    keep `'F1'` for an integer inside an entry, so they hold an entry's integers to their own F1
    range check, not to `require_integer`. Required test: `require_integer(1.5)`,
    `require_integer(True)`, `require_integer(2 ** 53)` and `require_integer(-1, nonnegative=True)`
    each raise with `rule == 'INTEGER_FIELD'`; `decode_entry('[9007199254740992]')`,
    `canonical_bytes([2 ** 53])` and `canonical_bytes([-(2 ** 53)])` each still raise with
    `rule == 'F1'`;
  - `canonical_bytes` makes §2.11 (d)'s two passes, F1 before F2. Required test:
    `canonical_bytes('\ud800' + 'x' * 5000)`, `canonical_bytes(['x' * 5000, 1.5])` and
    `canonical_bytes([0] * 100000 + [1.5])` each raise with `rule == 'F1'`, the last with a traced
    peak under 128,000 bytes (the codec's early-encoder threshold), its input built before
    tracing; and `canonical_bytes(['x' * 5000])` raises with `rule == 'F2'`;
  - the codec counts the depth in its iterative parse and in its encoder's F1 walk, and an entry
    past `ENTRY_DEPTH` raises with `rule == 'F1'` and `what` `a nesting depth past ENTRY_DEPTH (8)`
    (BB8 6693502369, item 31). Required test, in Node and in Python:
    `decode_entry('[[[[[[[[[0]]]]]]]]]')` and `canonical_bytes([[[[[[[[[0]]]]]]]]])` each raise with
    `rule == 'F1'`; and an empty array nested 8 deep encodes, unchanged, to its 16 canonical
    bytes;
  - the codec's tests pin every `single_fault` case of `good/codec_error_mapping.json` to its tag
    and its `what`, its `cross_language.python` cause, its `persisted_bytes` case, and both
    `raw_transport` tests, peak memory measured; its multi-fault decode tests assert the code and
    that nothing is written, never the tag, and on the emit path the code is
    `INVARIANT_FAILURE` (§2.11 (d));
  - the worker maps the tags as §2.11 (b) and (c) give: F2 on a generated entry is
    `RESOURCE_LIMIT` (`discovery_entry_bytes`), F1 is `INVARIANT_FAILURE` with §3's message, and
    any tag on a loaded segment is F3, `chain_broken`;
  - the #721 author declares each log's entry shape and its largest depth (BB8 6693502369, item
    31): `ENTRY_DEPTH` is derived from that declaration (§2.1) and `MEMBERSHIP_BYTES` from the
    17 shapes capped at it (§6.11). Both are provisional until it exists, `ENTRY_DEPTH = 8` and
    `MEMBERSHIP_BYTES = 4194304`, and a declared depth of 5 or more re-derives both before the
    worker half joins a release train;
  - the declared entry shapes show that no caller number reaches an entry, which §3's
    classification of a generated F1 as an engine defect assumes and this contract has not
    traced (`declaration_set` admits any finite JSON number, `reader_job_store.js:jsonValue`).
- **The store's byte count (R2).** Each log's state carries `bytes`, a commit adds its seals'
  entry bytes, and W7 holds `MEMBERSHIP_BYTES` from it; R2 checks it at a full read and R5 at a
  lease's walk, and the worker's R3 at its load, in the store half's runtime train (§2.7, §4, §5;
  BB8 6693502369). `record.discovery` has not shipped, so the member is no format break.
- **The store's segment decode (R2).** The store decodes a segment's verified bytes with a fatal
  UTF-8 decoder before it parses them, so invalid UTF-8 is F3 in Node as in Python (§2.11), in
  the store half's runtime train. It never decodes them with `Buffer.toString` or `JSON.parse`
  on the buffer, and its tests include §2.11's read-back of a lone 0xFF byte, which a replacing decode fails (BB8, 21:31Z).
- **Admission refuses a lone surrogate (R2).** `validateRequest` and the scheduler's check before
  `workerPayload` refuse a declaration set holding text that is not well-formed Unicode, as
  `INVALID_DECLARATION` (400), in the store half's runtime train, which carries the worker half
  (§2.11). BB8's guard test and his stored-request case (21:31Z) are R2's.
- **Proof run (R2).** It runs on a fresh disposable store with `READER_STORE_GZIP=1`, on the
  qualified image. It passes when the run completes, every lease's first commit lands within
  30 s of the lease start, discovery is about 1.6 MB plain and 0.2 MB stored, the store is at
  or below 40 MiB, and frames and the record stay within their derived bounds (§3). It
  records the restart count, each restart's cost, the segments each lease's walk read and
  statted and the time each walk took, any reconciliation and its time, `row_seen`'s size in
  both phases, the four membership logs' totals against `MEMBERSHIP_ENTRIES` and
  `MEMBERSHIP_BYTES`, worker memory in
  the alternate phase, and the finish lease's time: its full `alt_cells` load, option 2's read
  of the evidence and `_domain`'s enumeration, against the lease (§6.11). If a lease's first
  commit misses 30 s on the qualified image, `MEMBERSHIP_ENTRIES` and `MEMBERSHIP_BYTES` are
  re-derived from that measurement, never waived (BB8 6682942783). Before the proof run, the
  worker half measures its own load's per-entry and per-byte rates, and the caps are re-derived
  if either, scaled by 3, is above §6.11's (§6.11). It is the completed run that Phase B needs
  (`mcp/READER_RUNTIME.md`).

## 10. Measured on #656, not bounds

All of these were measured read-only on the #656 run store, or computed from measured entry
sizes. Times are light host / loaded host. None is a bound; the bounds are in §3.

| Figure | #656 value | Kind |
| --- | --- | --- |
| `seen` | 19,880 entries, 80 segments, 1.34 MB with envelopes, about 0.15 MB gzip | measured |
| `seen` key | 65.3 B mean, 1.6 B per primary pair; 2.45% of pairs touch a varying word | measured |
| `variants` | 165 descriptors of about 240 B (211 B measured for `c[2]` alone), 3 segments, 0.04 MB | measured |
| `alt_cells` | 12,105 entries of 20.45 B, 16 segments, 0.25 MB | measured |
| `seen` plus `variants` | 20,045 entries, Whitman's one measured membership figure. Against `MEMBERSHIP_ENTRIES` (65,536) the cap leaves 45,491 entries of headroom for the alternate phase, not a measured margin (§6.11) | measured; the headroom is computed |
| `alt_seen` | 0 entries: no within-line alternate pair, 6,250 line pairs each one contiguous run, at most 2 pairs per line pair | measured (BB8 1, 3PO 6) |
| primary rows | 1,560 rows, no repeated left-span index | measured (3PO 1) |
| `row_seen` | not measured on #656. "Live at only 6 of 42 boundaries", cited in BB8 6682942783, is 3PO's two-line synthetic fixture, not Whitman (BB8 6683944548) | the proof run records its size |
| segment envelope | about 550 B | measured |
| discovery total | about 1.64 MB plain, about 0.2 MB gzip | computed |
| per lease | walk about 10 ms; load 20,045 entries × 30.4 µs = 0.6 / 1.5 s; recompute 0.9 / 2.4 s; construct 6.4 / 15.2 s; about 8 / 19 s in all | measured |
| loaded / light | construct 2.375, load 2.5, recompute 2.67 | computed from the measured times; §6.11 rounds the load's 2.5 up to 3 |
| load per byte | 138.8 ns per entry byte at 4,096-byte entries: the worst median of five loads of 8 MiB (2,048 entries, 512 segments), over 17 entry shapes, each capped at `ENTRY_DEPTH` (8) (BB8 6693502369): an ASCII string, a 3-byte UTF-8 string, one-character escapes, empty strings, one-digit integers, one-element arrays, empty arrays, empty arrays nested 2 and 4 deep, empty arrays nested 8, 16, 64, 256 and 1,024 deep, each capped at 7 inside the entry's own array, `0` nested 2 deep and `0` nested 8 deep, capped at 7, and one array nested 2,040 deep, capped at 7, each stored plain and gzipped, in two passes. These are 17 named shapes, 13 distinct at this cap: capped at 7, the empty arrays nested 8, 16, 64, 256 and 1,024 deep build the same entry, so 13 distinct loads stand behind the rate (BB8 6699352254). The worst median is `0` nested 7 deep, gzipped; the worst single load 151.0 ns. The five shapes of `465582a78` peak at 101.9 ns in the same passes, so nesting to the bound raises the rate about 1.4-fold. The previous revision's 251.4 ns came from the 2,040-deep array, gzipped, about 2.3-fold the 107.3 ns its five shapes peaked at on that host (BB8 6693638249). The load is the worker's page reader (`worker.read_page_object`), F3, R2 and F5, and the membership set keyed by each entry's canonical bytes, computed once for F5 (§5.2). Measured on a 4-CPU Xeon at 2.1 GHz under Python 3.13, at one-minute load averages of 3.7 to 4.4, not on #656's light host | measured (BB8 6688972927, 6693502369); the rows are `good/membership_load_measurement.json`; §6.11 scales it by 3 |
| load per byte, deeper bounds | the same load, in one pass, with the nested shapes capped at 16 and at 64 instead: worst medians 153.5 and 169.9 ns, so on these measurements a re-derivation at either would keep the cap at 4 MiB, under the 184.4 ns at which it stops fitting (§6.11) | measured beside the row above, in the same fixture; for BB8's ruling on `ENTRY_DEPTH` (§12, item 31) |
| keyed through `canonical_json` | 411 to 703 ns per entry byte on value-dense 4,096-byte entries (one-digit integers, one-element and empty arrays), five to nine times the single pass on the same shapes; 12 to 18 ns on long strings. The same load path and host as the row above, keying each entry by `canonical_json` instead | measured; outside the derivation, which §2.1 and §5.2 forbid |
| rebuilt load at #656's entry size | 20,045 ASCII entries of 65 bytes: about 3.5 µs per entry plain and 4.1 µs gzipped, against a0's 30.4 µs on the light host; the gap is not explained (§6.11) | measured on the same host as the two rows above |
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
| 19 | BB8 (a) (6678599629) | the store's walk is incremental: it stats every segment and reads and verifies only those appended since a persisted verified head; a full read happens in exactly three places (amended by row 46: two, the store's, plus the worker's complete verified load) | §1, §2.7 `verified`, §4, §5.1, §7.3, §7.4 | `good/lease_incremental_walk.json`, `good/lease_after_refused_commit.json`, `bad/verified_ahead_of_head.json` |
| 20 | BB8 (a) | `alt_seen` gets its own cap, derived from the 30 s first-commit budget on a loaded host; passing it is `RESOURCE_LIMIT`, cause `discovery_alt_seen` (widened to the four membership logs by row 33) | §3, §4 W7, §6.4, §6.11, §8 | `bad/membership_over_cap.json`; the §6.11 derivation test |
| 21 | BB8 (b) | confirmed: `row_seen` reset and compaction, with all four §6.2 tests required; `CURSOR_BYTES`, `CONTINUATION_BYTES` and `WITNESS_FIELDS`, with `INVARIANT_FAILURE` on the worker for the byte bounds; `methods[*]` holds no terminal input; the closed cause sets | §2.8, §3, §6.2, §8 | `good/lease_payload_summary_paths.json`; #721: the four §6.2 tests |
| 22 | BB8 (b) | the terminal suffix is contiguous and belongs to its method alone; a non-terminal record after a suffix record is an inserted record | §6.9 | `bad/terminal_suffix_not_contiguous.json`, `bad/witness_mismatch.json` |
| 23 | BB8 (b) | reconciliation pauses a released queued job, with its reason rendered from the cause, and `_dispatchable` skips it | §2.7, §7.4, §8 U2 | `good/unavailable_pause_reason.json` |
| 24 | BB8 (b) | a `DISCOVERY_UNAVAILABLE` pause releases the logs; its reason keeps the released log names and their heads, and committed evidence stays readable | §2.7, §8 U1 and U2 | `good/unavailable_pause_reason.json` |
| 25 | 3PO 6678688668 recommendation 1; BB8 6678702125 ruling 1 | a `row_seen` compaction is atomic within one frame; when the frame lacks room, the step ends at the safe point before the boundary, and the compaction runs first in the next frame | §1, §2.6, §6.2 | `good/row_seen_compaction_next_frame.json` |
| 26 | 3PO recommendation 2; BB8 ruling 2 | `CURSOR_BYTES` is `INVARIANT_FAILURE` only once derived from the constants, with a max-cursor test; a part that grows with the input gets its own `RESOURCE_LIMIT` cause (for the refusal, revised by row 42: it does not grow with the input) | §2.8, §3, §3.1, §4 W4, §8 | `bad/cursor_over_bound.json` |
| 27 | 3PO recommendation 3; BB8 ruling 3 | the terminal suffix stays checked by `resolve_detail_records`' own rules, at a resume and at every read; a part whose parent is not the method's `method_result` is an inserted record | §1, §6.9 | `bad/terminal_suffix_resume_faults.json`, `bad/terminal_suffix_not_contiguous.json` |
| 28 | 3PO recommendation 4; BB8 ruling 4 | a missing, unknown or cross-code cause is `READER_PROTOCOL`, naming the bad cause; it is never discarded | §8 C1 | `bad/reply_cause_invalid.json` |
| 29 | 3PO recommendation 5; BB8 ruling 5 | the release save is provably no larger, each released entry collapsed to `{log, head}`; the fence and the attempt counter are kept; a live lease on another instance cannot commit | §7.4, §8 U1 | `good/release_fencing.json`; the §7.4 property test |
| 30 | 3PO's §6.8 mismatch; BB8 ruling 6 | an outside-domain shared-sound binding moves no domain tally, and `candidates` increments as today | §6.7, §6.8 | #721 tick test |
| 31 | 3PO 6678848728 | the generic resolver accepts 9 wrong-method parents and parts and inserted non-terminal records; the worker's suffix-membership check refuses each, as a required acceptance case | §6.9 | `bad/terminal_suffix_resume_faults.json`, its 9 `accepts` cases |
| 32 | BB8 6678856548 | the suffix-membership check is separate and runs before resolving; the 9, the 15 and the 3 byte-identical valid restores are in the worker's acceptance list; resolver success never counts as suffix validation; membership is `method_id` alone | §6.9 | `bad/terminal_suffix_resume_faults.json`, each case derived from its split's durable prefix, and its five controls |
| 33 | BB8 6681838131 item 18; 3PO 6681823180 (d) | one combined cap over `seen`, `variants`, `row_seen` and `alt_seen`, with a named cause per log; the cap is never a whole lease's qualification (its every-term factor is retracted by row 40) | §1, §3, §4 W7, §6.1, §6.4, §6.11, §8 | `bad/membership_over_cap.json`; the §6.11 derivation test |
| 34 | BB8 6681838131 item 18; 3PO 6681823180 (c) | `row_seen` in the alternate phase is not assumed empty: it is in the shared budget, and a restart mid-row inside the alternate phase is tested | §2.3, §6.2 | #721: a restart mid-row in the alternate phase |
| 35 | BB8 6681838131 item 18; 3PO 6681823180 (d) | finish work is outside the first-commit criterion and open, and the proof run measures it; reconciliation inside a lease is an accepted, explicit exclusion | §6.11, §9 | proof run |
| 36 | BB8 6681838131 item 16; 3PO 6681823180 (e) | at lease time, corruption is `STORAGE_CORRUPT` with no save and no release; at reconciliation a byte mismatch is `segment_corrupt`, logged at error level and contained to the job; `chain_broken` is structural only; every other object keeps `STORAGE_CORRUPT` | §2.7, §5.1, §7.4, §8 | `bad/segment_corrupt_at_reconciliation.json`, `bad/verified_ahead_of_head.json` |
| 37 | BB8 6681838131; 3PO 6681823180 (a) | a thrown save is an unknown outcome: the address lists are rebuilt from the durable record head before use | §4, §5.1, §7.3 | `good/thrown_save_outcome_unknown.json` |
| 38 | BB8 6681838131; 3PO 6681823180 (b) | reconciliation follows any foreign writer, not only an older image | §5.1, §6.11, §7.4 | — |
| 39 | BB8 6681838131 | items 15, 17, 19 and 20: no semantic objection | §12 | — |
| 40 | BB8 6682942783 | option (b): only the per-entry load rate is scaled (30.4 µs × 3); construct, recompute and the walk enter at their loaded-host measurements; 90,975 entries with the margin, rounded down to `MEMBERSHIP_ENTRIES = 65536` (as row 46 states it), combined, with a cause per log; the proof run's gates decide whether #656 fits, and a missed 30 s re-derives the cap, never waives it; 16,384 retracted (item 25); confirmed as folded in 6684866461 | §3, §6.11, §9, §10, §12 | `bad/membership_over_cap.json`; the §6.11 derivation test |
| 41 | BB8 6683944548 | items 21 (in method), 22, 23, 26 and 28 confirmed (item 25 is ruled in 6682942783, row 40, and confirmed as folded in 6684866461); C1 is switched on in the same runtime train as the worker half, never before, by one switch; 29 stays open | §2.6, §3.1, §5.1, §8 C1, §9, §12 | `bad/reply_cause_invalid.json`, `bad/cursor_over_bound.json`, `bad/segment_corrupt_at_reconciliation.json` |
| 42 | BB8 6684866461; 3PO 6684847656 | item 27 revised: the refusal stays in the cursor; `REFUSAL_BYTES = 543` is derived from the adapter's construction, conservatively (row 45), and passing it is `INVARIANT_FAILURE`; guard tests: 4 KiB and 64 KiB declared labels complete as today, continuing and restored, and the validator builds the largest refusal; `CURSOR_BYTES` re-derived with that refusal (99,141 bytes plus an allowance of 31,931, bound 131,072); `RL.realise`'s 4,607 detail bytes are context, not an adapter regression | §2.8, §3, §3.1, §3.2, §4 W4, §8 | `good/refusal_construction.json`, `bad/cursor_over_bound.json` |
| 43 | BB8 6683944548, item 24; 3PO 6684847656 | item 24 is 3PO's: the post-terminal insertion test stays separate from the contribution-prefix case | §6.9 | `bad/terminal_suffix_not_contiguous.json`, `bad/terminal_suffix_resume_faults.json` |
| 44 | BB8 6683944548 | correction: "`row_seen` live at 6 of 42 boundaries" is 3PO's two-line synthetic fixture, not Whitman; Whitman's one measured figure is 20,045 `seen` and `variants` entries, and the 45,491 left under the cap are headroom, not a measured margin | §6.11, §10, §12 | the proof run |
| 45 | 3PO 6684968306; the review of `2a610d053` | reconciled: `REFUSAL_BYTES = 543` is the largest construction in the call closure, which the dispatch never builds, kept as a conservative bound; the largest refusal the dispatch can build is 336 bytes, schema by schema; the independent figures (386, 339) join parts of different schemas; the validator lists every refusal name, `_Refused` use and refusal copy; the worker's label test covers every declaration that takes a source; `CURSOR_BYTES` covers the cursor without `discovery` and `continuation`, 99,141 bytes plus an allowance of 31,931, and the whole cursor is at most 235,483 bytes; W4 holds the cursor's numbers to integers from 0 to 2⁵³ − 1 and `discovery` to §2.8's keys; R2 turns C1's constant on in the worker half's train, and it is never off in a released image | §2.8, §3, §3.1, §3.2, §4 W4, §8 C1, §9 | `good/refusal_construction.json`, `bad/cursor_over_bound.json` |
| 46 | BB8 6688972927 | `cursor_refusal_bytes` retired, accepted, on the condition that an `INVARIANT_FAILURE` message names the bound it passed; (1) the cap is stated as 90,975 with the margin, rounded down to 65,536, with no #656 entry count as a term; (2) `MEMBERSHIP_BYTES`, from a per-byte rate measured at 4,096-byte entries, the worst of 17 shapes, scaled by 3, with the same causes (2 MiB then; re-derived by row 48); the caps bound the load and the walk, construct and recompute are measured, and the figures at the caps are a derivation; (3) an oversized compaction defers, and §6.2 wins over §3's `FRAME_SEALS` row; (4) a full read is the store's alone (reconciliation, `resume()`), and the worker's finish-time `alt_cells` load is a complete verified load, `STORAGE_CORRUPT` on F6 with no release; (5)–(10) the walk's two caps, `chain_broken` among the pause's worker causes, the GC sentence, four §6.2 tests everywhere, `discovery_row_seen`'s message, item 25's attribution; item 29 stays open | §1, §3, §5.1, §5.2, §6.2, §6.11, §7.2, §8, §10, §11, §12 | `bad/cursor_over_bound.json`; the §6.11 derivation and byte tests |
| 47 | BB8, #721 items 2–3 (accepted by R2); BB8's #721 codec review, should-fix 1; BB8's emit-precedence ruling (19:40Z) | the codec raises a local error with a rule tag and the enclosing operation maps it, never the codec; (a) a submitted frame's F1 or F2 is `READER_PROTOCOL`, its integer fields W1 and W4, and a frame that is not JSON is the step channel's failure; (b) a generated entry's F2 is `RESOURCE_LIMIT` (`discovery_entry_bytes`) and its F1 `INVARIANT_FAILURE`, its message naming the rule; (c) a persisted segment's bad content is F3, `segment_corrupt` stays F6's and the store's, a failed inflation F6; the `1.0` divergence, one pin per side; invalid UTF-8 in a segment F3 in both languages; precedence F1 before F2 on the worker's emit, unpinned elsewhere; F2 on the canonical form, the raw input bounded by the enclosing reader; `INTEGER_FIELD`; a lone surrogate refused at admission, before any lease | §2.5, §2.11, §3, §4, §5.1, §5.2, §8, §9, §13 | `good/codec_error_mapping.json`, `bad/float_entry.json`; the §2.11 tests |
| 48 | BB8 6693502369 (items 30 and 31, R2's questions of 6693449409); BB8's review 6693638249, nits 1–4 | (30) each log's head and verified state carry `bytes`, the sum of its sealed entries' canonical bytes, added to by each seal; W7 holds `MEMBERSHIP_BYTES` from it; it is verified where it is read: R2 at a full read (`chain_broken`), R5 at a lease's walk (`STORAGE_CORRUPT`), R3 at the worker's load (`cursor_disagrees`); (31) F1 bounds the depth by `ENTRY_DEPTH`, the smallest power of two at least twice the largest declared depth, at least 8 and at most 64, provisionally 8 until the #721 author declares the entry shapes; past it `INVARIANT_FAILURE` on the worker's emit, `READER_PROTOCOL` at the store, F3 on read-back; `MEMBERSHIP_BYTES = 4194304` re-derived over the 17 shapes capped at it, provisional with it; the nits: no #656 entry count is a term, each log's section names both caps, the counts use the unrounded terms but for the per-byte rate, as printed, and 2.3-fold is against 107.3 ns; BB8's 21:31Z confirmations: invalid UTF-8 in a segment F3 in both languages, never `Buffer.toString`, and admission's stored-request case | §1, §2.1, §2.3, §2.7, §2.10, §2.11, §3, §4, §5.1, §5.2, §6.1, §6.2, §6.4, §6.11, §8, §9, §10, §12, §13 | `bad/entry_over_depth.json`, `bad/head_bytes_disagree.json`, `bad/verified_bytes_disagree.json`, `bad/summary_bytes_disagree.json`, `bad/membership_over_cap.json`, `bad/verified_bytes_ahead.json`, `good/codec_error_mapping.json`, `good/membership_load_measurement.json`; the §6.11 derivation and byte tests |
| 49 | BB8 6699352254 (review of `a12c35b4d`, rulings 1–2) | (1) `MEMBERSHIP_BYTES = 4194304` stands, provisional with `ENTRY_DEPTH`; power-of-two rounding is accepted; the per-byte rate is re-measured on a quiet host before the proof run, and the cap is re-derived, not inherited, if `ENTRY_DEPTH` reaches 64; (2) the stored-request check stays where §2.11 has it, before `workerPayload`, never in `this.store.lease()`; and the 17 named shapes are 13 distinct loads at this cap | §2.11, §6.11, §10, §12 | `good/membership_load_measurement.json`, `good/codec_error_mapping.json`; the §6.11 derivation and the claim tests |
| 50 | BB8 6700200435 (all seven recommendations accepted, with conditions) | (3) the scheduler's fallback pause when `store.pause` refuses: one `READER_PROTOCOL` pause, no cause, no release, none for `STALE_ATTEMPT`, the same under C1 on and off, pinned by a fixture; (4) a malformed `record.discovery` shows as `paused` with the U2 `chain_broken` reason from the reconciliation that finds it, saved at once when admitted and otherwise pending until usage is known; (7) the store stats a segment before reading it, and a stored size over 2 MiB is F6, `segment_corrupt` at a full read, without a read | §2.5, §2.7, §2.11, §5.1, §7.4, §8, §12, §13 | `bad/reply_pause_refused.json`, `bad/malformed_record_discovery.json`, `bad/segment_oversized.json` |
| 51 | BB8 6709891376 (rulings 1–3 on R2's Step 6 questions) | (1) D1 as built: a `verified` that does not name exactly the logs `logs` names is not of §2.7's shape, so the value is malformed, and a release that could grow never takes a pending path of its own; (2) the `chain_broken` cause row names the malformed record in its Rule and Log columns, and the module's test holds that row to `DISCOVERY_CAUSES` through a closed list of exactly one exception; (3) a new rule, M1: a `record.discovery` that is present, not `null`, and not of §2.7's shape is malformed, released `chain_broken` with log `null`, never dispatched and never a GC root | §2.7, §7.4, §8, §13 | `bad/malformed_record_discovery.json`; the store tests; `test_reader_discovery`'s cause-table test |
| 52 | BB8 6712649145 (review of `eb3fc2fff`, pins 1 and 2; call 3 on Step 7) | (1) a U2 save that carries a pending malformed release and is refused saves without it only if the release is deferred, not lost: once room is freed, the next `lease()` with usage known, the reconciliation after a restart, or the next U2 save that carries it completes the release in one save, with the U2 reason and `READER_DISCOVERY_RELEASED` logged once, as every release is; (2) the store tests pin the case and control names of `bad/malformed_record_discovery.json` as the fixtures suite does | §7.4, §8 | the store tests |
| 53 | #656 Step 9 (design v2, v1 Step 4) | W4's shape and bound checks, made only when the frame carries `discovery`: the cursor's `contract_version` 2; exact keys on `cursor.discovery`, its logs, `inventory`, `groups` and `groups.current`; the groups' line pairs, order and bounds, and `through` never moving back within the epoch; the inventory fixed once non-null within the epoch; the witness of the frame's epoch with its fields within `WITNESS_FIELDS`; `continuation`, each refusal and the cursor without `discovery` and `continuation` within their byte bounds, measured by the store's sorted `canonical()`; no terminal input in `methods[*]`, each member checked whatever `methods` is, as the validator walks it; every cursor number outside the entries and `continuation` an integer from 0 to 2⁵³ − 1 | §2.8, §3, §3.1, §3.2, §4 W4 | `bad/cursor_over_bound.json` (built from `builders.mjs` in the store tests too), `good/codec_error_mapping.json`'s cursor integer fields, `good/witness_cursor_option2.json`; the store tests |
| 54 | BB8 6714569541 (review of `c9e44f7ba`, on Step 8); BB8's rulings on R2's Step 8 calls (23:20Z) | (D-1) `complete()` completes a pending malformed release in its save, and is not its refuser; (c21) no new bound on the declaration set: it is bounded at admission by `HTTP_REQUEST_BYTES` (4.5 MiB, `mcp/payload_limits.js`); (Q5) `complete()` after a saved release logs the trace its null save erases, once, when that save lands; the module's comment on an entry breaking both F1 and F2 says it is tagged F1 | §3, §7.2, §7.4 | the store tests (Q5) |
| 55 | Review of `b3b2a64f5` (#656 Step 9) | W4 checks the cursor's `contract_version` and every member of `methods` as the validator does; Q5 logs a trace once, with `outcome: "unknown"`, when the completing save throws without a status; the module's comment on an entry breaking both F1 and F2 says Node's own tag is not pinned | §2.11, §4 W4, §7.2 | the store tests |
| 56 | BB8 6715584092 (rulings on R2's Step 9 calls) | (Q5) the trace line's level follows its cause, error for `segment_corrupt` and warn otherwise, as the release line's does; (witness) a non-null `witness` holds exactly §2.8's six keys, checked under W4 by Node and the validator alike; (F-6) within an epoch the current group never moves back, even with `through` null: the frame's `current.lines`, or its `through` when it has no current group, is at or after the previous `current.lines` | §2.8, §4 W4, §7.2 | `bad/current_moved_back.json` and its controls, on both sides; the store tests (Q5, W4); the validator's W4 witness test |
| 57 | BB8 6715909159 (review of `11c186ee2`, #656 Step 9) | no defect; the survivor pinned: `complete()` of a job whose release was saved, whose completing save throws with a status (409, and 413), logs no `READER_DISCOVERY_TRACE_ERASED` line, neither `unknown` nor `saved`, keeps the trace in the record and on disk, and leaves the store serving | §7.2 | the store tests (Q5) |
| 58 | BB8 6710235213 (review of Step 6; owed before Step 10) | the GC-races-release interleaving: two instances on one root, a release on one between the other's mark slices, between its mark and its sweep, and during its sweep; no segment a surviving record references is swept, a collection marked before the release sweeps nothing, a release refused `STORE_BUSY` writes nothing and lands when retried, and the next collection reclaims the released segments with the trace kept | §7.3 | the store tests (GC races a release) |
| 59 | #656 Step 10 (design v2; v1 Step 6) | the lease's walk: `workerPayload` runs under the writer lock; a pending release, then `unavailable`, refuse first and walk nothing; R5 over every log before anything is read, a non-null head with no address list included; the verified segments are stat'ed and only those appended since are read (F6, F3, R2, R5's junction); every failure is `STORAGE_CORRUPT` 503 with nothing released or saved; one verified save when something was read, skipped on `STORE_RECOUNTING` or `RESOURCE_LIMIT`; the payload carries `summary` and `paths` and never `verified` or `unavailable`, and the scheduler passes it only when it is not `null` | §2.10, §5.1, §6.9 | `good/lease_incremental_walk.json` (`expect.lease`, `next_lease`), `good/lease_after_refused_commit.json`, `good/lease_payload_summary_paths.json`, `bad/verified_ahead_of_head.json`, `bad/verified_bytes_ahead.json`, `bad/verified_bytes_disagree.json`, `bad/head_bytes_disagree.json` (`expect.lease`), `bad/entry_over_depth.json` (`read_back`), `bad/segment_corrupt_at_reconciliation.json` (`expect.lease`), `bad/missing_segment.json`; the store tests (lease walk) |
| 60 | Review of `c6e57967c` (#656 Step 10 and its follow-ups) | the previous `current.lines` bounds the frame within an epoch whatever the previous `through` was, on both sides; the walk's F3 holds a listed segment to the record's own epoch; a one-segment non-null head with no list is R5; a verified address that is not a regular file, or is over the object bound, is F6 at its stat, never read, as the read's own stat holds it; `workerPayload` is refused `STORE_BUSY` while another process holds the lock, with or without discovery; a seal another instance commits during a collection is kept by its abandon | §4 W4, §5.1, §7.3 | `bad/current_moved_back.json`; the store tests (W4, lease walk, GC races a release); the validator's F-6 test |
| 61 | BB8 6717719856 (calls on R2's Step 10 questions) | (F5) a `STORE_BUSY` at `workerPayload` is not paused: the lease ends, the job goes back to `queued` in its place with no reason and its attempt uncounted, a cancel, a release (U2) and a full queue kept as a pause keeps them; no retry loop in `workerPayload`, the return tried once per pump while the lock stays held; a `STORE_BUSY` from any other call in the lease is paused as before; (F-6) narrowed, on both sides, to frames where the record's cursor and the frame both have a current group, the frame's `current.lines` at or after the previous one; a group dropped without retiring and a `through` behind the previous group accepted until 3PO's #721 confirmation, kept as accepted controls to refuse if it widens; (F7) a pending malformed release refuses `commitCheckpoint`, `workerPayload` and `resume` with `DISCOVERY_UNAVAILABLE`, cause `chain_broken`, log `null`, exactly as after its save, never `STORAGE_CORRUPT`: the contract wins over the design text | §4 W4, §5.1, §7.4, §8 | `bad/current_moved_back.json` and its controls, on both sides; the store tests (F5, W4); the validator's F-6 test |
| 62 | BB8 6718090169 (review of `59a917a62`) | no defect; each of the two `digest_before !== at.digest` clauses is killed on its own: the lease walk's by the R5 clause test's junction-digest case, and the full read's, which no test killed, by a new test, a segment whose `digest_before` does not link (the oldest's not d0, or the second's not the first's `digest_after`) with its own F5 and the record's totals intact, chain_broken by R2, and its control; `test_reader_job_store` keeps its coverage of the witness's exact keys and of F-6 | §5.1, §7.4 | the store tests (reconciliation, lease walk, W4) |
| 63 | #656 Step 11 (design v2; v1 Step 8) | `resume()`'s full read: a pending release, then `unavailable`, refuse `DISCOVERY_UNAVAILABLE` first, with its cause and log and nothing read, before the identity and state checks; a paused or cancelled job's live discovery is then read in full, every log from its head, `verified` and the lists unused, before the queue checks; a failure releases the job in one save from the record, not the control, so the refused control writes no receipt, logs the release (error level for `segment_corrupt`) and refuses naming the cause and the log; a stat or read error without a status (EACCES, EIO, ENOTDIR) releases nothing and stops the store; a pass installs the lists read, and resume's own save carries `verified` at the heads; a record with no discovery resumes exactly as before | §5.1, §7.4, §8 | `bad/verified_ahead_of_head.json`, `bad/verified_bytes_ahead.json` and `bad/verified_bytes_disagree.json` (`expect.resume`), `bad/missing_segment.json`, `bad/segment_corrupt_at_reconciliation.json` and `bad/head_bytes_disagree.json` (`expect.resume`); the store tests (resume) |
| 64 | Review of `4f96eff9f` (#656 Steps 10 and 11) | (F5) a lease that expires while the foreign lock is held is not returned: the return is `STALE_ATTEMPT`, which settles the busy lease, the job is paused `INTERRUPTED` with its attempt counted and the scheduler leases the next job; a return refused for any other reason is logged and settles it too, never tried again, the lease's expiry the backstop; the busy path's next pump comes one poll interval later, never at once; a job whose malformed release is still pending is returned as U2 holds it, the release written in that save and logged once; a returned cancel is never to be requeued; a returned lease's attempt number is the next lease's again, which is benign | §5.1 | the store tests (F5) |
| 65 | BB8 08:46Z (merge of main into the branch, main's #820 `f97b6901d`) | every store call in the scheduler's pump sits inside a try, F5's lease return included: a refusal at dispatch (a `STORE_BUSY` from `listQueued()` or `lease()` in a pump entered with a busy lease, or a return that throws) is caught, logged `[reader] dispatch refused:` and retried with backoff, never an unhandled rejection, and the busy lease is tried again first; `later()` arms its pump through the caught timer; `lease()` passes over a job that does not fit, its pending-release and released checks kept for `lease(id)`; the three transitions out of `running` that are never refused for quota stay exempt through U2, except a save that carries a pending release, whose fallback is exempt, so at a full quota the release stays pending | §5.1, §7.4, §8 | the store tests (merged pump; F5; U2 path) |
| 66 | BB8 6719406992 (calls 2, 5, 6, 7 and 8 on R2's Step 11 questions) and BB8's 09:16Z review of `34833d71a` (pins a, b and c) | (2) a cancel that lands through `returnLease` stores reason `CANCELLED`, never `STORE_BUSY`, with queue room, without it and on a pending release's fallback, the release's reason standing where U2 applies; (a) every path through `returnLease` clears `cancel_requested`, in the record and in the job view; (5, c) the lists `resume()`'s full read installs stand after a `QUEUE_FULL`, and a save that fails discards them, leaving the job's lists as they were before the resume (a save without a status then drops every list), killed behaviourally for both "installed after the save" and "kept after a failed save"; (b) the lists read replace the job's lists, so a log absent from the full read does not survive (the review's M15); (6) `resume()`'s verified save, refused `STORE_RECOUNTING` or `RESOURCE_LIMIT`, is made once more without the advance, and a second refusal is thrown; (7) a `DISCOVERY_UNAVAILABLE` refusal names its `cause` and `log` in the route's 409 error body, on the Site bridge and `/library/v1`, nothing else added; (8) every fixture that holds an `identity_hash` names the identity behind it, the validator checks each hash, and the resume tests mock no digest | §5.1, §7.4, §8, §13 | every fixture that holds an `identity_hash` (`identity`); the store tests (F5 returnLease; resume); the route tests (409 body); the validator's identity test |
| 67 | Review of `78fc83df1` (the merge of main and the Step 11 calls) | (F1) the fallback of a transition that carries a pending release is exempt at exactly full quota, with no headroom: a lease's expiry, a commit's quota pause and startup's pause each commit without the release, which stays pending; (F2) `resume()` retries its verified save only for a room refusal, the code and the status together (`roomRefusal`), never for another 503 or 507, and a real quota refusal or an unknown usage is retried without the advance and lands; (F3) main's timer rules: a kick cuts a retry's backoff short but not the capacity poll, and busy capacity polls at `pollMs` without backing off; (F4) a return that throws a value with no code is a failed return at both of its calls, never an escape from the pump's catch; (F5) `returnLease` is not exempt from quota: at exactly full quota a return that adds a reason to a record past its reservation is refused and the lease's expiry ends the job, its attempt counted; §7.4 says a refusal inside `lease()` holds up that job and every job behind it | §5.1, §7.4, §8 | the store tests (U2 path at full quota; resume retry; F5); the client tests (scheduler timers) |

## 12. Rulings on the items added for confirmation

An earlier revision listed items 1–14 for confirmation. BB8 ruled on every one of them
(6678599629). BB8 has no semantic objection to the structural items (2–4, 6, 10 and 12), and
the cursor fields are 3PO's to confirm. BB8 then ruled on 3PO's amendments to items 1, 5, 7–9
and 11, and on §6.8's wording (6678702125), made item 11's suffix check an explicit acceptance
requirement (6678856548), ruled on items 15–20 (6681838131), and corrected the budget and ruled
item 25 (6682942783), which it confirmed as folded (6684866461). BB8 then ruled items 21–23, 26
and 28 (6683944548) and revised its ruling on item 27 (6684866461). Item 24 is 3PO's, with BB8's
agreement. BB8's completeness ruling (6688972927) amends items 13, 14 and 25 and the full-read
sites, and closes the contract's semantics but for item 29. Each ruling is marked on its item
below. Only item 29 is open, for the proof run. Items 30 and 31, R2's two questions of
6693449409, are ruled (BB8 6693502369: yes to both) and folded; item 31's `ENTRY_DEPTH`, and
`MEMBERSHIP_BYTES` with it, are provisional until the #721 author declares the entry shapes, and
those values are open for BB8. BB8 accepts `MEMBERSHIP_BYTES` at 4 MiB, provisional with
`ENTRY_DEPTH`, on two conditions (6699352254, ruling 1; item 31).

1. **Ruled: confirmed** (BB8 6678599629). `row_seen`'s reset at row boundaries and its
   compaction (§6.2), and the frame's `resets` field. The compaction decision depends only on
   the traversal, keeps the live keys in their first-insertion order and leaves membership
   unchanged, so a restart compacts at the same boundary and seals the same bytes. All four §6.2
   tests are required (BB8 6688972927: four everywhere). **Amended** (BB8 6678702125, ruling 1): a compaction is atomic within
   one frame; when the frame lacks room, the step ends before the boundary, and the compaction
   runs first in the next frame (§6.2, `good/row_seen_compaction_next_frame.json`).
2. **Ruled: no semantic objection** (BB8 6678599629). W6, append-only tails.
3. **Ruled: no semantic objection** (BB8 6678599629). `CHAIN_SEGMENTS = 2048` per chain. The
   incremental walk's stat term is bounded by it, five chains or 10,240 stats; its read term is
   bounded by `FRAME_SEALS` segments per frame committed since the verified head (§5.1, §6.11;
   BB8 6688972927). A full read of five chains happens only in the store's two full-read places
   (item 14).
4. **Ruled: no semantic objection** (BB8 6678599629). The group bound (`GROUP_KEYS = 32`,
   `GROUP_BYTES = 8192`), with spill to `alt_seen`, which counts toward the membership cap
   (items 13 and 18).
5. **Ruled: confirmed** (BB8 6678599629). `CURSOR_BYTES = 65536` (163840 after the amendment
   below, and 131072 since items 21 and 27), `CONTINUATION_BYTES = 8192` and
   `WITNESS_FIELDS = 16`, with `INVARIANT_FAILURE` on the worker for the two byte bounds: both
   are engine defects, never truncations (§3). Also confirmed: `methods[*]` holds no terminal
   input (§2.8). **Amended** (BB8 6678702125, ruling 2): `INVARIANT_FAILURE` for `CURSOR_BYTES`
   holds only once the bound is derived from the constants. §3.1 derives it. The 64 KiB did not
   hold, so the bound became 160 KiB, and a refusal, then read as growing with the input, got
   `REFUSAL_BYTES` and cause `cursor_refusal_bytes`. Item 27's ruling replaces that: the
   refusal's bound is derived from the adapter's construction, passing it is
   `INVARIANT_FAILURE` (§3.2), and the cursor's bound is 128 KiB (item 21,
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
    ruling widens to the four membership logs, `MEMBERSHIP_ENTRIES` (§6.11). **Scoped** (BB8
    6688972927): the caps bound the logged-state load and the walk at the contract's own bounds,
    `MEMBERSHIP_BYTES` (4 MiB, item 31) holding the load at 4,096-byte entries beside
    `MEMBERSHIP_ENTRIES`. Construct and recompute depend on the text and are measured, not
    bounded, and the proof run's 30 s first-commit gate qualifies the whole. The 26.68 s and
    28.43 s at the caps are derivations from measured terms, not bounds.
14. **Ruled by (a)** (BB8 6678599629). The walk is incremental (§5.1). A full read, the 175 MiB
    figure at the bounds, happens in exactly two places, both the store's: reconciliation and
    `resume()`. **Amended** (BB8 6688972927): the worker's finish-time load of `alt_cells`, the
    third site of 6678599629, is a complete verified load, not a full read. It raises
    `STORAGE_CORRUPT` on F6 and releases nothing (§1, §5.1, §5.2).

BB8 still re-checks §6.9's acceptance list against the worker half once 3PO publishes it.

### Added for confirmation since 6678599629

Items 15–20 filled gaps that ruling (a) left open, and are ruled by 6681838131. Items 21–24
came with the fold of 6678702125 (`8732918312`), and items 25–29 with the fold of 6681838131
and its review (`147f5dd3d`). Item 25 is ruled by 6682942783, and BB8 confirmed it as folded
(6684866461). Items 21–23, 26 and 28 are ruled by 6683944548. Item 27 is ruled by 6684866461,
which replaces 6683944548's ruling on it. Item 24 is 3PO's, and BB8 agrees with 3PO's
qualification (6683944548). Item 29 stays open. Items 30 and 31 are R2's two questions to BB8 in
6693449409; BB8 ruled both yes (6693502369), and this text folds both rulings. Item 32 is ruled by
6700200435.

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
    decides. On the store's side only a full read releases with `chain_broken`; the worker's
    `chain_broken` at its load (F3 or R2) is a refusal whose `DISCOVERY_UNAVAILABLE` pause
    releases (§5.2, §8; amended by BB8 6688972927). The review proposed instead a full read on
    the lease itself; that would be a third full-read place for the store, beside reconciliation
    and `resume()` (the worker's finish-time load of `alt_cells` is a complete verified load, not
    a full read, item 14), against ruling (a), so it is not taken unless BB8 prefers it. Also: the walk's save is skipped,
    never forced, when it cannot get capacity. **The ruling:** at lease time a problem in the
    segments this process listed is `STORAGE_CORRUPT`, with no save and no release, and
    `resume()`'s full read decides; no further full-read place (the store's two, as item 14
    amends them). At reconciliation, segment bytes
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
    ruling then scaled every term by 3. 6682942783 retracts that, and the inputs stand as this item
    states them (§6.11, item 25).
18. **Ruled** (BB8 6681838131). **What the bound leaves out** (§6.11). The ruling: derive the cap
    with every term at the loaded-host factor; `seen`, `variants`, `alt_seen` and `row_seen`
    share one budget, with one combined cap and a named `RESOURCE_LIMIT` cause per log, since
    `seen` alone at `CHAIN_SEGMENTS` would load for about 191 s; `row_seen` in the alternate
    phase is not assumed empty, and a restart mid-row there is tested; finish work (the full
    `alt_cells` load and option 2's read) is outside the first-commit criterion but must fit a
    lease, the proof run measures it, and it stays open; reconciliation inside a lease, after any
    foreign writer, is an accepted exclusion that the proof run records. §3, §6.2 and §6.11 now
    say this, and the cap's value is item 25. **Corrected** (BB8 6682942783): the every-term clause
    is retracted, because construct and recompute already enter at their loaded-host
    measurements; only the per-entry load rate is scaled (item 25). The rest of the ruling stands.
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
21. **Ruled: confirmed in method** (BB8 6683944548), **and derived again** under item 27's
    ruling (6684866461). **The `CURSOR_BYTES` derivation** (§3.1), which ruling 2 asked for.
    BB8 confirmed the method and required the validator's failure when the registry passes the
    derivation's inputs, which it has. The figure is derived again from the actual refusal
    envelope, as 3PO asked (6684847656), not reused: every method holds a refusal of
    `REFUSAL_BYTES`, 543 bytes, the largest construction in the call closure, which the dispatch
    never builds (§3.2). So the largest cursor is 99,141 bytes, conservatively, and the bound is
    `CURSOR_BYTES = 131072` (128 KiB): that cursor plus an allowance of 31,931 bytes, room for 34
    more methods. 3PO's reconstruction gives the same 99,141 bytes (6684968306). The bound covers
    the cursor without `discovery` and `continuation`; the whole cursor is at most 235,483 bytes
    (§3). The 142,912-byte figure and its 160 KiB go. `bad/cursor_over_bound.json` holds the
    largest cursor and one at the bound, accepted, and one byte over, refused by W4 and by the
    worker as `INVARIANT_FAILURE`.
22. **Ruled: confirmed in full** (BB8 6683944548). **The reply boundary's details** (§8, C1),
    beyond ruling 4's three cases. Each cause declares whether it takes a log (§8's Log column),
    and a log missing or present against that declaration is a protocol failure, as are an
    `error_log` outside §2.3 and a cause on a code that takes none. A worker naming
    `segment_corrupt`, the store's own cause, is a protocol failure. The echo is cut to 64 bytes
    at a character boundary, and a value that is not a string is echoed as its JSON text. After
    a release, U2 keeps the copied reason and the bad value is logged. The worker's
    resident-capacity guard names a new `RESOURCE_LIMIT` cause, `resident_capacity`.
23. **Ruled: confirmed** (BB8 6683944548). **No reset after a seal of the same log** (§2.6,
    §6.2). A frame applies its resets first, so a step that has already sealed `row_seen` ends
    before a row boundary that resets it, whether a plain reset or a compaction. It follows from
    atomic compaction and W3, and it moves only where steps end.
24. **3PO's, with BB8's agreement** (BB8 6683944548; 3PO 6684847656). **Where the nine cases
    sit** (§6.9). This contract places the three membership-only faults at three split points of
    a four-part terminal detail: a part of another method at the junction, read later; and a
    parent of another method and an inserted contribution, read at the resume. Membership is
    `method_id` alone, so a part whose `schema_name` alone changes is accepted. BB8 agrees with
    3PO's qualification: the test of a non-terminal record inserted after the terminal suffix
    stays, separate from the contribution-prefix fixture (§6.9's acceptance list,
    `contribution_after_suffix` beside `inserted_record`). Method membership and generic detail
    integrity remain two separate checks (BB8 6678856548).
25. **Ruled: option (b)** (BB8 6682942783), **confirmed as folded** (BB8 6684866461). **The combined
    cap's value** (§6.11). Ruling 18 named 16,384 with every term at the loaded-host factor, and the
    previous revision derived 32,768 the same way over the combined sum. BB8 retracts that rule:
    construct and recompute already enter at their loaded-host measurements, so scaling them again
    counts the same slowdown twice, and 16,384 would refuse #656's own run before its alternate
    phase. **The ruling:** only the per-entry load rate is scaled, 30.4 µs × 3 = 91.2 µs; construct
    (15.2 s), recompute (2.4 s) and the walk enter at their loaded-host measurements. 90,975 entries
    fit in 29 s, the 30 s budget less the 1 s margin, rounded down to a power of two:
    `MEMBERSHIP_ENTRIES = 65536`, combined over `seen`, `variants`, `alt_seen` and `row_seen`, with
    a cause for each log (the derivation as BB8 6688972927 states it; no #656 entry count is a term
    in it). At the cap the load is about 6.0 s and the sum 26.68 s, a derivation under the 30 s
    budget, not a bound. **Added** (BB8 6688972927, re-derived under item 31): `MEMBERSHIP_BYTES =
    4194304` over the same logs, from a per-byte rate measured at 4,096-byte entries (138.8 ns, the
    worst of 17 shapes, §10) scaled by 3, with the same causes; with both caps reached the sum is
    28.43 s (§6.11). #656's 20,045 primary-phase entries, its one measured membership figure, leave
    45,491 entries under the cap: headroom for the alternate phase, not a measured margin (BB8
    6683944548). The proof run's gates decide, and if a lease's first commit misses 30 s on the
    qualified image, the cap is re-derived from that measurement, never waived. 3PO's four controls
    at 65,536 and four refusals at 65,537 match the cause for each log (6684847656).
26. **Ruled: confirmed** (BB8 6683944548). **`resume()`'s full read on a byte mismatch** (§5.1)
    gives `segment_corrupt` and releases the job. It is a full read like reconciliation, so it
    gets the same cause. Lease time stays `STORAGE_CORRUPT`, with no release.
27. **Ruled** (BB8 6684866461, which replaces 6683944548's ruling on this item). **The
    refusal's bound** (§3.2). 6683944548 ruled that a job completing today must not stop because
    a refusal's detail is long, and moved the detail out of the cursor behind a fixed-size
    reference. 3PO then showed the case cannot occur through the real adapter (6684847656): a
    4,096-byte declared label gives a 187-byte refusal, because `analysis.py:_apply_declarations` substitutes
    `"declared"` for the label and `_candidates` uses a fixed remedy, and continuing and restored
    streams are identical. The 4,607 detail bytes come only from a separately built lower-level
    `RL.realise` stream, which never reaches the cursor. **The ruling:** the refusal stays in the
    cursor. `REFUSAL_BYTES` is derived from the adapter's construction, its fixed text plus parts
    whose size is bounded: 543 bytes, `search_stub_resolution`'s refusal, the largest construction
    in the call closure. The dispatch never builds that one, so the bound is conservative; the
    largest refusal the dispatch can build is 336 bytes, as 3PO found (6684968306). Passing it is
    `INVARIANT_FAILURE`, an engine defect, and the store's W4 refuses it; `cursor_refusal_bytes`
    is retired, matching the other `INVARIANT_FAILURE` bounds, which name no cause. Two guard
    tests are required: 4 KiB and 64 KiB declared labels complete as today, continuing and
    restored (the worker half), and the validator builds the largest refusal the construction
    allows and shows it fits (`good/refusal_construction.json`). `CURSOR_BYTES` is derived again
    from the actual refusal (item 21). There is no reference-encoding interface. If a future
    adapter puts input text into a refusal, the guard fails first, and the reference design comes
    back then.
28. **Ruled: confirmed** (BB8 6683944548). **The new causes and how the worker names them** (§3,
    §8). The meter's two budgets get `declared_coordinate_bits` and `expansion_budget`, so every
    `RESOURCE_LIMIT` raise the reader reaches names a cause; the four membership causes and
    `segment_corrupt` get messages; a refusal names its cause in its message head, `CODE[cause]:`
    or `CODE[cause,log]:`; the bridge marks a worker's reply `reply: true`, and the scheduler keeps
    a sink's own error, so C1 checks replies only. **C1 is switched on in the same runtime train
    as the worker half, never before**, or today's worker replies, which carry no causes, would
    fail. The mechanism is one switch (§8): R2's scheduler change carries C1 off, and R2 turns it on
    in the runtime train that carries the worker half. The #721 author's change does not touch
    `reader_scheduler.js`, and the off setting is never in a released image.
29. **Open** (BB8 6683944548 and 6688972927: it stays open for the proof run, as agreed). **Finish work must fit a lease**
    (§6.11, ruling 18). The full `alt_cells` load, option 2's read of about 63 MB, and
    `_domain`'s enumeration, up to `DOMAIN_CAP` pairs, are not timed. The proof run measures the
    finish lease against the lease; if it does not fit, it needs checkpointable progress or
    option 2's domain-log fallback.
30. **Ruled: yes, folded** (BB8 6693502369; asked in 6693449409). W7 holds `MEMBERSHIP_BYTES`
    through a `bytes` member in each log's head and verified state: the sum of `|canonical(e)|`
    over its sealed entries, which a commit adds to with each seal (§2.7, §4). It is verified
    wherever it is read: R2 at a full read, `chain_broken`; R5 at a lease's walk, the junction,
    `STORAGE_CORRUPT`; and R3 at the worker's load, `cursor_disagrees` (§5.1, §5.2). A frame one
    byte past the cap is refused by W7 and one at it passes (`bad/membership_over_cap.json`); a
    head, a verified state and a summary whose `bytes` disagrees with the chain are
    `bad/head_bytes_disagree.json`, `bad/verified_bytes_disagree.json` and
    `bad/summary_bytes_disagree.json`; a verified `bytes` past its head's is refused by R5
    before anything is read (`bad/verified_bytes_ahead.json`).
31. **Ruled: yes, folded; its value is open** (BB8 6693502369; asked in 6693449409). F1 bounds an
    entry's nesting depth with `ENTRY_DEPTH`: the smallest power of two at least twice the
    largest depth among the #721 author's declared entry shapes, at least 8 and at most 64
    (§2.1). Past it a generated entry is `INVARIANT_FAILURE` on the worker's emit, a submitted
    frame `READER_PROTOCOL` at the store (F1), and a persisted segment F3 on read-back
    (`bad/entry_over_depth.json`). §2.1's 2,048-level text and its `RecursionError` caveat are
    gone; the single-pass key stays, for the rate. **Open for BB8:** no declaration of the entry
    shapes exists yet, so the #721 author is required to make one (§9), and `ENTRY_DEPTH = 8`
    is provisional, from the deepest shape the source builds at this head, a `seen` or
    `alt_seen` key of depth 4 (§2.1). `MEMBERSHIP_BYTES` is re-derived over the 17 shapes
    capped at it (§6.11, §10), and `MEMBERSHIP_BYTES = 4194304` is provisional with
    `ENTRY_DEPTH = 8`: both wait on the #721 author's (3PO's) declared entry shapes, and a
    declared depth of 5 or more re-derives both. BB8 accepts `MEMBERSHIP_BYTES = 4194304` on
    these terms (6699352254, ruling 1): the power-of-two rounding stands; the per-byte rate is
    re-measured on a quiet host before the proof run; and if the declared shapes put
    `ENTRY_DEPTH` at 64, the cap is re-derived, not inherited (§6.11). The 17 shapes are 17
    named shapes, 13 distinct at this cap (§10).
32. **Ruled: accepted, with conditions** (BB8 6700200435, on R2's seven questions of the Node-side
    plan). (3) When `store.pause` refuses a pause with anything but `STALE_ATTEMPT`, the scheduler
    makes one fallback pause, `READER_PROTOCOL`, "The reader reply could not be recorded:
    <code>.", with no cause or release, so a lease always ends; a refused fallback is logged and
    left to lease expiry (§8, `bad/reply_pause_refused.json`). (4) A malformed `record.discovery`
    is released `chain_broken`, log `null`, at the reconciliation that finds it; its release is
    outside §7.4's property, so a save `_capacity` refuses is held pending, shown as `paused` with
    the U2 reason and refused as `DISCOVERY_UNAVAILABLE`, and saved at the first point usage is
    known (§2.7, §7.4, `bad/malformed_record_discovery.json`; rule M1, BB8 6709891376). (7) A segment is stat'ed before it
    is read, and a stored size over `READER_LIMITS.objectBytes` is F6 without a read (§2.5, §2.11,
    §5.1, §7.4, `bad/segment_oversized.json`).

## 13. Fixtures and validator

`mcp/fixtures/discovery_v1/README.md` lists every fixture, one line each, with the rule it
exercises and the refusal it expects. The good fixtures are accepted with no refusal. Each
bad fixture violates exactly the rule it is named for and passes every other rule. A fixture that
holds an `identity_hash` names the identity behind it (`identity`), and the validator checks that
every `identity_hash` it holds is that identity's hash (BB8 6719406992, call 8), so the store's
tests resume a fixture job with its own identity and mock no digest.

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
- `good/refusal_construction.json`: every refusal construction in the adapter's call closure,
  read from the source, each with its parts and the bound of every variable part; the largest of
  each with every part at its maximum, independently and schema by schema, and the largest of
  all, 543 bytes, which is `REFUSAL_BYTES` and which the dispatch never builds; the largest the
  dispatch can build, 336 bytes; every place `analysis.py` names a refusal, every use of
  `_Refused` and every call that could copy a refusal; the refusals the real `_candidates`,
  `_full_shape` and `_stub_resolved_stream` build with frame source labels of 1, 4,096 and
  65,536 bytes, identical across the three; and the frame sources `_apply_declarations` sets and
  the sources it reads (§3.2).

- `good/codec_error_mapping.json`: the codec's tags and where each is mapped (§2.11): single-fault
  entries with their tag and `what` in Python and their tag in Node, controls at the bounds, the
  integer-only fields and the rule each maps to, multi-fault inputs that pin only the code, the
  worker's emit precedence (F1 before F2) with BB8's cases, the `1.0` divergence with one pin per
  side, invalid UTF-8 in a segment, F3 in both languages once the store decodes strictly, with
  its address-valid read-back of a lone 0xFF byte, the codec requirement's calls (§9), the
  admission guard's cases and its stored-request case, and the raw-transport pair: a
  whitespace-padded entry of 4,096 canonical bytes that passes and one of 4,097 that fails F2
  however it is spaced.
- `good/membership_load_measurement.json`: the raw rows behind §10's per-byte load rate (BB8
  6693502369), a measurement, not a bound: the 17 shapes capped at `ENTRY_DEPTH`, plain and
  gzipped, in two passes, and the nested shapes capped at 16 and at 64, in one pass. The
  validator computes §10's figures from the rows and checks §10's text and §6.11's rate
  against them.

Bad:

- write (`READER_PROTOCOL` 400): `bad/changed_digest_after.json` (F5),
  `bad/float_entry.json` (F1, which Node meets as F5), `bad/over_bound_seal.json` (F4),
  `bad/premature_seal.json` (F4), `bad/epoch_backwards.json` (W2),
  `bad/reset_unheld_log.json` (W3), `bad/cursor_record_disagreement.json` (W4),
  `bad/current_moved_back.json` (W4, with its accepted controls),
  `bad/cursor_over_bound.json` (W4, built from §3.1's inputs: the worker refuses first, with
  `INVARIANT_FAILURE`, past `CURSOR_BYTES` or for a refusal past `REFUSAL_BYTES`, its message
  naming the bound and its value; a number that
  is not an integer from 0 to 2⁵³ − 1 is the store's alone),
  `bad/tail_rewritten.json` (W6);
- reply (`READER_PROTOCOL`, no status): `bad/reply_cause_invalid.json` (C1), with sink errors
  and a bridge failure among its controls; `bad/reply_pause_refused.json` (the fallback pause): a
  reply whose cause `store.pause` refuses (`INVALID_PAUSE`, C1 off: a cause outside every set,
  one that is not a string, one of the wrong family, no cause with a log outside the set, and a
  `DISCOVERY_UNAVAILABLE` with no cause, which the strict pause refuses) ends in exactly one
  fallback pause with the reason `{code: "READER_PROTOCOL", message: "The
  reader reply could not be recorded: INVALID_PAUSE."}`, no cause and no release, and the warn and
  the recovery line name the reply's own code and cause; a `STALE_ATTEMPT` takes no fallback and
  its warn names it stale; a refused fallback is two calls and then
  lease expiry; with C1 on, a valid reply whose pause is refused once takes the same fallback; a
  valid reply and a sink error are controls with one call each;
- limit: `bad/membership_over_cap.json` (W7). For each membership log and each cap, the worker
  refuses first, as `RESOURCE_LIMIT` with cause `discovery_<log>`; a store sent the frame refuses
  it `READER_PROTOCOL` 400, totalling the entry bytes from each log's `bytes`. A control per log
  and cap reaches the cap exactly and is accepted: one past `MEMBERSHIP_ENTRIES` or one byte past
  `MEMBERSHIP_BYTES` refuses, and the cap itself passes (BB8 6693502369, item 30). The validator's
  byte test runs the same cap through the worker's model;
- depth: `bad/entry_over_depth.json` (F1). An entry one level past `ENTRY_DEPTH`: a store sent it
  in a frame refuses `READER_PROTOCOL` 400 and writes nothing; the worker's emit refuses it as
  `INVARIANT_FAILURE` with §3's F1 message; read back from an address-valid segment it is F3, so
  a full read releases with `chain_broken`, a lease's walk refuses `STORAGE_CORRUPT` 503 and the
  worker's load refuses `chain_broken`. The same cases at exactly `ENTRY_DEPTH` pass (BB8
  6693502369, item 31);
- full read (`DISCOVERY_UNAVAILABLE` 409): `bad/segment_corrupt_at_reconciliation.json` (F6,
  cause `segment_corrupt`), with a lease's `STORAGE_CORRUPT` on the same store and a structural
  control that is `chain_broken`; `bad/segment_oversized.json` (F6 by size, cause
  `segment_corrupt`): a segment file one byte over `READER_LIMITS.objectBytes`, plain and
  gzip-marked, is released at reconciliation without being opened, the store keeps serving its
  other jobs, and a lease's walk that meets it refuses `STORAGE_CORRUPT` and releases nothing;
  `bad/head_bytes_disagree.json` (R2, cause `chain_broken`): a
  head whose `bytes` disagrees with its chain, which a lease's walk meets at R5's junction as
  `STORAGE_CORRUPT`;
- malformed record (`DISCOVERY_UNAVAILABLE` 409): `bad/malformed_record_discovery.json` (M1,
  §2.7, §7.4, cause `chain_broken`, log `null`): the record of `good/lease_incremental_walk.json`
  with one change each, a `verified` naming two of the three logs `logs` names, a state key of the
  wrong type, an extra key of `record.discovery` and an extra key of a log state, and the value
  `{}`, on queued, paused, cancelled and running records. Reconciliation releases each in the
  state it is in. Inside the record's reservation each release is saved at startup's
  reconciliation, before usage is known. Past it, with usage unknown, a release no larger than the
  record is saved at once, and `{}`'s, which grows, is pending, shown with the same release and
  refused the same way until the recount saves it. The store never fails, the job is never
  dispatched and its heads are never roots. `discovery: null` and an absent key are controls that
  nothing touches;
- resume (`DISCOVERY_UNAVAILABLE` 409): `bad/missing_segment.json` (R1),
  `bad/reordered_segment.json` (R2), `bad/cursor_summary_disagreement.json` (R3),
  `bad/summary_bytes_disagree.json` (R3: the summary's `bytes` against the worker's own sum),
  `bad/inventory_mismatch.json` (R4);
- walk (`STORAGE_CORRUPT` 503): `bad/verified_ahead_of_head.json` (R5), refused before
  anything is read, releasing nothing; its `resume()` full read passes and saves the
  corrected verified heads; `bad/verified_bytes_disagree.json` (R5's junction: the bytes read
  from the verified state's `bytes` do not end at the head's), refused once the appended segment
  is read, releasing and saving nothing, its full read likewise passing;
  `bad/verified_bytes_ahead.json` (R5: a verified `bytes` past its head's, every other field a
  valid prefix), refused by R5's prefix check before anything is read, its full read likewise
  passing;
- traversal: `bad/retired_key_recurring.json` (S1, `DISCOVERY_UNAVAILABLE` 409),
  `bad/witness_mismatch.json`, `bad/terminal_suffix_not_contiguous.json` and
  `bad/terminal_suffix_resume_faults.json` (S2, `RESULT_EXPIRED` 410).

**How the #721 author consumes them.** The worker's encoder, fed each good fixture's state, produces
exactly its seals, tails, cursor fields and digests, byte for byte. Its load, traversal and
reconstruction accept each good fixture and refuse each bad one with the same rule, code, status and
cause, but for `bad/float_entry.json`, whose `1.0` each operation refuses by its own rule (§2.11):
the worker's emit refuses it as `INVARIANT_FAILURE` (F1), the worker's load of a segment holding it
as F3, `chain_broken`, and the store's check of a frame holding it as F5, `READER_PROTOCOL`, because
Node parses `1.0` as the integer 1. `bad/entry_over_depth.json`'s entry is likewise one that each
operation refuses by its own rule: the worker's emit as `INVARIANT_FAILURE`, its load as F3, and the
store's frame check as F1. `bad/membership_over_cap.json`'s mutants are frames the worker
must refuse to emit, each naming the cause of the log whose append passes the cap, and so are
`bad/cursor_over_bound.json`'s mutants that name a worker code. Its three number mutants name none:
the engine never builds such a number, so they are the store's (W4).
`good/refusal_construction.json` is the worker half's statement of every refusal it may store: its
guard tests (§3.2) hold each refusal the worker stores to a construction listed there and to
`REFUSAL_BYTES`, with the same bytes for a 1-byte, a 4,096-byte and a 65,536-byte label.
`bad/terminal_suffix_resume_faults.json`'s nine `accepts` cases are required worker refusals:
`resolve_detail_records` accepts each, and the worker's suffix-membership check, run before
resolving, must refuse it; its five controls must be accepted. `bad/reply_cause_invalid.json`'s
`reply` cases are what the worker's reply must look like after `worker.py` reads its message head
(§8). `good/codec_error_mapping.json` is the codec's statement (§2.11, §9): its tests pin each
`single_fault` case's `tag` and `what`, the `cross_language.python` cause, the `persisted_bytes`
case, every `codec_requirement` call and both `raw_transport` cases, and the worker maps each tag as
`mapping` gives; its `multi_fault` cases pin no tag, and its `emit_precedence` cases pin
`INVARIANT_FAILURE` before `RESOURCE_LIMIT`. `good/row_seen_compaction_next_frame.json`'s
`worker_must_not_emit` frames are ones a store accepts and the worker never emits. The walk,
full-read, thrown-save, pause, fencing and reply fixtures, and the compaction fixture, are the
store's and the scheduler's (R2's side).

The validator rebuilds every segment from the seals, recomputes every digest and address,
and checks this document's constants, causes and cross-reference rows. It also runs Python
over the same bytes: `canonical_json` and `json.dumps` against Node's bytes, the segment
addresses, `resolve_detail_records` and the witness over the filtered stream, the terminal
suffix's mutants and controls (resolving the suffix itself with `resolve_detail_records`), and
the float fixture. It recomputes the §6.11 derivation and what it leaves out from §10's
figures and §3's constants, and it holds §7.4's release property over every combination of
logs. It builds the largest cursor from §3.1's inputs and checks those inputs against the
registry and the source, and builds the largest `cursor.discovery` and the whole cursor's bound
(§3). It walks every refusal construction in the adapter's call closure and every place it names
a refusal, bounds each variable part over the registry, builds the largest refusal
independently and schema by schema, shows the dispatch never builds the largest, and runs the
real refusal builders with labels of three sizes, without the dictionary (§3.2). It walks the
reader's imports for every `RESOURCE_LIMIT` raise and holds each to §8's list. It models C1, the sink errors it never checks, the fallback pause and its one call, the fencing of a
release, a byte mismatch at a full read and a thrown save, and it rebuilds each resume case from
its split point's durable prefix. Each R5
clause, the junction and the full read's refusals are checked one at a time. Where one
failure leaves a later check undefined (a log whose seal fails F5 has no digest for W4 to
compare), it skips that check. It runs in `npm run test:library`:

```sh
node --test mcp/test_discovery_v1_fixtures.mjs
```

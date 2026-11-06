# discovery_v1 fixtures (#656)

These files are the shared wire interface for persisted discovery state. The contract is
`mcp/DISCOVERY_V1.md`, and the rule IDs below (F1–F6, W1–W7, R1–R5, S1–S2, U1–U2, C1) are its rules.
`mcp/test_discovery_v1_fixtures.mjs` recomputes every digest and address here from the
contract, and asserts that each bad fixture violates exactly the rule it is named for and
passes every other rule.

- Entries are synthetic. The envelope treats them as opaque values; the entry layouts are
  `analysis.py`'s.
- Write fixtures carry only the cursor fields the store reads (`contract_version`,
  `method_index`, `discovery`, `witness`, `continuation`). The witness and lease fixtures
  carry a full cursor v2.
- Paths under `/store` stand for the store directory. A resume or walk fixture's segments are
  the ones `good/seal_sequence_two_logs.json` builds, minus any listed in `store.omit`.
- A walk fixture models the store's walk (§5.1). `addresses` is the store's in-memory address
  list, each live chain's segments oldest first, and `record.discovery.verified` is the verified
  prefix. `expect.lease` is what a lease stats, reads, saves and returns. `expect.full` (and a
  bad walk fixture's `expect.resume`) is a full read: what it reads from the heads, newest
  first, the address list it rebuilds, and the verified heads it saves. `orphans` names
  segments in the store that no list holds.
- `bad/membership_over_cap.json` is a limit fixture. Each mutant is a record and the frame a
  worker must refuse to emit (`RESOURCE_LIMIT`, no HTTP status: the job pauses), naming in
  `worker` the cause for the one membership log (`log`) whose append passes the cap; the refusal
  a store sent it gives is `expect.store`. Records name synthetic chains by their totals only; the
  write path reads no segment. Its `controls`, one per log, reach the cap exactly and are
  accepted.
- `bad/segment_corrupt_at_reconciliation.json` is a full-read fixture. `store.corrupt` changes one
  stored byte of a segment (`address`, the byte offset `at`, the new `byte`), so its bytes no
  longer match its address. `expect.reconciliation` is the job after the release (from
  `job_state`), `expect.lease` what a lease's walk on the same store gives, and `expect.resume`
  what `resume()`'s full read gives. Its `controls` are full reads of a structural fault.
- `good/thrown_save_outcome_unknown.json` is a thrown-save fixture: the record and lists before a
  commit that wrote `commit.wrote`, and one case per way its record save throws, each with the
  durable record that results (`durable`) and what the instance and its restart then do.
- `good/unavailable_pause_reason.json` is a pause fixture: one record, and cases that each
  apply a sequence of events (`store.pause`, `reconciliation`, `lease_expiry`, `cancel`) to it
  from a starting state (and reason), with the state, `record.discovery` and stored reason the
  last one leaves.
- A groups fixture models only the membership state of §6.4: `seen_members` is the primary
  `seen` log's membership, `mirror` says whether the schema is same-rule, and each key
  event's `lines` is the sorted pair of the lines of the key's two members.
- `bad/witness_mismatch.json` and `bad/terminal_suffix_not_contiguous.json` list mutants of the
  good witness fixture's durable history. Each mutant's `records` holds indexes into that
  fixture's `durable_records`, or whole records; a mutant may also replace the witness. The
  suffix fixture's `controls` use the same form and are accepted.
- `bad/float_entry.json` holds the number `1.0`. Python reads it as a float and must refuse
  it as F1; Node reads it as the integer 1 and refuses the seal as F5 (`node_detects`).
  Reformatting must keep the literal.
- `good/seal_completeness.json` and the seal sequence are the largest files: a segment that
  is complete by its bytes needs 16,384 entry bytes, and one complete by count needs 1,024
  entries.
- `good/row_seen_compaction_next_frame.json` is a compaction fixture, and store-only (`side`):
  no traversal produced its positions, so the worker's half of the rule is a #721 test. To keep
  it small, each seal
  writes its entries as `entries_range` [a, b): the integers a … b − 1, expanded before any rule
  runs; its digests and addresses are over the expanded entries. `boundary` names the row
  boundary: the log's count, its live keys (`live_range`), the seals the compaction needs and the
  seals frame 1 already carries. `worker_must_not_emit` holds frames a store accepts that a worker
  must never emit. Its row_seen chain before frame 1 is synthetic, named by its totals.
- `bad/cursor_over_bound.json` is a construction fixture. It states §3.1's `inputs`, and each case
  names a cursor outside `discovery` and `continuation`, with its canonical bytes and sha256. The
  largest cursor: every integer at `integer`; `methods` keys `shared_sound:` plus sha256 of
  `method <i>`, cut to `method_id_bytes`, each holding every counter, `coverage: "answered"`,
  `figure_counts` and `inputs.refusal`, the largest refusal the adapter can construct
  (`good/refusal_construction.json`), of exactly `refusal_bytes`; `schemas` names `schema_<i>_`
  padded with `n` to `schema_name_bytes`, each with `incomplete_reason` and in
  `refused_schemas`; `identity_hash` and the witness digest 64 `f`s; a witness of
  `witness_fields` names of `witness_field_bytes` `a`s. Padding to a target adds
  methods `pad:<k>` holding `{"candidates": 0}` while 64 bytes or more remain, then one
  `pad:` + `z`s whose length makes the size exact. `refusal_one_byte_over` adds one `x` to the
  first method's refusal's `detail`. A frame carries the cursor with an empty `discovery` and
  `continuation`, at epoch `integer`, on a record with no discovery.
- `good/refusal_construction.json` is a construction fixture (§3.2). `sites` is every refusal the
  adapter can put in a cursor, as the validator reads it from the source: its `module`,
  `function` and `construction` (`literal`, a dict written to `counts["refusal"]`, or `refusal`, a
  `Refusal` call), and its `parts`, one per field. A part is `["const", value]`, `["either",
  [a, b]]` (the longer of two constants), `["expr", e]` (a variable part, whose bound is
  `bounds[e]`) or `["text", pieces]`, each piece `["text", s]`, `["either", [a, b]]` or
  `["value", e]` (`e!r` for a repr). `bytes` is the canonical size of the refusal with every
  part at its bound. `sources` names what each `_Refused` raise passes on, `spans_from` the
  function a span refusal's `NoReferent` comes from, and `messages` every `NoReferent` message
  in its call closure, whose longest is `bounds["str(exc)"]`. Counts in `bounds` are decimal
  strings, at most `integer_bound`. `largest` is the largest refusal, `refusal_bytes` its size.
  `label_runs` summarises the refusals the real builders make with each of `labels` as every
  frame's source; `frame_sources` lists what `_apply_declarations` sets a frame's source to, and
  `source_reads` how often it reads a declaration's own source.
- `bad/reply_cause_invalid.json` is a reply fixture: failed leases on a running job, each with the
  pause it leads to. Each case holds one of `reply` (the bridge's result for the worker's own
  final frame, `reply: true`, which C1 checks), `sink` (an error a Node sink threw inside
  `onReaderCheckpoint`, kept and rethrown as it was) or `bridge` (a bridge failure with no worker
  reply); only a `reply` is checked. `discovery: "unchanged"` means nothing is released. A case
  with `released` starts from the record already released with that cause and log.
- `good/release_fencing.json` is a fence fixture: jobs with their attempt, fence, lease and queue
  fields, events from two instances, and the job after each event (`saved`, or `refused` with
  `written`). A `store.pause` event `from: "sink"` carries the `cause` and `log` of the sink's own
  refusal; one without carries a worker reply's `error_cause` and `error_log`.
- `bad/terminal_suffix_resume_faults.json` uses the suffix fixtures' form, and a record may also
  be a name from its `named` records, or `{of, set}`: a copy of a named record with `set`'s
  fields replaced. `boundary` is the index of the first record after the witness's
  contributions. Each mutant names its `split` point, its `fault`, when it is `read`
  (`resume`: the resume at that split point reads it; `later_read`: the fault is in the first
  part the resumed lease writes, read by the next resume in the epoch whose durable suffix holds
  it), and whether `resolve_detail_records` alone, run on the records after the boundary,
  `accepts` or `refuses` it. Each mutant and control is derived from its split point's durable
  prefix, and the validator rebuilds it from that. Every `accepts` case is a required worker
  refusal: only the worker's suffix-membership check refuses it (3PO 6678848728).
- The files are data. Change them only together with the contract, then run the validator.

Each row: the fixture, the rule or rules it exercises, the refusal it expects (`none` when
it is accepted), and what it exercises.

| Fixture | Rule | Refusal | Exercises |
| --- | --- | --- | --- |
| `good/seal_sequence_two_logs.json` | F1 F2 F3 F4 F5 F6 W1 W2 W3 W4 W5 W6 | none | three frames: tails only; `seen` and `alt_cells` sealed in one frame; `alt_cells` chained across frames; canonical-form and cut-rule vectors |
| `good/epoch_jump.json` | W2 W4 | none | epoch 2 to epoch 5 in one frame; the epoch-2 chain and witness are released |
| `good/seal_completeness.json` | F4 W3 W4 | none | one frame, two seals of one log: the first is complete because the next entry would not fit, the second because its entry bytes are exactly 16,384 |
| `good/retired_group_then_within_line.json` | S1 | none | group retirement at its boundary, a within-line key to `alt_seen` that leaves the current group open, and a checkpoint and resume inside a pending binding |
| `good/within_line_inside_group.json` | S1 | none | (3,7), then (7,7), then (3,7) accepted; membership through primary `seen` and the reversed key; a group opened by a duplicate; a within-line key recurring across groups; canonical-byte membership |
| `good/witness_cursor_option2.json` | S2 | none | a full cursor v2 carrying the option 2 witness, resumed inside the terminal emission: repeated id, an ineligible record with a detached endpoint, a durable/local overlap, and a partial terminal suffix |
| `good/lease_payload_summary_paths.json` | R1 R2 R3 R4 | none | the lease payload `{summary, paths}`, oldest first, and the inventory witness |
| `good/lease_incremental_walk.json` | R2 R5 | none | a lease stats the verified segments, reads only `alt_cells`' newest and advances its verified head in one save; the next lease reads and saves nothing; a full read from the heads reads all and rebuilds the list |
| `good/lease_after_refused_commit.json` | R2 R5 | none | a refused commit left `alt_cells#1` an orphan; the list was extended only after a save that returned, so the lease reads nothing and its payload leaves the orphan out |
| `good/row_seen_compaction_next_frame.json` | F4 W1 W3 W4 | none | a frame with seven seals reaches a compaction boundary whose two seals would pass FRAME_SEALS: the step ends before it, the compaction runs first and whole in the next frame, a restart seals the same bytes, and a split the store accepts is one the worker never emits |
| `good/release_fencing.json` | U1 U2 | none | reconciliation on one instance during a live lease on another: the lease's next commit is refused and writes nothing, its fence and attempt are unchanged, its pause carries the sink refusal's own cause and log, and a queued job keeps its attempt counter and queue fields |
| `good/thrown_save_outcome_unknown.json` | R2 F3 F6 | none | a commit's record save throws: with a status, before the write, so only orphans change; without one, after the rename, so the outcome is unknown, the instance serves nothing, and the restart's full read rebuilds the lists from the durable heads, landed or not |
| `good/refusal_construction.json` | W4 | none | every refusal the adapter can construct, read from the source with the bound of each variable part; the largest, every part at its maximum, is 543 bytes, REFUSAL_BYTES; frame source labels of 1, 4,096 and 65,536 bytes build the same refusals |
| `good/unavailable_pause_reason.json` | U1 U2 | none | every release path and the saves after one: one save empties `logs` and `verified`; `unavailable` and the reason keep the released log names and their heads; the first trace wins; a released job is never requeued |
| `bad/missing_segment.json` | R1 | DISCOVERY_UNAVAILABLE 409 segment_missing | the oldest `alt_cells` segment is gone; the store meeting it outside reconciliation says STORAGE_CORRUPT 503 |
| `bad/reordered_segment.json` | R2 | DISCOVERY_UNAVAILABLE 409 chain_broken | the two `alt_cells` paths are swapped |
| `bad/cursor_summary_disagreement.json` | R3 | DISCOVERY_UNAVAILABLE 409 cursor_disagrees | the cursor's `alt_cells` totals are one segment short of the walked summary |
| `bad/inventory_mismatch.json` | R4 | DISCOVERY_UNAVAILABLE 409 inventory_mismatch | the recomputed target inventory has lost a target |
| `bad/changed_digest_after.json` | F5 | READER_PROTOCOL 400 | one seal's `digest_after` has its last hex digit changed; nothing is written |
| `bad/float_entry.json` | F1 | READER_PROTOCOL 400 | a seal holding the Python float `1.0`; Python refuses it as F1, Node as F5 |
| `bad/over_bound_seal.json` | F4 | READER_PROTOCOL 400 | a seal of 1,025 entries is refused, not truncated |
| `bad/premature_seal.json` | F4 | READER_PROTOCOL 400 | a seal of 4 entries whose next entry would still fit |
| `bad/reset_unheld_log.json` | W3 | READER_PROTOCOL 400 | a reset of `row_seen`, which the record does not hold |
| `bad/tail_rewritten.json` | W6 | READER_PROTOCOL 400 | the previous tail is rewritten, not appended to |
| `bad/retired_key_recurring.json` | S1 | DISCOVERY_UNAVAILABLE 409 retired_key_recurred | a key over a retired line pair comes up again |
| `bad/witness_mismatch.json` | S2 | RESULT_EXPIRED 410 | BB8's five mutants, one per witness field, a contribution after the terminal suffix, a missing detail part and a null witness |
| `bad/epoch_backwards.json` | W2 | READER_PROTOCOL 400 | a frame at epoch 3 on a record at epoch 5 |
| `bad/cursor_record_disagreement.json` | W4 | READER_PROTOCOL 400 | the cursor's `sealed_digest` for `seen` differs from the record's |
| `bad/membership_over_cap.json` | W7 | RESOURCE_LIMIT | for each of `seen`, `variants`, `row_seen` and `alt_seen`, a frame whose append takes the four logs one past `MEMBERSHIP_ENTRIES`: the worker names `discovery_<log>`, a store sent it refuses READER_PROTOCOL 400; a control per log reaches the cap exactly and passes |
| `bad/segment_corrupt_at_reconciliation.json` | F6 | DISCOVERY_UNAVAILABLE 409 segment_corrupt | one byte of `alt_cells#1` changed: reconciliation releases that job alone with `segment_corrupt`, logged at error level, and the store does not fail; a lease's walk refuses STORAGE_CORRUPT 503 and releases nothing; `resume()`'s full read releases it too; a structural fault is `chain_broken` |
| `bad/verified_ahead_of_head.json` | R5 | STORAGE_CORRUPT 503 | `alt_cells`' verified head is a segment past its head; the lease's walk refuses before reading and releases nothing; `resume()`'s full read passes and saves the corrected verified heads |
| `bad/cursor_over_bound.json` | W4 | READER_PROTOCOL 400 | the largest cursor §3.1's inputs allow (99,141 bytes, every method holding the largest refusal) and one of exactly CURSOR_BYTES pass; one byte over fails W4 and is the worker's INVARIANT_FAILURE; a refusal one byte over REFUSAL_BYTES fails W4 and is the worker's INVARIANT_FAILURE too |
| `bad/reply_cause_invalid.json` | C1 | READER_PROTOCOL | for each of the two codes a missing, an unknown and a cross-code cause, the store's own cause from a worker, a cause on a code that takes none, a cut and a non-string echo, a log outside the set, missing where its cause needs one, or on a cause or code that takes none: each pauses READER_PROTOCOL naming the bad value, releasing nothing; valid replies, sink errors and a bridge failure pause as before |
| `bad/terminal_suffix_resume_faults.json` | S2 | RESULT_EXPIRED 410 | at three split points of a four-part terminal detail: fifteen faults resolve_detail_records refuses, and the nine it accepts that the worker's suffix-membership check must refuse; the durable prefixes, the complete suffix and a part whose schema_name alone changes pass |
| `bad/terminal_suffix_not_contiguous.json` | S2 | RESULT_EXPIRED 410 | the terminal suffix broken by a contribution (`contribution_after_suffix`, after the complete suffix, is the post-terminal insertion test, separate from the resume fixture's `inserted_record`), another method's record or part, a contribution's part, a part out of its parent's run, or a part that breaks `resolve_detail_records` (cut off, duplicated, wrong index, total, detail id or bytes); the contiguous controls pass |

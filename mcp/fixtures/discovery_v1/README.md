# discovery_v1 fixtures (#656)

These files are the shared wire interface for persisted discovery state. The contract is
`mcp/DISCOVERY_V1.md`, and the rule IDs below (F1–F6, W1–W6, R1–R4, S1–S2) are its rules.
`mcp/test_discovery_v1_fixtures.mjs` recomputes every digest and address here from the
contract, and asserts that each bad fixture violates exactly the rule it is named for and
passes every other rule.

- Entries are synthetic. The envelope treats them as opaque values; the entry layouts are
  `analysis.py`'s.
- Write fixtures carry only the cursor fields the store reads (`contract_version`,
  `method_index`, `discovery`, `witness`, `continuation`). The witness and lease fixtures
  carry a full cursor v2.
- Paths under `/store` stand for the store directory. A resume fixture's segments are the
  ones `good/seal_sequence_two_logs.json` builds, minus any listed in `store.omit`.
- A groups fixture models only the membership state of §6.4: `seen_members` is the primary
  `seen` log's membership, `mirror` says whether the schema is same-rule, and each key
  event's `lines` is the sorted pair of the lines of the key's two members.
- `bad/witness_mismatch.json` lists mutants of the good witness fixture's durable history.
  Each mutant's `records` holds indexes into that fixture's `durable_records`, or whole
  records; a mutant may also replace the witness.
- `bad/float_entry.json` holds the number `1.0`. Python reads it as a float and must refuse
  it as F1; Node reads it as the integer 1 and refuses the seal as F5 (`node_detects`).
  Reformatting must keep the literal.
- `good/seal_completeness.json` and the seal sequence are the largest files: a segment that
  is complete by its bytes needs 16,384 entry bytes, and one complete by count needs 1,024
  entries.
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

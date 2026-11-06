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
- The seal sequence is the largest file, because a sealed segment needs 1,024 entries.
- The files are data. Change them only together with the contract, then run the validator.

Each row: the fixture, the rule or rules it exercises, the refusal it expects (`none` when
it is accepted), and what it exercises.

| Fixture | Rule | Refusal | Exercises |
| --- | --- | --- | --- |
| `good/seal_sequence_two_logs.json` | F1 F2 F3 F4 F5 F6 W1 W2 W3 W4 W5 W6 | none | three frames: tails only; `seen` and `alt_cells` sealed in one frame; `alt_cells` chained across frames; canonical-form and cut-rule vectors |
| `good/epoch_jump.json` | W2 W4 | none | epoch 2 to epoch 5 in one frame; the epoch-2 chain and witness are released |
| `good/retired_group_then_within_line.json` | S1 | none | group retirement at its boundary, a within-line key to `alt_seen`, and a checkpoint and resume inside a pending binding |
| `good/witness_cursor_option2.json` | S2 | none | a full cursor v2 carrying the option 2 witness; repeated id, ineligible records, a durable/local overlap |
| `good/lease_payload_summary_paths.json` | R1 R2 R3 R4 | none | the lease payload `{summary, paths}`, oldest first, and the inventory witness |
| `bad/missing_segment.json` | R1 | DISCOVERY_UNAVAILABLE 409 segment_missing | the oldest `alt_cells` segment is gone; the store meeting it outside reconciliation says STORAGE_CORRUPT 503 |
| `bad/reordered_segment.json` | R2 | DISCOVERY_UNAVAILABLE 409 chain_broken | the two `alt_cells` paths are swapped |
| `bad/changed_digest_after.json` | F5 | READER_PROTOCOL 400 | one seal's `digest_after` has its last hex digit changed; nothing is written |
| `bad/over_bound_seal.json` | F4 | READER_PROTOCOL 400 | a seal of 1,025 entries is refused, not truncated |
| `bad/retired_key_recurring.json` | S1 | DISCOVERY_UNAVAILABLE 409 retired_key_recurred | a key over a retired line pair comes up again |
| `bad/epoch_backwards.json` | W2 | READER_PROTOCOL 400 | a frame at epoch 3 on a record at epoch 5 |
| `bad/cursor_record_disagreement.json` | W4 | READER_PROTOCOL 400 | the cursor's `sealed_digest` for `seen` differs from the record's |

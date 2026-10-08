# Limits

Numeric caps and budgets: module-level constants in the harness files that ran for the reference song, and in the connector (`mcp/`). Name, value, file. Byte values are also shown in KB.

| constant | value | file |
|---|---:|---|
| DOWNLOAD_ATTEMPTS | 4 | `lyric_harness.py` |
| DOWNLOAD_TIMEOUT_S | 120 | `lyric_harness.py` |
| WRAPPED_FOLLOW_MAX | 20 | `lyric_harness.py` |
| BRACKET_VERSE_FOLLOW_MAX | 40 | `lyric_harness.py` |
| ROLLUP_MIN_LINES | 4 | `lyric_harness.py` |
| JOURNAL_WORK_BYTES | 1,048,576 (1,024 KB) | `lyric_harness.py` |
| JOURNAL_BYTES | 1,114,112 (1,088 KB) | `lyric_harness.py` |
| JOURNAL_LINE_CHARS | 200 | `lyric_harness.py` |
| MATTR_WINDOW | 50 | `quality/features.py` |
| BIN_MIN_TAIL | 200 | `quality/length_curve_calibration.py` |
| NOMINAL | 0.05 | `quality/length_curve_calibration.py` |
| IRLS_MAX | 200 | `quality/length_curve_calibration.py` |
| MAX_EXPANDED_POSITIONS | 100,000 | `quality/meter.py` |
| MAX_FIT_DP_CELLS | 1,000,000 | `quality/meter.py` |
| MAX_BLUEPRINT_ITEMS | 10,000 | `quality/meter.py` |
| AMENDMENT_MAX_FILE_EXCLUSION | 0.15 | `quality/meter_bands.py` |
| AMENDMENT_MIN_KEPT_FRACTION | 0.4 | `quality/meter_bands.py` |
| READER_GATE_MAX_EXCLUSION | 0.25 | `quality/meter_bands.py` |
| MIN_ROOT | 2 | `quality/morphology.py` |
| RIME_DEPTH | 1 | `quality/phonology/cym.py` |
| MAX_CODA | 2 | `quality/phonology/fas.py` |
| MAX_PARSES | 128 | `quality/phonology/fas.py` |
| RADIF_MIN_COUNT | 3 | `quality/phonology/fas.py` |
| RADIF_MIN_FRACTION | 0.6 | `quality/phonology/fas.py` |
| RADIF_MIN_LINES | 4 | `quality/phonology/fas.py` |
| RADIF_MAX_TOKENS | 6 | `quality/phonology/fas.py` |
| RIME_DEPTH | 1 | `quality/phonology/fin.py` |
| RIME_DEPTH | 1 | `quality/phonology/msa.py` |
| BEATS_PER_SYLLABLE_MAX | 1 | `quality/plan.py` |
| EXACT_ENUM_MAX | 10 | `quality/plan.py` |
| PATTERN_ATTEMPTS | 200 | `quality/plan.py` |
| MAX_CHOICES | 128 | `quality/pronunciation.py` |
| MAX_LINE_CHARS | 200 | `quality/propose.py` |
| _WVP_MEMO_CAP | 32 | `quality/relations.py` |
| _RESOLVE_MEMO_CAP | 20,000 | `quality/relations.py` |
| PAIR_MEMO_CAP | 4,096 | `quality/relations.py` |
| READING_COMBO_CAP | 64 | `quality/relations.py` |
| FIELD_MEMO_CAP | 512 | `quality/revise.py` |
| SCORE_MEMO_CAP | 8,192 | `quality/revise.py` |
| RANK_MEMO_CAP | 2,048 | `quality/revise.py` |
| RIME_MEMO_CAP | 200,000 | `quality/revise.py` |
| END_PAIR_MEMO_CAP | 400,000 | `quality/revise.py` |
| _BOUND_TOKEN_MEMO_CAP | 50,000 | `quality/revise.py` |
| MEMBER_READING_CAP | 64 | `quality/rhyme_types.py` |

Connector:

| constant | value | file |
|---|---:|---|
| DEFAULT_TOOL_BUDGET_MS | 600,000 | `../mcp/budget.js` |
| TOOL_DELIVERY_MARGIN_MS | 30,000 | `../mcp/budget.js` |
| LIST_TRADITIONS_MAX | 100 | `../mcp/engine.js` |
| VARIANT_BUDGET | 120 | `../mcp/engine.js` |
| MIN_PER_PART | 4 | `../mcp/engine.js` |
| RECIPE_FINISH_MS | 10,000 | `../mcp/gemini_agent.js` |
| DEFAULT_TTL_MS | 86,400,000 | `../mcp/job_store.js` |
| MAX_RECORD_BYTES | 18,874,368 (18,432 KB) | `../mcp/job_store.js` |
| INTENT_BYTES | 2,097,152 (2,048 KB) | `../mcp/job_store.js` |
| CHECKPOINT_BYTES | 7,077,888 (6,912 KB) | `../mcp/job_store.js` |
| PROGRESS_BYTES | 2,097,152 (2,048 KB) | `../mcp/job_store.js` |
| RESPONSE_BYTES | 9,437,184 (9,216 KB) | `../mcp/job_store.js` |
| DEFAULT_MAX_BYTES | 268,435,456 (262,144 KB) | `../mcp/job_store.js` |
| MAX_WORDS | 12 | `../mcp/lyric_tools.js` |
| MAX_WORD_CHARS | 40 | `../mcp/lyric_tools.js` |
| MAX_LINES | 463 | `../mcp/lyric_tools.js` |
| MAX_LINE_CHARS | 200 | `../mcp/lyric_tools.js` |
| MAX_MANDATE_CHARS | 65,536 | `../mcp/lyric_tools.js` |
| MAX_SWEEP_SEEDS | 28 | `../mcp/lyric_tools.js` |
| MAX_WANTS | 13 | `../mcp/lyric_tools.js` |
| MAX_WANT_CHARS | 80 | `../mcp/lyric_tools.js` |
| MAX_ANSWER_CHARS | 4,000 | `../mcp/lyric_tools.js` |
| MAX_OUTPUT_BYTES | 9,437,184 (9,216 KB) | `../mcp/lyric_tools.js` |
| LOOKUP_MAX_ADMITTED | 8 | `../mcp/lyric_tools.js` |
| CONNECTOR_ATTEMPTS | 1 | `../mcp/lyric_tools.js` |
| KITCHEN_ATTEMPTS | 3 | `../mcp/lyric_tools.js` |
| REFUSAL_HEADLINE_MAX | 400 | `../mcp/lyric_tools.js` |
| MAX_LEDGER_BYTES | 1,048,576 (1,024 KB) | `../mcp/paid_budget.js` |
| STATE_WIRE_BYTES | 2,359,296 (2,304 KB) | `../mcp/payload_limits.js` |
| HTTP_REQUEST_BYTES | 4,718,592 (4,608 KB) | `../mcp/payload_limits.js` |
| CONTROL_CAP | 18,874,368 | `../mcp/python_bridge.js` |
| READER_FRAME_CAP | 2,113,536 | `../mcp/python_bridge.js` |
| RESERVE_BYTES | 16,384 (16 KB) | `../mcp/reader_job_store.js` |
| READER_BODY_BYTES | 2,097,152 (2,048 KB) | `../mcp/reader_protocol.js` |
| RUN_TTL_MS | 21,600,000 | `../mcp/run_store.js` |
| RUN_CAP | 64 | `../mcp/run_store.js` |
| MAX_TRADITIONS_PER_CALL | 16 | `../mcp/schemas.js` |
| MAX_EDITS_PER_CALL | 64 | `../mcp/schemas.js` |
| MAX_WORKSPACE_CARDS | 512 | `../mcp/schemas.js` |
| HEADER_LOG_LIMIT | 300 | `../mcp/server_http.js` |
| WORKER_STATE_BYTES | 1,114,112 (1,088 KB) | `../mcp/state_codec.js` |
| STATE_DECODED_BYTES | 1,179,648 (1,152 KB) | `../mcp/state_codec.js` |
| CONNECTOR_DECLARATION_BYTES | 32,768 (32 KB) | `../mcp/state_codec.js` |

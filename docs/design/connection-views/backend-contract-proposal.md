# Connection views: backend contract proposal (3PO supporting audit)

Status: PROPOSAL FOR NAMED-TEAM DEBATE, not consensus, implementation, measurement, or production certification. Supports 3PO's response to R2; does not speak for R2, BB8, Jony Ives or Don Norman. Read-only inspection; no tests, benchmarks, analysis jobs, builds or production changes executed.

Reviewed shared spec: commit `1d7acc4b16cc200841faf8cb806a8503fc16620f`, `docs/design/connection-views/spec.md`; R2 comment 6526315821 and 3PO comment 6526385852. Code below pinned `672accf93a0f6fdd52fc20759a0a989de4abe067`. `library/analysis.py` was verified identical to main `94ac9c2cc224b82acac007590d172d5608c1934e` in prior audit; do not infer other files are identical.

## Decisions needed now

| Dispute | Existing contract | Proposed decision |
|---|---|---|
| Anywhere = placement stripped | `pair_satisfies` is writer-bound-token evaluation, deliberately strips placement, refuses unsupported span/figure shapes | Anywhere is a DISPLAY scope over registered valid loci. Add an independently versioned sound-comparison mode only after a method-level eligibility contract is accepted. Never relabel its output registered alliteration/end rhyme |
| Reading disagreement = undecided | `resolve_line_pair`: existential true on a satisfying compatible reading; false only exhaustive failure; none on remaining unknown/cap/refusal/unavailable combination | Store verdict, quantifier, witness and search completeness separately. Some failing alternatives do not negate existential true |
| Group mutual-reading badge | Pair witnesses are local existential evidence, not a globally consistent assignment | Default badge `Not assessed`. `Consistent witness found` requires joint assignment certificate; `No assignment` requires exhaustive joint failure. Bounded unsuccessful search => unknown |
| 5778 × ~20 computed once | 108 choose 2 = 5778 unordered token pairs only. Methods include different loci, spans, direction, readings and figures; native Library pairs are line endings | Label arithmetic as hypothetical only. Materialize immutable versioned evidence once per semantic job identity, safely reuse it, invalidate/version on semantic changes. No throughput/cost promise before measurement |

## 1. Coverage manifest: executable design contract, not a hardcoded total

Introduce versioned method manifest entries. Derive from registry when possible; explicitly review what cannot be derived. Do not equate total schemas with all-position word-pair methods.

```json
{
  "method_id": "schema:<existing-stable-id>",
  "definition_hash": "sha256 of canonical method definition + dependencies",
  "layer": "registered_schema",
  "member_kind": "token_pair | span_pair | line_pair | figure | template",
  "member_roles": ["a", "b"],
  "ordering": "unordered | directed | role_sensitive",
  "candidate_domain": "declared schema loci and frames",
  "placement_policy": "preserve_registered",
  "quantifier": "declared figure quantifier",
  "required_capabilities": [],
  "reading_policy_id": "versioned policy",
  "matrix_projection": "exact_token_pair | touched_occurrences_only | none"
}
```

`ordering` must be proven from the actual predicate/member/placement rules, not inferred solely from equal span rules. An edge's reversal may be a different relation question. Method names identify definitions; renames/version changes cannot silently reuse stale meanings.

### Existing coverage, verified by source

- `alliteration`: HEAD_ANY × HEAD_ANY, SAME LINE. Across-line shared /w/ is not this registered schema.
- `internal rhyme`: any_token × any_token over whole song, at least one member non-final. Includes same-line and cross-line opportunities at valid anchors; not every arbitrary phone comparison.
- `leonine rhyme`: caesura/half-line anchored; requires the frame capability.
- `cross rhyme`: line end to adjacent-line interior; member roles matter.
- `interlaced rhyme`: adjacent-line interiors.
- `linked rhyme`: end/head across line break.
- `head rhyme (positional)`: line heads on different lines.
- `mosaic` / `compound-phrasal`: multiword/search spans, currently both-line-final placements. Not unrestricted token-pair variants.
- Whole-line/quantified/token-figure/template schemas: retain native members/assembly; a projected touched-word cell must say `Participates in figure`, not falsely `These two words satisfy this pair relation`.
- Library `_native_candidates`: all pairs of lexical LINE ENDINGS, not all occurrences.
- `whole_vocabulary_pairs`: all LINE pairs when unrestricted, plus separate line-level/refusal/undecided output. `settle` and resolution shortcuts are unsuitable for full method inventory.

Exact current counts of all-position/token-bindable/non-end schemas are NOT established. Production gate: generate and review a method inventory by declared capabilities/arity/loci without silently treating historical 78 as coverage proof.

## 2. Entity and evidence contract

Reuse existing Library source coordinates and semantic identity. A local `(line,token)` is unique only within a particular reading and tokenization revision. Never use spelling as identity.

```json
{
  "entity_id": "hash(analysis_identity, entity_kind, native_coordinates)",
  "kind": "token_occurrence | span | line | figure",
  "reading_unit_id": "...",
  "reading_revision": "...",
  "native_coordinates": {"line": 3, "token": 1},
  "source_ranges": [],
  "normalized_ranges": [],
  "numbering_scheme": "explicit v1/v2 + voices policy",
  "display_text": "watch"
}
```

Span entities keep ordered unit IDs, member direction, anchor, search burden and source precision. Reading-altered syllable coordinates must map to stable source occurrences; keep their actual witness coordinates too. N-ary figures retain member IDs and labelled supporting edges, not a fabricated clique.

```json
{
  "evidence_id": "deterministic id from semantic job + method + role-labelled binding",
  "analysis_identity": "...",
  "method_id": "...",
  "members": [{"role":"a","entity_id":"..."},{"role":"b","entity_id":"..."}],
  "outcome": "true | false | undecided",
  "coverage": "answered | refused | not_requested",
  "quantifier": "selected_reading | exists_compatible_reading | all_compatible_readings",
  "reading_search": {
    "state": "not_needed | exhaustive | partial | unavailable",
    "termination_reason": "satisfied | exhausted | combination_cap | capability | cancelled | resource_limit",
    "combinations_examined": null,
    "combination_limit": 64
  },
  "witness": null,
  "refusal": null,
  "channel_reads": [],
  "placement_reads": [],
  "identity_reads": [],
  "tradition_scope": "preserved native value",
  "normative_status": "preserved native value"
}
```

Proposed fields augment existing evidence; not a claim all are emitted now. Counter values unavailable from the current API must remain null/absent until instrumented, not guessed. `not_evaluated` is a query/population state from manifest/job progress, not a false engine outcome. Add `not_applicable` only when the domain exclusion can be proved and documented. Refusal remains typed with reason; unreadable tokens do not universally map to one engine return type today.

### Truth table for existential reading policy

| Observation | Outcome | Completeness |
|---|---|---|
| A compatible full-reading witness satisfies | true | may be partial; witness suffices for existential claim |
| Every compatible combination evaluated and false, no residual unknown | false | exhaustive |
| No witness, at least one unknown or unreadable dependency | undecided | recorded reason |
| No witness before combination/resource cap | undecided | partial; not false |
| Selected reading false, another reading true | exists-policy true; selected-policy false | policy-qualified separate answers |

A `holds under all readings` badge is different from existential holds. Never infer universal agreement from a single witness or merged knowledge-set equality. Existing English any-reading uses accent-compatible combinations; do not combine per-channel options from incompatible pronunciations.

## 3. Persistence, cache identity and invalidation

Existing `semantic_identity` captures contract version, reading unit/revision, source SHA, normalized SHA, source-map hash, language, semantic declaration hash, requested methods, engine/resource/phonology runtime and supplied catalog identities. Reuse it; add only reviewed missing dependencies.

Proposed durable key = hash(existing semantic identity, coverage-manifest version, evidence-format version, reading-policy version, resource-content manifest). Required invalidators: source/tokenizer/parser/normalizer changes; source-map changes; schema definition/registry changes; lexicon/resource/fallback/accent/reading policy changes; occurrence pins; frames/sections/stanza/line status; requested scope/locus policy. Presentation palette/layout change is NOT a semantic invalidator.

Do not use process `id(lexicon)` as a durable key. Existing process caches remain bounded accelerators, not durable completeness proofs. Existing runtime resources hash reads the runtime-assets manifest; verify that it transitively binds actual relevant resource bytes before promising cross-deployment reuse. Any undeclared transcriber mutation must disable or invalidate reuse.

Persist immutable evidence records plus method/population completion manifest. A partial run may serve labelled partial evidence but cannot create a complete-result cache hit. Atomic transaction: evidence batch + sequence/cursor advancement + manifest progress; idempotent replay by evidence ID. A cache hit must validate version/dependency identity and completion scope, not just poem ID. Private provenance remains access-controlled sidecar; semantic source presence still distinguishes absent from declared-empty.

## 4. Bounded, resumable jobs

Existing `AnalysisSession.step` defaults to 256 candidate lease budget, caps requested deadline at current time +1 second, validates frame byte budget 64 KiB–1 MiB, limits individual detail records to 32 KiB, and resumes candidate/emission/sequence cursors. A caller with `load_records` acknowledges prior durable records before another step. `run_step` is already the public wrapper. Resource guard reads process RSS envelope (default 1024 MiB). These are existing mechanisms, NOT proof of hard real-time preemption: a primitive or preparation stage may exceed a step deadline before yielding.

Proposed worker state machine:
`queued → leased → running → committing → queued/running → complete`; side states `cancel_requested → cancelled`, `paused_resource`, `failed_retriable`, `failed_terminal`, `stale_identity`.

- One active lease per semantic job, renewable expiry, owner/fencing token. Old worker cannot commit after lease replacement.
- Commit batch and checkpoint atomically. Crash before commit replays safely; crash after commit resumes from committed cursor. Figures read committed edges only.
- Cancellation checked before preparation, between candidate emissions and before commit. Preserve already durable results as cancelled/partial; never stamp complete. Bound cancellation latency empirically; long uninterruptible primitives require isolated worker termination/retry strategy.
- Queue fairness and concurrency/memory/I/O budgets per deployment; don't load thousands of poems in one in-memory session.
- Reject stale checkpoint identity, malformed request/method ID, oversized record and unsupported declaration with typed terminal errors. Resource exhaustion pauses without deleting remaining population; authorized retry may increase capacity but not silently narrow semantics.
- Backend reads evidence for hover/selection; no live judge request on pointer movement. Large graph/matrix pages use deterministic pagination/tiles against one result version. Filtered counts distinguish total answered scope, visible subset, and not-yet-evaluated population.

Existing lease/database/cancellation implementation outside `analysis.py` was NOT audited in this pass. Above worker semantics are acceptance requirements, not claims of absent or completed features.

## 5. Group consistency proposal

Define precisely before implementation: which edges must be simultaneously satisfied, which occurrences share assignments, and which dialect/phonology contexts are compatible. Connected component alone does not imply all-pairs agreement. A consistent assignment for selected existing edges does not establish a clique.

API concept: `group_consistency(entity_ids, required_evidence_ids, semantic_identity, search_budget)` → `witness_found | exhaustive_unsatisfiable | unknown | not_requested`, with exact jointly assigned occurrence readings, covered edge IDs, policy/version, completeness and termination reason. Keep separate from pair cache. No badge until certificate can be independently replayed by unchanged judges; no unsatisfiable badge after bounded search only. Default production UI: `Joint reading consistency not assessed`.

## 6. Acceptance tests (design of tests, not executed)

1. Method inventory snapshots: exact supported loci/member shape/order/capabilities; fail when new schema has no projection decision.
2. Occurrence identity: duplicate words distinct; punctuation/parentheses/voices; v1/v2 exact raw-span rebinding; source edits reject stale pins.
3. Locus controls: watch/woods same line accepted as illustrative alliteration shape; cross-line same onset not registered alliteration; valid internal rhyme across stanzas; caesura absent vs empty vs present; mosaic preserved as span not arbitrary word edge.
4. Outcome controls: existential success plus failing alternatives stays true; exhausted all-false stays false; cap/no witness unknown; unknown/refused/unasked never false. Accent-incompatible readings never form a witness.
5. Direction/arity: asymmetric member reversal preserved; full graph/template assembly equals native reference; no fabricated pair clique or transitive relation.
6. Cache invalidation matrix across every dependency above; presentation-only edits reuse; partial manifests never return complete; no process-ID durable keys.
7. Resume/crash: interrupt before/after batch commit and during multi-record event; final IDs/results/population counts equal uninterrupted exact traversal, no duplicate or dropped negatives. Stale leases cannot commit.
8. Cancellation/resource: bounded memory and backpressure; explicit partial status; retry does not narrow scope; measure worst preparation/primitive delay rather than assume one-second bound.
9. UI/API projections: same immutable selected occurrence/evidence in all three views; filter changes distinguish hidden vs absent vs false; count mode states unit (pairs, method labels, figures, uncertain, visible/total).
10. Security/input: source entitlement and private declaration provenance isolation; untrusted oversized documents/IDs do not cross tenant/cache boundaries or crash shared worker.

## 7. Measurement gate before scale-up

Freeze commit, resource manifest, reading policy and corpus snapshots. Compare cold/warm exact traversal and each candidate optimization on stratified length/repetition/OOV/ambiguity/dialect/language and multiword/global figures. Measure wall/CPU, peak RSS, preparation and worst primitive latency, candidates before/after pruning, evaluations, reading combinations, completeness/refusals, cache hits, durable bytes, resume/commit cost, cancellation latency, end-to-end queue latency and concurrent-job memory. Per-method evidence equivalence is mandatory before speed claims. Report p50/p95/tail and worst cases, not one poem's average.

5778 is only unordered-pair arithmetic for 108 occurrences. Directed pairs, same-occurrence possibilities, spans, n-ary combinations and reading alternatives alter workload; safe bucketing reduces evaluated candidates but preserves the question. No current evidence establishes ~20 families or compute-once throughput for this proposed all-occurrence layer.

## R2 review (2026-10-30)

R2 endorses §§1–7 as the working contract. Each item below is marked VERIFIED (R2 read the code at the commit named), ADDITION or DIFFERENCE.

- **VERIFIED, §4 step limits** (`library/analysis.py` at `0aec52178`):
  - `step(budget_candidates=256, …)`;
  - `deadline = min(deadline, start + 1)`;
  - `max_bytes` must be 65,536–1,048,576;
  - 32,768-byte record and headroom checks;
  - `run_step` wraps `step`;
  - the RSS ceiling is `LIBRARY_READER_MAX_RSS_MIB`, default 1024.
  CI on 2026-10-30 measured warm-worker children at 554–661 MiB against that guard.
- **ADDITION, §2 search completeness is not exposed today.** `relations.reading_combos` returns `(combos, complete)`, but `pair_satisfies_any` and `resolve_line_pair` return `(answer, witness)` and drop `complete`. So `reading_search.state`, `termination_reason` and `combinations_examined` cannot be filled from the current API without an engine change. Until then they are null or absent, as §2 already says.
- **ADDITION, §2 two-stage search.** On `claude/english-sound-inventory` (`c9a3ed4bd`), `resolve_line_pair` first varies only the words whose readings differ on the fields the schema reads (`schema_read_fields`), then, on a None, every word. A termination record should therefore say which stage ended it. A narrow-stage False is exhaustive only over the narrowed words, with the others merged, and is sound because merged channels answer False only when no value could agree.
- **ADDITION, §3 lexicon identity components, as named in code.**
  - `Lexicon.reader_scheme` (v1/v2);
  - the supplement version and its file sha256 (`lexicon_supplement_versions.json`);
  - `lyric_harness.ACCENT_RULES`, currently `"accent-readings-2026-10-30"`, which versions the rule-derived accent readings;
  - occurrence pins.
  Each belongs in the semantic identity. `comparator_fingerprint()` (7 inputs) is the existing model for hashing a closure, not for the evidence key itself.
- **ADDITION, §6 standing cap fixture.** The connector scaffold pair "we carry the morning to the light / we carry the morning to the road" is the reference case:
  - under `parechesis / general consonance` every word has several readings;
  - the full search passes the 64 cap and answered None, which refused the obligation (`mcp/test.mjs:8215` on `5469f8043`);
  - the narrowed search answers False.
  The test checks that the full-search outcome is undecided with termination `combination_cap`, never false, and that the narrowed stage is labelled as such.
- **DIFFERENCE, minor, §2 `coverage` versus `outcome`.** Refusal is not one engine return type today. `pair_satisfies` returns a `Refusal` object for a missing capability, while an unreadable endpoint is filed by `check_scheme` as a refusal row. R2 agrees with §2's "typed with reason" and asks that the inventory test (§6.1) enumerate both paths, so neither is mapped to `outcome: false`.

## Source anchors

- Shared proposal: https://github.com/WeningerII/CodexMusica/blob/1d7acc4b16cc200841faf8cb806a8503fc16620f/docs/design/connection-views/spec.md
- R2 position: https://github.com/WeningerII/CodexMusica/issues/519#issuecomment-6526315821
- 3PO response: https://github.com/WeningerII/CodexMusica/issues/519#issuecomment-6526385852
- Writer-bound pair semantics: https://github.com/WeningerII/CodexMusica/blob/672accf93a0f6fdd52fc20759a0a989de4abe067/lyric-harness/quality/relations.py#L9627-L9694
- Reading search: https://github.com/WeningerII/CodexMusica/blob/672accf93a0f6fdd52fc20759a0a989de4abe067/lyric-harness/quality/relations.py#L9822-L10001
- Locus families: https://github.com/WeningerII/CodexMusica/blob/672accf93a0f6fdd52fc20759a0a989de4abe067/lyric-harness/quality/relations.py#L5190-L5265
- Alliteration: https://github.com/WeningerII/CodexMusica/blob/672accf93a0f6fdd52fc20759a0a989de4abe067/lyric-harness/quality/relations.py#L4850-L4859
- Evidence / candidate pipeline: https://github.com/WeningerII/CodexMusica/blob/672accf93a0f6fdd52fc20759a0a989de4abe067/lyric-harness/library/analysis.py#L1138-L1280
- Native endpoint candidates: https://github.com/WeningerII/CodexMusica/blob/672accf93a0f6fdd52fc20759a0a989de4abe067/lyric-harness/library/analysis.py#L1362-L1418
- Session step limits: https://github.com/WeningerII/CodexMusica/blob/672accf93a0f6fdd52fc20759a0a989de4abe067/lyric-harness/library/analysis.py#L1734-L1797
- Semantic identity: https://github.com/WeningerII/CodexMusica/blob/672accf93a0f6fdd52fc20759a0a989de4abe067/lyric-harness/library/contracts.py#L113-L147

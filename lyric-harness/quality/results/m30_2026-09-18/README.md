# M-30 — the full baseline census, all 107 files

Measured 2026-09-18 on `a459abc4`, four-wide on four vCPUs, per-suite bounds
from `mutate.SUITE_TIMEOUT` over `DEFAULT_TIMEOUT` 600. Reproduce with:

```
python3 quality/test_mutation.py --baseline-only --jobs 4
```

This is the census `MISSING.md` M-30 has been PARTIAL pending since
2026-08-22, when the entry closed with **the bound itself is still
unmeasured** and 102 of 106 suites had never been measured at all.

## The headline

| | |
|---|--:|
| test files measured | 107 |
| PASS | 106 |
| ERROR | 1 |
| FAIL | 0 |
| TIMEOUT | 0 |
| whole-tree baseline cost | 8440 CPU-s (2.34 CPU-hours) |
| wall, four-wide | 4,185.2 s (69.8 min) |

**No suite timed out and no suite failed.** The single non-PASS is an
ERROR, and it is a fact about the COPY rather than about the suite —
see below. That is the fifth time this census shape has found a suite
excluded from every mutation sweep for something other than its own
health.

## The bound, now measured

The question M-30 left open was whether the per-suite bounds are safe.
Four suites use more than half of their own bound:


| suite | seconds | bound | share of bound |
|---|--:|--:|--:|
| `quality/test_verbs.py` | 2606.6 | 3000 | **86.9%** |
| `quality/test_discriminate.py` | 1109.1 | 1800 | **61.6%** |
| `quality/test_loop.py` | 654.7 | 900 | **72.7%** |
| `quality/test_relations_null.py` | 453.0 | 600 | **75.5%** |

`test_verbs` has 393 s of headroom against a 3,000 s bound. The one
worth naming is `test_relations_null`: 453.0 s against the DEFAULT
600 s, because no bound was ever declared for it. It is the suite
closest to a false TIMEOUT, and a false TIMEOUT does not report a hole
— it MANUFACTURES one, which is the direction this instrument must
never fail in. Recorded, not repaired: raising a bound is a cost
decision and doctrine 58 says that is a question, not a patch.

## Every suite, slowest first

| suite | seconds | bound | status |
|---|--:|--:|---|
| `quality/test_verbs.py` | 2606.6 | 3000 | PASS |
| `quality/test_discriminate.py` | 1109.1 | 1800 | PASS |
| `quality/test_loop.py` | 654.7 | 900 | PASS |
| `quality/test_revise.py` | 578.6 | 1600 | PASS |
| `quality/test_relations_null.py` | 453.0 | 600 | PASS |
| `quality/test_screen.py` | 292.8 | 600 | PASS |
| `quality/test_plan.py` | 239.2 | 1600 | PASS |
| `quality/test_songs_record.py` | 223.8 | 600 | PASS |
| `quality/test_production_revision.py` | 136.7 | 600 | PASS |
| `quality/test_readability.py` | 136.1 | 600 | PASS |
| `quality/test_capacity.py` | 133.5 | 1000 | PASS |
| `quality/test_g2p.py` | 103.1 | 600 | PASS |
| `quality/test_replay_memo.py` | 101.2 | 600 | PASS |
| `quality/test_spans.py` | 96.8 | 600 | PASS |
| `quality/test_gate_census.py` | 91.3 | 600 | PASS |
| `quality/test_audit_regressions.py` | 88.8 | 600 | PASS |
| `quality/test_propose.py` | 79.0 | 600 | PASS |
| `quality/test_capacity_receipt.py` | 74.3 | 600 | PASS |
| `quality/test_grid.py` | 73.8 | 600 | PASS |
| `quality/test_null_shapes.py` | 65.4 | 600 | PASS |
| `quality/test_production_data.py` | 64.9 | 600 | PASS |
| `quality/test_floor.py` | 64.6 | 600 | PASS |
| `quality/test_ban_convergence.py` | 63.4 | 600 | PASS |
| `quality/test_fwer.py` | 60.9 | 600 | PASS |
| `quality/test_field_store.py` | 43.2 | 600 | PASS |
| `battery.py` | 35.3 | 600 | PASS |
| `quality/test_corpus_audit.py` | 32.1 | 600 | PASS |
| `quality/test_msa_fin.py` | 31.7 | 600 | PASS |
| `quality/test_recover.py` | 30.6 | 600 | PASS |
| `quality/test_pronunciation_choices.py` | 30.6 | 600 | PASS |
| `quality/test_provenance.py` | 30.5 | 600 | PASS |
| `quality/test_mut_oracle.py` | 30.2 | 600 | PASS |
| `quality/test_cross_song.py` | 30.2 | 600 | PASS |
| `quality/test_homograph.py` | 29.7 | 600 | PASS |
| `quality/test_structure_census.py` | 26.2 | 600 | PASS |
| `quality/test_mandate_relation.py` | 25.8 | 600 | PASS |
| `quality/test_meter_bands.py` | 22.8 | 600 | PASS |
| `quality/test_songs_log.py` | 22.4 | 600 | PASS |
| `quality/test_homeoteleuton.py` | 22.1 | 600 | PASS |
| `quality/test_production_relations.py` | 21.9 | 600 | PASS |
| `quality/test_floor_window.py` | 21.6 | 600 | PASS |
| `quality/test_production_journal.py` | 21.5 | 600 | PASS |
| `quality/test_session_repairs.py` | 18.7 | 600 | PASS |
| `quality/test_relations.py` | 18.3 | 600 | PASS |
| `quality/test_within_item.py` | 17.6 | 600 | PASS |
| `quality/test_fit.py` | 14.9 | 600 | PASS |
| `quality/test_phrase_commonplace.py` | 14.8 | 600 | PASS |
| `quality/test_computational_audit.py` | 14.0 | 600 | PASS |
| `quality/test_crosslinguistic.py` | 13.8 | 600 | PASS |
| `quality/test_chance_rate.py` | 13.6 | 600 | PASS |
| `quality/test_nc_census.py` | 13.5 | 600 | PASS |
| `quality/test_sentencehood.py` | 13.3 | 600 | PASS |
| `quality/test_slots.py` | 12.9 | 600 | PASS |
| `quality/test_production_harness.py` | 12.2 | 600 | PASS |
| `quality/test_align.py` | 10.7 | 600 | PASS |
| `quality/test_door_census.py` | 10.6 | 600 | PASS |
| `quality/test_narrative.py` | 10.4 | 600 | PASS |
| `quality/test_structures.py` | 10.3 | 600 | PASS |
| `quality/test_suite_sweep.py` | 10.2 | 600 | PASS |
| `quality/test_declared_inputs.py` | 9.6 | 600 | PASS |
| `quality/test_capabilities.py` | 8.6 | 600 | PASS |
| `quality/test_cym.py` | 8.5 | 600 | PASS |
| `quality/test_positive_control.py` | 8.2 | 600 | PASS |
| `quality/test_placement.py` | 8.0 | 600 | PASS |
| `quality/test_ltc.py` | 7.6 | 600 | PASS |
| `quality/test_song_function.py` | 5.8 | 600 | PASS |
| `quality/test_melody.py` | 5.8 | 600 | PASS |
| `quality/test_time_layer.py` | 5.3 | 600 | PASS |
| `quality/test_readings_seam.py` | 4.1 | 600 | PASS |
| `quality/test_pin_sweep.py` | 3.9 | 600 | PASS |
| `quality/test_taxonomy.py` | 3.4 | 600 | PASS |
| `quality/test_corpus_taxonomy.py` | 3.0 | 600 | PASS |
| `quality/test_meter.py` | 2.7 | 600 | PASS |
| `quality/test_rhyme_organization.py` | 2.5 | 600 | PASS |
| `quality/test_phonology.py` | 2.3 | 600 | PASS |
| `quality/test_section_marks.py` | 2.2 | 600 | PASS |
| `quality/test_comparator_pin.py` | 2.0 | 600 | PASS |
| `quality/test_nucleus.py` | 1.8 | 600 | PASS |
| `quality/test_render_form.py` | 1.5 | 600 | PASS |
| `quality/test_tempo.py` | 1.4 | 600 | PASS |
| `quality/test_coda.py` | 1.4 | 600 | PASS |
| `quality/test_relation_shapes.py` | 1.3 | 600 | PASS |
| `quality/test_band.py` | 1.3 | 600 | PASS |
| `quality/test_interlocking_chain.py` | 1.0 | 600 | PASS |
| `quality/test_mut_band.py` | 0.9 | 600 | PASS |
| `quality/test_matrix.py` | 0.9 | 600 | PASS |
| `quality/test_verify_entries.py` | 0.8 | 600 | PASS |
| `quality/test_register_audit.py` | 0.8 | 600 | PASS |
| `quality/test_shard.py` | 0.5 | 600 | ERROR |
| `quality/test_stub_resolution.py` | 0.4 | 600 | PASS |
| `quality/test_phon_msa.py` | 0.4 | 600 | PASS |
| `quality/test_mandate_language.py` | 0.3 | 600 | PASS |
| `quality/test_candidate_pair_projection.py` | 0.3 | 600 | PASS |
| `quality/test_brief_provenance.py` | 0.3 | 600 | PASS |
| `quality/test_staging.py` | 0.2 | 600 | PASS |
| `quality/test_phon_san.py` | 0.2 | 600 | PASS |
| `quality/test_phon_non.py` | 0.2 | 600 | PASS |
| `quality/test_phon_fas.py` | 0.2 | 600 | PASS |
| `quality/test_verify_figures.py` | 0.1 | 600 | PASS |
| `quality/test_triage.py` | 0.1 | 600 | PASS |
| `quality/test_english_text.py` | 0.1 | 600 | PASS |
| `quality/test_data_row_claims.py` | 0.1 | 600 | PASS |
| `quality/test_controls.py` | 0.1 | 600 | PASS |
| `quality/test_battery_rounds.py` | 0.1 | 600 | PASS |
| `quality/test_songs.py` | 0.0 | 600 | PASS |
| `quality/test_ipa.py` | 0.0 | 600 | PASS |
| `quality/test_expected_drift.py` | 0.0 | 600 | PASS |

## The ERROR, diagnosed to the line

`quality/test_shard.py` is **PASS at head and ERROR in the shadow**, in 0.5 s,
re-confirmed in isolation (two attempts), so it is not load flakiness.

```
File ".../lyric-harness/quality/test_shard.py", line 721,
  in test_the_two_qualification_tables_cannot_drift_apart
    import production_qualification as PQ
ModuleNotFoundError: No module named 'production_qualification'
```

The shadow's top level was `['.claude', '.github', 'lyric-harness', 'mcp']`.
`SIBLING_RULES` mirrors those three directories beside the harness so a suite
reaching one level up reads what it reads at head (M-176). It did not mirror
`scripts`. That suite's qualification-table cross-check — added 2026-09-10 for
M-266 — reaches `<repo>/scripts` TWICE: `import production_qualification`
through the import path, and `node ... './scripts/verify_qualification.mjs'`
with cwd at the repo root. Only the first raised, because the import comes
first.

**It had been excluded from every mutation baseline for eight days**, and
`quality/test_shard.py` §6 is what pins the duplicate-run contract that
overturned BCI-07. A suite that grades a ruling was itself ungraded.

**FIXED**: `SIBLING_RULES` gains `("scripts", "tree")`. Verified sufficient
before it was written — with `scripts/` mirrored the suite is PASS in the
shadow in 0.9 s, node subprocess included. `verify_qualification.mjs` imports
only node builtins, so no `node_modules` is required; `scripts/` is 2.9 MB.

## What is NOT fixed, and the derivation that was refused

M-176 built a guard for exactly this —
`test_mutation.py` §3f, `test_the_shadow_reaches_what_the_suites_read`. It did
not catch this one because it is a **hand-written list** of the five paths
three suites read in August. A fourth reach added in September was invisible
to it: a list that is short looks exactly like a list that is complete.

A derived replacement was tried and **refused on its own measurement**.
Grepping the suites for quoted or slash-delimited repo-root directory names
returns:

```
.claude  .git  .github  assets  data  node_modules  scripts
```

It invents four — `data/` and `assets/` are HARNESS-internal directory names
that collide with repo-root ones, `.git` and `node_modules` are incidental —
and, worse, it **misses `mcp`**, whose reach lives in `verify_entries.py`
rather than in any `test_*.py`. A false negative here drops a detector
silently, which is the failure direction the section exists to stop. So the
derivation is not shipped and the list stays declared.

What is added instead is EXECUTION rather than assertion: `test_shard.py` now
RUNS inside the shadow beside the other two sub-second suites, where an import
and a subprocess are exercised instead of asserted about, and a check requires
every declared sibling that exists at the repo root to be present in the
shadow — so a rule that silently does nothing cannot read as a rule that works.

Mutation-proved: removing `("scripts", "tree")` reds exactly two checks — the
path assertion and the execution evidence — and leaves every control standing.

**THE CLASS REMAINS OPEN.** This is the instance repaired and the general
question left open, which is the same thing M-176 did, and saying so is the
point of this paragraph.

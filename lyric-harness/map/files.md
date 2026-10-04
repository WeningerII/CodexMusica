# Files

Everything tracked under `lyric-harness/`, sized in tokens (bytes ÷ 3.6, rounded). **ran** = at least one function in the file ran for the reference song.

| part | files | tokens |
|---|---:|---:|
| corpus (raw verse, measured offline) | 1430 | 9,200k |
| saved measurement results | 616 | 8,600k |
| data tables (read at run time) | 31 | 5,900k |
| notes and records (.md) | 118 | 1,400k |
| Python: tests | 113 | 1,200k |
| Python: song program (ran) | 53 | 1,200k |
| Python: research and record tools (never loaded) | 91 | 800k |
| other files | 97 | 190k |
| Python: loadable by the song program, not loaded | 12 | 58k |
| Python: imported by the song program, unused | 4 | 11k |

## Data the song program opened (46 files, 0 under corpus/)

In the repo: `data/LICENSE.cmudict` <1k, `data/LICENSE.perceptron-tagger` <1k, `data/eng_elision.tsv` <1k, `data/g2p_letter_rules.tsv` 100k, `data/kalevala_alliteration_pairs.tsv` 390k, `data/ltc_rhyme_standards.tsv` 3.6k, `data/opensubtitles_en_50k.tsv` 250k, `data/qieyun_mc.tsv` 140k, `data/qieyun_variants.tsv` 100k, `data/qindingcipu_aliases.tsv` 4.3k, `data/qindingcipu_ge.tsv` 200k, `data/rhyme_capacity_eng.tsv` 150k, `data/runtime_assets.json` 3.6k, `data/section_marks.tsv` 2.1k, `data/siku_orthography.tsv` 2.6k, `data/song_endword_en.tsv` 1,300k, `data/song_functions_eng.tsv` <1k, `data/song_regions.tsv` <1k, `data/song_rhymepair_en.tsv` 1,100k, `data/sources.tsv` 450k, `data/structure_canon.tsv` 51k, `data/structure_census_eng.tsv` 540k, `quality/canon_index.tsv` 27k.

Fetched or staged, not in the repo: `cmudict.dict`, `data/concreteness.txt`, `data/nltk/corpora/` (18 files), `data/nltk/taggers/` (3 files).

## Python — ran (53)

`lyric_harness.py` 210k, `quality/relations.py` 130k, `quality/revise.py` 110k, `quality/plan.py` 63k, `quality/grid.py` 63k, `quality/floor.py` 51k, `quality/schemes.py` 45k, `quality/loop.py` 37k, `quality/rhyme_types.py` 35k, `quality/fit.py` 30k, `quality/song_profile_calibration.py` 28k, `quality/canon_sources.py` 24k, `quality/propose.py` 22k, `quality/rhyme_constraints.py` 21k, `quality/phonology/cym.py` 20k, `quality/g2p.py` 16k, `quality/phonology/fin.py` 15k, `quality/length_curve_calibration.py` 14k, `quality/phonology/msa.py` 14k, `quality/phonology/non.py` 13k, `quality/features.py` 13k, `quality/phonology/fas.py` 12k, `quality/phonology/ltc.py` 11k, `quality/frequency.py` 11k, `quality/chance_rate.py` 10k, `quality/readability.py` 8.9k, `quality/slots.py` 8.9k, `quality/discriminate.py` 8.8k, `quality/provenance.py` 8.7k, `quality/recover.py` 8.2k, `quality/phonology/san.py` 7.8k, `quality/meter.py` 7.7k, `quality/meter_bands.py` 7.1k, `quality/field_store.py` 6.7k, `quality/phonology/eng.py` 6k, `quality/phonology/__init__.py` 5.8k, `quality/morphology.py` 5.5k, `quality/type_canon.py` 5.4k, `quality/quotients.py` 5.2k, `quality/narrative.py` 4.4k, `quality/brief_provenance.py` 4.2k, `quality/sentencehood.py` 3.8k, `quality/replay_memo.py` 3.7k, `quality/structures.py` 3.6k, `quality/pronunciation.py` 3.6k, `quality/within_item.py` 3.2k, `quality/calibration_rebuild.py` 3.2k, `quality/release_assets.py` 2.8k, `quality/phonology/som.py` 2.7k, `quality/tempo.py` 1.9k, `quality/lyric_reader.py` 1.3k, `quality/line_relations.py` 1.1k, `quality/span_rules.py` <1k

## Python — imported, no function ran (4)

`quality/redteam_band.py` 9.5k, `quality/corpus.py` 1.2k, `quality/battery_pin.py` <1k, `quality/__init__.py` <1k

## Python — loadable, not loaded (12)

`quality/capacity.py` 14k, `quality/cross_song.py` 8.6k, `battery.py` 6.5k, `quality/build_song_frequency.py` 4.7k, `quality/relation_index.py` 3.9k, `quality/metric_complexity.py` 3.8k, `quality/song_record.py` 3.7k, `quality/senses.py` 3.4k, `quality/narrative_bands.py` 3.3k, `quality/check_data_rows.py` 3.1k, `quality/source_identity.py` 2k, `quality/melody.py` <1k

## Python — never loaded by a song (91)

`quality/relations_null.py` 55k, `quality/audit_corpus.py` 44k, `quality/audit_register.py` 42k, `quality/verify_entries.py` 41k, `quality/mutate.py` 40k, `quality/counters.py` 33k, `quality/build_ci_corpus.py` 24k, `quality/prasa_rate.py` 21k, `quality/verify_doctrines.py` 20k, `quality/declared_inputs.py` 17k, `quality/hafez_rate.py` 16k, `quality/song_log.py` 15k, `quality/negative_control.py` 15k, `quality/audit_kalevala_null.py` 15k, `quality/phrase_commonplace.py` 14k, `quality/time_layer.py` 13k, `quality/gate_census.py` 13k, `quality/relation_shapes.py` 13k, `quality/structure_census.py` 12k, `quality/cym_rhyme_rate.py` 12k, `quality/audit_fwer_fpr.py` 11k, `quality/audit_spans.py` 11k, `quality/kalevala_rate.py` 10k, `quality/near_relation_pricing.py` 8.9k, `quality/door_census.py` 8.9k, `quality/time_attainable.py` 8.9k, `quality/audit_joint_auc_null.py` 8.7k, `quality/fin_rhyme_rate.py` 8.5k, `quality/pin_sweep.py` 8.3k, `quality/audit_band_control.py` 7.9k, `data/labels/finnic_variant_counts/build_finnic_variant_counts.py` 7.6k, `map/build.py` 7.5k, `quality/schema_census.py` 7.5k, `quality/search_null.py` 7.2k, `quality/triage.py` 7.1k, `quality/figure_exhibits.py` 7.1k, `quality/ban_convergence.py` 6.9k, `quality/mark_coverage.py` 6.4k, `quality/check_render_form.py` 6.4k, `quality/corpus_taxonomy.py` 5.9k, `quality/fit_matrix.py` 5.6k, `quality/run_positive_control.py` 5.6k, `quality/suite_sweep.py` 5.5k, `quality/fwer_family.py` 5.2k, `quality/cynghanedd_rate.py` 5.2k, `quality/internal_rhyme_rate.py` 4.7k, `quality/graph_probe.py` 4.6k, `quality/controls.py` 4.4k, `quality/stage_sagadb.py` 4.4k, `quality/som_channel_audit.py` 4.4k, `quality/positive_control.py` 4.4k, `quality/ltc_overlap.py` 4.3k, `data/labels/ja_hyakunin_isshu/build_ja_hyakunin_isshu.py` 4.2k, `quality/schema_end_reading.py` 4.1k, `quality/audit_hafez_radif.py` 4k, `data/labels/sa_subhasita/build_sa_subhasita.py` 4k, `quality/corpus_manifest.py` 3.9k, `quality/kalevala_calibration.py` 3.7k, `quality/regrade_verdicts.py` 3.6k, `quality/song_shape.py` 3.6k, `quality/eval_matrix.py` 3.5k, `quality/coverage_log.py` 3.5k, `quality/rhyme_organization.py` 3.4k, `quality/populate_authority.py` 3.3k, `quality/sourced_tables.py` 3.3k, `data/labels/pa_bani/build_pa_bani.py` 3.3k, `quality/schema_window.py` 3.3k, `quality/audit_tang_null.py` 3.1k, `quality/section_marks.py` 3.1k, `quality/verify_figures.py` 3k, `quality/audit_rhyme_organization.py` 2.9k, `quality/audit_time_pooled_null.py` 2.9k, `quality/figures.py` 2.5k, `quality/prove_relation_index.py` 2.4k, `quality/backlog_status.py` 2.3k, `quality/check_comparator_pin.py` 2.3k, `data/labels/sa_amarusataka/build_sa_amarusataka.py` 2.2k, `quality/expected_drift.py` 2.2k, `quality/verify_capacity.py` 2k, `data/labels/sa_subhasita/gretil_io.py` 1.9k, `quality/shard.py` 1.7k, `quality/battery_rounds.py` 1.6k, `quality/recertify_capacity.py` 1.6k, `quality/fold_series.py` 1.6k, `quality/fetch_data.py` 1.6k, `data/labels/finnic_variant_counts/verify.py` 1.5k, `quality/gate_corpora.py` 1.4k, `quality/m40_poet_cells.py` 1.4k, `quality/e5_coda_adoption.py` 1.3k, `quality/results/m170_2026-09-17/predicate_probe.py` <1k, `quality/results/m244_ci_2026-09-17/observation-control-command.py` <1k

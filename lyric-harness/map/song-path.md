# Song path

What runs when each lyric tool is called, from one profiled run of the reference song (`map/song.txt`, 16 lines) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

259 named harness functions ran, in 20 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 70%
- `quality/plan.py:sweep` 15%
  - `quality/plan.py:_sweep_one` 15%
    - `quality/plan.py:make_plan` 15%
      - `quality/plan.py:_redraw_past_joint_gate` 15%
- `quality/relations.py:_build_traditions` 6%
  - `quality/canon_sources.py:scope_witness` 5%
    - `quality/canon_sources.py:attribute` 4%
      - `quality/canon_sources.py:_tokens` 4%
      - `quality/canon_sources.py:_distinctive` 4%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 29%, `quality/schemes.py:rgs.rec` 5%, `quality/plan.py:_scheme_for` 2%, `lyric_harness.py:_request_scoped_reader_scheme.wrapper` 1%, `quality/plan.py:_sample_pattern` 1%, `quality/schemes.py:rgs` 0%


## lyric_screen

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

679 named harness functions ran, in 42 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:screen_pairs` 98%
  - `quality/revise.py:Reviser.inspect` 81%
    - `quality/floor.py:SlopFloor.check` 47%
      - `quality/features.py:QualityFeatures._predictability` 46%
    - `quality/revise.py:Reviser.grade` 18%
      - `quality/relations.py:whole_vocabulary_pairs` 17%
    - `quality/revise.py:Reviser.earned_pair_ban` 11%
      - `quality/revise.py:Reviser.modal_head_evidenced` 11%
    - `quality/revise.py:Reviser._band_findings` 4%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 3%
  - `quality/revise.py:Reviser.__init__` 11%
    - `quality/floor.py:SlopFloor.__init__` 11%
      - `quality/features.py:QualityFeatures.__init__` 7%
      - `quality/field_store.py:attach` 3%
  - `lyric_harness.py:end_pair_relations` 6%
    - `quality/relations.py:pair_satisfies_any` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 5%
  - `lyric_harness.py:Lexicon.__init__` 11%

Most time spent inside the function itself: `lyric_harness.py:score` 13%, `lyric_harness.py:Lexicon.__init__` 6%, `lyric_harness.py:shared_ending` 4%, `lyric_harness.py:channel_agreement` 4%, `lyric_harness.py:cluster_sim` 3%, `lyric_harness.py:cons_sim` 2%


## lyric_plan

Runs `lyric_harness.py` `plan`.

261 named harness functions ran, in 20 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 84%
- `quality/relations.py:_build_traditions` 7%
  - `quality/canon_sources.py:scope_witness` 5%
    - `quality/canon_sources.py:attribute` 5%
      - `quality/canon_sources.py:_tokens` 4%
      - `quality/canon_sources.py:_distinctive` 4%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 34%, `lyric_harness.py:_request_scoped_reader_scheme.wrapper` 1%, `quality/canon_sources.py:_tokens` 0%, `quality/canon_sources.py:_distinctive` 0%, `quality/canon_sources.py:attribute` 0%, `quality/plan.py:meter_factorisations` 0%


## lyric_grade

Runs `lyric_harness.py` `--lexicon-supplement=v2`, `plan`.

949 named harness functions ran, in 52 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 70%
  - `quality/revise.py:Reviser.inspect` 48%
    - `quality/revise.py:Reviser.grade` 24%
      - `quality/relations.py:whole_vocabulary_pairs` 24%
    - `quality/revise.py:Reviser.earned_pair_ban` 19%
      - `quality/revise.py:Reviser.modal_head_evidenced` 19%
    - `quality/floor.py:SlopFloor.check` 9%
      - `quality/features.py:QualityFeatures._predictability` 9%
    - `quality/revise.py:Reviser._band_findings` 3%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 3%
  - `quality/revise.py:Reviser.brief` 47%
  - `quality/schema_instance_evidence.py:for_grade` 13%
    - `quality/schema_instance_evidence.py:_for_grade` 13%
      - `quality/schema_instance_evidence.py:from_stream` 12%
- `lyric_harness.py:Lexicon.__init__` 21%
- `quality/revise.py:Reviser.__init__` 18%
  - `quality/floor.py:SlopFloor.__init__` 18%
    - `quality/features.py:QualityFeatures.__init__` 13%
      - `quality/features.py:RhymeField.__init__` 8%
    - `quality/field_store.py:attach` 5%
      - `quality/field_store.py:store_identity` 5%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 6%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 10%, `library/contracts.py:json_safe` 3%, `quality/relations.py:evaluate` 3%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:split_phone` 3%, `quality/relations.py:tri_and` 3%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `--lexicon-supplement=v2`.

1083 named harness functions ran, in 53 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 79%
  - `quality/loop.py:_VerdictCache.brief` 61%
    - `quality/loop.py:_VerdictCache._gate` 79%
      - `quality/loop.py:Deadline.step` 79%
    - `quality/loop.py:_VerdictCache._menu` 31%
    - `lyric_harness.py:best_score` 6%
      - `lyric_harness.py:score` 22%
    - `quality/revise.py:Reviser._member` 4%
      - `quality/revise.py:Reviser._field_split` 29%
      - `quality/revise.py:Reviser._word_anchors` 7%
      - `quality/revise.py:Reviser._offerable` 4%
  - `quality/loop.py:revise_loop._materialize` 31%
  - `quality/loop.py:_try_tier1` 17%
    - `quality/loop.py:_VerdictCache.verify` 17%
  - `lyric_harness.py:_defer_proposer.prefetch` 6%
- `quality/revise.py:Reviser.__init__` 13%
  - `quality/floor.py:SlopFloor.__init__` 13%
    - `quality/features.py:QualityFeatures.__init__` 9%
      - `lyric_harness.py:Lexicon.__init__` 13%
      - `quality/features.py:RhymeField.__init__` 6%
    - `quality/field_store.py:attach` 4%
      - `quality/field_store.py:store_identity` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 5%
- `quality/schema_instance_evidence.py:for_grade` 4%
  - `quality/schema_instance_evidence.py:_for_grade` 4%
    - `quality/schema_instance_evidence.py:from_stream` 4%
      - `quality/relations.py:realise` 12%
    - `quality/relations.py:build_stream` 3%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 7%, `lyric_harness.py:score` 6%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:split_phone` 3%, `quality/frequency.py:_count_rows` 2%, `quality/relations.py:evaluate` 2%


## lyric_recover

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

481 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/recover.py:recover_file` 82%
  - `quality/recover.py:recover` 82%
    - `quality/relations.py:whole_vocabulary_pairs` 72%
      - `quality/relations.py:line_pairs_for` 72%
    - `lyric_harness.py:best_score` 3%
    - `quality/relations.py:_alts` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 18%
  - `lyric_harness.py:Lexicon.__init__` 34%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 16%, `quality/relations.py:evaluate` 7%, `quality/relations.py:_set_agree` 4%, `quality/relations.py:_alts` 2%, `quality/relations.py:ChannelSet.read` 2%, `quality/relations.py:align_flush_right` 2%


## lyric_check

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

770 named harness functions ran, in 48 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 90%
  - `quality/revise.py:Reviser.brief` 84%
    - `quality/revise.py:Reviser.brief._build` 66%
      - `quality/revise.py:Reviser._place_field` 66%
    - `quality/revise.py:Reviser.inspect` 19%
      - `quality/revise.py:Reviser.earned_pair_ban` 9%
      - `quality/revise.py:Reviser.grade` 7%
    - `lyric_harness.py:best_score` 10%
      - `lyric_harness.py:score` 40%
    - `quality/revise.py:Reviser._member` 5%
      - `quality/revise.py:Reviser._field_split` 53%
      - `quality/revise.py:Reviser._word_anchors` 9%
      - `quality/revise.py:Reviser._offerable` 5%
  - `quality/schema_instance_evidence.py:for_grade` 5%
    - `quality/schema_instance_evidence.py:_for_grade` 5%
      - `quality/schema_instance_evidence.py:from_stream` 5%
- `quality/revise.py:Reviser.__init__` 8%
  - `quality/floor.py:SlopFloor.__init__` 8%
    - `quality/features.py:QualityFeatures.__init__` 6%
      - `lyric_harness.py:Lexicon.__init__` 8%
      - `quality/features.py:RhymeField.__init__` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 3%

Most time spent inside the function itself: `lyric_harness.py:score` 11%, `lyric_harness.py:Lexicon.__init__` 4%, `lyric_harness.py:shared_ending` 3%, `lyric_harness.py:cluster_sim` 3%, `lyric_harness.py:channel_agreement` 3%, `lyric_harness.py:nucleus_agrees` 2%


## lyric_verify

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

698 named harness functions ran, in 43 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 77%
  - `quality/revise.py:Reviser.brief` 66%
    - `quality/revise.py:Reviser.inspect` 50%
      - `quality/revise.py:Reviser.earned_pair_ban` 19%
      - `quality/revise.py:Reviser.grade` 19%
      - `quality/floor.py:SlopFloor.check` 7%
      - `quality/revise.py:Reviser._band_findings` 4%
    - `quality/revise.py:Reviser.brief._build` 27%
      - `quality/revise.py:Reviser._place_field` 27%
    - `lyric_harness.py:best_score` 5%
      - `lyric_harness.py:score` 20%
- `quality/revise.py:Reviser.__init__` 19%
  - `quality/floor.py:SlopFloor.__init__` 19%
    - `quality/features.py:QualityFeatures.__init__` 14%
      - `lyric_harness.py:Lexicon.__init__` 14%
      - `quality/features.py:RhymeField.__init__` 9%
    - `quality/field_store.py:attach` 5%
      - `quality/field_store.py:store_identity` 5%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 6%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 7%, `lyric_harness.py:score` 5%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:split_phone` 3%, `lyric_harness.py:coda_agrees` 2%, `quality/frequency.py:_count_rows` 2%


## lyric_types

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

443 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:end_pair_relations` 62%
  - `quality/relations.py:build_stream` 31%
    - `quality/phonology/eng.py:English.tokens_for_line` 30%
      - `quality/phonology/eng.py:English._aside_rule` 30%
  - `lyric_harness.py:_screen_not_applicable` 31%
    - `quality/relations.py:placement_bindable` 31%
      - `quality/relations.py:_build_traditions` 3%
  - `quality/relations.py:pair_satisfies_any` 29%
    - `quality/relations.py:pair_satisfies` 29%
      - `quality/relations.py:evaluate` 29%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 30%
  - `lyric_harness.py:Lexicon.__init__` 87%
- `quality/type_canon.py:label` 4%
  - `quality/type_canon.py:scope` 4%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 42%, `quality/phonology/ltc.py:_load_table` 1%, `quality/morphology.py:segment` 1%, `quality/phonology/ltc.py:_load_variants` 0%, `quality/morphology.py:_known_words` 0%, `quality/canon_sources.py:_tokens` 0%


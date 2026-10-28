# Song path

What runs when each lyric tool is called, from one profiled run of the reference song (`map/song.txt`, 16 lines) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

261 named harness functions ran, in 20 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 76%
  - `lyric_harness.py:fetch_data` 4%
    - `quality/relations.py:_build_traditions` 6%
      - `quality/canon_sources.py:scope_witness` 5%
- `quality/plan.py:sweep` 11%
  - `quality/plan.py:_sweep_one` 11%
    - `quality/plan.py:make_plan` 11%
      - `quality/plan.py:_redraw_past_joint_gate` 11%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 28%, `quality/schemes.py:rgs.rec` 3%, `quality/plan.py:_scheme_for` 2%, `lyric_harness.py:_request_scoped_reader_scheme.wrapper` 1%, `quality/plan.py:_sample_pattern` 0%, `quality/canon_sources.py:_tokens` 0%


## lyric_screen

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

661 named harness functions ran, in 42 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:screen_pairs` 97%
  - `quality/revise.py:Reviser.inspect` 76%
    - `quality/floor.py:SlopFloor.check` 47%
      - `quality/features.py:QualityFeatures._predictability` 47%
    - `quality/revise.py:Reviser.grade` 22%
      - `quality/relations.py:whole_vocabulary_pairs` 21%
    - `quality/revise.py:Reviser._band_findings` 6%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 5%
  - `quality/revise.py:Reviser.__init__` 13%
    - `quality/floor.py:SlopFloor.__init__` 13%
      - `quality/features.py:QualityFeatures.__init__` 9%
      - `quality/field_store.py:attach` 3%
  - `lyric_harness.py:end_pair_relations` 8%
    - `quality/relations.py:pair_satisfies_any` 4%
      - `quality/relations.py:pair_satisfies` 4%
    - `quality/relations.py:build_stream` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 7%
  - `lyric_harness.py:Lexicon.__init__` 15%

Most time spent inside the function itself: `lyric_harness.py:score` 13%, `lyric_harness.py:Lexicon.__init__` 8%, `lyric_harness.py:shared_ending` 4%, `lyric_harness.py:cluster_sim` 4%, `lyric_harness.py:channel_agreement` 4%, `lyric_harness.py:cons_sim` 2%


## lyric_plan

Runs `lyric_harness.py` `plan`.

262 named harness functions ran, in 20 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 82%
- `quality/relations.py:_build_traditions` 8%
  - `quality/canon_sources.py:scope_witness` 6%
    - `quality/canon_sources.py:attribute` 6%
      - `quality/canon_sources.py:_tokens` 5%
      - `quality/canon_sources.py:_distinctive` 5%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 33%, `lyric_harness.py:_request_scoped_reader_scheme.wrapper` 2%, `quality/plan.py:meter_factorisations` 1%, `quality/canon_sources.py:_tokens` 0%, `quality/canon_sources.py:_distinctive` 0%, `quality/canon_sources.py:attribute` 0%


## lyric_grade

Runs `lyric_harness.py` `--lexicon-supplement=v2`, `plan`.

933 named harness functions ran, in 52 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 65%
  - `quality/revise.py:Reviser.inspect` 34%
    - `quality/revise.py:Reviser.grade` 29%
      - `quality/relations.py:whole_vocabulary_pairs` 27%
    - `quality/floor.py:SlopFloor.check` 9%
      - `quality/features.py:QualityFeatures._predictability` 9%
    - `quality/revise.py:Reviser._band_findings` 6%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 5%
  - `quality/revise.py:Reviser.brief` 33%
  - `quality/schema_instance_evidence.py:for_grade` 18%
    - `quality/schema_instance_evidence.py:_for_grade` 18%
      - `quality/schema_instance_evidence.py:from_stream` 16%
- `lyric_harness.py:Lexicon.__init__` 24%
- `quality/revise.py:Reviser.__init__` 23%
  - `quality/floor.py:SlopFloor.__init__` 23%
    - `quality/features.py:QualityFeatures.__init__` 17%
      - `quality/features.py:RhymeField.__init__` 9%
      - `quality/features.py:staged_resources_or_refuse` 5%
    - `quality/field_store.py:attach` 6%
      - `quality/field_store.py:store_identity` 6%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 9%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 12%, `library/contracts.py:json_safe` 7%, `quality/relations.py:evaluate` 3%, `lyric_harness.py:score` 2%, `lyric_harness.py:syllabify` 2%, `quality/relations.py:_set_agree` 2%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `--lexicon-supplement=v2`.

1088 named harness functions ran, in 53 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 71%
  - `quality/loop.py:_try_tier2` 43%
    - `quality/loop.py:_VerdictCache.member_place_field` 41%
      - `quality/loop.py:_VerdictCache._menu` 43%
    - `quality/loop.py:_VerdictCache.verify` 5%
      - `quality/loop.py:_VerdictCache._gate` 71%
  - `quality/loop.py:_VerdictCache.brief` 24%
  - `quality/loop.py:_try_tier1` 4%
- `quality/revise.py:Reviser.__init__` 22%
  - `quality/floor.py:SlopFloor.__init__` 22%
    - `quality/features.py:QualityFeatures.__init__` 16%
      - `lyric_harness.py:Lexicon.__init__` 19%
      - `quality/features.py:RhymeField.__init__` 9%
      - `quality/features.py:staged_resources_or_refuse` 4%
    - `quality/field_store.py:attach` 6%
      - `quality/field_store.py:store_identity` 6%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 8%
- `quality/revise.py:Reviser._member` 7%
  - `quality/revise.py:Reviser._field_split` 27%
    - `quality/revise.py:_engine_candidates` 14%
      - `lyric_harness.py:CandidateEngine.candidates` 14%
    - `quality/revise.py:Reviser._word_anchors` 5%
      - `lyric_harness.py:line_anchors` 6%
    - `quality/revise.py:Reviser.engine` 4%
      - `lyric_harness.py:CandidateEngine.__init__` 4%
    - `lyric_harness.py:best_score` 4%
      - `lyric_harness.py:score` 16%
  - `quality/revise.py:Reviser._offerable` 7%
    - `quality/revise.py:Reviser._end_pair_schemas` 7%
      - `quality/relations.py:whole_vocabulary_pairs` 18%
      - `quality/relations.py:build_stream` 4%
      - `lyric_harness.py:_screen_not_applicable` 3%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 10%, `lyric_harness.py:score` 4%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:split_phone` 3%, `quality/relations.py:evaluate` 2%, `quality/frequency.py:_count_rows` 1%


## lyric_recover

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

482 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/recover.py:recover_file` 85%
  - `quality/recover.py:recover` 85%
    - `quality/relations.py:whole_vocabulary_pairs` 74%
      - `quality/relations.py:line_pairs_for` 73%
    - `lyric_harness.py:best_score` 4%
      - `lyric_harness.py:score` 3%
    - `quality/relations.py:_alts` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 14%
  - `lyric_harness.py:Lexicon.__init__` 32%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 14%, `quality/relations.py:evaluate` 7%, `quality/relations.py:_set_agree` 4%, `quality/relations.py:_alts` 3%, `quality/relations.py:ChannelSet.read` 2%, `quality/relations.py:align_flush_right` 2%


## lyric_check

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

723 named harness functions ran, in 48 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 55%
  - `quality/revise.py:Reviser.inspect` 37%
    - `quality/revise.py:Reviser.grade` 25%
      - `quality/relations.py:whole_vocabulary_pairs` 24%
    - `quality/revise.py:Reviser._band_findings` 10%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 9%
  - `quality/revise.py:Reviser.brief` 36%
  - `quality/schema_instance_evidence.py:for_grade` 19%
    - `quality/schema_instance_evidence.py:_for_grade` 19%
      - `quality/schema_instance_evidence.py:from_stream` 17%
- `quality/revise.py:Reviser.__init__` 38%
  - `quality/floor.py:SlopFloor.__init__` 38%
    - `quality/features.py:QualityFeatures.__init__` 27%
      - `lyric_harness.py:Lexicon.__init__` 29%
      - `quality/features.py:RhymeField.__init__` 16%
      - `quality/features.py:staged_resources_or_refuse` 5%
    - `quality/field_store.py:attach` 11%
      - `quality/field_store.py:store_identity` 11%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 16%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 15%, `library/contracts.py:json_safe` 5%, `lyric_harness.py:syllabify` 3%, `quality/relations.py:evaluate` 3%, `lyric_harness.py:split_phone` 3%, `quality/relations.py:align_anchor` 2%


## lyric_verify

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

651 named harness functions ran, in 43 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 55%
  - `quality/revise.py:Reviser.inspect` 55%
    - `quality/revise.py:Reviser.grade` 32%
      - `quality/relations.py:whole_vocabulary_pairs` 30%
    - `quality/floor.py:SlopFloor.check` 12%
      - `quality/features.py:QualityFeatures._predictability` 12%
    - `quality/revise.py:Reviser._band_findings` 10%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 9%
- `quality/revise.py:Reviser.__init__` 38%
  - `quality/floor.py:SlopFloor.__init__` 38%
    - `quality/features.py:QualityFeatures.__init__` 30%
      - `lyric_harness.py:Lexicon.__init__` 30%
      - `quality/features.py:RhymeField.__init__` 16%
      - `quality/features.py:staged_resources_or_refuse` 7%
    - `quality/field_store.py:attach` 8%
      - `quality/field_store.py:store_identity` 8%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 15%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 16%, `lyric_harness.py:syllabify` 3%, `quality/relations.py:evaluate` 3%, `lyric_harness.py:score` 3%, `lyric_harness.py:split_phone` 3%, `quality/relations.py:_set_agree` 2%


## lyric_types

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

444 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:end_pair_relations` 66%
  - `quality/relations.py:pair_satisfies_any` 35%
    - `quality/relations.py:pair_satisfies` 35%
      - `quality/relations.py:evaluate` 35%
  - `quality/relations.py:build_stream` 29%
    - `quality/phonology/eng.py:English.tokens_for_line` 28%
      - `quality/phonology/eng.py:English._aside_rule` 28%
  - `lyric_harness.py:_screen_not_applicable` 29%
    - `quality/relations.py:placement_bindable` 29%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 26%
  - `lyric_harness.py:Lexicon.__init__` 87%
- `quality/type_canon.py:label` 4%
  - `quality/type_canon.py:scope` 4%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 43%, `quality/phonology/ltc.py:_load_table` 1%, `quality/morphology.py:segment` 1%, `quality/phonology/ltc.py:_load_variants` 0%, `lyric_harness.py:fold_apostrophes` 0%, `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 0%


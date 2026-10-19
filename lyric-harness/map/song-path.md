# Song path

What runs when each lyric tool is called, from one profiled run of the reference song (`map/song.txt`, 16 lines) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

255 named harness functions ran, in 20 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 77%
- `quality/plan.py:sweep` 10%
  - `quality/plan.py:_sweep_one` 10%
    - `quality/plan.py:make_plan` 10%
      - `quality/plan.py:_make_plan_candidate` 10%
- `quality/relations.py:_build_traditions` 7%
  - `quality/canon_sources.py:scope_witness` 5%
    - `quality/canon_sources.py:attribute` 4%
      - `quality/canon_sources.py:_tokens` 4%
      - `quality/canon_sources.py:_distinctive` 3%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 23%, `quality/schemes.py:rgs.rec` 3%, `lyric_harness.py:_request_scoped_reader_scheme.wrapper` 1%, `quality/plan.py:_sample_pattern` 0%, `quality/canon_sources.py:_tokens` 0%, `quality/schemes.py:rgs` 0%


## lyric_screen

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

679 named harness functions ran, in 42 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:screen_pairs` 98%
  - `quality/revise.py:Reviser.inspect` 73%
    - `quality/floor.py:SlopFloor.check` 39%
      - `quality/features.py:QualityFeatures._predictability` 39%
    - `quality/revise.py:Reviser.grade` 17%
      - `quality/relations.py:whole_vocabulary_pairs` 16%
    - `quality/revise.py:Reviser.earned_pair_ban` 11%
      - `quality/revise.py:Reviser.modal_head_evidenced` 11%
    - `quality/revise.py:Reviser._band_findings` 5%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 4%
  - `quality/revise.py:Reviser.__init__` 18%
    - `quality/floor.py:SlopFloor.__init__` 18%
      - `quality/features.py:QualityFeatures.__init__` 14%
      - `quality/field_store.py:attach` 4%
  - `lyric_harness.py:end_pair_relations` 7%
    - `quality/relations.py:pair_satisfies_any` 4%
      - `quality/relations.py:pair_satisfies` 3%
    - `quality/relations.py:build_stream` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 6%
  - `lyric_harness.py:Lexicon.__init__` 14%

Most time spent inside the function itself: `lyric_harness.py:score` 11%, `lyric_harness.py:Lexicon.__init__` 4%, `lyric_harness.py:cluster_sim` 4%, `lyric_harness.py:shared_ending` 3%, `lyric_harness.py:channel_agreement` 3%, `lyric_harness.py:cons_sim` 2%


## lyric_plan

Runs `lyric_harness.py` `plan`.

257 named harness functions ran, in 20 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 84%
- `quality/relations.py:_build_traditions` 7%
  - `quality/canon_sources.py:scope_witness` 5%
    - `quality/canon_sources.py:attribute` 5%
      - `quality/canon_sources.py:_tokens` 4%
      - `quality/canon_sources.py:_distinctive` 4%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 24%, `lyric_harness.py:_request_scoped_reader_scheme.wrapper` 2%, `quality/canon_sources.py:_tokens` 0%, `quality/plan.py:meter_factorisations` 0%, `quality/canon_sources.py:scope_witness` 0%, `quality/canon_sources.py:_distinctive` 0%


## lyric_grade

Runs `lyric_harness.py` `--lexicon-supplement=v2`, `plan`.

946 named harness functions ran, in 52 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 64%
  - `quality/revise.py:Reviser.inspect` 44%
    - `quality/revise.py:Reviser.grade` 21%
      - `quality/relations.py:whole_vocabulary_pairs` 21%
    - `quality/revise.py:Reviser.earned_pair_ban` 16%
      - `quality/revise.py:Reviser.modal_head_evidenced` 16%
    - `quality/floor.py:SlopFloor.check` 8%
      - `quality/features.py:QualityFeatures._predictability` 8%
    - `quality/revise.py:Reviser._band_findings` 6%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 5%
  - `quality/revise.py:Reviser.brief` 44%
  - `quality/schema_instance_evidence.py:for_grade` 12%
    - `quality/schema_instance_evidence.py:_for_grade` 12%
      - `quality/schema_instance_evidence.py:from_stream` 11%
- `quality/revise.py:Reviser.__init__` 26%
  - `quality/floor.py:SlopFloor.__init__` 26%
    - `quality/features.py:QualityFeatures.__init__` 20%
      - `lyric_harness.py:Lexicon.__init__` 22%
      - `quality/features.py:RhymeField.__init__` 9%
      - `quality/features.py:staged_resources_or_refuse` 8%
    - `quality/field_store.py:attach` 6%
      - `quality/field_store.py:store_identity` 6%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 8%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 6%, `lyric_harness.py:split_phone` 4%, `quality/relations.py:evaluate` 3%, `quality/relations.py:ChannelSet.read` 3%, `library/contracts.py:json_safe` 3%, `lyric_harness.py:syllabify` 2%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `--lexicon-supplement=v2`.

1094 named harness functions ran, in 53 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 78%
  - `quality/loop.py:_VerdictCache.brief` 49%
    - `quality/loop.py:_VerdictCache._gate` 77%
      - `quality/loop.py:Deadline.step` 77%
    - `quality/loop.py:_VerdictCache._menu` 31%
    - `lyric_harness.py:best_score` 7%
      - `lyric_harness.py:score` 24%
    - `quality/revise.py:Reviser._member` 5%
      - `quality/revise.py:Reviser._field_split` 32%
      - `quality/revise.py:Reviser._word_anchors` 7%
      - `quality/revise.py:Reviser._offerable` 5%
  - `quality/loop.py:revise_loop._materialize` 23%
  - `quality/loop.py:_try_tier1` 19%
    - `quality/loop.py:_VerdictCache.verify` 19%
  - `quality/loop.py:_try_tier2` 8%
    - `quality/loop.py:_VerdictCache.member_place_field` 8%
- `quality/revise.py:Reviser.__init__` 16%
  - `quality/floor.py:SlopFloor.__init__` 16%
    - `quality/features.py:QualityFeatures.__init__` 13%
      - `lyric_harness.py:Lexicon.__init__` 13%
      - `quality/features.py:RhymeField.__init__` 5%
      - `quality/features.py:staged_resources_or_refuse` 5%
    - `quality/field_store.py:attach` 4%
      - `quality/field_store.py:store_identity` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 5%
- `quality/schema_instance_evidence.py:for_grade` 3%
  - `quality/schema_instance_evidence.py:_for_grade` 3%
    - `quality/relations.py:build_stream` 3%
      - `quality/phonology/eng.py:English.tokens_for_line` 3%
    - `quality/schema_instance_evidence.py:from_stream` 3%
      - `quality/relations.py:realise` 11%

Most time spent inside the function itself: `lyric_harness.py:score` 7%, `lyric_harness.py:Lexicon.__init__` 4%, `lyric_harness.py:split_phone` 3%, `lyric_harness.py:syllabify` 2%, `lyric_harness.py:channel_agreement` 2%, `lyric_harness.py:cluster_sim` 2%


## lyric_recover

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

481 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/recover.py:recover_file` 84%
  - `quality/recover.py:recover` 84%
    - `quality/relations.py:whole_vocabulary_pairs` 73%
      - `quality/relations.py:line_pairs_for` 73%
    - `lyric_harness.py:best_score` 4%
    - `quality/relations.py:_alts` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 16%
  - `lyric_harness.py:Lexicon.__init__` 31%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 9%, `quality/relations.py:evaluate` 8%, `quality/relations.py:_set_agree` 4%, `quality/relations.py:_alts` 3%, `quality/relations.py:ChannelSet.read` 2%, `quality/relations.py:_span_tokens` 2%


## lyric_check

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

770 named harness functions ran, in 48 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 87%
  - `quality/revise.py:Reviser.brief` 81%
    - `quality/revise.py:Reviser.brief._build` 66%
      - `quality/revise.py:Reviser._place_field` 66%
    - `quality/revise.py:Reviser.inspect` 17%
      - `lyric_harness.py:best_score` 10%
      - `quality/revise.py:Reviser.earned_pair_ban` 7%
      - `quality/revise.py:Reviser.grade` 7%
      - `quality/revise.py:Reviser._member` 5%
  - `quality/schema_instance_evidence.py:for_grade` 5%
    - `quality/schema_instance_evidence.py:_for_grade` 5%
      - `quality/schema_instance_evidence.py:from_stream` 4%
- `quality/revise.py:Reviser.__init__` 11%
  - `quality/floor.py:SlopFloor.__init__` 11%
    - `quality/features.py:QualityFeatures.__init__` 9%
      - `lyric_harness.py:Lexicon.__init__` 8%
      - `quality/features.py:RhymeField.__init__` 4%
      - `quality/features.py:staged_resources_or_refuse` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 3%

Most time spent inside the function itself: `lyric_harness.py:score` 10%, `lyric_harness.py:cluster_sim` 4%, `lyric_harness.py:channel_agreement` 3%, `lyric_harness.py:shared_ending` 3%, `lyric_harness.py:cons_sim` 3%, `lyric_harness.py:split_phone` 2%


## lyric_verify

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

698 named harness functions ran, in 43 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 72%
  - `quality/revise.py:Reviser.brief` 62%
    - `quality/revise.py:Reviser.inspect` 44%
      - `quality/revise.py:Reviser.earned_pair_ban` 16%
      - `quality/revise.py:Reviser.grade` 15%
      - `quality/floor.py:SlopFloor.check` 6%
      - `quality/revise.py:Reviser._band_findings` 6%
      - `lyric_harness.py:best_score` 5%
    - `quality/revise.py:Reviser.brief._build` 28%
      - `quality/revise.py:Reviser._place_field` 28%
- `quality/revise.py:Reviser.__init__` 25%
  - `quality/floor.py:SlopFloor.__init__` 25%
    - `quality/features.py:QualityFeatures.__init__` 20%
      - `lyric_harness.py:Lexicon.__init__` 15%
      - `quality/features.py:RhymeField.__init__` 9%
      - `quality/features.py:staged_resources_or_refuse` 7%
    - `quality/field_store.py:attach` 5%
      - `quality/field_store.py:store_identity` 5%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 8%

Most time spent inside the function itself: `lyric_harness.py:score` 5%, `lyric_harness.py:split_phone` 5%, `lyric_harness.py:Lexicon.__init__` 4%, `lyric_harness.py:_reader_line_v2.cut.close` 3%, `lyric_harness.py:syllabify` 2%, `quality/frequency.py:_count_rows` 2%


## lyric_types

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

443 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:end_pair_relations` 73%
  - `quality/relations.py:pair_satisfies_any` 38%
    - `quality/relations.py:pair_satisfies` 38%
      - `quality/relations.py:evaluate` 38%
  - `quality/relations.py:build_stream` 34%
    - `quality/phonology/eng.py:English.tokens_for_line` 33%
      - `quality/phonology/eng.py:English._aside_rule` 33%
  - `lyric_harness.py:_screen_not_applicable` 34%
    - `quality/relations.py:placement_bindable` 34%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 21%
  - `lyric_harness.py:Lexicon.__init__` 90%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 22%, `quality/phonology/ltc.py:_load_table` 1%, `quality/morphology.py:segment` 1%, `quality/rhyme_types.py:name` 0%, `quality/phonology/ltc.py:_load_variants` 0%, `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 0%


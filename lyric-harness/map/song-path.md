# Song path

What runs when each lyric tool is called, from one profiled run of the reference song (`map/song.txt`, 16 lines) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

245 named harness functions ran, in 20 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 75%
  - `quality/relations.py:_build_traditions` 6%
    - `quality/canon_sources.py:scope_witness` 5%
      - `quality/canon_sources.py:attribute` 4%
- `quality/plan.py:sweep` 12%
  - `quality/plan.py:_sweep_one` 12%
    - `quality/plan.py:make_plan` 12%
      - `quality/plan.py:_make_plan_candidate` 12%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 23%, `quality/schemes.py:rgs.rec` 4%, `lyric_harness.py:cli` 1%, `quality/plan.py:_sample_pattern` 1%, `quality/canon_sources.py:_tokens` 0%, `quality/schemes.py:rgs` 0%


## lyric_screen

Runs `lyric_harness.py` `screen`.

620 named harness functions ran, in 41 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:screen_pairs` 99%
  - `quality/revise.py:Reviser.inspect` 85%
    - `quality/revise.py:Reviser.grade` 45%
      - `quality/relations.py:VocabularyPairResults.resolve_readings` 25%
      - `quality/relations.py:whole_vocabulary_pairs` 21%
    - `quality/floor.py:SlopFloor.check` 30%
      - `quality/features.py:QualityFeatures._predictability` 30%
    - `quality/revise.py:Reviser.earned_pair_ban` 7%
      - `quality/revise.py:Reviser.modal_head_evidenced` 7%
  - `quality/revise.py:Reviser.__init__` 10%
    - `quality/floor.py:SlopFloor.__init__` 10%
      - `quality/features.py:QualityFeatures.__init__` 8%
  - `lyric_harness.py:end_pair_relations` 4%
- `lyric_harness.py:Lexicon.__init__` 8%

Most time spent inside the function itself: `lyric_harness.py:score` 8%, `quality/relations.py:evaluate` 6%, `quality/relations.py:_set_agree` 3%, `lyric_harness.py:cluster_sim` 3%, `quality/relations.py:ClassEqual.__call__` 2%, `lyric_harness.py:channel_agreement` 2%


## lyric_plan

Runs `lyric_harness.py` `plan`.

246 named harness functions ran, in 20 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 84%
  - `quality/relations.py:_build_traditions` 7%
    - `quality/canon_sources.py:scope_witness` 6%
      - `quality/canon_sources.py:attribute` 5%
  - `lyric_harness.py:fetch_data` 3%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 24%, `lyric_harness.py:cli` 2%, `quality/plan.py:meter_factorisations` 0%, `quality/canon_sources.py:_tokens` 0%, `quality/canon_sources.py:scope_witness` 0%, `quality/canon_sources.py:_distinctive` 0%


## lyric_grade

Runs `lyric_harness.py` `plan`, `song`.

833 named harness functions ran, in 47 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 66%
  - `quality/revise.py:Reviser.inspect` 65%
    - `quality/revise.py:Reviser.grade` 33%
      - `quality/relations.py:whole_vocabulary_pairs` 31%
      - `quality/phonology/eng.py:English.parses` 5%
    - `quality/revise.py:Reviser.earned_pair_ban` 17%
      - `quality/revise.py:Reviser.modal_head_evidenced` 17%
    - `quality/revise.py:Reviser.group_merges` 12%
    - `quality/floor.py:SlopFloor.check` 9%
      - `quality/features.py:QualityFeatures._predictability` 9%
    - `quality/revise.py:Reviser._band_findings` 5%
      - `quality/fit.py:read_line` 6%
  - `quality/revise.py:Reviser.brief` 65%
- `lyric_harness.py:Lexicon.__init__` 27%
- `quality/revise.py:Reviser.__init__` 24%
  - `quality/floor.py:SlopFloor.__init__` 24%
    - `quality/features.py:QualityFeatures.__init__` 19%
      - `quality/features.py:RhymeField.__init__` 9%
      - `quality/features.py:staged_resources_or_refuse` 7%
    - `quality/field_store.py:attach` 5%
      - `quality/field_store.py:store_identity` 5%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 7%, `quality/relations.py:evaluate` 4%, `lyric_harness.py:split_phone` 3%, `lyric_harness.py:syllabify` 2%, `lyric_harness.py:score` 2%, `quality/frequency.py:_count_rows` 2%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `finish`, `revise`.

914 named harness functions ran, in 48 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 84%
  - `quality/loop.py:_try_tier1` 45%
    - `quality/replay_memo.py:MemoReviser.verify` 45%
      - `quality/replay_memo.py:MemoReviser._memo` 84%
    - `quality/phonology/eng.py:English.parses` 4%
      - `lyric_harness.py:syllabify` 10%
  - `quality/replay_memo.py:MemoReviser.brief` 38%
  - `quality/loop.py:revise_loop._materialize` 7%
- `quality/revise.py:Reviser.__init__` 14%
  - `quality/floor.py:SlopFloor.__init__` 14%
    - `quality/features.py:QualityFeatures.__init__` 11%
      - `lyric_harness.py:Lexicon.__init__` 12%
      - `quality/features.py:RhymeField.__init__` 5%
      - `quality/features.py:staged_resources_or_refuse` 4%

Most time spent inside the function itself: `quality/relations.py:evaluate` 7%, `quality/relations.py:_set_agree` 3%, `lyric_harness.py:split_phone` 3%, `lyric_harness.py:Lexicon.__init__` 3%, `lyric_harness.py:score` 2%, `quality/relations.py:_candidate_pairs` 2%


## lyric_recover

Runs `lyric_harness.py` `--input-format=source`.

418 named harness functions ran, in 36 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/recover.py:recover_file` 95%
  - `quality/recover.py:recover` 95%
    - `quality/relations.py:whole_vocabulary_pairs` 92%
      - `quality/relations.py:line_pairs_for` 85%
      - `quality/relations.py:whole_vocabulary_pairs._build` 6%
    - `quality/relations.py:_alts` 5%
- `lyric_harness.py:Lexicon.__init__` 18%

Most time spent inside the function itself: `quality/relations.py:evaluate` 11%, `quality/relations.py:_set_agree` 6%, `lyric_harness.py:Lexicon.__init__` 5%, `quality/relations.py:ClassEqual.__call__` 4%, `quality/relations.py:_alts` 4%, `quality/relations.py:ChannelSet.read` 3%


## lyric_check

Runs `lyric_harness.py` `brief`.

637 named harness functions ran, in 43 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 88%
  - `quality/revise.py:Reviser.brief` 86%
    - `quality/revise.py:Reviser.joint_field_screened` 67%
      - `quality/revise.py:Reviser._rank_field` 64%
      - `quality/revise.py:Reviser._field_split` 43%
      - `quality/revise.py:Reviser._spelled_rime` 16%
      - `lyric_harness.py:best_score` 9%
      - `quality/revise.py:Reviser._word_anchors` 4%
      - `quality/revise.py:Reviser._member` 4%
    - `quality/revise.py:Reviser.inspect` 20%
      - `quality/revise.py:Reviser.grade` 10%
      - `quality/revise.py:Reviser.earned_pair_ban` 8%
- `quality/revise.py:Reviser.__init__` 11%
  - `quality/floor.py:SlopFloor.__init__` 11%
    - `quality/features.py:QualityFeatures.__init__` 8%
      - `lyric_harness.py:Lexicon.__init__` 9%
      - `quality/features.py:RhymeField.__init__` 4%
      - `quality/features.py:staged_resources_or_refuse` 3%

Most time spent inside the function itself: `lyric_harness.py:score` 10%, `lyric_harness.py:cluster_sim` 4%, `lyric_harness.py:channel_agreement` 3%, `lyric_harness.py:shared_ending` 3%, `lyric_harness.py:cons_sim` 2%, `lyric_harness.py:Lexicon.__init__` 2%


## lyric_verify

Runs `lyric_harness.py` `verify`.

620 named harness functions ran, in 42 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 75%
  - `quality/revise.py:Reviser.brief` 64%
    - `quality/revise.py:Reviser.inspect` 52%
      - `quality/revise.py:Reviser.grade` 23%
      - `quality/revise.py:Reviser.earned_pair_ban` 16%
      - `quality/floor.py:SlopFloor.check` 7%
      - `quality/revise.py:Reviser._spelled_rime` 6%
      - `quality/revise.py:Reviser._band_findings` 5%
      - `lyric_harness.py:best_score` 4%
      - `quality/phonology/eng.py:English.parses` 4%
    - `quality/revise.py:Reviser.joint_field_screened` 23%
      - `quality/revise.py:Reviser._rank_field` 22%
      - `quality/revise.py:Reviser._field_split` 15%
      - `quality/revise.py:Reviser._word_anchors` 3%
- `quality/revise.py:Reviser.__init__` 22%
  - `quality/floor.py:SlopFloor.__init__` 22%
    - `quality/features.py:QualityFeatures.__init__` 17%
      - `lyric_harness.py:Lexicon.__init__` 19%
      - `quality/features.py:RhymeField.__init__` 8%
      - `quality/features.py:staged_resources_or_refuse` 6%
    - `quality/field_store.py:attach` 4%
      - `quality/field_store.py:store_identity` 4%

Most time spent inside the function itself: `lyric_harness.py:score` 5%, `lyric_harness.py:Lexicon.__init__` 5%, `lyric_harness.py:split_phone` 4%, `lyric_harness.py:syllabify` 2%, `quality/frequency.py:_count_rows` 2%, `quality/relations.py:evaluate` 2%


## lyric_types

Runs `lyric_harness.py` `types`.

384 named harness functions ran, in 36 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 89%
- `lyric_harness.py:end_pair_relations` 66%
  - `quality/relations.py:build_stream` 36%
    - `quality/phonology/eng.py:English.syllabify` 36%
      - `quality/phonology/eng.py:English.parses` 36%
  - `quality/relations.py:pair_satisfies_any` 28%
    - `quality/relations.py:pair_satisfies` 28%
      - `quality/relations.py:evaluate` 28%
- `quality/type_canon.py:label` 4%
  - `quality/type_canon.py:scope` 4%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 25%, `quality/phonology/ltc.py:_load_table` 1%, `quality/morphology.py:segment` 1%, `lyric_harness.py:cli` 0%, `quality/phonology/ltc.py:_load_variants` 0%, `quality/canon_sources.py:_tokens` 0%


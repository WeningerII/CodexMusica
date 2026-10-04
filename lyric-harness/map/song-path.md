# Song path

What runs when each lyric tool is called, from one profiled run of the reference song (`map/song.txt`, 16 lines) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

251 named harness functions ran, in 20 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 70%
  - `quality/relations.py:_build_traditions` 7%
    - `quality/canon_sources.py:scope_witness` 5%
      - `quality/canon_sources.py:attribute` 4%
- `quality/plan.py:sweep` 13%
  - `quality/plan.py:_sweep_one` 13%
    - `quality/plan.py:make_plan` 13%
      - `quality/plan.py:_make_plan_candidate` 13%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 22%, `quality/schemes.py:rgs.rec` 3%, `lyric_harness.py:cli` 1%, `quality/slots.py:parse_slot` 0%, `quality/plan.py:_sample_pattern` 0%, `quality/canon_sources.py:_tokens` 0%


## lyric_screen

Runs `lyric_harness.py` `screen`.

619 named harness functions ran, in 41 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:screen_pairs` 98%
  - `quality/revise.py:Reviser.inspect` 76%
    - `quality/revise.py:Reviser.grade` 63%
      - `quality/relations.py:VocabularyPairResults.resolve_readings` 34%
      - `quality/relations.py:whole_vocabulary_pairs` 29%
      - `quality/phonology/eng.py:English.parses` 3%
      - `quality/relations.py:_alts` 3%
    - `quality/revise.py:Reviser.earned_pair_ban` 9%
      - `quality/revise.py:Reviser.modal_head_evidenced` 9%
    - `quality/revise.py:Reviser._band_findings` 3%
      - `quality/fit.py:read_line` 3%
  - `quality/revise.py:Reviser.__init__` 15%
    - `quality/floor.py:SlopFloor.__init__` 15%
      - `quality/features.py:QualityFeatures.__init__` 13%
  - `lyric_harness.py:end_pair_relations` 6%
    - `quality/relations.py:build_stream` 4%
      - `quality/phonology/eng.py:English.syllabify` 4%
    - `quality/relations.py:pair_satisfies_any` 3%
      - `quality/relations.py:pair_satisfies` 3%
- `lyric_harness.py:Lexicon.__init__` 12%

Most time spent inside the function itself: `quality/relations.py:evaluate` 8%, `quality/relations.py:_set_agree` 4%, `lyric_harness.py:Lexicon.__init__` 3%, `quality/relations.py:ClassEqual.__call__` 3%, `quality/relations.py:_alts` 3%, `quality/relations.py:ChannelSet.read` 2%


## lyric_plan

Runs `lyric_harness.py` `plan`.

252 named harness functions ran, in 20 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 83%
  - `quality/relations.py:_build_traditions` 6%
    - `quality/canon_sources.py:scope_witness` 5%
      - `quality/canon_sources.py:attribute` 4%
  - `lyric_harness.py:fetch_data` 4%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 25%, `lyric_harness.py:cli` 1%, `quality/canon_sources.py:_tokens` 0%, `quality/plan.py:meter_factorisations` 0%, `quality/slots.py:parse_slot` 0%, `quality/canon_sources.py:scope_witness` 0%


## lyric_grade

Runs `lyric_harness.py` `plan`, `song`.

850 named harness functions ran, in 47 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 65%
  - `quality/revise.py:Reviser.inspect` 64%
    - `quality/revise.py:Reviser.grade` 38%
      - `quality/relations.py:whole_vocabulary_pairs` 34%
      - `quality/phonology/eng.py:English.parses` 5%
    - `quality/revise.py:Reviser.earned_pair_ban` 18%
      - `quality/revise.py:Reviser.modal_head_evidenced` 18%
    - `quality/revise.py:Reviser.group_merges` 14%
    - `quality/revise.py:Reviser._band_findings` 6%
      - `quality/fit.py:read_line` 6%
  - `quality/revise.py:Reviser.brief` 63%
- `lyric_harness.py:Lexicon.__init__` 27%
- `quality/revise.py:Reviser.__init__` 24%
  - `quality/floor.py:SlopFloor.__init__` 24%
    - `quality/features.py:QualityFeatures.__init__` 20%
      - `quality/features.py:RhymeField.__init__` 9%
      - `quality/features.py:staged_resources_or_refuse` 7%
    - `quality/field_store.py:attach` 5%
      - `quality/field_store.py:store_identity` 5%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 7%, `quality/relations.py:evaluate` 4%, `lyric_harness.py:split_phone` 4%, `lyric_harness.py:syllabify` 3%, `quality/frequency.py:_count_rows` 2%, `quality/relations.py:_set_agree` 2%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `finish`, `revise`.

947 named harness functions ran, in 48 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 94%
  - `quality/replay_memo.py:MemoReviser.brief` 65%
    - `quality/replay_memo.py:MemoReviser._memo` 94%
      - `quality/revise.py:Reviser.brief` 71%
      - `quality/revise.py:Reviser.inspect` 42%
      - `quality/revise.py:Reviser.verify` 29%
      - `quality/revise.py:Reviser._member` 8%
      - `lyric_harness.py:best_score` 7%
      - `quality/revise.py:Reviser._spelled_rime` 7%
      - `quality/phonology/eng.py:English.parses` 3%
  - `quality/loop.py:revise_loop._materialize` 52%
  - `quality/loop.py:_try_tier1` 25%
    - `quality/replay_memo.py:MemoReviser.verify` 29%
  - `lyric_harness.py:_defer_proposer.prefetch` 8%
  - `quality/loop.py:_try_tier2` 4%
- `quality/revise.py:Reviser.__init__` 5%
  - `quality/floor.py:SlopFloor.__init__` 5%
    - `quality/features.py:QualityFeatures.__init__` 4%
      - `lyric_harness.py:Lexicon.__init__` 4%

Most time spent inside the function itself: `lyric_harness.py:score` 9%, `quality/relations.py:evaluate` 5%, `lyric_harness.py:cluster_sim` 3%, `lyric_harness.py:channel_agreement` 2%, `lyric_harness.py:shared_ending` 2%, `quality/relations.py:_set_agree` 2%


## lyric_recover

Runs `lyric_harness.py` `--input-format=source`.

418 named harness functions ran, in 36 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/recover.py:recover_file` 95%
  - `quality/recover.py:recover` 95%
    - `quality/relations.py:whole_vocabulary_pairs` 92%
      - `quality/relations.py:line_pairs_for` 85%
      - `quality/relations.py:whole_vocabulary_pairs._build` 7%
    - `quality/relations.py:_alts` 5%
- `lyric_harness.py:Lexicon.__init__` 18%

Most time spent inside the function itself: `quality/relations.py:evaluate` 11%, `quality/relations.py:_set_agree` 6%, `lyric_harness.py:Lexicon.__init__` 5%, `quality/relations.py:ClassEqual.__call__` 4%, `quality/relations.py:_alts` 4%, `quality/relations.py:ChannelSet.read` 3%


## lyric_check

Runs `lyric_harness.py` `brief`.

637 named harness functions ran, in 43 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 88%
  - `quality/revise.py:Reviser.brief` 87%
    - `quality/revise.py:Reviser.joint_field_screened` 67%
      - `quality/revise.py:Reviser._rank_field` 64%
      - `quality/revise.py:Reviser._field_split` 43%
      - `quality/revise.py:Reviser._spelled_rime` 16%
      - `lyric_harness.py:best_score` 9%
      - `quality/revise.py:Reviser._word_anchors` 4%
      - `quality/revise.py:Reviser._member` 4%
    - `quality/revise.py:Reviser.inspect` 21%
      - `quality/revise.py:Reviser.grade` 10%
      - `quality/revise.py:Reviser.earned_pair_ban` 8%
- `quality/revise.py:Reviser.__init__` 11%
  - `quality/floor.py:SlopFloor.__init__` 11%
    - `quality/features.py:QualityFeatures.__init__` 8%
      - `lyric_harness.py:Lexicon.__init__` 9%
      - `quality/features.py:RhymeField.__init__` 4%

Most time spent inside the function itself: `lyric_harness.py:score` 10%, `lyric_harness.py:cluster_sim` 4%, `lyric_harness.py:shared_ending` 3%, `lyric_harness.py:channel_agreement` 3%, `lyric_harness.py:cons_sim` 2%, `lyric_harness.py:Lexicon.__init__` 2%


## lyric_verify

Runs `lyric_harness.py` `verify`.

619 named harness functions ran, in 42 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 74%
  - `quality/revise.py:Reviser.brief` 69%
    - `quality/revise.py:Reviser.inspect` 49%
      - `quality/revise.py:Reviser.grade` 25%
      - `quality/revise.py:Reviser.earned_pair_ban` 18%
      - `quality/revise.py:Reviser._spelled_rime` 7%
      - `quality/revise.py:Reviser._band_findings` 5%
      - `lyric_harness.py:best_score` 5%
      - `quality/phonology/eng.py:English.parses` 4%
    - `quality/revise.py:Reviser.joint_field_screened` 25%
      - `quality/revise.py:Reviser._rank_field` 24%
      - `quality/revise.py:Reviser._field_split` 17%
      - `quality/revise.py:Reviser._word_anchors` 4%
- `quality/revise.py:Reviser.__init__` 23%
  - `quality/floor.py:SlopFloor.__init__` 23%
    - `quality/features.py:QualityFeatures.__init__` 18%
      - `lyric_harness.py:Lexicon.__init__` 19%
      - `quality/features.py:RhymeField.__init__` 8%
      - `quality/features.py:staged_resources_or_refuse` 6%
    - `quality/field_store.py:attach` 5%
      - `quality/field_store.py:store_identity` 5%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 5%, `lyric_harness.py:split_phone` 4%, `lyric_harness.py:score` 3%, `lyric_harness.py:syllabify` 3%, `quality/relations.py:evaluate` 2%, `quality/frequency.py:_count_rows` 2%


## lyric_types

Runs `lyric_harness.py` `types`.

384 named harness functions ran, in 36 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 89%
- `lyric_harness.py:end_pair_relations` 66%
  - `quality/relations.py:build_stream` 34%
    - `quality/phonology/eng.py:English.syllabify` 34%
      - `quality/phonology/eng.py:English.parses` 34%
  - `quality/relations.py:pair_satisfies_any` 30%
    - `quality/relations.py:pair_satisfies` 30%
      - `quality/relations.py:evaluate` 30%
- `quality/type_canon.py:label` 4%
  - `quality/type_canon.py:scope` 4%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 27%, `quality/phonology/ltc.py:_load_table` 1%, `quality/morphology.py:segment` 1%, `lyric_harness.py:cli` 1%, `quality/phonology/ltc.py:_load_variants` 0%, `quality/canon_sources.py:_tokens` 0%


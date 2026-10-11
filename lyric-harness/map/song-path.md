# Song path

What runs when each lyric tool is called, from one profiled run of the reference song (`map/song.txt`, 16 lines) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

246 named harness functions ran, in 20 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 76%
  - `quality/relations.py:_build_traditions` 7%
    - `quality/canon_sources.py:scope_witness` 5%
      - `quality/canon_sources.py:attribute` 5%
- `quality/plan.py:sweep` 11%
  - `quality/plan.py:_sweep_one` 11%
    - `quality/plan.py:make_plan` 11%
      - `quality/plan.py:_make_plan_candidate` 11%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 30%, `quality/schemes.py:rgs.rec` 4%, `quality/plan.py:_scheme_for` 2%, `lyric_harness.py:cli` 1%, `quality/plan.py:_sample_pattern` 1%, `quality/canon_sources.py:_tokens` 0%


## lyric_screen

Runs `lyric_harness.py` `--lexicon-supplement=v1`.

643 named harness functions ran, in 42 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:screen_pairs` 98%
  - `quality/revise.py:Reviser.inspect` 82%
    - `quality/floor.py:SlopFloor.check` 50%
      - `quality/features.py:QualityFeatures._predictability` 50%
    - `quality/revise.py:Reviser.grade` 18%
      - `quality/relations.py:whole_vocabulary_pairs` 17%
    - `quality/revise.py:Reviser.earned_pair_ban` 11%
      - `quality/revise.py:Reviser.modal_head_evidenced` 11%
    - `quality/revise.py:Reviser._band_findings` 3%
  - `quality/revise.py:Reviser.__init__` 10%
    - `quality/floor.py:SlopFloor.__init__` 10%
      - `quality/features.py:QualityFeatures.__init__` 7%
  - `lyric_harness.py:end_pair_relations` 6%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 4%
  - `lyric_harness.py:Lexicon.__init__` 10%

Most time spent inside the function itself: `lyric_harness.py:score` 14%, `lyric_harness.py:Lexicon.__init__` 5%, `lyric_harness.py:shared_ending` 4%, `lyric_harness.py:channel_agreement` 4%, `lyric_harness.py:cluster_sim` 4%, `lyric_harness.py:cons_sim` 2%


## lyric_plan

Runs `lyric_harness.py` `plan`.

247 named harness functions ran, in 20 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 80%
  - `quality/relations.py:_build_traditions` 10%
    - `quality/canon_sources.py:scope_witness` 8%
      - `quality/canon_sources.py:attribute` 7%
  - `lyric_harness.py:fetch_data` 3%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 32%, `lyric_harness.py:cli` 1%, `quality/canon_sources.py:_tokens` 1%, `quality/canon_sources.py:_distinctive` 0%, `quality/canon_sources.py:attribute` 0%, `quality/canon_sources.py:scope_witness` 0%


## lyric_grade

Runs `lyric_harness.py` `--lexicon-supplement=v1`, `plan`.

860 named harness functions ran, in 48 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 66%
  - `quality/revise.py:Reviser.inspect` 55%
    - `quality/revise.py:Reviser.grade` 27%
      - `quality/relations.py:whole_vocabulary_pairs` 26%
    - `quality/revise.py:Reviser.earned_pair_ban` 22%
      - `quality/revise.py:Reviser.modal_head_evidenced` 22%
    - `quality/floor.py:SlopFloor.check` 12%
      - `quality/features.py:QualityFeatures._predictability` 12%
    - `quality/revise.py:Reviser._band_findings` 4%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 3%
  - `quality/revise.py:Reviser.brief` 54%
- `lyric_harness.py:Lexicon.__init__` 23%
- `quality/revise.py:Reviser.__init__` 21%
  - `quality/floor.py:SlopFloor.__init__` 21%
    - `quality/features.py:QualityFeatures.__init__` 15%
      - `quality/features.py:RhymeField.__init__` 9%
    - `quality/field_store.py:attach` 6%
      - `quality/field_store.py:store_identity` 6%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 7%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 10%, `quality/relations.py:evaluate` 3%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:split_phone` 3%, `lyric_harness.py:score` 3%, `quality/frequency.py:_count_rows` 3%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `--lexicon-supplement=v1`.

995 named harness functions ran, in 49 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 85%
  - `quality/loop.py:_VerdictCache.brief` 54%
    - `quality/loop.py:_VerdictCache._gate` 85%
      - `quality/loop.py:Deadline.step` 85%
    - `quality/loop.py:_VerdictCache._menu` 34%
    - `lyric_harness.py:best_score` 7%
      - `lyric_harness.py:score` 27%
    - `quality/revise.py:Reviser._member` 7%
      - `quality/revise.py:Reviser._field_split` 31%
      - `quality/revise.py:Reviser._offerable` 7%
      - `quality/revise.py:Reviser._word_anchors` 5%
    - `quality/phonology/eng.py:English.parses` 5%
      - `lyric_harness.py:syllabify` 13%
      - `quality/lexicon_supplement.py:SupplementedLexicon.pronunciation_variants` 3%
    - `quality/revise.py:Reviser._spelled_rime` 5%
  - `quality/loop.py:revise_loop._materialize` 25%
  - `quality/loop.py:_try_tier1` 20%
    - `quality/loop.py:_VerdictCache.verify` 21%
  - `quality/loop.py:_try_tier2` 10%
    - `quality/loop.py:_VerdictCache.member_place_field` 9%
- `quality/revise.py:Reviser.__init__` 12%
  - `quality/floor.py:SlopFloor.__init__` 12%
    - `quality/features.py:QualityFeatures.__init__` 9%
      - `lyric_harness.py:Lexicon.__init__` 12%
      - `quality/features.py:RhymeField.__init__` 5%
    - `quality/field_store.py:attach` 3%
      - `quality/field_store.py:store_identity` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 5%

Most time spent inside the function itself: `lyric_harness.py:score` 8%, `lyric_harness.py:Lexicon.__init__` 6%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:split_phone` 3%, `lyric_harness.py:shared_ending` 2%, `lyric_harness.py:channel_agreement` 2%


## lyric_recover

Runs `lyric_harness.py` `--lexicon-supplement=v1`.

451 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/recover.py:recover_file` 87%
  - `quality/recover.py:recover` 87%
    - `quality/relations.py:whole_vocabulary_pairs` 78%
      - `quality/relations.py:line_pairs_for` 66%
      - `quality/relations.py:whole_vocabulary_pairs._build` 13%
    - `lyric_harness.py:best_score` 3%
    - `quality/relations.py:_alts` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 13%
  - `lyric_harness.py:Lexicon.__init__` 40%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 19%, `quality/relations.py:evaluate` 7%, `quality/relations.py:_set_agree` 4%, `quality/relations.py:_alts` 2%, `quality/relations.py:ChannelSet.read` 2%, `quality/relations.py:align_flush_right` 2%


## lyric_check

Runs `lyric_harness.py` `--lexicon-supplement=v1`.

681 named harness functions ran, in 44 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 91%
  - `quality/revise.py:Reviser.brief` 90%
    - `quality/revise.py:Reviser.brief._build` 74%
      - `quality/revise.py:Reviser._place_field` 74%
    - `quality/revise.py:Reviser.inspect` 17%
      - `quality/revise.py:Reviser.earned_pair_ban` 8%
      - `quality/revise.py:Reviser.grade` 7%
    - `lyric_harness.py:best_score` 10%
      - `lyric_harness.py:score` 38%
    - `quality/revise.py:Reviser._member` 7%
      - `quality/revise.py:Reviser._field_split` 45%
      - `quality/revise.py:Reviser._offerable` 7%
      - `quality/revise.py:Reviser._word_anchors` 5%
    - `quality/phonology/eng.py:English.parses` 3%
      - `lyric_harness.py:syllabify` 9%
      - `quality/lexicon_supplement.py:SupplementedLexicon.pronunciation_variants` 3%
  - `quality/revise.py:Reviser._spelled_rime` 18%
    - `quality/revise.py:Reviser._decl_lex_key` 13%
      - `quality/discriminate.py:declaration_tuple` 9%
    - `quality/revise.py:Reviser._spelled_rime_compute` 3%
- `quality/revise.py:Reviser.__init__` 8%
  - `quality/floor.py:SlopFloor.__init__` 8%
    - `quality/features.py:QualityFeatures.__init__` 5%
      - `lyric_harness.py:Lexicon.__init__` 8%
      - `quality/features.py:RhymeField.__init__` 4%

Most time spent inside the function itself: `lyric_harness.py:score` 10%, `lyric_harness.py:Lexicon.__init__` 4%, `lyric_harness.py:shared_ending` 3%, `lyric_harness.py:cluster_sim` 3%, `lyric_harness.py:channel_agreement` 3%, `quality/discriminate.py:declaration_tuple` 3%


## lyric_verify

Runs `lyric_harness.py` `--lexicon-supplement=v1`.

660 named harness functions ran, in 43 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 79%
  - `quality/revise.py:Reviser.brief` 68%
    - `quality/revise.py:Reviser.inspect` 48%
      - `quality/revise.py:Reviser.earned_pair_ban` 18%
      - `quality/revise.py:Reviser.grade` 17%
      - `quality/floor.py:SlopFloor.check` 8%
      - `quality/revise.py:Reviser._band_findings` 4%
    - `quality/revise.py:Reviser.brief._build` 31%
      - `quality/revise.py:Reviser._place_field` 31%
    - `lyric_harness.py:best_score` 6%
      - `lyric_harness.py:score` 22%
  - `quality/revise.py:Reviser._spelled_rime` 9%
    - `quality/revise.py:Reviser._decl_lex_key` 5%
      - `quality/discriminate.py:declaration_tuple` 4%
- `quality/revise.py:Reviser.__init__` 17%
  - `quality/floor.py:SlopFloor.__init__` 17%
    - `quality/features.py:QualityFeatures.__init__` 12%
      - `lyric_harness.py:Lexicon.__init__` 14%
      - `quality/features.py:RhymeField.__init__` 8%
    - `quality/field_store.py:attach` 5%
      - `quality/field_store.py:store_identity` 5%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 7%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 6%, `lyric_harness.py:score` 6%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:split_phone` 3%, `quality/frequency.py:_count_rows` 2%, `lyric_harness.py:coda_agrees` 2%


## lyric_types

Runs `lyric_harness.py` `types`.

387 named harness functions ran, in 36 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 86%
  - `quality/relations.py:_build_traditions` 3%
- `lyric_harness.py:end_pair_relations` 64%
  - `quality/relations.py:pair_satisfies_any` 31%
    - `quality/relations.py:pair_satisfies` 31%
      - `quality/relations.py:evaluate` 31%
  - `quality/relations.py:build_stream` 31%
    - `quality/phonology/eng.py:English.syllabify` 31%
      - `quality/phonology/eng.py:English.parses` 31%
- `quality/type_canon.py:label` 5%
  - `quality/type_canon.py:scope` 5%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 40%, `quality/phonology/ltc.py:_load_table` 1%, `quality/morphology.py:segment` 1%, `lyric_harness.py:cli` 1%, `quality/phonology/ltc.py:_load_variants` 0%, `quality/morphology.py:_known_words` 0%


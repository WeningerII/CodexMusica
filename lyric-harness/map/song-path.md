# Song path

What runs when each lyric tool is called, from one profiled run of the reference song (`map/song.txt`, 16 lines) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

248 named harness functions ran, in 20 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 75%
  - `quality/relations.py:_build_traditions` 7%
    - `quality/canon_sources.py:scope_witness` 6%
      - `quality/canon_sources.py:attribute` 5%
- `quality/plan.py:sweep` 12%
  - `quality/plan.py:_sweep_one` 12%
    - `quality/plan.py:make_plan` 12%
      - `quality/plan.py:_make_plan_candidate` 12%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 30%, `quality/schemes.py:rgs.rec` 4%, `quality/plan.py:_scheme_for` 2%, `lyric_harness.py:cli` 1%, `quality/plan.py:_sample_pattern` 1%, `quality/canon_sources.py:_tokens` 0%


## lyric_screen

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

647 named harness functions ran, in 42 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:screen_pairs` 97%
  - `quality/revise.py:Reviser.inspect` 65%
    - `quality/revise.py:Reviser.grade` 33%
      - `quality/relations.py:whole_vocabulary_pairs` 32%
      - `quality/phonology/eng.py:English.parses` 5%
    - `quality/revise.py:Reviser.earned_pair_ban` 23%
      - `quality/revise.py:Reviser.modal_head_evidenced` 22%
    - `quality/revise.py:Reviser._band_findings` 7%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 6%
  - `quality/revise.py:Reviser.__init__` 19%
    - `quality/floor.py:SlopFloor.__init__` 19%
      - `quality/features.py:QualityFeatures.__init__` 14%
      - `quality/field_store.py:attach` 5%
  - `lyric_harness.py:end_pair_relations` 12%
    - `quality/relations.py:pair_satisfies_any` 6%
      - `quality/relations.py:pair_satisfies` 6%
    - `quality/relations.py:build_stream` 5%
      - `quality/phonology/eng.py:English.syllabify` 5%
    - `lyric_harness.py:_screen_not_applicable` 4%
      - `quality/relations.py:placement_bindable` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 9%
  - `lyric_harness.py:Lexicon.__init__` 20%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 11%, `quality/relations.py:evaluate` 4%, `lyric_harness.py:syllabify` 4%, `lyric_harness.py:split_phone` 4%, `quality/frequency.py:_count_rows` 3%, `quality/relations.py:_set_agree` 2%


## lyric_plan

Runs `lyric_harness.py` `plan`.

250 named harness functions ran, in 20 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 84%
  - `quality/relations.py:_build_traditions` 8%
    - `quality/canon_sources.py:scope_witness` 6%
      - `quality/canon_sources.py:attribute` 6%
  - `lyric_harness.py:fetch_data` 3%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 33%, `lyric_harness.py:cli` 1%, `quality/canon_sources.py:_tokens` 0%, `quality/canon_sources.py:_distinctive` 0%, `quality/canon_sources.py:attribute` 0%, `quality/canon_sources.py:scope_witness` 0%


## lyric_grade

Runs `lyric_harness.py` `--lexicon-supplement=v2`, `plan`.

866 named harness functions ran, in 48 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 63%
  - `quality/revise.py:Reviser.inspect` 51%
    - `quality/revise.py:Reviser.grade` 30%
      - `quality/relations.py:whole_vocabulary_pairs` 29%
    - `quality/revise.py:Reviser.earned_pair_ban` 25%
      - `quality/revise.py:Reviser.modal_head_evidenced` 25%
    - `quality/revise.py:Reviser._band_findings` 5%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 5%
  - `quality/revise.py:Reviser.brief` 50%
- `lyric_harness.py:Lexicon.__init__` 26%
- `quality/revise.py:Reviser.__init__` 22%
  - `quality/floor.py:SlopFloor.__init__` 22%
    - `quality/features.py:QualityFeatures.__init__` 16%
      - `quality/features.py:RhymeField.__init__` 10%
    - `quality/field_store.py:attach` 6%
      - `quality/field_store.py:store_identity` 6%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 9%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 12%, `lyric_harness.py:syllabify` 4%, `quality/relations.py:evaluate` 4%, `lyric_harness.py:split_phone` 4%, `quality/frequency.py:_count_rows` 3%, `quality/relations.py:_set_agree` 2%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `--lexicon-supplement=v2`.

1001 named harness functions ran, in 49 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 85%
  - `quality/loop.py:_VerdictCache.brief` 54%
    - `quality/loop.py:_VerdictCache._gate` 85%
      - `quality/loop.py:Deadline.step` 85%
    - `quality/loop.py:_VerdictCache._menu` 35%
    - `lyric_harness.py:best_score` 8%
      - `lyric_harness.py:score` 26%
    - `quality/revise.py:Reviser._member` 7%
      - `quality/revise.py:Reviser._field_split` 33%
      - `quality/revise.py:Reviser._offerable` 7%
      - `quality/revise.py:Reviser._word_anchors` 5%
    - `quality/revise.py:Reviser._spelled_rime` 5%
      - `quality/revise.py:Reviser._decl_lex_key` 3%
    - `quality/phonology/eng.py:English.parses` 5%
      - `lyric_harness.py:syllabify` 14%
      - `quality/lexicon_supplement.py:SupplementedLexicon.pronunciation_variants` 3%
  - `quality/loop.py:revise_loop._materialize` 26%
  - `quality/loop.py:_try_tier1` 20%
    - `quality/loop.py:_VerdictCache.verify` 20%
  - `quality/loop.py:_try_tier2` 10%
    - `quality/loop.py:_VerdictCache.member_place_field` 9%
- `quality/revise.py:Reviser.__init__` 12%
  - `quality/floor.py:SlopFloor.__init__` 12%
    - `quality/features.py:QualityFeatures.__init__` 9%
      - `lyric_harness.py:Lexicon.__init__` 12%
      - `quality/features.py:RhymeField.__init__` 6%
    - `quality/field_store.py:attach` 3%
      - `quality/field_store.py:store_identity` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 4%

Most time spent inside the function itself: `lyric_harness.py:score` 8%, `lyric_harness.py:Lexicon.__init__` 6%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:split_phone` 3%, `lyric_harness.py:channel_agreement` 2%, `lyric_harness.py:shared_ending` 2%


## lyric_recover

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

454 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/recover.py:recover_file` 83%
  - `quality/recover.py:recover` 83%
    - `quality/relations.py:whole_vocabulary_pairs` 71%
      - `quality/relations.py:line_pairs_for` 70%
    - `lyric_harness.py:best_score` 4%
    - `quality/relations.py:_alts` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 17%
  - `lyric_harness.py:Lexicon.__init__` 31%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 14%, `quality/relations.py:evaluate` 8%, `quality/relations.py:_set_agree` 4%, `quality/relations.py:_alts` 3%, `quality/relations.py:ChannelSet.read` 2%, `quality/relations.py:align_flush_right` 2%


## lyric_check

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

685 named harness functions ran, in 44 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 90%
  - `quality/revise.py:Reviser.brief` 88%
    - `quality/revise.py:Reviser.brief._build` 73%
      - `quality/revise.py:Reviser._place_field` 73%
    - `quality/revise.py:Reviser.inspect` 17%
      - `quality/revise.py:Reviser.earned_pair_ban` 8%
      - `quality/revise.py:Reviser.grade` 7%
    - `lyric_harness.py:best_score` 9%
      - `lyric_harness.py:score` 37%
    - `quality/revise.py:Reviser._member` 6%
      - `quality/revise.py:Reviser._field_split` 44%
      - `quality/revise.py:Reviser._offerable` 6%
      - `quality/revise.py:Reviser._word_anchors` 5%
  - `quality/revise.py:Reviser._spelled_rime` 19%
    - `quality/revise.py:Reviser._decl_lex_key` 14%
      - `quality/discriminate.py:declaration_tuple` 9%
    - `quality/revise.py:Reviser._spelled_rime_compute` 3%
- `quality/revise.py:Reviser.__init__` 8%
  - `quality/floor.py:SlopFloor.__init__` 8%
    - `quality/features.py:QualityFeatures.__init__` 6%
      - `lyric_harness.py:Lexicon.__init__` 9%
      - `quality/features.py:RhymeField.__init__` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 3%

Most time spent inside the function itself: `lyric_harness.py:score` 10%, `lyric_harness.py:Lexicon.__init__` 4%, `lyric_harness.py:shared_ending` 3%, `lyric_harness.py:cluster_sim` 3%, `quality/discriminate.py:declaration_tuple` 3%, `lyric_harness.py:channel_agreement` 3%


## lyric_verify

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

663 named harness functions ran, in 43 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 78%
  - `quality/revise.py:Reviser.brief` 74%
    - `quality/revise.py:Reviser.inspect` 46%
      - `quality/revise.py:Reviser.earned_pair_ban` 21%
      - `quality/revise.py:Reviser.grade` 20%
      - `quality/revise.py:Reviser._band_findings` 4%
    - `quality/revise.py:Reviser.brief._build` 32%
      - `quality/revise.py:Reviser._place_field` 32%
    - `lyric_harness.py:best_score` 5%
      - `lyric_harness.py:score` 15%
  - `quality/revise.py:Reviser._spelled_rime` 9%
    - `quality/revise.py:Reviser._decl_lex_key` 6%
      - `quality/discriminate.py:declaration_tuple` 4%
    - `quality/revise.py:Reviser._spelled_rime_compute` 3%
- `quality/revise.py:Reviser.__init__` 18%
  - `quality/floor.py:SlopFloor.__init__` 18%
    - `quality/features.py:QualityFeatures.__init__` 13%
      - `lyric_harness.py:Lexicon.__init__` 14%
      - `quality/features.py:RhymeField.__init__` 8%
    - `quality/field_store.py:attach` 5%
      - `quality/field_store.py:store_identity` 5%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 7%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 7%, `lyric_harness.py:score` 4%, `lyric_harness.py:syllabify` 4%, `lyric_harness.py:split_phone` 4%, `quality/frequency.py:_count_rows` 3%, `quality/relations.py:evaluate` 2%


## lyric_types

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

417 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:end_pair_relations` 64%
  - `quality/relations.py:pair_satisfies_any` 33%
    - `quality/relations.py:pair_satisfies` 33%
      - `quality/relations.py:evaluate` 33%
  - `quality/relations.py:build_stream` 29%
    - `quality/phonology/eng.py:English.syllabify` 29%
      - `quality/phonology/eng.py:English.parses` 29%
  - `lyric_harness.py:_screen_not_applicable` 29%
    - `quality/relations.py:placement_bindable` 29%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 28%
  - `lyric_harness.py:Lexicon.__init__` 88%
- `quality/type_canon.py:label` 4%
  - `quality/type_canon.py:scope` 4%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 40%, `quality/phonology/ltc.py:_load_table` 1%, `quality/morphology.py:segment` 1%, `quality/phonology/ltc.py:_load_variants` 0%, `quality/morphology.py:_known_words` 0%, `quality/rhyme_types.py:_agreement_satisfies` 0%


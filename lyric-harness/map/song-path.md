# Song path

What runs when each lyric tool is called, from one profiled run of a supplied song (`node map/trace.mjs --song=FILE`) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --song=FILE --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

457 named harness functions ran, in 34 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 94%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 67%
    - `lyric_harness.py:_derived_accent_entries` 62%
      - `lyric_harness.py:derive_accent_readings` 58%
- `quality/plan.py:sweep` 22%
  - `quality/plan.py:_sweep_one` 22%
    - `quality/plan.py:make_plan` 22%
      - `quality/plan.py:_redraw_past_joint_gate` 22%
  - `quality/plan.py:_bindable_at` 21%
    - `quality/relations.py:placement_bindable` 21%
      - `quality/relations.py:build_stream` 20%
      - `lyric_harness.py:_is_vowel` 13%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 13%, `lyric_harness.py:derive_accent_readings` 12%, `lyric_harness.py:_is_vowel` 8%, `lyric_harness.py:_vowel_letters` 8%, `lyric_harness.py:_base` 7%, `lyric_harness.py:Lexicon._derive_cmu_readings` 6%


## lyric_screen

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

752 named harness functions ran, in 40 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:screen_pairs` 89%
  - `quality/revise.py:Reviser.inspect` 68%
    - `quality/floor.py:SlopFloor.check` 37%
      - `quality/features.py:QualityFeatures._predictability` 36%
    - `quality/revise.py:Reviser.grade` 18%
      - `quality/relations.py:whole_vocabulary_pairs` 14%
    - `quality/revise.py:Reviser.earned_pair_ban` 9%
      - `quality/revise.py:Reviser.modal_head_evidenced` 9%
  - `quality/revise.py:Reviser.__init__` 17%
    - `quality/floor.py:SlopFloor.__init__` 17%
      - `quality/features.py:QualityFeatures.__init__` 11%
      - `quality/field_store.py:attach` 4%
  - `lyric_harness.py:end_pair_relations` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 13%
  - `lyric_harness.py:Lexicon.__init__` 15%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 10%
      - `lyric_harness.py:_derived_accent_entries` 9%

Most time spent inside the function itself: `lyric_harness.py:score` 10%, `lyric_harness.py:shared_ending` 3%, `lyric_harness.py:channel_agreement` 3%, `lyric_harness.py:Lexicon.__init__` 3%, `lyric_harness.py:cluster_sim` 3%, `lyric_harness.py:syllabify` 2%


## lyric_plan

Runs `lyric_harness.py` `plan`.

447 named harness functions ran, in 34 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 95%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 68%
    - `lyric_harness.py:_derived_accent_entries` 63%
      - `lyric_harness.py:derive_accent_readings` 60%
- `quality/plan.py:make_plan` 21%
  - `quality/plan.py:_redraw_past_joint_gate` 21%
    - `quality/plan.py:_make_plan_candidate` 21%
      - `quality/plan.py:_assign_types` 21%
      - `quality/plan.py:eligible_types` 21%
      - `quality/plan.py:_bindable_at` 21%
      - `lyric_harness.py:_is_vowel` 13%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 13%, `lyric_harness.py:derive_accent_readings` 12%, `lyric_harness.py:_is_vowel` 8%, `lyric_harness.py:_vowel_letters` 8%, `lyric_harness.py:_base` 7%, `lyric_harness.py:Lexicon._derive_cmu_readings` 5%


## lyric_grade

Runs `lyric_harness.py` `--lexicon-supplement=v2`, `plan`.

1040 named harness functions ran, in 50 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 58%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 39%
    - `lyric_harness.py:_derived_accent_entries` 36%
      - `lyric_harness.py:derive_accent_readings` 34%
      - `quality/plan.py:_bindable_at` 8%
      - `lyric_harness.py:_is_vowel` 7%
- `lyric_harness.py:main._print_brief_report` 23%
  - `quality/revise.py:Reviser.grade` 19%
    - `quality/relations.py:whole_vocabulary_pairs` 12%
      - `quality/relations.py:line_pairs_for` 14%
    - `quality/relations.py:VocabularyPairResults.listed` 3%
      - `quality/relations.py:VocabularyPairResults.resolve_readings` 3%
  - `quality/revise.py:Reviser.inspect` 15%
  - `quality/revise.py:Reviser.brief` 13%
- `quality/revise.py:Reviser.__init__` 22%
  - `quality/floor.py:SlopFloor.__init__` 22%
    - `quality/features.py:QualityFeatures.__init__` 14%
      - `quality/features.py:RhymeField.__init__` 7%
      - `quality/features.py:staged_resources_or_refuse` 7%
    - `quality/field_store.py:attach` 5%
      - `quality/field_store.py:store_identity` 5%
    - `quality/floor.py:_default_lexicon` 4%
      - `quality/phonology/eng.py:_lexicon` 11%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 17%
- `quality/plan.py:make_plan` 8%
  - `quality/plan.py:_redraw_past_joint_gate` 8%
    - `quality/plan.py:_make_plan_candidate` 8%
      - `quality/plan.py:_assign_types` 8%
      - `quality/plan.py:eligible_types` 8%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 9%, `lyric_harness.py:derive_accent_readings` 7%, `lyric_harness.py:_is_vowel` 5%, `lyric_harness.py:_vowel_letters` 5%, `lyric_harness.py:_base` 4%, `lyric_harness.py:Lexicon._derive_cmu_readings` 3%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `--lexicon-supplement=v2`.

1207 named harness functions ran, in 50 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 40%
  - `quality/loop.py:_VerdictCache.brief` 33%
    - `quality/loop.py:_VerdictCache._gate` 40%
      - `quality/loop.py:Deadline.step` 40%
    - `lyric_harness.py:_is_vowel` 4%
    - `quality/phonology/eng.py:English.parses` 3%
      - `lyric_harness.py:syllabify` 14%
      - `quality/plan.py:_bindable_at` 3%
- `quality/revise.py:Reviser.__init__` 32%
  - `quality/floor.py:SlopFloor.__init__` 32%
    - `quality/features.py:QualityFeatures.__init__` 22%
      - `quality/features.py:staged_resources_or_refuse` 11%
      - `quality/features.py:RhymeField.__init__` 11%
    - `quality/field_store.py:attach` 7%
      - `quality/field_store.py:store_identity` 7%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 30%
  - `lyric_harness.py:Lexicon.__init__` 36%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 22%
      - `lyric_harness.py:_derived_accent_entries` 19%
- `quality/plan.py:make_plan` 3%
  - `quality/plan.py:_redraw_past_joint_gate` 3%
    - `quality/plan.py:_make_plan_candidate` 3%
      - `quality/plan.py:_assign_types` 3%
      - `quality/plan.py:eligible_types` 3%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 7%, `lyric_harness.py:syllabify` 4%, `lyric_harness.py:derive_accent_readings` 4%, `lyric_harness.py:Lexicon._derive_cmu_readings` 3%, `lyric_harness.py:split_phone` 3%, `lyric_harness.py:_is_vowel` 3%


## lyric_recover

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

558 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/recover.py:recover_file` 53%
  - `quality/recover.py:recover` 53%
    - `quality/relations.py:whole_vocabulary_pairs` 39%
      - `quality/relations.py:line_pairs_for` 39%
    - `lyric_harness.py:_is_vowel` 8%
      - `lyric_harness.py:_base` 4%
    - `quality/relations.py:VocabularyPairResults.listed` 6%
      - `quality/relations.py:VocabularyPairResults.resolve_readings` 6%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 47%
  - `lyric_harness.py:Lexicon.__init__` 57%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 39%
      - `lyric_harness.py:_derived_accent_entries` 38%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 9%, `lyric_harness.py:derive_accent_readings` 8%, `lyric_harness.py:_is_vowel` 5%, `lyric_harness.py:_vowel_letters` 4%, `lyric_harness.py:_base` 4%, `quality/relations.py:evaluate` 4%


## lyric_check

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

808 named harness functions ran, in 47 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 51%
  - `quality/revise.py:Reviser.inspect` 51%
    - `quality/revise.py:Reviser.earned_pair_ban` 17%
      - `quality/revise.py:Reviser.modal_head_evidenced` 17%
    - `quality/floor.py:SlopFloor.check` 16%
      - `quality/features.py:QualityFeatures._predictability` 16%
      - `lyric_harness.py:_is_vowel` 3%
    - `quality/revise.py:Reviser.grade` 11%
      - `quality/relations.py:whole_vocabulary_pairs` 7%
    - `quality/revise.py:Reviser._band_findings` 6%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 5%
  - `quality/revise.py:Reviser.brief` 50%
- `quality/revise.py:Reviser.__init__` 30%
  - `quality/floor.py:SlopFloor.__init__` 30%
    - `quality/features.py:QualityFeatures.__init__` 19%
      - `quality/features.py:staged_resources_or_refuse` 10%
      - `quality/features.py:RhymeField.__init__` 9%
    - `quality/field_store.py:attach` 7%
      - `quality/field_store.py:store_identity` 7%
    - `quality/floor.py:_default_lexicon` 5%
      - `quality/phonology/eng.py:_lexicon` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 24%
  - `lyric_harness.py:Lexicon.__init__` 28%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 17%
      - `lyric_harness.py:_derived_accent_entries` 15%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 6%, `lyric_harness.py:score` 4%, `lyric_harness.py:derive_accent_readings` 3%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:split_phone` 3%, `quality/frequency.py:_count_rows` 2%


## lyric_verify

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

758 named harness functions ran, in 42 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 43%
  - `quality/revise.py:Reviser.inspect` 42%
    - `quality/revise.py:Reviser.earned_pair_ban` 19%
      - `quality/revise.py:Reviser.modal_head_evidenced` 19%
    - `quality/revise.py:Reviser.grade` 15%
      - `quality/relations.py:whole_vocabulary_pairs` 10%
      - `lyric_harness.py:_is_vowel` 4%
      - `quality/rhyme_types.py:coarse_relation_consensus` 3%
    - `quality/revise.py:Reviser._band_findings` 7%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 7%
- `quality/revise.py:Reviser.__init__` 35%
  - `quality/floor.py:SlopFloor.__init__` 35%
    - `quality/features.py:QualityFeatures.__init__` 22%
      - `quality/features.py:staged_resources_or_refuse` 11%
      - `quality/features.py:RhymeField.__init__` 11%
    - `quality/field_store.py:attach` 7%
      - `quality/field_store.py:store_identity` 7%
    - `quality/floor.py:_default_lexicon` 6%
      - `quality/phonology/eng.py:_lexicon` 6%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 29%
  - `lyric_harness.py:Lexicon.__init__` 34%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 20%
      - `lyric_harness.py:_derived_accent_entries` 18%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 8%, `lyric_harness.py:derive_accent_readings` 4%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:split_phone` 3%, `quality/frequency.py:_count_rows` 3%, `lyric_harness.py:_is_vowel` 2%


## lyric_types

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

506 named harness functions ran, in 36 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 72%
  - `lyric_harness.py:Lexicon.__init__` 87%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 59%
      - `lyric_harness.py:_derived_accent_entries` 57%
- `lyric_harness.py:end_pair_relations` 20%
  - `quality/relations.py:build_stream` 17%
    - `quality/phonology/eng.py:English.tokens_for_line` 16%
      - `quality/phonology/eng.py:English._aside_rule` 16%
  - `lyric_harness.py:_screen_not_applicable` 16%
    - `quality/relations.py:placement_bindable` 16%
      - `lyric_harness.py:_is_vowel` 12%
- `quality/rhyme_types.py:names_at` 6%
  - `quality/rhyme_types.py:_member_reading_combos` 5%
    - `lyric_harness.py:accents_agree` 5%
      - `lyric_harness.py:_rules_bearing` 5%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 14%, `lyric_harness.py:derive_accent_readings` 11%, `lyric_harness.py:_is_vowel` 8%, `lyric_harness.py:_vowel_letters` 6%, `lyric_harness.py:_base` 6%, `lyric_harness.py:_derived_accent_entries` 3%


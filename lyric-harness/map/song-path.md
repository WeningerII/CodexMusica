# Song path

What runs when each lyric tool is called, from one profiled run of a supplied song (`node map/trace.mjs --song=FILE`) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --song=FILE --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

433 named harness functions ran, in 33 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 94%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 68%
    - `lyric_harness.py:_derived_accent_entries` 65%
      - `lyric_harness.py:derive_accent_readings` 61%
- `quality/plan.py:sweep` 20%
  - `quality/plan.py:_sweep_one` 20%
    - `quality/plan.py:make_plan` 20%
      - `quality/plan.py:_redraw_past_joint_gate` 20%
  - `quality/plan.py:_bindable_at` 19%
    - `quality/relations.py:placement_bindable` 19%
      - `quality/relations.py:build_stream` 17%
      - `lyric_harness.py:_is_vowel` 13%

Most time spent inside the function itself: `lyric_harness.py:derive_accent_readings` 13%, `lyric_harness.py:Lexicon.__init__` 12%, `lyric_harness.py:_is_vowel` 9%, `lyric_harness.py:_vowel_letters` 8%, `lyric_harness.py:_base` 7%, `lyric_harness.py:Lexicon._derive_cmu_readings` 4%


## lyric_screen

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

754 named harness functions ran, in 40 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:screen_pairs` 90%
  - `quality/revise.py:Reviser.inspect` 73%
    - `quality/floor.py:SlopFloor.check` 45%
      - `quality/features.py:QualityFeatures._predictability` 45%
    - `quality/revise.py:Reviser.grade` 16%
      - `quality/relations.py:whole_vocabulary_pairs` 13%
    - `quality/revise.py:Reviser.earned_pair_ban` 9%
      - `quality/revise.py:Reviser.modal_head_evidenced` 9%
  - `quality/revise.py:Reviser.__init__` 14%
    - `quality/floor.py:SlopFloor.__init__` 14%
      - `quality/features.py:QualityFeatures.__init__` 9%
      - `quality/field_store.py:attach` 3%
  - `lyric_harness.py:end_pair_relations` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 11%
  - `lyric_harness.py:Lexicon.__init__` 13%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 8%
      - `lyric_harness.py:_derived_accent_entries` 8%

Most time spent inside the function itself: `lyric_harness.py:score` 13%, `lyric_harness.py:shared_ending` 4%, `lyric_harness.py:channel_agreement` 3%, `lyric_harness.py:cluster_sim` 3%, `lyric_harness.py:Lexicon.__init__` 2%, `lyric_harness.py:cons_sim` 2%


## lyric_plan

Runs `lyric_harness.py` `plan`.

431 named harness functions ran, in 33 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 95%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 67%
    - `lyric_harness.py:_derived_accent_entries` 63%
      - `lyric_harness.py:derive_accent_readings` 60%
- `quality/plan.py:make_plan` 20%
  - `quality/plan.py:_redraw_past_joint_gate` 20%
    - `quality/plan.py:_make_plan_candidate` 20%
      - `quality/plan.py:_assign_types` 19%
      - `quality/plan.py:eligible_types` 19%
      - `quality/plan.py:_bindable_at` 19%
      - `lyric_harness.py:_is_vowel` 13%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 13%, `lyric_harness.py:derive_accent_readings` 12%, `lyric_harness.py:_is_vowel` 9%, `lyric_harness.py:_vowel_letters` 8%, `lyric_harness.py:_base` 7%, `lyric_harness.py:Lexicon._derive_cmu_readings` 4%


## lyric_grade

Runs `lyric_harness.py` `--lexicon-supplement=v2`, `plan`.

1024 named harness functions ran, in 49 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 59%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 40%
    - `lyric_harness.py:_derived_accent_entries` 37%
      - `lyric_harness.py:derive_accent_readings` 36%
      - `quality/plan.py:_bindable_at` 9%
      - `lyric_harness.py:_is_vowel` 8%
- `quality/revise.py:Reviser.__init__` 22%
  - `quality/floor.py:SlopFloor.__init__` 22%
    - `quality/features.py:QualityFeatures.__init__` 14%
      - `quality/features.py:staged_resources_or_refuse` 7%
      - `quality/features.py:RhymeField.__init__` 7%
    - `quality/field_store.py:attach` 5%
      - `quality/field_store.py:store_identity` 5%
    - `quality/floor.py:_default_lexicon` 3%
      - `quality/phonology/eng.py:_lexicon` 11%
- `lyric_harness.py:main._print_brief_report` 22%
  - `quality/revise.py:Reviser.grade` 18%
    - `quality/relations.py:whole_vocabulary_pairs` 13%
      - `quality/relations.py:line_pairs_for` 14%
  - `quality/revise.py:Reviser.inspect` 14%
  - `quality/revise.py:Reviser.brief` 12%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 18%
- `quality/plan.py:make_plan` 9%
  - `quality/plan.py:_redraw_past_joint_gate` 9%
    - `quality/plan.py:_make_plan_candidate` 9%
      - `quality/plan.py:_assign_types` 9%
      - `quality/plan.py:eligible_types` 9%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 9%, `lyric_harness.py:derive_accent_readings` 7%, `lyric_harness.py:_is_vowel` 5%, `lyric_harness.py:_vowel_letters` 5%, `lyric_harness.py:_base` 4%, `quality/relations.py:tri_and` 3%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `--lexicon-supplement=v2`.

1173 named harness functions ran, in 49 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 40%
  - `quality/loop.py:_VerdictCache.brief` 33%
    - `quality/loop.py:_VerdictCache._gate` 40%
      - `quality/loop.py:Deadline.step` 40%
    - `lyric_harness.py:_is_vowel` 4%
    - `quality/phonology/eng.py:English.parses` 3%
      - `lyric_harness.py:syllabify` 15%
- `quality/revise.py:Reviser.__init__` 32%
  - `quality/floor.py:SlopFloor.__init__` 32%
    - `quality/features.py:QualityFeatures.__init__` 22%
      - `quality/features.py:staged_resources_or_refuse` 11%
      - `quality/features.py:RhymeField.__init__` 11%
    - `quality/field_store.py:attach` 7%
      - `quality/field_store.py:store_identity` 7%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 30%
  - `lyric_harness.py:Lexicon.__init__` 35%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 22%
      - `lyric_harness.py:_derived_accent_entries` 19%
- `quality/plan.py:make_plan` 3%
  - `quality/plan.py:_redraw_past_joint_gate` 3%
    - `quality/plan.py:_make_plan_candidate` 3%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 7%, `lyric_harness.py:derive_accent_readings` 4%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:split_phone` 3%, `lyric_harness.py:_is_vowel` 3%, `lyric_harness.py:Lexicon._derive_cmu_readings` 3%


## lyric_recover

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

561 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/recover.py:recover_file` 53%
  - `quality/recover.py:recover` 53%
    - `quality/relations.py:whole_vocabulary_pairs` 39%
      - `quality/relations.py:line_pairs_for` 40%
    - `lyric_harness.py:_is_vowel` 8%
      - `lyric_harness.py:_base` 4%
    - `quality/relations.py:VocabularyPairResults.listed` 6%
      - `quality/relations.py:VocabularyPairResults.resolve_readings` 6%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 47%
  - `lyric_harness.py:Lexicon.__init__` 57%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 40%
      - `lyric_harness.py:_derived_accent_entries` 39%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 8%, `lyric_harness.py:derive_accent_readings` 8%, `lyric_harness.py:_is_vowel` 5%, `lyric_harness.py:_vowel_letters` 4%, `lyric_harness.py:_base` 4%, `quality/relations.py:evaluate` 4%


## lyric_check

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

790 named harness functions ran, in 45 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 52%
  - `quality/revise.py:Reviser.inspect` 52%
    - `quality/revise.py:Reviser.earned_pair_ban` 18%
      - `quality/revise.py:Reviser.modal_head_evidenced` 18%
    - `quality/floor.py:SlopFloor.check` 16%
      - `quality/features.py:QualityFeatures._predictability` 16%
      - `lyric_harness.py:_is_vowel` 3%
    - `quality/revise.py:Reviser.grade` 11%
      - `quality/relations.py:whole_vocabulary_pairs` 7%
    - `quality/revise.py:Reviser._band_findings` 6%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 5%
  - `quality/revise.py:Reviser.brief` 51%
- `quality/revise.py:Reviser.__init__` 28%
  - `quality/floor.py:SlopFloor.__init__` 28%
    - `quality/features.py:QualityFeatures.__init__` 17%
      - `quality/features.py:staged_resources_or_refuse` 9%
      - `quality/features.py:RhymeField.__init__` 8%
    - `quality/field_store.py:attach` 6%
      - `quality/field_store.py:store_identity` 6%
    - `quality/floor.py:_default_lexicon` 4%
      - `quality/phonology/eng.py:_lexicon` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 25%
  - `lyric_harness.py:Lexicon.__init__` 28%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 17%
      - `lyric_harness.py:_derived_accent_entries` 16%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 6%, `lyric_harness.py:score` 4%, `lyric_harness.py:derive_accent_readings` 3%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:split_phone` 3%, `quality/frequency.py:_count_rows` 3%


## lyric_verify

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

758 named harness functions ran, in 42 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 44%
  - `quality/revise.py:Reviser.inspect` 44%
    - `quality/revise.py:Reviser.earned_pair_ban` 20%
      - `quality/revise.py:Reviser.modal_head_evidenced` 20%
    - `quality/revise.py:Reviser.grade` 16%
      - `quality/relations.py:whole_vocabulary_pairs` 11%
      - `lyric_harness.py:_is_vowel` 4%
      - `quality/rhyme_types.py:coarse_relation_consensus` 3%
    - `quality/revise.py:Reviser._band_findings` 7%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 6%
- `quality/revise.py:Reviser.__init__` 34%
  - `quality/floor.py:SlopFloor.__init__` 34%
    - `quality/features.py:QualityFeatures.__init__` 21%
      - `quality/features.py:staged_resources_or_refuse` 11%
      - `quality/features.py:RhymeField.__init__` 10%
    - `quality/field_store.py:attach` 8%
      - `quality/field_store.py:store_identity` 8%
    - `quality/floor.py:_default_lexicon` 5%
      - `quality/phonology/eng.py:_lexicon` 5%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 28%
  - `lyric_harness.py:Lexicon.__init__` 33%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 19%
      - `lyric_harness.py:_derived_accent_entries` 18%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 7%, `lyric_harness.py:syllabify` 4%, `lyric_harness.py:derive_accent_readings` 4%, `lyric_harness.py:split_phone` 3%, `quality/frequency.py:_count_rows` 3%, `lyric_harness.py:_is_vowel` 3%


## lyric_types

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

506 named harness functions ran, in 36 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 75%
  - `lyric_harness.py:Lexicon.__init__` 89%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 63%
      - `lyric_harness.py:_derived_accent_entries` 62%
- `lyric_harness.py:end_pair_relations` 18%
  - `quality/relations.py:build_stream` 15%
    - `quality/phonology/eng.py:English.tokens_for_line` 14%
      - `quality/phonology/eng.py:English._aside_rule` 14%
  - `lyric_harness.py:_screen_not_applicable` 15%
    - `quality/relations.py:placement_bindable` 15%
      - `lyric_harness.py:_is_vowel` 13%
- `quality/rhyme_types.py:names_at` 5%
  - `quality/rhyme_types.py:_member_reading_combos` 4%
    - `lyric_harness.py:accents_agree` 4%
      - `lyric_harness.py:_rules_bearing` 4%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 13%, `lyric_harness.py:derive_accent_readings` 12%, `lyric_harness.py:_is_vowel` 9%, `lyric_harness.py:_base` 7%, `lyric_harness.py:_vowel_letters` 7%, `lyric_harness.py:_derived_accent_entries` 3%


# Song path

What runs when each lyric tool is called, from one profiled run of the reference song (`map/song.txt`, 16 lines) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

391 named harness functions ran, in 32 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 95%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 68%
    - `lyric_harness.py:_derived_accent_entries` 62%
      - `lyric_harness.py:derive_accent_readings` 59%
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

750 named harness functions ran, in 40 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:screen_pairs` 83%
  - `quality/revise.py:Reviser.inspect` 49%
    - `quality/revise.py:Reviser.grade` 25%
      - `quality/relations.py:whole_vocabulary_pairs` 21%
    - `quality/revise.py:Reviser.earned_pair_ban` 15%
      - `quality/revise.py:Reviser.modal_head_evidenced` 15%
    - `quality/revise.py:Reviser._band_findings` 7%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 5%
  - `quality/revise.py:Reviser.__init__` 19%
    - `quality/floor.py:SlopFloor.__init__` 19%
      - `quality/features.py:QualityFeatures.__init__` 11%
      - `quality/field_store.py:attach` 5%
      - `quality/floor.py:_default_lexicon` 3%
  - `lyric_harness.py:end_pair_relations` 14%
    - `quality/relations.py:pair_satisfies_any` 8%
      - `quality/relations.py:pair_satisfies` 6%
    - `quality/relations.py:build_stream` 7%
      - `quality/phonology/eng.py:English.tokens_for_line` 4%
    - `lyric_harness.py:_screen_not_applicable` 4%
      - `quality/relations.py:placement_bindable` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 22%
  - `lyric_harness.py:Lexicon.__init__` 34%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 15%
      - `lyric_harness.py:_derived_accent_entries` 13%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 12%, `lyric_harness.py:syllabify` 4%, `lyric_harness.py:derive_accent_readings` 3%, `lyric_harness.py:split_phone` 3%, `quality/relations.py:evaluate` 2%, `quality/frequency.py:_count_rows` 2%


## lyric_plan

Runs `lyric_harness.py` `plan`.

387 named harness functions ran, in 32 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 95%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 66%
    - `lyric_harness.py:_derived_accent_entries` 60%
      - `lyric_harness.py:derive_accent_readings` 57%
- `quality/plan.py:make_plan` 22%
  - `quality/plan.py:_redraw_past_joint_gate` 22%
    - `quality/plan.py:_make_plan_candidate` 22%
      - `quality/plan.py:_assign_types` 22%
      - `quality/plan.py:eligible_types` 22%
      - `quality/plan.py:_bindable_at` 22%
      - `lyric_harness.py:_is_vowel` 12%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 14%, `lyric_harness.py:derive_accent_readings` 12%, `lyric_harness.py:_is_vowel` 8%, `lyric_harness.py:_vowel_letters` 8%, `lyric_harness.py:_base` 6%, `lyric_harness.py:Lexicon._derive_cmu_readings` 6%


## lyric_grade

Runs `lyric_harness.py` `--lexicon-supplement=v2`, `plan`.

1047 named harness functions ran, in 51 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 59%
  - `quality/schema_instance_evidence.py:for_grade` 31%
    - `quality/schema_instance_evidence.py:_for_grade` 31%
      - `quality/schema_instance_evidence.py:from_stream` 31%
      - `quality/relations.py:build_stream` 6%
      - `quality/plan.py:_bindable_at` 5%
      - `lyric_harness.py:_is_vowel` 4%
  - `quality/revise.py:Reviser.inspect` 21%
    - `quality/revise.py:Reviser.grade` 16%
      - `quality/relations.py:whole_vocabulary_pairs` 13%
    - `quality/revise.py:Reviser.earned_pair_ban` 8%
      - `quality/revise.py:Reviser.modal_head_evidenced` 8%
  - `quality/revise.py:Reviser.brief` 21%
- `lyric_harness.py:Lexicon.__init__` 36%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 22%
    - `lyric_harness.py:_derived_accent_entries` 21%
      - `lyric_harness.py:derive_accent_readings` 19%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 11%
- `quality/revise.py:Reviser.__init__` 10%
  - `quality/floor.py:SlopFloor.__init__` 10%
    - `quality/features.py:QualityFeatures.__init__` 5%
      - `quality/features.py:RhymeField.__init__` 4%
- `quality/plan.py:make_plan` 5%
  - `quality/plan.py:_redraw_past_joint_gate` 5%
    - `quality/plan.py:_make_plan_candidate` 5%
      - `quality/plan.py:_assign_types` 5%
      - `quality/plan.py:eligible_types` 5%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 8%, `quality/relations.py:evaluate` 5%, `lyric_harness.py:derive_accent_readings` 4%, `quality/relations.py:_set_agree` 3%, `lyric_harness.py:_is_vowel` 3%, `lyric_harness.py:_vowel_letters` 3%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `--lexicon-supplement=v2`.

1107 named harness functions ran, in 49 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 53%
  - `quality/loop.py:_VerdictCache.brief` 48%
    - `quality/loop.py:_VerdictCache._gate` 53%
      - `quality/loop.py:Deadline.step` 53%
    - `lyric_harness.py:_is_vowel` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 25%
  - `lyric_harness.py:Lexicon.__init__` 37%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 17%
      - `lyric_harness.py:_derived_accent_entries` 16%
- `quality/revise.py:Reviser.__init__` 23%
  - `quality/floor.py:SlopFloor.__init__` 23%
    - `quality/features.py:QualityFeatures.__init__` 13%
      - `quality/features.py:RhymeField.__init__` 9%
      - `quality/features.py:staged_resources_or_refuse` 4%
    - `quality/field_store.py:attach` 6%
      - `quality/field_store.py:store_identity` 6%
    - `quality/floor.py:_default_lexicon` 4%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 11%, `lyric_harness.py:syllabify` 5%, `lyric_harness.py:derive_accent_readings` 3%, `lyric_harness.py:split_phone` 3%, `quality/frequency.py:_count_rows` 2%, `lyric_harness.py:_is_vowel` 2%


## lyric_recover

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

555 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/recover.py:recover_file` 57%
  - `quality/recover.py:recover` 57%
    - `quality/relations.py:whole_vocabulary_pairs` 42%
      - `quality/relations.py:line_pairs_for` 43%
      - `quality/relations.py:whole_vocabulary_pairs._build` 3%
    - `quality/relations.py:VocabularyPairResults.listed` 8%
      - `quality/relations.py:VocabularyPairResults.resolve_readings` 8%
    - `lyric_harness.py:_is_vowel` 7%
      - `lyric_harness.py:_base` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 43%
  - `lyric_harness.py:Lexicon.__init__` 52%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 35%
      - `lyric_harness.py:_derived_accent_entries` 34%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 8%, `lyric_harness.py:derive_accent_readings` 7%, `lyric_harness.py:_is_vowel` 5%, `quality/relations.py:evaluate` 5%, `lyric_harness.py:_vowel_letters` 4%, `lyric_harness.py:_base` 4%


## lyric_check

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

829 named harness functions ran, in 46 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 73%
  - `quality/schema_instance_evidence.py:for_grade` 44%
    - `quality/schema_instance_evidence.py:_for_grade` 44%
      - `quality/schema_instance_evidence.py:from_stream` 43%
  - `quality/revise.py:Reviser.inspect` 30%
    - `quality/revise.py:Reviser.grade` 13%
      - `quality/relations.py:whole_vocabulary_pairs` 11%
    - `quality/revise.py:Reviser.earned_pair_ban` 12%
      - `quality/revise.py:Reviser.modal_head_evidenced` 12%
    - `quality/revise.py:Reviser._band_findings` 4%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 4%
  - `quality/revise.py:Reviser.brief` 29%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 16%
  - `lyric_harness.py:Lexicon.__init__` 22%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 10%
      - `lyric_harness.py:_derived_accent_entries` 10%
- `quality/revise.py:Reviser.__init__` 15%
  - `quality/floor.py:SlopFloor.__init__` 15%
    - `quality/features.py:QualityFeatures.__init__` 8%
      - `quality/features.py:RhymeField.__init__` 5%
    - `quality/field_store.py:attach` 4%
      - `quality/field_store.py:store_identity` 4%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 7%, `quality/relations.py:evaluate` 6%, `quality/relations.py:_set_agree` 3%, `quality/relations.py:ClassEqual.__call__` 3%, `quality/relations.py:_alts` 2%, `lyric_harness.py:derive_accent_readings` 2%


## lyric_verify

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

742 named harness functions ran, in 41 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 55%
  - `quality/revise.py:Reviser.inspect` 55%
    - `quality/revise.py:Reviser.grade` 26%
      - `quality/relations.py:whole_vocabulary_pairs` 22%
      - `lyric_harness.py:_is_vowel` 3%
    - `quality/revise.py:Reviser.earned_pair_ban` 21%
      - `quality/revise.py:Reviser.modal_head_evidenced` 21%
    - `quality/revise.py:Reviser._band_findings` 7%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 7%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 27%
  - `lyric_harness.py:Lexicon.__init__` 37%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 17%
      - `lyric_harness.py:_derived_accent_entries` 16%
- `quality/revise.py:Reviser.__init__` 25%
  - `quality/floor.py:SlopFloor.__init__` 25%
    - `quality/features.py:QualityFeatures.__init__` 14%
      - `quality/features.py:RhymeField.__init__` 10%
      - `quality/features.py:staged_resources_or_refuse` 5%
    - `quality/field_store.py:attach` 6%
      - `quality/field_store.py:store_identity` 6%
    - `quality/floor.py:_default_lexicon` 4%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 12%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:derive_accent_readings` 3%, `lyric_harness.py:split_phone` 3%, `quality/frequency.py:_count_rows` 3%, `quality/relations.py:evaluate` 2%


## lyric_types

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

485 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 60%
  - `lyric_harness.py:Lexicon.__init__` 88%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 50%
      - `lyric_harness.py:_derived_accent_entries` 47%
- `lyric_harness.py:end_pair_relations` 31%
  - `quality/relations.py:pair_satisfies_any` 15%
    - `quality/relations.py:pair_satisfies` 15%
      - `quality/relations.py:evaluate` 15%
  - `quality/relations.py:build_stream` 15%
    - `quality/phonology/eng.py:English.tokens_for_line` 14%
      - `quality/phonology/eng.py:English._aside_rule` 14%
  - `lyric_harness.py:_screen_not_applicable` 15%
    - `quality/relations.py:placement_bindable` 15%
      - `lyric_harness.py:_is_vowel` 10%
- `quality/rhyme_types.py:names_at` 6%
  - `quality/rhyme_types.py:_member_reading_combos` 6%
    - `lyric_harness.py:accents_agree` 5%
      - `lyric_harness.py:_rules_bearing` 5%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 20%, `lyric_harness.py:derive_accent_readings` 9%, `lyric_harness.py:_is_vowel` 6%, `lyric_harness.py:_vowel_letters` 5%, `lyric_harness.py:_base` 5%, `lyric_harness.py:Lexicon._derive_cmu_readings` 2%


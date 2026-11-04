# Song path

What runs when each lyric tool is called, from one profiled run of the reference song (`map/song.txt`, 16 lines) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

393 named harness functions ran, in 33 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 96%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 67%
    - `lyric_harness.py:_derived_accent_entries` 58%
      - `lyric_harness.py:derive_accent_readings` 54%
- `quality/plan.py:sweep` 21%
  - `quality/plan.py:_sweep_one` 21%
    - `quality/plan.py:make_plan` 21%
      - `quality/plan.py:_redraw_past_joint_gate` 21%
  - `quality/plan.py:_bindable_at` 21%
    - `quality/relations.py:placement_bindable` 21%
      - `quality/relations.py:build_stream` 20%
      - `lyric_harness.py:_is_vowel` 11%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 14%, `lyric_harness.py:derive_accent_readings` 11%, `lyric_harness.py:_vowel_letters` 9%, `lyric_harness.py:Lexicon._derive_cmu_readings` 9%, `lyric_harness.py:_is_vowel` 7%, `lyric_harness.py:_base` 6%


## lyric_screen

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

710 named harness functions ran, in 38 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:screen_pairs` 88%
  - `quality/revise.py:Reviser.inspect` 64%
    - `quality/floor.py:SlopFloor.check` 42%
      - `quality/features.py:QualityFeatures._predictability` 42%
    - `quality/revise.py:Reviser.grade` 17%
      - `quality/relations.py:whole_vocabulary_pairs` 15%
    - `quality/revise.py:Reviser._band_findings` 4%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 3%
  - `quality/revise.py:Reviser.__init__` 14%
    - `quality/floor.py:SlopFloor.__init__` 14%
      - `quality/features.py:QualityFeatures.__init__` 7%
      - `quality/field_store.py:attach` 3%
      - `quality/floor.py:_default_lexicon` 3%
  - `lyric_harness.py:end_pair_relations` 10%
    - `quality/relations.py:pair_satisfies_any` 5%
      - `quality/relations.py:pair_satisfies` 4%
    - `quality/relations.py:build_stream` 5%
      - `quality/phonology/eng.py:English.tokens_for_line` 3%
    - `lyric_harness.py:_screen_not_applicable` 3%
      - `quality/relations.py:placement_bindable` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 15%
  - `lyric_harness.py:Lexicon.__init__` 25%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 11%
      - `lyric_harness.py:_derived_accent_entries` 9%

Most time spent inside the function itself: `lyric_harness.py:score` 11%, `lyric_harness.py:Lexicon.__init__` 9%, `lyric_harness.py:shared_ending` 3%, `lyric_harness.py:cluster_sim` 3%, `lyric_harness.py:channel_agreement` 3%, `lyric_harness.py:syllabify` 2%


## lyric_plan

Runs `lyric_harness.py` `plan`.

388 named harness functions ran, in 33 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 95%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 67%
    - `lyric_harness.py:_derived_accent_entries` 57%
      - `lyric_harness.py:derive_accent_readings` 54%
- `quality/plan.py:make_plan` 23%
  - `quality/plan.py:_redraw_past_joint_gate` 23%
    - `quality/plan.py:_make_plan_candidate` 23%
      - `quality/plan.py:_assign_types` 23%
      - `quality/plan.py:eligible_types` 23%
      - `quality/plan.py:_bindable_at` 23%
      - `lyric_harness.py:_is_vowel` 11%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 14%, `lyric_harness.py:derive_accent_readings` 11%, `lyric_harness.py:Lexicon._derive_cmu_readings` 10%, `lyric_harness.py:_vowel_letters` 9%, `lyric_harness.py:_is_vowel` 7%, `lyric_harness.py:_base` 6%


## lyric_grade

Runs `lyric_harness.py` `--lexicon-supplement=v2`, `plan`.

1006 named harness functions ran, in 50 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 54%
  - `quality/schema_instance_evidence.py:for_grade` 32%
    - `quality/schema_instance_evidence.py:_for_grade` 32%
      - `quality/schema_instance_evidence.py:from_stream` 31%
      - `quality/relations.py:build_stream` 9%
      - `quality/plan.py:_bindable_at` 6%
      - `lyric_harness.py:_is_vowel` 4%
  - `quality/revise.py:Reviser.grade` 19%
    - `quality/relations.py:whole_vocabulary_pairs` 14%
      - `quality/relations.py:line_pairs_for` 14%
  - `quality/revise.py:Reviser.inspect` 14%
    - `quality/revise.py:Reviser._band_findings` 3%
  - `quality/revise.py:Reviser.brief` 13%
- `lyric_harness.py:Lexicon.__init__` 41%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 25%
    - `lyric_harness.py:_derived_accent_entries` 21%
      - `lyric_harness.py:derive_accent_readings` 20%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 12%
- `quality/revise.py:Reviser.__init__` 11%
  - `quality/floor.py:SlopFloor.__init__` 11%
    - `quality/features.py:QualityFeatures.__init__` 6%
      - `quality/features.py:RhymeField.__init__` 4%
- `quality/plan.py:make_plan` 6%
  - `quality/plan.py:_redraw_past_joint_gate` 6%
    - `quality/plan.py:_make_plan_candidate` 6%
      - `quality/plan.py:_assign_types` 6%
      - `quality/plan.py:eligible_types` 6%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 10%, `quality/relations.py:evaluate` 5%, `lyric_harness.py:derive_accent_readings` 4%, `lyric_harness.py:Lexicon._derive_cmu_readings` 4%, `lyric_harness.py:_vowel_letters` 3%, `lyric_harness.py:_is_vowel` 3%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `--lexicon-supplement=v2`.

1130 named harness functions ran, in 51 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 41%
  - `quality/loop.py:_VerdictCache.brief` 35%
    - `quality/loop.py:_VerdictCache._gate` 41%
      - `quality/loop.py:Deadline.step` 41%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 27%
  - `lyric_harness.py:Lexicon.__init__` 41%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 17%
      - `lyric_harness.py:_derived_accent_entries` 15%
- `quality/revise.py:Reviser.__init__` 26%
  - `quality/floor.py:SlopFloor.__init__` 26%
    - `quality/features.py:QualityFeatures.__init__` 12%
      - `quality/features.py:RhymeField.__init__` 9%
    - `quality/field_store.py:attach` 8%
      - `quality/field_store.py:store_identity` 8%
    - `quality/floor.py:_default_lexicon` 5%
- `quality/schema_instance_evidence.py:for_grade` 7%
  - `quality/schema_instance_evidence.py:_for_grade` 7%
    - `quality/relations.py:build_stream` 9%
      - `quality/phonology/eng.py:English.tokens_for_line` 5%
      - `quality/phonology/eng.py:English.syllabify` 4%
    - `quality/schema_instance_evidence.py:from_stream` 7%
      - `quality/relations.py:realise` 21%
      - `quality/plan.py:_bindable_at` 6%
      - `quality/phonology/eng.py:English.parses` 3%
- `quality/plan.py:make_plan` 6%
  - `quality/plan.py:_redraw_past_joint_gate` 6%
    - `quality/plan.py:_make_plan_candidate` 6%
      - `quality/plan.py:_assign_types` 6%
      - `quality/plan.py:eligible_types` 6%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 15%, `lyric_harness.py:derive_accent_readings` 3%, `quality/relations.py:evaluate` 3%, `lyric_harness.py:Lexicon._derive_cmu_readings` 2%, `lyric_harness.py:_vowel_letters` 2%, `lyric_harness.py:syllabify` 2%


## lyric_recover

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

552 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/recover.py:recover_file` 58%
  - `quality/recover.py:recover` 58%
    - `quality/relations.py:whole_vocabulary_pairs` 44%
      - `quality/relations.py:line_pairs_for` 46%
      - `quality/relations.py:whole_vocabulary_pairs._build` 3%
    - `quality/relations.py:VocabularyPairResults.listed` 8%
      - `quality/relations.py:VocabularyPairResults.resolve_readings` 8%
    - `lyric_harness.py:_is_vowel` 6%
      - `lyric_harness.py:_base` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 42%
  - `lyric_harness.py:Lexicon.__init__` 54%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 35%
      - `lyric_harness.py:_derived_accent_entries` 32%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 12%, `lyric_harness.py:derive_accent_readings` 6%, `lyric_harness.py:_vowel_letters` 5%, `quality/relations.py:evaluate` 5%, `lyric_harness.py:_is_vowel` 4%, `lyric_harness.py:_base` 3%


## lyric_check

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

792 named harness functions ran, in 45 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 79%
  - `quality/revise.py:Reviser.inspect` 47%
    - `quality/floor.py:SlopFloor.check` 31%
      - `quality/features.py:QualityFeatures._predictability` 31%
    - `quality/revise.py:Reviser.grade` 12%
      - `quality/relations.py:whole_vocabulary_pairs` 10%
    - `quality/revise.py:Reviser._band_findings` 4%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 4%
  - `quality/revise.py:Reviser.brief` 47%
  - `quality/schema_instance_evidence.py:for_grade` 32%
    - `quality/schema_instance_evidence.py:_for_grade` 32%
      - `quality/schema_instance_evidence.py:from_stream` 31%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 13%
  - `lyric_harness.py:Lexicon.__init__` 19%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 9%
      - `lyric_harness.py:_derived_accent_entries` 7%
- `quality/revise.py:Reviser.__init__` 11%
  - `quality/floor.py:SlopFloor.__init__` 11%
    - `quality/features.py:QualityFeatures.__init__` 5%
      - `quality/features.py:RhymeField.__init__` 4%

Most time spent inside the function itself: `lyric_harness.py:score` 8%, `lyric_harness.py:Lexicon.__init__` 6%, `quality/relations.py:evaluate` 5%, `lyric_harness.py:shared_ending` 3%, `quality/relations.py:_set_agree` 2%, `lyric_harness.py:cluster_sim` 2%


## lyric_verify

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

703 named harness functions ran, in 39 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 70%
  - `quality/revise.py:Reviser.inspect` 70%
    - `quality/floor.py:SlopFloor.check` 46%
      - `quality/features.py:QualityFeatures._predictability` 46%
    - `quality/revise.py:Reviser.grade` 18%
      - `quality/relations.py:whole_vocabulary_pairs` 16%
    - `quality/revise.py:Reviser._band_findings` 5%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 18%
  - `lyric_harness.py:Lexicon.__init__` 26%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 12%
      - `lyric_harness.py:_derived_accent_entries` 10%
- `quality/revise.py:Reviser.__init__` 17%
  - `quality/floor.py:SlopFloor.__init__` 17%
    - `quality/features.py:QualityFeatures.__init__` 8%
      - `quality/features.py:RhymeField.__init__` 6%
    - `quality/field_store.py:attach` 4%
      - `quality/field_store.py:store_identity` 4%
    - `quality/floor.py:_default_lexicon` 4%

Most time spent inside the function itself: `lyric_harness.py:score` 12%, `lyric_harness.py:Lexicon.__init__` 9%, `lyric_harness.py:shared_ending` 4%, `lyric_harness.py:cluster_sim` 3%, `lyric_harness.py:channel_agreement` 3%, `lyric_harness.py:Lexicon._derive_cmu_readings` 3%


## lyric_types

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

484 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 58%
  - `lyric_harness.py:Lexicon.__init__` 92%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 49%
      - `lyric_harness.py:_derived_accent_entries` 44%
- `lyric_harness.py:end_pair_relations` 36%
  - `lyric_harness.py:_screen_not_applicable` 19%
    - `quality/relations.py:placement_bindable` 19%
      - `quality/relations.py:build_stream` 19%
      - `lyric_harness.py:_is_vowel` 9%
  - `quality/relations.py:pair_satisfies_any` 17%
    - `quality/relations.py:pair_satisfies` 17%
      - `quality/relations.py:evaluate` 17%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 26%, `lyric_harness.py:derive_accent_readings` 8%, `lyric_harness.py:_vowel_letters` 7%, `lyric_harness.py:_is_vowel` 6%, `lyric_harness.py:_base` 5%, `lyric_harness.py:Lexicon._derive_cmu_readings` 5%


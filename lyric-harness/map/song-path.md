# Song path

What runs when each lyric tool is called, from one profiled run of the reference song (`map/song.txt`, 16 lines) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

393 named harness functions ran, in 33 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 95%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 67%
    - `lyric_harness.py:_derived_accent_entries` 57%
      - `lyric_harness.py:derive_accent_readings` 53%
- `quality/plan.py:sweep` 24%
  - `quality/plan.py:_sweep_one` 24%
    - `quality/plan.py:make_plan` 24%
      - `quality/plan.py:_redraw_past_joint_gate` 24%
  - `quality/plan.py:_bindable_at` 24%
    - `quality/relations.py:placement_bindable` 24%
      - `quality/relations.py:build_stream` 22%
      - `lyric_harness.py:_is_vowel` 11%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 14%, `lyric_harness.py:derive_accent_readings` 11%, `lyric_harness.py:Lexicon._derive_cmu_readings` 10%, `lyric_harness.py:_vowel_letters` 9%, `lyric_harness.py:_is_vowel` 7%, `lyric_harness.py:_base` 6%


## lyric_screen

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

710 named harness functions ran, in 38 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:screen_pairs` 90%
  - `quality/revise.py:Reviser.inspect` 68%
    - `quality/floor.py:SlopFloor.check` 44%
      - `quality/features.py:QualityFeatures._predictability` 44%
    - `quality/revise.py:Reviser.grade` 18%
      - `quality/relations.py:whole_vocabulary_pairs` 16%
    - `quality/revise.py:Reviser._band_findings` 4%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 3%
  - `quality/revise.py:Reviser.__init__` 13%
    - `quality/floor.py:SlopFloor.__init__` 13%
      - `quality/features.py:QualityFeatures.__init__` 7%
      - `quality/field_store.py:attach` 3%
  - `lyric_harness.py:end_pair_relations` 9%
    - `quality/relations.py:pair_satisfies_any` 5%
      - `quality/relations.py:pair_satisfies` 4%
    - `quality/relations.py:build_stream` 4%
    - `lyric_harness.py:_screen_not_applicable` 3%
      - `quality/relations.py:placement_bindable` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 13%
  - `lyric_harness.py:Lexicon.__init__` 22%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 9%
      - `lyric_harness.py:_derived_accent_entries` 8%

Most time spent inside the function itself: `lyric_harness.py:score` 12%, `lyric_harness.py:Lexicon.__init__` 8%, `lyric_harness.py:shared_ending` 4%, `lyric_harness.py:cluster_sim` 3%, `lyric_harness.py:channel_agreement` 3%, `lyric_harness.py:cons_sim` 2%


## lyric_plan

Runs `lyric_harness.py` `plan`.

388 named harness functions ran, in 33 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 95%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 66%
    - `lyric_harness.py:_derived_accent_entries` 56%
      - `lyric_harness.py:derive_accent_readings` 53%
- `quality/plan.py:make_plan` 23%
  - `quality/plan.py:_redraw_past_joint_gate` 23%
    - `quality/plan.py:_make_plan_candidate` 23%
      - `quality/plan.py:_assign_types` 23%
      - `quality/plan.py:eligible_types` 23%
      - `quality/plan.py:_bindable_at` 23%
      - `lyric_harness.py:_is_vowel` 11%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 15%, `lyric_harness.py:derive_accent_readings` 10%, `lyric_harness.py:Lexicon._derive_cmu_readings` 10%, `lyric_harness.py:_vowel_letters` 9%, `lyric_harness.py:_is_vowel` 7%, `lyric_harness.py:_base` 6%


## lyric_grade

Runs `lyric_harness.py` `--lexicon-supplement=v2`, `plan`.

1006 named harness functions ran, in 50 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 55%
  - `quality/schema_instance_evidence.py:for_grade` 32%
    - `quality/schema_instance_evidence.py:_for_grade` 32%
      - `quality/schema_instance_evidence.py:from_stream` 31%
      - `quality/relations.py:build_stream` 8%
      - `quality/plan.py:_bindable_at` 6%
      - `lyric_harness.py:_is_vowel` 4%
  - `quality/revise.py:Reviser.grade` 19%
    - `quality/relations.py:whole_vocabulary_pairs` 15%
      - `quality/relations.py:line_pairs_for` 15%
  - `quality/revise.py:Reviser.inspect` 15%
    - `quality/revise.py:Reviser._band_findings` 3%
  - `quality/revise.py:Reviser.brief` 14%
- `lyric_harness.py:Lexicon.__init__` 41%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 25%
    - `lyric_harness.py:_derived_accent_entries` 21%
      - `lyric_harness.py:derive_accent_readings` 20%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 12%
- `quality/revise.py:Reviser.__init__` 11%
  - `quality/floor.py:SlopFloor.__init__` 11%
    - `quality/features.py:QualityFeatures.__init__` 5%
      - `quality/features.py:RhymeField.__init__` 4%
- `quality/plan.py:make_plan` 6%
  - `quality/plan.py:_redraw_past_joint_gate` 6%
    - `quality/plan.py:_make_plan_candidate` 6%
      - `quality/plan.py:_assign_types` 6%
      - `quality/plan.py:eligible_types` 6%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 10%, `quality/relations.py:evaluate` 5%, `lyric_harness.py:derive_accent_readings` 4%, `lyric_harness.py:Lexicon._derive_cmu_readings` 4%, `lyric_harness.py:_vowel_letters` 3%, `quality/relations.py:_set_agree` 3%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `--lexicon-supplement=v2`.

1130 named harness functions ran, in 51 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 40%
  - `quality/loop.py:_VerdictCache.brief` 34%
    - `quality/loop.py:_VerdictCache._gate` 40%
      - `quality/loop.py:Deadline.step` 40%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 27%
  - `lyric_harness.py:Lexicon.__init__` 41%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 18%
      - `lyric_harness.py:_derived_accent_entries` 15%
- `quality/revise.py:Reviser.__init__` 26%
  - `quality/floor.py:SlopFloor.__init__` 26%
    - `quality/features.py:QualityFeatures.__init__` 13%
      - `quality/features.py:RhymeField.__init__` 10%
    - `quality/field_store.py:attach` 9%
      - `quality/field_store.py:store_identity` 9%
    - `quality/floor.py:_default_lexicon` 5%
- `quality/schema_instance_evidence.py:for_grade` 7%
  - `quality/schema_instance_evidence.py:_for_grade` 7%
    - `quality/relations.py:build_stream` 10%
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

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 14%, `lyric_harness.py:derive_accent_readings` 3%, `quality/relations.py:evaluate` 3%, `lyric_harness.py:Lexicon._derive_cmu_readings` 2%, `lyric_harness.py:_vowel_letters` 2%, `lyric_harness.py:syllabify` 2%


## lyric_recover

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

552 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/recover.py:recover_file` 61%
  - `quality/recover.py:recover` 61%
    - `quality/relations.py:whole_vocabulary_pairs` 47%
      - `quality/relations.py:line_pairs_for` 48%
      - `quality/relations.py:whole_vocabulary_pairs._build` 3%
    - `quality/relations.py:VocabularyPairResults.listed` 8%
      - `quality/relations.py:VocabularyPairResults.resolve_readings` 8%
    - `lyric_harness.py:_is_vowel` 6%
      - `lyric_harness.py:_base` 3%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 39%
  - `lyric_harness.py:Lexicon.__init__` 52%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 32%
      - `lyric_harness.py:_derived_accent_entries` 29%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 12%, `lyric_harness.py:derive_accent_readings` 5%, `lyric_harness.py:_vowel_letters` 5%, `quality/relations.py:evaluate` 5%, `lyric_harness.py:_is_vowel` 4%, `lyric_harness.py:_base` 3%


## lyric_check

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

792 named harness functions ran, in 45 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 79%
  - `quality/revise.py:Reviser.inspect` 46%
    - `quality/floor.py:SlopFloor.check` 32%
      - `quality/features.py:QualityFeatures._predictability` 32%
    - `quality/revise.py:Reviser.grade` 11%
      - `quality/relations.py:whole_vocabulary_pairs` 9%
    - `quality/revise.py:Reviser._band_findings` 3%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 3%
  - `quality/revise.py:Reviser.brief` 46%
  - `quality/schema_instance_evidence.py:for_grade` 33%
    - `quality/schema_instance_evidence.py:_for_grade` 33%
      - `quality/schema_instance_evidence.py:from_stream` 32%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 12%
  - `lyric_harness.py:Lexicon.__init__` 18%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 9%
      - `lyric_harness.py:_derived_accent_entries` 7%
- `quality/revise.py:Reviser.__init__` 11%
  - `quality/floor.py:SlopFloor.__init__` 11%
    - `quality/features.py:QualityFeatures.__init__` 6%
      - `quality/features.py:RhymeField.__init__` 4%

Most time spent inside the function itself: `lyric_harness.py:score` 9%, `lyric_harness.py:Lexicon.__init__` 6%, `quality/relations.py:evaluate` 5%, `lyric_harness.py:shared_ending` 3%, `quality/relations.py:_set_agree` 2%, `lyric_harness.py:cluster_sim` 2%


## lyric_verify

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

703 named harness functions ran, in 39 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 70%
  - `quality/revise.py:Reviser.inspect` 70%
    - `quality/floor.py:SlopFloor.check` 47%
      - `quality/features.py:QualityFeatures._predictability` 47%
    - `quality/revise.py:Reviser.grade` 17%
      - `quality/relations.py:whole_vocabulary_pairs` 15%
    - `quality/revise.py:Reviser._band_findings` 5%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 18%
  - `lyric_harness.py:Lexicon.__init__` 25%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 12%
      - `lyric_harness.py:_derived_accent_entries` 10%
- `quality/revise.py:Reviser.__init__` 17%
  - `quality/floor.py:SlopFloor.__init__` 17%
    - `quality/features.py:QualityFeatures.__init__` 9%
      - `quality/features.py:RhymeField.__init__` 6%
    - `quality/field_store.py:attach` 4%
      - `quality/field_store.py:store_identity` 4%
    - `quality/floor.py:_default_lexicon` 4%

Most time spent inside the function itself: `lyric_harness.py:score` 12%, `lyric_harness.py:Lexicon.__init__` 8%, `lyric_harness.py:shared_ending` 4%, `lyric_harness.py:cluster_sim` 4%, `lyric_harness.py:channel_agreement` 3%, `lyric_harness.py:syllabify` 2%


## lyric_types

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

484 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 61%
  - `lyric_harness.py:Lexicon.__init__` 92%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 52%
      - `lyric_harness.py:_derived_accent_entries` 48%
- `lyric_harness.py:end_pair_relations` 33%
  - `quality/relations.py:build_stream` 17%
    - `quality/phonology/eng.py:English.tokens_for_line` 16%
      - `quality/phonology/eng.py:English._aside_rule` 16%
  - `lyric_harness.py:_screen_not_applicable` 17%
    - `quality/relations.py:placement_bindable` 17%
      - `lyric_harness.py:_is_vowel` 9%
  - `quality/relations.py:pair_satisfies_any` 16%
    - `quality/relations.py:pair_satisfies` 16%
      - `quality/relations.py:evaluate` 16%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 24%, `lyric_harness.py:derive_accent_readings` 9%, `lyric_harness.py:_vowel_letters` 8%, `lyric_harness.py:_is_vowel` 6%, `lyric_harness.py:_base` 5%, `lyric_harness.py:Lexicon._derive_cmu_readings` 4%


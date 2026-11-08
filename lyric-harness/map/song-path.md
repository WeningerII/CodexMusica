# Song path

What runs when each lyric tool is called, from one profiled run of the reference song (`map/song.txt`, 16 lines) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

393 named harness functions ran, in 33 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 95%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 66%
    - `lyric_harness.py:_derived_accent_entries` 56%
      - `lyric_harness.py:derive_accent_readings` 53%
- `quality/plan.py:sweep` 24%
  - `quality/plan.py:_sweep_one` 24%
    - `quality/plan.py:make_plan` 24%
      - `quality/plan.py:_redraw_past_joint_gate` 24%
  - `quality/plan.py:_bindable_at` 24%
    - `quality/relations.py:placement_bindable` 24%
      - `quality/relations.py:build_stream` 22%
      - `lyric_harness.py:_is_vowel` 11%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 15%, `lyric_harness.py:derive_accent_readings` 10%, `lyric_harness.py:Lexicon._derive_cmu_readings` 10%, `lyric_harness.py:_vowel_letters` 9%, `lyric_harness.py:_is_vowel` 7%, `lyric_harness.py:_base` 6%


## lyric_screen

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

747 named harness functions ran, in 40 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:screen_pairs` 84%
  - `quality/revise.py:Reviser.inspect` 53%
    - `quality/revise.py:Reviser.grade` 27%
      - `quality/relations.py:whole_vocabulary_pairs` 24%
    - `quality/revise.py:Reviser.earned_pair_ban` 16%
      - `quality/revise.py:Reviser.modal_head_evidenced` 16%
    - `quality/revise.py:Reviser._band_findings` 7%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 6%
  - `quality/revise.py:Reviser.__init__` 18%
    - `quality/floor.py:SlopFloor.__init__` 18%
      - `quality/features.py:QualityFeatures.__init__` 9%
      - `quality/field_store.py:attach` 5%
      - `quality/floor.py:_default_lexicon` 5%
  - `lyric_harness.py:end_pair_relations` 13%
    - `quality/relations.py:pair_satisfies_any` 7%
      - `quality/relations.py:pair_satisfies` 5%
    - `quality/relations.py:build_stream` 6%
      - `quality/phonology/eng.py:English.tokens_for_line` 4%
    - `lyric_harness.py:_screen_not_applicable` 4%
      - `quality/relations.py:placement_bindable` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 21%
  - `lyric_harness.py:Lexicon.__init__` 34%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 17%
      - `lyric_harness.py:_derived_accent_entries` 12%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 10%, `lyric_harness.py:Lexicon._derive_cmu_readings` 6%, `lyric_harness.py:syllabify` 5%, `quality/relations.py:evaluate` 3%, `lyric_harness.py:split_phone` 2%, `quality/frequency.py:_count_rows` 2%


## lyric_plan

Runs `lyric_harness.py` `plan`.

389 named harness functions ran, in 33 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 96%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 65%
    - `lyric_harness.py:_derived_accent_entries` 56%
      - `lyric_harness.py:derive_accent_readings` 53%
- `quality/plan.py:make_plan` 23%
  - `quality/plan.py:_redraw_past_joint_gate` 23%
    - `quality/plan.py:_make_plan_candidate` 23%
      - `quality/plan.py:_assign_types` 22%
      - `quality/plan.py:eligible_types` 22%
      - `quality/plan.py:_bindable_at` 22%
      - `lyric_harness.py:_is_vowel` 11%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 15%, `lyric_harness.py:derive_accent_readings` 10%, `lyric_harness.py:Lexicon._derive_cmu_readings` 9%, `lyric_harness.py:_vowel_letters` 9%, `lyric_harness.py:_is_vowel` 7%, `lyric_harness.py:_base` 6%


## lyric_grade

Runs `lyric_harness.py` `--lexicon-supplement=v2`, `plan`.

1038 named harness functions ran, in 51 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 58%
  - `quality/schema_instance_evidence.py:for_grade` 30%
    - `quality/schema_instance_evidence.py:_for_grade` 30%
      - `quality/schema_instance_evidence.py:from_stream` 29%
      - `quality/relations.py:build_stream` 7%
      - `quality/plan.py:_bindable_at` 6%
      - `lyric_harness.py:_is_vowel` 4%
  - `quality/revise.py:Reviser.inspect` 22%
    - `quality/revise.py:Reviser.grade` 16%
      - `quality/relations.py:whole_vocabulary_pairs` 13%
    - `quality/revise.py:Reviser.earned_pair_ban` 8%
      - `quality/revise.py:Reviser.modal_head_evidenced` 8%
    - `quality/revise.py:Reviser._band_findings` 3%
  - `quality/revise.py:Reviser.brief` 21%
- `lyric_harness.py:Lexicon.__init__` 39%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 23%
    - `lyric_harness.py:_derived_accent_entries` 19%
      - `lyric_harness.py:derive_accent_readings` 18%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 12%
- `quality/revise.py:Reviser.__init__` 10%
  - `quality/floor.py:SlopFloor.__init__` 10%
    - `quality/features.py:QualityFeatures.__init__` 5%
      - `quality/features.py:RhymeField.__init__` 4%
- `quality/plan.py:make_plan` 6%
  - `quality/plan.py:_redraw_past_joint_gate` 6%
    - `quality/plan.py:_make_plan_candidate` 6%
      - `quality/plan.py:_assign_types` 6%
      - `quality/plan.py:eligible_types` 6%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 9%, `quality/relations.py:evaluate` 5%, `lyric_harness.py:Lexicon._derive_cmu_readings` 4%, `lyric_harness.py:derive_accent_readings` 4%, `lyric_harness.py:_vowel_letters` 3%, `quality/relations.py:_set_agree` 3%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `--lexicon-supplement=v2`.

1093 named harness functions ran, in 48 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 55%
  - `quality/loop.py:_VerdictCache.brief` 50%
    - `quality/loop.py:_VerdictCache._gate` 55%
      - `quality/loop.py:Deadline.step` 55%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 26%
  - `lyric_harness.py:Lexicon.__init__` 39%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 18%
      - `lyric_harness.py:_derived_accent_entries` 14%
- `quality/revise.py:Reviser.__init__` 22%
  - `quality/floor.py:SlopFloor.__init__` 22%
    - `quality/features.py:QualityFeatures.__init__` 11%
      - `quality/features.py:RhymeField.__init__` 9%
    - `quality/field_store.py:attach` 6%
      - `quality/field_store.py:store_identity` 6%
    - `quality/floor.py:_default_lexicon` 5%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 12%, `lyric_harness.py:Lexicon._derive_cmu_readings` 4%, `lyric_harness.py:syllabify` 4%, `lyric_harness.py:split_phone` 3%, `lyric_harness.py:derive_accent_readings` 3%, `quality/frequency.py:_count_rows` 2%


## lyric_recover

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

552 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/recover.py:recover_file` 56%
  - `quality/recover.py:recover` 56%
    - `quality/relations.py:whole_vocabulary_pairs` 43%
      - `quality/relations.py:line_pairs_for` 45%
    - `quality/relations.py:VocabularyPairResults.listed` 7%
      - `quality/relations.py:VocabularyPairResults.resolve_readings` 7%
    - `lyric_harness.py:_is_vowel` 7%
      - `lyric_harness.py:_base` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 44%
  - `lyric_harness.py:Lexicon.__init__` 55%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 37%
      - `lyric_harness.py:_derived_accent_entries` 34%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 11%, `lyric_harness.py:derive_accent_readings` 6%, `lyric_harness.py:_vowel_letters` 6%, `lyric_harness.py:_is_vowel` 4%, `quality/relations.py:evaluate` 4%, `lyric_harness.py:_base` 4%


## lyric_check

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

826 named harness functions ran, in 46 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 72%
  - `quality/schema_instance_evidence.py:for_grade` 41%
    - `quality/schema_instance_evidence.py:_for_grade` 41%
      - `quality/schema_instance_evidence.py:from_stream` 40%
  - `quality/revise.py:Reviser.inspect` 31%
    - `quality/revise.py:Reviser.grade` 14%
      - `quality/relations.py:whole_vocabulary_pairs` 12%
    - `quality/revise.py:Reviser.earned_pair_ban` 12%
      - `quality/revise.py:Reviser.modal_head_evidenced` 12%
    - `quality/revise.py:Reviser._band_findings` 5%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 4%
  - `quality/revise.py:Reviser.brief` 31%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 17%
  - `lyric_harness.py:Lexicon.__init__` 24%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 12%
      - `lyric_harness.py:_derived_accent_entries` 10%
- `quality/revise.py:Reviser.__init__` 15%
  - `quality/floor.py:SlopFloor.__init__` 15%
    - `quality/features.py:QualityFeatures.__init__` 7%
      - `quality/features.py:RhymeField.__init__` 6%
    - `quality/field_store.py:attach` 4%
      - `quality/field_store.py:store_identity` 4%
    - `quality/floor.py:_default_lexicon` 4%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 8%, `quality/relations.py:evaluate` 6%, `quality/relations.py:_set_agree` 3%, `quality/relations.py:ClassEqual.__call__` 3%, `quality/relations.py:_alts` 2%, `lyric_harness.py:Lexicon._derive_cmu_readings` 2%


## lyric_verify

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

739 named harness functions ran, in 41 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 54%
  - `quality/revise.py:Reviser.inspect` 54%
    - `quality/revise.py:Reviser.grade` 27%
      - `quality/relations.py:whole_vocabulary_pairs` 23%
    - `quality/revise.py:Reviser.earned_pair_ban` 20%
      - `quality/revise.py:Reviser.modal_head_evidenced` 20%
    - `quality/revise.py:Reviser._band_findings` 7%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 6%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 27%
  - `lyric_harness.py:Lexicon.__init__` 39%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 18%
      - `lyric_harness.py:_derived_accent_entries` 15%
- `quality/revise.py:Reviser.__init__` 25%
  - `quality/floor.py:SlopFloor.__init__` 25%
    - `quality/features.py:QualityFeatures.__init__` 12%
      - `quality/features.py:RhymeField.__init__` 10%
    - `quality/field_store.py:attach` 6%
      - `quality/field_store.py:store_identity` 6%
    - `quality/floor.py:_default_lexicon` 6%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 13%, `lyric_harness.py:Lexicon._derive_cmu_readings` 3%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:derive_accent_readings` 3%, `lyric_harness.py:split_phone` 3%, `quality/frequency.py:_count_rows` 3%


## lyric_types

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

484 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 61%
  - `lyric_harness.py:Lexicon.__init__` 92%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 50%
      - `lyric_harness.py:_derived_accent_entries` 46%
- `lyric_harness.py:end_pair_relations` 34%
  - `quality/relations.py:build_stream` 18%
    - `quality/phonology/eng.py:English.tokens_for_line` 17%
      - `quality/phonology/eng.py:English._aside_rule` 17%
  - `lyric_harness.py:_screen_not_applicable` 18%
    - `quality/relations.py:placement_bindable` 18%
      - `lyric_harness.py:_is_vowel` 9%
  - `quality/relations.py:pair_satisfies_any` 16%
    - `quality/relations.py:pair_satisfies` 16%
      - `quality/relations.py:evaluate` 15%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 25%, `lyric_harness.py:derive_accent_readings` 8%, `lyric_harness.py:_vowel_letters` 7%, `lyric_harness.py:_is_vowel` 6%, `lyric_harness.py:_base` 5%, `lyric_harness.py:Lexicon._derive_cmu_readings` 4%


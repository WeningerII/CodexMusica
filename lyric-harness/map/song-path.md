# Song path

What runs when each lyric tool is called, from one profiled run of the reference song (`map/song.txt`, 16 lines) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

393 named harness functions ran, in 33 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 96%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 66%
    - `lyric_harness.py:_derived_accent_entries` 56%
      - `lyric_harness.py:derive_accent_readings` 52%
- `quality/plan.py:sweep` 24%
  - `quality/plan.py:_sweep_one` 24%
    - `quality/plan.py:make_plan` 24%
      - `quality/plan.py:_redraw_past_joint_gate` 24%
  - `quality/plan.py:_bindable_at` 24%
    - `quality/relations.py:placement_bindable` 24%
      - `quality/relations.py:build_stream` 23%
      - `lyric_harness.py:_is_vowel` 11%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 15%, `lyric_harness.py:derive_accent_readings` 10%, `lyric_harness.py:Lexicon._derive_cmu_readings` 10%, `lyric_harness.py:_vowel_letters` 8%, `lyric_harness.py:_is_vowel` 7%, `lyric_harness.py:_base` 6%


## lyric_screen

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

748 named harness functions ran, in 40 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:screen_pairs` 89%
  - `quality/revise.py:Reviser.inspect` 70%
    - `quality/floor.py:SlopFloor.check` 39%
      - `quality/features.py:QualityFeatures._predictability` 39%
    - `quality/revise.py:Reviser.grade` 16%
      - `quality/relations.py:whole_vocabulary_pairs` 14%
    - `quality/revise.py:Reviser.earned_pair_ban` 10%
      - `quality/revise.py:Reviser.modal_head_evidenced` 10%
    - `quality/revise.py:Reviser._band_findings` 4%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 3%
  - `quality/revise.py:Reviser.__init__` 11%
    - `quality/floor.py:SlopFloor.__init__` 11%
      - `quality/features.py:QualityFeatures.__init__` 6%
      - `quality/field_store.py:attach` 3%
  - `lyric_harness.py:end_pair_relations` 8%
    - `quality/relations.py:pair_satisfies_any` 4%
      - `quality/relations.py:pair_satisfies` 3%
    - `quality/relations.py:build_stream` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 14%
  - `lyric_harness.py:Lexicon.__init__` 22%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 11%
      - `lyric_harness.py:_derived_accent_entries` 8%

Most time spent inside the function itself: `lyric_harness.py:score` 11%, `lyric_harness.py:Lexicon.__init__` 6%, `lyric_harness.py:Lexicon._derive_cmu_readings` 3%, `lyric_harness.py:shared_ending` 3%, `lyric_harness.py:cluster_sim` 3%, `lyric_harness.py:channel_agreement` 3%


## lyric_plan

Runs `lyric_harness.py` `plan`.

389 named harness functions ran, in 33 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 96%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 66%
    - `lyric_harness.py:_derived_accent_entries` 57%
      - `lyric_harness.py:derive_accent_readings` 53%
- `quality/plan.py:make_plan` 22%
  - `quality/plan.py:_redraw_past_joint_gate` 22%
    - `quality/plan.py:_make_plan_candidate` 22%
      - `quality/plan.py:_assign_types` 22%
      - `quality/plan.py:eligible_types` 22%
      - `quality/plan.py:_bindable_at` 22%
      - `lyric_harness.py:_is_vowel` 11%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 15%, `lyric_harness.py:derive_accent_readings` 10%, `lyric_harness.py:Lexicon._derive_cmu_readings` 9%, `lyric_harness.py:_vowel_letters` 8%, `lyric_harness.py:_is_vowel` 7%, `lyric_harness.py:_base` 6%


## lyric_grade

Runs `lyric_harness.py` `--lexicon-supplement=v2`, `plan`.

1038 named harness functions ran, in 51 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 59%
  - `quality/schema_instance_evidence.py:for_grade` 31%
    - `quality/schema_instance_evidence.py:_for_grade` 31%
      - `quality/schema_instance_evidence.py:from_stream` 30%
      - `quality/relations.py:build_stream` 6%
      - `quality/plan.py:_bindable_at` 5%
      - `lyric_harness.py:_is_vowel` 4%
  - `quality/revise.py:Reviser.inspect` 23%
    - `quality/revise.py:Reviser.grade` 16%
      - `quality/relations.py:whole_vocabulary_pairs` 13%
    - `quality/revise.py:Reviser.earned_pair_ban` 8%
      - `quality/revise.py:Reviser.modal_head_evidenced` 8%
    - `quality/revise.py:Reviser._band_findings` 3%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 3%
  - `quality/revise.py:Reviser.brief` 22%
- `lyric_harness.py:Lexicon.__init__` 38%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 23%
    - `lyric_harness.py:_derived_accent_entries` 19%
      - `lyric_harness.py:derive_accent_readings` 18%
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

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 9%, `quality/relations.py:evaluate` 5%, `lyric_harness.py:derive_accent_readings` 4%, `lyric_harness.py:Lexicon._derive_cmu_readings` 3%, `lyric_harness.py:_vowel_letters` 3%, `quality/relations.py:_set_agree` 3%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `--lexicon-supplement=v2`.

1093 named harness functions ran, in 48 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 55%
  - `quality/loop.py:_VerdictCache.brief` 51%
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

- `quality/recover.py:recover_file` 58%
  - `quality/recover.py:recover` 57%
    - `quality/relations.py:whole_vocabulary_pairs` 43%
      - `quality/relations.py:line_pairs_for` 45%
    - `quality/relations.py:VocabularyPairResults.listed` 8%
      - `quality/relations.py:VocabularyPairResults.resolve_readings` 8%
    - `lyric_harness.py:_is_vowel` 7%
      - `lyric_harness.py:_base` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 42%
  - `lyric_harness.py:Lexicon.__init__` 53%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 36%
      - `lyric_harness.py:_derived_accent_entries` 33%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 11%, `lyric_harness.py:derive_accent_readings` 6%, `lyric_harness.py:_vowel_letters` 5%, `quality/relations.py:evaluate` 4%, `lyric_harness.py:_is_vowel` 4%, `lyric_harness.py:_base` 4%


## lyric_check

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

827 named harness functions ran, in 46 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 75%
  - `quality/schema_instance_evidence.py:for_grade` 37%
    - `quality/schema_instance_evidence.py:_for_grade` 37%
      - `quality/schema_instance_evidence.py:from_stream` 37%
  - `quality/revise.py:Reviser.inspect` 37%
    - `quality/revise.py:Reviser.grade` 13%
      - `quality/relations.py:whole_vocabulary_pairs` 11%
    - `quality/revise.py:Reviser.earned_pair_ban` 11%
      - `quality/revise.py:Reviser.modal_head_evidenced` 11%
    - `quality/floor.py:SlopFloor.check` 9%
      - `quality/features.py:QualityFeatures._predictability` 9%
    - `quality/revise.py:Reviser._band_findings` 4%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 3%
  - `quality/revise.py:Reviser.brief` 37%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 15%
  - `lyric_harness.py:Lexicon.__init__` 21%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 11%
      - `lyric_harness.py:_derived_accent_entries` 9%
- `quality/revise.py:Reviser.__init__` 14%
  - `quality/floor.py:SlopFloor.__init__` 14%
    - `quality/features.py:QualityFeatures.__init__` 7%
      - `quality/features.py:RhymeField.__init__` 5%
    - `quality/floor.py:_default_lexicon` 4%
    - `quality/field_store.py:attach` 3%
      - `quality/field_store.py:store_identity` 3%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 7%, `quality/relations.py:evaluate` 6%, `quality/relations.py:_set_agree` 3%, `lyric_harness.py:score` 3%, `quality/relations.py:ClassEqual.__call__` 2%, `quality/relations.py:_alts` 2%


## lyric_verify

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

740 named harness functions ran, in 41 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 58%
  - `quality/revise.py:Reviser.inspect` 58%
    - `quality/revise.py:Reviser.grade` 25%
      - `quality/relations.py:whole_vocabulary_pairs` 21%
    - `quality/revise.py:Reviser.earned_pair_ban` 19%
      - `quality/revise.py:Reviser.modal_head_evidenced` 19%
    - `quality/revise.py:Reviser._band_findings` 7%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 6%
    - `quality/floor.py:SlopFloor.check` 6%
      - `quality/features.py:QualityFeatures._predictability` 6%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 26%
  - `lyric_harness.py:Lexicon.__init__` 37%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 18%
      - `lyric_harness.py:_derived_accent_entries` 15%
- `quality/revise.py:Reviser.__init__` 22%
  - `quality/floor.py:SlopFloor.__init__` 22%
    - `quality/features.py:QualityFeatures.__init__` 11%
      - `quality/features.py:RhymeField.__init__` 8%
    - `quality/field_store.py:attach` 6%
      - `quality/field_store.py:store_identity` 6%
    - `quality/floor.py:_default_lexicon` 5%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 12%, `lyric_harness.py:Lexicon._derive_cmu_readings` 3%, `lyric_harness.py:derive_accent_readings` 3%, `lyric_harness.py:syllabify` 3%, `quality/frequency.py:_count_rows` 2%, `lyric_harness.py:split_phone` 2%


## lyric_types

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

484 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 59%
  - `lyric_harness.py:Lexicon.__init__` 91%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 50%
      - `lyric_harness.py:_derived_accent_entries` 45%
- `lyric_harness.py:end_pair_relations` 34%
  - `quality/relations.py:build_stream` 18%
    - `quality/phonology/eng.py:English.tokens_for_line` 18%
      - `quality/phonology/eng.py:English._aside_rule` 18%
  - `lyric_harness.py:_screen_not_applicable` 18%
    - `quality/relations.py:placement_bindable` 18%
      - `lyric_harness.py:_is_vowel` 9%
  - `quality/relations.py:pair_satisfies_any` 16%
    - `quality/relations.py:pair_satisfies` 16%
      - `quality/relations.py:evaluate` 16%
- `quality/rhyme_types.py:names_at` 3%
  - `quality/rhyme_types.py:_member_reading_combos` 3%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 24%, `lyric_harness.py:derive_accent_readings` 8%, `lyric_harness.py:_vowel_letters` 7%, `lyric_harness.py:_is_vowel` 6%, `lyric_harness.py:_base` 5%, `lyric_harness.py:Lexicon._derive_cmu_readings` 5%


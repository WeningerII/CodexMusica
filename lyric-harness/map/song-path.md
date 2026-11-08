# Song path

What runs when each lyric tool is called, from one profiled run of the reference song (`map/song.txt`, 16 lines) through the connector, every call in a fresh Python process, so start-up (loading the pronunciation dictionary and tables) shows up in each tool. The deployed connector keeps one warm process and pays it once. Regenerate: `node map/trace.mjs --profile && python3 map/build.py --from-profile`.

## lyric_sweep

Runs `lyric_harness.py` `plan`.

393 named harness functions ran, in 33 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 95%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 65%
    - `lyric_harness.py:_derived_accent_entries` 56%
      - `lyric_harness.py:derive_accent_readings` 53%
- `quality/plan.py:sweep` 24%
  - `quality/plan.py:_sweep_one` 24%
    - `quality/plan.py:make_plan` 24%
      - `quality/plan.py:_redraw_past_joint_gate` 24%
  - `quality/plan.py:_bindable_at` 23%
    - `quality/relations.py:placement_bindable` 23%
      - `quality/relations.py:build_stream` 22%
      - `lyric_harness.py:_is_vowel` 11%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 15%, `lyric_harness.py:derive_accent_readings` 10%, `lyric_harness.py:Lexicon._derive_cmu_readings` 9%, `lyric_harness.py:_vowel_letters` 8%, `lyric_harness.py:_is_vowel` 7%, `lyric_harness.py:_base` 6%


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
  - `lyric_harness.py:end_pair_relations` 8%
    - `quality/relations.py:pair_satisfies_any` 4%
      - `quality/relations.py:pair_satisfies` 3%
    - `quality/relations.py:build_stream` 4%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 14%
  - `lyric_harness.py:Lexicon.__init__` 21%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 11%
      - `lyric_harness.py:_derived_accent_entries` 8%

Most time spent inside the function itself: `lyric_harness.py:score` 11%, `lyric_harness.py:Lexicon.__init__` 6%, `lyric_harness.py:Lexicon._derive_cmu_readings` 3%, `lyric_harness.py:shared_ending` 3%, `lyric_harness.py:cluster_sim` 3%, `lyric_harness.py:channel_agreement` 3%


## lyric_plan

Runs `lyric_harness.py` `plan`.

389 named harness functions ran, in 33 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:Lexicon.__init__` 96%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 65%
    - `lyric_harness.py:_derived_accent_entries` 55%
      - `lyric_harness.py:derive_accent_readings` 52%
- `quality/plan.py:make_plan` 24%
  - `quality/plan.py:_redraw_past_joint_gate` 24%
    - `quality/plan.py:_make_plan_candidate` 24%
      - `quality/plan.py:_assign_types` 23%
      - `quality/plan.py:eligible_types` 23%
      - `quality/plan.py:_bindable_at` 23%
      - `lyric_harness.py:_is_vowel` 11%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 16%, `lyric_harness.py:derive_accent_readings` 10%, `lyric_harness.py:Lexicon._derive_cmu_readings` 9%, `lyric_harness.py:_vowel_letters` 8%, `lyric_harness.py:_is_vowel` 7%, `lyric_harness.py:_base` 6%


## lyric_grade

Runs `lyric_harness.py` `--lexicon-supplement=v2`, `plan`.

1038 named harness functions ran, in 51 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 57%
  - `quality/schema_instance_evidence.py:for_grade` 30%
    - `quality/schema_instance_evidence.py:_for_grade` 30%
      - `quality/schema_instance_evidence.py:from_stream` 29%
      - `quality/relations.py:build_stream` 6%
      - `quality/plan.py:_bindable_at` 5%
      - `lyric_harness.py:_is_vowel` 4%
  - `quality/revise.py:Reviser.inspect` 22%
    - `quality/revise.py:Reviser.grade` 16%
      - `quality/relations.py:whole_vocabulary_pairs` 13%
    - `quality/revise.py:Reviser.earned_pair_ban` 8%
      - `quality/revise.py:Reviser.modal_head_evidenced` 8%
  - `quality/revise.py:Reviser.brief` 21%
- `lyric_harness.py:Lexicon.__init__` 39%
  - `lyric_harness.py:Lexicon._derive_cmu_readings` 24%
    - `lyric_harness.py:_derived_accent_entries` 20%
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

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 9%, `quality/relations.py:evaluate` 5%, `lyric_harness.py:derive_accent_readings` 4%, `lyric_harness.py:Lexicon._derive_cmu_readings` 3%, `lyric_harness.py:_vowel_letters` 3%, `lyric_harness.py:_is_vowel` 3%


## lyric_revise

Runs `lyric_harness.py` `--integrity`, `--lexicon-supplement=v2`.

1093 named harness functions ran, in 48 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/loop.py:revise_loop` 55%
  - `quality/loop.py:_VerdictCache.brief` 50%
    - `quality/loop.py:_VerdictCache._gate` 55%
      - `quality/loop.py:Deadline.step` 55%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 26%
  - `lyric_harness.py:Lexicon.__init__` 39%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 19%
      - `lyric_harness.py:_derived_accent_entries` 15%
- `quality/revise.py:Reviser.__init__` 22%
  - `quality/floor.py:SlopFloor.__init__` 22%
    - `quality/features.py:QualityFeatures.__init__` 11%
      - `quality/features.py:RhymeField.__init__` 9%
    - `quality/field_store.py:attach` 6%
      - `quality/field_store.py:store_identity` 6%
    - `quality/floor.py:_default_lexicon` 5%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 12%, `lyric_harness.py:syllabify` 4%, `lyric_harness.py:Lexicon._derive_cmu_readings` 4%, `lyric_harness.py:split_phone` 3%, `lyric_harness.py:derive_accent_readings` 3%, `quality/frequency.py:_count_rows` 2%


## lyric_recover

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

552 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/recover.py:recover_file` 54%
  - `quality/recover.py:recover` 54%
    - `quality/relations.py:whole_vocabulary_pairs` 42%
      - `quality/relations.py:line_pairs_for` 43%
    - `lyric_harness.py:_is_vowel` 7%
      - `lyric_harness.py:_base` 4%
    - `quality/relations.py:VocabularyPairResults.listed` 6%
      - `quality/relations.py:VocabularyPairResults.resolve_readings` 6%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 46%
  - `lyric_harness.py:Lexicon.__init__` 57%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 38%
      - `lyric_harness.py:_derived_accent_entries` 35%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 11%, `lyric_harness.py:derive_accent_readings` 7%, `lyric_harness.py:_vowel_letters` 6%, `lyric_harness.py:_is_vowel` 5%, `quality/relations.py:evaluate` 4%, `lyric_harness.py:_base` 4%


## lyric_check

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

827 named harness functions ran, in 46 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `lyric_harness.py:main._print_brief_report` 76%
  - `quality/schema_instance_evidence.py:for_grade` 38%
    - `quality/schema_instance_evidence.py:_for_grade` 38%
      - `quality/schema_instance_evidence.py:from_stream` 38%
  - `quality/revise.py:Reviser.inspect` 37%
    - `quality/revise.py:Reviser.earned_pair_ban` 12%
      - `quality/revise.py:Reviser.modal_head_evidenced` 12%
    - `quality/revise.py:Reviser.grade` 12%
      - `quality/relations.py:whole_vocabulary_pairs` 10%
    - `quality/floor.py:SlopFloor.check` 9%
      - `quality/features.py:QualityFeatures._predictability` 9%
    - `quality/revise.py:Reviser._band_findings` 4%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 4%
  - `quality/revise.py:Reviser.brief` 37%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 15%
  - `lyric_harness.py:Lexicon.__init__` 21%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 10%
      - `lyric_harness.py:_derived_accent_entries` 8%
- `quality/revise.py:Reviser.__init__` 13%
  - `quality/floor.py:SlopFloor.__init__` 13%
    - `quality/features.py:QualityFeatures.__init__` 7%
      - `quality/features.py:RhymeField.__init__` 5%
    - `quality/floor.py:_default_lexicon` 3%
    - `quality/field_store.py:attach` 3%
      - `quality/field_store.py:store_identity` 3%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 7%, `quality/relations.py:evaluate` 5%, `quality/relations.py:_set_agree` 3%, `quality/relations.py:ClassEqual.__call__` 3%, `lyric_harness.py:score` 2%, `quality/relations.py:_alts` 2%


## lyric_verify

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

740 named harness functions ran, in 41 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/revise.py:Reviser.verify` 58%
  - `quality/revise.py:Reviser.inspect` 58%
    - `quality/revise.py:Reviser.grade` 25%
      - `quality/relations.py:whole_vocabulary_pairs` 21%
    - `quality/revise.py:Reviser.earned_pair_ban` 19%
      - `quality/revise.py:Reviser.modal_head_evidenced` 19%
    - `quality/floor.py:SlopFloor.check` 7%
      - `quality/features.py:QualityFeatures._predictability` 7%
    - `quality/revise.py:Reviser._band_findings` 7%
      - `quality/lexicon_supplement.py:supplemented_lexicon` 6%
- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 25%
  - `lyric_harness.py:Lexicon.__init__` 36%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 18%
      - `lyric_harness.py:_derived_accent_entries` 15%
- `quality/revise.py:Reviser.__init__` 23%
  - `quality/floor.py:SlopFloor.__init__` 23%
    - `quality/features.py:QualityFeatures.__init__` 12%
      - `quality/features.py:RhymeField.__init__` 9%
    - `quality/field_store.py:attach` 6%
      - `quality/field_store.py:store_identity` 6%
    - `quality/floor.py:_default_lexicon` 5%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 11%, `lyric_harness.py:syllabify` 3%, `lyric_harness.py:Lexicon._derive_cmu_readings` 3%, `lyric_harness.py:derive_accent_readings` 3%, `lyric_harness.py:split_phone` 3%, `quality/frequency.py:_count_rows` 2%


## lyric_types

Runs `lyric_harness.py` `--lexicon-supplement=v2`.

484 named harness functions ran, in 37 files. Tree: each function's share of this tool's time (time inside the calls it makes included; a function that calls itself can show more than its parent), 4 levels, under 3% left out, each function shown once.

- `quality/lexicon_supplement.py:SupplementedLexicon.__init__` 60%
  - `lyric_harness.py:Lexicon.__init__` 92%
    - `lyric_harness.py:Lexicon._derive_cmu_readings` 51%
      - `lyric_harness.py:_derived_accent_entries` 46%
- `lyric_harness.py:end_pair_relations` 35%
  - `quality/relations.py:build_stream` 19%
    - `quality/phonology/eng.py:English.tokens_for_line` 18%
      - `quality/phonology/eng.py:English._aside_rule` 18%
  - `lyric_harness.py:_screen_not_applicable` 19%
    - `quality/relations.py:placement_bindable` 19%
      - `lyric_harness.py:_is_vowel` 9%
  - `quality/relations.py:pair_satisfies_any` 15%
    - `quality/relations.py:pair_satisfies` 15%
      - `quality/relations.py:evaluate` 15%

Most time spent inside the function itself: `lyric_harness.py:Lexicon.__init__` 25%, `lyric_harness.py:derive_accent_readings` 9%, `lyric_harness.py:_vowel_letters` 7%, `lyric_harness.py:_is_vowel` 6%, `lyric_harness.py:_base` 5%, `lyric_harness.py:Lexicon._derive_cmu_readings` 5%


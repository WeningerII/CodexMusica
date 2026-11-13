# Rules

Every finding code the harness can emit (from `quality/gate_census.py`). **Stops a song** says what can refuse on it: a flag fails grading and holds the line open in revise; `MANDATORY_PURSUE` (`quality/loop.py`) holds a line open on a note; `LENGTH_GATE_CODES` (`quality/floor.py`) blocks exit 0. Codes marked nothing are reported and stop nothing.

Held open even as notes (`MANDATORY_PURSUE`): none (emptied 2026-10-04, owner ruling).

| code | severity | stops a song | emitted in |
|---|---|---|---|
| ANAPHORA_OVERLOAD | flag | severity flag | floor.py |
| BEAT_OUTSIDE_CYCLE | flag | severity flag | fit.py |
| CLICHE_PAIR | flag | severity flag | floor.py |
| FUNCTION_WORD_HEAVY | flag | severity flag | floor.py |
| HOOK_ABSENT | flag | severity flag | grid.py |
| HOOK_DOES_NOT_RECUR | flag | severity flag | grid.py |
| LEXICAL_MONOTONY | flag | severity flag | floor.py |
| MATTR_WINDOW_UNCALIBRATED | note | LENGTH_GATE_CODES | floor.py |
| OUT_OF_CALIBRATED_LENGTH | note | LENGTH_GATE_CODES | floor.py |
| OVERRUNS_SECTION | flag | severity flag | fit.py |
| REPEAT_IN_VERSE | flag | severity flag | floor.py |
| RETURN_NOT_VERBATIM | flag | severity flag | revise.py |
| SCHEME_VIOLATION | flag | severity flag | revise.py |
| SLOTS_EXCEEDED | flag | severity flag | fit.py |
| STACKED_DRAFT | flag | severity flag | sentencehood.py |
| START_BEFORE_SECTION | flag | severity flag | fit.py |
| START_OFF_GRID | flag | severity flag | fit.py |
| TITLE_NOT_IN_HOOK | flag | severity flag | grid.py |
| ZERO_DURATION | flag | severity flag | fit.py |
| ANACRUSIS | note | — | fit.py |
| ANAPHORA_DECLARED | note | — | floor.py |
| BRIDGE_IS_A_VERSE | note | — | grid.py |
| CODA_REPEATS_EARLIER_LINES | note | — | grid.py |
| COLLISION_CUT_IS_SCALAR_ONLY | note | — | revise.py |
| CONTRAST_ABSENT | note | — | grid.py |
| CROSS_FUNCTION_REPRISE | note | — | grid.py |
| CROWDED | note | — | fit.py |
| DOWNBEAT_LOCKED | note | — | grid.py |
| ELABORATION_UNGROUNDED | note | — | grid.py |
| EVEN_DIVISION_LANDINGS | note | — | fit.py |
| EXTRAPOLATED_LENGTH | note | — | floor.py |
| FLOOR_LOCUS_SCOPE | note | — | revise.py |
| GROUPS_DECLARED_RETURN | note | — | revise.py |
| HEADS_EXCEED_UNITS | note | — | fit.py |
| HOMEOTELEUTON | note | — | revise.py |
| HOOK_CONFINED | note | — | grid.py |
| LATE_ENTRY | note | — | fit.py |
| LEXICAL_REPETITION_DECLARED | note | — | floor.py |
| MANDATE_EXCUSED_BY_OVERLAP | note | — | revise.py |
| MANDATE_GROUPS_INDISTINGUISHABLE | note | — | revise.py |
| MANDATE_NOT_INDEPENDENT | note | — | revise.py |
| MANDATE_SCOPE_DECLARED | note | — | revise.py |
| METER_LOCKED | note | — | grid.py |
| MODAL_RHYME | note | — | revise.py |
| OVERLAPPING_SPANS | note | — | fit.py |
| PATTER_NOT_DENSER | note | — | grid.py |
| PHRASE_LENGTH_LOCKED | note | — | grid.py |
| PREDICTABLE_RHYME | note | — | floor.py |
| PROMINENCE_CANNOT_ALIGN | note | — | fit.py |
| PROMINENCE_EXCEEDS_HEADS | note | — | fit.py |
| PROMINENCE_OFF_HEAD | note | — | fit.py |
| QUATRAIN_LOCK | note | — | grid.py |
| RADIF_LICENSED | note | — | floor.py |
| REFRAIN_REPEAT | note | — | revise.py |
| REPRISE_BRINGS_NOTHING_BACK | note | — | grid.py |
| RETURNS_WITH_NEW_WORDS | note | — | grid.py |
| RETURNS_WITH_SAME_WORDS | note | — | grid.py |
| RETURN_LENGTH_DRIFT | note | — | grid.py |
| RETURN_LOCKED | note | — | grid.py |
| RETURN_METER_DRIFT | note | — | grid.py |
| RETURN_NEVER_RETURNS | note | — | grid.py |
| RETURN_OUT_OF_RANGE | note | — | revise.py |
| RETURN_SCHEME_DRIFT | note | — | grid.py |
| RETURN_SLOT_DRIFT | note | — | grid.py |
| SCHEME_UNREADABLE | note | — | revise.py |
| SECTION_AT_EDGE | note | — | grid.py |
| SECTION_LENGTH_LOCKED | note | — | grid.py |
| SECTION_NOT_ADJACENT | note | — | grid.py |
| SECTION_NOT_AT_BOUNDARY | note | — | grid.py |
| SECTION_REQUIREMENT_ABSENT | note | — | grid.py |
| SHARED_SUFFIX | note | — | floor.py |
| SINGLE_USE_RECURRED | note | — | grid.py |
| SPARSE | note | — | fit.py |
| STACKED_LINE | note | — | sentencehood.py |
| STRUCTURE_UNCALIBRATED | note | — | revise.py |
| TAG_NOT_SHORT | note | — | grid.py |
| TUPLET_REQUIRED | note | — | fit.py |
| UNCOVERED_BARS | note | — | fit.py |
| UNIFORM_ANACRUSIS | note | — | grid.py |
| UNIFORM_LINE_LENGTH | note | — | floor.py |

Function reading refusals: `END_WORD_UNREADABLE` blocks requested function coverage, not a quality flag. Concrete failures carry `function:END_WORD_UNREADABLE:LN` plus the failed word, sung-token position (null when unmapped) and exact lyric text. Diagnostic coordinates do not change the stable line obligation or whole-refusal identity. `function:draft` retains the aggregate refusal. A comparison without a draft coordinate remains explicitly unlocated; its section-local line is not a draft line number. Mixed failures retain known line obligations plus a separate `location_scope: section_local` record for unlocated words. Occurrence declarations bind exact text and sung-token position only when the original function endpoint maps to that complete physical token. They do not change endpoint selection, add dictionary readings or change the perfect-rime policy.

## Section types

What declaring each of the 22 section types gets checked (from `function_capabilities` in `quality/function_disclosure.py`). **Placement**: `checked` means the type has a rule about where it sits, and a draft that breaks it gets a note; `no claim` means it may sit anywhere; `refused` means the registry records why no rule is made. **Returns as**: `verbatim` types are planned as exact repeats when the form asks for a return, and a grade notes one that comes back with different words; `new words` types get a note when they come back unchanged. **Contrast measured**: the sections this one is measured against whenever a song declares both. **Not verified from text**: what the name promises about the performance, which words on a bar grid cannot show; a grade says so as an `EFFECT_NOT_VERIFIED` row with status `not_requested`, counted as neither answered nor refused. Every type is a section: the planner draws all of them.

| type | placement | recurrence | returns as | contrast measured | not verified from text |
|---|---|---|---|---|---|
| intro | checked | once | n/a | — | — |
| verse | no claim | returns | new words | — | — |
| prechorus | checked | returns | varied | verse, chorus | — |
| chorus | no claim | returns | verbatim | verse | — |
| postchorus | checked | returns | verbatim | chorus | — |
| refrain | no claim | returns | verbatim | — | — |
| burden | checked | returns | verbatim | — | — |
| bridge | no claim | once | n/a | verse, chorus | — |
| breakdown | no claim | open | varied | — | whether the arrangement thins |
| build | no claim | open | varied | — | whether tension rises |
| drop | refused | returns | varied | — | whether it lands as an arrival |
| vamp | no claim | open | varied | — | whether a musical figure repeats under it |
| patter | no claim | returns | new words | chorus | — |
| turnaround | checked | returns | verbatim | — | — |
| interlude | checked | open | n/a | — | — |
| solo | no claim | open | n/a | — | — |
| tag | refused | returns | verbatim | — | — |
| hook | no claim | returns | verbatim | — | — |
| coda | checked | once | n/a | — | — |
| outro | checked | once | n/a | — | — |
| false_ending | checked | once | n/a | — | — |
| reprise | checked | once | varied | — | — |

# Recorder diff fce4bf0f -> 67889851, explained by cause

Made by a five-analyst workflow with a skeptic stage (each cause judged unexpected or unknown was re-derived independently), then merged. `partitions.json` is every analyst's partition with examples, code paths and evidence. Diff: `diff_67889851_summary.json` (`--mechanisms=dash,M1`). Candidate 67889851144dd2a7eefedd9960a868978fb7bfae, base fce4bf0f.

# Commit 1 acceptance: merged cluster report

All five cluster partitions add up exactly to their totals. After the skeptic's correction, no cause is judged 'unexpected' or 'unknown'. Each cluster total counts lines in that cluster's classes, and one line can sit in several clusters, so the five totals must not be added together.

## 1. Partition table

| Cluster | Total | Cause | Count | Final judgement |
|---|---:|---|---:|---|
| **Declared probe** (unresolved before, after or both) | 27,713 | A. A token that a declared reading covers no longer reports unread pieces. Nothing else on the line changed. | 25,946 | intended |
| | | B. Same fix, on lines where the dash cut also changed the tokens (the cut is incidental) | 1,493 | intended |
| | | C. Same fix, on lines where M1 numerals or dash re-cuts also moved the unread words (incidental) | 143 | intended |
| | | D. M1 and the fix together: a line with no tokens gets a line number or date as its only token, and the declaration then covers it | 2 | intended |
| | | Still unresolved: no end word (a whole-line aside, or a rule of hyphens) | 122 | pre-existing-or-tooling |
| | | Still unresolved: the end word is Greek | 6 | pre-existing-or-tooling |
| | | Newly unresolved: Durfey `Sh----` becomes `Sh`, and the probe's dictionary reading has no vowel, so it is rejected | 1 | pre-existing-or-tooling |
| | | *Sum: 25,946 + 1,493 + 143 + 2 + 122 + 6 + 1 = 27,713* | | |
| **Final field** (unexplained_fields lines) | 4,045 | C1. Trailing `--` dropped from the end word | 3,946 | intended |
| | | C2. Same, on a hyphen-compound end word: stress now matches the plain compound. diff.py mislabels these item6. | 4 | intended |
| | | C3. Leading `--` dropped from the end word | 64 | intended |
| | | C4. Longer trailing dash runs (`---`, `----`) dropped, including censored names | 13 | intended |
| | | C5. Greek-only lines: the stream now refuses the printed end word | 17 | intended |
| | | C6. meter_refused holds the same set in a different order | 1 | pre-existing-or-tooling |
| | | *Sum: 3,946 + 4 + 64 + 13 + 17 + 1 = 4,045* | | |
| **Meter** (lines in the gained, lost and stress classes) | 16,345 | 1. Same refusal; the label now keeps its edge apostrophe (`thro` becomes `thro'`) | 9,846 | intended |
| | | 2. Same refusal; the label's typographic apostrophe is now folded | 3,681 | intended |
| | | 3. Causes 1 and 2 on the same line | 147 | intended |
| | | 4. Same refusal; the label now keeps a single edge hyphen | 16 | intended |
| | | 5. A repeated word is hidden by diff.py comparing sets | 3 | pre-existing-or-tooling |
| | | 6. The dash cut narrows the refusal to the offending word | 607 | intended |
| | | 7. The meter now reads a spaced enclitic joined to its word (`I 'll` as `I'll`) | 641 | intended |
| | | 8. Causes 6 and 7 on the same line | 2 | intended |
| | | 9. Stress: the dash cut leaves function words as their own tokens, so they get weak-word demotion | 1,376 | intended |
| | | 10. Stress: a trailing numeral token takes the phrase-final position | 14 | intended (side effect not documented) |
| | | 11. Stress: an ordinal such as `4th` is one numeral token | 7 | intended |
| | | 12. Stress: causes 9 and 10 on the same line | 5 | intended |
| | | *Sum: 9,846 + 3,681 + 147 + 16 + 3 + 607 + 641 + 2 + 1,376 + 14 + 7 + 5 = 16,345* | | |
| **Stream and grid** (lines in their classes) | 15,675 | C1. The stream reads the words a dash cut splits off | 7,375 | intended |
| | | C2. Same; diff.py mislabels it M2b | 128 | intended |
| | | C3. Same; diff.py mislabels it item6 | 6 | intended |
| | | C4. An M1 numeral token is refused in the stream | 622 | intended |
| | | C5. A Greek end word is appended as the printed endpoint and recorded unread | 18 | intended |
| | | C6. A grid end word with an attached dash is now keyed | 3,950 | intended |
| | | C7. A grid end word that was a bare `--` is now the real word, keyed | 2,686 | intended |
| | | C8. Bare `--` end: the grid now keys a word inside a final aside | 24 | intended |
| | | C9. A grid end word that was a stray apostrophe is now the real word, keyed | 392 | intended (not announced) |
| | | C10. Attached dash dropped; the grid key is still None | 270 | intended |
| | | C11. Bare `--` replaced by the real word; key still None | 154 | intended |
| | | C12. A bare `--` hid a bracketed numeral | 1 | intended |
| | | C13. Stray apostrophe replaced by the real word; key still None | 49 | intended |
| | | *Sum: 7,375 + 128 + 6 + 622 + 18 + 3,950 + 2,686 + 24 + 392 + 270 + 154 + 1 + 49 = 15,675* | | |
| **Small classes** (lines in their classes, fixtures included) | 321 | M1 observed but not projected: cause no_endpoint → numeral | 2 | intended |
| | | M1 observed but not projected: cause token → numeral | 16 | intended |
| | | Dash projected but not observed: the token has only a single edge hyphen, which v2 keeps | 27 | pre-existing-or-tooling |
| | | Dash projected but not observed: a real cut that the classifier calls tokens_other | 2 | pre-existing-or-tooling |
| | | reading_switched: a trailing numeral demotes the last sung word | 16 | **intended** (skeptic overturned 'unexpected') |
| | | reading_switched: the dash cut lets the whole compound read, with secondary stress | 5 | intended |
| | | voices_changed: M1 | 80 | intended |
| | | voices_changed: dash cut | 37 | intended |
| | | word_removed: digits absorb a letter tail (`4th`) | 7 | intended |
| | | word_removed: an OCR digit (`1'emmeneront`) | 1 | intended |
| | | word_refusal_respelled: diff.py gives a same-spelled refusal to every matching word | 13 | pre-existing-or-tooling |
| | | tokens_other: an M1 run the classifier cannot express | 8 | intended |
| | | tokens_other: diff.py strips single edge hyphens that v2 keeps | 2 | pre-existing-or-tooling |
| | | tokens_numeral_and_dash | 36 | intended |
| | | cause_changed: a numeral end word on a line already refused | 21 | intended |
| | | cause_changed: dash cut on the end token (cause piece → token) | 13 | intended |
| | | Fixtures: only `extra` changed (the new numeral_tokens key) | 12 | pre-existing-or-tooling |
| | | Fixtures: the declared-token fix | 1 | intended |
| | | Fixtures: normalisation (NFC, the U+2010/U+2011 fold, ignoring U+00AD, the enclitic join) | 11 | intended |
| | | Fixtures: M1 | 7 | intended |
| | | Fixtures: dash cut | 4 | intended |
| | | *Sum: 2 + 16 + 27 + 2 + 16 + 5 + 80 + 37 + 7 + 1 + 13 + 8 + 2 + 36 + 21 + 13 + 12 + 1 + 11 + 7 + 4 = 321* | | |

## 2. Causes judged 'unexpected' or 'unknown'

None remain.

The only cause an analyst judged 'unexpected' was small classes / reading_switched, 16 lines. The skeptic changed it to **intended**. A printed margin or footnote number became the line's last token, so the last sung word lost its phrase-final stress. This follows from the announced numeral rule (M1) passing through an existing stress rule. All 16 ends are refused anyway, but no doc mentions it.

- Strongest example: `eng_british_percy_bysshe_shelley.txt#5:23` 'Ah me!  _205'. `me` goes from M IY1 to M IY0, and meter_stress goes from '//' to '/.'.
- Correction to the count: meter_stress changes on 14 lines, and those 14 are a subset of the 16 lines whose phones change. They are not the same set. The other 2 lines are `to-night` and `to-morrow`, where phones change but meter_stress does not.

### Intended, but worth naming in the acceptance post

- **The scope list `dash,M1` under-describes commit 1.** Commit 1 also does all of the following on purpose:
  - NFC, folding of the eight apostrophes, the U+2010/U+2011 fold and ignoring U+00AD (382c36438);
  - the spaced-enclitic join that ignores U+00AD, and the grid's end word taken from the reader (fe8044643);
  - fit.read_line reading the reader's tokens;
  - the declared-token fix (dd031e506).

  It implements none of item6, M2a or M2b. Every item6- or M2-shaped label in these clusters is diff.py labelling by surface shape.
- **The interior half of the declared-token fix has no test.** About 24,200 of the 27,584 newly resolved lines depend on it, and test_reader.py only covers the end token.
- **The grid's stray-apostrophe fix is unannounced** (C9 392 + C13 49 = 441 lines). Example: `eng_american_byron_forceythe_willson.txt#2:77` 'to the stair!’', where grid goes from ["'", null] to ["stair", "EH R"]. No commit message or doc names it, and R2 should list it.
- **An orphan `'s` now enters the anchors** (final-field FLAG 1, 6 lines). Example: `f_j_child#0:32` changes from 'Y/UW1/ Z/AH0/N.D' to '/EH1/ S/AH0/N.D'. The cause, reading the prefix by position, is intended and tested. diff.py gives anchors_changed no attribution, so these 6 lines appear in neither unattributed_changes nor out_of_scope_changes.
- **The grid and the anchor path still disagree on final asides** (C8). This disagreement predates the change.
- **M1 keeps a leading apostrophe inside a numeral token** (`'62`).
- **diff.py gaps** that inflate unattributed_changes and out_of_scope_changes:
  - a final changed only by a dash is not credited;
  - `_words` cannot see the appended endpoint boundary;
  - meter_refused is compared as sets for classes but as ordered lists for the leftover-change check;
  - refusal labels are compared by exact spelling;
  - a same-spelled refusal is given to every matching word (diff.py:101);
  - single edge hyphens are stripped (diff.py:92), and the projection pattern is broader than the dash rule (diff.py:215).

## 3. Sums and cross-cluster consistency

**Sums.** All five partitions sum exactly (arithmetic in the table).

**Figures that agree across clusters:**
- The small-classes split of unattributed_changes (11,867) matches the other clusters:
  - 3,846 + 198 + 1 = 4,045 unexplained lines, the final-field total;
  - 7,389 + 198 + 14 = 7,601 meter:other lines, as in the meter cluster;
  - 396 + 14 = 410 grid:other lines, as in stream and grid.
- The 17 unexplained stream_unread lines are final-field C5, and 17 of the 18 lines in stream-grid C5.
- end_newly_refused is 503 in both final-field and stream-grid.
- Meter cause 10 (14 lines) sits inside the small-classes 16, consistent with the skeptic's correction.
- The dash compounds are 4 in final-field C2 and 5 in small-classes. This is not a conflict: the 5th, `boker#13:15` `--Fifty-fifth`, is an interior word. I checked that its final is 'Illinois' on both sides, so it does not belong in a final-field cause.

**Minor slips (counts still correct):**
- Meter cause 9's line split, 1,213 + 153 + 15 = 1,381, is 5 more than its count of 1,376. The split includes cause 12's 5 lines. breakdown-meter/partition.json confirms 1,376.
- Stream-grid's "19 non-NFC cluster lines" counts 19 class memberships on 18 distinct lines, because `herrick#469:0` is in both C4 and C5. I recounted 18 non-NFC corpus lines plus fixtures 5 and 6, which matches the meter cluster's 18.
- The small-classes analyst called the 16 and the 14 "the same ids". The skeptic corrected this to a subset.

**Not reconciled:**
- The small-classes leads say 6,762 of 7,601 meter:other lines and 4,949 of 5,020 meter:M2b lines are pure respellings. The analyst marked these as not re-verified, and they use a different test. They do not match the meter cluster's own split of meter:M2b (4,911 + 74 + 1 respellings, 3 set collapse, 54 enclitic, 18 dash). The meter partition governs.
- out_of_scope_changes includes 66 meter:item6 lines. They must sit inside the meter causes, but the meter analysis does not say which.

The merge checks were run in a scratch directory, outside the repository; no tracked file was modified.
# Acceptance receipt for the reader batch, 2026-10-13

John approved building the reader batch on 2026-10-13 ("yes, go ahead and build it", relayed verbatim by R2 on PR #527, comment 6136624835). R2 builds the code, BB8 builds these independent acceptance tools, and 3PO reviews contracts and wording. Merging and deploying come back to John.

The scope receipt (`../scope_2026-10-12/shape_sweep.json`) **projects** which dev lines the batch would touch. These tools **measure** what each built head does to the same lines, word by word, and set the two against each other.

**What kind of evidence this is.** It covers tokenization, readability, phones and anchors for each reader listed below. It is not relation or meter certification, and it is not legacy replay. The batch's mechanism tests and 3PO's contract review cover those: M2b under an explicit `fallback: high`, declared versus internally pinned choices, connector blocking lines, `lyric_types`, and replay.

## The recorder

    python3 quality/results/acceptance_2026-10-13/record.py OUT.jsonl.gz [HARNESS_ROOT] [--fallback=high]

The recorder reads every dev line of the coverage split, plus a fixed list of fixture lines, at one head, and writes one JSON line per line id (`path#item:line`, `fixture:N`). It uses the census's English reader, `build_lexicon("v2", FALLBACK)`, with no declared pronunciations.

The header pins every coordinate that could move a reading without a code change:
- the commit, and whether it had tracked changes;
- the recorder's own sha256;
- the reader class, the supplement's version, path and sha256, and the CMUdict sha256;
- the fallback, `strip_parens` and the declarations;
- the split file and its sha256, a digest of the population files, and the fixture digest;
- `comparator_fingerprint_parts()`.

Per line it records what each reader returns, in that head's own token coordinate:
- **The anchor path:** `line_tokens`, `raw_final_token`, `line_readability` (end refused or not, cause, unread lists, reason) and every `line_anchors` candidate.
- **Phones:** `transcribe` for the whole line, and for each token on its own. The diff aligns on the per-token phones.
- **The schema judge's reader:** `relations.build_stream` through `revise.relation_phonology_for`, giving its unread tokens.
- **The grid end reader:** `grid.rime_cmudict(lex).end_occurrence`, giving the word and its key.
- **Meter:** the `word_syllable_map` stress string, and `fit.read_line` refusals on lines with a digit, apostrophe or hyphen.
- **A declared-reading probe:** every refused token on such a line is declared through `pronunciation.pin_readings`, and the line is read again.
- **The voices reading** (`strip_parens` off), for lines with `(`.

A line that raises is recorded with its error. The 29 fixtures cover shapes the dev corpus doesn't contain: U+2010 and U+2011 hyphens, a soft hyphen, NFD accents, digits, apostrophes and `--`. A recording takes about 8 minutes and is about 28 MB, so recordings aren't committed. Rerun the recorder at the named head to reproduce one.

To measure another head, check it out in a worktree, copy the pinned `cmudict.dict` into its `lyric-harness/`, set `LYRIC_STAGED_DATA` to the staged data directory, and pass that `lyric-harness/` as `HARNESS_ROOT`. M3 is invisible with no fallback, so it needs a before/after pair recorded with `--fallback=high`.

## The diff

    python3 quality/results/acceptance_2026-10-13/diff.py BEFORE.jsonl.gz AFTER.jsonl.gz quality/results/acceptance_2026-10-13/diff_null.json --summary

The diff refuses to compare recordings of different populations, and it reports every other change in configuration.

**Word-level comparison.** Each side's tokens are cut by the dash rule into words.
- Each OOV entry of a token is assigned to one of that token's words. So a refusal reported as a piece on one side and as the whole word on the other counts as the same refusal.
- The two word lists are aligned with difflib.
- A word that changes status is attributed to a mechanism by its shape:
  - a digit means M1;
  - a true hyphen means item 6;
  - an edge apostrophe means M2b for a refusal, or M2a for a reading switch;
  - a word that came from a `--` or edge-hyphen token means `dash`;
  - anything else is `other`, the change nobody predicted.
- A line whose end flips from read to refused is credited by the shape of its end word.

**Scope.** `--mechanisms` names what the after-head implements. A change attributed to a mechanism outside that list is reported separately, never credited to the projection.

**Classes reported:**
- the anchor path: end refused or read, end word, cause, reason and anchors;
- word refusals newly made, newly cleared, added or removed;
- per-token reading switches;
- the stream reader's refusals;
- the grid key;
- meter stress and meter refusals;
- the declared probe: lines whose declarations newly fail or newly succeed to clear the report;
- the voices reading;
- token-coordinate agreement;
- and `unclassified`, for any other recorded difference.

Each mechanism gets projected and observed counts, with projected-not-observed and observed-not-projected ids. Without `--summary` the output carries every id, plus before/after detail for up to 25 lines per class.

## The website tokenizer

    node quality/results/acceptance_2026-10-13/js_parity.mjs RECORDING.jsonl.gz REPO_ROOT quality/results/acceptance_2026-10-13/js_parity_fce4bf0f.json

This runs the Lyrics page's own `lyTokens`, taken from `src/pages/lyrics.js` at the measured tree, over every recorded line, and lists the lines where it cuts differently from `line_tokens`. At `fce4bf0f`, **1,604 of 227,540** dev lines differ, for example spaced enclitics and backtick apostrophes. The batch's JS mirror commit should bring that to 0 or explain what remains.

## Validation of the tools

**Null test (`diff_null.json`).** This compares main at `fce4bf0f` with `d6e63623` on this branch, which has the same harness code. Its header says `tracked_changes: true` only because this receipt's own output files were being regenerated in that tree. Every class is 0 and nothing is unattributed.

There is one standing measure, the same on both sides: **27,712** dev lines of *synthetic-declaration probe exposure*. On these lines the recorder's own probe declares every refused token, and `line_readability` still reports unread words or stale reason text. They are not user declarations and not confirmed production incidents. That is a defect in today's code, not in these tools. `line_readability` reads `token_pieces(lex, t)` on the line view and never `lex.for_token(i)` (`lyric_harness.py:2428, 2433`). A writer's declared reading therefore clears `transcribe` but not the readability report. The batch's refusal-wording commit should take it to 0.

**Positive control (`positive_control_item6.patch`, `positive_control_item6.json`).** A deliberately simple simulation of item 6's strict rule, from the independent review, was applied to a copy of `fce4bf0f`, recorded and diffed with `--mechanisms=item6`:
- The projection's **10,825** item-6 lines were all observed, with **0** projected-not-observed, **0** observed-not-projected and **0** unattributed.
- **3,111** ends were newly refused, the projected figure.
- Words newly refused: **8,115** interior and **2,963** at the line end, matching the projection's join-only and pieces classes.

**Independent review.** Before any R2 head was measured, 22 agents reviewed the first version of these tools from four angles: blind spots, diff logic, a positive control and the row list. A skeptic tried to refute each finding. All 18 medium and high findings reproduced, and this version addresses them:
- position-level comparison;
- end-attribution through the dash rule;
- per-mechanism scope;
- no silently unclassified change;
- the schema-judge, grid, meter, anchor, declared-probe, voices and JS readers;
- pinned configuration;
- fixtures;
- the row-list corrections below.

The same review found that the scope README's statement that no v2 form occurs on dev was wrong. That README now says so.

## The disputed dictionary rows

    python3 quality/results/acceptance_2026-10-13/disputed_rows.py quality/results/acceptance_2026-10-13/disputed_rows.json MPRON

This lists every CMUdict row with an edge apostrophe whose first reading is not today's first reading for that token. M2a (exact entry first) would switch these. The script refuses to run without the pinned Moby file (sha256 `55580c3b…`), whose readings are given as reference only.

Each row is classed by one criterion, under the normalization `bb8`: stress is kept until the unstressed AH0, IH0 and ER0 are merged, and the remaining stress digits are then dropped. Every row carries three verdicts: strict, `bb8` and broad.
- **disputed:** no shared reading under `bb8`;
- **equivalent:** a shared reading under `bb8`, but not as written;
- **reorder:** a shared reading as written, so only the first choice moves.

| shape | kind | rows | rows seen on dev | dev occurrences |
|---|---|---:|---:|---:|
| `s'` | disputed | 56 | 4 | 38 |
| `s'` | equivalent | 36 | 0 | 0 |
| `s'` | reorder | 46 | 4 | 20 |
| `in'` | equivalent | 4 | 4 | 16 |
| `in'` | reorder | 1 | 1 | 1 |
| other | disputed | 9 | 7 | 183 |

**For John's data decision: the 56 disputed `s'` rows.** Four of them are seen on dev: `fathers'` (33), `mothers'` (3), `husbands'` (1) and `months'` (1). Moby's singular agrees with today's reading in each case. Under the broad normalization 48 rows remain disputed; R2's 52 isn't reproduced by any normalization tried here.

**The "other" rows are what M2a exists to fix.** They include `'em` (150 on dev), `'n` and `'m`, which read today as letter names, and `ol'`, which is unread today. `'cause` (19), `'gain` and `'frisco` switch to a different variant. The JSON lists each dev-seen row whose first reading changes more than a reduced vowel. `congress'` and `hours'` change their syllable count; `gettin'` and `hangin'` change a stressed vowel or a consonant.

**Not observed by these tools.** Per-member schema readers carrying writer declarations (only the probe above exercises declarations), connector `blocking` lines, `lyric_types` output, legacy replay, the Library's analysis path (`library/analysis.py` builds a plain `Lexicon`), and the browser's `lyWordSpans`. Each of these is covered by the batch's own tests or 3PO's review, or not yet at all.

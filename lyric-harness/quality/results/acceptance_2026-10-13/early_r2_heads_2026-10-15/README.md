# Early checks on R2's three pushed fix heads (2026-10-15, 17:00–17:35 UTC)

These are **early** results. R2 had pushed the heads but hadn't yet posted them for review. If a head moves, its result here doesn't carry over. All runs were local: CPython 3.11 (`venv311`), node v22, and `LYRIC_STAGED_DATA=<repo>/lyric-harness/data`. The gitignored `concreteness.txt` and `nltk/` are not in a fresh worktree, so without that variable every case refuses with "1 staged resource missing".

| Head | Check | Result |
|---|---|---|
| H1 `b5a274ad` (`claude/h1-pin-readings-2026-10-15`) | `probes/h1_pin_guard/h1_probe.py` | **PASS, 14/14.** The 5 dash cases and the plain control are JUDGED under both `none` and `v2`. The ambiguity control "I 2 love you love" still REFUSES and asks for the numbering. The control run at `b887e5ef` reproduces the baseline: the 5 dash cases are UNJUDGED (`SCHEME_UNREADABLE`) under `v2`. |
| P-A `d1961461` (`claude/pa-voices-2026-10-15`) | `probes/pa_voices/run.sh` | **PASS.** 162 cases: 0 WRONG_WORD, 0 DROPPED, 0 GUESSED; 93 SAME_WORD, 69 REFUSED. |
| P-A `d1961461` | `scripts/check_lyrics_page.js` | PASS, 668 assertions. |
| P-A `d1961461` | `node scripts/build_html.js` | **not checked.** The plain command writes to `/mnt/user-data/outputs/`, not `./codex.html`, so this row's original claim (unchanged, `e1c6bbec…`) tested nothing. Withdrawn. |
| #561 `ef643e0c` (`claude/561-atomic-return-2026-10-15`) | `quality/test_loop.py` | all loop regressions pass (627 s). Against `d85d2f26` the delta is only the doc and that test. |
| #561 `ef643e0c` | red control: the new test function run against `b887e5ef`'s `loop.py` | **FAIL at `b887`, PASS at `ef643e0c`.** The test isn't vacuous, because it requires at least one atomic attempt. |

**One P-A behaviour to note (not a defect):** a row that the live build already migrated (`cut v2`, no numbering mark) now **refuses** in 33 of its 54 cases, including some where voices never changed (for example `holdon.on.groups.b887-stored.sung->sung`). This is preserve-or-refuse working as designed. It's also what users with such saved rows will see after deploy, and the GUESSED-policy decision covers it.

**Not checked here:**
- the H1 head's page suite and full Python suites;
- slot, guard and A.2 (H1 changes `quality/pronunciation.py`, not `loop.py` or the reader, so I skipped these);
- CI;
- any combined tree.

## P-A head update: `26a2c76f` (PR #566), 17:28 UTC

This head supersedes `d1961461` and adds two commits, the Choose-again and occurrence-offer fixes.

| Check | Result |
|---|---|
| `probes/pa_voices/run.sh` | **PASS.** Identical to `d1961461`: 162 cases, 0 WRONG_WORD, 0 DROPPED, 0 GUESSED; 93 SAME_WORD, 69 REFUSED (`pa_26a2c76f.*`). |
| `scripts/check_lyrics_page.js` | PASS, **699** assertions (668 at `d1961461`). |
| `node scripts/build_html.js --out=<tmp>` | the fresh build equals the committed `codex.html` (`93675a22…`). This was rechecked with `--out` at 17:58; the first claim used the plain command, which doesn't write `./codex.html`. H1 `b5a274ad` also equals a fresh build (`9b763090…`). |
| Red control: the `26a2c76f` page checks against `d1961461`'s page (rebuilt, `cmudict.dict` staged) | **6 failures, all real:** 4 in "V. voices basis" (Choose again doesn't settle exactly its row; the card offers occurrences that aren't the saved word) and 2 in "9b2. choose again on an undecided reading" (`pa_page_red_control_d19614615.txt`). A first try without `cmudict.dict` staged added 7 harness-read failures that came from the environment; that run isn't counted. |

The page checks run against fixture replies in emulation. No real device was used, and nothing reached `/chat`.

## Build-check correction (17:58 UTC)

Plain `node scripts/build_html.js` builds into `/mnt/user-data/outputs/` and leaves `./codex.html` alone, as its own output says. Rechecked with `--out=<tmp>`:
- P-A `26a2c76f`: **equal** to the committed page.
- H1 `b5a274ad`: **equal**.
- Tools `b51438c8` (#567): **not equal**. The committed page is `9683457f…`, #562's; a fresh build gives `e406f311…`.

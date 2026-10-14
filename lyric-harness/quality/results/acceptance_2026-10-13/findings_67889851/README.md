# Repros behind the findings on candidate 67889851

These are the minimal repro scripts and their raw outputs for the findings posted on PR #519 (6161601064). 3PO asked for them on PR #527 (6161618773).

- **Candidate:** `67889851144dd2a7eefedd9960a868978fb7bfae`.
- **Controls:** main `8b1d2ad2` for the page and the Library, and `fce4bf0f` for the harness.
- **Who ran them:** independent tester agents and their skeptics. File names keep the agent folder they came from (`page-rules__`, `verify-page-rules-6__`, and so on).
- **Paths inside the scripts** point at the scratch worktrees they ran in. Each `*COMMANDS.txt` gives the exact invocation.
- **Status:** these are acceptance FAILURES or findings, unless marked otherwise.

## item1_caret: the caret jumps, and a rhyme-group declaration can be lost (candidate only)

| file | what it shows |
|---|---|
| `verify-page-rules-6__caret2.js` | the script (Playwright, `/opt/pw-browsers/chromium`) |
| `verify-page-rules-6__caret2_cand.json` | the candidate result |
| `verify-page-rules-6__caret2_main.json` | the main control |
| `verify-page-rules-6__parse_final.out.json` | the candidate page's own parse of the final text |

**The draft:** `[VERSE] Oh--oh, oh my love / I hold the dove / … [SETUP — rhyme groups — 2,4]`. The script types `--oh my` after `dove`, one key every 160 ms.

**On the candidate,** the caret is at 43 on line 2. Right after `--`, the row is rewritten to `[SETUP — rhyme groups — 2 (carried across the word-cut change),4 — cut v2]`, and the caret jumps to 162, the end of the document. `oh my` is then appended to that row, which leaves `…— cut v2]oh my`. The page's own parse then lists the row as a fifth sung line, with `setup: []` and `groups: null`: **the declaration is gone.**

**On main,** the caret goes 43 → 49 on line 2, and the row stays `[SETUP — rhyme groups — 2,4]`.

**Also here:**
- `A_observe` / `A_restore` show a typed `1.T4` row. On the candidate the caret goes 75 → 125, from the row to the end.
- A selection restored to its raw offsets lands inside the rewritten row, which gives `—ZQ cut v2 — cut v2`. So a fix has to map the caret through the change.
- `page-rules__scen_H.*` is the first observation.
- `verify-page-rules-2__caret*` also covers reading rows.

## item2_stale_tab: a stale Library tab moves a choice to a different word (candidate only)

| file | what it shows |
|---|---|
| `library-route1__repro_stale_tab_oo_only.js` | the script; one origin and one IndexedDB, with the candidate page and the retained main chunk `analysis.71b110b249.js` as an old tab |
| `library-route1__stale_tab_oo_only_out.txt` | the result |

On the line `Oh--oh, oh, oh my love`, the user's choice is v1 token 2, which is chars 8-10. The steps:

1. **New page loads.** It migrates the choice to v2 token 3 (chars 8-10). The record holds `declarations`, `token_cut`, `renumbered` and `legacy_declarations`. It sends `[line, 3]`.
2. **Old tab loads, and its user presses Apply.** The record is saved back as `{declarations}` only, with the rows still `[line, 3]`.
3. **New page reloads.** It treats the record as unmarked v1 and moves it again: "token 3 → 4 … on the same characters". It sends `[line, 4]`, which is **chars 12-14**, a different `oh`. No alert appears.

**Controls and frequency:** `verify-library-route1-0__*` holds the skeptic's own two-tab repro, the order control S2 (an old tab mounted before the migration re-saves token 2 and is migrated correctly), and the frequency scan `scan_out.txt`. The scan is an estimate on 8 of 256 shards: of 503 moved choices, 500 would block visibly and 3 would land silently on another word.

## item3_mixed_version: old page ↔ new server

**Inputs:**
- `library-routes234__route2_stale_client_validate.log`: candidate `validate_choices` under v2 accepts token 2 `oh`, bound to (4,6). Base binds token 2 at (8,10).
- `verify-library-routes234-2__e2e_*`: the real Python worker run on each tree, with the token-to-span tables.
  - `e2e_cand_tok2.log`: v2, where `oh` at (8,10) is token 3.
  - `e2e_base_tok2.log`: v1, where `oh` at (8,10) is token 2.
  - `e2e_main_tok2.log` refused with `LEXICAL_ASSET_MISSING`. That is an environment gap: no cmudict is staged in that worktree. It is not a result.
- `server_e2e_*.json`: the server route plus the real worker, with each page's request body on each tree. The outcome fields are `job_state`, `job_reason`, `worker_declarations` and `line0_tokens`:

| body (page) | server tree | line | sent | bound | visible? |
|---|---|---|---|---|---|
| old (main) | candidate | `Oh--oh, oh my love` | token 2 | **(4,6)**, the wrong `oh` | no: `completed_with_refusals`, no word-cut mention |
| old (main) | base | `Oh--oh, oh my love` | token 2 | (8,10), correct | n/a |
| new (candidate) | base | `Oh--oh, oh my love` | token 3 | nothing | **yes**: `paused`, READER_ERROR |
| new (candidate) | base | `oh--oh oh oh` | token 3 | **(10,12)** instead of (7,9) | no: completes |
| old (main) | candidate | `U--h, u--h, Lawdy,` | token 3 | nothing | **yes**: `paused`, READER_ERROR names `u` |

Every case is accepted by `validate`. A body that carries a scheme marker is refused with BAD_REQUEST ("unknown field"), so no marker can travel on this route today.

**Job identity:** `verify-library-routes234-0__*` lists its 16 keys, and none is a reader scheme. With the same `engine_commit`, a queued job runs under v2 (`08_A_real_*`); `09_base_*` is the control. `11_release_identity.txt`: production bakes a 40-hex commit (`mcp/Dockerfile:86`), so a production release changes identity, and a deployment with no commit identity does not.

## six_lines: identical cut, but the end sounds change

| file | what it is |
|---|---|
| `ledger.py` | run in the candidate tree with `cmudict.dict` staged and `LYRIC_STAGED_DATA` set |
| `six_ledger.json` | the result |
| `six_lines.json` | the recorder diff's six |

Every row has v1 and v2 token spans that are IDENTICAL, so the A.2 trigger ("the line's cut changed") does not fire. Each row gives `end_v1` and `end_v2` (the grader's `1.end` readings, with syllables and, under v2, the word and widx tags), `line_anchors` under both, and `end_phonology_changed`.

**What the union shows:**
- **8 lines whose end phonology changes:** 6 found by the grader's end slot over all 281,069 lines, and 6 in the recorder's `line_anchors` over its 227,540-line population. 4 are in both.
- **Examples:** `Below the knap, 's a runnèn still;`, `When in that house M.P.'s divide,`, `Where her "meteor flag" 's nailed fast`, `As most is in _Lynn_'s fair Town;` and `An' at each zide [=o]'m, sprack an' strong,`.
- **A false alarm:** 4 more rows differ only because v2 tags each syllable with its word and widx while v1 leaves them untagged. Their phonology is unchanged (`end_phonology_changed: false`).

## Not an acceptance failure

`library.test_unit_manifest` exits 1 only when it is run from the repo root without `PYTHONPATH=lyric-harness`: the root `library/` static-site directory shadows the package. It fails the same way on the candidate, `fce4bf0f` and `8b1d2ad2`, and it passes in CI's form. The receipts are in the scratch run of the `library-routes234` task and are summarised on PR #519. It is not repeated here.

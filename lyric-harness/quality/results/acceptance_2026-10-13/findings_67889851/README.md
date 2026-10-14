# Repros behind the findings on candidate 67889851

These are the minimal repro scripts and raw outputs behind the findings posted on PR #519 (6161601064 and 6161684346). 3PO asked for them on PR #527 (6161618773 and 6161951408).

- **Candidate:** `67889851144dd2a7eefedd9960a868978fb7bfae`.
- **Controls:** main `8b1d2ad2` for the page and the Library, and `fce4bf0f` for the harness.
- **Who ran them:** independent tester agents and their skeptics. Each agent's folder is copied whole under `repro/<item>/<agent>/`, keeping its original file names and helpers. Every `.log` is included; the repository ignores `*.log`, so they are force-added.
- **What is left out:** only built pages (`*.html`), `build*/` and `library/` chunk folders, and the mixed roots (`mix/`, `mixroot/`). All of these are regenerated from the pinned trees; see "Running them again".
- **Status:** these are acceptance FAILURES or findings, unless marked otherwise.

## Running them again

1. **Pin three worktrees** under one directory `W`; the agents' `S`/`W` variables point at it:

        git worktree add --detach $W/wt-678  67889851144dd2a7eefedd9960a868978fb7bfae
        git worktree add --detach $W/wt-main 8b1d2ad2cea5d9848cc6568dcce62b00747ab2f3
        git worktree add --detach $W/wt-base fce4bf0f1b4b274d1c44c67831a6e40b22a8802c

2. **Prepare the trees:**
   - copy the pinned `lyric-harness/cmudict.dict` into `wt-678` and `wt-base`, and point `LYRIC_STAGED_DATA` at the staged data directory;
   - symlink `node_modules` into `wt-678` and `wt-main`;
   - launch Chromium as `/opt/pw-browsers/chromium`.
3. **Copy each agent folder** to `$W/h678/<agent>/`. Its `COMMANDS.txt` (or `COMMANDS_*.txt`) gives the build steps for the excluded pages. The scripts need this documented layout or adapted paths: some, such as `caret2.js` and `lib.js`, keep the original scratch paths, and `six_lines/end_census.py` reads the corpus from a fixed path and records the candidate SHA as a literal, without asserting the checkout. The build steps:
   - `CODEX_LIBRARY=1 node scripts/build_html.js --out=…`;
   - a mixed root is symlinks to every `wt-678` entry, with `codex-old.html` = `wt-main`'s `codex.html`.

## item1_caret: the caret jumps, and a rhyme-group declaration can be lost (candidate only)

**Files:** `repro/item1_caret/verify-page-rules-6/`, with `caret2.js`, `caret2_cand.json`, `caret2_main.json`, `parse_final.js` and `parse_final.out.json`.

**The draft:** `[VERSE] Oh--oh, oh my love / I hold the dove / … [SETUP — rhyme groups — 2,4]`. The script types `--oh my` after `dove`, one key every 160 ms.

**On the candidate,** the caret is at 43 on line 2. Right after `--`, the row is rewritten to `[SETUP — rhyme groups — 2 (carried across the word-cut change),4 — cut v2]`, and the caret jumps to 162, the end of the document. `oh my` is then appended to the row. The page's own parse turns the row into a fifth sung line, with `setup: []` and `groups: null`: **the declaration is gone.**

**On main,** the caret goes 43 → 49 on line 2, and the row stays `[SETUP — rhyme groups — 2,4]`.

**Also in the folder:**
- A raw-offset restore lands inside the rewritten row (`—ZQ cut v2 — cut v2`).
- `repro/item1_caret/page-rules/scen_H.*` is the first observation; it needs `cand_lib.js` from the same folder.
- `repro/item1_caret/verify-page-rules-2/` also covers reading rows.

## item2_stale_tab: a stale Library tab moves a choice to a different word (candidate only)

**Files:** `repro/item2_stale_tab/library-route1/`, with `repro_stale_tab_oo_only.js` (it needs `repro_lib.js`, which is in the folder) and `stale_tab_oo_only_out.txt`.

On the line `Oh--oh, oh, oh my love`, the user's choice is v1 token 2, which is chars 8-10. The steps:

1. **New page loads.** It migrates the choice to v2 token 3 (8-10) and sends `[line, 3]`.
2. **Old tab loads, and its user presses Apply.** The record is saved back as `{declarations}` only, with the rows still `[line, 3]`.
3. **New page reloads.** It moves the choice again ("token 3 → 4 … on the same characters") and sends `[line, 4]`, which is chars 12-14. No alert appears.

**The skeptic's reproduction:** `repro/item2_stale_tab/verify-library-route1-0/`, with `stale2tab.js` and these scenarios:
- **S1:** the failure;
- **S2:** an order control. An old tab mounted before the migration is migrated correctly;
- **S3:** on `Oh--oh, oh my love` the second pass is blocked, and the legacy copy becomes token 3;
- **B1:** main in both tabs. Token 2 throughout.

**Frequency, a bounded estimate.** `scan.js` / `scan_out.txt` is an 8-shard scan (shards `00 3a 57 81 a4 c1 e7 ff`) of 427 English units and 13,955 lines. It is not an incidence rate for the whole population.
- In that scan, 389 lines have a cut that differs, and the first pass moves 503 choices.
- On a second unmarked pass, 500 are blocked visibly and 3 land on another word.

## item3_mixed_version: old page ↔ new server

**Files:** `repro/item3_mixed_version/verify-library-routes234-2/`.
- `e2e_worker.py` runs the real Python worker.
- `server_e2e.mjs` runs the server route with that worker.
- `stale_page_probe.cjs` makes each page's request body.
- The outputs are `server_e2e_*.json` and `e2e_*_tok2.log`.

| body (page) | server tree | line | sent | bound | visible? |
|---|---|---|---|---|---|
| old (main) | candidate | `Oh--oh, oh my love` | token 2 | **(4,6)**, the wrong `oh` | no: `completed_with_refusals`, no word-cut mention |
| old (main) | base | `Oh--oh, oh my love` | token 2 | (8,10), correct | n/a |
| new (candidate) | base | `Oh--oh, oh my love` | token 3 | nothing | **yes**: `paused`, READER_ERROR |
| new (candidate) | base | `oh--oh oh oh` | token 3 | **(10,12)** instead of (7,9) | no: completes |
| old (main) | candidate | `U--h, u--h, Lawdy,` | token 3 | nothing | **yes**: `paused`, READER_ERROR names `u` |

Every body is accepted by `validate`. A body that carries a scheme marker is refused with BAD_REQUEST ("unknown field").

**Qualifications, from 3PO's review:**
- These are LOCAL tests: the server components and the real Python worker on a synthetic catalog, without HTTP. They are not checks of the deployed service.
- A successful terminal state for a mixed worker is `completed_with_refusals`.
- **Job identity:** `repro/item3_mixed_version/verify-library-routes234-0/`. It has 16 keys, and none is a reader scheme.
  - The changed-commit control pauses with STALE_READING and zero leases.
  - Production Docker requires a baked commit (`11_release_identity.txt`).
  - So the null-commit run (`08_A_real_*`) shows the gap for a deployment WITHOUT a commit identity. It does not establish a production bypass.

## six_lines: identical cut, but the end phonology changes

| file | what it is |
|---|---|
| `end_census.py`, `end_census_0.json`, `end_census_1.json` | THE UNRESTRICTED CENSUS (grader measure) |
| `six_lines.json` | the recorder measure: the recorder diff's six |
| `union.py` → `union.json` | the union of the two measures |
| `ledger.py` → `six_ledger.json` | identity recovery only, prefiltered |

**The unrestricted census** covers every reader line in `corpus/song/eng_*` whose v1 and v2 token spans are identical. It compares the grader's `1.end` readings by phonology only (onset, nucleus, stress and coda). Each hit records its identity, its spans and both readings.

**The recorder measure:** lines whose tokens and final are identical but whose `line_anchors` changed. `record.py` measured these over its 227,540-line population (`../diff_breakdown_67889851/`).

**The union** (commands in `six_lines/COMMANDS.txt`) pairs, for every line, the identical spans, both ends' readings and `line_anchors`, and says which measure found it. That includes the two Barnes `[=o]` lines that only the recorder measure sees. Its `A2_trigger_fires: false` is inferred from the identical spans, not from running the page's trigger.

**The identity-recovery ledger** prefilters on `'s` / recorder texts, and was used only to recover identities before the census existed. It is not a census.

## returns_nend: the page's upgrade turns an `N.end` return into a whole-line return (candidate only)

**Files:** `repro/returns_nend/verify-page-matrix-2/`.
- The page half: `page_end_returns.js` → `page_end_returns.log` / `.json`.
- The connector half: `e2e/returns_e2e.mjs` → `e2e/cand_e2e.log` and `e2e/base_e2e.log`.
- The harness parses: `harness/*.log`, all over `harness/song8.txt`.

`repro/returns_nend/page-matrix/` is the first observation (`scen_end.js` → `end_returns.log`). Other skeptics:
- `verify-page-matrix-3/` covers other placements and the page's own load;
- `verify-page-matrix-4/harness/` shows that both harness trees read a bare `N` in returns as a whole line, and refuse a row that mixes a placed member with a whole-line one.

**The song:** line 4 is `You hold my heart.    10` and line 6 is `Well-worn shoes upon the floor`. Line 4's cut changes in v2, and its last word is a numeral.

| field | main page `8b1d2ad2` → harness `fce4bf0f` | candidate page → candidate harness | control: the original row, sent straight to the candidate harness |
|---|---|---|---|
| original declaration (the row as written) | `[SETUP — returns — 4.end,6.end]` | the same | the same |
| emitted declaration (what the page sends to /chat) | `4.end,6.end` | `4,6`. On load, with no user action, the row is rewritten and saved as `4 (carried across the word-cut change),6 — cut v2` | `4.end,6.end` |
| parsed return kind | a placed return at `end`. This tree reads L4's end as `heart`, the word before the unreadable `10`, which is a pre-existing substitution | a **whole-line verbatim** return | a placed return at `end`. L4 has no end to read (`RETURN_PLACEMENT_ABSENT`) |
| blocking / certification | `lyric_check` certified, with the flag `RETURN_NOT_VERBATIM` (placed: `heart` vs `floor`). `lyric_revise` stopped at a group proposal the script does not answer (exit 4, no song yet) | `lyric_check` **certified true, refused []**, with the flag `RETURN_NOT_VERBATIM` (whole line). `lyric_revise` exit 0, `finished_clean`, **certified true**, blocking `[]` | `lyric_check` certified false, refused `return:4:6`. `lyric_revise` exit 2, uncertified, blocking `L4: not judged — return with L6 …` |
| changed lyric | none | **L4 `You hold my heart.    10` → `Well-worn shoes upon the floor`**. The writer kept every line it was asked for; the loop wrote L4 | none |

**The actual payload and the parsed mandate** (3PO, #527 6162609268, asked for these rather than the durable labels). The script is `repro/returns_nend/payload_and_mandate.py`, and its output is `repro/returns_nend/payload_and_mandate.json`.
- It takes the `returns` string each page put on the wire to the stubbed /chat (`sent` in `verify-page-matrix-2/page_end_returns.json`).
- It parses that string with each harness tree's own mandate parser, the way the CLI's `--returns=` does: `_groups`, then `quality.schemes.mandate`.
- `fce4bf0f`, `67889851` and `61b6618a` parse every payload identically. The candidate page's `src/pages/lyrics.js` is unchanged at `61b6618a`.

| row as written | main page sends → parsed | candidate page sends → parsed |
|---|---|---|
| `4.end,6.end` (line 4's cut changed) | `4.end,6.end` → one class, lines 4 and 6, **placed** at `end`, `end` | `4,6` → one class, lines 4 and 6, **whole line** |
| `5.end,6.end` (unchanged lines) | `5.end,6.end` → **placed** | `5.end,6.end` → **placed** |
| `5.end,6.end;1.T4,8.T4` (unchanged lines, plus a `T<k>` row-mate) | the same string → two **placed** classes: `5,6` at `end` and `1,8` at `T4` | `5,6;1.T5,8.T5` → `1,8` placed at `T5`, and **`5,6` whole line**. There is no notice for lines 5 and 6 |
| `4,6` (bare) | `4,6` → whole line | `4,6` → whole line |

One side observation, not checked further: the pre-batch page sends a candidate-marked row as written (`4.end,6.end — cut v2`). The parser then keeps `end — cut v2` as the second member's placement. I did not check what the grader does with that placement.

**How the halves join.** The page half stubs /chat and records the declaration the page sends. The connector half feeds that exact string into an in-process `/mcp` session: `begin_lyrics {phase:'edit'}` → `lyric_check` → `lyric_revise`, where the writer answers each asked line with the line as it stands. This is not one continuous run through the website.

**Qualifications, from 3PO (#527 6162369014):**
- The page matrix's Keep and reload counts (63/63) show that the **serialized row** persists. For a returns row that is the rewritten, wrong obligation. They do not show that `N.end` is preserved, and they are not a pass for the original obligation.
- `N.end` reaches a returns row only by hand, by import or by paste: no page form writes it.
- In rhyme-group rows the same rewrite grades the same (`--groups=4.end,6.end` and `4,6`).

## Minor findings behind #519 6162326336, as the skeptics corrected them

Every agent's full result, the skeptics' included, is in `gap_checks_b_page_connector.json`. Scratch paths there read `<scratch>`.

- **`get_operation` re-serves a pre-release operation's `pronunciation_options`, numbered under v1 and unmarked.** Files are in `repro/connector_continuation/verify-connector-continuation-0/`:
  - `read_on_cand.json` and `read_on_base.json`, from operations written by `fce4bf0f` (`write_base.log`, `ids_base.json`);
  - the full option dumps, `oldfull_read_on_*.json`.

  On the candidate, copying the old `wind` token 2 (`W AY1 N D`) into a **new** session binds the inner occurrence. That gives `answered — no flag stands`, **certified true**, where `fce4bf0f` gives SCHEME_VIOLATION. Continuing the old session itself is refused with `CONTINUATION_MIGRATION_REQUIRED`.

  The re-serve itself predates the batch: `mcp/workflow_sessions.js` is unchanged. The mismatch is new with the cut change. The path is narrow. The skeptic made `CHAT_SECRET` a locally generated test value for these runs; that value is not kept here.
- **A member annotation the page cannot parse is not blocked.** This is mostly pre-existing: main `8b1d2ad2` sends the same saved rows the same way (`repro/returns_nend/verify-page-matrix-1/`, `-5/`). What is new is that the candidate has its own marker words, and a misplaced or misspelt copy takes that old path. Unknown cut marks (`— cut v1`, `v3`, `v9`) do block.
- **The carried notice calls a bare `N` returns member "last rhyme",** while the grader reads it as the whole line (`repro/returns_nend/verify-page-matrix-4/`). After the upgrade, a row written by main's "Declare as exact repeat" gets one such notice per line.

## Gap checks: legacy replay, harness residuals, Library (workflow A)

Every agent's full result, the skeptics' included, is in `gap_checks_a_legacy_harness_library.json`. The folders are:
- `repro/legacy_replay/`
- `repro/harness_misc/`
- `repro/library_tests/`

Files over 200 KB are gzipped in place. Four Library dumps of about 9 MB each (`c8b_*.json`) are left out; their scripts regenerate them.

- **Legacy replay: PASS.** All five properties were executed independently against base-made states:
  - `tryline` refuses a scheme mismatch, and inherits the recorded scheme when no flag is given;
  - a call → answered → replay cycle keeps v2, and a base-made file replays as v1, byte-equal to base apart from the added key;
  - a pre-batch state resumed on the candidate keeps its rows, digest and run key;
  - `--voices` tier-2 questions equal base's;
  - policy 5's named places resolve under v1.

  Two minor findings, both confirmed by a skeptic:
  - **A deferred state holding `"reader_scheme": null` is resumed under v2,** where a replay file holding null is refused. A `call:` checkpoint holding null is refused with advice that cannot be followed. Only a hand-edited or foreign state can hold null.
  - **On a line ending in a numeral, `endword` binds the preceding word and certifies,** while `end` and a bare `N` refuse. The binding itself predates the batch: `slots.py` is unchanged, and base already did this for unreadable alphabetic end words. v2 makes it an inconsistency on numeral-end lines.
- **Harness residuals and warm caches.**
  - Warm processes match cold ones in every order: 14/14 per order, plus two interleaved orders.
  - R2's earlier findings (a), (c), (d) and (e) are fixed.
  - **(b), broken rhyme across a line end, is a regression under v2,** confirmed by two skeptics:
    - **The case:** a pair whose line ends in a hyphenated word (`king-` in every hyphen spelling, `anguish-` too) and that has a **declared schema relation** (`schema:broken rhyme` or `schema:perfect rhyme`).
    - **The effect:** on the plain default reader, that pair now reads UNJUDGED, refused and uncertified.
      - For `broken rhyme`, base and v1 gave True for ASCII `-` and False for the other four spellings (U+2010, U+2011, `-`+U+00AD, U+00AD+`-`). So only ASCII `-` held before; the other four go from False to None. `perfect rhyme` gave True on base and v1.
      - With `--lexicon-supplement=v2`, base and v1 already refused, so the regression is the plain default reader (3PO, #527 6163315071).
      - The 18 hyphen-ended corpus lines are a raw grep, not a count of affected runs.
    - **The cause:** the v2 cut (`382c36438`) gives the relation judge the token `king-`, which it cannot read without G2P. In the same run, `line_anchors` reads it, so the two disagree.
    - **Not affected:** pairs with no declared relation still hold under v2.
    - **R2's commit:** its message promised one verdict for every spelling, which is met, as a refusal. Only its test asserts True, and the test builds `English(fallback='high')`, which no production path builds.
    - **At `61b6618a`:** `relations.py` and `eng.py` are unchanged, so this stands there too.
  - Minor: `pronunciation_variants` and the readers built on it don't normalise a raw spelling, while `transcribe_word` does under v2. The two methods agree under v1 and disagree under v2. This reaches the `types` verb on soft-hyphen spellings.
- **Library.** The Lyrics handoff carries the current cut's rows only; that is deliberate and tested. But **nothing in Lyrics notices the undecided choices left out:** no toast, no surface text, no history, no store, no download. On a phone, a `v9` or already-migrated record gives no on-screen signal before the handoff. Main hands every stored row over, numbered under its own v1 cut.

## Passes behind #519 6162326336

These are committed as receipts. Each was reproduced by an independent skeptic agent. They are pinned to the same trees.
- **`repro/connector_continuation/`:** continuation across the release is refused everywhere with `CONTINUATION_MIGRATION_REQUIRED`:
  - raw state, the shared `/mcp` caller-managed mode, session `lyric_revise`, `resume_operation` and the signed `/chat` continuation;
  - `recover_only` exports the original artifact.

  `fingerprint_files.mjs` / `.log` lists the 56 fingerprinted files that changed.
- **`repro/library_tests/`:** the Library fallback store (`lib.device` removed) migrates and blocks the same way. `check_library_page` passes 270/270, `check_library_regression` passes, and `mcp/test_reader_*` passes.

## Not an acceptance failure

`library.test_unit_manifest` exits 1 only when it is run from the repo root without `PYTHONPATH=lyric-harness`: the root `library/` static-site directory shadows the package. It fails the same way on the candidate, `fce4bf0f` and `8b1d2ad2`, and it passes in CI's form. See `repro/item3_mixed_version/library-routes234/COMMANDS_gate.txt` and its `gate_*` logs.

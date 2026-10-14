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
3. **Copy each agent folder** to `$W/h678/<agent>/`. Its `COMMANDS.txt` (or `COMMANDS_*.txt`) then runs as written, including the build steps for the excluded pages:
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

**The union** pairs, for every line, the identical spans, both ends' readings and `line_anchors`, and says which measure found it. That includes the two Barnes `[=o]` lines that only the recorder measure sees.

**The identity-recovery ledger** prefilters on `'s` / recorder texts, and was used only to recover identities before the census existed. It is not a census.

## Not an acceptance failure

`library.test_unit_manifest` exits 1 only when it is run from the repo root without `PYTHONPATH=lyric-harness`: the root `library/` static-site directory shadows the package. It fails the same way on the candidate, `fce4bf0f` and `8b1d2ad2`, and it passes in CI's form. See `repro/item3_mixed_version/library-routes234/COMMANDS_gate.txt` and its `gate_*` logs.

# Toast mutation anchor repair

On `f8093986`, CI job `116658240829`
reached fault 38 after catching theme/map faults, then stopped before planting:
`faults: toast action removal not found in codex.html`.
The literal assumed parameter `t`; runtime-local minification emits
`function hideToast(e){...e.querySelector(".toast-action")?.remove()}`.

Only `scripts/faults.js` changes executable code. Its anchor now captures the
local parameter inside the preserved global `hideToast` function and requires
exactly one match. The mutant still removes toast-button cleanup and restores
invisible-button clickability through the same CSS override. Its owning gate
must still reject the precise behavior, `Undo of a faded toast still takes a
click`; setup errors and timeouts are not accepted catches.

The shipped HTML is unchanged, SHA-256
`94dbde6a41896462fc82beeeb52213e26dea6b15bee03e4b11e2656878e3879e`.

## Checks

- Original literal absence reproduced on the exact artifact (`before.txt`).
- Anchor controls cover `t`, `e` and `$toast`, preserve another function's
  matching removal, and refuse absent or duplicate target functions
  (`anchor-controls.txt`).
- Unmodified page: **252 foundation assertions PASS**
  (`clean-foundation.txt`).
- Fault 38: **caught, zero escapes**, owning gate exits 1 specifically for
  `L. the Undo of a faded toast still takes a click at its place` and
  `L. a used Undo still takes a click at its place` (`toast-fault.txt`).
- All seven classes after 38: **caught, zero escapes** using
  `node scripts/faults.js --only=39,39b,39c,39d,39e,39f,retired-id-unresolved --verbose`
  (`post38.txt`).
- ESLint, Prettier and `git diff --check` pass for the changed script.

The remaining built-HTML mutations were inspected: body/style injection,
head-theme code not subject to runtime mangling, and global data anchors.
Other local-variable-sensitive plants target original source files before
building. No further renamed-runtime-local assumptions were found.

An initial clean-foundation attempt timed out at the desktop atlas key before
all fixture links were installed at test start (`clean-incomplete.txt`); it is
not a passing check. The complete-fixture retry passed. The atlas HTML and all
nine fetched input files match HEAD (`fixture-identity.txt`). A separate fresh
atlas probe produced five key rows without JavaScript errors. No definitive
cause is claimed for the earlier timeout.

The focused fault-38 result follows the complete-fixture clean run. This is local test evidence, not new CI or deployment qualification.

## Discarded fixture-isolation attempt

The first post-38 run staged `tests/library` as a symlink to
`/workspace/musica-repair/tests/library`. Because the injector copies with
`cp -a`, its temporary copies retained that symlink, and ledger faults wrote
two files in that other worktree: `id-map.json` and `revisions.json`. That run
is excluded from qualification. Its exact injected singleton arrays were
identified from the fault source and inspected diff; the two files were then
restored to that worktree's HEAD (`[]` plus newline), with an empty post-cleanup
diff. No pre-run snapshot was taken, so their original uncommitted state cannot
be independently established; any previously overwritten content is not
recoverable from this attempt. No broader restore or reset was used.

The retained `post38.txt` is a fresh run with current-HEAD fixtures materialized
as real files. All seven faults were caught independently, and every fixture
remained a real file byte-identical to HEAD afterward
(`post38-fixture-identity.txt`).

# Runtime payload repair

The exact reviewed head `1135f7df022453d9745cd0b9bc39fb2fad0dc4fa` exceeded the
existing Library shelves transfer budget. This repair shortens function-local
identifiers only in classic-script blocks labelled `runtime: `. It preserves
cross-script top-level identifiers, object property names, function/class names,
and direct-eval scopes. Compression remains disabled. Data blocks, preloads and
Library chunks retain the existing whitespace-only minifier. No new loading
requests, chunk generations, asynchronous navigation or binding behavior are
introduced, and no budget is raised.

| Measurement (gzip level 6) | Before | After | Existing limit |
| --- | ---: | ---: | ---: |
| Page | 385,642 B | 368,083 B | 389,120 B |
| Library shelves path | 401,012 B | 383,453 B | 393,216 B |

The shelves path changes from **7,796 B over** to **9,763 B below** its limit.
All 13 measured budgets pass. The before artifact was read directly from the
named head; both measurements use the same API fixture and Library catalog.
The catalog SHA-256 matches the repository head:
`76ed1232baaf78323680474db20ecddc8b9105977a74bf7c5242c55097b7c238`.

The independently built candidate and root's rebuilt `codex.html` are identical:
SHA-256 `94dbde6a41896462fc82beeeb52213e26dea6b15bee03e4b11e2656878e3879e`.

## Completed checks

- `build_html.js --check`: lazy build parses, required declarations remain, every
  runtime block compiles, largest script 393 KiB below the 1,024 KiB ceiling.
- `check_runtime_minify.js`: cross-script lexical and global-property lookup,
  dynamic keys, callback/arrow/class names, direct eval, deterministic bytes;
  positive control proves local identifiers shorten and negative control proves
  data identifiers do not. This check also runs inside the existing equivalence
  gate's Node runner.
- `check_minified_equivalence.js`: independently builds unminified and minified
  embedded artifacts; PASS across 7,755 traditions, four rendered surfaces,
  six imports, four recipe formats, three preface queries and 1,529 CSS rules
  parsed in Chromium.
- `check_payload_budget.js`: exact before failure and after all-13 PASS retained
  in `budget-before.txt` and `budget-after.txt`.

## Qualification limits and incomplete attempt

`shared-startup-incomplete.txt` records an initial shared-journey attempt that
stopped at its 30-second `LY.model && UI.ready` startup wait. It ran without the
repository-root API/assets fixture links used by that test's route handler, so
it executed no journey assertions and is **not** acceptance evidence. The root
qualification run restores those fixture links and separately records its page,
interaction, inspector, readability, Library and recipe results. This receipt
alone does not claim those broader gates, exact-head CI, independent review,
deployment, or live acceptance.

The first equivalence attempt also exposed a misplaced test-runner `require`
inside its browser probe string; that was corrected to the Node runner before
the retained passing equivalence run. No runtime browser dependency on `require`
was introduced.

## Optimized-artifact interaction checks

On the same `94dbde6a…` artifact: Lyrics page 809 assertions, inspector 16
cases, readable rows 8 cases, Library 270 checks and adapter 13 tests pass.
Inspector/readability receipts use separate output directories for this run.
An earlier inspector attempt could not resolve the local MCP dependency; a second
lacked the intended Python runtime and produced no verified transport binding.
Their logs are retained as incomplete, not accepted results. The completed run
uses the staged lexicon and Python 3.12 environment with the local real transport
fixture; no provider call is made. A recipe attempt lacked its committed snapshot
in this sparse checkout; the snapshot was restored byte-for-byte from HEAD for
a replacement run, without regenerating expectations.

The restored-snapshot recipe gate passes 56/56 and the shared Lyrics journeys
pass 13/13. Lint and formatting pass for all three changed scripts. These are
local/fixture checks, not live-service acceptance.

# CodexMusica — Repo-Wide Verification Audit

**Date:** 2026-06-13 · **Commit:** `ab651d2` (branch `claude/nines-hardening`, 5 ahead / 0 behind production) ·
**Auditor:** automated, adversarial, multi-agent · **Method:** ran every gate + catalog-wide smoke for hard
evidence, four parallel dimension reviews (engine / data / app / gates), plus direct verification of
determinism, counts, and reproducibility.

---

## 0. Remediation status — fixes applied after this audit

All five HIGH findings, the accessibility trio, and the engine/persistence MED items
are now **fixed** on `claude/nines-hardening`, each verified, committed, and **green
on CI** (run #76 on `61c90ff`). Every fix was made to *honor* the original author's intent (extend the
fault framework, complete the deploy-gating they'd flagged, keep the explicit-save
model, finish the aria-modal contract) — not to work around it.

| # | Finding | Status | Commit |
|---|---|---|---|
| H1 | "every gate is two-sided" was false (3 doc gates uncovered) | ✅ 3 doc-gate faults + registry-driven completeness check | `a19567b` |
| H2 | deploy publishes without waiting for CI | ✅ `sync-pages` gated on CI success (`workflow_run`) | `4b5fdec` |
| H-APP-1 | unsaved in-progress workspace lost on reload | ✅ `beforeunload` guard (explicit-save model kept) | `5333123` |
| H-ENG-1/2 | `inspect` / `recipe --why` misreport the winner | ✅ both route through the engine's per-part isolation context | `a106618` |
| M-APP-3/4/5 | modal a11y incomplete (no trap/restore/keyboard) | ✅ focus trap + restore + Enter/Space activation | `5333123` |
| M-ENG-1 | blend double-counts a repeated tradition | ✅ dedupe tradition ids | `b8126a3` |
| M-APP-1 | saved workspaces carry no schema version | ✅ `WS_SCHEMA` stamp; loadWS/forkWS reject a newer-schema save | `61c90ff` |
| M-APP-6 | undo/redo `JSON.parse` unguarded | ✅ guarded restore (keeps canvas, rolls back index on corruption) | `61c90ff` |
| — | (CI-caught) audit report tripped `check_docs` | ✅ `AUDIT_REPORT.md` excluded as prose, like README/CHANGELOG | `f1e58a8` |

**Deliberately deferred (with rationale):**
- `audit` / `audit_coherence` stay **advisory** — the author's explicit design (quality nudges, not blockers). Not a defect.
- `L-ENG-1` tie-break, `M-DATA-1/3` + `L-DATA-1` preface dead/duplicate tokens: LOW/MED data-quality whose fix churns recipe snapshots + the static API for marginal gain — deferred to a dedicated data pass.
- `M-DATA-2` voice mis-stamps (17): need musicological judgment (data-coherence lane).
- `M-APP-2` cross-tab clobbering of the saved-list index: needs the async storage backend's key-enumeration API to reconcile (a `storage` event won't fire on it) — deferred pending that. (`M-APP-1`/`M-APP-6` now fixed — see table above.)
- prettier (59 files) + stale-branch cleanup: formatting the author never adopted + branch hygiene — cosmetic.

**Owner-only (cannot be done in-repo):** branch protection on production (the suspenders to H2's belt); merging `nines-hardening` + cutting a tagged release.

---

## 1. Executive verdict

The system is **genuinely sound at its core and honest about its headline numbers**, but its central *marketing
claim* — "every gate is two-sided, we can never ship stale or non-green" — is **overstated**, and there is one
real **data-loss** footgun in the app.

- **Build is reproducible.** Committed `api/` (1543 files) + `codex.html` are **byte-identical** to a fresh
  build from source (modulo build-date). The published artifact is provably a function of the source.
- **Catalog is honest and structurally clean.** 1119 traditions / 419 instruments / 256 rooms / 22 chains /
  120 tunings — every count verified two independent ways. **Zero dangling references, zero duplicate ids.**
- **Engine is deterministic & numerically clean.** No `Math.random`/`Date` in core; recipes byte-identical
  across runs; **0 NaN/Infinity in 500,532 score evaluations**. *(But two explainer tools misreport — §3.4.)*
- **App has no XSS.** All 68 DOM sinks pass through a correct `esc()`; no `eval`/`Function`/`document.write`.
- **The gate suite passes** end-to-end (1 gate un-runnable in this sandbox: see §3).

**Five HIGH findings** temper that — three operational, two in tooling: (H1) the "two-sided" guarantee is proven
for only 7 of ~13 gate scripts, including **3 promise-bound doc gates with no fault test**; (H2) the **deploy
path does not wait for CI**, so a red or stale artifact can publish; (H3) the app has **no autosave /
`beforeunload`**, so an in-progress workspace is lost on reload or crash; and (H4–H5) the two engine **explainer
tools** (`inspect`, `recipe --why`) report a different winner than the recipe actually contains on isolated
blends — the recipes themselves are correct, but the debugging tools lie.

**Overall maturity: TRL 8.** Complete, gated, reproducibly built, auto-deployed — held back from "9" by the
gate-coverage overclaim, the un-gated publish, and the data-loss gap, none of which are deep.

---

## 2. Evidence — gate suite (this audit, run locally on `ab651d2`)

| Gate | Result | Key number |
|---|---|---|
| `lint` (eslint) | ✅ exit 0 | clean |
| `validate` | ✅ | VALID — 1119 trad / 312 tree / 419 inst / 256 room / 22 chain |
| `check_docs` | ✅ | no drift; all script refs resolve |
| `check_doc_commands` | ✅ | 13/13 documented commands exit 0 |
| `check_doc_behaviors` | ✅ | 8/8 behaviors hold |
| `check_api` | ✅ | counts complete, ≤1000-char recipes, every config id resolves |
| `check_promises` | ✅ | 10/10 promises documented **and** gated, 0 orphans |
| `audit` (advisory) | ✅ exit 0 | warnings only — non-blocking (see M-INFRA-4) |
| `audit_coherence` | ✅ run | 17 high-confidence + ~144 candidate voice mis-stamps (advisory; **not in CI**) |
| `test:recipes` | ✅ | snapshot match |
| `test:prefaces` | ✅ | 79/79 |
| `test:slots` | ✅ | 9/9 lock-ins |
| `test:app` | ✅ | 56/56 app-recipe parity |
| `test:equiv` | ✅ | 8/8 browser≡node (9-fixture sample) |
| `test:lazy` | ✅ | lazy shell ≡ embedded (full ×1119 projection) |
| `reachability` | ⚠️ not run | Chromium absent in sandbox; **passed in CI #73** |
| **`smoke`** | ✅ | **5639/5639** (1119 trad + 15 blends + 8 axis-targets) |
| **`check:fresh`** | ✅ | **1543 files + codex.html byte-identical to fresh build** |
| **`faults`** | ✅ | **10 fault-classes, 0 escapes** — but scoped to 7 gate scripts (see H1) |

---

## 3. Findings by dimension

Severity: **HIGH** = correctness / security / data-loss / can-ship-broken · **MED** = robustness / coverage
gap / overclaim · **LOW** = polish.

### 3.1 Verification gates & deploy (the meta-audit — sharpest results)

**[HIGH] H1 — "Every gate is two-sided" is materially false.**
`faults.js` plants a real defect for **7 gate scripts** (validate, check_api ×3 classes, equivalence,
check_artifact_fresh ×2, recipe, check_promises, check_lazy_app) and prints *"All gates are two-sided."* But
`check_docs`, `check_doc_commands`, `check_doc_behaviors` — all three **bound to registered promises**
(`catalog-counts`, `documented-commands-run`, `documented-behaviors`) — get **no fault injection**, and neither
do `audit`, `audit_coherence`, `check_slot_picks`. A `check_docs` count-regex that silently stopped matching
would pass green on drifted docs and nothing would catch it.
→ *Fix:* add fault classes for the 3 doc gates (corrupt a count, append a failing command, break one asserted
behavior); better, make `faults.js` fail if any `_promises.js` gate has no fault class (registry-driven
completeness). `faults.js:11-20` (header lists only 9 classes), `_promises.js:19-21`.

**[HIGH] H2 — The deploy does not wait for CI; freshness is advisory.**
`sync-pages.yml` triggers on **push** to production with its own concurrency group and **no dependency** on the
`verify`/`freshness` CI jobs — `ci.yml:11-15` admits it: *"does not BLOCK the concurrent sync-pages publish;
enforcing 'green before live' requires branch protection… a repo Setting."* So on a push to production, the
site publishes **in parallel** with the gates. If `freshness`/`faults`/`check:api` go red, the site is already
updating. Compounded by **H2b**: `sync-pages` republishes the **committed** `api/` verbatim
(`rm -rf _dist/api && cp -r api _dist/api`), only running `check_api` (catalog-shape, not a recipe rebuild) —
so if recipes are stale because the *engine* changed with no `references/` edit, the publish ships stale and
only the **advisory** `check_artifact_fresh` would have caught it.
→ *Fix:* gate `sync-pages` on a green CI `workflow_run` (or call the gate scripts inline before publish and
fail on non-zero); enable branch protection requiring the checks. `sync-pages.yml:12-23,64-74`.

**[HIGH] H3 — App: no autosave / `beforeunload` → in-progress workspace lost.** *(see §3.3 H-APP-1)*

**[MED] M-INFRA-1 — `validate.js` proven for 1 of ~19 error classes.** The only validate fault is a broken
`room:` ref → `BROKEN_REF`. `DUPLICATE_ID`, `MISSING_DEFAULT`, `MULTIPLE_DEFAULTS`, `MISSING_EXTRAS`
(the reverse-bijection added for "the alternative_rock bug"), `AXIS_OUT_OF_RANGE`, `DUPLICATE_KEY` source-scan,
etc. are unproven. `faults.js:91-97`.

**[MED] M-INFRA-2 — `equivalence.js` is a 9-fixture spot-check.** Proves browser≡node on 9
`instrument@tradition` pairs out of 1119×419; a real divergence on an unsampled pair passes green. (The
`check_lazy_app` projection *is* full-catalog, which mitigates.) `equivalence.js:48-57`.

**[MED] M-INFRA-3 — `check_promises` bijection fault-proven in 1 of 4 directions** (DOC→REG only; REG→DOC,
REG→GATE, GATE→REG unproven). `faults.js:181-186`.

**[MED] M-INFRA-4 — `audit_coherence` runs in NO gate; `audit` is advisory-only in CI.** `audit_coherence.js`
(substantive cross-field contradiction checks) is an npm script invoked by no workflow. `audit` runs in CI but
defaults to warnings (exit 0); CI calls plain `npm run audit`, so audit warnings never block. Neither is a
promise, so `check_promises` can't see the gap. → Decide intent: gate them, or stop saying "a suite of gates
guarantees quality." `package.json:18-19`, `ci.yml:53`.

**[MED] M-INFRA-5 — `check_doc_commands` passes vacuously on zero commands.** If a docs refactor changed
formatting so every command tripped the `PLACEHOLDER` reject, `cmds.size === 0` and it prints
*"PASS — all 0 documented script commands exit 0."* No lower-bound assertion. `check_doc_commands.js:31-56`.

**[LOW] L-INFRA-1 — freshness date-normalization is format-pinned.** `normalizeJson` matches only
`"generated":"\d{4}-\d{2}-\d{2}"`; correct today, but a future full-ISO timestamp would flip freshness to a
permanent false-FAIL. `sitemap.xml`/`llms.txt` carry their own dates and are not in the freshness diff (benign,
but ungated for reproducibility). `check_artifact_fresh.js:40-42`.

**[LOW] L-INFRA-2 — `_split_data.js` ignores `${...}` interpolation depth** ("data files don't use it" — a
comment, not a guard). A future template literal in a reference file could mis-split. `_split_data.js:93`.

**Verified two-sided & sound:** `check_api` (3 real faults, exact count/char/id-set/source-projection
assertions), `check_artifact_fresh` (full file-set diff + byte-exact html; html-half independently exercised),
`check_lazy_app` (full projection + non-vacuity guards + negative failure-state tests), `build_static_api`
(fail-**closed**, `process.exit(1)` on any shortfall), `equivalence` mechanism (single-source descriptor
harvest), `check_promises` mechanism (real 3-set bijection).

### 3.2 Data / catalog — **no HIGH; structurally clean**

**[MED] M-DATA-1 — 4 preface tokens are production-dead, masked by a two-semantics gate.**
`classical-trained`, `rough-tone`, `string-attack`, `throat-singing` appear only in `match_tokens` — in **zero**
`descriptors` arrays. The shipped app/`_card_descriptors.js` matcher pools **descriptors only**, so these can
never score in production. The `audit_dead_tokens` gate uses `_matcher.js`, which *does* pool `match_tokens`,
so it reports CLEAN — a blind spot between two matcher semantics. `references/07_preface_lexicon.js`.

**[MED] M-DATA-2 — `voice_tradition` mis-stamps.** All 975 voice-bearing traditions set `voice_tradition`
explicitly (good, 0 blind inheritance), but `modern_pop_vocal_training` is stamped on 602, and
`audit_coherence` flags **17 high-confidence** mis-stamps (e.g. `hawaiian_slack_key`→`polynesian_oli`,
`enka`→`japanese_min_yo`, `shidaiqu`/`mandopop_modern`→`chinese_classical_vocal`,
`persian_pop_los_angeles`→`persian_dastgah`) + ~144 review candidates. Semantic, passes all integrity gates.

**[MED] M-DATA-3 — `dubstep` and `tropical_bass` share an identical 13-axis signature** (from `audit`): two
distinct traditions are indistinguishable in axis space, so axis-target matching can't separate them and
diff/blend between them is degenerate.

**[LOW] L-DATA-1 — 10 prefaces have duplicate tokens** deflating max score (`|shared|/tokens.length`):
`qawwali-flying`, `jondo-tearing` lose 44% (9 tokens / 5 unique); 8 others 11–33%. Real tie-break hazard.

**[LOW] L-DATA-2 — 25 orphan rooms** (incl. authored real studios `fame_studios_muscle_shoals`,
`caribou_ranch_colorado`); **L-DATA-3 — 9 orphan tunings**, two clusters look like superseded duplicates
(`pentatonic_china` vs used `chinese_pentatonic_gong`; 4 `kignit_*` vs `ethio_qenet_unified`).

**Verified correct:** counts (load + raw-source agree), zero dup ids / zero dangling refs across every
reference class, zero orphan instruments, **voice structural coherence flawless** (16 parts, 12,839 overrides
all resolve, 1 default each), tree acyclic (312 nodes, 24 roots, 0 broken parents), traditions↔extras perfect
1119↔1119 bijection, full schema completeness.

### 3.3 Browser app — **XSS clean; one data-loss HIGH**

**[HIGH] H-APP-1 — No autosave / `beforeunload`; in-progress workspace lost on reload/crash.** The working
canvas (`app.cards`) lives only in memory + the in-memory undo stack; the only persistence is explicit "Save".
No `beforeunload`/`pagehide` warning (0 matches). A reload, navigation, or a global-error-trap firing discards
an unsaved workspace silently. → Debounced autosave to a reserved key on each mutation + restore on boot; at
minimum a `beforeunload` guard when `app.cards.length > 0`. `app.js` persistence layer (≈4040, 5182, 6402).

**[MED] M-APP-1 — No localStorage schema versioning/migration.** Saved blobs carry no `schemaVersion`; a future
card/chain shape change silently mis-renders or drops old saves. `app.js:4044-4090`.

**[MED] M-APP-2 — Concurrent-tab clobbering of `codex:list`.** Save/delete do read-modify-write of the index
with no `storage`-event listener → last writer wins, orphaning the other tab's `codex:ws:*` blob (invisible,
effectively lost). `app.js:4043-4096`.

**[MED] M-APP-3/4/5 — a11y: the recent modal pass is incomplete.** Modals got `role="dialog" aria-modal="true"`
but have **no focus trap** (Tab escapes to the background page, contradicting `aria-modal`) and **no focus
restoration** on close (focus drops to `<body>`, WCAG 2.4.3). Two `role="button" tabindex="0"` controls
(sidebar tradition header `app.js:4462`, card breadcrumb `app.js:5020`) have **click-only** handlers — not
keyboard-operable (no Enter/Space). *Note: M-APP-3/4/5 are the behavioral half of commit `c070d1a`'s a11y pass,
which added the ARIA attributes without the focus/keyboard behavior to honor them.*

**[MED] M-APP-6 — `undo`/`redo` `JSON.parse` unguarded** (`app.js:5202,5209`) — parses app-produced strings so
low real-world trigger, but unlike `loadWS`/`forkWS` has no try/catch; a corrupted history entry throws into
the global trap leaving the canvas partial.

**[LOW] L-APP-1 — `set.color` interpolated into an SVG `fill` without `esc()`** (`app.js:6256`) — static hex
today (not exploitable), but the one un-escaped dynamic sink; would become a hole if `FAMILY_COLORS` ever
sourced from data. Use `esc()` / validate `/^#[0-9a-f]{3,8}$/i`.

**Verified correct:** `esc()` escapes all 5 entities, null-safe, order-correct, no bypass; all user-typed
(workspace name, search, save name) and imported/stored strings escaped at every sink; toasts/confirm/recipe
bodies escaped; robust guarded `JSON.parse` everywhere except M-APP-6; lazy loader degrades to a reloadable
boot-error + 404 toast ("honest failure"); quota-exceeded handled; **no** `eval`/`Function`/`document.write`/
`javascript:`/`setAttribute('on…')`.

### 3.4 Engine — recipes correct & deterministic; **two explainer tools misreport the winner**

The *emitted recipes* are correct, deterministic, and numerically clean. The defects are in the **diagnostic
explainers** (`inspect.js`, `recipe.js --why`): they claim to show "the variant the engine actually selects"
but report a *different* winner than the recipe contains on isolated-crossRef blends — defeating their purpose
and misleading anyone debugging a selection.

**[HIGH] H-ENG-1 — `inspect.js` `✓` marks the wrong variant on isolated-part blends (missing per-part
isolation).** The fix earlier this session made `inspect.js` filter `auto:false` and apply the default
tie-break — but it still scores against the *full* merged context, not the engine's **per-part isolated**
context (`isolatedStaplesForPart`, `score.js:226` / `search.js:490`). **13 winner disagreements** across
isolated-crossRef blends, e.g. `inspect --tradition=black_metal --staples=doom --instrument=voice
--part=voice_quality` marks `lowered_larynx_voice`, but `recipe --traditions black_metal,doom --json` actually
picks `false_fold_voice`. *(This is precisely the "per-part isolation residual" flagged in that commit — now
quantified.)* `inspect.js:82,135`.

**[HIGH] H-ENG-2 — `recipe.js --why` misreports / misexplains the winner.** It scores every variant (including
the `auto:false` ones the engine can't pick) against a single full context, ranks them, and either floats a
rank-1 `auto:false` variant above the real pick or mis-attributes the real winner's low rank to pinning.
`recipe --tradition honky_tonk --why` shows three `auto:false` tract variants above the real pick
(`tract_neutral`) and prints "winner ranked 4 of 5 — likely pinned" (false — it's auto-filtering, not a pin).
**250/5350 sampled slots** misreport this way. *(This corrects an earlier in-session claim that `--why` was
sound: it does identify the recipe's pick internally, but displays and explains it misleadingly.)*
`recipe.js:309-369`.

**[MED] M-ENG-1 — blend does not dedupe a repeated tradition.** `recipe --traditions afrobeat,afrobeat` is
accepted and yields a *different* recipe than `--tradition afrobeat` (the primary is re-added as a 0.5-weight
staple, crossing token-surfacing thresholds). Dedupe `allTradIds` or reject duplicate ids alongside the
existing unknown-id check. `search.js:483`, `recipe.js:250`.

**[MED] M-ENG-2 — a part with zero auto-eligible variants is silently dropped** (no warning). Latent: 0 such
parts exist today (corroborated), so not live — but a future *required* part with all-`auto:false` variants
would vanish from the recipe invisibly. Warn in validate/build. `search.js:522-541`.

**[LOW] L-ENG-1 — non-default top-ties resolved by incidental author array-order.** The tie-break only flips
toward `default:true`; when ≥2 *non-default* variants tie at the max score, the winner is whichever appears
first in the `variants` array — **369/7816 ≈ 4.7%** of sampled slots. Fully deterministic and consistent across
all three paths, but a catalog reorder can change picks, which is exactly what the tie-break comment claims to
prevent. Add a final lexicographic-id tie-break for canonical stability. `search.js:527-536`.

**Verified correct:** **0 NaN / 0 Infinity across 500,532 variant×context score evaluations**; the only scoring
divisor is `0.5/(1+dist)` (denominator ≥1) and the neighbor cap is guarded — no divide-by-token/neighbor-count
anywhere. `_merge.js` family-parts is **single-level (no parent/extends chain)** → inheritance cycles are
structurally impossible; dangling family keys handled via `|| []`. `translate.js` degenerate inputs (empty
instruments → header-only; empty traditions → empty string; unknown id → no crash) are safe. Blend **roster is
order-independent** (set-union); header/room/archetype differing by the *primary* tradition is intended,
documented asymmetry — **not** a bug. No `Math.random`/`Date` in core; recipes byte-identical across runs;
unknown/empty id exits 2 (correct); afrobeat recipe = 990 chars (under the 1000 ceiling). No all-`auto:false`
or zero-variant parts in the live catalog.

---

## 4. Repo hygiene & process

- **[LOW]** `prettier --check` fails on **59 files** (incl. `src/app.js`, `scripts/validate.js`); CI runs
  ESLint but **not** `format:check`, so the declared formatter is unenforced and the tree is non-conformant.
- **[LOW]** Stale branches: `relaxed-newton-b56FC` and `review-fixes` are fully merged (0 ahead) — prunable;
  `genre-expansion` has 7 unmerged commits (the superseded duplicate-genre work) — confirm before deleting.
  Note: the directive branch `relaxed-newton-b56FC` is empty; active work landed on `nines-hardening`.
- **[INFO]** **Zero runtime dependencies**; `npm audit` = **0 vulnerabilities**. Supply-chain surface is the
  dev toolchain only (eslint, prettier, jsdom, playwright, sharp). Strong posture.
- **[INFO]** License is consistent: `LICENSE` = proprietary/all-rights-reserved, `package.json:"UNLICENSED"`
  (correct npm convention), `api.license` points at it. (Public repo + proprietary license is intentional.)
- **[INFO]** No open `TODO`/`FIXME`; the "bug" comments are historical regression-canary documentation (good
  institutional memory). No stray `console.log`/`debugger` in the shipped app.

---

## 5. Prioritized remediation backlog

1. **Gate the publish (H2).** Make `sync-pages` depend on a green CI run (or inline the gates + fail closed),
   and enable branch protection requiring `verify` + `freshness`. This is the single highest-leverage fix —
   it converts "CI reports" into "CI blocks."
2. **Close the two-sided gap (H1).** Add fault classes for `check_docs`/`check_doc_commands`/
   `check_doc_behaviors`; make `faults.js` registry-complete so the claim becomes true by construction.
3. **Stop the data-loss (H-APP-1).** Debounced session autosave + `beforeunload` guard.
4. **Finish the a11y pass (M-APP-3/4/5).** Focus trap + focus restore + Enter/Space on the two custom buttons —
   completes what `c070d1a` started.
4b. **Fix the engine explainers (H-ENG-1/2).** Give `inspect.js` and `recipe.js --why` the per-part isolation
   context (`isolatedStaplesForPart`) + `auto:false` filter so the tools report the recipe's *actual* winner.
5. **Data quality:** triage the 17 `voice_tradition` mis-stamps; resolve the 4 production-dead preface tokens
   (and add a `_card_descriptors`-based dead-token gate); de-dupe the 10 duplicate-token prefaces.
6. **Coverage:** widen `equivalence` beyond 9 fixtures or relabel it a spot-check; decide `audit_coherence`'s
   gate status; add a non-empty assertion to `check_doc_commands`.
7. **Hygiene:** run `prettier --write` + add `format:check` to CI (or drop the script); prune merged branches.

---

## 6. Method & limitations

Ran the full gate suite + the 16-min catalog-wide smoke locally on `ab651d2`, building fresh artifacts to a
temp dir for the reproducibility/fault gates (real tree untouched). Four parallel adversarial agents reviewed
engine, data, app, and gates/infra; data counts, determinism, and reproducibility were additionally verified
directly. **Limitation:** `reachability` (Playwright) could not run here (no Chromium) — it passed in CI run
\#73 on this commit. One engine review hit a transient rate limit and was re-run; its edge-case section is
appended separately.

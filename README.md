# Codex Music Tool

A structured catalog of recorded-music traditions in 13-dimensional parameter space,
and an engine that turns a song specification into a tightly compressed structural
**recipe** — a descriptor stack that tells you how to record it. The catalog spans
**1,112 traditions** and **418 instruments** (with per-part variant decomposition),
**256 rooms**, **22 chain archetypes**, and **120 tunings**.

The headline operation is recipe generation; the same catalog also supports tradition
blending, axis-profile matching, structural diffing, and catalog introspection. The
whole thing also builds into a single self-contained, dependency-free `codex.html`
you can open in any browser.

## Quick start

```sh
npm ci                 # install dev tooling from the lockfile
npm run build:html     # build the single-file catalog → codex.html
npm run validate       # cross-reference integrity check
npm run test           # recipe + preface + slot-pick + app-parity + equivalence regression
```

## Command surface

Every operation is an `npm run` script (see `package.json`):

| Command | What it does |
|---|---|
| `npm run build` | Canonical ship: validate → audit → regression → smoke → build HTML → UI reachability (~20 min) |
| `npm run build:fast` | Same, skipping the slow catalog-wide smoke + UI checks |
| `npm run build:html` | Just (re)build `codex.html` from `references/`, with a post-build syntax check |
| `npm run build:api` | Pre-compile every tradition into the static, server-free JSON "API" under `api/` + `llms.txt`/`sitemap.xml` |
| `npm run validate` | Reference-integrity check (fatal on broken refs, axis violations, duplicate ids) |
| `npm run check:api` | Static-API contract gate: the published `api/` honors every documented promise — complete counts, ≤1000-char recipes, every `config` id resolves |
| `npm run audit` | Data-quality audit (advisory warnings) |
| `npm run audit:coherence` | Substantive coherence audit: field-vs-field consistency (recording-era clashes, stamped vocal-tradition defaults, non-12-TET tuning contradictions) |
| `npm run test` | Regression (5 suites): recipe snapshots + preface assignments + slot-pick lock-ins + browser-app recipe parity + node↔browser equivalence |
| `npm run smoke` | Catalog-wide pipeline health across every tradition (slow) |
| `npm run tandem` | End-to-end coherence across source + HTML artifacts |
| `npm run reachability` | Drives every UI control in the built HTML (Playwright) |
| `npm run check:promises` | Promise→gate coverage: every documented promise has a gate and vice-versa (0 orphans) |
| `npm run check:fresh` | Reproducibility gate: rebuilds `api/`+`codex.html` and byte-diffs vs the committed copy <!-- @promise: artifact-reproducible --> |
| `npm run faults` | Fault-injection: plants a defect per gate-class and asserts each gate catches it <!-- @promise: gates-two-sided --> |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run ci` | `lint` + full `build` |
| `npm run assets:*` | Regenerate embedded emoji / icon / photo assets (occasional) |

## Static API (for agents & tools)

`npm run build:api` pre-compiles every tradition into plain JSON files under `api/`,
which GitHub Pages serves as-is — no server, no key, no per-call cost. An agent (or a
deep-research LLM) fetches a URL and reads the recipe:

- `api/all.json` — **every recipe in one fetch** (the universal "paste one link" payload)
- `api/index.json` — endpoint map + counts
- `api/traditions/index.json` → `api/traditions/{id}.json` — recipe + arrangement per tradition
- `api/instruments/index.json` → `api/instruments/{id}.json` — instrument data

The site root (`index.html`) is dual-purpose: human browsers redirect to the app; LLM
fetchers read an inline agent guide pointing at `api/all.json`. So one link —
the root URL — serves both audiences.

Discovery surface: root `llms.txt`, `sitemap.xml`, and `AGENTS.md` (the agent guide).
All compute happens at build time; see `scripts/build_static_api.js`.

## Repository map

- `references/` — the catalog data (`01_…`–`08_…`) plus base/vocabulary JSON. Data only.
- `src/` — the browser app (`app.js`), HTML template, and the shared family-parts merge.
- `scripts/` — build orchestration, the recipe engine, and all verification tooling.
- `tests/` — regression snapshots and fixtures.
- `SKILL.md` — the **contract**: schema, recipe pipeline, output rules, and invariants. Read this to understand or extend the catalog.

## Requirements

Node ≥ 22. The shipped `codex.html` has **zero runtime dependencies**; the dev tooling
(ESLint, Prettier, jsdom, Playwright, sharp) is declared in `package.json`.

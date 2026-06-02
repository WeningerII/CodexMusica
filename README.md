# Codex Music Tool

A structured catalog of recorded-music traditions in 13-dimensional parameter space,
and an engine that turns a song specification into a tightly compressed structural
**recipe** — a descriptor stack that tells you how to record it. The catalog spans
**1,090 traditions** and **432 instruments** (with per-part variant decomposition),
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
npm run test           # recipe + preface + slot-pick regression
```

## Command surface

Every operation is an `npm run` script (see `package.json`):

| Command | What it does |
|---|---|
| `npm run build` | Canonical ship: validate → audit → regression → smoke → build HTML → UI reachability (~20 min) |
| `npm run build:fast` | Same, skipping the slow catalog-wide smoke + UI checks |
| `npm run build:html` | Just (re)build `codex.html` from `references/`, with a post-build syntax check |
| `npm run validate` | Reference-integrity check (fatal on broken refs, axis violations, duplicate ids) |
| `npm run audit` | Data-quality audit (advisory warnings) |
| `npm run test` | Regression: recipe snapshots + preface assignments + slot-pick lock-ins |
| `npm run smoke` | Catalog-wide pipeline health across every tradition (slow) |
| `npm run tandem` | End-to-end coherence across source + HTML artifacts |
| `npm run reachability` | Drives every UI control in the built HTML (Playwright) |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run ci` | `lint` + full `build` |
| `npm run assets:*` | Regenerate embedded emoji / icon / photo assets (occasional) |

## Repository map

- `references/` — the catalog data (`01_…`–`08_…`) plus base/vocabulary JSON. Data only.
- `src/` — the browser app (`app.js`), HTML template, and the shared family-parts merge.
- `scripts/` — build orchestration, the recipe engine, and all verification tooling.
- `tests/` — regression snapshots and fixtures.
- `SKILL.md` — the **contract**: schema, recipe pipeline, output rules, and invariants. Read this to understand or extend the catalog.

## Requirements

Node ≥ 22. The shipped `codex.html` has **zero runtime dependencies**; the dev tooling
(ESLint, Prettier, jsdom, Playwright, sharp) is declared in `package.json`.

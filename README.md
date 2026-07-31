# Codex Musica

A structured catalog of recorded-music traditions in 13-dimensional parameter space,
and an engine that turns a song specification into a tightly compressed structural
**recipe** — a descriptor stack that tells you how to record it. The catalog spans
**1,167 traditions** and **870 instruments** (with per-part variant decomposition),
**256 rooms**, **84 chain archetypes**, and **120 tunings**.

The headline operation is recipe generation; the same catalog also supports tradition
blending, axis-profile matching, structural diffing, and catalog introspection. The
browser app builds into a dependency-free `codex.html` — a **lazy shell** that loads
the catalog on demand from the static `api/` served beside it, scaling past the
single-file memory ceiling. A fully-embedded single-file variant (`--embedded`) still
builds, and a gate proves the shell behaves identically to it. <!-- @promise: lazy-shell-parity -->

## Quick start

```sh
npm ci                 # install dev tooling from the lockfile
npm run build:html     # build the lazy-shell catalog app → codex.html (+ api/)
npm run validate       # cross-reference integrity check
npm run test           # recipe + preface + slot-pick + app-parity + equivalence + lazy-parity + connector-parity regression
```

## Command surface

Every operation is an `npm run` script (see `package.json`):

| Command | What it does |
|---|---|
| `npm run build` | Canonical ship: validate → audit → regression → smoke → build HTML → UI reachability (~20 min) |
| `npm run build:fast` | Same, skipping the slow catalog-wide smoke + UI checks |
| `npm run build:html` | (Re)build the lazy-shell `codex.html` from `references/` + `src/`, with a post-build syntax + no-table-leak check (`--embedded` for the self-contained single-file variant) |
| `npm run build:api` | Pre-compile every tradition into the static, server-free JSON "API" under `api/` + `llms.txt`/`sitemap.xml` |
| `npm run validate` | Reference-integrity check (fatal on broken refs, axis violations, duplicate ids) |
| `npm run check:api` | Static-API contract gate: the published `api/` honors every documented promise — complete counts, ≤1000-char recipes, every `config` id resolves |
| `npm run audit` | Data-quality audit (advisory warnings) |
| `npm run audit:coherence` | Substantive coherence audit: field-vs-field consistency (recording-era clashes, stamped vocal-tradition defaults, non-12-TET tuning contradictions) |
| `npm run test` | Regression + acceptance (7 regression suites + capability eval): recipe snapshots + preface assignments + slot-pick lock-ins + browser-app recipe parity + node↔browser equivalence + lazy-shell↔embedded parity + connector⇄app parity + black-box capability eval |
| `npm run eval` | Black-box capability acceptance eval: 28 scenarios over every CLI surface + the static API (non-empty output, ≤1000-char recipe ceiling, determinism, loud failure on bad input). Also runs as the final step of `npm run test` |
| `npm run smoke` | Catalog-wide pipeline health across every tradition (slow) |
| `npm run tandem` | End-to-end coherence across source + HTML artifacts |
| `npm run reachability` | Drives every UI control in the built HTML (Playwright) |
| `npm run check:mobile` | Mobile layout gate: on 7 viewports (360px→1280px) the layout viewport must equal the device width — no zoom-out blowout — with no horizontal overflow and every primary header control on-screen and tappable <!-- @promise: mobile-layout-usable --> |
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

Discovery surface: root `llms.txt`, `robots.txt`, `sitemap.xml`, `server.json` (the MCP
registry manifest), and `AGENTS.md` (the agent guide). All compute happens at build time;
see `scripts/build_static_api.js` and `scripts/build_discovery.js`.

## Live MCP connector

A hosted **Model Context Protocol** server (`mcp/`, deployed on Render, auto-deploys from
`main`) exposes the full *editable* engine as MCP tools — the headless twin of the browser
app: seed a recipe, then edit prefaces / variants / room / chain / tuning, add/remove
instruments and traditions, and re-render. Streamable HTTP, no auth, read-only and
deterministic.

- Endpoint: `https://codex-musica-mcp.onrender.com/mcp`
- Server card (zero-config discovery): `https://codex-musica-mcp.onrender.com/.well-known/mcp.json`
- Registry manifest: root `server.json` (publish to the official MCP registry with `mcp-publisher publish`)
- Transport, privacy, and the tool contract: see `mcp/README.md` and `mcp/PRIVACY.md`.

## Repository map

- `references/` — the catalog data (`01_…`–`08_…`) plus base/vocabulary JSON. Data only.
- `src/` — the browser app (`app.js`) and HTML template (the shared family-parts merge it inlines is authored in `scripts/_merge.js`).
- `scripts/` — build orchestration, the recipe engine, and all verification tooling.
- `tests/` — regression snapshots and fixtures.
- `SKILL.md` — the **contract**: schema, recipe pipeline, output rules, and invariants. Read this to understand or extend the catalog.

## Requirements

Node ≥ 22. The shipped `codex.html` has **zero runtime dependencies** (no framework, no
build step in the browser); as the lazy shell it loads catalog JSON from the `api/`
directory served beside it, so deploy the two together (GitHub Pages serves both from
the repo root). The dev tooling (ESLint, Prettier, jsdom, Playwright, sharp) is declared
in `package.json`.

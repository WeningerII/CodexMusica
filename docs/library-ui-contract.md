# Library UI build contract (parallel workers)

The native Library tab, built like the rest of codexmusica.com (vanilla JS, the
site's theme tokens and components), with every feature of the old Library
(`sites/library/components/library/*.tsx`, `sites/library/lib/*.ts`, the source
to port). Full spec: `docs/library-native-design.md`.

Integration branch: `claude/library-ui`. Each worker works on its own branch cut
from it (`claude/library-ui-<part>`), touches **only the files it owns**, pushes
often, and messages R2 when a piece runs. R2 merges. Nobody merges to main.

## Files and owners

| Part | Owns | Contents |
|---|---|---|
| core | `src/library/core.js` | Library router (`show(main, sub)`), the shared `lib` service (below), Explore shelves + collection cards + artwork, collections rail, topline, `#library/collections/<id>` |
| works | `src/library/works.js` | Works table (50 rows), search (Render `/search`), filters sheet, metadata sheet (`/metadata/:id`) |
| rights | `src/library/rights.js` | Sources & rights view, export panel, selection (device state), selection exports (`/exports/plan`, `/exports/p/:cid.zip`), corpus downloads (`/corpus/:sha16/:format.zip`) |
| reader | `src/library/reader.js` | `#library/read/<id>`: paper, paging (250-line pages), marks, line selection + passage actions, Summary and Sources lenses, read aloud, provenance download, Lyrics handoff (`uiOpenInLyrics(envelope)`) |
| analysis | `src/library/analysis.js` | analysis jobs (`/analyses`, `/jobs/:id…`), evidence, Sound/Form/Rhythm/Language lenses, declarations, pronunciation, method reference (`methods.json`) |
| compare | `src/library/compare.js` | compare picker + alignment (`compare-text.ts` port) |
| backend | `mcp/*`, `scripts/build_library_data.py` | #535 / #538 open findings only |

Do not edit `src/pages/library.js`, `scripts/build_html.js`, `src/app.js` or
`src/workbench.js`; ask R2 if the stub needs a change.

## How chunks work (already built)

- Every `src/library/<name>.js` is one chunk. The build wraps its body as
  `CMLibraryDefine('<name>', function () { … })`; **the body must end with
  `return { … }`** (its exports). Top-level `const`/`function` stay private.
- Any chunk gets another with `await libraryChunk('<name>')` (global from the
  stub). Load analysis and compare only when used.
- Chunks run in the page's global scope: use the site helpers (`esc`, `icon`,
  `uiButton`, `uiEmptyState`, `showToast`, `uiSubroute`, `uiOpenInLyrics`,
  `uiDownload`, `$ui`).
- CSS: each chunk inserts its own styles once:
  `if (!document.querySelector('style[data-lib="<name>"]')) document.head.insertAdjacentHTML('beforeend', '<style data-lib="<name>">…</style>')`.
  Scope every rule under `#surface-library`. Use theme tokens (`var(--cm-…)`,
  `src/theme.css`), both themes.

## Routing

`core.show(main, sub)` gets the sub-route (`''`, `'/works'`, `'/rights'`,
`'/collections/<id>'`, `'/read/<id>?offset=…&compare=…'`) and dispatches:
- `''` and `/collections/…` → core itself;
- `/works…` → `(await libraryChunk('works')).show(main, sub, lib)`;
- `/rights…` → `(await libraryChunk('rights')).show(main, sub, lib)`;
- `/read/…` → `(await libraryChunk('reader')).show(main, sub, lib)`.
Navigate with `lib.go(sub)` (pushes the hash `#library<sub>`).

## The shared `lib` service (core implements; everyone codes against it)

```js
lib.base            // static data base, LIBRARY_DATA_BASE ('library/data/')
lib.api             // 'https://mcp.codexmusica.com/library/v1'
lib.go(sub, {replace})
lib.json(path)      // fetch + parse a static file under lib.base (.json.gz decompressed); cached
lib.catalog()       // catalog.json
lib.collections()   // collections.json (rows; counts, not unit arrays)
lib.collection(id)  // c/<id>.json.gz, on demand
lib.unitPath(id)    // resolve a reading unit id to its r/<hh>/<id>/<rev>-<proj>/ head (u/<hh> shard)
lib.reading(id)     // the head file for one reading (pages fetched by the reader)
lib.artwork()       // artwork.json, lazily
lib.get(path, opts) // fetch lib.api + path, uncredentialed; JSON
lib.viewer(path, opts) // fetch lib.api + path with credentials:'include'; JSON
lib.selection       // { ids:Set, add(id), remove(id), clear(), onChange(fn) } persisted in IndexedDB 'codex-musica-library-v1'
lib.icon(name, size)
```

Static file formats: `scripts/build_library_data.py` (and the design's "Static
data" section). Backend request/response shapes: `mcp/library_routes.js`,
`mcp/library_viewer_routes.js`, `mcp/library_export_routes.js`,
`mcp/library_corpus_routes.js`.

## Checking your part

```sh
CODEX_LIBRARY=1 node scripts/build_html.js --out=/tmp/lib/codex.html --quiet
ln -sfn "$PWD/library/data" /tmp/lib/library/data   # beside the built page
node scripts/_pages_server.js /tmp/lib              # then open #library…
```
Playwright + Chromium are installed (`/opt/pw-browsers/chromium`). Render
features: test the client against the route code's shapes with a stubbed
`fetch`; the live backend is deployed later. Keep `npm run lint` clean.

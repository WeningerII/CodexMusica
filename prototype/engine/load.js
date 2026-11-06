// The prototype's recipe engine is production's own (#670 6639542176 option
// (a), R2's conditions in 6639581575, this route agreed in place of a
// committed copy).
//
// The engine lives in codex.html's <script> blocks: the page's data tables,
// the instrument-engine slots api/engine.json fills, the inlined runtime
// snippets and src/app.js. loadEngine() downloads codex.html, the page this
// prototype is served beside, ONCE AS TEXT (about 1.3 MB) and never runs its
// scripts as a page. It copies those blocks out, byte for byte and in page
// order, into one ES module whose function parameters stand in for the page
// around them, and imports that module. Nothing here re-implements the
// engine, and the repository holds no copy of it that could drift: the
// prototype always runs the engine of the codex.html it is served with.
//
// The blocks taken are every one from the first data block through
// "runtime: src/app.js", less SKIP. The head's boot scripts (theme, preloads)
// and the blocks after app.js (workbench, the pages) are the page's UI.
//
// scripts/check_prototype_engine.js runs this same file against the working
// tree's codex.html and holds every recipe to the production renderer's.

export const LAST = 'runtime: src/app.js';

// Blocks before app.js that aren't the engine. Each installs a global of its
// own (globalThis.CMLyricTokens, globalThis.CMLibraryImport) that src/app.js
// never reads, and the engine must add no global to the prototype's page.
export const SKIP = Object.freeze([
  'runtime: src/lyric-tokens.js',
  'runtime: src/library-import.js',
]);

// What the engine returns: the names the parity gates already call
// (scripts/_load_app.js EXPORTED, which check_prototype_engine.js compares
// with this list) plus the lazy page's own boot.
export const NAMES = Object.freeze([
  'Catalog',
  'Engine',
  'CATALOG_READY',
  'importTradition',
  'compileRecipeStack',
  'app',
  'reconfigureAfterPartEdit',
  'inverseConfigureForPreface',
  'suggestPrefaceForCard',
  'commitPrefaceChange',
  'addCard',
  'rmCard',
  'dupCard',
  'makeCard',
  'applyPartEdit',
  'envCardOf',
  'recordEnvPick',
  'traditionCardOpts',
  '_placeCardAfterTraditionRun',
  'image',
  'INSTRUMENT_FAMILIES',
]);

// The page around the engine. Each is a parameter of the wrapper, so the
// engine's code never reaches the prototype's window, document or storage:
// it gets inert stand-ins, in-memory storage and the fetch passed to it.
// (check_prototype_isolation.js lets this file, and only this file, name the
// two storage areas, because it names them only to shadow them.)
export const PARAMS = Object.freeze([
  'document',
  'window',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'navigator',
  'fetch',
  'addEventListener',
  'removeEventListener',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
]);

export function blocksOf(html) {
  const out = [];
  const re = /<script>\/\/ ─── (.*?) ───\n([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push({ label: m[1], code: m[2] });
  return out;
}

// The engine's blocks, in page order. Refuses a page whose shape changed,
// rather than guessing what the engine is.
export function engineBlocks(html) {
  const all = blocksOf(html);
  const count = (label) => all.filter((b) => b.label === label).length;
  if (count(LAST) !== 1) throw new Error(`codex.html has ${count(LAST)} "${LAST}" blocks, not 1`);
  for (const label of SKIP)
    if (count(label) !== 1)
      throw new Error(`codex.html has ${count(label)} "${label}" blocks to leave out, not 1`);
  const end = all.findIndex((b) => b.label === LAST);
  return all.slice(0, end + 1).filter((b) => !SKIP.includes(b.label));
}

// The ES module source for a codex.html: its engine blocks, verbatim, inside
// createEngine({ fetch }).
export function engineModule(html) {
  const body = engineBlocks(html)
    .map((b) => `// ─── ${b.label} ───\n${b.code}`)
    .join('\n;\n');
  return [
    '// The engine blocks of codex.html, copied by prototype/engine/load.js.',
    'export function createEngine(page) {',
    "  if (!page || typeof page.fetch !== 'function') throw new TypeError('createEngine needs { fetch }');",
    '  const sink = new Proxy(function () {}, {',
    "    get: (_t, p) => (p === Symbol.toPrimitive || p === 'toString' ? () => '' : sink),",
    '    apply: () => sink,',
    '    construct: () => sink,',
    '  });',
    '  const memory = () => {',
    '    const m = new Map();',
    '    return {',
    '      getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),',
    '      setItem: (k, v) => void m.set(String(k), String(v)),',
    '      removeItem: (k) => void m.delete(String(k)),',
    '      clear: () => m.clear(),',
    '      key: (i) => [...m.keys()][i] ?? null,',
    '      get length() { return m.size; },',
    '    };',
    '  };',
    "  const location = Object.freeze({ hash: '', search: '', pathname: '/codex.html', href: 'codex.html' });",
    `  return (function (${PARAMS.join(', ')}) {`,
    body,
    ';',
    `    return Object.freeze({ ${NAMES.join(', ')} });`,
    '  })(sink, sink, location, sink, memory(), memory(), sink, page.fetch, () => {}, () => {}, () => 0, () => {}, undefined);',
    '}',
    '',
  ].join('\n');
}

// What the engine may ask for: a file of the static catalog beside the page,
// as the lazy page names it (CODEX_LAZY_API is 'api/'), with at most a
// version query. Anything else is refused, so the engine's other code (the
// AI panel's chat calls among it) can't reach the network from here.
export const ENGINE_REQUEST = /^api\/[\w-]+(?:\/[\w.-]+)*\.json(?:\?v=[0-9a-f]+)?$/;

// The engine's own requests: files of the static catalog beside the page.
const engineFetch = (url, init) => {
  const rel = String(url);
  if (!ENGINE_REQUEST.test(rel) || rel.includes('..'))
    return Promise.reject(new Error(`the engine may not request ${rel}`));
  return fetch(`../${rel}`, init);
};

// In the browser: the engine of the codex.html this prototype is served
// beside, created once. Its page tables and the functions that read only
// them (image(), INSTRUMENT_FAMILIES) work at once; the catalog and the
// instrument data follow as the lazy page's do. A failure is forgotten, so a
// retry asks again.
let created = null;
export function pageEngine() {
  if (!created)
    created = fetch('../codex.html')
      .then((res) => {
        if (!res.ok) throw new Error(`codex.html did not load (${res.status})`);
        return res.text();
      })
      .then(async (html) => {
        const href = URL.createObjectURL(
          new Blob([engineModule(html)], { type: 'text/javascript' })
        );
        try {
          return (await import(href)).createEngine({ fetch: engineFetch });
        } finally {
          URL.revokeObjectURL(href);
        }
      })
      .catch((e) => {
        created = null;
        throw e;
      });
  return created;
}

// The engine, booted the way the lazy page boots: resolves once its catalog
// and instrument data are in.
export async function loadEngine() {
  const engine = await pageEngine();
  await engine.CATALOG_READY;
  await engine.Engine.ensure();
  return engine;
}

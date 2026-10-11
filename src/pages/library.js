/* exported CMLibraryDefine */
/* global $ui, UI, esc, uiButton, uiEmptyState, uiRegisterPage, uiSubroute */
'use strict';
// ─── Library page: the inline stub (docs/library-native-design.md) ───────────
// Ships only in a CODEX_LIBRARY build until cutover. It registers the page,
// draws the static skeleton and loads the chunks that do the work
// (src/library/*.js); it fetches no data itself and touches no lazy-only
// global, so its skeleton is the same in the lazy and embedded builds.
//
// Chunks. The build wraps each src/library/<name>.js as
// CMLibraryDefine('<name>', function () { … }) and, in the lazy build, writes
// it to library/code/<name>.<sha256-10>.js with an sha384 integrity entry in
// LIBRARY_CHUNKS; the embedded build inlines the same text as passive blocks,
// which the loader prefers. A factory runs once, on first use.

// Replaced by the build: { name: [url, 'sha384-…'] }.
const LIBRARY_CHUNKS = 'LIBRARY_CHUNKS';
const LIBRARY_CODE = { defined: {}, pending: {}, loaded: {} };
const LIBRARY = { sub: '', failure: null };

function CMLibraryDefine(name, factory) {
  if (!LIBRARY_CODE.defined[name]) LIBRARY_CODE.defined[name] = factory;
}

// A chunk's exports. A failed load is forgotten, so Reload or a later visit
// asks again; an integrity failure is a failed load (the browser refuses it).
function libraryChunk(name) {
  if (LIBRARY_CODE.loaded[name]) return Promise.resolve(LIBRARY_CODE.loaded[name]);
  if (!LIBRARY_CODE.pending[name])
    LIBRARY_CODE.pending[name] = new Promise((resolve, reject) => {
      const run = () => {
        LIBRARY_CODE.loaded[name] = LIBRARY_CODE.defined[name]();
        resolve(LIBRARY_CODE.loaded[name]);
      };
      if (LIBRARY_CODE.defined[name]) return run();
      const entry = LIBRARY_CHUNKS[name];
      if (!entry) return reject(Error('Unknown Library chunk: ' + name));
      const script = document.createElement('script');
      script.src = entry[0];
      script.integrity = entry[1];
      script.crossOrigin = 'anonymous';
      script.onload = () =>
        LIBRARY_CODE.defined[name] ? run() : reject(Error('Library chunk not defined: ' + name));
      script.onerror = () => reject(Error('Library chunk failed to load: ' + name));
      document.head.append(script);
    }).catch((error) => {
      delete LIBRARY_CODE.pending[name];
      throw error;
    });
  return LIBRARY_CODE.pending[name];
}

const libraryMain = () => $ui('library-main');

async function libraryShow() {
  const main = libraryMain();
  if (!main) return;
  if (!/^https?:$/.test(location.protocol) && !LIBRARY_CODE.defined.core) {
    main.innerHTML = uiEmptyState({
      title: 'The Library reads its catalog from codexmusica.com',
      text: 'Open codexmusica.com/codex.html#library to browse it.',
    });
    return;
  }
  try {
    const core = await libraryChunk('core');
    if (UI.view !== 'library') return;
    LIBRARY.failure = null;
    core.show(main, LIBRARY.sub);
  } catch (error) {
    LIBRARY.failure = error;
    console.error('[library]', error);
    main.innerHTML = uiEmptyState({
      title: 'The site was updated',
      text: 'Reload to get the current Library.',
      actions: uiButton('lib-reload', 'Reload', 'refresh-cw'),
      tone: 'danger',
    });
  }
}

uiRegisterPage({
  id: 'library',
  recipe: 'sidebar',
  mount(surface) {
    surface.innerHTML = `<div class="lib-shell"><div class="lib-bar" role="tablist" aria-label="Library sections">${[
      ['', 'Explore'],
      ['/works', 'Works'],
      ['/rights', 'Sources & rights'],
    ]
      .map(
        ([sub, label], i) =>
          `<button type="button" class="cm-tab" role="tab" data-ui="lib-section" data-id="${sub}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(label)}</button>`
      )
      .join(
        ''
      )}</div><div id="library-main" class="lib-main" aria-live="polite"><div class="lib-skeleton" aria-hidden="true"></div><div class="lib-skeleton" aria-hidden="true"></div></div></div>`;
  },
  route(sub, { pop }) {
    LIBRARY.sub = sub;
    if (pop) libraryShow();
  },
  currentRoute: () => LIBRARY.sub,
  render: libraryShow,
  actions: {
    'lib-section': (id) => {
      LIBRARY.sub = id;
      uiSubroute(id, { push: true });
      libraryShow();
    },
    'lib-reload': () => location.reload(),
  },
});

/* exported CMLibraryDefine, libraryAnnounce */
/* global $ui, UI, esc, uiButton, uiEmptyState, uiEnsureWorkspace, uiRegisterPage, uiSubroute, uiTabIndex */
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

// Replaced by the build: { name: [url, 'sha384-…'] }, and the static data
// base (never CODEX_LAZY_API).
const LIBRARY_CHUNKS = 'LIBRARY_CHUNKS';
const LIBRARY_DATA_BASE = 'LIBRARY_DATA_BASE';
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

// The section tabs follow the route: the selected tab is the sub-route's
// first segment ('' Explore, '/works', '/rights'), and only it is in the tab
// order (WAI-ARIA tabs; arrows, Home and End move between them).
function librarySelectTab() {
  const section = /^\/[^/?]*/.exec(LIBRARY.sub)?.[0] || '';
  document.querySelectorAll('#surface-library [data-ui="lib-section"]').forEach((b) => {
    const on = b.dataset.id === section;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
}
function libraryTabKeys(e) {
  const tab = e.target.closest?.('#surface-library [role="tab"]');
  if (!tab) return;
  const tabs = [...tab.parentElement.querySelectorAll('[role="tab"]')];
  const i = uiTabIndex(e.key, tabs.indexOf(tab), tabs.length);
  if (i < 0) return;
  e.preventDefault();
  tabs[i].click();
  tabs[i].focus();
}

// The Library's one polite live region. It sits outside #library-main, so a
// re-render never reads the page aloud; views send it short status lines
// ("2 lines selected"). Cleared first so the same line twice is read twice.
function libraryAnnounce(text) {
  const live = $ui('library-live');
  if (!live) return;
  live.textContent = '';
  if (text) setTimeout(() => (live.textContent = text), 50);
}
async function libraryShow() {
  // A new section can await its chunk while Works is still connected.
  // Retire its pending query at navigation intent, before any loading await.
  if (!/^\/works(?:[/?]|$)/.test(LIBRARY.sub)) LIBRARY_CODE.loaded.works?.leave?.();
  librarySelectTab();
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
    libraryWorkspaceAtIdle();
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

// The workspace (boot index, then the engine only if a session needs it) is
// booted at idle after the Library has drawn, never before it (src/app.js
// uiEnsureWorkspace). A background failure is left for the first workspace
// control or page that needs it, which asks again and reports.
function libraryWorkspaceAtIdle() {
  const boot = () => uiEnsureWorkspace().catch((e) => console.warn('[library] workspace', e));
  if (window.requestIdleCallback) requestIdleCallback(boot, { timeout: 5000 });
  else setTimeout(boot, 1);
}

uiRegisterPage({
  id: 'library',
  recipe: 'sidebar',
  // A deferred boot keeps the engine back while this page is shown.
  holdsEngine: true,
  mount(surface) {
    surface.innerHTML = `<div class="lib-shell"><h1 class="sr-only">Library</h1><div class="lib-bar" role="tablist" aria-label="Library sections">${[
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
      )}</div><div id="library-main" class="lib-main"><div class="lib-skeleton" aria-hidden="true"></div><div class="lib-skeleton" aria-hidden="true"></div></div><div id="library-live" class="lib-live" role="status" aria-live="polite"></div></div>`;
    surface.querySelector('.lib-bar').addEventListener('keydown', libraryTabKeys);
  },
  route(sub, { pop }) {
    LIBRARY.sub = sub;
    if (pop) libraryShow();
  },
  currentRoute: () => LIBRARY.sub,
  render: libraryShow,
  leave() {
    // Top-level tabs hide the connected Works view; its pending query must
    // not commit into the destination page's URL or survive a quick return.
    LIBRARY_CODE.loaded.works?.leave?.();
  },
  actions: {
    'lib-section': (id) => {
      LIBRARY.sub = id;
      uiSubroute(id, { push: true });
      libraryShow();
    },
    'lib-reload': () => location.reload(),
  },
});

// A pointer entering the Library nav entry (pointerenter only, not focus)
// asks the browser to prefetch the core chunk and catalog.json, so the click
// finds them cached; nothing runs until the click. Once, over http(s) only,
// and not after the tab has loaded the Library.
function libraryHover(event) {
  if (!event.target.matches?.('button[data-view="library"]')) return;
  document.removeEventListener('pointerenter', libraryHover, true);
  // A tab that has already visited has both; asking again would refetch.
  if (!/^https?:$/.test(location.protocol) || LIBRARY_CODE.pending.core) return;
  for (const href of [LIBRARY_CHUNKS.core?.[0], LIBRARY_DATA_BASE + 'catalog.json']) {
    if (!href) continue;
    const link = document.createElement('link');
    link.setAttribute('rel', 'prefetch');
    link.setAttribute('href', href);
    link.setAttribute('crossorigin', 'anonymous');
    document.head.append(link);
  }
}
// pointerenter does not bubble; a capturing listener on the document sees it.
document.addEventListener('pointerenter', libraryHover, true);

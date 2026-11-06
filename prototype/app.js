// The prototype shell (#670 slices P0 and P2): route switching between six
// panels, the persistent "Your recipe" region, an honest storage status, and
// the feature hosts. Feature content lives in prototype/features/<lane>/;
// the shell mounts it through host.js.
//
// The catalog comes only from the committed static JSON beside the site
// (../api/). There is no call to the connector, /chat or any model provider.

import { read, write, scope } from './storage.js';
import { createHost, createOnDemand, announce } from './host.js';
import {
  loadItems,
  loadLibrary,
  collectionFile,
  loadLibraryCredits,
  loadMethodRegistry,
  genreLoader,
  instrumentLoader,
  readingLoader,
  readingLines,
  loadGenreDiscovery,
  loadGenreInstruments,
} from './data.js';
import { genreDiscovery, countOf } from './discovery.js';
import { recipeStore } from './recipe-store.js';
import { loadEngine } from './engine/load.js';
import { media, speechAdapter } from './adapters.js';
import { genre, instrument } from './selection.js';

const ROUTES = ['browse', 'genre', 'instrument', 'map', 'lyrics', 'library'];
const DEFAULT_ROUTE = 'browse';

// The shell's own lasting state (storage refused) has its own visible line,
// so a lane's announcement in the shared status region can't erase it.
const savedLine = document.getElementById('proto-saved');

function routeFromHash() {
  const id = decodeURIComponent(location.hash.replace(/^#/, ''));
  return ROUTES.includes(id) ? id : null;
}

// The lane registry: route → lane. Each import is a literal path, so the
// gate can check where feature code may come from. A lane's file not being
// in this build is a stated state, not an error (host.js). A lane that closes
// itself (a sheet or a dialog: its Close button, Escape) adds closable: true,
// and only its ctx then carries close() (host.js, #665 B0). None does yet.
const draft = scope('host');
let draftUnsaved = false;
const LANES = {
  browse: {
    id: 'browse',
    label: 'Browse',
    load: () => import('./features/browse-map/discovery.js'),
    unloaded: 'The catalog did not load, so Browse can’t show any traditions yet.',
    context: async () => ({ items: await loadItems() }),
  },
  lyrics: {
    id: 'lyrics',
    label: 'The Lyrics editor',
    load: () => import('./features/lyrics/editor.js'),
    unloaded: 'The Lyrics editor couldn’t start.',
    // The draft is the shell's to keep, under its own key, so the lane's
    // storage scope is the lane's alone. onChange is called with the exact
    // raw text after each committed edit (6639542176 §2).
    context: async () => {
      const saved = draft.read('lyrics-draft');
      return {
        text: saved.ok && typeof saved.value === 'string' ? saved.value : '',
        onChange(text) {
          const r = draft.write('lyrics-draft', String(text));
          if (r.ok === draftUnsaved) {
            draftUnsaved = !r.ok;
            announce(
              r.ok
                ? 'The draft is saved in this browser again.'
                : 'Not saved: this browser would not store the draft. It is still here in this tab.'
            );
          }
        },
      };
    },
  },
};
// The reader (#757) and its read-aloud (#758): one reading at a time,
// mounted where openReading is called, with the unit fixed in its ctx (#668
// 6646411306). Read-aloud follows the text, over the whole verified reading,
// and is granted autoplay once when Play opened it, as production's ?play=1.
// The two are on-demand lanes (host.js createOnDemand): opening a reading
// replaces the one open, and focus goes into the reader.
const readings = readingLoader();
const reader = createOnDemand(document.querySelector('[data-panel="library"]'));
async function openReader(unitId, { play = false } = {}) {
  await reader.open([
    {
      id: 'libraryreading',
      label: 'The reader',
      load: () => import('./features/library-reading/text-view.js'),
      unloaded: 'The reading did not load.',
      context: async () => ({ unitId, reading: readings.reading }),
    },
    {
      id: 'libraryspeech',
      label: 'Read aloud',
      load: () => import('./features/library-speech/controls.js'),
      unloaded: 'Read aloud did not load.',
      context: async () => {
        const record = await readings.reading(unitId);
        return {
          language: record.head.language,
          lines: await readingLines(record),
          speech: speechAdapter({ autoplay: play }),
        };
      },
    },
  ]);
}

// The Library lane's ctx (#670 6639673247, 6640163315, 6640718497). It has
// no recipe object, by construction (Rule 1). The prototype has no collection
// page and no reader yet, so the two navigation calls say so instead of
// routing; openReading still resolves the unit as production's Play does.
async function libraryContext() {
  const lib = await loadLibrary();
  const ids = new Map(); // collection → its readable unit ids, once fetched
  const selected = new Set(); // reading unit ids, this tab only
  const listeners = new Set();
  const idsOf = async (cid) => {
    if (!ids.has(cid)) {
      const file = await collectionFile(cid);
      ids.set(cid, file.readable_ids || []);
    }
    return ids.get(cid);
  };
  const selection = Object.freeze({
    state(cid) {
      const list = ids.get(cid) || [];
      const n = list.filter((id) => selected.has(id)).length;
      return !n ? 'none' : n === list.length ? 'all' : 'some';
    },
    async toggle(cid) {
      const list = await idsOf(cid);
      const all = list.length && list.every((id) => selected.has(id));
      for (const id of list) {
        if (all) selected.delete(id);
        else selected.add(id);
      }
      for (const fn of listeners) fn(cid);
      return selection.state(cid);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  });
  return {
    shelves: lib.shelves,
    loadMore: lib.loadMore,
    selection,
    openCollection() {
      announce('Collection pages aren’t part of this prototype yet.');
    },
    // Production's Play: resolve the collection's first readable unit, then
    // open it. The prototype has no reading route, so the reader opens in the
    // Library panel, below the lanes, and replaces any reading already open.
    async openReading(cid) {
      const unitId = await lib.unitOf(cid);
      await openReader(unitId, { play: true });
      return { unitId };
    },
    showCredit(artworkId) {
      const a = lib.art.get(artworkId);
      announce(a ? a.credit : 'No credit is recorded for this artwork.');
    },
  };
}
LANES.library = {
  id: 'library',
  label: 'The Library',
  load: () => import('./features/library/explore.js'),
  unloaded: 'The Library’s collections did not load, so there is nothing to show yet.',
  context: libraryContext,
};

// The Genre detail lane (#668 6645589522, 6645704407): the header and the
// Background of the genre the person opened. Until Browse can open one,
// genre.set() is the shell's (and its tests'). The photo viewer (#748) isn't
// in this build, so openPhoto says so and puts focus back.
const genres = genreLoader();
LANES.genre = {
  id: 'genredetail',
  label: 'The genre detail page',
  load: () => import('./features/genre-detail/detail.js'),
  unloaded: 'The genre detail page did not load.',
  context: async () => ({
    genre: Object.freeze({ current: genre.current, subscribe: genre.subscribe }),
    loadGenre: genres.loadGenre,
    media,
    openPhoto(photo, { returnFocus } = {}) {
      announce('The photo viewer isn’t part of this build of the prototype yet.');
      if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
    },
  }),
};

// The Instrument detail lane (#668 6646057912): production's inspector
// header for the instrument the person opened. As for Genre, instrument.set()
// is the shell's until Browse can open one.
const instruments = instrumentLoader();
LANES.instrument = {
  id: 'instrumentdetail',
  label: 'The instrument detail page',
  load: () => import('./features/instrument-detail/detail.js'),
  unloaded: 'The instrument detail page did not load.',
  context: async () => ({
    instrument: Object.freeze({ current: instrument.current, subscribe: instrument.subscribe }),
    loadInstrument: instruments.loadInstrument,
    media,
    openPhoto(photo, { returnFocus } = {}) {
      announce('The photo viewer isn’t part of this build of the prototype yet.');
      if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
    },
  }),
};

// The Genre page's discovery (#668 6665493327): Categories (rows 163–165)
// and Find a sound (rows 166–169, 171) read one store, so a count equals its
// list and a target narrows the same results. The ranked results are the
// shell's; until the list lane arrives, the shell shows their count line,
// which takes focus after a branch or a match that finds nothing.
const discovery = genreDiscovery({
  load: loadGenreDiscovery,
  select: (id) => genre.set(id),
  announce,
});
const discoveryLanes = [
  {
    id: 'genrecategories',
    label: 'The genre categories',
    load: () => import('./features/genre-categories/categories.js'),
    unloaded: 'The genre categories did not load.',
    // Not "check your connection": the discovery load also fails on the
    // engine's page parse, which no connection fixes (Jony, #810 6673521152).
    retryHint: 'Try again.',
    context: async () => {
      await discovery.start();
      if (discovery.categories.current().status !== 'ready') throw new Error('not ready');
      return {
        categories: discovery.categories,
        discovery: discovery.discovery,
        targets: Object.freeze({
          current: discovery.targets.current,
          subscribe: discovery.targets.subscribe,
        }),
      };
    },
  },
  {
    id: 'genretargets',
    label: 'Find a sound',
    load: () => import('./features/genre-targets/targets.js'),
    unloaded: 'Find a sound did not load.',
    retryHint: 'Try again.',
    context: async () => {
      await discovery.start();
      if (discovery.targets.current().status !== 'ready') throw new Error('not ready');
      return { targets: discovery.targets, discovery: discovery.discovery };
    },
  },
];

// The shared recipe store (#670 P2 step 5): the one "Your recipe" and the one
// instrument preview, on the page engine's own workspace. It starts when a
// lane that needs it is first shown (its context() awaits recipe.start()),
// or on a genre's Add; a lane gets recipe.port([...]) or one of
// recipe.preview's views, never the store.
const recipe = recipeStore({ load: loadEngine, selection: instrument, announce });

// Opens an instrument (#668 6647387849): the shell's selection, then the
// Instrument route, whose heading takes focus. A lane passes returnFocus, the
// control that asked; the Instrument page's way back isn't in this build, so
// nothing reads it yet.
function openInstrument(id) {
  instrument.set(id);
  if (routeFromHash() !== 'instrument') location.hash = '#instrument';
}

// "Your recipe" (index.html's aside): until the dock (row 209) arrives, one
// line written from the store's snapshot on every change. Reading the
// snapshot doesn't start the store, and nothing can be added before it
// starts, so the line is never false.
const recipeLine = document.querySelector('aside.recipe > p:not(.catalog)');
const shellRecipe = recipe.port(['snapshot', 'subscribe']);
const writeRecipeLine = () => {
  const s = shellRecipe.snapshot();
  const n = s.status === 'ready' ? s.cards.length : 0;
  recipeLine.textContent = n
    ? `${countOf(n, 'instrument')} in Your recipe.`
    : 'No instruments yet.';
};
shellRecipe.subscribe(writeRecipeLine);
writeRecipeLine();

// More lanes in a panel, after its first, in this order (#668 6643233628).
const MORE = {
  // The genre's instruments (#770, rows 172–173; #668 6647387849), after the
  // detail: its roster, and Add for one instrument or the whole ensemble,
  // through ctx.recipe. Its context waits for the recipe store.
  genre: [
    {
      id: 'genreinstruments',
      label: 'The genre’s instruments',
      load: () => import('./features/genre-instruments/instruments.js'),
      unloaded: 'The genre’s instruments did not load.',
      // As for the discovery lanes: the store's load also fails on the
      // engine's page parse, which no connection fixes.
      retryHint: 'Try again.',
      context: async () => {
        await recipe.start();
        if (recipe.status() !== 'ready') throw new Error('not ready');
        return {
          genre: Object.freeze({ current: genre.current, subscribe: genre.subscribe }),
          loadGenreInstruments,
          openInstrument,
          recipe: recipe.port(['addEnsemble', 'addInstrument', 'snapshot', 'subscribe']),
        };
      },
    },
  ],
  library: [
    {
      id: 'librarycredits',
      label: 'The sources and credits',
      load: () => import('./features/library-rights/census-credits.js'),
      unloaded: 'The Library’s sources and credits did not load.',
      context: async () => ({
        ...(await loadLibraryCredits()),
        // The prototype has no Works list yet; say so, as openCollection does.
        inspectAll() {
          announce('The full Works list isn’t part of this prototype yet.');
        },
      }),
    },
    {
      id: 'librarymethods',
      label: 'The method reference',
      load: () => import('./features/library-methods/reference.js'),
      unloaded: 'The Library’s method reference did not load.',
      context: loadMethodRegistry,
    },
  ],
};

// Genre: the discovery lanes first, then the detail (#668 6665493327).
const FIRST = { genre: discoveryLanes };

const hosts = {};
for (const [route, lane] of Object.entries(LANES)) {
  const panel = document.querySelector(`[data-panel="${route}"]`);
  hosts[route] = [...(FIRST[route] || []), lane, ...(MORE[route] || [])].map((l) =>
    createHost(l, panel)
  );
}

// The results count line (production's #gp-count): the shell's own node,
// rewritten from the store. It heads the results, as #gp-count does: right
// after Find a sound and before the Genre detail, so the focus it takes after
// a branch or a match lands beside what it describes (Jony, #810
// 6673521152). The hosts go into the panel when the route is shown, so
// show() moves the line there each time (placeCount).
const genrePanel = document.querySelector('[data-panel="genre"]');
const countLine = document.createElement('p');
countLine.className = 'proto-count';
countLine.dataset.genreCount = '';
countLine.tabIndex = -1;
genrePanel.append(countLine);
const placeCount = () => {
  const targetsHost = genrePanel.querySelector('[data-feature-host="genretargets"]');
  if (targetsHost && targetsHost.nextElementSibling !== countLine) targetsHost.after(countLine);
};
discovery.results.subscribe((r) => {
  countLine.textContent = r.status === 'ready' ? r.line : '';
});
discovery.setFocusCount(() => countLine.focus());
// clear's last resort (#668 6665493327 B): the Categories lane's toggle.
discovery.setFocusToggle(() => focusDisclosureToggle());
// Below production's discovery breakpoint, Categories and Find a sound sit
// behind the Categories lane's disclosure: that lane hides its own list, and
// the shell hides Find a sound until it is open. Production's rule is
// `@container discovery (max-width: 720px)` (src/pages/genre.css, on
// #discovery); the 900px in genre.js's comments is stale (#668 6665850534).
// The panel stands in for #discovery, and max-width is inclusive.
const NARROW = 720;
// The Find a sound host's id, which the Categories toggle names in its
// aria-controls beside its own list's id (#668 6665716865).
const TARGETS_HOST_ID = 'proto-genre-targets';
const focusDisclosureToggle = () => {
  const t = genrePanel.querySelector(
    '[data-feature-host="genrecategories"] [data-discovery-toggle]'
  );
  if (t) t.focus();
};
const syncDisclosure = () => {
  const d = discovery.discovery.current();
  const targetsHost = genrePanel.querySelector('[data-feature-host="genretargets"]');
  if (!targetsHost) return;
  targetsHost.id = TARGETS_HOST_ID;
  const hide = d.narrow && !d.open;
  // Hiding the host that holds focus would drop it on the page: it goes to
  // the toggle that brings the host back.
  if (hide && targetsHost.contains(document.activeElement)) focusDisclosureToggle();
  targetsHost.hidden = hide;
};
discovery.discovery.subscribe(syncDisclosure);
new ResizeObserver(() => {
  discovery.setNarrow(genrePanel.clientWidth > 0 && genrePanel.clientWidth <= NARROW);
  syncDisclosure();
}).observe(genrePanel);
// Escape is the page's, as production's genre escape(): it closes the open
// disclosure and puts focus on its toggle. (The tree modal and a pinned
// detail, which production closes first, aren't in this build.)
genrePanel.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  const d = discovery.discovery.current();
  if (!(d.narrow && d.open)) return;
  e.preventDefault();
  discovery.discovery.setOpen(false, d.revision).then(focusDisclosureToggle);
});

function show(route, { moveFocus }) {
  for (const panel of document.querySelectorAll('[data-panel]')) {
    panel.hidden = panel.dataset.panel !== route;
  }
  for (const link of document.querySelectorAll('[data-route]')) {
    if (link.dataset.route === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  document.title = `${route[0].toUpperCase()}${route.slice(1)} · Codex Musica prototype`;
  // A route change the user asked for moves focus to the new panel's heading,
  // so the next Tab lands inside it. The first paint does not take focus.
  if (moveFocus) document.querySelector(`[data-panel="${route}"] h1`).focus();
  for (const h of hosts[route] || []) h.show();
  if (route === 'genre') placeCount();
  const saved = write('route', route);
  if (!saved.ok && !savedLine.textContent) {
    savedLine.textContent =
      'Not saved: this browser would not store the prototype’s settings. It still works in this tab.';
    announce(savedLine.textContent);
  }
}

window.addEventListener('hashchange', () => {
  const route = routeFromHash();
  if (route) show(route, { moveFocus: true });
});

const stored = read('route');
const initial =
  routeFromHash() || (stored.ok && ROUTES.includes(stored.value) ? stored.value : DEFAULT_ROUTE);
show(initial, { moveFocus: false });

const catalog = document.getElementById('proto-catalog');
fetch('../api/index.json')
  .then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  })
  .then((idx) => {
    const c = idx.counts || {};
    catalog.textContent = `Catalog: ${c.traditions} traditions, ${c.instruments} instruments.`;
  })
  .catch(() => {
    catalog.textContent = 'The catalog did not load, so nothing can be added yet.';
  });

// The discovery and recipe stores, for the host gate
// (check_prototype_hosts.js), which reads the shell's ranked rows and holds
// the recipe store to production; lanes get only their ctx.
export { discovery, recipe };

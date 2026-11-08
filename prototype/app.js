// The prototype shell (#670 slices P0 and P2): route switching between six
// panels, the persistent "Your recipe" region, an honest storage status, and
// the feature hosts. Feature content lives in prototype/features/<lane>/;
// the shell mounts it through host.js.
//
// The catalog comes only from the committed static JSON beside the site
// (../api/). There is no call to the connector, /chat or any model provider.

import { read, write, scope } from './storage.js';
import { createHost, createOnDemand, announce, untilAborted } from './host.js';
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
import { detailPanels } from './detail-panels.js';
import { media, overlay, speechAdapter } from './adapters.js';
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

// What a lane listens to through its ctx ends with its mount (#810
// 6682309672): the view it is handed, with its subscribe (or, given `key`,
// that method) bound by host.js's untilAborted to the signal the host passed
// the lane's context(). A listener the lane keeps past its unmount stops
// hearing at the abort, whatever the lane does, and one added after it is
// never added.
const ending = (signal, view, key = 'subscribe') =>
  Object.freeze({ ...view, [key]: untilAborted(view[key], signal) });

// Read-aloud's speech ends with its mount as well (#810, the review of
// 6682309672's fixes): its voices through ending, and at the abort every
// utterance the lane started and the device hasn't finished is cancelled,
// the queued ones first so none of them starts, and no onend or onerror
// reaches the lane after it. A speak() after the abort is refused (ENDED).
const speaking = (signal, speech) => {
  const live = new Set();
  signal.addEventListener(
    'abort',
    () => {
      for (const h of [...live].reverse()) h.cancel();
      live.clear();
    },
    { once: true }
  );
  return Object.freeze({
    ...ending(signal, speech, 'subscribeVoices'),
    speak(text, opts) {
      if (signal.aborted)
        throw Object.assign(new Error('Read aloud has ended.'), { code: 'ENDED' });
      const o = opts || {};
      let handle;
      const done = (fn) => (arg) => {
        live.delete(handle);
        if (!signal.aborted && typeof fn === 'function') fn(arg);
      };
      handle = speech.speak(text, { ...o, onend: done(o.onend), onerror: done(o.onerror) });
      live.add(handle);
      return Object.freeze({
        cancel() {
          live.delete(handle);
          handle.cancel();
        },
      });
    },
  });
};

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
//
// The reading that was open ends first, by the slot's own close(). If its
// lanes' unmount() throws, each lane still ends (host.js), and the error is
// the shell's own: it is logged, and the new reading still opens and
// resolves, because the person's request succeeded (#810 6677708921). When
// both lanes throw, the slot hands back one AggregateError, and each lane's
// error is logged on its own, so neither hides the other. So open() has
// nothing left to end, and if it rejects, the error is the new reading's own
// and comes back to the caller.
//
// A new reading that can't start (the reader's or read-aloud's module
// doesn't load, its context() fails or its mount() throws) is the slot's to
// state (host.js createOnDemand; #810, Don's reply to 6683384760). The panel
// shows the lane's sentence. The reader's is told once read-aloud is shown:
// focus goes to its Retry, else to the sentence, if it is still on Play or
// nowhere, and the sentence is said once, unless focus is on it (focusing it
// reads it). Read-aloud's, beside a reader that opened
// with focus in it, is said once and last, after what the reader says as it
// opens ("Page 1 of 7"): once the reader's own ctx.reading() has settled and
// the task it settled in has ended (readerSaid), with focus left in the
// reader. openReading doesn't wait for that: Play is busy until it resolves,
// and the reader's reading is a fetch with no time limit. Only one sentence
// is said. Beside a reader that couldn't start,
// read-aloud isn't granted Play's autoplay (readerStarted): it would read a
// work the person can't see, and what it says would replace the reader's
// sentence. openReading still resolves { unitId }: the unit was found and
// the reading opened, and what didn't start says so itself, as a lane that
// can't start on its own route does. A rejection keeps the meaning above: the
// open itself failed, while a teardown's error, or several in one
// AggregateError, is logged and not said. So Explore, which says only a
// rejection (explore.js:85-88), says nothing here, and the shell's sentence
// is the only one.
//
// Each open is opened from `opener`, what had focus when the person asked
// (Play, from openReading), not from what has focus once the unit is found:
// the person may move focus while the unit is looked up, before the open
// begins, and a reading that can't start must know whether they did. So
// openReader uses the slot through `reader`, whose open() passes that opener
// as returnFocus. Without one, open() takes what has focus when it begins.
const readings = readingLoader();
const slot = createOnDemand(document.querySelector('[data-panel="library"]'));
// Whether the reader's host holds no sentence of its own: by the time
// read-aloud's context is asked for, the reader has been shown, and a reader
// that couldn't start (or is trying again) shows one instead of itself.
const readerStarted = () =>
  !document.querySelector(
    '[data-panel="library"] [data-feature-host="libraryreading"] [data-host-note]'
  );
async function openReader(unitId, { play = false, opener } = {}) {
  // The reader's last ctx.reading(), settled either way: the reader says its
  // page (or its failure) in the microtasks that follow, so the task after it
  // comes once that has been said.
  let read = Promise.resolve();
  const readerReading = (...args) => (read = readings.reading(...args));
  const readerSaid = () => read.catch(() => {}).then(() => new Promise((r) => setTimeout(r)));
  const reader = {
    close: () => slot.close(),
    open: (lanes) => slot.open(lanes, { returnFocus: opener, settled: readerSaid }),
  };
  try {
    reader.close();
  } catch (error) {
    for (const e of error instanceof AggregateError ? error.errors : [error]) {
      console.warn('[prototype] The reading that was open did not end cleanly:', e);
    }
  }
  await reader.open([
    {
      id: 'libraryreading',
      label: 'The reader',
      load: () => import('./features/library-reading/text-view.js'),
      unloaded: 'The reading did not load.',
      context: async () => ({ unitId, reading: readerReading }),
    },
    {
      id: 'libraryspeech',
      label: 'Read aloud',
      load: () => import('./features/library-speech/controls.js'),
      unloaded: 'Read aloud did not load.',
      context: async ({ signal }) => {
        const record = await readings.reading(unitId);
        if (!readerStarted()) play = false; // Play's autoplay, only beside the reader
        return {
          language: record.head.language,
          lines: await readingLines(record),
          speech: speaking(signal, speechAdapter({ autoplay: play })),
        };
      },
    },
  ]);
}

// The Library lane's ctx (#670 6639673247, 6640163315, 6640718497). It has
// no recipe object, by construction (Rule 1). The prototype has no collection
// page and no reader yet, so the two navigation calls say so instead of
// routing; openReading still resolves the unit as production's Play does.
async function libraryContext({ signal }) {
  const lib = await loadLibrary();
  const ids = new Map(); // collection → its readable unit ids, once fetched
  const selected = new Set(); // reading unit ids, this tab only
  const listeners = new Set();
  let plays = 0; // openReading's calls, so that only the latest one opens
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
    selection: ending(signal, selection),
    openCollection() {
      announce('Collection pages aren’t part of this prototype yet.');
    },
    // Production's Play: resolve the collection's first readable unit, then
    // open it. The prototype has no reading route, so the reader opens in the
    // Library panel, below the lanes, and replaces any reading already open.
    // Only the latest Play opens (#810): an earlier one whose look-up (an
    // appended card's collection file) finishes later resolves its unit and
    // opens nothing, so it can't replace the reading asked for after it.
    async openReading(cid) {
      const mine = ++plays;
      const opener = document.activeElement; // Play, before the look-up
      const unitId = await lib.unitOf(cid);
      if (mine !== plays) return { unitId }; // a later Play opens instead
      await openReader(unitId, { play: true, opener });
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
  context: async ({ signal }) => ({
    genre: ending(signal, { current: genre.current, subscribe: genre.subscribe }),
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
  context: async ({ signal }) => ({
    instrument: ending(signal, { current: instrument.current, subscribe: instrument.subscribe }),
    loadInstrument: instruments.loadInstrument,
    media,
    openPhoto(photo, { returnFocus } = {}) {
      announce('The photo viewer isn’t part of this build of the prototype yet.');
      if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
    },
  }),
};

// Batch 1a: all detail sources remain unavailable in this build. Selection
// remounts the reviewed lane without inventing a usable image or changing the
// openPhoto refusal above. Metadata's opener accepts a supplied immutable
// record; the Works-list/metadata transport is still pending.
const details = detailPanels({
  createHost,
  createOnDemand,
  photos: ['genre', 'instrument'].map((route) => ({
    route,
    panel: document.querySelector(`[data-panel="${route}"]`),
    selection: route === 'genre' ? genre : instrument,
    kind: route === 'genre' ? 'tradition' : 'instrument',
    load: route === 'genre' ? genres.loadGenre : instruments.loadInstrument,
    media: Object.freeze({ resolve: () => null }),
    overlay,
    lane: {
      id: 'detailphotos',
      label: 'Detail photos',
      load: () => import('./features/media/lightbox.js'),
      unloaded: 'The detail photo record did not load.',
    },
  })),
  metadata: {
    panel: document.querySelector('[data-panel="library"]'),
    lane: {
      id: 'librarymetadata',
      label: 'Recorded availability and source evidence',
      load: () => import('./features/library-metadata/sheet.js'),
      unloaded: 'The source record did not load.',
    },
  },
  warn: (error) => console.warn('[prototype] A detail panel did not end cleanly:', error),
});
const openMetadata = (record, options) => details.openMetadata(record, options);

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
    context: async ({ signal }) => {
      await discovery.start();
      if (discovery.categories.current().status !== 'ready') throw new Error('not ready');
      return {
        categories: ending(signal, discovery.categories),
        discovery: ending(signal, discovery.discovery),
        targets: ending(signal, {
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
    context: async ({ signal }) => {
      await discovery.start();
      if (discovery.targets.current().status !== 'ready') throw new Error('not ready');
      return {
        targets: ending(signal, discovery.targets),
        discovery: ending(signal, discovery.discovery),
      };
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
// nothing reads it yet. The instrument already open has its preview rebuilt,
// as production's inspect does, so one that failed can be tried again.
function openInstrument(id) {
  if (typeof id === 'string' && id && id === instrument.current()) recipe.reopen(id);
  else instrument.set(id);
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
      // Its genre and recipe listeners end with the mount (ending),
      // whatever the lane keeps.
      context: async ({ signal }) => {
        await recipe.start();
        if (recipe.status() !== 'ready') throw new Error('not ready');
        const port = recipe.port(['addEnsemble', 'addInstrument', 'snapshot', 'subscribe']);
        return {
          genre: ending(signal, { current: genre.current, subscribe: genre.subscribe }),
          loadGenreInstruments,
          openInstrument,
          recipe: ending(signal, port),
        };
      },
    },
  ],
  // The reviewed preview lanes share the existing store. This is not yet
  // the complete inspector: its tabs, catalog and other panels are pending.
  instrument: [
    {
      id: 'instrumentoutput',
      label: 'Instrument output',
      load: () => import('./features/instrument-output/output.js'),
      unloaded: 'The instrument output did not load.',
      retryHint: 'Try again.',
      context: async ({ signal }) => {
        await recipe.start();
        if (recipe.status() !== 'ready') throw new Error('not ready');
        return { output: ending(signal, recipe.preview.output) };
      },
    },
    {
      id: 'instrumentactions',
      label: 'Add the configured instrument',
      load: () => import('./features/instrument-actions/actions.js'),
      unloaded: 'The instrument actions did not load.',
      retryHint: 'Try again.',
      context: async ({ signal }) => {
        await recipe.start();
        if (recipe.status() !== 'ready') throw new Error('not ready');
        const port = recipe.port([
          'addConfiguredInstrument',
          'resetInstrumentPreview',
          'setInstrumentDestination',
          'snapshot',
          'subscribe',
        ]);
        return { recipe: ending(signal, port) };
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
  details.show(route);
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
export { discovery, recipe, openMetadata };

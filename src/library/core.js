// ─── Library chunk: core ───────────────────────────────────────────────────
// Wrapped by the build as CMLibraryDefine('core', function () { … }). The
// router (show(main, sub)), the shared `lib` service every other chunk codes
// against (docs/library-ui-contract.md), and Explore: language shelves of
// collection cards, the collections rail, the topline and a collection page.
/* global LIBRARY, LIBRARY_DATA_BASE, esc, icon, libraryChunk, libraryShow, uiButton, uiEmptyState, uiSubroute, showToast, libraryAnnounce */
'use strict';

// ─── The shared service ──────────────────────────────────────────────────────
const LANGUAGE_NAMES = {
  eng: 'English',
  fas: 'Persian',
  fin: 'Finnish',
  cym: 'Welsh',
  non: 'Old Norse',
  ltc: 'Middle Chinese',
  msa: 'Malay',
  san: 'Sanskrit',
  som: 'Somali',
};
const ART_BASE = 'assets/library/art/';
const DB_NAME = 'codex-musica-library-v1';
const cache = new Map();

const isGzip = (bytes) => bytes.length > 1 && bytes[0] === 0x1f && bytes[1] === 0x8b;
async function inflate(bytes) {
  if (typeof DecompressionStream === 'undefined')
    throw Error('This browser cannot read the Library data');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function fetchStatic(path, opts = {}) {
  const res = await fetch(lib.base + path, { cache: opts.reload ? 'reload' : 'default' });
  if (!res.ok) {
    const error = Error(`Library data ${res.status}: ${path}`);
    error.status = res.status;
    throw error;
  }
  let bytes = new Uint8Array(await res.arrayBuffer());
  // .json.gz arrives as gzip bytes unless the host already decoded it.
  if (isGzip(bytes)) bytes = await inflate(bytes);
  return JSON.parse(new TextDecoder().decode(bytes));
}
// Cached by path; a failure is forgotten so Retry asks again. A file carrying
// a data_id other than catalog.json's is refetched once with cache:'reload'.
function json(path, opts = {}) {
  if (!opts.reload && cache.has(path)) return cache.get(path);
  const p = (async () => {
    let body = await fetchStatic(path, opts);
    if (path !== 'catalog.json' && body && body.data_id && cache.has('catalog.json')) {
      const catalog = await cache.get('catalog.json').catch(() => null);
      if (catalog && catalog.data_id !== body.data_id && !opts.reload) {
        body = await fetchStatic(path, { reload: true });
        if (body.data_id !== catalog.data_id) {
          const error = Error('The Library was just updated');
          error.stale = true;
          throw error;
        }
      }
    }
    return body;
  })();
  cache.set(path, p);
  p.catch(() => cache.get(path) === p && cache.delete(path));
  return p;
}

const shardOf = (id) =>
  String(id)
    .replace(/^[a-z]+_/, '')
    .slice(0, 2)
    .toLowerCase();

async function api(path, opts = {}, credentials = 'omit') {
  const { body, method, headers, raw, signal } = opts;
  const init = {
    method: method || (body !== undefined ? 'POST' : 'GET'),
    credentials,
    signal,
    headers: { ...(headers || {}) },
  };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (typeof body !== 'string') init.headers['content-type'] = 'application/json';
  }
  const res = await fetch(lib.api + path, init);
  if (raw) return res;
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const error = Error(
      (data && (data.error?.message || data.message || data.error)) ||
        `Library service ${res.status}`
    );
    error.status = res.status;
    error.body = data;
    throw error;
  }
  return data;
}

// Selection: reading unit ids pinned on this device, under the old app's key
// (`export-selection:<snapshot>`) in IndexedDB 'codex-musica-library-v1'.
function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(Error('No device storage'));
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const t = db.transaction('state', mode);
      const req = fn(t.objectStore('state'));
      t.oncomplete = () => {
        db.close();
        resolve(req?.result);
      };
      t.onerror = t.onabort = () => {
        db.close();
        reject(t.error);
      };
    };
  });
}
const device = {
  read: (key, fallback) =>
    idb('readonly', (s) => s.get(key)).then((v) => (v === undefined ? fallback : v)),
  write: (key, value) => idb('readwrite', (s) => s.put(value, key)),
};

const selection = (() => {
  const ids = new Set();
  const listeners = new Set();
  let key = '';
  const sel = {
    ids,
    unsaved: false,
    ready: null,
    has: (id) => ids.has(id),
    get size() {
      return ids.size;
    },
    add(id) {
      [].concat(id).forEach((x) => ids.add(x));
      changed();
    },
    remove(id) {
      [].concat(id).forEach((x) => ids.delete(x));
      changed();
    },
    toggle(id) {
      ids.has(id) ? ids.delete(id) : ids.add(id);
      changed();
    },
    set(list) {
      ids.clear();
      list.forEach((x) => ids.add(x));
      changed();
    },
    clear() {
      ids.clear();
      changed();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  function changed() {
    const save = key
      ? device.write(key, [...ids]).then(
          () => (sel.unsaved = false),
          () => (sel.unsaved = true)
        )
      : Promise.resolve();
    listeners.forEach((fn) => {
      try {
        fn(sel);
      } catch (e) {
        console.error('[library] selection listener', e);
      }
    });
    return save;
  }
  // Started after the factory has defined `lib` (json() reads lib.base).
  sel.ready = Promise.resolve().then(async () => {
    try {
      const catalog = await json('catalog.json');
      key = 'export-selection:' + (catalog.projected_from?.snapshot_id || catalog.data_id);
      const stored = await device.read(key, []);
      const early = ids.size;
      stored.forEach((x) => ids.add(x));
      // Picks made before the stored set arrived are kept and saved with it.
      if (early) await changed();
    } catch (e) {
      sel.unsaved = true;
      console.warn('[library] selection', e);
    }
    listeners.forEach((fn) => fn(sel));
    return sel;
  });
  return sel;
})();

// A failure state read as one sentence pair: its title, then what to do.
const failed = (root) =>
  [...(root.querySelector('.cm-empty')?.children || [])]
    .filter((el) => el.matches('strong, span'))
    .map((el) => el.textContent.replace(/\.?$/, '.'))
    .join(' ');
const UNREACHABLE = 'Couldn’t reach the Library. Check your connection and try again.';
const lib = {
  base: typeof LIBRARY_DATA_BASE === 'string' ? LIBRARY_DATA_BASE : 'library/data/',
  api: 'https://mcp.codexmusica.com/library/v1',
  artBase: ART_BASE,
  languageNames: LANGUAGE_NAMES,
  languageName: (code) => LANGUAGE_NAMES[code] || code,
  // The visible line for a load that failed: what the person can do, not the
  // transport's words ("Failed to fetch", "Library data 503: …"), which stay in
  // the console. A refusal written for readers (a 400 from search) keeps its own.
  problem(error) {
    const msg = String((error && error.message) || error || '');
    const status = (error && error.status) || 0;
    return !msg ||
      error instanceof TypeError ||
      status >= 500 ||
      status === 404 ||
      /Library (data|service) \d|\(\d{3}\)|fetch|network|load failed/i.test(msg)
      ? UNREACHABLE
      : msg;
  },
  failed,
  // After a Retry the button that held focus is gone. When focus fell with it,
  // land on the control that matters now (the new Retry, or the loaded view's
  // heading or first control) and say what happened.
  settle(target, said) {
    const a = document.activeElement;
    if (target && (!a || a === document.body || !a.isConnected)) {
      if (!target.matches('button,a[href],input,select,textarea,[tabindex]')) target.tabIndex = -1;
      target.focus();
    }
    if (said && typeof libraryAnnounce === 'function') libraryAnnounce(said);
  },
  go(sub, { replace = false } = {}) {
    LIBRARY.sub = sub;
    uiSubroute(sub, { push: !replace });
    return libraryShow();
  },
  json,
  catalog: () => json('catalog.json'),
  collections: () => json('collections.json'),
  // Head page (k=0) or page k of a collection's display rows (250 each).
  collection: (id, page = 0) => json(`c/${id}${page ? '.p' + page : ''}.json.gz`),
  // Every readable unit's [id, pathKey, collection_id] via its u/<hh> shard.
  async unit(id) {
    const shard = await json(`u/${shardOf(id)}.json.gz`);
    if (!shard._index) shard._index = new Map(shard.units.map((u) => [u[0], u]));
    return shard._index.get(id) || null;
  },
  // 'r/<hh>/<id>/<rev16-proj12>/' or null when the unit is not readable.
  async unitPath(id, pathKey) {
    if (!pathKey) pathKey = (await lib.unit(id))?.[1];
    return pathKey ? `r/${shardOf(id)}/${id}/${pathKey}/` : null;
  },
  async reading(id, pathKey) {
    const dir = await lib.unitPath(id, pathKey);
    if (!dir) {
      const error = Error('This reading is not readable');
      error.status = 404;
      throw error;
    }
    const head = await json(dir + 'head.json.gz');
    head._dir = dir;
    return head;
  },
  artwork: () => json('artwork.json'),
  // { avif, webp, src, srcset } for an art_id; renditions as build_library_art.js writes them.
  art(id) {
    if (!id) return null;
    const at = (w, ext) => `${ART_BASE}${id}-${w}.${ext}`;
    return {
      src: at(480, 'webp'),
      avif: `${at(240, 'avif')} 240w, ${at(480, 'avif')} 480w`,
      webp: `${at(240, 'webp')} 240w, ${at(480, 'webp')} 480w`,
    };
  },
  get: (path, opts) => api(path, opts, 'omit'),
  viewer: (path, opts) => api(path, opts, 'include'),
  selection,
  device,
  icon: (name, size = 16) => icon(name, size),
  shardOf,
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const CSS = `
#surface-library .lib-core{display:flex;gap:16px;align-items:flex-start;min-width:0}
#surface-library .lib-core-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:20px}
#surface-library .lib-topline{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;color:var(--cm-text-secondary);font-size:var(--cm-text-sm,13px)}
#surface-library .lib-topline span{display:inline-flex;align-items:center;gap:6px}
#surface-library .lib-snapshot{font-family:var(--cm-font-mono,ui-monospace,monospace);color:var(--cm-text-muted)}
#surface-library .lib-icon-btn,#surface-library .lib-core button.lib-btn,#surface-library .lib-coll-actions button,#surface-library .lib-core .cm-empty-actions button{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 10px;border:1px solid var(--cm-border);border-radius:var(--cm-radius-md,8px);background:var(--cm-surface);color:var(--cm-text);cursor:pointer;font:inherit}
#surface-library .lib-icon-btn:hover,#surface-library .lib-core button.lib-btn:hover,#surface-library .lib-coll-actions button:hover,#surface-library .lib-core .cm-empty-actions button:hover{background:var(--cm-hover)}
#surface-library .lib-icon-btn:focus-visible,#surface-library .lib-core button:focus-visible,#surface-library .lib-core a:focus-visible{outline:2px solid var(--cm-focus,var(--cm-accent));outline-offset:2px}
#surface-library .lib-rail{flex:0 0 272px;position:sticky;top:8px;display:flex;flex-direction:column;max-height:calc(100vh - 140px);border:1px solid var(--cm-border);border-radius:var(--cm-radius-lg,12px);background:var(--cm-surface);overflow:hidden}
#surface-library .lib-rail[hidden]{display:none}
#surface-library .lib-rail-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--cm-border-subtle,var(--cm-border))}
#surface-library .lib-rail-head strong{flex:1}
#surface-library .lib-rail-head select{max-width:110px;min-height:30px;border:1px solid var(--cm-border);border-radius:var(--cm-radius-md,8px);background:var(--cm-surface);color:var(--cm-text);font:inherit;font-size:12px}
#surface-library .lib-rail-scroll{flex:1;overflow-y:auto;position:relative;min-height:200px}
#surface-library .lib-rail-spacer{position:relative}
#surface-library .lib-spine{position:absolute;left:0;right:0;height:52px;display:flex;align-items:center;gap:10px;padding:0 12px;border:0;border-bottom:1px solid var(--cm-border-subtle,var(--cm-border));background:transparent;color:var(--cm-text);text-align:left;cursor:pointer;font:inherit}
#surface-library .lib-spine:hover{background:var(--cm-hover)}
#surface-library .lib-spine[aria-current="true"]{background:var(--cm-accent-soft);color:var(--cm-accent-text)}
#surface-library .lib-spine b{font-family:var(--cm-font-mono,ui-monospace,monospace);font-size:11px;color:var(--cm-text-muted);font-weight:500;min-width:3.2em}
#surface-library .lib-spine span{display:flex;flex-direction:column;min-width:0}
#surface-library .lib-spine strong,#surface-library .lib-spine small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#surface-library .lib-spine strong{font-size:13px;font-weight:600}
#surface-library .lib-spine small{font-size:11px;color:var(--cm-text-secondary)}
#surface-library .lib-rail-foot{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border-top:1px solid var(--cm-border-subtle,var(--cm-border))}
#surface-library .lib-rail-foot button{justify-content:space-between}
#surface-library .lib-rail-foot small{color:var(--cm-text-muted);font-size:11px}
#surface-library .lib-shelf{display:flex;flex-direction:column;gap:8px;min-width:0}
#surface-library .lib-shelf-head{display:flex;align-items:baseline;gap:12px}
#surface-library .lib-shelf-head h2{margin:0;font-size:var(--cm-text-md,17px);font-weight:650;color:var(--cm-text)}
#surface-library .lib-shelf-head span{color:var(--cm-text-secondary);font-size:13px}
#surface-library .lib-shelf-head button{margin-left:auto}
#surface-library .lib-shelf-scroll{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x proximity;padding:4px 2px 10px;scrollbar-width:thin}
#surface-library .lib-card{flex:0 0 172px;scroll-snap-align:start;display:flex;flex-direction:column;gap:6px;min-width:0}
#surface-library .lib-art{position:relative;aspect-ratio:3/4;border-radius:var(--cm-radius-md,8px);overflow:hidden;border:1px solid var(--cm-border);background:var(--cm-surface-sunken);box-shadow:var(--cm-shadow-1)}
#surface-library .lib-art-open{all:unset;display:block;width:100%;height:100%;cursor:pointer}
#surface-library .lib-art-open:focus-visible{outline:2px solid var(--cm-focus,var(--cm-accent));outline-offset:-2px}
#surface-library .lib-art img{width:100%;height:100%;object-fit:cover;display:block}
#surface-library .lib-cover{display:flex;flex-direction:column;justify-content:space-between;height:100%;box-sizing:border-box;padding:12px 12px 50px;background:var(--lib-tone);color:var(--cm-text)}
#surface-library .lib-cover small{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--cm-text-secondary)}
#surface-library .lib-cover strong{font-size:14px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;word-break:break-word;font-family:var(--cm-font-serif,Georgia,serif)}
#surface-library .lib-cover span{font-size:11px;color:var(--cm-text-secondary)}
#surface-library .lib-cover .icon-svg{color:var(--cm-text-muted)}
#surface-library .lib-tone-0{--lib-tone:color-mix(in srgb,var(--cm-blue,#3b82f6) 12%,var(--cm-surface))}
#surface-library .lib-tone-1{--lib-tone:color-mix(in srgb,var(--cm-success,#16a34a) 12%,var(--cm-surface))}
#surface-library .lib-tone-2{--lib-tone:color-mix(in srgb,var(--cm-orange,#f97316) 12%,var(--cm-surface))}
#surface-library .lib-tone-3{--lib-tone:color-mix(in srgb,var(--cm-violet,#8b5cf6) 12%,var(--cm-surface))}
#surface-library .lib-quick{position:absolute;right:6px;bottom:6px;display:flex;gap:6px}
#surface-library .lib-quick button{width:36px;height:36px;display:grid;place-items:center;border-radius:var(--cm-radius-pill,999px);border:1px solid var(--cm-border);background:var(--cm-surface-overlay,var(--cm-surface));color:var(--cm-text);cursor:pointer;box-shadow:var(--cm-shadow-2)}
#surface-library .lib-quick button:hover{background:var(--cm-hover)}
#surface-library .lib-quick button[aria-pressed="true"]{background:var(--cm-accent);color:var(--cm-on-accent);border-color:var(--cm-accent)}
#surface-library .lib-quick button[aria-pressed="mixed"]{background:var(--cm-accent-soft);color:var(--cm-accent-text)}
#surface-library .lib-caption{display:flex;flex-direction:column;gap:2px;min-width:0}
#surface-library .lib-caption button{all:unset;cursor:pointer;font-size:13px;font-weight:600;color:var(--cm-text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#surface-library .lib-caption button:hover{text-decoration:underline}
#surface-library .lib-caption button:focus-visible{outline:2px solid var(--cm-focus,var(--cm-accent))}
#surface-library .lib-caption-row{position:relative;display:flex;align-items:flex-start;gap:4px}
#surface-library .lib-caption-row>button:first-child{flex:1}
#surface-library .lib-caption .lib-menu-btn{all:unset;flex:0 0 28px;height:28px;display:grid;place-items:center;border-radius:var(--cm-radius-md,8px);color:var(--cm-text-secondary);cursor:pointer}
#surface-library .lib-caption .lib-menu-btn:hover{background:var(--cm-hover);color:var(--cm-text)}
#surface-library .lib-caption .lib-menu-btn:focus-visible{outline:2px solid var(--cm-focus,var(--cm-accent))}
#surface-library .lib-menu{position:fixed;z-index:40;min-width:220px;display:flex;flex-direction:column;padding:4px;border:1px solid var(--cm-border);border-radius:var(--cm-radius-md,8px);background:var(--cm-surface-overlay,var(--cm-surface));box-shadow:var(--cm-shadow-3)}
#surface-library .lib-menu button{display:flex;align-items:center;gap:8px;min-height:36px;padding:0 10px;border:0;border-radius:6px;background:transparent;color:var(--cm-text);font:inherit;font-size:13px;text-align:left;cursor:pointer}
#surface-library .lib-menu button:hover,#surface-library .lib-menu button:focus{background:var(--cm-hover);outline:none}
#surface-library .lib-caption small{font-size:12px;color:var(--cm-text-secondary)}
#surface-library .lib-more{flex:0 0 172px;display:grid;place-items:center;aspect-ratio:3/4;border:1px dashed var(--cm-border);border-radius:var(--cm-radius-md,8px);background:transparent;color:var(--cm-text-secondary);cursor:pointer;font:inherit}
#surface-library .lib-more:hover{background:var(--cm-hover);color:var(--cm-text)}
#surface-library .lib-foot{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;color:var(--cm-text-muted);font-size:12px}
#surface-library .lib-foot a{color:var(--cm-accent-text)}
#surface-library .lib-core button[disabled]{opacity:.5;cursor:default}
#surface-library .lib-skel{height:240px;border-radius:var(--cm-radius-md,8px);background:var(--cm-surface-sunken);animation:lib-pulse 1.4s ease-in-out infinite}
@keyframes lib-pulse{50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){#surface-library .lib-skel{animation:none}}
@media (max-width:1099px){#surface-library .lib-rail{position:fixed;z-index:30;left:8px;top:calc(var(--app-bar-height,56px) + 8px);bottom:8px;max-height:none;box-shadow:var(--cm-shadow-3)}}
@media (max-width:600px){#surface-library .lib-card,#surface-library .lib-more{flex-basis:140px}#surface-library .lib-coll-head .lib-art{flex-basis:84px}}
`;
function ensureStyles() {
  if (!document.querySelector('style[data-lib="core"]'))
    document.head.insertAdjacentHTML('beforeend', `<style data-lib="core">${CSS}</style>`);
}

// ─── Explore ─────────────────────────────────────────────────────────────────
const RAIL_ROW = 52;
const RAIL_MAX = 40;
const SHELF_BATCH = 24;
const state = {
  rail: typeof window !== 'undefined' && window.innerWidth >= 1100,
  railLang: 'all',
  shelfShown: {},
  shelfUnsaved: {},
  shelfTimers: {},
  token: 0,
};
const num = (n) => Number(n || 0).toLocaleString('en-US');
const plural = (n, one, many = one + 's') => `${num(n)} ${n === 1 ? one : many}`;
// Card row from catalog.json shelves: [cid, title, readable, recorded, art, first]
// or a collections.json row: [cid, title, language, readable, recorded, art].
const fromShelf = (c, language) => ({
  id: c[0],
  title: c[1],
  language,
  readable: c[2],
  recorded: c[3],
  art: c[4],
  first: c[5],
});
const fromRow = (c) => ({
  id: c[0],
  title: c[1],
  language: c[2],
  readable: c[3],
  recorded: c[4],
  art: c[5],
  first: null,
});
const shortTitle = (t) =>
  String(t || '')
    .split('\n')[0]
    .slice(0, 160);

function artHtml(c, i, label) {
  const a = lib.art(c.art);
  if (a)
    return `<picture><source type="image/avif" srcset="${a.avif}" sizes="172px"><source type="image/webp" srcset="${a.webp}" sizes="172px"><img src="${a.src}" alt="${esc(label)}" loading="lazy" decoding="async"></picture>`;
  return `<div class="lib-cover lib-tone-${i % 4}"><small>${esc(lib.languageName(c.language))}</small>${icon('book-open', 28)}<strong>${esc(shortTitle(c.title))}</strong><span>${plural(c.readable, 'readable unit')}</span></div>`;
}
function selectionState(cid) {
  const ids = selectedFor.get(cid);
  if (!ids || !ids.length) return 'false';
  const n = ids.filter((id) => selection.has(id)).length;
  return n === ids.length ? 'true' : n ? 'mixed' : 'false';
}
// readable_ids per collection, filled when a card's selection is first used.
const selectedFor = new Map();

function cardHtml(c, i) {
  const title = shortTitle(c.title);
  const pressed = selectionState(c.id);
  return `<article class="lib-card" data-cid="${esc(c.id)}"${c.art ? ` data-art="${esc(c.art)}"` : ''}>
<div class="lib-art"><button type="button" class="lib-art-open" data-lib-act="open" aria-label="Open ${esc(title)}">${artHtml(c, i, title)}</button>
<div class="lib-quick"><button type="button" data-lib-act="play" aria-label="Read first work of ${esc(title)}">${icon('play', 16)}</button>
<button type="button" data-lib-act="select" aria-pressed="${pressed}" aria-label="${pressed === 'true' ? 'Remove' : 'Add'} ${esc(title)} ${pressed === 'true' ? 'from' : 'to'} export selection">${icon(pressed === 'true' ? 'check' : 'plus', 17)}</button></div></div>
<div class="lib-caption"><div class="lib-caption-row"><button type="button" data-lib-act="open">${esc(title)}</button><button type="button" class="lib-menu-btn" data-lib-act="menu" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${esc(title)}">${icon('ellipsis', 18)}</button></div><small>${plural(c.readable, 'reading')}${c.recorded > c.readable ? ` · ${num(c.recorded)} recorded` : ''}</small></div></article>`;
}

function toplineHtml(catalog) {
  const c = catalog.census || {};
  const snap = catalog.projected_from?.snapshot_id || '';
  return `<div class="lib-topline"><span>${railToggleHtml()}${icon('library', 16)}${num(c.readable_collections)} readable collections · ${num(c.readable_reading_units)} reading units</span>${snap ? `<span class="lib-snapshot" title="${esc(snap)}">Readings: snapshot ${esc(snap.slice(0, 8))}</span>` : ''}</div>`;
}
function railToggleHtml() {
  return `<button type="button" class="lib-icon-btn" data-lib-act="rail" aria-expanded="${state.rail}" aria-controls="lib-rail" aria-label="${state.rail ? 'Collapse' : 'Open'} collections rail">${icon(state.rail ? 'panel-left-close' : 'panel-left-open', 18)}</button>`;
}

function railHtml(catalog) {
  const langs = catalog.shelves.map((s) => s.language);
  return `<aside class="lib-rail" id="lib-rail" aria-label="Collections"${state.rail ? '' : ' hidden'}>
<div class="lib-rail-head">${icon('book-open', 17)}<strong>Collections</strong>
<select data-lib-act="rail-lang" aria-label="Rail language"><option value="all">All</option>${langs.map((l) => `<option value="${esc(l)}"${state.railLang === l ? ' selected' : ''}>${esc(lib.languageName(l))}</option>`).join('')}</select>
<button type="button" class="lib-icon-btn" data-lib-act="rail" aria-label="Collapse collections">${icon('panel-left-close', 16)}</button></div>
<div class="lib-rail-scroll" tabindex="-1"><div class="lib-rail-spacer"></div></div>
<footer class="lib-rail-foot"><button type="button" class="lib-btn" data-lib-act="go" data-sub="/rights">${icon('download', 16)}<span>Export selection</span><b data-lib="sel-count">${num(selection.size)}</b></button><small data-lib="sel-note">On this device${selection.unsaved ? ' · unsaved' : ''}</small></footer></aside>`;
}

// The rail is virtualized: at most RAIL_MAX rows in the DOM. It is one tab
// stop (a roving tabindex): Tab enters on one row and leaves for the page,
// and the arrow keys, Home and End move between rows. Each row used to be a
// tab stop, so tabbing scrolled the rail, the repaint replaced the focused
// row, focus fell to the body, and the next Tab re-entered at row 01: at
// widths where the rail is open, keyboard users never reached the page
// (Jony's viewport lane, #519).
let railRows = [];
let railFocus = 0;
function drawRail(root, activeId) {
  const scroll = root.querySelector('.lib-rail-scroll');
  const spacer = root.querySelector('.lib-rail-spacer');
  if (!scroll || !spacer) return;
  spacer.style.height = railRows.length * RAIL_ROW + 'px';
  const at = activeId ? railRows.findIndex((c) => c.id === activeId) : -1;
  railFocus = at >= 0 ? at : Math.min(railFocus, Math.max(0, railRows.length - 1));
  const paint = () => {
    const hadFocus = spacer.contains(document.activeElement);
    const first = Math.max(0, Math.floor(scroll.scrollTop / RAIL_ROW) - 5);
    const count = Math.min(RAIL_MAX, Math.ceil((scroll.clientHeight || 600) / RAIL_ROW) + 10);
    spacer.innerHTML = railRows
      .slice(first, first + count)
      .map((c, j) => {
        const i = first + j;
        return `<button type="button" class="lib-spine" style="top:${i * RAIL_ROW}px" data-lib-act="open" data-cid="${esc(c.id)}" data-i="${i}" tabindex="${i === railFocus ? 0 : -1}"${c.id === activeId ? ' aria-current="true"' : ''}><b>${String(i + 1).padStart(2, '0')}</b><span><strong>${esc(shortTitle(c.title))}</strong><small>${esc(lib.languageName(c.language))} · ${plural(c.readable, 'reading')}</small></span></button>`;
      })
      .join('');
    // The row that held focus is a new element now: give focus back to it.
    if (hadFocus) spacer.querySelector(`[data-i="${railFocus}"]`)?.focus({ preventScroll: true });
  };
  const moveTo = (i) => {
    railFocus = Math.max(0, Math.min(railRows.length - 1, i));
    const top = railFocus * RAIL_ROW;
    if (top < scroll.scrollTop) scroll.scrollTop = top;
    else if (top > scroll.scrollTop + scroll.clientHeight - RAIL_ROW)
      scroll.scrollTop = top - scroll.clientHeight + RAIL_ROW;
    paint();
    spacer.querySelector(`[data-i="${railFocus}"]`)?.focus({ preventScroll: true });
  };
  scroll.onscroll = () => requestAnimationFrame(paint);
  const onFocus = (e) => {
    const i = Number(e.target?.dataset?.i);
    if (Number.isInteger(i) && i !== railFocus) {
      railFocus = i;
      for (const b of spacer.querySelectorAll('.lib-spine'))
        b.tabIndex = Number(b.dataset.i) === i ? 0 : -1;
    }
  };
  const onKey = (e) => {
    if (!e.target?.classList?.contains('lib-spine')) return;
    const page = Math.max(1, Math.floor(scroll.clientHeight / RAIL_ROW) - 1);
    const to = {
      ArrowDown: railFocus + 1,
      ArrowUp: railFocus - 1,
      PageDown: railFocus + page,
      PageUp: railFocus - page,
      Home: 0,
      End: railRows.length - 1,
    }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    moveTo(to);
  };
  // One listener pair per spacer, always calling this draw's handlers.
  spacer._rail = { onFocus, onKey };
  if (!spacer._railBound) {
    spacer._railBound = true;
    spacer.addEventListener('focusin', (e) => spacer._rail.onFocus(e));
    spacer.addEventListener('keydown', (e) => spacer._rail.onKey(e));
  }
  paint();
  if (activeId) {
    if (
      at >= 0 &&
      (at * RAIL_ROW < scroll.scrollTop ||
        at * RAIL_ROW > scroll.scrollTop + scroll.clientHeight - RAIL_ROW)
    )
      scroll.scrollTop = Math.max(0, at * RAIL_ROW - 2 * RAIL_ROW);
  }
}
// Below 1100 px the open rail overlays the page (position: fixed). It then
// behaves as a panel: opening moves focus into it, Escape closes it and
// returns focus to the toggle, and focus leaving it closes it, so a focused
// control is never left under the rail (Jony's viewport lane, #519;
// WCAG 2.4.11). It starts below the sticky app bar (--app-bar-height, kept in
// sync by app.js), so its head row is never under the bar, and a press
// anywhere outside it closes it. Where the rail sits beside the page, none of
// this applies.
const railOverlays = (rail) => !!rail && getComputedStyle(rail).position === 'fixed';
function setRail(main, open, { focusToggle = false, quiet = false } = {}) {
  const rail = main.querySelector('.lib-rail');
  if (!rail) return;
  // Closing from inside (the rail's own close button) gives focus back to
  // the toggle instead of dropping it with the hidden rail.
  const hadFocus = rail.contains(document.activeElement);
  state.rail = open;
  rail.hidden = !open;
  main.querySelectorAll('.lib-topline [data-lib-act="rail"]').forEach((b) => {
    b.setAttribute('aria-expanded', String(open));
    b.setAttribute('aria-label', `${open ? 'Collapse' : 'Open'} collections rail`);
    b.innerHTML = icon(open ? 'panel-left-close' : 'panel-left-open', 18);
  });
  if (open) {
    drawRail(main, currentCollection());
    if (railOverlays(rail))
      (rail.querySelector('.lib-spine[tabindex="0"]') || rail.querySelector('select'))?.focus();
  } else if (!quiet && (focusToggle || hadFocus))
    main.querySelector('.lib-topline [data-lib-act="rail"]')?.focus();
  bindRailPanel(main, rail);
}
// One document listener for the light dismiss, aimed at the current view.
// The dismissing press only dismisses: its click is swallowed, so a tap
// beside the rail never also ticks or opens what lies under it (Jony, #519).
let railOutsideMain = null;
let railSwallowClick = 0;
function bindRailOutside(main) {
  railOutsideMain = main;
  if (bindRailOutside.bound) return;
  bindRailOutside.bound = true;
  document.addEventListener(
    'pointerdown',
    (e) => {
      railSwallowClick = 0;
      const m = railOutsideMain;
      const rail = m?.isConnected ? m.querySelector('.lib-rail') : null;
      if (!rail || !state.rail || !railOverlays(rail)) return;
      // A press on the toggle closes the rail through its own click.
      if (rail.contains(e.target) || e.target.closest?.('[data-lib-act="rail"]')) return;
      setRail(m, false);
      railSwallowClick = e.timeStamp;
    },
    true
  );
  document.addEventListener(
    'click',
    (e) => {
      // Only the click that ends the dismissing press (a press that never
      // becomes a click is forgotten at the next press or after a second).
      // A keyboard click (detail 0) is never the end of a press.
      if (!railSwallowClick || e.detail === 0 || e.timeStamp - railSwallowClick > 1000) return;
      railSwallowClick = 0;
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );
}
function bindRailPanel(main, rail) {
  if (rail) bindRailOutside(main);
  if (!rail || rail._panelBound) return;
  rail._panelBound = true;
  if (!main._railPressBound) {
    main._railPressBound = true;
    main.addEventListener('pointerdown', (e) => {
      main._railTogglePress = !!e.target.closest?.('[data-lib-act="rail"]');
    });
    main.addEventListener('click', () => setTimeout(() => (main._railTogglePress = false)));
  }
  {
    rail.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.rail && railOverlays(rail)) {
        e.preventDefault();
        e.stopPropagation();
        setRail(main, false, { focusToggle: true });
      }
    });
    rail.addEventListener('focusout', (e) => {
      const to = e.relatedTarget;
      if (!state.rail || !railOverlays(rail) || !to || rail.contains(to)) return;
      // A pointer press on the toggle closes the rail through its own click;
      // Tab onto the toggle is leaving the rail like any other move.
      if (main._railTogglePress && to.closest?.('[data-lib-act="rail"]')) return;
      setRail(main, false);
    });
  }
}
async function fillRail(root, activeId) {
  const scroll = root.querySelector('.lib-rail-scroll');
  if (!scroll) return;
  bindRailPanel(root, root.querySelector('.lib-rail'));
  try {
    const { collections } = await lib.collections();
    railRows = collections
      .map(fromRow)
      .filter((c) => c.readable > 0 && (state.railLang === 'all' || c.language === state.railLang));
    drawRail(root, activeId);
  } catch (e) {
    scroll.innerHTML = uiEmptyState({
      title: 'Collections did not load',
      text: lib.problem(e),
      actions: libButton('rail-retry', 'Retry', 'refresh-cw', ''),
      tone: 'danger',
      role: '',
    });
    lib.settle(null, failed(scroll));
  }
}

function shelfHtml(shelf, rows) {
  const shown = state.shelfShown[shelf.language] || shelf.cards.length;
  const cards = rows ? rows.slice(0, shown) : shelf.cards.map((c) => fromShelf(c, shelf.language));
  const more = shelf.total - cards.length;
  return `<div class="lib-shelf" role="group" data-lang="${esc(shelf.language)}" aria-labelledby="lib-shelf-${esc(shelf.language)}">
<div class="lib-shelf-head"><h2 id="lib-shelf-${esc(shelf.language)}">${esc(lib.languageName(shelf.language))}</h2><span>${plural(shelf.total, 'collection')}<span data-lib="shelf-note">${state.shelfUnsaved[shelf.language] ? ' · position unsaved' : ''}</span></span></div>
<div class="lib-shelf-scroll" tabindex="0" aria-label="${esc(lib.languageName(shelf.language))} collections, scroll horizontally">${cards.map((c, i) => cardHtml(c, i)).join('')}${more > 0 ? `<button type="button" class="lib-more" data-lib-act="more" data-lang="${esc(shelf.language)}">Show ${num(Math.min(more, SHELF_BATCH))} more<br>of ${num(more)}</button>` : ''}</div></div>`;
}

async function showExplore(main, token) {
  const catalog = await lib.catalog();
  if (token !== state.token) return;
  // Stored shelf positions; one past the cards in catalog.json widens that
  // shelf (collections.json joins the critical path for this boot only).
  const positions = {};
  await Promise.all(
    catalog.shelves.map(async (s) => {
      const at = await device.read('shelf-position:' + s.language, 0).catch(() => {
        state.shelfUnsaved[s.language] = true;
        return 0;
      });
      const pos = Number.isFinite(at) ? Math.max(0, Math.min(s.total - 1, Math.floor(at))) : 0;
      positions[s.language] = pos;
      const shown = state.shelfShown[s.language] || s.cards.length;
      if (pos >= shown - 1) state.shelfShown[s.language] = Math.min(s.total, pos + SHELF_BATCH);
    })
  );
  if (token !== state.token) return;
  // Shelves the user has widened need collections.json for their rows.
  const widened = Object.keys(state.shelfShown).length;
  const all = widened ? await lib.collections().catch(() => null) : null;
  if (token !== state.token) return;
  const byLang = {};
  if (all)
    for (const c of all.collections.map(fromRow))
      if (c.readable > 0) (byLang[c.language] ||= []).push(c);
  main.innerHTML = `<div class="lib-core">${railHtml(catalog)}<div class="lib-core-main">${toplineHtml(catalog)}
${catalog.shelves.map((s) => shelfHtml(s, all ? withFirst(byLang[s.language] || [], s) : null)).join('')}
<footer class="lib-foot">${icon('library', 14)}<span>${num(catalog.census?.readable_reading_units)} readable units from a fully reconciled source snapshot</span>${catalog.projected_from?.repository_commit ? `<a href="https://github.com/WeningerII/CodexMusica/tree/${esc(catalog.projected_from.repository_commit)}/lyric-harness/corpus" target="_blank" rel="noopener noreferrer">Corpus source ${icon('link', 12)}</a>` : ''}</footer></div></div>`;
  fillRail(main);
  for (const s of catalog.shelves) for (const c of s.cards) firstOf.set(c[0], c[5]);
  main
    .querySelectorAll('.lib-shelf')
    .forEach((section) => restoreShelf(section, positions[section.dataset.lang] || 0));
}
const shelfStride = (scroller) => {
  const card = scroller.querySelector('.lib-card');
  if (!card) return 0;
  return (
    card.getBoundingClientRect().width + (parseFloat(getComputedStyle(scroller).columnGap) || 14)
  );
};
function restoreShelf(section, pos) {
  const scroller = section.querySelector('.lib-shelf-scroll');
  const stride = scroller && shelfStride(scroller);
  if (stride && pos) scroller.scrollLeft = pos * stride;
  if (scroller) scroller.addEventListener('scroll', () => saveShelf(section), { passive: true });
}
// The leftmost card's index, saved 500 ms after scrolling stops.
function saveShelf(section) {
  const lang = section.dataset.lang;
  clearTimeout(state.shelfTimers[lang]);
  state.shelfTimers[lang] = setTimeout(() => {
    const scroller = section.querySelector('.lib-shelf-scroll');
    const stride = shelfStride(scroller);
    if (!stride) return;
    const pos = Math.round(scroller.scrollLeft / stride);
    device.write('shelf-position:' + lang, pos).then(
      () => markShelf(section, false),
      () => markShelf(section, true)
    );
  }, 500);
}
function markShelf(section, unsaved) {
  state.shelfUnsaved[section.dataset.lang] = unsaved;
  const note = section.querySelector('[data-lib="shelf-note"]');
  if (note) note.textContent = unsaved ? ' · position unsaved' : '';
}
const firstOf = new Map();
function withFirst(rows, shelf) {
  for (const c of shelf.cards) firstOf.set(c[0], c[5]);
  return rows;
}

// ─── A collection ────────────────────────────────────────────────────────────
// The page of a collection lives in the hash as a row offset, the documented
// `#library/collections/<id>?offset=n` (docs/library-native-design.md row 12),
// so Next pushes, Back restores it and a shared link opens the same page. It
// used to be a module global that nothing reset on Back, so one collection's
// page was applied to the next collection opened from history (BB8's L1).
const COLLECTION_PAGE = 250;
function collectionOffset(sub) {
  const at = sub.indexOf('?');
  const raw = new URLSearchParams(at < 0 ? '' : sub.slice(at + 1)).get('offset');
  return /^\d+$/.test(raw || '') ? Number(raw) : 0;
}
const collectionSub = (id, page) =>
  '/collections/' + encodeURIComponent(id) + (page ? '?offset=' + page * COLLECTION_PAGE : '');

// ─── Card menu and artwork credit ───────────────────────────────────────────
function closeMenu(main, focus) {
  const menu = main.querySelector('.lib-menu');
  if (!menu) return;
  const owner = main.querySelector('[data-lib-act="menu"][aria-expanded="true"]');
  menu.remove();
  if (owner) {
    owner.setAttribute('aria-expanded', 'false');
    if (focus) owner.focus();
  }
}
function openMenu(main, btn) {
  const was = btn.getAttribute('aria-expanded') === 'true';
  closeMenu(main);
  if (was) return;
  const card = btn.closest('.lib-card');
  const cid = card.dataset.cid;
  const chosen = selectionState(cid) === 'true';
  const hasArt = card.dataset.art;
  const item = (act, ic, label) =>
    `<button type="button" role="menuitem" tabindex="-1" data-lib-act="${act}" data-cid="${esc(cid)}">${icon(ic, 16)}<span>${esc(label)}</span></button>`;
  btn.setAttribute('aria-expanded', 'true');
  btn.insertAdjacentHTML(
    'afterend',
    `<div class="lib-menu" role="menu" aria-label="${esc(btn.getAttribute('aria-label'))}">${item('open', 'book-open', 'Open collection')}${item('select', chosen ? 'check' : 'plus', chosen ? 'Remove selection' : 'Select readable units')}${hasArt ? item('credit', 'link', 'Artwork source & credit') : ''}</div>`
  );
  // Fixed to the viewport: the shelf scroller would clip it.
  const menu = main.querySelector('.lib-menu');
  const r = btn.getBoundingClientRect();
  const w = menu.offsetWidth,
    h = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  menu.style.top =
    (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';
  menu.querySelector('[role="menuitem"]')?.focus();
}
function menuKeys(main, e) {
  const menu = e.target.closest?.('.lib-menu');
  if (!menu) return false;
  const items = [...menu.querySelectorAll('[role="menuitem"]')];
  const i = items.indexOf(e.target);
  if (e.key === 'Escape') closeMenu(main, true);
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp')
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  else if (e.key === 'Home') items[0].focus();
  else if (e.key === 'End') items[items.length - 1].focus();
  else if (e.key === 'Tab') closeMenu(main);
  else return false;
  if (e.key !== 'Tab') e.preventDefault();
  return true;
}

// ─── Events ──────────────────────────────────────────────────────────────────
async function readableIds(cid) {
  if (!selectedFor.has(cid)) selectedFor.set(cid, (await lib.collection(cid)).readable_ids || []);
  return selectedFor.get(cid);
}
function refreshSelection(root) {
  root.querySelectorAll('.lib-card').forEach((card) => {
    const b = card.querySelector('[data-lib-act="select"]');
    const s = selectionState(card.dataset.cid);
    const title = card.querySelector('.lib-caption button')?.textContent || '';
    b.setAttribute('aria-pressed', s);
    b.setAttribute(
      'aria-label',
      `${s === 'true' ? 'Remove' : 'Add'} ${title} ${s === 'true' ? 'from' : 'to'} export selection`
    );
    b.innerHTML = icon(s === 'true' ? 'check' : 'plus', 17);
  });
  root
    .querySelectorAll('.lib-coll-list input[data-id]')
    .forEach((i) => (i.checked = selection.has(i.dataset.id)));
  const head = root.querySelector('.lib-coll-actions [data-lib-act="select"]');
  if (head) {
    const s = selectionState(head.dataset.cid);
    head.setAttribute('aria-pressed', s);
    head.querySelector('span').textContent =
      s === 'true' ? 'Remove all from selection' : 'Add all to selection';
  }
  const count = root.querySelector('[data-lib="sel-count"]');
  if (count) count.textContent = num(selection.size);
  const note = root.querySelector('[data-lib="sel-note"]');
  if (note) note.textContent = 'On this device' + (selection.unsaved ? ' · unsaved' : '');
}

function bind(main) {
  if (main.dataset.libCoreBound) return;
  main.dataset.libCoreBound = '1';
  selection.onChange(() => main.dataset.libraryChunk === 'core' && refreshSelection(main));
  main.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-lib-act="rail-lang"]')) {
      state.railLang = t.value;
      fillRail(main, currentCollection());
    } else if (t.matches('[data-lib-act="pick"]')) {
      t.checked ? selection.add(t.dataset.id) : selection.remove(t.dataset.id);
    }
  });
  document.addEventListener('click', (e) => !main.contains(e.target) && closeMenu(main));
  addEventListener('scroll', () => closeMenu(main), { capture: true, passive: true });
  addEventListener('resize', () => closeMenu(main));
  main.addEventListener('keydown', (e) => {
    if (menuKeys(main, e)) return;
    const s = e.target;
    if (
      s.classList?.contains('lib-shelf-scroll') &&
      (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
    ) {
      e.preventDefault();
      s.scrollBy({ left: (e.key === 'ArrowLeft' ? -1 : 1) * 186 });
    }
  });
  main.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-lib-act]');
    const inside = el && main.contains(el);
    if (el?.dataset.libAct !== 'menu') closeMenu(main);
    if (!inside || el.matches('select,input')) return;
    const act = el.dataset.libAct;
    const cid = el.dataset.cid || el.closest('[data-cid]')?.dataset.cid;
    try {
      if (act === 'menu') {
        openMenu(main, el);
      } else if (act === 'credit') {
        const card = main.querySelector(`.lib-card[data-cid="${CSS_ESC(cid)}"]`);
        // The artwork credit opens from a card's menu, never on first view.
        const rights = await libraryChunk('rights');
        await rights.credit(card?.dataset.art, card?.querySelector('[data-lib-act="menu"]'), lib);
      } else if (act === 'open') {
        // A collection chosen from the rail where it covers the page (narrow
        // widths, Jony #122): the rail closes and the collection's heading
        // takes focus (focusLostToHeading), said through #library-live.
        // Wider, the rail stays as it is.
        const rail = el.closest('.lib-rail');
        if (rail && railOverlays(rail)) {
          setRail(main, false, { quiet: true });
          state.railPicked = true;
        }
        lib.go('/collections/' + cid);
      } else if (act === 'play') {
        const first = firstOf.get(cid) || (await readableIds(cid))[0];
        if (first) lib.go('/read/' + first + '?play=1');
      } else if (act === 'read') {
        e.preventDefault();
        if (el.dataset.id) lib.go('/read/' + el.dataset.id);
      } else if (act === 'select') {
        const ids = await readableIds(cid);
        if (selectionState(cid) === 'true') selection.remove(ids);
        else selection.add(ids);
      } else if (act === 'go') {
        lib.go(el.dataset.sub || '');
      } else if (act === 'rail') {
        setRail(main, !state.rail);
      } else if (act === 'rail-retry') {
        fillRail(main, currentCollection());
      } else if (act === 'more') {
        const lang = el.dataset.lang;
        const catalog = await lib.catalog();
        const shelf = catalog.shelves.find((s) => s.language === lang);
        const { collections } = await lib.collections();
        const rows = collections.map(fromRow).filter((c) => c.readable > 0 && c.language === lang);
        state.shelfShown[lang] = (state.shelfShown[lang] || shelf.cards.length) + SHELF_BATCH;
        const section = el.closest('.lib-shelf');
        const scrollLeft = section.querySelector('.lib-shelf-scroll').scrollLeft;
        section.outerHTML = shelfHtml(shelf, rows);
        const next = main.querySelector(
          `.lib-shelf[data-lang="${CSS_ESC(lang)}"] .lib-shelf-scroll`
        );
        if (next) (restoreShelf(next.closest('.lib-shelf'), 0), (next.scrollLeft = scrollLeft));
      } else if (act === 'page') {
        await lib.go(collectionSub(cid, Math.max(0, Number(el.dataset.page) || 0)));
      } else if (act === 'retry') {
        render(main, LIBRARY.sub, { retry: true });
      }
    } catch (error) {
      console.error('[library]', error);
      if (typeof showToast === 'function') showToast(String(error.message || error), 'error');
    }
  });
}
// The site's button markup (uiButton) under this chunk's own click handler.
const libButton = (act, label, ic, extra = '') =>
  `<button type="button" data-lib-act="${act}" ${extra.includes('aria-label=') ? '' : `aria-label="${esc(label)}"`} ${extra}>${icon(ic, 18)}<span>${esc(label)}</span></button>`;
const CSS_ESC = (s) => (window.CSS?.escape ? window.CSS.escape(s) : s);
function currentCollection() {
  const m = /^\/collections\/([^/?]+)/.exec(LIBRARY.sub || '');
  return m ? decodeURIComponent(m[1]) : null;
}

async function render(main, sub, { retry = false } = {}) {
  ensureStyles();
  bind(main);
  main.dataset.libraryChunk = 'core';
  const token = ++state.token;
  const coll = /^\/collections\/([^/?]+)/.exec(sub);
  if (!main.querySelector('.lib-core'))
    main.innerHTML = `<div class="lib-core-main"><div class="lib-skel" aria-hidden="true"></div><div class="lib-skel" aria-hidden="true"></div></div>`;
  try {
    // A collection page is never the shelves' first view: the Works chunk
    // draws it, from the parts of core it shares.
    if (coll) {
      const works = await libraryChunk('works');
      if (token !== state.token) return;
      await works.collection(main, decodeURIComponent(coll[1]), token, collectionOffset(sub), {
        lib,
        state,
        selection,
        selectedFor,
        selectionState,
        fillRail,
        railHtml,
        toplineHtml,
        artHtml,
        fromRow,
        shortTitle,
        plural,
        num,
        libButton,
        collectionSub,
        COLLECTION_PAGE,
      });
    } else await showExplore(main, token);
    if (retry && token === state.token) {
      const h = main.querySelector('.lib-core-main h1');
      lib.settle(
        h || main.querySelector('.lib-shelf-scroll') || main.querySelector('.lib-core-main button'),
        h ? `${h.textContent} loaded` : 'Library catalog loaded'
      );
    }
  } catch (error) {
    if (token !== state.token) return;
    console.error('[library]', error);
    main.innerHTML = error.stale
      ? uiEmptyState({
          title: 'The Library was just updated',
          text: 'Reload to read the current catalog.',
          actions: uiButton('lib-reload', 'Reload', 'refresh-cw'),
          tone: 'danger',
          role: '',
        })
      : uiEmptyState({
          title: 'The Library catalog did not load',
          text: lib.problem(error),
          actions: libButton('retry', 'Retry', 'refresh-cw', ''),
          tone: 'danger',
          role: '',
        });
    // Said through #library-live every time; focus moves only after a Retry.
    lib.settle(
      retry ? main.querySelector('[data-lib-act="retry"], [data-ui="lib-reload"]') : null,
      failed(main)
    );
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────
async function show(main, sub = '') {
  // The first view after a page load is a landing, not an in-app step:
  // nothing asked for focus, so it stays where the browser put it and the
  // first Tab reaches the skip link (Jony #129). Later views may land focus
  // on their heading when the control that opened them went away.
  lib.fresh = !state.shown;
  state.shown = true;
  const path = sub.split('?')[0];
  const chunk = /^\/works(\/|$)/.test(path)
    ? 'works'
    : /^\/rights(\/|$)/.test(path)
      ? 'rights'
      : /^\/read\//.test(path)
        ? 'reader'
        : null;
  if (!chunk) {
    if (main.dataset.libraryChunk !== 'core') main.innerHTML = '';
    return render(main, sub);
  }
  ensureStyles();
  main.dataset.libraryChunk = chunk;
  const token = ++state.token;
  try {
    const mod = await libraryChunk(chunk);
    if (token !== state.token) return;
    return await mod.show(main, sub, lib);
  } catch (error) {
    if (token !== state.token) return;
    console.error('[library]', error);
    main.innerHTML = uiEmptyState({
      title: 'This part of the Library did not load',
      text: lib.problem(error),
      actions: uiButton('lib-reload', 'Reload', 'refresh-cw'),
      tone: 'danger',
      role: '',
    });
    lib.settle(null, failed(main));
  }
}

return { show, lib };

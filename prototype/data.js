import { pageEngine } from './engine/load.js';

// What the shell loads for feature lanes (#670 slice P2). Lanes fetch
// nothing themselves: every read is here, read-only, from committed files
// beside the site, with literal paths only (check_prototype_isolation.js).

async function json(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// The review status of a place, from data/geo-meta.json. `verified` is a
// human audit and `reviewed` a model pass; the file's note says they are not
// the same claim, so neither is reported as the other.
function provenanceOf(meta) {
  const verified = new Set(meta.verified || []);
  const reviewed = new Set(meta.reviewed || []);
  return (id) =>
    verified.has(id)
      ? { status: 'verified' }
      : reviewed.has(id)
        ? { status: 'reviewed', method: meta.reviewed_method, on: meta.reviewed_on }
        : { status: 'unreviewed' };
}

// ctx.items for the browse lane: [{ id, name, family, place }], frozen, in
// the catalog's own order (api/traditions/index.json). `place` is the
// catalog's record from data/geo.json, { lat, lng, label, region,
// provenance }, or null for a tradition data/no-fixed-origin.json lists:
// no honest place on the map. Nothing here invents or derives a coordinate.
export async function loadItems() {
  const [index, geo, meta, noOrigin] = await Promise.all([
    fetch('../api/traditions/index.json').then(json),
    fetch('../data/geo.json').then(json),
    fetch('../data/geo-meta.json').then(json),
    fetch('../data/no-fixed-origin.json').then(json),
  ]);
  const none = new Set(noOrigin.ids || []);
  const provenance = provenanceOf(meta);
  const items = (index.items || []).map((t) => {
    const g = geo[t.id];
    const place =
      none.has(t.id) || !Array.isArray(g)
        ? null
        : Object.freeze({
            lat: g[0],
            lng: g[1],
            label: g[2],
            region: g[3],
            provenance: Object.freeze(provenance(t.id)),
          });
    return Object.freeze({ id: t.id, name: t.name, family: t.family, place });
  });
  return Object.freeze(items);
}

// ── The Library lane (#670 6640163315, 6640718497) ─────────────────────────
// Read-only, from the committed library/data/ beside the site, with the same
// mappings production uses (src/library/core.js fromShelf/fromRow, Play).

const COLLECTION = /^collection_[0-9a-f-]{36}$/;
const libError = (code, message) => Object.assign(new Error(message), { code });
// What a person reads when a Library call fails: a sentence, with what to do
// next. A raw "HTTP 404" or "Failed to fetch" never reaches the page (Jony,
// #744 6642173271). NO_READABLE's sentence is at its one call site.
export const LIBRARY_MESSAGES = Object.freeze({
  NOT_FOUND: 'This collection isn’t in the Library’s data. Reload to see the current collections.',
  LOAD_FAILED: 'The Library’s collections couldn’t load. Check your connection, then try again.',
  DATA_CHANGED:
    'The Library data changed since this page loaded. Reload to see the current collections.',
});
const libFail = (code) => libError(code, LIBRARY_MESSAGES[code]);

async function inflated(response) {
  if (!response.ok) {
    throw libFail(response.status === 404 ? 'NOT_FOUND' : 'LOAD_FAILED');
  }
  let bytes = new Uint8Array(await response.arrayBuffer());
  // A .json.gz arrives as gzip bytes unless the host already decoded it.
  if (bytes.length > 1 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

// The one computed path the shell reads: a collection file, by an id that
// must look like one (check_prototype_isolation.js allows only this form).
export function collectionFile(id) {
  if (typeof id !== 'string' || !COLLECTION.test(id)) {
    throw libFail('NOT_FOUND');
  }
  return fetch(`../library/data/c/${id}.json.gz`).then(inflated);
}

// Copied from src/library/core.js LANGUAGE_NAMES, so a shelf is named as the
// live Library names it. check_prototype_hosts.js compares the two.
const LANGUAGE = {
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

// ctx.shelves, ctx.loadMore and ctx.openReading's resolution for the Library
// lane. A shelf card's `first` is the catalog's first readable unit; a card
// appended by loadMore has first: null (as production's fromRow does), and
// openReading resolves it from the collection file.
export async function loadLibrary() {
  const [catalog, artwork] = await Promise.all([
    fetch('../library/data/catalog.json').then(json),
    fetch('../library/data/artwork.json').then(json),
  ]);
  const art = new Map((artwork.artwork || []).map((a) => [a.id, a]));
  const card = (c) => {
    const a = c.art && art.get(c.art);
    return Object.freeze({
      ...c,
      ...(a
        ? { artworkUrl: `../assets/library/art/${c.art}-480.webp`, artworkLabel: a.title }
        : {}),
    });
  };
  const first = new Map();
  const shelves = Object.freeze(
    catalog.shelves.map((s) =>
      Object.freeze({
        language: s.language,
        languageLabel: LANGUAGE[s.language] || s.language,
        total: s.total,
        cards: Object.freeze(
          s.cards.map((t) => {
            first.set(t[0], t[5]);
            return card({
              id: t[0],
              title: t[1],
              language: s.language,
              readable: t[2],
              recorded: t[3],
              art: t[4],
              first: t[5],
            });
          })
        ),
      })
    )
  );
  const shown = new Map(shelves.map((s) => [s.language, s.cards.length]));
  let rows = null;
  const all = async () => {
    if (!rows) {
      rows = fetch('../library/data/collections.json')
        .then(json)
        .then((file) => {
          if (file.data_id !== catalog.data_id) {
            throw libFail('DATA_CHANGED');
          }
          return file.collections;
        })
        .catch((e) => {
          rows = null; // a failure is forgotten, so the next Show more asks again
          throw e.code ? e : libFail('LOAD_FAILED');
        });
    }
    return rows;
  };
  async function loadMore(language, count) {
    const shelf = shelves.find((s) => s.language === language);
    if (!shelf) throw libFail('NOT_FOUND');
    const list = (await all()).filter((r) => r[3] > 0 && r[2] === language);
    const from = shown.get(language);
    const next = list.slice(from, from + Math.max(0, count | 0)).map((r) =>
      card({
        id: r[0],
        title: r[1],
        language: r[2],
        readable: r[3],
        recorded: r[4],
        art: r[5],
        first: null,
      })
    );
    shown.set(language, from + next.length);
    return { cards: Object.freeze(next), total: shelf.total };
  }
  async function unitOf(collectionId) {
    const known = first.get(collectionId);
    if (known) return known;
    const file = await collectionFile(collectionId).catch((e) => {
      throw e.code ? e : libFail('LOAD_FAILED');
    });
    if (file.data_id && file.data_id !== catalog.data_id) {
      throw libFail('DATA_CHANGED');
    }
    const id = (file.readable_ids || [])[0];
    if (!id) throw libError('NO_READABLE', 'This collection has no readable work yet.');
    return id;
  }
  return { shelves, loadMore, unitOf, art, catalog };
}

// ── The Library's reference lanes (#747 census and credits, #750 methods) ──
// The committed files themselves, deep-frozen, so a lane reads exactly what
// the live Library reads and can't change it for another lane.
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

// ctx.catalog, ctx.artwork and ctx.artworkUrls for the census-and-credits lane
// (#668 6642118480). A key in artworkUrls only for an artwork artwork.json
// lists: every one has its renditions committed under assets/library/art/,
// which check_prototype_hosts.js confirms on disk.
export async function loadLibraryCredits() {
  const [catalog, artwork] = await Promise.all([
    fetch('../library/data/catalog.json').then(json),
    fetch('../library/data/artwork.json').then(json),
  ]);
  const artworkUrls = {};
  for (const a of artwork.artwork || []) {
    if (typeof a.id === 'string' && /^[\w-]+$/.test(a.id)) {
      artworkUrls[a.id] = `../assets/library/art/${a.id}-480.webp`;
    }
  }
  return {
    catalog: deepFreeze(catalog),
    artwork: deepFreeze(artwork),
    artworkUrls: Object.freeze(artworkUrls),
  };
}

// ctx.registry for the method-reference lane: library/data/methods.json whole.
export async function loadMethodRegistry() {
  return { registry: deepFreeze(await fetch('../library/data/methods.json').then(json)) };
}

// ── The Genre detail lane (#668 6645589522, 6645704407) ────────────────────
// One genre's header and Background, from the files production's lazy page
// reads: api/browse_boot.json (name, family, parent, status), its
// browse_prose.json (description, lineage, exemplars), api/tradition_images.json
// (the photo), data/geo.json (the place), and data/tree-nodes.json for the
// taxonomy path: references/04_tree.js's TREE_NODES as { id: { n, p } },
// kept fresh by build_atlas_tree.js --check. Each is read once, on the
// first loadGenre, and shared; a failure is forgotten, so the next call asks
// again.
export const GENRE_MESSAGES = Object.freeze({
  NOT_FOUND: 'This genre isn’t in the catalog’s data. Reload to see the current catalog.',
  LOAD_FAILED: 'This genre’s details couldn’t load. Check your connection, then try again.',
});
const genreFail = (code) => Object.assign(new Error(GENRE_MESSAGES[code]), { code });
const abortError = () => new DOMException('The genre load was aborted.', 'AbortError');

export function genreLoader() {
  let files = null;
  const load = () => {
    if (!files) {
      files = Promise.all([
        fetch('../api/browse_boot.json').then(json),
        fetch('../api/browse_prose.json').then(json),
        fetch('../api/tradition_images.json').then(json),
        fetch('../data/geo.json').then(json),
        fetch('../data/geo-meta.json').then(json),
        fetch('../data/no-fixed-origin.json').then(json),
        fetch('../data/tree-nodes.json').then(json),
      ])
        .then(([boot, prose, images, geo, meta, noOrigin, tree]) => ({
          boot: new Map(boot.items.map((t) => [t.id, t])),
          aliases: boot.aliases || {},
          prose: new Map(prose.items.map((t) => [t.id, t])),
          photos: images.traditions || {},
          geo,
          none: new Set(noOrigin.ids || []),
          provenance: provenanceOf(meta),
          nodes: new Map(
            Object.entries(tree).map(([id, n]) => [id, { id, name: n.n, parent: n.p }])
          ),
        }))
        .catch(() => {
          files = null;
          throw genreFail('LOAD_FAILED');
        });
    }
    return files;
  };
  // production's gpPath: from the genre's parent up, root first, stopping at
  // a missing node or a repeat.
  const pathOf = (f, parent) => {
    const out = [];
    const seen = new Set();
    for (let p = parent; p && !seen.has(p); ) {
      seen.add(p);
      const node = f.nodes.get(p);
      if (!node) break;
      out.unshift(Object.freeze({ id: node.id, name: node.name }));
      p = node.parent;
    }
    return Object.freeze(out);
  };
  // The files are shared, so an abort ends the caller's wait, not the read.
  const until = (promise, signal) =>
    !signal
      ? promise
      : signal.aborted
        ? Promise.reject(abortError())
        : new Promise((resolve, reject) => {
            const stop = () => reject(abortError());
            signal.addEventListener('abort', stop, { once: true });
            promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', stop));
          });
  async function loadGenre(id, { signal } = {}) {
    const f = await until(load(), signal);
    const live = f.boot.has(id) ? id : f.aliases[id] && f.aliases[id].of;
    const t = live && f.boot.get(live);
    if (!t) throw genreFail('NOT_FOUND');
    const p = f.prose.get(live) || {};
    const g = f.geo[live];
    const photo = f.photos[live];
    return Object.freeze({
      id: live,
      name: t.name,
      family: t.family,
      lineage: p.lineage || t.lineage || null,
      description: p.description || t.description || null,
      exemplars: Object.freeze(
        (p.exemplars || t.exemplars || []).filter((x) => typeof x === 'string' && x.trim())
      ),
      status: t.status || null,
      path: pathOf(f, t.parent || null),
      place:
        f.none.has(live) || !Array.isArray(g)
          ? null
          : Object.freeze({
              label: g[2],
              region: g[3],
              provenance: Object.freeze(f.provenance(live)),
            }),
      photo: Array.isArray(photo) ? Object.freeze([...photo]) : null,
    });
  }
  return { loadGenre };
}

// ── The Instrument detail lane (#668 6646057912) ───────────────────────────
// production's ipRenderInspector header: identity, family, class, photo and
// glyph. The record is api/instruments/<id>.json, read only for an id the
// index lists; the family names and the glyph live only in the page, so they
// come from codex.html's own tables and image() (prototype/engine/load.js).
export const INSTRUMENT_MESSAGES = Object.freeze({
  NOT_FOUND: 'This instrument isn’t in the catalog’s data. Reload to see the current catalog.',
  LOAD_FAILED: 'This instrument’s details couldn’t load. Check your connection, then try again.',
});
const instrumentFail = (code) => Object.assign(new Error(INSTRUMENT_MESSAGES[code]), { code });
// The SVG namespace an <img> needs; a name, not a request.
const SVG_NS = 'http://www.w3.org/2000/svg';
// production's ipHuman: underscores to spaces, first letter capitalised.
const human = (s) => {
  const t = String(s || '').replaceAll('_', ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};
// An abort ends the caller's wait; the shared reads carry on for the next call.
const waitFor = (promise, signal) =>
  !signal
    ? promise
    : signal.aborted
      ? Promise.reject(new DOMException('The load was aborted.', 'AbortError'))
      : new Promise((resolve, reject) => {
          const stop = () => reject(new DOMException('The load was aborted.', 'AbortError'));
          signal.addEventListener('abort', stop, { once: true });
          promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', stop));
        });

export function instrumentLoader() {
  let shared = null;
  const records = new Map();
  const load = () => {
    if (!shared)
      shared = Promise.all([
        fetch('../api/instruments/index.json').then(json),
        fetch('../api/instrument_images.json').then(json),
        pageEngine(),
      ])
        .then(([index, images, engine]) => ({
          ids: new Set((index.items || []).map((i) => i.id)),
          photos: images.instruments || {},
          engine,
          families: new Map(engine.INSTRUMENT_FAMILIES.map((f) => [f.id, f.name])),
        }))
        .catch(() => {
          shared = null;
          throw instrumentFail('LOAD_FAILED');
        });
    return shared;
  };
  // The one computed read here, for an id the index lists
  // (check_prototype_isolation.js allows only this form, in this file).
  const record = (id) => {
    if (!records.has(id))
      records.set(
        id,
        fetch(`../api/instruments/${id}.json`)
          .then(json)
          .catch(() => {
            records.delete(id);
            throw instrumentFail('LOAD_FAILED');
          })
      );
    return records.get(id);
  };
  async function loadInstrument(id, { signal } = {}) {
    const f = await waitFor(load(), signal);
    if (typeof id !== 'string' || !f.ids.has(id)) throw instrumentFail('NOT_FOUND');
    const r = await waitFor(record(id), signal);
    const svg = f.engine.image(id, 32);
    const photo = f.photos[id];
    return Object.freeze({
      id: r.id,
      name: r.name,
      short: r.short || null,
      family: Object.freeze({ id: r.family, name: f.families.get(r.family) || null }),
      class: Object.freeze({ id: r.class || null, name: r.class ? human(r.class) : null }),
      photo: Array.isArray(photo) ? Object.freeze([...photo]) : null,
      glyphUrl: svg
        ? `data:image/svg+xml,${encodeURIComponent(svg.replace('<svg ', `<svg xmlns="${SVG_NS}" `))}`
        : null,
    });
  }
  return { loadInstrument };
}

// ── The reader (#757) ──────────────────────────────────────────────────────
// ctx.reading(unitId) → { head, loadPage(index, { signal }) }, as production's
// reader opens and checks a reading (src/library/reader.js openReading,
// loadPage): the unit's shard gives its <rev16>-<proj12> key; the head's
// sha256 must begin with proj12 and each page's sha256 must equal the digest
// the head lists; every file must name this unit, revision, page index and
// page count. Any mismatch is DATA_CHANGED and no text is returned. Pages
// are returned as the committed files hold them; the lane derives the lines.
export const READING_MESSAGES = Object.freeze({
  NOT_FOUND: 'This reading isn’t in the Library’s data. Reload to see the current collections.',
  LOAD_FAILED: 'The reading couldn’t load. Check your connection, then try again.',
  DATA_CHANGED:
    'This reading changed or failed its checks, so no text is shown. Reload to see the current collections.',
});
const readingFail = (code) => Object.assign(new Error(READING_MESSAGES[code]), { code });
const UNIT = /^reading_([0-9a-f]{2})[0-9a-f]{6}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// The reader's files, and nothing else under library/data/
// (check_prototype_isolation.js allows only this computed read, in this file).
const READING_FILE =
  /^(?:u\/[0-9a-f]{2}\.json\.gz|r\/[0-9a-f]{2}\/reading_[0-9a-f-]{36}\/[0-9a-f]{16}-[0-9a-f]{12}\/(?:head|[1-9]\d*-[0-9a-f]{12})\.json\.gz)$/;
const hexOf = (buf) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (bytes) => hexOf(await crypto.subtle.digest('SHA-256', bytes));

async function readingBytes(rel, signal) {
  if (!READING_FILE.test(rel)) throw readingFail('NOT_FOUND');
  let res;
  try {
    res = await fetch(`../library/data/${rel}`, { signal });
  } catch (e) {
    throw e && e.name === 'AbortError' ? e : readingFail('LOAD_FAILED');
  }
  if (!res.ok) throw readingFail(res.status === 404 ? 'NOT_FOUND' : 'LOAD_FAILED');
  let bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > 1 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return bytes;
}
const parse = (bytes) => {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw readingFail('DATA_CHANGED');
  }
};

export function readingLoader() {
  const shards = new Map();
  const shard = (hh) => {
    if (!shards.has(hh))
      shards.set(
        hh,
        readingBytes(`u/${hh}.json.gz`)
          .then(parse)
          .catch((e) => {
            shards.delete(hh);
            throw e;
          })
      );
    return shards.get(hh);
  };
  async function reading(unitId, { signal } = {}) {
    const m = typeof unitId === 'string' && UNIT.exec(unitId);
    if (!m) throw readingFail('NOT_FOUND');
    const hit = ((await shard(m[1])).units || []).find((u) => u[0] === unitId);
    if (!hit || typeof hit[1] !== 'string' || !/^[0-9a-f]{16}-[0-9a-f]{12}$/.test(hit[1]))
      throw readingFail('NOT_FOUND');
    const key = hit[1];
    const dir = `r/${m[1]}/${unitId}/${key}/`;
    const raw = await readingBytes(`${dir}head.json.gz`, signal);
    if ((await sha256(raw)).slice(0, 12) !== key.slice(17)) throw readingFail('DATA_CHANGED');
    const head = parse(raw);
    const same = (file, index) =>
      file &&
      file.reading_unit_id === unitId &&
      file.reading_revision === head.reading_revision &&
      file.page_index === index &&
      file.page_count === head.page_count;
    if (
      !same(head, 0) ||
      !Array.isArray(head.pages) ||
      head.page_count !== head.pages.length + 1 ||
      typeof head.reading_revision !== 'string' ||
      !head.reading_revision.startsWith(key.slice(0, 16))
    )
      throw readingFail('DATA_CHANGED');
    deepFreeze(head);
    async function loadPage(index, { signal: pageSignal } = {}) {
      if (!Number.isInteger(index) || index < 0 || index >= head.page_count)
        throw readingFail('NOT_FOUND');
      if (index === 0) return head;
      const digest = head.pages[index - 1];
      if (typeof digest !== 'string' || !/^[0-9a-f]{64}$/.test(digest))
        throw readingFail('DATA_CHANGED');
      const bytes = await readingBytes(`${dir}${index}-${digest.slice(0, 12)}.json.gz`, pageSignal);
      if ((await sha256(bytes)) !== digest) throw readingFail('DATA_CHANGED');
      const page = parse(bytes);
      if (!same(page, index)) throw readingFail('DATA_CHANGED');
      return deepFreeze(page);
    }
    return Object.freeze({ head, loadPage });
  }
  return { reading };
}

// The whole reading's lines for read-aloud (#758): every verified page, in
// order, as { analysis_line, text }. analysis_line is the page's shipped
// number (production's derive asserts it equals the derived one) and null
// for a line that isn't sung.
export async function readingLines(record, { signal } = {}) {
  const out = [];
  for (let i = 0; i < record.head.page_count; i++) {
    const page = await record.loadPage(i, { signal });
    for (const row of page.lines) {
      out.push(Object.freeze({ analysis_line: row[4] == null ? null : row[4], text: row[1] }));
    }
  }
  return Object.freeze(out);
}

// ── The Genre discovery hosts (#668 6665493327) ─────────────────────────────
// What prototype/discovery.js ranks and counts: every genre in
// api/browse_boot.json with its parent, cross-references and its 13 axes by
// name (the file lists them in axisKeys order), and the page's own taxonomy,
// glyphs and axis definitions from codex.html (prototype/engine/load.js).
export async function loadGenreDiscovery() {
  const [boot, engine] = await Promise.all([
    fetch('../api/browse_boot.json').then(json),
    pageEngine(),
  ]);
  const keys = boot.axisKeys || [];
  const items = (boot.items || []).map((t) => ({
    id: t.id,
    name: t.name,
    parent: t.parent || null,
    crossRefs: Array.isArray(t.crossRefs) ? t.crossRefs : [],
    axes: Object.fromEntries(keys.map((k, i) => [k, (t.axes || [])[i]])),
  }));
  return { items, page: engine };
}

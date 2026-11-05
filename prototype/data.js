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

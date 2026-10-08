// The three browse tables, all derived from the catalog. One definition, two
// readers: build_static_api.js writes them into api/, and check_api.js holds
// the committed files to exactly what these functions derive.
//
//   browse.json        the published Tier-1 index (api/index.json "browse"):
//                      every genre with its prose. Agents read it; the app no
//                      longer does.
//   browse_boot.json   what the lazy app's first view needs: every genre
//                      WITHOUT its prose (lineage, description, exemplars),
//                      except the genres the Genre page opens on
//                      (STARTER_TRADITIONS in src/app.js), plus each genre's
//                      catalog status.
//   browse_prose.json  the prose of every genre, read after the first paint.
//
// WHY THE SPLIT. Prose is 85% of browse.json's transfer (1.88 of 2.13 MB
// gzip), and the first view shows the prose of one genre. The app boots from
// browse_boot.json (0.24 MB gzip) and merges the prose by id when it lands.
//
// This module reads no file: starterIds is handed src/app.js's text, so
// check_api.js, which some fault classes run without src/, never reads it.
'use strict';

// Canonical 13-axis order — the browse index stores axes as a compact array in
// this order (named keys would repeat 13× per tradition and bloat the index at
// scale). The app maps array→named on load via the file's `axisKeys` header.
const AXIS_KEYS = [
  'harm',
  'pitch',
  'ornament',
  'meter',
  'density',
  'transmission',
  'improv',
  'soundTech',
  'intensity',
  'voice',
  'timbre',
  'percussion',
  'cyclicity',
];

const PROSE_KEYS = ['lineage', 'description', 'exemplars'];

// A sanity bound on how many genres browse_boot.json carries prose for:
// check_api.js cannot read src/, so check_lazy_app.js holds the exact set
// (the page's own STARTER_TRADITIONS).
const BOOT_PROSE_MAX = 12;

// A browse.json item. Optional fields ship only when non-empty — at catalog
// scale the empty markers alone are real bytes, and the app's guards treat
// absent and empty identically.
function browseItem(t, ext) {
  const b = {
    id: t.id,
    name: t.name,
    family: t.family,
    lineage: t.lineage || null,
    parent: ext.parent || null,
    axes: AXIS_KEYS.map((k) => (ext.axes && typeof ext.axes[k] === 'number' ? ext.axes[k] : 0)),
    instruments: t.instruments || [],
    description: ext.description || '',
  };
  if (ext.exemplars && ext.exemplars.length) b.exemplars = ext.exemplars;
  if (ext.crossRefs && ext.crossRefs.length) b.crossRefs = ext.crossRefs;
  return b;
}

// A browse_boot.json item: the browse.json item with its prose left out unless
// `withProse`, and the catalog status when there is one. An item carries its
// prose whole or not at all; the app tests `typeof description === 'string'`.
function bootItem(item, ext, withProse) {
  const o = {};
  for (const k of Object.keys(item)) if (withProse || !PROSE_KEYS.includes(k)) o[k] = item[k];
  if (ext && ext.status) o.status = ext.status;
  return o;
}

// A browse_prose.json item. The app merges by id, never by position, so a
// stale cached pair after a deploy can leave a genre without prose but never
// puts prose on the wrong genre.
function proseItem(item) {
  const o = { id: item.id, lineage: item.lineage, description: item.description };
  if (item.exemplars) o.exemplars = item.exemplars;
  return o;
}

// The Genre page's starter ids, read from src/app.js's text so the page stays
// the one place they are listed. Fails closed.
function starterIds(appSrc) {
  const m = /const STARTER_TRADITIONS = \[([\s\S]*?)\];/.exec(appSrc);
  const ids = m
    ? [...m[1].replace(/\/\/.*$/gm, '').matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1])
    : [];
  if (!ids.length) throw new Error('_browse_tables: STARTER_TRADITIONS not found in src/app.js');
  return ids;
}

function bootIndex(items, extras, starters) {
  const keep = new Set(starters);
  return {
    name: "Codex Musica — boot index (the lazy app's first view: every genre without its prose, plus the starter genres'; internal — the published index is browse.json)",
    axisKeys: AXIS_KEYS,
    count: items.length,
    items: items.map((it) => bootItem(it, extras[it.id], keep.has(it.id))),
  };
}

function proseIndex(items) {
  return {
    name: 'Codex Musica — genre prose (lineage, description, exemplars; read by the lazy app after its first paint; internal)',
    count: items.length,
    items: items.map(proseItem),
  };
}

module.exports = {
  AXIS_KEYS,
  PROSE_KEYS,
  BOOT_PROSE_MAX,
  browseItem,
  bootItem,
  proseItem,
  starterIds,
  bootIndex,
  proseIndex,
};

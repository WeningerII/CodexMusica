// The two photo tables the browser app reads, both derived from
// references/_image_manifest.json (openly licensed image links, produced by
// scripts/fetch_image_manifest.js). One definition, three readers:
// build_static_api.js writes them into api/, build_html.js inlines the
// instrument table into the embedded build, and check_api.js holds the
// committed api/ files to exactly what these functions derive.
//
// WHY THEY ARE SEPARATE FILES. The manifest is 8.3 MB (640 KB gzip) and the
// genre page used to fetch all of it on first view to read 8 fields of its
// 7,028 tradition entries, while the 1,667 instrument entries also rode inline
// in every page as CODEX_IMAGE_MANIFEST (579 KB). Each page now reads only its
// own table, and the lazy shell reads both from api/ when it needs them.
'use strict';

const fs = require('fs');

// The manifest object, or null when the file does not exist yet (the pages
// then show glyphs).
function readImageManifest(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const SOURCE = 'references/_image_manifest.json';

// The Instrument page's table: per instrument id the thumbnail, licence,
// credit and source page, as [thumb, licence, credit, sourcePage, fullImage?]
// (the full image only when it is not the thumb itself). Low-confidence matches
// (a stand-in of the same kind, e.g. a generic frame drum for an obscure one)
// are kept: the owner prefers a representative picture to the glyph. Picks a
// review found wrong are dropped upstream via REJECTED in
// scripts/fetch_image_manifest.js. No manifest: null, and the page shows
// glyphs. Moved verbatim from scripts/build_html.js (compactImageManifest).
function compactInstrumentImages(m) {
  if (!m) return null;
  const out = {};
  for (const e of Array.isArray(m.images) ? m.images : []) {
    if (!e || e.kind !== 'instrument') continue;
    const thumb = e.thumb_url || e.image_url;
    if (typeof e.id !== 'string' || typeof thumb !== 'string' || !/^https:\/\//.test(thumb))
      continue;
    out[e.id] = [thumb, e.license_raw || e.license || '', e.credit || '', e.source_page || ''];
    // The photo lightbox (uiLightbox) shows the full image when no larger
    // Commons rendition of the thumb loads.
    if (typeof e.image_url === 'string' && /^https:\/\//.test(e.image_url) && e.image_url !== thumb)
      out[e.id].push(e.image_url);
  }
  const ids = Object.keys(out).sort();
  return {
    source: SOURCE,
    instruments: Object.fromEntries(ids.map((id) => [id, out[id]])),
  };
}

// The Genre page's table: per tradition id in the catalog,
// [thumb, licence, credit, sourcePage, full?], read back by gpIndexImages in
// src/pages/genre.js. The page's own reading rules are applied here, so what it
// shows is identical to reading the manifest itself:
//   • only `kind: 'tradition'` entries whose id is a catalog tradition;
//   • the thumb is `thumb_url` as written (gpImage refuses a non-https scheme
//     at read time, and so still does);
//   • the licence is `license_raw`, else `license`, and the credit, each with
//     its whitespace collapsed exactly as gpImage collapses it;
//   • `full` is omitted when the entry has no string `image_url`, is 1 when
//     it equals the thumb (4,586 of 7,028 on 2026-10-06), and is the URL
//     otherwise. It is kept, not dropped: gpImage hands it to uiPhoto as the
//     lightbox image.
function compactTraditionImages(m, catalogIds) {
  const known = new Set(catalogIds);
  const text = (x) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : '');
  const out = {};
  for (const e of m && Array.isArray(m.images) ? m.images : []) {
    if (!e || e.kind !== 'tradition' || typeof e.id !== 'string' || !known.has(e.id)) continue;
    if (typeof e.thumb_url !== 'string') continue;
    const row = [
      e.thumb_url,
      text(e.license_raw) || text(e.license),
      text(e.credit),
      typeof e.source_page === 'string' ? e.source_page : '',
    ];
    if (typeof e.image_url === 'string') row.push(e.image_url === e.thumb_url ? 1 : e.image_url);
    out[e.id] = row;
  }
  const ids = Object.keys(out).sort();
  return { source: SOURCE, traditions: Object.fromEntries(ids.map((id) => [id, out[id]])) };
}

module.exports = { readImageManifest, compactInstrumentImages, compactTraditionImages };

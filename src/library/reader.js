// ─── Library chunk: reader ─────────────────────────────────────────────────
// Wrapped by the build as CMLibraryDefine('reader', function () { … }).
// '#library/read/<id>?offset=&compare=&line=&span=&precision=&lens=&view=&autoplay='
// (docs/library-native-design.md, features 19-26, 31, 44, 45 and the Lyrics
// handoff). Ported from sites/library/components/library/reader.tsx and
// text-marks.tsx.
//
// Data: the reading's static directory r/<hh>/<id>/<rev16>-<proj12>/ holds a
// head (rows 0-249) and content-hashed page files of 250 rows. The head's
// sha256 begins with proj12, each page's sha256 is listed in the head, and
// every file embeds {reading_unit_id, reading_revision, page_index,
// page_count}: any mismatch fails closed (no text is shown). Line ids
// (UUIDv5) and normalized code-point/UTF-16 ranges are derived from each
// page's start counters exactly as catalog_static_export.replay does.
/* global esc, icon, uiEmptyState, uiOpenInLyrics, uiDownload, libraryChunk, CMLibraryImport */
'use strict';

const PAGE_ROWS = 250;
const WINDOW_PAGES = 3; // <= 750 rows in the DOM
const LINE_NS = '7b347e4c-4ea7-5cbf-8387-2975a17890f3';
const SOURCE_BASIS_FIELDS = [
  'sources',
  'file_sources',
  'source_declarations',
  'source_locators',
  'required_attribution',
  'layers',
];
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
const SPEECH_TAGS = {
  eng: 'en',
  fas: 'fa',
  fin: 'fi',
  cym: 'cy',
  non: 'is',
  ltc: 'zh',
  msa: 'ms',
  san: 'sa',
  som: 'so',
};
const LENSES = [
  ['summary', 'Summary'],
  ['sound', 'Sound'],
  ['form', 'Form'],
  ['rhythm', 'Rhythm'],
  ['language', 'Language'],
  ['sources', 'Sources'],
];
const SHOWN_KINDS = new Set(['lyric', 'blank', 'structure']);
const TRANSFER_BYTES =
  (typeof CMLibraryImport !== 'undefined' && CMLibraryImport.TRANSFER_BYTES) || 8 * 1024 * 1024;

// ─── bytes, hashes, ids ────────────────────────────────────────────────────
const enc = new TextEncoder();
const dec = new TextDecoder();
const hex = (buf) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (bytes) =>
  hex(await crypto.subtle.digest('SHA-256', typeof bytes === 'string' ? enc.encode(bytes) : bytes));
const u16len = (s) => s.length;
const cplen = (s) => Array.from(s).length;
const nsBytes = Uint8Array.from(LINE_NS.replace(/-/g, '').match(/../g), (h) => parseInt(h, 16));

async function uuid5(name) {
  const n = enc.encode(name);
  const buf = new Uint8Array(16 + n.length);
  buf.set(nsBytes);
  buf.set(n, 16);
  const h = new Uint8Array(await crypto.subtle.digest('SHA-1', buf)).slice(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = hex(h);
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
const lineId = async (unit, row) => 'line_' + (await uuid5('line:' + unit + ':' + row));

// The Python canonical form (sort_keys, no spaces, ensure_ascii=False).
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return (
    '{' +
    Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
      .join(',') +
    '}'
  );
}
const rowsShard = (digest) => (parseInt(digest.slice(0, 2), 16) >> 2).toString(16).padStart(2, '0');
const unitShard = (id) => /^reading_([0-9a-f]{2})/.exec(id)?.[1];

class Closed extends Error {}
class VersionUnavailable extends Error {}
class StaticFetchError extends Error {
  constructor(path, status) {
    super(`The Library could not load ${path} (${status}).`);
    this.path = path;
    this.status = status;
  }
}

// Static files, raw: gzip is undone here so the bytes can be hashed. Cached
// per tab; a failure is forgotten so Retry asks again.
const FILES = new Map();
function fetchBytes(lib, path, reload = false) {
  if (reload || !FILES.has(path)) {
    const pending = (async () => {
      const r = await fetch(lib.base + path, reload ? { cache: 'reload' } : undefined);
      if (!r.ok) throw new StaticFetchError(path, r.status);
      let b = new Uint8Array(await r.arrayBuffer());
      if (b[0] === 0x1f && b[1] === 0x8b)
        b = new Uint8Array(
          await new Response(
            new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))
          ).arrayBuffer()
        );
      return b;
    })().catch((e) => {
      if (FILES.get(path) === pending) FILES.delete(path);
      throw e;
    });
    FILES.set(path, pending);
  }
  return FILES.get(path);
}
const fetchJSON = async (lib, path, reload = false) =>
  JSON.parse(dec.decode(await fetchBytes(lib, path, reload)));

async function refreshedKey(lib, id) {
  // Recovery must bypass both the tab's FILES cache and lib.unitPath's cache.
  const shard = await fetchJSON(lib, `u/${unitShard(id)}.json.gz`, true);
  const key = (shard.units || []).find((u) => u[0] === id)?.[1];
  if (!/^[0-9a-f]{16}-[0-9a-f]{12}$/.test(key || ''))
    throw new VersionUnavailable('This reading is not currently in the Library’s readable set.');
  return key;
}

// ─── the reading model ─────────────────────────────────────────────────────
async function resolveKey(lib, id, key) {
  if (key) return key;
  if (typeof lib.unitPath === 'function') {
    try {
      const p = await lib.unitPath(id);
      const m = typeof p === 'string' && /([0-9a-f]{16}-[0-9a-f]{12})\/?(head\.json\.gz)?$/.exec(p);
      if (m) return m[1];
    } catch {
      /* fall through to the shard */
    }
  }
  const hh = unitShard(id);
  if (!hh) throw new Closed('That is not a reading id.');
  const shard = await fetchJSON(lib, `u/${hh}.json.gz`);
  const hit = (shard.units || []).find((u) => u[0] === id);
  if (!hit) throw new Closed('This reading is not in the Library’s readable set.');
  return hit[1];
}

// One page's lines, derived from its start counters (replay in
// catalog_static_export.py). The shipped analysis_line must agree.
async function derive(unit, rows, start) {
  let row = start.row_start,
    cp = start.normalized_cp_start,
    utf = start.normalized_utf16_start,
    sung = start.analysis_line_start;
  const ids = await Promise.all(rows.map((_, i) => lineId(unit, start.row_start + i)));
  return rows.map(([kind, text, indent, physical, analysis, srcCp, srcText, ranges], i) => {
    const line = {
      row,
      id: ids[i],
      kind,
      text,
      indent,
      physical_line: physical,
      analysis_line: null,
      normalized_cp_range: null,
      normalized_utf16_range: null,
      source_cp_range: srcCp,
      source_text: srcText == null ? text : srcText,
      source_ranges: (ranges || []).map((r) => ({
        codepoint_range: r[0],
        byte_range: r[1],
        utf16_range: r[2],
        physical_line: r[3],
        precision: r[4],
      })),
    };
    if (kind === 'lyric') {
      if (sung) {
        cp += 1;
        utf += 1;
      }
      sung += 1;
      line.analysis_line = sung;
      line.normalized_cp_range = [cp, cp + cplen(text)];
      line.normalized_utf16_range = [utf, utf + u16len(text)];
      cp += cplen(text);
      utf += u16len(text);
    }
    if (line.analysis_line !== analysis)
      throw new Closed('A page’s line numbering does not match its offsets.');
    row++;
    return line;
  });
}

function checkIdentity(file, R, index) {
  if (
    file.reading_unit_id !== R.id ||
    (R.revision && file.reading_revision !== R.revision) ||
    file.page_index !== index ||
    (R.pageCount && file.page_count !== R.pageCount)
  )
    throw new Closed('A page of this reading is not the one requested.');
}

async function openReading(lib, id, key) {
  const pathKey = await resolveKey(lib, id, key);
  const dir = `r/${unitShard(id)}/${id}/${pathKey}/`;
  const raw = await fetchBytes(lib, dir + 'head.json.gz');
  if ((await sha256(raw)).slice(0, 12) !== pathKey.slice(17))
    throw new Closed('The reading’s head does not match its address.');
  const head = JSON.parse(dec.decode(raw));
  const R = { id, dir, pathKey, head, revision: null, pageCount: null, pages: new Map() };
  checkIdentity(head, R, 0);
  if (
    head.page_count !== head.pages.length + 1 ||
    !head.reading_revision.startsWith(pathKey.slice(0, 16))
  )
    throw new Closed('The reading’s head does not match its address.');
  R.revision = head.reading_revision;
  R.pageCount = head.page_count;
  R.pages.set(0, { start: head.start, lines: await derive(id, head.lines, head.start) });
  return R;
}

async function loadPage(lib, R, index) {
  if (R.pages.has(index)) return R.pages.get(index);
  if (index < 1 || index >= R.pageCount) throw Error('No such page.');
  const digest = R.head.pages[index - 1];
  const raw = await fetchBytes(lib, `${R.dir}${index}-${digest.slice(0, 12)}.json.gz`);
  if ((await sha256(raw)) !== digest)
    throw new Closed('A page of this reading failed its integrity check.');
  const file = JSON.parse(dec.decode(raw));
  checkIdentity(file, R, index);
  const page = { start: file.start, lines: await derive(R.id, file.lines, file.start) };
  R.pages.set(index, page);
  return page;
}

async function allLines(lib, R) {
  const out = [];
  for (let i = 0; i < R.pageCount; i++) out.push(...(await loadPage(lib, R, i)).lines);
  return out;
}

async function wholeText(lib, R) {
  const lines = await allLines(lib, R);
  const text = lines
    .filter((l) => l.kind === 'lyric')
    .map((l) => l.text)
    .join('\n');
  if ((await sha256(text)) !== R.head.normalized_sha256)
    throw new Closed('The reading’s text does not match its recorded hash.');
  return { lines, text };
}

// The exact canonical rights object (rebuild_rights) and the metadata header.
async function rightsOf(lib, R) {
  if (R.rights) return R.rights;
  const ref = R.head.rights_ref;
  const interned = (await fetchJSON(lib, `rights/r-${ref.slice(0, 2)}.json.gz`)).rights[ref];
  if (!interned) throw Error('The reading’s rights record is missing.');
  const rights = { ...interned };
  for (const k of ['sources', 'file_sources']) {
    rights[k] = await Promise.all(
      (interned[k] || []).map(
        async (d) => (await fetchJSON(lib, `rights/rows-${rowsShard(d)}.json.gz`)).rows[d]
      )
    );
  }
  rights.notices = await Promise.all(
    (interned.notices || []).map(async (n) => ({
      ...n,
      text: (await fetchJSON(lib, `notices/${n.sha256}.json`)).text,
    }))
  );
  if ((await sha256(canonical(rights))) !== ref)
    throw new Closed('The reading’s rights record failed its check.');
  return (R.rights = rights);
}
async function metadataOf(lib, R) {
  if (R.metadata) return R.metadata;
  const ref = R.head.metadata_ref;
  const m = (await fetchJSON(lib, `meta/${rowsShard(ref)}.json.gz`)).metadata[ref];
  if (!m) throw Error('The reading’s metadata header is missing.');
  return (R.metadata = m);
}
async function snapshotOf(lib, R) {
  try {
    // A saved path can still serve a retained revision after the catalog moves
    // on. Only label it with a snapshot that actually contains that revision.
    const [c, shard] = await Promise.all([
      typeof lib.catalog === 'function' ? lib.catalog() : fetchJSON(lib, 'catalog.json'),
      fetchJSON(lib, `u/${unitShard(R.id)}.json.gz`),
    ]);
    const snapshot = c?.projected_from?.snapshot_id;
    if (
      typeof snapshot !== 'string' ||
      !/^[0-9a-f]{64}$/.test(snapshot) ||
      !c?.data_id ||
      shard.data_id !== c.data_id
    )
      return '';
    const key = (shard.units || []).find((u) => u[0] === R.id)?.[1];
    if (!key) return '';
    // A retained projection of the same canonical revision is still valid.
    // Check the full revision, not just the sixteen characters in a path key.
    const current = key === R.pathKey ? R : await openReading(lib, R.id, key);
    return current.revision === R.revision ? snapshot : '';
  } catch {
    return '';
  }
}
function requireSnapshot(snapshot) {
  if (!snapshot)
    // Missing origin is not a content-integrity failure: keep the saved text
    // visible, but never emit an import envelope with an invented identity.
    throw Error(
      'This reading’s snapshot could not be verified. Its saved text is still available. Reload the page or open the current reading before exporting or sending it to Lyrics.'
    );
  return snapshot;
}
// Canonical (sorted-key) order, as the Worker's wholeReading spread emits it.
const sorted = (o) =>
  Object.fromEntries(
    Object.keys(o)
      .sort()
      .map((k) => [k, o[k]])
  );
const sourceBasis = (R, rights) => {
  const out = { canonical_reading_sha256: R.head.canonical_reading_sha256 };
  for (const k of SOURCE_BASIS_FIELDS) if (k in rights) out[k] = rights[k];
  return sorted(out);
};

async function provenance(lib, R) {
  const [lines, rights, metadata, snapshot] = await Promise.all([
    allLines(lib, R),
    rightsOf(lib, R),
    metadataOf(lib, R),
    snapshotOf(lib, R),
  ]);
  return {
    snapshot_id: requireSnapshot(snapshot),
    reading_unit_id: R.id,
    reading_revision: R.revision,
    rights,
    source_map: sorted({ ...R.head.source_map, rows: lines.map((l) => l.id) }),
    source_marks: R.head.source_marks,
    source_labels: R.head.source_labels,
    source_basis: sourceBasis(R, rights),
    work_reviewed_equivalence: R.head.work_reviewed_equivalence,
    metadata,
  };
}

// codex-musica.library-import v1 (library-client.ts openLyrics; validated by
// src/library-import.js).
async function buildEnvelope(lib, R, excerptIds, declarations) {
  const [{ lines, text }, rights, metadata, snapshot] = await Promise.all([
    wholeText(lib, R),
    rightsOf(lib, R),
    metadataOf(lib, R),
    snapshotOf(lib, R),
  ]);
  const picked = lines.filter(
    (l) => l.analysis_line !== null && (!excerptIds || excerptIds.has(l.id))
  );
  if (excerptIds && !picked.length) throw Error('Select at least one analysis line.');
  const h = R.head;
  const envelope = {
    protocol: 'codex-musica.library-import',
    version: 1,
    handoffId: crypto.randomUUID(),
    draftId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    payload: {
      text: excerptIds ? picked.map((l) => l.text).join('\n') : text,
      title: h.title,
      language: h.language,
      scope: excerptIds ? 'excerpt' : 'whole',
      provenance: {
        snapshotId: requireSnapshot(snapshot),
        unitId: R.id,
        workId: h.work_id,
        editionId: h.edition_id,
        revisionId: R.revision,
        source_sha256: h.source_sha256,
        normalized_sha256: h.normalized_sha256,
        source_path: h.source_path,
        rights,
        contributors: h.contributors,
        completeness: h.completeness,
        metadata,
        source_map: sorted({ ...h.source_map, rows: lines.map((l) => l.id) }),
        source_marks: h.source_marks,
        source_labels: h.source_labels,
        source_basis: sourceBasis(R, rights),
        work_reviewed_equivalence: h.work_reviewed_equivalence,
      },
      lineage: picked.map((l) => ({
        line_id: l.id,
        physical_line: l.physical_line,
        analysis_line: l.analysis_line,
        normalized_cp_range: l.normalized_cp_range,
        normalized_utf16_range: l.normalized_utf16_range,
        source_ranges: l.source_ranges,
      })),
      declarations: excerptIds ? [] : [declarations || {}],
    },
  };
  envelope.digest =
    typeof CMLibraryImport !== 'undefined' && CMLibraryImport.envelopeDigest
      ? await CMLibraryImport.envelopeDigest(envelope)
      : await sha256(
          canonical({
            protocol: envelope.protocol,
            version: envelope.version,
            handoffId: envelope.handoffId,
            draftId: envelope.draftId,
            createdAt: envelope.createdAt,
            payload: envelope.payload,
          })
        );
  return envelope;
}

// ─── marks (text-marks.tsx, plus repeated and end words) ──────────────────
const WORD = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}]+)*/gu;
const fold = (w) => w.normalize('NFC').toLocaleLowerCase();

function recordRanges(record, line, source, n) {
  const base = source ? line.source_cp_range?.[0] : line.normalized_cp_range?.[0];
  const out = [];
  if (!record || base == null) return out;
  const add = (value) => {
    if (!value || typeof value !== 'object') return;
    if (value.parts?.length) return value.parts.forEach(add);
    if (!value.codepoint_range) return;
    const [s, e] = value.codepoint_range.map((x) => x - base);
    if (e > 0 && s < n && e > s)
      out.push({
        start: Math.max(0, s),
        end: Math.min(n, e),
        cls:
          (value.precision ?? (source ? 'span' : 'exact')) === 'exact' ? 'rd-exact' : 'rd-mapped',
      });
  };
  const keys = ['source_ranges', 'normalized_ranges', 'normalized_range', 'normalized_cp_range'];
  const walk = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(walk);
    for (const [k, child] of Object.entries(value)) {
      if (k === (source ? 'source_ranges' : 'normalized_ranges') && Array.isArray(child))
        child.forEach(add);
      else if (!source && k === 'normalized_range') add(child);
      else if (!source && k === 'normalized_cp_range' && Array.isArray(child))
        add({ codepoint_range: child });
      else if (!keys.includes(k)) walk(child);
    }
  };
  walk(record);
  return out;
}

// Word spans in code points: [{start, end, key}].
function words(text) {
  const out = [];
  for (const m of text.matchAll(WORD)) {
    const start = cplen(text.slice(0, m.index));
    out.push({ start, end: start + cplen(m[0]), key: fold(m[0]) });
  }
  return out;
}

const MARK_TITLES = {
  'rd-exact': 'Exact recorded span',
  'rd-mapped': 'Mapped source span; character precision is not asserted',
  'rd-rep': 'Repeated word',
  'rd-end': 'End word',
};

function markText(text, ranges) {
  if (!text) return ' ';
  if (!ranges.length) return esc(text);
  const chars = Array.from(text);
  const points = [...new Set([0, chars.length, ...ranges.flatMap((r) => [r.start, r.end])])].sort(
    (a, b) => a - b
  );
  let html = '';
  for (let i = 0; i < points.length - 1; i++) {
    const s = points[i],
      e = points[i + 1];
    const value = esc(chars.slice(s, e).join(''));
    const hits = ranges.filter((r) => r.start < e && r.end > s);
    if (!hits.length) {
      html += value;
      continue;
    }
    const ev = hits.filter((r) => r.cls === 'rd-exact' || r.cls === 'rd-mapped');
    const cls = new Set(hits.map((r) => r.cls));
    if (ev.length) {
      cls.delete('rd-exact');
      cls.delete('rd-mapped');
      cls.add(ev.every((r) => r.cls === 'rd-exact') ? 'rd-exact' : 'rd-mapped');
    }
    html += `<mark class="${[...cls].join(' ')}" title="${esc([...cls].map((c) => MARK_TITLES[c]).join(' · '))}">${value}</mark>`;
  }
  return html;
}

// ─── small views ───────────────────────────────────────────────────────────
function valueTree(v, depth = 0) {
  if (v === null || v === undefined || v === '') return '<span class="rd-faint">—</span>';
  if (typeof v !== 'object') return `<span class="rd-val">${esc(String(v))}</span>`;
  if (depth > 6) return `<code>${esc(JSON.stringify(v))}</code>`;
  if (Array.isArray(v)) {
    if (!v.length) return '<span class="rd-faint">none</span>';
    if (v.every((x) => x === null || typeof x !== 'object'))
      return `<span class="rd-val">${esc(v.join(' · '))}</span>`;
    return `<ol class="rd-tree-list">${v.map((x) => `<li>${valueTree(x, depth + 1)}</li>`).join('')}</ol>`;
  }
  const keys = Object.keys(v);
  if (!keys.length) return '<span class="rd-faint">none</span>';
  return `<dl class="rd-tree">${keys
    .map((k) => `<dt>${esc(k.replace(/_/g, ' '))}</dt><dd>${valueTree(v[k], depth + 1)}</dd>`)
    .join('')}</dl>`;
}
const words_ = (s) => String(s || '').replace(/_/g, ' ');
const btn = (act, label, ic, extra = '', cls = 'cm-btn') =>
  `<button type="button" class="${cls}" data-rd="${act}" ${extra}>${ic ? icon(ic, 16) : ''}<span>${esc(label)}</span></button>`;

// ─── styles ────────────────────────────────────────────────────────────────
const CSS = `
#surface-library .rd{display:flex;flex-direction:column;gap:12px;min-width:0}
#surface-library .rd-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
#surface-library .rd-toolbar .rd-spacer{flex:1}
#surface-library .rd-toolbar label{display:inline-flex;align-items:center;gap:6px;font-size:var(--cm-text-sm);color:var(--cm-text-secondary)}
#surface-library .rd-cols{display:grid;grid-template-columns:minmax(0,1fr) 344px;gap:20px;align-items:start}
#surface-library .rd.rd-noinsp .rd-cols{grid-template-columns:minmax(0,1fr)}
#surface-library .rd.rd-noinsp .rd-insp{display:none}
#surface-library .rd-paper{background:var(--cm-surface);border:1px solid var(--cm-border-subtle);border-radius:var(--cm-radius-lg);padding:28px clamp(16px,4vw,48px);min-width:0;color:var(--cm-text)}
#surface-library .rd-eyebrow{font-size:var(--cm-text-xs);text-transform:uppercase;letter-spacing:.06em;color:var(--cm-text-muted);margin:0}
#surface-library .rd-paper h1{font-family:Georgia,'Times New Roman',serif;font-size:var(--cm-text-2xl);font-weight:500;margin:6px 0;overflow-wrap:anywhere}
#surface-library .rd-author{color:var(--cm-text-secondary);margin:0 0 12px}
#surface-library .rd-row{display:flex;flex-wrap:wrap;gap:8px}
#surface-library .rd-alert{background:var(--cm-info-soft);color:var(--cm-info-text);border-radius:var(--cm-radius-md);padding:10px 12px;margin:12px 0;font-size:var(--cm-text-sm)}
#surface-library .rd-alert[data-tone=danger]{background:var(--cm-danger-soft);color:var(--cm-danger-text)}
#surface-library .rd-bar{position:sticky;top:8px;z-index:4;display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:var(--cm-surface-overlay,var(--cm-surface));border:1px solid var(--cm-border);box-shadow:var(--cm-shadow-2);border-radius:var(--cm-radius-md);padding:8px 10px;margin:12px 0;font-size:var(--cm-text-sm)}
#surface-library .rd-bar b{margin-inline-end:auto}
#surface-library .rd-bar button{background:none;border:0;color:var(--cm-link);padding:6px 8px;min-height:32px;font:inherit;cursor:pointer;border-radius:var(--cm-radius-sm);display:inline-flex;align-items:center;gap:4px}
#surface-library .rd-bar button:hover{background:var(--cm-hover)}
#surface-library .rd-lines{font-family:Georgia,'Times New Roman',serif;line-height:1.8;white-space:pre-wrap;margin:20px 0}
#surface-library .rd-line{display:grid;grid-template-columns:34px minmax(0,1fr) 24px;gap:9px;padding:1px 3px;border-radius:var(--cm-radius-sm);scroll-margin-top:120px}
#surface-library .rd-lines[dir=rtl] .rd-line{direction:ltr}
#surface-library .rd-lines[dir=rtl] .rd-text{direction:rtl;text-align:right}
#surface-library .rd-text{overflow-wrap:anywhere;min-width:0}
#surface-library .rd-num{padding:0;border:0;background:none;color:var(--cm-text-faint);font:12px/2.6 var(--cm-font);text-align:right;cursor:pointer;border-radius:var(--cm-radius-sm)}
#surface-library .rd-num:disabled{cursor:default}
#surface-library .rd-num:not(:disabled):hover{color:var(--cm-accent-text);background:var(--cm-hover)}
#surface-library .rd-src{border:0;background:none;color:var(--cm-text-faint);font-size:12px;padding:0;opacity:0;cursor:pointer}
#surface-library .rd-line:hover .rd-src,#surface-library .rd-line:focus-within .rd-src{opacity:1}
#surface-library .rd-k-title,#surface-library .rd-k-apparatus,#surface-library .rd-k-structure{font:var(--cm-text-sm)/1.7 var(--cm-font);color:var(--cm-text-muted)}
#surface-library .rd-k-blank{min-height:14px}
#surface-library .rd-hl{background:var(--cm-info-soft);box-shadow:inset 0 -1px 0 var(--cm-blue)}
#surface-library .rd-sel{background:var(--cm-success-soft)}
#surface-library mark{color:inherit;background:transparent}
#surface-library mark.rd-exact{background:var(--cm-info-soft);border-bottom:2px solid var(--cm-blue)}
#surface-library mark.rd-mapped{border-bottom:2px dotted var(--cm-text-muted)}
#surface-library mark.rd-rep{background:var(--cm-accent-soft)}
#surface-library mark.rd-end{box-shadow:inset 0 -2px 0 var(--cm-amber)}
#surface-library .rd-more{width:100%;justify-content:center;margin:8px 0}
#surface-library .rd-foot{display:flex;gap:8px;align-items:center;color:var(--cm-text-muted);font-size:var(--cm-text-xs);border-top:1px solid var(--cm-border-subtle);padding-top:12px;margin-top:16px}
#surface-library .rd-insp{position:sticky;top:8px;max-height:calc(100vh - 140px);overflow:auto;background:var(--cm-surface);border:1px solid var(--cm-border-subtle);border-radius:var(--cm-radius-lg);padding:12px;color:var(--cm-text)}
#surface-library .rd-insp-head{display:none;align-items:center;justify-content:space-between;gap:8px}
#surface-library .rd-lens{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}
#surface-library .rd-sec{border-top:1px solid var(--cm-border-subtle);padding:12px 0}
#surface-library .rd-sec:first-of-type{border-top:0}
#surface-library .rd-sec h3{font-size:var(--cm-text-sm);font-weight:600;margin:0 0 8px}
#surface-library .rd-note{color:var(--cm-text-muted);font-size:var(--cm-text-xs);margin:6px 0;overflow-wrap:anywhere}
#surface-library .rd-measure{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#surface-library .rd-measure div{background:var(--cm-surface-subtle);border-radius:var(--cm-radius-md);padding:8px;font-size:var(--cm-text-xs);color:var(--cm-text-muted)}
#surface-library .rd-measure b{display:block;font-size:var(--cm-text-md);color:var(--cm-text)}
#surface-library .rd-tree{display:grid;grid-template-columns:minmax(80px,auto) 1fr;gap:2px 10px;margin:0;font-size:var(--cm-text-xs)}
#surface-library .rd-tree dt{color:var(--cm-text-muted)}
#surface-library .rd-tree dd{margin:0;overflow-wrap:anywhere;min-width:0}
#surface-library .rd-tree-list{margin:0;padding-inline-start:16px}
#surface-library .rd-faint{color:var(--cm-text-faint)}
#surface-library .rd-hash{font:var(--cm-text-xs)/1.6 var(--cm-font-mono);overflow-wrap:anywhere;color:var(--cm-text-secondary)}
#surface-library .rd-speech{display:grid;gap:8px;font-size:var(--cm-text-sm)}
#surface-library .rd-speech label{display:grid;gap:4px;color:var(--cm-text-secondary)}
#surface-library .rd-compare:empty{display:none}
#surface-library .rd-compare{background:var(--cm-surface);border:1px solid var(--cm-border-subtle);border-radius:var(--cm-radius-lg);padding:12px}
#surface-library .rd-mobile{display:none}
@media (max-width:899px){
#surface-library .rd-cols{grid-template-columns:minmax(0,1fr)}
#surface-library .rd-mobile{display:inline-flex}
#surface-library .rd-insp{display:none;position:fixed;left:0;right:0;bottom:0;top:auto;max-height:85svh;z-index:60;border-radius:var(--cm-radius-lg) var(--cm-radius-lg) 0 0;box-shadow:var(--cm-shadow-3)}
#surface-library .rd.rd-sheet .rd-insp{display:block}
#surface-library .rd-insp-head{display:flex}
#surface-library .rd-paper{padding:20px 16px}
#surface-library .rd-num,#surface-library .rd-bar button{min-height:44px}
#surface-library .rd-src{opacity:1}
}`;

// ─── the view ──────────────────────────────────────────────────────────────
let S = null; // the one open reader

function parse(sub) {
  const [path, query = ''] = sub.split('?');
  const m = /^\/read\/([^/?#]+)/.exec(path);
  const params = new URLSearchParams(query);
  let id = m ? decodeURIComponent(m[1]) : '';
  const selectors = [...params.getAll('revision'), ...params.getAll('key')];
  const at = /^(reading_[0-9a-f-]{36})[@:](.*)$/.exec(id);
  if (at) {
    id = at[1];
    selectors.push(at[2]);
  }
  const selector = selectors[0];
  const key = /^[0-9a-f]{16}-[0-9a-f]{12}$/.test(selector || '') ? selector : '';
  const revision = /^[0-9a-f]{64}$/.test(selector || '') ? selector : '';
  const error =
    selectors.some((s) => s !== selector) || (selectors.length && !key && !revision)
      ? 'The reading version selector is invalid or conflicting.'
      : '';
  return { id, key, revision, params, error };
}

function store(name, value) {
  try {
    if (value === undefined)
      return JSON.parse(localStorage.getItem('cm-library-' + name) || 'null');
    localStorage.setItem('cm-library-' + name, JSON.stringify(value));
  } catch {
    return null;
  }
}

function route(extra) {
  const q = new URLSearchParams(S.params);
  const set = (k, v) => (v != null && v !== '' ? q.set(k, v) : q.delete(k));
  q.delete('key');
  q.delete('snapshot');
  q.delete('play');
  q.delete('autoplay');
  q.set('revision', S.R.pathKey);
  if (q.has('offset') && Number(q.get('offset')) !== extra.offset) {
    for (const k of ['line', 'span', 'precision']) q.delete(k);
  }
  set('offset', extra.offset);
  set('lens', S.lens !== 'summary' ? S.lens : '');
  set('view', S.source ? 'source' : '');
  if ('compare' in extra) set('compare', extra.compare);
  const s = q.toString();
  return `/read/${S.R.id}${s ? '?' + s : ''}`;
}
function replaceRoute(extra = {}) {
  S.ownRoute = route({ offset: S.firstRow(), ...extra });
  S.params = new URLSearchParams(S.ownRoute.split('?')[1]);
  try {
    S.lib.go(S.ownRoute, { replace: true });
  } catch {
    /* routing is core's; the reader keeps its own state */
  }
}

async function show(main, sub, lib) {
  if (!document.querySelector('style[data-lib="reader"]'))
    document.head.insertAdjacentHTML('beforeend', `<style data-lib="reader">${CSS}</style>`);
  const { id, key, revision, params, error } = parse(sub);
  // Our own replace navigation, or a param change on the open reading.
  if (
    !error &&
    S &&
    S.main === main &&
    S.R?.id === id &&
    main.contains(S.root) &&
    (key === S.R.pathKey || (revision && revision === S.R.revision))
  ) {
    if (sub === S.ownRoute) return;
    applyParams(params);
    replaceRoute(params.has('offset') ? { offset: Number(params.get('offset')) || 0 } : {});
    return;
  }
  stop();
  S = {
    main,
    lib,
    params,
    root: null,
    R: null,
    window: [0, 0],
    sel: new Set(),
    hl: new Set(),
    record: null,
    lens: 'summary',
    source: params.get('view') === 'source',
    size: Math.min(32, Math.max(16, Number(store('text-size')) || 20)),
    marks: store('marks') || { rep: false, end: false },
    inspector: store('inspector') !== false,
    notice: '',
    error: '',
    busy: false,
    speaking: false,
    gen: 0,
    rowGeneration: 0,
    voice: '',
    speed: 1,
    ownRoute: null,
  };
  S.firstRow = () => S.window[0] * PAGE_ROWS;
  main.dataset.libraryChunk = 'reader';
  if (!id) {
    main.innerHTML = uiEmptyState({
      title: 'Reading unavailable',
      text: 'That is not a reading address.',
    });
    return;
  }
  main.innerHTML = uiEmptyState({ title: 'Opening the source…' });
  const mine = S;
  try {
    if (error) throw Error(error);
    const R = await openReading(lib, id, key);
    if (S !== mine) return;
    if (revision && revision !== R.revision)
      throw new VersionUnavailable(
        'The requested reading version is unavailable here or has changed. Open the current reading to start without the old position or selection.'
      );
    S.R = R;
    const pos = store('position:' + id);
    let offset = Number(params.get('offset'));
    if (!params.has('offset') && pos && pos.revision === R.revision) offset = pos.offset;
    const page = Math.max(0, Math.min(R.pageCount - 1, Math.floor((offset || 0) / PAGE_ROWS)));
    if (page) await loadPage(lib, R, page);
    if (S !== mine) return;
    S.window = [page, page];
    const lens = params.get('lens');
    if (LENSES.some(([l]) => l === lens)) S.lens = lens;
    const span = params.get('span')?.split(':').map(Number);
    if (span?.length === 2 && span.every(Number.isSafeInteger))
      S.record = {
        id: 'search-anchor',
        kind: 'line',
        normalized_ranges: [
          {
            codepoint_range: span,
            precision: params.get('precision') === 'exact' ? 'exact' : 'span',
          },
        ],
      };
    if (params.get('line')) S.hl = new Set([params.get('line')]);
    render();
    const anchor =
      params.get('line') ||
      (!params.has('offset') && pos?.revision === R.revision && pos.line_id) ||
      '';
    const row = params.has('offset') ? offset : null;
    requestAnimationFrame(() => {
      if (S === mine && S.R === R) scrollToLine(anchor, row);
    });
    replaceRoute({ offset: offset || 0 });
    if (params.get('compare')) openCompare(null, params.get('compare'));
    if (params.get('autoplay') === '1' || params.get('play') === '1') {
      setTimeout(() => {
        if (S === mine && S.R === R) speak(true);
      }, 300);
    }
  } catch (e) {
    if (S !== mine) return;
    console.error('[library reader]', e);
    const missingPath =
      key &&
      e instanceof StaticFetchError &&
      e.status === 404 &&
      e.path === `r/${unitShard(id)}/${id}/${key}/head.json.gz`;
    const canOpenCurrent = missingPath || e instanceof VersionUnavailable;
    main.innerHTML = uiEmptyState({
      title: e instanceof Closed ? 'This reading failed its check' : 'Reading unavailable',
      text: e.message + (e instanceof Closed ? ' No text is shown. Reload to fetch it again.' : ''),
      actions: `${canOpenCurrent ? '<button type="button" class="cm-btn" data-rd-current>Open current reading</button><p data-rd-recovery-error role="alert"></p>' : ''}<button type="button" class="cm-btn" data-rd-retry>${icon('refresh-cw', 16)}<span>Retry</span></button><button type="button" class="cm-btn" data-rd-back>${icon('arrow-left', 16)}<span>Works</span></button>`,
      tone: 'danger',
    });
    main.querySelector('[data-rd-retry]')?.addEventListener('click', () => {
      FILES.clear();
      S = null;
      show(main, sub, lib);
    });
    main.querySelector('[data-rd-back]')?.addEventListener('click', () => lib.go('/works'));
    main.querySelector('[data-rd-current]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const currentKey = missingPath ? await refreshedKey(lib, id) : '';
        if (S !== mine || !button.isConnected) return;
        const presentation = new URLSearchParams();
        for (const k of ['lens', 'view']) if (params.has(k)) presentation.set(k, params.get(k));
        if (currentKey) presentation.set('revision', currentKey);
        lib.go(`/read/${id}${presentation.size ? '?' + presentation : ''}`);
      } catch (error) {
        if (S === mine && button.isConnected)
          main.querySelector('[data-rd-recovery-error]').textContent = error.message;
      } finally {
        if (S === mine && button.isConnected) button.disabled = false;
      }
    });
  }
}

function applyParams(params) {
  S.params = params;
  const source = params.get('view') === 'source';
  if (source !== S.source) {
    S.source = source;
    S.root.querySelector('[data-rd="source"]').checked = source;
    S.root.querySelector('.rd-eyebrow').textContent =
      `${words_(S.R.head.completeness)} · ${source ? 'Source transcription' : 'Normalized reading text'}`;
    renderBody();
  }
  const lens = params.get('lens') || 'summary';
  if (LENSES.some(([l]) => l === lens) && lens !== S.lens) {
    S.lens = lens;
    renderInspector();
  }
  if (params.has('offset')) goToRow(Number(params.get('offset')) || 0);
  if (params.get('compare')) openCompare(null, params.get('compare'));
}

function stop() {
  if (!S) return;
  S.gen++;
  S.rowGeneration++;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* no speech */
  }
  S.observer?.disconnect();
  clearTimeout(S.posTimer);
  S.ana?.destroy?.();
  if (S.onKey) document.removeEventListener('keydown', S.onKey);
}

function windowLines() {
  const out = [];
  for (let p = S.window[0]; p <= S.window[1]; p++) out.push(...S.R.pages.get(p).lines);
  return out;
}
const shownLines = () => windowLines().filter((l) => S.source || SHOWN_KINDS.has(l.kind));

function render() {
  const R = S.R,
    h = R.head;
  const inSel = S.lib.selection?.ids?.has?.(R.id);
  S.main.innerHTML = `<div class="rd${S.inspector ? '' : ' rd-noinsp'}">
  <div class="rd-toolbar">
    ${btn('back', 'Works', 'arrow-left', '', 'cm-btn cm-btn-tonal')}
    <span class="cm-chip">${esc(LANGUAGE_NAMES[h.language] || h.language)}</span>
    <label><input type="checkbox" data-rd="source" ${S.source ? 'checked' : ''}> Source transcription</label>
    <button type="button" class="cm-chip" data-rd="mark-rep" aria-pressed="${!!S.marks.rep}">Repeated words</button>
    <button type="button" class="cm-chip" data-rd="mark-end" aria-pressed="${!!S.marks.end}">End words</button>
    <span class="rd-spacer"></span>
    <button type="button" class="cm-btn cm-btn-icon" data-rd="smaller" aria-label="Decrease reading size">A−</button>
    <button type="button" class="cm-btn cm-btn-icon" data-rd="larger" aria-label="Increase reading size">A+</button>
    ${btn('sheet', 'Inspect', 'search', '', 'cm-btn rd-mobile')}
    <button type="button" class="cm-btn cm-btn-icon" data-rd="inspector" aria-label="${S.inspector ? 'Collapse inspector' : 'Open inspector'}" aria-pressed="${S.inspector}">${icon(S.inspector ? 'panel-right-close' : 'panel-right-open', 18) || icon('sidebar', 18)}</button>
  </div>
  <div class="rd-compare" data-rd-compare></div>
  <div class="rd-cols">
    <article class="rd-paper" aria-label="Reading">
      <header>
        <p class="rd-eyebrow">${esc(words_(h.completeness))} · ${S.source ? 'Source transcription' : 'Normalized reading text'}</p>
        <h1 lang="${esc(h.language)}" dir="${esc(h.direction || 'ltr')}">${esc(h.title)}</h1>
        <p class="rd-author">${esc((h.contributors || []).map((c) => c.name).join(' · '))}</p>
        <div class="rd-row">
          ${btn('select', inSel ? 'In export selection' : 'Export selection', inSel ? 'check' : 'plus', `aria-pressed="${!!inSel}"`)}
          ${btn('compare', 'Compare', 'git-compare')}
          ${btn('lyrics', 'Open in Lyrics', 'external-link')}
        </div>
      </header>
      <div data-rd-alerts></div>
      <div data-rd-bar></div>
      <div data-rd-body></div>
      <footer class="rd-foot">${icon('book-open', 15)}<span>Every interpretation uses the complete identified reading unit. Apparatus is preserved in Source transcription.</span></footer>
    </article>
    <aside class="rd-insp" aria-label="Interpretation inspector"><div data-rd-insp></div><div data-rd-ana></div><div data-rd-speech></div></aside>
  </div>
</div>`;
  S.root = S.main.firstElementChild;
  S.root.addEventListener('click', onClick);
  S.root.addEventListener('change', onChange);
  S.root.addEventListener('input', onChange);
  S.onKey = (e) => {
    if (e.key !== 'Escape' || !S?.root?.isConnected) return;
    if (S.root.classList.contains('rd-sheet')) S.root.classList.remove('rd-sheet');
    else if (S.sel.size) {
      S.sel.clear();
      syncSelection();
      renderBody();
    }
  };
  document.addEventListener('keydown', S.onKey);
  renderAlerts();
  renderBody();
  renderInspector();
}

function renderAlerts() {
  const el = S.root?.querySelector('[data-rd-alerts]');
  if (!el) return;
  el.innerHTML =
    (S.error ? `<p class="rd-alert" data-tone="danger" role="alert">${esc(S.error)}</p>` : '') +
    (S.notice ? `<p class="rd-alert" role="status">${esc(S.notice)}</p>` : '');
}
const say = (notice, error = '') => {
  S.notice = notice;
  S.error = error;
  renderAlerts();
};

function renderBar() {
  const el = S.root.querySelector('[data-rd-bar]');
  el.innerHTML = S.sel.size
    ? `<div class="rd-bar" role="toolbar" aria-label="Passage actions"><b>${S.sel.size} line${S.sel.size === 1 ? '' : 's'} selected</b>
      <button type="button" data-rd="p-inspect">Inspect</button>
      <button type="button" data-rd="p-compare">Compare passage</button>
      <button type="button" data-rd="p-annotate">Annotate</button>
      <button type="button" data-rd="p-lyrics">Open excerpt in Lyrics</button>
      <button type="button" data-rd="p-clear" aria-label="Clear passage selection">${icon('x', 15)}</button></div>`
    : '';
}

function lineHTML(l, repeated) {
  const text = S.source ? l.source_text : l.text;
  const n = cplen(text);
  let ranges = recordRanges(S.record, l, S.source, n);
  if (!S.source && l.kind === 'lyric' && (S.marks.rep || S.marks.end)) {
    const ws = words(text);
    if (S.marks.rep)
      for (const w of ws) if (repeated.has(w.key)) ranges.push({ ...w, cls: 'rd-rep' });
    if (S.marks.end && ws.length) ranges.push({ ...ws[ws.length - 1], cls: 'rd-end' });
  }
  const num = S.source ? l.physical_line : (l.analysis_line ?? '');
  const sel = S.sel.has(l.id);
  const label = `${sel ? 'Deselect' : 'Select'} ${l.analysis_line != null ? 'analysis line ' + l.analysis_line : 'source row ' + l.physical_line}`;
  return `<div class="rd-line rd-k-${esc(l.kind)}${sel ? ' rd-sel' : ''}${S.hl.has(l.id) ? ' rd-hl' : ''}" id="${l.id}" data-row="${l.row}">
<button type="button" class="rd-num" data-rd="toggle" data-id="${l.id}" aria-label="${esc(label)}" aria-pressed="${sel}" ${l.analysis_line == null ? 'disabled' : ''}>${num}</button><span class="rd-text" lang="${esc(S.R.head.language)}" style="padding-inline-start:${S.source ? 0 : Math.min(l.indent || 0, 30)}ch">${markText(text, ranges)}</span><button type="button" class="rd-src" data-rd="srcrow" data-id="${l.id}" aria-label="Inspect source row ${l.physical_line}">↗</button></div>`;
}

function renderBody() {
  renderBar();
  const R = S.R;
  const lines = shownLines();
  let repeated = new Set();
  if (S.marks.rep && !S.source) {
    const count = new Map();
    for (const l of lines)
      if (l.kind === 'lyric')
        for (const w of words(l.text)) count.set(w.key, (count.get(w.key) || 0) + 1);
    repeated = new Set([...count].filter(([, c]) => c > 1).map(([k]) => k));
  }
  const loaded = windowLines();
  const last = loaded[loaded.length - 1];
  const total =
    (R.pageCount - 1) * PAGE_ROWS + (R.pageCount === 1 ? R.pages.get(0).lines.length : 0);
  const body = S.root.querySelector('[data-rd-body]');
  body.innerHTML = `${S.window[0] > 0 ? btn('prev', `Load preceding source rows · from row ${S.window[0] * PAGE_ROWS}`, 'chevron-up', '', 'cm-btn rd-more') : ''}
<div class="rd-lines" dir="${esc(R.head.direction || 'ltr')}" style="font-size:${S.size}px">${lines.map((l) => lineHTML(l, repeated)).join('')}</div>
${S.window[1] < R.pageCount - 1 ? btn('next', `Load next source rows · ${last ? last.row + 1 : 0} / ${R.pageCount > 1 ? '~' + total : total}+`, 'chevron-down', '', 'cm-btn rd-more') : ''}`;
  S.ana?.setLines(windowLines());
  observe();
}

// Reading position: the topmost visible line, saved 800 ms after it settles.
function observe() {
  S.observer?.disconnect();
  clearTimeout(S.posTimer);
  if (!('IntersectionObserver' in window)) return;
  const mine = S,
    R = S.R;
  S.observer = new IntersectionObserver(
    (entries) => {
      const top = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]?.target;
      if (!top) return;
      clearTimeout(mine.posTimer);
      mine.posTimer = setTimeout(() => {
        if (S !== mine || S.R !== R || !top.isConnected) return;
        store('position:' + R.id, {
          line_id: top.id,
          offset: Math.max(0, Number(top.dataset.row) - 30),
          revision: R.revision,
        });
      }, 800);
    },
    { rootMargin: '-120px 0px -55% 0px' }
  );
  S.root.querySelectorAll('.rd-line').forEach((el) => S.observer.observe(el));
}

function scrollToLine(id, row) {
  let el = id ? document.getElementById(id) : null;
  if (!el && row != null)
    el = [...S.root.querySelectorAll('.rd-line')].find((x) => Number(x.dataset.row) >= row);
  el?.scrollIntoView({ block: id ? 'center' : 'start' });
}

async function page(direction) {
  if (S.busy) return;
  const R = S.R;
  const target = direction === 'next' ? S.window[1] + 1 : S.window[0] - 1;
  if (target < 0 || target >= R.pageCount) return;
  S.busy = true;
  const mine = S;
  try {
    await loadPage(S.lib, R, target);
    if (S !== mine || !S.root?.isConnected) return;
    const lines = S.root.querySelector('.rd-lines');
    const before = lines?.scrollHeight || 0;
    const y = window.scrollY;
    if (direction === 'next') {
      S.window[1] = target;
      if (S.window[1] - S.window[0] + 1 > WINDOW_PAGES) S.window[0]++;
    } else {
      S.window[0] = target;
      if (S.window[1] - S.window[0] + 1 > WINDOW_PAGES) S.window[1]--;
    }
    const anchor = direction === 'next' ? lines?.lastElementChild : lines?.firstElementChild;
    const anchorId = anchor?.id;
    const anchorTop = anchor?.getBoundingClientRect().top;
    renderBody();
    // Keep the line the reader was at where it was on screen.
    const again = anchorId && document.getElementById(anchorId);
    if (again) window.scrollBy(0, again.getBoundingClientRect().top - anchorTop);
    else window.scrollTo(0, y + ((S.root.querySelector('.rd-lines')?.scrollHeight || 0) - before));
    replaceRoute();
  } catch (e) {
    if (S === mine) fail(e);
  } finally {
    mine.busy = false;
  }
}

async function goToRow(row) {
  const mine = S,
    generation = ++mine.rowGeneration,
    R = mine.R;
  const p = Math.max(0, Math.min(R.pageCount - 1, Math.floor(row / PAGE_ROWS)));
  if (p < mine.window[0] || p > mine.window[1]) {
    try {
      await loadPage(mine.lib, R, p);
    } catch (e) {
      if (S === mine && mine.rowGeneration === generation) fail(e);
      return;
    }
    if (S !== mine || mine.rowGeneration !== generation) return;
    S.window = [p, p];
    renderBody();
  }
  scrollToLine('', row);
}

function fail(e) {
  console.error('[library reader]', e);
  if (e instanceof Closed) {
    // Fail closed: no text from this reading stays on screen.
    stop();
    S.main.innerHTML = uiEmptyState({
      title: 'This reading failed its check',
      text: e.message + ' No text is shown. Reload to fetch it again.',
      tone: 'danger',
    });
    return;
  }
  say('', e.message || String(e));
}

// ─── inspector ─────────────────────────────────────────────────────────────
function renderInspector() {
  const el = S.root?.querySelector('[data-rd-insp]');
  if (!el) return;
  const R = S.R,
    h = R.head;
  const tabs = `<div class="rd-insp-head"><strong>Interpret this reading</strong>${btn('sheet-close', 'Close', 'x', '', 'cm-btn cm-btn-icon')}</div>
<div class="rd-lens cm-segmented" role="group" aria-label="Interpretation lenses">${LENSES.map(
    ([id, label]) =>
      `<button type="button" class="cm-chip${S.lens === id ? ' active' : ''}" data-rd="lens" data-id="${id}" aria-pressed="${S.lens === id}">${label}</button>`
  ).join('')}</div>`;
  let body = '';
  if (S.lens === 'summary') {
    const c = h.census || {};
    body = `<section class="rd-sec"><h3>This reading</h3>
<div class="rd-measure"><div><b>${esc(c.physical_source_rows ?? '—')}</b>physical rows</div><div><b>${esc(words_(h.completeness))}</b>documented scope</div>
<div><b>${esc(c.normalized_lines ?? '—')}</b>analysis lines</div><div><b>${esc(R.pageCount)}</b>page${R.pageCount === 1 ? '' : 's'} of ${PAGE_ROWS} rows</div></div>
<p class="rd-note">${esc(h.source_path)}</p><p class="rd-note">${esc(h.notation || '')} · ${esc(h.direction === 'rtl' ? 'right to left' : 'left to right')}</p></section>
`;
  } else if (S.lens === 'sources') {
    body = `<section class="rd-sec"><h3>Text, edition and digital witness</h3>${valueTree({
      work_id: h.work_id,
      edition_id: h.edition_id,
      contributors: h.contributors,
      source_path: h.source_path,
      completeness: h.completeness,
    })}<div data-rd-meta><p class="rd-note">Loading metadata…</p></div></section>
<section class="rd-sec"><h3>Rights and required credits</h3><div data-rd-rights><p class="rd-note">Loading rights…</p></div></section>
<section class="rd-sec"><h3>Recorded source labels</h3>${valueTree(h.source_labels)}
<h3 style="margin-top:12px">Exact source identity</h3><p class="rd-hash" data-rd-ident>Readings: snapshot …<br>Revision ${esc(R.revision)}<br>Source SHA256 ${esc(h.source_sha256)}<br>Normalized SHA256 ${esc(h.normalized_sha256)}</p>
${btn('provenance', 'Source details', 'download')}</section>`;
  }
  el.innerHTML = tabs + body;
  if (S.lens === 'sources') fillSources(el);
  ensureAnalysis().then((ana) => ana?.setLens(S.lens));
  renderSpeech();
}

function renderSpeech() {
  const el = S.root?.querySelector('[data-rd-speech]');
  if (!el) return;
  const h = S.R.head;
  let body = '';
  const voices = window.speechSynthesis?.getVoices?.() || [];
  body += `<section class="rd-sec rd-speech"><h3>Read aloud</h3>
<label>Device voice<select class="cm-select" data-rd="voice"><option value="">Match language</option>${voices
    .map(
      (v) =>
        `<option value="${esc(v.voiceURI)}"${v.voiceURI === S.voice ? ' selected' : ''}>${esc(v.name)} · ${esc(v.lang)}</option>`
    )
    .join('')}</select></label>
<label>Speed <span data-rd-speed-out>${S.speed.toFixed(1)}×</span><input type="range" data-rd="speed" min="0.5" max="2" step="0.1" value="${S.speed}"></label>
<div>${btn('speak', S.speaking ? 'Stop' : 'Read this work', S.speaking ? 'square' : 'play', `aria-pressed="${S.speaking}"`)}</div>
<p class="rd-note">${h.language === 'ltc' ? 'Modern Chinese device speech · independent from Middle Chinese analysis' : 'Device speech · independent from phonology evidence'}</p></section>`;
  el.innerHTML = body;
}

async function fillSources(el) {
  const mine = S;
  const [meta, rights, snap] = await Promise.allSettled([
    metadataOf(S.lib, S.R),
    rightsOf(S.lib, S.R),
    snapshotOf(S.lib, S.R),
  ]);
  if (S !== mine || !el.isConnected) return;
  const m = el.querySelector('[data-rd-meta]'),
    r = el.querySelector('[data-rd-rights]'),
    i = el.querySelector('[data-rd-ident]');
  if (m)
    m.innerHTML =
      meta.status === 'fulfilled'
        ? `<h3 style="margin-top:12px">Metadata</h3>${valueTree(meta.value)}`
        : `<p class="rd-alert" data-tone="danger">${esc(meta.reason.message)}</p>`;
  if (r)
    r.innerHTML =
      rights.status === 'fulfilled'
        ? valueTree(rights.value) +
          `<h3 style="margin-top:12px">Source basis</h3>` +
          valueTree(sourceBasis(S.R, rights.value))
        : `<p class="rd-alert" data-tone="danger">${esc(rights.reason.message)}</p>`;
  if (i && snap.status === 'fulfilled')
    i.innerHTML = i.innerHTML.replace(
      'snapshot …',
      'snapshot ' + esc(snap.value.slice(0, 12) || 'unverified')
    );
  if (rights.status === 'rejected' && rights.reason instanceof Closed) fail(rights.reason);
}

// What the analysis and compare chunks get: the open reading, verified.
function readingContext() {
  const R = S.R;
  const lib = S.lib;
  return {
    id: R.id,
    revision: R.revision,
    pathKey: R.pathKey,
    head: R.head,
    title: R.head.title,
    language: R.head.language,
    direction: R.head.direction,
    pageCount: R.pageCount,
    lines: () => windowLines(),
    allLines: () => allLines(lib, R),
    wholeText: () => wholeText(lib, R),
    rights: () => rightsOf(lib, R),
    metadata: () => metadataOf(lib, R),
    snapshotId: () => snapshotOf(lib, R),
    selection: () => [...S.sel],
    highlight: (record, lineIds) => highlight(record, lineIds),
    open: (sub) => lib.go(sub),
  };
}

function highlight(record, lineIds) {
  S.record = record || null;
  S.hl = new Set(lineIds || []);
  renderBody();
  const first = [...S.hl].map((id) => document.getElementById(id)).find(Boolean);
  if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  else if (S.hl.size)
    say('This evidence is elsewhere in the work. Load the next source rows to locate its spans.');
}

// One analysis controller per open reading (src/library/analysis.js mount):
// it follows the reader's lens, selection and loaded rows; the reader draws
// the lens tabs.
function ensureAnalysis() {
  if (S.anaP) return S.anaP;
  const mine = S;
  const host = S.root?.querySelector('[data-rd-ana]');
  S.anaP = libraryChunk('analysis')
    .then((analysis) => {
      if (S !== mine || !host?.isConnected) return null;
      S.ana = analysis.mount(host, {
        reading: S.R.head,
        lib: S.lib,
        lens: S.lens,
        selected: new Set(S.sel),
        lines: windowLines(),
        tabs: false,
        onHighlight: (ids, record) => highlight(record, [...(ids || [])]),
        onLens: (lens) => {
          S.lens = lens;
          renderInspector();
          replaceRoute();
        },
      });
      return S.ana;
    })
    .catch((e) => {
      console.warn('[library reader] analysis', e);
      if (host?.isConnected)
        host.innerHTML = `<p class="rd-note">Analysis is not available right now.</p>`;
      if (S === mine) S.anaP = null;
      return null;
    });
  return S.anaP;
}
const syncSelection = () => S.ana?.setSelection(new Set(S.sel));

async function openCompare(passage, other) {
  const host = S.root?.querySelector('[data-rd-compare]');
  if (!host) return;
  try {
    const compare = await libraryChunk('compare');
    await compare.mount(host, {
      reading: readingContext(),
      lib: S.lib,
      passage: passage || [],
      compare: other || '',
      close: () => {
        host.innerHTML = '';
        replaceRoute({ compare: '' });
      },
    });
    host.scrollIntoView({ block: 'start', behavior: 'smooth' });
  } catch (e) {
    console.warn('[library reader] compare', e);
    say('', 'Comparison is not available right now.');
  }
}

async function declarationsFor() {
  const ana = await ensureAnalysis();
  const d = ana?.declarations;
  return d && typeof d === 'object' ? d : {};
}

async function handoff(excerpt) {
  if (S.busy) return;
  S.busy = true;
  say(excerpt ? 'Preparing the excerpt for Lyrics…' : 'Preparing the whole reading for Lyrics…');
  let envelope;
  try {
    const ids = excerpt ? new Set(S.sel) : null;
    envelope = await buildEnvelope(S.lib, S.R, ids, excerpt ? null : await declarationsFor());
    const encoded = JSON.stringify(envelope);
    if (enc.encode(encoded).length > TRANSFER_BYTES) {
      uiDownload('codex-musica-library-import.json', encoded, 'application/json');
      say(
        'This reading is too large to hand over in the page. The import bundle was downloaded: in Lyrics, choose Import, or select an excerpt.'
      );
      return;
    }
    say('');
    await uiOpenInLyrics(envelope);
  } catch (e) {
    if (e instanceof Closed) return fail(e);
    if (envelope) {
      uiDownload('codex-musica-library-import.json', JSON.stringify(envelope), 'application/json');
      say(
        'Import bundle downloaded. In Lyrics, choose Import.',
        e.message ? 'Lyrics could not open it here: ' + e.message : ''
      );
    } else say('', e.message || String(e));
  } finally {
    if (S) S.busy = false;
  }
}

async function downloadProvenance() {
  try {
    uiDownload(
      'reading-provenance.json',
      JSON.stringify(await provenance(S.lib, S.R), null, 2),
      'application/json'
    );
  } catch (e) {
    fail(e);
  }
}

// ─── read aloud ────────────────────────────────────────────────────────────
function speak(auto) {
  const synth = window.speechSynthesis;
  if (S.speaking || !synth) {
    S.gen++;
    synth?.cancel();
    S.speaking = false;
    if (!synth) say('Device speech is not available in this browser.');
    return renderSpeech();
  }
  const voices = synth.getVoices();
  const tag = SPEECH_TAGS[S.R.head.language] ?? '!';
  const chosen =
    voices.find((v) => v.voiceURI === S.voice) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(tag));
  if (!chosen) {
    if (auto && !voices.length) {
      // Voices arrive asynchronously on first use.
      synth.addEventListener('voiceschanged', () => speak(true), { once: true });
      return;
    }
    return say('No matching device voice is available for this language.');
  }
  const gen = ++S.gen;
  const mine = S;
  S.speaking = true;
  renderSpeech();
  allLines(S.lib, S.R)
    .then((lines) => {
      const chunks = lines
        .filter((l) => l.analysis_line !== null)
        .map((l) => l.text)
        .filter(Boolean);
      let i = 0;
      const next = () => {
        if (S !== mine || gen !== S.gen) return;
        if (i >= chunks.length) {
          S.speaking = false;
          return renderSpeech();
        }
        const u = new SpeechSynthesisUtterance(chunks[i++]);
        u.voice = chosen;
        u.lang = chosen.lang;
        u.rate = S.speed;
        u.onend = next;
        u.onerror = () => {
          if (S !== mine || gen !== S.gen) return;
          S.speaking = false;
          renderSpeech();
        };
        synth.speak(u);
      };
      next();
    })
    .catch((e) => {
      S.speaking = false;
      fail(e);
      renderSpeech();
    });
}

// ─── events ────────────────────────────────────────────────────────────────
function toggleLine(id) {
  const l = windowLines().find((x) => x.id === id);
  if (!l || l.analysis_line == null) return;
  if (S.sel.has(id)) S.sel.delete(id);
  else S.sel.add(id);
  const el = document.getElementById(id);
  el?.classList.toggle('rd-sel', S.sel.has(id));
  const b = el?.querySelector('.rd-num');
  if (b) {
    b.setAttribute('aria-pressed', String(S.sel.has(id)));
    b.setAttribute(
      'aria-label',
      `${S.sel.has(id) ? 'Deselect' : 'Select'} analysis line ${l.analysis_line}`
    );
  }
  renderBar();
  syncSelection();
  store('position:' + S.R.id, {
    line_id: id,
    offset: Math.max(0, l.row - 30),
    revision: S.R.revision,
  });
}

function onClick(e) {
  const b = e.target.closest('[data-rd]');
  if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
  const act = b.dataset.rd,
    id = b.dataset.id;
  switch (act) {
    case 'back':
      return S.lib.go('/works');
    case 'toggle':
      return toggleLine(id);
    case 'srcrow': {
      const l = windowLines().find((x) => x.id === id);
      S.hl = new Set([id]);
      S.lens = 'sources';
      renderBody();
      renderInspector();
      openSheet();
      replaceRoute();
      return say(
        `Source row ${l.physical_line} · ${l.source_ranges.map((r) => r.precision).join(', ') || 'no'} coordinates`
      );
    }
    case 'mark-rep':
    case 'mark-end':
      S.marks[act === 'mark-rep' ? 'rep' : 'end'] = !S.marks[act === 'mark-rep' ? 'rep' : 'end'];
      store('marks', S.marks);
      b.setAttribute('aria-pressed', String(S.marks[act === 'mark-rep' ? 'rep' : 'end']));
      return renderBody();
    case 'smaller':
    case 'larger':
      S.size = Math.max(16, Math.min(32, S.size + (act === 'larger' ? 2 : -2)));
      store('text-size', S.size);
      S.root.querySelector('.rd-lines').style.fontSize = S.size + 'px';
      return;
    case 'inspector':
      S.inspector = !S.inspector;
      store('inspector', S.inspector);
      S.root.classList.toggle('rd-noinsp', !S.inspector);
      b.setAttribute('aria-pressed', String(S.inspector));
      b.setAttribute('aria-label', S.inspector ? 'Collapse inspector' : 'Open inspector');
      return;
    case 'sheet':
      return openSheet(true);
    case 'sheet-close':
      return S.root.classList.remove('rd-sheet');
    case 'select': {
      const sel = S.lib.selection;
      if (!sel) return;
      if (sel.ids.has(S.R.id)) sel.remove(S.R.id);
      else sel.add(S.R.id, S.R.head.collection_id);
      const on = sel.ids.has(S.R.id);
      b.outerHTML = btn(
        'select',
        on ? 'In export selection' : 'Export selection',
        on ? 'check' : 'plus',
        `aria-pressed="${on}"`
      );
      return;
    }
    case 'compare':
      return openCompare(null, '');
    case 'lyrics':
      return handoff(false);
    case 'prev':
      return page('previous');
    case 'next':
      return page('next');
    case 'lens':
      S.lens = id;
      renderInspector();
      return replaceRoute();
    case 'provenance':
      return downloadProvenance();
    case 'speak':
      return speak(false);
    case 'p-inspect':
      S.hl = new Set(S.sel);
      renderBody();
      if (S.lens === 'summary') {
        S.lens = 'sound';
        renderInspector();
        replaceRoute();
      }
      return openSheet(true);
    case 'p-compare':
      return openCompare([...S.sel], '');
    case 'p-annotate': {
      openSheet(true);
      return ensureAnalysis().then((ana) => {
        if (!ana) return;
        const host = S.root.querySelector('[data-rd-ana]');
        if (!host.querySelector('.la-decl')) host.querySelector('[data-act="decl"]')?.click();
        setTimeout(
          () =>
            host
              .querySelector('[data-slot="decl"]')
              ?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
          100
        );
      });
    }
    case 'p-lyrics':
      return handoff(true);
    case 'p-clear':
      S.sel.clear();
      syncSelection();
      return renderBody();
  }
}

function openSheet(force) {
  if (!S.inspector && !matchMedia('(max-width: 899px)').matches) {
    S.inspector = true;
    S.root.classList.remove('rd-noinsp');
  }
  if (force || matchMedia('(max-width: 899px)').matches) S.root.classList.add('rd-sheet');
}

function onChange(e) {
  const t = e.target;
  const act = t.dataset?.rd;
  if (act === 'source' && e.type === 'change') {
    S.source = t.checked;
    S.root.querySelector('.rd-eyebrow').textContent =
      `${words_(S.R.head.completeness)} · ${S.source ? 'Source transcription' : 'Normalized reading text'}`;
    renderBody();
    replaceRoute();
  } else if (act === 'voice') S.voice = t.value;
  else if (act === 'speed') {
    S.speed = Number(t.value);
    const out = S.root.querySelector('[data-rd-speed-out]');
    if (out) out.textContent = S.speed.toFixed(1) + '×';
  }
}

if (typeof window !== 'undefined' && window.speechSynthesis)
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    if (S?.root?.isConnected) {
      const sel = S.root.querySelector('[data-rd="voice"]');
      if (sel && sel.options.length <= 1) renderSpeech();
    }
  });

return {
  show,
  // For tests and the other chunks: the verified data path.
  _internals: {
    uuid5,
    lineId,
    derive,
    openReading,
    loadPage,
    wholeText,
    rightsOf,
    metadataOf,
    provenance,
    buildEnvelope,
    canonical,
  },
};
